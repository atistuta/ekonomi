// =====================================================================
//  api/_degisim.js — COK DONEMLI % DEGISIM TASIYICISI  (/api/degisim)
// =====================================================================
//  NIYE `_` ONEKLI: Vercel Hobby plani bir deploy'a en fazla 12 serverless
//  fonksiyon aliyor ve `api/*.js` uc dosyasi sayisi SU AN TAM 12. `_` ile
//  baslayan dosya rotaya cevrilmez, fonksiyon SAYILMAZ. Bu yuzden yol
//  `vercel.json` rewrite'i ile /api/proxy?__rota=degisim'e biniyor ve
//  fonksiyon sayisi 12'de KALIYOR. Kalibin ikizi: api/_takvim.js +
//  api/_kesif.js. tests/uc-test.mjs ⑮b bunu kilitliyor.
//
//  NIYE VAR: native istemcide dort yuzey kendi % degisimini OLCEMIYOR —
//  liste satiri (donem secimli), Nabiz (gun ici), Bugun ve Arama
//  (gunluk). Web ikizi bu sayiyi tarayicida `changeFor()` ile hesapliyor
//  (app.js:1970); native ince istemci oldugu icin hesap UCTA olmali.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): bu uc YALNIZ sayi ve
//  makine kodu doner. Esik yok, renk yok, "yukseldi/dustu" yorumu yok,
//  Turkce kullanici cumlesi yok, `toFixed`/`Intl` yok. Bicimleme ekranin.
//
//  BIRIM — ALAN ADINDA YAZILI: `...Pct` ile biten her alan YUZDE
//  PUANIDIR, oran DEGIL. `chg1dPct: 3.25` = yuzde 3,25. Web ikizi de
//  yuzde basiyor (`(cur-ref)/ref*100`, app.js:1979) — 100 carpani burada
//  da var, yani iki taraf AYNI sayiyi goruyor. `ref*` alanlari FIYAT
//  (para birimi `currency` alaninda), `marketTs` ms epoch.
//
//  OLCULEMEYEN DONEM `null`, ASLA `0`: 0 "olctum, degismemis" demek.
//  Uc ayri durum: `null` = istendi, olculemedi · alan GOVDEDE YOK =
//  istenmedi (`?donemler=` ile suzuldu) · `ok:false` = o sembolun HICBIR
//  donemi olculemedi (ust kaynak o sembolde dustu).
// ---------------------------------------------------------------------
import { cozEndeks, temizleSembol } from './_girdi.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyari metni — api/_kesif.js:77, api/news.js:178 ve dokuz ucun daha
// AYNI degismezi. Kopya bilincli (her uc kendi govdesini kuruyor);
// surukleme tests/uc-test.mjs'teki kilitle bekciliyor.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Izin listesi KENDI dosyamda: api/proxy.js'in `IZINLI_KONAKLAR` kumesi
// duz `?url=` rolesinin kapisi, bu tasiyici oradan GECMIYOR (fetch'i
// kendisi yapiyor). Iki liste ayni iki konagi sayiyor; surukleme kilidi
// ikisinin ayrismasini kirmiziya ceviriyor.
export const IZINLI_KONAK = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// Zaman asimi — api/poll.js:228'den OLCULDU (`fetchT(..., 8000)`, ayni
// Yahoo chart ucu, ayni govde boyu). `fetch`in kendi varsayilani YOK;
// olmadiginda istek proxy'nin 30 sn tavanina kadar asili kalir.
export const DEGISIM_ISTEK_MS = 8000;

// Kisa govde = ariza. Bos bir chart cevabi ~120 bayt JSON; gercek cevap
// tek mumda bile 400 bayti geciyor.
export const ASGARI_GOVDE_BAYT = 256;

// SEMBOL TAVANI — api/_yfin.js'in `slice(0, 12)` toplu-getirme tavaniyla
// AYNI sayi. Kalibi uydurmadim: iki uc da Yahoo chart'i sembol basina
// cagiriyor, tavanin iki yerde ayrismasi istemciye iki farkli "kac
// sembol sorabilirim" sozlesmesi verirdi.
// SESSIZ KIRPMA YOK: `_yfin.js` fazlasini sessizce atiyor, bu uc 400
// doner — istemci neyi olcmedigini BILIR.
export const AZAMI_SEMBOL = 12;

