// =====================================================================
//  api/_iceriden.js — ICERIDEN ISLEMLER TASIYICISI  (/api/iceriden)
// =====================================================================
//  NIYE `_` ONEKLI: Vercel Hobby tavani deploy basina 12 serverless
//  fonksiyon ve `api/*.js` uc dosyasi sayisi SU AN TAM 12 (karar 1A).
//  `_` onekli dosya rotaya cevrilmez, SAYILMAZ; yol vercel.json
//  rewrite'i ile /api/proxy?__rota=iceriden'e biniyor. Kalibin ikizi:
//  api/_kur.js.
//
//  NIYE VAR: web ikizi bu paneli TARAYICIDA kuruyor (app.js:5127-5300,
//  `fillInsider` / `insiderUS` / `insiderBIST` / `parseForm4`) ve
//  Form 4 XML'ini `new DOMParser()` ile ayristiriyor. Native istemcide
//  bu yuzeyin KARSILIGI HIC YOK ve DOMParser Node'da da YOK; ustelik
//  ayristirmayi ISTEMCIYE kurmak §5.1'in yasakladigi sey olurdu.
//  Bu yuzden hem SEC Form 4 ayristirmasi hem KAP suzmesi UCTA.
//
//  SKORA DAHIL DEGIL — DEGISMEYEN KURAL: web ikizinin basligi
//  "Iceriden islemler (bilgi paneli — TEMEL SKORA DAHIL DEGIL)" ve
//  kullanici tercihi (2026-08-15) "yalniz bilgi, skoru etkilemez".
//  Bu uc motora DOKUNMUYOR: `buildMotor` kurmuyor, motor imzasi
//  onbellek anahtarinda YOK, skor girdisi uretmiyor.
//
//  HAM SAYI KURALI (§5.1): yalniz sayi ve MAKINE KODU. Web ikizinin
//  Turkce hukum cumleleri BU DOSYAYA GECMEDI — 'net ALIM',
//  'net SATIM', 'net alim agirlikli', 'net satim agirlikli',
//  'dengeli', RSU/vergi aciklamasi, "Bu sembol icin SEC kaydi yok"
//  cumlesi hepsi ekran isi. Burada `yonKod` / `durumKodu` /
//  `iliskiKodlari` makine kodlari var; Turkcesi
//  `mobile/src/lib/sozluk.ts`'de cozuluyor. Esik / agirlik / renk /
//  tavsiye cumlesi YOK.
//
//  BIRIM — ALAN ADINDA YAZILI:
//    `...Adet`  -> PAY ADEDI (adet, para degil)
//    `...Tutar` -> ISLEMIN PARA TUTARI, ust kaynagin kendi biriminde
//      (SEC Form 4 ABD dolari basiyor; cevrim YOK). adet × birim fiyat
//      carpimi ust kaynagin iki ayri alanindan geliyor, web ikizinin
//      `sh * px` carpimiyla BIREBIR (app.js:5186).
//    `tarih`    -> ust kaynagin KENDI dizgesi (`filingDate`,
//      `pubDate`), OLDUGU GIBI; bicimi sozlesmeli degil.
//  Olculemeyen alan `null`, ASLA `0`: `alisTutar: 0` = "alim yok"
//  olcumu, `null` = "ust kaynak o alani vermedi".
// ---------------------------------------------------------------------
import { setTimeout as bekle } from 'node:timers/promises';
import { anahtar, oku, yaz, TTL_TEMA } from './_onbellek.js';
// SEC kimlik dizgesi ve istek araligi TEK KAYNAKTAN: `api/_ag.js`
// icindeki olculmus degismezler. Dorduncu bir kopya yazilmadi —
// `www.sec.gov` WAF'i UA icinde E-POSTA BICIMLI im ARIYOR ve bu
// 2026-10-24'te canli olculdu (gerekcenin tamami api/proxy.js:170).
// `_ag.js` baska hicbir seyi ice aktarmiyor (yalniz node:timers), yani
// bu import motoru pakete SOKMUYOR.
import { UA_SEC, SEC_ARALIK_MS } from './_ag.js';

// Uyari metni — api/_kur.js:36 ve on ucun daha AYNI degismezi.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Izin listesi KENDI dosyamda: proxy'nin `IZINLI_KONAKLAR` kumesi duz
// role kapisi, bu tasiyici oradan GECMIYOR (fetch'i kendisi yapiyor).
// Dordu de proxy'nin listesinde ZATEN var (api/proxy.js:90-94), yani
// bu uc yeni bir konak ACMIYOR.
export const IZINLI_KONAK = [
  'www.sec.gov',
  'data.sec.gov',
  'www.kap.org.tr',
  'news.google.com',
];

