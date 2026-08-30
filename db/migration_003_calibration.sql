-- Migration 003: Mesin Kalibrasi Score
-- Jalankan SEKALI di SQL Editor Supabase. Aman diulang ("if not exists" / "if exists").
--
-- Isi:
--  1. Buang fitur jurnal trading manual (tidak dipakai lagi).
--  2. Simpan sub-score screener per setup -> supaya bisa diketahui KOMPONEN MANA
--     yang benar-benar prediktif, bukan cuma skor totalnya.
--  3. Tandai control group -> setup di bawah ambang yang tetap dicatat sebagai
--     pembanding acak. Tanpa ini, win rate tidak punya baseline.

-- 1. Jurnal trading manual dibuang -----------------------------------------
drop table if exists manual_trades;
alter table ai_predictions drop column if exists user_action;

-- 2. Sub-score screener disimpan di snapshot -------------------------------
alter table prediction_snapshots add column if not exists momentum_score numeric;
alter table prediction_snapshots add column if not exists volume_score numeric;
alter table prediction_snapshots add column if not exists liquidity_score numeric;
alter table prediction_snapshots add column if not exists volatility_score numeric;
alter table prediction_snapshots add column if not exists breakout_score numeric;
alter table prediction_snapshots add column if not exists raw_score numeric;
alter table prediction_snapshots add column if not exists penalty numeric;
alter table prediction_snapshots add column if not exists direction text;
alter table prediction_snapshots add column if not exists structure_bias text;
alter table prediction_snapshots add column if not exists btc_momentum_label text;

-- 3. Control group ----------------------------------------------------------
alter table ai_predictions add column if not exists is_control boolean not null default false;
create index if not exists idx_ai_predictions_is_control on ai_predictions(is_control);

-- 4. Index untuk query kalibrasi --------------------------------------------
create index if not exists idx_ai_predictions_timestamp on ai_predictions(timestamp desc);
