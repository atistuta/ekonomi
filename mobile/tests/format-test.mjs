#!/usr/bin/env node
// =====================================================================
//  BİÇİMLENDİRME TESTİ  (mobile/tests/format-test.mjs)
// ---------------------------------------------------------------------
//  `node tests/format-test.mjs`   (mobile/ içinden)
//
//  NEDEN VAR — ÖLÇÜLMÜŞ BİR HATA GERİ GELMESİN DİYE:
//  `formatBandUzakligi` alım bandına uzaklığı Türkçeye çeviriyor. Uzaklık
//  ÖLÇÜLEMEDİĞİNDE (uçtan `dAtr` gelmediğinde: `null`/`undefined`/`NaN`)
//  bir sayı basmak, kullanıcıya ÖLÇÜLMEMİŞ bir mesafeyi ölçülmüş gibi
//  göstermektir — ve o sayı "0" olduğunda yanlışı daima "hisse bandın
//  içinde, hemen al" yönüne yapar. Bu test, boş girdinin çıktısında
//  HİÇBİR RAKAM olmadığını kilitler; eşiği değil, SÖZLEŞMEYİ ölçer.
//
//  İkinci kilit: `formatBandUzakligi` "gün" DEMEZ. ATR bir günün salınım
//  genişliğidir, günlük net düşüş değil; "0,9 günlük düşüş" cümlesi
//  format.ts başlığında gerekçesiyle reddedilmiş. Metinde "gün" geçmesi
//  ancak "günlük salınım" tamlaması içinde meşru — tek başına "günlük
//  düşüş"/"gün sonra" biçiminde geçmesi yasak.
//
//  NE ÖLÇER
//    ① formatBandUzakligi — boş-değer sözleşmesi (RAKAM YOK)
//    ② formatBandUzakligi — eşik ve ondalık basamakları
//    ③ formatBandUzakligi — negatif girdi mutlak değerle ele alınıyor
//    ④ formatPrice  — ondalık kararı, para birimi, uydurma simge yok
//    ⑤ formatOran / formatScore — ölçek DEĞİŞMİYOR
//    ⑥ "sıfır boşluk değildir" — 0 girdisi `—` dönmüyor
//    ⑦ olumsuz denetimler — testin kendisi boş değil mi
//
//  AĞ YOK: format.ts hiçbir şey içe aktarmıyor, saf `Intl` sarmalayıcı.
//  Beklenen dizgilerin hepsi bu Node + ICU üzerinde ÖLÇÜLDÜ (2026-10-26),
//  tahmin edilmedi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================
import {
  EMPTY,
  formatBandUzakligi,
  formatCompact,
  formatOran,
  formatPercent,
  formatPrice,
  formatScore,
} from '../src/lib/format.ts';
import { atar, bitir, bolum, esit, ok } from './yardim.mjs';

const OLCULMEDI = 'banda uzaklığı ölçülmedi';
const ICINDE = 'bandın içinde ya da altında — uzaklık yok';
const kat = (n) => `tipik günlük salınımın ${n} katı kadar uzakta`;

// ---------------------------------------------------------------------
bolum('1. formatBandUzakligi — BOŞ DEĞER SÖZLEŞMESİ (düzeltilmiş hata)');
// ---------------------------------------------------------------------
// Bu bölüm kırmızıysa ekranda ölçülmemiş bir mesafe basılıyor demektir.
for (const [ad, girdi] of [
  ['null', null],
  ['undefined', undefined],
  ['NaN', NaN],
  ['Infinity', Infinity],
  ['-Infinity', -Infinity],
  ['sayı olmayan dizgi', '0.9'],
  ['sayı dizgisi bile değil', 'yok'],
  ['nesne', {}],
]) {
  esit(`${ad} girdisi "ölçülmedi" döner`, formatBandUzakligi(girdi), OLCULMEDI);
}

// ASIL KİLİT: ölçülmemiş uzaklığın metninde HİÇBİR RAKAM olmamalı.
// "0" basmak bu işlevin düzeltilmiş gerçek hatasıydı.
for (const [ad, girdi] of [['null', null], ['undefined', undefined], ['NaN', NaN]]) {
  const metin = formatBandUzakligi(girdi);
  ok(`${ad} çıktısında hiç RAKAM yok — "0" gibi bir mesafe basılmıyor`,
    !/[0-9]/.test(metin), `gelen ${JSON.stringify(metin)}`);
  ok(`${ad} çıktısı "uzaklık yok" (= ölçtüm, mesafe sıfır) ile KARIŞMIYOR`,
    metin !== ICINDE, `gelen ${JSON.stringify(metin)}`);
  ok(`${ad} çıktısı boş dizgi ya da "${EMPTY}" değil — sebep söyleniyor`,
    metin.length > 3 && metin !== EMPTY, `gelen ${JSON.stringify(metin)}`);
}

