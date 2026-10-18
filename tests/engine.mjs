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
//  EKRAN SABİTLERİ ARTIK YOK (2026-10-14): burada bir readRenderConstants()
//  duruyordu — app.js'teki F/K kriterini ve FA/TA harmanını REGEX ile okur,
//  üç ekran kopyasının ayrışmadığını denetlerdi. Kriter ve harman motora
//  devredildiği gün okunacak bir “ekran sabiti” kalmadı: ikisi de artık
//  EXPORTS'tan geliyor (FA_PE / faPeCriterion · COMPOSITE_BLEND /
//  compositeBlend) ve api/_ekran.js SİLİNDİ. Geri getirmeye gerek yok —
//  üç ekran kopyası kalmadığı için ayrışacak bir şey de kalmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

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

// PARITE_MOTOR=uretilmis → motor app.js'ten dilimlenmek yerine ÜRETİLMİŞ
// dosyadan yüklenir. Amacı: /api/score'un sunucuda koşturacağı dosyayı,
// canlıya dokunmadan aynı parite kapısından geçirmek.
const MOTOR_PATH = path.join(ROOT, 'api', '_motor.js');
const URETILMIS = process.env.PARITE_MOTOR === 'uretilmis';

// ---------------------------------------------------------------------
// Dilim imleri. Her im app.js'te TAM BİR KEZ geçmeli — geçmezse test
// sessizce yanlış kod ölçmek yerine gürültüyle durur.
// ---------------------------------------------------------------------
export const SLICES = [
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
  // Nedensellik (📉 Gunun Nedeni) cekirdegi: CAUSAL_INDEX_AFFINITY +
  // causalAlign + computeCausalLinks. OLCULDU (2026-10-18): bu bolgede
  // document/innerHTML/fetch/localStorage YOK — saf, girdi-cikti. DOM'a
  // dokunan renderCausalLinks ve LLM stub'i causalExplainLLM dilimin
  // DISINDA kaldi (bitis imi onlardan once). /api/causal bu yuzden
  // app.js'teki mantigi YENIDEN YAZMIYOR, motordan cagiriyor.
  ['causal', '  const CAUSAL_INDEX_AFFINITY = {', '  // Faz B stub — anahtar gelince'],
];

