#!/usr/bin/env node
// ===========================================================================
//  ÜRETİM TESTİ — üretilen üç dosya, kaynaklarının ŞU ANKİ hali mi?
// ===========================================================================
//
//  NEDEN VAR: `tests/engine.mjs` motoru kopyalamayı yasaklar — "motor
//  kopyalanırsa iki sürüm doğar ve parite testi kendi kopyasını doğrular,
//  yani hiçbir şeyi". `api/_motor.js` o yasağın içinden tek bir şartla
//  geçebilir: ELLE YAZILMAZ, app.js'ten üretilir ve HER KOŞUDA bu test
//  "dosya = app.js'in şu anki hali mi?" sorusunu sorar. Bu test kırmızıysa
//  dosya bir KOPYADIR ve /api/score'un ölçtüğü şey hiçbir şeydir.
//
//  NE ÖLÇER (10 bölüm)
//    ① dosya ve biçim      — var mı, satır sonu karışık mı, başlık tarihsiz mi
//    ② sürüklenme          — bellekte yeniden üret, diskteki ile karşılaştır
//    ③ imza                — gömülü IMZA = taze hesaplanan; imzala() duyarlı
//    ④ dilim tablosu       — DILIMLER = canlı sliceInfo(engineSource(app.js))
//    ⑤ modül yükü          — ayrıştırılıyor, üç sembolü doğru türde veriyor
//    ⑥ motor yüzeyi        — buildMotor() EXPORTS'un hepsini veriyor
//    ⑦ DAVRANIŞ eşitliği   — dilimlenmiş motor ile üretilmiş motor aynı
//                            sayıları veriyor. Ağ YOK: saf fonksiyonlar +
//                            run.mjs'teki 9 sentetik bütünsel vektör.
//    ⑧ olumsuz denetimler  — testin kendisi boş değil mi (4 kontrol)
//    ⑨ ayar taşıyıcısı     — api/_ayar.js = config.js el ağırlıkları mı;
//                            DERİN eşitlik, sızma denetimi, 2 olumsuz kontrol
//    ⑩ devredilen sabitler — F/K kriteri + FA/TA harmanı artık MOTORDA:
//                            iki motorda DERİN eşit, kırılım dizisi sağlam,
//                            silinen api/_ekran.js geri gelmemiş
//
//  ⑦ NEDEN TAM KARŞILAŞTIRMA: baseline.json kurulmuş cümleleri DONDURMAZ
//  (biçim FAZ 1/3'te belirteç dizisine geçiyor). Burada durum farklı: iki
//  taraf da AYNI kaynaktan türüyor, dolayısıyla cümlelerde bile bir fark
//  çıkarsa bu biçim tercihi değil, gerçek bir arızadır → `note` dahil her
//  alan karşılaştırılır.
//
//  DİKKAT — dilimlenmiş taraf buildEngine() İLE KURULMAZ: buildEngine
//  `PARITE_MOTOR`'u modül yüklenirken okur, yani `PARITE_MOTOR=uretilmis`
//  ile koşulursa üretilmiş motoru kendisiyle karşılaştırırdık — hiçbir şeyi
//  ölçmeyen bir test. Dilimlenmiş taraf bu yüzden elle kurulur.
//
//  KULLANIM
//    node tests/uretim-test.mjs
//
//  NOT: Node `api/_motor.js`'i yüklerken MODULE_TYPELESS_PACKAGE_JSON uyarısı
//  basar (package.json'da "type" alanı yok → önce CJS denenip ESM'e düşülüyor).
//  Zararsız; "type":"module" eklemek Vercel yapısını etkileyeceği için
//  bilerek yapılmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  SLICES, EXPORTS, readApp, engineSource, sliceInfo, makeHost, loadConfig,
} from './engine.mjs';
import { HOLISTIC_CASES } from './run.mjs';
import {
  CIKTI, CIKTI_AYAR, imzala,
  uretKaynak, uretAyarKaynak,
} from '../tools/motor-uret.mjs';

// --- küçük koşum defteri --------------------------------------------------
let gecen = 0;
const hatalar = [];
const ok = (ad, kosul, ek = '') => {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}${ek ? `  (${ek})` : ''}`); }
  else { hatalar.push(ad + (ek ? ` — ${ek}` : '')); console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ''}`); }
};
const bolum = (ad) => console.log(`\n${ad}`);
const bitir = () => {
  console.log(`\n${'─'.repeat(70)}`);
  if (hatalar.length) {
    console.log(`❌ ${hatalar.length} başarısız / ${gecen + hatalar.length} denetim`);
    for (const h of hatalar) console.log(`   · ${h}`);
    console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
    process.exit(1);
  }
  console.log(`✅ ${gecen} denetim geçti — _motor.js ↔ app.js, _ayar.js ↔ config.js birebir.`);
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(0);
};

const norm = (s) => s.replace(/\r\n/g, '\n');

/** İlk farklı satırın 1 tabanlı numarası; fark yoksa 0. */
const ilkFarkliSatir = (a, b) => {
  const A = a.split('\n'); const B = b.split('\n');
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) if (A[i] !== B[i]) return i + 1;
  return 0;
};

