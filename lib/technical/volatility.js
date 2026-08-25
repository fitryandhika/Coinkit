export function classifyATR(atrPercent) {
  if (atrPercent === null || atrPercent === undefined) return "UNKNOWN";
  if (atrPercent < 0.5) return "LOW";
  if (atrPercent < 2) return "NORMAL";
  if (atrPercent < 5) return "HIGH";
  return "EXTREME";
}

export function analyzeBollinger({ price, upper, middle, lower }) {
  if (price === null || upper === null || middle === null || lower === null) {
    return { width: null, percentB: null, position: "UNKNOWN" };
  }

  const width = middle ? ((upper - lower) / middle) * 100 : null;
  const percentB = upper !== lower ? ((price - lower) / (upper - lower)) * 100 : null;

  let position = "MIDDLE";
  if (percentB !== null) {
    if (percentB >= 90) position = "NEAR_UPPER_BAND";
    else if (percentB <= 10) position = "NEAR_LOWER_BAND";
  }

  return {
    width: width !== null ? Number(width.toFixed(4)) : null,
    percentB: percentB !== null ? Number(percentB.toFixed(2)) : null,
    position,
  };
}

export function classifyBandWidth(width, prevWidth) {
  if (width === null || prevWidth === null || prevWidth === undefined) return "UNKNOWN";
  if (width > prevWidth * 1.05) return "EXPANSION";
  if (width < prevWidth * 0.95) return "CONTRACTION";
  return "STABLE";
}
