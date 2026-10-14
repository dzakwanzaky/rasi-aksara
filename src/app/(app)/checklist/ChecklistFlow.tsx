"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  HOURS, SHEETS, hourlyKey, itemKey, itemNoteKey, noteKey, readAmount, rupiah, tickKeys,
  type CheckItem, type Entry, type Section, type Sheet, type SheetId,
} from "@/lib/checklist";

type Entries = Record<string, Partial<Entry>>;

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "";

export function ChecklistFlow(props: {
  date: string; initialSheet: SheetId; hourNow: number; me: string; initialEntries: Entries; readOnly: boolean;
  prevClosing: { dateText: string; text: string } | null;
}) {
  const { date, hourNow, me, readOnly } = props;
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entries>(props.initialEntries);
  const [sheetId, setSheetId] = useState<SheetId>(props.initialSheet);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");
  const sheet = SHEETS.find((s) => s.id === sheetId)!;

  // Ticks save straight away; typing saves after a short pause. Only changed fields are sent,
  // so two phones working on the same item never wipe each other's tick or text.
  const pending = useRef<Map<string, Partial<Entry>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function flush() {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    const { data: { session: auth } } = await supabase.auth.getSession();
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const [key, e] of batch) {
      const fields = Object.keys(e).sort().join(",");
      groups.set(fields, [...(groups.get(fields) ?? []), {
        check_date: date, key, ...e, updated_by: auth?.user.id, updated_at: new Date().toISOString(),
      }]);
    }
    const results = await Promise.all(
      [...groups.values()].map((rows) => supabase.from("checklist_entries").upsert(rows, { onConflict: "check_date,key" })),
    );
    if (results.some((r) => r.error)) {
      batch.forEach(([k, e]) => pending.current.set(k, { ...e, ...pending.current.get(k) }));
      setSaveState("error");
      timer.current = setTimeout(flush, 3000);
    } else {
      setSaveState(pending.current.size ? "saving" : "saved");
    }
  }
  function change(updates: Record<string, Partial<Entry>>, delay: number) {
    setEntries((prev) => {
      const next = { ...prev };
      for (const [k, e] of Object.entries(updates)) next[k] = { ...prev[k], ...e };
      return next;
    });
    for (const [k, e] of Object.entries(updates)) pending.current.set(k, { ...pending.current.get(k), ...e });
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }
  const tickFields = (done: boolean): Partial<Entry> =>
    done ? { done, done_by: me, done_at: new Date().toISOString() } : { done, done_by: null, done_at: null };
  const tick = (keys: string[], done: boolean) => change(Object.fromEntries(keys.map((k) => [k, tickFields(done)])), 150);
  const type = (key: string, value: string) => change({ [key]: { value } }, 700);

  // Show what other phones save, live. A box someone is typing in here keeps their own text.
  const typing = useRef<string | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel(`checklist-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklist_entries", filter: `check_date=eq.${date}` },
        (msg) => {
          const row = msg.new as Partial<Entry> & { key?: string };
          if (!row?.key) return;
          const mine = pending.current.get(row.key) ?? {};
          setEntries((prev) => {
            const cur = { ...prev[row.key!] };
            if (!("done" in mine)) Object.assign(cur, { done: row.done, done_by: row.done_by, done_at: row.done_at });
            if (!("value" in mine) && typing.current !== row.key) cur.value = row.value;
            return { ...prev, [row.key!]: cur };
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, date]);
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(id: SheetId) {
    setSheetId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("lembar", id);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }

  const progress = (s: Sheet) => {
    const keys = tickKeys(s, hourNow);
    return { done: keys.filter((k) => entries[k]?.done).length, total: keys.length };
  };
  const p = progress(sheet);

  const field = { entries, type, typing };

  return (
    <div className="checklist">
      <div className="countbar">
        <div className="filters">
          {SHEETS.map((s) => {
            const sp = progress(s);
            return (
              <button key={s.id} className="chip" aria-pressed={s.id === sheetId} onClick={() => pick(s.id)}>
                {s.title} <b>{sp.done}/{sp.total}</b>
              </button>
            );
          })}
        </div>
        <div className="row">
          <p className="progress-text">
            <b>{p.done}</b> dari {p.total} sudah dicentang <span className="muted">· {sheet.hours}</span>
          </p>
          <span className="spacer" />
          <span className={`savestate ${saveState}`}>
            {saveState === "saving" ? "Menyimpan…" : saveState === "saved" ? "Tersimpan" : saveState === "error" ? "Gagal menyimpan, mencoba lagi" : ""}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={p.done} aria-valuemax={p.total}>
          <span style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
        </div>
      </div>

      {readOnly ? (
        <p className="note">Ini riwayat hari yang sudah lewat, jadi hanya bisa dilihat dan tidak bisa diubah.</p>
      ) : (
        <p className="autosave-note">
          <b>✓ Tersimpan otomatis.</b> Tinggal centang. Nama kamu dan jamnya tercatat sendiri sebagai paraf.
        </p>
      )}

      {/* A past day is history: every box and tick below is locked (Zaky, 14 Okt 2026). */}
      <fieldset className="ck-lock" disabled={readOnly}>

      {sheet.sections.map((s) => (
        <section key={s.title} className="ck-section">
          <h3>{s.title}</h3>
          {s.hint && <p className="muted ck-hint">{s.hint}</p>}
          {s.kind === "reminder" ? (
            <ul className="ck-reminders">
              {s.items.map((i) => (
                <li key={i.key}>
                  <span className="ck-time">{i.time}</span>
                  <span>{i.text}</span>
                </li>
              ))}
            </ul>
          ) : s.kind === "hourly" ? (
            <Hourly section={s} entries={entries} hourNow={hourNow} tick={tick} readOnly={readOnly} />
          ) : (
            <ul className="ck-list">
              {s.items.map((i) => (
                <Item key={i.key} sheet={sheet} item={i} tick={tick} field={field} readOnly={readOnly}>
                  {sheet.id === "opening" && i.key === "baca-closing" && (
                    <div className="note ck-note">
                      {props.prevClosing ? (
                        <>
                          <b>Catatan closing {props.prevClosing.dateText}:</b>
                          <p className="pre">{props.prevClosing.text}</p>
                        </>
                      ) : "Belum ada catatan closing sebelumnya."}
                    </div>
                  )}
                  {sheet.id === "handover" && i.key === "token" && entries[itemKey("opening", "token")]?.value && (
                    <p className="calc">Token saat opening: <b>{entries[itemKey("opening", "token")]?.value} kWh</b></p>
                  )}
                  {sheet.id === "closing" && i.key === "cash" && <Selisih entries={entries} />}
                </Item>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="ck-section">
        <h3>{sheet.noteLabel}</h3>
        <TextBox k={noteKey(sheet.id)} multiline placeholder={readOnly ? "Tidak ada catatan." : "Tulis catatan untuk shift berikutnya…"} {...field} />
      </section>
      </fieldset>
    </div>
  );
}

type Field = {
  entries: Entries; type: (key: string, value: string) => void; typing: React.RefObject<string | null>;
};

function TextBox({ k, multiline, placeholder, numeric, entries, type, typing }: Field & {
  k: string; multiline?: boolean; placeholder?: string; numeric?: boolean;
}) {
  const common = {
    value: String(entries[k]?.value ?? ""),
    placeholder,
    onFocus: () => { typing.current = k; },
    onBlur: () => { typing.current = null; },
  };
  return multiline
    ? <textarea className="ck-text" rows={3} {...common} onChange={(e) => type(k, e.target.value)} />
    : <input className="ck-input" autoComplete="off" inputMode={numeric ? "decimal" : undefined} {...common} onChange={(e) => type(k, e.target.value)} />;
}

function Item({ sheet, item, tick, field, readOnly, children }: {
  sheet: Sheet; item: CheckItem; tick: (keys: string[], done: boolean) => void; field: Field; readOnly: boolean; children?: React.ReactNode;
}) {
  const k = itemKey(sheet.id, item.key);
  const e = field.entries[k] ?? {};
  const note = field.entries[itemNoteKey(k)]?.value ?? "";
  const [showNote, setShowNote] = useState(note !== "");
  return (
    <li className={`ck-item${e.done ? " done" : ""}`}>
      <label className="ck-row">
        <input type="checkbox" checked={!!e.done} onChange={(ev) => tick([k], ev.target.checked)} />
        <span>
          {item.time && <span className="ck-time">{item.time}</span>}
          {item.text}
        </span>
      </label>
      {item.input && (
        <label className="ck-field">
          <span>{item.input.label}</span>
          {item.input.prefix && <span className="muted">{item.input.prefix}</span>}
          <TextBox k={k} numeric={item.input.numeric} {...field} />
          {item.input.unit && <span className="muted">{item.input.unit}</span>}
        </label>
      )}
      {children}
      <div className="ck-extra">
        {e.done && <span className="ck-by">✓ {e.done_by || "?"} · {clock(e.done_at)}</span>}
        <span className="spacer" />
        {item.link && <Link className="linkbtn" href={item.link.href}>{item.link.label} →</Link>}
        {!showNote && !readOnly && <button className="linkbtn" onClick={() => setShowNote(true)}>+ Catatan</button>}
      </div>
      {showNote && <TextBox k={itemNoteKey(k)} placeholder="Catatan (kalau ada)" {...field} />}
    </li>
  );
}

function Hourly({ section, entries, hourNow, tick, readOnly }: {
  section: Section; entries: Entries; hourNow: number; tick: (keys: string[], done: boolean) => void; readOnly: boolean;
}) {
  const hours = HOURS.filter((h) => h <= hourNow);
  if (!hours.length) return <p className="muted">Hourly check mulai jam {String(HOURS[0]).padStart(2, "0")}.00.</p>;
  return (
    <ul className="ck-hours">
      {[...hours].reverse().map((h) => {
        const keys = section.items.map((i) => hourlyKey(h, i.key));
        const done = keys.filter((k) => entries[k]?.done);
        const by = [...new Set(done.map((k) => entries[k]?.done_by).filter(Boolean))].join(", ");
        const current = h === hourNow;
        const missed = !current && done.length === 0 && hourNow < 24;
        return (
          <li key={h}>
            <details open={current}>
              <summary className="ck-hour">
                <b>{String(h).padStart(2, "0")}.00</b>
                {current && <span className="pill">Sekarang</span>}
                <span className="spacer" />
                {done.length === keys.length
                  ? <span className="pill">✓ {by}</span>
                  : missed
                    ? <span className="pill bad">Terlewat</span>
                    : <span className={`pill${done.length ? " warn" : ""}`}>{done.length}/{keys.length}</span>}
              </summary>
              <ul className="ck-list">
                {section.items.map((i, n) => {
                  const k = keys[n];
                  const e = entries[k] ?? {};
                  return (
                    <li key={k} className={`ck-item${e.done ? " done" : ""}`}>
                      <label className="ck-row">
                        <input type="checkbox" checked={!!e.done} onChange={(ev) => tick([k], ev.target.checked)} />
                        <span>{i.text}</span>
                      </label>
                      {e.done && <p className="ck-by">✓ {e.done_by || "?"} · {clock(e.done_at)}</p>}
                    </li>
                  );
                })}
              </ul>
              {done.length < keys.length && !readOnly && (
                <button className="btn primary ck-all" onClick={() => tick(keys.filter((k) => !entries[k]?.done), true)}>
                  Semua sudah dicek
                </button>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Selisih({ entries }: { entries: Entries }) {
  const total = readAmount(entries[itemKey("closing", "tutup-majoo")]?.value);
  const cash = readAmount(entries[itemKey("closing", "cash")]?.value);
  if (total == null || cash == null) return null;
  const d = cash - total;
  return (
    <p className={`calc${d !== 0 ? " warn" : ""}`}>
      Selisih (cash fisik − total transaksi): <b>{d < 0 ? "−" : ""}{rupiah(Math.abs(d))}</b>
    </p>
  );
}
