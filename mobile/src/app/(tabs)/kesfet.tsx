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
//  ── SIRALAMA KURALI (TASARIM TURU 2) ───────────────────────────────
//  1) Bu ekranın KENDİ turunun kararı (Fırsatlar — YUKARI ÇIKTI)
//  2) Kendi ucuna gidip takip listesini ölçen kartlar (Tarama · Sektör)
//  3) Sembol bağımsız sözlük/keşif yüzeyleri (Radar — AŞAĞI İNDİ · Tema)
//  4) "Ölçemedim" tanıları ve künye/manşet (Neden · Gündem)
//  Bölümler arasına `BolumBasligi` kondu; gerekçe o dosyanın başlığında
//  (kaydırma konumu ÖLÇÜLEMEDİĞİ için "bölüme atla" yapılmadı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  HABER_TURLERI,
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
  BolumBasligi,
  Card,
  DISCLAIMER_TEXT,
  Durum,
  OlcemedimKutu,
  ScreenShell,
  VeriYok,
} from '@/components';
import {
  DuyarlilikOzeti,
  FirsatlarKart,
  HaberSatiri,
  KriptoKart,
  MadenHaberKart,
  MomentumKart,
  NedenBesleyici,
  RadarKart,
  SektorKart,
  TaramaKart,
  TemaKart,
} from '@/components/kesfet';
import { hisseAc } from '@/lib/gezinme';
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
  //
  // TASARIM TURU 2 — NEDEN GÖVDE `hisseAc`A DEVREDİLDİ: bu kapı eskiden
  // yalnız `{ sembol }` gönderiyordu, oysa buradaki dört kartın satırı
  // (Fırsatlar · Tarama · Sektör · Tema) uçtan `market` ALANIYLA geliyor.
  // Pazar düşünce BIST sembolü `.IS` ekini alamıyor ve hisse ekranı onu
  // ABD'de ölçüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı). Kalıp
  // `lib/gezinme.ts`de TEK yerde duruyor; buradaki köprü davranışı
  // (hangi ekrana gidileceği) DEĞİŞMEDİ.
  const sembolAc = useCallback((sym: string, pazar?: string | null) => {
    hisseAc(sym, pazar);
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

      {/* ── SIRALAMA KURALI (TASARIM TURU 2) ──────────────────────────
          1) Bu ekranın KENDİ turunun kararı (Fırsatlar)
          2) Kendi ucuna gidip kullanıcının LİSTESİNİ ölçen kartlar
          3) Sembol bağımsız sözlük / keşif yüzeyleri
          4) "Ölçemedim" tanıları ve künye/manşet
          Gerekçeler taşınan her kartın kendi yorumunda. */}
      <BolumBasligi
        baslik="Bu ekranın turu"
        kunye="Girdisi takip listen; satırları yukarıdaki tek Durum anlatıyor."
      />
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

      {/* ⚡ Momentum: AYNI turun AYNI satırları, başka bir süzgeçle.
          İkinci istek ATILMIYOR — Fırsatlar ile tek `recommend` cevabını
          paylaşıyor. Fırsatlar'ın HEMEN ARDINDA, çünkü ikisi de bu
          ekranın kendi turundan besleniyor; kendi ucuna giden kartlar
          aşağıdaki bölümde. */}
      {durum === 'veri' && satirlar.length ? (
        <MomentumKart
          satirlar={satirlar}
          durum={durum}
          hata={hata}
          yenile={yenile}
          kaynak={veri}
          onSembol={sembolAc}
        />
      ) : null}

      <BolumBasligi
        baslik="Kendi ucuna giden ölçümler"
        kunye="Her kart kendi isteğini atar; biri düşerken öteki durabilir."
      />
      {/* 🔎 Tarama KENDİ iki turunu atıyor (`/api/yfin` → `/api/tarama`):
          girdisi takip listesi, recommend cevabı değil. */}
      <TaramaKart liste={liste} onSembol={sembolAc} />

      {/* Sektor dagilimi -- Tarama ile AYNI hat (yfin kunye -> POST),
          ayni 12 sembol siniri. Yeni sekme ACILMADI. */}
      <SektorKart liste={liste} onSembol={sembolAc} />

      <BolumBasligi
        baslik="Sözlük ve keşif yüzeyleri"
        kunye="Takip listenden türetilmez; sembol bağımsız okumalar."
      />
      {/* 🌍 Radar KENDİ ucuna gidiyor (`/api/radar`): recommend turundan
          bağımsız, saf sözlük okuması. Bu yüzden recommend dalının
          DIŞINDA — liste boşken bile sözlük okunabilir.

          TASARIM TURU 2 — NEDEN AŞAĞI İNDİ: eskiden ekranın İLK kartıydı.
          Sıralama kuralı (dosya başlığı) "ekranın kendi turu önce, sözlük
          okuması sonra" diyor: Radar kullanıcının listesini HİÇ ölçmüyor,
          motorun tema→sektör sözlüğünü yankılıyor. Listesi ölçülmüş
          kullanıcı ilk ekranda kendi sembollerini değil sabit bir sözlüğü
          görüyordu. Kart SİLİNMEDİ, yalnız keşif bölümüne taşındı.

          `onSembol` İKİ PARAMETRELİ KALIBA GEÇMEDİ — bilerek: bu
          bölümdeki semboller sözlükten ÇIPLAK dizgi olarak geliyor, uçta
          o satır için pazar alanı YOK (`components/kesfet/RadarKart.tsx`).
          Bilinmeyen pazarı uydurmak yerine hiç göndermiyoruz. */}
      <RadarKart onSembol={sembolAc} />
      {/* 🔭 Tema KENDİ ucuna gidiyor (`/api/theme`) ve girdisini KENDİ
          topluyor: tema serbest metin, takip listesinden türetilemez.
          Bu yüzden recommend dalının DIŞINDA — liste boşken de çalışır.

          ⚠️ AYNI UÇ ARAMA SEKMESİNDE DE OKUNUYOR (ÖLÇÜLDÜ 2026-10-29:
          arama.tsx:121) ve `?tema=` yol parametresi köprüsü Arama ↔ Bugün
          arasında yaşıyor (arama.tsx:99 ↔ bugun.tsx:515). BU EKRAN O
          PARAMETREYİ OKUMUYOR ve okutulmadı: üçüncü bir köprü ucu açmak
          iki yönlü akışı tek taraflı bozardı. Kart kendi girdisini taşır.
          Üst başlıktaki "tematik keşif Arama sekmesinde" notu bu yüzden
          DEĞİŞTİRİLMEDİ: tema→haber akışı hâlâ orada; buradaki kart
          tema→HİSSE ADAYI basıyor, ayrı bir okuma. */}
      <TemaKart onSembol={sembolAc} />

      {/* ₿ Kripto (`/api/kripto`) ve 🪙 Maden haberi (`/api/metal`):
          ikisi de native'de BUGÜNE KADAR HİÇ çağrılmamış uçlar
          (çekiciler 2026-11-03'te bağlandı). Recommend dalının
          DIŞINDA: takip listesi boşken de çalışıyorlar, girdileri
          listeden türetilmiyor.

          ⚠️ `/api/metal` FİYAT UCU DEĞİL, haber ucu — kart adı bu
          yüzden "Maden haberi". Ons altın FİYATI Bugün sekmesindeki
          çok dönemli değişim kartında (`GC=F`) ölçülüyor. */}
      <KriptoKart />
      <MadenHaberKart />

      <BolumBasligi
        baslik="Ölçemediklerim ve manşetler"
        kunye="Tanı ve künye bölümü; skora girdi vermez."
      />
      {/* 📉 Neden ARTIK BESLEYİCİYLE MONTE (2026-11-03). 2026-10-29
          ölçümü "bu girdiyi ölçen bir uç YOK" diyordu; gündem yarısı için
          o boşluk kapandı: `/api/gundem` (api/_gundem.js) konsept/sektör/
          ısı/ton döndürüyor ve `NedenBesleyici` onu `gundemdenKonseptler`
          ile `/api/causal` girdisine çeviriyor. Kartın PROP'u DEĞİŞMEDİ
          — girdiyi hâlâ çağıran veriyor, kart üretmiyor.
          ENDEKS HAREKETLERİ YARISI DA KAPANDI: "belirgin" eşiği
          (`notable`) hiçbir uçtan gelmiyordu ve uç onu zorunlu
          istiyordu; eşik motora taşındı (`INDEX_ESIK`) ve uç onu
          kendisi okuyor, böylece besleyici yalnız ÖLÇÜLEN gün
          değişimini (`/api/chart` ×4) yolluyor. İki yarı AYRI
          düşüyor; kart hangisinin eksik olduğunu AYRI AYRI yazıyor. */}
      <NedenBesleyici />

      {/* Gündem kartı KENDİ isteğini yapıyor: recommend turundan bağımsız,
          çünkü manşet ölçümü skor ölçümüne bağlı değil — biri düşerken
          öteki durabilir ve ekranda ikisi AYRI anlatılmalı. */}
      <GundemKarti />
    </ScreenShell>
  );
}

