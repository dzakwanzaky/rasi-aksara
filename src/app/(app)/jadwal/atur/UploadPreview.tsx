"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { previewUpload, saveSchedule, type Preview, type PreviewPerson } from "../actions";
import { displayName, jadwalInfo, monthDate, monthLabel, dayShort } from "@/lib/jadwal";

export function UploadPreview({ month }: { month: string }) {
  const [preview, read, reading] = useActionState<Preview | null, FormData>(previewUpload, null);
  const [people, setPeople] = useState<PreviewPerson[]>([]);
  const [saving, startSave] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  useEffect(() => {
    setErr("");
    setPeople(preview && "people" in preview ? preview.people : []);
  }, [preview]);

  const ok = preview && "people" in preview ? preview : null;
  const target = ok?.month ?? null;

  function save() {
    if (!ok || !target) return;
    if (ok.existing > 0 && !confirm(`Jadwal ${monthLabel(target)} yang sudah ada akan diganti dengan isi file ini. Lanjut?`)) return;
    setErr("");
    startSave(async () => {
      try {
        await saveSchedule(target, people.map((p) => ({ name: p.name, username: p.username, shifts: p.shifts })));
        router.push(`/jadwal/atur?m=${target}&ok=1`);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section className="panel">
      <h2>Upload jadwal dari Excel</h2>
      <p className="help">
        Pakai file seperti biasa: kolom <b>NAMA</b>, lalu satu kolom per tanggal berisi <b>PAGI</b>, <b>MALAM</b> atau <b>LIBUR</b>,
        dan tanggal bulan di atas tabel. Belum tersimpan sebelum kamu tekan <b>Simpan</b>.
      </p>
      <form action={read} className="row" style={{ marginTop: 10 }}>
        <input type="hidden" name="month" value={month} />
        <input type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        <button className="btn" disabled={reading}>{reading ? "Membaca…" : "Lihat dulu"}</button>
      </form>

      {preview && "error" in preview && <p className="error">{preview.error}</p>}

      {ok && (
        <div className="jd-preview">
          <p className="eyebrow">Pratinjau</p>
          <h3 className="jd-ptitle">{target ? monthLabel(target) : "Bulan tidak terbaca"} · {people.length} staff · {ok.days} hari</h3>
          {ok.warnings.map((w) => <p key={w} className="notice warn small">{w}</p>)}

          <ul className="jd-match">
            {people.map((p, i) => {
              const flag = !p.username ? <span className="flag bad">belum ada akun</span> : !p.sure ? <span className="flag warn">cek</span> : null;
              return (
                <li key={p.name}>
                  <b>{displayName(p.name)}</b>
                  <select
                    aria-label={`Akun untuk ${p.name}`}
                    value={p.username ?? ""}
                    onChange={(e) => setPeople((all) => all.map((x, j) => (j === i ? { ...x, username: e.target.value || null, sure: true } : x)))}
                  >
                    <option value="">– tidak ada akun –</option>
                    {ok.accounts.map((a) => <option key={a.username} value={a.username}>{a.username}{a.name ? ` (${a.name})` : ""}</option>)}
                  </select>
                  {flag}
                </li>
              );
            })}
          </ul>
          <p className="muted small">Akun dipakai supaya staff melihat jadwalnya sendiri di HP. Nama tanpa akun tetap disimpan dan bisa dihubungkan nanti.</p>

          {target && (
            <div className="tbl jd-grid jd-month">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    {Array.from({ length: ok.days }, (_, i) => {
                      const d = monthDate(target, i + 1);
                      return <th key={d}>{dayShort(d)}<br />{i + 1}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.name}>
                      <td>{displayName(p.name)}</td>
                      {p.shifts.map((s, i) => <td key={i} className={`jd-c ${s ?? ""}`}>{jadwalInfo(s)?.short ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {err && <p className="error">{err}</p>}
          {target ? (
            <button className="btn primary" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
              {saving ? "Menyimpan…" : `Simpan jadwal ${monthLabel(target)}`}
            </button>
          ) : (
            <p className="error">Tulis tanggal bulan di atas tabel (mis. 01/11/2026), atau pilih bulannya di atas lalu upload lagi.</p>
          )}
        </div>
      )}
    </section>
  );
}
