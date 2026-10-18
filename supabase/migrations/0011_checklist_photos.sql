-- Photo proof on checklist items (Zaky, 18 Okt 2026): every tick needs a photo taken live with the
-- camera in the app. The app shrinks it (~100 KB) and keeps it in a private Supabase Storage bucket.
-- Safe to run again: running it a second time only refreshes the rules below.
-- Like the ticks, photos can only be added for today, and nobody can delete them from the app.

-- 1. Where the photo files live. Private: only signed-in staff can see them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checklist-photos', 'checklist-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files are stored as <date>/<random>.jpg; the date folder must be today (WIB).
drop policy if exists "staff view checklist photos" on storage.objects;
create policy "staff view checklist photos" on storage.objects for select to authenticated
  using (bucket_id = 'checklist-photos');
drop policy if exists "staff add checklist photos" on storage.objects;
create policy "staff add checklist photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'checklist-photos'
    and (storage.foldername(name))[1] = to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')
  );

-- 2. Which photo belongs to which checklist item, and who took it when.
create table if not exists checklist_photos (
  id uuid primary key default gen_random_uuid(),
  check_date date not null,
  key text not null,          -- same item key as checklist_entries, e.g. 'opening:pintu'
  path text not null,         -- file in the checklist-photos bucket
  taken_by text,              -- username
  taken_by_id uuid references auth.users (id) default auth.uid(),
  taken_at timestamptz not null default now()
);
create index if not exists checklist_photos_date_idx on checklist_photos (check_date, key, taken_at);

alter table checklist_photos enable row level security;
drop policy if exists "staff read checklist photos" on checklist_photos;
create policy "staff read checklist photos" on checklist_photos for select to authenticated using (true);
drop policy if exists "staff add checklist photo" on checklist_photos;
create policy "staff add checklist photo" on checklist_photos for insert to authenticated
  with check (check_date >= (now() at time zone 'Asia/Jakarta')::date);

-- 3. A tick needs a photo: an item can only be marked done once a photo for it is saved.
--    (Unticking and typing notes or numbers need no photo.) Replaces the rules from 0009.
drop policy if exists "staff add checklist" on checklist_entries;
create policy "staff add checklist" on checklist_entries for insert to authenticated
  with check (
    check_date >= (now() at time zone 'Asia/Jakarta')::date
    and (not done or exists (select 1 from checklist_photos p where p.check_date = checklist_entries.check_date and p.key = checklist_entries.key))
  );
drop policy if exists "staff edit checklist" on checklist_entries;
create policy "staff edit checklist" on checklist_entries for update to authenticated
  using (check_date >= (now() at time zone 'Asia/Jakarta')::date)
  with check (
    check_date >= (now() at time zone 'Asia/Jakarta')::date
    and (not done or exists (select 1 from checklist_photos p where p.check_date = checklist_entries.check_date and p.key = checklist_entries.key))
  );

-- Phones see each other's photos live.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'checklist_photos') then
    alter publication supabase_realtime add table checklist_photos;
  end if;
end $$;

-- Check: should show one row, checklist-photos.
select id, public from storage.buckets where id = 'checklist-photos';
