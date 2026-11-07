// =====================================================================
//  api/_metal.js — MADEN HABER BESLEMESI TASIYICISI  (/api/metal)
// =====================================================================
//  NIYE `_` ONEKLI: Vercel Hobby tavani deploy basina 12 serverless
//  fonksiyon ve `api/*.js` uc dosyasi sayisi SU AN TAM 12. `_` onekli
//  dosya rotaya cevrilmez, SAYILMAZ; yol vercel.json rewrite'i ile
//  /api/proxy?__rota=metal'e biniyor. Kalibin ikizi: api/_takvim.js.
//
//  NIYE VAR: web ikizi maden haberlerini madenin TR ve dunya sorgusuyla
//  ayri ayri cekiyor (sorgular config.js:37-52 `window.METALS`,
//  app.js:6896 `METAL_SPOT` ile ayni iki dizge). Native tarafta maden
//  haberi HIC yok cunku hangi sorgunun hangi madene ait oldugunu
//  bilen bir UC yoktu.
//
//  AYRISTIRICI KOPYALANMADI: RSS govdesi, zaman asimi, kimlik dizgesi,
//  kisa govde kurali ve sayaclar api/_haber.js'in `haberCek`inden
//  GELIYOR. Ikinci bir RSS ayristiricisi yazmak iki ayri surukleme
//  yuzeyi demekti.
//
//  CEVAP BICIMI = MEVCUT HABER UCLERININ BICIMI: her madde tam olarak
//  `MADDE_ALANLARI` (api/_haber.js:81) alanlarini tasiyor
//  (`title, link, pubDate, source, type, symbol`), yani native'in
//  `HaberSatiri` bileseni OLDUGU GIBI yeniden kullanilabiliyor —
//  ekranda ikinci bir madde bicimi dogmuyor.
//
//  HAM VERI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): bu uc YALNIZ veri ve
//  makine kodu doner. Fiyat yorumu, esik, renk, emoji yok — web
//  ikizinin `emoji` alani (app.js:6897) BU DOSYAYA GECMEDI, simge ekran
//  isi. Turkce kullanici cumlesi UCTA yok (tek metin alani `uyari`,
//  butun uclerin tasidigi yasal not).
// ---------------------------------------------------------------------
import { haberCek, bosHaberSayac, haberTam, MADDE_ALANLARI, AZAMI_MADDE, VARSAYILAN_MADDE } from './_haber.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyari metni — api/_kesif.js:77 ve on ucun daha AYNI degismezi.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  KAPALI MADEN SOZLUGU — uc, istemciden gelen HER sorguyu Google
//  News'e tasimaz; yalniz BU UC kalemin sorgusunu tasir. Acik sorgu
//  kabul etmek ucu baskasinin arama rolesine cevirirdi.
//  `anahtar` makine kodu (istemci bunu gonderir), `ysym` Yahoo vadeli
//  sembolu (app.js:6907 `METAL_SPOT` ile BIREBIR), `trSorgu`/`dunyaSorgu`
//  config.js:37-52
//  `queryTR`/`queryWORLD` ile BIREBIR. Etiket/isim YOK: ad ekran
//  metnidir, uc metin basmaz.
// ---------------------------------------------------------------------
//  OLCULEN SINIR (ysym -> /api/degisim): `GC=F` `api/_girdi.js`
//  `ENDEKS_SOZLUGU`nde VAR, ama `SI=F` ve `PL=F` YOK ve `SEMBOL_BICIM`
//  (`_girdi.js:79`) '=' KABUL ETMIYOR -> o iki ysym `/api/degisim`de 400
//  `bad_sembol` alir. Sozluk "YALNIZ /api/chart ICIN" diye ilan edilmis
//  KAPALI kume (`_girdi.js:119`); genisletmek bu dosyanin isi degil.
//  `ysym` burada web ikiziyle ESLESME ICIN duruyor, caprazlanabilir bir
//  fiyat sozu DEGIL — ucte 3 kalemin 1'i caprazlanabiliyor, olculdu.
export const METALLER = Object.freeze({
  altin:  Object.freeze({ anahtar: 'altin',  ysym: 'GC=F', trSorgu: 'altın fiyat piyasa',  dunyaSorgu: 'gold price market' }),
  gumus:  Object.freeze({ anahtar: 'gumus',  ysym: 'SI=F', trSorgu: 'gümüş fiyat piyasa',  dunyaSorgu: 'silver price market' }),
  platin: Object.freeze({ anahtar: 'platin', ysym: 'PL=F', trSorgu: 'platin fiyat piyasa', dunyaSorgu: 'platinum price market' }),
});
export const METAL_ANAHTARLARI = Object.freeze(Object.keys(METALLER));

