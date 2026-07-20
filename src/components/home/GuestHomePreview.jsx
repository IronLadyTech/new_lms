import { Link } from 'react-router-dom';
import { Clock, Layers, Lock } from 'lucide-react';
import CourseThumbnail from '../CourseThumbnail';
import { getCourseProgramMeta } from '../../utils/courseDisplay';

/**
 * Guest preview of Iron Lady programs — STATIC data from COMPANY_CONTEXT
 * (no Firestore read, no fake numbers). Journey order: LEP → 100BM → MBW.
 */
const GUEST_PROGRAMS = [
  {
    code: 'LEP',
    name: 'Leadership Essentials Program',
    desc: 'Entry leadership program — 2 live days plus 4 weeks of weekly challenges.',
  },
  {
    code: '100BM',
    name: '100 Board Members Program',
    desc: 'Mid–senior acceleration — online cohort with weekly Q&A.',
  },
  {
    code: 'MBW',
    name: 'Master of Business Warfare',
    desc: 'Advanced C-suite track — quarterly in-person weekends plus monthly online sessions.',
  },
];

export default function GuestHomePreview() {
  return (
    <div className="guest-preview">
      <div className="guest-preview__note">
        <Lock size={16} aria-hidden="true" />
        <span>
          You&apos;re browsing as a guest. Journey order: LEP → 100BM → MBW. Sign in to open your
          enrolled track.
        </span>
        <Link to="/auth/login" className="btn btn-primary btn-sm">
          Sign in
        </Link>
      </div>

      <div className="course-grid course-grid--rich">
        {GUEST_PROGRAMS.map((p) => {
          const meta = getCourseProgramMeta(p.code);
          const codeKey = p.code.toLowerCase();
          return (
            <article
              key={p.code}
              className={`course-card course-card--rich course-card--stacked course-card--brand-cover course-card--${codeKey}`}
            >
              <div className="course-card__media">
                <CourseThumbnail course={{ code: p.code, title: p.name }} size="card" />
              </div>

              <div className="course-card__body">
                <h3 className="course-card__title">{p.name}</h3>
                <p className="course-card__desc">{p.desc}</p>

                <ul className="course-card__meta" aria-label="Program details">
                  <li>
                    <Clock size={14} aria-hidden="true" />
                    {meta.duration}
                  </li>
                  <li>
                    <Layers size={14} aria-hidden="true" />
                    {meta.format}
                  </li>
                </ul>

                <div className="course-card__actions">
                  <Link to="/auth/login" className="btn btn-primary btn-sm">
                    Sign in to continue
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
