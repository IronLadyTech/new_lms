import { useMemo, useState } from 'react';
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  ANNOUNCEMENT_DURATIONS,
  ANNOUNCEMENT_AUDIENCES,
  durationLabel,
  formatExpiresIn,
  isAnnouncementActive,
} from '../../services/announcementService';
import { useConfirm } from '../../hooks/useConfirm';
import ConfirmDialog from '../ConfirmDialog';

const EMPTY_FORM = {
  title: '',
  body: '',
  duration: '24h',
  audience: 'all',
  taggedUserIds: [],
};

function formatWhen(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function AnnouncementManager({ announcements, users, onRefresh, createdBy }) {
  const { confirm, dialogProps } = useConfirm();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [userQuery, setUserQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const studentUsers = useMemo(
    () => users.filter((u) => !['admin', 'superadmin', 'moderator'].includes(u.role)),
    [users]
  );

  const filteredPickUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return studentUsers;
    return studentUsers.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [studentUsers, userQuery]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setUserQuery('');
  };

  const toggleTaggedUser = (uid) => {
    setForm((prev) => {
      const set = new Set(prev.taggedUserIds);
      if (set.has(uid)) set.delete(uid);
      else set.add(uid);
      return { ...prev, taggedUserIds: [...set] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setMsg('Title and message are required.');
      return;
    }
    if (form.audience === 'tagged' && form.taggedUserIds.length === 0) {
      setMsg('Select at least one user for tagged-only announcements.');
      return;
    }

    setSaving(true);
    setMsg('');
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        duration: form.duration,
        audience: form.audience,
        taggedUserIds: form.taggedUserIds,
        taggedUserNames: form.taggedUserIds.map((id) => {
          const u = users.find((x) => x.id === id);
          return u?.displayName || u?.email?.split('@')[0] || 'User';
        }),
        createdBy,
      };
      if (editingId) {
        await updateAnnouncement(editingId, payload);
        setMsg('Announcement updated.');
      } else {
        await createAnnouncement(payload);
        setMsg('Announcement published.');
      }
      resetForm();
      onRefresh?.();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      body: item.body || '',
      duration: item.duration || '24h',
      audience: item.audience || 'all',
      taggedUserIds: item.taggedUserIds || [],
    });
    setMsg('');
    document.getElementById('announcement-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete announcement',
      message: 'Remove this announcement for all users?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    setMsg('');
    try {
      await deleteAnnouncement(id);
      if (editingId === id) resetForm();
      setMsg('Announcement deleted.');
      onRefresh?.();
    } catch (err) {
      setMsg(err.message);
    }
  };

  const isSuccess = msg.includes('published') || msg.includes('updated') || msg.includes('deleted');

  return (
    <div className="announcement-manager">
      <form id="announcement-form" className="admin-form admin-form--stacked" onSubmit={handleSubmit}>
        <h3>{editingId ? 'Edit announcement' : 'New announcement'}</h3>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <textarea
          placeholder="Write your announcement message…"
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={4}
          required
        />
        <div className="announcement-manager__row">
          <label>
            Visible for
            <select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
              {ANNOUNCEMENT_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Audience
            <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              {ANNOUNCEMENT_AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted announcement-manager__hint">
          {form.audience === 'all'
            ? 'Everyone will see this. Tagged users get a highlighted badge.'
            : 'Only selected tagged users will see this announcement.'}
        </p>

        <div className="announcement-manager__tag-section">
          <strong>Tag users (optional)</strong>
          <input
            placeholder="Search users to tag…"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
          />
          <div className="announcement-manager__tag-list">
            {filteredPickUsers.length === 0 ? (
              <p className="muted">No users match.</p>
            ) : (
              filteredPickUsers.map((u) => (
                <label key={u.id} className="announcement-manager__tag-option">
                  <input
                    type="checkbox"
                    checked={form.taggedUserIds.includes(u.id)}
                    onChange={() => toggleTaggedUser(u.id)}
                  />
                  <span>
                    {u.displayName || u.email}
                    <span className="muted"> · {u.email}</span>
                  </span>
                </label>
              ))
            )}
          </div>
          {form.taggedUserIds.length > 0 && (
            <p className="muted">{form.taggedUserIds.length} user(s) tagged</p>
          )}
        </div>

        <div className="announcement-manager__actions">
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Update announcement' : 'Publish announcement'}
          </button>
          {editingId && (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
              Cancel edit
            </button>
          )}
        </div>
        {msg && <p className={isSuccess ? 'success-text' : 'alert alert-error'}>{msg}</p>}
      </form>

      <ul className="admin-list announcement-manager__list">
        {announcements.map((item) => {
          const active = isAnnouncementActive(item);
          const tagged = item.taggedUserIds || [];
          return (
            <li key={item.id}>
              <div className="admin-list__content">
                <div className="admin-list__title-row">
                  <strong>{item.title}</strong>
                  {!active && <span className="badge">Expired</span>}
                  {active && <span className="badge badge--soft">{formatExpiresIn(item)}</span>}
                  <span className="badge">{durationLabel(item.duration)}</span>
                  <span className="badge badge--soft">
                    {item.audience === 'tagged' ? 'Tagged only' : 'Everyone'}
                  </span>
                </div>
                <p className="admin-list__meta">{item.body}</p>
                <p className="muted admin-list__meta">
                  Posted {formatWhen(item.createdAt)}
                  {tagged.length > 0 &&
                    ` · Tagged: ${tagged
                      .map((id) => users.find((u) => u.id === id)?.displayName || 'User')
                      .join(', ')}`}
                </p>
              </div>
              <div className="admin-list__actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>
                  Delete
                </button>
              </div>
            </li>
          );
        })}
        {announcements.length === 0 && <li className="muted">No announcements yet.</li>}
      </ul>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
