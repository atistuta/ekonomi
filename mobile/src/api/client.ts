// =====================================================================
//  MOTOR API İSTEMCİSİ — ince istemci                 (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Vercel'deki motor uçlarına (`/api/*`) vuran `fetch` sarmalayıcısı.
//  Zaman aşımı, iptal, ve en önemlisi HATA AYRIMI.
//
//  NEDEN BU KADAR İNCE: yol haritasının 1. maddesi —
//  "Motor = API. Native app bunları çağıran **ince istemci** olur."
//  ve "Tek doğruluk kaynağı: skor motoru API."
//  Yani bu dosya skor HESAPLAMAZ, eşik UYGULAMAZ, bant KARARI vermez.
//  Bir satır matematik buraya girerse web ile native iki ayrı skor
//  üretmeye başlar ve `tests/parity.mjs`'in koruduğu "fark 0" güvencesi
//  istemci tarafında sessizce kırılır.
//
//  NEDEN BİÇİMLENDİRME DE YOK: uç nokta HAM sayı döndürüyor (bkz.
//  `api/score.js` başlığı). `tr-TR` biçimi `lib/format.ts`'in işi; burada
//  bir `toFixed` bile olmaz, yoksa iki ayrı biçim kaynağı doğar.
//
//  ── "VERİ YOK" ≠ "ÖLÇEMEDİM" ───────────────────────────────────────
//  Motorun dürüstlük çıpası bu ayrım: bir kriter ölçülememişse
//  "nötr/dengeli" denmez (bkz. hafıza notu: insider panelinde
//  `tB=tS=0` → "yalnız opsiyon/RSU", "dengeli" DEĞİL). İstemci de aynı
//  ayrımı taşımak zorunda, yoksa ekran "veri yok"u "sorun yok" gibi
//  gösterir:
//    'no-data'     → sunucu ulaştı, ölçtü, SONUÇ YOK (404 / boş gövde)
//    'unmeasured'  → ölçemedik: ağ yok, zaman aşımı, 5xx, bozuk JSON
//    'bad-request' → istek hatalı (4xx) — bizim hatamız, veri sorunu değil
//    'canceled'    → ekran kapandı / arama tuşu değişti (hata DEĞİL)
//
//  DİKKAT: 200 dönen bir cevap da "eksik ölçüm" taşıyabilir
//  (`tam:false` / `sayac.*.kesinti>0` / `atlanan.length>0`). O yüzden
//  `ok:true` "her şey ölçüldü" demek DEĞİL — ekran `olcumEksik()` ile
//  (api/types.ts) kontrol etmek zorunda. Kesilen/zaman aşımına uğrayan
//  istek de aynı kefeye konur: 'unmeasured'.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  ADIMLAR,
  ARALIKLAR,
  ARAMA_AZAMI,
  AZAMI_HABER_SORGU,
  AZAMI_HAREKET,
  AZAMI_KONSEPT,
  AZAMI_MADDE,
  AZAMI_OLCUM,
  AZAMI_SEMBOL,
  GUNDEM_YERELLER,
  HABER_PAZARLAR,
  METAL_OLCUM_ALANLAR,
  METAL_TURLER,
  NEDEN_KINDLER,
  SIRA_KIPLERI,
  TARAMA_PRESETLER,
  WATCHLIST_CODE_BICIM,
  VARSAYILAN_ADIM,
  VARSAYILAN_ARALIK,
  VARSAYILAN_GUNDEM_YEREL,
  VARSAYILAN_HABER_PAZAR,
  VARSAYILAN_SIRA,
  type Adim,
  type AnalyzeResponse,
  type Aralik,
  type AramaResponse,
  type BacktestResponse,
  type CausalRequest,
  type CausalResponse,
  type ChartResponse,
  type CompareResponse,
  type DegerResponse,
  type GundemResponse,
  type GundemYerel,
  type HaberPazar,
  type Market,
  type MetalOlcumler,
  type MetalTur,
  type NewsResponse,
  type OlcumKayit,
  type PulseResponse,
  type RadarResponse,
  type RecommendResponse,
  type ScoreErrorBody,
  type ScoreResponse,
  type SektorResponse,
  type SiraKip,
  type TaramaPreset,
  type TaramaResponse,
  type ThemeResponse,
  type Vade,
  type WatchlistResponse,
  type WatchlistYazGovde,
  type WatchlistYazResponse,
} from './types';

export * from './types';

/**
 * Motorun tabanı. `EXPO_PUBLIC_API_URL` ile geçersiz kılınabilir
 * (yerel `vercel dev` ya da önizleme dağıtımı için). Sondaki `/`
 * kırpılır ki taban + yol iki eğik çizgi üretmesin.
 *
 * NEDEN varsayılan uydurma değil: `day-starter.vercel.app` bu deponun
 * canlı dağıtımı, hayali bir adres değil. Hangi kaynaktan geldiğini
 * `API_BASE_SOURCE` söylüyor ki tanı ekranı "ortamdan mı geldi,
 * varsayılan mı" sorusunu tahmine bırakmasın.
 */
export const API_BASE_SOURCE: 'env' | 'varsayilan' = process.env.EXPO_PUBLIC_API_URL
  ? 'env'
  : 'varsayilan';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? 'https://day-starter.vercel.app'
).replace(/\/+$/, '');

/**
 * Uç adresleri — TEK YER. Motor uçları ELITE_ROADMAP FAZ 1'de
 * score, recommend, analyze, theme, causal, compare olarak planlandı;
 * score, theme, yfin, watchlist yazıldı, diğerleri sürüyor. Burada
 * listelenmiş olmaları "hazır" demek değil; adresin tek yerden
 * yönetilmesi demek.
 */
export const ENDPOINTS = {
  score: '/api/score',
  recommend: '/api/recommend',
  analyze: '/api/analyze',
  theme: '/api/theme',
  causal: '/api/causal',
  compare: '/api/compare',
  yfin: '/api/yfin',
  watchlist: '/api/watchlist',
  chart: '/api/chart',
  // Haber ucu SKOR ZİNCİRİNİN İÇİNDE DEĞİL, yanında (api/news.js
  // başlığı): metin döner, hiçbir skora girdi vermez. Yol adı İngilizce,
  // öteki uçlarla aynı dilde.
  news: '/api/news',
  // ⚡ Makro Nabız ucu. TEK POST UCU (bkz. `apiPost` gerekçesi): gövdesi
  // manşet LİSTESİ taşıyabildiği için sorgu dizgisine sığmıyor
  // (api/pulse.js başlığı). Yol adı İngilizce, öteki uçlarla aynı dilde.
  pulse: '/api/pulse',
  // ----- Keşif beşlisi (api/_kesif.js) -----
  // BEŞİ DE `api/proxy.js` yeniden-yazımıyla taşınıyor (vercel.json 25-29):
  // Vercel Hobby'nin 12 fonksiyon tavanı yüzünden ayrı dosya AÇILMADI. Yol
  // adları istemci açısından gerçek uç gibi davranıyor — yeniden-yazım
  // sunucuda, istemci bilmiyor.
  tarama: '/api/tarama',
  sektor: '/api/sektor',
  radar: '/api/radar',
  backtest: '/api/backtest',
  deger: '/api/deger',
  // ÇOK PAZARLI ADAY ARAMASI (api/_kesif.js `aramaHandler`). Altıncı keşif
  // rotası, o beşle AYNI yeniden-yazımdan geçiyor (vercel.json:30 →
  // `/api/proxy?__rota=arama`) — yeni Vercel fonksiyonu AÇILMADI.
  arama: '/api/arama',
  // KAP DUYURULARI + BIST TEMETTÜ TAKVİMİ (api/_kesif.js `takvimHandler`,
  // taşıyıcı api/_takvim.js). Yedinci keşif rotası, o altıyla AYNI
  // yeniden-yazımdan geçiyor (vercel.json → `/api/proxy?__rota=takvim`) —
  // yeni Vercel fonksiyonu AÇILMADI, `api/*.js` uç dosyası sayısı 12'de
  // KALDI (Hobby tavanı). İstemci yeniden-yazımı bilmiyor: yol adı
  // gerçek uç gibi davranıyor.
  takvim: '/api/takvim',
} as const;

/**
 * Grafik/backtest uçlarının KAPALI KÜMESİ olarak kabul ettiği endeks
 * sembolleri. ÖLÇÜLDÜ (2026-10-27, `api/_girdi.js` `ENDEKS_SOZLUGU` +
 * `cozEndeks()`, `api/chart.js:245`, `api/_kesif.js:586`): bu dört sembol
 * `SEMBOL_BICIM` düzenli ifadesine UYMADIĞI hâlde sözlükten çözülüyor, yani
 * sunucu artık kabul ediyor. Küme SUNUCUDA kapalı olduğu için burada da
 * kapalı: listede olmayan `^`/`=` taşıyan sembol hâlâ kesin 400 demek.
 *
 * Bu bir EŞİK/FORMÜL DEĞİL, sunucunun beyaz listesinin kopyası.
 */
export const ENDEKS_SEMBOLLER = ['^GSPC', '^IXIC', 'GC=F', 'XU100'] as const;
export type EndeksSembol = (typeof ENDEKS_SEMBOLLER)[number];

/** Sembol sunucunun endeks sözlüğünde mi? (büyük harfe çevirerek bakar) */
export function endeksMi(symbol: string | null | undefined): boolean {
  const s = String(symbol ?? '').trim().toUpperCase();
  return (ENDEKS_SEMBOLLER as readonly string[]).includes(s);
}

export type EndpointName = keyof typeof ENDPOINTS;

export type ApiErrorKind = 'no-data' | 'unmeasured' | 'bad-request' | 'canceled';

export type ApiError = {
  kind: ApiErrorKind;
  /** Kullanıcıya gösterilebilir Türkçe cümle. */
  message: string;
  /** HTTP durumu (varsa) — kayıt/teşhis için, ekranda gösterilmez. */
  status?: number;
  /** Hangi uç — teşhis için. */
  endpoint?: string;
  /** Motorun makine kodu (`api/score.js`), varsa — teşhis + metin seçimi. */
  code?: string;
};

/**
 * Sonuç türü. `throw` yerine ayrık birleşim: ekran `if (!r.ok)` yazmak
 * zorunda kalır, böylece hata durumu "sonradan akla gelen" olmaz
 * (FAZ 3 kuralı: "Tasarlanmış boş / hata / offline / yükleniyor
 * durumları").
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Varsayılan zaman aşımı. Motor uçları soğuk başlangıçta yavaş olabilir. */
export const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Skor için ayrı (ve uzun) zaman aşımı. ÖLÇÜLEN gerçek: `api/score.js`
 * `BUTCE_MS = 45000` ve `maxDuration = 60`. Bütçeye YENİ sembole
 * başlamadan önce bakıldığı için başlamış bir sembol kesilemez — tek
 * sembol 45-55 sn yiyebilir. 12 sn'de kesmek, motor çalışırken istemciyi
 * "ölçemedim"e düşürürdü. 58 sn: platformun 60 sn'lik tavanının hemen
 * altı, yani önce biz değil sunucu konuşur.
 */
export const SCORE_TIMEOUT_MS = 58_000;

/** Ham `symbols` dizgisi için uç noktanın sınırı (AZAMI_SORGU). */
export const AZAMI_SORGU = 128;

export type RequestOptions = {
  /** Sorgu parametreleri. `undefined` / `null` değerler atlanır. */
  query?: Record<string, string | number | boolean | null | undefined>;
  timeoutMs?: number;
  /** Çağıranın iptal işareti (ekran kapandı, arama metni değişti). */
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v == null || v === '') continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Motorun makine kodu → kullanıcı cümlesi. NEDEN sunucunun metnini
 * kullanmıyoruz: `api/score.js` kasıtlı olarak ayrıntı dönmüyor (yalnız
 * kod), ve metni sunucuya bağlamak dili sunucu yerelinde kilitlerdi.
 * Bilinmeyen kod → genel cümle; kodu yutmuyoruz, `error.code`'da kalır.
 */
