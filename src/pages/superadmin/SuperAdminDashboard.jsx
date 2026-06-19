import AdminShell from '../../components/admin/AdminShell';

export default function SuperAdminDashboard() {
  return (
    <AdminShell
      title="Super Admin dashboard"
      subtitle="Users · storage · CRM · full platform control"
      isSuperAdmin
    />
  );
}
