// =====================================================================
//  TickerRow — sembol + fiyat + değişim satırı        (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: liste satırı. Sol: sembol + (varsa) şirket adı. Sağ: fiyat ve
//  yüzde değişim.
//
//  NEDEN BİÇİMLENDİRME BURADA: `BAGIMLILIK_GRAFIGI.md` §5.1 kararı —
//  motor HAM SAYI döner, `tr-TR` biçimlendirmesi istemcide kalır.
//  Satır ham `number` alır, `src/lib/format.ts` ile basar. Sunucudan
//  gelen hazır dizgiyi basmak, para birimi ve ondalık ayracını sunucunun
//  yerel ayarına kilitlerdi.
//
//  NEDEN ▲/▼ VE RENK BİRLİKTE: `theme/signal.ts` tek nesnede ton + ok +
//  söz döndürüyor; satır rengi alıp oku atlayamaz (renk körü kuralı).
//  Ekran okuyucuya da ok karakteri değil, "artış/düşüş" sözü okunuyor.
//
//  NEDEN SABİT YÜKSEKLİK: FAZ 2'de bu satır sanal listede (FlashList)
//  kullanılacak; `ROW_HEIGHT` dışa açık, böylece liste satır yüksekliğini
//  ölçmek zorunda kalmaz (kaydırma sıçraması olmaz).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { EMPTY, formatPercent, formatPrice } from '@/lib/format';
import {
  hitSlopMin,
  numeric,
  radius,
  signalOf,
  space,
  toneColors,
  type,
  useTheme,
} from '@/theme';

/** Satır yüksekliği — sanal liste (FAZ 2) bunu ölçmeden kullanabilsin. */
export const ROW_HEIGHT = hitSlopMin + space.xl;

export type TickerRowProps = {
  /** Sembol — "THYAO", "NVDA". Büyük harf dönüşümü yapılmaz (motor ne derse). */
  symbol: string;
  /** Şirket adı / açıklama. Yoksa satır tek satırlık kalır. */
  name?: string;
  /** HAM fiyat. `null` → ölçülemedi, tire basılır. */
  price?: number | null;
  /** Para birimi kodu (TRY / USD / KRW ...). Yoksa simge uydurulmaz. */
  currency?: string | null;
  /** HAM yüzde puanı değişim (ör. -1.4). */
  changePct?: number | null;
  /** Sağ uçta fiyat yerine özel içerik (skor, rozet). */
  right?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TickerRow({
  symbol,
  name,
  price,
  currency,
  changePct,
  right,
  onPress,
  style,
}: TickerRowProps) {
  const { colors } = useTheme();
  const measured = typeof changePct === 'number' && Number.isFinite(changePct);
  const sig = signalOf(changePct);
  const { fg } = toneColors(colors, sig.tone);

  const body = (
    <View style={styles.inner}>
      <View style={styles.left}>
        <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {symbol}
        </Text>
        {name ? (
          <Text style={[type.small, { color: colors.textDim }]} numberOfLines={1}>
            {name}
          </Text>
        ) : null}
      </View>

      {right ?? (
        <View style={styles.right}>
          <Text style={[type.bodyBold, styles.num, { color: colors.text }]} numberOfLines={1}>
            {formatPrice(price, currency)}
          </Text>
          <View style={styles.changeRow}>
            {/* Ok renkten BAĞIMSIZ ikinci işaret; ölçülemediyse hiç basılmaz. */}
            {measured ? (
              <Text style={[type.smallBold, { color: fg }]} accessibilityElementsHidden>
                {sig.arrow}
              </Text>
            ) : null}
            <Text
              style={[type.smallBold, styles.num, { color: measured ? fg : colors.textFaint }]}
              numberOfLines={1}
              accessibilityLabel={
                measured ? `${formatPercent(changePct)} ${sig.a11yLabel}` : 'değişim ölçülemedi'
              }>
              {measured ? formatPercent(changePct) : EMPTY}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return <View style={[styles.row, style]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}${name ? ' — ' + name : ''}`}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.bgPressed },
        style,
      ]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: ROW_HEIGHT,
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  left: {
    flex: 1,
    gap: space.xxs,
  },
  right: {
    alignItems: 'flex-end',
    gap: space.xxs,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  num: {
    // Sayı sütunu satırdan satıra kaymasın. Tanım TEK YERDE:
    // theme/typography.ts → `numeric`. Burada yeniden yazılmıyor.
    ...numeric,
  },
});
