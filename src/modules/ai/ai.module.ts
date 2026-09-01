import { Module } from '@nestjs/common';
import { SatModule } from '../sat/sat.module';
import { TutorController } from './controllers/tutor.controller';
import { TutorService } from './services/tutor.service';
import { MathVerifierService } from './services/math-verifier.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { AiLogRepository } from './repositories/ai-log.repository';

@Module({
  imports: [SatModule],
  controllers: [TutorController],
  providers: [TutorService, MathVerifierService, AnthropicProvider, AiLogRepository],
})
export class AiModule {}
