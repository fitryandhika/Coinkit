import { NextResponse } from "next/server";
import { listPredictions } from "@/lib/db/predictions";

// POST dihapus — prediction sekarang dicatat otomatis dari server (lib/screener/autoRecord.js)
// saat Screener berjalan, bukan lewat request dari client. Endpoint tulis publik yang tidak
// dipakai adalah risiko keamanan yang tidak perlu, jadi dibuang.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol") || undefined;
  const decision = searchParams.get("decision") || undefined;
  const status = searchParams.get("status") || undefined;
  const includeControl = searchParams.get("includeControl") === "1";
  const limit = Number(searchParams.get("limit") || 50);

  try {
    const predictions = await listPredictions({ symbol, decision, status, includeControl, limit });
    return NextResponse.json({ success: true, predictions });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
