import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Prisma кидает P2002, когда нарушена уникальность (здесь: userId + date). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002';
}

@Injectable()
export class DailyQuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateToday(userId: string) {
    const date = todayDateOnly();
    const where = { userId_date: { userId, date } };
    try {
      return await this.prisma.dailyQuota.upsert({
        where,
        update: {},
        create: { userId, date },
      });
    } catch (error) {
      // Два запроса пришли одновременно и оба пытались создать запись за сегодня.
      // Один из них победил, поэтому просто читаем уже созданную строку.
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.prisma.dailyQuota.findUnique({ where });
      if (!existing) throw error;
      return existing;
    }
  }

  async incrementAnswered(userId: string, field: 'mathAnswered' | 'rwAnswered') {
    const date = todayDateOnly();
    return this.prisma.dailyQuota.update({
      where: { userId_date: { userId, date } },
      data: { [field]: { increment: 1 } },
    });
  }

  async markCompleted(userId: string) {
    const date = todayDateOnly();
    return this.prisma.dailyQuota.update({
      where: { userId_date: { userId, date } },
      data: { completed: true, completedAt: new Date() },
    });
  }
}