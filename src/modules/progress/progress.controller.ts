import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ProgressService } from './progress.service';

@UseGuards(JwtAuthGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Главная: серия, XP, цель дня. Телефон шлёт свой часовой пояс в X-Timezone (IANA).
  @Get('today')
  async getToday(@CurrentUser() user: { userId: string }, @Headers('x-timezone') timezone?: string) {
    await this.progressService.syncTimezone(user.userId, timezone);
    return this.progressService.getToday(user.userId);
  }
}
