// =====================================================================
//  /api/score SÖZLEŞME TİPLERİ                        (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: `api/score.js` uç noktasının cevabının TypeScript karşılığı.
//
//  NEDEN AYRI DOSYA: tip, uç noktanın sözleşmesidir — istemcinin ağ
//  mantığından (client.ts) ayrı durması, uç değişince nerenin
//  güncellendiğini tek dosyaya indiriyor. Doğruluk kaynağı HER ZAMAN
//  `api/score.js` başlığındaki SÖZLEŞME bloğu; burası onun aynası.
//
//  NEDEN ALANLAR ÇOĞUNLUKLA `| null`: motor "ölçemedim"i `null` ile
//  söylüyor ve bu bir HATA DEĞİL. Tipi `number` yapsak istemci her yerde
//  sayı varsayar, `null` geldiğinde "0" ya da "NaN" basar — finans
//  uygulamasında en kötü hata türü.
//
//  ── ÜÇ AYRI DURUM, ÜÇ AYRI ANLAM (karıştırılmamalı) ────────────────
//   ① `ta.score = null` + `ta.why` → VERİ CEVABI: "ölçtüm, sonuç yok"
//      (ör. vade 'gunici' iken günlük mumla TA üretilmiyor). Kırmızı
//      hata DEĞİL; ekran sebebi yazar.
//   ② `tam = false` ya da `sayac.*.kesinti > 0` → "ÖLÇEMEDİM": bir dış
//      kaynağa ulaşılamadı. Bu, "düşük skor" ile AYNI gösterilemez.
//   ③ `sayac.sec.yok > 0` → SEC'te o kalem YOK (404 ama veri cevabı).
//      Kesinti değil; skoru düşürmez, ölçümü eksiltmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** `api/_ayar.js` VADELER. 'gunici' gün-içi: TA skoru null döner. */
export type Vade = 'gunici' | 'kisa' | 'orta' | 'uzun';

export type Market = 'US' | 'BIST';

/** Uç noktanın kabul ettiği en çok sembol (api/score.js AZAMI_SEMBOL). */
export const AZAMI_SEMBOL = 8;

/**
 * Dış istek sayacı — `api/_ag.js bosSayac()`. `yok` ile `kesinti` AYRI:
 * `yok` bir veri cevabı (o kalem yok), `kesinti` taşıma hatası.
 */
export type Sayac = {
  yahoo: { istek: number; kesinti: number };
  sec: { istek: number; yok: number; kesinti: number };
  bist: { istek: number; kesinti: number };
  /** Aynı adres ikinci kez istendi, ağa çıkılmadı. */
  tekrar: number;
};

/** Tek göstergenin katkısı — parite kayarsa hangisinin kaydığını söyler. */
export type TaBreakdown = {
  key: string;
  score: number | null;
  weight: number | null;
};

export type ScoreTa = {
  /** 0-100. `null` → ölçülemedi/üretilmedi, sebebi `why`. */
  score: number | null;
  /** `score` null olduğunda sebep (sabit küme metni). */
  why?: string;
  raw?: number | null;
  label?: string | null;
  cls?: string | null;
  /** Rejim adı (trend/yatay) — motorun rejim rozeti. */
  regime?: string | null;
  adx?: number | null;
  bars?: number;
  benchBars?: number;
  breakdown?: TaBreakdown[];
};

export type FaCriterion = {
  key: string;
  weight: number | null;
  score: number | null;
};

export type ScoreFa = {
  score: number | null;
  why?: string;
  /** Dolan kriter ağırlığı / toplam ağırlık — kapsama ölçüsü. */
  present?: number | null;
  total?: number | null;
  /** HAM fiyat. Biçimlendirme istemcide (lib/format.ts). */
  price: number | null;
  eps?: number | null;
  pe?: number | null;
  /** BIST: mali tabloda bulunan yıllar. */
  years?: unknown;
  criteria?: FaCriterion[];
};

export type ScoreComposite = {
  faBand?: string | null;
  taBand?: string | null;
  /** 3x3 matristen çıkan bant. İki skordan biri yoksa `null` + `why`. */
  band: string | null;
  label?: string | null;
  why?: string;
  blended?: number | null;
  /** Kullanıcının gördüğü tam sayı — motorun yuvarlaması. */
  blendedShown?: number | null;
};

export type ScoreRow = {
  sym: string;
  market: Market;
  ta: ScoreTa;
  fa: ScoreFa;
  composite: ScoreComposite;
  /** Bu sembole ait dış istek sayacı. */
  sayac: Sayac;
  /** Bu sembolde kesinti yok mu? `false` → ÖLÇEMEDİM. */
  tam: boolean;
};

