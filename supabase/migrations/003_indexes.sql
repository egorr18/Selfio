begin;
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_user_plans_status on public.user_plans(status);
commit;
