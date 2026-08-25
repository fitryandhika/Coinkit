# CryptoAI — Bitget Market Analysis & Manual Trading Assistant

CryptoAI adalah asisten analisis crypto (Spot & Futures Bitget): market data
realtime → screener → technical analysis → risk engine → AI trading assistant
→ trade history + outcome tracking.

**CryptoAI TIDAK PERNAH melakukan auto trading.** Tidak ada satu baris kode
pun yang memanggil order API Bitget. Semua BUY/SELL/LONG/SHORT dilakukan
manual oleh Anda di aplikasi Bitget.

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

1. Extract file zip ini ke folder di komputer Anda.
2. Buka terminal di folder tersebut, jalankan:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   ```
3. Buat repository baru di github.com (kosong, tanpa README), lalu:
   ```bash
   git remote add origin https://github.com/USERNAME/cryptoai.git
   git push -u origin main
   ```

Kalau Anda hanya punya HP: buka github.com di browser, buat repo baru, lalu
upload semua file lewat tombol "Add file → Upload files" (bisa upload folder
di browser modern), atau pakai github.dev (tekan tombol `.` setelah membuka
repo) untuk edit langsung dari browser.

---

## 3. Setup Database (Supabase) — WAJIB sebelum deploy

1. Buka [supabase.com](https://supabase.com), daftar/login, klik **New Project**.
2. Catat **Database Password** yang dibuat (simpan baik-baik, tidak dipakai
   langsung di app ini tapi baik untuk disimpan).
3. Setelah project selesai dibuat, buka menu **SQL Editor** di sidebar kiri.
4. Buka file `db/schema.sql` dari project ini, salin seluruh isinya, tempel
   ke SQL Editor, lalu klik **Run**. Ini akan membuat 4 tabel: `ai_predictions`,
   `prediction_snapshots`, `prediction_outcomes`, `manual_trades`.
5. Buka menu **Project Settings → API**. Catat dua nilai ini:
   - **Project URL** (contoh: `https://xxxxx.supabase.co`)
   - **service_role key** (bukan `anon` key — cari yang bertuliskan
     "service_role", biasanya di bawah anon key, dan ditandai rahasia)

**PENTING soal `service_role key`:** key ini punya akses penuh ke database
Anda, mem-bypass semua Row Level Security. **Jangan pernah** menaruhnya di
kode frontend atau commit ke GitHub sebagai file biasa — key ini hanya boleh
masuk sebagai Environment Variable di Vercel (langkah berikutnya), yang mana
hanya dibaca oleh kode `route.js` di server, tidak pernah dikirim ke browser.

---

## 4. Deploy ke Vercel

