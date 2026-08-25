import { RISK_CONFIG } from "../../config/risk.js";

export function estimateLiquidationRisk({ market, direction, entryPrice, leverage, stopLossPrice, config = RISK_CONFIG }) {
  if (market !== "futures" || !leverage || leverage <= 1 || entryPrice === null || stopLossPrice === null) {
    return { liquidationPrice: null, liquidationRisk: market === "futures" ? "UNKNOWN" : "NOT_APPLICABLE", isEstimate: true };
  }

  const mmr = config.ASSUMED_MAINTENANCE_MARGIN_RATE_PCT / 100;
  const marginRatio = 1 / leverage;

  const roughLiquidationPrice =
    direction === "LONG" ? entryPrice * (1 - marginRatio + mmr) : entryPrice * (1 + marginRatio - mmr);

  const liquidationDistance = Math.abs(entryPrice - roughLiquidationPrice);
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  const buffer = liquidationDistance - stopDistance;
  const bufferPct = stopDistance ? (buffer / stopDistance) * 100 : null;

  let liquidationRisk = "OK_ESTIMATE";
  if (buffer <= 0) liquidationRisk = "HIGH_LIQUIDATION_RISK";
  else if (bufferPct !== null && bufferPct < config.LIQUIDATION_WARNING_BUFFER_PCT) liquidationRisk = "ELEVATED_LIQUIDATION_RISK";

  return {
    liquidationPrice: Number(roughLiquidationPrice.toFixed(8)),
    liquidationRisk,
    isEstimate: true,
    assumption: `Estimasi kasar isolated margin dengan asumsi maintenance margin rate ${config.ASSUMED_MAINTENANCE_MARGIN_RATE_PCT}% — bukan data resmi Bitget per-tier.`,
  };
}
