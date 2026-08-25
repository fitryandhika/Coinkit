create table if not exists ai_predictions (
  id text primary key,
  timestamp timestamptz not null default now(),
  symbol text not null,
  market text not null check (market in ('spot','futures')),
  timeframe text not null,
  decision text not null check (decision in ('BUY','SELL','LONG','SHORT','WAIT')),
  score numeric,
  confidence numeric,
  entry numeric,
  stop_loss numeric,
  tp1 numeric,
  tp2 numeric,
  tp3 numeric,
  risk_percent numeric,
  risk_amount numeric,
  position_size numeric,
  leverage numeric,
  risk_reward numeric,
  risk_score numeric,
  evaluation_horizon text not null default '24H',
  reasoning jsonb,
  user_action text not null default 'PENDING' check (user_action in ('PENDING','TAKEN','SKIPPED')),
  status text not null default 'PENDING'
);

create index if not exists idx_ai_predictions_status on ai_predictions(status);
create index if not exists idx_ai_predictions_symbol on ai_predictions(symbol);

create table if not exists prediction_snapshots (
  prediction_id text primary key references ai_predictions(id) on delete cascade,
  price numeric,
  rsi numeric,
  macd jsonb,
  ema20 numeric,
  ema50 numeric,
  atr numeric,
  adx numeric,
  vwap numeric,
  volume numeric,
  volume_ratio numeric,
  support jsonb,
  resistance jsonb,
  market_structure text,
  breakout_status text,
  exhaustion_status text,
  market_regime text,
  funding_rate numeric,
  open_interest numeric,
  technical_score numeric,
  screener_score numeric,
  risk_score numeric
);

create table if not exists prediction_outcomes (
  prediction_id text primary key references ai_predictions(id) on delete cascade,
  evaluation_started_at timestamptz,
  evaluation_ended_at timestamptz,
  next_check_at timestamptz,
  maximum_gain_pct numeric,
  maximum_drawdown_pct numeric,
  maximum_gain_price numeric,
  maximum_drawdown_price numeric,
  maximum_r numeric,
  tp1_hit boolean default false,
  tp2_hit boolean default false,
  tp3_hit boolean default false,
  sl_hit boolean default false,
  tp1_hit_at timestamptz,
  tp2_hit_at timestamptz,
  tp3_hit_at timestamptz,
  sl_hit_at timestamptz,
  outcome text default 'PENDING',
  status text default 'PENDING'
);

create index if not exists idx_prediction_outcomes_status on prediction_outcomes(status);

create table if not exists manual_trades (
  id text primary key,
  prediction_id text references ai_predictions(id) on delete cascade,
  user_action text,
  actual_entry numeric,
  actual_exit numeric,
  actual_position_size numeric,
  actual_leverage numeric,
  actual_stop_loss numeric,
  actual_take_profit numeric,
  trading_fee numeric,
  realized_pnl numeric,
  realized_pnl_pct numeric,
  notes text,
  created_at timestamptz default now(),
  closed_at timestamptz
);
