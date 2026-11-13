// Shift checklist, copied from Zaky's "Rasi Aksara Checklist Shift" PDF (14 Okt 2026).
// Each item's key is what the database stores, so change the text freely but keep the keys.

export type CheckItem = {
  key: string;
  time?: string;
  text: string;
  /** A box to fill in next to the tick, e.g. the electricity token left. */
  input?: { label: string; unit?: string; prefix?: string; numeric?: boolean };
  link?: { href: string; label: string };
  /** Effort for the Performa dashboard's fair split: 1 quick (default), 2 a few minutes, 3 heavy cleaning or counting. */
  points?: 1 | 2 | 3;
  /** First day the item is on the checklist; earlier days don't count it (so their scores stay as they were). */
  since?: string;
};

/** Whether an item is on the checklist of `date` (every item when no date is given). */
export const itemOn = (item: CheckItem, date?: string) => !item.since || !date || date >= item.since;

export type Section = {
  title: string;
  hint?: string;
  /** check: tick once. reminder: habits for the whole shift, nothing to tick. hourly: a round at each of HOURS. */
  kind?: "check" | "reminder" | "hourly";
  items: CheckItem[];
};

export type SheetId = "opening" | "operasional" | "handover" | "closing";

export type Sheet = {
  id: SheetId;
  title: string;
  hours: string;
  sections: Section[];
  noteLabel: string;
};

const TOKEN = { label: "Sisa token", unit: "kWh", numeric: true };
const RP = { label: "Jumlah", prefix: "Rp", numeric: true };

/**
 * New SOP (Zaky, 13 Nov 2026): every shift prepares bar and kitchen for the NEXT shift, so it starts ready.
 * Shift 1 does it before handover (Ganti shift sheet, counted for the morning shift), shift 2 at closing for tomorrow.
 */
export const PREP_FROM = "2026-11-14";
const prepBar = (time?: string): CheckItem[] => [
  { key: "prep-espresso", points: 2, time, since: PREP_FROM, text: "Espresso: siapkan 1 carafe" },
  { key: "prep-susu", points: 2, time, since: PREP_FROM, text: "Mix milk: 4 carafe penuh" },
  { key: "prep-sirup", points: 2, time, since: PREP_FROM, text: "Semua sirup: buat kalau sudah kritis" },
  { key: "prep-milktea", time, since: PREP_FROM, text: "Powder milk tea" },
  { key: "prep-maxxtea", time, since: PREP_FROM, text: "Powder Maxxtea" },
  { key: "prep-kettle", time, since: PREP_FROM, text: "Isi air kettle" },
];
const prepKitchen = (time?: string): CheckItem[] => [
  { key: "prep-ayam-bakar", points: 3, time, since: PREP_FROM, text: "Ayam bakar" },
  { key: "prep-platter", points: 2, time, since: PREP_FROM, text: "Platter" },
  { key: "prep-sambal", points: 3, time, since: PREP_FROM, text: "Sambal terasi" },
  { key: "prep-kwetiau", points: 2, time, since: PREP_FROM, text: "Mendadarkan kwetiau" },
  { key: "prep-geprek", points: 2, time, since: PREP_FROM, text: "Marinasi ayam geprek" },
  { key: "prep-ayam-kwetiau", points: 2, time, since: PREP_FROM, text: "Ayam kwetiau" },
];

