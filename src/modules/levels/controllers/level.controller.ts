import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { SatSection } from '@prisma/client';
import { LevelService } from '../services/level.service';

@UseGuards(JwtAuthGuard)
@Controller('levels')
export class LevelController {
  constructor(private readonly levelService: LevelService) {}

  @Get('progress')
  async getProgress(@CurrentUser() user: { userId: string }) {
    return this.levelService.getOverallProgress(user.userId);
  }

  @Get('questions')
  async getTodayQuestions(@CurrentUser() user: { userId: string }, @Query('section') section: SatSection) {
    return this.levelService.getTodayQuestionsForSection(user.userId, section);
  }
}
