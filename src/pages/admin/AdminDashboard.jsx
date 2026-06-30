import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isModeratorOnly } from '../../utils/roles';
import AdminShell from '../../components/admin/AdminShell';

export default function AdminDashboard() {
  const { role } = useAuth();

  if (isModeratorOnly(role)) {
    return <Navigate to="/cx/home" replace />;
  }

  return (
    <AdminShell
      title="Admin dashboard"
      subtitle="Users · progress · courses · resources · batches"
      isSuperAdmin={false}
    />
  );
}
