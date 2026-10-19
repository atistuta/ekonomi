// ===========================================================================
//  /api/chart — FİYAT SERİSİ (mum) uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NEDEN BU AD: üç seçenek vardı ve ölçülerek seçildi.
//    (a) /api/ohlc  — motordaki fonksiyon adı (`fetchYahooOHLC`), ama
//        kullanıcı yüzeyinde "OHLC" diye bir şey yok; ekranda "grafik" var.
//    (b) /api/price — tek fiyat sanılır; bu uç SERİ döndürüyor, üstelik
//        anlık fiyat ZATEN /api/score gövdesinde (`fa.price`) geliyor.
//    (c) /api/chart — SEÇİLDİ. Üst kaynağın yolu da bu
//        (`query1.finance.yahoo.com/v8/finance/chart/...`, _motor.js:106),
//        ELITE_ROADMAP'teki açık madde de "grafik" diye yazılı. Yerli
//        istemci bu seriyle grafik ÇİZİYOR; ad işi anlatıyor.
//
//  NE: ham mum dizisi + seçilmiş üst-kaynak künyesi. BAŞKA HİÇBİR ŞEY.
//  Bu uç skor zincirinin (/api/score ⊂ recommend ⊂ analyze ⊂ compare)
//  İÇİNDE DEĞİL, YANINDA: skoru ne okur ne yazar, tek bir eşik ya da
//  ağırlık taşımaz. Zincire sokulsaydı her skor isteği gereksiz yere
//  yüzlerce mumu tele çıkarırdı.
//
//  MOTOR MANTIĞI YENİDEN YAZILMADI — ÖLÇÜLDÜ, SONRA YAZILDI (2026-10-19):
//  `api/_motor.js` ZATEN `fetchYahooOHLC(symbol, market, range, interval)`
//  dışa veriyordu (EXPORTS'un ilk adı). Bu yüzden bu uç için app.js'e
//  DOKUNULMADI ve motor BU UÇ İÇİN yeniden üretilmedi. Adres kurma,
//  `^GSPC` → `%5EGSPC` kaçışı, 5 dakikalık `_t` kovası, null mum ayıklama
//  — hepsi motorda. Burada kalan iş: kapı, sınır, önbellek, künye süzme.
//
//  app.js'teki `fetchYahooChart` BU UCUN KAYNAĞI DEĞİL: o fonksiyon
//  tarayıcı vekiline (`proxy`) ve teşhis satırına (`setDiag`) bağlı,
//  yani sunucuda koşamaz. Motordaki sürüm dilimlenmiş ve parite altında
//  ölçülen sürümdür.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): gövdede Intl/toFixed/
//  yüzde/para simgesi YOK. Mumlar ham sayı; künyeden yalnız SAYI ve
//  MAKİNE KODU alanları geçiyor (`KUNYE_ALANLARI`). SVG çizimi, eksen
//  etiketi, para simgesi ve tr-TR biçimlemesi İSTEMCİDE kalıyor — serisi
//  tele çıkan bir grafik, cümlesi tele çıkan bir grafik değildir.
//
//  SINIRLAR BURADA, `_girdi.js`te DEĞİL (causal.js'in kurduğu kalıp):
//  `range`/`interval` yalnız bu ucun sorunudur, öteki beş uç bu
//  parametreleri hiç görmez. Ortak kapıya konsa hepsinin sözleşmesini
//  kirletirdi. Sembol temizliği ise ORTAK: `temizleSembol` çağrılıyor,
//  yerel kopya YOK.
//
//  TEK SEMBOL: çok sembollü grafik İSTEMCİNİN işi (n istek, paralel).
//  Tek gövdede 8 sembol × 1250 mum ≈ megabaytlarca JSON olurdu ve süre
//  freni ortasında yarısı eksik dönerdi. Çok sembol AÇIKÇA reddediliyor
//  (`cok_sembol`), sessizce ilki alınmıyor — sessiz kırpma istemcinin
//  farketmediği eksik veridir.
//
//  ENDEKS (^GSPC, ^XU100) BU UÇTAN İSTENEMEZ — ÖLÇÜLDÜ, GİZLENMİYOR:
//  ortak `SEMBOL_BICIM` (_girdi.js) '^' kabul etmiyor. Motor endeksi
//  çizebilir (yahooSymbol kaçışı var, app.js 'RAW' pazarıyla çağırıyor)
//  ama biçimi burada genişletmek ALTI UCUN sembol sözleşmesini
//  değiştirmek olurdu. Ayrı bir iş; ELITE_ROADMAP'te AÇIK bırakıldı.
//
//  SÖZLEŞME
//    GET /api/chart?symbol=AAPL[&market=US][&range=6mo][&interval=1d]
//      symbol   tek sembol (AAPL · THYAO.IS · ASELS:BIST)
//      range    ARALIKLAR kümesinden (varsayılan 6mo — motorun kendi
//               varsayılanı, _motor.js:103)
//      interval ADIMLAR kümesinden (varsayılan 1d)
//    Cevap 200: { sym, market, range, interval, mumlar[], adet, kunye,
//                 sayac, tam, surum, ms, uyari }
//      mumlar[i] = { time, open, high, low, close, volume } — HAM sayı,
//                  `time` saniye cinsinden UNIX damgası (üst kaynağın
//                  verdiği gibi; ms'e çevirmek biçimleme sayılır).
//      kunye     = üst-kaynak künyesinin SÜZÜLMÜŞ hâli (KUNYE_ALANLARI).
//      adet      = mumlar.length — istemci boş seriyi alan okumadan görsün.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'grafik_alinamadi', uyari }   (içeriden gelen
//               hata METNİ İSTEMCİYE GİTMEZ; yalnız sunucuya loglanır)
//
//  BOŞ SERİ ARIZA DEĞİL: yeni halka arz ya da kapalı pazar günü 0 mum
//  döndürebilir. O hâlde 200 + `mumlar: []` + `adet: 0` dönüyoruz ve
//  pencereyi kısaltıyoruz — "veri yok" ile "ölçemedim" karıştırılmıyor
//  (_ag.js sayaç ayrımının aynı fikri).
//
//  BEŞ PARÇA, ALTINCI TAŞIYICI YOK: _motor · _ayar · _ag · _girdi ·
//  _onbellek. Burada eşik, ağırlık ya da çarpan YOK.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';

