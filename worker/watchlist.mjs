// Ortak izleme-listesi çözücü (poll.mjs + movers.mjs paylaşır).
// Uygulama, portföy/liste değiştiğinde güncel durumu `/api/watchlist`'e (Vercel KV) POST eder.
// Buradan aynı kodla GET ederek worker'ın hep GÜNCEL sembolleri taramasını sağlarız —
// böylece app'te ekleme/çıkarma yapınca telefona gelen bildirimler de güncellenir.
// Endpoint erişilemez/boşsa statik worker/portfolio.json'a düşeriz (bildirim asla tamamen kırılmaz).

import fs from 'node:fs/promises';

const CODE = process.env.SYNC_CODE || 'atahan-bulten-9f3c';
const BASE = process.env.SYNC_BASE || 'https://day-starter.vercel.app';

function normUS(it) {
  const q = (it.query && it.query !== it.symbol) ? it.query : `${it.symbol} stock`;
  return { symbol: it.symbol, query: q };
}

export async function getWatchlist() {
  try {
    const url = `${BASE}/api/watchlist?code=${encodeURIComponent(CODE)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'sabah-bulteni-worker' } });
    if (r.ok) {
      const j = await r.json();
      const pf   = Array.isArray(j.portfolio) ? j.portfolio : [];
      const list = Array.isArray(j.list)      ? j.list      : [];
      if (pf.length || list.length) {
        const bist  = pf.filter((x) => x.market === 'BIST').map((x) => x.symbol);
        const us    = pf.filter((x) => x.market === 'US').map(normUS);
        const watch = list.map((x) => ({ symbol: x.symbol, market: x.market, query: x.query || x.symbol }));
        console.log(`watchlist: canlı (portföy ${pf.length}, liste ${list.length}) updatedAt=${j.updatedAt || '—'}`);
        return { bist, us, watch, source: 'live' };
      }
      console.log('watchlist: endpoint boş → statik portfolio.json');
    } else {
      console.log(`watchlist: endpoint ${r.status} → statik portfolio.json`);
    }
  } catch (e) {
    console.log('watchlist: fetch hatası → statik portfolio.json:', e.message);
  }
  const pf = JSON.parse(await fs.readFile(new URL('./portfolio.json', import.meta.url)));
  return { bist: pf.bist || [], us: pf.us || [], watch: pf.watch || [], source: 'static' };
}
