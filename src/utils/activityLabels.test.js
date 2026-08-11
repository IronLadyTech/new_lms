import { describe, it, expect } from 'vitest';
import { formatActivityTypeLabel, formatActivitySummary } from './activityLabels';

/**
 * The admin activity log is read by non-technical staff. Its job is to never
 * surface a raw Firestore document id where a human-readable name belongs.
 */

const courseMap = { c1: { title: 'Master of Business Warfare', code: 'MBW' } };

describe('formatActivityTypeLabel', () => {
  it('uses the friendly label for known types', () => {
    expect(formatActivityTypeLabel('resource_view')).toBe('Resource view');
    expect(formatActivityTypeLabel('course_enroll')).toBe('Enrollment');
    expect(formatActivityTypeLabel('ticket_reply')).toBe('Ticket reply');
  });

  it('de-snakes an unknown type instead of showing it raw', () => {
    expect(formatActivityTypeLabel('lesson_started')).toBe('lesson started');
  });

  it('falls back to a word for a missing type', () => {
    expect(formatActivityTypeLabel(undefined)).toBe('activity');
  });
});

describe('formatActivitySummary', () => {
  it('names both the resource and the course when it can', () => {
    expect(
      formatActivitySummary(
        { type: 'resource_view', title: 'Warfare Map', courseId: 'c1' },
        { courseMap }
      )
    ).toBe('Opened "Warfare Map" in Master of Business Warfare');
  });

  it('degrades gracefully as detail is lost', () => {
    expect(formatActivitySummary({ type: 'resource_view', title: 'Warfare Map' })).toBe(
      'Opened resource "Warfare Map"'
    );
    expect(formatActivitySummary({ type: 'resource_view', courseId: 'c1' }, { courseMap })).toBe(
      'Viewed content in Master of Business Warfare'
    );
    expect(formatActivitySummary({ type: 'resource_view' })).toBe('Viewed a resource');
  });

  it('never prints a Firestore id as if it were a title', () => {
    const summary = formatActivitySummary(
      { type: 'resource_view', title: 'aBcD1234EfGh5678IjK', courseId: 'c1' },
      { courseMap }
    );
    expect(summary).toBe('Viewed content in Master of Business Warfare');
    expect(summary).not.toContain('aBcD1234');
  });

  it('never echoes the courseId back as a title', () => {
    expect(
      formatActivitySummary({ type: 'resource_view', title: 'c1', courseId: 'c1' }, { courseMap })
    ).toBe('Viewed content in Master of Business Warfare');
  });

  it('summarises enrolments and tickets', () => {
    expect(formatActivitySummary({ type: 'course_enroll', courseId: 'c1' }, { courseMap })).toBe(
      'Enrolled in Master of Business Warfare'
    );
    expect(formatActivitySummary({ type: 'ticket_created', title: 'Cannot log in' })).toBe(
      'Created ticket "Cannot log in"'
    );
    expect(formatActivitySummary({ type: 'ticket_created' })).toBe('Created a support ticket');
  });

  it('truncates a long ticket reply rather than flooding the row', () => {
    // Real prose — an unbroken 200-char token would (correctly) be treated as
    // an id by the heuristic above, so it would not exercise truncation.
    const long =
      'I tried resetting my password three times and the email never arrived, ' +
      'so I still cannot open the MBW programme on my phone this morning.';
    const out = formatActivitySummary({ type: 'ticket_reply', title: long });
    expect(out.startsWith('Replied: ')).toBe(true);
    expect(out.length).toBeLessThan(90);
    expect(out.endsWith('…')).toBe(true);
  });

  it('leaves a short reply intact', () => {
    expect(formatActivitySummary({ type: 'ticket_reply', title: 'Thanks!' })).toBe(
      'Replied: Thanks!'
    );
  });

  it('handles an unknown type and an empty activity', () => {
    expect(formatActivitySummary({ type: 'lesson_started', title: 'Module 3' })).toBe('Module 3');
    expect(formatActivitySummary({})).toBe('activity');
    expect(formatActivitySummary()).toBe('activity');
  });
});
