"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SHIFTS, distanceM, geoErrorText, shiftLabel, type Shift } from "@/lib/absen";
import { clockOther, clockSelf, type Fix, type Result } from "./actions";

type Place = { lat: number; lng: number; radius: number };

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

  async function run(label: string, send: (fix: Fix) => Promise<Result>) {
    setBusy(label);
    setMsg({});
    try {
      const fix = await readLocation();
      const dist = distanceM(place!.lat, place!.lng, fix.lat, fix.lng);
      if (dist > place!.radius) {
        setMsg({
          error: `Kamu ${Math.round(dist)} m dari Rasi Aksara (batas ${place!.radius} m). Clock in/out hanya bisa di kafe.` +
            (fix.accuracy > 50 ? ` GPS kurang tepat (±${Math.round(fix.accuracy)} m): coba dekat pintu/jendela lalu ulangi.` : ""),
        });
        return;
      }
      const res = await send(fix);
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
            <button className="btn primary bigbtn" disabled={!!busy} onClick={() => run("out", (fix) => clockSelf("out", shift, fix))}>
              {busy === "out" ? "Membaca lokasi…" : "Clock out"}
            </button>
          </>
        ) : (
          <>
            <p className="ab-status">{doneToday.length ? `Sudah selesai hari ini: ${doneToday.join(", ")}` : "Belum clock in hari ini."}</p>
            <ShiftPick value={shift} onChange={setShift} />
            <button className="btn primary bigbtn" disabled={!!busy} onClick={() => run("in", (fix) => clockSelf("in", shift, fix))}>
              {busy === "in" ? "Membaca lokasi…" : "Clock in"}
            </button>
          </>
        )}
        <p className="muted small">Lokasi HP dicek saat tombol ditekan. Harus berada di Rasi Aksara (maks. {place.radius} m).</p>
        {msg.ok && <p className="ab-ok">✓ {msg.ok}</p>}
        {msg.error && <p className="error">{msg.error}</p>}
      </div>

      <details className="panel ab-friend">
        <summary><b>HP bersama?</b> <span className="muted">Absen untuk teman pakai akunnya</span></summary>
        <p className="help">
          Teman mengetik username dan password-nya sendiri. Akun di HP ini tidak ikut keluar.
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
            onClick={() => run("fin", (fix) => clockOther("in", friendShift, fix, friend.username, friend.password))}>
            {busy === "fin" ? "Membaca lokasi…" : "Clock in teman"}
          </button>
          <button className="btn" disabled={!!busy}
            onClick={() => run("fout", (fix) => clockOther("out", friendShift, fix, friend.username, friend.password))}>
            {busy === "fout" ? "Membaca lokasi…" : "Clock out teman"}
          </button>
        </div>
      </details>
    </>
  );
}
