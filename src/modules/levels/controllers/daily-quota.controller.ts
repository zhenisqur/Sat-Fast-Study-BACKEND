import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { SatSection } from '@prisma/client';
import { DailyQuotaService } from '../services/daily-quota.service';
import { SubmitLevelAnswerDto } from '../dto/submit-level-answer.dto';

@UseGuards(JwtAuthGuard)
@Controller('levels/daily-quota')
export class DailyQuotaController {
  constructor(private readonly dailyQuotaService: DailyQuotaService) {}

  @Post(':section/answer')
  async submitAnswer(
    @CurrentUser() user: { userId: string },
    @Param('section') section: SatSection,
    @Body() dto: SubmitLevelAnswerDto,
  ) {
    return this.dailyQuotaService.submitAnswer(user.userId, section, dto);
  }
}
