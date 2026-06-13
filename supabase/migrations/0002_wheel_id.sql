-- ============================================================================
-- Wheel-tagging (JF-24): per-trade wheel-grouping override.
-- ----------------------------------------------------------------------------
-- `wheel_id` lets a user pin a trade to a specific wheel cycle (to confirm,
-- merge, or split auto-detected cycles) or exclude it from any wheel via the
-- app's WHEEL_EXCLUDED sentinel. NULL = fall back to auto-detection.
-- Nullable + no constraints, so it's a safe additive change; existing rows
-- default to NULL (auto). RLS already covers the trades table.
-- ============================================================================
alter table public.trades add column if not exists wheel_id text;

create index if not exists trades_wheel_idx on public.trades (user_id, wheel_id);
