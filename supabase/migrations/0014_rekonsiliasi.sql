-- Rekonsiliasi harian (Zaky, 23 Okt 2026). Run after 0013_omzet.sql. Updated 26 Okt: run again for the admin rules at the end.
-- Omzet per payment method in Majoo against the money that came in: tunai from the drawer counts in Laporan
-- (daily_reports), QRIS from the amount the owner types per sale date. Safe to run again.

create table if not exists qris_masuk (
  sale_date date primary key,            -- the sale date the money belongs to, not the date it reached the bank
  amount bigint not null,                -- what reached the bank account, after the provider's fee
  catatan text,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

-- One row of owner settings. Blank until the owner fills them in; the app does not assume a fee or a delay.
create table if not exists bookkeeping_settings (
  id int primary key default 1 check (id = 1),
  qris_fee_pct numeric,                  -- e.g. 0.7 for 0,7%
  qris_lag_days int,                     -- days between sale and money in the bank
  batas_selisih bigint,                  -- a day with a bigger difference (either way) is marked
  updated_at timestamptz not null default now()
);
insert into bookkeeping_settings (id) values (1) on conflict (id) do nothing;

alter table qris_masuk enable row level security;
alter table bookkeeping_settings enable row level security;
drop policy if exists "admins qris masuk" on qris_masuk;
create policy "admins qris masuk" on qris_masuk for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admins bookkeeping settings" on bookkeeping_settings;
create policy "admins bookkeeping settings" on bookkeeping_settings for all to authenticated using (is_admin()) with check (is_admin());

-- The owner types drawer counts on the Rekonsiliasi page for any date (added 26 Okt 2026).
-- Staff can still only fill in today and yesterday in Laporan.
drop policy if exists "admins add reports" on daily_reports;
create policy "admins add reports" on daily_reports for insert to authenticated with check (is_admin());
drop policy if exists "admins edit reports" on daily_reports;
create policy "admins edit reports" on daily_reports for update to authenticated using (is_admin()) with check (is_admin());
