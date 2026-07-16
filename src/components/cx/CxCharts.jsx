import { useMemo } from 'react';
import ChartFrame from '../ui/ChartFrame';
import {
  PieChart,
  Pie,
  Cell,
  Label,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';

// Iron Lady palette. Keys are plain-language labels shown to CX staff.
const STATUS_COLORS = {
  Done: '#22c55e',
  'Waiting for review': '#F5B301',
  'Not started': '#9ca3af',
};

function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return {
      tooltipStyle: {
        background: styles.getPropertyValue('--chart-tooltip-bg').trim(),
        border: `1px solid ${styles.getPropertyValue('--chart-tooltip-border').trim()}`,
        borderRadius: '8px',
        color: styles.getPropertyValue('--chart-tooltip-text').trim(),
      },
      gridStroke: styles.getPropertyValue('--chart-grid').trim(),
      tickFill: styles.getPropertyValue('--chart-tick').trim(),
    };
  }, [theme]);
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="admin-chart-card">
      <div className="admin-chart-card__head">
        <h4>{title}</h4>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="admin-chart-card__body">{children}</div>
    </div>
  );
}

function EmptyChart({ message }) {
  return <p className="admin-chart__empty muted">{message}</p>;
}

export default function CxCharts({ statusData = [], batchData = [], donutPct = 0 }) {
  const { tooltipStyle, gridStroke, tickFill } = useChartTheme();
  const statusTotal = statusData.reduce((sum, d) => sum + d.value, 0);
  const hasStatus = statusTotal > 0;

  return (
    <div className="admin-charts-grid">
      <ChartCard title="Task completion" subtitle="Everyone in your program">
        {!hasStatus ? (
          <EmptyChart message="No tasks started yet." />
        ) : (
          <ChartFrame>
            {(w, h) => (
              <PieChart width={w} height={h}>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={2}
                  labelLine={false}
                  isAnimationActive={false}
                  stroke="var(--surface)"
                  strokeWidth={2}
                >
                  {statusData.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name] || '#F52929'} />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                          <tspan x={cx} dy="-0.15em" fontSize="24" fontWeight="700" fill={tickFill}>
                            {donutPct}%
                          </tspan>
                          <tspan x={cx} dy="1.5em" fontSize="11" fill={tickFill}>
                            done
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [`${v} tasks`, n]} />
                <Legend />
              </PieChart>
            )}
          </ChartFrame>
        )}
      </ChartCard>

      <ChartCard title="How each batch is doing" subtitle="Share of tasks finished">
        {batchData.length === 0 ? (
          <EmptyChart message="No batches yet." />
        ) : (
          <ChartFrame>
            {(w, h) => (
              <BarChart
                width={w}
                height={h}
                data={batchData}
                layout="vertical"
                margin={{ top: 8, right: 32, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: tickFill, fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fill: tickFill, fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Completion']} />
                <Bar
                  dataKey="pct"
                  name="Completion"
                  fill="#F52929"
                  radius={[0, 6, 6, 0]}
                  minPointSize={2}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="pct"
                    position="right"
                    formatter={(v) => `${v}%`}
                    style={{ fill: tickFill, fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            )}
          </ChartFrame>
        )}
      </ChartCard>
    </div>
  );
}
