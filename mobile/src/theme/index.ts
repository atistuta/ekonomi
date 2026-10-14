// =====================================================================
//  TASARIM SİSTEMİ GİRİŞİ + useTheme()               (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: tema token'larını tek yerden dışa açar ve komponentlerin
//  kullandığı `useTheme()` kancasını verir.
//
//  NEDEN PROVIDER YOK: tema kullanıcı seçimine değil cihaz görünümüne
//  bağlı (`useColorScheme`). Context kurmak şu an yalnız boru tesisatı
//  olurdu. Kullanıcı tercihi (FAZ 3 "koyu/açık tema") geldiğinde tek
//  değişiklik bu dosyada olur: `useTheme()` imzası aynı kalır,
//  içi tercihi okur. Komponentlerin hiçbiri değişmez.
//
//  NEDEN KOYU VARSAYILAN: yol haritası koyuyu birincil sayıyor ve
//  `app.json` → `userInterfaceStyle: "dark"`. `useColorScheme()` null
//  dönerse (web ilk çerçeve, test ortamı) koyuya düşer — açık temaya
//  kazayla düşmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './colors';
import { elevation, gutter, hitSlopMin, maxContentWidth, radius, space } from './layout';
import { numeric, textRole, type, weight } from './typography';

export type { ColorTokens } from './colors';
export type { Signal, Tone } from './signal';
export { signalOf, toneColors } from './signal';
export { elevation, gutter, hitSlopMin, maxContentWidth, radius, space };
export { numeric, textRole, type, weight };
export { darkColors, lightColors };

export type ThemeName = 'dark' | 'light';

export type Theme = {
  name: ThemeName;
  colors: ColorTokens;
};

const THEMES: Record<ThemeName, ColorTokens> = { dark: darkColors, light: lightColors };

/**
 * Yürürlükteki tema. Komponentler rengi YALNIZ buradan okur; dosya
 * içinde hex yazılmaz (bkz. colors.ts başlığı).
 */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'light' ? 'light' : 'dark';
  return { name, colors: THEMES[name] };
}
