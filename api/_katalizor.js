// =====================================================================
//  api/_katalizor.js  —  "Katalizör / Risk" TAŞIYICI UCU
// =====================================================================
//  SÖZLEŞME
//    GET /api/katalizor?symbol=THYAO:BIST
//    GET /api/katalizor?symbol=AAPL&market=US
//    200 -> { sembol, pazar, ysym, temettu, kodKumeleri, atilan,
//             sayac, tam, surum, onbellek, ms, uyari }
//    400 -> symbol_yok | bad_symbol | bad_market (`izinli`)
//    405 -> method_not_allowed (`Allow` başlığıyla)
//    502 -> motor_yok | katalizor_alinamadi
//
//  NİYE VAR: webin "Katalizör / Risk" satırı (`fillCatalysts`, app.js)
//  TARAYICIDA hesaplanıyordu. Native istemci hesap YAPMAZ, eşik
//  TAŞIMAZ — karar motora, hesap buraya taşındı.
//
//  SATIRIN ÜÇ BACAĞI, YALNIZ BİRİ BU UÇTA — ölçülerek bölündü:
//    ① OYNAKLIK  : BU UÇTA YOK. `/api/analyze` satır başına
//                  `oynaklik` + `atrPlan` kodlarını ZATEN basıyor
//                  (api/_akis.js:325) ve native `RiskOdulKart` onları
//                  zaten okuyor. İkinci bir yol açmak aynı ATR'yi iki
//                  kez ölçmek olurdu.
//    ② YAKLAŞAN TEMETTÜ : BU UÇ. Webde gün farkı + `days <= 45`
//                  eşiği tarayıcıdaydı; ikisi de artık motorda
//                  (`katGunFarki`, `katTemettuKod`).
//    ③ HABER UYARISI : sabit bir CÜMLE, hesap değil -> `sozluk.ts`.
//                  Uçtan sabit metin göndermek HAM SAYI kuralını
//                  kırardı.
//
//  EŞİK BURADA DEĞİL: 45 gün MOTORDA (`KAT_TEMETTU_GUN`). Web ekranı
//  AYNI iki fonksiyonu çağırıyor; iki kopya YOK, ayrışma
//  `tests/uretim-test.mjs` + `tests/parity.mjs` ile bekçili.
//
//  HAM SAYI KURALI: bu uç TÜRKÇE CÜMLE DÖNDÜRMEZ. `kod` kapalı
//  kümeden bir dizge (`yakin`/`uzak`/`gecti`); cümleyi web kendi
//  ekranında, native `mobile/src/lib/sozluk.ts` içinde seçer. Tek
//  Türkçe alan `uyari`.
//
//  SKORA GİRMEZ: ne teknik ne temel skor bu kodu okur.
//
//  YENİDEN KULLANIM — ikinci bir sözleşme uydurulmadı:
//    BIST temettü : `_takvim.js` temettuCek + ayristirTemettu
//                   (`/api/takvim?kapsam=temettu` ile AYNI ayrıştırıcı)
//    US temettü   : `_yfin.js` kunyeCek -> künyenin `exDividendTs` /
//                   `dividendTs` alanları (ikinci bir Yahoo yolu yok)
//    karar        : motorun `katGunFarki` / `katTemettuKod` çifti
//
//  ÖLÇÜLMÜŞ ASİMETRİ, SAYIYLA ÖRTÜLMEDİ: iki pazarın ölçtüğü TARİH
//  AYNI tarih değil. BIST kaynağı temettü ÖDEME/dağıtım gününü
//  yayınlıyor; Yahoo künyesi birincil olarak KESİLME gününü
//  (`exDividendTs`) veriyor. Cevapta `tarihTuru` NEYİN ölçüldüğünü
//  bildiriyor (`odeme` | `kesilme`); istemci bunu ekranda ayırabilir.
//
//  ÖLÇÜLMEDİ — bu uca canlı bir istek ATILMADI (yerel DNS kırık,
//  DEVAM.md §12): önbellek isabet oranı ve gerçek maliyet BİLİNMİYOR.
//  Karar 2A gereği önbellek BAŞTAN kurulu, ölçüm yayın sonrasına
//  bırakıldı.
//
//  ÖLÇÜLMEDİ — BIST bacağı TEK bir sembol için bile TÜM takvim
//  sayfasını çekiyor (`temettuCek` sayfa başına çalışıyor, sembol
//  filtresi SONRA uygulanıyor). Sayfanın bayt boyu ve süresi
//  ölçülmedi. Alternatifi ikinci bir ayrıştırıcı yazmaktı — ayrışma
//  riski ağır geldi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ---------------------------------------------------------------------
import { buildMotor } from './_motor.js';
import { IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';
import { temizleSembol } from './_girdi.js';
import { yahooSembol } from './_degisim.js';
import {
  temettuCek, bosTakvimSayac, takvimTam, trTakvimGunu,
  TAKVIM_SAAT_DILIMI, AZAMI_TEMETTU, PARA_BIRIMI,
} from './_takvim.js';
import { kunyeCek } from './_yfin.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyarı metni — öteki uçlarla AYNI değişmez.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

/** Sembol pazarları — `_girdi.js` PAZARLAR ile aynı küme, cevapta yazılı. */
export const PAZARLAR = ['US', 'BIST'];

/**
 * Ölçülen tarihin TÜRÜ — kapalı küme. Pazarlar AYNI tarihi
 * yayınlamıyor (bkz. başlık "ÖLÇÜLMÜŞ ASİMETRİ"), bu yüzden cevap
 * hangisini ölçtüğünü SÖYLÜYOR.
 */
export const TARIH_TURLERI = ['odeme', 'kesilme'];

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/pulse.js).
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
 * Ortak kapı — `_neden.js` `kapi()` ile BİREBİR aynı reddi veriyor.
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
 * `YYYY-MM-DD` -> ms. BIST kaynağı tarihi DİZGE yayınlıyor
 * (`ayristirTemettu` ① kararı: `Date` nesnesi sunucunun diliminde bir
 * GÜN kayabiliyordu), motorun `katGunFarki`ı ise ms okuyor. Dönüşüm
 * burada, takvimin KENDİ diliminde (`TAKVIM_SAAT_DILIMI`) yapılıyor —
 * UTC varsayılsa İstanbul'da gece yarısı geçilen gün bir gün geç
 * ölçülürdü.
 *
 * Bu bir EŞİK ya da türetme DEĞİL, birim dönüşümü: karar yine motorda.
 *
 * SAF. Ölçülemeyen `null` döner, 0 DÖNMEZ (0 = 1970 olurdu).
 *
 * @param {string|null} tarih
 * @returns {number|null} ms
 */
