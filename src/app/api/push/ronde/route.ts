import { NextResponse, type NextRequest } from "next/server";
import { adminConfigured, createAdminClient } from "@/lib/supabase/admin";
import { loadPushConfig, sendPush, type Subscription } from "@/lib/push-server";
import { jakartaTime, pingDue, roundKeys, roundMessage } from "@/lib/push";

// Called by the database (pg_cron + pg_net, migration 0017) at minute 0 and 30 of every hour, with the secret it
// keeps in push_config. Sends the round ping to every staff member who is clocked in right now (Absen).
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ error: "SUPABASE_SECRET_KEY belum diisi" }, { status: 500 });
  const admin = createAdminClient();
  let cfg;
  try {
    cfg = await loadPushConfig(admin);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  const secret = request.headers.get("x-ronde-secret") ?? "";
  if (!secret || secret !== cfg.cron_secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // ?at=2026-11-14T05:00:00Z lets a test pretend it is another time; it is behind the same secret.
  const at = request.nextUrl.searchParams.get("at");
  const t = jakartaTime(at ? new Date(at) : new Date());
  const ping = pingDue(t);
  if (!ping) return NextResponse.json({ skipped: "bukan jam ronde", at: t });
  if (cfg.last_round && cfg.last_round >= ping.slot) return NextResponse.json({ skipped: "sudah terkirim", slot: ping.slot });

  let done = 0;
  const keys = roundKeys(ping.hour);
  if (ping.kind === "ingat") {
    const { data } = await admin.from("checklist_entries").select("key").eq("check_date", t.date).eq("done", true).in("key", keys);
    done = data?.length ?? 0;
    if (done >= keys.length) {
      await admin.from("push_config").update({ last_round: ping.slot }).eq("id", 1);
      return NextResponse.json({ skipped: "ronde sudah lengkap", slot: ping.slot });
    }
  }

  // Staff on shift = clocked in today and not clocked out yet. If nobody used Absen today at all, everyone who
  // turned notifications on gets it, so a round is never silently skipped.
  const { data: today, error: shiftErr } = await admin.from("attendance").select("user_id, clock_out").eq("work_date", t.date);
  if (shiftErr) return NextResponse.json({ error: shiftErr.message }, { status: 500 });
  const users = [...new Set((today ?? []).filter((r) => !r.clock_out).map((r) => r.user_id as string))];
  // Mark the slot first so a retry by the timer never sends twice.
  await admin.from("push_config").update({ last_round: ping.slot }).eq("id", 1);
  if (today?.length && !users.length) return NextResponse.json({ slot: ping.slot, sent: 0, note: "semua staff sudah absen pulang" });

  let q = admin.from("push_subscriptions").select("endpoint, p256dh, auth, username");
  if (users.length) q = q.in("user_id", users);
  const { data: subs } = await q;
  const result = await sendPush(admin, cfg, (subs ?? []) as Subscription[], roundMessage(ping, done, keys.length));
  return NextResponse.json({ slot: ping.slot, target: users.length ? "absen" : "semua", ...result });
}
