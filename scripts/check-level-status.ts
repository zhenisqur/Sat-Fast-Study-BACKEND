import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const section = (process.argv[2] || 'READING_WRITING') as 'MATH' | 'READING_WRITING';

  const questions = await prisma.question.findMany({
    where: { section, domain: null },
    select: { level: true, orderInLevel: true },
  });

  const byLevel = new Map<number, number[]>();
  questions.forEach((q) => {
    if (!byLevel.has(q.level)) byLevel.set(q.level, []);
    byLevel.get(q.level)!.push(q.orderInLevel);
  });

  console.log(`=== ${section}: реальное состояние в БД ===\n`);

  const maxLevel = Math.max(...byLevel.keys(), 0);
  for (let level = 1; level <= maxLevel; level++) {
    const orders = (byLevel.get(level) ?? []).sort((a, b) => a - b);
    if (orders.length !== 15) {
      const missing: number[] = [];
      for (let i = 1; i <= 15; i++) {
        if (!orders.includes(i)) missing.push(i);
      }
      console.log(`Уровень ${level}: ${orders.length}/15 — не хватает orderInLevel: [${missing.join(', ')}]`);
    }
  }

  console.log(`\nВсего уровней с данными: ${byLevel.size}, максимальный номер уровня: ${maxLevel}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