// ESZAMANLILIK FRENI — istek firtinasi yok. Sembol basina en cok 3 adres
// var (kota + saatlik + gunluk seri), 4 sembol paralel -> en cok 12
// ucus. 12 sembol x 3 adres = 36 istek, 3 turda akiyor. Tek tek sirali
// cekmek 12 x 3 x 8 sn tavani ile 30 sn butcesini asardi.
export const ESZAMANLI = 4;

// Yeniden deneme SAYISI 1 ve yalniz KONAK DEGISTIRIR: query1 duserse
// query2 denenir (api/poll.js:220 olculmus kalibi). Ayni konaga tekrar
// vurmak yok — tekrar firtinasi da yok.
export const KONAK_DENEME = IZINLI_KONAK.length;

// ---------------------------------------------------------------------
//  DONEM TABLOSU — web ikizi `CHANGE_PERIODS` (app.js:1853) ile BIREBIR.
//  `anahtar` web'in `key`i (istemci ayni adi gonderebilsin), `alan`
//  cevapta donen ad, `gun` referans mumun kac TAKVIM gunu geride
//  arandigi. `label` BURADA YOK: etiket ekran metni, uc metin basmaz.
// ---------------------------------------------------------------------
export const DONEMLER = Object.freeze([
  Object.freeze({ anahtar: 'saatlik',  alan: 'chgIntradayPct', refAlan: 'refIntraday', gunici: true }),
  Object.freeze({ anahtar: 'gunluk',   alan: 'chg1dPct',       refAlan: 'ref1d',       gun: 1 }),
  Object.freeze({ anahtar: 'haftalik', alan: 'chg7dPct',       refAlan: 'ref7d',       gun: 7 }),
  Object.freeze({ anahtar: 'aylik',    alan: 'chg30dPct',      refAlan: 'ref30d',      gun: 30 }),
  Object.freeze({ anahtar: 'alti',     alan: 'chg182dPct',     refAlan: 'ref182d',     gun: 182 }),
  Object.freeze({ anahtar: 'yillik',   alan: 'chg365dPct',     refAlan: 'ref365d',     gun: 365 }),
]);
export const DONEM_ANAHTARLARI = Object.freeze(DONEMLER.map((d) => d.anahtar));

// Her satirda KOSULSUZ bulunan alanlar. Donem alanlari bunlarin ustune
// YALNIZ istenirse ekleniyor (ucuncu durum: alan yoksa istenmemistir).
export const SATIR_ALANLARI = Object.freeze([
  'symbol', 'market', 'ysym', 'ok', 'price', 'prevClose', 'currency', 'marketTs', 'gecikmeli',
]);

// ---------------------------------------------------------------------
//  ARALIK/ADIM UCLUSU — hangi seri hangi doneme bakiyor.
//
//  KOTA (`1d`/`1d`): web `getQuote` ikizi (app.js:1959). `range=1d`
//  olmasinin nedeni Yahoo'nun `chartPreviousClose` degerini YALNIZ bu
//  aralikta "dunku kapanis" diye vermesi; daha genis aralikta
//  aralik-oncesi kapanis doner (web'in kendi yorumu, app.js:1838).
//
//  SAATLIK (`5d`/`60m`): web 3mo/60m cekip son IKI bari kullaniyor
//  (app.js:1976). OLCULMUS SAPMA, bilerek: son iki 60m bari 5 gunluk
//  seride de AYNI barlardir, 3 aylik govde ~450 bar tasiyip 36 isteklik
//  bir turda bosa akardi. AYRIM: 5 gunden uzun sure islem gormeyen bir
//  sembolde 5d serisi BOS doner ve bu uc `null` verir, web ise bir ay
//  oncesinin barini referans alir. `null` o durumda daha durust; fark
//  rapora yazildi.
//
//  GUNLUK (`2y`/`1d`): web 5y/1d cekiyor (app.js:1951). 2y secildi:
//  en uzun donem 365 gun, 2 yillik seride kesme noktasi (`cutoff`)
//  serinin ICINDE kaliyor -> secilen referans mum 5y ile BIREBIR AYNI.
//  365 gunden kisa gecmisi olan sembolde iki aralik da ayni en eski
//  muma dusuyor (geri donus yolu). Govde 2,5 kat kucuk.
// ---------------------------------------------------------------------
export const KOTA_ARALIK = '1d';
export const KOTA_ADIM = '1d';
export const GUNICI_ARALIK = '5d';
export const GUNICI_ADIM = '60m';
export const GUNLUK_ARALIK = '2y';
export const GUNLUK_ADIM = '1d';

