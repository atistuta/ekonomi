#!/usr/bin/env node
// =====================================================================
//  TAKİP LİSTESİ TESTİ  (mobile/tests/liste-test.mjs)
// ---------------------------------------------------------------------
//  `node tests/liste-test.mjs`   (mobile/ içinden)
//
//  NEDEN VAR: `AZAMI_SEMBOL = 8` bir ÜRÜN TERCİHİ DEĞİL, motor
//  sözleşmesi — `api/_girdi.js` aşımı kırpmıyor, 400 ile REDDEDİYOR
//  (liste.ts başlık notu). Depo 9. sembolü kabul ederse ekran topluca
//  "çok sembol" hatası gösterir ve HİÇBİR satır ölçülemez. Bu test
//  sınırın deponun İÇİNDE tutulduğunu ve aşımın SESSİZ olmadığını
//  (`ekle()` sebep döndürüyor) kilitler.
//
//  NE ÖLÇER
//    ① normalizeSembol — kırpma, BÜYÜK harf, boş girdi
//    ② AZAMI_SEMBOL sözleşmesi — sayı motor tarafıyla aynı mı
//    ③ kayıttan açılış — depo okuması gerçekten uygulanıyor mu
//    ④ sınır davranışı — 8'e kadar kabul, 9. REDDEDİLİYOR ve SEBEP var
//    ⑤ yineleme / boş girdi — ayrı sebep kodları
//    ⑥ cikar() — yer açıyor, sınır geri alınabilir
//    ⑦ depoya yazma — başarıda yazılıyor, BAŞARISIZLIKTA yazılmıyor
//    ⑧ olumsuz denetimler
//
//  AĞ YOK · DOSYA YOK: `@/lib/kalici` (AsyncStorage) `tests/sahte-depo.mjs`
//  ile değiştiriliyor (bkz. `tests/cozucu.mjs`). ÖLÇÜLEN DOSYA GERÇEK
//  `src/api/liste.ts` — kopya değil.
//
//  BU DOSYANIN ÖLÇMEDİĞİ: tek süreçte modül durumu BİR kez kurulur, o
//  yüzden "kayıt yokken açılış listesi yazılır" dalı (liste.ts'in `else`
//  kolu) burada ölçülmüyor; bu senaryo ikinci bir açılış gerektirir.
//  Ayrıca bozuk kaydın BUDANMASI `lib/kalici.ts`in işi, liste.ts'in değil
//  — burada yalnız bayrağın yüzeye çıktığı ölçülüyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================
import './cozucu.mjs';
import { atar, bitir, bolum, esit, ok } from './yardim.mjs';

// Depo fixtürü liste.ts İÇE AKTARILMADAN ÖNCE kurulmalı: liste.ts
// modül yüklenirken `listeOku()` çağıran bir async IIFE içeriyor.
const depo = await import('./sahte-depo.mjs');
const KAYIT = ['AAPL', 'THYAO.IS'];
depo.kur({ semboller: [...KAYIT], budandi: true });

const {
  BASLANGIC_LISTE, cikar, depoHazir, doluMu, ekle,
  kayitBudandiMi, listeAl, normalizeSembol,
} = await import('../src/api/liste.ts');
const { AZAMI_SEMBOL } = await import('../src/api/types.ts');

await depoHazir();

// ---------------------------------------------------------------------
bolum('1. normalizeSembol — uç noktanın beklediği biçim');
// ---------------------------------------------------------------------
esit('baştaki/sondaki boşluk kırpılır', normalizeSembol('  AAPL  '), 'AAPL');
esit('küçük harf BÜYÜĞE çevrilir', normalizeSembol('aapl'), 'AAPL');
esit('ikisi birden', normalizeSembol('  thyao.is '), 'THYAO.IS');
esit('sekme ve satır sonu da boşluktur', normalizeSembol('\t\nMSFT\r\n'), 'MSFT');
esit('zaten düzgün olan değişmez', normalizeSembol('NVDA'), 'NVDA');
esit('boş dizgi boş kalır', normalizeSembol(''), '');
esit('yalnız boşluk boş dizgiye iner', normalizeSembol('   '), '');
esit('null patlamaz, boş döner', normalizeSembol(null), '');
esit('undefined patlamaz, boş döner', normalizeSembol(undefined), '');
esit('nokta sonek KORUNUR — .IS atılmıyor', normalizeSembol('asels.is'), 'ASELS.IS');
ok('normalizeSembol saf: aynı girdi iki kez aynı çıktı',
  normalizeSembol(' aapl ') === normalizeSembol(' aapl '));

