/**
 * Filter & urutan yang dipakai bersama oleh halaman Screener (kartu) dan
 * Top Opportunities (tabel). Sebelumnya logikanya disalin di dua tempat, jadi
 * setiap penambahan filter berisiko dua halaman berperilaku beda.
 */

export const ENTRY_QUALITY_RANK = { OVEREXTENDED: 0, EXTENDED: 1, UNKNOWN: 1, FAIR: 2, GOOD: 3 };

// UNKNOWN sengaja diberi peringkat 1: setup tanpa arah jelas tidak dianggap
// "kemahalan", tapi juga tidak boleh lolos saringan "hanya entry ideal".
const ENTRY_FILTER_MIN_RANK = { ANY: -1, HIDE_OVEREXTENDED: 1, GOOD_ONLY: 3 };

const LIQUIDITY_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, UNKNOWN: -1 };

export const DEFAULT_SCREENER_FILTERS = {
  minScore: 0,
  minVolume: 0,
  minLiquidity: "ANY",
  maxSpread: null,
  // Default sengaja menyaring, bukan menampilkan semua: daftar pertama yang
  // dilihat user harus sudah berisi harga yang masih layak dimasuki.
  entryQuality: "HIDE_OVEREXTENDED",
  minRiskReward: null,
};

export const SORT_MODES = [
  { value: "entryAdjustedScore", label: "Entry terbaik" },
  { value: "screenerScore", label: "Skor setup" },
  { value: "entryScore", label: "Harga termurah" },
];

export function applyScreenerFilters(results, filters) {
  const minEntryRank = ENTRY_FILTER_MIN_RANK[filters.entryQuality ?? "ANY"] ?? -1;

  return (results || []).filter((r) => {
    if ((r.screenerScore ?? -1) < (filters.minScore ?? 0)) return false;
    if ((r.volume24h ?? 0) < (filters.minVolume ?? 0)) return false;

    if (filters.minLiquidity && filters.minLiquidity !== "ANY") {
      const rank = LIQUIDITY_ORDER[r.liquidityLabel] ?? -1;
      const minRank = LIQUIDITY_ORDER[filters.minLiquidity] ?? 0;
      if (rank < minRank) return false;
    }

    if (filters.maxSpread !== null && filters.maxSpread !== undefined) {
      if (r.spreadPct !== null && r.spreadPct !== undefined && r.spreadPct > filters.maxSpread) return false;
    }

    if (minEntryRank >= 0) {
      const rank = ENTRY_QUALITY_RANK[r.entryLabel] ?? ENTRY_QUALITY_RANK.UNKNOWN;
      if (rank < minEntryRank) return false;
    }

    if (filters.minRiskReward !== null && filters.minRiskReward !== undefined) {
      // R:R tidak diketahui (arah netral / level belum bisa dihitung) ikut
      // tersaring saat user memasang batas minimum — lebih aman daripada lolos.
      if (!Number.isFinite(r.riskReward) || r.riskReward < filters.minRiskReward) return false;
    }

    return true;
  });
}

export function sortScreenerResults(results, sortKey, sortDir = "desc") {
  return [...results].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    if (typeof av === "string" || typeof bv === "string") {
      const diff = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? diff : -diff;
    }
    const diff = av - bv;
    return sortDir === "asc" ? diff : -diff;
  });
}
