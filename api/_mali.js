// =====================================================================
//  📊 MALİ TABLOLAR  —  /api/mali  (TAŞIYICI MODÜL, uç dosyası DEĞİL)
// ---------------------------------------------------------------------
//  NE: webdeki temel analiz bölümünün BESLENDİĞİ ham mali tablo
//  kalemleri. İki pazar, iki ayrı üst kaynak:
//    US   -> SEC XBRL `companyconcept` (app.js:6529-6700 ikizi)
//    BIST -> İş Yatırım `MaliTablo` XI_29 (app.js:6245-6266 ikizi)
//
//  NEDEN YENİ `api/*.js` AÇILMADI: Vercel Hobby tavanı 12 fonksiyon ve
//  `api/` zaten 12 uç dosyası taşıyor. 13'üncüsü dağıtımı SESSİZCE
//  bozuyor. Bu yüzden rota `vercel.json` yeniden-yazımıyla
//  `/api/proxy?__rota=mali`ye düşüyor; dosya `_` önekli, Vercel onu uç
//  saymıyor.
//
//  NEDEN AYRI TAŞIYICI (`_kesif.js`e girmedi): o dosya motor/tarama
//  ailesinin gövdesi. Buranın kaynağı mali tablo yayıncıları, kendi
//  konak izin listesi, kendi zaman aşımı ve kendi sayacı var.
//
//  HAM SAYI KURALI — BU DOSYADA HESAP YOK:
//    · marj, oran, büyüme, FAVÖK, net borç, Piotroski YOK. Hepsi
//      TÜRETME; web ikizinde `bistFundamentalModel` bunları motor
//      tarafında yapıyor, bu uç ona girdi olan HAM KALEMİ taşıyor.
//    · eşik yok, ağırlık yok, formül yok, Türkçe cümle yok.
//    · tek Türkçe alan `uyari`; kalem adları KAPALI KÜMELİ KOD
//      (`gelir`, `netKar`, ...) ve Türkçesi `mobile/src/lib/sozluk.ts`te
//      seçiliyor.
//
//  ÖLÇÜLEMEYEN ALAN `null`, ASLA `0`: İş Yatırım boş `value1` basınca
//  da, SEC şirketin kullanmadığı etiket için 404 verince de `null`
//  gidiyor. `0` "ölçtüm, sıfır çıktı" demek — ikisi karıştırılmıyor.
//
//  SESSİZ KIRPMA YOK: istenen dönem sayısı (`DONEM_SAYISI`) ile gerçekte
//  bulunan dönem sayısı (`donemler.length`) AYRI ve ikisi de gövdede.
//
//  PARA BİRİMİ ÇEVRİLMİYOR: `birim` üst kaynağın kendi birimi (SEC USD,
//  İş Yatırım TRY). Çarpan uygulanmıyor — ölçülmeyen bir kuru ima
//  etmemek için.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { setTimeout as bekle } from 'node:timers/promises';
import { anahtar, oku, yaz, TTL_TEMA } from './_onbellek.js';
// SEC kimlik dizgesi ve istek araligi TEK KAYNAKTAN: `api/_ag.js`
// icindeki olculmus degismezler (api/_iceriden.js:51 ile AYNI gerekce).
// `www.sec.gov` WAF'i UA icinde E-POSTA BICIMLI im ARIYOR; `_ag.js`
// motoru pakete SOKMUYOR (yalniz node:timers ice aliyor).
import { UA_SEC, SEC_ARALIK_MS } from './_ag.js';

// Uyari metni — api/_iceriden.js:54 ve on ucun daha AYNI degismezi.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Izin listesi KENDI dosyamda: proxy'nin `IZINLI_KONAKLAR` kumesi duz
// `?url=` role kapisi, bu tasiyici oradan GECMIYOR (fetch'i kendisi
// yapiyor). UCU DE proxy'nin listesinde ZATEN var, yani bu uc YENI
// KONAK ACMIYOR.
export const IZINLI_KONAK = [
  'www.sec.gov',
  'data.sec.gov',
  'www.isyatirim.com.tr',
];

// Zaman asimlari — web ikizinin OLCULMUS sayilari:
//   · `fetchIsYatirimMali` 15000 (app.js:6251)
//   · sembol->CIK tablosu 15000 (app.js:6545), govdesi megabayt olcegi
//   · `secGet` varsayilani 12000 (app.js:6529)
export const MALI_TABLO_MS = 15000;
export const MALI_KAVRAM_MS = 12000;

// Kisa govde = ariza. En kucuk gecerli JSON govdesi bile yuzlerce bayt.
export const ASGARI_GOVDE_BAYT = 128;

// SEMBOL BICIMI — api/_iceriden.js:81 ile BIREBIR. BIST sembolleri
// harf, ABD sembolleri nokta/tire tasiyabiliyor (`BRK.B`, `RDS-A`).
export const SEMBOL_BICIM = /^[A-Za-z][A-Za-z0-9.\-]{0,11}$/;

