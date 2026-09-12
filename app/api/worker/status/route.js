import { NextResponse } from "next/server";
import { getRecordingHealth } from "@/lib/db/predictions";
import { getLastEvaluationEndedAt } from "@/lib/db/outcomes";

/**
 * Satu pertanyaan: apakah mesin pengumpul data masih hidup?
 *
 * Ini kelas kegagalan yang paling mahal di aplikasi ini, karena gagalnya diam.
 * Halaman Kalibrasi yang kosong terlihat persis sama antara "score belum
 * terbukti" dan "tidak ada data masuk selama lima hari". Dua kondisi itu butuh
 * tindakan yang sangat berbeda, jadi keduanya harus bisa dibedakan dari layar.
 *
 * Tidak butuh secret: isinya cuma tiga angka, tidak ada data sensitif.
 */
export const maxDuration = 15;

const HOUR_MS = 60 * 60 * 1000;

function ageHours(iso, nowMs) {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Number(((nowMs - ms) / HOUR_MS).toFixed(2));
}

export async function GET() {
  const nowMs = Date.now();
  try {
    const [health, lastEvaluatedAt] = await Promise.all([
      getRecordingHealth(),
      getLastEvaluationEndedAt(),
    ]);

    const recordingAgeHours = ageHours(health.lastRecordedAt, nowMs);
    const evaluationAgeHours = ageHours(lastEvaluatedAt, nowMs);

    // Ambang 2 jam: perekam dijadwalkan tiap 15 menit, jadi jeda 2 jam sudah
    // pasti bukan sekadar sepi sinyal.
    const recordingHealthy = recordingAgeHours !== null && recordingAgeHours <= 2;
    const evaluationHealthy = evaluationAgeHours !== null && evaluationAgeHours <= 2;

    return NextResponse.json({
      success: true,
      lastRecordedAt: health.lastRecordedAt,
      lastEvaluatedAt,
      recordingAgeHours,
      evaluationAgeHours,
      recordingHealthy,
      evaluationHealthy,
      pendingCount: health.pendingCount,
      // PENDING yang umurnya sudah lewat horizon terpanjang (72H). Angka besar
      // di sini berarti antrean evaluasi menumpuk, bukan sekadar telat sedikit.
      stalePendingCount: health.stalePendingCount,
      checkedAt: new Date(nowMs).toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
