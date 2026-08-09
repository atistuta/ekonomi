// Vercel Node serverless — Yahoo Finance "fundamentals" endpoint
// URL: https://<app>.vercel.app/api/yfin?symbols=NVDA,ASELS.IS
// Yahoo v10 quoteSummary artık crumb+cookie ister (aksi halde 401 "Invalid Crumb").
// Bu handshake tarayıcıdan/CORS proxy'den yapılamaz; sunucu tarafında yapıp
// P/E, forward P/E, PEG, sektör, marj vb. temel kıyas metriklerini temiz JSON döneriz.

export const config = { runtime: 'nodejs', maxDuration: 30 };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const MODULES = 'summaryDetail,defaultKeyStatistics,summaryProfile,financialData,price';

// Crumb+cookie'yi fonksiyon ömrü boyunca (warm lambda) tekrar kullan.
let CRUMB = null; // { cookie, crumb, ts }
async function getCrumb(force) {
  if (!force && CRUMB && (Date.now() - CRUMB.ts) < 30 * 60 * 1000) return CRUMB;
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } }).catch(() => null);
  const cookie = (r1 && r1.headers.get('set-cookie')) || '';
  const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
  });
  const crumb = (await cr.text()).trim();
  if (!crumb || /[<{]/.test(crumb)) throw new Error('crumb alınamadı');
  CRUMB = { cookie, crumb, ts: Date.now() };
  return CRUMB;
}

const num = (o) => (o && typeof o.raw === 'number') ? o.raw : null;

async function fetchOne(sym, ck) {
  const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${MODULES}&crumb=${encodeURIComponent(ck.crumb)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Cookie': ck.cookie } });
  if (r.status === 401) { const e = new Error('401'); e.needCrumb = true; throw e; }
  const j = await r.json().catch(() => null);
  const R = j?.quoteSummary?.result?.[0];
  if (!R) return { symbol: sym, ok: false };
  const sd = R.summaryDetail || {}, ks = R.defaultKeyStatistics || {},
        pr = R.summaryProfile || {}, fd = R.financialData || {}, p = R.price || {};
  return {
    symbol: sym, ok: true,
    name: p.shortName || p.longName || null,
    currency: p.currency || null,
    sector: pr.sector || null,
    industry: pr.industry || null,
    trailingPE: num(sd.trailingPE),
    forwardPE: num(sd.forwardPE),
    peg: num(ks.pegRatio) ?? num(ks.trailingPegRatio),
    priceToBook: num(ks.priceToBook),
    priceToSales: num(sd.priceToSalesTrailing12Months),
    evEbitda: num(ks.enterpriseToEbitda),
    marketCap: num(sd.marketCap) ?? num(p.marketCap),
    profitMargin: num(fd.profitMargins),
    returnOnEquity: num(fd.returnOnEquity),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth),
    debtToEquity: num(fd.debtToEquity),
    dividendYield: num(sd.dividendYield),
    price: num(p.regularMarketPrice) ?? num(sd.previousClose),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const raw = (req.query?.symbols || '').toString().trim();
  if (!raw) { res.status(400).json({ error: 'Missing ?symbols=' }); return; }
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);

  try {
    let ck = await getCrumb(false);
    const out = [];
    for (const sym of symbols) {
      try {
        out.push(await fetchOne(sym, ck));
      } catch (e) {
        if (e.needCrumb) { // crumb bayatladı → tazele, bir kez daha dene
          ck = await getCrumb(true);
          try { out.push(await fetchOne(sym, ck)); }
          catch (_) { out.push({ symbol: sym, ok: false }); }
        } else {
          out.push({ symbol: sym, ok: false });
        }
      }
    }
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ results: out });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
