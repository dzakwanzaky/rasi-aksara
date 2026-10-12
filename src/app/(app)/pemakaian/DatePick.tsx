"use client";

import { useRouter } from "next/navigation";

export function DatePick({ dates, current }: { dates: { value: string; label: string }[]; current: string }) {
  const router = useRouter();
  return (
    <label className="f">
      Tanggal
      <select id="date" value={current} onChange={(e) => router.push(`/pemakaian?date=${e.target.value}`)}>
        {dates.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
    </label>
  );
}
