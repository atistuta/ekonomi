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

// =====================================================================
//  KEŞİF BEŞLİSİ — /api/tarama · /api/sektor · /api/radar ·
//                  /api/backtest · /api/deger      (api/_kesif.js)
// ---------------------------------------------------------------------
//  NE: beş ucun istek/cevap sözleşmesi, tip olarak.
//  NEDEN: beşi de `api/proxy.js` yeniden-yazımıyla taşınıyor ve
//  gövdeleri ÖTEKİ UÇLARA BENZEMİYOR (ikisi POST, biri saf sözlük, biri
//  ağa çıkan tek uç). Şekli tipte sabitlemek, bir alan sunucuda adını
//  değiştirdiğinde ekranı derleme zamanında kırar.
//  ÖLÇÜLDÜ (2026-10-27, kaynak okuma): alan adları ve sınır değerleri
//  `api/_kesif.js` ile BİREBİR; motorun döndürdüğü küme değerleri
//  (`cls`, `basis`, `neden`, `kategori`) `api/_motor.js`ten okundu.
//  EŞİK/AĞIRLIK/FORMÜL BURADA YOK — yalnız şekil.
// =====================================================================

/**
 * Ölçüm kaydı — `/api/tarama` ve `/api/sektor`un gövdesindeki
 * `olcumler[]` kalemi (`api/_kesif.js ayristirOlcumler`).
 *
 * ⚠️ ÖLÇÜMLERİ İSTEMCİ VERİR. İki uç da AĞA ÇIKMIYOR: temel kayıtları
 * istemci `/api/yfin` üzerinden çekip buraya GİRDİ olarak veriyor.
 *
 * ⚠️ ÖLÇÜLMEMİŞ SAYI `null` — ASLA 0. Uç `Number(null) === 0` tuzağını
 * kasıtlı atlatıyor (`api/_kesif.js`: F/K'sı olmayan şirket "F/K = 0"
 * ile en ucuz görünürdü). Alanı 0 ile doldurmak o kapıyı delmek olur.
 *
 * `ok: false` → "bu kayıt için veri gelmedi". Uç onu motora olduğu gibi
 * taşıyor; motor `atlanan[]`a `'no-data'` gerekçesiyle yazıyor, sektör
 * ucu ise kaydı gruba HİÇ ALMIYOR.
 *
 * Sayılar HAM: oran alanları (profitMargin, returnOnEquity,
 * revenueGrowth, earningsGrowth, dividendYield) KESİR — yüzdeye
 * çevrilmemiş hâlleri bekleniyor.
 */
export type OlcumKayit = {
  symbol: string;
  market?: Market;
  /** `false` → veri gelmedi. Verilmezse `true` sayılır. */
  ok?: boolean;
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
  dividendYield?: number | null;
  price?: number | null;
  sector?: string | null;
  industry?: string | null;
  name?: string | null;
  bizSummary?: string | null;
};

/** Tek istekte gönderilebilen en çok ölçüm kaydı (`AZAMI_OLCUM`). */
export const AZAMI_OLCUM = 120;

/**
 * Tarama önayarları — motorun `SCAN_PRESETS` anahtarları.
 * ÖLÇÜLDÜ (api/_motor.js:2406): value · growth · quality. Uç beyaz
 * listeyi motordan okuyor; bu dizi onun KOPYASI (yerel kapı için).
 * Türkçe ad ve açıklama (`name`/`desc`) TELE KONMADI.
 */
export const TARAMA_PRESETLER = ['value', 'growth', 'quality'] as const;
export type TaramaPreset = (typeof TARAMA_PRESETLER)[number];

/**
 * Tarama rozet sınıfı — `scanTag`ın makine kodu (api/_motor.js:2409).
 * Metni uç BİLEREK düşürdü (tavsiye dili taşıyor).
 */
export const TARAMA_CLS = ['strong', 'good', 'weak'] as const;
export type TaramaCls = (typeof TARAMA_CLS)[number];

/**
 * Ölçüt rozeti sınıfı — `scanCrit` (api/_motor.js:2424).
 * `na` = o ölçüt ÖLÇÜLEMEDİ. "Nötr" DEĞİL.
 */
