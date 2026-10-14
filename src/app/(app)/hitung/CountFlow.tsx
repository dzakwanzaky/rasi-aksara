"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatQty, parseQty, type Line } from "@/lib/qty";
import { CATEGORIES, type Item } from "@/lib/types";
import { finishCount } from "../actions";

type Lines = Record<number, Partial<Line>>;

export function CountFlow(props: {
  sessionId: string; date: string; dateText: string; isToday: boolean; prevDateText: string | null; items: Item[]; initialLines: Lines;
}) {
  const { sessionId, items } = props;
  const supabase = useMemo(() => createClient(), []);
  const [lines, setLines] = useState<Lines>(props.initialLines);
  const [cat, setCat] = useState<string>("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [q, setQ] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [saveState, setSaveState] = useState<"" | "saving" | "saved" | "error">("");

  // One upsert per pause in typing, for all items changed in that pause.
  const pending = useRef<Map<number, Partial<Line>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  async function flush() {
    const batch = [...pending.current.entries()];
    pending.current.clear();
    if (!batch.length) return;
    const { data: { session: auth } } = await supabase.auth.getSession();
    // Send only the boxes this person changed, so two phones filling different boxes of the
    // same item never wipe each other's numbers. Rows with the same changed boxes go together.
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const [item_id, l] of batch) {
      const key = Object.keys(l).sort().join(",");
      groups.set(key, [...(groups.get(key) ?? []), {
        session_id: sessionId, item_id, ...l, updated_by: auth?.user.id, updated_at: new Date().toISOString(),
      }]);
    }
    const results = await Promise.all(
      [...groups.values()].map((rows) => supabase.from("opname_lines").upsert(rows, { onConflict: "session_id,item_id" })),
    );
    if (results.some((r) => r.error)) {
      batch.forEach(([id, l]) => pending.current.set(id, { ...l, ...pending.current.get(id) }));
      setSaveState("error");
      timer.current = setTimeout(flush, 3000);
    } else setSaveState(pending.current.size ? "saving" : "saved");
  }

  // Show what other phones save, live. A box someone is still typing in here keeps their own text.
  const typing = useRef<{ itemId: number; field: string } | null>(null);
  useEffect(() => {
    const channel = supabase
      .channel(`count-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "opname_lines", filter: `session_id=eq.${sessionId}` },
        (msg) => {
          const row = msg.new as Partial<Line> & { item_id?: number };
          if (!row?.item_id) return;
          const mine = pending.current.get(row.item_id) ?? {};
          setLines((prev) => {
            const cur = { ...prev[row.item_id!] };
            for (const f of ["awal", "masuk", "tersedia"] as const) {
              const busy = f in mine || (typing.current?.itemId === row.item_id && typing.current?.field === f);
              if (!busy && f in row) cur[f] = row[f] ?? null;
            }
            return { ...prev, [row.item_id!]: cur };
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, sessionId]);
  useEffect(() => () => { clearTimeout(timer.current); void flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function edit(itemId: number, field: "tersedia" | "masuk", value: string) {
    const next = { ...lines[itemId], [field]: value };
    setLines((prev) => ({ ...prev, [itemId]: next }));
    pending.current.set(itemId, { ...pending.current.get(itemId), [field]: value });
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }

  const isDone = (i: Item) => String(lines[i.id]?.tersedia ?? "").trim() !== "";
  const done = items.filter(isDone).length;
  const ql = q.trim().toLowerCase();
  const visible = items.filter(
    (i) => (!cat || i.category === cat) && (!onlyOpen || !isDone(i)) && (!ql || i.name.toLowerCase().includes(ql)),
  );

  return (
    <div className="count">
      <div className="countbar">
        <div className="row">
          <div>
            <p className="eyebrow">Hitung stok · {props.dateText}</p>
            <p className="progress-text"><b>{done}</b> dari {items.length} bahan sudah dihitung</p>
          </div>
          <span className="spacer" />
          <span className={`savestate ${saveState}`}>
            {saveState === "saving" ? "Menyimpan…" : saveState === "saved" ? "Tersimpan" : saveState === "error" ? "Gagal menyimpan, mencoba lagi" : ""}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemax={items.length}>
          <span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
        <div className="filters">
          {["", ...CATEGORIES].map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c || "Semua"}</button>
          ))}
          <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen(!onlyOpen)}>Belum dihitung</button>
          <input id="search" type="search" placeholder="Cari bahan…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <p className="help">
        Tiap bahan punya 3 baris: <b>1</b> stok semalam = hasil hitung {props.prevDateText ?? "sebelumnya"} (otomatis),{" "}
        <b>2</b> barang masuk hari ini (pagi, kalau ada kiriman), <b>3</b> sisa di akhir shift. Boleh tulis <code>3 1/2</code> atau{" "}
        <code>3,5</code>; kalau habis tulis <code>0</code>.
      </p>

      {visible.length === 0 && (
        <p className="empty">{onlyOpen ? "Semua bahan sudah dihitung. 🎉" : "Tidak ada bahan yang cocok."}</p>
      )}

      <ul className="cards">
        {visible.map((i) => {
          const l = lines[i.id] ?? {};
          const kemarin = parseQty(l.awal, i);
          const sisa = parseQty(l.tersedia, i);
          const masuk = parseQty(l.masuk, i);
          const unreadable = Number.isNaN(sisa) || Number.isNaN(masuk);
          return (
            <li key={i.id} className={`card${isDone(i) ? " done" : ""}`}>
              <div className="card-head">
                <div>
                  <b>{i.name}</b>
                  <span className="unit-tag">{i.unit || "satuan?"}</span>
                </div>
                <span className="tag">{i.category}</span>
              </div>
              <div className="steps">
                <div className="step">
                  <span className="step-l">
                    <span className="step-n">1</span>Stok semalam
                  </span>
                  <span className="step-v">
                    {l.awal ? (kemarin != null && !Number.isNaN(kemarin) ? formatQty(kemarin) : l.awal) : "–"}
                  </span>
                  <span className="unit">{i.unit}</span>
                </div>
                <label className="step">
                  <span className="step-l">
                    <span className="step-n">2</span>Masuk hari ini
                  </span>
                  <input
                    id={`masuk-${i.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={String(l.masuk ?? "")}
                    className={Number.isNaN(masuk) ? "bad" : undefined}
                    onChange={(e) => edit(i.id, "masuk", e.target.value)}
                    onFocus={() => { typing.current = { itemId: i.id, field: "masuk" }; }}
                    onBlur={() => { typing.current = null; }}
                  />
                  <span className="unit">{i.unit}</span>
                </label>
                <label className="step">
                  <span className="step-l">
                    <span className="step-n">3</span>Sisa akhir shift
                  </span>
                  <input
                    id={`sisa-${i.id}`}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="–"
                    value={String(l.tersedia ?? "")}
                    className={Number.isNaN(sisa) ? "bad" : undefined}
                    onChange={(e) => edit(i.id, "tersedia", e.target.value)}
                    onFocus={() => { typing.current = { itemId: i.id, field: "tersedia" }; }}
                    onBlur={() => { typing.current = null; }}
                  />
                  <span className="unit">{i.unit}</span>
                </label>
              </div>
              {(() => {
                const ok = (x: number | null): x is number => x != null && !Number.isNaN(x);
                const expected = ok(kemarin) && !Number.isNaN(masuk) ? kemarin + (masuk ?? 0) : null;
                if (ok(sisa) && expected != null) {
                  const used = expected - sisa;
                  return used >= -1e-9
                    ? <p className="calc">Terpakai hari ini: <b>{formatQty(used)} {i.unit}</b></p>
                    : <p className="calc warn">Sisa lebih banyak {formatQty(-used)} {i.unit} dari seharusnya. Ada barang masuk yang belum diisi?</p>;
                }
                if (expected != null && masuk) return <p className="calc">Seharusnya ada sekarang: <b>{formatQty(expected)} {i.unit}</b></p>;
                return null;
              })()}
              {unreadable && (
                <p className="warn small">
                  Angka ini belum bisa dibaca{i.pack_size ? "" : " (isi ukuran kemasan di Bahan untuk gram/ml)"}. Coba tulis
                  angka saja, misalnya 2 atau 1,5.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="donebar">
        <span className="muted">{done < items.length ? `${items.length - done} bahan belum dihitung` : "Semua bahan sudah dihitung"}</span>
        <button
          className="btn primary"
          disabled={finishing}
          onClick={async () => {
            // Save the last keystrokes before the purchase list is built from them.
            setFinishing(true);
            clearTimeout(timer.current);
            await flush();
            const form = new FormData();
            form.set("count_date", props.date);
            form.set("session_id", sessionId);
            startTransition(() => finishCount(form));
          }}
        >
          {finishing ? "Menyimpan…" : "Selesai, lihat hasil"}
        </button>
      </div>
    </div>
  );
}
