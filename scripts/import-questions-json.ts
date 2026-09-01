import 'dotenv/config';
import { PrismaClient, SatSection, QuestionDifficulty } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

interface RawQuestion {
  section: string;
  level: number;
  orderInLevel: number;
  stem: string;
  choiceA?: string;
  choiceB?: string;
  choiceC?: string;
  choiceD?: string;
  correctChoice: string;
  explanation: string;
  difficulty?: string;
}

function mapSection(raw: string): SatSection {
  const v = raw.trim().toUpperCase();
  if (v === 'MATH') return 'MATH';
  if (v === 'GRAMMAR' || v === 'READING_WRITING' || v === 'RW') return 'READING_WRITING';
  throw new Error(`Неизвестная секция: "${raw}"`);
}

function mapDifficulty(raw?: string): QuestionDifficulty {
  const v = (raw ?? 'MEDIUM').trim().toUpperCase();
  if (v === 'EASY' || v === 'MEDIUM' || v === 'HARD') return v as QuestionDifficulty;
  throw new Error(`Неизвестная сложность: "${raw}"`);
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: ts-node scripts/import-questions-json.ts <path>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
  const rows: RawQuestion[] = JSON.parse(raw);
  console.log(`Найдено вопросов: ${rows.length}`);

  let created = 0;
  let skipped = 0;
  const errors: { index: number; message: string }[] = [];
  const perLevelCount = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const section = mapSection(row.section);
      const difficulty = mapDifficulty(row.difficulty);
      const levelIndex = Number(row.level);

      if (!levelIndex || levelIndex < 1 || levelIndex > 50) {
        throw new Error(`Некорректный level: "${row.level}"`);
      }
      if (!row.stem?.trim()) throw new Error('Пустой stem');
      if (!row.correctChoice?.trim()) throw new Error('Не указан correctChoice');

      const existing = await prisma.question.findFirst({
        where: { section, stem: row.stem.trim() },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.question.create({
        data: {
          section,
          level: levelIndex,
          orderInLevel: row.orderInLevel ?? 1,
          difficulty,
          stem: row.stem.trim(),
          choiceA: row.choiceA ?? '',
          choiceB: row.choiceB ?? '',
          choiceC: row.choiceC ?? '',
          choiceD: row.choiceD ?? '',
          correctChoice: row.correctChoice.trim().toUpperCase(),
          explanation: row.explanation?.trim() ?? '',
        },
      });

      const levelKey = `${section}-${levelIndex}`;
      perLevelCount.set(levelKey, (perLevelCount.get(levelKey) ?? 0) + 1);
      created++;
      if (created % 50 === 0) console.log(`  ...создано ${created}/${rows.length}`);
    } catch (err: any) {
      errors.push({ index: i, message: err.message });
    }
  }

  console.log(`\n=== ИТОГ ===\nСоздано: ${created}\nПропущено: ${skipped}\nОшибок: ${errors.length}`);

  const badLevels = [...perLevelCount.entries()].filter(([, count]) => count !== 15);
  if (badLevels.length > 0) {
    console.log('\nУровни не с 15 вопросами (в рамках этого файла — это нормально, если грузишь по частям):');
    badLevels.forEach(([key, count]) => console.log(`  ${key}: ${count}`));
  }

  if (errors.length > 0) {
    console.log('\nОшибки:');
    errors.forEach((e) => console.log(`  Индекс ${e.index}: ${e.message}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
