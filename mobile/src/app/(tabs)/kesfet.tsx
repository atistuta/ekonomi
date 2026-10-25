// =====================================================================
//  KEŞFET — 3. sekme, MOTORA BAĞLI                    (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinin TEK `/api/recommend` turu, üç yüzeye dağıtılıyor:
//  🌍 Radar (tek bakışta hâl) · 🔥 Fırsatlar (risk/ödül dizilimi) ·
//  🔎 Tarama (ölçüt süzgeci). Üçü de `@/components/kesfet` altında.
//
//  NEDEN TEK TUR, ÜÇ KART: üç kartın hiçbiri veri ÇEKMİYOR; satırları
//  prop olarak alıyor. Aksi hâlde aynı tur için üç istek ödenir ve üç
//  kart birbirinden farklı üç anlık görüntü gösterebilirdi.
//
//  NEDEN GRUPLAMA/SÜZME HESAP DEĞİL: kartlar motorun zaten söylediği
//  alanları (`composite.blendedShown`, `ta.score`, `fa.score`,
//  `plan.yakinlik.state`, `plan.momentum.active`, `tam`) okuyup
//  karşılaştırıyor. Tarama'nın ≥70 çipi KULLANICI SÜZGECİNİN ayarı,
//  skor eşiği değil — tek bir sayı burada türetilmiyor.
//
//  NEDEN ESKİ İKİ KART GİTTİ: bu ekranda elle yazılmış "Alım bandına
//  yakın" + "Momentum" kartları vardı; ikisinin içeriği de Tarama'nın
//  `bandaYakin` / `momentum` ölçütleri ve Radar'ın yakınlık sütunu
//  tarafından kapsanıyor. Aynı kararı iki ayrı yerde basmak, biri
//  yarın değişince sessiz bir çelişki bırakırdı.
//
//  ESKİ ÖLÇÜM DÜZELTMESİ: başlık "Radar (tarama) için hâlâ uç yok"
//  diyordu. O ölçüm ESKİDİ — radar/tarama için AYRI bir uç gerekmiyordu;
//  ikisi de `/api/recommend` satırlarının okunmasıyla çiziliyor.
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
  ScreenShell,
  VeriYok,
} from '@/components';
import { FirsatlarKart, RadarKart, TaramaKart } from '@/components/kesfet';
import { formatHaberTarih } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

export default function KesfetScreen() {
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

  // Satır dokunuşunun karşılığı SEKMENİN kararı (kartlar yönlendirme
  // bilmiyor): hisse detay ekranı. `/analiz` değil — orada sembol
  // karşılaştırması var, tek sembolün TA+FA+tez dökümü detayda.
  const sembolAc = useCallback((sym: string) => {
    router.push({ pathname: '/hisse/[sembol]', params: { sembol: sym } });
  }, []);

  return (
    <ScreenShell
      title="Keşfet"
      subtitle="Motorun fırsat ve momentum kararları — eşikler motorda."
      note="Üç kart TEK recommend turunu okur; tematik keşif Arama sekmesinde.">
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

      {/* NEDEN YALNIZ `veri` DALINDA: yükleniyor/hata/boş hâlleri ekran
          üstündeki TEK `Durum` anlatıyor. Kartlar da durum alıyor (kendi
          sözleşmeleri bu) ama üçünü birden çizmek aynı yüklenmeyi üç
          iskeletle, aynı arızayı üç hata kutusuyla tekrar basardı. */}
      {durum === 'veri' && satirlar.length ? (
        <>
          <RadarKart
            satirlar={satirlar}
            durum={durum}
            hata={hata}
            yenile={yenile}
            kaynak={veri}
            liste={liste}
            atlanan={veri?.atlanan}
            onSembol={sembolAc}
          />
          <FirsatlarKart
            satirlar={satirlar}
            durum={durum}
            hata={hata}
            yenile={yenile}
            kaynak={veri}
            onSembol={sembolAc}
          />
          <TaramaKart
            satirlar={satirlar}
            durum={durum}
            hata={hata}
            yenile={yenile}
            kaynak={veri}
            onSembol={sembolAc}
          />
        </>
      ) : null}

      {/* Gündem kartı KENDİ isteğini yapıyor: recommend turundan bağımsız,
          çünkü manşet ölçümü skor ölçümüne bağlı değil — biri düşerken
          öteki durabilir ve ekranda ikisi AYRI anlatılmalı. */}
      <GundemKarti />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  satir: { gap: 2, paddingVertical: space.sm },
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
