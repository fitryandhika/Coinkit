import { NextResponse } from "next/server";
import { listOutcomes } from "@/lib/db/outcomes";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  try {
    const outcomes = await listOutcomes({ status });
    return NextResponse.json({ success: true, outcomes });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
