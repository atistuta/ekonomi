// =====================================================================
//  api/_kur.js — DOVIZ / GRAM METAL KUR TASIYICISI  (/api/kur)
// =====================================================================
//  NIYE `_` ONEKLI: Vercel Hobby tavani deploy basina 12 serverless
//  fonksiyon ve `api/*.js` uc dosyasi sayisi SU AN TAM 12. `_` onekli
//  dosya rotaya cevrilmez, SAYILMAZ; yol vercel.json rewrite'i ile
//  /api/proxy?__rota=kur'a biniyor. Kalibin ikizi: api/_kripto.js.
//
//  NIYE VAR: `finans.truncgil.com` api/proxy.js'teki `IZINLI_KONAKLAR`
//  kumesinde ZATEN var, ama o YALNIZ duz `?url=` rolesine gecis izni —
//  govdeyi alanlara ayristiran, sayac basan, onbellege yazan bir UC
//  YOK. Web ikizi bu veriyi TARAYICIDA cekip Turkce sayi bicimini
//  tarayicida cozuyor (`loadRates` + `truncgilGet`, app.js:104-134) ve
//  native istemcide bu yuzeyin KARSILIGI HIC YOK: ust serit (gram
//  altin / USD / EUR / GBP), ozel gostergeler ve sepetteki metal/doviz
//  kalemleri (mobile/src/api/sepet.ts `SEBEP_METAL`, `SEBEP_FX`).
//  Native'de ayristirmayi ISTEMCIYE kurmak §5.1'in yasakladigi sey
//  olurdu; bu yuzden Turkce sayi cozumu UCTA.
//
//  HAM SAYI KURALI (§5.1): yalniz sayi ve makine kodu. Web ikizinin
//  `fmtTRY` bicimleyicisi BU DOSYAYA GECMEDI — "43.112,50 ₺" ekran
//  isi. Esik / agirlik / renk / yorum / tavsiye cumlesi YOK.
//
//  BIRIM — ALAN ADINDA YAZILI:
//    `...Try` -> TURK LIRASI. Ust kaynak her kalemi TL olarak basiyor
//      (USD = 1 dolarin TL fiyati, gram-altin = 1 gramin TL fiyati);
//      web ikizi de dordunu de `fmtTRY` ile basiyor (app.js:122-125).
//    `degisimPct` -> YUZDE PUANI (ust kaynak yuzde basiyor, oran degil)
//    `guncellemeMetni` -> ust kaynagin KENDI tarih dizgesi, OLDUGU GIBI;
//      bicimi sozlesmeli degil, bu yuzden tarihe CEVRILMIYOR.
//  Olculemeyen alan `null`, ASLA `0`: `degisimPct: 0` = "kur yerinde
//  saymis", `null` = "ust kaynak o alani vermedi".
// ---------------------------------------------------------------------
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyari metni — api/_kripto.js:36 ve on ucun daha AYNI degismezi.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Izin listesi KENDI dosyamda: proxy'nin `IZINLI_KONAKLAR` kumesi duz
// role kapisi, bu tasiyici oradan GECMIYOR (fetch'i kendisi yapiyor).
export const IZINLI_KONAK = ['finans.truncgil.com'];

// Zaman asimi — api/_kripto.js:KRIPTO_ISTEK_MS (6000) ile AYNI sayi.
// `fetch`in kendi varsayilani YOK; olmadiginda istek proxy'nin 30 sn
// tavanina asilir.
export const KUR_ISTEK_MS = 6000;

// Kisa govde = ariza. today.json tek kalemde bile ~80 bayt tasiyor,
// tam govde onlarca kalem.
export const ASGARI_GOVDE_BAYT = 64;

// KOD TAVANI — ust kaynak TEK cagrida TUM tabloyu donuyor, yani istek
// sayisi kod sayisindan BAGIMSIZ. Tavan kota icin DEGIL cevap govdesi
// icin: 40 kod ust kaynaktaki kalem sayisinin tamamindan fazlasidir.
// SESSIZ KIRPMA YOK: asan istek 400 alir.
export const AZAMI_KOD = 40;

// KOD BICIMI — ust kaynagin anahtarlari KARISIK HARF: `USD`, `EUR`,
// `GBP` buyuk; `gram-altin`, `gumus`, `platin` kucuk ve tireli
// (config.js:36,43,50 `truncgilKey`). Bu yuzden kodlar KUCULTULMUYOR —
// `usd` ile `USD` ust kaynakta AYNI SEY DEGIL.
export const KOD_BICIM = /^[A-Za-z][A-Za-z0-9-]{0,23}$/;

// UST KAYNAK ADRESI — kac istek atilacagi KOD SAYISINDAN BAGIMSIZ:
// today.json tek cagrida tum tabloyu donuyor. YANI TOPLAM EN COK 1
// ISTEK. Istek firtinasi yapisal olarak imkansiz.
export const AZAMI_UST_ISTEK = 1;

