function pad(n) {
  return String(n).padStart(2, '0');
}

export function normalizeEventLink(url) {
  const trimmed = url?.trim() || '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatGcalDateTime(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function formatGcalDateOnly(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** Opens Google Calendar "Create event" with title, time, description, and optional link. */
export function buildGoogleCalendarUrl(event) {
  const linkUrl = normalizeEventLink(event.linkUrl);
  const detailLines = [event.description?.trim(), linkUrl ? `Event link: ${linkUrl}` : '']
    .filter(Boolean)
    .join('\n\n');

  let dates = '';
  if (event.date) {
    const [y, m, d] = event.date.split('-').map(Number);
    if (event.time) {
      const [hh, mm] = event.time.split(':').map(Number);
      const start = new Date(y, m - 1, d, hh || 0, mm || 0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      dates = `${formatGcalDateTime(start)}/${formatGcalDateTime(end)}`;
    } else {
      const end = new Date(y, m - 1, d + 1);
      dates = `${formatGcalDateOnly(new Date(y, m - 1, d))}/${formatGcalDateOnly(end)}`;
    }
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Event',
    details: detailLines,
  });
  if (dates) params.set('dates', dates);
  if (linkUrl) params.set('location', linkUrl);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
