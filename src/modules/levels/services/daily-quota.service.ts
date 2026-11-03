import { Injectable, NotFoundException } from '@nestjs/common';
import { SatSection, AnswerCorrectness } from '@prisma/client';
import { DailyQuotaRepository } from '../repositories/daily-quota.repository';
import { UserLevelProgressRepository } from '../repositories/user-level-progress.repository';
import { SubmitLevelAnswerDto } from '../dto/submit-level-answer.dto';
import { PrismaService } from '@common/database/prisma.service';
import { MistakesService } from '../../mistakes/mistakes.service';
import { checkAnswer } from '@common/utils/question';

@Injectable()
export class DailyQuotaService {
  constructor(
    private readonly dailyQuotaRepository: DailyQuotaRepository,
    private readonly userLevelProgressRepository: UserLevelProgressRepository,
    private readonly prisma: PrismaService,
    private readonly mistakesService: MistakesService,
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

    const correctness: AnswerCorrectness = checkAnswer(question, dto) ? 'CORRECT' : 'INCORRECT';

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

    await this.mistakesService.recordAnswer(userId, dto.questionId, correctness === 'CORRECT');

    await this.dailyQuotaRepository.getOrCreateToday(userId);
    const field = section === 'MATH' ? 'mathAnswered' : 'rwAnswered';
    const quota = await this.dailyQuotaRepository.incrementAnswered(userId, field);

    // Level up only once EVERY active question of the current level has been
    // answered correctly at least once (was: +1 level on every correct answer).
    let leveledUp = false;
    if (correctness === 'CORRECT') {
      const progress = await this.userLevelProgressRepository.findByUserAndSection(userId, section);
      const currentLevel = progress?.currentLevel ?? 1;
      if (question.section === section && question.level === currentLevel) {
        const levelQuestions = await this.prisma.question.findMany({
          where: { section, level: currentLevel, isActive: true },
          select: { id: true },
        });
        const solved = await this.prisma.answerLog.findMany({
          where: { userId, correctness: 'CORRECT', questionId: { in: levelQuestions.map((q) => q.id) } },
          select: { questionId: true },
          distinct: ['questionId'],
        });
        if (levelQuestions.length > 0 && solved.length === levelQuestions.length) {
          await this.userLevelProgressRepository.incrementLevel(userId, section);
          leveledUp = true;
        }
      }
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
