// ═══════════════════════════════════════════════════════════════════
// PROXY + CACHE UNTUK FITUR JADWAL ANIME
// Tempel blok ini ke backend Express kamu di Railway (file yang sama
// tempat route lain kayak /api/v1/info atau /api/push/* didefinisikan),
// SEBELUM app.listen(...).
//
// Kenapa ini perlu: sebelumnya browser tiap user langsung fetch ke Jikan
// API (api.jikan.moe). Jikan itu API publik gratis dengan rate limit
// ketat (~3 req/detik), jadi kalau banyak user buka bareng, semua kena
// HTTP 429/504. Dengan proxy ini, HANYA server kamu yang fetch ke Jikan
// (maksimal 1x per 30 menit per hari/kategori), lalu di-cache di memori
// dan dibagikan ke semua user dari server kamu sendiri — jadi user gak
// pernah langsung kena rate limit Jikan lagi, dan responnya jauh lebih
// cepat karena sudah di-cache.
//
// Setelah kamu tambahkan ini & deploy ulang backend Railway-nya, frontend
// (index.html) akan otomatis pakai endpoint ini duluan (sudah saya set
// di kode frontend-nya). Kalau belum sempat ditambahkan, frontend tetap
// jalan seperti biasa (fallback langsung ke Jikan), cuma belum seaman ini.
// ═══════════════════════════════════════════════════════════════════

const animeCache = {}; // key -> { data, ts }
const ANIME_CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit

async function fetchJikan(url) {
  const res = await fetch(url); // Node 18+ sudah punya fetch bawaan
  if (!res.ok) throw new Error('Jikan HTTP ' + res.status);
  return res.json();
}

async function getCachedAnime(key, url) {
  const c = animeCache[key];
  if (c && (Date.now() - c.ts) < ANIME_CACHE_TTL_MS) return c.data;
  const data = await fetchJikan(url);
  animeCache[key] = { data, ts: Date.now() };
  return data;
}

// GET /api/anime/schedule?day=monday
app.get('/api/anime/schedule', async (req, res) => {
  const day = String(req.query.day || '').toLowerCase();
  const allowedDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (!allowedDays.includes(day)) {
    return res.status(400).json({ error: 'Parameter day tidak valid' });
  }
  try {
    const data = await getCachedAnime('schedule:' + day, `https://api.jikan.moe/v4/schedules?filter=${day}&sfw=true`);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Gagal ambil data dari Jikan', detail: e.message });
  }
});

// GET /api/anime/upcoming
app.get('/api/anime/upcoming', async (req, res) => {
  try {
    const data = await getCachedAnime('upcoming', 'https://api.jikan.moe/v4/seasons/upcoming?sfw=true&limit=25');
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Gagal ambil data dari Jikan', detail: e.message });
  }
});
