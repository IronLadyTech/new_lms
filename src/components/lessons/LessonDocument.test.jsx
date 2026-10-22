// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import LessonDocument from './LessonDocument';
import { loadPdfjs } from './pdfjsLoader';

/**
 * A PDF read in the lesson player.
 *
 * pdf.js itself is replaced: jsdom has no canvas to draw on. What is pinned is
 * the contract a learner relies on: every page appears, a handout can be cut to
 * the pages that are reading, the PDF stays one link away, and a document that
 * will not load says so rather than leaving an empty player.
 */

vi.mock('./pdfjsLoader', () => ({ loadPdfjs: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function fakePdf(numPages) {
  const page = {
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  };
  return { numPages, getPage: vi.fn(() => Promise.resolve(page)) };
}

let getDocument;

function serve(result) {
  getDocument = vi.fn(() => ({
    promise: result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    destroy: vi.fn(),
  }));
  loadPdfjs.mockResolvedValue({ getDocument });
}

const DOC = { url: '/templates/lep/sample.pdf', label: 'Program Information' };

describe('a document in the lesson player', () => {
  it('shows every page', async () => {
    serve(fakePdf(4));
    render(<LessonDocument document={DOC} title="Program Framework" />);
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(4));
    expect(screen.getByRole('img', { name: 'Program Information — page 2 of 4' })).toBeTruthy();
  });

  it('asks pdf.js for the document the way pdf.js 6 requires', async () => {
    // A bare URL string is rejected by pdf.js 6 with no visible error, leaving
    // the player empty. Real pdf.js is not loaded here, so the call is pinned.
    serve(fakePdf(1));
    render(<LessonDocument document={DOC} />);
    await waitFor(() => expect(getDocument).toHaveBeenCalledWith({ url: DOC.url }));
  });

  it('shows only the pages asked for', async () => {
    // The CoDeSeF handout: page 1 is reading, the rest is the activity.
    serve(fakePdf(3));
    render(<LessonDocument document={{ ...DOC, pages: [1] }} />);
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(1));
    expect(screen.getByRole('img', { name: 'Program Information — page 1 of 3' })).toBeTruthy();
  });

  it('keeps the PDF one link away', () => {
    serve(fakePdf(1));
    render(<LessonDocument document={DOC} />);
    expect(screen.getByRole('link', { name: /open pdf/i }).getAttribute('href')).toBe(DOC.url);
  });

  it('tells the learner, with the link, when the document cannot be shown', async () => {
    serve(new Error('network'));
    render(<LessonDocument document={DOC} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not be displayed/i);
    expect(alert.querySelector('a').getAttribute('href')).toBe(DOC.url);
  });

  it('announces loading instead of showing an empty player', () => {
    loadPdfjs.mockReturnValue(new Promise(() => {}));
    render(<LessonDocument document={DOC} />);
    expect(screen.getByRole('status').textContent).toMatch(/loading/i);
  });
});
