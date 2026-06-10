export default function MBWProgramSkeleton() {
  return (
    <div className="mbw-program-skeleton" aria-busy="true" aria-label="Loading program">
      <div className="mbw-program-skeleton__hero" />
      <div className="mbw-program-skeleton__main">
        <div className="mbw-skeleton__bar mbw-skeleton__bar--lg" />
        <div className="mbw-skeleton__panel" />
        <div className="mbw-skeleton__panel" />
      </div>
    </div>
  );
}
