// =====================================================================
//  /api/yfin SARMALAYICISI — künye · bilanço takvimi · temettü oranı
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `api/_yfin.js` uç noktasının (`/api/yfin?symbols=...&deep=1`)
//  tek ölçülmüş istemci girişi: `fetchYfin()` + cevabın TypeScript
//  karşılığı.
//
//  NEDEN `client.ts`'DE DEĞİL: `client.ts` SKOR ZİNCİRİNİN uçlarını
//  taşıyor (score ⊂ recommend ⊂ analyze ⊂ compare) ve o zincirin ortak
//  kapısı var (`sembolUcu`: 8 sembol, `vade`, 58 sn bütçe). `/api/yfin`
//  o zincirin içinde DEĞİL: hiçbir skora girdi vermez, sembol sınırı
//  farklı (12), `vade` parametresi yok ve bütçesi 30 sn
//  (`api/proxy.js` → `maxDuration: 30`). Aynı kapıya sokmak üç ayrı
//  sözleşmeyi tek imzaya zorlamak olurdu; `client.ts` DEĞİŞTİRİLMEDİ,
//  yalnız içe aktarıldı.
//
//  NEDEN TÜRLER BU DOSYADA: `api/types.ts` skor sözleşmesinin yeri.
//  Yahoo künyesi ayrı bir sözleşme ve ayrı değişiyor; yan yana koymak
//  "hangi alan hangi uçtan geliyor" ayrımını siler.
//
//  ── ÖLÇÜLDÜ (2026-10-25, ÜRETİM) ───────────────────────────────────
//  GET /api/yfin?symbols=AAPL&deep=1            → 200
//  GET /api/yfin?symbols=THYAO.IS,KO&deep=1     → 200
//  Gövde: `{ results: [...] }` — BAŞKA ÜST ALAN YOK.
//    · `tam` YOK, `sayac` YOK → `OlcumEksikRozet` bu uçta KULLANILAMAZ
//      (skor sayacı şekli gelmiyor; uydurmak yalan olurdu). Dürüstlük
//      işareti sembol başına tek alan: `ok`.
//    · `ok:false` gelen sembolde SEMBOL DIŞINDA HİÇBİR ALAN YOK
//      (`api/_yfin.js`: `{ symbol: sym, ok: false }`).
//    · `earnings` YALNIZ `deep=1` ile geliyor (`MODULES_DEEP`
//      = …,calendarEvents,earningsTrend). `deep` yoksa anahtar hiç
//      basılmıyor — bu yüzden tür isteğe bağlı.
//    · `earnings` içinde GELEN alanlar: ts · estimate · epsAvg/High/Low
//      · revAvg/High/Low · numAnalysts · epsGrowth · revGrowth.
//      `parseEarnings` bunların DIŞINDA alan döndürmüyor.
//    · TEMETTÜ ALANLARI — ESKİ NOT GEÇERSİZ (düzeltildi 2026-10-29).
//      Önceki ölçümde temettü tarafında yalnız `dividendYield` vardı.
//      `api/_yfin.js` → `fetchOne` BUGÜN dokuz alan daha basıyor
//      (kaynak okundu, satır 118-128): dividendRate · payoutRatio ·
//      dividendYield5y · trailingAnnualDividendRate ·
//      trailingAnnualDividendYield · lastDividendValue ·
//      lastDividendTs · exDividendTs · dividendTs. Türleri aşağıda,
//      BİRİMLERİYLE (üç ayrı ölçek var — oran / yüzde puanı / para).
//      HÂLÂ GELMEYEN: beyan (ilan) tarihi — Yahoo `quoteSummary`'de yok
//      — ve temettü GEÇMİŞİ (ayrı çağrı: `chart?events=div`). Bu ikisi
//      için alan AÇILMADI; uydurulmuş bir alan olmasın.
//
//  BURADA HESAP YOK: bu dosya hiçbir oranı ölçeklemez, hiçbir skor
//  üretmez. Gelen ham sayı aynen taşınır; biçimleme `lib/format.ts`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  apiGet,
  DEFAULT_TIMEOUT_MS,
  ENDPOINTS,
  type ApiResult,
  type RequestOptions,
} from './client';