function kodMetni(code: string | undefined, azami?: number, istenen?: number): string | null {
  switch (code) {
    case 'symbols_yok':
    case 'symbols_bos':
      return 'Sembol verilmedi.';
    case 'symbol_yok':
      // Grafik ucunun TEKİL kodu: `symbols_yok` değil `symbol_yok`.
      // ÖLÇÜLDÜ (2026-10-24): ?symbol= → 400 {"error":"symbol_yok"}
      return 'Sembol verilmedi.';
    case 'cok_sembol':
      // Grafik ucunda `azami: 1` geliyor (ÖLÇÜLDÜ: ?symbol=AAPL,MSFT →
      // 400 {"error":"cok_sembol","azami":1}, `istenen` alanı YOK).
      // Tekil durumda çoğul cümle ("en çok 1 sembol sorulabilir")
      // bilgisizce kurulmuş görünür — ayrı cümle hak ediyor.
      if ((azami ?? AZAMI_SEMBOL) === 1) return 'Bu uç tek sembol alır; birden çok sembol verildi.';
      return 'En çok ' + (azami ?? AZAMI_SEMBOL) + ' sembol sorulabilir (' + (istenen ?? 0) + ' istendi).';
    case 'bad_range':
      return 'Geçersiz aralık.';
    case 'bad_interval':
      return 'Geçersiz adım (mum periyodu).';
    case 'grafik_alinamadi':
      return 'Fiyat serisi alınamadı — ölçüm yapılamadı.';
    case 'too_long':
      return 'Sembol listesi çok uzun.';
    case 'bad_vade':
      return 'Geçersiz vade.';
    case 'bad_market':
      return 'Geçersiz pazar.';
    case 'bad_symbol':
      return 'Sembol biçimi geçersiz.';
    case 'method_not_allowed':
      return 'İstek yöntemi desteklenmiyor.';
    // --- /api/news kodları (api/news.js). `too_long` BİLEREK burada
    // yeniden tanımlanmadı: skor tarafında "sembol listesi", haber
    // tarafında "sorgu metni" demek. Aynı koda iki anlam yüklemek yerine
    // haber tarafı kendi cümlesini `fetchNews` kapısında veriyor.
    case 'missing_q':
      return 'Haber sorgusu verilmedi.';
    case 'bad_limit':
      return 'Geçersiz madde sayısı.';
    case 'limit_buyuk':
      return 'En çok ' + (azami ?? AZAMI_MADDE) + ' manşet istenebilir (' + (istenen ?? 0) + ' istendi).';
    case 'haber_alinamadi':
      return 'Haber beslemesi okunamadı — ölçüm yapılamadı.';
    // --- /api/pulse kodları (api/pulse.js). `too_long` ve `cok_sembol`
    // BİLEREK burada yeniden tanımlanmadı: skor tarafında "sembol
    // listesi" demek, nabız tarafında "sorgu metni". Nabız kendi
    // cümlesini `fetchPulse` kapısında veriyor.
    case 'govde_yok':
    case 'bozuk_json':
      return 'İstek gövdesi okunamadı.';
    case 'govde_buyuk':
      return 'İstek gövdesi çok büyük.';
    case 'faizHaberleri_yok':
    case 'enflasyonHaberleri_yok':
    case 'girdi_yok':
      return 'Nabız için girdi verilmedi.';
    case 'cok_baslik':
      return azami == null
        ? 'Gönderilen manşet sayısı ucun sınırını aştı.'
        : 'En çok ' + azami + ' manşet gönderilebilir (' + (istenen ?? 0) + ' gönderildi).';
    case 'bad_baslik':
      return 'Manşet biçimi geçersiz.';
    case 'bad_haberPazari':
      return 'Geçersiz pazar.';
    case 'bad_semboller':
      return 'Sembol listesi biçimi geçersiz.';
    case 'bad_genislik':
    case 'bad_enflasyonBaskisi':
    case 'bad_risk':
    case 'bad_simdi':
      return 'Konjonktür girdisi geçersiz.';
    case 'nabiz_hesaplanamadi':
      return 'Nabız hesaplanamadı — ölçüm alınamadı.';
    // --- /api/causal kodları (api/causal.js:144-201). `govde_yok`,
    // `bozuk_json`, `govde_buyuk`, `method_not_allowed` ve
    // `motor_kurulamadi` YUKARIDA zaten tanımlı ve BU UÇTA DA AYNI
    // anlamı taşıyor (gövde okunamadı / çok büyük / yöntem / motor) —
    // ikinci kez yazmak aynı koda iki cümle vermek olurdu.
    case 'hareketler_yok':
      return 'Endeks hareketi verilmedi.';
    case 'gundem_yok':
      return 'Gündem verilmedi.';
    case 'cok_hareket':
      return 'En çok ' + (azami ?? AZAMI_HAREKET) + ' endeks hareketi gönderilebilir (' + (istenen ?? 0) + ' gönderildi).';
    case 'cok_konsept':
      return 'En çok ' + (azami ?? AZAMI_KONSEPT) + ' gündem konsepti gönderilebilir (' + (istenen ?? 0) + ' gönderildi).';
    case 'bad_hareket':
    case 'bad_pct':
    case 'bad_notable':
      return 'Endeks hareketi biçimi geçersiz.';
    case 'bad_kind':
      return 'Endeks türü geçersiz.';
    case 'bad_konsept':
    case 'konsept_key_yok':
      return 'Gündem konsepti biçimi geçersiz.';
    case 'neden_hesaplanamadi':
      return 'Nedensellik okuması yapılamadı — ölçüm alınamadı.';
    case 'motor_kurulamadi':
    case 'skor_hesaplanamadi':
      return 'Motor çalıştırılamadı — ölçüm alınamadı.';
    default:
      return null;
  }
}

/** 4xx/5xx gövdesinden makine kodunu çıkar; gövde JSON değilse sessiz geç. */
async function hataKodu(res: Response): Promise<ScoreErrorBody | null> {
  try {
    return (await res.json()) as ScoreErrorBody;
  } catch {
    return null;
  }
}

/**
 * İstek çekirdeği — TEK GÖVDE. `apiGet` ve `apiPost` bunun ince
 * sarmalayıcıları.
 *
 * NEDEN AYRI BİR `apiPost` GÖVDESİ YAZILMADI: zaman aşımı, çağıran
 * iptali, 404/204 → `no-data`, 4xx → `bad-request`, 5xx/bozuk gövde →
 * `unmeasured` eşlemesi bu dosyanın TEK dürüstlük sözleşmesi. İkinci bir
 * kopya, bir gün biri iki kopyadan yalnız birini düzelttiğinde POST
 * uçlarının GET uçlarından FARKLI hata felsefesi taşımasına yol açardı.
 * Yöntem ve gövde dışında hiçbir şey değişmiyor.
 */
type IstekSecenek = RequestOptions & {
  method?: 'GET' | 'POST';
  /** POST gövdesi. JSON'a çevrilip gönderilir; GET'te yok sayılır. */
  govde?: unknown;
};

async function apiIstek<T = unknown>(
  path: string,
  options: IstekSecenek = {},
): Promise<ApiResult<T>> {
  const { query, timeoutMs = DEFAULT_TIMEOUT_MS, signal, method = 'GET', govde } = options;
  const url = buildUrl(path, query);

  // Zaman aşımı + çağıranın iptali birlikte: ikisinden biri tetiklenirse
  // istek düşer. `AbortSignal.any` her RN sürümünde yok, elle bağlıyoruz.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onOuterAbort = () => controller.abort('caller');
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const res = await fetch(url, {
      method,
      headers:
        method === 'POST'
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
      // GET'te `undefined` — `fetch` gövdesiz istek kurar.
      body: method === 'POST' ? JSON.stringify(govde ?? {}) : undefined,
      signal: controller.signal,
    });

    if (res.status === 404 || res.status === 204) {
      return {
        ok: false,
        error: {
          kind: 'no-data',
          message: 'Bu sembol için veri bulunamadı.',
          status: res.status,
          endpoint: path,
        },
      };
    }
    if (res.status >= 400 && res.status < 500) {
      // Motorun makine kodunu okumayı DENE: 400 gövdesi {error:'...'}.
      // Okunamazsa genel cümleye düşer — hata TÜRÜ değişmez.
      const body = await hataKodu(res);
      const code = typeof body?.error === 'string' ? body.error : undefined;
      return {
        ok: false,
        error: {
          kind: 'bad-request',
          message: kodMetni(code, body?.azami, body?.istenen) ?? 'İstek karşılanamadı.',
          status: res.status,
          endpoint: path,
          code,
        },
      };
    }
    if (!res.ok) {
      // 5xx = motor ölçemedi. "Veri yok" DEMEK DEĞİL.
      const body = await hataKodu(res);
      const code = typeof body?.error === 'string' ? body.error : undefined;
      return {
        ok: false,
        error: {
          kind: 'unmeasured',
          message:
            kodMetni(code) ?? 'Motora ulaşıldı ama ölçüm alınamadı. Birazdan tekrar deneyin.',
          status: res.status,
          endpoint: path,
          code,
        },
      };
    }

    const text = await res.text();
    if (!text.trim()) {
      return {
        ok: false,
        error: { kind: 'no-data', message: 'Sonuç boş döndü.', status: res.status, endpoint: path },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Bozuk/HTML gövde (ör. Vercel hata sayfası) — ölçemedik.
      return {
        ok: false,
        error: {
          kind: 'unmeasured',
          message: 'Yanıt okunamadı.',
          status: res.status,
          endpoint: path,
        },
      };
    }
    return { ok: true, data: parsed as T };
  } catch (e) {
    if (signal?.aborted) {
      return {
        ok: false,
        error: { kind: 'canceled', message: 'İstek iptal edildi.', endpoint: path },
      };
    }
    const timedOut = (e as Error | undefined)?.name === 'AbortError';
    // Kesilen istek = KESİNTİ. "Düşük skor" ya da "veri yok" DEĞİL.
    return {
      ok: false,
      error: {
        kind: 'unmeasured',
        message: timedOut
          ? 'Zaman aşımı — ölçüm alınamadı.'
          : 'Bağlantı kurulamadı — ölçüm alınamadı.',
        endpoint: path,
      },
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * Ham GET. `T` varsayılan olarak `unknown`; skor için tipli sarmalayıcı
 * `fetchScore` var. Çağıran kendi daraltmasını yapar.
 */
export async function apiGet<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  return apiIstek<T>(path, { ...options, method: 'GET' });
}

/**
 * Ham POST. `apiGet` ile BİREBİR aynı hata/zaman aşımı/iptal davranışı —
 * tek fark yöntem ve JSON gövde. Yalnız POST isteyen uçlar için
 * (bugün: `/api/pulse`).
 */
export async function apiPost<T = unknown>(
  path: string,
  govde: unknown,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  return apiIstek<T>(path, { ...options, method: 'POST', govde });
}

/**
 * Adlandırılmış uç çağrısı — ekranlar yol dizgisi yazmaz.
 * `ENDPOINTS` değişince çağrı yerleri derleme zamanında yakalanır.
 */
export function apiGetFrom<T = unknown>(
  name: EndpointName,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  return apiGet<T>(ENDPOINTS[name], options);
}

export type ScoreOptions = Omit<RequestOptions, 'query'> & {
  /** Varsayılan 'orta' — uç noktanın VARSAYILAN_VADE'si ile aynı. */
  vade?: Vade;
  /** Verilmezse uç nokta 'US' varsayar; '.IS' eki sembolü BIST'e çeker. */
  market?: Market;
};

/**
 * Skor çağrısı: GET /api/score?symbols=AAPL,THYAO.IS&vade=orta
 *
 * NEDEN ÇOĞUL: uç nokta tek istekte en çok 8 sembol skorluyor ve dış
 * istekleri (Yahoo/SEC) aynı tur içinde paylaşıyor; sembol başına bir
 * çağrı atmak soğuk başlangıç cezasını 8'e katlar.
 *
 * NEDEN YEREL 8 DENETİMİ: uç nokta aşımı KIRPMIYOR, 400 `cok_sembol` ile
 * reddediyor (api/score.js yorumu: "Kırpmak YERİNE reddediyoruz").
 * Ağa çıkıp 400 yemek yerine aynı kodu burada üretiyoruz — kullanıcı
 * aynı cümleyi anında görür. Yinelenen sembolü BURADA atmıyoruz: uç
 * nokta sınırı yineleyi atmadan ÖNCE sayıyor (ayristir: sınır kontrolü
 * `gorulen` kümesinden önce), yerelde atsaydık 9 sembol geçerli görünüp
 * sunucuda reddedilirdi.
 */
export async function fetchScore(
  symbols: string[],
  options: ScoreOptions = {},
): Promise<ApiResult<ScoreResponse>> {
  return sembolUcu<ScoreResponse>('score', symbols, options);
}

// ---------------------------------------------------------------------
//  SEMBOL KAPISI — dört uç, TEK kapı
// ---------------------------------------------------------------------
//  NEDEN TAŞIYICI: /api/score · /api/recommend · /api/analyze ·
//  /api/compare dördü de AYNI sorgu ayrıştırmasını kullanıyor
//  (uç başlıkları: "Sorgu ayrıştırma /api/score ile BİREBİR aynı",
//  sunucu tarafında `api/_girdi.js ayristir()` TEK fonksiyon nesnesi).
//  İstemcide dört kopya yazmak, sunucunun 2026-10-14'te sildiği borcu
//  native tarafta yeniden açmak olurdu: biri 8'i 10 yapınca o uç sessizce
//  sunucudan ayrışırdı. Tek kapı → ayrışma fiziksel olarak mümkün değil.
//
//  NEDEN GÖVDE TÜRÜ PARAMETRE: dört uç iç içe sözleşme (score ⊂
//  recommend ⊂ analyze ⊂ compare) — kapı aynı, yalnız cevap zenginleşiyor.
// ---------------------------------------------------------------------
async function sembolUcu<T>(
  uc: 'score' | 'recommend' | 'analyze' | 'compare',
  symbols: string[],
  options: ScoreOptions = {},
): Promise<ApiResult<T>> {
  const { vade = 'orta', market, timeoutMs = SCORE_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS[uc];

  // Uç noktanın ayrıştırmasıyla aynı temizlik: trim + boşları at.
  const liste = symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean);

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
  if (liste.length > AZAMI_SEMBOL) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('cok_sembol', AZAMI_SEMBOL, liste.length) ?? 'Çok sembol.',
        endpoint: path,
        code: 'cok_sembol',
      },
    };
  }

  const ham = liste.join(',');
  if (ham.length > AZAMI_SORGU) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Sembol listesi çok uzun.',
        endpoint: path,
        code: 'too_long',
      },
    };
  }

  return apiGet<T>(path, {
    query: { symbols: ham, vade, market },
    timeoutMs,
    signal,
  });
}

