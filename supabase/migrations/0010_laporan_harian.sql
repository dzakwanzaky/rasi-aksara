-- Laporan harian (Zaky, 15 Okt 2026), from the LAPORAN HARIAN sheet: one report per date per shift.
-- Safe to run again: running it a second time only refreshes the rules and skips reports already there.
-- Plus/minus (tunai aktual − tunai sistem) and hasil (tunai aktual − modal) are worked out in the app.

create table if not exists daily_reports (
  report_date date not null,
  shift text not null check (shift in ('1', '2', '12')),   -- '12' = shift 1 & 2 together
  omset bigint,
  tunai_sistem bigint,
  tf_sistem bigint,
  tunai_aktual bigint,
  pengeluaran bigint,
  pengeluaran_note text,
  modal bigint default 200000,
  catatan text,
  updated_by uuid references auth.users (id),
  updated_by_name text,     -- username of whoever saved last
  updated_at timestamptz not null default now(),
  primary key (report_date, shift)
);

alter table daily_reports enable row level security;
drop policy if exists "staff read reports" on daily_reports;
create policy "staff read reports" on daily_reports for select to authenticated using (true);
-- Today and yesterday can be filled in (shift 2 often finishes after midnight); older reports are history.
drop policy if exists "staff add reports" on daily_reports;
create policy "staff add reports" on daily_reports for insert to authenticated
  with check (report_date >= (now() at time zone 'Asia/Jakarta')::date - 1);
drop policy if exists "staff edit reports" on daily_reports;
create policy "staff edit reports" on daily_reports for update to authenticated
  using (report_date >= (now() at time zone 'Asia/Jakarta')::date - 1)
  with check (report_date >= (now() at time zone 'Asia/Jakarta')::date - 1);

-- The reports already written in the sheet, 5 to 15 Okt 2026. 5 Okt had no shift written, so it is shift 1 & 2.
insert into daily_reports (report_date, shift, omset, tunai_sistem, tf_sistem, tunai_aktual, pengeluaran, modal, updated_by_name) values
  ('2026-10-05', '12', 1673000,  697500,  951000,  698000,  60000, 200000, 'sheet'),
  ('2026-10-06', '1',  4953000, 1862000, 2932000, 2042000,  46000, 200000, 'sheet'),
  ('2026-10-07', '12', 3163000,  996000, 2167000, 1137000, 112500, 200000, 'sheet'),
  ('2026-10-08', '1',  2286000,  458000, 1674000,  618000,  46000, 200000, 'sheet'),
  ('2026-10-09', '1',  2028000,  742000, 1286000,  877000,  40000, 200000, 'sheet'),
  ('2026-10-10', '1',  1714000,  669000, 1045000,  742000, 155000, 200000, 'sheet'),
  ('2026-10-10', '2',  3811500, 1689500, 2122000, 1838000,  50000, 200000, 'sheet'),
  ('2026-10-11', '12', 2395000,  570000, 1658000,  755000,  33000, 200000, 'sheet'),
  ('2026-10-13', '12', 3270000, 1867000, 1403000, 2002000,  85000, 200000, 'sheet'),
  ('2026-10-14', '2',  2610000, 1223000, 1387000, 1388000, 101000, 200000, 'sheet'),
  ('2026-10-15', '1',  1242000,  699000,  543000,  785000,  53000, 200000, 'sheet'),
  ('2026-10-15', '2',  2554000, 1216000, 1338000, 1384000,  40000, 200000, 'sheet')
on conflict (report_date, shift) do nothing;

-- Check: should say 12 (or more, once staff start filling it in).
select count(*) from daily_reports;
