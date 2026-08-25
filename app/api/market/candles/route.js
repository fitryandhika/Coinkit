import { NextResponse } from "next/server";
import { getSpotCandles } from "@/lib/bitget/spot";
import { getFuturesCandles } from "@/lib/bitget/futures";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "futures" ? "futures" : "spot";
  const symbol = searchParams.get("symbol");
  const timeframe = searchParams.get("timeframe") || "15m";
  const limit = Number(searchParams.get("limit") || 100);

  if (!symbol) {
    return NextResponse.json({ success: false, error: "Parameter 'symbol' wajib diisi" }, { status: 400 });
  }

  try {
    const result =
      mode === "futures"
        ? await getFuturesCandles(symbol, timeframe, undefined, limit)
        : await getSpotCandles(symbol, timeframe, limit);
    return NextResponse.json({ success: true, mode, symbol, timeframe, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, mode, symbol, error: error.message || "Gagal mengambil candlestick" },
      { status: 502 }
    );
  }
}
