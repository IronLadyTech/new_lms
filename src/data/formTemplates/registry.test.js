import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_IDS,
  createTableRows,
  createTemplateFields,
  getFormTemplate,
  isFieldValueFilled,
  isTableFieldComplete,
  isTemplateComplete,
  tableTotals,
  templatePreviewLabel,
  templateRequirements,
} from './registry';

/**
 * Table fields: a worksheet's grid, typed in instead of downloaded and uploaded.
 *
 * The rule that matters is when a table counts as done. Too strict, and a
 * learner with three real relationships cannot submit a five-row sheet. Too
 * loose, and a row naming a relationship with nothing written against it goes
 * through as an answer.
 */

const COLUMNS = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
];
const printed = { key: 'p', type: 'table', rowLabels: ['A', 'B'], columns: COLUMNS };
const written = { key: 'w', type: 'table', rowCount: 3, minRows: 1, columns: COLUMNS };

describe('a table field', () => {
  it('starts one row per printed label, carrying the label', () => {
    expect(createTableRows(printed)).toEqual([
      { label: 'A', x: '', y: '' },
      { label: 'B', x: '', y: '' },
    ]);
  });

  it('starts blank rows when the learner writes the rows', () => {
    expect(createTableRows(written)).toEqual([
      { x: '', y: '' },
      { x: '', y: '' },
      { x: '', y: '' },
    ]);
  });

  it('needs every printed row when no minimum is set', () => {
    const rows = createTableRows(printed);
    rows[0] = { ...rows[0], x: '1', y: '2' };
    expect(isTableFieldComplete(printed, rows)).toBe(false);
    rows[1] = { ...rows[1], x: '3', y: '4' };
    expect(isTableFieldComplete(printed, rows)).toBe(true);
  });

  it('accepts a written table once enough rows are complete, spare rows left empty', () => {
    const rows = createTableRows(written);
    rows[0] = { x: 'Manager', y: 'Trust' };
    expect(isTableFieldComplete(written, rows)).toBe(true);
  });

  it('refuses a half-filled row, even with enough complete rows beside it', () => {
    const rows = createTableRows(written);
    rows[0] = { x: 'Manager', y: 'Trust' };
    rows[1] = { x: 'Mentor', y: '' };
    expect(isTableFieldComplete(written, rows)).toBe(false);
  });

  it('does not count a printed row label as an answer', () => {
    expect(isTableFieldComplete(printed, createTableRows(printed))).toBe(false);
    expect(isFieldValueFilled(createTableRows(printed))).toBe(false);
  });

  it('treats whitespace as empty', () => {
    expect(isTableFieldComplete(written, [{ x: '  ', y: '\n' }])).toBe(false);
  });
});

const LEP_WORKSHEETS = [
  TEMPLATE_IDS.AGAME_BELIEFS,
  TEMPLATE_IDS.AGAME_TABLE,
  TEMPLATE_IDS.RESPONDING,
  TEMPLATE_IDS.CODESEF,
  TEMPLATE_IDS.KEY_RELATIONSHIPS,
  TEMPLATE_IDS.PURPOSE_PEG,
  TEMPLATE_IDS.LEAGUE_ROADMAP,
];

/* Every required field answered: text gets a word, every table cell gets one. */
function fillAll(templateId) {
  const def = getFormTemplate(templateId);
  const fields = createTemplateFields(templateId);
  def.fields
    .filter((field) => !field.legacy)
    .forEach((field) => {
      fields[field.key] =
        field.type === 'table'
          ? fields[field.key].map((row) => ({
              ...row,
              ...Object.fromEntries(
                field.columns.map((col) => [
                  col.key,
                  col.type === 'choice' ? col.options[0] : 'answer',
                ])
              ),
            }))
          : 'answer';
    });
  return fields;
}

describe.each(LEP_WORKSHEETS)('the %s worksheet', (templateId) => {
  const def = getFormTemplate(templateId);

  it('is registered as a form', () => {
    expect(def?.type).toBe('fields');
    expect(def.fields.length).toBeGreaterThan(0);
  });

  it('uses each field key once', () => {
    const keys = def.fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every table column a unique key and a label', () => {
    def.fields
      .filter((f) => f.type === 'table')
      .forEach((f) => {
        const keys = f.columns.map((c) => c.key);
        expect(new Set(keys).size, `${f.key} columns`).toBe(keys.length);
        expect(
          f.columns.every((c) => c.label?.trim()),
          `${f.key} labels`
        ).toBe(true);
        expect(f.rowLabels?.length || f.rowCount, `${f.key} has no rows`).toBeTruthy();
      });
  });

  it('starts incomplete', () => {
    expect(isTemplateComplete(templateId, { fields: createTemplateFields(templateId) })).toBe(
      false
    );
  });

  it('completes once every block is answered', () => {
    expect(isTemplateComplete(templateId, { fields: fillAll(templateId) })).toBe(true);
  });

  it('counts table fields in the preview label', () => {
    const fields = fillAll(templateId);
    expect(templatePreviewLabel(templateId, { fields })).toContain(
      `(${def.fields.filter((f) => !f.legacy).length} fields filled)`
    );
  });
});

describe('a choice column', () => {
  const field = {
    key: 'c',
    type: 'table',
    rowLabels: ['A', 'B', 'C'],
    totals: true,
    columns: [{ key: 'pick', label: 'Pick', type: 'choice', options: ['Yes', 'No'] }],
  };

  it('counts only one of its own options as an answer', () => {
    expect(isTableFieldComplete(field, [{ pick: 'Yes' }, { pick: 'No' }, { pick: 'Maybe' }])).toBe(
      false
    );
    expect(isTableFieldComplete(field, [{ pick: 'Yes' }, { pick: 'No' }, { pick: 'No' }])).toBe(
      true
    );
  });

  it('totals the picks per option, including options nobody picked', () => {
    const rows = [{ pick: 'No' }, { pick: 'No' }, { pick: '' }];
    expect(tableTotals(field, rows)).toEqual({ pick: { Yes: 0, No: 2 } });
  });
});

