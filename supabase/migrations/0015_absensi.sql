-- Absensi / clock in-out staff (Zaky, 25 Okt 2026). Run after 0009_items_admin_only.sql (needs is_admin()).
-- Staff clock in and out from their own login, only from inside the Rasi Aksara area (browser GPS).
-- The database itself checks the distance and sets the times, so a phone cannot send a fake clock.
-- Safe to run again. After running it again, also run 0016_absen_selfie.sql again (it adds the selfie rule).

-- Where the cafe is, and how far from it clock in/out is allowed. One row, set by an admin in the app (Absen > Rekap).
create table if not exists attendance_settings (
  id int primary key default 1 check (id = 1),
  lat double precision not null,
  lng double precision not null,
  radius_m int not null default 100 check (radius_m between 20 and 2000),
  updated_by_name text,
  updated_at timestamptz not null default now()
);

alter table attendance_settings enable row level security;
drop policy if exists "staff read attendance settings" on attendance_settings;
create policy "staff read attendance settings" on attendance_settings for select to authenticated using (true);
drop policy if exists "admins write attendance settings" on attendance_settings;
create policy "admins write attendance settings" on attendance_settings for all to authenticated
  using (is_admin()) with check (is_admin());

-- One row per clock in. Clocking out fills the out_ columns of the same row.
create table if not exists attendance (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  username text not null,
  work_date date not null,          -- Jakarta date of the clock in
  shift text not null check (shift in ('pagi', 'malam')), -- 'malam' is shown as Shift siang (14.30-22.30)
  clock_in timestamptz not null,
  in_lat double precision, in_lng double precision, in_accuracy_m real, in_dist_m real,
  clock_out timestamptz,
  out_lat double precision, out_lng double precision, out_accuracy_m real, out_dist_m real,
  koreksi text,                     -- set when an admin filled in or changed a time by hand
  created_at timestamptz not null default now()
);

create index if not exists attendance_work_date on attendance (work_date);
-- Nobody can be clocked in twice on the same day at the same time.
create unique index if not exists attendance_one_open on attendance (user_id, work_date) where clock_out is null;

create or replace function distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function attendance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s attendance_settings;
begin
  select * into s from attendance_settings where id = 1;

  if tg_op = 'INSERT' then
    if s is null then raise exception 'Lokasi Rasi Aksara belum diatur. Minta admin mengaturnya di Absen > Rekap.'; end if;
    if new.in_lat is null or new.in_lng is null then raise exception 'Lokasi HP tidak terbaca.'; end if;
    new.user_id := auth.uid();
    new.username := (select case when email like '%@rasiaksara.local' then split_part(email, '@', 1) else email end
                     from auth.users where id = auth.uid());
    new.clock_in := now();
    new.work_date := (now() at time zone 'Asia/Jakarta')::date;
    new.clock_out := null; new.out_lat := null; new.out_lng := null; new.out_accuracy_m := null; new.out_dist_m := null;
    new.koreksi := null;
    new.in_dist_m := distance_m(s.lat, s.lng, new.in_lat, new.in_lng);
    if new.in_dist_m > s.radius_m then
      raise exception 'Di luar area Rasi Aksara: % m dari kafe (batas % m).', round(new.in_dist_m), s.radius_m;
    end if;
    return new;
  end if;

  -- A normal clock out: only the out_ location is sent, the database sets the time.
  if old.clock_out is null and old.out_lat is null and new.out_lat is not null and new.koreksi is not distinct from old.koreksi then
    if s is null then raise exception 'Lokasi Rasi Aksara belum diatur.'; end if;
    new.out_dist_m := distance_m(s.lat, s.lng, new.out_lat, new.out_lng);
    if new.out_dist_m > s.radius_m then
      raise exception 'Di luar area Rasi Aksara: % m dari kafe (batas % m).', round(new.out_dist_m), s.radius_m;
    end if;
    new.clock_out := now();
    new.id := old.id; new.user_id := old.user_id; new.username := old.username; new.work_date := old.work_date;
    new.shift := old.shift; new.clock_in := old.clock_in; new.in_lat := old.in_lat; new.in_lng := old.in_lng;
    new.in_accuracy_m := old.in_accuracy_m; new.in_dist_m := old.in_dist_m; new.created_at := old.created_at;
    return new;
  end if;

  -- Anything else is a correction (e.g. a forgotten clock out), which only admins may make.
  if not is_admin() then raise exception 'Absensi yang sudah tercatat tidak bisa diubah. Hubungi admin.'; end if;
  return new;
end $$;

drop trigger if exists attendance_guard on attendance;
create trigger attendance_guard before insert or update on attendance for each row execute function attendance_guard();

alter table attendance enable row level security;
drop policy if exists "staff read attendance" on attendance;
create policy "staff read attendance" on attendance for select to authenticated using (true);
drop policy if exists "staff clock in" on attendance;
create policy "staff clock in" on attendance for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "staff clock out" on attendance;
create policy "staff clock out" on attendance for update to authenticated
  using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());
drop policy if exists "admins delete attendance" on attendance;
create policy "admins delete attendance" on attendance for delete to authenticated using (is_admin());

-- Check: should say 0 (the table is there and empty).
select count(*) from attendance;