/**
 * "Hepsi" çipinin değeri — UÇ DEĞERİ DEĞİL, ekranın kendi "süzme yok"
 * işareti. `HABER_TURLERI` kümesine karışmaması için küçük harf.
 */
const TUR_HEPSI = 'hepsi';

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
 *
 * ── TÜR ÇİPLERİ (eklendi 2026-10-29, ŞERİT F) ──────────────────────
 * Webdeki birleşik haber akışının iki süzgecinden biri (app.js:3310
 * `newsFilterType`). Çipler SÜZGEÇ, eşik değil: gelen maddeyi `type`
 * alanının EŞİTLİĞİNE göre gösterip saklıyor; hiçbir sayı
 * hesaplanmıyor, hiçbir sıra değişmiyor. İzinli küme ucun kendi
 * ilanından (`HABER_TURLERI`, api/_haber.js:98) — istemci kendi
 * sözlüğünü uydurmuyor.
 *
 * NEDEN 'KAP' ÇİPİ DE VAR AMA BOŞ ÇIKACAK: ÖLÇÜLDÜ (api/_haber.js:99,
 * :241) — bu taşıyıcı YALNIZ 'NEWS' üretir, tek kaynağı Google News
 * RSS ve KAP duyurusu oradan gelmez. Çip "ölçtüm, yok" diyor; bunu
 * "bozuk" ya da "ölçemedim" ile karıştırmamak için süzgeç boş
 * döndüğünde AYRI bir cümle basılıyor. KAP maddesi native'de ayrı uçta
 * yaşıyor (Bugün sekmesi · `/api/takvim` · `TakvimKapMadde`); buraya o
 * turu da çağırıp iki akışı birleştirmek bu şeridin işi DEĞİL —
 * webdeki birleştirme ikinci bir `fetchKAP()` çağrısı (app.js:3312).
 *
 * MADDE TÜR TAŞIMIYORSA ÇİP HİÇ BASILMIYOR: `undefined` = "uç bu alanı
 * bildirmedi" dalı; kullanıcıya hiçbir şeyi süzmeyen bir çip sırası
 * göstermek çalışıyormuş gibi görünen bir yalan olurdu.
 */
