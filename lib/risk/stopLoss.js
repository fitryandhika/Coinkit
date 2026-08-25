import { RISK_CONFIG } from "../../config/risk.js";

export function resolveStopLoss({ direction, entryPrice, support, resistance, structure, atr, config = RISK_CONFIG }) {
  if (entryPrice === null || entryPrice === undefined) {
    return { price: null, source: "UNKNOWN", distance: null, distancePct: null };
  }

  const candidates = [];

  if (direction === "LONG") {
    const nearestSupport = (support || []).find((level) => level < entryPrice);
    if (nearestSupport !== undefined) candidates.push({ price: nearestSupport, source: "SUPPORT_RESISTANCE" });

    const pivotLows = (structure?.pivotLows || []).filter((p) => p < entryPrice);
    if (pivotLows.length) candidates.push({ price: Math.max(...pivotLows), source: "MARKET_STRUCTURE" });
  } else if (direction === "SHORT") {
    const nearestResistance = (resistance || []).find((level) => level > entryPrice);
    if (nearestResistance !== undefined) candidates.push({ price: nearestResistance, source: "SUPPORT_RESISTANCE" });

    const pivotHighs = (structure?.pivotHighs || []).filter((p) => p > entryPrice);
    if (pivotHighs.length) candidates.push({ price: Math.min(...pivotHighs), source: "MARKET_STRUCTURE" });
  }

  if (atr !== null && atr !== undefined) {
    const atrDistance = atr * config.ATR_MULTIPLIER;
    const atrPrice = direction === "LONG" ? entryPrice - atrDistance : entryPrice + atrDistance;
    candidates.push({ price: atrPrice, source: "ATR" });
  }

  const chosen = candidates.find((c) => Number.isFinite(c.price));
  if (!chosen) return { price: null, source: "UNKNOWN", distance: null, distancePct: null };

  const distance = Math.abs(entryPrice - chosen.price);
  const distancePct = Number(((distance / entryPrice) * 100).toFixed(4));

  if (distancePct > config.MAX_STOP_DISTANCE_PCT) {
    const atrCandidate = candidates.find((c) => c.source === "ATR");
    if (atrCandidate) {
      const atrDistance = Math.abs(entryPrice - atrCandidate.price);
      return {
        price: atrCandidate.price,
        source: "ATR_FALLBACK",
        distance: atrDistance,
        distancePct: Number(((atrDistance / entryPrice) * 100).toFixed(4)),
      };
    }
  }

  return { price: chosen.price, source: chosen.source, distance, distancePct };
}
