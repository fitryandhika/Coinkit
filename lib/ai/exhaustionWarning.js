import { AI_CONFIG } from "./config";

export function detectExhaustionWarning({ technical, config = AI_CONFIG }) {
  const { indicators, price } = technical;
  const flags = [];

  if (indicators.rsi !== null && (indicators.rsi >= config.EXHAUSTION_RSI_HIGH || indicators.rsi <= config.EXHAUSTION_RSI_LOW)) {
    flags.push("rsi_extreme");
  }
  if (indicators.volume.volumeRatio !== null && indicators.volume.volumeRatio >= config.EXHAUSTION_VOLUME_RATIO) {
    flags.push("volume_spike");
  }
  if (indicators.atrPercent !== null && indicators.atrPercent >= config.EXHAUSTION_ATR_PCT) {
    flags.push("range_expansion");
  }
  if (indicators.ema[20] !== null && price !== null) {
    const deviationPct = Math.abs(((price - indicators.ema[20]) / indicators.ema[20]) * 100);
    if (deviationPct >= config.EXHAUSTION_DEVIATION_PCT) flags.push("far_from_ema");
  }

  return { status: flags.length >= config.EXHAUSTION_MIN_FLAGS ? "EXHAUSTION_WARNING" : "NORMAL", flags };
}
