-- Selfie saat absen (Zaky, 27 Okt 2026). Run after 0015_absensi.sql, and again after any rerun of 0015
-- (0015 would put back the clock in/out rule without the photo). Safe to run again.
-- Clock in and clock out each need a selfie taken live with the app's camera. The time on the record is the
-- server's clock, not the phone's. Photos are private: only admins can open them (Absen > Rekap absensi).

-- 1. Where the selfies live: <date>/<random>.jpg, and the date folder must be today (WIB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('absen-photos', 'absen-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "admins view absen photos" on storage.objects;
create policy "admins view absen photos" on storage.objects for select to authenticated
  using (bucket_id = 'absen-photos' and is_admin());
drop policy if exists "staff add absen photos" on storage.objects;
create policy "staff add absen photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'absen-photos'
    and (storage.foldername(name))[1] = to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')
  );

-- 2. Which selfie belongs to which clock in / clock out.
alter table attendance add column if not exists in_photo text;
alter table attendance add column if not exists out_photo text;

-- A selfie counts when it was uploaded today into the absen-photos bucket.
create or replace function absen_photo_ok(path text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select path is not null
    and split_part(path, '/', 1) = to_char((now() at time zone 'Asia/Jakarta')::date, 'YYYY-MM-DD')
    and exists (select 1 from storage.objects o where o.bucket_id = 'absen-photos' and o.name = path)
$$;

-- 3. The clock in/out rule from 0015, now also requiring the selfie.
create or replace function attendance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s attendance_settings;
begin
  select * into s from attendance_settings where id = 1;

  if tg_op = 'INSERT' then
    if s is null then raise exception 'Lokasi Rasi Aksara belum diatur. Minta admin mengaturnya di Absen > Rekap.'; end if;
    if new.in_lat is null or new.in_lng is null then raise exception 'Lokasi HP tidak terbaca.'; end if;
    if not absen_photo_ok(new.in_photo) then raise exception 'Selfie clock in belum terkirim. Foto ulang lalu coba lagi.'; end if;
    new.user_id := auth.uid();
    new.username := (select case when email like '%@rasiaksara.local' then split_part(email, '@', 1) else email end
                     from auth.users where id = auth.uid());
    new.clock_in := now();
    new.work_date := (now() at time zone 'Asia/Jakarta')::date;
    new.clock_out := null; new.out_lat := null; new.out_lng := null; new.out_accuracy_m := null; new.out_dist_m := null;
    new.out_photo := null;
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
    if not absen_photo_ok(new.out_photo) or new.out_photo = old.in_photo then raise exception 'Selfie clock out belum terkirim. Foto ulang lalu coba lagi.'; end if;
    new.out_dist_m := distance_m(s.lat, s.lng, new.out_lat, new.out_lng);
    if new.out_dist_m > s.radius_m then
      raise exception 'Di luar area Rasi Aksara: % m dari kafe (batas % m).', round(new.out_dist_m), s.radius_m;
    end if;
    new.clock_out := now();
    new.id := old.id; new.user_id := old.user_id; new.username := old.username; new.work_date := old.work_date;
    new.shift := old.shift; new.clock_in := old.clock_in; new.in_lat := old.in_lat; new.in_lng := old.in_lng;
    new.in_accuracy_m := old.in_accuracy_m; new.in_dist_m := old.in_dist_m; new.in_photo := old.in_photo; new.created_at := old.created_at;
    return new;
  end if;

  -- Anything else is a correction (e.g. a forgotten clock out), which only admins may make.
  if not is_admin() then raise exception 'Absensi yang sudah tercatat tidak bisa diubah. Hubungi admin.'; end if;
  return new;
end $$;

-- Check: should show one row, absen-photos.
select id, public from storage.buckets where id = 'absen-photos';
