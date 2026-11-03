// Сценарии против живого сервера на :3999. Запуск: npm run test:smoke (см. run.js).
const path = require('path');
const dir = path.resolve(__dirname, '../..'), STAGE = Number(process.argv[2] || 5);
const r = (m) => require(require.resolve(m, { paths: [dir] }));
r('dotenv').config({ path: dir + '/.env', quiet: true });
const { Client } = r('pg');
const API = 'http://localhost:3999';
let token, fails = 0;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fails++; };
async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const cleanup = require('./cleanup.js');
const db = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await db.connect();
  const before = await cleanup(db); // хвосты от упавших прогонов
  if (before.users) console.log(`(removed ${before.users} leftover smoke users)`);
  const answerOf = async (id) => (await db.query('select "correctChoice" from questions where id=$1', [id])).rows[0].correctChoice;
  const wrongOf = async (id) => ((await answerOf(id)) === 'A' ? 'B' : 'A');
  const register = async (extra = {}) => {
    const reg = await call('POST', '/auth/register', { email: `smoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`, password: 'password123', fullName: 'Smoke', ...extra });
    token = reg.body.accessToken;
    return reg;
  };
  const reg = await register({ studyIntensity: 'NORMAL', timezone: 'Asia/Almaty', targetScore: 1400 });
  ok(reg.status === 201, 'register ' + reg.status);
  const userId = reg.body.user.id;

  const path = (await call('GET', '/study/path')).body;
  ok(path.nodes.length === 30 && path.nodes.every((n) => n.hasGrammarTab), 'path: 30 nodes, grammar on all');
  ok(path.nodes[1].grammarReinforcement === true && path.nodes[0].grammarReinforcement === false, 'level 2 grammar = reinforcement');
  ok(path.currentSequenceLevel === 1 && path.freeLevels === 5 && path.unlockedModules === 1, 'initial progress level 1, 1 module');

  const locked = await call('GET', '/study/level/2/math');
  ok(locked.status === 403 && locked.body.code === 'LEVEL_LOCKED', 'level 2 locked');

  // ---- level 1 math: one wrong, then all correct
  const m1 = (await call('GET', '/study/level/1/math')).body;
  ok(m1.quiz.length === 3 && m1.scenarios.length === 3 && !m1.quiz[0].correctChoice, 'level 1 math: 3 questions, 3 scenarios, no answers leaked');
  let res = await call('POST', '/study/level/1/math/answer', { questionId: m1.quiz[0].id, userAnswer: await wrongOf(m1.quiz[0].id) });
  ok(res.body.correct === false && res.body.explanation && res.body.xpGained === 0, 'wrong answer -> explanation, 0 xp');
  let queue = (await call('GET', '/mistakes/queue')).body;
  ok(queue.length === 1 && queue[0].questionId === m1.quiz[0].id, 'study mistake landed in mistake list');
  const other = (await db.query("select id from questions where domain='advanced_math' limit 1")).rows[0].id;
  res = await call('POST', '/study/level/1/math/answer', { questionId: other, userAnswer: 'A' });
  ok(res.status === 400, 'foreign question rejected (' + res.status + ')');
  let xpTotal = 0, last;
  for (const q of m1.quiz) { last = (await call('POST', '/study/level/1/math/answer', { questionId: q.id, userAnswer: await answerOf(q.id) })).body; xpTotal += last.xpGained; }
  ok(last.tabCompleted && !last.leveledUp, 'math tab completed, level not yet (grammar left)');
  const goalBonus = STAGE >= 3 ? 50 : 0; // day 1: goal = 1 lesson (nothing to review yet)
  ok(xpTotal === 10 + 10 + 20 + goalBonus, `xp: 2 first-try answers + lesson${goalBonus ? ' + goal bonus' : ''} = ${40 + goalBonus} (retry gives 0), got ` + xpTotal);
  queue = (await call('GET', '/mistakes/queue')).body;
  ok(queue.length === 1 && queue[0].correctStreak === 1, 'mistake still listed after 1 correct (needs 2 in a row)');

  // ---- level 1 grammar: 2 easier questions; make one mistake on it
  const g1 = (await call('GET', '/study/level/1/grammar')).body;
  const diffs = (await db.query('select difficulty from questions where id = any($1)', [g1.quiz.map((q) => q.id)])).rows.map((x) => x.difficulty).sort();
  ok(g1.quiz.length === 2 && !diffs.includes('HARD'), 'grammar part 1: 2 easier questions ' + diffs);
  await call('POST', '/study/level/1/grammar/answer', { questionId: g1.quiz[1].id, userAnswer: await wrongOf(g1.quiz[1].id) });
  for (const q of g1.quiz) last = (await call('POST', '/study/level/1/grammar/answer', { questionId: q.id, userAnswer: await answerOf(q.id) })).body;
  ok(last.leveledUp === true, 'level 1 complete -> leveledUp');

  // ---- level 2 grammar reinforcement: HARD question + mistake from part 1, short explanation
  const g2 = (await call('GET', '/study/level/2/grammar')).body;
  ok(g2.reinforcement === true && g2.scenarios.length === 1, 'reinforcement: 1 short scenario');
  ok(g2.quiz.length === 2 && g2.quiz.some((q) => q.fromMistakes && q.id === g1.quiz[1].id) && !g2.quiz.some((q) => !q.fromMistakes && g1.quiz.find((p) => p.id === q.id)),
    'reinforcement: no repeats of part 1 except own mistakes');

  if (STAGE >= 3) token = await require('./smoke3.js')({ call, ok, db, userId, answerOf, wrongOf, register, m1, g1 });
  if (STAGE >= 4) await require('./smoke4.js')({ call, ok, db, userId, answerOf, wrongOf, m1, g1 });
  if (STAGE >= 5) await require('./smoke-fill.js')({ call, ok, db, dir });

  // ---- paywall + module unlock
  await db.query('update study_path_progress set "currentSequenceLevel"=6 where "userId"=$1', [userId]);
  res = await call('GET', '/study/level/6/math');
  ok(res.status === 403 && res.body.code === 'SUBSCRIPTION_REQUIRED', 'level 6 without subscription -> SUBSCRIPTION_REQUIRED');
  await db.query('update users set "hasSubscription"=true where id=$1', [userId]);
  ok((await call('GET', '/study/level/6/math')).status === 200, 'level 6 with hasSubscription=true -> 200');
  const p = (await call('GET', '/study/path')).body;
  ok(p.completedModules === 1 && p.canUnlockNextModule === true, 'module 1 completed -> can unlock');
  res = await call('POST', '/study/modules/unlock');
  ok(res.status === 201 && res.body.unlockedModules === 2, 'unlock -> 2 modules');
  ok((await call('POST', '/study/modules/unlock')).status === 400, 'second unlock without finishing module 2 -> 400');
  const me = (await call('GET', '/users/me')).body;
  ok(me.xp >= 40 && me.studyIntensity === 'NORMAL' && me.timezone === 'Asia/Almaty' && me.targetScore === 1400, 'users/me: xp=' + me.xp + ', onboarding fields saved');
  ok(!('passwordHash' in me), 'no passwordHash leak');
  res = await call('PATCH', '/users/me', { studyIntensity: 'INTENSE', hasSubscription: false });
  ok(res.status === 400, 'PATCH users/me rejects hasSubscription (' + res.status + ')');
  res = await call('PATCH', '/users/me', { studyIntensity: 'INTENSE' });
  ok(res.status === 200 && res.body.studyIntensity === 'INTENSE', 'PATCH users/me intensity');

  // ---- old endpoints still alive
  ok((await call('GET', '/levels/progress')).status === 200 && (await call('GET', '/levels/daily-quota/today')).status === 200, 'old /levels endpoints still 200');

})()
  .catch((e) => { console.error(e); fails++; })
  .finally(async () => {
    // тест всегда убирает за собой: пользователи smoke_*, их прогресс и тестовый контент
    try {
      const removed = await cleanup(db);
      const left = (await db.query("select count(*)::int c from users where email like 'smoke\\_%@test.local'")).rows[0].c;
      console.log(`cleanup: removed ${removed.users} users, ${removed.questions} test questions; smoke users left: ${left}`);
      if (left !== 0) fails++;
    } catch (e) { console.error('cleanup failed', e); fails++; }
    await db.end().catch(() => {});
    console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
    process.exit(fails ? 1 : 0);
  });
