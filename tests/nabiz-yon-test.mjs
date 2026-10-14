// =====================================================================
//  MAKRO NABIZ YÖN MATEMATİĞİ TESTİ  (tests/nabiz-yon-test.mjs)
// ---------------------------------------------------------------------
//  `node tests/nabiz-yon-test.mjs`
//
//  NEDEN VAR — ÖLÇÜLMÜŞ BİR HATA GERİ GELMESİN DİYE (2026-10-14):
//  Kullanıcı canlı web sürümünde bildirdi: ABD aylık enflasyonu beklenenden
//  YÜKSEK geldi, piyasalar çakıldı, ve "⚡ Makro Nabız" buna rağmen
//  "🕊️ Gevşeme / güvercin rüzgârı" ilan etti.
//
//  KÖK NEDEN: `rateDirection` bir manşette "rate cut" / "faiz indirimi"
//  ifadesinin GEÇİP geçmediğine bakıyordu — o ifadeye NE YAPILDIĞINA
//  bakmıyordu. Sıcak TÜFE günü manşetleri tam olarak "faiz indirimi umudu
//  ÖLDÜ" biçiminde olduğu için beşi de GÜVERCİN oyu sayıldı:
//      rateDir = -0,833 · inflDir = +0,500 · pressure = -0,300  →  GÜVERCİN
//  Doğru okuyan enflasyon satırı (+0,500) ağırlıkça eziliyordu:
//  pressure = rateDir·0,6 + inflDir·0,4 — BOZUK sinyal 0,6, DOĞRU sinyal 0,4.
//
//  BU TEST NE ÖLÇER
//    ① sıcak TÜFE günü beş manşeti artık ŞAHİN tarafa düşüyor mu
//    ② GERÇEK güvercin bir senaryo hâlâ GÜVERCİN mi (yeni yanlılık YOK)
//    ③ asimetri iki yönlü mü kapandı ("rate hike fears fade" = güvercin)
//    ④ çift anlamlı fiiller gerçek indirim haberini ters çevirmiyor mu
//    ⑤ "consumer price" eksiği kapandı mı
//    ⑥ tazelik ağırlığı gerçekten ağırlığa giriyor mu
//    ⑦ olumsuz denetimler — testin kendisi boş değil
//
//  AĞA ÇIKMAZ. app.js DEĞİŞTİRİLMEZ, yalnız OKUNUR: iki yön fonksiyonu ve
//  olumsuzlama kapısı app.js kaynağından DİLİMLENİP kurulur. Kopyalanmaz —
//  kopyalanırsa test kendi kopyasını doğrular, yani hiçbir şeyi (engine.mjs
//  ile aynı kural).
//
//  KAPSAM: bu katman BİLGİ AMAÇLIDIR ve motor SKORUNA DAHİL DEĞİLDİR —
//  ölçüldü, bu adların hiçbiri üretilmiş `api/_motor.js` içinde geçmiyor.
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './engine.mjs';

const APP = path.join(ROOT, 'app.js');

let gecti = 0;
const kaldi = [];
function ok(ad, kosul, ek) {
  if (kosul) { gecti++; return true; }
  kaldi.push(ad + (ek ? '\n      ' + ek : ''));
  return false;
}

// ---------------------------------------------------------------------
//  app.js'ten DİLİMLEME — kopyalama değil
// ---------------------------------------------------------------------
const src = fs.readFileSync(APP, 'utf8');

/** `const AD = ...;` biçimindeki tek satırlık bildirimi aynen çıkarır
 *  (satır sonu yorumu dahil — kaynak satırı olduğu gibi alınır). */
function sliceConst(ad) {
  const re = new RegExp('^[ \\t]*const ' + ad + '[ \\t]*=[ \\t]*[^\\n]*$', 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`app.js'te "const ${ad}" bulunamadi — fonksiyon tasindi mi?`);
  return m[0].trim();
}

/** `function AD(` ile başlayan bloğu dengeli süslü parantezle çıkarır. */
function sliceFn(ad) {
  const i = src.indexOf('function ' + ad + '(');
  if (i < 0) throw new Error(`app.js'te "function ${ad}" bulunamadi — fonksiyon tasindi mi?`);
  const b = src.indexOf('{', i);
  let d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error(`"function ${ad}" blogu kapanmiyor`);
}

