import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { TOTAL_MATH_LEVELS, TOTAL_RW_LEVELS, resolveMathLevel, resolveRwLevel } from '../domains.catalog';

type Tab = 'math' | 'grammar';

export interface PathNode {
  sequenceLevel: number;
  mathTopic: string;
  grammarTopic: string | null;
  hasGrammarTab: boolean;
  status: string;
}

@Injectable()
export class StudyService {
  constructor(private readonly prisma: PrismaService) {}

  private async getProgress(userId: string) {
    const progress = await this.prisma.studyPathProgress.findUnique({ where: { userId } });
    return progress ?? { currentSequenceLevel: 1, mathTabDone: false, grammarTabDone: false };
  }

  // Единый путь 1-30. Каждый узел показывает есть ли grammar-таб (только для 1-15).
  async getPath(userId: string) {
    const progress = await this.getProgress(userId);

    const nodes: PathNode[] = [];
    for (let seq = 1; seq <= TOTAL_MATH_LEVELS; seq++) {
      const math = resolveMathLevel(seq);
      const rw = resolveRwLevel(seq);
      if (!math) continue;

      nodes.push({
        sequenceLevel: seq,
        mathTopic: math.domain.topics[math.domainLevel - 1],
        grammarTopic: rw ? rw.domain.topics[rw.domainLevel - 1] : null,
        hasGrammarTab: !!rw,
        status: seq < progress.currentSequenceLevel ? 'completed' : seq === progress.currentSequenceLevel ? 'current' : 'locked',
      });
    }

    return {
      currentSequenceLevel: progress.currentSequenceLevel,
      totalLevels: TOTAL_MATH_LEVELS,
      mathTabDone: progress.mathTabDone,
      grammarTabDone: progress.grammarTabDone,
      nodes,
    };
  }

  async getLevelContent(userId: string, sequenceLevel: number, tab: Tab) {
    const progress = await this.getProgress(userId);
    if (sequenceLevel > progress.currentSequenceLevel) {
      throw new ForbiddenException('Этот уровень ещё заблокирован — пройди предыдущие');
    }

    const resolved = tab === 'math' ? resolveMathLevel(sequenceLevel) : resolveRwLevel(sequenceLevel);
    if (!resolved) {
      throw new NotFoundException(tab === 'grammar' ? 'На этом уровне нет grammar-таба' : 'Уровень вне диапазона');
    }

    const scenarios = await this.prisma.lessonScenario.findMany({
      where: { domain: resolved.domain.key, domainLevel: resolved.domainLevel },
      orderBy: { order: 'asc' },
    });

    const quizQuestions = await this.prisma.question.findMany({
      where: { domain: resolved.domain.key, domainLevel: resolved.domainLevel },
      orderBy: { domainOrderInLevel: 'asc' },
    });

    const safeQuiz = quizQuestions.map(({ correctChoice, ...safe }) => safe);

    return {
      sequenceLevel,
      tab,
      domain: resolved.domain.key,
      topic: resolved.domain.topics[resolved.domainLevel - 1],
      scenarios,
      quiz: safeQuiz,
    };
  }

  // Батч-сдача квиза целиком (оставлена для обратной совместимости, если где-то
  // ещё используется) — нужно ответить верно на ВСЕ вопросы разом за один запрос.
  async submitQuiz(userId: string, sequenceLevel: number, tab: Tab, answers: { questionId: string; userAnswer: string }[]) {
    const resolved = tab === 'math' ? resolveMathLevel(sequenceLevel) : resolveRwLevel(sequenceLevel);
    if (!resolved) throw new BadRequestException('Неверный таб для этого уровня');

    const questions = await this.prisma.question.findMany({
      where: { domain: resolved.domain.key, domainLevel: resolved.domainLevel },
    });

    if (answers.length !== questions.length) {
      throw new BadRequestException(`Нужно ответить на все ${questions.length} вопросов квиза`);
    }

    const results = answers.map((a) => {
      const question = questions.find((q) => q.id === a.questionId);
      if (!question) throw new NotFoundException(`Вопрос ${a.questionId} не найден в этом квизе`);
      const correct = a.userAnswer.trim().toUpperCase() === question.correctChoice.trim().toUpperCase();
      return {
        questionId: a.questionId,
        correct,
        correctChoice: correct ? null : question.correctChoice,
        explanation: correct ? null : question.explanation,
      };
    });

    const allCorrect = results.every((r) => r.correct);
    let leveledUp = false;

    if (allCorrect) {
      const result = await this.markTabDone(userId, sequenceLevel, tab);
      leveledUp = result.leveledUp;
    }

    return { allCorrect, leveledUp, results };

    
  }

