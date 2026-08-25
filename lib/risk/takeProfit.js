import { RISK_CONFIG } from "../../config/risk.js";

export function resolveTakeProfit({ direction, entryPrice, stopLossPrice, support, resistance, config = RISK_CONFIG }) {
  if (entryPrice === null || stopLossPrice === null || entryPrice === undefined || stopLossPrice === undefined) {
    return { tp1: null, tp2: null, tp3: null, source: "UNKNOWN" };
  }

  const riskDistance = Math.abs(entryPrice - stopLossPrice);
  const levels =
    direction === "LONG"
      ? (resistance || []).filter((level) => level > entryPrice).sort((a, b) => a - b)
      : (support || []).filter((level) => level < entryPrice).sort((a, b) => b - a);

  const rrFallback = (multiplier) =>
    direction === "LONG" ? entryPrice + riskDistance * multiplier : entryPrice - riskDistance * multiplier;

  const tp1 = levels[0] ?? rrFallback(config.DEFAULT_TP_RR_MULTIPLIERS[0]);
  const tp2 = levels[1] ?? rrFallback(config.DEFAULT_TP_RR_MULTIPLIERS[1]);
  const tp3 = levels[2] ?? rrFallback(config.DEFAULT_TP_RR_MULTIPLIERS[2]);

  return {
    tp1: Number(tp1.toFixed(8)),
    tp2: Number(tp2.toFixed(8)),
    tp3: Number(tp3.toFixed(8)),
    source: levels.length >= 3 ? "SUPPORT_RESISTANCE" : levels.length > 0 ? "MIXED" : "RISK_REWARD",
  };
}
