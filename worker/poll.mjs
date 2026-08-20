// Polling worker — runs in GitHub Actions every 15 min.
//  - BIST: KAP RSS → filter by ticker
//  - US:   Google News RSS per ticker
// New items push to ntfy.sh. State persisted in worker/.seen.json.

import fs from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { getWatchlist } from './watchlist.mjs';

const KAP_RSS    = 'https://www.kap.org.tr/tr/api/disclosures/rss';
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const PORTFOLIO  = await getWatchlist(); // canlı KV → app'in güncel portföy+listeleri
const SEEN_PATH  = new URL('./.seen.json', import.meta.url);

if (!NTFY_TOPIC) {
  console.error('NTFY_TOPIC env var missing.');
  process.exit(1);
}

let seen = [];
try { seen = JSON.parse(await fs.readFile(SEEN_PATH, 'utf8')); } catch {}
const seenSet = new Set(seen);
const parser = new XMLParser({ ignoreAttributes: false });

// ---- Helpers ----
const upper = (s) => (s || '').toString().toUpperCase();

// ---- Filtre: yalnız "önemli" haberler geçsin (haber selini keser) ----
// Hisse başlığı bu kalıplardan BİRİNİ içermezse push edilmez (rutin başlıklar bastırılır).
// M&A / dev sözleşme / bilanço sürprizi / analist aksiyonu / regülasyon / sert fiyat hareketi.
const MAJOR_KW = /\b(acquir\w*|merg\w*|buyout|takeover|to buy|deal|stake|\d+\s*billion|guidance|forecast|raises?|cuts?|slash\w*|downgrad\w*|upgrad\w*|price target|lawsuit|sues?|antitrust|probe|investigation|recall|bankrupt\w*|default|beats?|miss(es|ed)?|earnings|layoffs?|contract|awarded|wins?|partnership|approval|halts?|surge\w*|plunge\w*|soars?|tumbl\w*|crash\w*|record)\b/i;
// SEC ayrı (kelime sınırı büyük harfle çakışmasın)
const SEC_KW = /\bSEC\b|\bFDA\b|\bDOJ\b/;
const isMajor = (title) => MAJOR_KW.test(title) || SEC_KW.test(title);

// ---- Makro kanalı: tüm piyasayı ilgilendiren faiz/enflasyon gelişmeleri ----
// Hisseye değil dünyaya bakar; senin örneğindeki "faiz + rekor borçlanma → yarı iletken/AI düşüşü"
// türü tetikleyiciler burada, ayrı ve YÜKSEK öncelikli çıkar.
const MACRO_QUERY = '("Federal Reserve" OR "interest rate" OR "rate hike" OR "rate cut" OR inflation OR CPI OR "Treasury yield" OR FOMC OR "jobs report" OR recession OR "debt ceiling" OR "credit rating")';
const MACRO_KW = /\b(fed|federal reserve|interest rate|rate hike|rate cut|inflation|cpi|ppi|treasury yield|yields?|fomc|powell|jobs report|payroll|unemployment|recession|debt ceiling|downgrad\w*|credit rating|bond)\b/i;

