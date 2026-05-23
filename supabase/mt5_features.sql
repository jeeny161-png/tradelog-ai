-- Apply this in Supabase SQL Editor for MT5 EA auto-sync.

alter table public.profiles
  add column if not exists mt5_api_key uuid not null default gen_random_uuid();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;
end $$;

create unique index if not exists profiles_mt5_api_key_idx
  on public.profiles(mt5_api_key);

alter table public.trades
  add column if not exists mt5_ticket text,
  add column if not exists mt5_raw jsonb,
  add column if not exists swap numeric default 0,
  add column if not exists commission numeric default 0,
  add column if not exists gross_pnl numeric default 0;

create unique index if not exists trades_mt5_ticket_unique_idx
  on public.trades(mt5_ticket)
  where mt5_ticket is not null;