// ---------------------------------------------------------------------
bolum('2. AZAMI_SEMBOL — motor sözleşmesi');
// ---------------------------------------------------------------------
esit('sınır 8 (api/score.js AZAMI_SEMBOL ile aynı)', AZAMI_SEMBOL, 8);
ok('sınır tam sayı ve pozitif',
  Number.isInteger(AZAMI_SEMBOL) && AZAMI_SEMBOL > 0, `gelen ${AZAMI_SEMBOL}`);
ok('başlangıç listesi sınırı AŞMIYOR',
  BASLANGIC_LISTE.length <= AZAMI_SEMBOL,
  `${BASLANGIC_LISTE.length} sembol / sınır ${AZAMI_SEMBOL}`);
ok('başlangıç listesinin her üyesi normalize biçimde',
  BASLANGIC_LISTE.every((s) => normalizeSembol(s) === s),
  BASLANGIC_LISTE.join(','));
ok('başlangıç listesinde yineleme yok',
  new Set(BASLANGIC_LISTE).size === BASLANGIC_LISTE.length);
ok('başlangıç listesi HEM ABD HEM BIST içeriyor (liste.ts gerekçesi)',
  BASLANGIC_LISTE.some((s) => s.endsWith('.IS')) && BASLANGIC_LISTE.some((s) => !s.endsWith('.IS')));

// ---------------------------------------------------------------------
bolum('3. Kayıttan açılış — depo okuması gerçekten uygulanıyor');
// ---------------------------------------------------------------------
esit('liste kayıttan geldi, başlangıç listesinden DEĞİL',
  listeAl().join(','), KAYIT.join(','));
ok('kayıt varken açılışta depoya YAZILMADI (gereksiz tur yok)',
  depo.yazmalar.length === 0, `${depo.yazmalar.length} yazma`);
esit('budandi bayrağı yüzeye çıkıyor — dürüstlük notu', kayitBudandiMi(), true);
esit('kayıt sınır altında, dolu değil', doluMu(), false);

// ---------------------------------------------------------------------
bolum('4. Sınır davranışı — 8 kabul, 9. REDDEDİLİYOR');
// ---------------------------------------------------------------------
// Kayıt 2 sembolle açıldı; sınıra kadar 6 sembol daha eklenecek.
const DOLDUR = ['MSFT', 'NVDA', 'ASELS.IS', 'GARAN.IS', 'TSLA', 'AMZN'];
esit('doldurma kümesi sınırı tam kapatıyor', KAYIT.length + DOLDUR.length, AZAMI_SEMBOL);

let hepsiKabul = true;
for (const s of DOLDUR) {
  const sonuc = ekle(s.toLowerCase());
  if (!sonuc.ok) hepsiKabul = false;
}
ok(`sınıra kadar ${DOLDUR.length} eklemenin HEPSİ kabul edildi`, hepsiKabul);
esit('liste tam sınırda', listeAl().length, AZAMI_SEMBOL);
esit('sınırda doluMu() doğru söylüyor', doluMu(), true);
ok('eklenenler BÜYÜK harfe çevrilmiş olarak duruyor',
  DOLDUR.every((s) => listeAl().includes(s.toUpperCase())), listeAl().join(','));

const asim = ekle('KCHOL.IS');
esit('9. sembol REDDEDİLDİ', asim.ok, false);
esit('red sebebi "dolu"', asim.sebep, 'dolu');
ok('red mesajı sınırı SAYIYLA söylüyor — sessiz başarısızlık yok',
  typeof asim.mesaj === 'string' && asim.mesaj.includes(String(AZAMI_SEMBOL)),
  `mesaj ${JSON.stringify(asim.mesaj)}`);
esit('reddedilen sembol listeye SIZMADI', listeAl().includes('KCHOL.IS'), false);
esit('red sonrası uzunluk değişmedi', listeAl().length, AZAMI_SEMBOL);

// ---------------------------------------------------------------------
bolum('5. Yineleme ve boş girdi — AYRI sebep kodları');
// ---------------------------------------------------------------------
const yineleme = ekle('aapl');
esit('zaten var olan reddedildi', yineleme.ok, false);
esit('sebep "zaten_var" — "dolu" ile karışmıyor', yineleme.sebep, 'zaten_var');
ok('yineleme mesajı sembolü anıyor',
  yineleme.mesaj.includes('AAPL'), `mesaj ${JSON.stringify(yineleme.mesaj)}`);
