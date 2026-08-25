import { resolveStopLoss } from "../risk/stopLoss.js";
import { resolveTakeProfit } from "../risk/takeProfit.js";

/**
 * Arah disimpulkan dari momentum + posisi breakout yang SUDAH dihitung screener —
 * bukan model baru, murni kombinasi angka yang ada.
 */
export function inferDirection({ momentumLabel, breakoutStatus }) {
  const bullishSignals =
    ["STRONG_UP", "MODERATE_UP"].includes(momentumLabel) ||
    ["BREAKOUT", "BREAKOUT_PROXIMITY"].includes(breakoutStatus);
  const bearishSignals = ["STRONG_DOWN", "MODERATE_DOWN"].includes(momentumLabel);

  if (bullishSignals && !bearishSignals) return "BULLISH";
  if (bearishSignals && !bullishSignals) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Untuk SPOT, arah BEARISH tidak menghasilkan level entry baru (spot tidak bisa short) —
 * hanya peringatan untuk pertimbangkan keluar/kurangi posisi yang sudah ada.
 */
export function buildTradeIdea({ price, direction, market, support, resistance, structure, atr }) {
  if (direction === "NEUTRAL" || price === null) {
    return { entry: null, stopLoss: null, takeProfit: null, reason: "Arah belum jelas — sinyal momentum dan breakout tidak sejalan." };
  }

  if (market === "spot" && direction === "BEARISH") {
    return {
      entry: null, stopLoss: null, takeProfit: null,
      reason: "Momentum melemah — bukan level entry baru, pertimbangkan kurangi/keluar dari posisi yang sudah ada.",
    };
  }

  const workingDirection = direction === "BULLISH" ? "LONG" : "SHORT";
  const sl = resolveStopLoss({ direction: workingDirection, entryPrice: price, support, resistance, structure, atr });
  const tp = resolveTakeProfit({ direction: workingDirection, entryPrice: price, stopLossPrice: sl.price, support, resistance });

  return {
    entry: price,
    stopLoss: sl,
    takeProfit: tp,
    supportUsed: support,
    resistanceUsed: resistance,
  };
}
