export function analyzeOpenInterest({ market, openInterest }) {
  if (market !== "futures" || openInterest === null || openInterest === undefined) {
    return { openInterest: null, openInterestChange: null, note: "Data open interest tidak tersedia" };
  }
  return {
    openInterest,
    openInterestChange: null,
    note: "Perubahan OI belum dilacak dari waktu ke waktu pada tahap ini.",
  };
}
