// =====================================================================
//  /api/takvim SARMALAYICISI — KAP duyuruları + BIST temettü takvimi
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `api/_kesif.js` → `takvimHandler` (:1043) ucunun tek ölçülmüş
//  istemci girişi: `fetchTakvim()` + cevabın TypeScript karşılığı.
//  Taşıyıcı `api/_takvim.js`; iki kaynağı HTML'den ayrıştırıp ekrana
//  hazır liste indiriyor (KAP → finans.mynet.com, temettü →
//  temettuhisseleri.com).
//
//  NEDEN BU UÇ NATIVE'DE EKSİKTİ (ÖLÇÜLDÜ 2026-10-29): uç ÜRETİMDE
//  CANLIYDI ama `mobile/` içinde onu çağıran hiçbir şey yoktu
//  (`grep -rn "api/takvim" mobile/` → 0 eşleşme; `client.ts`
//  `ENDPOINTS` haritasında `takvim` anahtarı yoktu). Web'in `calendar`
//  sekmesinin native karşılığı yoktu; bu dosya o boşluğu kapatıyor.
//
//  NEDEN `client.ts`'DE DEĞİL: `client.ts` SKOR ZİNCİRİNİN uçlarını ve
//  onların ortak kapısını taşıyor (`sembolUcu`: 8 sembol, `vade`, 58 sn).
//  `/api/takvim` o zincirin DIŞINDA: hiçbir skora girdi vermiyor
//  (taşıyıcı başlığı: "BU DOSYA SKORA DOKUNMAZ"), sembol parametresi YOK,
//  `vade` YOK ve kendi kapıları var (`kapsam` beyaz listesi + iki ayrı
//  adet tavanı). Aynı kapıya sokmak üç ayrı sözleşmeyi tek imzaya
//  zorlamak olurdu. `client.ts`'e YALNIZ adres eklendi (`ENDPOINTS.takvim`),
//  başka satırı değişmedi — gerekçe `yfin.ts` başlığıyla aynı.
//
//  NEDEN TÜRLER BU DOSYADA: `api/types.ts` skor sözleşmesinin yeri.
//  Takvim ayrı bir sözleşme ve ayrı değişiyor; yan yana koymak "hangi
//  alan hangi uçtan geliyor" ayrımını siler (yine `yfin.ts` gerekçesi).
//
//  ── ÖLÇÜLDÜ (2026-10-29, ÜRETİM — canlı istek) ─────────────────────
//  GET /api/takvim?kapsam=temettu  → 200, 13 377 bayt
//  GET /api/takvim?kapsam=kap      → 200,  9 718 bayt
//  GET /api/takvim?kapsam=hepsi    → 200, 22 918 bayt
//  Üst alanlar (gövdeden okundu, varsayılmadı):
//    kapsam · kap? · kapAdet? · temettu? · temettuAdet? ·
//    temettuAtlanan? · temettuTekrar? · sayac · tam · ms · uyari
//    · `kapsam=kap`   → gövdede `temettu*` anahtarları HİÇ YOK.
//    · `kapsam=temettu` → gövdede `kap*` anahtarları HİÇ YOK.
//      Bu yüzden türde `?` (isteğe bağlı) ile `| null` BİRLİKTE var:
//      anahtarın YOKLUĞU "sormadım", değerin `null`u "ölçemedim",
//      `[]` ise "ölçtüm, yok". Üçü AYRI şey (uç başlığı aynısını yazıyor).
//    · `kapAdet: 30` · `temettuAdet: 120` (ucun varsayılanları)
//    · `temettuAtlanan: 0` · `temettuTekrar: 0`
//    · `sayac: {istek,basari,hata,zamanAsimi,kisa,bayt}` — `HaberSayac`
//      ile BİREBİR aynı şekil, bu yüzden `haberOlcumEksik()` bu gövdede
//      KULLANILABİLİR (aşağıda gerekçesi).
//    · `tam: true` · `ms: 98 / 334 / 16` · `uyari` metni dolu.
//
//  ÖLÇÜLMÜŞ TUZAK — `kap[].symbol` `null` OLABİLİR: 30 duyurunun 16'sı
//  `symbol: null`, `tickers: []` döndü (ölçüm: aynı canlı istek). Sebep
//  çok sembollü başlıklarda (`"***GRFIN ** EMVAR*** …"`) uçtaki regex'in
//  eşleşmemesi; bu BİLİNEN ve kasten onarılmamış bir arıza
//  (`app.js:255` ikizi). İSTEMCİ BAŞLIKTAN SEMBOL AYRIŞTIRMAZ: o,
//  native'de yasak olan "ekranda hesap" olurdu ve yanlış sembol basmak
//  ölçülmemiş veri uydurmaktır.
//
//  BURADA HESAP YOK: bu dosya hiçbir oranı ölçeklemez, tarih
//  biçimlemez, sıralama yapmaz. Sıralama uçta (`_takvim.js`), biçimleme
//  `lib/format.ts`.
//
//  BİRİM TUZAĞI — `temettu[].yieldPct` YÜZDE PUANI: ölçüldü 1.04 =
//  %1,04 (oran DEĞİL) → 100 ile ÇARPILMAZ, doğru biçimleyici
//  `formatPercent`. `amount` ise hisse başı PARA (0.0816) ve birimi
//  `currency` ('TRY') — `formatPrice(amount, currency)`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  apiGet,
  ENDPOINTS,
  type ApiResult,
  type HaberSayac,
  type RequestOptions,
} from './client';

