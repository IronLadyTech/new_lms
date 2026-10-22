import { useEffect, useMemo, useState } from 'react';
import StitchShell from './StitchShell';
import { buildGoogleCalendarUrl, normalizeEventLink } from '../../utils/eventLinks';
import '../../styles/stitchSchedule.css';

/**
 * Iron Lady — Schedule.
 *
 * Ported from the supplied design. Two things changed so it runs on real data
 * rather than the demo set:
 *
 *  - Sessions come from the dashboard payload, where an event is
 *    `{ id, title, date, time, endTime, program, type, linkUrl }`. They are
 *    mapped into the `{ start, end, prog, kind }` shape the design expects, so
 *    the design's own logic is left alone.
 *  - "Watch recording" only renders when a recording exists. Nothing stores one
 *    today, so a finished session shows "Ended" rather than a button that goes
 *    nowhere. The same applies to Join when a session has no link.
 */

export const PROGRAMS = {
  lep: { name: 'Leadership Essentials', short: 'LEP', color: '#F5B301' },
  bm100: { name: '100 Board Members', short: '100BM', color: '#231F20' },
  mbw: { name: 'Master of Business Warfare', short: 'MBW', color: '#C8102E' },
};

const TYPE_LABEL = {
  class: 'Live class',
  deadline: 'Deadline',
  meeting: 'Meeting',
  general: 'Session',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateLabel = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Relative time only where it helps. Past about two weeks it repeats what
 * the date already said — and a list of "in 54 days" reads as
 * "nothing is happening", which is the opposite of the intent.
 */
function whenLabel(d, now) {
  const ms = d - now;
  const days = Math.round(ms / 86400000);
  if (ms < 0) {
    const ago = Math.abs(days);
    if (ago === 0) return 'earlier today';
    if (ago === 1) return 'yesterday';
    return ago < 14 ? `${ago} days ago` : null;
  }
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return days <= 14 ? `in ${days} days` : null;
}

/** Dashboard event -> the shape this page is built around. */
function toSession(ev) {
  const [y, m, d] = String(ev?.date || '')
    .split('-')
    .map(Number);
  if (!y || !m || !d) return null;

  const [sh, sm] = (ev.time || '').split(':').map(Number);
  const start = new Date(y, m - 1, d, sh || 0, sm || 0, 0, 0);

  let end;
  if (ev.endTime) {
    const [eh, em] = ev.endTime.split(':').map(Number);
    end = new Date(y, m - 1, d, eh || 0, em || 0, 0, 0);
    if (end <= start) end = new Date(start.getTime() + 90 * 60000);
  } else {
    end = new Date(start.getTime() + 90 * 60000);
  }

  return {
    id: ev.id,
    title: ev.title,
    start,
    end,
    prog: PROGRAMS[ev.program] ? ev.program : 'mbw',
    kind: TYPE_LABEL[ev.type] || TYPE_LABEL.general,
    joinUrl: normalizeEventLink(ev.linkUrl),
    /* Forward-compatible: nothing writes this yet, so the button stays hidden
       rather than pointing at a link that does not exist. */
    recordingUrl: normalizeEventLink(ev.recordingUrl),
    raw: ev,
  };
}

/* ---------- small pieces ---------- */
const IcoClock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IcoCal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const IcoArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const IcoPlay = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export default function StitchSchedule({ data, events = [], onLogout }) {
  const now0 = useMemo(() => new Date(), []);
  const all = useMemo(
    () =>
      events
        .map(toSession)
        .filter(Boolean)
        .sort((a, b) => a.start - b.start),
    [events]
  );

  const [tick, setTick] = useState(0); // re-render so the countdown stays true
  const [viewY, setViewY] = useState(now0.getFullYear());
  const [viewM, setViewM] = useState(now0.getMonth());
  const [selected, setSelected] = useState(null);
  const [active, setActive] = useState({ lep: true, bm100: true, mbw: true });

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const visible = useMemo(() => all.filter((s) => active[s.prog]), [all, active, tick]);

  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace('_', ' ');
    } catch {
      return 'local time';
    }
  }, []);

  const openJoin = (s) => s.joinUrl && window.open(s.joinUrl, '_blank', 'noopener,noreferrer');
  const openWatch = (s) =>
    s.recordingUrl && window.open(s.recordingUrl, '_blank', 'noopener,noreferrer');
  const addToCalendar = (s) =>
    window.open(buildGoogleCalendarUrl(s.raw), '_blank', 'noopener,noreferrer');

  /* ---------- next session ---------- */
  const upcoming = visible.filter((s) => s.end > now);
  const next = upcoming[0];
  const nextLive = next && now >= next.start && now <= next.end;
  const nextMins = next ? Math.round((next.start - now) / 60000) : null;
  const nextJoinable = Boolean(next?.joinUrl) && (nextLive || (nextMins <= 15 && nextMins >= 0));

  /* ---------- calendar ---------- */
  const byDay = useMemo(() => {
    const m = {};
    visible.forEach((s) => {
      (m[dayKey(s.start)] ||= []).push(s);
    });
    return m;
  }, [visible]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(viewY, viewM + 1, 0).getDate();
    const prevTotal = new Date(viewY, viewM, 0).getDate();
    const out = [];
    for (let i = 0; i < lead; i += 1) out.push({ pad: true, n: prevTotal - lead + 1 + i });
    for (let d = 1; d <= total; d += 1) out.push({ n: d, date: new Date(viewY, viewM, d) });
    const tail = (7 - ((lead + total) % 7)) % 7;
    for (let j = 1; j <= tail; j += 1) out.push({ pad: true, n: j });
    return out;
  }, [viewY, viewM]);

  /* ---------- list ---------- */
  const items = visible.filter((s) =>
    selected
      ? sameDay(s.start, selected)
      : s.start.getFullYear() === viewY && s.start.getMonth() === viewM
  );

  const shiftMonth = (delta) => {
    let m = viewM + delta;
    let y = viewY;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewM(m);
    setViewY(y);
    setSelected(null);
  };

  const goToday = () => {
    setViewY(now0.getFullYear());
    setViewM(now0.getMonth());
    setSelected(null);
  };

  return (
    <StitchShell nav={data.nav} learner={data.learner} activeId="schedule" onLogout={onLogout}>
      <div className="il-schedule">
        <div className="wrap">
          <div className="head">
            <div>
              <p className="kicker">
                <IcoCal /> Schedule
              </p>
              <h1>Your sessions</h1>
            </div>
            <p className="tz">
              All times <b>{tz}</b>
            </p>
          </div>

          {/* ---------- filters ---------- */}
          <div className="filters">
            {Object.entries(PROGRAMS).map(([k, p]) => (
              <button
                key={k}
                type="button"
                className="chip"
                aria-pressed={active[k]}
                onClick={() => setActive((a) => ({ ...a, [k]: !a[k] }))}
              >
                <i style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>

          {/* ---------- next session ---------- */}
          <section className="next">
            {!next ? (
              <div className="next-l">
                <p className="next-k">Nothing scheduled</p>
                <p className="next-t">No upcoming sessions in your programmes</p>
              </div>
            ) : (
              <>
                <div className="next-l">
                  <p className="next-k">{nextLive ? 'Happening now' : 'Next session'}</p>
                  <p className="next-t">{next.title}</p>
                  <div className="next-m">
                    <span className="prog">
                      <i style={{ background: PROGRAMS[next.prog].color }} />
                      {PROGRAMS[next.prog].short}
                    </span>
                    <span>
                      <IcoClock />
                      {hhmm(next.start)}–{hhmm(next.end)}
                    </span>
                    <span>
                      <IcoCal />
                      {dateLabel(next.start)}
                    </span>
                  </div>
                </div>
                <div className="next-r">
                  {nextLive ? (
                    <span className="live-now">
                      <i /> Live now
                    </span>
                  ) : nextMins < 60 ? (
                    <span className="count">
                      Starts in <b>{nextMins} min</b>
                    </span>
                  ) : nextMins < 1440 ? (
                    <span className="count">
                      Starts in <b>{Math.round(nextMins / 60)} hours</b>
                    </span>
                  ) : (
                    <span className="count">{dateLabel(next.start)}</span>
                  )}
                  <span style={{ display: 'flex', gap: 8 }}>
                    {/* The disabled label says why, rather than leaving a dead button. */}
                    <button
                      type="button"
                      className="btn btn-join"
                      disabled={!nextJoinable}
                      onClick={() => openJoin(next)}
                    >
                      {nextJoinable ? (
                        <>
                          Join session <IcoArrow />
                        </>
                      ) : next.joinUrl ? (
                        'Opens 15 min before'
                      ) : (
                        'No link yet'
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => addToCalendar(next)}
                    >
                      Add to calendar
                    </button>
                  </span>
                </div>
              </>
            )}
          </section>

          <div className="cols">
            {/* ---------- calendar ---------- */}
            <section className="card cal">
              <div className="cal-head">
                <span className="cal-m">
                  {MONTHS[viewM]} {viewY}
                </span>
                <span className="nav">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </span>
              </div>

              <div className="dow">
                {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>

              <div className="days">
                {cells.map((c, i) =>
                  c.pad ? (
                    <span key={`p${i}`} className="day pad">
                      {c.n}
                    </span>
                  ) : (
                    <button
                      key={c.n}
                      type="button"
                      className={`day${sameDay(c.date, now0) ? ' today' : ''}${
                        selected && sameDay(c.date, selected) ? ' sel' : ''
                      }`}
                      aria-pressed={Boolean(selected && sameDay(c.date, selected))}
                      aria-label={
                        byDay[dayKey(c.date)]?.length
                          ? `${c.n} ${MONTHS[viewM]}, ${byDay[dayKey(c.date)].length} session${
                              byDay[dayKey(c.date)].length > 1 ? 's' : ''
                            }`
                          : `${c.n} ${MONTHS[viewM]}, no sessions`
                      }
                      onClick={() => setSelected((s) => (s && sameDay(s, c.date) ? null : c.date))}
                    >
                      <span className="n">{c.n}</span>
                      <span className="dots">
                        {(byDay[dayKey(c.date)] || []).slice(0, 3).map((s) => (
                          <i key={s.id} style={{ background: PROGRAMS[s.prog].color }} />
                        ))}
                      </span>
                    </button>
                  )
                )}
              </div>

              <div className="cal-foot">
                <button type="button" className="today-btn" onClick={goToday}>
                  Back to today
                </button>
              </div>
            </section>

            {/* ---------- list ---------- */}
            <section className="card list">
              <div className="list-head">
                <span className="list-t">
                  {selected ? dateLabel(selected) : `${MONTHS[viewM]} ${viewY}`}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="list-c">
                    {items.length ? `${items.length} session${items.length > 1 ? 's' : ''}` : ''}
                  </span>
                  {selected && (
                    <button type="button" className="clear" onClick={() => setSelected(null)}>
                      Clear date
                    </button>
                  )}
                </span>
              </div>

              <div className="rows">
                {items.length === 0 ? (
                  <EmptyMonth
                    selected={selected}
                    month={MONTHS[viewM]}
                    next={visible.find((s) => s.start > now)}
                    onGo={(s) => {
                      setViewY(s.start.getFullYear());
                      setViewM(s.start.getMonth());
                      setSelected(null);
                    }}
                  />
                ) : (
                  items.map((s) => {
                    const past = s.end < now;
                    const live = now >= s.start && now <= s.end;
                    const rel = whenLabel(s.start, now);
                    const joinable =
                      Boolean(s.joinUrl) &&
                      (live || ((s.start - now) / 60000 <= 15 && s.start > now));
                    const soon = rel?.startsWith('in ') && parseInt(rel.slice(3), 10) <= 3;

                    return (
                      <div key={s.id} className={`row${past ? ' past' : ''}`}>
                        <div className="row-time">
                          {hhmm(s.start)}–{hhmm(s.end)}
                          <small>{dateLabel(s.start)}</small>
                        </div>
                        <div className="row-b">
                          <p className="row-t">{s.title}</p>
                          <p className="row-m">
                            <span className="prog">
                              <i style={{ background: PROGRAMS[s.prog].color }} />
                              {PROGRAMS[s.prog].short}
                            </span>
                            <span className="sep">·</span>
                            <span>{s.kind}</span>
                            {live && (
                              <>
                                <span className="sep">·</span>
                                <span className="live-now">
                                  <i /> Live now
                                </span>
                              </>
                            )}
                            {rel && !live && (
                              <>
                                <span className="sep">·</span>
                                <span className={soon ? 'soon' : undefined}>{rel}</span>
                              </>
                            )}
                          </p>
                        </div>
                        <div className="row-a">
                          {past ? (
                            s.recordingUrl ? (
                              <button type="button" className="rec" onClick={() => openWatch(s)}>
                                <IcoPlay /> Watch recording
                              </button>
                            ) : (
                              /* No recording is stored for this session, so a
                                 button here would do nothing when pressed. */
                              <span className="ended">Ended</span>
                            )
                          ) : joinable ? (
                            <button
                              type="button"
                              className="btn btn-join"
                              style={{ padding: '11px 18px', fontSize: 12.5 }}
                              onClick={() => openJoin(s)}
                            >
                              Join
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Add ${s.title} to Google Calendar (opens in a new tab)`}
                              onClick={() => addToCalendar(s)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                aria-hidden
                              >
                                <rect x="3" y="5" width="18" height="16" rx="2" />
                                <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </StitchShell>
  );
}

/* an empty month is information, not a failure */
function EmptyMonth({ selected, month, next, onGo }) {
  return (
    <div className="empty">
      <div className="empty-i">
        <IcoCal />
      </div>
      <p className="empty-t">Nothing scheduled {selected ? 'on this day' : `in ${month}`}</p>
      {next ? (
        <>
          <p className="empty-s">
            Your next is <b>{next.title}</b> — {dateLabel(next.start)}
          </p>
          <div className="empty-b">
            <button type="button" className="today-btn" onClick={() => onGo(next)}>
              Go to that month
            </button>
          </div>
        </>
      ) : (
        <p className="empty-s">No upcoming sessions in the programmes you have selected.</p>
      )}
    </div>
  );
}