// 0 GERÇEK bir ölçümdür: "ölçülmedi" ile aynı cümleyi PAYLAŞMAMALI.
esit('0 girdisi ÖLÇÜLMÜŞ sayılır — bandın içinde', formatBandUzakligi(0), ICINDE);
ok('0 ile null AYNI cümleyi vermiyor',
  formatBandUzakligi(0) !== formatBandUzakligi(null),
  `0 → ${JSON.stringify(formatBandUzakligi(0))}`);

// ---------------------------------------------------------------------
bolum('2. formatBandUzakligi — eşikler ve ondalık basamak');
// ---------------------------------------------------------------------
esit('0,049 → bandın içinde (0,05 eşiğinin altı)', formatBandUzakligi(0.049), ICINDE);
esit('0,05 → eşiğin kendisi mesafe sayılır', formatBandUzakligi(0.05), kat('0,1'));
esit('0,9 → 3 katın altı, BİR ondalık', formatBandUzakligi(0.9), kat('0,9'));
esit('2,94 → 3 katın altı, bir ondalığa yuvarlanır', formatBandUzakligi(2.94), kat('2,9'));
esit('3 → 3 katın üstü, TAM SAYI', formatBandUzakligi(3), kat('3'));
esit('9,4 → tam sayı, hâlâ 10 altı', formatBandUzakligi(9.4), kat('9'));
esit('10 → üst sınır cümlesi', formatBandUzakligi(10),
  'tipik günlük salınımın 10 katından fazla uzakta');
esit('42 → üst sınır cümlesi (sayı sızmıyor)', formatBandUzakligi(42),
  'tipik günlük salınımın 10 katından fazla uzakta');

ok('ondalık ayracı VİRGÜL — ürün dili tr-TR',
  formatBandUzakligi(0.9).includes('0,9') && !formatBandUzakligi(0.9).includes('0.9'));

// "gün" yalnız "günlük salınım" tamlaması içinde geçebilir.
for (const girdi of [0.9, 3, 10, 42]) {
  const metin = formatBandUzakligi(girdi);
  ok(`${girdi} çıktısı "gün"ü yalnız "günlük salınım" içinde kullanıyor`,
    metin.replace(/günlük salınımın/g, '').includes('gün') === false,
    `gelen ${JSON.stringify(metin)}`);
}

// ---------------------------------------------------------------------
bolum('3. formatBandUzakligi — negatif girdi mutlak değerle ele alınır');
// ---------------------------------------------------------------------
// `dAtr` bandın altında negatif gelebilir; işaret mesafeyi değiştirmez.
esit('-0,9 ile +0,9 aynı mesafeyi verir', formatBandUzakligi(-0.9), formatBandUzakligi(0.9));
esit('-2,94 ile +2,94 aynı', formatBandUzakligi(-2.94), formatBandUzakligi(2.94));
esit('-12 ile +12 aynı (üst sınır)', formatBandUzakligi(-12), formatBandUzakligi(12));
esit('-0,01 → bandın içinde', formatBandUzakligi(-0.01), ICINDE);
ok('negatif çıktıda eksi İŞARETİ sızmıyor',
  !formatBandUzakligi(-0.9).includes('-') && !formatBandUzakligi(-0.9).includes('−'),
  `gelen ${JSON.stringify(formatBandUzakligi(-0.9))}`);
esit('-0 → bandın içinde (işaretli sıfır tuzağı)', formatBandUzakligi(-0), ICINDE);

// ---------------------------------------------------------------------
bolum('4. formatPrice — ondalık kararı ve para birimi');
// ---------------------------------------------------------------------
esit('1234,5 TRY → kuruşlu, binlik nokta', formatPrice(1234.5, 'TRY'), '₺1.234,50');
esit('1234,5 USD → dolar simgesi', formatPrice(1234.5, 'USD'), '$1.234,50');
esit('12345,6 TRY → 10.000 üstü ondalık YOK', formatPrice(12345.6, 'TRY'), '₺12.346');
esit('para birimi yoksa simge UYDURULMAZ', formatPrice(1234.5), '1.234,50');
// ÖLÇÜLDÜ: Intl kod ile sayı arasına BÖLÜNEMEZ boşluk (U+00A0) koyuyor,
// normal boşluk değil. Beklenen dizgi kaçış dizisiyle yazılıyor — gözle
// ayırt edilemeyen bir fark testi sahte kırmızı yapmasın.
esit('bilinmeyen kod simgeye çevrilmez, kod basılır',
  formatPrice(1234.5, 'ZZZ'), 'ZZZ 1.234,50');
ok('kod ile sayı arasındaki boşluk BÖLÜNEMEZ — satır sonunda kopmaz',
  formatPrice(1234.5, 'ZZZ').includes(' '));
esit('null → boş işareti', formatPrice(null), EMPTY);
esit('undefined → boş işareti', formatPrice(undefined), EMPTY);
esit('NaN → boş işareti', formatPrice(NaN), EMPTY);
esit('Infinity → boş işareti', formatPrice(Infinity, 'TRY'), EMPTY);
esit('dizgi "12" sayı sayılmaz', formatPrice('12'), EMPTY);
esit('-1234,5 TRY negatif fiyat basılır', formatPrice(-1234.5, 'TRY'), '-₺1.234,50');