/** İlk farkın yolunu döndür; eşitse null. Fonksiyonlar metinleriyle kıyaslanır. */
function derinFark(a, b, yol = '') {
  const ad = yol || '<kök>';
  if (typeof a === 'function' || typeof b === 'function') {
    return String(a) === String(b) ? null : `${ad}: fonksiyon metni farklı`;
  }
  if (a === b) return null;
  if (typeof a === 'number' && typeof b === 'number'
      && Number.isNaN(a) && Number.isNaN(b)) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return `${ad}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return `${ad}: biri dizi, biri değil`;
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return `${ad}: alan sayısı ${ak.length} ≠ ${bk.length}`;
  for (const k of ak) {
    if (!(k in b)) return `${yol ? `${yol}.` : ''}${k}: sağ tarafta yok`;
    const f = derinFark(a[k], b[k], yol ? `${yol}.${k}` : k);
    if (f) return f;
  }
  return null;
}

/** ⑥ ve ⑧'in PAYLAŞTIĞI yüklem: motor yüzeyinde eksik sembol var mı? */
const eksikSembol = (api) => EXPORTS.filter((k) => !api || api[k] === undefined);

console.log('ÜRETİM TESTİ — _motor.js = app.js · _ayar.js = config.js');
console.log('═'.repeat(70));

// ===========================================================================
bolum('① Dosya ve biçim');
// ===========================================================================
const varMi = fs.existsSync(CIKTI);
ok('api/_motor.js var', varMi, varMi ? '' : 'üret: node tools/motor-uret.mjs');
if (!varMi) bitir();

const diskMetin = fs.readFileSync(CIKTI, 'utf8');
const lf = (diskMetin.match(/\n/g) || []).length;
const crlf = (diskMetin.match(/\r\n/g) || []).length;
// Kanonik biçim LF. Taze klonda core.autocrlf dosyayı TAMAMEN CRLF'e çevirir —
// bu bir sürüklenme DEĞİL. Kabul edilmeyen tek şey KARIŞIK dosya.
ok('satır sonu tek tip (karışık değil)', crlf === 0 || crlf === lf, `lf ${lf} / crlf ${crlf}`);

const govdeImi = 'export function buildMotor';
const basSonu = diskMetin.indexOf(govdeImi);
ok('başlık sınırı bulunabiliyor', basSonu > 0, `"${govdeImi}" @ ${basSonu}`);
const baslik = basSonu > 0 ? diskMetin.slice(0, basSonu) : diskMetin.slice(0, 3000);

ok('"ELLE DÜZENLEMEYİN" uyarısı başlıkta', baslik.includes('ELLE DÜZENLEMEYİN'));
ok('yenileme komutu başlıkta', baslik.includes('node tools/motor-uret.mjs'));
ok('doğrulama komutu başlıkta', baslik.includes('node tests/uretim-test.mjs'));
ok('yasal uyarı başlıkta', baslik.includes('Bilgi amaçlıdır, yatırım tavsiyesi değildir.'));
// Tarih yazılsa dosya ertesi gün kendi kendine "sürüklenmiş" görünürdü.
const tarih = baslik.match(/\b20\d\d-\d\d-\d\d\b/);
ok('başlık tarihsiz (kendi kendine sürüklenemez)', !tarih, tarih ? `bulundu: ${tarih[0]}` : '');

// ===========================================================================
bolum('② Sürüklenme — dosya app.js\'in ŞU ANKİ hali mi?');
// ===========================================================================
const taze = uretKaynak();
const esit = norm(diskMetin) === norm(taze.metin);
ok('bellekte yeniden üretilen metin diskteki ile aynı', esit,
  esit ? `${(norm(taze.metin).match(/\n/g) || []).length} satır`
    : `ilk farklı satır: ${ilkFarkliSatir(norm(diskMetin), norm(taze.metin))} → düzelt: node tools/motor-uret.mjs`);

// ===========================================================================
bolum('③ İmza');
// ===========================================================================
const imzaEsl = diskMetin.match(/export const IMZA = '([^']+)';/);
ok('IMZA dosyaya gömülü', !!imzaEsl, imzaEsl ? imzaEsl[1] : '');
ok('gömülü IMZA taze hesaplananla aynı', !!imzaEsl && imzaEsl[1] === taze.imza,
  imzaEsl ? `${imzaEsl[1]} / ${taze.imza}` : 'IMZA okunamadı');
ok('imzala() belirlenimci', imzala('bulten') === imzala('bulten'));
ok('imzala() tek karaktere duyarlı', imzala('bulten') !== imzala('bulteo'));
ok('imza biçimi sha256:16hex', /^sha256:[0-9a-f]{16}$/.test(taze.imza), taze.imza);

// ===========================================================================
bolum('④ Dilim tablosu');
// ===========================================================================
const canliDilimler = sliceInfo(engineSource(readApp()).parts);
ok('DILIMLER dilim sayısı SLICES ile aynı', taze.dilimler.length === SLICES.length,
  `${taze.dilimler.length} / ${SLICES.length}`);
const dilimFark = derinFark(taze.dilimler, canliDilimler, 'DILIMLER');
ok('DILIMLER canlı sliceInfo() ile birebir', dilimFark === null, dilimFark || `toplam ${taze.toplam} satır`);

// ===========================================================================
bolum('⑤ Modül yükü');
// ===========================================================================
let mod = null; let yukHata = '';
try {
  mod = await import(pathToFileURL(CIKTI).href);
} catch (e) { yukHata = e.message; }
ok('modül ayrıştırılıp yükleniyor', !!mod, yukHata);
if (!mod) bitir();
ok('buildMotor dışa veriliyor (function)', typeof mod.buildMotor === 'function', typeof mod.buildMotor);
ok('IMZA dışa veriliyor (string)', typeof mod.IMZA === 'string', typeof mod.IMZA);
ok('DILIMLER dışa veriliyor (array)', Array.isArray(mod.DILIMLER), typeof mod.DILIMLER);
ok('modüldeki IMZA = dosyadaki IMZA', !!imzaEsl && mod.IMZA === imzaEsl[1]);
const modDilimFark = derinFark(mod.DILIMLER, canliDilimler, 'mod.DILIMLER');
ok('modüldeki DILIMLER canlı sliceInfo() ile birebir', modDilimFark === null, modDilimFark || '');

// ===========================================================================
bolum('⑥ Motor yüzeyi');
// ===========================================================================
let uretilmis = null; let kurHata = '';
try { uretilmis = mod.buildMotor(makeHost({})); } catch (e) { kurHata = e.message; }
ok('buildMotor(makeHost({})) kuruluyor', !!uretilmis, kurHata);
if (!uretilmis) bitir();
const eksik = eksikSembol(uretilmis);
ok('EXPORTS sembollerinin hepsi var', eksik.length === 0,
  eksik.length ? `eksik: ${eksik.join(', ')}` : `${EXPORTS.length} sembol`);

// ===========================================================================
bolum('⑦ Davranış eşitliği — dilimlenmiş motor ⟷ üretilmiş motor');
// ===========================================================================
// Dilimlenmiş taraf ELLE kurulur (başlıktaki DİKKAT notu): buildEngine
// PARITE_MOTOR'u modül yükünde okuduğu için kullanılmaz.
let dilimli = null; let dilimHata = '';
try {
  // eslint-disable-next-line no-new-func
  dilimli = new Function('H', engineSource(readApp()).govde)(makeHost({}));
} catch (e) { dilimHata = e.message; }
ok('dilimlenmiş motor kuruluyor (karşılaştırma tarafı)', !!dilimli, dilimHata);
if (!dilimli) bitir();

// 7a — sabit tablo
const matFark = derinFark(dilimli.COMPOSITE_MATRIX, uretilmis.COMPOSITE_MATRIX, 'COMPOSITE_MATRIX');
ok('COMPOSITE_MATRIX birebir', matFark === null, matFark || '');

// 7b — faInterp. Tablodan bağımsız bir ara-değer biçicisi; hem gerçek tablo
// hem de yön/işaret kenarları süpürülür.
const TABLOLAR = [
  // app.js ekran katmanındaki gerçek F/K tablosu (azalan)
  [[5, 90], [10, 80], [15, 70], [20, 60], [25, 52], [35, 38], [50, 22], [80, 10]],
  // artan + negatif x
  [[-20, 5], [0, 30], [10, 65], [25, 95]],
  // düz parça + sıçrama
  [[0, 50], [1, 50], [2, 10]],
];
let interpNokta = 0; let interpFark = null;
for (let t = 0; t < TABLOLAR.length && !interpFark; t++) {
  const pts = TABLOLAR[t];
  for (let x = -30; x <= 120 && !interpFark; x += 0.25) {
    const f = derinFark(dilimli.faInterp(x, pts), uretilmis.faInterp(x, pts), `faInterp(${x}, t${t})`);
    if (f) interpFark = f; else interpNokta++;
  }
  for (const kenar of [null, undefined, NaN, '', 0, -0, Infinity, -Infinity]) {
    const f = derinFark(dilimli.faInterp(kenar, pts), uretilmis.faInterp(kenar, pts),
      `faInterp(${String(kenar)}, t${t})`);
    if (f) { interpFark = f; break; }
    interpNokta++;
  }
}
ok('faInterp birebir', interpFark === null, interpFark || `${interpNokta} nokta`);

// 7c — bant sınıflayıcıları (eşik sınırları dahil)
let bantNokta = 0; let bantFark = null;
for (let s = -5; s <= 105 && !bantFark; s += 0.5) {
  const f1 = derinFark(dilimli.faBand(s), uretilmis.faBand(s), `faBand(${s})`);
  const f2 = derinFark(dilimli.taBand(s), uretilmis.taBand(s), `taBand(${s})`);
  if (f1 || f2) bantFark = f1 || f2; else bantNokta += 2;
}
ok('faBand/taBand birebir', bantFark === null, bantFark || `${bantNokta} nokta`);

// 7d — bütünsel skor: run.mjs'teki 9 sentetik vektör, TAM sonuç karşılaştırması
let butFark = null; let butSayi = 0;
for (const [ad, inp] of HOLISTIC_CASES) {
  const f = derinFark(dilimli.computeHolisticScore(inp), uretilmis.computeHolisticScore(inp), `holistic[${ad}]`);
  if (f) { butFark = f; break; }
  butSayi++;
}
ok('computeHolisticScore birebir (tam sonuç, cümleler dahil)', butFark === null,
  butFark || `${butSayi}/${HOLISTIC_CASES.length} vektör`);

// 7e — bant/sınıf yüzeyi
const bandFark = derinFark(
  { fa: dilimli.faBand(61), ta: dilimli.taBand(61), v: dilimli.faVerdict ? typeof dilimli.faVerdict : null },
  { fa: uretilmis.faBand(61), ta: uretilmis.taBand(61), v: uretilmis.faVerdict ? typeof uretilmis.faVerdict : null },
  'yüzey',
);
ok('faVerdict/faBand/taBand yüzeyi aynı türde', bandFark === null, bandFark || '');

// ===========================================================================
bolum('⑧ Olumsuz denetimler — bu test boş değil mi?');
// ===========================================================================
// N1: ② yukarıda yeşil yandı. Metin karşılaştırması gerçekten fark görüyor mu?
const bozukMetin = `${taze.metin.slice(0, 120)}X${taze.metin.slice(121)}`;
ok('N1 · bozulmuş metin ② karşılaştırmasında FARK verir',
  norm(diskMetin) !== norm(bozukMetin),
  `ilk farklı satır: ${ilkFarkliSatir(norm(diskMetin), norm(bozukMetin))}`);

// N2: ⑥'nın yüklemi gerçekten eksik sembol yakalıyor mu?
const sakat = { ...uretilmis };
delete sakat[EXPORTS[0]];
const sakatEksik = eksikSembol(sakat);
ok('N2 · eksik sembollü motor ⑥ yüklemini düşürür',
  sakatEksik.length === 1 && sakatEksik[0] === EXPORTS[0], `yakalanan: ${sakatEksik.join(', ')}`);

// N3: ④'ün derin eşitliği gerçekten hassas mı?
const dokunulmus = taze.dilimler.map((d, i) => (i === 0 ? { ...d, lines: d.lines + 1 } : d));
ok('N3 · dokunulmuş DILIMLER ④ eşitliğini bozar',
  derinFark(dokunulmus, canliDilimler, 'DILIMLER') !== null);

// N4: ⑦d'nin derin karşılaştırması 1e-9'luk bir kaymayı bile görüyor mu?
const ornek = dilimli.computeHolisticScore(HOLISTIC_CASES[0][1]);
const kaydirilmis = JSON.parse(JSON.stringify(ornek));
kaydirilmis.score10 = (kaydirilmis.score10 ?? 0) + 1e-9;
ok('N4 · 1e-9 kaydırılmış sonuç ⑦d karşılaştırmasında yakalanır',
  derinFark(JSON.parse(JSON.stringify(ornek)), kaydirilmis, 'holistic') !== null);

// ===========================================================================
bolum('⑨ Ayar taşıyıcısı — api/_ayar.js, config.js\'in ŞU ANKİ hali mi?');
// ===========================================================================
// NEDEN AYRI BİR BÖLÜM: /api/score motoru kurarken el ağırlıklarına ihtiyaç
// duyuyor, config.js ise bir tarayıcı varlığı (window.*). Ağırlıklar
// KOPYALANMAZ — config.js tek doğruluk kaynağı kalır, api/_ayar.js ondan
// ÜRETİLİR. Bu bölüm üreticinin "JSON gidiş-dönüşü kayıpsız" sözünü lafta
// bırakmayıp DERİN EŞİTLİKLE tahsil eder.
const ayarVar = fs.existsSync(CIKTI_AYAR);
ok('api/_ayar.js var', ayarVar, ayarVar ? '' : 'üret: node tools/motor-uret.mjs');

if (ayarVar) {
  const ayarMetin = fs.readFileSync(CIKTI_AYAR, 'utf8');
  const cfg = loadConfig();

  const aLf = (ayarMetin.match(/\n/g) || []).length;
  const aCrlf = (ayarMetin.match(/\r\n/g) || []).length;
  ok('ayar: satır sonu tek tip (karışık değil)', aCrlf === 0 || aCrlf === aLf, `lf ${aLf} / crlf ${aCrlf}`);

  const ayarImi = 'export const IMZA_AYAR';
  const aBasSonu = ayarMetin.indexOf(ayarImi);
  ok('ayar: başlık sınırı bulunabiliyor', aBasSonu > 0, `"${ayarImi}" @ ${aBasSonu}`);
  const aBaslik = aBasSonu > 0 ? ayarMetin.slice(0, aBasSonu) : ayarMetin;

  ok('ayar: "ELLE DÜZENLEMEYİN" uyarısı başlıkta', aBaslik.includes('ELLE DÜZENLEMEYİN'));
  ok('ayar: yenileme komutu başlıkta', aBaslik.includes('node tools/motor-uret.mjs'));
  ok('ayar: doğrulama komutu başlıkta', aBaslik.includes('node tests/uretim-test.mjs'));
  ok('ayar: yasal uyarı başlıkta', aBaslik.includes('Bilgi amaçlıdır, yatırım tavsiyesi değildir.'));
  const aTarih = aBaslik.match(/\b20\d\d-\d\d-\d\d\b/);
  ok('ayar: başlık tarihsiz (kendi kendine sürüklenemez)', !aTarih, aTarih ? `bulundu: ${aTarih[0]}` : '');

  // --- sürüklenme ve imza ---------------------------------------------------
  const tazeAyar = uretAyarKaynak();
  const ayarEsit = norm(ayarMetin) === norm(tazeAyar.metin);
  ok('ayar: bellekte yeniden üretilen metin diskteki ile aynı', ayarEsit,
    ayarEsit ? `${(norm(tazeAyar.metin).match(/\n/g) || []).length} satır`
      : `ilk farklı satır: ${ilkFarkliSatir(norm(ayarMetin), norm(tazeAyar.metin))} → düzelt: node tools/motor-uret.mjs`);

  const aImzaEsl = ayarMetin.match(/export const IMZA_AYAR = '([^']+)';/);
  ok('ayar: IMZA_AYAR gömülü', !!aImzaEsl, aImzaEsl ? aImzaEsl[1] : 'bulunamadı');
  if (aImzaEsl) {
    ok('ayar: gömülü IMZA_AYAR = taze hesaplanan', aImzaEsl[1] === tazeAyar.imza,
      `${aImzaEsl[1]} ↔ ${tazeAyar.imza}`);
  }

  // --- modül yükü ve DERİN EŞİTLİK -----------------------------------------
  let ayarMod = null; let ayarHata = '';
  try { ayarMod = await import(pathToFileURL(CIKTI_AYAR).href); } catch (e) { ayarHata = e.message; }
  ok('ayar: ESM olarak yükleniyor', ayarMod !== null, ayarHata);

  if (ayarMod) {
    ok('ayar: üç sembol doğru türde',
      Array.isArray(ayarMod.VADELER)
      && !!ayarMod.TA_WEIGHTS && typeof ayarMod.TA_WEIGHTS === 'object'
      && !!ayarMod.TA_BENCHMARK && typeof ayarMod.TA_BENCHMARK === 'object',
      `VADELER ${ayarMod.VADELER?.length} · TA_WEIGHTS ${Object.keys(ayarMod.TA_WEIGHTS || {}).length} vade`);

    // İŞİN KALBİ: üretilen dosya ile config.js aynı sayıları taşıyor mu?
    // Metin karşılaştırması bunu ispat etmez — JSON.stringify bir alanı
    // sessizce düşürürse iki taraf da aynı metni üretir ve sürüklenme
    // denetimi yeşil kalır. Derin eşitlik o sessiz kaybı kapatıyor.
    const wFark = derinFark(cfg.TA_WEIGHTS, ayarMod.TA_WEIGHTS, 'TA_WEIGHTS');
    ok('ayar: TA_WEIGHTS config.js ile DERİN eşit (JSON kaybı yok)', wFark === null,
      wFark || `${Object.keys(cfg.TA_WEIGHTS).length} vade karşılaştırıldı`);
    const bFark = derinFark(cfg.TA_BENCHMARK, ayarMod.TA_BENCHMARK, 'TA_BENCHMARK');
    ok('ayar: TA_BENCHMARK config.js ile DERİN eşit', bFark === null,
      bFark || JSON.stringify(ayarMod.TA_BENCHMARK));

    const vFark = derinFark(Object.keys(ayarMod.TA_WEIGHTS), ayarMod.VADELER, 'VADELER');
    ok('ayar: VADELER = Object.keys(TA_WEIGHTS)', vFark === null, vFark || ayarMod.VADELER.join(', '));
    const vFark2 = derinFark(Object.keys(cfg.TA_WEIGHTS), ayarMod.VADELER, 'VADELER');
    ok('ayar: VADELER config.js\'teki SIRAYLA aynı', vFark2 === null, vFark2 || '');

    // N5: yukarıdaki derin eşitlik gerçekten hassas mı?
    const kaymis = JSON.parse(JSON.stringify(ayarMod.TA_WEIGHTS));
    const ilkVade = ayarMod.VADELER[0];
    const ilkAgirlik = Object.keys(kaymis[ilkVade]?.weights || {})[0];
    if (ilkAgirlik) kaymis[ilkVade].weights[ilkAgirlik] += 1e-9;
    ok('N5 · 1e-9 kaydırılmış el ağırlığı derin eşitlikte yakalanır',
      !!ilkAgirlik && derinFark(cfg.TA_WEIGHTS, kaymis, 'TA_WEIGHTS') !== null,
      ilkAgirlik ? `${ilkVade}.weights.${ilkAgirlik}` : 'ağırlık alanı bulunamadı');
  }

  // --- SIZMA DENETİMİ ------------------------------------------------------
  // config.js'teki BÜTÜN window.* anahtarları taranır, izin verilen ikisi
  // dışında. Kendi kendini sürdürür: config.js'e yarın yeni bir sır eklenirse
  // bu denetim onu da kapsar, testi elle güncellemek gerekmez.
  // Sır DEĞERLERİ bu dosyaya YAZILMAZ — config.js'ten okunur ve başarısızlık
  // iletisinde de basılmaz, yalnız sayısı bildirilir.
  const IZIN = ['TA_WEIGHTS', 'TA_BENCHMARK'];
  const dizele = (v) => {
    if (typeof v === 'string') return [v];
    if (Array.isArray(v)) return v.flatMap(dizele);
    if (v && typeof v === 'object') return Object.values(v).flatMap(dizele);
    return [];
  };
  const izinliMetin = JSON.stringify({ TA_WEIGHTS: cfg.TA_WEIGHTS, TA_BENCHMARK: cfg.TA_BENCHMARK });
  const yasakAdlar = Object.keys(cfg).filter((k) => !IZIN.includes(k));
  // 10 bayttan kısa dizeler atlanır (hisse kodu gibi parçalar yanlış alarm
  // üretir); izin verilen iki anahtarda da geçen bir dize aday sayılmaz.
  const adaylar = [...new Set(yasakAdlar.flatMap((k) => dizele(cfg[k])))]
    .filter((s) => s.length >= 10 && !izinliMetin.includes(s));
  const sizanSayi = adaylar.filter((s) => ayarMetin.includes(s)).length;
  ok('ayar: config.js sırları ve besleme listeleri üretilen dosyada YOK', sizanSayi === 0,
    sizanSayi ? `${sizanSayi} değer sızmış — bkz. tools/motor-uret.mjs` : `${adaylar.length} aday değer tarandı`);

  // Anahtar ADLARI başlıkta BİLEREK yazılı ("Alınmayan: NTFY_TOPIC, ..."),
  // gövdede olmamalı.
  const aGovde = aBasSonu > 0 ? ayarMetin.slice(aBasSonu) : ayarMetin;
  const sizanAd = yasakAdlar.filter((k) => aGovde.includes(k));
  ok('ayar: yasak anahtar adları GÖVDEDE yok', sizanAd.length === 0,
    sizanAd.length ? sizanAd.join(', ') : `${yasakAdlar.length} ad tarandı`);

  // N6: sızma denetimi gerçekten bir şey arıyor mu?
  const ekiliMetin = adaylar.length ? `${ayarMetin}\n// ${adaylar[0]}\n` : ayarMetin;
  ok('N6 · ekilmiş bir sır sızma denetimini KIRMIZI yakar',
    adaylar.length > 0 && adaylar.some((s) => ekiliMetin.includes(s)),
    adaylar.length ? 'ekildi ve yakalandı' : 'aday yok — denetim boş olurdu');
}