1. Buka [vercel.com/new](https://vercel.com/new), login pakai akun GitHub.
2. Pilih **Import** pada repository `cryptoai` yang barusan Anda push.
3. Di layar konfigurasi, buka bagian **Environment Variables** dan isi:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL dari Supabase (langkah 3) |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key dari Supabase (langkah 3) |
   | `WORKER_SECRET` | string acak buatan sendiri, contoh: `openssl rand -hex 16` di terminal, atau ketik bebas 20+ karakter |
   | `BITGET_API_BASE_URL` | `https://api.bitget.com` |

   **Jangan isi** `BITGET_API_KEY`, `BITGET_API_SECRET`,
   `BITGET_API_PASSPHRASE` — biarkan kosong. Fitur di aplikasi ini tidak
   membutuhkannya, dan mengisinya tidak akan mengaktifkan fitur apa pun (belum
   ada kode yang membacanya untuk eksekusi).

4. Klik **Deploy**. Tunggu 2-3 menit sampai selesai.
5. Setelah selesai, buka URL yang diberikan Vercel (contoh:
   `https://cryptoai-xxxx.vercel.app`). Aplikasi sudah bisa dipakai.

Setiap kali Anda push perubahan ke GitHub, Vercel otomatis re-deploy.

---

## 5. Aktifkan monitoring prediction otomatis (opsional tapi disarankan)

Vercel Cron di plan gratis (Hobby) **hanya bisa jalan 1x/hari** — ini batasan
resmi dari Vercel, bukan batasan aplikasi ini. `vercel.json` sudah berisi 1
cron harian sebagai fallback, jadi prediction tetap akan dievaluasi meskipun
Anda skip langkah ini — hanya saja evaluasinya bisa telat sampai 24 jam.

Untuk pemantauan lebih cepat (menit-an, cocok untuk prediction timeframe
5m/15m), daftar scheduler eksternal gratis:

1. Buka [cron-job.org](https://cron-job.org), daftar gratis.
2. Buat cron job baru:
   - **URL**: `https://domain-vercel-anda.vercel.app/api/worker/evaluate-predictions?secret=ISI_WORKER_SECRET_ANDA`
     (ganti `ISI_WORKER_SECRET_ANDA` dengan nilai `WORKER_SECRET` yang Anda isi
     di langkah 4)
   - **Interval**: setiap 5 menit
   - **Request method**: GET
3. Simpan. Sekarang prediction akan dicek setiap 5 menit tanpa perlu upgrade
   plan Vercel apa pun.

---

## 6. Tutorial pemakaian aplikasi (alur aman untuk trading)

Ini bukan robot trading — anggap sebagai co-pilot yang menyiapkan analisis
dan rencana, sementara **Anda** yang menekan tombol beli/jual di Bitget.

### Langkah 1 — Kenali kondisi market (Dashboard `/`)
Buka halaman utama. Lihat watchlist, chart candlestick, dan Top Opportunities.
Ini gambaran umum, belum ada keputusan apa pun.

### Langkah 2 — Cari kandidat (`/opportunities`)
Screener meranking coin berdasarkan momentum/volume/liquidity/volatility/
breakout — **bukan sinyal beli**, murni "coin mana yang layak dianalisis
lebih lanjut". Klik satu coin untuk lihat detail skor & alasannya.

### Langkah 3 — Analisis teknikal (`/scanner`, klik simbol, atau tombol
"Technical Analysis" dari Opportunities)
Lihat RSI, MACD, trend, struktur market, support/resistance. Semua di sini
murni deskriptif — tidak ada rekomendasi beli/jual.

### Langkah 4 — Atur Trading Profile Anda (di halaman `/risk` atau
`/assistant`)
**Sebelum minta rencana apa pun, isi dulu:**
- **Capital**: modal yang benar-benar siap Anda pakai untuk trading (bukan
  seluruh tabungan).
- **Risk per Trade**: berapa persen dari capital yang rela hilang per trade.
  Mulai dari yang kecil (0.5%–1%) kalau Anda baru mulai.
- **Risk Profile**: CONSERVATIVE kalau baru belajar, jangan langsung
  AGGRESSIVE.

### Langkah 5 — Minta AI Trading Assistant menganalisis (`/assistant`)
Masukkan symbol, klik **Analyze**. AI akan menggabungkan semua skor di atas
dan memberi salah satu dari: `LONG`/`SHORT`/`BUY`/`SELL`/`WAIT`.
**`WAIT` adalah jawaban yang valid dan sering kali yang paling benar** —
jangan menganggapnya sebagai "AI error" atau memaksa cari sinyal lain sampai
dapat LONG/SHORT.

Baca bagian **AI Reasoning**: evidence bullish, evidence bearish, dan
conflict (kalau ada). Kalau confidence rendah atau banyak conflict, itu
sinyal untuk lebih berhati-hati, bukan diabaikan.

### Langkah 6 — Cek Manual Execution Checklist
Sebelum eksekusi, pastikan semua item checklist tercentang: market regime
sudah dicek, entry jelas, stop loss ada, risk masih dalam batas, R:R
memadai, tidak ada warning besar.

### Langkah 7 — ANDA yang memutuskan dan trading manual di Bitget
Buka aplikasi/website **Bitget resmi** di device Anda, login ke akun Bitget
Anda sendiri, dan lakukan order **secara manual** sesuai (atau berbeda dari)
trade plan yang diberikan — keputusan akhir selalu di tangan Anda.
CryptoAI **tidak pernah** dan **tidak bisa** mengeksekusikan order ini untuk
Anda.

### Langkah 8 — Catat hasilnya di CryptoAI
Kembali ke CryptoAI, tekan **TRADE TAKEN** kalau Anda benar-benar mengambil
trade tersebut (lalu isi form actual entry/exit/fee setelah closed), atau
**SKIPPED** kalau Anda memilih untuk tidak mengambilnya. Kedua-duanya
tersimpan — data `SKIPPED` sama pentingnya untuk menilai kualitas AI dari
waktu ke waktu.

