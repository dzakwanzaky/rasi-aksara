-- Staff accounts by username (Zaky, 14 Okt 2026). Supabase limits invite emails, so staff are created
-- from the app's Staff page with a username and password instead (see src/lib/staff.ts).
-- This table says who may open that page. Only the server, with the secret key, can change it.

create table if not exists app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table app_admins enable row level security;
drop policy if exists "staff read admins" on app_admins;
create policy "staff read admins" on app_admins for select to authenticated using (true);

-- The owner is the first account made with a real email.
insert into app_admins (user_id)
select id from auth.users
where email not like '%@rasiaksara.local'
order by created_at
limit 1
on conflict do nothing;

-- Check: should show the owner's email.
select u.email from app_admins a join auth.users u on u.id = a.user_id;
