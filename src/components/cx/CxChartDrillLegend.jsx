/** Keyboard-accessible legend rows — same drill as chart segment clicks. */
export default function CxChartDrillLegend({ items = [], onDrill }) {
  const visible = items.filter((item) => item.count > 0);
  if (!visible.length || !onDrill) return null;

  return (
    <div className="cx-chart-drill-legend" role="list" aria-label="Chart breakdown">
      {visible.map((item) => (
        <button
          key={item.key}
          type="button"
          className="cx-chart-drill-legend__row"
          role="listitem"
          onClick={() => onDrill(item.descriptor)}
        >
          {item.color && (
            <span
              className="cx-chart-drill-legend__swatch"
              style={{ background: item.color }}
              aria-hidden
            />
          )}
          <span className="cx-chart-drill-legend__label">{item.label}</span>
          <span className="cx-chart-drill-legend__action muted">View list</span>
          <span className="cx-chart-drill-legend__count">{item.count}</span>
        </button>
      ))}
    </div>
  );
}
