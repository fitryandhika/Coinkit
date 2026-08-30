export function buildReasons({ timeframe, momentum, momentumRate, momentumLabel, volumeRatio, volumeLabel, liquidityLabel, breakout, exhaustion }) {
  const reasons = [];
  const rate = momentumRate?.rate ?? null;
  const shownMomentum = Number.isFinite(rate) ? rate : momentum?.m1;

  if (Number.isFinite(shownMomentum)) {
    const pct = `${shownMomentum > 0 ? "+" : ""}${shownMomentum.toFixed(2)}%`;
    if (momentumLabel === "STRONG_UP") reasons.push(`Momentum ${timeframe} naik kuat (${pct}/candle)`);
    else if (momentumLabel === "MODERATE_UP") reasons.push(`Momentum ${timeframe} naik moderat (${pct}/candle)`);
    else if (momentumLabel === "STRONG_DOWN") reasons.push(`Momentum ${timeframe} turun kuat (${pct}/candle)`);
    else if (momentumLabel === "MODERATE_DOWN") reasons.push(`Momentum ${timeframe} turun moderat (${pct}/candle)`);
  }

  if (momentumRate?.aligned) {
    reasons.push(
      momentumRate.alignedDirection === "UP"
        ? "Momentum konsisten naik di 1/3/6 candle terakhir"
        : "Momentum konsisten turun di 1/3/6 candle terakhir"
    );
  }

  if (volumeRatio !== null && volumeLabel === "HIGH") {
    reasons.push(`Volume ${volumeRatio.toFixed(1)}x rata-rata`);
  } else if (volumeRatio !== null && volumeLabel === "ELEVATED") {
    reasons.push(`Volume di atas normal (${volumeRatio.toFixed(1)}x rata-rata)`);
  }

  if (liquidityLabel === "HIGH") reasons.push("Likuiditas tinggi");

  switch (breakout?.status) {
    case "BREAKOUT":
      reasons.push(`Breakout di atas high ${breakout.lookback ?? ""} candle terakhir`.replace("  ", " "));
      break;
    case "WEAK_BREAKOUT":
      reasons.push("Breakout ke atas tapi volume belum konfirmasi");
      break;
    case "BREAKOUT_PROXIMITY":
      reasons.push("Menempel di resistance jangka pendek");
      break;
    case "BREAKDOWN":
      reasons.push(`Breakdown di bawah low ${breakout.lookback ?? ""} candle terakhir`.replace("  ", " "));
      break;
    case "WEAK_BREAKDOWN":
      reasons.push("Breakdown ke bawah tapi volume belum konfirmasi");
      break;
    case "BREAKDOWN_PROXIMITY":
      reasons.push("Menempel di support jangka pendek");
      break;
    default:
      break;
  }

  if (exhaustion?.status === "POSSIBLE_EXHAUSTION") {
    reasons.push("Kemungkinan exhaustion — harga sudah jauh dari rata-rata");
  }

  return reasons;
}
