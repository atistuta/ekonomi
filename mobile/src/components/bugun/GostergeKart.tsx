// =====================================================================
//  📌 ŞERİDE GÖSTERGE İĞNELE — ekle · kaldır          (ŞERİT B / native)
// ---------------------------------------------------------------------
//  NE: webin fiyat şeridi kipinin (`tickerModal` → `tkAdd` / `tkRenderPinned`,
//  app.js:2665-2712) native karşılığı: kullanıcının üst şeride kendi
//  sembolünü iğnelediği ve kaldırdığı ekran.
//
//  NEDEN GEREKLİ (ÖLÇÜLDÜ): `gostergeEkle` (`api/depo.ts`) native'de
//  ZATEN vardı ve HİÇBİR ÇAĞIRANI YOKTU; `SeritKart` kaydı yalnız
//  OKUYORDU (`useGostergeler`). Yani kullanıcı webde iğnelediği kaydı
//  telefonda görüyor, ama ne ekleyebiliyor ne kaldırabiliyordu — üstelik
//  gösterge kaydı buluta GÖNDERİLMİYOR, yani webde iğnelenen bu cihaza
//  hiç gelmiyor. Eksik olan ekrandı, veri değil. Çıkarma yazıcısı
//  (`gostergeCikar`) bu turda aynı depo dosyasına eklendi.
//
//  BU KARTTA HESAP YOK, AĞ YOK: eşik, ağırlık, formül, fiyat ölçümü yok.
//  `fetch` çağrısı YOK (components içinde yasak) — kart yalnız cihaz
//  deposuna YAZIYOR. İğnelenen kalemin fiyatı burada ÖLÇÜLMÜYOR; onu
//  `SeritKart` kendi turunda `seritFiyatlari()` ile ölçüyor.
//
//  TÜRKÇE TEK YERDE: sınıf adları ve iğnelenebilir sınıf sırası
//  `lib/sozluk.ts`te (`VARLIK_SINIFI_SOZLUK`, `GOSTERGE_SINIF_SIRASI`);
//  bu kart kendi etiket sözlüğünü KURMUYOR.
//
//  KENDİ HATA CÜMLESİNİ UYDURMUYOR: ret sebebini yazıcı üretiyor
//  (`YazSonuc.mesaj`) ve kart onu OLDUĞU GİBİ basıyor — sınır dolu,
//  zaten var, yazılamadı hâllerinin hepsi depo katmanının cümlesi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_GOSTERGE,
  gostergeCikar,
  gostergeEkle,
  gostergelerDepo,
  useGostergeler,
  useTurHazir,
  type VarlikSinifi,
} from '@/api';
import { Card, Dugme, Katlanir } from '@/components';
import { GOSTERGE_SINIF_SIRASI, VARLIK_SINIFI_SOZLUK } from '@/lib/sozluk';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type GostergeKartProps = Record<string, never>;

