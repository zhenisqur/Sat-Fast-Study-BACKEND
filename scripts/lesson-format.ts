// Формат JSON-файла урока (seed-data/study/**) и его проверка/преобразование в строку questions.
//
// Задачи квиза бывают двух видов:
//
// 1) choice (по умолчанию, старый формат):
//    { "kind": "choice", "orderInLevel": 1, "difficulty": "EASY",
//      "stem": "...", "choiceA": "...", "choiceB": "...", "choiceC": "...", "choiceD": "...",
//      "correctChoice": "B", "explanation": "...", "explain": { ...необязательно } }
//
// 2) fill (новый формат, как в lesson-demo):
//    { "kind": "fill", "orderInLevel": 2, "difficulty": "MEDIUM", "title": "Заполни пропуски",
//      "parts": ["3x + 7 = 22", "\n", "3x =", null, "\n", "x =", null],   // null = пропуск, "\n" = перенос строки (шаг решения)
//      // "\n" — отдельный элемент; перенос внутри текста ("3x =\nx =") импортёр сам вынесет в отдельный элемент.
//      // Нельзя: начинать/заканчивать переносом, два переноса подряд.
//      "options": ["5", "29", "15", "3"],                                // банк слов/чисел
//      "answers": [2, 0],                                                // для каждого пропуска — индекс в options
//      "explain": { "rule": "...", "paragraphs": ["..."], "examples": ["..."] } }
//    stem и explanation для fill можно не писать — соберутся из parts и explain.

import { Prisma, QuestionDifficulty } from '@prisma/client';

export interface Explain {
  rule?: string;
  paragraphs?: string[];
  examples?: string[];
}

export interface ChoiceQuizItem {
  kind?: 'choice';
  orderInLevel: number;
  difficulty: string;
  stem: string;
  choiceA: string;
  choiceB: string;
  choiceC: string;
  choiceD: string;
  correctChoice: string;
  explanation: string;
  explain?: Explain;
}

export interface FillQuizItem {
  kind: 'fill';
  orderInLevel: number;
  difficulty: string;
  title?: string;
  parts: (string | null)[];
  options: string[];
  answers: number[];
  explain: Explain;
  stem?: string;
  explanation?: string;
}

export type QuizItem = ChoiceQuizItem | FillQuizItem;