/**
 * Kapsam beyaz listesi — UCUN KENDİ kümesinin kopyası
 * (`api/_takvim.js` `KAPSAMLAR`). SESSİZ GENİŞLEME YOK: listede
 * olmayan bir değer uçta 400 `bad_kapsam` demek, o yüzden burada da
 * ağa çıkmadan kesiliyor.
 */
export const TAKVIM_KAPSAMLAR = ['hepsi', 'kap', 'temettu'] as const;
export type TakvimKapsam = (typeof TAKVIM_KAPSAMLAR)[number];

/** Ucun varsayılan kapsamı (`api/_takvim.js` `VARSAYILAN_KAPSAM`). */
export const VARSAYILAN_TAKVIM_KAPSAM: TakvimKapsam = 'hepsi';

/**
 * KAP madde tavanı — ÖLÇÜLDÜ: `api/_takvim.js` `AZAMI_KAP = 60`.
 * Aşımı uç 400 `bad_limit` ile REDDEDİYOR (sessiz kırpma YOK, bkz.
 * `adetOku`), bu yüzden kapı burada da aynı sayıyla duruyor —
 * kullanıcı neyi sormadığını bilsin.
 */
export const TAKVIM_AZAMI_KAP = 60;

/** Temettü madde tavanı — ÖLÇÜLDÜ: `AZAMI_TEMETTU = 400`. */
export const TAKVIM_AZAMI_TEMETTU = 400;

/**
 * Tek KAP duyurusu. Alan kümesi ucun ilan ettiği küme
 * (`api/_takvim.js` `KAP_MADDE_ALANLARI`) — FAZLA alan türetilmedi.
 *
 * İlk dört alan `HaberMadde` ile BİREBİR örtüşüyor (uç bunu bilerek
 * yapıyor: `_takvim.js` notu "madde alan adları bilerek `_haber.js`in
 * `MADDE_ALANLARI` kümesiyle ÖRTÜŞÜYOR"), bu yüzden bu madde
 * `HaberSatiri` bileşenine olduğu gibi verilebiliyor ve ikinci bir
 * satır bileşeni yazılmadı.
 */
export type TakvimKapMadde = {
  title: string;
  link: string;
  /** ISO + AÇIK dilim: "2026-10-29T19:13:00+03:00" (ölçüldü). */
  pubDate: string;
  /** Kaynağın kendi yazdığı hâl: "29 Eki 2026 19:13" (ölçüldü). */
  pubDateHam: string;
  /** Ölçüldü: daima "Mynet Finans" (`KAP_KAYNAK`). */
  source: string;
  /** Ölçüldü: daima "KAP" (`TAKVIM_TURU`). */
  type: string;
  /**
   * `null` OLABİLİR ve ÖLÇÜLDÜ: 30 duyurunun 16'sı `null` döndü.
   * Çok sembollü başlıkta uçtaki regex eşleşmiyor (bilinen arıza).
   * `null` → "sembol AYRIŞTIRILAMADI"; başlıktan türetmek YASAK.
   */
  symbol: string | null;
  /** Başlıkta geçen semboller; `symbol` `null` iken `[]` (ölçüldü). */
  tickers: string[];
};