const PARCA = [
  sliceConst('FADE_WIN'), sliceConst('FADE_HARD'), sliceConst('FADE_SOFT'), sliceConst('FADE_TR'),
  sliceFn('fadedAround'),
  sliceConst('RATE_CUT_RE'), sliceConst('RATE_HIKE_RE'), sliceFn('rateDirection'),
  sliceConst('INFL_UP_RE'), sliceConst('INFL_DOWN_RE'), sliceFn('inflDirection'),
].join('\n\n');

const { rateDirection, inflDirection, fadedAround, FADE_WIN } =
  new Function(PARCA + '\nreturn { rateDirection, inflDirection, fadedAround, FADE_WIN };')();

// Manşet dizisi → haber nesnesi dizisi. `pubDate` verilmezse tazelik
// ağırlığı devre dışı kalsın diye OKUNAMAZ bir tarih konur (w = 1).
const H = (arr, iso) => arr.map((t) => ({ title: t, description: '', pubDate: iso || 'yok' }));

const r3 = (v) => Math.round(v * 1000) / 1000;
const pressureOf = (rate, infl) => r3(rate * 0.6 + infl * 0.4);
const ESIK = 0.12;
const durus = (p) => (p >= ESIK ? 'hawk' : p <= -ESIK ? 'dove' : 'neu');

// ---------------------------------------------------------------------
//  Senaryolar
// ---------------------------------------------------------------------
// ÖLÇÜLEN HATA GÜNÜ — birebir üretildi (2026-10-14)
const SICAK_FED = [
  'Hotter-than-expected CPI dashes hopes for a December rate cut',
  'Traders slash bets on Fed rate cuts after inflation surprise',
  'Fed faiz indirimi beklentileri zayıfladı, piyasalar satışa geçti',
  'Rate cut odds collapse as price pressures persist',
  'Powell signals caution: a rate cut is off the table for now',
];
const SICAK_INFL = [
  'US inflation runs hotter than forecast in September',
  'CPI tops estimates, Treasury yields jump',
  'Stocks tumble as consumer prices accelerate',
  'Core inflation sticky, above consensus',
  'Shelter costs cool slightly even as headline inflation rises',
];
// GERÇEK GÜVERCİN GÜN — düzeltme bunu bozmamalı (yeni yanlılık denetimi)
const SOGUK_FED = [
  'Fed delivers a quarter-point rate cut as inflation cools',
  'Powell opens the door to further rate cuts next year',
  'Merkez Bankası faizi düşürdü, gevşeme döngüsü sürüyor',
  'Traders raise bets on a January rate cut after soft data',
  'Dovish Fed minutes lift hopes for lower rates',
];
const SOGUK_INFL = [
  'US inflation cools more than expected in September',
  'CPI falls to a three-year low, Treasury yields drop',
  'Consumer prices decline for a second month',
  'Core inflation eases, easing pressure on the Fed',
  'Enflasyon beklentinin altında geriledi',
];

console.log('\n1. ÖLÇÜLEN HATA GÜNÜ — sıcak TÜFE, piyasa çakıldı');
const sRate = rateDirection(H(SICAK_FED));
const sInfl = inflDirection(H(SICAK_INFL));
const sPres = pressureOf(sRate, sInfl);
console.log(`   rateDir = ${r3(sRate)}  inflDir = ${r3(sInfl)}  pressure = ${sPres}  → ${durus(sPres)}`);
ok('sıcak gün: rateDir ŞAHİN tarafta (> +0,15)', sRate > 0.15, `rateDir = ${r3(sRate)} (hata öncesi: -0,833)`);
ok('sıcak gün: inflDir ısınma okuyor (> +0,15)', sInfl > 0.15, `inflDir = ${r3(sInfl)}`);
ok('sıcak gün: pressure POZİTİF', sPres > 0, `pressure = ${sPres} (hata öncesi: -0,300)`);
ok('sıcak gün: duruş ŞAHİN', durus(sPres) === 'hawk', `duruş = ${durus(sPres)} (hata öncesi: dove)`);
ok('sıcak gün: duruş GÜVERCİN DEĞİL — bildirilen hata', durus(sPres) !== 'dove');
SICAK_FED.forEach((t, i) => {
  const d = rateDirection(H([t]));
  ok(`sıcak manşet ${i + 1} tek başına şahin oy`, d > 0, `"${t}" → ${r3(d)}`);
});

