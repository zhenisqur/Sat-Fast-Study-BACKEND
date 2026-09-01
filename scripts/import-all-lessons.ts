// scripts/import-all-lessons.ts
//
// Гоняет import-lesson.ts по всем JSON-файлам в папке разом.
// СНАЧАЛА валидирует структуру ВСЕХ файлов (без записи в БД), и только если
// всё чисто — пишет. Так одна опечатка в файле 17 из 30 не оставит тебя
// с наполовину залитой базой — увидишь все проблемы разом, до записи.
//
// Запуск:
//   npx ts-node -r tsconfig-paths/register scripts/import-all-lessons.ts "./seed-data/study/math" --dry-run
//   npx ts-node -r tsconfig-paths/register scripts/import-all-lessons.ts "./seed-data/study/math"

import * as fs from 'fs';
import * as path from 'path';

interface LessonFile {
  domain: string;
  domainLevel: number;
  topic: string;
  sequenceLevel: number;
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

function validateLesson(fileName: string, data: any): string[] {
  const errors: string[] = [];

  if (!data.domain) errors.push('нет поля domain');
  if (!data.domainLevel) errors.push('нет поля domainLevel');
  if (!data.topic) errors.push('нет поля topic');
  if (!data.sequenceLevel) errors.push('нет поля sequenceLevel');

  if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
    errors.push('scenarios пустой или отсутствует');
  } else {
    data.scenarios.forEach((s: any, i: number) => {
      if (!s.order) errors.push(`scenarios[${i}]: нет order`);
      if (!s.title?.trim()) errors.push(`scenarios[${i}]: пустой title`);
      if (!s.content?.trim()) errors.push(`scenarios[${i}]: пустой content`);
    });
  }

  if (!Array.isArray(data.quiz) || data.quiz.length === 0) {
    errors.push('quiz пустой или отсутствует');
  } else {
    data.quiz.forEach((q: any, i: number) => {
      if (!q.stem?.trim()) errors.push(`quiz[${i}]: пустой stem`);
      if (!q.correctChoice?.trim()) errors.push(`quiz[${i}]: нет correctChoice`);
      if (!['A', 'B', 'C', 'D'].includes(q.correctChoice?.trim().toUpperCase())) {
        errors.push(`quiz[${i}]: correctChoice должен быть A/B/C/D, получено "${q.correctChoice}"`);
      }
      if (!q.difficulty || !['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty.toUpperCase())) {
        errors.push(`quiz[${i}]: difficulty должен быть EASY/MEDIUM/HARD, получено "${q.difficulty}"`);
      }
    });
  }

  return errors;
}

async function main() {
  const folderPath = process.argv[2];
  const isDryRun = process.argv.includes('--dry-run');

  if (!folderPath) {
    console.error('Usage: ts-node scripts/import-all-lessons.ts <folder> [--dry-run]');
    process.exit(1);
  }

  const files = fs
    .readdirSync(path.resolve(folderPath))
    .filter((f) => f.endsWith('.json'));

  console.log(`Найдено файлов: ${files.length}`);
  console.log(isDryRun ? '=== РЕЖИМ ПРОВЕРКИ (без записи в БД) ===\n' : '=== ИМПОРТ В БД ===\n');

  const validLessons: { fileName: string; data: LessonFile }[] = [];
  let hasErrors = false;

  // Фаза 1: валидация ВСЕХ файлов перед любой записью
  for (const fileName of files) {
    const filePath = path.join(folderPath, fileName);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      const errors = validateLesson(fileName, data);

      if (errors.length > 0) {
        hasErrors = true;
        console.log(`❌ ${fileName}:`);
        errors.forEach((e) => console.log(`   - ${e}`));
      } else {
        console.log(`✅ ${fileName} — валиден (${data.scenarios.length} сценариев, ${data.quiz.length} вопросов)`);
        validLessons.push({ fileName, data });
      }
    } catch (err: any) {
      hasErrors = true;
      console.log(`❌ ${fileName}: не удалось распарсить JSON — ${err.message}`);
    }
  }

  console.log(`\n=== ИТОГ ПРОВЕРКИ: ${validLessons.length}/${files.length} файлов валидны ===`);

  if (hasErrors) {
    console.log('\n⚠️  Есть ошибки. Импорт остановлен — почини файлы выше и запусти заново.');
    process.exit(1);
  }

  if (isDryRun) {
    console.log('\nВсё чисто. Запусти без --dry-run, чтобы реально записать в БД.');
    return;
  }

  // Фаза 2: запись — только если все файлы прошли валидацию
  console.log('\nЗапускаю import-lesson.ts на каждом файле...\n');
  const { execSync } = require('child_process');
  for (const { fileName } of validLessons) {
    const filePath = path.join(folderPath, fileName);
    console.log(`--- ${fileName} ---`);
    execSync(
      `npx ts-node -r tsconfig-paths/register scripts/import-lesson.ts "${filePath}"`,
      { stdio: 'inherit' },
    );
  }

  console.log('\n✅ Все уроки импортированы.');
}

main();