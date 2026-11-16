import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { accountLabel } from "@/lib/staff";
import type { Account } from "@/lib/jadwal";
import { loadNames } from "@/lib/names-server";

/** Staff logins to link names in the sheet to. Needs the Supabase secret key (as /staff does); without it,
 * falls back to the usernames that have used Absen or are already linked. */
export async function listAccounts(): Promise<Account[]> {
  const book = await loadNames(await createClient());
  const named = (a: Account): Account => (book[a.username] ? { ...a, name: book[a.username].full, nick: book[a.username].nick } : a);
  return (await logins()).map(named);
}

async function logins(): Promise<Account[]> {
  if (adminConfigured()) {
    const { data } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
    const now = Date.now();
    return (data?.users ?? [])
      .filter((u) => {
        const until = (u as { banned_until?: string | null }).banned_until;
        return !until || new Date(until).getTime() <= now;
      })
      .map((u) => ({ username: accountLabel(u.email), name: (u.user_metadata?.name as string | undefined) ?? "" }))
      .filter((a) => a.username)
      .sort((a, b) => a.username.localeCompare(b.username));
  }
  const supabase = await createClient();
  const [{ data: a }, { data: s }] = await Promise.all([
    supabase.from("attendance").select("username").limit(1000),
    supabase.from("shift_schedule").select("username").not("username", "is", null).limit(1000),
  ]);
  const names = new Set([...(a ?? []), ...(s ?? [])].map((r) => r.username as string));
  return [...names].sort().map((username) => ({ username, name: "" }));
}

