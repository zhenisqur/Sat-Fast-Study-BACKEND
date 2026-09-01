import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.question.deleteMany({
    where: { section: 'READING_WRITING', domain: null }, // только тест-режим, "Изучение" не трогаем
  });
  console.log(`Удалено вопросов тест-режима по READING_WRITING: ${result.count}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
