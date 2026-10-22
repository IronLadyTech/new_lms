/**
 * CMS batch calendar → web LMS calendar.
 *
 * When a cms_batches doc changes, its sessions are written to the LMS `events`
 * collection for that batch (batchId = lmsGroupId, audience 'batch'), one event per
 * session, id `cms_<cmsBatchId>_<code>`. Sessions removed or cancelled in the CMS
 * are removed from the LMS calendar. Only rows this sync created (source 'cms') are
 * ever touched — events staff made by hand in the LMS are left alone.
 */
const SOURCE = 'cms';

function eventId(cmsBatchId, code) {
  return `cms_${cmsBatchId}_${String(code).replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

/** The LMS event for one CMS session — same fields the LMS calendar writes. */
function eventFor(batch, session) {
  return {
    title: session.title,
    description: [session.weekLabel, session.kind === 'optional' ? 'Optional' : '']
      .filter(Boolean)
      .join(' · '),
    date: String(session.date).slice(0, 10),
    time: session.startTime || '',
    endTime: session.endTime || '',
    type: 'session',
    imageUrl: '',
    linkUrl: session.joinLink || '',
    batchId: batch.lmsGroupId,
    batchName: batch.name || '',
    audience: 'batch',
    blocksStaff: true,
    source: SOURCE,
    cmsBatchId: batch.id,
    sessionCode: session.code,
    program: batch.program || 'LEP',
  };
}

const SAME_FIELDS = [
  'title',
  'description',
  'date',
  'time',
  'endTime',
  'linkUrl',
  'batchId',
  'batchName',
];

async function syncBatchCalendar(db, cmsBatchId, batch) {
  const existing = await db.collection('events').where('cmsBatchId', '==', cmsBatchId).get();
  const current = new Map(
    existing.docs.filter((d) => d.data()?.source === SOURCE).map((d) => [d.id, d.data()])
  );

  const wanted = new Map();
  if (batch && batch.lmsGroupId) {
    (Array.isArray(batch.sessions) ? batch.sessions : [])
      .filter((s) => s?.code && s?.date && s?.title && !s.cancelled)
      .forEach((s) =>
        wanted.set(eventId(cmsBatchId, s.code), eventFor({ ...batch, id: cmsBatchId }, s))
      );
  }

  const writer = db.batch();
  let writes = 0;
  const now = new Date();
  for (const [id, ev] of wanted) {
    const prev = current.get(id);
    if (prev && SAME_FIELDS.every((k) => (prev[k] || '') === (ev[k] || ''))) continue;
    writer.set(
      db.collection('events').doc(id),
      { ...ev, updatedAt: now, ...(prev ? {} : { createdAt: now }) },
      { merge: true }
    );
    writes += 1;
  }
  for (const id of current.keys()) {
    if (!wanted.has(id)) {
      writer.delete(db.collection('events').doc(id));
      writes += 1;
    }
  }
  if (writes) await writer.commit();
  return { written: writes, sessions: wanted.size };
}

module.exports = { syncBatchCalendar, eventFor, eventId };
