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

// =====================================================================
//  /api/chart SÖZLEŞME TİPLERİ                        (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: `api/chart.js` uç noktasının cevabının TypeScript karşılığı —
//  OHLCV serisi + künye.
//
//  NEDEN BU UÇ AYRI KÜME: diğer dört uç (score/recommend/analyze/
//  compare) `ayristir()` ile ÇOĞUL sembol alıyor; grafik ucu TEK sembol
//  alıyor ve virgüllü isteği kırpmak yerine 400 `cok_sembol` (azami: 1)
//  ile REDDEDİYOR. ÖLÇÜLDÜ (2026-10-24, üretim):
//    ?symbol=AAPL,MSFT → 400 {"error":"cok_sembol","azami":1}
//  Bu yüzden `fetchChart` sembol kapısından (`sembolUcu`) GEÇMEZ.
//
//  NEDEN `time` SANİYE: ölçülen gövdede `time: 1790256600` — 10 haneli,
//  yani UNIX SANİYE. `new Date(time)` yazmak 1970'e düşürür; her
//  dönüşüm 1000 ile çarpmak zorunda (bkz. lib/format.ts formatGunAy).
//
//  NEDEN MUM ALANLARI `number` (null DEĞİL): ölçülen seride her mumun
//  beş alanı da dolu geldi ve uç nokta eksik mumu diziye koymak yerine
//  atıyor. Yine de çizim katmanı `Number.isFinite` süzgecinden geçirir —
//  tip güvencesi çalışma zamanı güvencesi değildir.
//
//  BOŞ SERİ ARIZA DEĞİL: 200 + `mumlar: []` + `adet: 0` geçerli bir
//  VERİ cevabıdır (yeni halka arz, kapalı pazar). Bunu "ölçemedim"
//  diye göstermek yalan olur; doğrusu "bu aralıkta mum yok".
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/**
 * İzinli aralıklar — sunucunun kümesiyle BİREBİR. ÖLÇÜLDÜ (üretim):
 * `?range=2mo` → 400 `{"error":"bad_range","izinli":["1d","1mo","3mo","6mo","1y","5y"]}`
 */
export const ARALIKLAR = ['1d', '1mo', '3mo', '6mo', '1y', '5y'] as const;
export type Aralik = (typeof ARALIKLAR)[number];

/**
 * İzinli adımlar (interval) — ÖLÇÜLDÜ: `?interval=1h` → 400
 * `{"error":"bad_interval","izinli":["5m","15m","60m","1d"]}`
 */
export const ADIMLAR = ['5m', '15m', '60m', '1d'] as const;
export type Adim = (typeof ADIMLAR)[number];

/** Uç noktanın varsayılanları — sorguya yazılmasa sunucu bunları kullanır. */
export const VARSAYILAN_ARALIK: Aralik = '6mo';
export const VARSAYILAN_ADIM: Adim = '1d';

/**
 * Tek mum. `time` UNIX **SANİYE** (ms değil). Fiyatlar HAM — biçim
 * `lib/format.ts`'in işi.
 */
export type Mum = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Yahoo `meta` künyesi, olduğu gibi geçiriliyor. HEPSİ isteğe bağlı:
 * ölçülen AAPL cevabında `previousClose` ve `scale` YOKTU, `chartPreviousClose`
 * vardı — alanların varlığı sembole/pazara göre değişiyor.
 */
export type ChartKunye = {
  currency?: string | null;
  symbol?: string | null;
  exchangeName?: string | null;
  instrumentType?: string | null;
  firstTradeDate?: number | null;
  regularMarketTime?: number | null;
  gmtoffset?: number | null;
  timezone?: string | null;
  exchangeTimezoneName?: string | null;
  regularMarketPrice?: number | null;
  chartPreviousClose?: number | null;
  previousClose?: number | null;
  scale?: number | null;
  priceHint?: number | null;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  dataGranularity?: string | null;
  range?: string | null;
};

/**
 * Grafik cevabı. `tam === false` → 200 olsa bile ÖLÇÜM EKSİK; aynı
 * `olcumEksik()` yardımcısı bu gövdede de çalışır (`tam` + `sayac`
 * alanları skor cevabıyla aynı şekilde).
 */
