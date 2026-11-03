import { Injectable, NotFoundException } from '@nestjs/common';
import { AttemptRepository } from '../repositories/attempt.repository';
import { QuestionRepository } from '../repositories/question.repository';
import { SubmitAnswerDto } from '../dto/submit-answer.dto';
import { AnswerCorrectness } from '@prisma/client';
import { checkAnswer } from '@common/utils/question';

@Injectable()
export class AttemptService {
  constructor(private readonly attemptRepository: AttemptRepository, private readonly questionRepository: QuestionRepository) {}

  async submitAnswer(attemptId: string, userId: string, dto: SubmitAnswerDto) {
    const question = await this.questionRepository.findById(dto.questionId);
    if (!question) throw new NotFoundException('Вопрос не найден');
    const correctness: AnswerCorrectness = checkAnswer(question, dto) ? 'CORRECT' : 'INCORRECT';
    return this.attemptRepository.createAnswerLog({
      attemptId, userId, questionId: dto.questionId, userAnswer: dto.userAnswer, correctness, timeSpentSec: dto.timeSpentSec,
    });
  }
}
