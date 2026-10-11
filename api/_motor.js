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
//  Dilimler (9):
//    util           19 satır
//    ysym            6 satır
//    ta            771 satır
//    fa-core        26 satır
//    fmt            15 satır
//    composite      15 satır
//    holistic      107 satır
//    fa-bist       154 satır
//    fa-us         292 satır
//    TOPLAM       1405 satır
//  Dışa verilen sembol: 23
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

export const IMZA = 'sha256:7049fb1cd9c44c9a';

/** Dilim adı + satır sayısı — app.js okumadan. */
export const DILIMLER = [
  { name: 'util', lines: 19 },
  { name: 'ysym', lines: 6 },
  { name: 'ta', lines: 771 },
  { name: 'fa-core', lines: 26 },
  { name: 'fmt', lines: 15 },
  { name: 'composite', lines: 15 },
  { name: 'holistic', lines: 107 },
  { name: 'fa-bist', lines: 154 },
  { name: 'fa-us', lines: 292 },
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


return { fetchYahooOHLC, yahooSymbol, resampleCandles, taTFIndicators, taRegime, taNormalize, computeVadeScore, setTaScoreInd, faInterp, faSD, faScoreSig, computeFaScore, faVerdict, faBand, taBand, COMPOSITE_MATRIX, computeHolisticScore, fetchIsYatirimMali, parseIsMali, bistFundamentalModel, secGet, secResolveCik, secFetchModel };
}
