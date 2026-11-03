import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import { LessonFile, quizItemToQuestionData, validateLesson } from './lesson-format';

// Импорт одного урока. Формат файла (включая задачи kind: "fill") — см. scripts/lesson-format.ts.
//   npx ts-node -r tsconfig-paths/register scripts/import-lesson.ts "./seed-data/study/math/algebra-1.json"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = process.argv[2];
  if (!filePath) { console.error('Usage: ts-node scripts/import-lesson.ts <path-to-json>'); process.exit(1); }

  const lesson: LessonFile = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf-8'));
  const errors = validateLesson(lesson);
  if (errors.length > 0) {
    console.error(`❌ ${filePath}:\n` + errors.map((e) => `   - ${e}`).join('\n'));
    process.exit(1);
  }

  console.log(`Импортирую урок: ${lesson.domain} / уровень ${lesson.domainLevel} (${lesson.topic})`);

  // Сценарии — идемпотентно, по unique [domain, domainLevel, order]
  for (const s of lesson.scenarios) {
    await prisma.lessonScenario.upsert({
      where: { domain_domainLevel_order: { domain: lesson.domain, domainLevel: lesson.domainLevel, order: s.order } },
      update: { title: s.title, content: s.content },
      create: { domain: lesson.domain, domainLevel: lesson.domainLevel, order: s.order, title: s.title, content: s.content },
    });
  }
  console.log(`  Сценариев: ${lesson.scenarios.length}`);

  // Квиз-вопросы — зарезервированный диапазон level = 900 + sequenceLevel,
  // чтобы не пересекаться с уровнями старой Практики (1-50).
  const reservedLevel = 900 + lesson.sequenceLevel;
  let created = 0;
  let skipped = 0;

  for (const q of lesson.quiz) {
    const data = quizItemToQuestionData(q);
    const existing = await prisma.question.findFirst({
      where: { domain: lesson.domain, domainLevel: lesson.domainLevel, stem: data.stem },
      select: { id: true },
    });
    if (existing) { skipped++; continue; }

    await prisma.question.create({
      data: {
        ...data,
        section: lesson.section === 'READING_WRITING' ? 'READING_WRITING' : 'MATH',
        level: reservedLevel,
        orderInLevel: q.orderInLevel,
        domain: lesson.domain,
        domainLevel: lesson.domainLevel,
        domainOrderInLevel: q.orderInLevel,
      },
    });
    created++;
  }
  console.log(`  Квиз: создано ${created}, пропущено ${skipped} (уже есть такой stem)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
