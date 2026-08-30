import { PERFORMANCE_CONFIG } from "./config.js";
import { computeRealizedR, computeExcursions, num } from "./outcomeMath.js";
import { mean, median, spearman, isCorrelationMeaningful, expectancy, winRate, maxDrawdownR, longestLossStreak } from "./stats.js";

/** Komponen skor yang diuji satu per satu terhadap hasil nyata. */
export const COMPONENTS = [
  { key: "momentum_score", weightKey: "MOMENTUM_WEIGHT", label: "Momentum" },
  { key: "volume_score", weightKey: "VOLUME_WEIGHT", label: "Volume" },
  { key: "liquidity_score", weightKey: "LIQUIDITY_WEIGHT", label: "Likuiditas" },
  { key: "volatility_score", weightKey: "VOLATILITY_WEIGHT", label: "Volatilitas" },
  { key: "breakout_score", weightKey: "BREAKOUT_WEIGHT", label: "Struktur" },
];

/**
 * Gabungkan prediction + snapshot + outcome jadi satu baris datar siap analisa.
 * Baris tanpa realizedR (mis. EXPIRED yang harga akhirnya tidak pernah dicatat)
 * tetap dikembalikan tapi ditandai, supaya jumlah data yang "hilang" terlihat
 * dan tidak diam-diam mengecilkan sampel.
 */
export function buildSamples(rows, config = PERFORMANCE_CONFIG) {
  return rows.map((row) => {
    const { prediction, snapshot, outcome } = row;
    const realized = computeRealizedR(prediction, outcome, config);
    const excursions = computeExcursions(prediction, outcome);

    return {
      id: prediction.id,
      timestamp: prediction.timestamp,
      symbol: prediction.symbol,
      market: prediction.market,
      timeframe: prediction.timeframe,
      decision: prediction.decision,
      direction: prediction.decision === "SHORT" ? "SHORT" : "LONG",
      score: num(prediction.score),
      isControl: prediction.is_control === true,
      status: outcome?.status ?? null,
      outcome: outcome?.outcome ?? null,
      realizedR: realized.realizedR,
      netPct: realized.netPct,
      riskPct: realized.riskPct,
      exitSource: realized.exitSource,
      mfeR: excursions.mfeR,
      maeR: excursions.maeR,
      components: Object.fromEntries(COMPONENTS.map((c) => [c.key, num(snapshot?.[c.key])])),
    };
  });
}

function summarizeGroup(samples) {
  const chronological = [...samples].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const rs = chronological.map((s) => s.realizedR).filter((r) => Number.isFinite(r));

  return {
    n: samples.length,
    scored: rs.length,
    winRate: winRate(rs),
    avgR: mean(rs),
    medianR: median(rs),
    expectancy: expectancy(rs),
    totalR: rs.length ? Number(rs.reduce((s, r) => s + r, 0).toFixed(4)) : null,
    maxDrawdownR: maxDrawdownR(rs),
    longestLossStreak: longestLossStreak(rs),
    avgMfeR: mean(samples.map((s) => s.mfeR)),
    avgMaeR: mean(samples.map((s) => s.maeR)),
  };
}

/** Kalibrasi utama: apakah score yang lebih tinggi benar-benar berujung hasil lebih baik? */
export function buildScoreCalibration(samples, config = PERFORMANCE_CONFIG) {
  const usable = samples.filter((s) => Number.isFinite(s.score) && Number.isFinite(s.realizedR));

  const buckets = config.SCORE_BUCKETS.map((b) => {
    const inBucket = usable.filter((s) => s.score >= b.min && s.score < b.max);
    return {
      label: b.label,
      ...summarizeGroup(inBucket),
      reliable: inBucket.length >= config.MIN_SAMPLE_PER_BUCKET,
    };
  }).filter((b) => b.n > 0);

  // Korelasi score vs hasil — satu angka yang menjawab pertanyaan utamanya.
  const rho = spearman(usable.map((s) => s.score), usable.map((s) => s.realizedR));
  const meaningful = isCorrelationMeaningful(rho, usable.length);

  // Apakah avgR naik seiring naiknya bucket? (hanya bucket yang sampelnya cukup)
  const reliableBuckets = buckets.filter((b) => b.reliable && Number.isFinite(b.avgR));
  let monotonic = null;
  if (reliableBuckets.length >= 3) {
    monotonic = reliableBuckets.every((b, i) => i === 0 || b.avgR >= reliableBuckets[i - 1].avgR);
  }

  return {
    sampleSize: usable.length,
    unresolved: samples.filter((s) => !Number.isFinite(s.realizedR)).length,
    buckets,
    scoreVsResultCorrelation: rho,
    correlationMeaningful: meaningful,
    monotonic,
    verdict: buildVerdict({ n: usable.length, rho, meaningful, monotonic, config }),
  };
}

