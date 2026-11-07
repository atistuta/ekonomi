// =====================================================================
//  api/_kripto.js — KRIPTO PIYASA VERISI TASIYICISI  (/api/kripto)
// =====================================================================
//  NIYE `_` ONEKLI: Vercel Hobby tavani deploy basina 12 serverless
//  fonksiyon ve `api/*.js` uc dosyasi sayisi SU AN TAM 12. `_` onekli
//  dosya rotaya cevrilmez, SAYILMAZ; yol vercel.json rewrite'i ile
//  /api/proxy?__rota=kripto'ya biniyor. Kalibin ikizi: api/_takvim.js.
//
//  NIYE VAR: api/proxy.js:85 civarindaki izin listesinde
//  `api.coingecko.com` ZATEN var, ama o YALNIZ `?url=` rolesine gecis
//  izni — sembolu alanlara ayristiran, kota tavanina uyan, sayac basan
//  bir UC yok. Web ikizi bu veriyi tarayicida cekiyor
//  (`cryptoMarkets` app.js:6914, `cgGlobal` app.js:6935) ve native
//  istemcide bu yuzey HIC yok: sira, 24s degisim, hacim, arz, ATH,
//  baskinlik.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): yalniz sayi ve makine
//  kodu. Web ikizinin `shortNum`/`cUsd`/`toFixed(1)` bicimleyicileri
//  (app.js:6903, 6901, 7047) BU DOSYAYA GECMEDI — "1.24T", "$43,112",
//  "-18.3%" ekran isi. Esik/renk/yorum yok.
//
//  BIRIM — ALAN ADINDA YAZILI:
//    `...Pct` -> YUZDE PUANI (CoinGecko da yuzde basiyor, oran degil)
//    `...Usd` -> ABD DOLARI (istek `vs_currency=usd` ile sabit)
//    `...Adet` -> COIN ADEDI (arz alanlari; `maxSupplyAdet: null` =
//      ust sinir YOK, CoinGecko sinirsiz arzda `max_supply: null` doner)
//    `athTs`  -> ms epoch
//  Olculemeyen alan `null`, ASLA `0`: 0 "olctum, sifir cikti" demek
//  (ornegin `priceChange24hPct: 0` = coin yerinde saymis; `null` =
//  CoinGecko o alani vermedi).
// ---------------------------------------------------------------------
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyari metni — api/_kesif.js:77 ve on ucun daha AYNI degismezi. Kopya
// bilincli (her uc kendi govdesini kuruyor), surukleme uc-test'te kilitli.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Izin listesi KENDI dosyamda: proxy'nin `IZINLI_KONAKLAR` kumesi duz
// role kapisi, bu tasiyici oradan GECMIYOR (fetch'i kendisi yapiyor).
export const IZINLI_KONAK = ['api.coingecko.com'];

// Zaman asimi — api/_haber.js:HABER_ISTEK_MS (6000) ile AYNI sayi;
// CoinGecko ucretsiz katmani yavas yanit verebiliyor, `fetch`in kendi
// varsayilani YOK, olmadiginda istek proxy'nin 30 sn tavanina asilir.
export const KRIPTO_ISTEK_MS = 6000;

// Kisa govde = ariza. Bos bir markets cevabi `[]` (2 bayt); tek coin
// bile ~700 bayt tasiyor.
export const ASGARI_GOVDE_BAYT = 64;

// ID TAVANI — CoinGecko `ids` parametresi tek istege coklu kimlik
// aliyor; tavan kota icin DEGIL adres uzunlugu icin. 50 kimlik ~700
// karakterlik sorgu dizgesi eder. Web ikizi 10 kalemlik sabit sepet
// gonderiyor (app.js:2383 `BM_CRYPTO`); 50 arama sonucu listesine de
// yer biraktigi icin secildi. SESSIZ KIRPMA YOK: asan istek 400 alir.
export const AZAMI_ID = 50;

// KIMLIK BICIMI — CoinGecko kimligi kucuk harf, rakam, tire ve nokta.
// Ornek: `bitcoin`, `avalanche-2`, `binancecoin` (app.js:2383).
export const ID_BICIM = /^[a-z0-9][a-z0-9.\-]{0,47}$/;

// UST KAYNAK ADRESLERI — kac istek atilacagi ID SAYISINDAN BAGIMSIZ:
// markets ucu tek cagrida hepsini doner, global ucu tekil. YANI TOPLAM
// EN COK 2 ISTEK. Istek firtinasi yapisal olarak imkansiz.
export const AZAMI_UST_ISTEK = 2;

// Onbellek omru — `_onbellek.js:TTL_FIYAT` (300 sn), asagida yayinlanan
// `max-age=300` ile AYNI sayi. Web ikizi markets'i 90 sn, global'i
// 300 sn belleginde tutuyor (app.js:6917, 6936); tek TTL secildi, fark
// bilincli ve rapora yazildi.