// PAZAR KUMESI — web ikizi `market === 'BIST' ? bistFundamentalModel
// : secFetchModel` (app.js:6225 civari). Ucuncu deger 400 aliyor.
export const PAZARLAR = ['US', 'BIST'];

// DONEM SAYISI — web ikizi Is Yatirim'dan dort yillik donem istiyor
// (`period1..period4`, app.js:6247). SEC ayagi da ayni eksende dort
// yillik donem tasiyor ki iki pazar AYNI tabloyla cizilebilsin.
export const DONEM_SAYISI = 4;

// Yillik donem penceresi — web ikizi `d >= 340 && d <= 380`
// (app.js:6591). Esik DEGIL, DONEM SUZGECI: ceyreklik kaydi yillik
// sanmamak icin.
export const YIL_ASGARI_GUN = 340;
export const YIL_AZAMI_GUN = 380;

// EKSEN ESLEME TOLERANSI — SEC'te ayni mali yilin bitisi kalemden
// kaleme birkac gun kayabiliyor (bilanco anligi ile gelir donemi ayni
// gun bitmiyor). Bu tolerans HESAP DEGIL, hizalama: eksendeki doneme
// bu kadar gun icinde dusen kayit o donemin kaydi sayiliyor, uzaktaki
// kayit `null` kaliyor (uydurma hizalama yok).
export const ESLEME_TOLERANS_GUN = 45;

// ES ZAMANLI KAVRAM — web ikizi `secBatches(..., 6)` (app.js:6570).
// Istekler ayrica `SEC_ARALIK_MS` ile araliklaniyor (SEC'in 10 istek/sn
// kurali); _ag.js'teki AYNI sayi, yeniden tanimlanmadi.
export const ES_ZAMANLI_KAVRAM = 6;

// Is Yatirim MaliTablo finansal grubu — app.js:6247 ile AYNI.
export const FINANSAL_GRUP = 'XI_29';

// Is Yatirim yil denemesi — web ikizi `[nowY - 1, nowY - 2, nowY]`
// sirasiyla deniyor (app.js:6250): en guncel TAM yildan geriye.
export const IS_YIL_DENEME = 3;

// Onbellek omru — mali tablo CEYREKLIK yayinlaniyor, gun icinde
// degismiyor; 6 saat. `TTL_FIYAT` (300) bu uc icin anlamsiz sik,
// `TTL_TEMA` (86400) ise yeni bilanco gununu kacirir. Asagida
// yayinlanan `max-age` ile AYNI sayi. Sembol->CIK esleme tablosu AYRI
// ve UZUN omurlu (`TTL_TEMA`): bir sirketin CIK'i degismiyor.
export const TTL_MALI = 21600;

// ---------------------------------------------------------------------
//  KALEM KODLARI — KAPALI KUME. Turkcesi `mobile/src/lib/sozluk.ts`te.
//  Sira EKRAN SIRASI: gelir tablosu -> nakit akisi -> bilanco.
//  Kodlar PAZAR BAGIMSIZ; hangi pazarda hangi kodun sorulabildigi
//  asagidaki iki tabloda yazili. Bir pazarda SORULMAYAN kod o pazarin
//  cevabinda HIC GECMIYOR (anahtar yok = "sorulmadi"), sorulup
//  olculemeyen kodun degeri `null` (= "olcemedim").
// ---------------------------------------------------------------------
export const KALEM_KODLARI = [
  'gelir',
  'brutKar',
  'faaliyetKari',
  'netKar',
  'amortisman',
  'faaliyetNakitAkisi',
  'yatirimHarcamasi',
  'serbestNakitAkisi',
  'donenVarliklar',
  'duranVarliklar',
  'toplamVarliklar',
  'nakitVeBenzeri',
  'kisaVadeliYatirimlar',
  'stoklar',
  'kisaVadeliYukumlulukler',
  'toplamYukumlulukler',
  'kisaVadeliFinansalBorc',
  'uzunVadeliFinansalBorc',
  'ozkaynak',
];

/**
 * BIST tablosu — Is Yatirim `itemCode`lari web ikizinin
 * `bistFundamentalModel`inden (app.js:6269-6272) BIREBIR alindi.
 * `kodlar` dizisi SIRALI YEDEK zinciri: web ikizi net kari
 * `3L -> 3J -> 2OCF` sirasiyla ariyor (app.js:6275). Ilk DOLU kalem
 * kazaniyor; hicbiri dolu degilse deger `null`.
 *
 * TABLODA OLMAYAN KOD SORULMUYOR: `toplamVarliklar` web ikizinde
 * `1A + 1AK` TOPLAMIYLA tureiliyor, `toplamYukumlulukler` ve
 * `yatirimHarcamasi` hic olculmuyor. Toplama bir HESAP; HAM SAYI
 * KURALI geregi burada yapilmiyor ve kod cevaba GIRMIYOR — istemci iki
 * kalemi zaten ayri ayri goruyor.
 */
