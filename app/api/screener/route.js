import { NextResponse } from "next/server";
import { runScreenerCached } from "@/lib/screener/screener";
import { TIMEFRAMES } from "@/lib/bitget/constants";

// Universe naik 40 -> 120 coin, jadi satu run penuh butuh waktu lebih lama.
// Hasilnya di-cache 45 detik (SCREENER_CACHE_TTL_MS), jadi tidak setiap request kena ini.
export const maxDuration = 60;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "futures" ? "futures" : "spot";
  const timeframe = searchParams.get("timeframe") || "1h";

  if (!TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ success: false, error: `Timeframe tidak didukung: ${timeframe}` }, { status: 400 });
  }

  try {
    const result = await runScreenerCached({ mode, timeframe });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, mode, timeframe, error: error.message || "Screener gagal dijalankan" },
      { status: 502 }
    );
  }
}
