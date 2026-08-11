import { DELTA_COLUMNS, DELTA_TIMELINES, DELTA_TEMPLATE_ID } from '../deltaTableTemplate';
import { ERRC_COLUMNS, ERRC_DEFAULT_TASKS } from '../errcTemplate';
import {
  STRATEGY_FULL_SECTIONS,
  STRATEGY_PROBLEM_SECTIONS,
  createStrategyFields,
  isStrategyComplete,
} from './strategySections';

export const TEMPLATE_IDS = {
  DELTA: DELTA_TEMPLATE_ID,
  ERRC: 'errc',
  SUPER_POWER: 'super-power',
  THEME: 'theme',
  BELL_CURVE: 'bell-curve',
  BELL_CURVE_GAME_PLAN: 'bell-curve-game-plan',
  CORE_BRAND_STORY: 'core-brand-story',
  BRAND_VIDEO_SCRIPT: 'brand-video-script',
  CSUITE_STORIES: 'csuite-stories',
  PITCH: 'pitch',
  STRATEGY_PROBLEM: 'strategy-problem',
  STRATEGY: 'strategy',
};

/** @typedef {'grid'|'fields'} FormTemplateType */

/**
 * @typedef {Object} FormTemplateDefinition
 * @property {FormTemplateType} type
 * @property {string} [submitLabel]
 * @property {Array<{ key: string, label: string, hint?: string, type?: string, options?: string[], required?: boolean, rows?: number, section?: string }>} [fields]
 * @property {Array<{ key: string, label: string }>} [columns]
 * @property {string[]} [rowLabels]
 * @property {number} [rowCount]
 * @property {(index: number) => string} [rowLabel]
 * @property {string} [rowKey]
 * @property {() => Record<string, string>} [createFields]
 * @property {(fields: Record<string, string>, variant?: string) => boolean} [isComplete]
 */