function buildVerdict({ n, rho, meaningful, monotonic, config }) {
  if (n < config.MIN_SAMPLE_FOR_VERDICT) {
    return {
      level: "INSUFFICIENT",
      text: `Data belum cukup untuk menilai (${n} dari minimal ${config.MIN_SAMPLE_FOR_VERDICT} setup selesai). Biarkan screener berjalan dulu.`,
    };
  }
  if (rho === null) {
    return { level: "INSUFFICIENT", text: "Korelasi tidak bisa dihitung — variasi score terlalu kecil." };
  }
  if (!meaningful) {
    return {
      level: "NO_EDGE",
      text: `Score BELUM terbukti prediktif. Korelasi score vs hasil = ${rho} pada ${n} sampel — terlalu lemah untuk dibedakan dari kebetulan. Artinya setup score 85 belum tentu lebih baik dari score 62.`,
    };
  }
  if (rho < 0) {
    return {
      level: "INVERTED",
      text: `Score TERBALIK: korelasi ${rho}. Score tinggi justru cenderung berakhir lebih buruk — ada komponen yang tandanya salah, bukan sekadar bobotnya kurang pas.`,
    };
  }
  return {
    level: monotonic === false ? "WEAK_EDGE" : "EDGE",
    text: monotonic === false
      ? `Score punya arah yang benar (korelasi ${rho}) tapi tidak konsisten antar bucket — sebagian rentang score tidak berurutan.`
      : `Score terbukti prediktif: korelasi ${rho} pada ${n} sampel, dan rata-rata hasil naik seiring naiknya score.`,
  };
}

/**
 * Kontribusi tiap komponen. Ini yang memberi tahu bobot mana yang perlu digeser:
 * komponen dengan korelasi tinggi ke hasil layak dinaikkan, yang nol/negatif
 * justru sedang mengencerkan skor total.
 */
export function buildComponentAttribution(samples, config = PERFORMANCE_CONFIG) {
  const usable = samples.filter((s) => Number.isFinite(s.realizedR));

  return COMPONENTS.map((c) => {
    const pairs = usable.filter((s) => Number.isFinite(s.components[c.key]));
    const rho = spearman(pairs.map((s) => s.components[c.key]), pairs.map((s) => s.realizedR));
    const meaningful = isCorrelationMeaningful(rho, pairs.length);

    return {
      key: c.key,
      weightKey: c.weightKey,
      label: c.label,
      n: pairs.length,
      correlation: rho,
      meaningful,
      note: pairs.length === 0
        ? "Belum ada data — sub-score baru mulai dicatat setelah migrasi 003."
        : !meaningful
          ? "Belum terbukti berpengaruh."
          : rho > 0 ? "Berkontribusi positif." : "Berlawanan dengan hasil — kandidat untuk dikurangi bobotnya.",
    };
  });
}

/**
 * Usulan bobot baru. SENGAJA hanya usulan, tidak diterapkan otomatis:
 * kalibrasi otomatis pada sampel kecil adalah cara tercepat membuat model
 * overfit ke kondisi pasar sebulan terakhir.
 */