// ===========================================================================
bolum('⑩ Devredilen ekran sabitleri — F/K kriteri + FA/TA harmanı artık MOTORDA');
// ===========================================================================
// BU BÖLÜM NE OLDU: 2026-10-14'e kadar burada "⑩ Ekran taşıyıcısı" vardı —
// api/_ekran.js diye GEÇİCİ bir üçüncü dosyayı app.js ekran katmanına karşı
// denetliyordu. Sebep: motorun döndürdüğü skor kullanıcının GÖRDÜĞÜ skor
// değildi; ekran araya F/K "Değerleme" kriterini ve FA/TA harmanını
// sokuyordu, üçer kopya halinde. İkisi de motora devredildi (FA_PE /
// faPeCriterion · COMPOSITE_BLEND / compositeBlend), ekran kopyaları
// kaldırıldı, taşıyıcı SİLİNDİ.
//
// NEDEN BÖLÜM KAPATILMADI: taşıyıcı gitti ama o dosyanın tahsil ettiği İKİ
// SORU hâlâ geçerli ve artık yeni sahibine soruluyor — (a) iki motor aynı
// sabitleri mi taşıyor, (b) sabitlerin KENDİSİ sağlam mı. Sayı denetimi
// azaldı çünkü metin sürüklenmesi/imza soruları bu sabitler için ①-③ ve
// ⑦ zaten soruyor: artık motorun İÇİNDELER.

