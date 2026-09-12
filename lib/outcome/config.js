export const OUTCOME_CONFIG = {
  HORIZON_HOURS: { "1H": 1, "4H": 4, "12H": 12, "24H": 24, "48H": 48, "72H": 72 },
  DEFAULT_HORIZON: "24H",

  CHECK_INTERVAL_MINUTES: { "5m": 5, "15m": 15, "1h": 30, "4h": 60, "1d": 180 },

  WAIT_EVALUATION_THRESHOLD_PCT: 3,

  // Batas atas jumlah candle per permintaan ke Bitget (API memperbolehkan 1000).
  MAX_CANDLES_PER_CHECK: 1000,

  // Berapa setup yang boleh diproses dalam SATU jalannya worker. Dulu 20 dengan
  // cron 1x sehari = maksimal 20 setup/hari, jauh di bawah laju pencatatan
  // screener, sehingga antrean menumpuk dan setup baru dievaluasi berhari-hari
  // setelah horizonnya habis.
  WORKER_BATCH_LIMIT: 120,

  // Worker berhenti sendiri sebelum Vercel memutus request. Sisa antrean
  // dikerjakan di jalannya berikutnya, jadi tidak ada data yang hilang.
  //
  // Diturunkan 45s -> 25s: scheduler eksternal gratis (cron-job.org) memutus
  // koneksi sekitar 30 detik dan menandai job-nya gagal. Beberapa kegagalan
  // beruntun membuat job dinonaktifkan otomatis — worker mati tanpa Anda tahu.
  WORKER_DEADLINE_MS: 25000,

  // Baris yang gagal dievaluasi (error tak terduga) dijadwalkan ulang sekian
  // lama ke depan. Tanpa ini, next_check_at-nya tidak pernah bergerak dan baris
  // itu menetap di kepala antrean "paling telat dulu" selamanya.
  ERROR_BACKOFF_MS: 30 * 60 * 1000,

  // PENDING yang horizonnya sudah lewat sekian lama tidak lagi dianggap "aktif"
  // untuk keperluan dedup pencatatan. Tanpa ini, worker yang mati akan
  // membekukan setiap symbol yang pernah tercatat (lihat recordPolicy.js).
  STALE_PENDING_GRACE_MS: 15 * 60 * 1000,

  // Breakeven: begitu profit mengambang capai N x jarak SL awal, SL pindah ke entry
  // (posisi tidak mungkin lagi rugi). Dipakai hanya oleh trailingMonitor.js.
  BREAKEVEN_TRIGGER_R: 1,

  // Kalau satu candle menyentuh SL DAN TP sekaligus, urutannya tidak bisa
  // diketahui dari data candle. Asumsi konservatif: SL duluan. Tanpa ini hasil
  // backtest selalu lebih bagus dari kenyataan.
  SAME_CANDLE_ASSUME_STOP_FIRST: true,
};
