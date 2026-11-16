-- Jadwal shift staff (Zaky, 16 Nov 2026). Run after 0009_items_admin_only.sql (needs is_admin()). Safe to run again.
-- One row per person per day: PAGI (07.00-15.00), MALAM (14.30-22.30) or LIBUR. Everyone can read it;
-- only admins can change it (Jadwal > Atur jadwal in the app: upload the monthly Excel, or tap a cell).
-- `name` is the name as written in the Excel; `username` links it to a staff login, so "Jadwal saya" can find it.

create table if not exists shift_schedule (
  work_date date not null,
  name text not null,
  username text,
  shift text not null check (shift in ('pagi', 'malam', 'libur')),
  updated_by_name text,
  updated_at timestamptz not null default now(),
  primary key (work_date, name)
);

create index if not exists shift_schedule_username on shift_schedule (username, work_date);

alter table shift_schedule enable row level security;
drop policy if exists "staff read schedule" on shift_schedule;
create policy "staff read schedule" on shift_schedule for select to authenticated using (true);
drop policy if exists "admins write schedule" on shift_schedule;
create policy "admins write schedule" on shift_schedule for all to authenticated
  using (is_admin()) with check (is_admin());

-- November 2026, from jadwal-nov-2026.xlsx. Rows already there (e.g. changed in the app) are kept.
insert into shift_schedule (work_date, name, shift, updated_by_name)
select v.d::date, v.n, v.s, 'import Excel' from (values
  ('2026-11-01','RAFI','pagi'), ('2026-11-02','RAFI','libur'), ('2026-11-03','RAFI','malam'), ('2026-11-04','RAFI','malam'), ('2026-11-05','RAFI','pagi'), ('2026-11-06','RAFI','pagi'),
  ('2026-11-07','RAFI','malam'), ('2026-11-08','RAFI','pagi'), ('2026-11-09','RAFI','libur'), ('2026-11-10','RAFI','malam'), ('2026-11-11','RAFI','pagi'), ('2026-11-12','RAFI','pagi'),
  ('2026-11-13','RAFI','malam'), ('2026-11-14','RAFI','pagi'), ('2026-11-15','RAFI','pagi'), ('2026-11-16','RAFI','libur'), ('2026-11-17','RAFI','malam'), ('2026-11-18','RAFI','malam'),
  ('2026-11-19','RAFI','pagi'), ('2026-11-20','RAFI','pagi'), ('2026-11-21','RAFI','malam'), ('2026-11-22','RAFI','pagi'), ('2026-11-23','RAFI','libur'), ('2026-11-24','RAFI','malam'),
  ('2026-11-25','RAFI','malam'), ('2026-11-26','RAFI','pagi'), ('2026-11-27','RAFI','pagi'), ('2026-11-28','RAFI','pagi'), ('2026-11-29','RAFI','pagi'), ('2026-11-30','RAFI','libur'),
  ('2026-11-01','CHANDRA','malam'), ('2026-11-02','CHANDRA','pagi'), ('2026-11-03','CHANDRA','libur'), ('2026-11-04','CHANDRA','malam'), ('2026-11-05','CHANDRA','malam'), ('2026-11-06','CHANDRA','pagi'),
  ('2026-11-07','CHANDRA','malam'), ('2026-11-08','CHANDRA','malam'), ('2026-11-09','CHANDRA','malam'), ('2026-11-10','CHANDRA','pagi'), ('2026-11-11','CHANDRA','libur'), ('2026-11-12','CHANDRA','malam'),
  ('2026-11-13','CHANDRA','pagi'), ('2026-11-14','CHANDRA','pagi'), ('2026-11-15','CHANDRA','malam'), ('2026-11-16','CHANDRA','pagi'), ('2026-11-17','CHANDRA','libur'), ('2026-11-18','CHANDRA','malam'),
  ('2026-11-19','CHANDRA','malam'), ('2026-11-20','CHANDRA','malam'), ('2026-11-21','CHANDRA','pagi'), ('2026-11-22','CHANDRA','malam'), ('2026-11-23','CHANDRA','malam'), ('2026-11-24','CHANDRA','pagi'),
  ('2026-11-25','CHANDRA','libur'), ('2026-11-26','CHANDRA','malam'), ('2026-11-27','CHANDRA','pagi'), ('2026-11-28','CHANDRA','malam'), ('2026-11-29','CHANDRA','malam'), ('2026-11-30','CHANDRA','pagi'),
  ('2026-11-01','KEVIN','malam'), ('2026-11-02','KEVIN','malam'), ('2026-11-03','KEVIN','pagi'), ('2026-11-04','KEVIN','pagi'), ('2026-11-05','KEVIN','libur'), ('2026-11-06','KEVIN','malam'),
  ('2026-11-07','KEVIN','pagi'), ('2026-11-08','KEVIN','malam'), ('2026-11-09','KEVIN','pagi'), ('2026-11-10','KEVIN','libur'), ('2026-11-11','KEVIN','malam'), ('2026-11-12','KEVIN','malam'),
  ('2026-11-13','KEVIN','malam'), ('2026-11-14','KEVIN','malam'), ('2026-11-15','KEVIN','malam'), ('2026-11-16','KEVIN','malam'), ('2026-11-17','KEVIN','pagi'), ('2026-11-18','KEVIN','libur'),
  ('2026-11-19','KEVIN','malam'), ('2026-11-20','KEVIN','pagi'), ('2026-11-21','KEVIN','pagi'), ('2026-11-22','KEVIN','malam'), ('2026-11-23','KEVIN','pagi'), ('2026-11-24','KEVIN','libur'),
  ('2026-11-25','KEVIN','malam'), ('2026-11-26','KEVIN','malam'), ('2026-11-27','KEVIN','malam'), ('2026-11-28','KEVIN','malam'), ('2026-11-29','KEVIN','malam'), ('2026-11-30','KEVIN','malam'),
  ('2026-11-01','BRYAN','pagi'), ('2026-11-02','BRYAN','malam'), ('2026-11-03','BRYAN','malam'), ('2026-11-04','BRYAN','libur'), ('2026-11-05','BRYAN','malam'), ('2026-11-06','BRYAN','malam'),
  ('2026-11-07','BRYAN','pagi'), ('2026-11-08','BRYAN','pagi'), ('2026-11-09','BRYAN','malam'), ('2026-11-10','BRYAN','malam'), ('2026-11-11','BRYAN','malam'), ('2026-11-12','BRYAN','pagi'),
  ('2026-11-13','BRYAN','libur'), ('2026-11-14','BRYAN','malam'), ('2026-11-15','BRYAN','pagi'), ('2026-11-16','BRYAN','malam'), ('2026-11-17','BRYAN','malam'), ('2026-11-18','BRYAN','pagi'),
  ('2026-11-19','BRYAN','libur'), ('2026-11-20','BRYAN','malam'), ('2026-11-21','BRYAN','malam'), ('2026-11-22','BRYAN','pagi'), ('2026-11-23','BRYAN','malam'), ('2026-11-24','BRYAN','malam'),
  ('2026-11-25','BRYAN','pagi'), ('2026-11-26','BRYAN','libur'), ('2026-11-27','BRYAN','malam'), ('2026-11-28','BRYAN','pagi'), ('2026-11-29','BRYAN','pagi'), ('2026-11-30','BRYAN','malam'),
  ('2026-11-01','PUTRI','malam'), ('2026-11-02','PUTRI','malam'), ('2026-11-03','PUTRI','malam'), ('2026-11-04','PUTRI','pagi'), ('2026-11-05','PUTRI','libur'), ('2026-11-06','PUTRI','malam'),
  ('2026-11-07','PUTRI','pagi'), ('2026-11-08','PUTRI','malam'), ('2026-11-09','PUTRI','malam'), ('2026-11-10','PUTRI','malam'), ('2026-11-11','PUTRI','pagi'), ('2026-11-12','PUTRI','libur'),
  ('2026-11-13','PUTRI','malam'), ('2026-11-14','PUTRI','malam'), ('2026-11-15','PUTRI','malam'), ('2026-11-16','PUTRI','malam'), ('2026-11-17','PUTRI','malam'), ('2026-11-18','PUTRI','pagi'),
  ('2026-11-19','PUTRI','libur'), ('2026-11-20','PUTRI','malam'), ('2026-11-21','PUTRI','malam'), ('2026-11-22','PUTRI','malam'), ('2026-11-23','PUTRI','malam'), ('2026-11-24','PUTRI','malam'),
  ('2026-11-25','PUTRI','pagi'), ('2026-11-26','PUTRI','libur'), ('2026-11-27','PUTRI','malam'), ('2026-11-28','PUTRI','pagi'), ('2026-11-29','PUTRI','malam'), ('2026-11-30','PUTRI','malam'),
  ('2026-11-01','VIONA','pagi'), ('2026-11-02','VIONA','libur'), ('2026-11-03','VIONA','malam'), ('2026-11-04','VIONA','malam'), ('2026-11-05','VIONA','pagi'), ('2026-11-06','VIONA','malam'),
  ('2026-11-07','VIONA','malam'), ('2026-11-08','VIONA','pagi'), ('2026-11-09','VIONA','libur'), ('2026-11-10','VIONA','malam'), ('2026-11-11','VIONA','malam'), ('2026-11-12','VIONA','pagi'),
  ('2026-11-13','VIONA','malam'), ('2026-11-14','VIONA','pagi'), ('2026-11-15','VIONA','pagi'), ('2026-11-16','VIONA','libur'), ('2026-11-17','VIONA','malam'), ('2026-11-18','VIONA','malam'),
  ('2026-11-19','VIONA','pagi'), ('2026-11-20','VIONA','malam'), ('2026-11-21','VIONA','malam'), ('2026-11-22','VIONA','pagi'), ('2026-11-23','VIONA','libur'), ('2026-11-24','VIONA','malam'),
  ('2026-11-25','VIONA','malam'), ('2026-11-26','VIONA','pagi'), ('2026-11-27','VIONA','malam'), ('2026-11-28','VIONA','malam'), ('2026-11-29','VIONA','pagi'), ('2026-11-30','VIONA','libur'),
  ('2026-11-01','RIFKI','malam'), ('2026-11-02','RIFKI','pagi'), ('2026-11-03','RIFKI','pagi'), ('2026-11-04','RIFKI','libur'), ('2026-11-05','RIFKI','malam'), ('2026-11-06','RIFKI','pagi'),
  ('2026-11-07','RIFKI','malam'), ('2026-11-08','RIFKI','malam'), ('2026-11-09','RIFKI','pagi'), ('2026-11-10','RIFKI','pagi'), ('2026-11-11','RIFKI','libur'), ('2026-11-12','RIFKI','malam'),
  ('2026-11-13','RIFKI','pagi'), ('2026-11-14','RIFKI','malam'), ('2026-11-15','RIFKI','malam'), ('2026-11-16','RIFKI','pagi'), ('2026-11-17','RIFKI','pagi'), ('2026-11-18','RIFKI','libur'),
  ('2026-11-19','RIFKI','malam'), ('2026-11-20','RIFKI','pagi'), ('2026-11-21','RIFKI','pagi'), ('2026-11-22','RIFKI','malam'), ('2026-11-23','RIFKI','pagi'), ('2026-11-24','RIFKI','pagi'),
  ('2026-11-25','RIFKI','libur'), ('2026-11-26','RIFKI','malam'), ('2026-11-27','RIFKI','pagi'), ('2026-11-28','RIFKI','malam'), ('2026-11-29','RIFKI','malam'), ('2026-11-30','RIFKI','pagi')
) as v(d, n, s)
on conflict (work_date, name) do nothing;

-- Link each name to the staff login with the same username or name (RAFI -> rafi). Names without an exact
-- match stay unlinked; the app shows them on Atur jadwal with a list to pick the right account.
update shift_schedule s set username = a.username
from (
  select split_part(email, '@', 1) as username, lower(coalesce(raw_user_meta_data ->> 'name', '')) as full_name
  from auth.users
) a
where s.username is null
  and (lower(s.name) = a.username or lower(s.name) = a.full_name or lower(s.name) = split_part(a.full_name, ' ', 1))
  and (select count(*) from auth.users u where lower(s.name) in (split_part(u.email, '@', 1),
       lower(coalesce(u.raw_user_meta_data ->> 'name', '')), split_part(lower(coalesce(u.raw_user_meta_data ->> 'name', '')), ' ', 1))) = 1;
