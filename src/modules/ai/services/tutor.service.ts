import { Injectable } from '@nestjs/common';
import { AnthropicProvider } from '../providers/anthropic.provider';
import { AiLogRepository } from '../repositories/ai-log.repository';
import { buildTutorSystemPrompt } from '../promts/tutor-system.prompt';
import { QuestionRepository } from '../../sat/repositories/question.repository';
import { AskTutorDto } from '../dto/ask-tutor.dto';

const SAFE_FALLBACK = 'Дай мне секунду разобраться в этом шаге получше — пока попробуй перепроверить его вручную.';

@Injectable()
export class TutorService {
  constructor(
    private readonly anthropicProvider: AnthropicProvider,
    private readonly aiLogRepository: AiLogRepository,
    private readonly questionRepository: QuestionRepository,
  ) {}

  async ask(userId: string, dto: AskTutorDto) {
    const question = await this.questionRepository.findById(dto.questionId);
    if (!question) throw new Error('Question not found');
    const q = question as any;

    const systemPrompt = buildTutorSystemPrompt({
      questionStem: q.stem, choices: JSON.stringify(q.choices), correctAnswer: q.correctAnswer,
      userAnswer: dto.userAnswer, referenceExplanation: q.explanation,
    });

    const start = Date.now();
    const rawResponse = await this.anthropicProvider.complete(systemPrompt, dto.studentMessage);
    const latencyMs = Date.now() - start;
    const flaggedForReview = rawResponse.trim() === 'NEED_HUMAN_REVIEW';
    const finalResponse = flaggedForReview ? SAFE_FALLBACK : rawResponse;

    await this.aiLogRepository.logInteraction({
      userId, questionId: dto.questionId, prompt: systemPrompt, rawResponse, finalResponse,
      modelName: 'claude-sonnet-4-6', flaggedForReview, latencyMs,
    });

    return { message: finalResponse };
  }
}
