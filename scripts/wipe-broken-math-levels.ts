import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const levels = [10, 11, 12, 13, 14, 24, 36, 37, 38, 39];
  const result = await prisma.question.deleteMany({
    where: { section: 'MATH', level: { in: levels }, domain: null },
  });
  console.log(`Удалено: ${result.count}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
