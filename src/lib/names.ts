// Formal names for staff (Zaky, 16 Nov 2026). Logins and every saved record keep the username
// ("rifky"); what people see is the nickname ("Rifky") or, where there is room, the full name
// ("Rifky Nur Wachid"). The names live in the staff_profiles table (0019) and are edited on /staff.

export type StaffProfile = { username: string; full_name: string; nickname: string };

/** username → names. A plain object so a server page can hand it to a client component. */
export type NameBook = Record<string, { full: string; nick: string }>;

export function makeBook(profiles: StaffProfile[]): NameBook {
  const book: NameBook = {};
  for (const p of profiles) {
    const nick = (p.nickname ?? "").trim();
    const full = (p.full_name ?? "").trim();
    if (p.username) book[p.username] = { full: full || nick, nick: nick || full.split(/\s+/)[0] || p.username };
  }
  return book;
}

/** Short name for tight spots (checklist ticks, jadwal grid, header): "Rifky". Falls back to the username. */
export function shortName(book: NameBook, username: string | null | undefined): string {
  if (!username) return "";
  return book[username]?.nick || username;
}

/** Full formal name for lists and reports: "Rifky Nur Wachid". Falls back to the nickname, then the username. */
export function fullName(book: NameBook, username: string | null | undefined): string {
  if (!username) return "";
  return book[username]?.full || book[username]?.nick || username;
}

/** "RAFI" → "Rafi", for names typed in capitals in the Excel schedule. */
export const titleCase = (name: string) => name.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());

/** The name to show for a schedule row: the person's nickname once the row is linked to their login,
 * otherwise the name as written in the Excel. */
export function scheduleName(book: NameBook, row: { name: string; username: string | null }): string {
  return row.username && book[row.username] ? book[row.username].nick : titleCase(row.name);
}
