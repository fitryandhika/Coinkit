-- Migration 005: Integritas Evaluasi Outcome
-- Jalankan SEKALI di SQL Editor Supabase. Aman diulang ("if not exists").
--
-- Latar belakang singkat:
--   Sebelum perbaikan ini, worker mengambil candle dari waktu entry sampai
--   SEKARANG tanpa batas atas, dan cron hanya jalan 1x sehari untuk 20 setup.
--   Akibatnya setup 24 jam bisa dinilai atas rentang berhari-hari: MFE, MAE,
--   dan sentuhan SL sama-sama membengkak, dan ratusan setup selesai tanpa harga
--   keluar sama sekali.
--
--   Karena itu data lama TIDAK sebanding dengan data baru. Kolom ruleset_version
--   memisahkan keduanya supaya korelasi score tidak tercemar.

-- 1. Penanda versi aturan ----------------------------------------------------
alter table ai_predictions add column if not exists ruleset_version integer not null default 1;
create index if not exists idx_ai_predictions_ruleset on ai_predictions(ruleset_version);

-- Semua baris yang sudah ada = aturan lama (v1). Setup baru dicatat sebagai v2
-- otomatis oleh aplikasi (lihat config/ruleset.js).
update ai_predictions set ruleset_version = 1 where ruleset_version is null;

-- 2. Alasan & waktu keluar ---------------------------------------------------
-- Dulu hanya ada exit_price, sehingga mustahil membedakan "keluar di stop",
-- "keluar di target", dan "horizon habis" saat menganalisa ulang.
alter table prediction_outcomes add column if not exists exit_reason text;
alter table prediction_outcomes add column if not exists exit_at timestamptz;

-- 3. Index untuk antrean worker ---------------------------------------------
-- listDueOutcomes() mengurutkan berdasarkan next_check_at, paling telat dulu.
-- Tanpa index ini query-nya jadi full scan begitu tabel membesar.
create index if not exists idx_prediction_outcomes_due
  on prediction_outcomes(status, next_check_at);
