// =====================================================================
//  Card — içerik kabı                                 (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: başlık + (istenirse) sağ yuva + gövde taşıyan yüzey.
//  NEDEN: web'de her bölüm `.card` ile ayrılıyor; native'de de bilgi
//  yoğunluğunu taşıyan birim bu. Tek komponentte durması, kenar/yarıçap/
//  gölge kararlarının 20 ekranda ayrışmasını engelliyor.
//  NEDEN GÖLGE DEĞİL KENAR ÖNCE: koyu mürekkep zeminde gölge görünmez;
//  ayrımı kenar çizgisi yapıyor, gölge yalnız derinlik katıyor
//  (bkz. theme/layout.ts `elevation`).
// =====================================================================

import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevation, radius, space, type, useTheme } from '@/theme';

export type CardProps = {
  /** Kart başlığı. Yoksa başlık şeridi hiç çizilmez. */
  title?: string;
  /** Başlığın altındaki açıklama — "ne + neden"in kullanıcı hâli. */
  subtitle?: string;
  /** Başlık satırının sağ ucu (Pill, sayı, buton). */
  right?: ReactNode;
  children?: ReactNode;
  /** İç boşluğu kapat — tam genişlik liste taşıyan kartlar için. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ title, subtitle, right, children, flush = false, style }: CardProps) {
  const { colors } = useTheme();
  const hasHeader = Boolean(title || subtitle || right);

  return (
    <View
      style={[
        styles.card,
        elevation.card,
        { backgroundColor: colors.bgCard, borderColor: colors.border },
        style,
      ]}>
      {hasHeader ? (
        <View style={[styles.header, flush && styles.headerFlush]}>
          <View style={styles.headerText}>
            {title ? <Text style={[type.heading, { color: colors.text }]}>{title}</Text> : null}
            {subtitle ? (
              <Text style={[type.small, styles.subtitle, { color: colors.textDim }]}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
      ) : null}
      {children ? <View style={flush ? undefined : styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  headerFlush: {
    paddingBottom: space.md,
  },
  headerText: {
    flex: 1,
    gap: space.xxs,
  },
  subtitle: {
    // Başlıkla alt satır arasında hava: alt satır "açıklama", eş değil.
    marginTop: space.xxs,
  },
  right: {
    flexShrink: 0,
  },
  body: {
    padding: space.lg,
    gap: space.md,
  },
});
