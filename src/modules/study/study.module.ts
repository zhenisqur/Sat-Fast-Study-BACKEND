import { Module } from '@nestjs/common';
import { StudyController } from './controllers/study.controller';
import { StudyService } from './services/study.service';

@Module({
  controllers: [StudyController],
  providers: [StudyService],
})
export class StudyModule {}
