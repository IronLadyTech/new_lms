import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function LessonSearchDialog({
  open,
  onClose,
  taskStates = [],
  onSelect,
  programLabel = 'Program',
  getTaskLabel = (ts) => ts?.task?.title || ts?.task?.id || 'Lesson',
}) {
  const [query, setQuery] = useState('');
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useFocusTrap(open, panelRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) {
      setQuery('');
      return undefined;
    }
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = '';
      window.clearTimeout(timer);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = taskStates.filter((ts) => ts?.task?.id);
    if (!q) return list.slice(0, 15);
    return list
      .filter((ts) => {
        const title = getTaskLabel(ts).toLowerCase();
        const id = (ts.task.id || '').toLowerCase();
        const phase = (ts.task.phase || '').toLowerCase();
        return title.includes(q) || id.includes(q) || phase.includes(q);
      })
      .slice(0, 25);
  }, [query, taskStates, getTaskLabel]);

  if (!open) return null;

  return createPortal(
    <div className="lesson-search-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        className="lesson-search"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lesson-search-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="lesson-search__head">
          <Search size={18} aria-hidden="true" />
          <h2 id="lesson-search-title" className="lesson-search__title">
            Search {programLabel} lessons
          </h2>
          <button type="button" className="lesson-search__close icon-btn" onClick={onClose} aria-label="Close search">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="lesson-search__field field">
          <label htmlFor="lesson-search-input">Lesson name or section</label>
          <input
            id="lesson-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter lessons…"
            autoComplete="off"
          />
        </div>
        <ul className="lesson-search__results" role="listbox" aria-label="Matching lessons">
          {results.length === 0 ? (
            <li className="lesson-search__empty muted">No lessons match your search.</li>
          ) : (
            results.map((ts) => (
              <li key={ts.task.id}>
                <button
                  type="button"
                  className="lesson-search__item"
                  role="option"
                  onClick={() => {
                    onSelect?.(ts.task.id);
                    onClose?.();
                  }}
                >
                  <span className="lesson-search__item-title">{getTaskLabel(ts)}</span>
                  {ts.task.phase && <span className="muted lesson-search__item-meta">{ts.task.phase}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="muted lesson-search__hint">Tip: press Ctrl+K (or ⌘K) anywhere on this program page.</p>
      </div>
    </div>,
    document.body
  );
}
