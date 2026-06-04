export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  SUPERADMIN: 'superadmin',
};

export const ROLE_HIERARCHY = {
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