/**
 * Uç noktanın sembol sınırı. ÖLÇÜLDÜ — `api/_yfin.js`:
 * `raw.split(',')…slice(0, 12)`.
 *
 * DİKKAT — UÇ KIRPIYOR, REDDETMİYOR: skor zinciri fazla sembolü 400
 * `cok_sembol` ile geri çeviriyor (`api/score.js`), bu uç ise SESSİZCE
 * 12'ye kesiyor. Sessiz kırpma, 15 sembol soran bir ekranda 3 sembolün
 * "ölçülmedi mi, gelmedi mi" ayrımını yok eder. Bu yüzden istek
 * İSTEMCİDE reddediliyor (aşağıda) — kullanıcı neyi sormadığını bilsin.
 */
export const YFIN_AZAMI_SEMBOL = 12;

/**
 * Uç noktanın bütçesi. ÖLÇÜLDÜ — `api/proxy.js` `maxDuration: 30`
 * (yorumu: "yfin'in eski değeriyle AYNI"). Sembol başına bir Yahoo
 * isteği SIRAYLA atılıyor (`for (const sym of symbols)`), yani 12
 * sembol 12 turluk zincir demek. 12 sn'lik varsayılan (`client.ts`
 * `DEFAULT_TIMEOUT_MS`) uzun listede motoru çalışırken keserdi.
 */
export const YFIN_TIMEOUT_MS = 28_000;

/**
 * Yaklaşan bilanço / kazanç künyesi — `parseEarnings` çıktısı.
 * YALNIZ `deep=1` ile gelir.
 *
 * `parseEarnings` `ts == null && epsAvg == null` ise TÜM nesne yerine
 * `null` döndürüyor; o yüzden `earnings` alanı `null` olabilir ve bu
 * "takvim yok" demek, "ölçülemedi" demek DEĞİL.
 */
export type YfinEarnings = {
  /** Sonraki bilanço tarihi — UNIX **SANİYE** (`formatGunAyYil`). */
  ts: number | null;
  /** Tarih kesinleşmemiş (Yahoo tahmini) mi. */
  estimate: boolean;
  /** Analist beklentisi — hisse başı kâr (ham, para birimi `finCurrency`). */
  epsAvg: number | null;
  epsHigh: number | null;
  epsLow: number | null;
  /** Analist beklentisi — gelir (ham). */
  revAvg: number | null;
  revHigh: number | null;
  revLow: number | null;
  /** Beklentiyi veren analist sayısı. */
  numAnalysts: number | null;
  /** Beklenen YoY kâr büyümesi — KESİR (0,07 = %7). Ölçek motorun. */
  epsGrowth: number | null;
  /** Beklenen YoY gelir büyümesi — KESİR. */
  revGrowth: number | null;
};

/**
 * Tek sembolün künyesi. `ok:false` ise SEMBOL DIŞINDA HİÇBİR ALAN
 * GELMEZ (ölçüldü) — bu yüzden geri kalan her alan isteğe bağlı.
 * `ok`a bakmadan okuyan kod derlemede yakalanır.
 */
