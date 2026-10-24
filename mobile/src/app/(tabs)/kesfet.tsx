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
//  NEDEN "gündem" ARTIK BURADA: eski başlık "radar/gündem için uç YOK
//  (api/ altında haber/radar ucu bulunmuyor)" diyordu. O ÖLÇÜM ESKİDİ —
//  `/api/news` yazıldı. Gündem kartı bu ekrana kondu çünkü eksiği İLAN
//  EDEN ekran burasıydı; Bugün'ün ilan ettiği eksikler makro (konjonktür,
//  piyasa nabzı, öne çıkan sektör) ve manşet onların yerine geçmez.
//  Radar (tarama) için hâlâ uç yok; o madde açık.
//
//  GÜNDEM KARTI SKOR DEĞİL: `/api/news` metin döndürüyor, skora girdi
//  vermiyor (api/news.js başlığı). Manşetten yön/duygu çıkarmak ⚡ Nabız'ın
//  işi ve o mantık MOTORDA — bu kart manşeti yazar, yorumlamaz.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchNews,
  fetchRecommend,
  haberOlcumEksik,
  useHazir,
  useIstek,
  useListe,
  type HaberMadde,
  type HaberPazar,
  type RecommendRow,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Durum,
  OlcemedimKutu,
  OlcumEksikRozet,
  Pill,
  ScreenShell,
  VeriYok,
} from '@/components';
import { formatHaberTarih, formatPercent, formatPrice, formatScore } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

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
      note="Tarama (radar) katmanı için motor ucu yok; tematik keşif Arama sekmesinde.">
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

      {/* Gündem kartı KENDİ isteğini yapıyor: recommend turundan bağımsız,
          çünkü manşet ölçümü skor ölçümüne bağlı değil — biri düşerken
          öteki durabilir ve ekranda ikisi AYRI anlatılmalı. */}
      <GundemKarti />
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
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.sm },
  cip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

/**
 * GÜNDEM — `/api/news` manşetleri, takip listesindeki TEK sembol için.
 *
 * NEDEN TEK SEMBOL: uç bir çağrıda bir sorgu alıyor (api/news.js: `q`).
 * Listedeki her sembol için ayrı istek açmak, ekran açılışında N dış
 * besleme isteği demek olurdu. Hangi sembolün manşeti olduğu BAŞLIKTA
 * yazılı, çipten değiştirilebiliyor; sessiz bir seçim yok.
 *
 * NEDEN `.IS` KIRPILIYOR: `q` serbest metin ve haber beslemesi borsa
 * sonekini tanımıyor; "ASELS.IS" yerine "ASELS" aranıyor. Hangi besleme
 * yereline gidildiği (`TR`/`US`) başlıkta yazılı. Bu bir eşik/hesap
 * değil, sorgu metni hazırlığı.
 */
function GundemKarti() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();
  const [secili, setSecili] = useState<string | null>(null);

  // Seçim listeden düşerse (sembol silindi) ilk sembole dönülür.
  const sembol = secili && liste.includes(secili) ? secili : (liste[0] ?? '');
  const bist = sembol.toUpperCase().endsWith('.IS');
  const pazar: HaberPazar = bist ? 'TR' : 'US';
  const sorgu = bist ? sembol.slice(0, -3) : sembol;

  const cagri = useCallback(
    (signal: AbortSignal) => fetchNews(sorgu, { market: pazar, signal }),
    [sorgu, pazar],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'haber:' + pazar + ':' + sorgu, {
    etkin: hazir && sorgu.length > 0,
  });

  const maddeler: HaberMadde[] = veri?.maddeler ?? [];
  // `tam: false` → 200 geldi ama besleme okunamadı. BU "HABER YOK" DEĞİL;
  // ayrı yardımcı, çünkü haber sayacı skor sayacının şekli değil.
  const eksik = haberOlcumEksik(veri);

  return (
    <Card
      title="Gündem — manşetler"
      subtitle={sorgu ? sorgu + ' · ' + pazar + ' beslemesi · motor ucu' : 'Takip listesi boş'}>
      {liste.length > 1 ? (
        <View style={styles.cipler}>
          {liste.map((s) => {
            const aktif = s === sembol;
            return (
              <Pressable
                key={s}
                onPress={() => setSecili(s)}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif }}
                style={[
                  styles.cip,
                  {
                    backgroundColor: aktif ? colors.bgElevated : 'transparent',
                    borderColor: aktif ? colors.borderStrong : colors.border,
                  },
                ]}>
                {/* Seçim RENKLE DEĞİL işaretle de taşınıyor: aktif çipin
                    önünde "•" var (renk körü okunabilirliği). */}
                <Text
                  style={[
                    aktif ? type.microBold : type.micro,
                    { color: aktif ? colors.text : colors.textDim },
                  ]}>
                  {(aktif ? '• ' : '') + s}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {durum === 'veri' && eksik ? (
        <OlcemedimKutu
          metin={'“' + sorgu + '” için haber beslemesi okunamadı — manşet var mı yok mu ÖLÇEMEDİM.'}
          yenile={yenile}
        />
      ) : null}

      {/* BOŞ LİSTE ARIZA DEĞİL (api/news.js): ölçüldü, sonuç yok. */}
      {durum === 'veri' && !eksik && !maddeler.length ? (
        <VeriYok kartsiz metin={'“' + sorgu + '” için haber bulunamadı.'} />
      ) : null}

      {durum === 'veri' && !eksik && maddeler.length
        ? maddeler.map((m, i) => <HaberSatiri key={(m.link || 'madde') + ':' + i} madde={m} />)
        : null}

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

/**
 * Tek manşet. Metin UCUN VERDİĞİ GİBİ basılıyor: kısaltma, çeviri, emoji
 * ya da "olumlu/olumsuz" etiketi YOK — o yorum olurdu.
 */
function HaberSatiri({ madde }: { madde: HaberMadde }) {
  const { colors } = useTheme();
  const baslik = (madde.title ?? '').trim();
  const link = (madde.link ?? '').trim();
  const kaynak = (madde.source ?? '').trim();
  const tarih = formatHaberTarih(madde.pubDate);

  return (
    <View style={styles.satir}>
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
