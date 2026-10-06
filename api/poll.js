// Bildirim "Plan A" — Vercel serverless poller.
// GitHub Actions worker'ının (poll.mjs + movers.mjs) birebir karşılığı, ama:
//  - İzleme listesini Vercel KV'den okur (app'in canlı portföy+listeleri)
//  - Tekrar-engelleme (dedup) durumunu KV'de tutar (poll:seen + poll:movers)
//  - ntfy.sh'e push eder
// Harici bir cron (ör. cron-job.org) bunu 15 dk'da bir tetikler:
//   GET https://day-starter.vercel.app/api/poll?key=SECRET
//
// TEK push kaynağı olmalı: GitHub Actions worker'ının push adımları devre dışı
// bırakıldı (bkz. .github/workflows/poll-kap.yml) → çift bildirim olmaz.
//
// GEREKLİ env (Vercel → Settings → Environment Variables):
//   NTFY_TOPIC   = ntfy konu adın (worker ile AYNI olmalı)
//   POLL_SECRET  = cron'un göndereceği gizli anahtar (abuse/spam koruması)
//   SYNC_CODE    = (ops.) izleme listesi kodu; varsayılan 'atahan-bulten-9f3c'

import { kv } from '@vercel/kv';
import { XMLParser } from 'fast-xml-parser';
import calendarData from '../worker/calendar.json';

export const config = { runtime: 'nodejs', maxDuration: 60 };

const KAP_RSS = 'https://www.kap.org.tr/tr/api/disclosures/rss';
const SEEN_KEY = 'poll:seen';
const MOVERS_KEY = 'poll:movers';

// ---- Haber önem filtresi (poll.mjs ile birebir) ----
const MAJOR_KW = /\b(acquir\w*|merg\w*|buyout|takeover|to buy|deal|stake|\d+\s*billion|guidance|forecast|raises?|cuts?|slash\w*|downgrad\w*|upgrad\w*|price target|lawsuit|sues?|antitrust|probe|investigation|recall|bankrupt\w*|default|beats?|miss(es|ed)?|earnings|layoffs?|contract|awarded|wins?|partnership|approval|halts?|surge\w*|plunge\w*|soars?|tumbl\w*|crash\w*|record)\b/i;
const SEC_KW = /\bSEC\b|\bFDA\b|\bDOJ\b/;
const isMajor = (title) => MAJOR_KW.test(title) || SEC_KW.test(title);

const MACRO_QUERY = '("Federal Reserve" OR "interest rate" OR "rate hike" OR "rate cut" OR inflation OR CPI OR "Treasury yield" OR FOMC OR "jobs report" OR recession OR "debt ceiling" OR "credit rating")';
const MACRO_KW = /\b(fed|federal reserve|interest rate|rate hike|rate cut|inflation|cpi|ppi|treasury yield|yields?|fomc|powell|jobs report|payroll|unemployment|recession|debt ceiling|downgrad\w*|credit rating|bond)\b/i;

// ---- Fiyat-sıçrama eşikleri (movers.mjs ile birebir) ----
const TH = {
  US:   { day: 3.0, hour: 1.8, step: 3.0 },
  BIST: { day: 4.0, hour: 2.5, step: 4.0 },
};

const parser = new XMLParser({ ignoreAttributes: false });
const upper = (s) => (s || '').toString().toUpperCase();

// Basit eşzamanlılık havuzu (serverless süre sınırında çok fetch'i paralelleştir)
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

async function fetchXML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 sabah-bulteni-worker' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return parser.parse(await res.text());
}

async function notify(topic, { title, message, click, tags = [], priority = 4 }) {
  try {
    const r = await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, title, message, click, tags, priority }),
    });
    return r.ok;
  } catch { return false; }
}

// KV'den canlı izleme listesini çöz (watchlist.mjs getWatchlist ile aynı türetme)
async function getWatchlist() {
  const code = (process.env.SYNC_CODE || 'atahan-bulten-9f3c').toLowerCase();
  const data = await kv.get(`wl:${code}`);
  const pf   = Array.isArray(data?.portfolio) ? data.portfolio : [];
  const list = Array.isArray(data?.list)      ? data.list      : [];
  const bist  = pf.filter((x) => x.market === 'BIST').map((x) => x.symbol);
  const us    = pf.filter((x) => x.market === 'US').map((it) => ({
    symbol: it.symbol,
    query: (it.query && it.query !== it.symbol) ? it.query : `${it.symbol} stock`,
  }));
  const watch = list.map((x) => ({ symbol: x.symbol, market: x.market, query: x.query || x.symbol }));
  return { bist, us, watch };
}

