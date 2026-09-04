import { SCREENER_CONFIG as DEFAULT_CONFIG } from "./config.js";

/**
 * SCORING v3 — ditulis ulang berdasarkan kalibrasi 2026-09-04 (n=638 setup).
 *
 * Temuan yang memicu perubahan ini:
 *   1. Skor TIDAK punya daya prediksi. Spearman(score, net_pct) = +0.06
 *      (p=0.21), AUC 0.53, bucket skor tidak monoton, dan setup terpilih
 *      (skor ~71) tidak terbukti lebih baik dari kontrol acak (skor ~46),
 *      p=0.40.
 *   2. Penyebab utamanya bukan bobot yang salah, tapi KOMPRESI. Rata-rata
 *      tertimbang dari 5 sub-skor 0-100 selalu berkumpul di tengah — hampir
 *      semua setup mendarat di 60-80. Ambang 60 praktis meloloskan segalanya.
 *   3. liquidityScore memegang 25% bobot, padahal universe SUDAH disaring ke
 *      120 coin dengan volume terbesar. Di populasi itu skor likuiditas nyaris
 *      konstan — jadi 25% bobot dipakai untuk menaikkan semua orang sama rata,
 *      bukan untuk membedakan. Sama untuk volatilityScore (10%).
 *      Efektifnya hanya momentum (30%) + breakout (15%) yang membedakan.
 *
 * Tiga perubahan struktural:
 *   A. Likuiditas jadi GERBANG + PENGALI, bukan komponen aditif. Likuiditas
 *      buruk seharusnya membatalkan setup, bukan dikompensasi momentum bagus.
 *      Bobotnya dialihkan ke komponen yang benar-benar membedakan.
 *   B. Penalti jadi MULTIPLIKATIF (% dari skor), bukan pengurangan poin. Di
 *      skala yang terkompresi, -20 poin absolut jauh lebih besar dari sebaran
 *      skor itu sendiri — satu penalti bisa melompati seluruh rentang.
 *   C. Transformasi kontras untuk memakai rentang 0-100 seutuhnya.
 *
 * PENTING — jujur soal batasnya: (C) adalah transformasi monoton. Dia membuat
 * skor terbaca dan membuat ambang bermakna, tapi TIDAK mengubah urutan dan
 * TIDAK menambah daya prediksi. Yang benar-benar mengubah peringkat adalah
 * (A) dan (B), plus gerbang R:R di bawah. Apakah itu cukup hanya bisa
 * dibuktikan oleh kalibrasi berikutnya — bukan oleh kode ini.
 */

export const SCORE_VERSION = 3;