/**
 * Öneri çağrısı: GET /api/recommend — skorun her şeyi + `plan`
 * (seviye · yakınlık · momentum · risk/ödül).
 *
 * NEDEN AYRI UÇ VE AYRI TÜR: Listeler/Keşfet ekranlarının gösterdiği
 * FİYAT bu uçtan geliyor (`plan.seviye.price`). /api/score'un `fa.price`
 * alanı SEC ayağına bağlı ve ölçülmüş bir gerçek var (2026-10-18, canlı:
 * NVDA ve AAPL için `sayac.sec.kesinti = 1` → `fa.price = null`), yani
 * skor ucuyla fiyat göstermek ABD hisselerinde boş satır üretirdi.
 */
export async function fetchRecommend(
  symbols: string[],
  options: ScoreOptions = {},
): Promise<ApiResult<RecommendResponse>> {
  return sembolUcu<RecommendResponse>('recommend', symbols, options);
}

/**
 * Analiz çağrısı: GET /api/analyze — önerinin her şeyi + `analiz`
 * (temel karar rozeti + 0-10 bütüncül skor + üç direk).
 */
export async function fetchAnalyze(
  symbols: string[],
  options: ScoreOptions = {},
): Promise<ApiResult<AnalyzeResponse>> {
  return sembolUcu<AnalyzeResponse>('analyze', symbols, options);
}

/**
 * Kıyas çağrısı: GET /api/compare — analizin her şeyi + `sira`
 * (motorun yaptığı sıralama) + `siralanamayan`.
 *
 * NEDEN SIRALAMA İSTEMCİDE DEĞİL: "alım sırası" bir KARAR; anahtarı
 * `dAtr`, eşitlik bozucusu `skor10` ve bunlar motorda yazılı. Burada
 * `sonuclar.sort(...)` yazmak, web ile native'in iki ayrı sıra
 * göstermesi demekti.
 */
export async function fetchCompare(
  symbols: string[],
  options: ScoreOptions = {},
): Promise<ApiResult<CompareResponse>> {
  return sembolUcu<CompareResponse>('compare', symbols, options);
}

/**
 * Tema çağrısı: GET /api/theme?q=<tema> — serbest metinden hisse adayı.
 *
 * NEDEN SEMBOL KAPISINDAN GEÇMEZ: girdisi sembol değil serbest metin;
 * sunucu da `ayristir()`i bu uçta BİLEREK çağırmıyor (api/theme.js
 * yorumu). Yalnız uzunluk sınırı (`AZAMI_SORGU` = 128) paylaşılıyor.
 *
 * DİKKAT — 200 ama SONUÇ YOK: ölçüldü (2026-10-18, üretim) ki anahtar
 * yokken cevap `{ candidates: [], error: 'no_key' }` ve HTTP 200.
 * Bu yüzden `ok:true` gelse bile ekran `error` alanına bakmak zorunda;
 * boş listeyi "ilgili hisse yok" diye göstermek YALAN olurdu —
 * doğrusu "ölçemedim, anahtar yok".
 */
export async function fetchTheme(
  query: string,
  options: Omit<RequestOptions, 'query'> = {},
): Promise<ApiResult<ThemeResponse>> {
  const q = String(query ?? '').trim();
  if (!q) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Tema yazılmadı.',
        endpoint: ENDPOINTS.theme,
        code: 'q_bos',
      },
    };
  }
  if (q.length > AZAMI_SORGU) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Tema metni çok uzun (en çok ' + AZAMI_SORGU + ' karakter).',
        endpoint: ENDPOINTS.theme,
        code: 'too_long',
      },
    };
  }
  return apiGet<ThemeResponse>(ENDPOINTS.theme, {
    query: { q },
    timeoutMs: options.timeoutMs ?? SCORE_TIMEOUT_MS,
    signal: options.signal,
  });
}

/**
 * Tema ucunun makine kodunu Türkçe cümleye çevirir.
 *
 * NEDEN BURADA: `kodMetni` skor kodları için yazıldı; tema kodları
 * (`no_key`, `llm_error`) ayrı küme. Ekranlar bu eşlemeyi kendi
 * içlerinde yaparsa iki ekran aynı duruma iki ayrı cümle der.
 */
export function temaKodMetni(code: string | null | undefined): string | null {
  switch (code) {
    case 'no_key':
      return 'Tematik keşif anahtarı sunucuda tanımlı değil — ölçüm yapılamadı.';
    case 'llm_error':
      return 'Tematik keşif servisi yanıt vermedi — ölçüm yapılamadı.';
    case 'q_yok':
    case 'q_bos':
      return 'Tema yazılmadı.';
    case 'too_long':
      return 'Tema metni çok uzun.';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------
//  GRAFİK UCU — sembol kapısından GEÇMEZ
// ---------------------------------------------------------------------
//  NEDEN `sembolUcu` KULLANILMIYOR: o kapı ÇOĞUL (`symbols=A,B`) ve
//  AZAMI_SEMBOL=8'e göre kurulu. Grafik ucu TEKİL (`symbol=A`), azamisi
//  1 ve virgüllü isteği KIRPMIYOR — reddediyor. ÖLÇÜLDÜ (2026-10-24,
//  üretim https://day-starter.vercel.app):
//    ?symbol=AAPL,MSFT → 400 {"error":"cok_sembol","azami":1}
//    ?symbol=^GSPC     → 400 {"error":"bad_symbol","gecersiz":["^GSPC"]}
//    ?range=2mo        → 400 {"error":"bad_range","izinli":[...]}
//    ?interval=1h      → 400 {"error":"bad_interval","izinli":[...]}
//  Ortak kapıya "bazen tekil" dalı eklemek, dört ucun paylaştığı tek
//  davranışı koşullu yapardı; ayrı kapı daha az borç.
//
//  NEDEN ZAMAN AŞIMI `SCORE_TIMEOUT_MS` DEĞİL: bu uç TEK dış istek
//  atıyor ve `maxDuration = 10` (ÖLÇÜLDÜ: ms = 262). 58 sn beklemek,
//  ölü bir bağlantıda kullanıcıyı bir dakika iskelet karşısında
//  tutmak olurdu. `DEFAULT_TIMEOUT_MS` (12 sn) sunucunun 10 sn'lik
//  tavanının hemen üstü: önce sunucu konuşur.
// ---------------------------------------------------------------------

export type ChartOptions = Omit<RequestOptions, 'query'> & {
  /** Varsayılan '6mo' — uç noktanın varsayılanıyla aynı. */
  range?: Aralik;
  /** Varsayılan '1d'. */
  interval?: Adim;
  market?: Market;
};

/**
 * Grafik çağrısı: GET /api/chart?symbol=AAPL&range=6mo&interval=1d
 *
 * Yerel kapı — ağa ÇIKMADAN `bad-request` döndürülen durumlar, hepsi
 * sunucunun aynı kodunu taşır (kullanıcı aynı cümleyi anında görür):
 *   · boş sembol            → `symbol_yok`
 *   · virgül içeriyor       → `cok_sembol` (azami 1)
 *   · `^` ile başlıyor      → `bad_symbol` (ENDEKS: uç ortak sembol
 *     biçimini kabul etmiyor; denemek kesin 400 demek)
 *   · uzunluk > AZAMI_SORGU → `too_long`
 *   · küme dışı range/interval → `bad_range` / `bad_interval`
 */
export async function fetchChart(
  symbol: string,
  options: ChartOptions = {},
): Promise<ApiResult<ChartResponse>> {
  const {
    range = VARSAYILAN_ARALIK,
    interval = VARSAYILAN_ADIM,
    market,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;
  const path = ENDPOINTS.chart;

  const sym = String(symbol ?? '').trim().toUpperCase();

  if (!sym) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('symbol_yok') ?? 'Sembol verilmedi.',
        endpoint: path,
        code: 'symbol_yok',
      },
    };
  }
  if (sym.includes(',')) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('cok_sembol', 1) ?? 'Bu uç tek sembol alır.',
        endpoint: path,
        code: 'cok_sembol',
      },
    };
  }
  if ((sym.startsWith('^') || sym.includes('=')) && !endeksMi(sym)) {
    // SÖZLÜK DIŞI özel sembol. ÖLÇÜLDÜ (2026-10-27): `api/chart.js:245`
    // `cozEndeks(ham) || temizleSembol(...)` — sözlükte olmayan `^`/`=`
    // sembolü `SEMBOL_BICIM`e de uymadığı için kesin 400 `bad_symbol`.
    // Sözlükteki dördü (ENDEKS_SEMBOLLER) artık GEÇİYOR, kapı onları
    // durdurmuyor.
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Bu sembol grafik ucunun tanıdığı kümede değil.',
        endpoint: path,
        code: 'bad_symbol',
      },
    };
  }
  if (sym.length > AZAMI_SORGU) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('too_long') ?? 'Sembol çok uzun.',
        endpoint: path,
        code: 'too_long',
      },
    };
  }
  if (!(ARALIKLAR as readonly string[]).includes(range)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('bad_range') ?? 'Geçersiz aralık.',
        endpoint: path,
        code: 'bad_range',
      },
    };
  }
  if (!(ADIMLAR as readonly string[]).includes(interval)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('bad_interval') ?? 'Geçersiz adım.',
        endpoint: path,
        code: 'bad_interval',
      },
    };
  }

  return apiGet<ChartResponse>(path, {
    query: { symbol: sym, range, interval, market },
    timeoutMs,
    signal,
  });
}

