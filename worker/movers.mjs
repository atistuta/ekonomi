// Fiyat-sıçrama (momentum) worker — GitHub Actions'ta her 15 dk çalışır.
// Portföy + izleme listesindeki her sembol için Yahoo intraday (5dk) verisini çeker,
// "ani hareket" tespit eder ve ntfy.sh ile telefona push'lar. Uygulama kapalıyken de çalışır.
// Durum worker/.movers.json içinde tutulur (gün + seviye bazlı dedup → spam yok).

import fs from 'node:fs/promises';
import { getWatchlist } from './watchlist.mjs';

const NTFY_TOPIC = process.env.NTFY_TOPIC;
const PORTFOLIO  = await getWatchlist(); // canlı KV → app'in güncel portföy+listeleri
const STATE_PATH = new URL('./.movers.json', import.meta.url);

if (!NTFY_TOPIC) {
  console.error('NTFY_TOPIC env var missing.');
  process.exit(1);
}

// ---- Eşikler (yüzde) ----
// Bir sembol için: gün içi hareket VEYA son-saat momentumu eşiği aşarsa → "ani hareket".
// STEP: her ek STEP kadar hareket → yeniden alarm (kademeli takip).
const TH = {
  US:   { day: 3.0, hour: 1.8, step: 3.0 },
  BIST: { day: 4.0, hour: 2.5, step: 4.0 }, // BIST günlük tavan ±%10; eşik biraz yüksek
};

// ---- Semboller: portföy (bist + us) + izleme listesi ----
const symbols = [];
for (const s of (PORTFOLIO.bist || [])) symbols.push({ symbol: s, market: 'BIST', tag: 'portföy' });
for (const p of (PORTFOLIO.us   || [])) symbols.push({ symbol: p.symbol, market: 'US', tag: 'portföy' });
for (const w of (PORTFOLIO.watch || [])) {
  const market = w.market || (/^[A-Z]{3,6}$/.test(w.symbol) && w.market ? w.market : 'BIST');
  symbols.push({ symbol: w.symbol, market: w.market || market, tag: 'izleme' });
}

// ---- Durum ----
let state = {};
try { state = JSON.parse(await fs.readFile(STATE_PATH, 'utf8')); } catch {}
const today = new Date().toISOString().slice(0, 10);
// Yeni gün → sıfırla
if (state.date !== today) state = { date: today, levels: {} };
state.levels = state.levels || {};

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
      const meta  = r.meta || {};
      const ts    = r.timestamp || [];
      const q     = r.indicators?.quote?.[0] || {};
      const close = q.close || [];
      const vol   = q.volume || [];
      const bars = ts.map((t, i) => ({ t, c: close[i], v: vol[i] }))
                     .filter(b => b.c != null);
      if (bars.length < 3) continue;
      return { meta, bars };
    } catch { /* sıradaki host */ }
  }
  return null;
}

function analyze(sym, mkt, data) {
  const { meta, bars } = data;
  const last = bars[bars.length - 1];
  const price = meta.regularMarketPrice ?? last.c;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? bars[0].c;
  const dayChg = ((price - prevClose) / prevClose) * 100;

  // Son ~60 dk (12 x 5dk bar) momentumu
  const hi = bars.length - 1;
  const ago = Math.max(0, hi - 12);
  const hourChg = ((bars[hi].c - bars[ago].c) / bars[ago].c) * 100;

  // Hacim patlaması: son TAMAMLANMIŞ bar hacmi / gün içi ortalama bar hacmi
  // (en son 5dk barı çoğu zaman hâlâ oluşuyor → hacmi 0/null gelir, onu atla)
  const vols = bars.map(b => b.v || 0).filter(v => v > 0);
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
  const lastVol = vols.length ? vols[vols.length - 1] : 0;
  const rvol = avgVol ? lastVol / avgVol : 0;

  return { price, prevClose, dayChg, hourChg, rvol };
}

async function notify({ title, message, click, tags = [], priority = 4 }) {
  try {
    const r = await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: NTFY_TOPIC, title, message, click, tags, priority }),
    });
    return r.ok;
  } catch { return false; }
}

let pushed = 0, scanned = 0;

for (const { symbol, market, tag } of symbols) {
  const data = await fetchIntraday(symbol, market);
  if (!data) { console.error('no data:', symbol, market); continue; }
  scanned++;
  const a = analyze(symbol, market, data);
  const th = TH[market] || TH.US;

  const up = a.dayChg > 0;
  const dir = up ? '📈 Yükseliş' : '📉 Düşüş';
  const suddenHour = Math.abs(a.hourChg) >= th.hour;
  const bigDay     = Math.abs(a.dayChg) >= th.day;
  if (!suddenHour && !bigDay) continue;

  // Kademeli dedup: bu seviyeye bugün daha önce alarm verdik mi?
  const level = Math.trunc(a.dayChg / th.step); // işaretli → yön değişimi de yeni alarm
  const key = `${symbol}.${market}`;
  if (state.levels[key] === level) continue;    // aynı seviye → tekrar etme
  state.levels[key] = level;

  const arrow = up ? '▲' : '▼';
  const rvolTxt = a.rvol >= 1.5 ? ` · hacim ${a.rvol.toFixed(1)}×` : '';
  const hourTxt = suddenHour ? ` (son 1s ${a.hourChg >= 0 ? '+' : ''}${a.hourChg.toFixed(1)}%)` : '';
  const cur = market === 'BIST' ? '₺' : '$';
  const ok = await notify({
    title: `${arrow} ${symbol} ani hareket`,
    message: `${dir}: gün içi ${a.dayChg >= 0 ? '+' : ''}${a.dayChg.toFixed(1)}%${hourTxt}${rvolTxt} · ${cur}${a.price?.toFixed?.(2) ?? a.price} · ${tag}`,
    click: `https://day-starter.vercel.app/`,
    tags: [up ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'],
    priority: bigDay ? 5 : 4,
  });
  if (ok) { pushed++; console.log('Pushed:', symbol, market, a.dayChg.toFixed(1) + '%', 'lvl', level); }
}

await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2));
console.log(`Movers done. Scanned ${scanned}/${symbols.length}, pushed ${pushed}.`);