// Onbellek omru — `_onbellek.js:TTL_FIYAT` (300 sn), asagida yayinlanan
// `max-age=300` ile AYNI sayi. Web ikizinin kendi belleginde TTL YOK
// (`truncgilCache` sayfa omru boyunca duruyor, app.js:103); fark
// bilincli ve rapora yazildi.

/** Sayac kabi — api/_kripto.js:73 ile AYNI alanlar, AYRI nesne. */
export function bosKurSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Sayac "tam" mi. */
export function kurTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Kisa onbellek — api/_kripto.js:85 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/** CORS + OPTIONS + yontem kapisi. Motor kapisi YOK: bu uc motora
 *  dokunmuyor (kaynak truncgil). Gerekcenin tamami api/_kesif.js:196. */
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

/** today.json adresi — web ikizi app.js:3 `TRUNCGIL` ile BIREBIR AYNI
 *  adres. SAF: aga cikmaz, agsiz sinanabilir. */
export function kurAdresi() {
  return `https://${IZINLI_KONAK[0]}/today.json`;
}

/** Adres KENDI izin listemizde mi (https + izinli konak). SAF. */
export function izinliAdres(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

/**
 * TURKCE SAYI COZUMU — web ikizi `truncgilGet` (app.js:105-113) ile
 * AYNI iki adim: binlik NOKTALARI atilir, ondalik VIRGUL noktaya
 * cevrilir. Yuzde alani `%` tasiyabildigi icin o im de dusuruluyor
 * (web ikizi yuzdeyi HIC okumuyor, bu uc okuyor).
 * Cozulemeyen deger `null` — `0` DEGIL. SAF.
 */
export function sayiTr(ham) {
  if (typeof ham === 'number') return Number.isFinite(ham) ? ham : null;
  if (typeof ham !== 'string') return null;
  const temiz = ham.trim().replace(/%/g, '').replace(/\./g, '').replace(',', '.');
  if (!temiz) return null;
  const n = parseFloat(temiz);
  return Number.isFinite(n) ? n : null;
}

/**
 * Kod listesini ayristir — gecersiz kodda `null` doner (cagiran 400
 * basar). Tekrarlar TEKILLESTIRILIR. Kodlar KUCULTULMUYOR (KOD_BICIM
 * gerekcesi). SAF.
 */
export function ayristirKodlar(ham) {
  const parcalar = String(ham ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!parcalar.length) return { kodlar: null, hata: 'kur_kod_yok' };
  if (parcalar.length > AZAMI_KOD) return { kodlar: null, hata: 'cok_kod', gelen: parcalar.length };
  const out = [];
  for (const p of parcalar) {
    if (!KOD_BICIM.test(p)) return { kodlar: null, hata: 'bad_kod', gelen: p };
    if (!out.includes(p)) out.push(p);
  }
  return { kodlar: out, hata: null };
}

/**
 * TEK kalem kaydini ayristir. Govde bozuksa alanlar `null`, istisna
 * FIRLATMAZ. SAF.
 *
 * `fiyatTry` + `fiyatKaynak`: web ikizi `item['Satış'] || item['Alış']`
 * seklinde SATIS yoksa ALIS'a dusuyor (app.js:108). Ayni dusme BURADA
 * yapiliyor ki istemcide secim mantigi kalmasin; HANGISININ secildigi
 * `fiyatKaynak` ile YAZILI — iki farkli olcumun sessizce karismasi
 * olurdu. Ikisi AYRICA ham duruyor (`satisTry`, `alisTry`).
 */
export function ayristirKalem(kod, o) {
  if (!o || typeof o !== 'object') return null;
  const satisTry = sayiTr(o['Satış']);
  const alisTry = sayiTr(o['Alış']);
  const fiyatKaynak = satisTry != null ? 'satis' : (alisTry != null ? 'alis' : null);
  return {
    kod,
    satisTry,
    alisTry,
    fiyatTry: satisTry != null ? satisTry : alisTry,
    fiyatKaynak,
    degisimPct: sayiTr(o['Değişim']),
    // Ust kaynagin kendi sinif etiketi ("Döviz", "Altın" gibi). Metin
    // OLDUGU GIBI; sozluge CEVRILMIYOR (ekran isi, §5.1).
    tur: typeof o['Tür'] === 'string' ? o['Tür'] : null,
  };
}

/**
 * Istenen kodlari govdeden topla. Ust kaynakta OLMAYAN kod `kurlar`
 * icinde HIC gorunmez ve bu bir ARIZA DEGIL — istemci `kodlar` ile
 * `kurlar` uzunlugunu karsilastirip eksigi bulur (api/_kripto.js'teki
 * AYNI sozlesme). SAF.
 */
export function ayristirKurlar(json, kodlar) {
  if (!json || typeof json !== 'object') return null;
  const out = [];
  for (const kod of kodlar) {
    const kayit = ayristirKalem(kod, json[kod]);
    // Hicbir fiyat cozulemediyse kalem TASINMIYOR: "kod var ama her
    // alani null" satiri, olculemeyeni olculmus gibi gosterir.
    if (kayit && kayit.fiyatTry != null) out.push(kayit);
  }
  return out;
}

/** Ust kaynagin kendi guncelleme dizgesi — alan adi surumler arasinda
 *  degisebildigi icin iki ad da deneniyor; yoksa `null`. SAF. */
export function guncellemeMetniAl(json) {
  if (!json || typeof json !== 'object') return null;
  const v = json['Update_Date'] ?? json['Güncelleme_Tarihi'];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

// ---------------------------------------------------------------------
//  AGA CIKAN TEK YER. Zaman asimi AbortController ile. TEKRAR YOK:
//  basarisiz istegi hemen tekrarlamak ust kaynakta 429'u buyutur.
// ---------------------------------------------------------------------
async function cek(adres, sec = {}) {
  const sayac = sec.sayac || bosKurSayac();
  if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), KUR_ISTEK_MS);
  sayac.istek++;
  try {
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        // KISISEL E-POSTA YOK. Ust kaynak iletisim imi ISTEMIYOR (SEC
        // EDGAR'in aksine); kimlik dizgesi olculmeden degistirilmez.
        'User-Agent': 'day-starter/1.0 (kur-okuyucu)',
        'Accept': 'application/json',
      },
    });
    clearTimeout(zamanlayici);
    if (!r.ok) { sayac.hata++; return null; }
    const metin = await r.text();
    const bayt = Buffer.byteLength(metin, 'utf8');
    sayac.bayt += bayt;
    // 200 ama govde kisa = olcum degil, ariza.
    if (bayt < ASGARI_GOVDE_BAYT) { sayac.kisa++; return null; }
    let json;
    try { json = JSON.parse(metin); } catch { sayac.hata++; return null; }
    sayac.basari++;
    return json;
  } catch (e) {
    clearTimeout(zamanlayici);
    if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) sayac.zamanAsimi++;
    else sayac.hata++;
    return null;
  }
}