function GundemKarti() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();
  const [secili, setSecili] = useState<string | null>(null);
  const [tur, setTur] = useState<string>(TUR_HEPSI);

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

  // Tür alanı HİÇ gelmediyse (eski dağıtım / alan düşmüş) çip sırası
  // basılmıyor; süzmediği bir şeyi süzüyormuş gibi gösteren düğme yok.
  const turBildirildi = maddeler.some((m) => typeof m.type === 'string' && m.type.trim() !== '');
  const suzulmus =
    tur === TUR_HEPSI ? maddeler : maddeler.filter((m) => (m.type ?? '').trim() === tur);

  return (
    <Card
      title="Gündem — manşetler"
      subtitle={sorgu ? sorgu + ' · ' + pazar + ' beslemesi · motor ucu' : 'Takip listesi boş'}>
      {liste.length > 1 ? (
        <View style={styles.cipler}>
          {liste.map((s) => (
            <Cip key={s} etiket={s} aktif={s === sembol} onSec={() => setSecili(s)} />
          ))}
        </View>
      ) : null}

      {/* TÜR SÜZGECİ — yalnız uç tür bildirdiğinde. */}
      {turBildirildi ? (
        <View style={styles.cipler}>
          <Cip
            etiket="Tümü"
            aktif={tur === TUR_HEPSI}
            onSec={() => setTur(TUR_HEPSI)}
          />
          {HABER_TURLERI.map((t) => (
            <Cip key={t} etiket={t} aktif={tur === t} onSec={() => setTur(t)} />
          ))}
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

      {/* DUYARLILIK ÖZETİ — ucun `duyarlilik` katmanı. Alan HİÇ
          gelmediyse bileşen kendi içinde hiçbir şey basmıyor (eski
          dağıtım), `null` ise "ölçemedim" der. Manşet listesi BU ÖLÇÜME
          BAĞLI DEĞİL: katman çökse de manşetler basılır. */}
      {durum === 'veri' && !eksik ? (
        <DuyarlilikOzeti duyarlilik={veri?.duyarlilik} suzuldu={tur !== TUR_HEPSI} />
      ) : null}

      {/* BOŞ LİSTE ARIZA DEĞİL (api/news.js): ölçüldü, sonuç yok. */}
      {durum === 'veri' && !eksik && !maddeler.length ? (
        <VeriYok kartsiz metin={'“' + sorgu + '” için haber bulunamadı.'} />
      ) : null}

      {/* ÜÇÜNCÜ DAL: tur madde getirdi ama SÜZGEÇ eleyip bitirdi. Bu
          "haber yok" DEĞİL, "bu türde haber yok" — iki cümle ayrı,
          çünkü ima ettikleri şey ayrı. */}
      {durum === 'veri' && !eksik && maddeler.length && !suzulmus.length ? (
        <VeriYok
          kartsiz
          metin={'Bu turda “' + tur + '” türünde madde gelmedi; süzgeci “Tümü”ye alın.'}
        />
      ) : null}

      {durum === 'veri' && !eksik && suzulmus.length
        ? suzulmus.map((m, i) => <HaberSatiri key={(m.link || 'madde') + ':' + i} madde={m} />)
        : null}

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

/**
 * Tek çip. NEDEN AYRI: aynı gövde artık iki sırada basılıyor (sembol
 * seçimi ve tür süzgeci); iki kopya yarın biri seçim işaretini
 * değiştirdiğinde iki farklı davranış demekti.
 *
 * Seçim RENKLE DEĞİL işaretle de taşınıyor: aktif çipin önünde "•" var
 * (renk körü okunabilirliği) — davranış eski sembol çipinden AYNEN
 * taşındı, değiştirilmedi.
 */
function Cip({
  etiket,
  aktif,
  onSec,
}: {
  etiket: string;
  aktif: boolean;
  onSec: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onSec}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      style={[
        styles.cip,
        {
          backgroundColor: aktif ? colors.bgElevated : 'transparent',
          borderColor: aktif ? colors.borderStrong : colors.border,
        },
      ]}>
      <Text
        style={[
          aktif ? type.microBold : type.micro,
          { color: aktif ? colors.text : colors.textDim },
        ]}>
        {(aktif ? '• ' : '') + etiket}
      </Text>
    </Pressable>
  );
}
