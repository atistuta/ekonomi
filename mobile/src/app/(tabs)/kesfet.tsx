// =====================================================================
//  KEŞFET — 3. sekme, MOTORA BAĞLI                    (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: Keşfet sekmesi üç kart basıyor: 🌍 Radar (motorun tema→sektör
//  sözlüğü) · 🔥 Fırsatlar (risk/ödül dizilimi) · 🔎 Tarama (motorun
//  önayar taraması) + Gündem manşetleri. Üçü `@/components/kesfet` altında.
//
//  ── HANGİ KART HANGİ UCA GİDİYOR (ÖLÇÜLDÜ 2026-10-27) ──────────────
//  🔥 Fırsatlar → bu ekranın `/api/recommend` turu (prop olarak alıyor).
//  🌍 Radar    → KENDİ çekiyor: `/api/radar`.
//  🔎 Tarama   → KENDİ çekiyor: `/api/yfin` → `/api/tarama`.
//
//  ── NEDEN ESKİ "TEK TUR, ÜÇ KART" DÜZENİ BOZULDU ───────────────────
//  ÖLÇÜLDÜ: bu dosyada tek bir `fetchRecommend(liste,{vade:'orta'})`
//  turu vardı ve aynı cevap üç karta dağıtılıyordu; `/api/radar` ve
//  `/api/tarama` HİÇ çağrılmıyordu. Yani üç kart aynı veriyi üç ad
//  altında gösteriyordu — kullanıcı üç ayrı ölçüm sanıyordu. Eski
//  başlıktaki "Radar (tarama) için hâlâ uç yok" ölçümü de ESKİDİ: iki uç
//  da yazılmış ve `api/proxy.js` ile taşınıyor. Tek tur gerekçesi
//  (istek tasarrufu) geçerliliğini yitirdi, çünkü tasarruf edilen şey
//  ölçümün kendisiydi.
//
//  NEDEN ÜÇ AYRI DURUM: üç ölçüm birbirinden bağımsız; biri düşerken
//  öteki durabilir. Kendi verisini çeken iki kart kendi `Durum`unu da
//  çiziyor, ekranın tepesindeki `Durum` yalnız recommend turunu anlatıyor.
//
//  NEDEN GRUPLAMA/SÜZME HESAP DEĞİL: Fırsatlar motorun zaten söylediği
//  alanları okuyup karşılaştırıyor; eşik/ağırlık/formül motorda. Eski
//  Tarama kartındaki yerel `ESIK = 70` SİLİNDİ (bkz. TaramaKart başlığı).
//
//  NEDEN "gündem" BURADA: eski başlık "radar/gündem için uç YOK" diyordu;
//  o ölçüm eskidi — `/api/news` yazıldı. Gündem kartı eksiği İLAN EDEN
//  ekrana kondu; Bugün'ün ilan ettiği eksikler makro ve manşet onların
//  yerine geçmez.
//
//  GÜNDEM KARTI SKOR DEĞİL: `/api/news` metin döndürüyor, skora girdi
//  vermiyor (api/news.js başlığı). Manşetten yön/duygu çıkarmak ⚡ Nabız'ın
//  işi ve o mantık MOTORDA — bu kart manşeti yazar, yorumlamaz.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import {
  FirsatlarKart,
  HaberSatiri,
  RadarKart,
  SektorKart,
  TaramaKart,
} from '@/components/kesfet';
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
      note="Radar · Tarama · Fırsatlar AYRI ölçümlerdir; tematik keşif Arama sekmesinde.">
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

      {/* 🌍 Radar KENDİ ucuna gidiyor (`/api/radar`): recommend turundan
          bağımsız, saf sözlük okuması. Bu yüzden recommend dalının
          DIŞINDA — liste boşken bile sözlük okunabilir. */}
      <RadarKart onSembol={sembolAc} />

      {/* NEDEN YALNIZ `veri` DALINDA: Fırsatlar satırları PROP olarak
          alıyor, yani ekranın turuna bağlı. Yükleniyor/hata/boş hâllerini
          üstteki TEK `Durum` anlatıyor. */}
      {durum === 'veri' && satirlar.length ? (
        <FirsatlarKart
          satirlar={satirlar}
          durum={durum}
          hata={hata}
          yenile={yenile}
          kaynak={veri}
          onSembol={sembolAc}
        />
      ) : null}

      {/* 🔎 Tarama KENDİ iki turunu atıyor (`/api/yfin` → `/api/tarama`):
          girdisi takip listesi, recommend cevabı değil. */}
      <TaramaKart liste={liste} onSembol={sembolAc} />

      {/* Sektor dagilimi -- Tarama ile AYNI hat (yfin kunye -> POST),
          ayni 12 sembol siniri. Yeni sekme ACILMADI. */}
      <SektorKart liste={liste} onSembol={sembolAc} />

      {/* Gündem kartı KENDİ isteğini yapıyor: recommend turundan bağımsız,
          çünkü manşet ölçümü skor ölçümüne bağlı değil — biri düşerken
          öteki durabilir ve ekranda ikisi AYRI anlatılmalı. */}
      <GundemKarti />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
