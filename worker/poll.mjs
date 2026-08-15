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
    for (const it of items.slice(0, 8)) {
      const id = it.link || it.title;
      if (seenSet.has(id)) continue;
      matches.push({
        id,
        title:   `[${p.symbol}] News`,
        message: it.title,
        click:   it.link,
        tags:    ['newspaper'],
      });
    }
  } catch (e) {
    console.error(p.symbol, 'failed:', e.message);
  }
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