// ================= HABER TARAMASI =================
async function runNews(topic, PORTFOLIO, seenSet) {
  const matches = [];

  // 1) KAP (BIST)
  try {
    const parsed = await fetchXML(KAP_RSS);
    const items = parsed?.rss?.channel?.item || [];
    const tickers = [...new Set([
      ...PORTFOLIO.bist,
      ...PORTFOLIO.watch.filter((w) => w.market === 'BIST').map((w) => w.symbol),
    ].map(upper))];
    for (const it of items) {
      const id = it.link || it.title;
      if (!id || seenSet.has(id)) continue;
      const blob = upper((it.title || '') + ' ' + (it.description || ''));
      const hit = tickers.find((t) => new RegExp(`\\b${t}\\b`).test(blob));
      if (!hit) continue;
      matches.push({ id, title: `[${hit}] KAP`, message: it.title, click: it.link, tags: ['memo'] });
    }
  } catch (e) { console.error('KAP failed:', e.message); }

  // 2) US haberleri (Google News RSS)
  const usFeeds = [
    ...PORTFOLIO.us,
    ...PORTFOLIO.watch.filter((w) => w.market === 'US').map((w) => ({ symbol: w.symbol, query: w.query || `${w.symbol} stock` })),
  ];
  const _seen = new Set();
  const usUniq = usFeeds.filter((p) => (_seen.has(p.symbol) ? false : _seen.add(p.symbol)));
  const perFeed = await pool(usUniq, 6, async (p) => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(p.query)}&hl=en&gl=US&ceid=US:en`;
    const parsed = await fetchXML(url);
    const items = parsed?.rss?.channel?.item || [];
    const found = [];
    let pushedForTicker = 0;
    for (const it of items.slice(0, 15)) {
      if (pushedForTicker >= 3) break;
      const id = it.link || it.title;
      if (!id || seenSet.has(id)) continue;
      if (!isMajor(it.title)) continue;
      found.push({ id, title: `[${p.symbol}] ⭐ Önemli`, message: it.title, click: it.link, tags: ['newspaper'] });
      pushedForTicker++;
    }
    return found;
  });
  for (const arr of perFeed) if (Array.isArray(arr)) matches.push(...arr);

  // 2b) 🌍 MAKRO
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(MACRO_QUERY + ' when:1d')}&hl=en&gl=US&ceid=US:en`;
    const parsed = await fetchXML(url);
    const items = parsed?.rss?.channel?.item || [];
    let macroPushed = 0;
    for (const it of items.slice(0, 25)) {
      if (macroPushed >= 4) break;
      const id = it.link || it.title;
      if (!id || seenSet.has(id)) continue;
      if (!MACRO_KW.test(it.title || '')) continue;
      matches.push({ id, title: '🌍 MAKRO — faiz/enflasyon', message: it.title, click: it.link, tags: ['warning'], priority: 5 });
      macroPushed++;
    }
  } catch (e) { console.error('MAKRO feed failed:', e.message); }

  // 2c) ⏰ Ekonomik takvim
  try {
    const events = Array.isArray(calendarData) ? calendarData : (calendarData.events || []);
    const now = Date.now();
    const WINDOW_MS = 4 * 60 * 60 * 1000;
    for (const ev of events) {
      const when = Date.parse(ev.whenUTC);
      if (!Number.isFinite(when)) continue;
      const ms = when - now;
      if (ms <= 0 || ms > WINDOW_MS) continue;
      const id = `cal:${ev.id}`;
      if (seenSet.has(id)) continue;
      const mins = Math.round(ms / 60000);
      const hh = Math.floor(mins / 60), mm = mins % 60;
      const eta = hh > 0 ? `${hh}s ${mm}dk` : `${mm}dk`;
      matches.push({
        id,
        title: `⏰ ${ev.title}`,
        message: `~${eta} sonra${ev.note ? ' · ' + ev.note : ''} · (takvim verisi — resmi kaynaktan doğrula)`,
        click: ev.link || 'https://day-starter.vercel.app/',
        tags: ['alarm_clock'],
        priority: 5,
      });
    }
  } catch (e) { console.error('Takvim okunamadı:', e.message); }

  // Push
  let pushed = 0;
  for (const m of matches) {
    const ok = await notify(topic, m);
    if (ok) { seenSet.add(m.id); pushed++; }
  }
  return { pushed, candidates: matches.length };
}

// ================= FİYAT-SIÇRAMA TARAMASI =================
const yahooSymbol = (sym, mkt) => (mkt === 'BIST' ? `${sym}.IS` : sym);

