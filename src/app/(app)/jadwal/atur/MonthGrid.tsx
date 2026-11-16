"use client";

import { useState, useTransition } from "react";
import { setCell } from "../actions";
import { JADWAL, dayLong, dayShort, displayName, jadwalInfo, monthDate, type Jadwal, type ScheduleRow } from "@/lib/jadwal";
import { Spinner } from "@/components/SubmitButton";

type Sel = { date: string; name: string };

export function MonthGrid({ month, days, today, rows }: { month: string; days: number; today: string; rows: ScheduleRow[] }) {
  const [cells, setCells] = useState(() => new Map(rows.map((r) => [`${r.work_date}|${r.name}`, r.shift])));
  const [sel, setSel] = useState<Sel | null>(null);
  const [err, setErr] = useState("");
  const [saving, start] = useTransition();
  const names = [...new Set(rows.map((r) => r.name))].sort((a, b) => a.localeCompare(b));
  const usernameOf = new Map(rows.map((r) => [r.name, r.username]));
  const dates = Array.from({ length: days }, (_, i) => monthDate(month, i + 1));

  function choose(shift: Jadwal | null) {
    if (!sel) return;
    const key = `${sel.date}|${sel.name}`;
    const before = cells.get(key);
    const next = new Map(cells);
    if (shift) next.set(key, shift); else next.delete(key);
    setCells(next);
    setErr("");
    const { date, name } = sel;
    setSel(null);
    start(async () => {
      try {
        await setCell(date, name, usernameOf.get(name) ?? null, shift);
      } catch (e) {
        setCells((c) => { const m = new Map(c); if (before) m.set(key, before); else m.delete(key); return m; });
        setErr(`Gagal menyimpan ${displayName(name)} ${dayLong(date)}: ${e instanceof Error ? e.message : e}`);
      }
    });
  }

  if (!names.length) return <p className="empty">Belum ada jadwal bulan ini. Upload file Excel di atas.</p>;

  const current = sel ? cells.get(`${sel.date}|${sel.name}`) : undefined;
  return (
    <>
      {err && <p className="error">{err}</p>}
      <div className="tbl jd-grid jd-month">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              {dates.map((d) => <th key={d} className={d === today ? "today" : undefined}>{dayShort(d)}<br />{Number(d.slice(8))}</th>)}
            </tr>
          </thead>
          <tbody>
            {names.map((n) => (
              <tr key={n}>
                <td>{displayName(n)}</td>
                {dates.map((d) => {
                  const s = cells.get(`${d}|${n}`);
                  const on = sel?.date === d && sel.name === n;
                  return (
                    <td key={d} className={`jd-c ${s ?? ""}${on ? " sel" : ""}${d === today ? " today" : ""}`}>
                      <button type="button" onClick={() => setSel({ date: d, name: n })} aria-label={`${n} ${dayLong(d)}: ${jadwalInfo(s)?.label ?? "kosong"}`}>
                        {jadwalInfo(s)?.short ?? "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{saving ? <><Spinner />Menyimpan perubahan…</> : "Tap satu kotak untuk mengganti shift. Perubahan langsung tersimpan."}</p>

      {sel && (
        <div className="jd-sheet" role="dialog" aria-label="Ganti shift">
          <p><b>{displayName(sel.name)}</b> · {dayLong(sel.date)}</p>
          <div className="jd-sheet-btns">
            {JADWAL.map((j) => (
              <button key={j.id} type="button" className={`btn jd-pick ${j.id}`} aria-pressed={current === j.id} onClick={() => choose(j.id)}>
                {j.label}{j.hours && <small>{j.hours}</small>}
              </button>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn small" onClick={() => choose(null)}>Kosongkan</button>
            <span className="spacer" />
            <button type="button" className="btn small" onClick={() => setSel(null)}>Tutup</button>
          </div>
        </div>
      )}
    </>
  );
}
