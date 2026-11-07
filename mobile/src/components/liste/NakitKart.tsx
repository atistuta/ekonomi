// =====================================================================
//  NakitKart — sepetteki nakit bakiyesi                (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'in nakit alanının (`adjustCash` / `setCash`,
//  app.js:3380-3404) native karşılığı.
//
//  NEDEN AYRI KART: nakit, sepetteki öteki kalemlerle AYNI kapta duruyor
//  (`cls === 'cash'`) ama başka kurallarla: adedi BAKİYE, birim maliyeti
//  her zaman 1, sembolü PARA BİRİMİ. `sepeteEkle` `cls==='cash'` girdisini
//  REDDEDİYOR ve webde de ayrı kod yolundan geçiyor — tek forma sıkıştırmak
//  kullanıcıyı kesin bir reddin üstüne sürmek olurdu.
//
//  BURADA HESAP YOK: bakiyeyi kullanıcı yazıyor, kart yalnız
//  `nakitAyarla`ya veriyor. Kur çevrimi, toplam, portföy ağırlığı — hiçbiri
//  burada değil ve hiçbir yerde de uydurulmuyor.
//
//  "GİRİLMEMİŞ" İLE "SIFIR" AYNI ŞEY DEĞİL: `nakitBakiye(pb)` kayıt yoksa
//  `null` döndürüyor, kayıt varsa `qty`yi olduğu gibi. Kart bu ikisini
//  AYRI cümleyle basıyor — `null`a 0 yazmak ölçülmemiş bir sayıyı ölçülmüş
//  göstermek olurdu.
//
//  DEĞİŞİM MİKTARI HAMLE GÜNLÜĞÜNE DÜŞÜYOR: `nakitAyarla` farkı hesaplayıp
//  `hamleEkle`ye yazıyor (web de öyle yapıyor). Yani eski bakiye ekranda
//  kalıyor, sessizce üzerine yazılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { nakitAyarla, nakitBakiye, sayiOku, sepetDepo, useTurHazir } from '@/api';
import { Card, Dugme } from '@/components';
import { EMPTY, formatPrice } from '@/lib/format';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

/**
 * Kartta satırı olan para birimleri.
 *
 * KAPALI KÜME, ölçüm değil: web de nakdi serbest metin yerine seçili
 * birimlerde tutuyor. Burada TRY ve USD var çünkü sepetteki maliyetler bu
 * ikisinde tutuluyor; başka birim gerekirse satır eklenir — kart
 * MATEMATİK yapmadığı için çevrim sorunu doğmaz.
 */
const PARA_BIRIMLERI = ['TRY', 'USD'] as const;

export type NakitKartProps = {
  /** Varsayılan olarak açık/kapalı değil — kart her zaman görünür. */
  style?: never;
};

/** Tek para biriminin satırı: bakiye + yeni değer alanı. */
function NakitSatiri({ pb }: { pb: string }) {
  const { colors } = useTheme();

  // Depo dinleniyor: `nakitAyarla` yazdığında satır KENDİ yenilenir.
  const hazir = useTurHazir(sepetDepo);
  const bakiye = hazir ? nakitBakiye(pb) : undefined;

  const [girdi, setGirdi] = useState('');
  // `null` = henüz yazma denenmedi; boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);

  const kaydet = () => {
    const hedef = sayiOku(girdi);
    if (hedef == null) {
      setTamam(null);
      setBildirim('Bakiye bir sayı olmalı.');
      return;
    }
    void nakitAyarla(pb, hedef).then((sonuc) => {
      if (sonuc.ok) {
        setGirdi('');
        setBildirim(null);
        setTamam('Bakiye yazıldı.');
      } else {
        setTamam(null);
        // Yazıcının kendi cümlesi — kart hata metni UYDURMUYOR.
        setBildirim(sonuc.mesaj);
      }
    });
  };

  return (
    <View style={styles.satir}>
      <View style={styles.bas}>
        <Text style={[type.body, { color: colors.text }]}>{'💵 ' + pb}</Text>
        <Text style={[type.body, { color: colors.textDim }]}>
          {/* ÜÇ AYRI DURUM, ÜÇ AYRI METİN:
              `undefined` = depo henüz okunmadı ("sormadım")
              `null`      = kayıt yok ("girilmemiş")
              sayı        = ölçülen bakiye (0 dahil) */}
          {bakiye === undefined
            ? EMPTY
            : bakiye === null
              ? 'girilmemiş'
              : formatPrice(bakiye, pb)}
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          value={girdi}
          onChangeText={(t) => {
            setGirdi(t);
            setBildirim(null);
            setTamam(null);
          }}
          placeholder={'Yeni ' + pb + ' bakiyesi'}
          placeholderTextColor={colors.textFaint}
          keyboardType="numeric"
          maxLength={18}
          returnKeyType="done"
          onSubmitEditing={kaydet}
          accessibilityLabel={pb + ' nakit bakiyesi'}
          style={[
            styles.alan,
            type.body,
            { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        />
        <Dugme label="Yaz" size="sm" disabled={!girdi.trim()} onPress={kaydet} />
      </View>

      {bildirim ? (
        <Text style={[type.micro, { color: colors.negative }]}>{bildirim}</Text>
      ) : null}
      {tamam ? <Text style={[type.micro, { color: colors.positive }]}>{tamam}</Text> : null}
    </View>
  );
}

export function NakitKart(_props: NakitKartProps = {}) {
  const { colors } = useTheme();

  return (
    <Card title="Nakit" subtitle="Sepetteki nakit bakiyesi — kendi kaydın.">
      <View style={styles.govde}>
        {PARA_BIRIMLERI.map((pb) => (
          <NakitSatiri key={pb} pb={pb} />
        ))}

        <Text style={[type.micro, { color: colors.textFaint }]}>
          Girilen bakiye bu cihazda saklanıyor, buluta GÖNDERİLMİYOR. Nakit ile öteki kalemler
          TOPLANMIYOR: kur çevrimi ölçülmediği için tek bir büyüklük yazmak, ölçülmemiş bir sayıyı
          ölçülmüş göstermek olurdu. Her değişiklik hamle günlüğüne düşüyor.
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.sm },
  satir: { gap: space.xs },
  bas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  form: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alan: {
    flex: 1,
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
});