export interface LessonFile {
  domain: string;
  domainLevel: number;
  topic: string;
  sequenceLevel: number;
  section?: string;
  scenarios: { order: number; title: string; content: string }[];
  quiz: QuizItem[];
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

export function mapDifficulty(raw: string): QuestionDifficulty {
  const v = String(raw ?? '').trim().toUpperCase();
  if (DIFFICULTIES.includes(v)) return v as QuestionDifficulty;
  throw new Error(`Неизвестная сложность: "${raw}"`);
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function validateExplain(prefix: string, explain: any, required: boolean, errors: string[]) {
  if (explain === undefined || explain === null) {
    if (required) errors.push(`${prefix}: нет explain { rule, paragraphs, examples }`);
    return;
  }
  if (typeof explain !== 'object') return void errors.push(`${prefix}: explain должен быть объектом`);
  if (required && !String(explain.rule ?? '').trim()) errors.push(`${prefix}: пустой explain.rule`);
  if (explain.paragraphs !== undefined && !isStringArray(explain.paragraphs)) errors.push(`${prefix}: explain.paragraphs должен быть массивом строк`);
  if (explain.examples !== undefined && !isStringArray(explain.examples)) errors.push(`${prefix}: explain.examples должен быть массивом строк`);
  if (required && !(explain.paragraphs?.length > 0)) errors.push(`${prefix}: explain.paragraphs пустой`);
}

/** Перенос строки в parts — отдельный элемент, ровно "\n" (так его рисует экран урока: part === '\n'). */
export const LINE_BREAK = '\n';

/**
 * Приводит parts к виду, который понимает экран урока:
 * - перенос внутри текста ("3x =\nx =", в том числе \r\n) выносится в отдельный элемент "\n";
 * - у текстовых кусков обрезаются пробелы по краям, пустые куски выкидываются;
 * - null (пропуск) не трогается.
 */
export function normalizeParts(parts: (string | null)[]): (string | null)[] {
  const out: (string | null)[] = [];
  for (const part of parts) {
    if (part === null) { out.push(null); continue; }
    const pieces = part.replace(/\r\n?/g, LINE_BREAK).split(LINE_BREAK);
    pieces.forEach((piece, i) => {
      if (i > 0) out.push(LINE_BREAK);
      const text = piece.trim();
      if (text) out.push(text);
    });
  }
  return out;
}

/** Ошибки, которые нормализация не исправляет. */
function validateLineBreaks(prefix: string, parts: (string | null)[]): string[] {
  const errors: string[] = [];
  if (parts[0] === LINE_BREAK) errors.push(`${prefix}: parts не может начинаться с переноса "\\n"`);
  if (parts[parts.length - 1] === LINE_BREAK) errors.push(`${prefix}: parts не может заканчиваться переносом "\\n"`);
  parts.forEach((x, i) => {
    if (x === LINE_BREAK && parts[i + 1] === LINE_BREAK) errors.push(`${prefix}: два переноса "\\n" подряд (элементы ${i} и ${i + 1}) — пустая строка в решении`);
  });
  return errors;
}

export function validateQuizItem(q: any, i: number): string[] {
  const errors: string[] = [];
  const p = `quiz[${i}]`;
  if (!Number.isInteger(q.orderInLevel) || q.orderInLevel < 1) errors.push(`${p}: orderInLevel должен быть целым >= 1`);
  if (!q.difficulty || !DIFFICULTIES.includes(String(q.difficulty).toUpperCase())) {
    errors.push(`${p}: difficulty должен быть EASY/MEDIUM/HARD, получено "${q.difficulty}"`);
  }

  const kind = q.kind ?? 'choice';
  if (kind === 'choice') {
    if (!q.stem?.trim()) errors.push(`${p}: пустой stem`);
    for (const k of ['choiceA', 'choiceB', 'choiceC', 'choiceD']) if (!String(q[k] ?? '').trim()) errors.push(`${p}: пустой ${k}`);
    if (!['A', 'B', 'C', 'D'].includes(String(q.correctChoice ?? '').trim().toUpperCase())) {
      errors.push(`${p}: correctChoice должен быть A/B/C/D, получено "${q.correctChoice}"`);
    }
    if (!q.explanation?.trim()) errors.push(`${p}: пустой explanation`);
    validateExplain(p, q.explain, false, errors);
  } else if (kind === 'fill') {
    if (!Array.isArray(q.parts) || !q.parts.every((x: unknown) => x === null || typeof x === 'string')) {
      errors.push(`${p}: parts должен быть массивом строк и null (null = пропуск)`);
    } else {
      errors.push(...validateLineBreaks(p, normalizeParts(q.parts)));
    }
    if (!isStringArray(q.options) || q.options.length < 2) errors.push(`${p}: options — минимум 2 строки`);
    else if (new Set(q.options.map((o: string) => o.trim())).size !== q.options.length) errors.push(`${p}: в options есть повторы`);
    const gaps = Array.isArray(q.parts) ? q.parts.filter((x: unknown) => x === null).length : 0;
    if (gaps === 0) errors.push(`${p}: в parts нет ни одного пропуска (null)`);
    if (!Array.isArray(q.answers) || q.answers.length !== gaps) {
      errors.push(`${p}: answers должен содержать ${gaps} индекс(ов) — по одному на пропуск`);
    } else if (isStringArray(q.options) && !q.answers.every((a: unknown) => Number.isInteger(a) && (a as number) >= 0 && (a as number) < q.options.length)) {
      errors.push(`${p}: answers — индексы в options от 0 до ${q.options.length - 1}`);
    }
    validateExplain(p, q.explain, true, errors);
  } else {
    errors.push(`${p}: kind должен быть "choice" или "fill", получено "${kind}"`);
  }
  return errors;
}

export function validateLesson(data: any): string[] {
  const errors: string[] = [];
  if (!data.domain) errors.push('нет поля domain');
  if (!data.domainLevel) errors.push('нет поля domainLevel');
  if (!data.topic) errors.push('нет поля topic');
  if (!data.sequenceLevel) errors.push('нет поля sequenceLevel');

  if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
    errors.push('scenarios пустой или отсутствует');
  } else {
    data.scenarios.forEach((s: any, i: number) => {
      if (!s.order) errors.push(`scenarios[${i}]: нет order`);
      if (!s.title?.trim()) errors.push(`scenarios[${i}]: пустой title`);
      if (!s.content?.trim()) errors.push(`scenarios[${i}]: пустой content`);
    });
  }

  if (!Array.isArray(data.quiz) || data.quiz.length === 0) {
    errors.push('quiz пустой или отсутствует');
  } else {
    data.quiz.forEach((q: any, i: number) => errors.push(...validateQuizItem(q, i)));
    const orders = data.quiz.map((q: any) => q.orderInLevel);
    if (new Set(orders).size !== orders.length) errors.push('quiz: orderInLevel повторяется');
  }
  return errors;
}

/** Текст задачи для тьютора/админки и дедупликации: пропуски -> "___". */
export function fillStem(parts: (string | null)[]): string {
  return normalizeParts(parts)
    .map((x) => (x === null ? '___' : x))
    .join(' ')
    .replace(/ ?\n ?/g, '\n')
    .trim();
}

/** Поля строки questions (без section/level/domain), общие для обоих видов. */
export function quizItemToQuestionData(q: QuizItem) {
  const explain = q.explain ?? {};
  const structured = {
    explainRule: explain.rule?.trim() || null,
    explainParagraphs: explain.paragraphs ?? Prisma.DbNull,
    explainExamples: explain.examples ?? Prisma.DbNull,
  };

  if (q.kind === 'fill') {
    const parts = normalizeParts(q.parts);
    return {
      kind: 'FILL' as const,
      title: q.title?.trim() || 'Заполни пропуски',
      stem: q.stem?.trim() || fillStem(parts),
      parts,
      options: q.options.map((o) => o.trim()),
      answers: q.answers,
      choiceA: null,
      choiceB: null,
      choiceC: null,
      choiceD: null,
      correctChoice: null,
      explanation: q.explanation?.trim() || [explain.rule, ...(explain.paragraphs ?? [])].filter(Boolean).join('\n'),
      difficulty: mapDifficulty(q.difficulty),
      ...structured,
    };
  }
  return {
    kind: 'CHOICE' as const,
    title: null,
    stem: q.stem.trim(),
    parts: Prisma.DbNull,
    options: Prisma.DbNull,
    answers: Prisma.DbNull,
    choiceA: q.choiceA,
    choiceB: q.choiceB,
    choiceC: q.choiceC,
    choiceD: q.choiceD,
    correctChoice: q.correctChoice.trim().toUpperCase(),
    explanation: q.explanation.trim(),
    difficulty: mapDifficulty(q.difficulty),
    ...structured,
  };
}
