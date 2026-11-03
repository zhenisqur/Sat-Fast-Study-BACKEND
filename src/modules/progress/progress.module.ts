import { Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { ReviewPoolService } from './review-pool.service';

@Module({
  controllers: [ProgressController],
  providers: [ProgressService, ReviewPoolService],
  exports: [ProgressService, ReviewPoolService],
})
export class ProgressModule {}
