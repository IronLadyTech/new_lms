import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { loadPdfjs } from './pdfjsLoader';

/**
 * One page, drawn onto a canvas at the width of the reader.
 *
 * Rendered at the device pixel ratio (capped at 2) so text stays sharp on a
 * phone, and redrawn when the reader's width changes. A canvas carries no text
 * of its own, so each page is labelled, and the header keeps a link to the PDF
 * for anyone who needs the document's real text.
 */
function PdfPage({ pdf, number, total, width, label }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!width) return undefined;
    let cancelled = false;
    let renderTask = null;

    pdf
      .getPage(number)
      .then((page) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return null;
        const base = page.getViewport({ scale: 1 });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        renderTask = page.render({ canvas, viewport });
        return renderTask.promise;
      })
      .catch((err) => {
        if (!cancelled && err?.name !== 'RenderingCancelledException') setFailed(true);
      });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdf, number, width]);

  if (failed) {
    return (
      <p className="lesson-document__page-error muted">Page {number} could not be displayed.</p>
    );
  }

  return (
    <figure
      className="lesson-document__page"
      role="img"
      aria-label={`${label} — page ${number} of ${total}`}
    >
      <canvas ref={canvasRef} />
    </figure>
  );
}

/**
 * A PDF read in the lesson player, where a video would otherwise play.
 *
 * Reading material used to be a "Session materials" link that sent learners out
 * of the lesson. Here the document is the lesson: every page (or only the pages
 * named in `document.pages`) drawn in the player, readable on a phone and inside
 * the app, where a browser would download a PDF rather than show it.
 *
 * @param {{ document: { url: string, label?: string, pages?: number[] }, title?: string }} props
 */
export default function LessonDocument({ document: doc, title }) {
  const readerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [state, setState] = useState({ status: 'loading', pdf: null });
  const label = doc.label || title || 'Lesson document';

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return undefined;
    // clientWidth is 0 before layout (and always in tests); draw at a sensible
    // width until the observer reports the real one.
    const measure = () => setWidth(Math.floor(el.clientWidth) || 800);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;
    setState({ status: 'loading', pdf: null });

    loadPdfjs()
      .then((pdfjs) => {
        // pdf.js 6 takes an options object; a bare URL string is rejected.
        loadingTask = pdfjs.getDocument({ url: doc.url });
        return loadingTask.promise;
      })
      .then((pdf) => {
        if (!cancelled) setState({ status: 'ready', pdf });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', pdf: null });
      });

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [doc.url]);

  const { pdf } = state;
  const pageNumbers = pdf
    ? doc.pages?.length
      ? doc.pages.filter((n) => n >= 1 && n <= pdf.numPages)
      : Array.from({ length: pdf.numPages }, (_, i) => i + 1)
    : [];

  return (
    <section className="lesson-video lesson-document" aria-label={label}>
      <div className="lesson-video__head">
        <FileText size={18} aria-hidden="true" />
        <p className="lesson-video__title">{label}</p>
        <a
          className="lesson-document__open"
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open PDF <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>

      <div className="lesson-document__pages" ref={readerRef}>
        {state.status === 'loading' && (
          <>
            <p className="sr-only" role="status">
              Loading document…
            </p>
            <div className="lesson-document__skeleton" aria-hidden="true" />
          </>
        )}

        {state.status === 'error' && (
          <div className="alert alert-error" role="alert">
            This document could not be displayed here.{' '}
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              Open the PDF
            </a>{' '}
            instead.
          </div>
        )}

        {state.status === 'ready' &&
          pageNumbers.map((number) => (
            <PdfPage
              key={number}
              pdf={pdf}
              number={number}
              total={pdf.numPages}
              width={width}
              label={label}
            />
          ))}
      </div>
    </section>
  );
}