// Gun sayisini saniyeye ceviren carpan — web ile ayni (`p.days * 86400`).
export const GUN_SN = 86400;

/** Sayac kabi — api/_haber.js:115 ile AYNI alanlar, AYRI nesne. */
export function bosDegisimSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Sayac "tam" mi: hic hata/zaman asimi/kisa govde yok mu. */
export function degisimTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Kisa onbellek — api/_kesif.js:154 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/**
 * CORS + OPTIONS + yontem kapisi. true donerse cevap YAZILDI.
 * api/_kesif.js:202 `kapi`nin motorsuz halinin ikizi: bu uc motora HIC
 * dokunmuyor (kaynagi Yahoo chart, cikti yuzde listesi), bu yuzden 503
 * `motor_kurulamadi` dali YOK — calisan bir yolu olculmemis bir arizayla
 * kapatmak olurdu (gerekcenin tamami _kesif.js:196'da yazili).
 */
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
 * Yahoo sembolu. `_motor.js:115` ve app.js:421 ile BIREBIR ayni kural:
 * yalniz BIST '.IS' alir, baska her pazar HAM gecer. Endeks sozlugunun
 * `yahoo` alani (api/_girdi.js:119) bes kalemin besinde bu kuralin
 * sonucuyla ayni — ikinci bir esleme tablosu uydurulmadi. SAF.
 */
export function yahooSembol(sym, market) {
  return market === 'BIST' ? `${sym}.IS` : String(sym);
}

/** Chart adresi kur. SAF: aga cikmaz, bu yuzden agsiz sinanabiliyor. */
export function chartAdresi(ysym, aralik, adim, konak = IZINLI_KONAK[0]) {
  if (!ysym || !IZINLI_KONAK.includes(konak)) return null;
  // encodeURIComponent: '^GSPC' -> '%5EGSPC' (app.js:556 ile ayni kacis).
  return `https://${konak}/v8/finance/chart/${encodeURIComponent(ysym)}`
    + `?range=${encodeURIComponent(aralik)}&interval=${encodeURIComponent(adim)}`;
}

