import * as fs from 'fs';
import * as path from 'path';

const filePath = process.argv[2];
const raw = fs.readFileSync(path.resolve(filePath), 'utf-8');
const rows = JSON.parse(raw);

const seen = new Map<string, number[]>();

rows.forEach((row: any, index: number) => {
  const key = `${row.section}-${row.level}-${row.orderInLevel}`;
  if (!seen.has(key)) seen.set(key, []);
  seen.get(key)!.push(index);
});

console.log('=== Дублирующиеся (section, level, orderInLevel) ===\n');
let duplicatesFound = 0;

for (const [key, indices] of seen.entries()) {
  if (indices.length > 1) {
    duplicatesFound++;
    console.log(`${key} — встречается ${indices.length} раз, индексы: ${indices.join(', ')}`);
    indices.forEach((i) => {
      console.log(`   [${i}] stem: "${rows[i].stem.slice(0, 60)}..."`);
    });
  }
}

console.log(`\nВсего конфликтов: ${duplicatesFound}`);
