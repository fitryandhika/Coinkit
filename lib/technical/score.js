import { TECHNICAL_CONFIG as DEFAULT_CONFIG } from "./config";

function weightedAverage(scores, weights) {
  let totalWeight = 0;
  let totalScore = 0;
  Object.keys(weights).forEach((key) => {
    const score = scores[key];
    if (score === null || score === undefined) return;
    totalScore += score * weights[key];
    totalWeight += weights[key];
  });
  return totalWeight === 0 ? null : Number((totalScore / totalWeight).toFixed(2));
}

function trendDirection(label) {
  if (label === "BULLISH" || label === "WEAK_BULLISH") return "UP";
  if (label === "BEARISH" || label === "WEAK_BEARISH") return "DOWN";
  if (label === "NEUTRAL") return "FLAT";
  return null;
}

export function computeTrendScore(trend, adxValue) {
  const directions = [trend.shortTerm, trend.mediumTerm, trend.longTerm].map(trendDirection);
  const known = directions.filter((d) => d !== null);
  if (known.length === 0) return null;

  const upCount = known.filter((d) => d === "UP").length;
  const downCount = known.filter((d) => d === "DOWN").length;
  const agreementRatio = Math.max(upCount, downCount) / known.length;
  const adxComponent = adxValue !== null && adxValue !== undefined ? Math.min(100, (adxValue / 40) * 100) : 50;

  return Number((agreementRatio * 100 * 0.6 + adxComponent * 0.4).toFixed(2));
}

export function computeMomentumScore(rsiValue, macdState) {
  if (rsiValue === null && (!macdState || macdState === "UNKNOWN")) return null;
  const rsiStrength = rsiValue !== null ? (Math.abs(rsiValue - 50) / 50) * 100 : 50;
  const macdBonus = macdState === "BULLISH_MOMENTUM" || macdState === "BEARISH_MOMENTUM" ? 15 : 0;
  return Number(Math.min(100, rsiStrength + macdBonus).toFixed(2));
}

export function computeVolumeScore(volumeRatio, config = DEFAULT_CONFIG) {
  if (volumeRatio === null || volumeRatio === undefined) return null;
  const bounded = Math.max(0, Math.min(config.VOLUME_SCORE_CLAMP, volumeRatio));
  return Number(((bounded / config.VOLUME_SCORE_CLAMP) * 100).toFixed(2));
}

export function computeVolatilityScore(atrPercent, config = DEFAULT_CONFIG) {
  if (atrPercent === null || atrPercent === undefined) return null;
  const distance = Math.abs(atrPercent - config.VOLATILITY_IDEAL_PCT);
  return Number(Math.max(0, 100 - (distance / config.VOLATILITY_SCORE_SPREAD) * 100).toFixed(2));
}

export function computeStructureScore(marketStructure) {
  const map = { BULLISH_STRUCTURE: 80, BEARISH_STRUCTURE: 80, RANGE: 50, UNCLEAR: null };
  return map[marketStructure] ?? null;
}

export function calculateTechnicalScore(scores, config = DEFAULT_CONFIG) {
  const weights = {
    trendScore: config.TREND_WEIGHT,
    momentumScore: config.MOMENTUM_WEIGHT,
    volumeScore: config.VOLUME_WEIGHT,
    volatilityScore: config.VOLATILITY_WEIGHT,
    structureScore: config.STRUCTURE_WEIGHT,
  };
  return weightedAverage(scores, weights);
}

export function detectConflicts({ trend, rsiLabel, macdState, marketStructure }) {
  const conflicts = [];
  let agreementPoints = 0;
  let totalPoints = 0;

  const higherTfBullish = trend.longTerm === "BULLISH" || trend.longTerm === "WEAK_BULLISH";
  const higherTfBearish = trend.longTerm === "BEARISH" || trend.longTerm === "WEAK_BEARISH";

  if (rsiLabel && rsiLabel !== "UNKNOWN") {
    totalPoints += 1;
    const rsiBullish = rsiLabel === "STRONG" || rsiLabel === "OVERBOUGHT";
    const rsiBearish = rsiLabel === "WEAK" || rsiLabel === "OVERSOLD";
    if (rsiBullish && higherTfBearish) conflicts.push("Momentum (RSI) bullish but higher timeframe trend bearish");
    else if (rsiBearish && higherTfBullish) conflicts.push("Momentum (RSI) bearish but higher timeframe trend bullish");
    else agreementPoints += 1;
  }

  if (macdState && macdState !== "UNKNOWN") {
    totalPoints += 1;
    if (macdState === "BULLISH_MOMENTUM" && higherTfBearish) conflicts.push("MACD bullish but higher timeframe trend bearish");
    else if (macdState === "BEARISH_MOMENTUM" && higherTfBullish) conflicts.push("MACD bearish but higher timeframe trend bullish");
    else agreementPoints += 1;
  }

  if (marketStructure && marketStructure !== "UNCLEAR") {
    totalPoints += 1;
    if (marketStructure === "BULLISH_STRUCTURE" && higherTfBearish) conflicts.push("Market structure bullish but higher timeframe trend bearish");
    else if (marketStructure === "BEARISH_STRUCTURE" && higherTfBullish) conflicts.push("Market structure bearish but higher timeframe trend bullish");
    else agreementPoints += 1;
  }

  const agreement = totalPoints > 0 ? Number(((agreementPoints / totalPoints) * 100).toFixed(2)) : null;
  return { agreement, conflicts };
}
