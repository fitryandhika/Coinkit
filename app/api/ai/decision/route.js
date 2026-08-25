import { NextResponse } from "next/server";
import { generateAIDecision } from "@/lib/ai/assistant";

export const maxDuration = 30;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: "Body request tidak valid (harus JSON)" }, { status: 400 });
  }

  const { symbol, market = "spot", direction, capital, riskPercent, riskProfile, leverage, timeframe = "1h", screener } = body || {};

  if (!symbol) return NextResponse.json({ success: false, error: "Parameter 'symbol' wajib diisi" }, { status: 400 });
  if (!capital || capital <= 0) return NextResponse.json({ success: false, error: "Parameter 'capital' wajib diisi dan lebih dari 0" }, { status: 400 });
  if (!riskPercent || riskPercent <= 0) return NextResponse.json({ success: false, error: "Parameter 'riskPercent' wajib diisi dan lebih dari 0" }, { status: 400 });

  try {
    const result = await generateAIDecision({ symbol, market, direction, capital, riskPercent, riskProfile, leverage, timeframe, screener });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "Bitget API gagal" }, { status: 503 });
  }
}
