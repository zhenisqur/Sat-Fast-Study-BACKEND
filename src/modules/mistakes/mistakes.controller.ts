import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { MistakesService } from './mistakes.service';

@UseGuards(JwtAuthGuard)
@Controller('mistakes')
export class MistakesController {
  constructor(private readonly mistakesService: MistakesService) {}

  @Get('queue')
  async getQueue(@CurrentUser() user: { userId: string }) {
    return this.mistakesService.getQueue(user.userId);
  }
}
