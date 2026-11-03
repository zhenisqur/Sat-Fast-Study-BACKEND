import { Module } from '@nestjs/common';
import { MistakesController } from './mistakes.controller';
import { MistakesService } from './mistakes.service';

@Module({
  controllers: [MistakesController],
  providers: [MistakesService],
  exports: [MistakesService],
})
export class MistakesModule {}
