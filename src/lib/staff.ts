// Staff log in with a username. Supabase Auth needs an email, so each username maps to an address on a
// domain that never receives mail; accounts are created confirmed, so no invite email is ever sent.
export const STAFF_DOMAIN = "rasiaksara.local";

export const USERNAME_RULE = "3–30 huruf kecil, angka, titik, strip atau garis bawah";

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validUsername(username: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(username);
}

/** What to send to Supabase for what was typed in the login box: a username or a full email. */
export function loginEmail(input: string): string {
  const v = input.trim();
  return v.includes("@") ? v : `${normalizeUsername(v)}@${STAFF_DOMAIN}`;
}

export function staffEmail(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_DOMAIN}`;
}

/** The name to show for an account: the username for staff accounts, the email otherwise. */
export function accountLabel(email: string | null | undefined): string {
  if (!email) return "";
  return email.endsWith(`@${STAFF_DOMAIN}`) ? email.slice(0, -STAFF_DOMAIN.length - 1) : email;
}
