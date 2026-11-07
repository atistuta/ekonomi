// =====================================================================
//  BÖLÜM BAŞLIĞI — uzun sekmede yapısal ayrım        (TASARIM TURU 2)
// ---------------------------------------------------------------------
//  NE: Kartların ARASINA giren ekran düzeyinde bölüm başlığı: üstünde
//  saç çizgisi, adı, altında tek satır "bu bölümde ne var" künyesi.
//
//  NEDEN BU YOL, "bölüme atla" DÜĞMESİ DEĞİL (ÖLÇÜLDÜ 2026-10-31):
//  atlama için kaydırma konumu gerekiyor. `ScreenShell` ekranın
//  `ScrollView`unu KENDİ tutuyor ve dışarıya ref VERMİYOR
//  (`components/ScreenShell.tsx`), ayrıca `onLayout` ile ölçülen `y`
//  değerleri kabuğun iç `gorevler` View'una göre geliyor — kaydırma
//  içeriğinin köküne göre değil. Yani `scrollTo` hedefi ÖLÇÜLMÜŞ bir
//  sayı olmazdı, tahmin olurdu; kabuğa ref delmek de tek pull-to-refresh
//  yüzeyini (Listeler sekmesi, `app/(tabs)/index.tsx`) riske atardı.
//  Görev metninin açıkça izin verdiği ikinci yol seçildi: bölüm
//  başlıklarıyla görsel gruplama. Kaydırma ve yenileme davranışı
//  DEĞİŞMEDİ, çünkü hiçbir kaydırıcıya dokunulmadı.
//
//  BURADA SAYI YOK: başlık yalnız metin taşır; sıralama/ sayma/ yüzde
//  hesabı YAPMAZ.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { space, type, useTheme } from '@/theme';

export type BolumBasligiProps = {
  /** Bölümün adı — ör. "Bu listenin ölçümü". */
  baslik: string;
  /** Bölümün bir satırlık künyesi; `null` ise hiç çizilmez. */
  kunye?: string | null;
};

export function BolumBasligi({ baslik, kunye }: BolumBasligiProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.kok, { borderTopColor: colors.border }]}
      accessibilityRole="header"
      accessibilityLabel={baslik}>
      <Text style={[type.smallBold, { color: colors.textDim }]}>{baslik}</Text>
      {kunye ? <Text style={[type.micro, { color: colors.textFaint }]}>{kunye}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    gap: space.xxs,
    paddingTop: space.lg,
    marginTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
