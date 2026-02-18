begin;

alter table public.profiles enable row level security;
alter table public.user_plans enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "plans_read_own" on public.user_plans;
create policy "plans_read_own"
on public.user_plans for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "plans_update_own" on public.user_plans;
create policy "plans_update_own"
on public.user_plans for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "plans_insert_own" on public.user_plans;
create policy "plans_insert_own"
on public.user_plans for insert
to authenticated
with check (user_id = auth.uid());

commit;
