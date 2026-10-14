-- Shift checklist (Zaky, 14 Okt 2026): opening, operasional + hourly check, ganti shift, closing.
-- Safe to run again: running it a second time only refreshes the rules below.
-- The checklist itself lives in the app (src/lib/checklist.ts). This table keeps what staff ticked
-- and typed, one row per date per item, e.g. key 'opening:pintu' or 'operasional:jam10:parkir'.

create table if not exists checklist_entries (
  check_date date not null,
  key text not null,
  done boolean not null default false,
  done_by text,            -- username of whoever ticked it (the "paraf")
  done_at timestamptz,
  value text,              -- what was typed: token left, playlist, rupiah, a note
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (check_date, key)
);

alter table checklist_entries enable row level security;
drop policy if exists "staff read checklist" on checklist_entries;
create policy "staff read checklist" on checklist_entries for select to authenticated using (true);
-- Only today's checklist can be filled in; earlier days are history and stay as they were (Zaky, 14 Okt 2026).
drop policy if exists "staff add checklist" on checklist_entries;
create policy "staff add checklist" on checklist_entries for insert to authenticated
  with check (check_date >= (now() at time zone 'Asia/Jakarta')::date);
drop policy if exists "staff edit checklist" on checklist_entries;
create policy "staff edit checklist" on checklist_entries for update to authenticated
  using (check_date >= (now() at time zone 'Asia/Jakarta')::date)
  with check (check_date >= (now() at time zone 'Asia/Jakarta')::date);

-- Phones see each other's ticks live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'checklist_entries') then
    alter publication supabase_realtime add table checklist_entries;
  end if;
end $$;

-- Check: should say 0 (the table is there and empty).
select count(*) from checklist_entries;
