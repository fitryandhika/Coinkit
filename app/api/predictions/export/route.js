import { fetchJoinedRows } from "@/lib/performance/aggregate";
import { buildSamples } from "@/lib/performance/calibration";
import { toCsv, EXPORT_HEADERS, buildExportRows } from "@/lib/performance/exportCsv";

export const maxDuration = 30;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 2000), 5000);
  // Default IKUT menyertakan control group — file ini untuk analisa ulang,
  // dan tanpa kelompok pembanding kalibrasi manual jadi tidak ada artinya.
  const includeControl = searchParams.get("includeControl") !== "0";

  try {
    const rows = await fetchJoinedRows({ limit });
    const samples = buildSamples(rows).filter((s) => includeControl || !s.isControl);
    const csv = toCsv(EXPORT_HEADERS, buildExportRows(samples, rows));

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="coinkit-kalibrasi-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
