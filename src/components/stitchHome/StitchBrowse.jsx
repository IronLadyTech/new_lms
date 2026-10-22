import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchShell from './StitchShell';
import '../../styles/stitchBrowse.css';

/**
 * Iron Lady — Browse Courses.
 *
 * A filmstrip of every programme; the one at the front is described in the
 * single card below it. No numbering — these are not taken in order, and people
 * join 100BM or MBW directly.
 *
 * Ported from the supplied design. What differs, and why:
 *
 *  - Programmes come from `data.catalogue`, so the copy, duration, format,
 *    progress and access state are the ones stored for each programme rather
 *    than a hardcoded list.
 *  - Facts the product does not store are not shown. Effort per week, module
 *    counts, cohort start dates and entry requirements were in the design as
 *    sample text; inventing them here would put made-up commitments in front of
 *    someone deciding whether to enrol. The comparison table carries only rows
 *    with real answers.
 *  - The proof strip (78,000+ trained, 120+ countries, 3.2x salary growth,
 *    1,400+ board seats) is left out for the same reason — those are marketing
 *    claims this app has no source for.
 */

/* Poster wordmarks. Splitting a title on spaces gives ragged lines, so the
   break points are set per programme. */
const POSTER = {
  lep: { lines: ['Leadership', 'Essentials'], code: 'LEP', color: '#F5B301', step: 'Foundation' },
  /* The id is '100bm', not 'bm100' — see PROGRAMS in data/programTypes. Keyed
     wrongly, this programme silently fell back to a one-line wordmark and the
     default red, which looked plausible enough to miss. */
  '100bm': {
    lines: ['100 Board', 'Members'],
    code: '100BM',
    color: '#231F20',
    step: 'The boardroom',
  },
  mbw: {
    lines: ['Master of', 'Business', 'Warfare'],
    code: 'MBW',
    color: '#C8102E',
    step: 'The C-suite',
  },
};

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21.4 8 14 2 9.4h7.6z" />
  </svg>
);

function Poster({ p, cls }) {
  const meta = POSTER[p.id] || { lines: [p.title], code: p.id.toUpperCase() };
  return (
    <>
      <span className={`${cls}-t`}>
        {meta.lines.map((l) => (
          <span key={l} style={{ display: 'block' }}>
            {l}
          </span>
        ))}
      </span>
      <span className={`${cls}-p`}>Program</span>
      <span className={cls === 'c' ? 'c-tag' : 'mini-c'}>{meta.code}</span>
    </>
  );
}

