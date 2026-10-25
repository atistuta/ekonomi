// =====================================================================
//  DetayBasligi — hisse detayının başlık şeridi        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: sembol + pazar + HAM fiyat + bileşke skor (ScoreGauge) tek kartta.
//
//  NEDEN EN ÜSTTE VE TEK KART: detay ekranı beş bölüm uzunluğunda;
//  kullanıcı aşağı kaydırdıkça "hangi hisseye bakıyordum" sorusu doğar.
//  Şerit ekranın ilk kartı: kimlik (sembol/pazar), çıpa (fiyat) ve
//  motorun TEK CÜMLELİK yargısı (bileşke skor + bant) burada.
//
//  NEDEN BİLEŞKE SKOR BURADA, TEKNİK/TEMEL AŞAĞIDA: bileşke, iki skorun
//  motordaki 3x3 matrisinden çıkan SONUÇ (types.ts ScoreComposite).
//  Sonucu başa, gerekçeyi (teknik/temel kartları) altına koymak ekranın
//  okuma sırası; başlıkta üç skoru birden göstermek hiyerarşiyi siler.
//
//  NEDEN `blendedShown`, `blended` DEĞİL: kullanıcının gördüğü tam sayı
//  motorun yuvarlamasıdır (types.ts notu). `blended`ı alıp burada
//  `Math.round` yazmak, aynı hissenin webde 61 native'de 62 görünmesi
//  demekti — `tests/parity.mjs`in engellediği ayrışmanın tam kendisi.
//
//  NEDEN BANT METNİ UYDURULMUYOR: 61 skorun adı ("Nötr" mü "Alım" mı)
//  MOTORUN kararı. `composite.band` boşsa `ScoreGauge` etiketi hiç
//  basmaz, yalnız sayı durur (bkz. ScoreGauge başlığı).
//
//  NEDEN FİYAT İKİ KAYNAKTAN OKUNUYOR: `plan.seviye.price` TA turunda
//  oluşuyor ve plan `null` olabilir (vade 'gunici'); o hâlde fiyat yine
//  `fa.price` içinde geliyor. İkisi de yoksa `formatPrice` tire döner —
//  sıfır BASILMAZ (lib/format.ts "VERİ YOK ASLA 0 DEĞİL").
//
//  BURADA HESAP YOK: skor, bant, fiyat; üçü de uçtan geldiği gibi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { AnalyzeRow } from '@/api';
import { Card, OlcumEksikRozet, Pill, ScoreGauge } from '@/components';
import { formatPrice } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export type DetayBasligiProps = {
  satir: AnalyzeRow;
};

export function DetayBasligi({ satir }: DetayBasligiProps) {
  const { colors } = useTheme();
  // Pazar → para birimi. ÇEVİRİ DEĞİL EŞLEME: motor BIST sembollerini
  // '.IS' ekiyle ayırıyor ve fiyatı TRY döndürüyor; ABD tarafında simge
  // uydurmamak için `null` geçiyoruz (lib/format.ts: bilinmeyen para
  // biriminde yalnız sayı basılır).
  const kur = satir.market === 'BIST' ? 'TRY' : null;
  const fiyat = satir.plan?.seviye?.price ?? satir.fa.price;

  return (
    <Card
      title={satir.sym}
      subtitle={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD piyasası'}
      right={
        <Pill label={formatPrice(fiyat, kur)} tone="info" glyph={null} size="sm" />
      }>
      {/* Rozet SKORUN ÜSTÜNDE: `tam:false` ile gelen bir skoru önce
          göstermek, eksik ölçümü tam ölçüm gibi sunmaktı. */}
      <OlcumEksikRozet kaynak={satir} />

      <ScoreGauge
        score={satir.composite.blendedShown}
        caption="Bileşke skor"
        band={satir.composite.band ?? undefined}
      />

      {/* Bileşke `null` olduğunda sebep uçtan geliyor (`composite.why`);
          burada "veri gelmedi" diye GENEL bir cümle yazmak, motorun
          söylediği somut sebebi çöpe atmak olurdu. */}
      {satir.composite.band === null && satir.composite.why ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Bileşke bant yok: ' + satir.composite.why}
        </Text>
      ) : null}

      <View style={styles.bantlar}>
        {satir.composite.taBand ? (
          <Pill label={'Teknik: ' + satir.composite.taBand} tone="neutral" glyph={null} size="sm" />
        ) : null}
        {satir.composite.faBand ? (
          <Pill label={'Temel: ' + satir.composite.faBand} tone="neutral" glyph={null} size="sm" />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bantlar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