  // Один вопрос квиза за раз — с мгновенным фидбеком. Это ОСНОВНОЙ метод под
  // флоу "sequential scenarios -> quiz по одному вопросу -> explanation при ошибке".
  // Копит верно отвеченные вопросы через AnswerLog (по distinct questionId),
  // и когда ВСЕ вопросы квиза этого уровня хоть раз отвечены верно — автоматически
  // помечает таб (math/grammar) пройденным и, если это разблокирует уровень,
  // продвигает currentSequenceLevel дальше.
  async submitSingleAnswer(userId: string, sequenceLevel: number, tab: Tab, questionId: string, userAnswer: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Вопрос не найден');

    const correct = userAnswer.trim().toUpperCase() === question.correctChoice.trim().toUpperCase();

    await this.prisma.answerLog.create({
      data: {
        attemptId: await this.getOrCreateStudyAttemptId(userId),
        userId,
        questionId,
        userAnswer,
        correctness: correct ? 'CORRECT' : 'INCORRECT',
        timeSpentSec: 0,
      },
    });

    let tabCompleted = false;
    let leveledUp = false;

    if (correct) {
      const allQuizQuestions = await this.prisma.question.findMany({
        where: { domain: question.domain, domainLevel: question.domainLevel },
        select: { id: true },
      });

      const correctAnswers = await this.prisma.answerLog.findMany({
        where: {
          userId,
          correctness: 'CORRECT',
          questionId: { in: allQuizQuestions.map((q) => q.id) },
        },
        select: { questionId: true },
        distinct: ['questionId'],
      });

      if (correctAnswers.length === allQuizQuestions.length) {
        tabCompleted = true;
        const result = await this.markTabDone(userId, sequenceLevel, tab);
        leveledUp = result.leveledUp;
      }
    }

    return {
      correct,
      correctChoice: correct ? null : question.correctChoice,
      explanation: correct ? null : question.explanation,
      tabCompleted,
      leveledUp,
    };
  }

  // Общая логика "закрыть таб на уровне и, если оба таба закрыты (или grammar
  // таба нет вовсе), продвинуть путь дальше" — переиспользуется и submitQuiz, и submitSingleAnswer.
  private async markTabDone(userId: string, sequenceLevel: number, tab: Tab) {
    const progress = await this.getProgress(userId);
    const isCurrentLevel = sequenceLevel === progress.currentSequenceLevel;
    if (!isCurrentLevel) return { leveledUp: false };

    const hasGrammarTab = !!resolveRwLevel(sequenceLevel);
    const mathDone = tab === 'math' ? true : progress.mathTabDone;
    const grammarDone = tab === 'grammar' ? true : progress.grammarTabDone;
    const levelComplete = mathDone && (grammarDone || !hasGrammarTab);

    if (levelComplete) {
      const nextLevel = Math.min(sequenceLevel + 1, TOTAL_MATH_LEVELS);
      await this.prisma.studyPathProgress.upsert({
        where: { userId },
        update: { currentSequenceLevel: nextLevel, mathTabDone: false, grammarTabDone: false },
        create: { userId, currentSequenceLevel: nextLevel, mathTabDone: false, grammarTabDone: false },
      });
      return { leveledUp: true };
    }

    const updateData = tab === 'math' ? { mathTabDone: true } : { grammarTabDone: true };
    await this.prisma.studyPathProgress.upsert({
      where: { userId },
      update: updateData,
      create: { userId, currentSequenceLevel: 1, ...updateData },
    });
    return { leveledUp: false };
  }

  // "Виртуальный" TestAttempt, чтобы AnswerLog (который требует attemptId)
  // мог логировать ответы из режима "Изучение" без полноформатного теста.
  private async getOrCreateStudyAttemptId(userId: string): Promise<string> {
    const virtualTest = await this.prisma.test.upsert({
      where: { id: 'virtual-study-practice' },
      update: {},
      create: { id: 'virtual-study-practice', title: 'Study Practice (virtual)', isPublished: false },
    });
    const existing = await this.prisma.testAttempt.findFirst({
      where: { userId, testId: virtualTest.id, status: 'IN_PROGRESS' },
    });
    if (existing) return existing.id;
    const created = await this.prisma.testAttempt.create({
      data: { userId, testId: virtualTest.id, status: 'IN_PROGRESS' },
    });
    return created.id;
  }
}