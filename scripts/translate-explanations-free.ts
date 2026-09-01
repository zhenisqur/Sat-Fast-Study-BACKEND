// scripts/translate-explanations-free.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { translate } from '@vitalets/google-translate-api';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const questions = await prisma.question.findMany({
    where: { domain: null },
    select: { id: true, explanation: true },
  });

  console.log(`Найдено вопросов: ${questions.length}`);

  let translated = 0;
  let errors = 0;

  for (const q of questions) {
    try {
      const hasCyrillic = /[а-яА-ЯёЁ]/.test(q.explanation);
      if (hasCyrillic) continue;

      const result = await translate(q.explanation, { to: 'ru' });

      await prisma.question.update({
        where: { id: q.id },
        data: { explanation: result.text },
      });

      translated++;
      if (translated % 20 === 0) console.log(`  ...переведено ${translated}/${questions.length}`);

      await sleep(1000); // пауза побольше, т.к. неофициальный эндпоинт
    } catch (err: any) {
      errors++;
      console.error(`Ошибка на ${q.id}: ${err.message}`);
      await sleep(3000); // если словили rate limit — подождать подольше
    }
  }

  console.log(`\nПереведено: ${translated}, ошибок: ${errors}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