// Dilimlerden dışarı verilecek motor sembolleri.
export const EXPORTS = [
  'fetchYahooOHLC', 'yahooSymbol', 'resampleCandles', 'taTFIndicators', 'taRegime',
  'taNormalize', 'computeVadeScore', 'setTaScoreInd',
  'faInterp', 'faSD', 'faScoreSig', 'computeFaScore', 'faVerdict',
  // Ekran katmanından 2026-10-14'te devredildi (Commit C): F/K kriteri ve
  // FA/TA harmanı. Önceden app.js'te üçer kopyaydılar ve motorun
  // dışında kaldıkları için /api/score kullanıcının GÖRDÜĞÜ skoru
  // döndüremiyordu.
  'FA_PE', 'faPeCriterion',
  'faBand', 'taBand', 'COMPOSITE_MATRIX', 'COMPOSITE_BLEND', 'compositeBlend',
  'computeHolisticScore',
  // Plan katmanı: 2026-10-14'te ekran katmanından devredildi (D1).
  // momentumInfo + buyZoneProximity app.js'in sunum bölgesindeydi, risk/ödül
  // çekirdeği computeCompareVerdict'in içine gömülüydü; motor seviyeleri
  // (levels) üretiyordu ama PLANI üretmiyordu, yani /api/recommend kullanıcının
  // GÖRDÜĞÜ planı döndüremezdi. Türkçe cümleler çağrı noktasında kaldı.
  'momentumInfo', 'buyZoneProximity', 'planRiskReward',
  'fetchIsYatirimMali', 'parseIsMali', 'bistFundamentalModel',
  'secGet', 'secResolveCik', 'secFetchModel',
  // Nedensellik katmani: 2026-10-18'de /api/causal icin devredildi.
  // SKORA DOKUNMAZ — composite/vade skorunu ne okur ne yazar; yalniz
  // "hangi gundem konsepti bu endeks hareketiyle hizali" korelasyon
  // okumasidir. Turkce cumle yine cagri noktasinda.
  'CAUSAL_INDEX_AFFINITY', 'causalAlign', 'computeCausalLinks',
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
// DIŞA VERİLİ: tools/motor-uret.mjs api/_ayar.js'ü bundan üretiyor. İkinci bir
// uygulama yazılırsa iki ayar okuyucu doğar ve üretim testi kendi kopyasını
// doğrular — motor metninde olduğu gibi burada da tek kurulum yeri var.
export function loadConfig() {
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

// ---------------------------------------------------------------------
//  MOTOR METNİ — tek kurulum yeri.
//  Hem test (bellek içinde `new Function`) hem üretici
//  (tools/motor-uret.mjs → api/_motor.js) AYNI metni buradan kurar. İkisi
//  metni ayrı ayrı kurarsa iki motor doğar ve üretim testi kendi kopyasını
//  doğrular — yani hiçbir şeyi.
// ---------------------------------------------------------------------
export const PREAMBLE = [
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

/** Depodaki app.js'i oku (PARITE_APP ile başka bir adaya yöneltilebilir). */
export function readApp() {
  return fs.readFileSync(APP_PATH, 'utf8');
}

/**
 * app.js metninden motor gövdesini kur — dilimle, başa kabukları koy, sonuna
 * `return {...}` ekle.
 * @returns {{parts:{name:string,code:string}[], body:string, tail:string, govde:string}}
 *   `govde` iki yerde AYNEN kullanılabilir: `new Function('H', govde)` ve
 *   `function buildMotor(H) { <govde> }` — çünkü bir `return` ile bitiyor.
 */
export function engineSource(app) {
  const parts = SLICES.map(([n, a, b]) => ({ name: n, code: sliceOne(app, n, a, b) }));
  const body = parts.map((p) => `// ===== dilim: ${p.name} =====\n${p.code}`).join('\n');
  const tail = `\nreturn { ${EXPORTS.join(', ')} };\n`;
  return { parts, body, tail, govde: PREAMBLE + body + tail };
}

/** Dilim adı + satır sayısı. api/_motor.js bunu gömülü taşır (app.js okumadan). */
export function sliceInfo(parts) {
  return parts.map((p) => ({ name: p.name, lines: p.code.split('\n').length }));
}

/**
 * Konak kabuğu: motorun dışarıdan gördüğü HER ŞEY. Motor bunları yalnız
 * ÇAĞIRIR, içeriğini bilmez — aynı motor bu yüzden testte fikstürle,
 * sunucuda gerçek ağla koşabiliyor.
 * @param {object} opt
 * @param {(url:string)=>Promise<Response>} [opt.fetch]    ağ kabuğu (fetchYahooOHLC + secGet kullanır)
 * @param {(url:string,o?:object)=>Promise<string>} [opt.fetchVia]  İş Yatırım metin kabuğu
 * @param {object} [opt.taScoreInd]  gösterge aç/kapa (varsayılan: hepsi açık = {})
 */
export function makeHost(opt = {}) {
  const noNet = async () => { throw new Error('ag kabugu verilmedi: parite kosusunda canli istek YASAK'); };
  let cfg = null;
  const CFG = () => (cfg || (cfg = loadConfig()));   // config.js yalnız gerekirse okunur
  return {
    window: {
      TA_WEIGHTS: opt.window?.TA_WEIGHTS ?? CFG().TA_WEIGHTS,
      TA_BENCHMARK: opt.window?.TA_BENCHMARK ?? CFG().TA_BENCHMARK,
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
}

/**
 * Motoru kur ve sembollerini döndür.
 *
 * İKİ ŞERİT — ikisi de AYNI motor metnini koşturur:
  *   · varsayılan              → app.js dilimlenir, `new Function` ile derlenir
  *   · PARITE_MOTOR=uretilmis  → api/_motor.js DOSYASI yüklenir
 *
 * İkinci şerit /api/score'un sunucuda koşturacağı dosyayı ölçer. O dosya
 * app.js'ten ÜRETİLDİĞİ ve tests/uretim-test.mjs eşitliğini kanıtladığı için
 * bir kopya değil, aynı metnin ikinci taşıyıcısıdır.
 */
export function buildEngine(opt = {}) {
  const host = makeHost(opt);

  let api, dilimler;
  if (URETILMIS) {
    // createRequire: senkron require ile ESM yüklenebiliyor (Node 24, ölçüldü).
    // buildEngine'in SENKRON kalması zorunlu — dört çağrı yerinin hepsi öyle,
    // bu yüzden `await import` kullanılamıyor. Çapa Windows mutlak yolu olmak
    // zorunda: file:/// URL çapası reddediliyor.
    const req = createRequire(path.join(ROOT, 'package.json'));
    let mod;
    try {
      mod = req(MOTOR_PATH);
    } catch (e) {
      throw new Error(`uretilmis motor yuklenemedi: ${MOTOR_PATH}\n  ${e.message}\n  once uret: node tools/motor-uret.mjs`);
    }
    if (typeof mod.buildMotor !== 'function') throw new Error('uretilmis motor buildMotor() disa vermiyor');
    api = mod.buildMotor(host);
    dilimler = mod.DILIMLER;
  } else {
    const src = engineSource(readApp());
    try {
      // eslint-disable-next-line no-new-func
      api = new Function('H', src.govde)(host);
    } catch (e) {
      throw new Error('motor dilimleri derlenemedi: ' + e.message);
    }
    dilimler = sliceInfo(src.parts);
  }

  for (const k of EXPORTS) {
    if (api[k] === undefined) throw new Error(`motor sembolu bulunamadi: ${k} — dilim imleri kaymis olabilir`);
  }
  api._slices = dilimler;
  api._weights = host.window.TA_WEIGHTS;
  api._bench = host.window.TA_BENCHMARK;
  api._serit = URETILMIS ? 'uretilmis' : 'dilim';
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
  console.log(`serit: ${e._serit}`);
  console.log('dilimler:');
  for (const s of e._slices) console.log(`  ${s.name.padEnd(10)} ${String(s.lines).padStart(5)} satir`);
  console.log(`  ${'TOPLAM'.padEnd(10)} ${String(total).padStart(5)} satir`);
  console.log(`motor sembolu: ${EXPORTS.length} adet, hepsi bulundu`);
  console.log(`TA_WEIGHTS vadeleri: ${Object.keys(e._weights).join(', ')}`);
  console.log(`TA_BENCHMARK: ${JSON.stringify(e._bench)}`);
  const s = readSymbols();
  console.log(`referans evreni: ${s.rows.length} sembol (vade=${s.vade})`);
}
