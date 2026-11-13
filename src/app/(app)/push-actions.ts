"use server";

import { createClient } from "@/lib/supabase/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { loadPushConfig, sendPush } from "@/lib/push-server";
import { testMessage } from "@/lib/push";
import { accountLabel } from "@/lib/staff";

type Result = { ok: true; key?: string } | { ok: false; error: string };

const fail = (e: unknown): Result => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

/** The public VAPID key the phone needs to subscribe (made on first call). */
export async function pushPublicKey(): Promise<Result> {
  if (!adminConfigured()) return { ok: false, error: "SUPABASE_SECRET_KEY belum diisi di Vercel." };
  try {
    const cfg = await loadPushConfig(createAdminClient());
    return { ok: true, key: cfg.vapid_public };
  } catch (e) {
    return fail(e);
  }
}

export type PhoneSubscription = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

/** Saves this phone for the signed-in staff, then sends a test notification so they see it work. */
export async function savePushSubscription(sub: PhoneSubscription, test = true): Promise<Result> {
  if (!adminConfigured()) return { ok: false, error: "SUPABASE_SECRET_KEY belum diisi di Vercel." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesi habis. Masuk lagi." };
  if (!/^https:\/\//.test(sub.endpoint) || !sub.p256dh || !sub.auth) return { ok: false, error: "Data notifikasi dari HP tidak lengkap." };
  const username = accountLabel(user.email);
  const admin = createAdminClient();
  // A phone handed to another staff keeps its endpoint: the row moves to whoever is signed in now.
  const { error } = await admin.from("push_subscriptions").upsert({
    endpoint: sub.endpoint, user_id: user.id, username, p256dh: sub.p256dh, auth: sub.auth,
    user_agent: sub.userAgent?.slice(0, 300) ?? null,
  });
  if (error) return fail(error.message);
  if (!test) return { ok: true };
  try {
    const cfg = await loadPushConfig(admin);
    const r = await sendPush(admin, cfg, [{ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, username }], testMessage(username));
    return r.sent ? { ok: true } : { ok: false, error: "Tersimpan, tapi tes gagal terkirim: " + (r.failed.join(", ") || "langganan ditolak HP") };
  } catch (e) {
    return fail(e);
  }
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? fail(error.message) : { ok: true };
}