export type YfinKunye = {
  symbol: string;
  /** `false` → bu sembolün künyesi ÖLÇÜLEMEDİ (Yahoo turu düştü). */
  ok: boolean;
  /** Yalnız `deep=1`. `null` → takvim yok (veri cevabı). */
  earnings?: YfinEarnings | null;
  name?: string | null;
  /** İşlem/kotasyon para birimi (ADR → USD). */
  currency?: string | null;
  /** Raporlama para birimi — gelir/kâr alanları BUNDA. */
  finCurrency?: string | null;
  sector?: string | null;
  industry?: string | null;
  bizSummary?: string | null;
  country?: string | null;
  website?: string | null;
  trailingPE?: number | null;
  forwardPE?: number | null;
  peg?: number | null;
  priceToBook?: number | null;
  priceToSales?: number | null;
  evEbitda?: number | null;
  marketCap?: number | null;
  profitMargin?: number | null;
  returnOnEquity?: number | null;
  revenueGrowth?: number | null;
  earningsGrowth?: number | null;
  debtToEquity?: number | null;
  /**
   * Temettü verimi — **ORAN (0-1)**, yüzde puanı DEĞİL.
   * ÖLÇÜLDÜ: KO → 0.0229, AAPL → 0.0031, THYAO.IS → 0.
   * `formatPercent` yüzde PUANI bekler; bu alan ona verilirse %0,00
   * yazar. Doğru biçimleyici `formatOran`. Ölçek değiştirmek motorun
   * işi (`lib/format.ts` başlığı), istemci 100 ile çarpmaz.
   *
   * `0` GERÇEK BİR ÖLÇÜM: "temettü ödemiyor" demek, "veri yok" değil.
   */
  dividendYield?: number | null;

  // ── TEMETTÜ KÜNYESİ (ÖLÇÜLDÜ 2026-10-29, KAYNAK OKUMA) ───────────
  //  Ölçüm yeri: `api/_yfin.js` → `fetchOne` dönüş gövdesi. Dokuz alanın
  //  tamamı `num(...)` süzgecinden geçiyor (`api/_yfin.js:47`:
  //  `o && typeof o.raw === 'number' ? o.raw : null`) → ölçülemeyen alan
  //  `null`, ASLA `0`. Bu yüzden hepsi `number | null`.
  //
  //  BİRİM TUZAĞI — ÜÇ FARKLI ÖLÇEK AYNI KARTTA: iki alan 0-1 ORAN, bir
  //  alan YÜZDE PUANI, üç alan PARA BİRİMİ. Hepsini tek biçimleyiciye
  //  vermek 100 kat yanlış sayı basmak olurdu; her alanın ölçeği
  //  yanındaki yorumda yazıyor ve kart o yoruma göre biçimliyor.
  //
  //  BURADA ÖLÇEK DEĞİŞTİRİLMİYOR: hiçbir alan 100 ile çarpılmıyor,
  //  bölünmüyor, saniye/milisaniye çevrimi burada yapılmıyor.
  //
  //  Bu dokuz alan `deep` ile DEĞİŞMİYOR (hepsi `summaryDetail` /
  //  `defaultKeyStatistics` modüllerinde) — TEK İSTİSNA `dividendTs`.

  /**
   * Yıllık (ilan edilmiş) hisse başı temettü — **PARA BİRİMİ**
   * (`currency` alanının birimi), oran DEĞİL.
   * Kaynak: `summaryDetail.dividendRate`.
   */
  dividendRate?: number | null;
  /**
   * Dağıtım oranı (payout) — **ORAN (0-1)**, yüzde puanı DEĞİL.
   * Kaynak: `summaryDetail.payoutRatio` (`api/_yfin.js:119` → "0–1 ORAN").
   * Doğru biçimleyici `formatOran`; `formatPercent` 100 kat küçük basar.
   */
  payoutRatio?: number | null;
  /**
   * 5 yıl ortalama temettü verimi — **YÜZDE PUANI** (2.41 = %2,41),
   * ORAN DEĞİL. Kaynak: `summaryDetail.fiveYearAvgDividendYield`
   * (`api/_yfin.js:120` bu tuzağı ayrıca uyarıyor).
   *
   * DİKKAT: bu alan `dividendYield` ve `trailingAnnualDividendYield` ile
   * AYNI ÖLÇEKTE DEĞİL. `formatOran`a verilmesi "2,41" yazdırır ve
   * kullanıcı bunu 0-1 oranı sanır → 100 kat yanlış okuma.
   */
  dividendYield5y?: number | null;
  /**
   * Son 12 ayda FİİLEN ödenen hisse başı temettü — **PARA BİRİMİ**.
   * Kaynak: `summaryDetail.trailingAnnualDividendRate`.
   */
  trailingAnnualDividendRate?: number | null;
  /**
   * Son 12 ay verimi — **ORAN (0-1)**, yüzde puanı DEĞİL.
   * Kaynak: `summaryDetail.trailingAnnualDividendYield`
   * (`api/_yfin.js:122` → "0–1 ORAN").
   */
  trailingAnnualDividendYield?: number | null;
  /**
   * Son TEK temettü ödemesinin hisse başı tutarı — **PARA BİRİMİ**.
   * Kaynak: `defaultKeyStatistics.lastDividendValue`.
   */
  lastDividendValue?: number | null;
  /**
   * Son tek ödemenin tarihi — UNIX **SANİYE** (milisaniye DEĞİL).
   * Kaynak: `defaultKeyStatistics.lastDividendDate`, `num()` ile ham
   * `raw` okunuyor; Yahoo `quoteSummary` `raw` damgaları 10 hanelik
   * saniye (aynı sözleşme `YfinEarnings.ts` ve `formatGunAyYil` için de
   * geçerli). Biçimleyici: `formatGunAyYil` — saniyeyi kendisi
   * milisaniyeye çeviriyor; ekranda `new Date(t * 1000)` yazılmıyor.
   */
  lastDividendTs?: number | null;
  /**
   * Temettü kesinti (ex-date) tarihi — UNIX **SANİYE**.
   * Kaynak: `summaryDetail.exDividendDate`, yedek
   * `calendarEvents.exDividendDate` (yedek YALNIZ `deep=1`'de dolu).
   */
  exDividendTs?: number | null;
  /**
   * Ödeme tarihi — UNIX **SANİYE**.
   *
   * YALNIZ `deep=1`: kaynak `calendarEvents.dividendDate` ve uç
   * `deep ? num(ce.dividendDate) : null` yazıyor (`api/_yfin.js:128`).
   * Yani `deep` kapalı istekte gelen `null` "ödeme tarihi yok" DEĞİL,
   * "sorulmadı" demek — çağıran bu ayrımı bilmeli.
   */
  dividendTs?: number | null;

  /** Son fiyat (ham). */
  price?: number | null;
};

