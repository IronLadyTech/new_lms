/**
 * Tap Academy–style course content panel: always visible on program overview
 * with program totals and an expandable module accordion inside.
 */
export default function ProgramCourseContent({
  moduleCount,
  completedMilestones,
  totalMilestones,
  children,
}) {
  const pct =
    totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <section
      className="program-course-content mbw-program-card"
      aria-labelledby="program-course-content-heading"
    >
      <header className="program-course-content__header">
        <h2 id="program-course-content-heading" className="program-course-content__title">
          Course content
        </h2>
        <p className="program-course-content__stats">
          {moduleCount} modules · {totalMilestones} lessons · {pct}% complete
        </p>
      </header>
      <div className="program-course-content__body">{children}</div>
    </section>
  );
}
