import { AI_CONFIG } from "./config";

export function validateBreakout({ technical, config = AI_CONFIG }) {
  const { breakout, indicators, structure } = technical;

  if (breakout.status === "UNKNOWN" || breakout.status === "BELOW_RESISTANCE" || breakout.status === "TESTING_RESISTANCE") {
    return "NO_BREAKOUT";
  }
  if (breakout.status === "FAILED_BREAKOUT") return "FAILED_BREAKOUT";

  const volumeRatio = indicators.volume.volumeRatio;
  const strongVolume = volumeRatio !== null && volumeRatio >= config.BREAKOUT_MIN_VOLUME_RATIO;
  const structureAligned = structure.marketStructure === "BULLISH_STRUCTURE" || structure.marketStructure === "BEARISH_STRUCTURE";

  if (breakout.status === "BREAKOUT" || breakout.status === "ABOVE_RESISTANCE") {
    return strongVolume && structureAligned ? "STRONG_BREAKOUT" : "WEAK_BREAKOUT";
  }
  return "NO_BREAKOUT";
}
