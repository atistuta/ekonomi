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
//  NEDEN AYRI DOSYA: aynı satır artık İKİ ekranda basılıyor (Bugün ve
//  Arama). İki kopya yazmak, yarın biri "kaynak bildirilmedi" yerine
//  boş dizgi basmaya başladığında iki farklı doğruluk demekti.
//  ÖLÇÜLDÜ 2026-10-25: `(tabs)/kesfet.tsx` içindeki Gündem kartı hâlâ
//  kendi yerel kopyasını kullanıyor; o ekran bu işin kapsamı dışında
//  olduğu için BİLEREK dokunulmadı — birleştirilmesi ayrı bir iş.
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
