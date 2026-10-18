"use client";

import { useState } from "react";

export type ShownPhoto = { id: string; url: string | null; by: string; at: string };

const clock = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

/** Thumbnails of an item's photo proof; tap one to see it full screen. */
export function PhotoGrid({ photos }: { photos: ShownPhoto[] }) {
  const [viewing, setViewing] = useState<ShownPhoto | null>(null);
  if (!photos.length) return <p className="muted small perf-nophoto">Tanpa foto</p>;
  return (
    <>
      <div className="ck-photos perf-photos">
        {photos.map((p) => (
          <button key={p.id} type="button" className="ck-thumb" disabled={!p.url} onClick={() => setViewing(p)}>
            {p.url ? <img src={p.url} alt={`Foto oleh ${p.by}`} loading="lazy" /> : <span>Foto</span>}
            <small>{p.by} · {clock(p.at)}</small>
          </button>
        ))}
      </div>
      {viewing && (
        <div className="ck-viewer" role="dialog" aria-label="Foto" onClick={() => setViewing(null)}>
          {viewing.url && <img src={viewing.url} alt="Foto bukti" />}
          <p>📷 {viewing.by} · {clock(viewing.at)} <span className="muted">(ketuk untuk tutup)</span></p>
        </div>
      )}
    </>
  );
}
