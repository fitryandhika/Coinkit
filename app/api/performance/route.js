import { NextResponse } from "next/server";
import { buildPerformanceReport } from "@/lib/performance/aggregate";

export async function GET() {
  try {
    const report = await buildPerformanceReport();
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
