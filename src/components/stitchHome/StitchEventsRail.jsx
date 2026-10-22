import { useEffect, useMemo, useRef, useState } from 'react';
import { buildGoogleCalendarUrl } from '../../utils/eventLinks';
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  Video,
} from 'lucide-react';

const ACTIVITY_ICONS = {
  done: CheckCircle2,
  submit: Send,
  live: Video,
};

const PROGRAM_FILTERS = [
  { id: 'all', label: 'All programmes' },
  { id: 'lep', label: 'LEP' },
  { id: 'bm100', label: '100BM' },
  { id: 'mbw', label: 'MBW' },
];

const PERIOD_FILTERS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'all', label: 'All time' },
];

function buildCalendarCells(year, month, dotsByDay, eventsByDay, todayIso) {
  const first = new Date(year, month, 1);
  const jsDay = first.getDay();
  const mondayIndex = jsDay === 0 ? 6 : jsDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < mondayIndex; i += 1) cells.push({ type: 'pad', key: `pad-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${monthPrefix(year, month)}-${String(day).padStart(2, '0')}`;
    const column = (mondayIndex + day - 1) % 7;
    cells.push({
      type: 'day',
      key: `d-${day}`,
      day,
      iso,
      isToday: iso === todayIso,
      dots: dotsByDay[day] || [],
      events: eventsByDay[day] || [],
      /* The hover card is ~190px wide against a ~35px cell, so at the ends of a
         row a centred card would run outside the panel — which clips it, since
         three ancestors have non-visible overflow. These push it inward. */
      edge: column <= 1 ? 'start' : column >= 5 ? 'end' : '',
    });
  }
  return cells;
}

/** "19:00" from "19:00:00", and a range when the event has an end. */
function timeRange(ev) {
  const start = (ev?.time || '').slice(0, 5);
  if (!start) return '';
  const end = (ev?.endTime || '').slice(0, 5);
  return end ? `${start}–${end}` : start;
}

