-- Only admins change the item list and minimum stock (Zaky, 15 Okt 2026).
-- A staff member typed his shift counts into Bahan's "Min" boxes instead of Hitung.
-- Staff still read items and fill counts as before.

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid())
$$;

drop policy if exists "staff write items" on items;
drop policy if exists "admins write items" on items;
create policy "admins write items" on items for all to authenticated
  using (is_admin()) with check (is_admin());
