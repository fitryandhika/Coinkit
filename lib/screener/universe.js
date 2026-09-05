/**
 * Penyaring universe — memisahkan kripto asli dari saham/komoditas ter-tokenisasi.
 *
 * Kalibrasi 2026-09-04: 82% setup yang dicatat BUKAN kripto — RNVDA, RMSFT,
 * RQQQ, RVOO, RHYG, XAU, XAG, dan sejenisnya (saham/ETF/komoditas ter-tokenisasi
 * di Bitget). Konsekuensinya:
 *   - Harganya diam saat bursa AS tutup, jadi ATR dan volatilitas jadi
 *     mikroskopis. Ini sumber utama stop loss super sempit di data lama.
 *   - Korelasi BTC, breakout volume, dan exhaustion — semua indikator di
 *     screener ini — dibangun dengan asumsi pasar kripto 24/7. Di aset yang
 *     jam perdagangannya terbatas, indikator itu membaca jeda sebagai sinyal.
 *
 * PENTING — hipotesis di atas TIDAK lolos backtest. Di data 2026-08-25..09-03
 * (n=603), kripto justru sedikit lebih buruk daripada aset ter-tokenisasi
 * (net -0.366% vs -0.200%, tidak signifikan). Masalah stop sempit ternyata
 * sudah ditangani batas MIN_STOP_ATR_MULTIPLIER, bukan oleh pemisahan ini.
 *
 * Karena itu modul ini default-nya TIDAK menyaring apa-apa. Fungsinya sekarang
 * adalah MELABELI setiap setup dengan kelas asetnya, supaya kalibrasi
 * berikutnya bisa mengukur tiap kelas terpisah alih-alih menebak. Penyaringan
 * baru dinyalakan kalau data mendukung (EXCLUDE_TOKENIZED_ASSETS: true).
 */

const QUOTES = ["USDT", "USDC", "USD"];

// Komoditas ter-tokenisasi (emas, perak, minyak).
const COMMODITY_BASES = new Set(["XAU", "XAG", "XAUT", "XPT", "XPD", "XBR", "XTI"]);

// Indeks / futures indeks ter-tokenisasi.
const INDEX_BASES = new Set(["JP225", "US500", "US30", "NAS100", "GER40", "UK100", "HK50"]);

// Ticker saham & ETF yang muncul tanpa prefix "R" di data kalibrasi.
const BARE_EQUITY_BASES = new Set(["MU", "SNDK", "AMAT", "SKHYNIX", "QQQ", "TQQQ", "SOXS", "SPY", "VOO"]);

// Kripto asli yang kebetulan diawali "R". Tanpa daftar ini, heuristik prefix
// akan salah membuang RENDER, RUNE, RAY, dan kawan-kawan. Daftar ini yang
// perlu ditambah kalau ada koin "R..." baru — bukan heuristiknya yang diubah.
const R_CRYPTO_BASES = new Set([
  "RAY", "RSR", "RDNT", "RENDER", "RNDR", "RUNE", "RPL", "RLC", "RIF", "RARE",
  "RVN", "REQ", "REI", "ROSE", "RON", "RONIN", "RSS3", "RATS", "RLB", "RACA",
  "RAD", "RBN", "RIO", "ROOT", "RED", "RESOLV", "RAIN",
]);

export function baseOf(symbol) {
  const s = String(symbol || "").toUpperCase();
  for (const q of QUOTES) {
    if (s.endsWith(q) && s.length > q.length) return s.slice(0, -q.length);
  }
  return s;
}

/**
 * @returns {"crypto"|"commodity"|"index"|"tokenized_equity"}
 */
export function classifyAsset(symbol) {
  const base = baseOf(symbol);
  if (COMMODITY_BASES.has(base)) return "commodity";
  if (INDEX_BASES.has(base)) return "index";
  if (BARE_EQUITY_BASES.has(base)) return "tokenized_equity";
  // Konvensi Bitget: saham/ETF ter-tokenisasi diberi prefix "R" (RNVDA, RQQQ,
  // RVOO). Dibatasi panjang >= 4 supaya token kripto pendek seperti RAY, RSR,
  // RDNT tidak ikut tersaring.
  if (base.startsWith("R") && base.length >= 4 && !R_CRYPTO_BASES.has(base)) return "tokenized_equity";
  return "crypto";
}

export function isCrypto(symbol) {
  return classifyAsset(symbol) === "crypto";
}

/**
 * Saring daftar simbol sesuai kelas aset yang diizinkan.
 * @returns {{ kept: Array, excluded: Array, excludedByClass: Record<string, number> }}
 */
export function filterUniverseByAssetClass(items, { allowTokenized = false, symbolOf = (i) => i.symbol } = {}) {
  const kept = [];
  const excluded = [];
  const excludedByClass = {};

  for (const item of items) {
    const assetClass = classifyAsset(symbolOf(item));
    if (assetClass === "crypto" || allowTokenized) {
      kept.push(item);
    } else {
      excluded.push(item);
      excludedByClass[assetClass] = (excludedByClass[assetClass] || 0) + 1;
    }
  }

  return { kept, excluded, excludedByClass };
}
