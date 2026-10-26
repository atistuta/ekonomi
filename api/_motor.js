// ===========================================================================
//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN
// ===========================================================================
//
//  Kaynak : app.js (dilimlenerek) + tests/engine.mjs (PREAMBLE/SLICES/EXPORTS)
//  Yenile : node tools/motor-uret.mjs
//  Doğrula: node tests/uretim-test.mjs
//
//  Elle yapılan bir değişiklik bir sonraki üretimde SESSİZCE silinir ve
//  üretim testi zaten kırmızı yanar. Motor davranışı değişecekse app.js
//  değişir, sonra bu dosya yeniden üretilir.
//
//  Dilimler (21):
//    util           19 satır
//    ysym            6 satır
//    ta            923 satır
//    fa-core        63 satır
//    fmt            15 satır
//    composite      36 satır
//    holistic      107 satır
//    fa-bist       154 satır
//    fa-us         292 satır
//    causal         68 satır
//    makro-faz      97 satır
//    nabiz-yon      88 satır
//    backtest       99 satır
//    fmt-kisa       11 satır
//    crypto        117 satır
//    metal         100 satır
//    haber-skor     36 satır
//    firsat         40 satır
//    scan           92 satır
//    sektor        216 satır
//    radar          98 satır
//    TOPLAM       2677 satır
//  Dışa verilen sembol: 74
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

export const IMZA = 'sha256:4a212c4e9296ae23';

/** Dilim adı + satır sayısı — app.js okumadan. */
export const DILIMLER = [
  { name: 'util', lines: 19 },
  { name: 'ysym', lines: 6 },
  { name: 'ta', lines: 923 },
  { name: 'fa-core', lines: 63 },
  { name: 'fmt', lines: 15 },
  { name: 'composite', lines: 36 },
  { name: 'holistic', lines: 107 },
  { name: 'fa-bist', lines: 154 },
  { name: 'fa-us', lines: 292 },
  { name: 'causal', lines: 68 },
  { name: 'makro-faz', lines: 97 },
  { name: 'nabiz-yon', lines: 88 },
  { name: 'backtest', lines: 99 },
  { name: 'fmt-kisa', lines: 11 },
  { name: 'crypto', lines: 117 },
  { name: 'metal', lines: 100 },
  { name: 'haber-skor', lines: 36 },
  { name: 'firsat', lines: 40 },
  { name: 'scan', lines: 92 },
  { name: 'sektor', lines: 216 },
  { name: 'radar', lines: 98 },
];

/**
 * Motoru kur ve sembollerini döndür.
 *
 * @param {object} H konak kabuğu. Motor bunları yalnız ÇAĞIRIR, içeriğini
 *   bilmez — aynı motor bu yüzden testte fikstürle, sunucuda gerçek ağla
 *   koşabiliyor. Gerekenler:
 *     H.window        → { TA_WEIGHTS, TA_BENCHMARK, MY_PROXY }
 *                        MY_PROXY BOŞ OLAMAZ: secGet `if (!base) return null`.
 *     H.localStorage  → { getItem, setItem }  (gösterge aç/kapa)
 *     H.fetch         → ağ kabuğu (fetchYahooOHLC + secGet kullanır)
 *     H.fetchVia      → İş Yatırım metin kabuğu
 *     H.dead(ad)      → erişilirse adıyla patlayan vekil (document/navigator)
 */
