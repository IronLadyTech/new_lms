import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Label,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  JOURNEY_LABELS,
  JOURNEY_ORDER,
  PAYMENT_CHART_LABELS,
  ACTIVE_CHART_LABELS,
} from '../../utils/cxCrmDashboard';
import CxChartDrillLegend from './CxChartDrillLegend';

/**
 * Colour rules for this dashboard (see design-system/iron-lady-lms/pages/cx-dashboards.md):
 *
 * - Cohort journey, payment and activity are ORDINAL — their stages have an inherent
 *   order, so each takes a single-hue ramp (brand red) with monotone lightness. The
 *   reader sees the progression in the colour instead of decoding five unrelated hues.
 * - "No stage yet" / "Not started" sits OUTSIDE the ramp on a neutral, because it is
 *   the absence of a stage rather than a step within it.
 * - Task completion is STATUS (good / warning / idle) and therefore always ships with
 *   an icon and a text label — never colour alone.
 *
 * Every value comes from a CSS custom property so both themes stay in sync and no
 * raw hex lives in this component. The ramps were generated at even OKLCH lightness
 * steps and validated per mode; regenerate rather than hand-editing them.
 */
const TOKEN_NAMES = [
  '--chart-grid',
  '--chart-tick',
  '--chart-tooltip-bg',
  '--chart-tooltip-border',
  '--chart-tooltip-text',
  '--chart-ord-4-1',
  '--chart-ord-4-2',
  '--chart-ord-4-3',
  '--chart-ord-4-4',
  '--chart-ord-3-1',
  '--chart-ord-3-2',
  '--chart-ord-3-3',
  '--chart-neutral',
  '--chart-status-good',
  '--chart-status-warn',
  '--chart-status-idle',
  '--surface',
];

const STATUS_META = {
  Done: { icon: CheckCircle2, token: '--chart-status-good' },
  'Action required': { icon: AlertTriangle, token: '--chart-status-warn' },
  'Not started': { icon: Circle, token: '--chart-status-idle' },
};

function useChartTokens() {
  const { theme } = useTheme();
  const [tokens, setTokens] = useState({});

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const next = {};
    TOKEN_NAMES.forEach((name) => {
      next[name] = styles.getPropertyValue(name).trim();
    });
    setTokens(next);
  }, [theme]);

  return tokens;
}

function useMobileChartHeight(defaultHeight = 260, mobileHeight = 220) {
  const [height, setHeight] = useState(defaultHeight);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setHeight(mq.matches ? mobileHeight : defaultHeight);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [defaultHeight, mobileHeight]);

  return height;
}

function DashboardChartCard({ title, subtitle, total, totalLabel, legend, children, wide }) {
  return (
    <article className={`cx-crm-chart${wide ? ' cx-crm-chart--wide' : ''}`}>
      <header className="cx-crm-chart__head">
        <div>
          <h3 className="cx-crm-chart__title">{title}</h3>
          {subtitle && <p className="cx-crm-chart__sub muted">{subtitle}</p>}
        </div>
        {total != null && (
          <span className="cx-crm-chart__total">
            <span className="cx-crm-chart__total-value">{total}</span>
            {totalLabel && <span className="cx-crm-chart__total-label">{totalLabel}</span>}
          </span>
        )}
      </header>
      <div className="cx-crm-chart__body">{children}</div>
      {legend && <div className="cx-crm-chart__foot">{legend}</div>}
    </article>
  );
}

function EmptyChart({ message }) {
  return <p className="cx-crm-chart__empty muted">{message}</p>;
}

