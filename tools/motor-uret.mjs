#!/usr/bin/env node
// ===========================================================================
//  MOTOR ÜRETİCİ — app.js → _motor.js + _ekran.js, config.js → _ayar.js
// ===========================================================================
//
//  NE YAPAR: `app.js`'teki skor motorunu dilimler ve sunucuda koşabilen tek
//  bir ESM modülü olarak yazar. Üretilen dosya `/api/score`'un (ve sonraki
//  uçların) içe alacağı motordur. Yanında `config.js`'teki el ağırlıklarını
//  (`TA_WEIGHTS` + `TA_BENCHMARK`) `api/_ayar.js` olarak yazar — motor bunlar
//  olmadan koşamaz, `config.js` ise bir tarayıcı varlığı.
//
//  NEDEN AYAR DA ÜRETİLİYOR: Vercel işlevin paketine yalnız statik olarak
//  izlenebilen dosyaları koyar; `config.js`'i çalışma anında `fs` ile okumak
//  dağıtıma bağlı bir kumar. Üretilen dosya yerelde doğrulanabiliyor.
//  SIZMA YOK: yalnız bu iki anahtar alınır — `NTFY_TOPIC` ve `MY_PROXY`
//  ÜRETİLEN DOSYAYA GİRMEZ.
//
//  ÜÇÜNCÜ DOSYA — api/_ekran.js (GEÇİCİ): skor motordan çıktıktan SONRA
//  ekran katmanında iki yerde daha değişiyor — F/K "Değerleme" kriteri kriter
//  listesine ekleniyor, sonra FA/TA bileşkesi harmanlanıyor. Kullanıcının
//  GÖRDÜĞÜ sayı bu, dolayısıyla `/api/score` aynı sayıyı döndürmek zorunda.
//  Sabitler app.js'ten OKUNUYOR (readRenderConstants), elle kopyalanmıyor.
//  Commit C bu mantığı motorun içine alacak ve app.js'teki üç ekran kopyasını
//  kaldıracak; o gün bu dosya SİLİNECEK — başlığında da öyle yazıyor.
//
//  NEDEN GEREKLİ: `tests/engine.mjs` motoru `new Function` ile BELLEKTE kurar
//  ve bunu yaparken `app.js`'i okur. Vercel'de ikisi de olmaz:
//    · `tests/` yayına gönderilmiyor (.vercelignore),
//    · `app.js` tarayıcı varlığı — sunucu tarafında dilimlemek saçma olurdu.
//
//  NEDEN KOPYA DEĞİL: `tests/engine.mjs`'in baştaki uyarısı hâlâ geçerli —
//  "motor kopyalanırsa iki sürüm doğar ve parite testi kendi kopyasını
//  doğrular, yani hiçbir şeyi". Bu dosya o yasağı şöyle aşar: üretilen metin
//  ELLE YAZILMAZ, her seferinde app.js'ten türetilir ve
//  `tests/uretim-test.mjs` her koşuda "bu dosya = app.js'in ŞU ANKİ hali mi?"
//  sorusunu sorar. Elle düzenleme ya da app.js'in kayması testi kırmızı
//  yakar. Yani dosya bir kopya değil, aynı metnin ikinci TAŞIYICISI.
//
//  KULLANIM
//    node tools/motor-uret.mjs            → üret + özet yaz
//    node tools/motor-uret.mjs --denetle  → yalnız denetle (fark varsa çıkış 1)
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ROOT, EXPORTS, readApp, engineSource, sliceInfo, loadConfig, readRenderConstants,
} from '../tests/engine.mjs';

export const CIKTI = path.join(ROOT, 'api', '_motor.js');
export const CIKTI_AYAR = path.join(ROOT, 'api', '_ayar.js');
export const CIKTI_EKRAN = path.join(ROOT, 'api', '_ekran.js');

