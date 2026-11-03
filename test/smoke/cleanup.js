// Удаляет всё, что создаёт smoke-тест: пользователей smoke_*@test.local со всем их прогрессом
// и тестовый контент (domain = 'smoke_domain', stem LIKE 'SMOKE_FILL%').
const SMOKE_EMAIL = 'smoke\\_%@test.local';

module.exports = async function cleanup(db) {
  await db.query('BEGIN');
  try {
    const users = (await db.query('select id from users where email like $1', [SMOKE_EMAIL])).rows.map((r) => r.id);
    const qs = (await db.query("select id from questions where domain = 'smoke_domain' or stem like 'SMOKE_FILL%'")).rows.map((r) => r.id);

    // ответы/ошибки по тестовым вопросам (у кого угодно) и всё, что принадлежит smoke-пользователям
    await db.query('delete from answer_logs where "userId" = any($1) or "questionId" = any($2)', [users, qs]);
    await db.query('delete from mistake_review_items where "userId" = any($1) or "questionId" = any($2)', [users, qs]);
    await db.query('delete from ai_interaction_logs where "userId" = any($1) or "questionId" = any($2)', [users, qs]);
    await db.query('delete from test_attempts where "userId" = any($1)', [users]);
    await db.query('delete from daily_progress where "userId" = any($1)', [users]);
    await db.query('delete from daily_quotas where "userId" = any($1)', [users]);
    await db.query('delete from user_level_progress where "userId" = any($1)', [users]);
    await db.query('delete from study_path_progress where "userId" = any($1)', [users]);
    const u = await db.query('delete from users where id = any($1)', [users]);

    await db.query('delete from questions where id = any($1)', [qs]);
    await db.query("delete from lesson_scenarios where domain = 'smoke_domain'");
    await db.query('COMMIT');
    return { users: u.rowCount, questions: qs.length };
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  }
};

// node test/smoke/cleanup.js — разовая чистка
if (require.main === module) {
  const dir = require('path').resolve(__dirname, '../..');
  const r = (m) => require(require.resolve(m, { paths: [dir] }));
  r('dotenv').config({ path: dir + '/.env', quiet: true });
  const { Client } = r('pg');
  (async () => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    console.log('cleaned', await module.exports(db));
    await db.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}
