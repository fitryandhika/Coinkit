import { RISK_CONFIG } from "../../config/risk.js";

function normalize(value, max) {
  if (value === null || value === undefined) return null;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function calculateRiskScore(
  { atrPercent, liquidityLabel, spreadPct, stopDistancePct, leverage, maxLeverage, fundingStatus, liquidationRisk },
  config = RISK_CONFIG
) {
  const scores = {};

  scores.volatility = normalize(atrPercent, 5);
  scores.liquidity = { HIGH: 10, MEDIUM: 40, LOW: 80, UNKNOWN: null }[liquidityLabel] ?? null;
  scores.spread = normalize(spreadPct, config.MAX_SPREAD_PCT * 2);
  scores.stopDistance = normalize(stopDistancePct, config.MAX_STOP_DISTANCE_PCT);
  scores.leverage = leverage && maxLeverage ? normalize(leverage, maxLeverage) : null;
  scores.funding = { NORMAL: 10, ELEVATED: 50, EXTREME: 90, UNKNOWN: null }[fundingStatus] ?? null;
  scores.liquidationDistance =
    { OK_ESTIMATE: 10, ELEVATED_LIQUIDATION_RISK: 60, HIGH_LIQUIDATION_RISK: 95, UNKNOWN: null, NOT_APPLICABLE: null }[liquidationRisk] ?? null;

  let totalWeight = 0;
  let totalScore = 0;
  Object.entries(config.RISK_SCORE_WEIGHTS).forEach(([key, weight]) => {
    const score = scores[key];
    if (score === null || score === undefined) return;
    totalScore += score * weight;
    totalWeight += weight;
  });

  const riskScore = totalWeight > 0 ? Number((totalScore / totalWeight).toFixed(2)) : null;

  let riskLevel = "UNKNOWN";
  if (riskScore !== null) {
    if (riskScore < config.RISK_LEVEL_THRESHOLDS.LOW) riskLevel = "LOW";
    else if (riskScore < config.RISK_LEVEL_THRESHOLDS.MODERATE) riskLevel = "MODERATE";
    else if (riskScore < config.RISK_LEVEL_THRESHOLDS.HIGH) riskLevel = "HIGH";
    else riskLevel = "EXTREME";
  }

  return { riskScore, riskLevel, breakdown: scores };
}
