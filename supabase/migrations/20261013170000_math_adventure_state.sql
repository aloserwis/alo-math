create table if not exists public.math_adventure_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.math_adventure_state enable row level security;
revoke all on table public.math_adventure_state from anon, authenticated;
grant select, insert, update on table public.math_adventure_state to authenticated;

drop policy if exists "Users manage their own Math Adventure state"
  on public.math_adventure_state;
create policy "Users manage their own Math Adventure state"
  on public.math_adventure_state
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
