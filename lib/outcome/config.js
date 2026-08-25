export const OUTCOME_CONFIG = {
  HORIZON_HOURS: { "1H": 1, "4H": 4, "12H": 12, "24H": 24, "48H": 48, "72H": 72 },
  DEFAULT_HORIZON: "24H",

  CHECK_INTERVAL_MINUTES: { "5m": 5, "15m": 15, "1h": 30, "4h": 60, "1d": 180 },

  WAIT_EVALUATION_THRESHOLD_PCT: 3,

  MAX_CANDLES_PER_CHECK: 200,
  WORKER_BATCH_LIMIT: 20,

  // Breakeven: begitu profit mengambang capai N x jarak SL awal, SL pindah ke entry
  // (posisi tidak mungkin lagi rugi). Dipakai hanya oleh trailingMonitor.js.
  BREAKEVEN_TRIGGER_R: 1,
};
