const EMPTY = {
  status: "UNKNOWN",
  bias: "NEUTRAL",
  breakoutScore: null,
  previousHigh: null,
  previousLow: null,
  proximityPct: null,
  upProximityPct: null,
  downProximityPct: null,
  volumeRatio: null,
  lookback: null,
};

/**
 * Versi lama hanya menghitung previousHigh -> tidak ada konsep breakdown sama
 * sekali, sehingga coin yang jebol support tetap berstatus "NORMAL". Sekarang
 * kedua sisi dihitung dan hasilnya membawa `bias` (UP / DOWN / NEUTRAL).
 *
 * Jendela swing memakai BREAKOUT_LOOKBACK, bukan seluruh candle yang difetch —
 * kalau tidak, menaikkan CANDLE_COUNT membuat "previous high" jadi high 150 bar
 * dan breakout praktis tidak pernah terjadi.
 */
export function computeStructureBreak(candles, config) {
  const lookback = config?.BREAKOUT_LOOKBACK ?? 40;
  if (!candles || candles.length < 5) return { ...EMPTY };

  const window = candles.slice(-(lookback + 1));
  if (window.length < 3) return { ...EMPTY };

  const prior = window.slice(0, -1);
  const current = window[window.length - 1];

  const highs = prior.map((c) => c.high).filter((v) => Number.isFinite(v));
  const lows = prior.map((c) => c.low).filter((v) => Number.isFinite(v));
  const previousHigh = highs.length ? Math.max(...highs) : null;
  const previousLow = lows.length ? Math.min(...lows) : null;

  if (!Number.isFinite(previousHigh) || !Number.isFinite(previousLow) || !Number.isFinite(current.close)) {
    return { ...EMPTY, lookback: prior.length };
  }

  // >= 0 artinya sudah tembus. Nilai negatif = jarak menuju level tersebut.
  const upProximityPct = ((current.close - previousHigh) / previousHigh) * 100;
  const downProximityPct = ((previousLow - current.close) / previousLow) * 100;

  const priorVolumes = prior.map((c) => c.volume).filter((v) => Number.isFinite(v));
  const avgVolume = priorVolumes.length ? priorVolumes.reduce((s, v) => s + v, 0) / priorVolumes.length : null;
  const volumeRatio = Number.isFinite(current.volume) && avgVolume ? current.volume / avgVolume : null;

  const volumeConfirmed = volumeRatio === null || volumeRatio >= config.BREAKOUT_MIN_VOLUME_RATIO;
  const proximityLimit = config.BREAKOUT_PROXIMITY_PCT;

  let status = "NORMAL";
  let bias = "NEUTRAL";

  if (upProximityPct >= 0) {
    status = volumeConfirmed ? "BREAKOUT" : "WEAK_BREAKOUT";
    bias = "UP";
  } else if (downProximityPct >= 0) {
    status = volumeConfirmed ? "BREAKDOWN" : "WEAK_BREAKDOWN";
    bias = "DOWN";
  } else if (upProximityPct >= -proximityLimit) {
    status = "BREAKOUT_PROXIMITY";
    bias = "UP";
  } else if (downProximityPct >= -proximityLimit) {
    status = "BREAKDOWN_PROXIMITY";
    bias = "DOWN";
  }

  return {
    status,
    bias,
    previousHigh: Number(previousHigh.toFixed(8)),
    previousLow: Number(previousLow.toFixed(8)),
    upProximityPct: Number(upProximityPct.toFixed(4)),
    downProximityPct: Number(downProximityPct.toFixed(4)),
    // proximityPct = jarak ke level yang relevan dengan bias saat ini
    proximityPct: Number((bias === "DOWN" ? downProximityPct : upProximityPct).toFixed(4)),
    volumeRatio: volumeRatio === null ? null : Number(volumeRatio.toFixed(4)),
    lookback: prior.length,
    breakoutScore: null, // diisi computeStructureBreakScore() setelah arah diketahui
  };
}

const BASE_SCORE = {
  BREAKOUT: 100,
  BREAKDOWN: 100,
  BREAKOUT_PROXIMITY: 75,
  BREAKDOWN_PROXIMITY: 75,
  WEAK_BREAKOUT: 60,
  WEAK_BREAKDOWN: 60,
  NORMAL: 40,
};

/**
 * Skor struktur juga relatif terhadap arah setup: breakout yang mendukung LONG
 * bernilai 100, tapi breakout yang terjadi saat kita mencari SHORT justru
 * sinyal buruk (0), bukan sekadar "netral".
 */
export function computeStructureBreakScore(structureBreak, direction) {
  const base = BASE_SCORE[structureBreak?.status];
  if (base === undefined) return null;
  if (structureBreak.bias === "NEUTRAL") return base;
  if (direction !== "BULLISH" && direction !== "BEARISH") return BASE_SCORE.NORMAL;

  const aligned =
    (direction === "BULLISH" && structureBreak.bias === "UP") ||
    (direction === "BEARISH" && structureBreak.bias === "DOWN");

  if (aligned) return base;
  return base >= 60 ? Number((100 - base).toFixed(2)) : BASE_SCORE.NORMAL;
}

/** Alias kompatibilitas untuk kode lama yang masih mengimpor computeBreakout. */
export const computeBreakout = computeStructureBreak;
