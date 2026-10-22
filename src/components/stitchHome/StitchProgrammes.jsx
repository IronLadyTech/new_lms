import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, ChartColumn, Clock, Layers, X } from 'lucide-react';
import ProgrammePoster, { posterMetaFor } from './ProgrammePoster';
import '../../styles/stitchPrograms.css';

/**
 * Your programmes — closed poster cards; tap opens panel (desktop) / sheet (mobile).
 * Maps live `programmes` from stitch home dashboard into the panel UI.
 */

const SPEC_ICONS = {
  clock: Clock,
  layers: Layers,
  chart: ChartColumn,
};

function toPanelProgram(p) {
  const meta = posterMetaFor(p.id, p.title);

  /*
   * Read from the access state, not from the CTA string. Matching on button
   * text meant the chip silently changed meaning whenever a label was reworded
   * — and the CTA is now "Speak to our Counsellor" for both locked states,
   * which that matching could not tell apart.
   */
  const chip = p.statusLabel || (p.locked ? 'Locked' : 'Enrolled');

  const spec = (p.meta || []).map((m) => [m.icon || 'clock', m.label]);
  if (p.locked) {
    spec.push(['chart', p.state === 'upcoming' ? 'Not started yet' : 'Access locked']);
  }

  return {
    id: p.id,
    code: meta.code,
    name: p.title,
    nameLines: meta.nameLines,
    line: meta.line,
    chip,
    cta: p.locked
      ? p.ctaLabel === 'Upcoming'
        ? 'View details'
        : 'Request access'
      : p.ctaLabel || 'Open tasks',
    spec,
    href: p.href || '/app/home',
    locked: Boolean(p.locked),
    description: p.description || '',
    progressPct: p.progressPct || 0,
    progressLabel: p.progressLabel || '',
    canOpenTasks: Boolean(p.canOpenTasks),
    state: p.state || '',
    statusLabel: p.statusLabel || '',
    statusMessage: p.statusMessage || '',
    marketingUrl: p.marketingUrl || '',
  };
}

