-- Nama formal staff (Zaky, 16 Nov 2026). Run after 0018_jadwal_shift.sql. Safe to run again.
-- Usernames (login) stay exactly as they are. This adds each person's full formal name and the
-- nickname shown in tight spots, links the November schedule names to the right login, and renames
-- the schedule names to the official nicknames (RAFI -> DINNO, BRYAN -> BRIAN, CHANDRA -> CANDRA).
-- Names can be changed later on the Staff page.

create table if not exists staff_profiles (
  username text primary key,
  full_name text not null,
  nickname text not null,
  updated_at timestamptz not null default now()
);

alter table staff_profiles enable row level security;
drop policy if exists "staff read names" on staff_profiles;
create policy "staff read names" on staff_profiles for select to authenticated using (true);
drop policy if exists "admins write names" on staff_profiles;
create policy "admins write names" on staff_profiles for all to authenticated
  using (is_admin()) with check (is_admin());

drop table if exists pg_temp.nama_formal, pg_temp.akun_cocok;
create temporary table nama_formal (full_name text, nickname text, keys text[]);
insert into nama_formal values
  ('Kafin Ahmad Izzatulloh', 'Kevin',  array['kevin', 'kafin', 'kapin']),
  ('Putri Serlina Agustin',  'Putri',  array['putri', 'serlina']),
  ('Candra Ginsa Maulana',   'Candra', array['candra', 'chandra', 'ginsa']),
  ('Adam Johan Febrian',     'Brian',  array['bryan', 'brian', 'adam', 'johan']),
  ('Rafi Dinno Darmawan',    'Dinno',  array['rafi', 'dinno', 'dino']),
  ('Viona Najwa Putrivia',   'Viona',  array['viona', 'vio', 'najwa']),
  ('Rifky Nur Wachid',       'Rifky',  array['rifky', 'rifki', 'riky', 'rikfy']);

-- Logins Zaky confirmed 16 Nov: rifky, rafi (Dinno), bryan (Brian). Listed first so they win.
-- Each person's login: a staff account whose username is one of their names, or the account their
-- schedule row was already linked to by hand on Jadwal > Atur jadwal.
create temporary table akun_cocok as
select distinct on (n.nickname) a.username, n.full_name, n.nickname, n.keys
from nama_formal n
join (
  select lower(split_part(email, '@', 1)) as username from auth.users where email ilike '%@rasiaksara.local'
  union
  select username from shift_schedule where username is not null
) a on a.username = any(n.keys)
    or exists (select 1 from shift_schedule s where s.username = a.username and lower(s.name) = any(n.keys))
order by n.nickname, array_position(n.keys, a.username) nulls last;

insert into staff_profiles (username, full_name, nickname)
select username, full_name, nickname from akun_cocok
on conflict (username) do update set full_name = excluded.full_name, nickname = excluded.nickname, updated_at = now();

-- Link schedule rows to the login, then use the official nickname as the schedule name.
update shift_schedule s set username = k.username
from akun_cocok k
where s.username is null and lower(s.name) = any(k.keys);

update shift_schedule s set name = upper(n.nickname)
from nama_formal n
where lower(s.name) = any(n.keys) and s.name <> upper(n.nickname)
  and not exists (select 1 from shift_schedule t where t.work_date = s.work_date and t.name = upper(n.nickname));

-- Result: who is linked to which login. "BELUM ADA AKUN" = no matching login found; set it on the Staff page.
select n.full_name as nama_lengkap, n.nickname as panggilan, coalesce(k.username, 'BELUM ADA AKUN') as username
from nama_formal n left join akun_cocok k on k.nickname = n.nickname
order by n.nickname;
