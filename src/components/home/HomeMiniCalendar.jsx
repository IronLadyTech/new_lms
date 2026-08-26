import { useMemo } from 'react';
import { Link } from 'react-router-dom';

/** Local ISO day (YYYY-MM-DD), matching how events store `date`. */
function isoDay(date) {
  return date.toLocaleDateString('en-CA');
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday-first offset for a month's first cell. */
function leadingBlanks(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  return (firstDay + 6) % 7;
}

/**
 * Month-at-a-glance strip for the dashboard rail.
 *
 * Read-only by design. It shows the month the learner is standing in and dots
 * the days that actually carry events — no month stepping, because the full
 * calendar is one click away and a second navigable calendar is a second thing
 * to keep in sync. Dots come only from events already loaded for this page, so
 * a day is never marked on a guess.
 *
 * @param {object} props
 * @param {{ id: string, date?: string, type?: string }[]} props.events
 * @param {Date} [props.today] — injectable for tests
 */
export default function HomeMiniCalendar({ events = [], today = new Date() }) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayIso = isoDay(today);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev?.date) continue;
      const list = map.get(ev.date);
      if (list) list.push(ev);
      else map.set(ev.date, [ev]);
    }
    return map;
  }, [events]);

  /*
   * Nothing this month means nothing to glance at. A bare 31-cell grid reads as
   * a broken widget rather than an empty one, so the strip stands down and lets
   * the panel's own empty state speak.
   */
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const hasEventsThisMonth = useMemo(
    () => [...byDay.keys()].some((iso) => iso.startsWith(monthPrefix)),
    [byDay, monthPrefix]
  );

  const cells = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out = [];
    for (let i = 0; i < leadingBlanks(year, month); i += 1) out.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = isoDay(new Date(year, month, day));
      out.push({ day, iso, events: byDay.get(iso) || [] });
    }
    return out;
  }, [year, month, byDay]);

  const monthLabel = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  if (!hasEventsThisMonth) return null;

  return (
    <div className="home-mini-cal">
      <p className="home-mini-cal__month">{monthLabel}</p>

      <div className="home-mini-cal__grid" role="presentation">
        {DAY_LABELS.map((label) => (
          <abbr key={label} className="home-mini-cal__dow" title={label}>
            {label.slice(0, 1)}
          </abbr>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} className="home-mini-cal__blank" />;

          const isToday = cell.iso === todayIso;
          const count = cell.events.length;
          const className = [
            'home-mini-cal__day',
            isToday ? 'home-mini-cal__day--today' : '',
            count ? 'home-mini-cal__day--has-events' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const inner = (
            <>
              <span className="home-mini-cal__num">{cell.day}</span>
              {count > 0 && (
                <span className="home-mini-cal__dots">
                  {/* Three is the cap the cell can hold legibly; the count stays
                      in the label so nothing is silently hidden. */}
                  {cell.events.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={`home-mini-cal__dot home-mini-cal__dot--${ev.type || 'general'}`}
                    />
                  ))}
                </span>
              )}
            </>
          );

          if (!count) {
            return (
              <span key={cell.iso} className={className}>
                {inner}
              </span>
            );
          }

          return (
            <Link
              key={cell.iso}
              to={`/app/calendar?date=${encodeURIComponent(cell.iso)}`}
              className={className}
              aria-label={`${cell.day} ${monthLabel} — ${count} ${count === 1 ? 'event' : 'events'}`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
