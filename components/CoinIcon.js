"use client";

import { useState } from "react";
import { getCoinIconUrl, getCoinBaseAsset } from "@/lib/utils/coinIcon";

/**
 * Logo koin dari CDN gratis. Kalau gambar gagal dimuat (koin tidak ada di CDN
 * ikon), otomatis jatuh ke lingkaran inisial huruf — tidak pernah broken image.
 */
export default function CoinIcon({ symbol, size = 24 }) {
  const [failed, setFailed] = useState(false);
  const base = getCoinBaseAsset(symbol);
  const iconUrl = getCoinIconUrl(symbol);

  if (failed || !iconUrl) {
    return (
      <span
        className="coin-icon-fallback"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        {base ? base.slice(0, 2) : "?"}
      </span>
    );
  }

  return (
    <img
      src={iconUrl}
      alt={base || symbol}
      width={size}
      height={size}
      className="coin-icon-img"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
