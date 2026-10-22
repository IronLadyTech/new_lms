import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import RouteLoader from './components/ui/RouteLoader';
import { ROLES } from './utils/roles';
import { isAdminRole, isModeratorOnly } from './utils/roles';

const StudentLayout = lazy(() => import('./components/StudentLayout'));
const AuthPage = lazy(() => import('./pages/auth/AuthPage'));
/* Stitch login preview — /auth/login-next; live login stays /auth/login. */
const LoginNext = lazy(() => import('./pages/auth/LoginNext'));
const AuthActionPage = lazy(() => import('./pages/auth/AuthActionPage'));
const Home = lazy(() => import('./pages/student/Home'));
/* The parallel rebuild. Unlinked from the navigation on purpose: it is
   reachable by URL for testing while /app/home keeps serving everyone. */
const HomeNext = lazy(() => import('./pages/student/HomeNext'));
const StitchPage = lazy(() => import('./components/stitchHome/StitchPage'));
const StitchSettings = lazy(() => import('./components/stitchHome/StitchSettings'));
const StitchSupport = lazy(() => import('./components/stitchHome/StitchSupport'));
const CourseDetail = lazy(() => import('./pages/student/CourseDetail'));
const MBWPage = lazy(() => import('./pages/student/MBWPage'));
const BM100Page = lazy(() => import('./pages/student/BM100Page'));
const LEPPage = lazy(() => import('./pages/student/LEPPage'));
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
  return <RouteLoader label="Loading page" />;
}

function RoleRedirect() {
  const { user, loading, role } = useAuth();
  if (loading) {
    return <RouteLoader label="Signing you in" />;
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
        <Route path="/auth/login-next" element={<LoginNext />} />
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
          <Route path="home-next" element={<HomeNext />} />
          {/* Same loader, schedule body. */}
          <Route path="schedule" element={<HomeNext view="schedule" />} />
          <Route path="browse" element={<HomeNext view="browse" />} />
          <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
          <Route path="progress" element={<HomeNext view="progress" />} />
          <Route path="calendar" element={<Calendar />} />
          {/* Wrapped at the route so every return path inside the page — the
              guest branch included — gets the same chrome. */}
          <Route
            path="profile"
            element={
              <StitchPage activeId="settings" subtitle="">
                <StitchSettings />
              </StitchPage>
            }
          />
          <Route
            path="support"
            element={
              <StitchPage activeId="support" subtitle="">
                <StitchSupport />
              </StitchPage>
            }
          />
          <Route path="course/:courseId" element={<CourseDetail />} />
          <Route path="mbw" element={<MBWPage />} />
          <Route path="100bm" element={<BM100Page />} />
          <Route path="lep" element={<LEPPage />} />
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
