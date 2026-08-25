import { OUTCOME_CONFIG } from "./config";

export function evaluateWaitOutcome({ referencePrice, candles, config = OUTCOME_CONFIG }) {
  if (!candles || candles.length === 0 || referencePrice === null) {
    return { maximumMovePct: null, direction: null, evaluation: "PENDING" };
  }

  const highs = candles.map((c) => c.high).filter((v) => v !== null);
  const lows = candles.map((c) => c.low).filter((v) => v !== null);
  if (highs.length === 0 || lows.length === 0) return { maximumMovePct: null, direction: null, evaluation: "PENDING" };

  const maxUpPct = Number((((Math.max(...highs) - referencePrice) / referencePrice) * 100).toFixed(4));
  const maxDownPct = Number((((referencePrice - Math.min(...lows)) / referencePrice) * 100).toFixed(4));
  const biggestMove = Math.max(maxUpPct, maxDownPct);
  const direction = maxUpPct >= maxDownPct ? "UP" : "DOWN";

  return { maximumMovePct: biggestMove, direction, evaluation: biggestMove >= config.WAIT_EVALUATION_THRESHOLD_PCT ? "MISSED_OPPORTUNITY" : "CORRECT_WAIT" };
}
