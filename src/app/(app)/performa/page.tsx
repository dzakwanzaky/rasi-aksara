import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { todayJakarta } from "@/lib/data";
import { dateLabel } from "@/lib/types";
import { COUNT_FROM, LATE_AFTER_MIN, PERIODS, hhmm, pct, periodRange, summarize, type Period, type Row, type StaffStat } from "@/lib/performa";
import { PhotoGrid, type ShownPhoto } from "./PhotoGrid";

export const dynamic = "force-dynamic";

type Params = { p?: string; d?: string; staf?: string; tgl?: string };

const short = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const hour2 = (h: number) => `${String(h).padStart(2, "0")}.00`;

function periodLabel(period: Period, from: string, to: string) {
  if (period === "hari") return dateLabel(from);
  if (period === "bulan") return new Date(from + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return `${short(from)} – ${short(to)} ${to.slice(0, 4)}`;
}

function hourNowJakarta() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}

export default async function Performa({ searchParams }: { searchParams: Promise<Params> }) {
  const q = await searchParams;
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) {
    return (
      <section className="panel">
        <h2>Performa</h2>
        <p className="muted">Halaman ini hanya untuk pemilik/admin.</p>
      </section>
    );
  }

  const today = todayJakarta();
  const period: Period = PERIODS.some((x) => x.id === q.p) ? (q.p as Period) : "minggu";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(q.d ?? "") && q.d! <= today ? q.d! : today;
  const range = periodRange(period, anchor);
  const from = range.from < COUNT_FROM ? COUNT_FROM : range.from;
  const href = (o: Params) => {
    const s = new URLSearchParams();
    const v = { p: period, d: anchor, staf: q.staf, tgl: q.tgl, ...o };
    for (const [k, val] of Object.entries(v)) if (val) s.set(k, val);
    return `/performa?${s}`;
  };

  if (range.to < COUNT_FROM) {
    return (
      <>
        <p className="eyebrow">Performa checklist staff</p>
        <p className="empty">Penilaian dimulai {dateLabel(COUNT_FROM)}. Data sebelum itu tidak dihitung.</p>
      </>
    );
  }

  // Every tick in the period. Supabase hands back at most 1000 rows per request, so page through.
  const rows: Row[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supabase.from("checklist_entries")
      .select("check_date, key, done, done_by, done_at")
      .gte("check_date", from).lte("check_date", range.to).eq("done", true)
      .order("check_date").order("key").range(page * 1000, page * 1000 + 999);
    if (error) return <p className="empty">Data checklist belum bisa dibaca: {error.message}</p>;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const sum = summarize(rows, { from, to: range.to, today, hourNow: anchor <= today ? hourNowJakarta() : 0 });
  const person = q.staf ? sum.staff.find((s) => s.name === q.staf) : undefined;

  return (
    <>
      <p className="eyebrow">Performa checklist staff</p>
      <div className="filters">
        {PERIODS.map((x) => (
          <Link key={x.id} className="chip" aria-pressed={x.id === period} href={href({ p: x.id, tgl: undefined })}>{x.label}</Link>
        ))}
      </div>
      <div className="daynav">
        {range.from > COUNT_FROM
          ? <Link className="btn small" href={href({ d: range.prev, tgl: undefined })} aria-label="Sebelumnya">‹</Link>
          : <span />}
        <h2 className="big">{periodLabel(period, range.from, range.to)}</h2>
        {range.next <= today
          ? <Link className="btn small" href={href({ d: range.next, tgl: undefined })} aria-label="Berikutnya">›</Link>
          : <span />}
      </div>

      {from > range.from && <p className="muted small">Dihitung mulai {dateLabel(COUNT_FROM)}.</p>}
      {q.staf
        ? <StaffDetail stat={person} name={q.staf} day={q.tgl} href={href} />
        : <Overview sum={sum} href={href} />}
    </>
  );
}

