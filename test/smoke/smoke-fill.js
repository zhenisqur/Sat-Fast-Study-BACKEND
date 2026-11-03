// FILL-задачи: импортёр (в т.ч. переносы строк "\n") + выдача без ответов + проверка ответа по индексам.
// На входе основной пользователь прошёл уровень 1 (algebra 1 в пуле повторения).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const NL = '\n';

module.exports = async ({ call, ok, db, dir }) => {
  // ---- 1) importer: fill-урок в изолированном домене
  const lesson = {
    domain: 'smoke_domain', domainLevel: 1, topic: 'Smoke', sequenceLevel: 99, section: 'MATH',
    scenarios: [{ order: 1, title: 'T', content: 'C' }],
    quiz: [
      { kind: 'fill', orderInLevel: 1, difficulty: 'EASY', parts: ['3x + 7 = 22', NL, '3x =', null, NL, 'x =', null], options: ['5', '29', '15', '3'], answers: [2, 0],
        explain: { rule: '3x + 7 = 22', paragraphs: ['Вычитаем 7.', 'Делим на 3.'], examples: ['3 · 5 + 7 = 22'] } },
      { orderInLevel: 2, difficulty: 'HARD', stem: 'Choice?', choiceA: '1', choiceB: '2', choiceC: '3', choiceD: '4', correctChoice: 'c', explanation: 'Because.' },
      // перенос внутри текста (\r\n) + пробелы по краям -> импортёр разносит на отдельные элементы "\n"
      { kind: 'fill', orderInLevel: 3, difficulty: 'MEDIUM', parts: ['20% от 150\r\n20% =', null, NL, ' x = ', null], options: ['0.2', '30', '2'], answers: [0, 1],
        explain: { rule: 'Процент', paragraphs: ['p'] } },
    ],
  };
  const bad = { ...lesson, quiz: [{ ...lesson.quiz[0], answers: [2] }] };
  const badBreak = { ...lesson, quiz: [{ ...lesson.quiz[0], parts: [NL, '3x =', null, NL, NL, 'x =', null] }] };
  const tmp = path.join(os.tmpdir(), `smoke-lesson-${process.pid}.json`);
  const tmpBad = path.join(os.tmpdir(), `smoke-lesson-bad-${process.pid}.json`);
  const tmpBreak = path.join(os.tmpdir(), `smoke-lesson-break-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(lesson));
  fs.writeFileSync(tmpBad, JSON.stringify(bad));
  fs.writeFileSync(tmpBreak, JSON.stringify(badBreak));
  const run = (f) => execSync(`npx ts-node -r tsconfig-paths/register scripts/import-lesson.ts "${f}"`, { cwd: dir, stdio: 'pipe' }).toString();
  const failOutput = (f) => { try { run(f); return ''; } catch (e) { return String(e.stdout) + String(e.stderr); } };

  try {
    ok(/answers должен содержать 2/.test(failOutput(tmpBad)), 'importer rejects fill with wrong number of answers');
    const breakErr = failOutput(tmpBreak);
    ok(/начинаться с переноса/.test(breakErr) && /два переноса/.test(breakErr), 'importer rejects leading / double line breaks');

    run(tmp);
    const rows = (await db.query("select kind, stem, parts, options, answers, \"correctChoice\", explanation, \"explainRule\", \"explainParagraphs\" from questions where domain='smoke_domain' order by \"domainOrderInLevel\"")).rows;
    ok(rows.length === 3 && rows[0].kind === 'FILL' && rows[1].kind === 'CHOICE' && rows[2].kind === 'FILL', 'importer: FILL + CHOICE + FILL rows');
    ok(JSON.stringify(rows[0].parts) === JSON.stringify(['3x + 7 = 22', NL, '3x =', null, NL, 'x =', null]), 'line break stored as its own "\\n" element');
    ok(JSON.stringify(rows[2].parts) === JSON.stringify(['20% от 150', NL, '20% =', null, NL, 'x =', null]), 'embedded \\r\\n and spaces normalized: ' + JSON.stringify(rows[2].parts));
    ok(rows[0].stem === `3x + 7 = 22${NL}3x = ___${NL}x = ___` && rows[2].stem === `20% от 150${NL}20% = ___${NL}x = ___`, 'stem keeps line breaks');
    ok(JSON.stringify(rows[0].answers) === '[2,0]' && rows[0].correctChoice === null, 'fill: answers stored, no correctChoice');
    ok(rows[0].explanation.includes('Вычитаем 7.') && rows[0].explainRule === '3x + 7 = 22' && rows[0].explainParagraphs.length === 2, 'fill: structured explain + flat explanation');
    ok(rows[1].correctChoice === 'C', 'choice: correctChoice normalized');
    run(tmp);
    ok((await db.query("select count(*)::int c from questions where domain='smoke_domain'")).rows[0].c === 3, 'importer idempotent');
  } finally {
    for (const f of [tmp, tmpBad, tmpBreak]) fs.rmSync(f, { force: true });
  }

  // ---- 2) API: fill question inside a passed topic (algebra 1) -> appears in review
  const id = 'smoke-fill-' + Date.now();
  await db.query(`insert into questions (id, section, level, "orderInLevel", difficulty, kind, title, stem, parts, options, answers, explanation, "explainRule", "explainParagraphs", "explainExamples", domain, "domainLevel", "domainOrderInLevel")
    values ($1, 'MATH', 999, $2, 'EASY', 'FILL', 'Заполни пропуски', 'SMOKE_FILL 3x = ___', $3, $4, $5, 'flat', 'rule', $6, $7, 'algebra', 1, 99)`,
    [id, Math.floor(Math.random() * 1e6), JSON.stringify(['3x =', null, NL, 'x =', null]), JSON.stringify(['5', '15', '3']), JSON.stringify([1, 0]), JSON.stringify(['p1']), JSON.stringify(['e1'])]);

  let found = null;
  for (let i = 0; i < 5 && !found; i++) found = (await call('GET', '/review/session')).body.questions.find((q) => q.id === id);
  ok(found && found.kind === 'FILL' && Array.isArray(found.parts) && found.options.length === 3, 'review returns FILL with parts/options');
  ok(found && found.parts[2] === NL, 'API returns the "\\n" part as-is');
  ok(found && !('answers' in found) && !('correctChoice' in found), 'FILL answers not leaked');

  let res = await call('POST', '/review/answer', { questionId: id, userAnswer: 'A' });
  ok(res.status === 400, 'FILL with userAnswer (letter) -> 400');
  res = await call('POST', '/review/answer', { questionId: id, userAnswers: [1] });
  ok(res.status === 400, 'FILL with wrong number of gaps -> 400');
  res = await call('POST', '/review/answer', { questionId: id, userAnswers: [0, 1] });
  ok(res.body.correct === false && JSON.stringify(res.body.correctAnswers) === '[1,0]' && res.body.correctChoice === null && res.body.explain.rule === 'rule' && res.body.explain.paragraphs[0] === 'p1',
    'FILL wrong -> correctAnswers + structured explain');
  res = await call('POST', '/review/answer', { questionId: id, userAnswers: [1, 0] });
  ok(res.body.correct === true && res.body.correctAnswers === null && res.body.explain === null, 'FILL right -> correct, nothing revealed');
  const log = (await db.query('select "userAnswer" from answer_logs where "questionId"=$1 order by "createdAt" desc limit 1', [id])).rows[0];
  ok(log.userAnswer === '[1,0]', 'AnswerLog stores FILL answer as JSON');

  // CHOICE still works with letters, and shape is validated
  const choice = (await call('GET', '/review/session')).body.questions.find((q) => q.kind === 'CHOICE');
  res = await call('POST', '/review/answer', { questionId: choice.id, userAnswers: [0] });
  ok(res.status === 400, 'CHOICE with userAnswers -> 400');
};
