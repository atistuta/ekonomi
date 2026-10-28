// =====================================================================
//  HABER SATIRI — tek manşet, SALT SUNUM                (native / UI)
// ---------------------------------------------------------------------
//  NE: `/api/news` maddesinin (`HaberMadde`) tek satırlık gösterimi:
//  başlık + "kaynak · tarih". Başlık bağlantı taşıyorsa tarayıcıda
//  açılır.
//
//  NEDEN BU KLASÖRDE: bu dosya VERİ ÇEKMİYOR — klasörün kuralı
//  ("bu kartlar veri çekmez, satırları PROP olarak alır") aynen
//  geçerli. Manşeti kim istediyse (Bugün'deki 🔭 tematik haber kartı,
//  Arama'daki 📰 tema haberleri kartı) isteği o atıyor.
//
//  NEDEN AYRI DOSYA: aynı satır ÜÇ ekranda basılıyor (Bugün · Arama ·
//  Keşfet/Gündem). Üç kopya yazmak, yarın biri "kaynak bildirilmedi"
//  yerine boş dizgi basmaya başladığında üç farklı doğruluk demekti.
//  ÖLÇÜLDÜ 2026-10-27: `(tabs)/kesfet.tsx`teki yerel kopya SİLİNDİ ve o
//  ekran da bu dosyayı içe aktarıyor (2026-10-25 tarihli "hâlâ kendi
//  kopyasını kullanıyor" ölçümü artık geçerli değil). Gövde iki dosyada
//  BİREBİR aynıydı; davranış değişmedi.
//
//  BURADA HESAP YOK: metinler ucun verdiği gibi basılıyor; kısaltma,
//  çeviri ya da "olumlu/olumsuz" etiketi yok — o yorum olurdu. Tarih
//  biçimlemesi `lib/format.ts`e bırakılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Linking, StyleSheet, Text, View } from 'react-native';

import { type HaberMadde } from '@/api';
import { formatHaberTarih } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export type HaberSatiriProps = {
  madde: HaberMadde;
};

export function HaberSatiri({ madde }: HaberSatiriProps) {
  const { colors } = useTheme();
  const baslik = (madde.title ?? '').trim();
  const link = (madde.link ?? '').trim();
  const kaynak = (madde.source ?? '').trim();
  const tarih = formatHaberTarih(madde.pubDate);

  return (
    <View style={styles.satir}>
      {/* Bağlantı YOKSA basılabilir görünmüyor: tıklanınca hiçbir şey
          olmayan bir başlık, çalışıyormuş gibi görünen bir yalandır. */}
      <Text
        {...(link
          ? {
              accessibilityRole: 'link' as const,
              onPress: () => {
                void Linking.openURL(link).catch(() => {});
              },
            }
          : null)}
        style={[type.small, { color: colors.text }]}>
        {baslik || 'Başlık gelmedi'}
      </Text>
      <Text style={[type.micro, { color: colors.textDim }]}>
        {(kaynak || 'kaynak bildirilmedi') + ' · ' + tarih}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { gap: 2, paddingVertical: space.sm },
});
