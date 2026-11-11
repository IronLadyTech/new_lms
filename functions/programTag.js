/**
 * The programme at the start of every batch reminder's title — "LEP · Day 1 starts in 15
 * minutes" — so a learner in more than one programme knows which one it is about. The title
 * is the part every phone shows, even when the rest is cut off.
 */
const TAGS = { lep: 'LEP', '100bm': '100BM', bm100: '100BM', mbw: 'MBW' };

function programTag(program) {
  const key = String(program || 'LEP').toLowerCase().replace(/[\s_-]+/g, '');
  return TAGS[key] || 'LEP';
}

/** "LEP · <title>", unless the title already names the programme. */
function withProgram(program, title) {
  const tag = programTag(program);
  const t = String(title || '').trim();
  if (!t) return tag;
  if (t.toUpperCase().startsWith(tag)) return t;
  return `${tag} · ${t}`;
}

module.exports = { programTag, withProgram };
