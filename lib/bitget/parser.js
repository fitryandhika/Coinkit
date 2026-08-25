function toNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function normalizeTicker(raw, market) {
  if (!raw) return null;

  const price = toNumberOrNull(raw.lastPr);
  const changeRaw = toNumberOrNull(raw.change24h);
  const change24h = changeRaw !== null ? Number((changeRaw * 100).toFixed(4)) : null;

  const base = {
    symbol: raw.symbol || raw.instId || null,
    market,
    price,
    change24h,
    volume24h: toNumberOrNull(raw.quoteVolume),
    high24h: toNumberOrNull(raw.high24h),
    low24h: toNumberOrNull(raw.low24h),
    bid: toNumberOrNull(raw.bidPr),
    ask: toNumberOrNull(raw.askPr),
    timestamp: raw.ts ? Number(raw.ts) : null,
  };

  if (market === "futures") {
    base.fundingRate = toNumberOrNull(raw.fundingRate);
    base.markPrice = toNumberOrNull(raw.markPrice);
    base.indexPrice = toNumberOrNull(raw.indexPrice);
    base.openInterest = toNumberOrNull(raw.holdingAmount);
  }

  return base;
}

export function normalizeCandle(raw) {
  if (!Array.isArray(raw)) return null;
  const [time, open, high, low, close, baseVolume, quoteVolume] = raw;
  return {
    time: toNumberOrNull(time),
    open: toNumberOrNull(open),
    high: toNumberOrNull(high),
    low: toNumberOrNull(low),
    close: toNumberOrNull(close),
    volume: toNumberOrNull(baseVolume),
    quoteVolume: toNumberOrNull(quoteVolume),
  };
}

export function normalizeSpotSymbol(raw) {
  return {
    symbol: raw.symbol,
    base: raw.baseCoin,
    quote: raw.quoteCoin,
    status: raw.status === "online" ? "trading" : raw.status,
  };
}

export function normalizeFuturesSymbol(raw) {
  const rawStatus = (raw.symbolStatus || raw.status || "").toLowerCase();
  return {
    symbol: raw.symbol,
    base: raw.baseCoin,
    quote: raw.quoteCoin,
    status: rawStatus.includes("norm") ? "trading" : raw.symbolStatus || raw.status,
  };
}

export function normalizeOrderBook(raw) {
  if (!raw) return null;
  const mapLevel = ([price, size]) => ({ price: toNumberOrNull(price), size: toNumberOrNull(size) });
  return {
    asks: (raw.asks || []).map(mapLevel),
    bids: (raw.bids || []).map(mapLevel),
    timestamp: raw.ts ? Number(raw.ts) : null,
  };
}