/** @type {Record<string, FormTemplateDefinition>} */
export const FORM_TEMPLATES = {
  [TEMPLATE_IDS.DELTA]: {
    type: 'grid',
    rowKey: 'timeline',
    rowLabels: DELTA_TIMELINES,
    columns: DELTA_COLUMNS.map((col) => ({ key: col.key, label: col.label })),
  },
  [TEMPLATE_IDS.ERRC]: {
    type: 'grid',
    rowKey: 'activity',
    rowLabels: ERRC_DEFAULT_TASKS,
    columns: ERRC_COLUMNS.map((col) => ({ key: col, label: col })),
  },
  [TEMPLATE_IDS.SUPER_POWER]: {
    type: 'grid',
    rowCount: 4,
    rowLabel: (index) => `Superpower ${index + 1}`,
    rowKey: 'row',
    columns: [
      { key: 'superpower', label: 'Superpowers' },
      { key: 'actions', label: 'Key actions to use in current scenario' },
    ],
    submitLabel: 'Submit super power table',
  },
  [TEMPLATE_IDS.THEME]: {
    type: 'grid',
    rowCount: 4,
    rowLabel: (index) => `Theme ${index + 1}`,
    rowKey: 'row',
    columns: [
      { key: 'theme', label: 'Theme' },
      { key: 'objective', label: 'Objective / focus' },
      { key: 'actions', label: 'Key actions' },
    ],
    submitLabel: 'Submit theme table',
  },
  [TEMPLATE_IDS.BELL_CURVE]: {
    type: 'fields',
    submitLabel: 'Submit worksheet',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, section: 'Your details' },
      {
        key: 'batch',
        label: 'Batch / cohort',
        type: 'text',
        required: true,
        section: 'Your details',
      },
      { key: 'date', label: 'Date', type: 'text', required: true, section: 'Your details' },
      {
        key: 'position',
        label: 'My position in the Bell Curve',
        type: 'radio',
        options: ['Flyer', 'Follower', 'Flanker', 'Fringe'],
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'why',
        label: 'Why do I believe I am in this position?',
        type: 'textarea',
        hint: 'Brief explanation in 2–3 lines.',
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'action',
        label: '1 action I will take to move forward or strengthen my position',
        type: 'textarea',
        hint: 'One clear action in the next 7–14 days.',
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'outcome',
        label: 'Expected outcome',
        type: 'textarea',
        hint: 'What change or improvement do you expect after taking this action?',
        required: true,
        section: 'Bell curve',
      },
    ],
  },
  [TEMPLATE_IDS.BELL_CURVE_GAME_PLAN]: {
    type: 'fields',
    submitLabel: 'Submit game plan',
    fields: [
      {
        key: 'position',
        label: 'My position in the Bell Curve',
        type: 'radio',
        options: ['Flyer', 'Follower', 'Flanker', 'Fringe'],
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'why',
        label: 'Why I am in this position',
        type: 'textarea',
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'action',
        label: 'Action to move forward',
        type: 'textarea',
        required: true,
        section: 'Bell curve',
      },
      {
        key: 'gamePlan',
        label: 'C-Suite game plan',
        type: 'textarea',
        hint: 'Your game plan based on your current situation.',
        required: true,
        section: 'Game plan',
        rows: 6,
      },
    ],
  },
  [TEMPLATE_IDS.CORE_BRAND_STORY]: {
    type: 'fields',
    submitLabel: 'Submit core stories',
    fields: [
      {
        key: 'story1Title',
        label: 'Core story 1 — title / heading',
        type: 'text',
        required: true,
        section: 'Core story 1',
      },
      {
        key: 'story1Body',
        label: 'Core story 1 — full story',
        type: 'textarea',
        required: true,
        section: 'Core story 1',
        rows: 5,
      },
      {
        key: 'story2Title',
        label: 'Core story 2 — title / heading',
        type: 'text',
        required: true,
        section: 'Core story 2',
      },
      {
        key: 'story2Body',
        label: 'Core story 2 — full story',
        type: 'textarea',
        required: true,
        section: 'Core story 2',
        rows: 5,
      },
    ],
  },
  [TEMPLATE_IDS.BRAND_VIDEO_SCRIPT]: {
    type: 'fields',
    submitLabel: 'Submit video script',
    fields: [
      {
        key: 'introName',
        label: 'Introduction — name',
        type: 'text',
        placeholder: "Hi, I'm …",
        required: true,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'specialistRole',
        label: 'I am … (specialist / role)',
        type: 'text',
        required: true,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'coreValueAdd',
        label: 'I support orgs / people in … (core value add)',
        type: 'textarea',
        required: true,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'functionFocus',
        label: 'While most … (your function) people focus on …',
        type: 'textarea',
        required: true,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'specialization',
        label: 'I specialize in … (key differentiation)',
        type: 'textarea',
        required: true,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'awardsCredentials',
        label: 'Awards, certificates, top companies (optional)',
        type: 'textarea',
        required: false,
        section: 'Part 1 — Introduction',
      },
      {
        key: 'story1',
        label: 'Story 1 — year, heading, numbers, villain + credibility',
        type: 'textarea',
        required: true,
        section: 'Part 2 — Key stories',
        rows: 4,
      },
      {
        key: 'story2',
        label: 'Story 2 — year, heading, villain + credibility',
        type: 'textarea',
        required: true,
        section: 'Part 2 — Key stories',
        rows: 4,
      },
      {
        key: 'story3',
        label: 'Story 3 (optional)',
        type: 'textarea',
        required: false,
        section: 'Part 2 — Key stories',
        rows: 3,
      },
      {
        key: 'experience',
        label: 'Companies / situations and methodology mastered',
        type: 'textarea',
        required: true,
        section: 'Part 3 — Future vision',
        rows: 4,
      },
      {
        key: 'futureMission',
        label: 'I look forward to … (future / mission / contribution)',
        type: 'textarea',
        required: true,
        section: 'Part 3 — Future vision',
        rows: 3,
      },
    ],
  },
  [TEMPLATE_IDS.CSUITE_STORIES]: {
    type: 'fields',
    submitLabel: 'Submit stories',
    fields: [1, 2, 3].flatMap((n) => [
      {
        key: `story${n}Title`,
        label: `Story ${n} — title / heading`,
        type: 'text',
        required: true,
        section: `Story ${n}`,
      },
      {
        key: `story${n}Body`,
        label: `Story ${n} — accomplishment narrative`,
        type: 'textarea',
        required: true,
        section: `Story ${n}`,
        rows: 5,
      },
    ]),
  },
  [TEMPLATE_IDS.PITCH]: {
    type: 'fields',
    submitLabel: 'Submit pitch document',
    fields: [
      {
        key: 'scenario',
        label: 'Scenario',
        type: 'textarea',
        required: true,
        section: 'Pitch framework',
        rows: 4,
      },
      {
        key: 'threatOrOpportunity',
        label: 'Threat / opportunity',
        type: 'textarea',
        required: true,
        section: 'Pitch framework',
        rows: 4,
      },
      {
        key: 'solution',
        label: 'Solution',
        type: 'textarea',
        required: true,
        section: 'Pitch framework',
        rows: 4,
      },
      {
        key: 'credibility',
        label: 'Credibility',
        type: 'textarea',
        required: true,
        section: 'Pitch framework',
        rows: 4,
      },
    ],
  },
  [TEMPLATE_IDS.STRATEGY_PROBLEM]: {
    type: 'fields',
    submitLabel: 'Submit strategy problem statement',
    createFields: () => createStrategyFields(STRATEGY_PROBLEM_SECTIONS),
    isComplete: (fields) => isStrategyComplete(fields, STRATEGY_PROBLEM_SECTIONS),
    fields: STRATEGY_PROBLEM_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      type: 'textarea',
      hint: section.hint,
      required: section.required !== false,
      section: 'Strategy — problem statement (first 5 points)',
      rows: 4,
    })),
  },
  [TEMPLATE_IDS.STRATEGY]: {
    type: 'fields',
    submitLabel: 'Submit strategy document',
    createFields: () => createStrategyFields(STRATEGY_FULL_SECTIONS),
    isComplete: (fields) => isStrategyComplete(fields, STRATEGY_FULL_SECTIONS),
    fields: STRATEGY_FULL_SECTIONS.map((section) => ({
      key: section.key,
      label: section.label,
      type: 'textarea',
      hint: section.hint,
      required: section.required !== false,
      section: 'Strategy document',
      rows: 4,
    })),
  },
};