/** Adres KENDI izin listemizde mi (https + izinli konak). SAF. */
export function izinliAdres(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

/**
 * Yuzde degisim. Web ikizi: `(cur - ref) / ref * 100` (app.js:1979).
 * SAYISAL OLMAYAN ya da sifir referans -> `null`, ASLA 0. Web de `!ref`
 * yolunda `{pct:null}` donuyor (app.js:1997). SAF.
 */
export function yuzde(cur, ref) {
  if (!Number.isFinite(cur) || !Number.isFinite(ref) || ref === 0) return null;
  return ((cur - ref) / ref) * 100;
}

/** Sayi mi — degilse null. Yahoo eksik alani `null`/yok birakiyor. */
function sayi(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Kota govdesini ayristir — web `fetchYahooChart` ikizi (app.js:441).
 * SAF. Govde bozuksa alanlar `null`, istisna FIRLATMAZ: bir sembolun
 * bozuk cevabi butun turu dusurmesin.
 */
export function ayristirKota(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  const m = (r && r.meta) || {};
  const ts = sayi(m.regularMarketTime);
  return {
    price: sayi(m.regularMarketPrice),
    prevClose: sayi(m.chartPreviousClose),
    currency: typeof m.currency === 'string' ? m.currency : null,
    marketTs: ts == null ? null : ts * 1000,
  };
}

/**
 * Mum serisi ayristir — web `fetchYahooOHLC` ikizi (app.js:567). Suzme
 * web ile AYNI: open/high/low/close dordu de dolu olmayan bar DUSER.
 * Suzmeyi hafifletmek referans mum secimini kaydirirdi.
 * SAF. Donen: `[{time, close}]` (uc yalniz kapanisi kullaniyor).
 */
export function ayristirSeri(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  const ts = (r && r.timestamp) || [];
  const q = (r && r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close ? q.close[i] : null;
    const o = q.open ? q.open[i] : null;
    const h = q.high ? q.high[i] : null;
    const l = q.low ? q.low[i] : null;
    if (c == null || o == null || h == null || l == null) continue;
    const t = sayi(ts[i]);
    if (t == null) continue;
    out.push({ time: t, close: c });
  }
  return out;
}

/**
 * Donem referans kapanisi — web `changeFor` uzun-donem yolu ile BIREBIR
 * (app.js:1991-1998): simdiden `gun` takvim gunu geriye kesme noktasi
 * kur, seriyi SONDAN basa tara, kesme noktasina ESIT ya da ondan ESKI
 * ilk mumu al; yoksa serinin en eski mumuna dus.
 * Olculemezse `null`, ASLA 0.
 * SAF: saati disaridan aliyor (`simdiSn`), test sabit zamanla olcuyor.
 */
export function donemRef(seri, gun, simdiSn) {
  if (!Array.isArray(seri) || !seri.length) return null;
  const son = seri[seri.length - 1];
  const simdi = Number.isFinite(simdiSn) ? simdiSn : son.time;
  const kesme = simdi - gun * GUN_SN;
  for (let i = seri.length - 1; i >= 0; i--) {
    if (seri[i].time <= kesme && seri[i].close != null) return seri[i].close;
  }
  const ilk = seri.find((c) => c.close != null);
  return ilk && ilk.close ? ilk.close : null;
}

/**
 * Saatlik referans kapanisi — web ikizi `h1[h1.length - 2].close`
 * (app.js:1978): ~1 saat onceki 60m barin kapanisi. Iki bardan azsa
 * `null` (web de oyle: app.js:1977). SAF.
 */
export function saatlikRef(seri) {
  if (!Array.isArray(seri) || seri.length < 2) return null;
  const r = seri[seri.length - 2].close;
  return Number.isFinite(r) && r !== 0 ? r : null;
}

// ---------------------------------------------------------------------
//  AGA CIKAN TEK YER. Zaman asimi AbortController ile. Konak sirayla
//  denenir (query1 -> query2); AYNI konaga ikinci vurus YOK.
// ---------------------------------------------------------------------
async function chartCek(ysym, aralik, adim, sec = {}) {
  const sayac = sec.sayac || bosDegisimSayac();
  for (let k = 0; k < KONAK_DENEME; k++) {
    const adres = chartAdresi(ysym, aralik, adim, IZINLI_KONAK[k]);
    if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
    const kesici = new AbortController();
    const zamanlayici = setTimeout(() => kesici.abort(), DEGISIM_ISTEK_MS);
    sayac.istek++;
    try {
      const r = await fetch(adres, {
        signal: kesici.signal,
        headers: {
          // KISISEL E-POSTA YOK. Yahoo chart ucu iletisim imi ISTEMIYOR
          // (api/poll.js'in olculmus UA'si da istemiyor); kimlik dizgesi
          // olculmeden degistirilmez.
          'User-Agent': 'day-starter/1.0 (degisim-okuyucu)',
          'Accept': 'application/json',
        },
      });
      clearTimeout(zamanlayici);
      if (!r.ok) { sayac.hata++; continue; }
      const metin = await r.text();
      const bayt = Buffer.byteLength(metin, 'utf8');
      sayac.bayt += bayt;
      // 200 ama govde kisa = olcum degil, ariza.
      if (bayt < ASGARI_GOVDE_BAYT) { sayac.kisa++; continue; }
      let json;
      try { json = JSON.parse(metin); } catch { sayac.hata++; continue; }
      sayac.basari++;
      return json;
    } catch (e) {
      clearTimeout(zamanlayici);
      if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message)))) sayac.zamanAsimi++;
      else sayac.hata++;
    }
  }
  return null;
}

/**
 * TEK sembolun satirini uret. ISTENEN donemlere gore YALNIZ gereken
 * adresleri ceker: `?donemler=gunluk` tek adres eder, alti donem uc.
 * @param {{sym:string, market:string}} hedef
 * @param {{donemler?:object[], sayac?:object}} sec
 */
