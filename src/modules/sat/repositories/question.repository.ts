import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma, Question, SatSection, QuestionDifficulty } from '@prisma/client';
import { BaseRepository } from '@common/repository/base.repository';

export interface QuestionFilter {
  section?: SatSection;
  difficulty?: QuestionDifficulty;
  tagIds?: string[];
}

@Injectable()
export class QuestionRepository extends BaseRepository<Question> {
  constructor(protected readonly prisma: PrismaService) { super(prisma, 'question'); }

  async findManyByFilter(filter: QuestionFilter, skip: number, take: number) {
    const where: Prisma.QuestionWhereInput = {
      isActive: true,
      section: filter.section,
      difficulty: filter.difficulty,
      ...(filter.tagIds?.length && { tags: { some: { tagId: { in: filter.tagIds } } } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({ where, skip, take, include: { tags: { include: { tag: true } } } }),
      this.prisma.question.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdWithTags(id: string) {
    return this.prisma.question.findUnique({ where: { id }, include: { tags: { include: { tag: true } } } });
  }
}
