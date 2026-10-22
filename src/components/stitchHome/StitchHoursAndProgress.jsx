import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ChevronDown } from 'lucide-react';

const PERIOD_OPTIONS = [
  { id: 'day', label: 'This day' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
];

function ymdLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function summarize(counts) {
  const max = Math.max(...counts, 1);
  const bars = counts.map((c) => Math.round((c / max) * 100));
  const activeDays = counts.filter((c) => c > 0).length;
  const totalActions = counts.reduce((sum, c) => sum + c, 0);
  return {
    bars,
    activeDays,
    totalActions,
    totalLabel: activeDays ? `${activeDays} day${activeDays === 1 ? '' : 's'}` : '0 days',
    trendLabel: totalActions ? `${totalActions} action${totalActions === 1 ? '' : 's'}` : 'No activity yet',
    trendDirection: totalActions ? 'up' : 'flat',
  };
}

function buildPeriodView(periodId, dailyCounts = []) {
  const byDate = new Map((dailyCounts || []).map((row) => [row.date, row.count || 0]));
  const now = new Date();

  if (periodId === 'day') {
    const key = ymdLocal(now);
    const count = byDate.get(key) || 0;
    const summary = summarize([count]);
    return {
      ...summary,
      periodLabel: 'This day',
      dayLabels: ['Today'],
      totalLabel: count ? `${count} action${count === 1 ? '' : 's'}` : '0 actions',
      trendLabel: count ? 'Today' : 'No activity yet',
    };
  }

  if (periodId === 'month') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const counts = [];
    const dayLabels = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      counts.push(byDate.get(ymdLocal(d)) || 0);
      dayLabels.push(day === 1 || day % 7 === 0 || day === daysInMonth ? String(day) : '');
    }
    return {
      ...summarize(counts),
      periodLabel: 'This month',
      dayLabels,
    };
  }

  /* week (default) */
  const monday = startOfWeekMonday(now);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const counts = dayLabels.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return byDate.get(ymdLocal(d)) || 0;
  });
  return {
    ...summarize(counts),
    periodLabel: 'This week',
    dayLabels,
  };
}

export default function StitchHoursAndProgress({ hoursSpent, progressTracks }) {
  const tracks = progressTracks?.length
    ? progressTracks
    : [{ id: 'empty', title: 'No enrolled programmes yet', label: '—', filled: 0, total: 6 }];

  const [period, setPeriod] = useState('week');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const view = useMemo(
    () => buildPeriodView(period, hoursSpent?.dailyCounts || []),
    [period, hoursSpent?.dailyCounts],
  );

  const selected = PERIOD_OPTIONS.find((o) => o.id === period) || PERIOD_OPTIONS[1];

  return (
    <div className="sh-two-col">
      <section className="sh-card">
        <div className="sh-hours-head">
          <h2 className="sh-section-title">Hours spent</h2>
          <div className={`sh-filter-wrap sh-hours-period${menuOpen ? ' is-open' : ''}`} ref={menuRef}>
            <button
              type="button"
              className="sh-chip"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {selected.label}
              <ChevronDown size={9} strokeWidth={2} aria-hidden />
            </button>
            {menuOpen && (
              <ul className="sh-filter-menu sh-hours-period__menu" role="listbox" aria-label="Hours period">
                {PERIOD_OPTIONS.map((opt) => (
                  <li key={opt.id} role="option" aria-selected={opt.id === period}>
                    <button
                      type="button"
                      className={`sh-filter-option${opt.id === period ? ' is-active' : ''}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setPeriod(opt.id);
                        setMenuOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="sh-hours-total">
          <strong>{view.totalLabel}</strong>
          <span className="sh-trend">
            <ArrowUp size={9} strokeWidth={2.5} aria-hidden />
            {view.trendLabel}
          </span>
        </div>

        <div
          className={`sh-hours-bars${period === 'month' ? ' sh-hours-bars--month' : ''}${
            period === 'day' ? ' sh-hours-bars--day' : ''
          }`}
          aria-hidden
        >
          {view.bars.map((h, i) => (
            <span
              key={`${view.dayLabels[i] || 'd'}-${i}`}
              className="sh-hours-bar"
              style={{ height: `${Math.max(h, h > 0 ? 8 : 0)}%` }}
            />
          ))}
        </div>
        <div
          className={`sh-hours-days${period === 'month' ? ' sh-hours-days--month' : ''}`}
          aria-hidden
        >
          {view.dayLabels.map((d, i) => (
            <span key={`${d || 'x'}-${i}`}>{d}</span>
          ))}
        </div>
      </section>

      <section className="sh-card">
        <h2 className="sh-section-title">Your progress</h2>
        {tracks.map((track) => (
          <div key={track.id} className="sh-track">
            <div className="sh-track__row">
              <span className="sh-track__title">{track.title}</span>
              <span className="sh-track__label">{track.label}</span>
            </div>
            <div className="sh-track__segs" aria-hidden>
              {Array.from({ length: track.total }, (_, i) => (
                <span
                  key={i}
                  className={`sh-track__seg${i < track.filled ? ' is-filled' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
