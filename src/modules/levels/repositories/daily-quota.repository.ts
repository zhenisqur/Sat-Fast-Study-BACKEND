import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class DailyQuotaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateToday(userId: string) {
    const date = todayDateOnly();
    return this.prisma.dailyQuota.upsert({
      where: { userId_date: { userId, date } },
      update: {},
      create: { userId, date },
    });
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
