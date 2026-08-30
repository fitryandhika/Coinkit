export const SCREENER_CONFIG = {
  MOMENTUM_WEIGHT: 0.3,
  VOLUME_WEIGHT: 0.2,
  LIQUIDITY_WEIGHT: 0.25,
  VOLATILITY_WEIGHT: 0.1,
  BREAKOUT_WEIGHT: 0.15,

  // --- Momentum ---------------------------------------------------------
  // Skor momentum sekarang RELATIF terhadap arah setup (lihat momentum.js):
  // 100 = momentum kuat SEARAH setup, 50 = datar, 0 = momentum kuat MELAWAN.
  // Semua angka di bawah dibaca sebagai "% per candle", bukan % kumulatif,
  // supaya nilainya konsisten dipakai di semua timeframe.
  MOMENTUM_CLAMP_PCT: 3,
  MOMENTUM_STRONG_PCT: 1.5,
  MOMENTUM_MODERATE_PCT: 0.5,
  // Arah tidak lagi ditentukan satu candle: blend beberapa lookback.
  MOMENTUM_BLEND_WEIGHTS: { m1: 0.45, m3: 0.35, m6: 0.2 },
  // Bonus kalau m1/m3/m6 kompak searah, penalti kalau kompak melawan setup.
  MOMENTUM_ALIGNMENT_BONUS: 8,

  // --- Volume -----------------------------------------------------------
  VOLUME_LOW_MAX: 0.5,
  VOLUME_NORMAL_MAX: 1,
  VOLUME_ELEVATED_MAX: 2,
  VOLUME_SCORE_CLAMP: 3,
  // Rata-rata pembanding volume dihitung dari N candle terakhir saja, supaya
  // menaikkan CANDLE_COUNT tidak mengubah arti "volume di atas rata-rata".
  VOLUME_AVG_LOOKBACK: 20,

  // --- Volatility -------------------------------------------------------
  VOLATILITY_LOW_MAX: 0.5,
  VOLATILITY_NORMAL_MAX: 2,
  VOLATILITY_HIGH_MAX: 5,
  VOLATILITY_IDEAL_PCT: 2,
  VOLATILITY_SCORE_SPREAD: 4,
  VOLATILITY_LOOKBACK: 20,

  // --- Liquidity --------------------------------------------------------
  LIQUIDITY_HIGH_MIN_VOLUME: 5_000_000,
  LIQUIDITY_MEDIUM_MIN_VOLUME: 500_000,
  LIQUIDITY_HIGH_MAX_SPREAD_PCT: 0.1,
  LIQUIDITY_MEDIUM_MAX_SPREAD_PCT: 0.3,
  LIQUIDITY_MAX_ACCEPTABLE_SPREAD_PCT: 1,
  LIQUIDITY_VOLUME_SCALE: 100_000_000,

  // --- Struktur (breakout / breakdown) ----------------------------------
  // Swing high & swing low dihitung dari jendela tetap, BUKAN dari seluruh
  // candle yang difetch — kalau tidak, "previous high" ikut melar saat
  // CANDLE_COUNT dinaikkan dan breakout jadi tidak pernah terjadi.
  BREAKOUT_LOOKBACK: 40,
  BREAKOUT_PROXIMITY_PCT: 1.5,
  BREAKOUT_MIN_VOLUME_RATIO: 1.2,

  // --- Exhaustion -------------------------------------------------------
  EXHAUSTION_MOMENTUM_PCT: 4,
  EXHAUSTION_VOLUME_RATIO: 3,
  EXHAUSTION_DEVIATION_PCT: 5,
  EXHAUSTION_VOLATILITY_PCT: 5,
  EXHAUSTION_MIN_FLAGS: 2,
  EXHAUSTION_LOOKBACK: 20,

  // --- Penalti ----------------------------------------------------------
  PENALTY_LOW_LIQUIDITY: 15,
  PENALTY_HIGH_SPREAD: 10,
  PENALTY_LOW_VOLUME: 10,
  PENALTY_EXTREME_VOLATILITY: 10,
  PENALTY_POSSIBLE_EXHAUSTION: 10,

  // --- Universe & fetching ---------------------------------------------
  MIN_VALID_VOLUME_USDT: 10_000,
  CANDLE_UNIVERSE_LIMIT: 120,
  CANDLE_COUNT: 150,
  CONCURRENCY_LIMIT: 12,
  CANDLE_FETCH_TIMEOUT_MS: 6000,
  CANDLE_FETCH_RETRIES: 1,

  SCREENER_CACHE_TTL_MS: 45000,

  // Trailing stop adaptif — dipakai saat prediction DICATAT (bukan saat evaluasi)
  DEFAULT_TRAIL_MULTIPLIER: 2,
  TIGHT_TRAIL_MULTIPLIER: 1.5,
  WIDE_TRAIL_MULTIPLIER: 3,
  HIGH_CORRELATION_THRESHOLD: 0.6,
  // Korelasi dihitung dari N return terakhir. MIN_SAMPLE harus <= LOOKBACK dan
  // <= CANDLE_COUNT - 1, kalau tidak korelasi selalu null (bug versi lama:
  // CANDLE_COUNT 20 -> 19 return, sedangkan MIN_SAMPLE 20).
  CORRELATION_LOOKBACK: 60,
  MIN_CORRELATION_SAMPLE: 30,
};
