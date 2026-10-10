// Vercel Node serverless — Tematik keşif (LLM semantik katmanı)
// URL: https://<app>.vercel.app/api/theme?q=yapay%20zeka%20enerji%20talebi
//
// Bir TEMA / SEKTÖR ifadesini (TR veya EN) alır, o temayla DOĞRUDAN ilişkili
// halka açık hisseleri Claude'dan ister ve temiz JSON döner. Framing BİLGİ/KEŞİF
// amaçlıdır — "al/sat" değil, "bu temayla ilişkili / haberde geçen hisseler".
//
// Önemli: Bu uç yalnız ADAY üretir. İstemci (app.js) her sembolü /api/yfin ile
// doğrular (gerçek + kote mi), halüsinasyonları eler. Skor motoruna DOKUNMAZ.
//
// Gerekli ortam değişkeni: ANTHROPIC_API_KEY (Vercel → Project → Settings → Environment Variables)
// İsteğe bağlı: THEME_MODEL (varsayılan aşağıdaki MODEL)

export const config = { runtime: 'nodejs', maxDuration: 30 };

const MODEL = process.env.THEME_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM = [
  'You are a financial RESEARCH DISCOVERY assistant for a Turkish investing-INFORMATION app.',
  'Given an investment THEME or SECTOR (written in Turkish or English), identify publicly traded stocks that are the most DIRECTLY and materially exposed to that theme.',
  '',
  'Rules:',
  '- Return 8 to 14 real, CURRENTLY-LISTED tickers. Use EXACT Yahoo Finance ticker symbols.',
  '- US / global stocks: plain symbol (examples: CEG, VST, GEV, NVDA, ETN).',
  '- Borsa Istanbul (Turkey) stocks: append ".IS" (examples: ASELS.IS, THYAO.IS, SASA.IS).',
  '- Prefer pure-play / high-exposure names over mega-cap conglomerates that only touch the theme; you may still include a few key large caps if they are central to it.',
  '- If the theme is relevant to Turkish markets, include Borsa Istanbul (.IS) names too; otherwise focus on US / global.',
  '- "reason" MUST be a SHORT Turkish phrase (max ~12 words) describing the LINK between the stock and the theme. It is discovery / context only, NOT investment advice. Never use al/sat/öneri (buy/sell/recommend) language.',
  '- If you are not confident a ticker is real and currently listed, OMIT it. Do not invent symbols.',
  '',
  'Output ONLY a JSON array (no prose, no markdown code fences). Each element:',
  '{"symbol":"CEG","market":"US","name":"Constellation Energy","reason":"Nükleer taban yük; veri merkezi elektrik talebi"}',
].join('\n');

// Claude yanıtından JSON diziyi güvenli biçimde çıkar (prefill "[" ile başlıyoruz).
function extractArray(text) {
  if (!text) return [];
  let s = ('[' + String(text)).trim();
  // olası kod çiti temizliği
  s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!s.startsWith('[')) { const i = s.indexOf('['); s = i >= 0 ? s.slice(i) : '[' + s; }
  const j = s.lastIndexOf(']');
  s = j >= 0 ? s.slice(0, j + 1) : s + ']';
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}

// Aday nesnesini normalize et + kaba geçerlilik süzgeci.
function cleanCandidates(arr) {
  const out = [];
  const seen = new Set();
  for (const c of arr) {
    if (!c || typeof c !== 'object') continue;
    let sym = String(c.symbol || '').trim().toUpperCase();
    if (!sym || !/^[A-Z0-9.\-]{1,12}$/.test(sym)) continue;        // sembol gibi görünmeyeni at
    let market = String(c.market || '').trim().toUpperCase();
    if (market !== 'US' && market !== 'BIST') market = sym.endsWith('.IS') ? 'BIST' : 'US';
    if (market === 'BIST' && !sym.endsWith('.IS')) sym += '.IS';   // BIST → .IS garanti
    if (seen.has(sym)) continue; seen.add(sym);
    out.push({
      symbol: sym,
      market,
      name: (c.name ? String(c.name).trim() : '').slice(0, 80) || null,
      reason: (c.reason ? String(c.reason).trim() : '').slice(0, 140) || null,
    });
    if (out.length >= 14) break;
  }
  return out;
}

async function askClaude(query, apiKey) {
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        { role: 'user', content: `Tema / sektör: "${query}"\n\nBu temayla doğrudan ilişkili hisseleri JSON dizi olarak ver.` },
        { role: 'assistant', content: '[' },   // prefill → doğrudan JSON diziye zorla
      ],
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
    const err = new Error(msg); err.status = r.status; throw err;
  }
  const text = (j && Array.isArray(j.content) && j.content[0] && j.content[0].text) || '';
  return cleanCandidates(extractArray(text));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const query = (req.query?.q || '').toString().trim();
  if (!query) { res.status(400).json({ error: 'missing_q', candidates: [] }); return; }
  if (query.length > 120) { res.status(400).json({ error: 'too_long', candidates: [] }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Anahtar yoksa istemci haber-tabanlı moda düşsün; kısa cache.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({ query, candidates: [], error: 'no_key' });
    return;
  }

  try {
    const candidates = await askClaude(query, apiKey);
    // Temalar için adaylar yavaş değişir → CDN'de 1 gün tut (maliyet kontrolü).
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({ query, model: MODEL, candidates });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.status(200).json({ query, candidates: [], error: 'llm_error', detail: String(e && e.message || e) });
  }
}
