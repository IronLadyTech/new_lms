import AdminShell from '../../components/admin/AdminShell';

export default function SuperAdminDashboard() {
  return (
    <AdminShell
      title="Super Admin"
      subtitle="Full control — assign admins, manage everything"
      isSuperAdmin
    />
  );
}