export type NewsOptions = Omit<RequestOptions, 'query'> & {
  /** Besleme yereli. Verilmezse uç noktanın varsayılanı (TR) gönderilir. */
  market?: HaberPazar;
  /** 1..AZAMI_MADDE. Verilmezse uç noktanın varsayılanı (10) kullanılır. */
  limit?: number;
};

/**
 * `/api/news` — manşet metni. `fetchChart` deseninin BİREBİR aynısı:
 * kesin 400 üretecek istekler AĞA ÇIKMADAN burada kesilir, kalanı
 * `apiGet`e devredilir (tek hata eşlemesi orada).
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn), `SCORE_TIMEOUT_MS` DEĞİL: uç
 * `maxDuration: 10` ile çalışıyor ve TEK dış istek yapıyor (api/news.js:83
 * gerekçesi · `_haber.js HABER_ISTEK_MS = 6000`). /api/chart ile aynı
 * kademe; skorun 58 sn'si buraya kopyalanmaz.
 *
 * NEDEN BOŞ LİSTE HATA DEĞİL: uç 200 + `maddeler: []` + `adet: 0` +
 * `tam: true` dönebilir ve bu ÖLÇÜLMÜŞ bir cevaptır ("bu sorguda haber
 * yok"). Burada `no-data`ya çevirmek, ekrana "ölçemedim" tonunu
 * gösterirdi; gövde `ok: true` olarak geçirilir, ekran `adet === 0` dalını
 * `VeriYok` ile anlatır.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır, yeni kod uydurulmadı):
 *   · boş q                   → `missing_q`
 *   · q uzunluğu > 256        → `too_long`
 *   · küme dışı market        → `bad_market`
 *   · tamsayı olmayan/<1 limit→ `bad_limit`
 *   · limit > 25              → `limit_buyuk`
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchNews(
  query: string,
  options: NewsOptions = {},
): Promise<ApiResult<NewsResponse>> {
  const { market = VARSAYILAN_HABER_PAZAR, limit, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.news;

  // `q` SERBEST METİN: sembol kapısından (büyük harfe çevirme, biçim
  // denetimi) GEÇİRİLMİYOR — "Fed faiz kararı" geçerli bir haber sorgusu
  // (gerekçe: api/news.js:32-36).
  const q = String(query ?? '').trim();

  if (!q) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('missing_q') ?? 'Haber sorgusu verilmedi.',
        endpoint: path,
        code: 'missing_q',
      },
    };
  }
  if (q.length > AZAMI_HABER_SORGU) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        // `kodMetni('too_long')` SKOR cümlesini ("sembol listesi çok
        // uzun") döndürür; haber sorgusu için yanlış olur.
        message: 'Haber sorgusu çok uzun (en çok ' + AZAMI_HABER_SORGU + ' karakter).',
        endpoint: path,
        code: 'too_long',
      },
    };
  }
  if (!(HABER_PAZARLAR as readonly string[]).includes(market)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('bad_market') ?? 'Geçersiz pazar.',
        endpoint: path,
        code: 'bad_market',
      },
    };
  }
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) {
      return {
        ok: false,
        error: {
          kind: 'bad-request',
          message: kodMetni('bad_limit') ?? 'Geçersiz madde sayısı.',
          endpoint: path,
          code: 'bad_limit',
        },
      };
    }
    if (limit > AZAMI_MADDE) {
      return {
        ok: false,
        error: {
          kind: 'bad-request',
          message: kodMetni('limit_buyuk', AZAMI_MADDE, limit) ?? 'Çok fazla manşet istendi.',
          endpoint: path,
          code: 'limit_buyuk',
        },
      };
    }
  }

  return apiGet<NewsResponse>(path, {
    query: { q, market, limit },
    timeoutMs,
    signal,
  });
}

export type PulseOptions = Omit<RequestOptions, 'query'> & {
  /** Sembol haberinin yereli. Verilmezse uç noktanın varsayılanı (TR). */
  haberPazari?: HaberPazar;
};

/**
 * `/api/pulse` — ⚡ Makro Nabız. `fetchNews` deseninin aynısı: kesin 400
 * üretecek istekler AĞA ÇIKMADAN burada kesilir, kalanı `apiPost`a
 * devredilir (tek hata eşlemesi orada: 400 → `bad-request` [yeniden
 * deneme YOK], 502/ağ/zaman aşımı → `unmeasured` [yeniden deneme VAR]).
 *
 * NEDEN `apiGet` DEĞİL: uç yalnız POST kabul ediyor (api/pulse.js → 405
 * `method_not_allowed`).
 *
 * NEDEN MANŞET GÖNDERMİYORUZ: uç iki yol sunuyor (istemci manşeti verir
 * / uç kendi tarar). Native istemci RSS tarayamaz — tarasa bile ölçümü
 * (kaç besleme hata verdi, kaçı zaman aşımına uğradı) raporlayamaz.
 * Bu yüzden `q` ile SUNUCU YOLU açılıyor; cevap `kaynak: 'sunucu'` ve
 * `haberler.sayac` ile ölçümünü kendisi bildiriyor.
 *
 * NEDEN KONJONKTÜR GİRDİSİ (`genislik`/`enflasyonBaskisi`/`risk`)
 * GÖNDERMİYORUZ: o sayılar ÖLÇÜLMÜŞ piyasa genişliği / baskı / risk
 * girdileri ve bu uygulamada ölçen bir kaynak YOK. Uydurma sayı
 * göndermek, ucu kandırıp ekrana "ölçülmüş" görünen bir faz bastırmak
 * olurdu. Verilmeyince uç `konjonktur: null` + `eksik` döner; ekran da
 * bunu AÇIKÇA "ölçülmedi" diye yazar.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn): uç `maxDuration: 10` ile çalışıyor
 * (ÖLÇÜLDÜ 2026-10-25: `q='Fed faiz'` → 200, 960 ms). /api/news ile aynı
 * kademe; skorun 58 sn'si buraya kopyalanmaz.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır, yeni kod uydurulmadı):
 *   · boş q                   → `girdi_yok`  (uç bu durumda sunucu
 *     yolunu açmayıp 400 `faizHaberleri_yok` döner; yerel kapı asıl
 *     nedeni söylüyor)
 *   · q uzunluğu > 256        → `too_long`
 *   · küme dışı haberPazari   → `bad_haberPazari`
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchPulse(
  query: string,
  options: PulseOptions = {},
): Promise<ApiResult<PulseResponse>> {
  const { haberPazari = VARSAYILAN_HABER_PAZAR, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.pulse;

  // `q` SERBEST METİN — sembol kapısından geçirilmiyor ("Fed faiz"
  // geçerli bir makro sorgu).
  const q = String(query ?? '').trim();

  if (!q) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('girdi_yok') ?? 'Nabız için girdi verilmedi.',
        endpoint: path,
        code: 'girdi_yok',
      },
    };
  }
  if (q.length > AZAMI_HABER_SORGU) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        // `kodMetni('too_long')` SKOR cümlesini ("sembol listesi çok
        // uzun") döndürür; makro sorgu için yanlış olur.
        message: 'Nabız sorgusu çok uzun (en çok ' + AZAMI_HABER_SORGU + ' karakter).',
        endpoint: path,
        code: 'too_long',
      },
    };
  }
  if (!(HABER_PAZARLAR as readonly string[]).includes(haberPazari)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('bad_haberPazari') ?? 'Geçersiz pazar.',
        endpoint: path,
        code: 'bad_haberPazari',
      },
    };
  }

  return apiPost<PulseResponse>(path, { q, haberPazari }, { timeoutMs, signal });
}

/**
 * `/api/causal` — 📉 Günün Nedeni. `fetchPulse` deseninin BİREBİR
 * aynısı: kesin 400 üretecek istekler AĞA ÇIKMADAN burada kesilir,
 * kalanı `apiPost`a devredilir (tek hata eşlemesi orada).
 *
 * NEDEN `apiGet` DEĞİL: uç yalnız POST kabul ediyor (api/causal.js:211
 * → 405 `method_not_allowed`). Gerekçesi uç başlığında ölçülmüş: girdi
 * iki büyük dizi ve `AZAMI_SORGU = 128` sınırını ilk konseptte aşıyor.
 *
 * ⚠️ GÜNDEMİ BU İŞLEV ÜRETMEZ — ÇAĞIRAN VERİR. Uç ağa HİÇ çıkmıyor
 * (api/causal.js:38-40): gündem taramasını istemciden bekliyor ve web
 * tarafında bunu `app.js computeAgenda()` yapıyor. Native istemcide o
 * tarayıcı YOK; bu yüzden `gundem` bu işlevin PARAMETRESİ. Gündem
 * ÜRETİMİ (RSS taraması + konsept çıkarımı) SUNUCU İŞİ ve AYRI BİR
 * ŞERİDE devredilecek — burada uydurma bir gündem kurmak, ucu
 * ölçülmemiş girdiyle besleyip ekrana "ölçülmüş" görünen bir bağ
 * bastırmak olurdu.
 *
 * NEDEN BU KATMANDA EŞİK/SIRALAMA YOK: gürültü eşiği (1,6), en iyi 2
 * bağ seçimi ve "belirgin hareket" kararı MOTORDA
 * (api/_motor.js:1752-1763). Buraya bir sayı yazmak ekranla sunucuyu
 * sessizce ayrıştırırdı.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn): uç `maxDuration: 10` ile çalışıyor
 * ve AĞA ÇIKMIYOR (api/causal.js:92-96) — saf hesap. /api/pulse ve
 * /api/news ile aynı kademe; skorun 58 sn'si buraya kopyalanmaz.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır, yeni kod uydurulmadı):
 *   · `hareketler` dizi değil   → `hareketler_yok`
 *   · `gundem` dizi değil       → `gundem_yok`
 *   · hareket sayısı > 12       → `cok_hareket`
 *   · konsept sayısı > 60       → `cok_konsept`
 *   · küme dışı `kind`          → `bad_kind`
 *   · sonlu olmayan `pct`       → `bad_pct`
 *   · sonlu/≥0 olmayan `notable`→ `bad_notable`
 *   · boş konsept `key`         → `konsept_key_yok`
 *
 * ÖLÇÜLDÜ — YEREL BAYT KAPISI YOK: ucun 65536 baytlık denetimi YALNIZ
 * gövde DİZGE geldiğinde çalışıyor (api/causal.js:228-233); Vercel Node
 * runtime `application/json`ı kendi ayrıştırdığı için bizim isteğimizde
 * o dal hiç yürümez. Sayı kapıları (12 × 60) yükü zaten sınırlıyor;
 * ölçmediğim bir bayt eşiğini istemciye yazmadım.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchCausal(
  govde: CausalRequest,
  options: Omit<RequestOptions, 'query'> = {},
): Promise<ApiResult<CausalResponse>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.causal;

  const kapi = (code: string, message?: string): ApiResult<CausalResponse> => ({
    ok: false,
    error: {
      kind: 'bad-request',
      message: message ?? kodMetni(code) ?? 'İstek karşılanamadı.',
      endpoint: path,
      code,
    },
  });

  const hareketler = govde?.hareketler;
  const gundem = govde?.gundem;

  if (!Array.isArray(hareketler)) return kapi('hareketler_yok');
  if (!Array.isArray(gundem)) return kapi('gundem_yok');
  if (hareketler.length > AZAMI_HAREKET) {
    return kapi(
      'cok_hareket',
      kodMetni('cok_hareket', AZAMI_HAREKET, hareketler.length) ?? undefined,
    );
  }
  if (gundem.length > AZAMI_KONSEPT) {
    return kapi('cok_konsept', kodMetni('cok_konsept', AZAMI_KONSEPT, gundem.length) ?? undefined);
  }

  for (const h of hareketler) {
    if (!h || typeof h !== 'object') return kapi('bad_hareket');
    if (!(NEDEN_KINDLER as readonly string[]).includes(h.kind)) return kapi('bad_kind');
    // HAM SAYI: yuvarlama/ölçekleme YOK — yalnız "sonlu mu" sorusu.
    if (!Number.isFinite(h.pct)) return kapi('bad_pct');
    if (!Number.isFinite(h.notable) || h.notable < 0) return kapi('bad_notable');
  }
  for (const c of gundem) {
    if (!c || typeof c !== 'object') return kapi('bad_konsept');
    if (!String(c.key ?? '').trim()) return kapi('konsept_key_yok');
  }

  // Gövde OLDUĞU GİBİ gidiyor: alan budama/normalleştirme YAPILMIYOR.
  // Ucun `ayristirGovde`si motorun okuduğu alanları kendi süzüyor
  // (api/causal.js:179-198) ve ikinci bir süzgeç, bir gün motor yeni bir
  // alan okumaya başladığında onu istemcide sessizce düşürürdü.
  return apiPost<CausalResponse>(path, govde, { timeoutMs, signal });
}

// ---------------------------------------------------------------------
//  İZLEME LİSTESİ SENKRONU — /api/watchlist
// ---------------------------------------------------------------------
//  ⚠️⚠️ GÜVENLİK UYARISI — BU UCUN KİMLİK DOĞRULAMASI YOK ⚠️⚠️
//
//  ÖLÇÜLDÜ (api/watchlist.js:30-59, kaynak okuma): tek erişim kapısı
//  `?code=` parametresi ve doğrulaması YALNIZCA BİÇİM —
//  `/^[a-z0-9_-]{4,40}$/i`. Sunucu kodun KİME ait olduğunu bilmiyor,
//  oturum/token/imza YOK, CORS `*` (api/watchlist.js:24) ve POST aynı
//  kapıdan geçiyor. SONUÇ:
//    · Kodu bilen ya da TAHMİN EDEN herkes o kodun listesini OKUR.
//    · Aynı kişi o listeyi SİLEBİLİR / DEĞİŞTİREBİLİR (POST son-yazan-
//      kazanır, api/watchlist.js:99).
//    · "atahan-7a2b" gibi insan-okur bir kod, 4 karakterlik kodlar ve
//      sözlükten türeyen kodlar pratikte HERKESE AÇIKTIR.
//  Bu kusur gizlilik politikasında açıkça duyuruldu. Bu yüzden:
//
//  1) HİÇBİR `code` DEĞERİ BU KAYNAKTA YOK — ne gerçek, ne örnek, ne
//     varsayılan. `code` DAİMA çağrıdan parametre gelir; varsayılan
//     üretmek, tüm kurulumların aynı tahmin edilebilir kutuyu
//     paylaşması demekti.
//  2) Kullanıcı e-postası, gizli anahtar, token BU UCA HİÇ GÖNDERİLMEZ
//     ve bu dosyada hiçbir yerde SAKLANMAZ. Gönderilen tek şey sembol
//     listesi (`cleanList` şeması: symbol/market/query).
//  3) Ekran, kodu kullanıcıya "paylaşılan sır" olarak anlatmak
//     zorundadır; "hesap" ya da "giriş" demek yanlış olurdu.
//
//  ÖLÇÜLDÜ — HATA GÖVDESİ MAKİNE KODU DEĞİL: bu uç İngilizce cümle
//  döndürüyor (api/watchlist.js:56, :83, :96, :104, :106), öteki uçların
//  `{error:'<kod>'}` deseninde DEĞİL. `kodMetni` bu yüzden eşleşmez ve
//  `ApiError.message` genel cümleye düşer — bu KASITLI: sunucunun
//  cümlesi hem İngilizce, hem de 500 dalında iç hata metni (`e.message`)
//  taşıyabiliyor; ekrana basmak bilgi sızdırmak olurdu. Ham metin yalnız
//  teşhis için `ApiError.code`da kalır, ekranda gösterilmez.
//
//  NEDEN `DEFAULT_TIMEOUT_MS`: uç `maxDuration: 10` (api/watchlist.js:18)
//  ve tek KV turu atıyor. /api/chart · /api/news ile aynı kademe.
// ---------------------------------------------------------------------

/** Yerel `code` kapısı — ucun KENDİ biçim kuralı (api/watchlist.js:31). */
function watchlistKodKapisi(code: string): { kod: string } | { hata: ApiError } {
  const kod = String(code ?? '').trim();
  if (!WATCHLIST_CODE_BICIM.test(kod)) {
    return {
      hata: {
        kind: 'bad-request',
        // Kullanıcıya KODUN KENDİSİ tekrar edilmiyor (ekran kaydına /
        // hata günlüğüne sır düşmesin); yalnız kural anlatılıyor.
        message: 'Senkron kodu geçersiz: 4-40 karakter, harf/rakam/alt çizgi/kısa çizgi.',
        endpoint: ENDPOINTS.watchlist,
        // Ucun makine kodu YOK (İngilizce cümle dönüyor); yerel kapı
        // kendi adını taşıyor ki iki yerde iki ad olmasın.
        code: 'bad_code',
      },
    };
  }
  return { kod };
}

