// =====================================================================
//  ÖLÇÜ TOKEN'LARI — boşluk, yarıçap, yükselti        (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: 4px tabanlı boşluk ölçeği, köşe yarıçapları, gölge/yükselti.
//
//  NEDEN ÖLÇEK: "burası 13px olsun" kararları birikince ritim kaybolur
//  ve ekranlar birbirine benzemez. 4'ün katları tek bir ritim dayatır;
//  AldınGitti dersi ("sorun framework değil execution") tam burada.
//
//  NEDEN ADLAR SAYI DEĞİL: şablonun `Spacing.three = 16` gibi adlandırması
//  (one/two/three) yanıltıcı — "three" 12 değil 16'ydı. xs/sm/md/lg
//  adları değeri gizlemez, ilişkiyi anlatır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Platform, type ViewStyle } from 'react-native';

/** 4px tabanlı boşluk ölçeği. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Ekranın yan boşluğu. Tek bir değer — başlık, kart ve liste aynı
 * dikey çizgiye hizalanır (web'de `padding: 14px 16px`, bkz. styles.css).
 */
export const gutter = 16;

/** Köşe yarıçapları. `pill` tam yuvarlak uç için. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Dokunma hedefi alt sınırı (Apple HIG 44pt / Material 48dp). */
export const hitSlopMin = 44;

/** Okunabilir içerik genişliği — geniş ekranda (web/tablet) satır uzamasın. */
export const maxContentWidth = 680;

/**
 * Yükselti (gölge). Koyu temada gölge neredeyse görünmez — bu yüzden
 * yüzey ayrımı ÖNCE kenar çizgisiyle, sonra gölgeyle kurulur. Gölge
 * burada "biraz derinlik", tek ayırt edici değil.
 */
export const elevation = {
  none: {} as ViewStyle,
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {
      // react-native-web gölgeyi boxShadow'a çevirir.
      shadowColor: 'rgba(0,0,0,0.35)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 8,
    },
  })!,
  raised: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.34,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {
      shadowColor: 'rgba(0,0,0,0.45)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 16,
    },
  })!,
} as const;
