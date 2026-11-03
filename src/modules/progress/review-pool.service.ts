import { Injectable } from '@nestjs/common';
import { Question } from '@prisma/client';
import { PrismaService } from '@common/database/prisma.service';
import { TOTAL_PATH_LEVELS, resolveMathLevel, resolveRwLevel, splitTopicQuestions } from '../study/domains.catalog';

/**
 * Пул повторения = задачи ТОЛЬКО из пройденных уровней пути (seq < currentSequenceLevel).
 * Для грамматики учитывается, какая часть темы пройдена (основной уровень / закрепление).
 */
@Injectable()
export class ReviewPoolService {
  constructor(private readonly prisma: PrismaService) {}

  async getPassedQuestions(userId: string): Promise<Question[]> {
    const progress = await this.prisma.studyPathProgress.findUnique({ where: { userId }, select: { currentSequenceLevel: true } });
    const lastPassed = Math.min((progress?.currentSequenceLevel ?? 1) - 1, TOTAL_PATH_LEVELS);
    if (lastPassed < 1) return [];

    // тема -> какие части пройдены (math: всегда целиком; grammar: part 1 и/или 2)
    const topics = new Map<string, { domain: string; domainLevel: number; split: boolean; parts: Set<1 | 2> }>();
    const add = (domain: string, domainLevel: number, split: boolean, part: 1 | 2) => {
      const key = `${domain}#${domainLevel}`;
      const t = topics.get(key) ?? { domain, domainLevel, split, parts: new Set<1 | 2>() };
      t.parts.add(part);
      topics.set(key, t);
    };
    for (let seq = 1; seq <= lastPassed; seq++) {
      const math = resolveMathLevel(seq);
      if (math) add(math.domain.key, math.domainLevel, false, 1);
      const rw = resolveRwLevel(seq);
      if (rw) add(rw.domain.key, rw.domainLevel, true, rw.part);
    }

    const all = await this.prisma.question.findMany({
      where: { isActive: true, OR: [...topics.values()].map((t) => ({ domain: t.domain, domainLevel: t.domainLevel })) },
    });

    const result: Question[] = [];
    for (const t of topics.values()) {
      const qs = all.filter((q) => q.domain === t.domain && q.domainLevel === t.domainLevel);
      if (!t.split || t.parts.size === 2) result.push(...qs);
      else for (const part of t.parts) result.push(...splitTopicQuestions(qs, part, true));
    }
    return result;
  }

  async getPoolSize(userId: string): Promise<number> {
    return (await this.getPassedQuestions(userId)).length;
  }
}
