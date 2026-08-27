// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import useMediaQuery from './useMediaQuery';

/**
 * This decides whether the lesson shows a tab strip or its sections open
 * together, so getting it wrong hides either the task or the learner's own
 * submission behind a control that is not there.
 */

afterEach(() => {
  cleanup();
  delete window.matchMedia;
});

/** A matchMedia stub whose value can be changed, as a real resize would. */
function stubMatchMedia(initial) {
  const listeners = new Set();
  const mql = {
    matches: initial,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    addListener: (fn) => listeners.add(fn),
    removeListener: (fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => mql);
  return {
    mql,
    set(next) {
      mql.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
    listenerCount: () => listeners.size,
  };
}

describe('useMediaQuery', () => {
  it('reports whether the query matches at mount', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('follows the query when the viewport changes', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);

    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount, so a closed lesson keeps no listener', () => {
    const media = stubMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('falls back to the narrow layout when matchMedia is unavailable', () => {
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    // False means tabs, which still reaches every panel. True would render the
    // wide layout blind and could strand a narrow screen.
    expect(result.current).toBe(false);
  });

  it('supports the deprecated addListener form', () => {
    const listeners = new Set();
    const mql = {
      matches: false,
      addListener: (fn) => listeners.add(fn),
      removeListener: (fn) => listeners.delete(fn),
    };
    window.matchMedia = vi.fn(() => mql);

    const { result, unmount } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    act(() => {
      mql.matches = true;
      listeners.forEach((fn) => fn({ matches: true }));
    });
    expect(result.current).toBe(true);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
