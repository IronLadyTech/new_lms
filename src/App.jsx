import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import StudentLayout from './components/StudentLayout';
import AuthPage from './pages/auth/AuthPage';
import Home from './pages/student/Home';
import Dashboard from './pages/student/Dashboard';
import Progress from './pages/student/Progress';
import Profile from './pages/student/Profile';
import CourseDetail from './pages/student/CourseDetail';
import AdminDashboard from './pages/admin/AdminDashboard';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import { ROLES } from './utils/roles';
import { isAdminRole } from './utils/roles';

function RoleRedirect() {
  const { user, loading, role } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (role === ROLES.SUPERADMIN) return <Navigate to="/superadmin" replace />;
  if (isAdminRole(role)) return <Navigate to="/admin" replace />;
  return <Navigate to="/app/home" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />

      <Route path="/auth/login" element={<AuthPage mode="login" />} />
      <Route path="/auth/signup" element={<AuthPage mode="signup" />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="progress" element={<Progress />} />
        <Route path="profile" element={<Profile />} />
        <Route path="course/:courseId" element={<CourseDetail />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute minRole={ROLES.MODERATOR}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/superadmin"
        element={
          <ProtectedRoute minRole={ROLES.SUPERADMIN}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