/**
 * İzleme listesi/portföy OKUMA: GET /api/watchlist?code=<paylaşılan kod>
 *
 * ⚠️ Yukarıdaki GÜVENLİK bloğunu okumadan çağırma: bu uçta kimlik
 * doğrulaması YOK, `code` paylaşılan bir sırdır.
 *
 * ÖLÇÜLDÜ (api/watchlist.js:62-73): 200 + `{ list, portfolio, ui,
 * updatedAt }`. `list`/`portfolio` kayıt yoksa BOŞ DİZİ — bu "bu kodda
 * liste yok" demek, "ölçemedim" DEĞİL; `no-data`ya çevirmiyoruz.
 * `updatedAt` ise `null` gelebilir ve o "hiç yazılmamış" demek.
 *
 * `ui` alanı TİPLENMEDİ (`unknown`): şekli ucun sözleşmesi değil, web
 * istemcisinin iç durumu (bkz. `types.ts` başlığı). Native onu
 * benimsemez; okuyan kod kendi daraltmasını yazmak zorundadır.
 */
export async function fetchWatchlist(
  code: string,
  options: Omit<RequestOptions, 'query'> = {},
): Promise<ApiResult<WatchlistResponse>> {
  const kapi = watchlistKodKapisi(code);
  if ('hata' in kapi) return { ok: false, error: kapi.hata };

  return apiGet<WatchlistResponse>(ENDPOINTS.watchlist, {
    query: { code: kapi.kod },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
  });
}

/**
 * İzleme listesi/portföy YAZMA: POST /api/watchlist?code=<paylaşılan kod>
 *
 * ⚠️ Yukarıdaki GÜVENLİK bloğu BU İŞLEV İÇİN DAHA AĞIR: yazma da aynı
 * doğrulanmamış `code` ile açık. Aynı kodu kullanan başka bir cihaz
 * (ya da kodu tahmin eden biri) bu yazmayı EZEBİLİR — uç son-yazan-
 * kazanır (api/watchlist.js:99). Ekran bunu bir yedek garantisi gibi
 * anlatmamalı.
 *
 * ÖLÇÜLDÜ (api/watchlist.js:76-101):
 *   · `list` VE `portfolio` ikisi de dizi değilse → 400 (İngilizce cümle).
 *     Yerel kapı aynı durumu ağa çıkmadan kesiyor.
 *   · Kayıtlar `cleanList`ten geçiyor: `market` 'BIST'/'US' dışındaysa ya
 *     da `symbol` biçimi tutmazsa kayıt SESSİZCE DÜŞÜYOR. Bu yüzden
 *     cevabın `count`/`portfolioCount` alanı okunmalı — gönderilenden
 *     küçükse bir şey elenmiş demektir. İstemci burada kayıt SÜZMÜYOR:
 *     sunucunun süzgecini kopyalamak, bir gün biri yalnız birini
 *     güncellediğinde iki ayrı şema demekti.
 *   · Temizlenmiş yük > 256 KB → 413.
 *
 * `ui` ALANI GÖNDERİLMİYOR: uç onu kabul ediyor (api/watchlist.js:91)
 * ama şekli web istemcisinin iç durumu ve native'de ÖLÇÜLMÜŞ bir
 * karşılığı yok. Uydurma bir `ui` yazmak, web'in o kodu bir sonraki
 * açılışında kendi listelerini BİZİM uydurmamızla kurmasına yol
 * açabilirdi (app.js:2131 `adoptRemoteState`). Bu yüzden gövde yalnız
 * `list`/`portfolio` taşır.
 */
export async function pushWatchlist(
  code: string,
  govde: WatchlistYazGovde,
  options: Omit<RequestOptions, 'query'> = {},
): Promise<ApiResult<WatchlistYazResponse>> {
  const kapi = watchlistKodKapisi(code);
  if ('hata' in kapi) return { ok: false, error: kapi.hata };

  const list = govde?.list;
  const portfolio = govde?.portfolio;
  if (!Array.isArray(list) && !Array.isArray(portfolio)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Yazılacak liste verilmedi.',
        endpoint: ENDPOINTS.watchlist,
        code: 'liste_yok',
      },
    };
  }

  const govdeDizisi: WatchlistYazGovde = {};
  if (Array.isArray(list)) govdeDizisi.list = list;
  if (Array.isArray(portfolio)) govdeDizisi.portfolio = portfolio;

  return apiPost<WatchlistYazResponse>(ENDPOINTS.watchlist, govdeDizisi, {
    query: { code: kapi.kod },
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: options.signal,
  });
}

