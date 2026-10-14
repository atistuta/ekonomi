// =====================================================================
//  SectorChip — sektör etiketi                        (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: "Bankacılık", "Yarı iletken" gibi sektör adını taşıyan küçük çip.
//
//  NEDEN RENK ADDAN TÜRETİLİYOR: aynı sektör her ekranda AYNI tonu
//  almalı, yoksa Sektör ekranı ile Karşılaştır ekranı farklı renk
//  gösterir ve kullanıcı renge bir anlam arar. Burada addan deterministik
//  bir indeks üretiliyor (küçük bir karma) ve `colors.sector` paletine
//  eşleniyor. Rastgele renk ya da ekran-içi sayaç kullanılmadı: ikisi de
//  aynı sektöre iki farklı renk verebilir.
//
//  NEDEN RENK ANLAM TAŞIMIYOR: palet yalnız AYIRT ETME aracı. Sektörün
//  iyi/kötü olduğunu söylemiyor — o yargı motorun işi. Bu yüzden ad her
//  zaman yazılı; renk tek başına hiçbir şey ifade etmiyor (renk körü
//  kuralı burada "metin zaten var" ile karşılanıyor).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

export type SectorChipProps = {
  /** Sektör adı — motordan geldiği gibi (Yahoo `sector` / `industry`). */
  sector: string;
  /** Alt alan (Yahoo `industry`) — varsa ikinci satır değil, aynı satırda. */
  detail?: string;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Addan kararlı indeks. Basit bir toplama karması yeterli: amaç
 * kriptografi değil, "aynı ad, aynı kutu".
 */
function paletteIndex(name: string, modulo: number): number {
  let acc = 0;
  for (let i = 0; i < name.length; i += 1) {
    acc = (acc * 31 + name.charCodeAt(i)) % 100003;
  }
  return modulo > 0 ? acc % modulo : 0;
}

export function SectorChip({ sector, detail, size = 'md', onPress, style }: SectorChipProps) {
  const { colors } = useTheme();
  const accent = colors.sector[paletteIndex(sector, colors.sector.length)] ?? colors.neutral;
  const textStyle = size === 'sm' ? type.microBold : type.smallBold;

  const content = (
    <>
      {/* Renk noktası: çipi tarayarak ayırt etmeye yardım eder, ad hep yazılı. */}
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <Text style={[textStyle, { color: colors.text }]} numberOfLines={1}>
        {sector}
      </Text>
      {detail ? (
        <Text style={[textStyle, { color: colors.textDim }]} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </>
  );

  const shell: StyleProp<ViewStyle> = [
    styles.chip,
    size === 'sm' ? styles.chipSm : styles.chipMd,
    { backgroundColor: colors.bgElevated, borderColor: colors.border },
    style,
  ];

  if (!onPress) {
    return <View style={shell}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? sector + ', ' + detail : sector}
      style={({ pressed }) => [shell, pressed && { backgroundColor: colors.bgPressed }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  chipMd: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  chipSm: {
    paddingVertical: space.xxs,
    paddingHorizontal: space.sm,
  },
  dot: {
    width: space.sm,
    height: space.sm,
    borderRadius: radius.pill,
  },
});
