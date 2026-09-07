import * as fs from 'fs';
import * as path from 'path';

const filePath = process.argv[2];
const outputPath = process.argv[3] || filePath;
const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
const rows = JSON.parse(raw);

const seenLevel24: Set<number> = new Set(); // какие orderInLevel уже видели для level=24
let relabeled = 0;

const fixed = rows.map((row: any) => {
  if (row.section === 'MATH' && row.level === 24) {
    if (seenLevel24.has(row.orderInLevel)) {
      // это дубль по orderInLevel для уровня 24 -> переносим на пустой уровень 10
      relabeled++;
      return { ...row, level: 10 };
    }
    seenLevel24.add(row.orderInLevel);
  }
  return row;
});

fs.writeFileSync(path.resolve(outputPath), JSON.stringify(fixed, null, 2), 'utf-8');
console.log(`Перенесено на level 10: ${relabeled} вопросов`);
console.log(`Сохранено в: ${outputPath}`);