/**
 * Motor ve ayar imzası.
 *
 * NEDEN `ekran` ALANI YOK: FAZ 1'de burada üçüncü bir alan (`ekran`)
 * yazılıydı. Uç **ÖLÇÜLDÜ** (2026-10-18, canlı istek):
 *   GET /api/score?symbols=NVDA → "surum": { motor, ayar }
 * Üçüncü taşıyıcı (`api/_ekran.js`) silindiği gün sözleşmeden de düştü
 * (bkz. ELITE_ROADMAP FAZ 1 "İSTEMCİ SÖZLEŞMESİ"). Tür burada eski hâli
 * taşımaya devam etse, var olmayan bir alanı okuyan ekran kodu derlemeden
 * geçerdi.
 */
export type ScoreSurum = {
  motor: string;
  ayar: string;
};

export type ScoreResponse = {
  vade: Vade;
  istenen: number;
  sonuclar: ScoreRow[];
  /** Zaman bütçesi dolduğu için hiç başlanmayan semboller. */
  atlanan: string[];
  sayac: Sayac;
  /** Tur genelinde kesinti ve atlanan yok mu? */
  tam: boolean;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

/**
 * Uç noktanın makine hata kodları (`api/score.js`). Sabit küme olarak
 * tutuluyor ki ekran metni koda göre seçilsin — sunucunun döndürdüğü
 * metin KULLANILMAZ (uç nokta kasıtlı olarak ayrıntı dönmüyor).
 */
export type ScoreErrorCode =
  | 'symbols_yok'
  | 'symbols_bos'
  | 'too_long'
  | 'bad_vade'
  | 'bad_market'
  | 'bad_symbol'
  | 'cok_sembol'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'skor_hesaplanamadi';

/** Hata gövdesi — kod dışındaki alanlar koda göre değişir. */
export type ScoreErrorBody = {
  error: ScoreErrorCode | string;
  azami?: number;
  istenen?: number;
  izinli?: string[];
  gecersiz?: string[];
  uyari?: string;
};

// ---------------------------------------------------------------------
//  Sayaç yardımcıları — "ölçemedim" sorusunun TEK yanıt yeri.
//  Her ekran kendi `if (sayac.yahoo.kesinti > 0 || ...)` zincirini
//  yazarsa biri `sec.yok`u da kesinti sayar ve dürüstlük bozulur.
// ---------------------------------------------------------------------

/** Kaç taşıma kesintisi oldu? `sec.yok` BURAYA GİRMEZ (veri cevabı). */
export function kesintiSayisi(s: Sayac | null | undefined): number {
  if (!s) return 0;
  return (s.yahoo?.kesinti ?? 0) + (s.sec?.kesinti ?? 0) + (s.bist?.kesinti ?? 0);
}

/**
 * Bu satır/cevap için "ölçemedim" demeli miyiz? `tam === false` ya da
 * kesinti varsa evet. Skorun `null` olması buraya girmez — o veri cevabı.
 */
export function olcumEksik(x: { tam?: boolean; sayac?: Sayac } | null | undefined): boolean {
  if (!x) return false;
  return x.tam === false || kesintiSayisi(x.sayac) > 0;
}

// =====================================================================
//  FAZ 2 — PLAN · ANALİZ · KIYAS · TEMA katmanlarının türleri
// ---------------------------------------------------------------------
//  NE: /api/recommend · /api/analyze · /api/compare · /api/theme
//  cevaplarının şekli.
//
//  NEDEN TAHMİNLE DEĞİL ÖLÇÜMLE YAZILDI: bu türler uç dosyalarının
//  SÖZLEŞME başlıklarından VE canlı cevaptan (2026-10-18, üretim
//  https://day-starter.vercel.app) birlikte çıkarıldı. Örnek:
//    /api/analyze?symbols=AAPL  → plan.seviye.anchorKind = "kaygan",
//    analiz.butunculluk.skor10 = 5.7, direkler[3], faKarar.band = "na"
//  Hayalî bir alan yazmak, ekranı derlenen ama HİÇ dolmayan bir kutuya
//  çevirirdi; alanı eksik yazmak ise ölçülmüş veriyi çöpe atardı.
//
//  NEDEN HER SAYI `| null`: motor "ölçemedim"i `null` ile söylüyor ve
//  ekran bunu "0" ya da "nötr" diye gösteremez (bkz. yukarıdaki üç
//  durum notu). `number` yazmak, TypeScript'e yalan söyleyip `null`u
//  ekrana `0` olarak sızdırmak demekti.
//
//  İÇ İÇE SÖZLEŞME (uç başlıklarından): score ⊂ recommend ⊂ analyze,
//  compare ise analyze kaydının AYNISINI + `sira`/`siralanamayan`
//  döndürüyor. Türler de bu kümelemeyi izliyor — tek bir alan bile
//  yeniden yazılmadı, böylece ekran çözücüsü dört uçta da çalışıyor.
// =====================================================================

/** Plan seviyeleri — hepsi HAM sayı; biçimleme `lib/format.ts`in işi. */
export type PlanSeviye = {
  price: number | null;
  target: number | null;
  stop: number | null;
  rr: number | null;
  poc: number | null;
  atr: number | null;
  /** Uygun alım bandı [alt, üst] — motorun kararı, istemci hesaplamaz. */
  buyZone: [number, number] | number[] | null;
  sellZone: [number, number] | number[] | null;
  zMult: number | null;
  /** Sabit küme: kâr-al hedefinin kaynağı (ör. 'target'). */
  sellKind: string | null;
  sma50: number | null;
  sma200: number | null;
  /** Sabit küme: 'sabit' | 'kaygan' (ölçüldü). */
  anchorKind: string | null;
};

/** Fiyatın alım bandına yakınlığı. `state`/`cls` SABİT KÜME (motordan). */
export type PlanYakinlik = {
  state: string;
  cls: string;
  dAtr: number | null;
};

/**
 * Momentum / trend-devam rejimi. `active:false` ise sebep alanları gelir
 * (ölçüldü: trendAligned, adx, gapPct). Alan listesi uçta sabit
 * olmadığı için gevşek tutuldu — ekran yalnız bildiği alanları basıyor.
 */
export type PlanMomentum = {
  active: boolean;
  trendAligned?: boolean;
  adx?: number | null;
  gapPct?: number | null;
  [k: string]: unknown;
};

/** Risk/ödül — `rrRatio` YALNIZ mesafe oranı, olasılık DEĞİL (uç notu). */
export type PlanRiskOdul = {
  sellUpPct: number | null;
  sellKind: string | null;
  brkPrimary: number | null;
  brkKind: string | null;
  brkPct: number | null;
  brkMajor: number | null;
  atrStop: number | null;
  rrRatio: number | null;
};

/** `plan = null` → TA koşmadı (ör. vade 'gunici'). Hata DEĞİL. */
export type Plan = {
  seviye: PlanSeviye | null;
  yakinlik: PlanYakinlik | null;
  momentum: PlanMomentum | null;
  riskOdul: PlanRiskOdul | null;
};

export type RecommendRow = ScoreRow & { plan: Plan | null };

export type RecommendResponse = Omit<ScoreResponse, 'sonuclar'> & {
  sonuclar: RecommendRow[];
};

/** Temel karar rozeti — `label` 6 değerli, `band` sabit küme. */
export type FaKarar = {
  label: string;
  band: string;
};

/** Bütüncül skorun üç direği — ağırlık/değer motordan, toplama MOTORDA. */
export type Direk = {
  k: string;
  w: number | null;
  v: number | null;
  conf: boolean;
};

export type Butunculluk = {
  /** 0-10 bütüncül skor. İstemci bunu ASLA yeniden hesaplamaz. */
  skor10: number | null;
  band: { l: string; c: string } | null;
  direkler: Direk[];
  coreSoft: number | null;
  /** good | mid | bad | thm | na (sabit küme). */
  buyumeCls: string | null;
};

export type Analiz = {
  faKarar: FaKarar | null;
  butunculluk: Butunculluk | null;
};

export type AnalyzeRow = RecommendRow & { analiz: Analiz | null };

export type AnalyzeResponse = Omit<ScoreResponse, 'sonuclar'> & {
  sonuclar: AnalyzeRow[];
};

/**
 * Kıyas sırası. SIRALAMAYI MOTOR YAPAR: `sira` alanı 1'den başlayarak
 * uçtan geliyor (anahtar `dAtr`, eşitlik bozucu `skor10`). İstemci bu
 * diziyi yeniden sıralarsa ikinci bir sıralama kuralı doğar.
 */
export type SiraKayit = {
  sym: string;
  market: Market;
  sira: number;
  /** in | below | near | far (sabit küme). */
  durum: string;
  dAtr: number | null;
  skor10: number | null;
  /** BİLGİ — sıralamaya girmez (uç notu). */
  rrRatio: number | null;
};

export type CompareResponse = AnalyzeResponse & {
  sira: SiraKayit[];
  /** Alım bandı/fiyatı olmayanlar — sessizce düşürülmez, ekranda yazar. */
  siralanamayan: string[];
};

export type ThemeCandidate = {
  symbol: string;
  market: Market;
  name: string | null;
  reason: string | null;
};

/**
 * Tema cevabı. ÖLÇÜLDÜ (2026-10-18): anahtar yokken üretim
 * `{"query":"yapay zeka","candidates":[],"error":"no_key"}` dönüyor —
 * 200 ile, `ms`/`uyari` alanları OLMADAN. Bu yüzden ikisi de isteğe
 * bağlı ve `error` boş listeyi "sonuç yok" değil "ölçemedim" yapıyor.
 */
export type ThemeResponse = {
  query: string;
  model?: string;
  candidates: ThemeCandidate[];
  error?: string;
  ms?: number;
  uyari?: string;
};