export function suggestWeights(attribution, currentWeights, config = PERFORMANCE_CONFIG) {
  const totalSample = Math.max(...attribution.map((a) => a.n), 0);
  if (totalSample < config.MIN_SAMPLE_FOR_WEIGHT_SUGGESTION) {
    return {
      available: false,
      reason: `Butuh minimal ${config.MIN_SAMPLE_FOR_WEIGHT_SUGGESTION} setup selesai per komponen (sekarang ${totalSample}).`,
      weights: null,
    };
  }

  const usable = attribution.filter((a) => a.meaningful && Math.abs(a.correlation) >= config.MIN_ABS_CORRELATION);
  if (usable.length === 0) {
    return { available: false, reason: "Belum ada komponen dengan korelasi yang cukup meyakinkan.", weights: null };
  }

  // Target: bobot sebanding dengan korelasi positif (korelasi negatif -> 0).
  const positives = attribution.map((a) => ({
    ...a,
    strength: a.meaningful && a.correlation > 0 ? a.correlation : 0,
  }));
  const strengthSum = positives.reduce((s, a) => s + a.strength, 0);
  if (strengthSum <= 0) {
    return { available: false, reason: "Tidak ada komponen berkorelasi positif — jangan geser bobot dulu.", weights: null };
  }

  const k = config.WEIGHT_ADJUST_STRENGTH;
  const blended = {};
  positives.forEach((a) => {
    const current = currentWeights[a.weightKey] ?? 0;
    const target = a.strength / strengthSum;
    blended[a.weightKey] = current * (1 - k) + target * k;
  });

  const sum = Object.values(blended).reduce((s, v) => s + v, 0);
  const normalized = Object.fromEntries(
    Object.entries(blended).map(([key, v]) => [key, Number((v / sum).toFixed(3))])
  );

  return {
    available: true,
    reason: `Berdasarkan ${totalSample} setup selesai, digeser ${Math.round(k * 100)}% ke arah usulan.`,
    weights: normalized,
    current: Object.fromEntries(COMPONENTS.map((c) => [c.weightKey, currentWeights[c.weightKey] ?? 0])),
  };
}

/**
 * Perbandingan terhadap control group: setup di BAWAH ambang yang tetap dicatat
 * sebagai sampel acak. Tanpa pembanding ini, win rate 55% tidak berarti apa-apa —
 * bisa saja entry acak di periode yang sama juga menghasilkan 55%.
 */
export function buildControlComparison(samples) {
  const eligible = samples.filter((s) => !s.isControl && Number.isFinite(s.realizedR));
  const control = samples.filter((s) => s.isControl && Number.isFinite(s.realizedR));

  if (control.length < 10) {
    return {
      available: false,
      reason: `Control group belum cukup (${control.length} setup). Butuh minimal 10 untuk jadi pembanding.`,
      eligible: summarizeGroup(eligible),
      control: summarizeGroup(control),
    };
  }

  const e = summarizeGroup(eligible);
  const c = summarizeGroup(control);
  const edgeR = Number.isFinite(e.avgR) && Number.isFinite(c.avgR) ? Number((e.avgR - c.avgR).toFixed(4)) : null;

  return {
    available: true,
    eligible: e,
    control: c,
    edgeR,
    verdict: edgeR === null
      ? "Belum bisa disimpulkan."
      : edgeR > 0.1
        ? `Setup yang lolos ambang unggul ${edgeR}R per trade dibanding setup di bawah ambang — ambang 60 memang menyaring sesuatu.`
        : edgeR < -0.1
          ? `Setup yang lolos ambang justru KALAH ${Math.abs(edgeR)}R dari setup di bawah ambang — ambang 60 sedang menyaring hal yang salah.`
          : "Tidak ada beda berarti antara setup yang lolos ambang dan yang tidak — ambang 60 belum memberi nilai tambah.",
  };
}

/** Pecah per dimensi supaya terlihat DI MANA screener bekerja dan di mana tidak. */
export function buildBreakdowns(samples) {
  const group = (keyFn) => {
    const map = {};
    samples.filter((s) => !s.isControl).forEach((s) => {
      const key = keyFn(s) ?? "UNKNOWN";
      (map[key] = map[key] || []).push(s);
    });
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, summarizeGroup(v)]));
  };

  return {
    byDirection: group((s) => s.direction),
    byTimeframe: group((s) => s.timeframe),
    byMarket: group((s) => s.market),
    byOutcome: group((s) => s.outcome),
  };
}

export function buildCalibrationReport(rows, currentWeights, config = PERFORMANCE_CONFIG) {
  const samples = buildSamples(rows, config);
  const attribution = buildComponentAttribution(samples, config);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      recorded: samples.length,
      control: samples.filter((s) => s.isControl).length,
      completed: samples.filter((s) => s.status === "COMPLETED").length,
      scored: samples.filter((s) => Number.isFinite(s.realizedR)).length,
      unresolved: samples.filter((s) => s.status === "COMPLETED" && !Number.isFinite(s.realizedR)).length,
    },
    overall: summarizeGroup(samples.filter((s) => !s.isControl)),
    scoreCalibration: buildScoreCalibration(samples, config),
    componentAttribution: attribution,
    weightSuggestion: suggestWeights(attribution, currentWeights, config),
    controlComparison: buildControlComparison(samples),
    breakdowns: buildBreakdowns(samples),
  };
}
