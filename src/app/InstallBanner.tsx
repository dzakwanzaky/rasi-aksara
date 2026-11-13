"use client";

import { useEffect, useState } from "react";

// Asks to install the app as soon as the web is opened (Zaky, 13 Nov 2026). Android/Chrome gets a real
// "Pasang" button (the browser's own install prompt). iPhone has no such prompt, so it shows the
// Bagikan → Tambah ke Layar Utama steps. Hidden once installed, and for a week after "Nanti".

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KEY = "ra-install-later";
const WEEK = 7 * 24 * 3600_000;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function snoozed(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < WEEK;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    if (standalone()) return;
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      if (!snoozed()) setMode("android");
    };
    const onInstalled = () => setMode("none");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos() && !snoozed()) setMode("ios");
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function later() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setMode("none");
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    setPrompt(null);
    if (choice?.outcome === "accepted") setMode("none");
    else later();
  }

  if (mode === "none") return null;

  return (
    <div className="install" role="dialog" aria-label="Pasang aplikasi">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} />
      <div className="install-text">
        <b>Pasang Rasi Aksara di HP</b>
        {mode === "android" ? (
          <span>Buka langsung dari layar utama dan dapat notifikasi ronde.</span>
        ) : (
          <span>
            Tekan <b>Bagikan</b> <ShareIcon /> di Safari, lalu pilih <b>Tambah ke Layar Utama</b>.
          </span>
        )}
      </div>
      <div className="install-actions">
        {mode === "android" && <button className="btn primary small" onClick={install}>Pasang</button>}
        <button className="btn small" onClick={later}>{mode === "android" ? "Nanti" : "Tutup"}</button>
      </div>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-label="ikon Bagikan" style={{ verticalAlign: "-2px" }}>
      <path d="M7 11V1M3.5 4.5 7 1l3.5 3.5M4.5 7.5H2v9h10v-9H9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
