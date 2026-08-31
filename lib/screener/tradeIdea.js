import { resolveStopLoss } from "../risk/stopLoss.js";
import { resolveTakeProfit } from "../risk/takeProfit.js";

/**
 * Arah disimpulkan dari momentum + struktur (breakout ATAU breakdown) yang
 * SUDAH dihitung screener — bukan model baru, murni kombinasi angka yang ada.
 *
 * Perbedaan dengan versi lama: sisi bearish sekarang punya pemicu struktur
 * sendiri (breakdown), tidak hanya mengandalkan momentum turun.
 */
export function inferDirection({ momentumLabel, breakoutStatus, structureBias }) {
  const momentumUp = ["STRONG_UP", "MODERATE_UP"].includes(momentumLabel);
  const momentumDown = ["STRONG_DOWN", "MODERATE_DOWN"].includes(momentumLabel);

  const structureUp =
    structureBias === "UP" ||
    ["BREAKOUT", "WEAK_BREAKOUT", "BREAKOUT_PROXIMITY"].includes(breakoutStatus);
  const structureDown =
    structureBias === "DOWN" ||
    ["BREAKDOWN", "WEAK_BREAKDOWN", "BREAKDOWN_PROXIMITY"].includes(breakoutStatus);

  const bullish = momentumUp || structureUp;
  const bearish = momentumDown || structureDown;

  if (bullish && !bearish) return "BULLISH";
  if (bearish && !bullish) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Untuk SPOT, arah BEARISH tidak menghasilkan level entry baru (spot tidak bisa short) —
 * hanya peringatan untuk pertimbangkan keluar/kurangi posisi yang sudah ada.
 */
export function buildTradeIdea({ price, direction, market, support, resistance, structure, atr }) {
  if (direction === "NEUTRAL" || price === null) {
    return { entry: null, stopLoss: null, takeProfit: null, reason: "Arah belum jelas — sinyal momentum dan struktur tidak sejalan." };
  }

  if (market === "spot" && direction === "BEARISH") {
    return {
      entry: null, stopLoss: null, takeProfit: null,
      reason: "Momentum melemah — bukan level entry baru, pertimbangkan kurangi/keluar dari posisi yang sudah ada.",
    };
  }

  const workingDirection = direction === "BULLISH" ? "LONG" : "SHORT";
  // `market` ikut dikirim supaya batas stop minimum memakai asumsi fee yang benar
  // (fee spot 0.2% round-trip vs futures 0.12%).
  const sl = resolveStopLoss({ direction: workingDirection, entryPrice: price, support, resistance, structure, atr, market });
  const tp = resolveTakeProfit({ direction: workingDirection, entryPrice: price, stopLossPrice: sl.price, support, resistance });

  return {
    entry: price,
    stopLoss: sl,
    takeProfit: tp,
    supportUsed: support,
    resistanceUsed: resistance,
  };
}
