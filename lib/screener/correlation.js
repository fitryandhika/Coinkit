export function toReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    if (closes[i - 1]) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

/** Korelasi Pearson antara return coin vs return BTC — dihitung dari candle yang
 * SUDAH difetch screener (BTC diambil sekali per run, bukan per-coin), jadi tidak
 * ada request tambahan ke Bitget. */
export function computeCorrelation(returnsA, returnsB, minSample = 20) {
  const n = Math.min(returnsA.length, returnsB.length);
  if (n < minSample) return null;

  const a = returnsA.slice(-n);
  const b = returnsB.slice(-n);
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return Number((cov / Math.sqrt(varA * varB)).toFixed(4));
}