export function isoMs(tarih) {
  if (typeof tarih !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(tarih)) return null;
  const ms = Date.parse(`${tarih}T00:00:00${TAKVIM_SAAT_DILIMI}`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Unix SANİYE -> ms. Yahoo künyesi saniye veriyor (`exDividendTs`
 * yorumu), motor ms okuyor.
 *
 * SAF. `null`/ölçülemeyen -> `null`, ASLA 0.
 * @param {number|null} sn
 * @returns {number|null}
 */
export function saniyeMs(sn) {
  const n = Number(sn);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

/**
 * EN YAKIN GELECEK temettüyü seç — İKİZİ app.js `fillCatalysts`
 * (`.filter((d) => d.date > today).sort(...)[0]`).
 *
 * İKİ AYRILIK, İKİSİ DE GEREKÇELİ:
 *   ① Karşılaştırma `>` DEĞİL `>=`: web `Date` nesnesi karşılaştırıp
 *      BUGÜNÜ dışarıda bırakıyordu, yani "temettü BUGÜN" durumu
 *      ekranda HİÇ görünmüyordu (ölçülmüş bir kayıp). Burada bugün
 *      LİSTEDE, gün farkı `0` olarak ölçülüyor.
 *   ② Atlanan madde sayısı dönüyor (`atilan`) — sessiz kırpma yok.
 *
 * SAF: saati OKUMAZ, çağıran veriyor.
 *
 * @param {object[]} maddeler  `{ tarihMs }` taşıyan kayıtlar
 * @param {number} simdiMs
 * @returns {{madde:object|null, atilan:number, olculemeyen:number}}
 */
export function enYakinGelecek(maddeler, simdiMs) {
  const liste = Array.isArray(maddeler) ? maddeler : [];
  const olcumlu = liste.filter((m) => m && Number.isFinite(m.tarihMs));
  const olculemeyen = liste.length - olcumlu.length;
  const gelecek = olcumlu
    .filter((m) => m.tarihMs >= simdiMs)
    .sort((a, b) => a.tarihMs - b.tarihMs);
  return {
    madde: gelecek.length ? gelecek[0] : null,
    atilan: Math.max(0, gelecek.length - (gelecek.length ? 1 : 0)),
    olculemeyen,
  };
}

/**
 * BIST bacağı: takvim sayfasından YALNIZ bu sembolün maddeleri.
 * @returns {Promise<{maddeler:object[]|null, sayac:object, kaynakTam:boolean}>}
 */
async function bistTemettu(sym, sayac) {
  const bugun = trTakvimGunu(Date.now());
  const r = await temettuCek({ sayac, azami: AZAMI_TEMETTU, bugun });
  if (!r || r.maddeler === null) return { maddeler: null, sayac, kaynakTam: false };
  const maddeler = r.maddeler
    .filter((m) => m && m.symbol === sym)
    .map((m) => ({
      tarih: m.date != null ? m.date : null,
      tarihMs: isoMs(m.date),
      tutar: m.amount != null ? m.amount : null,
      paraBirimi: m.currency != null ? m.currency : PARA_BIRIMI,
      // `yieldPct` YÜZDE PUANI (kaynak böyle yayınlıyor), oran değil.
      verimYuzde: m.yieldPct != null ? m.yieldPct : null,
      odendi: m.paid != null ? m.paid : null,
    }));
  return { maddeler, sayac, kaynakTam: takvimTam(sayac) };
}

/**
 * US bacağı: Yahoo künyesinin temettü tarihleri.
 *
 * `deep: true` GEREKLİ: ödeme günü (`dividendTs`) YALNIZ
 * `calendarEvents` modülünde var ve o modül yalnız derin kipte
 * doluyor (_yfin.js yorumu). Kesilme günü sığ kipte de geliyor ama
 * tek istek için iki kip açmak ikinci bir yol olurdu.
 *
 * SIRA: ödeme günü varsa O ölçülüyor (webin BIST bacağıyla aynı tür),
 * yoksa kesilme gününe düşülüyor. Hangisi ölçüldüyse `tarihTuru`
 * SÖYLÜYOR — sessiz düşüş yok.
 */
async function usTemettu(ysym) {
  const kunyeler = await kunyeCek([ysym], { deep: true });
  const k = (Array.isArray(kunyeler) ? kunyeler : [])[0] || null;
  if (!k || !k.ok) return { maddeler: null, kaynakTam: false, kunye: null };
  const odemeMs = saniyeMs(k.dividendTs);
  const kesilmeMs = saniyeMs(k.exDividendTs);
  const ms = odemeMs != null ? odemeMs : kesilmeMs;
  const tur = odemeMs != null ? 'odeme' : (kesilmeMs != null ? 'kesilme' : null);
  const maddeler = ms == null ? [] : [{
    tarih: null,              // Yahoo gün DİZGESİ vermiyor; uydurulmadı.
    tarihMs: ms,
    tarihTuru: tur,
    // ÖLÇÜLMEDİ, UYDURULMADI: künyede YAKLAŞAN ödemenin tutarı YOK.
    // `dividendRate` YILLIK toplam temettü — buraya yazılsaydı ekranda
    // tek ödeme gibi görünürdü. Alan `null` kalıyor.
    tutar: null,
    paraBirimi: k.currency != null ? k.currency : null,
    // Künyenin `dividendYield`i ORAN, BIST kaynağının `yieldPct`i YÜZDE
    // PUANI. İki birim AYNI alana yazılmıyor.
    verimYuzde: null,
    odendi: null,
  }];
  return { maddeler, kaynakTam: true, kunye: k };
}

export async function katalizorHandler(req, res) {
  const t0 = Date.now();
  if (kapi(req, res, 'GET, OPTIONS')) return;

  const q = req.query || {};
  const ham = String(q.symbol ?? q.sembol ?? '').trim();
  if (!ham) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'symbol_yok', uyari: UYARI });
    return;
  }

  // `pazar` VE `market` ikisi de kabul (gerekce: _iceriden.js:647).
  const gPazar = String(q.pazar ?? q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: PAZARLAR, uyari: UYARI });
    return;
  }

  const hedef = temizleSembol(ham, gPazar || 'US');
  if (!hedef) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_symbol', gelen: ham.slice(0, 16), uyari: UYARI });
    return;
  }

  // Motor yoksa HİÇBİR kod üretilemez. `kod: null` basıp 200 dönmek
  // "ölçtüm, söyleyecek şey yok" yalanı olurdu.
  if (!motorHazir()) {
    console.error('api/_katalizor: motor kurulamadi:', (KURULUM_HATASI && KURULUM_HATASI.stack) || KURULUM_HATASI);
    kisaOnbellek(res);
    res.status(502).json({ error: 'motor_yok', uyari: UYARI });
    return;
  }

  try {
    // ÖNBELLEK BAŞTAN KURULU (karar 2A). TTL kasten KISA (TTL_FIYAT,
    // 300 sn): gün farkı her gün değişiyor, uzun TTL ekranda DONMUŞ
    // bir "gün" sayısı gösterirdi.
    const obAnahtar = anahtar(
      'katalizor',
      { sembol: hedef.sym, pazar: hedef.market },
      { motor: IMZA, ayar: IMZA_AYAR },
    );
    const onbellek = await oku(obAnahtar);
    if (onbellek) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
      res.status(200).json({ ...onbellek, onbellek: true, ms: Date.now() - t0 });
      return;
    }

    const sayac = bosTakvimSayac();
    const bist = hedef.market === 'BIST';
    const ysym = yahooSembol(hedef.sym, hedef.market);
    const bacak = bist
      ? await bistTemettu(hedef.sym, sayac)
      : await usTemettu(ysym);

    const simdiMs = Date.now();
    const sec = enYakinGelecek(bacak.maddeler, simdiMs);
    const m = sec.madde;

    // Gün farkı ve eşik kararı MOTORDA. `m` yoksa ikisi de `null` —
    // 0 BASILMAZ (0 gün geçerli bir ölçüm: temettü BUGÜN).
    const gun = m ? ENG.katGunFarki(m.tarihMs, simdiMs) : null;
    const kod = ENG.katTemettuKod(gun);

    const govde = {
      sembol: hedef.sym,
      pazar: hedef.market,
      ysym,

      // `null` = ölçemedim (kaynak okunamadı) · nesne = ölçtüm.
      // `{ madde: null }` = ölçtüm, yaklaşan temettü YOK.
      temettu: bacak.maddeler === null ? null : {
        tarih: m ? m.tarih : null,
        tarihMs: m ? m.tarihMs : null,
        tarihTuru: m ? (m.tarihTuru != null ? m.tarihTuru : 'odeme') : null,
        gun,
        kod,
        tutar: m ? m.tutar : null,
        paraBirimi: m ? m.paraBirimi : null,
        verimYuzde: m ? m.verimYuzde : null,
        odendi: m ? m.odendi : null,
        // Kaynakta KAÇ kayıt vardı — ekran "tek kayıt mı, liste mi"
        // diye soramasın diye sayı BASILI.
        adet: Array.isArray(bacak.maddeler) ? bacak.maddeler.length : null,
      },

      // Kodun KAPALI olduğunu istemci sözlüğü bu listelerle eşitliyor;
      // küme büyürse sözlük eksik kalır ve kapı kırmızı yanar.
      kodKumeleri: {
        temettu: ENG.KAT_TEMETTU_KODLARI,
        tarihTuru: TARIH_TURLERI,
      },

      // SESSİZ KIRPMA YOK: seçilen dışında kaç gelecek kayıt vardı ve
      // kaç kayıdın TARİHİ okunamadı.
      atilan: sec.atilan,
      tarihiOkunamayan: sec.olculemeyen,

      // BIST bacağının sayacı var (sayfa çekimi); US bacağı künye
      // çağrısının `ok` bayrağıyla ölçülüyor, UYDURMA sayaç YOK.
      sayac: bist ? { takvim: sayac } : { kunye: { ok: !!bacak.kaynakTam } },
      tam: !!bacak.kaynakTam && bacak.maddeler !== null,
      // Kod motorun eşiğine bağlı -> imza TAŞINIYOR.
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      uyari: UYARI,
    };

    // YALNIZ `tam` gövde önbelleğe yazılıyor (gundem/metal/takvim kuralı).
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, onbellek: false, ms: Date.now() - t0 });
  } catch (e) {
    // Yığın SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_katalizor:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'katalizor_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'katalizor';
export const HANDLERLAR = Object.freeze({ katalizor: katalizorHandler });
