// ═══════════════════════════════════════════════════════════════════
// NINZY AI — Backend proxy route ke xAI (Grok) API
// ═══════════════════════════════════════════════════════════════════
// PENTING SOAL KEAMANAN:
// - API key xAI HARUS di-set sebagai environment variable di Railway
//   (Project → Variables → tambah XAI_API_KEY), JANGAN ditulis langsung
//   di file ini, dan JANGAN di-commit ke git.
// - Frontend (index.html) TIDAK PERNAH menyimpan/mengirim API key ini.
//   Frontend cuma manggil endpoint /api/ninzy-ai/chat di backend kamu,
//   lalu backend inilah yang nyimpen key & neruskan request ke xAI.
// - Key yang sempat kamu kirim di chat sebelumnya sebaiknya di-revoke
//   dan diganti baru di console xAI, karena sudah pernah terekspos.
//
// Cara pasang:
// 1. Taruh file ini di folder backend (yang sama dengan server.js /
//    downloader-backend kamu di Railway).
// 2. Di server.js utama, daftarkan seperti route lain (dual /api dan
//    /api/v1, sama seperti pola yang sudah kamu pakai):
//
//      const ninzyAiRoute = require('./ninzyAiRoute');
//      app.use('/api', ninzyAiRoute);
//      app.use('/api/v1', ninzyAiRoute);
//
// 3. Di Railway dashboard → Variables, tambahkan:
//      XAI_API_KEY = <API key baru dari console xAI>
//    (opsional) XAI_MODEL = grok-4.3   ← ganti kalau xAI rilis model baru
//
// 4. Butuh Node.js 18+ (sudah ada fetch() bawaan). Kalau Railway kamu
//    pakai Node lebih lama, install node-fetch dan ganti baris fetch().
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();

const XAI_API_KEY = process.env.XAI_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.3';

const SYSTEM_PROMPT =
  'Kamu adalah "Ninzy Ai", asisten AI ramah di dalam aplikasi NinzyCompress ' +
  '(platform kompresi & downloader video). Jawab singkat, jelas, dan enak dibaca. ' +
  'Gunakan Bahasa Indonesia kecuali user menulis dalam bahasa lain. Kalau ditanya ' +
  'soal fitur NinzyCompress dan kamu tidak yakin detailnya, jujur bilang tidak tahu ' +
  'daripada mengarang.';

// Rate limit sederhana per-IP, disimpan di memori (reset kalau server
// restart/redeploy). Cukup untuk cegah spam/biaya membengkak. Untuk skala
// besar/multi-instance, pertimbangkan pindah ke Redis.
const RATE_LIMIT = 15;        // maksimal pesan
const RATE_WINDOW_MS = 60_000; // per 60 detik
const rateMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  rateMap.set(ip, entry);
  return entry.count > RATE_LIMIT;
}

router.post('/ninzy-ai/chat', async (req, res) => {
  try {
    if (!XAI_API_KEY) {
      XAI-api-key=xai-Oaw32izO2mTwnA0ddzn47VWsizbQYJfdkL7xFsuLPryPUONdtLr1OiBMgbeWiDmM2sOz2EmFHObIFMCG
    }
      console.error('[Ninzy Ai] XAI_API_KEY belum di-set di environment variables.');
      return res.status(500).json({ success: false, error: 'Ninzy Ai belum dikonfigurasi di server.' });
    }

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, error: 'Kebanyakan chat nih, tunggu sebentar ya sebelum lanjut lagi.' });
    }

    const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const trimmed = incoming
      .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .slice(-20); // batasi konteks yang dikirim ke API, hemat token & payload

    if (trimmed.length === 0) {
      return res.status(400).json({ success: false, error: 'Pesan kosong.' });
    }
    const lastMsg = trimmed[trimmed.length - 1];
    if (lastMsg.content.length > 4000) {
      return res.status(400).json({ success: false, error: 'Pesan terlalu panjang, coba dipersingkat.' });
    }

    const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + XAI_API_KEY
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await xaiRes.json().catch(() => ({}));

    if (!xaiRes.ok) {
      console.error('[Ninzy Ai] xAI API error:', xaiRes.status, data);
      return res.status(502).json({
        success: false,
        error: data?.error?.message || 'Ninzy Ai lagi gangguan, coba lagi sebentar lagi.'
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ success: false, error: 'Ninzy Ai tidak memberi balasan, coba lagi.' });
    }

    return res.json({ success: true, reply });
  } catch (e) {
    console.error('[Ninzy Ai] Server error:', e);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan di server.' });
  }
});

module.exports = router;
