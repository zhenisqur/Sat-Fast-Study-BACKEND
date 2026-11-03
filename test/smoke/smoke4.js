// Stage 4: review. State on entry: level 1 passed (pool = 3 math + 2 grammar part 1 = 5),
// 2 unresolved mistakes with correctStreak=1 (m1.quiz[0], g1.quiz[1]); today: 0 lessons, review target 5,
// streak 0 with lastStreakDate 3 days ago.
module.exports = async ({ call, ok, db, userId, answerOf, wrongOf, m1, g1 }) => {
  const poolIds = new Set([...m1.quiz.map((q) => q.id), ...g1.quiz.map((q) => q.id)]);
  const mistakeIds = [m1.quiz[0].id, g1.quiz[1].id];

  let s = (await call('GET', '/review/session')).body;
  ok(s.size === 5 && s.questions.every((q) => poolIds.has(q.id)), 'session: 5 questions, all from passed level 1');
  ok(s.questions.slice(0, 2).every((q) => q.reason === 'MISTAKE' && mistakeIds.includes(q.id)), 'mistakes come first');
  ok(s.questions.every((q) => !('correctChoice' in q)) && s.sessionNumberToday === 1 && s.fullXp, 'no answers leaked, session #1, full XP');

  const locked = (await db.query("select id from questions where domain='advanced_math' limit 1")).rows[0].id;
  ok((await call('POST', '/review/answer', { questionId: locked, userAnswer: 'A' })).status === 400, 'question from a not-passed topic -> 400');

  let xp = 0, last;
  for (const q of s.questions) {
    last = (await call('POST', '/review/answer', { questionId: q.id, userAnswer: await answerOf(q.id) })).body;
    xp += last.xpGained;
    if (mistakeIds.includes(q.id)) ok(last.mistakeResolved === true, 'mistake resolved after 2nd correct in a row');
  }
  ok(xp === 25, 'review xp 5 x 5 = 25, got ' + xp);
  ok((await call('GET', '/mistakes/queue')).body.length === 0, 'mistake list empty');
  let t = (await call('GET', '/progress/today')).body;
  ok(t.goal.review.done === 5 && !t.goal.minimumMet && t.streak.current === 0, 'review 5/5 counted; minimum (1 lesson OR 10 review) not yet');

  // sessions 2 and 3 -> 3rd one gets capped XP
  await call('GET', '/review/session');
  s = (await call('GET', '/review/session')).body;
  ok(s.sessionNumberToday === 3 && s.fullXp === false, 'session #3 -> capped XP');
  // one wrong answer -> back into mistakes
  const wrongQ = s.questions[0].id;
  last = (await call('POST', '/review/answer', { questionId: wrongQ, userAnswer: await wrongOf(wrongQ) })).body;
  ok(last.correct === false && last.explanation && last.xpGained === 0, 'wrong review answer -> explanation, 0 xp');
  const q = (await call('GET', '/mistakes/queue')).body;
  ok(q.length === 1 && q[0].questionId === wrongQ && q[0].correctStreak === 0, 'wrong review answer back in mistake list');

  xp = 0;
  for (const item of s.questions.slice(1)) { last = (await call('POST', '/review/answer', { questionId: item.id, userAnswer: await answerOf(item.id) })).body; xp += last.xpGained; }
  ok(xp === 4, 'capped xp 1 x 4 = 4, got ' + xp);
  t = (await call('GET', '/progress/today')).body;
  ok(t.goal.review.done === 10 && t.goal.minimumMet && t.streak.current === 1 && !t.goal.goalMet, '10 review answers alone extend the streak (goal still needs the lesson)');
  ok(last.daily && last.daily.streakExtended === true, 'answer response reports streakExtended');

  // nothing passed -> empty session, does not count as a session
  const reg = await call('POST', '/auth/register', { email: `smoke_empty_${Date.now()}@test.local`, password: 'password123', fullName: 'Empty' });
  const empty = await fetch('http://localhost:3999/review/session', { headers: { Authorization: 'Bearer ' + reg.body.accessToken } }).then((r) => r.json());
  ok(empty.nothingToReview === true && empty.size === 0 && empty.sessionNumberToday === 0, 'new user: nothing to review');
};
