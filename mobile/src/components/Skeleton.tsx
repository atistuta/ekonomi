// =====================================================================
//  Skeleton — yükleniyor durumu                       (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: içerik gelene kadar duran soluk blok. `SkeletonText`,
//  `SkeletonRow`, `SkeletonScoreCard`, `SkeletonChart` ve
//  `SkeletonSiraRow` aynı bloktan kurulu hazır düzenler.
//
//  NEDEN ŞEKİL ŞEKİL AYRI DÜZEN (FAZ 3): tek bir "satır" iskeleti beş
//  ekranın hepsinde kullanılınca Analiz ekranı skor kartı beklerken
//  liste satırı gösteriyordu — iskeletin sözü ("ŞU gelecek") yalan
//  oluyordu ve içerik gelince düzen sıçrıyordu. `Durum`un `sekil`
//  prop'u ekranın beklediği şekli seçer.
//
//  NEDEN ÇARK (spinner) DEĞİL: yol haritası FAZ 3 "algılanan hız"
//  maddesi. Dönen çark "bekle" der, iskelet "ŞU gelecek" der. Satır
//  sayısı ve yüksekliği gerçek içerikle aynı olduğunda içerik yerleşince
//  düzen SIÇRAMAZ; çarkta her zaman sıçrar.
//
//  NEDEN RN `Animated` (Reanimated DEĞİL): nabız efekti için RN'in kendi
//  `Animated` API'si yeterli ve şablonda hazır. `react-native-reanimated`
//  yol haritasında FAZ 2-3 işi (jest/kaydırma animasyonları); FAZ 1'de
//  yalnız nabız için bağımlılık eklemek erken olurdu.
//
//  NEDEN ERİŞİLEBİLİRLİK ETİKETİ VAR: ekran okuyucu boş kutuları
//  okumaz, kullanıcı sayfanın boş mu yükleniyor mu olduğunu bilemez.
//  `accessibilityLabel` bu belirsizliği kaldırıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, space, useTheme } from '@/theme';

export type SkeletonProps = {
  width?: number | string;
  height?: number;
  /** Köşe yarıçapı token adı. `pill` metin satırları için uygun. */
  rounded?: keyof typeof radius;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = '100%', height = 14, rounded = 'sm', style }: SkeletonProps) {
  const { colors } = useTheme();
  // NEDEN `useState` VE `useRef(...).current` DEGIL: ref'in `.current`ini
  // render sirasinda okumak React 19 kurallarinda yasak (react-hooks/refs);
  // `useState` ilk degeri bir kez uretir ve render sirasinda okunmasi guvenli.
  const [pulse] = useState(() => new Animated.Value(0));

  // NEDEN WEB'DE NATIVE SURUCU KAPALI: react-native-web'de `RCTAnimation`
  // yok; `useNativeDriver: true` konsola uyari basip JS animasyonuna
  // duser (OLCULDU: web lab konsolunda "native animated module is
  // missing"). Telefonda native surucu opaklik icin destekli ve ana
  // is parcacigini bosaltir, o yuzden yalniz web'de kapatiliyor.
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    loop.start();
    // Ekran kapanınca döngü durdurulmalı: aksi hâlde arka planda
    // çalışmaya devam eder (pil + uyarı).
    return () => loop.stop();
  }, [pulse, nativeDriver]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  return (
    <Animated.View
      accessible
      accessibilityLabel="yükleniyor"
      style={[
        styles.block,
        { height, borderRadius: radius[rounded], backgroundColor: colors.skeleton, opacity },
        width != null ? { width: width as number } : null,
        style,
      ]}
    />
  );
}

/** Birkaç satır metnin iskeleti. Son satır kısa, gerçek paragraf gibi. */
export function SkeletonText({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stack, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={12}
          rounded="pill"
          width={i === lines - 1 ? '55%' : i % 2 === 0 ? '100%' : '85%'}
        />
      ))}
    </View>
  );
}

/** Bir `TickerRow`un iskeleti: sol sembol/ad, sağ fiyat/değişim. */
export function SkeletonRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.rowLeft}>
        <Skeleton width={72} height={15} rounded="pill" />
        <Skeleton width={128} height={11} rounded="pill" />
      </View>
      <View style={styles.rowRight}>
        <Skeleton width={84} height={15} rounded="pill" />
        <Skeleton width={56} height={11} rounded="pill" />
      </View>
    </View>
  );
}

/**
 * Bir `ScoreGauge`un iskeleti: üstte büyük sayı + bant etiketi, altta
 * 8 px çubuk, en altta künye satırı. Ölçüler ScoreGauge'ın gerçek
 * ölçüleri (`track.height = 8`, `type.numberLarge`) — içerik yerleşince
 * düzen sıçramasın.
 */
export function SkeletonScoreCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stack, style]}>
      <View style={styles.gaugeUst}>
        <Skeleton width={96} height={30} rounded="sm" />
        <Skeleton width={72} height={13} rounded="pill" />
      </View>
      <Skeleton
        width="100%"
        height={8}
        rounded="pill"
        style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}
      />
      <Skeleton width={110} height={10} rounded="pill" />
    </View>
  );
}

/**
 * Grafik alanının iskeleti: tam genişlik blok + altında eksen etiketi
 * satırı. Yükseklik `FiyatGrafigi`in `GRAFIK_YUKSEKLIK` değeriyle aynı
 * tutulmalı; o sabit o dosyada özel olduğu için burada sayı olarak
 * tekrarlanıyor ve prop'la aşılabiliyor.
 */
export function SkeletonChart({
  height = 168,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stack, style]}>
      <Skeleton width="100%" height={height} rounded="md" />
      <View style={styles.eksen}>
        <Skeleton width={56} height={10} rounded="pill" />
        <Skeleton width={56} height={10} rounded="pill" />
      </View>
    </View>
  );
}

/**
 * Sıra listesinin iskeleti ("1. AAPL  bandın içinde · bütüncül 6,2/10"):
 * tek satır, soldan sağa uzanan tek metin bloğu + ayırıcı çizgi payı.
 */
export function SkeletonSiraRow({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.siraSatir, style]}>
      <Skeleton width={28} height={13} rounded="pill" />
      <Skeleton width={64} height={13} rounded="pill" />
      <Skeleton width={104} height={11} rounded="pill" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    // Genişlik prop'tan gelir; burada yalnız taban duruş.
    alignSelf: 'flex-start',
  },
  gaugeUst: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  eksen: { flexDirection: 'row', justifyContent: 'space-between' },
  siraSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  stack: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  rowLeft: {
    gap: space.xs,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: space.xs,
  },
});
