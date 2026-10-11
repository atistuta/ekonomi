#!/usr/bin/env node
// ===========================================================================
//  MOTOR ÜRETİCİ — app.js → api/_motor.js
// ===========================================================================
//
//  NE YAPAR: `app.js`'teki skor motorunu dilimler ve sunucuda koşabilen tek
//  bir ESM modülü olarak yazar. Üretilen dosya `/api/score`'un (ve sonraki
//  uçların) içe alacağı motordur.
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
import { ROOT, EXPORTS, readApp, engineSource, sliceInfo } from '../tests/engine.mjs';

export const CIKTI = path.join(ROOT, 'api', '_motor.js');

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

// --- CLI ------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const denetle = process.argv.includes('--denetle');
  const { metin, imza, dilimler, toplam } = uretKaynak();
  const norm = (s) => s.replace(/\r\n/g, '\n');
  const varOlan = fs.existsSync(CIKTI) ? fs.readFileSync(CIKTI, 'utf8') : null;
  const ayni = varOlan !== null && norm(varOlan) === norm(metin);
  // DENETİM satır sonuna duyarsız (taze klonda core.autocrlf dosyayı CRLF'e
  // çevirir — bu bir sürüklenme DEĞİL), YAZMA kararı ise bayt bayt: yoksa
  // satır sonu düzeltmesi "değişiklik yok" diye atlanır.
  const ayniBayt = varOlan === metin;

  if (denetle) {
    if (!ayni) {
      console.log(varOlan === null ? 'YOK: api/_motor.js üretilmemiş.' : 'SÜRÜKLENME: api/_motor.js app.js ile aynı değil.');
      console.log('Düzelt: node tools/motor-uret.mjs');
      process.exit(1);
    }
    console.log(`✅ api/_motor.js güncel — ${imza}, ${toplam} satır / ${dilimler.length} dilim.`);
    process.exit(0);
  }

  if (ayniBayt) {
    console.log(`değişiklik yok — ${imza}, ${toplam} satır / ${dilimler.length} dilim.`);
  } else {
    fs.mkdirSync(path.dirname(CIKTI), { recursive: true });
    fs.writeFileSync(CIKTI, metin);   // metin uretKaynak()'ta LF'e çekildi — api/proxy.js örneği
    console.log(`${varOlan === null ? 'üretildi' : 'yenilendi'}: api/_motor.js`);
    console.log(`  imza   : ${imza}`);
    console.log(`  motor  : ${toplam} satır / ${dilimler.length} dilim`);
    console.log(`  dosya  : ${(metin.match(/\n/g) || []).length} satır, ${Buffer.byteLength(metin, 'utf8')} bayt`);
  }
  console.log('Doğrula: node tests/uretim-test.mjs');
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
}
