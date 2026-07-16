import { Link } from 'react-router-dom';
import { Clock, Layers, Lock } from 'lucide-react';
import CourseThumbnail from '../CourseThumbnail';
import { getCourseProgramMeta } from '../../utils/courseDisplay';

/**
 * Guest preview of Iron Lady programs — STATIC data from COMPANY_CONTEXT
 * (no Firestore read, no fake numbers). Replaces the bare locked panel so
 * guests see what they'd get and are invited to sign in.
 */
const GUEST_PROGRAMS = [
  {
    code: 'MBW',
    name: 'Master of Business Warfare',
    desc: 'Advanced C-suite track — quarterly in-person weekends plus monthly online sessions.',
  },
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
];

export default function GuestHomePreview() {
  return (
    <div className="guest-preview">
      <div className="guest-preview__note">
        <Lock size={16} aria-hidden="true" />
        <span>You&apos;re browsing as a guest. Sign in to enroll and track your progress.</span>
        <Link to="/auth/login" className="btn btn-primary btn-sm">
          Sign in
        </Link>
      </div>

      <div className="course-grid course-grid--rich">
        {GUEST_PROGRAMS.map((p) => {
          const meta = getCourseProgramMeta(p.code);
          const codeKey = p.code.toLowerCase();
          return (
            <article key={p.code} className={`course-card course-card--rich course-card--${codeKey}`}>
              <div className="course-card__media">
                <CourseThumbnail course={{ code: p.code, title: p.name }} size="card" />
                <span className={`course-card__code course-card__code--${codeKey}`}>{p.code}</span>
              </div>

              <div className="course-card__body">
                <div className="course-card__tags">
                  <span className={`course-card__tag course-card__tag--${codeKey}`}>{meta.tag}</span>
                </div>
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
                    Sign in to enroll
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
