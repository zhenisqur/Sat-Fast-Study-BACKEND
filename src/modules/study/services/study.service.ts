import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Question } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { getOrCreateVirtualAttemptId } from '@common/utils/virtual-attempt';
import { UserAnswerInput, answerFeedback, assertAnswerShape, checkAnswer, serializeUserAnswer, toPublicQuestion } from '@common/utils/question';
import { MistakesService } from '../../mistakes/mistakes.service';
import { DailyEvents, ProgressService } from '../../progress/progress.service';
import { XP } from '../../progress/xp.rules';
import {
  FREE_LEVELS,
  MODULE_SIZE,
  ResolvedLevel,
  TOTAL_MODULES,
  TOTAL_PATH_LEVELS,
  moduleOf,
  resolveMathLevel,
  resolveRwLevel,
  splitTopicQuestions,
} from '../domains.catalog';

type Tab = 'math' | 'grammar';

/** Закрепление грамматики добивается ошибками пользователя по теме до этого размера. */
const MIN_REINFORCEMENT_QUIZ = 5;

/**
 * Требовать нажатия "РАЗБЛОКИРОВАТЬ" для входа в следующий модуль.
 * Выключено по умолчанию: в текущем фронте ещё нет этой кнопки — включить, когда фронт перейдёт.
 */
const requireModuleUnlock = () => process.env.STUDY_REQUIRE_MODULE_UNLOCK === 'true';

export interface PathNode {
  sequenceLevel: number;
  module: number;
  mathTopic: string;
  grammarTopic: string | null;
  hasGrammarTab: boolean;
  grammarReinforcement: boolean;
  requiresSubscription: boolean;
  moduleLocked: boolean;
  status: string;
}