// =====================================================================
//  KEŞİF BEŞLİSİ — tarama · sektör · radar · backtest · değer
// ---------------------------------------------------------------------
//  NE: `ENDPOINTS` içinde adresleri duran beş ucun istemci işlevleri.
//  NEDEN ŞİMDİ: adresler listede duruyordu ama ÇAĞIRAN YOKTU (DEVAM.md
//  §4) — yani beş uç ekranlardan erişilemez durumdaydı.
//
//  NEDEN BEŞİ BİR BLOK: beşi de `api/_kesif.js` içinde yaşıyor, aynı
//  `kapi()` kapısını, aynı 405/503 davranışını ve aynı makine kodu
//  kümesini paylaşıyor. Ortak kod→cümle eşlemesi (`kesifKodMetni`) tek
//  yerde olmazsa iki ekran aynı duruma iki ayrı cümle der.
//
//  ⚠️ BU BLOKTA EŞİK / AĞIRLIK / FORMÜL / SKOR MATEMATİĞİ YOK.
//  Yapılan tek iş: TAŞIMA + TİP + Türkçe hata cümlesi + kesin 400
//  üretecek isteği ağa çıkmadan kesmek. Beyaz listeler motorun
//  sözlüklerinin KOPYASI, karar değil.
//
//  ÖLÇÜLDÜ (2026-10-27, kaynak okuma — CANLI ÇAĞRI YAPILMADI):
//  alan adları, makine kodları ve beyaz listeler `api/_kesif.js` ile
//  birebir; küme değerleri `api/_motor.js`ten.
//  ⚠️ ÖLÇÜLMEDİ: beş ucun canlı cevabı (ağ erişimi bu şeritte yoktu) —
//  tipler kaynaktan türetildi, üretimden doğrulanmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/**
 * Backtest zaman aşımı.
 *
 * NEDEN AYRI: keşif beşlisinin DÖRDÜ ağa HİÇ ÇIKMIYOR (api/_kesif.js:
 * tarama/sektör/değer girdisini istemciden alıyor, radar saf sözlük
 * okuması) — onlar için `DEFAULT_TIMEOUT_MS` (12 sn) fazlasıyla yeter.
 * BACKTEST TEK AĞA ÇIKAN UÇ: mum serisini Yahoo'dan çekiyor, hem de
 * `5y/1d` gibi uzun seriyi. Beşi de `api/proxy.js` üstünden taşındığı
 * için sunucu tavanı o dosyanın `maxDuration: 30`u (api/proxy.js:8).
 * 28 sn: tavanın hemen altı — önce biz değil SUNUCU konuşur, yani
 * "ölçemedim" yerine sunucunun kendi makine kodunu görürüz.
 * Skorun 58 sn'si buraya kopyalanmaz: o uç 8 sembol × iki kaynak
 * koşturuyor, bu uç tek sembol tek seri.
 */
export const BACKTEST_TIMEOUT_MS = 28_000;

/**
 * Pazar beyaz listesi — `api/_girdi.js:73` `PAZARLAR` kopyası.
 * NEDEN KOPYA: uç küme dışı pazarı KIRPMIYOR, 400 `bad_market` ile
 * reddediyor. Aynı kodu yerelde üretmek kullanıcıya aynı cümleyi
 * anında gösterir. Karar değil, beyaz liste.
 */
const KESIF_PAZARLAR: readonly Market[] = ['US', 'BIST'];

/**
 * Vade beyaz listesi — motorun `TA_HORIZON` anahtarları
 * (api/_motor.js:1996). `Vade` türü derleme zamanında zorluyor; bu dizi
 * ÇALIŞMA ZAMANI kapısı (JS tarafından, tipsiz çağrıyla gelen değer).
 */
const KESIF_VADELER: readonly Vade[] = ['gunici', 'kisa', 'orta', 'uzun'];

/**
 * Keşif uçlarının makine kodu → Türkçe cümle.
 *
 * NEDEN `kodMetni` YETMİYOR: o eşleme SKOR/GRAFİK kodları için yazıldı
 * ve bazı kodların ANLAMI BU UÇLARDA FARKLI. En net örnek `too_long`:
 * skor tarafında "sembol listesi çok uzun", radar tarafında "tema/sektör
 * metni çok uzun". Aynı koda iki anlam yüklemek yerine ayrı küme.
 *
 * Cümlelerde TAVSİYE DİLİ YOK: ne "fırsat", ne "kazanç", ne "al/sat".
 * Bilinmeyen kod → `null`; kodu yutmuyoruz, `error.code`'da kalır.
 */
export function kesifKodMetni(
  code: string | null | undefined,
  azami?: number,
  istenen?: number,
): string | null {
  switch (code) {
    // ----- ortak kapı (api/_kesif.js kapi/govdeAl) -----
    case 'method_not_allowed':
      return 'Bu uç bu yöntemi kabul etmiyor.';
    case 'motor_kurulamadi':
      return 'Hesap motoru yüklenemedi — ölçüm yapılamadı.';
    case 'govde_yok':
      return 'İstek gövdesi boş.';
    case 'bozuk_json':
      return 'İstek gövdesi okunamadı.';
    case 'govde_buyuk':
      return 'İstek gövdesi çok büyük.';

    // ----- ölçüm listesi (tarama + sektör) -----
    case 'olcumler_yok':
      return 'Ölçüm listesi verilmedi.';
    case 'olcumler_bos':
      return 'Ölçüm listesi boş.';
    case 'cok_olcum':
      return (
        'En çok ' +
        (azami ?? AZAMI_OLCUM) +
        ' ölçüm kaydı gönderilebilir (' +
        (istenen ?? 0) +
        ' gönderildi).'
      );
    case 'bad_olcum':
      return 'Ölçüm kaydı okunamadı.';
    case 'symbols_bos':
      return 'Ölçüm kaydında sembol yok.';
    case 'bad_market':
      return 'Geçersiz pazar.';
    case 'bad_symbol':
      return 'Sembol biçimi tanınmadı.';
    case 'too_long':
      return 'Girdi çok uzun.';

    // ----- tarama -----
    case 'bad_preset':
      return 'Tanınmayan tarama önayarı.';
    case 'tarama_hesaplanamadi':
      return 'Tarama hesaplanamadı — ölçüm yapılamadı.';

    // ----- sektör -----
    case 'bad_sira':
      return 'Tanınmayan sıralama kipi.';
    case 'sektor_hesaplanamadi':
      return 'Sektör dağılımı hesaplanamadı — ölçüm yapılamadı.';

    // ----- radar -----
    case 'bad_tema':
      return 'Tanınmayan tema.';
    case 'bad_sektor':
      return 'Tanınmayan sektör.';
    case 'radar_alinamadi':
      return 'Radar sözlüğü okunamadı — ölçüm yapılamadı.';

    // ----- backtest -----
    case 'symbol_yok':
      return 'Sembol verilmedi.';
    case 'cok_sembol':
      return 'Bu uç tek sembol alır; birden çok sembol verildi.';
    case 'bad_vade':
      return 'Tanınmayan vade.';
    case 'bad_range':
      return 'Tanınmayan aralık.';
    case 'bad_interval':
      return 'Tanınmayan adım.';
    case 'backtest_hesaplanamadi':
      return 'Geçmiş ölçümü hesaplanamadı — ölçüm yapılamadı.';

    // ----- değer -----
    case 'bad_tur':
      return 'Tanınmayan tür.';
    case 'belge_yok':
      return 'Değerleme belgesi verilmedi.';
    case 'deger_hesaplanamadi':
      return 'Değer ölçümü hesaplanamadı — ölçüm yapılamadı.';

    // ----- arama (api/_kesif.js aramaHandler) -----
    case 'q_yok':
      return 'Arama terimi verilmedi.';
    case 'bad_limit':
      return 'Geçersiz aday sayısı (en az ' + 1 + ', en çok ' + ARAMA_AZAMI + ').';
    case 'arama_yapilamadi':
      return 'Arama yapılamadı — ölçüm yapılamadı.';

    default:
      return null;
  }
}

/** Keşif uçlarının yerel kapısı — `fetchCausal` desenin birebir aynısı. */
function kesifKapi<T>(
  path: string,
  code: string,
  message?: string,
): ApiResult<T> {
  return {
    ok: false,
    error: {
      kind: 'bad-request',
      message: message ?? kesifKodMetni(code) ?? 'İstek karşılanamadı.',
      endpoint: path,
      code,
    },
  };
}

/**
 * Ölçüm listesi kapısı — tarama ve sektör ucunun PAYLAŞTIĞI kapı.
 *
 * NEDEN TEK KAPI: sunucuda da tek fonksiyon (`api/_kesif.js`
 * `ayristirOlcumler`). İki kopya yazmak, biri sınırı değiştirince bir
 * ucun sessizce sunucudan ayrışması demek olurdu.
 *
 * Kodlar SUNUCUNUN KENDİ kodları, sırası da sunucudaki sıra — yeni kod
 * uydurulmadı. `null` → kapı açık.
 */
function olcumKapisi<T>(path: string, olcumler: unknown): ApiResult<T> | null {
  if (!Array.isArray(olcumler)) return kesifKapi<T>(path, 'olcumler_yok');
  if (!olcumler.length) return kesifKapi<T>(path, 'olcumler_bos');
  if (olcumler.length > AZAMI_OLCUM) {
    return kesifKapi<T>(
      path,
      'cok_olcum',
      kesifKodMetni('cok_olcum', AZAMI_OLCUM, olcumler.length) ?? undefined,
    );
  }
  for (const o of olcumler) {
    if (!o || typeof o !== 'object') return kesifKapi<T>(path, 'bad_olcum');
    const kayit = o as OlcumKayit;
    const ham = String(kayit.symbol ?? '').trim();
    if (!ham) return kesifKapi<T>(path, 'symbols_bos');
    if (ham.length > AZAMI_SORGU) return kesifKapi<T>(path, 'too_long');
    if (kayit.market != null && !KESIF_PAZARLAR.includes(kayit.market)) {
      return kesifKapi<T>(path, 'bad_market');
    }
  }
  return null;
}

export type TaramaOptions = Omit<RequestOptions, 'query'>;

/**
 * Tarama çağrısı: POST /api/tarama
 *
 * NE: bir önayar (`value` · `growth` · `quality`) ve ÖLÇÜM KAYITLARI
 * gönderilir; uç her kayda motorun tarama skorunu verip skora göre
 * AZALAN sırada döner.
 *
 * NEDEN POST: girdi temel kayıt LİSTESİ (en çok 120 kayıt × 18 alan) —
 * sorgu dizgisine sığmaz. Uç da yalnız POST kabul ediyor
 * (api/_kesif.js: `kapi(req, res, 'POST, OPTIONS')` → 405
 * `method_not_allowed`).
 *
 * ⚠️ ÖLÇÜMLERİ BU İŞLEV ÜRETMEZ — ÇAĞIRAN VERİR. Uç AĞA ÇIKMIYOR:
 * temel kayıtları istemciden bekliyor (web tarafında bunu `/api/yfin`
 * taraması yapıyor). Burada uydurma bir ölçüm kurmak, ucu
 * ölçülmemiş girdiyle besleyip ekrana "ölçülmüş" görünen bir skor
 * bastırmak olurdu. Eksik alan `null` geçer — 0 GEÇMEZ (0 bir F/K'sı
 * olmayan şirketi "en ucuz" gösterir).
 *
 * ⚠️ `atlanan[]` BOŞ DEĞİLSE EKRAN SUSMAZ: `ok: true` "her şey ölçüldü"
 * demek değil. Skorlanamayan kayıtlar oraya `neden` ile yazılıyor
 * ("veri yok" ≠ "düşük skor").
 *
 * NEDEN `DEFAULT_TIMEOUT_MS`: uç AĞA ÇIKMIYOR, saf hesap — gelen
 * kayıtları motordan geçirip sıralıyor.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır):
 *   · küme dışı önayar            → `bad_preset`
 *   · `olcumler` dizi değil       → `olcumler_yok`
 *   · boş liste                   → `olcumler_bos`
 *   · kayıt sayısı > 120          → `cok_olcum`
 *   · kayıt nesne değil           → `bad_olcum`
 *   · boş sembol                  → `symbols_bos`
 *   · sembol > 128 karakter       → `too_long`
 *   · küme dışı pazar             → `bad_market`
 *
 * ÖLÇÜLDÜ — YEREL BAYT KAPISI YOK: ucun 65536 baytlık denetimi YALNIZ
 * gövde DİZGE geldiğinde çalışıyor; Vercel Node runtime JSON'u kendi
 * ayrıştırdığı için o dal bizim isteğimizde hiç yürümez. 120 kayıt
 * kapısı yükü zaten sınırlıyor; ölçmediğim bir bayt eşiği yazmadım.
 *
 * ⚠️ `bad_symbol` YEREL OLARAK DENETLENMEDİ: sunucu sembol biçimini
 * `api/_girdi.js` düzenli ifadesi + endeks sözlüğüyle çözüyor; o
 * ifadeyi buraya kopyalamak, sunucu onu genişlettiğinde istemcinin
 * geçerli sembolü sessizce reddetmesine yol açardı.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchTarama(
  preset: TaramaPreset,
  olcumler: OlcumKayit[],
  options: TaramaOptions = {},
): Promise<ApiResult<TaramaResponse>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.tarama;

  if (!(TARAMA_PRESETLER as readonly string[]).includes(String(preset))) {
    return kesifKapi<TaramaResponse>(path, 'bad_preset');
  }

  const kapali = olcumKapisi<TaramaResponse>(path, olcumler);
  if (kapali) return kapali;

  return apiPost<TaramaResponse>(path, { preset, olcumler }, { timeoutMs, signal });
}

export type SektorOptions = Omit<RequestOptions, 'query'> & {
  /** Varsayılan 'cheap' — ucun `VARSAYILAN_SIRA`sı ile aynı. */
  sira?: SiraKip;
};