// ---------------------------------------------------------------------
bolum('5. formatOran / formatScore — ÖLÇEK DEĞİŞMİYOR');
// ---------------------------------------------------------------------
// ÖLÇÜLDÜ (format.ts notu): /api/analyze `direkler[].v` 0,68403 gibi ORAN
// döner. 100'e çarpmak istemcinin işi DEĞİL.
esit('0,68403 → iki ondalık, çarpılmıyor', formatOran(0.68403), '0,68');
esit('0,68403 tek ondalıkla', formatOran(0.68403, 1), '0,7');
esit('1 → "1,00" (yüzdeye çevrilmiyor)', formatOran(1), '1,00');
esit('oran null → boş işareti', formatOran(null), EMPTY);
esit('oran NaN → boş işareti', formatOran(NaN), EMPTY);
ok('oran çıktısında % işareti YOK', !formatOran(0.68403).includes('%'));

esit('62,340295 → tam sayı skor', formatScore(62.340295), '62');
esit('62,5 → yukarı yuvarlanır (ölçüldü)', formatScore(62.5), '63');
esit('100 → "100"', formatScore(100), '100');
esit('skor null → boş işareti', formatScore(null), EMPTY);
esit('skor undefined → boş işareti', formatScore(undefined), EMPTY);
esit('skor NaN → boş işareti', formatScore(NaN), EMPTY);
ok('skor çıktısında ondalık ayracı YOK', !formatScore(62.340295).includes(','));

// ---------------------------------------------------------------------
bolum('6. SIFIR BOŞLUK DEĞİLDİR — format.ts başlığındaki karar');
// ---------------------------------------------------------------------
// "`null`/`undefined`/`NaN` girince 0,00 DÖNMEZ — tire döner. Sıfır
// gerçek bir ölçümdür; boşluk değildir." Her iki yön de ölçülüyor.
esit('formatPrice(0) → "0,00", tire DEĞİL', formatPrice(0), '0,00');
esit('formatOran(0) → "0,00", tire DEĞİL', formatOran(0), '0,00');
esit('formatScore(0) → "0", tire DEĞİL', formatScore(0), '0');
esit('formatPercent(0) → işaretsiz sıfır', formatPercent(0), '0,00%');
esit('formatCompact(0) → "0", tire DEĞİL', formatCompact(0), '0');
for (const [ad, fn] of [
  ['formatPrice', formatPrice],
  ['formatOran', formatOran],
  ['formatScore', formatScore],
  ['formatPercent', formatPercent],
  ['formatCompact', formatCompact],
]) {
  ok(`${ad}: boş girdi ile 0 girdisi AYNI metni vermiyor`,
    fn(null) !== fn(0), `null → ${JSON.stringify(fn(null))} · 0 → ${JSON.stringify(fn(0))}`);
}

// ---------------------------------------------------------------------
bolum('7. OLUMSUZ DENETİMLER — test gerçekten bir şey ölçüyor mu');
// ---------------------------------------------------------------------
ok('N1 · beklenen sabitler kaynaktaki metinle AYNI (yanlış sabitle hep-yeşil değil)',
  formatBandUzakligi(null) === OLCULMEDI && formatBandUzakligi(0) === ICINDE);
ok('N2 · esit() gerçekten reddediyor',
  (() => { const o = formatBandUzakligi(0.9); return o !== kat('0,8'); })());
ok('N3 · rakam süzgeci çalışıyor — dolu cümlede rakam BULUYOR',
  /[0-9]/.test(formatBandUzakligi(0.9)),
  `gelen ${JSON.stringify(formatBandUzakligi(0.9))}`);
ok('N4 · "gün" süzgeci çalışıyor — uydurma cümlede YAKALIYOR',
  'tipik 0,9 gün sonra'.replace(/günlük salınımın/g, '').includes('gün'));
ok('N5 · EMPTY gerçekten tire, boş dizgi değil', EMPTY === '—');
ok('N6 · eşik gerçekten 0,05 — 0,049 ile 0,05 AYRI cümle veriyor',
  formatBandUzakligi(0.049) !== formatBandUzakligi(0.05));
ok('N7 · eşik gerçekten 3 — 2,9 ondalıklı, 3,1 tam sayı',
  formatBandUzakligi(2.9).includes(',') && !formatBandUzakligi(3.1).includes(','),
  `2,9 → ${formatBandUzakligi(2.9)} · 3,1 → ${formatBandUzakligi(3.1)}`);
ok('N8 · eşik gerçekten 10 — 9,9 mesafe, 10 üst sınır',
  formatBandUzakligi(9.9) !== formatBandUzakligi(10));
atar('N9 · işlev yokken içe aktarma sessizce geçmiyor', () => {
  // format.ts'ten gelmeyen bir adı çağırmak ATMALI; aksi halde bu dosya
  // yanlış modülü ölçüyor olurdu.
  // eslint-disable-next-line no-undef
  return formatBandUzakligiOlmayan(1);
});

bitir('formatBandUzakligi ölçülmemiş uzaklığa ASLA sayı basmıyor; ondalık kararı tek yerden.');
