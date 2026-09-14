// Sabah Bülteni — portföy + KAP + takvim + bildirim paneli
(() => {
  const TRUNCGIL = 'https://finans.truncgil.com/today.json';

  // Birden çok CORS proxy — sırayla denenir, ilk başarılı olan kullanılır.
  // MY_PROXY set edilmişse her zaman ilk o denenir (en güvenilir).
  const PROXIES = [
    ...(window.MY_PROXY ? [(url) => window.MY_PROXY + encodeURIComponent(url)] : []),
    (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
    (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
  ];
  // Hangi proxy son çalıştıysa onu hatırla (ardarda istekler için)
  let lastGoodProxy = 0;

  async function fetchVia(url, { timeout = 10000 } = {}) {
    const order = [lastGoodProxy, ...PROXIES.map((_, i) => i).filter(i => i !== lastGoodProxy)];
    let lastErr;
    for (const idx of order) {
      const proxied = PROXIES[idx](url);
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(proxied, { signal: controller.signal });
        clearTimeout(t);
        if (!res.ok) { lastErr = new Error('HTTP ' + res.status); continue; }
        const text = await res.text();
        if (text && text.length > 50) {
          lastGoodProxy = idx;
          return text;
        }
        lastErr = new Error('empty response');
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('All proxies failed');
  }

  // ===== localStorage cache (RSS/JSON için) =====
  // Sayfa açılır açılmaz cache'ten anında göster, arka planda tazele.
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 dk
  const CACHE_PREFIX = 'sb:cache:';
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj;
    } catch (_) { return null; }
  }
  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data }));
    } catch (_) { /* quota — sessiz */ }
  }
  function cacheFresh(entry) {
    return entry && (Date.now() - entry.t) < CACHE_TTL_MS;
  }
  // Açılışta eski (v15 öncesi) "kap:SYMBOL" entry'lerini bir kez temizle — yeni "kap2:" prefix'i kullanıyoruz.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX + 'kap:')) localStorage.removeItem(k);
    }
  } catch (_) {}

  const proxy = (url) => PROXIES[lastGoodProxy](url);

  // ===== Diagnostik =====
  if (location.protocol === 'file:') {
    document.getElementById('fileBanner').hidden = false;
  }
  const diagBar = document.getElementById('diagBar');
  diagBar.hidden = false;
  document.getElementById('diagClose').addEventListener('click', () => diagBar.hidden = true);
  function setDiag(key, ok, label) {
    const el = diagBar.querySelector(`[data-key="${key}"]`);
    if (!el) return;
    el.classList.remove('ok', 'fail');
    el.classList.add(ok ? 'ok' : 'fail');
    el.textContent = (ok ? '✓ ' : '✗ ') + label;
  }

  const fmtTRY = (n) => new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n) + ' ₺';

  const fmtTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleString('tr-TR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('tr-TR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  // ===== Döviz / Altın =====
  let truncgilCache = null;
  function truncgilGet(data, key) {
    const item = data[key];
    if (!item) return null;
    const raw = (item['Satış'] || item['Alış'] || '').toString()
      .replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    return isNaN(num) ? null : num;
  }
  async function loadRates() {
    try {
      const res = await fetch(TRUNCGIL);
      const data = await res.json();
      truncgilCache = data;
      const usd  = truncgilGet(data, 'USD');
      const eur  = truncgilGet(data, 'EUR');
      const gbp  = truncgilGet(data, 'GBP');
      const gram = truncgilGet(data, 'gram-altin') || truncgilGet(data, 'GRA');
      if (usd)  document.getElementById('val-usd').textContent  = fmtTRY(usd);
      if (eur)  document.getElementById('val-eur').textContent  = fmtTRY(eur);
      if (gbp)  document.getElementById('val-gbp').textContent  = fmtTRY(gbp);
      if (gram) document.getElementById('val-gram').textContent = fmtTRY(gram);
      setDiag('rates', !!(usd && eur), 'Döviz/Altın');
    } catch (e) {
      console.error('Rates failed', e);
      ['val-gram','val-usd','val-eur','val-gbp'].forEach(id => {
        document.getElementById(id).textContent = 'Hata';
      });
      setDiag('rates', false, 'Döviz/Altın');
    }
    loadCrypto();
  }

  // CoinGecko (CORS açık, anahtarsız)
  async function loadCrypto() {
    const setVal = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (n == null || !isFinite(n)) { el.textContent = 'Hata'; return; }
      const fmt = n >= 1000
        ? n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
        : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
      el.textContent = '$' + fmt;
    };
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
      const j = await r.json();
      setVal('val-btc', j?.bitcoin?.usd);
      setVal('val-eth', j?.ethereum?.usd);
    } catch (e) {
      console.error('Crypto failed', e);
      setVal('val-btc', null);
      setVal('val-eth', null);
    }
    updateCustomTickerPrices(); // özel göstergeleri de tazele (truncgil + crypto artık taze)
  }

  // ===== RSS yardımcısı (XML parse, proxy chain) =====
  let rssOkCount = 0, rssFailCount = 0;

  function parseRSS(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) return [];
    const nodes = [...doc.querySelectorAll('item'), ...doc.querySelectorAll('entry')];
    return nodes.map(it => {
      // RSS <link>url</link> veya Atom <link href="..."/>
      let link = it.querySelector('link')?.textContent?.trim();
      if (!link || !link.startsWith('http')) {
        const a = it.querySelector('link[href]');
        if (a) link = a.getAttribute('href');
      }
      const title = (it.querySelector('title')?.textContent || '').trim();
      const pubDate = (it.querySelector('pubDate')?.textContent
                    || it.querySelector('published')?.textContent
                    || it.querySelector('updated')?.textContent
                    || it.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'date')[0]?.textContent
                    || '').trim();
      const description = (it.querySelector('description')?.textContent
                        || it.querySelector('summary')?.textContent || '').trim();
      const author = (it.querySelector('author')?.textContent
                   || it.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0]?.textContent
                   || '').trim();
      return { title, link, pubDate, description, author };
    });
  }

  async function fetchRSS(url, count = 6) {
    try {
      const xml = await fetchVia(url);
      const items = parseRSS(xml).slice(0, count);
      if (!items.length) throw new Error('parsed empty');
      rssOkCount++;
      setDiag('rss', true, `Haber API (${rssOkCount}✓ / ${rssFailCount}✗)`);
      cacheSet('rss:' + url + ':' + count, items);
      return items;
    } catch (e) {
      rssFailCount++;
      setDiag('rss', rssOkCount > 0, `Haber API (${rssOkCount}✓ / ${rssFailCount}✗)`);
      throw e;
    }
  }

  // Cache-first wrapper: cache varsa anında dön + arka planda tazele.
  // onFresh(items) çağrısı her güncellemede tetiklenir.
  function fetchRSSCached(url, count, onFresh) {
    const key = 'rss:' + url + ':' + count;
    const entry = cacheGet(key);
    const cached = entry ? entry.data : null;
    // Cache varsa anında render et
    if (cached && cached.length) onFresh(cached, true);
    // Arka planda taze veri al (cache fresh ise yine de güncelleyelim, ama tetiklemeyelim)
    const isFresh = cacheFresh(entry);
    if (isFresh) {
      // 10 dk içinde tazelenmiş — yeni istek atmaya gerek yok
      return Promise.resolve(cached || []);
    }
    return fetchRSS(url, count)
      .then(items => { onFresh(items, false); return items; })
      .catch(err => { if (!cached) onFresh(null, false, err); return cached || []; });
  }

  // ===== KAP fetcher (cache) =====
  let kapCache = null;
  // Mynet Finans KAP haberleri — server-side HTML, taze (dakika başı), bedava
  // 50 son KAP duyurusu, tıklanabilir detay sayfası ile.
  async function fetchMynetKAP() {
    const TR_MON = { 'oca':0,'şub':1,'sub':1,'mar':2,'nis':3,'may':4,'haz':5,'tem':6,'ağu':7,'agu':7,'eyl':8,'eki':9,'kas':10,'ara':11 };
    const html = await fetchVia('https://finans.mynet.com/borsa/kaphaberleri/', { timeout: 8000 });
    const re = /<a\s+href="(https:\/\/finans\.mynet\.com\/borsa\/haberdetay\/[^"]+)"[^>]*title="([^"]+)"[^>]*>\s*<em class="title">[^<]*<\/em>\s*<span class="date">([^<]+)<\/span>/g;
    // HTML entity'leri çöz
    function decode(s) {
      return s.replace(/&Ccedil;/g,'Ç').replace(/&ccedil;/g,'ç')
              .replace(/&Ouml;/g,'Ö').replace(/&ouml;/g,'ö')
              .replace(/&Uuml;/g,'Ü').replace(/&uuml;/g,'ü')
              .replace(/&Auml;/g,'Ä').replace(/&auml;/g,'ä')
              .replace(/&Iuml;/g,'İ').replace(/&iuml;/g,'i')
              .replace(/&Eacute;/g,'É').replace(/&eacute;/g,'é')
              .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    }
    // Tarih parser: "08 Haz 2026 11:01"
    function parseDate(s) {
      const m = s.match(/(\d{1,2})\s+([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s+(20\d{2})\s+(\d{1,2}):(\d{2})/);
      if (!m) return new Date();
      const mi = TR_MON[m[2].toLowerCase().slice(0,3)];
      if (mi == null) return new Date();
      return new Date(+m[3], mi, +m[1], +m[4], +m[5]);
    }
    const items = [];
    let m;
    while ((m = re.exec(html)) !== null) {
      const title = decode(m[2]);
      const date  = parseDate(m[3]);
      // Başlıktan ticker(lar)ı çıkar: ***IZFAS*** veya ***OMP ** ODP*** (çoklu)
      const tickerBlock = title.match(/\*\*\*([^*]+)\*\*\*/);
      const tickers = tickerBlock
        ? tickerBlock[1].split(/[\s*,]+/).filter(t => /^[A-Z][A-Z0-9]{1,5}$/.test(t))
        : [];
      items.push({
        title,
        link: m[1],
        pubDate: date.toISOString(),
        description: '',
        author: 'KAP',
        tickers, // <-- yeni
      });
    }
    return items;
  }

  let kapPromise = null;
  async function fetchKAP() {
    if (kapCache) return kapCache;
    if (kapPromise) return kapPromise;
    kapPromise = (async () => {
      // Yeni birincil kaynak: Mynet Finans KAP haberleri (server-side HTML, bugünün tarihleri).
      // kap.org.tr kalıcı 403 verdiği için artık denemiyoruz.
      try {
        kapCache = await fetchMynetKAP();
        if (kapCache.length) cacheSet('kap:mynet', kapCache);
      } catch (e) {
        const cached = cacheGet('kap:mynet');
        kapCache = cached?.data || [];
      }
      setDiag('kap', kapCache.length > 0, `KAP (${kapCache.length})`);
      return kapCache;
    })();
    return kapPromise;
  }

  // ===== temettuhisseleri.com — BIST temettü takvimi (resmi kaynak) =====
  // Tek HTML sayfası, ay ay tablolarda her hisse için: ticker, gün+ay, % verim, tutar(₺)
  const TR_MONTHS_IDX = { 'ocak':0,'şubat':1,'subat':1,'mart':2,'nisan':3,'mayıs':4,'mayis':4,'haziran':5,'temmuz':6,'ağustos':7,'agustos':7,'eylül':8,'eylul':8,'ekim':9,'kasım':10,'kasim':10,'aralık':11,'aralik':11 };
  let temettuCache = null;
  let temettuPromise = null;
  async function fetchTemettuTakvimi() {
    if (temettuCache) return temettuCache;
    if (temettuPromise) return temettuPromise;
    // localStorage cache (60 dk — temettü takvimi gün içinde nadiren değişir)
    const cached = cacheGet('temettu-takvimi');
    if (cached && (Date.now() - cached.t) < 60 * 60 * 1000) {
      // String tarih → Date objesi
      temettuCache = cached.data.map(e => ({ ...e, date: new Date(e.date) }));
    }
    temettuPromise = (async () => {
      try {
        const html = await fetchVia('https://temettuhisseleri.com/temettutarihleri/', { timeout: 10000 });
        const parsed = parseTemettuHtml(html);
        if (parsed.length) {
          temettuCache = parsed;
          // Serileştirmek için Date → ISO string
          cacheSet('temettu-takvimi', parsed.map(e => ({ ...e, date: e.date.toISOString() })));
        }
      } catch (e) {
        console.warn('Temettü takvimi fetch başarısız, cache kullanılıyor:', e.message);
      }
      return temettuCache || [];
    })();
    return temettuPromise;
  }

  function parseTemettuHtml(html) {
    // Site 2026'da Bootstrap tablolara geçti. Güncel yapı:
    // Ay başlığı: <tr class="table-light"><td colspan="2" class="small fw-semibold">Haziran 2026</td>...
    // Satır:      <td><a href='/hisseanaliz/TICKER' ...>TICKER</a></td>
    //             <td class="small">DD MonthName</td>
    //             <td><span class='badge ...'>%X.XX</span></td>
    //             <td class="small">X.XXXX₺</td>
    // (regex'ler td/span class'larına ve ondalık ayraçlarına toleranslı)
    const out = [];
    const seen = new Set();
    // İki paterni de yakalamak için global regex'ler
    const monthHdrRe = /colspan=['"]2['"][^>]*>\s*([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s+(20\d{2})\s*</g;
    const rowRe = /href=['"]\/hisseanaliz\/([A-Z0-9]+)['"][^>]*>[^<]*<\/a>\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s+([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*%\s*([\d.,]+)\s*<\/span>\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*₺/g;

    // Önce tüm ay başlıklarının pozisyonlarını topla
    const monthMarkers = [];
    let mh;
    while ((mh = monthHdrRe.exec(html)) !== null) {
      const mIdx = TR_MONTHS_IDX[mh[1].toLowerCase()];
      if (mIdx == null) continue;
      monthMarkers.push({ pos: mh.index, monthIdx: mIdx, year: +mh[2] });
    }
    monthMarkers.sort((a, b) => a.pos - b.pos);

    // Her satırı ilgili ay başlığına ata (en son önce gelen)
    let rm;
    while ((rm = rowRe.exec(html)) !== null) {
      const ticker = rm[1];
      const day = +rm[2];
      const rowMonthName = rm[3].toLowerCase();
      const rowMonthIdx = TR_MONTHS_IDX[rowMonthName];
      const yieldPct = parseFloat(rm[4].replace(',', '.'));
      const amount = parseFloat(rm[5].replace(',', '.'));
      if (rowMonthIdx == null || isNaN(amount)) continue;

      // Bu satırın pozisyonundan önce gelen en son ay başlığını bul → yıl
      let year = null;
      for (let i = monthMarkers.length - 1; i >= 0; i--) {
        if (monthMarkers[i].pos < rm.index) {
          // Ay isimleri eşleşmeli (tablo başlığı ile satır ayı)
          if (monthMarkers[i].monthIdx === rowMonthIdx) {
            year = monthMarkers[i].year;
          } else {
            // Tutarsızlık: tablo başlığı ile satır ayı farklı → satır ayını kullan, yıl yakın olanı
            year = monthMarkers[i].year;
          }
          break;
        }
      }
      if (year == null) continue;

      const date = new Date(year, rowMonthIdx, day);
      const key = `${ticker}|${date.toISOString().slice(0,10)}|${Math.round(amount * 10000)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ symbol: ticker, date, amount, yieldPct, currency: '₺' });
    }
    return out;
  }

  // KAP doğrudan feed çalışmazsa, Google News'te "TICKER KAP" araması fallback
  let kapFallbackHits = 0;
  async function fetchKAPFallback(ticker, kind = 'kap') {
    let q;
    if (kind === 'earnings')      q = `${ticker} bilanço finansal rapor KAP`;
    else if (kind === 'dividend') q = `${ticker} temettü kar payı dağıtım KAP`;
    else                          q = `${ticker} KAP bildirim duyuru`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`;
    try {
      const items = await fetchRSS(url, 6);
      if (items.length) {
        kapFallbackHits += items.length;
        // KAP feed boşsa bile fallback çalıştıysa diag ✓ olsun
        if (!kapCache || !kapCache.length) {
          setDiag('kap', true, `KAP (alt: ${kapFallbackHits})`);
        }
      }
      return items.map(it => ({ ...it, _fallback: true }));
    } catch (e) {
      return [];
    }
  }

  function kapItemsForTicker(allItems, ticker, opts = {}) {
    const t = ticker.toUpperCase();
    const filters = opts.subjectIncludes; // array of strings to filter title
    return allItems.filter(it => {
      const text = (it.title + ' ' + (it.description || '')).toUpperCase();
      const tickerMatch = new RegExp(`\\b${t}\\b`).test(text);
      if (!tickerMatch) return false;
      if (!filters) return true;
      return filters.some(f => text.includes(f.toUpperCase()));
    });
  }

  // ===== Yahoo Finance: fiyat + grafik =====
  function yahooSymbol(symbol, market) {
    if (market === 'BIST') return symbol + '.IS';
    return symbol;
  }

  async function fetchYahooChart(symbol, market, range = '3mo', interval = '1d') {
    const ysym = yahooSymbol(symbol, market);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?range=${range}&interval=${interval}`;
    try {
      const res = await fetch(proxy(url));
      if (!res.ok) { setDiag('yahoo', false, 'Yahoo'); return null; }
      const json = await res.json();
      const result = json.chart?.result?.[0];
      if (!result) { setDiag('yahoo', false, 'Yahoo'); return null; }
      setDiag('yahoo', true, 'Yahoo');
      const meta = result.meta;
      const ts   = result.timestamp || [];
      const close = result.indicators?.quote?.[0]?.close || [];
      const points = ts.map((t, i) => ({ t: t * 1000, c: close[i] }))
                       .filter(p => p.c != null);
      return {
        price:        meta.regularMarketPrice,
        prevClose:    meta.chartPreviousClose,
        currency:     meta.currency,
        exchange:     meta.exchangeName,
        marketTime:   meta.regularMarketTime * 1000,
        points,
      };
    } catch (e) {
      setDiag('yahoo', false, 'Yahoo');
      return null;
    }
  }

  // Açılışta Yahoo erişimini bir kez ping et (diag için)
  function pingYahoo() {
    fetchYahooChart('AAPL', 'US', '5d', '1d');
  }

  function makeSparkline(points, w = 660, h = 110) {
    if (!points.length) return '';
    const xs = points.map(p => p.t);
    const ys = points.map(p => p.c);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const pad = 8;
    const sx = (x) => pad + (x - xmin) / (xmax - xmin || 1) * (w - 2 * pad);
    const sy = (y) => h - pad - (y - ymin) / (ymax - ymin || 1) * (h - 2 * pad);
    const d = points.map((p, i) =>
      (i === 0 ? 'M' : 'L') + sx(p.t).toFixed(1) + ',' + sy(p.c).toFixed(1)
    ).join(' ');
    const fillD = d + ` L${sx(xmax).toFixed(1)},${h - pad} L${sx(xmin).toFixed(1)},${h - pad} Z`;
    const last = points[points.length - 1];
    const first = points[0];
    const up = last.c >= first.c;
    const color = up ? '#2ecc71' : '#ff5c6c';
    return `
      <svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${fillD}" fill="url(#sparkfill)"/>
        <path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/>
      </svg>
    `;
  }

  // ===== Teknik analiz: OHLCV + indikatörler =====
  async function fetchYahooOHLC(symbol, market, range = '6mo', interval = '1d') {
    const ysym = encodeURIComponent(yahooSymbol(symbol, market)); // endeks ^GSPC → %5EGSPC
    const bust = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 dk cache bucket
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?range=${range}&interval=${interval}&_t=${bust}`;
    const res = await fetch(proxy(url));
    if (!res.ok) { setDiag('yahoo', false, 'Yahoo'); throw new Error('yahoo ' + res.status); }
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) { setDiag('yahoo', false, 'Yahoo'); throw new Error('no result'); }
    setDiag('yahoo', true, 'Yahoo');
    const ts = result.timestamp || [];
    const q  = result.indicators?.quote?.[0] || {};
    const candles = ts.map((t, i) => ({
      time: t,
      open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i],
      volume: q.volume?.[i],
    })).filter(c => c.close != null && c.open != null && c.high != null && c.low != null);
    return { candles, meta: result.meta };
  }

  // --- indikatör matematiği (closes: number[]) ---
  function calcSMA(values, period) {
    const out = new Array(values.length).fill(null);
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }
  function calcEMA(values, period) {
    const out = new Array(values.length).fill(null);
    const k = 2 / (period + 1);
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v == null) { out[i] = prev; continue; }
      prev = prev == null ? v : v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }
  function calcRSI(closes, period = 14) {
    const out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= period; i++) {
      const ch = closes[i] - closes[i - 1];
      if (ch >= 0) gain += ch; else loss -= ch;
    }
    let avgGain = gain / period, avgLoss = loss / period;
    out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1];
      const g = ch >= 0 ? ch : 0;
      const l = ch < 0 ? -ch : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }
  function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
    const emaFast = calcEMA(closes, fast);
    const emaSlow = calcEMA(closes, slow);
    const macdLine = closes.map((_, i) =>
      (emaFast[i] != null && emaSlow[i] != null) ? emaFast[i] - emaSlow[i] : null);
    const signalLine = calcEMA(macdLine.map(v => v == null ? null : v), signal);
    const hist = macdLine.map((v, i) =>
      (v != null && signalLine[i] != null) ? v - signalLine[i] : null);
    return { macdLine, signalLine, hist };
  }
  function calcBollinger(closes, period = 20, mult = 2) {
    const mid = calcSMA(closes, period);
    const upper = new Array(closes.length).fill(null);
    const lower = new Array(closes.length).fill(null);
    for (let i = period - 1; i < closes.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += (closes[j] - mid[i]) ** 2;
      const sd = Math.sqrt(sum / period);
      upper[i] = mid[i] + mult * sd;
      lower[i] = mid[i] - mult * sd;
    }
    return { mid, upper, lower };
  }
  // True Range serisi (highs/lows/closes hizalı)
  function calcTR(highs, lows, closes) {
    const out = new Array(closes.length).fill(null);
    for (let i = 1; i < closes.length; i++) {
      const h = highs[i], l = lows[i], pc = closes[i - 1];
      out[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    }
    return out;
  }
  // ATR (Wilder yumuşatma) — volatilite
  function calcATR(highs, lows, closes, period = 14) {
    const tr = calcTR(highs, lows, closes);
    const out = new Array(closes.length).fill(null);
    if (closes.length <= period) return out;
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += tr[i] || 0;
    let atr = sum / period;
    out[period] = atr;
    for (let i = period + 1; i < closes.length; i++) {
      atr = (atr * (period - 1) + (tr[i] || 0)) / period;
      out[i] = atr;
    }
    return out;
  }
  // ADX + +DI / -DI (Wilder) — trend gücü
  function calcADX(highs, lows, closes, period = 14) {
    const n = closes.length;
    const plusDM = new Array(n).fill(0), minusDM = new Array(n).fill(0);
    const tr = calcTR(highs, lows, closes);
    for (let i = 1; i < n; i++) {
      const up = highs[i] - highs[i - 1];
      const down = lows[i - 1] - lows[i];
      plusDM[i]  = (up > down && up > 0) ? up : 0;
      minusDM[i] = (down > up && down > 0) ? down : 0;
    }
    const plusDI = new Array(n).fill(null), minusDI = new Array(n).fill(null), adx = new Array(n).fill(null);
    if (n <= period * 2) return { plusDI, minusDI, adx };
    let trS = 0, pS = 0, mS = 0;
    for (let i = 1; i <= period; i++) { trS += tr[i] || 0; pS += plusDM[i]; mS += minusDM[i]; }
    const dxArr = [];
    for (let i = period + 1; i < n; i++) {
      trS = trS - trS / period + (tr[i] || 0);
      pS  = pS - pS / period + plusDM[i];
      mS  = mS - mS / period + minusDM[i];
      const pdi = trS === 0 ? 0 : 100 * pS / trS;
      const mdi = trS === 0 ? 0 : 100 * mS / trS;
      plusDI[i] = pdi; minusDI[i] = mdi;
      const dx = (pdi + mdi) === 0 ? 0 : 100 * Math.abs(pdi - mdi) / (pdi + mdi);
      dxArr.push({ i, dx });
    }
    // ADX = DX'in Wilder ortalaması (ilk period kadar DX'in ortalamasıyla başlat)
    if (dxArr.length >= period) {
      let adxVal = dxArr.slice(0, period).reduce((s, d) => s + d.dx, 0) / period;
      adx[dxArr[period - 1].i] = adxVal;
      for (let k = period; k < dxArr.length; k++) {
        adxVal = (adxVal * (period - 1) + dxArr[k].dx) / period;
        adx[dxArr[k].i] = adxVal;
      }
    }
    return { plusDI, minusDI, adx };
  }
  // Stochastic Oscillator (%K, %D) — momentum
  function calcStochastic(highs, lows, closes, period = 14, smoothK = 3, smoothD = 3) {
    const n = closes.length;
    const rawK = new Array(n).fill(null);
    for (let i = period - 1; i < n; i++) {
      let hh = -Infinity, ll = Infinity;
      for (let j = i - period + 1; j <= i; j++) { if (highs[j] > hh) hh = highs[j]; if (lows[j] < ll) ll = lows[j]; }
      rawK[i] = (hh - ll) === 0 ? 50 : 100 * (closes[i] - ll) / (hh - ll);
    }
    const k = calcSMA(rawK.map(v => v == null ? null : v).map(v => v ?? 0), smoothK)
      .map((v, i) => rawK[i] == null ? null : v);
    const d = calcSMA(k.map(v => v ?? 0), smoothD).map((v, i) => k[i] == null ? null : v);
    return { k, d };
  }
  // On-Balance Volume — para akışı
  function calcOBV(closes, volumes) {
    const out = new Array(closes.length).fill(null);
    let obv = 0;
    out[0] = 0;
    for (let i = 1; i < closes.length; i++) {
      const v = volumes[i] || 0;
      if (closes[i] > closes[i - 1]) obv += v;
      else if (closes[i] < closes[i - 1]) obv -= v;
      out[i] = obv;
    }
    return out;
  }

  // Ichimoku Kinko Hyo (Tenkan, Kijun, Senkou A/B)
  function calcIchimoku(highs, lows, closes, conv = 9, base = 26, spanB = 52) {
    const n = closes.length;
    const hh = (i, p) => { let m = -Infinity; for (let j = i - p + 1; j <= i; j++) if (highs[j] > m) m = highs[j]; return m; };
    const ll = (i, p) => { let m = Infinity;  for (let j = i - p + 1; j <= i; j++) if (lows[j]  < m) m = lows[j];  return m; };
    const tenkan = new Array(n).fill(null), kijun = new Array(n).fill(null),
          senkouA = new Array(n).fill(null), senkouB = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      if (i >= conv - 1)  tenkan[i] = (hh(i, conv) + ll(i, conv)) / 2;
      if (i >= base - 1)  kijun[i]  = (hh(i, base) + ll(i, base)) / 2;
      if (tenkan[i] != null && kijun[i] != null) senkouA[i] = (tenkan[i] + kijun[i]) / 2;
      if (i >= spanB - 1) senkouB[i] = (hh(i, spanB) + ll(i, spanB)) / 2;
    }
    return { tenkan, kijun, senkouA, senkouB, base };
  }
  // Fibonacci retracement — dönem içi en yüksek/en düşükten seviyeler
  function calcFibonacci(highs, lows) {
    const n = highs.length;
    let hi = -Infinity, lo = Infinity, hiI = 0, loI = 0;
    for (let i = 0; i < n; i++) {
      if (highs[i] > hi) { hi = highs[i]; hiI = i; }
      if (lows[i]  < lo) { lo = lows[i];  loI = i; }
    }
    const up = hiI > loI; // dip önce, zirve sonra → yükseliş dalgası
    const diff = hi - lo;
    const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    // Yükseliş: 0%=zirve, 100%=dip (geri çekilme destekleri).
    // Düşüş:    0%=dip,  100%=zirve (direnç seviyeleri).
    const levels = ratios.map(r => ({ ratio: r, price: up ? hi - diff * r : lo + diff * r }));
    return { hi, lo, up, diff, levels };
  }

  // Volume Profile: seçili aralıktaki hacmi fiyat kovalarına dağıtır.
  // Her bar hacmini [low, high] aralığıyla örtüşen kovalara oransal paylaştırır.
  // POC (en çok işlem gören fiyat), Value Area (%70 hacim: VAL–VAH), HVN/LVN çıkarır.
  function calcVolumeProfile(candles, binCount = 24) {
    let pMin = Infinity, pMax = -Infinity;
    for (const c of candles) { if (c.low < pMin) pMin = c.low; if (c.high > pMax) pMax = c.high; }
    if (!(pMax > pMin)) return null;
    const span = pMax - pMin;
    const bw = span / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      lo: pMin + i * bw, hi: pMin + (i + 1) * bw, mid: pMin + (i + 0.5) * bw, vol: 0,
    }));
    let totalVol = 0;
    for (const c of candles) {
      const v = c.volume || 0;
      if (v <= 0) continue;
      totalVol += v;
      const lo = c.low, hi = c.high;
      if (hi <= lo) { // range yok → typical price kovasına
        let idx = Math.floor((c.close - pMin) / bw); idx = Math.max(0, Math.min(binCount - 1, idx));
        bins[idx].vol += v; continue;
      }
      const barSpan = hi - lo;
      let i0 = Math.max(0, Math.floor((lo - pMin) / bw));
      let i1 = Math.min(binCount - 1, Math.floor((hi - pMin) / bw));
      for (let i = i0; i <= i1; i++) {
        const ov = Math.min(hi, bins[i].hi) - Math.max(lo, bins[i].lo); // örtüşme
        if (ov > 0) bins[i].vol += v * (ov / barSpan);
      }
    }
    if (totalVol <= 0) return null;
    // POC
    let pocIdx = 0; for (let i = 1; i < binCount; i++) if (bins[i].vol > bins[pocIdx].vol) pocIdx = i;
    // Value Area: POC'tan başla, komşulardan hacimli olanı ekleyerek %70'e ulaş
    let vaLo = pocIdx, vaHi = pocIdx, acc = bins[pocIdx].vol;
    const target = totalVol * 0.70;
    while (acc < target && (vaLo > 0 || vaHi < binCount - 1)) {
      const below = vaLo > 0 ? bins[vaLo - 1].vol : -1;
      const above = vaHi < binCount - 1 ? bins[vaHi + 1].vol : -1;
      if (above >= below) { vaHi++; acc += bins[vaHi].vol; }
      else { vaLo--; acc += bins[vaLo].vol; }
    }
    const maxVol = bins[pocIdx].vol;
    return {
      bins, pocIdx, vaLoIdx: vaLo, vaHiIdx: vaHi, maxVol, totalVol,
      poc: bins[pocIdx].mid, val: bins[vaLo].lo, vah: bins[vaHi].hi,
    };
  }

  // Order Flow (TAHMİNİ): gerçek order flow tick/Level-2 (bid/ask) verisi ister;
  // bizde yalnız OHLCV var. Bar içi kapanış konumundan alım/satım hacmi tahmin edilir:
  //   buyVol = vol*(close-low)/range, sellVol = vol*(high-close)/range, delta = buy-sell.
  // CVD = kümülatif delta. Fiyat–CVD uyumsuzluğu (divergence) öncü zayıflık/güç işareti.
  function calcOrderFlow(candles, win = 14) {
    const n = candles.length;
    if (n < win + 2) return null;
    const delta = new Array(n).fill(0);
    const cvd = new Array(n).fill(0);
    let run = 0;
    for (let i = 0; i < n; i++) {
      const c = candles[i], v = c.volume || 0, range = c.high - c.low;
      let d;
      if (range > 0) d = v * ((2 * c.close - c.high - c.low) / range);
      else d = i > 0 ? (c.close >= candles[i - 1].close ? v : -v) : 0;
      delta[i] = d; run += d; cvd[i] = run;
    }
    const last = n - 1;
    // Son pencerede alım/satım baskısı
    let buySum = 0, sellSum = 0, absDeltaSum = 0;
    for (let i = last - win + 1; i <= last; i++) {
      const c = candles[i], v = c.volume || 0, range = c.high - c.low;
      const bf = range > 0 ? (c.close - c.low) / range : 0.5;
      buySum += v * bf; sellSum += v * (1 - bf); absDeltaSum += Math.abs(delta[i]);
    }
    const buyPct = (buySum + sellSum) > 0 ? buySum / (buySum + sellSum) * 100 : 50;
    // CVD ve fiyat eğimi (son pencere)
    const cvdSlope = cvd[last] - cvd[last - win];
    const priceSlope = candles[last].close - candles[last - win].close;
    // Bugünkü delta, ortalama |delta|'ya göre ne kadar agresif?
    const avgAbs = absDeltaSum / win || 1;
    const todayZ = delta[last] / avgAbs; // ~+1'den büyükse belirgin agresif alım
    return { delta, cvd, buyPct, cvdSlope, priceSlope, todayDelta: delta[last], todayZ, win };
  }

  // ===== Vade-bazlı skorlama motoru (0–100) =====
  // Günlük OHLCV'yi haftalık/aylık bara toplar, seçilen vadenin karışımına (confluence)
  // göre her göstergeyi 0–100 alt-skora normalize eder, ağırlıklandırır, ADX ile güveni
  // ayarlar ve tek bir 0–100 skor + gösterge katkı dökümü üretir. Yatırım tavsiyesi değildir.

  // Günlük mumları haftalık ('W') veya aylık ('M') mumlara topla.
  function resampleCandles(daily, unit) {
    const keyOf = (t) => {
      const d = new Date(t * 1000);
      if (unit === 'M') return d.getUTCFullYear() * 12 + d.getUTCMonth();
      // ISO hafta numarası
      const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = (dt.getUTCDay() + 6) % 7;
      dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
      const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
      const week = 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
      return dt.getUTCFullYear() * 53 + week;
    };
    const groups = new Map();
    for (const c of daily) {
      if (c.close == null) continue;
      const k = keyOf(c.time);
      let g = groups.get(k);
      if (!g) groups.set(k, { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 });
      else { g.high = Math.max(g.high, c.high); g.low = Math.min(g.low, c.low); g.close = c.close; g.volume += c.volume || 0; }
    }
    return [...groups.values()].sort((a, b) => a.time - b.time);
  }

  // Bir zaman diliminin son barındaki ham gösterge değerleri.
  function taTFIndicators(candles, tf) {
    if (!candles || candles.length < 30) return null;
    const closes = candles.map(c => c.close), highs = candles.map(c => c.high),
          lows = candles.map(c => c.low), vols = candles.map(c => c.volume);
    const L = closes.length - 1;
    const vpWin = tf === 'D' ? 120 : tf === 'W' ? 150 : tf === 'M' ? 60
                : tf === 'H1' ? 110 : tf === 'M15' ? 130 : 100; // ufka uygun profil penceresi
    return {
      L, price: closes[L], closes, vols,
      sma50: calcSMA(closes, 50), sma200: calcSMA(closes, 200),
      macd: calcMACD(closes, 12, 26, 9),
      rsi: calcRSI(closes, 14),
      stoch: calcStochastic(highs, lows, closes, 14, 3, 3),
      boll: calcBollinger(closes, 20, 2),
      adx: calcADX(highs, lows, closes, 14),
      obv: calcOBV(closes, vols),
      ichi: calcIchimoku(highs, lows, closes),
      atr: calcATR(highs, lows, closes, 14),
      vprof: calcVolumeProfile(candles.slice(-Math.min(candles.length, vpWin)), 24),
      oflow: calcOrderFlow(candles, 14),
    };
  }

  // ---- Rejim tespiti: trend mi, yatay mı? (rejim-koşullu RSI/Stokastik okuması için) ----
  // Güçlü trendde aşırı alım/satım "ters sinyal" DEĞİLDİR (RSI 70 yükselişte normaldir).
  // trend  → RSI/Stoch momentum okunur (yüksek = teyit); range → klasik reversal (yüksek = sat).
  function taRegime(t) {
    const L = t.L, price = t.price, s50 = t.sma50[L], s200 = t.sma200[L];
    const adx = t.adx && t.adx.adx ? t.adx.adx[L] : null;
    if (adx == null || s50 == null) return 'neutral';
    const up = price > s50 && (s200 == null || s50 >= s200);
    const dn = price < s50 && (s200 == null || s50 <= s200);
    if (adx >= 22 && (up || dn)) return 'trend';   // güçlü yönlü trend
    if (adx < 18) return 'range';                  // yataylaşma → reversal geçerli
    return 'neutral';
  }

  // Göreli Güç (RS): hisse endeksi yeniyor mu? closes = hisse, bench = endeks (aynı tf).
  // Birden çok geriye-bakış penceresinde göreli getiri + RS çizgisinin eğimi. 0–100.
  function taRelStrength(closes, bench, lookbacks) {
    if (!closes || !bench || bench.length < 30) return null;
    const cl = closes[closes.length - 1], bl = bench[bench.length - 1];
    if (!(cl > 0) || !(bl > 0)) return null;
    let sum = 0, n = 0;
    for (const k of lookbacks) {
      const ci = closes.length - 1 - k, bi = bench.length - 1 - k;
      if (ci < 0 || bi < 0) continue;
      const c0 = closes[ci], b0 = bench[bi];
      if (!(c0 > 0) || !(b0 > 0)) continue;
      const rel = (cl / c0 - 1) - (bl / b0 - 1); // hisse getirisi − endeks getirisi
      sum += rel; n++;
    }
    if (!n) return null;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    // Ortalama göreli getiriyi skora çevir (±%20 fark ≈ uçlar). RS çizgisi eğimi zaten içinde.
    return clamp(50 + (sum / n) * 130, 3, 97);
  }

  // Hacim Teyidi: hareket hacimle mi destekleniyor? Sahte kırılımı eler. 0–100.
  // "Hacim fiyattan önce gelir" folklor olarak ÖNCÜ değildir ama TEYİT olarak sağlamdır.
  function taVolConfirm(t) {
    const L = t.L, v = t.vols, cl = t.closes;
    if (!v || v.length < 25) return null;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    // Son 20 barda yukarı-gün hacmi vs aşağı-gün hacmi (para akış yönü)
    let upV = 0, dnV = 0, avg = 0;
    for (let i = L - 19; i <= L; i++) {
      if (i <= 0 || v[i] == null) continue;
      avg += v[i];
      if (cl[i] > cl[i - 1]) upV += v[i]; else dnV += v[i];
    }
    const tot = upV + dnV;
    if (tot <= 0) return null;
    avg /= 20;
    let sc = 50 + (upV / tot - 0.5) * 70;
    // Kırılım teyidi: 20-bar zirvesi hacimle mi geldi?
    const win = cl.slice(Math.max(0, L - 19), L + 1);
    const hi20 = Math.max(...win), lo20 = Math.min(...win);
    const volRatio = avg > 0 ? v[L] / avg : 1;
    if (cl[L] >= hi20 * 0.999) sc += volRatio >= 1.5 ? 12 : (volRatio < 0.8 ? -8 : 0); // teyitli / şüpheli kırılım
    if (cl[L] <= lo20 * 1.001 && volRatio >= 1.5) sc -= 10; // hacimli çöküş
    return clamp(sc, 3, 97);
  }

  // Trend Şablonu (Minervini): yükseliş trendi kalite kapısı (8 koşul). 0–100.
  function taTrendTemplate(t) {
    const L = t.L, price = t.price, s50 = t.sma50[L], s200 = t.sma200[L];
    if (s50 == null || s200 == null) return null;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const win = t.closes.slice(Math.max(0, L - 251)); // ~52 hafta (günlük)
    const hi = Math.max(...win), lo = Math.min(...win);
    const s50p = t.sma50[L - 10], s200p = t.sma200[L - 20];
    const cond = [
      price > s50,                          // 1
      price > s200,                         // 2
      s50 > s200,                           // 3
      s200p != null ? s200 > s200p : null,  // 4  SMA200 yükseliyor
      s50p  != null ? s50  > s50p  : null,  // 5  SMA50 yükseliyor
      lo > 0 ? price >= lo * 1.30 : null,   // 6  52h dipten ≥%30 yukarı
      hi > 0 ? price >= hi * 0.75 : null,   // 7  52h zirveye %25 mesafede
      price > (s50 + s200) / 2,             // 8  kısa ort. uzun ort. üstünde konumlu
    ];
    let met = 0, tot = 0;
    for (const c of cond) { if (c == null) continue; tot++; if (c) met++; }
    if (!tot) return null;
    return clamp(8 + (met / tot) * 88, 3, 97); // hepsi ≈ 96, hiç ≈ 8
  }

  // Ham göstergeleri 0–100 yönlü alt-skora çevir (50 = nötr, >50 = yükseliş).
  // interp: kısa vadede 'reversal' (aşırı alım = sat), orta/uzun 'momentum'/'trend'.
  // ctx: { regime, benchCloses, rsLookbacks } — rejim-koşullu okuma + RS için endeks serisi.
  function taNormalize(t, interp, ctx) {
    const L = t.L, price = t.price;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const out = {};
    ctx = ctx || {};
    const regime = ctx.regime || 'neutral';
    // Rejim-koşullu: güçlü trendde reversal → momentum (RSI 70 artık "sat" değil, teyit);
    // yataylaşmada momentum/trend → reversal (uçlarda geri dönüş beklenir).
    let effInterp = interp;
    if (regime === 'trend' && interp === 'reversal') effInterp = 'momentum';
    else if (regime === 'range' && (interp === 'momentum' || interp === 'trend')) effInterp = 'reversal';

    // Trend (hareketli ortalamalar)
    const s50 = t.sma50[L], s200 = t.sma200[L];
    if (s50 == null && s200 == null) out.trend = null;
    else {
      let sc = 50;
      if (s50 != null) { sc += price > s50 ? 10 : -10; const pv = t.sma50[L - 10]; if (pv != null) sc += s50 > pv ? 8 : -8; }
      if (s200 != null) sc += price > s200 ? 10 : -10;
      if (s50 != null && s200 != null) sc += s50 > s200 ? 15 : -15;
      out.trend = clamp(sc, 3, 97);
    }

    // Ichimoku
    const ic = t.ichi, ib = ic.base;
    const tk = ic.tenkan[L], kj = ic.kijun[L];
    const sa = (L - ib >= 0) ? ic.senkouA[L - ib] : null, sb = (L - ib >= 0) ? ic.senkouB[L - ib] : null;
    if (sa == null || sb == null || tk == null || kj == null) out.ichimoku = null;
    else {
      const top = Math.max(sa, sb), bot = Math.min(sa, sb);
      let sc = 50;
      if (price > top) sc += 20; else if (price < bot) sc -= 20;
      sc += tk > kj ? 12 : -12;
      if (price > top && tk > kj) sc += 8; else if (price < bot && tk < kj) sc -= 8;
      out.ichimoku = clamp(sc, 3, 97);
    }

    // MACD (histogram fiyat/ATR ile ölçekli)
    const mc = t.macd.macdLine[L], sg = t.macd.signalLine[L], atr = t.atr[L];
    if (mc == null || sg == null) out.macd = null;
    else {
      const scale = (atr && atr > 0) ? 0.9 * atr : (price * 0.01 || 1);
      out.macd = clamp(50 + 27 * Math.tanh((mc - sg) / scale) + (mc > 0 ? 8 : -8), 3, 97);
    }

    // RSI (rejim-koşullu). Trend rejiminde 70+ "sat" değil momentum teyidi; ama
    // negatif uyumsuzluk (fiyat yeni zirve, RSI değil) yükseliş okumasını törpüler.
    const r = t.rsi[L];
    if (r == null) out.rsi = null;
    else {
      let sc = effInterp === 'reversal' ? 50 - (r - 50) * 0.8 : 50 + (r - 50) * 0.9;
      if (L >= 14) {
        const pWin = t.closes.slice(L - 13, L + 1), rWin = t.rsi.slice(L - 13, L + 1).filter(x => x != null);
        if (rWin.length > 6) {
          // negatif uyumsuzluk (fiyat yeni zirve, RSI değil) → yalnız trend rejiminde momentum okumasını törpüler
          if (regime === 'trend' && effInterp === 'momentum') {
            const priceHi = price >= Math.max(...pWin) * 0.999;
            const rsiOffPeak = r < Math.max(...rWin) - 5;
            if (priceHi && rsiOffPeak) sc -= 12; // momentum zayıflıyor
          }
          // pozitif uyumsuzluk (fiyat yeni dip, RSI daha yüksek dip) → olası dip/dönüş, AL lehine
          const priceLo = price <= Math.min(...pWin) * 1.001;
          const rsiOffTrough = r > Math.min(...rWin) + 5;
          if (priceLo && rsiOffTrough) sc += 12; // satış baskısı tükeniyor
        }
      }
      out.rsi = clamp(sc, 3, 97);
    }

    // Stokastik (rejim-koşullu)
    const kk = t.stoch.k[L], dd = t.stoch.d[L];
    if (kk == null) out.stoch = null;
    else {
      let sc = effInterp === 'reversal' ? 50 - (kk - 50) * 0.7 : 50 + (kk - 50) * 0.6;
      if (dd != null) sc += kk > dd ? 5 : -5;
      out.stoch = clamp(sc, 3, 97);
    }

    // Bollinger %B (ortalamaya dönüş okuması)
    const bu = t.boll.upper[L], bl = t.boll.lower[L];
    if (bu == null || bl == null || bu <= bl) out.boll = null;
    else out.boll = clamp(50 - ((price - bl) / (bu - bl) - 0.5) * 60, 3, 97);

    // OBV eğimi + uyumsuzluk
    const o = t.obv;
    if (o[L] == null || o.length < 25) out.obv = null;
    else {
      const ref = o[L - 20];
      if (ref == null || ref === 0) out.obv = null;
      else {
        const obvChg = (o[L] - ref) / Math.abs(ref);
        const pChg = t.closes[L - 20] ? (price - t.closes[L - 20]) / t.closes[L - 20] : 0;
        let sc = 50 + clamp(obvChg * 3, -1, 1) * 25;
        if (obvChg > 0.03 && pChg < 0) sc += 10;
        if (obvChg < -0.03 && pChg > 0) sc -= 10;
        out.obv = clamp(sc, 3, 97);
      }
    }

    // Volume Profile konumu (değer alanına göre)
    const vp = t.vprof;
    if (!vp) out.vp = null;
    else {
      const { val, vah, poc } = vp;
      let sc;
      if (price > vah) sc = 68 + clamp((price - vah) / ((vah - poc) || 1), 0, 1) * 17;
      else if (price < val) sc = 32 - clamp((val - price) / ((poc - val) || 1), 0, 1) * 17;
      else sc = price >= poc ? 50 + (price - poc) / ((vah - poc) || 1) * 10 : 50 - (poc - price) / ((poc - val) || 1) * 10;
      out.vp = clamp(sc, 3, 97);
    }

    // Order Flow (tahmini)
    const of = t.oflow;
    if (!of) out.oflow = null;
    else {
      let sc = 50 + (of.buyPct - 50) * 0.6;
      const pUp = of.priceSlope > 0, cUp = of.cvdSlope > 0;
      if (pUp && cUp) sc += 6; else if (!pUp && !cUp) sc -= 6;
      else if (!pUp && cUp) sc += 10; else sc -= 10; // pozitif/negatif uyumsuzluk
      out.oflow = clamp(sc, 3, 97);
    }

    // Göreli Güç (RS) — endekse karşı. Endeks serisi geçilmişse hesaplanır.
    out.rs = ctx.benchCloses ? taRelStrength(t.closes, ctx.benchCloses, ctx.rsLookbacks || [21, 63, 126]) : null;
    // Hacim Teyidi
    out.volconf = taVolConfirm(t);
    // Trend Şablonu (Minervini kalite kapısı)
    out.ttmpl = taTrendTemplate(t);

    return out;
  }

  // ADX'i güven çarpanına çevir (yön vermez, sadece trendin güvenilirliğini ölçekler).
  function taAdxFactor(adxVal) {
    if (adxVal == null) return 1;
    if (adxVal >= 40) return 1.15;
    if (adxVal >= 25) return 1.08;
    if (adxVal >= 20) return 1.0;
    return 0.9; // yatay/range → trend sinyalleri güvenilmez, güveni kıs
  }

  const TA_KEY_LABEL = {
    trend: 'Trend (MA)', ichimoku: 'Ichimoku', macd: 'MACD', rsi: 'RSI',
    stoch: 'Stokastik', boll: 'Bollinger', obv: 'OBV · Hacim',
    vp: 'Volume Profile', oflow: 'Order Flow (tahmini)',
    rs: 'Göreli Güç (RS)', volconf: 'Hacim Teyidi', ttmpl: 'Trend Şablonu',
  };
  const TA_KEY_DESC = {
    trend: 'Fiyatın SMA50/SMA200’e göre konumu ve eğimi — genel yön.',
    ichimoku: 'Bulut + Tenkan/Kijun — trend ve destek/direnç.',
    macd: 'Momentum: histogram + sıfır çizgisi tarafı (teyit).',
    rsi: 'Aşırı alım/satım — rejim-koşullu: trendde momentum teyidi, yatayda geri dönüş.',
    stoch: 'Kısa vadeli momentum salınımı — rejim-koşullu okunur.',
    boll: 'Bollinger %B — ortalamaya dönüş / bant konumu.',
    obv: 'On-Balance Volume eğimi + fiyatla uyumsuzluk.',
    vp: 'Hacim profili değer alanı (POC/VAH/VAL) içinde konum.',
    oflow: 'Tahmini alıcı/satıcı baskısı — yalnız gün içinde öncü.',
    rs: 'Endeksi (BIST100 / S&P500) yeniyor mu? Trend-takibin bir numarası.',
    volconf: 'Hareket hacimle destekli mi? Sahte kırılım filtresi.',
    ttmpl: 'Minervini yükseliş-trendi kalite kapısı (8 koşul).',
  };

  // Skor göstergesi aç/kapa durumu (kullanıcı bir göstergeyi skordan çıkarabilir; kalanlar
  // otomatik normalize olur). false = kapalı. localStorage'da kalıcı. Varsayılan: hepsi açık.
  const TA_SCORE_IND_LS = 'taScoreIndVis';
  let taScoreIndVis = (() => {
    try { return JSON.parse(localStorage.getItem(TA_SCORE_IND_LS)) || {}; } catch { return {}; }
  })();
  function setTaScoreInd(key, on) {
    taScoreIndVis[key] = on;
    try { localStorage.setItem(TA_SCORE_IND_LS, JSON.stringify(taScoreIndVis)); } catch {}
  }

  // Ana skorlama: günlük mumlardan vade skorunu üret.
  // daily: günlük mumlar (günlük vadeler için). intraday vadelerde daily yerine
  // tfDataOverride = { H1:[...], M15:[...] } geçilir (backtest'te { H1:slice, M15:null } olabilir).
  // benchDaily: karşılaştırma endeksinin günlük mumları (Göreli Güç/RS için, opsiyonel).
  // Geçilmezse RS göstergesi hesaplanmaz ve ağırlığı otomatik normalize olur (skor bozulmaz).
  function computeVadeScore(daily, vadeKey, tfDataOverride, benchDaily) {
    const cfg = (window.TA_WEIGHTS || {})[vadeKey];
    if (!cfg) return null;
    let tfData, benchTf = null;
    if (cfg.intraday) {
      tfData = tfDataOverride;
      if (!tfData) return null;
    } else {
      if (!daily || daily.length < 40) return null;
      tfData = { D: daily, W: resampleCandles(daily, 'W'), M: resampleCandles(daily, 'M') };
      if (benchDaily && benchDaily.length >= 40)
        benchTf = { D: benchDaily, W: resampleCandles(benchDaily, 'W'), M: resampleCandles(benchDaily, 'M') };
    }
    const RS_LOOKBACKS = { D: [21, 63, 126], W: [4, 13, 26], M: [3, 6, 12] };

    const perTf = {}, adxByTf = {}, regimeByTf = {};
    for (const { tf } of cfg.blend) {
      const ind = taTFIndicators(tfData[tf], tf);
      if (!ind) { perTf[tf] = null; continue; }
      const regime = taRegime(ind);
      regimeByTf[tf] = regime;
      const benchCloses = benchTf && benchTf[tf] ? benchTf[tf].map(c => c.close) : null;
      perTf[tf] = taNormalize(ind, cfg.interp, { regime, benchCloses, rsLookbacks: RS_LOOKBACKS[tf] });
      adxByTf[tf] = ind.adx.adx[ind.L];
    }

    const breakdown = [];
    let devSum = 0, wSum = 0;
    for (const key of Object.keys(cfg.weights)) {
      if (taScoreIndVis && taScoreIndVis[key] === false) continue; // kullanıcı bu göstergeyi kapatmış
      let s = 0, tw = 0;
      for (const { tf, w } of cfg.blend) {
        const p = perTf[tf]; if (!p) continue;
        const v = p[key]; if (v == null) continue;
        s += v * w; tw += w;
      }
      if (tw === 0) continue;
      const indScore = s / tw;
      const wt = cfg.weights[key];
      breakdown.push({ key, label: TA_KEY_LABEL[key] || key, score: indScore, weight: wt });
      devSum += wt * (indScore - 50);
      wSum += wt;
    }
    if (wSum === 0) return null;

    const raw = 50 + devSum / wSum;
    const adxVal = adxByTf[cfg.adxTf] != null ? adxByTf[cfg.adxTf] : adxByTf[cfg.blend[0].tf];
    const adxF = taAdxFactor(adxVal);
    const score = Math.max(2, Math.min(98, 50 + (raw - 50) * adxF));

    // katkı dökümü (nihai skora, ADX çarpanı dahil)
    const scaleC = adxF / wSum;
    breakdown.forEach(b => { b.contrib = b.weight * (b.score - 50) * scaleC; b.wPct = b.weight / wSum * 100; });
    breakdown.sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));

    let label, cls;
    if (score >= 66) { label = 'GÜÇLÜ AL'; cls = 'bull'; }
    else if (score >= 56) { label = 'AL eğilimi'; cls = 'bull'; }
    else if (score > 52) { label = 'Zayıf AL'; cls = 'bull'; }
    else if (score >= 48) { label = 'Nötr'; cls = 'neutral'; }
    else if (score > 44) { label = 'Zayıf SAT'; cls = 'bear'; }
    else if (score >= 34) { label = 'SAT eğilimi'; cls = 'bear'; }
    else { label = 'GÜÇLÜ SAT'; cls = 'bear'; }

    // seviyeler: günlük vadelerde günlük ATR + son ~1 yıl fib/VP (eskiyle birebir);
    // gün içi vadede temel zaman dilimi (H1) üzerinden hesaplanır.
    const levelTf = cfg.intraday ? cfg.blend[0].tf : 'D';
    const levelSeries = cfg.intraday ? tfData[levelTf] : daily;
    const dind = taTFIndicators(levelSeries, levelTf);
    if (!dind) return null;
    const price = dind.price, atr = dind.atr[dind.L];
    const recent = levelSeries.slice(-Math.min(levelSeries.length, 250));
    const fib = calcFibonacci(recent.map(c => c.high), recent.map(c => c.low));
    let sup = null, res = null;
    if (fib && fib.diff > 0) {
      const sp = fib.levels.map(l => l.price).sort((a, b) => a - b);
      for (const p of sp) { if (p <= price) sup = p; else { res = p; break; } }
    }
    const vpD = dind.vprof;
    const buy = score > 50;
    const stop = atr != null ? (buy ? price - 2 * atr : price + 2 * atr) : sup;
    const target = buy ? (res != null ? res : (vpD ? vpD.vah : null)) : (sup != null ? sup : (vpD ? vpD.val : null));
    let rr = null;
    if (target != null && stop != null) { const risk = Math.abs(price - stop), reward = Math.abs(target - price); if (risk > 0) rr = reward / risk; }

    // ===== Alım / Satım fiyat aralıkları (vadeye göre bant) =====
    // Çapa: en yakın destek (alım) ve en yakın direnç (satım). Adaylar VP değer alanı +
    // Fibonacci + Bollinger + hareketli ortalamalardan. Bant yarı-genişliği vadeye özel ATR
    // çarpanıyla ölçeklenir → gün içi en dar, uzun vade en geniş (temel zaman dilimi ATR'si
    // + çarpan birlikte). Yön değil, "nerede" bilgisi; yatırım tavsiyesi değildir.
    const Ld = dind.L;
    const bU = dind.boll.upper[Ld], bL = dind.boll.lower[Ld];
    const s50 = dind.sma50[Ld], s200 = dind.sma200[Ld];
    const fibPrices = (fib && fib.diff > 0) ? fib.levels.map(l => l.price) : [];
    const supC = [], resC = [];
    const addSR = (v) => { if (v == null || !isFinite(v)) return; if (v < price) supC.push(v); else if (v > price) resC.push(v); };
    [vpD && vpD.val, vpD && vpD.vah, vpD && vpD.poc, bU, bL, s50, s200, ...fibPrices].forEach(addSR);
    // Vadeye göre ULAŞIM (reach): sadece bant genişliği değil, ÇAPA da vadeyle uzaklaşır.
    // Kısa vade en yakın destek/dirençte kalır; vade uzadıkça hedef gerçekten açılır —
    // 1-3 yıllık bir alımda "hedef" yakın dirence sıkışmasın. Satım/hedef tarafı güçlü,
    // alım tarafı daha mütevazı derinleşir (makul bir geri çekilmede biriktirme).
    const rATR = atr != null ? atr : price * 0.02;
    const buyReach  = { gunici: 0.8, kisa: 1.2, orta: 2, uzun: 3  }[vadeKey] || 1.2;
    const sellReach = { gunici: 1.5, kisa: 3,   orta: 7, uzun: 12 }[vadeKey] || 3;
    const wantSup = price - buyReach * rATR;
    const wantRes = price + sellReach * rATR;
    // istenen mesafeyi karşılayan en yakın GERÇEK seviyeye tuttur; yoksa en uzak aday; yoksa ATR projeksiyonu
    const supFar = supC.filter(v => v <= wantSup);
    const resFar = resC.filter(v => v >= wantRes);
    // Uzak taraf: hedef mesafesini karşılayan en yakın gerçek seviyeyi al. Yoksa, mevcut
    // seviyeler ufka yetmiyor demektir → daha yakın bir tavana SIKIŞMA, ATR ile ufka projekte et
    // (kısa vade yine gerçek dirence oturur; orta/uzun vade gerçekten uzaklaşır).
    const furthestRes = resC.length ? Math.max(...resC) : -Infinity;
    const deepestSup  = supC.length ? Math.min(...supC) :  Infinity;
    const supAnchor = supFar.length ? Math.max(...supFar) : Math.min(wantSup, deepestSup);
    const resAnchor = resFar.length ? Math.min(...resFar) : Math.max(wantRes, furthestRes);
    const zMult = { gunici: 0.5, kisa: 0.75, orta: 1.1, uzun: 1.5 }[vadeKey] || 1.0;
    const hw = atr != null ? atr * zMult : price * 0.01;
    const buyZone  = [supAnchor - hw, Math.min(supAnchor + hw, price)];
    const sellZone = [Math.max(resAnchor - hw, price), resAnchor + hw];
    const longHorizon = vadeKey === 'orta' || vadeKey === 'uzun';

    // ===== Alım çapasının NİTELİĞİ (yalnızca sunum; hiçbir değeri değiştirmez) =====
    // Bant sürekli "kaçıyor" mu, yoksa gerçek bir seviyeye mi tutunuyor? Kullanıcıya
    // çapanın kaynağını ve ne kadar "sabit" olduğunu göster. sabit = kalıcı yapısal seviye
    // (VP değer alanı/POC, SMA200, Fibonacci); kaygan = oynaklığa göре kayan (Bollinger,
    // SMA50); projeksiyon = gerçek seviye yok, saf ATR izdüşümü (fiyatla birlikte geriler).
    let anchorKind = 'projeksiyon', anchorSrc = 'ATR izdüşümü';
    if (supFar.length) {
      const srcCand = [
        [vpD && vpD.val, 'VP değer tabanı', 'sabit'],
        [vpD && vpD.vah, 'VP değer tavanı', 'sabit'],
        [vpD && vpD.poc, 'VP POC (hacim yığılması)', 'sabit'],
        [s200, 'SMA200 (ana trend)', 'sabit'],
        [s50, 'SMA50', 'kaygan'],
        [bU, 'Bollinger üst', 'kaygan'],
        [bL, 'Bollinger alt', 'kaygan'],
      ];
      fibPrices.forEach((p) => srcCand.push([p, 'Fibonacci', 'sabit']));
      let best = null, bestD = Infinity;
      srcCand.forEach(([v, lab, kind]) => {
        if (v == null || !isFinite(v)) return;
        const d = Math.abs(v - supAnchor);
        if (d < bestD) { bestD = d; best = [lab, kind]; }
      });
      if (best && bestD <= (rATR * 0.02 + 1e-6)) { anchorSrc = best[0]; anchorKind = best[1]; }
      else { anchorKind = 'kaygan'; anchorSrc = 'yakın destek'; }
    }

    const regime = regimeByTf[cfg.adxTf] || regimeByTf[cfg.blend[0].tf] || 'neutral';
    return { score, raw, label, cls, breakdown, adxVal, adxF, cfg, regime,
             levels: { price, target, stop, rr, poc: vpD ? vpD.poc : null, atr, buyZone, sellZone, zMult, sellKind: longHorizon ? 'target' : 'sell', sma50: s50, sma200: s200, anchorKind, anchorSrc } };
  }

  // ===== Yahoo Finance (temettü/dağıtım) — BIST + US =====
  // SADECE içinde bulunduğumuz yılın temettüleri.
  // Yahoo'nun events=div endpoint'i açıklanmış ileri tarihli temettüleri de içeriyor,
  // dolayısıyla "bu yıl ödenmek üzere açıklanmış" durumlar yakalanıyor.
  // Her sayfa açılışında proxy/cache bypass için ts query eklenir.
  async function fetchYahooDividends(symbol, market = 'US') {
    const ysym = market === 'BIST' ? symbol + '.IS' : symbol;
    const year = new Date().getFullYear();
    const yearStart = Math.floor(new Date(year, 0, 1).getTime() / 1000);
    const yearEnd   = Math.floor(new Date(year + 1, 0, 1).getTime() / 1000);
    // Yahoo bazen ileri tarihli açıklamayı sadece geniş aralıkla döner — biraz öncesinden başla
    const p1 = yearStart - 30 * 24 * 3600;
    const p2 = yearEnd   + 30 * 24 * 3600;
    // Sayfa yenilemede taze veri için ts ekle (proxy cache bypass)
    const ts = Math.floor(Date.now() / (5 * 60 * 1000)); // 5 dk bucket
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?period1=${p1}&period2=${p2}&interval=1d&events=div&_t=${ts}`;
    try {
      const res = await fetch(proxy(url));
      if (!res.ok) throw new Error('yahoo ' + res.status);
      const json = await res.json();
      const events = json.chart?.result?.[0]?.events?.dividends || {};
      const meta = json.chart?.result?.[0]?.meta;
      const currency = meta?.currency || (market === 'BIST' ? 'TRY' : 'USD');
      setDiag('yahoo', true, 'Yahoo');
      const all = Object.values(events).map(d => ({
        date:   new Date(d.date * 1000),
        amount: d.amount,
        symbol,
        currency,
        market,
      }));
      // SADECE bu yıl içindekiler
      const thisYear = all.filter(d => d.date.getFullYear() === year);
      return thisYear.sort((a, b) => b.date - a.date);
    } catch (e) {
      setDiag('yahoo', false, 'Yahoo');
      return [];
    }
  }

  // ===== Portföy sekmesi =====
  function googleNewsUrl(query, market) {
    const lang = market === 'US' ? 'en' : 'tr';
    const gl   = market === 'US' ? 'US' : 'TR';
    const ceid = market === 'US' ? 'US:en' : 'TR:tr';
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${lang}&gl=${gl}&ceid=${ceid}`;
  }

  // Haber listesini render eden ortak helper
  function renderNewsList(el, items, opts = {}) {
    if (!items || !items.length) {
      el.innerHTML = `<li class="empty">${opts.empty || 'Haber bulunamadı.'}</li>`;
      return;
    }
    el.innerHTML = items.slice(0, opts.max || 5).map(n => `
      <li class="news-item${opts.kap ? ' kap' : ''}">
        <a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
        <div class="meta">${n.author || ''} · ${fmtTime(n.pubDate)}${opts.altSrc ? ' <em>(alt. kaynak)</em>' : ''}</div>
      </li>
    `).join('');
  }

  // Bir portföy item'ı için kart oluştur, lazy doldur
  // ===== Kullanıcının eklediği portföy kalemleri =====
  // config.js'teki PORTFOLIO = sabit tohum. Kullanıcının eklediği hisse/ETF'ler
  // localStorage'da tutulur; getPortfolio() ikisini birleştirir. Portföy grid'i,
  // haberler, takvim ve teknik/temel analiz seçicileri hep getPortfolio() üzerinden
  // beslendiği için eklenen sembol tüm hizmetlerde otomatik görünür.
  const PF_LS_KEY = 'sb:userPortfolio';
  const PF_HIDE_KEY = 'sb:hiddenPortfolio'; // kullanıcının kaldırdığı VARSAYILAN (config) semboller

  function loadUserPortfolio() {
    try { const raw = localStorage.getItem(PF_LS_KEY); if (raw) return JSON.parse(raw); } catch (_) {}
    return [];
  }
  function saveUserPortfolio(list) {
    try { localStorage.setItem(PF_LS_KEY, JSON.stringify(list)); } catch (_) {}
    scheduleWatchlistSync();
  }
  function loadHiddenPortfolio() {
    try { const raw = localStorage.getItem(PF_HIDE_KEY); if (raw) return JSON.parse(raw); } catch (_) {}
    return [];
  }
  function saveHiddenPortfolio(list) {
    try { localStorage.setItem(PF_HIDE_KEY, JSON.stringify(list)); } catch (_) {}
    scheduleWatchlistSync();
  }
  // İzleme evreni ARTIK yalnızca "listeler"den türer. Kullanıcı Portföy sekmesini
  // kaldırdı; ilerleme sadece listeler üzerinden. Her listede "evrene dahil et"
  // kutucuğu var (inUniverse !== false ⇒ dahil). getPortfolio() geriye dönük uyum
  // için korunur (birçok çağıran kullanıyor) ama artık evren = dahil edilen listeler.
  function getPortfolio() {
    const map = new Map();
    try {
      loadLists().forEach((l) => {
        if (l.inUniverse === false) return; // "evrene dahil etme" seçili değilse atla
        (l.items || []).forEach((i) => {
          const k = i.market + ':' + i.symbol;
          if (!map.has(k)) map.set(k, { symbol: i.symbol, market: i.market, query: i.query || i.symbol, name: i.name || i.query || i.symbol });
        });
      });
    } catch (_) {}
    return [...map.values()];
  }
  // Listelerden türeyen izleme evreni ({symbol, market}, tekilleştirilmiş).
  // D3: bir bilanço bu evrendeki bir hisseye aitse "Bugün"de öne çıkarılır. Bilgi amaçlıdır.
  function watchedSymbols() {
    const map = new Map();
    try {
      getPortfolio().forEach((p) => {
        const k = p.market + ':' + p.symbol;
        if (!map.has(k)) map.set(k, { symbol: p.symbol, market: p.market });
      });
    } catch (_) {}
    return [...map.values()];
  }
  function addPortfolioSymbol(symbol, market, name) {
    symbol = (symbol || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(symbol)) return { ok: false, err: 'Geçersiz hisse/ETF kodu.' };
    if (getPortfolio().some(x => x.symbol === symbol && x.market === market)) {
      return { ok: false, err: 'Bu sembol zaten portföyde.' };
    }
    // Daha önce gizlenmiş bir varsayılan sembolse: gizlemeyi kaldır (geri getir).
    const hidden = loadHiddenPortfolio();
    const wasHidden = hidden.some(h => h.symbol === symbol && h.market === market);
    if (wasHidden) {
      saveHiddenPortfolio(hidden.filter(h => !(h.symbol === symbol && h.market === market)));
    }
    // Varsayılan listede zaten var (ve gizlemesini az önce kaldırdıysak) tekrar user'a ekleme.
    const isSeed = (window.PORTFOLIO || []).some(p => p.symbol === symbol && p.market === market);
    if (isSeed && wasHidden) return { ok: true };

    const q = (name || '').trim();
    const list = loadUserPortfolio();
    list.push({ symbol, market, query: q ? `${symbol} ${q}` : symbol });
    saveUserPortfolio(list);
    return { ok: true };
  }
  function removePortfolioSymbol(symbol, market) {
    // Kullanıcı eklediyse listeden çıkar; varsayılan (config) sembolse gizlenenlere ekle.
    const before = loadUserPortfolio();
    const after = before.filter(x => !(x.symbol === symbol && x.market === market));
    if (after.length !== before.length) { saveUserPortfolio(after); return; }
    const isSeed = (window.PORTFOLIO || []).some(p => p.symbol === symbol && p.market === market);
    if (isSeed) {
      const hidden = loadHiddenPortfolio();
      if (!hidden.some(h => h.symbol === symbol && h.market === market)) {
        hidden.push({ symbol, market });
        saveHiddenPortfolio(hidden);
      }
    }
  }
  // Portföy değişince bağımlı her şeyi tazele: grid + analiz seçicileri + haber cache
  function onPortfolioChanged(market) {
    const pf = market === 'BIST' ? 'TR' : 'US';
    builtGrids[pf] = false;
    renderPortfolio(pf);
    refreshSymbolSelectors();   // teknik + temel analiz seçicileri yeniden kurulsun
    newsCache = [];             // haber sekmesi yeni sembolle yeniden yüklensin
  }

  // Portföy kartı: haber yerine fiyat + seçili dönem değişimi + mini grafik.
  // Tıklayınca hisse sayfasını açar. (Haberler artık "Hisse Gelişmeleri" sekmesinde.)
  let pfPeriod = 'gunluk';
  function buildPortfolioCard(item, grid) {
    const card = document.createElement('div');
    card.className = 'card pf-card';
    card.dataset.symbol = item.symbol;
    card.dataset.market = item.market;
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove]')) return;
      openStockPage(item.symbol, item.market, item.query);
    });
    card.innerHTML = `
      <div class="pf-card-top">
        <span class="pf-sym">${item.symbol} <span class="badge">${item.market}</span></span>
        <button class="card-remove" title="Portföyden çıkar" data-remove aria-label="Portföyden çıkar">×</button>
      </div>
      <div class="pf-card-price"><span class="pf-price" data-role="price">…</span></div>
      <div class="pf-card-chg" data-role="chg"></div>
      <div class="pf-spark" data-role="spark"></div>`;
    grid.appendChild(card);

    const rmBtn = card.querySelector('[data-remove]');
    if (rmBtn) rmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removePortfolioSymbol(item.symbol, item.market);
      onPortfolioChanged(item.market);
    });

    // Fiyat = canlı kotasyon; mini grafik 5y günlük seriden (skorlama önbelleğiyle paylaşımlı)
    getQuote(item.symbol, item.market).then((q) => {
      const priceEl = card.querySelector('[data-role="price"]');
      if (priceEl) priceEl.textContent = fmtPrice(q ? q.price : null, item.market);
    }).catch(() => {});
    getDailyCandlesCached(item.symbol, item.market).then((candles) => {
      const sparkEl = card.querySelector('[data-role="spark"]');
      if (sparkEl && candles && candles.length) sparkEl.innerHTML = makeSparkline(candles.slice(-60).map((c) => ({ t: c.time * 1000, c: c.close })), 320, 44);
    }).catch(() => {});

    updateOneCardChange(card, pfPeriod);
  }

  // Bir kartın seçili-dönem değişim hücresini doldur
  function updateOneCardChange(card, period) {
    const symbol = card.dataset.symbol, market = card.dataset.market;
    const cell = card.querySelector('[data-role="chg"]'); if (!cell) return;
    const pObj = CHANGE_PERIODS.find((x) => x.key === period) || CHANGE_PERIODS[1];
    cell.innerHTML = `<span class="pf-chg-l">${pObj.label} değişim</span><b class="pf-chg-v">…</b>`;
    changeFor(symbol, market, period).then((r) => {
      const v = r ? r.pct : null;
      const vEl = cell.querySelector('.pf-chg-v'); if (!vEl) return;
      vEl.textContent = (r && r.delayed && v == null) ? 'gecikmeli' : fmtPct(v);
      vEl.className = 'pf-chg-v ' + pctCls(v);
    }).catch(() => {});
  }

  function updateGridChanges(gridId, period) {
    const grid = document.getElementById(gridId); if (!grid) return;
    grid.querySelectorAll('.pf-card[data-symbol]').forEach((card) => updateOneCardChange(card, period));
  }

  // Portföy dönem seçici (Değişim: Saatlik/Günlük/…)
  function renderPfChangeBar() {
    const bar = document.getElementById('pfChangeBar'); if (!bar) return;
    const activePf = document.querySelector('.chip[data-pf].active')?.dataset.pf;
    bar.hidden = !(activePf === 'TR' || activePf === 'US');
    if (bar.hidden) return;
    bar.innerHTML = `<span class="pf-cb-l">Değişim:</span>` + CHANGE_PERIODS.map((p) =>
      `<button class="pf-cb-btn ${p.key === pfPeriod ? 'active' : ''}" data-period="${p.key}">${p.label}</button>`).join('');
    bar.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => {
      pfPeriod = b.dataset.period;
      renderPfChangeBar();
      ['TR', 'US'].forEach((t) => updateGridChanges('portfolioGrid' + t, pfPeriod));
    }));
  }

  // Hangi grid'lerin render edildiğini takip et (tekrar render etmemek için)
  const builtGrids = { TR: false, US: false, METALS: false };

  async function renderPortfolio(only) {
    // only: 'TR' | 'US' | undefined (sadece aktif olanı)
    const target = only || 'TR';
    renderPfChangeBar();
    if (builtGrids[target]) return; // zaten kurulu
    const gridId = 'portfolioGrid' + target;
    const grid = document.getElementById(gridId);
    if (!grid) return; // Portföy sekmesi kaldırıldı → güvenli no-op
    grid.innerHTML = '';
    const filterMarket = target === 'TR' ? 'BIST' : 'US';
    const items = getPortfolio().filter(item => item.market === filterMarket);
    if (!items.length) {
      grid.innerHTML = `<div class="empty">${target === 'TR' ? 'BIST' : 'ABD'} portföyün boş. Yukarıdaki kutudan hisse/ETF ekle.</div>`;
    } else {
      for (const item of items) buildPortfolioCard(item, grid);
    }
    builtGrids[target] = true;
  }

  // ===== Ortak yardımcılar: değişim motoru + listeler =====
  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Çok-dönemli % değişim. GÜNCEL değer = canlı fiyat (regularMarketPrice); referans =
  // dönem başındaki kapanış. Günlük = canlı fiyat vs bir önceki seans kapanışı (range=1d
  // chartPreviousClose — Yahoo'nun bu değeri yalnız range=1d'de "dün"dür; daha geniş
  // aralıklarda aralık-öncesi kapanıştır, bu yüzden ayrı çekilir). Haftalık+ = canlı fiyat
  // vs ~N takvim günü önceki günlük kapanış (5y seriden). Böylece Midas gibi CANLI değişir.
  const CHANGE_PERIODS = [
    { key: 'saatlik',  label: 'Saatlik',  intraday: true },
    { key: 'gunluk',   label: 'Günlük',   days: 1 },
    { key: 'haftalik', label: 'Haftalık', days: 7 },
    { key: 'aylik',    label: 'Aylık',    days: 30 },
    { key: 'alti',     label: '6 Aylık',  days: 182 },
    { key: 'yillik',   label: '1 Yıllık', days: 365 },
  ];

  async function getDailyCandlesCached(symbol, market) {
    const ck = market + ':' + symbol;
    if (vadeCache[ck]) return vadeCache[ck];
    const d = await fetchYahooOHLC(symbol, market, '5y', '1d');
    vadeCache[ck] = d.candles;
    return d.candles;
  }

  // Canlı kotasyon (fiyat + bir önceki seans kapanışı). range=1d → chartPreviousClose = dünkü kapanış.
  const quoteCache = {}; // ck -> { price, prevClose, currency, marketTime, ts }
  async function getQuote(symbol, market) {
    const ck = market + ':' + symbol;
    const c = quoteCache[ck];
    if (c && Date.now() - c.ts < 90000) return c;
    const ch = await fetchYahooChart(symbol, market, '1d', '1d');
    const out = ch
      ? { price: ch.price, prevClose: ch.prevClose, currency: ch.currency, marketTime: ch.marketTime, ts: Date.now() }
      : { price: null, prevClose: null, ts: Date.now() };
    quoteCache[ck] = out;
    return out;
  }

  // Bir sembol + dönem için CANLI % değişim
  async function changeFor(symbol, market, periodKey) {
    const p = CHANGE_PERIODS.find((x) => x.key === periodKey) || CHANGE_PERIODS[1];
    if (p.intraday) {
      const [intr, q] = await Promise.all([fetchIntradaySeries(symbol, market), getQuote(symbol, market)]);
      const h1 = intr && intr.H1;
      if (!h1 || h1.length < 2) return { pct: null, delayed: market === 'BIST' };
      const ref = h1[h1.length - 2].close; // ~1 saat önce
      const cur = (q && q.price != null) ? q.price : h1[h1.length - 1].close;
      if (!ref || cur == null) return { pct: null, delayed: market === 'BIST' };
      return { pct: (cur - ref) / ref * 100, ref, cur, delayed: market === 'BIST' };
    }
    const q = await getQuote(symbol, market);
    const price = q ? q.price : null;
    if (price == null) return { pct: null };
    if (p.days <= 1) {
      if (q.prevClose == null) return { pct: null };
      return { pct: (price - q.prevClose) / q.prevClose * 100, ref: q.prevClose, cur: price };
    }
    const candles = await getDailyCandlesCached(symbol, market);
    if (!candles || !candles.length) return { pct: null };
    const nowSec = (q.marketTime ? q.marketTime / 1000 : candles[candles.length - 1].time);
    const cutoff = nowSec - p.days * 86400;
    let ref = null;
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].time <= cutoff && candles[i].close != null) { ref = candles[i]; break; }
    }
    if (!ref) ref = candles.find((c) => c.close != null);
    if (!ref || !ref.close) return { pct: null };
    return { pct: (price - ref.close) / ref.close * 100, ref: ref.close, cur: price };
  }

  const fmtPct = (n) => (n == null || isNaN(n)) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  const pctCls = (n) => n == null ? 'flat' : n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
  const curSymOf = (market) => market === 'BIST' ? '₺' : '$';
  const fmtPrice = (n, market) => n == null ? '—' : curSymOf(market) + n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });

  // ===== Listeler (kullanıcı tanımlı) =====
  // Yerelde tutulur. İlk açılışta config'teki başlangıç sembollerinden "deneme" listesi tohumlanır.
  const LISTS_LS_KEY = 'sb:lists';
  function loadLists() {
    try {
      const raw = localStorage.getItem(LISTS_LS_KEY);
      if (raw) { const l = JSON.parse(raw); if (Array.isArray(l)) return l; }
    } catch (_) {}
    const seedItems = (window.WATCHLIST || []).map((x) => ({ symbol: x.symbol, market: x.market, query: x.query || x.symbol }));
    const seed = [{ id: 'deneme', name: 'deneme', items: seedItems }];
    try { localStorage.setItem(LISTS_LS_KEY, JSON.stringify(seed)); } catch (_) {}
    return seed;
  }
  function saveLists(lists) { try { localStorage.setItem(LISTS_LS_KEY, JSON.stringify(lists)); } catch (_) {} scheduleWatchlistSync(); }
  function createList(name) {
    const lists = loadLists();
    const nm = (name || '').trim() || 'Liste ' + (lists.length + 1);
    const id = 'l' + Date.now().toString(36);
    lists.push({ id, name: nm, items: [], inUniverse: true, notify: true });
    saveLists(lists);
    return id;
  }
  function renameList(id, name) {
    const lists = loadLists();
    const l = lists.find((x) => x.id === id); if (!l) return;
    l.name = (name || '').trim() || l.name; saveLists(lists);
  }
  function deleteList(id) { saveLists(loadLists().filter((x) => x.id !== id)); }
  function listAddSymbol(id, symbol, market, query) {
    const lists = loadLists();
    const l = lists.find((x) => x.id === id); if (!l) return { ok: false, err: 'Liste yok.' };
    symbol = (symbol || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return { ok: false, err: 'Geçersiz kod.' };
    if (l.items.some((i) => i.symbol === symbol && i.market === market)) return { ok: false, err: 'Zaten listede.' };
    l.items.push({ symbol, market, query: query || symbol }); saveLists(lists);
    return { ok: true };
  }
  function listRemoveSymbol(id, symbol, market) {
    const lists = loadLists();
    const l = lists.find((x) => x.id === id); if (!l) return;
    l.items = l.items.filter((i) => !(i.symbol === symbol && i.market === market)); saveLists(lists);
  }
  // Listenin "evrene dahil" durumu — evren (Fırsatlar/Radar/Bugün/TA-FA seçici vb.) bundan türer.
  function setListUniverse(id, v) {
    const lists = loadLists();
    const l = lists.find((x) => x.id === id); if (!l) return;
    l.inUniverse = !!v; saveLists(lists);
  }
  // Listenin "bildirim" durumu — telefon push evreni (collectWatchlistPayload) bundan türer.
  function setListNotify(id, v) {
    const lists = loadLists();
    const l = lists.find((x) => x.id === id); if (!l) return;
    l.notify = !!v; saveLists(lists);
  }

  // Tek seferlik tohum: "🤖 Robot" araştırma listesi — insansı robot tedarik zinciri sepeti
  // (maden/enerji/aktüatör/çip/AI/sensör). Hepsi ABD-işlem gören kod veya ADR karşılığı.
  // Bir kez eklenir; kullanıcı silerse geri gelmez (sb:seeded:robot bayrağı). Bilgi amaçlı,
  // yatırım tavsiyesi değildir.
  function seedRobotList() {
    try {
      if (localStorage.getItem('sb:seeded:robot') === '1') return;
      const items = [
        { symbol: 'NVDA',  market: 'US', query: 'NVDA Nvidia' },            // çip + robot AI (Isaac/GR00T)
        { symbol: 'TSLA',  market: 'US', query: 'TSLA Tesla' },             // sistem + Optimus + FSD
        { symbol: 'TSM',   market: 'US', query: 'TSM TSMC' },               // döküm (foundry) tekeli
        { symbol: 'MP',    market: 'US', query: 'MP Materials' },           // nadir toprak + mıknatıs
        { symbol: 'SONY',  market: 'US', query: 'SONY Sony' },              // görüntü sensörü (göz)
        { symbol: 'STM',   market: 'US', query: 'STM STMicroelectronics' }, // MEMS/IMU + motor sürücü
        { symbol: 'TTDKY', market: 'US', query: 'TTDKY TDK' },              // mıknatıs + IMU (ADR)
        { symbol: 'YASKY', market: 'US', query: 'YASKY Yaskawa' },          // servo motor / hareket (ADR)
        { symbol: 'HSYDF', market: 'US', query: 'HSYDF Harmonic Drive' },   // dalga dişli — eklem (ADR)
        { symbol: 'NJDCY', market: 'US', query: 'NJDCY Nidec' },            // hassas motor / aktüatör (ADR)
        { symbol: 'SHECY', market: 'US', query: 'SHECY Shin-Etsu' },        // NdFeB mıknatıs + wafer (ADR)
        { symbol: 'HSAI',  market: 'US', query: 'HSAI Hesai' },             // LiDAR — mekânsal algı
      ];
      const lists = loadLists();
      if (!lists.some((l) => l.name === '🤖 Robot')) {
        lists.push({ id: 'robot' + Date.now().toString(36), name: '🤖 Robot', items });
        saveLists(lists);
      }
      localStorage.setItem('sb:seeded:robot', '1');
    } catch (_) {}
  }
  seedRobotList();

  // Tek seferlik tohum: "🇺🇸 Amerika V1" — AI-altyapı + uzun vade teknoloji + yüksek
  // risk/getiri sepeti (bellek/çip · enerji · otomasyon · nadir toprak · genomik).
  // Bir kez eklenir; silinirse geri gelmez (sb:seeded:amerikav1). Yatırım tavsiyesi değildir.
  function seedAmericaV1List() {
    try {
      if (localStorage.getItem('sb:seeded:amerikav1') === '1') return;
      const items = [
        { symbol: 'SKHY', market: 'US', query: 'SKHY SK hynix' },      // HBM bellek — AI çip üstü
        { symbol: 'MRVL', market: 'US', query: 'MRVL Marvell' },        // özel AI ASIC + ara-bağlantı
        { symbol: 'GEV',  market: 'US', query: 'GEV GE Vernova' },      // AI veri-merkezi enerjisi/şebeke
        { symbol: 'ZBRA', market: 'US', query: 'ZBRA Zebra Tech' },     // makine görüşü / RFID — fiziksel AI
        { symbol: 'REMX', market: 'US', query: 'REMX Rare Earth ETF' }, // nadir toprak / mıknatıs tedarik
        { symbol: 'ARKG', market: 'US', query: 'ARKG ARK Genomic ETF' },// genomik / AI-biyo (tematik)
        { symbol: 'ROBO', market: 'US', query: 'ROBO Robotics ETF' },   // robotik & otomasyon ETF
      ];
      const lists = loadLists();
      if (!lists.some((l) => l.name === '🇺🇸 Amerika V1')) {
        lists.push({ id: 'amerikav1' + Date.now().toString(36), name: '🇺🇸 Amerika V1', items });
        saveLists(lists);
      }
      localStorage.setItem('sb:seeded:amerikav1', '1');
    } catch (_) {}
  }
  seedAmericaV1List();

  // ---- Bildirim senkronizasyonu (portföy + listeler → KV) ----
  // App'teki güncel portföy + tüm liste sembollerini `/api/watchlist`'e POST eder;
  // telefon bildirim worker'ı (poll.mjs/movers.mjs) aynı koddan okur → ekleme/çıkarma
  // yaptığında telefona gelen bildirimler de güncellenir. Kod public JS'te (kişisel
  // uygulama, watchlist hassas veri değil). Endpoint yoksa (KV kurulmadıysa) sessiz geçer.
  const SYNC_CODE = 'atahan-bulten-9f3c';
  const SYNC_BASE = (window.MY_PROXY || '').replace(/\/api\/proxy.*$/, '') || '';
  let _syncTimer = null;
  function collectWatchlistPayload() {
    // Bildirim evreni ARTIK yalnızca "bildirim" düğmesi açık listelerden türer
    // (notify !== false). Portföy kavramı kaldırıldı → portfolio: [].
    const seen = new Set();
    const list = [];
    loadLists().forEach((l) => {
      if (l.notify === false) return; // bu liste için bildirim istenmiyor
      (l.items || []).forEach((it) => {
        const k = it.market + ':' + it.symbol;
        if (seen.has(k)) return; seen.add(k);
        list.push({ symbol: it.symbol, market: it.market, query: it.query || it.symbol });
      });
    });
    return { portfolio: [], list };
  }
  function pushWatchlistSync() {
    if (!SYNC_BASE) return;
    try {
      fetch(`${SYNC_BASE}/api/watchlist?code=${encodeURIComponent(SYNC_CODE)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectWatchlistPayload()),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }
  function scheduleWatchlistSync() {
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(pushWatchlistSync, 1200);
  }
  // Açılışta bir kez gönder (kullanıcı hiç değişiklik yapmasa da worker güncel kalsın).
  setTimeout(pushWatchlistSync, 3000);

  // Son aranan semboller (Arama sekmesi)
  const RECENT_LS_KEY = 'sb:recentSearch';
  function loadRecentSearches() {
    try { const r = JSON.parse(localStorage.getItem(RECENT_LS_KEY)); if (Array.isArray(r)) return r; } catch (_) {}
    return [];
  }
  function rememberSearch(symbol, market) {
    let r = loadRecentSearches().filter((x) => !(x.symbol === symbol && x.market === market));
    r.unshift({ symbol, market });
    r = r.slice(0, 12);
    try { localStorage.setItem(RECENT_LS_KEY, JSON.stringify(r)); } catch (_) {}
  }

  // ===== Madenler =====
  async function renderMetals() {
    const grid = document.getElementById('portfolioGridMETALS');
    grid.innerHTML = '';

    for (const metal of window.METALS) {
      const price = truncgilCache ? truncgilGet(truncgilCache, metal.truncgilKey) : null;
      const priceTxt = price ? fmtTRY(price) + ' / gram' : 'N/A';

      const card = document.createElement('div');
      card.className = 'card no-click';
      card.innerHTML = `
        <h3>
          <span>${metal.name}</span>
          <span class="badge">${priceTxt}</span>
        </h3>
        <div class="crx-row"><button class="crx-detail" data-metal="${metal.truncgilKey}">Detay →</button></div>
        <div class="sub-title"><span class="dot"></span> Türkiye</div>
        <ul class="news-list" data-role="tr"><li class="loading">Yükleniyor…</li></ul>
        <div class="sub-title"><span class="dot"></span> Dünya</div>
        <ul class="news-list" data-role="world"><li class="loading">Yükleniyor…</li></ul>
      `;
      grid.appendChild(card);

      const dBtn = card.querySelector('.crx-detail[data-metal]');
      if (dBtn) dBtn.addEventListener('click', () => openMetalPage(metal.truncgilKey, metal.name));

      const fillList = (sel, items) => {
        const el = card.querySelector(sel);
        if (!items.length) {
          el.innerHTML = '<li class="empty">Haber yok.</li>';
          return;
        }
        el.innerHTML = items.map(n => `
          <li class="news-item">
            <a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
            <div class="meta">${n.author || ''} · ${fmtTime(n.pubDate)}</div>
          </li>
        `).join('');
      };

      fetchRSS(googleNewsUrl(metal.queryTR, 'BIST'), 4)
        .then(items => fillList('[data-role="tr"]', items))
        .catch(err => {
          card.querySelector('[data-role="tr"]').innerHTML =
            `<li class="error">Yüklenemedi: ${err.message}</li>`;
        });

      fetchRSS(googleNewsUrl(metal.queryWORLD, 'US'), 4)
        .then(items => fillList('[data-role="world"]', items))
        .catch(err => {
          card.querySelector('[data-role="world"]').innerHTML =
            `<li class="error">Yüklenemedi: ${err.message}</li>`;
        });
    }
  }

  // ===== Sepet (Basket): maden · döviz · kripto · hisse, miktarlı =====
  const BASKET_LS = 'sb:basket';
  const BASKET_HIST_LS = 'sb:basket:history';
  const BASKET_MOVES_LS = 'sb:basket:moves';

  // Zaman pencereleri (günlük snapshot geçmişine göre % değişim)
  const BASKET_WINDOWS = [
    { k: '24s',  days: 1,    label: '24s'   },
    { k: '1H',   days: 7,    label: '1H'    },
    { k: '1A',   days: 30,   label: '1A'    },
    { k: '3A',   days: 90,   label: '3A'    },
    { k: '6A',   days: 180,  label: '6A'    },
    { k: '1Y',   days: 365,  label: '1Y'    },
    { k: 'BASL', days: null, label: 'Başl.' },
  ];

  // ===== Sepet hamle günlüğü (ekleme/çıkarma/al-sat + gerçekleşen K/Z) =====
  function loadMoves() { try { return JSON.parse(localStorage.getItem(BASKET_MOVES_LS)) || []; } catch (e) { return []; } }
  function saveMoves(arr) { try { localStorage.setItem(BASKET_MOVES_LS, JSON.stringify(arr)); } catch (e) {} }
  function logMove(rec) {
    const arr = loadMoves();
    arr.push(Object.assign({ id: 'm' + Date.now() + Math.random().toString(36).slice(2, 5), ts: new Date().toISOString() }, rec));
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    saveMoves(arr);
  }

  const BASKET_CLASSES = {
    fx:     { label: 'Döviz',      color: '#38bdf8', emoji: '💱' },
    us:     { label: 'ABD Hisse',  color: '#22d39a', emoji: '🇺🇸' },
    bist:   { label: 'BIST Hisse', color: '#fbbf24', emoji: '🇹🇷' },
    crypto: { label: 'Kripto',     color: '#c084fc', emoji: '🪙' },
    metal:  { label: 'Maden',      color: '#f59e0b', emoji: '🥇' },
    fund:   { label: 'Fon',        color: '#f472b6', emoji: '🧺' },
    cash:   { label: 'Nakit',      color: '#94a3b8', emoji: '💵' },
  };

  const BM_METALS = [
    { key: 'gram-altin',        name: 'Gram Altın',        unit: 'gram', emoji: '🥇' },
    { key: 'ceyrek-altin',      name: 'Çeyrek Altın',      unit: 'adet', emoji: '🥇' },
    { key: 'yarim-altin',       name: 'Yarım Altın',       unit: 'adet', emoji: '🥇' },
    { key: 'tam-altin',         name: 'Tam Altın',         unit: 'adet', emoji: '🥇' },
    { key: 'cumhuriyet-altini', name: 'Cumhuriyet Altını', unit: 'adet', emoji: '🥇' },
    { key: 'gumus',             name: 'Gümüş',             unit: 'gram', emoji: '🥈' },
  ];
  const BM_FX = [
    { key: 'USD', name: 'Dolar (USD)',            emoji: '💵' },
    { key: 'EUR', name: 'Euro (EUR)',             emoji: '💶' },
    { key: 'GBP', name: 'Sterlin (GBP)',          emoji: '💷' },
    { key: 'CHF', name: 'İsviçre Frangı (CHF)',   emoji: '💱' },
    { key: 'JPY', name: 'Japon Yeni (JPY)',       emoji: '💴' },
    { key: 'AUD', name: 'Avustralya Doları (AUD)',emoji: '💱' },
    { key: 'CAD', name: 'Kanada Doları (CAD)',    emoji: '💱' },
    { key: 'SAR', name: 'Suudi Riyali (SAR)',     emoji: '💱' },
  ];
  const BM_CRYPTO = [
    { id: 'bitcoin',      sym: 'BTC',  name: 'Bitcoin' },
    { id: 'ethereum',     sym: 'ETH',  name: 'Ethereum' },
    { id: 'binancecoin',  sym: 'BNB',  name: 'BNB' },
    { id: 'solana',       sym: 'SOL',  name: 'Solana' },
    { id: 'ripple',       sym: 'XRP',  name: 'XRP' },
    { id: 'cardano',      sym: 'ADA',  name: 'Cardano' },
    { id: 'dogecoin',     sym: 'DOGE', name: 'Dogecoin' },
    { id: 'avalanche-2',  sym: 'AVAX', name: 'Avalanche' },
    { id: 'tron',         sym: 'TRX',  name: 'Tron' },
    { id: 'polkadot',     sym: 'DOT',  name: 'Polkadot' },
  ];

  function loadBasket() { try { return JSON.parse(localStorage.getItem(BASKET_LS)) || []; } catch (e) { return []; } }
  function saveBasket(arr) { try { localStorage.setItem(BASKET_LS, JSON.stringify(arr)); } catch (e) {} }
  function usdTry() { return (truncgilCache && truncgilGet(truncgilCache, 'USD')) || null; }
  function toTRY(v, cur) {
    if (v == null || !isFinite(v)) return null;
    if (cur === 'TRY') return v;
    const u = usdTry();
    return u ? v * u : null;
  }

  // CoinGecko toplu fiyat (USD) — cache'li
  let cryptoPxCache = { ts: 0, map: {} };
  async function cryptoPrices(ids) {
    const now = Date.now();
    const missing = ids.some((id) => !(id in cryptoPxCache.map));
    if (missing || now - cryptoPxCache.ts > 90000) {
      const all = Array.from(new Set(ids.concat(Object.keys(cryptoPxCache.map))));
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(all.join(',')) + '&vs_currencies=usd');
        const j = await r.json();
        Object.keys(j).forEach((id) => { if (j[id] && j[id].usd != null) cryptoPxCache.map[id] = j[id].usd; });
        cryptoPxCache.ts = now;
      } catch (e) {}
    }
    return cryptoPxCache.map;
  }

  // Bir holding için canlı fiyat (native para birimi) — { price, cur }
  async function basketPrice(h) {
    if (h.cls === 'cash') {
      // Nakit bakiye: birim fiyat 1, para birimi sembolde (TRY/USD). K/Z üretmez.
      return { price: 1, cur: (h.symbol === 'USD') ? 'USD' : 'TRY' };
    }
    if (h.cls === 'fund') {
      // TEFAS fonları: canlı NAV bot korumasıyla kapalı → manuel girilen birim fiyat (TL)
      return { price: (h.manualPrice != null && isFinite(h.manualPrice)) ? h.manualPrice : null, cur: 'TRY' };
    }
    if (h.cls === 'metal' || h.cls === 'fx') {
      const p = truncgilCache ? truncgilGet(truncgilCache, h.symbol) : null;
      return { price: p, cur: 'TRY' };
    }
    if (h.cls === 'crypto') {
      const map = await cryptoPrices([h.cgId]);
      return { price: (map[h.cgId] != null ? map[h.cgId] : null), cur: 'USD' };
    }
    const mkt = h.cls === 'us' ? 'US' : 'BIST';
    try { const q = await getQuote(h.symbol, mkt); return { price: q ? q.price : null, cur: h.cls === 'us' ? 'USD' : 'TRY' }; }
    catch (e) { return { price: null, cur: h.cls === 'us' ? 'USD' : 'TRY' }; }
  }

  // Native para birimi fiyat biçimi (küçük fiyatlarda daha çok ondalık)
  function fmtNative(v, cur) {
    if (v == null || !isFinite(v)) return '—';
    const dec = Math.abs(v) < 1 ? 6 : Math.abs(v) < 100 ? 2 : 2;
    const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: dec > 2 ? 2 : 2, maximumFractionDigits: dec }).format(v);
    return cur === 'USD' ? '$' + s : s + ' ₺';
  }
  function fmtQty(n) {
    if (n == null || !isFinite(n)) return '—';
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 8 }).format(n);
  }

  // ===== Sabit fiyat göstergeleri — üst şeride iğnele (sepet DEĞİL, yalnız fiyat) =====
  const TICKER_LS = 'sb:tickers';
  const TICKER_TOTAL_MAX = 10;   // şeritteki toplam gösterge sınırı
  const TICKER_BUILTIN = 6;      // yerleşik: gram, usd, eur, gbp, btc, eth
  const tickerCustomMax = () => Math.max(0, TICKER_TOTAL_MAX - TICKER_BUILTIN); // = 4
  function loadTickers() { try { return JSON.parse(localStorage.getItem(TICKER_LS)) || []; } catch (e) { return []; } }
  function saveTickers(a) { try { localStorage.setItem(TICKER_LS, JSON.stringify(a)); } catch (e) {} }
  function tickerHolding(t) { return { cls: t.cls, symbol: t.symbol, cgId: t.cgId }; }

  // Yerleşik göstergeleri gizle/geri getir (kalıcı)
  const TICKER_HIDDEN_LS = 'sb:ticker:hidden';
  const TICKER_BUILTIN_META = { gram: 'Gram Altın', usd: 'USD/TRY', eur: 'EUR/TRY', gbp: 'GBP/TRY', btc: 'BTC/USD', eth: 'ETH/USD' };
  function loadHiddenTickers() { try { return JSON.parse(localStorage.getItem(TICKER_HIDDEN_LS)) || []; } catch (e) { return []; } }
  function saveHiddenTickers(a) { try { localStorage.setItem(TICKER_HIDDEN_LS, JSON.stringify(a)); } catch (e) {} }
  function applyHiddenTickers() {
    const hidden = loadHiddenTickers();
    Object.keys(TICKER_BUILTIN_META).forEach((k) => {
      const el = document.querySelector('.ticker-item[data-key="' + k + '"]');
      if (el) el.hidden = hidden.indexOf(k) !== -1;
    });
  }
  function hideBuiltinTicker(key) {
    const hidden = loadHiddenTickers();
    if (hidden.indexOf(key) === -1) { hidden.push(key); saveHiddenTickers(hidden); }
    applyHiddenTickers();
    const m = document.getElementById('tickerModal');
    if (m && !m.hidden) tkRenderPinned();
  }
  function restoreBuiltinTicker(key) {
    saveHiddenTickers(loadHiddenTickers().filter((k) => k !== key));
    applyHiddenTickers();
    const m = document.getElementById('tickerModal');
    if (m && !m.hidden) tkRenderPinned();
  }

  // Özel göstergeleri üst şeride (basketAddBtn'in soluna) yerleştir
  function renderCustomTickers() {
    const bar = document.getElementById('tickerBar');
    const addBtn = document.getElementById('basketAddBtn');
    if (!bar || !addBtn) return;
    [...bar.querySelectorAll('.ticker-custom')].forEach((n) => n.remove());
    loadTickers().slice(0, tickerCustomMax()).forEach((t) => {
      const el = document.createElement('div');
      el.className = 'ticker-item ticker-custom';
      el.dataset.tid = t.id;
      el.innerHTML = `<span class="label">${escapeHtml(t.label)}</span>`
        + `<span class="value" id="tval-${t.id}">—</span>`
        + `<button class="tk-x" title="Kaldır" data-tid="${t.id}">×</button>`;
      bar.insertBefore(el, addBtn);
    });
    updateCustomTickerPrices();
  }

  async function updateCustomTickerPrices() {
    const list = loadTickers().slice(0, tickerCustomMax());
    for (const t of list) {
      const el = document.getElementById('tval-' + t.id);
      if (!el) continue;
      try {
        const { price, cur } = await basketPrice(tickerHolding(t));
        el.textContent = (price == null || !isFinite(price)) ? '—' : fmtNative(price, cur);
      } catch (e) { el.textContent = '—'; }
    }
  }

  function removeTicker(id) {
    saveTickers(loadTickers().filter((t) => t.id !== id));
    renderCustomTickers();
    const m = document.getElementById('tickerModal');
    if (m && !m.hidden) tkRenderPinned();
  }

  // ---- İğneleme modali ----
  let tkCls = 'fx';
  function tkOpen() {
    document.getElementById('tkMaxNote').textContent = tickerCustomMax();
    document.querySelectorAll('#tkClass .chip').forEach((c) => c.classList.toggle('active', c.dataset.tkcls === 'fx'));
    tkSetClass('fx');
    tkRenderPinned();
    document.getElementById('tkStatus').textContent = '';
    document.getElementById('tickerModal').hidden = false;
  }
  function tkClose() { const m = document.getElementById('tickerModal'); if (m) m.hidden = true; }

  function tkSetClass(cls) {
    tkCls = cls;
    const pick = document.getElementById('tkPick');
    const sym = document.getElementById('tkSymbol');
    const label = document.getElementById('tkPickLabel');
    const isStock = (cls === 'us' || cls === 'bist');
    pick.hidden = isStock; sym.hidden = !isStock;
    if (isStock) {
      label.textContent = cls === 'us' ? 'ABD sembolü' : 'BIST sembolü';
      sym.value = '';
    } else {
      label.textContent = 'Varlık';
      let opts = '';
      if (cls === 'fx') opts = BM_FX.map((x) => `<option value="${x.key}">${x.emoji} ${x.name}</option>`).join('');
      else if (cls === 'crypto') opts = BM_CRYPTO.map((x) => `<option value="${x.id}">${x.sym} · ${x.name}</option>`).join('');
      else if (cls === 'metal') opts = BM_METALS.map((x) => `<option value="${x.key}">${x.emoji} ${x.name}</option>`).join('');
      pick.innerHTML = opts;
    }
  }

  function tkAdd() {
    const status = document.getElementById('tkStatus');
    const cur = loadTickers();
    if (cur.length >= tickerCustomMax()) {
      status.textContent = `En fazla ${tickerCustomMax()} özel gösterge ekleyebilirsin (toplam ${TICKER_TOTAL_MAX}). Önce birini kaldır.`;
      return;
    }
    let t = null;
    if (tkCls === 'us' || tkCls === 'bist') {
      const s = (document.getElementById('tkSymbol').value || '').trim().toUpperCase();
      if (!s) { status.textContent = 'Sembol gir.'; return; }
      t = { cls: tkCls, symbol: s, label: s };
    } else {
      const val = document.getElementById('tkPick').value;
      if (!val) { status.textContent = 'Varlık seç.'; return; }
      if (tkCls === 'fx') { const x = BM_FX.find((z) => z.key === val); t = { cls: 'fx', symbol: val, label: x ? x.key : val }; }
      else if (tkCls === 'metal') { const x = BM_METALS.find((z) => z.key === val); t = { cls: 'metal', symbol: val, label: x ? x.name : val }; }
      else if (tkCls === 'crypto') { const x = BM_CRYPTO.find((z) => z.id === val); t = { cls: 'crypto', cgId: val, symbol: x ? x.sym : val, label: x ? x.sym : val }; }
    }
    if (!t) return;
    t.id = (t.cls + '-' + (t.cgId || t.symbol)).replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (cur.some((z) => z.id === t.id)) { status.textContent = 'Bu gösterge zaten ekli.'; return; }
    cur.push(t); saveTickers(cur);
    renderCustomTickers();
    tkRenderPinned();
    status.textContent = `✓ ${t.label} şeride eklendi.`;
  }

  function tkRenderPinned() {
    const box = document.getElementById('tkPinned');
    if (!box) return;
    const list = loadTickers();
    const hidden = loadHiddenTickers();
    let html = '';
    if (!list.length) {
      html += '<div class="tk-empty">Henüz özel gösterge yok. Yukarıdan seçip “İğnele” de.</div>';
    } else {
      html += `<div class="tk-pinned-head">İğnelenmiş göstergeler (${list.length}/${tickerCustomMax()})</div>`
        + list.map((t) => {
            const c = BASKET_CLASSES[t.cls] || { emoji: '', label: t.cls };
            return `<div class="tk-pin-row"><span>${c.emoji} ${escapeHtml(t.label)} <em>${c.label}</em></span><button class="tk-pin-x" data-tid="${t.id}">Kaldır</button></div>`;
          }).join('');
    }
    if (hidden.length) {
      html += `<div class="tk-pinned-head">Gizlenen yerleşikler</div>`
        + hidden.map((k) => `<div class="tk-pin-row"><span>${escapeHtml(TICKER_BUILTIN_META[k] || k)}</span><button class="tk-pin-restore" data-tkey="${k}">Geri getir</button></div>`).join('');
    }
    box.innerHTML = html;
  }

  let basketFilter = 'ALL';
  let basketWin = '24s';

  // Bir pencerenin baz kaydını + kesim tarihini bul (pencerenin başlangıcı)
  function basketWindowRef(hist, win) {
    if (!hist || !hist.length) return null;
    if (win === 'BASL') return { rec: hist[0], cutoff: hist[0].date };
    const w = BASKET_WINDOWS.find((x) => x.k === win); if (!w) return null;
    const t = new Date(); t.setDate(t.getDate() - w.days);
    const cutoff = t.toISOString().slice(0, 10);
    let pick = null;
    for (const rec of hist) { if (rec.date <= cutoff) pick = rec; else break; }
    if (!pick) return null; // o kadar eski kayıt yok
    return { rec: pick, cutoff: cutoff };
  }

  // Bir pencere için geçmişten baz değeri bul (o pencerenin başındaki sepet değeri)
  function basketWindowBase(hist, win, filter) {
    const ref = basketWindowRef(hist, win); if (!ref) return null;
    return filter === 'ALL' ? ref.rec.total : ((ref.rec.byClass && ref.rec.byClass[filter]) || 0);
  }

  // Pencere içinde (kesim tarihinden sonra) yapılan işlemlerin net nakit akışı.
  // Alım/ekleme = +, satım/çıkarma = −. Fiyat hareketini kar-zarardan izole etmek için.
  function basketWindowFlow(hist, win, filter) {
    const ref = basketWindowRef(hist, win); if (!ref) return 0;
    const cutoff = ref.cutoff;
    let net = 0;
    loadMoves().forEach((m) => {
      if (typeof m.basketFlow !== 'number' || !isFinite(m.basketFlow)) return;
      const d = (m.ts || '').slice(0, 10);
      if (!d || d <= cutoff) return; // baz anına kadar olanlar zaten baz değerin içinde
      if (filter !== 'ALL' && (m.cls || '') !== filter) return;
      net += m.basketFlow;
    });
    return net;
  }

  // Yalnızca fiyat hareketini yansıtan pencere değişimi (nakit akışı çıkarılmış).
  // cur = pencere sonundaki (güncel) değer. Döndürür {d, dp} ya da ölçülemezse null.
  function basketWindowDelta(hist, win, filter, cur) {
    const base = basketWindowBase(hist, win, filter);
    if (base == null) return null;
    const flow = basketWindowFlow(hist, win, filter);
    const adjBase = base + flow;                 // pencere boyunca eklenen/çıkan sermaye dahil taban
    if (!(adjBase > 0)) return null;             // ölçülemez (yeni açılmış ya da kapanmış pozisyon)
    const d = cur - base - flow;                 // yalnızca fiyat hareketinden gelen kazanç/kayıp
    return { d: d, dp: d / adjBase * 100 };
  }

  // Seçili pencere için grafik noktaları [{date, v}] (baz kayıt + sonrası)
  function basketSeriesForWindow(hist, filter, win) {
    if (!hist || !hist.length) return [];
    const val = (rec) => filter === 'ALL' ? rec.total : ((rec.byClass && rec.byClass[filter]) || 0);
    if (win === 'BASL') return hist.map((r) => ({ date: r.date, v: val(r) }));
    const w = BASKET_WINDOWS.find((x) => x.k === win); if (!w) return hist.map((r) => ({ date: r.date, v: val(r) }));
    const t = new Date(); t.setDate(t.getDate() - w.days);
    const ts = t.toISOString().slice(0, 10);
    let baseIdx = -1;
    for (let i = 0; i < hist.length; i++) { if (hist[i].date <= ts) baseIdx = i; else break; }
    const out = [];
    if (baseIdx >= 0) out.push({ date: hist[baseIdx].date, v: val(hist[baseIdx]) });
    for (let i = Math.max(0, baseIdx + 1); i < hist.length; i++) { if (hist[i].date > ts) out.push({ date: hist[i].date, v: val(hist[i]) }); }
    return out;
  }

  function snapshotBasketHistory(total, byClass) {
    const today = new Date().toISOString().slice(0, 10);
    let h = []; try { h = JSON.parse(localStorage.getItem(BASKET_HIST_LS)) || []; } catch (e) {}
    const rec = { date: today, total: total, byClass: byClass };
    if (h.length && h[h.length - 1].date === today) h[h.length - 1] = rec; else h.push(rec);
    if (h.length > 400) h = h.slice(-400);
    try { localStorage.setItem(BASKET_HIST_LS, JSON.stringify(h)); } catch (e) {}
    return h;
  }
  function loadBasketHistory() { try { return JSON.parse(localStorage.getItem(BASKET_HIST_LS)) || []; } catch (e) { return []; } }

  // Donut çizimi (varlık sınıfı dağılımı)
  function drawBasketDonut(rows) {
    const cv = document.getElementById('basketDonut'); if (!cv) return;
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 6, r = R * 0.62;
    const total = rows.reduce((s, x) => s + x.val, 0);
    if (!total) {
      ctx.strokeStyle = '#232a44'; ctx.lineWidth = R - r;
      ctx.beginPath(); ctx.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    let a0 = -Math.PI / 2;
    rows.forEach((row) => {
      const frac = row.val / total; const a1 = a0 + frac * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
      ctx.fillStyle = row.color; ctx.fill();
      a0 = a1;
    });
    // iç boşluk (donut deliği) — kart arkaplan rengi
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#151b2e'; ctx.fill();
    // ortadaki toplam
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 15px -apple-system, Segoe UI, sans-serif';
    const kısa = total >= 1e6 ? (total / 1e6).toFixed(1) + 'M' : total >= 1e3 ? Math.round(total / 1e3) + 'K' : Math.round(total);
    ctx.fillText('₺' + kısa, cx, cy - 8);
    ctx.fillStyle = '#7a8299'; ctx.font = '500 11px -apple-system, Segoe UI, sans-serif';
    ctx.fillText('Toplam', cx, cy + 10);
  }

  // kısa TL ekseni etiketi
  function axK(v) {
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
    if (a >= 1e3) return Math.round(v / 1e3) + 'K';
    return Math.round(v).toString();
  }
  // dd.MM tarih etiketi
  function axD(iso) { const p = (iso || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : iso; }

  // Değer seyri çizgisi (eksenli + baz referans çizgisi + hamle bayrakları)
  function drawBasketLine(points, moves) {
    const cv = document.getElementById('basketLine'); const empty = document.getElementById('basketLineEmpty');
    if (!cv) return;
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const series = (points || []).map((p) => p.v);
    if (series.length < 2) { if (empty) empty.hidden = false; cv.style.opacity = '0.25'; return; }
    if (empty) empty.hidden = true; cv.style.opacity = '1';
    const padL = 40, padR = 12, padT = 14, padB = 22;
    let min = Math.min(...series), max = Math.max(...series);
    const base = series[0];
    // baz çizgisi görünür kalsın diye min/max'e kat
    min = Math.min(min, base); max = Math.max(max, base);
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const x = (i) => padL + (W - padL - padR) * (i / (series.length - 1));
    const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / span);
    const up = series[series.length - 1] >= base;
    const col = up ? '#22d39a' : '#ff5e7e';
    // yatay ızgara + Y ekseni etiketleri (3 seviye)
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '500 9px -apple-system, Segoe UI, sans-serif';
    [max, (max + min) / 2, min].forEach((lv) => {
      const gy = y(lv);
      ctx.strokeStyle = 'rgba(122,130,153,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(W - padR, gy); ctx.stroke();
      ctx.fillStyle = '#7a8299'; ctx.fillText(axK(lv), padL - 5, gy);
    });
    // baz referans çizgisi (pencere başı değeri)
    const by = y(base);
    ctx.strokeStyle = 'rgba(122,130,153,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(W - padR, by); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillStyle = '#7a8299'; ctx.font = '500 8.5px -apple-system, Segoe UI, sans-serif';
    ctx.fillText('başlangıç', padL + 3, by - 6 < padT ? by + 7 : by - 6);
    // alan dolgusu
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, up ? 'rgba(34,211,154,0.22)' : 'rgba(255,94,126,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.moveTo(x(0), y(series[0]));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(i), y(series[i]));
    ctx.lineTo(x(series.length - 1), H - padB); ctx.lineTo(x(0), H - padB); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // çizgi
    ctx.beginPath(); ctx.moveTo(x(0), y(series[0]));
    for (let i = 1; i < series.length; i++) ctx.lineTo(x(i), y(series[i]));
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    // son nokta
    const lx = x(series.length - 1), ly = y(series[series.length - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    // hamle bayrakları (bu penceredeki tarihlere denk gelen al/sat/ekle/çıkar)
    const first = points[0].date, last = points[points.length - 1].date;
    (moves || []).forEach((mv) => {
      const d = (mv.ts || '').slice(0, 10);
      if (!d || d < first || d > last) return;
      // en yakın noktayı bul
      let idx = 0; for (let i = 0; i < points.length; i++) { if (points[i].date <= d) idx = i; }
      const mx = x(idx);
      ctx.strokeStyle = 'rgba(90,169,255,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, H - padB); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#5aa9ff'; ctx.beginPath();
      ctx.moveTo(mx, padT - 1); ctx.lineTo(mx - 4, padT + 6); ctx.lineTo(mx + 4, padT + 6); ctx.closePath(); ctx.fill();
    });
    // X ekseni: ilk / orta / son tarih
    ctx.fillStyle = '#7a8299'; ctx.font = '500 9px -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';   ctx.fillText(axD(first), padL, H - 6);
    ctx.textAlign = 'right';  ctx.fillText('şimdi', W - padR, H - 6);
    if (points.length > 3) { ctx.textAlign = 'center'; ctx.fillText(axD(points[Math.floor(points.length / 2)].date), (padL + W - padR) / 2, H - 6); }
  }

  async function renderBasket() {
    const wrap = document.getElementById('portfolioGridBASKET'); if (!wrap) return;
    const listEl = document.getElementById('basketList');
    const totalEl = document.getElementById('basketTotalVal');
    const chgEl = document.getElementById('basketTotalChg');
    const holdings = loadBasket();

    if (!holdings.length) {
      if (listEl) listEl.innerHTML = '<div class="basket-empty">Sepetin boş. Üstteki <b>＋</b> ile maden, döviz, kripto veya hisse ekleyerek başla.</div>';
      if (totalEl) totalEl.textContent = '0,00 ₺';
      if (chgEl) { chgEl.textContent = ''; chgEl.className = 'bt-change'; }
      renderBasketWindows([], 'ALL');
      drawBasketDonut([]);
      drawBasketLine([], []);
      renderBasketMoves(null);
      return;
    }
    if (listEl) listEl.innerHTML = '<div class="loading">Fiyatlar alınıyor…</div>';

    // tüm holding'ler için canlı fiyat
    const enriched = await Promise.all(holdings.map(async (h) => {
      const { price, cur } = await basketPrice(h);
      const valTRY = (price != null) ? toTRY(price * h.qty, cur) : null;
      const costUnit = (h.cost != null ? h.cost : h.addPrice);
      const costTRY = (costUnit != null) ? toTRY(costUnit * h.qty, cur) : null;
      const pl = (valTRY != null && costTRY != null) ? valTRY - costTRY : null;
      const plPct = (pl != null && costTRY) ? (pl / costTRY) * 100 : null;
      return { h, price, cur, valTRY, costTRY, pl, plPct };
    }));

    // sınıf bazında toplam
    const byClass = {};
    let grand = 0, grandCost = 0;
    enriched.forEach((e) => {
      if (e.valTRY != null) { grand += e.valTRY; byClass[e.h.cls] = (byClass[e.h.cls] || 0) + e.valTRY; }
      if (e.costTRY != null) grandCost += e.costTRY;
    });

    // history güncelle (günde bir kayıt)
    const hist = snapshotBasketHistory(grand, byClass);

    // filtre uygulanmış toplam
    const filt = basketFilter;
    let shownTotal = grand, shownCost = grandCost;
    if (filt !== 'ALL') {
      shownTotal = 0; shownCost = 0;
      enriched.forEach((e) => { if (e.h.cls === filt) { if (e.valTRY != null) shownTotal += e.valTRY; if (e.costTRY != null) shownCost += e.costTRY; } });
    }
    if (totalEl) totalEl.textContent = fmtTRY(shownTotal);
    // "Bugün ne oldu?" — 24 saatlik (dünkü snapshot'a göre) değişim
    if (chgEl) {
      const chg24 = basketWindowDelta(hist, '24s', filt, shownTotal);
      if (chg24) {
        const d = chg24.d, dp = chg24.dp;
        chgEl.textContent = 'Bugün: ' + (d >= 0 ? '▲ ' : '▼ ') + fmtTRY(Math.abs(d)) + '  (' + fmtPct(dp) + ')';
        chgEl.className = 'bt-change ' + pctCls(dp);
      } else {
        chgEl.textContent = 'Bugün: veri yarın birikmeye başlar';
        chgEl.className = 'bt-change flat';
      }
    }
    renderBasketWindows(hist, filt);

    // donut satırları (tam dağılım — filtreden bağımsız)
    const donutRows = Object.keys(BASKET_CLASSES)
      .filter((c) => byClass[c])
      .map((c) => ({ cls: c, val: byClass[c], color: BASKET_CLASSES[c].color }));
    drawBasketDonut(donutRows);
    // legend
    const legend = document.getElementById('basketLegend');
    if (legend) {
      legend.innerHTML = donutRows.map((row) => {
        const pct = grand ? (row.val / grand * 100) : 0;
        return `<li data-legend="${row.cls}" style="cursor:pointer">
          <span class="dl-dot" style="background:${row.color}"></span>
          <span class="dl-name">${BASKET_CLASSES[row.cls].emoji} ${BASKET_CLASSES[row.cls].label}</span>
          <span class="dl-val">${fmtTRY(row.val)}</span>
          <span class="dl-pct">%${pct.toFixed(0)}</span>
        </li>`;
      }).join('') || '<li class="dl-name">Veri yok</li>';
    }
    const pts = basketSeriesForWindow(hist, filt, basketWin);
    drawBasketLine(pts, loadMoves());
    // "Değer seyri" alt-başlığını seçili pencereye göre yaz
    const lineSub = document.getElementById('basketLineSub');
    if (lineSub) { const w = BASKET_WINDOWS.find((x) => x.k === basketWin); lineSub.textContent = '(' + (w ? (w.k === 'BASL' ? 'başlangıçtan' : 'son ' + w.label) : '') + ' · TL)'; }
    // açık pozisyon K/Z (maliyet bazlı) — hamleler kartında göster
    const openPL = (shownCost > 0) ? (shownTotal - shownCost) : null;
    renderBasketMoves(openPL);

    // liste (filtreye göre)
    const shown = enriched.filter((e) => filt === 'ALL' || e.h.cls === filt);
    if (listEl) {
      listEl.innerHTML = shown.map((e) => {
        const cm = BASKET_CLASSES[e.h.cls];
        const isCash = e.h.cls === 'cash';
        const plCls = pctCls(e.plPct);
        const plTxt = isCash
          ? '<span class="bl-pl flat">nakit</span>'
          : (e.pl != null)
          ? `<span class="bl-pl ${plCls}">${e.pl >= 0 ? '▲' : '▼'} ${fmtTRY(Math.abs(e.pl))} (${fmtPct(e.plPct)})</span>`
          : '<span class="bl-pl flat">—</span>';
        const nowTxt = (e.valTRY != null) ? fmtTRY(e.valTRY) : '—';
        const pxTxt = (e.price != null) ? fmtNative(e.price, e.cur) : '—';
        const unit = e.h.unit ? ' ' + e.h.unit : (e.h.cls === 'fx' ? ' birim' : (e.h.cls === 'crypto' ? '' : (e.h.cls === 'fund' ? ' pay' : ' adet')));
        const metaTxt = isCash
          ? `<span class="bl-cls-tag">${cm.label}</span>${(e.h.symbol === 'USD') ? '$' : '₺'} bakiye`
          : `<span class="bl-cls-tag">${cm.label}</span>${fmtQty(e.h.qty)}${unit} · ${pxTxt}`;
        const fundBtn = (e.h.cls === 'fund')
          ? `<button class="bl-remove bl-fundpx" data-fund-px="${e.h.id}" title="Fon birim fiyatını güncelle">✎</button>` : '';
        const cashBtn = isCash
          ? `<button class="bl-remove bl-cashedit" data-cash-edit="${e.h.id}" title="Nakit bakiyeyi düzenle">✎</button>` : '';
        const divBtn = (e.h.cls === 'us' || e.h.cls === 'bist')
          ? `<button class="bl-remove bl-divin" data-div-in="${e.h.id}" title="Temettü geldi → nakite ekle">💰</button>` : '';
        return `<div class="bl-item">
          <div class="bl-badge">${e.h.emoji || cm.emoji}</div>
          <div class="bl-main">
            <div class="bl-name">${e.h.name}</div>
            <div class="bl-meta">${metaTxt}</div>
          </div>
          <div class="bl-vals">
            <span class="bl-now">${nowTxt}</span>
            ${plTxt}
          </div>
          ${divBtn}${fundBtn}${cashBtn}
          <button class="bl-remove" data-basket-remove="${e.h.id}" title="Sepetten çıkar">×</button>
        </div>`;
      }).join('') || '<div class="basket-empty">Bu sınıfta varlık yok.</div>';
    }
  }

  // Zaman penceresi çiplerini (her pencerenin % değişimiyle) çiz
  function renderBasketWindows(hist, filter) {
    const bar = document.getElementById('basketWindows'); if (!bar) return;
    const val = (rec) => filter === 'ALL' ? rec.total : ((rec.byClass && rec.byClass[filter]) || 0);
    const cur = (hist && hist.length) ? val(hist[hist.length - 1]) : 0;
    bar.innerHTML = BASKET_WINDOWS.map((w) => {
      const chg = basketWindowDelta(hist, w.k, filter, cur);
      let v = '<span class="bw-v flat">—</span>';
      if (chg) {
        const dp = chg.dp;
        const num = Math.abs(dp) >= 100 ? Math.round(Math.abs(dp)) : Math.abs(dp).toFixed(1).replace('.', ',');
        v = `<span class="bw-v ${pctCls(dp)}">${dp >= 0 ? '+' : '−'}${num}%</span>`;
      }
      return `<button class="bw ${w.k === basketWin ? 'on' : ''}" data-bwin="${w.k}"><span class="bw-k">${w.label}</span>${v}</button>`;
    }).join('');
  }

  function fmtMoveDate(iso) { try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }); } catch (e) { return (iso || '').slice(0, 10); } }

  let movesFilter = 'ALL';
  // Geçmiş hamleler + gerçekleşen/açık K/Z
  function renderBasketMoves(openPL) {
    const wrap = document.getElementById('basketMovesCard'); if (!wrap) return;
    const all = loadMoves();
    const realized = all.reduce((s, m) => s + (m.pl != null && isFinite(m.pl) ? m.pl : 0), 0);
    const relEl = document.getElementById('basketRealizedPL');
    if (relEl) {
      const has = all.some((m) => m.pl != null);
      relEl.textContent = has ? (realized >= 0 ? '+' : '−') + fmtTRY(Math.abs(realized)) : '—';
      relEl.className = 'bp-v ' + (!has ? 'flat' : realized > 0.5 ? 'up' : realized < -0.5 ? 'down' : 'flat');
    }
    const opEl = document.getElementById('basketOpenPL');
    if (opEl) {
      if (openPL == null) { opEl.textContent = '—'; opEl.className = 'bp-v flat'; }
      else { opEl.textContent = (openPL >= 0 ? '+' : '−') + fmtTRY(Math.abs(openPL)); opEl.className = 'bp-v ' + (openPL > 0.5 ? 'up' : openPL < -0.5 ? 'down' : 'flat'); }
    }
    const listEl = document.getElementById('basketMovesList'); if (!listEl) return;
    const moves = all.slice().reverse();
    const show = moves.filter((m) => movesFilter === 'ALL' ? true
      : movesFilter === 'trade' ? (m.type === 'buy' || m.type === 'sell')
      : (m.type === 'add' || m.type === 'remove'));
    if (!show.length) { listEl.innerHTML = '<div class="bm-empty">Henüz hamle yok. Sepete ekleme/çıkarma ve “İşlem ekle” buraya işlenir.</div>'; return; }
    const IC = { buy: { c: 'buy', t: '↗', l: 'Alım' }, sell: { c: 'sell', t: '↘', l: 'Satım' }, add: { c: 'add', t: '＋', l: 'Eklendi' }, remove: { c: 'rem', t: '－', l: 'Çıkarıldı' } };
    listEl.innerHTML = show.slice(0, 60).map((m) => {
      const ic = IC[m.type] || IC.add;
      const plHtml = (m.pl != null && isFinite(m.pl)) ? ` · K/Z <b class="${m.pl >= 0 ? 'up' : 'down'}">${m.pl >= 0 ? '+' : '−'}${fmtTRY(Math.abs(m.pl))}</b>` : '';
      const px = (m.price != null) ? ' · ' + fmtNative(m.price, m.cur || 'TRY') : '';
      const valTxt = (m.valTRY != null) ? fmtTRY(m.valTRY) : '—';
      const sign = (m.type === 'buy') ? '−' : (m.type === 'sell') ? '+' : '';
      return `<div class="bmv">
        <div class="bmv-ic ${ic.c}">${ic.t}</div>
        <div class="bmv-main">
          <div class="bmv-t">${escapeHtml(m.emoji || '')} ${escapeHtml(m.name || m.symbol || '—')}${m.qty ? ' · ' + fmtQty(m.qty) : ''}</div>
          <div class="bmv-s">${fmtMoveDate(m.ts)} · ${ic.l}${px}${plHtml}</div>
        </div>
        <div class="bmv-r"><div class="bmv-v">${sign}${valTxt}</div></div>
        <button class="bmv-x" data-move-del="${m.id}" title="Kaydı sil">×</button>
      </div>`;
    }).join('');
  }

  // ===== Manuel "İşlem ekle" modali (al / sat / kapanan işlem) =====
  // Al/Sat gerçek sepet holding'ini günceller; Kapanan işlem yalnızca günlüğe yazar.
  let txnCls = 'fx';
  function curForCls(cls) { return (cls === 'us' || cls === 'crypto') ? 'USD' : 'TRY'; }
  function txnSetClass(cls) {
    txnCls = cls;
    document.querySelectorAll('#txnClass .chip').forEach((c) => c.classList.toggle('active', c.dataset.txncls === cls));
    const pick = document.getElementById('txnPick');
    const sym = document.getElementById('txnSymbol');
    const hint = document.getElementById('txnCurHint');
    const isFree = (cls === 'us' || cls === 'bist' || cls === 'fund');
    if (pick) pick.hidden = isFree;
    if (sym) { sym.hidden = !isFree; if (isFree) sym.placeholder = cls === 'us' ? 'Sembol (ör. AAPL)' : (cls === 'fund' ? 'Fon kodu (ör. KGM)' : 'Sembol (ör. THYAO)'); }
    if (pick && !isFree) {
      pick.innerHTML = bmCatalog(cls).map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
    }
    if (hint) hint.textContent = curForCls(cls) === 'USD' ? '($)' : '(TL)';
  }
  function txnSelected() {
    // seçili varlığın {cls, symbol, cgId, name, unit, emoji} çözümü (bmSelected ile aynı katalog)
    if (txnCls === 'metal') { const m = BM_METALS.find((x) => x.key === document.getElementById('txnPick').value); return m ? { cls: 'metal', symbol: m.key, name: m.name, unit: m.unit, emoji: m.emoji } : null; }
    if (txnCls === 'fx') { const f = BM_FX.find((x) => x.key === document.getElementById('txnPick').value); return f ? { cls: 'fx', symbol: f.key, name: f.name, emoji: f.emoji } : null; }
    if (txnCls === 'crypto') { const c = BM_CRYPTO.find((x) => x.id === document.getElementById('txnPick').value); return c ? { cls: 'crypto', symbol: c.sym, cgId: c.id, name: c.name + ' (' + c.sym + ')', emoji: '🪙' } : null; }
    const raw = (document.getElementById('txnSymbol').value || '').trim().toUpperCase();
    if (!raw) return null;
    return { cls: txnCls, symbol: raw, name: raw, emoji: txnCls === 'us' ? '🇺🇸' : (txnCls === 'fund' ? '🧺' : '🇹🇷') };
  }
  function txnFindHolding(arr, sel) {
    return arr.find((x) => x.cls === sel.cls && (sel.cgId ? x.cgId === sel.cgId : (x.symbol || '').toUpperCase() === (sel.symbol || '').toUpperCase()));
  }
  function txnOpen() {
    const m = document.getElementById('txnModal'); if (!m) return;
    document.getElementById('txnQty').value = '';
    document.getElementById('txnPrice').value = '';
    document.getElementById('txnBuy').value = '';
    document.getElementById('txnSell').value = '';
    const sym = document.getElementById('txnSymbol'); if (sym) sym.value = '';
    const d = document.getElementById('txnDate'); if (d) d.value = new Date().toISOString().slice(0, 10);
    const st = document.getElementById('txnStatus'); if (st) { st.textContent = ''; st.className = 'bm-status'; }
    txnSetClass(txnCls);
    txnSetType(document.getElementById('txnType') ? document.getElementById('txnType').value : 'buy');
    m.hidden = false;
  }
  function txnClose() { const m = document.getElementById('txnModal'); if (m) m.hidden = true; }
  function txnSetType(t) {
    const single = document.getElementById('txnSingleRow');
    const paired = document.getElementById('txnPairedRow');
    const isClosed = (t === 'closed');
    if (single) single.hidden = isClosed;
    if (paired) paired.hidden = !isClosed;
  }
  async function txnSave() {
    const st = document.getElementById('txnStatus');
    const type0 = document.getElementById('txnType').value; // buy|sell|closed
    const sel = txnSelected();
    const qty = parseFloat(document.getElementById('txnQty').value);
    const dateV = document.getElementById('txnDate').value;
    if (!sel) { if (st) { st.textContent = 'Bir varlık seç.'; st.className = 'bm-status err'; } return; }
    if (!(qty > 0)) { if (st) { st.textContent = 'Geçerli bir miktar gir.'; st.className = 'bm-status err'; } return; }
    const cur = curForCls(sel.cls);
    const ts = dateV ? new Date(dateV + 'T12:00:00').toISOString() : new Date().toISOString();

    // ── Kapanan işlem: yalnızca günlük (sepete dokunmaz) ──
    if (type0 === 'closed') {
      const buy = parseFloat(document.getElementById('txnBuy').value);
      const sell = parseFloat(document.getElementById('txnSell').value);
      if (!(buy > 0) || !(sell > 0)) { if (st) { st.textContent = 'Alış ve satış fiyatını gir.'; st.className = 'bm-status err'; } return; }
      const pl = toTRY((sell - buy) * qty, cur);
      logMove({ type: 'sell', cls: sel.cls, symbol: sel.symbol, name: sel.name, emoji: sel.emoji, qty, price: sell, cur, valTRY: toTRY(sell * qty, cur), pl, ts, basketFlow: 0 });
      if (st) { st.textContent = 'Kapanan işlem günlüğe kaydedildi.'; st.className = 'bm-status ok'; }
      setTimeout(txnClose, 700); renderBasket();
      return;
    }

    // Al/Sat → gerçek fiyat gir
    const price = parseFloat(document.getElementById('txnPrice').value);
    if (!(price > 0)) { if (st) { st.textContent = 'Geçerli bir fiyat gir.'; st.className = 'bm-status err'; } return; }
    const arr = loadBasket();

    if (type0 === 'buy') {
      // ── Alım: eşleşen holding'i artır (ağırlıklı ort. maliyet) ya da yeni ekle ──
      const h = txnFindHolding(arr, sel);
      const before = h ? JSON.parse(JSON.stringify(h)) : null; // geri-al: işlemden önceki durum
      let holdingId;
      if (h) {
        const prevQty = h.qty || 0;
        const prevCost = (h.cost != null && isFinite(h.cost)) ? h.cost : h.addPrice;
        const newQty = prevQty + qty;
        if (prevCost != null && isFinite(prevCost)) h.cost = (prevCost * prevQty + price * qty) / newQty;
        else h.cost = price;
        h.qty = newQty; h.costCur = cur;
        if (sel.cls === 'fund') h.manualPrice = price;
        holdingId = h.id;
      } else {
        holdingId = 'b' + Date.now() + Math.random().toString(36).slice(2, 6);
        arr.push({
          id: holdingId,
          cls: sel.cls, symbol: sel.symbol, cgId: sel.cgId || null,
          name: sel.name, unit: sel.unit || null, emoji: sel.emoji,
          qty: qty, cost: price, costCur: cur, addDate: ts, addPrice: price,
          manualPrice: sel.cls === 'fund' ? price : null,
        });
      }
      saveBasket(arr);
      logMove({ type: 'buy', cls: sel.cls, symbol: sel.symbol, name: sel.name, emoji: sel.emoji, qty, price, cur, valTRY: toTRY(price * qty, cur), pl: null, ts, holdingId, before, basketFlow: toTRY(price * qty, cur) });
      if (st) { st.textContent = sel.name + ' sepete işlendi (alım).'; st.className = 'bm-status ok'; }
      setTimeout(txnClose, 700);
    } else {
      // ── Satım: eşleşen holding'i azalt + gerçekleşen K/Z (maliyet biliniyorsa) ──
      const h = txnFindHolding(arr, sel);
      if (!h) { if (st) { st.textContent = 'Bu varlık sepette yok. Önce "Sepete ekle" ya da "Kapanan işlem"i kullan.'; st.className = 'bm-status err'; } return; }
      const before = JSON.parse(JSON.stringify(h)); // geri-al: satış holding'i silebilir, tam görüntü tut
      const holdingId = h.id;
      const sellQty = Math.min(qty, h.qty || 0);
      if (!(sellQty > 0)) { if (st) { st.textContent = 'Sepette satılacak miktar yok.'; st.className = 'bm-status err'; } return; }
      const costUnit = (h.cost != null && isFinite(h.cost)) ? h.cost : h.addPrice;
      let pl = null;
      if (costUnit != null && isFinite(costUnit)) pl = toTRY((price - costUnit) * sellQty, cur);
      if (sel.cls === 'fund') h.manualPrice = price;
      h.qty -= sellQty;
      const idx = arr.indexOf(h);
      if (h.qty <= 1e-9 && idx >= 0) arr.splice(idx, 1);
      saveBasket(arr);
      logMove({ type: 'sell', cls: sel.cls, symbol: sel.symbol, name: sel.name, emoji: sel.emoji, qty: sellQty, price, cur, valTRY: toTRY(price * sellQty, cur), pl, ts, holdingId, before, basketFlow: -toTRY(price * sellQty, cur) });
      const partial = (qty > sellQty) ? ` (elde ${fmtQty(sellQty)} vardı; fazlası yok sayıldı)` : '';
      if (st) { st.textContent = sel.name + ' sepetten düşüldü (satım)' + partial + '.'; st.className = 'bm-status ok'; }
      setTimeout(txnClose, 900);
    }
    // Sepet görünümüne geç ve tazele
    const basketChip = document.querySelector('.chip[data-pf="BASKET"]');
    if (basketChip) basketChip.click(); else renderBasket();
  }

  // ===== Sepete ekle modali =====
  let bmCls = 'fx';
  function bmCatalog(cls) {
    if (cls === 'metal') return BM_METALS.map((m) => ({ value: m.key, label: m.emoji + ' ' + m.name }));
    if (cls === 'fx') return BM_FX.map((f) => ({ value: f.key, label: f.emoji + ' ' + f.name }));
    if (cls === 'crypto') return BM_CRYPTO.map((c) => ({ value: c.id, label: '🪙 ' + c.name + ' (' + c.sym + ')' }));
    return [];
  }
  function bmSetClass(cls) {
    bmCls = cls;
    document.querySelectorAll('#bmClass .chip').forEach((c) => c.classList.toggle('active', c.dataset.bmcls === cls));
    const pick = document.getElementById('bmPick');
    const sym = document.getElementById('bmSymbol');
    const qtyLabel = document.getElementById('bmQtyLabel');
    const costCur = document.getElementById('bmCostCur');
    const isFree = (cls === 'us' || cls === 'bist' || cls === 'fund');
    if (pick) pick.hidden = isFree;
    if (sym) { sym.hidden = !isFree; if (isFree) sym.placeholder = cls === 'us' ? 'Sembol (ör. AAPL)' : (cls === 'fund' ? 'Fon kodu (ör. KGM)' : 'Sembol (ör. THYAO)'); }
    if (pick && !isFree) {
      pick.innerHTML = bmCatalog(cls).map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
    }
    if (qtyLabel) qtyLabel.textContent = cls === 'fx' ? 'Miktar (birim)' : (cls === 'crypto' ? 'Miktar (coin)' : (cls === 'metal' ? 'Miktar (gram/adet)' : (cls === 'fund' ? 'Pay adedi' : 'Adet (lot)')));
    const usd = (cls === 'crypto' || cls === 'us');
    if (costCur) costCur.textContent = usd ? '($, ops.)' : '(TL, ops.)';
    // Fonlar için "güncel birim fiyat" alanını göster (canlı NAV yok → manuel)
    const fundPxWrap = document.getElementById('bmFundPxWrap');
    if (fundPxWrap) fundPxWrap.hidden = (cls !== 'fund');
    bmUpdatePreview();
  }
  function bmSelected() {
    // seçili varlığın {cls, symbol, cgId, name, unit, emoji} çözümü
    if (bmCls === 'metal') { const m = BM_METALS.find((x) => x.key === document.getElementById('bmPick').value); return m ? { cls: 'metal', symbol: m.key, name: m.name, unit: m.unit, emoji: m.emoji } : null; }
    if (bmCls === 'fx') { const f = BM_FX.find((x) => x.key === document.getElementById('bmPick').value); return f ? { cls: 'fx', symbol: f.key, name: f.name, emoji: f.emoji } : null; }
    if (bmCls === 'crypto') { const c = BM_CRYPTO.find((x) => x.id === document.getElementById('bmPick').value); return c ? { cls: 'crypto', symbol: c.sym, cgId: c.id, name: c.name + ' (' + c.sym + ')', emoji: '🪙' } : null; }
    const raw = (document.getElementById('bmSymbol').value || '').trim().toUpperCase();
    if (!raw) return null;
    return { cls: bmCls, symbol: raw, name: raw, emoji: bmCls === 'us' ? '🇺🇸' : (bmCls === 'fund' ? '🧺' : '🇹🇷') };
  }
  async function bmUpdatePreview() {
    const pv = document.getElementById('bmPreview'); if (!pv) return;
    const sel = bmSelected();
    const qty = parseFloat(document.getElementById('bmQty').value);
    if (!sel) { pv.innerHTML = 'Bir varlık seç.'; return; }
    let price, cur;
    if (sel.cls === 'fund') {
      const fp = parseFloat(document.getElementById('bmFundPx').value);
      if (!(fp > 0)) { pv.innerHTML = `<b>${sel.name || 'Fon'}</b> — güncel birim fiyatı (TL) gir; canlı fon fiyatı çekilemiyor, elle güncellersin.`; return; }
      price = fp; cur = 'TRY';
    } else {
      pv.innerHTML = 'Anlık fiyat alınıyor…';
      const r = await basketPrice(sel).catch(() => ({ price: null, cur: 'TRY' }));
      price = r.price; cur = r.cur;
    }
    if (price == null) { pv.innerHTML = `<b>${sel.name}</b> — anlık fiyat alınamadı${sel.cls === 'us' || sel.cls === 'bist' ? ' (sembolü kontrol et)' : ''}.`; return; }
    let html = `<b>${sel.name}</b> · anlık: <b>${fmtNative(price, cur)}</b>`;
    if (qty > 0) {
      const valTRY = toTRY(price * qty, cur);
      html += ` · ${fmtQty(qty)} → <b>${valTRY != null ? fmtTRY(valTRY) : '—'}</b>`;
    }
    pv.innerHTML = html;
  }
  function bmOpen() {
    const m = document.getElementById('basketModal'); if (!m) return;
    document.getElementById('bmQty').value = '';
    document.getElementById('bmCost').value = '';
    document.getElementById('bmSymbol').value = '';
    const fpx = document.getElementById('bmFundPx'); if (fpx) fpx.value = '';
    const st = document.getElementById('bmStatus'); if (st) { st.textContent = ''; st.className = 'bm-status'; }
    m.hidden = false;
    bmSetClass(bmCls);
  }
  function bmClose() { const m = document.getElementById('basketModal'); if (m) m.hidden = true; }
  async function bmAddHolding() {
    const st = document.getElementById('bmStatus');
    const sel = bmSelected();
    const qty = parseFloat(document.getElementById('bmQty').value);
    const costRaw = document.getElementById('bmCost').value;
    const cost = costRaw === '' ? null : parseFloat(costRaw);
    if (!sel) { if (st) { st.textContent = 'Bir varlık seç.'; st.className = 'bm-status err'; } return; }
    if (!(qty > 0)) { if (st) { st.textContent = 'Geçerli bir miktar gir.'; st.className = 'bm-status err'; } return; }
    if (st) { st.textContent = 'Ekleniyor…'; st.className = 'bm-status'; }
    let price, cur;
    if (sel.cls === 'fund') {
      const fp = parseFloat(document.getElementById('bmFundPx').value);
      if (!(fp > 0)) { if (st) { st.textContent = 'Fon için güncel birim fiyatı (TL) gir; canlı fon fiyatı çekilemiyor.'; st.className = 'bm-status err'; } return; }
      price = fp; cur = 'TRY';
    } else {
      const r = await basketPrice(sel).catch(() => ({ price: null, cur: 'TRY' }));
      price = r.price; cur = r.cur;
      if (price == null) { if (st) { st.textContent = 'Anlık fiyat alınamadı; sembolü kontrol et.'; st.className = 'bm-status err'; } return; }
    }
    const holding = {
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      cls: sel.cls, symbol: sel.symbol, cgId: sel.cgId || null,
      name: sel.name, unit: sel.unit || null, emoji: sel.emoji,
      qty: qty, cost: (cost != null && isFinite(cost)) ? cost : null, costCur: cur,
      addDate: new Date().toISOString(), addPrice: price,
      manualPrice: sel.cls === 'fund' ? price : null,
    };
    const arr = loadBasket(); arr.push(holding); saveBasket(arr);
    logMove({ type: 'add', cls: sel.cls, symbol: sel.symbol, name: sel.name, emoji: sel.emoji, qty: qty, price: price, cur: cur, valTRY: toTRY(price * qty, cur), pl: null, holdingId: holding.id, before: null, basketFlow: toTRY(price * qty, cur) });
    if (st) { st.textContent = sel.name + ' sepete eklendi.'; st.className = 'bm-status ok'; }
    setTimeout(bmClose, 700);
    // Sepet görünümüne geç ve tazele
    const basketChip = document.querySelector('.chip[data-pf="BASKET"]');
    if (basketChip) basketChip.click();
    else renderBasket();
  }
  async function removeBasketHolding(id) {
    const all = loadBasket();
    const h = all.find((x) => x.id === id);
    const arr = all.filter((x) => x.id !== id);
    saveBasket(arr);
    // Çıkarılan varlığın anlık fiyatını çek → gerçekleşen K/Z (maliyet biliniyorsa)
    if (h) {
      let price = null, cur = h.costCur || 'TRY';
      try { const r = await basketPrice(h); price = r.price; cur = r.cur; } catch (e) {}
      let pl = null, valTRY = null;
      if (price != null) valTRY = toTRY(price * h.qty, cur);
      if (price != null && h.cost != null && isFinite(h.cost)) {
        pl = toTRY((price - h.cost) * h.qty, cur);
      }
      // Çıkışta nakit akışı ≈ piyasa değeri; fiyat çekilemediyse maliyetten tahmin et
      const costUnit = (h.cost != null && isFinite(h.cost)) ? h.cost : h.addPrice;
      const flowOut = (valTRY != null) ? valTRY
        : ((costUnit != null && isFinite(costUnit)) ? toTRY(costUnit * h.qty, cur) : 0);
      logMove({ type: 'remove', cls: h.cls, symbol: h.symbol, name: h.name, emoji: h.emoji, qty: h.qty, price: price, cur: cur, valTRY: valTRY, pl: pl, holdingId: h.id, before: JSON.parse(JSON.stringify(h)), basketFlow: -flowOut });
    }
    renderBasket();
  }
  // Fon birim fiyatını elle güncelle (canlı NAV kapalı)
  function fundUpdatePrice(id) {
    const arr = loadBasket();
    const h = arr.find((x) => x.id === id);
    if (!h) return;
    const cur = (h.manualPrice != null && isFinite(h.manualPrice)) ? h.manualPrice : '';
    const inp = window.prompt((h.name || 'Fon') + ' — güncel birim fiyat (TL):', cur);
    if (inp == null) return;
    const v = parseFloat(String(inp).replace(',', '.'));
    if (!(v > 0)) return;
    h.manualPrice = v;
    if (h.addPrice == null) h.addPrice = v;
    saveBasket(arr);
    renderBasket();
  }
  // ===== Nakit bakiye (💵 TL/USD) =====
  const CASH_NAME = { TRY: 'Nakit ₺', USD: 'Nakit $' };
  function findCashHolding(arr, cur) { return arr.find((x) => x.cls === 'cash' && (x.symbol || 'TRY') === cur); }
  function cashBalance(cur) { const h = findCashHolding(loadBasket(), cur); return h ? (h.qty || 0) : 0; }
  // Nakit bakiyeye işaretli tutar uygula (native para birimi). note = hamle etiketi.
  // Nakit dış akış sayılır → basketFlow işaretlenir, pencere %'sini şişirmez. Döndürür: yeni bakiye | null.
  function adjustCash(cur, delta, note) {
    if (!isFinite(delta) || delta === 0) return null;
    const arr = loadBasket();
    let h = findCashHolding(arr, cur);
    const before = h ? JSON.parse(JSON.stringify(h)) : null;
    if (!h) {
      if (delta < 0) return null;
      h = { id: 'c' + Date.now() + Math.random().toString(36).slice(2, 5), cls: 'cash', symbol: cur, name: CASH_NAME[cur] || ('Nakit ' + cur), emoji: '💵', qty: 0, cost: 1, costCur: cur };
      arr.push(h);
    }
    const newQty = Math.max(0, (h.qty || 0) + delta);
    const applied = newQty - (h.qty || 0);
    if (applied === 0) return newQty;
    h.qty = newQty; h.cost = 1;
    saveBasket(arr);
    logMove({ type: applied >= 0 ? 'add' : 'remove', cls: 'cash', symbol: cur, name: (note || CASH_NAME[cur] || 'Nakit'), emoji: '💵', qty: Math.abs(applied), price: 1, cur: cur, valTRY: toTRY(Math.abs(applied), cur), pl: null, holdingId: h.id, before: before, basketFlow: toTRY(applied, cur) });
    return newQty;
  }
  function setCash(cur, target) {
    if (!(target >= 0)) return null;
    return adjustCash(cur, target - cashBalance(cur), (CASH_NAME[cur] || 'Nakit') + ' · ayarlandı');
  }

  let cashCur = 'TRY', cashOp = 'add';
  function cashUpdatePreview() {
    const pv = document.getElementById('cashPreview'); if (!pv) return;
    const bal = cashBalance(cashCur);
    const sym = cashCur === 'USD' ? '$' : '₺';
    const cur = 'Mevcut bakiye: <b>' + fmtNative(bal, cashCur === 'USD' ? 'USD' : 'TRY') + '</b>';
    const raw = parseFloat(String((document.getElementById('cashAmt') || {}).value || '').replace(',', '.'));
    let after = '';
    if (isFinite(raw) && raw >= 0) {
      const nb = cashOp === 'set' ? raw : cashOp === 'sub' ? Math.max(0, bal - raw) : bal + raw;
      after = ' → <b>' + fmtNative(nb, cashCur === 'USD' ? 'USD' : 'TRY') + '</b>';
    }
    pv.innerHTML = cur + after;
  }
  function cashSetCur(c) {
    cashCur = (c === 'USD') ? 'USD' : 'TRY';
    const hid = document.getElementById('cashCur'); if (hid) hid.value = cashCur;
    const hint = document.getElementById('cashCurHint'); if (hint) hint.textContent = cashCur === 'USD' ? '(USD)' : '(TL)';
    document.querySelectorAll('#cashCurChips .chip').forEach((x) => x.classList.toggle('active', x.dataset.cashcur === cashCur));
    cashUpdatePreview();
  }
  function cashSetOp(o) {
    cashOp = (o === 'set' || o === 'sub') ? o : 'add';
    const hid = document.getElementById('cashOp'); if (hid) hid.value = cashOp;
    document.querySelectorAll('#cashOpChips .chip').forEach((x) => x.classList.toggle('active', x.dataset.cashop === cashOp));
    cashUpdatePreview();
  }
  function cashOpen(cur) {
    const m = document.getElementById('cashModal'); if (!m) return;
    const st = document.getElementById('cashStatus'); if (st) { st.textContent = ''; st.className = 'bm-status'; }
    const amt = document.getElementById('cashAmt'); if (amt) amt.value = '';
    cashSetOp('add');
    cashSetCur(cur === 'USD' ? 'USD' : 'TRY');
    m.hidden = false;
    if (amt) setTimeout(() => amt.focus(), 40);
  }
  function cashClose() { const m = document.getElementById('cashModal'); if (m) m.hidden = true; }
  function cashEditById(id) {
    const h = loadBasket().find((x) => x.id === id);
    cashOpen(h && h.symbol === 'USD' ? 'USD' : 'TRY');
  }
  function cashSave() {
    const st = document.getElementById('cashStatus');
    const raw = parseFloat(String((document.getElementById('cashAmt') || {}).value || '').replace(',', '.'));
    if (!(raw >= 0) || !isFinite(raw)) { if (st) { st.textContent = 'Geçerli bir tutar gir.'; st.className = 'bm-status err'; } return; }
    if (cashOp === 'set') setCash(cashCur, raw);
    else if (cashOp === 'sub') {
      if (raw > cashBalance(cashCur) + 1e-9) { if (st) { st.textContent = 'Bakiyeden fazla çıkaramazsın.'; st.className = 'bm-status err'; } return; }
      adjustCash(cashCur, -raw, (CASH_NAME[cashCur] || 'Nakit') + ' · çekildi');
    } else adjustCash(cashCur, raw, (CASH_NAME[cashCur] || 'Nakit') + ' · yatırıldı');
    cashClose();
    renderBasket();
  }

  // 💰 "Temettü geldi": lot × hisse-başı-temettü kadar TL/USD nakiti sepete ekler (bilgi amaçlı).
  // Hisse-başı tutarı Yahoo'dan otomatik önerir, kullanıcı onaylar/düzeltir.
  async function dividendReceived(id) {
    const h = loadBasket().find((x) => x.id === id);
    if (!h || (h.cls !== 'us' && h.cls !== 'bist')) return;
    const cur = (h.cls === 'us') ? 'USD' : 'TRY';
    const curLbl = cur === 'USD' ? 'USD' : 'TL';
    let perShare = null;
    try {
      const divs = await fetchYahooDividends(h.symbol, h.cls === 'us' ? 'US' : 'BIST');
      if (divs && divs.length && divs[0].amount > 0) perShare = divs[0].amount;
    } catch (e) {}
    const def = (perShare != null) ? String(perShare).replace('.', ',') : '';
    const msg = (h.name || h.symbol) + ' — hisse başı temettü (' + curLbl + '):\n\n'
      + 'Lot: ' + fmtQty(h.qty) + '\n'
      + 'Toplam = lot × hisse başı temettü → sepetteki ' + curLbl + ' nakite eklenir.'
      + (perShare != null ? '\n\n(Yahoo son temettü: ' + def + ' ' + curLbl + '/pay — düzenleyebilirsin)' : '');
    const inp = window.prompt(msg, def);
    if (inp == null) return;
    const per = parseFloat(String(inp).replace(',', '.'));
    if (!(per > 0)) return;
    const total = per * (h.qty || 0);
    if (!(total > 0)) return;
    adjustCash(cur, total, 'TEMETTÜ · ' + (h.symbol || h.name));
    window.alert('💰 ' + (h.name || h.symbol) + '\n' + fmtQty(h.qty) + ' lot × ' + fmtNative(per, cur === 'USD' ? 'USD' : 'TRY') + ' = ' + fmtNative(total, cur === 'USD' ? 'USD' : 'TRY') + '\nsepetteki ' + curLbl + ' nakite eklendi.');
    renderBasket();
  }

  // Bir hamleyi geri al: etkilenen varlığı işlemden önceki durumuna döndürür.
  // before === null → hamle varlığı oluşturmuştu (kaldır); before nesnesi → o anlık görüntüye dön.
  function undoMoveEffect(m) {
    if (!m || !Object.prototype.hasOwnProperty.call(m, 'before')) return false; // eski/"kapanan" kayıt: sepete dokunma
    const arr = loadBasket();
    let idx = m.holdingId ? arr.findIndex((x) => x.id === m.holdingId) : -1;
    if (idx < 0) idx = arr.findIndex((x) => x.cls === m.cls && (x.symbol || '').toUpperCase() === (m.symbol || '').toUpperCase());
    if (m.before == null) {
      if (idx >= 0) arr.splice(idx, 1);
    } else {
      const snap = JSON.parse(JSON.stringify(m.before));
      if (idx >= 0) arr[idx] = snap; else arr.push(snap);
    }
    saveBasket(arr);
    return true;
  }

  // ===== Haberler sekmesi (unified) =====
  let newsCache = [];           // { symbol, type:'NEWS'|'KAP', item }
  let newsFilterSymbol = 'ALL';
  let newsFilterType   = 'ALL';

  async function loadUnifiedNews() {
    const feedEl = document.getElementById('newsFeed');
    feedEl.innerHTML = '<div class="loading">Yükleniyor…</div>';
    newsCache = [];

    // 1) TÜM KAP duyurularını feed'e ekle (ticker başlıktan çıkarılıyor)
    const kapAll = await fetchKAP();
    const portfolio = getPortfolio();
    const portfolioTickers = new Set(
      portfolio.filter(p => p.market === 'BIST').map(p => p.symbol)
    );
    for (const m of kapAll) {
      // Item'a ait birincil ticker: portföydeyse onu vurgula, yoksa ilk tickerı
      const primary = (m.tickers || []).find(t => portfolioTickers.has(t))
                   || (m.tickers || [])[0]
                   || 'KAP';
      newsCache.push({ symbol: primary, type: 'KAP', item: m });
    }

    // 2) Google News'i paralel çek
    const results = await Promise.allSettled(
      portfolio.map(p =>
        fetchRSS(googleNewsUrl(p.query, p.market), 6)
          .then(items => ({ symbol: p.symbol, items }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const it of r.value.items) {
          newsCache.push({ symbol: r.value.symbol, type: 'NEWS', item: it });
        }
      }
    }

    newsCache.sort((a, b) =>
      new Date(b.item.pubDate || 0) - new Date(a.item.pubDate || 0)
    );

    // Filtre chip'lerini oluştur
    const chipBar = document.getElementById('newsFilterChips');
    [...chipBar.querySelectorAll('[data-news-filter]:not([data-news-filter="ALL"])')]
      .forEach(el => el.remove());
    for (const p of portfolio) {
      const c = document.createElement('button');
      c.className = 'chip';
      c.dataset.newsFilter = p.symbol;
      c.textContent = p.symbol;
      c.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-news-filter]').forEach(b => b.classList.remove('active'));
        c.classList.add('active');
        newsFilterSymbol = p.symbol;
        renderUnifiedNews();
      });
      chipBar.appendChild(c);
    }

    renderUnifiedNews();
  }

  function renderUnifiedNews() {
    const feedEl = document.getElementById('newsFeed');
    const filtered = newsCache.filter(x => {
      if (newsFilterSymbol !== 'ALL' && x.symbol !== newsFilterSymbol) return false;
      if (newsFilterType !== 'ALL' && x.type !== newsFilterType) return false;
      return true;
    });
    if (!filtered.length) {
      feedEl.innerHTML = '<div class="empty">Haber yok.</div>';
      return;
    }
    feedEl.innerHTML = filtered.slice(0, 100).map(x => `
      <div class="feed-item">
        <a href="${x.item.link}" target="_blank" rel="noopener">${x.item.title}</a>
        <div class="meta">
          <span class="tag ${x.type === 'KAP' ? 'tag-kap' : ''}">${x.symbol} · ${x.type === 'KAP' ? 'KAP' : 'Haber'}</span>
          <span>${fmtTime(x.item.pubDate)}</span>
        </div>
      </div>
    `).join('');
  }

  // ===== Teknik Analiz sekmesi =====
  let taChartObj = null;
  let taSeries = {};
  let taCandleSeries = null;   // Fibonacci fiyat çizgileri bunun üzerine kurulur
  let taFibLines = [];         // grafikte o an duran Fib PriceLine nesneleri
  let taFibDefs = [];          // Fib çizgi tanımları (gizle/göster için yeniden kurmak)
  let taIndVis = null;         // grafik indikatör göster/gizle durumu (localStorage'da kalıcı)
  let taInited = false;
  let vadeCache = {}; // symbol:market -> 5y günlük mumlar (skorlama için)
  let benchCache = {}; // market -> endeks 5y günlük mumlar (Göreli Güç/RS için)
  let intradayCache = {}; // symbol:market -> { H1, M15, ts } gün içi vade için (~5dk taze)
  let taAdhoc = [];   // aramayla açılan, portföy/izlemede olmayan geçici semboller (oturumluk)
  // Analiz isteği jetonu: sembol/vade hızlı değişince (ör. sekme açılışındaki otomatik
  // yükleme + hemen ardından "altın" araması) yavaş biten eski fetch'in yenisinin
  // panelini EZMESİNİ engeller. Her yeni yükleme jetonu artırır; await sonrası kendi
  // jetonu güncel değilse çizim/panel yazımı iptal edilir.
  let taReqSeq = 0;

  function taAllSymbols() {
    const map = new Map();
    // Evren yalnızca "evrene dahil" listelerden türer; her biri kendi liste adı altında gruplanır.
    loadLists().forEach(l => {
      if (l.inUniverse === false) return;
      (l.items || []).forEach(p => {
        const k = p.market + ':' + p.symbol;
        if (!map.has(k)) map.set(k, { symbol: p.symbol, market: p.market, group: l.name || 'Liste' });
      });
    });
    taAdhoc.forEach(p => {
      const k = p.market + ':' + p.symbol;
      if (!map.has(k)) map.set(k, { symbol: p.symbol, market: p.market, group: 'Arama' });
    });
    return [...map.values()];
  }

  // taSymbol / faSymbol seçicileri için optgroup'lu <option> listesi kur (seçimi korur)
  function buildSymbolOptions(sel) {
    if (!sel) return;
    const prev = sel.value;
    const groups = {};
    taAllSymbols().forEach(s => { (groups[s.group] = groups[s.group] || []).push(s); });
    sel.innerHTML = Object.entries(groups).map(([g, items]) =>
      `<optgroup label="${g}">` +
      items.map(s => `<option value="${s.market}:${s.symbol}">${s.symbol} · ${s.market}</option>`).join('') +
      `</optgroup>`
    ).join('');
    if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  }
  // Portföy/Liste değişince teknik + temel analiz seçicilerini güncelle
  function refreshSymbolSelectors() {
    if (taInited) buildSymbolOptions(document.getElementById('taSymbol'));
    if (faInited) buildSymbolOptions(document.getElementById('faSymbol'));
  }

  function initTechnical() {
    const sel = document.getElementById('taSymbol');
    if (!sel) return;
    if (!taInited) {
      buildSymbolOptions(sel);
      sel.addEventListener('change', loadTechnical);
      document.getElementById('taRange').addEventListener('change', loadTechnical);
      document.getElementById('taRefresh').addEventListener('click', () => {
        const v = sel.value; if (v) { delete vadeCache[v]; delete intradayCache[v]; } // yenilemede taze veri
        loadTechnical();
      });
      const vadeSel = document.getElementById('taVade');
      if (vadeSel) vadeSel.addEventListener('change', () => {
        const v = sel.value; if (!v) return;
        const [market, symbol] = v.split(':');
        loadVadeScore(symbol, market, vadeSel.value);
      });
      // Serbest arama: portföy/listede olmayan bir hisse için analiz aç
      const searchInput = document.getElementById('taSearch');
      const searchBtn = document.getElementById('taSearchBtn');
      if (searchBtn) searchBtn.addEventListener('click', openTaSearch);
      if (searchInput) {
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') openTaSearch(); });
      }
      // Doğruluk testi (backtest)
      const btBtn = document.getElementById('taBacktestBtn');
      if (btBtn) btBtn.addEventListener('click', () => {
        if (!sel.value) return;
        const [market, symbol] = sel.value.split(':');
        const vd = (document.getElementById('taVade') || {}).value || 'orta';
        runBacktest(symbol, market, vd);
      });
      taInited = true;
    }
    loadTechnical();
  }

  // Aramadan analiz aç: evrensel çözümleyici (hisse/kripto/maden) → geçici sembol + yükle.
  async function openTaSearch() {
    const inp = document.getElementById('taSearch');
    const sel = document.getElementById('taSymbol');
    if (!inp || !sel) return;
    const raw = (inp.value || '').trim();
    if (raw.length < 1) return;
    const flashErr = (m) => { inp.style.borderColor = 'var(--red)'; inp.title = m || ''; setTimeout(() => { inp.style.borderColor = ''; }, 1500); };
    const prev = inp.value; inp.value = 'Aranıyor…'; inp.disabled = true;
    let c = null; try { c = await resolveOne(raw); } catch (e) {}
    inp.disabled = false; inp.value = prev;
    if (!c) { flashErr('Hisse, kripto ya da maden bulunamadı.'); return; }
    const k = candKey(c); if (!k) return;
    const key = k.market + ':' + k.symbol;
    const known = taAllSymbols().some(s => s.market === k.market && s.symbol === k.symbol);
    if (!known && !taAdhoc.some(s => s.market === k.market && s.symbol === k.symbol)) {
      taAdhoc.push({ symbol: k.symbol, market: k.market });
    }
    buildSymbolOptions(sel);
    sel.value = key;
    inp.value = '';
    loadTechnical();
  }

  function taShowMsg(msg) {
    const el = document.getElementById('taChartMsg');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  async function loadTechnical() {
    const sel = document.getElementById('taSymbol');
    const rangeSel = document.getElementById('taRange');
    if (!sel || !sel.value) return;
    const [market, symbol] = sel.value.split(':');
    const range = rangeSel.value;
    const indWrap = document.getElementById('taIndicators');
    const myReq = ++taReqSeq; // bu yüklemenin jetonu

    if (typeof LightweightCharts === 'undefined') {
      taShowMsg('Grafik kütüphanesi yüklenemedi (internet gerekli).');
      indWrap.innerHTML = '';
      return;
    }
    taShowMsg('Yükleniyor…');
    indWrap.innerHTML = '';

    let data;
    try {
      data = await fetchYahooOHLC(symbol, market, range, '1d');
    } catch (e) {
      if (myReq !== taReqSeq) return; // sembol değişti — bu hatayı gösterme
      taShowMsg('Veri alınamadı. Tekrar dene.');
      return;
    }
    if (myReq !== taReqSeq) return; // arada başka sembol seçildi — eski veriyi çizme
    const candles = data.candles;
    if (candles.length < 30) { taShowMsg('Yeterli veri yok.'); return; }
    taShowMsg('');

    const closes  = candles.map(c => c.close);
    const highs   = candles.map(c => c.high);
    const lows    = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const times   = candles.map(c => c.time);
    const lineData = (arr) => arr.map((v, i) => v == null ? null : { time: times[i], value: v })
                                 .filter(Boolean);
    // Değeri ileriye (geleceğe) kaydır — Ichimoku bulutu için
    const step = times.length > 1 ? (times[times.length - 1] - times[times.length - 2]) : 86400;
    const shiftFwd = (arr, k) => {
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] == null) continue;
        const ti = i + k;
        const t = ti < times.length ? times[ti] : times[times.length - 1] + step * (ti - (times.length - 1));
        out.push({ time: t, value: arr[i] });
      }
      return out;
    };

    const ema20  = calcEMA(closes, 20);
    const sma50  = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);
    const boll   = calcBollinger(closes, 20, 2);
    const rsiArr = calcRSI(closes, 14);
    const macd   = calcMACD(closes, 12, 26, 9);
    const adx    = calcADX(highs, lows, closes, 14);
    const stoch  = calcStochastic(highs, lows, closes, 14, 3, 3);
    const atr    = calcATR(highs, lows, closes, 14);
    const obv    = calcOBV(closes, volumes);
    const ichi   = calcIchimoku(highs, lows, closes);
    const fib    = calcFibonacci(highs, lows);
    const vprof  = calcVolumeProfile(candles, 24);
    const oflow  = calcOrderFlow(candles, 14);

    drawTAChart(candles, { ema20, sma50, sma200, boll, ichi, fib, times, lineData, shiftFwd });
    renderTAIndicators(symbol, market, closes, { ema20, sma50, sma200, boll, rsiArr, macd, adx, stoch, atr, obv, ichi, fib, vprof, oflow, candles });

    const vadeSel = document.getElementById('taVade');
    loadVadeScore(symbol, market, vadeSel ? vadeSel.value : 'orta', myReq);
  }

  // Vade skorunu yükle: 5y günlük veriyi (önbellekli) çek, skoru hesapla ve paneli çiz.
  // Gün içi (intraday) seriler: 60dk (~3 ay) + 15dk (~1 ay). ~5dk önbelleklenir.
  // BIST'te Yahoo gün içi verisi gecikmeli/seyrek olabilir; M15 gelmezse H1 ile skorlanır.
  async function fetchIntradaySeries(symbol, market) {
    const ck = market + ':' + symbol;
    const cached = intradayCache[ck];
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached;
    const [rH1, rM15] = await Promise.allSettled([
      fetchYahooOHLC(symbol, market, '3mo', '60m'),
      fetchYahooOHLC(symbol, market, '1mo', '15m'),
    ]);
    const H1 = rH1.status === 'fulfilled' ? rH1.value.candles : [];
    const M15 = rM15.status === 'fulfilled' ? rM15.value.candles : [];
    const out = { H1, M15, ts: Date.now() };
    intradayCache[ck] = out;
    return out;
  }

  async function loadVadeScore(symbol, market, vade, reqToken) {
    const panel = document.getElementById('taScorePanel');
    if (!panel) return;
    // Doğrudan çağrılarda (vade değişimi vb.) kendi jetonunu üret; loadTechnical'tan
    // gelen jetonla senkron kal ki yavaş biten eski istek yenisinin panelini ezmesin.
    const myReq = reqToken != null ? reqToken : ++taReqSeq;
    const stale = () => myReq !== taReqSeq;
    const btPanel = document.getElementById('taBacktestPanel');
    if (btPanel) btPanel.innerHTML = ''; // sembol/vade değişince eski backtest'i temizle
    panel.innerHTML = '<div class="ta-score-msg loading">Vade skoru hesaplanıyor…</div>';
    const cfg = (window.TA_WEIGHTS || {})[vade];
    let res;
    if (cfg && cfg.intraday) {
      let intr;
      try { intr = await fetchIntradaySeries(symbol, market); }
      catch (e) { if (stale()) return; panel.innerHTML = '<div class="ta-score-msg empty">Gün içi veri alınamadı.</div>'; return; }
      if (stale()) return; // arada başka sembol/vade seçildi
      if (!intr || !intr.H1 || intr.H1.length < 60) {
        panel.innerHTML = `<div class="ta-score-msg empty">${market === 'BIST'
          ? 'BIST için Yahoo gün içi verisi gecikmeli/eksik — yeterli bar toplanamadı. Kısa/orta vadeyi dene.'
          : 'Bu sembol için yeterli gün içi veri yok.'}</div>`;
        return;
      }
      res = computeVadeScore(null, vade, intr);
    } else {
      const ck = market + ':' + symbol;
      let daily = vadeCache[ck];
      if (!daily) {
        try {
          const d = await fetchYahooOHLC(symbol, market, '5y', '1d');
          daily = d.candles;
          vadeCache[ck] = daily;
        } catch (e) {
          if (stale()) return;
          panel.innerHTML = '<div class="ta-score-msg empty">Vade skoru için veri alınamadı.</div>';
          return;
        }
      }
      const bench = await ensureBenchDaily(market); // Göreli Güç (RS) için endeks
      if (stale()) return; // arada başka sembol/vade seçildi — eski skoru çizme
      res = computeVadeScore(daily, vade, undefined, bench);
    }
    if (stale()) return;
    if (!res) { panel.innerHTML = '<div class="ta-score-msg empty">Bu sembol için yeterli geçmiş veri yok.</div>'; return; }
    renderVadeScore(panel, symbol, market, res, vade);
  }

  // Rejim rozeti: RSI/Stokastik'in nasıl okunduğunu (momentum vs geri-dönüş) kullanıcıya göster.
  const TA_REGIME_BADGE = {
    trend:   { txt: '📈 Trend rejimi', tip: 'ADX güçlü & fiyat SMA50>SMA200 üstünde — RSI/Stokastik momentum teyidi olarak okunuyor (RSI 70 “sat” değil).' },
    range:   { txt: '↔️ Yatay rejim', tip: 'ADX zayıf — RSI/Stokastik klasik aşırı alım/satım (geri-dönüş) olarak okunuyor.' },
    neutral: { txt: '· Nötr rejim',   tip: 'Belirgin trend yok — göstergeler varsayılan yorumla okunuyor.' },
  };

  function renderVadeScore(panel, symbol, market, res, vade) {
    const curSym = market === 'BIST' ? '₺' : '$';
    const fmtP = (n) => n == null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const { score, label, cls, breakdown, adxVal, adxF, cfg, levels, regime } = res;
    const sc = Math.round(score);

    const tfNames = { D: 'Günlük', W: 'Haftalık', M: 'Aylık', H1: 'Saatlik', M15: '15 dk' };
    const blendTxt = cfg.blend
      .map(b => `${tfNames[b.tf] || b.tf} %${Math.round(b.w * 100)}`)
      .join(' + ');
    const intradayNote = (cfg.intraday && market === 'BIST')
      ? ' · ⚠ BIST gün içi verisi Yahoo\'da gecikmeli/seyrek olabilir' : '';

    const maxAbs = Math.max(0.1, ...breakdown.map(b => Math.abs(b.contrib)));
    const brkHtml = breakdown.map(b => {
      const pos = b.contrib >= 0;
      const w = Math.abs(b.contrib) / maxAbs * 100;
      return `<div class="ta-brk">
        <span class="ta-brk-name">${b.label}</span>
        <span class="ta-brk-track"><span class="ta-brk-fill ${pos ? 'pos' : 'neg'}" style="width:${w.toFixed(0)}%"></span></span>
        <span class="ta-brk-score">${b.score.toFixed(0)}</span>
        <span class="ta-brk-contrib ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${b.contrib.toFixed(1)}</span>
      </div>`;
    }).join('');

    // Rejim rozeti (RSI/Stokastik okuma modunu açıklar)
    const rb = TA_REGIME_BADGE[regime] || TA_REGIME_BADGE.neutral;
    const regimeHTML = `<span class="ta-regime ${regime}" title="${rb.tip}">${rb.txt}</span>`;

    // Skor gösterge aç/kapa tablosu: kullanıcı bir göstergeyi skordan çıkarabilir; kalanlar
    // otomatik normalize olur. Kapalılar üstü çizili — geri açılabilir. Bu vadenin göstergeleri.
    const indKeys = Object.keys(cfg.weights);
    const totW = indKeys.reduce((a, k) => a + cfg.weights[k], 0) || 1;
    const toggleChips = indKeys.map(k => {
      const on = taScoreIndVis[k] !== false;
      const wPct = Math.round(cfg.weights[k] / totW * 100);
      const desc = (TA_KEY_DESC[k] || '').replace(/"/g, '&quot;');
      return `<button type="button" class="ta-si-chip${on ? '' : ' off'}" data-si="${k}" aria-pressed="${on}" title="${desc}">${TA_KEY_LABEL[k] || k}<em>%${wPct}</em></button>`;
    }).join('');
    const toggleHTML = `
      <div class="ta-score-brk-head">Skor göstergeleri <span>(dokun: skordan çıkar/geri ekle · kalanlar normalize olur)</span></div>
      <div class="ta-si-toggles">${toggleChips}</div>`;

    const lvl = levels;
    const lvlBox = (l, v, c) => `<div class="ta-bs-lvl ${c || ''}"><span>${l}</span><b>${v == null ? '—' : fmtP(v) + ' ' + curSym}</b></div>`;
    const adxTxt = adxVal == null ? 'ADX yok' : `ADX ${adxVal.toFixed(0)} → güven ×${adxF.toFixed(2)}`;
    const fmtRange = (z) => (z && z[0] != null && z[1] != null) ? `${fmtP(z[0])} – ${fmtP(z[1])} ${curSym}` : '—';
    const zoneDist = (z) => { // bandın orta noktasının güncel fiyata uzaklığı (%)
      if (!z || !lvl.price) return '';
      const d = ((z[0] + z[1]) / 2 - lvl.price) / lvl.price * 100;
      return ` <em>${d >= 0 ? '+' : ''}${d.toFixed(1)}%</em>`;
    };

    panel.innerHTML = `
      <div class="ta-score ${cls}">
        <div class="ta-ind-head">
          <span class="ta-ind-title">🎯 Vade Skoru — ${symbol}</span>
          <span class="ta-sig ${cls}">${label}</span>
        </div>
        <div class="ta-score-top">
          <div class="ta-score-num ${cls}">${sc}<span>/100</span></div>
          <div class="ta-score-gaugewrap">
            <div class="ta-score-gauge"><div class="ta-score-mark" style="left:${sc}%"></div></div>
            <div class="ta-score-scale"><span>0 · SAT</span><span>50</span><span>AL · 100</span></div>
          </div>
        </div>
        <div class="ta-score-meta"><b>${cfg.label}</b> · ${cfg.desc} · Karışım: ${blendTxt} · ${adxTxt} · ${regimeHTML}${intradayNote}</div>
        <div class="ta-score-brk-head">Gösterge katkıları <span>(alt-skor · nihai skora puan)</span></div>
        <div class="ta-score-brk">${brkHtml}</div>
        ${toggleHTML}
        <div class="ta-score-brk-head">${cfg.label} fiyat aralıkları <span>(vadeye göre destek / ${lvl.sellKind === 'target' ? 'hedef' : 'direnç'} · ATR bandı · fiyata uzaklık)</span></div>
        <div class="ta-zones">
          <div class="ta-zone buy">
            <span class="ta-zone-l">🟢 ${lvl.sellKind === 'target' ? 'Biriktirme aralığı' : 'Alım aralığı'}${zoneDist(lvl.buyZone)}</span>
            <b>${fmtRange(lvl.buyZone)}</b>
          </div>
          <div class="ta-zone sell">
            <span class="ta-zone-l">${lvl.sellKind === 'target' ? '🎯 Hedef aralığı' : '🔴 Satım aralığı'}${zoneDist(lvl.sellZone)}</span>
            <b>${fmtRange(lvl.sellZone)}</b>
          </div>
        </div>
        <div class="ta-bs-levels">
          ${lvlBox('Güncel fiyat', lvl.price)}
          ${lvlBox('Stop · 2×ATR', lvl.stop, 'stop')}
          ${lvl.poc != null ? lvlBox('POC · hacim yoğ.', lvl.poc) : ''}
          <div class="ta-bs-lvl"><span>Risk / Ödül</span><b>${lvl.rr == null ? '—' : '≈ 1 : ' + lvl.rr.toFixed(1)}</b></div>
        </div>
        <div class="ta-of-disc">${cfg.label} ufku için göstergelerin ağırlıklı matematiksel özeti. 50 üstü alım, altı satım eğilimi. Alım aralığı destek çevresinde; ${lvl.sellKind === 'target' ? 'hedef aralığı bu ufuk için güncel fiyatın belirgin üzerindeki bir direnç/projeksiyon bölgesidir — anlık "sat" değil, uzun vadeli üst hedeftir' : 'satım aralığı en yakın direnç çevresindedir'}. Çapa ve bant vade uzadıkça uzaklaşıp genişler (ATR ölçekli) — sipariş önerisi değil, yön değil "nerede" bilgisidir. Geçmiş fiyat verisine dayanır, gelecek garantisi vermez — yatırım tavsiyesi değildir.</div>
      </div>`;

    // Skor gösterge aç/kapa → durumu kaydet ve skoru yeniden hesapla/çiz
    panel.querySelectorAll('.ta-si-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.si;
        const turningOff = taScoreIndVis[k] !== false;
        // En az bir gösterge açık kalmalı — yoksa skor hesaplanamaz ve panel kaybolur
        if (turningOff && indKeys.filter(x => taScoreIndVis[x] !== false).length <= 1) return;
        setTaScoreInd(k, !turningOff);
        loadVadeScore(symbol, market, vade); // cache'li veri ile hızlı yeniden hesap
      });
    });
  }

  // ---- Grafik indikatör göster/gizle (toggle) ----
  // İndikatörler hepsi birden çizilince "çorba" oluyordu. Artık her grup bir seçenek;
  // tıklanınca teker teker eklenip çıkarılıyor. Durum localStorage'da kalıcı.
  const TA_IND_LS = 'taIndVis';
  const TA_IND_GROUPS = [
    { key: 'ema20',  label: 'EMA 20',    sw: '#2dd4bf', lines: ['ema20'] },
    { key: 'sma50',  label: 'SMA 50',    sw: '#6366f1', lines: ['sma50'] },
    { key: 'sma200', label: 'SMA 200',   sw: '#fbbf24', lines: ['sma200'] },
    { key: 'boll',   label: 'Bollinger', sw: '#8b5cf6', lines: ['bbU', 'bbL'] },
    { key: 'ichi',   label: 'Ichimoku',  sw: '#f472b6', sw2: '#38bdf8', lines: ['tenkan', 'kijun', 'spanA', 'spanB'] },
    { key: 'fib',    label: 'Fibonacci', sw: '#f4b400', fib: true },
  ];
  function loadTAIndVis() {
    // Varsayılan sade grafik: yalnız SMA50 + SMA200 açık, gerisi kapalı.
    const def = { ema20: false, sma50: true, sma200: true, boll: false, ichi: false, fib: false };
    try { const raw = localStorage.getItem(TA_IND_LS); if (raw) return Object.assign(def, JSON.parse(raw)); } catch (_) {}
    return def;
  }
  function saveTAIndVis() { try { localStorage.setItem(TA_IND_LS, JSON.stringify(taIndVis)); } catch (_) {} }
  function setTAIndVisible(key, on) {
    const g = TA_IND_GROUPS.find(x => x.key === key);
    if (!g) return;
    if (g.fib) { // Fib = candle serisi üstünde fiyat çizgileri: göster=kur, gizle=kaldır
      if (on) {
        if (!taFibLines.length && taCandleSeries) taFibDefs.forEach(d => taFibLines.push(taCandleSeries.createPriceLine(d)));
      } else if (taCandleSeries) {
        taFibLines.forEach(pl => { try { taCandleSeries.removePriceLine(pl); } catch (_) {} });
        taFibLines = [];
      }
      return;
    }
    (g.lines || []).forEach(n => { const s = taSeries[n]; if (s) s.applyOptions({ visible: !!on }); });
  }
  function applyTAIndVis() { TA_IND_GROUPS.forEach(g => setTAIndVisible(g.key, !!(taIndVis && taIndVis[g.key]))); }
  function buildTAToggles() {
    const legend = document.getElementById('taLegend');
    if (!legend) return;
    const chips = TA_IND_GROUPS.map(g => {
      const on = !!(taIndVis && taIndVis[g.key]);
      const sw2 = g.sw2 ? `<i style="background:${g.sw2};margin-left:-3px"></i>` : '';
      return `<button type="button" class="ta-leg ta-leg-btn${on ? '' : ' off'}" data-ind="${g.key}" aria-pressed="${on}"><i style="background:${g.sw}"></i>${sw2}${g.label}</button>`;
    }).join('');
    legend.innerHTML =
      `<span class="ta-leg-hint">Göster/gizle:</span>` + chips +
      `<span class="ta-leg ta-leg-static"><i style="background:#22d39a"></i><i style="background:#ff5e7e;margin-left:-3px"></i>Mum ↑/↓</span>`;
    legend.querySelectorAll('.ta-leg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.ind;
        taIndVis[k] = !taIndVis[k];
        const on = !!taIndVis[k];
        btn.classList.toggle('off', !on);
        btn.setAttribute('aria-pressed', String(on));
        setTAIndVisible(k, on);
        saveTAIndVis();
      });
    });
  }

  function drawTAChart(candles, ind) {
    const wrap = document.getElementById('taChart');
    if (taChartObj) { taChartObj.remove(); taChartObj = null; taSeries = {}; }
    wrap.innerHTML = '';
    const chart = LightweightCharts.createChart(wrap, {
      width: wrap.clientWidth,
      height: 360,
      layout: { background: { color: 'transparent' }, textColor: '#7a8299', fontFamily: 'inherit' },
      grid: { vertLines: { color: 'rgba(35,42,68,0.5)' }, horzLines: { color: 'rgba(35,42,68,0.5)' } },
      rightPriceScale: { borderColor: '#232a44' },
      timeScale: { borderColor: '#232a44', timeVisible: false },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    });
    taChartObj = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22d39a', downColor: '#ff5e7e',
      wickUpColor: '#22d39a', wickDownColor: '#ff5e7e',
      borderVisible: false,
    });
    candleSeries.setData(candles);
    taCandleSeries = candleSeries;

    // Fibonacci geri çekilme seviyeleri — tanımları sakla; göster/gizle görünürlükte kurulur.
    taFibLines = [];
    taFibDefs = [];
    if (ind.fib) {
      ind.fib.levels.forEach(l => {
        if (l.ratio === 0 || l.ratio === 1) return; // uç noktalar zaten zirve/dip
        taFibDefs.push({
          price: l.price,
          color: 'rgba(244,180,0,0.45)',
          lineWidth: 1,
          lineStyle: 2, // kesikli
          axisLabelVisible: true,
          title: 'Fib ' + (l.ratio * 100).toFixed(1) + '%',
        });
      });
    }

    const addLine = (data, color, width = 2) => {
      const s = chart.addLineSeries({ color, lineWidth: width, priceLineVisible: false, lastValueVisible: false });
      s.setData(data);
      return s;
    };
    taSeries.ema20  = addLine(ind.lineData(ind.ema20),  '#2dd4bf', 1.5);
    taSeries.sma50  = addLine(ind.lineData(ind.sma50),  '#6366f1');
    taSeries.sma200 = addLine(ind.lineData(ind.sma200), '#fbbf24');
    taSeries.bbU    = addLine(ind.lineData(ind.boll.upper), 'rgba(139,92,246,0.55)', 1);
    taSeries.bbL    = addLine(ind.lineData(ind.boll.lower), 'rgba(139,92,246,0.55)', 1);

    // Ichimoku — Tenkan / Kijun + ileri kaydırılmış bulut (Senkou A/B)
    if (ind.ichi) {
      taSeries.tenkan = addLine(ind.lineData(ind.ichi.tenkan), '#f472b6', 1.5);
      taSeries.kijun  = addLine(ind.lineData(ind.ichi.kijun),  '#38bdf8', 1.5);
      try {
        taSeries.spanA = addLine(ind.shiftFwd(ind.ichi.senkouA, ind.ichi.base), 'rgba(34,211,154,0.45)', 1);
        taSeries.spanB = addLine(ind.shiftFwd(ind.ichi.senkouB, ind.ichi.base), 'rgba(255,94,126,0.45)', 1);
      } catch (e) { /* bulut çizilemezse grafik yine de çalışır */ }
    }

    // İndikatörler artık tek tek eklenen seçenekler: kayıtlı durumu uygula + toggle'ları kur.
    if (!taIndVis) taIndVis = loadTAIndVis();
    applyTAIndVis();
    buildTAToggles();

    chart.timeScale().fitContent();
    if (!window.__taResizeBound) {
      window.addEventListener('resize', () => {
        const w = document.getElementById('taChart');
        if (taChartObj && w) taChartObj.applyOptions({ width: w.clientWidth });
      });
      window.__taResizeBound = true;
    }
  }

  // ===== Doğruluk testi (backtest) =====
  // Her tarihsel barda skoru YALNIZ o güne kadarki veriyle hesaplar (look-ahead yok),
  // vadeye uygun ileri getiriyle eşler ve öngörü gücünü ölçer.
  const TA_HORIZON = { kisa: 10, orta: 45, uzun: 120, gunici: 14 }; // ileri getiri ufku (bar)
  // Vadeye göre backtest parametreleri. gunici: saatlik seri, H1 tek-zaman yaklaşımı.
  const BT_CFG = {
    kisa:   { warmup: 210, stride: 5 },
    orta:   { warmup: 210, stride: 5 },
    uzun:   { warmup: 210, stride: 5 },
    gunici: { warmup: 120, stride: 3, intraday: true },
  };

  function spearmanIC(a, b) {
    const n = a.length;
    if (n < 3) return 0;
    const rank = (arr) => {
      const idx = arr.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
      const r = new Array(n);
      for (let k = 0; k < n; k++) r[idx[k][1]] = k;
      return r;
    };
    const ra = rank(a), rb = rank(b), m = (n - 1) / 2;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const x = ra[i] - m, y = rb[i] - m; num += x * y; da += x * x; db += y * y; }
    return (da && db) ? num / Math.sqrt(da * db) : 0;
  }

  async function computeBacktest(series, vade) {
    const H = TA_HORIZON[vade] || 45;
    const p = BT_CFG[vade] || { warmup: 210, stride: 5 };
    const warmup = p.warmup, stride = p.stride, intraday = !!p.intraday, n = series.length;
    if (n < warmup + H + 40) return null;
    const closes = series.map(c => c.close);
    const samples = [];
    let iter = 0;
    for (let i = warmup; i + H < n; i += stride) {
      // intraday: canlı H1+M15 karışımı yerine H1 tek-zaman (M15 tarihsel hizalama zor);
      // aynı normalize/ağırlık mantığı, yaklaşık ama look-ahead'siz.
      const r = intraday
        ? computeVadeScore(null, vade, { H1: series.slice(0, i + 1), M15: null })
        : computeVadeScore(series.slice(0, i + 1), vade);
      if (r) samples.push({ i, score: r.score, fwd: closes[i + H] / closes[i] - 1 });
      if (++iter % 40 === 0) await new Promise(res => setTimeout(res)); // UI'yı bloklama
    }
    if (samples.length < 12) return null;

    const baseUp = samples.filter(s => s.fwd > 0).length / samples.length;
    const al = samples.filter(s => s.score >= 55), sat = samples.filter(s => s.score <= 45);
    const alHit = al.length ? al.filter(s => s.fwd > 0).length / al.length : null;
    const satHit = sat.length ? sat.filter(s => s.fwd < 0).length / sat.length : null;
    const dir = samples.filter(s => s.score >= 52 || s.score <= 48);
    const dirHit = dir.length ? dir.filter(s => (s.score > 50) === (s.fwd > 0)).length / dir.length : null;

    const bucketDefs = [
      { lo: 0, hi: 40, label: '0–40 · güçlü SAT' },
      { lo: 40, hi: 48, label: '40–48 · SAT' },
      { lo: 48, hi: 52, label: '48–52 · nötr' },
      { lo: 52, hi: 60, label: '52–60 · AL' },
      { lo: 60, hi: 100.01, label: '60–100 · güçlü AL' },
    ];
    const buckets = bucketDefs.map(b => {
      const xs = samples.filter(s => s.score >= b.lo && s.score < b.hi);
      return { label: b.label, n: xs.length,
        avg: xs.length ? xs.reduce((a, s) => a + s.fwd, 0) / xs.length : null,
        pos: xs.length ? xs.filter(s => s.fwd > 0).length / xs.length : null };
    });
    const validB = buckets.filter(b => b.n >= 5 && b.avg != null);
    let monotonic = validB.length >= 2;
    for (let k = 1; k < validB.length; k++) if (validB[k].avg < validB[k - 1].avg - 1e-9) monotonic = false;

    const ic = spearmanIC(samples.map(s => s.score), samples.map(s => s.fwd));

    // basit strateji: skor>55 long, <45 flat (histerezis), %0.1 durum-değişim maliyeti
    let pos = 0, switches = 0, stratEq = 1, bhEq = 1, peak = 1, mdd = 0, wins = 0, longIv = 0;
    const perRet = [], cost = 0.001;
    for (let k = 0; k < samples.length - 1; k++) {
      const sc = samples[k].score;
      let np = pos;
      if (sc > 55) np = 1; else if (sc < 45) np = 0;
      if (np !== pos) { stratEq *= (1 - cost); switches++; }
      pos = np;
      const rr = closes[samples[k + 1].i] / closes[samples[k].i] - 1;
      bhEq *= (1 + rr);
      if (pos === 1) { stratEq *= (1 + rr); perRet.push(rr); longIv++; if (rr > 0) wins++; } else perRet.push(0);
      if (stratEq > peak) peak = stratEq;
      const dd = (peak - stratEq) / peak; if (dd > mdd) mdd = dd;
    }
    const mean = perRet.reduce((a, b) => a + b, 0) / (perRet.length || 1);
    const sd = Math.sqrt(perRet.reduce((a, b) => a + (b - mean) ** 2, 0) / (perRet.length || 1)) || 1e-9;
    const barsPerYear = intraday ? 1638 : 252; // ~6.5 saatlik bar/gün × 252
    const sharpe = mean / sd * Math.sqrt(barsPerYear / stride);

    return { H, stride, warmup, intraday, nSamples: samples.length, baseUp,
      alN: al.length, alHit, satN: sat.length, satHit, dirN: dir.length, dirHit,
      buckets, monotonic, ic, stratRet: stratEq - 1, bhRet: bhEq - 1, sharpe, mdd,
      switches, winRate: longIv ? wins / longIv : null, longIv };
  }

  async function runBacktest(symbol, market, vade) {
    const panel = document.getElementById('taBacktestPanel');
    if (!panel) return;
    panel.innerHTML = '<div class="ta-score-msg loading">Backtest çalışıyor… geçmiş taranıyor (birkaç saniye).</div>';
    // Sonuç skor panelinin altına düştüğü için görünmez kalıyordu — çalışırken paneli görüş alanına al.
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const cfg = (window.TA_WEIGHTS || {})[vade];
    let series;
    if (cfg && cfg.intraday) {
      try { const intr = await fetchIntradaySeries(symbol, market); series = intr.H1; }
      catch (e) { panel.innerHTML = '<div class="ta-score-msg empty">Gün içi backtest için veri alınamadı.</div>'; return; }
      if (!series || series.length < 180) {
        panel.innerHTML = '<div class="ta-score-msg empty">Gün içi backtest için yeterli geçmiş yok (Yahoo saatlik veri ~3 ay ile sınırlı).</div>';
        return;
      }
    } else {
      const ck = market + ':' + symbol;
      series = vadeCache[ck];
      if (!series) {
        try { const d = await fetchYahooOHLC(symbol, market, '5y', '1d'); series = d.candles; vadeCache[ck] = series; }
        catch (e) { panel.innerHTML = '<div class="ta-score-msg empty">Backtest için veri alınamadı.</div>'; return; }
      }
    }
    let res;
    try { res = await computeBacktest(series, vade); }
    catch (e) { panel.innerHTML = '<div class="ta-score-msg empty">Backtest sırasında hata oluştu.</div>'; return; }
    if (!res) { panel.innerHTML = '<div class="ta-score-msg empty">Backtest için yeterli geçmiş veri yok (daha uzun geçmişi olan bir hisse dene).</div>'; return; }
    renderBacktest(panel, symbol, market, vade, res);
  }

  function renderBacktest(panel, symbol, market, vade, r) {
    const pct = (x) => x == null ? '—' : (x * 100).toFixed(1) + '%';
    const pp = (x) => x == null ? '—' : (x >= 0 ? '+' : '') + (x * 100).toFixed(1) + '%';
    const box = (l, v, c) => `<div class="ta-bs-lvl ${c || ''}"><span>${l}</span><b>${v}</b></div>`;
    const vadeLabel = (window.TA_WEIGHTS && window.TA_WEIGHTS[vade] && window.TA_WEIGHTS[vade].label) || vade;
    const hUnit = r.intraday ? 'saatlik bar' : 'işlem günü';
    const dataDesc = r.intraday ? '≈3 ay saatlik · H1 tek-zaman' : '5y günlük';
    const btNote = r.intraday
      ? 'Gün içi test, saatlik (H1) tek-zaman yaklaşımıyla ve Yahoo\'nun ~3 aylık gün içi geçmişiyle hesaplandı — örneklem penceresi dardır, canlı skor H1+15dk karışımı kullanır. '
      : 'Tek hisse + 5 yıllık veriyle hesaplandı; bağımsız örnek sayısı sınırlıdır (özellikle uzun vadede getiriler örtüşür). ';

    let verdict, vcls;
    if (r.nSamples < 25) { verdict = 'Örneklem küçük — güvenilmez'; vcls = 'neutral'; }
    else if (r.ic >= 0.08 && r.monotonic) { verdict = 'İyi — skor getiriyle tutarlı'; vcls = 'bull'; }
    else if (r.ic >= 0.03) { verdict = 'Orta — zayıf ama pozitif'; vcls = 'bull'; }
    else if (r.ic > -0.03) { verdict = 'Zayıf — belirgin öngörü yok'; vcls = 'neutral'; }
    else { verdict = 'Negatif — bu örneklemde ters'; vcls = 'bear'; }

    const maxAbs = Math.max(0.001, ...r.buckets.map(b => Math.abs(b.avg || 0)));
    const bucketRows = r.buckets.map(b => {
      if (!b.n) return `<div class="ta-bt-row is-empty"><span class="ta-bt-b">${b.label}</span><span class="ta-bt-n">0</span><span class="ta-bt-bar"></span><span class="ta-bt-v">—</span></div>`;
      const w = Math.abs(b.avg) / maxAbs * 100, pos = b.avg >= 0;
      return `<div class="ta-bt-row">
        <span class="ta-bt-b">${b.label}</span>
        <span class="ta-bt-n">n=${b.n}</span>
        <span class="ta-bt-bar"><span class="ta-bt-fill ${pos ? 'pos' : 'neg'}" style="width:${w.toFixed(0)}%"></span></span>
        <span class="ta-bt-v ${pos ? 'pos' : 'neg'}">${pp(b.avg)} · %${b.pos == null ? '—' : (b.pos * 100).toFixed(0)}↑</span></div>`;
    }).join('');

    panel.innerHTML = `
      <div class="ta-score ${vcls} ta-bt">
        <div class="ta-ind-head">
          <span class="ta-ind-title">🔬 Doğruluk Testi — ${symbol}</span>
          <span class="ta-sig ${vcls}">${verdict}</span>
        </div>
        <div class="ta-score-meta">${vadeLabel} · ileri ufuk <b>${r.H} ${hUnit}</b> · ${r.nSamples} örnek · ${dataDesc} · look-ahead yok</div>
        <div class="ta-score-brk-head">Öngörü metrikleri</div>
        <div class="ta-bs-levels">
          ${box('Yönsel isabet', pct(r.dirHit) + (r.dirN ? ` · ${r.dirN}×` : ''))}
          ${box('AL isabeti', pct(r.alHit) + (r.alN ? ` · ${r.alN}×` : ''), 'tgt')}
          ${box('SAT isabeti', pct(r.satHit) + (r.satN ? ` · ${r.satN}×` : ''))}
          ${box('Baz oran (↑)', pct(r.baseUp))}
          ${box('IC · Spearman', r.ic.toFixed(3), r.ic >= 0.03 ? 'tgt' : (r.ic <= -0.03 ? 'stop' : ''))}
        </div>
        <div class="ta-score-brk-head">Skor kovasına göre ort. ${r.H} ${hUnit} ileri getiri <span>(sağlıklıysa yukarı doğru artar)</span></div>
        <div class="ta-bt-table">${bucketRows}</div>
        <div class="ta-score-brk-head">Basit strateji vs al-tut <span>(skor>55 al · &lt;45 çık · %0.1 maliyet)</span></div>
        <div class="ta-bs-levels">
          ${box('Strateji', pp(r.stratRet), r.stratRet >= r.bhRet ? 'tgt' : '')}
          ${box('Al-tut', pp(r.bhRet))}
          ${box('Sharpe', r.sharpe.toFixed(2))}
          ${box('Maks. düşüş', pct(r.mdd), 'stop')}
          ${box('İşlem', String(r.switches))}
        </div>
        <div class="ta-of-disc">${btNote}Bu hisseye ve döneme özeldir. Ağırlıklar geçmişe uydurulmadı (elle konuldu), bu yüzden dürüst bir kontroldür ama geçmiş performans gelecek garantisi değildir. Yatırım tavsiyesi değildir.</div>
      </div>`;
  }

  // Son bardaki mum (candlestick) formasyonunu tespit eder — trend bağlamıyla.
  // Formasyon tek başına AL/SAT değildir; trendin ucunda "olası dönüş/teyit" öncüsüdür.
  // Döner: { name, sig, txt } | null
  function detectCandlePattern(candles) {
    if (!candles || candles.length < 8) return null;
    const n = candles.length, c = candles[n - 1], p = candles[n - 2];
    if (!c || !p || c.open == null || p.open == null) return null;
    const body = (x) => Math.abs(x.close - x.open);
    const range = (x) => x.high - x.low;
    const up = (x) => x.close > x.open, down = (x) => x.close < x.open;
    const upSh = (x) => x.high - Math.max(x.open, x.close);   // üst fitil
    const loSh = (x) => Math.min(x.open, x.close) - x.low;    // alt fitil
    const cB = body(c), cR = range(c) || 1e-9, pB = body(p) || 1e-9;
    // Önceki kısa vadeli eğilim (formasyon bağlamı): son ~6 bar
    const ref = candles[n - 7] ? candles[n - 7].close : candles[0].close;
    const prior = p.close;
    const downTrend = prior < ref * 0.985;   // ~%1.5+ düşüş sonrası
    const upTrend = prior > ref * 1.015;      // ~%1.5+ yükseliş sonrası
    const pMid = (p.open + p.close) / 2;

    // Öncelik: güçlü çift-bar formasyonları > harami > tek-bar fitil
    // 1) Yutan Boğa (Bullish Engulfing) — düşüş ucunda dönüş
    if (down(p) && up(c) && c.close >= p.open && c.open <= p.close && cB > pB * 0.9) {
      return { name: 'Yutan Boğa (Bullish Engulfing)', sig: downTrend ? 'bull' : 'neutral',
        txt: `Bugünkü yeşil mum, dünkü kırmızı mumun gövdesini tümüyle yutuyor — alıcılar kontrolü ele aldı.${downTrend ? ' Düşüş sonrası geldiği için <b>olası dip dönüşü</b> öncüsü; teyit için ertesi bar yükselişi beklenir.' : ' Trend bağlamı zayıf (belirgin düşüş öncesi yok) — teyit gücü sınırlı.'}` };
    }
    // 2) Yutan Ayı (Bearish Engulfing) — yükseliş ucunda dönüş
    if (up(p) && down(c) && c.open >= p.close && c.close <= p.open && cB > pB * 0.9) {
      return { name: 'Yutan Ayı (Bearish Engulfing)', sig: upTrend ? 'bear' : 'neutral',
        txt: `Bugünkü kırmızı mum, dünkü yeşil mumun gövdesini tümüyle yutuyor — satıcılar kontrolü aldı.${upTrend ? ' Yükseliş sonrası geldiği için <b>olası tepe dönüşü</b> öncüsü.' : ' Belirgin yükseliş öncesi yok — teyit gücü sınırlı.'}` };
    }
    // 3) Kara Bulut Örtüsü (Dark Cloud Cover) — yükselişte dönüş
    if (up(p) && down(c) && c.open > p.high && c.close < pMid && c.close > p.open) {
      return { name: 'Kara Bulut Örtüsü (Dark Cloud Cover)', sig: upTrend ? 'bear' : 'neutral',
        txt: `Fiyat dünkü zirvenin üstünde açılıp gün içinde dünkü gövdenin ortasının altına kapandı — alım iştahı gün içinde kırıldı.${upTrend ? ' Yükseliş ucunda <b>zayıflama/dönüş</b> sinyali.' : ''}` };
    }
    // 4) Delici Hat (Piercing Line) — düşüşte dönüş
    if (down(p) && up(c) && c.open < p.low && c.close > pMid && c.close < p.open) {
      return { name: 'Delici Hat (Piercing Line)', sig: downTrend ? 'bull' : 'neutral',
        txt: `Fiyat dünkü dibin altında açılıp dünkü gövdenin ortasının üstüne kapandı — satış paniği alıcılarla karşılandı.${downTrend ? ' Düşüş ucunda <b>olası dip dönüşü</b>.' : ''}` };
    }
    // 5) Boğa Harami — büyük kırmızı sonrası küçük yeşil, önceki gövde içinde
    if (down(p) && up(c) && cB < pB * 0.6 && c.open >= p.close && c.close <= p.open) {
      return { name: 'Boğa Harami (Bullish Harami)', sig: downTrend ? 'bull' : 'neutral',
        txt: `Büyük düşüş mumunun ardından gövdesi içinde kalan küçük yeşil mum — satış ivmesi durakladı, kararsızlık.${downTrend ? ' Düşüş ucunda <b>olası dönüş</b>; teyit için kırılım beklenir.' : ''}` };
    }
    // 6) Ayı Harami — büyük yeşil sonrası küçük kırmızı, önceki gövde içinde
    if (up(p) && down(c) && cB < pB * 0.6 && c.open <= p.close && c.close >= p.open) {
      return { name: 'Ayı Harami (Bearish Harami)', sig: upTrend ? 'bear' : 'neutral',
        txt: `Büyük yükseliş mumunun ardından gövdesi içinde kalan küçük kırmızı mum — alış ivmesi durakladı.${upTrend ? ' Yükseliş ucunda <b>olası dönüş</b> uyarısı.' : ''}` };
    }
    // 7) Çekiç (Hammer) — küçük gövde tepede, uzun alt fitil, düşüş ucunda
    if (loSh(c) >= cB * 2 && upSh(c) <= cB * 0.7 && cB <= cR * 0.4) {
      return { name: 'Çekiç (Hammer)', sig: downTrend ? 'bull' : 'neutral',
        txt: `Uzun alt fitil + küçük gövde — gün içinde satıcılar bastırdı ama alıcılar fiyatı geri topladı.${downTrend ? ' Düşüş ucunda <b>dip arayışı/dönüş</b> öncüsü; teyit için ertesi gün yükselişi.' : ' Belirgin düşüş öncesi yoksa anlamı zayıftır.'}` };
    }
    // 8) Kayan Yıldız (Shooting Star) — küçük gövde altta, uzun üst fitil, yükseliş ucunda
    if (upSh(c) >= cB * 2 && loSh(c) <= cB * 0.7 && cB <= cR * 0.4) {
      return { name: 'Kayan Yıldız (Shooting Star)', sig: upTrend ? 'bear' : 'neutral',
        txt: `Uzun üst fitil + küçük gövde — alıcılar yukarı denedi ama satıcılar fiyatı geri itti.${upTrend ? ' Yükseliş ucunda <b>tepe/dönüş</b> uyarısı.' : ' Belirgin yükseliş öncesi yoksa anlamı zayıftır.'}` };
    }
    return null;
  }

  function renderTAIndicators(symbol, market, closes, ind) {
    const last = closes.length - 1;
    const price = closes[last];
    const curSym = market === 'BIST' ? '₺' : '$';
    const fmtP = (n) => n == null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const pct = (a, b) => b ? ((a - b) / b * 100) : null;          // a'nın b'ye göre % uzaklığı
    const fmtPct = (n) => n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    const cards = [];
    let bull = 0, bear = 0;
    const note = (sig) => { if (sig === 'bull') bull++; else if (sig === 'bear') bear++; };

    // ---- 1) Trend: EMA20 / SMA50 / SMA200 ----
    const e20 = ind.ema20[last], s50 = ind.sma50[last], s200 = ind.sma200[last];
    let trendSig = 'neutral', trendTxt = 'Yeterli veri yok (SMA200 için ~1 yıl geçmiş gerekir; daha uzun dönem seç).';
    if (s50 != null && s200 != null) {
      const dist200 = pct(price, s200);
      const golden = s50 > s200;
      const aboveBoth = price > s50 && price > s200;
      const belowBoth = price < s50 && price < s200;
      if (golden && aboveBoth) { trendSig = 'bull'; trendTxt = `Sıralama EMA20 > SMA50 (${fmtP(s50)}) > SMA200 (${fmtP(s200)}) ve fiyat hepsinin üzerinde — sağlıklı yükseliş trendi (golden cross düzeni). Fiyat 200 günlük ortalamanın ${fmtPct(dist200)} üzerinde.`; }
      else if (!golden && belowBoth) { trendSig = 'bear'; trendTxt = `SMA50 (${fmtP(s50)}) < SMA200 (${fmtP(s200)}) ve fiyat ikisinin de altında — düşüş trendi (death cross düzeni). Fiyat 200 günlük ortalamanın ${fmtPct(dist200)} altında.`; }
      else if (golden && !aboveBoth) { trendSig = 'neutral'; trendTxt = `Ana trend yukarı (SMA50 > SMA200) ama fiyat ortalamalara geri çekilmiş — trend içi düzeltme; SMA50 (${fmtP(s50)}) destek olarak izlenmeli.`; }
      else { trendSig = 'neutral'; trendTxt = `Karışık görünüm: SMA50 ${fmtP(s50)}, SMA200 ${fmtP(s200)}. Fiyat ortalamalar arasında sıkışmış, net yön yok.`; }
    } else if (s50 != null) {
      if (price > s50) { trendSig = 'bull'; trendTxt = `Fiyat SMA50'nin (${fmtP(s50)}) ${fmtPct(pct(price, s50))} üzerinde — kısa-orta vade pozitif. (SMA200 için daha uzun dönem seç.)`; }
      else { trendSig = 'bear'; trendTxt = `Fiyat SMA50'nin (${fmtP(s50)}) ${fmtPct(pct(price, s50))} altında — kısa-orta vade negatif.`; }
    }
    note(trendSig);
    cards.push({ title: 'Trend · Hareketli Ort.', val: `${fmtP(price)} ${curSym}`, sig: trendSig, txt: trendTxt });

    // ---- 2) ADX (14) — trend gücü ----
    const adxV = ind.adx.adx[last], pdi = ind.adx.plusDI[last], mdi = ind.adx.minusDI[last];
    let adxSig = 'neutral', adxTxt = 'Yeterli veri yok.';
    if (adxV != null && pdi != null && mdi != null) {
      const dir = pdi > mdi ? 'yukarı' : 'aşağı';
      let strength;
      if (adxV >= 40) strength = 'çok güçlü';
      else if (adxV >= 25) strength = 'güçlü';
      else if (adxV >= 20) strength = 'gelişen';
      else strength = 'zayıf / yatay';
      if (adxV >= 25 && pdi > mdi) { adxSig = 'bull'; adxTxt = `ADX ${adxV.toFixed(0)} — ${strength} bir trend var ve +DI (${pdi.toFixed(0)}) > -DI (${mdi.toFixed(0)}), yön ${dir}. Trend takip stratejileri anlamlı.`; }
      else if (adxV >= 25 && mdi > pdi) { adxSig = 'bear'; adxTxt = `ADX ${adxV.toFixed(0)} — ${strength} düşüş trendi; -DI (${mdi.toFixed(0)}) > +DI (${pdi.toFixed(0)}). Satış baskısı baskın.`; }
      else { adxSig = 'neutral'; adxTxt = `ADX ${adxV.toFixed(0)} — trend ${strength}. Yatay/range piyasada trend sinyallerine değil, RSI/Stokastik gibi salınım göstergelerine güven.`; }
    }
    note(adxSig);
    cards.push({ title: 'ADX (14) · Trend Gücü', val: adxV == null ? '—' : adxV.toFixed(0), sig: adxSig, txt: adxTxt });

    // ---- 3) RSI (14) — momentum ----
    const rsi = ind.rsiArr[last], rsiPrev = ind.rsiArr[last - 3];
    let rsiSig = 'neutral', rsiTxt = '';
    if (rsi != null) {
      const slope = rsiPrev != null ? (rsi - rsiPrev) : 0;
      const dirTxt = slope > 1 ? ' ve yükseliyor' : slope < -1 ? ' ve düşüyor' : '';
      if (rsi >= 70) { rsiSig = 'bear'; rsiTxt = `RSI ${rsi.toFixed(0)} — aşırı alım bölgesi${dirTxt}. Güçlü trendlerde uzun kalabilir, ama kısa vadede kâr satışı/geri çekilme riski yüksek.`; }
      else if (rsi <= 30) { rsiSig = 'bull'; rsiTxt = `RSI ${rsi.toFixed(0)} — aşırı satım bölgesi${dirTxt}. Tepki yükselişi için zemin oluşuyor olabilir.`; }
      else if (rsi >= 55) { rsiSig = 'bull'; rsiTxt = `RSI ${rsi.toFixed(0)} — pozitif momentum bölgesi${dirTxt}, alıcılar hâkim ama aşırı alım değil.`; }
      else if (rsi <= 45) { rsiSig = 'bear'; rsiTxt = `RSI ${rsi.toFixed(0)} — negatif momentum bölgesi${dirTxt}, satıcılar hâkim.`; }
      else { rsiTxt = `RSI ${rsi.toFixed(0)} — nötr bölge (45–55)${dirTxt}, belirgin yön baskısı yok.`; }
      // Uyumsuzluk (divergence): fiyat–RSI ayrışması olası dönüş öncüsü. Son 14 mumluk pencere.
      if (last >= 14) {
        const pWin = closes.slice(last - 13, last + 1);
        const rWin = ind.rsiArr.slice(last - 13, last + 1).filter(x => x != null);
        if (rWin.length > 6) {
          const priceLo = closes[last] <= Math.min(...pWin) * 1.001;
          const priceHi = closes[last] >= Math.max(...pWin) * 0.999;
          if (priceLo && rsi > Math.min(...rWin) + 5) {
            rsiTxt += ` <b>Pozitif uyumsuzluk:</b> fiyat yeni dip yaptı ama RSI daha yüksek dipte — satış baskısı tükeniyor, olası dönüş sinyali.`;
            if (rsiSig !== 'bull') rsiSig = 'bull';
          } else if (priceHi && rsi < Math.max(...rWin) - 5) {
            rsiTxt += ` <b>Negatif uyumsuzluk:</b> fiyat yeni zirve yaptı ama RSI daha düşük zirvede — yükseliş momentumu zayıflıyor.`;
            if (rsiSig !== 'bear') rsiSig = 'bear';
          }
        }
      }
    }
    note(rsiSig);
    cards.push({ title: 'RSI (14) · Momentum', val: rsi == null ? '—' : rsi.toFixed(1), sig: rsiSig, txt: rsiTxt });

    // ---- 4) Stochastic (14,3,3) — momentum / dönüş ----
    const k = ind.stoch.k[last], d = ind.stoch.d[last];
    let stSig = 'neutral', stTxt = '';
    if (k != null && d != null) {
      const cross = k > d ? 'yukarı (%K > %D, alış kesişimi)' : 'aşağı (%K < %D, satış kesişimi)';
      if (k >= 80) { stSig = 'bear'; stTxt = `%K ${k.toFixed(0)} / %D ${d.toFixed(0)} — aşırı alım (>80). Kısa vadeli zirve riski, momentum ${cross}.`; }
      else if (k <= 20) { stSig = 'bull'; stTxt = `%K ${k.toFixed(0)} / %D ${d.toFixed(0)} — aşırı satım (<20). Dip tepkisi potansiyeli, momentum ${cross}.`; }
      else if (k > d) { stSig = 'bull'; stTxt = `%K ${k.toFixed(0)} > %D ${d.toFixed(0)} — kısa vadeli momentum yukarı dönüyor.`; }
      else { stSig = 'bear'; stTxt = `%K ${k.toFixed(0)} < %D ${d.toFixed(0)} — kısa vadeli momentum aşağı.`; }
    }
    note(stSig);
    cards.push({ title: 'Stokastik (14,3,3)', val: k == null ? '—' : `${k.toFixed(0)} / ${d.toFixed(0)}`, sig: stSig, txt: stTxt });

    // ---- 5) MACD (12,26,9) — trend momentumu ----
    const mc = ind.macd.macdLine[last], sg = ind.macd.signalLine[last], hh = ind.macd.hist[last], hPrev = ind.macd.hist[last - 1];
    let macdSig = 'neutral', macdTxt = '';
    if (mc != null && sg != null) {
      const histDir = (hPrev != null && hh != null) ? (hh > hPrev ? 'genişliyor (ivme artıyor)' : 'daralıyor (ivme zayıflıyor)') : '';
      const zero = mc > 0 ? 'sıfır çizgisi üzerinde (ana eğilim yukarı)' : 'sıfır çizgisi altında (ana eğilim aşağı)';
      if (mc > sg && hh > 0) { macdSig = 'bull'; macdTxt = `MACD sinyalin üzerinde ve ${zero}; histogram pozitif, ${histDir}. Yukarı momentum teyitli.`; }
      else if (mc < sg && hh < 0) { macdSig = 'bear'; macdTxt = `MACD sinyalin altında ve ${zero}; histogram negatif, ${histDir}. Aşağı momentum teyitli.`; }
      else { macdTxt = `MACD ${fmtP(mc)} ile sinyal ${fmtP(sg)} çok yakın — olası kesişim öncesi kararsızlık. Histogram ${histDir || 'yatay'}.`; }
    }
    note(macdSig);
    cards.push({ title: 'MACD (12,26,9)', val: mc == null ? '—' : mc.toFixed(2), sig: macdSig, txt: macdTxt });

    // ---- 6) Bollinger (20,2) — volatilite konumu ----
    const bu = ind.boll.upper[last], bl = ind.boll.lower[last], bm = ind.boll.mid[last];
    let bbSig = 'neutral', bbTxt = '';
    if (bu != null && bl != null) {
      const widthPct = bm ? ((bu - bl) / bm * 100) : null;
      const posPct = (bu - bl) ? ((price - bl) / (bu - bl) * 100) : 50; // banttaki konum %
      if (price >= bu) { bbSig = 'bear'; bbTxt = `Fiyat üst bandı (${fmtP(bu)}) aşıyor — aşırı gerilmiş. Trend güçlüyse "band yürüyüşü" olabilir, aksi halde ortaya (${fmtP(bm)}) dönüş beklenir.`; }
      else if (price <= bl) { bbSig = 'bull'; bbTxt = `Fiyat alt banda (${fmtP(bl)}) değiyor — aşırı satılmış, ortalamaya (${fmtP(bm)}) dönüş tepkisi olabilir.`; }
      else { bbTxt = `Bant içinde, alt banttan %${posPct.toFixed(0)} yukarıda (orta ${fmtP(bm)}). Bant genişliği fiyatın %${widthPct == null ? '—' : widthPct.toFixed(1)}'i — ${widthPct != null && widthPct < 8 ? 'sıkışma (squeeze), sert hareket öncesi olabilir' : 'normal volatilite'}.`; }
    }
    note(bbSig);
    cards.push({ title: 'Bollinger (20,2)', val: bu == null ? '—' : `${fmtP(bl)} – ${fmtP(bu)}`, sig: bbSig, txt: bbTxt });

    // ---- 6.5) Mum Formasyonu (candlestick) — son bar fiyat aksiyonu ----
    const cp = detectCandlePattern(ind.candles);
    if (cp) {
      note(cp.sig);
      cards.push({ title: '🕯️ Mum Formasyonu', val: cp.name, sig: cp.sig,
        txt: cp.txt + `<div class="ta-of-disc">Mum formasyonları son 1–2 barın fiyat aksiyonundan okunur; kısa vadeli öncüdür, teyit için ertesi bar ve diğer göstergelerle birlikte değerlendirilir. Yatırım tavsiyesi değildir.</div>` });
    }

    // ---- 7) ATR (14) — volatilite seviyesi (yön nötr) ----
    const atrV = ind.atr[last];
    let atrTxt = 'Yeterli veri yok.';
    if (atrV != null) {
      const atrPct = price ? (atrV / price * 100) : null;
      const lvl = atrPct == null ? '' : atrPct >= 4 ? 'yüksek' : atrPct >= 2 ? 'orta' : 'düşük';
      atrTxt = `Günlük ortalama bar aralığı ≈ ${fmtP(atrV)} ${curSym} (fiyatın %${atrPct == null ? '—' : atrPct.toFixed(1)}'i) — ${lvl} volatilite. Stop-loss / pozisyon boyutu için ATR'nin 1.5–2 katı mesafe yaygın kullanılır.`;
    }
    cards.push({ title: 'ATR (14) · Volatilite', val: atrV == null ? '—' : fmtP(atrV) + ' ' + curSym, sig: 'neutral', txt: atrTxt });

    // ---- 8) OBV — hacim/para akışı (son ~20 bar eğimi) ----
    const obvArr = ind.obv;
    let obvSig = 'neutral', obvTxt = 'Hacim verisi yetersiz.';
    if (obvArr[last] != null && obvArr.length > 25) {
      const ref = obvArr[last - 20];
      if (ref != null && ref !== 0) {
        const obvChg = (obvArr[last] - ref) / Math.abs(ref) * 100;
        const priceChg = pct(price, closes[last - 20]);
        if (obvChg > 3 && priceChg > 0) { obvSig = 'bull'; obvTxt = `OBV son 20 günde yükseliyor ve fiyatı teyit ediyor (alımlar hacimle destekleniyor). Sağlıklı yükseliş.`; }
        else if (obvChg < -3 && priceChg < 0) { obvSig = 'bear'; obvTxt = `OBV son 20 günde düşüyor, fiyat düşüşünü hacim teyit ediyor (dağıtım baskısı).`; }
        else if (obvChg > 3 && priceChg <= 0) { obvSig = 'bull'; obvTxt = `Pozitif uyumsuzluk: fiyat yatay/düşerken OBV yükseliyor — gizli alım, olası dönüş sinyali.`; }
        else if (obvChg < -3 && priceChg >= 0) { obvSig = 'bear'; obvTxt = `Negatif uyumsuzluk: fiyat yükselirken OBV düşüyor — yükseliş hacimle desteklenmiyor, zayıflık işareti.`; }
        else { obvTxt = `OBV son 20 günde belirgin yön vermiyor — para akışı dengeli.`; }
      }
    }
    note(obvSig);
    cards.push({ title: 'OBV · Para Akışı', val: obvSig === 'neutral' ? 'Dengeli' : (obvSig === 'bull' ? 'Giriş' : 'Çıkış'), sig: obvSig, txt: obvTxt });

    // ---- 9) Ichimoku — bulut + Tenkan/Kijun ----
    const ic = ind.ichi;
    const base = ic.base;
    const tk = ic.tenkan[last], kj = ic.kijun[last];
    const spanA = (last - base >= 0) ? ic.senkouA[last - base] : null;
    const spanB = (last - base >= 0) ? ic.senkouB[last - base] : null;
    let icSig = 'neutral', icTxt = 'Yeterli veri yok (Ichimoku için ~3 ay+ gerekir).';
    if (spanA != null && spanB != null && tk != null && kj != null) {
      const cloudTop = Math.max(spanA, spanB), cloudBot = Math.min(spanA, spanB);
      const tkTxt = tk > kj ? 'Tenkan, Kijun üzerinde (kısa vade pozitif)' : 'Tenkan, Kijun altında (kısa vade negatif)';
      if (price > cloudTop && tk > kj) { icSig = 'bull'; icTxt = `Fiyat bulutun üzerinde (bulut tavanı ${fmtP(cloudTop)}) ve ${tkTxt}. Ichimoku güçlü yükseliş teyidi; bulut artık destek bölgesi.`; }
      else if (price < cloudBot && tk < kj) { icSig = 'bear'; icTxt = `Fiyat bulutun altında (bulut tabanı ${fmtP(cloudBot)}) ve ${tkTxt}. Güçlü düşüş teyidi; bulut direnç bölgesi.`; }
      else if (price > cloudTop) { icSig = 'bull'; icTxt = `Fiyat bulut üzerinde (ana eğilim yukarı) ama ${tkTxt} — momentum kararsız, Tenkan/Kijun kesişimi izlenmeli.`; }
      else if (price < cloudBot) { icSig = 'bear'; icTxt = `Fiyat bulut altında (ana eğilim aşağı); ${tkTxt}.`; }
      else { icSig = 'neutral'; icTxt = `Fiyat bulutun içinde (${fmtP(cloudBot)}–${fmtP(cloudTop)}) — kararsız/geçiş bölgesi, yön netleşene kadar temkin.`; }
    }
    note(icSig);
    cards.push({ title: 'Ichimoku Bulutu', val: (tk == null ? '—' : fmtP(tk)) + ' / ' + (kj == null ? '—' : fmtP(kj)), sig: icSig, txt: icTxt });

    // ---- 10) Fibonacci geri çekilme ----
    const fb = ind.fib;
    let fibSig = 'neutral', fibTxt = '';
    if (fb && fb.diff > 0) {
      const sortedP = fb.levels.map(l => l.price).slice().sort((a, b) => a - b);
      let sup = null, res = null;
      for (const p of sortedP) { if (p <= price) sup = p; else { res = p; break; } }
      const curRatio = fb.up ? (fb.hi - price) / fb.diff : (price - fb.lo) / fb.diff; // ne kadar geri çekildi
      const inPocket = curRatio >= 0.382 && curRatio <= 0.618; // "altın bölge"
      if (fb.up) {
        if (inPocket) { fibSig = 'bull'; fibTxt = `Yükseliş dalgasında fiyat %38.2–%61.8 "altın geri çekilme" bölgesinde (≈%${(curRatio*100).toFixed(0)} geri çekilme) — trend yönünde tepki için izlenen bölge.`; }
        else if (curRatio > 0.786) { fibSig = 'bear'; fibTxt = `Fiyat %78.6'nın altına sarktı (≈%${(curRatio*100).toFixed(0)} geri çekilme) — yükseliş dalgası geçersizleşme riskinde.`; }
        else { fibTxt = `Yükseliş dalgası (dip ${fmtP(fb.lo)} → zirve ${fmtP(fb.hi)}). ≈%${(curRatio*100).toFixed(0)} geri çekilmede.`; }
      } else {
        if (inPocket) { fibSig = 'bear'; fibTxt = `Düşüş dalgasında fiyat %38.2–%61.8 direnç bölgesinde (≈%${(curRatio*100).toFixed(0)} tepki) — satıcıların devreye girmesi beklenen bölge.`; }
        else { fibTxt = `Düşüş dalgası (zirve ${fmtP(fb.hi)} → dip ${fmtP(fb.lo)}). ≈%${(curRatio*100).toFixed(0)} tepki yükselişinde.`; }
      }
      fibTxt += ` Yakın destek ${sup == null ? '—' : fmtP(sup)}, yakın direnç ${res == null ? '—' : fmtP(res)}.`;
    } else { fibTxt = 'Yeterli veri yok.'; }
    note(fibSig);
    cards.push({ title: 'Fibonacci Geri Çekilme', val: fb ? `${fmtP(fb.lo)} – ${fmtP(fb.hi)}` : '—', sig: fibSig, txt: fibTxt });

    // ---- 11) Volume Profile — hacim yoğunluğu / POC / Değer Alanı ----
    const vp = ind.vprof;
    let vpSig = 'neutral', vpTxt = 'Hacim profili için yeterli veri yok.', vpVal = '—', vpHtml = '';
    if (vp) {
      const poc = vp.poc, vah = vp.vah, val = vp.val;
      let priceIdx = -1;
      for (let i = 0; i < vp.bins.length; i++) {
        if (price >= vp.bins[i].lo && (price < vp.bins[i].hi || i === vp.bins.length - 1)) { priceIdx = i; break; }
      }
      const rows = [];
      for (let i = vp.bins.length - 1; i >= 0; i--) {
        const b = vp.bins[i];
        const w = vp.maxVol > 0 ? (b.vol / vp.maxVol * 100) : 0;
        const inVA = i >= vp.vaLoIdx && i <= vp.vaHiIdx;
        const cls = (i === vp.pocIdx ? ' poc' : inVA ? ' va' : '') + (i === priceIdx ? ' cur' : '');
        rows.push(`<div class="ta-vp-row${cls}"><span class="ta-vp-price">${fmtP(b.mid)}</span><span class="ta-vp-bar"><span class="ta-vp-fill" style="width:${w.toFixed(1)}%"></span></span></div>`);
      }
      vpHtml = `<div class="ta-vp">${rows.join('')}</div>
        <div class="ta-vp-legend"><span><span class="k poc"></span>POC ${fmtP(poc)} ${curSym}</span><span><span class="k va"></span>Değer Alanı ${fmtP(val)}–${fmtP(vah)}</span><span><span class="k cur"></span>güncel fiyat</span></div>`;
      vpVal = `POC ${fmtP(poc)} ${curSym}`;
      if (price > vah) { vpSig = 'bull'; vpTxt = `Fiyat değer alanının (${fmtP(val)}–${fmtP(vah)}) üzerinde — alıcılar fiyatı en yoğun işlem gören bölgenin üstünde tutuyor. VAH ${fmtP(vah)} ${curSym} ilk destek; altına dönülürse zayıflık.`; }
      else if (price < val) { vpSig = 'bear'; vpTxt = `Fiyat değer alanının (${fmtP(val)}–${fmtP(vah)}) altında — satıcılar hâkim, işlem yoğunluğunun altında. VAL ${fmtP(val)} ${curSym} ilk direnç.`; }
      else { vpSig = 'neutral'; vpTxt = `Fiyat değer alanı içinde (${fmtP(val)}–${fmtP(vah)}), POC'un ${price >= poc ? 'üzerinde (denge hafif alıcı lehine)' : 'altında (denge hafif satıcı lehine)'}. POC ${fmtP(poc)} ${curSym} en çok işlem gören seviye — mıknatıs/destek-direnç görevi görür. Range/rotasyon; kırılım için VAH ${fmtP(vah)} üstü veya VAL ${fmtP(val)} altı izlenir.`; }
    }
    note(vpSig);
    cards.push({ title: '📊 Volume Profile · Hacim Yoğunluğu', val: vpVal, sig: vpSig, txt: vpHtml + `<div class="ta-vp-note">${vpTxt}</div>`, cls: 'ta-vp-card' });

    // ---- 12) Order Flow (TAHMİNİ) — bar içi delta / CVD ----
    const of = ind.oflow;
    let ofSig = 'neutral', ofTxt = 'Order flow tahmini için yeterli veri yok.', ofVal = '—', ofHtml = '', ofDiverge = 0;
    if (of) {
      const buyPct = of.buyPct, sellPct = 100 - of.buyPct;
      ofVal = `Alım ${buyPct.toFixed(0)}% · Satım ${sellPct.toFixed(0)}%`;
      const pUp = of.priceSlope > 0, cUp = of.cvdSlope > 0;
      const aggr = of.todayZ >= 1 ? 'Bugünkü bar belirgin agresif ALIM baskısı taşıyor'
                 : of.todayZ <= -1 ? 'Bugünkü bar belirgin agresif SATIM baskısı taşıyor'
                 : 'Bugünkü bar dengeli';
      if (pUp && cUp) { ofSig = 'bull'; ofTxt = `Kümülatif delta (CVD) son ${of.win} barda yükseliyor ve fiyat artışını teyit ediyor — agresif alıcılar kontrolde. ${aggr}.`; }
      else if (!pUp && !cUp) { ofSig = 'bear'; ofTxt = `CVD son ${of.win} barda düşüyor, fiyat düşüşünü teyit ediyor — agresif satıcılar hâkim. ${aggr}.`; }
      else if (pUp && !cUp) { ofSig = 'bear'; ofDiverge = -1; ofTxt = `Negatif uyumsuzluk: fiyat yükselirken CVD düşüyor — yükseliş agresif alımla desteklenmiyor (zayıf ralli / dağıtım). ${aggr}.`; }
      else { ofSig = 'bull'; ofDiverge = 1; ofTxt = `Pozitif uyumsuzluk: fiyat düş/yatayken CVD yükseliyor — sessiz birikim, olası dönüş öncüsü. ${aggr}.`; }
      ofHtml = `<div class="ta-of-bar"><span class="ta-of-buy" style="width:${buyPct.toFixed(1)}%">${buyPct.toFixed(0)}%</span><span class="ta-of-sell" style="width:${sellPct.toFixed(1)}%">${sellPct.toFixed(0)}%</span></div>
        <div class="ta-of-legend"><span>▲ Alım baskısı</span><span>Satım baskısı ▼</span></div>`;
    }
    note(ofSig);
    cards.push({ title: '🔄 Order Flow (tahmini) · CVD', val: ofVal, sig: ofSig, txt: ofHtml + `<div class="ta-vp-note">${ofTxt}</div><div class="ta-of-disc">Not: Gerçek order flow anlık emir defteri (bid/ask, tick) verisi gerektirir; bu tahmin yalnız OHLCV bar yapısından (kapanışın bar içindeki konumu) hesaplanır — yaklaşık bir göstergedir.</div>`, cls: 'ta-of-card' });

    // ---- Genel Özet ----
    const total = bull + bear;
    let sumSig = 'neutral', sumTxt;
    const verdict = bull >= bear + 3 ? 'belirgin alıcı'
                  : bull > bear ? 'hafif alıcı'
                  : bear >= bull + 3 ? 'belirgin satıcı'
                  : bear > bull ? 'hafif satıcı' : 'kararsız';
    if (bull > bear) sumSig = 'bull';
    else if (bear > bull) sumSig = 'bear';
    const adxNote = (adxV != null && adxV < 20)
      ? ' ADX zayıf olduğu için trend sinyalleri (MA/MACD) güvenilirliğini yitiriyor; salınım göstergelerine ağırlık ver.'
      : (adxV != null && adxV >= 25) ? ' ADX güçlü trendi teyit ediyor.' : '';
    sumTxt = `${symbol} için ${total} yönlü sinyalin ${bull}'i pozitif, ${bear}'i negatif — genel görünüm <b>${verdict} yönlü</b>.${adxNote} Sinyaller tek başına alım-satım kararı değildir; haber akışı ve temel verilerle birlikte değerlendir.`;

    const sigLabel = { bull: '▲ Pozitif', bear: '▼ Negatif', neutral: '● Nötr' };
    const indWrap = document.getElementById('taIndicators');
    indWrap.innerHTML = `
      <div class="ta-ind ta-summary ${sumSig}">
        <div class="ta-ind-head"><span class="ta-ind-title">Genel Özet — ${symbol}</span>
          <span class="ta-sig ${sumSig}">${sigLabel[sumSig]}</span></div>
        <div class="ta-ind-txt">${sumTxt}</div>
      </div>
      ${cards.map(c => `
        <div class="ta-ind ${c.sig} ${c.cls || ''}">
          <div class="ta-ind-head">
            <span class="ta-ind-title">${c.title}</span>
            <span class="ta-sig ${c.sig}">${sigLabel[c.sig]}</span>
          </div>
          <div class="ta-ind-val">${c.val}</div>
          <div class="ta-ind-txt">${c.txt}</div>
        </div>
      `).join('')}
    `;
  }

  // ===== Temel Analiz sekmesi =====
  let faInited = false;
  let faReq = 0; // her yükleme için artan istek jetonu — geç gelen async yanıtlar eskiyi ezmesin
  const faAlive = (req) => req === faReq;

  // "4.28T" / "451.44B" / "0.34%" / "$1.04" → sayı
  function faNum(s) {
    if (s == null) return null;
    if (typeof s === 'number') return s;
    const m = String(s).replace(/[$,%]/g, '').trim().match(/(-?[\d.]+)\s*([TBMK])?/i);
    if (!m) return null;
    const v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    const mult = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 }[(m[2] || '').toUpperCase()];
    return mult ? v * mult : v;
  }
  // Parantez içindeki yüzdeyi çek: "$1.04 (0.36%)" → 0.36 ; "312.72 (+7.33%)" → 7.33
  function faPctIn(s) {
    if (!s) return null;
    const m = String(s).match(/\(\s*([+-]?[\d.]+)\s*%\s*\)/);
    return m ? parseFloat(m[1]) : null;
  }

  // ===== Temel Skor motoru (0–100) — TA vade skoruna paralel, kapsama-duyarlı =====
  // Her kriter 0–100 alt-skora normalize edilir (faInterp: kırılım noktaları arası
  // doğrusal), kendi ağırlığıyla toplanır. Yalnız verisi olan kriterler sayılır
  // (present/total gösterilir) — böylece BIST'in eksik kalemleri dürüstçe görünür.
  // Araştırma temeli: klasik rasyo analizi (kârlılık/likidite/borç/değerleme) +
  // Piotroski F-Score trend mantığı (OCF>net kâr, ROA↑, brüt marj↑, cari oran↑).
  function faInterp(x, pts) {
    if (x == null || isNaN(x)) return null;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, s0] = pts[i], [x1, s1] = pts[i + 1];
      if (x >= x0 && x <= x1) return s0 + (s1 - s0) * (x - x0) / (x1 - x0);
    }
    return null;
  }
  const faSD = (a, b) => (a != null && b != null && b !== 0) ? a / b : null; // güvenli bölme
  function faScoreSig(s) { return s == null ? 'neutral' : s >= 65 ? 'bull' : s >= 45 ? 'neutral' : 'bear'; }
  function computeFaScore(criteria) {
    let wSum = 0, sSum = 0, present = 0;
    for (const c of criteria) if (c.score != null) { wSum += c.weight; sSum += c.weight * c.score; present++; }
    return { score: wSum > 0 ? sSum / wSum : null, present, total: criteria.length };
  }
  function faVerdict(s) {
    if (s == null) return { label: 'veri yetersiz', band: 'na' };
    if (s >= 72) return { label: 'güçlü / olumlu', band: 'strong' };
    if (s >= 60) return { label: 'olumlu', band: 'good' };
    if (s >= 48) return { label: 'orta / karışık', band: 'mixed' };
    if (s >= 36) return { label: 'zayıf', band: 'weak' };
    return { label: 'riskli / temkinli', band: 'risk' };
  }
  const FA_GROUPS = [
    ['profitability', 'Kârlılık'],
    ['growth', 'Büyüme'],
    ['solvency', 'Borç / Finansal Sağlık'],
    ['liquidity', 'Likidite'],
    ['quality', 'Kalite & Trend (Piotroski)'],
    ['valuation', 'Değerleme'],
  ];
  const fmtTL = (n) => {
    if (n == null || isNaN(n)) return '—';
    const a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e9) return sign + '₺' + (a / 1e9).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Md';
    if (a >= 1e6) return sign + '₺' + (a / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' M';
    return sign + '₺' + a.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  };
  const fmtUSD = (n) => {
    if (n == null || isNaN(n)) return '—';
    const a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e9) return sign + '$' + (a / 1e9).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Md';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' M';
    return sign + '$' + a.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  };
  // Skorlu temel panel: skor başlığı + metrik tile'ları + kriter kartları (gruplu)
  function renderFaScored(wrap, symbol, market, tiles, criteria, srcLabel, extra) {
    const { score, present, total } = computeFaScore(criteria);
    const vd = faVerdict(score);
    const tilesHtml = tiles.filter(t => t.val != null && t.val !== '' && t.val !== '—')
      .map(t => `<div class="fa-tile"><span class="fa-lbl">${t.label}</span><span class="fa-val">${t.val}</span></div>`).join('');
    let groupsHtml = '';
    for (const [gk, glabel] of FA_GROUPS) {
      const cs = criteria.filter(c => c.group === gk && c.score != null);
      if (!cs.length) continue;
      groupsHtml += `<h4 class="fa-group-h">${glabel}</h4><div class="ta-grid fa-crit-grid">` +
        cs.map(c => {
          const sig = faScoreSig(c.score);
          return `<div class="ta-ind ${sig}">
            <div class="ta-ind-head"><span class="ta-ind-title">${c.label}</span>
              <span class="fa-crit-badge ${sig}" title="0–100 alt-skor">${Math.round(c.score)}</span></div>
            <div class="ta-ind-txt">${c.note}</div></div>`;
        }).join('') + `</div>`;
    }
    const scoreHtml = score == null ? '' : `
      <div class="fa-score ${vd.band}">
        <div class="fa-score-num">${Math.round(score)}<small>/100</small></div>
        <div class="fa-score-meta">
          <div class="fa-score-verdict">Temel Skor — <b>${vd.label}</b></div>
          <div class="fa-score-bar"><i style="width:${Math.max(2, Math.min(100, score))}%"></i></div>
          <div class="fa-score-cov">${present}/${total} kriter değerlendirildi · ${market === 'BIST' ? 'BIST' : 'ABD'} · Kaynak: ${srcLabel}</div>
        </div>
      </div>`;
    wrap.innerHTML = scoreHtml +
      `<div class="fa-tiles">${tilesHtml}</div>` +
      groupsHtml +
      (extra || '');
  }

  // Kriter dizilerini anahtara göre birleştir (b, a'daki aynı anahtarı ezer).
  // Kullanım: taban (stockanalysis) kriterlerinin üzerine SEC gerçek mali tablo kriterleri.
  function mergeCriteria(a, b) {
    const map = new Map();
    (a || []).forEach(c => map.set(c.key, c));
    (b || []).forEach(c => map.set(c.key, c));
    return [...map.values()];
  }

  // ===== TA + FA birleşik görünüm =====
  // FA (0–100 temel: kalite/değer, uzun vade) "ne"; TA (0–100 vade skoru: trend/zamanlama)
  // "ne zaman". Farklı şeyleri ölçerler — saf ortalama değil, 3×3 konumlama + ağırlıklı bileşke.
  const COMPOSITE_SLOT = `<div id="faComposite" class="fa-composite-wrap"><div class="fa-comp-loading">🔗 TA + FA birleşik görünüm hazırlanıyor…</div></div>`;
  // İçeriden işlemler paneli placeholder'ı — async doldurulur (fillInsider). BİLGİ amaçlıdır,
  // temel skora DAHİL DEĞİLDİR (kullanıcı tercihi: sadece bilgi paneli).
  const INSIDER_SLOT = `<div id="faInsider" class="fa-insider-wrap"><div class="fa-comp-loading">🏛️ İçeriden işlemler yükleniyor…</div></div>`;

  async function getTaScoreFor(symbol, market, vade) {
    const cfg = (window.TA_WEIGHTS || {})[vade];
    if (!cfg || cfg.intraday) return null; // bileşke günlük vade kullanır (orta)
    const daily = await ensureDailyCandles(symbol, market);
    if (!daily) return null;
    const bench = await ensureBenchDaily(market); // RS için endeks — bileşke de RS-dahil skoru kullansın
    const res = computeVadeScore(daily, vade, undefined, bench);
    return res ? { score: res.score, label: res.label, cls: res.cls } : null;
  }

  // 5y günlük mumları getir/cache'le (skorlama + seviye motoru paylaşır — tek fetch)
  async function ensureDailyCandles(symbol, market) {
    const ck = market + ':' + symbol;
    if (!vadeCache[ck]) {
      try { const d = await fetchYahooOHLC(symbol, market, '5y', '1d'); vadeCache[ck] = d.candles; }
      catch (e) { return null; }
    }
    return vadeCache[ck];
  }

  // Göreli Güç (RS) için karşılaştırma endeksinin 5y günlük mumlarını getir/cache'le.
  // Endeks sembolü zaten tam (XU100.IS / ^GSPC) → market='RAW' ile '.IS' eklenmeden çekilir.
  // Hata olursa null döner; RS göstergesi devre dışı kalır (skor normalize olur, bozulmaz).
  async function ensureBenchDaily(market) {
    const sym = (window.TA_BENCHMARK || {})[market];
    if (!sym) return null;
    if (benchCache[market] === undefined) {
      try { const d = await fetchYahooOHLC(sym, 'RAW', '5y', '1d'); benchCache[market] = d.candles; }
      catch (e) { benchCache[market] = null; }
    }
    return benchCache[market];
  }

  const faBand = (s) => s >= 60 ? 'hi' : s < 45 ? 'lo' : 'mid';
  const taBand = (s) => s >= 54 ? 'hi' : s <= 46 ? 'lo' : 'mid';
  const COMPOSITE_MATRIX = {
    'hi:hi':  { band: 'strong', label: 'Güçlü uyum', txt: 'Temel sağlam <b>ve</b> teknik olumlu — fiyat eğilimi temelle destekleniyor. En tutarlı bileşim; yine de risk yönetimiyle.' },
    'hi:mid': { band: 'good',   label: 'Temelde güçlü, teknik nötr', txt: 'Şirketin temeli sağlam, fiyat kararsız — biriktirme / tutma bölgesi; teknik teyit (50 üstü) beklenebilir.' },
    'hi:lo':  { band: 'mixed',  label: 'Kaliteli ama fiyat zayıf', txt: 'Temel güçlü fakat teknik düşüşte — sabırlı biriktirme fırsatı <i>olabilir</i>; teknik dönüş izlenmeli. Ucuzluk bir değer tuzağı da olabilir.' },
    'mid:hi': { band: 'mixed',  label: 'Momentum var, temel orta', txt: 'Teknik olumlu ama temel vasat — momentum bir süre sürebilir; temeldeki zayıflık uzun vadeli potansiyeli sınırlar.' },
    'mid:mid':{ band: 'mixed',  label: 'Kararsız', txt: 'Hem temel hem teknik kararsız — net bir sinyal yok. İzlemede tut, teyit bekle.' },
    'mid:lo': { band: 'weak',   label: 'Temel orta, teknik zayıf', txt: 'Acele gerektirmez — temel vasat, fiyat zayıf. Uzak dur / izle.' },
    'lo:hi':  { band: 'weak',   label: 'Spekülatif momentum', txt: 'Fiyat yükseliyor ama temel zayıf — yükseliş kalıcı olmayabilir. Riskli, kısa soluklu olabilir.' },
    'lo:mid': { band: 'weak',   label: 'Temel zayıf', txt: 'Temel zayıf, teknik nötr — temel açıdan cazip değil.' },
    'lo:lo':  { band: 'risk',   label: 'Zayıf + zayıf', txt: 'Hem temel hem teknik zayıf — en riskli bileşim. Temkinli / kaçın.' },
  };

  async function fillComposite(symbol, market, faScore, req) {
    return fillCompositeInto(document.getElementById('faComposite'), symbol, market, faScore, () => faAlive(req), false);
  }

  // ===== İçeriden işlemler (bilgi paneli — TEMEL SKORA DAHİL DEĞİL) =====
  // US: SEC Form 4 (yönetici / %10+ ortak açık piyasa alım-satımı — güvenilir, resmi XBRL/XML).
  // BIST: KAP pay alım-satım / geri alım bildirimleri (kaynak sınırlı: piyasa geneli son duyuru
  // akışı + Google News; resmi tam liste için KAP linki verilir). SPK: bilgi amaçlı, tek başına
  // al-sat sinyali DEĞİL. Kullanıcı tercihi (2026-08-15): yalnız bilgi, skoru etkilemez.
  const INSIDER_KW = ['PAY ALIM', 'PAY SATIŞ', 'PAY SATIS', 'GERİ ALIM', 'GERI ALIM', 'PAYLARIN', 'PAY GERİ', 'İKTİSAP', 'IKTISAP', 'ELDEN ÇIKAR', 'ELDEN CIKAR', 'ORTAKLIK PAY', 'YÖNETİCİ', 'YONETICI'];
  let insiderCache = {};

  function insiderShell(title, body, note) {
    return `<div class="fa-insider"><div class="fa-sec-head fa-ins-head">🏛️ ${title}</div>${body || ''}` +
      (note || `<p class="hint ta-disclaimer">Bilgi amaçlıdır — içeriden işlemler tek başına al-sat sinyali değildir ve <b>temel skora dahil edilmez</b>. Yatırım tavsiyesi değildir.</p>`) +
      `</div>`;
  }

  async function fillInsider(symbol, market, req) {
    const box = document.getElementById('faInsider');
    if (!box) return;
    const ck = market + ':' + symbol;
    let html;
    try {
      html = insiderCache[ck] || (insiderCache[ck] = await (market === 'US' ? insiderUS(symbol) : insiderBIST(symbol)));
    } catch (e) {
      html = insiderShell(market === 'US' ? 'İçeriden işlemler (SEC Form 4)' : 'İçeriden işlemler (KAP)',
        '<p class="fa-desc">İçeriden işlem verisi şu an alınamadı (kaynak geçici sorunu). ↻ ile tekrar dene.</p>');
    }
    if (req != null && !faAlive(req)) return;
    const cur = document.getElementById('faInsider');
    if (cur) cur.innerHTML = html;
  }

  // ---- SEC Form 4 ----
  // Bir Form 4 XML'ini ayrıştır: sahip + ilişki + açık piyasa alım(P)/satım(S) hisse ve tutarları.
  function parseForm4(xml, filedDate) {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      if (doc.getElementsByTagName('parsererror').length) return null;
      const txt = (sel) => { const n = doc.querySelector(sel); return n ? n.textContent.trim() : ''; };
      const owner = txt('reportingOwner rptOwnerName') || txt('rptOwnerName');
      const rel = [];
      const isTrue = (v) => v === '1' || v.toLowerCase() === 'true';
      if (isTrue(txt('reportingOwnerRelationship isDirector'))) rel.push('Yönetim Kurulu');
      if (isTrue(txt('reportingOwnerRelationship isOfficer'))) rel.push(txt('reportingOwnerRelationship officerTitle') || 'Yönetici');
      if (isTrue(txt('reportingOwnerRelationship isTenPercentOwner'))) rel.push('%10+ ortak');
      let buyShares = 0, buyVal = 0, sellShares = 0, sellVal = 0, other = 0;
      doc.querySelectorAll('nonDerivativeTransaction').forEach((tr) => {
        const code = (tr.querySelector('transactionCoding transactionCode') || {}).textContent;
        const sh = parseFloat((tr.querySelector('transactionAmounts transactionShares value') || {}).textContent) || 0;
        const px = parseFloat((tr.querySelector('transactionAmounts transactionPricePerShare value') || {}).textContent) || 0;
        const c = (code || '').trim();
        if (c === 'P') { buyShares += sh; buyVal += sh * px; }
        else if (c === 'S') { sellShares += sh; sellVal += sh * px; }
        else if (sh) other++;
      });
      if (!buyShares && !sellShares && !other) return null;
      return { owner: owner || 'Bildirim sahibi', rel: rel.join(', '), buyShares, buyVal, sellShares, sellVal, other, date: filedDate };
    } catch (e) { return null; }
  }

  async function insiderUS(symbol) {
    const H = 'İçeriden işlemler (SEC Form 4)';
    const cik = await secResolveCik(symbol);
    if (!cik) return insiderShell(H, '<p class="fa-desc">Bu sembol için SEC kaydı yok (ETF ya da yabancı özel şirket olabilir) — Form 4 verisi mevcut değil.</p>');
    const txt = await secGet(`https://data.sec.gov/submissions/CIK${cik}.json`, 15000);
    if (!txt) return insiderShell(H, '<p class="fa-desc">SEC başvuru listesi şu an alınamadı. ↻ ile tekrar dene.</p>');
    let r;
    try { r = JSON.parse(txt).filings.recent; } catch (e) { r = null; }
    if (!r || !r.form) return insiderShell(H, '<p class="fa-desc">SEC başvuru listesi okunamadı.</p>');
    const cutoff = Date.now() - 90 * 86400000;
    const cikInt = String(parseInt(cik, 10));
    const picks = [];
    for (let i = 0; i < r.form.length && picks.length < 12; i++) {
      if (r.form[i] !== '4' && r.form[i] !== '4/A') continue;
      if (new Date(r.filingDate[i]).getTime() < cutoff) continue;
      let doc = (r.primaryDocument[i] || '').replace(/^xsl[^/]*\//i, ''); // stilli yol önekini at
      if (!/\.xml$/i.test(doc)) continue; // yalnız XML birincil belgeler ayrıştırılabilir
      picks.push({ acc: r.accessionNumber[i].replace(/-/g, ''), doc, date: r.filingDate[i] });
    }
    const secLink = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}&type=4&dateb=&owner=include&count=40`;
    const note = `<p class="hint ta-disclaimer">Yalnız açık piyasa alım (P) / satım (S) işlemleri özetlenir; opsiyon icrası, hisse tahsisi, vergi kesintisi gibi kodlar hariç tutulur. Kaynak: <a href="${secLink}" target="_blank" rel="noopener">SEC EDGAR — Form 4 ↗</a> · Bilgi amaçlı, <b>skora dahil değildir</b>, yatırım tavsiyesi değildir.</p>`;
    if (!picks.length) return insiderShell(H, `<p class="fa-desc">Son 90 günde yönetici / %10+ ortak açık piyasa Form 4 bildirimi bulunamadı.</p>`, note);
    const parsed = await secBatches(picks.map((p) => async () => {
      const xt = await secGet(`https://www.sec.gov/Archives/edgar/data/${cikInt}/${p.acc}/${p.doc}`, 10000);
      return xt ? parseForm4(xt, p.date) : null;
    }), 6);
    const rows = parsed.filter(Boolean);
    if (!rows.length) return insiderShell(H, `<p class="fa-desc">Son 90 günde ${picks.length} Form 4 bildirimi var, ancak açık piyasa alım/satımı içermiyor (büyük olasılıkla opsiyon/tahsis işlemleri).</p>`, note);
    let tB = 0, tBv = 0, tS = 0, tSv = 0;
    rows.forEach((x) => { tB += x.buyShares; tBv += x.buyVal; tS += x.sellShares; tSv += x.sellVal; });
    const net = tBv - tSv;
    let summary;
    if (!tB && !tS) {
      // Yalnız opsiyon icrası / hisse tahsisi / vergi kesintisi kodları — açık piyasa sinyali yok.
      summary = `<div class="ins-summary ins-neu"><b>Son 90 gün — açık piyasa alım/satımı yok.</b> Bildirimler yalnız opsiyon icrası, hisse tahsisi (RSU) veya vergi kesintisi gibi işlemler — yönetici tercihiyle yapılan bir alım/satım sinyali taşımaz.</div>`;
    } else {
      const dir = (tB && !tS) ? 'net ALIM' : (tS && !tB) ? 'net SATIM' : net > 0 ? 'net alım ağırlıklı' : net < 0 ? 'net satım ağırlıklı' : 'dengeli';
      const cls = net > 0 ? 'ins-buy' : net < 0 ? 'ins-sell' : 'ins-neu';
      summary = `<div class="ins-summary ${cls}"><b>Son 90 gün — ${dir}.</b> Alım: ${tB ? tB.toLocaleString('tr-TR') + ' hisse · ~' + fmtUSD(tBv) : '—'} · Satım: ${tS ? tS.toLocaleString('tr-TR') + ' hisse · ~' + fmtUSD(tSv) : '—'}</div>`;
    }
    const list = rows.slice(0, 8).map((x) => {
      const acts = [];
      if (x.buyShares) acts.push(`<span class="ins-tag ins-b">ALIM ${x.buyShares.toLocaleString('tr-TR')} · ~${fmtUSD(x.buyVal)}</span>`);
      if (x.sellShares) acts.push(`<span class="ins-tag ins-s">SATIM ${x.sellShares.toLocaleString('tr-TR')} · ~${fmtUSD(x.sellVal)}</span>`);
      if (!acts.length && x.other) acts.push(`<span class="ins-tag ins-o">diğer işlem</span>`);
      return `<div class="ins-row"><div class="ins-meta"><span class="ins-date">${x.date}</span><span class="ins-owner">${x.owner}${x.rel ? ` <em>(${x.rel})</em>` : ''}</span></div><div class="ins-acts">${acts.join('')}</div></div>`;
    }).join('');
    return insiderShell(H, summary + `<div class="ins-list">${list}</div>`, note);
  }

  // ---- BIST / KAP ----
  async function insiderBIST(symbol) {
    const H = 'İçeriden işlemler (KAP)';
    const all = await fetchKAP().catch(() => []);
    const kw = INSIDER_KW.map((k) => k.toUpperCase());
    let items = kapItemsForTicker(all || [], symbol, { subjectIncludes: INSIDER_KW });
    if (items.length < 3) { // piyasa-geneli akış sığ → Google News ile içeriden-odaklı arama
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' pay alım satım geri alım yönetici ortak KAP')}&hl=tr&gl=TR&ceid=TR:tr`;
      const extra = await fetchRSS(url, 10).catch(() => []);
      const seen = new Set(items.map((i) => i.title));
      extra.forEach((it) => {
        const T = (it.title || '').toUpperCase();
        if (kw.some((k) => T.includes(k)) && !seen.has(it.title)) { seen.add(it.title); items.push(it); }
      });
    }
    items = items.filter((i) => i.pubDate).sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)).slice(0, 8);
    const kapLink = `https://www.kap.org.tr/tr/bildirim-sorgu`;
    const note = `<p class="hint ta-disclaimer">KAP akışı/haber taramasına dayanır — tam ve anlık liste değildir. Resmi kaynak: <a href="${kapLink}" target="_blank" rel="noopener">KAP bildirim sorgu ↗</a> (hisse kodu ile ara). Bilgi amaçlı, <b>skora dahil değildir</b>, yatırım tavsiyesi değildir.</p>`;
    if (!items.length) return insiderShell(H, `<p class="fa-desc">Son bildirim akışında ${symbol} için içeriden/pay alım-satım bildirimi bulunamadı. Resmi ve tam liste için KAP linkini kullan.</p>`, note);
    const list = items.map((it) => {
      const clean = (it.title || '').replace(/\*\*\*/g, '').replace(/\*\*/g, '').trim();
      const d = new Date(it.pubDate);
      const ds = isNaN(d) ? '' : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
      const link = it.link ? ` <a href="${it.link}" target="_blank" rel="noopener">↗</a>` : '';
      return `<div class="ins-row"><div class="ins-meta"><span class="ins-date">${ds}</span><span class="ins-owner">${clean}${link}</span></div></div>`;
    }).join('');
    return insiderShell(H, `<div class="ins-note-hint">Aşağıdaki bildirimler pay alım-satım/geri alım içerdiği tespit edilenlerdir:</div><div class="ins-list">${list}</div>`, note);
  }

  // Birleşik görünümü verilen kutuya çiz. aliveFn: async sonrası hâlâ geçerli mi (yarış koruması).
  // withNote: Sonuç bölümü için "geliştirilecek" notunu da ekle.
  async function fillCompositeInto(box, symbol, market, faScore, aliveFn, withNote) {
    if (!box) return;
    const ta = await getTaScoreFor(symbol, market, 'orta');
    if (aliveFn && !aliveFn()) return;
    if (!box.isConnected) return;
    if (!ta) {
      box.innerHTML = `<div class="fa-comp-na">🔗 Birleşik görünüm için teknik skor (orta-uzun vade) alınamadı — Teknik Analiz sekmesinden bakabilirsin.</div>` + (withNote ? spResultNote() : '');
      return;
    }
    const m = COMPOSITE_MATRIX[faBand(faScore) + ':' + taBand(ta.score)] || COMPOSITE_MATRIX['mid:mid'];
    const blended = 0.55 * faScore + 0.45 * ta.score;
    const faCls = faScore >= 60 ? 'bull' : faScore < 45 ? 'bear' : 'neutral';
    const gauge = (label, val, cls, sub) => `
      <div class="fa-comp-leg">
        <div class="fa-comp-leg-top"><span>${label}</span><b class="${cls}">${Math.round(val)}<em>/100</em></b></div>
        <div class="fa-comp-bar"><i class="${cls}" style="width:${Math.max(2, Math.min(100, val))}%"></i></div>
        <div class="fa-comp-sub">${sub}</div>
      </div>`;
    box.innerHTML = `
      <div class="fa-comp ${m.band}">
        <div class="fa-comp-head">🔗 TA + FA Birleşik Görünüm <span class="fa-comp-verdict">${m.label}</span></div>
        <div class="fa-comp-legs">
          ${gauge('Temel (FA)', faScore, faCls, 'kalite / değer · uzun vade')}
          ${gauge('Teknik (TA)', ta.score, ta.cls, 'trend / zamanlama · orta-uzun vade')}
        </div>
        <div class="fa-comp-blend">Bileşke ≈ <b>${Math.round(blended)}/100</b> <span>(FA %55 + TA %45 — farklı şeyleri ölçer, saf ortalama değildir)</span></div>
        <div class="fa-comp-txt">${m.txt}</div>
        <div class="fa-comp-disc">Temel skor uzun vadeli kaliteyi/değeri, teknik skor kısa-orta vadeli fiyat eğilimini özetler. Matematiksel bir sentezdir; öngörü kesinlik değildir. Yatırım tavsiyesi değildir.</div>
      </div>` + (withNote ? spResultNote() : '');
  }

  // Sonuç bölümü placeholder notu (plan hesaplanamadığında yedek)
  function spResultNote() {
    return `<div class="sp-result-note">Bu sembol için yatırım planı hesaplanamadı (yeterli fiyat/temel verisi yok). Yukarıdaki teknik + temel skorları birlikte değerlendir. Yatırım tavsiyesi değildir.</div>`;
  }

  // ===== Sonuç: Çok-vadeli Yatırım Planı (alım/satım bölgeleri + çıkış planı) =====
  // Mevcut seviye motorunu (computeVadeScore → levels) kısa/orta/uzun vade için çalıştırır;
  // her bölge gerçek fiyat yapısına (VP/Fib/Bollinger/SMA) + vade ATR'sine çapalıdır.
  // ABD'de F/K bazlı kaba değer bandı, ayrıca katalizör/risk (volatilite + temettü + haber uyarısı).
  const PLAN_VADES = [
    { key: 'kisa', label: 'Kısa vade', horizon: '≈ 1–3 ay' },
    { key: 'orta', label: 'Orta vade', horizon: '≈ 6–12 ay' },
    { key: 'uzun', label: 'Uzun vade', horizon: '≈ 1–3 yıl' },
  ];

  // ===== Momentum / trend-devam rejimi =====
  // Sorun: "Güçlü alış" bölgesi hep fiyatın ALTINDAKİ desteğe çapalanır. Güçlü bir
  // yükseliş trendinde fiyat oraya geri gelmez → hisse "pahalı" görünse de ralliye
  // devam eder ve derin alım bölgesini bekleyen fırsatı kaçırır. Bu fonksiyon, hâlâ
  // hesapladığımız sinyallerden (skor + SMA dizilimi + ADX + alım bölgesine uzaklık)
  // bir "trend güçlü" rejimi tespit eder ve fiyata YAKIN, kademeli bir momentum
  // girişi bölgesi önerir. Yön/kesinlik iddiası değil; fırsat maliyetini azaltmak için.
  function momentumInfo(res, vadeKey) {
    if (!res || !res.levels) return { active: false };
    const L = res.levels, p = L.price, bz = L.buyZone;
    if (p == null) return { active: false };
    const bzTop = (bz && bz[1] != null) ? bz[1] : null;
    const trendAligned = (L.sma50 != null && p > L.sma50) && (L.sma200 == null || L.sma50 >= L.sma200);
    const adx = res.adxVal;
    const strongTrend = adx != null && adx >= 22;      // ADX ≥ 22 → yönlü/güçlü trend
    const bullish = res.score >= 56;                    // en az "AL eğilimi"
    const gapPct = bzTop != null ? (p - bzTop) / p : 0; // fiyat, güçlü-alış tavanının ne kadar üstünde?
    const gapTh = { gunici: 0.02, kisa: 0.03, orta: 0.05, uzun: 0.08 }[vadeKey] || 0.04;
    const active = bullish && trendAligned && strongTrend && gapPct >= gapTh;
    if (!active) return { active: false, trendAligned, adx, gapPct };
    const atr = L.atr != null ? L.atr : p * 0.02;
    const pull = { gunici: 0.5, kisa: 0.6, orta: 1.0, uzun: 1.5 }[vadeKey] || 0.8;
    return { active: true, zone: [p - pull * atr, p], gapPct, adx, sma50: L.sma50, sma200: L.sma200 };
  }

  // ===== Alım bölgesine anlık YAKINLIK (yalnız sunum katmanı) =====
  // Alım bandı bilinçli olarak fiyatın ALTINDAKİ desteğe çapalanır ("ideal biriktirme"
  // noktası). Bu yüzden "fiyat ŞU AN bandın içinde mi?" neredeyse hiçbir zaman doğru
  // çıkmaz — kullanıcı onlarca hisse tarasa da yalnız ⚡ momentum işaretini görür.
  // Bu fonksiyon SKORU/BANDI DEĞİŞTİRMEZ; sadece mevcut fiyatın banda ATR-ölçekli
  // uzaklığını dürüstçe sınıflar ki "şu an neredeyiz" okunabilsin:
  //   in/below → fiyat bandın içinde/altında (ideal alım / hedeften ucuz)
  //   near     → banda ≤1×ATR mesafede — normal bir geri çekilmede alım aralığına iner (uygun bölge)
  //   far      → banda >1×ATR uzakta — belirgin geri çekilme gerekir (ya da güçlü trendde ⚡ momentum)
  function buyZoneProximity(res) {
    if (!res || !res.levels) return null;
    const L = res.levels, p = L.price, bz = L.buyZone;
    if (p == null || !bz || bz[0] == null || bz[1] == null) return null;
    const atr = (L.atr != null && L.atr > 0) ? L.atr : p * 0.02;
    const buyLo = bz[0], buyHi = bz[1];
    const dAtr = (p - buyHi) / atr; // fiyat bandın kaç ATR üstünde
    if (p <= buyHi * 1.001) {
      const below = p < buyLo * 0.999;
      return { state: below ? 'below' : 'in', cls: 'in', dAtr,
               txt: below ? '🟢 Fiyat alım bandının altında — hedeften ucuz'
                          : '🟢 Fiyat şu an alım bölgesinde' };
    }
    if (dAtr <= 1.0) {
      return { state: 'near', cls: 'near', dAtr,
               txt: `🟢 Uygun bölge — fiyat banda yakın (~${dAtr.toFixed(1)}×ATR); normal bir geri çekilmede alım aralığına iner` };
    }
    return { state: 'far', cls: 'far', dAtr,
             txt: `🟡 Fiyat banda uzak (~${dAtr.toFixed(1)}×ATR); belirgin bir geri çekilme daha uygun` };
  }

  // ===== Çapa niteliği + bant kayması rozeti (yalnız sunum; skoru/bandı DEĞİŞTİRMEZ) =====
  // Kullanıcının "uygun alım bölgesi sürekli kaçıyor" gözlemine dürüst yanıt: bandın altında
  // yattığı çapa gerçek/kalıcı bir seviye mi (sabit), oynaklıkla mı kayıyor (kaygan), yoksa
  // saf ATR izdüşümü mü (projeksiyon)? Ayrıca bandın ortasını localStorage'da günlük saklayıp
  // gün-günе kaymayı gösterir → "dün X, bugün Y" ile hedefin ne kadar oynadığı görünür.
  function anchorBadge(res, symbol, vadeKey) {
    if (!res || !res.levels) return '';
    const L = res.levels;
    if (!L.buyZone || L.buyZone[0] == null || L.buyZone[1] == null) return '';
    const kind = L.anchorKind || 'projeksiyon';
    const src = L.anchorSrc || 'ATR izdüşümü';
    const meta = {
      sabit:      { cls: 'sabit',      dot: '🟢', lab: 'Sabit çapa',      note: 'kalıcı bir yapısal seviyeye tutunuyor — kolay kolay kaymaz' },
      kaygan:     { cls: 'kaygan',     dot: '🟡', lab: 'Kaygan çapa',     note: 'oynaklığa göre kayan bir seviye — fiyat/ATR değiştikçe bir miktar oynar' },
      projeksiyon:{ cls: 'projeksiyon',dot: '🔴', lab: 'Projeksiyon çapa', note: 'gerçek bir destek yok, saf ATR izdüşümü — fiyat düştükçe band da düşer (bu yüzden "kaçıyor")' },
    }[kind] || { cls: 'projeksiyon', dot: '🔴', lab: 'Projeksiyon çapa', note: 'saf ATR izdüşümü' };

    // Bant ortası + gün-günе kayma (localStorage)
    const mid = (L.buyZone[0] + L.buyZone[1]) / 2;
    let driftHtml = '';
    try {
      if (symbol && vadeKey && isFinite(mid)) {
        const today = new Date().toISOString().slice(0, 10);
        const key = 'sb:band:' + symbol + ':' + vadeKey;
        let st = null;
        try { st = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { st = null; }
        if (st && st.d && st.d !== today && isFinite(st.mid)) {
          const dPct = st.mid ? (mid - st.mid) / st.mid * 100 : 0;
          if (Math.abs(dPct) >= 0.3) {
            const arrow = dPct < 0 ? '▼' : '▲';
            const dCls = dPct < 0 ? 'down' : 'up';
            driftHtml = `<div class="anc-drift ${dCls}">${arrow} Bant ortası ${st.d} → bugün: ${st.mid.toFixed(2)} → ${mid.toFixed(2)} (${dPct > 0 ? '+' : ''}${dPct.toFixed(1)}%)</div>`;
          }
        }
        // Günde bir kez güncelle: bugünün değerini sakla, önceki günü koru
        if (!st || st.d !== today) {
          const prevD = st && st.d ? st.d : null, prevMid = st && isFinite(st.mid) ? st.mid : null;
          localStorage.setItem(key, JSON.stringify({ d: today, mid, prevD, prevMid }));
        }
      }
    } catch (_) {}

    return `<div class="anc-badge ${meta.cls}">
      <div class="anc-top"><span class="anc-dot">${meta.dot}</span><span class="anc-lab">${meta.lab}</span>
        <span class="anc-src">${src}</span></div>
      <div class="anc-note">${meta.note}</div>${driftHtml}
      <div class="anc-foot">Yalnızca bilgi amaçlı — çapanın ne kadar güvenilir olduğunu gösterir, al/sat sinyali değildir.</div>
    </div>`;
  }

  // ===================== 🧮 İçsel Değer (DCF) motoru =====================
  // İndirgenmiş Nakit Akışı: 5 yıllık serbest nakit akışı projeksiyonu + Gordon
  // terminal değeri, WACC ile bugüne indirgenir. Firma değeri → net borç düşülür →
  // özkaynak → pay sayısına bölünür = içsel değer/pay. WACC ve büyüme etrafında 3×3
  // duyarlılık taraması ile TEK sayı değil bir ARALIK üretir.
  // ÖNEMLİ: Bu katman SADECE BİLGİdir; bütüncül/bileşke skora DAHİL DEĞİL (İçeriden
  // işlemler paneli gibi). Yatırım tavsiyesi değildir.

  // Yıllıklandırılmış oynaklık (log-getiri σ × √252) — CAPM beta türetimi için.
  function annualizedVol(closes) {
    if (!closes || closes.length < 30) return null;
    const arr = closes.slice(-260); // ~1 yıl
    const rets = [];
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1], b = arr[i];
      if (a > 0 && b > 0) rets.push(Math.log(b / a));
    }
    if (rets.length < 20) return null;
    const mean = rets.reduce((s, x) => s + x, 0) / rets.length;
    const varr = rets.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (rets.length - 1);
    return Math.sqrt(varr) * Math.sqrt(252);
  }

  // WACC — CAPM özkaynak maliyeti + vergi-sonrası borç maliyeti, sermaye yapısıyla
  // ağırlıklandırılır. Beta = hisse oynaklığı ÷ piyasa oynaklığı (yaklaşık, [0.6,2.2]).
  function computeWACC(a) {
    const market = a.market;
    // Piyasa varsayımları (model girdileri — kesin değil):
    // rf: risksiz getiri, erp: hisse risk primi, mktVol: endeks yıllık oynaklığı,
    // rd: şirket borç maliyeti, tax: efektif vergi, floor/cap: makul WACC bandı.
    const P = market === 'BIST'
      ? { rf: 0.30, erp: 0.055, mktVol: 0.32, rd: 0.36, tax: 0.25, floor: 0.28, cap: 0.55 }
      : { rf: 0.043, erp: 0.050, mktVol: 0.18, rd: 0.062, tax: 0.21, floor: 0.075, cap: 0.16 };
    const sVol = annualizedVol(a.closes);
    let beta = (sVol != null && P.mktVol > 0) ? sVol / P.mktVol : 1.1;
    beta = Math.max(0.6, Math.min(2.2, beta));
    const costEquity = P.rf + beta * P.erp;
    const costDebtAT = P.rd * (1 - P.tax);
    const E = (a.equityVal != null && a.equityVal > 0) ? a.equityVal : null;
    const D = (a.totalDebt != null && a.totalDebt > 0) ? a.totalDebt : 0;
    let wacc;
    if (E != null) {
      const V = E + D;
      wacc = (E / V) * costEquity + (D / V) * costDebtAT;
    } else {
      wacc = costEquity;
    }
    wacc = Math.max(P.floor, Math.min(P.cap, wacc));
    return { wacc, beta, rf: P.rf, erp: P.erp, costEquity, floor: P.floor, cap: P.cap };
  }

  // Tek senaryo içsel-değer/pay: 5 yıl FCF (g0→gT kademeli) + Gordon terminal.
  function dcfPerShare(fcf0, g0, gT, wacc, netDebt, shares) {
    if (!(fcf0 > 0) || !(shares > 0) || !(wacc > gT)) return null;
    let pv = 0, fcf = fcf0;
    for (let y = 1; y <= 5; y++) {
      // büyüme g0'dan gT'ye doğrusal yavaşlar
      const g = g0 + (gT - g0) * ((y - 1) / 4);
      fcf = fcf * (1 + g);
      pv += fcf / Math.pow(1 + wacc, y);
    }
    const terminal = (fcf * (1 + gT)) / (wacc - gT); // 5. yıl sonundaki değer
    pv += terminal / Math.pow(1 + wacc, 5);
    const equity = pv - (netDebt || 0); // firma değeri → özkaynak
    return equity / shares;
  }

  // Ana DCF: aralık + duyarlılık + ucuz/makul/pahalı rozeti. dcfIn: valuation.dcfIn.
  function computeDCF(dcfIn, closes, price) {
    if (!dcfIn) return { ok: false, reason: 'no-data' };
    const { market, fcf, netDebt, shares, totalDebt, equityVal } = dcfIn;
    if (shares == null || !(shares > 0)) return { ok: false, reason: 'no-data' };
    if (fcf == null || !(fcf > 0)) return { ok: false, reason: 'neg-fcf' };
    const w = computeWACC({ market, closes, equityVal, totalDebt });
    // Başlangıç büyümesi: geçmiş büyüme, temkinli tavan; terminal ≈ enflasyon-üstü.
    let g0 = dcfIn.growth;
    if (g0 == null || !isFinite(g0)) g0 = market === 'BIST' ? 0.20 : 0.08;
    g0 = Math.max(-0.05, Math.min(market === 'BIST' ? 0.45 : 0.25, g0));
    const gT = market === 'BIST' ? 0.10 : 0.03; // terminal büyüme (nominal)
    const base = dcfPerShare(fcf, g0, gT, w.wacc, netDebt, shares);
    if (base == null || !isFinite(base) || base <= 0) return { ok: false, reason: 'no-data' };
    // 3×3 duyarlılık: WACC ±2 puan, g0 ±3 puan.
    const vals = [];
    [-0.02, 0, 0.02].forEach((dw) => {
      [-0.03, 0, 0.03].forEach((dg) => {
        const ww = Math.max(w.floor, Math.min(w.cap, w.wacc + dw));
        const gg = Math.max(-0.05, g0 + dg);
        const v = dcfPerShare(fcf, gg, gT, ww, netDebt, shares);
        if (v != null && isFinite(v) && v > 0) vals.push(v);
      });
    });
    vals.sort((x, y) => x - y);
    const lo = vals.length ? vals[0] : base;
    const hi = vals.length ? vals[vals.length - 1] : base;
    const upside = (price != null && price > 0) ? (base - price) / price * 100 : null;
    // Rozet: fiyat aralığın altında → iskontolu; üstünde → pahalı; içinde → makul.
    let badge = 'fair';
    if (price != null) {
      if (price < lo) badge = 'cheap';
      else if (price > hi) badge = 'expensive';
    }
    return {
      ok: true, market, base, lo, hi, upside, badge, price,
      fcf, netDebt, shares, wacc: w.wacc, beta: w.beta,
      gStart: g0, gT
    };
  }

  // Sonuç ekranı DCF kartı (geniş). fmtP: para biçimlendirici.
  function dcfCardHTML(dcf, fmtP) {
    if (!dcf) return '';
    if (!dcf.ok) {
      const msg = dcf.reason === 'neg-fcf'
        ? 'Şirket şu an pozitif <b>serbest nakit akışı</b> üretmiyor — İçsel Değer (DCF) uygulanamaz. Bu profil (büyüme / tematik / ağır yatırım evresi) için değerleme F/K·PEG, PD/DD ve büyüme üzerinden yürür.'
        : 'İçsel Değer (DCF) için yeterli veri yok (serbest nakit akışı veya pay sayısı çözülemedi).';
      return `<div class="rp-dcf na"><div class="dcf-head"><span>🧮 İçsel Değer (DCF)</span></div><div class="dcf-na">${msg}</div></div>`;
    }
    const bcls = dcf.badge === 'cheap' ? 'bull' : dcf.badge === 'expensive' ? 'bear' : 'neutral';
    const blbl = dcf.badge === 'cheap' ? 'Ucuz' : dcf.badge === 'expensive' ? 'Pahalı' : 'Makul';
    const up = dcf.upside;
    const upTxt = up == null ? '—' : `${up >= 0 ? '+' : ''}%${Math.round(up)}`;
    const upCls = up == null ? '' : up >= 0 ? 'up' : 'dn';
    const shTxt = dcf.shares >= 1e9 ? (dcf.shares / 1e9).toFixed(2) + ' mlr' : (dcf.shares / 1e6).toFixed(1) + ' mn';
    return `
    <div class="rp-dcf ${bcls}">
      <div class="dcf-head"><span>🧮 İçsel Değer (DCF)</span><span class="dcf-badge ${bcls}">${blbl}</span></div>
      <div class="dcf-range">Tahmini içsel değer: <b>${fmtP(dcf.lo)} – ${fmtP(dcf.hi)}</b> <em>(orta: ${fmtP(dcf.base)})</em></div>
      <div class="dcf-up">Güncel fiyata göre <b class="${upCls}">${upTxt}</b> ${up >= 0 ? 'yukarı potansiyel' : 'aşağı risk'} <span class="dcf-price">(fiyat: ${fmtP(dcf.price)})</span></div>
      <details class="dcf-why"><summary>Varsayımlar & yöntem</summary>
        <div class="dcf-assum">
          <div>Baz serbest nakit akışı: <b>${fmtP(dcf.fcf)}</b></div>
          <div>Büyüme: <b>%${(dcf.gStart * 100).toFixed(0)} → %${(dcf.gT * 100).toFixed(0)}</b> (5 yıl, kademeli yavaşlama)</div>
          <div>İskonto (WACC): <b>%${(dcf.wacc * 100).toFixed(1)}</b> · β≈${dcf.beta.toFixed(2)}</div>
          <div>Net borç: <b>${fmtP(dcf.netDebt)}</b> · Pay sayısı: <b>${shTxt}</b></div>
          <div class="dcf-method">Firma değeri → net borç düşülür → özkaynak ÷ pay = içsel değer/pay. Aralık, WACC ±%2 ve büyüme ±%3 duyarlılığından (3×3) gelir.</div>
        </div>
      </details>
      ${dcf.market === 'BIST' ? '<div class="dcf-infl">⚠️ BIST: nominal TL bazında hesaplanır; yüksek enflasyon hem büyümeyi hem iskontoyu şişirir — çıktı reel değerden sapabilir.</div>' : ''}
      <div class="dcf-disc">Bir <b>model tahminidir</b>, kesin değer değil — girdiler (büyüme, WACC) değişince sonuç belirgin oynar. Yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.</div>
    </div>`;
  }

  // US SEC modelinden DCF girdisi kur. shares = ni/eps (mcap ≈ price·shares).
  function usDcfIn(sec, price, eps) {
    const m = sec && sec.metrics; if (!m) return null;
    const shares = (m.ni != null && eps) ? m.ni / eps : null;
    const equityVal = (shares != null && price != null) ? shares * price : null;
    const gPct = (m.revCagr != null) ? m.revCagr : m.revYoY;
    return {
      market: 'US', fcf: m.fcf, netDebt: m.netDebt, totalDebt: m.totalDebt,
      shares, equityVal, growth: (gPct != null && isFinite(gPct)) ? gPct / 100 : null
    };
  }

  // 🧭 Bütüncül Uygunluk Notu (0–10) — Sonuç ekranı + Karşılaştır ekranı ORTAK motoru.
  // Onaylı ağırlıklar: FA %25, TA %25, değerleme/alım-bandı %15, gündem %10, sektör %10, makro %10, jeopolitik %5.
  // Girdiler cache'li/ucuz kaynaklardan gelir; eksik olan bileşen nötr (0.5) kabul edilir ve "güven" düşer.
  // 🧭 Temel Uygunluk Skoru (0–10) — YALNIZ 3 taşıyıcı direk: Temel %40 · Teknik %30 · Değerleme %30.
  // Dünya/sektör/gündem sayısal skora GİRMEZ; onlar buildConjunctureNote ile ayrı "konjonktür notu" olur.
  function computeHolisticScore(o) {
    const { faScore, taScore, levels: L, valuation, momActive,
            peg, revGrowth, netMargin, forwardPE, trailingPE } = o;
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const p = L ? L.price : null, bz = L ? L.buyZone : null;

    const fPart = clamp01((faScore == null ? 50 : faScore) / 100);
    const tPart = clamp01((taScore == null ? 50 : taScore) / 100);

    // --- Büyüme-farkında değerleme direği ---
    // growthSoft (0..1): büyüme fiyatı ne kadar haklı çıkarıyor. Yüksek = banttan
    // yukarıda olmak normaldir → daha az ceza. PEG öncelikli, yoksa gelir büyümesi.
    const hasGrowth = (revGrowth != null || peg != null);
    let growthSoft = 0;
    if (revGrowth != null) growthSoft = clamp01((revGrowth - 10) / 30); // %10→0, %40+→1
    if (peg != null && peg > 0 && peg <= 1.2) growthSoft = Math.max(growthSoft, 0.8);

    // Kâr öncesi / tematik: ne trailing ne forward pozitif kazanç yok + marj ~sıfır/negatif.
    // (Yalnız değerleme verisi elimizdeyse anlamlı — Sonuç ekranı bu alanları geçmez.)
    const hasValData = (trailingPE !== undefined || forwardPE !== undefined || netMargin !== undefined);
    const noEarnings = (trailingPE == null || trailingPE <= 0) && (forwardPE == null || forwardPE <= 0);
    const thematic = hasValData && noEarnings && (netMargin == null || netMargin < 5);

    // Değerleme / uygun-alım bandı yakınlığı
    let vPart = 0.5, vConf = false, vNote = 'Alım bandı verisi sınırlı — nötr kabul edildi.';
    if (bz && bz[0] != null && bz[1] != null && p != null) {
      vConf = true;
      if (p <= bz[0]) { vPart = 1.0; vNote = 'Fiyat güçlü-alış bandının içinde/altında — teknik olarak cazip.'; }
      else if (p <= bz[1]) { vPart = 0.78; vNote = 'Fiyat uygun toplama bandında — makul giriş bölgesi.'; }
      else {
        const gap = (p - bz[1]) / bz[1];
        // Büyüme-farkında eğim: düşük büyüme 2.5 (sert) → yüksek büyüme 1.2 (yumuşak).
        // Güçlü trendde (momActive) taban yükselir: fiyata yakın kademeli giriş öngörülür.
        const slope = momActive ? 1.0 : (2.5 - growthSoft * 1.3);
        const baseFair = momActive ? 0.72 : (hasGrowth ? 0.58 + growthSoft * 0.04 : 0.60);
        vPart = clamp01(baseFair - gap * slope);
        vNote = `Fiyat alım bandının ~%${Math.round(gap * 100)} üzerinde` +
          (momActive ? ' — güçlü trendde kademeli giriş bölgesi.' :
           growthSoft >= 0.6 ? ' — ama hızlı büyüme primi kısmen haklı çıkarıyor.' :
           ' — iskonto sınırlı.');
      }
    }
    // Değerleme cezası: düz F/K yerine büyüme-farkında (PEG öncelikli).
    if (!momActive) {
      if (peg != null && peg > 1.2) {
        let pen = clamp01((peg - 1.2) / 1.6) * 0.12;      // PEG 1.2→0, PEG 2.8+→−0.12
        if (revGrowth != null && revGrowth >= 30) pen *= 0.5; // çok hızlı büyüme cezayı yarılar
        vPart = clamp01(vPart - pen);
        if (pen > 0.02) vNote += ' PEG büyümeye göre yüksek.';
      } else if (peg == null && valuation && valuation.pe != null && valuation.pe > 25
                 && !(revGrowth != null && revGrowth >= 20)) {
        // PEG yoksa: pahalı VE büyüme kanıtı yoksa cezalı (büyüyenler muaf).
        vPart = clamp01(vPart - 0.12);
        vNote += ' F/K bazında pahalı.';
      }
    }

    const parts = [
      { k: 'Temel (FA)', w: 0.40, v: fPart, note: faScore != null ? `Temel skor ${Math.round(faScore)}/100.` : 'Temel skor yok — nötr kabul edildi.', conf: faScore != null },
      { k: 'Teknik (TA)', w: 0.30, v: tPart, note: taScore != null ? `Orta vade teknik skor ${Math.round(taScore)}/100.` : 'Teknik skor yok — nötr.', conf: taScore != null },
      { k: 'Değerleme / fiyat', w: 0.30, v: vPart, note: vNote, conf: vConf },
    ];
    const composite01 = parts.reduce((a, x) => a + x.w * x.v, 0);
    const score10 = Math.round(composite01 * 100) / 10; // 0..10, 1 ondalık
    // "Sınırlı veri" yalnızca skoru taşıyan 3 direkten en az 2'si EKSİKSE anlamlı.
    const coreSoft = (faScore == null ? 1 : 0) + (taScore == null ? 1 : 0) + (vConf ? 0 : 1);
    const band =
      score10 >= 8.5 ? { l: 'Koşullar çok elverişli', c: 'bull' } :
      score10 >= 7   ? { l: 'Destekleyici', c: 'bull' } :
      score10 >= 5.5 ? { l: 'Ilımlı / seçici', c: 'neutral' } :
      score10 >= 4   ? { l: 'Zayıf — temkinli', c: 'bear' } :
                       { l: 'Olumsuz', c: 'bear' };
    return { score10, band, parts, coreSoft, thematic, growthNote: buildGrowthNote({ peg, revGrowth, netMargin, forwardPE, trailingPE, thematic }) };
  }

  // 🌱 Büyüme notu — değerlemeyi büyümeyle bağlamlandıran tek-cümle okuma.
  // PUANA DAHİL DEĞİLDİR (skor zaten büyüme-farkında); bu yalnız sunum katmanı.
  // Döner: { txt, cls } — cls ∈ good|mid|bad|thm|na. Yatırım tavsiyesi değildir.
  function buildGrowthNote(o) {
    const { peg, revGrowth, netMargin, forwardPE, trailingPE, thematic } = o;
    if (thematic) {
      return { txt: 'Kâr öncesi / tematik hisse — klasik F/K·PEG ölçütleri işlemiyor; değerleme kantitatif kapsam dışı. Öykü/momentum odaklı, spekülatif.', cls: 'thm' };
    }
    const hasPeg = peg != null && peg > 0;
    const g = revGrowth; // yüzde
    // PEG öncelikli okuma
    if (hasPeg) {
      if (peg <= 1.0) return { txt: `PEG ${peg.toFixed(2)} — büyümeye göre ucuz; hızlı büyüme fiyatı fazlasıyla karşılıyor.`, cls: 'good' };
      if (peg <= 1.5) return { txt: `PEG ${peg.toFixed(2)} — büyüme çarpanı makul; prim büyümeyle büyük ölçüde haklı.`, cls: 'good' };
      if (peg <= 2.2) return { txt: `PEG ${peg.toFixed(2)} — ölçülü prim; büyüme sürerse taşınabilir, yavaşlarsa pahalı.`, cls: 'mid' };
      return { txt: `PEG ${peg.toFixed(2)} — büyümeye göre pahalı; çarpan, mükemmel büyümenin sürmesini şart koşuyor.`, cls: 'bad' };
    }
    // PEG yoksa gelir büyümesi + kârlılıkla nitel okuma
    if (g != null) {
      if (g >= 30) return { txt: `Gelir ~%${Math.round(g)} büyüyor (PEG yok) — yüksek büyüme primi kısmen haklı; kâr istikrarını izleyin.`, cls: 'mid' };
      if (g >= 12) return { txt: `Gelir ~%${Math.round(g)} büyüyor — ılımlı büyüme; değerleme büyümeyle orantılı olmalı.`, cls: 'mid' };
      if (g >= 0)  return { txt: `Gelir büyümesi zayıf (~%${Math.round(g)}) — prim ödemek için büyüme kanıtı sınırlı.`, cls: 'bad' };
      return { txt: `Gelir daralıyor (~%${Math.round(g)}) — büyüme temelli prim gerekçesi yok.`, cls: 'bad' };
    }
    return { txt: 'Büyüme verisi sınırlı — büyüme-değerleme okuması yapılamadı.', cls: 'na' };
  }

  // 🌍 Güncel Konjonktür Notu — dünya görünümü + sektörel durum + gündem/haber.
  // Nabız/Fırsatlar motoruyla aynı ruh: tek-cümle makro yorumu + sektör/haber rozetleri.
  // PUANA DAHİL DEĞİLDİR — yalnız güncel eğilim yorumu. Sonuç ekranı için `html`,
  // Karşılaştır ekranı için kompakt `chips` döner.
  function buildConjunctureNote(o) {
    const { senti, macro, symbol } = o;
    const secs = SYMBOL_SECTORS[symbol] || [];

    // Dünya/makro duruşu (tek cümle)
    let stanceEmoji = '🌍', stanceCls = 'neu', stance;
    if (macro && macro.hasData) {
      if (macro.cls === 'hawk') {
        stanceEmoji = '🏦'; stanceCls = 'hawk';
        stance = `<b>Şahin/sıkılaşma</b>${macro.inflDir >= 0.15 ? ' + enflasyon ısınma' : ''} rüzgârı okunuyor → faize duyarlı büyüme (teknoloji/çip/REIT) baskı altında olabilir, banka nispeten korunaklı.`;
      } else if (macro.cls === 'dove') {
        stanceEmoji = '🏦'; stanceCls = 'dove';
        stance = `<b>Güvercin/gevşeme</b>${macro.inflDir <= -0.15 ? ' + enflasyon soğuma' : ''} rüzgârı okunuyor → faize duyarlı büyüme (teknoloji/çip/REIT) ve altın rahatlar.`;
      } else {
        stance = `Faiz yönü şu an <b>net değil</b>; şahin ve güvercin başlıklar dengede — faize duyarlı sektörlerde oynaklık normaldir.`;
      }
    } else {
      stance = 'Makro cephe sakin — öne çıkan faiz/enflasyon başlığı yok; hareketler daha çok hisseye özel.';
    }

    // Sektör rozeti (bu hissenin sektörlerine makro rüzgârın etkisi)
    let secChip = '';
    if (secs.length) {
      const secLbls = secs.map((s) => SECTORS[s] || s).slice(0, 2).join(' · ');
      const up = macro && macro.hasData && macro.biasUp.some((s) => secs.includes(s));
      const dn = macro && macro.hasData && macro.biasDown.some((s) => secs.includes(s));
      if (dn) secChip = `<span class="cj-chip dn">▼ Sektör baskı: ${secLbls}</span>`;
      else if (up) secChip = `<span class="cj-chip up">▲ Sektör lehte: ${secLbls}</span>`;
      else secChip = `<span class="cj-chip neu">◇ Sektör: ${secLbls} — nötr</span>`;
    }

    // Gündem / haber rozeti
    let newsChip;
    if (senti && senti.hits) {
      const cls = senti.score >= 0.15 ? 'up' : senti.score <= -0.15 ? 'dn' : 'neu';
      newsChip = `<span class="cj-chip ${cls}">🗞️ Haber nabzı: ${senti.label} (${senti.hits} sinyal)</span>`;
    } else {
      newsChip = `<span class="cj-chip neu">🗞️ Belirgin haber sinyali yok</span>`;
    }

    const chips = `${secChip}${newsChip}`;
    const html = `<div class="rp-conj ${stanceCls}">
        <div class="cj-head">🌍 Güncel konjonktür notu</div>
        <div class="cj-stance">${stanceEmoji} ${stance}</div>
        <div class="cj-chips">${chips}</div>
        <div class="cj-disc">Bu bölüm <b>puana dahil değildir</b>; güncel eğilim yorumudur, kesinlik değil. Yatırım tavsiyesi değildir.</div>
      </div>`;
    return { html, chips, stanceEmoji, stanceCls };
  }

  async function fillResultPlan(box, symbol, market, faScore, aliveFn, valuation) {
    if (!box) return;
    const daily = await ensureDailyCandles(symbol, market);
    if (aliveFn && !aliveFn()) return;
    if (!box.isConnected) return;
    if (!daily) { box.innerHTML = spResultNote(); return; }
    const bench = await ensureBenchDaily(market); // RS için endeks (plan da RS-dahil skoru kullansın)
    if (aliveFn && !aliveFn()) return;

    const curSym = (valuation && valuation.curSym) || (market === 'BIST' ? '₺' : '$');
    const fmtP = (v) => (v == null || !isFinite(v)) ? '—'
      : curSym + v.toLocaleString('tr-TR', { maximumFractionDigits: v < 10 ? 2 : v < 1000 ? 1 : 0 });

    // --- Bileşke özet (TA orta + FA) ---
    const taMid = computeVadeScore(daily, 'orta', undefined, bench);
    const midMom = momentumInfo(taMid, 'orta');
    let compHTML = '';
    if (taMid) {
      const m = COMPOSITE_MATRIX[faBand(faScore) + ':' + taBand(taMid.score)] || COMPOSITE_MATRIX['mid:mid'];
      const blended = 0.55 * faScore + 0.45 * taMid.score;
      const faCls = faScore >= 60 ? 'bull' : faScore < 45 ? 'bear' : 'neutral';
      // Momentum override: teknik trend güçlü ama temel skor zayıf (çoğu zaman yüksek
      // değerleme). Kullanıcıyı "pahalı ⇒ kaçın" yanılgısından koruyan uyarı.
      const momOver = midMom.active && faScore < 52;
      const momOverHTML = momOver ? `
          <div class="rp-mom-over">⚡ <b>Teknik trend güçlü, temel skor daha zayıf</b> — bu genelde yüksek değerleme (F/K) demektir. Güçlü momentumda hisse "pahalı" görünse de yükselişini sürdürebilir. Planı yalnızca ucuzlamayı bekleyerek değil, aşağıdaki <b>momentum girişi</b> ile birlikte değerlendir.</div>` : '';
      compHTML = `
        <div class="rp-summary ${m.band}">
          <div class="rp-verdict">${m.label}</div>
          <div class="rp-legs">
            <span>Temel <b class="${faCls}">${Math.round(faScore)}</b></span>
            <span>Teknik <b class="${taMid.cls}">${Math.round(taMid.score)}</b></span>
            <span>Bileşke <b>${Math.round(blended)}</b>/100</span>
          </div>
          <div class="rp-verdict-txt">${m.txt}</div>
          ${momOverHTML}
        </div>`;
    }

    // --- 🧭 Bütüncül Uygunluk Notu (0–10) + teknik satış hedefi ---
    let holisticHTML = '', sellTargetHTML = '';
    if (taMid && taMid.levels) {
      // Bileşen sinyalleri (hepsi cache'li / ucuz kaynaklar)
      let senti = null, macro = null;
      try { senti = await computeNewsSentiment(symbol, market); } catch (_) {}
      if (aliveFn && !aliveFn()) return;
      try { macro = await computeMacro(false); } catch (_) {}
      if (aliveFn && !aliveFn()) return;

      const L = taMid.levels, p = L.price, bz = L.buyZone;

      const { score10, band, parts, coreSoft } = computeHolisticScore({
        faScore, taScore: taMid.score, levels: L, valuation,
        momActive: !!(midMom && midMom.active),
      });
      const conj = buildConjunctureNote({ senti, macro, symbol });

      const partRows = parts.map((x) => {
        const pct = Math.round(x.v * 100);
        const dir = x.v >= 0.6 ? 'up' : x.v <= 0.4 ? 'dn' : 'mid';
        const arrow = dir === 'up' ? '▲' : dir === 'dn' ? '▼' : '—';
        return `<div class="hs-row">
          <span class="hs-k">${x.k} <em>×${Math.round(x.w * 100)}%</em></span>
          <span class="hs-bar"><i class="${dir}" style="width:${pct}%"></i></span>
          <span class="hs-v ${dir}">${arrow} ${pct}</span>
          <span class="hs-note">${x.note}</span>
        </div>`;
      }).join('');

      holisticHTML = `
        <div class="rp-holistic ${band.c}">
          <div class="hs-head">
            <span class="hs-title">🧭 Temel Uygunluk Skoru</span>
            <span class="hs-score ${band.c}"><b>${score10.toFixed(1)}</b><em>/10</em></span>
          </div>
          <div class="hs-verdict ${band.c}">${band.l}</div>
          <div class="hs-sub">“Bu hisse şu an alınır mı?” — <b>Temel (%40) · Teknik (%30) · Değerleme/fiyat (%30)</b> üzerinden hesaplanır.</div>
          <details class="hs-why"><summary>Neden bu puan? (bileşen dökümü)</summary>${partRows}</details>
          ${coreSoft >= 2 ? `<div class="hs-lowconf">⚠️ Skoru taşıyan ana bileşenlerden ${coreSoft}'si (temel/teknik/değerleme) yeterli canlı veriye dayanmıyor — puanın güveni sınırlı.</div>` : ''}
          <div class="hs-disc">Yatırım tavsiyesi değildir; kişisel durumunuza, risk toleransınıza ve zaman ufkunuza göre değişir.</div>
        </div>
        ${conj.html}`;

      // --- 🎯 Teknik satış hedefi (şimdi alınırsa) — TA odaklı ---
      const sz = L.sellZone, atr = L.atr, sma50 = L.sma50;
      const tgtMid = (sz && sz[0] != null && sz[1] != null) ? (sz[0] + sz[1]) / 2 : L.target;
      const supports = [sma50, bz && bz[1], (p != null && atr != null) ? p - 2 * atr : null].filter((x) => x != null && x < p);
      const techStop = supports.length ? Math.max(...supports) : (p != null && atr != null ? p - 2 * atr : null);
      if (p != null && tgtMid != null) {
        const gainPct = (tgtMid - p) / p * 100;
        const extended = tgtMid <= p * 1.005;
        const stopPct = techStop != null ? (techStop - p) / p * 100 : null;
        let rr = '—';
        if (techStop != null && tgtMid > p && p > techStop) rr = ((tgtMid - p) / (p - techStop)).toFixed(1) + ':1';
        const taLong = computeVadeScore(daily, 'uzun', undefined, bench);
        let extRow = '';
        if (taLong && taLong.levels && taLong.levels.sellZone) {
          const lz = taLong.levels.sellZone;
          const lMid = (lz[0] != null && lz[1] != null) ? (lz[0] + lz[1]) / 2 : null;
          if (lMid != null && lMid > tgtMid * 1.01) {
            extRow = `<div class="st-row"><span>Uzun vade uzatılmış hedef</span><b>${fmtP(lz[0])} – ${fmtP(lz[1])} <em>(≈ +%${Math.round((lMid - p) / p * 100)})</em></b></div>`;
          }
        }
        sellTargetHTML = `
          <div class="rp-selltgt">
            <div class="st-head">🎯 Teknik satış hedefi <em>(şu an alınırsa)</em></div>
            <div class="st-row"><span>Giriş (şu anki fiyat)</span><b>${fmtP(p)}</b></div>
            <div class="st-row hi"><span>Orta vade teknik hedef</span><b>${(sz && sz[0] != null) ? `${fmtP(sz[0])} – ${fmtP(sz[1])}` : fmtP(tgtMid)} <em>(≈ ${gainPct >= 0 ? '+' : ''}%${Math.round(gainPct)})</em></b></div>
            ${extRow}
            <div class="st-row"><span>Teknik geçersizleşme (stop)</span><b>${fmtP(techStop)}${stopPct != null ? ` <em>(%${Math.round(stopPct)})</em>` : ''}</b></div>
            <div class="st-row"><span>Ödül / Risk (hedef ↔ stop)</span><b>${rr}</b></div>
            ${extended ? `<div class="st-warn">⚠️ Fiyat orta vade teknik hedefe ulaşmış/aşmış — yeni alımda yukarı potansiyel sınırlı; geri çekilme ya da uzun vade hedefi daha uygun.</div>` : ''}
            <div class="st-disc">Hedef; hacim profili + Fibonacci + Bollinger üst bandı + vadeye özel ATR bandı gibi <b>teknik</b> yapılara dayanır. Kâr-al bir plandır (bölge + stop), kesin tepe tahmini değildir. Yatırım tavsiyesi değildir.</div>
          </div>`;
      }
    }

    // --- Vade kartları: alım/satım bölgeleri + çıkış planı ---
    const cards = PLAN_VADES.map(({ key, label, horizon }) => {
      const res = computeVadeScore(daily, key, undefined, bench);
      if (!res || !res.levels) return '';
      const L = res.levels, p = L.price, bz = L.buyZone, sz = L.sellZone;
      let strongBuy = '—', accumBuy = '';
      if (bz && bz[0] != null && bz[1] != null && bz[1] > bz[0]) {
        const mid = (bz[0] + bz[1]) / 2;
        strongBuy = `${fmtP(bz[0])} – ${fmtP(mid)}`;   // alt yarı = daha derin iskonto = güçlü alış
        accumBuy = `${fmtP(mid)} – ${fmtP(bz[1])}`;    // üst yarı = fiyata yakın = uygun toplama
      } else if (bz && bz[0] != null) {
        strongBuy = `≤ ${fmtP(bz[0])}`;
      }
      const sellLabel = L.sellKind === 'target' ? '🎯 Hedef bölgesi' : '🔴 Satım bölgesi';
      const sellRange = (sz && sz[0] != null && sz[1] != null) ? `${fmtP(sz[0])} – ${fmtP(sz[1])}` : '—';
      const s50 = L.sma50;
      const trendUp = (s50 != null && p != null) ? p >= s50 : null;
      const trigTxt = s50 == null ? '—'
        : trendUp ? `SMA50 ${fmtP(s50)} altına günlük kapanış`
                  : `Fiyat SMA50 ${fmtP(s50)} altında — trend zayıf`;
      // Plan tutarlılığı: risk/ödül GÖSTERİLEN bölgelere göre hesaplanır (motorun canlı-fiyat
      // stop'u değil). Giriş = alış bandı ortası, geçersizleşme = güçlü alış tabanının altı,
      // hedef = satım/hedef bandı ortası. Böylece stop daima alım bölgesinin ALTINDA kalır.
      const hw = (L.atr != null && L.zMult != null) ? L.atr * L.zMult : null;
      const entry = (bz && bz[0] != null && bz[1] != null) ? (bz[0] + bz[1]) / 2 : p;
      const invalid = (bz && bz[0] != null && hw != null) ? bz[0] - hw : L.stop;
      const tgt = (sz && sz[0] != null && sz[1] != null) ? (sz[0] + sz[1]) / 2 : L.target;
      let rr = '—';
      if (tgt != null && entry != null && invalid != null && entry > invalid) {
        rr = ((tgt - entry) / (entry - invalid)).toFixed(1) + ':1';
      }
      const trail = L.atr != null ? 2 * L.atr : null;
      const mom = momentumInfo(res, key);
      const momZone = (mom.active && mom.zone) ? `${fmtP(mom.zone[0])} – ${fmtP(mom.zone[1])}` : '';
      const prox = buyZoneProximity(res);
      const proxHtml = prox ? `<div class="rp-nowpos ${prox.cls}">${prox.txt}</div>` : '';
      return `
        <div class="rp-card ${res.cls}">
          <div class="rp-card-h">
            <span class="rp-vade">${label} <em>${horizon}</em>${mom.active ? ' <span class="rp-mom-badge">⚡ Trend güçlü</span>' : ''}</span>
            <span class="ta-sig ${res.cls}">${res.label} · ${Math.round(res.score)}</span>
          </div>
          ${proxHtml}
          <div class="rp-zones">
            ${mom.active ? `<div class="rp-zone mom"><span class="rp-zl">⚡ Momentum girişi (kademeli)</span><span class="rp-zv">${momZone}</span></div>` : ''}
            <div class="rp-zone buy"><span class="rp-zl">🟢 Güçlü alış</span><span class="rp-zv">${strongBuy}</span></div>
            ${accumBuy ? `<div class="rp-zone buy2"><span class="rp-zl">🟢 Uygun toplama</span><span class="rp-zv">${accumBuy}</span></div>` : ''}
            <div class="rp-zone sell"><span class="rp-zl">${sellLabel}</span><span class="rp-zv">${sellRange}</span></div>
          </div>
          ${anchorBadge(res, symbol, key)}
          <div class="rp-plan">
            ${mom.active ? `<span class="rp-mom-note">⚡ Trend güçlü (fiyat SMA50 üstünde${mom.sma200 != null ? ' · SMA50≥SMA200' : ''}${mom.adx != null ? ` · ADX ${Math.round(mom.adx)}` : ''}); fiyat, güçlü-alış bölgesinin ~%${Math.round(mom.gapPct * 100)} üzerinde. <b>Pahalı olsa da derin geri çekilme gelmeyebilir</b> — sadece iskonto beklemek fırsatı kaçırabilir. Kademeli giriş: bir kısmını momentum bölgesinden, kalanını güçlü-alış bölgesinde.</span>` : ''}
            <span>⊘ Geçersizleşme (alış tabanı altı): <b>${fmtP(invalid)}</b></span>
            <span>🛡️ Takip stopu: <b>2×ATR ≈ ${fmtP(trail)}</b> (açık pozisyonu fiyatın altında sürükleyerek)</span>
            <span>⚑ Trend tetiği: <b>${trigTxt}</b></span>
            <span>⚖️ R/R (alış ortası → hedef ortası): <b>${rr}</b></span>
          </div>
        </div>`;
    }).join('');

    // --- Temel değer bandı (F/K bazlı, kaba; ABD $ ve BIST ₺ ortak) ---
    let valHTML = '';
    if (valuation && valuation.eps != null) {
      const cs = valuation.curSym || '$';
      const isBist = valuation.market === 'BIST';
      // PD/DD satırı (yalnız BIST'te türetiliyor)
      const pbRow = (valuation.pb != null)
        ? `<div class="rp-val-row"><span>PD/DD (defter değeri katsayısı)</span><b>${valuation.pb.toFixed(2)}×</b></div>` : '';
      const bistCaveat = isBist
        ? ' Yüksek enflasyonda nominal net kâr (TMS 29 etkisi) F/K\'yı reel değerden saptırabilir — PD/DD ile birlikte oku.'
        : '';
      if (valuation.eps > 0) {
        const fair = valuation.eps * 18, attractive = valuation.eps * 15, strong = valuation.eps * 10;
        const peNow = valuation.pe;
        const pricey = peNow != null && peNow > 25;
        const conf = (taMid && taMid.levels && taMid.levels.price != null && taMid.levels.price <= attractive)
          ? '<span class="rp-conf good">✓ Fiyat cazip değer bölgesinde</span>'
          : pricey
            ? (midMom.active
                ? '<span class="rp-conf warn">Pahalı — ama güçlü momentum (pahalı kalabilir)</span>'
                : '<span class="rp-conf warn">Değerleme pahalı bölgede</span>')
            : '';
        const momValNote = (pricey && midMom.active)
          ? ' <b>Not:</b> Yüksek F/K çoğu zaman güçlü büyüme/momentumla birlikte gelir; teknik trend güçlüyken "pahalı" tek başına satış ya da kaçınma sinyali değildir — güçlü trendler değerlemeyi uzun süre yüksek tutabilir.'
          : '';
        valHTML = `
          <div class="rp-val">
            <div class="rp-val-h">🧮 Temel değer bandı <em>(F/K bazlı, kaba)</em> ${conf}</div>
            <div class="rp-val-row"><span>Güçlü değer (F/K ≤ 10)</span><b>≤ ${fmtP(strong)}</b></div>
            <div class="rp-val-row"><span>Cazip (F/K ≤ 15)</span><b>≤ ${fmtP(attractive)}</b></div>
            <div class="rp-val-row"><span>Makul üst sınır (F/K ≈ 18)</span><b>≈ ${fmtP(fair)}</b></div>
            ${pbRow}
            <div class="rp-val-note">Şu an ${peNow != null ? 'F/K ' + peNow.toFixed(1) : 'F/K —'} · HBK ${cs}${valuation.eps.toFixed(2)}. F/K eşikleri sektöre göre değişir — kaba referanstır, teknik bölgelerle örtüşürse güçlü sinyal.${bistCaveat}${momValNote}</div>
          </div>`;
      } else {
        valHTML = `
          <div class="rp-val">
            <div class="rp-val-h">🧮 Temel değer bandı</div>
            ${pbRow}
            <div class="rp-val-note">Şirket son 12 ayda zarar ediyor (HBK negatif) — F/K bazlı değer bandı hesaplanamıyor${valuation.pb != null ? ', PD/DD ise defter değerine göre konumu gösterir' : ''}.${bistCaveat}</div>
          </div>`;
      }
    } else if (market === 'BIST') {
      valHTML = `<div class="rp-val"><div class="rp-val-note">BIST için temel değer bandı bu sembolde hesaplanamadı (piyasa değeri/net kâr verisi alınamadı). Yukarıdaki bölgeler tekniktir.</div></div>`;
    }

    // 🧮 İçsel Değer (DCF) — SADECE BİLGİ; bileşke skora dahil değil.
    const dcfPrice = (valuation && valuation.price != null) ? valuation.price
      : (taMid && taMid.levels ? taMid.levels.price : null);
    const dcf = computeDCF(valuation && valuation.dcfIn, daily.map((c) => c.close), dcfPrice);
    const dcfHTML = dcfCardHTML(dcf, fmtP);

    box.innerHTML = `
      <div class="rp">
        ${holisticHTML}
        ${sellTargetHTML}
        ${compHTML}
        <div class="rp-cards">${cards || '<div class="empty">Vade bazlı seviye hesaplanamadı.</div>'}</div>
        ${valHTML}
        ${dcfHTML}
        <div class="rp-cat" id="rpCat"></div>
        <div class="rp-disc">Bölgeler gerçek fiyat yapısına (hacim profili, Fibonacci, Bollinger, hareketli ortalamalar) + vadeye özel ATR bandına dayanır; kesin tepe/dip ya da tarih tahmini <b>değildir</b>. Çıkış bir plandır (bölge + stop + trend tetiği), kehanet değil. Yatırım tavsiyesi değildir.</div>
      </div>`;

    fillCatalysts(symbol, market, taMid && taMid.levels, aliveFn);
  }

  // Katalizör / risk satırı — ucuz, cache'li kaynaklar (volatilite + yaklaşan temettü + haber uyarısı)
  async function fillCatalysts(symbol, market, lvl, aliveFn) {
    const items = [];
    if (lvl && lvl.atr != null && lvl.price) {
      const atrPct = lvl.atr / lvl.price * 100;
      if (atrPct >= 4) items.push({ i: '⚠️', t: `Yüksek volatilite (günlük ≈ %${atrPct.toFixed(1)}) — bölgeler geniş, giriş/çıkışta risk yüksek.` });
      else if (atrPct < 1.5) items.push({ i: 'ℹ️', t: `Düşük volatilite (günlük ≈ %${atrPct.toFixed(1)}) — sakin seyir; olası kırılımlar daha anlamlı.` });
    }
    try {
      const today = new Date();
      let divs = [];
      if (market === 'BIST') { const all = await fetchTemettuTakvimi().catch(() => []); divs = (all || []).filter((d) => d.symbol === symbol); }
      else { divs = await fetchYahooDividends(symbol).catch(() => []); }
      const upcoming = (divs || []).filter((d) => d.date > today).sort((a, b) => a.date - b.date)[0];
      if (upcoming) {
        const days = Math.round((upcoming.date - today) / 86400000);
        if (days <= 45) items.push({ i: '📅', t: `Yaklaşan temettü: ${fmtDate(upcoming.date)} (${days} gün) — tarih civarı oynaklık ve fiyat düzeltmesi olabilir.` });
      }
    } catch (e) {}
    if (aliveFn && !aliveFn()) return;
    const box = document.getElementById('rpCat'); if (!box || !box.isConnected) return;
    items.push({ i: '📰', t: 'Yeni haber / KAP açıklaması bölgeleri hızla geçersizleştirebilir — yukarıdaki 📰 Gelişmeler ve 📅 Takvim bölümlerini kontrol et.' });
    box.innerHTML = `<div class="rp-cat-h">Katalizör / Risk</div>` + items.map((x) => `<div class="rp-cat-row"><span class="rp-cat-i">${x.i}</span><span>${x.t}</span></div>`).join('');
  }

  function initFundamental() {
    const sel = document.getElementById('faSymbol');
    if (!sel) return;
    if (!faInited) {
      buildSymbolOptions(sel);
      sel.addEventListener('change', loadFundamental);
      document.getElementById('faRefresh').addEventListener('click', loadFundamental);
      // Serbest arama: portföy/listede olmayan bir hisse için temel analizi aç
      const searchInput = document.getElementById('faSearch');
      const searchBtn = document.getElementById('faSearchBtn');
      if (searchBtn) searchBtn.addEventListener('click', openFaSearch);
      if (searchInput) {
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') openFaSearch(); });
      }
      faInited = true;
    }
    loadFundamental();
  }

  // Aramadan temel analiz aç: evrensel çözümleyici (hisse/kripto/maden) → geçici sembol + yükle.
  async function openFaSearch() {
    const inp = document.getElementById('faSearch');
    const sel = document.getElementById('faSymbol');
    if (!inp || !sel) return;
    const raw = (inp.value || '').trim();
    if (raw.length < 1) return;
    const flashErr = (m) => { inp.style.borderColor = 'var(--red)'; inp.title = m || ''; setTimeout(() => { inp.style.borderColor = ''; }, 1500); };
    const prev = inp.value; inp.value = 'Aranıyor…'; inp.disabled = true;
    let c = null; try { c = await resolveOne(raw); } catch (e) {}
    inp.disabled = false; inp.value = prev;
    if (!c) { flashErr('Hisse, kripto ya da maden bulunamadı.'); return; }
    const k = candKey(c); if (!k) return;
    const key = k.market + ':' + k.symbol;
    const known = taAllSymbols().some(s => s.market === k.market && s.symbol === k.symbol);
    if (!known && !taAdhoc.some(s => s.market === k.market && s.symbol === k.symbol)) {
      taAdhoc.push({ symbol: k.symbol, market: k.market });
    }
    buildSymbolOptions(sel);
    sel.value = key;
    inp.value = '';
    loadFundamental();
  }

  async function loadFundamental() {
    const sel = document.getElementById('faSymbol');
    if (!sel || !sel.value) return;
    const [market, symbol] = sel.value.split(':');
    const wrap = document.getElementById('faContent');
    const myReq = ++faReq; // bu yüklemenin jetonu
    wrap.innerHTML = '<div class="loading">Yükleniyor…</div>';
    // Kripto & maden: klasik bilanço yok → değer/makro motoruna yönlendir (Faz D)
    const metalKey = METAL_YSYM[symbol];
    if (metalKey) { renderMetalFundamental(metalKey, wrap, myReq); return; }
    if (/-USD$/.test(symbol)) { renderCryptoFundamental(symbol, wrap, myReq); return; }

    if (market === 'US') {
      renderFundamentalUS(symbol, wrap, myReq);
    } else {
      renderFundamentalBIST(symbol, wrap, myReq);
    }
  }

  // Temel sekmesinde kripto açıldığında: bilanço yerine "Değer & Tokenomik" skoru
  async function renderCryptoFundamental(ysym, wrap, req) {
    wrap.innerHTML = '<div class="loading">Değer verisi hesaplanıyor…</div>';
    const sym = ysym.replace(/-USD$/, '');
    let coin = (typeof BM_CRYPTO !== 'undefined' ? BM_CRYPTO : []).find((c) => (c.sym || '').toUpperCase() === sym.toUpperCase());
    if (!coin) { const r = await cryptoResolve(sym); if (r && r.coin) coin = r.coin; }
    if (!faAlive(req)) return;
    if (!coin) { wrap.innerHTML = '<div class="empty">Bu kripto için değer verisi bulunamadı.</div>'; return; }
    const j = await cryptoDetail(coin.id);
    if (!faAlive(req)) return;
    if (!j) { wrap.innerHTML = '<div class="empty">Değer verisi alınamadı (CoinGecko).</div>'; return; }
    wrap.innerHTML = `<div class="fa-alt-note">${coin.name} bir kripto varlıktır — bilanço/kâr yoktur, bu yüzden klasik temel skor yerine <b>tokenomik & benimseme</b> temelli “Değer” skoru kullanılır.</div>`
      + valuePanelHTML('💠 Değer & Tokenomik skoru', computeCryptoValue(j), 'Kaynak: CoinGecko.', 'Zincir-üstü metrikler (NVT, MVRV, aktif adres) ücretli veri ister; bu skora dahil <b>değildir</b>.');
  }

  // Temel sekmesinde maden açıldığında: bilanço yerine "Makro Rejim" skoru
  async function renderMetalFundamental(key, wrap, req) {
    const info = METAL_SPOT[key]; if (!info) { wrap.innerHTML = '<div class="empty">Maden bulunamadı.</div>'; return; }
    const name = METAL_NAMES[key] || key;
    wrap.innerHTML = '<div class="loading">Makro rejim hesaplanıyor…</div>';
    const d = await metalMacroInputs(info);
    if (!faAlive(req)) return;
    wrap.innerHTML = `<div class="fa-alt-note">${name} bir emtiadır — bilanço/kâr yoktur; klasik temel skor yerine dolar, faiz, risk iştahı ve metaller-arası orana dayalı <b>Makro Rejim</b> skoru kullanılır.</div>` + metalMacroHTML(key, d);
  }

  function faRender(symbol, tiles, cards, bull, bear, extra, wrap) {
    const sigLabel = { bull: '▲ Olumlu', bear: '▼ Dikkat', neutral: '● Nötr' };
    let sumSig = 'neutral';
    if (bull > bear) sumSig = 'bull'; else if (bear > bull) sumSig = 'bear';
    const verdict = bull >= bear + 2 ? 'olumlu' : bull > bear ? 'hafif olumlu'
                  : bear >= bull + 2 ? 'temkinli / zayıf' : bear > bull ? 'hafif temkinli' : 'karışık';
    const tilesHtml = tiles.filter(t => t.val != null && t.val !== '')
      .map(t => `<div class="fa-tile"><span class="fa-lbl">${t.label}</span><span class="fa-val">${t.val}</span></div>`).join('');
    wrap.innerHTML = `
      <div class="fa-tiles">${tilesHtml}</div>
      <div class="ta-grid" style="margin-top:16px">
        <div class="ta-ind ta-summary ${sumSig}">
          <div class="ta-ind-head"><span class="ta-ind-title">Temel Değerlendirme — ${symbol}</span>
            <span class="ta-sig ${sumSig}">${sigLabel[sumSig]}</span></div>
          <div class="ta-ind-txt">${symbol} için temel görünüm <b>${verdict}</b> (${bull} olumlu / ${bear} dikkat sinyali). Temel analiz uzun vadelidir; teknik analiz ve haber akışıyla birlikte değerlendir. Yatırım tavsiyesi değildir.</div>
        </div>
        ${cards.map(c => `
          <div class="ta-ind ${c.sig}">
            <div class="ta-ind-head"><span class="ta-ind-title">${c.title}</span>
              <span class="ta-sig ${c.sig}">${sigLabel[c.sig]}</span></div>
            <div class="ta-ind-txt">${c.txt}</div>
          </div>`).join('')}
      </div>
      ${extra || ''}
    `;
  }

  // ABD hissesi — birleşik Temel Skor motoru. Veri: SEC EDGAR 10-K (gerçek mali tablolar) +
  // canlı fiyat (Yahoo) ile değerleme (F/K). stockanalysis "overview" API'si kapandığı için
  // artık ona bağlı değil. SEC verisi yoksa (ETF / yabancı 20-F) fiyat bazlı panele düşer.
  async function renderFundamentalUS(symbol, wrap, req) {
    const [metaR, secR] = await Promise.allSettled([
      fetchYahooOHLC(symbol, 'US', '1y', '1d').then(d => d.meta),
      secFetchModel(symbol),
    ]);
    if (!faAlive(req)) return;
    const meta = metaR.status === 'fulfilled' ? metaR.value : null;
    const sec = secR.status === 'fulfilled' ? secR.value : null;
    const price = meta && meta.regularMarketPrice;
    const secLink = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(symbol)}&type=10-K`;

    if (sec) {
      const criteria = sec.criteria.slice();
      const eps = sec.metrics.eps, ni = sec.metrics.ni;
      // Değerleme (F/K) — canlı fiyat / TTM (son 12 ay) seyreltilmiş HBK
      let pe = null, mcap = null;
      if (price != null && eps) {
        pe = price / eps;
        if (ni && eps) mcap = price * (ni / eps); // pay ≈ TTM net kâr / TTM HBK
        let score, note;
        if (pe < 0) { score = 15; note = `F/K negatif — şirket son 12 ayda (TTM) zarar açıklıyor (HBK ${eps.toFixed(2)}); kârlılık yok.`; }
        else {
          score = faInterp(pe, [[5, 90], [10, 80], [15, 70], [20, 60], [25, 52], [35, 38], [50, 22], [80, 10]]);
          note = `F/K ${pe.toFixed(1)} (canlı fiyat / TTM HBK) — ${pe < 15 ? 'değer bölgesi / düşük büyüme beklentisi' : pe <= 25 ? 'makul seviye' : pe <= 40 ? 'yüksek, güçlü büyüme fiyatlanıyor' : 'çok yüksek, pahalı'}.`;
        }
        criteria.push({ key: 'pe', group: 'valuation', weight: 0.10, label: 'Değerleme (F/K)', score, note });
      }
      const tiles = [
        { label: 'Son Fiyat', val: price != null ? '$' + price.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—' },
        { label: 'Piyasa Değeri', val: fmtUSD(mcap) },
        { label: 'F/K (P/E, TTM)', val: pe == null ? '—' : pe.toFixed(1) },
        { label: 'HBK (EPS, TTM)', val: eps ? '$' + eps.toFixed(2) : '—' },
      ];
      const stmtSection =
        `<div class="fa-sec-head" style="margin-top:18px">📊 Mali Tablolar — Gelir tablosu ${sec.fy} · bilanço ${sec.bsDate} · Kaynak: SEC EDGAR (10-K + son 10-Q)</div>` +
        `<div class="fa-tiles">${sec.statementTiles.map(t => `<div class="fa-tile"><span class="fa-lbl">${t.label}</span><span class="fa-val">${t.val}</span></div>`).join('')}</div>`;
      const disc = `<p class="hint ta-disclaimer">Skor: gerçek mali tablolar (SEC EDGAR — gelir/nakit akışı son 12 ay TTM, bilanço en güncel çeyrek) + değerleme (canlı fiyat / TTM HBK). FAVÖK = Faaliyet Kârı + Amortisman. Temel analiz uzun vadelidir; teknik + haber akışıyla birlikte değerlendir. Yatırım tavsiyesi değildir. · <a href="${secLink}" target="_blank" rel="noopener">SEC EDGAR ↗</a></p>`;
      renderFaScored(wrap, symbol, 'US', tiles, criteria, 'SEC EDGAR (TTM + son çeyrek)', COMPOSITE_SLOT + INSIDER_SLOT + stmtSection + disc);
      const full = computeFaScore(criteria);
      if (full.score != null) fillComposite(symbol, 'US', full.score, req);
      fillInsider(symbol, 'US', req);
      return;
    }

    // SEC verisi yok (ETF / yabancı 20-F IFRS) → fiyat bazlı asgari panel
    if (!meta) { wrap.innerHTML = '<div class="empty">Veri alınamadı (SEC + fiyat). Kod doğru mu? Tekrar dene.</div>'; return; }
    const hi = meta.fiftyTwoWeekHigh, lo = meta.fiftyTwoWeekLow;
    const pos = (hi && lo && hi > lo) ? ((price - lo) / (hi - lo) * 100) : null;
    const tiles = [
      { label: 'Son Fiyat', val: price ? '$' + price.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—' },
      { label: '52 Hafta En Yüksek', val: hi ? '$' + hi.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—' },
      { label: '52 Hafta En Düşük', val: lo ? '$' + lo.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—' },
      { label: '52H Bant Konumu', val: pos == null ? '—' : '%' + pos.toFixed(0) },
    ];
    const cards = [];
    let bull = 0, bear = 0;
    if (pos != null) {
      let s = 'neutral', t;
      if (pos >= 80) { s = 'bull'; t = `Fiyat 52 haftalık bandın üst %${(100 - pos).toFixed(0)}'lik diliminde — zirveye yakın.`; bull++; }
      else if (pos <= 20) { s = 'bear'; t = `Fiyat 52 haftalık bandın alt %${pos.toFixed(0)}'lik diliminde — zayıf.`; bear++; }
      else { t = `Fiyat 52 haftalık bandın ortasında (%${pos.toFixed(0)}).`; }
      cards.push({ title: '52 Hafta Konumu', sig: s, txt: t });
    }
    const extra =
      `<p class="fa-desc">Bu sembol SEC'e ABD-GAAP 10-K vermiyor (ETF ya da yabancı / 20-F IFRS dosyalayan şirket olabilir) — temel skor hesaplanamıyor, yalnız fiyat bazlı konum gösteriliyor. ETF'ler için Teknik Analiz sekmesi daha uygundur.</p>` +
      `<p class="hint ta-disclaimer">Fiyat kaynağı: Yahoo Finance · Yatırım tavsiyesi değildir.</p>`;
    faRender(symbol, tiles, cards, bull, bear, extra, wrap);
  }

  // İş Yatırım MaliTablo (XI_29) — tek çağrıda bilanço + gelir tablosu + nakit akışı,
  // en güncel 4 yıllık (period=12) dönem. CORS proxy üzerinden çekilir.
  async function fetchIsYatirimMali(symbol) {
    const base = 'https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/MaliTablo';
    const build = (y1) => `${base}?companyCode=${encodeURIComponent(symbol)}&exchange=TRY&financialGroup=XI_29`
      + `&year1=${y1}&period1=12&year2=${y1 - 1}&period2=12&year3=${y1 - 2}&period3=12&year4=${y1 - 3}&period4=12`;
    const nowY = new Date().getFullYear();
    for (const y1 of [nowY - 1, nowY - 2, nowY]) { // en güncel tam yıldan geriye
      try {
        const txt = await fetchVia(build(y1), { timeout: 15000 });
        const j = JSON.parse(txt);
        if (j && j.ok && Array.isArray(j.value) && j.value.length) {
          const hasV1 = j.value.some(it => it.value1 != null && it.value1 !== '' && it.value1 !== '0');
          if (hasV1) return { years: [y1, y1 - 1, y1 - 2, y1 - 3], rows: j.value };
        }
      } catch (_) { /* sıradaki yıl */ }
    }
    return null;
  }
  function parseIsMali(res) {
    const num = (s) => { if (s == null || s === '') return null; const v = parseFloat(String(s).replace(/,/g, '')); return isNaN(v) ? null : v; };
    const m = {};
    for (const it of res.rows) if (it.itemCode) m[it.itemCode] = [num(it.value1), num(it.value2), num(it.value3), num(it.value4)];
    return { years: res.years, get: (code) => m[code] || [null, null, null, null] };
  }

  // Mali tablodan metrikleri türet + 0–100 kriter dizisi kur (checklist + Piotroski)
  function bistFundamentalModel(mali, meta) {
    const g = mali.get;
    const P = (arr, i = 0) => (arr && arr[i] != null) ? arr[i] : null;
    const rev = g('3C'), gross = g('3D'), op = g('3DF'), da = g('4B'), ocf = g('4C'), fcfRow = g('4CB');
    const ca = g('1A'), lta = g('1AK'), cash = g('1AA'), sinv = g('1AB'), inv = g('1AF');
    const cl = g('2A'), stDebt = g('2AA'), ltDebt = g('2BA'), eq = g('2N');
    const revenue = P(rev);
    let netProfit = P(g('3L')); if (netProfit == null) netProfit = P(g('3J')); if (netProfit == null) netProfit = P(g('2OCF'));
    const grossP = P(gross), opP = P(op), dep = P(da), operCF = P(ocf), freeCF = P(fcfRow);
    const curAssets = P(ca), ltAssets = P(lta), cashV = P(cash) || 0, shInv = P(sinv) || 0;
    const curLiab = P(cl), stFin = P(stDebt) || 0, ltFin = P(ltDebt) || 0, equity = P(eq);
    const totalAssets = (curAssets != null && ltAssets != null) ? curAssets + ltAssets : null;

    const pct = (x) => x == null ? null : x * 100;
    const netMargin = pct(faSD(netProfit, revenue));
    const ebitda = (opP != null && dep != null) ? opP + dep : null;
    const ebitdaMargin = pct(faSD(ebitda, revenue));
    const ocfMargin = pct(faSD(operCF, revenue));
    const fcfMargin = pct(faSD(freeCF, revenue));
    const grossMargin = pct(faSD(grossP, revenue));
    const currentRatio = faSD(curAssets, curLiab);
    const inventoryV = P(inv);
    // Asit-test (quick ratio) = (dönen varlıklar − stoklar) / kısa vadeli borç. Stok en az likit
    // dönen varlıktır; arındırılmış oran en katı likidite ölçüsüdür (İş Yatırım stok kalemi 1AF).
    const quickRatio = (curAssets != null && curLiab) ? (curAssets - (inventoryV || 0)) / curLiab : null;
    const cashTotal = cashV + shInv;
    const totalFinDebt = stFin + ltFin;
    const netDebt = totalFinDebt - cashTotal;
    const ndToEbitda = (ebitda != null && ebitda > 0) ? faSD(netDebt, ebitda) : null;
    const roe = pct(faSD(netProfit, equity));
    const roa = pct(faSD(netProfit, totalAssets));
    const d2e = faSD(totalFinDebt, equity);
    // trend (dönem 0 vs 1) ve büyüme (0 vs 3)
    const prevRev = P(rev, 1), rev3 = P(rev, 3), prevNet = P(g('3L'), 1);
    const revYoY = (prevRev != null && prevRev > 0) ? (revenue - prevRev) / prevRev * 100 : null;
    const revCagr = (revenue != null && revenue > 0 && rev3 != null && rev3 > 0) ? (Math.pow(revenue / rev3, 1 / 3) - 1) * 100 : null;
    const netGrowth = (prevNet != null && prevNet !== 0) ? (netProfit - prevNet) / Math.abs(prevNet) * 100 : null;
    const totalAssets1 = (P(ca, 1) != null && P(lta, 1) != null) ? P(ca, 1) + P(lta, 1) : null;
    const roa1 = pct(faSD(prevNet, totalAssets1));
    const grossMargin1 = pct(faSD(P(gross, 1), prevRev));
    const currentRatio1 = faSD(P(cl, 1) != null ? P(ca, 1) : null, P(cl, 1));

    const C = [];
    const add = (o) => C.push(o);
    // — Kârlılık —
    if (netMargin != null) add({ key: 'netMargin', group: 'profitability', weight: 0.11, label: 'Net Kâr Marjı',
      score: faInterp(netMargin, [[-5, 0], [0, 25], [10, 68], [20, 90], [30, 100]]),
      note: `Net marj %${netMargin.toFixed(1)} — ${netMargin >= 10 ? 'sağlıklı, ≥%10 hedefinin üzerinde' : netMargin > 0 ? 'ince marj, ≥%10 hedefinin altında' : 'şirket zarar ediyor'}.` });
    if (ocfMargin != null) add({ key: 'ocfMargin', group: 'profitability', weight: 0.09, label: 'Faaliyet Nakit Akışı Marjı',
      score: faInterp(ocfMargin, [[0, 18], [10, 50], [20, 72], [30, 90], [45, 100]]),
      note: `Faaliyet nakit akışı / satış %${ocfMargin.toFixed(1)} — kazançların nakde dönüşümü. Checklist eşiği ≥%30 (yüksek kaliteli iş modeli).` });
    if (roe != null) add({ key: 'roe', group: 'profitability', weight: 0.10, label: 'Özkaynak Kârlılığı (ROE)',
      score: faInterp(roe, [[0, 18], [10, 52], [15, 70], [20, 88], [30, 100]]),
      note: `ROE %${roe.toFixed(1)} — özkaynağın kâra dönüşümü. Yüksek enflasyonda nominal ROE şişebilir; reel getiri için enflasyonla kıyasla.` });
    // — Büyüme —
    if (revYoY != null) add({ key: 'revYoY', group: 'growth', weight: 0.08, label: 'Gelir Büyümesi (YoY)',
      score: faInterp(revYoY, [[-15, 8], [0, 35], [10, 55], [20, 76], [40, 92], [70, 100]]),
      note: `Yıllık gelir büyümesi %${revYoY.toFixed(1)}. ⚠ Nominal TRY — yüksek enflasyon büyümeyi olduğundan yüksek gösterir; reel büyüme için enflasyondan arındır.` });
    if (revCagr != null) add({ key: 'revCagr', group: 'growth', weight: 0.07, label: '3 Yıllık Gelir BYBO',
      score: faInterp(revCagr, [[-15, 8], [0, 35], [10, 55], [20, 76], [40, 92], [70, 100]]),
      note: `3 yıllık bileşik gelir büyümesi %${revCagr.toFixed(1)}/yıl. Checklist eşiği ~%20 (büyüme hissesi). ⚠ Nominal TRY.` });
    if (netGrowth != null) add({ key: 'netTrend', group: 'growth', weight: 0.07, label: 'Net Kâr Yönü',
      score: faInterp(netGrowth, [[-30, 15], [0, 45], [10, 62], [30, 82], [60, 95]]),
      note: `Net kâr geçen yıla göre %${netGrowth.toFixed(0)} ${netGrowth >= 0 ? 'arttı' : 'azaldı'} — kâr momentumu ${netGrowth >= 0 ? 'olumlu' : 'zayıf'}.` });
    // — Borç / Finansal Sağlık —
    if (ltFin <= 0 && (netProfit != null || equity != null)) add({ key: 'cashLt', group: 'solvency', weight: 0.08, label: 'Nakit / Uzun Vadeli Borç',
      score: 100, note: `Uzun vadeli finansal borç ~yok — likidite açısından çok güçlü.` });
    else if (ltFin > 0) add({ key: 'cashLt', group: 'solvency', weight: 0.08, label: 'Nakit / Uzun Vadeli Borç',
      score: faInterp(cashTotal / ltFin, [[0, 22], [0.5, 45], [1, 63], [1.5, 84], [3, 100]]),
      note: `Nakit+kısa vade yatırım / uzun vadeli finansal borç = ${(cashTotal / ltFin).toFixed(2)}. Checklist eşiği ≥1.5.` });
    if (ndToEbitda != null) add({ key: 'ndEbitda', group: 'solvency', weight: 0.09, label: 'Net Borç / FAVÖK',
      score: netDebt < 0 ? 100 : faInterp(ndToEbitda, [[0, 92], [1.5, 78], [3, 55], [4, 38], [6, 12]]),
      note: netDebt < 0 ? `Net nakit pozisyonu (${fmtTL(-netDebt)} fazla) — borçtan arınmış.` : `Net finansal borç / FAVÖK = ${ndToEbitda.toFixed(1)}x — ${ndToEbitda <= 3 ? 'düşük kaldıraç' : ndToEbitda <= 4 ? 'orta kaldıraç' : 'yüksek kaldıraç, faiz riski'}.` });
    if (d2e != null) add({ key: 'd2e', group: 'solvency', weight: 0.06, label: 'Finansal Borç / Özkaynak',
      score: faInterp(d2e, [[0, 95], [0.5, 84], [1, 66], [2, 42], [3, 16]]),
      note: `Finansal borç / özkaynak = ${d2e.toFixed(2)} — ${d2e < 1 ? 'sağlıklı sermaye yapısı' : d2e <= 2 ? 'orta kaldıraç' : 'yüksek kaldıraç'}.` });
    // — Likidite —
    if (currentRatio != null) add({ key: 'curRatio', group: 'liquidity', weight: 0.05, label: 'Cari Oran',
      score: faInterp(currentRatio, [[0.7, 12], [1, 45], [1.5, 80], [2, 92], [3, 100]]),
      note: `Cari oran ${currentRatio.toFixed(2)} — kısa vadeli borç karşılama gücü. Checklist eşiği ≥1.5.` });
    if (quickRatio != null) add({ key: 'quickRatio', group: 'liquidity', weight: 0.04, label: 'Asit-Test (Likit) Oranı',
      score: faInterp(quickRatio, [[0.4, 12], [0.7, 40], [1, 72], [1.5, 92], [2.5, 100]]),
      note: `Asit-test ${quickRatio.toFixed(2)} — stok hariç dönen varlık / kısa vadeli borç. Stok en az likit kalemdir; ${inventoryV ? `stok arındırılınca (${fmtTL(inventoryV)}) ` : ''}en katı likidite ölçüsü. Checklist eşiği ≥1.` });
    // — Kalite & Trend (Piotroski) —
    if (freeCF != null) add({ key: 'fcfPos', group: 'quality', weight: 0.05, label: 'Serbest Nakit Akışı',
      score: freeCF > 0 ? faInterp(fcfMargin != null ? fcfMargin : 4, [[0, 55], [5, 72], [12, 88], [22, 100]]) : 34,
      note: `Serbest nakit akışı ${fmtTL(freeCF)}${fcfMargin != null ? ` (satışın %${fcfMargin.toFixed(1)}'i)` : ''} — ${freeCF > 0 ? 'pozitif; temettü/borç azaltma/geri alım kapasitesi (olumlu)' : 'negatif; büyük yatırım ya da nakit zorlanması (dikkat)'}. Faaliyet nakdinden yatırım harcaması düşülür.` });
    if (operCF != null && netProfit != null) add({ key: 'accruals', group: 'quality', weight: 0.06, label: 'Nakit Kalitesi (OCF > Net Kâr)',
      score: operCF > netProfit ? 85 : 40,
      note: `Faaliyet nakit akışı (${fmtTL(operCF)}) net kârın (${fmtTL(netProfit)}) ${operCF > netProfit ? 'üzerinde — kazançlar nakitle destekli (olumlu)' : 'altında — kâr nakde tam dönüşmüyor (dikkat)'}.` });
    if (roa != null && roa1 != null) add({ key: 'roaUp', group: 'quality', weight: 0.05, label: 'Aktif Kârlılığı Trendi (ROA↑)',
      score: roa > roa1 ? 85 : 40, note: `ROA %${roa1.toFixed(1)} → %${roa.toFixed(1)} — ${roa > roa1 ? 'iyileşiyor' : 'geriliyor'}.` });
    if (grossMargin != null && grossMargin1 != null) add({ key: 'gmUp', group: 'quality', weight: 0.04, label: 'Brüt Marj Trendi',
      score: grossMargin > grossMargin1 ? 82 : 42, note: `Brüt marj %${grossMargin1.toFixed(1)} → %${grossMargin.toFixed(1)} — ${grossMargin > grossMargin1 ? 'güçleniyor (fiyatlama gücü)' : 'zayıflıyor (maliyet baskısı)'}.` });
    if (currentRatio != null && currentRatio1 != null) add({ key: 'crUp', group: 'quality', weight: 0.03, label: 'Cari Oran Trendi',
      score: currentRatio > currentRatio1 ? 78 : 45, note: `Cari oran ${currentRatio1.toFixed(2)} → ${currentRatio.toFixed(2)} — likidite ${currentRatio > currentRatio1 ? 'güçleniyor' : 'zayıflıyor'}.` });

    const price = meta && meta.regularMarketPrice;
    const tiles = [
      { label: 'Son Fiyat', val: price ? fmtTRY(price) : '—' },
      { label: 'Mali Dönem', val: mali.years[0] + ' yıllık' },
      { label: 'Gelir', val: fmtTL(revenue) },
      { label: 'Net Kâr', val: fmtTL(netProfit) },
      { label: 'Serbest Nakit Akışı', val: freeCF == null ? '—' : fmtTL(freeCF) },
      { label: 'Net Marj', val: netMargin == null ? '—' : '%' + netMargin.toFixed(1) },
      { label: 'FAVÖK Marjı', val: ebitdaMargin == null ? '—' : '%' + ebitdaMargin.toFixed(1) },
      { label: 'Özkaynak Kârlılığı', val: roe == null ? '—' : '%' + roe.toFixed(1) },
      { label: 'Cari Oran', val: currentRatio == null ? '—' : currentRatio.toFixed(2) },
      { label: 'Asit-Test Oranı', val: quickRatio == null ? '—' : quickRatio.toFixed(2) },
      { label: 'Nakit + KV Yatırım', val: fmtTL(cashTotal) },
      { label: 'Finansal Borç (top.)', val: fmtTL(totalFinDebt) },
      { label: 'Net Borç', val: fmtTL(netDebt) },
      { label: 'Özkaynak', val: fmtTL(equity) },
      { label: 'Gelir Büyümesi (YoY)', val: revYoY == null ? '—' : '%' + revYoY.toFixed(1) },
      { label: '3Y Gelir BYBO', val: revCagr == null ? '—' : '%' + revCagr.toFixed(1) },
    ];
    return { tiles, criteria: C, metrics: { netProfit, equity, price, freeCF, netDebt, totalDebt: totalFinDebt, ebitda, revCagr, revYoY } };
  }

  // İş Yatırım şirket kartından piyasa değerini (mnTL) çeker → TL. Sonuç değer bandı için
  // pay sayısı = piyasa değeri / fiyat türetilir (nominal ödenmiş sermayeyle örtüşür, par 1₺).
  const bistMcapCache = {};
  async function fetchBistMarketCap(symbol) {
    if (bistMcapCache[symbol] !== undefined) return bistMcapCache[symbol];
    let mcap = null;
    try {
      const url = `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${encodeURIComponent(symbol)}`;
      const html = await fetchVia(url, { timeout: 15000 });
      // "Piyasa Değeri 1.733.940,0 mnTL" — Türkçe karakterden bağımsız, ASCII çapa
      const m = html && html.match(/Piyasa[\s\S]{0,60}?([0-9][0-9.]*,[0-9]+)\s*mnTL/i);
      if (m) { const v = parseFloat(m[1].replace(/\./g, '').replace(',', '.')); if (isFinite(v) && v > 0) mcap = v * 1e6; }
    } catch (e) { mcap = null; }
    bistMcapCache[symbol] = mcap;
    return mcap;
  }

  // model.metrics + piyasa değeri → F/K, PD/DD, HBK, pay sayısı (BIST değerleme çekirdeği).
  // Hem Sonuç değer bandı hem Temel Analiz sekmesi tile'ları bunu kullanır.
  async function bistValuation(symbol, metrics) {
    if (!metrics || metrics.price == null || metrics.price <= 0 || metrics.netProfit == null) return null;
    const mcap = await fetchBistMarketCap(symbol);
    if (mcap == null || mcap <= 0) return null;
    const shares = mcap / metrics.price;
    const eps = metrics.netProfit / shares;
    const pe = metrics.netProfit !== 0 ? mcap / metrics.netProfit : null;
    const pb = (metrics.equity != null && metrics.equity !== 0) ? mcap / metrics.equity : null;
    const gPct = (metrics.revCagr != null) ? metrics.revCagr : metrics.revYoY;
    const dcfIn = {
      market: 'BIST', fcf: metrics.freeCF, netDebt: metrics.netDebt,
      totalDebt: metrics.totalDebt, shares, equityVal: mcap,
      growth: (gPct != null && isFinite(gPct)) ? gPct / 100 : null
    };
    return { curSym: '₺', eps, pe, pb, price: metrics.price, mcap, shares, market: 'BIST', dcfIn };
  }

  async function renderFundamentalBIST(symbol, wrap, req) {
    // fiyat (Yahoo) + mali tablo (İş Yatırım) paralel
    const [metaR, maliR] = await Promise.allSettled([
      fetchYahooOHLC(symbol, 'BIST', '1y', '1d').then(d => d.meta),
      fetchIsYatirimMali(symbol),
    ]);
    if (req != null && !faAlive(req)) return; // kullanıcı başka sembole geçtiyse ezmesin
    const meta = metaR.status === 'fulfilled' ? metaR.value : null;
    const maliRaw = maliR.status === 'fulfilled' ? maliR.value : null;
    const cardLink = `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${symbol}`;

    if (maliRaw) {
      const mali = parseIsMali(maliRaw);
      const model = bistFundamentalModel(mali, meta);
      // Değerleme oranları (F/K, PD/DD): piyasa değerini şirket kartından çekip türet.
      const val = await bistValuation(symbol, model.metrics);
      if (req != null && !faAlive(req)) return;
      let tiles = model.tiles;
      let valDesc = `Değerleme oranları (F/K, PD/DD) piyasa değeri alınamadığı için bu sembolde hesaplanamadı.`;
      if (val) {
        const valTiles = [
          { label: 'Piyasa Değeri', val: fmtTL(val.mcap) },
          { label: 'F/K', val: val.pe == null ? '—' : (val.pe < 0 ? 'z.' : val.pe.toFixed(1)) },
          { label: 'PD/DD', val: val.pb == null ? '—' : val.pb.toFixed(2) },
          { label: 'HBK', val: val.eps == null ? '—' : fmtTRY(val.eps) },
        ];
        // Değerleme tile'larını "Son Fiyat" ile "Gelir" arasına yerleştir (fiyat bağlamının hemen ardına).
        tiles = model.tiles.slice(0, 2).concat(valTiles, model.tiles.slice(2));
        valDesc = `Değerleme: F/K ${val.pe == null ? '—' : (val.pe < 0 ? 'negatif (zarar)' : val.pe.toFixed(1))}, PD/DD ${val.pb == null ? '—' : val.pb.toFixed(2)} — piyasa değeri (İş Yatırım şirket kartı) ÷ net kâr / özsermaye. ⚠ Yüksek enflasyonda nominal net kâr (TMS 29) F/K'yı reel değerden saptırabilir; PD/DD defter değerine dayandığı için daha dengeli okunur.`;
      }
      const extra =
        COMPOSITE_SLOT + INSIDER_SLOT +
        `<p class="fa-desc">Mali tablolar İş Yatırım'dan (TFRS, ${mali.years[0]} yıllık) çekilir; skor bu kalemlerden hesaplanır. ${valDesc} Yüksek enflasyon ortamında nominal büyüme/ROE rakamları reel performanstan sapabilir.</p>` +
        `<p class="hint ta-disclaimer">Kaynak: <a href="${cardLink}" target="_blank" rel="noopener">İş Yatırım — ${symbol} ↗</a> · Temel analiz uzun vadelidir; teknik analiz ve haber akışıyla birlikte değerlendir. Yatırım tavsiyesi değildir.</p>`;
      renderFaScored(wrap, symbol, 'BIST', tiles, model.criteria, 'İş Yatırım (TFRS)', extra);
      const fa = computeFaScore(model.criteria);
      if (fa.score != null) fillComposite(symbol, 'BIST', fa.score, req);
      fillInsider(symbol, 'BIST', req);
      return;
    }

    // Mali tablo alınamadı → fiyat bazlı asgari panele düş
    if (!meta) { wrap.innerHTML = '<div class="empty">Veri alınamadı (mali tablo + fiyat). Kod doğru mu? Tekrar dene.</div>'; return; }
    const price = meta.regularMarketPrice, hi = meta.fiftyTwoWeekHigh, lo = meta.fiftyTwoWeekLow;
    const pos = (hi && lo && hi > lo) ? ((price - lo) / (hi - lo) * 100) : null;
    const tiles = [
      { label: 'Son Fiyat', val: price ? fmtTRY(price) : '—' },
      { label: '52 Hafta En Yüksek', val: hi ? fmtTRY(hi) : '—' },
      { label: '52 Hafta En Düşük', val: lo ? fmtTRY(lo) : '—' },
      { label: '52H Bant Konumu', val: pos == null ? '—' : '%' + pos.toFixed(0) },
    ];
    const cards = [];
    let bull = 0, bear = 0;
    if (pos != null) {
      let s = 'neutral', t;
      if (pos >= 80) { s = 'bull'; t = `Fiyat 52 haftalık bandın üst %${(100 - pos).toFixed(0)}'lik diliminde — zirveye yakın.`; bull++; }
      else if (pos <= 20) { s = 'bear'; t = `Fiyat 52 haftalık bandın alt %${pos.toFixed(0)}'lik diliminde — zayıf.`; bear++; }
      else { t = `Fiyat 52 haftalık bandın ortasında (%${pos.toFixed(0)}).`; }
      cards.push({ title: '52 Hafta Konumu', sig: s, txt: t });
    }
    const extra =
      `<p class="fa-desc">İş Yatırım mali tablosu şu an alınamadı (proxy/kaynak geçici sorunu olabilir) — yalnız fiyat bazlı konum gösteriliyor. Tam skor için ↻ ile tekrar dene.</p>` +
      `<p class="hint ta-disclaimer"><a href="${cardLink}" target="_blank" rel="noopener">İş Yatırım — ${symbol} şirket kartı ↗</a> · Yatırım tavsiyesi değildir.</p>`;
    faRender(symbol, tiles, cards, bull, bear, extra, wrap);
  }

  // ===== SEC EDGAR — ABD şirketleri için ayrıntılı mali tablolar =====
  // SEC yalnız kendi vercel proxy'imizden geçer (diğer CORS proxy'leri sec.gov'u reddediyor;
  // proxy SEC'e iletişim bilgili User-Agent gönderir). Bu yüzden fetchVia'nın proxy-döngüsü
  // yerine tek proxy + 404'te HIZLI null döndüren özel bir getirici kullanılır — eksik us-gaap
  // etiketleri (404) aksi halde 3 proxy'yi de timeout'a düşürüp saniyelerce takılırdı.
  async function secGet(url, timeout = 12000) {
    const base = window.MY_PROXY;
    if (!base) return null;
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(base + encodeURIComponent(url), { signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) return null; // 404/403 → hızlı null, proxy döngüsü yok
      const txt = await res.text();
      return (txt && txt.length > 2) ? txt : null;
    } catch (e) { return null; }
  }
  let secCikMap = null;
  async function secResolveCik(symbol) {
    if (!secCikMap) {
      const txt = await secGet('https://www.sec.gov/files/company_tickers.json', 15000);
      if (!txt) return null;
      const obj = JSON.parse(txt);
      secCikMap = {};
      Object.values(obj).forEach(e => { if (e && e.ticker) secCikMap[e.ticker.toUpperCase()] = String(e.cik_str).padStart(10, '0'); });
    }
    return secCikMap[symbol.toUpperCase()] || null;
  }
  // Bir kavram için us-gaap etiketlerini dene ve EN GÜNCEL veriye sahip seriyi döndür.
  // (İlk dolu etiketi almak yanıltıcı olur: şirket etiket değiştirince eski etiket hâlâ
  //  eski/mükerrer veri döndürebilir — ör. NVDA gelirini RevenueFromContract→Revenues'e taşıdı.)
  async function secConcept(cik, tags) {
    let best = null, bestEnd = -Infinity;
    for (const tag of tags) {
      const txt = await secGet(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`);
      if (!txt) continue;
      try {
        const j = JSON.parse(txt);
        const arr = j.units && (j.units.USD || Object.values(j.units)[0]);
        if (arr && arr.length) {
          const maxEnd = Math.max(...arr.map(e => new Date(e.end).getTime() || 0));
          if (maxEnd > bestEnd) { bestEnd = maxEnd; best = arr; }
        }
      } catch (e) { /* bozuk JSON — atla */ }
    }
    return best;
  }
  // İstekleri partilere bölerek SEC hız limitini aşma
  async function secBatches(thunks, size = 6) {
    const out = [];
    for (let i = 0; i < thunks.length; i += size) {
      out.push(...await Promise.all(thunks.slice(i, i + size).map(f => f())));
    }
    return out;
  }
  // En güncel önce sırala + aynı döneme (yıl-ay) düşen mükerrer kayıtları ele
  function secDedupeDesc(arr) {
    const pool = arr.slice().sort((a, b) => new Date(b.end) - new Date(a.end));
    const seen = new Set(), uniq = [];
    for (const e of pool) { const k = String(e.end).slice(0, 7); if (!seen.has(k)) { seen.add(k); uniq.push(e); } }
    return uniq;
  }
  // Yıllık dönemsel (gelir/nakit akışı) seri — en güncel önce, tercihen 10-K
  function secAnnualSeries(arr) {
    if (!arr) return [];
    const yr = arr.filter(e => e.start && e.end &&
      (() => { const d = (new Date(e.end) - new Date(e.start)) / 86400000; return d >= 340 && d <= 380; })());
    const tenK = yr.filter(e => e.form === '10-K');
    return secDedupeDesc(tenK.length ? tenK : yr);
  }
  // Yıllık bilanço serisi (anlık kalem) — 10-K tercihli, en güncel önce
  function secBsSeries(arr) {
    if (!arr) return [];
    const tenK = arr.filter(e => e.form === '10-K');
    return secDedupeDesc(tenK.length ? tenK : arr);
  }

  // ---- TTM (son 12 ay) + güncel çeyrek bilanço yardımcıları ----
  // Sorun: sadece 10-K (yıllık) okumak veriyi bayatlatır (F/K yanlış). Çözüm: akış
  // kalemleri TTM, bilanço en güncel çeyrek (10-Q dahil).
  const secDur = (e) => (new Date(e.end) - new Date(e.start)) / 86400000;
  function secUniqPeriods(arr) { // start|end'e göre tekilleştir (SEC aynı dönemi farklı fy etiketiyle verir)
    const s = new Set(), o = [];
    for (const e of (arr || [])) { if (!e.start || !e.end) continue; const k = e.start + '|' + e.end; if (s.has(k)) continue; s.add(k); o.push(e); }
    return o;
  }
  function secAnnualsList(arr) { // yıllık (340-380g) dönemler, en güncel önce
    return secUniqPeriods(arr).filter((e) => { const d = secDur(e); return d >= 340 && d <= 380; }).sort((a, b) => new Date(b.end) - new Date(a.end));
  }
  function secPickByDur(items, targetEndMs, dur, tolDays) {
    let best = null, bd = Infinity;
    for (const e of items) { if (Math.abs(secDur(e) - dur) > 18) continue; const diff = Math.abs(new Date(e.end).getTime() - targetEndMs); if (diff < bd && diff <= tolDays * 86400000) { bd = diff; best = e; } }
    return best;
  }
  // TTM = son yıllık (10-K) + cari mali yıl ara dönemi − önceki yıl aynı ara dönemi (klasik
  // yöntem; Q4 ayrıca raporlanmadığı için otomatik gelir). prev = önceki yıl TTM'i (YoY için).
  function secTTM(arr) {
    const items = secUniqPeriods(arr); if (!items.length) return null;
    const anns = secAnnualsList(items); const dayMs = 86400000;
    if (!anns.length) { // yıllık yok → son 4 ayrık çeyreği topla
      const q = items.filter((e) => { const d = secDur(e); return d >= 80 && d <= 100; }).sort((a, b) => new Date(b.end) - new Date(a.end));
      if (q.length >= 4) return { cur: q.slice(0, 4).reduce((s, e) => s + e.val, 0), prev: q.length >= 8 ? q.slice(4, 8).reduce((s, e) => s + e.val, 0) : null, asOf: q[0].end, basis: 'TTM (4 çeyrek)' };
      return null;
    }
    const a0 = anns[0], a1 = anns[1], a0end = new Date(a0.end).getTime();
    const interCur = items.filter((e) => { const st = new Date(e.start).getTime(), en = new Date(e.end).getTime(); return en > a0end && (st - a0end) > -5 * dayMs && (st - a0end) < 20 * dayMs && secDur(e) >= 80; }).sort((a, b) => new Date(b.end) - new Date(a.end));
    if (!interCur.length) return { cur: a0.val, prev: a1 ? a1.val : null, asOf: a0.end, basis: 'Yıllık (10-K)' };
    const ytdCur = interCur[0], D = secDur(ytdCur);
    const ytdPrior = secPickByDur(items, new Date(ytdCur.end).getTime() - 365 * dayMs, D, 25);
    const curV = ytdPrior ? (a0.val + ytdCur.val - ytdPrior.val) : a0.val;
    let prevV = null;
    if (a1 && ytdPrior) { const yp2 = secPickByDur(items, new Date(ytdPrior.end).getTime() - 365 * dayMs, D, 25); prevV = yp2 ? (a1.val + ytdPrior.val - yp2.val) : a1.val; }
    else if (a1) prevV = a1.val;
    return { cur: curV, prev: prevV, asOf: ytdCur.end, basis: ytdPrior ? 'TTM (son 4 çeyrek)' : 'Yıllık (10-K)' };
  }
  // Bilanço (anlık) serisi — tarihe göre tekil, en güncel önce (10-Q dahil → güncel çeyrek)
  function secInstSeries(arr) {
    const s = new Set(), o = [];
    for (const e of (arr || []).slice().sort((a, b) => new Date(b.end) - new Date(a.end))) { const k = String(e.end).slice(0, 10); if (s.has(k)) continue; s.add(k); o.push(e); }
    return o;
  }
  function secInstYrAgo(series, latestEnd) {
    const target = new Date(latestEnd).getTime() - 365 * 86400000; let best = null, bd = Infinity;
    for (const e of series) { const diff = Math.abs(new Date(e.end).getTime() - target); if (diff < bd && diff < 45 * 86400000) { bd = diff; best = e; } }
    return best;
  }

  // SEC EDGAR 10-K mali tablolarından ABD hissesi için model kur:
  // 0–100 kriter dizisi (BIST motoruyla aynı) + ham tutar tile'ları. Sembol başına önbellek.
  let secModelCache = {};
  async function secFetchModel(symbol) {
    if (secModelCache[symbol]) return secModelCache[symbol];
    const cik = await secResolveCik(symbol);
    if (!cik) return null;
    const g = (tags) => () => secConcept(cik, tags);
    const arrs = await secBatches([
      g(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']),
      g(['GrossProfit']),
      g(['NetIncomeLoss']),
      g(['OperatingIncomeLoss']),
      g(['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization']),
      g(['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']),
      g(['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets']),
      g(['Assets']),
      g(['Liabilities']),
      g(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']),
      g(['LongTermDebtNoncurrent', 'LongTermDebt']),
      g(['LongTermDebtCurrent', 'DebtCurrent']),
      g(['CashAndCashEquivalentsAtCarryingValue']),
      g(['ShortTermInvestments', 'MarketableSecuritiesCurrent']),
      g(['PropertyPlantAndEquipmentNet']),
      g(['AssetsCurrent']),
      g(['LiabilitiesCurrent']),
      g(['EarningsPerShareDiluted', 'EarningsPerShareBasic']),
      g(['InventoryNet']),
    ], 6);
    const [revA, grossA, niA, opA, daA, ocfA, capexA, assetsA, liabA, eqA, ltdA, ltdcA, cashA, stiA, ppeA, caA, clA, epsA, invA] = arrs;
    // Akış kalemleri: TTM (son 12 ay). Bilanço: en güncel çeyrek (10-Q dahil). "prev" = önceki yıl.
    const revT = secTTM(revA), grossT = secTTM(grossA), niT = secTTM(niA), opT = secTTM(opA),
          daT = secTTM(daA), ocfT = secTTM(ocfA), capexT = secTTM(capexA), epsT = secTTM(epsA);
    const assetsS = secInstSeries(assetsA), eqS = secInstSeries(eqA), caS = secInstSeries(caA), clS = secInstSeries(clA),
          liabS = secInstSeries(liabA), ltdS = secInstSeries(ltdA), ltdcS = secInstSeries(ltdcA),
          cashS = secInstSeries(cashA), stiS = secInstSeries(stiA), ppeS = secInstSeries(ppeA), invS = secInstSeries(invA);
    if (!revT && !niT && !assetsS.length) return null;
    const latestBsEnd = assetsS[0] ? assetsS[0].end : (eqS[0] ? eqS[0].end : null);
    const iv = (s) => s[0] ? s[0].val : null;
    const ivPrev = (s) => { if (!s.length || !latestBsEnd) return null; const e = secInstYrAgo(s, latestBsEnd); return e ? e.val : null; };
    const cval = (t) => t ? t.cur : null, pval = (t) => t ? t.prev : null;

    const eps = cval(epsT);
    const rev = cval(revT), revPrev = pval(revT);
    const gross = cval(grossT), grossPrev = pval(grossT);
    const ni = cval(niT), niPrev = pval(niT);
    const op = cval(opT), da = cval(daT), ocf = cval(ocfT), capex = cval(capexT);
    const assets = iv(assetsS), assetsPrev = ivPrev(assetsS), liab = iv(liabS);
    const equity = iv(eqS);
    const D1 = iv(ltdS), D2 = iv(ltdcS), cash = iv(cashS), sti = iv(stiS), ppe = iv(ppeS);
    const curA = iv(caS), curAPrev = ivPrev(caS), curL = iv(clS), curLPrev = ivPrev(clS);
    const inventory = iv(invS);
    // 3Y BYBO için yıllık gelir serisi (yıllık-yıllık)
    const revAnnuals = secAnnualsList(revA);
    const revA0 = revAnnuals[0] ? revAnnuals[0].val : null, rev3 = revAnnuals[3] ? revAnnuals[3].val : null;

    const ebitda = (op != null && da != null) ? op + da : null;
    const totalDebt = (D1 != null || D2 != null) ? (D1 || 0) + (D2 || 0) : null;
    const netDebt = totalDebt != null ? totalDebt - (cash || 0) - (sti || 0) : null;
    const fcf = (ocf != null && capex != null) ? ocf - capex : null;
    const pct = (a, b) => (a != null && b) ? a / b * 100 : null;
    const netMargin = pct(ni, rev);
    const ebitdaMargin = pct(ebitda, rev);
    const ocfMargin = pct(ocf, rev);
    const grossMargin = pct(gross, rev), grossMarginPrev = pct(grossPrev, revPrev);
    const roe = pct(ni, equity);
    const roa = pct(ni, assets), roaPrev = pct(niPrev, assetsPrev);
    const dToE = (totalDebt != null && equity) ? totalDebt / equity : null;
    const ndToEbitda = (netDebt != null && ebitda && ebitda > 0) ? netDebt / ebitda : null;
    const curRatio = (curA && curL) ? curA / curL : null;
    const curRatioPrev = (curAPrev && curLPrev) ? curAPrev / curLPrev : null;
    // Asit-test (quick ratio) = (dönen varlıklar − stoklar) / kısa vadeli borç. Stok en az likit
    // dönen varlıktır; arındırılmış oran şirketin "hemen nakde çevrilebilir" borç karşılamasını gösterir.
    const quickRatio = (curA && curL) ? (curA - (inventory || 0)) / curL : null;
    const revYoY = (rev != null && revPrev && revPrev > 0) ? (rev - revPrev) / revPrev * 100 : null;
    const revCagr = (revA0 > 0 && rev3 > 0) ? (Math.pow(revA0 / rev3, 1 / 3) - 1) * 100 : null;
    const netGrowth = (ni != null && niPrev && niPrev !== 0) ? (ni - niPrev) / Math.abs(niPrev) * 100 : null;

    const usd = fmtUSD;
    const C = [], add = (o) => C.push(o);
    // — Kârlılık —
    if (netMargin != null) add({ key: 'netMargin', group: 'profitability', weight: 0.11, label: 'Net Kâr Marjı',
      score: faInterp(netMargin, [[-5, 0], [0, 25], [10, 68], [20, 90], [30, 100]]),
      note: `Net marj %${netMargin.toFixed(1)} — ${netMargin >= 10 ? 'sağlıklı, ≥%10' : netMargin > 0 ? 'ince marj, <%10' : 'şirket zarar ediyor'} (SEC, TTM).` });
    if (ebitdaMargin != null) add({ key: 'ebitdaMargin', group: 'profitability', weight: 0.07, label: 'FAVÖK Marjı',
      score: faInterp(ebitdaMargin, [[0, 15], [8, 40], [15, 58], [25, 80], [40, 100]]),
      note: `FAVÖK marjı %${ebitdaMargin.toFixed(1)} — operasyonel kârlılık (FAVÖK = Faaliyet Kârı + Amortisman).` });
    if (ocfMargin != null) add({ key: 'ocfMargin', group: 'profitability', weight: 0.08, label: 'Faaliyet Nakit Akışı Marjı',
      score: faInterp(ocfMargin, [[0, 18], [10, 50], [20, 72], [30, 90], [45, 100]]),
      note: `Faaliyet nakit akışı / satış %${ocfMargin.toFixed(1)} — kazançların nakde dönüşümü. Checklist eşiği ≥%30.` });
    if (roe != null) add({ key: 'roe', group: 'profitability', weight: 0.09, label: 'Özkaynak Kârlılığı (ROE)',
      score: faInterp(roe, [[0, 18], [10, 52], [15, 70], [20, 88], [35, 100]]),
      note: `ROE %${roe.toFixed(1)} — özkaynağın kâra dönüşümü.` });
    if (roa != null) add({ key: 'roa', group: 'profitability', weight: 0.05, label: 'Aktif Kârlılığı (ROA)',
      score: faInterp(roa, [[0, 20], [5, 55], [10, 78], [15, 92], [20, 100]]),
      note: `ROA %${roa.toFixed(1)} — varlıkların kâr üretkenliği.` });
    // — Büyüme —
    if (revYoY != null) add({ key: 'revYoY', group: 'growth', weight: 0.07, label: 'Gelir Büyümesi (YoY)',
      score: faInterp(revYoY, [[-15, 8], [0, 35], [10, 55], [20, 76], [40, 92], [70, 100]]),
      note: `Yıllık gelir büyümesi %${revYoY.toFixed(1)}.` });
    if (revCagr != null) add({ key: 'revCagr', group: 'growth', weight: 0.06, label: '3 Yıllık Gelir BYBO',
      score: faInterp(revCagr, [[-15, 8], [0, 35], [10, 55], [20, 76], [40, 92], [70, 100]]),
      note: `3 yıllık bileşik gelir büyümesi %${revCagr.toFixed(1)}/yıl. Checklist eşiği ~%20 (büyüme hissesi).` });
    if (netGrowth != null) add({ key: 'netTrend', group: 'growth', weight: 0.06, label: 'Net Kâr Yönü',
      score: faInterp(netGrowth, [[-30, 15], [0, 45], [10, 62], [30, 82], [60, 95]]),
      note: `Net kâr geçen yıla göre %${netGrowth.toFixed(0)} ${netGrowth >= 0 ? 'arttı' : 'azaldı'} — kâr momentumu ${netGrowth >= 0 ? 'olumlu' : 'zayıf'}.` });
    // — Borç / Finansal Sağlık —
    if (ndToEbitda != null || (netDebt != null && netDebt < 0)) add({ key: 'ndEbitda', group: 'solvency', weight: 0.09, label: 'Net Borç / FAVÖK',
      score: netDebt < 0 ? 100 : faInterp(ndToEbitda, [[0, 92], [1.5, 78], [3, 55], [4, 38], [6, 12]]),
      note: netDebt < 0 ? `Net nakit pozisyonu (${usd(-netDebt)} fazla) — borçtan arınmış.` : `Net borç / FAVÖK = ${ndToEbitda.toFixed(1)}x — ${ndToEbitda <= 3 ? 'düşük' : ndToEbitda <= 4 ? 'orta' : 'yüksek'} kaldıraç.` });
    if (dToE != null) add({ key: 'd2e', group: 'solvency', weight: 0.06, label: 'Borç / Özsermaye',
      score: faInterp(dToE, [[0, 95], [0.5, 84], [1, 66], [2, 42], [3, 16]]),
      note: `Borç / özsermaye = ${dToE.toFixed(2)} — ${dToE < 1 ? 'sağlıklı sermaye yapısı' : dToE <= 2 ? 'orta kaldıraç' : 'yüksek kaldıraç'}.` });
    // — Likidite —
    if (curRatio != null) add({ key: 'curRatio', group: 'liquidity', weight: 0.05, label: 'Cari Oran',
      score: faInterp(curRatio, [[0.7, 12], [1, 45], [1.5, 80], [2, 92], [3, 100]]),
      note: `Cari oran ${curRatio.toFixed(2)} — kısa vadeli borç karşılama gücü. Checklist eşiği ≥1.5.` });
    if (quickRatio != null) add({ key: 'quickRatio', group: 'liquidity', weight: 0.04, label: 'Asit-Test (Likit) Oranı',
      score: faInterp(quickRatio, [[0.4, 12], [0.7, 40], [1, 72], [1.5, 92], [2.5, 100]]),
      note: `Asit-test ${quickRatio.toFixed(2)} — stok hariç dönen varlık / kısa vadeli borç. Stok en az likit kalemdir; ${inventory ? `stok arındırılınca (${usd(inventory)}) ` : ''}en katı likidite ölçüsü. Checklist eşiği ≥1.` });
    // — Kalite & Trend (Piotroski) —
    if (fcf != null) add({ key: 'fcfPos', group: 'quality', weight: 0.05, label: 'Serbest Nakit Akışı',
      score: fcf > 0 ? 82 : 38,
      note: `Serbest nakit akışı ${usd(fcf)} — ${fcf > 0 ? 'pozitif; temettü/borç ödeme/geri alım kapasitesi (olumlu)' : 'negatif; yatırım büyük ya da nakit zorlanması (dikkat)'}.` });
    if (ocf != null && ni != null) add({ key: 'accruals', group: 'quality', weight: 0.06, label: 'Nakit Kalitesi (OCF > Net Kâr)',
      score: ocf > ni ? 85 : 40,
      note: `Faaliyet nakit akışı (${usd(ocf)}) net kârın (${usd(ni)}) ${ocf > ni ? 'üzerinde — kazançlar nakitle destekli (olumlu)' : 'altında — kâr nakde tam dönüşmüyor (dikkat)'}.` });
    if (roa != null && roaPrev != null) add({ key: 'roaUp', group: 'quality', weight: 0.05, label: 'Aktif Kârlılığı Trendi (ROA↑)',
      score: roa > roaPrev ? 85 : 40, note: `ROA %${roaPrev.toFixed(1)} → %${roa.toFixed(1)} — ${roa > roaPrev ? 'iyileşiyor' : 'geriliyor'}.` });
    if (grossMargin != null && grossMarginPrev != null) add({ key: 'gmUp', group: 'quality', weight: 0.04, label: 'Brüt Marj Trendi',
      score: grossMargin > grossMarginPrev ? 82 : 42, note: `Brüt marj %${grossMarginPrev.toFixed(1)} → %${grossMargin.toFixed(1)} — ${grossMargin > grossMarginPrev ? 'güçleniyor (fiyatlama gücü)' : 'zayıflıyor (maliyet baskısı)'}.` });
    if (curRatio != null && curRatioPrev != null) add({ key: 'crUp', group: 'quality', weight: 0.03, label: 'Cari Oran Trendi',
      score: curRatio > curRatioPrev ? 78 : 45, note: `Cari oran ${curRatioPrev.toFixed(2)} → ${curRatio.toFixed(2)} — likidite ${curRatio > curRatioPrev ? 'güçleniyor' : 'zayıflıyor'}.` });

    const statementTiles = [
      { label: 'Gelir (TTM)', val: usd(rev) },
      { label: 'FAVÖK (TTM)', val: usd(ebitda) },
      { label: 'FAVÖK Marjı', val: ebitdaMargin == null ? '—' : '%' + ebitdaMargin.toFixed(1) },
      { label: 'Net Kâr (TTM)', val: usd(ni) },
      { label: 'Net Marj', val: netMargin == null ? '—' : '%' + netMargin.toFixed(1) },
      { label: 'Faaliyet Nakit Akışı (TTM)', val: usd(ocf) },
      { label: 'Serbest Nakit Akışı (TTM)', val: usd(fcf) },
      { label: 'Toplam Borç', val: usd(totalDebt) },
      { label: 'Net Borç', val: usd(netDebt) },
      { label: 'Nakit + KV Yatırım', val: usd((cash || 0) + (sti || 0)) },
      { label: 'Toplam Varlık', val: usd(assets) },
      { label: 'Toplam Yükümlülük', val: usd(liab) },
      { label: 'Özsermaye', val: usd(equity) },
      { label: 'Maddi Duran Varlık', val: usd(ppe) },
      { label: 'Cari Oran', val: curRatio == null ? '—' : curRatio.toFixed(2) },
      { label: 'Asit-Test Oranı', val: quickRatio == null ? '—' : quickRatio.toFixed(2) },
    ];
    const incBasis = (revT && revT.basis) || (niT && niT.basis) || 'TTM';
    const incAsOf = (revT && revT.asOf) || (niT && niT.asOf) || null;
    const fy = incAsOf ? incBasis + ' · ' + fmtDate(incAsOf) : (assetsS[0] ? new Date(assetsS[0].end).getFullYear() : '');
    const bsDate = assetsS[0] ? fmtDate(assetsS[0].end) : '';
    const out = { criteria: C, statementTiles, fy, bsDate, incBasis, incAsOf, metrics: { ni, rev, eps, fcf, netDebt, totalDebt, ebitda, revCagr, revYoY } };
    secModelCache[symbol] = out;
    return out;
  }

  // ===== Genel sekmesi =====
  let generalCache = [];
  let activeRegion = 'ALL';

  // Ekonomi / siyaset-ekonomi / diplomasi anahtar kelimeleri (TR)
  const ECON_WHITELIST_TR = [
    'ekonomi','enflasyon','faiz','dolar','euro','sterlin','kur','döviz','altın','gram altın','ons',
    'borsa','bist','hisse','endeks','yatırım','yatırımc','fon','tahvil','bono','repo','kredi',
    'merkez bankası','tcmb','hazine','bütçe','vergi','kdv','ötv','asgari ücret','enerji','doğalgaz',
    'petrol','brent','akaryakıt','benzin','motorin','elektrik zammı','fatura','konut','kira',
    'ihracat','ithalat','dış ticaret','cari açık','büyüme','gsyih','gsyh','imf','dünya bankası',
    'oecd','swap','rezerv','spk','bddk','tüfe','üfe','sgk','eyt','emekli','kıdem',
    'işsizlik','istihdam','tarım','sanayi','üretim','pmi',
    'kripto','bitcoin','ethereum','blockchain','token',
    'şirket','holding','ihale','özelleştir','iflas','konkordato','satın alma','birleşme',
    'ab','avrupa birliği','nato','brics','tarife','gümrük','ambargo','yaptırım','sanksiyon',
    'ticaret anlaşması','serbest ticaret','swap anlaşması','enerji anlaşması',
    'erdoğan','şimşek','karahan','yerlikaya','fidan','güler','bakanlık','meclis',
    'beyaz saray','trump','biden','putin','xi','jinping','merkel','macron','scholz','starmer',
    'fed','ecb','bce','boe','boj','jackson hole','g20','g7','davos','zirve','görüşme','müzakere',
    'savaş','barış','ateşkes','suriye','ukrayna','israil','filistin','iran','rusya',
    'irak','libya','yemen','kıbrıs','azerbaycan','ermenistan','körfez','suudi','katar','bae'
  ];
  const ECON_BLACKLIST_TR = [
    'aşk','romantik','sevgili','evlilik','nişan','boşan','flört','aşk hayatı','ayrıldı',
    'magazin','ünlü','dizi','sezon finali','film','sinema','konser','şarkı','single','klip',
    'oyuncu','yıldız adayı','güzeli','ödülü kazandı','red carpet',
    'kombin','moda haftası','stil','dekolte','bikini','plaj',
    'reality','survivor','exatlon','masterchef','ev hanım',
    'transfer','golcü','şampiyonlar ligi','derbi','maç sonucu','penaltı','asist','hat-trick',
    'fenerbahçe galat','galatasaray fenerbahç','beşiktaş trabzonspor',
    'horoskop','astroloji','burç','rüya tabir',
    'sağlık tüyo','diyet','zayıflama','cilt bakım','saç bakım','makyaj',
    'iyilik','dolandırıcı','yakaland','gözaltına','kavga','cinayet','intihar','kaza',
    'yangın','sel','deprem yardım'
  ];
  function isTRFinanceOrPolitics(text) {
    const t = (text || '').toLocaleLowerCase('tr-TR');
    for (const w of ECON_BLACKLIST_TR) if (t.includes(w)) return false;
    for (const w of ECON_WHITELIST_TR) if (t.includes(w)) return true;
    return false;
  }

  async function loadGeneral() {
    const feedEl = document.getElementById('generalFeed');
    feedEl.innerHTML = '<div class="loading">Yükleniyor…</div>';
    generalCache = [];
    const results = await Promise.allSettled(
      window.GENERAL_FEEDS.map(f =>
        fetchRSS(f.url, 8).then(items => ({ source: f.name, region: f.region, items }))
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const item of r.value.items) {
          generalCache.push({ source: r.value.source, region: r.value.region, item });
        }
      }
    }
    generalCache.sort((a, b) =>
      new Date(b.item.pubDate || 0) - new Date(a.item.pubDate || 0)
    );
    renderGeneral();
  }

  function renderGeneral() {
    const feedEl = document.getElementById('generalFeed');
    let filtered = activeRegion === 'ALL'
      ? generalCache
      : generalCache.filter(x => x.region === activeRegion);
    // TR akışında ekonomi / politika-ekonomi / diplomasi dışı içeriği ele
    filtered = filtered.filter(x => {
      if (x.region !== 'TR') return true;
      const haystack = (x.item.title || '') + ' ' + (x.item.description || '');
      return isTRFinanceOrPolitics(haystack);
    });
    if (!filtered.length) {
      feedEl.innerHTML = '<div class="empty">Haber yok.</div>';
      return;
    }
    feedEl.innerHTML = filtered.slice(0, 60).map(x => `
      <div class="feed-item">
        <a href="${x.item.link}" target="_blank" rel="noopener">${x.item.title}</a>
        <div class="meta">
          <span class="tag">${x.source}</span>
          <span>${fmtTime(x.item.pubDate)}</span>
        </div>
      </div>
    `).join('');
  }

  // ===== Takvim sekmesi =====
  const EARNINGS_KEYWORDS = ['FİNANSAL RAPOR', 'FINANSAL RAPOR', 'BİLANÇO', 'BILANCO',
                              'ARA DÖNEM FAALİYET', 'YILLIK FAALİYET'];
  const DIVIDEND_KEYWORDS = ['KAR PAYI', 'KÂR PAYI', 'TEMETTÜ', 'TEMETTU', 'BEDELSİZ'];

  // D3: izleme evrenindeki (portföy+liste+sepet) hisseler için SON bilanço/finansal rapor
  // açıklamaları — "Bugün" panelinde öne çıkarmak için. Yalnız BIST (KAP kaynaklı);
  // pencere = son `days` gün. Bilgi amaçlıdır, skora dokunmaz.
  async function watchedEarningsRecent(days = 3) {
    const bist = watchedSymbols().filter((w) => w.market === 'BIST').map((w) => w.symbol);
    if (!bist.length) return [];
    let kapAll = [];
    try { kapAll = await fetchKAP(); } catch (_) { kapAll = []; }
    if (!kapAll || !kapAll.length) return [];
    const cutoff = Date.now() - days * 86400000;
    const out = [];
    const seen = new Set();
    for (const sym of bist) {
      const matches = kapItemsForTicker(kapAll, sym, { subjectIncludes: EARNINGS_KEYWORDS });
      for (const m of matches) {
        const t = new Date(m.pubDate).getTime();
        if (!(t >= cutoff)) continue;
        const key = sym + '|' + m.link;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ symbol: sym, item: m, ts: t });
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }

  async function renderCalendar() {
    const kapAll = await fetchKAP();
    // Takvim artık yalnız portföyü değil, izleme evrenini (portföy + listeler + sepet) kapsar
    // → bilanço/temettü bölümleri çok daha az "boş" kalır.
    const watched = watchedSymbols();
    const bistSymbols = watched.filter(w => w.market === 'BIST').map(w => w.symbol);

    // Bilanço
    const earnings = [];
    for (const sym of bistSymbols) {
      const matches = kapItemsForTicker(kapAll, sym, { subjectIncludes: EARNINGS_KEYWORDS });
      for (const m of matches.slice(0, 3)) {
        earnings.push({ symbol: sym, item: m });
      }
    }
    // KAP boşsa, her ticker için "TICKER bilanço" Google News fallback
    if (!earnings.length) {
      const results = await Promise.allSettled(
        bistSymbols.map(sym => fetchKAPFallback(sym, 'earnings').then(items => ({ sym, items })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const it of r.value.items.slice(0, 3)) {
            earnings.push({ symbol: r.value.sym, item: it, _alt: true });
          }
        }
      }
    }
    earnings.sort((a, b) => new Date(b.item.pubDate) - new Date(a.item.pubDate));
    const earningsEl = document.getElementById('earningsList');
    earningsEl.innerHTML = earnings.length ? earnings.map(e => `
      <div class="feed-item">
        <a href="${e.item.link}" target="_blank" rel="noopener">${e.item.title}</a>
        <div class="meta">
          <span class="tag">${e.symbol}</span>
          <span>${fmtTime(e.item.pubDate)}${e._alt ? ' · <em>alt. kaynak</em>' : ''}</span>
        </div>
      </div>
    `).join('') : '<div class="empty">Yeni bilanço duyurusu yok.</div>';

    // Temettü - BIST: temettuhisseleri.com (resmi kaynak — net tutar, kesin tarih)
    const divBistEl = document.getElementById('dividendsBIST');
    divBistEl.innerHTML = '<div class="loading">Yükleniyor…</div>';
    const curYear = new Date().getFullYear();
    const today = new Date();

    const allDividends = await fetchTemettuTakvimi();
    // Sadece bu yıl + portföydeki hisseler
    const bistSet = new Set(bistSymbols);
    const yearDivs = allDividends.filter(d =>
      bistSet.has(d.symbol) && d.date.getFullYear() === curYear
    );

    // Per-ticker grupla
    const byTicker = {};
    yearDivs.forEach(d => {
      if (!byTicker[d.symbol]) byTicker[d.symbol] = [];
      byTicker[d.symbol].push({
        amount: d.amount,
        currency: d.currency,
        date: d.date,
        yieldPct: d.yieldPct,
        link: `https://temettuhisseleri.com/hisseanaliz/${d.symbol}`,
        paid: d.date <= today,
      });
    });
    // Her ticker içinde tarihe göre sırala (gelecek üstte)
    Object.keys(byTicker).forEach(sym => {
      byTicker[sym].sort((a, b) => {
        // Önce gelecekler, sonra yakın geçmiş
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        return a.paid ? b.date - a.date : a.date - b.date;
      });
    });

    // Render: önce gelecek temettüsü olan tickerlar (en yakın tarih); sonra geçmiş
    const entries = Object.entries(byTicker)
      .filter(([_, list]) => list.length > 0)
      .sort((a, b) => {
        const aUp = a[1].find(e => !e.paid);
        const bUp = b[1].find(e => !e.paid);
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;
        if (aUp && bUp) return aUp.date - bUp.date; // en yakın gelecek üstte
        // İkisi de geçmiş — en yeni üstte
        return b[1][0].date - a[1][0].date;
      });

    if (!entries.length) {
      divBistEl.innerHTML = `<div class="empty">${curYear} için BIST temettü bulunamadı.</div>`;
    } else {
      divBistEl.innerHTML = entries.map(([sym, list]) => {
        const rows = list.map(e => `
          <a class="div-row${e.paid ? '' : ' upcoming'}" href="${e.link}" target="_blank" rel="noopener">
            <span class="div-amt">${e.amount.toFixed(4)} ${e.currency}</span>
            <span class="div-date">${fmtDate(e.date)}${e.yieldPct ? ' · %' + e.yieldPct.toFixed(2) : ''}</span>
            <span class="div-src">${e.paid ? 'Ödendi' : 'Bekliyor'}</span>
          </a>
        `).join('');
        return `
          <div class="div-card">
            <div class="div-card-head">
              <span class="tag">${sym}</span>
              <span class="div-count">${list.length} kayıt</span>
            </div>
            ${rows}
          </div>
        `;
      }).join('');
    }

    // Temettü - US ETF (kutu kutu)
    const divUsEl = document.getElementById('dividendsUS');
    divUsEl.innerHTML = '<div class="loading">Yükleniyor…</div>';
    const usSymbols = watched.filter(w => w.market === 'US').map(w => w.symbol);
    const byUs = {};
    await Promise.all(usSymbols.map(async (sym) => {
      const divs = await fetchYahooDividends(sym);
      if (divs.length) byUs[sym] = divs.slice(0, 8).map(d => ({
        amount: d.amount,
        currency: '$',
        date: d.date,
        link: `https://finance.yahoo.com/quote/${sym}/history`,
        paid: d.date <= today,
      }));
    }));
    const usEntries = Object.entries(byUs)
      .sort((a, b) => b[1][0].date - a[1][0].date);
    divUsEl.innerHTML = usEntries.length ? usEntries.map(([sym, list]) => {
      const rows = list.slice(0, 6).map(e => `
        <a class="div-row${e.paid ? '' : ' upcoming'}" href="${e.link}" target="_blank" rel="noopener">
          <span class="div-amt">${e.currency}${e.amount.toFixed(4)}</span>
          <span class="div-date">${fmtDate(e.date)}</span>
          <span class="div-src">${e.paid ? 'Ödendi' : 'Bekliyor'}</span>
        </a>
      `).join('');
      return `
        <div class="div-card">
          <div class="div-card-head">
            <span class="tag">${sym}</span>
            <span class="div-count">${list.length} kayıt</span>
          </div>
          ${rows}
        </div>
      `;
    }).join('') : `<div class="empty">${curYear} için açıklanmış ABD temettüsü yok.</div>`;
  }

  // ===== Hisse Sayfası (yeniden kullanılabilir tam-sayfa görünüm) =====
  // Portföy, Listeler ve Arama bölümlerinden açılır. Genel bilgi + çok-dönemli değişim,
  // Gelişmeler (haber+KAP), Takvim (temettü+bilanço), Teknik özet, Temel Analiz ve Sonuç.
  const detailModal   = document.getElementById('detailModal');
  const detailContent = document.getElementById('detailContent');
  let spReq = 0;
  function closeStockPage() { detailModal.hidden = true; detailModal.classList.remove('as-page'); spReq++; }
  document.getElementById('detailClose').addEventListener('click', closeStockPage);
  detailModal.addEventListener('click', (e) => { if (e.target === detailModal) closeStockPage(); });

  async function openStockPage(symbol, market, query) {
    const req = ++spReq;
    query = query || symbol;
    detailModal.hidden = false;
    detailModal.classList.add('as-page');
    detailContent.scrollTop = 0;
    detailContent.innerHTML = `
      <div class="sp">
        <div class="sp-actionbar" id="spActions"></div>
        <div class="sp-head" id="spHead"><div class="loading">Yükleniyor…</div></div>
        <div class="sp-section"><div class="sp-sec-h">🔀 Neden hareket ediyor?</div><div id="spWhy"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">📰 Gelişmeler</div><div id="spNews"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">📅 Takvim — Temettü &amp; Bilanço</div><div id="spCal"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h sp-sec-link" data-goto-analysis="technical" role="button" tabindex="0">📈 Teknik Analiz <span class="sp-sec-arrow">tam sayfa →</span></div><div id="spTa"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h sp-sec-link" data-goto-analysis="fundamental" role="button" tabindex="0">🧮 Temel Analiz <span class="sp-sec-arrow">tam sayfa →</span></div><div id="spFa"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section sp-result-sec"><div class="sp-sec-h">🔗 Sonuç</div><div id="spResult"><div class="loading">Hazırlanıyor…</div></div></div>
      </div>`;
    detailContent.querySelectorAll('[data-goto-analysis]').forEach((h) => {
      const go = () => gotoAnalysis(symbol, market, h.dataset.gotoAnalysis);
      h.addEventListener('click', go);
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    renderSpActions(symbol, market, query);
    fillSpHead(symbol, market, req);
    fillSpWhy(symbol, market, query, req);
    fillSpNews(symbol, market, query, req);
    fillSpCalendar(symbol, market, req);
    fillSpTa(symbol, market, req);
    fillSpFa(symbol, market, req);
  }
  // Eski çağrı adı — geriye dönük uyumluluk
  const openTickerDetail = openStockPage;

  // ===== Faz 2: Kripto & Maden detay sayfaları (BİLGİ AMAÇLI; temel/bileşke skora dokunmaz) =====
  const TROY_OZ_G = 31.1034768; // 1 troy ons = 31.1035 gram
  const METAL_SPOT = {
    'gram-altin': { ysym: 'GC=F', emoji: '🥇', trq: 'altın fiyat piyasa',   wq: 'gold price market' },
    'gumus':      { ysym: 'SI=F', emoji: '🥈', trq: 'gümüş fiyat piyasa',   wq: 'silver price market' },
    'platin':     { ysym: 'PL=F', emoji: '⚪', trq: 'platin fiyat piyasa',  wq: 'platinum price market' },
  };
  // ysym → maden anahtarı (Temel sekmesi yönlendirmesi için)
  const METAL_YSYM = { 'GC=F': 'gram-altin', 'SI=F': 'gumus', 'PL=F': 'platin' };
  const cUsd = (v) => (v == null || !isFinite(v)) ? '—'
    : v.toLocaleString('en-US', { minimumFractionDigits: Math.abs(v) < 1 ? 4 : 2, maximumFractionDigits: Math.abs(v) < 1 ? 6 : 2 });
  const shortNum = (v) => {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  };

  // CoinGecko piyasa verisi (market cap / hacim / arz / ATH) — cache'li
  let cryptoMktCache = { ts: 0, map: {} };
  async function cryptoMarkets(ids) {
    const now = Date.now();
    const missing = ids.some((id) => !(id in cryptoMktCache.map));
    if (missing || now - cryptoMktCache.ts > 90000) {
      const all = Array.from(new Set(ids.concat(Object.keys(cryptoMktCache.map))));
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + encodeURIComponent(all.join(',')) + '&price_change_percentage=24h');
        const j = await r.json();
        if (Array.isArray(j)) j.forEach((o) => { cryptoMktCache.map[o.id] = o; });
        cryptoMktCache.ts = now;
      } catch (e) {}
    }
    return cryptoMktCache.map;
  }
  let cgGlobalCache = { ts: 0, data: null };
  async function cgGlobal() {
    if (cgGlobalCache.data && Date.now() - cgGlobalCache.ts < 300000) return cgGlobalCache.data;
    try { const r = await fetch('https://api.coingecko.com/api/v3/global'); const j = await r.json(); cgGlobalCache = { ts: Date.now(), data: j && j.data }; } catch (e) {}
    return cgGlobalCache.data;
  }

  async function renderCrypto() {
    const grid = document.getElementById('portfolioGridCRYPTO'); if (!grid) return;
    grid.innerHTML = '<div class="loading" style="padding:12px">Yükleniyor…</div>';
    const map = await cryptoMarkets(BM_CRYPTO.map((c) => c.id));
    grid.innerHTML = '';
    BM_CRYPTO.forEach((coin) => {
      const m = map[coin.id];
      const price = m ? m.current_price : null;
      const chg = m ? m.price_change_percentage_24h : null;
      const cls = chg == null ? '' : chg >= 0 ? 'up' : 'down';
      const card = document.createElement('div');
      card.className = 'card no-click';
      card.innerHTML = `
        <h3>
          <span>${coin.name} <small class="crx-sym">${coin.sym}</small></span>
          <span class="badge">${price != null ? '$' + cUsd(price) : '—'}</span>
        </h3>
        <div class="crx-row">
          <span class="crx-chg ${cls}">${chg != null ? (chg >= 0 ? '+' : '') + chg.toFixed(2) + '% (24s)' : '—'}</span>
          <button class="crx-detail" data-cg="${coin.id}">Detay →</button>
        </div>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll('.crx-detail[data-cg]').forEach((b) => b.addEventListener('click', () => {
      const coin = BM_CRYPTO.find((c) => c.id === b.dataset.cg); if (coin) openCryptoPage(coin);
    }));
  }

  async function openCryptoPage(coin) {
    const req = ++spReq;
    const ysym = coin.sym + '-USD';
    detailModal.hidden = false; detailModal.classList.add('as-page'); detailContent.scrollTop = 0;
    detailContent.innerHTML = `
      <div class="sp">
        <div class="sp-head" id="spHead"><div class="loading">Yükleniyor…</div></div>
        <div class="sp-section"><div class="sp-sec-h">📊 Piyasa verisi</div><div id="cpMarket"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">💠 Değer & Tokenomik</div><div id="cpValue"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h sp-sec-link" data-goto-analysis="technical" role="button" tabindex="0">📈 Teknik Analiz <span class="sp-sec-arrow">tam sayfa →</span></div><div id="spTa"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">📰 Gelişmeler</div><div id="spNews"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section sp-result-sec"><div class="sp-sec-h">🔗 Sonuç</div><div id="spResult"><div class="loading">Hazırlanıyor…</div></div></div>
      </div>`;
    detailContent.querySelectorAll('[data-goto-analysis]').forEach((h) => {
      const go = () => gotoAnalysis(ysym, 'US', h.dataset.gotoAnalysis);
      h.addEventListener('click', go);
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    fillCryptoHead(coin, req);
    fillCryptoMarket(coin, req);
    fillCryptoValue(coin, req);
    fillSpTa(ysym, 'US', req);
    fillAssetNews([{ q: coin.name + ' kripto para', m: 'BIST', label: 'Türkiye' }, { q: coin.name + ' crypto price', m: 'US', label: 'Dünya' }], req);
    fillAssetPlan(ysym, 'US', req, null);
  }

  async function fillCryptoHead(coin, req) {
    const ysym = coin.sym + '-USD';
    const [chart, q] = await Promise.all([fetchYahooChart(ysym, 'US', '3mo'), getQuote(ysym, 'US')]);
    if (req !== spReq) return;
    const head = document.getElementById('spHead'); if (!head) return;
    const price = (q && q.price != null) ? q.price : (chart && chart.price);
    let html;
    if (price != null) {
      const prevClose = (q && q.prevClose != null) ? q.prevClose : price;
      const change = price - prevClose, pct = prevClose ? (change / prevClose * 100) : 0;
      const cls = change >= 0 ? 'up' : 'down', sign = change >= 0 ? '+' : '';
      html = `
        <div class="sp-price-row">
          <h2>${coin.name} <span class="badge">🪙 ${coin.sym}</span></h2>
          <div class="sp-price">$${cUsd(price)}
            <span class="sp-daychg ${cls}">${sign}${cUsd(change)} (${sign}${pct.toFixed(2)}%) bugün</span></div>
        </div>
        <div class="sp-meta">Kripto · 7/24 piyasa · ${fmtTime((q && q.marketTime) || (chart && chart.marketTime))}</div>
        ${chart ? makeSparkline(chart.points) : ''}`;
    } else {
      html = `<div class="sp-price-row"><h2>${coin.name} <span class="badge">🪙 ${coin.sym}</span></h2></div><div class="sp-meta">Fiyat verisi alınamadı.</div>`;
    }
    head.innerHTML = html + `<div class="sp-changes" id="spChanges"></div>`;
    fillSpChanges(ysym, 'US', req);
  }

  async function fillCryptoMarket(coin, req) {
    const box = document.getElementById('cpMarket'); if (!box) return;
    const [map, g] = await Promise.all([cryptoMarkets([coin.id]), cgGlobal()]);
    if (req !== spReq) return;
    const m = map[coin.id];
    if (!m) { box.innerHTML = '<div class="empty">Piyasa verisi alınamadı.</div>'; return; }
    const dom = g && g.market_cap_percentage && g.market_cap_percentage[coin.sym.toLowerCase()];
    const kv = (l, v) => `<div class="kv"><span class="kv-l">${l}</span><span class="kv-v">${v}</span></div>`;
    const bUSD = (v) => v == null ? '—' : '$' + shortNum(v);
    box.innerHTML = `
      <div class="kv-grid">
        ${kv('Piyasa değeri', bUSD(m.market_cap))}
        ${kv('Sıralama', m.market_cap_rank ? ('#' + m.market_cap_rank) : '—')}
        ${kv('24s hacim', bUSD(m.total_volume))}
        ${dom != null ? kv('Dominans', dom.toFixed(1) + '%') : ''}
        ${kv('Dolaşan arz', m.circulating_supply != null ? shortNum(m.circulating_supply) + ' ' + coin.sym : '—')}
        ${kv('Maks arz', m.max_supply != null ? shortNum(m.max_supply) + ' ' + coin.sym : '∞')}
        ${kv('ATH (en yüksek)', m.ath != null ? '$' + cUsd(m.ath) : '—')}
        ${kv('ATH\'den', m.ath_change_percentage != null ? m.ath_change_percentage.toFixed(1) + '%' : '—')}
      </div>
      <div class="kv-note">Kaynak: CoinGecko · yalnızca bilgi amaçlıdır, yatırım tavsiyesi değildir.</div>`;
  }

  // ===== Faz B: Kripto "Değer & Tokenomik" skoru (0–100) — BİLGİ AMAÇLI =====
  // Kriptolarda bilanço/kâr yoktur; skor tamamen ücretsiz tokenomik/arz/likidite/
  // benimseme verisinden üretilir. Zincir-üstü metrikler (NVT/MVRV/SOPR) ücretli
  // API ister; burada YOK — bu dürüstçe belirtilir. Hisse temel skoruna DOKUNMAZ.
  function scoreBand(s, labels) {
    const L = labels || ['Güçlü', 'İyi', 'Nötr', 'Zayıf', 'Kırılgan'];
    if (s >= 70) return { cls: 'strong', label: L[0] };
    if (s >= 56) return { cls: 'good', label: L[1] };
    if (s >= 45) return { cls: 'neutral', label: L[2] };
    if (s >= 35) return { cls: 'weak', label: L[3] };
    return { cls: 'bad', label: L[4] };
  }
  function cryptoCategory(j) {
    const cats = (j.categories || []).filter(Boolean).map((c) => String(c).toLowerCase());
    const has = (kw) => cats.some((c) => c.includes(kw));
    if (has('stablecoin')) return 'stablecoin';
    if (has('meme')) return 'meme';
    if (has('smart contract') || has('layer 1') || has('layer-1')) return 'l1';
    if (has('defi') || has('decentralized finance')) return 'defi';
    return 'other';
  }
  let cryptoDetailCache = {};
  async function cryptoDetail(id) {
    const c = cryptoDetailCache[id];
    if (c && Date.now() - c.ts < 300000) return c.data;
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=true&sparkline=false`);
      const j = await r.json();
      if (j && j.id) { cryptoDetailCache[id] = { ts: Date.now(), data: j }; return j; }
    } catch (e) {}
    return null;
  }
  function computeCryptoValue(j) {
    const md = j.market_data || {};
    const N = (x) => (typeof x === 'number' && isFinite(x)) ? x : null;
    const usd = (o) => o ? N(o.usd) : null;
    const mcap = usd(md.market_cap), vol = usd(md.total_volume), fdv = usd(md.fully_diluted_valuation);
    const circ = N(md.circulating_supply), maxs = N(md.max_supply);
    const rank = N(j.market_cap_rank);
    const athPct = usd(md.ath_change_percentage);
    const chg24 = N(md.price_change_percentage_24h);
    const chg1y = N(md.price_change_percentage_1y_in_currency && md.price_change_percentage_1y_in_currency.usd) ?? N(md.price_change_percentage_1y);
    const dev = j.developer_data || {}, comm = j.community_data || {};
    const category = cryptoCategory(j);
    const warnings = [];

    // 1) Ağ & likidite
    const rankScore = rank == null ? 40 : rank <= 10 ? 100 : rank <= 25 ? 88 : rank <= 50 ? 74 : rank <= 100 ? 60 : rank <= 250 ? 45 : rank <= 600 ? 32 : 22;
    const liq = (vol != null && mcap) ? vol / mcap : null;
    const liqScore = liq == null ? 45 : liq >= 0.15 ? 100 : liq >= 0.08 ? 85 : liq >= 0.04 ? 70 : liq >= 0.02 ? 58 : liq >= 0.008 ? 45 : 30;
    const c1 = 0.6 * rankScore + 0.4 * liqScore;
    const c1note = `Sıralama ${rank != null ? '#' + rank : '—'} · likidite (hacim/piyasa değeri) ${liq != null ? (liq * 100).toFixed(1) + '%' : '—'}${liq != null && liq < 0.008 ? ' — çok düşük, çıkışta kayma riski.' : ''}`;

    // 2) Arz & seyrelme
    let c2, c2note;
    if (maxs && circ) {
      const r = circ / maxs;
      c2 = r >= 0.9 ? 100 : r >= 0.75 ? 86 : r >= 0.6 ? 72 : r >= 0.4 ? 56 : r >= 0.2 ? 42 : 30;
      c2note = `Dolaşan/maks arz %${(r * 100).toFixed(0)} — ${r >= 0.75 ? 'gelecekteki enflasyon düşük.' : r >= 0.4 ? 'orta düzey seyrelme riski.' : 'yüksek gelecek seyrelmesi (kilitli arz açılacak).'}`;
    } else if (fdv && mcap) {
      const d = fdv / mcap;
      c2 = d <= 1.05 ? 95 : d <= 1.25 ? 80 : d <= 1.6 ? 62 : d <= 2.2 ? 46 : d <= 3.5 ? 34 : 24;
      c2note = `FDV/piyasa değeri ${d.toFixed(2)}× — ${d <= 1.25 ? 'tam seyreltilmiş değere yakın.' : 'tam arz açıldığında ciddi seyrelme baskısı.'}`;
      if (d > 1.6) warnings.push('Dolaşan arz, toplam arzın küçük kısmı — vesting/kilit açılışları satış baskısı yaratabilir.');
    } else {
      c2 = 45; c2note = 'Maksimum arz sınırsız/bilinmiyor — seyrelme net değerlendirilemiyor.';
      warnings.push('Sabit arz tavanı yok (uncapped) — uzun vadeli seyrelme belirsiz.');
    }

    // 3) Geliştirici & benimseme
    const commits = N(dev.commit_count_4_weeks), stars = N(dev.stars);
    const devKnown = (commits != null || stars != null);
    let devScore = 45;
    if (devKnown) {
      const cs = commits == null ? 30 : commits >= 120 ? 100 : commits >= 40 ? 82 : commits >= 10 ? 60 : commits > 0 ? 42 : 22;
      const ss = stars == null ? 40 : stars >= 25000 ? 100 : stars >= 8000 ? 82 : stars >= 2000 ? 64 : stars >= 300 ? 48 : 35;
      devScore = 0.6 * cs + 0.4 * ss;
    } else { warnings.push('Geliştirici (GitHub) verisi izlenmiyor — bu alt-bileşen nötr alındı.'); }
    const tw = N(comm.twitter_followers), rd = N(comm.reddit_subscribers);
    let commScore = 45;
    if (tw != null || rd != null) {
      const ts = tw == null ? 40 : tw >= 1e6 ? 100 : tw >= 3e5 ? 84 : tw >= 8e4 ? 66 : tw >= 1.5e4 ? 50 : 36;
      const rs = rd == null ? 45 : rd >= 5e5 ? 100 : rd >= 1e5 ? 82 : rd >= 2e4 ? 62 : rd >= 3e3 ? 48 : 36;
      commScore = 0.5 * ts + 0.5 * rs;
    }
    const c3 = 0.5 * devScore + 0.5 * commScore;
    const c3note = `Geliştirme: ${commits != null ? commits + ' commit/4h' : 'veri yok'}${stars != null ? ' · ⭐' + shortNum(stars) : ''} · topluluk: ${tw != null ? shortNum(tw) + ' X' : '—'}${rd != null ? ' · ' + shortNum(rd) + ' Reddit' : ''}`;

    // 4) Değerleme konumu (ATH’ye uzaklık — dürüstçe: temel değer değil, tarihsel konum)
    let c4, c4note;
    if (athPct == null) { c4 = 50; c4note = 'ATH verisi yok.'; }
    else {
      const below = -athPct;
      c4 = below <= 10 ? 42 : below <= 30 ? 52 : below <= 55 ? 62 : below <= 75 ? 58 : below <= 90 ? 48 : 34;
      c4note = `ATH’nin %${below.toFixed(0)} altında — ${below <= 15 ? 'zirveye yakın (geç/pahalı bölge olabilir).' : below <= 60 ? 'zirveden makul geri çekilme; tarihsel olarak yukarı alan var.' : below <= 90 ? 'derin düşüş — potansiyel değer ama trend zayıf.' : 'zirveden %90+ düşük — çoğu kez kırılmış döngüyü işaret eder.'}`;
      if (chg1y != null) { if (chg1y > 0 && below > 30) c4 = Math.min(100, c4 + 6); if (chg1y < -60) c4 = Math.max(20, c4 - 6); }
    }

    // 5) Olgunluk & istikrar
    const matRank = rank == null ? 35 : rank <= 20 ? 100 : rank <= 50 ? 82 : rank <= 100 ? 66 : rank <= 250 ? 50 : 36;
    const volAbs = chg24 == null ? null : Math.abs(chg24);
    const stab = volAbs == null ? 55 : volAbs <= 3 ? 90 : volAbs <= 6 ? 72 : volAbs <= 12 ? 54 : volAbs <= 20 ? 40 : 28;
    const c5 = 0.6 * matRank + 0.4 * stab;
    const c5note = `Sıralama olgunluğu + son 24s oynaklık ${volAbs != null ? '±' + volAbs.toFixed(1) + '%' : '—'}`;

    let weights = [0.20, 0.25, 0.20, 0.20, 0.15];
    if (category === 'stablecoin') { weights = [0.45, 0.10, 0.15, 0.05, 0.25]; warnings.unshift('Stabilcoin — fiyatı ~$1’e sabittir; “değer” skoru peg istikrarı + likidite odaklıdır, sermaye kazancı beklenmez.'); }
    if (category === 'meme') warnings.unshift('Meme coin — tokenomik/temel dayanağı zayıf, fiyat büyük ölçüde spekülatiftir; skor yüksek olsa da risk çok yüksektir.');

    const comps = [
      { label: 'Ağ & likidite', score: c1, note: c1note, w: weights[0] },
      { label: 'Arz & seyrelme', score: c2, note: c2note, w: weights[1] },
      { label: 'Geliştirici & benimseme', score: c3, note: c3note, w: weights[2] },
      { label: 'Değerleme konumu', score: c4, note: c4note, w: weights[3] },
      { label: 'Olgunluk & istikrar', score: c5, note: c5note, w: weights[4] },
    ];
    const score = Math.round(comps.reduce((a, c) => a + c.score * c.w, 0));
    const CATL = { stablecoin: 'Stabilcoin', meme: 'Meme', l1: 'Katman-1 / Akıllı sözleşme', defi: 'DeFi', other: 'Genel' };
    return { score, band: scoreBand(score), comps, category, catLabel: CATL[category], warnings };
  }
  function valuePanelHTML(title, res, srcNote, tailNote) {
    const bars = res.comps.map((c) => {
      const b = scoreBand(c.score);
      return `<div class="cv-comp">
        <div class="cv-comp-h"><span class="cv-comp-l">${c.label}</span><span class="cv-comp-s ${b.cls}">${Math.round(c.score)}<em>·%${Math.round(c.w * 100)}</em></span></div>
        <div class="cv-bar"><span class="cv-bar-f ${b.cls}" style="width:${Math.max(3, Math.min(100, c.score))}%"></span></div>
        <div class="cv-comp-n">${c.note}</div>
      </div>`;
    }).join('');
    const warn = res.warnings && res.warnings.length
      ? `<div class="cv-warns">${res.warnings.map((w) => `<div class="cv-warn">⚠️ ${w}</div>`).join('')}</div>` : '';
    return `
      <div class="cv">
        <div class="cv-head">
          <div class="cv-score ${res.band.cls}"><span class="cv-num">${res.score}</span><span class="cv-den">/100</span></div>
          <div class="cv-meta"><div class="cv-title">${title}</div>
            <div class="cv-badges"><span class="ta-sig ${res.band.cls}">${res.band.label}</span>${res.catLabel ? `<span class="badge">${res.catLabel}</span>` : ''}</div></div>
        </div>
        ${warn}
        <div class="cv-comps">${bars}</div>
        <div class="cv-disc">${srcNote} Bu skor <b>yalnızca bilgi amaçlıdır</b>, hisse temel/bileşke skorundan ayrıdır ve <b>yatırım tavsiyesi değildir</b>.${tailNote ? ' ' + tailNote : ''}</div>
      </div>`;
  }
  async function fillCryptoValue(coin, req) {
    const box = document.getElementById('cpValue'); if (!box) return;
    const j = await cryptoDetail(coin.id);
    if (req !== spReq) return;
    if (!j) { box.innerHTML = '<div class="empty">Değer verisi alınamadı (CoinGecko).</div>'; return; }
    box.innerHTML = valuePanelHTML('💠 Değer & Tokenomik skoru', computeCryptoValue(j), 'Kaynak: CoinGecko.', 'Zincir-üstü metrikler (NVT, MVRV, aktif adres) ücretli veri ister; bu skora dahil <b>değildir</b>.');
  }

  // ===== Faz C: Maden "Makro Rejim" skoru (0–100) — BİLGİ AMAÇLI =====
  // Madenlerde bilanço/kâr yoktur; değeri belirleyen makro rejimdir: dolar (DXY),
  // faizler (10Y — reel faiz vekili), risk iştahı (VIX), metaller-arası oran ve
  // metalin kendi trendi. Hisse temel/bileşke skoruna DOKUNMAZ.
  // Not: Elimizde NOMİNAL 10Y var; gerçek "reel faiz" TIPS ister → dürüstçe vekil.
  const METAL_MACRO_W = {
    // [Dolar, Faiz, Risk, Metaller-arası oran, Kendi trend]
    'gram-altin': [0.28, 0.28, 0.18, 0.06, 0.20], // altın = saf makro/haven
    'gumus':      [0.22, 0.20, 0.10, 0.23, 0.25], // gümüş = +sınai talep
    'platin':     [0.18, 0.16, 0.08, 0.28, 0.30], // platin = ağır sınai / oto
  };
  function computeMetalMacro(key, d) {
    // d: { dxyChg, tnxChg, vix, gsr, pgr, cuChg, ownM, ownH }
    const N = (x) => (typeof x === 'number' && isFinite(x)) ? x : null;
    const industrial = key !== 'gram-altin';
    const warnings = [];

    // 1) Dolar (DXY aylık değişim) — metaller dolara ters
    const dxy = N(d.dxyChg);
    const c1 = dxy == null ? 50 : dxy <= -3 ? 90 : dxy <= -1 ? 75 : dxy <= 1 ? 55 : dxy <= 3 ? 38 : 22;
    const c1note = dxy == null ? 'Dolar endeksi (DXY) verisi yok.' : `Dolar endeksi son 1 ayda ${fmtPct(dxy)} — ${dxy <= -1 ? 'zayıf dolar madenler için destekleyici.' : dxy >= 1 ? 'güçlü dolar madenlere baskı.' : 'yatay dolar, nötr.'}`;

    // 2) Faizler (10Y yön — reel faiz vekili) — yükselen faiz getirisiz metale baskı
    const tnx = N(d.tnxChg);
    const c2 = tnx == null ? 50 : tnx <= -8 ? 88 : tnx <= -3 ? 72 : tnx <= 3 ? 55 : tnx <= 8 ? 38 : 24;
    const c2note = tnx == null ? '10Y tahvil getirisi verisi yok.' : `10Y getiri son 1 ayda ${fmtPct(tnx)} — ${tnx <= -3 ? 'düşen faiz getirisiz metali destekler.' : tnx >= 3 ? 'yükselen faiz baskı yapar.' : 'yatay faiz, nötr.'} (nominal — reel faiz vekili)`;

    // 3) Risk / VIX — altın için haven; sınai metaller için risk-off olumsuz
    const vix = N(d.vix);
    let c3, c3note;
    if (vix == null) { c3 = 50; c3note = 'VIX (korku endeksi) verisi yok.'; }
    else if (!industrial) {
      c3 = vix >= 30 ? 82 : vix >= 22 ? 68 : vix >= 16 ? 55 : 45;
      c3note = `VIX ${vix.toFixed(1)} — ${vix >= 22 ? 'yüksek korku altına güvenli-liman talebi getirir.' : 'sakin piyasa, haven talebi düşük.'}`;
    } else {
      c3 = vix >= 30 ? 38 : vix >= 22 ? 48 : vix >= 16 ? 58 : 62;
      c3note = `VIX ${vix.toFixed(1)} — ${vix >= 22 ? 'risk-off ortamı sınai metal talebine olumsuz.' : 'sakin piyasa sınai talebe olumlu.'}`;
    }

    // 4) Metaller-arası oran (ortalamaya dönüş)
    const gsr = N(d.gsr), pgr = N(d.pgr);
    let c4, c4note;
    if (key === 'gumus') {
      c4 = gsr == null ? 50 : gsr >= 90 ? 85 : gsr >= 80 ? 72 : gsr >= 65 ? 55 : gsr >= 50 ? 42 : 32;
      c4note = gsr == null ? 'Altın/gümüş oranı yok.' : `Altın/gümüş oranı ${gsr.toFixed(0)} — ${gsr >= 80 ? 'gümüş altına göre tarihsel olarak ucuz (yukarı ayrışma potansiyeli).' : gsr <= 55 ? 'gümüş görece pahalı.' : 'oran normal aralıkta.'}`;
    } else if (key === 'platin') {
      c4 = pgr == null ? 50 : pgr <= 0.5 ? 85 : pgr <= 0.65 ? 72 : pgr <= 0.85 ? 55 : pgr <= 1.0 ? 42 : 32;
      c4note = pgr == null ? 'Platin/altın oranı yok.' : `Platin/altın oranı ${pgr.toFixed(2)} — ${pgr <= 0.65 ? 'platin altına göre tarihi iskontoda (ucuz).' : pgr >= 1 ? 'platin altına göre pahalı.' : 'oran orta bölgede.'}`;
    } else {
      c4 = gsr == null ? 50 : gsr >= 100 ? 42 : gsr >= 85 ? 50 : gsr >= 65 ? 58 : gsr >= 50 ? 55 : 48;
      c4note = gsr == null ? 'Altın/gümüş oranı yok.' : `Altın/gümüş oranı ${gsr.toFixed(0)} — değerli metal kompleksinin genel sağlığı ${gsr >= 100 ? 'gergin.' : 'normal.'}`;
    }

    // 5) Kendi trendi (aylık + 6 aylık) + sınai metaller için bakır modifikatörü
    const om = N(d.ownM), oh = N(d.ownH);
    let trend = null;
    if (om != null && oh != null) trend = 0.5 * om + 0.5 * oh;
    else if (om != null) trend = om;
    else if (oh != null) trend = oh;
    let c5 = trend == null ? 50 : trend >= 10 ? 85 : trend >= 4 ? 70 : trend >= -2 ? 55 : trend >= -8 ? 42 : 30;
    const cu = N(d.cuChg);
    if (industrial && cu != null) {
      const bump = cu >= 5 ? 6 : cu >= 1 ? 3 : cu <= -5 ? -6 : cu <= -1 ? -3 : 0;
      c5 = Math.max(20, Math.min(100, c5 + bump));
    }
    const c5note = `Kendi trendi (1 ay + 6 ay): ${trend != null ? fmtPct(trend) : '—'}${industrial && cu != null ? ` · bakır (sınai talep vekili) 1 ay ${fmtPct(cu)}` : ''}`;

    if (tnx != null) warnings.push('Faiz bileşeni nominal 10Y kullanır; gerçek "reel faiz" (TIPS) ücretli veri ister — bu bir vekildir.');

    const w = METAL_MACRO_W[key] || [0.25, 0.25, 0.15, 0.15, 0.20];
    const catLabel = key === 'gram-altin' ? 'Güvenli liman / makro' : key === 'gumus' ? 'Yarı-sınai' : 'Ağır sınai';
    const comps = [
      { label: 'Dolar (DXY)', score: c1, note: c1note, w: w[0] },
      { label: 'Faizler (10Y)', score: c2, note: c2note, w: w[1] },
      { label: 'Risk iştahı (VIX)', score: c3, note: c3note, w: w[2] },
      { label: 'Metaller-arası oran', score: c4, note: c4note, w: w[3] },
      { label: 'Kendi trendi', score: c5, note: c5note, w: w[4] },
    ];
    const score = Math.round(comps.reduce((a, c) => a + c.score * c.w, 0));
    const LAB = ['Elverişli rejim', 'Ilımlı destek', 'Nötr rejim', 'Zayıf rejim', 'Baskı altında'];
    return { score, band: scoreBand(score, LAB), comps, catLabel, warnings };
  }
  async function metalMacroInputs(info) {
    const pct = (r) => (r && typeof r.pct === 'number' && isFinite(r.pct)) ? r.pct : null;
    const [dxyM, tnxM, vixQ, goldQ, silverQ, platQ, cuM, ownM, ownH] = await Promise.all([
      changeFor('DX-Y.NYB', 'US', 'aylik').catch(() => null),
      changeFor('^TNX', 'US', 'aylik').catch(() => null),
      getQuote('^VIX', 'US').catch(() => null),
      getQuote('GC=F', 'US').catch(() => null),
      getQuote('SI=F', 'US').catch(() => null),
      getQuote('PL=F', 'US').catch(() => null),
      changeFor('HG=F', 'US', 'aylik').catch(() => null),
      changeFor(info.ysym, 'US', 'aylik').catch(() => null),
      changeFor(info.ysym, 'US', 'alti').catch(() => null),
    ]);
    const gp = goldQ && goldQ.price, sp = silverQ && silverQ.price, pp = platQ && platQ.price;
    return {
      dxyChg: pct(dxyM), tnxChg: pct(tnxM),
      vix: vixQ && vixQ.price,
      gsr: (gp && sp) ? gp / sp : null,
      pgr: (pp && gp) ? pp / gp : null,
      cuChg: pct(cuM), ownM: pct(ownM), ownH: pct(ownH),
    };
  }
  function metalMacroHTML(key, d) {
    return valuePanelHTML('🌍 Makro Rejim skoru', computeMetalMacro(key, d), 'Kaynak: Yahoo Finance (DXY · 10Y · VIX · metal spot · bakır).', 'Skor makro <b>rejimi</b> ölçer (fiyat hedefi değil); yalnızca genel ortamın madene elverişliliğini özetler.');
  }
  async function fillMetalMacro(key, info, req) {
    if (!document.getElementById('mpMacro')) return;
    const d = await metalMacroInputs(info);
    if (req !== spReq) return;
    const box = document.getElementById('mpMacro'); if (!box) return;
    box.innerHTML = metalMacroHTML(key, d);
  }

  async function openMetalPage(key, name) {
    const req = ++spReq;
    const info = METAL_SPOT[key]; if (!info) return;
    detailModal.hidden = false; detailModal.classList.add('as-page'); detailContent.scrollTop = 0;
    detailContent.innerHTML = `
      <div class="sp">
        <div class="sp-head" id="spHead"><div class="loading">Yükleniyor…</div></div>
        <div class="sp-section"><div class="sp-sec-h">🔀 Fiyat kırılımı</div><div id="mpBreak"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">🌍 Makro Rejim</div><div id="mpMacro"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h sp-sec-link" data-goto-analysis="technical" role="button" tabindex="0">📈 Teknik Analiz — dünya spot <span class="sp-sec-arrow">tam sayfa →</span></div><div id="spTa"><div class="loading">Hesaplanıyor…</div></div></div>
        <div class="sp-section"><div class="sp-sec-h">📰 Gelişmeler</div><div id="spNews"><div class="loading">Yükleniyor…</div></div></div>
        <div class="sp-section sp-result-sec"><div class="sp-sec-h">🔗 Sonuç</div><div id="spResult"><div class="loading">Hazırlanıyor…</div></div></div>
      </div>`;
    detailContent.querySelectorAll('[data-goto-analysis]').forEach((h) => {
      const go = () => gotoAnalysis(info.ysym, 'US', h.dataset.gotoAnalysis);
      h.addEventListener('click', go);
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    fillMetalHead(key, info, name, req);
    fillMetalBreak(key, info, req);
    fillMetalMacro(key, info, req);
    fillSpTa(info.ysym, 'US', req);
    fillAssetNews([{ q: info.trq, m: 'BIST', label: 'Türkiye' }, { q: info.wq, m: 'US', label: 'Dünya' }], req);
    const usd = usdTry();
    const mfmt = usd ? (v) => (v == null || !isFinite(v)) ? '—' : fmtTRY(v * usd / TROY_OZ_G) + '/g' : null;
    fillAssetPlan(info.ysym, 'US', req, mfmt);
  }

  async function fillMetalHead(key, info, name, req) {
    const gram = truncgilCache ? truncgilGet(truncgilCache, key) : null;
    const [chart, q] = await Promise.all([fetchYahooChart(info.ysym, 'US', '3mo'), getQuote(info.ysym, 'US')]);
    if (req !== spReq) return;
    const head = document.getElementById('spHead'); if (!head) return;
    const spot = (q && q.price != null) ? q.price : (chart && chart.price);
    const prevClose = (q && q.prevClose != null) ? q.prevClose : spot;
    const change = (spot != null && prevClose != null) ? spot - prevClose : null;
    const pct = (change != null && prevClose) ? change / prevClose * 100 : null;
    const cls = change == null ? '' : change >= 0 ? 'up' : 'down';
    const sign = (change != null && change >= 0) ? '+' : '';
    const gramTxt = gram != null ? fmtTRY(gram) + ' /gram' : '—';
    head.innerHTML = `
      <div class="sp-price-row">
        <h2>${name} <span class="badge">${info.emoji} Maden</span></h2>
        <div class="sp-price">${gramTxt}</div>
      </div>
      <div class="sp-meta">Dünya spot (ons): ${spot != null ? '$' + spot.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}${pct != null ? ` <span class="sp-daychg ${cls}">${sign}${pct.toFixed(2)}% bugün</span>` : ''} · ${fmtTime((q && q.marketTime) || (chart && chart.marketTime))}</div>
      ${chart ? makeSparkline(chart.points) : ''}
      <div class="sp-changes" id="spChanges"></div>`;
    fillSpChanges(info.ysym, 'US', req);
  }

  async function fillMetalBreak(key, info, req) {
    const box = document.getElementById('mpBreak'); if (!box) return;
    const gram = truncgilCache ? truncgilGet(truncgilCache, key) : null;
    const usd = usdTry();
    const [q, spotM, kurM] = await Promise.all([
      getQuote(info.ysym, 'US').catch(() => null),
      changeFor(info.ysym, 'US', 'aylik').catch(() => null),
      changeFor('USDTRY=X', 'US', 'aylik').catch(() => null),
    ]);
    if (req !== spReq) return;
    const ons = q && q.price;
    const impliedGram = (ons != null && usd) ? ons * usd / TROY_OZ_G : null;
    const row = (l, v) => `<div class="mp-row"><span>${l}</span><b>${v}</b></div>`;
    let divHTML = '';
    if (spotM && kurM && spotM.pct != null && kurM.pct != null) {
      const diff = spotM.pct - kurM.pct;
      divHTML = `<div class="mp-diverge ${diff >= 0 ? 'up' : 'down'}">Son 1 ay — ons (USD): <b>${fmtPct(spotM.pct)}</b> · USD/TRY: <b>${fmtPct(kurM.pct)}</b> → ayrışma <b>${fmtPct(diff)}</b><br><span class="mp-diverge-txt">${diff >= 0 ? 'Maden dolar bazında da değer kazandı — ₺ artışının bir kısmı gerçek metal talebinden.' : '₺ cinsi kazancın büyük kısmı kur (USD/TRY) yükselişinden kaynaklanıyor, metalin kendi dolar fiyatından değil.'}</span></div>`;
    }
    box.innerHTML = `
      <div class="mp-grid">
        ${row('Gram fiyatı (₺ · Truncgil)', gram != null ? fmtTRY(gram) : '—')}
        ${row('Ons (dünya spot · $)', ons != null ? '$' + ons.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—')}
        ${row('USD/TRY kuru', usd ? fmtTRY(usd) : '—')}
        ${row('Ons→gram teorik türev (₺)', impliedGram != null ? fmtTRY(impliedGram) : '—')}
      </div>
      ${divHTML}
      <div class="mp-note">₺/gram fiyatı iki faktörden etkilenir: <b>dünya ons fiyatı</b> ve <b>USD/TRY kuru</b>. "Teorik türev" satırı bu ikisinden hesaplanan gramı gösterir; Truncgil ile küçük fark işçilik/spread payındandır. Yalnızca bilgi amaçlıdır.</div>`;
  }

  // Ortak haber paneli (kaynak sekmeli) — kripto/maden için
  async function fillAssetNews(sources, req) {
    const box = document.getElementById('spNews'); if (!box) return;
    const results = await Promise.all(sources.map((s) => fetchRSS(googleNewsUrl(s.q, s.m), 10).catch(() => [])));
    if (req !== spReq) return;
    const tabs = sources.map((s, i) => `<button class="detail-tab ${i === 0 ? 'active' : ''}" data-pane="n${i}">${s.label} (${results[i].length})</button>`).join('');
    const panes = sources.map((s, i) => {
      const html = results[i].length ? results[i].map((n) => `<li class="news-item"><a href="${n.link}" target="_blank" rel="noopener">${n.title}</a><div class="meta">${n.author || ''} · ${fmtTime(n.pubDate)}</div></li>`).join('') : '<li class="empty">Haber bulunamadı.</li>';
      return `<div class="detail-pane ${i === 0 ? 'active' : ''}" data-pane="n${i}"><ul class="news-list">${html}</ul></div>`;
    }).join('');
    box.innerHTML = `<div class="detail-tabs">${tabs}</div>${panes}`;
    box.querySelectorAll('.detail-tab').forEach((btn) => btn.addEventListener('click', () => {
      box.querySelectorAll('.detail-tab').forEach((b) => b.classList.remove('active'));
      box.querySelectorAll('.detail-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      box.querySelector(`.detail-pane[data-pane="${btn.dataset.pane}"]`).classList.add('active');
    }));
  }

  // Ortak "Sonuç" — YALNIZ teknik vade planı (bilanço/bileşke YOK; bu varlık sınıflarında temel analiz yok)
  async function fillAssetPlan(symbol, market, req, fmtPOverride) {
    const box = document.getElementById('spResult'); if (!box) return;
    const daily = await ensureDailyCandles(symbol, market);
    if (req !== spReq) return;
    if (!daily) { box.innerHTML = spResultNote(); return; }
    const bench = await ensureBenchDaily(market).catch(() => null);
    if (req !== spReq) return;
    const fmtP = fmtPOverride || ((v) => (v == null || !isFinite(v)) ? '—'
      : '$' + v.toLocaleString('en-US', { maximumFractionDigits: v < 10 ? 2 : v < 1000 ? 1 : 0 }));
    const cards = PLAN_VADES.map(({ key, label, horizon }) => {
      const res = computeVadeScore(daily, key, undefined, bench);
      if (!res || !res.levels) return '';
      const L = res.levels, p = L.price, bz = L.buyZone, sz = L.sellZone;
      let strongBuy = '—', accumBuy = '';
      if (bz && bz[0] != null && bz[1] != null && bz[1] > bz[0]) {
        const mid = (bz[0] + bz[1]) / 2;
        strongBuy = `${fmtP(bz[0])} – ${fmtP(mid)}`;
        accumBuy = `${fmtP(mid)} – ${fmtP(bz[1])}`;
      } else if (bz && bz[0] != null) { strongBuy = `≤ ${fmtP(bz[0])}`; }
      const sellLabel = L.sellKind === 'target' ? '🎯 Hedef bölgesi' : '🔴 Satım bölgesi';
      const sellRange = (sz && sz[0] != null && sz[1] != null) ? `${fmtP(sz[0])} – ${fmtP(sz[1])}` : '—';
      const s50 = L.sma50, trendUp = (s50 != null && p != null) ? p >= s50 : null;
      const trigTxt = s50 == null ? '—' : trendUp ? `SMA50 ${fmtP(s50)} altına günlük kapanış` : `Fiyat SMA50 ${fmtP(s50)} altında — trend zayıf`;
      const hw = (L.atr != null && L.zMult != null) ? L.atr * L.zMult : null;
      const entry = (bz && bz[0] != null && bz[1] != null) ? (bz[0] + bz[1]) / 2 : p;
      const invalid = (bz && bz[0] != null && hw != null) ? bz[0] - hw : L.stop;
      const tgt = (sz && sz[0] != null && sz[1] != null) ? (sz[0] + sz[1]) / 2 : L.target;
      let rr = '—';
      if (tgt != null && entry != null && invalid != null && entry > invalid) rr = ((tgt - entry) / (entry - invalid)).toFixed(1) + ':1';
      const trail = L.atr != null ? 2 * L.atr : null;
      const mom = momentumInfo(res, key);
      const momZone = (mom.active && mom.zone) ? `${fmtP(mom.zone[0])} – ${fmtP(mom.zone[1])}` : '';
      const prox = buyZoneProximity(res);
      const proxHtml = prox ? `<div class="rp-nowpos ${prox.cls}">${prox.txt}</div>` : '';
      return `
        <div class="rp-card ${res.cls}">
          <div class="rp-card-h">
            <span class="rp-vade">${label} <em>${horizon}</em>${mom.active ? ' <span class="rp-mom-badge">⚡ Trend güçlü</span>' : ''}</span>
            <span class="ta-sig ${res.cls}">${res.label} · ${Math.round(res.score)}</span>
          </div>
          ${proxHtml}
          <div class="rp-zones">
            ${mom.active ? `<div class="rp-zone mom"><span class="rp-zl">⚡ Momentum girişi (kademeli)</span><span class="rp-zv">${momZone}</span></div>` : ''}
            <div class="rp-zone buy"><span class="rp-zl">🟢 Güçlü alış</span><span class="rp-zv">${strongBuy}</span></div>
            ${accumBuy ? `<div class="rp-zone buy2"><span class="rp-zl">🟢 Uygun toplama</span><span class="rp-zv">${accumBuy}</span></div>` : ''}
            <div class="rp-zone sell"><span class="rp-zl">${sellLabel}</span><span class="rp-zv">${sellRange}</span></div>
          </div>
          ${anchorBadge(res, symbol, key)}
          <div class="rp-plan">
            <span>⊘ Geçersizleşme (alış tabanı altı): <b>${fmtP(invalid)}</b></span>
            <span>🛡️ Takip stopu: <b>2×ATR ≈ ${fmtP(trail)}</b></span>
            <span>⚑ Trend tetiği: <b>${trigTxt}</b></span>
            <span>⚖️ R/R (alış ortası → hedef ortası): <b>${rr}</b></span>
          </div>
        </div>`;
    }).join('');
    box.innerHTML = `
      <div class="rp">
        <div class="rp-cards">${cards || '<div class="empty">Vade bazlı seviye hesaplanamadı.</div>'}</div>
        <div class="rp-disc">Bu varlık sınıfı için bilanço/temel analiz yoktur; yalnızca fiyat yapısına dayalı <b>teknik</b> bölgeler gösterilir. Bölgeler hacim profili + Fibonacci + Bollinger + vadeye özel ATR bandına dayanır; kesin tepe/dip ya da tarih tahmini <b>değildir</b>. Yatırım tavsiyesi değildir.</div>
      </div>`;
  }

  function renderSpActions(symbol, market, query) {
    const el = document.getElementById('spActions'); if (!el) return;
    const lists = loadLists();
    el.innerHTML = `
      <div class="sp-listwrap">
        <button class="sp-act" id="spListBtn">＋ Listeye ekle ▾</button>
        <div class="sp-listmenu" id="spListMenu" hidden>
          ${lists.map((l) => `<button class="sp-listitem" data-lid="${l.id}">${escapeHtml(l.name)}${l.items.some((i) => i.symbol === symbol && i.market === market) ? ' <span class="sp-li-in">✓</span>' : ''}</button>`).join('')}
          <button class="sp-listitem sp-newlist" id="spNewList">＋ Yeni liste oluştur</button>
        </div>
      </div>`;
    const listBtn = el.querySelector('#spListBtn');
    const menu = el.querySelector('#spListMenu');
    if (listBtn && menu) listBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (menu && !menu.hidden && !el.contains(e.target)) menu.hidden = true; });
    el.querySelectorAll('.sp-listitem[data-lid]').forEach((b) => b.addEventListener('click', () => {
      listAddSymbol(b.dataset.lid, symbol, market, query);
      renderSpActions(symbol, market, query);
      const m2 = document.getElementById('spListMenu'); if (m2) m2.hidden = false;
    }));
    const newBtn = el.querySelector('#spNewList');
    if (newBtn) newBtn.addEventListener('click', () => {
      const nm = prompt('Yeni liste adı:'); if (nm == null) return;
      const id = createList(nm);
      listAddSymbol(id, symbol, market, query);
      renderSpActions(symbol, market, query);
      const m2 = document.getElementById('spListMenu'); if (m2) m2.hidden = false;
    });
  }

  async function fillSpHead(symbol, market, req) {
    // chart(3mo) = sparkline noktaları; quote(1d) = canlı fiyat + DÜNKÜ kapanış (doğru günlük değişim)
    const [chart, q] = await Promise.all([fetchYahooChart(symbol, market, '3mo'), getQuote(symbol, market)]);
    if (req !== spReq) return;
    const head = document.getElementById('spHead'); if (!head) return;
    const price = (q && q.price != null) ? q.price : (chart && chart.price);
    let priceHtml;
    if (price != null) {
      const prevClose = (q && q.prevClose != null) ? q.prevClose : price;
      const change = price - prevClose;
      const pct = prevClose ? (change / prevClose * 100) : 0;
      const cls = change >= 0 ? 'up' : 'down';
      const sign = change >= 0 ? '+' : '';
      const cur = (q && q.currency) || (chart && chart.currency);
      const curSym = cur === 'TRY' ? '₺' : (cur === 'USD' ? '$' : (cur || curSymOf(market)));
      priceHtml = `
        <div class="sp-price-row">
          <h2>${symbol} <span class="badge">${market}</span></h2>
          <div class="sp-price">${price.toFixed(2)} ${curSym}
            <span class="sp-daychg ${cls}">${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%) bugün</span></div>
        </div>
        <div class="sp-meta">${(chart && chart.exchange) || ''} · ${fmtTime((q && q.marketTime) || (chart && chart.marketTime))}</div>
        ${chart ? makeSparkline(chart.points) : ''}`;
    } else {
      priceHtml = `<div class="sp-price-row"><h2>${symbol} <span class="badge">${market}</span></h2></div><div class="sp-meta">Fiyat verisi alınamadı.</div>`;
    }
    head.innerHTML = priceHtml + `<div class="sp-changes" id="spChanges"></div>`;
    fillSpChanges(symbol, market, req);
  }

  async function fillSpChanges(symbol, market, req) {
    const box = document.getElementById('spChanges'); if (!box) return;
    box.innerHTML = CHANGE_PERIODS.map((p) => `<div class="sp-chg" data-k="${p.key}"><span class="sp-chg-l">${p.label}</span><b class="sp-chg-v">…</b></div>`).join('');
    const results = await Promise.allSettled(CHANGE_PERIODS.map((p) => changeFor(symbol, market, p.key)));
    if (req !== spReq) return;
    CHANGE_PERIODS.forEach((p, i) => {
      const cell = box.querySelector(`.sp-chg[data-k="${p.key}"] .sp-chg-v`); if (!cell) return;
      const r = results[i].status === 'fulfilled' ? results[i].value : null;
      const v = r ? r.pct : null;
      cell.textContent = (r && r.delayed && v == null) ? 'gecikmeli' : fmtPct(v);
      cell.className = 'sp-chg-v ' + pctCls(v);
    });
  }

  // ===== 🔀 "Neden hareket ediyor?" — bugünkü hareketi haber+duyarlılıkla uzlaştır =====
  // Skoru/bandı DEĞİŞTİRMEZ; motor yalnız fiyat/ATR görür, WHY'ı görmez. Bu blok bugünkü %
  // değişimi ile haber akışını (computeNewsSentiment) yan yana koyar ve dürüst bir yorum üretir:
  //   büyük hareket + eşleşen haber → şirkete özel katalizör (haber hareketi açıklıyor)
  //   büyük hareket + haber yok/nötr → piyasa geneli / sektörel / teknik (haberle açıklanmıyor)
  //   yön ↔ haber çelişkisi → çelişki uyarısı (temkin)
  //   küçük hareket → sakin
  // Yalnızca bilgi amaçlı; yatırım tavsiyesi / al-sat sinyali değildir.
  async function fillSpWhy(symbol, market, query, req) {
    const box = document.getElementById('spWhy'); if (!box) return;
    let q = null, se = null;
    try {
      [q, se] = await Promise.all([
        getQuote(symbol, market).catch(() => null),
        computeNewsSentiment(symbol, market).catch(() => null),
      ]);
    } catch (_) {}
    if (req !== spReq) return;
    const price = q && q.price != null ? q.price : null;
    const prev = q && q.prevClose != null ? q.prevClose : null;
    const pct = (price != null && prev) ? (price - prev) / prev * 100 : null;
    const absP = pct == null ? null : Math.abs(pct);
    const moveDir = pct == null ? 0 : (pct > 0 ? 1 : (pct < 0 ? -1 : 0));
    const sScore = se ? se.score : 0;
    const sHits = se ? se.hits : 0;
    const newsDir = (!sHits) ? 0 : (sScore >= 0.12 ? 1 : (sScore <= -0.12 ? -1 : 0));
    // Hareket büyüklüğü eşikleri (yaklaşık; günlük tipik oynaklığa göre)
    const BIG = 3.0, MOD = 1.2;
    const moveWord = absP == null ? '—'
      : absP >= BIG ? 'sert' : absP >= MOD ? 'belirgin' : 'sakin';
    const moveSign = pct == null ? '' : (pct >= 0 ? '+' : '');
    const dirWord = moveDir > 0 ? 'yükseliş' : moveDir < 0 ? 'düşüş' : 'yatay';

    let verdict, vCls, vDot;
    if (absP == null) {
      verdict = 'Bugünkü fiyat değişimi alınamadı; aşağıdaki başlıklardan gündemi izleyebilirsin.';
      vCls = 'neutral'; vDot = '⚪';
    } else if (absP < MOD) {
      verdict = `Bugün ${dirWord} <b>sakin</b> (${moveSign}${pct.toFixed(2)}%). Belirgin bir katalizör görünmüyor; olağan gün içi dalgalanma aralığında.`;
      vCls = 'neutral'; vDot = '⚪';
    } else if (sHits && newsDir !== 0 && newsDir === moveDir) {
      verdict = `Bugünkü <b>${moveWord} ${dirWord}</b> (${moveSign}${pct.toFixed(2)}%) haber akışıyla <b>uyumlu</b> — ${se.label.toLowerCase()}. Hareket büyük olasılıkla <b>şirkete özel bir gelişmeden</b> besleniyor (aşağıdaki başlıklara bak).`;
      vCls = moveDir > 0 ? 'bull' : 'bear'; vDot = moveDir > 0 ? '🟢' : '🔴';
    } else if (sHits && newsDir !== 0 && newsDir !== moveDir) {
      verdict = `<b>Çelişki:</b> fiyat ${dirWord} yönünde (${moveSign}${pct.toFixed(2)}%) ama haber akışı ters yönde (${se.label.toLowerCase()}). Hareket haberle açıklanmıyor olabilir — <b>piyasa geneli/sektörel akım ya da teknik</b> baskın olabilir; temkinli oku.`;
      vCls = 'warn'; vDot = '⚠️';
    } else {
      verdict = `Bugün <b>${moveWord} ${dirWord}</b> (${moveSign}${pct.toFixed(2)}%) var ama şirkete özel <b>belirgin bir haber yok</b>. Bu tür hareketler çoğunlukla <b>piyasa geneli / sektörel rotasyon ya da teknik</b> kaynaklıdır (endeks, faiz/emtia, sektör akımı). Şirket temeliyle ilgili olmayabilir.`;
      vCls = moveDir > 0 ? 'bull' : 'bear'; vDot = moveDir > 0 ? '🟢' : '🔴';
    }

    const heads = (se && se.items && se.items.length)
      ? se.items.slice(0, 4).map((it) => {
          const pol = it.pol > 0 ? 'pos' : it.pol < 0 ? 'neg' : 'neu';
          const mark = it.pol > 0 ? '▲' : it.pol < 0 ? '▼' : '·';
          return `<li class="why-head ${pol}"><a href="${it.link}" target="_blank" rel="noopener"><span class="why-mark">${mark}</span>${it.title}</a></li>`;
        }).join('')
      : '<li class="why-empty">Öne çıkan başlık bulunamadı.</li>';

    box.innerHTML = `
      <div class="sp-why ${vCls}">
        <div class="why-verdict"><span class="why-dot">${vDot}</span><span class="why-txt">${verdict}</span></div>
        <div class="why-meta">Bugün: <b class="${pctCls(pct)}">${pct == null ? '—' : moveSign + pct.toFixed(2) + '%'}</b>
          · Haber nabzı: <b class="${se ? se.cls : 'neutral'}">${se ? se.label : '—'}</b>${sHits ? ` (${sHits} sinyal / ${se.n} başlık)` : ''}</div>
        <ul class="why-heads">${heads}</ul>
        <div class="why-foot">Hareketi haber akışıyla uzlaştıran <b>yorum katmanıdır</b>; skora dahil değildir, yatırım tavsiyesi değildir.</div>
      </div>`;
  }

  async function fillSpNews(symbol, market, query, req) {
    const [newsItems, kapAll] = await Promise.all([
      fetchRSS(googleNewsUrl(query, market), 20).catch(() => []),
      market === 'BIST' ? fetchKAP() : Promise.resolve([]),
    ]);
    if (req !== spReq) return;
    const box = document.getElementById('spNews'); if (!box) return;
    const kapItems = market === 'BIST' ? kapItemsForTicker(kapAll, symbol).slice(0, 30) : [];
    const newsHTML = newsItems.length ? newsItems.map((n) => `
      <li class="news-item"><a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
      <div class="meta">${n.author || ''} · ${fmtTime(n.pubDate)}</div></li>`).join('') : '<li class="empty">Haber bulunamadı.</li>';
    const kapHTML = kapItems.length ? kapItems.map((n) => `
      <li class="news-item kap"><a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
      <div class="meta">${fmtTime(n.pubDate)}</div></li>`).join('') : '<li class="empty">KAP duyurusu yok.</li>';
    // Haber Nabzı (Faz 2 sentiment) — hâlihazırda çekilen başlıklardan hesapla, ekstra istek yok
    let sRaw = 0, sHits = 0;
    newsItems.forEach((n) => { const r = scoreHeadline(n.title + ' ' + (n.description || '')); sRaw += r.s; sHits += r.hits; });
    const sScore = sHits ? Math.max(-1, Math.min(1, sRaw / (Math.abs(sRaw) + 4))) : 0;
    const sLab = sentiLabel(sScore, sHits);
    // Fırsatlar tarayıcısının cache'ini de ısıt (aynı hisseye ikinci kez istek gitmesin)
    newsSentiMem[market + ':' + symbol] = { symbol, market, score: sScore, n: newsItems.length, hits: sHits, label: sLab.label, cls: sLab.cls, items: [], t: Date.now() };
    const gaugePct = Math.round((sScore + 1) / 2 * 100); // -1..+1 → 0..100
    const sentiHTML = `
      <div class="sp-senti ${sLab.cls}">
        <div class="sp-senti-top"><span class="sp-senti-ttl">📊 Haber Nabzı</span>
          <span class="sp-senti-lab ${sLab.cls}">${sLab.label}${sHits ? '' : ''}</span></div>
        <div class="sp-senti-bar"><span class="sp-senti-mid"></span><i style="left:${gaugePct}%"></i></div>
        <div class="sp-senti-meta">${sHits} duygu sinyali · ${newsItems.length} başlık taranarak · yalnızca bilgi amaçlı</div>
      </div>`;
    box.innerHTML = sentiHTML + `
      <div class="detail-tabs">
        <button class="detail-tab active" data-pane="news">Haber (${newsItems.length})</button>
        ${market === 'BIST' ? `<button class="detail-tab" data-pane="kap">KAP (${kapItems.length})</button>` : ''}
      </div>
      <div class="detail-pane active" data-pane="news"><ul class="news-list">${newsHTML}</ul></div>
      ${market === 'BIST' ? `<div class="detail-pane" data-pane="kap"><ul class="news-list">${kapHTML}</ul></div>` : ''}`;
    box.querySelectorAll('.detail-tab').forEach((btn) => btn.addEventListener('click', () => {
      box.querySelectorAll('.detail-tab').forEach((b) => b.classList.remove('active'));
      box.querySelectorAll('.detail-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      box.querySelector(`.detail-pane[data-pane="${btn.dataset.pane}"]`).classList.add('active');
    }));
  }

  async function fillSpCalendar(symbol, market, req) {
    const box = document.getElementById('spCal'); if (!box) return;
    const today = new Date();
    if (market === 'BIST') {
      const [allDiv, kapAll] = await Promise.all([fetchTemettuTakvimi().catch(() => []), fetchKAP().catch(() => [])]);
      if (req !== spReq) return;
      const divs = (allDiv || []).filter((d) => d.symbol === symbol).sort((a, b) => b.date - a.date).slice(0, 8);
      const divHTML = divs.length ? divs.map((e) => `
        <a class="div-row${e.date <= today ? '' : ' upcoming'}" href="https://temettuhisseleri.com/hisseanaliz/${symbol}" target="_blank" rel="noopener">
          <span class="div-amt">${e.amount.toFixed(4)} ${e.currency}</span>
          <span class="div-date">${fmtDate(e.date)}${e.yieldPct ? ' · %' + e.yieldPct.toFixed(2) : ''}</span>
          <span class="div-src">${e.date <= today ? 'Ödendi' : 'Bekliyor'}</span></a>`).join('') : '<div class="empty">Temettü kaydı yok.</div>';
      const earn = kapItemsForTicker(kapAll, symbol, { subjectIncludes: EARNINGS_KEYWORDS }).slice(0, 5);
      const earnHTML = earn.length ? earn.map((n) => `
        <li class="news-item"><a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>
        <div class="meta">${fmtTime(n.pubDate)}</div></li>`).join('') : '<li class="empty">Bilanço duyurusu yok.</li>';
      box.innerHTML = `<div class="sp-cal"><div class="sp-cal-col"><div class="sp-cal-h">Temettü</div>${divHTML}</div>
        <div class="sp-cal-col"><div class="sp-cal-h">Bilanço (KAP)</div><ul class="news-list">${earnHTML}</ul></div></div>`;
    } else {
      const divs = await fetchYahooDividends(symbol).catch(() => []);
      if (req !== spReq) return;
      const divHTML = divs.length ? divs.slice(0, 8).map((e) => `
        <a class="div-row${e.date <= today ? '' : ' upcoming'}" href="https://finance.yahoo.com/quote/${symbol}/history" target="_blank" rel="noopener">
          <span class="div-amt">$${e.amount.toFixed(4)}</span>
          <span class="div-date">${fmtDate(e.date)}</span>
          <span class="div-src">${e.date <= today ? 'Ödendi' : 'Bekliyor'}</span></a>`).join('') : '<div class="empty">Temettü kaydı yok.</div>';
      box.innerHTML = `<div class="sp-cal"><div class="sp-cal-col"><div class="sp-cal-h">Temettü</div>${divHTML}</div>
        <div class="sp-cal-col"><div class="sp-cal-h">Bilanço</div><div class="empty">ABD bilanço takvimi bu sürümde yok — SEC / şirket takviminden izlenir.</div></div></div>`;
    }
  }

  async function fillSpTa(symbol, market, req) {
    const box = document.getElementById('spTa'); if (!box) return;
    let ta = null;
    try { ta = await getTaScoreFor(symbol, market, 'orta'); } catch (e) {}
    if (req !== spReq) return;
    if (!ta) { box.innerHTML = '<div class="empty">Teknik skor için yeterli geçmiş veri yok.</div>'; return; }
    const sc = Math.round(ta.score);
    box.innerHTML = `
      <div class="sp-mini ${ta.cls}">
        <div class="sp-mini-top"><span class="sp-mini-num ${ta.cls}">${sc}<em>/100</em></span><span class="ta-sig ${ta.cls}">${ta.label}</span></div>
        <div class="sp-mini-gauge"><div class="sp-mini-mark" style="left:${sc}%"></div></div>
        <div class="sp-mini-scale"><span>0 · SAT</span><span>50</span><span>AL · 100</span></div>
        <div class="sp-mini-note">Orta-uzun vade (≈6–12 ay) teknik skoru — göstergelerin ağırlıklı özeti. Tam analiz: <button class="sp-link" data-goto="technical">Teknik Analiz →</button></div>
      </div>`;
    const g = box.querySelector('[data-goto]');
    if (g) g.addEventListener('click', () => gotoAnalysis(symbol, market, 'technical'));
  }

  async function fillSpFa(symbol, market, req) {
    const faBox = document.getElementById('spFa');
    const resBox = document.getElementById('spResult');
    if (!faBox) return;
    let criteria = null, tiles = null, srcLabel = '', extraNote = '', valuation = null;
    try {
      if (market === 'US') {
        const [metaR, secR] = await Promise.allSettled([
          fetchYahooOHLC(symbol, 'US', '1y', '1d').then((d) => d.meta),
          secFetchModel(symbol),
        ]);
        if (req !== spReq) return;
        const meta = metaR.status === 'fulfilled' ? metaR.value : null;
        const sec = secR.status === 'fulfilled' ? secR.value : null;
        const price = meta && meta.regularMarketPrice;
        if (sec) {
          criteria = sec.criteria.slice();
          const eps = sec.metrics.eps, ni = sec.metrics.ni;
          let pe = null, mcap = null;
          if (price != null && eps) {
            pe = price / eps; if (ni && eps) mcap = price * (ni / eps);
            const score = pe < 0 ? 15 : faInterp(pe, [[5, 90], [10, 80], [15, 70], [20, 60], [25, 52], [35, 38], [50, 22], [80, 10]]);
            criteria.push({ key: 'pe', group: 'valuation', weight: 0.10, label: 'Değerleme (F/K)', score,
              note: pe < 0 ? `F/K negatif — son 12 ayda (TTM) zarar (HBK ${eps.toFixed(2)}).` : `F/K ${pe.toFixed(1)} (canlı fiyat / TTM HBK).` });
          }
          if (eps != null) valuation = { curSym: '$', eps, pe, price, dcfIn: usDcfIn(sec, price, eps) };
          tiles = [
            { label: 'Son Fiyat', val: price != null ? '$' + price.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—' },
            { label: 'Piyasa Değeri', val: fmtUSD(mcap) },
            { label: 'F/K (P/E, TTM)', val: pe == null ? '—' : pe.toFixed(1) },
            { label: 'HBK (EPS, TTM)', val: eps ? '$' + eps.toFixed(2) : '—' },
          ];
          srcLabel = 'SEC EDGAR (TTM + son çeyrek)';
          extraNote = `<p class="hint ta-disclaimer">Gelir/nakit akışı son 12 ay (TTM), bilanço en güncel çeyrek — Kaynak: SEC EDGAR (10-K + son 10-Q) · Dönem: ${sec.fy} · bilanço ${sec.bsDate}. Değerleme = canlı fiyat / TTM HBK. Yatırım tavsiyesi değildir.</p>`;
        } else if (meta) {
          faBox.innerHTML = spPriceFallback('$', meta);
          if (resBox) resBox.innerHTML = spResultNote();
          return;
        }
      } else {
        const [metaR, maliR] = await Promise.allSettled([
          fetchYahooOHLC(symbol, 'BIST', '1y', '1d').then((d) => d.meta),
          fetchIsYatirimMali(symbol),
        ]);
        if (req !== spReq) return;
        const meta = metaR.status === 'fulfilled' ? metaR.value : null;
        const maliRaw = maliR.status === 'fulfilled' ? maliR.value : null;
        if (maliRaw) {
          const mali = parseIsMali(maliRaw);
          const model = bistFundamentalModel(mali, meta);
          criteria = model.criteria; tiles = model.tiles; srcLabel = 'İş Yatırım (TFRS)';
          extraNote = `<p class="hint ta-disclaimer">Kaynak: İş Yatırım (TFRS). Yüksek enflasyonda nominal büyüme/ROE reel performanstan sapabilir. Yatırım tavsiyesi değildir.</p>`;
          // Sonuç değer bandı için F/K + PD/DD: piyasa değeri (şirket kartı) ile net kâr/özsermaye çözülür.
          valuation = await bistValuation(symbol, model.metrics);
          if (req !== spReq) return;
        } else if (meta) {
          faBox.innerHTML = spPriceFallback('₺', meta);
          if (resBox) resBox.innerHTML = spResultNote();
          return;
        }
      }
    } catch (e) { criteria = null; }
    if (req !== spReq) return;
    if (!criteria) {
      faBox.innerHTML = '<div class="empty">Temel veri alınamadı (mali tablo bulunamadı). Kod doğru mu?</div>';
      if (resBox) resBox.innerHTML = spResultNote();
      return;
    }
    renderFaScored(faBox, symbol, market, tiles || [], criteria, srcLabel, extraNote);
    const fa = computeFaScore(criteria);
    if (fa.score != null && resBox) fillResultPlan(resBox, symbol, market, fa.score, () => req === spReq, valuation);
    else if (resBox) resBox.innerHTML = spResultNote();
  }

  function spPriceFallback(curSym, meta) {
    const price = meta.regularMarketPrice, hi = meta.fiftyTwoWeekHigh, lo = meta.fiftyTwoWeekLow;
    const pos = (hi && lo && hi > lo) ? ((price - lo) / (hi - lo) * 100) : null;
    const t = (l, v) => `<div class="fa-tile"><span class="fa-lbl">${l}</span><span class="fa-val">${v}</span></div>`;
    const p = (v) => v ? curSym + v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—';
    return `<div class="fa-tiles">${t('Son Fiyat', p(price))}${t('52H En Yüksek', p(hi))}${t('52H En Düşük', p(lo))}${t('52H Bant Konumu', pos == null ? '—' : '%' + pos.toFixed(0))}</div>
      <div class="empty">Bu sembol için mali tablo bulunamadı (ETF veya yabancı şirket) — temel skor hesaplanamadı; fiyat verisi gösteriliyor.</div>`;
  }

  // Sayfadan tam Teknik/Temel Analiz sekmesine geç (sembolü seçili aç)
  function gotoAnalysis(symbol, market, which) {
    closeStockPage();
    const key = market + ':' + symbol;
    if (!taAllSymbols().some((s) => s.market === market && s.symbol === symbol)
        && !taAdhoc.some((s) => s.market === market && s.symbol === symbol)) {
      taAdhoc.push({ symbol, market });
    }
    const tabBtn = document.querySelector(`.tab[data-tab="${which}"]`);
    if (tabBtn) tabBtn.click();
    const sel = document.getElementById(which === 'technical' ? 'taSymbol' : 'faSymbol');
    if (sel) { buildSymbolOptions(sel); sel.value = key; sel.dispatchEvent(new Event('change')); }
  }

  // ===== Listeler sekmesi =====
  let listsInited = false;
  const listActivePeriods = {}; // listId -> dönem anahtarı
  const listExpanded = {};      // listId -> true ise açık (varsayılan: kapalı)

  function initLists() {
    if (!listsInited) {
      const btn = document.getElementById('newListBtn');
      const inp = document.getElementById('newListName');
      const create = () => { createList(inp.value); inp.value = ''; renderLists(); };
      if (btn) btn.addEventListener('click', create);
      if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
      listsInited = true;
    }
    renderLists();
  }

  function renderLists() {
    const wrap = document.getElementById('listsContainer'); if (!wrap) return;
    const lists = loadLists();
    if (!lists.length) { wrap.innerHTML = '<div class="empty">Henüz liste yok. Yukarıdan yeni bir liste oluştur.</div>'; return; }
    wrap.innerHTML = lists.map(renderListBlock).join('');
    lists.forEach(wireListBlock);
  }

  function renderListBlock(l) {
    const period = listActivePeriods[l.id] || 'gunluk';
    const open = !!listExpanded[l.id];               // varsayılan kapalı
    const inU = l.inUniverse !== false;               // eski listeler: varsayılan dahil
    const notif = l.notify !== false;                 // eski listeler: varsayılan açık
    const rows = l.items.length ? l.items.map((i) => `
      <div class="list-row" data-symbol="${i.symbol}" data-market="${i.market}">
        <span class="lr-sym">${i.symbol} <span class="badge">${i.market}</span></span>
        <span class="lr-price" data-role="price">…</span>
        <span class="lr-chg" data-role="chg">…</span>
        <button class="lr-rm" data-rm title="Listeden çıkar">×</button>
      </div>`).join('') : '<div class="empty">Liste boş — ＋ ile hisse ekle.</div>';
    return `
      <div class="list-block ${open ? 'is-open' : ''}" data-lid="${l.id}">
        <div class="list-head">
          <button class="list-chev" data-act="toggle" aria-expanded="${open}" title="${open ? 'Kapat' : 'Aç'}">▸</button>
          <span class="list-name">${escapeHtml(l.name)}</span>
          <span class="list-count">${l.items.length} hisse</span>
          <span class="list-toggles">
            <label class="list-tg" title="Bu liste analiz/tarama evrenine dahil edilsin mi?">
              <input type="checkbox" data-tg="universe" ${inU ? 'checked' : ''} />
              <span>Evrene dahil</span>
            </label>
            <button class="list-tg-btn ${notif ? 'on' : 'off'}" data-tg="notify" role="switch" aria-checked="${notif}" title="Bu listedeki hisseler için bildirim (telefona push) al">
              🔔 Bildirim <span class="ltg-state">${notif ? 'Açık' : 'Kapalı'}</span>
            </button>
          </span>
          <span class="list-actions">
            <button class="list-mini" data-act="add" title="Hisse ekle">＋</button>
            <button class="list-mini" data-act="rename" title="Yeniden adlandır">✎</button>
            <button class="list-mini" data-act="delete" title="Listeyi sil">🗑</button>
          </span>
        </div>
        <div class="list-body" ${open ? '' : 'hidden'}>
          <div class="list-addform" hidden>
            <input class="la-input" type="text" maxlength="10" placeholder="Kod (ör. THYAO)" />
            <select class="la-market"><option value="BIST">BIST</option><option value="US">ABD</option></select>
            <button class="la-add primary-btn">Ekle</button>
          </div>
          <div class="list-periods">${CHANGE_PERIODS.map((p) => `<button class="list-pbtn ${p.key === period ? 'active' : ''}" data-period="${p.key}">${p.label}</button>`).join('')}</div>
          <div class="list-rows">${rows}</div>
        </div>
      </div>`;
  }

  function fillListRows(block) {
    const lid = block.dataset.lid;
    if (!listExpanded[lid]) return; // yalnız açık listede fiyat çek (kapalıysa gereksiz istek yok)
    const period = listActivePeriods[lid] || 'gunluk';
    block.querySelectorAll('.list-row[data-symbol]').forEach((row) => {
      const symbol = row.dataset.symbol, market = row.dataset.market;
      const priceEl = row.querySelector('[data-role="price"]');
      const chgEl = row.querySelector('[data-role="chg"]');
      getQuote(symbol, market).then((q) => {
        if (priceEl) priceEl.textContent = fmtPrice(q ? q.price : null, market);
      }).catch(() => { if (priceEl) priceEl.textContent = '—'; });
      changeFor(symbol, market, period).then((r) => {
        const v = r ? r.pct : null;
        if (chgEl) { chgEl.textContent = (r && r.delayed && v == null) ? 'gecikmeli' : fmtPct(v); chgEl.className = 'lr-chg ' + pctCls(v); }
      }).catch(() => { if (chgEl) chgEl.textContent = '—'; });
    });
  }

  function wireListBlock(l) {
    const block = document.querySelector(`.list-block[data-lid="${l.id}"]`); if (!block) return;
    // Aç/kapa oku — varsayılan kapalı; ok'a tıklayınca aşağı doğru açılır.
    const chev = block.querySelector('[data-act="toggle"]');
    const body = block.querySelector('.list-body');
    if (chev && body) chev.addEventListener('click', () => {
      const open = !listExpanded[l.id];
      listExpanded[l.id] = open;
      body.hidden = !open;
      block.classList.toggle('is-open', open);
      chev.setAttribute('aria-expanded', String(open));
      chev.title = open ? 'Kapat' : 'Aç';
      if (open) fillListRows(block); // ilk açılışta fiyatları çek
    });
    // Evrene dahil kutucuğu
    block.querySelector('[data-tg="universe"]')?.addEventListener('change', (e) => {
      setListUniverse(l.id, e.target.checked);
    });
    // Bildirim on/off düğmesi
    block.querySelector('[data-tg="notify"]')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const on = btn.classList.contains('on');
      const next = !on;
      setListNotify(l.id, next);
      btn.classList.toggle('on', next);
      btn.classList.toggle('off', !next);
      btn.setAttribute('aria-checked', String(next));
      const st = btn.querySelector('.ltg-state'); if (st) st.textContent = next ? 'Açık' : 'Kapalı';
    });
    block.querySelectorAll('.list-pbtn').forEach((b) => b.addEventListener('click', () => {
      listActivePeriods[l.id] = b.dataset.period;
      block.querySelectorAll('.list-pbtn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      fillListRows(block);
    }));
    block.querySelectorAll('.list-row[data-symbol]').forEach((row) => row.addEventListener('click', (e) => {
      if (e.target.closest('[data-rm]')) return;
      openStockPage(row.dataset.symbol, row.dataset.market, row.dataset.symbol);
    }));
    block.querySelectorAll('[data-rm]').forEach((btn) => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = btn.closest('.list-row');
      listRemoveSymbol(l.id, row.dataset.symbol, row.dataset.market);
      renderLists();
    }));
    const af = block.querySelector('.list-addform');
    block.querySelector('[data-act="add"]')?.addEventListener('click', () => { if (af) af.hidden = !af.hidden; });
    block.querySelector('[data-act="rename"]')?.addEventListener('click', () => {
      const nm = prompt('Liste adı:', l.name); if (nm != null) { renameList(l.id, nm); renderLists(); }
    });
    block.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
      if (confirm(`"${l.name}" listesi silinsin mi?`)) { deleteList(l.id); renderLists(); }
    });
    if (af) {
      const inp = af.querySelector('.la-input');
      if (inp) inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, ''); });
      af.querySelector('.la-add')?.addEventListener('click', () => {
        const res = listAddSymbol(l.id, inp.value, af.querySelector('.la-market').value, inp.value);
        if (!res.ok) { inp.style.borderColor = 'var(--red)'; inp.title = res.err; setTimeout(() => { inp.style.borderColor = ''; }, 1500); return; }
        renderLists();
      });
    }
    fillListRows(block);
  }

  // ===== Arama sekmesi =====
  let searchInited = false;
  // ===== Evrensel varlık çözümleyici (hisse / kripto / maden — tek arama kutusu) =====
  // Kullanıcı ne yazarsa yazsın (kod, isim, "altın", "bitcoin") doğru sayfayı açar;
  // piyasa (BIST/ABD) seçtirmez, isim tahmini yaptırmaz. Belirsizlikte seçim kartı gösterir.
  function trNorm(s) {
    return String(s || '').toLowerCase()
      .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ş/g, 's').replace(/Ş/g, 's')
      .replace(/ğ/g, 'g').replace(/Ğ/g, 'g').replace(/ü/g, 'u').replace(/Ü/g, 'u')
      .replace(/ö/g, 'o').replace(/Ö/g, 'o').replace(/ç/g, 'c').replace(/Ç/g, 'c')
      .trim();
  }
  const METAL_ALIASES = {
    'gram-altin': ['altin', 'gold', 'xau', 'gram altin', 'has altin', 'ons altin', 'gramaltin'],
    'gumus':      ['gumus', 'silver', 'xag'],
    'platin':     ['platin', 'platinum', 'xpt'],
  };
  const METAL_NAMES = { 'gram-altin': 'Altın', 'gumus': 'Gümüş', 'platin': 'Platin' };
  function metalLookup(q) {
    const n = trNorm(q);
    for (const key in METAL_ALIASES) {
      if (METAL_ALIASES[key].some((a) => trNorm(a) === n)) return { type: 'metal', key, name: METAL_NAMES[key] };
    }
    return null;
  }
  // Kripto: önce yerleşik liste (ağsız hızlı yol), sonra CoinGecko /search (açık uçlu).
  function cryptoLocal(q) {
    const n = trNorm(q);
    const c = BM_CRYPTO.find((c) => trNorm(c.sym) === n || trNorm(c.name) === n || trNorm(c.id) === n);
    return c ? { type: 'crypto', exact: true, coin: { id: c.id, sym: c.sym, name: c.name } } : null;
  }
  async function cryptoResolve(q) {
    const local = cryptoLocal(q); if (local) return local;
    const n = trNorm(q);
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q));
      const j = await r.json();
      const coins = (j && Array.isArray(j.coins)) ? j.coins : [];
      const ranked = coins.filter((c) => c.market_cap_rank != null).sort((a, b) => a.market_cap_rank - b.market_cap_rank);
      // Çöp token'ları ele: sıralaması olan (≤600) ve yazıyla makul eşleşen ilk coin
      const pick = ranked.find((c) => {
        const sym = trNorm(c.symbol), nm = trNorm(c.name);
        return c.market_cap_rank <= 600 && (sym === n || nm === n || nm.includes(n) || (sym && n.includes(sym)));
      });
      // CoinGecko /search adı tam eşleşen coin'i "exact" say (fuzzy stok gürültüsünü elemeye yarar).
      if (pick) { const ex = trNorm(pick.symbol) === n || trNorm(pick.name) === n; return { type: 'crypto', exact: ex, coin: { id: pick.id, sym: (pick.symbol || '').toUpperCase(), name: pick.name } }; }
    } catch (e) {}
    return null;
  }
  // Hisse: Yahoo autocomplete (api/yfin proxy) → borsa tespiti (BIST .IS mi ABD mi).
  async function stockResolve(q) {
    const n = trNorm(q);
    try {
      const r = await fetch(YFIN_BASE + '?search=' + encodeURIComponent(q));
      const j = await r.json();
      const quotes = (j && Array.isArray(j.quotes)) ? j.quotes : [];
      // Kripto/emtia/döviz sonuçlarını ele — onları kendi motorlarımız yönetir.
      const eq = quotes.filter((x) => ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'].includes(String(x.type || '').toUpperCase()));
      if (!eq.length) return null;
      const exact = eq.find((x) => trNorm(x.symbol) === n || trNorm(x.symbol) === n + '.is');
      const top = exact || eq[0];
      const isBist = /\.IS$/i.test(top.symbol) || String(top.exch || '').toUpperCase() === 'IST';
      const market = isBist ? 'BIST' : 'US';
      const symbol = isBist ? top.symbol.replace(/\.IS$/i, '').toUpperCase() : top.symbol.toUpperCase();
      // exact = kod birebir eşleşti; aksi halde Yahoo'nun bulanık (fuzzy) ilk sonucu → düşük güven.
      return { type: 'stock', exact: !!exact, symbol, market, name: top.name || symbol };
    } catch (e) {}
    return null;
  }
  // Güven skoru: birebir eşleşme > bulanık (fuzzy) eşleşme. Maden her zaman küratörlü
  // takma-addan geldiği için birebir kabul edilir. Bu sıralama, "altın" gibi net bir
  // maden/kripto adının Yahoo'nun bulanık ilk hisse sonucunu (ör. SIMO) yanlışlıkla
  // ezmesini engeller.
  function candScore(c) {
    if (c.type === 'stock') return c.exact ? 5 : 1;   // kod birebir → 5, Yahoo fuzzy → 1
    if (c.type === 'metal') return 4;                  // küratörlü takma ad = birebir
    if (c.type === 'crypto') return c.exact ? 4 : 2;   // yerleşik/isim birebir → 4, fuzzy → 2
    return 0;
  }
  // Üç kaynağı paralel çalıştır, geçerli adayları döndür (0 = bulunamadı, 2+ = belirsiz).
  // Net bir maden/kripto (birebir) eşleşmesi varken yalnız bulanık hisseyi at ki
  // seçim kartı gereksiz "SIMO" gibi alakasız sonuçlarla kirlenmesin.
  async function resolveAsset(q) {
    const metal = metalLookup(q);
    const [crypto, stock] = await Promise.all([cryptoResolve(q), stockResolve(q)]);
    let cands = [metal, crypto, stock].filter(Boolean);
    const hasExactNonStock = cands.some((c) => c.type !== 'stock' && candScore(c) >= 4);
    if (hasExactNonStock) cands = cands.filter((c) => !(c.type === 'stock' && !c.exact));
    return cands.sort((a, b) => candScore(b) - candScore(a));
  }
  // Tab bağlamı (Teknik/Temel): tek en iyi aday — güven skoruna göre.
  function candKey(c) {
    if (c.type === 'stock') return { symbol: c.symbol, market: c.market };
    if (c.type === 'crypto') return { symbol: c.coin.sym + '-USD', market: 'US' };
    if (c.type === 'metal') return { symbol: METAL_SPOT[c.key].ysym, market: 'US' };
    return null;
  }
  async function resolveOne(q) {
    const cands = await resolveAsset(q);
    if (!cands.length) return null;
    return cands[0]; // resolveAsset zaten güven skoruna göre sıralı döndürür
  }
  function openResolved(c) {
    if (!c) return;
    if (c.type === 'metal') openMetalPage(c.key, c.name);
    else if (c.type === 'crypto') openCryptoPage(c.coin);
    else if (c.type === 'stock') { rememberSearch(c.symbol, c.market); renderRecentSearches(); openStockPage(c.symbol, c.market, c.symbol); }
  }
  function candLabel(c) {
    if (c.type === 'metal') { const e = c.key === 'gram-altin' ? '🥇' : c.key === 'gumus' ? '🥈' : '⚪'; return `${e} ${c.name} <span class="badge">Maden</span>`; }
    if (c.type === 'crypto') return `🪙 ${c.coin.name} <span class="badge">${c.coin.sym} · Kripto</span>`;
    return `📈 ${c.symbol} <span class="badge">${c.name || ''} · ${c.market === 'BIST' ? 'BIST' : 'ABD'} hisse</span>`;
  }

  function initSearch() {
    if (!searchInited) {
      const inp = document.getElementById('searchInput');
      const btn = document.getElementById('searchBtn');
      let searching = false;
      const flashErr = (msg) => { inp.style.borderColor = 'var(--red)'; if (msg) inp.title = msg; setTimeout(() => { inp.style.borderColor = ''; }, 1400); };
      const go = async () => {
        if (searching) return;
        const raw = (inp.value || '').trim();
        if (raw.length < 1) { flashErr('Bir hisse, kripto ya da maden yazın.'); return; }
        searching = true;
        const box = document.getElementById('searchResult');
        if (box) box.innerHTML = '<div class="loading" style="padding:14px">Aranıyor… (hisse · kripto · maden)</div>';
        let cands = [];
        try { cands = await resolveAsset(raw); } catch (e) {}
        searching = false;
        if (!cands.length) {
          if (box) box.innerHTML = `<div class="empty" style="padding:14px">“${escapeHtml(raw)}” için hisse, kripto ya da maden bulunamadı. Kod (AAPL, THYAO) ya da isim (bitcoin, altın) deneyin.</div>`;
          renderRecentSearches();
          return;
        }
        if (cands.length === 1) { openResolved(cands[0]); return; }
        renderDisambig(cands, raw);
      };
      if (btn) btn.addEventListener('click', go);
      if (inp) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      searchInited = true;
    }
    renderRecentSearches();
  }

  // Belirsizlik kartı: aynı yazı birden çok varlık türüne uyduğunda seçim sun.
  function renderDisambig(cands, raw) {
    const box = document.getElementById('searchResult'); if (!box) return;
    box.innerHTML = `
      <div class="search-disambig">
        <div class="sd-h">“${escapeHtml(raw)}” birden çok varlığa uyuyor — hangisini açayım?</div>
        <div class="sd-list">${cands.map((c, i) => `<button class="sd-item" data-i="${i}">${candLabel(c)}</button>`).join('')}</div>
      </div>`;
    box.querySelectorAll('.sd-item').forEach((b) => b.addEventListener('click', () => openResolved(cands[+b.dataset.i])));
  }

  // Küçük ⓘ ipucu üretici (hover + dokun-aç)
  function infoDot(tip) {
    return `<span class="info-dot" tabindex="0" role="button" aria-label="Bilgi" data-tip="${String(tip).replace(/"/g, '&quot;')}">ⓘ</span>`;
  }

  function renderRecentSearches() {
    const box = document.getElementById('searchResult'); if (!box) return;
    const recent = loadRecentSearches();
    // Kripto + maden hızlı erişim (arama = 3 piyasanın tek giriş noktası)
    const cryptoChips = (typeof BM_CRYPTO !== 'undefined' && Array.isArray(BM_CRYPTO))
      ? BM_CRYPTO.slice(0, 6).map((c, i) => `<button class="search-qchip" data-qc="crypto" data-i="${i}">🪙 ${c.name}</button>`).join('') : '';
    const metalNames = { 'gram-altin': 'Altın', 'gumus': 'Gümüş', 'platin': 'Platin' };
    const metalChips = (typeof METAL_SPOT !== 'undefined')
      ? Object.keys(METAL_SPOT).map((mk) => `<button class="search-qchip" data-qm="${mk}">🥇 ${metalNames[mk] || mk}</button>`).join('') : '';
    box.innerHTML = `
      <div class="search-hint">Bir hisse/ETF kodu aratın — genel bilgi, gelişmeler, takvim, teknik + temel analiz ve sonucun olduğu sayfası açılır.
        ${infoDot('Açılan sayfa: 📈 fiyat & değişim, 📰 gelişmeler, 📅 takvim, teknik skor (0–100) ve temel skorla birlikte çok-vadeli bir yatırım planı. Hepsi yalnızca bilgi amaçlıdır; yatırım tavsiyesi değildir.')}
      </div>
      ${recent.length ? `<div class="search-recent-h">Son aramalar ${infoDot('Yakın zamanda aradığın kodlar. Tıklayınca analiz sayfası tekrar açılır.')}</div><div class="search-recent">${recent.map((r) => `<button class="search-chip" data-symbol="${r.symbol}" data-market="${r.market}">${r.symbol} <span class="badge">${r.market}</span></button>`).join('')}</div>` : ''}
      ${(cryptoChips || metalChips) ? `
        <div class="search-quick-h">🪙 Kripto & 🥇 Madenler ${infoDot('Bu varlık sınıflarında bilanço/temel skor yoktur; açılan sayfa yalnızca fiyat yapısına dayalı teknik bölgeler sunar. Yatırım tavsiyesi değildir.')}</div>
        <div class="search-quick">${cryptoChips}${metalChips}</div>` : ''}`;
    box.querySelectorAll('.search-chip').forEach((b) => b.addEventListener('click', () => openStockPage(b.dataset.symbol, b.dataset.market, b.dataset.symbol)));
    box.querySelectorAll('.search-qchip[data-qc="crypto"]').forEach((b) => b.addEventListener('click', () => {
      const c = BM_CRYPTO[+b.dataset.i]; if (c && typeof openCryptoPage === 'function') openCryptoPage(c);
    }));
    box.querySelectorAll('.search-qchip[data-qm]').forEach((b) => b.addEventListener('click', () => {
      if (typeof openMetalPage === 'function') openMetalPage(b.dataset.qm, metalNames[b.dataset.qm] || b.dataset.qm);
    }));
  }

  // ===== Faz 2: Haber Duyarlılık (Sentiment) Motoru =====
  // Hisse başına son haber başlıklarını çekip sözlük tabanlı bir duygu skoru üretir.
  // score: -1..+1  (pozitif = iyimser haber akışı, negatif = kötümser)
  const NEWS_SENTI_TTL = 30 * 60 * 1000; // 30 dk
  const newsSentiMem = {}; // 'MKT:SYM' -> son sonuç

  // Finansal duygu sözlüğü (TR + EN). Değer = sözcüğün duygusal ağırlığı.
  const SENTI_POS = {
    'rekor':2,'zirve':2,'yükseliş':1.5,'yükseldi':1.5,'arttı':1,'artış':1,'kâr':1.5,'kar payı':1.5,'temettü':1.5,
    'büyüme':1.5,'büyüdü':1.5,'anlaşma':1.5,'imzaladı':1,'sözleşme':1,'ihale':1.5,'kazandı':1.5,'onay':1.5,'onaylandı':1.5,
    'ruhsat':1.5,'yeni yatırım':1.5,'kapasite art':1.5,'ihracat':1,'talep art':1.5,'güçlü':1,'beklenti üzeri':2,'sürpriz kâr':2,
    'geri alım':1.5,'bedelsiz':2,'teşvik':1,'iş birliği':1,'ortaklık':1,'primli':1.5,'hedef fiyat yüksel':2,'al tavsiye':2,
    'record':2,'surge':2,'soar':2,'soars':2,'rally':1.5,'jumps':1.5,'beat':2,'beats':2,'upgrade':2,'upgraded':2,'outperform':1.5,
    'buy rating':2,'raises guidance':2,'strong':1,'growth':1.5,'profit':1.5,'dividend':1.5,'buyback':1.5,'approval':1.5,'approved':1.5,
    'wins':1.5,'contract':1,'deal':1.5,'expansion':1,'bullish':2,'all-time high':2,'tops estimates':2,'price target raise':2,
  };
  const SENTI_NEG = {
    'düşüş':1.5,'düştü':1.5,'geriledi':1.5,'zarar':2,'kayıp':1.5,'iflas':3,'konkordato':3,'soruşturma':2,'ceza':2,'dava':1.5,
    'zayıf':1,'beklenti altı':2,'satış baskı':1.5,'kâr uyarı':2.5,'küçülme':1.5,'daralma':1.5,'temerrüt':3,'gözaltı':2,
    'durduruldu':2,'geri çağır':2,'grev':1.5,'yaptırım':2,'sermaye azalt':2,'değer kayb':1.5,'hedef fiyat düşür':2,'sat tavsiye':2,
    'plunge':2,'plunges':2,'crash':2.5,'slump':2,'falls':1.5,'drops':1.5,'tumble':2,'miss':2,'misses':2,'downgrade':2,'downgraded':2,
    'loss':2,'losses':2,'lawsuit':1.5,'probe':2,'investigation':2,'recall':2,'bankruptcy':3,'default':3,'warning':1.5,'profit warning':2.5,
    'cuts guidance':2.5,'weak':1,'bearish':2,'layoffs':1.5,'fraud':3,'sec charges':2.5,'halted':2,'selloff':1.5,'underperform':1.5,
  };

  function scoreHeadline(text) {
    const t = ' ' + (text || '').toLowerCase() + ' ';
    let s = 0, hits = 0;
    for (const w in SENTI_POS) if (t.includes(w)) { s += SENTI_POS[w]; hits++; }
    for (const w in SENTI_NEG) if (t.includes(w)) { s -= SENTI_NEG[w]; hits++; }
    return { s, hits };
  }

  function sentiLabel(score, hits) {
    if (!hits) return { label: 'Haber sinyali yok', cls: 'neutral' };
    if (score >= 0.35)  return { label: 'Pozitif haber akışı', cls: 'bull' };
    if (score >= 0.12)  return { label: 'Hafif pozitif', cls: 'bull' };
    if (score > -0.12)  return { label: 'Nötr haber akışı', cls: 'neutral' };
    if (score > -0.35)  return { label: 'Hafif negatif', cls: 'bear' };
    return { label: 'Negatif haber akışı', cls: 'bear' };
  }

  // Bir hisse için haber duyarlılık skoru (cache'li, 30 dk)
  async function computeNewsSentiment(symbol, market, opts = {}) {
    const key = market + ':' + symbol;
    const mem = newsSentiMem[key];
    if (!opts.force && mem && Date.now() - mem.t < NEWS_SENTI_TTL) return mem;
    const cKey = 'senti:' + key;
    if (!opts.force) {
      const c = cacheGet(cKey);
      if (c && c.data && Date.now() - c.t < NEWS_SENTI_TTL) { newsSentiMem[key] = c.data; return c.data; }
    }
    const q = market === 'BIST' ? `${symbol} hisse` : `${symbol} stock`;
    const url = market === 'BIST'
      ? `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    let items = [];
    try { items = await fetchRSS(url, 12); } catch (_) {}
    let raw = 0, totalHits = 0;
    const scored = [];
    items.forEach((it) => {
      const r = scoreHeadline(it.title + ' ' + (it.description || ''));
      if (r.hits) { raw += r.s; totalHits += r.hits; scored.push({ title: it.title, link: it.link, pol: r.s }); }
    });
    // Yumuşak sıkıştırma -1..+1 (raw=4 → 0.5, raw=8 → 0.67)
    const score = totalHits ? Math.max(-1, Math.min(1, raw / (Math.abs(raw) + 4))) : 0;
    const lab = sentiLabel(score, totalHits);
    const res = { symbol, market, score, n: items.length, hits: totalHits, label: lab.label, cls: lab.cls,
                  items: scored.sort((a, b) => Math.abs(b.pol) - Math.abs(a.pol)).slice(0, 5), t: Date.now() };
    newsSentiMem[key] = res;
    cacheSet(cKey, res);
    return res;
  }

  // Haber duyarlılığını kompakt bir rozete çevir (Fırsatlar satırı için)
  function newsChip(se) {
    if (!se) return '';
    const pct = Math.round(se.score * 100);
    const sign = se.score >= 0.12 ? '+' : (se.score <= -0.12 ? '−' : '·');
    const shown = se.hits ? `${sign}${Math.abs(pct)}` : '·';
    return `<span class="opp-news ${se.cls}" title="Haber nabzı: ${se.label} · ${se.hits} sinyal / ${se.n} başlık">📰 ${shown}</span>`;
  }

  // ===== Fırsatlar (Faz 1: teknik-skor tabanlı fırsat tarayıcı) =====
  let oppsInited = false;
  let oppsMkt = 'ALL';
  let oppsScanId = 0;

  function initOpportunities() {
    if (!oppsInited) {
      document.querySelectorAll('.chip[data-opps-mkt]').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-opps-mkt]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        oppsMkt = b.dataset.oppsMkt;
        renderOpportunities();
      }));
      const rb = document.getElementById('oppsRefresh');
      if (rb) rb.addEventListener('click', () => renderOpportunities(true));
      oppsInited = true;
    }
    renderOpportunities();
  }

  // Skora göre fırsat etiketi (computeVadeScore 'orta' skoru 2..98)
  function oppTag(score) {
    if (score >= 66) return { txt: '🔥 Güçlü Fırsat', cls: 'strong' };
    if (score >= 56) return { txt: '🟢 Fırsat oluşuyor', cls: 'good' };
    if (score > 52)  return { txt: '🟡 İzle', cls: 'watch' };
    if (score >= 48) return { txt: '⚪ Nötr', cls: 'neutral' };
    if (score > 44)  return { txt: '🔻 Zayıf', cls: 'weak' };
    return { txt: '⛔ Uzak dur', cls: 'risk' };
  }

  async function renderOpportunities(force) {
    const listEl = document.getElementById('oppsList');
    const statusEl = document.getElementById('oppsStatus');
    if (!listEl) return;
    const myScan = ++oppsScanId; // yarış koruması: sonraki tarama öncekini geçersiz kılar

    let universe = taAllSymbols();
    if (oppsMkt !== 'ALL') universe = universe.filter((s) => s.market === oppsMkt);
    if (!universe.length) {
      statusEl.textContent = '';
      listEl.innerHTML = '<div class="empty">İzleme evreni boş. Portföye hisse ekle veya bir liste oluştur; burada fırsat sıralaması çıkar.</div>';
      return;
    }

    if (force) universe.forEach((s) => { delete vadeCache[s.market + ':' + s.symbol]; });

    statusEl.textContent = `Taranıyor… 0/${universe.length}`;
    listEl.innerHTML = '';

    const results = [];
    let done = 0;
    // Küçük eşzamanlılıkla tara (API'yi yormadan): 4'erli havuz
    const queue = universe.slice();
    async function worker() {
      while (queue.length) {
        const s = queue.shift();
        let row = null;
        try {
          const daily = await ensureDailyCandles(s.symbol, s.market);
          if (daily) {
            const bench = await ensureBenchDaily(s.market); // RS için endeks (cache'li)
            const r = computeVadeScore(daily, 'orta', undefined, bench);
            if (r) {
              const drivers = (r.breakdown || []).slice(0, 2).map((b) => b.label).filter(Boolean);
              row = { symbol: s.symbol, market: s.market, group: s.group, score: r.score, label: r.label, cls: r.cls, drivers };
            }
          }
        } catch (_) {}
        if (myScan !== oppsScanId) return; // iptal edildi
        if (row) results.push(row);
        done++;
        if (statusEl) statusEl.textContent = `Taranıyor… ${done}/${universe.length}`;
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (myScan !== oppsScanId) return;

    const scored = results.length;
    const failed = universe.length - scored;
    if (!scored) {
      statusEl.textContent = `0 sembol sıralandı${failed ? ` · ${failed} sembolde veri alınamadı` : ''}`;
      listEl.innerHTML = '<div class="empty">Bu evren için teknik veri alınamadı. Daha sonra tekrar dene.</div>';
      return;
    }

    // Bileşik skor = teknik skor + haber duyarlılığı eğimi (±7 puan). Haber gelene kadar = teknik.
    results.forEach((r) => { r.combined = r.score; });

    // Satırı çiz (bileşik skora göre)
    function oppRowHtml(r, i) {
      const eff = (r.combined != null ? r.combined : r.score);
      const tag = oppTag(eff);
      const w = Math.max(2, Math.min(100, eff));
      const drv = r.drivers.length ? `<span class="opp-drivers">${r.drivers.join(' · ')}</span>` : '';
      const news = newsChip(r.senti);
      return `
        <div class="opp-row ${tag.cls}" data-symbol="${r.symbol}" data-market="${r.market}">
          <span class="opp-rank">${i + 1}</span>
          <div class="opp-main">
            <div class="opp-top">
              <span class="opp-sym">${r.symbol} <span class="badge">${r.market}</span></span>
              <span class="opp-tag ${tag.cls}">${tag.txt}</span>
            </div>
            <div class="opp-bar"><i class="${r.cls}" style="width:${w}%"></i></div>
            <div class="opp-meta"><span class="opp-label ${r.cls}">${r.label}</span>${news}${drv}<span class="opp-group">${r.group || ''}</span></div>
          </div>
          <span class="opp-score ${r.cls}">${Math.round(eff)}<em>/100</em></span>
        </div>`;
    }
    function paint() {
      results.sort((a, b) => (b.combined != null ? b.combined : b.score) - (a.combined != null ? a.combined : a.score));
      listEl.innerHTML = results.map((r, i) => oppRowHtml(r, i)).join('');
      listEl.querySelectorAll('.opp-row').forEach((el) =>
        el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    }
    statusEl.textContent = `${scored} sembol sıralandı${failed ? ` · ${failed} sembolde veri alınamadı` : ''}`;
    paint();

    // ---- Faz 2: Haber duyarlılığını arka planda ekle, bileşik skorla yeniden sırala ----
    statusEl.textContent = `${scored} sembol sıralandı · haber nabzı ekleniyor…`;
    const sq = results.slice();
    let sDone = 0, repaintPending = false;
    function scheduleRepaint() {
      if (repaintPending) return;
      repaintPending = true;
      setTimeout(() => { if (myScan === oppsScanId) { repaintPending = false; paint(); } }, 400);
    }
    async function sentiWorker() {
      while (sq.length) {
        const r = sq.shift();
        try {
          const se = await computeNewsSentiment(r.symbol, r.market, { force });
          if (myScan !== oppsScanId) return;
          r.senti = se;
          // Teknik skora ±7 puanlık haber eğimi ekle (2..98 sınırlı)
          r.combined = Math.max(2, Math.min(98, r.score + se.score * 7));
        } catch (_) {}
        sDone++;
        scheduleRepaint();
      }
    }
    // Haber için 3'erli havuz (proxy'i yormadan)
    await Promise.all([sentiWorker(), sentiWorker(), sentiWorker()]);
    if (myScan !== oppsScanId) return;
    paint();
    statusEl.textContent = `${scored} sembol · teknik + haber nabzı ile sıralandı${failed ? ` · ${failed} veri yok` : ''}`;
  }

  // ===== 🔎 Sistematik Tarama (Değer / Büyüme / Kalite presetleri) =====
  // Yahoo temel metriklerini (fetchCompareBatch → tek toplu /api/yfin) çeker; her hisseye
  // preset'e özgü, ŞEFFAF ölçütlü 0-100 skor verir. SADECE BİLGİ; bileşke/uygunluk skoruna
  // DAHİL DEĞİL. Zarar eden (negatif F/K) şirket "ucuz" sayılmaz; temel verisi olmayan
  // (ETF / kâr etmeyen) semboller sıralamaya girmez, ayrıca işaretlenir.
  let scanInited = false, scanPreset = 'value', scanMkt = 'ALL', scanScanId = 0;

  const SCAN_PRESETS = {
    value: {
      emoji: '💰', name: 'Değer',
      desc: '<b>💰 Değer taraması:</b> izleme evrenini ucuzluk göstergelerine göre sıralar — F/K, PD/DD, FD/FAVÖK düşük + temettü verimi artı. <b>Zarar eden (negatif F/K) şirketler "ucuz" sayılmaz</b>, ayrıca işaretlenir.',
      tags: [{ min: 70, txt: '💎 Belirgin ucuz', cls: 'strong' }, { min: 50, txt: '🟢 Makul-ucuz', cls: 'good' }, { min: 0, txt: '🔴 Pahalı', cls: 'weak' }],
    },
    growth: {
      emoji: '🚀', name: 'Büyüme',
      desc: '<b>🚀 Büyüme taraması:</b> gelir büyümesi yüksek + kazancın hızlandığı (İleri F/K < F/K) + büyümeye göre ucuz (PEG düşük) hisseleri öne çıkarır.',
      tags: [{ min: 70, txt: '🚀 Güçlü büyüme', cls: 'strong' }, { min: 50, txt: '🟢 Ilımlı büyüme', cls: 'good' }, { min: 0, txt: '🔴 Zayıf büyüme', cls: 'weak' }],
    },
    quality: {
      emoji: '🏅', name: 'Kalite',
      desc: '<b>🏅 Kalite taraması:</b> özsermaye kârlılığı (ROE) yüksek + net kâr marjı yüksek + borç/özsermaye düşük şirketleri sıralar. Sağlam bilanço + verimli sermaye.',
      tags: [{ min: 70, txt: '🏅 Yüksek kalite', cls: 'strong' }, { min: 50, txt: '🟢 Orta kalite', cls: 'good' }, { min: 0, txt: '🔴 Düşük kalite', cls: 'weak' }],
    },
  };

  // Bir alt-skoru ✓/~/✗ ölçüt rozetine çevir (65+ geçer, 45+ orta, altı kalır)
  function scanCrit(label, valTxt, sc) {
    if (sc == null) return { label, cls: 'na', html: `<span class="crit na">${label} —</span>` };
    const cls = sc >= 65 ? 'pass' : sc >= 45 ? 'mid' : 'fail';
    const mk = cls === 'pass' ? '✓' : cls === 'fail' ? '✗' : '~';
    return { label, cls, html: `<span class="crit ${cls}">${label} ${valTxt} ${mk}</span>` };
  }

  // Ağırlıklı ortalama (yalnız mevcut alt-skorlar)
  function scanBlend(parts) {
    let w = 0, s = 0, n = 0;
    for (const p of parts) if (p.sc != null) { w += p.wt; s += p.wt * p.sc; n++; }
    return { score: w > 0 ? s / w : null, present: n };
  }

  // m = compareMem kaydı (Yahoo). fmtCell konvansiyonu: pct/roe/marj/temettü/büyüme = KESİR,
  // debtToEquity = yüzde (÷100 = gerçek oran), F/K·PD/DD·FD/FAVÖK·PEG = ham sayı.
  function scanScore(preset, m) {
    if (!m || m.ok === false) return { ok: false, reason: 'no-data' };
    if (preset === 'value') {
      const pe = m.trailingPE;
      if (pe == null || pe <= 0) return { ok: false, reason: 'neg-earnings' };
      const peSc = faInterp(pe, [[5, 95], [8, 88], [12, 78], [16, 68], [20, 58], [28, 42], [40, 25], [60, 10]]);
      const pbSc = faInterp(m.priceToBook, [[0.8, 95], [1.5, 85], [2.5, 72], [4, 55], [7, 35], [12, 15]]);
      const evSc = faInterp(m.evEbitda, [[4, 95], [7, 82], [10, 68], [14, 52], [20, 32], [30, 12]]);
      const divPct = m.dividendYield != null ? m.dividendYield * 100 : null;
      const divSc = divPct == null ? null : faInterp(divPct, [[0, 48], [2, 62], [4, 75], [6, 85], [9, 95]]);
      const blend = scanBlend([{ sc: peSc, wt: 0.40 }, { sc: pbSc, wt: 0.25 }, { sc: evSc, wt: 0.25 }, { sc: divSc, wt: 0.10 }]);
      const crits = [
        scanCrit('F/K', pe.toFixed(1), peSc),
        scanCrit('PD/DD', m.priceToBook != null ? m.priceToBook.toFixed(1) : '', pbSc),
        scanCrit('FD/FAVÖK', m.evEbitda != null ? m.evEbitda.toFixed(1) : '', evSc),
        scanCrit('Temettü', divPct != null ? '%' + divPct.toFixed(1) : '', divSc),
      ];
      return { ok: blend.score != null, score: blend.score, crits, present: blend.present };
    }
    if (preset === 'growth') {
      const rg = m.revenueGrowth != null ? m.revenueGrowth * 100 : null;
      const rgSc = rg == null ? null : faInterp(rg, [[-10, 8], [0, 25], [8, 50], [15, 65], [25, 80], [40, 92], [60, 98]]);
      const fwd = m.forwardPE, ttm = m.trailingPE;
      const ratio = (fwd != null && fwd > 0 && ttm != null && ttm > 0) ? fwd / ttm : null;
      const accSc = ratio == null ? null : faInterp(ratio, [[0.5, 95], [0.7, 85], [0.85, 70], [1.0, 50], [1.2, 30], [1.5, 12]]);
      const peg = m.peg;
      const pegSc = (peg == null || peg <= 0) ? null : faInterp(peg, [[0.5, 95], [1, 80], [1.5, 62], [2, 45], [3, 25], [5, 10]]);
      const blend = scanBlend([{ sc: rgSc, wt: 0.50 }, { sc: accSc, wt: 0.25 }, { sc: pegSc, wt: 0.25 }]);
      const crits = [
        scanCrit('Gelir büy.', rg != null ? '%' + rg.toFixed(0) : '', rgSc),
        scanCrit('İleri F/K', ratio != null ? '×' + ratio.toFixed(2) : '', accSc),
        scanCrit('PEG', (peg != null && peg > 0) ? peg.toFixed(2) : '', pegSc),
      ];
      return { ok: blend.score != null, score: blend.score, crits, present: blend.present };
    }
    // quality
    const roe = m.returnOnEquity != null ? m.returnOnEquity * 100 : null;
    const roeSc = roe == null ? null : faInterp(roe, [[0, 10], [8, 40], [15, 60], [22, 75], [30, 88], [45, 97]]);
    const pm = m.profitMargin != null ? m.profitMargin * 100 : null;
    const pmSc = pm == null ? null : faInterp(pm, [[0, 12], [5, 40], [10, 58], [18, 74], [28, 88], [40, 97]]);
    const d2e = m.debtToEquity != null ? m.debtToEquity / 100 : null;
    const d2eSc = d2e == null ? null : faInterp(d2e, [[0, 95], [0.3, 85], [0.6, 72], [1, 55], [1.8, 35], [3, 15]]);
    const blend = scanBlend([{ sc: roeSc, wt: 0.40 }, { sc: pmSc, wt: 0.35 }, { sc: d2eSc, wt: 0.25 }]);
    const crits = [
      scanCrit('ROE', roe != null ? '%' + roe.toFixed(0) : '', roeSc),
      scanCrit('Net marj', pm != null ? '%' + pm.toFixed(0) : '', pmSc),
      scanCrit('Borç/Öz', d2e != null ? d2e.toFixed(2) + 'x' : '', d2eSc),
    ];
    return { ok: blend.score != null, score: blend.score, crits, present: blend.present };
  }

  function scanTag(preset, score) {
    for (const t of SCAN_PRESETS[preset].tags) if (score >= t.min) return t;
    return SCAN_PRESETS[preset].tags[SCAN_PRESETS[preset].tags.length - 1];
  }

  function initScan() {
    if (!scanInited) {
      document.querySelectorAll('.chip[data-scan-preset]').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-scan-preset]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        scanPreset = b.dataset.scanPreset;
        renderScan();
      }));
      document.querySelectorAll('.chip[data-scan-mkt]').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-scan-mkt]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        scanMkt = b.dataset.scanMkt;
        renderScan();
      }));
      const rb = document.getElementById('scanRefresh');
      if (rb) rb.addEventListener('click', () => renderScan(true));
      scanInited = true;
    }
    renderScan();
  }

  async function renderScan(force) {
    const listEl = document.getElementById('scanList');
    const statusEl = document.getElementById('scanStatus');
    const descEl = document.getElementById('scanDesc');
    if (!listEl) return;
    const myScan = ++scanScanId;
    if (descEl) descEl.innerHTML = SCAN_PRESETS[scanPreset].desc;

    let universe = taAllSymbols();
    if (scanMkt !== 'ALL') universe = universe.filter((s) => s.market === scanMkt);
    if (!universe.length) {
      if (statusEl) statusEl.textContent = '';
      listEl.innerHTML = '<div class="empty">İzleme evreni boş. Portföye hisse ekle veya bir liste oluştur; burada temel tarama sıralaması çıkar.</div>';
      return;
    }

    if (force) universe.forEach((s) => compareMem.delete(s.market + ':' + s.symbol));
    if (statusEl) statusEl.textContent = `Taranıyor… ${universe.length} sembol`;
    listEl.innerHTML = '';

    // /api/yfin tek çağrıda ~12 sembol döndürür → 10'luk gruplar hâlinde çek
    // (ters piyasa düzeltmesi dahil). İlerledikçe kısmi sonuçları göster.
    for (let i = 0; i < universe.length; i += 10) {
      await fetchCompareBatch(universe.slice(i, i + 10));
      if (myScan !== scanScanId) return;
      if (statusEl) statusEl.textContent = `Taranıyor… ${Math.min(i + 10, universe.length)}/${universe.length}`;
    }

    const rows = [], na = [];
    universe.forEach((s) => {
      const m = compareMem.get(s.market + ':' + s.symbol);
      const r = scanScore(scanPreset, m);
      if (r.ok) rows.push({ ...s, score: r.score, crits: r.crits });
      else na.push({ ...s, reason: r.reason });
    });

    if (!rows.length) {
      if (statusEl) statusEl.textContent = `0 sembol sıralandı · ${na.length} sembolde temel veri yok`;
      listEl.innerHTML = '<div class="empty">Bu evren için temel veri alınamadı ya da bu presete uygun (kâr eden / metrikli) sembol yok.</div>';
      return;
    }

    rows.sort((a, b) => b.score - a.score);
    const rowHtml = (r, i) => {
      const tag = scanTag(scanPreset, r.score);
      const w = Math.max(3, Math.min(100, Math.round(r.score)));
      return `
        <div class="scn-row ${tag.cls}" data-symbol="${r.symbol}" data-market="${r.market}">
          <span class="scn-rank">${i + 1}</span>
          <div class="scn-main">
            <div class="scn-top"><span class="scn-sym">${r.symbol} <span class="badge">${r.market}</span></span><span class="scn-tag ${tag.cls}">${tag.txt}</span></div>
            <div class="scn-bar"><i class="${tag.cls}" style="width:${w}%"></i></div>
            <div class="scn-crit">${r.crits.map((c) => c.html).join('')}</div>
          </div>
          <span class="scn-score ${tag.cls}">${Math.round(r.score)}<em>/100</em></span>
        </div>`;
    };
    const naReason = (rn) => rn === 'neg-earnings'
      ? 'Zarar ediyor (negatif F/K) — değer taramasına girmez'
      : 'Temel veri yok (ETF / veri gelmedi) — taramaya girmez';
    const naHtml = na.length ? na.map((s) => `
        <div class="scn-row scn-na" data-symbol="${s.symbol}" data-market="${s.market}">
          <span class="scn-rank">–</span>
          <div class="scn-main">
            <div class="scn-top"><span class="scn-sym">${s.symbol} <span class="badge">${s.market}</span></span></div>
            <div class="scn-crit"><span>${naReason(s.reason)}</span></div>
          </div>
        </div>`).join('') : '';

    listEl.innerHTML = rows.map(rowHtml).join('') + naHtml;
    listEl.querySelectorAll('.scn-row').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    if (statusEl) statusEl.textContent = `${rows.length} sembol sıralandı${na.length ? ` · ${na.length} sembol taramaya girmedi` : ''}`;
  }

  // ===== Bilanço Öncesi Paneli (yaklaşan bilançolar + boğa/baz/ayı senaryo) =====
  // Kaynak: /api/yfin?deep=1 → Yahoo calendarEvents (tarih) + earningsTrend (konsensüs).
  // Senaryolar analist yüksek/düşük tahmin aralığı × tepki katsayısından türetilir:
  // MEKANİK BİR ÇERÇEVE, tahmin/olasılık DEĞİL. Bileşke/uygunluk skoruna DAHİL DEĞİL.
  let earnInited = false, earnMkt = 'ALL', earnScanId = 0, earnOpen = null;
  const earnMem = new Map(); // "MKT:SYM" -> deep res | { ok:false }
  const EARN_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const EARN_CUR_SYM = { USD: '$', TRY: '₺', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩', TWD: 'NT$', HKD: 'HK$', INR: '₹', CHF: 'CHF ', CAD: 'C$', AUD: 'A$', BRL: 'R$' };
  const earnSym = (code) => code ? (EARN_CUR_SYM[code] || code + ' ') : null;
  // İşlem/kotasyon para birimi (EPS + fiyat bunda; ADR → USD)
  const earnCur = (res, market) => (res && res.currency === 'TRY') || market === 'BIST' ? '₺' : earnSym(res && res.currency) || '$';
  // Raporlama para birimi (GELİR bunda; ADR'lerde işlem birleşiminden farklı olabilir — ör. SK Hynix ADR $ ama gelir ₩)
  const earnRevCur = (res, market) => earnSym(res && res.finCurrency) || earnCur(res, market);
  const earnEps = (v, s) => v == null ? '—' : (v < 0 ? '−' : '') + s + Math.abs(v).toFixed(2);
  const earnBig = (v, s) => {
    if (v == null) return '—';
    const a = Math.abs(v), sg = v < 0 ? '−' : '';
    if (a >= 1e12) return sg + s + (a / 1e12 >= 100 ? (a / 1e12).toFixed(0) : (a / 1e12).toFixed(1)) + 'T';
    if (a >= 1e9) return sg + s + (a / 1e9 >= 100 ? (a / 1e9).toFixed(0) : (a / 1e9).toFixed(1)) + 'B';
    if (a >= 1e6) return sg + s + (a / 1e6).toFixed(0) + 'M';
    return sg + s + a.toFixed(0);
  };
  const earnPct0 = (f) => f == null ? null : (f >= 0 ? '+' : '−') + '%' + Math.abs(f * 100).toFixed(0);

  async function yfinQueryDeep(ysyms) {
    if (!ysyms.length) return {};
    try {
      const r = await fetch(YFIN_BASE + '?deep=1&symbols=' + encodeURIComponent(ysyms.join(',')), { cache: 'no-store' });
      const j = await r.json();
      const byY = {};
      (j.results || []).forEach((res) => { byY[res.symbol] = res; });
      return byY;
    } catch (_) { return {}; }
  }
  // Toplu deep çeker (10'luk gruplar çağıran tarafta). Veri yoksa ters piyasayı bir kez dener.
  async function fetchEarnBatch(items) {
    const need = items.filter((it) => !earnMem.has(it.market + ':' + it.symbol));
    if (!need.length) return;
    const first = await yfinQueryDeep(need.map((it) => yahooSym(it.symbol, it.market)));
    const retry = [];
    need.forEach((it) => {
      const res = first[yahooSym(it.symbol, it.market)];
      if (res && res.ok) earnMem.set(it.market + ':' + it.symbol, res);
      else retry.push(it);
    });
    if (retry.length) {
      const second = await yfinQueryDeep(retry.map((it) => yahooSym(it.symbol, otherMarket(it.market))));
      retry.forEach((it) => {
        const res = second[yahooSym(it.symbol, otherMarket(it.market))];
        earnMem.set(it.market + ':' + it.symbol, (res && res.ok) ? res : { ok: false });
      });
    }
  }

  // Boğa/Baz/Ayı: analist tahmin dağılımı (HBK yüksek/düşük; yoksa gelir) × tepki katsayısı.
  // Baz = konsensüs tutarsa (piyasa fiyatladı → %0). Mekanik çerçeve, tahmin değil.
  function earnScenario(res) {
    const e = res && res.earnings, price = res && res.price;
    if (!e || price == null) return null;
    let base = e.epsAvg, hi = e.epsHigh, lo = e.epsLow;
    // EPS yoksa VEYA analistler tek noktada hemfikirse (dağılım ~0) → gelir dağılımına düş
    if (base == null || base === 0 || hi == null || lo == null || hi === lo) { base = e.revAvg; hi = e.revHigh; lo = e.revLow; }
    if (base == null || base === 0 || hi == null || lo == null) return null;
    const K = 2.0, CAP = 0.40, d = Math.abs(base);
    const up = Math.max(0, Math.min(CAP, ((hi - base) / d) * K));
    const dn = Math.min(0, Math.max(-CAP, ((lo - base) / d) * K));
    // Hem EPS hem gelir dağılımı sıfırsa: üç özdeş %0 kutusu yerine dürüst not
    if (up === 0 && dn === 0) return { tight: true };
    return { bull: { px: price * (1 + up), ret: up }, base: { px: price, ret: 0 }, bear: { px: price * (1 + dn), ret: dn } };
  }

  function initEarn() {
    if (!earnInited) {
      document.querySelectorAll('.chip[data-earn-mkt]').forEach((b) => b.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-earn-mkt]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        earnMkt = b.dataset.earnMkt; earnOpen = null; renderEarn();
      }));
      const rb = document.getElementById('earnRefresh');
      if (rb) rb.addEventListener('click', () => renderEarn(true));
      earnInited = true;
    }
    renderEarn();
  }

  async function renderEarn(force) {
    const listEl = document.getElementById('earnList');
    const statusEl = document.getElementById('earnStatus');
    if (!listEl) return;
    const myScan = ++earnScanId;

    let universe = taAllSymbols();
    if (earnMkt !== 'ALL') universe = universe.filter((s) => s.market === earnMkt);
    if (!universe.length) {
      if (statusEl) statusEl.textContent = '';
      listEl.innerHTML = '<div class="empty">İzleme evreni boş. Portföye hisse ekle veya bir liste oluştur; yaklaşan bilançolar burada listelenir.</div>';
      return;
    }

    if (force) { universe.forEach((s) => earnMem.delete(s.market + ':' + s.symbol)); earnOpen = null; }
    if (statusEl) statusEl.textContent = `Takvim taranıyor… ${universe.length} sembol`;

    for (let i = 0; i < universe.length; i += 10) {
      await fetchEarnBatch(universe.slice(i, i + 10));
      if (myScan !== earnScanId) return;
      if (statusEl) statusEl.textContent = `Takvim taranıyor… ${Math.min(i + 10, universe.length)}/${universe.length}`;
    }

    const now = Date.now();
    const rows = [];
    universe.forEach((s) => {
      const res = earnMem.get(s.market + ':' + s.symbol);
      if (!res || res.ok === false || !res.earnings || res.earnings.ts == null) return;
      const days = Math.ceil((res.earnings.ts * 1000 - now) / 86400000);
      if (days < 0) return; // geçmiş bilanço
      rows.push({ ...s, res, e: res.earnings, days });
    });

    if (!rows.length) {
      if (statusEl) statusEl.textContent = '0 yaklaşan bilanço bulundu';
      listEl.innerHTML = '<div class="empty">İzleme evreninde yaklaşan (gelecek tarihli) bilanço bulunamadı. BIST için takvim verisi çoğu zaman geç yayımlanır.</div>';
      return;
    }

    rows.sort((a, b) => a.days - b.days);
    const nearest = rows[0].days;
    listEl.innerHTML = rows.map(earnRowHtml).join('');
    listEl.querySelectorAll('.ep-row[data-key]').forEach((el) => el.addEventListener('click', () => {
      const k = el.dataset.key;
      earnOpen = (earnOpen === k) ? null : k;
      renderEarn();
    }));
    if (statusEl) statusEl.textContent = `${rows.length} yaklaşan bilanço · en yakın ${nearest} gün`;
  }

  function earnRowHtml(r) {
    const key = r.market + ':' + r.symbol;
    const cls = r.days <= 3 ? 'imminent' : r.days <= 7 ? 'soon' : '';
    const d = new Date(r.e.ts * 1000);
    const dateStr = d.getDate() + ' ' + EARN_MONTHS[d.getMonth()] + (r.e.estimate ? ' (tahmini)' : '');
    const cur = earnCur(r.res, r.market), revCur = earnRevCur(r.res, r.market);
    let exp;
    if (r.e.epsAvg != null) {
      const g = earnPct0(r.e.epsGrowth);
      const gCls = (r.e.epsGrowth != null && r.e.epsGrowth < 0) ? 'dn' : 'up';
      const arrow = (r.e.epsGrowth != null && r.e.epsGrowth < 0) ? '▼' : '▲';
      exp = `Beklenti: HBK <b>${earnEps(r.e.epsAvg, cur)}</b>` +
        (r.e.revAvg != null ? ` · gelir <b>${earnBig(r.e.revAvg, revCur)}</b>` : '') +
        (g != null ? ` · <span class="${gCls}">yıllık ${g} ${arrow}</span>` : '') +
        (r.e.numAnalysts != null ? ` · ${r.e.numAnalysts} analist` : '');
    } else {
      exp = '<span style="font-style:italic">Analist konsensüsü yok — yalnız takvim tarihi.</span>';
    }
    const open = earnOpen === key;
    const row = `
      <div class="ep-row ${cls}" data-key="${key}" data-symbol="${r.symbol}" data-market="${r.market}">
        <div class="ep-when"><div class="ep-days ${cls}">${r.days}</div><em>gün</em></div>
        <div class="ep-main">
          <div class="ep-top"><span class="ep-sym">${r.symbol} <span class="badge">${r.market}</span></span><span class="ep-date">${dateStr}</span></div>
          <div class="ep-exp">${exp}</div>
        </div>
        <span class="ep-arrow">${open ? '▾' : '▸'}</span>
      </div>`;
    return row + (open ? earnCardHtml(r, cur, dateStr) : '');
  }

  function earnCardHtml(r, cur, dateStr) {
    const e = r.e, res = r.res;
    const revCur = earnRevCur(res, r.market);
    const sc = earnScenario(res);
    const gTxt = earnPct0(e.epsGrowth);
    const gColor = (e.epsGrowth != null && e.epsGrowth < 0) ? 'var(--red)' : 'var(--green)';
    const cons = `
      <div class="epc-cons">
        <div class="cons-box"><div class="cv">${earnEps(e.epsAvg, cur)}</div><div class="cl">Beklenen HBK</div></div>
        <div class="cons-box"><div class="cv">${earnBig(e.revAvg, revCur)}</div><div class="cl">Beklenen gelir</div></div>
        <div class="cons-box"><div class="cv" style="color:${gColor}">${gTxt || '—'}</div><div class="cl">Yıllık kâr büyümesi bekl.</div></div>
        <div class="cons-box"><div class="cv">${res.price != null ? cur + res.price.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—'}</div><div class="cl">Güncel fiyat</div></div>
      </div>`;

    let scenHtml;
    if (sc && sc.tight) {
      scenHtml = '<div class="scen-note" style="margin-bottom:12px">Analistler tahminlerinde neredeyse tek noktada hemfikir (dar dağılım) — anlamlı bir boğa/ayı makası oluşmuyor. Asıl hareket, sonucun bu dar konsensüsü aşıp aşmamasından gelir.</div>';
    } else if (sc) {
      const px = (v) => cur + v.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
      const ret = (f) => (f > 0 ? '+' : f < 0 ? '−' : '') + '%' + Math.abs(f * 100).toFixed(0);
      scenHtml = `
        <div class="scen">
          <div class="sc bull"><div class="sc-t">🐂 Boğa</div><div class="sc-px">${px(sc.bull.px)}</div><div class="sc-ret">${ret(sc.bull.ret)}</div>
            <div class="sc-driver"><b>Beklentiyi aşarsa:</b> analist yüksek tahmini + çarpan genişlemesi.</div></div>
          <div class="sc base"><div class="sc-t">⚖️ Baz</div><div class="sc-px">${px(sc.base.px)}</div><div class="sc-ret">${ret(sc.base.ret)}</div>
            <div class="sc-driver"><b>Beklentiyi tutturursa:</b> konsensüs gerçekleşir, çarpan sabit — piyasanın fiyatladığı senaryo.</div></div>
          <div class="sc bear"><div class="sc-t">🐻 Ayı</div><div class="sc-px">${px(sc.bear.px)}</div><div class="sc-ret">${ret(sc.bear.ret)}</div>
            <div class="sc-driver"><b>Kaçırırsa / zayıf görünüm:</b> analist düşük tahmini + çarpan daralması.</div></div>
        </div>
        <div class="scen-note">Senaryolar analist tahmin aralığı × tepki duyarlılığından türetilir · olasılık ağırlığı içermez</div>`;
    } else {
      scenHtml = '<div class="scen-note" style="margin-bottom:12px">Analist tahmin aralığı yetersiz — senaryo üretilemez.</div>';
    }

    // İzlenecek metrikler (canlı temel değerler + guidance hatırlatması)
    const rg = res.revenueGrowth != null ? res.revenueGrowth * 100 : null;
    const rgExp = e.revGrowth != null ? ` · bekl. ${earnPct0(e.revGrowth)}` : '';
    const pm = res.profitMargin != null ? res.profitMargin * 100 : null;
    const industry = res.industry ? (INDUSTRY_TR[res.industry] || res.industry) : (res.sector || '—');
    const wm = (ic, name, desc, valHtml, vs) => `
      <div class="wm"><div class="wm-ic">${ic}</div>
        <div class="wm-body"><div class="wm-name">${name}</div><div class="wm-desc">${desc}</div></div>
        <div class="wm-val"><div class="wm-cur">${valHtml}</div>${vs ? `<div class="wm-vs">${vs}</div>` : ''}</div>
      </div>`;
    const rgCls = rg == null ? '' : rg >= 0 ? 'up' : 'dn';
    const watch = `
      <div class="watch-t">🔍 Bilançoda izlenecek metrikler <span style="color:var(--text-dim);font-weight:400;font-size:10px">— sektör: ${industry}</span></div>
      ${wm('📈', 'Gelir büyümesi (yıllık)', 'Talep ve momentumun ana göstergesi', `<span class="${rgCls}" style="${rgCls === 'up' ? 'color:var(--green)' : rgCls === 'dn' ? 'color:var(--red)' : ''}">${rg != null ? (rg >= 0 ? '+' : '−') + '%' + Math.abs(rg).toFixed(0) : '—'}</span>`, 'son 12 ay' + rgExp)}
      ${wm('💰', 'Net kâr marjı', 'Fiyatlama gücü ve maliyet dengesi', pm != null ? '%' + pm.toFixed(0) : '—', 'son 12 ay')}
      ${wm('🔮', 'Sonraki dönem görünümü (guidance)', 'Hisseyi çoğu zaman rakamdan çok görünüm oynatır', '—', 'bilançoda açıklanır')}`;

    return `
      <div class="ep-card">
        <div class="epc-head"><span class="epc-sym">${r.symbol}</span><span class="badge">${r.market}</span><span class="epc-date">📅 ${dateStr} · ${r.days} gün</span></div>
        <div class="epc-sub">Analist konsensüsü hisse başı kâr <b>${earnEps(e.epsAvg, cur)}</b>${e.revAvg != null ? `, gelir <b>${earnBig(e.revAvg, revCur)}</b>` : ''}${e.numAnalysts != null ? ` bekliyor (${e.numAnalysts} analist)` : ''}. Aşağıdaki senaryolar konsensüsün <b>yüksek/düşük tahmin aralığına</b> ve mevcut fiyata dayanır — <b>tahmin değil, olası sonuç çerçevesidir.</b></div>
        ${cons}
        ${scenHtml}
        ${watch}
        <div style="margin-top:10px;text-align:center"><button class="ghost-btn" data-earn-open="${r.market}:${r.symbol}" style="font-size:11px">Hisse sayfasını aç →</button></div>
      </div>`;
  }

  // Kart içi "Hisse sayfasını aç" (event delegation — kart her render'da yeniden kurulur)
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-earn-open]');
    if (!b) return;
    ev.stopPropagation();
    const [mkt, sym] = b.dataset.earnOpen.split(':');
    openStockPage(sym, mkt, sym);
  });

  // ===== Task D④: Tez Defteri (thesis journal) — SALT BİLGİ, skora dokunmaz =====
  // Kullanıcının kendi yatırım tezi: çekirdek fikir + dayanaklar (durum) + riskler +
  // hedef/çıkış + katalizör takvimi (bilanço tarihi otomatik) + güncelleme günlüğü.
  // Cihazda saklanır (localStorage), listelerle aynı kalıp. Motor/kompozit skora DAHİL DEĞİL.
  const TEZ_LS_KEY = 'sb:theses';
  let tezInited = false, tezFormOpen = null, tezScanId = 0, tezUpdOpen = null;
  const tezLive = new Map(); // "MKT:SYM" -> { ok, price, currency, name, ts } | { ok:false }

  function loadTheses() { try { const r = JSON.parse(localStorage.getItem(TEZ_LS_KEY)); return Array.isArray(r) ? r : []; } catch (_) { return []; } }
  function saveTheses(list) { try { localStorage.setItem(TEZ_LS_KEY, JSON.stringify(list)); } catch (_) {} }
  const tzEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tzNum = (v, cur) => v == null ? '—' : cur + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
  const tzToday = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const tzFmtDate = (iso) => { const p = String(iso || '').split('-'); return p.length === 3 ? (+p[2]) + ' ' + EARN_MONTHS[(+p[1]) - 1] : iso; };

  function initTez() {
    if (!tezInited) {
      const nb = document.getElementById('tezNewBtn');
      if (nb) nb.addEventListener('click', () => { tezFormOpen = (tezFormOpen === 'new') ? null : 'new'; renderTezForm(); });
      tezInited = true;
    }
    renderTez();
  }

  // Canlı fiyat + sonraki bilanço tarihi (katalizör) — Bilanço motoruyla aynı deep uç
  async function fetchTezLive(theses) {
    const need = theses.filter((t) => !tezLive.has(t.market + ':' + t.symbol));
    if (!need.length) return;
    let first;
    try { first = await yfinQueryDeep(need.map((t) => yahooSym(t.symbol, t.market))); }
    catch (_) { need.forEach((t) => tezLive.set(t.market + ':' + t.symbol, { ok: false })); return; }
    const retry = [];
    need.forEach((t) => {
      const res = first[yahooSym(t.symbol, t.market)];
      if (res && res.ok) tezLive.set(t.market + ':' + t.symbol, { ok: true, price: res.price, currency: res.currency, name: res.name, ts: res.earnings && res.earnings.ts, estimate: res.earnings && res.earnings.estimate });
      else retry.push(t);
    });
    if (retry.length) {
      let second;
      try { second = await yfinQueryDeep(retry.map((t) => yahooSym(t.symbol, otherMarket(t.market)))); }
      catch (_) { second = {}; }
      retry.forEach((t) => {
        const res = second[yahooSym(t.symbol, otherMarket(t.market))];
        tezLive.set(t.market + ':' + t.symbol, (res && res.ok) ? { ok: true, price: res.price, currency: res.currency, name: res.name, ts: res.earnings && res.earnings.ts, estimate: res.earnings && res.earnings.estimate } : { ok: false });
      });
    }
  }

  async function renderTez(force) {
    const listEl = document.getElementById('tezList');
    const statusEl = document.getElementById('tezStatus');
    if (!listEl) return;
    const theses = loadTheses();
    if (!theses.length) {
      if (statusEl) statusEl.textContent = '';
      listEl.innerHTML = '<div class="empty">Henüz tez yok. “＋ Yeni tez ekle” ile ilk yatırım tezini yaz — çekirdek fikir, dayanaklar, riskler ve hedef/çıkış. Uygulama canlı fiyatı ve bilanço tarihini senin için ekler.</div>';
      return;
    }
    if (force) theses.forEach((t) => tezLive.delete(t.market + ':' + t.symbol));
    const myScan = ++tezScanId;
    if (statusEl) statusEl.textContent = 'Canlı veri alınıyor…';
    for (let i = 0; i < theses.length; i += 10) { await fetchTezLive(theses.slice(i, i + 10)); if (myScan !== tezScanId) return; }
    listEl.innerHTML = theses.map(tezCardHtml).join('');
    if (statusEl) statusEl.textContent = theses.length + ' tez';
  }

  function tezCardHtml(t) {
    const live = tezLive.get(t.market + ':' + t.symbol) || {};
    const cur = earnCur({ currency: live.currency }, t.market);
    const name = t.name || live.name || '';
    const convTxt = { hi: 'Yüksek', mid: 'Orta', lo: 'Düşük' }[t.conviction] || 'Orta';
    const pos = t.position === 'short' ? 'short' : '';
    const pillars = t.pillars || [];
    const cOk = pillars.filter((p) => p.status === 'ok').length;
    const cWatch = pillars.filter((p) => p.status === 'watch').length;
    const cBad = pillars.filter((p) => p.status === 'bad').length;
    const stLbl = { ok: 'Yolunda', watch: 'İzle', bad: 'Sorunlu' };
    const pillHtml = pillars.map((p, i) =>
      `<div class="tz-prow"><span class="tz-ptxt">${tzEsc(p.text)}</span><span class="tz-st ${p.status || 'ok'}" data-tez-pill="${t.id}:${i}" title="Durumu değiştir">${stLbl[p.status] || 'Yolunda'}</span></div>`
    ).join('') || '<div class="tz-hint">Dayanak eklenmemiş.</div>';
    const riskHtml = (t.risks || []).map((r) => `<div class="tz-risk">${tzEsc(r)}</div>`).join('') || '<div class="tz-hint">Risk eklenmemiş.</div>';

    // Hedef & çıkış göstergesi (kullanıcının kendi seviyeleri)
    let gauge = '';
    const price = live.price;
    if (t.target != null || t.stop != null) {
      gauge = tezGauge(price, t.target, t.stop, cur);
    } else {
      gauge = '<div class="tz-hint">Hedef/çıkış girilmemiş — “Düzenle” ile ekleyebilirsin.</div>';
    }

    // Katalizör takvimi: otomatik bilanço tarihi + manuel katalizörler
    let cats = '';
    if (live.ts != null) {
      const d = new Date(live.ts * 1000), days = Math.ceil((live.ts * 1000 - Date.now()) / 86400000);
      if (days >= 0) cats += `<div class="tz-cat"><span class="tz-cd">${d.getDate()} ${EARN_MONTHS[d.getMonth()]}</span><span>Bilanço${live.estimate ? ' (tahmini tarih)' : ''} — ${days} gün<span class="tz-auto">otomatik: /api/yfin</span></span></div>`;
    }
    (t.catalysts || []).forEach((c) => { cats += `<div class="tz-cat"><span class="tz-cd">${tzEsc(c.date || '—')}</span><span>${tzEsc(c.text)}</span></div>`; });
    if (!cats) cats = '<div class="tz-hint">Yaklaşan bilanço/katalizör yok (BIST için tarih geç yayımlanabilir).</div>';

    // Güncelleme günlüğü
    const impLbl = { p: 'GÜÇLENDİ', z: 'NÖTR', n: 'ZAYIFLADI' };
    const logHtml = (t.log || []).map((l, i) =>
      `<div class="tz-log"><span class="tz-del-log" data-tez-dellog="${t.id}:${i}" title="Sil">✕</span><b class="d">${tzFmtDate(l.date)}</b> <span class="tz-imp ${l.imp || 'z'}">${impLbl[l.imp] || 'NÖTR'}</span><br>${tzEsc(l.note)}</div>`
    ).join('') || '<div class="tz-hint">Henüz güncelleme yok.</div>';

    const updForm = (tezUpdOpen === t.id) ? tezUpdFormHtml(t) : '';

    return `
      <div class="tz-card">
        <div class="tz-head">
          <div><div class="tz-k">${tzEsc(t.symbol)} <span class="badge">${t.market}</span></div><div class="tz-n">${tzEsc(name)}</div></div>
          <span class="tz-pos ${pos} tz-spacer">${t.position === 'short' ? 'KISA' : 'UZUN'}</span>
          <span class="tz-conv ${t.conviction || 'mid'}">Konviksiyon: ${convTxt}</span>
        </div>
        <div class="tz-thesis">${tzEsc(t.thesis) || '<span style="font-style:normal;color:var(--text-dim)">Tez cümlesi girilmemiş.</span>'}</div>
        <div class="tz-health"><span class="tz-st ok">${cOk} yolunda</span><span class="tz-st watch">${cWatch} izlemede</span><span class="tz-st bad">${cBad} sorunlu</span></div>
        <div class="tz-lbl">Dayanaklar &amp; durum <span style="text-transform:none;font-weight:400;color:var(--text-dim)">— rozete dokun: yolunda ▸ izle ▸ sorunlu</span></div>
        ${pillHtml}
        <div class="tz-lbl">Tezi bozacak riskler</div>
        ${riskHtml}
        <div class="tz-lbl">🎯 Hedef &amp; çıkış <span style="text-transform:none;font-weight:400;color:var(--text-dim)">— senin seviyelerin</span></div>
        ${gauge}
        <div class="tz-lbl">Katalizör takvimi</div>
        ${cats}
        <div class="tz-lbl">Güncelleme günlüğü</div>
        ${logHtml}
        ${updForm}
        <div class="tz-cardfoot">
          <button class="tz-btn pri" data-tez-upd="${t.id}">＋ Güncelleme</button>
          <button class="tz-btn" data-tez-edit="${t.id}">Düzenle</button>
          <button class="tz-btn" data-tez-open="${t.market}:${t.symbol}">Hisse →</button>
          <button class="tz-btn danger" data-tez-del="${t.id}">Sil</button>
        </div>
      </div>`;
  }

  function tezGauge(price, target, stop, cur) {
    const hasT = target != null, hasS = stop != null;
    let dot = '', now = '', caps = '';
    if (hasS) caps += `<span class="tz-cap l">🛑 çıkış<b>${tzNum(stop, cur)}</b></span>`;
    if (hasT) caps += `<span class="tz-cap r">🎯 hedef<b>${tzNum(target, cur)}</b></span>`;
    if (price != null && hasT && hasS && target !== stop) {
      let f = (price - stop) / (target - stop); f = Math.max(0, Math.min(1, f));
      dot = `<div class="tz-dot" style="left:${(f * 100).toFixed(1)}%"></div>`;
      now = `<div class="tz-now" style="left:${(f * 100).toFixed(1)}%">şu an <b>${tzNum(price, cur)}</b></div>`;
    } else if (price != null) {
      now = `<div class="tz-now" style="left:50%">şu an <b>${tzNum(price, cur)}</b></div>`;
    }
    let dist = '';
    if (price != null && hasT) { const p = (target - price) / price * 100; dist += `<span>Hedefe <b class="${p >= 0 ? 'up' : 'dn'}">${(p >= 0 ? '+' : '−')}%${Math.abs(p).toFixed(0)}</b></span>`; }
    if (price != null && hasS) { const p = (stop - price) / price * 100; dist += `<span>Çıkışa <b class="${p >= 0 ? 'up' : 'dn'}">${(p >= 0 ? '+' : '−')}%${Math.abs(p).toFixed(0)}</b></span>`; }
    return `<div class="tz-gauge"><div class="tz-track"><div class="tz-fill" style="width:100%"></div>${caps}${dot}${now}</div>${dist ? `<div class="tz-dist">${dist}</div>` : ''}</div>`;
  }

  function tezUpdFormHtml(t) {
    return `
      <div class="tz-upd" data-tez-updform="${t.id}">
        <div class="tz-frow">
          <div class="tz-fld"><label>Tarih</label><input type="date" class="tzu-date" value="${tzToday()}"></div>
          <div class="tz-fld"><label>Tez etkisi</label><select class="tzu-imp"><option value="p">Güçlendi</option><option value="z" selected>Nötr</option><option value="n">Zayıfladı</option></select></div>
          <div class="tz-fld"><label>Konviksiyon</label><select class="tzu-conv"><option value="hi"${t.conviction === 'hi' ? ' selected' : ''}>Yüksek</option><option value="mid"${(t.conviction || 'mid') === 'mid' ? ' selected' : ''}>Orta</option><option value="lo"${t.conviction === 'lo' ? ' selected' : ''}>Düşük</option></select></div>
        </div>
        <div class="tz-fld"><label>Ne değişti?</label><textarea class="tzu-note" placeholder="Yeni veri / gelişme ve tezine etkisi…"></textarea></div>
        <div class="tz-formfoot"><button class="tz-newbtn tzu-save" style="margin:0">Güncellemeyi kaydet</button><button class="tz-btn tzu-cancel">Vazgeç</button></div>
      </div>`;
  }

  function renderTezForm() {
    const wrap = document.getElementById('tezFormWrap');
    if (!wrap) return;
    if (!tezFormOpen) { wrap.innerHTML = ''; return; }
    const editing = tezFormOpen !== 'new' ? loadTheses().find((x) => x.id === tezFormOpen) : null;
    const groups = {};
    taAllSymbols().forEach((s) => { (groups[s.group] = groups[s.group] || []).push(s); });
    const curVal = editing ? editing.market + ':' + editing.symbol : '';
    const opts = Object.entries(groups).map(([g, items]) =>
      `<optgroup label="${tzEsc(g)}">` + items.map((s) => { const v = s.market + ':' + s.symbol; return `<option value="${v}"${v === curVal ? ' selected' : ''}>${s.symbol} · ${s.market}</option>`; }).join('') + '</optgroup>'
    ).join('');
    const sel = editing
      ? `<input class="tzf-sym" value="${editing.market + ':' + editing.symbol}" disabled style="opacity:.7"><div class="tz-hint">Tez hissesi değiştirilemez — yeni tez aç.</div>`
      : (opts ? `<select class="tzf-sym"><option value="">Hisse seç…</option>${opts}</select>` : '<div class="tz-hint">Önce portföye hisse ekle veya bir liste oluştur.</div><input class="tzf-sym" type="hidden">');
    const pillTxt = editing ? (editing.pillars || []).map((p) => p.text).join('\n') : '';
    const riskTxt = editing ? (editing.risks || []).join('\n') : '';
    const catTxt = editing ? (editing.catalysts || []).map((c) => (c.date || '') + ' | ' + c.text).join('\n') : '';
    const sv = (k) => editing && editing[k] != null ? editing[k] : '';
    wrap.innerHTML = `
      <div class="tz-form">
        <h3>${editing ? 'Tezi düzenle' : 'Yeni tez'}</h3>
        <div class="tz-fld"><label>Hisse</label>${sel}</div>
        <div class="tz-frow">
          <div class="tz-fld"><label>Pozisyon</label><select class="tzf-pos"><option value="long"${editing && editing.position === 'short' ? '' : ' selected'}>Uzun</option><option value="short"${editing && editing.position === 'short' ? ' selected' : ''}>Kısa</option></select></div>
          <div class="tz-fld"><label>Konviksiyon</label><select class="tzf-conv"><option value="hi"${sv('conviction') === 'hi' ? ' selected' : ''}>Yüksek</option><option value="mid"${(sv('conviction') || 'mid') === 'mid' ? ' selected' : ''}>Orta</option><option value="lo"${sv('conviction') === 'lo' ? ' selected' : ''}>Düşük</option></select></div>
        </div>
        <div class="tz-fld"><label>Tez cümlesi (1–2 cümle)</label><textarea class="tzf-thesis" placeholder="Neden bu hisse? Çekirdek fikir…">${tzEsc(sv('thesis'))}</textarea></div>
        <div class="tz-fld"><label>Dayanaklar (her satır bir madde)</label><textarea class="tzf-pillars" placeholder="Veri-merkezi geliri >%40&#10;Brüt marj korunuyor">${tzEsc(pillTxt)}</textarea></div>
        <div class="tz-fld"><label>Tezi bozacak riskler (her satır bir madde)</label><textarea class="tzf-risks" placeholder="Her satır bir risk…">${tzEsc(riskTxt)}</textarea></div>
        <div class="tz-frow">
          <div class="tz-fld"><label>🎯 Hedef fiyat</label><input class="tzf-target" inputmode="decimal" placeholder="ör. 210" value="${sv('target')}"></div>
          <div class="tz-fld"><label>🛑 Çıkış fiyatı</label><input class="tzf-stop" inputmode="decimal" placeholder="ör. 150" value="${sv('stop')}"></div>
        </div>
        <div class="tz-hint" style="margin-top:-4px">Yüzde uzaklıklar canlı fiyata göre otomatik hesaplanır. Bunlar senin kendi hedeflerin — uygulamanın önerisi değil.</div>
        <div class="tz-fld" style="margin-top:11px"><label>Manuel katalizörler (opsiyonel — her satır “Tarih | açıklama”)</label><textarea class="tzf-cats" placeholder="18 Mar | GTC konferansı">${tzEsc(catTxt)}</textarea></div>
        <div class="tz-formfoot"><button class="tz-newbtn tzf-save" style="margin:0">${editing ? 'Değişiklikleri kaydet' : 'Tezi kaydet'}</button><button class="tz-btn tzf-cancel">Vazgeç</button></div>
      </div>`;
  }

  function parseCats(txt) {
    return String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf('|');
      return i >= 0 ? { date: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { date: '', text: l };
    });
  }
  const parseLines = (txt) => String(txt || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const parseNum = (v) => { const n = parseFloat(String(v).replace(',', '.').replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : null; };

  function saveTezFromForm() {
    const wrap = document.getElementById('tezFormWrap');
    const root = wrap && wrap.querySelector('.tz-form');
    if (!root) return;
    const editing = tezFormOpen !== 'new' ? loadTheses().find((x) => x.id === tezFormOpen) : null;
    const symVal = editing ? (editing.market + ':' + editing.symbol) : (root.querySelector('.tzf-sym') && root.querySelector('.tzf-sym').value);
    if (!symVal) { alert('Lütfen bir hisse seç.'); return; }
    const [market, symbol] = symVal.split(':');
    const g = (c) => root.querySelector(c) ? root.querySelector(c).value : '';
    const pillarsTxt = parseLines(g('.tzf-pillars'));
    const list = loadTheses();
    const base = editing || { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), created: tzToday(), log: [] };
    // Dayanak durumunu koru (metin eşleşiyorsa), yenilere 'ok' ver
    const prevPill = new Map((editing && editing.pillars || []).map((p) => [p.text, p.status]));
    const rec = Object.assign(base, {
      symbol, market,
      name: (tezLive.get(market + ':' + symbol) || {}).name || base.name || '',
      position: g('.tzf-pos') === 'short' ? 'short' : 'long',
      conviction: g('.tzf-conv') || 'mid',
      thesis: g('.tzf-thesis').trim(),
      pillars: pillarsTxt.map((tx) => ({ text: tx, status: prevPill.get(tx) || 'ok' })),
      risks: parseLines(g('.tzf-risks')),
      target: parseNum(g('.tzf-target')),
      stop: parseNum(g('.tzf-stop')),
      catalysts: parseCats(g('.tzf-cats')),
      updated: tzToday(),
    });
    if (!editing) list.unshift(rec);
    saveTheses(list);
    tezFormOpen = null; renderTezForm(); renderTez();
  }

  // Tez kartı etkileşimleri (event delegation)
  document.addEventListener('click', (ev) => {
    const tgt = ev.target;
    const q = (a) => tgt.closest && tgt.closest(a);
    // form kaydet/iptal
    if (q('.tzf-save')) { ev.preventDefault(); saveTezFromForm(); return; }
    if (q('.tzf-cancel')) { ev.preventDefault(); tezFormOpen = null; renderTezForm(); return; }
    // güncelleme formu
    const upd = q('[data-tez-upd]'); if (upd) { const id = upd.dataset.tezUpd; tezUpdOpen = (tezUpdOpen === id) ? null : id; renderTez(); return; }
    if (q('.tzu-cancel')) { ev.preventDefault(); tezUpdOpen = null; renderTez(); return; }
    if (q('.tzu-save')) {
      ev.preventDefault();
      const box = q('[data-tez-updform]'); if (!box) return;
      const id = box.dataset.tezUpdform;
      const note = box.querySelector('.tzu-note').value.trim();
      if (!note) { alert('Kısa bir not ekle.'); return; }
      const list = loadTheses(); const t = list.find((x) => x.id === id); if (!t) return;
      t.log = t.log || []; t.log.unshift({ date: box.querySelector('.tzu-date').value || tzToday(), imp: box.querySelector('.tzu-imp').value, note });
      t.conviction = box.querySelector('.tzu-conv').value; t.updated = tzToday();
      saveTheses(list); tezUpdOpen = null; renderTez(); return;
    }
    // dayanak durum döngüsü
    const pill = q('[data-tez-pill]');
    if (pill) {
      const [id, idx] = pill.dataset.tezPill.split(':');
      const list = loadTheses(); const t = list.find((x) => x.id === id); if (!t) return;
      const p = t.pillars[+idx]; const order = ['ok', 'watch', 'bad'];
      p.status = order[(order.indexOf(p.status || 'ok') + 1) % 3]; t.updated = tzToday();
      saveTheses(list); renderTez(); return;
    }
    // günlük satırı sil
    const dl = q('[data-tez-dellog]');
    if (dl) {
      const [id, idx] = dl.dataset.tezDellog.split(':');
      const list = loadTheses(); const t = list.find((x) => x.id === id); if (!t) return;
      t.log.splice(+idx, 1); saveTheses(list); renderTez(); return;
    }
    const ed = q('[data-tez-edit]'); if (ed) { tezFormOpen = ed.dataset.tezEdit; tezUpdOpen = null; renderTezForm(); document.getElementById('tezFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const del = q('[data-tez-del]'); if (del) {
      const id = del.dataset.tezDel; const list = loadTheses(); const t = list.find((x) => x.id === id);
      if (t && confirm(t.symbol + ' tezini silmek istediğine emin misin?')) { saveTheses(list.filter((x) => x.id !== id)); renderTez(); }
      return;
    }
    const op = q('[data-tez-open]'); if (op) { const [mkt, sym] = op.dataset.tezOpen.split(':'); openStockPage(sym, mkt, sym); return; }
  });

  // ===== Task D ⑤: Sektör Manzarası =====
  // Kullanıcının KENDİ takip evrenini (portföy+listeler+arama) Yahoo sektörüne göre
  // gruplar; sektör bazında medyan değerleme (F/K, büyüme, marj, PEG) + değerleme
  // dağılımı + sektör içi liderlik gösterir. SALT BİLGİ — computeHolisticScore'a /
  // bileşke uygunluk skoruna DOKUNMAZ. TAM/pazar-payı iddiası YOK (yalnız senin evrenin).
  const SEK_META = {
    'Technology': { e: '💻', n: 'Teknoloji' },
    'Financial Services': { e: '🏦', n: 'Banka/Finans' },
    'Healthcare': { e: '🧬', n: 'Sağlık' },
    'Consumer Cyclical': { e: '🛍️', n: 'Tüketici (Döngüsel)' },
    'Consumer Defensive': { e: '🛒', n: 'Temel Tüketim' },
    'Energy': { e: '⛽', n: 'Enerji/Petrol' },
    'Industrials': { e: '🏭', n: 'Sanayi' },
    'Basic Materials': { e: '⛏️', n: 'Temel Malzeme' },
    'Utilities': { e: '🔌', n: 'Altyapı/Elektrik' },
    'Real Estate': { e: '🏢', n: 'Gayrimenkul' },
    'Communication Services': { e: '📡', n: 'İletişim' },
    '_other': { e: '📦', n: 'Fon/ETF & Diğer' },
  };
  let sektorInited = false, sektorSort = 'cheap', sektorScanId = 0;
  const sekMem = new Map();          // "MKT:SYM" -> yfinQuery res | {ok:false}
  const sekOpen = new Set();         // açık sektör anahtarları

  function sekMedian(arr) {
    const a = arr.filter((v) => v != null && isFinite(v)).sort((x, y) => x - y);
    if (!a.length) return null;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  const sekPe = (v) => v == null || !isFinite(v) ? '—' : (v >= 100 ? v.toFixed(0) : v.toFixed(1));
  const sekPct = (v) => v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + Math.round(v) + '%';
  const sekPeg = (v) => v == null || !isFinite(v) || v <= 0 ? '—' : v.toFixed(1);

  async function fetchSekBatch(items) {
    const need = items.filter((it) => !sekMem.has(it.market + ':' + it.symbol));
    for (let i = 0; i < need.length; i += 10) {
      const batch = need.slice(i, i + 10);
      let res;
      try { res = await yfinQuery(batch.map((it) => yahooSym(it.symbol, it.market))); }
      catch (_) { res = {}; }
      batch.forEach((it) => {
        const r = res[yahooSym(it.symbol, it.market)];
        sekMem.set(it.market + ':' + it.symbol, r && r.ok ? r : { ok: false });
      });
    }
  }

  // Sektör gruplarını sekMem'den kurar (yalnız verisi gelmiş hisseler)
  function sekBuildGroups(universe) {
    const groups = new Map();
    universe.forEach((u) => {
      const res = sekMem.get(u.market + ':' + u.symbol);
      if (!res || !res.ok) return;
      const key = SEK_META[res.sector] ? res.sector : '_other';
      if (!groups.has(key)) groups.set(key, { key, meta: SEK_META[key], stocks: [] });
      const pe = (res.trailingPE != null && isFinite(res.trailingPE) && res.trailingPE > 0) ? res.trailingPE
        : (res.forwardPE != null && isFinite(res.forwardPE) && res.forwardPE > 0 ? res.forwardPE : null);
      groups.get(key).stocks.push({
        symbol: u.symbol, market: u.market, name: res.name || u.symbol,
        pe, fpe: (res.forwardPE != null && isFinite(res.forwardPE) && res.forwardPE > 0) ? res.forwardPE : null,
        growth: res.revenueGrowth != null && isFinite(res.revenueGrowth) ? res.revenueGrowth * 100 : null,
        margin: res.profitMargin != null && isFinite(res.profitMargin) ? res.profitMargin * 100 : null,
        peg: res.peg,
      });
    });
    // sektör başına özet
    groups.forEach((g) => {
      g.n = g.stocks.length;
      g.medPe = sekMedian(g.stocks.map((s) => s.pe));
      g.medGrowth = sekMedian(g.stocks.map((s) => s.growth));
      g.medMargin = sekMedian(g.stocks.map((s) => s.margin));
      g.medPeg = sekMedian(g.stocks.map((s) => s.peg));
      const withPe = g.stocks.filter((s) => s.pe != null);
      g.cheapest = withPe.length ? withPe.reduce((a, b) => b.pe < a.pe ? b : a) : null;
      g.richest = withPe.length ? withPe.reduce((a, b) => b.pe > a.pe ? b : a) : null;
      const withMargin = g.stocks.filter((s) => s.margin != null);
      g.topMargin = withMargin.length ? withMargin.reduce((a, b) => b.margin > a.margin ? b : a) : null;
    });
    return [...groups.values()];
  }

  function sekSortGroups(groups, mode) {
    const arr = groups.slice();
    if (mode === 'growth') arr.sort((a, b) => (b.medGrowth ?? -1e9) - (a.medGrowth ?? -1e9));
    else if (mode === 'margin') arr.sort((a, b) => (b.medMargin ?? -1e9) - (a.medMargin ?? -1e9));
    else if (mode === 'count') arr.sort((a, b) => b.n - a.n);
    else arr.sort((a, b) => (a.medPe ?? 1e9) - (b.medPe ?? 1e9)); // cheap
    return arr;
  }

  function sekMiniHtml(g, lead) {
    return `<div class="mini${lead ? ' lead' : ''}">
      <div class="mh"><span class="mn">${g.meta.e} ${tzEsc(g.meta.n)}</span><span class="mc">${g.n} hisse</span></div>
      <div class="mrow">Medyan F/K <b>${sekPe(g.medPe)}</b></div>
      <div class="mrow">Büyüme <b>${sekPct(g.medGrowth)}</b></div>
      <div class="mrow">Marj <b>${g.medMargin == null ? '—' : Math.round(g.medMargin) + '%'}</b></div>
    </div>`;
  }

  function sekRowHtml(s, g) {
    let tag = '<span class="tag qual">dengeli</span>';
    if (g.cheapest && s === g.cheapest && g.n > 1) tag = '<span class="tag cheap">sektör içi en ucuz</span>';
    else if (g.richest && s === g.richest && g.n > 1) tag = '<span class="tag rich">sektör içi en pahalı</span>';
    else if (g.topMargin && s === g.topMargin) tag = '<span class="tag qual">en yüksek marj</span>';
    const best = (g.cheapest && s === g.cheapest && g.n > 1) ? ' best' : '';
    return `<div class="srow${best}">
      <span class="sk">${tzEsc(s.symbol)} <small>${tzEsc(s.name)}</small></span>
      <span class="sv">${sekPe(s.pe)}<small>${s.fpe != null ? 'ileri ' + sekPe(s.fpe) : '—'}</small></span>
      <span class="sv">${sekPct(s.growth)}<small>gelir</small></span>
      <span class="sv">${s.margin == null ? '—' : Math.round(s.margin) + '%'}<small>net</small></span>
      ${tag}
    </div>`;
  }

  function sekCardHtml(g, tags) {
    const open = sekOpen.has(g.key);
    const sub = [g.n + ' hisse'].concat(tags[g.key] || []).join(' · ');
    // değerleme dağılımı: sektör içi en ucuz ↔ en pahalı F/K, medyan işaretçisi
    let disp = '';
    if (g.cheapest && g.richest && g.cheapest !== g.richest && g.medPe != null) {
      const lo = g.cheapest.pe, hi = g.richest.pe;
      const f = hi > lo ? Math.max(0, Math.min(1, (g.medPe - lo) / (hi - lo))) : 0.5;
      disp = `<div class="disp">
        <div class="disp-lbl"><span>Değerleme dağılımı (F/K) — sektör içi ucuz ↔ pahalı</span></div>
        <div class="disp-track"><div class="disp-med" style="left:${(f * 100).toFixed(0)}%"></div></div>
        <div class="disp-ends"><span>en ucuz ${sekPe(lo)} (${tzEsc(g.cheapest.symbol)})</span><span>medyan ${sekPe(g.medPe)}</span><span>en pahalı ${sekPe(hi)} (${tzEsc(g.richest.symbol)})</span></div>
      </div>`;
    }
    const rows = g.stocks.slice().sort((a, b) => (a.pe ?? 1e9) - (b.pe ?? 1e9)).map((s) => sekRowHtml(s, g)).join('');
    const mg = g.medGrowth != null && g.medGrowth >= 0 ? ' g' : '';
    return `<div class="sec-card${open ? ' open' : ''}" data-sek-key="${g.key}">
      <div class="sec-head" data-sek-toggle="${g.key}">
        <span class="sec-emoji">${g.meta.e}</span>
        <div class="sec-title"><div class="n">${tzEsc(g.meta.n)}</div><div class="c">${tzEsc(sub)}</div></div>
        <div class="sec-vals">
          <span class="vpill">Medyan F/K <b>${sekPe(g.medPe)}</b></span>
          <span class="vpill${mg}">Büyüme <b>${sekPct(g.medGrowth)}</b></span>
          <span class="vpill">PEG <b>${sekPeg(g.medPeg)}</b></span>
        </div>
        <span class="caret">▶</span>
      </div>
      <div class="sec-body">
        ${disp}
        <div class="colhead"><span>Hisse</span><span>F/K</span><span>Büyüme</span><span>Marj</span><span></span></div>
        ${rows}
        ${g.n > 1 ? `<div class="mini-open" data-sek-cmp="${g.key}">↗ Bu ${Math.min(g.n, 8)} hisseyi Karşılaştır'da yan yana aç</div>` : ''}
      </div>
    </div>`;
  }

  async function renderSektor(force) {
    const list = document.getElementById('sektorList');
    const strip = document.getElementById('sektorStrip');
    const status = document.getElementById('sektorStatus');
    if (!list) return;
    const universe = taAllSymbols();
    if (!universe.length) {
      if (strip) strip.innerHTML = '';
      list.innerHTML = '<div class="empty">Takip evrenin boş. Portföyüne hisse ekle ya da bir liste oluştur; sektör manzarası buradan hesaplanır.</div>';
      if (status) status.textContent = '';
      return;
    }
    const scanId = ++sektorScanId;
    if (status) status.textContent = 'Sektör verileri çekiliyor…';
    await fetchSekBatch(universe);
    if (scanId !== sektorScanId) return; // daha yeni bir render başladı
    if (status) status.textContent = '';

    const groups = sekBuildGroups(universe);
    if (!groups.length) {
      if (strip) strip.innerHTML = '';
      list.innerHTML = '<div class="empty">Sektör verisi alınamadı (ETF/yabancı şirket ağırlıklı olabilir) — Yahoo bu semboller için sektör döndürmedi.</div>';
      return;
    }
    // sektör üstünlükleri → kart alt-başlıkları
    const byCheap = sekSortGroups(groups, 'cheap');
    const byGrowth = sekSortGroups(groups, 'growth');
    const byCount = sekSortGroups(groups, 'count');
    const tags = {};
    const addTag = (g, t) => { if (g) (tags[g.key] = tags[g.key] || []).push(t); };
    if (groups.length > 1) {
      if (byCheap[0].medPe != null) addTag(byCheap[0], 'evrenindeki en ucuz sektör');
      if (byGrowth[0].medGrowth != null) addTag(byGrowth[0], 'en hızlı büyüyen sektörün');
      if (byCount[0].n > 1) addTag(byCount[0], 'en çok yoğunlaştığın sektör');
    }

    const sorted = sekSortGroups(groups, sektorSort);
    if (strip) strip.innerHTML = sorted.map((g, i) => sekMiniHtml(g, i === 0 && groups.length > 1)).join('');
    // ilk açılışta en üstteki sektörü aç
    if (force && !sekOpen.size && sorted.length) sekOpen.add(sorted[0].key);
    list.innerHTML = sorted.map((g) => sekCardHtml(g, tags)).join('');

    const foot = document.getElementById('sektorFoot');
    if (foot) {
      const d = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
      foot.innerHTML = `📊 Veri: Yahoo Finance (canlı) · ${d} · Sektör görünümleri hızla eskir — değerlemeler her açılışta yeniden çekilir.<br>Değerleme ortancaları yalnızca senin evrenindeki hisselerden hesaplanır; sektör bazında az sayıda hisse varsa temsil sınırlıdır. Bu bir bilgi katmanıdır — bileşke/uygunluk skorunu değiştirmez, yatırım tavsiyesi değildir.`;
    }
  }

  function initSektor() {
    if (!sektorInited) {
      sektorInited = true;
      // sıralama çipleri
      const bar = document.getElementById('sektorSortbar');
      if (bar) bar.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-sek-sort]');
        if (!chip) return;
        sektorSort = chip.dataset.sekSort;
        bar.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === chip));
        renderSektor(false);
      });
      // kart aç/kapa + Karşılaştır'da aç
      const list = document.getElementById('sektorList');
      if (list) list.addEventListener('click', (e) => {
        const cmp = e.target.closest('[data-sek-cmp]');
        if (cmp) {
          const key = cmp.dataset.sekCmp;
          const g = sekBuildGroups(taAllSymbols()).find((x) => x.key === key);
          if (!g) return;
          const picks = g.stocks.slice().sort((a, b) => (a.pe ?? 1e9) - (b.pe ?? 1e9)).slice(0, 8);
          saveCompare(picks.map((s) => ({ symbol: s.symbol, market: s.market, query: s.symbol })));
          const cb = document.querySelector('.tab[data-tab="compare"]');
          if (cb) cb.click();
          return;
        }
        const tog = e.target.closest('[data-sek-toggle]');
        if (tog) {
          const key = tog.dataset.sekToggle;
          const card = tog.closest('.sec-card');
          if (sekOpen.has(key)) { sekOpen.delete(key); card.classList.remove('open'); }
          else { sekOpen.add(key); card.classList.add('open'); }
        }
      });
    }
    renderSektor(true);
  }

  // ===== Faz 3: Dünya Gündemi Radarı =====
  // Küresel gündemi temalara göre tarar → olayın etkilediği sektörleri belirler →
  // izleme evreninde o sektöre ait hisseleri teknik+haber skoruyla eşleştirir (olay→sektör→hisse zinciri).
  let radarInited = false, radarScanId = 0, radarBusy = false;

  // Sektör sözlüğü (kısa etiketler)
  const SECTORS = {
    energy: 'Enerji/Petrol', defense: 'Savunma', tech: 'Teknoloji', semis: 'Çip/Yarı İletken',
    clean: 'Temiz Enerji', gold: 'Altın/Değerli Maden', banks: 'Banka/Finans', staples: 'Temel Tüketim',
    auto: 'Otomotiv', reit: 'Gayrimenkul', utilities: 'Elektrik/Altyapı', space: 'Uzay/Uydu',
    biotech: 'Biyoteknoloji', industrials: 'Sanayi', intl: 'Global/Gelişen Piyasa',
  };
  // İzleme evrenindeki bilinen sembollerin sektör etiketleri (genişletilebilir)
  const SYMBOL_SECTORS = {
    // BIST
    TUPRS: ['energy'], DOAS: ['auto'], BIMAS: ['staples'], HLGYO: ['reit'],
    ENJSA: ['utilities', 'energy'], ASELS: ['defense', 'tech'], KCHOL: ['banks', 'industrials', 'energy'],
    THYAO: ['industrials'], EREGL: ['industrials'], SISE: ['industrials'], SASA: ['industrials'],
    GARAN: ['banks'], AKBNK: ['banks'], YKBNK: ['banks'], ISCTR: ['banks'], FROTO: ['auto'], TOASO: ['auto'],
    // ABD (çoğu ETF)
    SOXX: ['semis', 'tech'], UFO: ['space', 'defense'], VGT: ['tech'], QCLN: ['clean', 'energy'],
    VXUS: ['intl'], ARKG: ['biotech'], NVDA: ['semis', 'tech'], TSLA: ['auto', 'tech'],
    XLE: ['energy'], ITA: ['defense'], GLD: ['gold'], SMH: ['semis', 'tech'],
  };

  // Gündem temaları — her biri bir haber sorgusu + etkilediği sektörler (yön: up/down)
  const RADAR_THEMES = [
    { key: 'hormuz', emoji: '🛢️', label: 'Hürmüz / Petrol Arz Riski', lang: 'tr',
      q: '"Hürmüz Boğazı" OR "Strait of Hormuz" petrol',
      impacts: [['energy', 'up'], ['gold', 'up'], ['defense', 'up'], ['auto', 'down']] },
    { key: 'war', emoji: '⚔️', label: 'Aktif Savaşlar / Jeopolitik Gerilim', lang: 'tr',
      q: 'savaş OR çatışma OR "askeri operasyon" OR "geopolitical tension"',
      impacts: [['defense', 'up'], ['energy', 'up'], ['gold', 'up'], ['tech', 'down']] },
    { key: 'trump', emoji: '🇺🇸', label: 'Trump / Tarifeler / Ticaret', lang: 'tr',
      q: 'Trump tarife OR tariff OR "gümrük vergisi" OR yaptırım',
      impacts: [['industrials', 'up'], ['banks', 'up'], ['semis', 'down'], ['intl', 'down']] },
    { key: 'musk', emoji: '🚀', label: 'Elon Musk / Tesla / SpaceX', lang: 'en',
      q: 'Elon Musk OR Tesla OR SpaceX',
      impacts: [['auto', 'up'], ['space', 'up'], ['tech', 'up'], ['clean', 'up']] },
    { key: 'fed', emoji: '🏦', label: 'Fed / Faiz Kararı', lang: 'tr',
      q: 'Fed faiz OR "interest rate" OR "rate cut" OR "faiz kararı"',
      impacts: [['tech', 'up'], ['gold', 'up'], ['banks', 'up'], ['reit', 'up']] },
    { key: 'gold', emoji: '🥇', label: 'Altın / Güvenli Liman', lang: 'tr',
      q: 'altın rekor OR "gold price" OR "ons altın"',
      impacts: [['gold', 'up']] },
    { key: 'ai', emoji: '🤖', label: 'Yapay Zeka / Çip Yarışı', lang: 'en',
      q: '"AI chip" OR semiconductor Nvidia OR "artificial intelligence" datacenter',
      impacts: [['semis', 'up'], ['tech', 'up']] },
    { key: 'oil', emoji: '⚡', label: 'OPEC / Petrol Fiyatı', lang: 'tr',
      q: 'OPEC petrol OR "oil price" OR Brent OR "ham petrol"',
      impacts: [['energy', 'up'], ['utilities', 'up'], ['auto', 'down']] },
  ];

  function radarUniverse() {
    return taAllSymbols()
      .map((s) => ({ ...s, sectors: SYMBOL_SECTORS[s.symbol] || [] }))
      .filter((s) => s.sectors.length);
  }

  function themeNewsUrl(theme) {
    const enc = encodeURIComponent(theme.q);
    return theme.lang === 'en'
      ? `https://news.google.com/rss/search?q=${enc}&hl=en-US&gl=US&ceid=US:en`
      : `https://news.google.com/rss/search?q=${enc}&hl=tr&gl=TR&ceid=TR:tr`;
  }

  // Tema ısısı: son ~3 günün başlık sayısı
  function themeHeat(items) {
    const now = Date.now(), win = 3 * 24 * 3600 * 1000;
    let recent = 0;
    items.forEach((it) => { const t = Date.parse(it.pubDate); if (!isNaN(t) && now - t < win) recent++; });
    if (!items.length) return { lvl: 'na', txt: '⚪ Veri yok', n: 0 };
    if (recent >= 5) return { lvl: 'hot', txt: '🔴 Sıcak', n: recent };
    if (recent >= 2) return { lvl: 'warm', txt: '🟠 Ilık', n: recent };
    return { lvl: 'cool', txt: '⚪ Sakin', n: recent };
  }

  const dirArrow = (d) => (d === 'up' ? '▲' : '▼');

  function initRadar() {
    if (!radarInited) {
      const rb = document.getElementById('radarRefresh');
      if (rb) rb.addEventListener('click', () => renderRadar(true));
      radarInited = true;
    }
    renderRadar();
  }

  async function renderRadar(force) {
    const listEl = document.getElementById('radarList');
    const statusEl = document.getElementById('radarStatus');
    if (!listEl) return;
    if (radarBusy) return;
    radarBusy = true;
    const myScan = ++radarScanId;

    const universe = radarUniverse();
    statusEl.textContent = 'Küresel gündem taranıyor…';

    // 1) Temaların haberlerini çek (4'erli havuz, 20 dk cache)
    const themeData = {};
    const tq = RADAR_THEMES.slice();
    async function tWorker() {
      while (tq.length) {
        const th = tq.shift();
        let items = [];
        const cKey = 'radar:' + th.key;
        const c = force ? null : cacheGet(cKey);
        if (c && c.data && Date.now() - c.t < 20 * 60 * 1000) {
          items = c.data;
        } else {
          try { items = await fetchRSS(themeNewsUrl(th), 10); } catch (_) { items = []; }
          if (items.length) cacheSet(cKey, items);
        }
        if (myScan !== radarScanId) return;
        // tema tonu (kendi başlıklarından)
        let raw = 0, hits = 0;
        items.forEach((it) => { const r = scoreHeadline(it.title + ' ' + (it.description || '')); raw += r.s; hits += r.hits; });
        const tScore = hits ? Math.max(-1, Math.min(1, raw / (Math.abs(raw) + 4))) : 0;
        themeData[th.key] = { items, heat: themeHeat(items), tone: sentiLabel(tScore, hits), toneScore: tScore };
      }
    }
    await Promise.all([tWorker(), tWorker(), tWorker(), tWorker()]);
    if (myScan !== radarScanId) { radarBusy = false; return; }

    // 2) Tüm temaların "up" sektörlerine denk gelen sembolleri topla ve bir kez skorla
    const upSectorsAll = new Set();
    RADAR_THEMES.forEach((th) => th.impacts.forEach(([sec, dir]) => { if (dir === 'up') upSectorsAll.add(sec); }));
    const matchedSyms = universe.filter((s) => s.sectors.some((x) => upSectorsAll.has(x)));
    statusEl.textContent = `Gündem hazır · ${matchedSyms.length} eşleşen hisse skorlanıyor…`;
    const scoreMap = {};
    const mq = matchedSyms.slice();
    async function sWorker() {
      while (mq.length) {
        const s = mq.shift();
        try {
          const ta = await getTaScoreFor(s.symbol, s.market, 'orta');
          if (myScan !== radarScanId) return;
          let combined = ta ? ta.score : null, senti = null;
          if (ta) {
            try { senti = await computeNewsSentiment(s.symbol, s.market, { force }); } catch (_) {}
            if (senti) combined = Math.max(2, Math.min(98, ta.score + senti.score * 7));
          }
          scoreMap[s.market + ':' + s.symbol] = ta ? { score: combined, ta: ta.score, cls: ta.cls, label: ta.label, senti } : null;
        } catch (_) {}
      }
    }
    await Promise.all([sWorker(), sWorker(), sWorker()]);
    if (myScan !== radarScanId) { radarBusy = false; return; }

    // 3) Temaları ısıya göre sırala ve render et
    const order = { hot: 0, warm: 1, cool: 2, na: 3 };
    const themes = RADAR_THEMES.slice().sort((a, b) =>
      order[themeData[a.key].heat.lvl] - order[themeData[b.key].heat.lvl]);
    const hotCount = RADAR_THEMES.filter((t) => themeData[t.key].heat.lvl === 'hot').length;

    const html = themes.map((th) => {
      const d = themeData[th.key];
      const head = d.items[0];
      const head2 = d.items[1];
      const headlines = head
        ? `<div class="radar-heads">
             <a class="radar-hl" href="${head.link}" target="_blank" rel="noopener">${head.title}</a>
             ${head2 ? `<a class="radar-hl dim" href="${head2.link}" target="_blank" rel="noopener">${head2.title}</a>` : ''}
           </div>`
        : `<div class="radar-heads"><span class="radar-hl dim">Bu tema için güncel başlık alınamadı.</span></div>`;

      const impactBadges = th.impacts.map(([sec, dir]) =>
        `<span class="radar-imp ${dir}">${SECTORS[sec] || sec} ${dirArrow(dir)}</span>`).join('');

      // Bu temanın up-sektörlerine ait, izleme evreninde bulunan hisseler
      const upSecs = th.impacts.filter(([, d2]) => d2 === 'up').map(([s]) => s);
      const picks = universe
        .filter((s) => s.sectors.some((x) => upSecs.includes(x)))
        .map((s) => {
          const sc = scoreMap[s.market + ':' + s.symbol];
          const sec = s.sectors.find((x) => upSecs.includes(x));
          return { symbol: s.symbol, market: s.market, sec, sc };
        })
        .filter((p) => p.sc)
        .sort((a, b) => b.sc.score - a.sc.score)
        .slice(0, 6);

      const stocksHtml = picks.length
        ? `<div class="radar-stocks">${picks.map((p) => `
            <button class="radar-stock ${p.sc.cls}" data-symbol="${p.symbol}" data-market="${p.market}"
              title="${SECTORS[p.sec] || p.sec} · teknik ${Math.round(p.sc.ta)}${p.sc.senti && p.sc.senti.hits ? ` · haber ${p.sc.senti.score >= 0 ? '+' : ''}${Math.round(p.sc.senti.score * 100)}` : ''}">
              <span class="rs-sym">${p.symbol}<em>${p.market}</em></span>
              <span class="rs-score ${p.sc.cls}">${Math.round(p.sc.score)}</span>
            </button>`).join('')}</div>`
        : `<div class="radar-nostock">İzleme evreninde bu temayla eşleşen hisse yok. İlgili sektörden hisse ekleyerek zinciri tamamlayabilirsin.</div>`;

      const bestSec = upSecs[0];
      const chain = picks.length
        ? `<div class="radar-chain">🔗 <b>${th.label}</b> öne çıkıyor → <b>${SECTORS[bestSec] || bestSec}</b> sektörü etkileniyor → evreninde en güçlü teknik/haber uyumu: <b>${picks[0].symbol}</b> (${Math.round(picks[0].sc.score)}/100).</div>`
        : '';

      return `
        <div class="radar-card ${d.heat.lvl}">
          <div class="radar-card-top">
            <span class="radar-emoji">${th.emoji}</span>
            <span class="radar-name">${th.label}</span>
            <span class="radar-heat ${d.heat.lvl}">${d.heat.txt}${d.heat.n ? ` · ${d.heat.n}` : ''}</span>
            <span class="radar-tone ${d.tone.cls}">${d.tone.label}</span>
          </div>
          ${headlines}
          <div class="radar-impacts">${impactBadges}</div>
          ${stocksHtml}
          ${chain}
        </div>`;
    }).join('');

    listEl.innerHTML = html;
    listEl.querySelectorAll('.radar-stock').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    statusEl.textContent = `${RADAR_THEMES.length} tema tarandı${hotCount ? ` · ${hotCount} sıcak gündem` : ''} · güncellendi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    radarBusy = false;
  }

  // ===== Paylaşılan yardımcılar (Faz 4 & 5) =====
  // Belirli temaların haberlerini çek (radar ile aynı 20 dk cache) → {key:{items,heat,tone,toneScore}}
  async function fetchThemesData(themes, force) {
    const out = {};
    const q = themes.slice();
    async function w() {
      while (q.length) {
        const th = q.shift();
        let items = [];
        const cKey = 'radar:' + th.key;
        const c = force ? null : cacheGet(cKey);
        if (c && c.data && Date.now() - c.t < 20 * 60 * 1000) items = c.data;
        else { try { items = await fetchRSS(themeNewsUrl(th), 10); } catch (_) { items = []; } if (items.length) cacheSet(cKey, items); }
        let raw = 0, hits = 0;
        items.forEach((it) => { const r = scoreHeadline(it.title + ' ' + (it.description || '')); raw += r.s; hits += r.hits; });
        const tScore = hits ? Math.max(-1, Math.min(1, raw / (Math.abs(raw) + 4))) : 0;
        out[th.key] = { items, heat: themeHeat(items), tone: sentiLabel(tScore, hits), toneScore: tScore };
      }
    }
    await Promise.all([w(), w(), w(), w()]);
    return out;
  }

  // Sembol listesini bir kez teknik+haber skoruyla skorla → {mkt:sym:{score,ta,cls,label,senti}}
  async function scoreSymbolList(list, force, opts = {}) {
    const out = {};
    const q = list.slice();
    let done = 0;
    async function w() {
      while (q.length) {
        const s = q.shift();
        try {
          const ta = await getTaScoreFor(s.symbol, s.market, 'orta');
          if (opts.cancelled && opts.cancelled()) return;
          let combined = ta ? ta.score : null, senti = null;
          if (ta && !opts.taOnly) {
            try { senti = await computeNewsSentiment(s.symbol, s.market, { force }); } catch (_) {}
            if (senti) combined = Math.max(2, Math.min(98, ta.score + senti.score * 7));
          }
          out[s.market + ':' + s.symbol] = ta ? { score: combined, ta: ta.score, cls: ta.cls, label: ta.label, senti } : null;
        } catch (_) {}
        done++; if (opts.onProgress) opts.onProgress(done, list.length);
      }
    }
    await Promise.all([w(), w(), w()]);
    return out;
  }

  // ===== Faz 4: Makro-Sektör Rotasyon Katmanı =====
  // Konjonktür fazını (erken/orta/geç/durgunluk) makro sinyallerden tahmin eder → öne çıkan sektör → hisse.
  let macroInited = false, macroBusy = false;

  const CYCLE_PHASES = {
    early: { label: 'Erken Döngü / Toparlanma', emoji: '🌱', cls: 'early', sectors: ['banks', 'auto', 'tech'],
      desc: 'Faizler geriliyor, risk iştahı toparlanıyor. Faize duyarlı ve büyüme hisseleri öne çıkar.' },
    mid: { label: 'Orta Döngü / Genişleme', emoji: '🚀', cls: 'mid', sectors: ['tech', 'industrials', 'semis'],
      desc: 'Büyüme güçlü, koşullar dengeli. Teknoloji, sanayi ve çip liderlik eder.' },
    late: { label: 'Geç Döngü / Aşırı Isınma', emoji: '🔥', cls: 'late', sectors: ['energy', 'industrials', 'gold'],
      desc: 'Enflasyon/emtia baskısı ve para sıkılaşması. Enerji, emtia ve reel varlıklar korunaklı olur.' },
    recession: { label: 'Durgunluk / Risk-off', emoji: '🛡️', cls: 'recession', sectors: ['utilities', 'staples', 'gold'],
      desc: 'Büyüme zayıf, güvenli liman talebi yüksek. Savunmacı sektörler ve altın öne çıkar.' },
  };

  // Fed başlıklarından faiz yönü sinyali: -1 gevşeme (indirim) .. +1 sıkılaşma (artırım)
  function rateDirection(items) {
    const cut = /(rate cut|faiz indir|indirim|lower(?:ed|ing)? rate|gevşe|dovish|faizi düşür)/i;
    const hike = /(rate hike|faiz artır|artırım|raise(?:d|s)? rate|sıkılaş|hawkish|faizi yüksel)/i;
    let c = 0, h = 0;
    items.forEach((it) => { const t = it.title + ' ' + (it.description || ''); if (cut.test(t)) c++; if (hike.test(t)) h++; });
    const tot = c + h;
    return tot ? (h - c) / (tot + 1) : 0;
  }

  // Makro nabzını hesapla → {phase, dims, breadth, hotThemes}
  async function computeMacro(force) {
    const keys = ['fed', 'oil', 'gold', 'war', 'hormuz'];
    const themes = RADAR_THEMES.filter((t) => keys.includes(t.key));
    const td = await fetchThemesData(themes, force);
    const nOf = (k) => (td[k] ? td[k].heat.n : 0);

    // 1) Faiz yönü (Fed haberleri)
    const rate = td.fed ? rateDirection(td.fed.items) : 0;
    // 2) Enflasyon/Emtia baskısı (petrol + altın gündemi + tonu)
    const inflN = nOf('oil') + nOf('gold');
    let infl = Math.min(1, inflN / 10);
    if (td.oil && td.oil.toneScore > 0.15) infl = Math.min(1, infl + 0.15);
    // 3) Jeopolitik risk (savaş + Hürmüz)
    const risk = Math.min(1, (nOf('war') + nOf('hormuz')) / 10);
    // 4) Büyüme / piyasa genişliği (evrenin ortalama teknik skoru)
    const uni = taAllSymbols();
    const taMap = await scoreSymbolList(uni, force, { taOnly: true });
    const taVals = Object.values(taMap).filter((x) => x).map((x) => x.ta);
    const breadth = taVals.length ? taVals.reduce((a, b) => a + b, 0) / taVals.length : 50;
    const growth = Math.max(-1, Math.min(1, (breadth - 50) / 20));

    // Faz sınıflandırması (şeffaf karar ağacı)
    let phase;
    if (growth <= -0.35 || (risk >= 0.5 && growth < 0)) phase = 'recession';
    else if (infl >= 0.5 || rate >= 0.3 || risk >= 0.5) phase = 'late';
    else if (rate <= -0.15 && growth < 0.25) phase = 'early';
    else phase = 'mid';

    const hotThemes = RADAR_THEMES.filter((t) => td[t.key] && td[t.key].heat.lvl === 'hot').map((t) => t.key);
    return {
      phase, breadth, taMap,
      dims: { rate, infl, growth, risk },
      themeData: td, hotThemes,
    };
  }

  function initMacro() {
    if (!macroInited) {
      const rb = document.getElementById('macroRefresh');
      if (rb) rb.addEventListener('click', () => renderMacro(true));
      macroInited = true;
    }
    renderMacro();
  }

  // -1..+1 sinyali için ortası sıfır olan gösterge çubuğu
  function macroGauge(label, val, leftTxt, rightTxt) {
    const pct = (val + 1) / 2 * 100;
    return `<div class="mac-dim">
      <div class="mac-dim-top"><span>${label}</span><span class="mac-dim-val">${val >= 0 ? '+' : ''}${Math.round(val * 100)}</span></div>
      <div class="mac-bar"><i class="mac-mid"></i><b style="left:${pct}%"></b></div>
      <div class="mac-dim-lab"><span>${leftTxt}</span><span>${rightTxt}</span></div>
    </div>`;
  }
  // 0..1 sinyali için soldan dolan çubuk
  function macroGauge01(label, val, hint) {
    const pct = val * 100;
    const cls = val >= 0.5 ? 'high' : val >= 0.25 ? 'mid' : 'low';
    return `<div class="mac-dim">
      <div class="mac-dim-top"><span>${label}</span><span class="mac-dim-val ${cls}">${Math.round(pct)}%</span></div>
      <div class="mac-bar01"><i class="${cls}" style="width:${pct}%"></i></div>
      <div class="mac-dim-lab"><span>${hint}</span></div>
    </div>`;
  }

  async function renderMacro(force) {
    const wrap = document.getElementById('macroBody');
    const statusEl = document.getElementById('macroStatus');
    if (!wrap) return;
    if (macroBusy) return;
    macroBusy = true;
    statusEl.textContent = 'Makro nabız hesaplanıyor…';
    let m;
    try { m = await computeMacro(force); } catch (_) { macroBusy = false; statusEl.textContent = 'Makro veri alınamadı.'; return; }

    const ph = CYCLE_PHASES[m.phase];
    const d = m.dims;

    // ── Gündem rüzgârı: tüm temaları çek, sektör bazında net etki (+ rüzgâr / − karşı rüzgâr) ──
    let allTd = m.themeData;
    try { allTd = await fetchThemesData(RADAR_THEMES, force); } catch (_) {}
    const agenda = {};
    RADAR_THEMES.forEach((t) => {
      const td = allTd[t.key]; if (!td) return;
      const w = td.heat.lvl === 'hot' ? 1 : td.heat.lvl === 'warm' ? 0.5 : 0;
      if (!w) return;
      t.impacts.forEach(([sec, dir]) => { agenda[sec] = (agenda[sec] || 0) + (dir === 'up' ? w : -w); });
    });

    // ── Sektör etiketli evren → her sembol skorlu + grup (portföy/liste) korunur ──
    const uni = radarUniverse();
    const scored = uni.map((s) => {
      const sc = m.taMap[s.market + ':' + s.symbol];
      return sc ? { ...s, ta: sc.ta, cls: sc.cls } : null;
    }).filter(Boolean);

    // ── Sektör rotasyon panosu: faz favorisi + gündem rüzgârı + evrenin teknik gücü ──
    const secStats = {};
    scored.forEach((s) => s.sectors.forEach((sec) => {
      const st = secStats[sec] || (secStats[sec] = { sec, stocks: [], sum: 0 });
      st.stocks.push(s); st.sum += s.ta;
    }));
    const board = Object.values(secStats).map((st) => {
      const avg = st.sum / st.stocks.length;
      const fav = ph.sectors.includes(st.sec);
      const ag = agenda[st.sec] || 0;
      const rot = (fav ? 2 : 0) + ag * 1.5 + (avg - 50) / 15;
      st.stocks.sort((a, b) => b.ta - a.ta);
      return { sec: st.sec, avg, fav, ag, rot, stocks: st.stocks };
    }).sort((a, b) => b.rot - a.rot);

    const rotClass = (r) => r >= 2 ? 'tail' : r >= 0.6 ? 'mild' : r <= -1 ? 'head' : 'flat';
    const rotLabel = { tail: '🟢 Güçlü rüzgâr', mild: '🟡 Hafif rüzgâr', flat: '⚪ Nötr', head: '🔴 Karşı rüzgâr' };
    const boardHtml = board.map((b) => {
      const rc = rotClass(b.rot);
      const badges = [];
      if (b.fav) badges.push('<span class="mac-badge fav">🔄 Faz favorisi</span>');
      if (b.ag > 0) badges.push('<span class="mac-badge up">📰 Gündem ▲</span>');
      else if (b.ag < 0) badges.push('<span class="mac-badge down">📰 Gündem ▼</span>');
      const chips = b.stocks.slice(0, 6).map((p) =>
        `<button class="mac-schip ${p.cls}" data-symbol="${p.symbol}" data-market="${p.market}" title="${SECTORS[b.sec] || b.sec}">
           <span>${p.group === 'Portföy' ? '⭐' : ''}${p.symbol}<em>${p.market}</em></span><b>${Math.round(p.ta)}</b>
         </button>`).join('');
      return `<div class="mac-srow ${rc}">
        <div class="mac-srow-top">
          <span class="mac-srow-name">${SECTORS[b.sec] || b.sec}</span>
          <span class="mac-srow-rot ${rc}">${rotLabel[rc]}</span>
        </div>
        <div class="mac-srow-badges">${badges.join('')}<span class="mac-srow-avg">Ort. teknik ${Math.round(b.avg)}/100 · ${b.stocks.length} hisse</span></div>
        <div class="mac-srow-stocks">${chips}</div>
      </div>`;
    }).join('');

    // ── Dipte ama potansiyelli: tüm evrende (etiketsizler dahil) teknik zayıf, sektörel rüzgârı olabilenler ──
    const dip = taAllSymbols().map((s) => {
      const sc = m.taMap[s.market + ':' + s.symbol];
      if (!sc) return null;
      const secs = SYMBOL_SECTORS[s.symbol] || [];
      let fav = false, ag = 0;
      secs.forEach((sec) => { if (ph.sectors.includes(sec)) fav = true; ag += (agenda[sec] || 0); });
      return { ...s, ta: sc.ta, cls: sc.cls, secs, fav, ag, tail: (fav || ag > 0) };
    }).filter(Boolean)
      .filter((s) => s.ta < 45)                                  // teknik zayıf = düşüşte/dipte
      .sort((a, b) => (b.tail - a.tail) || (a.ta - b.ta))        // önce rüzgârı olanlar, sonra en dip
      .slice(0, 6);
    const dipHtml = dip.length ? dip.map((s) => {
      const tags = [];
      if (s.fav) tags.push('🔄 faz favorisi');
      if (s.ag > 0) tags.push('📰 gündem rüzgârı');
      if (s.secs.length) tags.push(SECTORS[s.secs[0]] || s.secs[0]);
      if (!tags.length) tags.push('sektör etiketi yok');
      const tail = s.tail
        ? '<span class="mac-dip-tail">🌬️ sektörel rüzgâr var</span>'
        : '<span class="mac-dip-notail">sektörel rüzgâr yok</span>';
      return `<button class="mac-dip-item ${s.cls}" data-symbol="${s.symbol}" data-market="${s.market}">
        <span class="mac-dip-sym">${s.group === 'Portföy' ? '⭐' : '📋'} ${s.symbol}<em>${s.market}</em></span>
        <span class="mac-dip-meta">${tags.join(' · ')}</span>
        <span class="mac-dip-foot">${tail}<b class="rs-score ${s.cls}">${Math.round(s.ta)}</b></span>
      </button>`;
    }).join('') : '<div class="radar-nostock">İzleme evreninde teknik olarak dipte görünen hisse yok.</div>';

    const sectorTags = ph.sectors.map((sec) => `<span class="mac-sec">${SECTORS[sec] || sec}</span>`).join('');
    const topSec = board[0];
    const topPick = topSec && topSec.stocks[0];

    // Sinyal notları
    const notes = [];
    notes.push(d.rate <= -0.15 ? 'Faizlerde gevşeme sinyali' : d.rate >= 0.3 ? 'Para politikasında sıkılaşma sinyali' : 'Faiz yönü nötr/belirsiz');
    notes.push(d.infl >= 0.5 ? 'Emtia/enflasyon baskısı yüksek' : d.infl >= 0.25 ? 'Emtia baskısı orta' : 'Emtia baskısı düşük');
    notes.push(d.growth >= 0.25 ? 'Piyasa genişliği güçlü' : d.growth <= -0.35 ? 'Piyasa genişliği zayıf' : 'Piyasa genişliği dengeli');
    notes.push(d.risk >= 0.5 ? 'Jeopolitik risk yüksek' : d.risk >= 0.25 ? 'Jeopolitik risk orta' : 'Jeopolitik risk düşük');

    wrap.innerHTML = `
      <div class="mac-phase ${ph.cls}">
        <div class="mac-phase-top"><span class="mac-phase-emoji">${ph.emoji}</span>
          <div><div class="mac-phase-name">${ph.label}</div>
          <div class="mac-phase-desc">${ph.desc}</div></div>
        </div>
        <div class="mac-cycle">${['early', 'mid', 'late', 'recession'].map((k) =>
          `<span class="mac-cyc ${k === m.phase ? 'on' : ''} ${CYCLE_PHASES[k].cls}">${CYCLE_PHASES[k].emoji} ${CYCLE_PHASES[k].label.split(' / ')[0]}</span>`).join('<span class="mac-cyc-arrow">›</span>')}</div>
      </div>
      <div class="mac-dims">
        ${macroGauge('Faiz Yönü', d.rate, 'Gevşeme', 'Sıkılaşma')}
        ${macroGauge01('Enflasyon / Emtia Baskısı', d.infl, `Petrol+altın gündem yoğunluğu`)}
        ${macroGauge('Büyüme / Piyasa Genişliği', d.growth, 'Zayıf', 'Güçlü')}
        ${macroGauge01('Jeopolitik Risk', d.risk, 'Savaş+Hürmüz gündem yoğunluğu')}
      </div>
      <div class="mac-notes">${notes.map((n) => `<span class="mac-note">${n}</span>`).join('')}</div>
      <div class="mac-lead">
        <div class="mac-lead-head">📊 Sektör rotasyon panosu <span class="mac-lead-sub">— faz favorisi + gündem rüzgârı + evrenin teknik gücü</span></div>
        <div class="mac-fav-line">Bu faz favorileri: ${sectorTags || '<span class="mac-note">—</span>'}</div>
        <div class="mac-board">${boardHtml || '<div class="radar-nostock">İzleme evreninde sektör etiketli hisse yok. Portföy/listeye hisse ekleyerek rotasyonu takip edebilirsin.</div>'}</div>
      </div>
      <div class="mac-dip">
        <div class="mac-lead-head">🩹 Dipte ama potansiyelli <span class="mac-lead-sub">— izleme listende teknik zayıf, sektörel rüzgârı olabilenler</span></div>
        <div class="mac-dip-list">${dipHtml}</div>
        <div class="mac-dip-note">⚠️ Teknik zayıflık = süregelen düşüş; “rüzgâr” yalnızca sektörel/gündem bağlamıdır, toparlanma garantisi değildir. Yatırım tavsiyesi değildir.</div>
      </div>
      <div class="mac-chain">🔗 Makro faz <b>${ph.label.split(' / ')[0]}</b>${topSec ? ` → en güçlü rotasyon <b>${SECTORS[topSec.sec] || topSec.sec}</b>` : ''}${topPick ? ` → evrende en güçlü teknik uyum <b>${topPick.symbol}</b> (${Math.round(topPick.ta)}/100)` : ''}. Tek bir isim değil, rüzgârı olan tüm sektörleri ve dipteki adayları birlikte değerlendir.</div>`;

    wrap.querySelectorAll('.mac-schip, .mac-dip-item').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    statusEl.textContent = `Konjonktür fazı: ${ph.label} · piyasa genişliği ${Math.round(m.breadth)}/100 · güncellendi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    macroBusy = false;
    macroLast = m;
  }
  let macroLast = null;

  // ===== Faz 6: "Günün Gündemi" — DİNAMİK günlük konjonktür motoru =====
  // RADAR_THEMES sabit temalar (Radar + Makro matematiği bunlara bağlı) kalır;
  // burası ONA DOKUNMADAN her gün CANLI Google News bölüm feed'lerini (TR+US:
  // manşet/ekonomi/dünya/teknoloji) tarar ve GÜNÜN GERÇEK gündemini çıkarır.
  // Genişletilebilir kavram sözlüğü + sözlük-dışı kümeleme = donuk başlık yok.
  // Skor motoruna (TA/FA/composite) DOKUNMAZ; yalnız sunum + haber katmanıdır.

  // Canlı gündem beslemeleri (donuk sorgu YOK — bunlar her gün kendiliğinden değişir)
  const AGENDA_FEEDS = [
    { id: 'tr-top', lang: 'tr', w: 1.0, url: 'https://news.google.com/rss?hl=tr&gl=TR&ceid=TR:tr' },
    { id: 'tr-biz', lang: 'tr', w: 1.15, url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr' },
    { id: 'us-biz', lang: 'en', w: 1.15, url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en' },
    { id: 'us-world', lang: 'en', w: 0.9, url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en' },
    { id: 'us-tech', lang: 'en', w: 1.0, url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en' },
  ];

  // Genişletilebilir kavram sözlüğü: her kavram = anahtar sözcükler → etkilenen sektörler + "ne anlama geliyor".
  // dir: sektör için 'up' (rüzgâr) / 'down' (baskı). Bir kavram YALNIZCA bugünkü manşetlerde geçerse "yanar".
  const AGENDA_LEXICON = [
    { key: 'rates', emoji: '🏦', label: 'Faiz / Merkez Bankaları', risk: 'off',
      kw: ['faiz kararı', 'faiz indirim', 'faiz artır', 'merkez bankası', 'tcmb', 'fed ', 'federal reserve', 'interest rate', 'rate cut', 'rate hike', 'ecb', 'powell', 'fomc', 'basis point', 'baz puan'],
      sectors: [['banks', 'up'], ['tech', 'up'], ['reit', 'up'], ['gold', 'up']],
      note: 'Faiz yönü tüm varlık fiyatlamasının çıpası; indirim beklentisi teknoloji/gayrimenkulü, sıkılaşma bankaları öne çıkarır.' },
    { key: 'inflation', emoji: '📈', label: 'Enflasyon / Fiyat Baskısı', risk: 'off',
      kw: ['enflasyon', 'tüfe', 'üfe', 'inflation', 'cpi', 'ppi', 'core inflation', 'hayat pahalılığı', 'price index'],
      sectors: [['gold', 'up'], ['staples', 'up'], ['tech', 'down']],
      note: 'Yüksek enflasyon faiz baskısını artırır; değerli maden ve fiyat gücü olan temel tüketim korunur, uzun vadeli teknoloji baskılanır.' },
    { key: 'oil', emoji: '🛢️', label: 'Petrol / Enerji Arzı', risk: 'off',
      kw: ['petrol', 'brent', 'ham petrol', 'opec', 'opec+', 'crude oil', 'oil price', 'wti', 'varil', 'doğal gaz', 'natural gas'],
      sectors: [['energy', 'up'], ['utilities', 'up'], ['auto', 'down']],
      note: 'Petrol fiyatı enerji şirketlerini besler; yüksek fiyat maliyet enflasyonu ve otomotiv/talep tarafında baskı yaratır.' },
    { key: 'gold', emoji: '🥇', label: 'Altın / Güvenli Liman', risk: 'off',
      kw: ['altın', 'ons altın', 'gram altın', 'gold price', 'gold record', 'bullion', 'safe haven', 'güvenli liman', 'gümüş', 'silver price'],
      sectors: [['gold', 'up']],
      note: 'Altına yöneliş belirsizlik ve reel faiz düşüşü işareti; risk iştahının azaldığı dönemlerin barometresi.' },
    { key: 'geopolitics', emoji: '⚔️', label: 'Jeopolitik / Çatışma', risk: 'off',
      kw: ['savaş', 'çatışma', 'saldırı', 'askeri operasyon', 'ateşkes', 'gerilim', 'war', 'conflict', 'military strike', 'ceasefire', 'invasion', 'missile', 'israel', 'iran', 'ukrayna', 'ukraine', 'russia', 'rusya', 'gazze', 'gaza'],
      sectors: [['defense', 'up'], ['energy', 'up'], ['gold', 'up'], ['tech', 'down']],
      note: 'Jeopolitik risk savunma ve enerjiyi öne çıkarır, güvenli limana kaçışı tetikler, risk iştahını kısar.' },
    { key: 'trade', emoji: '🚢', label: 'Ticaret / Tarifeler', risk: 'off',
      kw: ['tarife', 'gümrük vergisi', 'ticaret savaşı', 'yaptırım', 'ambargo', 'tariff', 'trade war', 'sanction', 'export ban', 'import tax', 'customs'],
      sectors: [['industrials', 'up'], ['semis', 'down'], ['intl', 'down'], ['auto', 'down']],
      note: 'Tarife ve yaptırımlar tedarik zincirini böler; yerli sanayiyi korur, ihracatçı/çip ve gelişen piyasaları baskılar.' },
    { key: 'ai-boom', emoji: '🤖', label: 'Yapay Zeka Yatırımı / Çip', risk: 'on',
      kw: ['yapay zeka', 'ai chip', 'artificial intelligence', 'nvidia', 'datacenter', 'data center', 'gpu', 'semiconductor', 'yarı iletken', 'openai', 'llm', 'ai model', 'chatgpt'],
      sectors: [['semis', 'up'], ['tech', 'up'], ['utilities', 'up']],
      note: 'YZ yatırım dalgası çip ve teknolojiyi, veri merkezi elektrik talebiyle altyapıyı besler.' },
    { key: 'ai-risk', emoji: '🛑', label: 'YZ Düzenleme / Güvenlik Riski', risk: 'off',
      kw: ['ai regulation', 'ai safety', 'yapay zeka düzenleme', 'yapay zeka riski', 'pause ai', 'halt ai', 'ai moratorium', 'ai ban', 'senate ai', 'ai oversight', 'existential risk', 'kontrolden çık', 'ai bubble', 'yz balon', 'ai safety bill', 'reckless ai', 'brakes on', 'rein in ai', 'ai danger', 'ai warning', 'out of control', 'superintelligence', 'rogue ai', 'ai risk', 'ban on ai', 'curb ai', 'yapay zeka tehlike', 'yapay zeka durdur'],
      sectors: [['semis', 'down'], ['tech', 'down']],
      note: 'YZ düzenleme/güvenlik ve "kontrolden çıktı" söylemi teknoloji değerlemelerine ve çip talebi beklentisine risk ekler.' },
    { key: 'rotation', emoji: '🔄', label: 'Değer Rotasyonu / Piyasa Tepesi', risk: 'off',
      kw: ['great rotation', 'rotate into value', 'rotation into value', 'value stocks', 'value rotation', 'growth to value', 'growth-to-value', 'sell tech', 'tech selloff', 'tech sell-off', 'growth selloff', 'growth sell-off', 'market top', 'market peak', 'market crash', 'stocks crash', 'bubble bursts', 'tech bubble', 'ai bubble', 'stock bubble', 'overvalued', 'stretched valuations', 'frothy market', 'değer hisseleri', 'değere rotasyon', 'değer rotasyonu', 'büyük rotasyon', 'değere geçiş', 'balon', 'köpük', 'aşırı değerleme', 'aşırı pahalı', 'piyasa tepesi', 'satış dalgası', 'kâr satışı', 'kar realizasyonu', 'defensive stocks', 'savunmacı hisseler', 'temettü hisseleri', 'ucuz hisseler'],
      sectors: [['banks', 'up'], ['staples', 'up'], ['energy', 'up'], ['industrials', 'up'], ['utilities', 'up'], ['gold', 'up'], ['tech', 'down'], ['semis', 'down']],
      note: 'Paranın pahalılaşan büyüme/teknolojiden ucuz "değer" hisselerine (banka, temel tüketim, enerji, sanayi, temettü) kayabileceği "büyük rotasyon" gündemi; balon/piyasa-tepesi tartışması yükseldiğinde savunmacı ve değer odaklı isimler öne çıkar. Bilgi amaçlıdır, yatırım tavsiyesi değildir.' },
    { key: 'crypto', emoji: '₿', label: 'Kripto / Bitcoin', risk: 'on',
      kw: ['bitcoin', 'kripto', 'ethereum', 'crypto', 'btc', 'blockchain', 'stablecoin', 'spot etf', 'altcoin', 'binance'],
      sectors: [['tech', 'up']],
      note: 'Kripto risk iştahının uç barometresi; güçlü rally risk-on, sert satış risk-off ortamına işaret eder.' },
    { key: 'earnings', emoji: '📊', label: 'Bilanço / Kâr Sezonu', risk: 'on',
      kw: ['bilanço', 'kâr açıkladı', 'çeyrek kâr', 'earnings', 'quarterly results', 'guidance', 'beats estimates', 'misses estimates', 'profit warning', 'revenue growth', 'net kâr'],
      sectors: [['tech', 'up'], ['banks', 'up'], ['staples', 'up']],
      note: 'Bilanço sezonu şirket bazlı ayrışmayı belirler; güçlü sonuçlar endeksi taşır, kâr uyarıları risk yaratır.' },
    { key: 'recession', emoji: '📉', label: 'Resesyon / Büyüme Endişesi', risk: 'off',
      kw: ['resesyon', 'durgunluk', 'küçülme', 'recession', 'gdp', 'gsyih', 'slowdown', 'hard landing', 'contraction', 'büyüme yavaş', 'economic downturn'],
      sectors: [['staples', 'up'], ['gold', 'up'], ['industrials', 'down'], ['banks', 'down']],
      note: 'Resesyon sinyali savunmacı sektörlere kaçışı, döngüsel sanayi ve bankalarda baskıyı beraberinde getirir.' },
    { key: 'jobs', emoji: '👷', label: 'İstihdam / İşgücü', risk: 'on',
      kw: ['istihdam', 'işsizlik', 'tarım dışı', 'jobs report', 'nonfarm', 'unemployment', 'payrolls', 'labor market', 'işten çıkar', 'layoff', 'jobless claims'],
      sectors: [['banks', 'up'], ['staples', 'up']],
      note: 'İstihdam verisi faiz patikasının ana girdisi; güçlü işgücü büyümeyi, zayıflık faiz indirimi beklentisini besler.' },
    { key: 'currency', emoji: '💱', label: 'Kur / Dolar / Lira', risk: 'off',
      kw: ['dolar kuru', 'dolar/tl', 'euro/tl', 'döviz kuru', 'döviz', 'dolar endeksi', 'dollar index', 'dxy', 'devaluation', 'exchange rate', 'currency market', 'usdtry', 'usd/try', 'merkez bankası kur'],
      sectors: [['banks', 'up'], ['intl', 'down'], ['staples', 'down']],
      note: 'Kur oynaklığı ithalatçı ve gelişen piyasa varlıklarını, TL zayıflığında ihracatçı marjını etkiler.' },
    { key: 'realestate', emoji: '🏠', label: 'Konut / Gayrimenkul', risk: 'off',
      kw: ['konut', 'mortgage', 'housing', 'home sales', 'ipotek', 'kira', 'real estate', 'gayrimenkul', 'inşaat', 'construction sector'],
      sectors: [['reit', 'up'], ['industrials', 'up']],
      note: 'Konut ve mortgage verisi faize en duyarlı reel sektör; toparlanma GYO ve inşaat malzemesini destekler.' },
    { key: 'energy-transition', emoji: '🔋', label: 'Temiz Enerji / EV', risk: 'on',
      kw: ['temiz enerji', 'yenilenebilir', 'elektrikli araç', 'clean energy', 'renewable', 'solar', 'wind power', 'ev sales', 'battery', 'lithium', 'karbon', 'green energy'],
      sectors: [['clean', 'up'], ['auto', 'up'], ['utilities', 'up']],
      note: 'Enerji dönüşümü teşvik ve talep haberleri temiz enerji, batarya ve elektrikli araç zincirini hareketlendirir.' },
    { key: 'china', emoji: '🇨🇳', label: 'Çin Ekonomisi', risk: 'off',
      kw: ['çin ekonomi', 'china economy', 'pboc', 'chinese stimulus', 'çin teşvik', 'yuan', 'china exports', 'çin ihracat', 'beijing', 'evergrande'],
      sectors: [['intl', 'up'], ['industrials', 'up'], ['energy', 'up']],
      note: 'Çin büyüme/teşvik haberleri emtia talebini ve gelişen piyasa iştahını yönlendiren küresel bir sürükleyici.' },
    { key: 'bigtech', emoji: '📱', label: 'Büyük Teknoloji / Regülasyon', risk: 'on',
      kw: ['apple', 'microsoft', 'google', 'alphabet', 'meta ', 'amazon', 'antitrust', 'tekel', 'big tech', 'app store', 'rekabet kurumu'],
      sectors: [['tech', 'up']],
      note: 'Mega-cap teknoloji hamleleri endeksi taşır; antitröst/regülasyon baskısı ise değerlemeye risk ekler.' },
    { key: 'defense', emoji: '🛡️', label: 'Savunma / NATO', risk: 'off',
      kw: ['savunma sanayi', 'defense spending', 'nato', 'silah', 'weapon', 'military budget', 'savunma bütçe', 'insansı silah', 'drone', 'İha', 'siha'],
      sectors: [['defense', 'up'], ['space', 'up']],
      note: 'Artan savunma harcaması ve NATO gündemi savunma ve uzay/uydu tedarik zincirine doğrudan rüzgâr.' },
  ];

  const AGENDA_STOP = new Set(('the a an and or of to in on for with at by from is are was be as it its this that new say says '
    + 've bir bu şu ile de da ki mi mu için gibi kadar daha çok en son yeni oldu olan olarak nin nın nun ndan dan den '
    + 'after over amid into out up down off his her their our your not no more most how why what when who will has have had '
    + 'trump biden yıl yılında dedi açıkladı sonra önce karşı üzerine hakkında milyon milyar bin '
    + 'million billion trillion powerball lottery jackpot news report reports update video watch photo photos '
    + 'haber haberi haberleri haberler gündem dakika günün açıklama açıklaması sözleri iddia iddiası flaş flas '
    + 'dikkat işte açıklama olay skandal ünlü ünlüler magazin kim kimdir nedir nasıl işlemi').split(/\s+/));

  // Kelime-sınırı eşleştirme: 'altın' anahtar sözcüğü 'gözaltına' içinde YANLIŞ eşleşmesin diye.
  const _kwRe = {};
  function agendaKwHit(text, k) {
    let re = _kwRe[k];
    if (!re) {
      const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = _kwRe[k] = new RegExp('(^|[^a-zçğıöşü0-9])' + esc + '([^a-zçğıöşü0-9]|$)');
    }
    return re.test(text);
  }

  let agendaBusy = false;

  function agendaCleanTitle(t) {
    // Google News başlıkları çoğu zaman "... - Kaynak" ile biter
    return (t || '').replace(/\s+-\s+[^-]{2,40}$/, '').trim();
  }

  async function computeAgenda(force) {
    const CK = 'agenda:pool';
    const cached = force ? null : cacheGet(CK);
    let feeds;
    if (cached && cached.data && (Date.now() - cached.t) < 20 * 60 * 1000) {
      feeds = cached.data;
    } else {
      const results = await Promise.all(AGENDA_FEEDS.map((f) =>
        fetchRSS(f.url, 24).then((items) => ({ f, items })).catch(() => ({ f, items: [] }))));
      feeds = results.filter((r) => r.items.length);
      if (feeds.length) cacheSet(CK, feeds);
      else if (cached && cached.data) feeds = cached.data; // ağ koptuysa bayat da olsa
    }

    const now = Date.now();
    // Manşet havuzu: dedup + zaman ağırlığı
    const seen = new Set();
    const pool = [];
    feeds.forEach(({ f, items }) => {
      items.forEach((it) => {
        const title = agendaCleanTitle(it.title);
        if (!title) return;
        const norm = title.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/g, '').slice(0, 80);
        if (seen.has(norm)) return;
        seen.add(norm);
        const t = Date.parse(it.pubDate);
        const ageH = isNaN(t) ? 48 : (now - t) / 3600000;
        const rec = ageH <= 12 ? 1 : ageH <= 24 ? 0.8 : ageH <= 48 ? 0.55 : ageH <= 96 ? 0.3 : 0.15;
        // Eşleştirme YALNIZ başlık üzerinden: Google News "description" alakasız "ilgili haber"
        // listesiyle dolu olduğundan kavram eşleşmesini kirletir. Başlıklar temiz ve spesifiktir.
        pool.push({ title, link: it.link, pubDate: it.pubDate, ageH, rec, w: (f.w || 1) * rec, lang: f.lang, text: title.toLowerCase() });
      });
    });

    // Kavram eşleştirme
    const conMap = {};
    pool.forEach((p) => {
      AGENDA_LEXICON.forEach((c) => {
        const hit = c.kw.some((k) => agendaKwHit(p.text, k));
        if (!hit) return;
        p.matched = true;
        const senti = scoreHeadline(p.text);
        const e = conMap[c.key] || (conMap[c.key] = { con: c, score: 0, tone: 0, toneHits: 0, heads: [] });
        e.score += p.w;
        e.tone += senti.s; e.toneHits += senti.hits;
        e.heads.push(p);
      });
    });

    let items = Object.values(conMap).map((e) => {
      e.heads.sort((a, b) => b.w - a.w);
      const n = e.heads.length;
      const heat = e.score >= 3.2 || n >= 5 ? 'hot' : e.score >= 1.6 || n >= 2 ? 'warm' : 'cool';
      const toneAvg = e.toneHits ? e.tone / Math.max(3, e.toneHits) : 0;
      return {
        key: e.con.key, emoji: e.con.emoji, label: e.con.label, note: e.con.note,
        risk: e.con.risk, sectors: e.con.sectors, score: e.score, n, heat,
        tone: toneAvg, toneLabel: sentiLabel(toneAvg, e.toneHits),
        heads: e.heads.slice(0, 4), emerging: false,
      };
    }).sort((a, b) => b.score - a.score);

    // Sözlük-dışı keşif: eşleşmeyen manşetlerde tekrar eden özel sözcükler → yeni gündem
    const freq = {};
    pool.filter((p) => !p.matched).forEach((p) => {
      const toks = new Set(p.title.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/g, ' ').split(/\s+/)
        .filter((w) => w.length >= 5 && !AGENDA_STOP.has(w) && !/^\d+$/.test(w)));
      toks.forEach((w) => { const g = freq[w] || (freq[w] = { w, n: 0, sw: 0, heads: [] }); g.n++; g.sw += p.w; g.heads.push(p); });
    });
    const emerging = Object.values(freq).filter((g) => g.n >= 4 && g.sw >= 2).sort((a, b) => b.sw - a.sw).slice(0, 3)
      .map((g) => {
        const senti = { s: 0, h: 0 };
        g.heads.forEach((p) => { const r = scoreHeadline(p.text); senti.s += r.s; senti.h += r.hits; });
        const toneAvg = senti.h ? senti.s / Math.max(3, senti.h) : 0;
        return {
          key: 'emg-' + g.w, emoji: '🆕', label: g.w.charAt(0).toUpperCase() + g.w.slice(1),
          note: 'Sözlükte tanımlı olmayan, bugün öne çıkan yeni bir başlık kümesi.', risk: null,
          sectors: [], score: g.sw, n: g.heads.length,
          heat: g.sw >= 2.4 || g.n >= 5 ? 'hot' : 'warm',
          tone: toneAvg, toneLabel: sentiLabel(toneAvg, senti.h),
          heads: g.heads.sort((a, b) => b.w - a.w).slice(0, 4), emerging: true,
        };
      });

    // En fazla 6 tanımlı + 2 yeni gündem başlığı
    const top = items.slice(0, 6).concat(emerging.slice(0, 2)).sort((a, b) => b.score - a.score);

    // Günlük konjonktür: risk-on/off tonu + net sektör rüzgârı
    let riskOn = 0, riskOff = 0;
    const secNet = {};
    top.forEach((it) => {
      const wgt = it.heat === 'hot' ? 1.4 : it.heat === 'warm' ? 1 : 0.5;
      if (it.risk === 'on') riskOn += wgt; else if (it.risk === 'off') riskOff += wgt;
      it.sectors.forEach(([sec, dir]) => { secNet[sec] = (secNet[sec] || 0) + (dir === 'up' ? wgt : -wgt); });
    });
    const upSectors = Object.entries(secNet).filter(([, v]) => v > 0.6).sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const downSectors = Object.entries(secNet).filter(([, v]) => v < -0.6).sort((a, b) => a[1] - b[1]).map(([s]) => s);
    let mood, moodCls;
    const diff = riskOn - riskOff;
    if (diff >= 1.2) { mood = 'Risk iştahı açık (risk-on)'; moodCls = 'bull'; }
    else if (diff <= -1.2) { mood = 'Temkinli / riskten kaçış (risk-off)'; moodCls = 'bear'; }
    else { mood = 'Karışık / yön arayışı'; moodCls = 'neutral'; }

    // 🔄 "Büyük rotasyon" öngörüsü — değer/savunma hisselerine geçiş gündemi canlıysa proaktif not.
    // Bilgi amaçlı: gündemi önden okuyup değer hisselerini işaret eder; yatırım tavsiyesi değildir.
    const rot = top.find((it) => it.key === 'rotation');
    let rotation = null;
    if (rot) {
      const valueSecs = [['banks', 'up'], ['staples', 'up'], ['energy', 'up'], ['industrials', 'up'], ['utilities', 'up'], ['gold', 'up']];
      rotation = {
        heat: rot.heat,
        stocks: agendaMatchedStocks(valueSecs),
        n: rot.n || rot.heads.length,
      };
    }

    return {
      items: top, empty: !top.length,
      summary: { mood, moodCls, upSectors, downSectors, riskOn, riskOff, poolN: pool.length, rotation },
      ts: Date.now(),
    };
  }

  // Bir gündem başlığına eşleşen izleme-evreni hisseleri (bilgi amaçlı ilişki)
  function agendaMatchedStocks(sectors) {
    if (!sectors || !sectors.length) return [];
    const up = new Set(sectors.filter(([, d]) => d === 'up').map(([s]) => s));
    if (!up.size) return [];
    return radarUniverse().filter((s) => s.sectors.some((x) => up.has(x))).slice(0, 5);
  }

  function renderTodayAgenda(ag) {
    if (!ag || ag.empty) {
      return `<div class="agenda-empty">Bugünün gündemi için canlı haber alınamadı. Bağlantıyı kontrol edip ↻ ile tekrar dene.</div>`;
    }
    const s = ag.summary;
    const secTxt = (arr) => arr.length ? arr.map((x) => SECTORS[x] || x).join(' · ') : '—';
    const summary = `
      <div class="agenda-summary ${s.moodCls}">
        <div class="agenda-mood"><span class="agenda-mood-dot"></span>Günlük konjonktür: <b>${s.mood}</b></div>
        <div class="agenda-sec">
          <span class="agenda-sec-up">🟢 Rüzgâr alan: ${secTxt(s.upSectors)}</span>
          <span class="agenda-sec-dn">🔴 Baskı altında: ${secTxt(s.downSectors)}</span>
        </div>
        <div class="agenda-meta">${s.poolN} canlı manşet tarandı · TR+ABD manşet/ekonomi/dünya/teknoloji · ${new Date(ag.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>`;

    // 🔄 Değer rotasyonu öngörüsü — gündemi önden okuyup değer/savunma hisselerini işaret eden proaktif not.
    let rotationBanner = '';
    if (s.rotation) {
      const r = s.rotation;
      const stk = (r.stocks || []).map((st) =>
        `<button class="agenda-stk" data-symbol="${st.symbol}" data-market="${st.market}">${st.symbol}</button>`).join('');
      rotationBanner = `
        <div class="agenda-rotation ${r.heat === 'hot' ? 'hot' : ''}">
          <div class="agenda-rot-h">🔄 Gündem öngörüsü: <b>Değer hisselerine rotasyon</b></div>
          <div class="agenda-rot-b">Pahalılaşan büyüme/teknoloji hisselerinden ucuz <b>değer</b> hisselerine (banka, temel tüketim, enerji, sanayi, altyapı/temettü) para kayması ("büyük rotasyon") ve piyasa-tepesi/balon tartışması bugünkü manşetlerde öne çıkıyor. Konjonktürü önden okumak isteyenler için savunmacı/değer odaklı isimler radara girer.</div>
          ${stk ? `<div class="agenda-stocks">Değer/savunma tarafında takip: ${stk}</div>` : ''}
          <div class="agenda-rot-dis">Bilgi amaçlıdır; yatırım tavsiyesi değildir.</div>
        </div>`;
    }

    const cards = ag.items.map((it) => {
      const heatTxt = it.heat === 'hot' ? '🔴 Sıcak' : it.heat === 'warm' ? '🟠 Gündemde' : '⚪ Hafif';
      const impacts = (it.sectors || []).map(([sec, dir]) =>
        `<span class="agenda-imp ${dir}">${dir === 'up' ? '▲' : '▼'} ${SECTORS[sec] || sec}</span>`).join('');
      const stocks = agendaMatchedStocks(it.sectors);
      const stocksHtml = stocks.length
        ? `<div class="agenda-stocks">İlgili takip: ${stocks.map((st) =>
            `<button class="agenda-stk" data-symbol="${st.symbol}" data-market="${st.market}">${st.symbol}</button>`).join('')}</div>`
        : '';
      const heads = it.heads.map((h) =>
        `<a class="agenda-head" href="${h.link}" target="_blank" rel="noopener"><span class="agenda-head-t">${h.title}</span><span class="agenda-head-time">${fmtTime(h.pubDate)}</span></a>`).join('');
      return `
        <div class="agenda-item ${it.heat} ${it.emerging ? 'emerging' : ''}">
          <div class="agenda-item-head">
            <span class="agenda-item-title">${it.emoji} ${it.label}</span>
            <span class="agenda-heat ${it.heat}">${heatTxt}${it.n ? ` · ${it.n}` : ''}</span>
          </div>
          <div class="agenda-note">${it.note}</div>
          ${impacts ? `<div class="agenda-imps">${impacts}</div>` : ''}
          <div class="agenda-heads">${heads}</div>
          ${stocksHtml}
        </div>`;
    }).join('');

    return summary + rotationBanner + `<div class="agenda-list">${cards}</div>`;
  }

  // ===== Faz 5: "Bugünün Önerileri" birleşik panel =====
  // Faz 1-4'ü birleştirir: ucuz bölge + momentum + düşük haber riski + doğru sektör + gündem rüzgârı = Güçlü Fırsat.
  let todayInited = false, todayBusy = false;

  function initToday() {
    if (!todayInited) {
      const rb = document.getElementById('todayRefresh');
      if (rb) rb.addEventListener('click', () => renderToday(true));
      todayInited = true;
    }
    renderToday();
  }

  async function renderToday(force) {
    const listEl = document.getElementById('todayList');
    const headEl = document.getElementById('todayHead');
    const statusEl = document.getElementById('todayStatus');
    const agendaEl = document.getElementById('todayAgenda');
    if (!listEl) return;
    if (todayBusy) return;
    todayBusy = true;
    statusEl.textContent = 'Günün gündemi taranıyor, makro faz ve hisseler birleştiriliyor…';

    // 1) Günün Gündemi (canlı taranmış) — en üstte, önerilerden bağımsız
    if (agendaEl) {
      if (!agendaEl.innerHTML) agendaEl.innerHTML = '<div class="agenda-empty">📰 Günün gündemi canlı taranıyor…</div>';
      try {
        const ag = await computeAgenda(force);
        agendaEl.innerHTML = renderTodayAgenda(ag);
        agendaEl.querySelectorAll('.agenda-stk').forEach((el) =>
          el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
      } catch (_) {
        agendaEl.innerHTML = '<div class="agenda-empty">Günün gündemi alınamadı.</div>';
      }
    }

    let m;
    try { m = await computeMacro(force); } catch (_) { todayBusy = false; statusEl.textContent = 'Veri alınamadı.'; return; }
    const ph = CYCLE_PHASES[m.phase];

    // Sıcak temaların "up" sektörleri = gündem rüzgârı olan sektörler
    const tailSectors = new Set();
    RADAR_THEMES.forEach((t) => {
      if (m.themeData[t.key] && m.themeData[t.key].heat.lvl === 'hot')
        t.impacts.forEach(([sec, dir]) => { if (dir === 'up') tailSectors.add(sec); });
    });
    const macroSectors = new Set(ph.sectors);

    // Tüm evreni teknik+haber skorla (sektör etiketli semboller)
    const uni = radarUniverse();
    const scMap = await scoreSymbolList(uni, force);

    const recs = uni.map((s) => {
      const sc = scMap[s.market + ':' + s.symbol];
      if (!sc) return null;
      const inMacro = s.sectors.some((x) => macroSectors.has(x));
      const inTail = s.sectors.some((x) => tailSectors.has(x));
      const senti = sc.senti;
      const newsNeg = senti && senti.hits && senti.score <= -0.2;
      let u = sc.score;
      if (inMacro) u += 6;
      if (inTail) u += 5;
      if (newsNeg) u -= 4;
      u = Math.max(2, Math.min(99, u));
      const reasons = [];
      if (sc.ta >= 56) reasons.push({ t: '📈 Teknik güçlü', cls: 'good' });
      else if (sc.ta <= 45) reasons.push({ t: '📉 Teknik zayıf', cls: 'bad' });
      if (inMacro) reasons.push({ t: `🎯 Doğru sektör (${ph.label.split(' / ')[0]})`, cls: 'good' });
      if (inTail) reasons.push({ t: '🌍 Gündem rüzgârı', cls: 'good' });
      if (senti && senti.hits) reasons.push({ t: `📰 ${senti.label}`, cls: newsNeg ? 'bad' : senti.score >= 0.12 ? 'good' : 'neu' });
      // Etiket
      let tag;
      if (u >= 64 && inMacro && !newsNeg && sc.ta >= 54) tag = { txt: '🔥 Güçlü Fırsat', cls: 'strong' };
      else if (u >= 58 && !newsNeg) tag = { txt: '🟢 Fırsat', cls: 'good' };
      else if (u >= 52) tag = { txt: '🟡 İzle', cls: 'watch' };
      else if (u >= 46) tag = { txt: '⚪ Nötr', cls: 'neutral' };
      else tag = { txt: '🔻 Zayıf', cls: 'weak' };
      return { ...s, sc, u, inMacro, inTail, newsNeg, reasons, tag, sec: s.sectors[0] };
    }).filter(Boolean).sort((a, b) => b.u - a.u);

    const hotNames = m.hotThemes.map((k) => RADAR_THEMES.find((t) => t.key === k)).filter(Boolean)
      .map((t) => `${t.emoji}${t.label.split(' / ')[0].split(' /')[0]}`);
    headEl.innerHTML = `
      <div class="today-macro ${ph.cls}">
        <span class="today-macro-emoji">${ph.emoji}</span>
        <div><div class="today-macro-name">Konjonktür: ${ph.label}</div>
        <div class="today-macro-sub">Öne çıkan sektörler: ${ph.sectors.map((x) => SECTORS[x]).join(' · ')}${hotNames.length ? ` &nbsp;|&nbsp; 🔴 Sıcak gündem: ${hotNames.join(', ')}` : ''}</div></div>
      </div>`;

    // D3: izlediğin/sepetindeki bir hisse bilanço açıkladıysa en üstte öne çıkar (bilgi amaçlı).
    try {
      const earn = await watchedEarningsRecent(3);
      if (earn.length) {
        const rows = earn.slice(0, 6).map((e) => `
          <a class="today-earn-row" href="${e.item.link}" target="_blank" rel="noopener">
            <span class="tag">${e.symbol}</span>
            <span class="tee-title">${e.item.title}</span>
            <span class="tee-time">${fmtTime(e.item.pubDate)}${e.item._fallback ? ' · <em>alt. kaynak</em>' : ''}</span>
          </a>`).join('');
        headEl.innerHTML += `
          <div class="today-earn">
            <div class="today-earn-h">📅 İzlediğin/sepetindeki hisseden bilanço geldi</div>
            ${rows}
          </div>`;
      }
    } catch (_) {}

    const strong = recs.filter((r) => r.tag.cls === 'strong').length;
    listEl.innerHTML = recs.slice(0, 12).map((r, i) => {
      const w = Math.max(2, Math.min(100, r.u));
      return `<div class="today-row ${r.tag.cls}" data-symbol="${r.symbol}" data-market="${r.market}">
        <span class="today-rank">${i + 1}</span>
        <div class="today-main">
          <div class="today-top">
            <span class="today-sym">${r.symbol} <span class="badge">${r.market}</span> <span class="today-sec">${SECTORS[r.sec] || ''}</span></span>
            <span class="today-tag ${r.tag.cls}">${r.tag.txt}</span>
          </div>
          <div class="today-bar"><i class="${r.sc.cls}" style="width:${w}%"></i></div>
          <div class="today-reasons">${r.reasons.map((rs) => `<span class="today-rsn ${rs.cls}">${rs.t}</span>`).join('')}</div>
        </div>
        <span class="today-score ${r.sc.cls}">${Math.round(r.u)}<em>/100</em></span>
      </div>`;
    }).join('');
    listEl.querySelectorAll('.today-row').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    statusEl.textContent = `${recs.length} hisse değerlendirildi${strong ? ` · ${strong} güçlü fırsat` : ''} · teknik+haber+sektör+gündem birleşik · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    todayBusy = false;
  }

  // ===== ⚡ Nabız: Anlık Ani-Hareket Yakalayıcı =====
  // Uygulama açıkken izleme + portföy sembollerini intraday (5dk) tarar, "ani hareket"i tespit eder,
  // NEDENİNİ açıklar (sıcak gündem teması + hisse haberi ile eşleştirerek) ve tarayıcı bildirimi gönderir.
  // Sunucu tarafı (worker/movers.mjs) aynı işi uygulama kapalıyken de yapar → gerçek "önceden haber".
  let pulseInited = false, pulseBusy = false, pulseTimer = null;
  let pulseThemes = null, pulseThemesAt = 0;
  const pulseAlerted = {};           // "MKT:SYM" -> son alarm seviyesi (dedup)
  let pulseAlertDay = new Date().toISOString().slice(0, 10);
  const PULSE_POLL_MS = 3 * 60 * 1000; // 3 dk

  const PULSE_TH = {
    US:    { day: 3.0, hour: 1.8, step: 3.0 },
    BIST:  { day: 4.0, hour: 2.5, step: 4.0 },
    CRYPTO:{ day: 6.0, hour: 3.5, step: 6.0 }, // kripto çok oynak → eşik yüksek
    METAL: { day: 2.5, hour: 1.5, step: 2.5 }, // maden görece sakin → eşik düşük
  };

  function pulseSymbols() {
    const seen = new Set(), out = [];
    const add = (sym, mkt, tag) => { const k = mkt + ':' + sym; if (sym && !seen.has(k)) { seen.add(k); out.push({ symbol: sym, market: mkt, tag }); } };
    // Güncel portföy (gizlenenler çıkarılmış + kullanıcı eklemeleri) — collectWatchlistPayload ile aynı kaynak.
    try { (getPortfolio() || []).forEach((p) => add(p.symbol, p.market, 'portföy')); } catch (e) {}
    // Kullanıcının tüm listelerindeki hisseler (Robot, deneme, elle eklenenler…).
    try { (loadLists() || []).forEach((l) => (l.items || []).forEach((it) => add(it.symbol, it.market, 'izleme'))); } catch (e) {}
    // 🪙 Kripto + 🥇 Madenler — Nabız'ı 3 piyasaya açan sabit evren (portföyde olmasa da taranır).
    // Yahoo pipeline ile uyum için market:'US'; eşik/yönlendirme için thkey + acls ayrı taşınır.
    try {
      if (typeof BM_CRYPTO !== 'undefined' && Array.isArray(BM_CRYPTO)) {
        BM_CRYPTO.forEach((c) => {
          const sym = c.sym + '-USD'; const k = 'US:' + sym;
          if (!seen.has(k)) { seen.add(k); out.push({ symbol: sym, market: 'US', tag: 'kripto', thkey: 'CRYPTO', acls: 'crypto', coin: c, disp: c.name }); }
        });
      }
    } catch (e) {}
    try {
      if (typeof METAL_SPOT !== 'undefined') {
        const mnames = { 'gram-altin': 'Altın (ons)', 'gumus': 'Gümüş (ons)', 'platin': 'Platin (ons)' };
        Object.keys(METAL_SPOT).forEach((mk) => {
          const info = METAL_SPOT[mk]; const sym = info.ysym; const k = 'US:' + sym;
          if (!seen.has(k)) { seen.add(k); out.push({ symbol: sym, market: 'US', tag: 'maden', thkey: 'METAL', acls: 'metal', metalKey: mk, metalName: mnames[mk] || mk, disp: mnames[mk] || mk }); }
        });
      }
    } catch (e) {}
    return out;
  }

  function analyzeIntraday(candles, meta) {
    if (!candles || candles.length < 3) return null;
    const hi = candles.length - 1;
    const last = candles[hi];
    const price = (meta && meta.regularMarketPrice) || last.close;
    const prevClose = (meta && meta.chartPreviousClose) || candles[0].open || candles[0].close;
    const dayChg = ((price - prevClose) / prevClose) * 100;
    const ago = Math.max(0, hi - 12); // ~60 dk (12 x 5dk)
    const hourChg = ((candles[hi].close - candles[ago].close) / candles[ago].close) * 100;
    const vols = candles.map((c) => c.volume || 0).filter((v) => v > 0);
    const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : 0;
    const lastVol = vols.length ? vols[vols.length - 1] : 0;
    const rvol = avgVol ? lastVol / avgVol : 0;
    const priorHigh = hi > 0 ? Math.max(...candles.slice(0, hi).map((c) => c.high)) : price;
    const breakout = price >= priorHigh && dayChg > 0;
    return { price, prevClose, dayChg, hourChg, rvol, breakout,
             spark: candles.map((c) => ({ t: c.time * 1000, c: c.close })) };
  }

  // "Ani hareket" mi? → gün içi VEYA son-saat eşiği aşıldıysa
  function pulseIsSudden(a, mkt) {
    const th = PULSE_TH[mkt] || PULSE_TH.US;
    return { sudden: Math.abs(a.hourChg) >= th.hour || Math.abs(a.dayChg) >= th.day,
             bigDay: Math.abs(a.dayChg) >= th.day, th };
  }

  // Neden yükseldi/düştü? → sembolün sektörünü etkileyen SICAK gündem temaları
  function pulseWhyThemes(sym, up) {
    const sectors = SYMBOL_SECTORS[sym] || [];
    const out = [];
    if (!pulseThemes) return out;
    RADAR_THEMES.forEach((t) => {
      const td = pulseThemes[t.key];
      if (!td || td.heat.lvl === 'cool' || td.heat.lvl === 'na') return;
      const hit = t.impacts.find(([sec, dir]) => sectors.includes(sec) && (dir === 'up') === up);
      if (hit) out.push({ emoji: t.emoji, label: t.label.split(' / ')[0], heat: td.heat.txt });
    });
    return out;
  }

  // ===== 🏦 Makro Nabız: canlı FAİZ + ENFLASYON okuması (Nabız'ın tepesi) =====
  // Fed başlıklarından yön (şahin/güvercin) + enflasyon başlıklarından ısınma/soğuma çıkarır,
  // bunu YÖN-DUYARLI sektör etkisine çevirir (şahin → faize duyarlı tech/çip/REIT baskı; güvercin → tersi)
  // ve senin movers'larınla eşleştirip bütüncül tek-cümle yorum üretir. Kâhinlik değil, haberden çıkarım.
  const RATE_SENSITIVE = ['tech', 'semis', 'reit', 'auto', 'clean', 'biotech', 'space'];

  // Enflasyon yönü: +1 ısınma (şahin baskı) .. -1 soğuma (güvercin rahatlama)
  function inflDirection(items) {
    const up = /(inflation[^.]{0,30}(jump|rise|rises|rose|accelerat|hotter|hot|surge|climb|spike|stick|higher|top)|cpi[^.]{0,20}(jump|rise|rose|hotter|accelerat|higher|top)|yields?[^.]{0,20}(jump|surge|rise|rose|climb|spike|higher)|hotter[- ]than|enflasyon[^.]{0,25}(artt|yüksel|hızlan|ısın|rekor)|faiz[^.]{0,15}yüksel)/i;
    const down = /(inflation[^.]{0,30}(cool|cools|eas|slow|slows|fall|falls|fell|drop|decline|lower)|cpi[^.]{0,20}(cool|eas|slow|fall|fell|lower)|yields?[^.]{0,20}(fall|fell|drop|ease|decline|lower)|enflasyon[^.]{0,25}(düş|geriled|yavaşla|soğu))/i;
    let u = 0, d = 0;
    items.forEach((it) => { const t = (it.title || '') + ' ' + (it.description || ''); if (up.test(t)) u++; if (down.test(t)) d++; });
    const tot = u + d;
    return tot ? (u - d) / (tot + 1) : 0;
  }

  function pulseRecentCount(items, days) {
    const now = Date.now(), win = days * 24 * 3600 * 1000;
    return items.filter((it) => { const t = Date.parse(it.pubDate); return !isNaN(t) && now - t < win; }).length;
  }
  function relTimeShort(dateStr) {
    const t = Date.parse(dateStr); if (isNaN(t)) return '';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return m <= 1 ? 'az önce' : m + ' dk önce';
    const h = Math.round(m / 60); if (h < 24) return h + ' sa önce';
    return Math.round(h / 24) + ' gün önce';
  }

  async function computePulseMacro(force) {
    const themes = [
      { key: 'pmFed',  lang: 'tr', q: '(Fed OR Powell OR FOMC OR "Merkez Bankası") (faiz OR "interest rate" OR "rate cut" OR "rate hike" OR "faiz kararı" OR hawkish OR dovish)' },
      { key: 'pmInfl', lang: 'en', q: '(CPI OR inflation OR "consumer price" OR "Treasury yield" OR "10-year yield" OR "jobs report" OR PCE)' },
      // D7: yüksek-etkili makro başlıklar — faiz kelimesi geçmese de piyasayı sarsan
      // zirve/konuşma/açıklama akışı (Fed zirvesi, Powell, Trump, Musk, gümrük/tarife).
      // Yön matematiğine (rateDir/inflDir) DAHİL DEĞİL; yalnız bilgi başlığı olarak gösterilir.
      { key: 'pmBig',  lang: 'tr', q: '(Fed OR Powell OR "Jerome Powell" OR "Jackson Hole" OR FOMC OR zirve OR summit OR Trump OR "Elon Musk" OR Musk OR tarife OR tariff OR "gümrük vergisi") (borsa OR piyasa OR "stock market" OR "Wall Street" OR altın OR gold OR ekonomi OR economy OR faiz OR dolar OR "S&P 500")' },
    ];
    let td = {};
    try { td = await fetchThemesData(themes, force); } catch (_) {}
    const fedItems  = (td.pmFed  && td.pmFed.items)  || [];
    const inflItems = (td.pmInfl && td.pmInfl.items) || [];
    const bigItems  = (td.pmBig  && td.pmBig.items)  || [];
    const allItems  = fedItems.concat(inflItems);

    const rateDir = rateDirection(fedItems);   // -1 gevşeme .. +1 sıkılaşma
    const inflDir = inflDirection(inflItems);  // -1 soğuma .. +1 ısınma
    const fresh2d = pulseRecentCount(allItems, 2);

    // Birleşik para-politikası baskısı → yön-duyarlı sektör etkisi
    const pressure = rateDir * 0.6 + inflDir * 0.4;
    let stance, emoji, cls, biasUp = [], biasDown = [];
    if (pressure >= 0.12) {
      stance = 'Sıkılaşma / şahin baskı'; emoji = '🔺'; cls = 'hawk';
      biasDown = RATE_SENSITIVE.concat(['gold']); biasUp = ['banks'];
    } else if (pressure <= -0.12) {
      stance = 'Gevşeme / güvercin rüzgârı'; emoji = '🕊️'; cls = 'dove';
      biasUp = RATE_SENSITIVE.concat(['gold']); biasDown = [];
    } else {
      stance = 'Nötr / belirsiz yön'; emoji = '⚖️'; cls = 'neu';
    }

    const rateLbl = rateDir >= 0.15 ? '🔺 Faiz: şahin / sıkılaşma sinyali'
                  : rateDir <= -0.15 ? '🕊️ Faiz: güvercin / gevşeme sinyali'
                  : '⚖️ Faiz yönü: nötr / belirsiz';
    const inflLbl = inflDir >= 0.15 ? '📈 Enflasyon: ısınma baskısı'
                  : inflDir <= -0.15 ? '📉 Enflasyon: soğuma / rahatlama'
                  : '➖ Enflasyon: dengeli / belirsiz';

    const headlines = allItems
      .filter((it) => it.title && it.link)
      .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
      .slice(0, 3);

    // D7: yüksek-etkili başlıklar (Fed zirvesi/Powell/FOMC/Trump/Musk/gümrük) —
    // yön matematiğinden bağımsız, sadece "bunlar oluyor" bilgisi. Yön okumasında
    // zaten görünen başlıkları (allItems) ele; en yeni 4'ü göster.
    const seenLinks = new Set(allItems.map((it) => it.link));
    const bigHeadlines = bigItems
      .filter((it) => it.title && it.link && !seenLinks.has(it.link))
      .sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
      .slice(0, 4);

    return { rateDir, inflDir, pressure, stance, emoji, cls, biasUp, biasDown,
             rateLbl, inflLbl, headlines, bigHeadlines, fresh2d, hasData: allItems.length > 0 };
  }

  // Bir ani-hareket satırı faiz/enflasyon ile mi açıklanıyor?
  function pulseMacroTag(row, macro) {
    if (!macro || !macro.hasData) return null;
    const secs = SYMBOL_SECTORS[row.symbol] || [];
    if (!secs.length) return null;
    if (!row.up && macro.biasDown.some((s) => secs.includes(s)))
      return '<span class="pulse-why macro">🏦 Faiz/enflasyon baskısı</span>';
    if (row.up && macro.biasUp.some((s) => secs.includes(s)))
      return '<span class="pulse-why macro">🏦 Faiz/enflasyon rüzgârı</span>';
    return null;
  }

  // Bütüncül tek-cümle yorum — kullanıcının gerçek movers'larına bağlı
  function pulseMacroComment(macro, rows) {
    if (!macro || !macro.hasData)
      return 'Şu an öne çıkan faiz/enflasyon başlığı yok — makro cephe sakin. Ani hareketler daha çok hisseye özel.';
    const when = macro.fresh2d ? 'son 2 günde' : 'son dönemde';
    const hitDown = rows.filter((r) => !r.up && (SYMBOL_SECTORS[r.symbol] || []).some((s) => macro.biasDown.includes(s)));
    const hitUp   = rows.filter((r) =>  r.up && (SYMBOL_SECTORS[r.symbol] || []).some((s) => macro.biasUp.includes(s)));
    if (macro.cls === 'hawk') {
      let s = `${when} faiz tarafında <b>şahin/sıkılaşma</b>${macro.inflDir >= 0.15 ? ' + enflasyon ısınma' : ''} okunuyor → <b>faize duyarlı teknoloji/çip/REIT</b> baskı altında olur, banka nispeten korunaklı.`;
      if (hitDown.length) s += ` Listende <b>${hitDown.slice(0, 3).map((r) => r.symbol).join(', ')}</b> bugün geriliyor — bu eğilimle uyumlu.`;
      s += ' Faiz yönü dönene kadar bu sektörlerde oynaklık sürebilir.';
      return s;
    }
    if (macro.cls === 'dove') {
      let s = `${when} faiz tarafında <b>güvercin/gevşeme</b>${macro.inflDir <= -0.15 ? ' + enflasyon soğuma' : ''} okunuyor → <b>faize duyarlı büyüme (teknoloji/çip/REIT) ve altın</b> rahatlar.`;
      if (hitUp.length) s += ` Listende <b>${hitUp.slice(0, 3).map((r) => r.symbol).join(', ')}</b> bugün yükseliyor — bu rüzgârla uyumlu.`;
      return s;
    }
    return `Faiz yönü şu an <b>net değil</b>; şahin ve güvercin başlıklar dengede. Faize duyarlı sektörlerde yön netleşene kadar oynaklık normaldir.`;
  }

  function buildPulseMacroHtml(macro, comment) {
    const m = macro;
    const heads = m.headlines.length
      ? m.headlines.map((h) => {
          const rt = relTimeShort(h.pubDate);
          return `<a class="pmac-hl" href="${h.link}" target="_blank" rel="noopener">🗞️ ${h.title.slice(0, 92)}${h.title.length > 92 ? '…' : ''}${rt ? ` <em>${rt}</em>` : ''}</a>`;
        }).join('')
      : '<span class="pmac-hl dim">Şu an güncel faiz/enflasyon başlığı bulunamadı.</span>';
    const biasChips = [];
    if (m.biasDown.length) biasChips.push(`<span class="pmac-bias dn">▼ Baskı: ${m.biasDown.slice(0, 4).map((s) => SECTORS[s] || s).join(' · ')}</span>`);
    if (m.biasUp.length)   biasChips.push(`<span class="pmac-bias up">▲ Lehte: ${m.biasUp.slice(0, 4).map((s) => SECTORS[s] || s).join(' · ')}</span>`);
    const fresh = m.fresh2d ? `🟢 canlı · ${m.fresh2d} başlık/2g` : m.hasData ? '🟠 son başlıklar' : '⚪ veri yok';
    const big = (m.bigHeadlines && m.bigHeadlines.length)
      ? `<div class="pmac-big">
           <div class="pmac-big-h">🔴 Yüksek etkili başlıklar <span>Fed zirvesi · Powell · FOMC · Trump · Musk · gümrük</span></div>
           ${m.bigHeadlines.map((h) => {
             const rt = relTimeShort(h.pubDate);
             return `<a class="pmac-bhl" href="${h.link}" target="_blank" rel="noopener">📣 ${h.title.slice(0, 96)}${h.title.length > 96 ? '…' : ''}${rt ? ` <em>${rt}</em>` : ''}</a>`;
           }).join('')}
         </div>`
      : '';
    return `<div class="pmac ${m.cls}">
      <div class="pmac-top">
        <span class="pmac-stance">🏦 Makro Nabız — ${m.stance}</span>
        <span class="pmac-fresh">${fresh}</span>
      </div>
      <div class="pmac-reads"><span class="pmac-read">${m.rateLbl}</span><span class="pmac-read">${m.inflLbl}</span></div>
      <div class="pmac-comment">${comment}</div>
      ${biasChips.length ? `<div class="pmac-biases">${biasChips.join('')}</div>` : ''}
      ${big}
      <div class="pmac-heads">${heads}</div>
      <div class="pmac-disc">Yön okuması haber başlıklarından çıkarımdır; eğilimdir, kesinlik değil. Yatırım tavsiyesi değildir.</div>
    </div>`;
  }

  function initPulse() {
    if (!pulseInited) {
      const rb = document.getElementById('pulseRefresh');
      if (rb) rb.addEventListener('click', () => renderPulse(true));
      const nb = document.getElementById('pulseNotif');
      if (nb) nb.addEventListener('click', async () => {
        if (!('Notification' in window)) { alert('Tarayıcın bildirim desteklemiyor.'); return; }
        const perm = await Notification.requestPermission();
        if (perm === 'granted') new Notification('⚡ Nabız aktif', { body: 'Ani hareketlerde bildirim alacaksın (uygulama açıkken).' });
        renderPulse();
      });
      // Sekme görünürken periyodik tara
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && document.getElementById('tab-pulse') &&
            document.getElementById('tab-pulse').classList.contains('active')) renderPulse();
      });
      pulseInited = true;
    }
    renderPulse();
    if (pulseTimer) clearInterval(pulseTimer);
    pulseTimer = setInterval(() => {
      const tab = document.getElementById('tab-pulse');
      if (tab && tab.classList.contains('active') && !document.hidden) renderPulse();
    }, PULSE_POLL_MS);
  }

  // ===== Nabız bildirim kapsamı tercihleri (yalnız in-page/anlık bildirimleri etkiler) =====
  const NOTIF_PREFS_KEY = 'sb:notifPrefs';
  function loadNotifPrefs() {
    const def = { stocks: true, crypto: true, metal: true, onlyMine: false };
    try { const r = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)); if (r && typeof r === 'object') return { ...def, ...r }; } catch (_) {}
    return def;
  }
  function saveNotifPrefs(p) { try { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(p)); } catch (_) {} }
  // row → bu tercihlerle bildirilmeli mi?
  function pulseNotifAllowed(row) {
    const p = loadNotifPrefs();
    const acls = row.acls || 'stocks';
    if (acls === 'crypto' && !p.crypto) return false;
    if (acls === 'metal' && !p.metal) return false;
    if ((acls === 'stocks') && !p.stocks) return false;
    // "Yalnızca portföyüm + listelerim" → yalnız kullanıcı kaynaklı satırlar (sabit kripto/maden evreni hariç)
    if (p.onlyMine && !(row.tag === 'portföy' || row.tag === 'izleme')) return false;
    return true;
  }

  function pulseFireAlert(row) {
    // Gün değişince dedup'ı sıfırla
    const day = new Date().toISOString().slice(0, 10);
    if (day !== pulseAlertDay) { pulseAlertDay = day; Object.keys(pulseAlerted).forEach((k) => delete pulseAlerted[k]); }
    // Bildirim izni yoksa hiçbir şey gönderme ve seviyeyi kaydetme
    // (izin sonradan açılınca aktif sıçrama yine bildirilebilsin).
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    // Kullanıcının seçtiği kapsam dışındaysa bildirme.
    if (!pulseNotifAllowed(row)) return false;
    const key = row.market + ':' + row.symbol;
    const th = PULSE_TH[row.thkey || row.market] || PULSE_TH.US;
    const level = Math.trunc(row.a.dayChg / th.step); // işaretli → yön değişimi de yeni alarm
    if (pulseAlerted[key] === level) return false;
    pulseAlerted[key] = level;
    const up = row.a.dayChg >= 0;
    const arrow = up ? '▲' : '▼';
    const why = row.why.length ? ` · ${row.why[0].emoji} ${row.why[0].label}` : '';
    try {
      new Notification(`${arrow} ${row.symbol} ani hareket`, {
        body: `Gün içi ${up ? '+' : ''}${row.a.dayChg.toFixed(1)}% (son 1s ${row.a.hourChg >= 0 ? '+' : ''}${row.a.hourChg.toFixed(1)}%)${why}`,
        tag: 'pulse-' + key,
      });
    } catch (_) { return false; }
    return true;
  }

  async function renderPulse(force) {
    const listEl = document.getElementById('pulseList');
    const statusEl = document.getElementById('pulseStatus');
    const headEl = document.getElementById('pulseHead');
    if (!listEl || pulseBusy) return;
    pulseBusy = true;
    if (!listEl.children.length) statusEl.textContent = 'İzleme + portföy sembolleri canlı taranıyor…';

    // Sıcak gündem temaları (neden-açıklaması için) — 20 dk cache
    if (force || !pulseThemes || Date.now() - pulseThemesAt > 20 * 60 * 1000) {
      try { pulseThemes = await fetchThemesData(RADAR_THEMES, force); pulseThemesAt = Date.now(); } catch (_) {}
    }

    // 🏦 Makro Nabız: canlı faiz + enflasyon okuması → Nabız'ın tepesine hemen bas (dinamik hissi)
    let pulseMacro = null;
    try { pulseMacro = await computePulseMacro(force); } catch (_) {}
    if (pulseMacro) {
      headEl.innerHTML = buildPulseMacroHtml(pulseMacro, pulseMacroComment(pulseMacro, []))
        + '<div class="pulse-summary"><span class="pulse-count">🔄 Semboller taranıyor…</span></div>';
    }

    const syms = pulseSymbols();
    const rows = [];
    const q = syms.slice();
    async function worker() {
      while (q.length) {
        const s = q.shift();
        try {
          const { candles, meta } = await fetchYahooOHLC(s.symbol, s.market, '1d', '5m');
          const a = analyzeIntraday(candles, meta);
          if (!a) continue;
          const { sudden } = pulseIsSudden(a, s.thkey || s.market);
          const up = a.dayChg >= 0;
          const why = sudden ? pulseWhyThemes(s.symbol, up) : [];
          let senti = null;
          if (sudden) { try { senti = await computeNewsSentiment(s.symbol, s.market); } catch (_) {} }
          rows.push({ ...s, a, sudden, up, why, senti });
        } catch (_) {}
      }
    }
    await Promise.all([worker(), worker(), worker()]);

    // Sırala: önce ani hareket edenler, sonra gün içi mutlak değişime göre
    rows.sort((x, y) => (y.sudden - x.sudden) || (Math.abs(y.a.dayChg) - Math.abs(x.a.dayChg)));

    // Ani hareket edenlere bildirim gönder
    let fired = 0;
    rows.filter((r) => r.sudden).forEach((r) => { if (pulseFireAlert(r)) fired++; });

    const movers = rows.filter((r) => r.sudden);
    const notifOn = ('Notification' in window && Notification.permission === 'granted');
    const macroHtml = pulseMacro ? buildPulseMacroHtml(pulseMacro, pulseMacroComment(pulseMacro, rows)) : '';
    headEl.innerHTML = macroHtml + `<div class="pulse-summary">
      <span class="pulse-count ${movers.length ? 'hot' : ''}">${movers.length ? '⚡ ' + movers.length + ' ani hareket' : '😴 Şu an ani hareket yok'}</span>
      <button id="pulseNotif" class="pulse-notif-btn ${notifOn ? 'on' : ''}">${notifOn ? '🔔 Bildirim açık' : '🔕 Bildirimi aç'}</button>
    </div>`;
    // headEl yeniden yazıldı → notif butonunu tekrar bağla
    const nb2 = document.getElementById('pulseNotif');
    if (nb2) nb2.addEventListener('click', async () => {
      if (!('Notification' in window)) { alert('Tarayıcın bildirim desteklemiyor.'); return; }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification('⚡ Nabız aktif', { body: 'Ani hareketlerde bildirim alacaksın (uygulama açıkken).' });
      renderPulse();
    });

    listEl.innerHTML = rows.map((r, _i) => {
      r._i = _i;
      const up = r.up, arrow = up ? '▲' : '▼';
      const cls = r.sudden ? (up ? 'surge-up' : 'surge-down') : 'calm';
      const dayTxt = `${r.a.dayChg >= 0 ? '+' : ''}${r.a.dayChg.toFixed(1)}%`;
      const hourTxt = `${r.a.hourChg >= 0 ? '+' : ''}${r.a.hourChg.toFixed(1)}%`;
      const chips = [];
      if (r.sudden) {
        r.why.forEach((w) => chips.push(`<span class="pulse-why theme">${w.emoji} ${w.label} · ${w.heat}</span>`));
        if (r.a.breakout) chips.push('<span class="pulse-why brk">📊 Gün içi zirve kırılımı</span>');
        if (r.a.rvol >= 1.5) chips.push(`<span class="pulse-why vol">🔊 Hacim ${r.a.rvol.toFixed(1)}×</span>`);
        if (r.senti && r.senti.hits) {
          const top = r.senti.items && r.senti.items[0];
          chips.push(`<span class="pulse-why news ${r.senti.cls}">📰 ${r.senti.label}</span>`);
          if (top) chips.push(`<span class="pulse-why head" title="${(top.title || '').replace(/"/g, '&quot;')}">🗞️ ${(top.title || '').slice(0, 60)}…</span>`);
        }
        const mtag = pulseMacroTag(r, pulseMacro);
        if (mtag) chips.push(mtag);
        if (!chips.length) chips.push('<span class="pulse-why none">Sebep bulunamadı — teknik/hacim kaynaklı olabilir</span>');
      }
      const cur = r.market === 'BIST' ? '₺' : '$';
      const badge = r.acls === 'crypto' ? '🪙' : r.acls === 'metal' ? '🥇' : r.market;
      const nameTxt = r.disp || r.symbol;
      return `<div class="pulse-row ${cls}" data-idx="${r._i}">
        <div class="pulse-lead">
          <span class="pulse-sym">${arrow} ${nameTxt} <span class="badge">${badge}</span> <span class="pulse-tag">${r.tag}</span></span>
          <span class="pulse-chg ${up ? 'up' : 'dn'}">${dayTxt} <em>gün</em> · <span class="pulse-hour">${hourTxt} <em>son 1s</em></span></span>
        </div>
        <div class="pulse-mid">${makeSparkline(r.a.spark, 220, 34)}</div>
        <div class="pulse-price">${cur}${r.a.price != null ? (+r.a.price).toFixed(2) : '—'}</div>
        ${chips.length ? `<div class="pulse-reasons">${chips.join('')}</div>` : ''}
      </div>`;
    }).join('');
    listEl.querySelectorAll('.pulse-row').forEach((el) =>
      el.addEventListener('click', () => {
        const r = rows[+el.dataset.idx]; if (!r) return;
        if (r.acls === 'crypto' && typeof openCryptoPage === 'function') openCryptoPage(r.coin);
        else if (r.acls === 'metal' && typeof openMetalPage === 'function') openMetalPage(r.metalKey, r.metalName);
        else openStockPage(r.symbol, r.market, r.symbol);
      }));

    statusEl.textContent = `${rows.length} sembol tarandı · ${movers.length} ani hareket${fired ? ` · ${fired} yeni bildirim` : ''} · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · 3 dk'da bir yenilenir`;
    pulseBusy = false;
  }

  // ===== Karşılaştır sekmesi (yan yana hisse kıyaslama) =====
  const COMPARE_LS_KEY = 'sb:compare';
  const compareMem = new Map();          // "MARKET:SYMBOL" -> metrics obj (veya {ok:false})
  let compareInited = false;
  let comparePickerOpen = false;
  let compareDcfOpen = false; // İçsel Değer (DCF) satırı varsayılan KAPALI; başlığa tıklayınca açılır.

  const YFIN_BASE = (window.MY_PROXY || '').replace(/\/api\/proxy.*$/, '') + '/api/yfin' || '/api/yfin';
  const yahooSym = (symbol, market) => market === 'BIST' ? symbol + '.IS' : symbol;

  function loadCompare() {
    try { const r = JSON.parse(localStorage.getItem(COMPARE_LS_KEY)); if (Array.isArray(r)) return r; } catch (_) {}
    return [];
  }
  function saveCompare(items) { try { localStorage.setItem(COMPARE_LS_KEY, JSON.stringify(items)); } catch (_) {} }

  // Kıyas metrikleri (satırlar). dir: 'low' = düşük iyi, 'high' = yüksek iyi, null = vurgulama yok.
  // Yahoo "industry" (sektör altı alan) → Türkçe kısa etiket. Eşleşmezse ham değeri gösterir.
  const INDUSTRY_TR = {
    'Semiconductors': 'Yarı iletken',
    'Semiconductor Equipment & Materials': 'Yarı iletken ekipman & malzeme',
    'Consumer Electronics': 'Tüketici elektroniği',
    'Communication Equipment': 'İletişim/fiberoptik ekipman',
    'Computer Hardware': 'Bilgisayar donanımı',
    'Electronic Components': 'Elektronik bileşen',
    'Electronics & Computer Distribution': 'Elektronik dağıtım',
    'Scientific & Technical Instruments': 'Bilimsel/teknik cihaz',
    'Information Technology Services': 'BT hizmetleri',
    'Software - Application': 'Yazılım (uygulama)',
    'Software - Infrastructure': 'Yazılım (altyapı)',
    'Solar': 'Güneş enerjisi',
    'Internet Content & Information': 'İnternet içerik/servis',
    'Internet Retail': 'İnternet perakende',
    'Banks - Regional': 'Banka (bölgesel)',
    'Banks - Diversified': 'Banka (evrensel)',
    'Capital Markets': 'Sermaye piyasaları',
    'Insurance - Diversified': 'Sigorta',
    'Insurance - Life': 'Hayat sigortası',
    'Asset Management': 'Varlık yönetimi',
    'Credit Services': 'Kredi/finansman hizmetleri',
    'Oil & Gas Integrated': 'Petrol & gaz (entegre)',
    'Oil & Gas E&P': 'Petrol & gaz (arama/üretim)',
    'Oil & Gas Refining & Marketing': 'Rafineri & pazarlama',
    'Oil & Gas Midstream': 'Petrol & gaz (taşıma/depo)',
    'Utilities - Regulated Electric': 'Elektrik (regüle)',
    'Utilities - Renewable': 'Yenilenebilir enerji',
    'Steel': 'Çelik',
    'Aluminum': 'Alüminyum',
    'Copper': 'Bakır',
    'Gold': 'Altın madenciliği',
    'Other Industrial Metals & Mining': 'Sanayi metali & madencilik',
    'Building Materials': 'İnşaat malzemeleri',
    'Chemicals': 'Kimya',
    'Specialty Chemicals': 'Özel kimyasallar',
    'Agricultural Inputs': 'Tarımsal girdi/gübre',
    'Auto Manufacturers': 'Otomobil üreticisi',
    'Auto Parts': 'Otomotiv yan sanayi',
    'Airlines': 'Havayolu',
    'Aerospace & Defense': 'Havacılık & savunma',
    'Industrial Distribution': 'Sanayi dağıtım',
    'Farm & Heavy Construction Machinery': 'Ağır makine/iş makinesi',
    'Specialty Industrial Machinery': 'Özel sanayi makineleri',
    'Railroads': 'Demiryolu',
    'Integrated Freight & Logistics': 'Lojistik & taşımacılık',
    'Telecom Services': 'Telekom hizmetleri',
    'Entertainment': 'Eğlence/medya',
    'Restaurants': 'Restoran',
    'Discount Stores': 'İndirim marketi',
    'Grocery Stores': 'Market/gıda perakende',
    'Packaged Foods': 'Paketli gıda',
    'Beverages - Non-Alcoholic': 'İçecek (alkolsüz)',
    'Beverages - Brewers': 'Bira',
    'Tobacco': 'Tütün',
    'Household & Personal Products': 'Ev & kişisel bakım',
    'Apparel Retail': 'Giyim perakende',
    'Apparel Manufacturing': 'Giyim üretimi',
    'Drug Manufacturers - General': 'İlaç (büyük ölçek)',
    'Drug Manufacturers - Specialty & Generic': 'İlaç (jenerik/özel)',
    'Biotechnology': 'Biyoteknoloji',
    'Medical Devices': 'Tıbbi cihaz',
    'Medical Instruments & Supplies': 'Tıbbi araç & malzeme',
    'Healthcare Plans': 'Sağlık sigortası',
    'Diagnostics & Research': 'Tanı & araştırma',
    'REIT - Retail': 'GYO (perakende)',
    'REIT - Residential': 'GYO (konut)',
    'REIT - Industrial': 'GYO (sanayi/lojistik)',
    'Real Estate - Development': 'Gayrimenkul geliştirme',
    'Real Estate Services': 'Gayrimenkul hizmetleri',
    'Conglomerates': 'Holding',
    'Paper & Paper Products': 'Kağıt & selüloz',
    'Packaging & Containers': 'Ambalaj',
    'Textile Manufacturing': 'Tekstil üretimi',
  };
  const trIndustry = (v) => v ? (INDUSTRY_TR[v] || v) : '—';

  const COMPARE_ROWS = [
    { key: 'sector',        label: 'Sektör',              type: 'text' },
    { key: 'industry',      label: 'Detay',               type: 'text', xf: trIndustry, hint: 'Sektör içindeki alt alan (ör. yarı iletken, bellek, fiberoptik, kimya…). Kaynak: Yahoo Finance sınıflandırması.' },
    { key: 'price',         label: 'Fiyat',               type: 'price' },
    { key: 'marketCap',     label: 'Piyasa Değeri',       type: 'mcap' },
    { key: 'trailingPE',    label: 'F/K',                 type: 'ratio', dir: 'low',  hint: 'Fiyat / Kazanç (son 12 ay). Düşük = daha ucuz.' },
    { key: 'forwardPE',     label: 'İleri F/K',           type: 'ratio', dir: 'low',  hint: 'Gelecek yıl beklenen kazanca göre F/K.' },
    { key: 'peg',           label: 'PEG',                 type: 'ratio2',dir: 'low',  hint: 'F/K ÷ büyüme. ~1 altı büyümeye göre ucuz sayılır.' },
    { key: 'priceToBook',   label: 'PD/DD',               type: 'ratio', dir: 'low',  hint: 'Piyasa Değeri / Defter Değeri.' },
    { key: 'priceToSales',  label: 'F/S (Fiyat/Satış)',   type: 'ratio', dir: 'low',  hint: 'Kâr etmeyen/erken şirketlerde F/K yerine kullanılır.' },
    { key: 'evEbitda',      label: 'FD/FAVÖK',            type: 'ratio', dir: 'low',  hint: 'Borcu da içerir; sermaye-yoğun sektörlerde daha adil.' },
    { key: 'profitMargin',  label: 'Net Kâr Marjı',       type: 'pct',   dir: 'high', hint: 'Net kâr / satış. Yüksek = daha kârlı.' },
    { key: 'returnOnEquity',label: 'Özsermaye Kârlılığı', type: 'pct',   dir: 'high', hint: 'ROE — özsermayenin ne kadar kâra döndüğü.' },
    { key: 'revenueGrowth', label: 'Gelir Büyümesi (yıllık)', type: 'pct', dir: 'high', hint: 'Değerlemeyi en çok etkileyen tek etken çoğu zaman büyümedir.' },
    { key: 'debtToEquity',  label: 'Borç/Özsermaye',      type: 'd2e',   dir: 'low',  hint: 'Finansal risk; düşük = daha az borçlu.' },
    { key: 'dividendYield', label: 'Temettü Verimi',      type: 'pct',   dir: 'high', hint: 'Yıllık temettü / fiyat.' },
  ];

  const curSymFor = (c) => c === 'USD' ? '$' : c === 'TRY' ? '₺' : (c ? c + ' ' : '');
  function fmtMcap(v, cur) {
    if (v == null) return '—';
    const s = curSymFor(cur);
    if (v >= 1e12) return s + (v / 1e12).toFixed(2) + ' T';
    if (v >= 1e9)  return s + (v / 1e9).toFixed(1) + ' Mr';
    if (v >= 1e6)  return s + (v / 1e6).toFixed(0) + ' Mn';
    return s + v.toLocaleString('tr-TR');
  }
  function fmtCell(row, m) {
    const v = m ? m[row.key] : null;
    if (v == null || (typeof v === 'number' && isNaN(v))) return '—';
    switch (row.type) {
      case 'text':   return row.xf ? row.xf(v) : v;
      case 'price':  return curSymFor(m.currency) + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
      case 'mcap':   return fmtMcap(v, m.currency);
      case 'ratio':  return Number(v).toFixed(1);
      case 'ratio2': return Number(v).toFixed(2);
      case 'pct':    return (v * 100).toFixed(1) + '%';
      case 'd2e':    return (v / 100).toFixed(2) + 'x';
      default:       return String(v);
    }
  }
  // Bir satır için en iyi/en kötü sütunu bul (yalnız geçerli pozitif değerler; F/K vb. negatif = zarar, hariç).
  function rowExtrema(row, metrics) {
    if (!row.dir) return {};
    const vals = [];
    metrics.forEach((m, i) => {
      let v = m ? m[row.key] : null;
      if (v == null || isNaN(v)) return;
      if ((row.type === 'ratio' || row.type === 'ratio2') && v <= 0) return; // negatif F/K anlamsız
      vals.push({ i, v });
    });
    if (vals.length < 2) return {};
    let best = vals[0], worst = vals[0];
    for (const x of vals) {
      if (row.dir === 'low')  { if (x.v < best.v) best = x; if (x.v > worst.v) worst = x; }
      else                    { if (x.v > best.v) best = x; if (x.v < worst.v) worst = x; }
    }
    return { best: best.i, worst: worst.i };
  }

  async function yfinQuery(ysyms) {
    if (!ysyms.length) return {};
    try {
      const r = await fetch(YFIN_BASE + '?symbols=' + encodeURIComponent(ysyms.join(',')), { cache: 'no-store' });
      const j = await r.json();
      const byY = {};
      (j.results || []).forEach((res) => { byY[res.symbol] = res; });
      return byY;
    } catch (_) { return {}; }
  }
  const otherMarket = (m) => m === 'BIST' ? 'US' : 'BIST';

  // Tek /api/yfin çağrısında toplu çeker. Veri gelmezse piyasayı YANLIŞ seçmiş olabilir
  // (ör. BIST kodunu "ABD" bırakmış) → ters piyasayı otomatik dener ve düzeltir.
  // Düzeltme yaptıysa true döner (çağıran yeniden render eder).
  async function fetchCompareBatch(items) {
    const need = items.filter((it) => !compareMem.has(it.market + ':' + it.symbol));
    if (!need.length) return false;
    const first = await yfinQuery(need.map((it) => yahooSym(it.symbol, it.market)));
    const retry = [];
    need.forEach((it) => {
      const res = first[yahooSym(it.symbol, it.market)];
      if (res && res.ok) compareMem.set(it.market + ':' + it.symbol, res);
      else retry.push(it);
    });
    let corrected = false;
    if (retry.length) {
      const second = await yfinQuery(retry.map((it) => yahooSym(it.symbol, otherMarket(it.market))));
      const stored = loadCompare();
      retry.forEach((it) => {
        const om = otherMarket(it.market);
        const res = second[yahooSym(it.symbol, om)];
        if (res && res.ok) {
          compareMem.set(it.market + ':' + it.symbol, res); // mevcut render veriyi görsün
          compareMem.set(om + ':' + it.symbol, res);
          const t = stored.find((x) => x.symbol === it.symbol && x.market === it.market);
          if (t && !stored.some((x) => x.symbol === it.symbol && x.market === om)) { t.market = om; corrected = true; }
        } else {
          compareMem.set(it.market + ':' + it.symbol, { ok: false });
        }
      });
      if (corrected) saveCompare(stored);
    }
    return corrected;
  }

  // ===== Karşılaştır: sistem değerlendirmesi (TA/FA skoru + uygun alım + dürüst not) =====
  // Hisse Sayfası'ndaki Sonuç motorunun AYNISINI (getTaScoreFor + FA engine + momentumInfo)
  // her kolon için çalıştırıp, kolonun altına özet olarak yazar. Ağır (SEC/İş Yatırım + 5y
  // günlük mum çeker) ama kullanıcı tetikli ve cache'li.
  const faModelMem = new Map();        // "MKT:SYM" -> { ok, score, valuation } | { ok:false }
  const compareVerdictMem = new Map(); // "MKT:SYM" -> verdict | { ok:false }

  // FA skorunu + değerleme (F/K/HBK) döndürür — fillSpFa ile aynı yol, ama RENDER etmez.
  async function faModelFor(symbol, market) {
    const key = market + ':' + symbol;
    if (faModelMem.has(key)) return faModelMem.get(key);
    let out = { ok: false };
    try {
      if (market === 'US') {
        const [metaR, secR] = await Promise.allSettled([
          fetchYahooOHLC(symbol, 'US', '1y', '1d').then((d) => d.meta),
          secFetchModel(symbol),
        ]);
        const meta = metaR.status === 'fulfilled' ? metaR.value : null;
        const sec = secR.status === 'fulfilled' ? secR.value : null;
        const price = meta && meta.regularMarketPrice;
        if (sec) {
          const criteria = sec.criteria.slice();
          const eps = sec.metrics.eps;
          let pe = null;
          if (price != null && eps) {
            pe = price / eps;
            const score = pe < 0 ? 15 : faInterp(pe, [[5, 90], [10, 80], [15, 70], [20, 60], [25, 52], [35, 38], [50, 22], [80, 10]]);
            criteria.push({ key: 'pe', group: 'valuation', weight: 0.10, label: 'Değerleme (F/K)', score, note: '' });
          }
          const fa = computeFaScore(criteria);
          const valuation = (eps != null) ? { curSym: '$', eps, pe, price, dcfIn: usDcfIn(sec, price, eps) } : null;
          if (fa.score != null) out = { ok: true, score: fa.score, valuation };
        }
      } else {
        const [metaR, maliR] = await Promise.allSettled([
          fetchYahooOHLC(symbol, 'BIST', '1y', '1d').then((d) => d.meta),
          fetchIsYatirimMali(symbol),
        ]);
        const meta = metaR.status === 'fulfilled' ? metaR.value : null;
        const maliRaw = maliR.status === 'fulfilled' ? maliR.value : null;
        if (maliRaw) {
          const model = bistFundamentalModel(parseIsMali(maliRaw), meta);
          const fa = computeFaScore(model.criteria);
          const valuation = await bistValuation(symbol, model.metrics);
          if (fa.score != null) out = { ok: true, score: fa.score, valuation };
        }
      }
    } catch (_) { out = { ok: false }; }
    faModelMem.set(key, out);
    return out;
  }

  // Bir kolon için özet değerlendirme: FA/TA skoru, bileşke, uygun alım bandı (orta vade),
  // momentum rejimi ve "pahalı dahi olsa alma öngörüsü" içeren dürüst not.
  async function computeCompareVerdict(item, yMetrics) {
    const key = item.market + ':' + item.symbol;
    if (compareVerdictMem.has(key)) return compareVerdictMem.get(key);
    let out = { ok: false };
    try {
      const [daily, fam, bench, senti, macro] = await Promise.all([
        ensureDailyCandles(item.symbol, item.market),
        faModelFor(item.symbol, item.market),
        ensureBenchDaily(item.market),
        computeNewsSentiment(item.symbol, item.market).catch(() => null),
        computeMacro(false).catch(() => null),
      ]);
      const res = daily ? computeVadeScore(daily, 'orta', undefined, bench) : null;
      if (res && res.levels) {
        const L = res.levels, bz = L.buyZone;
        const faScore = fam.ok ? fam.score : null;
        const curSym = (fam.valuation && fam.valuation.curSym) || (item.market === 'BIST' ? '₺' : '$');
        const fmtP = (v) => (v == null || !isFinite(v)) ? '—'
          : curSym + v.toLocaleString('tr-TR', { maximumFractionDigits: v < 10 ? 2 : v < 1000 ? 1 : 0 });
        let buyBand = '—';
        if (bz && bz[0] != null && bz[1] != null && bz[1] > bz[0]) buyBand = `${fmtP(bz[0])} – ${fmtP(bz[1])}`;
        else if (bz && bz[0] != null) buyBand = `≤ ${fmtP(bz[0])}`;
        // Kâr-al / satış bölgesi — zaten hesaplı sellZone (direnç/hedef + ATR bandı). Kesin tepe değil;
        // momentumun tarihsel olarak yorulduğu bölge. sellKind: 'target' (uzun ufuk) | 'sell'.
        const sz = L.sellZone;
        let sellBand = '—', sellUpPct = null;
        if (sz && sz[0] != null && sz[1] != null && sz[1] > sz[0]) { sellBand = `${fmtP(sz[0])} – ${fmtP(sz[1])}`; if (L.price) sellUpPct = (((sz[0] + sz[1]) / 2) / L.price - 1) * 100; }
        else if (sz && sz[1] != null) { sellBand = `≈ ${fmtP(sz[1])}`; if (L.price) sellUpPct = (sz[1] / L.price - 1) * 100; }
        const sellKind = L.sellKind || 'sell';
        // Negatif kırılma (DENGELI confluence): fiyat altındaki en yakın yapısal destek
        // (SMA50 / swing-low anchor) = ilk savunma; SMA200 = ana trend çizgisi; 2×ATR stop = risk çıkışı.
        // Bu bir tahmin değil, koşullu tetikleyicidir: "bu seviye altına kapanış olursa trend bozulur".
        const px = L.price;
        const floors = [L.sma50, (bz && bz[0]), L.sma200].filter((x) => x != null && x < px * 0.999);
        const brkPrimary = floors.length ? Math.max.apply(null, floors)
          : (L.stop != null && L.stop < px ? L.stop : null);
        const brkMajor = (L.sma200 != null && L.sma200 < px && (brkPrimary == null || L.sma200 < brkPrimary - 1e-9)) ? L.sma200 : null;
        const atrStop = (L.stop != null && L.stop < px) ? L.stop : null;
        const brkStr = brkPrimary != null ? fmtP(brkPrimary) : '—';
        const brkPct = (brkPrimary != null && px) ? ((brkPrimary / px - 1) * 100) : null;
        const majorStr = brkMajor != null ? fmtP(brkMajor) : null;
        const atrStopStr = atrStop != null ? fmtP(atrStop) : null;
        const mom = momentumInfo(res, 'orta');
        const momZone = (mom.active && mom.zone) ? `${fmtP(mom.zone[0])} – ${fmtP(mom.zone[1])}` : '';
        let blended = null, compLabel = '—', compBand = 'mixed', compTxt = '';
        if (faScore != null) {
          const m = COMPOSITE_MATRIX[faBand(faScore) + ':' + taBand(res.score)] || COMPOSITE_MATRIX['mid:mid'];
          blended = 0.55 * faScore + 0.45 * res.score;
          compLabel = m.label; compBand = m.band; compTxt = m.txt;
        }
        const pe = (fam.valuation && fam.valuation.pe != null) ? fam.valuation.pe
          : (yMetrics && yMetrics.trailingPE != null ? yMetrics.trailingPE : null);
        const pricey = pe != null && pe > 25;
        let honest;
        if (mom.active) {
          honest = `⚡ <b>Trend güçlü</b>${pricey ? ' — F/K yüksek (pahalı) olsa da ' : ' — '}derin geri çekilme beklemeden <b>kademeli momentum girişi öngörülür</b> (fiyata yakın: ${momZone}). ${compTxt}`;
        } else if (pricey && faScore != null) {
          honest = `Değerleme pahalı (F/K ${pe.toFixed(1)}) ve güçlü bir momentum rejimi yok — bu vadede fiyata yakın agresif alım yerine uygun alım bandı beklenir. ${compTxt}`;
        } else if (faScore != null) {
          honest = compTxt;
        } else {
          honest = 'Temel skor bu sembolde hesaplanamadı (mali tablo yok) — yalnız teknik + momentum değerlendirmesi geçerli.';
        }
        // Risk/Ödül belirteci — kâr-al mesafesi (yukarı %) ÷ negatif-kırılma mesafesi (aşağı %).
        // "1 birim risk için kaç birim ödül". Yüksek = asimetrik, cazip; <1 = risk ödülden büyük.
        // NOT: Sadece MESAFE oranıdır, olasılık değil — dar stop yüksek oran verir ama erken stoplanma
        // ihtimali de yüksektir; momentum + geçmiş isabet ile birlikte okunmalı.
        const rrRatio = (sellUpPct != null && brkPct != null && brkPct < 0 && Math.abs(brkPct) > 0.01)
          ? sellUpPct / Math.abs(brkPct) : null;
        // 🧭 Temel Uygunluk Skoru (Sonuç ekranıyla ortak motor) + 🌍 konjonktür notu
        const hol = computeHolisticScore({
          faScore, taScore: res.score, levels: L, valuation: fam.valuation,
          momActive: mom.active,
          // Büyüme-farkında değerleme için Yahoo metrikleri (pct alanları KESİR → ×100).
          peg: yMetrics ? yMetrics.peg : null,
          revGrowth: (yMetrics && yMetrics.revenueGrowth != null) ? yMetrics.revenueGrowth * 100 : null,
          netMargin: (yMetrics && yMetrics.profitMargin != null) ? yMetrics.profitMargin * 100 : null,
          forwardPE: yMetrics ? yMetrics.forwardPE : null,
          trailingPE: yMetrics ? yMetrics.trailingPE : null,
        });
        const conj = buildConjunctureNote({ senti, macro, symbol: item.symbol });
        // 🧮 İçsel Değer (DCF) — SADECE BİLGİ; bileşke/uygunluk skoruna dahil değil.
        const dcf = computeDCF(fam.valuation && fam.valuation.dcfIn, daily.map((c) => c.close),
          (fam.valuation && fam.valuation.price != null) ? fam.valuation.price : L.price);
        // Alım sırası (ranking) için sayısal alım bandı + fiyat: bandın neresindeyiz?
        const buyLo = (bz && bz[0] != null) ? bz[0] : null;
        const buyHi = (bz && bz[1] != null) ? bz[1] : (bz && bz[0] != null ? bz[0] : null);
        const inBuy = (buyLo != null && buyHi != null && px != null && px >= buyLo * 0.999 && px <= buyHi * 1.001);
        // aboveGap: fiyat bandın TAVANININ ne kadar üstünde (%) — pozitif = daha az uygun (düşmesi gerek).
        // belowGap: fiyat bandın TABANININ ne kadar altında (%) — bandın altı = hedeften ucuz.
        const aboveGap = (buyHi != null && px != null && px > buyHi) ? (px / buyHi - 1) * 100 : 0;
        const belowGap = (buyLo != null && px != null && px < buyLo) ? (buyLo / px - 1) * 100 : 0;
        // 🟢 ATR-ölçekli "banda yakın" — fiyat bandın üstünde ama normal bir geri çekilmede
        // (≤1×ATR) alım aralığına inebilir. Yüzde eşiği değil ATR: dalgalı hisse daha geniş tolerans.
        const atrC = (L.atr != null && L.atr > 0) ? L.atr : (px != null ? px * 0.02 : null);
        const dAtr = (buyHi != null && px != null && atrC != null && px > buyHi) ? (px - buyHi) / atrC : 0;
        const nearBuy = (!inBuy && px != null && px > (buyHi != null ? buyHi : Infinity) && dAtr > 0 && dAtr <= 1.0);
        out = { ok: true, taScore: res.score, taCls: res.cls, faScore, blended, compLabel, compBand,
                buyBand, buyLo, buyHi, px, inBuy, nearBuy, dAtr, aboveGap, belowGap,
                sellBand, sellKind, sellUpPct, brkStr, brkPct, majorStr, atrStopStr, rrRatio,
                momActive: mom.active, momZone, pricey, pe, honest,
                suit10: hol.score10, suitBand: hol.band, suitSoft: hol.coreSoft,
                growthNote: hol.growthNote, thematic: hol.thematic,
                dcfOk: dcf.ok, dcfReason: dcf.reason, dcfBadge: dcf.badge, dcfUp: dcf.upside,
                dcfRange: dcf.ok ? `${fmtP(dcf.lo)} – ${fmtP(dcf.hi)}` : null,
                dcfBase: dcf.ok ? fmtP(dcf.base) : null,
                conjChips: conj.chips, conjEmoji: conj.stanceEmoji, conjCls: conj.stanceCls };
      }
    } catch (_) { out = { ok: false }; }
    compareVerdictMem.set(key, out);
    return out;
  }

  function compareAdd(symbol, market, query) {
    symbol = (symbol || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return { ok: false, err: 'Geçersiz kod.' };
    const items = loadCompare();
    if (items.some((i) => i.symbol === symbol && i.market === market)) return { ok: false, err: 'Zaten ekli.' };
    if (items.length >= 8) return { ok: false, err: 'En fazla 8 hisse.' };
    items.push({ symbol, market, query: query || symbol });
    saveCompare(items);
    return { ok: true };
  }
  function compareRemove(symbol, market) {
    saveCompare(loadCompare().filter((i) => !(i.symbol === symbol && i.market === market)));
  }

  function renderComparePicker() {
    const panel = document.getElementById('comparePicker');
    if (!panel) return;
    if (!comparePickerOpen) { panel.innerHTML = ''; panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const current = loadCompare();
    const has = (s, m) => current.some((i) => i.symbol === s && i.market === m);
    const lists = loadLists();
    let html = '<div class="cmp-pick-manual">'
      + '<input id="cmpManualCode" type="text" maxlength="10" placeholder="Kod (ör. NVDA, ASELS)" />'
      + '<select id="cmpManualMkt"><option value="BIST">BIST</option><option value="US">ABD</option></select>'
      + '<button id="cmpManualAdd" class="primary-btn">Ekle</button>'
      + '<span id="cmpPickMsg" class="cmp-pick-msg"></span></div>';
    html += '<div class="cmp-pick-lists">';
    if (!lists.length || lists.every((l) => !l.items.length)) {
      html += '<span class="opps-hint">Listelerinde hisse yok. Yukarıdan kod girerek ekleyebilirsin.</span>';
    } else {
      lists.forEach((l) => {
        if (!l.items.length) return;
        html += `<div class="cmp-pick-group"><div class="cmp-pick-gname">${l.name}</div><div class="cmp-pick-chips">`;
        l.items.forEach((it) => {
          const added = has(it.symbol, it.market);
          html += `<button class="cmp-pick-chip${added ? ' added' : ''}" data-sym="${it.symbol}" data-mkt="${it.market}" data-q="${(it.query || it.symbol).replace(/"/g, '&quot;')}"${added ? ' disabled' : ''}>${it.symbol}<span class="cmp-mkt">${it.market === 'BIST' ? 'BIST' : 'ABD'}</span></button>`;
        });
        html += '</div></div>';
      });
    }
    html += '</div>';
    panel.innerHTML = html;

    const msg = panel.querySelector('#cmpPickMsg');
    const flash = (t, ok) => { if (msg) { msg.textContent = t; msg.className = 'cmp-pick-msg ' + (ok ? 'ok' : 'err'); } };
    panel.querySelector('#cmpManualAdd').addEventListener('click', () => {
      const code = panel.querySelector('#cmpManualCode').value;
      const mkt = panel.querySelector('#cmpManualMkt').value;
      const res = compareAdd(code, mkt, code);
      if (!res.ok) { flash(res.err, false); return; }
      panel.querySelector('#cmpManualCode').value = '';
      renderCompare();
    });
    panel.querySelector('#cmpManualCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') panel.querySelector('#cmpManualAdd').click(); });
    panel.querySelectorAll('.cmp-pick-chip:not(.added)').forEach((b) => b.addEventListener('click', () => {
      const res = compareAdd(b.dataset.sym, b.dataset.mkt, b.dataset.q);
      if (!res.ok) { flash(res.err, false); return; }
      renderCompare();
    }));
  }

  // Grid'i mevcut compareMem verisiyle senkron çiz (satırlar hizalı — CSS grid)
  function paintCompare() {
    const wrap = document.getElementById('compareWrap');
    if (!wrap) return;
    const items = loadCompare();
    const esc = (s) => String(s).replace(/"/g, '&quot;');

    // Üstte: araç çubuğu (＋ ekle) + açılır seçici panel
    let html = '<div class="compare-toolbar"><button id="compareAddBtn" class="compare-add-btn2" title="Hisse ekle">＋ Hisse ekle</button></div>';
    html += '<div id="comparePicker" class="compare-picker"></div>';

    if (!items.length) {
      wrap.innerHTML = html + '<div class="compare-empty">Kıyaslamak için <b>＋ Hisse ekle</b>. Listelerinden seçebilir ya da kod yazabilirsin.</div>';
    } else {
      const metrics = items.map((it) => { const m = compareMem.get(it.market + ':' + it.symbol); return (m && m.ok) ? m : null; });
      const cols = `170px repeat(${items.length}, 148px)`;
      let g = `<div class="compare-grid${compareDcfOpen ? ' dcf-open' : ''}" style="grid-template-columns:${cols}">`;
      // Başlık satırı
      g += '<div class="compare-cell compare-corner cmp-c0">Metrik</div>';
      items.forEach((it) => {
        g += `<div class="compare-cell compare-head">`
          + `<button class="cmp-remove" data-sym="${it.symbol}" data-mkt="${it.market}" title="Kaldır">×</button>`
          + `<div class="cmp-head-top"><span class="cmp-sym">${it.symbol}</span><span class="cmp-mkt">${it.market === 'BIST' ? 'BIST' : 'ABD'}</span></div>`
          + `<button class="cmp-tolist" data-sym="${it.symbol}" data-mkt="${it.market}" data-q="${esc(it.query || it.symbol)}" title="Listeye ekle">☆ Listeye ekle</button>`
          + `</div>`;
      });
      // Metrik satırları
      COMPARE_ROWS.forEach((row) => {
        const ext = rowExtrema(row, metrics);
        g += `<div class="compare-cell compare-mlabel cmp-c0"${row.hint ? ` title="${esc(row.hint)}"` : ''}>${row.label}</div>`;
        items.forEach((it, ci) => {
          const cls = ext.best === ci ? ' cmp-best' : (ext.worst === ci ? ' cmp-worst' : '');
          const val = metrics[ci] ? fmtCell(row, metrics[ci]) : '…';
          g += `<div class="compare-cell${cls}">${val}</div>`;
        });
      });

      // --- Sistem değerlendirmesi (TA/FA skoru + uygun alım + dürüst not) ---
      const verds = items.map((it) => compareVerdictMem.get(it.market + ':' + it.symbol));
      const scoreCls = (v) => v == null ? '' : v >= 60 ? ' cmp-vg' : v < 45 ? ' cmp-vr' : ' cmp-vn';
      const scoreCell = (v, field, tag) => {
        if (v === undefined) return '<div class="compare-cell cmp-vscore">…</div>';
        if (!v || !v.ok || v[field] == null) return '<div class="compare-cell cmp-vscore">—</div>';
        return `<div class="compare-cell cmp-vscore${scoreCls(v[field])}">${Math.round(v[field])}<em>${tag}</em></div>`;
      };
      // Bölüm başlığı
      g += '<div class="compare-cell cmp-c0 cmp-vsec">📊 Sistem değerlendirmesi</div>';
      items.forEach(() => { g += '<div class="compare-cell cmp-vsec-c"></div>'; });

      // 🥇 Alım sırası (şu an) — SADECE FİYATA-UZAKLIK KIYASI, tavsiye değil.
      // "Elimdeki parayla hangisi şu an alım aralığında / alım fiyatına en yakın?" sorusunu yanıtlar.
      // Sıralama anahtarı: fiyat uygun-alım bandının TAVANININ ne kadar ÜSTÜNDE (aboveGap, %).
      //   • Bandın içinde ya da altında olanlar (aboveGap=0) = "şu an alınabilir" grubu, en üstte.
      //   • Aynı grup içinde Temel Uygunluk (0–10) ile ayrıştırılır (yüksek = önce).
      //   • Bandın üstünde olanlar, tavana ne kadar yakınsa o kadar önde.
      const rankable = verds
        .map((v, ci) => ({ ci, v }))
        .filter((x) => x.v && x.v.ok && x.v.buyHi != null && x.v.px != null);
      rankable.sort((a, b) => {
        const ka = a.v.aboveGap || 0, kb = b.v.aboveGap || 0;
        if (Math.abs(ka - kb) > 1e-9) return ka - kb;
        const sa = a.v.suit10 != null ? a.v.suit10 : -1, sb = b.v.suit10 != null ? b.v.suit10 : -1;
        return sb - sa;
      });
      const rankByCi = {};
      rankable.forEach((x, i) => { rankByCi[x.ci] = i + 1; });
      const rankBestCi = rankable.length ? rankable[0].ci : -1;
      const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : ('#' + r);
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Yan yana hisseleri, ŞU ANKİ fiyatın uygun-alım bandına uzaklığına göre sıralar (orta vade). Bandın içinde veya altında olanlar \'şu an alınabilir\' sayılır ve en üste gelir; eşitlik Temel Uygunluk skoruyla çözülür. Bandın üstündekiler tavana yakınlığına göre sıralanır. Bu yalnızca FİYAT-UZAKLIK kıyasıdır — olasılık ya da tavsiye değildir; \'düşük fiyat\' düşen bıçak da olabilir. Yatırım tavsiyesi değildir."><span class="cml-t">🥇 Alım sırası <em>(şu an)</em></span><span class="cml-s">fiyata göre: hangisi alım aralığında / en yakın</span></div>';
      verds.forEach((v, ci) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vrank">…</div>'; return; }
        if (!v || !v.ok || rankByCi[ci] == null) { g += '<div class="compare-cell cmp-vrank">—</div>'; return; }
        const r = rankByCi[ci];
        const best = ci === rankBestCi && rankable.length > 1 ? ' cmp-best' : '';
        let stCls, stTxt;
        if (v.inBuy) { stCls = 'in'; stTxt = '✓ Alım bandında'; }
        else if (v.belowGap > 0.05) { stCls = 'below'; stTxt = `▼ %${Math.round(v.belowGap)} band altı (ucuz)`; }
        else if (v.nearBuy) { stCls = 'near'; stTxt = `🟢 Uygun bölge (~${v.dAtr.toFixed(1)}×ATR)`; }
        else if (v.aboveGap > 0.05) { stCls = 'above'; stTxt = `▲ %${Math.round(v.aboveGap)} banda uzak`; }
        else { stCls = 'in'; stTxt = '✓ Alım bandında'; }
        // 🎯 Alım hedefi ("yeşil ışık"): bandın hesaplandığı fiyat — kullanıcı bu banda
        // alarm kurup alım emri verir, aşağıdaki "Kâr-al / satış" bölgesine de satış emri
        // koyarak aralığı yakalar. Mobilde hover yok → görünür satır + masaüstü için title.
        const tgt = (v.buyBand && v.buyBand !== '—') ? v.buyBand : null;
        const tgtLine = tgt ? `<span class="cvk-tgt" title="Bandın hesaplandığı alım hedefi — alım için &quot;yeşil ışık&quot; fiyatı">🎯 ${tgt}</span>` : '';
        const tip = tgt
          ? `🎯 Alım hedefi (yeşil ışık): ${tgt}${v.inBuy ? ' — fiyat şu an bu bandın içinde, alım aralığında.' : (v.belowGap > 0.05 ? ' — fiyat bandın altında (hedeften ucuz).' : ' — fiyat banda düşünce alım.')} Bu fiyata alarm kurup alım emri, aşağıdaki 💰 Kâr-al / satış bölgesine (${v.sellBand || '—'}) satış emri koyarsan hedeflenen aralığı yakalarsın. Fiyat-uzaklık bilgisidir, yatırım tavsiyesi değildir.`
          : '';
        g += `<div class="compare-cell cmp-vrank ${stCls}${best}"${tip ? ` title="${tip.replace(/"/g, '&quot;')}"` : ''}>`
          + `<span class="cvk-medal">${medal(r)}</span>`
          + `<span class="cvk-st">${stTxt}</span>`
          + tgtLine
          + `</div>`;
      });

      // Temel Skor (FA)
      g += '<div class="compare-cell compare-mlabel cmp-c0" title="0–100 Temel Skor (kalite/değer). Kaynak: SEC EDGAR (ABD) / İş Yatırım (BIST).">Temel Skor (FA)</div>';
      verds.forEach((v) => { g += scoreCell(v, 'faScore', '/100'); });
      // Teknik Skor (TA)
      g += '<div class="compare-cell compare-mlabel cmp-c0" title="0–100 Teknik Skor (orta vade trend/zamanlama).">Teknik Skor (TA)</div>';
      verds.forEach((v) => { g += scoreCell(v, 'taScore', '/100'); });
      // Bileşke
      g += '<div class="compare-cell compare-mlabel cmp-c0" title="FA %55 + TA %45 bileşke skoru.">Bileşke</div>';
      verds.forEach((v) => { g += scoreCell(v, 'blended', '/100'); });
      // Uygun alım (orta vade)
      g += '<div class="compare-cell compare-mlabel cmp-c0" title="Sistemin orta vade için belirlediği uygun alım bandı (gerçek fiyat yapısı + ATR). ⚡ = güçlü trendde fiyata yakın momentum girişi de var.">Uygun alım <em>(orta)</em></div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vbuy">…</div>'; return; }
        if (!v || !v.ok) { g += '<div class="compare-cell cmp-vbuy">—</div>'; return; }
        g += `<div class="compare-cell cmp-vbuy">${v.buyBand}${v.momActive ? ' <span class="cmp-vmom">⚡</span>' : ''}</div>`;
      });
      // 🧮 İçsel Değer (DCF) — SADECE BİLGİ; puana dahil değil. En yüksek yukarı potansiyel vurgulanır.
      let dcfBestVal = -Infinity, dcfBestIdx = -1;
      verds.forEach((v, i) => { if (v && v.ok && v.dcfOk && v.dcfUp != null && v.dcfUp > dcfBestVal) { dcfBestVal = v.dcfUp; dcfBestIdx = i; } });
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2 cmp-dcf-toggle" role="button" tabindex="0" title="İndirgenmiş Nakit Akışı (DCF) ile tahmini içsel değer aralığı ve güncel fiyata uzaklığı. Ucuz = fiyat tahmini aralığın altında, Pahalı = üstünde. FCF≤0 / kâr öncesi hisselerde uygulanamaz. SADECE BİLGİ; bileşke/uygunluk skoruna DAHİL DEĞİLDİR. Bir model tahminidir, kesin değer değil. Aç/kapa için tıkla. Yatırım tavsiyesi değildir."><span class="cml-t"><span class="cmp-dcf-caret">▸</span> 🧮 İçsel Değer (DCF)</span><span class="cml-s">indirgenmiş nakit akışı · tıkla → aç</span></div>';
      verds.forEach((v, ci) => {
        const hint = '<span class="cvd-collapsed">•••</span>';
        if (v === undefined) { g += `<div class="compare-cell cmp-vdcf">${hint}<span class="cvd-body">…</span></div>`; return; }
        if (!v || !v.ok || !v.dcfOk) {
          const na = (v && v.dcfReason === 'neg-fcf') ? 'FCF≤0 · uygulanamaz' : 'veri yok';
          g += `<div class="compare-cell cmp-vdcf">${hint}<span class="cvd-body"><span class="cvd-na">${na}</span></span></div>`; return;
        }
        const cls = v.dcfBadge === 'cheap' ? 'up' : v.dcfBadge === 'expensive' ? 'dn' : 'mid';
        const blbl = v.dcfBadge === 'cheap' ? 'Ucuz' : v.dcfBadge === 'expensive' ? 'Pahalı' : 'Makul';
        const upTxt = v.dcfUp == null ? '—' : `${v.dcfUp >= 0 ? '▲ +' : '▼ '}%${Math.abs(Math.round(v.dcfUp))}`;
        const best = (ci === dcfBestIdx && v.dcfUp != null && v.dcfUp > 0) ? ' cmp-best' : '';
        g += `<div class="compare-cell cmp-vdcf${best}">${hint}<span class="cvd-body"><span class="cvd-val">${v.dcfRange}</span><span class="cvd-up ${cls}">${upTxt} · ${blbl}</span></span></div>`;
      });
      // Kâr-al / satış bölgesi (direnç + ATR projeksiyonu)
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Sistemin direnç + ATR projeksiyonuna dayalı kâr-al / satış bölgesi. 🎯 = uzun ufukta biriktirme hedefi, 🟢 = satış/kâr-al bandı. ▲ %X = bugünkü fiyattan ne kadar yukarıda. Kesin tepe değil; momentumun tarihsel olarak yorulduğu bölge. Yatırım tavsiyesi değildir."><span class="cml-t">🎯 Kâr-al / satış</span><span class="cml-s">buradan satmayı düşün · fiyatın üstü</span></div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vsell">…</div>'; return; }
        if (!v || !v.ok || !v.sellBand || v.sellBand === '—') { g += '<div class="compare-cell cmp-vsell">—</div>'; return; }
        const dist = v.sellUpPct != null ? `<span class="cv-dist up">▲ %${Math.abs(v.sellUpPct).toFixed(0)} yukarıda</span>` : '';
        g += `<div class="compare-cell cmp-vsell"><span class="cv-val">${v.sellBand}</span>${dist}</div>`;
      });
      // Negatif kırılma seviyesi (dengeli confluence)
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Fiyatın altındaki en yakın yapısal destek (SMA / swing-low confluence). Bu seviyenin ALTINA günlük kapanış olursa trend zayıflar/bozulur — bir tahmin değil, koşullu tetikleyicidir. ▼ %X = bugünkü fiyattan ne kadar aşağıda. ana trend = SMA200 (asıl trend çizgisi; altı kırılırsa ana yön bozulur). Yatırım tavsiyesi değildir."><span class="cml-t">⚠️ Negatif kırılma</span><span class="cml-s">altına kapanış = trend bozulur</span></div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vbrk">…</div>'; return; }
        if (!v || !v.ok || !v.brkStr || v.brkStr === '—') { g += '<div class="compare-cell cmp-vbrk">—</div>'; return; }
        const dist = v.brkPct != null ? `<span class="cv-dist down">▼ %${Math.abs(v.brkPct).toFixed(0)} aşağıda</span>` : '';
        const major = v.majorStr ? `<span class="cv-major">ana trend: ${v.majorStr}</span>` : '';
        g += `<div class="compare-cell cmp-vbrk"><span class="cv-val">${v.brkStr}</span>${dist}${major}</div>`;
      });
      // Geçmiş isabet (backtest) — istenince (buton)
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Bu satış/kırılma sinyalinin geçmişte ne kadar isabetli olduğunu ölçer (walk-forward doğruluk testi, orta vade). SAT isabeti = skor SAT dediğinde fiyat gerçekten düştü mü. Yön isabeti = skorun genel yön isabeti. Kesinlik değil, geçmiş isabet. Yatırım tavsiyesi değildir."><span class="cml-t">📊 Geçmiş isabet</span><span class="cml-s">bu sinyaller geçmişte tuttu mu?</span></div>';
      items.forEach((it) => {
        g += `<div class="compare-cell cmp-vrel"><button class="cmp-rel-btn" data-sym="${it.symbol}" data-mkt="${it.market}">📊 Ölç</button></div>`;
      });
      // Risk/Ödül belirteci — kâr-al mesafesi ÷ kırılma mesafesi (yukarıda konuşulan asimetri)
      const rrBucket = (rr) => {
        if (rr == null) return null;
        if (rr >= 3)   return { cls: 'rr-good', lbl: 'çok cazip' };
        if (rr >= 2)   return { cls: 'rr-good', lbl: 'cazip' };
        if (rr >= 1.5) return { cls: 'rr-mid',  lbl: 'dengeli' };
        if (rr >= 1)   return { cls: 'rr-mid',  lbl: 'zayıf' };
        return { cls: 'rr-bad', lbl: 'risk büyük' };
      };
      // en yüksek oranı vurgula (göz kararı değil, sayıyla kıyas)
      let rrBestIdx = -1, rrBestVal = -Infinity;
      verds.forEach((v, i) => { if (v && v.ok && v.rrRatio != null && v.rrRatio > rrBestVal) { rrBestVal = v.rrRatio; rrBestIdx = i; } });
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Risk/Ödül = kâr-al mesafesi (yukarı %) ÷ negatif-kırılma mesafesi (aşağı %). \'1 birim risk için kaç birim ödül\' — yüksek oran asimetrik/cazip (kırılmaya yakın + hedefe uzak), <1 ise risk ödülden büyük. Dikkat: yalnız MESAFE oranıdır, olasılık değil; dar stop yüksek oran verir ama erken stoplanma ihtimali de artar. Momentum + geçmiş isabet ile birlikte okuyun. Yatırım tavsiyesi değildir."><span class="cml-t">⚖️ Risk / Ödül</span><span class="cml-s">1 riske kaç ödül · yukarı ÷ aşağı</span></div>';
      verds.forEach((v, ci) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vrr">…</div>'; return; }
        if (!v || !v.ok || v.rrRatio == null) { g += '<div class="compare-cell cmp-vrr">—</div>'; return; }
        const b = rrBucket(v.rrRatio);
        const best = ci === rrBestIdx && verds.filter((x) => x && x.ok && x.rrRatio != null).length > 1 ? ' cmp-best' : '';
        const up = v.sellUpPct != null ? '+%' + Math.abs(v.sellUpPct).toFixed(0) : '—';
        const dn = v.brkPct != null ? '−%' + Math.abs(v.brkPct).toFixed(0) : '—';
        g += `<div class="compare-cell cmp-vrr${best}">`
          + `<span class="cv-rr ${b.cls}">${v.rrRatio.toFixed(1)}×</span>`
          + `<span class="cv-rrl ${b.cls}">${b.lbl}</span>`
          + `<span class="cv-rrsub">▲ ${up} / ▼ ${dn}</span>`
          + `</div>`;
      });
      // Dürüst değerlendirme
      g += '<div class="compare-cell compare-mlabel cmp-c0" title="Bileşke sonuç + momentum rejimi. Pahalı olsa da güçlü trendde alım öngörüsünü içerir. Yatırım tavsiyesi değildir.">Dürüst değerlendirme</div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vnote">hesaplanıyor…</div>'; return; }
        if (!v || !v.ok) { g += '<div class="compare-cell cmp-vnote">Değerlendirme hesaplanamadı (yeterli veri yok).</div>'; return; }
        const badge = v.compLabel && v.compLabel !== '—'
          ? `<span class="cmp-vbadge cmp-band-${v.compBand}">${v.compLabel}</span>` : '';
        g += `<div class="compare-cell cmp-vnote">${badge}<span class="cmp-vtxt">${v.honest}</span></div>`;
      });

      // --- 🧭 Temel Uygunluk Skoru (0–10) — Sonuç ekranıyla ortak motor, en altta ---
      let suitBestIdx = -1, suitBestVal = -Infinity;
      verds.forEach((v, i) => { if (v && v.ok && v.suit10 != null && v.suit10 > suitBestVal) { suitBestVal = v.suit10; suitBestIdx = i; } });
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="0–10 Temel Uygunluk Skoru — \'bu hisse şu an alınır mı?\' sorusunu Temel (%40) + Teknik (%30) + Değerleme/fiyat (%30) üzerinden puanlar. Sonuç ekranındaki puanla aynı motor. Dünya/sektör/gündem bu sayıya dahil değildir (altta konjonktür notu). Yatırım tavsiyesi değildir."><span class="cml-t">🧭 Temel Uygunluk</span><span class="cml-s">FA %40 · TA %30 · fiyat %30 · 0–10</span></div>';
      verds.forEach((v, ci) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vsuit">…</div>'; return; }
        if (!v || !v.ok || v.suit10 == null) { g += '<div class="compare-cell cmp-vsuit">—</div>'; return; }
        const best = ci === suitBestIdx && verds.filter((x) => x && x.ok && x.suit10 != null).length > 1 ? ' cmp-best' : '';
        const soft = v.suitSoft >= 2 ? '<span class="cv-suit-soft" title="Skoru taşıyan ana bileşenler (temel/teknik/değerleme) yeterli canlı veriye dayanmıyor — güven sınırlı.">⚠️ sınırlı veri</span>' : '';
        g += `<div class="compare-cell cmp-vsuit${best}">`
          + `<span class="cv-suit ${v.suitBand.c}">${v.suit10.toFixed(1)}<em>/10</em></span>`
          + `<span class="cv-suitl ${v.suitBand.c}">${v.suitBand.l}</span>`
          + soft
          + `</div>`;
      });

      // --- 🌱 Büyüme notu — değerlemeyi büyümeyle bağlamlandırır (skor zaten büyüme-farkında) ---
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Değerlemeyi büyümeyle birlikte okur: PEG öncelikli, yoksa gelir büyümesi + kârlılık. Kâr öncesi/tematik hisseler için klasik F/K·PEG işlemez → \'kantitatif kapsam dışı\' işaretlenir. Skor zaten büyüme-farkında; bu satır yalnız açıklayıcı sunum. Yatırım tavsiyesi değildir."><span class="cml-t">🌱 Büyüme notu</span><span class="cml-s">büyüme-farkında değerleme</span></div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vgrow">…</div>'; return; }
        if (!v || !v.ok || !v.growthNote) { g += '<div class="compare-cell cmp-vgrow">—</div>'; return; }
        const gn = v.growthNote;
        const badge = v.thematic
          ? '<span class="cvg-badge thm">⚗️ Tematik / kâr öncesi — kantitatif kapsam dışı</span>'
          : '';
        g += `<div class="compare-cell cmp-vgrow ${gn.cls}">${badge}<span class="cvg-txt">${gn.txt}</span></div>`;
      });

      // --- 🌍 Güncel konjonktür notu (puana dahil DEĞİL) — dünya/sektör/gündem rozetleri ---
      g += '<div class="compare-cell compare-mlabel cmp-c0 cmp-mlbl2" title="Dünya görünümü (faiz/enflasyon) + bu hissenin sektörüne etkisi + haber nabzı. Puana DAHİL DEĞİLDİR; güncel eğilim yorumudur. Yatırım tavsiyesi değildir."><span class="cml-t">🌍 Konjonktür notu</span><span class="cml-s">puana dahil değil · güncel eğilim</span></div>';
      verds.forEach((v) => {
        if (v === undefined) { g += '<div class="compare-cell cmp-vconj">…</div>'; return; }
        if (!v || !v.ok || !v.conjChips) { g += '<div class="compare-cell cmp-vconj">—</div>'; return; }
        g += `<div class="compare-cell cmp-vconj ${v.conjCls || 'neu'}"><span class="cvj-emoji">${v.conjEmoji || '🌍'}</span><span class="cvj-chips">${v.conjChips}</span></div>`;
      });

      g += '</div>';
      g += '<div class="compare-suit-disc">🧭 <b>Temel Uygunluk</b>, Sonuç ekranındaki puanla aynı motordur (Temel %40 · Teknik %30 · Değerleme/fiyat %30). 🌍 <b>Konjonktür notu</b> puana dahil değildir — dünya/sektör/gündem eğilimidir. Yatırım tavsiyesi değildir; kişisel durumunuza, risk toleransınıza ve zaman ufkunuza göre değişir.</div>';
      wrap.innerHTML = html + g;
    }

    // Kontrolleri bağla
    const addBtn = document.getElementById('compareAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => { comparePickerOpen = !comparePickerOpen; renderComparePicker(); });
    wrap.querySelectorAll('.cmp-remove').forEach((b) => b.addEventListener('click', () => {
      compareRemove(b.dataset.sym, b.dataset.mkt); renderCompare();
    }));
    wrap.querySelectorAll('.cmp-tolist').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      openListMenu(b, b.dataset.sym, b.dataset.mkt, b.dataset.q);
    }));
    wrap.querySelectorAll('.cmp-rel-btn').forEach((b) => b.addEventListener('click', () => runCompareReliability(b)));
    // İçsel Değer (DCF) satırını aç/kapa — tam yeniden çizim yapmadan (durum korunur).
    const dcfToggle = wrap.querySelector('.cmp-dcf-toggle');
    if (dcfToggle) {
      const flip = () => {
        compareDcfOpen = !compareDcfOpen;
        const grid = wrap.querySelector('.compare-grid');
        if (grid) grid.classList.toggle('dcf-open', compareDcfOpen);
        const caret = dcfToggle.querySelector('.cmp-dcf-caret');
        if (caret) caret.textContent = compareDcfOpen ? '▾' : '▸';
        const sub = dcfToggle.querySelector('.cml-s');
        if (sub) sub.textContent = compareDcfOpen ? 'indirgenmiş nakit akışı · tıkla → kapat' : 'indirgenmiş nakit akışı · tıkla → aç';
      };
      dcfToggle.addEventListener('click', flip);
      dcfToggle.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    }
    renderComparePicker();
  }

  // Karşılaştır: satış/kırılma sinyalinin geçmiş isabetini istenince ölç (orta vade walk-forward).
  // Compare'i yavaşlatmamak için otomatik değil, buton tetikli. computeBacktest'i yeniden kullanır.
  async function runCompareReliability(btn) {
    const sym = btn.dataset.sym, mkt = btn.dataset.mkt;
    const cell = btn.parentElement;
    if (!cell) return;
    cell.innerHTML = '<span class="cmp-rel-load">ölçülüyor…</span>';
    try {
      const ck = mkt + ':' + sym;
      let series = vadeCache[ck];
      if (!series) { const d = await fetchYahooOHLC(sym, mkt, '5y', '1d'); series = d.candles; vadeCache[ck] = series; }
      const r = await computeBacktest(series, 'orta');
      if (!r) { cell.innerHTML = '<span class="cmp-rel-na">yetersiz geçmiş</span>'; return; }
      const pct = (x) => x == null ? '—' : Math.round(x * 100) + '%';
      // Düz-Türkçe güvenilirlik hükmü (renderBacktest ile aynı eşikler)
      let cls, verdict;
      if (r.nSamples < 25) { cls = 'cmp-rel-mid'; verdict = 'Az veri'; }
      else if (r.ic >= 0.08 && r.monotonic) { cls = 'cmp-rel-good'; verdict = 'Güvenilir'; }
      else if (r.ic >= 0.03) { cls = 'cmp-rel-good'; verdict = 'Orta güven'; }
      else if (r.ic > -0.03) { cls = 'cmp-rel-mid'; verdict = 'Zayıf öngörü'; }
      else { cls = 'cmp-rel-bad'; verdict = 'İsabetsiz'; }
      cell.innerHTML = `<div class="cmp-rel-res ${cls}" title="Walk-forward doğruluk testi, look-ahead yok · ${r.nSamples} örnek · IC (Spearman) ${r.ic.toFixed(2)}. SAT isabeti: skor SAT (≤45) dediğinde fiyat gerçekten düştü mü (${r.satN || 0} kez). Yön isabeti: skorun genel yön doğruluğu. Geçmiş performans gelecek garantisi değildir.">`
        + `<div class="crr-verdict">${verdict}</div>`
        + `<div class="crr-row"><span>SAT isabeti</span><b>${pct(r.satHit)}</b></div>`
        + `<div class="crr-row"><span>Yön isabeti</span><b>${pct(r.dirHit)}</b></div>`
        + `<div class="crr-n">${r.nSamples} örnek</div></div>`;
    } catch (e) { cell.innerHTML = '<span class="cmp-rel-na">alınamadı</span>'; }
  }

  async function renderCompare() {
    const status = document.getElementById('compareStatus');
    const items = loadCompare();
    paintCompare(); // önce iskelet/mevcut veri
    if (!items.length) { if (status) status.textContent = ''; return; }
    if (status) status.textContent = 'Temel veriler alınıyor…';
    await fetchCompareBatch(items); // eksikleri getir + piyasayı gerekiyorsa düzelt
    paintCompare(); // değerlerle yeniden çiz (loadCompare düzeltilmiş piyasayı okur)
    const cur = loadCompare();
    const metrics = cur.map((it) => { const m = compareMem.get(it.market + ':' + it.symbol); return (m && m.ok) ? m : null; });
    const okN = metrics.filter(Boolean).length;
    if (status) status.textContent = `${cur.length} hisse · ${okN} veri geldi` + (okN < cur.length ? ` · ${cur.length - okN} için temel veri bulunamadı` : '') + ' · değerlendirme hesaplanıyor…';
    // Sistem değerlendirmesi (TA/FA skoru + uygun alım + dürüst not) — her kolon için paralel
    await Promise.all(cur.map((it) => {
      const yM = compareMem.get(it.market + ':' + it.symbol);
      return computeCompareVerdict(it, (yM && yM.ok) ? yM : null);
    }));
    if (loadCompare().length !== cur.length) return; // arada değişti → bırak, yeni render halleder
    paintCompare();
    const vOk = cur.filter((it) => { const v = compareVerdictMem.get(it.market + ':' + it.symbol); return v && v.ok; }).length;
    if (status) status.textContent = `${cur.length} hisse · ${okN} temel veri · ${vOk} değerlendirme hazır`;
  }

  // Kıyaslanan hisseyi listeye ekle / yeni liste oluştur — küçük açılır menü
  function closeListMenu() {
    const ex = document.getElementById('cmpListMenu');
    if (ex) ex.remove();
    document.removeEventListener('click', onDocClickListMenu, true);
  }
  function onDocClickListMenu(e) {
    const menu = document.getElementById('cmpListMenu');
    if (menu && !menu.contains(e.target)) closeListMenu();
  }
  function openListMenu(anchor, sym, mkt, q) {
    if (document.getElementById('cmpListMenu')) { closeListMenu(); return; }
    const menu = document.createElement('div');
    menu.id = 'cmpListMenu';
    menu.className = 'cmp-listmenu';
    const flashLm = (t) => { const m = document.getElementById('cmpLmMsg'); if (m) m.textContent = t; };
    const build = () => {
      const lists = loadLists();
      let h = `<div class="cmp-lm-title">${sym} · listeye ekle</div><div class="cmp-lm-lists">`;
      if (!lists.length) h += '<div class="cmp-lm-empty">Henüz liste yok. Aşağıdan oluştur.</div>';
      lists.forEach((l) => {
        const inIt = l.items.some((i) => i.symbol === sym && i.market === mkt);
        h += `<button class="cmp-lm-item${inIt ? ' in' : ''}" data-id="${l.id}">`
          + `<span class="cmp-lm-check">${inIt ? '✓' : '+'}</span><span class="cmp-lm-name">${l.name}</span></button>`;
      });
      h += '</div><div class="cmp-lm-new"><input id="cmpLmNew" type="text" maxlength="24" placeholder="Yeni liste adı" />'
        + '<button id="cmpLmCreate">Oluştur & ekle</button></div><div id="cmpLmMsg" class="cmp-lm-msg"></div>';
      menu.innerHTML = h;
      // liste satırları → aç/kapat (toggle)
      menu.querySelectorAll('.cmp-lm-item').forEach((b) => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const l = loadLists().find((x) => x.id === id);
        const inIt = l && l.items.some((i) => i.symbol === sym && i.market === mkt);
        let note;
        if (inIt) { listRemoveSymbol(id, sym, mkt); note = 'Listeden çıkarıldı'; }
        else { const r = listAddSymbol(id, sym, mkt, q); note = r.ok ? 'Listeye eklendi' : r.err; }
        build(); flashLm(note);
      }));
      const create = menu.querySelector('#cmpLmCreate');
      const input = menu.querySelector('#cmpLmNew');
      const doCreate = (e) => {
        if (e) e.stopPropagation();
        const nm = (input.value || '').trim();
        if (!nm) { flashLm('Liste adı gir'); input.focus(); return; }
        const id = createList(nm);
        const r = listAddSymbol(id, sym, mkt, q);
        const note = r.ok ? `"${nm}" oluşturuldu & eklendi` : r.err;
        build(); flashLm(note);
      };
      create.addEventListener('click', doCreate);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCreate(e); });
      input.addEventListener('click', (e) => e.stopPropagation());
    };
    build();
    document.body.appendChild(menu);
    // Konumla (butonun altına; ekran kenarını taşırsa hizala)
    const r = anchor.getBoundingClientRect();
    const mw = menu.offsetWidth || 220;
    let left = r.left;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (left < 8) left = 8;
    let top = r.bottom + 6;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - menu.offsetHeight - 6);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    setTimeout(() => document.addEventListener('click', onDocClickListMenu, true), 0);
  }

  function initCompare() {
    if (!compareInited) { compareInited = true; }
    renderCompare();
  }

  // ===== Sekme yönetimi =====
  let generalLoaded = false;
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'calendar') renderCalendar();
      if (btn.dataset.tab === 'news' && !newsCache.length) loadUnifiedNews();
      if (btn.dataset.tab === 'general' && !generalLoaded) { generalLoaded = true; loadGeneral(); }
      if (btn.dataset.tab === 'technical') initTechnical();
      if (btn.dataset.tab === 'fundamental') initFundamental();
      if (btn.dataset.tab === 'opps') initOpportunities();
      if (btn.dataset.tab === 'scan') initScan();
      if (btn.dataset.tab === 'earn') initEarn();
      if (btn.dataset.tab === 'tez') initTez();
      if (btn.dataset.tab === 'sektor') initSektor();
      if (btn.dataset.tab === 'radar') initRadar();
      if (btn.dataset.tab === 'macro') initMacro();
      if (btn.dataset.tab === 'today') initToday();
      if (btn.dataset.tab === 'pulse') initPulse();
      if (btn.dataset.tab === 'compare') initCompare();
      if (btn.dataset.tab === 'lists') initLists();
      if (btn.dataset.tab === 'search') initSearch();
    });
  });

  // ===== Sekme grupları (dropdown: Hisse Senetleri / Kripto / Madenler) =====
  const tabGroups = document.querySelectorAll('.tab-group');
  function closeTabMenus(except) {
    tabGroups.forEach((g) => {
      if (g === except) return;
      const m = g.querySelector('.tab-group-menu'); const b = g.querySelector('.tab-group-btn');
      if (m) m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  tabGroups.forEach((g) => {
    const btn = g.querySelector('.tab-group-btn');
    const menu = g.querySelector('.tab-group-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // İçeriği olmayan menüyü açma (boş kutu / tıklama tuzağı önlenir).
      if (menu.childElementCount === 0) { closeTabMenus(null); return; }
      const willOpen = menu.hidden;
      closeTabMenus(g);
      menu.hidden = !willOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        // Menü fixed konumlu → butonun altına hizala (mobil yatay-kaydırma klibinden kaçar).
        const r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px';
        const mw = menu.offsetWidth || 180;
        let left = r.left;
        if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
        menu.style.left = left + 'px';
      }
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  });
  // Menüyü kapatan TÜM etkileşimler — 'scroll' bazı mobil/iç-kaydırma
  // durumlarında tetiklenmeyebildiği için wheel/touchmove/Escape de dinlenir.
  window.addEventListener('scroll', () => closeTabMenus(null), true);
  window.addEventListener('wheel', () => closeTabMenus(null), { capture: true, passive: true });
  window.addEventListener('touchmove', () => closeTabMenus(null), { capture: true, passive: true });
  window.addEventListener('resize', () => closeTabMenus(null));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTabMenus(null); });
  // Bir alt-sekme seçilince: üst grup butonunu aktif göster + menüleri kapat.
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-group-btn').forEach((b) => b.classList.remove('active'));
      const grp = btn.closest('.tab-group');
      if (grp) { const gb = grp.querySelector('.tab-group-btn'); if (gb) gb.classList.add('active'); }
      closeTabMenus(null);
    });
  });
  document.addEventListener('click', () => closeTabMenus(null));

  // ⓘ bilgi ipuçları — dokunmatik cihazlarda tıkla-aç/kapa (hover yoksa)
  document.addEventListener('click', (e) => {
    const dot = e.target.closest && e.target.closest('.info-dot');
    document.querySelectorAll('.info-dot.open').forEach((d) => { if (d !== dot) d.classList.remove('open'); });
    if (dot) { e.stopPropagation(); dot.classList.toggle('open'); }
  }, true);

  document.querySelectorAll('.chip[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-region]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRegion = btn.dataset.region;
      renderGeneral();
    });
  });

  document.querySelectorAll('.chip[data-pf]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-pf]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pf = btn.dataset.pf;
      document.getElementById('portfolioGridTR').hidden     = pf !== 'TR';
      document.getElementById('portfolioGridUS').hidden     = pf !== 'US';
      document.getElementById('portfolioGridMETALS').hidden = pf !== 'METALS';
      const cg = document.getElementById('portfolioGridCRYPTO');
      if (cg) cg.hidden = pf !== 'CRYPTO';
      const bg = document.getElementById('portfolioGridBASKET');
      if (bg) bg.hidden = pf !== 'BASKET';
      const pc = document.getElementById('portfolioControls');
      if (pc) {
        pc.hidden = !(pf === 'TR' || pf === 'US');
        pc.dataset.market = pf === 'US' ? 'US' : 'BIST';
        const st = document.getElementById('pfAddStatus');
        if (st) { st.textContent = ''; st.className = 'sync-status'; }
      }
      renderPfChangeBar(); // dönem seçici yalnız TR/US'te görünür
      if (pf === 'TR' || pf === 'US') renderPortfolio(pf);
      if (pf === 'METALS') renderMetals();
      if (pf === 'CRYPTO') renderCrypto();
      if (pf === 'BASKET') renderBasket();
    });
  });

  // ALL filtre chip'i için listener (ticker chip'leri loadUnifiedNews içinde bağlanıyor)
  document.querySelector('.chip[data-news-filter="ALL"]').addEventListener('click', (e) => {
    document.querySelectorAll('.chip[data-news-filter]').forEach(b => b.classList.remove('active'));
    e.currentTarget.classList.add('active');
    newsFilterSymbol = 'ALL';
    renderUnifiedNews();
  });

  document.querySelectorAll('.chip[data-news-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-news-type]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      newsFilterType = btn.dataset.newsType;
      renderUnifiedNews();
    });
  });

  // Portföye ekleme — aktif alt sekmeye (Türkiye/Amerika) göre piyasa belirlenir
  const pfInput = document.getElementById('pfInput');
  const pfName = document.getElementById('pfName');
  const pfAddBtn = document.getElementById('pfAdd');
  function doAddPortfolio() {
    const pc = document.getElementById('portfolioControls');
    const market = (pc && pc.dataset.market) || 'BIST';
    const st = document.getElementById('pfAddStatus');
    const code = (pfInput.value || '').trim().toUpperCase();
    const res = addPortfolioSymbol(code, market, pfName.value);
    if (!res.ok) {
      if (st) { st.textContent = res.err; st.className = 'sync-status err'; }
      pfInput.style.borderColor = 'var(--red)';
      setTimeout(() => { pfInput.style.borderColor = ''; }, 1500);
      return;
    }
    if (st) { st.textContent = `${code} (${market}) portföye eklendi ✓ — teknik/temel analiz, haberler ve takvim artık bu sembol için de çalışıyor.`; st.className = 'sync-status ok'; }
    pfInput.value = ''; pfName.value = '';
    onPortfolioChanged(market);
  }
  if (pfAddBtn) pfAddBtn.addEventListener('click', doAddPortfolio);
  if (pfInput) {
    pfInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAddPortfolio(); });
    pfInput.addEventListener('input', () => {
      pfInput.value = pfInput.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
    });
  }


  document.querySelectorAll('.chip[data-cal]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-cal]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showEarnings = btn.dataset.cal === 'earnings';
      document.getElementById('calendarEarnings').hidden = !showEarnings;
      document.getElementById('calendarDividends').hidden = showEarnings;
    });
  });

  // ===== Bildirim modali =====
  const modal = document.getElementById('notifModal');
  document.getElementById('notifBtn').addEventListener('click', () => {
    document.getElementById('topicName').textContent = window.NTFY_TOPIC;
    document.getElementById('topicUrl').textContent  = 'https://ntfy.sh/' + window.NTFY_TOPIC;
    // Nabız bildirim kapsamı kutucuklarını mevcut tercihe göre doldur
    const prefs = loadNotifPrefs();
    document.querySelectorAll('#notifPrefs input[data-np]').forEach((cb) => { cb.checked = !!prefs[cb.dataset.np]; });
    modal.hidden = false;
  });
  document.querySelectorAll('#notifPrefs input[data-np]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const prefs = loadNotifPrefs();
      prefs[cb.dataset.np] = cb.checked;
      saveNotifPrefs(prefs);
    });
  });
  document.getElementById('closeNotif').addEventListener('click', () => modal.hidden = true);
  document.getElementById('copyTopic').addEventListener('click', () => {
    navigator.clipboard.writeText(window.NTFY_TOPIC);
  });
  document.getElementById('enableBrowserNotif').addEventListener('click', async () => {
    if (!('Notification' in window)) {
      alert('Tarayıcın bildirim desteklemiyor.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('Sabah Bülteni', { body: 'Bildirimler aktif.' });
      subscribeToNtfyInPage();
    }
  });

  // ===== Tarayıcı açıkken in-page ntfy aboneliği =====
  function subscribeToNtfyInPage() {
    const url = `https://ntfy.sh/${window.NTFY_TOPIC}/sse`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'message') {
          new Notification(data.title || 'Sabah Bülteni', {
            body: data.message,
            data: { url: data.click },
          });
        }
      } catch (_) {}
    };
    es.onerror = () => { /* otomatik reconnect */ };
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    subscribeToNtfyInPage();
  }

  // ===== İlk açılış: sadece görünür sekmeyi/grid'i yükle (hızlı boot) =====
  async function initialLoad() {
    loadRates(); // arka planda
    applyHiddenTickers(); // gizlenmiş yerleşik göstergeleri uygula
    renderCustomTickers(); // üst şeritteki özel fiyat göstergeleri
    pingYahoo(); // diag için arka planda
    initLists(); // Listeler artık varsayılan (açık) sekme
    document.getElementById('lastUpdated').textContent =
      'Güncellendi: ' + new Date().toLocaleTimeString('tr-TR');
  }

  // ===== Manuel yenile (↻ butonu) — aktif olan ne ise onu tazele =====
  async function refreshAll() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spin');
    kapCache = null; kapPromise = null;
    // Cache'i temizle ki taze veri gelsin
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      });
    } catch (_) {}
    // Tüm grid'leri unutturup yeniden kur
    Object.keys(builtGrids).forEach(k => builtGrids[k] = false);
    try {
      const tasks = [loadRates()];
      // Hangi portföy chip'i aktifse onu render et
      const activePf = document.querySelector('.chip[data-pf].active')?.dataset.pf || 'TR';
      if (activePf === 'TR' || activePf === 'US') tasks.push(renderPortfolio(activePf));
      else if (activePf === 'METALS') tasks.push(Promise.resolve().then(renderMetals));
      // Aktif tab Genel ise onu da
      if (document.getElementById('tab-general').classList.contains('active')) {
        tasks.push(loadGeneral());
      }
      if (document.getElementById('tab-news').classList.contains('active')) {
        newsCache = []; tasks.push(loadUnifiedNews());
      }
      await Promise.all(tasks);
      document.getElementById('lastUpdated').textContent =
        'Güncellendi: ' + new Date().toLocaleTimeString('tr-TR');
    } finally {
      btn.classList.remove('spin');
    }
  }
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);

  // Service worker kaydı + zorla güncelle
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.update();
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw && sw.addEventListener('statechange', () => {
          if (sw.state === 'activated' && navigator.serviceWorker.controller) {
            console.log('SW güncellendi, yeniden yükleniyor…');
            location.reload();
          }
        });
      });
    }).catch(() => { /* sessiz */ });
  }

  // ===== Sepet olay bağlantıları =====
  // Sepet görünümü içindeki "＋" → sepete varlık ekle (miktarlı)
  document.getElementById('basketAddBtn2')?.addEventListener('click', bmOpen);
  // Üst şerit "＋" → fiyat göstergesi iğnele (sepet DEĞİL)
  document.getElementById('basketAddBtn')?.addEventListener('click', tkOpen);
  document.getElementById('tickerModalClose')?.addEventListener('click', tkClose);
  document.getElementById('tkCancel')?.addEventListener('click', tkClose);
  document.getElementById('tickerModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'tickerModal') tkClose();
  });
  document.querySelectorAll('#tkClass .chip').forEach((c) => c.addEventListener('click', () => {
    document.querySelectorAll('#tkClass .chip').forEach((x) => x.classList.toggle('active', x === c));
    tkSetClass(c.dataset.tkcls);
  }));
  document.getElementById('tkAdd')?.addEventListener('click', tkAdd);
  document.getElementById('tkPinned')?.addEventListener('click', (e) => {
    const r = e.target.closest('[data-tkey]'); if (r) { restoreBuiltinTicker(r.getAttribute('data-tkey')); return; }
    const b = e.target.closest('[data-tid]'); if (b) removeTicker(b.getAttribute('data-tid'));
  });
  document.getElementById('tickerBar')?.addEventListener('click', (e) => {
    const x = e.target.closest('.tk-x'); if (!x) return;
    if (x.hasAttribute('data-tkey')) hideBuiltinTicker(x.getAttribute('data-tkey'));
    else if (x.hasAttribute('data-tid')) removeTicker(x.getAttribute('data-tid'));
  });

  document.getElementById('basketModalClose')?.addEventListener('click', bmClose);
  document.getElementById('bmCancel')?.addEventListener('click', bmClose);
  document.getElementById('basketModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'basketModal') bmClose();
  });
  document.querySelectorAll('#bmClass .chip').forEach((c) => {
    c.addEventListener('click', () => bmSetClass(c.dataset.bmcls));
  });
  ['bmPick', 'bmSymbol', 'bmQty'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', bmUpdatePreview);
    if (el) el.addEventListener('change', bmUpdatePreview);
  });
  document.getElementById('bmAdd')?.addEventListener('click', bmAddHolding);

  // Sepet filtre chip'leri
  document.querySelectorAll('#basketFilters .chip').forEach((c) => {
    c.addEventListener('click', () => {
      document.querySelectorAll('#basketFilters .chip').forEach((x) => x.classList.remove('active'));
      c.classList.add('active');
      basketFilter = c.dataset.bfilter;
      renderBasket();
    });
  });
  // Sepetten çıkar (event delegation) + legend'e tıklayınca filtrele
  document.getElementById('basketList')?.addEventListener('click', (e) => {
    const ce = e.target.closest('[data-cash-edit]');
    if (ce) { cashEditById(ce.getAttribute('data-cash-edit')); return; }
    const dv = e.target.closest('[data-div-in]');
    if (dv) { dividendReceived(dv.getAttribute('data-div-in')); return; }
    const fp = e.target.closest('[data-fund-px]');
    if (fp) { fundUpdatePrice(fp.getAttribute('data-fund-px')); return; }
    const rm = e.target.closest('[data-basket-remove]');
    if (rm) removeBasketHolding(rm.getAttribute('data-basket-remove'));
  });
  // Nakit bakiye modali
  document.getElementById('basketCashBtn')?.addEventListener('click', () => cashOpen('TRY'));
  document.getElementById('cashModalClose')?.addEventListener('click', cashClose);
  document.getElementById('cashCancel')?.addEventListener('click', cashClose);
  document.getElementById('cashModal')?.addEventListener('click', (e) => { if (e.target && e.target.id === 'cashModal') cashClose(); });
  document.querySelectorAll('#cashCurChips .chip').forEach((c) => c.addEventListener('click', () => cashSetCur(c.dataset.cashcur)));
  document.querySelectorAll('#cashOpChips .chip').forEach((c) => c.addEventListener('click', () => cashSetOp(c.dataset.cashop)));
  document.getElementById('cashAmt')?.addEventListener('input', cashUpdatePreview);
  document.getElementById('cashSaveBtn')?.addEventListener('click', cashSave);
  document.getElementById('basketLegend')?.addEventListener('click', (e) => {
    const li = e.target.closest('[data-legend]');
    if (!li) return;
    const cls = li.getAttribute('data-legend');
    const chip = document.querySelector('#basketFilters .chip[data-bfilter="' + cls + '"]');
    if (chip) chip.click();
  });
  // Zaman penceresi çipleri
  document.getElementById('basketWindows')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bwin]'); if (!b) return;
    basketWin = b.getAttribute('data-bwin');
    renderBasket();
  });
  // Hamle filtre sekmeleri
  document.getElementById('basketMovesTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mfilter]'); if (!b) return;
    document.querySelectorAll('#basketMovesTabs .chip').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    movesFilter = b.getAttribute('data-mfilter');
    renderBasket();
  });
  // Hamle kaydı sil (delegation)
  document.getElementById('basketMovesList')?.addEventListener('click', (e) => {
    const x = e.target.closest('[data-move-del]'); if (!x) return;
    const id = x.getAttribute('data-move-del');
    const m = loadMoves().find((mm) => mm.id === id);
    const canUndo = m && Object.prototype.hasOwnProperty.call(m, 'before')
      && (m.type === 'buy' || m.type === 'sell' || m.type === 'add' || m.type === 'remove');
    if (canUndo) {
      const label = m.name || m.symbol || 'varlık';
      const ok = window.confirm('«' + label + '» işlemini geri al?\n\nBu varlık, işlemden önceki durumuna döndürülür (miktar ve maliyet geri gelir). Bu varlığı sonradan etkileyen işlemler varsa onlar da geri alınmış olur.');
      if (!ok) return;
      undoMoveEffect(m);
    }
    saveMoves(loadMoves().filter((mm) => mm.id !== id));
    renderBasket();
  });
  // Manuel "İşlem ekle" modali
  document.getElementById('txnAddBtn')?.addEventListener('click', txnOpen);
  document.getElementById('txnModalClose')?.addEventListener('click', txnClose);
  document.getElementById('txnCancel')?.addEventListener('click', txnClose);
  document.getElementById('txnModal')?.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'txnModal') txnClose();
  });
  document.querySelectorAll('#txnTypeChips .chip').forEach((c) => c.addEventListener('click', () => {
    document.querySelectorAll('#txnTypeChips .chip').forEach((x) => x.classList.toggle('active', x === c));
    const t = c.dataset.txntype;
    const hid = document.getElementById('txnType'); if (hid) hid.value = t;
    txnSetType(t);
  }));
  document.querySelectorAll('#txnClass .chip').forEach((c) => c.addEventListener('click', () => txnSetClass(c.dataset.txncls)));
  document.getElementById('txnSaveBtn')?.addEventListener('click', txnSave);

  initialLoad();
  setInterval(loadRates, 5 * 60 * 1000);
  // 15 dk'da bir KAP cache'ini düşür; render fonksiyonları cache-first olduğu için pahalı değil
  setInterval(() => {
    kapCache = null; kapPromise = null;
    // Aktif sekmedeki içeriği nazikçe tazele
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
      });
    } catch (_) {}
    Object.keys(builtGrids).forEach(k => builtGrids[k] = false);
    const activePf = document.querySelector('.chip[data-pf].active')?.dataset.pf || 'TR';
    if (activePf === 'TR' || activePf === 'US') renderPortfolio(activePf);
    if (document.getElementById('tab-general').classList.contains('active')) loadGeneral();
  }, 15 * 60 * 1000);
})();