export function buildMotor(H) {
"use strict";
// --- konak kabukları: motor bunları yalnız ÇAĞIRIR, içeriğini bilmez ---
const window = H.window;
const localStorage = H.localStorage;
const fetch = (...a) => H.fetch(...a);
const fetchVia = (...a) => H.fetchVia(...a);
const proxy = (url) => url;              // Node'da CORS yok → vekil gereksiz
const setDiag = () => {};                // tanı rozetleri ekrana aittir
const document = H.dead("document");     // erişilirse adıyla patlar
const navigator = H.dead("navigator");
// ===== dilim: util =====
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


// ===== dilim: ysym =====
  function yahooSymbol(symbol, market) {
    if (market === 'BIST') return symbol + '.IS';
    return symbol;
  }


// ===== dilim: ta =====
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
    // ÖLÇÜLEMEYEN göstergeler: kullanıcının KAPATTIKLARI değil, verisi yetmediği için
    // hesaplanamayanlar. Ayrım önemli — "kapalı" bir tercih, "ölçülemedi" bir eksiklik.
    // Ölçüldü (AAPL fikstürü, orta vade): 40 barda 6/9 gösterge, 107 barda 8/9, 200 barda
    // 9/9 çıkıyor. Motor eksik göstergeyi atlayıp KALANLAR üzerinden yeniden normalize
    // ediyor (wSum), yani skor üretiliyor ama dar bir tabandan — aynı veride 107 bar 61,6
    // "AL eğilimi" verirken tam geçmiş 67,0 "GÜÇLÜ AL" veriyor. Skor DEĞİŞMİYOR; yalnız
    // bu eksiklik artık rapor ediliyor ki ekran dürüst davranabilsin.
    const eksikGosterge = [];
    let devSum = 0, wSum = 0;
    for (const key of Object.keys(cfg.weights)) {
      if (taScoreIndVis && taScoreIndVis[key] === false) continue; // kullanıcı bu göstergeyi kapatmış
      let s = 0, tw = 0;
      for (const { tf, w } of cfg.blend) {
        const p = perTf[tf]; if (!p) continue;
        const v = p[key]; if (v == null) continue;
        s += v * w; tw += w;
      }
      if (tw === 0) { eksikGosterge.push({ key, label: TA_KEY_LABEL[key] || key, weight: cfg.weights[key] }); continue; }
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
    // GEÇMİŞ YETERLİLİĞİ — skora dokunmaz, yalnız rapordur. `bar` = motorun gerçekten
    // gördüğü mum sayısı; `eksik` = verisi yetmediği için hesaplanamayan göstergeler.
    // `yeterli` false ise skor dar bir gösterge tabanından geliyor demektir (yeni halka
    // arzlar: SMA200 için 200, TTM sıkışması için ~200 bar gerekir).
    const barSayisi = cfg.intraday
      ? ((tfData[cfg.blend[0].tf] || []).length)
      : (daily ? daily.length : 0);
    // EŞİK neden 250: SMA200 ilk değerini 200. barda verir, kıyas gücü (rs) en uzun
    // 126 günlük bakışı kullanır. 250 bar (≈1 yıl) altında bu iki gösterge ya hiç yok ya
    // da tek-iki örneklik. Ölçüldü (AAPL + ^GSPC fikstürü, orta vade): 107 barda yalnız
    // 1 gösterge (%5) DÜŞÜYOR ama skor 60,7 ↔ tam geçmişte 66,5 — yani sapmanın büyüğü
    // eksik göstergeden değil, ÖLÇÜLEN göstergelerin sığ geçmiş üzerinde hesaplanmasından
    // geliyor. Bu yüzden uyarı yalnız "eksik var mı"ya değil, bar sayısına da bakar.
    const GECMIS_YETER_BAR = 250;
    const gecmis = {
      bar: barSayisi,
      eksik: eksikGosterge,
      olculen: breakdown.length,
      yeterli: eksikGosterge.length === 0,
      // `kisa`: gün içi vadeler hariç — onların bar birimi gün değil.
      kisa: !cfg.intraday && barSayisi < GECMIS_YETER_BAR,
      yeterBar: GECMIS_YETER_BAR,
    };
    return { score, raw, label, cls, breakdown, adxVal, adxF, cfg, regime, gecmis,
             levels: { price, target, stop, rr, poc: vpD ? vpD.poc : null, atr, buyZone, sellZone, zMult, sellKind: longHorizon ? 'target' : 'sell', sma50: s50, sma200: s200, anchorKind, anchorSrc } };
  }

  // ===== PLAN KATMANI: momentum rejimi · banda yakınlık · risk/ödül =====
  //
  //  NE: computeVadeScore'un döndürdüğü `levels` üzerinde çalışan ÜÇ SAF hesap.
  //  Hiçbiri skoru DEĞİŞTİRMEZ — "bu skorun fiyat planı şu an nerede duruyor"
  //  sorusunu SAYIYLA cevaplar.
  //
  //  NEDEN BURAYA TAŞINDI (2026-10-14): üçü de ekran katmanındaydı — momentumInfo
  //  ve buyZoneProximity app.js'in sunum bölgesinde (eski satır 4875 / 4909),
  //  risk/ödül çekirdeği ise computeCompareVerdict'in İÇİNDE gömülüydü. Motor
  //  seviyeleri üretiyor ama PLANI üretmiyordu; yani /api/recommend kullanıcının
  //  GÖRDÜĞÜ planı döndüremezdi. Commit C'nin kalıbı: SAYI motora iner, CÜMLE
  //  çağrı noktasında kalır.
  //
  //  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI §5.1): buradan çıkan hiçbir alan
  //  biçimlenmiş metin değildir — emoji yok, toFixed yok, para birimi yok, Intl
  //  yok. Sabit kümeli etiketler (state / cls / brkKind / sellKind) kuraldan
  //  muaftır: bunlar makine kodu, cümle değil — motorun mevcut `cls` ve `label`
  //  alanlarıyla aynı cins.
  //
  //  NEDEN BOŞ-DEĞER DAVRANIŞI ÜÇÜNDE AYRI (bilerek seçildi):
  //    momentumInfo     → `{ active: false }` döner, null DEĞİL.
  //    buyZoneProximity → null döner.
  //    planRiskReward   → yalnız `levels` yoksa null; aksi halde alanları null
  //                       olabilen NESNE döner.
  //  Sebep: momentumInfo'nun ALTI çağrı noktası da doğrudan `mom.active` okuyor —
  //  null dönseydi her biri ayrıca `mom &&` kapısı yazmak zorunda kalırdı ve biri
  //  unutulunca ekran patlardı; üstelik "rejim yok" ile "ölçemedim" ayrımı burada
  //  gereksiz: ikisinde de momentum girişi önerilmez, kullanıcıya giden cevap aynı.
  //  buyZoneProximity'nin çağrı noktaları zaten `prox ? … : ''` kapısıyla yazılmış:
  //  null = "gösterilecek bir şey yok" ve kapı hazır. planRiskReward ise UCA
  //  gidiyor; orada `brkPct: null` ile alanın HİÇ OLMAMASI aynı şey değildir —
  //  ilki "ölçtüm, cevap yok", ikincisi "eski sözleşme / alan kaldırılmış" diye
  //  okunur. İstemci bu ayrımı görebilsin diye alan DAİMA var, değeri null olur.
  //  Koruma ÇAĞIRANA ait (faPeCriterion'daki gerekçenin aynısı).
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

  // ===== Alım bölgesine anlık YAKINLIK (ham sayı: ATR cinsinden uzaklık) =====
  // Alım bandı bilinçli olarak fiyatın ALTINDAKİ desteğe çapalanır ("ideal bekleme"
  // noktası). Bu yüzden "fiyat ŞU AN bandın içinde mi?" neredeyse hiçbir zaman doğru
  // çıkmaz — kullanıcı onlarca hisse tarasa da yalnız ⚡ momentum işaretini görür.
  // Bu fonksiyon SKORU/BANDI DEĞİŞTİRMEZ; sadece mevcut fiyatın banda ATR-ölçekli
  // uzaklığını dürüstçe sınıflar ki "şu an neredeyiz" okunabilsin:
  //   in/below → fiyat bandın içinde/altında (ideal alım / hedeften ucuz)
  //   near     → banda ≤1×ATR mesafede — normal bir geri çekilmede alım aralığına iner
  //   far      → banda >1×ATR uzakta — belirgin geri çekilme gerekir (ya da güçlü trend)
  // Türkçe cümle BURADA DEĞİL: eski `txt` alanı sunum katmanındaki
  // buyZoneProximityHtml(prox)'a geçti — emoji + toFixed motora giremez.
  function buyZoneProximity(res) {
    if (!res || !res.levels) return null;
    const L = res.levels, p = L.price, bz = L.buyZone;
    if (p == null || !bz || bz[0] == null || bz[1] == null) return null;
    const atr = (L.atr != null && L.atr > 0) ? L.atr : p * 0.02;
    const buyLo = bz[0], buyHi = bz[1];
    const dAtr = (p - buyHi) / atr; // fiyat bandın kaç ATR üstünde
    if (p <= buyHi * 1.001) return { state: p < buyLo * 0.999 ? 'below' : 'in', cls: 'in', dAtr };
    if (dAtr <= 1.0) return { state: 'near', cls: 'near', dAtr };
    return { state: 'far', cls: 'far', dAtr };
  }

  // ===== Risk/Ödül çekirdeği: kâr-al mesafesi ÷ negatif-kırılma mesafesi =====
  // Kâr-al / satış bölgesi — zaten hesaplı sellZone (direnç/hedef + ATR bandı). Kesin
  // tepe değil; momentumun tarihsel olarak yorulduğu bölge. sellKind: 'target' (uzun
  // ufuk) | 'sell'.
  // Negatif kırılma (DENGELİ confluence): fiyatın altındaki en YAKIN yapısal destek
  // (SMA50 / swing-low çapası) = ilk savunma; SMA200 = ana trend çizgisi; 2×ATR stop =
  // risk çıkışı. Bu bir tahmin DEĞİL, koşullu tetikleyicidir: "bu seviye altına
  // kapanış olursa trend bozulur".
  // brkKind SABİT KÜME: 'sma50' | 'swingLow' | 'sma200' | 'atrStop' | null — serbest
  // metin değil, çünkü istemci (web + native) buna göre kendi cümlesini kurar.
  // EŞİTLİK KURALI: iki kat aynı seviyedeyse KATLAR dizisindeki İLK sıra kazanır
  // (sma50 → swingLow → sma200). Eski Math.max kopyası aynı SAYIYI üretirdi ama hangi
  // katın kazandığını söylemiyordu; etiket bu yüzden yeni, sayı değil.
  // Risk/Ödül oranı = kâr-al mesafesi (yukarı %) ÷ negatif-kırılma mesafesi (aşağı %)
  // = "1 birim risk için kaç birim ödül". Yüksek = asimetrik; <1 = risk ödülden büyük.
  // NOT: Sadece MESAFE oranıdır, OLASILIK DEĞİL — dar stop yüksek oran verir ama erken
  // stoplanma ihtimali de yüksektir; momentum + geçmiş isabet ile birlikte okunmalı.
  function planRiskReward(levels) {
    if (!levels) return null;
    const L = levels, px = L.price, bz = L.buyZone, sz = L.sellZone;
    let sellUpPct = null;
    if (sz && sz[0] != null && sz[1] != null && sz[1] > sz[0]) { if (px) sellUpPct = (((sz[0] + sz[1]) / 2) / px - 1) * 100; }
    else if (sz && sz[1] != null) { if (px) sellUpPct = (sz[1] / px - 1) * 100; }
    const KATLAR = [['sma50', L.sma50], ['swingLow', bz && bz[0]], ['sma200', L.sma200]];
    let brkPrimary = null, brkKind = null;
    for (let i = 0; i < KATLAR.length; i++) {
      const kind = KATLAR[i][0], v = KATLAR[i][1];
      if (v == null || !(v < px * 0.999)) continue;
      if (brkPrimary == null || v > brkPrimary) { brkPrimary = v; brkKind = kind; }
    }
    const atrStop = (L.stop != null && L.stop < px) ? L.stop : null;
    if (brkPrimary == null && atrStop != null) { brkPrimary = atrStop; brkKind = 'atrStop'; }
    const brkMajor = (L.sma200 != null && L.sma200 < px && (brkPrimary == null || L.sma200 < brkPrimary - 1e-9)) ? L.sma200 : null;
    const brkPct = (brkPrimary != null && px) ? ((brkPrimary / px - 1) * 100) : null;
    const rrRatio = (sellUpPct != null && brkPct != null && brkPct < 0 && Math.abs(brkPct) > 0.01)
      ? sellUpPct / Math.abs(brkPct) : null;
    return { sellUpPct, sellKind: L.sellKind || 'sell', brkPrimary, brkKind, brkPct, brkMajor, atrStop, rrRatio };
  }

  // ===== Sıralı Destek/Direnç Bölgeleri (Ranked S/R Zones — Zeiierman uyarlaması) =====
  // Yaklaşım: pivot tepe/dipleri bul → fiyatça yakın pivotları tek bir "bölgeye" kümele →
  // her bölgeyi DOKUNUŞ sayısı (birincil güç) + hacim + tazelik ile sırala. Fiyatın çok
  // test ettiği alanlar en güçlü destek/direnç olarak öne çıkar. SADECE BİLGİ; vade skoruna
  // DAHİL DEĞİLDİR — yalnız "nerede güçlü seviyeler var" bilgisidir, yön/tavsiye değildir.

// ===== dilim: fa-core =====
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
  // ===== F/K “Değerleme” kriteri — ekran katmanından motora devredildi =====
  //
  //  NE: ABD/ADR temel skorunda kriter listesine eklenen değerleme kalemi.
  //  pe = canlı fiyat / TTM HBK; skor = pe<0 ? FA_PE.neg : faInterp(pe, FA_PE.bp).
  //
  //  NEDEN BURAYA TAŞINDI (2026-10-14): bu kriter ÜÇ EKRAN KOPYASIYDI
  //  (renderFundamentalUS, fillSpFa, faModelFor). Motor FA skorunu döndürürken
  //  kriteri bilmiyordu — yani motorun döndürdüğü skor ile kullanıcının
  //  GÖRDÜĞÜ skor aynı sayı değildi. /api/score o boşluğu geçici bir
  //  api/_ekran.js taşıyıcısıyla kapatıyordu; kriter motora girdiği gün o
  //  taşıyıcı gereksizleşti ve SİLİNDİ.
  //
  //  NEDEN BOŞ-DEĞER KORUMASI YOK: pe null/NaN ise kriter YİNE eklenir ve
  //  skoru null olur. computeFaScore null skoru ortalamaya katmaz ama `total`ı
  //  artırır — ekrandaki “present/total” dürüstlüğü buna dayanır. Buraya
  //  “pe yoksa ekleme” koruması koymak totalı sessizce düşürür ve eksik veriyi
  //  görünmez yapar. Koruma ÇAĞIRANA ait: üç çağrı yeri de
  //  `if (price != null && eps)` kapısının içinde duruyor.
  //
  //  BİST'te bu ek YOKTUR — orada kriterler mali tablodan kuruluyor.
  const FA_PE = {
    weight: 0.10,
    neg: 15,
    bp: [[5, 90], [10, 80], [15, 70], [20, 60], [25, 52], [35, 38], [50, 22], [80, 10]],
  };
  /**
   * F/K kriter nesnesi. `note` ÇAĞIRANA ait — üç ekranın cümlesi farklı,
   * SKORU aynı; ayrışabilen tek şey metin olsun diye dışarda bırakıldı.
   */
  function faPeCriterion(pe, note) {
    return {
      key: 'pe', group: 'valuation', weight: FA_PE.weight, label: 'Değerleme (F/K)',
      score: pe < 0 ? FA_PE.neg : faInterp(pe, FA_PE.bp),
      note: note || '',
    };
  }


// ===== dilim: fmt =====
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

// ===== dilim: composite =====
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

  // ===== FA/TA harmanı — ekran katmanından motora devredildi =====
  //
  //  NE: bileşke rozetinin altında gösterilen tek sayı.
  //      blended = COMPOSITE_BLEND.fa * faScore + COMPOSITE_BLEND.ta * taScore
  //
  //  NEDEN BURAYA TAŞINDI (2026-10-14): harman ÜÇ EKRAN KOPYASIYDI
  //  (fillCompositeInto, hisse sayfası, Sonuç planı). Üç kopya = ağırlık
  //  birinde değişirse diğer ikisi sessizce eski kalır; /api/score ise
  //  hiçbirini bilmezdi. Artık tek tanım var ve motor onu dışa veriyor.
  //
  //  AĞIRLIK NEDEN 0.55/0.45: temel bir tık ağır — teknik hızlı değişir,
  //  temel yavaş. Bu bir TERCİH, ölçülmüş bir optimum değil; değiştirmek
  //  istenirse tek yer burası ve parite testi farkı anında gösterir.
  //
  //  COMPOSITE_MATRIX ile KARIŞTIRMAYIN: matris 3×3 konumlandırma (bant +
  //  cümle), bu ise tek sayılık harman. İkisi birbirinin yerine geçmez.
  const COMPOSITE_BLEND = { fa: 0.55, ta: 0.45 };
  function compositeBlend(faScore, taScore) {
    return COMPOSITE_BLEND.fa * faScore + COMPOSITE_BLEND.ta * taScore;
  }


// ===== dilim: holistic =====
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

// ===== dilim: fa-bist =====
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
    // Atahan Notları için çok-yıllık gelir/kâr serisi (İş Yatırım tek çağrı = en güncel 4 yıl).
    // Net kâr her dönem için 3L→3J→2OCF sırasıyla; boşsa null. Yıllar en güncel önce.
    const netSeries = [0, 1, 2, 3].map((i) => {
      let v = P(g('3L'), i); if (v == null) v = P(g('3J'), i); if (v == null) v = P(g('2OCF'), i); return v;
    });
    const income = { years: mali.years.slice(), rev: rev.slice(), net: netSeries, currency: '₺', period: 'yıllık (İş Yatırım)' };
    return { tiles, criteria: C, income, statementTiles: tiles, incPeriod: mali.years[0] + ' yıllık',
             metrics: { netProfit, equity, price, freeCF, netDebt, totalDebt: totalFinDebt, ebitda, revCagr, revYoY } };
  }

  // İş Yatırım şirket kartından piyasa değerini (mnTL) çeker → TL. Sonuç değer bandı için
  // pay sayısı = piyasa değeri / fiyat türetilir (nominal ödenmiş sermayeyle örtüşür, par 1₺).