// 10a — iki motor aynı sabitleri taşıyor mu? (⑦ ile aynı mantık, bu iki
// sabit ⑦'nin tablolarına girmiyor diye ayrıca yüzleştiriliyor.)
const peFark = derinFark(dilimli.FA_PE, uretilmis.FA_PE, 'FA_PE');
ok('FA_PE dilimlenmiş ⟷ üretilmiş DERİN eşit', peFark === null,
  peFark || `ağırlık ${uretilmis.FA_PE.weight} · pe<0 → ${uretilmis.FA_PE.neg} · ${uretilmis.FA_PE.bp.length} kırılım`);

const blFark = derinFark(dilimli.COMPOSITE_BLEND, uretilmis.COMPOSITE_BLEND, 'COMPOSITE_BLEND');
ok('COMPOSITE_BLEND dilimlenmiş ⟷ üretilmiş DERİN eşit', blFark === null,
  blFark || `FA ${uretilmis.COMPOSITE_BLEND.fa} + TA ${uretilmis.COMPOSITE_BLEND.ta}`);

// 10b — kriteri ÜRETEN işlev de aynı nesneyi veriyor mu? Sabit eşitliği
// yetmez: alan adı/sırası ya da pe<0 dalı kayarsa sabitler aynı kalır ama
// kriter nesnesi farklı çıkar ve kullanıcı farklı bir skor görür.
let kritFark = null;
for (const pe of [-5, 0, 4.9, 15, 22.5, 80, 140]) {
  const f = derinFark(dilimli.faPeCriterion(pe, ''), uretilmis.faPeCriterion(pe, ''), `faPeCriterion(${pe})`);
  if (f) { kritFark = f; break; }
}
ok('faPeCriterion iki motorda aynı kriter nesnesini veriyor', kritFark === null,
  kritFark || '7 nokta: -5 · 0 · 4.9 · 15 · 22.5 · 80 · 140');