export default function StitchBrowse({ data, onLogout }) {
  const navigate = useNavigate();
  const programmes = data.catalogue || [];
  const N = programmes.length;

  /* The recommendation is whatever the learner can join next: the first
     programme they are not already in. */
  const rec = useMemo(() => {
    const notEnrolled = programmes.find((p) => !p.canOpenTasks);
    return notEnrolled?.id || programmes[0]?.id;
  }, [programmes]);

  const [active, setActive] = useState(() =>
    Math.max(
      0,
      programmes.findIndex((p) => p.id === rec)
    )
  );
  const [swap, setSwap] = useState(false);
  const [drag, setDrag] = useState(0);

  const stripRef = useRef(null);
  const cardRef = useRef(null);

  const current = programmes[active];
  const enrolledHere = current?.canOpenTasks;
  const isRec = !enrolledHere && current?.id === rec;

  /* ---------- select, with a short cross-fade on the card ---------- */
  const select = useCallback(
    (i, scroll) => {
      if (!N) return;
      const next = ((i % N) + N) % N;
      setActive((prev) => {
        if (prev !== next) {
          setSwap(true);
          setTimeout(() => setSwap(false), 200);
        }
        return next;
      });
      if (scroll) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [N]
  );

  /* ---------- the rail's geometry ---------- */
  const placeStyle = (i) => {
    const el = stripRef.current;
    const cs = el ? getComputedStyle(el) : null;
    const GAP = parseFloat(cs?.getPropertyValue('--gap')) || 230;
    const TURN = parseFloat(cs?.getPropertyValue('--turn')) || 36;
    const DEEP = parseFloat(cs?.getPropertyValue('--depth')) || 200;

    let d = i - active;
    if (d > N / 2) d -= N; // wrap the short way, so the strip loops
    if (d < -N / 2) d += N;
    const o = d + drag;
    const abs = Math.abs(o);

    return {
      transform: `translateX(${o * GAP}px) translateZ(${-abs * DEEP}px) rotateY(${
        -o * TURN
      }deg) scale(${1 - Math.min(abs, 2) * 0.06})`,
      zIndex: 100 - Math.round(abs * 10),
      opacity: abs > 2.2 ? 0 : Math.max(0, 1 - abs * 0.28),
      // on a light ground, fade rather than darken — brightness goes muddy
      filter: `saturate(${Math.max(0.1, 1 - abs * 0.55)})`,
      transition: drag ? 'none' : undefined,
    };
  };

  /* ---------- drag ----------
     Listeners go on window: a drag starting on a <button> can have its
     pointer events swallowed before they reach the container. */
  const dragState = useRef({ down: false, startX: 0, moved: 0, dragged: false });

  const onPointerDown = (e) => {
    if (e.target.closest('.arm')) return; // arrows stay buttons
    dragState.current = { down: true, startX: e.clientX, moved: 0, dragged: false };
    stripRef.current?.classList.add('dragging');
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e) => {
      const d = dragState.current;
      if (!d.down) return;
      d.moved = e.clientX - d.startX;
      if (Math.abs(d.moved) > 4) d.dragged = true;
      setDrag(-d.moved / 210);
    };
    const up = () => {
      const d = dragState.current;
      if (!d.down) return;
      d.down = false;
      stripRef.current?.classList.remove('dragging');
      setDrag(0);
      if (Math.abs(d.moved) > 55) select(active + (d.moved < 0 ? 1 : -1));
      setTimeout(() => {
        d.dragged = false;
      }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [active, select]);

  /* a drag ends with a click on whatever poster is under the finger */
  const onRailClick = (e) => {
    if (dragState.current.dragged) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const c = e.target.closest('.pcard');
    if (c) select(+c.dataset.i, true);
  };

  /* horizontal trackpad swipe, without trapping vertical scroll */
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    let lock = false;
    const wheel = (e) => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (lock) return;
      lock = true;
      select(active + (e.deltaX > 0 ? 1 : -1));
      setTimeout(() => {
        lock = false;
      }, 320);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [active, select]);

  /* ---------- commitment scale ---------- */

  /**
   * Weeks, from the duration a programme actually stores ("4 weeks",
   * "6 months", "1 year"). Anything unparseable is left off the scale rather
   * than guessed at a position.
   */
  const weeksOf = (p) => {
    const label = (p.meta?.[0]?.label || '').toLowerCase();
    const n = parseFloat(label);
    if (!n) return null;
    if (label.includes('year')) return n * 52;
    if (label.includes('month')) return n * 4.345;
    if (label.includes('week')) return n;
    if (label.includes('day')) return n / 7;
    return null;
  };

  const scale = useMemo(() => {
    const rows = programmes.map((p) => ({ p, weeks: weeksOf(p) })).filter((r) => r.weeks != null);
    if (rows.length < 2) return null;
    const min = Math.min(...rows.map((r) => r.weeks));
    const max = Math.max(...rows.map((r) => r.weeks));
    /* Linear, not logarithmic: the gaps between four weeks, six months and a
       year are the point, and a log axis would flatten exactly that. */
    return rows.map((r) => ({
      ...r,
      pct: max === min ? 50 : ((r.weeks - min) / (max - min)) * 100,
    }));
  }, [programmes]);

  const open = (p) => {
    if (p.canOpenTasks) navigate(p.href);
    else if (p.marketingUrl) window.open(p.marketingUrl, '_blank', 'noopener,noreferrer');
  };

  if (!N || !current) {
    return (
      <StitchShell nav={data.nav} learner={data.learner} activeId="browse" onLogout={onLogout}>
        <div className="il-browse">
          <div className="sheet">
            <header className="ph">
              <h1>Nothing to browse yet</h1>
              <p>Programmes will appear here once they have been published.</p>
            </header>
          </div>
        </div>
      </StitchShell>
    );
  }

  const posterMeta = POSTER[current.id] || {};

  return (
    <StitchShell nav={data.nav} learner={data.learner} activeId="browse" onLogout={onLogout}>
      <div className="il-browse">
        <div className="sheet">
          <header className="ph">
            <h1>Three programmes. Start anywhere.</h1>
          </header>

          {/* ---------- filmstrip ---------- */}
          <div
            ref={stripRef}
            className="strip"
            tabIndex={0}
            role="group"
            aria-roledescription="carousel"
            aria-label="Programmes"
            onPointerDown={onPointerDown}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                select(active - 1);
              }
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                select(active + 1);
              }
            }}
          >
            <div className="rail" onClick={onRailClick}>
              {programmes.map((p, i) => {
                const meta = POSTER[p.id] || {};
                /*
                 * Every card says what it is. Only one programme can be "next
                 * for you", so the others used to fall through to an empty
                 * string and sat there unlabelled between two labelled
                 * neighbours, reading as a card that had failed to load.
                 * `statusLabel` is the access rules' own word for the state —
                 * Upcoming or Locked — rather than a fourth vocabulary.
                 */
                const pip = p.canOpenTasks
                  ? 'Enrolled'
                  : p.id === rec
                    ? 'Next for you'
                    : p.statusLabel || '';
                const quiet = pip !== 'Enrolled' && pip !== 'Next for you';
                const front = i === active && !drag;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`pcard ${p.id}${front ? ' front' : ''}`}
                    data-i={i}
                    style={{ '--cc': meta.color || '#C8102E', ...placeStyle(i) }}
                    aria-label={p.title}
                    aria-current={front ? 'true' : 'false'}
                  >
                    {pip && <span className={`c-pip${quiet ? ' q' : ''}`}>{pip}</span>}
                    <Poster p={p} cls="c" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="arm p"
              onClick={() => select(active - 1)}
              aria-label="Previous programme"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="arm n"
              onClick={() => select(active + 1)}
              aria-label="Next programme"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="dots">
            {programmes.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`dot${i === active ? ' on' : ''}`}
                style={i === active ? { background: POSTER[p.id]?.color } : undefined}
                onClick={() => select(i)}
                aria-label={p.title}
                aria-current={i === active ? 'true' : 'false'}
              />
            ))}
          </div>

          {/* ---------- the one card, for whatever is at the front ---------- */}
          <div className="ladder" aria-live="polite">
            <article
              ref={cardRef}
              className={`prog ${current.id}${isRec ? ' rec' : ''}${swap ? ' swap' : ''}`}
              style={{ '--pc': posterMeta.color || '#C8102E' }}
            >
              <div className="mini">
                <Poster p={current} cls="mini" />
              </div>

              <div className="pbody">
                <div className="tags">
                  {enrolledHere && <span className="tag on">Enrolled</span>}
                  {isRec && <span className="tag rec">Next for you</span>}
                  {posterMeta.step && (
                    <span className="stage-l">
                      <i />
                      {posterMeta.step}
                    </span>
                  )}
                </div>

                <h2 className="p-n">{current.title}</h2>
                {current.description && <p className="p-o">{current.description}</p>}

                <dl className="facts">
                  {(current.meta || []).map((m) => (
                    <div className="fact" key={m.label}>
                      <dt>{m.icon === 'clock' ? 'Length' : 'Format'}</dt>
                      <dd>{m.label}</dd>
                    </div>
                  ))}
                </dl>

                {enrolledHere && current.progressLabel ? (
                  <div className="resume">
                    <p className="resume-l">Pick up at</p>
                    <p className="resume-t">
                      {current.pending
                        ? `${current.pending} task${current.pending === 1 ? '' : 's'} waiting`
                        : 'You are caught up'}
                    </p>
                    <div className="bar">
                      <i style={{ width: `${current.progressPct}%` }} />
                    </div>
                    <small>{current.progressLabel}</small>
                  </div>
                ) : isRec && current.statusMessage ? (
                  <div className="why">
                    <Star />
                    <span>{current.statusMessage}</span>
                  </div>
                ) : null}

                <div className="acts">
                  <button type="button" className="bbtn bbtn-primary" onClick={() => open(current)}>
                    {current.canOpenTasks ? 'Continue' : 'View programme'}
                    <Arrow />
                  </button>
                  {current.marketingUrl && current.canOpenTasks && (
                    <a
                      className="bbtn bbtn-ghost"
                      href={current.marketingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Programme page
                    </a>
                  )}
                  <span className="entry">{current.statusLabel}</span>
                </div>
              </div>
            </article>
          </div>

          {/* ---------- commitment ---------- */}
          {scale && (
            <section className="cmp">
              <div className="sec-h">
                <span className="sec-t">Commitment</span>
                <span className="sec-r" />
              </div>

              <p className="cmp-lead">
                How long each one runs, drawn to the same scale. Pick one to bring it to the front.
              </p>

              <div className="scale">
                <div className="scale__axis" aria-hidden />
                {scale.map(({ p, pct }) => {
                  const i = programmes.findIndex((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`scale__mark${i === active ? ' on' : ''}`}
                      style={{ left: `${pct}%`, '--mc': POSTER[p.id]?.color || '#C8102E' }}
                      onClick={() => select(i, true)}
                      aria-label={`${p.title}, ${p.meta?.[0]?.label}`}
                      aria-current={i === active ? 'true' : 'false'}
                    >
                      <span className="scale__len">{p.meta?.[0]?.label}</span>
                      <span className="scale__dot" />
                    </button>
                  );
                })}
              </div>

              {/* The detail sits under the axis rather than beside each marker,
                  where three labels would collide on a narrow screen. */}
              <ul className="scale__key">
                {scale.map(({ p }) => {
                  const i = programmes.findIndex((x) => x.id === p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        className={`scale__key-btn${i === active ? ' on' : ''}`}
                        onClick={() => select(i, true)}
                      >
                        <span
                          className="scale__key-dot"
                          style={{ background: POSTER[p.id]?.color }}
                          aria-hidden
                        />
                        <span className="scale__key-name">{p.title}</span>
                        <span className="scale__key-meta">{p.meta?.[1]?.label}</span>
                        <span className="scale__key-status">{p.statusLabel}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </StitchShell>
  );
}
