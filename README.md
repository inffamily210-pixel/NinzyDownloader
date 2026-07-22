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
4. Set environment variable:
   - `ALLOWED_ORIGINS` (opsional) = domain Vercel NinzyCompress kamu, contoh:
     `https://ninzycompress.vercel.app` (boleh lebih dari satu, pisah koma).
     Kalau tidak diset, default izinkan semua origin (`*`).
   - `FIREBASE_SERVICE_ACCOUNT` = isi JSON service account Firebase (buat semua
     fitur premium/admin/push/creator-watch/API key).
   - `ADMIN_PIN` = PIN buat masuk admin panel dari NinzyCompress.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` = kredensial push notification
     (Web Push). **Sudah digenerate, tinggal pakai** — lihat riwayat chat
     buat nilainya, atau generate ulang sendiri kalau mau ganti:
     `node -e "console.log(require('web-push').generateVAPIDKeys())"`
     setelah `npm install`. **JANGAN commit private key ke git.**
   - `VAPID_SUBJECT` (opsional, default `mailto:admin@ninzycompress.com`) =
     email kontak buat push service kalau ada masalah pengiriman.
   - `CREATOR_WATCH_INTERVAL_MINUTES` (opsional, default `30`) = interval cron
     cek upload baru dari creator yang di-bookmark user.
   - `API_KEY_RATE_PER_MIN` (opsional, default `60`) = rate limit per API key
     developer di endpoint `/api/v1/*`.
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
- `POST /api/info` — body `{ "url": "..." }`, balikin judul/thumbnail/durasi,
  statistik (view/like/komentar/repost), tanggal upload, status live/
  upcoming, status verifikasi akun pembuat, info musik latar (kalau
  terdeteksi), + daftar pilihan kualitas (termasuk `music` buat download
  lagunya doang, dan `photos_video` buat slideshow foto → 1 video)
- `GET  /api/download?url=...&quality=...` — stream file hasil download.
  Kualitas didukung: `best|1080|720|480|audio|audio_opus|music|photos|
  photos_video|thumbnail|subtitle`
- `GET  /api/creator-profile?url=...` — profil pembuat video (nama, avatar,
  followers, bio, status verifikasi, total video). `url` di sini adalah
  link profil/channel, bukan link video
- `GET  /api/creator-videos?url=...&all=1` — daftar video dari creator yang
  sama. Tanpa `all=1`: maks 8 video (buat "video terkait"). Dengan `all=1`:
  maks 30 video (buat mode "lihat semua video akun ini")
- `POST /api/creator-download-all` — body `{ "profileUrl": "...", "quality":
  "best" }`, download sampai 15 video terbaru dari 1 akun sekaligus,
  dibundling jadi ZIP (sama seperti batch-download tapi sumbernya dari scan
  profil, bukan link manual)

### Push Notification (Web Push / VAPID)
- `GET  /api/push/public-key` — balikin VAPID public key buat frontend subscribe
- `POST /api/push/subscribe` — body `{ subscription, email? }`, simpan push
  subscription browser ke Firestore (`pushSubscriptions`)
- `POST /api/push/unsubscribe` — body `{ endpoint }`
- `POST /api/push/send` — body `{ endpoint, type, data? }`. `type` dibatasi ke
  preset di `PUSH_PRESETS` (`compress-done`, `test`) — bukan title/body bebas

### Creator Watch (alert upload baru dari creator favorit)
- `POST /api/creator-watch/subscribe` — body `{ uploaderUrl, name, platform,
  avatar, endpoint }`. Push subscription (`endpoint`) harus sudah terdaftar
  duluan lewat `/api/push/subscribe`
- `POST /api/creator-watch/unsubscribe` — body `{ uploaderUrl, endpoint }`
- Cron internal jalan otomatis tiap `CREATOR_WATCH_INTERVAL_MINUTES` (default
  30 menit), sequential + jeda 2 detik antar-creator biar tidak membebani
  server gratisan

### API Access developer (fitur #113 di showcase NinzyCompress)
- `POST /api/developer/keys` — bikin API key baru. Wajib header
  `Authorization: Bearer <Firebase ID token>` dari akun **login Google** yang
  status premium-nya aktif (`users/{email}.premiumExpiry` di Firestore).
  Plaintext key cuma ditampilkan SEKALI di response ini
- `GET  /api/developer/keys` — daftar key milik akun (masked, tanpa plaintext)
- `POST /api/developer/keys/:keyId/revoke` — cabut 1 key
- `POST /api/v1/info` dan `GET /api/v1/download` — versi developer dari
  `/api/info` & `/api/download` di atas (parameter sama persis), wajib header
  `X-API-Key: ninzy_live_...`, rate limit per key (`API_KEY_RATE_PER_MIN`,
  default 60/menit) — dipisah dari rate limit per-IP yang dipakai endpoint
  browser biasa

### Admin (butuh header `x-admin-token` dari `/api/admin/login`, lihat kode)
- `GET  /api/admin/api-keys` — daftar semua API key semua user (pantau abuse)
- `POST /api/admin/api-keys/:keyId/revoke` — cabut paksa 1 key
- `GET  /api/admin/creator-watch` — daftar creator yang lagi dipantau cron +
  jumlah subscriber tiap creator

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
- API Access developer **cuma bisa dipakai user yang login pakai Google**
  (bukan sistem login email/password lokal NinzyCompress yang lama), karena
  verifikasi identitas premium di endpoint `/api/developer/keys` pakai
  Firebase ID token (`admin.auth().verifyIdToken`) — satu-satunya cara di app
  ini yang bisa diverifikasi server tanpa bisa dipalsukan dengan kirim email
  mentah. User premium yang cuma pakai login lama perlu login Google juga
  (boleh sekali saja, tidak perlu ganti akun) buat generate API key.
- `/api/v1/info` dan `/api/v1/download` baru membungkus `info`+`download`
  (engine inti). `creator-profile`/`creator-videos` belum ada versi `/v1`-nya
  — tinggal tambah kalau memang dibutuhkan developer eksternal nanti.
