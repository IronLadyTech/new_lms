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
  Legend,
  Label,
  LabelList,
  ResponsiveContainer,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import {
  JOURNEY_LABELS,
  JOURNEY_ORDER,
  PAYMENT_CHART_LABELS,
  ACTIVE_CHART_LABELS,
} from '../../utils/cxCrmDashboard';
import CxChartDrillLegend from './CxChartDrillLegend';

const PAYMENT_KEYS = ['unpaid', 'register', 'paid'];
const ACTIVE_KEYS = [
  ACTIVE_CHART_LABELS.active7,
  ACTIVE_CHART_LABELS.active30,
  ACTIVE_CHART_LABELS.inactive,
];

const JOURNEY_COLORS = {
  [JOURNEY_LABELS.NONE]: '#9ca3af',
  [JOURNEY_LABELS.REGISTERED]: '#F5B301',
  [JOURNEY_LABELS.AWAITING]: '#60a5fa',
  [JOURNEY_LABELS.ONGOING]: '#C8102E',
  [JOURNEY_LABELS.COMPLETED]: '#16A34A',
};

const PAYMENT_COLORS = {
  unpaid: '#ef4444',
  register: '#F5B301',
  paid: '#16A34A',
};

const ACTIVE_COLORS = {
  [ACTIVE_CHART_LABELS.active7]: '#F52929',
  [ACTIVE_CHART_LABELS.active30]: '#F5B301',
  [ACTIVE_CHART_LABELS.inactive]: '#9ca3af',
};

const TASK_STATUS_COLORS = {
  Done: '#16A34A',
  'Action required': '#F5B301',
  'Not started': '#9ca3af',
};

const ASSIGN_COLORS = {
  assigned: '#F52929',
  unassigned: '#9ca3af',
};

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

function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      tooltipStyle: {
        background: styles.getPropertyValue('--chart-tooltip-bg').trim() || 'var(--surface)',
        border: `1px solid ${styles.getPropertyValue('--chart-tooltip-border').trim() || 'var(--border)'}`,
        borderRadius: '8px',
        color: styles.getPropertyValue('--chart-tooltip-text').trim() || 'var(--text)',
      },
      gridStroke: styles.getPropertyValue('--chart-grid').trim() || 'var(--border)',
      tickFill: styles.getPropertyValue('--chart-tick').trim() || 'var(--muted)',
    };
  }, [theme]);
}

