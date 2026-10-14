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
//  EKRAN SABİTLERİ (2026-10-12): readRenderConstants() de burada. Motorun
//  kendisi değil ama aynı ilkeyle çalışıyor — app.js'ten OKUYOR, elle
//  kopyalanmıyor. Hem parite testi hem /api/score aynı çıkarıma ihtiyaç
//  duyuyor; dilimleyicide durması çözemediğimiz bir döngüyü önlüyor:
//  üretici → tests/score.mjs → api/score.js → api/_ekran.js (henüz yok).
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
];

// Dilimlerden dışarı verilecek motor sembolleri.
export const EXPORTS = [
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

// Düz metin geçiş sayısı (regex kaçağını yakalamak için).
function countAll(src, needle) {
  let n = 0, i = 0;
  for (;;) { const k = src.indexOf(needle, i); if (k < 0) return n; n++; i = k + 1; }
}

// ---------------------------------------------------------------------
// app.js'teki EKRAN KATMANI sabitlerini kaynaktan oku (elle kopyalama yok).
// Sabitler kayarsa test "geçmez"; "farklı sabitle ölçmüş" olmaz.
// ---------------------------------------------------------------------
export function readRenderConstants() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

  // --- 1) F/K kriteri: criteria.push({ key: 'pe', group: 'valuation', weight: … })
  const pushRe = /criteria\.push\(\{\s*key:\s*'pe',\s*group:\s*'valuation',\s*weight:\s*([\d.]+)/g;
  const sites = [];
  for (let m; (m = pushRe.exec(src)); ) {
    const at = m.index;
    const win = src.slice(Math.max(0, at - 700), at); // push'tan ÖNCEki pencere
    // EN YAKIN önceki eşleşmeyi al: pencerede birden fazla faInterp olabilir.
    const last = (re) => { let r = null; for (let x; (x = re.exec(win)); ) r = x; return r; };
    const bp = last(/faInterp\(pe,\s*(\[\[[^;]*?\]\])\)/g);
    const neg = last(/pe < 0\s*(?:\?|\)\s*\{\s*score\s*=)\s*(\d+)/g);
    if (!bp) throw new Error(`F/K kriteri ${at} konumunda: faInterp(pe, …) kırılım dizisi bulunamadi`);
    if (!neg) throw new Error(`F/K kriteri ${at} konumunda: pe<0 skoru bulunamadi`);
    sites.push({ at, weight: Number(m[1]), bpTxt: bp[1].replace(/\s+/g, ''), neg: Number(neg[1]) });
  }
  if (sites.length < 1) throw new Error("app.js: key:'pe' kriter eklemesi hic bulunamadi — ekran katmani degismis olabilir");
  const first = sites[0];
  for (const s of sites) {
    if (s.weight !== first.weight || s.bpTxt !== first.bpTxt || s.neg !== first.neg)
      throw new Error(
        `F/K kriteri KOPYALARI AYRISMIS — ekranlar artik ayni skoru uretmiyor.\n` +
        `  ${first.at}: w=${first.weight} neg=${first.neg} bp=${first.bpTxt}\n` +
        `  ${s.at}: w=${s.weight} neg=${s.neg} bp=${s.bpTxt}`);
  }
  const peBp = JSON.parse(first.bpTxt);

  // --- 2) Bileşke ağırlıkları: blended = 0.55 * faScore + 0.45 * X.score;
  // "const" OLMADAN da geçiyor (app.js:12023 → let blended önceden tanımlı).
  const blRe = /\bblended = ([\d.]+) \* faScore \+ ([\d.]+) \* [A-Za-z_$][\w$.]*\.score;/g;
  const bls = [];
  for (let m; (m = blRe.exec(src)); ) bls.push({ at: m.index, fa: Number(m[1]), ta: Number(m[2]) });
  if (!bls.length) throw new Error('app.js: bileske formulu (blended = … faScore …) bulunamadi');
  for (const b of bls) {
    if (b.fa !== bls[0].fa || b.ta !== bls[0].ta)
      throw new Error(`bileske agirliklari KOPYALAR ARASINDA AYRISMIS: ${bls[0].fa}/${bls[0].ta} vs ${b.fa}/${b.ta} (konum ${b.at})`);
  }
  // KAÇAK KONTROLÜ: regex'in gözden kaçırdığı bir harman olmasın.
  const blAll = countAll(src, '* faScore +');
  if (blAll !== bls.length)
    throw new Error(`bileske harmani: dosyada ${blAll} konum var, regex ${bls.length} tanesini yakaladi — biri farkli yazilmis`);
  const peAll = countAll(src, "key: 'pe'");
  if (peAll !== sites.length)
    throw new Error(`F/K kriteri: dosyada ${peAll} konum var, regex ${sites.length} tanesini yakaladi — biri farkli yazilmis`);

  return {
    pe: { weight: first.weight, neg: first.neg, bp: peBp, sites: sites.length },
    blend: { fa: bls[0].fa, ta: bls[0].ta, sites: bls.length },
  };
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
