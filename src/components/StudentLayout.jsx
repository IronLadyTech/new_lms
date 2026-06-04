import { Outlet, Link } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function StudentLayout() {
  return (
    <div className="student-layout">
      <header className="app-header">
        <div className="app-header__brand">
          <img src="/logo.png" alt="Iron Lady" className="logo-mark" />
          <span>LMS</span>
        </div>
        <Link to="/app/home" className="app-header__link">
          Courses
        </Link>
      </header>
      <main className="student-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
