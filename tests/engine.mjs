// =====================================================================
//  SKOR MOTORU DİLİMLEYİCİ  (tests/engine.mjs)
// ---------------------------------------------------------------------
//  app.js'i DEĞİŞTİRMEDEN, skor motorunun kaynak dilimlerini çıkarır ve
//  Node içinde çalıştırılabilir hale getirir. Amaç: motoru kopyalamadan,
//  "tek doğru kaynak" app.js kalırken dışarıdan ölçebilmek.
//
//  NEDEN KOPYALAMA YOK: motor kopyalanırsa iki sürüm doğar ve parite
//  testi kendi kopyasını doğrular — yani hiçbir şeyi. Dilimleme, test
//  her koşuda app.js'in O ANKİ halini okumaya zorlar.
//
//  ÖLÇÜLMÜŞ GERÇEK (2026-10-11): altı dilimin tamamında ekran (document/
//  innerHTML) ve depo (cacheGet/loadLists) referansı YOK. Tek istisna
//  localStorage → taScoreIndVis (gösterge aç/kapa). Motor ayrıca ZAMANDAN
//  BAĞIMSIZ: Date.now() yalnız fetchYahooOHLC'nin cache-bust satırında
//  (taşıma katmanı), new Date() yalnız KAYITLI tarihleri ayrıştırırken.
//  → Bu yüzden parite testi birebir deterministik olabiliyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TESTS = path.join(ROOT, 'tests');
export const FIX = path.join(TESTS, 'fixtures');

// PARITE_APP ile baska bir app.js'e yoneltilebilir. Iki isi var:
//   1) NEGATIF KONTROL: kopyada bir agirligi bozup testin GERCEKTEN
//      kirmizi yandigini kanitlamak (hep yesil yanan test hicbir sey olcmez).
//   2) Aday motoru (/api/score tasimasi) canliya dokunmadan olcmek.
// Varsayilan HER ZAMAN depodaki app.js — ortam degiskeni yoksa davranis aynidir.
const APP_PATH = process.env.PARITE_APP
  ? path.resolve(process.env.PARITE_APP)
  : path.join(ROOT, 'app.js');
const CFG_PATH = path.join(ROOT, 'config.js');

// ---------------------------------------------------------------------
// Dilim imleri. Her im app.js'te TAM BİR KEZ geçmeli — geçmezse test
// sessizce yanlış kod ölçmek yerine gürültüyle durur.
// ---------------------------------------------------------------------
const SLICES = [
  // fmtTRY/fmtTime, fmtDate'in 11 satir ustunde — bistFundamentalModel
  // fmtTRY'yi cagiriyor (fmtUSD ile ayni bagimlilik), bu yuzden dilim
  // yukari genisletildi.
  ['util', "  const fmtTRY = (n) => new Intl.NumberFormat('tr-TR', {", '  // ===== Döviz / Altın ====='],
  ['ysym', '  function yahooSymbol(symbol, market) {', '  async function fetchYahooChart('],
  // fetchYahooOHLC + 23 indikatör fonksiyonu + computeVadeScore: tek bitişik blok
  ['ta', '  // ===== Teknik analiz: OHLCV + indikatörler =====', '  function rankedSRZones(daily, opts) {'],
  ['fa-core', '  function faInterp(x, pts) {', '  const FA_GROUPS = ['],
  // fmtTL / fmtUSD: FA modelleri NOT metinlerini bunlarla kuruyor. Skora
  // GIRMEZ ama fonksiyon yoksa model hic kurulamaz (olculdu: secFetchModel
  // 'fmtUSD is not defined' ile patliyor). Kopyalamak yerine dilimliyoruz.
  ['fmt', '  const fmtTL = (n) => {', '  // Skorlu temel panel: skor'],
  ['composite', "  const faBand = (s) => s >= 60 ? 'hi' : s < 45 ? 'lo' : 'mid';", '  async function fillComposite('],
  // Son sinir buildGrowthNote'un DEVAMINDA: computeHolisticScore onu cagiriyor,
  // yani buyume notu sinifi (cls) ayni dilimde olmak zorunda.
  ['holistic', '  function computeHolisticScore(o) {', '  function buildConjunctureNote(o) {'],
  ['fa-bist', '  async function fetchIsYatirimMali(symbol) {', '  const bistMcapCache = {};'],
  ['fa-us', '  async function secGet(url, timeout = 12000) {', '  // ===== Genel sekmesi ====='],
];

// Dilimlerden dışarı verilecek motor sembolleri.
const EXPORTS = [
  'fetchYahooOHLC', 'yahooSymbol', 'resampleCandles', 'taTFIndicators', 'taRegime',
  'taNormalize', 'computeVadeScore', 'setTaScoreInd',
  'faInterp', 'faSD', 'faScoreSig', 'computeFaScore', 'faVerdict',
  'faBand', 'taBand', 'COMPOSITE_MATRIX',
  'computeHolisticScore',
  'fetchIsYatirimMali', 'parseIsMali', 'bistFundamentalModel',
  'secGet', 'secResolveCik', 'secFetchModel',
];

function countOf(src, needle) {
  let n = 0, i = 0;
  for (;;) {
    const k = src.indexOf(needle, i);
    if (k < 0) return n;
    n++; i = k + 1;
  }
}

function sliceOne(src, name, from, to) {
  const cf = countOf(src, from), ct = countOf(src, to);
  if (cf !== 1) throw new Error(`dilim "${name}": baslangic imi ${cf} kez gecti (1 beklenir)\n  im: ${from}`);
  if (ct !== 1) throw new Error(`dilim "${name}": bitis imi ${ct} kez gecti (1 beklenir)\n  im: ${to}`);
  const a = src.indexOf(from), b = src.indexOf(to);
  if (b <= a) throw new Error(`dilim "${name}": bitis imi baslangictan ONCE geliyor`);
  return src.slice(a, b);
}

