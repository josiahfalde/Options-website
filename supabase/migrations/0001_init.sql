-- ============================================================================
-- Flywheel — initial schema (multi-user SaaS foundation)
-- ----------------------------------------------------------------------------
-- Mirrors src/types.ts (Trade / SpyBenchmark / Dataset) but keyed by user_id.
-- Every table has Row-Level Security so a user can ONLY ever touch their own
-- rows. This file is the security wall for the whole product — read it twice.
--
-- Apply:  supabase db push   (or paste into the SQL editor in the dashboard)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Holds billing/subscription state (Phase 3).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text,
  created_at          timestamptz not null default now(),
  -- Stripe / entitlement (populated by the billing webhook in Phase 3)
  stripe_customer_id  text unique,
  plan                text not null default 'free',          -- 'free' | 'pro'
  subscription_status text not null default 'inactive',      -- inactive|active|trialing|past_due|canceled
  current_period_end  timestamptz
);

-- ---------------------------------------------------------------------------
-- trades: one Wheel workbook row per record.
-- ---------------------------------------------------------------------------
create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  ticker      text not null,
  side        text not null check (side in ('credit','debit')),
  action      text not null check (action in ('CSP','CC','BB','AAssignSTK')),
  trade_date  date not null,
  shares      integer not null default 100,
  amount      numeric not null default 0,        -- total $ for the contract
  invested    numeric,                           -- only on AAssignSTK
  status      text not null default '' check (status in ('Open','Expired','Closed','Assigned','')),
  strike      numeric,
  expiry      date,
  note        text,
  thesis      text,
  grade       integer check (grade between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists trades_user_idx on public.trades (user_id, trade_date);

-- ---------------------------------------------------------------------------
-- prices: last known price per ticker, per user (matches Dataset.lastPrices).
-- ---------------------------------------------------------------------------
create table if not exists public.prices (
  user_id     uuid not null references auth.users (id) on delete cascade,
  ticker      text not null,
  price       numeric not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, ticker)
);

-- ---------------------------------------------------------------------------
-- user_settings: capital base + SPY benchmark (one row per user).
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  capital_base       numeric not null default 0,
  spy_now            numeric not null default 0,
  spy_year_ago       numeric not null default 0,
  spy_year_ago_date  date,
  updated_at         timestamptz not null default now()
);

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.profiles      enable row level security;
alter table public.trades        enable row level security;
alter table public.prices        enable row level security;
alter table public.user_settings enable row level security;

-- profiles: a user reads/updates only their own profile.
-- NOTE: subscription columns are written by the service-role webhook, which
-- bypasses RLS — so users can READ but never escalate their own plan here.
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- trades / prices / user_settings: full CRUD scoped to the owner.
create policy "own trades" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own prices" on public.prices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- Auto-create a profile + empty settings row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trades_touch on public.trades;
create trigger trades_touch before update on public.trades
  for each row execute function public.touch_updated_at();

drop trigger if exists prices_touch on public.prices;
create trigger prices_touch before update on public.prices
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.user_settings;
create trigger settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();