let harFark = null;
for (const [fa, ta] of [[0, 0], [72, 58], [100, 0], [0, 100], [45.5, 61.25]]) {
  if (dilimli.compositeBlend(fa, ta) !== uretilmis.compositeBlend(fa, ta)) {
    harFark = `${fa}/${ta}: ${dilimli.compositeBlend(fa, ta)} ≠ ${uretilmis.compositeBlend(fa, ta)}`;
    break;
  }
}
ok('compositeBlend iki motorda aynı sayıyı veriyor', harFark === null,
  harFark || '5 nokta: 0/0 · 72/58 · 100/0 · 0/100 · 45.5/61.25');

// 10c — sabitlerin KENDİSİ sağlam mı? Harman payları 1'e tamamlanmazsa
// bileşke 0-100 bandından kayar ve kullanıcı anlamsız bir sayı görür.
const harToplam = uretilmis.COMPOSITE_BLEND.fa + uretilmis.COMPOSITE_BLEND.ta;
ok('COMPOSITE_BLEND payları 1\'e tamamlanıyor', Math.abs(harToplam - 1) < 1e-12, `toplam ${harToplam}`);

// Kırılım dizisi biçimi: [x, skor] çiftleri ve x ARTAN. faInterp artan sıra
// varsayıyor; sıra bozulursa ara değerleme sessizce yanlış skor üretir —
// patlamaz, sadece yanlış olur. En sinsi arıza türü.
const bp = uretilmis.FA_PE.bp;
const bpBicim = Array.isArray(bp) && bp.length > 1
  && bp.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number'));
