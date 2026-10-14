// =====================================================================
//  KÖK YERLEŞİM — tema + durum çubuğu                 (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Uygulamanın en dış kabuğu. Gezinme kütüphanesine tema renklerini
//  verir, durum çubuğunu ayarlar ve altındaki yerleşimi (`(tabs)`)
//  gösterir.
//
//  NEDEN `Slot` VE STACK DEĞİL: expo-router 57'de kökten `Stack`
//  dışa açılmıyor (ÖLÇÜLDÜ: node_modules/expo-router/build/exports.d.ts
//  yalnız `Navigator`, `Slot`, `ExperimentalStack` veriyor; `Stack` için
//  `expo-router/native-stack` ya da `expo-router/js-stack` gerekiyor).
//  FAZ 1'de sekmelerin ÜSTÜNE açılan bir ekran yok, bu yüzden en yalın
//  kabuk: `Slot`. Hisse sayfası (FAZ 2) geldiğinde burada tek satır
//  değişir — `(tabs)` grubu zaten ayrı olduğu için dosya taşımak
//  gerekmez.
//
//  NEDEN ŞABLONUN SPLASH KODU KALDIRILDI: şablon `preventAutoHideAsync()`
//  çağırıp gizlemeyi `AnimatedSplashOverlay`'e bırakıyordu. O komponenti
//  sildik; `preventAutoHideAsync` kalsaydı açılış ekranı HİÇ kapanmaz,
//  uygulama siyah ekranda kalırdı. Kendi açılış animasyonu FAZ 3'ün işi.
//
//  NEDEN NAVIGASYON TEMASI ELLE KURULDU: react-navigation'ın hazır
//  `DarkTheme`'i kendi gri tonlarını kullanıyor; sekme çubuğu ile
//  ekranlar iki ayrı koyu renge düşer ve ekran geçişlerinde arka plan
//  "yanıp söner". Renkleri `theme/colors.ts`'ten besliyoruz —
//  tek kaynak kuralı (bkz. colors.ts başlığı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme';

export default function RootLayout() {
  const { name, colors } = useTheme();
  const taban = name === 'light' ? DefaultTheme : DarkTheme;

  // `fonts` alanını taşıyoruz: react-navigation 7 temasında zorunlu ve
  // yazı tipi seçimi bizim işimiz değil (sistem fontu, bkz. typography).
  const navTema = {
    ...taban,
    dark: name === 'dark',
    colors: {
      ...taban.colors,
      primary: colors.gold,
      background: colors.bg,
      card: colors.bgSoft,
      text: colors.text,
      border: colors.border,
      notification: colors.negative,
    },
  };

  return (
    <ThemeProvider value={navTema}>
      <StatusBar style={name === 'light' ? 'dark' : 'light'} />
      <Slot />
    </ThemeProvider>
  );
}
