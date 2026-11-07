// =====================================================================
//  ➕ DETAY EYLEMLERİ — "Listeye ekle" + "Karşılaştırmaya ekle"
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/hisse/[sembol]` ekranında iki yazma eylemi. Webde hisse
//  sayfasının üst şeridinde ikisi de VAR (app.js: `addToList` ve
//  `sb:compare` seti, app.js:12238); native'de ekleme YALNIZ Arama
//  sekmesinde vardı (`arama.tsx:296/345`) ve KIYAS SETİNE EKLEME HİÇ
//  YOKTU: `kiyasaEkle` depo katmanında duruyordu ama hiçbir ekran
//  çağırmıyordu — yani kullanıcı kıyas setini native'de hiç KURAMIYORDU
//  (Analiz sekmesi yalnız 🏭 Sektör köprüsünden gelen `?kiyas=`
//  parametresiyle doluyordu).
//
//  NEDEN BU KART AYRI BİR BİLEŞEN: iki eylemin de kendi "sonuç cümlesi"
//  var (eklendi / zaten var / slot dolu / yazılamadı) ve bu cümleler
//  DEPODAN geliyor. Ekranın gövdesine gömülseydi, aynı mesaj durumunu
//  analiz turunun durumuyla aynı yerde tutmak gerekirdi.
//
//  BURADA HESAP YOK, KARAR YOK: hangi sembolün eklendiğine ekran karar
//  veriyor (`sembol`), pazara da çağıran karar veriyor (`market`).
//  Sınırlar (`AZAMI_KIYAS` = 8, liste sınırı) DEPO katmanında ve
//  mesajları da depo yazıyor — burada eşik yeniden yazılmıyor.
//
//  DÜRÜST GERİ BİLDİRİM: yazma başarısız olursa SESSİZ KALMIYOR. Depo
//  `ok:false` + `mesaj` döndürüyor, o mesaj olduğu gibi basılıyor;
//  "eklendi" cümlesi yalnız gerçekten yazıldığında çıkıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AZAMI_KIYAS, ekle, kiyasaEkle, useKiyas, useListe, type Market } from '@/api';
import { Dugme } from '@/components';
import { space, type, useTheme } from '@/theme';

export type DetayEylemlerProps = {
  /** Ekranın çözdüğü sembol — BIST'te `.IS` sonekiyle. */
  sembol: string;
  /** SEMBOL pazarı; kıyas kaydı pazarı taşıyor (aynı kod iki pazarda olabilir). */
  market: Market;
};

export function DetayEylemler({ sembol, market }: DetayEylemlerProps) {
  const { colors } = useTheme();
  const liste = useListe();
  const kiyas = useKiyas();
  const [bildirim, setBildirim] = useState<string | null>(null);

  // Takip listesinde mi: liste KULLANICININ yazımını tutuyor, ekran da
  // sembolü o yazıma eşliyor (ekranın ".IS GERİ KAZANIMI" notu) — bu
  // yüzden düz karşılaştırma yeterli, burada ikinci bir eşleme yok.
  const listede = liste.includes(sembol);
  // Kıyas kaydı sembol VE pazar tutuyor: aynı kod iki pazarda olabilir.
  const kiyasta = kiyas.some((k) => k.symbol === sembol && k.market === market);
  const kiyasDolu = kiyas.length >= AZAMI_KIYAS;

  const listeyeEkleBas = useCallback(() => {
    const s = ekle(sembol);
    setBildirim(s.ok ? sembol + ' listeye eklendi.' : s.mesaj);
  }, [sembol]);

  const kiyasaEkleBas = useCallback(() => {
    // Depo yazıcısı `async`: sonuç gelmeden cümle basmıyoruz, yoksa
    // yazılamayan bir eklemeyi "eklendi" diye duyurmuş olurduk.
    kiyasaEkle(sembol, market).then((s) => {
      setBildirim(s.ok ? sembol + ' karşılaştırma setine eklendi.' : s.mesaj);
    });
  }, [sembol, market]);

  return (
    <View style={styles.sar}>
      <View style={styles.sira}>
        <Dugme
          label={listede ? 'Listede' : 'Listeye ekle'}
          size="sm"
          variant="outline"
          tone="neutral"
          disabled={listede}
          onPress={listeyeEkleBas}
        />
        <Dugme
          label={kiyasta ? 'Karşılaştırmada' : 'Karşılaştırmaya ekle'}
          size="sm"
          variant="outline"
          tone="neutral"
          disabled={kiyasta || kiyasDolu}
          onPress={kiyasaEkleBas}
        />
      </View>

      {/* SLOT SAYISI YAZILI: düğme kapalıysa NEDEN kapalı olduğu
          görünsün. Sınır depodan (`AZAMI_KIYAS`), burada eşik yok. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Karşılaştırma seti: ' + kiyas.length + ' / ' + AZAMI_KIYAS + ' slot' +
          (kiyasDolu && !kiyasta ? ' — dolu, önce Analiz sekmesinden birini çıkar.' : '')}
      </Text>

      {bildirim ? (
        <Text style={[type.micro, { color: colors.textDim }]}>{bildirim}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  sar: { gap: space.xs },
  sira: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
});
