"use client";

import { useRouter } from "next/navigation";

/** Tap to open the phone's calendar and jump straight to a day (Zaky, 14 Okt 2026). */
export function DatePick({ date, today, path = "/checklist" }: { date: string; today: string; path?: string }) {
  const router = useRouter();
  function go(d: string) {
    if (!d || d > today) return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", d);
    router.push(`${path}?${url.searchParams}`);
  }
  return (
    <div className="ck-datepick">
      <label className="btn small">
        📅 Pilih tanggal
        <input type="date" value={date} max={today} aria-label="Pilih tanggal" onChange={(e) => go(e.target.value)} />
      </label>
      {date !== today && <button className="btn small" onClick={() => go(today)}>Ke hari ini</button>}
    </div>
  );
}
