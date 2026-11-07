// =====================================================================
//  HamleKart — sepet hamle günlüğü (salt okunur)       (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'in hamle günlüğünün (`logMove`, app.js:2452) native karşılığı.
//
//  NEDEN GEREKLİ: `depo.ts` günlüğü (`hamlelerDepo`, `useHamleler`,
//  `AZAMI_HAMLE = 500`) native'de VARDI ama HİÇ GÖSTERİLMİYORDU — bu kart
//  onun İLK TÜKETİCİSİ. Günlüğü yazan üç yazıcı (`sepeteEkle`,
//  `sepettenCikar`, `nakitAyarla`) ekrana ulaşmasaydı kayıt tutmanın hiçbir
//  görünür karşılığı olmayacaktı.
//
//  SALT OKUNUR: bu kart günlüğe YAZMAZ ve SİLMEZ. Silme düğmesi bilinçli
//  olarak YOK — günlüğün tek işi "ne yaptım" sorusunu yanıtlamak; silinebilir
//  bir günlük o soruyu yanıtlamaz. Depo kendi sınırını (`AZAMI_HAMLE`)
//  uyguluyor, en eski kayıtlar düşüyor.
//
//  BURADA HESAP YOK: hiçbir sayı türetilmiyor. Satırlar günlüğe YAZILDIĞI
//  GİBİ basılıyor; ölçülmemiş alan `—` (EMPTY) oluyor, 0 YAZILMIYOR.
//
//  WEB İLE BİLİNÇLİ AYRILIK (`depo.ts` 13. bölümde yazılı): web hamleyi
//  yazarken canlı fiyat çekip `valTRY` / `pl` / `basketFlow` alanlarını
//  doldurabiliyor. `depo.ts` AĞA ÇIKMIYOR, bu yüzden native'in yazdığı
//  hamlelerde o alanlar `null` — tek istisna TRY nakit, çünkü birimi 1
//  olduğundan değişim miktarının kendisi TL karşılığıdır (çevrim YOK).
//  Kart bu eksikliği alt notta AÇIKÇA yazıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { useHamleler, type Hamle } from '@/api';
import { Card, Katlanir, Pill } from '@/components';
import { EMPTY, formatHaberTarih, formatPrice } from '@/lib/format';
import { HAMLE_TURU_SOZLUK, VARLIK_SINIFI_SOZLUK } from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

/** Günlükte en yeni kayıt üstte; kaç satır basılacağı. */
const AZAMI_SATIR = 50;

export type HamleKartProps = {
  /** Kaç satır gösterileceği — varsayılan 50. Ölçüm değil, sunum sınırı. */
  azamiSatir?: number;
};

function HamleSatiri({ hamle }: { hamle: Hamle }) {
  const { colors } = useTheme();

  const ad = hamle.name || hamle.symbol || hamle.id;
  // Sözlükte olmayan kod için CÜMLE UYDURULMUYOR: ham kod basılıyor.
  const tur = HAMLE_TURU_SOZLUK[hamle.type] ?? hamle.type;
  const sinif = VARLIK_SINIFI_SOZLUK[hamle.cls] ?? hamle.cls;
  const birim = hamle.cur || 'TRY';

  return (
    <View style={styles.satir}>
      <View style={styles.bas}>
        <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>
          {(hamle.emoji ? hamle.emoji + ' ' : '') + ad}
        </Text>
        <Pill label={tur} tone="neutral" glyph={null} size="sm" />
      </View>

      <Text style={[type.small, { color: colors.textDim }]}>
        {sinif +
          ' · adet ' +
          (hamle.qty == null ? EMPTY : String(hamle.qty)) +
          ' · fiyat ' +
          (hamle.price == null ? EMPTY : formatPrice(hamle.price, birim))}
      </Text>

      <Text style={[type.micro, { color: colors.textFaint }]}>
        {/* `ts` ISO dizge; biçimlendirici çözemezse hamı basıyor. */}
        {formatHaberTarih(hamle.ts) +
          (hamle.before == null ? '' : ' · önceki adet ' + String(hamle.before)) +
          (hamle.valTRY == null ? '' : ' · ' + formatPrice(hamle.valTRY, 'TRY'))}
      </Text>
    </View>
  );
}

export function HamleKart({ azamiSatir = AZAMI_SATIR }: HamleKartProps = {}) {
  const { colors } = useTheme();
  const hamleler = useHamleler();

  // En yeni üstte: depo kronolojik ekliyor, kopya üstünde ters çeviriyoruz
  // (`hamleler` doğrudan ters çevrilmez — depo durumu).
  const satirlar = hamleler.slice(-azamiSatir).reverse();

  return (
    <Card
      title="Hamle günlüğü"
      subtitle={
        // 0 ("okudum, kayıt yok") ile ölçülmemiş durum karıştırılmıyor:
        // `useHamleler` her zaman dizi döndürüyor.
        satirlar.length === 0 ? 'Kayıt yok.' : hamleler.length + ' kayıt var.'
      }>
      <Katlanir baslik="Kayıtlar" ozet={satirlar.length === 0 ? null : satirlar.length + ' satır'}>
        <View style={styles.govde}>
          {satirlar.length === 0 ? (
            <Text style={[type.small, { color: colors.textDim }]}>
              Sepete bir kalem eklediğinde ya da nakit bakiyesini yazdığında burada görünür.
            </Text>
          ) : (
            satirlar.map((h) => <HamleSatiri key={h.id} hamle={h} />)
          )}

          <Text style={[type.micro, { color: colors.textFaint }]}>
            Günlük bu cihazda saklanıyor, buluta GÖNDERİLMİYOR ve silinemiyor; en çok son 500 kayıt
            tutuluyor. Telefonda yazılan hamlelerde TL karşılığı ve gerçekleşen fark ÖLÇÜLMÜYOR
            (kayıt anında fiyat sorulmuyor), bu yüzden o alanlar {EMPTY} görünür — sıfır
            YAZILMIYOR. Kendi kaydın; teknik ya da temel skora GİRMEZ.
          </Text>
        </View>
      </Katlanir>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  satir: { gap: 2, paddingVertical: space.xs },
  bas: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
