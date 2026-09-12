import { NextResponse } from "next/server";
import { runScreener } from "@/lib/screener/screener";
import { SCREENER_CONFIG } from "@/lib/screener/config";
import { TIMEFRAMES } from "@/lib/bitget/constants";
import { OUTCOME_CONFIG } from "@/lib/outcome/config";

/**
 * PEREKAM SETUP TERJADWAL.
 *
 * Kenapa endpoint ini ada: sampai versi sebelumnya, satu-satunya yang pernah
 * mencatat setup adalah /api/screener — yaitu hanya saat Anda membuka halaman
 * Screener, Dashboard, atau Opportunities. Konsekuensinya:
 *
 *   - Riwayat berhenti bertambah setiap kali aplikasi tidak dibuka. Itu yang
 *     terjadi sejak 6 September, dan juga penyebab hari-hari bolong sebelumnya.
 *   - Sampel yang terkumpul condong ke jam-jam Anda online. Untuk kalibrasi ini
 *     lebih berbahaya daripada data sedikit: score diuji hanya pada sebagian
 *     kecil kondisi pasar, lalu kesimpulannya dipakai untuk semua jam.
 *
 * Sekarang pencatatan punya jadwalnya sendiri, terpisah dari aktivitas Anda.
 * Daftarkan di cron-job.org (tiap 15 menit):
 *   https://<domain>/api/worker/record-setups?secret=<WORKER_SECRET>
 */

export const maxDuration = 60;

// Berhenti sendiri sebelum SCHEDULER memutus koneksi — bukan sebelum Vercel.
// Batas tunggu cron-job.org sekitar 30 detik, jadi angka inilah yang mengikat,
// bukan maxDuration 60. Disamakan dengan worker evaluasi (25 detik) supaya
// tidak ada satu pun job yang ditandai gagal lalu dinonaktifkan otomatis.
// Kombinasi yang belum sempat dijalankan kebagian di panggilan berikutnya
// karena urutannya digeser tiap 15 menit (lihat rotate()).
const DEADLINE_MS = OUTCOME_CONFIG.WORKER_DEADLINE_MS;

/** Kombinasi yang dipantau. Sengaja pendek: setiap kombinasi memindai 120 coin,
 * dan sampel yang rapat pada satu timeframe lebih berguna untuk kalibrasi
 * daripada sampel tipis yang tersebar di lima timeframe. */
const DEFAULT_COMBOS = [
  { mode: "futures", timeframe: "1h" },
  { mode: "spot", timeframe: "1h" },
];

function checkAuth(request) {
  const authHeader = request.headers.get("authorization");
  const vercelCronSecret = process.env.CRON_SECRET;
  if (vercelCronSecret && authHeader === `Bearer ${vercelCronSecret}`) return true;

  const url = new URL(request.url);
  const workerSecret = process.env.WORKER_SECRET;
  if (workerSecret && url.searchParams.get("secret") === workerSecret) return true;

  return false;
}

/** Rotasi urutan kombinasi supaya yang di belakang tidak selalu jadi korban
 * deadline kalau run-nya kebetulan lambat. */
function rotate(combos, nowMs) {
  if (combos.length <= 1) return combos;
  const offset = Math.floor(nowMs / (15 * 60 * 1000)) % combos.length;
  return [...combos.slice(offset), ...combos.slice(0, offset)];
}

function parseCombos(url) {
  const modeParam = url.searchParams.get("mode");
  const tfParam = url.searchParams.get("timeframe");
  if (!modeParam && !tfParam) return DEFAULT_COMBOS;

  const modes = (modeParam || "futures,spot").split(",").map((m) => (m === "futures" ? "futures" : "spot"));
  const timeframes = (tfParam || "1h").split(",").filter((t) => TIMEFRAMES.includes(t));
  if (timeframes.length === 0) return DEFAULT_COMBOS;

  const combos = [];
  for (const mode of new Set(modes)) {
    for (const timeframe of new Set(timeframes)) combos.push({ mode, timeframe });
  }
  return combos;
}

async function runRecorder(request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const url = new URL(request.url);
  const combos = rotate(parseCombos(url), startedAt);

  const runs = [];
  let timedOut = false;

  for (const combo of combos) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      timedOut = true;
      break;
    }
    try {
      // Sengaja runScreener (bukan runScreenerCached): hasil cache bisa berumur
      // sampai 45 detik dan berasal dari permintaan halaman — pencatatan harus
      // memakai data yang baru diambil, bukan warisan request orang lain.
      const result = await runScreener({ ...combo, config: SCREENER_CONFIG, record: true });
      runs.push({
        ...combo,
        scanned: result.scannedCount,
        btcMomentumLabel: result.btcMomentumLabel,
        ...result.recordSummary,
      });
    } catch (err) {
      runs.push({ ...combo, error: err?.message || String(err) });
    }
  }

  const totalRecorded = runs.reduce((sum, r) => sum + (r.recorded || 0), 0);
  const totalErrors = runs.reduce((sum, r) => sum + (r.errorCount || 0), 0);

  return NextResponse.json({
    success: true,
    totalRecorded,
    totalErrors,
    combosRun: runs.length,
    combosPlanned: combos.length,
    timedOut,
    durationMs: Date.now() - startedAt,
    runs,
  });
}

export async function GET(request) { return runRecorder(request); }
export async function POST(request) { return runRecorder(request); }
