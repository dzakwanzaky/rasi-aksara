# Rasi Aksara System

Sistem operasional harian kafe Rasi Aksara. Modul pertama: **stok opname**.

Built with Next.js (App Router) and Supabase (Postgres + Auth), hosted on Vercel.

## Stok opname

Follows the weekly opname sheet the cafe already uses:

| Kolom | Arti |
| --- | --- |
| Awal | Stock at the start of the period. Filled automatically from the last count's Tersedia. |
| Masuk | What came in (purchases) since the last count. |
| Tersedia | Physical count today. |
| Keluar | Usage, calculated: Awal + Masuk − Tersedia. |

Quantities are saved exactly as typed (`3, 3/4`, `2,3kg`, `5, 329 gr`) and read by `src/lib/qty.ts`.
Grams on a pack-counted item (e.g. `5, 329 gr`) need the item's pack size, set under **Bahan**.

Pages: `/opname` (start or open a count), `/opname/[id]` (counting sheet, autosaves, CSV download),
`/riwayat` (usage or stock per week), `/bahan` (item list).

## Setup

1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_stock_opname.sql`,
   then `supabase/seed.sql` (the 91 items and the 5 and 12 Oct 2026 counts from the spreadsheet).
2. In Supabase Auth, turn off public sign-ups and add an email + password user for each staff member.
3. Copy `.env.example` to `.env.local` and fill in the two values from Supabase's **Connect** panel (`.env.local` tab).
4. `npm install && npm run dev`, then open http://localhost:3000.
5. Deploy: import the repo in Vercel and paste the same two lines into Environment Variables.

## Checks

```
npm test       # quantity parsing
npm run lint   # type check
npm run build
```
