export const SUPER_ADMIN_EMAIL = 'ironladytech@gmail.com';
export const IRON_LADY_CONTACT_EMAIL = SUPER_ADMIN_EMAIL;

export function isSuperAdminEmail(email) {
  if (typeof email !== 'string') return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

/**
 * The company line. Third copy of this string was about to be written, so it
 * lives here now — the sign-in card and the app header both read it.
 */
export const IRON_LADY_VISION = 'Elevating a million women to the top';
