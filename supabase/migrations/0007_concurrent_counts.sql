-- Several staff on their phones at once (Zaky, 13 Okt 2026).

-- 1. One count per date. Two people tapping "Mulai hitung stok" together used to make two counts.
--    Remove extra counts for the same date that have no numbers in them, keeping the one with data.
delete from opname_sessions s
where exists (
    select 1 from opname_sessions o
    where o.count_date = s.count_date and o.id <> s.id
      and (exists (select 1 from opname_lines l where l.session_id = o.id and coalesce(l.tersedia, l.masuk, '') <> '')
           or (o.created_at, o.id) < (s.created_at, s.id))
  )
  and not exists (select 1 from opname_lines l where l.session_id = s.id and coalesce(l.tersedia, l.masuk, '') <> '');
-- If two counts for one date both hold numbers, this stops with "could not create unique index":
-- tell Claude which date and it will merge them.
create unique index opname_sessions_one_per_date on opname_sessions (count_date);

-- 2. Let phones see each other's numbers live while counting.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'opname_lines') then
    alter publication supabase_realtime add table opname_lines;
  end if;
end $$;
