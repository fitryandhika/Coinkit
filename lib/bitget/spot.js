import { bitgetGet } from "./client";
import { SPOT_GRANULARITY_MAP, CANDLE_CACHE_MS } from "./constants";
import { normalizeTicker, normalizeCandle, normalizeSpotSymbol, normalizeOrderBook } from "./parser";

export async function getSpotSymbols() {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/spot/public/symbols",
    {},
    { cacheKey: "spot:symbols", minIntervalMs: 60000 }
  );
  return { symbols: (data || []).map(normalizeSpotSymbol), ...meta };
}

export async function getSpotTickers(symbol) {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/spot/market/tickers",
    { symbol },
    { cacheKey: `spot:tickers:${symbol || "all"}` }
  );
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { tickers: list.map((item) => normalizeTicker(item, "spot")), ...meta };
}

export async function getSpotCandles(symbol, timeframe, limit = 100, extraOptions = {}) {
  const granularity = SPOT_GRANULARITY_MAP[timeframe];
  if (!granularity) throw new Error(`Timeframe tidak didukung untuk spot: ${timeframe}`);

  // `params` dipakai worker outcome untuk meminta JENDELA WAKTU tertentu
  // (startTime/endTime). Kunci cache WAJIB ikut berubah — kalau tidak, permintaan
  // jendela historis akan dijawab dengan candle terbaru dari cache dan hasil
  // evaluasi jadi salah total.
  const { params: extraParams = {}, ...requestOptions } = extraOptions;
  const windowKey =
    extraParams.startTime || extraParams.endTime
      ? `:w${extraParams.startTime ?? ""}-${extraParams.endTime ?? ""}-${limit}`
      : "";

  const { data, ...meta } = await bitgetGet(
    "/api/v2/spot/market/candles",
    { symbol, granularity, limit, ...extraParams },
    {
      cacheKey: `spot:candles:${symbol}:${timeframe}${windowKey}`,
      minIntervalMs: CANDLE_CACHE_MS[timeframe] ?? 30000,
      ...requestOptions,
    }
  );
  const candles = (data || []).map(normalizeCandle).sort((a, b) => a.time - b.time);
  return { candles, ...meta };
}

export async function getSpotOrderBook(symbol, limit = 50) {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/spot/market/orderbook",
    { symbol, type: "step0", limit },
    { cacheKey: `spot:orderbook:${symbol}` }
  );
  return { orderBook: normalizeOrderBook(data), ...meta };
}
