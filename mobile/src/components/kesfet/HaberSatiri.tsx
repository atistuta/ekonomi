// =====================================================================
//  HABER SATIRI — tek manşet, SALT SUNUM                (native / UI)
// ---------------------------------------------------------------------
//  NE: `/api/news` maddesinin (`HaberMadde`) tek satırlık gösterimi:
//  başlık + "kaynak · tarih". Başlık bağlantı taşıyorsa tarayıcıda
//  açılır.
//
//  NEDEN BU KLASÖRDE: bu dosya VERİ ÇEKMİYOR — klasörün kuralı
//  ("bu kartlar veri çekmez, satırları PROP olarak alır") aynen
//  geçerli. Manşeti kim istediyse (Bugün'deki 🔭 tematik haber kartı,
//  Arama'daki 📰 tema haberleri kartı) isteği o atıyor.
//
//  NEDEN AYRI DOSYA: aynı satır ÜÇ ekranda basılıyor (Bugün · Arama ·
//  Keşfet/Gündem). Üç kopya yazmak, yarın biri "kaynak bildirilmedi"
//  yerine boş dizgi basmaya başladığında üç farklı doğruluk demekti.
//  ÖLÇÜLDÜ 2026-10-27: `(tabs)/kesfet.tsx`teki yerel kopya SİLİNDİ ve o
//  ekran da bu dosyayı içe aktarıyor (2026-10-25 tarihli "hâlâ kendi
//  kopyasını kullanıyor" ölçümü artık geçerli değil). Gövde iki dosyada
//  BİREBİR aynıydı; davranış değişmedi.
//
//  ── TÜR VE SEMBOL ROZETİ (eklendi 2026-10-29, ŞERİT F) ────────────
//  ÖLÇÜLDÜ: uç maddeye `type` ve `symbol` alanlarını YAZIYOR
//  (api/_haber.js:81 `MADDE_ALANLARI`, :242) ama native sözleşme tipi
//  dört alan sayıyordu ve bu ikisi gövdede GELDİĞİ HÂLDE hiçbir ekrana
//  ulaşmıyordu. Artık satırın solunda basılıyorlar.
//
//  ROZET HAM: ucun verdiği dizgi olduğu gibi gidiyor — 'NEWS' → "Haber"
//  gibi bir çeviri sözlüğü BİLEREK yazılmadı; uç yarın üçüncü bir tür
//  ilan ederse sözlükte karşılığı olmadığı için sessizce düşerdi.
//  `symbol` `null` ise rozet HİÇ basılmıyor: serbest metin sorgusunda
//  maddenin hissesi YOKTUR ve sorgu metnini sembol gibi yazmak uydurma
//  olurdu (uç başlığının kendi gerekçesi).
//
//  BURADA HESAP YOK: metinler ucun verdiği gibi basılıyor; kısaltma,
//  çeviri ya da "olumlu/olumsuz" etiketi yok — o yorum olurdu. Tarih
//  biçimlemesi `lib/format.ts`e bırakılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Linking, StyleSheet, Text, View } from 'react-native';

import { type HaberMadde } from '@/api';
import { Pill } from '@/components';
import { formatHaberTarih } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export type HaberSatiriProps = {
  madde: HaberMadde;
};

export function HaberSatiri({ madde }: HaberSatiriProps) {
  const { colors } = useTheme();
  const baslik = (madde.title ?? '').trim();
  const link = (madde.link ?? '').trim();
  const kaynak = (madde.source ?? '').trim();
  const tarih = formatHaberTarih(madde.pubDate);
  // Ham dizgiler: boşsa rozet HİÇ basılmıyor (yer tutucu uydurulmuyor).
  const tur = (madde.type ?? '').trim();
  const sembol = (madde.symbol ?? '').trim();

  return (
    <View style={styles.satir}>
      {tur || sembol ? (
        <View style={styles.rozetler}>
          {tur ? <Pill label={tur} tone="neutral" variant="outline" glyph={null} size="sm" /> : null}
          {sembol ? (
            <Pill label={sembol} tone="info" variant="outline" glyph={null} size="sm" />
          ) : null}
        </View>
      ) : null}

      {/* Bağlantı YOKSA basılabilir görünmüyor: tıklanınca hiçbir şey
          olmayan bir başlık, çalışıyormuş gibi görünen bir yalandır. */}
      <Text
        {...(link
          ? {
              accessibilityRole: 'link' as const,
              onPress: () => {
                void Linking.openURL(link).catch(() => {});
              },
            }
          : null)}
        style={[type.small, { color: colors.text }]}>
        {baslik || 'Başlık gelmedi'}
      </Text>
      <Text style={[type.micro, { color: colors.textDim }]}>
        {(kaynak || 'kaynak bildirilmedi') + ' · ' + tarih}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { gap: 2, paddingVertical: space.sm },
  rozetler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingBottom: 2 },
});