/**
 * Sektör dağılımı: POST /api/sektor
 *
 * NE: aynı ölçüm kayıtları sektör gruplarına bölünür; her grup için
 * medyan F/K · ileri F/K · büyüme · marj · PEG döner.
 *
 * NEDEN POST + NEDEN AYNI KAPI: girdi tarama ucuyla BİREBİR aynı ölçüm
 * listesi (sunucuda da aynı `ayristirOlcumler`), bu yüzden yerel kapı
 * da paylaşılıyor.
 *
 * ⚠️ MEDYANLAR HAM KESİR — YÜZDE DEĞİL (bkz. `SektorGrup`). Ekran
 * yüzdeye çevirmek isterse ×100'ü BİR KEZ yapar; burada çevirmiyoruz,
 * çünkü ham sayıyı biçimlemek `lib/format.ts`in işi ve iki yerde
 * ölçekleme iki kat yanlış basar.
 *
 * ⚠️ SIRALAMA MOTORDA: `sira` yalnız KİBİN ADI; grupları sunucu
 * `sekSortGroups` ile diziyor. İstemci yeniden sıralamaz — sıralama
 * ölçütü bir karardır ve iki yerde yaşarsa ayrışır.
 *
 * ⚠️ `siniflanan < degerlendirilen` olabilir: `ok: false` kayıtlar
 * gruba HİÇ girmiyor. Ekran bu farkı "eksik ölçüm" olarak söylemek
 * zorunda; 0 ile doldurulmaz.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS`: uç AĞA ÇIKMIYOR, saf hesap.
 *
 * YEREL KAPILAR: `bad_sira` + tarama ucunun ölçüm kapısının tamamı.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchSektor(
  olcumler: OlcumKayit[],
  options: SektorOptions = {},
): Promise<ApiResult<SektorResponse>> {
  const { sira = VARSAYILAN_SIRA, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.sektor;

  if (!(SIRA_KIPLERI as readonly string[]).includes(String(sira))) {
    return kesifKapi<SektorResponse>(path, 'bad_sira');
  }

  const kapali = olcumKapisi<SektorResponse>(path, olcumler);
  if (kapali) return kapali;

  return apiPost<SektorResponse>(path, { olcumler, sira }, { timeoutMs, signal });
}

export type RadarOptions = Omit<RequestOptions, 'query'> & {
  /** Tek temayı süzmek için — verilmezse TÜM temalar döner. */
  tema?: string;
  /** Verilirse cevaba o sektörün MOTOR SÖZLÜĞÜNDEKİ sembolleri eklenir. */
  sektor?: string;
};

/**
 * Radar sözlüğü: GET /api/radar?tema=&sektor=
 *
 * NE: 🔭 tema listesi (etiket · dil · haber ARAMA METNİ · etkilenen
 * sektörler) ve sektör anahtar→ad sözlüğü. İki parametre de İSTEĞE
 * BAĞLI: ikisi de verilmezse tüm sözlük döner.
 *
 * NEDEN SKOR YOK: bu uç SAF SÖZLÜK OKUMASI, AĞA ÇIKMIYOR ve hiçbir şey
 * hesaplamıyor. Haber taraması ÇAĞIRANIN işi: `tema.sorgu` metni
 * `/api/news` ya da `/api/pulse`a GİRDİ olarak verilir. Bu işlev haber
 * getirmez; getirdiğini söylemek uydurma olurdu.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS`: sözlük okuması, dış istek yok. (Uç 5
 * dakikalık CDN önbelleği de veriyor — `Cache-Control: public,
 * max-age=300`; istemci bir şey önbelleklemiyor, ona dokunmuyoruz.)
 *
 * YEREL KAPI — YALNIZ UZUNLUK: `too_long` (her iki parametre için).
 * ⚠️ `bad_tema` / `bad_sektor` YEREL OLARAK DENETLENMEDİ: her iki beyaz
 * liste MOTOR SÖZLÜĞÜNDEN okunuyor (`RADAR_THEMES` anahtarları,
 * `SECTORS` anahtarları) ve bu uç ZATEN o listeleri cevabında veriyor.
 * 18 sektör + tema anahtarını istemciye kopyalamak, motora tema
 * eklendiği gün istemcinin geçerli temayı reddetmesi demek olurdu.
 * Doğru akış: önce parametresiz çağır, dönen `temalar`/`sektorler`den
 * seç.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchRadar(
  options: RadarOptions = {},
): Promise<ApiResult<RadarResponse>> {
  const { tema, sektor, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.radar;

  const t = tema == null ? '' : String(tema).trim();
  const s = sektor == null ? '' : String(sektor).trim();

  if (t.length > AZAMI_SORGU || s.length > AZAMI_SORGU) {
    return kesifKapi<RadarResponse>(
      path,
      'too_long',
      'Radar parametresi çok uzun (en çok ' + AZAMI_SORGU + ' karakter).',
    );
  }

  return apiGet<RadarResponse>(path, {
    query: { tema: t || undefined, sektor: s || undefined },
    timeoutMs,
    signal,
  });
}

export type BacktestOptions = Omit<RequestOptions, 'query'> & {
  /** Varsayılan 'orta' — ucun varsayılanıyla aynı. */
  vade?: Vade;
  /** Verilmezse SUNUCU vadeye göre seçer (gün-içi: '1y', değilse '5y'). */
  range?: Aralik;
  /** Verilmezse SUNUCU vadeye göre seçer (gün-içi: '60m', değilse '1d'). */
  interval?: Adim;
  market?: Market;
};

/**
 * Geçmiş ölçümü: GET /api/backtest?symbol=AAPL&vade=orta
 *
 * NE: bir sembolün geçmiş serisinde motorun kendi göstergesinin ileri
 * getiriyle ilişkisini ÖLÇER (isabet oranları, skor kovaları, bilgi
 * katsayısı, strateji/al-tut getirisi). Bu bir BAŞARI VAADİ DEĞİL,
 * geçmişe dönük bir ölçüm.
 *
 * NEDEN AĞA ÇIKAN TEK UÇ: keşif beşlisinin diğer dördü girdisini
 * istemciden alıyor; bu uç mum serisini kendisi çekiyor. Zaman aşımı bu
 * yüzden ayrı (`BACKTEST_TIMEOUT_MS`, gerekçesi orada).
 *
 * ⚠️ `range`/`interval` VARSAYILANI BİLEREK GÖNDERİLMİYOR: sunucu
 * seçimi VADEYE bağlı (api/_kesif.js: `BT_CFG[vade].intraday` ise
 * `1y/60m`, değilse `5y/1d`). O eşleştirmeyi istemciye kopyalamak,
 * motorun vade yapılandırması değiştiğinde istemcinin YANLIŞ seriyi
 * istemesi demek olurdu. Boş bırakılan alan sorguya hiç yazılmaz
 * (`buildUrl` `undefined`ı atlar) ve kararı sunucu verir; cevabın
 * `range`/`interval` alanları ne kullanıldığını söylüyor.
 *
 * ⚠️ `sonuc === null` HATA DEĞİL — DÜRÜST "ÖLÇEMEDİM". Motor seri
 * `warmup + H + 40` barın altındaysa ya da örnek sayısı 12'nin
 * altındaysa `null` döndürüyor (api/_motor.js `computeBacktest`);
 * 0 yazmak uydurma olurdu. Bu yüzden `ApiResult` tarafında başarı:
 * `r.ok === true` ve `r.data.sonuc === null` AYNI ANDA gelir. Ekran
 * bunu "bu sembol/vade için ölçülemedi" diye yazar ve
 * `ApiError.kind === 'unmeasured'` ile KARIŞTIRMAZ — o, sunucuya
 * ulaşamadık demek; burada ulaştık, sunucu ölçemediğini söyledi.
 *
 * ⚠️ `tam === false` ya da `sayac.*.kesinti > 0` → seri EKSİK çekildi;
 * ölçüm o eksikle yapıldı. Ekran bunu söylemek zorunda.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır):
 *   · boş sembol             → `symbol_yok`
 *   · virgül içeriyor        → `cok_sembol` (azami 1)
 *   · uzunluk > 128          → `too_long`
 *   · küme dışı vade         → `bad_vade`
 *   · küme dışı range        → `bad_range`
 *   · küme dışı interval     → `bad_interval`
 *   · küme dışı pazar        → `bad_market`
 *
 * ⚠️ `bad_symbol` YEREL DENETİMİ YOK — ve grafik ucundan FARKLI olarak
 * `^` kapısı da yok: bu uç endeks sembollerini `cozEndeks()` ile
 * çözüyor (api/_kesif.js:586), yani `^GSPC` burada GEÇERLİ. Grafik
 * ucunun kapısını kopyalamak geçerli bir isteği reddetmek olurdu.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchBacktest(
  symbol: string,
  options: BacktestOptions = {},
): Promise<ApiResult<BacktestResponse>> {
  const {
    vade = 'orta',
    range,
    interval,
    market,
    timeoutMs = BACKTEST_TIMEOUT_MS,
    signal,
  } = options;
  const path = ENDPOINTS.backtest;

  const sym = String(symbol ?? '').trim().toUpperCase();

  if (!sym) return kesifKapi<BacktestResponse>(path, 'symbol_yok');
  if (sym.includes(',')) return kesifKapi<BacktestResponse>(path, 'cok_sembol');
  if (sym.length > AZAMI_SORGU) {
    return kesifKapi<BacktestResponse>(path, 'too_long', 'Sembol çok uzun.');
  }
  if (!KESIF_VADELER.includes(vade)) return kesifKapi<BacktestResponse>(path, 'bad_vade');
  if (range != null && !(ARALIKLAR as readonly string[]).includes(range)) {
    return kesifKapi<BacktestResponse>(path, 'bad_range');
  }
  if (interval != null && !(ADIMLAR as readonly string[]).includes(interval)) {
    return kesifKapi<BacktestResponse>(path, 'bad_interval');
  }
  if (market != null && !KESIF_PAZARLAR.includes(market)) {
    return kesifKapi<BacktestResponse>(path, 'bad_market');
  }

  return apiGet<BacktestResponse>(path, {
    query: { symbol: sym, vade, range, interval, market },
    timeoutMs,
    signal,
  });
}

/**
 * Değer ucunun isteği — AYRIK BİRLEŞİM, çünkü uç İKİ YÖNTEM kabul
 * ediyor (api/_kesif.js: `kapi(req, res, 'GET, POST, OPTIONS')`):
 *   · metal  → GET,  makro ölçümler sorgu parametresi olarak
 *   · kripto → POST, CoinGecko belgesi gövdede (sorguya sığmaz)
 * Tür alanı ayırıcı olduğu için yanlış eşleşme (kriptoya ölçüm,
 * metale belge) derleme zamanında yakalanır.
 */
