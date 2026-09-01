import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { MistakeReviewService } from '../services/mistake-review.service';

@UseGuards(JwtAuthGuard)
@Controller('mistakes')
export class MistakeReviewController {
  constructor(private readonly mistakeReviewService: MistakeReviewService) {}

  @Get('queue')
  async getQueue(@CurrentUser() user: { userId: string }) {
    return this.mistakeReviewService.getQueue(user.userId);
  }
}
