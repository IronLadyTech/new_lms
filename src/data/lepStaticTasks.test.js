import { describe, it, expect } from 'vitest';
import { LEP_STATIC_TASKS } from './lepStaticTasks';
import { LEP_PROGRAM_SECTIONS } from './lepProgramStructure';
import { TASK_TYPES } from '../services/mbwService';

const SECTION_IDS = new Set(LEP_PROGRAM_SECTIONS.map((s) => s.id));

describe('LEP static tasks', () => {
  it('gives every task a unique id', () => {
    const ids = LEP_STATIC_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every task a unique order', () => {
    const orders = LEP_STATIC_TASKS.map((t) => t.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('places every task in a section that exists', () => {
    const orphans = LEP_STATIC_TASKS.filter((t) => !SECTION_IDS.has(t.phase));
    expect(orphans.map((t) => `${t.id} -> ${t.phase}`)).toEqual([]);
  });

  it('leaves no section empty', () => {
    const used = new Set(LEP_STATIC_TASKS.map((t) => t.phase));
    const empty = LEP_PROGRAM_SECTIONS.filter((s) => !used.has(s.id));
    expect(empty.map((s) => s.id)).toEqual([]);
  });

  it('uses only known task types', () => {
    const known = new Set(Object.values(TASK_TYPES));
    const bad = LEP_STATIC_TASKS.filter((t) => !known.has(t.type));
    expect(bad.map((t) => `${t.id}: ${t.type}`)).toEqual([]);
  });

  it('gives every checklist task at least one item', () => {
    const bad = LEP_STATIC_TASKS.filter(
      (t) => t.type === TASK_TYPES.CHECKLIST && !(t.checklistItems || []).length
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it('gives every upload task an accept list and a kind', () => {
    const bad = LEP_STATIC_TASKS.filter(
      (t) => t.type === TASK_TYPES.FILE_UPLOAD && (!t.accept || !t.uploadKind)
    );
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  it('gives every task a title and a description', () => {
    const bad = LEP_STATIC_TASKS.filter((t) => !t.title?.trim() || !t.description?.trim());
    expect(bad.map((t) => t.id)).toEqual([]);
  });

  /*
   * The session recordings are coming as YouTube links. A placeholder URL would
   * render a dead player, so blank is the honest state until the real ones land
   * — this guards against someone filling them with a guess.
   */
  it('carries no invented video URLs', () => {
    const guessed = LEP_STATIC_TASKS.filter(
      (t) => t.videoUrl && !/^https:\/\/(youtu\.be|www\.youtube\.com)\//.test(t.videoUrl)
    );
    expect(guessed.map((t) => `${t.id}: ${t.videoUrl}`)).toEqual([]);
  });

  it('points every resource link somewhere real', () => {
    const bad = [];
    LEP_STATIC_TASKS.forEach((t) => {
      (t.resourceLinks || []).forEach((r) => {
        if (!r.label?.trim()) bad.push(`${t.id}: link with no label`);
        // In-app paths and hosted templates both start with "/"; anything else
        // must be an absolute URL, never a bare filename or a TODO.
        if (!/^(\/|https:\/\/)/.test(r.url || '')) bad.push(`${t.id}: ${r.url}`);
      });
    });
    expect(bad).toEqual([]);
  });

  /*
   * A subtitle that says "6 lessons" over a section holding 5 is invented data,
   * and it drifts the moment a task is added or moved. Checked against the real
   * count rather than trusted.
   */
  it('states a lesson count that matches the section', () => {
    const counts = {};
    LEP_STATIC_TASKS.forEach((t) => {
      counts[t.phase] = (counts[t.phase] || 0) + 1;
    });
    const wrong = LEP_PROGRAM_SECTIONS.filter((s) => {
      const claimed = Number((s.subtitle.match(/^(\d+) lesson/) || [])[1]);
      return claimed !== (counts[s.id] || 0);
    }).map((s) => `${s.id}: says ${s.subtitle.split(' ')[0]}, has ${counts[s.id] || 0}`);
    expect(wrong).toEqual([]);
  });

  it('orders tasks consistently with their section order', () => {
    const sectionRank = new Map(LEP_PROGRAM_SECTIONS.map((s, i) => [s.id, i]));
    const byOrder = [...LEP_STATIC_TASKS].sort((a, b) => a.order - b.order);
    // Within one section, tasks must be contiguous in the ordered list.
    const seen = new Map();
    byOrder.forEach((t, i) => {
      if (!seen.has(t.phase)) seen.set(t.phase, { first: i, last: i });
      else seen.get(t.phase).last = i;
    });
    const interleaved = [...seen.entries()].filter(([phase, { first, last }]) => {
      const count = byOrder.filter((t) => t.phase === phase).length;
      return last - first + 1 !== count;
    });
    expect(interleaved.map(([p]) => p)).toEqual([]);
    expect(sectionRank.size).toBe(LEP_PROGRAM_SECTIONS.length);
  });
});
