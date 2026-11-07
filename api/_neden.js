// =====================================================================
//  api/_neden.js  —  "Neden hareket ediyor?" TAŞIYICI UCU
// =====================================================================
//  SÖZLEŞME
//    GET /api/neden?symbol=THYAO:BIST
//    GET /api/neden?symbol=AAPL&market=US
//    200 -> { sembol, pazar, ysym, fiyat, oncekiKapanis, paraBirimi,
//             gecikmeli, yuzde, hareketKod, yonKod, haberYonKod,
//             uzlasmaKod, haber, basliklar, atilan, sayac, tam,
//             surum, onbellek, ms, uyari }
//    400 -> symbol_yok | bad_symbol | bad_market (`izinli`)
//    405 -> method_not_allowed (`Allow` başlığıyla)
//    502 -> neden_alinamadi  (fiyat kotası okunamadı: hiçbir kod üretilemez)
//
//  NİYE VAR: web bu kartı TARAYICIDA hesaplıyordu (`fillSpWhy`, app.js).
//  Native istemci hesap YAPMAZ — eşik, ağırlık, formül istemciye
//  girmez. Karar uç tarafına taşındı.
//
//  EŞİKLER BURADA DEĞİL: 3.0 / 1.2 / 0.12 ve karar ağacı MOTORDA
//  (`whyHareketKod`, `whyYonKod`, `whyHaberYonKod`, `whyUzlasmaKod`,
//  `whyKutupKod` — app.js `haber-skor` dilimi, _motor.js'e üretiliyor).
//  Web ekranı AYNI fonksiyonları çağırıyor; iki kopya YOK, bu yüzden
//  ayrışma `tests/parity.mjs` + `tests/uretim-test.mjs` ile bekçili.
//
//  HAM SAYI KURALI: bu uç TÜRKÇE CÜMLE DÖNDÜRMEZ. Dönen her karar
//  KAPALI KOD KÜMESİNDEN bir dizge; cümleyi web kendi ekranında,
//  native `mobile/src/lib/sozluk.ts` içinde seçer. Tek Türkçe alan
//  `uyari`.
//
//  SKORA GİRMEZ: ne teknik ne temel skor bu kodları okur. Hareketi
//  haber akışıyla uzlaştıran bir YORUM katmanıdır.
//
//  YENİDEN KULLANIM — ikinci bir sözleşme uydurulmadı:
//    fiyat/önceki kapanış : `_degisim.js` sembolDegisim (YALNIZ `gunluk`
//                           dönemi; ikinci bir Yahoo yolu açılmadı)
//    manşetler            : `_haber.js` haberCek (ikinci RSS ayrıştırıcı yok)
//    duyarlılık           : `news.js` duyarlilikKatmani (puan/sinyal/
//                           başlık kutupluluğu TEK yerde hesaplanıyor)
//    kodlar               : motorun `why*` kümesi
//
//  ÖLÇÜLMEDİ — `news.js`i içe almak o modülün KENDİ motorunu da kuruyor,
//  yani soğuk süreçte buildMotor İKİ kez çalışıyor. Ağ isteği yok, saf
//  kapanış kurulumu; süresi ÖLÇÜLMEDİ. Alternatifi duyarlılık
//  toplamasını İKİNCİ kez yazmaktı — ayrışma riski ağır geldi.
//
//  ÖLÇÜLMÜŞ SAPMA, SAYIYLA ÖRTÜLMEDİ: web puanı `title + description`
//  üzerinden alıyor; taşıyıcının madde alan kümesinde (`_haber.js`
//  MADDE_ALANLARI) `description` YOK. Yani uç puanı webin puanından
//  SAPAR. `haber.alan` NEYİN ölçüldüğünü bildiriyor (`['title']`).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ---------------------------------------------------------------------
import { buildMotor } from './_motor.js';
import { IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';
import { temizleSembol } from './_girdi.js';
import {
  sembolDegisim, DONEMLER, bosDegisimSayac, degisimTam, yahooSembol,
} from './_degisim.js';
import { haberCek, bosHaberSayac, haberTam } from './_haber.js';
import { duyarlilikKatmani, PAZAR_ESLEME, eslemeTam } from './news.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyarı metni — öteki uçlarla AYNI değişmez.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

/** Sembol pazarları — `_girdi.js` PAZARLAR ile aynı küme, cevapta yazılı. */
export const PAZARLAR = ['US', 'BIST'];

/**
 * Manşet sayısı. 12 WEBDEN ALINDI (app.js computeNewsSentiment
 * `fetchRSS(url, 12)`) — yeni bir sayı uydurulmadı.
 */
export const HABER_LIMIT = 12;

/**
 * Tele giden başlık sayısı. 5 WEBDEN ALINDI (computeNewsSentiment
 * `.slice(0, 5)`). Kırpılan sayı `atilan` ile BİLDİRİLİYOR — sessiz
 * kırpma yok.
 */
export const AZAMI_BASLIK = 5;

/** YALNIZ günlük dönem: `prevClose` referanslı tek adres. */
export const GUNLUK_DONEM = Object.freeze(
  DONEMLER.filter((d) => !d.gunici && d.gun <= 1),
);

/**
 * Haber sorgusu — WEBDEN BİREBİR (app.js:9353):
 *   BIST -> `${sym} hisse` · öteki -> `${sym} stock`
 * `news.js` kip ②'nin ÇIPLAK sembol sorgusundan AYRI: orada ekran
 * "bu hissenin haberleri" diyor, burada puanın webin puanıyla
 * karşılaştırılabilir kalması gerekiyor. SAF.
 */
export function haberSorgusu(sym, pazar) {
  return pazar === 'BIST' ? `${sym} hisse` : `${sym} stock`;
}

/**
 * Kayan nokta gürültüsünü döndür (`news.js:418` ile aynı gerekçe ve
 * aynı eşik): 0.1+0.2 tele 0.30000000000000004 olarak gitmesin.
 */
export function round6(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v;
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/pulse.js).
//  Bu uç motorun yalnız `why*` kümesini kullanıyor ama buildMotor
//  bölünmez bir bütün; ağırlıklar yine de takılıyor ki motor nesnesi
//  öteki uçlarla AYNI biçimde kurulsun.
// ---------------------------------------------------------------------
let ENG = null;
let KURULUM_HATASI = null;
try {
  const AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
} catch (e) {
  KURULUM_HATASI = e;
}

/** Motor kuruldu mu — test ağsız ölçebilsin. */
export function motorHazir() {
  return !!(ENG && !KURULUM_HATASI);
}

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

/**
 * Ortak kapı — `_degisim.js` `kapi()` ile BİREBİR aynı reddi veriyor.
 * @returns {boolean} true = cevap verildi, çağıran DURSUN
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
 * Başlık listesini tele indir. `duy.basliklar[i].sira` = `maddeler`
 * dizisindeki indeks; başlık metni/adresi ORADAN okunuyor, ikinci bir
 * kopya tutulmuyor.
 *
 * Sıra WEBDEN: |pol| büyükten küçüğe (app.js computeNewsSentiment).
 * `kutupKod` motorun `whyKutupKod`undan — işaret kararı burada DEĞİL.
 *
 * @returns {{liste:object[], atilan:number}}
 */
export function basliklariIndir(maddeler, duy) {
  const list = Array.isArray(maddeler) ? maddeler : [];
  const kaynak = (duy && Array.isArray(duy.basliklar)) ? duy.basliklar : [];
  const sirali = kaynak
    .slice()
    .sort((a, b) => Math.abs(b.pol || 0) - Math.abs(a.pol || 0));
  const liste = sirali.slice(0, AZAMI_BASLIK).map((b) => {
    const m = list[b.sira] || {};
    return {
      baslik: m.title != null ? m.title : null,
      adres: m.link != null ? m.link : null,
      kaynak: m.source != null ? m.source : null,
      tarih: m.pubDate != null ? m.pubDate : null,
      pol: round6(b.pol),
      kutupKod: ENG ? ENG.whyKutupKod(b.pol) : null,
    };
  });
  return { liste, atilan: Math.max(0, sirali.length - liste.length) };
}

export async function nedenHandler(req, res) {
  const t0 = Date.now();
  if (kapi(req, res, 'GET, OPTIONS')) return;

  const q = req.query || {};
  const ham = String(q.symbol ?? q.sembol ?? '').trim();
  if (!ham) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'symbol_yok', uyari: UYARI });
    return;
  }

  // `pazar` VE `market` ikisi de kabul (gerekce: _iceriden.js:647 —
  // istemci TURKCE anahtar gonderiyor, uc ingilizcesini de biliyor).
  const gPazar = String(q.pazar ?? q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: PAZARLAR, uyari: UYARI });
    return;
  }

  // Endeks/emtia sözlüğü BİLEREK çağrılmıyor: bu kart haber akışıyla
  // hisse hareketini uzlaştırıyor; `^GSPC` için "o hissenin haberi"
  // diye bir şey yok ve `${sym} stock` sorgusu anlamsız olurdu.
  const hedef = temizleSembol(ham, gPazar || 'US');
  if (!hedef) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_symbol', gelen: ham.slice(0, 16), uyari: UYARI });
    return;
  }

  // Pazar → haber yereli SESSİZ VARSAYILANA DÜŞMEZ (news.js:600 kararı).
  if (!eslemeTam(hedef.market)) {
    kisaOnbellek(res);
    res.status(400).json({
      error: 'bad_market', izinli: Object.keys(PAZAR_ESLEME),
      gecersiz: [hedef.market], uyari: UYARI,
    });
    return;
  }

  // Motor yoksa HİÇBİR kod üretilemez. Boş kod dizgesi dönmek
  // "ölçtüm, sakin" yalanı olurdu.
  if (!motorHazir()) {
    console.error('api/_neden: motor kurulamadi:', (KURULUM_HATASI && KURULUM_HATASI.stack) || KURULUM_HATASI);
    kisaOnbellek(res);
    res.status(502).json({ error: 'motor_yok', uyari: UYARI });
    return;
  }

  const sorgu = haberSorgusu(hedef.sym, hedef.market);

  try {
    // ÖNBELLEK BAŞTAN KURULU (karar 2A): bu uç SEMBOL BAŞINA bir Yahoo
    // kotası + bir RSS beslemesi harcıyor; aynı hisseyi açan her
    // istemci aynı pencerede aynı gövdeyi alıyor.
    const obAnahtar = anahtar(
      'neden',
      { sembol: hedef.sym, pazar: hedef.market },
      { motor: IMZA, ayar: IMZA_AYAR },
    );
    const onbellek = await oku(obAnahtar);
    if (onbellek) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
      res.status(200).json({ ...onbellek, onbellek: true, ms: Date.now() - t0 });
      return;
    }

    const fiyatSayac = bosDegisimSayac();
    const haberSayac = bosHaberSayac();

    // PARALEL: iki kaynak birbirini beklemiyor. Bir hisse sayfası
    // açılışında seri çekim iki zaman aşımını üst üste bindirirdi.
    const [fiyatS, haberS] = await Promise.all([
      sembolDegisim(hedef, { donemler: GUNLUK_DONEM, sayac: fiyatSayac }),
      haberCek(sorgu, {
        market: PAZAR_ESLEME[hedef.market],
        limit: HABER_LIMIT,
        sayac: haberSayac,
        symbol: hedef.sym,
      }),
    ]);

    const satir = fiyatS.satir;

    // Kota okunamadıysa fiyat yüzdesi YOK, dolayısıyla hareket kodu da
    // yok. Bu bir ölçüm değil, kesinti: 'olcum_yok' basıp 200 dönmek
    // istemciye "ölçtüm, hareket belirlenemedi" dedirtirdi.
    if (!satir || !satir.ok) {
      kisaOnbellek(res);
      res.status(502).json({
        error: 'neden_alinamadi',
        sembol: hedef.sym,
        pazar: hedef.market,
        sayac: { fiyat: fiyatSayac, haber: haberSayac },
        uyari: UYARI,
      });
      return;
    }

    const maddeler = (haberS && Array.isArray(haberS.maddeler)) ? haberS.maddeler : [];
    const duy = duyarlilikKatmani(maddeler);

    const yuzde = ENG.whyGunlukYuzde(satir.price, satir.prevClose);
    const hareketKod = ENG.whyHareketKod(yuzde);
    const yonKod = ENG.whyYonKod(yuzde);

    // `duy === null` = news.js'in motoru kurulamadı -> duyarlılık
    // ÖLÇÜLEMEDİ. 0/0 ile ağaca girmek 'haber_yok' üretirdi, yani
    // "ölçtüm, yönlü haber yok" — yalan. Ayrı dal:
    const haberYonKod = duy ? ENG.whyHaberYonKod(duy.puan, duy.sinyal) : null;
    const uzlasmaKod = duy
      ? ENG.whyUzlasmaKod(yuzde, duy.puan, duy.sinyal)
      : 'olcum_yok';

    const bas = basliklariIndir(maddeler, duy);

    const govde = {
      sembol: hedef.sym,
      pazar: hedef.market,
      ysym: yahooSembol(hedef.sym, hedef.market),

      fiyat: satir.price,
      oncekiKapanis: satir.prevClose,
      paraBirimi: satir.currency,
      marketTs: satir.marketTs,
      // MAKİNE BAYRAĞI, cümle değil (gerekçe: _degisim.js satır kurulumu).
      gecikmeli: satir.gecikmeli,

      // Yüzde PUAN (oran değil) — `...Pct` alanlarıyla aynı sözleşme.
      yuzde: round6(yuzde),

      // KAPALI KOD KÜMELERİ — cümle istemcide.
      hareketKod,
      yonKod,
      haberYonKod,
      uzlasmaKod,

      // Kodların KAPALI olduğunu istemci sözlüğü bu listelerle
      // eşitliyor; küme büyürse sözlük eksik kalır ve kapı kırmızı yanar.
      kodKumeleri: {
        hareket: ENG.WHY_HAREKET_KODLARI,
        yon: ENG.WHY_YON_KODLARI,
        haberYon: ENG.WHY_HABER_YON_KODLARI,
        uzlasma: ENG.WHY_UZLASMA_KODLARI,
        kutup: ENG.WHY_KUTUP_KODLARI,
      },

      // `null` = ölçemedim (motor yok) · nesne = ölçtüm.
      haber: duy
        ? {
          sorgu,
          puan: duy.puan,
          ham: duy.ham,
          sinyal: duy.sinyal,
          adet: duy.adet,
          cls: duy.cls,
          kod: duy.kod,
          alan: duy.alan,
        }
        : null,
      basliklar: bas.liste,
      // SESSİZ KIRPMA YOK: ekran kaç başlığın listeye girmediğini basar.
      atilan: bas.atilan,

      sayac: { fiyat: fiyatSayac, haber: haberSayac },
      // `tam`: İKİ kaynak da arızasız okundu mu. Haber beslemesi
      // düşerse fiyat kodları yine doğrudur ama uzlaşma kodu eksik
      // bilgiyle kurulmuştur — istemci bunu ayırt edebilsin.
      tam: degisimTam(fiyatSayac) && haberTam(haberSayac),
      // Kodlar motorun eşiklerine bağlı -> imza TAŞINIYOR.
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      uyari: UYARI,
    };

    // YALNIZ `tam` gövde önbelleğe yazılıyor (gundem/metal/takvim kuralı).
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, onbellek: false, ms: Date.now() - t0 });
  } catch (e) {
    // Yığın SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_neden:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'neden_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'neden';
export const HANDLERLAR = Object.freeze({ neden: nedenHandler });
