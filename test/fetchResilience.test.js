import test from "node:test";
import assert from "node:assert/strict";

import { fetchOutcomeCandles } from "../lib/outcome/monitor.js";
import { OUTCOME_CONFIG } from "../lib/outcome/config.js";

/**
 * REGRESI: symbol yang ditolak Bitget tidak boleh menjatuhkan evaluasi.
 *
 * Riwayat bug: permintaan candle cadangan di fetchOutcomeCandles() tidak
 * dibungkus try/catch. Symbol seperti "4USDT" yang dijawab HTTP 400 melempar
 * error sampai ke worker, barisnya tidak tersentuh (next_check_at tetap lama),
 * dan karena antrean diurutkan "paling telat dulu", baris itu menetap di kepala
 * antrean SELAMANYA sambil memakan slot di setiap panggilan worker.
 */

const HOUR = 60 * 60 * 1000;

function withStubbedFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return fn().finally(() => { globalThis.fetch = original; });
}

function windowArgs(nowMs) {
  const entryTimestamp = nowMs - 26 * HOUR;
  return {
    market: "futures",
    // Symbol diberi akhiran acak supaya tidak kena cache dari test lain.
    symbol: `TEST${Math.random().toString(36).slice(2, 8)}USDT`,
    entryTimestamp,
    nowMs,
    horizonEnd: entryTimestamp + 24 * HOUR,
    horizonHours: 24,
  };
}

test("REGRESI: Bitget menolak semua permintaan -> resolve dengan fetchError, tidak melempar", async () => {
  const nowMs = Date.now();
  const rejectAll = async () => ({ ok: false, status: 400, json: async () => ({}) });

  const result = await withStubbedFetch(rejectAll, () => fetchOutcomeCandles(windowArgs(nowMs)));

  assert.equal(result.candles.length, 0);
  assert.ok(result.fetchError, "fetchError harus terisi supaya worker bisa menutupnya sebagai FETCH_REJECTED");
  assert.match(result.fetchError, /400/);
  assert.equal(result.complete, false);
});

test("permintaan berjendela gagal tapi cadangan berhasil -> fetchError dibersihkan", async () => {
  const nowMs = Date.now();
  const entryTimestamp = nowMs - 26 * HOUR;

  // Permintaan pertama (punya startTime) ditolak; permintaan cadangan dijawab.
  const handler = async (url) => {
    const u = new URL(url);
    if (u.searchParams.get("startTime")) return { ok: false, status: 400, json: async () => ({}) };
    const candles = [];
    for (let i = 0; i < 30; i += 1) {
      const t = entryTimestamp + i * HOUR;
      candles.push([String(t), 100, 101, 99, 100, 10, 1000]);
    }
    return { ok: true, json: async () => ({ code: "00000", data: candles }) };
  };

  const args = { ...windowArgs(nowMs), entryTimestamp, horizonEnd: entryTimestamp + 24 * HOUR };
  const result = await withStubbedFetch(handler, () => fetchOutcomeCandles(args));

  assert.equal(result.fetchError, null);
  assert.ok(result.candles.length > 0);
  // Candle di luar horizon tetap dipotong, walau yang terambil lebih panjang.
  assert.ok(result.candles.every((c) => c.time < args.horizonEnd));
});

test("backoff error tersedia dan masuk akal (menit-an, bukan milidetik)", () => {
  assert.ok(Number.isFinite(OUTCOME_CONFIG.ERROR_BACKOFF_MS));
  assert.ok(OUTCOME_CONFIG.ERROR_BACKOFF_MS >= 60 * 1000);
});

test("deadline worker tetap di bawah batas tunggu scheduler (30 detik)", () => {
  assert.ok(
    OUTCOME_CONFIG.WORKER_DEADLINE_MS < 30000,
    "worker harus berhenti sendiri sebelum cron-job.org memutus koneksi dan menandai job gagal"
  );
});