// ===== dilim: fa-us =====
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
    // Atahan Notları — çok yıllık gelir/net kâr serisi (yıllık 10-K, en güncel önce, 5 yıla kadar)
    const niAnnuals = secAnnualsList(niA);
    const yrOf = (e) => e ? new Date(e.end).getFullYear() : null;
    const incYears = revAnnuals.slice(0, 5).map(yrOf);
    const income = { years: incYears, rev: revAnnuals.slice(0, 5).map((e) => e ? e.val : null),
      net: incYears.map((yr) => { const m = niAnnuals.find((e) => yrOf(e) === yr); return m ? m.val : null; }),
      currency: '$', period: 'yıllık (10-K)' };

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
    const out = { criteria: C, statementTiles, income, incPeriod: fy, fy, bsDate, incBasis, incAsOf, metrics: { ni, rev, eps, fcf, netDebt, totalDebt, ebitda, revCagr, revYoY } };
    secModelCache[symbol] = out;
    return out;
  }


// ===== dilim: causal =====
  const CAUSAL_INDEX_AFFINITY = {
    equity_tech: ['tech', 'semis', 'ai', 'software', 'internet', 'cloud', 'crypto'],
    equity_us:   ['tech', 'semis', 'banks', 'energy', 'industrials', 'health', 'biotech', 'consumer', 'staples', 'defense', 'auto', 'software', 'materials'],
    equity_tr:   ['banks', 'holding', 'industrials', 'energy', 'retail', 'staples', 'steel', 'airline', 'defense', 'materials'],
    gold:        ['gold', 'safe', 'rates', 'inflation'],
  };

  // Faz B kapısı — ANTHROPIC_API_KEY gelince api/explain.js üzerinden doğal-dil yorum.
  // Şimdilik kapalı: anahtar yokken Faz A (deterministik) tek başına çalışır.
  const CAUSAL_LLM = { enabled: false, endpoint: '/api/explain' };

  // Bir endeks hareketi ile bir gündem konsepti arasındaki hizalanmayı (olası ilişki gücü) ölç.
  // Hizalı = konsept, endeksin yakın sektörlerini hareket yönünde itiyor VE risk tonu uyumlu.
  function causalAlign(cfg, pct, concept) {
    const aff = CAUSAL_INDEX_AFFINITY[cfg.kind] || [];
    const up = pct > 0;
    let score = 0;
    const why = [];
    // 1) Sektör yönü hizası: konsept yakın sektörleri yukarı itiyorsa + endeks yukarıysa → hizalı.
    let secMatch = 0, secOpp = 0, matchedSecs = [];
    (concept.sectors || []).forEach(([sec, dir]) => {
      if (!aff.includes(sec)) return;
      if ((dir === 'up') === up) { secMatch++; matchedSecs.push(sec); }
      else secOpp++;
    });
    if (secMatch) { score += 2 * secMatch; }
    if (secOpp) { score -= 1.2 * secOpp; }
    // 2) Risk tonu hizası (hisse: risk-on↑ / risk-off↓; altın: risk-off↑).
    if (cfg.kind === 'gold') {
      if (concept.risk === 'off' && up) { score += 1.6; why.push('riskten kaçış'); }
      if (concept.risk === 'on' && !up) { score += 1.0; }
    } else {
      if (concept.risk === 'on' && up) { score += 1.4; why.push('risk iştahı'); }
      if (concept.risk === 'off' && !up) { score += 1.4; why.push('riskten kaçış'); }
      if (concept.risk === 'on' && !up) { score -= 0.8; }
      if (concept.risk === 'off' && up) { score -= 0.8; }
    }
    // 3) Haber tonu hareket yönüyle aynı mı (pozitif ton + yükseliş).
    if (concept.tone != null) {
      if ((concept.tone > 0.12) === up && Math.abs(concept.tone) > 0.12) score += 0.6;
    }
    // 4) Isı & tazelik ağırlığı — sıcak ve yeni gündem daha güçlü tetikleyicidir.
    const heatW = concept.heat === 'hot' ? 1.4 : concept.heat === 'warm' ? 1.0 : 0.5;
    const freshH = (concept.heads && concept.heads.length) ? Math.min(...concept.heads.map((h) => h.ageH)) : 48;
    const freshW = freshH <= 12 ? 1.2 : freshH <= 24 ? 1.0 : freshH <= 48 ? 0.75 : 0.5;
    score *= heatW * freshW;
    return { score, matchedSecs, why };
  }

  // Belirgin hareket eden her endeks için en iyi hizalanan 1-2 gündem konseptini bul.
  function computeCausalLinks(ag, rows, m) {
    if (!ag || !ag.items || !ag.items.length || !rows) return [];
    // Yalnız "belirgin" (notable eşiğini aşan) endeks hareketleri nedensellik adayıdır.
    const moved = rows.filter((r) => r.pct != null && Math.abs(r.pct) >= r.cfg.notable)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    if (!moved.length) return [];
    return moved.map((r) => {
      const scored = ag.items.map((concept) => {
        const a = causalAlign(r.cfg, r.pct, concept);
        return { concept, ...a };
      }).filter((x) => x.score >= 1.6) // yalnız anlamlı hizalar (gürültü eşiği)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);
      return { cfg: r.cfg, pct: r.pct, links: scored };
    }).filter((x) => x.links.length); // haberle eşleşmeyen hareketleri çıkar (dürüstlük)
  }


