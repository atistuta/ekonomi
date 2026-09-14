// Vercel Node serverless — Yahoo Finance "fundamentals" endpoint
// URL: https://<app>.vercel.app/api/yfin?symbols=NVDA,ASELS.IS
// Yahoo v10 quoteSummary artık crumb+cookie ister (aksi halde 401 "Invalid Crumb").
// Bu handshake tarayıcıdan/CORS proxy'den yapılamaz; sunucu tarafında yapıp
// P/E, forward P/E, PEG, sektör, marj vb. temel kıyas metriklerini temiz JSON döneriz.

export const config = { runtime: 'nodejs', maxDuration: 30 };

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const MODULES = 'summaryDetail,defaultKeyStatistics,summaryProfile,financialData,price';
// deep=1 → bilanço takvimi + analist konsensüsü (Bilanço Öncesi Paneli için)
const MODULES_DEEP = MODULES + ',calendarEvents,earningsTrend';

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

// calendarEvents + earningsTrend → sonraki bilanço tarihi + analist konsensüsü.
// epsAvg/High/Low & revAvg → calendarEvents.earnings; analist sayısı & YoY büyüme → earningsTrend "0q".
function parseEarnings(R) {
  const ce = R.calendarEvents && R.calendarEvents.earnings;
  const dates = ce && Array.isArray(ce.earningsDate) ? ce.earningsDate : [];
  const ts = dates.map((d) => num(d)).filter((x) => x != null).sort((a, b) => a - b)[0] || null;
  // earningsTrend "0q" = içinde bulunulan/yaklaşan çeyrek → analist sayısı + YoY büyüme
  const trend = (R.earningsTrend && Array.isArray(R.earningsTrend.trend)) ? R.earningsTrend.trend : [];
  const q0 = trend.find((t) => t && t.period === '0q') || null;
  const ee = q0 && q0.earningsEstimate || {}, re = q0 && q0.revenueEstimate || {};
  const epsAvg = num(ce && ce.earningsAverage) ?? num(ee.avg);
  const epsHigh = num(ce && ce.earningsHigh) ?? num(ee.high);
  const epsLow = num(ce && ce.earningsLow) ?? num(ee.low);
  if (ts == null && epsAvg == null) return null;
  return {
    ts,                                        // saniye (unix)
    estimate: !!(ce && ce.isEarningsDateEstimate), // tarih tahmini mi (kesinleşmemiş)
    epsAvg, epsHigh, epsLow,
    revAvg: num(ce && ce.revenueAverage) ?? num(re.avg),
    revHigh: num(ce && ce.revenueHigh) ?? num(re.high),
    revLow: num(ce && ce.revenueLow) ?? num(re.low),
    numAnalysts: num(ee.numberOfAnalysts) ?? num(re.numberOfAnalysts),
    epsGrowth: num(ee.growth),                 // beklenen YoY kâr büyümesi (kesir)
    revGrowth: num(re.growth),                 // beklenen YoY gelir büyümesi (kesir)
  };
}

async function fetchOne(sym, ck, deep) {
  const mods = deep ? MODULES_DEEP : MODULES;
  const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${mods}&crumb=${encodeURIComponent(ck.crumb)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Cookie': ck.cookie } });
  if (r.status === 401) { const e = new Error('401'); e.needCrumb = true; throw e; }
  const j = await r.json().catch(() => null);
  const R = j?.quoteSummary?.result?.[0];
  if (!R) return { symbol: sym, ok: false };
  const sd = R.summaryDetail || {}, ks = R.defaultKeyStatistics || {},
        pr = R.summaryProfile || {}, fd = R.financialData || {}, p = R.price || {};
  return {
    symbol: sym, ok: true,
    ...(deep ? { earnings: parseEarnings(R) } : {}),
    name: p.shortName || p.longName || null,
    currency: p.currency || null,             // işlem/kotasyon para birimi (ADR → USD)
    finCurrency: fd.financialCurrency || null, // raporlama para birimi (gelir/finansallar bunda)
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

  // ?search=<q> → Yahoo autocomplete: bir yazıyı borsasıyla çöz (BIST .IS mi ABD mi).
  // Evrensel arama kutusunun hisse çözümleyicisi bunu kullanır. Crumb gerekmez.
  const searchQ = (req.query?.search || '').toString().trim();
  if (searchQ) {
    try {
      const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQ)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&lang=en-US&region=US`;
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const j = await r.json().catch(() => null);
      const quotes = (j && Array.isArray(j.quotes)) ? j.quotes : [];
      const out = quotes.map((q) => ({
        symbol: q.symbol || null,
        name: q.shortname || q.longname || null,
        exch: q.exchange || null,
        exchDisp: q.exchDisp || null,
        type: q.quoteType || null,
      })).filter((q) => q.symbol);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ query: searchQ, quotes: out });
    } catch (e) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(502).json({ error: String(e && e.message || e), quotes: [] });
    }
    return;
  }

  const raw = (req.query?.symbols || '').toString().trim();
  if (!raw) { res.status(400).json({ error: 'Missing ?symbols=' }); return; }
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
  const deep = !!(req.query?.deep);

  try {
    let ck = await getCrumb(false);
    const out = [];
    for (const sym of symbols) {
      try {
        out.push(await fetchOne(sym, ck, deep));
      } catch (e) {
        if (e.needCrumb) { // crumb bayatladı → tazele, bir kez daha dene
          ck = await getCrumb(true);
          try { out.push(await fetchOne(sym, ck, deep)); }
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