ok('FA_PE.bp [x, skor] çiftlerinden oluşuyor', bpBicim, `${bp?.length} çift`);
const bpArtan = bpBicim && bp.every((p, i) => i === 0 || p[0] > bp[i - 1][0]);
ok('FA_PE.bp x ekseni ARTAN (faInterp bunu varsayar)', bpArtan,
  bpBicim ? bp.map((p) => p[0]).join(' < ') : 'biçim bozuk');

// 10d — silinen taşıyıcı geri gelmemiş. Bir üretici ya da elle kopya onu
// yeniden yazarsa iki sabit kümesi doğar (motor + dosya) ve /api/score
// hangisini okuduğuna göre sessizce ayrışır. Dosyanın YOKLUĞU bir denetim.
const ekranKalinti = fs.existsSync(CIKTI.replace(/_motor\.js$/, '_ekran.js'));
ok('silinen api/_ekran.js geri gelmemiş', !ekranKalinti,
  ekranKalinti ? 'dosya yeniden doğmuş — sabitler motorda, bu dosya SİLİNMELİ' : 'yok');

// N7: derin eşitlik gerçekten hassas mı? (⑧'in mantığı, bu sabitler için.)
const bpKaymis = JSON.parse(JSON.stringify(uretilmis.FA_PE));
bpKaymis.bp[0][1] += 1e-9;
ok('N7 · 1e-9 kaydırılmış kırılım derin eşitlikte yakalanır',
  derinFark(dilimli.FA_PE, bpKaymis, 'FA_PE') !== null, 'bp[0][1] + 1e-9');

