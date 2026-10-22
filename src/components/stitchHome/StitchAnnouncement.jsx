export default function StitchAnnouncement({ announcements }) {
  const primary = announcements?.[0];
  if (!primary) return null;
  const extra = Math.max(0, (announcements?.length || 0) - 1);

  return (
    <section className="sh-card sh-card--sm">
      <div className="sh-announce">
        <span>
          <span className="sh-announce__title">{primary.title}</span>
          <span className="sh-announce__sub">{primary.subtitle}</span>
        </span>
        {extra > 0 && <span className="sh-pill">+{extra} more</span>}
      </div>
    </section>
  );
}
