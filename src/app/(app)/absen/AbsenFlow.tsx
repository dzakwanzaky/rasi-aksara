"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SHIFTS, distanceM, geoErrorText, shiftLabel, type Shift } from "@/lib/absen";
import { createClient } from "@/lib/supabase/client";
import { Camera } from "../checklist/Camera";
import { clockOther, clockSelf, type Fix, type Result } from "./actions";

type Place = { lat: number; lng: number; radius: number };
type Send = (fix: Fix, photo: string) => Promise<Result>;

const todayJakarta = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** Reads the phone's GPS once, fresh (no cached position). */
export function readLocation(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("HP/browser ini tidak bisa membaca lokasi."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(geoErrorText(e.code))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function ShiftPick({ value, onChange }: { value: Shift; onChange: (s: Shift) => void }) {
  return (
    <div className="row" role="group" aria-label="Pilih shift">
      {SHIFTS.map((s) => (
        <button key={s.id} type="button" className="chip" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
          {s.label} <span className="muted small">{s.hours}</span>
        </button>
      ))}
    </div>
  );
}

export function AbsenFlow({ place, open, doneToday, defaultShift, admin }: {
  place: Place | null;
  open: { shift: string; clockIn: string } | null;
  doneToday: string[];
  defaultShift: Shift;
  admin: boolean;
}) {
  const router = useRouter();
  const [shift, setShift] = useState<Shift>(defaultShift);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<Result>({});
  const [friend, setFriend] = useState({ username: "", password: "" });
  const [friendShift, setFriendShift] = useState<Shift>(defaultShift);
  // Clocking in/out = selfie, then GPS check, then upload. GPS starts reading while the camera is open.
  const [shooting, setShooting] = useState<{ label: string; title: string; send: Send } | null>(null);
  const location = useRef<Promise<Fix | Error> | null>(null);

  if (!place) {
    return (
      <div className="panel">
        <p><b>Lokasi Rasi Aksara belum diatur.</b></p>
        {admin
          ? <p className="help">Buka <Link href="/absen/rekap">Rekap absensi</Link> dan atur lokasi kafe dulu, baru staff bisa clock in.</p>
          : <p className="help">Minta admin mengatur lokasi kafe dulu, baru bisa clock in.</p>}
      </div>
    );
  }

  function run(label: string, title: string, send: Send) {
    setMsg({});
    location.current = readLocation().catch((e: Error) => e);
    setShooting({ label, title, send });
  }

  async function afterShot(photo: Blob) {
    const job = shooting!;
    setShooting(null);
    setBusy(job.label);
    try {
      const fix = await location.current!;
      if (fix instanceof Error) throw fix;
      const dist = distanceM(place!.lat, place!.lng, fix.lat, fix.lng);
      if (dist > place!.radius) {
        setMsg({
          error: `Kamu ${Math.round(dist)} m dari Rasi Aksara (batas ${place!.radius} m). Clock in/out hanya bisa di kafe.` +
            (fix.accuracy > 50 ? ` GPS kurang tepat (±${Math.round(fix.accuracy)} m): coba dekat pintu/jendela lalu ulangi.` : ""),
        });
        return;
      }
      const path = `${todayJakarta()}/${crypto.randomUUID()}.jpg`;
      const up = await createClient().storage.from("absen-photos").upload(path, photo, { contentType: "image/jpeg" });
      if (up.error) {
        throw new Error(/bucket not found/i.test(up.error.message)
          ? "Fitur selfie belum aktif. Minta admin menjalankan 0016_absen_selfie.sql di Supabase."
          : `Selfie gagal terkirim: ${up.error.message}. Cek internet lalu coba lagi.`);
      }
      const res = await job.send(fix, path);
      setMsg(res);
      if (res.ok) {
        setFriend({ username: "", password: "" });
        router.refresh();
      }
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <div className={`panel ab-main${open ? " ab-in" : ""}`}>
        {open ? (
          <>
            <p className="ab-status">Sudah clock in jam <b>{open.clockIn}</b> · {shiftLabel(open.shift)}</p>
            <button className="btn primary bigbtn" disabled={!!busy} onClick={() => run("out", "Selfie clock out", (fix, photo) => clockSelf("out", shift, fix, photo))}>
              {busy === "out" ? "Mengirim…" : "📷 Clock out"}
            </button>
          </>
        ) : (
          <>
            <p className="ab-status">{doneToday.length ? `Sudah selesai hari ini: ${doneToday.join(", ")}` : "Belum clock in hari ini."}</p>
            <ShiftPick value={shift} onChange={setShift} />
            <button className="btn primary bigbtn" disabled={!!busy} onClick={() => run("in", "Selfie clock in", (fix, photo) => clockSelf("in", shift, fix, photo))}>
              {busy === "in" ? "Mengirim…" : "📷 Clock in"}
            </button>
          </>
        )}
        <p className="muted small">Tombol membuka kamera depan untuk selfie, lalu lokasi HP dicek. Harus berada di Rasi Aksara (maks. {place.radius} m). Jam dicatat dari server.</p>
        {msg.ok && <p className="ab-ok">✓ {msg.ok}</p>}
        {msg.error && <p className="error">{msg.error}</p>}
      </div>

      <details className="panel ab-friend">
        <summary><b>HP bersama?</b> <span className="muted">Absen untuk teman pakai akunnya</span></summary>
        <p className="help">
          Teman mengetik username dan password-nya sendiri, lalu selfie. Akun di HP ini tidak ikut keluar.
        </p>
        <div className="formgrid">
          <label className="f">Username
            <input autoCapitalize="none" autoComplete="off" value={friend.username}
              onChange={(e) => setFriend({ ...friend, username: e.target.value })} />
          </label>
          <label className="f">Password
            <input type="password" autoComplete="off" value={friend.password}
              onChange={(e) => setFriend({ ...friend, password: e.target.value })} />
          </label>
        </div>
        <p className="muted small" style={{ margin: "10px 0 6px" }}>Shift (untuk clock in):</p>
        <ShiftPick value={friendShift} onChange={setFriendShift} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" disabled={!!busy}
            onClick={() => run("fin", `Selfie clock in ${friend.username}`, (fix, photo) =>
              clockOther("in", friendShift, fix, photo, friend.username, friend.password))}>
            {busy === "fin" ? "Mengirim…" : "📷 Clock in teman"}
          </button>
          <button className="btn" disabled={!!busy}
            onClick={() => run("fout", `Selfie clock out ${friend.username}`, (fix, photo) =>
              clockOther("out", friendShift, fix, photo, friend.username, friend.password))}>
            {busy === "fout" ? "Mengirim…" : "📷 Clock out teman"}
          </button>
        </div>
      </details>

      {shooting && <Camera selfie title={shooting.title} onShot={afterShot} onClose={() => setShooting(null)} />}
    </>
  );
}
