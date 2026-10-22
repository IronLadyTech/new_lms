// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MBWProgramLessonRow from './MBWProgramLessonRow';

/*
 * A lesson row in course content. LEP's list leads with status and shows the
 * kind of lesson as a small icon in the meta line; everywhere else the icon
 * stays where it was.
 */

afterEach(cleanup);

const row = (props = {}) =>
  render(
    <MBWProgramLessonRow
      title="Maximise Key Relationships"
      typeIcon="template"
      durationHint="Template"
      rowState={{ visual: 'available', reason: null, clickable: true }}
      isActive={false}
      onSelect={vi.fn()}
      {...props}
    />
  );

describe('the kind-of-lesson icon', () => {
  it('sits in the meta line, beside its label, when the list asks for it', () => {
    row({ iconInMeta: true });
    const meta = document.querySelector('.mbw-lesson-row__meta');
    expect(meta.querySelector('svg.mbw-lesson-row__meta-icon')).not.toBeNull();
    expect(meta.textContent).toContain('Template');
  });

  it('stays out of the meta line otherwise, as MBW and 100BM have it', () => {
    row();
    expect(document.querySelector('.mbw-lesson-row__meta svg')).toBeNull();
    expect(document.querySelector('.mbw-lesson-row__lead svg')).not.toBeNull();
  });
});
