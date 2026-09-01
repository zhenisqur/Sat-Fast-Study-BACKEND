import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { SatSection } from '@prisma/client';

@Injectable()
export class UserLevelProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserAndSection(userId: string, section: SatSection) {
    return this.prisma.userLevelProgress.findUnique({ where: { userId_section: { userId, section } } });
  }

  async findAllByUser(userId: string) {
    return this.prisma.userLevelProgress.findMany({ where: { userId } });
  }

  async incrementLevel(userId: string, section: SatSection, maxLevel = 50) {
    const current = await this.findByUserAndSection(userId, section);
    const next = Math.min((current?.currentLevel ?? 1) + 1, maxLevel);
    return this.prisma.userLevelProgress.update({
      where: { userId_section: { userId, section } },
      data: { currentLevel: next },
    });
  }
}