console.log('\n2. GERÇEK GÜVERCİN GÜN — yeni yanlılık denetimi');
const dRate = rateDirection(H(SOGUK_FED));
const dInfl = inflDirection(H(SOGUK_INFL));
const dPres = pressureOf(dRate, dInfl);
console.log(`   rateDir = ${r3(dRate)}  inflDir = ${r3(dInfl)}  pressure = ${dPres}  → ${durus(dPres)}`);
ok('güvercin gün: rateDir GÜVERCİN tarafta (< -0,15)', dRate < -0.15, `rateDir = ${r3(dRate)}`);
ok('güvercin gün: inflDir soğuma okuyor (< -0,15)', dInfl < -0.15, `inflDir = ${r3(dInfl)}`);
ok('güvercin gün: duruş GÜVERCİN KALDI', durus(dPres) === 'dove', `duruş = ${durus(dPres)}`);
ok('güvercin gün: duruş şahine KAYMADI', durus(dPres) !== 'hawk');
ok('iki senaryo ZIT işaretli — test ayrım yapıyor', sPres > 0 && dPres < 0, `${sPres} vs ${dPres}`);

console.log('\n3. ASİMETRİ İKİ YÖNLÜ KAPANDI MI');
const tersler = [
  ['Rate hike fears fade as growth slows', 'dove'],
  ['Rate hike bets collapse after weak payrolls', 'dove'],
  ['Faiz artırımı beklentileri zayıfladı', 'dove'],
  ['Fed rules out a rate hike this year', 'dove'],
];
tersler.forEach(([t, bekle]) => {
  const d = rateDirection(H([t]));
  const g = d > 0 ? 'hawk' : d < 0 ? 'dove' : 'neu';
  ok(`olumsuzlanan ARTIRIM güvercin sayılıyor: "${t}"`, g === bekle, `yön = ${g} (${r3(d)})`);
});

console.log('\n4. ÇİFT ANLAMLI FİİL — gerçek indirim haberi TERS ÇEVRİLMİYOR');
const korunmali = [
  'Fed slashes rates by half a point in a surprise rate cut',
  'Central bank lowers rates again; another rate cut expected',
  'Dovish Powell hints at a rate cut in December',
  'Merkez Bankası faizi düşürdü — indirim döngüsü başladı',
];
korunmali.forEach((t) => {
  const d = rateDirection(H([t]));
  ok(`gerçek indirim güvercin kaldı: "${t}"`, d < 0, `yön değeri = ${r3(d)}`);
});
const olumsuz = [
  'Traders slash bets on a rate cut',
  'Rate cut hopes dimmed by sticky inflation',
  'December rate cut now looks unlikely',
  'Faiz indirimi masadan kalktı',
];
olumsuz.forEach((t) => {
  const d = rateDirection(H([t]));
  ok(`olumsuzlanan indirim şahin oldu: "${t}"`, d > 0, `yön değeri = ${r3(d)}`);
});

console.log('\n5. "consumer price" EKSİĞİ');
const cp = inflDirection(H(['Stocks tumble as consumer prices accelerate']));
ok('"consumer prices accelerate" ısınma oyu veriyor', cp > 0, `inflDir = ${r3(cp)} (eksik varken: 0)`);
const cpd = inflDirection(H(['Consumer prices decline for a second month']));
ok('"consumer prices decline" soğuma oyu veriyor (simetri)', cpd < 0, `inflDir = ${r3(cpd)}`);

