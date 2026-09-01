import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class AdminAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [totalUsers, totalQuestions, flaggedAiLogs] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.question.count(),
      this.prisma.aiInteractionLog.count({ where: { flaggedForReview: true } }),
    ]);
    return { totalUsers, totalQuestions, flaggedAiLogs };
  }
}
