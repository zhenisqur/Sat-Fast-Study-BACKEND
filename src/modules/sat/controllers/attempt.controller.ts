import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AttemptService } from '../services/attempt.service';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';

@UseGuards(JwtAuthGuard)
@Controller('sat/attempts')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  @Post(':attemptId/answers')
  async submitAnswer(@Param('attemptId') attemptId: string, @CurrentUser() user: { userId: string }, @Body() dto: SubmitAnswerDto) {
    return this.attemptService.submitAnswer(attemptId, user.userId, dto);
  }
}
