import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const levelToDelete = Number(process.argv[2]);
  const section = process.argv[3] as 'MATH' | 'READING_WRITING';

  if (!levelToDelete || !section) {
    console.error('Usage: ts-node scripts/delete-level.ts <levelNumber> <MATH|READING_WRITING>');
    process.exit(1);
  }

  const result = await prisma.question.deleteMany({
    where: { section, level: levelToDelete },
  });

  console.log(`Удалено вопросов уровня ${levelToDelete} (${section}): ${result.count}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