export type ChartResponse = {
  sym: string;
  market: Market;
  range: Aralik;
  interval: Adim;
  mumlar: Mum[];
  /** `mumlar.length` — sunucunun saydığı; istemci yeniden saymaz. */
  adet: number;
  kunye: ChartKunye | null;
  sayac: Sayac;
  tam: boolean;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

// =====================================================================
//  /api/news SÖZLEŞME TİPLERİ                         (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `api/news.js` uç noktasının cevabının TypeScript karşılığı —
//  HAM manşet metni + sayaç. Alanlar TAHMİN EDİLMEDİ, uç dosyasının
//  SÖZLEŞME bloğundan (api/news.js:46-63) ve taşıyıcının madde alan
//  kümesinden (api/_haber.js `MADDE_ALANLARI`) okundu.
//
//  NEDEN `Sayac` YENİDEN KULLANILMIYOR: haber sayacı skor sayacının
//  NESNESİ DEĞİL (api/_haber.js `bosHaberSayac`): alanları
//  `{istek, basari, hata, zamanAsimi, kisa, bayt}`; `yahoo/sec/bist`
//  yok. Taşıyıcının kendi başlığı bunun GEREKÇESİNİ yazıyor — haber
//  kesintisi skor kesintisine karışmasın. Tipi `Sayac` yazmak derleyiciye
//  var olmayan alanlar söz vermek olurdu, bu yüzden `olcumEksik()` de bu
//  gövdede ÇALIŞMAZ; ayrı yardımcı `haberOlcumEksik()` var.
//
//  NEDEN `market` AYRI BİR TÜR (`Market` DEĞİL): skor tarafındaki
//  `Market` = 'US' | 'BIST' (borsa), haber ucunun `market`i = 'TR' | 'US'
//  (besleme yereli — api/_haber.js `PAZAR_YERELI`). Aynı adı taşıyan iki
//  ayrı küme; birleştirmek 'BIST' değerini haber ucuna sızdırırdı ve uç
//  400 `bad_market` döndürürdü.
//
//  NEDEN `pubDate` DİZGİ: uç ÜST KAYNAĞIN verdiği gibi dönüyor (RFC-822
//  dizgesi) — ms'e çevirmek biçimlemedir ve istemcide kalır
//  (`lib/format.ts formatHaberTarih`).
//
//  BOŞ LİSTE ARIZA DEĞİL (uç başlığı): 200 + `maddeler: []` + `adet: 0`
//  + `tam: true` geçerli bir VERİ cevabıdır — "bu sorguda haber yok".
//  `tam: false` ise AYRI bir şey: "ölçemedim". Ekran ikisini
//  karıştırmamak zorunda.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Uç noktanın kabul ettiği besleme yerelleri (api/_haber.js PAZAR_YERELI). */
export const HABER_PAZARLAR = ['TR', 'US'] as const;
export type HaberPazar = (typeof HABER_PAZARLAR)[number];

/** Uç noktanın varsayılanı (api/news.js VARSAYILAN_PAZAR). */
export const VARSAYILAN_HABER_PAZAR: HaberPazar = 'TR';

/** api/_haber.js AZAMI_MADDE / VARSAYILAN_MADDE / AZAMI_HABER_SORGU. */
export const AZAMI_MADDE = 25;
export const VARSAYILAN_MADDE = 10;
export const AZAMI_HABER_SORGU = 256;

/**
 * Tek manşet. Dört alan, HEPSİ HAM metin (api/_haber.js MADDE_ALANLARI).
 * `source` ve `link` BOŞ DİZGİ olabilir — taşıyıcı bulamadığında
 * uydurmuyor, boş bırakıyor; ekran da uydurmaz.
 */
export type HaberMadde = {
  title: string;
  link: string;
  /** Üst kaynağın verdiği gibi (RFC-822). Biçimleme istemcide. */
  pubDate: string;
  source: string;
};

/**
 * Haber sayacı — `api/_haber.js bosHaberSayac()`. `kisa` = 200 döndü ama
 * gövde besleme değil (hata sayfası / kesik aktarım): ÖLÇEMEDİM.
 */
export type HaberSayac = {
  istek: number;
  basari: number;
  hata: number;
  zamanAsimi: number;
  kisa: number;
  /** Okunan gövde boyutu — teşhis için. */
  bayt: number;
};

export type NewsResponse = {
  q: string;
  market: HaberPazar;
  limit: number;
  maddeler: HaberMadde[];
  /** `maddeler.length` — sunucunun saydığı; istemci yeniden saymaz. */
  adet: number;
  sayac: HaberSayac;
  /** `false` → 200 olsa bile ÖLÇEMEDİM (hata/zaman aşımı/kısa gövde). */
  tam: boolean;
  ms: number;
  uyari: string;
};

/** Uç noktanın makine hata kodları (api/news.js). */
export type NewsErrorCode =
  | 'missing_q'
  | 'too_long'
  | 'bad_market'
  | 'bad_limit'
  | 'limit_buyuk'
  | 'method_not_allowed'
  | 'haber_alinamadi';

/**
 * Haber cevabı için "ölçemedim" sorusu. `olcumEksik()` BU GÖVDEDE
 * KULLANILAMAZ: o yardımcı `sayac.yahoo/sec/bist` okuyor, haber sayacında
 * o alanlar yok. Tek yer burası — her ekran kendi `if (!veri.tam)`
 * zincirini yazarsa biri `kisa`yı "haber yok" sayar ve yalan söyler.
 */
export function haberOlcumEksik(
  x: { tam?: boolean; sayac?: HaberSayac } | null | undefined,
): boolean {
  if (!x) return false;
  if (x.tam === false) return true;
  const s = x.sayac;
  if (!s) return false;
  return (s.hata ?? 0) > 0 || (s.zamanAsimi ?? 0) > 0 || (s.kisa ?? 0) > 0;
}

// =====================================================================
//  /api/pulse SÖZLEŞME TİPLERİ — ⚡ MAKRO NABIZ        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `api/pulse.js` uç noktasının cevabının TypeScript karşılığı.
//  Alanlar TAHMİN EDİLMEDİ: uç dosyasının SÖZLEŞME bloğundan
//  (api/pulse.js:128-174) ve 200 cevabını kuran gövdeden
//  (api/pulse.js:595-622) okundu; ayrıca canlı ölçüldü (2026-10-25,
//  üretim): POST {q:'Fed faiz'} → 200, `kaynak:'sunucu'`,
//  `haberler.tam:true`, dönen anahtarlar
//  `durus,taze,pencere,degerlendirilen,konjonktur,kaynak,haberler,
//   eksik,surum,ms,uyari`.
//
//  ── `degerlendirilen` BİR SAYI DEĞİL ───────────────────────────────
//  `{ faiz, enflasyon }` NESNESİ: duruş matematiğine GİREN taze manşet
//  sayıları, ayrı ayrı (api/pulse.js:613 — `faizTaze.length` /
//  `enfTaze.length`). Tek sayı sanıp `degerlendirilen` yazmak ekrana
//  "[object Object]" basmak olurdu; bu hata bir kez yapıldı, tip onu
//  derleme zamanında imkânsız kılıyor.
//
//  ── POST, GET DEĞİL ────────────────────────────────────────────────
//  Uç yalnız POST kabul ediyor (api/pulse.js:434 → 405
//  `method_not_allowed`). Girdi manşet LİSTESİ taşıyabildiği için sorgu
//  dizgisine sığmıyor — uç başlığının (b) kararı.
//
//  ── İKİ YOL VAR, HANGİSİ KULLANILDI CEVAPTA YAZIYOR ───────────────
//  `kaynak: 'istemci'` → manşetleri İSTEMCİ gönderdi, uç ağa HİÇ
//  çıkmadı ve `haberler` null. `kaynak: 'sunucu'` → uç manşeti KENDİ
//  taradı ve ölçümünü `haberler` içinde bildirdi. Native istemci RSS
//  tarayamadığı için (uç başlığı, 2026-10-24 kararı) DAİMA sunucu
//  yolunu kullanıyor — yani bu uygulamada `kaynak` her zaman 'sunucu'
//  bekleniyor, ama alan yine de okunup ekranda GÖSTERİLİYOR: tahmin
//  edilmiyor.
//
//  ── `haberler.sayac` SKOR SAYACI DEĞİL ────────────────────────────
//  `HaberSayac` şeklinde (`api/_haber.js bosHaberSayac`): `yahoo/sec/
//  bist` alanları YOK. Bu yüzden `olcumEksik()` BU GÖVDEDE ÇALIŞMAZ;
//  doğru soru `haberOlcumEksik(veri.haberler)`.
//
//  ── `konjonktur: null` ARIZA DEĞİL ────────────────────────────────
//  Uç `genislik` / `enflasyonBaskisi` / `risk` girdilerini İSTEMCİDEN
//  istiyor (uç başlığı: onları manşetten üretmek app.js'in yapmadığı
//  bir hesabı yapmak olurdu). Verilmezlerse blok `null` döner ve
//  `eksik` dizisi nesi eksik olduğunu SÖYLER. Varsayılan sayı koymak
//  "ölçmedim"i "ölçtüm" gibi göstermek olurdu.
//
//  ── BOŞ CEVAP ARIZA DEĞİL ─────────────────────────────────────────
//  Taze manşet yoksa yönler 0 ve `kod: 'neu'` döner (uç başlığı) —
//  dürüst sessizlik, "hata" değil.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Duruş kodu — SABİT KÜME, motordan (app.js `pulseStance` → `cls`). */
export const NABIZ_KODLAR = ['hawk', 'dove', 'neu'] as const;
export type NabizKod = (typeof NABIZ_KODLAR)[number];

/** Konjonktür fazı — SABİT KÜME, motordan (`macroPhase` / CYCLE_PHASES). */
export const KONJONKTUR_FAZLAR = ['early', 'mid', 'late', 'recession'] as const;
export type KonjonkturFaz = (typeof KONJONKTUR_FAZLAR)[number];

/** Manşetleri KİM topladı (api/pulse.js `kaynak`). */
export type NabizKaynak = 'istemci' | 'sunucu';

/**
 * ⚡ Nabız duruşu. `faizYon`/`enflasyonYon`/`baski` -1..+1 HAM sayı —
 * yüzde DEĞİL, biçimleme `lib/format.ts`in işi. `kod` sabit kümeden
 * geliyor ama tip `NabizKod | string`: uç bir gün küme büyütürse ekran
 * kodu olduğu gibi basar, çökmez.
 *
 * `egilimYukari`/`egilimAsagi` MAKİNE SEKTÖR KODLARI (ör. 'banks',
 * 'gold'). Serbest Türkçe etiketler (`CYCLE_PHASES.label`,
 * `PMAC_STANCE_TR`) BİLEREK tele çıkmıyor (uç başlığı: HAM SAYI kuralı).
 */
export type NabizDurus = {
  faizYon: number;
  enflasyonYon: number;
  baski: number;
  kod: NabizKod | string;
  egilimYukari: string[];
  egilimAsagi: string[];
};

/** Son 2 gündeki manşet SAYISI (app.js `fresh2d` ile aynı pencere). */
export type NabizTaze = {
  faiz2g: number;
  enflasyon2g: number;
};

/** Tazelik penceresi — ucun KULLANDIĞI sayılar, istemci seçmiyor. */
export type NabizPencere = {
  /** Yön matematiğine giren gün penceresi (uç: PENCERE_GUN = 14). */
  gun: number;
  tazelikSaat: number;
  tazelikAgirlik: number;
};

/**
 * Duruş matematiğine GİREN taze manşet sayıları. NESNE — tek sayı DEĞİL
 * (bkz. dosya başlığındaki uyarı).
 */
export type NabizDegerlendirilen = {
  faiz: number;
  enflasyon: number;
};

/** Konjonktür boyutları — HAM; `rate` -1..+1, diğerleri 0..1. */
export type NabizBoyutlar = {
  rate: number;
  infl: number;
  growth: number;
  risk: number;
};

export type NabizKonjonktur = {
  faz: KonjonkturFaz | string;
  boyutlar: NabizBoyutlar;
  /** MAKİNE sektör kodları (CYCLE_PHASES[faz].sectors). */
  sektorler: string[];
};

/**
 * Sunucu yolunun çağırana özel sorgusu için okunan manşetler.
 * DİKKAT: bunlar DURUŞ MATEMATİĞİNE GİRMİYOR (uç başlığı) — sembol
 * haberinden makro duruş çıkarmak app.js'in yapmadığı bir hesap olurdu.
 */
export type NabizSorguHaber = {
  sorgu: string;
  market: HaberPazar;
  /** `maddeler.length` — sunucunun saydığı; istemci yeniden saymaz. */
  adet: number;
  maddeler: HaberMadde[];
};

/**
 * Sunucu yolunun ÖLÇÜMÜ. `kaynak === 'istemci'` iken `null`.
 * `faiz`/`enflasyon` = duruşa giren manşet SAYILARI (metin değil).
 * `tam: false` → manşet taraması eksik: duruş yine döndü ama DAHA AZ
 * manşetle hesaplandı. Bu bir HATA DEĞİL; veriyi gizlemez.
 */
export type NabizHaberler = {
  faiz: number;
  enflasyon: number;
  sorgu: NabizSorguHaber[];
  sayac: HaberSayac;
  tam: boolean;
};

export type PulseResponse = {
  durus: NabizDurus;
  taze: NabizTaze;
  pencere: NabizPencere;
  /** NESNE: `{faiz, enflasyon}`. */
  degerlendirilen: NabizDegerlendirilen;
  /** `null` → konjonktür girdileri verilmedi; nesi eksik `eksik` dizisinde. */
  konjonktur: NabizKonjonktur | null;
  kaynak: NabizKaynak;
  haberler: NabizHaberler | null;
  /** Verilmeyen konjonktür girdileri: 'genislik' | 'enflasyonBaskisi' | 'risk'. */
  eksik: string[];
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

/**
 * Uç noktanın makine hata kodları (api/pulse.js). Hepsi 4xx ÜRETİR
 * (yalnız `nabiz_hesaplanamadi` 502, `motor_kurulamadi` 503).
 * `girdi_yok` İSTEMCİ TARAFINDA oluşur: uç bu kodda sunucu yolunu
 * açmayıp eski 400 `faizHaberleri_yok`a düşüyor (api/pulse.js:478-483),
 * yani telde görülmez — yerel kapı aynı adı taşıyor ki iki yerde iki ad
 * olmasın.
 */
export type PulseErrorCode =
  | 'govde_yok'
  | 'bozuk_json'
  | 'govde_buyuk'
  | 'faizHaberleri_yok'
  | 'enflasyonHaberleri_yok'
  | 'cok_baslik'
  | 'bad_baslik'
  | 'bad_haberPazari'
  | 'bad_semboller'
  | 'cok_sembol'
  | 'too_long'
  | 'girdi_yok'
  | 'bad_genislik'
  | 'bad_enflasyonBaskisi'
  | 'bad_risk'
  | 'bad_simdi'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'nabiz_hesaplanamadi';

// =====================================================================
//  /api/causal SÖZLEŞME TİPLERİ — 📉 Günün Nedeni   (ŞERİT 4 / native)
// ---------------------------------------------------------------------
//  NE: `api/causal.js` ucunun İSTEK GÖVDESİ + cevabının TypeScript
//  karşılığı. Uç, belirgin hareket eden endeksleri istemcinin verdiği
//  gündem konseptleriyle eşleştiriyor.
//
//  DÜRÜSTLÜK: uç başlığının kendi sözü — bu bir KORELASYON okumasıdır,
//  kanıtlanmış nedensellik DEĞİL ve TA/FA/bileşke skoruna DAHİL DEĞİL
//  (api/causal.js:9-11). Ekran bunu kesinleşmiş bir neden gibi sunmamalı.
//
//  ── ÖLÇÜLDÜ (2026-10-26, KAYNAK OKUMA — canlı istek ATILMADI) ──────
//  · Yöntem: YALNIZ POST. GET/PUT → 405 `method_not_allowed`
//    (api/causal.js:211-216). OPTIONS → 204.
//  · Gövde doğrulaması: `ayristirGovde` (api/causal.js:144-201).
//    - gövde nesne değil / dizi      → 400 `govde_yok`      (:146)
//    - `hareketler` dizi değil       → 400 `hareketler_yok` (:150)
//    - `gundem` dizi değil           → 400 `gundem_yok`     (:151)
//    - hareketler.length > 12        → 400 `cok_hareket` + azami/istenen (:152)
//    - gundem.length > 60            → 400 `cok_konsept` + azami/istenen (:155)
//    - hareket öğesi nesne değil     → 400 `bad_hareket`    (:165)
//    - `kind` küme dışı              → 400 `bad_kind` + izinli[] (:167)
//    - `pct` sonlu sayı değil        → 400 `bad_pct`        (:169)
//    - `notable` sonlu/≥0 değil      → 400 `bad_notable`    (:171)
//    - konsept öğesi nesne değil     → 400 `bad_konsept`    (:180)
//    - `key` boş                     → 400 `konsept_key_yok` (:182)
//    - dizge gövde > 65536 bayt      → 413 `govde_buyuk`    (:229-233)
//    - dizge gövde JSON değil        → 400 `bozuk_json`     (:237)
//    - motor kurulamadı              → 503 `motor_kurulamadi` (:221)
//    - hesap patladı                 → 502 `neden_hesaplanamadi` (:278)
//  · `kind` İZİNLİ KÜME = motorun `CAUSAL_INDEX_AFFINITY` anahtarları
//    (api/_motor.js:1699-1704): equity_tech · equity_us · equity_tr · gold.
//  · Cevap (api/causal.js:254-274): `baglar` · `degerlendirilen` ·
//    `eslesen` · `surum` · `ms` · `uyari`. BAŞKA ÜST ALAN YOK —
//    `tam` YOK, `sayac` YOK (uç ağa HİÇ çıkmıyor, ölçecek taşıma yok),
//    bu yüzden `olcumEksik()` BU GÖVDEDE ÇALIŞMAZ.
//  · Cevapta `null` dönen alan YOK: `pct` istemcinin gönderdiği sonlu
//    sayının aynısı, `skor` motorun ham çarpımı, `sektorler` dizi
//    (boş olabilir — `matchedSecs` başlangıçta boş, api/_motor.js:1718).
//    Bu yüzden burada hiçbir alan `| null` YAZILMADI; yazmak ucun
//    döndürmediği bir durumu türe sokmak olurdu.
//  · `baglar` BOŞ olabilir ve bu ARIZA DEĞİL (api/causal.js:80-81):
//    ya belirgin hareket yok, ya gürültü eşiğini (1.6) geçen eşleşme yok.
//    Ekran bunu hata diye göstermemeli — dürüst sessizlik.
//  · Motorun ürettiği `why` (serbest Türkçe) ve konseptin başlığı/emojisi
//    TELE KONMADI (api/causal.js:46-55). Dönen tek metinler makine kodu:
//    `kind` ve `sektorler[]`.
//
//  GÜNDEMİ BU KATMAN ÜRETMEZ: girdi ÇAĞIRANDAN gelir (bkz. `fetchCausal`
//  başlığı). Gündem taraması sunucu işi ve ayrı bir şeride devredilecek.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/**
 * Endeks türü — SABİT KÜME. Motorun yakınlık tablosunun anahtarları
 * (api/_motor.js:1699-1704); küme dışı değer 400 `bad_kind` ile
 * REDDEDİLİYOR (sessizce 0 skora düşmüyor), o yüzden tür de dar.
 */
export const NEDEN_KINDLER = ['equity_tech', 'equity_us', 'equity_tr', 'gold'] as const;
export type NedenKind = (typeof NEDEN_KINDLER)[number];

/** Konseptin bir sektöre bakışı. */
export type NedenSektorYon = 'up' | 'down';

/** Gündem ısısı. Küme dışı değer ucta sessizce 'cool' sayılır (:195). */
export const NEDEN_ISILAR = ['hot', 'warm', 'cool'] as const;
export type NedenIsi = (typeof NEDEN_ISILAR)[number];

/** Risk tonu. Küme dışı değer ucta `null` sayılır (:193). */
export type NedenRisk = 'on' | 'off';

/** İstek sınırları — UCUN KENDİ SABİTLERİ (api/causal.js:113-115). */
export const AZAMI_HAREKET = 12;
export const AZAMI_KONSEPT = 60;
export const AZAMI_GOVDE_BAYT = 65536;

/**
 * Bir endeks hareketi — İSTEK girdisi.
 * `pct` günlük değişim yüzdesi (HAM sayı; istemci yuvarlamaz),
 * `notable` belirginlik eşiği (yüzde, ≥0). Eşiği AŞMAYAN hareket ucta
 * elenir (api/_motor.js:1752) — bu bir hata değil, kapsam dışı.
 */
export type NedenHareketGirdi = {
  kind: NedenKind;
  pct: number;
  notable: number;
};

/** Konseptin bir manşeti — ucun OKUDUĞU tek alan saat yaşı (:188). */
export type NedenBaslikGirdi = {
  ageH: number;
};

/**
 * Bir gündem konsepti — İSTEK girdisi. `key` ZORUNLU (boşsa 400
 * `konsept_key_yok`); gerisi isteğe bağlı çünkü uç eksik alanı kendi
 * varsayılanına indiriyor (`sectors: []`, `risk: null`, `tone: null`,
 * `heat: 'cool'`, `heads: []` — api/causal.js:183-197).
 *
 * `sectors` demet (tuple) dizisi: uzunluğu 2 olmayan öğeler ucta
 * SÜZÜLÜYOR (:184) — üç elemanlı bir dizi göndermek sessiz veri kaybı
 * olurdu, tür bunu derlemede engelliyor.
 *
 * `tone` -1..+1 HAM sayı. Sonlu değilse uç `null` sayar.
 */
export type NedenKonseptGirdi = {
  key: string;
  sectors?: [string, NedenSektorYon][];
  risk?: NedenRisk | null;
  tone?: number | null;
  heat?: NedenIsi;
  heads?: NedenBaslikGirdi[];
};

/** `/api/causal` isteğinin TAM gövdesi. İki alan da ZORUNLU dizi. */
export type CausalRequest = {
  hareketler: NedenHareketGirdi[];
  gundem: NedenKonseptGirdi[];
};

/**
 * Hareket ⇄ konsept bağı. `key` İSTEMCİNİN gönderdiği konsept anahtarı
 * (api/causal.js:52-55: konseptin kendisi tele geri konmuyor; başlık ve
 * manşetler çağıranın elinde zaten var).
 *
 * `skor` motorun HAM hizalama çarpımı (api/_motor.js:1744) — ölçeksiz,
 * yuvarlanmamış. Eşik/bant kararı MOTORUN; istemci bu sayıyla
 * karşılaştırma YAPMAZ.
 *
 * `sektorler` eşleşen MAKİNE sektör kodları (`matchedSecs`); boş dizi
 * gelebilir — risk/ton hizasıyla eşleşmiş ama sektör örtüşmesi olmayan
 * bağ demek, "veri yok" DEĞİL.
 */
export type NedenBaglanti = {
  key: string;
  skor: number;
  sektorler: string[];
};

/**
 * Bir endeks hareketi ve ona en iyi hizalanan konseptler.
 * `links` en çok 2 öğe taşır (motor `slice(0, 2)` — api/_motor.js:1761)
 * ve ASLA boş gelmez (boş olanlar ucta düşüyor — :1763).
 *
 * `kind` tipi `NedenKind | string`: uç izinli kümeyi motordan okuyor,
 * motor bir gün tabloyu büyütürse ekran kodu olduğu gibi basar, çökmez.
 */
export type NedenBag = {
  kind: NedenKind | string;
  pct: number;
  links: NedenBaglanti[];
};

export type CausalResponse = {
  /** BOŞ OLABİLİR — arıza değil, dürüst sessizlik. */
  baglar: NedenBag[];
  /** Kaç hareket değerlendirildi (gönderilen hareket sayısı). */
  degerlendirilen: number;
  /** Kaçı bir konseptle eşleşti (`baglar.length`). İstemci yeniden saymaz. */
  eslesen: number;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

/**
 * Uç noktanın makine hata kodları (api/causal.js). Çoğu 400 ÜRETİR;
 * istisnalar: `govde_buyuk` 413 (:231), `method_not_allowed` 405 (:214),
 * `motor_kurulamadi` 503 (:221), `neden_hesaplanamadi` 502 (:278).
 */
export type CausalErrorCode =
  | 'govde_yok'
  | 'bozuk_json'
  | 'govde_buyuk'
  | 'hareketler_yok'
  | 'gundem_yok'
  | 'cok_hareket'
  | 'cok_konsept'
  | 'bad_hareket'
  | 'bad_kind'
  | 'bad_pct'
  | 'bad_notable'
  | 'bad_konsept'
  | 'konsept_key_yok'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'neden_hesaplanamadi';

// =====================================================================
//  /api/watchlist SÖZLEŞME TİPLERİ — cihaz senkronu (ŞERİT 4 / native)
// ---------------------------------------------------------------------
//  NE: `api/watchlist.js` ucunun (Vercel KV) cevap tipleri. Paylaşılan
//  bir `code` anahtarı altında izleme listesi + portföy saklıyor.
//
//  ⚠️ GÜVENLİK — KİMLİK DOĞRULAMASI YOK (api/watchlist.js:30-59):
//  tek kapı `code` ve doğrulaması yalnız BİÇİM (`/^[a-z0-9_-]{4,40}$/i`).
//  Kodu bilen ya da tahmin eden herkes hem OKUR hem YAZAR (POST aynı
//  kapıdan geçiyor), CORS `*` (:24). Yani bu uç bir kimlik değil, bir SIR
//  paylaşımıdır ve zayıf bir kod herkese açıktır. Bu kusur gizlilik
//  politikasında duyuruldu. `code` ASLA kaynağa gömülmez — her çağrıda
//  çağırandan gelir (bkz. `fetchWatchlist` / `pushWatchlist`).
//
//  ── ÖLÇÜLDÜ (2026-10-26, KAYNAK OKUMA — canlı istek ATILMADI) ──────
//  · GET  /api/watchlist?code=… → 200 { list, portfolio, ui, updatedAt }
//    (:62-73). `list`/`portfolio` HER ZAMAN dizi (`data?.list || []`);
//    `ui` ve `updatedAt` KV'de kayıt yoksa `null` — bu yüzden ikisi
//    `| null`, ilk ikisi DEĞİL.
//  · POST /api/watchlist?code=… → 200 { ok, count, portfolioCount,
//    updatedAt } (:100). Dört alanın hiçbiri `null` dönmüyor.
//  · Kayıt şeması `cleanList` (:35-48): `{ symbol, market, query }`.
//    - `symbol` büyük harfe çevrilip 8 karaktere KIRPILIYOR, sonra
//      `/^[A-Z][A-Z0-9.\-]{0,7}$/` süzgecinden geçiyor.
//    - `market` YALNIZ 'BIST' | 'US'; başkası SESSİZCE DÜŞÜYOR.
//    - `query` yoksa `symbol`a eşitlenir, 64 karaktere kırpılır.
//    Yani gönderilen bir kayıt sessizce ELENEBİLİR; yazma cevabının
//    `count`/`portfolioCount` alanı bu yüzden okunmalı (gönderilen
//    sayıyla karşılaştırmak elenmeyi ortaya çıkarır).
//  · Boyut tavanı `MAX_LIST_BYTES = 256 * 1024` (:21) — temizlenmiş
//    YÜKÜN boyutu, isteğin değil (:94).
//  · HATA GÖVDELERİ MAKİNE KODU DEĞİL, İNGİLİZCE CÜMLE: 400 (:56) ·
//    400 (:83) · 413 (:96) · 405 (:104) · 500 `e.message` (:106).
//    Bu yüzden `client.ts` `kodMetni` eşlemesi BU UÇTA ÇALIŞMAZ ve
//    sunucunun cümlesi KULLANILMAZ (hem İngilizce, hem de 500 dalında
//    iç hata metni sızdırabilir). `ApiError.code`da teşhis için kalır.
//
//  `ui` ALANI BİLEREK TİPLENMEDİ: içeriğini uç TANIMLAMIYOR — düz nesne
//  olup olmadığına bakıp olduğu gibi saklıyor (:91-93). Bugünkü şekli WEB
//  istemcisinin kendi durumu (`app.js buildUiState` → `{v, lists,
//  compare}`, app.js:2111) ve web'in localStorage anahtarlarına bağlı.
//  Native için ÖLÇÜLMÜŞ bir karşılığı YOK; o şekli tiplemek web'in iç
//  durumunu sözleşme sanmak olurdu. Bu yüzden `unknown`: okuyan kod kendi
//  daraltmasını yazmak ZORUNDA kalır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** `code` biçim kuralı — UCUN KENDİ regex'i (api/watchlist.js:31). */
export const WATCHLIST_CODE_BICIM = /^[a-z0-9_-]{4,40}$/i;

/** Temizlenmiş yük tavanı, bayt (api/watchlist.js:21). */
export const WATCHLIST_AZAMI_BAYT = 256 * 1024;

/**
 * Tek kayıt — izleme listesi ve portföy AYNI şemayı kullanıyor
 * (api/watchlist.js:34). `market` yalnız iki değer alır; başka değer
 * yazmaya çalışırsan kayıt SESSİZCE düşer.
 */
export type WatchlistKayit = {
  symbol: string;
  market: 'BIST' | 'US';
  query: string;
};

/** GET cevabı. `list`/`portfolio` her zaman dizi; öteki ikisi `null` olabilir. */
export type WatchlistResponse = {
  list: WatchlistKayit[];
  portfolio: WatchlistKayit[];
  /** Web istemcisinin kendi arayüz durumu — şekli SÖZLEŞME DEĞİL. */
  ui: unknown | null;
  /** Son yazma anı — UNIX **MİLİSANİYE** (`Date.now()`, :88). Kayıt yoksa `null`. */
  updatedAt: number | null;
};

/** POST gövdesi. İkisinden EN AZ BİRİ dizi olmalı (yoksa 400). */
export type WatchlistYazGovde = {
  list?: WatchlistKayit[];
  portfolio?: WatchlistKayit[];
};

/**
 * POST cevabı. `count`/`portfolioCount` SUNUCUNUN TEMİZLİKTEN SONRA
 * saydığı kayıt sayısı — gönderdiğinden küçük olabilir (bkz. `cleanList`).
 */
export type WatchlistYazResponse = {
  ok: true;
  count: number;
  portfolioCount: number;
  /** UNIX **MİLİSANİYE**. */
  updatedAt: number;
};
