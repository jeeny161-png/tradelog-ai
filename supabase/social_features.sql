-- Apply this in Supabase SQL Editor before using groups, rankings, goals, and public trade links.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  monthly_target numeric not null default 0,
  max_daily_loss numeric not null default 0,
  max_consecutive_losses integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists ranking_opt_in boolean not null default false;

alter table public.trades
  add column if not exists share_token text unique,
  add column if not exists created_at timestamptz default now();

create index if not exists trades_share_token_idx on public.trades(share_token);
create index if not exists trades_user_date_idx on public.trades(user_id, date);
create index if not exists group_members_user_idx on public.group_members(user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.goals enable row level security;

drop policy if exists "Group members can read groups" on public.groups;
create policy "Group members can read groups"
on public.groups for select to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = groups.id and gm.user_id = auth.uid()
  )
);

drop policy if exists "Users can create owned groups" on public.groups;
create policy "Users can create owned groups"
on public.groups for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists "Members can read group members" on public.group_members;
create policy "Members can read group members"
on public.group_members for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
  )
);

drop policy if exists "Users can join as themselves" on public.group_members;
create policy "Users can join as themselves"
on public.group_members for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can manage own goals" on public.goals;
create policy "Users can manage own goals"
on public.goals for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
