import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query from React.
 *
 * For layout that CSS alone cannot express — here, a tab strip that should not
 * exist on wide screens, where its panels are shown together instead. Hiding
 * the tabs with `display: none` would have left only the selected panel in the
 * DOM and no way to reach the others.
 *
 * Returns false where `matchMedia` is unavailable (jsdom without a stub, SSR),
 * so the narrow layout is the fallback — it renders every panel behind a
 * control, which degrades to something usable rather than to a blank region.
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    // Re-read on subscribe: the query can have changed between render and effect.
    setMatches(mql.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    // Safari < 14 and older jsdom only have the deprecated form.
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}