/**
 * `/api/yfin` cevabı. ÖLÇÜLDÜ: üst düzeyde `results` DIŞINDA alan yok
 * (hata hâlinde 400/502 + `{error}` — onu `apiGet` `ApiError`a
 * çeviriyor, gövde buraya hiç gelmiyor).
 */
export type YfinResponse = {
  results: YfinKunye[];
};

export type YfinOptions = Omit<RequestOptions, 'query'> & {
  /**
   * `calendarEvents` + `earningsTrend` modüllerini de çek
   * (`earnings` alanı YALNIZ bununla gelir). Bilanço kartı buna
   * muhtaç, o yüzden VARSAYILAN AÇIK — çağıranın unutması, kartın
   * "takvim yok" demesine yol açardı ki bu yalan olurdu.
   */
  deep?: boolean;
};

/**
 * Künye çağrısı: GET /api/yfin?symbols=AAPL,THYAO.IS&deep=1
 *
 * NEDEN ÇOĞUL: uç nokta tek istekte 12 sembole kadar bakıyor ve Yahoo
 * crumb/cookie el sıkışmasını aynı tur içinde paylaşıyor
 * (`getCrumb` warm lambda'da 30 dk saklı). Sembol başına bir çağrı,
 * el sıkışma cezasını sembol sayısına katlar.
 *
 * NEDEN YEREL SINIR DENETİMİ: uç nokta aşımı REDDETMİYOR, sessizce
 * 12'ye kırpıyor (bkz. `YFIN_AZAMI_SEMBOL`). Sessiz kırpmayı ekrana
 * taşımak, sorulmamış sembolü "veri yok" gibi göstermek olurdu.
 */
export async function fetchYfin(
  semboller: string[],
  options: YfinOptions = {},
): Promise<ApiResult<YfinResponse>> {
  const { deep = true, timeoutMs = YFIN_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.yfin;

  // Uç noktanın ayrıştırmasıyla AYNI temizlik: trim + boşları at.
  // (`api/_yfin.js`: `split(',').map(trim).filter(Boolean)`.)
  // Büyük harfe çevirme skor zincirindeki ile aynı: Yahoo sembolleri
  // büyük harf, `.IS` eki de büyük geliyor (ölçüldü: THYAO.IS).
  const liste = semboller.map((s) => String(s).trim().toUpperCase()).filter(Boolean);

  if (!liste.length) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Sembol verilmedi.',
        endpoint: path,
        code: 'symbols_yok',
      },
    };
  }
  if (liste.length > YFIN_AZAMI_SEMBOL) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message:
          'En çok ' +
          YFIN_AZAMI_SEMBOL +
          ' sembolün künyesi sorulabilir (' +
          liste.length +
          ' istendi).',
        endpoint: path,
        code: 'cok_sembol',
      },
    };
  }

  return apiGet<YfinResponse>(path, {
    // `deep` SORGUDA YALNIZ AÇIKKEN: uç `!!(req.query?.deep)` okuyor,
    // yani `deep=0` bile DOĞRU sayılır. `client.ts` `buildUrl`
    // `null`/boş değerleri atlıyor — kapalıyken anahtarı hiç basmamak
    // tek doğru yol.
    query: { symbols: liste.join(','), deep: deep ? 1 : null },
    timeoutMs,
    signal,
  });
}

