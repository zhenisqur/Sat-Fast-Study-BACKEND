import * as fs from 'fs';
import * as path from 'path';

const filePath = process.argv[2];
const outputPath = process.argv[3] || filePath;
const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
const rows = JSON.parse(raw);

const seen = new Set<string>();
const cleaned: any[] = [];
let removed = 0;

for (const row of rows) {
  const key = `${row.section}-${row.level}-${row.orderInLevel}`;
  if (seen.has(key)) {
    removed++;
    continue; // пропускаем повторное вхождение, оставляем первое
  }
  seen.add(key);
  cleaned.push(row);
}

fs.writeFileSync(path.resolve(outputPath), JSON.stringify(cleaned, null, 2), 'utf-8');
console.log(`Было: ${rows.length}, удалено дублей: ${removed}, осталось: ${cleaned.length}`);
console.log(`Сохранено в: ${outputPath}`);
