import { SCREENER_CONFIG as DEFAULT_CONFIG } from "./config.js";

function weightedAverage(scores, weights) {
  let totalWeight = 0;
  let totalScore = 0;
  Object.keys(weights).forEach((key) => {
    const score = scores[key];
    if (score === null || score === undefined) return;
    totalScore += score * weights[key];
    totalWeight += weights[key];
  });
  if (totalWeight === 0) return null;
  return Number((totalScore / totalWeight).toFixed(2));
}

export function calculateScreenerScore(scores, penalties = [], config = DEFAULT_CONFIG) {
  const weights = {
    momentumScore: config.MOMENTUM_WEIGHT,
    volumeScore: config.VOLUME_WEIGHT,
    liquidityScore: config.LIQUIDITY_WEIGHT,
    volatilityScore: config.VOLATILITY_WEIGHT,
    breakoutScore: config.BREAKOUT_WEIGHT,
  };

  const rawScore = weightedAverage(scores, weights);
  if (rawScore === null) {
    return { rawScore: null, penalty: 0, finalScore: null };
  }

  const penalty = penalties.reduce((sum, p) => sum + p.amount, 0);
  const finalScore = Math.max(0, Math.min(100, Number((rawScore - penalty).toFixed(2))));

  return { rawScore, penalty, finalScore };
}

export function calculatePenalties(
  { liquidityLabel, spreadPct, volumeLabel, volatilityLabel, exhaustionStatus },
  config = DEFAULT_CONFIG
) {
  const penalties = [];

  if (liquidityLabel === "LOW") penalties.push({ reason: "Low liquidity", amount: config.PENALTY_LOW_LIQUIDITY });
  if (spreadPct !== null && spreadPct !== undefined && spreadPct > config.LIQUIDITY_MAX_ACCEPTABLE_SPREAD_PCT) {
    penalties.push({ reason: "Spread too wide", amount: config.PENALTY_HIGH_SPREAD });
  }
  if (volumeLabel === "LOW") penalties.push({ reason: "Volume too low", amount: config.PENALTY_LOW_VOLUME });
  if (volatilityLabel === "EXTREME") {
    penalties.push({ reason: "Extreme volatility", amount: config.PENALTY_EXTREME_VOLATILITY });
  }
  if (exhaustionStatus === "POSSIBLE_EXHAUSTION") {
    penalties.push({ reason: "Possible exhaustion", amount: config.PENALTY_POSSIBLE_EXHAUSTION });
  }

  return penalties;
}
