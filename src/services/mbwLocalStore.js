const PREFIX = 'il_mbw_submissions_';

export function loadLocalSubmissions(userId) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalSubmission(userId, taskId, data) {
  const all = loadLocalSubmissions(userId);
  all[taskId] = { ...data, taskId, userId, _local: true, updatedAt: Date.now() };
  localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(all));
  return all[taskId];
}

export function getLocalSubmission(userId, taskId) {
  return loadLocalSubmissions(userId)[taskId] || null;
}
