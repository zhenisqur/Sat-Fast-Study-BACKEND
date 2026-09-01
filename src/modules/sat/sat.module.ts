import { Module } from '@nestjs/common';
import { QuestionController } from './controllers/question.controller';
import { AttemptController } from './controllers/attempt.controller';
import { QuestionService } from './services/question.service';
import { AttemptService } from './services/attempt.service';
import { QuestionRepository } from './repositories/question.repository';
import { AttemptRepository } from './repositories/attempt.repository';

@Module({
  controllers: [QuestionController, AttemptController],
  providers: [QuestionService, AttemptService, QuestionRepository, AttemptRepository],
  exports: [QuestionService, QuestionRepository],
})
export class SatModule {}
