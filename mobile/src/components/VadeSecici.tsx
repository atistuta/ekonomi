// =====================================================================
//  VADE SEÇİCİ — motorun hangi penceresi sorulacak    (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/analyze`, `/api/compare`, `/api/recommend` ve
//  `/api/backtest` uçlarının HEPSİ `vade` alıyor (kapalı küme:
//  gunici · kisa · orta · uzun). Native'de bu alan altı çağrı yerinde
//  `'orta'` SABİTLENMİŞTİ — motorun dört penceresinden yalnız biri
//  ekrana ulaşıyordu. Bu komponent seçimi kullanıcıya veriyor.
//
//  BURADA HESAP YOK: komponent vadeyi TAŞIR, vadenin ne demek olduğunu
//  hesaplamaz. Eşik/ağırlık motorda; hangi vadede hangi göstergenin
//  ağırlığı değiştiği BU DOSYADA YOK (HAM SAYI KURALI §5.1).
//
//  TÜRKÇE TEK YERDE: etiketler ve altındaki not `lib/sozluk.ts` →
//  `VADE_SOZLUK` / `VADE_NOTU`. Burada serbest Türkçe cümle yazılmıyor.
//
//  SIRA KAPALI KÜMEDEN: `VADE_SIRASI` motorun `api/_ayar.js` VADELER
//  dizisiyle AYNI sırada. `Record<Vade, string>` olduğu için motor
//  yeni bir vade eklerse `tsc` kırılır — sessizce eksik kalmaz.
//
//  SEÇİM GÖRÜNÜR VE DUYULUR: seçili düğme `solid` + `gold`, ötekiler
//  `outline` + `neutral`. `Dugme` dokunma hedefi/erişilebilirlik
//  kuralını zaten taşıyor; burada ikinci bir Pressable tanımı YOK.
//
//  GÜN İÇİ DÜRÜSTLÜĞÜ: `'gunici'` vadede motor teknik ayağı
//  koşturmuyor ve teknik skor `null` dönüyor. Bu, seçimin ALTINDA
//  yazılı — kullanıcı boş kartı arıza sanmasın.
//
//  ÇAĞIRANIN SORUMLULUĞU — ÖNBELLEK ANAHTARI: vade değiştiğinde
//  `useIstek` anahtarı da değişmeli, yoksa önceki vadenin önbellekli
//  satırı basılır. Çağıran ekranlar anahtara vadeyi EKLİYOR.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { Vade } from '@/api';
import { VADE_NOTU, VADE_SIRASI, VADE_SOZLUK } from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

import { Dugme } from './Dugme';

export type VadeSeciciProps = {
  /** Şu an seçili vade — çağıran ekranın durumu. */
  deger: Vade;
  /** Seçim değişti. Çağıran önbellek anahtarını da güncellemeli. */
  onDegis: (vade: Vade) => void;
};

export function VadeSecici({ deger, onDegis }: VadeSeciciProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.govde}>
      <View style={styles.satir}>
        {VADE_SIRASI.map((v) => (
          <Dugme
            key={v}
            label={VADE_SOZLUK[v]}
            size="sm"
            variant={v === deger ? 'solid' : 'outline'}
            tone={v === deger ? 'gold' : 'neutral'}
            onPress={() => onDegis(v)}
          />
        ))}
      </View>
      {/* SEÇİMİN NE DEĞİŞTİRDİĞİ EKRANDA YAZILI — sözlükten. */}
      <Text style={[type.micro, { color: colors.textDim }]}>{VADE_NOTU[deger]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
