-- Notifikasi ronde checklist ke HP staff (Zaky, 13 Nov 2026). Run after 0015_absensi.sql. Safe to run again.
--
-- What it does:
--   * push_subscriptions: one row per phone that tapped "Nyalakan notifikasi" (the browser's push address).
--   * push_config: one private row the app fills itself (VAPID keys, its own web address) plus a random secret.
--     No policies, so only the server (secret key) can read it; staff phones never see it.
--   * At minute 0 and 30 of every hour, pg_cron asks the app (/api/push/ronde) whether a round starts now (or is still unfinished). The app checks
--     the round hours in src/lib/checklist.ts, so changing rounds later needs no SQL.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  username text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
create index if not exists push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;
drop policy if exists "staff see own push" on push_subscriptions;
create policy "staff see own push" on push_subscriptions for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists "staff add own push" on push_subscriptions;
create policy "staff add own push" on push_subscriptions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "staff change own push" on push_subscriptions;
create policy "staff change own push" on push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "staff remove own push" on push_subscriptions;
create policy "staff remove own push" on push_subscriptions for delete to authenticated using (user_id = auth.uid() or is_admin());

create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  app_url text,
  cron_secret text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  last_round text
);
insert into push_config (id) values (1) on conflict (id) do nothing;
alter table push_config enable row level security;
-- No policies on purpose: only the service role (server) reads or writes it.

-- Called by pg_cron. Does nothing until the app has saved its web address (first time a staff turns notifications on).
create or replace function push_ronde_tick() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare cfg push_config;
begin
  select * into cfg from push_config where id = 1;
  if cfg.app_url is null then return; end if;
  perform net.http_post(
    url := cfg.app_url || '/api/push/ronde',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ronde-secret', cfg.cron_secret),
    body := '{}'::jsonb
  );
end $$;
revoke all on function push_ronde_tick() from public, anon, authenticated;

-- Minute 0 and 30 of every hour (Jakarta is UTC+7, so the minutes match). Re-running replaces the job.
select cron.schedule('push-ronde', '0,30 * * * *', 'select public.push_ronde_tick()');
