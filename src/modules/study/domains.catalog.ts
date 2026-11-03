export interface DomainDefinition {
  key: string;
  section: "MATH" | "READING_WRITING";
  title: string;
  totalLevels: number;
  sequenceStart: number;
  topics: string[];
}

export const MATH_DOMAINS: DomainDefinition[] = [
  { key: "algebra", section: "MATH", title: "Algebra", totalLevels: 8, sequenceStart: 1,
    topics: ["Linear equations","Linear equations in context","Systems of equations","Linear inequalities","Linear functions","Slope & rate of change","Algebraic expressions","Mixed Algebra"] },
  { key: "advanced_math", section: "MATH", title: "Advanced Math", totalLevels: 9, sequenceStart: 9,
    topics: ["Quadratic equations","Quadratic functions","Exponents & radicals","Polynomial expressions","Nonlinear equations","Nonlinear functions","Rational expressions","Equivalent expressions","Mixed Advanced Math"] },
  { key: "problem_solving_and_data_analysis", section: "MATH", title: "Problem-Solving & Data Analysis", totalLevels: 7, sequenceStart: 18,
    topics: ["Ratios & proportions","Percentages","Units & rates","Tables & graphs","Statistics","Probability","Data analysis & word problems"] },
  { key: "geometry_and_trigonometry", section: "MATH", title: "Geometry & Trigonometry", totalLevels: 6, sequenceStart: 25,
    topics: ["Lines & angles","Triangles","Circles","Area & volume","Right triangles & trigonometry","Mixed Geometry"] },
];

export const RW_DOMAINS: DomainDefinition[] = [
  { key: "information_and_ideas", section: "READING_WRITING", title: "Information and Ideas", totalLevels: 5, sequenceStart: 1,
    topics: ["Central Ideas & Details","Command of Evidence (Textual)","Command of Evidence (Quantitative)","Inferences","Mixed Information and Ideas"] },
  { key: "craft_and_structure", section: "READING_WRITING", title: "Craft and Structure", totalLevels: 4, sequenceStart: 6,
    topics: ["Words in Context","Text Structure & Purpose","Cross-Text Connections","Mixed Craft and Structure"] },
  { key: "expression_of_ideas", section: "READING_WRITING", title: "Expression of Ideas", totalLevels: 3, sequenceStart: 10,
    topics: ["Rhetorical Synthesis","Transitions","Mixed Expression of Ideas"] },
  { key: "standard_english_conventions", section: "READING_WRITING", title: "Standard English Conventions", totalLevels: 3, sequenceStart: 13,
    topics: ["Boundaries","Form, Structure, and Sense","Mixed Standard English Conventions"] },
];

export const TOTAL_MATH_LEVELS = 30;
export const TOTAL_PATH_LEVELS = TOTAL_MATH_LEVELS;
/** Число тем R&W (уровней в RW_DOMAINS). Каждая тема идёт на ДВУХ уровнях пути подряд. */
export const TOTAL_RW_TOPICS = 15;
/** Оставлено для совместимости: grammar-таб теперь есть на всех 30 уровнях. */
export const TOTAL_RW_LEVELS = TOTAL_PATH_LEVELS;

// ---- модули (UI-группировка пути, не домены SAT) ----
export const MODULE_SIZE = 5;
export const TOTAL_MODULES = Math.ceil(TOTAL_PATH_LEVELS / MODULE_SIZE);
/** Уровни 1..FREE_LEVELS доступны без подписки (первый модуль). */
export const FREE_LEVELS = MODULE_SIZE;

export function moduleOf(sequenceLevel: number): number {
  return Math.ceil(sequenceLevel / MODULE_SIZE);
}

export interface ResolvedLevel {
  domain: DomainDefinition;
  domainLevel: number;
  /** 1 = основной уровень темы, 2 = закрепление (только grammar). Для math всегда 1. */
  part: 1 | 2;
}

function resolve(domains: DomainDefinition[], sequenceLevel: number): { domain: DomainDefinition; domainLevel: number } | null {
  for (const domain of domains) {
    const end = domain.sequenceStart + domain.totalLevels - 1;
    if (sequenceLevel >= domain.sequenceStart && sequenceLevel <= end) {
      return { domain, domainLevel: sequenceLevel - domain.sequenceStart + 1 };
    }
  }
  return null;
}

export function resolveMathLevel(sequenceLevel: number): ResolvedLevel | null {
  const r = resolve(MATH_DOMAINS, sequenceLevel);
  return r ? { ...r, part: 1 } : null;
}

/** Уровни 1-2 -> тема 1, 3-4 -> тема 2, ..., 29-30 -> тема 15. Нечётный = основной, чётный = закрепление. */
export function resolveRwLevel(sequenceLevel: number): ResolvedLevel | null {
  if (sequenceLevel < 1 || sequenceLevel > TOTAL_PATH_LEVELS) return null;
  const topicIndex = Math.ceil(sequenceLevel / 2);
  const r = resolve(RW_DOMAINS, topicIndex);
  return r ? { ...r, part: sequenceLevel % 2 === 1 ? 1 : 2 } : null;
}

const DIFFICULTY_RANK: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

/**
 * Делит вопросы темы между основным уровнем и закреплением без повторов:
 * лёгкая половина (с округлением вверх) — part 1, трудная — part 2. Для math (part=1, split=false) — все вопросы.
 */
export function splitTopicQuestions<T extends { difficulty: string; domainOrderInLevel: number | null; id: string }>(
  questions: T[],
  part: 1 | 2,
  split: boolean,
): T[] {
  const sorted = [...questions].sort(
    (a, b) =>
      (DIFFICULTY_RANK[a.difficulty] ?? 1) - (DIFFICULTY_RANK[b.difficulty] ?? 1) ||
      (a.domainOrderInLevel ?? 0) - (b.domainOrderInLevel ?? 0) ||
      a.id.localeCompare(b.id),
  );
  if (!split) return sorted;
  const firstHalf = Math.ceil(sorted.length / 2);
  return part === 1 ? sorted.slice(0, firstHalf) : sorted.slice(firstHalf);
}
