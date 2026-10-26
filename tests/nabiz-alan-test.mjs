// ===========================================================================
//  tests/nabiz-alan-test.mjs — /api/pulse ALAN SÖZLEŞMESİ denetimi
// ===========================================================================
//
//  NİYE AYRI DOSYA: `tests/nabiz-yon-test.mjs` BAŞKA şeyi ölçüyor (duruş
//  yönü: faiz/enflasyon manşetinden çıkan işaret). Bu dosya ALAN
//  SÖZLEŞMESİNİ ölçüyor: hangi alan gövdede var, eksik girdi `null` mı
//  yoksa `0` mı dönüyor, ve ekranda görünen üç büyüklük (`genislik`,
//  `enflasyonBaskisi`, `risk`) UÇTA hesaplanıyor mu. İkisini tek dosyada
//  toplamak, 40 denetimli yön kilidini bu dosyanın gürültüsüne açardı.
//
//  DESEN NEREDEN: `tests/uc-test.mjs` (`ok`/`bolum`/`sahteRes`/
//  `anahtarlar`) + `tests/nabiz-yon-test.mjs` (`ROOT` içe alımı, sonda
//  `process.exit(1)`). Yeni kalıp UYDURULMADI. — `tests/yardim.mjs`
//  diye bir dosya BU DEPODA YOK (ölçüldü: `ls tests/`), bu yüzden
//  yardımcılar yukarıdaki iki dosyadan birebir kopyalandı.
//
//  AĞA ÇIKMIYOR: `fetch` SAHTE ve fırlatıyor; ayrıca SAYIYOR. Denetimler
//  sayacın 0 kaldığını DOĞRULUYOR — "ağa çıkmadım" lafta kalmıyor.
// ===========================================================================

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './engine.mjs';

// --- SAHTE fetch: içe alımlardan ÖNCE kurulmalı (uçlar modül yüklenirken
//     `canliAg` ile motoru kuruyor; o yol `fetch`i YAKALAYABİLİR).
let agDenemesi = 0;
globalThis.fetch = (...a) => {
  agDenemesi++;
  throw new Error('AGA CIKILDI: ' + String(a[0]));
};

const {
  default: nabiz, ayristirGovde, ayristirListe, config: nabizConfig,
  AZAMI_BASLIK, AZAMI_GOVDE_BAYT, PENCERE_GUN, TAZE_GUN,
} = await import('../api/pulse.js');
const { default: skor, config: skorConfig, AZAMI_SEMBOL, ayristir } = await import('../api/score.js');
const { default: oneri, config: oneriConfig } = await import('../api/recommend.js');
const { default: coz, config: cozConfig } = await import('../api/analyze.js');
const girdi = await import('../api/_girdi.js');
const motor = await import('../api/_motor.js');
const ayar = await import('../api/_ayar.js');
const ag = await import('../api/_ag.js');

const ENG = motor.buildMotor(
  ag.canliAg({ taWeights: ayar.TA_WEIGHTS, taBenchmark: ayar.TA_BENCHMARK }).H,
);

// --- yardımcılar (uc-test.mjs'ten birebir)
let gecen = 0;
const hatalar = [];
const ok = (ad, kosul, ek = '') => {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}${ek ? `  (${ek})` : ''}`); }
  else { hatalar.push(ad + (ek ? ` — ${ek}` : '')); console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ''}`); }
};
const bolum = (ad) => console.log(`\n${ad}`);
function sahteRes() {
  const r = { kod: null, govde: null, basliklar: {}, bitti: false };
  r.setHeader = (k, v) => { r.basliklar[String(k).toLowerCase()] = String(v); };
  r.status = (k) => { r.kod = k; return r; };
  r.json = (g) => { r.govde = g; return r; };
  r.end = () => { r.bitti = true; return r; };
  return r;
}
const anahtarlar = (o) => Object.keys(o || {}).sort().join(',');

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';
const SIMDI = 1760000000000;
const MANSET = [{ title: 'Fed holds rates steady', description: '', pubDate: new Date(SIMDI - 36e5).toUTCString() }];

