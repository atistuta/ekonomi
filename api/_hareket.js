// =====================================================================
//  /api/hareket  —  ⚡ ANİ HAREKET TARAMASI                 (taşıyıcı)
// ---------------------------------------------------------------------
//  NE: verilen sembollerin GÜN İÇİ mumlarını okuyup her biri için
//  "ani hareket mi" ölçümünü döndürür. Web ekranındaki ⚡ Nabız
//  satırlarının (app.js:12843 `pulseScan`) sunucu ikizi.
//
//  NİYE YENİ UÇ: `/api/pulse` MAKRO nabız — faiz/enflasyon manşetinden
//  duruş çıkarıyor. Gün içi hareket taraması orada YOK (ölçüldü
//  2026-11-06: `grep -n "PULSE_TH\|analyzeIntraday\|pulseIsSudden\|
//  hourChg\|rvol\|breakout\|sudden" api/pulse.js` → 0 eşleşme, 855
//  satır). Yani native'in ⚡ satırlarını besleyecek hiçbir uç yoktu;
//  ölçüm yalnız TARAYICIDA yaşıyordu.
//
//  MOTOR ÜRETİMİ GEREKMEDİ (ölçüldü 2026-11-06): `PULSE_TH`
//  (api/_motor.js:2422), `analyzeIntraday` (:2431) ve `pulseIsSudden`
//  (:2451) ZATEN motor dışa-aktarma listesinde (api/_motor.js:3922).
//  Bu uç onları olduğu gibi çağırıyor; eşik İKİNCİ KEZ YAZILMADI,
//  `app.js` ve `tools/motor-uret.mjs` ÇALIŞTIRILMADI.
//
//  HAM SAYI KURALI (§5.1): bu uç TÜRKÇE CÜMLE DÖNDÜRMEZ. Dönen her
//  karar KAPALI KOD KÜMESİNDEN bir dizge (`ani`, `buyuk_gun`,
//  `kirilma`), gerisi HAM SAYI. Cümleyi web kendi ekranında, native
//  `mobile/src/lib/sozluk.ts` içinde seçiyor. Tek Türkçe alan `uyari`.
//
//  EŞİK CEVABA GİRMEZ: `pulseIsSudden` dönüşündeki `th` nesnesi
//  BİLİNÇLİ OLARAK dışarı verilmiyor. Eşik motorun ayarı; istemciye
//  göndermek onu istemci-düzeyi bir sayı gibi gösterirdi ve ikinci bir
//  karar yeri doğurur.
//
//  HACİM YORUMU YOK (bu turda ÖLÇÜLMEDİ): web ekranı `r.a.rvol >= 1.5`
//  diye bir EKRAN eşiği taşıyor (app.js:12887 → "🔊 Hacim …×"). O eşik
//  motorda YOK. Buraya kopyalamak §5.1'i kırardı (uçta eşik yok),
//  native'e koymak da (native'de matematik yok). Bu yüzden uç `rvol`u
//  HAM döndürüyor, kod üretmiyor; yorum motora bir kod eklendiğinde
//  gelecek.
//
//  KAPSAM: BIST + US. Kripto ve maden BİLİNÇLİ OLARAK YOK —
//  `api/_girdi.js:73` `PAZARLAR = ['US','BIST']`, kriptonun Yahoo
//  sembolü `-USD` ekiyle kuruluyor (app.js `BM_CRYPTO`) ve madenin
//  `ysym`i `METAL_SPOT` kataloğundan geliyor; ikisi de bu uçta
//  tanımlı değil. Uydurma eşleme yazmak yerine kapsam dışı bırakıldı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { buildMotor } from './_motor.js';
import { IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';
import { temizleSembol } from './_girdi.js';
import { yahooSembol, izinliAdres, IZINLI_KONAK } from './_degisim.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ÖLÇÜLDÜ api/_degisim.js:
//   istek süresi 8000 ms (oradaki gerekçe api/poll.js:228),
//   kısa gövde eşiği 256 bayt, azami sembol 12, eşzamanlı 4.
// Aynı yukarı-akış (Yahoo chart) olduğu için AYNI sayılar; ikinci bir
// zamanlama tablosu uydurulmadı.
export const HAREKET_ISTEK_MS = 8000;
export const ASGARI_GOVDE_BAYT = 256;
export const AZAMI_SEMBOL = 12;
export const ESZAMANLI = 4;
export const KONAK_DENEME = IZINLI_KONAK.length;
// KONAK IZIN LISTESI IKIZLIGI: ⑰c kapisi `MOD[r].IZINLI_KONAK`i
// okuyor. Liste kendi dosyamizda UYDURULMADI — `_degisim.js`in
// listesi oldugu gibi gecirildi; ayrisma imkansiz.
export { IZINLI_KONAK, izinliAdres };

// GÜN İÇİ PENCERE: web `pulseScan` 5 dakikalık barla çalışıyor ve
// `analyzeIntraday` "~60 dk" hesabını 12 bar geriye giderek yapıyor
// (api/_motor.js:2438) — yani ADIM 5 DAKİKA OLMAK ZORUNDA, başka adımda
// o yorum yanlış olurdu. Aralık 1 gün: motor en az 3 bar istiyor.
export const GUNICI_ARALIK = '1d';
export const GUNICI_ADIM = '5m';

// Kapalı kod kümesi — cevapta dönen TEK karar dizgeleri.
export const HAREKET_KODLARI = Object.freeze(['ani', 'buyuk_gun', 'kirilma']);

/** Pazar → `PULSE_TH` anahtarı. Kapsam BIST+US olduğu için birebir. */
function esikAnahtari(market) {
  return market === 'BIST' ? 'BIST' : 'US';
}

export function bosHareketSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Tur tam mı — tek bir arıza bile `false`. */
export function hareketTam(s) {
  return !!s && s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

// ---------------------------------------------------------------------
//  MOTOR. Gerekçe api/_neden.js:110 ile aynı: motor bölünmez bir bütün,
//  bu uç yalnız gün içi kümesini kullansa da ağırlıklar öteki uçlarla
//  AYNI biçimde takılıyor.
// ---------------------------------------------------------------------
let ENG = null;
let KURULUM_HATASI = null;
try {
  const AG = canliAg({ TA_WEIGHTS, TA_BENCHMARK });
  ENG = buildMotor(AG.H);
} catch (e) {
  KURULUM_HATASI = e;
}

export function motorHazir() {
  return !!(ENG && !KURULUM_HATASI);
}

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

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

/** Chart adresi — gün içi mum. SAF. */
export function guniciAdresi(ysym, konak = IZINLI_KONAK[0]) {
  if (!ysym || !IZINLI_KONAK.includes(konak)) return null;
  return `https://${konak}/v8/finance/chart/${encodeURIComponent(ysym)}`
    + `?range=${encodeURIComponent(GUNICI_ARALIK)}&interval=${encodeURIComponent(GUNICI_ADIM)}`;
}

function sayi(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Mum serisi + meta ayrıştır.
 *
 * NİYE `_degisim.js`in `ayristirSeri`si KULLANILMADI: o yalnız
 * `{time, close}` döndürüyor (ölçüldü api/_degisim.js:225). `analyzeIntraday`
 * `high` ve `volume` da istiyor (api/_motor.js:2440-2443) — eksik alanla
 * çağırmak `rvol`u 0, `priorHigh`ı `NaN` yapardı, yani ÖLÇÜLMEMİŞ sayıyı
 * ölçülmüş gibi gösterirdi.
 *
 * Süzme web `fetchYahooOHLC` ile AYNI (app.js:567): open/high/low/close
 * dördü de dolu olmayan bar DÜŞER. `volume` eksikse bar DÜŞMEZ, hacmi 0
 * olur — motor sıfır hacimleri ortalamadan kendisi atıyor
 * (api/_motor.js:2441 `.filter((v) => v > 0)`).
 *
 * SAF. Gövde bozuksa boş seri + boş meta; istisna FIRLATMAZ.
 */
export function ayristirGunici(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  const m = (r && r.meta) || {};
  const ts = (r && r.timestamp) || [];
  const q = (r && r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const mumlar = [];
  for (let i = 0; i < ts.length; i++) {
    const c = q.close ? q.close[i] : null;
    const o = q.open ? q.open[i] : null;
    const h = q.high ? q.high[i] : null;
    const l = q.low ? q.low[i] : null;
    if (c == null || o == null || h == null || l == null) continue;
    const t = sayi(ts[i]);
    if (t == null) continue;
    const v = q.volume ? sayi(q.volume[i]) : null;
    mumlar.push({ time: t, open: o, high: h, low: l, close: c, volume: v == null ? 0 : v });
  }
  const mts = sayi(m.regularMarketTime);
  return {
    mumlar,
    meta: {
      regularMarketPrice: sayi(m.regularMarketPrice),
      chartPreviousClose: sayi(m.chartPreviousClose),
      currency: typeof m.currency === 'string' ? m.currency : null,
      marketTs: mts == null ? null : mts * 1000,
    },
  };
}

// ---------------------------------------------------------------------
//  AĞA ÇIKAN TEK YER. Zaman aşımı AbortController ile; konak sırayla
//  denenir (query1 → query2), AYNI konağa ikinci vuruş YOK.
// ---------------------------------------------------------------------
async function guniciCek(ysym, sec = {}) {
  const sayac = sec.sayac || bosHareketSayac();
  for (let k = 0; k < KONAK_DENEME; k++) {
    const adres = guniciAdresi(ysym, IZINLI_KONAK[k]);
    if (!adres || !izinliAdres(adres)) { sayac.hata++; return null; }
    const kesici = new AbortController();
    const zamanlayici = setTimeout(() => kesici.abort(), HAREKET_ISTEK_MS);
    sayac.istek++;
    try {
      const r = await fetch(adres, {
        signal: kesici.signal,
        headers: {
          // KİŞİSEL E-POSTA YOK. Kimlik dizgesi ölçülmeden değiştirilmez.
          'User-Agent': 'day-starter/1.0 (hareket-okuyucu)',
          'Accept': 'application/json',
        },
      });
      clearTimeout(zamanlayici);
      if (!r.ok) { sayac.hata++; continue; }
      const metin = await r.text();
      const bayt = Buffer.byteLength(metin, 'utf8');
      sayac.bayt += bayt;
      // 200 ama gövde kısa = ölçüm değil, arıza.
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
 * TEK sembolün satırını üret.
 *
 * `kodlar` kapalı kümeden: `ani` (motorun `sudden`i), `buyuk_gun`
 * (`bigDay`), `kirilma` (`breakout`). Motor `null` döndürdüyse (3 mumdan
 * az) satır `ok:false` ve BÜTÜN sayılar `null` — 0 YAZILMAZ.
 *
 * @param {{sym:string, market:string}} hedef
 */
export async function sembolHareket(hedef, sec = {}) {
  const sayac = sec.sayac || bosHareketSayac();
  const ysym = yahooSembol(hedef.sym, hedef.market);
  const json = await guniciCek(ysym, { sayac });
  const temel = {
    symbol: hedef.sym,
    market: hedef.market,
    ysym,
    // BIST verisi Yahoo'da gecikmeli gelir (api/_degisim.js ile aynı
    // bayrak). MAKİNE BAYRAĞI, cümle değil.
    gecikmeli: hedef.market === 'BIST',
    ok: false,
    price: null,
    prevClose: null,
    currency: null,
    marketTs: null,
    gunYuzde: null,
    saatYuzde: null,
    rvol: null,
    mumSayisi: null,
    kodlar: [],
  };
  if (!json) return { satir: temel, sayac };

  const { mumlar, meta } = ayristirGunici(json);
  temel.currency = meta.currency;
  temel.marketTs = meta.marketTs;
  temel.mumSayisi = mumlar.length;

  const a = ENG.analyzeIntraday(mumlar, meta);
  // Motor ölçemediyse (3 mumdan az) UYDURMA YOK: `ok:false`, sayılar null.
  if (!a) return { satir: temel, sayac };

  const s = ENG.pulseIsSudden(a, esikAnahtari(hedef.market));
  const kodlar = [];
  if (s.sudden) kodlar.push('ani');
  if (s.bigDay) kodlar.push('buyuk_gun');
  if (a.breakout) kodlar.push('kirilma');

  return {
    satir: {
      ...temel,
      ok: true,
      price: sayi(a.price),
      prevClose: sayi(a.prevClose),
      gunYuzde: sayi(a.dayChg),
      saatYuzde: sayi(a.hourChg),
      // `rvol` HAM: yorumu (web'in 1.5 eşiği) motorda olmadığı için
      // kod ÜRETİLMİYOR — başlıkta yazılı.
      rvol: sayi(a.rvol),
      // `spark` BİLİNÇLİ OLARAK DIŞARIDA: her sembolde ~78 nokta,
      // 12 sembolde ~936 nokta gövdeyi şişirirdi ve ⚡ satırı grafik
      // çizmiyor. Grafik `/api/chart` uçunda.
      kodlar,
    },
    sayac,
  };
}

// =====================================================================
//  /api/hareket  —  GET
// =====================================================================
//  SÖZLEŞME
//    GET /api/hareket?semboller=THYAO:BIST,AAPL
//    200 -> { semboller:[...], satirlar:[satir...], aniSayisi, sayac,
//             tam, ms, imza, uyari }
//    400 -> semboller_yok | bad_sembol (`gelen`) | cok_sembol (`azami`)
//    405 -> method_not_allowed (Allow başlığıyla)
//    502 -> motor_yok | hareket_alinamadi (İSTENEN SEMBOLLERİN HEPSİ)
// ---------------------------------------------------------------------
export async function hareketHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const t0 = Date.now();

  if (!motorHazir()) {
    console.error('api/_hareket: motor kurulamadi:', (KURULUM_HATASI && KURULUM_HATASI.stack) || KURULUM_HATASI);
    kisaOnbellek(res);
    res.status(502).json({ error: 'motor_yok', uyari: UYARI });
    return;
  }

  try {
    const ham = String((req.query && req.query.semboller) || '').trim();
    if (!ham) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'semboller_yok', uyari: UYARI });
      return;
    }
    const parcalar = ham.split(',').map((s) => s.trim()).filter(Boolean);
    // SESSİZ KIRPMA YOK: sınırı aşan istek 400 alıyor, ilk 12'si
    // ölçülüp gerisi sessizce düşmüyor (api/_degisim.js ile aynı karar).
    if (parcalar.length > AZAMI_SEMBOL) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'cok_sembol', azami: AZAMI_SEMBOL, gelen: parcalar.length, uyari: UYARI });
      return;
    }
    const semboller = [];
    for (const p of parcalar) {
      const c = temizleSembol(p, 'US');
      if (!c) {
        kisaOnbellek(res);
        res.status(400).json({ error: 'bad_sembol', gelen: p, uyari: UYARI });
        return;
      }
      semboller.push(c);
    }

    const sembolAnahtar = semboller.map((s) => `${s.sym}:${s.market}`).join(',');
    const obAnahtar = anahtar('hareket', { semboller: sembolAnahtar }, { motor: IMZA, ayar: IMZA_AYAR });
    const obVurus = await oku(obAnahtar);
    if (obVurus) {
      res.setHeader('X-Onbellek', 'isabet');
      // GÜN İÇİ ÖLÇÜM ÇABUK BAYATLAR: `TTL_FIYAT` (300 sn) ile aynı
      // pencere, `/api/degisim` ile birebir.
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
      res.status(200).json(obVurus);
      return;
    }
    res.setHeader('X-Onbellek', 'iska');

    const sayac = bosHareketSayac();
    const satirlar = [];
    for (let i = 0; i < semboller.length; i += ESZAMANLI) {
      const dilim = semboller.slice(i, i + ESZAMANLI);
      const sonuc = await Promise.allSettled(dilim.map((h) => sembolHareket(h, { sayac })));
      for (let j = 0; j < sonuc.length; j++) {
        const r = sonuc[j];
        if (r.status === 'fulfilled') {
          satirlar.push(r.value.satir);
        } else {
          // SEMBOL SIRASI BOZULMASIN: reddedilen sembol de satır üretiyor.
          sayac.hata++;
          const h = dilim[j];
          satirlar.push({
            symbol: h.sym, market: h.market, ysym: yahooSembol(h.sym, h.market),
            gecikmeli: h.market === 'BIST', ok: false,
            price: null, prevClose: null, currency: null, marketTs: null,
            gunYuzde: null, saatYuzde: null, rvol: null, mumSayisi: null, kodlar: [],
          });
        }
      }
    }

    if (!satirlar.some((s) => s.ok)) {
      kisaOnbellek(res);
      res.status(502).json({
        error: 'hareket_alinamadi',
        semboller: semboller.map((s) => `${s.sym}:${s.market}`),
        sayac, uyari: UYARI,
      });
      return;
    }

    const govde = {
      semboller: semboller.map((s) => `${s.sym}:${s.market}`),
      satirlar,
      // ÖLÇÜLEN sayı: kaç satırda `ani` kodu var. Ekran "N ani hareket"
      // cümlesini bu sayıdan kuruyor; cümle burada DEĞİL.
      aniSayisi: satirlar.filter((s) => s.kodlar.includes('ani')).length,
      kodlar: HAREKET_KODLARI,
      sayac,
      tam: hareketTam(sayac),
      ms: Date.now() - t0,
      imza: { motor: IMZA, ayar: IMZA_AYAR },
      uyari: UYARI,
    };
    // EKSİK TUR ÖNBELLEĞE GİRMEZ: yarım ölçüm 5 dakika boyunca tam
    // ölçüm gibi dağıtılırdı.
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(govde);
  } catch (e) {
    console.error('api/_hareket:', e.stack || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'hareket_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'hareket';
export const HANDLERLAR = Object.freeze({ hareket: hareketHandler });
