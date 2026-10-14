// =====================================================================
//  EKRAN KABUĞU — başlık + kaydırma + zorunlu uyarı   (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Her sekme ekranının dış çerçevesi: güvenli alan boşlukları,
//  kaydırma, ekran başlığı ve EN ALTTA `Disclaimer`.
//
//  NEDEN VAR (7 komponentten fazlası): ürün kuralı "her ekranda
//  disclaimer". Bunu her ekranda elle yazmak, 20 ekranda birinin
//  unutulması demektir — ve unutulan tek ekran SPK açısından en pahalı
//  ekran olur. Burada uyarı KABUĞUN PARÇASI: ekran onu eklemiyor,
//  kaldırması için kabuğu terk etmesi gerekir. Yapısal garanti,
//  hatırlatma değil.
//
//  NEDEN `ScrollView`: içerik FAZ 2'de uzayacak ve küçük ekranda
//  taşacak. Listelerin kendisi FAZ 2'de sanallaştırılmış listeye
//  (FlashList) geçecek; o zaman liste ekranı bu kabuğun `scroll={false}`
//  kipini kullanır — iç içe kaydırma hatasına düşmemek için anahtar
//  şimdiden burada.
//
//  NEDEN ÜST BOŞLUK `insets.top`: sekme yerleşiminde başlık çubuğu
//  kapalı (bkz. (tabs)/_layout.tsx), yani çentik/durum çubuğunu bu
//  kabuk telafi etmek zorunda.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Disclaimer } from './Disclaimer';
import { gutter, maxContentWidth, space, type, useTheme } from '@/theme';

export type ScreenShellProps = {
  /** Ekran başlığı — sekme adıyla aynı olmalı (web menüsüyle hizalı). */
  title: string;
  /** Tek satır: ekranın NE yaptığı. Boş bırakılabilir. */
  subtitle?: string;
  children?: ReactNode;
  /** Uyarının altına eklenecek ek açıklama (ör. veri kaynağı notu). */
  note?: string;
  /** Kendi kaydırmasını yönetecek ekranlar için (FAZ 2 listeleri). */
  scroll?: boolean;
};

export function ScreenShell({
  title,
  subtitle,
  children,
  note,
  scroll = true,
}: ScreenShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const govde = (
    <View style={styles.icerik}>
      <Text style={[styles.baslik, { color: colors.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.altBaslik, { color: colors.textDim }]}>{subtitle}</Text>
      ) : null}
      <View style={styles.gorevler}>{children}</View>
      <Disclaimer note={note} />
    </View>
  );

  const dolgu = {
    paddingTop: insets.top + space.md,
    paddingBottom: space.xxxl,
    paddingHorizontal: gutter,
  };

  if (!scroll) {
    return <View style={[styles.kok, dolgu, { backgroundColor: colors.bg }]}>{govde}</View>;
  }

  return (
    <ScrollView
      style={[styles.kok, { backgroundColor: colors.bg }]}
      contentContainerStyle={dolgu}
      keyboardShouldPersistTaps="handled">
      {govde}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kok: { flex: 1 },
  // Geniş ekranda (web lab / tablet) satırlar okunmaz uzunluğa çıkmasın.
  icerik: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  baslik: { ...type.display },
  altBaslik: { ...type.small, marginTop: space.xs },
  gorevler: { marginTop: space.lg, gap: space.md },
});
