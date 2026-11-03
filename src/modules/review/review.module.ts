import { Module } from '@nestjs/common';
import { MistakesModule } from '../mistakes/mistakes.module';
import { ProgressModule } from '../progress/progress.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [MistakesModule, ProgressModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
