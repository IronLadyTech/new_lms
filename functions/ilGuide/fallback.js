const quotations = require('./quotations.json');

const STAFF_ROLES = new Set(['teacher', 'admin', 'moderator', 'superadmin']);

function programLabel(ctx) {
  const p = ctx.primaryProgram;
  if (!p) return 'your program';
  return p.code || p.title || 'your program';
}

function firstName(name) {
  if (!name) return null;
  return String(name).split(' ')[0];
}

function pickQuote(excludeId, offset = 0) {
  const pool = quotations.filter((q) => q.id !== excludeId);
  const list = pool.length ? pool : quotations;
  const idx = (Date.now() + offset) % list.length;
  return list[idx];
}

function generateFallback(ctx, job, lastId) {
  const name = firstName(ctx.name);
  const prog = programLabel(ctx);
  const pct = ctx.progressPercent ?? 0;
  const next = ctx.nextTask;
  const candidates = [];

  if (job === 'onboard') {
    const loc = ctx.location ? ` in ${ctx.location}` : '';
    const dom = ctx.domain ? `, coming from ${ctx.domain}` : '';
    const message = name
      ? `Welcome, ${name}. You're registered for ${prog}${loc}${dom}. First step: open Learn and complete your first task.`
      : `Welcome. You're registered for ${prog}. Open Learn and complete your first task when you're ready.`;
    return { id: 'onboard-1', message, job: 'onboard', source: 'fallback' };
  }

  if (job === 'nudge') {
    if (ctx.surface === 'home') {
      if (next && pct < 100) {
        candidates.push({
          id: `home-progress-${next.id}`,
          message: name
            ? `${name}, you're at ${Math.round(pct)}% in ${prog}. Next up: ${next.title}.`
            : `You're at ${Math.round(pct)}% in ${prog}. Next up: ${next.title}.`,
          job: 'nudge',
          source: 'fallback',
        });
      } else if (pct >= 100) {
        candidates.push({
          id: 'home-done',
          message: `${prog} tasks are complete. Check Engage for what's happening in your cohort.`,
          job: 'nudge',
          source: 'fallback',
        });
      }
      const quote = pickQuote(lastId);
      if (quote) {
        candidates.push({
          id: quote.id,
          message: `"${quote.text}" — ${quote.author}. Keep the momentum going in ${prog}.`,
          job: 'nudge',
          source: 'fallback',
        });
      }
    } else if (ctx.surface === 'community') {
      const quote = pickQuote(lastId, 1);
      if (quote) {
        candidates.push({
          id: `community-${quote.id}`,
          message: `"${quote.text}" — ${quote.author}. Share what you're applying from ${prog} in the feed.`,
          job: 'nudge',
          source: 'fallback',
        });
      }
      candidates.push({
        id: 'community-engage',
        message:
          'Your cohort is here. Post a win or a question — IL Guide keeps you moving, but the community carries you.',
        job: 'nudge',
        source: 'fallback',
      });
    } else {
      candidates.push({
        id: 'nudge-generic',
        message: 'Open Learn and take the next step in your program.',
        job: 'nudge',
        source: 'fallback',
      });
    }
  } else if (job === 'recommend') {
    if (next) {
      candidates.push({
        id: `learn-rec-${next.id}`,
        message: `Curated with your facilitators: start with "${next.title}" — it's the right next move in ${prog}.`,
        job: 'recommend',
        source: 'fallback',
      });
    } else {
      candidates.push({
        id: 'learn-all-done',
        message: `You've cleared the current ${prog} list. Revisit any task that needs improvement, or check Home for announcements.`,
        job: 'recommend',
        source: 'fallback',
      });
    }
  } else if (job === 'event') {
    const ev = ctx.upcomingEvent;
    if (ev) {
      const dateBit = ev.date ? ` on ${ev.date}` : '';
      candidates.push({
        id: `event-${ev.id}`,
        message: `Upcoming: ${ev.title}${dateBit}. Worth blocking time — it connects directly to ${prog}.`,
        job: 'event',
        source: 'fallback',
      });
    } else {
      candidates.push({
        id: 'event-none',
        message: `No events in your feed right now. Stay focused on ${prog} — the next session will show up here.`,
        job: 'event',
        source: 'fallback',
      });
    }
  }

  const fresh = candidates.filter((c) => c.id !== lastId);
  const pool = fresh.length ? fresh : candidates;
  if (pool.length) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return {
    id: 'fallback',
    message: 'Open Learn and take the next step in your program.',
    job: job || 'nudge',
    source: 'fallback',
  };
}

function resolveJob(ctx, endpointJob) {
  if (ctx.requestedJob) return ctx.requestedJob;
  if (ctx.firstLogin || endpointJob === 'onboard') return 'onboard';
  return endpointJob;
}

function resolveEndpointJob(ctx) {
  if (ctx.firstLogin) return 'onboard';
  if (ctx.surface === 'learn') return 'recommend';
  if (ctx.surface === 'home' && ctx.upcomingEvent) return 'event';
  return 'nudge';
}

function isBlockedRole(role) {
  if (!role || role === 'guest') return true;
  return STAFF_ROLES.has(role);
}

module.exports = {
  generateFallback,
  resolveJob,
  resolveEndpointJob,
  isBlockedRole,
  pickQuote,
};
