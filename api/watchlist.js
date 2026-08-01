// Vercel KV-backed watchlist + portfolio sync endpoint
// GET    /api/watchlist?code=XYZ            -> { list: [...], portfolio: [...] }
// POST   /api/watchlist?code=XYZ  body=JSON  -> { ok: true }
//        body: { list: [...], portfolio: [...] }  (ikisi de opsiyonel)
//
// "code" kullanıcı tarafından seçilen sync anahtarı (örn. "atahan-7a2b").
// Aynı kodu farklı cihazlarda kullanırsan hem portföyün hem izleme listen senkron olur.
//
// KURULUM:
// 1) Vercel dashboard → bu proje → Storage → Create Database → KV (Upstash)
// 2) Connect to project → env varlar otomatik gelir (KV_REST_API_URL, KV_REST_API_TOKEN, ...)
// 3) Redeploy

import { kv } from '@vercel/kv';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const MAX_LIST_BYTES = 64 * 1024; // 64 KB güvenlik üst sınırı

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age',       '86400');
}

function validCode(c) {
  return typeof c === 'string' && /^[a-z0-9_\-]{4,40}$/i.test(c);
}

// Hem izleme listesi hem portföy aynı şemayı kullanır: { symbol, market, query }
function cleanList(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const symbol = String(it.symbol || '').toUpperCase().slice(0, 8);
    const market = String(it.market || '').toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(symbol)) continue;
    if (market !== 'BIST' && market !== 'US') continue;
    const query = String(it.query || symbol).slice(0, 64);
    out.push({ symbol, market, query });
  }
  return out;
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const code = (req.query?.code || '').trim();
  if (!validCode(code)) {
    res.status(400).json({ error: 'Invalid code. 4-40 chars, [a-z0-9_-].' });
    return;
  }
  const key = `wl:${code.toLowerCase()}`;

  try {
    if (req.method === 'GET') {
      const data = await kv.get(key);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        list: data?.list || [],
        portfolio: data?.portfolio || [],
        updatedAt: data?.updatedAt || null,
      });
      return;
    }

    if (req.method === 'POST') {
      // Vercel Node runtime — body otomatik parse edilir (Content-Type application/json ise)
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      if (!body || (!Array.isArray(body.list) && !Array.isArray(body.portfolio))) {
        res.status(400).json({ error: 'Body must include { list: [...] } and/or { portfolio: [...] }' });
        return;
      }
      const clean   = cleanList(body.list);
      const cleanPf = cleanList(body.portfolio);
      const payload = { list: clean, portfolio: cleanPf, updatedAt: Date.now() };
      const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      if (size > MAX_LIST_BYTES) {
        res.status(413).json({ error: 'List too large' });
        return;
      }
      await kv.set(key, payload);
      res.status(200).json({ ok: true, count: clean.length, portfolioCount: cleanPf.length, updatedAt: payload.updatedAt });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
