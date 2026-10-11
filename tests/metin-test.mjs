// =====================================================================
//  BELİRTEÇ BİÇİMİ KANITI  (tests/metin-test.mjs)              FAZ 1/3
// ---------------------------------------------------------------------
//  `node tests/metin-test.mjs`
//
//  Soru: motor HTML yerine belirteç dizisi döndürmeye geçerse WEB PWA
//  görsel olarak değişir mi?
//
//  Yanıt yöntemi: app.js'teki GERÇEK cümle satırlarını oku, her birini
//  belirtece çevir, geri HTML'e render et ve **bayt bayt** karşılaştır.
//  Tek bayt fark varsa test kırmızı yanar ve farkı gösterir.
//
//  app.js DEĞİŞTİRİLMEZ — yalnızca okunur. (engine.mjs ile aynı kural.)
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  tokensToHtml, tokensToRN, tokensToText, htmlToTokens, WEB_TAG, RN_STYLE,
} from './metin.mjs';
import { buildEngine, ROOT } from './engine.mjs';

const APP = path.join(ROOT, 'app.js');

let gecti = 0;
const kaldi = [];
function ok(ad, kosul, ek) {
  if (kosul) { gecti++; return true; }
  kaldi.push(ad + (ek ? '\n      ' + ek : ''));
  return false;
}
function atar(ad, fn) {
  let e = null;
  try { fn(); } catch (err) { e = err; }
  return ok(ad, e !== null, e ? '' : 'hata beklendi ama fonksiyon sessizce geçti');
}

// ---------------------------------------------------------------------
// 1. Biçim sözleşmesi
// ---------------------------------------------------------------------
console.log('\n1. Biçim sözleşmesi — rol → web etiketi');

ok('düz dize aynen geçer', tokensToHtml('Bugün sakin.') === 'Bugün sakin.');
ok('null boş dizeye düşer', tokensToHtml(null) === '');
ok('dize parçaları birleşir', tokensToHtml(['a', 'b', 'c']) === 'abc');
ok("['v'] → <b>", tokensToHtml([['v', 'olası dönüş']]) === '<b>olası dönüş</b>');
ok("['e'] → <b>", tokensToHtml([['e', 'Not:']]) === '<b>Not:</b>');
ok("['s'] → <b>", tokensToHtml([['s', '₺12,40']]) === '<b>₺12,40</b>');
ok("['d'] → <em>", tokensToHtml([['d', '+1,4%']]) === '<em>+1,4%</em>');
ok("['i'] → <i>", tokensToHtml([['i', 'olabilir']]) === '<i>olabilir</i>');
ok("['br'] → <br>", tokensToHtml([['br']]) === '<br>');
ok(
  'karışık dizi',
  tokensToHtml(['Faiz yönü şu an ', ['v', 'net değil'], '; dengede.'])
    === 'Faiz yönü şu an <b>net değil</b>; dengede.',
);

// ---------------------------------------------------------------------
// 2. Rol inceltmesi HTML'de görünmez
// ---------------------------------------------------------------------
// Bu, biçimin en pratik özelliği: bir cümle önce kaba ['v',…] ile
// taşınıp SONRA ['s',…] (sayı) veya ['e',…] (etiket) olarak
// incelteceksek, web çıktısı hiç değişmez. Dönüşüm kademeli yapılabilir.
console.log('2. Rol inceltmesi web çıktısını değiştirmiyor');

const AYNI = ['v', 'e', 's'];
const ciktilar = AYNI.map((r) => tokensToHtml([[r, 'X']]));
ok('v / e / s üçü de <b>X</b> üretir', new Set(ciktilar).size === 1 && ciktilar[0] === '<b>X</b>', ciktilar.join(' | '));
ok('ama RN stilleri AYRI', RN_STYLE.s.fontVariant && !RN_STYLE.v.fontVariant);
ok('sayı rolü tabular-nums taşır', JSON.stringify(RN_STYLE.s.fontVariant) === '["tabular-nums"]');
ok('soluk rol italik DEĞİL', RN_STYLE.d.fontStyle === undefined && RN_STYLE.d.opacity === 0.85);
ok('web eşlemesi tam', Object.keys(WEB_TAG).sort().join(',') === 'd,e,i,s,v');

