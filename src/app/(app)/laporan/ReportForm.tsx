"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_MODAL, MONEY_FIELDS, SHIFTS, formatNumber, hasil, omsetLain, readRupiah, rupiah, selisih,
  type MoneyKey, type Report, type ShiftId,
} from "@/lib/laporan";

type Draft = Record<string, string>;
const TEXT_FIELDS = ["pengeluaran_note", "catatan"] as const;

const toDraft = (r?: Partial<Report>): Draft => ({
  ...Object.fromEntries(MONEY_FIELDS.map((f) => [f.key, formatNumber(r ? r[f.key] : f.key === "modal" ? DEFAULT_MODAL : null)])),
  ...Object.fromEntries(TEXT_FIELDS.map((k) => [k, r?.[k] ?? ""])),
});
const isMoney = (k: string): k is MoneyKey => MONEY_FIELDS.some((f) => f.key === k);
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function ReportForm(props: {
  date: string; initialShift: ShiftId; initialReports: Partial<Record<ShiftId, Report>>; me: string; readOnly: boolean;
}) {
  const { date, me, readOnly } = props;
  const supabase = useMemo(() => createClient(), []);
  const [shift, setShift] = useState<ShiftId>(props.initialShift);
  const [saved, setSaved] = useState(props.initialReports);
  const [drafts, setDrafts] = useState<Partial<Record<ShiftId, Draft>>>(
    Object.fromEntries(SHIFTS.map((s) => [s.id, toDraft(props.initialReports[s.id])])),
  );
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const draft = drafts[shift] ?? toDraft();

  // Typing saves after a short pause. Only the boxes that changed are sent.
  const pending = useRef<Map<ShiftId, Record<string, unknown>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function flush() {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    const { data: { session: auth } } = await supabase.auth.getSession();
    const stamp = { updated_by: auth?.user.id, updated_by_name: me, updated_at: new Date().toISOString() };
    const results = await Promise.all(batch.map(([s, fields]) =>
      supabase.from("daily_reports")
        .upsert({ report_date: date, shift: s, ...fields, ...stamp }, { onConflict: "report_date,shift" })
        .select().single(),
    ));
    if (results.some((r) => r.error)) {
      batch.forEach(([s, f]) => pending.current.set(s, { ...f, ...pending.current.get(s) }));
      setSaveState("error");
      timer.current = setTimeout(flush, 3000);
      return;
    }
    setSaved((prev) => ({ ...prev, ...Object.fromEntries(results.map((r) => [r.data.shift, r.data])) }));
    setSaveState(pending.current.size ? "saving" : "saved");
  }
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function type(key: string, text: string) {
    setDrafts((prev) => ({ ...prev, [shift]: { ...(prev[shift] ?? toDraft()), [key]: text } }));
    let value: unknown = text;
    if (isMoney(key)) {
      const n = readRupiah(text);
      if (Number.isNaN(n)) return; // not a number yet: keep it on screen, red, unsaved
      value = n;
    }
    const fields = { ...pending.current.get(shift), [key]: value };
    // A new report keeps the usual modal unless someone types another one.
    if (!saved[shift] && !("modal" in fields)) fields.modal = readRupiah(draft.modal) ?? DEFAULT_MODAL;
    pending.current.set(shift, fields);
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }
  function tidy(key: string) {
    const n = readRupiah(draft[key] ?? "");
    if (n != null && !Number.isNaN(n)) setDrafts((prev) => ({ ...prev, [shift]: { ...draft, [key]: formatNumber(n) } }));
  }

  function pick(id: ShiftId) {
    setShift(id);
    const url = new URL(window.location.href);
    url.searchParams.set("shift", id);
    window.history.replaceState(null, "", url);
  }

  // What the boxes say right now, for the sums below.
  const nums = Object.fromEntries(MONEY_FIELDS.map((f) => {
    const n = readRupiah(draft[f.key] ?? "");
    return [f.key, n == null || Number.isNaN(n) ? null : n];
  })) as Partial<Report>;
  const diff = selisih(nums);
  const out = hasil(nums);
  const lain = omsetLain(nums);
  const last = saved[shift];

  return (
    <div className="laporan">
      <div className="countbar">
        <div className="filters">
          {SHIFTS.map((s) => (
            <button key={s.id} className="chip" aria-pressed={s.id === shift} onClick={() => pick(s.id)}>
              {s.label} {saved[s.id] && <b>✓</b>}
            </button>
          ))}
        </div>
        <div className="row">
          <p className="progress-text muted">
            {last ? <>Terakhir diisi {last.updated_by_name === "sheet" ? "dari sheet" : last.updated_by_name || "?"} · {when(last.updated_at)}</> : "Belum diisi"}
          </p>
          <span className="spacer" />
          <span className={`savestate ${saveState}`}>
            {saveState === "saving" ? "Menyimpan…" : saveState === "saved" ? "Tersimpan" : saveState === "error" ? "Gagal menyimpan, mencoba lagi" : ""}
          </span>
        </div>
      </div>

      {readOnly ? (
        <p className="note">Ini laporan hari yang sudah lewat, jadi hanya bisa dilihat dan tidak bisa diubah.</p>
      ) : (
        <p className="autosave-note">
          <b>✓ Tersimpan otomatis.</b> Isi angka dari Majoo dan hasil hitung uang di laci. Plus/minus dihitung sendiri.
        </p>
      )}

      <fieldset className="ck-lock" disabled={readOnly}>
        <section className="ck-section">
          <h3>Angka shift ini</h3>
          <div className="lp-fields">
            {MONEY_FIELDS.map((f) => {
              const bad = Number.isNaN(readRupiah(draft[f.key] ?? ""));
              return (
                <label key={f.key} className="lp-field">
                  <span className="lp-label">
                    <b>{f.label}</b>
                    <span className="muted">{f.hint}</span>
                  </span>
                  <span className="lp-input">
                    <span className="muted">Rp</span>
                    <input
                      className={bad ? "bad" : undefined} inputMode="numeric" autoComplete="off" placeholder="0"
                      value={draft[f.key] ?? ""} onChange={(e) => type(f.key, e.target.value)} onBlur={() => tidy(f.key)}
                    />
                  </span>
                  {f.key === "pengeluaran" && (
                    <input
                      className="ck-input lp-note" autoComplete="off" placeholder="Untuk apa? (misal: es batu, galon)"
                      value={draft.pengeluaran_note ?? ""} onChange={(e) => type("pengeluaran_note", e.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </section>

        <section className="ck-section">
          <h3>Hasil hitungan</h3>
          <div className="lp-sum">
            <div className={`lp-sum-row ${diff == null ? "" : diff > 0 ? "plus" : diff < 0 ? "minus" : "pas"}`}>
              <span>{diff == null ? "Plus / minus" : diff > 0 ? "Plus" : diff < 0 ? "Minus" : "Pas"}<small>Tunai aktual − tunai sistem</small></span>
              <b>{diff == null ? "–" : rupiah(Math.abs(diff))}</b>
            </div>
            <div className="lp-sum-row">
              <span>Hasil<small>Tunai aktual − modal</small></span>
              <b>{out == null ? "–" : rupiah(out)}</b>
            </div>
            {lain != null && lain !== 0 && (
              <div className="lp-sum-row">
                <span>Omset selain tunai & TF<small>Omset − tunai sistem − TF sistem</small></span>
                <b>{rupiah(lain)}</b>
              </div>
            )}
          </div>
        </section>

        <section className="ck-section">
          <h3>Catatan</h3>
          <textarea
            className="ck-text" rows={3} placeholder={readOnly ? "Tidak ada catatan." : "Kenapa minus, uang titipan, kejadian lain…"}
            value={draft.catatan ?? ""} onChange={(e) => type("catatan", e.target.value)}
          />
        </section>
      </fieldset>
    </div>
  );
}
