// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import LearnerReviewFeedback from './LearnerReviewFeedback';

/**
 * CX feedback on a learner's work.
 *
 * `variant="facilitator"` is how a LEP lesson words it: who reviewed, and what
 * they decided. Everywhere else keeps the original wording.
 */

afterEach(cleanup);

const REVIEWED_AT = '2026-09-15T18:20:00+05:30';

describe('feedback worded for a LEP lesson', () => {
  it('says the facilitator asked for changes, and what to do next', () => {
    render(
      <LearnerReviewFeedback
        variant="facilitator"
        submission={{
          status: 'needs_improvement',
          reviewOutcome: 'needs_improvement',
          feedback: 'Add the numbers behind each row.',
          reviewedAt: REVIEWED_AT,
        }}
      />
    );
    expect(screen.getByText('Your facilitator requested changes')).toBeTruthy();
    expect(screen.getByText('Add the numbers behind each row.')).toBeTruthy();
    expect(screen.getByText('Update your work above and submit it again.')).toBeTruthy();
  });

  it('says the facilitator approved it', () => {
    render(
      <LearnerReviewFeedback
        variant="facilitator"
        submission={{
          status: 'completed',
          reviewOutcome: 'approved',
          feedback: 'Clear and specific.',
          reviewedAt: REVIEWED_AT,
        }}
      />
    );
    expect(screen.getByText('Approved by your facilitator')).toBeTruthy();
    expect(screen.queryByText('Update your work above and submit it again.')).toBeNull();
  });
});

describe('feedback everywhere else', () => {
  it('keeps its original wording', () => {
    render(
      <LearnerReviewFeedback
        submission={{
          status: 'needs_improvement',
          reviewOutcome: 'needs_improvement',
          feedback: 'Add the numbers behind each row.',
          reviewedAt: REVIEWED_AT,
        }}
      />
    );
    expect(screen.getByText('Review feedback')).toBeTruthy();
    expect(screen.queryByText(/facilitator/)).toBeNull();
  });
});