// ===== dilim: makro-faz =====
  const CYCLE_PHASES = {
    early: { label: 'Erken Döngü / Toparlanma', emoji: '🌱', cls: 'early', sectors: ['banks', 'auto', 'tech'],
      desc: 'Faizler geriliyor, risk iştahı toparlanıyor. Faize duyarlı ve büyüme hisseleri öne çıkar.' },
    mid: { label: 'Orta Döngü / Genişleme', emoji: '🚀', cls: 'mid', sectors: ['tech', 'industrials', 'semis', 'software'],
      desc: 'Büyüme güçlü, koşullar dengeli. Teknoloji, yazılım, sanayi ve çip liderlik eder.' },
    late: { label: 'Geç Döngü / Aşırı Isınma', emoji: '🔥', cls: 'late', sectors: ['energy', 'industrials', 'gold', 'materials'],
      desc: 'Enflasyon/emtia baskısı ve para sıkılaşması. Enerji, metal/madencilik ve reel varlıklar korunaklı olur.' },
    recession: { label: 'Durgunluk / Risk-off', emoji: '🛡️', cls: 'recession', sectors: ['utilities', 'staples', 'gold'],
      desc: 'Büyüme zayıf, güvenli liman talebi yüksek. Savunmacı sektörler ve altın öne çıkar.' },
  };

  // ===== ⚖️ Yön oyunun OLUMSUZLANMASI — web geri dönüşünden düzeltme (2026-10-14) =====
  // ÖLÇÜLEN HATA: rateDirection yalnız "rate cut"/"faiz indirimi" ifadesinin
  // GEÇİP geçmediğine bakıyordu — o ifadeye NE YAPILDIĞINA bakmıyordu. Sıcak
  // TÜFE günü (2026-10-14) manşetleri tam olarak "faiz indirimi umudu ÖLDÜ"
  // biçiminde olduğu için beş manşetin BEŞİ de güvercin oyu sayıldı:
  //   rateDir = -0,833 · inflDir = +0,500 · pressure = -0,300 → "🕊️ Gevşeme"
  // yani piyasa çakılırken sistem güvercin rüzgârı ilan ediyordu.
  //
  // ÇÖZÜM: ifadenin ÇEVRESİNDEKİ fiili oku; umut/beklenti ÖLÜYORSA oyu TERS
  // çevir. Asimetri İKİ YÖNLÜ kapatılır — "rate hike fears fade" de artık
  // şahin değil GÜVERCİN sayılır; tek yönlü düzeltme yeni bir yanlılık üretirdi.
  //
  // NEDEN REGEX, NEDEN LLM DEĞİL: bu katman ANAHTARSIZ çalışmak zorunda
  // (CAUSAL_LLM.enabled = false, ANTHROPIC_API_KEY yok). LLM çağrısı eklenmedi.
  // (Bilgi amaçlı sunum katmanı; TA/FA/bileşke skoruna DAHİL DEĞİL.)
  const FADE_WIN = 72; // ifadenin İKİ yanında taranan karakter sayısı (fiil önde de olabilir, arkada da)

  // Tek başına "umut ölüyor" demeye yeten fiiller/kalıplar (EN). Kısa ve
  // başka sözcüklerin içinde geçebilecek olanlara sözcük sınırı konuldu.
  const FADE_HARD = /(dash(?:e[sd])?|dampen|\bdim(?:s|med|ming)?\b|fad(?:e|es|ed|ing)\b|collaps(?:e|es|ed|ing)|evaporat|off[- ]the[- ]table|rul(?:e|es|ed|ing) out|ruled out|less likely|\bunlikely\b|\bdoubts?\b|in doubt|cast doubt|delay(?:s|ed|ing)?\b|push(?:es|ed|ing)? back|pushback|\bretreat|scal(?:e|es|ed)? back|par(?:e|es|ed) back|abandon|shelv(?:e|es|ed)\b|no longer|dwindl|\bwan(?:e|es|ing)\b|vanish|wip(?:e|es|ed) out|eras(?:e|es|ed)\b|\bkill(?:s|ed)?\b|\bdead\b|walk(?:s|ed)? back)/i;

  // ÇİFT ANLAMLI fiiller: "slash RATES" = indirim (güvercin), "slash BETS" =
  // beklentinin ölümü (şahin). Bu yüzden yalnız bir BEKLENTİ nesnesiyle
  // birlikte olumsuzlama sayılır — yoksa gerçek indirim haberlerini ters çevirirdik.
  const FADE_SOFT = /\b(slash|cut back|cutting back|trim|reduc|lower|pull back|par(?:e|ing)|dial back|scrap)\w*\s+(?:\w+\s+){0,3}(bets?|odds|expectations?|hopes?|wagers?|chances?|forecasts?|probabilit|outlook)/i;

  // TR karşılıkları. Diyakritiksiz (ASCII'ye katlanmış) akışlar da geliyor, bu
  // yüzden ı/i ve ö/o toleranslı yazıldı. "s[öo]nd[üu]" açıkça yazıldı: naif
  // bir "s[öo]nd" kalıbı "son dönem" ifadesini yanlışlıkla yakalardı.
  const FADE_TR = /(zay[ıi]fla|s[öo]nd[üu]|s[öo]n[üu]yor|ertele|masadan kalk|rafa kalk|iptal|vazge[çc]|uzakla[şs]|suya d[üu][şs]|umut\w*(?:\s+\w+){0,2}\s*k[ıi]r[ıi]l|(?:beklenti|ihtimal|umut|olas[ıi]l[ıi]k|sinyal|bahis)\w*(?:\s+\w+){0,3}\s*(azal|d[üu][şs]|geril|kayb|yok ol))/i;

  // İfade metinde geçiyor; ÇEVRESİNDE onu öldüren bir fiil var mı?
  function fadedAround(t, re) {
    const m = re.exec(t);
    if (!m) return false;
    const a = Math.max(0, m.index - FADE_WIN);
    const w = t.slice(a, m.index + m[0].length + FADE_WIN);
    return FADE_HARD.test(w) || FADE_SOFT.test(w) || FADE_TR.test(w);
  }

  const RATE_CUT_RE  = /(rate cut|faiz indir|indirim|lower(?:ed|ing)? rate|gevşe|dovish|faizi düşür)/i;
  const RATE_HIKE_RE = /(rate hike|faiz artır|artırım|raise(?:d|s)? rate|sıkılaş|hawkish|faizi yüksel)/i;

  // Fed başlıklarından faiz yönü sinyali: -1 gevşeme (indirim) .. +1 sıkılaşma (artırım)
  // `wOf` verilirse her başlığın oyu o ağırlıkla sayılır (tazelik ağırlığı — bkz. computePulseMacro).
  function rateDirection(items, wOf) {
    let c = 0, h = 0;
    items.forEach((it) => {
      const t = (it.title || '') + ' ' + (it.description || '');
      const w = wOf ? wOf(it) : 1;
      // Olumsuzlanmış indirim ifadesi ŞAHİN oydur; olumsuzlanmış artırım ifadesi GÜVERCİN.
      if (RATE_CUT_RE.test(t))  { if (fadedAround(t, RATE_CUT_RE))  h += w; else c += w; }
      if (RATE_HIKE_RE.test(t)) { if (fadedAround(t, RATE_HIKE_RE)) c += w; else h += w; }
    });
    const tot = c + h;
    return tot ? (h - c) / (tot + 1) : 0;
  }

  // ⚖️ SAF ÇIKARMA (2026-10-19) — /api/pulse için.
  // ÖLÇÜLEN DURUM: büyüme boyutu ve faz karar ağacı `computeMacro`nun
  // İÇİNDEydi; o fonksiyon AĞA ÇIKIYOR (fetchThemesData + scoreSymbolList)
  // ve modül durumu yazıyor (macroBreadthSeen), yani motora dilimlenemez.
  // Ucun aynı karar ağacını YENİDEN YAZMASI ikinci bir kopya doğururdu.
  // Çözüm: saf olan iki parçayı fonksiyondan ÇIKAR, `computeMacro` onları
  // ÇAĞIRSIN. FORMÜLLER DEĞİŞMEDİ — eşik ve katsayıların tamamı aynıdır.
  // (Bilgi amaçlı sunum katmanı; TA/FA/bileşke SKORUNA DAHİL DEĞİL.)

  // Büyüme / piyasa genişliği: evrenin ortalama teknik skoru → -1..+1
  function macroGrowth(breadth) {
    return Math.max(-1, Math.min(1, (breadth - 50) / 20));
  }

  // Faz sınıflandırması (şeffaf karar ağacı). SIRA ANLAMLI: durgunluk
  // önce bakılır, çünkü zayıf büyüme + yüksek risk birleşimi "geç döngü"
  // koşullarını da sağlayabilir — sıra bozulursa faz sessizce kayar.
  function macroPhase(dims) {
    const d = dims || {};
    const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
    const rate = n(d.rate), infl = n(d.infl), growth = n(d.growth), risk = n(d.risk);
    if (growth <= -0.35 || (risk >= 0.5 && growth < 0)) return 'recession';
    if (infl >= 0.5 || rate >= 0.3 || risk >= 0.5) return 'late';
    if (rate <= -0.15 && growth < 0.25) return 'early';
    return 'mid';
  }


