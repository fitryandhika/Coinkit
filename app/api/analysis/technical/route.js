import { NextResponse } from "next/server";
import { getTechnicalReport } from "@/lib/technical/analyzer";
import { TIMEFRAMES } from "@/lib/bitget/constants";
import { getSpotSymbols } from "@/lib/bitget/spot";
import { getFuturesSymbols } from "@/lib/bitget/futures";

export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const market = searchParams.get("market") === "futures" ? "futures" : "spot";
  const timeframe = searchParams.get("timeframe") || "1h";

  if (!symbol) {
    return NextResponse.json({ success: false, error: "Parameter 'symbol' wajib diisi" }, { status: 400 });
  }
  if (!TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ success: false, error: `Timeframe tidak didukung: ${timeframe}` }, { status: 400 });
  }

  let symbolExists = false;
  try {
    const { symbols } = market === "futures" ? await getFuturesSymbols() : await getSpotSymbols();
    symbolExists = symbols.some((s) => s.symbol === symbol);
  } catch (err) {
    return NextResponse.json({ success: false, error: "Bitget API tidak dapat dihubungi" }, { status: 503 });
  }

  if (!symbolExists) {
    return NextResponse.json({ success: false, error: `Symbol tidak ditemukan: ${symbol}` }, { status: 404 });
  }

  try {
    const data = await getTechnicalReport({ symbol, market, timeframe });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "Bitget API gagal" }, { status: 503 });
  }
}
