"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "./Camera";
import { createClient } from "@/lib/supabase/client";
import {
  HOURS, SHEETS, hourlyKey, itemKey, itemNoteKey, noteKey, readAmount, rupiah, tickKeys,
  type CheckItem, type Entry, type Section, type Sheet, type SheetId,
} from "@/lib/checklist";

type Entries = Record<string, Partial<Entry>>;

export type Photo = { id: string; path: string; url: string | null; taken_by: string | null; taken_at: string; uploading?: boolean };
type Photos = Record<string, Photo[]>;
type PhotoApi = {
  photos: Photos; view: (p: Photo) => void; readOnly: boolean; error: Record<string, string>;
  /** Ticking opens the camera; the tick is saved once the photo is up. Unticking needs no photo. */
  toggle: (key: string, title: string, checked: boolean) => void;
  shoot: (key: string, title: string) => void;
};
const PhotoCtx = createContext<PhotoApi | null>(null);
const BUCKET = "checklist-photos";

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "";

export function ChecklistFlow(props: {
  date: string; initialSheet: SheetId; hourNow: number; me: string; initialEntries: Entries; readOnly: boolean;
  initialPhotos: Photos;
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

  // Photo proof is required for every tick (Zaky, 18 Okt 2026): ticking opens the live camera,
  // the photo goes to the private bucket, gets recorded against the item, and only then is the item ticked.
  const [photos, setPhotos] = useState<Photos>(props.initialPhotos);
  const [photoError, setPhotoError] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [shooting, setShooting] = useState<{ key: string; title: string } | null>(null);
  const putPhoto = (key: string, p: Photo, replaceId?: string) =>
    setPhotos((prev) => {
      const list = (prev[key] ?? []).filter((x) => x.id !== (replaceId ?? p.id) && x.path !== p.path);
      return { ...prev, [key]: [...list, p] };
    });
  async function addPhoto(key: string, blob: Blob) {
    const tempId = `tmp-${Date.now()}`;
    const localUrl = URL.createObjectURL(blob);
    putPhoto(key, { id: tempId, path: "", url: localUrl, taken_by: me, taken_at: new Date().toISOString(), uploading: true });
    setPhotoError((prev) => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const path = `${date}/${crypto.randomUUID()}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data, error } = await supabase.from("checklist_photos")
        .insert({ check_date: date, key, path, taken_by: me }).select("id, taken_at").single();
      if (error) throw error;
      putPhoto(key, { id: data.id, path, url: localUrl, taken_by: me, taken_at: data.taken_at }, tempId);
      if (!entries[key]?.done) tick([key], true);
    } catch (e) {
      console.error("Photo upload failed", e);
      setPhotos((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((x) => x.id !== tempId) }));
      const msg = String((e as { message?: string })?.message ?? "");
      const notSetUp = /bucket not found|checklist_photos|schema cache/i.test(msg);
      setPhotoError((prev) => ({
        ...prev,
        [key]: notSetUp
          ? "Fitur foto belum aktif di database. Minta admin menjalankan 0011_checklist_photos.sql di Supabase."
          : "Foto gagal dikirim. Cek sinyal lalu coba lagi.",
      }));
    }
  }
  useEffect(() => {
    const channel = supabase
      .channel(`checklist-photos-${date}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checklist_photos", filter: `check_date=eq.${date}` },
        async (msg) => {
          const row = msg.new as { id: string; key: string; path: string; taken_by: string | null; taken_at: string };
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.path, 60 * 60 * 12);
          setPhotos((prev) => {
            if ((prev[row.key] ?? []).some((x) => x.path === row.path)) return prev;
            return { ...prev, [row.key]: [...(prev[row.key] ?? []), { ...row, url: data?.signedUrl ?? null }] };
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, date]);
  const photoApi: PhotoApi = {
    photos, view: setViewing, readOnly, error: photoError,
    shoot: (key, title) => setShooting({ key, title }),
    toggle: (key, title, checked) => (checked ? setShooting({ key, title }) : tick([key], false)),
  };

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
    <PhotoCtx.Provider value={photoApi}>
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
          <b>📷 Centang = foto bukti.</b> Saat dicentang, kamera langsung terbuka. Foto, nama kamu, dan jamnya tersimpan otomatis sebagai paraf.
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
      {shooting && (
        <Camera
          title={shooting.title}
          onClose={() => setShooting(null)}
          onShot={(blob) => { const k = shooting.key; setShooting(null); void addPhoto(k, blob); }}
        />
      )}
      {viewing && (
        <div className="ck-viewer" role="dialog" aria-label="Foto" onClick={() => setViewing(null)}>
          {viewing.url && <img src={viewing.url} alt="Foto bukti" />}
          <p>📷 {viewing.taken_by || "?"} · {clock(viewing.taken_at)} <span className="muted">(ketuk untuk tutup)</span></p>
        </div>
      )}
    </div>
    </PhotoCtx.Provider>
  );
}

/** Camera button and thumbnails of one item's photo proof. */
function PhotoButton({ k, title, done }: { k: string; title: string; done: boolean }) {
  const api = useContext(PhotoCtx)!;
  if (api.readOnly || !done) return null;
  return <button type="button" className="linkbtn" onClick={() => api.shoot(k, title)}>📷 Foto lagi</button>;
}

function Tick({ k, title, done }: { k: string; title: string; done: boolean }) {
  const api = useContext(PhotoCtx)!;
  const uploading = (api.photos[k] ?? []).some((p) => p.uploading);
  return <input type="checkbox" checked={done || uploading} onChange={(ev) => api.toggle(k, title, ev.target.checked)} />;
}

function PhotoStrip({ k }: { k: string }) {
  const api = useContext(PhotoCtx)!;
  const list = api.photos[k] ?? [];
  if (!list.length && !api.error[k]) return null;
  return (
    <>
      {list.length > 0 && (
        <div className="ck-photos">
          {list.map((p) => (
            <button key={p.id} type="button" className="ck-thumb" disabled={p.uploading || !p.url} onClick={() => api.view(p)}>
              {p.url ? <img src={p.url} alt={`Foto oleh ${p.taken_by ?? "?"}`} /> : <span>Foto</span>}
              <small>{p.uploading ? "Mengirim…" : `${p.taken_by ?? "?"} · ${clock(p.taken_at)}`}</small>
            </button>
          ))}
        </div>
      )}
      {api.error[k] && <p className="error ck-photo-err">{api.error[k]}</p>}
    </>
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
        <Tick k={k} title={item.text} done={!!e.done} />
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
        <PhotoButton k={k} title={item.text} done={!!e.done} />
        {!showNote && !readOnly && <button className="linkbtn" onClick={() => setShowNote(true)}>+ Catatan</button>}
      </div>
      <PhotoStrip k={k} />
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
                        <Tick k={k} title={`${String(h).padStart(2, "0")}.00 · ${i.text}`} done={!!e.done} />
                        <span>{i.text}</span>
                      </label>
                      <div className="ck-extra">
                        {e.done && <span className="ck-by">✓ {e.done_by || "?"} · {clock(e.done_at)}</span>}
                        <span className="spacer" />
                        <PhotoButton k={k} title={`${String(h).padStart(2, "0")}.00 · ${i.text}`} done={!!e.done} />
                      </div>
                      <PhotoStrip k={k} />
                    </li>
                  );
                })}
              </ul>
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