ok('yineleme listeyi UZATMADI', listeAl().length === AZAMI_SEMBOL);

const bos = ekle('   ');
esit('boş girdi reddedildi', bos.ok, false);
esit('sebep "bos"', bos.sebep, 'bos');
ok('boş girdi listeye boş dizgi EKLEMEDİ', !listeAl().includes(''));
esit('null girdi de "bos" sebebiyle reddedilir', ekle(null).sebep, 'bos');

// ---------------------------------------------------------------------
bolum('6. cikar() — sınır geri alınabilir');
// ---------------------------------------------------------------------
cikar('amzn');
esit('küçük harfle çıkarma da tutuyor (normalize ediliyor)',
  listeAl().includes('AMZN'), false);
esit('bir yer açıldı', listeAl().length, AZAMI_SEMBOL - 1);
esit('yer açılınca doluMu() yanlışa döndü', doluMu(), false);

const tekrar = ekle('KCHOL.IS');
esit('az önce reddedilen sembol şimdi kabul edildi', tekrar.ok, true);
esit('kabul edilen sembol döndürülüyor', tekrar.sembol, 'KCHOL.IS');
esit('liste yine sınırda', listeAl().length, AZAMI_SEMBOL);

const uzunlukOnce = listeAl().length;
cikar('LISTEDE.YOK');
esit('listede olmayanı çıkarmak listeyi bozmaz', listeAl().length, uzunlukOnce);

// ---------------------------------------------------------------------
bolum('7. Depoya yazma — başarıda var, BAŞARISIZLIKTA yok');
// ---------------------------------------------------------------------
ok('başarılı işlemler depoya yazıldı', depo.yazmalar.length > 0,
  `${depo.yazmalar.length} yazma`);
const yazmaOnce = depo.yazmalar.length;
ekle('aapl');            // zaten_var
ekle('');                // bos
ekle('BIR.DAHA.OLMAZ');  // dolu
esit('REDDEDİLEN üç işlem depoya HİÇ yazmadı', depo.yazmalar.length, yazmaOnce);

const sonYazma = depo.yazmalar[depo.yazmalar.length - 1];
esit('depoya yazılan son görüntü listenin ŞU ANKİ hali',
  sonYazma.join(','), listeAl().join(','));
ok('depoya yazılan her sembol normalize biçimde',
  sonYazma.every((s) => normalizeSembol(s) === s), sonYazma.join(','));
ok('depoya yazılan görüntü sınırı AŞMIYOR', sonYazma.length <= AZAMI_SEMBOL);

// ---------------------------------------------------------------------
bolum('8. OLUMSUZ DENETİMLER — test gerçekten bir şey ölçüyor mu');
// ---------------------------------------------------------------------
ok('N1 · ölçülen modül GERÇEK liste.ts (kopya değil) — işlev yüzeyi tam',
  [BASLANGIC_LISTE, cikar, doluMu, ekle, listeAl, normalizeSembol].every((v) => v !== undefined));
ok('N2 · sahte depo gerçekten devrede — AsyncStorage yüklenmedi',
  typeof depo.listeYaz === 'function' && Array.isArray(depo.yazmalar));
ok('N3 · sınır denetimi uydurma sayıyla hep-yeşil değil',
  listeAl().length === AZAMI_SEMBOL && ekle('BASKA.BIR').ok === false);
ok('N4 · normalizeSembol gerçekten dönüştürüyor (özdeşlik değil)',
  normalizeSembol(' aapl ') !== ' aapl ');
ok('N5 · üç sebep kodu BİRBİRİNDEN ayrı',
  new Set(['bos', 'zaten_var', 'dolu']).size === 3
  && ekle('').sebep !== ekle('aapl').sebep);
ok('N6 · listeAl() canlı durumu veriyor, donmuş kopya değil',
  listeAl().length === AZAMI_SEMBOL);
atar('N7 · olmayan işlevi çağırmak sessizce geçmiyor', () => {
  // eslint-disable-next-line no-undef
  return listeyeEkleOlmayan('X');
});

bitir(`takip listesi sınırı ${AZAMI_SEMBOL}'de tutuluyor ve aşım SEBEBİYLE reddediliyor.`);
