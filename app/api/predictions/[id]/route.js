import { NextResponse } from "next/server";
import { getPrediction } from "@/lib/db/predictions";
import { getSnapshot } from "@/lib/db/snapshots";
import { getOutcome } from "@/lib/db/outcomes";

export async function GET(request, { params }) {
  const prediction = await getPrediction(params.id);
  if (!prediction) return NextResponse.json({ success: false, error: "Prediction tidak ditemukan" }, { status: 404 });

  const [snapshot, outcome] = await Promise.all([getSnapshot(params.id), getOutcome(params.id)]);

  return NextResponse.json({ success: true, prediction, snapshot, outcome });
}
