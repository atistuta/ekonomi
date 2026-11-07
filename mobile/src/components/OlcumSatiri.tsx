// =====================================================================
//  OlcumSatiri + OlcumBaslik — ölçüm satırı           (TASARIM TURU 1)
// ---------------------------------------------------------------------
//  NE: ürünün TEK anahtar/değer satırı ve o satırların üstüne gelen
//  bölüm başlığı. Solda kalemin adı, sağda motorun verdiği değer;
//  isteğe bağlı renk körü işareti ve etiket altı künye notu.
//
//  NEDEN BU DOSYA (TASARIM TURU 1 / BİLGİ HİYERARŞİSİ): son yedi şerit
//  her ucun her alanını doğru bastı ama DÜZ bir ölçüm dökümü olarak:
//  onlarca satır, her satırın altında birim notu, hepsi aynı puntoda.
//  Aynı puntoda yazılan "anahtar", "değer" ve "birim" göz için tek bir
//  gri bloktu — kullanıcı sayıyı ARAMAK zorunda kalıyordu. Burada üç
//  kademe jetonla sabitlendi:
//    1) DEĞER  — birincil: `type.bodyBold` + `numeric` + `colors.text`
//    2) ETİKET — ikincil : `type.small`    + `colors.textDim`
//    3) NOT    — üçüncül : `type.micro`    + `colors.textFaint`
//  Üç kademe TEK yerde duruyor ki altı kart aynı ritmi paylaşsın.
//
//  NEDEN `detay/Satir.tsx` BURAYA TAŞINDI: satır komponenti ZATEN vardı
//  ama (a) `components/detay/` altındaydı, kök barrel'dan dışa açık
//  değildi, yani `bugun/` ve `kesfet/` kartları ona ULAŞAMIYOR, kendi
//  satır düzenlerini elle yazıyorlardı; (b) değeri `type.smallBold` ile
//  basıyordu — etiketle AYNI punto, yani hiyerarşi yoktu. Tanım buraya
//  alındı, `detay/Satir.tsx` bu dosyaya yönlendiren ince bir sarmalayıcı
//  oldu: yedi detay kartının `import { Satir }` satırları değişmedi.
//
//  NEDEN BİRİM SATIRDA DEĞİL BAŞLIKTA: bir bölümün 12 satırı aynı birimi
//  paylaşıyorsa birim 12 kez yazılmaz. `OlcumBaslik` birimi bölüm başına
//  BİR kez basar. Birim SİLİNMEDİ — yeri değişti; ölçüm bilgisi kaybı
//  yok, tekrar yok.
//
//  NEDEN DEĞER SÜTUNU SABİT GENİŞLİKTE: `theme/layout.ts`
//  `olcumDegerSutunu` gerekçesi orada yazılı — sütunun sol kenarı
//  satırdan satıra kaymasın, sayılar göz hizasında karşılaştırılabilsin.
//
//  BURADA HESAP YOK: bu dosya hiçbir sayı türetmez, biçimlemez,
//  yuvarlamaz, ölçek değiştirmez. Gelen metni basar. Üç render dalı
//  (uç göndermedi / ölçülemedi / ölçüldü-yok) çağıranın kararı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { numeric, olcumDegerSutunu, space, type, useTheme } from '@/theme';

export type OlcumSatiriProps = {
  /** Sol sütun — kalemin adı. İkincil kademe. */
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
  /**
   * Etiketin altındaki üçüncül satır — ham alan adı, ağırlık, künye,
   * "düşük güven" notu. Bölümün TAMAMI için geçerli olan birim buraya
   * DEĞİL `OlcumBaslik`a yazılır.
   */
  not?: string;
  /** Ekran okuyucu cümlesi; verilmezse "etiket deger" okunur. */
  erisimEtiketi?: string;
};

export function OlcumSatiri({ etiket, deger, isaret, renk, not, erisimEtiketi }: OlcumSatiriProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.kok} accessible accessibilityLabel={erisimEtiketi ?? etiket + ' ' + deger}>
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
          <Text style={[type.small, { color: renk ?? colors.text }]} accessibilityElementsHidden>
            {isaret}
          </Text>
        ) : null}
        <Text style={[type.bodyBold, numeric, styles.deger, { color: renk ?? colors.text }]}>
          {deger}
        </Text>
      </View>
    </View>
  );
}

export type OlcumBaslikProps = {
  /** Bölümün adı — ör. "Fiyat ve ortalamalar". */
  baslik: string;
  /**
   * Bölümdeki TÜM satırların paylaştığı birim — ör. "0-100 puan".
   * Satırlarda tekrar edilmez; burada bir kez görünür.
   */
  birim?: string | null;
  /** Birimden sonra gelen künye uyarısı — ör. "PENCEREYE BAĞLI". */
  not?: string | null;
};

export function OlcumBaslik({ baslik, birim, not }: OlcumBaslikProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.baslikKok}>
      <Text style={[type.smallBold, { color: colors.text }]}>{baslik}</Text>
      {birim || not ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {[birim, not].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
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
  sagSutun: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs, flexShrink: 0 },
  deger: { minWidth: olcumDegerSutunu, textAlign: 'right' },
  baslikKok: { gap: space.xxs, paddingTop: space.sm },
});
