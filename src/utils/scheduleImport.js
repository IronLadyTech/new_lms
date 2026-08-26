/**
 * Parse a pasted programme schedule into calendar sessions.
 *
 * The source is the schedule deck CX already works from — a table of
 * Day / Time / Date / Content / Deliverable. Copying that table out of a PDF or
 * a spreadsheet gives tab-separated cells, so that is what this reads, with a
 * fallback to runs of two or more spaces.
 *
 * Nothing here writes anything. It returns what it understood and what it could
 * not, so the panel can show both before a single event is created.
 */

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DAY_START = /^(mon|tues|wednes|thurs|fri|satur|sun)day\b/i;

/** "9:00am", "8:45 PM", "12:30pm" -> "09:00" (24h, for a time input). */
export function parseTime(raw) {
  const m = String(raw || '')
    .trim()
    .match(/^(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  const pm = m[3].toLowerCase() === 'p';
  if (pm && h !== 12) h += 12;
  if (!pm && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "9:00am to 12:00pm" / "8:00pm–8:45pm" -> { time, endTime }. */
export function parseTimeRange(raw) {
  const parts = String(raw || '').split(/\s*(?:to|–|—|-)\s*/i);
  if (parts.length < 2) return { time: parseTime(parts[0]), endTime: null };
  return { time: parseTime(parts[0]), endTime: parseTime(parts[1]) };
}

/**
 * "11th July", "01st Aug", "3rd Oct" -> ISO, using the programme year.
 *
 * A schedule that runs past December rolls into the next year, and the source
 * never says so — it just carries on to "09th Jan". Months earlier than the
 * programme's first month are therefore treated as the following year.
 */
export function parseScheduleDate(raw, { startYear, startMonth = 0 } = {}) {
  const m = String(raw || '')
    .trim()
    .match(/^(\d{1,2})\s*(?:st|nd|rd|th)?\s*([A-Za-z]{3,})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (month === undefined || day < 1 || day > 31) return null;

  const year = month < startMonth ? startYear + 1 : startYear;
  const d = new Date(year, month, day);
  // Rejects 31 April and friends, which Date would silently roll forward.
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** The first non-empty line of the Content cell is the session's name. */
function titleFromContent(content) {
  const first = String(content || '')
    .split(/\r?\n|•/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return first || '';
}

function splitCells(line) {
  if (line.includes('\t')) return line.split('\t');
  return line.split(/\s{2,}/);
}

/**
 * A row is not a line. Copying this table out of the deck gives a Content cell
 * that is a bullet list, so one session arrives spread over several lines. A
 * new record starts where a line begins with a day name; every other line
 * continues the record before it.
 */
function groupIntoRecords(text) {
  const records = [];
  String(text || '')
    .split(/\r?\n/)
    .forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      // A repeated header row, skipped rather than reported as a problem.
      if (/^day\b/i.test(trimmed) && /\bdate\b/i.test(trimmed)) return;

      if (DAY_START.test(trimmed) || records.length === 0) {
        records.push({ line: i + 1, parts: [trimmed] });
      } else {
        records[records.length - 1].parts.push(trimmed);
      }
    });
  return records;
}

/**
 * @param {string} text pasted rows
 * @param {{ startYear: number, startMonth?: number }} opts
 * @returns {{ sessions: object[], problems: {line: number, text: string, reason: string}[] }}
 */
export function parseSchedule(text, opts = {}) {
  const { startYear } = opts;
  const sessions = [];
  const problems = [];

  /*
   * The month the programme starts in decides which dates belong to the
   * following year — "09th Jan" after an August session is next January, not
   * a January eight months gone. Schedules are written in order, so the first
   * readable date gives it; a caller can still pass startMonth to override.
   */
  const startMonth =
    opts.startMonth ??
    (() => {
      for (const { parts } of groupIntoRecords(text)) {
        const cells = splitCells(parts[0]).map((c) => c.trim());
        const iso = parseScheduleDate(cells[2], { startYear, startMonth: 0 });
        if (iso) return Number(iso.slice(5, 7)) - 1;
      }
      return 0;
    })();

  groupIntoRecords(text).forEach(({ line, parts }) => {
    const head = parts[0];
    const cells = splitCells(head).map((c) => c.trim());

    if (cells.length < 3) {
      problems.push({ line, text: head, reason: 'Fewer than three columns' });
      return;
    }

    const [dayName, timeCell, dateCell] = cells;
    const tail = cells.slice(3);
    const contentCell = [tail[0] || '', ...parts.slice(1)].filter(Boolean).join('\n');
    const deliverableCell = tail.slice(1).join(' ');

    const date = parseScheduleDate(dateCell, { startYear, startMonth });
    if (!date) {
      problems.push({ line, text: head, reason: `Could not read the date "${dateCell}"` });
      return;
    }

    const { time, endTime } = parseTimeRange(timeCell);
    if (!time) {
      problems.push({ line, text: head, reason: `Could not read the time "${timeCell}"` });
      return;
    }

    const title = titleFromContent(contentCell);
    if (!title) {
      problems.push({ line, text: head, reason: 'No session name in the Content column' });
      return;
    }

    /*
     * The stated weekday is a free check on the year: if the deck says Saturday
     * and the date lands on a Tuesday, either the date is wrong or the year is.
     * Worth surfacing rather than importing something nobody will notice.
     */
    let warning = null;
    if (dayName && /^[A-Za-z]+$/.test(dayName)) {
      const actual = DAY_NAMES[(new Date(`${date}T12:00:00`).getDay() + 6) % 7];
      if (actual.toLowerCase() !== dayName.toLowerCase()) {
        warning = `Deck says ${dayName}, ${date} is a ${actual}`;
      }
    }

    /*
     * An end time at or before the start means the range crossed midnight —
     * almost always a typo for pm (the deck has "9:00am to 12:30am"). Flagged,
     * not silently corrected: only CX knows which was meant.
     */
    if (endTime && endTime <= time) {
      const note = `Ends before it starts (${time}–${endTime})`;
      warning = warning ? `${warning}. ${note}` : note;
    }

    sessions.push({
      date,
      time,
      endTime: endTime || '',
      title,
      description: [contentCell, deliverableCell ? `Deliverable: ${deliverableCell}` : '']
        .filter(Boolean)
        .join('\n\n'),
      type: 'class',
      warning,
    });
  });

  return { sessions, problems };
}

/** Sessions already on the batch calendar, matched on date + title. */
export function findDuplicates(sessions, existingEvents) {
  const seen = new Set(
    (existingEvents || []).map(
      (e) =>
        `${e.date}|${String(e.title || '')
          .trim()
          .toLowerCase()}`
    )
  );
  return sessions.filter((s) => seen.has(`${s.date}|${s.title.trim().toLowerCase()}`));
}