export const BIST_KALEM = Object.freeze([
  { kod: 'gelir', kodlar: ['3C'] },
  { kod: 'brutKar', kodlar: ['3D'] },
  { kod: 'faaliyetKari', kodlar: ['3DF'] },
  { kod: 'netKar', kodlar: ['3L', '3J', '2OCF'] },
  { kod: 'amortisman', kodlar: ['4B'] },
  { kod: 'faaliyetNakitAkisi', kodlar: ['4C'] },
  { kod: 'serbestNakitAkisi', kodlar: ['4CB'] },
  { kod: 'donenVarliklar', kodlar: ['1A'] },
  { kod: 'duranVarliklar', kodlar: ['1AK'] },
  { kod: 'nakitVeBenzeri', kodlar: ['1AA'] },
  { kod: 'kisaVadeliYatirimlar', kodlar: ['1AB'] },
  { kod: 'stoklar', kodlar: ['1AF'] },
  { kod: 'kisaVadeliYukumlulukler', kodlar: ['2A'] },
  { kod: 'kisaVadeliFinansalBorc', kodlar: ['2AA'] },
  { kod: 'uzunVadeliFinansalBorc', kodlar: ['2BA'] },
  { kod: 'ozkaynak', kodlar: ['2N'] },
]);

/**
 * US tablosu — us-gaap etiket listeleri web ikizinin `secFetchModel`
 * cagrilarindan (app.js:6646-6700) BIREBIR alindi.
 *
 * `tur` ONEMLI: `akis` kalemi DONEMSEL (gelir tablosu / nakit akisi),
 * yillik pencereye suzuluyor; `anlik` kalemi BILANCO kalemi, suresi yok
 * (`start` tasimiyor). Ikisini ayni suzgecten gecirmek bilancoyu BOS
 * dondururdu.
 *
 * ETIKETLERIN TAMAMI DENENIYOR, ilki degil: sirket etiket degistirince
 * eski etiket hala eski/mukerrer veri dondurebiliyor (web ikizinin
 * olculmus NVDA tuzagi, app.js:6554). En GUNCEL bitise sahip seri
 * kazaniyor.
 *
 * SORULMAYAN KOD: `serbestNakitAkisi` web ikizinde nakit akisi eksi
 * yatirim harcamasiyla tureiliyor — CIKARMA bir HESAP, burada
 * yapilmiyor ve kod US cevabina GIRMIYOR (iki bileseni ayri ayri
 * taşınıyor). `duranVarliklar` da ayni sebeple yok: `Assets -
 * AssetsCurrent` farki.
 */
export const US_KALEM = Object.freeze([
  { kod: 'gelir', tur: 'akis', etiketler: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'] },
  { kod: 'brutKar', tur: 'akis', etiketler: ['GrossProfit'] },
  { kod: 'faaliyetKari', tur: 'akis', etiketler: ['OperatingIncomeLoss'] },
  { kod: 'netKar', tur: 'akis', etiketler: ['NetIncomeLoss'] },
  { kod: 'amortisman', tur: 'akis', etiketler: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization'] },
  { kod: 'faaliyetNakitAkisi', tur: 'akis', etiketler: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'] },
  { kod: 'yatirimHarcamasi', tur: 'akis', etiketler: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] },
  { kod: 'donenVarliklar', tur: 'anlik', etiketler: ['AssetsCurrent'] },
  { kod: 'toplamVarliklar', tur: 'anlik', etiketler: ['Assets'] },
  { kod: 'nakitVeBenzeri', tur: 'anlik', etiketler: ['CashAndCashEquivalentsAtCarryingValue'] },
  { kod: 'kisaVadeliYatirimlar', tur: 'anlik', etiketler: ['ShortTermInvestments', 'MarketableSecuritiesCurrent'] },
  { kod: 'stoklar', tur: 'anlik', etiketler: ['InventoryNet'] },
  { kod: 'kisaVadeliYukumlulukler', tur: 'anlik', etiketler: ['LiabilitiesCurrent'] },
  { kod: 'toplamYukumlulukler', tur: 'anlik', etiketler: ['Liabilities'] },
  { kod: 'kisaVadeliFinansalBorc', tur: 'anlik', etiketler: ['LongTermDebtCurrent', 'DebtCurrent'] },
  { kod: 'uzunVadeliFinansalBorc', tur: 'anlik', etiketler: ['LongTermDebtNoncurrent', 'LongTermDebt'] },
  { kod: 'ozkaynak', tur: 'anlik', etiketler: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'] },
]);

// UST ISTEK TAVANI — 1 sembol->CIK tablosu + US_KALEM'in TUM etiketleri.
// Sayilmis, tahmin DEGIL: tablo tek istek, her etiket tek istek.
export const AZAMI_UST_ISTEK = 1 + US_KALEM.reduce((t, k) => t + k.etiketler.length, 0);

/** Sayac kabi — api/_iceriden.js:136 ile AYNI alanlar. `yok` 404 demek,
 *  yani VERI CEVABI ("sirket bu etiketi kullanmiyor"); `hata`/
 *  `zamanAsimi` ise "olcemedim". */
export function bosMaliSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, yok: 0, bayt: 0 };
}

/** Sayac "tam" mi. 404 (`yok`) tamligi BOZMAZ: SEC'te bir etiketin
 *  olmamasi OLAGAN (her sirket her us-gaap kalemini raporlamiyor). */
export function maliTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Kisa onbellek — api/_iceriden.js:147 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/** CORS + OPTIONS + yontem kapisi — api/_iceriden.js:152 ile AYNI govde. */
function kapi(req, res, yontemler) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', yontemler);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  const izinli = yontemler.split(',').map((s) => s.trim());
  if (!izinli.includes(req.method)) {
    res.setHeader('Allow', yontemler);
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return true;
  }
  return false;
}