// ===========================================================================
bolum('⑪ Devredilen plan katmanı — momentum · banda yakınlık · risk/ödül MOTORDA');
// ===========================================================================
// BU BÖLÜM NE: 2026-10-14'te (D1) ÜÇ saf hesap ekran katmanından motora indi —
// momentumInfo, buyZoneProximity, planRiskReward. Gerekçe ⑩'un aynısı: motor
// `levels` üretiyor ama PLANI üretmiyordu, yani /api/recommend kullanıcının
// GÖRDÜĞÜ planı döndüremezdi.
//
// Tahsil edilen İKİ soru:
//   (a) iki motor aynı SAYIYI mı veriyor,
//   (b) motordan çıkan yüzey HAM SAYI mı — emoji / toFixed / para birimi YOK.
// (b) boş bir formalite değil: buyZoneProximity'nin eski `txt` alanı tam olarak
// bunu ihlal ediyordu ('🟢 …' + `${dAtr.toFixed(1)}×ATR`). Bir gün biri "kolay
// olsun" diye onu geri koyarsa, uç nokta Türkçe HTML yayınlamaya başlar ve
// native istemci kendi dilinde cümle kurma hakkını kaybeder.
//
// NEDEN ⑦'YE EKLENMEDİ: ⑦ tablo/bant süpürmesi (sayı → sayı). Bunlar `levels`
// NESNESİ alıyor, yani kendi vektör tablosunu gerektiriyor.

// Temel seviye vektörü: fiyat 100, alım bandı 92-96, satış bandı 118-124,
// SMA50 94, SMA200 85, ATR 3, 2×ATR stop 88. Her vektör bundan SAPAR.
const planSeviye = (o) => Object.assign({
  price: 100, target: 130, stop: 88, rr: 2, poc: 98, atr: 3,
  buyZone: [92, 96], sellZone: [118, 124], zMult: 1, sellKind: 'sell',
  sma50: 94, sma200: 85, anchorKind: 'sma50', anchorSrc: 'daily',
}, o || {});

const PLAN_VEKTOR = [
  ['tipik-yukselis', planSeviye()],
  ['fiyat-bantta', planSeviye({ price: 94 })],
  ['fiyat-bant-alti', planSeviye({ price: 90 })],
  ['banda-yakin-1atr', planSeviye({ price: 98 })],
  ['banda-uzak', planSeviye({ price: 112 })],
  ['atr-yok', planSeviye({ atr: null })],
  ['atr-sifir', planSeviye({ atr: 0 })],
  ['fiyat-yok', planSeviye({ price: null })],
  ['bant-yok', planSeviye({ buyZone: null })],
  ['bant-tek-kenar', planSeviye({ buyZone: [92, null] })],
  ['satis-yok', planSeviye({ sellZone: null })],
  ['satis-tek-kenar', planSeviye({ sellZone: [null, 120] })],
  ['satis-ters', planSeviye({ sellZone: [124, 118] })],
  ['kat-esitligi', planSeviye({ sma50: 94, buyZone: [94, 96] })],
  ['tek-kat-sma200', planSeviye({ sma50: null, buyZone: [null, 96] })],
  ['kat-yok-stop-var', planSeviye({ sma50: 120, sma200: 130, buyZone: [120, 125] })],
  ['kat-yok-stop-yok', planSeviye({ sma50: 120, sma200: 130, buyZone: [120, 125], stop: 140 })],
  ['uzun-ufuk-target', planSeviye({ sellKind: 'target' })],
  ['sma-dizilimi-ters', planSeviye({ sma50: 84, sma200: 94 })],
  ['seviye-yok', null],
];
// momentumInfo skor + ADX kapılarına bakıyor; dört köşe de süpürülür.
const PLAN_RES = [
  ['guclu-trend', { score: 70, adxVal: 30 }],
  ['zayif-adx', { score: 70, adxVal: 10 }],
  ['dusuk-skor', { score: 40, adxVal: 30 }],
  ['adx-yok', { score: 70, adxVal: null }],
];
const PLAN_VADE = ['gunici', 'kisa', 'orta', 'uzun', 'bilinmeyen'];

// 11a — momentumInfo: vektör × res × vade, TAM sonuç karşılaştırması.
let momFark = null; let momNokta = 0;
for (const [vad, lv] of PLAN_VEKTOR) {
  for (const [rad, rv] of PLAN_RES) {
    for (const vk of PLAN_VADE) {
      const res = { ...rv, levels: lv };
      const f = derinFark(dilimli.momentumInfo(res, vk), uretilmis.momentumInfo(res, vk),
        `momentumInfo[${vad}/${rad}/${vk}]`);
      if (f) { momFark = f; break; }
      momNokta++;
    }
    if (momFark) break;
  }
  if (momFark) break;
}
ok('momentumInfo iki motorda birebir', momFark === null, momFark || `${momNokta} nokta`);

