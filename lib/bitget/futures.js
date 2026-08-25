import { bitgetGet } from "./client";
import { FUTURES_GRANULARITY_MAP, CANDLE_CACHE_MS, PRODUCT_TYPE } from "./constants";
import { normalizeTicker, normalizeCandle, normalizeFuturesSymbol, normalizeOrderBook } from "./parser";

export async function getFuturesSymbols(productType = PRODUCT_TYPE.usdtFutures) {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/mix/market/contracts",
    { productType },
    { cacheKey: `futures:symbols:${productType}`, minIntervalMs: 60000 }
  );
  return { symbols: (data || []).map(normalizeFuturesSymbol), ...meta };
}

export async function getFuturesTickers(symbol, productType = PRODUCT_TYPE.usdtFutures) {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/mix/market/tickers",
    { symbol, productType },
    { cacheKey: `futures:tickers:${productType}:${symbol || "all"}` }
  );
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { tickers: list.map((item) => normalizeTicker(item, "futures")), ...meta };
}

export async function getFuturesCandles(symbol, timeframe, productType = PRODUCT_TYPE.usdtFutures, limit = 100, extraOptions = {}) {
  const granularity = FUTURES_GRANULARITY_MAP[timeframe];
  if (!granularity) throw new Error(`Timeframe tidak didukung untuk futures: ${timeframe}`);

  const { data, ...meta } = await bitgetGet(
    "/api/v2/mix/market/candles",
    { symbol, granularity, productType, limit },
    {
      cacheKey: `futures:candles:${productType}:${symbol}:${timeframe}`,
      minIntervalMs: CANDLE_CACHE_MS[timeframe] ?? 30000,
      ...extraOptions,
    }
  );
  const candles = (data || []).map(normalizeCandle).sort((a, b) => a.time - b.time);
  return { candles, ...meta };
}

export async function getFuturesOrderBook(symbol, productType = PRODUCT_TYPE.usdtFutures, limit = 50) {
  const { data, ...meta } = await bitgetGet(
    "/api/v2/mix/market/orderbook",
    { symbol, productType, limit },
    { cacheKey: `futures:orderbook:${productType}:${symbol}` }
  );
  return { orderBook: normalizeOrderBook(data), ...meta };
}