export function getFormTemplate(templateId) {
  return FORM_TEMPLATES[templateId] || null;
}

export function createGridRows(definition) {
  if (definition.rowLabels?.length) {
    const rowKey = definition.rowKey || 'label';
    return definition.rowLabels.map((label) => {
      const row = { [rowKey]: label };
      definition.columns.forEach((col) => {
        row[col.key] = '';
      });
      return row;
    });
  }

  const count = definition.rowCount || 0;
  return Array.from({ length: count }, (_, index) => {
    const rowKey = definition.rowKey || 'row';
    const row = {
      [rowKey]: definition.rowLabel ? definition.rowLabel(index) : `Row ${index + 1}`,
    };
    definition.columns.forEach((col) => {
      row[col.key] = '';
    });
    return row;
  });
}

export function isGridComplete(rows = [], definition) {
  if (!rows.length || !definition?.columns?.length) return false;
  return rows.every((row) =>
    definition.columns.every((col) => String(row[col.key] || '').trim().length > 0)
  );
}

export function createTemplateFields(templateId) {
  const def = getFormTemplate(templateId);
  if (!def) return {};
  if (def.createFields) return def.createFields();
  if (!def.fields) return {};
  return Object.fromEntries(def.fields.map((field) => [field.key, '']));
}

export function isTemplateComplete(templateId, data) {
  const def = getFormTemplate(templateId);
  if (!def) return false;
  if (def.type === 'grid') return isGridComplete(data.rows, def);
  if (def.isComplete) return def.isComplete(data.fields || {});
  const fields = data.fields || {};
  return (def.fields || [])
    .filter((field) => field.required !== false)
    .every((field) => String(fields[field.key] || '').trim().length > 0);
}

export function templatePreviewLabel(templateId, data) {
  const def = getFormTemplate(templateId);
  if (!def) return 'Template submitted';
  if (def.type === 'grid' && data.rows?.length) {
    return `${def.submitLabel || 'Table'} (${data.rows.length} rows)`;
  }
  if (def.type === 'fields' && data.fields) {
    const filled = Object.values(data.fields).filter((v) => String(v || '').trim()).length;
    return `${def.submitLabel || 'Form'} (${filled} fields filled)`;
  }
  return 'Template submitted';
}
