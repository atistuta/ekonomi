// =====================================================================
//  LİSTELER — 1. sekme (iskelet)                      (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Takip listelerinin yaşayacağı ekran. Şimdilik BOŞ: veri bağlama
//  FAZ 2'nin işi.
//
//  NEDEN BOŞ EKRAN DA OLSA ŞİMDİ VAR: 5 sekmenin sırası ürünün
//  omurgası (web menüsüyle birebir). Sekmeyi sonra eklemek, yönlendirme
//  adlarını (`/`, `/bugun`, ...) sonradan değiştirmek demekti; derin
//  bağlantılar ve FAZ 4 bildirimleri bu adlara tutunacak.
//
//  NEDEN UYDURMA HİSSE YOK: iskelet ekranda "AAPL 192,40" göstermek,
//  ekran görüntüsünde canlı veri gibi görünür. Bunun yerine ölçülmemiş
//  durum AÇIKÇA gösteriliyor: Skeleton satırları ve senkron durumunun
//  dürüst metni.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { getSupabase } from '@/api/supabase';
import { Card, Pill, ScreenShell, SkeletonRow } from '@/components';
import { space, type, useTheme } from '@/theme';

export default function ListelerScreen() {
  const { colors } = useTheme();
  const senkron = getSupabase();

  return (
    <ScreenShell
      title="Listeler"
      subtitle="Takip ettiğin hisseler. Veri bağlama FAZ 2'de."
      note="Fiyat ve skorlar motor API'den gelir; bu ekranda henüz istek atılmıyor.">
      <Card
        title="Takip listesi"
        subtitle="FAZ 2'de dolacak"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <View style={styles.satirlar}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </Card>

      <Card title="Bulut senkronu">
        <Text style={[styles.metin, { color: colors.textDim }]}>
          {senkron.ok ? 'Senkron yapılandırıldı.' : senkron.message}
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  satirlar: { gap: space.sm },
  metin: { ...type.small },
});
