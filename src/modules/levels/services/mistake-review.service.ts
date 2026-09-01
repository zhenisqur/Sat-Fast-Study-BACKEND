import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class MistakeReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getQueue(userId: string) {
    const items = await this.prisma.mistakeReviewItem.findMany({
      where: { userId, resolved: false },
      include: { question: true },
      orderBy: { lastWrongAt: 'desc' },
    });
    return items.map((item) => ({
      questionId: item.questionId,
      timesWrong: item.timesWrong,
      question: item.question,
    }));
  }
}