// DİKKAT — `export { ... } from` YETMEZ: yerel bağlama yaratmaz, handler
// `temizleSembol`ü çağırıyor. (Gerekçe: api/analyze.js:190.)
import { AZAMI_SORGU, PAZARLAR, temizleSembol } from './_girdi.js';
export { AZAMI_SORGU, PAZARLAR, temizleSembol };

// ÖNBELLEK — uçların PAYLAŞTIĞI taşıyıcı; bu dosyada kopya mantık YOK.
// TTL gerekçesi (ve bu uç için "iç gün TTL'si neden İCAT EDİLMEDİ")
// orada yazılı: api/_onbellek.js.
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// ---------------------------------------------------------------------
//  ARALIK / ADIM KÜMELERİ — UYDURULMADI, app.js'ten SAYILDI (2026-10-19).
//  `grep -n 'fetchYahooOHLC(' app.js` → 16 çağrı noktası, kullanılan
//  bütün değerler:
//    aralık : 1d (gün içi tarama) · 1mo · 3mo · 6mo (motor varsayılanı) ·
//             1y (künye okuma) · 5y (vade skoru + uzun seri)
//    adım   : 5m (gün içi) · 15m · 60m · 1d (her şey)
//  Üst kaynak başka değerler de kabul eder (2d, 1wk, max...). BİLEREK
//  dışarıda: ekranın hiç istemediği bir aralığı açmak, ölçülmemiş bir
//  yükü (ve 'max' ile sınırsız gövdeyi) kapıdan içeri almak olurdu.
//  Yeni bir değer gerektiğinde ÖLÇÜLÜP buraya eklenir.
// ---------------------------------------------------------------------
export const ARALIKLAR = ['1d', '1mo', '3mo', '6mo', '1y', '5y'];
export const ADIMLAR = ['5m', '15m', '60m', '1d'];

// Motorun kendi varsayılanlarıyla AYNI (_motor.js:103) — uç, motorun
// imzasını değiştirmiyor, yalnız aynı varsayılanı yayınlıyor.
export const VARSAYILAN_ARALIK = '6mo';
export const VARSAYILAN_ADIM = '1d';

// ---------------------------------------------------------------------
//  KÜNYE SÜZGECİ — üst kaynağın `meta`sı OLDUĞU GİBİ geçirilmiyor.
//  İki sebep ÖLÇÜLDÜ: ① `meta` içinde `validRanges`, `currentTradingPeriod`,
//  `tradingPeriods` gibi onlarca satır var — istemcinin çizim için
//  kullanmadığı yüzlerce bayt. ② Üst kaynak yarın yeni bir alan
//  eklediğinde sözleşmemiz sessizce büyümesin: tele ÇIKAN alan kümesi
//  BURADA yazılı olsun. Hepsi SAYI ya da MAKİNE KODU — cümle yok.
// ---------------------------------------------------------------------
export const KUNYE_ALANLARI = [
  'currency', 'symbol', 'exchangeName', 'instrumentType',
  'firstTradeDate', 'regularMarketTime', 'gmtoffset', 'timezone',
  'exchangeTimezoneName', 'regularMarketPrice', 'chartPreviousClose',
  'previousClose', 'scale', 'priceHint',
  'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
  'dataGranularity', 'range',
];

/**
 * Künyeyi süz. SAF: ağa çıkmaz, motora dokunmaz. Bu yüzden dışa
 * aktarılıyor — tests/uc-test.mjs fikstürle ölçebiliyor.
 */
export function suzKunye(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const o = {};
  for (const ad of KUNYE_ALANLARI) {
    const v = meta[ad];
    if (v === undefined || v === null) continue;
    // Yalnız ilkel değer: iç içe nesne/dizi (tradingPeriods gibi)
    // sözleşmeye GİRMEZ.
    const t = typeof v;
    if (t === 'number' || t === 'string' || t === 'boolean') o[ad] = v;
  }
  return o;
}

