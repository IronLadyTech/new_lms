// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import EditableTemplate from './EditableTemplate';
import TemplateReadOnly from '../TemplateReadOnly';

/**
 * LEP worksheets filled in on the page.
 *
 * These were download-fill-upload tasks, or one text box over a PDF. The tests
 * cover what a learner and a reviewer depend on: the printed grid appears as
 * cells, submit waits for a real answer, the rows are what gets saved, and an
 * answer sent before the change is never hidden behind an empty table.
 */

afterEach(cleanup);

const task = (templateId, over = {}) => ({
  id: 't1',
  title: 'Worksheet',
  description: 'Fill it in.',
  type: 'editable_template',
  templateId,
  ...over,
});

describe('a worksheet table', () => {
  it('lays out the printed rows as cells to type into', () => {
    render(
      <EditableTemplate task={task('purpose-peg')} submission={null} canSubmit onSave={vi.fn()} />
    );
    // Table and phone cards are both in the DOM; CSS shows one.
    expect(screen.getAllByLabelText('1 — Area of importance').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('5 — Rituals / PEGS').length).toBeGreaterThan(0);
  });

  it('keeps submit shut until a whole row is written, then saves every row', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <EditableTemplate
        task={task('key-relationships')}
        submission={null}
        canSubmit
        onSave={onSave}
      />
    );
    const submit = screen.getByRole('button', { name: /submit/i });
    expect(submit.disabled).toBe(true);

    const type = (label, value) =>
      fireEvent.change(screen.getAllByLabelText(label)[0], { target: { value } });

    type('Relationship 1 — Key relationship', 'My manager');
    expect(submit.disabled, 'a half-filled row is not an answer').toBe(true);

    type('Relationship 1 — Things that matter to you in this relationship', 'Trust');
    type(
      'Relationship 1 — Things that matter to the other person in this relationship',
      'Delivery'
    );
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const saved = onSave.mock.calls[0][0];
    expect(saved.templateId).toBe('key-relationships');
    expect(saved.fields.relationships).toHaveLength(5);
    expect(saved.fields.relationships[0]).toEqual({
      relationship: 'My manager',
      mattersToYou: 'Trust',
      mattersToThem: 'Delivery',
    });
  });

  it('reopens with the rows already saved', () => {
    const submission = {
      templateData: {
        templateId: 'purpose-peg',
        fields: {
          pegs: [
            { label: '1', area: 'Health', purposeBhag: 'Run a marathon', rituals: 'Daily walk' },
            { label: '2', area: '', purposeBhag: '', rituals: '' },
          ],
        },
      },
    };
    render(
      <EditableTemplate
        task={task('purpose-peg')}
        submission={submission}
        canSubmit
        onSave={vi.fn()}
      />
    );
    expect(screen.getAllByLabelText('1 — Area of importance')[0].value).toBe('Health');
  });
});

