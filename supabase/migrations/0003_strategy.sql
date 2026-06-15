-- ============================================================================
-- Multi-strategy support (JF-27): strategy buckets + multi-leg positions.
-- ----------------------------------------------------------------------------
-- Flywheel is no longer Wheel-only. These additive, nullable columns let a
-- trade carry:
--   • strategy    — the strategy bucket ("wheel", "put-credit-spread", …, or a
--                   custom user label). NULL = auto-detected from structure.
--   • position_id — groups legs of one multi-leg position (e.g. a vertical).
--                   NULL = a standalone single-leg position.
--   • option_type — put/call, on generic spread legs (STO/BTO/STC/BTC).
-- Plus the `action` CHECK is widened to allow the four generic option-leg
-- actions. Existing rows are unaffected (all NULL / existing actions). RLS
-- already covers the trades table.
-- ============================================================================

-- Widen the action vocabulary for generic option legs used by spreads.
alter table public.trades drop constraint if exists trades_action_check;
alter table public.trades
  add constraint trades_action_check
  check (action in ('CSP','CC','BB','AAssignSTK','STO','BTO','STC','BTC'));

alter table public.trades add column if not exists strategy    text;
alter table public.trades add column if not exists position_id text;
alter table public.trades add column if not exists option_type text
  check (option_type in ('put','call'));

create index if not exists trades_strategy_idx on public.trades (user_id, strategy);
create index if not exists trades_position_idx on public.trades (user_id, position_id);