// maxDuration 10 · ÖLÇÜLEN gerekçe: bu uç TEK bir dış istek yapıyor
// (Yahoo chart adresi, _ag.js `cek` zaman aşımı altında). /api/score'un
// 30-60 sn kademesi burada anlamsız olurdu: 33 istek değil 1 istek var.
// /api/causal ile aynı kademe, farklı sebep (orada 0 istek vardı).
export const config = { runtime: 'nodejs', maxDuration: 10 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/score.js).
// ---------------------------------------------------------------------
let AG = null;
let ENG = null;
let KURULUM_HATASI = null;
try {
  AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
  ENG._weights = AG.H.window.TA_WEIGHTS;
  ENG._bench = AG.H.window.TA_BENCHMARK;
} catch (e) {
  KURULUM_HATASI = e;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }

  if (KURULUM_HATASI || !AG || !ENG) {
    console.error('api/chart: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
    kisaOnbellek(res);
    res.status(503).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return;
  }

  const q = req.query || {};

  const ham = String(q.symbol ?? q.symbols ?? '').trim();
  if (!ham) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'symbol_yok', uyari: UYARI });
    return;
  }
  // Uzunluk kapısı ÖTEKİ UÇLARLA aynı sabit (_girdi.js AZAMI_SORGU).
  if (ham.length > AZAMI_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_SORGU, uyari: UYARI });
    return;
  }
  // Çok sembol SESSİZCE KIRPILMAZ, açıkça reddedilir (başlıktaki gerekçe).
  if (ham.includes(',')) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'cok_sembol', azami: 1, uyari: UYARI });
    return;
  }

  const gPazar = String(q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: PAZARLAR, uyari: UYARI });
    return;
  }

  const hedef = temizleSembol(ham, gPazar || 'US');
  if (!hedef) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_symbol', gecersiz: [ham.slice(0, 16)], uyari: UYARI });
    return;
  }

  const range = String(q.range ?? VARSAYILAN_ARALIK).trim();
  if (!ARALIKLAR.includes(range)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_range', izinli: ARALIKLAR, uyari: UYARI });
    return;
  }
  const interval = String(q.interval ?? VARSAYILAN_ADIM).trim();
  if (!ADIMLAR.includes(interval)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_interval', izinli: ADIMLAR, uyari: UYARI });
    return;
  }

  const t0 = Date.now();

  // --- ÖNBELLEK OKUMASI (api/_onbellek.js) ---------------------------
  //  Anahtar MOTOR İMZASINI taşıyor: motor yeniden üretildiği an eski
  //  girdiler kendiliğinden geçersizleşir. `range`/`interval` anahtarın
  //  İÇİNDE — aynı sembolün 5y/1d serisi ile 1d/5m serisi KARIŞAMAZ.
  //  KV yoksa/arızalıysa `oku()` null döner, önbelleksiz devam ederiz.
  const obAnahtar = anahtar(
    'chart',
    { market: hedef.market, sym: hedef.sym, range, interval },
    { motor: IMZA, ayar: IMZA_AYAR },
  );
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    // Pencere TAM yolun penceresiyle BİREBİR aynı — yeni eskilik
    // penceresi icat edilmiyor (TTL_FIYAT = 300 = max-age).
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    AG.yeniTur();
    const sayac = bosSayac();
    AG.odakla(sayac);
    let seri;
    try {
      // Motorun fonksiyonu. Adres, kaçış, `_t` kovası, null mum ayıklama
      // ORADA — burada tek satır çağrı var, kopya mantık yok.
      seri = await ENG.fetchYahooOHLC(hedef.sym, hedef.market, range, interval);
    } finally {
      AG.odakla(null);
    }

    const mumlar = (seri && seri.candles) || [];
    const tam = sayacTam(sayac);

    // Boş seri "ölçemedim" DEĞİL: 200 dönüyoruz ama pencereyi kısa
    // tutuyoruz — birkaç dakika sonra mum gelmiş olabilir.
    if (tam && mumlar.length) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    } else {
      kisaOnbellek(res);
    }

    const govde = {
      sym: hedef.sym,
      market: hedef.market,
      range,
      interval,
      mumlar,
      adet: mumlar.length,
      kunye: suzKunye(seri && seri.meta),
      sayac,
      tam,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    };

    // Yalnız TAM ve DOLU gövde önbellekleniyor: kesintiyi ya da boş
    // seriyi 5 dakika dondurmak, kesinti geçtikten sonra da eski cevabı
    // servis etmek olurdu. Yazma arızası cevabı DÜŞÜRMEZ.
    if (tam && mumlar.length) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.status(200).json(govde);
  } catch (e) {
    // İÇERİDEN gelen metin İSTEMCİYE GİTMEZ (yığın izi / dosya yolu /
    // adres sızmasın) — yalnız sunucu kaydına.
    console.error('api/chart:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'grafik_alinamadi', uyari: UYARI });
  }
}
