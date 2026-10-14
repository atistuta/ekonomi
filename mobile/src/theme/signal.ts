// =====================================================================
//  SİNYAL TONU — "renge tek başına bağlanma" kuralı   (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: bir sayının yönünü (artı/eksi/yatay) üç parçaya birlikte çeviren
//  tek fonksiyon: TON (renk) + OK (▲/▼/→) + SÖZ ("artış"/"düşüş").
//
//  NEDEN BİRLİKTE: yol haritası kuralı — "renk körü için ▲/▼ ok (renge
//  bağlı kalma)". Bu kuralı yorum olarak yazmak yetmez; unutulur.
//  Burada ok ve söz, rengin YANINDA değil AYNI nesnede döndüğü için
//  komponent rengi alıp oku atlayamaz: `tone` olmadan `arrow` da yok.
//  Erişilebilirlik ayrıca okunan metinle (`a11yLabel`) sağlanıyor —
//  ekran okuyucu "▲" karakterini anlamlı okumaz.
//
//  NEDEN RENK DEĞİL "TON" DÖNER: gerçek hex `ColorTokens`'tan gelir.
//  Bu dosya temayı bilmez, o yüzden açık/koyu temada aynı çalışır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type { ColorTokens } from './colors';

/** Anlamsal ton. Gerçek renk `toneColors()` ile çözülür. */
export type Tone = 'positive' | 'negative' | 'neutral' | 'gold' | 'info';

export type Signal = {
  tone: Tone;
  /** Görsel ok — renkten BAĞIMSIZ ikinci işaret. */
  arrow: '▲' | '▼' | '→';
  /** Düz-dil karşılığı; renk ve ok görünmese de anlam kalır. */
  word: 'artış' | 'düşüş' | 'yatay';
  /** Ekran okuyucu metni (ok karakteri sesli okunmaz). */
  a11yLabel: string;
};

/**
 * Yön eşiği. `0` tam yatay demek değil: ±0,05% altı gürültüdür, yatay
 * sayılır. Eşiği buraya koyuyoruz ki her ekran kendi eşiğini uydurmasın.
 */
const FLAT_EPSILON = 0.05;

/**
 * Bir değişim değerini (yüzde ya da mutlak fark) sinyale çevirir.
 * `null` / `undefined` / `NaN` → yatay DEĞİL, "veri yok": çağıran bunu
 * sinyale çevirmeden önce ayırmak zorunda (bkz. `src/api/client.ts`
 * içindeki "veri yok ≠ ölçemedim" ayrımı). Burada güvenli taraf
 * seçiliyor: bilinmeyen yön yatay gösterilir, yeşil/kırmızı DEĞİL.
 */
export function signalOf(delta: number | null | undefined): Signal {
  if (delta == null || !Number.isFinite(delta) || Math.abs(delta) < FLAT_EPSILON) {
    return { tone: 'neutral', arrow: '→', word: 'yatay', a11yLabel: 'yatay' };
  }
  if (delta > 0) {
    return { tone: 'positive', arrow: '▲', word: 'artış', a11yLabel: 'artış' };
  }
  return { tone: 'negative', arrow: '▼', word: 'düşüş', a11yLabel: 'düşüş' };
}

/** Tonun ön plan (metin/ikon) ve zemin (pill arka planı) renkleri. */
export function toneColors(colors: ColorTokens, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'positive':
      return { fg: colors.positive, bg: colors.positiveSoft };
    case 'negative':
      return { fg: colors.negative, bg: colors.negativeSoft };
    case 'gold':
      return { fg: colors.gold, bg: colors.goldSoft };
    case 'info':
      return { fg: colors.info, bg: colors.infoSoft };
    case 'neutral':
    default:
      return { fg: colors.neutral, bg: colors.neutralSoft };
  }
}