/**
 * Tek temettü satırı. Alan kümesi `TEMETTU_MADDE_ALANLARI`.
 *
 * ÜÇ FARKLI ÖLÇEK AYNI SATIRDA — her alanın birimi yanında yazılı;
 * tek biçimleyiciye vermek 100 kat yanlış sayı basmak olurdu.
 */
export type TakvimTemettuMadde = {
  /** BIST sembolü (`.IS` eki YOK — ölçüldü: "DESA", "ASELS"). */
  symbol: string;
  /** ISO gün: "2026-10-30" (ölçüldü). Saat/dilim taşımıyor. */
  date: string;
  /** Kaynağın Türkçe hâli: "30 Ekim" (ölçüldü). */
  dateHam: string;
  /** Hisse başı tutar — **PARA**, birimi `currency`. Ölçüldü: 0.0816. */
  amount: number;
  /**
   * Verim — **YÜZDE PUANI** (ölçüldü: 1.04 = %1,04), ORAN DEĞİL.
   * `formatOran`a verilirse kullanıcı 0-1 oranı sanır → 100 kat yanlış
   * okuma. Doğru biçimleyici `formatPercent`; 100 ile ÇARPILMAZ.
   */
  yieldPct: number;
  /** Makine kodu ('TRY'), ekran simgesi değil (`PARA_BIRIMI`). */
  currency: string;
};

/**
 * `/api/takvim` cevabı.
 *
 * NEDEN HEM `?` HEM `| null`: ikisi AYRI anlam taşıyor ve uç bunu
 * ayırıyor. Anahtar GÖVDEDE YOKSA o kaynak HİÇ İSTENMEDİ (`kapsam`
 * dışı kaldı); anahtar VAR ama `null` ise İSTENDİ ve OKUNAMADI
 * (`tam:false` ile birlikte); `[]` ise okundu ve boş. Tek bir
 * `kap: TakvimKapMadde[]` yazmak bu üç hâli birbirine karıştırırdı.
 */
export type TakvimResponse = {
  /** İsteğin yankısı — gönderdiğimiz (ya da ucun varsaydığı) kapsam. */
  kapsam: TakvimKapsam | string;
  kap?: TakvimKapMadde[] | null;
  /** Ucun saydığı adet; istemci yeniden saymaz. `null` → ölçülemedi. */
  kapAdet?: number | null;
  temettu?: TakvimTemettuMadde[] | null;
  temettuAdet?: number | null;
  /** Ayrıştırıcının ATLADIĞI satır sayısı — sessizce kaybolmasın. */
  temettuAtlanan?: number | null;
  /** TEKİLLEŞTİRİLEN satır sayısı. */
  temettuTekrar?: number | null;
  /**
   * Şekli `HaberSayac` ile BİREBİR aynı (ölçüldü: aynı altı alan).
   * Bu yüzden `haberOlcumEksik()` bu gövdede kullanılabiliyor ve
   * ekranda ikinci bir "eksik mi" eşiği yazılmıyor.
   */
  sayac: HaberSayac;
  /** `false` → 200 olsa bile İSTENEN kaynakların biri ölçülemedi. */
  tam: boolean;
  ms: number;
  uyari: string;
};

/** Ucun makine hata kodları (`takvimHandler` + taşıyıcı). */
export type TakvimErrorCode =
  | 'bad_kapsam'
  | 'bad_limit'
  | 'method_not_allowed'
  | 'takvim_alinamadi';

/**
 * Ucun bütçesi. ÖLÇÜLDÜ: `api/proxy.js` `maxDuration: 30` ve
 * `api/_takvim.js` `TAKVIM_ISTEK_MS = 10000` (iki kaynak PARALEL).
 * Gerekçe `fetchTakvim` başlığında.
 */
export const TAKVIM_TIMEOUT_MS = 28_000;

