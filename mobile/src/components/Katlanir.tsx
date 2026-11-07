// =====================================================================
//  Katlanir — katlanabilir ölçüm bölümü               (TASARIM TURU 1)
// ---------------------------------------------------------------------
//  NE: başlık + özet satırına dokununca açılan/kapanan kap. VARSAYILAN
//  KAPALI: kullanıcı önce "burada ne kadar ölçüm var" cümlesini görür,
//  istediğinde açar.
//
//  NEDEN (TASARIM TURU 1 / YOĞUNLUK): son yedi şerit her alanı doğru
//  bastı ama HEPSİ AÇIK bastı. Teknik kartta tek seferde 11 bölüm / 42
//  ham alan, takvim kartında sayaç künyesi, sektör kartında her hissenin
//  iş tanımı aynı anda ekranda. Bilgi kaybetmeden yoğunluğu düşürmenin
//  tek yolu SİLMEK değil, KATLAMAK: ölçüm yerinde kalır, varsayılan
//  görünümden çıkar. Özet satırı ("11 bölüm · 42 alan") kapalı hâlde
//  bile içeride ne olduğunu söyler — "boş mu, yoksa kapalı mı?"
//  belirsizliği kalmasın.
//
//  NEDEN ORTAK KOMPONENT, ALTI DOSYAYA KOPYA DEĞİL: açma/kapama durumu,
//  dokunma hedefi (44pt), ekran okuyucu `expanded` durumu ve ok yönü
//  dört ayrı karar. Altı kart bunları kendi yazsa dördü de ayrışırdı ve
//  erişilebilirlik durumu bir kartta unutulurdu.
//
//  NEDEN ANİMASYON YOK: yeni bağımlılık yasak; `LayoutAnimation`
//  Android'de ayrı bayrak, `Animated` ile yükseklik ölçmek içeriği iki
//  kez ölçmeyi gerektiriyor. Tur 1 bilgi hiyerarşisi turu, geçiş turu
//  değil — animasyon ayrı bir tura bırakıldı.
//
//  BURADA HESAP YOK: özet metnini çağıran verir; bu dosya sayı türetmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type KatlanirProps = {
  /** Başlık — bölümün adı. Kapalı hâlde de görünür. */
  baslik: string;
  /**
   * Başlığın altındaki özet — kapalı hâlde içeride ne olduğunu söyler.
   * Ör. "11 bölüm · 42 alan". Sayıyı çağıran hesaplar; burada türetilmez.
   */
  ozet?: string | null;
  /**
   * Bölümün TÜM satırlarının paylaştığı birim; başlığın yanında bir kez
   * görünür (satırlarda tekrar edilmemesi için — bkz. OlcumSatiri).
   */
  birim?: string | null;
  /**
   * Başlangıçta açık mı. VARSAYILAN KAPALI (`false`) — yoğunluk kuralı.
   * Yalnız içeriği ekranın BİRİNCİL bilgisi olan bölümlerde `true`.
   * Yalnız ilk durumu belirler; sonrasını kullanıcı yönetir.
   */
  acikBaslangic?: boolean;
  children: ReactNode;
};

export function Katlanir({ baslik, ozet, birim, acikBaslangic = false, children }: KatlanirProps) {
  const { colors } = useTheme();
  const [acik, setAcik] = useState(acikBaslangic);

  return (
    <View style={[styles.kok, { borderColor: colors.border }]}>
      <Pressable
        onPress={() => setAcik((v) => !v)}
        style={({ pressed }) => [
          styles.basa,
          pressed ? { backgroundColor: colors.bgPressed } : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: acik }}
        accessibilityLabel={baslik + (ozet ? ' — ' + ozet : '')}>
        <View style={styles.basaMetin}>
          <Text style={[type.smallBold, { color: colors.text }]}>{baslik}</Text>
          {ozet || birim ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {[ozet, birim].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {/* Ok yönü durumu renk/konumdan bağımsız anlatır; ekran okuyucu
            için `expanded` durumu zaten verildi, karakter gizlenir. */}
        <Text style={[type.small, { color: colors.textDim }]} accessibilityElementsHidden>
          {acik ? '▾' : '▸'}
        </Text>
      </Pressable>
      {acik ? <View style={styles.govde}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kok: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md },
  basa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: hitSlopMin,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  basaMetin: { flex: 1, gap: space.xxs },
  govde: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.xs },
});
