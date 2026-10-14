// =====================================================================
//  Disclaimer — değişmez yasal not                    (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: "Bilgi amaçlıdır, yatırım tavsiyesi değildir." cümlesini basar.
//
//  NEDEN METİN SABİT VE PROP DEĞİL: yol haritasının değişmez kuralı —
//  bu cümle HER ekranda görünmek zorunda ve ürünün SPK konumlandırması
//  buna dayanıyor (bilgi/analiz aracı, tavsiye değil). Metni dışarıdan
//  verilebilir yapsak, bir ekran onu kısaltır, bir başkası yumuşatır.
//  Bu yüzden cümle `DISCLAIMER_TEXT` olarak TEK YERDE sabit; komponent
//  yalnız nasıl görüneceğini seçer (`variant`), ne diyeceğini değil.
//
//  NEDEN `note` AYRI: ek bağlam (ör. "veriler gecikmeli olabilir")
//  ana cümlenin İÇİNE karıştırılmasın. Ek not ikincil satırda durur,
//  ana cümle hep aynı kalır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, space, type, useTheme } from '@/theme';

/** Değişmez cümle. Hiçbir yerde yeniden yazılmaz, buradan okunur. */
export const DISCLAIMER_TEXT = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

export type DisclaimerProps = {
  /**
   * `footer` : ekran dibinde sade satır (varsayılan).
   * `card`   : çerçeveli, dikkat çeken kutu (ilk açılış, uyarı bağlamı).
   */
  variant?: 'footer' | 'card';
  /** Ek bağlam notu. Ana cümleye KARIŞMAZ, ikinci satırda durur. */
  note?: string;
  style?: StyleProp<ViewStyle>;
};

export function Disclaimer({ variant = 'footer', note, style }: DisclaimerProps) {
  const { colors } = useTheme();
  const isCard = variant === 'card';

  return (
    <View
      style={[
        styles.wrap,
        isCard && styles.card,
        isCard && { backgroundColor: colors.bgSoft, borderColor: colors.border },
        style,
      ]}>
      <Text style={[type.micro, styles.text, { color: colors.textDim }]}>{DISCLAIMER_TEXT}</Text>
      {note ? (
        <Text style={[type.micro, styles.text, { color: colors.textFaint }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.xxs,
  },
  card: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    textAlign: 'center',
  },
});
