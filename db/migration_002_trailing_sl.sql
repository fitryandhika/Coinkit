-- Migration 002: Trailing Stop Loss + Korelasi BTC
-- Jalankan SEKALI di SQL Editor Supabase project yang SUDAH ada (bukan instalasi baru —
-- instalasi baru cukup pakai db/schema.sql yang sudah termasuk kolom ini).
-- Aman dijalankan berkali-kali ("if not exists").

alter table ai_predictions add column if not exists trail_atr numeric;
alter table ai_predictions add column if not exists btc_correlation numeric;
alter table ai_predictions add column if not exists trail_multiplier numeric;

alter table prediction_outcomes add column if not exists exit_price numeric;
alter table prediction_outcomes add column if not exists breakeven_activated boolean default false;
alter table prediction_outcomes add column if not exists final_stop_price numeric;