export const SHEETS: Sheet[] = [
  {
    id: "opening",
    title: "Opening",
    hours: "07.00 – 08.00",
    noteLabel: "Catatan opening",
    sections: [
      {
        title: "Kebersihan & ruangan",
        items: [
          { key: "pintu", time: "07.05", text: "Buka pintu dan ventilasi ruangan" },
          { key: "tanaman", time: "07.05", text: "Siram tanaman" },
          { key: "pel-indoor", points: 3, time: "07.05", text: "Sapu dan pel lantai indoor" },
          { key: "pel-teras", points: 3, time: "07.05", text: "Sapu dan pel teras" },
          { key: "mushola", points: 3, time: "07.05", text: "Mushola: sapu, pel, rapikan sajadah dan sarung di tempatnya" },
          { key: "kamar-mandi", points: 3, time: "07.05", text: "Kamar mandi: bersihkan, pastikan tidak ada kotoran/tanah" },
          { key: "rak-buku", points: 2, time: "07.05", text: "Rak buku & buku: lap debu, pastikan bersih dan rapi" },
          { key: "meja-kursi", points: 2, time: "07.05", text: "Lap semua meja dan kursi" },
          { key: "kaca", points: 3, time: "07.05", text: "Lap kaca (bagian dalam dan luar)" },
          { key: "tissue", time: "07.05", text: "Cek tissue: wastafel, kamar mandi, dan bar" },
          { key: "ac", time: "07.10", text: "Nyalakan semua AC" },
          { key: "lampu", time: "07.10", text: "Cek semua lampu, matikan semua kecuali mushola dan kamar mandi" },
          { key: "musik", time: "07.10", text: "Nyalakan musik", input: { label: "Playlist" } },
        ],
      },
      {
        title: "Setup bar",
        items: [
          { key: "espresso", points: 1, time: "07.10", text: "Nyalakan mesin espresso (warm up 20–30 menit)" },
          { key: "grinder", points: 2, time: "07.10", text: "Nyalakan grinder, cek grind size + test shot" },
          { key: "stok-bar", points: 2, time: "07.10", text: "Cek stok susu, sirup, es batu di kulkas" },
          { key: "pitcher", time: "07.10", text: "Siapkan steam pitcher, tamper, knock box" },
          { key: "filter", time: "07.10", text: "Cek filter paper, kettle, scale" },
          { key: "lap-bar", points: 2, time: "07.10", text: "Lap permukaan bar hingga bersih" },
        ],
      },
      {
        title: "Setup kitchen",
        items: [
          { key: "kompor", time: "07.15", text: "Nyalakan kompor, cek gas" },
          { key: "stok-dapur", points: 2, time: "07.15", text: "Cek stok bahan makanan (ayam, telur, tempe, dll)" },
          { key: "prep", points: 3, time: "07.15", text: "Prep bahan yang perlu disiapkan sebelum buka" },
          { key: "upsell", time: "07.15", text: "Cek stok snack & donat/pudding (upsell items)" },
        ],
      },
      {
        title: "Setup kasir",
        items: [
          { key: "majoo", time: "07.20", text: "Login Majoo, cek koneksi internet" },
          { key: "modal", points: 2, time: "07.20", text: "Hitung modal kasir Rp 200.000, catat di Majoo" },
          { key: "printer", time: "07.20", text: "Cek printer struk: kertas, koneksi tablet" },
          { key: "qris", time: "07.20", text: "Pastikan QRIS aktif dan terbaca" },
          { key: "display-buku", time: "07.20", text: "Rapikan display buku" },
        ],
      },
      {
        title: "Buka",
        items: [
          { key: "token", time: "07.50", text: "Cek token listrik, catat sisa token", input: TOKEN },
        ],
      },
    ],
  },
  {
    id: "operasional",
    title: "Operasional",
    hours: "08.00 – 22.00",
    noteLabel: "Catatan operasional",
    sections: [
      {
        title: "Hourly check",
        hint: "5 ronde: 10.00, 12.00, 14.00, 17.00, 20.00 (jam sepi). Selesaikan dalam jam itu, bergantian bar & kitchen.",
        kind: "hourly",
        items: [
          { key: "lantai-in", points: 2, text: "Lantai indoor bersih" },
          { key: "lantai-out", points: 2, text: "Lantai outdoor bersih" },
          { key: "mushola", text: "Mushola bersih, sajadah/sarung rapi" },
          { key: "tissue", text: "Tissue wastafel, kamar mandi, bar (isi kalau habis)" },
          { key: "parkir", text: "Area parkir, ada yang parkir sembarangan?" },
          { key: "sampah", points: 2, text: "Tempat sampah, kalau penuh kosongkan ke trashbag" },
        ],
      },
      {
        title: "Pelayanan customer",
        hint: "Sepanjang shift, tidak perlu dicentang.",
        kind: "reminder",
        items: [
          { key: "sapa", time: "Setiap tamu", text: "Ucapkan \"Selamat datang di Rasi Aksara\" saat tamu masuk" },
          { key: "pamit", time: "Setiap tamu", text: "Ucapkan \"Terima kasih, hati-hati di jalan\" saat tamu pergi" },
          { key: "meja", time: "Saat pergi", text: "Langsung bersihkan meja setelah tamu pergi" },
          { key: "piring", time: "Saat ada", text: "Ambil piring/gelas kotor langsung, jangan ditumpuk di meja" },
          { key: "tawar", time: "Seharian", text: "Tawarkan upsell: donat, pudding, snack kepada customer" },
        ],
      },
      {
        title: "Pengaturan AC (shift sore)",
        kind: "reminder",
        items: [
          { key: "ac-2pk", time: "19.00", text: "Mulai jam 19.00, cukup nyalakan AC 2PK saja" },
          { key: "kipas", time: "Outdoor", text: "Kipas angin outdoor: nyalakan hanya ketika ada customer di area belakang" },
        ],
      },
    ],
  },
  {
    id: "handover",
    title: "Ganti shift",
    hours: "14.00 – 14.30",
    noteLabel: "Catatan handover / kondisi khusus",
    sections: [
      { title: "Shift 1 siapkan bar untuk shift 2", hint: "Dikerjakan shift 1 sebelum ganti shift, masuk poin shift pagi.", items: prepBar() },
      { title: "Shift 1 siapkan kitchen untuk shift 2", items: prepKitchen() },
      {
        title: "Shift 2 datang",
        items: [
          { key: "tanaman", text: "Shift 2 tiba, siram tanaman" },
          { key: "cek-area", points: 2, text: "Shift 2 cek kebersihan area bar, kitchen, floor, mushola, kamar mandi" },
          { key: "lapor-bersih", text: "Shift 2 laporkan kondisi kebersihan ke Shift 1 (ada masalah? sampaikan)" },
        ],
      },
      {
        title: "Shift 1 menyampaikan",
        items: [
          { key: "stok-kritis", text: "Info stok kritis (bahan apa yang habis/mau habis)" },
          { key: "pembelian", text: "Info pembelian hari ini (sudah beli apa, belum beli apa)" },
          { key: "equipment", text: "Kondisi equipment / masalah mesin" },
          { key: "pending", text: "Info customer atau pesanan pending" },
          { key: "owner", text: "Instruksi dari owner (kalau ada)" },
          { key: "reservasi", text: "Info reservasi atau event sore/malam (kalau ada)" },
        ],
      },
      {
        title: "Bersama",
        items: [
          { key: "token", points: 1, text: "Cek token listrik, catat sisa token, bandingkan dengan catatan opening", input: TOKEN },
          { key: "kas", points: 2, text: "Hitung kas bersama-sama, close kasir Shift 1" },
          { key: "terima", text: "Shift 2 konfirmasi menerima semua info + kondisi area (diterima oleh)" },
          { key: "pulang", text: "Shift 1 boleh pulang setelah konfirmasi selesai (diserahkan oleh)" },
        ],
      },
    ],
  },
  {
    id: "closing",
    title: "Closing",
    hours: "21.30 – 22.30",
    noteLabel: "Catatan closing",
    sections: [
      {
        title: "Persiapan closing",
        items: [
          { key: "close-order", time: "21.30", text: "Close order, stop terima order baru (take away tetap boleh)" },
          { key: "info-tutup", time: "21.30", text: "Informasikan ke customer bahwa café tutup pukul 22.00" },
          { key: "meja-kosong", points: 2, time: "21.30", text: "Mulai bersihkan meja yang sudah kosong" },
        ],
      },
      {
        title: "Siapkan bar untuk shift pagi besok",
        hint: "Lakukan saat sudah slow, tidak harus tunggu closing.",
        items: prepBar("Slow"),
      },
      {
        title: "Siapkan kitchen untuk shift pagi besok",
        items: [
          ...prepKitchen("Slow"),
          { key: "wrap", points: 2, time: "Slow", text: "Kitchen: wrap & label bahan sisa, masukkan kulkas/freezer" },
          { key: "buang", time: "Slow", text: "Buang bahan yang sudah tidak layak pakai" },
        ],
      },
      {
        title: "Bersih-bersih bar",
        items: [
          { key: "backflush", points: 2, time: "21.45", text: "Flush dan backflush mesin espresso" },
          { key: "cuci-bar", points: 3, time: "21.45", text: "Cuci semua pitcher, portafilter, aksesoris bar" },
          { key: "lap-bar", points: 2, time: "21.45", text: "Lap permukaan bar hingga bersih" },
          { key: "susu", time: "21.45", text: "Simpan sisa susu, tutup rapat, masukkan kulkas" },
          { key: "grinder", time: "21.45", text: "Matikan grinder" },
          { key: "knock-box", time: "21.45", text: "Kosongkan knock box" },
        ],
      },
      {
        title: "Bersih-bersih kitchen",
        items: [
          { key: "kompor", time: "21.45", text: "Matikan semua kompor dan peralatan masak" },
          { key: "cuci-dapur", points: 3, time: "21.45", text: "Cuci semua peralatan dapur" },
          { key: "area-dapur", points: 3, time: "21.45", text: "Bersihkan area dapur, kompor, wastafel" },
        ],
      },
      {
        title: "Bersih-bersih floor & area",
        items: [
          { key: "pel-indoor", points: 3, time: "21.50", text: "Sapu dan pel lantai indoor" },
          { key: "pel-teras", points: 3, time: "21.50", text: "Sapu dan pel teras" },
          { key: "meja-kursi", points: 2, time: "21.50", text: "Rapikan semua meja dan kursi" },
          { key: "ac-sound", time: "21.50", text: "Matikan AC dan sound system" },
          { key: "toilet", points: 3, time: "21.50", text: "Cek toilet, bersihkan, isi ulang sabun dan tissue" },
          { key: "sampah", points: 2, time: "21.55", text: "Keluarkan semua sampah ke luar depan (area paving), BUKAN di keramik" },
        ],
      },
      {
        title: "Stock opname",
        items: [
          { key: "hitung", points: 3, time: "22.00", text: "Hitung fisik semua stok bar & kitchen", link: { href: "/hitung", label: "Buka Hitung" } },
          { key: "beli", points: 2, time: "22.00", text: "Tandai bahan yang perlu dibeli besok", link: { href: "/belanja", label: "Buka Belanja" } },
          { key: "lapor-wa", time: "22.00", text: "Laporkan ke grup WA kalau ada yang kritis" },
        ],
      },
      {
        title: "Rekap kasir",
        items: [
          { key: "tutup-majoo", points: 2, time: "22.10", text: "Tutup shift di Majoo, catat total transaksi", input: { ...RP, label: "Total transaksi" } },
          { key: "cash", points: 2, time: "22.10", text: "Hitung cash di laci kasir", input: { ...RP, label: "Cash fisik" } },
          { key: "modal", time: "22.10", text: "Pisahkan modal Rp 200.000 untuk besok" },
          { key: "selisih-kas", points: 2, time: "22.10", text: "Catat selisih kas (kalau ada) + keterangan" },
          { key: "cash-box", time: "22.10", text: "Simpan uang di cash box" },
        ],
      },
      {
        title: "Final check",
        items: [
          { key: "gform", points: 2, time: "22.15", text: "Isi laporan shift di sistem (tab Laporan), simpan", link: { href: "/laporan", label: "Buka Laporan" } },
          { key: "lampu", time: "22.15", text: "Matikan semua lampu kecuali lampu teras" },
          { key: "kunci", time: "22.15", text: "Cek semua pintu dan jendela terkunci" },
          { key: "token", time: "22.15", text: "Cek token listrik, catat sisa token", input: TOKEN },
        ],
      },
    ],
  },
];

