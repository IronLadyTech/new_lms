import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/** Results shown at once. The count line always reports the true match total. */
const RESULT_LIMIT = 25;

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
  const itemRefs = useRef([]);

  useFocusTrap(open, panelRef, { onEscape: onClose });

  /**
   * Arrow keys move real DOM focus between result buttons rather than emulating a
   * listbox with aria-activedescendant. Native focus means Enter, screen-reader
   * announcement, and the focus ring all work with no ARIA to keep in sync.
   */
  const focusItem = (index) => {
    const items = itemRefs.current.filter(Boolean);
    if (!items.length) return;
    const next = (index + items.length) % items.length;
    items[next]?.focus();
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(0);
    }
  };

  const onItemKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index === 0) inputRef.current?.focus();
      else focusItem(index - 1);
    }
  };

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

  const { results, matchCount, totalCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = taskStates.filter((ts) => ts?.task?.id);
    const matches = q
      ? list.filter((ts) => {
          const title = getTaskLabel(ts).toLowerCase();
          const id = (ts.task.id || '').toLowerCase();
          const phase = (ts.task.phase || '').toLowerCase();
          return title.includes(q) || id.includes(q) || phase.includes(q);
        })
      : list;

    return {
      results: matches.slice(0, RESULT_LIMIT),
      matchCount: matches.length,
      totalCount: list.length,
    };
  }, [query, taskStates, getTaskLabel]);

  if (!open) return null;

  // Drop refs for rows that no longer exist so arrow navigation never hits a stale node.
  itemRefs.current.length = results.length;

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
          <button
            type="button"
            className="lesson-search__close icon-btn"
            onClick={onClose}
            aria-label="Close search"
          >
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
            onKeyDown={onInputKeyDown}
            placeholder="Type to filter lessons…"
            autoComplete="off"
          />
        </div>
        <p className="lesson-search__count muted" role="status" aria-live="polite">
          {matchCount === 0
            ? 'No lessons match your search.'
            : matchCount > results.length
              ? `Showing ${results.length} of ${matchCount} matching lessons — keep typing to narrow.`
              : `${matchCount} of ${totalCount} lesson${totalCount === 1 ? '' : 's'}`}
        </p>
        <ul className="lesson-search__results">
          {results.map((ts, index) => (
            <li key={ts.task.id}>
              <button
                type="button"
                className="lesson-search__item"
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                onKeyDown={(e) => onItemKeyDown(e, index)}
                onClick={() => {
                  onSelect?.(ts.task.id);
                  onClose?.();
                }}
              >
                <span className="lesson-search__item-title">{getTaskLabel(ts)}</span>
                {ts.task.phase && (
                  <span className="muted lesson-search__item-meta">{ts.task.phase}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted lesson-search__hint">
          Press ↑ ↓ to move, Enter to open. Ctrl+K (or ⌘K) opens this search anywhere on the program
          page.
        </p>
      </div>
    </div>,
    document.body
  );
}