@Injectable()
export class StudyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mistakesService: MistakesService,
    private readonly progressService: ProgressService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async getProgress(userId: string) {
    const progress = await this.prisma.studyPathProgress.findUnique({ where: { userId } });
    return progress ?? { currentSequenceLevel: 1, mathTabDone: false, grammarTabDone: false, unlockedModules: 1 };
  }

  private async hasSubscription(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { hasSubscription: true } });
    return user?.hasSubscription ?? false;
  }

  /** Модули, у которых пройдены все уровни (= открытые герои в профиле). */
  private completedModules(currentSequenceLevel: number) {
    return Math.min(Math.floor((currentSequenceLevel - 1) / MODULE_SIZE), TOTAL_MODULES);
  }

  private resolveTab(sequenceLevel: number, tab: Tab): ResolvedLevel {
    const resolved = tab === 'math' ? resolveMathLevel(sequenceLevel) : tab === 'grammar' ? resolveRwLevel(sequenceLevel) : null;
    if (!resolved) {
      throw new NotFoundException(tab === 'grammar' || tab === 'math' ? 'Уровень вне диапазона' : 'Неизвестный таб');
    }
    return resolved;
  }

  /** Порядок проверок: уровень открыт по пути -> подписка -> модуль разблокирован. */
  private async assertLevelAccess(userId: string, sequenceLevel: number) {
    const progress = await this.getProgress(userId);
    if (sequenceLevel > progress.currentSequenceLevel) {
      throw new ForbiddenException({ statusCode: 403, code: 'LEVEL_LOCKED', message: 'Этот уровень ещё заблокирован — пройди предыдущие' });
    }
    if (sequenceLevel > FREE_LEVELS && !(await this.hasSubscription(userId))) {
      throw new ForbiddenException({ statusCode: 403, code: 'SUBSCRIPTION_REQUIRED', message: 'Этот уровень доступен по подписке' });
    }
    if (requireModuleUnlock() && moduleOf(sequenceLevel) > progress.unlockedModules) {
      throw new ForbiddenException({ statusCode: 403, code: 'MODULE_LOCKED', message: 'Разблокируй следующий модуль в профиле' });
    }
    return progress;
  }

  /**
   * base — вопросы, которые нужно решить для прохождения (mastery-gate).
   * extras — ошибки пользователя по теме, добавленные на закреплении (на гейт не влияют).
   */
  private async getQuizQuestions(userId: string, resolved: ResolvedLevel, tab: Tab): Promise<{ base: Question[]; extras: Question[] }> {
    const topicQuestions = await this.prisma.question.findMany({
      where: { domain: resolved.domain.key, domainLevel: resolved.domainLevel, isActive: true },
    });
    const base = splitTopicQuestions(topicQuestions, resolved.part, tab === 'grammar');

    let extras: Question[] = [];
    if (tab === 'grammar' && resolved.part === 2 && base.length < MIN_REINFORCEMENT_QUIZ) {
      const baseIds = new Set(base.map((q) => q.id));
      const candidates = topicQuestions.filter((q) => !baseIds.has(q.id));
      if (candidates.length > 0) {
        const mistakes = await this.prisma.mistakeReviewItem.findMany({
          where: { userId, resolved: false, questionId: { in: candidates.map((q) => q.id) } },
          orderBy: { lastWrongAt: 'asc' },
          take: MIN_REINFORCEMENT_QUIZ - base.length,
          select: { questionId: true },
        });
        const wanted = new Set(mistakes.map((m) => m.questionId));
        extras = candidates.filter((q) => wanted.has(q.id));
      }
    }
    return { base, extras };
  }

  private topicTitle(resolved: ResolvedLevel) {
    const topic = resolved.domain.topics[resolved.domainLevel - 1];
    return resolved.part === 2 ? `${topic} — закрепление` : topic;
  }

  // ---------------------------------------------------------------- path

  // Единый путь 1-30, на каждом уровне math + grammar (грамматика: тема на 2 уровня подряд).
  async getPath(userId: string) {
    const [progress, subscribed] = await Promise.all([this.getProgress(userId), this.hasSubscription(userId)]);
    const enforceUnlock = requireModuleUnlock();

    const nodes: PathNode[] = [];
    for (let seq = 1; seq <= TOTAL_PATH_LEVELS; seq++) {
      const math = resolveMathLevel(seq);
      const rw = resolveRwLevel(seq);
      if (!math) continue;

      nodes.push({
        sequenceLevel: seq,
        module: moduleOf(seq),
        mathTopic: this.topicTitle(math),
        grammarTopic: rw ? this.topicTitle(rw) : null,
        hasGrammarTab: !!rw,
        grammarReinforcement: rw?.part === 2,
        requiresSubscription: seq > FREE_LEVELS && !subscribed,
        moduleLocked: enforceUnlock && moduleOf(seq) > progress.unlockedModules,
        status: seq < progress.currentSequenceLevel ? 'completed' : seq === progress.currentSequenceLevel ? 'current' : 'locked',
      });
    }

    const completedModules = this.completedModules(progress.currentSequenceLevel);
    return {
      currentSequenceLevel: progress.currentSequenceLevel,
      totalLevels: TOTAL_PATH_LEVELS,
      pathCompleted: progress.currentSequenceLevel > TOTAL_PATH_LEVELS,
      mathTabDone: progress.mathTabDone,
      grammarTabDone: progress.grammarTabDone,
      // модули / герои
      moduleSize: MODULE_SIZE,
      totalModules: TOTAL_MODULES,
      completedModules,
      unlockedModules: progress.unlockedModules,
      canUnlockNextModule: progress.unlockedModules < TOTAL_MODULES && completedModules >= progress.unlockedModules,
      // доступ
      freeLevels: FREE_LEVELS,
      hasSubscription: subscribed,
      nodes,
    };
  }

  // "РАЗБЛОКИРОВАТЬ" в профиле: открывает следующий модуль, если текущий пройден.
  async unlockNextModule(userId: string) {
    const progress = await this.getProgress(userId);
    const completed = this.completedModules(progress.currentSequenceLevel);
    if (progress.unlockedModules >= TOTAL_MODULES || completed < progress.unlockedModules) {
      throw new BadRequestException({ statusCode: 400, code: 'MODULE_NOT_COMPLETED', message: 'Сначала пройди все уровни текущего модуля' });
    }
    // updateMany с условием — защита от двойного нажатия.
    await this.prisma.studyPathProgress.updateMany({
      where: { userId, unlockedModules: progress.unlockedModules },
      data: { unlockedModules: progress.unlockedModules + 1 },
    });
    return this.getPath(userId);
  }

  // ---------------------------------------------------------------- lesson

  async getLevelContent(userId: string, sequenceLevel: number, tab: Tab) {
    const resolved = this.resolveTab(sequenceLevel, tab);
    await this.assertLevelAccess(userId, sequenceLevel);

    const scenarios = await this.prisma.lessonScenario.findMany({
      where: { domain: resolved.domain.key, domainLevel: resolved.domainLevel },
      orderBy: { order: 'asc' },
    });
    const { base, extras } = await this.getQuizQuestions(userId, resolved, tab);
    const reinforcement = resolved.part === 2;
    const extraIds = new Set(extras.map((q) => q.id));

    return {
      sequenceLevel,
      tab,
      domain: resolved.domain.key,
      topic: this.topicTitle(resolved),
      reinforcement,
      // На закреплении объяснение кратко: только первый сценарий (пустой массив сломал бы текущий экран урока).
      scenarios: reinforcement ? scenarios.slice(0, 1) : scenarios,
      quiz: [...base, ...extras].map((q) => ({ ...toPublicQuestion(q), fromMistakes: extraIds.has(q.id) })),
    };
  }

  // Батч-сдача квиза целиком (оставлена для обратной совместимости) — нужно ответить
  // верно на ВСЕ базовые вопросы разом за один запрос.
  async submitQuiz(userId: string, sequenceLevel: number, tab: Tab, answers: ({ questionId: string } & UserAnswerInput)[]) {
    const resolved = this.resolveTab(sequenceLevel, tab);
    await this.assertLevelAccess(userId, sequenceLevel);
    const { base } = await this.getQuizQuestions(userId, resolved, tab);

    if (answers.length !== base.length) {
      throw new BadRequestException(`Нужно ответить на все ${base.length} вопросов квиза`);
    }

    const results = answers.map((a) => {
      const question = base.find((q) => q.id === a.questionId);
      if (!question) throw new NotFoundException(`Вопрос ${a.questionId} не найден в этом квизе`);
      assertAnswerShape(question, a);
      const correct = checkAnswer(question, a);
      return { questionId: a.questionId, correct, ...answerFeedback(question, correct) };
    });

    const allCorrect = results.every((r) => r.correct);
    let leveledUp = false;
    if (allCorrect) {
      const result = await this.markTabDone(userId, sequenceLevel, tab);
      leveledUp = result.leveledUp;
    }
    return { allCorrect, leveledUp, results };
  }

  // Один вопрос квиза за раз — с мгновенным фидбеком. ОСНОВНОЙ метод.
  // Таб пройден, когда ВСЕ базовые вопросы уровня хоть раз отвечены верно.
  async submitSingleAnswer(userId: string, sequenceLevel: number, tab: Tab, questionId: string, input: UserAnswerInput) {
    const resolved = this.resolveTab(sequenceLevel, tab);
    await this.assertLevelAccess(userId, sequenceLevel);

    const { base, extras } = await this.getQuizQuestions(userId, resolved, tab);
    const question = [...base, ...extras].find((q) => q.id === questionId);
    // Вопрос должен быть из квиза ЭТОГО уровня/таба — иначе ответы с другого уровня засчитали бы текущий.
    if (!question) throw new BadRequestException('Вопрос не относится к этому уровню');

    assertAnswerShape(question, input);
    const correct = checkAnswer(question, input);
    const firstTry = (await this.prisma.answerLog.count({ where: { userId, questionId } })) === 0;

    await this.prisma.answerLog.create({
      data: {
        attemptId: await getOrCreateVirtualAttemptId(this.prisma, userId, 'virtual-study-practice', 'Study Practice (virtual)'),
        userId,
        questionId,
        userAnswer: serializeUserAnswer(input),
        correctness: correct ? 'CORRECT' : 'INCORRECT',
        timeSpentSec: 0,
      },
    });
    await this.mistakesService.recordAnswer(userId, questionId, correct);

    let xp = correct && firstTry ? XP.LESSON_ANSWER_FIRST_TRY : 0;
    let tabCompleted = false;
    let leveledUp = false;
    let daily: DailyEvents = { streakExtended: false, goalCompleted: false, bonusXp: 0 };

    if (correct) {
      const solved = await this.prisma.answerLog.findMany({
        where: { userId, correctness: 'CORRECT', questionId: { in: base.map((q) => q.id) } },
        select: { questionId: true },
        distinct: ['questionId'],
      });

      if (base.length > 0 && solved.length === base.length) {
        tabCompleted = true;
        const result = await this.markTabDone(userId, sequenceLevel, tab);
        leveledUp = result.leveledUp;
        if (result.tabNewlyDone) xp += XP.LESSON_COMPLETED;
        if (result.leveledUp) xp += XP.LEVEL_COMPLETED;
        // урок = один впервые пройденный таб -> засчитывается в цель дня / серию
        if (result.tabNewlyDone) daily = await this.progressService.recordLessonCompleted(userId);
      }
    }

    const xpGained = (await this.progressService.addXp(userId, xp)) + daily.bonusXp;

    return {
      correct,
      ...answerFeedback(question, correct),
      tabCompleted,
      leveledUp,
      xpGained,
      // 5-й уровень модуля пройден -> в профиле открывается герой
      moduleCompleted: leveledUp && sequenceLevel % MODULE_SIZE === 0,
      pathCompleted: leveledUp && sequenceLevel === TOTAL_PATH_LEVELS,
      daily,
    };
  }

  // Закрыть таб на ТЕКУЩЕМ уровне; если оба таба закрыты — продвинуть путь.
  // currentSequenceLevel может стать TOTAL+1 — это значит "путь пройден".
  private async markTabDone(userId: string, sequenceLevel: number, tab: Tab): Promise<{ tabNewlyDone: boolean; leveledUp: boolean }> {
    const progress = await this.getProgress(userId);
    if (sequenceLevel !== progress.currentSequenceLevel) return { tabNewlyDone: false, leveledUp: false };

    const alreadyDone = tab === 'math' ? progress.mathTabDone : progress.grammarTabDone;
    if (alreadyDone) return { tabNewlyDone: false, leveledUp: false };

    const hasGrammarTab = !!resolveRwLevel(sequenceLevel);
    const mathDone = tab === 'math' ? true : progress.mathTabDone;
    const grammarDone = tab === 'grammar' ? true : progress.grammarTabDone;
    const levelComplete = mathDone && (grammarDone || !hasGrammarTab);

    await this.prisma.studyPathProgress.upsert({
      where: { userId },
      update: {},
      create: { userId, currentSequenceLevel: 1 },
    });

    // Условие по currentSequenceLevel и флагу таба — защита от гонки двух одновременных ответов.
    const guard = { userId, currentSequenceLevel: sequenceLevel, ...(tab === 'math' ? { mathTabDone: false } : { grammarTabDone: false }) };
    const data = levelComplete
      ? { currentSequenceLevel: sequenceLevel + 1, mathTabDone: false, grammarTabDone: false }
      : tab === 'math'
        ? { mathTabDone: true }
        : { grammarTabDone: true };
    const { count } = await this.prisma.studyPathProgress.updateMany({ where: guard, data });

    return { tabNewlyDone: count > 0, leveledUp: count > 0 && levelComplete };
  }
}
