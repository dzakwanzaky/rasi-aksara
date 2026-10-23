-- Omzet harian (Zaky, 23 Okt 2026). Run after 0012_penjualan_resep.sql.
-- Keeps every transaction of the Majoo "Detail Penjualan" upload, with its payment method, so the Omzet tab can show
-- turnover per day, per payment method (tunai / QRIS) and per shift. Safe to run again.

alter table sales_days add column if not exists tunai bigint;   -- null: uploaded before this migration, upload again
alter table sales_days add column if not exists qris bigint;
alter table sales_days add column if not exists lain bigint;    -- other or split payment methods

create table if not exists sales_trx (
  sale_date date not null references sales_days (sale_date) on delete cascade,
  trx_no text not null,                  -- Majoo "No Transaksi", e.g. CS/01/261019/0001
  shift text not null default '',        -- '1', '2', or '' when Majoo has no shift
  method text not null default '',       -- Majoo "Metode Pembayaran" as written, e.g. 'Cash', 'Bank Transfer - Qris'
  order_type text not null default '',   -- Majoo "Jenis Order", e.g. 'Free Table', 'Bungkus'
  products text[] not null default '{}', -- menus in the transaction, without quantities (Majoo does not export them)
  total bigint not null default 0,       -- Majoo "Total Penjualan (Rp)"
  primary key (sale_date, trx_no)
);

alter table sales_trx enable row level security;
drop policy if exists "admins sales trx" on sales_trx;
create policy "admins sales trx" on sales_trx for all to authenticated using (is_admin()) with check (is_admin());