function ProgramCard({ p, onClick }) {
  const ref = useRef(null);
  const raf = useRef(null);

  /*
   * The tilt used to require `(hover: hover) and (pointer: fine)`, so a phone
   * got no card motion at all — the effect the desktop cards are built around
   * simply did not exist there. `pointermove` fires for touch too, while the
   * finger is down, so the same tilt now runs off a drag. Only reduced-motion
   * opts out.
   */
  const tiltEnabled =
    typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const move = (e) => {
    if (!tiltEnabled || raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.classList.add('is-tilting');
      el.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2)}deg`);
      el.style.setProperty(
        '--rx',
        `${(((e.clientY - r.top) / r.height - 0.5) * -9).toFixed(2)}deg`
      );
    });
  };

  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    []
  );

  /*
   * Reveal on scroll.
   *
   * The desktop card's motion is all hover-driven, and hover has no touch
   * equivalent — the tilt now runs off `pointermove`, but that needs a finger
   * dragged across the card, and nobody drags a card they mean to tap. So on a
   * phone the grid still read as dead. Scroll is the one gesture every visitor
   * makes, so the cards animate in off it instead.
   *
   * The class is added by JS, so if this never runs the cards are simply
   * visible rather than stuck at opacity 0.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    el.classList.add('has-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <button
      ref={ref}
      type="button"
      className="il-prog-card"
      aria-haspopup="dialog"
      onPointerMove={move}
      onPointerLeave={leave}
      onPointerUp={leave}
      onPointerCancel={leave}
      onClick={() => onClick(ref.current)}
    >
      <ProgrammePoster p={p} locked={p.locked} />
      <span className="il-prog-tap">
        <i aria-hidden /> Tap to open
      </span>
    </button>
  );
}

export default function StitchProgrammes({ programmes = [] }) {
  const navigate = useNavigate();
  const items = (programmes || []).map(toPanelProgram);
  const [openId, setOpenId] = useState(null);
  const scrimRef = useRef(null);
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const drag = useRef({ active: false, startY: 0, dy: 0 });

  const current = items.find((p) => p.id === openId) || items[0];
  const isOpen = openId !== null && Boolean(current);

  const open = (id, el) => {
    openerRef.current = el || null;
    setOpenId(id);
  };

  /**
   * Every scrollable ancestor, plus the document.
   *
   * Restoring one element is not enough: the browser may scroll any ancestor
   * (or the page itself) to bring the focused card into view, and which one
   * differs by width — this dashboard scrolls an inner `.sh-main` on desktop
   * and the document on a phone. Capturing them all means the right one is
   * always among them.
   */
  const scrollAncestors = (el) => {
    const out = [];
    let node = el?.parentElement;
    while (node && node !== document.documentElement) {
      const oy = getComputedStyle(node).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight)
        out.push(node);
      node = node.parentElement;
    }
    const doc = document.scrollingElement || document.documentElement;
    if (doc && !out.includes(doc)) out.push(doc);
    return out;
  };

  const close = useCallback(() => {
    setOpenId(null);
    /*
     * Focus returns to the card that opened the panel, so a keyboard user is
     * not dumped at the top of the document. `preventScroll` asks the browser
     * not to scroll it into view; where that is ignored, the scroll lock below
     * puts the position back on unlock.
     *
     * This deliberately does NOT capture and restore the offset itself. It once
     * did, and the two repairs fought: by the time close ran, a browser that
     * clamps on overflow-hidden had already zeroed the position, so this
     * captured the zero and then re-applied it over the lock's correct value.
     */
    openerRef.current?.focus?.({ preventScroll: true });
  }, []);

  /*
   * Scroll lock, without losing the reader's place.
   *
   * This used to be `document.body.style.overflow = 'hidden'`. Where the
   * document is the scroller — which it is on a phone, and on any layout where
   * the page itself scrolls rather than an inner pane — hiding body overflow
   * collapses the scrollable content, and the browser clamps the scroll offset
   * to 0. The page jumped to the top the instant a card was tapped, and closing
   * could not put back a position that had already been discarded.
   *
   * So the lock is applied to whichever element actually scrolls, and its
   * offset is captured before locking and written back after unlocking.
   */
  useEffect(() => {
    if (!isOpen) return undefined;

    const scroller = scrollAncestors(openerRef.current)[0];
    if (!scroller) return undefined;

    const isDoc = scroller === document.scrollingElement || scroller === document.documentElement;
    const target = isDoc ? document.body : scroller;

    const top = scroller.scrollTop;
    const left = scroller.scrollLeft;
    const prevOverflow = target.style.overflow;

    target.style.overflow = 'hidden';

    return () => {
      target.style.overflow = prevOverflow;
      /* Written after the unlock, so the element is scrollable again when the
         offset is restored — setting it while still hidden is a no-op. */
      scroller.scrollTop = top;
      scroller.scrollLeft = left;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const onPointerDown = (e) => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    if (panelRef.current?.scrollTop > 0) return;
    if (e.target.closest('button, a')) return;
    drag.current = { active: true, startY: e.clientY, dy: 0 };
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!drag.current.active || !panelRef.current) return;
    const dy = Math.max(0, e.clientY - drag.current.startY);
    drag.current.dy = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
    if (scrimRef.current) {
      scrimRef.current.style.opacity = String(Math.max(0, 1 - dy / 420));
    }
  };

  const endDrag = () => {
    if (!drag.current.active || !panelRef.current) return;
    const { dy } = drag.current;
    drag.current.active = false;
    panelRef.current.style.transition = '';
    panelRef.current.style.transform = '';
    if (scrimRef.current) scrimRef.current.style.opacity = '';
    if (dy > 110) close();
  };

  const goOpen = () => {
    if (!current?.href) return;
    close();
    navigate(current.href);
  };

  /*
   * This section is the learner's own programmes, so a learner with none has an
   * empty one. Returning null made the whole section vanish, which reads as a
   * page that failed to load rather than one with nothing in it yet — and it
   * left them with no route to the catalogue.
   */
  if (!items.length) {
    return (
      <section className="il-programs sh-full">
        <div className="il-programs__wrap">
          <p className="il-programs__kicker">Programs</p>
          <h2 className="il-programs__title">Your programmes</h2>
          <p className="il-programs__dek">
            You are not enrolled in a programme yet. Browse what Iron Lady offers to get started.
          </p>
          <Link
            className="il-prog-btn il-prog-btn--primary il-programs__browse"
            to="/app/home#courses"
          >
            Browse courses
            <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="il-programs sh-full">
      <div className="il-programs__wrap">
        <p className="il-programs__kicker">Programs</p>
        <h2 className="il-programs__title">Your programmes</h2>
        <p className="il-programs__dek">Tap a programme to see what&apos;s inside it.</p>

        <div className="il-programs__grid">
          {items.map((p) => (
            <ProgramCard key={p.id} p={p} onClick={(el) => open(p.id, el)} />
          ))}
        </div>
      </div>

      <div
        ref={scrimRef}
        className={`il-prog-scrim${isOpen ? ' is-open' : ''}`}
        onClick={(e) => {
          if (e.target === scrimRef.current) close();
        }}
      >
        {current ? (
          <div
            ref={panelRef}
            className="il-prog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="il-p-name"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <button type="button" className="il-prog-close" onClick={close} aria-label="Close">
              <X size={16} strokeWidth={2.4} aria-hidden />
            </button>

            <div className="il-prog-panel__copy">
              <div className="il-prog-panel__top">
                <span className="il-prog-panel__brand">Iron Lady</span>
                <span className="il-prog-panel__chip">{current.chip}</span>
              </div>

              <p className="il-prog-panel__code">{current.code}</p>
              <h3 className="il-prog-panel__name" id="il-p-name">
                {current.nameLines.map((l) => (
                  <span key={l} className="il-poster__line">
                    {l}
                  </span>
                ))}
              </h3>
              {current.line ? <p className="il-prog-panel__line">{current.line}</p> : null}

              {current.description ? (
                <p className="il-prog-panel__desc">{current.description}</p>
              ) : null}

              <div className="il-prog-panel__spec">
                {current.spec.map(([icon, text]) => {
                  const Icon = SPEC_ICONS[icon] || Clock;
                  return (
                    <span key={text}>
                      <Icon size={14} strokeWidth={1.75} aria-hidden />
                      {text}
                    </span>
                  );
                })}
              </div>

              {/* Only drawn once there are milestones to count — a 0-of-0 bar
                  says nothing and reads as broken. */}
              {current.progressLabel ? (
                <div className="il-prog-progress">
                  <span
                    className="il-prog-progress__track"
                    role="progressbar"
                    aria-valuenow={current.progressPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={current.progressLabel}
                  >
                    <span
                      className="il-prog-progress__fill"
                      style={{ width: `${current.progressPct}%` }}
                    />
                  </span>
                  <span className="il-prog-progress__label">{current.progressLabel}</span>
                </div>
              ) : null}

              {/*
               * Open tasks only exists for someone who can actually open them.
               * Everyone else gets the programme's public page — an outward
               * link, so it is an anchor rather than a router push, and it
               * says where it goes.
               */}
              <div className="il-prog-panel__cta">
                {/* One action. The second button went to the same place under a
                    different name, which reads as a choice that is not one. */}
                {current.canOpenTasks ? (
                  <button
                    type="button"
                    className="il-prog-btn il-prog-btn--primary"
                    onClick={goOpen}
                  >
                    {current.cta}
                    <ArrowRight size={15} strokeWidth={2.4} aria-hidden />
                  </button>
                ) : current.marketingUrl ? (
                  <a
                    className="il-prog-btn il-prog-btn--primary"
                    href={current.marketingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View programme
                    <ExternalLink size={15} strokeWidth={2.4} aria-hidden />
                    <span className="il-sr-only"> (opens iamironlady.com in a new tab)</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div className="il-prog-panel__art">
              <ProgrammePoster p={current} small locked={current.locked} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
