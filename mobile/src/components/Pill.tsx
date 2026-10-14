// =====================================================================
//  Pill / Badge — kısa durum etiketi                  (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: tek satır, yuvarlak uçlu, tonlu etiket. Web'deki `.chip` / `.pill`
//  ailesinin native karşılığı.
//
//  NEDEN `glyph` AYRI PROP: yol haritası kuralı — "renk körü için ▲/▼ ok
//  (renge bağlı kalma)". `tone` pozitif/negatif ise ve çağıran bir işaret
//  vermemişse, pill rengi TEK başına anlam taşıyor olurdu. Bu yüzden
//  `tone` yön taşıyan bir değere ayarlandığında işaret `signalOf()`'tan
//  gelir ve varsayılan olarak basılır; `glyph={null}` ile bilinçli
//  kapatılabilir ama sessizce kaybolmaz.
//
//  NEDEN `Badge` AYNI BİLEŞEN: yol haritası ikisini tek madde yazmış
//  ("Pill/Badge"). Görsel olarak ayrı iki şey yapmak, ikisinin de
//  yarım kalmasına yol açar. `Badge` bilinçli bir takma ad.
// =====================================================================

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, toneColors, type, type Tone, useTheme } from '@/theme';

export type PillProps = {
  label: string;
  /** Anlamsal ton — gerçek renk temadan çözülür. */
  tone?: Tone;
  /**
   * Rengin yanındaki ikinci işaret (▲ / ▼ / ★ / ⚡ ...).
   * `undefined` → yön taşıyan tonlarda otomatik ok.
   * `null`      → bilinçli olarak işaretsiz (yön anlamı taşımayan etiket).
   */
  glyph?: string | null;
  /** Dolgulu görünüm (varsayılan) ya da yalnız kenar. */
  variant?: 'soft' | 'outline';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Yön taşıyan tonlar: işaret zorunlu. */
const DIRECTIONAL: Partial<Record<Tone, string>> = { positive: '▲', negative: '▼' };

export function Pill({
  label,
  tone = 'neutral',
  glyph,
  variant = 'soft',
  size = 'md',
  style,
}: PillProps) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  const mark = glyph === undefined ? DIRECTIONAL[tone] : glyph;
  const textStyle = size === 'sm' ? type.microBold : type.smallBold;

  return (
    <View
      style={[
        styles.pill,
        size === 'sm' ? styles.pillSm : styles.pillMd,
        variant === 'soft'
          ? { backgroundColor: bg, borderColor: 'transparent' }
          : { backgroundColor: 'transparent', borderColor: fg },
        style,
      ]}>
      {mark ? (
        <Text style={[textStyle, { color: fg }]} accessibilityElementsHidden>
          {mark}
        </Text>
      ) : null}
      <Text style={[textStyle, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** `Pill`'in takma adı — yol haritası "Pill/Badge" tek madde. */
export const Badge = Pill;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillMd: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  pillSm: {
    paddingVertical: space.xxs,
    paddingHorizontal: space.sm,
  },
});
