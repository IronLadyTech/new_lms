import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchShell from './StitchShell';
import ProgrammePoster, { posterMetaFor } from './ProgrammePoster';
import '../../styles/stitchProgress.css';

/*
 * Track Progress — programmes group their modules, each programme leads with
 * the module in progress, finished modules fold away at the foot.
 *
 * Every figure here is counted from the learner's own submissions. The design
 * this came from also carried a projected finish date, a "time on task" total,
 * "live sessions attended" and a certificates shelf; none of those are recorded
 * anywhere in the LMS, so they are absent rather than filled in.
 */

const Ico = {
  play: <path d="M8 5v14l11-7z" />,
  tick: <path d="M20 6L9 17l-5-5" />,
  chev: <path d="M6 9l6 6 6-6" />,
  left: <path d="M15 18l-6-6 6-6" />,
  right: <path d="M9 18l6-6-6-6" />,
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
};

const S = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    {d}
  </svg>
);

function Row({ g, m, onOpen }) {
  if (m.state === 'live') {
    return (
      <div className="lrow" style={{ '--pc': g.color }}>
        <div>
          <p className="lr-t">{m.title}</p>
          <p className="lr-m">
            <b>
              Module {m.n} of {g.total}
            </b>
            <span className="lsep">·</span>
            <b>{m.pct}% complete</b>
            <span className="lsep">·</span>
            <span>
              {m.done} of {m.total} tasks
            </span>
          </p>
          <div className="lr-bar">
            <i style={{ width: `${m.pct}%` }} />
          </div>
        </div>

        {/* the exact next thing, and one button to do it */}
        {m.next ? (
          <div className="lnext">
            <div className="lnext-b">
              <p className="lnext-t">{m.next.title}</p>
              <p className="lnext-m">
                <S d={Ico.play} />
                {m.next.kind}
              </p>
            </div>
            <button
              type="button"
              className="lbtn sh-btn-primary"
              onClick={() => onOpen(m.next.href)}
            >
              {m.next.cta}
            </button>
          </div>
        ) : (
          <div className="lnext lnext--none">
            <p className="lnext-m">Nothing waiting in this module.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="lrow idle">
      <div>
        <p className="lr-t">{m.title}</p>
        <p className="lr-m">
          <span>
            Module {m.n} of {g.total}
          </span>
          <span className="lsep">·</span>
          {m.state === 'done' && (
            <span className="lstate done">
              Completed
              {m.total ? ` · ${m.total} task${m.total === 1 ? '' : 's'}` : ''}
            </span>
          )}
          {m.state === 'locked' && (
            <span className="lstate">{m.why || 'Opens later in the programme.'}</span>
          )}
          {m.state === 'idle' && <span className="lstate">Not started</span>}
        </p>
      </div>
    </div>
  );
}

/** How many modules ahead of the live one stay open before the fold. */
const LOOKAHEAD = 2;

/** One collapsible shelf. Both folds on a programme are the same object. */
function Fold({ label, done, children }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const bodyRef = useRef(null);

  /*
   * Collapsing from the foot of a nine-row list would otherwise leave her
   * wherever the page happened to land once those rows disappeared — measured
   * at 347px above the top of the screen. Bring the shelf's own header back
   * into view instead, so she ends up looking at the thing she just closed.
   *
   * This has to wait for the height transition to finish. Scheduling it a frame
   * later is too early: the shelf is still full height, so `nearest` decides it
   * is already on screen and does nothing, and the jump happens afterwards. The
   * timer is a fallback for a transition that never reports finishing.
   */
  const collapse = () => {
    setOpen(false);
    const body = bodyRef.current;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      body?.removeEventListener('transitionend', onEnd);
      rootRef.current?.scrollIntoView({ block: 'nearest' });
    };
    const onEnd = (e) => {
      if (e.target === body) settle();
    };
    body?.addEventListener('transitionend', onEnd);
    window.setTimeout(settle, 500);
  };

  return (
    <div ref={rootRef} className={`lfold${open ? ' open' : ''}${done ? ' lfold--done' : ''}`}>
      <button
        type="button"
        className="lfold-h"
        aria-expanded={open}
        onClick={() => (open ? collapse() : setOpen(true))}
      >
        {done && (
          <span className="ltick">
            <S d={Ico.tick} />
          </span>
        )}
        {label}
        <svg className="lchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          {Ico.chev}
        </svg>
      </button>
      <div ref={bodyRef} className="lfold-b" aria-hidden={!open}>
        <div className="lfold-i">
          {children}
          <button type="button" className="lfold-f" onClick={collapse} tabIndex={open ? 0 : -1}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              {Ico.chev}
            </svg>
            Show less
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ g, onOpen }) {
  /*
   * Order by what she needs now: the module in progress, then a short look
   * ahead. Everything past that folds.
   *
   * Listing all 15 LEP modules, all 8 MBW and all 6 of 100BM put 25 rows on the
   * page — 5.7 phone screens — of which exactly three could be acted on. The
   * live module stays open because it is the answer the page exists to give;
   * collapsing the programme itself would hide it behind a click.
   */
  const { open, folded, done } = useMemo(() => {
    const live = g.modules.filter((m) => m.state === 'live');
    const ahead = g.modules.filter((m) => m.state === 'idle' || m.state === 'locked');
    return {
      open: [...live, ...ahead.slice(0, LOOKAHEAD)],
      folded: ahead.slice(LOOKAHEAD),
      done: g.modules.filter((m) => m.state === 'done'),
    };
  }, [g.modules]);

  return (
    <section className={`lgrp ${g.id}`} style={{ '--pc': g.color }}>
      <div className="lgrp-h">
        {/* The same poster the dashboard and the programme panel draw — one
            programme, one likeness, wherever she meets it. */}
        <span className="lgrp-art">
          <ProgrammePoster p={posterMetaFor(g.id, g.name)} compact />
        </span>
        <span className="lgrp-n">{g.name}</span>
        <span className="lgrp-c">{g.total} modules</span>
      </div>

      <div className="lstack">
        {open.map((m) => (
          <Row key={m.id} g={g} m={m} onOpen={onOpen} />
        ))}

        {folded.length > 0 && (
          <Fold label={`${folded.length} more module${folded.length === 1 ? '' : 's'} ahead`}>
            {folded.map((m) => (
              <Row key={m.id} g={g} m={m} onOpen={onOpen} />
            ))}
          </Fold>
        )}

        {done.length > 0 && (
          <Fold done label={`${done.length} completed module${done.length === 1 ? '' : 's'}`}>
            {done.map((m) => (
              <Row key={m.id} g={g} m={m} onOpen={onOpen} />
            ))}
          </Fold>
        )}
      </div>
    </section>
  );
}

/** Activity calendar. A day is marked when the learner submitted something. */
function Calendar({ byDate, todayIso }) {
  const today = useMemo(() => new Date(`${todayIso}T12:00:00`), [todayIso]);
  const [view, setView] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const cells = useMemo(() => {
    const { year, month } = view;
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const total = new Date(year, month + 1, 0).getDate();
    const prevTotal = new Date(year, month, 0).getDate();
    const out = [];
    for (let i = 0; i < lead; i += 1) out.push({ pad: true, n: prevTotal - lead + 1 + i });
    for (let d = 1; d <= total; d += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      out.push({ n: d, iso, count: byDate[iso] || 0 });
    }
    return out;
  }, [view, byDate]);

  const label = new Date(view.year, view.month, 1).toLocaleString('en', {
    month: 'long',
    year: 'numeric',
  });

  const step = (by) =>
    setView((v) => {
      const d = new Date(v.year, v.month + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <section className="lcard">
      <div className="lcal-h">
        <span className="lcal-m">{label}</span>
        <span className="lcal-nav">
          <button type="button" aria-label="Previous month" onClick={() => step(-1)}>
            <S d={Ico.left} />
          </button>
          <button type="button" aria-label="Next month" onClick={() => step(1)}>
            <S d={Ico.right} />
          </button>
        </span>
      </div>
      <div className="ldow">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="ldays">
        {cells.map((c, i) =>
          c.pad ? (
            <span key={`p${i}`} className="lday pad" aria-hidden>
              {c.n}
            </span>
          ) : (
            <span key={c.iso} className={`lday${c.iso === todayIso ? ' today' : ''}`}>
              {c.n}
              {c.count > 0 && <em className={c.count >= 3 ? 'busy' : undefined} />}
              {c.count > 0 && (
                <span className="sr-only">
                  {c.count} task{c.count === 1 ? '' : 's'}
                </span>
              )}
            </span>
          )
        )}
      </div>
      <div className="lcal-key">
        <span>
          <i className="d" />A task completed
        </span>
        <span>
          <i />
          Three or more
        </span>
      </div>
    </section>
  );
}

export default function StitchProgress({ data, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('in-progress');
  const progress = data.progress || { programmes: [], activity: {} };
  const { programmes } = progress;
  const activity = progress.activity || {};

  const open = (href) => {
    if (href) navigate(href);
  };

  /* A programme belongs under Completed only when every module is done. */
  const { inProgress, completed } = useMemo(
    () => ({
      inProgress: programmes.filter((g) => g.modules.some((m) => m.state !== 'done')),
      completed: programmes.filter(
        (g) => g.modules.length > 0 && g.modules.every((m) => m.state === 'done')
      ),
    }),
    [programmes]
  );

  const shown = tab === 'completed' ? completed : inProgress;

  return (
    <StitchShell nav={data.nav} learner={data.learner} activeId="progress" onLogout={onLogout}>
      <div className="il-learning">
        <div className="lpage">
          <div className="lhead">
            <p className="lkicker">
              <S d={Ico.cal} /> Track progress
            </p>
            <h1>Your modules</h1>
          </div>

          {/* the tabs are the heading — the nav already says Track Progress */}
          <div className="ltabs" role="tablist" aria-label="Programme progress">
            {[
              ['in-progress', 'In progress', inProgress.length],
              ['completed', 'Completed', completed.length],
            ].map(([k, label, count]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className={`ltab${tab === k ? ' on' : ''}`}
                onClick={() => setTab(k)}
              >
                {label}
                <span className="lcount">{count}</span>
              </button>
            ))}
          </div>

          <div className="lcols">
            <div>
              {shown.length === 0 ? (
                <p className="lempty">
                  {tab === 'completed'
                    ? 'No programme is finished yet. Modules you complete appear here.'
                    : 'No programme in progress yet.'}
                </p>
              ) : (
                shown.map((g) => <Group key={g.id} g={g} onOpen={open} />)
              )}
            </div>

            <aside className="lrail">
              <Calendar byDate={activity.byDate || {}} todayIso={activity.todayIso || ''} />

              <section className="lcard">
                <p className="lfour-t">Last 4 weeks</p>
                <div className="lfour">
                  {(activity.fourWeeks || []).map((f) => (
                    <div key={f.label}>
                      <div className="n">{f.value}</div>
                      <div className="l">{f.label}</div>
                    </div>
                  ))}
                </div>
                {activity.note && <p className="lfour-note">{activity.note}</p>}
              </section>
            </aside>
          </div>
        </div>
      </div>
    </StitchShell>
  );
}
