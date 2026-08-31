import { RISK_CONFIG } from "../../config/risk.js";

/**
 * Jarak stop minimum yang masih masuk akal untuk sebuah setup.
 *
 * Tiga syarat, diambil yang paling besar:
 *  1. lantai mutlak (MIN_STOP_DISTANCE_PCT);
 *  2. sekian kali ATR — menyesuaikan volatilitas coin;
 *  3. cukup lebar supaya fee round-trip tidak memakan porsi besar dari 1R.
 */
export function minimumStopDistancePct({ entryPrice, atr, market, config = RISK_CONFIG }) {
  const floors = [config.MIN_STOP_DISTANCE_PCT];

  if (Number.isFinite(atr) && atr > 0 && Number.isFinite(entryPrice) && entryPrice > 0) {
    floors.push(((atr * config.MIN_STOP_ATR_MULTIPLIER) / entryPrice) * 100);
  }

  const feePct = config.FEE_ROUNDTRIP_PCT?.[market] ?? config.FEE_ROUNDTRIP_PCT?.futures ?? 0;
  if (feePct > 0 && config.MAX_FEE_SHARE_OF_RISK > 0) {
    floors.push(feePct / config.MAX_FEE_SHARE_OF_RISK);
  }

  return Math.max(...floors);
}

export function resolveStopLoss({
  direction, entryPrice, support, resistance, structure, atr, market = "futures", config = RISK_CONFIG,
}) {
  if (entryPrice === null || entryPrice === undefined) {
    return { price: null, source: "UNKNOWN", distance: null, distancePct: null, widened: false, minDistancePct: null };
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
  if (!chosen) {
    return { price: null, source: "UNKNOWN", distance: null, distancePct: null, widened: false, minDistancePct: null };
  }

  let price = chosen.price;
  let source = chosen.source;
  let distancePct = (Math.abs(entryPrice - price) / entryPrice) * 100;

  // Terlalu jauh -> mundur ke jarak ATR (perilaku lama, tidak diubah).
  if (distancePct > config.MAX_STOP_DISTANCE_PCT) {
    const atrCandidate = candidates.find((c) => c.source === "ATR");
    if (atrCandidate) {
      price = atrCandidate.price;
      source = "ATR_FALLBACK";
      distancePct = (Math.abs(entryPrice - price) / entryPrice) * 100;
    }
  }

  // Terlalu dekat -> stop DILEBARKAN sampai batas minimum. Menaruh SL di dalam
  // noise bukan "risiko kecil", itu cuma kekalahan yang lebih sering dengan
  // porsi fee yang jauh lebih besar.
  const minDistancePct = minimumStopDistancePct({ entryPrice, atr, market, config });
  let widened = false;
  if (distancePct < minDistancePct) {
    const minDistance = (minDistancePct / 100) * entryPrice;
    price = direction === "LONG" ? entryPrice - minDistance : entryPrice + minDistance;
    source = `${source}_WIDENED`;
    distancePct = minDistancePct;
    widened = true;
  }

  const distance = Math.abs(entryPrice - price);

  return {
    price: Number(price.toFixed(8)),
    source,
    distance,
    distancePct: Number(distancePct.toFixed(4)),
    widened,
    minDistancePct: Number(minDistancePct.toFixed(4)),
  };
}
