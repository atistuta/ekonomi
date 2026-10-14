// =====================================================================
//  KEŞFET — 3. sekme (iskelet)                        (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: fırsat arama sekmesi. Web'deki "🔍 Keşfet" menüsünün 5 bölümü
//  burada yaşayacak: Fırsatlar, Tarama, Momentum girişi, Sektör, Radar.
//
//  NEDEN SEKTÖR ÇİPLERİ GERÇEK AD TAŞIYOR: sektör adı bir ÖLÇÜM değil,
//  bir kategori adı — "Bankacılık" yazmak uydurma veri üretmek değil.
//  Burada görünmesinin nedeni `SectorChip`in renk eşlemesini (aynı ad →
//  aynı ton) gözle doğrulayabilmek. Hiçbir sayı, skor ya da yön iddiası
//  yok.
//
//  NEDEN SKOR/FİYAT YOK: bu ekranın işi bir TARAMA sonucu göstermek;
//  tarama motordan gelir (FAZ 2). Yer tutucu sayı koymak, ekran
//  görüntüsünde "tarama çalışıyor" izlenimi verirdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, View } from 'react-native';

import { Card, Pill, ScreenShell, SectorChip, SkeletonText } from '@/components';
import { space } from '@/theme';

/** Web menüsündeki adlar — `index.html` "🔍 Keşfet" grubundan AYNEN. */
const BOLUMLER = [
  '🔥 Fırsatlar',
  '🔎 Tarama',
  '⚡ Momentum girişi',
  '🗺️ Sektör',
  '🌍 Radar',
] as const;

/** Sektör adları — kategori adı, ölçüm değil (bkz. dosya başlığı). */
const SEKTORLER = ['Bankacılık', 'Yarı iletken', 'Perakende', 'Havacılık'] as const;

export default function KesfetScreen() {
  return (
    <ScreenShell
      title="Keşfet"
      subtitle="Fırsat taraması, sektör ve küresel radar. Veri bağlama FAZ 2'de."
      note="Tarama sonuçları motor API'den gelir; bu ekranda henüz istek atılmıyor.">
      <Card title="Bölümler" subtitle="Web'deki sıra korunuyor">
        <View style={styles.satir}>
          {BOLUMLER.map((ad) => (
            <Pill key={ad} label={ad} tone="neutral" variant="outline" glyph={null} />
          ))}
        </View>
      </Card>

      <Card
        title="🗺️ Sektör"
        subtitle="Çip renkleri addan türetilir — aynı ad her ekranda aynı ton"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <View style={styles.satir}>
          {SEKTORLER.map((ad) => (
            <SectorChip key={ad} sector={ad} />
          ))}
        </View>
      </Card>

      <Card
        title="🔥 Fırsatlar"
        subtitle="FAZ 2'de dolacak"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <SkeletonText lines={3} />
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
