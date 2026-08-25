// Logo koin dari CDN publik gratis (cryptocurrency-icons via jsdelivr) — resource statis,
// diambil langsung oleh browser, TIDAK melewati serverless function kita sama sekali.
// Jadi tidak menambah pemakaian kuota Vercel Hobby (function invocations) sedikit pun.
const ICON_BASE_URL = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color";

// Beberapa base asset di exchange kadang beda ticker dari file ikon standar
const SYMBOL_OVERRIDES = {
  IOTA: "miota",
};

export function getCoinBaseAsset(symbol) {
  if (!symbol) return null;
  // Buang suffix quote currency yang umum di Bitget (USDT, USDC, BTC, ETH, dst)
  const match = symbol.match(/^([A-Z0-9]+?)(USDT|USDC|USD|BTC|ETH|EUR)$/);
  return match ? match[1] : symbol;
}

export function getCoinIconUrl(symbol) {
  const base = getCoinBaseAsset(symbol);
  if (!base) return null;
  const key = (SYMBOL_OVERRIDES[base] || base).toLowerCase();
  return `${ICON_BASE_URL}/${key}.png`;
}
