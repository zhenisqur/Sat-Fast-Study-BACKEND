import { Module } from '@nestjs/common';
import { MistakesModule } from '../mistakes/mistakes.module';
import { StudyController } from './controllers/study.controller';
import { StudyService } from './services/study.service';

@Module({
  imports: [MistakesModule],
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
