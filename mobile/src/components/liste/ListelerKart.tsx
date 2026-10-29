// =====================================================================
//  ListelerKart — adlandırılmış listelerin tamamı    (ŞERİT F7 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderLists` (app.js:7958) karşılığı: kayıtlı bütün
//  adlandırılmış listeleri blok blok basıyor, altına "yeni liste" girişi
//  koyuyor, boş durumda web'in cümlesini yazıyor.
//
//  NEDEN ÜST LİSTEDEN AYRI BİR KATMAN: sekmenin üstündeki motor turu DÜZ
//  görünüme ("mobil"/Takip listesine) bakıyor. Web'de ise liste YÖNETİMİ
//  ayrı bir blok kümesi. İkisi aynı kaydı yazıyor (api/liste.ts:duzTazele
//  bunu ölçüp bağlıyor), bu yüzden buradan yapılan ekleme/çıkarma üstteki
//  motor turunu da tazeliyor — ikinci bir doğruluk kaynağı açılmıyor.
//
//  ÜÇ AYRI DAL (ÖLÇÜLMEYEN SAYI BASILMAZ):
//    • depo henüz okunmadı  → "okunuyor" ("liste yok" DEĞİL)
//    • okundu, kayıt yok    → web'in boş cümlesi
//    • okundu, kayıt var    → bloklar
//
//  BURADA HESAP YOK: tek bir eşik/formül yok; `budandi` bayrağı uçtan
//  değil DEPO SÖZLEŞMESİNDEN gelen bir gerçek (evrenSemboller, 8 sınırı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { useHazir } from '@/api';
import { VARSAYILAN_LISTE_ID } from '@/api/depo';
import { evrenSemboller, useListeler } from '@/api/liste';
import { Card } from '@/components';
import { space, type, useTheme } from '@/theme';

import { ListeBlogu } from './ListeBlogu';
import { YeniListeKart } from './YeniListeKart';

export type ListelerKartProps = Record<string, never>;

export function ListelerKart() {
  const { colors } = useTheme();
  const hazir = useHazir();
  const listeler = useListeler();
  // Evren budandı mı? ÖLÇÜLMÜŞ gerçek: depo 8 sembolden sonrasını
  // kesiyor (api/depo.ts:evrenSemboller). Kullanıcı bunu bilmeli.
  const evren = hazir ? evrenSemboller() : null;

  if (!hazir) {
    return (
      <Card title="Listelerim">
        <Text style={[type.small, { color: colors.textDim }]}>
          Cihazdaki kayıt okunuyor…
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.kab}>
      <Card
        title="Listelerim"
        subtitle={
          evren
            ? evren.semboller.length + ' sembol motora gidecek evrende'
            : 'Evren ölçülmedi'
        }>
        {listeler.length === 0 ? (
          <Text style={[type.small, { color: colors.textDim }]}>
            Henüz liste yok. Aşağıdan yeni bir liste oluştur.
          </Text>
        ) : (
          <Text style={[type.small, { color: colors.textDim }]}>
            {listeler.length + ' liste kayıtlı. Bir listeyi açınca fiyatları motordan ölçüyorum.'}
          </Text>
        )}
        {evren && evren.budandi ? (
          <Text style={[type.micro, { color: colors.gold }]}>
            Evren 8 sembolde kesildi: motor tek turda en çok 8 sembol ölçüyor, sonrası evrene
            katılmadı.
          </Text>
        ) : null}
      </Card>

      {listeler.map((kayit) => (
        <ListeBlogu
          key={kayit.id}
          kayit={kayit}
          varsayilan={kayit.id === VARSAYILAN_LISTE_ID}
        />
      ))}

      <YeniListeKart mevcutSayi={listeler.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  kab: { gap: space.sm },
});
