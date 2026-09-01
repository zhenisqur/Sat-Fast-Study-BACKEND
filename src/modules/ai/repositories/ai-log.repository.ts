import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class AiLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async logInteraction(params: {
    userId: string; questionId?: string; prompt: string; rawResponse: string;
    finalResponse: string; modelName: string; flaggedForReview: boolean; latencyMs: number;
  }) {
    return this.prisma.aiInteractionLog.create({ data: params });
  }
}