describe('an answer sent before the task became a table', () => {
  const earlier = { status: 'submitted', textValue: 'My earlier beliefs answer' };
  const converted = () => task('agame-beliefs', { previousType: 'text' });

  it('is shown instead of an empty table', () => {
    render(
      <EditableTemplate
        task={converted()}
        submission={earlier}
        canSubmit={false}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText('My earlier beliefs answer')).toBeTruthy();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('stays above the table when the work is sent back for changes', () => {
    render(<EditableTemplate task={converted()} submission={earlier} canSubmit onSave={vi.fn()} />);
    expect(screen.getByText('My earlier beliefs answer')).toBeTruthy();
    expect(document.querySelector('textarea')).not.toBeNull();
  });

  it('does nothing for a task that was always a template', () => {
    // MBW's templates carry no `previousType`; they must render as they did.
    render(
      <EditableTemplate
        task={task('agame-beliefs')}
        submission={earlier}
        canSubmit={false}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByText('My earlier beliefs answer')).toBeNull();
    expect(document.querySelector('textarea')).not.toBeNull();
  });
});

describe('what a reviewer sees', () => {
  it('shows the rows written and drops the spare ones', () => {
    render(
      <TemplateReadOnly
        templateData={{
          templateId: 'key-relationships',
          fields: {
            relationships: [
              { relationship: 'Manager', mattersToYou: 'Trust', mattersToThem: 'Delivery' },
              { relationship: '', mattersToYou: '', mattersToThem: '' },
            ],
          },
        }}
      />
    );
    expect(screen.getByText('Manager')).toBeTruthy();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('keeps every printed row of a table that needs them all', () => {
    const situations = [
      'The situation was',
      '1. What was your inner dialogue in this situation?',
    ].map((label) => ({ label, defeat: 'd', accomplished: 'a' }));
    render(
      <TemplateReadOnly templateData={{ templateId: 'agame-beliefs', fields: { situations } }} />
    );
    expect(screen.getByText('The situation was')).toBeTruthy();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
  });
});

describe('a questionnaire with a pick per row', () => {
  it('counts each pick into the total as it is made', () => {
    render(
      <EditableTemplate task={task('responding')} submission={null} canSubmit onSave={vi.fn()} />
    );
    fireEvent.click(
      screen.getAllByLabelText('Someone points fingers at me in a meeting — I Respond')[0]
    );
    fireEvent.click(
      screen.getAllByLabelText('Someone blames me for none of my mistakes — I React')[0]
    );
    expect(screen.getByText('Total — I Respond: 1 · I React: 1')).toBeTruthy();
  });

  it('keeps submit shut until every situation has an answer', () => {
    render(
      <EditableTemplate task={task('responding')} submission={null} canSubmit onSave={vi.fn()} />
    );
    const submit = screen.getByRole('button', { name: /submit/i });
    fireEvent.click(
      screen.getAllByLabelText('Someone points fingers at me in a meeting — I Respond')[0]
    );
    expect(submit.disabled).toBe(true);
  });
});

describe('the CoDeSeF Design step', () => {
  it('asks tasks with a Yes or No for the top 20%', () => {
    render(
      <EditableTemplate task={task('codesef')} submission={null} canSubmit onSave={vi.fn()} />
    );
    expect(screen.getAllByLabelText('Task 1 — Task').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Task 1 — Yes').length).toBeGreaterThan(0);
    // The old list and shortlist are not asked again.
    expect(screen.queryByText('Tasks towards the goal')).toBeNull();
  });
});

describe('what a reviewer sees of the new tables', () => {
  it('shows each pick and the total', () => {
    const def = [
      'Someone points fingers at me in a meeting',
      'Someone blames me for none of my mistakes',
    ];
    render(
      <TemplateReadOnly
        templateData={{
          templateId: 'responding',
          fields: {
            situations: [
              { label: def[0], response: 'I React' },
              { label: def[1], response: 'I Respond' },
            ],
          },
        }}
      />
    );
    expect(screen.getByText('I React')).toBeTruthy();
    expect(screen.getByText('I Respond: 1 · I React: 1')).toBeTruthy();
  });

  it('still shows the CoDeSeF tasks written before the table existed', () => {
    render(
      <TemplateReadOnly
        templateData={{
          templateId: 'codesef',
          fields: { goal: 'Lead a region', tasks: 'Old task list', topTasks: 'Old shortlist' },
        }}
      />
    );
    expect(screen.getByText('Old task list')).toBeTruthy();
    expect(screen.getByText('Old shortlist')).toBeTruthy();
  });
});

describe('guidance on a LEP worksheet', () => {
  it('says what is missing beside Submit, and follows the learner as they type', () => {
    render(
      <EditableTemplate
        task={task('key-relationships')}
        submission={null}
        canSubmit
        guidance
        onSave={vi.fn()}
      />
    );
    expect(
      screen.getByText(
        'Fill in at least 1 relationship in “Things that matter in key relationships”.'
      )
    ).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText('Relationship 1 — Key relationship')[0], {
      target: { value: 'My manager' },
    });
    expect(
      screen.getByText('Relationship 1 needs “Things that matter to you in this relationship”.')
    ).toBeTruthy();
  });

  it('lists the requirements and ticks them off', () => {
    render(
      <EditableTemplate
        task={task('key-relationships')}
        submission={null}
        canSubmit
        guidance
        onSave={vi.fn()}
      />
    );
    const list = screen.getByRole('list', { name: 'Requirements' });
    const type = (label, value) =>
      fireEvent.change(screen.getAllByLabelText(label)[0], { target: { value } });
    type('Relationship 1 — Key relationship', 'My manager');
    type('Relationship 1 — Things that matter to you in this relationship', 'Trust');
    type(
      'Relationship 1 — Things that matter to the other person in this relationship',
      'Delivery'
    );
    expect([...list.querySelectorAll('li')].every((li) => li.className === 'is-met')).toBe(true);
    expect(screen.getByText('Ready to submit.')).toBeTruthy();
  });

  it('lets the learner add a row to a table they write', () => {
    render(
      <EditableTemplate
        task={task('key-relationships')}
        submission={null}
        canSubmit
        guidance
        onSave={vi.fn()}
      />
    );
    expect(screen.queryAllByLabelText('Relationship 6 — Key relationship')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Add a relationship' }));
    expect(screen.getAllByLabelText('Relationship 6 — Key relationship').length).toBeGreaterThan(0);
  });

  it('never adds rows to a worksheet whose rows are printed', () => {
    render(
      <EditableTemplate
        task={task('purpose-peg')}
        submission={null}
        canSubmit
        guidance
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /^Add a/ })).toBeNull();
  });

  it('leaves the form as it was without guidance, which is every MBW template', () => {
    render(
      <EditableTemplate
        task={task('key-relationships')}
        submission={null}
        canSubmit
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('list', { name: 'Requirements' })).toBeNull();
    expect(screen.queryByText(/Fill in at least/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Add a/ })).toBeNull();
  });
});
