-- ============================================================================
-- Allocation tracker (JF-36): share-level events + per-ticker sector overrides.
-- ----------------------------------------------------------------------------
-- stock_events    outright share buys / sells / dividend reinvestments from a
--                 broker history CSV (or manual). Deliberately a SEPARATE table
--                 from trades so the option premium accounting is untouched.
-- ticker_sectors  a user's override of the sector a ticker belongs to (the app
--                 ships a built-in map; this only stores the exceptions).
-- Both are RLS-locked to the owner, same policy shape as trades.
-- ============================================================================

create table if not exists public.stock_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  ticker      text not null,
  trade_date  date not null,
  kind        text not null check (kind in ('buy','sell','reinvest')),
  shares      numeric not null check (shares > 0),
  price       numeric not null default 0,
  amount      numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists stock_events_user_idx on public.stock_events (user_id, ticker, trade_date);

create table if not exists public.ticker_sectors (
  user_id     uuid not null references auth.users (id) on delete cascade,
  ticker      text not null,
  sector      text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table public.stock_events   enable row level security;
alter table public.ticker_sectors enable row level security;

create policy "own stock events" on public.stock_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own ticker sectors" on public.ticker_sectors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists ticker_sectors_touch on public.ticker_sectors;
create trigger ticker_sectors_touch before update on public.ticker_sectors
  for each row execute function public.touch_updated_at();