function monthPrefix(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function buildDayIndex(events, year, month) {
  const prefix = monthPrefix(year, month);
  const dotsByDay = {};
  const eventsByDay = {};
  (events || []).forEach((ev) => {
    if (!ev?.date?.startsWith(prefix)) return;
    const day = Number(String(ev.date).slice(8, 10));
    if (!day) return;
    const dot = ev.program || 'mbw';
    if (!dotsByDay[day]) dotsByDay[day] = [];
    if (!dotsByDay[day].includes(dot)) dotsByDay[day].push(dot);
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(ev);
  });
  /* Earliest first, so the hover card reads in the order the day happens. */
  Object.values(eventsByDay).forEach((list) =>
    list.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')))
  );
  return { dotsByDay, eventsByDay };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function matchesPeriod(createdAtMs, periodId) {
  if (!createdAtMs || periodId === 'all') return true;
  const now = new Date();
  const startToday = startOfDay(now);
  if (periodId === 'daily') return createdAtMs >= startToday;
  if (periodId === 'weekly') {
    const weekAgo = startToday - 6 * 24 * 60 * 60 * 1000;
    return createdAtMs >= weekAgo;
  }
  if (periodId === 'monthly') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return createdAtMs >= monthStart;
  }
  return true;
}

function FilterDropdown({ label, options, value, onChange, open, onToggle, menuRef }) {
  const selected = options.find((o) => o.id === value) || options[0];

  return (
    <div className={`sh-filter-wrap${open ? ' is-open' : ''}`} ref={menuRef}>
      <button
        type="button"
        className="sh-filter"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        {selected.label}
        <ChevronDown size={9} strokeWidth={2} aria-hidden />
      </button>
      {open && (
        <ul className="sh-filter-menu" role="listbox" aria-label={label}>
          {options.map((opt) => (
            <li key={opt.id} role="option" aria-selected={opt.id === value}>
              <button
                type="button"
                className={`sh-filter-option${opt.id === value ? ' is-active' : ''}`}
                onClick={() => onChange(opt.id)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StitchEventsRail({ calendar, events, activity }) {
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const [viewYear, setViewYear] = useState(calendar?.year ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(calendar?.month ?? new Date().getMonth());
  const [programFilter, setProgramFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('daily');
  const [openMenu, setOpenMenu] = useState(null); // 'program' | 'period' | null
  const programRef = useRef(null);
  const periodRef = useRef(null);

  useEffect(() => {
    if (calendar?.year == null || calendar?.month == null) return;
    setViewYear(calendar.year);
    setViewMonth(calendar.month);
  }, [calendar?.year, calendar?.month]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const onPointer = (e) => {
      const t = e.target;
      if (programRef.current?.contains(t) || periodRef.current?.contains(t)) return;
      setOpenMenu(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu]);

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const monthLabel = useMemo(
    () => new Date(viewYear, viewMonth, 1).toLocaleString('en-US', { month: 'long' }),
    [viewYear, viewMonth]
  );

  const { dotsByDay, eventsByDay } = useMemo(
    () => buildDayIndex(events, viewYear, viewMonth),
    [events, viewYear, viewMonth]
  );

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth, dotsByDay, eventsByDay, calendar?.todayIso),
    [viewYear, viewMonth, dotsByDay, eventsByDay, calendar?.todayIso]
  );

  const monthEvents = useMemo(() => {
    const prefix = monthPrefix(viewYear, viewMonth);
    return (events || []).filter((ev) => ev?.date?.startsWith(prefix));
  }, [events, viewYear, viewMonth]);

  const filteredActivity = useMemo(() => {
    return (activity || []).filter((item) => {
      const programOk = programFilter === 'all' || item.program === programFilter;
      const periodOk = matchesPeriod(item.createdAtMs, periodFilter);
      return programOk && periodOk;
    });
  }, [activity, programFilter, periodFilter]);

  return (
    <aside className="sh-rail">
      <div className="sh-rail-head">
        <h2 className="sh-rail-heading">Events</h2>
        <a className="sh-rail-link" href="/app/calendar">
          View all <ChevronRight size={10} strokeWidth={2} aria-hidden />
        </a>
      </div>

      <div className="sh-cal-card">
        <div className="sh-cal-body">
          <div className="sh-cal-head">
            <button
              type="button"
              className="sh-cal-nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden />
            </button>
            <h3 className="sh-cal-title">
              {monthLabel} <span>{viewYear}</span>
            </h3>
            <button
              type="button"
              className="sh-cal-nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <div className="sh-cal-grid">
            {dow.map((d) => (
              <div key={d} className="sh-cal-dow">
                {d}
              </div>
            ))}
            {cells.map((cell) =>
              cell.type === 'pad' ? (
                <div key={cell.key} />
              ) : (
                (() => {
                  const cls = `sh-cal-day${cell.isToday ? ' is-today' : ''}${
                    cell.dots.length ? ' has-events' : ''
                  }`;
                  const inner = (
                    <>
                      <span className="sh-cal-num">{cell.day}</span>
                      {cell.dots.length > 0 && (
                        <div className="sh-cal-dots">
                          {cell.dots.map((p) => (
                            <div key={`${cell.day}-${p}`} className={`sh-dot sh-dot--${p}`} />
                          ))}
                        </div>
                      )}
                    </>
                  );
                  /* Only a day with something on it is a link — linking empty
                     days would promise a page with nothing on it. */
                  const summary = cell.events
                    .map((ev) => [timeRange(ev), ev.title].filter(Boolean).join(' '))
                    .join(', ');
                  return cell.dots.length > 0 ? (
                    <a
                      key={cell.key}
                      className={cls}
                      href={`/app/calendar?date=${encodeURIComponent(cell.iso)}`}
                      aria-label={`${cell.day} ${monthLabel} ${viewYear} — ${summary}`}
                    >
                      {inner}
                      {/* aria-hidden: the same text is already in the label
                          above, and reading it twice helps nobody. */}
                      <span
                        className={`sh-cal-tip${cell.edge ? ` sh-cal-tip--${cell.edge}` : ''}`}
                        aria-hidden="true"
                      >
                        {cell.events.map((ev) => (
                          <span key={ev.id} className="sh-cal-tip__row">
                            {timeRange(ev) ? (
                              <span className="sh-cal-tip__time">{timeRange(ev)}</span>
                            ) : null}
                            <span className="sh-cal-tip__title">{ev.title}</span>
                          </span>
                        ))}
                      </span>
                    </a>
                  ) : (
                    <div key={cell.key} className={cls}>
                      {inner}
                    </div>
                  );
                })()
              )
            )}
          </div>

          <div className="sh-event-list">
            {monthEvents.length === 0 ? (
              <p className="sh-event__date" style={{ margin: 0 }}>
                No sessions in {monthLabel}.
              </p>
            ) : (
              monthEvents.map((ev) => (
                /*
                 * The row is a container, not a link.
                 *
                 * It used to be a single <a>, and an "add to calendar" control
                 * cannot live inside one — a nested link or button is invalid
                 * markup and browsers disagree about which one a click belongs
                 * to. So the text is the link and the calendar action sits
                 * beside it as its own control: one obvious primary action
                 * (open the session), one secondary.
                 *
                 * It is always visible rather than hover-only, because the
                 * people most likely to want a session on their own calendar
                 * are on a phone, where there is no hover to reveal it.
                 */
                <div key={ev.id} className="sh-event">
                  <div className={`sh-dot sh-dot--lg sh-dot--${ev.program}`} />
                  <a className="sh-event__main" href={ev.href || '/app/calendar'}>
                    <div className="sh-event__title">{ev.title}</div>
                    <div className="sh-event__date">
                      {ev.dateLabel}
                      {timeRange(ev) ? ` · ${timeRange(ev)}` : ''}
                    </div>
                  </a>
                  <a
                    className="sh-event__gcal"
                    href={buildGoogleCalendarUrl(ev)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Add ${ev.title} to Google Calendar (opens in a new tab)`}
                    title="Add to Google Calendar"
                  >
                    <CalendarPlus size={14} strokeWidth={2} aria-hidden />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <section className="sh-card">
        <h2 className="sh-section-title">Recent activity</h2>
        <div className="sh-activity-scroll">
          <ol className="sh-activity-feed">
            {filteredActivity.length === 0 ? (
              <li className="sh-activity-item">
                <span className="sh-activity-text">
                  No activity for this filter — try another programme or period.
                </span>
              </li>
            ) : (
              filteredActivity.map((item) => {
                const Icon = ACTIVITY_ICONS[item.kind] || CheckCircle2;
                return (
                  <li key={item.id} className="sh-activity-item">
                    <span className={`sh-activity-marker sh-activity-marker--${item.kind}`}>
                      <Icon size={12} strokeWidth={2} aria-hidden />
                    </span>
                    <span>
                      <span className="sh-activity-text">
                        <b>{item.actor}</b> {item.verb} <b>{item.target}</b>
                      </span>
                      <span className="sh-activity-when">
                        <Calendar size={10} strokeWidth={2} aria-hidden />
                        {item.when}
                      </span>
                    </span>
                  </li>
                );
              })
            )}
          </ol>
        </div>

        <div className="sh-filters">
          <FilterDropdown
            label="Programme filter"
            options={PROGRAM_FILTERS}
            value={programFilter}
            open={openMenu === 'program'}
            menuRef={programRef}
            onToggle={() => setOpenMenu((m) => (m === 'program' ? null : 'program'))}
            onChange={(id) => {
              setProgramFilter(id);
              setOpenMenu(null);
            }}
          />
          <FilterDropdown
            label="Period filter"
            options={PERIOD_FILTERS}
            value={periodFilter}
            open={openMenu === 'period'}
            menuRef={periodRef}
            onToggle={() => setOpenMenu((m) => (m === 'period' ? null : 'period'))}
            onChange={(id) => {
              setPeriodFilter(id);
              setOpenMenu(null);
            }}
          />
        </div>
      </section>
    </aside>
  );
}