export const TARAMA_OLCUT_CLS = ['pass', 'mid', 'fail', 'na'] as const;
export type TaramaOlcutCls = (typeof TARAMA_OLCUT_CLS)[number];

/** Tek ölçüt: `ad` bir ölçüt adı ('F/K'), `cls` motorun sınıfı. */
export type TaramaOlcut = {
  ad: string;
  cls: TaramaOlcutCls | string;
};

/**
 * Taranmış tek kayıt. `skor` HAM sayı (yuvarlanmamış — biçimlemek
 * `lib/format.ts`in işi). `present` kaç alt-skorun ÖLÇÜLDÜĞÜ.
 */
export type TaramaSonuc = {
  sym: string;
  market: Market;
  skor: number;
  cls: TaramaCls | string | null;
  present: number;
  olcutler: TaramaOlcut[];
};

/**
 * Skorlanamayan kayıt. `neden` motorun `reason`ı: ÖLÇÜLDÜ
 * (api/_kesif.js:334) `'no-data' | 'neg-earnings'`.
 * ⚠️ BU LİSTE SIFIR SKOR DEĞİL: "ölçemedim" ayrı duruyor; 0 yazmak
 * zarar eden şirketi "en ucuz" gösterirdi.
 */
export type TaramaAtlanan = {
  sym: string;
  market: Market;
  neden: 'no-data' | 'neg-earnings' | string;
};

export type TaramaRequest = {
  preset: TaramaPreset;
  olcumler: OlcumKayit[];
};

