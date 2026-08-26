import { useId } from 'react';
import { Search } from 'lucide-react';

/**
 * Course content panel — TAP-style LMS curriculum chrome.
 * Mobile: Course content tab. Desktop: sticky side rail.
 */
export default function LessonCourseContentRail({
  completed = 0,
  total = 0,
  moduleCount = 0,
  modulesDone = 0,
  durationLabel = '',
  children,
  searchQuery = '',
  onSearchChange,
  className = '',
}) {
  const searchId = useId();
  const pct = total > 0 ? Math.round((Math.min(completed, total) / total) * 100) : 0;

  const metaParts = [];
  if (moduleCount > 0) {
    metaParts.push(
      modulesDone > 0 ? `${modulesDone} of ${moduleCount} modules` : `${moduleCount} modules`
    );
  }
  if (total > 0) metaParts.push(`${completed}/${total} lessons`);
  if (durationLabel) metaParts.push(durationLabel);

  return (
    <aside className={`lesson-course-rail ${className}`.trim()} aria-label="Course content">
      <header className="lesson-course-rail__head">
        <div className="lesson-course-rail__head-row">
          <h2 className="lesson-course-rail__title">Course content</h2>
          <span className="lesson-course-rail__pct" aria-label={`${pct}% complete`}>
            {pct}%
          </span>
        </div>
        {metaParts.length > 0 && <p className="lesson-course-rail__meta">{metaParts.join(' · ')}</p>}
        <div
          className="lesson-course-rail__bar"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Course progress"
        >
          <span className="lesson-course-rail__bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <div className="lesson-course-rail__search">
        <label htmlFor={searchId} className="sr-only">
          Search lessons
        </label>
        <Search size={16} strokeWidth={2} className="lesson-course-rail__search-icon" aria-hidden />
        <input
          id={searchId}
          type="search"
          className="lesson-course-rail__search-input"
          placeholder="Search lessons"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="lesson-course-rail__body">{children}</div>
    </aside>
  );
}