console.log('\n6. TAZELİK AĞIRLIĞI gerçekten ağırlığa giriyor mu');
// Bir güvercin manşet BAYAT, bir şahin manşet TAZE. Ağırlıksız okuma dengeli
// (nötr) çıkar; 2,5× taze ağırlıkla ŞAHİN tarafa kayması gerekir.
const FRESH_W = 2.5;
const simdi = Date.now();
const karisik = [
  { title: 'Powell opens the door to a rate cut', description: '', pubDate: new Date(simdi - 10 * 864e5).toISOString() },
  { title: 'Rate cut hopes dashed by hot CPI', description: '', pubDate: new Date(simdi - 3 * 36e5).toISOString() },
];
const wOf = (it) => {
  const t = Date.parse(it.pubDate);
  return (!isNaN(t) && Date.now() - t < 48 * 36e5) ? FRESH_W : 1;
};
const agirsiz = rateDirection(karisik);
const agirli = rateDirection(karisik, wOf);
console.log(`   ağırlıksız = ${r3(agirsiz)}   taze-ağırlıklı = ${r3(agirli)}`);
ok('ağırlıksız okuma dengeli (0)', Math.abs(agirsiz) < 1e-9, `${r3(agirsiz)}`);
ok('taze-ağırlıklı okuma ŞAHİN tarafa kaydı', agirli > 0, `${r3(agirli)}`);
ok('tazelik ağırlığı inflDirection\'da da işliyor', (() => {
  const ki = [
    { title: 'Inflation cools', description: '', pubDate: new Date(simdi - 10 * 864e5).toISOString() },
    { title: 'CPI tops estimates', description: '', pubDate: new Date(simdi - 3 * 36e5).toISOString() },
  ];
  return Math.abs(inflDirection(ki)) < 1e-9 && inflDirection(ki, wOf) > 0;
})());
ok('ağırlık fonksiyonsuz çağrı eski davranışı koruyor', r3(rateDirection(H(SICAK_FED))) === r3(rateDirection(H(SICAK_FED), null)));

console.log('\n7. OLUMSUZ DENETİMLER — test boş değil');
ok('olumsuzlama kapısı GERÇEKTEN kurulu (kaldırılırsa sıcak gün güvercin olurdu)', (() => {
  // Kapısız eski davranışı yeniden kur ve ESKİ hatanın hâlâ üretilebildiğini göster.
  let c = 0, h = 0;
  const cut = /(rate cut|faiz indir|indirim|lower(?:ed|ing)? rate|gevşe|dovish|faizi düşür)/i;
  const hike = /(rate hike|faiz artır|artırım|raise(?:d|s)? rate|sıkılaş|hawkish|faizi yüksel)/i;
  SICAK_FED.forEach((t) => { if (cut.test(t)) c++; if (hike.test(t)) h++; });
  const eski = (h - c) / (c + h + 1);
  return eski < -0.5 && sRate > 0.15; // eski kapısız okuma güvercin, yenisi şahin
})(), 'kapısız okuma artık güvercin çıkmıyor — dilimlenen fonksiyon beklenen fonksiyon değil');
ok('fadedAround boş metinde false', fadedAround('', /rate cut/i) === false);
ok('fadedAround olumsuzlama olmadan false', fadedAround('Fed delivers a rate cut today', /rate cut/i) === false);
ok('fadedAround olumsuzlama varken true', fadedAround('Rate cut hopes collapse', /rate cut/i) === true);
ok('pencere sonlu — çok uzak fiil sayılmıyor', fadedAround('rate cut' + ' x'.repeat(200) + ' collapse', /rate cut/i) === false,
  `FADE_WIN = ${FADE_WIN}`);
ok('boş dizi nötr döndürüyor', rateDirection([]) === 0 && inflDirection([]) === 0);
ok('alakasız manşet oy vermiyor', rateDirection(H(['Apple unveils a new laptop'])) === 0);

// ---------------------------------------------------------------------
console.log('\n' + '─'.repeat(64));
if (kaldi.length) {
  console.log(`✗ ${kaldi.length} DENETİM KALDI (geçen: ${gecti})`);
  kaldi.forEach((k) => console.log('   ✗ ' + k));
  console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(1);
}
console.log(`✓ ${gecti} denetim geçti — Makro Nabız yön matematiği sağlam.`);
console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
