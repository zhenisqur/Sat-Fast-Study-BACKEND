import { Injectable, NotFoundException } from '@nestjs/common';
import { QuestionRepository, QuestionFilter } from '../repositories/question.repository';
import { QueryQuestionsDto } from '../dto/query-questions.dto';

@Injectable()
export class QuestionService {
  constructor(private readonly questionRepository: QuestionRepository) {}

  async getQuestions(query: QueryQuestionsDto) {
    const { page = 1, limit = 20, section, difficulty, tagIds } = query;
    const skip = (page - 1) * limit;
    const filter: QuestionFilter = { section, difficulty, tagIds: tagIds ? tagIds.split(',').map((t) => t.trim()) : undefined };
    const { items, total } = await this.questionRepository.findManyByFilter(filter, skip, limit);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getQuestionOrThrow(id: string) {
    const question = await this.questionRepository.findByIdWithTags(id);
    if (!question) throw new NotFoundException(`Question ${id} not found`);
    return question;
  }

  async getQuestionForStudent(id: string) {
    const question = await this.getQuestionOrThrow(id);
    const { correctChoice, ...safeQuestion } = question;
    return safeQuestion;
  }
}