// ---------------------------------------------------------------------
// 3. GERÇEK KORPUS — app.js'teki cümle satırları
// ---------------------------------------------------------------------
// Sınıflandırma (ölçüm oturumuyla aynı): bir satırdaki TÜM etiketler
// satır-içi kümesinden ise ve HİÇBİRİNDE öznitelik yoksa, o satır
// "cümle" sayılır. Öznitelikli ya da div/span içeren satır sunum
// iskeletidir — React Native'de zaten yeniden yazılacak.
console.log('3. Gerçek korpus — app.js cümle satırları');

const INLINE = new Set(['b', 'i', 'em', 'strong', 'u', 'small', 'br', 'code']);
const satirlar = fs.readFileSync(APP, 'utf8').split('\n');
const korpus = [];

satirlar.forEach((ln, k) => {
  const ms = [...ln.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)];
  if (!ms.length) return;
  const tagset = new Set(ms.map((m) => m[1].toLowerCase()));
  const oznitelik = ms.some((m) => /\S/.test(m[2].replace(/^\//, '')));
  if (oznitelik) return;
  if (![...tagset].every((t) => INLINE.has(t))) return;
  korpus.push({ no: k + 1, metin: ln.replace(/\r$/, '') });
});

console.log(`   ${korpus.length} cümle satırı bulundu`);
ok('korpus boş değil', korpus.length > 0);

// Ölçülmüş sayı: 46 (2026-10-11). Sapma HATA DEĞİL, uyarıdır — app.js
// büyüyebilir. Asıl iddia aşağıda: hepsi birebir geri dönüyor.
if (korpus.length !== 46) {
  console.log(`   ⚠ korpus değişmiş: 46 → ${korpus.length} satır (ölçüm 2026-10-11)`);
}

// 3a. Kelime dağarcığı tam mı — biçimin tanımadığı bir etiket var mı?
const dagarcik = new Map();
for (const c of korpus) {
  // Yalnız AÇILIŞ etiketi sayılır — metin.mjs başlığındaki ölçümle (b:53) aynı birim.
  for (const m of c.metin.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)) {
    const t = m[1].toLowerCase();
    dagarcik.set(t, (dagarcik.get(t) || 0) + 1);
  }
}
const TANINAN = new Set(['b', 'em', 'i', 'br']);
const yabanci = [...dagarcik.keys()].filter((t) => !TANINAN.has(t));
ok(
  'kelime dağarcığı biçimin tanıdığı 4 etiketten ibaret',
  yabanci.length === 0,
  yabanci.length ? 'biçim dışı etiket: ' + yabanci.join(', ') : '',
);
console.log('   dağarcık (açılış etiketi): ' + [...dagarcik].map(([t, n]) => `${t}:${n}`).join('  '));

// 3b. ★ ASIL İDDİA: her cümle bayt bayt geri dönüyor.
let turRoundtrip = 0;
const bozuk = [];
for (const c of korpus) {
  let geri;
  try {
    geri = tokensToHtml(htmlToTokens(c.metin));
  } catch (e) {
    bozuk.push(`app.js:${c.no}  ÇEVRİLEMEDİ — ${e.message}`);
    continue;
  }
  if (geri === c.metin) { turRoundtrip++; continue; }
  // Farkın ilk baytını göster — "bir şey bozuldu" demek yetmez.
  let i = 0;
  while (i < geri.length && i < c.metin.length && geri[i] === c.metin[i]) i++;
  bozuk.push(
    `app.js:${c.no}  bayt ${i}'de ayrıldı\n`
    + `        beklenen: …${c.metin.slice(Math.max(0, i - 20), i + 30)}…\n`
    + `        üretilen: …${geri.slice(Math.max(0, i - 20), i + 30)}…`,
  );
}
ok(
  `${korpus.length} cümlenin tamamı bayt bayt geri döndü`,
  bozuk.length === 0,
  bozuk.join('\n      '),
);
console.log(`   tur: ${turRoundtrip}/${korpus.length} birebir`);

// ---------------------------------------------------------------------
// 4. Motorun GERÇEK cümleleri (statik, yorumlanmış)
// ---------------------------------------------------------------------
// §3 kaynak satırlarını ölçüyor — içinde `${...}` yer tutucular var.
// Burada ise motoru kurup COMPOSITE_MATRIX'in SON metinlerini alıyoruz:
// kullanıcının ekranda gördüğü, tamamı yorumlanmış gerçek cümleler.
// Skor motorunda etiketli TEK yer bu tablodur (ölçüldü: 1.405 satırda
// 4 etiket / 2 satır), yani /api/score taşıması bu 2 satırla sınırlı.
console.log('4. Motorun gerçek cümleleri — COMPOSITE_MATRIX');

let mtx = null;
try {
  mtx = buildEngine().COMPOSITE_MATRIX;
} catch (e) {
  kaldi.push('motor kurulamadı: ' + e.message);
}

if (mtx) {
  const kayitlar = Object.entries(mtx);
  const etiketli = kayitlar.filter(([, v]) => /<[a-zA-Z]/.test(v.txt || ''));
  console.log(`   ${kayitlar.length} bileşke hücresi, ${etiketli.length} tanesi etiketli`);
  ok('tablo dolu', kayitlar.length > 0);

  let tam = 0;
  for (const [k, v] of kayitlar) {
    const s = v.txt || '';
    let geri;
    try { geri = tokensToHtml(htmlToTokens(s)); } catch (e) {
      kaldi.push(`COMPOSITE_MATRIX['${k}'] çevrilemedi — ${e.message}`);
      continue;
    }
    if (geri === s) tam++;
    else kaldi.push(`COMPOSITE_MATRIX['${k}'] birebir dönmedi`);
  }
  ok(`${kayitlar.length} hücrenin tamamı birebir döndü`, tam === kayitlar.length, `${tam}/${kayitlar.length}`);

  // Aynı cümle üç hedefte — kanıtın görünür yüzü.
  if (etiketli.length) {
    const [anahtar, hucre] = etiketli[0];
    const tok = htmlToTokens(hucre.txt);
    console.log(`\n   örnek — COMPOSITE_MATRIX['${anahtar}']`);
    console.log('   HTML (bugün) : ' + hucre.txt.slice(0, 96));
    console.log('   BELİRTEÇ     : ' + JSON.stringify(tok).slice(0, 96));
    console.log('   WEB (geri)   : ' + tokensToHtml(tok).slice(0, 96));
    console.log('   RN tarif     : ' + JSON.stringify(tokensToRN(tok).slice(0, 3)));
    console.log('   DÜZ METİN    : ' + tokensToText(tok).slice(0, 96));
    ok('örnek birebir', tokensToHtml(tok) === hucre.txt);
    ok('düz metinde etiket kalmadı', !/[<>]/.test(tokensToText(tok)));
  }
}

// ---------------------------------------------------------------------
// 5. Negatif kontrol — testin gerçekten kırmızı yanabildiği kanıtı
// ---------------------------------------------------------------------
// Hep yeşil yanan bir test hiçbir şey ölçmez. Biçimin REDDETMESİ
// gereken her durumun gerçekten patladığını burada gösteriyoruz.
console.log('\n5. Negatif kontrol — reddedilmesi gerekenler');

atar('bilinmeyen rol reddedilir', () => tokensToHtml([['z', 'x']]));
atar('eksik metin reddedilir', () => tokensToHtml([['v']]));
atar('sayısal metin reddedilir', () => tokensToHtml([['v', 42]]));
atar('br metin almaz', () => tokensToHtml([['br', 'x']]));
atar('biçim dışı etiket reddedilir', () => htmlToTokens('bir <span>şey</span>'));
atar('iç içe etiket reddedilir', () => htmlToTokens('<b>bir <i>şey</i></b>'));
atar('kapanmayan etiket reddedilir', () => htmlToTokens('<b>yarım'));
atar('eşleşmeyen kapanış reddedilir', () => htmlToTokens('<b>a</em>'));
atar('RN de bilinmeyen rolü reddeder', () => tokensToRN([['z', 'x']]));

// ---------------------------------------------------------------------
// Sonuç
// ---------------------------------------------------------------------
console.log('\n' + '─'.repeat(60));
if (kaldi.length === 0) {
  console.log(`✅ ${gecti} doğrulama geçti — biçim dönüşümü web çıktısını DEĞİŞTİRMİYOR.`);
  console.log(`   ${korpus.length} gerçek cümle bayt bayt geri döndü; etiket dağarcığı 4 (b/em/i/br).`);
  console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(0);
} else {
  console.log(`❌ ${kaldi.length} doğrulama KALDI (${gecti} geçti):\n`);
  for (const k of kaldi) console.log('   ✗ ' + k);
  console.log('');
  process.exit(1);
}
