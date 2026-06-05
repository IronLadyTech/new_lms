import AdminShell from '../../components/admin/AdminShell';

export default function AdminDashboard() {
  return (
    <AdminShell
      title="Admin dashboard"
      subtitle="Users · progress · courses · resources · batches"
      isSuperAdmin={false}
    />
  );
}
