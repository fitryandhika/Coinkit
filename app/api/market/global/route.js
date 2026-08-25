import { NextResponse } from "next/server";
import { getGlobalMarketData } from "@/lib/coingecko/client";

export async function GET() {
  try {
    const data = await getGlobalMarketData();
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data market global" },
      { status: 502 }
    );
  }
}
