// =====================================================================
//  Satir — etiket · değer ikilisi                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: hisse detay kartlarının tek yapı taşı: solda etiket, sağda
//  motorun verdiği değer; istenirse değerin önünde renk körü işareti
//  (▲/▼/→) ve ikinci bir yardımcı sütun.
//
//  NEDEN AYRI KOMPONENT: detay ekranının beş kartının DÖRDÜ aynı satır
//  düzenini istiyor (teknik döküm, temel kriter, tez direği, risk
//  kalemi). Her kart kendi `flexDirection: 'row'`unu yazsa dört şey
//  ayrışırdı: dikey boşluk, uzun etiketin kırpılması, sayı yuvası
//  (`tabular-nums`) ve ekran okuyucunun duyduğu cümle. Tek tanım →
//  dördü de aynı ritimde.
//
//  NEDEN SAYI STİLİ ZORLA `numeric`: değer sütunu fiyat/skor/ağırlık
//  taşıyor. Orantılı rakamlarla alt alta gelen satırlar kayar ve sütun
//  "zıplar" (bkz. theme/typography.ts SAYI YUVASI notu). Burada stil
//  seçmek çağırana bırakılmıyor ki bir kart unutmasın.
//
//  NEDEN `isaret` AYRI PROP VE RENKTEN TÜRETİLMİYOR: ürün kuralı —
//  yön anlamı renge TEK BAŞINA bağlanamaz. İşaret `signalOf()`ten gelir
//  (theme/signal.ts), bu komponent yön hesaplamaz: hangi sayının yön
//  taşıdığına kart karar verir, eşiği motor verir.
//
//  BURADA HESAP YOK: bu dosya hiçbir sayı türetmez, biçimlemez,
//  yuvarlamaz. Gelen metni basar.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { numeric, space, type, useTheme } from '@/theme';

export type SatirProps = {
  /** Sol sütun — kalemin adı. */
  etiket: string;
  /** Sağ sütun — motorun verdiği, `lib/format.ts` ile biçimlenmiş metin. */
  deger: string;
  /**
   * Değerin önündeki renk körü güvenli işaret (▲ / ▼ / →). Yalnız yön
   * taşıyan kalemlerde verilir; verilmezse hiç basılmaz (uydurma yön yok).
   */
  isaret?: string | null;
  /**
   * İşaretin ve değerin rengi. `undefined` → gövde rengi. Renk BURADA
   * seçilmez, token adı çağırandan gelir (hex yazılmaz).
   */
  renk?: string;
  /** Etiketin altındaki ikinci satır — ağırlık, künye, "düşük güven" notu. */
  not?: string;
  /** Ekran okuyucu cümlesi; verilmezse "etiket deger" okunur. */
  erisimEtiketi?: string;
};

export function Satir({ etiket, deger, isaret, renk, not, erisimEtiketi }: SatirProps) {
  const { colors } = useTheme();

  return (
    <View
      style={styles.kok}
      accessible
      accessibilityLabel={erisimEtiketi ?? etiket + ' ' + deger}>
      <View style={styles.solSutun}>
        <Text style={[type.small, { color: colors.textDim }]} numberOfLines={2}>
          {etiket}
        </Text>
        {not ? (
          <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={2}>
            {not}
          </Text>
        ) : null}
      </View>
      <View style={styles.sagSutun}>
        {isaret ? (
          // Ekran okuyucu "▲" karakterini anlamlı okumaz; cümle kökte.
          <Text
            style={[type.smallBold, { color: renk ?? colors.text }]}
            accessibilityElementsHidden>
            {isaret}
          </Text>
        ) : null}
        <Text style={[type.smallBold, numeric, { color: renk ?? colors.text }]}>{deger}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kok: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xs,
  },
  // Etiket uzun olabilir (ör. "Nakit Kalitesi (OCF > Net Kâr)"); esneyen
  // sütun o, değer sütunu değil — sayı asla kırpılmaz.
  solSutun: { flex: 1, gap: space.xxs },
  sagSutun: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 0 },
});
