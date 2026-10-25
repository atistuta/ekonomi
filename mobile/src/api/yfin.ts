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
//    · TEMETTÜ TARAFINDA GELEN TEK ALAN: `dividendYield`.
//      Temettü TARİHİ (ex-date / ödeme günü), temettü TUTARI,
//      dağıtım oranı GELMİYOR — `fetchOne` böyle bir alan basmıyor
//      ve ölçümde de yoktu. Bu yüzden burada o alanların türü YOK.
//
//  BURADA HESAP YOK: bu dosya hiçbir oranı ölçeklemez, hiçbir skor
//  üretmez. Gelen ham sayı aynen taşınır; biçimleme `lib/format.ts`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { apiGet, ENDPOINTS, type ApiResult, type RequestOptions } from './client';

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
