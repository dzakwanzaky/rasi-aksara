import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushMessage } from "./push";

// Server side of round notifications. Everything here uses the admin (secret key) client: push_config has no
// policies, and sending needs every staff's subscription. VAPID keys are made once, on first use, and kept in
// push_config, so nobody has to generate or paste them.

export type PushConfig = { vapid_public: string; vapid_private: string; app_url: string | null; cron_secret: string; last_round: string | null };

/** The app's own production address, for the database's timer to call. Only known on Vercel production. */
export function productionUrl(): string | null {
  if (process.env.VERCEL_ENV !== "production") return null;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : null;
}

export async function loadPushConfig(admin: SupabaseClient): Promise<PushConfig> {
  const { data, error } = await admin.from("push_config").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error("Tabel notifikasi belum ada. Jalankan 0017_push_ronde.sql di Supabase. (" + error.message + ")");
  if (!data) throw new Error("push_config kosong. Jalankan ulang 0017_push_ronde.sql di Supabase.");
  const patch: Record<string, string> = {};
  if (!data.vapid_public || !data.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    patch.vapid_public = keys.publicKey;
    patch.vapid_private = keys.privateKey;
  }
  const url = productionUrl();
  if (url && data.app_url !== url) patch.app_url = url;
  if (Object.keys(patch).length) {
    // Two first requests at once could both make keys; only the first write wins, then everyone re-reads it.
    if (patch.vapid_public) {
      await admin.from("push_config").update(patch).eq("id", 1).is("vapid_public", null);
      if (patch.app_url) await admin.from("push_config").update({ app_url: patch.app_url }).eq("id", 1);
      const again = await admin.from("push_config").select("*").eq("id", 1).single();
      return again.data as PushConfig;
    }
    await admin.from("push_config").update(patch).eq("id", 1);
    return { ...data, ...patch } as PushConfig;
  }
  return data as PushConfig;
}

export type Subscription = { endpoint: string; p256dh: string; auth: string; username: string };

/** Sends to each subscription; drops those the phone has revoked (404/410). Returns how many arrived. */
export async function sendPush(admin: SupabaseClient, cfg: PushConfig, subs: Subscription[], msg: PushMessage) {
  webpush.setVapidDetails(cfg.app_url ?? productionUrl() ?? "mailto:notifikasi@example.com", cfg.vapid_public, cfg.vapid_private);
  const payload = JSON.stringify(msg);
  const ok: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 25, urgency: "high" });
      ok.push(s.endpoint);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else failed.push(`${s.username}: ${code ?? (e instanceof Error ? e.message : String(e))}`);
    }
  }));
  if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  if (ok.length) await admin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).in("endpoint", ok);
  return { sent: ok.length, removed: gone.length, failed };
}
