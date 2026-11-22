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
//  ── ANKET KAPISI (PROcess) ──────────────────────────────────────────
//  NEDEN ROTA DEĞİL, KAPI: açılış anketi `<Slot/>` YERİNE basılıyor.
//  expo-router 57'de kökten `Stack` dışa açılmadığı için (yukarıdaki
//  ölçüm) anketi sekmelerin ÜSTÜNE modal olarak açmanın yolu yok; ayrı
//  rota açmak ise 5'li menüye altıncı bir giriş riski demek. Kapı,
//  menüye dokunmadan aynı işi yapıyor.
//
//  NEDEN `useProfilHazir` BEKLENİYOR: kayıt okunmadan karar verilirse
//  anketi DAHA ÖNCE yapmış kullanıcıya her açılışta bir kare anket
//  yanıp sönüyor. Depo okunana kadar hiçbir şey basılmıyor.
//
//  KARAR TEK ALAN DEĞİL: `profilKararVerildiMi` = tamamlandı YA DA
//  atlandı. "Atladı" ayrı bir alan, çünkü "yanıtlamadı" ile "boş
//  yanıtladı" aynı şey değil (depo.ts §11).
//
//  `anahtar` NEDEN ARTTIRILIYOR: `profilSifirla` kaydı siliyor, kapı
//  yeniden açılıyor; anket ekranının adım durumu sıfırdan başlasın diye
//  kapanışta anahtar değişiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { profilKararVerildiMi, profilYukle, useProfil, useProfilHazir } from '@/api/depo';
import { AnketEkrani } from '@/components/anket';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { name, colors } = useTheme();
  const taban = name === 'light' ? DefaultTheme : DarkTheme;

  const profil = useProfil();
  const profilHazir = useProfilHazir();
  const [anketAnahtar, setAnketAnahtar] = useState(0);

  // Profil `depoBaslat`ın okuduğu web türlerinden DEĞİL (native'e özel),
  // bu yüzden kaydı kabuk okutuyor — `BildirimKart` ile aynı desen.
  useEffect(() => {
    void profilYukle();
  }, []);

  // `fonts` alanını taşıyoruz: react-navigation 7 temasında zorunlu ve
  // yazı tipi seçimi bizim işimiz değil (sistem fontu, bkz. typography).
  const navTema = {
    ...taban,
    dark: name === 'dark',
    colors: {
      ...taban.colors,
      primary: colors.vurgu,
      background: colors.bg,
      card: colors.bgSoft,
      text: colors.text,
      border: colors.border,
      notification: colors.negative,
    },
  };

  // Kayıt okunmadan karar yok: anket de uygulama da basılmıyor.
  const anketGerekli = profilHazir && !profilKararVerildiMi(profil);

  return (
    <ThemeProvider value={navTema}>
      <StatusBar style={name === 'light' ? 'dark' : 'light'} />
      {anketGerekli ? (
        <AnketEkrani key={anketAnahtar} onKapandi={() => setAnketAnahtar((n) => n + 1)} />
      ) : (
        <Slot />
      )}
    </ThemeProvider>
  );
}
