/**
 * Rata-rata pembanding diambil dari `lookback` candle terakhir (default 20),
 * bukan dari seluruh candle yang difetch. Tanpa ini, menaikkan CANDLE_COUNT
 * jadi 150 akan mengubah arti "volume di atas rata-rata" tanpa disadari.
 */
export function computeVolumeRatio(candles, { lookback = 20 } = {}) {
  if (!candles || candles.length < 2) {
    return { volumeRatio: null, currentVolume: null, averageVolume: null };
  }

  const window = candles.slice(-(lookback + 1));
  const volumes = window.map((c) => c.volume).filter((v) => Number.isFinite(v));
  if (volumes.length < 2) {
    return { volumeRatio: null, currentVolume: null, averageVolume: null };
  }

  const currentVolume = volumes[volumes.length - 1];
  const priorVolumes = volumes.slice(0, -1);
  const averageVolume = priorVolumes.reduce((sum, v) => sum + v, 0) / priorVolumes.length;

  if (!averageVolume) {
    return { volumeRatio: null, currentVolume, averageVolume };
  }

  return {
    volumeRatio: Number((currentVolume / averageVolume).toFixed(4)),
    currentVolume,
    averageVolume: Number(averageVolume.toFixed(4)),
  };
}

export function describeVolume(volumeRatio, config) {
  if (volumeRatio === null || volumeRatio === undefined) return "UNKNOWN";
  if (volumeRatio < config.VOLUME_LOW_MAX) return "LOW";
  if (volumeRatio < config.VOLUME_NORMAL_MAX) return "NORMAL";
  if (volumeRatio < config.VOLUME_ELEVATED_MAX) return "ELEVATED";
  return "HIGH";
}

export function computeVolumeScore(volumeRatio, config) {
  if (volumeRatio === null || volumeRatio === undefined) return null;
  const clamp = config.VOLUME_SCORE_CLAMP;
  const bounded = Math.max(0, Math.min(clamp, volumeRatio));
  return Number(((bounded / clamp) * 100).toFixed(2));
}