/** Komponen yang harus ada. Kalau salah satu hilang, skor tidak dikeluarkan. */
const REQUIRED_COMPONENTS = ["momentumScore", "breakoutScore", "volumeScore"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Rata-rata tertimbang TANPA renormalisasi diam-diam.
 *
 * Versi lama membagi dengan totalWeight komponen yang tersedia saja, jadi
 * setup dengan data separuh tetap mendapat skor yang terlihat setara dengan
 * setup berdata lengkap. Sekarang komponen wajib yang hilang = skor null,
 * dan komponen opsional yang hilang menurunkan `coverage` (dilaporkan, bukan
 * disembunyikan).
 */
function weightedAverage(scores, weights) {
  let totalWeight = 0;
  let totalScore = 0;
  let availableWeight = 0;

  for (const key of Object.keys(weights)) {
    totalWeight += weights[key];
    const score = scores[key];
    if (score === null || score === undefined || Number.isNaN(score)) continue;
    totalScore += score * weights[key];
    availableWeight += weights[key];
  }

  if (availableWeight === 0) return { value: null, coverage: 0 };
  return {
    value: totalScore / availableWeight,
    coverage: totalWeight > 0 ? availableWeight / totalWeight : 0,
  };
}

/**
 * Regangkan skor di sekitar titik netral supaya rentang 0-100 benar-benar
 * terpakai. gain 1.0 = tidak berubah.
 */
function applyContrast(value, config) {
  const gain = config.SCORE_CONTRAST_GAIN ?? 1;
  const pivot = config.SCORE_CONTRAST_PIVOT ?? 50;
  return clamp(pivot + (value - pivot) * gain, 0, 100);
}

/**
 * Likuiditas sebagai pengali 0..1, bukan komponen aditif.
 * Di bawah gerbang keras -> setup tidak dikeluarkan sama sekali.
 */
function liquidityFactor(liquidityScore, config) {
  if (liquidityScore === null || liquidityScore === undefined) return null;
  const floor = config.LIQUIDITY_GATE_MIN_SCORE ?? 25;
  const full = config.LIQUIDITY_FULL_CREDIT_SCORE ?? 60;
  const minFactor = config.LIQUIDITY_MIN_FACTOR ?? 0.6;

  if (liquidityScore < floor) return 0; // gerbang: tidak layak diperdagangkan
  if (liquidityScore >= full) return 1;
  const progress = (liquidityScore - floor) / (full - floor);
  return minFactor + progress * (1 - minFactor);
}

/**
 * @param {object} scores    momentumScore, volumeScore, liquidityScore, volatilityScore, breakoutScore
 * @param {Array}  penalties dari calculatePenalties() — { reason, amount } (amount = % pengurangan)
 * @param {object} context   { riskReward } — R:R ke TP1, dipakai sebagai gerbang
 */
export function calculateScreenerScore(scores, penalties = [], config = DEFAULT_CONFIG, context = {}) {
  const empty = {
    rawScore: null, penalty: 0, finalScore: null,
    coverage: 0, liquidityFactor: null, penaltyFactor: 1,
    rejectReason: null, scoreVersion: SCORE_VERSION,
  };

  const missing = REQUIRED_COMPONENTS.filter(
    (k) => scores[k] === null || scores[k] === undefined || Number.isNaN(scores[k])
  );
  if (missing.length) {
    return { ...empty, rejectReason: `MISSING_COMPONENT:${missing.join(",")}` };
  }

  // Bobot komponen pembeda saja — likuiditas sudah tidak di sini.
  const weights = {
    momentumScore: config.MOMENTUM_WEIGHT,
    volumeScore: config.VOLUME_WEIGHT,
    volatilityScore: config.VOLATILITY_WEIGHT,
    breakoutScore: config.BREAKOUT_WEIGHT,
  };

  const { value: base, coverage } = weightedAverage(scores, weights);
  if (base === null) return { ...empty, rejectReason: "NO_COMPONENTS" };

  const rawScore = Number(base.toFixed(2));

  // --- Gerbang 1: likuiditas ------------------------------------------------
  const liqFactor = liquidityFactor(scores.liquidityScore, config);
  if (liqFactor === 0) {
    return { ...empty, rawScore, coverage, liquidityFactor: 0, rejectReason: "LIQUIDITY_GATE" };
  }

  // --- Gerbang 2: R:R -------------------------------------------------------
  // Setup dengan R:R di bawah ambang tidak diberi skor sama sekali. Kalibrasi
  // menunjukkan 45% setup lolos dengan R:R < 1.0 — itu kalah secara aritmatika
  // sebelum modelnya sempat benar atau salah.
  const rr = context.riskReward;
  const minRr = config.MIN_RR_TO_SCORE ?? 1.2;
  if (rr !== null && rr !== undefined && Number.isFinite(rr) && rr < minRr) {
    return { ...empty, rawScore, coverage, liquidityFactor: liqFactor, rejectReason: "RR_GATE" };
  }

  // --- Penalti multiplikatif -----------------------------------------------
  const penaltyFactor = penalties.reduce(
    (factor, p) => factor * (1 - clamp(p.amount ?? 0, 0, 100) / 100),
    1
  );

  // Data tidak lengkap tidak boleh menghasilkan skor sekuat data lengkap.
  const coverageFactor = 1 - (1 - coverage) * (config.COVERAGE_PENALTY_STRENGTH ?? 0.5);

  const adjusted = base * penaltyFactor * (liqFactor ?? 1) * coverageFactor;
  const finalScore = Number(applyContrast(adjusted, config).toFixed(2));

  return {
    rawScore,
    // Kolom `penalty` harus tetap berarti "berapa poin yang hilang KARENA
    // PENALTI" — bukan selisih rawScore-finalScore, yang ikut memuat efek
    // pengali likuiditas dan transformasi kontras. Mencampurnya akan membuat
    // kalibrasi berikutnya salah membaca kolom ini.
    penalty: Number((base * (1 - penaltyFactor)).toFixed(2)),
    finalScore,
    coverage: Number(coverage.toFixed(3)),
    liquidityFactor: liqFactor === null ? null : Number(liqFactor.toFixed(3)),
    penaltyFactor: Number(penaltyFactor.toFixed(3)),
    rejectReason: null,
    scoreVersion: SCORE_VERSION,
  };
}

export function calculatePenalties(
  { liquidityLabel, spreadPct, volumeLabel, volatilityLabel, exhaustionStatus, entryLabel },
  config = DEFAULT_CONFIG
) {
  const penalties = [];

  if (liquidityLabel === "LOW") penalties.push({ reason: "Low liquidity", amount: config.PENALTY_LOW_LIQUIDITY });
  if (spreadPct !== null && spreadPct !== undefined && spreadPct > config.LIQUIDITY_MAX_ACCEPTABLE_SPREAD_PCT) {
    penalties.push({ reason: "Spread too wide", amount: config.PENALTY_HIGH_SPREAD });
  }
  if (volumeLabel === "LOW") penalties.push({ reason: "Volume too low", amount: config.PENALTY_LOW_VOLUME });
  if (volatilityLabel === "EXTREME") {
    penalties.push({ reason: "Extreme volatility", amount: config.PENALTY_EXTREME_VOLATILITY });
  }
  if (exhaustionStatus === "POSSIBLE_EXHAUSTION") {
    penalties.push({ reason: "Possible exhaustion", amount: config.PENALTY_POSSIBLE_EXHAUSTION });
  }

  // Harga sudah terlanjur jauh dari zona entry yang sehat.
  if (entryLabel === "OVEREXTENDED") {
    penalties.push({ reason: "Entry sudah kemahalan", amount: config.PENALTY_OVEREXTENDED_ENTRY });
  } else if (entryLabel === "EXTENDED") {
    penalties.push({ reason: "Entry agak jauh dari zona ideal", amount: config.PENALTY_EXTENDED_ENTRY });
  }

  return penalties;
}