function Overview({ sum, href }: { sum: ReturnType<typeof summarize>; href: (o: Params) => string }) {
  if (!sum.activeDays.length) return <p className="empty">Belum ada centangan checklist di periode ini.</p>;
  const missedPct = pct(sum.missed.length, sum.roundsJudged);
  return (
    <>
      <div className="tiles">
        <Tile n={sum.ticks} label="item dicentang" />
        <Tile n={`${pct(sum.ticks - sum.late, sum.ticks)}%`} label={`tepat waktu (${sum.late} terlambat)`} warn={sum.late > 0} />
        <Tile n={sum.roundsFull} of={sum.roundsJudged} label="ronde hourly lengkap" />
        <Tile n={sum.missed.length} label={`ronde terlewat (${missedPct}%)`} warn={sum.missed.length > 0} />
      </div>
      {sum.skipped > 0 && (
        <p className="muted small">{sum.skipped} item opening/ganti shift/closing tidak dicentang siapa pun di hari yang sudah lewat.</p>
      )}

      <h3 className="perf-h">Per staff</h3>
      <ul className="perf-list">
        {sum.staff.map((s) => (
          <li key={s.name}>
            <Link className="perf-card" href={href({ staf: s.name, tgl: undefined })}>
              <div className="card-head">
                <b className="perf-name">{s.name}</b>
                <span className="muted small">{s.days.length} hari aktif</span>
              </div>
              <StaffNumbers s={s} />
              <span className="linkbtn">Lihat detail &amp; foto →</span>
            </Link>
          </li>
        ))}
      </ul>

      {(sum.missed.length > 0 || sum.partial.length > 0) && (
        <>
          <h3 className="perf-h">Ronde hourly bermasalah</h3>
          <ul className="perf-rounds">
            {[...sum.activeDays].reverse().map((d) => {
              const bad = [...sum.missed, ...sum.partial].filter((r) => r.date === d).sort((a, b) => a.hour - b.hour);
              if (!bad.length) return null;
              const duty = [...new Set(bad.flatMap((r) => r.onDuty))];
              return (
                <li key={d}>
                  <Link href={`/checklist?date=${d}&lembar=operasional`}>{short(d)}</Link>
                  <span className="perf-round-pills">
                    {bad.map((r) => (
                      <span key={r.hour} className={`pill ${r.done === 0 ? "bad" : "warn"}`} title={r.onDuty.join(", ")}>
                        {hour2(r.hour)}{r.done > 0 && ` · ${r.done}/${r.total}`}
                      </span>
                    ))}
                  </span>
                  <span className="muted small">{duty.length ? `Bertugas: ${duty.join(", ")}` : "Belum ada yang bertugas"}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted small"><span className="pill bad">merah</span> terlewat, <span className="pill warn">kuning</span> kurang lengkap.</p>
        </>
      )}

      <details className="perf-how">
        <summary>Cara menghitung</summary>
        <ul>
          <li><b>Poin</b>: tiap item punya bobot kerja. 1 = cepat (nyalakan musik), 2 = beberapa menit (lap meja, hitung kas), 3 = berat (pel lantai, bersihkan kamar mandi, cuci peralatan, stock opname).</li>
          <li><b>Porsi shift</b>: checklist dipakai bersama satu shift, jadi dibandingkan berapa persen poin shift itu yang dikerjakan orang ini dengan bagi rata (2 orang = 50%). Kuning kalau di bawah 60% dari bagi rata. Shift dibagi jam 14.00; item ganti shift tidak dihitung. Staff yang tidak mencentang apa pun tidak muncul sama sekali.</li>
          <li><b>Terlambat</b>: dicentang lebih dari {LATE_AFTER_MIN} menit setelah jam di checklist. Hourly: setelah jamnya lewat (ronde 10.00 paling lambat 11.00). Item tanpa jam: setelah shift-nya selesai.</li>
          <li><b>Terlewat</b>: ronde hourly yang tidak dicentang sama sekali setelah jamnya lewat. <b>Kurang</b>: hanya sebagian yang dicentang.</li>
          <li>Ronde terlewat dihitung ke staff yang <b>bertugas</b>. Jam tugas ditebak dari centangan: centang pertama sebelum 12.00 berarti shift pagi (ronde 09–14), ada centang dari 15.00 berarti shift sore (ronde 14–21).</li>
          <li>Hari tanpa centangan sama sekali dianggap tutup dan tidak dihitung.</li>
        </ul>
      </details>
    </>
  );
}

function StaffNumbers({ s }: { s: StaffStat }) {
  return (
    <div className="perf-nums">
      <span><b>{s.ticks}</b> dicentang · {s.points} poin</span>
      <span><b>{pct(s.ticks - s.late, s.ticks)}%</b> tepat waktu</span>
      <span className={s.late ? "warn" : ""}><b>{s.late}</b> terlambat</span>
      <span><b>{s.rounds}</b> ronde hourly</span>
      <span className={s.missed ? "bad" : ""}><b>{s.missed}</b> terlewat</span>
      <span className={s.partial ? "warn" : ""}><b>{s.partial}</b> kurang</span>
      <Share s={s} />
    </div>
  );
}

/** How much of the shared checklist this person did compared with an even split among the people on their shift. */
function Share({ s }: { s: StaffStat }) {
  const { own, total, fair, peers } = s.share;
  if (!peers.length || !total) return null;
  const low = own < fair * 0.6;
  return (
    <span className={`perf-share${low ? " warn" : ""}`}>
      <b>{pct(own, total)}%</b> poin shift dikerjakan dia · bagi rata {pct(fair, total)}% (bareng {peers.join(", ")})
      {low && ". Lebih banyak dikerjakan rekannya."}
    </span>
  );
}

function Tile({ n, of, label, warn }: { n: number | string; of?: number; label: string; warn?: boolean }) {
  return (
    <div className={`tile${warn ? " warn" : ""}`}>
      <span className="tile-n">{n}{of != null && <small>/{of}</small>}</span>
      <span className="tile-l">{label}</span>
    </div>
  );
}

async function StaffDetail({ stat, name, day, href }: { stat?: StaffStat; name: string; day?: string; href: (o: Params) => string }) {
  const back = <Link className="back" href={href({ staf: undefined, tgl: undefined })}>‹ Semua staff</Link>;
  if (!stat) return <>{back}<p className="empty">{name} tidak mencentang apa pun di periode ini.</p></>;
  const days = stat.days;
  const shown = day && days.includes(day) ? day : days.length === 1 ? days[0] : undefined;

  // Photos are only loaded for one day at a time, so a month view stays light on the phone.
  const photos = new Map<string, ShownPhoto[]>();
  if (shown) {
    const supabase = await createClient();
    const { data } = await supabase.from("checklist_photos").select("id, key, path, taken_by, taken_at").eq("check_date", shown).order("taken_at");
    const list = data ?? [];
    const signed = list.length
      ? (await supabase.storage.from("checklist-photos").createSignedUrls(list.map((p) => p.path as string), 60 * 60)).data ?? []
      : [];
    const url = new Map(signed.map((u) => [u.path, u.signedUrl]));
    for (const p of list) {
      (photos.get(p.key as string) ?? photos.set(p.key as string, []).get(p.key as string)!)
        .push({ id: p.id as string, url: url.get(p.path as string) ?? null, by: (p.taken_by as string) ?? "?", at: p.taken_at as string });
    }
  }

  return (
    <>
      {back}
      <section className="panel">
        <h2 className="perf-name">{name}</h2>
        <StaffNumbers s={stat} />
      </section>

      <h3 className="perf-h">Per hari</h3>
      <ul className="perf-days">
        {[...days].reverse().map((d) => {
          const ticks = stat.list.filter((t) => t.date === d);
          const late = ticks.filter((t) => t.late).length;
          return (
            <li key={d}>
              <Link className="daycard" aria-current={d === shown ? "true" : undefined} href={href({ tgl: d })}>
                <span><b>{dateLabel(d)}</b><br /><span className="muted small">{hhmm(ticks[0].at)} – {hhmm(ticks[ticks.length - 1].at)}</span></span>
                <span className="row">
                  <span className="pill">{ticks.length} ✓</span>
                  {late > 0 && <span className="pill warn">{late} telat</span>}
                  <span className="chev">›</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {shown && (
        <section className="panel">
          <h3 className="perf-day-h">{dateLabel(shown)}</h3>
          <p className="muted small"><Link href={`/checklist?date=${shown}`}>Buka checklist hari ini →</Link></p>
          <ul className="perf-ticks">
            {stat.list.filter((t) => t.date === shown).map((t) => (
              <li key={t.key}>
                <div className="perf-tick">
                  <span className="ck-time">{hhmm(t.at)}</span>
                  <span className="perf-tick-l">{t.label}</span>
                  {t.late
                    ? <span className="pill warn">Telat · batas {hhmm(t.due)}</span>
                    : <span className="pill">Tepat</span>}
                </div>
                <PhotoGrid photos={photos.get(t.key) ?? []} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
