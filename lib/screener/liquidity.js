export function computeSpreadPct(bid, ask) {
  if (bid === null || ask === null || bid <= 0 || ask <= 0) return null;
  const mid = (bid + ask) / 2;
  if (!mid) return null;
  return Number((((ask - bid) / mid) * 100).toFixed(4));
}

export function describeLiquidity(volume24h, spreadPct, config) {
  if (volume24h === null || volume24h === undefined) return "UNKNOWN";

  const highOk = volume24h >= config.LIQUIDITY_HIGH_MIN_VOLUME &&
    (spreadPct === null || spreadPct <= config.LIQUIDITY_HIGH_MAX_SPREAD_PCT);
  if (highOk) return "HIGH";

  const mediumOk = volume24h >= config.LIQUIDITY_MEDIUM_MIN_VOLUME &&
    (spreadPct === null || spreadPct <= config.LIQUIDITY_MEDIUM_MAX_SPREAD_PCT);
  if (mediumOk) return "MEDIUM";

  return "LOW";
}

export function computeLiquidityScore(volume24h, spreadPct, config) {
  if (volume24h === null || volume24h === undefined) return null;

  const volumeScore = Math.max(
    0,
    Math.min(100, (Math.log10(volume24h + 1) / Math.log10(config.LIQUIDITY_VOLUME_SCALE)) * 100)
  );

  let spreadPenalty = 0;
  if (spreadPct !== null) {
    spreadPenalty = Math.min(40, (spreadPct / config.LIQUIDITY_MAX_ACCEPTABLE_SPREAD_PCT) * 40);
  }

  return Number(Math.max(0, volumeScore - spreadPenalty).toFixed(2));
}
