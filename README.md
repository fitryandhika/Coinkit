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

**Kalau sudah punya database dari versi sebelumnya**, jalankan migrasi berurutan
di SQL Editor. Semua aman dijalankan berkali-kali:

1. `db/migration_002_trailing_sl.sql` — kolom trailing stop & korelasi BTC.
2. `db/migration_003_calibration.sql` — **mesin kalibrasi score**.
3. `db/migration_004_entry_quality.sql` — **kelayakan harga entry** (entry_score,
   risk_reward, chase_gap_pct, extension_atr). Tidak menghapus apa pun.

> **Perhatian pada migrasi 003:** migrasi ini MENGHAPUS tabel `manual_trades`
> dan kolom `user_action` (fitur jurnal trading manual dibuang). Kalau ada data
> jurnal yang masih ingin disimpan, backup dulu sebelum menjalankannya.

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
  alasan, level Entry/SL/TP, korelasi terhadap BTC, dan **kelayakan harga
  entry** (lihat bagian 7b). Daftar diurutkan "Entry terbaik" dan secara
  default menyembunyikan coin yang harganya sudah kemahalan.
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

## 7b. Kelayakan Harga Entry (Entry Quality)

Skor screener menilai **seberapa kuat** sebuah gerakan. Itu tidak sama dengan
**seberapa layak harganya dimasuki sekarang** — coin yang sudah lari 40% justru
mendapat momentum score paling tinggi, padahal itu entry paling berisiko:
jarak ke stop loss membesar sementara ruang ke target menyempit.

`lib/screener/entryQuality.js` mengukur POSISI harga, bukan kekuatannya. Semua
jarak dinyatakan dalam satuan ATR (bukan persen mentah), supaya adil untuk coin
volatil maupun coin kalem — 5% di BTC dan 5% di altcoin receh bukan jarak yang
sama.

| Komponen | Bobot | Yang diukur |
|---|---|---|
| Extension | 30% | Jarak harga ke EMA20. Mendeteksi lilin parabolik. |
| Chase | 25% | Jarak harga MELEWATI level pemicu (previous high/low). Menangkap "telat masuk setelah breakout". |
| Leg | 20% | Panjang kaki gerakan dari swing terakhir. |
| Risk:Reward | 25% | (TP1 − harga sekarang) / (harga sekarang − SL). Masih ada ruang untung, atau tinggal sisa? |

Hasilnya `entryScore` 0–100 dan label:

- **GOOD** (≥ 70) — harga masih di zona wajar.
- **FAIR** (≥ 52) — masih bisa dipertimbangkan.
- **EXTENDED** (≥ 32) — sudah agak jauh, penalti −8 poin.
- **OVEREXTENDED** (< 32) — kemahalan, penalti −20 poin.

Pengaruhnya ke aplikasi:

1. **Penalti masuk ke screenerScore**, jadi coin kemahalan turun peringkat
   dengan sendirinya — bukan sekadar disembunyikan.
2. **Urutan default "Entry terbaik"** = 60% skor setup + 40% kelayakan harga.
   Bisa diganti ke "Skor setup" atau "Harga termurah" lewat dropdown Urutkan.
3. **Filter "Kualitas Entry"** (default: sembunyikan yang kemahalan) dan filter
   **Min. R:R**. Jumlah coin yang tersaring ditampilkan di bawah filter.
4. **Saran harga retest** — untuk setup yang sudah terlanjur jauh, kartu
   menampilkan harga pullback yang lebih sehat untuk ditunggu (diambil dari
   EMA20, level yang baru ditembus, atau harga − 1 ATR; mana yang paling dekat).
5. **Auto-record tidak mencatat setup OVEREXTENDED** sebagai rekomendasi, tapi
   masih mengizinkannya masuk *control group*. Ini disengaja: mesin kalibrasi
   jadi bisa MEMBUKTIKAN apakah menyaringnya memang menaikkan win rate, bukan
   sekadar asumsi.

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
│   ├── performance/                  → Mesin kalibrasi score (realized R, fee, atribusi)
│   └── db/                             → Akses Supabase
├── db/schema.sql              → Skema database (instalasi baru)
├── db/migration_002_trailing_sl.sql → Migrasi: trailing stop
├── db/migration_003_calibration.sql → Migrasi: kalibrasi score (drop jurnal)
├── db/migration_004_entry_quality.sql → Migrasi: kelayakan harga entry
└── test/                       → Unit test (jalankan: npm test)
```

## 9b. Cara Membaca Halaman Kalibrasi

Halaman **Kalibrasi** menjawab satu pertanyaan: apakah Screener Score benar-benar
memprediksi hasil di market, atau cuma angka yang terlihat meyakinkan.

- **Vonis** — korelasi peringkat (Spearman) antara score dan hasil nyata, plus
  uji signifikansi kasar. `NO_EDGE` berarti score belum terbukti berguna; itu
  hasil yang sah, bukan error.
- **Hasil per Rentang Score** — kalau score bekerja, kolom Avg R harus naik dari
  bucket 60-69 ke 90-100. Baris redup = sampel masih di bawah 10.
- **Pembanding (control group)** — sekitar 6% setup yang TIDAK lolos ambang 60
  tetap dicatat diam-diam sebagai pembanding acak. Tanpa ini, win rate 55% tidak
  bisa dinilai: bisa saja entry acak juga menghasilkan 55%.
- **Kontribusi Komponen** — korelasi tiap sub-score terhadap hasil, lalu usulan
  bobot. Usulan TIDAK diterapkan otomatis; ubah manual di
  `lib/screener/config.js` kalau Anda setuju.

Semua nilai R sudah dikurangi fee taker Bitget (spot 0.1%, futures 0.06% per
sisi). Vonis baru muncul setelah 40 setup selesai dievaluasi; usulan bobot
setelah 80 setup per komponen.

---

## 10. Menjalankan Lokal

```bash
npm install
cp .env.example .env.local
npm run dev
npm test
npm run build
```
