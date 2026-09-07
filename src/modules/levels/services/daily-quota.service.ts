import { Injectable, NotFoundException } from '@nestjs/common';
import { SatSection, AnswerCorrectness } from '@prisma/client';
import { DailyQuotaRepository } from '../repositories/daily-quota.repository';
import { UserLevelProgressRepository } from '../repositories/user-level-progress.repository';
import { SubmitLevelAnswerDto } from '../dto/submit-level-answer.dto';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class DailyQuotaService {
  constructor(
    private readonly dailyQuotaRepository: DailyQuotaRepository,
    private readonly userLevelProgressRepository: UserLevelProgressRepository,
    private readonly prisma: PrismaService,
  ) {}

  // Отдаёт текущую дневную норму без записи ответа — для Dashboard,
  // чтобы фронт мог показать "12/15 math" сразу при открытии, не дожидаясь
  // первого ответа пользователя.
  async getToday(userId: string) {
    return this.dailyQuotaRepository.getOrCreateToday(userId);
  }

  async submitAnswer(userId: string, section: SatSection, dto: SubmitLevelAnswerDto) {
    const question = await this.prisma.question.findUnique({ where: { id: dto.questionId } });
    if (!question) throw new NotFoundException('Вопрос не найден');

    const correctness: AnswerCorrectness =
      dto.userAnswer.trim().toUpperCase() === question.correctChoice.trim().toUpperCase() ? 'CORRECT' : 'INCORRECT';

    await this.prisma.answerLog.create({
      data: {
        attemptId: await this.getOrCreateVirtualAttemptId(userId),
        userId,
        questionId: dto.questionId,
        userAnswer: dto.userAnswer,
        correctness,
        timeSpentSec: dto.timeSpentSec,
      },
    });

    if (correctness === 'INCORRECT') {
      await this.prisma.mistakeReviewItem.upsert({
        where: { userId_questionId: { userId, questionId: dto.questionId } },
        update: { timesWrong: { increment: 1 }, resolved: false, lastWrongAt: new Date() },
        create: { userId, questionId: dto.questionId },
      });
    } else {
      await this.prisma.mistakeReviewItem.updateMany({
        where: { userId, questionId: dto.questionId, resolved: false },
        data: { resolved: true, resolvedAt: new Date() },
      });
    }

    await this.dailyQuotaRepository.getOrCreateToday(userId);
    const field = section === 'MATH' ? 'mathAnswered' : 'rwAnswered';
    const quota = await this.dailyQuotaRepository.incrementAnswered(userId, field);

    let leveledUp = false;
    if (correctness === 'CORRECT') {
      await this.userLevelProgressRepository.incrementLevel(userId, section);
      leveledUp = true;
    }

    const dailyNormReached = quota.mathAnswered >= quota.mathTarget && quota.rwAnswered >= quota.rwTarget;
    if (dailyNormReached && !quota.completed) {
      await this.dailyQuotaRepository.markCompleted(userId);
    }

    return {
      correctness,
      quota,
      leveledUp,
      correctChoice: correctness === 'INCORRECT' ? question.correctChoice : null,
      explanation: correctness === 'INCORRECT' ? question.explanation : null,
    };
  }

  private async getOrCreateVirtualAttemptId(userId: string): Promise<string> {
    const virtualTest = await this.prisma.test.upsert({
      where: { id: 'virtual-daily-practice' },
      update: {},
      create: { id: 'virtual-daily-practice', title: 'Daily Practice (virtual)', isPublished: false },
    });
    const existing = await this.prisma.testAttempt.findFirst({
      where: { userId, testId: virtualTest.id, status: 'IN_PROGRESS' },
    });
    if (existing) return existing.id;
    const created = await this.prisma.testAttempt.create({
      data: { userId, testId: virtualTest.id, status: 'IN_PROGRESS' },
    });
    return created.id;
  }
}