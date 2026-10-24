// =====================================================================
//  BUGÜN — 2. sekme, MOTORA BAĞLI                     (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinin TEK TURDA kıyası: /api/compare. Motorun kendi
//  ürettiği `sira` dizisi (1'den başlayarak) ekrana olduğu gibi
//  basılıyor; sıralanamayanlar sessizce düşürülmüyor, yazıyor.
//
//  NEDEN SIRALAMAYI İSTEMCİ YAPMIYOR: `sira` alanı uçtan geliyor
//  (anahtar `dAtr`, eşitlik bozucu `skor10` — uç notu). Burada bir
//  `sort` yazmak İKİNCİ bir sıralama kuralı demekti; web ile native
//  ilk farklı veriye kadar aynı görünür, sonra ayrılırdı.
//
//  NEDEN "konjonktür · piyasa nabzı · öne çıkan sektör" YOK:
//  yol haritasının bu ekran için saydığı dört karttan yalnız "günün
//  fırsatları" ayağının UCU var (compare/recommend). Konjonktür,
//  piyasa nabzı ve sektör için FAZ 1'de uç AÇILMADI (ÖLÇÜLDÜ: api/
//  altında score · recommend · analyze · theme · compare · causal var,
//  makro/nabız/sektör ucu yok). Uydurma bir kart koymak, tam olarak
//  yasak olan şey: sahte veri. Kart yerine EKSİK AÇIKÇA yazıyor ve
//  yol haritasında madde açık bırakıldı.
//
//  BURADA HESAP YOK: sıra, durum, skor10 — hepsi uç alanları.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchCompare, useHazir, useIstek, useListe, type SiraKayit } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, ScreenShell, VeriYok } from '@/components';
import { formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/** Yakınlık durumu — SABİT KÜME (motor), yalnız Türkçeye çevriliyor. */
const DURUM_METIN: Record<string, string> = {
  in: 'alım bandının içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

export default function BugunScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();

  const cagri = useCallback(
    (signal: AbortSignal) => fetchCompare(liste, { vade: 'orta', signal }),
    [liste],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, liste.join(','), {
    // `hazir`: depo okuması bitmeden motora gitmeyiz (bkz. api/liste.ts).
    etkin: hazir && liste.length > 0,
  });

  const sira: SiraKayit[] = veri?.sira ?? [];

  return (
    <ScreenShell
      title="Bugün"
      subtitle="Takip listenin bugünkü sırası — sıralamayı motor yapar."
      note="Konjonktür, piyasa nabzı ve sektör kartları için motor ucu henüz yok; uydurma kart konmadı.">
      <Card
        title="Fiyata yakınlık sırası"
        subtitle="Anahtar: alım bandına ATR uzaklığı (motor kararı)"
        right={
          durum === 'veri' && veri ? (
            <Pill label={veri.vade} tone="info" glyph={null} size="sm" />
          ) : null
        }>
        {/* NEDEN `kartsiz`: bu gövde zaten bir `Card` içinde; `Durum`un
            kendi kartını çizmesi iç içe iki kart kenarı demekti.
            NEDEN `sekil="sira"`: beklenen içerik numaralı sıra satırı,
            fiyat/değişim taşıyan liste satırı DEĞİL — iskelet gelecek
            şeklin aynısını taşımazsa içerik yerleşince düzen sıçrar. */}
        <Durum
          durum={durum}
          hata={hata}
          yenile={yenile}
          iskelet={Math.max(liste.length, 3)}
          sekil="sira"
          kartsiz
          bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
        />
        {durum === 'veri' && veri ? <OlcumEksikRozet kaynak={veri} /> : null}
        {durum === 'veri' ? (
          sira.length ? (
            <ScrollView style={styles.kaydir} nestedScrollEnabled>
              {sira.map((s) => (
                <Text
                  key={s.sym}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/analiz', params: { sym: s.sym } })}
                  style={[styles.sira, { color: colors.text, borderBottomColor: colors.border }]}>
                  <Text style={type.smallBold}>{s.sira + '. ' + s.sym}</Text>
                  <Text style={{ color: colors.textDim }}>
                    {'  ' + (DURUM_METIN[s.durum] ?? s.durum)}
                  </Text>
                  <Text style={{ color: colors.textFaint }}>
                    {'  · bütüncül ' + formatScore(s.skor10) + '/10'}
                  </Text>
                </Text>
              ))}
            </ScrollView>
          ) : (
            // ÖLÇÜLDÜ, SONUÇ YOK: hata değil veri cevabı — "yeniden dene"
            // düğmesi yok (aynı boş sıra gelir). Diğer ekranlarla aynı
            // kutu: ayrı bir metin yazmak beşinci bir anlatım olurdu.
            <VeriYok
              kartsiz
              metin="Sıralanabilir sembol yok (alım bandı ya da fiyat ölçülemedi)."
            />
          )
        ) : null}
        {durum === 'veri' && veri ? (
          <View style={styles.notlar}>
            {veri.siralanamayan.length ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Sıralanamayan: ' + veri.siralanamayan.join(', ') + ' (fiyat/band yok).'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Card title="Henüz ölçülmeyen kartlar" subtitle="Dürüst eksik listesi">
        <Text style={[type.small, { color: colors.textDim }]}>
          {"Konjonktür kartı, piyasa nabzı ve öne çıkan sektör için motor API'de uç yok. Bu " +
            'kartlar açılmadan önce uçlarının yazılması gerekiyor; o yüzden burada boş bırakıldı ' +
            '— yer tutucu sayı GÖSTERİLMİYOR.'}
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  kaydir: { maxHeight: 320 },
  sira: {
    ...type.small,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notlar: { gap: space.xs, marginTop: space.sm },
});
