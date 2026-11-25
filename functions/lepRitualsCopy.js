/**
 * The 7:00 AM 5 Rituals message, one line per weekday, each on one ritual (Masterclass /
 * LEP: A-Game, Powerful Request, Mirror, Being Graceful, One critical action toward the BHAG).
 *
 * Voice for senior leaders (managers to CXOs, 15+ years): direct like a board brief, about
 * stakes and identity rather than the tool, respectful of her time, a peer and never a
 * cheerleader. No emojis, no exclamation marks. Title up to 40, body up to 80 characters.
 * {{name}} is her first name; when unknown, the "{{name}}, " opening is dropped.
 */
const BY_WEEKDAY = {
  // 0 = Sunday … 6 = Saturday (IST)
  1: ['Before your first meeting', '{{name}}, lead yourself before you lead the room. 5 Rituals, ten minutes.'],
  2: ['One bold ask today', 'Powerful Request: their need, your strength, your offer. Make it before noon.'],
  3: ['Your one critical move', 'Pick the one action that moves your BHAG today. The rest can wait.'],
  4: ['Mirror first, meetings after', 'Whole, complete and perfect. Say it, then walk in like you mean it.'],
  5: ['Who made your week work?', 'Acknowledge one person today. Graceful leaders are the ones people follow.'],
  6: ['Play your A-Game', '{{name}}, where were you at your best this week? Ten minutes will show you.'],
  0: ['Set up the week you want', 'Five rituals, ten minutes. This is how Monday starts in your favour.'],
};

const RITUALS_AM = 'RITUALS-AM';

function weekdayIst(day) {
  const d = new Date(`${String(day).slice(0, 10)}T12:00:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.getUTCDay();
}

function render(text, name) {
  const n = String(name || '').trim();
  if (!n || n.toLowerCase() === 'there') {
    return text.replace(/\{\{name\}\},\s*(\w)/, (_, c) => c.toUpperCase()).replace(/\{\{name\}\}/g, '').trim();
  }
  return text.replace(/\{\{name\}\}/g, n);
}

/** { title, body } for the morning rituals message on `day` (YYYY-MM-DD), or null for other rules. */
function ritualsCopy(eventCode, day, vars = {}) {
  if (eventCode !== RITUALS_AM) return null;
  const lines = BY_WEEKDAY[weekdayIst(day)];
  if (!lines) return null;
  return { title: lines[0], body: render(lines[1], vars.name) };
}

/** Where the morning message opens: the 5 Rituals tracker, not Home. */
const RITUALS_GO = { to: 'home', screen: 'RitualsDashboard' };

module.exports = { ritualsCopy, RITUALS_GO, BY_WEEKDAY, weekdayIst };
