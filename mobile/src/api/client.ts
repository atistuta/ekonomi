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
  AZAMI_SEMBOL,
  type Market,
  type ScoreErrorBody,
  type ScoreResponse,
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
    case 'cok_sembol':
      return 'En çok ' + (azami ?? AZAMI_SEMBOL) + ' sembol sorulabilir (' + (istenen ?? 0) + ' istendi).';
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
 * Ham GET. `T` varsayılan olarak `unknown`; skor için tipli sarmalayıcı
 * `fetchScore` var. Çağıran kendi daraltmasını yapar.
 */
export async function apiGet<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { query, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const url = buildUrl(path, query);

  // Zaman aşımı + çağıranın iptali birlikte: ikisinden biri tetiklenirse
  // istek düşer. `AbortSignal.any` her RN sürümünde yok, elle bağlıyoruz.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onOuterAbort = () => controller.abort('caller');
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
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
  const { vade = 'orta', market, timeoutMs = SCORE_TIMEOUT_MS, signal } = options;

  // Uç noktanın ayrıştırmasıyla aynı temizlik: trim + boşları at.
  const liste = symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean);

  if (!liste.length) {
    return {
      ok: false,
      error: {
        kind: 'bad-request',
        message: 'Sembol verilmedi.',
        endpoint: ENDPOINTS.score,
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
        endpoint: ENDPOINTS.score,
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
        endpoint: ENDPOINTS.score,
        code: 'too_long',
      },
    };
  }

  return apiGet<ScoreResponse>(ENDPOINTS.score, {
    query: { symbols: ham, vade, market },
    timeoutMs,
    signal,
  });
}
