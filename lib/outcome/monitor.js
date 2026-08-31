import { getSpotCandles } from "@/lib/bitget/spot";
import { getFuturesCandles } from "@/lib/bitget/futures";
import { OUTCOME_CONFIG } from "./config.js";
import { granularityForHorizon, GRANULARITY_MS, evaluateOutcome } from "./evaluate.js";

// Diekspor ulang supaya import lama (`from "@/lib/outcome/monitor"`) tetap jalan.
export { evaluateOutcome, granularityForHorizon };

/**
 * Mengambil candle HANYA di dalam jendela evaluasi: dari waktu entry sampai
 * horizon habis (atau sampai sekarang, mana yang lebih dulu).
 *
 * Versi lama mengambil "200 candle terakhir lalu buang yang sebelum entry",
 * tanpa batas atas sama sekali. Setup 24 jam yang baru tersentuh worker di hari
 * kelima jadi dinilai atas rentang lima hari: MFE, MAE, dan sentuhan SL semuanya
 * ikut membengkak. Itu penyebab utama Avg MFE/MAE yang tidak masuk akal.
 */
export async function fetchOutcomeCandles({
  market, symbol, entryTimestamp, nowMs, horizonEnd, horizonHours, config = OUTCOME_CONFIG,
}) {
  const windowEnd = Math.min(horizonEnd, nowMs);
  const timeframe = granularityForHorizon(horizonHours);
  const stepMs = GRANULARITY_MS[timeframe] ?? GRANULARITY_MS["1h"];

  const needed = Math.ceil(Math.max(windowEnd - entryTimestamp, stepMs) / stepMs) + 3;
  const limit = Math.min(Math.max(needed, 10), config.MAX_CANDLES_PER_CHECK);

  const params = { startTime: Math.floor(entryTimestamp), endTime: Math.ceil(windowEnd) };

  const request = (extra) =>
    market === "futures"
      ? getFuturesCandles(symbol, timeframe, undefined, limit, extra)
      : getSpotCandles(symbol, timeframe, limit, extra);

  let raw = [];
  try {
    ({ candles: raw } = await request({ params }));
  } catch (err) {
    raw = [];
  }

  // Sebagian pasangan/endpoint tidak menjawab permintaan berjendela. Daripada
  // kehilangan setup, ambil candle terbaru lalu potong sendiri.
  if (!raw || raw.length === 0) {
    ({ candles: raw } = await request({}));
  }

  const candles = (raw || []).filter(
    (c) => Number.isFinite(c.time) && c.time >= entryTimestamp && c.time < windowEnd
  );

  // Data dianggap lengkap kalau candle pertama tidak jauh dari waktu entry.
  // Kalau bolong, hasilnya tidak boleh dianggap final — lebih baik dicek lagi
  // nanti daripada mencatat hasil yang salah.
  const first = candles[0];
  const complete = Boolean(first) && first.time - entryTimestamp <= stepMs * 2;

  return { candles, timeframe, windowEnd, complete, requestedLimit: limit };
}
