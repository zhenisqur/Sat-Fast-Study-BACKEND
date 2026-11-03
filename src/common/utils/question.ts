import { BadRequestException } from '@nestjs/common';
import { Question } from '@prisma/client';

/**
 * Ответ пользователя на задачу любого вида:
 *  - CHOICE: userAnswer = буква варианта ("A".."D");
 *  - FILL:   userAnswers = для каждого пропуска по порядку индекс выбранного слова в options.
 */
export interface UserAnswerInput {
  userAnswer?: string;
  userAnswers?: number[];
}

const numberArray = (value: unknown): number[] => (Array.isArray(value) ? value.map(Number) : []);
const stringArray = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

/** 400, если форма ответа не подходит к виду задачи. */
export function assertAnswerShape(question: Question, input: UserAnswerInput): void {
  if (question.kind === 'FILL') {
    const expected = numberArray(question.answers).length;
    if (!Array.isArray(input.userAnswers) || input.userAnswers.length !== expected) {
      throw new BadRequestException(`Для этой задачи нужен userAnswers: массив из ${expected} индексов`);
    }
  } else if (typeof input.userAnswer !== 'string' || input.userAnswer.trim() === '') {
    throw new BadRequestException('Для этой задачи нужен userAnswer (буква варианта)');
  }
}

export function checkAnswer(question: Question, input: UserAnswerInput): boolean {
  if (question.kind === 'FILL') {
    const answers = numberArray(question.answers);
    const given = input.userAnswers ?? [];
    return answers.length > 0 && given.length === answers.length && answers.every((a, i) => Number(given[i]) === a);
  }
  return !!question.correctChoice && (input.userAnswer ?? '').trim().toUpperCase() === question.correctChoice.trim().toUpperCase();
}

/** Как ответ хранится в AnswerLog.userAnswer (строка). */
export function serializeUserAnswer(input: UserAnswerInput): string {
  return Array.isArray(input.userAnswers) ? JSON.stringify(input.userAnswers) : (input.userAnswer ?? '');
}

/** Структурное объяснение (rule/paragraphs/examples) — для FILL и для CHOICE, если заполнено. */
export function explainOf(question: Question) {
  return {
    rule: question.explainRule,
    paragraphs: stringArray(question.explainParagraphs),
    examples: stringArray(question.explainExamples),
  };
}

/** Поля обратной связи после ответа. При верном ответе правильный ответ не раскрываем. */
export function answerFeedback(question: Question, correct: boolean) {
  return {
    correctChoice: correct || question.kind === 'FILL' ? null : question.correctChoice,
    correctAnswers: correct || question.kind !== 'FILL' ? null : numberArray(question.answers),
    explanation: correct ? null : question.explanation,
    explain: correct ? null : explainOf(question),
  };
}

/** Задача для ученика: без правильных ответов (correctChoice, answers). */
export function toPublicQuestion<T extends Question>(question: T): Omit<T, 'correctChoice' | 'answers'> {
  const { correctChoice, answers, ...safe } = question;
  return safe;
}