describe('the Respond vs React questionnaire', () => {
  const def = getFormTemplate(TEMPLATE_IDS.RESPONDING);
  const table = def.fields[0];

  it('asks the seven situations the sheet prints', () => {
    expect(table.rowLabels).toHaveLength(7);
    expect(table.rowLabels[1]).toBe('Someone points fingers at me in a meeting');
  });

  it('needs every situation answered before it can be submitted', () => {
    const rows = createTableRows(table).map((row, i) => ({
      ...row,
      response: i === 0 ? '' : 'I Respond',
    }));
    expect(isTemplateComplete(TEMPLATE_IDS.RESPONDING, { fields: { situations: rows } })).toBe(
      false
    );
  });
});

describe('CoDeSeF after the Design table', () => {
  it('no longer asks the old list and shortlist', () => {
    const fields = createTemplateFields(TEMPLATE_IDS.CODESEF);
    expect(fields).not.toHaveProperty('tasks');
    expect(fields).not.toHaveProperty('topTasks');
    expect(Array.isArray(fields.designTasks)).toBe(true);
  });

  it('asks each task with a Yes or No for the top 20%', () => {
    const design = getFormTemplate(TEMPLATE_IDS.CODESEF).fields.find(
      (f) => f.key === 'designTasks'
    );
    expect(design.columns.map((c) => c.label)).toEqual(['Task', 'Does this come in top 20%?']);
    expect(design.columns[1].options).toEqual(['Yes', 'No']);
  });
});

describe('requirements, written for the learner', () => {
  const fieldsFor = (templateId) => createTemplateFields(templateId);

  it('says which cell a half-filled row is missing, by row and column', () => {
    const fields = fieldsFor(TEMPLATE_IDS.KEY_RELATIONSHIPS);
    fields.relationships[0] = { ...fields.relationships[0], relationship: 'My manager' };
    expect(templateRequirements(TEMPLATE_IDS.KEY_RELATIONSHIPS, fields).reason).toBe(
      'Relationship 1 needs “Things that matter to you in this relationship”.'
    );
  });

  it('asks for the minimum when nothing is written yet', () => {
    expect(
      templateRequirements(
        TEMPLATE_IDS.KEY_RELATIONSHIPS,
        fieldsFor(TEMPLATE_IDS.KEY_RELATIONSHIPS)
      ).reason
    ).toBe('Fill in at least 1 relationship in “Things that matter in key relationships”.');
  });

  it('asks for a pick, naming the options, on a choice row', () => {
    const { reason } = templateRequirements(
      TEMPLATE_IDS.RESPONDING,
      fieldsFor(TEMPLATE_IDS.RESPONDING)
    );
    expect(reason).toMatch(/: pick I Respond or I React\.$/);
  });

  it('names a numbered printed row as Row n', () => {
    const fields = fieldsFor(TEMPLATE_IDS.PURPOSE_PEG);
    fields.pegs[0] = { ...fields.pegs[0], area: 'Health' };
    expect(templateRequirements(TEMPLATE_IDS.PURPOSE_PEG, fields).reason).toBe(
      'Row 1 needs “Purpose B-HAG”.'
    );
  });

  it('asks for the first unanswered question, top to bottom', () => {
    const { reason } = templateRequirements(
      TEMPLATE_IDS.LEAGUE_ROADMAP,
      fieldsFor(TEMPLATE_IDS.LEAGUE_ROADMAP)
    );
    expect(reason).toBe('Answer “Differentiated strength is”.');
  });

  it.each([
    TEMPLATE_IDS.AGAME_BELIEFS,
    TEMPLATE_IDS.AGAME_TABLE,
    TEMPLATE_IDS.KEY_RELATIONSHIPS,
    TEMPLATE_IDS.PURPOSE_PEG,
    TEMPLATE_IDS.LEAGUE_ROADMAP,
    TEMPLATE_IDS.RESPONDING,
    TEMPLATE_IDS.CODESEF,
  ])('%s: ticks everything, with nothing missing, exactly when it is complete', (id) => {
    const empty = templateRequirements(id, createTemplateFields(id));
    expect(isTemplateComplete(id, { fields: createTemplateFields(id) })).toBe(false);
    expect(empty.reason).not.toBe('');
    expect(empty.items.some((i) => !i.met)).toBe(true);

    const def = getFormTemplate(id);
    const full = createTemplateFields(id);
    def.fields
      .filter((f) => !f.legacy)
      .forEach((f) => {
        full[f.key] =
          f.type === 'table'
            ? full[f.key].map((row) => ({
                ...row,
                ...Object.fromEntries(
                  f.columns.map((c) => [c.key, c.type === 'choice' ? c.options[0] : 'answer'])
                ),
              }))
            : 'answer';
      });
    const done = templateRequirements(id, full);
    expect(isTemplateComplete(id, { fields: full })).toBe(true);
    expect(done.reason).toBe('');
    expect(done.items.every((i) => i.met)).toBe(true);
  });

  it('offers no checklist for a template with its own completeness rule', () => {
    expect(templateRequirements(TEMPLATE_IDS.STRATEGY, {})).toEqual({ items: [], reason: '' });
  });
});
