import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { SatSection } from '@prisma/client';

@Injectable()
export class LevelDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findQuestionsForLevel(section: SatSection, levelIndex: number) {
    return this.prisma.question.findMany({
      where: { section, level: levelIndex, isActive: true },
      orderBy: { orderInLevel: 'asc' },
    });
  }
}