/** Status identity is never colour-alone — swatch, icon and label travel together. */
function StatusLegend({ items, tokens, onDrill }) {
  if (!items.length) return null;
  return (
    <ul className="cx-status-legend" aria-label="Task status breakdown">
      {items.map((item) => {
        const meta = STATUS_META[item.name];
        const Icon = meta?.icon || Circle;
        const color = tokens[meta?.token] || tokens['--chart-neutral'];
        const content = (
          <>
            <span className="cx-status-legend__icon" style={{ color }} aria-hidden="true">
              <Icon size={15} strokeWidth={2.5} />
            </span>
            <span className="cx-status-legend__label">{item.name}</span>
            <span className="cx-status-legend__count">{item.value}</span>
          </>
        );
        return (
          <li key={item.name}>
            {onDrill && item.value > 0 ? (
              <button
                type="button"
                className="cx-status-legend__row cx-status-legend__row--btn"
                onClick={() => onDrill({ chartId: 'taskStatus', seriesKey: item.name })}
              >
                {content}
                <span className="cx-status-legend__action muted">View list</span>
              </button>
            ) : (
              <span className="cx-status-legend__row">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function truncateLabel(value, max = 14) {
  const s = String(value || '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function segmentClick(onDrill, descriptor, count) {
  if (!onDrill || !count) return;
  onDrill(descriptor);
}

export default function CxOverviewDashboard({
  batchStatus = [],
  paymentByMonth = [],
  activeStatus = [],
  taskStatusData = [],
  taskCompletionPct = 0,
  hasTasks = false,
  enrollmentAssignment = null,
  onDrill,
}) {
  const tokens = useChartTokens();
  const chartHeight = useMobileChartHeight();
  const compactChart = chartHeight <= 220;
  const journeyChartHeight = compactChart
    ? Math.min(420, Math.max(chartHeight, batchStatus.length * 36 + 24))
    : chartHeight;

  const gridStroke = tokens['--chart-grid'];
  const tickFill = tokens['--chart-tick'];
  const surface = tokens['--surface'];
  const tooltipStyle = useMemo(
    () => ({
      background: tokens['--chart-tooltip-bg'],
      border: `1px solid ${tokens['--chart-tooltip-border']}`,
      borderRadius: '10px',
      color: tokens['--chart-tooltip-text'],
      fontSize: '0.82rem',
    }),
    [tokens]
  );

  /* Ordinal: index 0 is the earliest stage, the last index the furthest along.
     "No stage yet" is deliberately outside the ramp. */
  const journeyColors = useMemo(
    () => ({
      [JOURNEY_LABELS.NONE]: tokens['--chart-neutral'],
      [JOURNEY_LABELS.REGISTERED]: tokens['--chart-ord-4-1'],
      [JOURNEY_LABELS.AWAITING]: tokens['--chart-ord-4-2'],
      [JOURNEY_LABELS.ONGOING]: tokens['--chart-ord-4-3'],
      [JOURNEY_LABELS.COMPLETED]: tokens['--chart-ord-4-4'],
    }),
    [tokens]
  );

  const paymentColors = useMemo(
    () => ({
      unpaid: tokens['--chart-ord-3-1'],
      register: tokens['--chart-ord-3-2'],
      paid: tokens['--chart-ord-3-3'],
    }),
    [tokens]
  );

  /* Recency is ordinal too — most recently active is furthest along the ramp. */
  const activeColors = useMemo(
    () => ({
      [ACTIVE_CHART_LABELS.active7]: tokens['--chart-ord-3-3'],
      [ACTIVE_CHART_LABELS.active30]: tokens['--chart-ord-3-2'],
      [ACTIVE_CHART_LABELS.inactive]: tokens['--chart-neutral'],
    }),
    [tokens]
  );

  const assignColors = useMemo(
    () => ({
      assigned: tokens['--chart-ord-3-3'],
      unassigned: tokens['--chart-neutral'],
    }),
    [tokens]
  );

  const batchStatusTotal = batchStatus.reduce((n, b) => n + (b.total || 0), 0);
  const paymentTotal = paymentByMonth.reduce(
    (n, row) => n + row.unpaid + row.register + row.paid,
    0
  );
  const activeTotal = activeStatus[0]?.total ?? 0;
  const taskStatusTotal = taskStatusData.reduce((n, row) => n + row.value, 0);

  const batchStatusLegend = useMemo(() => {
    const items = [];
    batchStatus.forEach((row) => {
      JOURNEY_ORDER.forEach((key) => {
        const count = row[key] || 0;
        if (count <= 0) return;
        items.push({
          key: `${row.batchId}-${key}`,
          label: `${row.name} · ${key}`,
          count,
          color: journeyColors[key],
          descriptor: { chartId: 'batchStatus', seriesKey: key, category: row.batchId },
        });
      });
    });
    return items;
  }, [batchStatus, journeyColors]);

  const paymentLegend = useMemo(() => {
    const items = [];
    paymentByMonth.forEach((row) => {
      ['unpaid', 'register', 'paid'].forEach((key) => {
        const count = row[key] || 0;
        if (count <= 0) return;
        items.push({
          key: `${row.month}-${key}`,
          label: `${row.label} · ${PAYMENT_CHART_LABELS[key]}`,
          count,
          color: paymentColors[key],
          descriptor: { chartId: 'payment', seriesKey: key, category: row.month },
        });
      });
    });
    return items;
  }, [paymentByMonth, paymentColors]);

  const activeLegend = useMemo(() => {
    const row = activeStatus[0];
    if (!row) return [];
    return [
      ACTIVE_CHART_LABELS.active7,
      ACTIVE_CHART_LABELS.active30,
      ACTIVE_CHART_LABELS.inactive,
    ]
      .map((key) => ({
        key,
        label: key,
        count: row[key] || 0,
        color: activeColors[key],
        descriptor: { chartId: 'activity', seriesKey: key, category: row.name },
      }))
      .filter((item) => item.count > 0);
  }, [activeStatus, activeColors]);

  const assignmentLegend = useMemo(() => {
    if (!enrollmentAssignment) return [];
    return [
      {
        key: 'assigned',
        label: 'In a batch',
        count: enrollmentAssignment.assigned || 0,
        color: assignColors.assigned,
        descriptor: { chartId: 'assignment', seriesKey: 'assigned' },
      },
      {
        key: 'unassigned',
        label: 'Not assigned',
        count: enrollmentAssignment.unassigned || 0,
        color: assignColors.unassigned,
        descriptor: { chartId: 'assignment', seriesKey: 'unassigned' },
      },
    ].filter((item) => item.count > 0);
  }, [enrollmentAssignment, assignColors]);

  const drillCursor = onDrill ? 'pointer' : undefined;

  return (
    <div className="cx-crm-dashboard" aria-label="Program overview charts">
      <DashboardChartCard
        title="Cohort journey"
        subtitle="Stage each participant has reached, by batch"
        total={batchStatusTotal}
        totalLabel="participants"
        legend={<CxChartDrillLegend items={batchStatusLegend} onDrill={onDrill} />}
        wide
      >
        {batchStatus.length === 0 ? (
          <EmptyChart message="Add learners to batches to see journey breakdown." />
        ) : (
          <ResponsiveContainer width="100%" height={journeyChartHeight}>
            <BarChart
              data={batchStatus}
              layout={compactChart ? 'vertical' : 'horizontal'}
              margin={
                compactChart
                  ? { top: 8, right: 16, left: 4, bottom: 4 }
                  : { top: 12, right: 8, left: 0, bottom: 4 }
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridStroke}
                vertical={!compactChart}
                horizontal={compactChart}
              />
              {compactChart ? (
                <>
                  <XAxis type="number" allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={80}
                    tick={{ fill: tickFill, fontSize: 11 }}
                    tickFormatter={(v) => truncateLabel(v, 10)}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: tickFill, fontSize: 11 }}
                    tickFormatter={(v) => truncateLabel(v, 12)}
                    interval={0}
                    angle={batchStatus.length > 2 ? -18 : 0}
                    textAnchor={batchStatus.length > 2 ? 'end' : 'middle'}
                    height={batchStatus.length > 2 ? 56 : 32}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} width={32} />
                </>
              )}
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'transparent' }} />
              {JOURNEY_ORDER.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="status"
                  fill={journeyColors[key]}
                  isAnimationActive={false}
                  /* 2px surface gap between stacked segments — separates fills
                     without relying on colour difference alone. */
                  stroke={surface}
                  strokeWidth={2}
                  style={{ cursor: drillCursor }}
                  onClick={(row) =>
                    segmentClick(
                      onDrill,
                      { chartId: 'batchStatus', seriesKey: key, category: row.batchId },
                      row[key]
                    )
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardChartCard>

      <DashboardChartCard
        title="Payment status"
        subtitle="By month learners joined the LMS"
        total={paymentTotal}
        totalLabel="participants"
        legend={<CxChartDrillLegend items={paymentLegend} onDrill={onDrill} />}
      >
        {paymentByMonth.length === 0 ? (
          <EmptyChart message="Payment breakdown appears when learners are enrolled." />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={paymentByMonth} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tickFill, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'transparent' }} />
              {['unpaid', 'register', 'paid'].map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={PAYMENT_CHART_LABELS[key]}
                  stackId="pay"
                  fill={paymentColors[key]}
                  isAnimationActive={false}
                  stroke={surface}
                  strokeWidth={2}
                  style={{ cursor: drillCursor }}
                  onClick={(row) =>
                    segmentClick(
                      onDrill,
                      { chartId: 'payment', seriesKey: key, category: row.month },
                      row[key]
                    )
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardChartCard>

      <DashboardChartCard
        title="Participant activity"
        subtitle="Last sign-in or LMS use"
        total={activeTotal}
        totalLabel="participants"
        legend={<CxChartDrillLegend items={activeLegend} onDrill={onDrill} />}
      >
        {activeTotal === 0 ? (
          <EmptyChart message="No participants enrolled yet." />
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={activeStatus} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'transparent' }} />
              {[
                ACTIVE_CHART_LABELS.active7,
                ACTIVE_CHART_LABELS.active30,
                ACTIVE_CHART_LABELS.inactive,
              ].map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="active"
                  fill={activeColors[key]}
                  isAnimationActive={false}
                  stroke={surface}
                  strokeWidth={2}
                  style={{ cursor: drillCursor }}
                  onClick={(row) =>
                    segmentClick(
                      onDrill,
                      { chartId: 'activity', seriesKey: key, category: row.name },
                      row[key]
                    )
                  }
                >
                  {/* Direct labels are the relief channel for sub-3:1 fills. */}
                  <LabelList
                    dataKey={key}
                    position="center"
                    style={{ fill: tickFill, fontSize: 11, fontWeight: 600 }}
                    formatter={(v) => (v > 0 ? v : '')}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardChartCard>

      {hasTasks ? (
        <DashboardChartCard
          title="Task completion"
          subtitle="All participants in this program"
          total={taskStatusTotal > 0 ? `${taskCompletionPct}%` : null}
          totalLabel="complete"
          legend={
            <StatusLegend items={taskStatusData} tokens={tokens} onDrill={onDrill} />
          }
        >
          {taskStatusTotal === 0 ? (
            <EmptyChart message="No tasks started yet." />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <PieChart>
                <Pie
                  data={taskStatusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  labelLine={false}
                  isAnimationActive={false}
                  stroke={surface}
                  strokeWidth={2}
                >
                  {taskStatusData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={tokens[STATUS_META[d.name]?.token] || tokens['--chart-neutral']}
                      style={{ cursor: onDrill && d.value > 0 ? 'pointer' : undefined }}
                      onClick={() =>
                        segmentClick(onDrill, { chartId: 'taskStatus', seriesKey: d.name }, d.value)
                      }
                    />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                          <tspan x={cx} dy="-0.15em" fontSize="22" fontWeight="700" fill={tickFill}>
                            {taskCompletionPct}%
                          </tspan>
                          <tspan x={cx} dy="1.5em" fontSize="11" fill={tickFill}>
                            done
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} participants`, n]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      ) : (
        <DashboardChartCard
          title="Batch assignment"
          subtitle="Enrolled vs assigned to a cohort"
          total={enrollmentAssignment?.total ?? 0}
          totalLabel="participants"
          legend={<CxChartDrillLegend items={assignmentLegend} onDrill={onDrill} />}
        >
          {!enrollmentAssignment || enrollmentAssignment.total === 0 ? (
            <EmptyChart message="No participants enrolled yet." />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={[enrollmentAssignment]} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'transparent' }} />
                {[
                  { key: 'assigned', name: 'In a batch' },
                  { key: 'unassigned', name: 'Not assigned' },
                ].map(({ key, name }) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    name={name}
                    stackId="enroll"
                    fill={assignColors[key]}
                    isAnimationActive={false}
                    stroke={surface}
                    strokeWidth={2}
                    style={{ cursor: drillCursor }}
                    onClick={(row) =>
                      segmentClick(onDrill, { chartId: 'assignment', seriesKey: key }, row[key])
                    }
                  >
                    <LabelList
                      dataKey={key}
                      position="center"
                      style={{ fill: tickFill, fontSize: 11, fontWeight: 600 }}
                      formatter={(v) => (v > 0 ? v : '')}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      )}
    </div>
  );
}