### Langkah 9 — Pantau performa (`/history` dan `/performance`)
Setelah beberapa prediction terkumpul (idealnya puluhan, bukan 2-3), lihat
halaman Performance untuk menilai apakah skor AI di sini benar-benar
berkorelasi dengan pergerakan market yang menguntungkan, dipisahkan dari
performa eksekusi manual Anda sendiri.

---

## 7. Prinsip keamanan yang wajib dipahami

- **Tidak ada API key trading yang diminta di mana pun dalam aplikasi ini.**
  Kalau suatu saat Anda melihat form yang meminta API Secret/Passphrase
  Bitget untuk "fitur baru", itu BUKAN bagian dari desain awal aplikasi ini —
  berhenti dan tinjau ulang kodenya.
- Semua Score (Screener Score, Technical Score, AI Score, Confidence)
  **bukan probability**. "AI Score 84/100" tidak berarti "84% peluang
  profit" — itu cuma ukuran seberapa banyak kondisi teknikal yang selaras,
  berdasarkan aturan yang kita tetapkan sendiri, bukan hasil pembelajaran
  dari data historis riil (belum ada machine learning di sistem ini).
- Angka **liquidation price** untuk Futures adalah **estimasi kasar**, bukan
  angka resmi Bitget (kita tidak mengambil maintenance margin rate per-tier
  asli). Selalu cek ulang liquidation price sesungguhnya langsung di Bitget
  sebelum membuka posisi leverage.
- Jangan menaruh seluruh modal Anda berdasarkan satu skor AI. Mulai dengan
  posisi kecil, pantau performa historis di halaman `/performance` sebelum
  menambah keyakinan pada sistem ini.
- Data trade journal & trading profile Anda tersimpan di database Supabase
  Anda sendiri (bukan dikirim ke pihak ketiga manapun) dan di localStorage
  browser (untuk preferensi profil) — sepenuhnya milik Anda.

---

## 8. Struktur project

```
cryptoai/
├── app/                    → Halaman (Dashboard, Opportunities, Scanner,
│                              Risk Planner, AI Assistant, History, Performance)
│   └── api/                → Semua API routes (market data, screener,
│                              technical, risk, ai, predictions, worker)
├── lib/
│   ├── bitget/              → Client Bitget: fetch, cache, parser
│   ├── screener/             → Market Screener Engine
│   ├── technical/            → Technical Analysis Engine (RSI, MACD, dst)
│   ├── risk/                 → Risk Engine (position size, SL/TP, blocker)
│   ├── ai/                   → AI Trading Assistant (evidence, decision)
│   ├── outcome/               → Outcome monitoring (TP/SL/expiration)
│   ├── performance/           → Agregasi statistik performa
│   └── db/                    → Akses Supabase (predictions, snapshots, dst)
├── config/risk.js            → Semua parameter risk profile di satu tempat
├── components/                → UI reusable
├── hooks/                     → React hooks (WebSocket, trading profile, dst)
├── db/schema.sql              → Skema database Supabase
└── test/                      → Unit test (jalankan: npm test)
```

## 9. Menjalankan lokal (opsional, untuk development)

```bash
npm install
cp .env.example .env.local
# isi .env.local dengan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WORKER_SECRET
npm run dev
```
Buka http://localhost:3000

```bash
npm test        # unit test Risk Engine
npm run build   # build production, harus sukses sebelum deploy
```

## 10. Limitasi yang jujur perlu diketahui

- Vercel Hobby Cron cuma 1x/hari — pakai scheduler eksternal (langkah 5) untuk
  monitoring lebih cepat.
- Supabase free tier punya batas row & bandwidth bulanan — cukup untuk
  pemakaian personal, tapi perlu diawasi kalau volume prediction sangat besar.
- Liquidation price Futures adalah estimasi kasar (lihat bagian 7).
- Belum ada machine learning — semua score adalah rumus tertimbang yang bisa
  dilihat & diubah di `config/risk.js`, `lib/screener/config.js`,
  `lib/technical/config.js`, `lib/ai/config.js`.
- WebSocket realtime hanya dipakai untuk watchlist Dashboard; halaman lain
  (Scanner, Opportunities) memakai REST polling agar tidak membuka ratusan
  koneksi WebSocket sekaligus.