// Zaman asimlari — web ikizinin OLCULMUS sayilari (app.js:5205,5216,
// 5262): sembol->CIK tablosu buyuk govde oldugu icin 15 sn, tek Form 4
// belgesi 10 sn, RSS beslemeleri 10 sn.
export const ICERIDEN_TABLO_MS = 15000;
export const ICERIDEN_BELGE_MS = 10000;
export const ICERIDEN_RSS_MS = 10000;

// Kisa govde = ariza. En kucuk gecerli govde (bos RSS kanali bile)
// yuzlerce bayt.
export const ASGARI_GOVDE_BAYT = 128;

// SEMBOL BICIMI — web ikizi sembolu dogrudan adrese koyuyor; burada
// kapidan geciyor. BIST sembolleri harf, ABD sembolleri nokta/tire
// tasiyabiliyor (`BRK.B`, `RDS-A`).
export const SEMBOL_BICIM = /^[A-Za-z][A-Za-z0-9.\-]{0,11}$/;

// PAZAR KUMESI — web ikizi `market === 'US' ? insiderUS : insiderBIST`
// (app.js:5160). Ucuncu bir deger YOK; tanimsiz pazar 400 aliyor.
export const PAZARLAR = ['US', 'BIST'];

// PENCERE — web ikizi `Date.now() - 90 * 86400000` (app.js:5209).
export const PENCERE_GUN = 90;

// BELGE TAVANI — web ikizi `while (picks.length < 12)` (app.js:5211).
// ISTEK TAVANI yani: 1 tablo + 1 ozet + en cok 12 belge = 14.
export const AZAMI_BELGE = 12;
export const AZAMI_UST_ISTEK = 14;

// ES ZAMANLI BELGE — web ikizi `secBatches(..., 6)` (app.js:5218).
// Istekler ayrica `SEC_ARALIK_MS` ile araliklaniyor (SEC'in 10 istek/sn
// kurali); _ag.js'teki AYNI sayi, yeniden tanimlanmadi.
export const ES_ZAMANLI_BELGE = 6;

// EKRANA GIDEN SATIR TAVANI — web ikizi `.slice(0, 8)` (app.js:5241 ve
// 5293). SESSIZ KIRPMA YOK: kirpilan sayi `bildirimSayisi` ile
// `kayitlar.length` farkindan OKUNABILIYOR, ikisi de govdede.
export const AZAMI_SATIR = 8;

// KAP maddesi tavani — `fetchRSS(url, 10)` (app.js:5262).
export const AZAMI_MADDE = 10;

// KAP BESLEMESI — api/poll.js:KAP_RSS ile AYNI adres.
export const KAP_RSS = 'https://www.kap.org.tr/tr/api/disclosures/rss';

// YEDEGE DUSME ESIGI — web ikizi `if (items.length < 3)` ile Google
// News'e dusuyor (app.js:5259). Esik DEGIL, DALLANMA: skor/agirlik
// uretmiyor, yalniz "yeterince KAP maddesi bulunamadi" olcumu.
export const KAP_YEDEK_ESIGI = 3;

// ICERIDEN ISLEM ANAHTAR KELIMELERI — web ikizi `INSIDER_KW`
// (app.js:5131) ile BIREBIR, SIRASI DA AYNI. Noktali/noktasiz ikili
// yazimlar (İKTİSAP / IKTISAP) ust kaynagin karisik imlasi icin;
// `toUpperCase()` yerel-bagimsiz calistigi icin ikisi de gerekli.
export const ICERIDEN_KELIMELER = [
  'PAY ALIM', 'PAY SATIŞ', 'PAY SATIS', 'GERİ ALIM', 'GERI ALIM',
  'PAYLARIN', 'PAY GERİ', 'İKTİSAP', 'IKTISAP', 'ELDEN ÇIKAR',
  'ELDEN CIKAR', 'ORTAKLIK PAY', 'YÖNETİCİ', 'YONETICI',
];

// Onbellek omru — bildirimler gun icinde seyrek degisiyor; 30 dakika.
// `_onbellek.js:TTL_FIYAT` (300) bu uc icin GEREKSIZ SIK, `TTL_TEMA`
// (86400) ise COK UZUN olurdu. Asagida yayinlanan `max-age` ile AYNI
// sayi. Sembol->CIK esleme tablosu AYRI ve UZUN omurlu (`TTL_TEMA`):
// bir sirketin CIK'i degismiyor ve tablo govdesi megabayt olcegi.
export const TTL_ICERIDEN = 1800;

