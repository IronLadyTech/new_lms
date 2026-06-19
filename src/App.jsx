import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import StudentLayout from './components/StudentLayout';
import AuthPage from './pages/auth/AuthPage';
import Home from './pages/student/Home';
import Dashboard from './pages/student/Dashboard';
import Progress from './pages/student/Progress';
import Profile from './pages/student/Profile';
import Support from './pages/student/Support';
import CourseDetail from './pages/student/CourseDetail';
import MBWPage from './pages/student/MBWPage';
import Calendar from './pages/student/Calendar';
import AdminDashboard from './pages/admin/AdminDashboard';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import PortalGate from './pages/portal/PortalGate';
import CXLayout from './components/cx/CXLayout';
import CXHome from './pages/cx/CXHome';
import CXBatches from './pages/cx/CXBatches';
import CXBatchAnalysis from './pages/cx/CXBatchAnalysis';
import CXDashboards from './pages/cx/CXDashboards';
import CXProfile from './pages/cx/CXProfile';
import CXTaskReview from './pages/cx/CXTaskReview';
import { ROLES } from './utils/roles';
import { isAdminRole, isModeratorOnly } from './utils/roles';

function RoleRedirect() {
  const { user, loading, role } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth/login" replace />;
  if (isModeratorOnly(role)) return <Navigate to="/cx/home" replace />;
  if (isAdminRole(role)) return <Navigate to="/portal" replace />;
  return <Navigate to="/app/home" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleRedirect />} />

      <Route path="/auth/login" element={<AuthPage mode="login" />} />
      <Route path="/auth/signup" element={<AuthPage mode="signup" />} />

      <Route
        path="/portal"
        element={
          <ProtectedRoute minRole={ROLES.MODERATOR}>
            <PortalGate />
          </ProtectedRoute>
        }
      />

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
        <Route path="calendar" element={<Calendar />} />
        <Route path="profile" element={<Profile />} />
        <Route path="support" element={<Support />} />
        <Route path="course/:courseId" element={<CourseDetail />} />
        <Route path="mbw" element={<MBWPage />} />
      </Route>

      <Route
        path="/cx"
        element={
          <ProtectedRoute minRole={ROLES.MODERATOR}>
            <CXLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<CXHome />} />
        <Route path="batches" element={<CXBatches />} />
        <Route path="batches/:batchId" element={<CXBatchAnalysis />} />
        <Route path="dashboards" element={<CXDashboards />} />
        <Route path="profile" element={<CXProfile />} />
        <Route path="review/:userId/:taskId" element={<CXTaskReview />} />
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
