# Coinkit — Bitget Market Screener & Trailing Stop Tracker

Coinkit adalah asisten analisis crypto (Spot & Futures Bitget): market data
realtime → screener → technical analysis → trailing stop otomatis → riwayat
& performa. **Coinkit TIDAK PERNAH melakukan auto trading** — tidak ada satu
baris kode pun yang memanggil order API Bitget. Semua BUY/SELL/LONG/SHORT
dilakukan manual oleh Anda di aplikasi Bitget.

---

## 1. Prasyarat

- Node.js 18 atau lebih baru
- Akun GitHub (gratis)
- Akun Vercel (gratis, daftar pakai akun GitHub)
- Akun Supabase (gratis, untuk database)

Tidak perlu API key Bitget untuk menjalankan aplikasi ini — semua data market
memakai endpoint publik.

---

## 2. Upload ke GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/Coinkit.git
git push -u origin main
```

Kalau hanya punya HP: pakai Termux (`pkg install git unzip`, extract zip,
`git add -A && git commit && git push`) atau GitHub Codespaces lewat browser.

---

## 3. Setup Database (Supabase)

**Instalasi baru:**
1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan seluruh isi `db/schema.sql`.
3. Buka **Project Settings → API**, catat **Project URL** dan **service_role key**.

**Kalau sudah punya database dari versi sebelumnya** (sebelum fitur trailing
stop): jalankan `db/migration_002_trailing_sl.sql` juga di SQL Editor — aman
dijalankan berkali-kali, hanya menambah kolom baru tanpa menghapus data lama.

**PENTING:** `service_role key` punya akses penuh ke database — hanya boleh
masuk sebagai Environment Variable di Vercel, tidak pernah di kode frontend.

---

## 4. Deploy ke Vercel

1. `vercel.com/new` → Import repo `Coinkit`.
2. Isi Environment Variables:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL dari Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key dari Supabase |
   | `WORKER_SECRET` | string acak minimal 20 karakter buatan sendiri |
   | `BITGET_API_BASE_URL` | `https://api.bitget.com` |

   **Jangan isi** `BITGET_API_KEY`, `BITGET_API_SECRET`, `BITGET_API_PASSPHRASE`.

3. Klik **Deploy**.

---

## 5. Monitoring otomatis (worker)

Vercel Hobby Cron cuma jalan 1x/hari (`vercel.json` sudah berisi ini sebagai
fallback). Untuk pemantauan lebih cepat (menit-an), daftar
[cron-job.org](https://cron-job.org) gratis, buat cron job:

- **URL**: `https://domain-anda.vercel.app/api/worker/evaluate-predictions?secret=ISI_WORKER_SECRET`
- **Interval**: setiap 5 menit
- **Method**: GET

---

## 6. Struktur Aplikasi

- **Dashboard (`/`)** — watchlist realtime, chart candlestick dengan indikator
  (MA/EMA/BOLL overlay, VOL/MACD/RSI subchart), Total Market Cap & BTC
  Dominance (dari CoinGecko, gratis).
- **Opportunities (`/opportunities`)** — ranking coin berdasarkan momentum,
  volume, liquidity, breakout.
- **Screener (`/scanner`)** — kartu per-coin dengan arah (BULLISH/BEARISH),
  alasan, level Entry/SL/TP, dan korelasi terhadap BTC.
- **Screener History (`/screener-history`)** — ringkasan performa (TP hit
  rate, avg R, opportunity capture) + tabel riwayat setiap setup yang
  otomatis tercatat dari Screener (score ≥ 60), dibandingkan dengan
  pergerakan market yang sesungguhnya.

---

## 7. Trailing Stop Adaptif

Setiap setup yang tercatat dari Screener (score ≥ 60) memakai **trailing stop
loss otomatis**, bukan TP/SL kaku:

1. **Breakeven** — begitu profit mengambang mencapai 1x jarak SL awal, SL
   pindah ke harga entry (posisi tidak mungkin lagi rugi).
2. **Trailing** — setelah breakeven aktif, SL terus mengikuti titik ekstrem
   harga dikurangi jarak berbasis ATR — SL cuma bisa bergerak ke arah yang
   menguntungkan, tidak pernah mundur.
3. **Adaptif terhadap BTC** — jarak trailing disesuaikan dengan korelasi coin
   ke BTC dan arah tren BTC saat setup dicatat: korelasi tinggi + BTC searah
   → trailing dilonggarkan (potensi profit tidak dibatasi); BTC melawan arah
   → trailing diperketat.

TP1/TP2/TP3 pada setup baru jadi **penanda referensi** (dicatat kapan
tersentuh), bukan lagi titik keluar paksa — exit sesungguhnya selalu lewat
mekanisme stop yang bergerak ini. Setup lama (sebelum fitur ini ada) tetap
memakai SL tetap seperti semula, tidak berubah.

---

## 8. Prinsip Keamanan

- Tidak ada API key trading yang diminta di mana pun dalam aplikasi ini.
- Semua Score (Screener Score, Technical Score) **bukan probability**.
- Level TP/SL/trailing adalah **referensi teknikal**, bukan jaminan profit.
- Selalu cek ulang manual sebelum mengambil keputusan trading di Bitget.

---

## 9. Struktur Project

```
coinkit/
├── app/                    → Halaman & API routes
├── lib/
│   ├── bitget/               → Client Bitget (fetch, cache, parser)
│   ├── coingecko/             → Client CoinGecko (market cap, dominance)
│   ├── screener/               → Screener Engine + trailing/korelasi BTC
│   ├── technical/               → Technical Analysis Engine
│   ├── risk/                     → stopLoss.js, takeProfit.js (dipakai Screener)
│   ├── outcome/                    → Outcome monitoring (SL tetap + trailing)
│   ├── performance/                  → Agregasi statistik performa
│   └── db/                             → Akses Supabase
├── db/schema.sql              → Skema database (instalasi baru)
├── db/migration_002_trailing_sl.sql → Migrasi untuk database lama
└── test/                       → Unit test (jalankan: npm test)
```

## 10. Menjalankan Lokal

```bash
npm install
cp .env.example .env.local
npm run dev
npm test
npm run build
```
