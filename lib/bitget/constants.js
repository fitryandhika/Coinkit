export const PRODUCT_TYPE = {
  usdtFutures: "usdt-futures",
};

export const TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];

export const SPOT_GRANULARITY_MAP = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

export const FUTURES_GRANULARITY_MAP = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

export const CANDLE_CACHE_MS = {
  "5m": 15000,
  "15m": 30000,
  "1h": 60000,
  "4h": 120000,
  "1d": 300000,
};
