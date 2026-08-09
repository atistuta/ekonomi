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
    const ysym = yahooSymbol(symbol, market);
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
      L, price: closes[L], closes,
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

  // Ham göstergeleri 0–100 yönlü alt-skora çevir (50 = nötr, >50 = yükseliş).
  // interp: kısa vadede 'reversal' (aşırı alım = sat), orta/uzun 'momentum'/'trend'.
  function taNormalize(t, interp) {
    const L = t.L, price = t.price;
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const out = {};

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

    // RSI (vadeye göre)
    const r = t.rsi[L];
    if (r == null) out.rsi = null;
    else out.rsi = clamp(interp === 'reversal' ? 50 - (r - 50) * 0.8 : 50 + (r - 50) * 0.9, 3, 97);

    // Stokastik (vadeye göre)
    const kk = t.stoch.k[L], dd = t.stoch.d[L];
    if (kk == null) out.stoch = null;
    else {
      let sc = interp === 'reversal' ? 50 - (kk - 50) * 0.7 : 50 + (kk - 50) * 0.6;
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
  };

  // Ana skorlama: günlük mumlardan vade skorunu üret.
  // daily: günlük mumlar (günlük vadeler için). intraday vadelerde daily yerine
  // tfDataOverride = { H1:[...], M15:[...] } geçilir (backtest'te { H1:slice, M15:null } olabilir).
  function computeVadeScore(daily, vadeKey, tfDataOverride) {
    const cfg = (window.TA_WEIGHTS || {})[vadeKey];
    if (!cfg) return null;
    let tfData;
    if (cfg.intraday) {
      tfData = tfDataOverride;
      if (!tfData) return null;
    } else {
      if (!daily || daily.length < 40) return null;
      tfData = { D: daily, W: resampleCandles(daily, 'W'), M: resampleCandles(daily, 'M') };
    }

    const perTf = {}, adxByTf = {};
    for (const { tf } of cfg.blend) {
      const ind = taTFIndicators(tfData[tf], tf);
      if (!ind) { perTf[tf] = null; continue; }
      perTf[tf] = taNormalize(ind, cfg.interp);
      adxByTf[tf] = ind.adx.adx[ind.L];
    }

    const breakdown = [];
    let devSum = 0, wSum = 0;
    for (const key of Object.keys(cfg.weights)) {
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

    return { score, raw, label, cls, breakdown, adxVal, adxF, cfg,
             levels: { price, target, stop, rr, poc: vpD ? vpD.poc : null, atr, buyZone, sellZone, zMult, sellKind: longHorizon ? 'target' : 'sell', sma50: s50, sma200: s200 } };
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
  }
  function loadHiddenPortfolio() {
    try { const raw = localStorage.getItem(PF_HIDE_KEY); if (raw) return JSON.parse(raw); } catch (_) {}
    return [];
  }
  function saveHiddenPortfolio(list) {
    try { localStorage.setItem(PF_HIDE_KEY, JSON.stringify(list)); } catch (_) {}
  }
  function getPortfolio() {
    const hidden = new Set(loadHiddenPortfolio().map(h => h.market + ':' + h.symbol));
    const map = new Map();
    (window.PORTFOLIO || []).forEach(p => {
      const k = p.market + ':' + p.symbol;
      if (!hidden.has(k)) map.set(k, { ...p, _seed: true }); // varsayılan; gizlenmemişse göster
    });
    loadUserPortfolio().forEach(p => {
      const k = p.market + ':' + p.symbol;
      if (!map.has(k)) map.set(k, { ...p, _user: true });
    });
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
  function saveLists(lists) { try { localStorage.setItem(LISTS_LS_KEY, JSON.stringify(lists)); } catch (_) {} }
  function createList(name) {
    const lists = loadLists();
    const nm = (name || '').trim() || 'Liste ' + (lists.length + 1);
    const id = 'l' + Date.now().toString(36);
    lists.push({ id, name: nm, items: [] });
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
        <div class="sub-title"><span class="dot"></span> Türkiye</div>
        <ul class="news-list" data-role="tr"><li class="loading">Yükleniyor…</li></ul>
        <div class="sub-title"><span class="dot"></span> Dünya</div>
        <ul class="news-list" data-role="world"><li class="loading">Yükleniyor…</li></ul>
      `;
      grid.appendChild(card);

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
  let taIndVis = null;         // indikatör göster/gizle durumu (localStorage'da kalıcı)
  let taInited = false;
  let vadeCache = {}; // symbol:market -> 5y günlük mumlar (skorlama için)
  let intradayCache = {}; // symbol:market -> { H1, M15, ts } gün içi vade için (~5dk taze)
  let taAdhoc = [];   // aramayla açılan, portföy/izlemede olmayan geçici semboller (oturumluk)

  function taAllSymbols() {
    const map = new Map();
    getPortfolio().forEach(p =>
      map.set(p.market + ':' + p.symbol, { symbol: p.symbol, market: p.market, group: 'Portföy' }));
    // Listelerdeki semboller — her biri kendi liste adı altında gruplanır (ilk giren kalır)
    loadLists().forEach(l => {
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
        searchInput.addEventListener('input', () => {
          searchInput.value = searchInput.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
        });
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

  // Aramadan hisse aç: geçici sembol olarak seçici listesine ekle ve analizi yükle.
  function openTaSearch() {
    const inp = document.getElementById('taSearch');
    const mktSel = document.getElementById('taSearchMarket');
    const sel = document.getElementById('taSymbol');
    if (!inp || !sel) return;
    const sym = (inp.value || '').trim().toUpperCase();
    const market = mktSel ? mktSel.value : 'BIST';
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)) {
      inp.style.borderColor = 'var(--red)';
      inp.title = 'Geçersiz hisse kodu.';
      setTimeout(() => { inp.style.borderColor = ''; }, 1500);
      return;
    }
    const key = market + ':' + sym;
    const known = taAllSymbols().some(s => s.market === market && s.symbol === sym);
    if (!known && !taAdhoc.some(s => s.market === market && s.symbol === sym)) {
      taAdhoc.push({ symbol: sym, market });
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
      taShowMsg('Veri alınamadı. Tekrar dene.');
      return;
    }
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
    renderTAIndicators(symbol, market, closes, { ema20, sma50, sma200, boll, rsiArr, macd, adx, stoch, atr, obv, ichi, fib, vprof, oflow });

    const vadeSel = document.getElementById('taVade');
    loadVadeScore(symbol, market, vadeSel ? vadeSel.value : 'orta');
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

  async function loadVadeScore(symbol, market, vade) {
    const panel = document.getElementById('taScorePanel');
    if (!panel) return;
    const btPanel = document.getElementById('taBacktestPanel');
    if (btPanel) btPanel.innerHTML = ''; // sembol/vade değişince eski backtest'i temizle
    panel.innerHTML = '<div class="ta-score-msg loading">Vade skoru hesaplanıyor…</div>';
    const cfg = (window.TA_WEIGHTS || {})[vade];
    let res;
    if (cfg && cfg.intraday) {
      let intr;
      try { intr = await fetchIntradaySeries(symbol, market); }
      catch (e) { panel.innerHTML = '<div class="ta-score-msg empty">Gün içi veri alınamadı.</div>'; return; }
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
          panel.innerHTML = '<div class="ta-score-msg empty">Vade skoru için veri alınamadı.</div>';
          return;
        }
      }
      res = computeVadeScore(daily, vade);
    }
    if (!res) { panel.innerHTML = '<div class="ta-score-msg empty">Bu sembol için yeterli geçmiş veri yok.</div>'; return; }
    renderVadeScore(panel, symbol, market, res);
  }

  function renderVadeScore(panel, symbol, market, res) {
    const curSym = market === 'BIST' ? '₺' : '$';
    const fmtP = (n) => n == null ? '—' : n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    const { score, label, cls, breakdown, adxVal, adxF, cfg, levels } = res;
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
        <div class="ta-score-meta"><b>${cfg.label}</b> · ${cfg.desc} · Karışım: ${blendTxt} · ${adxTxt}${intradayNote}</div>
        <div class="ta-score-brk-head">Gösterge katkıları <span>(alt-skor · nihai skora puan)</span></div>
        <div class="ta-score-brk">${brkHtml}</div>
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

  async function getTaScoreFor(symbol, market, vade) {
    const cfg = (window.TA_WEIGHTS || {})[vade];
    if (!cfg || cfg.intraday) return null; // bileşke günlük vade kullanır (orta)
    const daily = await ensureDailyCandles(symbol, market);
    if (!daily) return null;
    const res = computeVadeScore(daily, vade);
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

  async function fillResultPlan(box, symbol, market, faScore, aliveFn, valuation) {
    if (!box) return;
    const daily = await ensureDailyCandles(symbol, market);
    if (aliveFn && !aliveFn()) return;
    if (!box.isConnected) return;
    if (!daily) { box.innerHTML = spResultNote(); return; }

    const curSym = (valuation && valuation.curSym) || (market === 'BIST' ? '₺' : '$');
    const fmtP = (v) => (v == null || !isFinite(v)) ? '—'
      : curSym + v.toLocaleString('tr-TR', { maximumFractionDigits: v < 10 ? 2 : v < 1000 ? 1 : 0 });

    // --- Bileşke özet (TA orta + FA) ---
    const taMid = computeVadeScore(daily, 'orta');
    let compHTML = '';
    if (taMid) {
      const m = COMPOSITE_MATRIX[faBand(faScore) + ':' + taBand(taMid.score)] || COMPOSITE_MATRIX['mid:mid'];
      const blended = 0.55 * faScore + 0.45 * taMid.score;
      const faCls = faScore >= 60 ? 'bull' : faScore < 45 ? 'bear' : 'neutral';
      compHTML = `
        <div class="rp-summary ${m.band}">
          <div class="rp-verdict">${m.label}</div>
          <div class="rp-legs">
            <span>Temel <b class="${faCls}">${Math.round(faScore)}</b></span>
            <span>Teknik <b class="${taMid.cls}">${Math.round(taMid.score)}</b></span>
            <span>Bileşke <b>${Math.round(blended)}</b>/100</span>
          </div>
          <div class="rp-verdict-txt">${m.txt}</div>
        </div>`;
    }

    // --- Vade kartları: alım/satım bölgeleri + çıkış planı ---
    const cards = PLAN_VADES.map(({ key, label, horizon }) => {
      const res = computeVadeScore(daily, key);
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
      return `
        <div class="rp-card ${res.cls}">
          <div class="rp-card-h">
            <span class="rp-vade">${label} <em>${horizon}</em></span>
            <span class="ta-sig ${res.cls}">${res.label} · ${Math.round(res.score)}</span>
          </div>
          <div class="rp-zones">
            <div class="rp-zone buy"><span class="rp-zl">🟢 Güçlü alış</span><span class="rp-zv">${strongBuy}</span></div>
            ${accumBuy ? `<div class="rp-zone buy2"><span class="rp-zl">🟢 Uygun toplama</span><span class="rp-zv">${accumBuy}</span></div>` : ''}
            <div class="rp-zone sell"><span class="rp-zl">${sellLabel}</span><span class="rp-zv">${sellRange}</span></div>
          </div>
          <div class="rp-plan">
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
        const conf = (taMid && taMid.levels && taMid.levels.price != null && taMid.levels.price <= attractive)
          ? '<span class="rp-conf good">✓ Fiyat cazip değer bölgesinde</span>'
          : (peNow != null && peNow > 25) ? '<span class="rp-conf warn">Değerleme pahalı bölgede</span>' : '';
        valHTML = `
          <div class="rp-val">
            <div class="rp-val-h">🧮 Temel değer bandı <em>(F/K bazlı, kaba)</em> ${conf}</div>
            <div class="rp-val-row"><span>Güçlü değer (F/K ≤ 10)</span><b>≤ ${fmtP(strong)}</b></div>
            <div class="rp-val-row"><span>Cazip (F/K ≤ 15)</span><b>≤ ${fmtP(attractive)}</b></div>
            <div class="rp-val-row"><span>Makul üst sınır (F/K ≈ 18)</span><b>≈ ${fmtP(fair)}</b></div>
            ${pbRow}
            <div class="rp-val-note">Şu an ${peNow != null ? 'F/K ' + peNow.toFixed(1) : 'F/K —'} · HBK ${cs}${valuation.eps.toFixed(2)}. F/K eşikleri sektöre göre değişir — kaba referanstır, teknik bölgelerle örtüşürse güçlü sinyal.${bistCaveat}</div>
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

    box.innerHTML = `
      <div class="rp">
        ${compHTML}
        <div class="rp-cards">${cards || '<div class="empty">Vade bazlı seviye hesaplanamadı.</div>'}</div>
        ${valHTML}
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
      faInited = true;
    }
    loadFundamental();
  }

  async function loadFundamental() {
    const sel = document.getElementById('faSymbol');
    if (!sel || !sel.value) return;
    const [market, symbol] = sel.value.split(':');
    const wrap = document.getElementById('faContent');
    const myReq = ++faReq; // bu yüklemenin jetonu
    wrap.innerHTML = '<div class="loading">Yükleniyor…</div>';
    if (market === 'US') {
      renderFundamentalUS(symbol, wrap, myReq);
    } else {
      renderFundamentalBIST(symbol, wrap, myReq);
    }
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
      renderFaScored(wrap, symbol, 'US', tiles, criteria, 'SEC EDGAR (TTM + son çeyrek)', COMPOSITE_SLOT + stmtSection + disc);
      const full = computeFaScore(criteria);
      if (full.score != null) fillComposite(symbol, 'US', full.score, req);
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
    const rev = g('3C'), gross = g('3D'), op = g('3DF'), da = g('4B'), ocf = g('4C');
    const ca = g('1A'), lta = g('1AK'), cash = g('1AA'), sinv = g('1AB');
    const cl = g('2A'), stDebt = g('2AA'), ltDebt = g('2BA'), eq = g('2N');
    const revenue = P(rev);
    let netProfit = P(g('3L')); if (netProfit == null) netProfit = P(g('3J')); if (netProfit == null) netProfit = P(g('2OCF'));
    const grossP = P(gross), opP = P(op), dep = P(da), operCF = P(ocf);
    const curAssets = P(ca), ltAssets = P(lta), cashV = P(cash) || 0, shInv = P(sinv) || 0;
    const curLiab = P(cl), stFin = P(stDebt) || 0, ltFin = P(ltDebt) || 0, equity = P(eq);
    const totalAssets = (curAssets != null && ltAssets != null) ? curAssets + ltAssets : null;

    const pct = (x) => x == null ? null : x * 100;
    const netMargin = pct(faSD(netProfit, revenue));
    const ebitda = (opP != null && dep != null) ? opP + dep : null;
    const ebitdaMargin = pct(faSD(ebitda, revenue));
    const ocfMargin = pct(faSD(operCF, revenue));
    const grossMargin = pct(faSD(grossP, revenue));
    const currentRatio = faSD(curAssets, curLiab);
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
    if (currentRatio != null) add({ key: 'curRatio', group: 'liquidity', weight: 0.07, label: 'Cari Oran',
      score: faInterp(currentRatio, [[0.7, 12], [1, 45], [1.5, 80], [2, 92], [3, 100]]),
      note: `Cari oran ${currentRatio.toFixed(2)} — kısa vadeli borç karşılama gücü. Checklist eşiği ≥1.5.` });
    // — Kalite & Trend (Piotroski) —
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
      { label: 'Net Marj', val: netMargin == null ? '—' : '%' + netMargin.toFixed(1) },
      { label: 'FAVÖK Marjı', val: ebitdaMargin == null ? '—' : '%' + ebitdaMargin.toFixed(1) },
      { label: 'Özkaynak Kârlılığı', val: roe == null ? '—' : '%' + roe.toFixed(1) },
      { label: 'Cari Oran', val: currentRatio == null ? '—' : currentRatio.toFixed(2) },
      { label: 'Nakit + KV Yatırım', val: fmtTL(cashTotal) },
      { label: 'Finansal Borç (top.)', val: fmtTL(totalFinDebt) },
      { label: 'Net Borç', val: fmtTL(netDebt) },
      { label: 'Özkaynak', val: fmtTL(equity) },
      { label: 'Gelir Büyümesi (YoY)', val: revYoY == null ? '—' : '%' + revYoY.toFixed(1) },
      { label: '3Y Gelir BYBO', val: revCagr == null ? '—' : '%' + revCagr.toFixed(1) },
    ];
    return { tiles, criteria: C, metrics: { netProfit, equity, price } };
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
    return { curSym: '₺', eps, pe, pb, price: metrics.price, mcap, shares, market: 'BIST' };
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
        COMPOSITE_SLOT +
        `<p class="fa-desc">Mali tablolar İş Yatırım'dan (TFRS, ${mali.years[0]} yıllık) çekilir; skor bu kalemlerden hesaplanır. ${valDesc} Yüksek enflasyon ortamında nominal büyüme/ROE rakamları reel performanstan sapabilir.</p>` +
        `<p class="hint ta-disclaimer">Kaynak: <a href="${cardLink}" target="_blank" rel="noopener">İş Yatırım — ${symbol} ↗</a> · Temel analiz uzun vadelidir; teknik analiz ve haber akışıyla birlikte değerlendir. Yatırım tavsiyesi değildir.</p>`;
      renderFaScored(wrap, symbol, 'BIST', tiles, model.criteria, 'İş Yatırım (TFRS)', extra);
      const fa = computeFaScore(model.criteria);
      if (fa.score != null) fillComposite(symbol, 'BIST', fa.score, req);
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
    ], 6);
    const [revA, grossA, niA, opA, daA, ocfA, capexA, assetsA, liabA, eqA, ltdA, ltdcA, cashA, stiA, ppeA, caA, clA, epsA] = arrs;
    // Akış kalemleri: TTM (son 12 ay). Bilanço: en güncel çeyrek (10-Q dahil). "prev" = önceki yıl.
    const revT = secTTM(revA), grossT = secTTM(grossA), niT = secTTM(niA), opT = secTTM(opA),
          daT = secTTM(daA), ocfT = secTTM(ocfA), capexT = secTTM(capexA), epsT = secTTM(epsA);
    const assetsS = secInstSeries(assetsA), eqS = secInstSeries(eqA), caS = secInstSeries(caA), clS = secInstSeries(clA),
          liabS = secInstSeries(liabA), ltdS = secInstSeries(ltdA), ltdcS = secInstSeries(ltdcA),
          cashS = secInstSeries(cashA), stiS = secInstSeries(stiA), ppeS = secInstSeries(ppeA);
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
    if (curRatio != null) add({ key: 'curRatio', group: 'liquidity', weight: 0.07, label: 'Cari Oran',
      score: faInterp(curRatio, [[0.7, 12], [1, 45], [1.5, 80], [2, 92], [3, 100]]),
      note: `Cari oran ${curRatio.toFixed(2)} — kısa vadeli borç karşılama gücü. Checklist eşiği ≥1.5.` });
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
    ];
    const incBasis = (revT && revT.basis) || (niT && niT.basis) || 'TTM';
    const incAsOf = (revT && revT.asOf) || (niT && niT.asOf) || null;
    const fy = incAsOf ? incBasis + ' · ' + fmtDate(incAsOf) : (assetsS[0] ? new Date(assetsS[0].end).getFullYear() : '');
    const bsDate = assetsS[0] ? fmtDate(assetsS[0].end) : '';
    const out = { criteria: C, statementTiles, fy, bsDate, incBasis, incAsOf, metrics: { ni, rev, eps } };
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

  async function renderCalendar() {
    const kapAll = await fetchKAP();
    const portfolio = getPortfolio();
    const bistSymbols = portfolio.filter(p => p.market === 'BIST').map(p => p.symbol);

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
    const usSymbols = portfolio.filter(p => p.market === 'US').map(p => p.symbol);
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
    fillSpNews(symbol, market, query, req);
    fillSpCalendar(symbol, market, req);
    fillSpTa(symbol, market, req);
    fillSpFa(symbol, market, req);
  }
  // Eski çağrı adı — geriye dönük uyumluluk
  const openTickerDetail = openStockPage;

  function renderSpActions(symbol, market, query) {
    const el = document.getElementById('spActions'); if (!el) return;
    const inPf = getPortfolio().some((p) => p.symbol === symbol && p.market === market);
    const lists = loadLists();
    el.innerHTML = `
      <button class="sp-act ${inPf ? 'is-in' : ''}" id="spAddPf" ${inPf ? 'disabled' : ''}>${inPf ? '✓ Portföyde' : '★ Portföye ekle'}</button>
      <div class="sp-listwrap">
        <button class="sp-act" id="spListBtn">＋ Listeye ekle ▾</button>
        <div class="sp-listmenu" id="spListMenu" hidden>
          ${lists.map((l) => `<button class="sp-listitem" data-lid="${l.id}">${escapeHtml(l.name)}${l.items.some((i) => i.symbol === symbol && i.market === market) ? ' <span class="sp-li-in">✓</span>' : ''}</button>`).join('')}
          <button class="sp-listitem sp-newlist" id="spNewList">＋ Yeni liste oluştur</button>
        </div>
      </div>`;
    const pfBtn = el.querySelector('#spAddPf');
    if (pfBtn && !inPf) pfBtn.addEventListener('click', () => {
      const res = addPortfolioSymbol(symbol, market, query);
      if (res && res.ok) { onPortfolioChanged(market); pfBtn.textContent = '✓ Portföyde'; pfBtn.disabled = true; pfBtn.classList.add('is-in'); }
    });
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
          if (eps != null) valuation = { curSym: '$', eps, pe, price };
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
    const rows = l.items.length ? l.items.map((i) => `
      <div class="list-row" data-symbol="${i.symbol}" data-market="${i.market}">
        <span class="lr-sym">${i.symbol} <span class="badge">${i.market}</span></span>
        <span class="lr-price" data-role="price">…</span>
        <span class="lr-chg" data-role="chg">…</span>
        <button class="lr-rm" data-rm title="Listeden çıkar">×</button>
      </div>`).join('') : '<div class="empty">Liste boş — ＋ ile hisse ekle.</div>';
    return `
      <div class="list-block" data-lid="${l.id}">
        <div class="list-head">
          <span class="list-name">${escapeHtml(l.name)}</span>
          <span class="list-count">${l.items.length} hisse</span>
          <span class="list-actions">
            <button class="list-mini" data-act="add" title="Hisse ekle">＋</button>
            <button class="list-mini" data-act="rename" title="Yeniden adlandır">✎</button>
            <button class="list-mini" data-act="delete" title="Listeyi sil">🗑</button>
          </span>
        </div>
        <div class="list-addform" hidden>
          <input class="la-input" type="text" maxlength="10" placeholder="Kod (ör. THYAO)" />
          <select class="la-market"><option value="BIST">BIST</option><option value="US">ABD</option></select>
          <button class="la-add primary-btn">Ekle</button>
        </div>
        <div class="list-periods">${CHANGE_PERIODS.map((p) => `<button class="list-pbtn ${p.key === period ? 'active' : ''}" data-period="${p.key}">${p.label}</button>`).join('')}</div>
        <div class="list-rows">${rows}</div>
      </div>`;
  }

  function fillListRows(block) {
    const lid = block.dataset.lid;
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
  function initSearch() {
    if (!searchInited) {
      const inp = document.getElementById('searchInput');
      const mkt = document.getElementById('searchMarket');
      const btn = document.getElementById('searchBtn');
      const go = () => {
        const s = (inp.value || '').trim().toUpperCase();
        if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) { inp.style.borderColor = 'var(--red)'; setTimeout(() => { inp.style.borderColor = ''; }, 1200); return; }
        rememberSearch(s, mkt.value);
        renderRecentSearches();
        openStockPage(s, mkt.value, s);
      };
      if (btn) btn.addEventListener('click', go);
      if (inp) {
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, ''); });
      }
      searchInited = true;
    }
    renderRecentSearches();
  }

  function renderRecentSearches() {
    const box = document.getElementById('searchResult'); if (!box) return;
    const recent = loadRecentSearches();
    box.innerHTML = `
      <div class="search-hint">Bir hisse/ETF kodu aratın — genel bilgi, gelişmeler, takvim, teknik + temel analiz ve sonucun olduğu sayfası açılır.</div>
      ${recent.length ? `<div class="search-recent-h">Son aramalar</div><div class="search-recent">${recent.map((r) => `<button class="search-chip" data-symbol="${r.symbol}" data-market="${r.market}">${r.symbol} <span class="badge">${r.market}</span></button>`).join('')}</div>` : ''}`;
    box.querySelectorAll('.search-chip').forEach((b) => b.addEventListener('click', () => openStockPage(b.dataset.symbol, b.dataset.market, b.dataset.symbol)));
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
            const r = computeVadeScore(daily, 'orta');
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

    // Öne çıkan sektörlerdeki hisseleri skorla (evrenden)
    const uni = radarUniverse();
    const leadStocks = uni
      .filter((s) => s.sectors.some((x) => ph.sectors.includes(x)))
      .map((s) => {
        const sc = m.taMap[s.market + ':' + s.symbol];
        const sec = s.sectors.find((x) => ph.sectors.includes(x));
        return sc ? { symbol: s.symbol, market: s.market, sec, sc } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.sc.ta - a.sc.ta)
      .slice(0, 8);

    const sectorTags = ph.sectors.map((sec) => `<span class="mac-sec">${SECTORS[sec] || sec}</span>`).join('');
    const stocksHtml = leadStocks.length
      ? leadStocks.map((p) => `<button class="mac-stock ${p.sc.cls}" data-symbol="${p.symbol}" data-market="${p.market}">
          <span class="rs-sym">${p.symbol}<em>${p.market}</em></span>
          <span class="mac-stock-sec">${SECTORS[p.sec] || p.sec}</span>
          <span class="rs-score ${p.sc.cls}">${Math.round(p.sc.ta)}</span>
        </button>`).join('')
      : `<div class="radar-nostock">Öne çıkan sektörlerde izleme evreninde hisse yok. İlgili sektörden hisse ekleyerek rotasyonu takip edebilirsin.</div>`;

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
        <div class="mac-lead-head">📈 Bu fazda öne çıkan sektörler: ${sectorTags}</div>
        <div class="mac-stocks">${stocksHtml}</div>
      </div>
      <div class="mac-chain">🔗 Makro faz <b>${ph.label.split(' / ')[0]}</b> → öne çıkan sektör <b>${SECTORS[ph.sectors[0]]}</b>${leadStocks.length ? ` → evrende en güçlü teknik uyum <b>${leadStocks[0].symbol}</b> (${Math.round(leadStocks[0].sc.ta)}/100)` : ''}.</div>`;

    wrap.querySelectorAll('.mac-stock').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));
    statusEl.textContent = `Konjonktür fazı: ${ph.label} · piyasa genişliği ${Math.round(m.breadth)}/100 · güncellendi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    macroBusy = false;
    macroLast = m;
  }
  let macroLast = null;

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
    if (!listEl) return;
    if (todayBusy) return;
    todayBusy = true;
    statusEl.textContent = 'Makro faz, gündem ve hisseler birleştiriliyor…';

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
    US:   { day: 3.0, hour: 1.8, step: 3.0 },
    BIST: { day: 4.0, hour: 2.5, step: 4.0 },
  };

  function pulseSymbols() {
    const seen = new Set(), out = [];
    const add = (sym, mkt, tag) => { const k = mkt + ':' + sym; if (sym && !seen.has(k)) { seen.add(k); out.push({ symbol: sym, market: mkt, tag }); } };
    (window.WATCHLIST || []).forEach((w) => add(w.symbol, w.market, 'izleme'));
    (window.PORTFOLIO || []).forEach((p) => add(p.symbol, p.market, 'portföy'));
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

  function pulseFireAlert(row) {
    // Gün değişince dedup'ı sıfırla
    const day = new Date().toISOString().slice(0, 10);
    if (day !== pulseAlertDay) { pulseAlertDay = day; Object.keys(pulseAlerted).forEach((k) => delete pulseAlerted[k]); }
    // Bildirim izni yoksa hiçbir şey gönderme ve seviyeyi kaydetme
    // (izin sonradan açılınca aktif sıçrama yine bildirilebilsin).
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    const key = row.market + ':' + row.symbol;
    const th = PULSE_TH[row.market] || PULSE_TH.US;
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
          const { sudden } = pulseIsSudden(a, s.market);
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
    headEl.innerHTML = `<div class="pulse-summary">
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

    listEl.innerHTML = rows.map((r) => {
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
        if (!chips.length) chips.push('<span class="pulse-why none">Sebep bulunamadı — teknik/hacim kaynaklı olabilir</span>');
      }
      const cur = r.market === 'BIST' ? '₺' : '$';
      return `<div class="pulse-row ${cls}" data-symbol="${r.symbol}" data-market="${r.market}">
        <div class="pulse-lead">
          <span class="pulse-sym">${arrow} ${r.symbol} <span class="badge">${r.market}</span> <span class="pulse-tag">${r.tag}</span></span>
          <span class="pulse-chg ${up ? 'up' : 'dn'}">${dayTxt} <em>gün</em> · <span class="pulse-hour">${hourTxt} <em>son 1s</em></span></span>
        </div>
        <div class="pulse-mid">${makeSparkline(r.a.spark, 220, 34)}</div>
        <div class="pulse-price">${cur}${r.a.price != null ? (+r.a.price).toFixed(2) : '—'}</div>
        ${chips.length ? `<div class="pulse-reasons">${chips.join('')}</div>` : ''}
      </div>`;
    }).join('');
    listEl.querySelectorAll('.pulse-row').forEach((el) =>
      el.addEventListener('click', () => openStockPage(el.dataset.symbol, el.dataset.market, el.dataset.symbol)));

    statusEl.textContent = `${rows.length} sembol tarandı · ${movers.length} ani hareket${fired ? ` · ${fired} yeni bildirim` : ''} · ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · 3 dk'da bir yenilenir`;
    pulseBusy = false;
  }

  // ===== Karşılaştır sekmesi (yan yana hisse kıyaslama) =====
  const COMPARE_LS_KEY = 'sb:compare';
  const compareMem = new Map();          // "MARKET:SYMBOL" -> metrics obj (veya {ok:false})
  let compareInited = false;
  let comparePickerOpen = false;

  const YFIN_BASE = (window.MY_PROXY || '').replace(/\/api\/proxy.*$/, '') + '/api/yfin' || '/api/yfin';
  const yahooSym = (symbol, market) => market === 'BIST' ? symbol + '.IS' : symbol;

  function loadCompare() {
    try { const r = JSON.parse(localStorage.getItem(COMPARE_LS_KEY)); if (Array.isArray(r)) return r; } catch (_) {}
    return [];
  }
  function saveCompare(items) { try { localStorage.setItem(COMPARE_LS_KEY, JSON.stringify(items)); } catch (_) {} }

  // Kıyas metrikleri (satırlar). dir: 'low' = düşük iyi, 'high' = yüksek iyi, null = vurgulama yok.
  const COMPARE_ROWS = [
    { key: 'sector',        label: 'Sektör',              type: 'text' },
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
      case 'text':   return v;
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

  function compareAdd(symbol, market, query) {
    symbol = (symbol || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) return { ok: false, err: 'Geçersiz kod.' };
    const items = loadCompare();
    if (items.some((i) => i.symbol === symbol && i.market === market)) return { ok: false, err: 'Zaten ekli.' };
    if (items.length >= 6) return { ok: false, err: 'En fazla 6 hisse.' };
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

  async function renderCompare() {
    const wrap = document.getElementById('compareWrap');
    const status = document.getElementById('compareStatus');
    if (!wrap) return;
    const items = loadCompare();

    // Ekleme paneli tablonun ÜSTÜNde dursun (aşağıda kaybolmasın)
    let head = '<div id="comparePicker" class="compare-picker"></div>';
    // İskelet: sol metrik kolonu + hisse sütunları + "+" ekle kolonu
    head += '<div class="compare-table"><div class="compare-col compare-metric-col"><div class="compare-cell compare-corner">Metrik</div>';
    COMPARE_ROWS.forEach((r) => {
      head += `<div class="compare-cell compare-mlabel"${r.hint ? ` title="${r.hint}"` : ''}>${r.label}</div>`;
    });
    head += '</div>';

    // Sütun başlıkları (yükleme öncesi)
    items.forEach((it) => {
      head += `<div class="compare-col" data-col="${it.market}:${it.symbol}"><div class="compare-cell compare-head">`
        + `<button class="cmp-remove" data-sym="${it.symbol}" data-mkt="${it.market}" title="Kaldır">×</button>`
        + `<span class="cmp-sym">${it.symbol}</span><span class="cmp-mkt">${it.market === 'BIST' ? 'BIST' : 'ABD'}</span></div>`;
      COMPARE_ROWS.forEach(() => { head += '<div class="compare-cell">…</div>'; });
      head += '</div>';
    });
    // Ekle kolonu
    head += '<div class="compare-col compare-add-col"><button id="compareAddBtn" class="compare-add-btn" title="Hisse ekle">＋</button></div>';
    head += '</div>';
    if (!items.length) {
      wrap.innerHTML = '<div class="compare-empty">Kıyaslamak için <b>＋</b> ile hisse ekle. Listelerinden seçebilir ya da kod yazabilirsin.</div>' + head;
    } else {
      wrap.innerHTML = head;
    }

    // Kontrol bağla
    const addBtn = document.getElementById('compareAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => { comparePickerOpen = !comparePickerOpen; renderComparePicker(); });
    wrap.querySelectorAll('.cmp-remove').forEach((b) => b.addEventListener('click', () => {
      compareRemove(b.dataset.sym, b.dataset.mkt); renderCompare();
    }));
    renderComparePicker();

    if (!items.length) { if (status) status.textContent = ''; return; }
    if (status) status.textContent = 'Temel veriler alınıyor…';
    const corrected = await fetchCompareBatch(items);
    if (corrected) { renderCompare(); return; } // piyasa düzeltildi → doğru etiketlerle yeniden çiz

    // Değerleri doldur + satır bazlı en iyi/en kötü vurgula
    const metrics = items.map((it) => { const m = compareMem.get(it.market + ':' + it.symbol); return (m && m.ok) ? m : null; });
    COMPARE_ROWS.forEach((row, ri) => {
      const ext = rowExtrema(row, metrics);
      items.forEach((it, ci) => {
        const col = wrap.querySelector(`.compare-col[data-col="${it.market}:${it.symbol}"]`);
        if (!col) return;
        const cell = col.querySelectorAll('.compare-cell')[ri + 1]; // +1 başlık hücresi
        if (!cell) return;
        cell.textContent = fmtCell(row, metrics[ci]);
        cell.classList.remove('cmp-best', 'cmp-worst');
        if (ext.best === ci) cell.classList.add('cmp-best');
        else if (ext.worst === ci) cell.classList.add('cmp-worst');
      });
    });
    const okN = metrics.filter(Boolean).length;
    if (status) status.textContent = `${items.length} hisse · ${okN} veri geldi` + (okN < items.length ? ` · ${items.length - okN} için temel veri bulunamadı` : '');
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
      if (btn.dataset.tab === 'radar') initRadar();
      if (btn.dataset.tab === 'macro') initMacro();
      if (btn.dataset.tab === 'today') initToday();
      if (btn.dataset.tab === 'pulse') initPulse();
      if (btn.dataset.tab === 'compare') initCompare();
      if (btn.dataset.tab === 'lists') initLists();
      if (btn.dataset.tab === 'search') initSearch();
    });
  });

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
    modal.hidden = false;
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
    pingYahoo(); // diag için arka planda
    await renderPortfolio('TR'); // sadece BIST kartları (cache-first)
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
