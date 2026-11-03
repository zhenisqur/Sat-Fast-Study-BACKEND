import { BadRequestException, Injectable } from '@nestjs/common';
import { Question } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { getOrCreateVirtualAttemptId } from '@common/utils/virtual-attempt';
import { answerFeedback, assertAnswerShape, checkAnswer, serializeUserAnswer, toPublicQuestion } from '@common/utils/question';
import { MistakesService } from '../mistakes/mistakes.service';
import { ProgressService } from '../progress/progress.service';
import { ReviewPoolService } from '../progress/review-pool.service';
import { XP } from '../progress/xp.rules';
import { ReviewAnswerDto } from './dto/review-answer.dto';

export const REVIEW_SESSION_SIZE = 10;
/** Тема считается "давно не повторённой", если по ней не было ответов столько дней. */
export const STALE_TOPIC_DAYS = 3;

type Reason = 'MISTAKE' | 'STALE_TOPIC' | 'RANDOM';

const topicKey = (q: Pick<Question, 'domain' | 'domainLevel'>) => `${q.domain}#${q.domainLevel}`;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pool: ReviewPoolService,
    private readonly mistakes: MistakesService,
    private readonly progress: ProgressService,
  ) {}

  /**
   * 10 задач ТОЛЬКО по пройденным темам:
   * 1) список ошибок (самые старые первыми),
   * 2) по одной задаче из тем, которые давно не повторялись (никогда / > STALE_TOPIC_DAYS),
   * 3) добивка случайными задачами из пройденного.
   */
  async buildSession(userId: string) {
    const passed = await this.pool.getPassedQuestions(userId);
    if (passed.length === 0) {
      return { sessionNumberToday: 0, fullXp: true, size: 0, nothingToReview: true, questions: [] };
    }
    const byId = new Map(passed.map((q) => [q.id, q]));
    const picked: { question: Question; reason: Reason }[] = [];
    const taken = new Set<string>();
    const take = (q: Question, reason: Reason) => {
      if (picked.length >= REVIEW_SESSION_SIZE || taken.has(q.id)) return;
      taken.add(q.id);
      picked.push({ question: q, reason });
    };

    // 1) ошибки
    const mistakes = await this.prisma.mistakeReviewItem.findMany({
      where: { userId, resolved: false, questionId: { in: [...byId.keys()] } },
      orderBy: { lastWrongAt: 'asc' },
      take: REVIEW_SESSION_SIZE,
      select: { questionId: true },
    });
    for (const m of mistakes) take(byId.get(m.questionId)!, 'MISTAKE');

    // 2) давно не повторённые темы
    const lastSeenRows = await this.prisma.answerLog.groupBy({
      by: ['questionId'],
      where: { userId, questionId: { in: [...byId.keys()] } },
      _max: { createdAt: true },
    });
    const lastSeen = new Map(lastSeenRows.map((r) => [r.questionId, r._max.createdAt?.getTime() ?? 0]));
    const topics = new Map<string, { last: number; questions: Question[] }>();
    for (const q of passed) {
      const t = topics.get(topicKey(q)) ?? { last: 0, questions: [] };
      t.last = Math.max(t.last, lastSeen.get(q.id) ?? 0);
      t.questions.push(q);
      topics.set(topicKey(q), t);
    }
    const staleBefore = Date.now() - STALE_TOPIC_DAYS * 86_400_000;
    const staleTopics = [...topics.values()].filter((t) => t.last < staleBefore).sort((a, b) => a.last - b.last);
    for (const t of staleTopics) {
      const candidate = t.questions.filter((q) => !taken.has(q.id)).sort((a, b) => (lastSeen.get(a.id) ?? 0) - (lastSeen.get(b.id) ?? 0))[0];
      if (candidate) take(candidate, 'STALE_TOPIC');
    }

    // 3) добивка случайными
    for (const q of shuffle(passed)) take(q, 'RANDOM');

    const sessionNumberToday = await this.progress.startReviewSession(userId);
    return {
      sessionNumberToday,
      // после REVIEW_FULL_XP_SESSIONS сессий за день XP за ответ урезается (защита от фарма)
      fullXp: sessionNumberToday <= XP.REVIEW_FULL_XP_SESSIONS,
      size: picked.length,
      nothingToReview: false,
      questions: picked.map(({ question, reason }) => ({ ...toPublicQuestion(question), reason })),
    };
  }

  async answer(userId: string, dto: ReviewAnswerDto) {
    const passed = await this.pool.getPassedQuestions(userId);
    const question = passed.find((q) => q.id === dto.questionId);
    if (!question) throw new BadRequestException('Эта задача не из пройденных тем');

    assertAnswerShape(question, dto);
    const correct = checkAnswer(question, dto);
    await this.prisma.answerLog.create({
      data: {
        attemptId: await getOrCreateVirtualAttemptId(this.prisma, userId, 'virtual-review', 'Review (virtual)'),
        userId,
        questionId: question.id,
        userAnswer: serializeUserAnswer(dto),
        correctness: correct ? 'CORRECT' : 'INCORRECT',
        timeSpentSec: dto.timeSpentSec ?? 0,
      },
    });

    const { resolved } = await this.mistakes.recordAnswer(userId, question.id, correct);
    const { xpGained, events } = await this.progress.recordReviewAnswer(userId, correct);

    return {
      correct,
      ...answerFeedback(question, correct),
      xpGained: xpGained + events.bonusXp,
      mistakeResolved: resolved,
      daily: events,
    };
  }
}
