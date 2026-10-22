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
  CRUCIBLE: 'crucible',
  CODESEF: 'codesef',
  AGAME_BELIEFS: 'agame-beliefs',
  KEY_RELATIONSHIPS: 'key-relationships',
  PURPOSE_PEG: 'purpose-peg',
  LEAGUE_ROADMAP: 'league-roadmap',
  AGAME_TABLE: 'agame-table',
  RESPONDING: 'responding',
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
  /*
   * Crucibles of Leadership, as the LEP worksheet sets it out: five questions
   * worked through one at a time, then three statements drawn from them.
   *
   * The order is the exercise. The learner is asked to sit with each question
   * before answering, and the three statements at the end only make sense once
   * the five above are done — which is why this is a sequence of prompts and
   * not the single "write your crucible statement" box it replaced.
   */
  [TEMPLATE_IDS.CRUCIBLE]: {
    type: 'fields',
    submitLabel: 'Submit crucible statement',
    fields: [
      {
        key: 'experience',
        label:
          'One experience or incident in my life, from birth to now, that is most unpleasant',
        hint: 'Preferably something that happened very early in your life.',
        type: 'textarea',
        required: true,
        section: 'Work through these one at a time',
      },
      {
        key: 'emotion',
        label: 'What was the emotion of that experience at the time?',
        type: 'textarea',
        required: true,
        section: 'Work through these one at a time',
      },
      {
        key: 'selfTalk',
        label: 'What did I tell myself?',
        type: 'textarea',
        required: true,
        section: 'Work through these one at a time',
      },
      {
        key: 'aboutOthers',
        label: 'What did I feel about others?',
        type: 'textarea',
        required: true,
        section: 'Work through these one at a time',
      },
      {
        key: 'conclusion',
        label: 'What is the conclusion I reached based on that experience?',
        type: 'textarea',
        required: true,
        section: 'Work through these one at a time',
      },
      {
        key: 'crucibleStatement',
        label: 'My crucible statement is',
        type: 'textarea',
        required: true,
        section: 'Now draw it together',
      },
      {
        key: 'dominantEmotion',
        label: 'My dominant crucible emotion is',
        type: 'text',
        required: true,
        section: 'Now draw it together',
      },
      {
        key: 'behaviourPattern',
        label: 'My dominant crucible behaviour pattern is',
        type: 'text',
        required: true,
        section: 'Now draw it together',
      },
    ],
  },

  /*
   * CoDeSeF — Context, Design, Sequence & Stakes, Faizen — as the LEP worksheet
   * sets it out. Four numbered steps, in order, because each one is built from
   * the step above it.
   *
   * The worksheet's Design step is a two-column table: each task, and whether
   * it falls in the top 20% by impact. It is asked that way here, as tasks the
   * learner writes with a Yes or No beside each.
   */
  [TEMPLATE_IDS.CODESEF]: {
    type: 'fields',
    submitLabel: 'Submit CoDeSeF',
    fields: [
      {
        key: 'goal',
        label: 'My goal',
        hint: 'Your Big Hairy Audacious Goal — set it big enough to stretch you.',
        type: 'textarea',
        required: true,
        section: '1. Context',
      },
      {
        key: 'capability',
        label: 'The capability I want to develop',
        hint: 'What you will need to reach the goal, and to sustain it beyond.',
        type: 'textarea',
        required: true,
        section: '1. Context',
      },
      {
        key: 'designTasks',
        type: 'table',
        label: 'List of tasks towards the goal',
        hint: 'One row per task. Leave spare rows empty.',
        section: '2. Design',
        rowNoun: 'Task',
        rowCount: 6,
        minRows: 1,
        columns: [
          { key: 'task', label: 'Task' },
          {
            key: 'topTwenty',
            label: 'Does this come in top 20%?',
            type: 'choice',
            options: ['Yes', 'No'],
          },
        ],
        required: true,
      },
      /*
       * How Design was asked before the table: a list and a shortlist. Kept so
       * CoDeSeF sheets already submitted still show a reviewer every answer. A
       * `legacy` field is never asked again and never counts towards complete.
       */
      {
        key: 'tasks',
        label: 'Tasks towards the goal',
        type: 'textarea',
        legacy: true,
        section: '2. Design',
      },
      {
        key: 'topTasks',
        label: 'Which of those are the 20% that make the most impact?',
        type: 'textarea',
        legacy: true,
        section: '2. Design',
      },
      {
        key: 'readiness',
        label: 'What I need to get ready before starting Faizen',
        type: 'textarea',
        required: true,
        section: '3. Sequence & Stakes',
      },
      {
        key: 'stake',
        label: 'What I am putting at stake',
        hint: 'Something that matters to you — the method depends on it.',
        type: 'textarea',
        required: true,
        section: '3. Sequence & Stakes',
      },
      {
        key: 'faizen1',
        label: 'Level 1 Faizen — the first steps',
        hint: 'The steps you will take consistently over a period of time.',
        type: 'textarea',
        required: true,
        section: '4. Faizen',
      },
      {
        key: 'faizen2',
        label: 'Level 2 Faizen — the next steps',
        hint: 'Once level 1 is mastered, the level up where you would fail.',
        type: 'textarea',
        required: true,
        section: '4. Faizen',
      },
    ],
  },

  /*
   * Playing your A-Game: self-awareness, as the LEP questionnaire sets it out.
   *
   * The same six questions are asked of two situations, one of defeat and one of
   * accomplishment. On paper that is two pages of the same list; as a table the
   * two answers to each question sit side by side, which is the comparison the
   * exercise exists for. Beliefs, emotions and habits follow in the pairs the
   * worksheet prints them in.
   */
  [TEMPLATE_IDS.AGAME_BELIEFS]: {
    type: 'fields',
    submitLabel: 'Submit your answers',
    fields: [
      {
        key: 'situations',
        type: 'table',
        label: 'Think of each situation and answer looking within',
        section: 'Two situations',
        rowHeader: 'Question',
        rowLabels: [
          'The situation was',
          '1. What was your inner dialogue in this situation?',
          '2. What was your behaviour derived out of such inner dialogue?',
          '3. What was your belief surrounding this situation?',
          '4. What was your body language in this situation?',
          '5. How frequent is this behaviour seen?',
          '6. Decision reached by the end of the situation',
        ],
        columns: [
          { key: 'defeat', label: 'A situation where you experienced failure or defeat' },
          { key: 'accomplished', label: 'A situation where you felt accomplished' },
        ],
        required: true,
      },
      {
        key: 'empoweringBeliefs',
        label: 'Empowering beliefs',
        type: 'textarea',
        required: true,
        section: 'Top beliefs',
      },
      {
        key: 'disempoweringBeliefs',
        label: 'Disempowering beliefs',
        type: 'textarea',
        required: true,
        section: 'Top beliefs',
      },
      {
        key: 'positiveEmotions',
        label: 'Positive emotions',
        type: 'textarea',
        required: true,
        section: 'Top emotions',
      },
      {
        key: 'negativeEmotions',
        label: 'Negative emotions',
        type: 'textarea',
        required: true,
        section: 'Top emotions',
      },
      {
        key: 'effectiveHabits',
        label: 'Effective work patterns / habits',
        type: 'textarea',
        required: true,
        section: 'Work patterns / habits',
      },
      {
        key: 'nonEffectiveHabits',
        label: 'Non-effective work patterns / habits',
        type: 'textarea',
        required: true,
        section: 'Work patterns / habits',
      },
    ],
  },

  /*
   * Maximise Key Relationships. The worksheet is a blank table: the learner names
   * each relationship, so the rows are written, not printed. Five rows to use and
   * one required, because the sheet sets no number, and inventing one would mark
   * a learner with three real relationships as incomplete.
   */
  [TEMPLATE_IDS.KEY_RELATIONSHIPS]: {
    type: 'fields',
    submitLabel: 'Submit relationship map',
    fields: [
      {
        key: 'relationships',
        type: 'table',
        label: 'Things that matter in key relationships',
        hint: 'One row for each key relationship. Leave spare rows empty.',
        section: 'Key relationships',
        rowNoun: 'Relationship',
        rowCount: 5,
        minRows: 1,
        columns: [
          { key: 'relationship', label: 'Key relationship' },
          { key: 'mattersToYou', label: 'Things that matter to you in this relationship' },
          {
            key: 'mattersToThem',
            label: 'Things that matter to the other person in this relationship',
          },
        ],
        required: true,
      },
    ],
  },

  /*
   * Purpose Peg table: five numbered rows, as printed.
   *
   * The PDF stores the header as one run of text with no rules to divide it, and
   * "Purpose B-HAG" is set as a single heading, so it stays one column rather
   * than being guessed into two. One complete row is enough to submit.
   */
  [TEMPLATE_IDS.PURPOSE_PEG]: {
    type: 'fields',
    submitLabel: 'Submit Purpose Peg table',
    fields: [
      {
        key: 'pegs',
        type: 'table',
        label: 'Purpose Peg table',
        hint: 'Fill the rows that apply. Leave spare rows empty.',
        section: 'Your Purpose Pegs',
        rowHeader: 'S.No',
        rowLabels: ['1', '2', '3', '4', '5'],
        minRows: 1,
        columns: [
          { key: 'area', label: 'Area of importance' },
          { key: 'purposeBhag', label: 'Purpose B-HAG' },
          { key: 'rituals', label: 'Rituals / PEGS' },
        ],
        required: true,
      },
    ],
  },

  /*
   * Your 0.5% League Roadmap, in the order the worked sample lays it out: the
   * differentiated strength, seven lists that make the plan, then a table of
   * milestones, each with a timeframe and a measurement.
   */
  [TEMPLATE_IDS.LEAGUE_ROADMAP]: {
    type: 'fields',
    submitLabel: 'Submit your roadmap',
    fields: [
      {
        key: 'strength',
        label: 'Differentiated strength is',
        type: 'textarea',
        required: true,
        section: 'Your differentiated strength',
      },
      ...[
        ['books', '1. Books to read'],
        ['videos', '2. Videos to watch'],
        ['articles', '3. Articles to read'],
        ['mentors', '4. Mentors to speak to'],
        ['people', '5. People to follow'],
        ['habits', '6. Simple habits and rituals to develop or follow'],
      ].map(([key, label]) => ({
        key,
        label,
        hint: 'One per line.',
        type: 'textarea',
        required: true,
        section: 'Plan for moving towards excellence',
      })),
      {
        key: 'knowledgeBase',
        label: '7. Knowledge base',
        hint: 'Magazines, networking sessions, awards, job portals, blogs, and the top accomplishers in your area.',
        type: 'textarea',
        required: true,
        section: 'Plan for moving towards excellence',
      },
      {
        key: 'milestones',
        type: 'table',
        label: '8. Milestones to reach',
        hint: 'Fill the rows you need. Leave spare rows empty.',
        section: 'Milestones',
        rowNoun: 'Milestone',
        rowCount: 4,
        minRows: 1,
        columns: [
          { key: 'timeframe', label: 'Timeframe' },
          { key: 'milestone', label: 'Milestone' },
          { key: 'measurement', label: 'Measurement' },
        ],
        required: true,
      },
    ],
  },

  /*
   * A-Game Table, the daily ritual sheet, as the table it is printed as: the
   * moments you were at your best today and the moments you were not, with what
   * you did, or could have done, beside each.
   */
  [TEMPLATE_IDS.AGAME_TABLE]: {
    type: 'fields',
    submitLabel: 'Submit A-Game table',
    fields: [
      {
        key: 'today',
        type: 'table',
        label: 'A-Game Table',
        section: 'Today',
        rowHeader: 'Today',
        rowLabels: ['At my best today', 'Not at my best today'],
        columns: [
          { key: 'instances', label: 'Which were the instances?' },
          { key: 'actions', label: 'What did I do? / What could I have done?' },
        ],
        required: true,
      },
    ],
  },

  /*
   * Respond vs React, the Powerful Extreme Responding questionnaire: seven
   * situations, each marked I Respond or I React, with a total that shows the
   * pattern. Every situation needs an answer; the total counts itself.
   */
  [TEMPLATE_IDS.RESPONDING]: {
    type: 'fields',
    submitLabel: 'Submit your answers',
    fields: [
      {
        key: 'situations',
        type: 'table',
        label: 'Respond vs React',
        section: 'Situations',
        rowHeader: 'Situation',
        rowLabels: [
          'I am not in a good mood and someone asks me a stupid question',
          'Someone points fingers at me in a meeting',
          'Someone blames me for none of my mistakes',
          'My boss gives all negative feedback and asks my opinion during 1-1',
          'My boss asks me status on something which was not owned by me',
          "My boss's boss asks status on something which was owned by my boss",
          'I am held accountable for a failure of my team and asked for explanation',
        ],
        columns: [
          {
            key: 'response',
            label: 'How I handle it',
            type: 'choice',
            options: ['I Respond', 'I React'],
          },
        ],
        totals: true,
        required: true,
      },
    ],
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

/*
 * Table fields.
 *
 * A worksheet's printed grid, typed into on the page instead of downloaded,
 * filled and uploaded. A table has either printed row labels (`rowLabels`,
 * stored on each row as `label`) or rows the learner writes (`rowCount` blank
 * rows). `minRows` is how many complete rows it takes to submit; with none set,
 * every row counts. A half-filled row is never complete, since a relationship
 * with nothing written against it is not an answer.
 *
 * Only templates that declare a `table` field reach any of this. Every existing
 * template holds strings and takes the same paths it always did.
 */
export function createTableRows(field) {
  const blank = () => Object.fromEntries(field.columns.map((col) => [col.key, '']));
  if (field.rowLabels?.length) return field.rowLabels.map((label) => ({ label, ...blank() }));
  return Array.from({ length: field.rowCount || 1 }, blank);
}

const cellFilled = (value) => String(value ?? '').trim().length > 0;

/** A text cell is answered when it holds text; a choice cell, when it holds one of its options. */
const cellAnswered = (col, value) =>
  col.type === 'choice' ? (col.options || []).includes(value) : cellFilled(value);

export function isTableFieldComplete(field, rows) {
  if (!Array.isArray(rows) || !rows.length || !field?.columns?.length) return false;
  const total = field.columns.length;
  const filledPerRow = rows.map(
    (row) => field.columns.filter((col) => cellAnswered(col, row?.[col.key])).length
  );
  if (filledPerRow.some((n) => n > 0 && n < total)) return false;
  const completeRows = filledPerRow.filter((n) => n === total).length;
  const needed = Math.min(field.minRows ?? rows.length, rows.length);
  return completeRows > 0 && completeRows >= needed;
}

/**
 * The Total row of a table with choice columns: how many rows picked each option,
 * as `{ response: { 'I Respond': 5, 'I React': 2 } }`. Computed, never stored, so
 * it cannot disagree with the rows it counts.
 */
export function tableTotals(field, rows) {
  const totals = {};
  (field?.columns || [])
    .filter((col) => col.type === 'choice')
    .forEach((col) => {
      const counts = Object.fromEntries((col.options || []).map((option) => [option, 0]));
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const picked = row?.[col.key];
        if (Object.prototype.hasOwnProperty.call(counts, picked)) counts[picked] += 1;
      });
      totals[col.key] = counts;
    });
  return totals;
}

