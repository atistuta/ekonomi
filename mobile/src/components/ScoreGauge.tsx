// =====================================================================
//  ScoreGauge — 0-100 skor göstergesi                 (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: motorun 0-100 skorunu sayı + dolgu çubuğu olarak gösterir.
//
//  NEDEN SKORU HESAPLAMAZ: yol haritasının değişmez kuralı — "Motor /
//  skor / bileşke dokunulmaz". Bu komponent bir GÖSTERGE: aldığı sayıyı
//  basar, türetmez, yuvarlamaz (yuvarlama `formatScore`'da, tek yerde).
//
//  NEDEN BANT ETİKETİNİ KENDİSİ UYDURMAZ: 72 skorun "Güçlü" mü "Alım"
//  mı olduğu MOTORUN kararı (`taBand` ve bileşke matrisi). Burada bir
//  eşik tablosu tutmak, aynı skorun webde "Nötr" native'de "İyi"
//  görünmesine yol açardı — tam olarak `tests/parity.mjs`'in
//  engellemeye çalıştığı ayrışma. Bu yüzden `band` metni DIŞARIDAN
//  (API'den) gelir; gelmezse etiket HİÇ basılmaz, yalnız sayı durur.
//
//  NEDEN ÇUBUK RENGİ YİNE DE KADEMELİ: renk burada bir YARGI değil,
//  okunabilirlik yardımı — ve sayı her zaman yanında duruyor, yani
//  anlam renge bağlı değil (renk körü kuralı).
//
//  NEDEN SVG YOK: daire/yay çizmek `react-native-svg` ister. Yol
//  haritası native grafikleri FAZ 3'e koydu (victory-native / Skia);
//  FAZ 1'de bağımlılık eklemek erken. Yatay çubuk `View` ile çiziliyor
//  ve mobil satırda daireden daha okunur.
// =====================================================================

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatScore } from '@/lib/format';
import { radius, space, toneColors, type, type Tone, useTheme } from '@/theme';

export type ScoreGaugeProps = {
  /** 0-100. `null` → ölçülemedi; sıfır GÖSTERİLMEZ, tire gösterilir. */
  score: number | null | undefined;
  /** Neyin skoru — "Teknik", "Temel", "Bileşke". */
  caption?: string;
  /** Motorun bant metni. Verilmezse etiket basılmaz (başlıktaki gerekçe). */
  band?: string;
  /** Çubuk tonunu dışarıdan sabitle; verilmezse skordan türetilir. */
  tone?: Tone;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/**
 * GÖRSEL ton kademesi. Motorun bandı DEĞİL — yalnız çubuğun rengi.
 * Kullanıcıya hiçbir sözle sunulmuyor, o yüzden motorla çelişemez.
 */
function visualTone(score: number): Tone {
  if (score >= 65) return 'positive';
  if (score >= 45) return 'gold';
  return 'negative';
}

export function ScoreGauge({ score, caption, band, tone, size = 'md', style }: ScoreGaugeProps) {
  const { colors } = useTheme();
  const measured = typeof score === 'number' && Number.isFinite(score);
  // Çubuk dolgusu için 0-100'e kıstır — motor dışı bir değer gelse bile
  // düzen bozulmasın (negatif genişlik, %300 dolgu olmaz).
  const pct = measured ? Math.max(0, Math.min(100, score)) : 0;
  const effTone: Tone = measured ? (tone ?? visualTone(pct)) : 'neutral';
  const { fg, bg } = toneColors(colors, effTone);
  const numberStyle = size === 'sm' ? type.title : type.numberLarge;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.topRow}>
        <View style={styles.numberRow}>
          <Text
            style={[numberStyle, { color: measured ? colors.text : colors.textFaint }]}
            accessibilityLabel={
              measured ? `${caption ?? 'Skor'} ${formatScore(score)} / 100` : 'Skor ölçülemedi'
            }>
            {formatScore(score)}
          </Text>
          <Text style={[type.small, styles.outOf, { color: colors.textFaint }]}>/100</Text>
        </View>
        {band ? (
          <Text style={[type.smallBold, { color: fg }]} numberOfLines={1}>
            {band}
          </Text>
        ) : null}
      </View>

      <View style={[styles.track, { backgroundColor: bg, borderColor: colors.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: fg }]} />
      </View>

      {caption ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {caption}
          {measured ? '' : ' — ölçülemedi'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xxs,
  },
  outOf: {
    // Sayıyı taşıyan satırda "/100" ikincil kalsın.
    marginBottom: 2,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
