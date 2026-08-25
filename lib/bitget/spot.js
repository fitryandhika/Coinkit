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

  const { data, ...meta } = await bitgetGet(
    "/api/v2/spot/market/candles",
    { symbol, granularity, limit },
    {
      cacheKey: `spot:candles:${symbol}:${timeframe}`,
      minIntervalMs: CANDLE_CACHE_MS[timeframe] ?? 30000,
      ...extraOptions,
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
