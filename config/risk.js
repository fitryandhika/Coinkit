export const RISK_CONFIG = {
  ATR_MULTIPLIER: 1.5,
  DEFAULT_TP_RR_MULTIPLIERS: [2, 3, 5],

  // --- Batas R:R target ------------------------------------------------------
  // Kalibrasi 2026-09-04: 45% setup punya R:R ke TP1 < 1.0 (median 0.92).
  // Dengan R:R 0.92, sistem butuh win rate >52% cuma untuk balik modal —
  // padahal win rate terukur 30%. Ini kegagalan desain target, bukan model.
  //
  // TP1 tidak boleh lebih dekat dari sekian R. Level struktur yang lebih
  // dekat dari ini DILEWATI, bukan dipakai lalu diberi penalti.
  MIN_RR_TP1: 1.5,
  // Level struktur yang lebih jauh dari ini tidak dipakai sebagai target —
  // TP di 8R praktis tidak pernah kena dan cuma membuang slot TP1.
  MAX_RR_STRUCTURE_TP: 6,
  // Jarak minimum antar target, dalam R. Dua target yang berimpit = satu target.
  MIN_RR_SPACING: 0.5,
  MAX_STOP_DISTANCE_PCT: 15,

  // --- Batas BAWAH jarak stop loss -------------------------------------------
  // Dulu hanya ada batas atas. Akibatnya resolveStopLoss() bebas menaruh SL di
  // pivot low terdekat yang kadang cuma 0.2-0.3% dari entry. Konsekuensinya:
  //   * 1R jadi lebih kecil daripada noise harga biasa -> SL kena karena getaran,
  //     bukan karena setup salah;
  //   * fee round-trip memakan porsi raksasa dari 1R (fee futures 0.12% terhadap
  //     risiko 0.3% = 0.4R hilang sebelum harga bergerak);
  //   * MFE/MAE dalam satuan R terlihat besar padahal pergerakannya biasa saja.

  // SL minimal sekian kali ATR. Ini penyesuai utama terhadap volatilitas coin.
  MIN_STOP_ATR_MULTIPLIER: 0.8,

  // Lantai mutlak, untuk coin yang ATR-nya tidak tersedia.
  MIN_STOP_DISTANCE_PCT: 0.5,

  // Fee round-trip tidak boleh melebihi porsi ini dari 1R. 0.15 berarti fee
  // maksimal 15% dari risiko -> untuk futures, risiko minimal 0.12/0.15 = 0.8%.
  MAX_FEE_SHARE_OF_RISK: 0.15,

  // Fee taker Bitget per sisi x 2. Harus sama dengan lib/performance/config.js,
  // supaya level yang dibuat dan hasil yang dihitung memakai asumsi yang sama.
  FEE_ROUNDTRIP_PCT: { spot: 0.2, futures: 0.12 },
};
