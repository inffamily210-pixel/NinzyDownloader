# NinzyDownloader Backend

Backend kecil buat fitur download video TikTok & YouTube di NinzyCompress.
Pakai yt-dlp (Python) + ffmpeg lewat Node.js, dijalankan di **Railway** —
BUKAN di Vercel, karena Vercel serverless function tidak cocok untuk
menjalankan proses yt-dlp/ffmpeg (limit waktu eksekusi & tidak ada binary
Python/ffmpeg secara default).

## Deploy ke Railway

1. Push folder ini ke repo GitHub baru (atau upload manual via Railway CLI).
2. Di Railway: **New Project → Deploy from GitHub repo**, pilih repo ini.
3. Railway otomatis detect `Dockerfile` dan build image-nya (sudah include
   Python3, ffmpeg, dan yt-dlp terbaru).
4. Set environment variable (opsional):
   - `ALLOWED_ORIGINS` = domain Vercel NinzyCompress kamu, contoh:
     `https://ninzycompress.vercel.app` (boleh lebih dari satu, pisah koma).
     Kalau tidak diset, default izinkan semua origin (`*`).
5. Setelah deploy selesai, Railway kasih domain publik, contoh:
   `https://ninzy-downloader-production.up.railway.app`
6. Tes dulu buka `https://<domain-railway-kamu>/api/health` di browser —
   kalau muncul `{"success":true,"ytdlpVersion":"..."}` berarti sudah beres.

## Sambungkan ke NinzyCompress (index.html)

Di file `index.html`, cari baris:

```js
const DL_API_BASE = 'GANTI_DENGAN_URL_RAILWAY_KAMU';
```

Ganti dengan domain Railway dari langkah 5 di atas (tanpa trailing slash),
misal:

```js
const DL_API_BASE = 'https://ninzy-downloader-production.up.railway.app';
```

Setelah itu redeploy `index.html` ke Vercel seperti biasa. Fitur
"📥 Downloader TikTok & YouTube" di halaman NinzyCompress akan langsung
manggil backend ini.

## Endpoint

- `GET  /api/health` — cek server & versi yt-dlp
- `POST /api/info` — body `{ "url": "..." }`, balikin judul/thumbnail/durasi
  + daftar pilihan kualitas
- `GET  /api/download?url=...&quality=best|1080|720|480|audio` — stream file
  hasil download langsung ke browser

## Catatan

- Setiap request `/api/download` bikin folder temp, download lewat yt-dlp,
  stream ke user, lalu folder temp dihapus otomatis — jadi tidak numpuk file
  di server.
- Ada rate limit sederhana (12 request/menit per IP) supaya server tidak
  kebanjiran.
- yt-dlp di-install lewat `pip install -U yt-dlp` saat build image, jadi kalau
  suatu saat TikTok/YouTube ubah sistem dan yt-dlp perlu update, tinggal
  **redeploy ulang** di Railway (Railway akan build ulang image dengan yt-dlp
  versi terbaru).
