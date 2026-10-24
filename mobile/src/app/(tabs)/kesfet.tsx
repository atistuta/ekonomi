// =====================================================================
//  KEŞFET — 3. sekme, MOTORA BAĞLI                    (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinde FIRSAT ayrıştırması: /api/recommend turundan
//  gelen `plan.yakinlik` (alım bandına uzaklık) ve `plan.momentum`
//  (trend-devam rejimi) alanları.
//
//  NEDEN BU İKİSİ: web tarafındaki "Fırsatlar" ve "⚡ momentum girişi"
//  katmanlarının motor karşılıkları bunlar. İkisi de UCUN KARARI:
//  `yakinlik.state` ve `momentum.active` sabit küme değerler; istemci
//  "fırsat mı" sorusuna kendi eşiğiyle cevap VERMİYOR, yalnız motorun
//  cevabını gruplandırıyor.
//
//  NEDEN GRUPLAMA HESAP DEĞİL: `state === 'in'` olanları bir başlık
//  altında toplamak yeni bir eşik üretmez — motorun zaten söylediği
//  kategoriyi okur. Tek bir sayı burada türetilmiyor.
//
//  NEDEN "tarama · radar · gündem" YOK: yol haritası bu ekrana tematik
//  keşif + radar/gündem da yazıyor. Tematik keşfin ucu VAR ve Arama
//  sekmesine bağlandı (orada sorgu alanı zaten duruyor); radar/gündem
//  için uç YOK (ÖLÇÜLDÜ: api/ altında haber/radar ucu bulunmuyor).
//  Boş bir "radar" kartı sahte veri olurdu; madde açık bırakıldı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { fetchRecommend, useHazir, useIstek, useListe, type RecommendRow } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, ScreenShell, VeriYok } from '@/components';
import { formatPercent, formatPrice, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export default function KesfetScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();

  const cagri = useCallback(
    (signal: AbortSignal) => fetchRecommend(liste, { vade: 'orta', signal }),
    [liste],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, liste.join(','), {
    // `hazir`: depo okuması bitmeden motora gitmeyiz (bkz. api/liste.ts).
    etkin: hazir && liste.length > 0,
  });

  const satirlar: RecommendRow[] = veri?.sonuclar ?? [];
  // Gruplama = motorun `state` değerini okumak. Yeni eşik ÜRETİLMİYOR.
  const bandaYakin = satirlar.filter((r) => {
    const s = r.plan?.yakinlik?.state;
    return s === 'in' || s === 'near' || s === 'below';
  });
  const momentumlu = satirlar.filter((r) => r.plan?.momentum?.active === true);

  return (
    <ScreenShell
      title="Keşfet"
      subtitle="Motorun fırsat ve momentum kararları — eşikler motorda."
      note="Radar / gündem katmanı için motor ucu yok; tematik keşif Arama sekmesinde.">
      {/* `sekil="sira"`: beklenen içerik sembol + rozet + iki künye
          satırı; fiyat/değişim sütunlu liste satırı değil. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={2}
        sekil="sira"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {/* NEDEN AYRI BİR "HİÇ SONUÇ YOK" DALI: eskiden tur boş döndüğünde
          iki kart birlikte "listede banda yakın sembol yok" + "momentumu
          etkin sembol yok" diyordu. İkisi de doğruymuş gibi görünüyor ama
          ima ettiği şey yanlıştı: semboller ölçüldü de hiçbiri bu
          kategoriye girmedi. Oysa motor HİÇ satır döndürmemişti —
          kategori boşluğu ile sonuç boşluğu aynı şey değil. */}
      {durum === 'veri' && !satirlar.length ? (
        <VeriYok metin="Motor bu semboller için sonuç döndürmedi; ayrıştırılacak satır yok." />
      ) : null}

      {durum === 'veri' && satirlar.length ? (
        <>
          {veri ? <OlcumEksikRozet kaynak={veri} /> : null}
          <Card title="Alım bandına yakın" subtitle="Motorun `yakinlik` kararı">
            {bandaYakin.length ? (
              bandaYakin.map((r) => <FirsatSatiri key={r.sym} satir={r} />)
            ) : (
              <VeriYok kartsiz metin="Listede alım bandına yakın sembol yok." />
            )}
          </Card>

          <Card title="Momentum / trend-devam" subtitle="Motorun `momentum.active` kararı">
            {momentumlu.length ? (
              momentumlu.map((r) => (
                <View key={r.sym} style={styles.satir}>
                  <Text style={[type.smallBold, { color: colors.text }]}>{r.sym}</Text>
                  <Text style={[type.micro, { color: colors.textDim }]}>
                    {'ADX ' +
                      formatScore(r.ta.adx) +
                      ' · rejim ' +
                      (r.ta.regime ?? 'ölçülemedi') +
                      ' · TA ' +
                      formatScore(r.ta.score)}
                  </Text>
                </View>
              ))
            ) : (
              <VeriYok kartsiz metin="Listede momentum rejimi etkin olan sembol yok." />
            )}
          </Card>
        </>
      ) : null}
    </ScreenShell>
  );
}

function FirsatSatiri({ satir }: { satir: RecommendRow }) {
  const { colors } = useTheme();
  const yk = satir.plan?.yakinlik;
  const band = satir.plan?.seviye?.buyZone;
  const up = satir.plan?.riskOdul?.sellUpPct;
  const brk = satir.plan?.riskOdul?.brkPct;

  return (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/analiz', params: { sym: satir.sym } })}
          style={[type.smallBold, { color: colors.text }]}>
          {satir.sym}
        </Text>
        <Pill label={yk?.state ?? 'ölçülemedi'} tone="info" glyph={null} size="sm" />
      </View>
      <Text style={[type.micro, { color: colors.textDim }]}>
        {'Alım bandı: ' +
          (band && band.length === 2
            ? formatPrice(band[0], satir.market === 'BIST' ? 'TRY' : null) +
              ' – ' +
              formatPrice(band[1], satir.market === 'BIST' ? 'TRY' : null)
            : 'ölçülemedi')}
      </Text>
      {/* ▲/▼ bilinçli: yön rengin yanında İŞARETLE de taşınıyor. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'▲ kâr-al ' + formatPercent(up) + '   ▼ kırılma ' + formatPercent(brk)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { gap: 2, paddingVertical: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
