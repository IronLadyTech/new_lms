export const ROLES = {
  GUEST: 'guest',
  STUDENT: 'student',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  SUPERADMIN: 'superadmin',
};

export const ROLE_HIERARCHY = {
  [ROLES.GUEST]: -1,
  [ROLES.STUDENT]: 0,
  [ROLES.MODERATOR]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPERADMIN]: 3,
};

export function hasMinRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 99);
}

export function isAdminRole(role) {
  return [ROLES.ADMIN, ROLES.MODERATOR, ROLES.SUPERADMIN].includes(role);
}

export function isModeratorOnly(role) {
  return role === ROLES.MODERATOR;
}

export function isFullAdmin(role) {
  return [ROLES.ADMIN, ROLES.SUPERADMIN].includes(role);
}

export function isGuestRole(role) {
  return role === ROLES.GUEST;
}

/** User-facing role label (student → user). */
export function getRoleLabel(role) {
  if (role === ROLES.GUEST) return 'Guest';
  if (role === ROLES.STUDENT || !role) return 'User';
  if (role === ROLES.SUPERADMIN) return 'Super Admin';
  if (role === ROLES.ADMIN) return 'Admin';
  if (role === ROLES.MODERATOR) return 'Customer Expression';
  return role;
}
