# Rasi Aksara System

Sistem operasional harian kafe Rasi Aksara. Modul pertama: **stok opname**.

Built with Next.js (App Router) and Supabase (Postgres + Auth), hosted on Vercel. Every push to `main` deploys.
The UI is always light, even on phones set to dark mode, so staff can read it easily.

## Stok opname

Staff count what is left of every item at the end of each shift.

| Page | For | What it shows |
| --- | --- | --- |
| `/hitung` | Staff | One card per item: yesterday's amount and a single "sisa sekarang" box, plus optional "barang masuk". Autosaves. |
| `/belanja` | Buyer | Items that ran out or are below their minimum stock, with a "copy for WhatsApp" button. |
| `/pemakaian` | Owner | How much of each item was used that day (yesterday + barang masuk − sisa), with anything odd explained in words. CSV download. |
| `/bahan` | Owner | Item list, units, pack sizes and minimum stock. |

Quantities are saved exactly as typed (`3, 3/4`, `2,3kg`, `5, 329 gr`) and read by `src/lib/qty.ts`.
Grams on a pack-counted item (e.g. `5, 329 gr`) need the item's pack size, set under **Bahan**.

## Setup

   then `supabase/seed.sql` (the 91 items and the 5 and 12 Oct 2026 counts from the spreadsheet),
   then the remaining migrations in order (`0002_units_gr_ml.sql`, `0003_packaging_split.sql`, `0004_audit_log.sql`: change log shown on the Log tab, `0005_kitchen_units.sql`, `0006_maxxtea_tarik.sql`, `0007_concurrent_counts.sql`: one count per date + live updates, `0008_staff_admins.sql`: who may open the Staff page).

**Staff accounts.** Staff log in with a username, not an email. Admins add them on the Staff page (button in the header), which needs `SUPABASE_SECRET_KEY` (Supabase secret / service_role key) set in Vercel as a server-only environment variable. Usernames map to `<username>@rasiaksara.local` in Supabase Auth; accounts are created confirmed, so no invite email is sent.
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

## Restock alerts (optional)

When staff tap **Selesai** after a count, the app can send the purchase list to a chat.
Set one pair of environment variables in Vercel, then redeploy:

- WhatsApp via [Fonnte](https://fonnte.com): `FONNTE_TOKEN` (device token) and `ALERT_WA_TARGET` (phone number or group id)
- Telegram: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

With neither set, nothing is sent.
