import { Module } from '@nestjs/common';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAnalyticsRepository } from './repositories/admin-analytics.repository';

@Module({
  controllers: [AdminAnalyticsController],
  providers: [AdminAnalyticsService, AdminAnalyticsRepository],
})
export class AdminModule {}
