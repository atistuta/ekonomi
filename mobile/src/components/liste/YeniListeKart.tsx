// =====================================================================
//  YeniListeKart — adlandırılmış liste oluşturma      (ŞERİT F7 / native)
// ---------------------------------------------------------------------
//  NE: web'de liste bloklarının ÜSTÜNDEKİ "yeni liste oluştur" girişinin
//  (app.js `renderLists` boş hâlinde "Yukarıdan yeni bir liste oluştur."
//  diye işaret ettiği giriş) native karşılığı.
//
//  NEDEN GEREKLİ: native'de adlandırılmış liste deposu (api/depo.ts)
//  ÖLÇÜLDÜ ve çalışıyor — ama hiçbir ekran ona yazmıyordu. Yani kullanıcı
//  tek bir "Takip" listesine mahkûmdu; web'de olan "ikinci liste aç"
//  yeteneği native'de YOKTU. Eksik olan ekran, veri değil.
//
//  BURADA HESAP YOK: sayı basmıyor. Yalnız depo yazıcısının DÖNDÜRDÜĞÜ
//  sonucu gösteriyor (`YazSonuc.mesaj`) — kendi hata metnini uydurmuyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { listeOlustur } from '@/api/liste';
import { Card, Dugme } from '@/components';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type YeniListeKartProps = {
  /** Şu anki liste sayısı — kartın alt satırında dürüstçe yazılıyor. */
  mevcutSayi?: number;
};

export function YeniListeKart({ mevcutSayi }: YeniListeKartProps) {
  const { colors } = useTheme();
  const [ad, setAd] = useState('');
  // `null` = henüz yazma denenmedi; boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);

  const olustur = () => {
    const istenen = ad.trim();
    if (!istenen) return;
    void listeOlustur(istenen).then((s) => {
      if (s.ok) {
        setAd('');
        setBildirim(null);
        setTamam('"' + istenen + '" oluşturuldu.');
      } else {
        setTamam(null);
        setBildirim(s.mesaj);
      }
    });
  };

  return (
    <Card
      title="Yeni liste"
      subtitle={
        // `undefined` ("sormadım") ile 0 ("saydım, yok") ayrı cümleler.
        mevcutSayi === undefined
          ? 'Kayıtlı liste sayısı okunmadı.'
          : mevcutSayi === 0
            ? 'Kayıtlı liste yok.'
            : mevcutSayi + ' kayıtlı liste var.'
      }>
      <View style={styles.form}>
        <TextInput
          value={ad}
          onChangeText={(t) => {
            setAd(t);
            setBildirim(null);
            setTamam(null);
          }}
          placeholder="Liste adı (ör. Bankalar)"
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={olustur}
          accessibilityLabel="Yeni listenin adı"
          style={[
            styles.alan,
            type.body,
            { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        />
        <Dugme label="Oluştur" size="sm" disabled={!ad.trim()} onPress={olustur} />
      </View>
      {bildirim ? <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text> : null}
      {tamam ? <Text style={[type.small, { color: colors.positive }]}>{tamam}</Text> : null}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        Listeler bu cihazda saklanıyor. Motor sözleşmesi tek turda en çok 8 sembol ölçüyor; her
        listenin kendi 8 sembol sınırı var.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alan: {
    flex: 1,
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
});
