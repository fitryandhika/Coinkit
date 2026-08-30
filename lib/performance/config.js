export const PERFORMANCE_CONFIG = {
  // Fee taker Bitget (per sisi, %). Round-trip = 2x. Tanpa ini semua statistik
  // terlalu optimis — setup dengan risiko kecil paling terdampak.
  FEE_PCT: { spot: 0.1, futures: 0.06 },

  // Batas skor untuk bucket kalibrasi. Bucket di bawah 60 hanya terisi kalau
  // control group aktif (lihat lib/screener/autoRecord.js).
  SCORE_BUCKETS: [
    { label: "<50", min: -Infinity, max: 50 },
    { label: "50-59", min: 50, max: 60 },
    { label: "60-69", min: 60, max: 70 },
    { label: "70-79", min: 70, max: 80 },
    { label: "80-89", min: 80, max: 90 },
    { label: "90-100", min: 90, max: Infinity },
  ],

  // Ambang jumlah sampel sebelum sebuah angka boleh dipercaya / ditampilkan
  // sebagai kesimpulan. Angka kecil = kebetulan, bukan sinyal.
  MIN_SAMPLE_PER_BUCKET: 10,
  MIN_SAMPLE_FOR_VERDICT: 40,
  MIN_SAMPLE_FOR_WEIGHT_SUGGESTION: 80,

  // Seberapa jauh bobot boleh digeser sekali kalibrasi (0 = tidak digeser,
  // 1 = langsung ke usulan penuh). Konservatif supaya tidak overfit.
  WEIGHT_ADJUST_STRENGTH: 0.35,
  // Korelasi di bawah ini dianggap noise, tidak dipakai menggeser bobot.
  MIN_ABS_CORRELATION: 0.08,
};
