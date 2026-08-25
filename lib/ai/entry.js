import { AI_CONFIG } from "./config";

export function resolveEntry({ direction, technical, breakoutValidation, pullback, config = AI_CONFIG }) {
  const price = technical.price;
  if (price === null) return { status: "WAIT_FOR_CONFIRMATION", reason: "Price data unavailable.", zone: null, basis: null };

  const zoneAround = (p) => ({
    low: Number((p * (1 - config.ENTRY_ZONE_PCT / 100)).toFixed(8)),
    high: Number((p * (1 + config.ENTRY_ZONE_PCT / 100)).toFixed(8)),
  });

  if (breakoutValidation === "STRONG_BREAKOUT") return { status: "READY", zone: zoneAround(price), basis: "BREAKOUT" };
  if (breakoutValidation === "WEAK_BREAKOUT") {
    return { status: "WAIT_FOR_CONFIRMATION", reason: "Wait for candle close above resistance with stronger volume.", zone: null, basis: "BREAKOUT" };
  }

  if (pullback.pullbackCandidate && pullback.direction === direction) {
    return { status: "READY", zone: zoneAround(price), basis: "PULLBACK" };
  }

  const trendMatches = direction === "LONG" ? technical.trend.mediumTerm === "BULLISH" : technical.trend.mediumTerm === "BEARISH";
  if (trendMatches) return { status: "READY", zone: zoneAround(price), basis: "TREND_CONTINUATION" };

  return { status: "WAIT_FOR_CONFIRMATION", reason: "No clear entry structure detected yet.", zone: null, basis: null };
}
