import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { toPublicQuestion } from '@common/utils/question';

/** A question leaves the mistake list after this many correct answers in a row. */
export const MISTAKE_RESOLVE_STREAK = 2;

@Injectable()
export class MistakesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Single entry point for every answer (Study, Practice, Review). Returns whether the mistake got resolved. */
  async recordAnswer(userId: string, questionId: string, correct: boolean): Promise<{ resolved: boolean }> {
    const where = { userId_questionId: { userId, questionId } };
    if (!correct) {
      await this.prisma.mistakeReviewItem.upsert({
        where,
        update: { timesWrong: { increment: 1 }, correctStreak: 0, resolved: false, resolvedAt: null, lastWrongAt: new Date() },
        create: { userId, questionId },
      });
      return { resolved: false };
    }

    const item = await this.prisma.mistakeReviewItem.findUnique({ where });
    if (!item || item.resolved) return { resolved: false };

    const correctStreak = item.correctStreak + 1;
    const resolved = correctStreak >= MISTAKE_RESOLVE_STREAK;
    await this.prisma.mistakeReviewItem.update({
      where: { id: item.id },
      data: { correctStreak, resolved, resolvedAt: resolved ? new Date() : null },
    });
    return { resolved };
  }

  async getQueue(userId: string) {
    const items = await this.prisma.mistakeReviewItem.findMany({
      where: { userId, resolved: false },
      include: { question: true },
      orderBy: { lastWrongAt: 'desc' },
    });
    return items.map(({ question, ...item }) => ({
      questionId: item.questionId,
      timesWrong: item.timesWrong,
      correctStreak: item.correctStreak,
      question: toPublicQuestion(question),
    }));
  }
}
