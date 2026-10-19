// =====================================================================
//  Dugme — tek dokunma hedefi tanımı                  (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: "Yeniden dene", "Ara", "Ekle", "Çıkar" gibi eylemler.
//
//  NEDEN AYRI KOMPONENT: FAZ 2'de beş ekranda da bir eylem düğmesi var.
//  Her ekran kendi `Pressable`ını yazsa dört şey ayrışırdı: dokunma
//  hedefi yüksekliği (44 kuralı, bkz. layout.hitSlopMin), basılı hâl
//  rengi, erişilebilirlik rolü ve devre dışı görünüm. Tek tanım →
//  hepsi tek yerden.
//
//  NEDEN `accessibilityState.disabled` DE VERİLİYOR: rengi soldurmak
//  ekran okuyucuya hiçbir şey söylemez; kapalı düğme kapalı DUYULMALI.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { hitSlopMin, radius, space, toneColors, type, useTheme, type Tone } from '@/theme';

export type DugmeProps = {
  label: string;
  onPress: () => void;
  tone?: Tone;
  variant?: 'solid' | 'outline';
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Dugme({
  label,
  onPress,
  tone = 'gold',
  variant = 'solid',
  size = 'md',
  disabled = false,
  style,
}: DugmeProps) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.kok,
        size === 'sm' ? styles.sm : styles.md,
        variant === 'solid'
          ? { backgroundColor: bg, borderColor: fg }
          : { backgroundColor: 'transparent', borderColor: colors.border },
        pressed && !disabled ? { backgroundColor: colors.bgPressed } : null,
        disabled ? styles.kapali : null,
        style,
      ]}>
      <Text
        style={[size === 'sm' ? type.microBold : type.smallBold, { color: disabled ? colors.textFaint : fg }]}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kok: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  md: {
    minHeight: hitSlopMin,
    paddingHorizontal: space.lg,
  },
  sm: {
    minHeight: 32,
    paddingHorizontal: space.md,
  },
  kapali: {
    opacity: 0.5,
  },
});
