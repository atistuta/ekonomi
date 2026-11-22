// =====================================================================
//  PROFİL KARTI — anketin yanıtları + yeniden yapma     (PROcess / native)
// ---------------------------------------------------------------------
//  NE: ankette ne yanıtlandığını özetler ve anketi yeniden açar
//  (`profilSifirla` kaydı siler; kabuk anketi yeniden basar).
//
//  NEDEN GÖRÜNÜR OLMALI: anket EKRAN AYARI yazıyor. Kullanıcı hangi
//  ayarın nereden geldiğini görmeli, yoksa "uygulama benim adıma karar
//  verdi" hissi doğar. Kart aynı zamanda tek geri alma yolu.
//
//  BURADA HESAP YOK: yanıtlar olduğu gibi yazılıyor; puan, risk sınıfı
//  ya da "sana uygun" cümlesi ÜRETİLMİYOR (api/depo.ts §11).
//
//  ÜÇ DAL (ÖLÇÜLMEYEN SAYI BASILMAZ):
//    • depo okunmadı → "okunuyor"
//    • atlandı       → "yanıt yok", varsayılanların ne olduğu yazılı
//    • yanıt var     → satırlar
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { profilSifirla, useProfil, useProfilHazir } from '@/api/depo';
import { Card, Dugme } from '@/components';
import { ANKET_SORULAR, anketYanit } from '@/lib/anket';
import { space, type, useTheme } from '@/theme';

export type ProfilKartProps = Record<string, never>;

export function ProfilKart() {
  const { colors } = useTheme();
  const profil = useProfil();
  const hazir = useProfilHazir();

  if (!hazir) {
    return (
      <Card title="Yatırım profilim">
        <Text style={[type.small, { color: colors.textDim }]}>Cihazdaki kayıt okunuyor…</Text>
      </Card>
    );
  }

  return (
    <Card
      title="Yatırım profilim"
      subtitle="Anket yanıtları yalnız ekranı ayarlar: skora, eşiğe, ağırlığa girmez.">
      {profil.tamamlandi ? (
        <View style={styles.satirlar}>
          {ANKET_SORULAR.map((soru) => {
            const y = anketYanit(profil, soru);
            const metin = y == null ? null : Array.isArray(y) ? (y.length ? y.join(', ') : null) : y;
            return (
              <View key={soru.alan} style={styles.satir}>
                <Text style={[type.micro, { color: colors.textFaint }]}>{soru.baslik}</Text>
                {/* Yanıt yoksa cümle de yok — uydurma varsayılan basılmıyor. */}
                <Text style={[type.small, { color: metin ? colors.text : colors.textDim }]}>
                  {metin ?? 'yanıtlanmadı'}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[type.small, { color: colors.textDim }]}>
          {profil.atlandi
            ? 'Anket atlandı: hiçbir yanıt kaydedilmedi. Ekran motorun varsayılan vadesiyle (orta) açılıyor.'
            : 'Anket henüz yapılmadı. Ekran motorun varsayılan vadesiyle (orta) açılıyor.'}
        </Text>
      )}
      <Dugme
        label={profil.tamamlandi ? 'Anketi yeniden yap' : 'Anketi yap'}
        size="sm"
        variant="outline"
        tone="neutral"
        onPress={() => void profilSifirla()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  satirlar: { gap: space.sm },
  satir: { gap: 2 },
});

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
