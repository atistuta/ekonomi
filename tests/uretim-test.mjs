#!/usr/bin/env node
// ===========================================================================
//  ÜRETİM TESTİ — api/_motor.js, app.js'in ŞU ANKİ hali mi?
// ===========================================================================
//
//  NEDEN VAR: `tests/engine.mjs` motoru kopyalamayı yasaklar — "motor
//  kopyalanırsa iki sürüm doğar ve parite testi kendi kopyasını doğrular,
//  yani hiçbir şeyi". `api/_motor.js` o yasağın içinden tek bir şartla
//  geçebilir: ELLE YAZILMAZ, app.js'ten üretilir ve HER KOŞUDA bu test
//  "dosya = app.js'in şu anki hali mi?" sorusunu sorar. Bu test kırmızıysa
//  dosya bir KOPYADIR ve /api/score'un ölçtüğü şey hiçbir şeydir.
//
//  NE ÖLÇER (8 bölüm)
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
  SLICES, EXPORTS, readApp, engineSource, sliceInfo, makeHost,
} from './engine.mjs';
import { HOLISTIC_CASES } from './run.mjs';
import { CIKTI, imzala, uretKaynak } from '../tools/motor-uret.mjs';

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
  console.log(`✅ ${gecen} denetim geçti — api/_motor.js app.js ile birebir.`);
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

console.log('ÜRETİM TESTİ — api/_motor.js = app.js (şu anki hali)');
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

bitir();
