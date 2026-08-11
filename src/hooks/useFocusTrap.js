import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Trap focus inside a dialog and restore focus to the trigger on close.
 */
export function useFocusTrap(active, containerRef, { onEscape, restoreFocus = true } = {}) {
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef?.current) return undefined;

    triggerRef.current = document.activeElement;
    const container = containerRef.current;

    const focusables = () =>
      [...container.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled);
    const first = () => focusables()[0];
    const last = () => {
      const list = focusables();
      return list[list.length - 1];
    };

    first()?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const start = first();
      const end = last();
      if (!start || !end) return;

      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreFocus && typeof triggerRef.current?.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [active, containerRef, onEscape, restoreFocus]);
}
