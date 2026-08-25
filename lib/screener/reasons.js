export function buildReasons({ timeframe, momentum, momentumLabel, volumeRatio, volumeLabel, liquidityLabel, breakout, exhaustion }) {
  const reasons = [];

  if (momentumLabel === "STRONG_UP" && momentum.m1 !== null) {
    reasons.push(`Strong ${timeframe} momentum (+${momentum.m1.toFixed(2)}%)`);
  } else if (momentumLabel === "MODERATE_UP" && momentum.m1 !== null) {
    reasons.push(`Moderate ${timeframe} momentum (+${momentum.m1.toFixed(2)}%)`);
  }

  if (volumeRatio !== null && volumeLabel === "HIGH") {
    reasons.push(`Volume ${volumeRatio.toFixed(1)}x average`);
  } else if (volumeRatio !== null && volumeLabel === "ELEVATED") {
    reasons.push(`Volume elevated (${volumeRatio.toFixed(1)}x average)`);
  }

  if (liquidityLabel === "HIGH") {
    reasons.push("High liquidity");
  }

  if (breakout?.status === "BREAKOUT") {
    reasons.push("Breakout above recent resistance");
  } else if (breakout?.status === "BREAKOUT_PROXIMITY") {
    reasons.push("Near recent resistance");
  } else if (breakout?.status === "WEAK_BREAKOUT") {
    reasons.push("Breakout above resistance but on weak volume");
  }

  if (exhaustion?.status === "POSSIBLE_EXHAUSTION") {
    reasons.push("Possible exhaustion — price extended from average");
  }

  return reasons;
}
