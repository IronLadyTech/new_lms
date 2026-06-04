import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers, assignAdminRole } from '../../services/userService';
import { ROLES } from '../../utils/roles';

export default function SuperAdminDashboard() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState(ROLES.ADMIN);
  const [message, setMessage] = useState('');

  const load = async () => {
    setUsers(await getAllUsers());
  };

  useEffect(() => {
    load();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    const target = users.find((u) => u.email?.toLowerCase() === assignEmail.toLowerCase());
    if (!target) {
      setMessage('User not found. They must sign up first.');
      return;
    }
    await assignAdminRole(target.id, assignRole);
    setMessage(`Assigned ${assignRole} to ${target.email}`);
    setAssignEmail('');
    load();
  };

  const handleRoleChange = async (uid, role) => {
    await assignAdminRole(uid, role);
    load();
  };

  return (
    <div className="admin-layout superadmin">
      <header className="admin-header">
        <div>
          <h1>Super Admin operations</h1>
          <p>Assign admins · full CRUD on users & roles</p>
        </div>
        <div className="admin-header__actions">
          <Link to="/admin" className="btn btn-outline btn-sm">
            Admin panel
          </Link>
          <Link to="/app/home" className="btn btn-outline btn-sm">
            Student app
          </Link>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => signOut().then(() => navigate('/auth/login'))}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="superadmin-assign">
          <h2>Assign new admin</h2>
          <form className="admin-form" onSubmit={handleAssign}>
            <input
              type="email"
              placeholder="User email (must exist)"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              required
            />
            <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)}>
              <option value={ROLES.ADMIN}>Admin</option>
              <option value={ROLES.MODERATOR}>Moderator</option>
              <option value={ROLES.SUPERADMIN}>Super Admin</option>
              <option value={ROLES.STUDENT}>Student</option>
            </select>
            <button type="submit" className="btn btn-primary">
              Assign role
            </button>
          </form>
          {message && <p className="success-text">{message}</p>}
        </section>

        <section>
          <h2>All users — CRUD roles</h2>
          <ul className="admin-list">
            {users.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.displayName}</strong>
                  <span className="muted"> {u.email}</span>
                </div>
                <select
                  value={u.role || ROLES.STUDENT}
                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                >
                  <option value={ROLES.STUDENT}>Student</option>
                  <option value={ROLES.MODERATOR}>Moderator</option>
                  <option value={ROLES.ADMIN}>Admin</option>
                  <option value={ROLES.SUPERADMIN}>Super Admin</option>
                </select>
              </li>
            ))}
          </ul>
        </section>

        <section className="section muted-box">
          <h3>Firebase production rules</h3>
          <p>
            Deploy <code>firestore.rules</code> from this repo. Roles: superadmin &gt; admin &gt;
            moderator &gt; student.
          </p>
        </section>
      </main>
    </div>
  );
}