// Yorum SOYULMUŞ kaynak (uc-test.mjs ⑬e ile aynı soyma kuralı).
const kodu = (dosya) => fs.readFileSync(path.join(ROOT, dosya), 'utf8')
  .split(/\r?\n/)
  .filter((l) => { const t = l.trim(); return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')); })
  .join('\n');

const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const MOTOR = fs.readFileSync(path.join(ROOT, 'api', '_motor.js'), 'utf8');
const PULSE_KOD = kodu('api/pulse.js');
const satir = (metin, desen) => {
  const i = metin.indexOf(desen);
  return i < 0 ? -1 : metin.slice(0, i).split('\n').length;
};

const cagir = async (body, method = 'POST') => {
  const res = sahteRes();
  await nabiz({ method, body, headers: {}, query: {} }, res);
  return res;
};

console.log('\n⚡ /api/pulse ALAN SÖZLEŞMESİ\n' + '='.repeat(60));

// =========================================================================
bolum('① Uç yüzeyi — mevcut dışa verilenler yerinde');
ok('config.runtime nodejs', nabizConfig.runtime === 'nodejs', nabizConfig.runtime);
ok('config.maxDuration 10 (bütçe kaymadı)', nabizConfig.maxDuration === 10, String(nabizConfig.maxDuration));
ok('ayristirGovde dışa veriliyor', typeof ayristirGovde === 'function');
ok('ayristirListe dışa veriliyor', typeof ayristirListe === 'function');
ok('AZAMI_BASLIK 120', AZAMI_BASLIK === 120);
ok('AZAMI_GOVDE_BAYT 131072', AZAMI_GOVDE_BAYT === 131072);
ok('PENCERE_GUN 14', PENCERE_GUN === 14);
ok('TAZE_GUN 2', TAZE_GUN === 2);

// =========================================================================
bolum('② ÖLÇÜM — üç büyüklük app.js içinde VAR, motorda YOK (yol (b))');
//  Bu bölüm bir BULGU KİLİDİ: üç hesap motora taşınırsa denetim kırmızı
//  yanar ve o gün ucun bu alanları HESAPLAYABİLECEĞİ anlaşılır.
const sAppInfl = satir(APP, 'let infl = Math.min(1, inflN / 10);');
const sAppRisk = satir(APP, "const risk = Math.min(1, (nOf('war') + nOf('hormuz')) / 10);");
const sAppGen = satir(APP, 'const breadth = taVals.length ? taVals.reduce(');
const sAppHeat = satir(APP, 'function themeHeat(items) {');
const sDilimBas = satir(APP, '  const CYCLE_PHASES = {');
const sDilimBit = satir(APP, '  // Makro nabzını hesapla');
ok('app.js: enflasyon baskısı formülü bulundu', sAppInfl > 0, 'satır ' + sAppInfl);
ok('app.js: jeopolitik risk formülü bulundu', sAppRisk > 0, 'satır ' + sAppRisk);
ok('app.js: piyasa genişliği (breadth) formülü bulundu', sAppGen > 0, 'satır ' + sAppGen);
ok('app.js: themeHeat yardımcısı bulundu', sAppHeat > 0, 'satır ' + sAppHeat);
ok('makro-faz dilimi sınırları bulundu', sDilimBas > 0 && sDilimBit > sDilimBas, `${sDilimBas}..${sDilimBit}`);
ok('enflasyon baskısı dilimin DIŞINDA (sonrasında)', sAppInfl > sDilimBit);
ok('jeopolitik risk dilimin DIŞINDA (sonrasında)', sAppRisk > sDilimBit);
ok('genişlik dilimin DIŞINDA (sonrasında)', sAppGen > sDilimBit);
ok('themeHeat dilimin DIŞINDA (öncesinde)', sAppHeat > 0 && sAppHeat < sDilimBas);
ok('motorda inflN YOK', !MOTOR.includes('inflN'));
ok('motorda war/hormuz risk formülü YOK', !MOTOR.includes("nOf('war')"));
ok('motorda taVals YOK', !MOTOR.includes('taVals'));
ok('motorda themeHeat YOK', !MOTOR.includes('themeHeat'));
// KARŞIT KANIT: dilim İÇİNDEKİLER motorda GERÇEKTEN var — yani yokluk
// denetimleri "her şey yok" diyen boş bir testten gelmiyor.
ok('motorda macroGrowth VAR (karşıt kanıt)', typeof ENG.macroGrowth === 'function');
ok('motorda macroPhase VAR (karşıt kanıt)', typeof ENG.macroPhase === 'function');
ok('motorda rateDirection VAR (karşıt kanıt)', typeof ENG.rateDirection === 'function');
// NİYE UÇTA HESAPLANMIYOR: macroPhase eksik boyutu SESSİZCE 0 sayıyor,
// yani null'larla çağrılırsa ÖLÇÜLMEMİŞ bir faz uydurur.
const uydurmaFaz = ENG.macroPhase({ rate: null, infl: null, growth: null, risk: null });
ok('macroPhase null boyutlardan faz UYDURUYOR', typeof uydurmaFaz === 'string' && uydurmaFaz.length > 0, uydurmaFaz);

// =========================================================================
bolum('③ Ölçülmeyen değer null — ASLA 0');
const bos = ayristirGovde({ faizHaberleri: MANSET, enflasyonHaberleri: [], simdi: SIMDI });
ok('girdi yok → genislik null', bos.genislik === null);
ok('genislik 0 DEĞİL', Object.is(bos.genislik, 0) === false);
ok('girdi yok → enflasyonBaskisi null', bos.enflasyonBaskisi === null);
ok('enflasyonBaskisi 0 DEĞİL', Object.is(bos.enflasyonBaskisi, 0) === false);
ok('girdi yok → risk null', bos.risk === null);
ok('risk 0 DEĞİL', Object.is(bos.risk, 0) === false);
// ÖLÇÜLMÜŞ SIFIR ayırt ediliyor: 0 geçerli bir ölçümdür, null'a düşmez.
const sifir = ayristirGovde({
  faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 0, enflasyonBaskisi: 0, risk: 0, simdi: SIMDI,
});
ok('genislik 0 ölçümü KORUNUYOR', sifir.genislik === 0);
ok('enflasyonBaskisi 0 ölçümü KORUNUYOR', sifir.enflasyonBaskisi === 0);
ok('risk 0 ölçümü KORUNUYOR', sifir.risk === 0);

const eksikRes = await cagir({ faizHaberleri: MANSET, enflasyonHaberleri: [], simdi: SIMDI });
ok('eksik girdi → 200', eksikRes.kod === 200, String(eksikRes.kod));
ok('eksik girdi → konjonktur null', eksikRes.govde.konjonktur === null);
// Alan SİLİNİRSE denetim çökmeden KIRMIZI yanmalı: dizi olup olmadığı
// önce sınanıyor (mutasyon kanıtı bunu gösterdi).
const eksikDizi = Array.isArray(eksikRes.govde.eksik)
  ? eksikRes.govde.eksik.slice().sort().join(',') : null;
ok('eksik dizisi üç alanı SÖYLÜYOR',
  eksikDizi === 'enflasyonBaskisi,genislik,risk', String(eksikRes.govde.eksik));
ok('eksikken faz UYDURULMUYOR', !('faz' in (eksikRes.govde.konjonktur || {})));

const sifirRes = await cagir({
  faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 0, enflasyonBaskisi: 0, risk: 0, simdi: SIMDI,
});
ok('ölçülmüş sıfırlarla eksik dizisi BOŞ', Array.isArray(sifirRes.govde.eksik) && sifirRes.govde.eksik.length === 0);
ok('ölçülmüş sıfırlarla konjonktur VAR', sifirRes.govde.konjonktur !== null);
ok('boyutlar.infl 0 olarak taşınıyor', sifirRes.govde.konjonktur.boyutlar.infl === 0);
ok('boyutlar.risk 0 olarak taşınıyor', sifirRes.govde.konjonktur.boyutlar.risk === 0);
ok('boyutlar.growth sayı', Number.isFinite(sifirRes.govde.konjonktur.boyutlar.growth));
ok('faz makine kodu',
  typeof sifirRes.govde.konjonktur.faz === 'string' && /^[a-z]+$/.test(sifirRes.govde.konjonktur.faz),
  sifirRes.govde.konjonktur.faz);
ok('sektorler dizi (makine kodu)', Array.isArray(sifirRes.govde.konjonktur.sektorler));

// =========================================================================
bolum('④ Gövde alan listesi SABİT — hiçbir alan kaybolmadı/adı değişmedi');
const BEKLENEN = 'degerlendirilen,durus,eksik,haberler,kaynak,konjonktur,ms,pencere,surum,taze,uyari';
ok('gövde anahtarları birebir', anahtarlar(sifirRes.govde) === BEKLENEN, anahtarlar(sifirRes.govde));
ok('eksik yolunda da aynı anahtarlar', anahtarlar(eksikRes.govde) === BEKLENEN, anahtarlar(eksikRes.govde));
ok('durus anahtarları',
  anahtarlar(sifirRes.govde.durus) === 'baski,egilimAsagi,egilimYukari,enflasyonYon,faizYon,kod',
  anahtarlar(sifirRes.govde.durus));
ok('konjonktur anahtarları',
  anahtarlar(sifirRes.govde.konjonktur) === 'boyutlar,faz,sektorler', anahtarlar(sifirRes.govde.konjonktur));
ok('boyutlar anahtarları',
  anahtarlar(sifirRes.govde.konjonktur.boyutlar) === 'growth,infl,rate,risk',
  anahtarlar(sifirRes.govde.konjonktur.boyutlar));
ok('taze anahtarları', anahtarlar(sifirRes.govde.taze) === 'enflasyon2g,faiz2g', anahtarlar(sifirRes.govde.taze));
ok('pencere anahtarları',
  anahtarlar(sifirRes.govde.pencere) === 'gun,tazelikAgirlik,tazelikSaat', anahtarlar(sifirRes.govde.pencere));
ok('degerlendirilen anahtarları',
  anahtarlar(sifirRes.govde.degerlendirilen) === 'enflasyon,faiz', anahtarlar(sifirRes.govde.degerlendirilen));
ok('surum anahtarları', anahtarlar(sifirRes.govde.surum) === 'ayar,motor', anahtarlar(sifirRes.govde.surum));
ok('kaynak yolu bildiriliyor', sifirRes.govde.kaynak === 'istemci', String(sifirRes.govde.kaynak));
ok('istemci yolunda haberler null', sifirRes.govde.haberler === null);
ok('ms sayı', Number.isFinite(sifirRes.govde.ms));
ok('uyari künyesi yerinde', sifirRes.govde.uyari === UYARI);
ok('pencere.gun 14', sifirRes.govde.pencere.gun === 14);
ok('pencere.tazelikSaat motordan', sifirRes.govde.pencere.tazelikSaat === ENG.PULSE_FRESH_H);
ok('pencere.tazelikAgirlik motordan', sifirRes.govde.pencere.tazelikAgirlik === ENG.PULSE_FRESH_W);
ok('no-store başlığı', sifirRes.basliklar['cache-control'] === 'no-store', sifirRes.basliklar['cache-control']);

// =========================================================================
bolum('⑤ Aralık kapıları — ölçülemez girdi 400, sessiz kırpma YOK');
const hataKodu = async (b) => (
  await cagir({ faizHaberleri: MANSET, enflasyonHaberleri: [], simdi: SIMDI, ...b })
).govde.error;
ok('genislik 101 → bad_genislik', (await hataKodu({ genislik: 101 })) === 'bad_genislik');
ok('genislik -1 → bad_genislik', (await hataKodu({ genislik: -1 })) === 'bad_genislik');
ok('genislik "abc" → bad_genislik', (await hataKodu({ genislik: 'abc' })) === 'bad_genislik');
ok('genislik 100 geçerli',
  ayristirGovde({ faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 100, simdi: SIMDI }).genislik === 100);
ok('enflasyonBaskisi 1.5 → bad_enflasyonBaskisi', (await hataKodu({ enflasyonBaskisi: 1.5 })) === 'bad_enflasyonBaskisi');
ok('enflasyonBaskisi -0.1 → bad_enflasyonBaskisi', (await hataKodu({ enflasyonBaskisi: -0.1 })) === 'bad_enflasyonBaskisi');
ok('risk 2 → bad_risk', (await hataKodu({ risk: 2 })) === 'bad_risk');
ok('risk "x" → bad_risk', (await hataKodu({ risk: 'x' })) === 'bad_risk');
ok('risk 1 geçerli',
  ayristirGovde({ faizHaberleri: MANSET, enflasyonHaberleri: [], risk: 1, simdi: SIMDI }).risk === 1);
ok('simdi 0 → bad_simdi', (await hataKodu({ simdi: 0 })) === 'bad_simdi');
const hataRes = await cagir({ faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 101, simdi: SIMDI });
ok('aralık hatası 400', hataRes.kod === 400, String(hataRes.kod));
ok('hata cevabında künye var', hataRes.govde.uyari === UYARI);
ok('gövde yok → govde_yok', ayristirGovde(null).hata.govde.error === 'govde_yok');

// =========================================================================
bolum('⑥ Doğrulama yolu AĞA ÇIKMIYOR');
const sayacIlk = agDenemesi;
await cagir({
  faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 50, enflasyonBaskisi: 0.2, risk: 0.1, simdi: SIMDI,
});
await cagir({ faizHaberleri: MANSET, enflasyonHaberleri: [], genislik: 999, simdi: SIMDI });
ok('istemci yolu + hata yolu: 0 ağ denemesi', agDenemesi === sayacIlk, `denemeler: ${agDenemesi - sayacIlk}`);
const opt = await cagir(null, 'OPTIONS');
ok('OPTIONS 204', opt.kod === 204 && opt.bitti === true, String(opt.kod));
const get = await cagir(null, 'GET');
ok('GET 405 method_not_allowed', get.kod === 405 && get.govde.error === 'method_not_allowed');
ok('Allow başlığı POST, OPTIONS', get.basliklar.allow === 'POST, OPTIONS', get.basliklar.allow);
ok('OPTIONS/GET de ağa çıkmadı', agDenemesi === sayacIlk);

// =========================================================================
bolum('⑦ Uçta formül/eşik YAZILMAMIŞ — "motorda hesap, uçta taşıma"');
for (const d of ['nOf(', 'themeHeat', 'toneScore', 'inflN', 'hormuz', 'reduce(',
  'RADAR_THEMES', 'CYCLE_PHASES =', 'RATE_SENSITIVE =', '0.15', '/ 10']) {
  ok(`uçta "${d}" YOK`, !PULSE_KOD.includes(d));
}
ok('macroPhase MOTORDAN çağrılıyor', PULSE_KOD.includes('ENG.macroPhase('));
ok('macroGrowth MOTORDAN çağrılıyor', PULSE_KOD.includes('ENG.macroGrowth('));
ok('rateDirection MOTORDAN çağrılıyor', PULSE_KOD.includes('ENG.rateDirection('));
for (const d of ['Intl', 'toFixed(', 'toLocaleString']) ok(`HAM SAYI: uçta "${d}" YOK`, !PULSE_KOD.includes(d));
for (const d of ['@gmail', 'userEmail', 'apiKey', 'ANTHROPIC']) ok(`sızıntı yok: "${d}"`, !PULSE_KOD.includes(d));
for (const d of ['kazandırır', 'al/sat sinyali', 'garanti', 'tavsiye edilir']) ok(`tavsiye dili yok: "${d}"`, !PULSE_KOD.includes(d));
ok('künye metni uçta yazılı', PULSE_KOD.includes(UYARI));

// =========================================================================
bolum('⑧ /api/score · /api/recommend · /api/analyze DEĞİŞMEDİ');
ok('score maxDuration 60', skorConfig.maxDuration === 60, String(skorConfig.maxDuration));
ok('recommend maxDuration 60', oneriConfig.maxDuration === 60, String(oneriConfig.maxDuration));
ok('analyze maxDuration 60', cozConfig.maxDuration === 60, String(cozConfig.maxDuration));
ok('score ayristir = _girdi.ayristir (aynı nesne)', ayristir === girdi.ayristir);
ok('score AZAMI_SEMBOL = _girdi.AZAMI_SEMBOL', AZAMI_SEMBOL === girdi.AZAMI_SEMBOL, String(AZAMI_SEMBOL));
for (const [ad, h] of [['score', skor], ['recommend', oneri], ['analyze', coz]]) {
  const o = sahteRes();
  await h({ method: 'OPTIONS', query: {}, headers: {} }, o);
  ok(`${ad}: OPTIONS 204`, o.kod === 204 && o.bitti === true, String(o.kod));
  const p = sahteRes();
  await h({ method: 'POST', query: {}, headers: {} }, p);
  ok(`${ad}: POST 405 method_not_allowed`, p.kod === 405 && p.govde.error === 'method_not_allowed', String(p.kod));
  ok(`${ad}: Allow GET, OPTIONS`, p.basliklar.allow === 'GET, OPTIONS', p.basliklar.allow);
}
const gBos = sahteRes();
await skor({ method: 'GET', query: {}, headers: {} }, gBos);
ok('score: symbols yok → symbols_yok', gBos.kod === 400 && gBos.govde.error === 'symbols_yok',
  String(gBos.govde && gBos.govde.error));
ok('score kapısı ağa çıkmadı', agDenemesi === sayacIlk, `denemeler: ${agDenemesi - sayacIlk}`);
ok('TOPLAM ağ denemesi 0', agDenemesi === 0, String(agDenemesi));

// =========================================================================
console.log('\n' + '='.repeat(60));
if (hatalar.length) {
  console.log(`❌ ${hatalar.length} denetim DÜŞTÜ (geçen: ${gecen})`);
  hatalar.forEach((h) => console.log('   · ' + h));
  process.exit(1);
}
console.log(`✓ ${gecen} denetim geçti`);
console.log(UYARI);