export type TaramaResponse = {
  preset: TaramaPreset | string;
  /** Skoru AZALAN sırada — sıralamayı SUNUCU yaptı, istemci yeniden sıralamaz. */
  sonuclar: TaramaSonuc[];
  atlanan: TaramaAtlanan[];
  /** Kaç kayıt değerlendirildi (yineleme tekilleştirildikten sonra). */
  degerlendirilen: number;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

export type TaramaErrorCode =
  | 'bad_preset'
  | 'olcumler_yok'
  | 'olcumler_bos'
  | 'cok_olcum'
  | 'bad_olcum'
  | 'symbols_bos'
  | 'too_long'
  | 'bad_market'
  | 'bad_symbol'
  | 'govde_yok'
  | 'bozuk_json'
  | 'govde_buyuk'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'tarama_hesaplanamadi';

/**
 * Sektör gruplarının sıralama kipi — `SIRA_KIPLERI` (api/_kesif.js:99).
 * Sıralamayı MOTOR yapıyor (`sekSortGroups`); bu yalnız kipin adı.
 */
export const SIRA_KIPLERI = ['cheap', 'growth', 'margin', 'count'] as const;
export type SiraKip = (typeof SIRA_KIPLERI)[number];
export const VARSAYILAN_SIRA: SiraKip = 'cheap';

/**
 * Sınıflandırmanın hangi kademeden geldiği — motorun `sekClassify`ı
 * (api/_motor.js:2637). `null` → hiçbir kademe tutmadı (`_other`).
 */
export const SEKTOR_BASIS = ['sector', 'industry', 'fund', 'tag', 'biz'] as const;
export type SektorBasis = (typeof SEKTOR_BASIS)[number];

/**
 * Grup içindeki tek hisse. Beş sayı da HAM: `revenueGrowth` ve
 * `profitMargin` KESİR (0.18 = %18) — web istemcisi ekranda ×100
 * yapıyor, o bir EKRAN ölçeklemesi ve uca kopyalanmadı.
 */
export type SektorHisse = {
  sym: string;
  market: Market;
  basis: SektorBasis | null;
  trailingPE: number | null;
  forwardPE: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  peg: number | null;
};

/**
 * Tek sektör grubu.
 *
 * ⚠️ MEDYANLAR HAM KESİR — YÜZDE DEĞİL. ÖLÇÜLDÜ (api/_kesif.js:434-444
 * + uç başlığı): `medGrowth`/`medMargin` motorun `sekMedian`ından
 * KESİR olarak geliyor (0.18 = %18); `medPe`/`medFpe`/`medPeg` çarpansız
 * oran. Ekranda yüzde göstermek isteyen ×100'ü BİR KEZ yapar — burada
 * ya da `lib/format.ts`te ikinci bir ölçekleme iki kat yanlış basar.
 *
 * `medPe` ile `medFpe` AYRI: web istemcisi trailingPE yoksa forwardPE'ye
 * düşüyor, o yedek bir KARAR ve uca kopyalanmadı.
 * Medyan hiç ölçülemedi ise `null` — 0 DEĞİL.
 */
export type SektorGrup = {
  /** `SEK_META` anahtarı ('Technology' … '_other'). Emoji/Türkçe ad TELE KONMADI. */
  anahtar: string;
  n: number;
  hisseler: SektorHisse[];
  medPe: number | null;
  medFpe: number | null;
  medGrowth: number | null;
  medMargin: number | null;
  medPeg: number | null;
};

export type SektorRequest = {
  olcumler: OlcumKayit[];
  sira?: SiraKip;
};

export type SektorResponse = {
  sira: SiraKip | string;
  /** Sıralamayı MOTOR yaptı (`sekSortGroups`) — istemci yeniden sıralamaz. */
  gruplar: SektorGrup[];
  degerlendirilen: number;
  /** Kaç kayıt gruba girdi. `degerlendirilen`den KÜÇÜK olabilir: `ok:false` kayıtlar girmez. */
  siniflanan: number;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

export type SektorErrorCode =
  | 'bad_sira'
  | 'olcumler_yok'
  | 'olcumler_bos'
  | 'cok_olcum'
  | 'bad_olcum'
  | 'symbols_bos'
  | 'too_long'
  | 'bad_market'
  | 'bad_symbol'
  | 'govde_yok'
  | 'bozuk_json'
  | 'govde_buyuk'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'sektor_hesaplanamadi';

/** Temanın bir sektöre yönü. Bu bir AL/SAT işareti DEĞİL, yön etiketi. */
export type RadarYon = 'up' | 'down';

/** `[sektör anahtarı, yön]` ikilisi (motorun `impacts` kalemi). */
export type RadarEtki = [string, RadarYon];

/**
 * Tek radar teması. `sorgu` haber taramasının ARAMA METNİ — istemci onu
 * `/api/news`e girdi olarak verir. `emoji` TELE KONMADI.
 */
export type RadarTema = {
  anahtar: string;
  etiket: string;
  /** Haber dili ('tr' | 'en' ölçüldü; küme sunucuda kapalı DEĞİL). */
  dil: string;
  sorgu: string;
  etkiler: RadarEtki[];
};

/**
 * `/api/radar` cevabı — SAF SÖZLÜK okuması, ağa çıkmıyor.
 * `semboller` YALNIZ `sektor=` verildiğinde geliyor: o etikete sahip
 * MOTOR SÖZLÜĞÜNDEKİ semboller. Kullanıcının listesi DEĞİL.
 */
export type RadarResponse = {
  temalar: RadarTema[];
  /** sektör anahtarı → Türkçe sektör adı (`SECTORS`). */
  sektorler: Record<string, string>;
  semboller?: string[];
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

export type RadarErrorCode =
  | 'bad_tema'
  | 'bad_sektor'
  | 'too_long'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'radar_alinamadi';

/**
 * Backtest skor kovası. ⚠️ `label` YOK — uç kova ADINI BİLEREK düşürdü
 * (tavsiye dili) ve yerine `i` SIRA NUMARASINI koydu. Kova sınırlarını
 * istemci BİLMİYOR ve uydurmaz.
 * `avg`/`pos` kovada örnek yoksa `null` — 0 DEĞİL.
 */
export type BacktestKova = {
  i: number;
  n: number;
  /** Ortalama ileri getiri — HAM KESİR. */
  avg: number | null;
  /** Pozitif biten örneklerin oranı — HAM KESİR. */
  pos: number | null;
};

/**
 * `computeBacktest` çıktısı (api/_motor.js), kovaları adsızlaşmış
 * hâliyle. Tüm oranlar HAM KESİR; yuvarlama/yüzde YOK.
 */
export type BacktestSonuc = {
  /** İleri getiri ufku (bar) — motorun `TA_HORIZON[vade]`si. */
  H: number;
  stride: number;
  warmup: number;
  intraday: boolean;
  nSamples: number;
  /** Örneklerin ne kadarı pozitif bitti (taban oran) — KESİR. */
  baseUp: number;
  alN: number;
  alHit: number | null;
  satN: number;
  satHit: number | null;
  dirN: number;
  dirHit: number | null;
  buckets: BacktestKova[];
  monotonic: boolean;
  /** Spearman bilgi katsayısı. */
  ic: number;
  stratRet: number;
  bhRet: number;
  sharpe: number;
  mdd: number;
  switches: number;
  winRate: number | null;
  longIv: number;
};

/**
 * `/api/backtest` cevabı.
 *
 * ⚠️ `sonuc` NULL OLABİLİR VE BU BİR ARIZA DEĞİL. ÖLÇÜLDÜ
 * (api/_motor.js `computeBacktest`): motor seri `warmup + H + 40` barın
 * altındaysa ya da örnek sayısı 12'nin altındaysa `null` döndürüyor —
 * dürüst "ölçemedim". Bu yüzden `ApiResult` tarafında HATA DEĞİL:
 * `r.ok === true` ve `r.data.sonuc === null` birlikte gelir. Ekran bunu
 * "ölçülemedi" diye YAZMAK zorunda; `ApiError.kind === 'unmeasured'`
 * ile KARIŞTIRILMAZ (o, ağ/5xx/zaman aşımı demek — yani sunucuya
 * ulaşamadık; burada ulaştık, sunucu dürüstçe ölçemediğini söyledi).
 *
 * `adet` çekilen mum sayısı: `sonuc === null` iken bile dolu olabilir
 * (seri geldi, ama motor için kısa).
 */
export type BacktestResponse = {
  sym: string;
  market: Market;
  vade: Vade;
  range: Aralik;
  interval: Adim;
  adet: number;
  sonuc: BacktestSonuc | null;
  sayac: Sayac;
  /** Kesinti yok mu? `false` → ölçüm EKSİK. */
  tam: boolean;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

export type BacktestErrorCode =
  | 'symbol_yok'
  | 'too_long'
  | 'cok_sembol'
  | 'bad_market'
  | 'bad_symbol'
  | 'bad_vade'
  | 'bad_range'
  | 'bad_interval'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'backtest_hesaplanamadi';

/**
 * Metal türleri — motorun `METAL_MACRO_W` anahtarları
 * (ÖLÇÜLDÜ api/_motor.js:2223). Uç beyaz listeyi motordan okuyor; bu
 * dizi onun KOPYASI. ⚠️ KAPI ZORUNLU: `computeMetalMacro` bilinmeyen
 * anahtarda sessizce genel bir ağırlık kümesine düşüyor — kapı olmasa
 * uç ölçmediği bir sayıyı ölçmüş gibi verirdi.
 */
export const METAL_TURLER = ['gram-altin', 'gumus', 'platin'] as const;
export type MetalTur = (typeof METAL_TURLER)[number];

/** `/api/deger`in tür alanı: metal (GET) ya da kripto (POST). */
export type DegerTur = MetalTur | 'kripto';

/**
 * Metal makro ölçüm alanları (api/_kesif.js:778). Hepsi İSTEĞE BAĞLI:
 * verilmeyen ölçüm `null` geçer, motor onu nötr alıp çekincesine yazar.
 * ⚠️ UYDURMA SAYI GÖNDERİLMEZ: ölçmediğin alanı HİÇ göndermek, 0
 * göndermekten dürüsttür — 0 ölçülmüş bir değer gibi davranır.
 */
export const METAL_OLCUM_ALANLAR = [
  'dxyChg',
  'tnxChg',
  'vix',
  'gsr',
  'pgr',
  'cuChg',
  'ownM',
  'ownH',
] as const;
export type MetalOlcumAlan = (typeof METAL_OLCUM_ALANLAR)[number];

/** Ölçüm demeti — verilmeyen/`null` alan "ölçülmedi" demektir. */
export type MetalOlcumler = Partial<Record<MetalOlcumAlan, number | null>>;

/**
 * Kripto kategorisi — motorun `cryptoCategory`si (api/_motor.js:2113).
 * Türkçe etiket (`catLabel`) TELE KONMADI.
 */
export const DEGER_KATEGORILER = ['stablecoin', 'meme', 'l1', 'defi', 'other'] as const;
export type DegerKategori = (typeof DEGER_KATEGORILER)[number];

/**
 * Bant makine kodu — `scoreBand` (api/_motor.js:2105). Etiket
 * ('Elverişli rejim' vb.) TELE KONMADI.
 */
export const DEGER_BANT_CLS = ['strong', 'good', 'neutral', 'weak', 'bad'] as const;
export type DegerBantCls = (typeof DEGER_BANT_CLS)[number];

/**
 * Tek bileşen. `ad` bileşen adı ('Dolar (DXY)'), `w` motorun ağırlığı,
 * `skor` bileşen skoru. `note` METNİ uçta DÜŞÜRÜLDÜ.
 * Ağırlıklar MOTORDAN gelir; istemci bunlarla yeniden skor HESAPLAMAZ.
 */
export type DegerBilesen = {
  ad: string;
  skor: number;
  w: number;
};

/**
 * `/api/deger` cevabı (metal ve kripto AYNI şekil).
 * `kategori` yalnız kripto yolunda geliyor.
 * `uyariAdet` motorun çekince SAYISI — metinleri uçta düşürüldü, ama
 * "kaç çekince var" dürüstlük bilgisi olduğu için sayı geçiyor.
 */
export type DegerResponse = {
  tur: DegerTur | string;
  skor: number;
  cls: DegerBantCls | string | null;
  kategori?: DegerKategori | string;
  bilesenler: DegerBilesen[];
  uyariAdet: number;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

/** Kripto yolu POST gövdesi. `belge` CoinGecko `/coins/{id}` belgesi. */
export type DegerKriptoRequest = {
  tur: 'kripto';
  belge: Record<string, unknown>;
};

export type DegerErrorCode =
  | 'bad_tur'
  | 'bad_olcum'
  | 'belge_yok'
  | 'govde_yok'
  | 'bozuk_json'
  | 'govde_buyuk'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'deger_hesaplanamadi';

// =====================================================================
//  /api/news GÜNDEM KİPİ SÖZLEŞME TİPLERİ             (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `GET /api/news?gundem=1[&market=TR|US][&limit=N]` cevabının
//  TypeScript karşılığı. Alanlar TAHMİN EDİLMEDİ: uç dosyasının SÖZLEŞME
//  bloğundan (api/news.js:106-115), 200 cevabını kuran gövdeden
//  (api/news.js:328-343) ve taşıyıcının `gundemCek` dönüşünden
//  (api/_haber.js:490-531) okundu.
//
//  NEDEN `NewsResponse` YENİDEN KULLANILMIYOR: bu kipte `q` DİZGİ DEĞİL,
//  `null` (uç `q: null` yazıyor — serbest metin yok) ve gövdede
//  `NewsResponse`'ta BULUNMAYAN iki alan var: `besleme[]` ve `tekrar`.
//  Aynı tipi iki şekle zorlamak, ekranda `besleme`yi `undefined`
//  sanıp kaynak başına ölçümü SESSİZCE düşürmeye davet olurdu — webin
//  (app.js:6534 `loadGeneral`) düşen beslemeyi hiç yazmama kusuru tam
//  buradan doğuyor. Ayrı tip, derleme zamanında zorluyor.
//
//  NEDEN `market` AYRI KÜME (`HaberPazar` DEĞİL): gündem kipinde izinli
//  yereller `GUNDEM_YERELLER` (api/news.js:281 — `GUNDEM_BESLEMELER`in
//  anahtarları). Bugün ikisi de ['TR','US'] ama kümeler AYRI kaynaktan
//  geliyor: beslemeler eklenirse biri büyür, öteki büyümez. Aynı ada
//  bağlamak, ileride var olmayan bir yereli uca göndermek olurdu.
//
//  ── `durum` MAKİNE KODU ────────────────────────────────────────────
//  `'ok' | 'bos'` (api/_haber.js:516: `n > 0 ? 'ok' : 'bos'`). Türkçe
//  etiket UÇTA YOK, İSTEMCİDE üretilir. `'bos'` = "o kaynaktan madde
//  OKUYAMADIM" — "o kaynakta haber yok" DEĞİL, ikisi ayırt edilemez;
//  ekran bunu ÖLÇEMEDİM diye yazmak zorunda.
//
//  ── `tam: false` ARIZA DEĞİL ───────────────────────────────────────
//  `tam = okunan === liste.length && haberTam(sayac)` (api/_haber.js:528).
//  Yani "beslemelerin BİR KISMINI okuyamadım" demek; 200 ve maddeler
//  gerçek. Ekran onu hata kutusu gibi göstermez, EKSİK ÖLÇÜM diye yazar.
//
//  ── BOŞ LİSTE ARIZA DEĞİL ──────────────────────────────────────────
//  200 + `maddeler: []` + `adet: 0` + `tam: true` geçerli bir VERİ
//  cevabıdır (uç başlığı, api/news.js:138).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/**
 * Gündem kipinin izinli yerelleri — `GUNDEM_YERELLER`
 * (api/_haber.js:423 = `Object.keys(GUNDEM_BESLEMELER)`).
 */
export const GUNDEM_YERELLER = ['TR', 'US'] as const;
export type GundemYerel = (typeof GUNDEM_YERELLER)[number];

/** Uç noktanın varsayılanı (api/news.js VARSAYILAN_PAZAR ile aynı). */
export const VARSAYILAN_GUNDEM_YEREL: GundemYerel = 'TR';

/** Kaynak başına ölçüm kodu. Türkçe etiket istemcide. */
export const GUNDEM_BESLEME_DURUMLAR = ['ok', 'bos'] as const;
export type GundemBeslemeDurum = (typeof GUNDEM_BESLEME_DURUMLAR)[number];

/**
 * KAYNAK BAŞINA ölçüm satırı. `ad` beslemenin adı — düşen besleme
 * GÖVDEDE duruyor ki ekran "5 kaynaktan 4'ü okundu, düşen: X" diyebilsin.
 */
export type GundemBesleme = {
  ad: string;
  /** `'bos'` → o kaynaktan madde OKUNAMADI (ölçemedim). */
  durum: GundemBeslemeDurum | string;
  /** O kaynaktan okunan madde sayısı (tekilleştirme ÖNCESİ). */
  adet: number;
};

/**
 * Gündem maddesi. `HaberMadde`nin dört alanına uç iki alan daha
 * ekliyor (api/_haber.js:81 `MADDE_ALANLARI`). Gündem kipinde
 * `symbol` DAİMA `null` (madde bir sembole bağlı değil) ve `source`
 * BESLEMENİN ADI.
 */
export type GundemMadde = HaberMadde & {
  /** api/_haber.js `HABER_TURU` — bugün 'NEWS'. */
  type: string;
  /** Gündem kipinde `null`: madde sembole bağlı değil. */
  symbol: string | null;
};

export type GundemResponse = {
  /** Bu kipte DAİMA `null` — serbest metin yok. */
  q: null;
  gundem: true;
  market: GundemYerel | string;
  limit: number;
  maddeler: GundemMadde[];
  /** Sunucunun saydığı; istemci yeniden saymaz. */
  adet: number;
  /** Kaynak başına ölçüm — SESSİZCE DÜŞÜRÜLEMEZ. */
  besleme: GundemBesleme[];
  /** İki beslemede birden çıkıp TEKİLLEŞTİRİLEN madde sayısı. */
  tekrar: number;
  sayac: HaberSayac;
  /** `false` → beslemelerin bir kısmı okunamadı (eksik ölçüm). */
  tam: boolean;
  ms: number;
  uyari: string;
};

/**
 * Gündem kipine özgü makine hata kodları (api/news.js:237, 253).
 * Ötekiler (`bad_market`, `bad_limit`, `limit_buyuk`,
 * `method_not_allowed`, `haber_alinamadi`) `NewsErrorCode` ile aynı.
 */
export type GundemErrorCode = NewsErrorCode | 'bad_gundem' | 'gundem_ve_sorgu';

// =====================================================================
//  /api/arama SÖZLEŞME TİPLERİ — ÇOK PAZARLI ADAY   (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `GET /api/arama?q=<terim>[&limit=N]` cevabının TypeScript
//  karşılığı. Alanlar TAHMİN EDİLMEDİ: `api/_kesif.js`in SÖZLEŞME
//  bloğundan (:799-833), `aramaAday()` dönüşünden (:869-905) ve 200
//  gövdesini kuran bloktan (:975-986) okundu.
//
//  NİYE VAR: `api/_girdi.js:161` çıplak bir terimde pazarı SESSİZCE 'US'
//  varsayıyor — `ASELS` → `scoreFaUS` → skor `null`. O sözleşme altı uç
//  tarafından paylaşıldığı için DEĞİŞTİRİLMEDİ; bu uç varsayımın yerine
//  geçen dürüst yolu veriyor: pazarı tahmin etmek yerine ÇOK PAZARLI
//  ADAY LİSTESİ döndürüp seçimi kullanıcıya bırakıyor.
//
//  ── `pazar: null` GİZLENEMEZ ───────────────────────────────────────
//  `AramaPazar` KAPALI MAKİNE KODU kümesi. `null` = "borsa kodunu
//  tanımadım, TAHMİN ETMİYORUM" (ölçüldü: `CME`, `TOR`, `GER` gibi
//  kodlar kümede YOK). Ekranda "bilinmeyen" diye yumuşatmak yalan
//  olurdu — "hangi pazar olduğunu ölçemedim" diye yazılır.
//
//  ── TÜRKÇE ETİKET UÇTA YOK ─────────────────────────────────────────
//  `borsa` HAM borsa kodu ('IST','NMS','PCX','CCC'…), `tur` HAM Yahoo
//  `quoteType`'ı ('EQUITY','ETF','CRYPTOCURRENCY','FUTURE','INDEX'…).
//  Etiketi İSTEMCİ yazar. ⚠️ ENDEKS ÜYELİĞİ İDDİA EDİLEMEZ: Yahoo arama
//  kaydında endeks üyeliği alanı YOK (uç başlığında ölçüldü) — 'NYQ' bir
//  BORSA kodudur; "S&P 500 hissesi" demek UYDURMA olurdu.
//
//  ── `motorUc: null` → MOTORA GÖNDERİLEMEZ ──────────────────────────
//  Motorda KRİPTO PAZARI YOK (`PAZARLAR = ['US','BIST']`), bu yüzden
//  kripto adayının `motorSembol`ü `null`. `'analyze'` → `motorSembol`
//  doğrudan `/api/analyze`e konulabilir (BIST `ASELS.IS`, ABD çıplak
//  `AAPL`). `'chart'` → kalem motorun KAPALI endeks sözlüğünden geliyor
//  (`cozEndeks`, api/_girdi.js:119 — yalnız dört kalem) ve YALNIZ
//  `/api/chart` okuyor.
//
//  ── BOŞ LİSTE ≠ ÖLÇEMEDİM ──────────────────────────────────────────
//  `adaylar: [] + tam: true` = "aradım, eşleşme yok" (ölçülmüş cevap).
//  `tam: false` = taşıma kesintisi, ölçüm EKSİK. AYRI iki ekran dalı.
//
//  ⚠️ `adet` İSTEMCİDE YENİDEN SAYILMAZ ama KIRPMA BİLGİSİ TAŞIMAZ:
//  ÖLÇÜLDÜ (api/_kesif.js:970+986) → `adet = adaylar.length` ve uç
//  Yahoo'dan ZATEN `quotesCount=limit` kadar kayıt istiyor. Yani
//  "kaç aday limit yüzünden dışarıda kaldı" HİÇBİR ALANDA YOK; ekran
//  bunu 0 diye yazamaz, "ölçülmedi" diye yazar.
//
//  ⚠️ ÖLÇÜLMEDİ: ucun CANLI cevabı (bu şeritte ağ erişimi yok) — tipler
//  kaynaktan türetildi, üretimden doğrulanmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Aday tavanı — `api/_kesif.js ARAMA_AZAMI`. */
export const ARAMA_AZAMI = 25;
/** Uç noktanın varsayılanı — `api/_kesif.js ARAMA_VARSAYILAN`. */
export const ARAMA_VARSAYILAN = 10;

/**
 * Pazar MAKİNE KODU — `api/_kesif.js aramaPazar()` çıktısının kapalı
 * kümesi. `null` ayrı bir değer: "borsa kodu tanınmadı".
 */
export const ARAMA_PAZARLAR = ['BIST', 'US', 'KRIPTO'] as const;
export type AramaPazar = (typeof ARAMA_PAZARLAR)[number];

/**
 * Adayın motorla ölçülme yolu. `null` → bu varlık için motor yolu YOK
 * (ör. kripto: motorda kripto pazarı yok).
 */
export const ARAMA_MOTOR_UCLAR = ['analyze', 'chart'] as const;
export type AramaMotorUc = (typeof ARAMA_MOTOR_UCLAR)[number];

/**
 * Tek arama adayı. HAM KOD KURALI: `borsa`/`tur` Yahoo'nun kendi
 * kodları, Türkçe etiket İSTEMCİDE üretilir.
 *
 * `ad`/`borsa`/`tur`/`sektor` ölçülmezse `null` — boş dize DEĞİL
 * (`api/_kesif.js` `metin()` yardımcısı boş dizeyi `null`a çeviriyor).
 */
export type AramaAday = {
  /** Yahoo'nun HAM sembolü: 'ASELS.IS' · 'AAPL' · 'BTC-USD'. */
  sembol: string;
  /** `shortname ?? longname`; ölçülmezse `null`. */
  ad: string | null;
  /** HAM borsa kodu: 'IST' · 'NMS' · 'PCX' · 'CCC' … */
  borsa: string | null;
  /** HAM Yahoo `quoteType`ı: 'EQUITY' · 'ETF' · 'CRYPTOCURRENCY' … */
  tur: string | null;
  sektor: string | null;
  /** `null` → borsa kodu tanınmadı, pazar TAHMİN EDİLMEDİ. */
  pazar: AramaPazar | null;
  /** Motorun KABUL ETTİĞİ biçim; `null` → bu motorla ölçülemez. */
  motorSembol: string | null;
  motorPazar: Market | null;
  /** `null` → motora GÖNDERİLEMEZ, yalnız listede gösterilir. */
  motorUc: AramaMotorUc | null;
};

export type AramaResponse = {
  /** Ucun gördüğü terim (kırpılmış ham metin). */
  q: string;
  /** Ucun kullandığı aday tavanı. */
  limit: number;
  adaylar: AramaAday[];
  /** Sunucunun saydığı; `adaylar.length` ile AYNI (uç gövdesi). */
  adet: number;
  sayac: Sayac;
  /** `false` → taşıma kesintisi, ölçüm EKSİK (boş liste "yok" demez). */
  tam: boolean;
  surum: ScoreSurum;
  ms: number;
  uyari: string;
};

/**
 * Arama ucunun makine hata kodları — KAPALI küme.
 * 400: `q_yok` · `too_long` (+`azami`) · `bad_limit` (+`asgari`/`azami`)
 * 405: `method_not_allowed` · 503: `motor_kurulamadi`
 * 502: `arama_yapilamadi`
 */
export type AramaErrorCode =
  | 'q_yok'
  | 'too_long'
  | 'bad_limit'
  | 'method_not_allowed'
  | 'motor_kurulamadi'
  | 'arama_yapilamadi';
