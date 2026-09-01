import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SatModule } from './modules/sat/sat.module';
import { LevelsModule } from './modules/levels/levels.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/admin/admin.module';
import { StudyModule } from './modules/study/study.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, UsersModule, SatModule, LevelsModule, AiModule, AdminModule],
})
export class AppModule {}