/**
 * Künye listesini sembole göre aramak için sözlük. Kartlar iki uçtan
 * (skor + künye) gelen satırları eşlerken `find()` ile iç içe döngü
 * kurmasın.
 *
 * NEDEN SIRALAMA YOK: gelen dizinin sırası isteğin sırası
 * (`api/_yfin.js` sembolleri SIRAYLA geziyor). İstemcide yeniden
 * sıralamak ikinci bir sıralama kuralı doğurur (`SiraKayit` notuyla
 * aynı gerekçe).
 */
export function yfinSozluk(veri: YfinResponse | null | undefined): Map<string, YfinKunye> {
  const m = new Map<string, YfinKunye>();
  for (const k of veri?.results ?? []) {
    if (k && typeof k.symbol === 'string') m.set(k.symbol.toUpperCase(), k);
  }
  return m;
}

// =====================================================================
//  ARAMA KİPİ — /api/yfin?search=<yazı>
// ---------------------------------------------------------------------
//  NE: aynı uç noktanın İKİNCİ kipi. Bir yazıyı (şirket adı ya da
//  sembol parçası) Yahoo autocomplete ile çözüp sembol + borsa
//  döndürüyor; evrensel arama kutusunun "bu yazı hangi hisse" sorusunu
//  bu kip yanıtlıyor.
//
//  NEDEN AYRI İŞLEV (`fetchYfin`e KİP EKLENMEDİ) — ÖLÇÜLDÜ:
//    1. Uç, arama dalını `symbols` dalından ÖNCE ve ondan tamamen
//       ayrı çalıştırıp `return` ediyor (api/_yfin.js:123-143 vs
//       :145-171). İki kip aynı istekte BİRLEŞMİYOR.
//    2. Gövdeler apayrı: arama `{ query, quotes }` (api/_yfin.js:137),
//       künye `{ results }` (:167). Tek işleve katlamak dönüş tipini
//       birleşime (union) çevirir ve BUGÜN `YfinResponse` okuyan her
//       çağıran daraltma yazmak zorunda kalırdı — geriye dönük
//       uyumluluk kırılırdı.
//    3. `fetchYfin` sorguya `search` anahtarını HİÇ basmıyor
//       (yalnız `symbols` + `deep`), yani mevcut sözleşme bu eklemeden
//       etkilenmiyor. `YfinOptions`/`YfinResponse`/`yfinSozluk`
//       DEĞİŞTİRİLMEDİ.
//
//  ── ÖLÇÜLDÜ (2026-10-26, KAYNAK OKUMA — canlı istek ATILMADI) ──────
//  · Parametre adı `search` (api/_yfin.js:122):
//    `(req.query?.search || '').toString().trim()`.
//  · BOŞ/eksik `search` arama SAYILMIYOR: dal atlanır ve istek
//    `symbols` dalına düşer → 400 `{ error: 'Missing ?symbols=' }`
//    (:146). Yani `search=''` göndermek "sonuç yok" değil, HATA verir.
//    Bu yüzden boş yazı AĞA ÇIKMADAN aşağıda kesiliyor.
//  · Sonuç sayısı SUNUCUDA SABİT: `quotesCount=10` (:125). İstemci
//    bunu değiştiremez; `AZAMI_ARAMA_SONUC` yalnız BELGEDİR, sorguya
//    basılmaz.
//  · YAZI UZUNLUĞU SINIRI ÖLÇÜLEMEDİ — ne uçta ne Yahoo tarafında bir
//    denetim var (kaynakta yok). Bu yüzden istemciye uydurma bir
//    uzunluk kapısı YAZILMADI; tek kapı "boş mu".
//  · `newsCount=0` → haber GELMİYOR; `enableFuzzyQuery=false` → yakın
//    yazım DÜZELTİLMİYOR (yanlış yazılan ad boş liste döndürür ve bu
//    bir VERİ CEVABIDIR, ölçüm eksikliği değil).
//  · Dönen alanlar TAM OLARAK (:129-135): symbol · name · exch ·
//    exchDisp · type. Hepsi `|| null`; `symbol` null olanlar sunucuda
//    SÜZÜLÜYOR (:135) — bu yüzden `symbol` burada `string`.
//  · Hata: 502 `{ error: <metin>, quotes: [] }` (:140). Gövde
//    `apiGet` tarafından `ApiError`a çevrilir, buraya gelmez.
//  · Fiyat/çarpan/sektör BU KİPTE GELMEZ — künye için `fetchYfin`
//    çağrılmalı. Arama sonucundan finansal alan türetmek uydurma
//    olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/**
 * Uç noktanın döndürdüğü azami sonuç sayısı — ÖLÇÜLDÜ:
 * `quotesCount=10` (api/_yfin.js:125). SUNUCUDA SABİT: istemci
 * artıramaz/azaltamaz. 10 sonuç gelmesi "daha fazlası yok" demek
 * DEĞİL, "uç 10'da kesti" demek.
 */