// 11b — buyZoneProximity.
let proxFark = null; let proxNokta = 0;
for (const [vad, lv] of PLAN_VEKTOR) {
  const f = derinFark(dilimli.buyZoneProximity({ levels: lv }), uretilmis.buyZoneProximity({ levels: lv }),
    `buyZoneProximity[${vad}]`);
  if (f) { proxFark = f; break; }
  proxNokta++;
}
ok('buyZoneProximity iki motorda birebir', proxFark === null, proxFark || `${proxNokta} vektör`);

// 11c — planRiskReward.
let rrFark = null; let rrNokta = 0;
for (const [vad, lv] of PLAN_VEKTOR) {
  const f = derinFark(dilimli.planRiskReward(lv), uretilmis.planRiskReward(lv), `planRiskReward[${vad}]`);
  if (f) { rrFark = f; break; }
  rrNokta++;
}
ok('planRiskReward iki motorda birebir', rrFark === null, rrFark || `${rrNokta} vektör`);

// 11d — HAM SAYI KURALI (BAGIMLILIK_GRAFIGI §5.1): plan katmanından çıkan her
// dize SABİT KÜMEDEN olmalı. Serbest metin = biçimlenmiş cümle sızıntısı.
const PLAN_ETIKET = new Set(['below', 'in', 'near', 'far',
  'sma50', 'swingLow', 'sma200', 'atrStop', 'sell', 'target']);
const dizeTopla = (v, yol, cikti) => {
  if (typeof v === 'string') { cikti.push([yol, v]); return cikti; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) dizeTopla(v[k], `${yol}.${k}`, cikti);
  return cikti;
};
const kacak = [];
for (const [vad, lv] of PLAN_VEKTOR) {
  dizeTopla(uretilmis.buyZoneProximity({ levels: lv }), `prox[${vad}]`, kacak);
  dizeTopla(uretilmis.planRiskReward(lv), `rr[${vad}]`, kacak);
  for (const vk of PLAN_VADE) dizeTopla(uretilmis.momentumInfo({ score: 70, adxVal: 30, levels: lv }, vk), `mom[${vad}/${vk}]`, kacak);
}
const yabanci = kacak.filter(([, v]) => !PLAN_ETIKET.has(v));
ok('plan katmanı yalnız SABİT KÜMELİ etiket döndürüyor (emoji/toFixed/₺ yok)',
  yabanci.length === 0,
  yabanci.length ? yabanci.slice(0, 3).map(([y, v]) => `${y}=${JSON.stringify(v)}`).join(' · ')
    : `${kacak.length} dize denetlendi, hepsi kümede`);

// 11e — eski `txt` alanı geri gelmemiş. ⑩d'nin mantığı: bir alanın YOKLUĞU
// bir denetimdir. `txt` geri gelirse uç nokta Türkçe cümle yayınlar.
const proxOrnek = uretilmis.buyZoneProximity({ levels: PLAN_VEKTOR[0][1] }) || {};
ok('buyZoneProximity sonucunda `txt` alanı YOK (cümle sunum katmanında)',
  !('txt' in proxOrnek), Object.keys(proxOrnek).join(', '));

// 11f — EŞİTLİK KURALI kilidi: iki kat aynı seviyedeyse ilk sıra (sma50)
// kazanır. Eski Math.max kopyası aynı SAYIYI verirdi ama hangi katın
// kazandığını söylemiyordu; etiket yeni, bu yüzden davranışı çivilenir.
const katEsit = uretilmis.planRiskReward(planSeviye({ sma50: 94, buyZone: [94, 96] }));
ok('kat eşitliğinde brkKind = sma50 (KATLAR sırası: sma50 → swingLow → sma200)',
  katEsit && katEsit.brkKind === 'sma50' && katEsit.brkPrimary === 94,
  katEsit ? `${katEsit.brkKind} @ ${katEsit.brkPrimary}` : 'sonuç yok');

// 11g — boş-değer sözleşmesi (app.js'te gerekçesi yazılı, üçü BİLEREK ayrı).
const bosMom = uretilmis.momentumInfo(null, 'orta');
const RR_ALAN = ['sellUpPct', 'sellKind', 'brkPrimary', 'brkKind', 'brkPct', 'brkMajor', 'atrStop', 'rrRatio'];
const rrBos = uretilmis.planRiskReward(planSeviye({ sma50: 120, sma200: 130, buyZone: [120, 125], stop: 140, sellZone: null }));
const rrAlanTam = rrBos && RR_ALAN.every((k) => k in rrBos);
ok('boş-değer sözleşmesi: momentumInfo→{active:false} · buyZoneProximity→null · planRiskReward→null',
  bosMom && bosMom.active === false
  && uretilmis.buyZoneProximity(null) === null
  && uretilmis.planRiskReward(null) === null,
  `momentumInfo(null)=${JSON.stringify(bosMom)}`);
ok('planRiskReward alanları cevapsızken de VAR (null = "ölçtüm, cevap yok")',
  rrAlanTam && rrBos.brkPct === null && rrBos.rrRatio === null,
  rrAlanTam ? `${RR_ALAN.length} alan, brkKind=${JSON.stringify(rrBos.brkKind)}` : 'alan eksik');

// N8: ⑪c'nin derin karşılaştırması gerçekten hassas mı?
const rrOrnek = uretilmis.planRiskReward(PLAN_VEKTOR[0][1]);
const rrKaymis = JSON.parse(JSON.stringify(rrOrnek));
rrKaymis.rrRatio = (rrKaymis.rrRatio ?? 0) + 1e-9;
ok('N8 · 1e-9 kaydırılmış rrRatio ⑪c karşılaştırmasında yakalanır',
  derinFark(JSON.parse(JSON.stringify(rrOrnek)), rrKaymis, 'planRiskReward') !== null,
  `rrRatio ${rrOrnek.rrRatio} + 1e-9`);
bitir();