export async function sembolDegisim(hedef, sec = {}) {
  const sayac = sec.sayac || bosDegisimSayac();
  const donemler = sec.donemler && sec.donemler.length ? sec.donemler : DONEMLER;
  const ysym = yahooSembol(hedef.sym, hedef.market);

  const guniciGerek = donemler.some((d) => d.gunici);
  const seriGerek = donemler.some((d) => !d.gunici && d.gun > 1);

  // Kota HER donem icin gerekli: guncel deger (`cur`) canli fiyat.
  const [kotaJ, guniciJ, seriJ] = await Promise.all([
    chartCek(ysym, KOTA_ARALIK, KOTA_ADIM, { sayac }),
    guniciGerek ? chartCek(ysym, GUNICI_ARALIK, GUNICI_ADIM, { sayac }) : Promise.resolve(null),
    seriGerek ? chartCek(ysym, GUNLUK_ARALIK, GUNLUK_ADIM, { sayac }) : Promise.resolve(null),
  ]);

  const kota = ayristirKota(kotaJ);
  const gunici = guniciJ ? ayristirSeri(guniciJ) : [];
  const seri = seriJ ? ayristirSeri(seriJ) : [];

  const satir = {
    symbol: hedef.sym,
    market: hedef.market,
    ysym,
    // `ok`: bu sembolun KOTASI okundu mu. Kota yoksa hicbir donem
    // olculemez (guncel deger orada).
    ok: kota.price != null,
    price: kota.price,
    prevClose: kota.prevClose,
    currency: kota.currency,
    marketTs: kota.marketTs,
    // BIST verisi Yahoo'da gecikmeli gelir — web ikizi de bunu
    // `delayed: market === 'BIST'` diye bayrakliyor (app.js:1977).
    // MAKINE BAYRAGI, cumle degil: "gecikmeli" yazisini ekran basar.
    gecikmeli: hedef.market === 'BIST',
  };

  const simdiSn = kota.marketTs != null
    ? kota.marketTs / 1000
    : (seri.length ? seri[seri.length - 1].time : Math.floor(Date.now() / 1000));

  for (const d of donemler) {
    let ref = null;
    if (d.gunici) {
      ref = saatlikRef(gunici);
      // Web gun ici yolunda `cur`u canli fiyat YOKSA son bara dusuruyor
      // (app.js:1979). Ayni geri donus burada da var.
      const cur = kota.price != null
        ? kota.price
        : (gunici.length ? gunici[gunici.length - 1].close : null);
      satir[d.alan] = yuzde(cur, ref);
    } else if (d.gun <= 1) {
      ref = kota.prevClose;
      satir[d.alan] = yuzde(kota.price, ref);
    } else {
      ref = donemRef(seri, d.gun, simdiSn);
      satir[d.alan] = yuzde(kota.price, ref);
    }
    satir[d.refAlan] = Number.isFinite(ref) ? ref : null;
  }
  return { satir, sayac };
}