/** Adres KENDI izin listemizde mi (https + izinli konak). SAF. */
export function izinliAdres(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

/** Sembol + pazar kapisi — api/_iceriden.js:179 ile AYNI govde.
 *  Sembol BUYUTULUYOR: iki ust kaynak da buyuk harf anahtar
 *  kullaniyor (web ikizi de `symbol.toUpperCase()`). SAF. */
export function ayristirIstek(hamSembol, hamPazar) {
  const s = String(hamSembol ?? '').trim();
  if (!s) return { istek: null, hata: 'sembol_yok' };
  if (!SEMBOL_BICIM.test(s)) return { istek: null, hata: 'bad_sembol', gelen: s };
  const p = String(hamPazar ?? 'US').trim().toUpperCase();
  if (!PAZARLAR.includes(p)) return { istek: null, hata: 'bad_pazar', gelen: p };
  return { istek: { sembol: s.toUpperCase(), pazar: p }, hata: null };
}

// ---------------------------------------------------------------------
//  ADRESLER — web ikizinin KULLANDIGI adreslerle birebir. Hepsi SAF:
//  aga cikmaz, agsiz sinanabilir.
// ---------------------------------------------------------------------

/** Sembol->CIK tablosu (app.js:6545 ile ayni adres). */
export function tabloAdresi() {
  return 'https://www.sec.gov/files/company_tickers.json';
}

/** Tek us-gaap kavrami (app.js:6558). `cik` 10 haneli SIFIR DOLGULU. */
export function kavramAdresi(cik, etiket) {
  return `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${etiket}.json`;
}

/** Is Yatirim MaliTablo adresi (app.js:6246-6248 ile birebir sorgu).
 *  `y1` en guncel donem yili; geriye dort yil isteniyor. */
export function isTabloAdresi(sembol, y1) {
  const taban = 'https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website'
    + '/Common/Data.aspx/MaliTablo';
  return `${taban}?companyCode=${encodeURIComponent(sembol)}&exchange=TRY`
    + `&financialGroup=${FINANSAL_GRUP}`
    + `&year1=${y1}&period1=12&year2=${y1 - 1}&period2=12`
    + `&year3=${y1 - 2}&period3=12&year4=${y1 - 3}&period4=12`;
}

/** Kullanicinin KENDI gozuyle bakacagi SEC sayfasi (app.js:5248 ile
 *  ayni kalip). Govdede TASINIYOR ki istemci adres kurmasin. */
export function secSayfaAdresi(cikInt) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}`
    + '&type=10-K&dateb=&owner=include&count=40';
}

/** Kullanicinin KENDI gozuyle bakacagi Is Yatirim sayfasi. */
export function isSayfaAdresi(sembol) {
  return 'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/'
    + `sirket-karti.aspx?hisse=${encodeURIComponent(sembol)}`;
}

// ---------------------------------------------------------------------
//  AYRISTIRICILAR — hepsi SAF.
// ---------------------------------------------------------------------

/** Metin -> sayi. Web ikizinin `num()`u (app.js:6263) ile BIREBIR:
 *  binlik virgulu atiliyor, bos/NaN `null` donuyor. ASLA `0` degil. */
export function sayiCoz(s) {
  if (s === null || s === undefined || s === '') return null;
  const v = parseFloat(String(s).replace(/,/g, ''));
  return Number.isFinite(v) ? v : null;
}

/** Is Yatirim govdesi -> `{ satirlar }`. Web ikizinin kabul kosulu
 *  (app.js:6254-6256) ile BIREBIR: `ok` bayragi + dolu `value`
 *  dizisi + en az bir dolu `value1`. SAF. */
export function ayristirIsTablo(metin) {
  let j;
  try { j = JSON.parse(String(metin ?? '')); } catch { return null; }
  if (!j || !j.ok || !Array.isArray(j.value) || !j.value.length) return null;
  const doluMu = j.value.some((it) => it && it.value1 !== null && it.value1 !== undefined
    && it.value1 !== '' && it.value1 !== '0');
  if (!doluMu) return null;
  return { satirlar: j.value };
}

/** Is Yatirim satirlari -> `itemCode` -> dort donem dizisi. SAF. */
export function isHarita(satirlar) {
  const m = Object.create(null);
  for (const it of satirlar || []) {
    if (!it || !it.itemCode) continue;
    m[String(it.itemCode)] = [
      sayiCoz(it.value1), sayiCoz(it.value2), sayiCoz(it.value3), sayiCoz(it.value4),
    ];
  }
  return m;
}

/** BIST kalemlerini kur. SIRALI YEDEK: ilk DOLU `itemCode` kazaniyor
 *  (web ikizinin `3L -> 3J -> 2OCF` zinciri bu kuralin ta kendisi).
 *  Hicbiri dolu degilse degerler `null` kaliyor — `0` DEGIL. SAF. */
export function bistKalemleri(harita, donemSayisi = DONEM_SAYISI) {
  const bos = () => Array.from({ length: donemSayisi }, () => null);
  return BIST_KALEM.map(({ kod, kodlar }) => {
    for (const ik of kodlar) {
      const dizi = harita[ik];
      if (dizi && dizi.some((v) => v !== null)) {
        return { kod, degerler: dizi.slice(0, donemSayisi), kaynakEtiket: ik };
      }
    }
    return { kod, degerler: bos(), kaynakEtiket: null };
  });
}

/** SEC `companyconcept` govdesi -> `{ birim, kayitlar }`. Birim
 *  SECILMIYOR, OKUNUYOR: web ikizi de `units.USD` yoksa ilk birimi
 *  aliyor (app.js:6563). SAF. */
export function ayristirKavram(metin) {
  let j;
  try { j = JSON.parse(String(metin ?? '')); } catch { return null; }
  if (!j || !j.units || typeof j.units !== 'object') return null;
  const birim = Object.prototype.hasOwnProperty.call(j.units, 'USD')
    ? 'USD'
    : Object.keys(j.units)[0] ?? null;
  const kayitlar = birim ? j.units[birim] : null;
  if (!Array.isArray(kayitlar) || !kayitlar.length) return null;
  return { birim, kayitlar };
}

/** Kayitin bitis damgasi (ms). Bozuk tarih `NaN` donuyor. SAF. */
function bitisMs(e) {
  const t = new Date(String(e && e.end)).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Ayni takvim ayina dusen mukerrer kayitlari ele, en guncel once.
 *  Web ikizinin `secDedupeDesc`i (app.js:6579) ile AYNI kural. SAF. */
export function tekilAzalan(kayitlar) {
  const havuz = (kayitlar || []).filter((e) => Number.isFinite(bitisMs(e)));
  havuz.sort((a, b) => bitisMs(b) - bitisMs(a));
  const gorulen = new Set();
  const out = [];
  for (const e of havuz) {
    const k = String(e.end).slice(0, 7);
    if (gorulen.has(k)) continue;
    gorulen.add(k);
    out.push(e);
  }
  return out;
}

/** Yillik DONEMSEL seri (gelir tablosu / nakit akisi). Web ikizinin
 *  `secAnnualSeries`i (app.js:6588) ile AYNI: 340-380 gunluk pencere,
 *  10-K tercihli, en guncel once. SAF. */
export function yillikSeri(kayitlar) {
  const yillik = (kayitlar || []).filter((e) => {
    if (!e || !e.start || !e.end) return false;
    const g = (new Date(e.end) - new Date(e.start)) / 86400000;
    return g >= YIL_ASGARI_GUN && g <= YIL_AZAMI_GUN;
  });
  const tenK = yillik.filter((e) => e.form === '10-K');
  return tekilAzalan(tenK.length ? tenK : yillik);
}

/** Yillik ANLIK seri (bilanco kalemi). Web ikizinin `secBsSeries`i
 *  (app.js:6595): 10-K tercihli, en guncel once. SAF. */
export function anlikSeri(kayitlar) {
  const tenK = (kayitlar || []).filter((e) => e && e.form === '10-K');
  return tekilAzalan(tenK.length ? tenK : (kayitlar || []));
}

/** Eksen: dort donem bitis tarihi (`YYYY-MM-DD`), en guncel once. SAF. */
export function eksenKur(seri, donemSayisi = DONEM_SAYISI) {
  return (seri || []).slice(0, donemSayisi).map((e) => String(e.end));
}

/**
 * Seriyi eksene hizala. HESAP DEGIL, ESLEME: eksendeki doneme
 * `ESLEME_TOLERANS_GUN` icinde dusen EN YAKIN kaydin degeri aliniyor,
 * uzakta kalan donem `null` (uydurma hizalama yok). SAF.
 */
export function hizala(seri, donemler, tolerans = ESLEME_TOLERANS_GUN) {
  const tolMs = tolerans * 86400000;
  return (donemler || []).map((d) => {
    const hedef = new Date(String(d)).getTime();
    if (!Number.isFinite(hedef)) return null;
    let en = null;
    let enFark = Infinity;
    for (const e of seri || []) {
      const t = bitisMs(e);
      if (!Number.isFinite(t)) continue;
      const fark = Math.abs(t - hedef);
      if (fark <= tolMs && fark < enFark) { enFark = fark; en = e; }
    }
    if (!en) return null;
    const v = Number(en.val);
    return Number.isFinite(v) ? v : null;
  });
}

// ---------------------------------------------------------------------
//  AGA CIKAN TEK YER. Zaman asimi AbortController ile.
//  TEKRAR YOK: basarisiz istegi hemen tekrarlamak SEC'te 429'u
//  buyutur. 404 `yok` sayacina gidiyor, `hata`ya DEGIL — SEC'te bir
//  us-gaap etiketinin olmamasi OLAGAN.
// ---------------------------------------------------------------------
async function cek(adres, sec = {}) {
  const sayac = sec.sayac || bosMaliSayac();
  if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
  const sure = sec.sure || MALI_KAVRAM_MS;
  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), sure);
  sayac.istek++;
  try {
    const konak = new URL(adres).hostname;
    // UA SECIMI OLCULMUS (api/proxy.js:170): `sec.gov` uclari UA icinde
    // e-posta bicimli im ARIYOR, otekiler istemiyor. Degistirmeden
    // once YENIDEN OLC.
    const ua = /(^|\.)sec\.gov$/i.test(konak)
      ? UA_SEC
      : 'day-starter/1.0 (mali-tablo-okuyucu)';
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: { 'User-Agent': ua, 'Accept': 'application/json, text/plain, */*;q=0.5' },
    });
    clearTimeout(zamanlayici);
    // 404 = VERI CEVABI ("sirket bu etiketi kullanmiyor"), kesinti DEGIL.
    if (r.status === 404) { sayac.yok++; return null; }
    if (!r.ok) { sayac.hata++; return null; }
    const metin = await r.text();
    const bayt = Buffer.byteLength(metin, 'utf8');
    sayac.bayt += bayt;
    // 200 ama govde kisa = olcum degil, ariza.
    if (bayt < ASGARI_GOVDE_BAYT) { sayac.kisa++; return null; }
    sayac.basari++;
    return metin;
  } catch (e) {
    clearTimeout(zamanlayici);
    if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) sayac.zamanAsimi++;
    else sayac.hata++;
    return null;
  }
}

// Sembol->CIK tablosu modul duzeyinde ISINIYOR (api/_iceriden.js:519
// ile AYNI fikir). Govde megabayt olcegi oldugu icin ayrica KV'ye
// SEMBOL BASINA yaziliyor: ikinci istek tabloyu HIC indirmiyor.
let cikHaritasi = null;

/** Tablo govdesinden sembol->CIK haritasi kur. SAF. */
export function ayristirCikTablosu(metin) {
  let obj;
  try { obj = JSON.parse(String(metin ?? '')); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const harita = Object.create(null);
  for (const e of Object.values(obj)) {
    if (e && e.ticker) harita[String(e.ticker).toUpperCase()] = String(e.cik_str).padStart(10, '0');
  }
  return Object.keys(harita).length ? harita : null;
}

/** `undefined` = olcemedim · `null` = tabloda yok · dizgi = CIK. */
async function cikBul(sembol, sayac) {
  const obAnahtar = anahtar('mali-cik', { sembol });
  const vurus = await oku(obAnahtar);
  if (vurus && Object.prototype.hasOwnProperty.call(vurus, 'cik')) return vurus.cik;

  if (!cikHaritasi) {
    const metin = await cek(tabloAdresi(), { sayac, sure: MALI_TABLO_MS });
    if (!metin) return undefined;
    cikHaritasi = ayristirCikTablosu(metin);
    if (!cikHaritasi) return undefined;
  }
  const cik = cikHaritasi[sembol] ?? null;
  await yaz(obAnahtar, { cik }, TTL_TEMA);
  return cik;
}

/**
 * US_KALEM'in TUM etiketlerini partiler halinde cek ve her kalem icin
 * EN GUNCEL bitise sahip seriyi sec (NVDA tuzagi, app.js:6554).
 * Donen dizi US_KALEM ile AYNI SIRADA; olculemeyen kalem `null`.
 */
async function kavramlariCek(cik, sayac) {
  const isler = [];
  US_KALEM.forEach((k, i) => { for (const et of k.etiketler) isler.push({ i, et }); });

  const secim = US_KALEM.map(() => null);
  for (let a = 0; a < isler.length; a += ES_ZAMANLI_KAVRAM) {
    const kume = isler.slice(a, a + ES_ZAMANLI_KAVRAM);
    const cevaplar = await Promise.all(kume.map(async (is, j) => {
      // SEC'in 10 istek/sn kurali: parti ICINDE de araliklaniyor.
      if (j) await bekle(SEC_ARALIK_MS * j);
      const metin = await cek(kavramAdresi(cik, is.et), { sayac, sure: MALI_KAVRAM_MS });
      return { is, coz: metin ? ayristirKavram(metin) : null };
    }));
    for (const c of cevaplar) {
      if (!c.coz) continue;
      const tanim = US_KALEM[c.is.i];
      const seri = tanim.tur === 'akis' ? yillikSeri(c.coz.kayitlar) : anlikSeri(c.coz.kayitlar);
      if (!seri.length) continue;
      const son = bitisMs(seri[0]);
      if (!Number.isFinite(son)) continue;
      const simdiki = secim[c.is.i];
      if (!simdiki || son > simdiki.son) {
        secim[c.is.i] = { seri, son, etiket: c.is.et, birim: c.coz.birim };
      }
    }
  }
  return secim;
}

// =====================================================================
//  /api/mali  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/mali?sembol=AAPL&pazar=US
//    GET /api/mali?sembol=THYAO&pazar=BIST
//    200 -> { pazar, sembol, cik?, durumKodu, donemTuru:'yillik',
//             donemIstenen, donemler[], birim, kalemler[], kaynakAdres,
//             sayac, tam, ms, uyari }
//    400 -> sembol_yok | bad_sembol (`bicim`) | bad_pazar (`pazarlar`)
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> mali_alinamadi (ust kaynak okunamadi)
//
//  `kalemler` ogesi: { kod, degerler[], kaynakEtiket }
//    · `kod`           KALEM_KODLARI kapali kumesinden; Turkcesi
//                      `mobile/src/lib/sozluk.ts`te secilir
//    · `degerler`      `donemler` ile AYNI SIRADA; olculemeyen `null`
//    · `kaynakEtiket`  hangi `itemCode` / us-gaap etiketi okundu
//                      (seffaflik; istemci bunu HESABA sokmuyor)
//
//  DURUM KODLARI (Turkcesi `sozluk.ts`'de):
//    'ok'         -> olculdu, tasinan kalem var
//    'kayit_yok'  -> sembolun SEC kaydi yok (ETF / yabanci ozel sirket)
//    'tablo_yok'  -> kaynak cevap verdi ama mali tablo donemi cikmadi
//    'kalem_yok'  -> donem bulundu ama hicbir kalem olculemedi
//
//  `durumKodu` ARIZA DEGIL: ust kaynak okunamadiginda 502 donuyor,
//  bu dort kod VERI CEVABI.
export async function maliHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const { istek, hata, gelen } = ayristirIstek(q.sembol ?? q.symbol, q.pazar ?? q.market);
  if (!istek) {
    // Dogrulama onbellek anahtarindan ONCE donuyor: bozuk istek KV'ye
    // dokunmuyor (api/_iceriden.js ile AYNI sira).
    kisaOnbellek(res);
    const govde = { error: hata, uyari: UYARI };
    if (gelen !== undefined) govde.gelen = gelen;
    if (hata === 'bad_sembol') govde.bicim = String(SEMBOL_BICIM);
    if (hata === 'bad_pazar') govde.pazarlar = PAZARLAR;
    res.status(400).json(govde);
    return;
  }

  const t0 = Date.now();
  const obAnahtar = anahtar('mali', istek);
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control',
      `public, max-age=${TTL_MALI}, s-maxage=${TTL_MALI}, stale-while-revalidate=600`);
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    const sayac = bosMaliSayac();
    const govde = istek.pazar === 'US'
      ? await amerika(istek.sembol, sayac)
      : await borsaIstanbul(istek.sembol, sayac);

    if (!govde) {
      kisaOnbellek(res);
      res.status(502).json({ error: 'mali_alinamadi', ...istek, sayac, uyari: UYARI });
      return;
    }

    const cevap = {
      ...istek, donemTuru: 'yillik', donemIstenen: DONEM_SAYISI, ...govde,
      sayac, tam: maliTam(sayac), uyari: UYARI,
    };
    // YALNIZ `tam` govde onbellege yaziliyor (iceriden/kur/takvim yolu
    // ile AYNI kural): yarim olcum 6 saat servis edilmesin.
    if (cevap.tam) await yaz(obAnahtar, cevap, TTL_MALI);
    res.setHeader('Cache-Control',
      `public, max-age=${TTL_MALI}, s-maxage=${TTL_MALI}, stale-while-revalidate=600`);
    res.status(200).json({ ...cevap, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_mali:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'mali_alinamadi', uyari: UYARI });
  }
}

/** ABD yolu — SEC XBRL. `null` = kesinti (cagiran 502 basar). */
async function amerika(sembol, sayac) {
  const cik = await cikBul(sembol, sayac);
  if (cik === undefined) return null; // olcemedim
  if (!cik) {
    // Web ikizinin "SEC kaydi yok" hali: ETF ya da yabanci ozel sirket
    // olabilir. Turkcesi `sozluk.ts`'de.
    return {
      cik: null, durumKodu: 'kayit_yok', donemler: [], birim: null,
      kalemler: [], kaynakAdres: null,
    };
  }
  const cikInt = String(parseInt(cik, 10));
  const kaynakAdres = secSayfaAdresi(cikInt);

  const secim = await kavramlariCek(cik, sayac);
  if (secim.every((s) => s === null)) {
    // Hicbir kavram OKUNAMADI. Sayac ariza mi diyor, yoksa sirket bu
    // etiketleri hic kullanmiyor mu — ikisi AYRI: ariza varsa 502,
    // yoksa veri cevabi.
    if (!maliTam(sayac)) return null;
    return { cik, durumKodu: 'tablo_yok', donemler: [], birim: null, kalemler: [], kaynakAdres };
  }

  // EKSEN: once bir `akis` kalemi (gelir tablosu donemi mali yili
  // tanimlar), yoksa eldeki ilk seri. Eksen SECILIYOR, uretilmiyor —
  // uydurma donem etiketi YOK.
  const akisDizin = US_KALEM.findIndex((k, i) => k.tur === 'akis' && secim[i]);
  const eksenDizin = akisDizin >= 0 ? akisDizin : secim.findIndex((s) => s);
  const donemler = eksenKur(secim[eksenDizin].seri);
  if (!donemler.length) {
    return { cik, durumKodu: 'tablo_yok', donemler: [], birim: null, kalemler: [], kaynakAdres };
  }

  const birim = secim[eksenDizin].birim;
  const kalemler = US_KALEM.map((tanim, i) => {
    const s = secim[i];
    return {
      kod: tanim.kod,
      degerler: s ? hizala(s.seri, donemler) : donemler.map(() => null),
      kaynakEtiket: s ? s.etiket : null,
    };
  });
  const olculen = kalemler.some((k) => k.degerler.some((v) => v !== null));

  return {
    cik,
    durumKodu: olculen ? 'ok' : 'kalem_yok',
    donemler,
    birim,
    kalemler,
    kaynakAdres,
  };
}

/** BIST yolu — Is Yatirim MaliTablo. `null` = kesinti (cagiran 502).
 *  Web ikizi en guncel TAM yildan geriye UC yil deniyor
 *  (app.js:6250); ilk DOLU cevap kazaniyor. */
async function borsaIstanbul(sembol, sayac) {
  const kaynakAdres = isSayfaAdresi(sembol);
  const nowY = new Date().getFullYear();
  const adaylar = [nowY - 1, nowY - 2, nowY].slice(0, IS_YIL_DENEME);

  let tablo = null;
  let y1 = null;
  let cevapGeldi = false;
  for (const y of adaylar) {
    const metin = await cek(isTabloAdresi(sembol, y), { sayac, sure: MALI_TABLO_MS });
    if (!metin) continue;
    cevapGeldi = true;
    const coz = ayristirIsTablo(metin);
    if (coz) { tablo = coz; y1 = y; break; }
  }

  if (!tablo) {
    // Hic cevap alinamadiysa bu bir KESINTI (502). Cevap geldi ama
    // donem cikmadiysa VERI CEVABI: sirketin bu grupta yillik tablosu
    // yok (yeni halka arz, farkli finansal grup).
    if (!cevapGeldi) return null;
    return {
      durumKodu: 'tablo_yok', donemler: [], birim: 'TRY',
      kalemler: [], kaynakAdres,
    };
  }

  const donemler = [y1, y1 - 1, y1 - 2, y1 - 3].slice(0, DONEM_SAYISI).map(String);
  const kalemler = bistKalemleri(isHarita(tablo.satirlar));
  const olculen = kalemler.some((k) => k.degerler.some((v) => v !== null));

  return {
    durumKodu: olculen ? 'ok' : 'kalem_yok',
    donemler,
    // PARA BIRIMI CEVRILMIYOR: sorgu `exchange=TRY` ile atiliyor, yani
    // tablo TL. Carpan uygulanmiyor.
    birim: 'TRY',
    kalemler,
    kaynakAdres,
  };
}

export const ROTA = 'mali';
export const HANDLERLAR = Object.freeze({ mali: maliHandler });
