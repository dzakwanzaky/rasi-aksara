"use client";

import { useEffect, useState } from "react";
import { pushPublicKey, removePushSubscription, savePushSubscription, type PhoneSubscription } from "./push-actions";

// Lets a staff member turn on round notifications on their own phone (Zaky, 13 Nov 2026). Shown on the Checklist
// page. iPhones only allow it from the app installed on the home screen (iOS 16.4+), so they get those steps first.

type State = "loading" | "ios-install" | "unsupported" | "denied" | "off" | "on";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toPlain(sub: PushSubscription): PhoneSubscription {
  const j = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "", userAgent: navigator.userAgent };
}

export function NotifCard() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [install, setInstall] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIos() && !standalone() ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") {
        setState("on");
        // Keep the row pointing at whoever is signed in on this phone now (shared phones).
        savePushSubscription(toPlain(sub), false).catch(() => {});
      } else setState("off");
    })().catch(() => setState("unsupported"));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const key = await pushPublicKey();
      if (!key.ok || !key.key) throw new Error(key.ok ? "Kunci notifikasi kosong." : key.error);
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.key) }));
      const saved = await savePushSubscription(toPlain(sub));
      if (!saved.ok) throw new Error(saved.error);
      setState("on");
      setMsg("Aktif. Notifikasi tes sudah dikirim ke HP ini.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setState("off"); return; }
      const r = await savePushSubscription(toPlain(sub));
      setMsg(r.ok ? "Tes terkirim. Kalau tidak muncul dalam 1 menit, cek pengaturan notifikasi HP." : r.error);
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function doInstall() {
    if (!install) return;
    await install.prompt();
    await install.userChoice.catch(() => null);
    setInstall(null);
  }

  if (state === "loading") return null;

  return (
    <div className={`notif ${state === "on" ? "on" : ""}`}>
      {state === "on" && (
        <div className="row">
          <span className="notif-title">🔔 Notifikasi ronde aktif di HP ini</span>
          <span className="spacer" />
          <button className="btn small" onClick={test} disabled={busy}>Kirim tes</button>
          <button className="btn small" onClick={turnOff} disabled={busy}>Matikan</button>
        </div>
      )}
      {state === "off" && (
        <>
          <p className="notif-title">Dapat pengingat tiap ronde?</p>
          <p className="help">HP ini akan berbunyi jam 10, 12, 14, 17 dan 20 saat kamu sedang shift, dan sekali lagi 30 menit kemudian kalau ronde belum lengkap.</p>
          <div className="row">
            <button className="btn primary" onClick={turnOn} disabled={busy}>{busy ? "Menyalakan…" : "Nyalakan notifikasi"}</button>
            {install && <button className="btn" onClick={doInstall}>Pasang aplikasi di HP</button>}
          </div>
        </>
      )}
      {state === "ios-install" && (
        <>
          <p className="notif-title">Mau dapat pengingat ronde di iPhone?</p>
          <p className="help">
            Buka halaman ini di <b>Safari</b>, tekan tombol <b>Bagikan</b> (kotak dengan panah ke atas), pilih <b>Tambah ke Layar Utama</b>.
            Lalu buka Rasi Aksara dari ikon di layar utama dan tekan <b>Nyalakan notifikasi</b> di sini. Perlu iOS 16.4 atau lebih baru.
          </p>
        </>
      )}
      {state === "denied" && (
        <>
          <p className="notif-title">Notifikasi diblokir di HP ini</p>
          <p className="help">
            Android (Chrome): tekan ikon di kiri alamat web → <b>Izin</b> / <b>Setelan situs</b> → <b>Notifikasi</b> → <b>Izinkan</b>, lalu muat ulang.
            iPhone: <b>Pengaturan</b> → <b>Notifikasi</b> → <b>Rasi Aksara</b> → nyalakan.
          </p>
        </>
      )}
      {state === "unsupported" && (
        <p className="help">Browser ini tidak bisa menerima notifikasi. Di Android pakai Chrome; di iPhone pasang dulu ke Layar Utama lewat Safari.</p>
      )}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