/**
 * Whether a field holds an answer. Text keeps the exact test it always had; a
 * table counts once any cell is typed, its printed row labels aside.
 */
export function isFieldValueFilled(value) {
  if (Array.isArray(value)) {
    return value.some(
      (row) => row && Object.entries(row).some(([key, cell]) => key !== 'label' && cellFilled(cell))
    );
  }
  return String(value || '').trim().length > 0;
}

export function createTemplateFields(templateId) {
  const def = getFormTemplate(templateId);
  if (!def) return {};
  if (def.createFields) return def.createFields();
  if (!def.fields) return {};
  return Object.fromEntries(
    def.fields
      .filter((field) => !field.legacy)
      .map((field) => [field.key, field.type === 'table' ? createTableRows(field) : ''])
  );
}

export function isTemplateComplete(templateId, data) {
  const def = getFormTemplate(templateId);
  if (!def) return false;
  if (def.type === 'grid') return isGridComplete(data.rows, def);
  if (def.isComplete) return def.isComplete(data.fields || {});
  const fields = data.fields || {};
  return (def.fields || [])
    .filter((field) => field.required !== false && !field.legacy)
    .every((field) =>
      field.type === 'table'
        ? isTableFieldComplete(field, fields[field.key])
        : String(fields[field.key] || '').trim().length > 0
    );
}