async function fetchXML(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 sabah-bulteni-worker' },
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return parser.parse(await res.text());
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

const matches = [];

// ---- 1) KAP ----
try {
  const parsed = await fetchXML(KAP_RSS);
  const items = parsed?.rss?.channel?.item || [];
  // Portföy BIST + listelerdeki BIST sembolleri (tekilleştirilmiş)
  const tickers = [...new Set([
    ...PORTFOLIO.bist,
    ...PORTFOLIO.watch.filter((w) => w.market === 'BIST').map((w) => w.symbol),
  ].map(upper))];
  for (const it of items) {
    const id = it.link || it.title;
    if (seenSet.has(id)) continue;
    const blob = upper((it.title || '') + ' ' + (it.description || ''));
    const hit = tickers.find(t => new RegExp(`\\b${t}\\b`).test(blob));
    if (!hit) continue;
    matches.push({
      id,
      title:   `[${hit}] KAP`,
      message: it.title,
      click:   it.link,
      tags:    ['memo'],
    });
  }
} catch (e) {
  console.error('KAP failed:', e.message);
}

// ---- 2) US haberleri (Google News RSS) — portföy US + listelerdeki US (tekilleştirilmiş) ----
const usFeeds = [
  ...PORTFOLIO.us,
  ...PORTFOLIO.watch.filter((w) => w.market === 'US').map((w) => ({ symbol: w.symbol, query: w.query || `${w.symbol} stock` })),
];
const _usSeen = new Set();
const usUniq = usFeeds.filter((p) => (_usSeen.has(p.symbol) ? false : _usSeen.add(p.symbol)));
for (const p of usUniq) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(p.query)}&hl=en&gl=US&ceid=US:en`;
  try {
    const parsed = await fetchXML(url);
    const items = parsed?.rss?.channel?.item || [];
    let pushedForTicker = 0;
    for (const it of items.slice(0, 15)) {
      if (pushedForTicker >= 3) break;          // hisse başına en fazla 3 önemli haber
      const id = it.link || it.title;
      if (seenSet.has(id)) continue;
      if (!isMajor(it.title)) continue;         // rutin başlıkları bastır → yalnız önemli olaylar
      matches.push({
        id,
        title:   `[${p.symbol}] ⭐ Önemli`,
        message: it.title,
        click:   it.link,
        tags:    ['newspaper'],
      });
      pushedForTicker++;
    }
  } catch (e) {
    console.error(p.symbol, 'failed:', e.message);
  }
}

// ---- 2b) 🌍 MAKRO: dünya faiz + enflasyon gelişmeleri (hisseden bağımsız, yüksek öncelik) ----
try {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(MACRO_QUERY + ' when:1d')}&hl=en&gl=US&ceid=US:en`;
  const parsed = await fetchXML(url);
  const items = parsed?.rss?.channel?.item || [];
  let macroPushed = 0;
  for (const it of items.slice(0, 25)) {
    if (macroPushed >= 4) break;                // makro spam da olmasın → en fazla 4/tur
    const id = it.link || it.title;
    if (seenSet.has(id)) continue;
    if (!MACRO_KW.test(it.title || '')) continue;
    matches.push({
      id,
      title:    '🌍 MAKRO — faiz/enflasyon',
      message:  it.title,
      click:    it.link,
      tags:     ['warning'],
      priority: 5,                              // en yüksek → ticker spam'ının altında kaybolmaz
    });
    macroPushed++;
  }
} catch (e) {
  console.error('MAKRO feed failed:', e.message);
}

// ---- 2c) ⏰ Ekonomik takvim hatırlatması (FOMC/CPI önceden bellidir → GERÇEK önden uyarı) ----
try {
  const cal = JSON.parse(await fs.readFile(new URL('./calendar.json', import.meta.url), 'utf8'));
  const events = Array.isArray(cal) ? cal : (cal.events || []);
  const now = Date.now();
  const WINDOW_MS = 4 * 60 * 60 * 1000;          // olaydan ~4 saat önce, bir kez hatırlat
  for (const ev of events) {
    const when = Date.parse(ev.whenUTC);
    if (!Number.isFinite(when)) continue;
    const ms = when - now;
    if (ms <= 0 || ms > WINDOW_MS) continue;      // yalnız yaklaşan olaylar
    const id = `cal:${ev.id}`;
    if (seenSet.has(id)) continue;               // aynı olay için tek hatırlatma (.seen dedup)
    const mins = Math.round(ms / 60000);
    const hh = Math.floor(mins / 60), mm = mins % 60;
    const eta = hh > 0 ? `${hh}s ${mm}dk` : `${mm}dk`;
    matches.push({
      id,
      title:    `⏰ ${ev.title}`,
      message:  `~${eta} sonra${ev.note ? ' · ' + ev.note : ''} · (takvim verisi — resmi kaynaktan doğrula)`,
      click:    ev.link || 'https://day-starter.vercel.app/',
      tags:     ['alarm_clock'],
      priority: 5,
    });
  }
} catch (e) {
  console.error('Takvim okunamadı:', e.message);
}

// ---- 3) Notify ----
let pushed = 0;
for (const m of matches) {
  const ok = await notify(m);
  if (ok) {
    seenSet.add(m.id);
    pushed++;
    console.log('Pushed:', m.title, '-', m.message.slice(0, 80));
  }
}

// ---- 4) Persist (last 1000) ----
const updated = [...seenSet].slice(-1000);
await fs.writeFile(SEEN_PATH, JSON.stringify(updated, null, 2));
console.log(`Done. ${pushed}/${matches.length} pushed. Seen size: ${updated.length}`);
