import { describe, it, expect } from 'vitest';
import { LEP_STATIC_TASKS } from './lepStaticTasks';
import { LEP_PROGRAM_SECTIONS } from './lepProgramStructure';
import { TASK_TYPES } from '../services/mbwService';
import { getFormTemplate } from './formTemplates/registry';
import fs from 'node:fs';
import path from 'node:path';

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

describe('LEP worksheets are filled in on the page', () => {
  /*
   * Each of these was a download-fill-upload, or one text box over a PDF
   * worksheet. The worksheet's own questions and tables are now the form, and
   * the PDF stays as the resource beside it.
   */
  const WORKSHEETS = {
    'lep-prep-codesef-sheet': ['codesef', TASK_TYPES.FILE_UPLOAD],
    'lep-day1-beliefs': ['agame-beliefs', TASK_TYPES.TEXT],
    'lep-day2-relationships': ['key-relationships', TASK_TYPES.TEXT],
    'lep-day2-purpose-peg': ['purpose-peg', TASK_TYPES.TEXT],
    'lep-day4-roadmap': ['league-roadmap', TASK_TYPES.FILE_UPLOAD],
    'lep-day1-agame-table': ['agame-table', TASK_TYPES.CHECKLIST],
    'lep-day2-responding': ['responding', TASK_TYPES.CHECKLIST],
  };
  const byId = (id) => LEP_STATIC_TASKS.find((t) => t.id === id);

  it('turns each worksheet into its editable template', () => {
    Object.entries(WORKSHEETS).forEach(([id, [templateId]]) => {
      expect(byId(id).type, id).toBe(TASK_TYPES.EDITABLE_TEMPLATE);
      expect(byId(id).templateId, id).toBe(templateId);
    });
  });

  it('records what each one was, so answers sent before the change still show', () => {
    Object.entries(WORKSHEETS).forEach(([id, [, previousType]]) => {
      expect(byId(id).previousType, id).toBe(previousType);
    });
  });

  it('keeps the worksheet PDF as a resource', () => {
    Object.keys(WORKSHEETS).forEach((id) => {
      expect(byId(id).resourceLinks?.length, id).toBeGreaterThan(0);
    });
  });

  it('carries no upload settings on a worksheet that is no longer an upload', () => {
    Object.keys(WORKSHEETS).forEach((id) => {
      expect(byId(id).accept, id).toBeUndefined();
      expect(byId(id).uploadKind, id).toBeUndefined();
    });
  });

  it('names a registered template on every editable LEP task', () => {
    const missing = LEP_STATIC_TASKS.filter(
      (t) => t.type === TASK_TYPES.EDITABLE_TEMPLATE && !getFormTemplate(t.templateId)
    ).map((t) => `${t.id}: ${t.templateId}`);
    expect(missing).toEqual([]);
  });

  it('leaves the uploads that are not worksheets as uploads', () => {
    // The VIA report comes from an outside site, a resume is a document for
    // employers, and the Day 1 and Day 2 assignments have no questions on file.
    ['lep-via-survey', 'lep-resume-prepare', 'lep-day1-assignment', 'lep-day2-assignment'].forEach(
      (id) => expect(byId(id).type, id).toBe(TASK_TYPES.FILE_UPLOAD)
    );
  });
});

describe('LEP reading material is read in the lesson player', () => {
  const READING = {
    'lep-orientation-framework': 'lep-program-framework.pdf',
    'lep-orientation-access': 'program-access-essentials.pdf',
    'lep-day1-assignment': 'standard-affirmations.pdf',
    'lep-day4-roadmap-sample': 'league-roadmap-sample.pdf',
    'lep-day5-instructions': 'shameless-pitch-instructions.pdf',
    'lep-day6-guiding-stars': 'guiding-stars.pdf',
    'lep-prep-codesef-sheet': 'codesef-guidelines-template.pdf',
    'lep-day2-codesef': 'codesef-guidelines-template.pdf',
  };
  const byId = (id) => LEP_STATIC_TASKS.find((t) => t.id === id);

  it('gives each reading task its document', () => {
    Object.entries(READING).forEach(([id, file]) => {
      expect(byId(id).readingDocument?.url, id).toBe(`/templates/lep/${file}`);
      expect(byId(id).readingDocument?.label?.trim(), id).toBeTruthy();
    });
  });

  it('points every reading document at a file that exists', () => {
    const missing = LEP_STATIC_TASKS.filter((t) => t.readingDocument)
      .filter((t) => !fs.existsSync(path.join(process.cwd(), 'public', t.readingDocument.url)))
      .map((t) => `${t.id}: ${t.readingDocument.url}`);
    expect(missing).toEqual([]);
  });

  it('shows only page 1 of the CoDeSeF handout; the pages after it are the activity', () => {
    expect(byId('lep-prep-codesef-sheet').readingDocument.pages).toEqual([1]);
    expect(byId('lep-day2-codesef').readingDocument.pages).toEqual([1]);
  });

  it('does not also list a theory document as a download', () => {
    Object.entries(READING)
      .filter(([id]) => !id.includes('codesef'))
      .forEach(([id, file]) => {
        const links = (byId(id).resourceLinks || []).map((r) => r.url);
        expect(links, id).not.toContain(`/templates/lep/${file}`);
      });
  });

  it('asks for the 27 Principles and 5 Rituals videos to be watched', () => {
    expect(byId('lep-day3-27-principles').requiresWatch).toBe(true);
    expect(byId('lep-day3-5-rituals').requiresWatch).toBe(true);
  });
});
