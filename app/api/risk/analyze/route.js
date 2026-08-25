import { NextResponse } from "next/server";
import { getSpotTickers } from "@/lib/bitget/spot";
import { getFuturesTickers } from "@/lib/bitget/futures";
import { getTechnicalReport } from "@/lib/technical/analyzer";
import { buildTradePlan } from "@/lib/risk/tradePlan";
import { RISK_CONFIG } from "@/config/risk";

export const maxDuration = 30;

function computeSpreadAndLiquidity(ticker) {
  if (!ticker) return { spreadPct: null, liquidityLabel: "UNKNOWN" };
  const { bid, ask, volume24h } = ticker;
  const spreadPct = bid && ask && bid > 0 ? Number((((ask - bid) / ((ask + bid) / 2)) * 100).toFixed(4)) : null;

  let liquidityLabel = "UNKNOWN";
  if (volume24h !== null && volume24h !== undefined) {
    if (volume24h >= RISK_CONFIG.LIQUIDITY_HIGH_MIN_VOLUME && (spreadPct === null || spreadPct <= RISK_CONFIG.MAX_SPREAD_PCT / 5)) {
      liquidityLabel = "HIGH";
    } else if (volume24h >= RISK_CONFIG.LIQUIDITY_MEDIUM_MIN_VOLUME) {
      liquidityLabel = "MEDIUM";
    } else {
      liquidityLabel = "LOW";
    }
  }
  return { spreadPct, liquidityLabel };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "Body request tidak valid (harus JSON)" }, { status: 400 });
  }

  const {
    symbol, market = "spot", direction, entryPrice, entryType, capital, riskPercent, riskProfile,
    stopLoss, takeProfit, leverage, maxPortfolioRisk, minRiskReward, openPositions, timeframe = "1h",
  } = body || {};

  if (!symbol) return NextResponse.json({ success: false, error: "Parameter 'symbol' wajib diisi" }, { status: 400 });
  if (market === "futures" && !direction) {
    return NextResponse.json({ success: false, error: "Parameter 'direction' wajib diisi untuk futures" }, { status: 400 });
  }
  if (!entryPrice || entryPrice <= 0) {
    return NextResponse.json({ success: false, error: "Parameter 'entryPrice' wajib diisi dan lebih dari 0" }, { status: 400 });
  }

  let ticker = null;
  let technicalReport = null;

  try {
    const { tickers } = market === "futures" ? await getFuturesTickers(symbol) : await getSpotTickers(symbol);
    ticker = tickers[0] ?? null;
  } catch (err) {
    return NextResponse.json({ success: false, error: "Bitget API tidak dapat dihubungi (ticker)" }, { status: 503 });
  }

  try {
    technicalReport = await getTechnicalReport({ symbol, market, timeframe });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Bitget API tidak dapat dihubungi (technical data)" }, { status: 503 });
  }

  const { spreadPct, liquidityLabel } = computeSpreadAndLiquidity(ticker);

  const result = buildTradePlan({
    symbol,
    market,
    direction,
    entryPrice,
    entryType,
    capital,
    riskPercent,
    riskProfile,
    userStopLoss: stopLoss ?? null,
    userTakeProfit: takeProfit ?? null,
    requestedLeverage: leverage ?? null,
    maxPortfolioRiskOverride: maxPortfolioRisk,
    minRiskRewardOverride: minRiskReward,
    openPositions: openPositions || [],
    ticker: ticker
      ? { bid: ticker.bid, ask: ticker.ask, volume24h: ticker.volume24h, fundingRate: ticker.fundingRate, openInterest: ticker.openInterest, spreadPct, liquidityLabel }
      : null,
    technical:
      technicalReport?.dataQuality === "INSUFFICIENT_DATA"
        ? { dataQuality: "INSUFFICIENT_DATA" }
        : {
            dataQuality: technicalReport?.dataQuality,
            atrValue: technicalReport?.indicators?.atr ?? null,
            atrPercent: technicalReport?.indicators?.atrPercent ?? null,
            support: technicalReport?.support ?? [],
            resistance: technicalReport?.resistance ?? [],
            structure: technicalReport?.structure ?? null,
          },
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.errors.join("; ") }, { status: 400 });
  }

  return NextResponse.json({ success: true, tradePlan: result.tradePlan });
}