/** Sayac kabi — api/_kur.js:75 ile AYNI alanlar + `yok`. `yok` 404
 *  demek, yani VERI CEVABI ("boyle bir belge yok"); `hata`/`kesinti`
 *  ise "olcemedim". Ikisi api/_ag.js:bosSayac() ile AYNI ayrim. */
export function bosIceridenSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, yok: 0, bayt: 0 };
}

/** Sayac "tam" mi. 404 (`yok`) tamligi BOZMAZ: cevap alinmistir. */
export function iceridenTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Kisa onbellek — api/_kur.js:86 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/** CORS + OPTIONS + yontem kapisi — api/_kur.js:93 ile AYNI govde. */
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

/** Sembol + pazar kapisi. Gecersizde `null` doner (cagiran 400 basar).
 *  Sembol BUYUTULUYOR: her iki ust kaynak da buyuk harf anahtar
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
//  SEC ADRESLERI — web ikizinin KULLANDIGI adreslerle birebir.
//  Hepsi SAF: aga cikmaz, agsiz sinanabilir.
// ---------------------------------------------------------------------

/** Sembol->CIK tablosu (app.js:5205 ile ayni adres). */
export function tabloAdresi() {
  return 'https://www.sec.gov/files/company_tickers.json';
}

/** Sirket bildirim ozeti (app.js:5206). `cik` 10 haneli SIFIR DOLGULU. */
export function ozetAdresi(cik) {
  return `https://data.sec.gov/submissions/CIK${cik}.json`;
}

/** Tek Form 4 belgesi (app.js:5217). `cikInt` BAS SIFIRLARI ATILMIS
 *  hali — EDGAR arsiv yolu dolgulu CIK'i TANIMIYOR. */
export function belgeAdresi(cikInt, acc, doc) {
  return `https://www.sec.gov/Archives/edgar/data/${cikInt}/${acc}/${doc}`;
}

/** Kullanicinin kendi gozuyle bakacagi SEC sayfasi (app.js:5248).
 *  Govdede TASINIYOR ki istemci adres kurmasin. */
export function secSayfaAdresi(cikInt) {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInt}`
    + '&type=4&dateb=&owner=include&count=40';
}

/** KAP bildirim sorgu sayfasi (app.js:5297). */
export function kapSayfaAdresi() {
  return 'https://www.kap.org.tr/tr/bildirim-sorgu';
}

/** Google News yedek beslemesi — web ikizinin SORGUSU ile BIREBIR
 *  (app.js:5260). SAF. */
export function haberYedekAdresi(sembol) {
  const q = encodeURIComponent(
    sembol + ' pay alım satım geri alım yönetici ortak KAP',
  );
  return `https://news.google.com/rss/search?q=${q}&hl=tr&gl=TR&ceid=TR:tr`;
}

// ---------------------------------------------------------------------
//  FORM 4 AYRISTIRMASI — `DOMParser` YOK.
//
//  NIYE ELLE: web ikizi `new DOMParser()` kullaniyor (app.js:5171);
//  Node'da boyle bir kurucu YOK ve bu proje YENI BAGIMLILIK ALMIYOR.
//  Form 4 XML'i ad-uzayi oneki TASIMIYOR ve yapisi SIGDIR (SEC'in
//  ownershipDocument semasi), bu yuzden etiket okuma yeterli.
//  Govde bozuksa alanlar `null`/atlanir, ISTISNA FIRLATILMAZ.
// ---------------------------------------------------------------------

