/**
 * Generated coverage set: every program × payment × surface × next task, with
 * varied names, practice, performance segments and late joining. Scored on the
 * invariant checks only (facts, safety, length, voice) — there is no hand-written
 * answer for these, so they never test the next-step choice.
 */
const { PAY, PROGRAMS, ctx, practice, perf, lateJoin } = require('./scenarios/shared');

const SOURCES = {
  lep: require('./scenarios/lep'),
  '100bm': require('./scenarios/bm100'),
  mbw: require('./scenarios/mbw'),
};

const NAMES = ['Priya Sharma', 'Anita Rao', 'Dr. Meenakshi S. Narayanan', null, 'Fatima'];
const SURFACES = ['home', 'learn', 'community'];
const SEGMENTS = [undefined, 'at-risk', 'slipping', 'on-track', 'star'];
const LEP_PRACTICE = [null, practice(0, 2, 0), practice(3, 3, 14), practice(0, 0, 0, false)];

/** Up to four next tasks per program and payment (open ones for part-paid), plus "none". */
function nextTasksFor(pid, pay) {
  const { TASKS = {}, PAID_ONLY = [] } = SOURCES[pid];
  const all = Object.values(TASKS);
  const pool = pay === PAY.REGISTER ? all.filter((t) => !PAID_ONLY.includes(t.id)) : all;
  const step = Math.max(1, Math.floor(pool.length / 4));
  return [...pool.filter((_, i) => i % step === 0).slice(0, 4), null];
}

function buildMatrix() {
  const out = [];
  let i = 0;
  // Three passes so each combination is seen with different names, practice and segments.
  for (let pass = 0; pass < 3; pass += 1) {
    for (const program of [PROGRAMS.LEP, PROGRAMS.BM, PROGRAMS.MBW]) {
      for (const pay of [PAY.REGISTER, PAY.PAID]) {
        for (const surface of SURFACES) {
          for (const next of nextTasksFor(program.id, pay)) {
            i += 1;
            const isLep = program.id === 'lep';
            const pct = next ? (i * 7) % 95 : 100;
            const segment = SEGMENTS[i % SEGMENTS.length];
            const withEvent = i % 3 === 0;
            const late = i % 7 === 0;
            const due =
              next && i % 4 === 0
                ? [
                    {
                      taskId: next.id,
                      title: next.title,
                      done: false,
                      urgent: i % 8 === 0,
                      mandatory: late,
                    },
                  ]
                : undefined;
            const session = {
              nextSessionTitle: 'Progress Check',
              nextSessionWhen: 'Wed 5 Nov, 7:00 PM',
            };
            const context = ctx({
              uid: `m${i}`,
              surface,
              name: NAMES[i % NAMES.length],
              program,
              pay,
              pct,
              done: Math.round(pct / 5),
              firstLogin: i % 11 === 0,
              nextTask: next || undefined,
              dues: due,
              lepPractice: isLep ? LEP_PRACTICE[i % LEP_PRACTICE.length] || undefined : undefined,
              upcomingEvent: withEvent
                ? { id: `ev${i}`, title: 'Progress Check', body: 'Wed 5 Nov · 7:00 PM' }
                : undefined,
              ...(withEvent ? (isLep ? { lepBatch: session } : { batch: session }) : {}),
              performance: segment ? perf(segment) : undefined,
              enrollment: late ? lateJoin(9, ['Orientation']) : undefined,
            });
            out.push({
              id: `matrix-${i}-${program.id}-${pay}-${surface}${late ? '-late' : ''}`,
              context,
              expect: {
                lockedTaskIds: pay === PAY.REGISTER ? SOURCES[program.id].PAID_ONLY || [] : [],
              },
            });
          }
        }
      }
    }
  }
  return out;
}

module.exports = { buildMatrix };
