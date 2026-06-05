export const SUPER_ADMIN_EMAIL = 'ironladytech@gmail.com';
export const IRON_LADY_CONTACT_EMAIL = SUPER_ADMIN_EMAIL;

export function isSuperAdminEmail(email) {
  return email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}