function DashboardChartCard({ title, subtitle, total, legend, children }) {
  return (
    <article className="cx-crm-chart">
      <header className="cx-crm-chart__head">
        <div>
          <h3 className="cx-crm-chart__title">{title}</h3>
          {subtitle && <p className="cx-crm-chart__sub muted">{subtitle}</p>}
        </div>
        {total != null && (
          <span className="cx-crm-chart__total" aria-label={`Total ${total}`}>
            {total}
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
  const { tooltipStyle, gridStroke, tickFill } = useChartTheme();
  const chartHeight = useMobileChartHeight();
  const compactChart = chartHeight <= 220;
  const journeyChartHeight = compactChart
    ? Math.min(420, Math.max(chartHeight, batchStatus.length * 36 + 24))
    : chartHeight;

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
          color: JOURNEY_COLORS[key],
          descriptor: { chartId: 'batchStatus', seriesKey: key, category: row.batchId },
        });
      });
    });
    return items;
  }, [batchStatus]);

  const paymentLegend = useMemo(() => {
    const items = [];
    paymentByMonth.forEach((row) => {
      PAYMENT_KEYS.forEach((key) => {
        const count = row[key] || 0;
        if (count <= 0) return;
        items.push({
          key: `${row.month}-${key}`,
          label: `${row.label} · ${PAYMENT_CHART_LABELS[key]}`,
          count,
          color: PAYMENT_COLORS[key],
          descriptor: { chartId: 'payment', seriesKey: key, category: row.month },
        });
      });
    });
    return items;
  }, [paymentByMonth]);

  const activeLegend = useMemo(() => {
    const row = activeStatus[0];
    if (!row) return [];
    return ACTIVE_KEYS.map((key) => ({
      key,
      label: key,
      count: row[key] || 0,
      color: ACTIVE_COLORS[key],
      descriptor: { chartId: 'activity', seriesKey: key, category: row.name },
    })).filter((item) => item.count > 0);
  }, [activeStatus]);

  const taskStatusLegend = useMemo(
    () =>
      taskStatusData
        .filter((d) => d.value > 0)
        .map((d) => ({
          key: d.name,
          label: d.name,
          count: d.value,
          color: TASK_STATUS_COLORS[d.name],
          descriptor: { chartId: 'taskStatus', seriesKey: d.name },
        })),
    [taskStatusData]
  );

  const assignmentLegend = useMemo(() => {
    if (!enrollmentAssignment) return [];
    return [
      {
        key: 'assigned',
        label: 'In a batch',
        count: enrollmentAssignment.assigned || 0,
        color: ASSIGN_COLORS.assigned,
        descriptor: { chartId: 'assignment', seriesKey: 'assigned' },
      },
      {
        key: 'unassigned',
        label: 'Not assigned',
        count: enrollmentAssignment.unassigned || 0,
        color: ASSIGN_COLORS.unassigned,
        descriptor: { chartId: 'assignment', seriesKey: 'unassigned' },
      },
    ].filter((item) => item.count > 0);
  }, [enrollmentAssignment]);

  return (
    <div className="cx-crm-dashboard" aria-label="Program overview charts">
      <DashboardChartCard
        title="Cohort journey"
        subtitle="Payment and progress stage per batch"
        total={batchStatusTotal}
        legend={<CxChartDrillLegend items={batchStatusLegend} onDrill={onDrill} />}
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
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: tickFill, fontSize: 11 }}
                  />
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
              <Tooltip contentStyle={tooltipStyle} />
              {!compactChart && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {JOURNEY_ORDER.map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="status"
                  fill={JOURNEY_COLORS[key]}
                  isAnimationActive={false}
                  style={{ cursor: onDrill ? 'pointer' : undefined }}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="unpaid"
                name={PAYMENT_CHART_LABELS.unpaid}
                stackId="pay"
                fill={PAYMENT_COLORS.unpaid}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'payment', seriesKey: 'unpaid', category: row.month },
                    row.unpaid
                  )
                }
              />
              <Bar
                dataKey="register"
                name={PAYMENT_CHART_LABELS.register}
                stackId="pay"
                fill={PAYMENT_COLORS.register}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'payment', seriesKey: 'register', category: row.month },
                    row.register
                  )
                }
              />
              <Bar
                dataKey="paid"
                name={PAYMENT_CHART_LABELS.paid}
                stackId="pay"
                fill={PAYMENT_COLORS.paid}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'payment', seriesKey: 'paid', category: row.month },
                    row.paid
                  )
                }
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardChartCard>

      <DashboardChartCard
        title="Participant activity"
        subtitle="Last sign-in or LMS use"
        total={activeTotal}
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
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey={ACTIVE_CHART_LABELS.active7}
                stackId="active"
                fill={ACTIVE_COLORS[ACTIVE_CHART_LABELS.active7]}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'activity', seriesKey: ACTIVE_CHART_LABELS.active7, category: row.name },
                    row[ACTIVE_CHART_LABELS.active7]
                  )
                }
              />
              <Bar
                dataKey={ACTIVE_CHART_LABELS.active30}
                stackId="active"
                fill={ACTIVE_COLORS[ACTIVE_CHART_LABELS.active30]}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'activity', seriesKey: ACTIVE_CHART_LABELS.active30, category: row.name },
                    row[ACTIVE_CHART_LABELS.active30]
                  )
                }
              />
              <Bar
                dataKey={ACTIVE_CHART_LABELS.inactive}
                stackId="active"
                fill={ACTIVE_COLORS[ACTIVE_CHART_LABELS.inactive]}
                isAnimationActive={false}
                style={{ cursor: onDrill ? 'pointer' : undefined }}
                onClick={(row) =>
                  segmentClick(
                    onDrill,
                    { chartId: 'activity', seriesKey: ACTIVE_CHART_LABELS.inactive, category: row.name },
                    row[ACTIVE_CHART_LABELS.inactive]
                  )
                }
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </DashboardChartCard>

      {hasTasks ? (
        <DashboardChartCard
          title="Task completion"
          subtitle="All participants in this program"
          total={taskStatusTotal > 0 ? `${taskCompletionPct}%` : null}
          legend={<CxChartDrillLegend items={taskStatusLegend} onDrill={onDrill} />}
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
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {taskStatusData.map((d) => (
                    <Cell
                      key={d.name}
                      fill={TASK_STATUS_COLORS[d.name] || '#F52929'}
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
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, n) => [`${v} participants`, n]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      ) : (
        <DashboardChartCard
          title="Batch assignment"
          subtitle="Enrolled vs assigned to a cohort"
          total={enrollmentAssignment?.total ?? 0}
          legend={<CxChartDrillLegend items={assignmentLegend} onDrill={onDrill} />}
        >
          {!enrollmentAssignment || enrollmentAssignment.total === 0 ? (
            <EmptyChart message="No participants enrolled yet." />
          ) : (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={[enrollmentAssignment]}
                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: tickFill, fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: tickFill, fontSize: 11 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="assigned"
                  name="In a batch"
                  stackId="enroll"
                  fill={ASSIGN_COLORS.assigned}
                  isAnimationActive={false}
                  style={{ cursor: onDrill ? 'pointer' : undefined }}
                  onClick={(row) =>
                    segmentClick(onDrill, { chartId: 'assignment', seriesKey: 'assigned' }, row.assigned)
                  }
                >
                  <LabelList dataKey="assigned" position="center" style={{ fill: '#fff', fontSize: 11 }} />
                </Bar>
                <Bar
                  dataKey="unassigned"
                  name="Not assigned"
                  stackId="enroll"
                  fill={ASSIGN_COLORS.unassigned}
                  isAnimationActive={false}
                  style={{ cursor: onDrill ? 'pointer' : undefined }}
                  onClick={(row) =>
                    segmentClick(
                      onDrill,
                      { chartId: 'assignment', seriesKey: 'unassigned' },
                      row.unassigned
                    )
                  }
                >
                  <LabelList
                    dataKey="unassigned"
                    position="center"
                    style={{ fill: tickFill, fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </DashboardChartCard>
      )}
    </div>
  );
}