export const YFIN_AZAMI_ARAMA_SONUC = 10;

/**
 * Tek arama satırı. `symbol` DIŞINDAKİ her alan `null` olabilir
 * (Yahoo o alanı vermemiş olabilir); `symbol` sunucuda süzüldüğü için
 * her zaman dolu.
 */
export type YfinAramaSonuc = {
  /** Yahoo sembolü — BIST'te `.IS` ekli gelir (örn. THYAO.IS). */
  symbol: string;
  /** Kısa ad; yoksa uzun ad; ikisi de yoksa `null`. */
  name: string | null;
  /** Borsa kodu (ham, örn. `IST`, `NMS`). */
  exch: string | null;
  /** Borsanın gösterilecek adı (örn. `Istanbul`, `NasdaqGS`). */
  exchDisp: string | null;
  /**
   * Yahoo kayıt türü (ham, örn. `EQUITY`, `ETF`, `INDEX`, `CRYPTOCURRENCY`).
   * SÜZÜLMEDİ: hisse dışı satırları ayıklamak ekranın kararı; burada
   * süzmek, kullanıcının yazdığı şeyi sessizce yok saymak olurdu.
   */
  type: string | null;
};

/**
 * `/api/yfin?search=` cevabı. ÖLÇÜLDÜ (api/_yfin.js:137): üst düzeyde
 * `query` ve `quotes` DIŞINDA alan yok.
 *
 * `quotes` BOŞ DİZİ olabilir ve bu "bu yazıya karşılık bulunamadı"
 * demek — ölçüm eksikliği DEĞİL.
 */
export type YfinArama = {
  /** Sunucunun kırptığı (`trim`) hâliyle sorgu — gönderdiğimizin yankısı. */
  query: string;
  quotes: YfinAramaSonuc[];
};

/**
 * Arama çağrısı: GET /api/yfin?search=<yazı>
 *
 * NEDEN `YFIN_TIMEOUT_MS` DEĞİL, `DEFAULT_TIMEOUT_MS` (12 sn): künye
 * kipi sembol başına SIRAYLA Yahoo turu atıyor (12 tura kadar), arama
 * kipi ise TEK tur (api/_yfin.js:126) ve crumb el sıkışması bile
 * gerekmiyor (:121). 28 sn'yi buraya kopyalamak, arama kutusunu
 * düşmüş bir ağda yarım dakika kilitli tutardı.
 *
 * BURADA SIRALAMA/PUANLAMA YOK: gelen sıra Yahoo'nun ilgi sırası.
 * İstemcide yeniden sıralamak ikinci bir alaka kuralı doğururdu.
 */
export async function fetchYfinArama(
  yazi: string,
  options: Omit<RequestOptions, 'query'> = {},
): Promise<ApiResult<YfinArama>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.yfin;

  // Uç noktanın kendi temizliğiyle AYNI: `toString().trim()`
  // (api/_yfin.js:122). BÜYÜK HARFE ÇEVİRİLMİYOR — künye kipinin
  // aksine buraya şirket ADI da yazılıyor ve Yahoo aramasında harf
  // büyüklüğü sonucu değiştirmiyor; çevirmek kullanıcının yazdığını
  // boşuna bozmak olurdu.
  const q = String(yazi ?? '').trim();

  if (!q) {
    // Boş yazı gönderilirse uç arama dalını ATLAR ve 400
    // `Missing ?symbols=` döner (ölçüldü) — yani boş arama "sonuç yok"
    // değil, yanıltıcı bir HATA olurdu. Ağa çıkmadan kesiliyor.
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Aranacak yazı verilmedi.',
        endpoint: path,
        code: 'search_yok',
      },
    };
  }

  return apiGet<YfinArama>(path, { query: { search: q }, timeoutMs, signal });
}
