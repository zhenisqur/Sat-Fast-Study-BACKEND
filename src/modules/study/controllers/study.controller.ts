import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { StudyService } from '../services/study.service';

@UseGuards(JwtAuthGuard)
@Controller('study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get('path')
  async getPath(@CurrentUser() user: { userId: string }) {
    return this.studyService.getPath(user.userId);
  }

  // tab: "math" | "grammar"
  @Get('level/:sequenceLevel/:tab')
  async getLevelContent(
    @CurrentUser() user: { userId: string },
    @Param('sequenceLevel', ParseIntPipe) sequenceLevel: number,
    @Param('tab') tab: 'math' | 'grammar',
  ) {
    return this.studyService.getLevelContent(user.userId, sequenceLevel, tab);
  }

  @Post('level/:sequenceLevel/:tab/answer')
  async submitSingleAnswer(
    @CurrentUser() user: { userId: string },
    @Param('sequenceLevel', ParseIntPipe) sequenceLevel: number,
    @Param('tab') tab: 'math' | 'grammar',
    @Body() body: { questionId: string; userAnswer: string },
  ) {
    return this.studyService.submitSingleAnswer(user.userId, sequenceLevel, tab, body.questionId, body.userAnswer);
  }

  @Post('level/:sequenceLevel/:tab/submit-quiz')
  async submitQuiz(
    @CurrentUser() user: { userId: string },
    @Param('sequenceLevel', ParseIntPipe) sequenceLevel: number,
    @Param('tab') tab: 'math' | 'grammar',
    @Body() body: { answers: { questionId: string; userAnswer: string }[] },
  ) {
    return this.studyService.submitQuiz(user.userId, sequenceLevel, tab, body.answers);
  }
}