// ===== dilim: nabiz-yon =====
  const RATE_SENSITIVE = ['tech', 'semis', 'reit', 'auto', 'clean', 'biotech', 'space', 'software', 'crypto'];

  // Makro duruş kodu → insan dili (yön değişimi bildirimi için)
  const PMAC_CLS_TR = { hawk: '🔺 şahin/sıkılaşma', dove: '🕊️ güvercin/gevşeme', neu: '⚖️ nötr' };

  // Duruş KODU → ekranda görünen Türkçe. 2026-10-19'da computePulseMacro'nun
  // içinden buraya alındı: baskı eşiklerini motora taşırken SERBEST TÜRKÇE
  // onunla birlikte gitmesin (HAM SAYI kuralı — cümle çağrı noktasında kalır).
  const PMAC_STANCE_TR = {
    hawk: { stance: 'Sıkılaşma / şahin baskı', emoji: '🔺' },
    dove: { stance: 'Gevşeme / güvercin rüzgârı', emoji: '🕊️' },
    neu:  { stance: 'Nötr / belirsiz yön', emoji: '⚖️' },
  };

  // Enflasyon yönü: +1 ısınma (şahin baskı) .. -1 soğuma (güvercin rahatlama)
  // 2026-10-14: "consumer price" eklendi. Ölçülen eksik — up regexi "inflation"
  // ya da "cpi" kelimesini ŞART koştuğu için "Stocks tumble as consumer prices
  // accelerate" NÖTR sayılıyordu; aynı olayı anlatan manşet oy vermiyordu.
  // Simetri için down tarafına da eklendi (tek yönlü ekleme yanlılık üretirdi).
  // `wOf` verilirse her başlığın oyu o ağırlıkla sayılır (tazelik ağırlığı).
  const INFL_UP_RE = /(inflation[^.]{0,30}(jump|rise|rises|rose|accelerat|hotter|hot|surge|climb|spike|stick|higher|top)|cpi[^.]{0,20}(jump|rise|rose|hotter|accelerat|higher|top)|consumer price[^.]{0,30}(jump|rise|rises|rose|accelerat|hotter|hot|surge|climb|spike|stick|higher|top)|yields?[^.]{0,20}(jump|surge|rise|rose|climb|spike|higher)|hotter[- ]than|enflasyon[^.]{0,25}(artt|yüksel|hızlan|ısın|rekor)|faiz[^.]{0,15}yüksel)/i;
  const INFL_DOWN_RE = /(inflation[^.]{0,30}(cool|cools|eas|slow|slows|fall|falls|fell|drop|decline|lower)|cpi[^.]{0,20}(cool|eas|slow|fall|fell|lower)|consumer price[^.]{0,30}(cool|cools|eas|slow|slows|fall|falls|fell|drop|decline|lower)|yields?[^.]{0,20}(fall|fell|drop|ease|decline|lower)|enflasyon[^.]{0,25}(düş|geriled|yavaşla|soğu))/i;
  function inflDirection(items, wOf) {
    let u = 0, d = 0;
    items.forEach((it) => {
      const t = (it.title || '') + ' ' + (it.description || '');
      const w = wOf ? wOf(it) : 1;
      if (INFL_UP_RE.test(t)) u += w;
      if (INFL_DOWN_RE.test(t)) d += w;
    });
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

  // ⏳ SAF ÇIKARMA (2026-10-19) — /api/pulse için. Üç parça da
  // `computePulseMacro`nun İÇİNDEydi; o fonksiyon AĞA ÇIKIYOR
  // (fetchThemesData) ve localStorage okuyor, yani motora dilimlenemez.
  // Eşikler ve katsayılar DEĞİŞMEDİ (48 sa / 2,5 / 0,6-0,4 / ±0,12).
  // `now` parametresi yalnız TEST içindir: verilmezse Date.now().
  const PULSE_FRESH_H = 48, PULSE_FRESH_W = 2.5;

  // Çürüme penceresi: tarihi okunamayan başlık "taze" SAYILMAZ, dışarıda kalır.
  function pulseFreshWithin(items, days, now) {
    const t0 = now == null ? Date.now() : now, win = days * 864e5;
    return (items || []).filter((it) => { const t = Date.parse(it && it.pubDate); return !isNaN(t) && t0 - t < win; });
  }

  // ⏱️ TAZELİK AĞIRLIĞI. KATSAYI NEDEN 2,5: 14 günlük pencere yedi adet
  // 48 saatlik kovaya ayrılır. Taze kovaya 2,5 ağırlık verilince, kovalar
  // eşit sayıda başlık taşırsa o kova oyların ~%29'unu tutar
  // (2,5 / (2,5 + 6·1)). Yani aynı günkü bir veri açıklaması bayat ve
  // ILIMLI bir eğilimi çevirmeye yeter, ama tek başına okumayı ±1'e
  // çivileyemez. 1,0 = eski (hatalı) davranış; 7,0 ≈ "yalnız bugün"
  // demek olurdu ve 14 günlük pencereyi anlamsızlaştırırdı.
  function pulseFreshWeight(now) {
    const t0 = now == null ? Date.now() : now;
    return (it) => {
      const t = Date.parse(it && it.pubDate);
      return (!isNaN(t) && t0 - t < PULSE_FRESH_H * 36e5) ? PULSE_FRESH_W : 1;
    };
  }

  // Birleşik para-politikası baskısı → duruş KODU + yön-duyarlı sektör etkisi.
  // Faiz 0,6 / enflasyon 0,4: faiz yönü doğrudan iskonto oranıdır, enflasyon
  // ona DOLAYLI etki eder. Eşik ±0,12 → "nötr" bandı bilerek geniş: zayıf
  // bir okuma sektör eğilimi ilan etmeye yetmez. SERBEST TÜRKÇE YOK —
  // yalnız `cls` kodu ve sektör kodları döner (bkz. PMAC_STANCE_TR).
  function pulseStance(rateDir, inflDir) {
    const r = Number(rateDir) || 0, i = Number(inflDir) || 0;
    const pressure = r * 0.6 + i * 0.4;
    if (pressure >= 0.12) return { pressure, cls: 'hawk', biasUp: ['banks'], biasDown: RATE_SENSITIVE.concat(['gold']) };
    if (pressure <= -0.12) return { pressure, cls: 'dove', biasUp: RATE_SENSITIVE.concat(['gold']), biasDown: [] };
    return { pressure, cls: 'neu', biasUp: [], biasDown: [] };
  }


// ===== dilim: backtest =====
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


// ===== dilim: fmt-kisa =====
  const shortNum = (v) => {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
    if (a >= 1e9)  return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6)  return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3)  return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(0);
  };