/** Sayac kabi — api/_haber.js:115 ile AYNI alanlar, AYRI nesne. */
export function bosKriptoSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Sayac "tam" mi. */
export function kriptoTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Kisa onbellek — api/_kesif.js:154 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/** CORS + OPTIONS + yontem kapisi. Motor kapisi YOK: bu uc motora
 *  dokunmuyor (kaynak CoinGecko), calisan yolu olculmemis bir arizayla
 *  kapatmak olurdu (gerekcenin tamami api/_kesif.js:196). */
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

/**
 * markets adresi. Web ikizi app.js:6921 ile BIREBIR ayni sorgu:
 * `vs_currency=usd&ids=<csv>&price_change_percentage=24h`.
 * `sparkline=true` YALNIZ istenirse ekleniyor — govdeyi coin basina
 * ~170 sayi buyuten alan, istemedigine gonderilmez.
 * SAF: aga cikmaz, agsiz sinanabilir.
 */
export function marketsAdresi(idler, sec = {}) {
  if (!Array.isArray(idler) || !idler.length) return null;
  const q = new URLSearchParams();
  q.set('vs_currency', 'usd');
  q.set('ids', idler.join(','));
  q.set('price_change_percentage', '24h');
  if (sec.sparkline) q.set('sparkline', 'true');
  return `https://${IZINLI_KONAK[0]}/api/v3/coins/markets?${q.toString()}`;
}

/** global adresi — web ikizi app.js:6937. SAF. */
export function globalAdresi() {
  return `https://${IZINLI_KONAK[0]}/api/v3/global`;
}