export type DegerIstek =
  | { tur: MetalTur; olcumler?: MetalOlcumler }
  | { tur: 'kripto'; belge: Record<string, unknown> };

export type DegerOptions = Omit<RequestOptions, 'query'>;

/**
 * Değer ölçümü: GET /api/deger?tur=gram-altin&...  ·  POST /api/deger
 *
 * NE: metal için makro rejim skoru (DXY · 10Y · VIX · metaller-arası
 * oran · kendi trendi), kripto için belge tabanlı değer skoru. İkisi de
 * AYNI cevap şeklini döndürüyor (`skor` · `cls` · `bilesenler`).
 *
 * NEDEN TEK İŞLEV, İKİ YÖNTEM: sunucu TEK uç ve tek cevap sözleşmesi;
 * iki ayrı istemci işlevi yazmak aynı sözleşmeyi iki yerde tutmak
 * olurdu. Yöntem seçimi TÜRDEN düşüyor — tahminle değil, ucun kendi
 * dallarından okundu: POST dalı `tur !== 'kripto'` ise 400
 * `{error:'bad_tur', izinli:['kripto'], not:'metal icin GET'}` diyor;
 * GET dalı `tur`u `METAL_MACRO_W` anahtarlarında arıyor.
 *
 * ⚠️ ÖLÇÜLMEYEN MAKRO ALAN HİÇ GÖNDERİLMEZ (0 GÖNDERİLMEZ):
 * `METAL_OLCUM_ALANLAR`ın sekizi de isteğe bağlı; verilmeyen alan
 * motora `null` geçer ve motor onu nötr sayıp çekincesine yazar. 0
 * göndermek "DXY hiç değişmedi" diye ÖLÇÜLMÜŞ bir iddia kurardı.
 * Sonlu olmayan sayı yerelde kesiliyor: sunucu onu 400 `bad_olcum` ile
 * reddediyor, aynı kodu burada üretiyoruz.
 *
 * ⚠️ BİLEŞEN AĞIRLIKLARI MOTORDAN GELİR (`bilesenler[].w`); istemci
 * onlarla skoru YENİDEN HESAPLAMAZ — yalnız gösterir.
 *
 * ⚠️ `uyariAdet > 0` → motorun çekincesi var; metinleri uç bilerek
 * düşürdü. Ekran sayıyı susturamaz: ölçümün ne kadar güvenilir olduğu
 * bilgisi oradan geliyor.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS`: uç AĞA ÇIKMIYOR — hem metal hem kripto
 * girdisini çağırandan alıyor, saf hesap.
 *
 * ⚠️ GİRDİYİ BU İŞLEV ÜRETMEZ: makro ölçümleri ve CoinGecko belgesini
 * ÇAĞIRAN verir. Uydurma girdi, ölçülmemiş bir skoru ölçülmüş gibi
 * bastırmak olurdu.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır):
 *   · küme dışı tür                  → `bad_tur`
 *   · kripto: belge nesne değil/dizi → `belge_yok`
 *   · metal: sonlu olmayan ölçüm     → `bad_olcum`
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchDeger(
  istek: DegerIstek,
  options: DegerOptions = {},
): Promise<ApiResult<DegerResponse>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.deger;
  const tur = istek?.tur;

  // ----- POST dalı: kripto -----
  if (tur === 'kripto') {
    const belge = (istek as { belge?: unknown }).belge;
    if (!belge || typeof belge !== 'object' || Array.isArray(belge)) {
      return kesifKapi<DegerResponse>(path, 'belge_yok');
    }
    return apiPost<DegerResponse>(path, { tur, belge }, { timeoutMs, signal });
  }

  // ----- GET dalı: metal -----
  if (!(METAL_TURLER as readonly string[]).includes(String(tur))) {
    return kesifKapi<DegerResponse>(path, 'bad_tur');
  }

  const olcumler = (istek as { olcumler?: MetalOlcumler }).olcumler ?? {};
  const query: Record<string, string | number | undefined> = { tur: String(tur) };

  for (const alan of METAL_OLCUM_ALANLAR) {
    const v = olcumler[alan];
    // ÖLÇÜLMEDİ → alan sorguya HİÇ yazılmaz (`buildUrl` boş/`undefined`
    // değerleri atlıyor). Sunucu onu `null` sayıp çekincesine yazar.
    if (v == null) continue;
    if (!Number.isFinite(v)) {
      return kesifKapi<DegerResponse>(
        path,
        'bad_olcum',
        'Makro ölçüm sayı değil: ' + alan + '.',
      );
    }
    query[alan] = v;
  }

  return apiGet<DegerResponse>(path, { query, timeoutMs, signal });
}

export type GundemOptions = Omit<RequestOptions, 'query'> & {
  /** Besleme yereli. Verilmezse uç noktanın varsayılanı (TR) gönderilir. */
  yerel?: GundemYerel;
  /** 1..AZAMI_MADDE. Verilmezse uç noktanın varsayılanı (10) kullanılır. */
  limit?: number;
};

/**
 * `/api/news?gundem=1` — GÜNDEM KİPİ: sembole bağlı OLMAYAN manşetler,
 * birden çok yayıncı beslemesinden toplanıp tekilleştirilmiş.
 *
 * NEDEN `fetchNews` İLE AYNI İŞLEV DEĞİL: aynı yolu kullanıyorlar ama
 * uç bunları AYRI KİP sayıyor ve `gundem` ile `q`/`symbols` BİRLİKTE
 * gönderilince 400 `gundem_ve_sorgu` dönüyor (api/news.js:251). Tek
 * işlevde iki kipi toplamak, çağıran yerin yanlışlıkla ikisini birden
 * geçmesine izin vermek olurdu; ayrı imza bunu derleme zamanında
 * imkânsız kılıyor. Dönen gövde de ayrı şekilde (`besleme[]`, `tekrar`,
 * `q: null`) — bkz. `GundemResponse` başlığı.
 *
 * NEDEN `q` PARAMETRESİ YOK: bu kipte serbest metin GÖNDERİLEMEZ.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn): `fetchNews` ile aynı uç, aynı
 * `maxDuration: 10`. Gündem kipi beş-yedi beslemeyi PARALEL çekiyor
 * (api/_haber.js `Promise.allSettled`), yani seri toplam değil — yeni
 * bir kademe uydurulmadı.
 *
 * NEDEN BOŞ LİSTE HATA DEĞİL: 200 + `maddeler: []` + `tam: true`
 * ölçülmüş bir cevap ("gündemde madde yok"). `no-data`ya çevirmek
 * ekrana "ölçemedim" tonu bastırırdı; gövde `ok: true` geçer, ekran
 * `adet === 0` dalını `VeriYok` ile anlatır. `tam: false` AYRI dal.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır, yeni kod uydurulmadı):
 *   · küme dışı yerel          → `bad_market` (api/news.js:281 izinli küme)
 *   · tamsayı olmayan/<1 limit  → `bad_limit`
 *   · limit > 25               → `limit_buyuk`
 * `bad_gundem` ve `gundem_ve_sorgu` BURADA ÜRETİLEMEZ: `gundem` daima
 * '1' gönderiliyor ve `q`/`symbols` hiç gönderilmiyor.
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchGundem(
  options: GundemOptions = {},
): Promise<ApiResult<GundemResponse>> {
  const {
    yerel = VARSAYILAN_GUNDEM_YEREL,
    limit,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;
  const path = ENDPOINTS.news;

  if (!(GUNDEM_YERELLER as readonly string[]).includes(yerel)) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: kodMetni('bad_market') ?? 'Geçersiz pazar.',
        endpoint: path,
        code: 'bad_market',
      },
    };
  }
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) {
      return {
        ok: false,
        error: {
          kind: 'bad-request',
          message: kodMetni('bad_limit') ?? 'Geçersiz madde sayısı.',
          endpoint: path,
          code: 'bad_limit',
        },
      };
    }
    if (limit > AZAMI_MADDE) {
      return {
        ok: false,
        error: {
          kind: 'bad-request',
          message: kodMetni('limit_buyuk', AZAMI_MADDE, limit) ?? 'Çok fazla manşet istendi.',
          endpoint: path,
          code: 'limit_buyuk',
        },
      };
    }
  }

  return apiGet<GundemResponse>(path, {
    // `gundem` KAPALI KÜME: uç yalnız '1'/'true' kabul ediyor
    // (api/news.js:232-240). '1' gönderiliyor, kullanıcıdan alınmıyor.
    query: { gundem: '1', market: yerel, limit },
    timeoutMs,
    signal,
  });
}

export type AramaOptions = Omit<RequestOptions, 'query'> & {
  /** 1..ARAMA_AZAMI (25). Verilmezse ucun varsayılanı (10) kullanılır. */
  limit?: number;
};

/**
 * `/api/arama` — ÇOK PAZARLI ADAY ARAMASI (api/_kesif.js `aramaHandler`).
 *
 * NEDEN VAR: çıplak bir terim (`ASELS`) hangi pazara ait, ÖLÇÜLMEDEN
 * BİLİNEMEZ. Eski akış sembolü doğrudan skora yolluyordu, sunucu pazarı
 * TAHMİN ediyordu ve `ASELS` sessizce `US` sayılıp skor `null` dönüyordu.
 * Bu uç tahmin etmiyor: kripto + US + BIST adaylarını BİRLİKTE listeliyor,
 * seçimi KULLANICI yapıyor.
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn): uç TEK dış istek yapıyor (Yahoo
 * search) ve diğer beş keşif rotasıyla aynı `api/proxy.js` yeniden
 * yazımından geçiyor; skorun 58 sn'si buraya kopyalanmaz.
 *
 * NEDEN BOŞ LİSTE HATA DEĞİL: 200 + `adaylar: []` + `tam: true`
 * ÖLÇÜLMÜŞ bir cevaptır ("aradım, eşleşme yok"). `tam: false` AYRI dal:
 * "ölçüm tamamlanmadı". Gövde `ok: true` geçer, ayrımı ekran yapar.
 *
 * YEREL KAPILAR (hepsi UCUN KENDİ kodunu taşır, yeni kod uydurulmadı):
 *   · boş q                      → `q_yok`
 *   · q uzunluğu > 128           → `too_long`  (api/_girdi.js AZAMI_SORGU)
 *   · tamsayı olmayan/<1/>25 lim → `bad_limit` (asgari 1, azami 25)
 *
 * Bilgi amaçlıdır, yatırım tavsiyesi değildir.
 */
export async function fetchArama(
  query: string,
  options: AramaOptions = {},
): Promise<ApiResult<AramaResponse>> {
  const { limit, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const path = ENDPOINTS.arama;

  // `q` SERBEST METİN: sembol kapısından (büyük harfe çevirme, biçim
  // denetimi) GEÇİRİLMİYOR — "aselsan" da, "ASELS" de, "bitcoin" de
  // geçerli arama terimi (api/_kesif.js `aramaHandler` ham `q` alıyor).
  const q = String(query ?? '').trim();

  if (!q) {
    return kesifKapi<AramaResponse>(path, 'q_yok');
  }
  if (q.length > AZAMI_SORGU) {
    return kesifKapi<AramaResponse>(
      path,
      'too_long',
      // `kesifKodMetni('too_long')` TARAMA cümlesini döndürür; arama
      // terimi için yanlış olur.
      'Arama terimi çok uzun (en çok ' + AZAMI_SORGU + ' karakter).',
    );
  }
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > ARAMA_AZAMI)) {
    return kesifKapi<AramaResponse>(path, 'bad_limit');
  }

  return apiGet<AramaResponse>(path, {
    query: { q, limit },
    timeoutMs,
    signal,
  });
}
