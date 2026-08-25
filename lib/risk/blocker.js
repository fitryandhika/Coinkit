export function evaluateBlockers({
  liquidityLabel,
  spreadPct,
  stopDistancePct,
  riskReward,
  minRiskReward,
  currentPortfolioRiskPercent,
  newTradeRiskPercent,
  maxPortfolioRiskPercent,
  leverage,
  maxLeverage,
  liquidationRisk,
  dataQuality,
  config,
}) {
  const blockers = [];
  const warnings = [];

  if (!dataQuality || dataQuality === "INSUFFICIENT_DATA") blockers.push("Data tidak cukup untuk membangun trade plan.");

  if (liquidityLabel === "LOW") blockers.push("Liquidity terlalu rendah.");
  else if (liquidityLabel === "UNKNOWN") warnings.push("Liquidity tidak diketahui.");

  if (spreadPct !== null && spreadPct !== undefined && spreadPct > config.MAX_SPREAD_PCT) blockers.push("Spread terlalu besar.");

  if (stopDistancePct !== null && stopDistancePct > config.MAX_STOP_DISTANCE_PCT) blockers.push("Stop loss terlalu jauh dari entry.");

  if (riskReward !== null && riskReward !== undefined && minRiskReward && riskReward < minRiskReward) {
    blockers.push("Risk/reward terlalu rendah.");
  }

  if (
    currentPortfolioRiskPercent !== null &&
    newTradeRiskPercent !== null &&
    maxPortfolioRiskPercent !== null &&
    currentPortfolioRiskPercent + newTradeRiskPercent > maxPortfolioRiskPercent
  ) {
    blockers.push("Portfolio risk limit exceeded.");
  }

  if (leverage !== null && maxLeverage !== null && leverage > maxLeverage) blockers.push("Leverage melebihi batas maksimum profil.");

  if (liquidationRisk === "HIGH_LIQUIDATION_RISK") {
    blockers.push("Liquidation risk terlalu tinggi (estimasi liquidation lebih dekat dari stop loss).");
  } else if (liquidationRisk === "ELEVATED_LIQUIDATION_RISK") {
    warnings.push("Jarak liquidation (estimasi) ke stop loss cukup tipis.");
  }

  const status = blockers.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "PASS";
  return { status, blockedReasons: blockers, warnings };
}
