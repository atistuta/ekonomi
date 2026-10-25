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
  AZAMI_HABER_SORGU,
  AZAMI_MADDE,
  AZAMI_SEMBOL,
  HABER_PAZARLAR,
  VARSAYILAN_ADIM,
  VARSAYILAN_ARALIK,
  VARSAYILAN_HABER_PAZAR,
  type Adim,
  type AnalyzeResponse,
  type Aralik,
  type ChartResponse,
  type CompareResponse,
  type HaberPazar,
  type Market,
  type NewsResponse,
  type PulseResponse,
  type RecommendResponse,
  type ScoreErrorBody,
  type ScoreResponse,
  type ThemeResponse,
  type Vade,
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
} as const;

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
  if (sym.startsWith('^')) {
    // ENDEKS. Sunucu kesinlikle 400 `bad_symbol` döner — ağa çıkmıyoruz.
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Endeks sembolleri bu uçtan grafiklenemiyor.',
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
