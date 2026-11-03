import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ReviewService } from './review.service';
import { ReviewAnswerDto } from './dto/review-answer.dto';

// Тренировка = повторение пройденного. Итог сессии ("8 из 10") считает фронт по ответам.
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get('session')
  async getSession(@CurrentUser() user: { userId: string }) {
    return this.reviewService.buildSession(user.userId);
  }

  @Post('answer')
  async answer(@CurrentUser() user: { userId: string }, @Body() dto: ReviewAnswerDto) {
    return this.reviewService.answer(user.userId, dto);
  }
}
