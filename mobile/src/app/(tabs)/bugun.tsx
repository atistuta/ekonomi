// =====================================================================
//  BUGÜN — 2. sekme (iskelet)                         (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: günlük akış sekmesi. Web'deki "📡 Bugün" menüsünün altındaki 4
//  bölüm burada yaşayacak: Gündem, Haberler, Nabız, Hisse Haberleri.
//
//  NEDEN ALT BÖLÜMLER ŞİMDİDEN YAZILI: web'de bunlar açılır menüde;
//  telefonda açılır menü kötü bir kalıp (tek elle zor, keşfedilmez).
//  Alt bölümlerin ADLARINI şimdi göstermek, FAZ 2'de hangi gezinme
//  kalıbına (segment / yatay şerit) geçeceğimizi ölçmemizi sağlıyor.
//  Şu an TIKLANMIYORLAR ve bu metinde açıkça yazıyor — çalışmayan bir
//  düğmeyi çalışıyormuş gibi göstermek, en pahalı yalan.
//
//  NEDEN HABER BAŞLIĞI UYDURULMADI: uydurma manşet ekran görüntüsünde
//  gerçek haber gibi görünür. Yerine iskelet metin satırları var.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, View } from 'react-native';

import { Card, Pill, ScreenShell, SkeletonText } from '@/components';
import { space } from '@/theme';

/** Web menüsündeki adlar — `index.html` "📡 Bugün" grubundan AYNEN. */
const BOLUMLER = ['⭐ Gündem', '📰 Haberler', '⚡ Nabız', '📰 Hisse Haberleri'] as const;

export default function BugunScreen() {
  return (
    <ScreenShell
      title="Bugün"
      subtitle="Günün gündemi, haberler ve anlık sıçramalar. Veri bağlama FAZ 2'de."
      note="Alt bölüm adları web menüsünden alındı; bu sürümde henüz tıklanmıyorlar.">
      <Card title="Bölümler" subtitle="Web'deki sıra korunuyor">
        <View style={styles.pills}>
          {BOLUMLER.map((ad) => (
            <Pill key={ad} label={ad} tone="neutral" variant="outline" glyph={null} />
          ))}
        </View>
      </Card>

      <Card
        title="⭐ Gündem"
        subtitle="FAZ 2'de dolacak"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <SkeletonText lines={3} />
      </Card>

      <Card
        title="⚡ Nabız"
        subtitle="FAZ 2'de dolacak — anlık sıçrama taraması"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <SkeletonText lines={2} />
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
