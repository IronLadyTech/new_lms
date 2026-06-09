import { useMemo } from 'react';
import { Megaphone, UserRound } from 'lucide-react';
import {
  durationLabel,
  formatExpiresIn,
  getActiveAnnouncementsForUser,
  isAnnouncementActive,
} from '../services/announcementService';

function formatWhen(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function AnnouncementFeed({
  announcements = [],
  userId,
  users = [],
  compact = false,
  emptyMessage = 'No announcements right now.',
}) {
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  const visible = useMemo(
    () => getActiveAnnouncementsForUser(announcements, userId),
    [announcements, userId]
  );

  if (visible.length === 0) {
    return compact ? null : <p className="muted">{emptyMessage}</p>;
  }

  return (
    <ul className={`announcement-feed${compact ? ' announcement-feed--compact' : ''}`}>
      {visible.map((item) => {
        const tagged = item.taggedUserIds || [];
        const isTagged = tagged.includes(userId);
        const taggedNames = item.taggedUserNames?.length
          ? item.taggedUserNames
          : tagged
              .map((id) => userMap[id]?.displayName || userMap[id]?.email?.split('@')[0])
              .filter(Boolean);

        return (
          <li
            key={item.id}
            className={`announcement-card${isTagged ? ' announcement-card--tagged' : ''}${item.audience === 'tagged' ? ' announcement-card--private' : ''}`}
          >
            <div className="announcement-card__head">
              <span className="announcement-card__icon">
                <Megaphone size={16} strokeWidth={2} />
              </span>
              <div className="announcement-card__meta">
                <strong>{item.title}</strong>
                <span className="muted announcement-card__time">
                  {formatWhen(item.createdAt)}
                  {isAnnouncementActive(item) && ` · ${formatExpiresIn(item)}`}
                  {` · ${durationLabel(item.duration)}`}
                </span>
              </div>
              {isTagged && (
                <span className="badge badge--soft announcement-card__you-tag">
                  <UserRound size={12} strokeWidth={2} />
                  You're tagged
                </span>
              )}
            </div>
            <p className="announcement-card__body">{item.body}</p>
            {taggedNames.length > 0 && (
              <div className="announcement-card__tags">
                <span className="muted">Tagged:</span>
                {taggedNames.map((name) => (
                  <span key={name} className="badge badge--soft">
                    @{name}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