// ===== dilim: crypto =====
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

// ===== dilim: metal =====
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

// ===== dilim: haber-skor =====
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


// ===== dilim: firsat =====
  function oppTag(score) {
    if (score >= 66) return { txt: '🔥 Güçlü Fırsat', cls: 'strong' };
    if (score >= 56) return { txt: '🟢 Fırsat oluşuyor', cls: 'good' };
    if (score > 52)  return { txt: '🟡 İzle', cls: 'watch' };
    if (score >= 48) return { txt: '⚪ Nötr', cls: 'neutral' };
    if (score > 44)  return { txt: '🔻 Zayıf', cls: 'weak' };
    return { txt: '⛔ Uzak dur', cls: 'risk' };
  }

  // ===== Fiyat uygunluğu = fırsatın kilit parçası =====
  // Teknik skor güçlü olsa bile fiyat "uygun alım bölgesi"nin çok üstündeyse bu bir ALIM
  // fırsatı değil, kovalamadır. buyZoneProximity ile fiyatın banda ATR-ölçekli uzaklığını
  // puana çeviririz: içinde/altında = asıl fırsat fiyatı (+), banda yakın = hafif (+),
  // uzak = ceza (−). Güçlü momentum rejiminde derin geri çekilme gelmeyebilir → uzaklık
  // cezası yumuşatılır (sadece iskonto beklemek fırsatı kaçırabilir). Sınır ±8 puan
  // (haber nabzı ±7 ile aynı ağırlık düzeyi). YALNIZ Fırsatlar sıralama katmanı;
  // computeVadeScore skorunu, alım bandını ve TA/FA bileşke skorunu DEĞİŞTİRMEZ (bilgi amaçlı).
  function priceOppAdj(prox, mom) {
    if (!prox || prox.dAtr == null) return 0;
    const d = prox.dAtr; // fiyatın bandın kaç ATR üstünde olduğu (≤0 = içinde/altında)
    let pts;
    if (d <= 0)      pts = 8;                         // içinde/altında — asıl fırsat fiyatı
    else if (d <= 1) pts = 6 * (1 - d);               // banda yakın: +6 → 0
    else             pts = -Math.min(8, (d - 1) * 4); // banda uzak: her ATR −4, −8 tavan
    if (pts < 0 && mom && mom.active) pts *= 0.4;     // güçlü trend → cezayı yumuşat
    return pts;
  }
  function priceOppChip(prox) {
    if (!prox) return '';
    const map = {
      below: { cls: 'in',   t: '🟢 Alım bandının altında — ucuz' },
      in:    { cls: 'in',   t: '🟢 Fiyat alım bölgesinde' },
      near:  { cls: 'near', t: `🟢 ${bandUzaklikTxt(prox.dAtr, null, true)}` },
      far:   { cls: 'far',  t: `🟡 ${bandUzaklikTxt(prox.dAtr, null, true)}` },
    };
    const m = map[prox.state];
    return m ? `<span class="opp-prox ${m.cls}">${m.t}</span>` : '';
  }


// ===== dilim: scan =====
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


