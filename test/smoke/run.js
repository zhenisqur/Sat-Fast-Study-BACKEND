// Поднимает API на :3999, гоняет smoke-сценарии против реальной БД из .env и гасит сервер.
// Всё созданное (пользователи smoke_*@test.local, их прогресс, тестовые вопросы) удаляется в конце.
//   npm run test:smoke            — все этапы
//   node test/smoke/cleanup.js    — только почистить хвосты
const { spawn } = require('child_process');
const path = require('path');

const dir = path.resolve(__dirname, '../..');
const PORT = '3999';

const server = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', 'src/main.ts'], {
  cwd: dir,
  env: { ...process.env, PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

const stop = (code) => {
  server.kill();
  if (code !== 0) console.error('\n--- server log (tail) ---\n' + log.split('\n').slice(-30).join('\n'));
  process.exit(code);
};

(async () => {
  for (let i = 0; i < 90; i++) {
    try { await fetch(`http://localhost:${PORT}`); break; } catch { await new Promise((r) => setTimeout(r, 1000)); }
    if (i === 89) { console.error('server did not start'); stop(1); }
  }
  const test = spawn(process.execPath, [path.join(__dirname, 'smoke.js'), process.argv[2] || '5'], { cwd: dir, stdio: 'inherit' });
  test.on('exit', (code) => stop(code ?? 1));
})();
