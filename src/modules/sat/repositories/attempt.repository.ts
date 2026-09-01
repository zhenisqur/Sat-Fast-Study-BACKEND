import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { AnswerCorrectness } from '@prisma/client';

@Injectable()
export class AttemptRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAnswerLog(params: {
    attemptId: string; userId: string; questionId: string;
    userAnswer: string; correctness: AnswerCorrectness; timeSpentSec: number;
  }) {
    return this.prisma.answerLog.create({ data: params });
  }
}
