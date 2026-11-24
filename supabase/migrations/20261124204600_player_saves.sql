-- One cloud save per account. The player can read and write only their own row.
create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  saved_at timestamptz not null default now(),
  constraint saves_state_size check (octet_length(state::text) < 500000)
);

alter table public.saves enable row level security;
alter table public.saves force row level security;

revoke all on public.saves from anon, public;
grant select, insert, update, delete on public.saves to authenticated;

create policy saves_select on public.saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy saves_insert on public.saves
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy saves_update on public.saves
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy saves_delete on public.saves
  for delete to authenticated
  using ((select auth.uid()) = user_id);