// config.js'i (window.TA_WEIGHTS / TA_BENCHMARK) tarayıcı olmadan yükle.
function loadConfig() {
  const w = {};
  const src = fs.readFileSync(CFG_PATH, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', '"use strict";\n' + src)(w);
  if (!w.TA_WEIGHTS) throw new Error('config.js: window.TA_WEIGHTS yuklenemedi');
  if (!w.TA_BENCHMARK) throw new Error('config.js: window.TA_BENCHMARK yuklenemedi');
  return w;
}

// Ekran erişimi olursa sessizce undefined dönmesin — adıyla patlasın.
function deadProxy(label) {
  return new Proxy({}, {
    get(_t, k) { throw new Error(`motor dilimi ekrana dokundu: ${label}.${String(k)} — dilim sinirlari yanlis`); },
    set(_t, k) { throw new Error(`motor dilimi ekrana yazdi: ${label}.${String(k)} — dilim sinirlari yanlis`); },
  });
}

/**
 * Motoru kur.
 * @param {object} opt
 * @param {(url:string)=>Promise<Response>} [opt.fetch]    ağ kabuğu (fetchYahooOHLC + secGet kullanır)
 * @param {(url:string,o?:object)=>Promise<string>} [opt.fetchVia]  İş Yatırım metin kabuğu
 * @param {object} [opt.taScoreInd]  gösterge aç/kapa (varsayılan: hepsi açık = {})
 */
export function buildEngine(opt = {}) {
  const app = fs.readFileSync(APP_PATH, 'utf8');
  const parts = SLICES.map(([n, a, b]) => ({ name: n, code: sliceOne(app, n, a, b) }));

  const noNet = async () => { throw new Error('ag kabugu verilmedi: parite kosusunda canli istek YASAK'); };
  const host = {
    window: {
      TA_WEIGHTS: opt.window?.TA_WEIGHTS ?? loadConfig().TA_WEIGHTS,
      TA_BENCHMARK: opt.window?.TA_BENCHMARK ?? loadConfig().TA_BENCHMARK,
      // secGet: `if (!base) return null` — BOŞ OLAMAZ. Varsayılan önek, kabuğun
      // decodeURIComponent ile gerçek URL'yi geri çıkarması için bir işaretçidir.
      MY_PROXY: opt.myProxy ?? 'fixture:',
    },
    localStorage: {
      getItem: () => (opt.taScoreInd ? JSON.stringify(opt.taScoreInd) : null),
      setItem: () => {},
    },
    fetch: opt.fetch || noNet,
    fetchVia: opt.fetchVia || noNet,
    dead: deadProxy,
  };

  const preamble = [
    '"use strict";',
    '// --- konak kabukları: motor bunları yalnız ÇAĞIRIR, içeriğini bilmez ---',
    'const window = H.window;',
    'const localStorage = H.localStorage;',
    'const fetch = (...a) => H.fetch(...a);',
    'const fetchVia = (...a) => H.fetchVia(...a);',
    'const proxy = (url) => url;              // Node\'da CORS yok → vekil gereksiz',
    'const setDiag = () => {};                // tanı rozetleri ekrana aittir',
    'const document = H.dead("document");     // erişilirse adıyla patlar',
    'const navigator = H.dead("navigator");',
    '',
  ].join('\n');

  const body = parts.map((p) => `// ===== dilim: ${p.name} =====\n${p.code}`).join('\n');
  const tail = `\nreturn { ${EXPORTS.join(', ')} };\n`;

  let api;
  try {
    // eslint-disable-next-line no-new-func
    api = new Function('H', preamble + body + tail)(host);
  } catch (e) {
    throw new Error('motor dilimleri derlenemedi: ' + e.message);
  }
  for (const k of EXPORTS) {
    if (api[k] === undefined) throw new Error(`motor sembolu bulunamadi: ${k} — dilim imleri kaymis olabilir`);
  }
  api._slices = parts.map((p) => ({ name: p.name, lines: p.code.split('\n').length }));
  api._weights = host.window.TA_WEIGHTS;
  api._bench = host.window.TA_BENCHMARK;
  return api;
}

export function readSymbols() {
  const j = JSON.parse(fs.readFileSync(path.join(TESTS, 'symbols.json'), 'utf8'));
  return {
    vade: j.vade,
    rows: [
      ...j.bist.map((r) => ({ ...r, market: 'BIST' })),
      ...j.us.map((r) => ({ ...r, market: 'US' })),
    ],
  };
}

// Kendi kendini sınama: `node tests/engine.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const e = buildEngine();
  const total = e._slices.reduce((a, s) => a + s.lines, 0);
  console.log('dilimler:');
  for (const s of e._slices) console.log(`  ${s.name.padEnd(10)} ${String(s.lines).padStart(5)} satir`);
  console.log(`  ${'TOPLAM'.padEnd(10)} ${String(total).padStart(5)} satir`);
  console.log(`motor sembolu: ${EXPORTS.length} adet, hepsi bulundu`);
  console.log(`TA_WEIGHTS vadeleri: ${Object.keys(e._weights).join(', ')}`);
  console.log(`TA_BENCHMARK: ${JSON.stringify(e._bench)}`);
  const s = readSymbols();
  console.log(`referans evreni: ${s.rows.length} sembol (vade=${s.vade})`);
}
