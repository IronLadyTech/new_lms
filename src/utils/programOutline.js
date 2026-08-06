/**
 * Presentational grouping for the program outline (100BM + MBW).
 *
 * Task `week` values are ~1 per task (`Wk1`, `Wk2`, `Session 1`, `Prep 1`, `Wk1-12`…),
 * so grouping by the raw week label produces groups of one. Instead we bucket
 * consecutive numbered weeks into blocks of `blockSize` and let unnumbered rows
 * (`Session 3`, `Live`, `Networking`) ride along with the block they follow.
 *
 * Nothing here touches unlock rules or ordering — rows keep their engine order.
 */

const WEEK_NUMBER = /^wk\s*(\d+)$/i;

/** `'Wk7'` → 7. Returns null for `'Session 3'`, `'Prep 1'`, `'Wk1-12'`, … */
export function parseWeekNumber(week) {
  const match = WEEK_NUMBER.exec(String(week ?? '').trim());
  return match ? Number(match[1]) : null;
}

function ungrouped(taskStates) {
  return [{ id: 'all', label: null, taskStates }];
}

/**
 * @returns {Array<{ id: string, label: string|null, taskStates: any[] }>}
 *   A single label-less group when grouping would not help.
 */
export function buildLessonGroups(taskStates, { minToGroup = 10, blockSize = 4 } = {}) {
  const rows = Array.isArray(taskStates) ? taskStates : [];
  if (rows.length < minToGroup) return ungrouped(rows);

  const numbers = rows.map((ts) => parseWeekNumber(ts?.task?.week));
  const numbered = numbers.filter((n) => n !== null);
  // Mostly-unnumbered sections (MBW Pre-Preparation) have no week axis to bucket on.
  if (numbered.length < rows.length / 2) return ungrouped(rows);

  const base = Math.min(...numbered);
  const groups = [];
  let current = null;

  rows.forEach((ts, i) => {
    const n = numbers[i];
    if (n !== null) {
      const index = Math.floor((n - base) / blockSize);
      if (!current || current.index !== index) {
        current = { id: `weeks-${index}`, index, from: n, to: n, taskStates: [] };
        groups.push(current);
      } else {
        current.from = Math.min(current.from, n);
        current.to = Math.max(current.to, n);
      }
    } else if (!current) {
      current = { id: 'weeks-lead-in', index: -1, from: null, to: null, taskStates: [] };
      groups.push(current);
    }
    current.taskStates.push(ts);
  });

  if (groups.length < 2) return ungrouped(rows);

  return groups.map((group) => ({
    id: group.id,
    label: groupLabel(group),
    taskStates: group.taskStates,
  }));
}

function groupLabel(group) {
  if (group.from === null) return null;
  return group.from === group.to ? `Week ${group.from}` : `Weeks ${group.from}–${group.to}`;
}
