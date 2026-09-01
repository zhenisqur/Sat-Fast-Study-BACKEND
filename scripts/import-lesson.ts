import 'dotenv/config';
import { PrismaClient, QuestionDifficulty } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface LessonFile {
  domain: string;
  domainLevel: number;
  topic: string;
  sequenceLevel: number;
  section?: string;   // ← добавь эту строку
  scenarios: { order: number; title: string; content: string }[];
  quiz: {
    orderInLevel: number;
    stem: string;
    choiceA: string;
    choiceB: string;
    choiceC: string;
    choiceD: string;
    correctChoice: string;
    explanation: string;
    difficulty: string;
  }[];
}

function mapDifficulty(raw: string): QuestionDifficulty {
  const v = raw.trim().toUpperCase();
  if (v === 'EASY' || v === 'MEDIUM' || v === 'HARD') return v as QuestionDifficulty;
  throw new Error(`Неизвестная сложность: "${raw}"`);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error('Usage: ts-node scripts/import-lesson.ts <path-to-json>'); process.exit(1); }

  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const lesson: LessonFile = JSON.parse(raw);

  console.log(`Импортирую урок: ${lesson.domain} / уровень ${lesson.domainLevel} (${lesson.topic})`);

  // Сценарии — идемпотентно, по unique [domain, domainLevel, order]
  let scenariosCreated = 0;
  for (const s of lesson.scenarios) {
    await prisma.lessonScenario.upsert({
      where: { domain_domainLevel_order: { domain: lesson.domain, domainLevel: lesson.domainLevel, order: s.order } },
      update: { title: s.title, content: s.content },
      create: { domain: lesson.domain, domainLevel: lesson.domainLevel, order: s.order, title: s.title, content: s.content },
    });
    scenariosCreated++;
  }
  console.log(`  Сценариев: ${scenariosCreated}`);

  // Квиз-вопросы — используем зарезервированный диапазон level = 900 + sequenceLevel,
  // чтобы не пересекаться с реальными тест-режим уровнями (1-50)
  const reservedLevel = 900 + lesson.sequenceLevel;
  let quizCreated = 0;
  let quizSkipped = 0;

  for (const q of lesson.quiz) {
    const existing = await prisma.question.findFirst({
      where: { domain: lesson.domain, domainLevel: lesson.domainLevel, stem: q.stem.trim() },
      select: { id: true },
    });
    if (existing) { quizSkipped++; continue; }

    await prisma.question.create({
      data: {
        section: (lesson as any).section === 'READING_WRITING' ? 'READING_WRITING' : 'MATH',
        level: reservedLevel,
        orderInLevel: q.orderInLevel,
        difficulty: mapDifficulty(q.difficulty),
        stem: q.stem.trim(),
        choiceA: q.choiceA,
        choiceB: q.choiceB,
        choiceC: q.choiceC,
        choiceD: q.choiceD,
        correctChoice: q.correctChoice.trim().toUpperCase(),
        explanation: q.explanation.trim(),
        domain: lesson.domain,
        domainLevel: lesson.domainLevel,
        domainOrderInLevel: q.orderInLevel,
      },
    });
    quizCreated++;
  }
  console.log(`  Квиз: создано ${quizCreated}, пропущено ${quizSkipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
