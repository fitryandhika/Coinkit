-- Migration 004: Entry Quality (kelayakan harga saat setup ditampilkan)
-- Jalankan SEKALI di SQL Editor Supabase. Aman diulang ("if not exists").
--
-- Kenapa perlu: sebelumnya kita hanya menyimpan SEBERAPA KUAT setup-nya.
-- Kolom di bawah menyimpan SEBERAPA MAHAL harganya saat setup dicatat, supaya
-- mesin kalibrasi bisa menjawab pertanyaan: "apakah setup yang entry-nya masih
-- murah benar-benar menang lebih sering daripada yang sudah terlanjur lari?"

alter table prediction_snapshots add column if not exists entry_score numeric;
alter table prediction_snapshots add column if not exists entry_label text;
alter table prediction_snapshots add column if not exists risk_reward numeric;
alter table prediction_snapshots add column if not exists chase_gap_pct numeric;
alter table prediction_snapshots add column if not exists extension_atr numeric;

create index if not exists idx_snapshots_entry_label on prediction_snapshots(entry_label);
