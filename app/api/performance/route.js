import { NextResponse } from "next/server";
import { buildPerformanceReport } from "@/lib/performance/aggregate";

export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 1000), 2000);

  // ?ruleset=2 -> hanya setup yang dicatat & dievaluasi dengan aturan baru.
  // ?ruleset=all -> semuanya (default, supaya data lama tetap bisa dilihat).
  const rulesetParam = searchParams.get("ruleset");
  const rulesetVersion =
    rulesetParam && rulesetParam !== "all" && Number.isFinite(Number(rulesetParam))
      ? Number(rulesetParam)
      : null;

  try {
    const report = await buildPerformanceReport({ limit, rulesetVersion });
    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
