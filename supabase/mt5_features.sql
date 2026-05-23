-- Apply this in Supabase SQL Editor for MT5 EA auto-sync.

alter table public.profiles
  add column if not exists mt5_api_key uuid not null default gen_random_uuid();

create unique index if not exists profiles_mt5_api_key_idx
  on public.profiles(mt5_api_key);

alter table public.trades
  add column if not exists mt5_ticket text,
  add column if not exists mt5_raw jsonb;

create index if not exists trades_mt5_ticket_idx
  on public.trades(mt5_ticket);
