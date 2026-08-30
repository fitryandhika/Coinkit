/** Statistik kecil tanpa dependensi — dipakai mesin kalibrasi. */

export function mean(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  return Number((v.reduce((s, x) => s + x, 0) / v.length).toFixed(4));
}

export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return Number((v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2).toFixed(4));
}

function rank(values) {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j += 1;
    const avgRank = (i + j) / 2 + 1; // rata-rata untuk nilai kembar
    for (let k = i; k <= j; k += 1) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/**
 * Korelasi peringkat Spearman. Dipakai (bukan Pearson) karena yang kita
 * tanyakan adalah "apakah score yang lebih tinggi cenderung berujung hasil
 * lebih baik" — soal urutan, bukan soal linearitas. Juga tahan terhadap
 * outlier, yang di crypto sangat banyak.
 */
export function spearman(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pairs.length;
  if (n < 3) return null;

  const rx = rank(pairs.map((p) => p[0]));
  const ry = rank(pairs.map((p) => p[1]));

  const mx = rx.reduce((s, v) => s + v, 0) / n;
  const my = ry.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return null;
  return Number((cov / Math.sqrt(vx * vy)).toFixed(4));
}

/**
 * Ambang kasar signifikansi Spearman (approx, alpha 5%, dua sisi): 1.96/sqrt(n-1).
 * Bukan uji statistik penuh — cukup untuk mencegah menarik kesimpulan dari
 * korelasi 0.05 pada 30 sampel.
 */
export function isCorrelationMeaningful(rho, n) {
  if (rho === null || !Number.isFinite(rho) || n < 10) return false;
  return Math.abs(rho) >= 1.96 / Math.sqrt(n - 1);
}

/** Expectancy per trade dalam R: (winRate x avgWin) - (lossRate x avgLoss). */
export function expectancy(rValues) {
  const v = rValues.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  const wins = v.filter((x) => x > 0);
  const losses = v.filter((x) => x <= 0);
  const winRate = wins.length / v.length;
  const avgWin = wins.length ? wins.reduce((s, x) => s + x, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, x) => s + x, 0) / losses.length) : 0;
  return Number((winRate * avgWin - (1 - winRate) * avgLoss).toFixed(4));
}

export function winRate(rValues) {
  const v = rValues.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  return Number(((v.filter((x) => x > 0).length / v.length) * 100).toFixed(2));
}

/** Drawdown maksimum dari kurva ekuitas R (urut waktu, paling lama dulu). */
export function maxDrawdownR(rValuesChronological) {
  const v = rValuesChronological.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of v) {
    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  return Number(maxDd.toFixed(4));
}

/** Beruntun kalah terpanjang — indikator apakah strategi layak dijalani secara psikologis. */
export function longestLossStreak(rValuesChronological) {
  let current = 0;
  let longest = 0;
  for (const r of rValuesChronological) {
    if (!Number.isFinite(r)) continue;
    if (r <= 0) { current += 1; longest = Math.max(longest, current); } else current = 0;
  }
  return longest;
}
