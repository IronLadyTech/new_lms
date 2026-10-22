import { useId } from 'react';
import { PanelRightClose, Search } from 'lucide-react';
import { LESSON_FILTERS } from '../../../utils/lessonFilters';

/**
 * Course content panel.
 *
 * The default is the mobile "Course content" tab, as MBW, 100BM and the phone
 * lesson use it. `variant="column"` is the course content column beside a LEP
 * lesson: lessons done and a gold progress bar, modules and their total time,
 * a button to hide the column, then search and the To do / Submitted filters.
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
  variant = 'default',
  filter = 'all',
  onFilterChange,
  filterCounts = null,
  onHide,
}) {
  const searchId = useId();
  const pct = total > 0 ? Math.round((Math.min(completed, total) / total) * 100) : 0;
  const column = variant === 'column';

  const metaParts = [];
  if (moduleCount > 0) {
    metaParts.push(
      modulesDone > 0 ? `${modulesDone} of ${moduleCount} modules` : `${moduleCount} modules`
    );
  }
  if (total > 0) metaParts.push(`${completed}/${total} lessons`);
  if (durationLabel) metaParts.push(durationLabel);

  return (
    <aside
      className={`lesson-course-rail${column ? ' lesson-course-rail--column' : ''} ${className}`.trim()}
      aria-label="Course content"
    >
      {column ? (
        <header className="lesson-course-rail__head lesson-course-rail__head--column">
          <div className="lesson-course-rail__head-row">
            <h2 className="lesson-course-rail__title">Course content</h2>
            {onHide && (
              <button
                type="button"
                className="lesson-course-rail__hide"
                onClick={onHide}
                aria-label="Hide course content"
                title="Hide course content"
              >
                <PanelRightClose size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          {total > 0 && (
            <div className="lesson-course-rail__progress">
              <p className="lesson-course-rail__progress-row">
                <span>
                  <strong>{Math.min(completed, total)}</strong> of {total} lessons
                </span>
                <span>{pct}%</span>
              </p>
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
              {moduleCount > 0 && (
                <p className="lesson-course-rail__progress-row lesson-course-rail__progress-row--muted">
                  <span>
                    {durationLabel
                      ? `${moduleCount} modules · ${durationLabel}`
                      : `${moduleCount} modules`}
                  </span>
                  <span>{`${modulesDone} of ${moduleCount} modules`}</span>
                </p>
              )}
            </div>
          )}
        </header>
      ) : (
        <header className="lesson-course-rail__head">
          <div className="lesson-course-rail__head-row">
            <h2 className="lesson-course-rail__title">Course content</h2>
            <span className="lesson-course-rail__pct" aria-label={`${pct}% complete`}>
              {pct}%
            </span>
          </div>
          {metaParts.length > 0 && (
            <p className="lesson-course-rail__meta">{metaParts.join(' · ')}</p>
          )}
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
      )}

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

      {column && onFilterChange && (
        <div className="lesson-course-rail__filters" role="group" aria-label="Filter lessons">
          {LESSON_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="lesson-course-rail__filter"
              aria-pressed={filter === f.id}
              onClick={() => onFilterChange(f.id)}
            >
              {f.label}
              {filterCounts && (
                <span className="lesson-course-rail__filter-count">{filterCounts[f.id] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="lesson-course-rail__body">{children}</div>
    </aside>
  );
}