export function GostergeKart() {
  const { colors } = useTheme();
  const kayitlar = useGostergeler();
  const hazir = useTurHazir(gostergelerDepo);

  const [cls, setCls] = useState<VarlikSinifi>('bist');
  const [sembol, setSembol] = useState('');
  // `null` = henüz yazma denenmedi; boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);

  const temizle = () => {
    setBildirim(null);
    setTamam(null);
  };

  const igne = () => {
    const s = sembol.trim().toUpperCase();
    if (!s) return;
    void gostergeEkle({
      // `id` BOŞ geçiyor: kimliği depo süzgeci `gostergeSuz` üretiyor ve
      // web `tkAdd` ile AYNI biçimi kuruyor (`cls + '-' + symbol`). İki
      // yerde iki kimlik kuralı olsaydı aynı kayıt iki kez eklenebilirdi.
      id: '',
      cls,
      symbol: s,
      cgId: null,
      // Web de BIST/ABD kaydında etiketi sembolün kendisi yapıyor.
      label: s,
    }).then((sonuc) => {
      if (sonuc.ok) {
        setSembol('');
        setBildirim(null);
        setTamam('"' + s + '" şeride iğnelendi. Fiyatı bu anda ölçülmedi.');
      } else {
        setTamam(null);
        setBildirim(sonuc.mesaj);
      }
    });
  };

  const kaldir = (id: string, etiket: string) => {
    void gostergeCikar(id).then((sonuc) => {
      if (sonuc.ok) {
        setBildirim(null);
        setTamam('"' + etiket + '" şeritten kaldırıldı.');
      } else {
        setTamam(null);
        setBildirim(sonuc.mesaj);
      }
    });
  };

  return (
    <Card
      title="Şeride gösterge iğnele"
      subtitle={
        // Depo okuması asenkron: `hazir` olmadan basılan sayı ÖLÇÜM
        // değil, henüz okunmamış bir deponun boş hâli olurdu.
        !hazir
          ? 'Cihazdaki gösterge kaydı henüz okunmadı.'
          : kayitlar.length === 0
            ? 'İğnelenmiş özel gösterge yok.'
            : kayitlar.length + '/' + AZAMI_GOSTERGE + ' özel gösterge iğnelenmiş.'
      }>
      <Katlanir baslik="Yeni gösterge" ozet="sınıf · sembol">
        <View style={styles.govde}>
          {/* SINIF SEÇİMİ: kapalı küme (`GOSTERGE_SINIF_SIRASI`), `Dugme`
              satırı — `SepetEkleKart` ile AYNI kalıp. */}
          <View style={styles.satir}>
            {GOSTERGE_SINIF_SIRASI.map((v) => (
              <Dugme
                key={v}
                label={VARLIK_SINIFI_SOZLUK[v]}
                size="sm"
                variant={v === cls ? 'solid' : 'outline'}
                tone={v === cls ? 'gold' : 'neutral'}
                onPress={() => {
                  setCls(v);
                  temizle();
                }}
              />
            ))}
          </View>

          <TextInput
            value={sembol}
            onChangeText={(t) => {
              setSembol(t);
              temizle();
            }}
            placeholder={cls === 'us' ? 'ABD sembolü (ör. AAPL)' : 'BIST sembolü (ör. THYAO)'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={igne}
            accessibilityLabel="Şeride iğnelenecek sembol"
            style={[
              styles.alan,
              type.body,
              { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          />

          <Dugme label="İğnele" size="sm" disabled={!sembol.trim()} onPress={igne} />

          {bildirim ? (
            <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text>
          ) : null}
          {tamam ? <Text style={[type.small, { color: colors.positive }]}>{tamam}</Text> : null}

          <Text style={[type.micro, { color: colors.textFaint }]}>
            Gösterge bu cihazda saklanıyor, buluta GÖNDERİLMİYOR — webde iğnelediğin kayıt buraya
            gelmez. Şerit fiyat basar, toplamaz; iğnelenen sembol teknik ya da temel skora GİRMEZ.
            Bilgi amaçlıdır, yatırım tavsiyesi değildir.
          </Text>
        </View>
      </Katlanir>

      {/* İĞNELENMİŞ KAYITLAR: web `tkRenderPinned` karşılığı. Depo
          okunmadan liste basılmıyor (boş liste ile "kayıt yok" ayrı hâl). */}
      {hazir && kayitlar.length > 0 ? (
        <View style={styles.govde}>
          {kayitlar.map((g) => (
            <View key={g.id} style={styles.kayit}>
              <Text style={[type.small, { color: colors.text }]} numberOfLines={1}>
                {g.label + ' · ' + VARLIK_SINIFI_SOZLUK[g.cls]}
              </Text>
              <Dugme
                label="Kaldır"
                size="sm"
                variant="outline"
                tone="neutral"
                onPress={() => kaldir(g.id, g.label)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.sm },
  satir: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  kayit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  alan: {
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
});
