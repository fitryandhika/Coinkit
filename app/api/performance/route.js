import { NextResponse } from "next/server";
import { buildPerformanceReport } from "@/lib/performance/aggregate";

export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 1000), 2000);

  try {
    const report = await buildPerformanceReport({ limit });
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
