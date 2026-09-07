import { Injectable } from '@nestjs/common';
import { SatSection } from '@prisma/client';
import { LevelDefinitionRepository } from '../repositories/level-definition.repository';
import { UserLevelProgressRepository } from '../repositories/user-level-progress.repository';

@Injectable()
export class LevelService {
  constructor(
    private readonly levelDefinitionRepository: LevelDefinitionRepository,
    private readonly userLevelProgressRepository: UserLevelProgressRepository,
  ) {}

  async getTodayQuestionsForSection(userId: string, section: SatSection) {
    const progress = await this.userLevelProgressRepository.findByUserAndSection(userId, section);
    const currentLevel = progress?.currentLevel ?? 1;
    const questions = await this.levelDefinitionRepository.findQuestionsForLevel(section, currentLevel);
    return questions.map(({ correctChoice, ...safe }: any) => safe);
  }

  async getOverallProgress(userId: string) {
    const all = await this.userLevelProgressRepository.findAllByUser(userId);
    const math = all.find((p) => p.section === 'MATH')?.currentLevel ?? 1;
    const rw = all.find((p) => p.section === 'READING_WRITING')?.currentLevel ?? 1;
    return {
      math: { level: math, of: 50 },
      readingWriting: { level: rw, of: 50 },
      overall: { level: math + rw, of: 100 },
    };
  }
}
