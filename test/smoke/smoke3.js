// Stage 3: daily goal + streak. Called from smoke.js after level 1 is complete (2 lessons done today).
module.exports = async ({ call, ok, db, userId, register }) => {
  const dayStr = (offset) => {
    const d = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date()) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  let t = (await call('GET', '/progress/today', null, { 'X-Timezone': 'Asia/Almaty' })).body;
  ok(t.date === dayStr(0), 'day = local Almaty date ' + t.date);
  ok(t.goal.lessons.done === 2 && t.goal.lessons.target === 1, 'lessons 2/1 (math+grammar tabs of level 1)');
  ok(t.goal.review.target === 0, 'first day: nothing to review -> review target 0');
  ok(t.goal.minimumMet && t.goal.goalMet, 'minimum + goal met');
  ok(t.streak.current === 1 && t.streak.longest === 1 && t.streak.extendedToday && !t.streak.atRisk, 'streak = 1 after first lesson');
  ok(t.xpToday >= 50 && t.xp === t.xpToday, 'goal bonus counted in xp today (' + t.xpToday + ')');

  // ---- yesterday streak -> next day continues
  await db.query('update users set "currentStreak"=5, "longestStreak"=5, "lastStreakDate"=$2 where id=$1', [userId, dayStr(-1)]);
  await db.query('delete from daily_progress where "userId"=$1', [userId]);
  t = (await call('GET', '/progress/today')).body;
  ok(t.streak.current === 5 && t.streak.atRisk === true && !t.goal.minimumMet, 'new day: streak 5 at risk until something done');
  ok(t.goal.review.target === 5 && t.goal.lessons.done === 0, 'day 2: review target = min(10, pool=5: 3 math + 2 grammar part 1) -> ' + t.goal.review.target);
  ok(typeof t.streak.hoursLeftToday === 'number' && t.streak.hoursLeftToday <= 24, 'hoursLeftToday ' + t.streak.hoursLeftToday);

  // ---- 10 review answers alone extend the streak (minimum), no lesson needed
  // (review endpoints come in stage 4; simulate through the service contract by DB is not possible -> test there)

  // ---- missed day -> streak reset
  await db.query('update users set "currentStreak"=7, "lastStreakDate"=$2 where id=$1', [userId, dayStr(-3)]);
  t = (await call('GET', '/progress/today')).body;
  ok(t.streak.current === 0 && t.streak.longest === 5, 'missed days -> streak 0, longest kept');

  // ---- timezone header
  await call('GET', '/progress/today', null, { 'X-Timezone': 'Not/AZone' });
  let tz = (await db.query('select timezone from users where id=$1', [userId])).rows[0].timezone;
  ok(tz === 'Asia/Almaty', 'invalid X-Timezone ignored');
  await call('GET', '/progress/today', null, { 'X-Timezone': 'Asia/Tashkent' });
  tz = (await db.query('select timezone from users where id=$1', [userId])).rows[0].timezone;
  ok(tz === 'Asia/Tashkent', 'X-Timezone saved');
  await db.query("update users set timezone='Asia/Almaty' where id=$1", [userId]);

  // ---- intensity change recalculates today's goal
  let res = await call('PATCH', '/users/me', { studyIntensity: 'INTENSE' });
  t = (await call('GET', '/progress/today')).body;
  ok(t.goal.lessons.target === 2 && t.goal.review.target === 5, 'INTENSE -> 2 lessons + review');
  await call('PATCH', '/users/me', { studyIntensity: 'LIGHT' });
  t = (await call('GET', '/progress/today')).body;
  ok(t.goal.lessons.target === 1 && t.goal.review.target === 0, 'LIGHT -> 1 lesson, no review');
  await call('PATCH', '/users/me', { studyIntensity: 'NORMAL' });

  // ---- fresh LIGHT user, default timezone
  const tokenBackup = null;
  const r2 = await register({ studyIntensity: 'LIGHT' });
  t = (await call('GET', '/progress/today')).body;
  ok(t.studyIntensity === 'LIGHT' && t.timezone === 'Asia/Almaty' && t.streak.current === 0 && t.xp === 0, 'fresh user: XP 0, streak 0, default tz');
  // switch back to main user for the rest of the run
  const main = await db.query('select email from users where id=$1', [userId]);
  const login = await call('POST', '/auth/login', { email: main.rows[0].email, password: 'password123' });
  return login.body.accessToken;
};