/** Adres KENDI izin listemizde mi (https + izinli konak). SAF. */
export function izinliAdres(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

/** Sayi mi — degilse null. CoinGecko eksik alani `null` birakiyor. */
function sayi(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Kimlik listesini ayristir — gecersiz kimlikte `null` doner (cagiran
 *  400 basar). Tekrarlar TEKILLESTIRILIR: ayni kimligi iki kez
 *  gondermek ust kaynaga iki kayit demek degil. SAF. */
export function ayristirIdler(ham) {
  const parcalar = String(ham ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parcalar.length) return { idler: null, hata: 'kripto_id_yok' };
  if (parcalar.length > AZAMI_ID) return { idler: null, hata: 'cok_id', gelen: parcalar.length };
  const out = [];
  for (const p of parcalar) {
    if (!ID_BICIM.test(p)) return { idler: null, hata: 'bad_id', gelen: p };
    if (!out.includes(p)) out.push(p);
  }
  return { idler: out, hata: null };
}

/**
 * TEK coin kaydini ayristir. Web ikizinin okudugu ALANLARIN TAMAMI
 * (app.js:7041-7047) + ikizin kart yuzunde kullandigi fiyat/degisim
 * (app.js:6956-6957). Govde bozuksa alanlar `null`, istisna FIRLATMAZ.
 * SAF.
 *
 * `sparkline7dUsd`: CoinGecko'nun 7 gunluk saatlik dizisi HAM gecer —
 * cizim native'in isi (web de `sparkline`i kendi ciziyor, app.js:498).
 * Istenmemisse alan GOVDEDE YOK (ucuncu durum).
 */
export function ayristirCoin(o) {
  if (!o || typeof o !== 'object') return null;
  const id = typeof o.id === 'string' ? o.id : null;
  if (!id) return null;
  const athTsSn = typeof o.ath_date === 'string' ? Date.parse(o.ath_date) : NaN;
  const kayit = {
    id,
    symbol: typeof o.symbol === 'string' ? o.symbol.toUpperCase() : null,
    name: typeof o.name === 'string' ? o.name : null,
    priceUsd: sayi(o.current_price),
    // SIRA: web `#` onekini EKRANDA basiyor (app.js:7041), uc ham sayi verir.
    marketCapRank: sayi(o.market_cap_rank),
    marketCapUsd: sayi(o.market_cap),
    priceChange24hPct: sayi(o.price_change_percentage_24h),
    totalVolumeUsd: sayi(o.total_volume),
    circulatingSupplyAdet: sayi(o.circulating_supply),
    // `null` = ust sinir YOK (web burada '∞' basiyor, app.js:7045).
    // Bu alanda `null` "olculemedi" DEGIL, "sinirsiz" demek; ayrimi
    // ekran degil sozlesme tasiyor, rapora yazildi.
    maxSupplyAdet: sayi(o.max_supply),
    athUsd: sayi(o.ath),
    athChangePct: sayi(o.ath_change_percentage),
    athTs: Number.isFinite(athTsSn) ? athTsSn : null,
  };
  const sp = o.sparkline_in_7d && o.sparkline_in_7d.price;
  if (Array.isArray(sp)) {
    kayit.sparkline7dUsd = sp.filter((x) => typeof x === 'number' && Number.isFinite(x));
  }
  return kayit;
}

/**
 * Kuresel baskinlik haritasi. CoinGecko `market_cap_percentage`
 * anahtarlari KUCUK HARF coin sembolu (`btc`, `eth`) — web ikizi de
 * `coin.sym.toLowerCase()` ile bakiyor (app.js:7035). SAF.
 * Donen: `{ btc: 54.2, ... }` yuzde puani.
 */
export function ayristirKuresel(json) {
  const d = json && json.data;
  const mcp = d && d.market_cap_percentage;
  if (!mcp || typeof mcp !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(mcp)) {
    const n = sayi(v);
    if (n != null) out[String(k).toLowerCase()] = n;
  }
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------
//  AGA CIKAN TEK YER. Zaman asimi AbortController ile. TEKRAR YOK:
//  CoinGecko ucretsiz katmani dakika basina istek sayiyor, basarisiz
//  istegi hemen tekrarlamak kotayi yer ve 429'u buyutur.
// ---------------------------------------------------------------------
async function cek(adres, sec = {}) {
  const sayac = sec.sayac || bosKriptoSayac();
  if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), KRIPTO_ISTEK_MS);
  sayac.istek++;
  try {
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        // KISISEL E-POSTA YOK. CoinGecko iletisim imi ISTEMIYOR (SEC
        // EDGAR'in aksine, proxy.js:120); kimlik dizgesi olculmeden
        // degistirilmez.
        'User-Agent': 'day-starter/1.0 (kripto-okuyucu)',
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
//  /api/kripto  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/kripto?idler=bitcoin,ethereum[&sparkline=1][&kuresel=0]
//    200 -> { idler, coinler:[kayit...], kuresel, sayac, tam, ms, uyari }
//    400 -> kripto_id_yok | bad_id (`gelen`) | cok_id (`azami`,`gelen`)
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> kripto_alinamadi (markets ucu okunamadi)
//
//  `kuresel`: baskinlik haritasi (`{btc:54.2,...}`) ya da `null`.
//  `?kuresel=0` ile ISTENMEZSE alan GOVDEDE YOK -> uc kaynak yerine iki
//  degil TEK istek atilir.
//
//  `tam`: iki ust istegin de hatasiz dondugu hal. Bir coin kimligi
//  CoinGecko'da yoksa o kimlik `coinler` icinde HIC gorunmez (ust kaynak
//  bilinmeyen kimligi sessizce atiyor) — bu bir ARIZA DEGIL, bu yuzden
//  `tam`i dusurmuyor; istemci `idler` ile `coinler` uzunlugunu
//  karsilastirarak eksigi bulur.
export async function kriptoHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const { idler, hata, gelen } = ayristirIdler(q.idler ?? q.ids ?? '');
  if (!idler) {
    kisaOnbellek(res);
    const govde = { error: hata, azami: AZAMI_ID, uyari: UYARI };
    if (gelen !== undefined) govde.gelen = gelen;
    if (hata === 'bad_id') govde.bicim = String(ID_BICIM);
    res.status(400).json(govde);
    return;
  }

  const sparkline = q.sparkline === '1' || q.sparkline === 'true';
  // Varsayilan ACIK: dort yuzeyin ucu baskinligi istiyor; kapatmak
  // isteyen `?kuresel=0` der.
  const kureselIstendi = !(q.kuresel === '0' || q.kuresel === 'false');

  const t0 = Date.now();
  // Onbellek: api/_kesif.js takvim yolundaki KALIBIN aynisi
  // (`anahtar` -> `oku` -> `X-Onbellek` -> `yaz`). Yeni kalip icat
  // edilmedi. Motor imzasi anahtarda YOK: bu uc motora dokunmuyor.
  const obAnahtar = anahtar('kripto', { idler, sparkline, kuresel: kureselIstendi });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    const sayac = bosKriptoSayac();
    // ID SAYISINDAN BAGIMSIZ en cok 2 istek, ikisi PARALEL.
    const [mJson, gJson] = await Promise.all([
      cek(marketsAdresi(idler, { sparkline }), { sayac }),
      kureselIstendi ? cek(globalAdresi(), { sayac }) : Promise.resolve(null),
    ]);

    // markets dustuyse bu bir olcum degil, kesinti: coin listesi UCUN
    // ASIL CIKTISI, bos dizi ile 200 donmek "kripto yok" yalani olurdu.
    if (!Array.isArray(mJson)) {
      kisaOnbellek(res);
      res.status(502).json({ error: 'kripto_alinamadi', idler, sayac, uyari: UYARI });
      return;
    }

    const coinler = [];
    for (const o of mJson) {
      const k = ayristirCoin(o);
      if (k) coinler.push(k);
    }
    // Istenen sirayi KORU: ust kaynak piyasa degerine gore siraliyor,
    // istemci kendi sepet sirasini bekliyor (web de kendi dizisini
    // geziyor, app.js:6954).
    coinler.sort((a, b) => idler.indexOf(a.id) - idler.indexOf(b.id));

    const govde = {
      idler,
      coinler,
      sayac,
      tam: kriptoTam(sayac),
      uyari: UYARI,
    };
    // Kuresel ISTENMEDIYSE alan govdede YOK (ucuncu durum); istendi ama
    // okunamadiysa `null` (olculemedi).
    if (kureselIstendi) govde.kuresel = ayristirKuresel(gJson);
    // YALNIZ `tam` govde onbellege yaziliyor (takvim yolu ile ayni
    // kural): yarim olcum 5 dakika servis edilmesin.
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_kripto:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'kripto_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'kripto';
export const HANDLERLAR = Object.freeze({ kripto: kriptoHandler });
