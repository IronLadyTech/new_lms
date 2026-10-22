import { Lock } from 'lucide-react';
import '../../styles/stitchPrograms.css';

/**
 * The programme poster, in one place.
 *
 * LEP, 100BM and MBW were each being drawn three times over: once on the
 * dashboard, once on Browse Courses and — until this — as a coloured initials
 * chip on Track Progress. Three copies of the same identity drift, and the chip
 * had already drifted far enough to read as a different product.
 *
 * The artwork is drawn in CSS. The files in /programs/*.png are finished
 * posters that carry their own printed title, so laying one underneath put a
 * second, offset copy of every heading behind the real one.
 *
 * Styles live beside the rest of the poster rules in styles/stitchPrograms.css,
 * scoped to `.stitch-home`, which every page using this is inside. The import
 * below is the component's own: Track Progress happened to get that stylesheet
 * because HomeNext statically imports the dashboard, which is luck rather than
 * a dependency — the same gap left the profile panel rendering unstyled.
 */

/** Identity per programme. The only copy — read it, do not restate it. */
export const PROGRAMME_POSTER = {
  lep: {
    code: 'LEP',
    nameLines: ['Leadership', 'Essentials'],
    line: 'Build confidence. Maximize growth.',
    color: '#F5B301',
  },
  /* The id is '100bm', not 'bm100' — see PROGRAMS in data/programTypes. */
  '100bm': {
    code: '100BM',
    nameLines: ['100 Board', 'Members'],
    line: 'Fast-track your overdue growth.',
    color: '#231F20',
  },
  mbw: {
    code: 'MBW',
    nameLines: ['Master of', 'Business', 'Warfare'],
    line: 'Reach the C-suite. Scale your growth.',
    color: '#C8102E',
  },
};

/** Falls back to the programme's own title rather than rendering an empty card. */
export function posterMetaFor(id, title = '') {
  return (
    PROGRAMME_POSTER[id] || {
      code: (title || id || '').slice(0, 6).toUpperCase(),
      nameLines: String(title || 'Programme').split(' '),
      line: '',
      color: '#C8102E',
    }
  );
}

/**
 * @param {object} props
 * @param {{nameLines: string[], code: string, line?: string}} props.p
 * @param {boolean} [props.small] - drops the tagline, for a tighter card
 * @param {boolean} [props.compact] - the thumbnail size, for list headings
 * @param {boolean} [props.locked]
 */
export default function ProgrammePoster({ p, small = false, compact = false, locked = false }) {
  return (
    <span className={`il-poster${compact ? ' il-poster--sm' : ''}`}>
      <span className="il-poster__t">
        {p.nameLines.map((l) => (
          <span key={l} className="il-poster__line">
            {l}
          </span>
        ))}
      </span>
      <span className="il-poster__p">Program</span>
      {!small && !compact && p.line ? <span className="il-poster__s">{p.line}</span> : null}
      <span className="il-poster__tag">{p.code}</span>
      <span className="il-poster__rule" aria-hidden />
      {locked ? (
        <span className="il-poster__lock">
          <Lock size={12} strokeWidth={2.25} aria-hidden />
          Locked
        </span>
      ) : null}
    </span>
  );
}
