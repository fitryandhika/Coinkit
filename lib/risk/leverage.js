export function resolveLeverage({ market, requestedLeverage, profileMaxLeverage }) {
  if (market !== "futures") return { leverage: null, recommendedMaximum: null, exceedsMax: false };

  const leverage = requestedLeverage ?? Math.min(2, profileMaxLeverage);
  return { leverage, recommendedMaximum: profileMaxLeverage, exceedsMax: leverage > profileMaxLeverage };
}

export function estimateRequiredMargin({ notional, leverage }) {
  if (notional === null || !leverage || leverage <= 0) return null;
  return Number((notional / leverage).toFixed(8));
}
