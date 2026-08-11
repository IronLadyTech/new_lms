import { describe, it, expect } from 'vitest';
import { normalizeEventLink, buildGoogleCalendarUrl } from './eventLinks';

describe('normalizeEventLink', () => {
  it('leaves an absolute URL alone', () => {
    expect(normalizeEventLink('https://zoom.us/j/123')).toBe('https://zoom.us/j/123');
    expect(normalizeEventLink('http://meet.google.com/abc')).toBe('http://meet.google.com/abc');
  });

  it('adds https to a bare domain, so the link is not treated as relative', () => {
    expect(normalizeEventLink('zoom.us/j/123')).toBe('https://zoom.us/j/123');
  });

  it('trims surrounding whitespace from pasted links', () => {
    expect(normalizeEventLink('  zoom.us/j/123  ')).toBe('https://zoom.us/j/123');
  });

  it('returns an empty string for nothing, so callers can hide the button', () => {
    expect(normalizeEventLink('')).toBe('');
    expect(normalizeEventLink(null)).toBe('');
    expect(normalizeEventLink(undefined)).toBe('');
    expect(normalizeEventLink('   ')).toBe('');
  });
});

describe('buildGoogleCalendarUrl', () => {
  const parse = (event) => new URL(buildGoogleCalendarUrl(event));

  it('targets Google Calendar with the event title', () => {
    const url = parse({ title: 'MBW Quarter 1 Live', date: '2026-05-10' });
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('MBW Quarter 1 Live');
  });

  it('builds a one-hour slot when a time is given', () => {
    const dates = parse({ title: 'X', date: '2026-05-10', time: '14:30' }).searchParams.get(
      'dates'
    );
    expect(dates).toBe('20260510T143000/20260510T153000');
  });

  it('rolls an evening event into the next hour correctly', () => {
    const dates = parse({ title: 'X', date: '2026-05-10', time: '23:30' }).searchParams.get(
      'dates'
    );
    expect(dates).toBe('20260510T233000/20260511T003000');
  });

  it('builds an all-day span when there is no time', () => {
    const dates = parse({ title: 'X', date: '2026-05-10' }).searchParams.get('dates');
    expect(dates).toBe('20260510/20260511');
  });

  it('puts the meeting link in location, normalised', () => {
    const url = parse({ title: 'X', date: '2026-05-10', linkUrl: 'zoom.us/j/9' });
    expect(url.searchParams.get('location')).toBe('https://zoom.us/j/9');
  });

  it('includes the description and repeats the link in the details', () => {
    const details = parse({
      title: 'X',
      date: '2026-05-10',
      description: 'Bring your warfare map.',
      linkUrl: 'https://zoom.us/j/9',
    }).searchParams.get('details');
    expect(details).toContain('Bring your warfare map.');
    expect(details).toContain('https://zoom.us/j/9');
  });

  it('omits dates entirely when the event has none', () => {
    expect(parse({ title: 'X' }).searchParams.get('dates')).toBeNull();
  });

  it('falls back to a generic title rather than "undefined"', () => {
    expect(parse({ date: '2026-05-10' }).searchParams.get('text')).toBe('Event');
  });
});