async function fetchIntraday(sym, mkt) {
  const ysym = yahooSymbol(sym, mkt);
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${ysym}?range=1d&interval=5m`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 sabah-bulteni-worker' } });
      if (!res.ok) continue;
      const json = await res.json();
      const r = json.chart?.result?.[0];
      if (!r) continue;
      const meta = r.meta || {};
      const ts = r.timestamp || [];
      const q = r.indicators?.quote?.[0] || {};
      const close = q.close || [];
      const vol = q.volume || [];
      const bars = ts.map((t, i) => ({ t, c: close[i], v: vol[i] })).filter((b) => b.c != null);
      if (bars.length < 3) continue;
      return { meta, bars };
    } catch { /* sıradaki host */ }
  }
  return null;
}

function analyze(data) {
  const { meta, bars } = data;
  const last = bars[bars.length - 1];
  const price = meta.regularMarketPrice ?? last.c;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? bars[0].c;
  const dayChg = ((price - prevClose) / prevClose) * 100;
  const hi = bars.length - 1;
  const ago = Math.max(0, hi - 12);
  const hourChg = ((bars[hi].c - bars[ago].c) / bars[ago].c) * 100;
  const vols = bars.map((b) => b.v || 0).filter((v) => v > 0);
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
  const lastVol = vols.length ? vols[vols.length - 1] : 0;
  const rvol = avgVol ? lastVol / avgVol : 0;
  return { price, prevClose, dayChg, hourChg, rvol };
}

async function runMovers(topic, PORTFOLIO, state) {
  const symbols = [];
  for (const s of (PORTFOLIO.bist || [])) symbols.push({ symbol: s, market: 'BIST', tag: 'portföy' });
  for (const p of (PORTFOLIO.us || [])) symbols.push({ symbol: p.symbol, market: 'US', tag: 'portföy' });
  for (const w of (PORTFOLIO.watch || [])) symbols.push({ symbol: w.symbol, market: w.market || 'BIST', tag: 'izleme' });

  const today = new Date().toISOString().slice(0, 10);
  if (state.date !== today) { state.date = today; state.levels = {}; }
  state.levels = state.levels || {};

  const results = await pool(symbols, 6, async (entry) => {
    const data = await fetchIntraday(entry.symbol, entry.market);
    if (!data) return null;
    return { entry, a: analyze(data) };
  });

  let pushed = 0, scanned = 0;
  for (const r of results) {
    if (!r) continue;
    scanned++;
    const { entry, a } = r;
    const th = TH[entry.market] || TH.US;
    const up = a.dayChg > 0;
    const suddenHour = Math.abs(a.hourChg) >= th.hour;
    const bigDay = Math.abs(a.dayChg) >= th.day;
    if (!suddenHour && !bigDay) continue;

    const level = Math.trunc(a.dayChg / th.step);
    const key = `${entry.symbol}.${entry.market}`;
    if (state.levels[key] === level) continue;
    state.levels[key] = level;

    const dir = up ? '📈 Yükseliş' : '📉 Düşüş';
    const arrow = up ? '▲' : '▼';
    const rvolTxt = a.rvol >= 1.5 ? ` · hacim ${a.rvol.toFixed(1)}×` : '';
    const hourTxt = suddenHour ? ` (son 1s ${a.hourChg >= 0 ? '+' : ''}${a.hourChg.toFixed(1)}%)` : '';
    const cur = entry.market === 'BIST' ? '₺' : '$';
    const ok = await notify(topic, {
      title: `${arrow} ${entry.symbol} ani hareket`,
      message: `${dir}: gün içi ${a.dayChg >= 0 ? '+' : ''}${a.dayChg.toFixed(1)}%${hourTxt}${rvolTxt} · ${cur}${a.price?.toFixed?.(2) ?? a.price} · ${entry.tag}`,
      click: 'https://day-starter.vercel.app/',
      tags: [up ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'],
      priority: bigDay ? 5 : 4,
    });
    if (ok) pushed++;
  }
  return { pushed, scanned, total: symbols.length };
}

export default async function handler(req, res) {
  const topic = process.env.NTFY_TOPIC;
  const secret = process.env.POLL_SECRET;

  if (!secret) { res.status(500).json({ error: 'POLL_SECRET env tanımlı değil.' }); return; }
  const key = (req.query?.key || '').toString();
  if (key !== secret) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!topic) { res.status(500).json({ error: 'NTFY_TOPIC env tanımlı değil.' }); return; }

  const mode = (req.query?.mode || 'all').toString(); // all | news | movers

  try {
    const PORTFOLIO = await getWatchlist();

    let news = null, movers = null;

    if (mode === 'all' || mode === 'news') {
      const seenArr = (await kv.get(SEEN_KEY)) || [];
      const seenSet = new Set(Array.isArray(seenArr) ? seenArr : []);
      news = await runNews(topic, PORTFOLIO, seenSet);
      await kv.set(SEEN_KEY, [...seenSet].slice(-1000)); // son 1000
    }

    if (mode === 'all' || mode === 'movers') {
      const state = (await kv.get(MOVERS_KEY)) || { date: null, levels: {} };
      movers = await runMovers(topic, PORTFOLIO, state);
      await kv.set(MOVERS_KEY, state);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, mode, news, movers, watch: PORTFOLIO.watch.length, portfolio: { bist: PORTFOLIO.bist.length, us: PORTFOLIO.us.length } });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
