#!/usr/bin/env node
/**
 * IL Guide accuracy report.
 *
 *   node functions/ilGuide/eval/run.js            # template path (no OpenAI)
 *   OPENAI_API_KEY=... node functions/ilGuide/eval/run.js --llm
 *   node functions/ilGuide/eval/run.js --min 95   # exit 1 below 95% (deploy gate)
 *
 * Runs the live engine (generateWhisper) against the golden set and the generated
 * matrix with an in-memory Firestore, applies the same next-step override the app
 * does (services/ilGuide.js in app-new), and scores every message.
 */
const fs = require('fs');
const path = require('path');
const { generateWhisper } = require('../generator');
const golden = require('./scenarios/index');
const { buildMatrix } = require('./matrix');
const { scoreResult } = require('./checks');

const args = process.argv.slice(2);
const useLlm = args.includes('--llm');
const minIdx = args.indexOf('--min');
const minPct = minIdx >= 0 ? Number(args[minIdx + 1]) : null;
const jsonIdx = args.indexOf('--json');
const jsonPath = jsonIdx >= 0 ? args[jsonIdx + 1] : null;

/** Just enough of Firestore for rotation.js. */
function fakeDb() {
  const store = new Map();
  return {
    collection: (c) => ({
      doc: (id) => ({
        get: async () => {
          const v = store.get(`${c}/${id}`);
          return { exists: !!v, data: () => v };
        },
        set: async (data) => {
          store.set(`${c}/${id}`, { ...(store.get(`${c}/${id}`) || {}), ...data });
        },
      }),
    }),
  };
}

/** Mirrors the app: the card's button opens the open next task, whatever the server said. */
function appNextStep(result, ctx) {
  const dues = Array.isArray(ctx.dues) ? ctx.dues : Array.isArray(ctx.lepDues) ? ctx.lepDues : [];
  const nextOpen = ctx.nextTask?.id && !dues.some((d) => d?.taskId === ctx.nextTask.id && d.done);
  const openNextId = nextOpen ? ctx.nextTask.id : dues.find((d) => d && !d.done)?.taskId || null;
  if (openNextId) return { ...result, taskId: openNextId };
  if (result.taskId && dues.some((d) => d?.taskId === result.taskId && d.done)) {
    const { taskId: _drop, ...rest } = result;
    return rest;
  }
  return result;
}

async function runOne(scenario, apiKey) {
  const db = fakeDb();
  const raw = await generateWhisper(
    db,
    apiKey,
    process.env.OPENAI_MODEL || 'gpt-4o-mini',
    scenario.context
  );
  return appNextStep(raw, scenario.context);
}

function pct(n, d) {
  return d ? Math.round((n / d) * 1000) / 10 : 0;
}

async function main() {
  const apiKey = useLlm ? process.env.OPENAI_API_KEY || '' : '';
  if (useLlm && !apiKey) {
    console.error('--llm needs OPENAI_API_KEY in the environment.');
    process.exit(2);
  }

  const goldenRows = [];
  for (const s of golden) {
    const result = await runOne(s, apiKey);
    goldenRows.push({
      id: s.id,
      program: s.context.primaryProgram?.id,
      note: s.note,
      result,
      ...scoreResult(result, s.context, s.expect),
    });
  }
  const matrixRows = [];
  for (const s of buildMatrix()) {
    const result = await runOne(s, apiKey);
    matrixRows.push({
      id: s.id,
      result,
      ...scoreResult(result, s.context, s.expect, { golden: false }),
    });
  }

  const goldenPass = goldenRows.filter((r) => r.pass).length;
  const all = [...goldenRows, ...matrixRows];
  const invariantPass = all.filter(
    (r) => !r.failures.some((f) => !['job', 'nextStep', 'mentions', 'avoid'].includes(f.check))
  ).length;
  const byCheck = {};
  all.forEach((r) => r.failures.forEach((f) => (byCheck[f.check] = (byCheck[f.check] || 0) + 1)));

  const accuracy = pct(goldenPass, goldenRows.length);
  console.log(`\nIL Guide accuracy — ${useLlm ? 'AI path' : 'template path'}`);
  console.log('─'.repeat(60));
  console.log(
    `Golden scenarios (right step, tone, facts): ${goldenPass}/${goldenRows.length}  = ${accuracy}%`
  );
  for (const pid of ['lep', '100bm', 'mbw']) {
    const rows = goldenRows.filter((r) => r.program === pid);
    if (rows.length)
      console.log(
        `  ${pid.padEnd(6)} ${rows.filter((r) => r.pass).length}/${rows.length}  = ${pct(rows.filter((r) => r.pass).length, rows.length)}%`
      );
  }
  console.log(
    `Safety & facts on all ${all.length} messages:       ${invariantPass}/${all.length}  = ${pct(invariantPass, all.length)}%`
  );
  console.log('\nFailures by check:');
  Object.entries(byCheck)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${k.padEnd(20)} ${n}`));
  console.log('\nGolden scenarios that fail:');
  goldenRows
    .filter((r) => !r.pass)
    .forEach((r) => {
      console.log(`  ✗ ${r.id} — ${r.note}`);
      console.log(
        `      said: ${r.result.message}${r.result.taskId ? `  [button → ${r.result.taskId}]` : ''}`
      );
      r.failures.forEach((f) => console.log(`      · ${f.check}: ${f.reason}`));
    });
  const matrixFails = matrixRows.filter((r) => !r.pass);
  if (matrixFails.length) {
    console.log(
      `\nGenerated messages with a safety/fact failure (${matrixFails.length}), first 8:`
    );
    matrixFails.slice(0, 8).forEach((r) => {
      console.log(`  ✗ ${r.id}: ${r.failures.map((f) => f.reason).join('; ')}`);
      console.log(`      said: ${r.result.message}`);
    });
  }

  if (jsonPath) {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify({ accuracy, goldenRows, matrixRows }, null, 2));
  }
  if (minPct != null && accuracy < minPct) {
    console.log(`\nBelow the ${minPct}% gate.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
