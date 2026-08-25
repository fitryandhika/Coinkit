export function analyzeVolume(candles) {
  const empty = { currentVolume: null, averageVolume: null, volumeRatio: null, volumeTrend: "UNKNOWN", volumeAcceleration: null };
  if (!candles || candles.length < 3) return empty;

  const volumes = candles.map((c) => c.volume).filter((v) => v !== null);
  if (volumes.length < 3) return empty;

  const currentVolume = volumes[volumes.length - 1];
  const priorVolumes = volumes.slice(0, -1);
  const averageVolume = priorVolumes.reduce((s, v) => s + v, 0) / priorVolumes.length;
  const volumeRatio = averageVolume ? currentVolume / averageVolume : null;

  const prevVolume = volumes[volumes.length - 2];
  const prevPrevVolume = volumes[volumes.length - 3];

  let volumeTrend = "FLAT";
  if (currentVolume > prevVolume) volumeTrend = "INCREASING";
  else if (currentVolume < prevVolume) volumeTrend = "DECREASING";

  const volumeAcceleration =
    prevPrevVolume !== undefined ? currentVolume - prevVolume - (prevVolume - prevPrevVolume) : null;

  return {
    currentVolume,
    averageVolume: Number(averageVolume.toFixed(4)),
    volumeRatio: volumeRatio !== null ? Number(volumeRatio.toFixed(4)) : null,
    volumeTrend,
    volumeAcceleration,
  };
}