/** XML kacislarini coz — api/_haber.js:cozKacis ile AYNI kume. SAF. */
function cozKacis(s) {
  return String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

/** Blok icindeki ILK `<ad>` etiketinin govdesi; yoksa `''`. SAF. */
function etiket(blok, ad) {
  const m = String(blok ?? '').match(
    new RegExp(`<${ad}(?:\\s[^>]*)?>([\\s\\S]*?)</${ad}>`, 'i'),
  );
  return m ? cozKacis(m[1]) : '';
}

/** Adi verilen etiketin TAM blogu (ic etiketleriyle); yoksa `''`. SAF. */
function blok(src, ad) {
  const m = String(src ?? '').match(
    new RegExp(`<${ad}(?:\\s[^>]*)?>[\\s\\S]*?</${ad}>`, 'i'),
  );
  return m ? m[0] : '';
}

/** Form 4'un `<value>` sarmalli sayi alani. Cozulemezse `null` —
 *  `0` DEGIL. SAF. */
function sayi(blok2, ad) {
  const b = blok(blok2, ad);
  if (!b) return null;
  const ham = etiket(b, 'value');
  if (!ham) return null;
  const n = parseFloat(ham);
  return Number.isFinite(n) ? n : null;
}

/** Web ikizinin `isTrue` yardimcisi (app.js:5177) ile BIREBIR. SAF. */
function dogruMu(v) {
  const s = String(v ?? '').trim();
  return s === '1' || s.toLowerCase() === 'true';
}

/**
 * TEK Form 4 belgesini ayristir. Web ikizinin `parseForm4`
 * (app.js:5170-5200) ile AYNI okuma, AYNI toplama, AYNI "hicbir sey
 * yoksa null" karari — DOMParser yerine etiket okumasiyla.
 *
 * ILISKI TURKCESI GECMEDI: web 'Yönetim Kurulu' / 'Yönetici' /
 * '%10+ ortak' basiyor, burada `iliskiKodlari` = ['yk','yonetici',
 * 'ortak10'] makine kodlari var (§5.1). TEK ISTISNA `unvan`:
 * `officerTitle` UST KAYNAGIN KENDI METNI, cevrilecek bir kod degil,
 * bu yuzden OLDUGU GIBI tasiniyor.
 *
 * @returns {null|{tarih:string, sahip:string|null, iliskiKodlari:string[],
 *   unvan:string|null, alisAdet:number, alisTutar:number,
 *   satisAdet:number, satisTutar:number, digerAdet:number}}
 */
export function ayristirForm4(xml, tarih) {
  const metin = String(xml ?? '');
  if (!metin) return null;
  // Govde XML degilse (SEC bazen HTML hata sayfasi basiyor) olcum yok.
  if (!/<ownershipDocument|<nonDerivativeTransaction/i.test(metin)) return null;

  const sahipBlok = blok(metin, 'reportingOwner');
  const adBlok = sahipBlok ? blok(sahipBlok, 'reportingOwnerId') : '';
  const sahipAd = etiket(adBlok || sahipBlok, 'rptOwnerName')
    || etiket(metin, 'rptOwnerName');

  const iliskiBlok = sahipBlok
    ? blok(sahipBlok, 'reportingOwnerRelationship')
    : blok(metin, 'reportingOwnerRelationship');
  const iliskiKodlari = [];
  let unvan = null;
  if (iliskiBlok) {
    if (dogruMu(etiket(iliskiBlok, 'isDirector'))) iliskiKodlari.push('yk');
    if (dogruMu(etiket(iliskiBlok, 'isOfficer'))) {
      iliskiKodlari.push('yonetici');
      const u = etiket(iliskiBlok, 'officerTitle');
      if (u) unvan = u;
    }
    if (dogruMu(etiket(iliskiBlok, 'isTenPercentOwner'))) iliskiKodlari.push('ortak10');
  }

  let alisAdet = 0;
  let alisTutar = 0;
  let satisAdet = 0;
  let satisTutar = 0;
  let digerAdet = 0;

  const islemler = metin.match(
    /<nonDerivativeTransaction(?:\s[^>]*)?>[\s\S]*?<\/nonDerivativeTransaction>/gi,
  ) || [];
  for (const i of islemler) {
    const kod = etiket(blok(i, 'transactionCoding'), 'transactionCode');
    const tutarBlok = blok(i, 'transactionAmounts');
    const adet = sayi(tutarBlok, 'transactionShares');
    const birim = sayi(tutarBlok, 'transactionPricePerShare');
    // Web ikizinin AYNI dallanmasi: 'P' alim, 'S' satim, geri kalan
    // (opsiyon icrasi 'M', hisse tahsisi 'A', vergi kesintisi 'F'...)
    // ACIK PIYASA ISLEMI DEGIL, yalniz SAYILIYOR.
    if (kod === 'P') {
      if (adet != null) { alisAdet += adet; if (birim != null) alisTutar += adet * birim; }
    } else if (kod === 'S') {
      if (adet != null) { satisAdet += adet; if (birim != null) satisTutar += adet * birim; }
    } else if (adet) {
      digerAdet++;
    }
  }

  // Web ikizi ile AYNI karar: uc sayacin da bos oldugu belge TASINMIYOR
  // (app.js:5196) — "her alani 0" satiri olculmeyeni olculmus gosterir.
  if (!alisAdet && !satisAdet && !digerAdet) return null;

  return {
    tarih: String(tarih ?? '') || null,
    sahip: sahipAd || null,
    iliskiKodlari,
    unvan,
    alisAdet,
    alisTutar,
    satisAdet,
    satisTutar,
    digerAdet,
  };
}

/**
 * YON KODU — web ikizinin `dir` dallanmasi (app.js:5231) ile BIREBIR,
 * Turkcesi ATILMIS. Esik YOK: yalniz isaret karsilastirmasi.
 * Acik piyasa islemi hic yoksa `null` (durum kodu o hali tasiyor). SAF.
 */
export function yonKoduAl(t) {
  if (!t) return null;
  const { alisAdet, satisAdet, alisTutar, satisTutar } = t;
  if (!alisAdet && !satisAdet) return null;
  if (alisAdet && !satisAdet) return 'alim';
  if (satisAdet && !alisAdet) return 'satim';
  const net = alisTutar - satisTutar;
  if (net > 0) return 'alim_agirlikli';
  if (net < 0) return 'satim_agirlikli';
  return 'dengeli';
}

// ---------------------------------------------------------------------
//  RSS AYRISTIRMASI — `api/_haber.js:ayristirRSS` KULLANILMADI, cunku
//  o `description` alanini DUSURUYOR ve `type`i sabit 'NEWS' basiyor.
//  Web ikizinin sembol eslemesi (app.js:415 `kapItemsForTicker`)
//  baslik + ACIKLAMA metnini birlikte okuyor; aciklamasiz esleme
//  sembolleri KACIRIR. Bu yuzden burada kendi okumasi var.
// ---------------------------------------------------------------------

/** RSS/Atom maddelerini oku (baslik + adres + tarih + aciklama). SAF. */
export function ayristirBesleme(xml, azami = AZAMI_MADDE) {
  const metin = String(xml ?? '');
  if (!metin) return [];
  const sinir = Math.max(0, Math.min(AZAMI_MADDE, Number(azami) || 0));
  if (!sinir) return [];
  const bloklar = metin.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  const out = [];
  for (const b of bloklar) {
    const baslik = etiket(b, 'title');
    if (!baslik) continue; // baslıksız madde bildirim değildir
    let adres = etiket(b, 'link');
    if (!adres || !/^https?:/i.test(adres)) {
      const h = b.match(/<link[^>]*\shref=["']([^"']+)["']/i);
      adres = h ? cozKacis(h[1]) : '';
    }
    const tarih = etiket(b, 'pubDate') || etiket(b, 'published')
      || etiket(b, 'updated') || etiket(b, 'dc:date');
    out.push({
      baslik,
      adres: adres || null,
      tarih: tarih || null,
      aciklama: etiket(b, 'description') || etiket(b, 'summary') || '',
    });
  }
  return out;
}

/** Baslik temizligi — web ikizi `***`/`**` imlerini atiyor
 *  (app.js:5289). SAF. */
export function temizBaslik(s) {
  return String(s ?? '').replace(/\*{2,}/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Sembol + anahtar kelime suzgeci — web ikizinin `kapItemsForTicker`
 * (app.js:415) govdesi ile AYNI iki kosul: `\bSEMBOL\b` baslik ya da
 * aciklamada VAR MI, ve anahtar kelimelerden BIRI geciyor mu. SAF.
 */
export function suzIceriden(maddeler, sembol, kelimeler = ICERIDEN_KELIMELER) {
  const t = String(sembol ?? '').toUpperCase();
  if (!t) return [];
  const bicim = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}\\b`);
  const out = [];
  for (const m of maddeler || []) {
    const metin = (String(m.baslik ?? '') + ' ' + String(m.aciklama ?? '')).toUpperCase();
    if (!bicim.test(metin)) continue;
    if (kelimeler && kelimeler.length && !kelimeler.some((k) => metin.includes(k.toUpperCase()))) {
      continue;
    }
    out.push(m);
  }
  return out;
}

/** Basliga gore tekillestir + tarihe gore YENIDEN ESKIYE sirala +
 *  tavana kirp. Web ikizinin AYNI uc adimi (app.js:5265,5287). SAF. */
export function sirala(maddeler, azami = AZAMI_SATIR) {
  const gorulen = new Set();
  const tekil = [];
  for (const m of maddeler || []) {
    const b = temizBaslik(m.baslik);
    if (!b || gorulen.has(b)) continue;
    gorulen.add(b);
    tekil.push({ baslik: b, adres: m.adres ?? null, tarih: m.tarih ?? null });
  }
  return tekil
    .filter((m) => m.tarih)
    .sort((a, b) => new Date(b.tarih) - new Date(a.tarih))
    .slice(0, Math.max(0, azami));
}

// ---------------------------------------------------------------------
//  AGA CIKAN TEK YER. Zaman asimi AbortController ile.
//  TEKRAR YOK: basarisiz istegi hemen tekrarlamak SEC'te 429'u
//  buyutur (api/_ag.js'in tekrar mantigi MOTOR turu icin, bu uc o
//  butceye girmiyor). 404 `yok` sayacina gidiyor, `hata`ya DEGIL.
// ---------------------------------------------------------------------
async function cek(adres, sec = {}) {
  const sayac = sec.sayac || bosIceridenSayac();
  if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
  const sure = sec.sure || ICERIDEN_BELGE_MS;
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
      : 'day-starter/1.0 (iceriden-okuyucu)';
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        'User-Agent': ua,
        'Accept': sec.kabul || 'application/json, application/xml, text/xml, */*;q=0.5',
      },
    });
    clearTimeout(zamanlayici);
    // 404 = VERI CEVABI ("boyle bir kayit yok"), kesinti DEGIL.
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

// Sembol->CIK tablosu modul duzeyinde ISINIYOR (web ikizinin
// `secCikMap` degiskeni, app.js:5202 ile AYNI fikir). Govde megabayt
// olcegi oldugu icin ayrica KV'ye SEMBOL BASINA yaziliyor: ikinci
// istek tabloyu HIC indirmiyor.
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

async function cikBul(sembol, sayac) {
  const obAnahtar = anahtar('iceriden-cik', { sembol });
  const vurus = await oku(obAnahtar);
  // `{ cik: null }` de GECERLI bir olcum ("tabloda yok"); tabloyu her
  // istekte yeniden indirmemek icin o da onbellekte duruyor.
  if (vurus && Object.prototype.hasOwnProperty.call(vurus, 'cik')) return vurus.cik;

  if (!cikHaritasi) {
    const metin = await cek(tabloAdresi(), { sayac, sure: ICERIDEN_TABLO_MS });
    if (!metin) return undefined; // olcemedim — "yok" DEGIL
    cikHaritasi = ayristirCikTablosu(metin);
    if (!cikHaritasi) return undefined;
  }
  const cik = cikHaritasi[sembol] ?? null;
  await yaz(obAnahtar, { cik }, TTL_TEMA);
  return cik;
}

/**
 * Bildirim ozetinden pencere icindeki Form 4 belgelerini sec. Web
 * ikizinin `while (picks.length < 12)` dongusu (app.js:5208-5215) ile
 * AYNI dort kosul: form '4'/'4/A' · tarih pencerede · birincil belge
 * `xsl...` oneki ATILDIKTAN SONRA `.xml` · erisim numarasi tiresiz.
 * SAF.
 */
export function ayristirOzet(metin, simdiMs = Date.now()) {
  let obj;
  try { obj = JSON.parse(String(metin ?? '')); } catch { return null; }
  const r = obj && obj.filings && obj.filings.recent;
  if (!r || !Array.isArray(r.form)) return null;
  const sinir = simdiMs - PENCERE_GUN * 86400000;
  const out = [];
  for (let i = 0; i < r.form.length && out.length < AZAMI_BELGE; i++) {
    const form = r.form[i];
    if (form !== '4' && form !== '4/A') continue;
    const tarih = r.filingDate ? r.filingDate[i] : null;
    if (!tarih || new Date(tarih).getTime() < sinir) continue;
    const ham = r.primaryDocument ? r.primaryDocument[i] : '';
    const doc = String(ham ?? '').replace(/^xsl[^/]*\//i, '');
    if (!/\.xml$/i.test(doc)) continue;
    const acc = String(r.accessionNumber ? r.accessionNumber[i] : '').replace(/-/g, '');
    if (!acc) continue;
    out.push({ tarih, acc, doc });
  }
  return out;
}

/** Belgeleri ES_ZAMANLI_BELGE'lik kumeler halinde, kume icinde
 *  SEC_ARALIK_MS araliklayarak cek (SEC 10 istek/sn). */
async function belgeleriCek(cikInt, secimler, sayac) {
  const out = [];
  for (let i = 0; i < secimler.length; i += ES_ZAMANLI_BELGE) {
    const kume = secimler.slice(i, i + ES_ZAMANLI_BELGE);
    const sonuc = await Promise.all(kume.map(async (p, j) => {
      if (j) await bekle(SEC_ARALIK_MS * j);
      const xml = await cek(belgeAdresi(cikInt, p.acc, p.doc), {
        sayac,
        sure: ICERIDEN_BELGE_MS,
        kabul: 'application/xml, text/xml, */*;q=0.5',
      });
      return xml ? ayristirForm4(xml, p.tarih) : null;
    }));
    for (const k of sonuc) if (k) out.push(k);
  }
  return out;
}

/** Kayitlari topla. SAF. */
export function topla(kayitlar) {
  const t = {
    alisAdet: 0, alisTutar: 0, satisAdet: 0, satisTutar: 0,
    digerAdet: 0, netTutar: 0,
  };
  for (const k of kayitlar || []) {
    t.alisAdet += k.alisAdet;
    t.alisTutar += k.alisTutar;
    t.satisAdet += k.satisAdet;
    t.satisTutar += k.satisTutar;
    t.digerAdet += k.digerAdet;
  }
  t.netTutar = t.alisTutar - t.satisTutar;
  return t;
}

// =====================================================================
//  /api/iceriden  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/iceriden?sembol=AAPL&pazar=US
//    GET /api/iceriden?sembol=THYAO&pazar=BIST
//    200 (US)   -> { pazar:'US', sembol, cik, durumKodu, yonKod,
//                    pencereGun, bildirimSayisi, okunan, toplam,
//                    kayitlar[], kaynakAdres, sayac, tam, ms, uyari }
//    200 (BIST) -> { pazar:'BIST', sembol, durumKodu, kaynakKodu,
//                    maddeSayisi, maddeler[], kaynakAdres, sayac, tam,
//                    ms, uyari }
//    400 -> sembol_yok | bad_sembol (`gelen`,`bicim`) | bad_pazar
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> iceriden_alinamadi (ust kaynak okunamadi)
//
//  DURUM KODLARI (Turkcesi `sozluk.ts`'de):
//    'ok'             -> olculdu, tasinan kayit var
//    'kayit_yok'      -> sembolun SEC kaydi yok (ETF / yabanci ozel
//                        sirket olabilir) — web ikizinin AYNI hali
//    'bildirim_yok'   -> pencerede Form 4 / KAP maddesi yok
//    'acik_piyasa_yok'-> bildirim var ama acik piyasa alim/satimi yok
//                        (opsiyon icrasi, RSU, vergi kesintisi gibi)
//
//  `kayitlar` bos dizi ile 200 donmek OLABILIR: bildirim okundu ama
//  tasinacak satir cikmadi. Bu "veri yok" yalani DEGIL, durum kodu o
//  hali ADIYLA yaziyor; ariza hali 502 ile AYRI.
export async function iceridenHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const { istek, hata, gelen } = ayristirIstek(q.sembol ?? q.symbol, q.pazar ?? q.market);
  if (!istek) {
    // Dogrulama onbellek anahtarindan ONCE donuyor: bozuk istek KV'ye
    // dokunmuyor (api/_kur.js ile AYNI sira).
    kisaOnbellek(res);
    const govde = { error: hata, uyari: UYARI };
    if (gelen !== undefined) govde.gelen = gelen;
    if (hata === 'bad_sembol') govde.bicim = String(SEMBOL_BICIM);
    if (hata === 'bad_pazar') govde.pazarlar = PAZARLAR;
    res.status(400).json(govde);
    return;
  }

  const t0 = Date.now();
  // Onbellek: api/_kur.js'teki KALIBIN aynisi (`anahtar` -> `oku` ->
  // `X-Onbellek` -> `yaz`). Motor imzasi anahtarda YOK: bu uc motora
  // DOKUNMUYOR ve skora DAHIL DEGIL.
  const obAnahtar = anahtar('iceriden', istek);
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control',
      `public, max-age=${TTL_ICERIDEN}, s-maxage=${TTL_ICERIDEN}, stale-while-revalidate=600`);
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    const sayac = bosIceridenSayac();
    const govde = istek.pazar === 'US'
      ? await amerika(istek.sembol, sayac)
      : await borsaIstanbul(istek.sembol, sayac);

    if (!govde) {
      kisaOnbellek(res);
      res.status(502).json({ error: 'iceriden_alinamadi', ...istek, sayac, uyari: UYARI });
      return;
    }

    const cevap = { ...istek, ...govde, sayac, tam: iceridenTam(sayac), uyari: UYARI };
    // YALNIZ `tam` govde onbellege yaziliyor (kur/kripto/takvim yolu ile
    // AYNI kural): yarim olcum 30 dakika servis edilmesin.
    if (cevap.tam) await yaz(obAnahtar, cevap, TTL_ICERIDEN);
    res.setHeader('Cache-Control',
      `public, max-age=${TTL_ICERIDEN}, s-maxage=${TTL_ICERIDEN}, stale-while-revalidate=600`);
    res.status(200).json({ ...cevap, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_iceriden:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'iceriden_alinamadi', uyari: UYARI });
  }
}

/** ABD yolu — SEC Form 4. `null` = kesinti (cagiran 502 basar). */
async function amerika(sembol, sayac) {
  const cik = await cikBul(sembol, sayac);
  if (cik === undefined) return null; // olcemedim
  if (!cik) {
    // Web ikizinin "SEC kaydi yok" hali: ETF ya da yabanci ozel
    // sirket olabilir. Turkcesi `sozluk.ts`'de.
    return {
      cik: null, durumKodu: 'kayit_yok', yonKod: null,
      pencereGun: PENCERE_GUN, bildirimSayisi: 0, okunan: 0,
      toplam: null, kayitlar: [], kaynakAdres: null,
    };
  }
  const cikInt = String(parseInt(cik, 10));

  const ozetMetni = await cek(ozetAdresi(cik), { sayac, sure: ICERIDEN_TABLO_MS });
  if (!ozetMetni) return null;
  const secimler = ayristirOzet(ozetMetni);
  if (!secimler) return null;

  const kaynakAdres = secSayfaAdresi(cikInt);
  if (!secimler.length) {
    return {
      cik, durumKodu: 'bildirim_yok', yonKod: null,
      pencereGun: PENCERE_GUN, bildirimSayisi: 0, okunan: 0,
      toplam: null, kayitlar: [], kaynakAdres,
    };
  }

  const kayitlar = await belgeleriCek(cikInt, secimler, sayac);
  const toplam = topla(kayitlar);
  const yonKod = yonKoduAl(toplam);
  // Bildirim VAR ama acik piyasa alim/satimi YOK: web ikizinin
  // `!tB && !tS` dali (app.js:5237). Turkcesi `sozluk.ts`'de.
  const durumKodu = !kayitlar.length
    ? 'bildirim_yok'
    : (yonKod ? 'ok' : 'acik_piyasa_yok');

  return {
    cik,
    durumKodu,
    yonKod,
    pencereGun: PENCERE_GUN,
    // SESSIZ KIRPMA YOK: pencerede secilen belge sayisi, okunan kayit
    // sayisi ve tasinan satir sayisi UCU DE govdede.
    bildirimSayisi: secimler.length,
    okunan: kayitlar.length,
    toplam,
    kayitlar: kayitlar.slice(0, AZAMI_SATIR),
    kaynakAdres,
  };
}

/** BIST yolu — KAP beslemesi, yetersizse Google News yedegi.
 *  `null` = kesinti (cagiran 502 basar). */
async function borsaIstanbul(sembol, sayac) {
  const kapXml = await cek(KAP_RSS, {
    sayac, sure: ICERIDEN_RSS_MS, kabul: 'application/rss+xml, application/xml, text/xml',
  });
  let maddeler = kapXml
    ? suzIceriden(ayristirBesleme(kapXml, AZAMI_MADDE * 5), sembol)
    : [];
  let kaynakKodu = 'kap';

  if (maddeler.length < KAP_YEDEK_ESIGI) {
    // Web ikizinin AYNI yedegi (app.js:5259): KAP beslemesi yalniz son
    // bildirimleri tasidigi icin sembol dusebiliyor.
    const haberXml = await cek(haberYedekAdresi(sembol), {
      sayac, sure: ICERIDEN_RSS_MS, kabul: 'application/rss+xml, application/xml, text/xml',
    });
    if (haberXml) {
      // Yedekte SEMBOL kosulu YOK (sorgu zaten sembolu tasiyor), yalniz
      // anahtar kelime kosulu var — web ikizi de oyle (app.js:5264).
      const ek = ayristirBesleme(haberXml, AZAMI_MADDE).filter((m) => {
        const t = temizBaslik(m.baslik).toUpperCase();
        return ICERIDEN_KELIMELER.some((k) => t.includes(k.toUpperCase()));
      });
      if (ek.length) {
        maddeler = maddeler.concat(ek);
        if (!kapXml || !maddeler.length) kaynakKodu = 'haber';
        else kaynakKodu = 'kap_haber';
      }
    }
  }

  // Ust kaynaklarin IKISI DE okunamadiysa bu bir olcum degil, kesinti.
  if (!kapXml && !maddeler.length) return null;

  const sirali = sirala(maddeler, AZAMI_SATIR);
  return {
    durumKodu: sirali.length ? 'ok' : 'bildirim_yok',
    kaynakKodu,
    // SESSIZ KIRPMA YOK: suzgecten gecen ham sayi da govdede.
    bulunan: maddeler.length,
    maddeSayisi: sirali.length,
    maddeler: sirali,
    kaynakAdres: kapSayfaAdresi(),
  };
}

export const ROTA = 'iceriden';
export const HANDLERLAR = Object.freeze({ iceriden: iceridenHandler });
