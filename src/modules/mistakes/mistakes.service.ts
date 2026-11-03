import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

/** A question leaves the mistake list after this many correct answers in a row. */
export const MISTAKE_RESOLVE_STREAK = 2;

@Injectable()
export class MistakesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Single entry point for every answer (Study, Practice, Review).
   * Call AFTER the AnswerLog row for this answer has been written.
   */
  async recordAnswer(userId: string, questionId: string, correct: boolean) {
    if (!correct) {
      await this.prisma.mistakeReviewItem.upsert({
        where: { userId_questionId: { userId, questionId } },
        update: { timesWrong: { increment: 1 }, resolved: false, resolvedAt: null, lastWrongAt: new Date() },
        create: { userId, questionId },
      });
      return;
    }

    const item = await this.prisma.mistakeReviewItem.findUnique({ where: { userId_questionId: { userId, questionId } } });
    if (!item || item.resolved) return;

    const lastAnswers = await this.prisma.answerLog.findMany({
      where: { userId, questionId },
      orderBy: { createdAt: 'desc' },
      take: MISTAKE_RESOLVE_STREAK,
      select: { correctness: true },
    });
    const streakReached = lastAnswers.length === MISTAKE_RESOLVE_STREAK && lastAnswers.every((a) => a.correctness === 'CORRECT');
    if (streakReached) {
      await this.prisma.mistakeReviewItem.update({ where: { id: item.id }, data: { resolved: true, resolvedAt: new Date() } });
    }
  }

  async getQueue(userId: string) {
    const items = await this.prisma.mistakeReviewItem.findMany({
      where: { userId, resolved: false },
      include: { question: true },
      orderBy: { lastWrongAt: 'desc' },
    });
    return items.map(({ question: { correctChoice, ...question }, ...item }) => ({
      questionId: item.questionId,
      timesWrong: item.timesWrong,
      question,
    }));
  }
}
