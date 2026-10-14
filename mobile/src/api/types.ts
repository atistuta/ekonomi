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

export type ScoreSurum = {
  motor: string;
  ayar: string;
  ekran: string;
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