// =====================================================================
//  /api/degisim  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/degisim?semboller=THYAO:BIST,AAPL[&donemler=gunluk,saatlik]
//    200 -> { semboller:[...], donemler:[...], satirlar:[satir...],
//             sayac, tam, ms, uyari }
//    400 -> semboller_yok | bad_sembol (`gelen`) | cok_sembol (`azami`)
//           | bad_donem (`izinli`)
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> degisim_alinamadi (ISTENEN SEMBOLLERIN HEPSI okunamadi)
//
//  SEMBOL BICIMI: `KOD` (varsayilan pazar US) · `KOD:BIST` · `KOD.IS`
//  (api/_girdi.js `temizleSembol` ile AYNI kapi — ikinci bir sembol
//  sozlesmesi uydurulmadi). Endeks/emtia kalemleri (`^GSPC`, `XU100`,
//  `GC=F`) KAPALI SOZLUKTEN cozuluyor (api/_girdi.js `cozEndeks`);
//  sozluk disi `^`/`=` iceren girdi 400 alir.
//
//  `tam`: TUM istenen sembollerin TUM adresleri hatasiz okundu mu. Bir
//  sembolde bir donem `null` ise `tam:false` olur — istemci "olctum"
//  ile "olcemedim"i ayirt edebilsin.
export async function degisimHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const hamSemboller = String(q.semboller ?? q.symbols ?? '').trim();
  if (!hamSemboller) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'semboller_yok', azami: AZAMI_SEMBOL, uyari: UYARI });
    return;
  }
  const parcalar = hamSemboller.split(',').map((s) => s.trim()).filter(Boolean);
  // SESSIZ KIRPMA YOK: tavani asan istek 400 alir (gerekce AZAMI_SEMBOL).
  if (parcalar.length > AZAMI_SEMBOL) {
    kisaOnbellek(res);
    res.status(400).json({
      error: 'cok_sembol', azami: AZAMI_SEMBOL, gelen: parcalar.length, uyari: UYARI,
    });
    return;
  }
  const hedefler = [];
  for (const ham of parcalar) {
    // Once KAPALI endeks sozlugu, sonra normal sembol kapisi.
    const e = cozEndeks(ham);
    const h = e || temizleSembol(ham, 'US');
    if (!h) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_sembol', alan: 'semboller', gelen: ham, uyari: UYARI });
      return;
    }
    hedefler.push(h);
  }

  // Donem suzgeci — verilmemisse HEPSI, verilmis ama beyaz listede
  // degilse 400. Sessiz 'hepsi'ye dusme yok.
  const hamDonem = String(q.donemler ?? '').trim();
  let donemler = DONEMLER;
  if (hamDonem) {
    const istenen = hamDonem.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const secili = [];
    for (const ad of istenen) {
      const d = DONEMLER.find((x) => x.anahtar === ad);
      if (!d) {
        kisaOnbellek(res);
        res.status(400).json({
          error: 'bad_donem', izinli: [...DONEM_ANAHTARLARI], gelen: ad, uyari: UYARI,
        });
        return;
      }
      if (!secili.includes(d)) secili.push(d);
    }
    donemler = secili;
  }

  const t0 = Date.now();
  const sembolAnahtar = hedefler.map((h) => `${h.market}:${h.sym}`);
  const donemAnahtar = donemler.map((d) => d.anahtar);
  // Onbellek: api/_kesif.js takvim yolundaki KALIBIN aynisi
  // (`anahtar` -> `oku` -> `X-Onbellek` -> `yaz`). Yeni kalip icat
  // edilmedi. Motor imzasi anahtarda YOK: bu uc motora hic dokunmuyor.
  // TTL `_onbellek.js:TTL_FIYAT` (300 sn) — fiyat kovasinin kendisi ve
  // asagida yayinlanan `max-age=300` ile AYNI sayi. Web ikizinin kendi
  // bellegi 90 sn (app.js:1960); fark bilincli, rapora yazildi.
  const obAnahtar = anahtar('degisim', { semboller: sembolAnahtar, donemler: donemAnahtar });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    const sayac = bosDegisimSayac();
    const satirlar = [];
    // ESZAMANLILIK FRENI: ESZAMANLI boyunda dilimler. `allSettled`:
    // bir sembol patlarsa otekiler basilmaya devam eder.
    for (let i = 0; i < hedefler.length; i += ESZAMANLI) {
      const dilim = hedefler.slice(i, i + ESZAMANLI);
      const sonuc = await Promise.allSettled(
        dilim.map((h) => sembolDegisim(h, { donemler, sayac })),
      );
      for (let j = 0; j < dilim.length; j++) {
        const s = sonuc[j];
        if (s.status === 'fulfilled' && s.value && s.value.satir) {
          satirlar.push(s.value.satir);
          continue;
        }
        // Beklenmeyen istisna: satir DUSMUYOR, `ok:false` ile donuyor —
        // istemcinin sembol sirasi bozulmasin.
        const bos = {
          symbol: dilim[j].sym,
          market: dilim[j].market,
          ysym: yahooSembol(dilim[j].sym, dilim[j].market),
          ok: false,
          price: null,
          prevClose: null,
          currency: null,
          marketTs: null,
          gecikmeli: dilim[j].market === 'BIST',
        };
        for (const d of donemler) { bos[d.alan] = null; bos[d.refAlan] = null; }
        satirlar.push(bos);
        sayac.hata++;
      }
    }

    // HEPSI dustuyse bu bir olcum degil, kesinti.
    if (!satirlar.some((s) => s.ok)) {
      kisaOnbellek(res);
      res.status(502).json({
        error: 'degisim_alinamadi', semboller: sembolAnahtar, sayac, uyari: UYARI,
      });
      return;
    }

    const govde = {
      semboller: sembolAnahtar,
      donemler: donemAnahtar,
      satirlar,
      sayac,
      tam: degisimTam(sayac),
      uyari: UYARI,
    };
    // YALNIZ `tam` govde onbellege yaziliyor (takvim yolu ile ayni
    // kural): yarim olcum 5 dakika boyunca tekrar servis edilmesin.
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_degisim:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'degisim_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'degisim';
export const HANDLERLAR = Object.freeze({ degisim: degisimHandler });
