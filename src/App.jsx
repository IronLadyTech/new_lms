import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import DashboardSkeleton from './components/ui/DashboardSkeleton';
import { ROLES } from './utils/roles';
import { isAdminRole, isModeratorOnly } from './utils/roles';

const StudentLayout = lazy(() => import('./components/StudentLayout'));
const AuthPage = lazy(() => import('./pages/auth/AuthPage'));
const AuthActionPage = lazy(() => import('./pages/auth/AuthActionPage'));
const Home = lazy(() => import('./pages/student/Home'));
const Progress = lazy(() => import('./pages/student/Progress'));
const Profile = lazy(() => import('./pages/student/Profile'));
const Support = lazy(() => import('./pages/student/Support'));
const CourseDetail = lazy(() => import('./pages/student/CourseDetail'));
const MBWPage = lazy(() => import('./pages/student/MBWPage'));
const BM100Page = lazy(() => import('./pages/student/BM100Page'));
const Calendar = lazy(() => import('./pages/student/Calendar'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const PortalGate = lazy(() => import('./pages/portal/PortalGate'));
const CXLayout = lazy(() => import('./components/cx/CXLayout'));
const CXHome = lazy(() => import('./pages/cx/CXHome'));
const CXBatches = lazy(() => import('./pages/cx/CXBatches'));
const CXBatchAnalysis = lazy(() => import('./pages/cx/CXBatchAnalysis'));
const CXDashboards = lazy(() => import('./pages/cx/CXDashboards'));
const CXProfile = lazy(() => import('./pages/cx/CXProfile'));
const CXReviews = lazy(() => import('./pages/cx/CXReviews'));
const CXTaskReview = lazy(() => import('./pages/cx/CXTaskReview'));

function RouteFallback() {
  return (
    <div className="loading-screen" role="status" aria-busy="true" aria-label="Loading page">
      <DashboardSkeleton />
    </div>
  );
}

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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />

        <Route path="/auth/login" element={<AuthPage mode="login" />} />
        <Route path="/auth/signup" element={<AuthPage mode="signup" />} />
        <Route path="/auth/action" element={<AuthActionPage />} />

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
          <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
          <Route path="progress" element={<Progress />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="profile" element={<Profile />} />
          <Route path="support" element={<Support />} />
          <Route path="course/:courseId" element={<CourseDetail />} />
          <Route path="mbw" element={<MBWPage />} />
          <Route path="100bm" element={<BM100Page />} />
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
          <Route path="reviews" element={<CXReviews />} />
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
    </Suspense>
  );
}