export type TakvimOptions = Omit<RequestOptions, 'query'> & {
  /** Verilmezse ucun varsayılanı ('hepsi') kullanılır. */
  kapsam?: TakvimKapsam;
  /** 1..60. Verilmezse ucun varsayılanı (30); istemci sayı uydurmaz. */
  kapAdet?: number;
  /** 1..400. Verilmezse ucun varsayılanı (120). */
  temettuAdet?: number;
};

/** Yerel kapı — ucun KENDİ kodunu taşıyan `ApiResult` hatası. */
function takvimKapi<T>(code: TakvimErrorCode, message: string): ApiResult<T> {
  return {
    ok: false,
    error: { kind: 'bad-request', message, endpoint: ENDPOINTS.takvim, code },
  };
}

/**
 * Takvim çağrısı: GET /api/takvim?kapsam=hepsi&kapAdet=30&temettuAdet=120
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn) DEĞİL, 28 sn: uç iki HTML sayfasını
 * PARALEL çekiyor ama kendi istek tavanı 10 sn (`TAKVIM_ISTEK_MS`) ve
 * üstüne ayrıştırma var; `api/proxy.js` bütçesi 30 sn. 12 sn'lik ortak
 * varsayılan, uç hâlâ çalışırken bağlantıyı keser ve çalışan bir ölçümü
 * "zaman aşımı" diye gösterirdi — ucun DÜRÜST sayacını göremezdik.
 * Tavan 28 sn: proxy'nin 30 sn'sinin altında kalıyor ki cevabı ucun
 * kendisi yazsın.
 *
 * NEDEN YEREL KAPILAR: uç aşımı SESSİZCE KIRPMIYOR, 400 ile reddediyor
 * (`adetOku`, `bad_limit`). Ağa çıkıp 400 yemek yerine aynı kodu burada
 * üretmek, kullanıcıya "istediğin sayı sorulmadı"yı doğru söylemek
 * demek — `fetchArama`nın yerel kapılarıyla aynı desen.
 *
 * BOŞ LİSTE HATA DEĞİL: 200 + `kap: []` ÖLÇÜLMÜŞ bir cevaptır
 * ("okudum, duyuru yok"). `null` ayrı dal: "istedim, okuyamadım".
 * Ayrımı ekran yapar; bu işlev ikisini de `ok: true` geçirir.
 */
export async function fetchTakvim(
  options: TakvimOptions = {},
): Promise<ApiResult<TakvimResponse>> {
  const {
    kapsam,
    kapAdet,
    temettuAdet,
    timeoutMs = TAKVIM_TIMEOUT_MS,
    signal,
  } = options;

  if (kapsam !== undefined && !(TAKVIM_KAPSAMLAR as readonly string[]).includes(kapsam)) {
    return takvimKapi<TakvimResponse>(
      'bad_kapsam',
      'Takvim kapsamı şunlardan biri olmalı: ' + TAKVIM_KAPSAMLAR.join(', ') + '.',
    );
  }
  if (
    kapAdet !== undefined &&
    (!Number.isInteger(kapAdet) || kapAdet < 1 || kapAdet > TAKVIM_AZAMI_KAP)
  ) {
    return takvimKapi<TakvimResponse>(
      'bad_limit',
      'KAP duyuru adedi 1 ile ' + TAKVIM_AZAMI_KAP + ' arasında olmalı.',
    );
  }
  if (
    temettuAdet !== undefined &&
    (!Number.isInteger(temettuAdet) || temettuAdet < 1 || temettuAdet > TAKVIM_AZAMI_TEMETTU)
  ) {
    return takvimKapi<TakvimResponse>(
      'bad_limit',
      'Temettü satırı adedi 1 ile ' + TAKVIM_AZAMI_TEMETTU + ' arasında olmalı.',
    );
  }

  return apiGet<TakvimResponse>(ENDPOINTS.takvim, {
    // `buildUrl` `undefined`/`null` anahtarları ATLIYOR: verilmeyen
    // parametre sorguya hiç basılmıyor ve ucun kendi varsayılanı
    // geçerli oluyor. Burada bir varsayılan yazmak, ucun sayısını
    // istemcide İKİNCİ kez tanımlamak olurdu.
    query: { kapsam, kapAdet, temettuAdet },
    timeoutMs,
    signal,
  });
}
