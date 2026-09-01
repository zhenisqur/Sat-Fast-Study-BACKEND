import { Injectable } from '@nestjs/common';
import { AdminAnalyticsRepository } from '../repositories/admin-analytics.repository';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly repository: AdminAnalyticsRepository) {}
  async getOverview() { return this.repository.getOverview(); }
}
