import { NextResponse } from "next/server";
import { getSpotSymbols } from "@/lib/bitget/spot";
import { getFuturesSymbols } from "@/lib/bitget/futures";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "futures" ? "futures" : "spot";

  try {
    const result = mode === "futures" ? await getFuturesSymbols() : await getSpotSymbols();
    return NextResponse.json({ success: true, mode, ...result });
  } catch (error) {
    return NextResponse.json(
      { success: false, mode, error: error.message || "Gagal mengambil daftar symbol" },
      { status: 502 }
    );
  }
}
