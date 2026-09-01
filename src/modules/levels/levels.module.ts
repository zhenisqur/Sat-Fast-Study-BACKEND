import { Module } from '@nestjs/common';
import { SatModule } from '../sat/sat.module';
import { LevelController } from './controllers/level.controller';
import { DailyQuotaController } from './controllers/daily-quota.controller';
import { LevelService } from './services/level.service';
import { DailyQuotaService } from './services/daily-quota.service';
import { LevelDefinitionRepository } from './repositories/level-definition.repository';
import { UserLevelProgressRepository } from './repositories/user-level-progress.repository';
import { DailyQuotaRepository } from './repositories/daily-quota.repository';

@Module({
  imports: [SatModule],
  controllers: [LevelController, DailyQuotaController],
  providers: [LevelService, DailyQuotaService, LevelDefinitionRepository, UserLevelProgressRepository, DailyQuotaRepository],
})
export class LevelsModule {}
