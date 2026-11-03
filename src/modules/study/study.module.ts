import { Module } from '@nestjs/common';
import { MistakesModule } from '../mistakes/mistakes.module';
import { ProgressModule } from '../progress/progress.module';
import { StudyController } from './controllers/study.controller';
import { StudyService } from './services/study.service';

@Module({
  imports: [MistakesModule, ProgressModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
