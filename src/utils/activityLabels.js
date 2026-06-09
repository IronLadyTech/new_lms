const TYPE_LABELS = {
  resource_view: 'Resource view',
  course_enroll: 'Enrollment',
  ticket_created: 'Support ticket',
  ticket_reply: 'Ticket reply',
};

function looksLikeFirestoreId(value) {
  if (!value || typeof value !== 'string') return false;
  return value.length >= 15 && /^[A-Za-z0-9_-]+$/.test(value);
}

function resolveCourseName(courseId, courseMap) {
  if (!courseId || !courseMap?.[courseId]) return null;
  const course = courseMap[courseId];
  return course.title || course.code || null;
}

function safeTitle(title, courseId) {
  const text = title?.trim?.() || '';
  if (!text || text === courseId || looksLikeFirestoreId(text)) return null;
  return text;
}

export function formatActivityTypeLabel(type) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return (type || 'activity').replace(/_/g, ' ');
}

/** Human-readable one-line summary for admin activity lists. */
export function formatActivitySummary(activity, { courseMap = {} } = {}) {
  const type = activity?.type || 'activity';
  const title = safeTitle(activity?.title, activity?.courseId);
  const courseName = resolveCourseName(activity?.courseId, courseMap);

  switch (type) {
    case 'resource_view':
      if (title && courseName) return `Opened "${title}" in ${courseName}`;
      if (title) return `Opened resource "${title}"`;
      if (courseName) return `Viewed content in ${courseName}`;
      return 'Viewed a resource';

    case 'course_enroll':
      if (courseName) return `Enrolled in ${courseName}`;
      if (title) return `Enrolled in ${title}`;
      return 'Enrolled in a course';

    case 'ticket_created':
      if (title) return `Created ticket "${title}"`;
      return 'Created a support ticket';

    case 'ticket_reply': {
      if (!title) return 'Replied on a support ticket';
      return title.length > 72 ? `Replied: ${title.slice(0, 72)}…` : `Replied: ${title}`;
    }

    default:
      if (title) return title;
      if (courseName) return `Activity in ${courseName}`;
      return formatActivityTypeLabel(type);
  }
}
