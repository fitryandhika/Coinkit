export function detectDecisionConflicts({ technical }) {
  const conflicts = [];
  const { trend, multiTimeframe, conflicts: technicalConflicts } = technical;

  const shortBullish = trend.shortTerm === "BULLISH" || trend.shortTerm === "WEAK_BULLISH";
  const shortBearish = trend.shortTerm === "BEARISH" || trend.shortTerm === "WEAK_BEARISH";
  const longBullish = trend.longTerm === "BULLISH" || trend.longTerm === "WEAK_BULLISH";
  const longBearish = trend.longTerm === "BEARISH" || trend.longTerm === "WEAK_BEARISH";

  if (shortBullish && longBearish) {
    conflicts.push({ type: "TIMEFRAME_CONFLICT", reason: "Short-term momentum is bullish while the higher timeframe remains bearish." });
  } else if (shortBearish && longBullish) {
    conflicts.push({ type: "TIMEFRAME_CONFLICT", reason: "Short-term momentum is bearish while the higher timeframe remains bullish." });
  }

  if (multiTimeframe?.alignment === "LOW") {
    conflicts.push({ type: "MULTI_TIMEFRAME_CONFLICT", reason: "Multi-timeframe alignment is low across 5m/1h/4h." });
  }

  (technicalConflicts || []).forEach((c) => conflicts.push({ type: "INDICATOR_CONFLICT", reason: c }));

  return conflicts;
}