// ===== dilim: sektor =====
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

  // ===== Item 3: kademeli SEKTÖR SINIFLANDIRICI + "ne iş yapıyor" satırı =====
  // SORUN: Yahoo'nun `sector` alanı birçok ADR/OTC (YASKY, NJDCY, TTDKY, SHECY…) ve
  // bütün ETF'ler için BOŞ gelir. Eski kod tek bir `SEK_META[res.sector]` bakışı yapıp
  // boş olan HER ŞEYİ 📦 "Fon/ETF & Diğer" kutusuna atıyordu — yani gerçek şirketler
  // yanlış sektörde görünüyordu.
  // ÇÖZÜM: kademeli çıkarım — ① Yahoo sektörü ② Yahoo alt-alanı (industry)
  // ③ gerçek fon/ETF tespiti ④ radar sembol etiketi (SYMBOL_SECTORS)
  // ⑤ şirket profili metni (bizSummary). Hiçbiri tutmazsa 📦.
  // Fonlar bilerek 📦'de KALIR: F/K ve marjları olmadığı (ya da sepet ortalaması olduğu)
  // için sektör ortancalarını bozarlar — modülün varlık sebebi o ortancalar.
  // SALT SUNUM/SINIFLAMA KATMANI — TA/FA/bileşke skoruna DOKUNMAZ.

  // Yahoo alt-alan (industry) → sektör. Sıra önemli: daha özgül olan üstte.
  const SEK_IND_RULES = [
    [['semiconduct', 'software', 'computer hardware', 'consumer electronic', 'electronic component', 'electronics & computer', 'information technology', 'scientific & technical', 'communication equipment', 'solar'], 'Technology'],
    [['bank', 'capital markets', 'insurance', 'asset management', 'credit services', 'mortgage', 'financial data', 'financial conglomerate', 'shell companies'], 'Financial Services'],
    [['biotechnolog', 'drug manufactur', 'diagnostics & research', 'medical device', 'medical instrument', 'medical care', 'medical distribution', 'healthcare', 'health information', 'pharmaceutical retail'], 'Healthcare'],
    [['telecom', 'entertainment', 'broadcasting', 'advertising', 'publishing', 'electronic gaming', 'internet content'], 'Communication Services'],
    [['reit', 'real estate'], 'Real Estate'],
    [['utilities'], 'Utilities'],
    [['steel', 'copper', 'aluminum', 'gold', 'silver', 'mining', 'chemical', 'agricultural inputs', 'paper', 'lumber', 'building materials', 'coking coal'], 'Basic Materials'],
    [['oil & gas', 'uranium', 'coal'], 'Energy'],
    [['aerospace', 'defense', 'airlines', 'airport', 'railroad', 'trucking', 'marine shipping', 'integrated freight', 'machinery', 'engineering & construction', 'building products', 'electrical equipment', 'industrial distribution', 'waste management', 'pollution', 'security & protection', 'metal fabrication', 'business services', 'consulting services', 'staffing', 'rental & leasing', 'conglomerates', 'infrastructure operations', 'tools & accessories'], 'Industrials'],
    [['beverages', 'food', 'grocery', 'household & personal', 'tobacco', 'confectioners', 'farm products', 'discount stores', 'education & training'], 'Consumer Defensive'],
    [['auto', 'apparel', 'restaurant', 'lodging', 'resorts & casinos', 'gambling', 'leisure', 'travel services', 'footwear', 'furnishings', 'home improvement', 'specialty retail', 'internet retail', 'department stores', 'luxury goods', 'packaging & containers', 'recreational vehicles', 'residential construction', 'personal services', 'textile'], 'Consumer Cyclical'],
  ];

  // Radar sembol etiketi (SYMBOL_SECTORS) → sektör. 'intl' bilerek yok: coğrafya, sektör değil.
  const SEK_TAG_SEK = {
    semis: 'Technology', tech: 'Technology', software: 'Technology', crypto: 'Technology',
    banks: 'Financial Services', biotech: 'Healthcare', energy: 'Energy', clean: 'Energy',
    gold: 'Basic Materials', materials: 'Basic Materials', utilities: 'Utilities',
    reit: 'Real Estate', auto: 'Consumer Cyclical', staples: 'Consumer Defensive',
    defense: 'Industrials', space: 'Industrials', industrials: 'Industrials',
  };

  // Şirket profili metni (bizSummary, İngilizce) → sektör. En son başvurulan kademe.
  const SEK_BIZ_RULES = [
    [['semiconductor', 'microchip', 'chipset', 'wafer', 'foundry', 'software', 'saas', 'cloud computing', 'cybersecur', 'artificial intelligence', 'photonic', 'optical transceiver', 'electronic components'], 'Technology'],
    [['bank', 'insurance', 'asset management', 'brokerage', 'lending', 'payment network'], 'Financial Services'],
    [['biotechnolog', 'pharmaceutic', 'clinical-stage', 'therapeutic', 'vaccine', 'medical device', 'gene editing', 'diagnostic'], 'Healthcare'],
    [['telecommunication', 'satellite communication', 'broadcast', 'advertising', 'streaming'], 'Communication Services'],
    [['real estate', 'reit'], 'Real Estate'],
    [['electric utility', 'power generation', 'nuclear reactor', 'small modular reactor', 'transmission grid'], 'Utilities'],
    [['mining', 'steel', 'copper', 'chemical', 'fertilizer', 'cement'], 'Basic Materials'],
    [['oil and gas', 'crude', 'petroleum', 'natural gas', 'refining', 'uranium'], 'Energy'],
    [['robot', 'automation', 'aerospace', 'defense', 'unmanned', 'machinery', 'industrial equipment', 'airline', 'logistics', 'space launch', 'satellite', 'motion control', 'servo'], 'Industrials'],
    [['beverage', 'food product', 'grocery', 'household product', 'tobacco'], 'Consumer Defensive'],
    [['automobile', 'vehicle', 'apparel', 'restaurant', 'hotel', 'e-commerce', 'retail'], 'Consumer Cyclical'],
  ];

  // Fon/ETF tespiti: büyük-küçük harfe DUYARLI, yalnız güçlü marka/yapı sözcükleri.
  // ("Fundamental" → \bFund\b eşleşmez; "Northern Trust" gibi gerçek şirketler zaten
  //  Yahoo sektörüyle ① kademesinde sınıflanır.)
  const SEK_FUND_RE = /\b(ETF|ETFs|Fund|Funds|iShares|SPDR|ProShares|Invesco|Vanguard|ARK|Index Trust|Unit Trust|Select Sector)\b/;
  // Fonun NEYİ izlediğini adından okur (📦 kutusunu anlamlı kılar).
  // Sıra önemli: 'aerospace' içinde 'space' geçtiği için savunma kuralı üstte.
  const SEK_FUND_TR = [
    [['semiconductor', 'chip'], 'Çip/yarı iletken fonu'],
    [['aerospace', 'defense'], 'Savunma & havacılık fonu'],
    [['space', 'satellite'], 'Uzay/uydu fonu'],
    [['robot', 'automation'], 'Robotik & otomasyon fonu'],
    [['clean energy', 'clean edge', 'green energy', 'alternative energy', 'renewable', 'solar', 'wind power', 'hydrogen'], 'Temiz enerji fonu'],
    [['genomic', 'biotech', 'health'], 'Biyoteknoloji/sağlık fonu'],
    [['gold', 'precious metal'], 'Altın/değerli maden fonu'],
    [['bitcoin', 'ethereum', 'crypto', 'blockchain'], 'Kripto/blok zinciri fonu'],
    [['bond', 'treasury', 'aggregate'], 'Tahvil fonu'],
    [['dividend'], 'Temettü odaklı fon'],
    [['real estate', 'reit'], 'Gayrimenkul fonu'],
    [['energy', 'oil'], 'Enerji/petrol fonu'],
    [['information technology', 'technology'], 'Teknoloji fonu'],
    [['international', 'total world', 'emerging', 'ex-us'], 'Global/uluslararası hisse fonu'],
    [['s&p 500', 'total stock market', 'nasdaq', 'russell'], 'Geniş endeks fonu'],
  ];

  function sekMatchRules(rules, txt) {
    if (!txt) return null;
    const t = String(txt).toLowerCase();
    for (let i = 0; i < rules.length; i++) {
      const words = rules[i][0];
      for (let j = 0; j < words.length; j++) if (t.indexOf(words[j]) !== -1) return rules[i][1];
    }
    return null;
  }

  function sekFundTheme(name) {
    const t = String(name || '').toLowerCase();
    for (let i = 0; i < SEK_FUND_TR.length; i++) {
      const words = SEK_FUND_TR[i][0];
      for (let j = 0; j < words.length; j++) if (t.indexOf(words[j]) !== -1) return SEK_FUND_TR[i][1];
    }
    return 'Fon/ETF (sepet)';
  }

  // → { key: SEK_META anahtarı, basis: hangi kademeden geldi, fund?: fon tema etiketi }
  function sekClassify(res, u) {
    if (res.sector && SEK_META[res.sector]) return { key: res.sector, basis: 'sector' };
    const byInd = sekMatchRules(SEK_IND_RULES, res.industry);
    if (byInd) return { key: byInd, basis: 'industry' };
    const nm = String(res.name || '');
    if (SEK_FUND_RE.test(nm)) return { key: '_other', basis: 'fund', fund: sekFundTheme(nm) };
    const sym = String((u && u.symbol) || res.symbol || '').toUpperCase().replace(/\.IS$/, '');
    const tags = SYMBOL_SECTORS[sym] || [];
    for (let i = 0; i < tags.length; i++) if (SEK_TAG_SEK[tags[i]]) return { key: SEK_TAG_SEK[tags[i]], basis: 'tag' };
    const byBiz = sekMatchRules(SEK_BIZ_RULES, res.bizSummary);
    if (byBiz) return { key: byBiz, basis: 'biz' };
    return { key: '_other', basis: null };
  }

  // 🏢 "Ne iş yapıyor?" satırı — hisse sayfasındaki şirket profili bölümünün
  // sektör manzarasına taşınmış tek-cümlelik hali (aynı firstSentence motoru).
  // BİLGİ AMAÇLI; temel/teknik/bileşke skora DAHİL DEĞİL.
  function sekBizHtml(s) {
    const ind = s.fund ? s.fund : trIndustry(s.industry, { symbol: s.symbol });
    const one = s.biz ? firstSentence(s.biz) : '';
    const lbl = (ind && ind !== '—') ? ind : '';
    if (!lbl && !one) return '';
    const src = s.basis === 'biz' ? ' <i class="sb-src">profil metninden sınıflandı</i>'
      : s.basis === 'tag' ? ' <i class="sb-src">sembol etiketinden sınıflandı</i>' : '';
    return '<div class="sbiz">' + (lbl ? '<b class="sb-ind">' + tzEsc(lbl) + '</b>' : '')
      + (lbl && one ? ' · ' : '') + (one ? tzEsc(one) : '') + src + '</div>';
  }

  // Sektör gruplarını sekMem'den kurar (yalnız verisi gelmiş hisseler)
  function sekBuildGroups(universe) {
    const groups = new Map();
    universe.forEach((u) => {
      const res = sekMem.get(u.market + ':' + u.symbol);
      if (!res || !res.ok) return;
      // ① Yahoo sektörü → ② alt-alan → ③ fon → ④ sembol etiketi → ⑤ profil metni
      const cl = sekClassify(res, u);
      const key = cl.key;
      if (!groups.has(key)) groups.set(key, { key, meta: SEK_META[key], stocks: [] });
      const pe = (res.trailingPE != null && isFinite(res.trailingPE) && res.trailingPE > 0) ? res.trailingPE
        : (res.forwardPE != null && isFinite(res.forwardPE) && res.forwardPE > 0 ? res.forwardPE : null);
      groups.get(key).stocks.push({
        symbol: u.symbol, market: u.market, name: res.name || u.symbol,
        pe, fpe: (res.forwardPE != null && isFinite(res.forwardPE) && res.forwardPE > 0) ? res.forwardPE : null,
        growth: res.revenueGrowth != null && isFinite(res.revenueGrowth) ? res.revenueGrowth * 100 : null,
        margin: res.profitMargin != null && isFinite(res.profitMargin) ? res.profitMargin * 100 : null,
        peg: res.peg,
        // sunum için: alt-alan + şirket profili (skora GİRMEZ)
        industry: res.industry || null,
        biz: res.bizSummary || null,
        basis: cl.basis,
        fund: cl.fund || null,
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


// ===== dilim: radar =====
  const SECTORS = {
    energy: 'Enerji/Petrol', defense: 'Savunma', tech: 'Teknoloji', semis: 'Çip/Yarı İletken',
    clean: 'Temiz Enerji', gold: 'Altın/Değerli Maden', banks: 'Banka/Finans', staples: 'Temel Tüketim',
    auto: 'Otomotiv', reit: 'Gayrimenkul', utilities: 'Elektrik/Altyapı', space: 'Uzay/Uydu',
    biotech: 'Biyotek/Sağlık', industrials: 'Sanayi', intl: 'Global/Gelişen Piyasa',
    software: 'Yazılım/Siber', crypto: 'Kripto/Blok Zinciri', materials: 'Metal/Madencilik',
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
    // ABD/ADR — izleme evreninin gerçek sembolleri (tohumlu listelerden: 🤖 Robot,
    // 🇺🇸 Amerika V1, 🇺🇸 Amerika Gelecek Tema). radarUniverse() yalnız hem etiketli
    // HEM listede olan sembolleri eşler; eskiden tech/semis kesişimi tek başına NVDA'ya
    // düşüyordu → her gündem kartında aynı isim. Gerçek evreni etiketleyince çeşitlilik
    // gelir. Yalnız "ilgili takip" ilişkisi içindir; FA/TA skoruna DOKUNMAZ.
    TSM: ['semis', 'tech'], SKHY: ['semis', 'tech'], MRVL: ['semis', 'tech'], STM: ['semis', 'tech'],
    SONY: ['tech'], ZBRA: ['tech', 'industrials'], HSAI: ['tech', 'auto'], RXRX: ['biotech', 'tech'],
    IONQ: ['tech'], RGTI: ['tech'], QBTS: ['tech'], ROBO: ['industrials', 'tech'], SYM: ['industrials', 'tech'],
    SERV: ['industrials', 'tech'], RR: ['industrials', 'tech'], YASKY: ['industrials'], HSYDF: ['industrials'],
    NJDCY: ['industrials'], TTDKY: ['tech', 'industrials'], SHECY: ['semis', 'industrials'],
    GEV: ['utilities', 'industrials'], ONDS: ['defense', 'tech'], RCAT: ['defense'],
    KTOS: ['defense'], AVAV: ['defense'], RKLB: ['space', 'defense'], ASTS: ['space', 'tech'],
    LUNR: ['space', 'defense'], OKLO: ['utilities', 'energy', 'clean'], SMR: ['utilities', 'energy', 'clean'],
    NNE: ['utilities', 'energy', 'clean'], LEU: ['energy', 'industrials'], CRSP: ['biotech'], NTLA: ['biotech'],
    BEAM: ['biotech'],
    // --- Genişletme (v95): izleme evreninin kalan gerçek sembolleri ---
    // Çip & yarı iletken ekipman/bellek/IP
    AMAT: ['semis', 'tech'], KLAC: ['semis', 'tech'], LRCX: ['semis', 'tech'], MU: ['semis', 'tech'],
    INTC: ['semis', 'tech'], TXN: ['semis', 'tech'], AVGO: ['semis', 'tech'], ARM: ['semis', 'tech'],
    ASML: ['semis', 'tech'], AMKR: ['semis', 'tech'], MXL: ['semis', 'tech'], SIMO: ['semis', 'tech'],
    CRDO: ['semis', 'tech'], SNDK: ['semis', 'tech'], TER: ['semis', 'tech'],
    // Optik / fotonik / ağ donanımı
    AAOI: ['tech', 'semis'], COHR: ['tech', 'semis'], LITE: ['tech', 'semis'], LWLG: ['tech', 'semis'],
    FN: ['tech', 'industrials'], GLW: ['tech', 'industrials'], APH: ['tech', 'industrials'],
    ANET: ['tech'], VIAV: ['tech'], DELL: ['tech'],
    // Yazılım / siber güvenlik / bulut
    CRWD: ['software', 'tech'], PANW: ['software', 'tech'], FTNT: ['software', 'tech'], ZS: ['software', 'tech'],
    NOW: ['software', 'tech'], CRWV: ['software', 'tech'], RXT: ['software', 'tech'], ZETA: ['software', 'tech'],
    IBM: ['tech', 'software'], PLTR: ['software', 'tech', 'defense'],
    // Yapay zeka altyapısı — veri merkezi güç/soğutma/elektrik
    VRT: ['industrials', 'tech'], ETN: ['industrials', 'utilities'], POWL: ['industrials', 'utilities'],
    VST: ['utilities', 'energy'], CEG: ['utilities', 'energy', 'clean'],
    // Kripto / blok zinciri / madencilik
    COIN: ['crypto', 'tech'], IREN: ['crypto', 'tech'],
    // Fintech
    SOFI: ['banks', 'tech'],
    // Temiz enerji / batarya / yakıt hücresi
    BE: ['clean', 'energy'], AMPX: ['clean', 'tech'],
    // Metal / madencilik / nadir toprak / lityum
    ALB: ['materials', 'clean'], FCX: ['materials', 'industrials'], MP: ['materials', 'industrials'],
    REMX: ['materials', 'industrials'], GFI: ['gold', 'materials'],
    // Biyoteknoloji / sağlık
    IOVA: ['biotech'], SMMT: ['biotech'], SRRK: ['biotech'], AMLX: ['biotech'], OTLK: ['biotech'],
    XLV: ['biotech'], VHT: ['biotech'],
    // Havacılık / savunma / uzay
    BA: ['defense', 'industrials'], RDW: ['space', 'defense'], FLY: ['space', 'defense'],
    SPCX: ['space'], UMAC: ['defense', 'tech'],
    // Enerji ETF
    USO: ['energy'],
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


return { fetchYahooOHLC, yahooSymbol, resampleCandles, taTFIndicators, taRegime, taNormalize, computeVadeScore, setTaScoreInd, faInterp, faSD, faScoreSig, computeFaScore, faVerdict, FA_PE, faPeCriterion, faBand, taBand, COMPOSITE_MATRIX, COMPOSITE_BLEND, compositeBlend, computeHolisticScore, momentumInfo, buyZoneProximity, planRiskReward, fetchIsYatirimMali, parseIsMali, bistFundamentalModel, secGet, secResolveCik, secFetchModel, CAUSAL_INDEX_AFFINITY, causalAlign, computeCausalLinks, CYCLE_PHASES, macroGrowth, macroPhase, FADE_WIN, fadedAround, rateDirection, inflDirection, RATE_SENSITIVE, pulseRecentCount, PULSE_FRESH_H, PULSE_FRESH_W, pulseFreshWithin, pulseFreshWeight, pulseStance, TA_HORIZON, BT_CFG, spearmanIC, computeBacktest, shortNum, scoreBand, cryptoCategory, computeCryptoValue, METAL_MACRO_W, computeMetalMacro, SENTI_POS, SENTI_NEG, scoreHeadline, sentiLabel, oppTag, priceOppAdj, SCAN_PRESETS, scanBlend, scanScore, scanTag, SEK_META, sekMedian, sekClassify, sekSortGroups, SECTORS, SYMBOL_SECTORS, RADAR_THEMES };
}