/** Metnin içerik imzası. Üretilen dosyaya gömülür; sürüklenme testi bunu doğrular. */
export function imzala(metin) {
  return 'sha256:' + crypto.createHash('sha256').update(metin, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Üretilecek dosyanın TAM metnini döndür — diske yazmadan.
 * Sürüklenme testi bunu bellekte çağırıp dosyayla karşılaştırır.
 * @returns {{metin:string, imza:string, dilimler:{name:string,lines:number}[], toplam:number}}
 */
export function uretKaynak() {
  const src = engineSource(readApp());
  const dilimler = sliceInfo(src.parts);
  const toplam = dilimler.reduce((a, d) => a + d.lines, 0);

  // KANONİK BİÇİM = LF. app.js CRLF, buradaki başlık LF → ham birleştirme
  // KARIŞIK satır sonlu bir dosya üretir; hem çirkin hem de imza/karşılaştırma
  // tarafını kırılgan yapar. Motor etkilenmez: JS satır sonlarını eşdeğer
  // sayar ve şablon dizelerinde CRLF zaten dil düzeyinde LF'e normalleşir.
  const govde = src.govde.replace(/\r\n/g, '\n');
  const imza = imzala(govde);

  // ⚠ BAŞLIK TARİHSİZ OLMAK ZORUNDA: tarih yazılsa dosya ertesi gün kendi
  // kendine "sürüklenmiş" görünür ve test her gün kırmızı yanar. Buradaki
  // her satır yalnız app.js'ten türeyen, belirlenimci bilgi taşır.
  const bas = [
    '// ===========================================================================',
    '//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN',
    '// ===========================================================================',
    '//',
    "//  Kaynak : app.js (dilimlenerek) + tests/engine.mjs (PREAMBLE/SLICES/EXPORTS)",
    '//  Yenile : node tools/motor-uret.mjs',
    '//  Doğrula: node tests/uretim-test.mjs',
    '//',
    '//  Elle yapılan bir değişiklik bir sonraki üretimde SESSİZCE silinir ve',
    '//  üretim testi zaten kırmızı yanar. Motor davranışı değişecekse app.js',
    '//  değişir, sonra bu dosya yeniden üretilir.',
    '//',
    `//  Dilimler (${dilimler.length}):`,
    ...dilimler.map((d) => `//    ${d.name.padEnd(12)}${String(d.lines).padStart(5)} satır`),
    `//    ${'TOPLAM'.padEnd(12)}${String(toplam).padStart(5)} satır`,
    `//  Dışa verilen sembol: ${EXPORTS.length}`,
    '//',
    '//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.',
    '// ===========================================================================',
    '',
    `export const IMZA = '${imza}';`,
    '',
    '/** Dilim adı + satır sayısı — app.js okumadan. */',
    'export const DILIMLER = [',
    ...dilimler.map((d) => `  { name: '${d.name}', lines: ${d.lines} },`),
    '];',
    '',
    '/**',
    ' * Motoru kur ve sembollerini döndür.',
    ' *',
    ' * @param {object} H konak kabuğu. Motor bunları yalnız ÇAĞIRIR, içeriğini',
    ' *   bilmez — aynı motor bu yüzden testte fikstürle, sunucuda gerçek ağla',
    ' *   koşabiliyor. Gerekenler:',
    ' *     H.window        → { TA_WEIGHTS, TA_BENCHMARK, MY_PROXY }',
    ' *                        MY_PROXY BOŞ OLAMAZ: secGet `if (!base) return null`.',
    ' *     H.localStorage  → { getItem, setItem }  (gösterge aç/kapa)',
    ' *     H.fetch         → ağ kabuğu (fetchYahooOHLC + secGet kullanır)',
    ' *     H.fetchVia      → İş Yatırım metin kabuğu',
    ' *     H.dead(ad)      → erişilirse adıyla patlayan vekil (document/navigator)',
    ' */',
    'export function buildMotor(H) {',
  ].join('\n');

  // src.govde bir `return { ... };` ile bitiyor → fonksiyon gövdesi olarak
  // AYNEN geçerli. `new Function('H', govde)` ile birebir aynı metin.
  const metin = bas + '\n' + govde + '}\n';
  return { metin, imza, dilimler, toplam };
}

/**
 * api/_ayar.js'in TAM metnini döndür — diske yazmadan.
 *
 * Kaynak `config.js`; okuma işi `tests/engine.mjs`'teki `loadConfig()`'e
 * bırakıldı — motor metninde olduğu gibi burada da tek kurulum yeri var.
 * Yalnız motorun gerçekten kullandığı iki anahtar alınır; `NTFY_TOPIC`
 * (bildirim konusu = paylaşılan sır) ve `MY_PROXY` (konak kabuğunun işi)
 * BİLEREK dışarıda bırakıldı.
 *
 * @returns {{metin:string, imza:string, vadeler:string[]}}
 */
export function uretAyarKaynak() {
  const w = loadConfig();
  const ayar = { TA_WEIGHTS: w.TA_WEIGHTS, TA_BENCHMARK: w.TA_BENCHMARK };

  // JSON gidiş-dönüşü bu iki anahtar için KAYIPSIZ (yalnız dize/sayı/mantıksal/
  // dizi/nesne var — fonksiyon, tarih, undefined yok). Üretim testi bunu her
  // koşuda derin eşitlikle doğruluyor, yani sessiz bir kayıp mümkün değil.
  const govde = JSON.stringify(ayar, null, 2);
  const imza = imzala(govde);
  const vadeler = Object.keys(ayar.TA_WEIGHTS);

  // ⚠ BAŞLIK TARİHSİZ (bkz. uretKaynak): tarih yazılsa dosya ertesi gün kendi
  // kendine "sürüklenmiş" görünür ve test her gün kırmızı yanar.
  const bas = [
    '// ===========================================================================',
    '//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN',
    '// ===========================================================================',
    '//',
    '//  Kaynak : config.js (window.TA_WEIGHTS + window.TA_BENCHMARK)',
    '//  Yenile : node tools/motor-uret.mjs',
    '//  Doğrula: node tests/uretim-test.mjs',
    '//',
    '//  El ağırlıkları config.js\'te DURUR — tek doğruluk kaynağı orası. Bu dosya',
    '//  motorun sunucu tarafı için alınmış bir izdüşümü; ağırlık değişecekse',
    '//  config.js değişir, sonra bu dosya yeniden üretilir.',
    '//',
    `//  Vadeler (${vadeler.length}): ${vadeler.join(', ')}`,
    '//  Alınmayan: NTFY_TOPIC, MY_PROXY, CORS_PROXY, besleme listeleri.',
    '//',
    '//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.',
    '// ===========================================================================',
    '',
    `export const IMZA_AYAR = '${imza}';`,
    '',
    '/** Vade adları — config.js\'teki sırayla. */',
    `export const VADELER = ${JSON.stringify(vadeler)};`,
    '',
    '/** Teknik skor el ağırlıkları — vade → { blend, interp, adxTf, weights }. */',
    `export const TA_WEIGHTS = ${JSON.stringify(ayar.TA_WEIGHTS, null, 2)};`,
    '',
    '/** Göreli Güç karşılaştırma endeksleri (Yahoo sembolü). */',
    `export const TA_BENCHMARK = ${JSON.stringify(ayar.TA_BENCHMARK, null, 2)};`,
    '',
  ].join('\n');

  return { metin: bas, imza, vadeler };
}

/**
 * api/_ekran.js'in TAM metnini döndür — diske yazmadan.
 *
 * GEÇİCİ DOSYA. Kaynak yine `app.js`, ama MOTOR DEĞİL: ekran katmanının
 * motor çıktısına uyguladığı iki sabit kümesi. `readRenderConstants()`
 * bunları üç ekran kopyasından okur ve kopyalar AYRIŞMIŞSA patlar — yani
 * bu dosya ancak üç ekran aynı sayıyı üretirken üretilebiliyor.
 *
 *   PE    → F/K "Değerleme" kriteri: ağırlık, pe<0 skoru, kırılım dizisi.
 *           Yalnız ABD/ADR tarafında ekleniyor; BIST'te böyle bir ek YOK.
 *   BLEND → bileşke harmanı: FA payı + TA payı.
 *
 * Commit C bu mantığı motora devredecek; o gün dosya da, bu üretici de
 * kalkar. Başlıktaki uyarı bunu dosyanın kendisine yazıyor.
 *
 * @returns {{metin:string, imza:string, peKopya:number, harmanKopya:number}}
 */
export function uretEkranKaynak() {
  const K = readRenderConstants();
  const ekran = {
    pe: { weight: K.pe.weight, neg: K.pe.neg, bp: K.pe.bp },
    blend: { fa: K.blend.fa, ta: K.blend.ta },
  };

  // JSON gidiş-dönüşü bu küme için KAYIPSIZ: yalnız sayı ve sayı dizileri var.
  const govde = JSON.stringify(ekran, null, 2);
  const imza = imzala(govde);

  // Kırılım dizisini TEK satırda yaz: JSON.stringify girintisi 8 çifti
  // 30+ satıra yayıyor, okunurluğu düşürüyor. Değerler aynı, biçim derli.
  const bpTxt = '[' + ekran.pe.bp.map((p) => JSON.stringify(p)).join(', ') + ']';

  // ⚠ BAŞLIK TARİHSİZ (bkz. uretKaynak). Kopya sayıları app.js'ten TÜRER →
  // bir ekran kopyası eklenir ya da silinirse başlık değişir, üretim testi
  // sürüklenmeyi yakalar.
  const bas = [
    '// ===========================================================================',
    '//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN   ·   GEÇİCİ: Commit C\'de SİLİNECEK',
    '// ===========================================================================',
    '//',
    '//  Kaynak : app.js (ekran katmanı sabitleri — readRenderConstants)',
    '//  Yenile : node tools/motor-uret.mjs',
    '//  Doğrula: node tests/uretim-test.mjs',
    '//',
    '//  NEDEN VAR: motorun döndürdüğü skor kullanıcının gördüğü skor DEĞİL.',
    '//  Ekran katmanı araya iki şey sokuyor: F/K "Değerleme" kriterini kriter',
    '//  listesine ekliyor (yalnız ABD/ADR) ve FA/TA bileşkesini harmanlıyor.',
    '//  /api/score aynı sayıyı döndürmek zorunda olduğu için sabitler burada.',
    '//',
    '//  NEDEN GEÇİCİ: doğru yer burası değil, motorun içi. Commit C kriteri',
    '//  motora devredip app.js\'teki ekran kopyalarını kaldıracak; o gün bu',
    '//  dosya SİLİNİR. Kalıcı sanıp üstüne bir şey inşa etmeyin.',
    '//',
    `//  F/K kriteri     : ${K.pe.sites} ekran kopyası, hepsi aynı`,
    `//  Bileşke harmanı : ${K.blend.sites} kopya, hepsi aynı`,
    '//',
    '//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.',
    '// ===========================================================================',
    '',
    `export const IMZA_EKRAN = '${imza}';`,
    '',
    '/**',
    ' * F/K "Değerleme" kriteri — app.js ekran katmanından okundu.',
    ' *   pe   = price / eps',
    ' *   skor = pe < 0 ? PE.neg : faInterp(pe, PE.bp)',
    ' * Kriter listesine PE.weight ağırlığıyla, `valuation` grubunda ekleniyor.',
    ' * BIST\'te bu ek YOK — orada fa = computeFaScore(model.criteria) doğrudan.',
    ' */',
    'export const PE = {',
    `  weight: ${ekran.pe.weight},`,
    `  neg: ${ekran.pe.neg},`,
    `  bp: ${bpTxt},`,
    '};',
    '',
    '/** Bileşke harmanı: blended = BLEND.fa * faScore + BLEND.ta * taScore. */',
    `export const BLEND = { fa: ${ekran.blend.fa}, ta: ${ekran.blend.ta} };`,
    '',
  ].join('\n');

  return { metin: bas, imza, peKopya: K.pe.sites, harmanKopya: K.blend.sites };
}

// --- CLI ------------------------------------------------------------------
/**
 * Üretilmiş bir dosyanın diskteki haliyle karşılaştırması.
 *
 *   ayni     → satır sonuna DUYARSIZ. Taze klonda core.autocrlf dosyayı CRLF'e
 *              çevirir; bu bir sürüklenme DEĞİL → DENETİM bunu kullanır.
 *   ayniBayt → bayt bayt. YAZMA kararı bunu kullanır, yoksa bir satır sonu
 *              düzeltmesi "değişiklik yok" diye atlanır.
 */
function karsilastir(yol, metin) {
  const norm = (s) => s.replace(/\r\n/g, '\n');
  const varOlan = fs.existsSync(yol) ? fs.readFileSync(yol, 'utf8') : null;
  return {
    varOlan,
    ayni: varOlan !== null && norm(varOlan) === norm(metin),
    ayniBayt: varOlan === metin,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const denetle = process.argv.includes('--denetle');
  const motor = uretKaynak();
  const ayar = uretAyarKaynak();
  const ekran = uretEkranKaynak();

  const isler = [
    {
      ad: 'api/_motor.js', yol: CIKTI, metin: motor.metin, imza: motor.imza,
      ozet: `${motor.toplam} satır / ${motor.dilimler.length} dilim`,
      kaynak: 'app.js',
    },
    {
      ad: 'api/_ayar.js', yol: CIKTI_AYAR, metin: ayar.metin, imza: ayar.imza,
      ozet: `${ayar.vadeler.length} vade (${ayar.vadeler.join(', ')})`,
      kaynak: 'config.js',
    },
    {
      ad: 'api/_ekran.js', yol: CIKTI_EKRAN, metin: ekran.metin, imza: ekran.imza,
      ozet: `F/K ${ekran.peKopya} kopya · harman ${ekran.harmanKopya} kopya`,
      kaynak: 'app.js (ekran)',
    },
  ];

  if (denetle) {
    let kotu = 0;
    for (const i of isler) {
      const k = karsilastir(i.yol, i.metin);
      if (k.ayni) {
        console.log(`✅ ${i.ad} güncel — ${i.imza}, ${i.ozet}.`);
        continue;
      }
      console.log(k.varOlan === null
        ? `YOK: ${i.ad} üretilmemiş.`
        : `SÜRÜKLENME: ${i.ad} ${i.kaynak} ile aynı değil.`);
      kotu++;
    }
    if (kotu) {
      console.log('Düzelt: node tools/motor-uret.mjs');
      process.exit(1);
    }
    process.exit(0);
  }

  for (const i of isler) {
    const k = karsilastir(i.yol, i.metin);
    if (k.ayniBayt) {
      console.log(`değişiklik yok: ${i.ad} — ${i.imza}, ${i.ozet}.`);
      continue;
    }
    fs.mkdirSync(path.dirname(i.yol), { recursive: true });
    fs.writeFileSync(i.yol, i.metin);   // metin LF'e çekildi — api/proxy.js örneği
    // DÜRÜST ETİKET: taze klonda core.autocrlf dosyayı CRLF yapar; yazma kararı
    // bayt bayt olduğu için dosya LF'e geri çekilir. İÇERİK değişmediyse bunu
    // "yenilendi" diye bildirmek yanıltıcı olur.
    const etiket = k.varOlan === null ? 'üretildi' : (k.ayni ? 'satır sonu düzeltildi' : 'yenilendi');
    console.log(`${etiket}: ${i.ad}`);
    console.log(`  imza   : ${i.imza}`);
    console.log(`  içerik : ${i.ozet}`);
    console.log(`  dosya  : ${(i.metin.match(/\n/g) || []).length} satır, ${Buffer.byteLength(i.metin, 'utf8')} bayt`);
  }
  console.log('Doğrula: node tests/uretim-test.mjs');
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
}
