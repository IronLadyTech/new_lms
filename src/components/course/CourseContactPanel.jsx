import { MessageSquare } from 'lucide-react';

/**
 * Behance-inspired "Curator / Tech.angel" contact block, mapped to Iron Lady's
 * CX moderators for the learner's batch. Renders nothing when no moderator is
 * assigned — never shows placeholder/fake people.
 */
function initial(name, email) {
  const s = (name || email || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

export default function CourseContactPanel({ moderators = [] }) {
  if (!moderators.length) return null;

  return (
    <section className="course-contact" aria-label="Your program contacts">
      {moderators.map((m, i) => {
        const name = m.displayName || m.email?.split('@')[0] || 'Iron Lady team';
        const role = i === 0 ? 'Curator' : 'Support';
        return (
          <div key={m.id} className="course-contact__person">
            <span className="course-contact__avatar" aria-hidden="true">
              {initial(m.displayName, m.email)}
            </span>
            <span className="course-contact__meta">
              <span className="course-contact__role">{role}</span>
              <span className="course-contact__name">{name}</span>
            </span>
            {m.email && (
              <a
                href={`mailto:${m.email}`}
                className="course-contact__msg"
                aria-label={`Message ${name}`}
              >
                <MessageSquare size={16} aria-hidden="true" />
              </a>
            )}
          </div>
        );
      })}
    </section>
  );
}
