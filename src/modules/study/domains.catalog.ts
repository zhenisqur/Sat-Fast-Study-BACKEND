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
export const TOTAL_RW_LEVELS = 15; // грамматика заканчивается раньше — с 16 уровня только math-таб

function resolve(domains: DomainDefinition[], sequenceLevel: number): { domain: DomainDefinition; domainLevel: number } | null {
  for (const domain of domains) {
    const end = domain.sequenceStart + domain.totalLevels - 1;
    if (sequenceLevel >= domain.sequenceStart && sequenceLevel <= end) {
      return { domain, domainLevel: sequenceLevel - domain.sequenceStart + 1 };
    }
  }
  return null;
}

export function resolveMathLevel(sequenceLevel: number) {
  return resolve(MATH_DOMAINS, sequenceLevel);
}

export function resolveRwLevel(sequenceLevel: number) {
  if (sequenceLevel > TOTAL_RW_LEVELS) return null;
  return resolve(RW_DOMAINS, sequenceLevel);
}
