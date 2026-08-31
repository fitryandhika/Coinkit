/**
 * Versi aturan pencatatan + evaluasi setup.
 *
 * Kenapa perlu: setup yang dicatat sebelum perbaikan ini dievaluasi dengan
 * jendela waktu yang salah (candle diambil dari entry sampai SEKARANG, bukan
 * sampai horizon habis), sehingga MFE/MAE/hasilnya membengkak dan tidak bisa
 * dibandingkan dengan setup baru. Menggabungkan keduanya dalam satu laporan
 * hanya akan mencemari korelasi.
 *
 * v1 = data lama (aturan rusak). v2 = setelah perbaikan worker + stop minimum.
 */
export const CURRENT_RULESET_VERSION = 2;
export const LEGACY_RULESET_VERSION = 1;