/** Until 13 Nov 2026 there was a round every hour, 09–21. */
export const HOURLY_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
/** From this day there are only 5 rounds, at the quietest hours in Majoo's sales (Zaky, 13 Nov 2026). */
export const ROUNDS_FROM = "2026-11-14";
/** The current rounds. Each is done within its hour, e.g. 12.00–13.00. */
export const HOURS = [10, 12, 14, 17, 20];
/** The rounds of a given day (older days keep their hourly rounds, so history stays as it was). */
export const hoursFor = (date?: string) => (date && date < ROUNDS_FROM ? HOURLY_HOURS : HOURS);

export const itemKey = (sheet: SheetId, item: string) => `${sheet}:${item}`;
export const hourlyKey = (hour: number, item: string) => `operasional:jam${String(hour).padStart(2, "0")}:${item}`;
export const noteKey = (sheet: SheetId) => `${sheet}:catatan`;
export const itemNoteKey = (key: string) => `${key}:catatan`;

export type Entry = {
  done: boolean;
  done_by: string | null;
  done_at: string | null;
  value: string | null;
};

/** The keys a sheet's progress counts: every tickable item, and every round (of `date`) up to `hourNow`. */
export function tickKeys(sheet: Sheet, hourNow = 24, date?: string): string[] {
  return sheet.sections.flatMap((s) => {
    if (s.kind === "reminder") return [];
    if (s.kind === "hourly") return hoursFor(date).filter((h) => h <= hourNow).flatMap((h) => s.items.map((i) => hourlyKey(h, i.key)));
    return s.items.filter((i) => itemOn(i, date)).map((i) => itemKey(sheet.id, i.key));
  });
}

/** Which checklist fits the time of day in Jakarta (hour and minute). */
export function sheetForTime(hour: number, minute: number): SheetId {
  const t = hour * 60 + minute;
  if (t < 8 * 60) return "opening";
  if (t >= 14 * 60 && t < 14 * 60 + 45) return "handover";
  if (t >= 21 * 60 + 30) return "closing";
  return "operasional";
}

/** Reads "Rp 1.250.000", "1250000" or "1,5" as a number; null when empty or unreadable. */
export function readAmount(v: string | null | undefined): number | null {
  const s = String(v ?? "").replace(/rp/i, "").replace(/\s/g, "");
  if (!s) return null;
  // Indonesian style: a comma marks decimals and dots group thousands ("1.250.000"),
  // but "45.2" (token kWh) is a decimal point.
  let t = s;
  if (s.includes(",")) t = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) t = s.replace(/\./g, "");
  const n = Number(t);
  return t !== "" && Number.isFinite(n) ? n : null;
}

export const rupiah = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