// =====================================================================
//  /api/kur  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/kur?kodlar=USD,EUR,GBP,gram-altin
//    200 -> { kodlar, kurlar:[kayit...], guncellemeMetni, sayac, tam,
//             ms, uyari }
//    400 -> kur_kod_yok | bad_kod (`gelen`,`bicim`) | cok_kod (`azami`,
//           `gelen`)
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> kur_alinamadi (ust kaynak okunamadi)
//
//  `kurlar` bos dizi ile 200 donmek OLABILIR: govde geldi ama istenen
//  kodlarin hicbiri icinde yok. Bu "kur yok" yalani DEGIL, "istenen
//  kodlar tabloda yok" olcumu; ariza hali 502 ile AYRI.
export async function kurHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const { kodlar, hata, gelen } = ayristirKodlar(q.kodlar ?? q.kod ?? '');
  if (!kodlar) {
    kisaOnbellek(res);
    const govde = { error: hata, azami: AZAMI_KOD, uyari: UYARI };
    if (gelen !== undefined) govde.gelen = gelen;
    if (hata === 'bad_kod') govde.bicim = String(KOD_BICIM);
    res.status(400).json(govde);
    return;
  }

  const t0 = Date.now();
  // Onbellek: api/_kripto.js'teki KALIBIN aynisi (`anahtar` -> `oku` ->
  // `X-Onbellek` -> `yaz`). Yeni kalip icat edilmedi. Motor imzasi
  // anahtarda YOK: bu uc motora dokunmuyor.
  const obAnahtar = anahtar('kur', { kodlar });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    const sayac = bosKurSayac();
    // KOD SAYISINDAN BAGIMSIZ TEK istek (AZAMI_UST_ISTEK = 1).
    const json = await cek(kurAdresi(), { sayac });

    // Govde dustuyse bu bir olcum degil, kesinti: bos dizi ile 200
    // donmek "kur yok" yalani olurdu.
    const kurlar = ayristirKurlar(json, kodlar);
    if (!kurlar) {
      kisaOnbellek(res);
      res.status(502).json({ error: 'kur_alinamadi', kodlar, sayac, uyari: UYARI });
      return;
    }

    const govde = {
      kodlar,
      kurlar,
      guncellemeMetni: guncellemeMetniAl(json),
      sayac,
      tam: kurTam(sayac),
      uyari: UYARI,
    };
    // YALNIZ `tam` govde onbellege yaziliyor (kripto/takvim yolu ile
    // ayni kural): yarim olcum 5 dakika servis edilmesin.
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_kur:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'kur_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'kur';
export const HANDLERLAR = Object.freeze({ kur: kurHandler });
