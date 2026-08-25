import { NextResponse } from "next/server";
import { getPrediction, updateUserAction } from "@/lib/db/predictions";

export async function POST(request, { params }) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: "Body tidak valid" }, { status: 400 }); }

  const { action } = body || {};
  if (!["TAKEN", "SKIPPED"].includes(action)) {
    return NextResponse.json({ success: false, error: "action harus TAKEN atau SKIPPED" }, { status: 400 });
  }

  const prediction = await getPrediction(params.id);
  if (!prediction) return NextResponse.json({ success: false, error: "Prediction tidak ditemukan" }, { status: 404 });

  await updateUserAction(params.id, action);
  return NextResponse.json({ success: true });
}