// KAPSAM — hangi yerellerin cekilecegi. `tr` = Google News TR yereli,
// `dunya` = US yereli (api/_haber.js:105 `PAZAR_YERELI`). `hepsi`
// ikisini de ceker. Yereller api/_haber.js'in pazar adlariyla
// eslenir, ucuncu bir yerel sozlugu uydurulmadi.
export const KAPSAMLAR = Object.freeze(['hepsi', 'tr', 'dunya']);
export const VARSAYILAN_KAPSAM = 'hepsi';
export const KAPSAM_PAZAR = Object.freeze({ tr: 'TR', dunya: 'US' });

// ISTEK TAVANI — en kotu hal: 3 maden x 2 yerel = 6 RSS istegi, hepsi
// TEK turda paralel. Istemci kac maden isterse ISTEK SAYISI ONUN IKI
// KATI; tavan madenlerin sayisi (3) ile yapisal olarak kapali.
export const AZAMI_UST_ISTEK = METAL_ANAHTARLARI.length * 2;

/** Kisa onbellek — api/_kesif.js:154 ile AYNI tek satir. */
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/** CORS + OPTIONS + yontem kapisi. Motor kapisi YOK: bu ucun kaynagi
 *  RSS, motora dokunmuyor (gerekce api/_kesif.js:196). */
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

/** Maden anahtarlarini ayristir — KAPALI sozluk, sozluk disi anahtar
 *  400 eder. Tekrarlar tekillestirilir. SAF: aga cikmaz. */
export function ayristirMadenler(ham) {
  const h = String(ham ?? '').trim();
  // Verilmemisse HEPSI — web ikizi de ucunu birlikte basiyor.
  if (!h) return { madenler: METAL_ANAHTARLARI.map((k) => METALLER[k]), hata: null };
  const parcalar = h.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parcalar.length) return { madenler: null, hata: 'bad_maden', gelen: h };
  const out = [];
  for (const p of parcalar) {
    // `hasOwnProperty.call`: sozluk KAPALI, `__proto__`/`toString` gibi
    // miras anahtarlar sozluge girmez (api/_girdi.js:144 ile ayni kapi).
    if (!Object.prototype.hasOwnProperty.call(METALLER, p)) {
      return { madenler: null, hata: 'bad_maden', gelen: p };
    }
    const m = METALLER[p];
    if (!out.includes(m)) out.push(m);
  }
  return { madenler: out, hata: null };
}

/** Kapsamdan cekilecek yerel listesi. SAF. */
export function kapsamYerelleri(kapsam) {
  if (kapsam === 'tr') return ['tr'];
  if (kapsam === 'dunya') return ['dunya'];
  return ['tr', 'dunya'];
}

/**
 * Limit — api/_haber.js `beslemeCek` ile AYNI siniri uygular
 * (`1..AZAMI_MADDE`, varsayilan `VARSAYILAN_MADDE`). Tavani ASAN deger
 * sessizce kirpilmaz: cagiran 400 basar (uc, istedigi 40 maddeden
 * 25'ini aldigini sanan istemci biraktmaz). SAF.
 */
export function ayristirLimit(ham) {
  if (ham == null || String(ham).trim() === '') return { limit: VARSAYILAN_MADDE, hata: null };
  const n = Number(ham);
  if (!Number.isInteger(n) || n < 1 || n > AZAMI_MADDE) {
    return { limit: null, hata: 'bad_limit', gelen: String(ham) };
  }
  return { limit: n, hata: null };
}

/**
 * TEK madenin TEK yerelini cek. `symbol` olarak madenin `ysym`i
 * yaziliyor: madde bicimi `MADDE_ALANLARI` ile BIREBIR kaliyor ve
 * istemci maddeyi madene geri baglayabiliyor (hisse haberlerinde de o
 * alan bu isi goruyor, api/_haber.js:254).
 */
async function madenYerel(maden, yerel, sec) {
  const pazar = KAPSAM_PAZAR[yerel];
  const sorgu = yerel === 'tr' ? maden.trSorgu : maden.dunyaSorgu;
  const r = await haberCek(sorgu, {
    market: pazar,
    limit: sec.limit,
    symbol: maden.ysym,
    sayac: sec.sayac,
  });
  return { yerel, maddeler: r.maddeler, tam: r.tam };
}

