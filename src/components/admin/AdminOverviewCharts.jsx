import { useMemo } from 'react';
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
  ResponsiveContainer,
} from 'recharts';
import { Download } from 'lucide-react';
import { ROLES, getRoleLabel } from '../../utils/roles';
import { TICKET_STATUSES, statusLabel, categoryLabel } from '../../services/ticketService';
import { downloadCsv, tsToIso } from '../../utils/csvExport';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#6366f1', '#ef4444', '#06b6d4'];

const tooltipStyle = {
  background: '#1a2332',
  border: '1px solid #2d3a4f',
  borderRadius: '8px',
  color: '#e8edf4',
};

function buildRolePieData(users) {
  const counts = {
    Learners: 0,
    Moderators: 0,
    Admins: 0,
    'Super Admins': 0,
  };
  users.forEach((u) => {
    if (u.role === ROLES.SUPERADMIN) counts['Super Admins'] += 1;
    else if (u.role === ROLES.ADMIN) counts.Admins += 1;
    else if (u.role === ROLES.MODERATOR) counts.Moderators += 1;
    else counts.Learners += 1;
  });
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

function buildTicketPieData(tickets) {
  const counts = { Open: 0, Assigned: 0, Resolved: 0 };
  tickets.forEach((t) => {
    if (t.status === TICKET_STATUSES.RESOLVED) counts.Resolved += 1;
    else if (t.status === TICKET_STATUSES.ASSIGNED) counts.Assigned += 1;
    else counts.Open += 1;
  });
  return Object.entries(counts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
}

function buildActivityByDay(activities, days = 7) {
  const result = [];
  const map = {};
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    const row = { day: label, date: key, count: 0 };
    result.push(row);
    map[key] = row;
  }

  activities.forEach((a) => {
    const ms = a.createdAt?.toMillis?.() ?? 0;
    if (!ms) return;
    const key = new Date(ms).toISOString().slice(0, 10);
    if (map[key]) map[key].count += 1;
  });

  return result;
}

function buildEnrollmentsByCourse(users, courseMap) {
  const counts = {};
  users.forEach((u) => {
    (u.enrolledCourses || []).forEach((courseId) => {
      counts[courseId] = (counts[courseId] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([id, count]) => ({
      name: courseMap[id]?.title || courseMap[id]?.code || id.slice(0, 8),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildResourcesByType(resources) {
  const counts = {};
  resources.forEach((r) => {
    counts[r.type || 'other'] = (counts[r.type || 'other'] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

function buildSignupsByDay(users, days = 7) {
  const result = [];
  const map = {};
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' });
    const row = { day: label, date: key, count: 0 };
    result.push(row);
    map[key] = row;
  }

  users.forEach((u) => {
    const ms = u.createdAt?.toMillis?.() ?? 0;
    if (!ms) return;
    const key = new Date(ms).toISOString().slice(0, 10);
    if (map[key]) map[key].count += 1;
  });

  return result;
}

function EmptyChart({ message }) {
  return <p className="admin-chart__empty muted">{message}</p>;
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

export default function AdminOverviewCharts({
  users,
  tickets,
  activities,
  courses,
  resources,
  stats,
  userMap,
}) {
  const courseMap = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);

  const roleData = useMemo(() => buildRolePieData(users), [users]);
  const ticketData = useMemo(() => buildTicketPieData(tickets), [tickets]);
  const activityData = useMemo(() => buildActivityByDay(activities), [activities]);
  const enrollmentData = useMemo(() => buildEnrollmentsByCourse(users, courseMap), [users, courseMap]);
  const resourceTypeData = useMemo(() => buildResourcesByType(resources), [resources]);
  const signupData = useMemo(() => buildSignupsByDay(users), [users]);

  const exportSummary = () => {
    downloadCsv(
      `ilms-overview-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        {
          metric: 'Total accounts',
          value: stats.total,
        },
        { metric: 'Learners', value: stats.userAccounts },
        { metric: 'Admins & staff', value: stats.admins },
        { metric: 'Courses', value: courses.length },
        { metric: 'Resources', value: resources.length },
        { metric: 'Enrollments', value: stats.enrolled },
        { metric: 'Open tickets', value: stats.openTickets },
        { metric: 'Total tickets', value: tickets.length },
        { metric: 'Activity records', value: activities.length },
      ],
      ['metric', 'value']
    );
  };

  const exportUsers = () => {
    downloadCsv(
      `ilms-users-${new Date().toISOString().slice(0, 10)}.csv`,
      users.map((u) => ({
        name: u.displayName || '',
        email: u.email || '',
        role: getRoleLabel(u.role),
        blocked: u.blocked ? 'yes' : 'no',
        enrollments: (u.enrolledCourses || []).length,
        streak: u.streak || 0,
        created: tsToIso(u.createdAt),
      })),
      ['name', 'email', 'role', 'blocked', 'enrollments', 'streak', 'created']
    );
  };

  const exportActivities = () => {
    downloadCsv(
      `ilms-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      activities.map((a) => ({
        user: userMap[a.userId]?.displayName || userMap[a.userId]?.email || a.userId,
        type: a.type || '',
        title: a.title || '',
        course: a.courseId || '',
        created: tsToIso(a.createdAt),
      })),
      ['user', 'type', 'title', 'course', 'created']
    );
  };

  const exportTickets = () => {
    downloadCsv(
      `ilms-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      tickets.map((t) => ({
        subject: t.subject || '',
        user: t.userDisplayName || t.userEmail || '',
        category: categoryLabel(t.category),
        status: statusLabel(t.status),
        assigned: t.assignedToName || '',
        created: tsToIso(t.createdAt),
      })),
      ['subject', 'user', 'category', 'status', 'assigned', 'created']
    );
  };

  return (
    <div className="admin-overview-charts">
      <div className="admin-overview-charts__toolbar">
        <div>
          <h3 className="admin-section__title admin-section__title--inline">Analytics</h3>
          <p className="muted admin-overview-charts__sub">Charts and CSV exports for reporting.</p>
        </div>
        <div className="admin-export-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={exportSummary}>
            <Download size={14} /> Summary CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportUsers}>
            <Download size={14} /> Users CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportActivities}>
            <Download size={14} /> Activity CSV
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={exportTickets}>
            <Download size={14} /> Tickets CSV
          </button>
        </div>
      </div>

      <div className="admin-charts-grid">
        <ChartCard title="Users by role" subtitle="Account breakdown">
          {roleData.length === 0 ? (
            <EmptyChart message="No users yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {roleData.map((_, i) => (
                    <Cell key={roleData[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ticket status" subtitle="Support queue">
          {ticketData.length === 0 ? (
            <EmptyChart message="No tickets yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={ticketData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {ticketData.map((_, i) => (
                    <Cell key={ticketData[i].name} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Activity (7 days)" subtitle="Daily user actions">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
              <XAxis dataKey="day" tick={{ fill: '#8b9cb3', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#8b9cb3', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Actions" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Enrollments by course" subtitle="Top courses">
          {enrollmentData.length === 0 ? (
            <EmptyChart message="No enrollments yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={enrollmentData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#8b9cb3', fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#8b9cb3', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Learners" fill="#22c55e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Resources by type" subtitle="Content mix">
          {resourceTypeData.length === 0 ? (
            <EmptyChart message="No resources yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={resourceTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {resourceTypeData.map((_, i) => (
                    <Cell key={resourceTypeData[i].name} fill={CHART_COLORS[(i + 4) % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="New signups (7 days)" subtitle="Daily registrations">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={signupData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
              <XAxis dataKey="day" tick={{ fill: '#8b9cb3', fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: '#8b9cb3', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" name="Signups" fill="#f59e0b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
