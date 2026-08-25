import { NextResponse } from "next/server";
import { getSpotTickers } from "@/lib/bitget/spot";
import { getFuturesTickers } from "@/lib/bitget/futures";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "futures" ? "futures" : "spot";
  const symbol = searchParams.get("symbol") || undefined;

  try {
    const result = mode === "futures" ? await getFuturesTickers(symbol) : await getSpotTickers(symbol);
    return NextResponse.json({ success: true, mode, symbol: symbol || null, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, mode, error: error.message || "Gagal mengambil ticker" },
      { status: 502 }
    );
  }
}
