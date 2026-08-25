import { NextResponse } from "next/server";
import { createManualTrade } from "@/lib/db/manualTrades";
import { getPrediction } from "@/lib/db/predictions";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 }); }

  const { predictionId, ...tradeData } = body || {};
  if (!predictionId) return NextResponse.json({ success: false, error: "predictionId wajib diisi" }, { status: 400 });

  const prediction = await getPrediction(predictionId);
  if (!prediction) return NextResponse.json({ success: false, error: "Prediction tidak ditemukan" }, { status: 404 });

  try {
    const id = await createManualTrade(predictionId, tradeData);
    return NextResponse.json({ success: true, manualTradeId: id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
