/*
 * pdf.js, loaded only when a lesson actually has a document to show.
 *
 * It is large and most lessons never need it, so it is a dynamic import rather
 * than part of the lesson page's bundle. The worker is served from our own
 * origin by Vite (`?url`), which also keeps it working inside the app's WebView.
 *
 * Kept in its own module so tests can replace it: jsdom has no canvas to draw on.
 */
let loading = null;

export function loadPdfjs() {
  if (!loading) {
    loading = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
      .then(([pdfjs, worker]) => {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfjs;
      })
      .catch((err) => {
        // A failed chunk load must not poison every later lesson.
        loading = null;
        throw err;
      });
  }
  return loading;
}
