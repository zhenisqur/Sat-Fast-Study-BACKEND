import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TutorService } from '../services/tutor.service';
import { AskTutorDto } from '../dto/ask-tutor.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai/tutor')
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('ask')
  async ask(@CurrentUser() user: { userId: string }, @Body() dto: AskTutorDto) {
    return this.tutorService.ask(user.userId, dto);
  }
}
