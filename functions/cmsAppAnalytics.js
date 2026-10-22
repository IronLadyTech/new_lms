/**
 * App analytics for the CMS — one batch, or a whole program.
 *
 * Reads what the app records (app_activity/{uid} and its days/ and videos/ rows,
 * written by app-new services/activityTracking.js) for the learners of each batch.
 * Returns counts, a 14-day trend and a short "needs attention" list with first
 * names only — never phone numbers or emails.
 */
const { HttpsError } = require('firebase-functions/v2/https');
const { learnersForBatch } = require('./cmsBatchLearners');
const { payment, isLateJoiner } = require('./learnerSegments');

const CMS_STAFF = ['admin', 'superadmin', 'pl', 'cem', 'moderator'];
const DAYS = 14;

function istDay(ms) {
  return new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayList(todayIso, n) {
  const out = [];
  const base = Date.parse(`${todayIso}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i -= 1)
    out.push(new Date(base - i * 86400000).toISOString().slice(0, 10));
  return out;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

async function learnerActivity(db, uid, fromDay) {
  const ref = db.collection('app_activity').doc(uid);
  const [summary, days, videos] = await Promise.all([
    ref.get(),
    ref.collection('days').where('day', '>=', fromDay).get(),
    ref.collection('videos').get(),
  ]);
  return {
    summary: summary.exists ? summary.data() : null,
    days: days.docs.map((d) => d.data()),
    videos: videos.docs.map((d) => d.data()),
  };
}

async function runCmsAppAnalytics(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  const me = await db.collection('users').doc(uid).get();
  if (!CMS_STAFF.includes(me.data()?.role))
    throw new HttpsError('permission-denied', 'Staff CMS access required');

  const program = String(request.data?.program || 'lep').toLowerCase();
  const batchId = String(request.data?.batchId || '').trim();
  const programLabel = { lep: 'LEP', '100bm': '100BM', mbw: 'MBW' }[program] || 'LEP';

  let batches;
  if (batchId) {
    const snap = await db.collection('cms_batches').doc(batchId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'No such batch');
    batches = [{ id: snap.id, ...snap.data() }];
  } else {
    const snap = await db.collection('cms_batches').where('program', '==', programLabel).get();
    batches = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.lmsGroupId);
  }

  const today = istDay(Date.now());
  const trendDays = dayList(today, DAYS);
  const fromDay = trendDays[0];
  const weekFrom = trendDays[DAYS - 7];

  const trend = Object.fromEntries(
    trendDays.map((d) => [d, { day: d, active: 0, practice: 0, videos: 0, joins: 0 }])
  );
  const totals = {
    learners: 0,
    openedApp: 0,
    activeToday: 0,
    active7d: 0,
    away5plus: 0,
    practicing7d: 0,
    practiceDays7: 0,
    videosStarted: 0,
    videosFinished: 0,
    joins7d: 0,
  };
  const perBatch = [];
  const attention = [];
  const seenUids = new Set();

  for (const batch of batches) {
    const learners = await learnersForBatch(db, batch);
    const row = {
      batchId: batch.id,
      name: batch.name,
      learners: 0,
      openedApp: 0,
      active7d: 0,
      practicing7d: 0,
    };
    for (const { uid: learnerUid, data } of learners) {
      if (seenUids.has(learnerUid)) continue;
      seenUids.add(learnerUid);
      const act = await learnerActivity(db, learnerUid, fromDay);
      const opened = Boolean(act.summary?.firstSeenAt || act.summary?.lastActiveDay);
      const last = act.summary?.lastActiveDay || null;
      const activeDays7 = new Set(
        act.days
          .filter((d) => d.day >= weekFrom && (d.opens || d.practice?.length || d.videos?.length))
          .map((d) => d.day)
      );
      const practiceDays7 = act.days.filter((d) => d.day >= weekFrom && d.practice?.length).length;
      const joins7 = act.days
        .filter((d) => d.day >= weekFrom)
        .reduce((n, d) => n + (d.joins?.length || 0), 0);

      totals.learners += 1;
      row.learners += 1;
      if (opened) {
        totals.openedApp += 1;
        row.openedApp += 1;
      }
      if (last === today) totals.activeToday += 1;
      if (activeDays7.size) {
        totals.active7d += 1;
        row.active7d += 1;
      }
      if (practiceDays7) {
        totals.practicing7d += 1;
        row.practicing7d += 1;
      }
      totals.practiceDays7 += practiceDays7;
      totals.joins7d += joins7;
      totals.videosStarted += act.videos.length;
      totals.videosFinished += act.videos.filter((v) => v.completed || v.milestones?.['90']).length;
      act.days.forEach((d) => {
        const t = trend[d.day];
        if (!t) return;
        if (d.opens || d.practice?.length || d.videos?.length) t.active += 1;
        t.practice += d.practice?.length ? 1 : 0;
        t.videos += d.videos?.length ? 1 : 0;
        t.joins += d.joins?.length || 0;
      });

      const daysAway = last ? daysBetween(last, today) : null;
      if (!opened || daysAway >= 5) {
        if (opened) totals.away5plus += 1;
        const name = String(data.displayName || data.firstName || data.name || 'Learner').split(
          ' '
        )[0];
        attention.push({
          name,
          batch: batch.name,
          status: opened ? `Away ${daysAway} days` : 'Has not opened the app',
          lastActive: last,
          payment:
            payment(data, batch.program) === 'paid'
              ? 'Full paid'
              : payment(data, batch.program) === 'register'
                ? 'Part paid'
                : '',
          late: isLateJoiner(data, batch),
        });
      }
    }
    perBatch.push(row);
  }

  attention.sort((a, b) => (a.lastActive || '').localeCompare(b.lastActive || ''));
  return {
    program,
    batchId: batchId || null,
    today,
    totals: {
      ...totals,
      notOpened: totals.learners - totals.openedApp,
      avgPracticeDays7: totals.learners
        ? Math.round((totals.practiceDays7 / totals.learners) * 10) / 10
        : 0,
    },
    trend: trendDays.map((d) => trend[d]),
    perBatch,
    attention: attention.slice(0, 50),
    attentionTotal: attention.length,
  };
}

module.exports = { runCmsAppAnalytics };