export function templatePreviewLabel(templateId, data) {
  const def = getFormTemplate(templateId);
  if (!def) return 'Template submitted';
  if (def.type === 'grid' && data.rows?.length) {
    return `${def.submitLabel || 'Table'} (${data.rows.length} rows)`;
  }
  if (def.type === 'fields' && data.fields) {
    const filled = Object.values(data.fields).filter(isFieldValueFilled).length;
    return `${def.submitLabel || 'Form'} (${filled} fields filled)`;
  }
  return 'Template submitted';
}

/*
 * Requirements, written for the learner.
 *
 * `isTemplateComplete` answers yes or no; a disabled Submit left the learner to
 * find out why. This says it in the page's words: a checklist of what the
 * worksheet needs, and the first thing still missing, naming the row and the
 * column. The rules are the same ones, so the checklist is all ticked exactly
 * when Submit opens.
 *
 * Templates with their own `isComplete` rule (MBW's strategy documents) get no
 * checklist: this does not know their rule and will not guess at it.
 */
const shortText = (text, max = 48) => {
  const s = String(text ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

function tableRowName(field, row, index) {
  if (!field.rowLabels?.length) return `${field.rowNoun || 'Row'} ${index + 1}`;
  const label = String(row?.label ?? '');
  return /^\d+$/.test(label) ? `Row ${label}` : `“${shortText(label)}”`;
}

function missingCellMessage(field, row, index) {
  const col = field.columns.find((c) => !cellAnswered(c, row?.[c.key]));
  if (!col) return '';
  const name = tableRowName(field, row, index);
  return col.type === 'choice'
    ? `${name}: pick ${(col.options || []).join(' or ')}.`
    : `${name} needs “${col.label}”.`;
}

function tableRequirements(field, rows) {
  const list = Array.isArray(rows) ? rows : [];
  const total = field.columns.length;
  const answered = list.map(
    (row) => field.columns.filter((c) => cellAnswered(c, row?.[c.key])).length
  );
  const completeRows = answered.filter((n) => n === total).length;
  const name = field.label || 'the table';
  const items = [];
  let reason = '';

  if (field.minRows == null) {
    items.push({
      key: `${field.key}:all`,
      label: `Every row of “${name}” answered (${completeRows}/${list.length})`,
      met: list.length > 0 && completeRows === list.length,
    });
    const gap = answered.findIndex((n) => n < total);
    if (gap >= 0) reason = missingCellMessage(field, list[gap], gap);
  } else {
    const need = field.minRows;
    const noun = (field.rowNoun || 'row').toLowerCase();
    const plural = need === 1 ? noun : `${noun}s`;
    const half = answered.findIndex((n) => n > 0 && n < total);
    items.push({
      key: `${field.key}:min`,
      label: `At least ${need} ${plural} in “${name}” (${Math.min(completeRows, need)}/${need})`,
      met: completeRows >= need,
    });
    items.push({
      key: `${field.key}:half`,
      label: `No half-filled ${noun}s in “${name}”`,
      met: half < 0,
    });
    if (half >= 0) reason = missingCellMessage(field, list[half], half);
    else if (completeRows < need) reason = `Fill in at least ${need} ${plural} in “${name}”.`;
  }
  return { items, reason };
}

export function templateRequirements(templateId, fields = {}) {
  const def = getFormTemplate(templateId);
  if (!def || def.type !== 'fields' || def.isComplete) return { items: [], reason: '' };

  const asked = (def.fields || []).filter((f) => !f.legacy && f.required !== false);
  const textFields = asked.filter((f) => f.type !== 'table');
  const answeredText = textFields.filter((f) => String(fields[f.key] || '').trim()).length;

  const items = [];
  if (textFields.length === 1) {
    items.push({
      key: 'text',
      label: `“${shortText(textFields[0].label, 60)}” answered`,
      met: answeredText === 1,
    });
  } else if (textFields.length > 1) {
    items.push({
      key: 'text',
      label: `All ${textFields.length} questions answered (${answeredText}/${textFields.length})`,
      met: answeredText === textFields.length,
    });
  }

  // The reason follows the page: the first unanswered thing, top to bottom.
  let reason = '';
  asked.forEach((field) => {
    if (field.type === 'table') {
      const table = tableRequirements(field, fields[field.key]);
      items.push(...table.items);
      if (!reason && table.reason) reason = table.reason;
    } else if (!reason && !String(fields[field.key] || '').trim()) {
      reason = `Answer “${shortText(field.label, 60)}”.`;
    }
  });

  return { items, reason };
}