// =====================================================================
//  /api/metal  —  GET
// =====================================================================
//  SOZLESME
//    GET /api/metal[?madenler=altin,gumus][&kapsam=hepsi][&limit=10]
//    200 -> { madenler:[anahtar...], kapsam, limit,
//             satirlar:[{ maden, ysym, tr:[madde...], dunya:[madde...] }],
//             sayac, tam, ms, uyari }
//    400 -> bad_maden (`izinli`,`gelen`) | bad_kapsam (`izinli`,`gelen`)
//           | bad_limit (`asgari`,`azami`,`gelen`)
//    405 -> method_not_allowed (Allow basligiyla)
//    502 -> metal_alinamadi (HICBIR maden/yerel okunamadi)
//
//  UC AYRI DURUM: `[]` = o yerel OKUNDU, haber yok · alan GOVDEDE YOK =
//  o yerel `kapsam` ile ISTENMEDI · 502 = hicbiri okunamadi. Bos dizi
//  ile 200 donup "haber yok" demek olculmemis bir iddia olurdu, bu
//  yuzden tumu dustuyse 502.
export async function metalHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const { madenler, hata: mHata, gelen: mGelen } = ayristirMadenler(q.madenler ?? q.metals);
  if (!madenler) {
    kisaOnbellek(res);
    res.status(400).json({
      error: mHata, izinli: [...METAL_ANAHTARLARI], gelen: mGelen, uyari: UYARI,
    });
    return;
  }

  const kapsam = String(q.kapsam ?? VARSAYILAN_KAPSAM).trim().toLowerCase() || VARSAYILAN_KAPSAM;
  if (!KAPSAMLAR.includes(kapsam)) {
    kisaOnbellek(res);
    res.status(400).json({
      error: 'bad_kapsam', izinli: [...KAPSAMLAR], gelen: kapsam, uyari: UYARI,
    });
    return;
  }

  const { limit, hata: lHata, gelen: lGelen } = ayristirLimit(q.limit);
  if (limit == null) {
    kisaOnbellek(res);
    res.status(400).json({
      error: lHata, alan: 'limit', asgari: 1, azami: AZAMI_MADDE, gelen: lGelen, uyari: UYARI,
    });
    return;
  }

  const t0 = Date.now();
  const yereller = kapsamYerelleri(kapsam);
  const madenAnahtar = madenler.map((m) => m.anahtar);
  // Onbellek: api/_kesif.js takvim yolundaki KALIBIN aynisi. Yeni kalip
  // icat edilmedi. TTL `_onbellek.js:TTL_FIYAT` (300 sn) — asagida
  // yayinlanan `max-age=300` ile AYNI sayi.
  const obAnahtar = anahtar('metal', { madenler: madenAnahtar, kapsam, limit });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    // Sayac api/_haber.js'in kabi (`bosHaberSayac`) — ikinci bir sayac
    // bicimi uretilmedi, haber uclerinin sayaci ile AYNI alanlar.
    const sayac = bosHaberSayac();
    // En cok 6 istek, TEK turda paralel. `allSettled`: bir besleme
    // patlarsa otekiler basilmaya devam eder.
    const isler = [];
    for (const m of madenler) for (const y of yereller) isler.push({ m, y });
    const sonuc = await Promise.allSettled(isler.map((i) => madenYerel(i.m, i.y, { limit, sayac })));

    const satirHarita = new Map();
    for (const m of madenler) {
      const satir = { maden: m.anahtar, ysym: m.ysym };
      // YALNIZ istenen yereller alan aliyor (ucuncu durum: alan yoksa
      // istenmemistir).
      for (const y of yereller) satir[y] = [];
      satirHarita.set(m.anahtar, satir);
    }
    let okunan = 0;
    for (let i = 0; i < isler.length; i++) {
      const s = sonuc[i];
      const satir = satirHarita.get(isler[i].m.anahtar);
      if (s.status !== 'fulfilled' || !s.value) { sayac.hata++; continue; }
      const maddeler = Array.isArray(s.value.maddeler) ? s.value.maddeler : [];
      satir[isler[i].y] = maddeler;
      // OLCULEN ARIZA (duzeltildi): burada eskiden `s.value.tam` okunuyordu.
      // `beslemeCek` `tam`i PAYLASILAN sayactan uretiyor (`_haber.js:330`
      // `tam: haberTam(sayac)`), yani 6 paralel beslemeden BIRI dustugu an
      // ondan SONRA biten her cagri `tam:false` donuyordu -> 5 besleme
      // okunmusken `okunan === 0` ve 502. Sayim artik `_haber.js:521`
      // `gundemCek`in OLCULMUS kalibiyla ayni: madde sayisi.
      if (maddeler.length > 0) okunan++;
    }

    // HICBIRI okunamadiysa bu bir olcum degil, kesinti.
    if (okunan === 0) {
      kisaOnbellek(res);
      res.status(502).json({
        error: 'metal_alinamadi', madenler: madenAnahtar, kapsam, sayac, uyari: UYARI,
      });
      return;
    }

    const govde = {
      madenler: madenAnahtar,
      kapsam,
      limit,
      // Madde alan listesi CEVAPTA: istemci hangi alanlara guvenebilecegini
      // sozlesmeden okur, surukleme sessiz kalmaz.
      maddeAlanlari: [...MADDE_ALANLARI],
      satirlar: madenler.map((m) => satirHarita.get(m.anahtar)),
      sayac,
      tam: haberTam(sayac),
      uyari: UYARI,
    };
    // YALNIZ `tam` govde onbellege yaziliyor (takvim yolu ile ayni kural).
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, ms: Date.now() - t0 });
  } catch (e) {
    // Yigin SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_metal:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'metal_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'metal';
export const HANDLERLAR = Object.freeze({ metal: metalHandler });
