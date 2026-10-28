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
//  NEDEN "piyasa nabzı" ARTIK BURADA: bu başlık eskiden "makro/nabız/
//  sektör ucu yok" diyordu. O ÖLÇÜM ESKİDİ — `/api/pulse` yazıldı ve
//  manşeti KENDİ tarıyor (ÖLÇÜLDÜ 2026-10-25, üretim: POST {q:'Fed
//  faiz'} → 200, `kaynak:'sunucu'`, `haberler.tam:true`, 960 ms).
//  Bu yüzden ⚡ Makro Nabız kartı açıldı.
//
//  HÂLÂ EKSİK OLAN (yalnız gerçekten eksik olan): ÖNE ÇIKAN SEKTÖR
//  kartının ucu (ÖLÇÜLDÜ: api/ altında score · recommend · analyze ·
//  theme · compare · causal · chart · news · pulse var; sektör ucu YOK).
//  Konjonktür FAZI ise ucu VAR ama GİRDİSİ yok: `/api/pulse`
//  `genislik`/`enflasyonBaskisi`/`risk` sayılarını çağırandan istiyor ve
//  bu uygulamada onları ölçen kaynak yok — uç `konjonktur: null` + hangi
//  girdinin eksik olduğunu döndürüyor, kart da bunu AÇIKÇA yazıyor.
//  Uydurma bir sayı göndermek tam olarak yasak olan şey: sahte veri.
//
//  NEDEN 📊 ENDEKS NABZI BURADA: büyük endekslerin günlük hareketi
//  "bugün" sorusunun ilk cevabı. Kartın KENDİ isteği YOK (components
//  içinde `fetch` yasak) — ölçümleri bu ekran `fetchChart` ile SIRAYLA
//  topluyor, çünkü uç TEK sembol alıyor (`cok_sembol`, azami 1); dört
//  çağrıyı aynı anda atmak istek fırtınası olurdu.
//
//  DESTEKLENMEYEN ENDEKSE AĞA GİDİLMİYOR (ÖLÇÜLDÜ 2026-10-26, kaynak
//  okuması): ortak sembol kapısı `SEMBOL_BICIM = /^[A-Z][A-Z0-9.\-]{0,7}$/`
//  (api/_girdi.js:79) `^` ve `=` KABUL ETMİYOR, yani `^GSPC` · `^IXIC` ·
//  `GC=F` kesin 400 `bad_symbol` alır; yalnız `XU100` geçer. Karar TEK
//  YERDE yazılı: `ENDEKS_NABIZ` kaleminin `destekli` bayrağı
//  (components/bugun/EndeksNabziKarti.tsx). Bu ekran o bayrağa bakıp
//  isteği atlıyor ve kalemi "ölçülemedi" ölçümü olarak kartta BASTIRIYOR
//  — satırı gizlemek "altın hareket etmedi" demek olurdu. Sunucu kapısı
//  açıldığında bu dosyada DEĞİŞİKLİK GEREKMEZ: bayrak `true` olur.
//
//  BURADA HESAP YOK: sıra, durum, skor10, duruş kodu, yönler, faz —
//  hepsi uç alanları. Nabız kartında da eşik/ortalama/işaret kararı
//  YOK; yalnız sabit kümeden Türkçe karşılık seçiliyor ve biçimleme
//  `lib/format.ts`e bırakılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_HABER_SORGU,
  fetchChart,
  fetchCompare,
  fetchNews,
  fetchPulse,
  haberOlcumEksik,
  useHazir,
  useIstek,
  useListe,
  type Adim,
  type ApiResult,
  type Aralik,
  type HaberMadde,
  type NabizSorguHaber,
  type SiraKayit,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Dugme,
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  OlcumEksikRozet,
  Pill,
  ScreenShell,
  VeriYok,
} from '@/components';
import {
  ENDEKS_NABIZ,
  EndeksNabziKarti,
  PiyasaGundemiKarti,
  type EndeksOlcum,
} from '@/components/bugun';
import { HaberSatiri } from '@/components/kesfet';
import { formatOran, formatScore } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

/** Yakınlık durumu — SABİT KÜME (motor), yalnız Türkçeye çevriliyor. */
const DURUM_METIN: Record<string, string> = {
  in: 'alım bandının içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

/**
 * Nabız duruş kodu → Türkçe. ÇEVİRİ, HESAP DEĞİL: kararı uç verdi
 * (`durus.kod`), burada eşik yok. Kod yine EKRANDA (rozette) duruyor ki
 * çeviri kararın üstünü örtmesin; küme büyürse kod olduğu gibi basılır.
 */
const NABIZ_METIN: Record<string, string> = {
  hawk: 'şahin — sıkılaşma yönünde manşet baskısı',
  dove: 'güvercin — gevşeme yönünde manşet baskısı',
  neu: 'nötr — belirgin bir yön yok',
};

/** Konjonktür fazı → Türkçe. Yine yalnız çeviri. */
const FAZ_METIN: Record<string, string> = {
  early: 'erken döngü',
  mid: 'orta döngü',
  late: 'geç döngü',
  recession: 'daralma',
};

/**
 * Nabız sorgusu. SABİT ve GÖRÜNÜR: kart altyazısında yazılı.
 *
 * NEDEN BİR SORGU GEREKİYOR: uç, manşeti kendi taraması için `q` (ya da
 * `semboller`) istiyor; hiçbiri gelmezse sunucu yolunu AÇMIYOR ve 400
 * dönüyor (api/pulse.js). Uç makro sorgularını (faiz/enflasyon) kendi
 * listesinden tarıyor — `q` o taramayı açan anahtar ve ek olarak kendisi
 * için de manşet okuyor; o ek manşetler DURUŞA GİRMİYOR (uç başlığı) ve
 * kartta ayrı, açıkça öyle yazılarak gösteriliyor.
 */
const NABIZ_SORGU = 'Fed faiz';

/**
 * 📊 Endeks Nabzı penceresi. SABİT ve GÖRÜNÜR (kart satırında `range/
 * interval` olduğu gibi yazılıyor). "Günlük hareket" sorusunun karşılığı
 * bu pencere: günlük mum = o günün açılışı → kapanışı. Pencere seçimi
 * bir GÖSTERGE AYARI DEĞİL, ucun `range` parametresi.
 */
const ENDEKS_ARALIK: Aralik = '1d';
const ENDEKS_ADIM: Adim = '1d';

/** Sıralı turun çıktısı — kartın `olcumler` + `turMs` props'ları. */
type EndeksTuru = { olcumler: EndeksOlcum[]; turMs: number };

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
      note="Öne çıkan sektör kartı için motor ucu henüz yok; uydurma kart konmadı.">
      <Card
        title="Fiyata yakınlık sırası"
        subtitle="Anahtar: alım bandına uzaklık — tipik günlük salınımın katı (motor kararı)"
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
                  onPress={() => router.push({ pathname: '/hisse/[sembol]', params: { sembol: s.sym } })}
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

      <EndeksNabziBolumu />

      <MakroNabizKarti />

      <TematikHaberKarti />

      {/* 📰 Gündem manşetleri: sembole bağlı DEĞİL — Keşfet'teki gündem
          kartı sembol başına çalışıyor, bu uç (`gundem=1`) sembolsüz.
          Kaynak başına ölçümü kendi içinde yazıyor. */}
      <PiyasaGundemiKarti />

      <Card title="Henüz ölçülmeyen kartlar" subtitle="Dürüst eksik listesi">
        <Text style={[type.small, { color: colors.textDim }]}>
          {"Öne çıkan sektör kartı için motor API'de uç yok; kart açılmadan önce ucunun " +
            'yazılması gerekiyor, o yüzden burada boş bırakıldı — yer tutucu sayı ' +
            'GÖSTERİLMİYOR. Konjonktür fazının ucu var ama girdisi yok: ⚡ Makro Nabız kartı ' +
            'ucun hangi girdiyi beklediğini olduğu gibi yazıyor.'}
        </Text>
      </Card>
    </ScreenShell>
  );
}

/**
 * 📊 ENDEKS NABZI — `/api/chart`, endeks başına BİR çağrı, SIRAYLA.
 *
 * NEDEN TEK `useIstek` İÇİNDE DÖRT ÇAĞRI DEĞİL DE DÖRT `useIstek`
 * DEĞİL: kart tek bir `durum` alıyor ve turun ÖLÇÜLEN süresini yazıyor;
 * dört kanca dört ayrı durum demekti ve "tur süresi" diye yazılacak bir
 * şey kalmazdı. Tur burada tek bir ölçüm: başı ve sonu var.
 *
 * NEDEN SIRAYLA (`for` döngüsü, `Promise.all` DEĞİL): uç tek sembol
 * alıyor (`cok_sembol`, azami 1) ve dördünü aynı anda atmak, ilk
 * açılışta dört dış kaynak isteği demekti.
 *
 * DESTEKLENMEYEN KALEME İSTEK ATILMIYOR: karar `destekli` bayrağında
 * (TEK yer, ekran başlığındaki ölçüm notu). O kalem için `{veri:null,
 * hata:null}` ölçümü basılıyor — kartın sözleşmesinde bu hâl "hiç
 * sorulmadı" demek ve "ölçtüm, boş geldi"den AYRI yazılıyor.
 *
 * BURADA HESAP YOK: ekran tek bir sayı türetmiyor. Yüzde değişimi kartın
 * kendisi künye aritmetiğiyle yazıyor (serinin iki ucu); eşik, ağırlık,
 * rozet kararı hiçbir yerde yok. `turMs` bir ÖLÇÜM (duvar saati farkı),
 * gösterge değil.
 *
 * İPTAL HATA DEĞİL: tur ortasında ekran kapanırsa `canceled` olduğu gibi
 * geri veriliyor; `useIstek` onu durum bozmadan yutuyor (istek.ts).
 * Yarım bir turu "ölçüm" diye kartta basmak eksik ölçümü tam ölçüm gibi
 * sunmak olurdu.
 */
function EndeksNabziBolumu() {
  const cagri = useCallback(async (signal: AbortSignal): Promise<ApiResult<EndeksTuru>> => {
    const basladi = Date.now();
    const olcumler: EndeksOlcum[] = [];

    for (const tanim of ENDEKS_NABIZ) {
      if (!tanim.destekli) {
        // AĞA GİTMİYORUZ: sembol biçimi ucun kapısından geçmiyor.
        olcumler.push({ key: tanim.key, veri: null, hata: null });
        continue;
      }
      const sonuc = await fetchChart(tanim.sembol, {
        range: ENDEKS_ARALIK,
        interval: ENDEKS_ADIM,
        market: tanim.pazar,
        signal,
      });
      if (sonuc.ok) {
        olcumler.push({ key: tanim.key, veri: sonuc.data, hata: null });
        continue;
      }
      if (sonuc.error.kind === 'canceled') return { ok: false, error: sonuc.error };
      // Bir endeksin düşmesi turu bitirmiyor: kalanı ölçülüp o satır
      // kendi hatasını yazıyor.
      olcumler.push({ key: tanim.key, veri: null, hata: sonuc.error });
    }

    return { ok: true, data: { olcumler, turMs: Date.now() - basladi } };
  }, []);

  const { durum, veri, hata, yenile } = useIstek(cagri, 'endeks-nabiz:' + ENDEKS_ARALIK);

  return (
    <EndeksNabziKarti
      olcumler={veri?.olcumler ?? []}
      durum={durum}
      hata={hata}
      yenile={yenile}
      turMs={veri?.turMs ?? null}
    />
  );
}

/**
 * ⚡ MAKRO NABIZ — `/api/pulse`.
 *
 * NEDEN AYRI İSTEK: kıyas turundan (compare) bağımsız. Manşet taraması
 * tek sembol silindiğinde yeniden çalışmasın, kıyas da besleme yavaş
 * olduğunda beklemesin diye kendi `useIstek`i var (Keşfet'teki Gündem
 * kartıyla aynı desen).
 *
 * NEDEN MANŞET GÖNDERMİYORUZ / NEDEN POST: `fetchPulse` başlığı.
 *
 * BURADA HESAP YOK: duruş kodu, yönler, baskı, faz, sektör kodları ve
 * manşet sayıları UÇTAN geliyor. İstemci yalnız sabit kümeden Türkçe
 * karşılık seçiyor ve sayıyı `formatOran` ile biçimliyor.
 *
 * `tam:false` VERİYİ GİZLEMEZ: rozet sayıların ÜSTÜNDE durur, duruş
 * yine çizilir — eksik manşetle hesaplanmış da olsa ÖLÇÜLMÜŞ bir cevap.
 */
function MakroNabizKarti() {
  const { colors } = useTheme();

  const cagri = useCallback((signal: AbortSignal) => fetchPulse(NABIZ_SORGU, { signal }), []);
  const { durum, veri, hata, yenile } = useIstek(cagri, 'nabiz:' + NABIZ_SORGU);

  const sorgular: NabizSorguHaber[] = veri?.haberler?.sorgu ?? [];

  return (
    <Card
      title="⚡ Makro Nabız"
      subtitle={'Faiz · enflasyon manşet duruşu · sorgu: “' + NABIZ_SORGU + '” · motor kararı'}
      right={
        durum === 'veri' && veri ? (
          // `kaynak` DÜRÜSTÇE GÖRÜNÜR: manşeti kim topladı. Bu istemci
          // RSS tarayamadığı için 'sunucu' bekleniyor, ama yazan değer
          // cevaptan okunuyor — varsayılmıyor.
          <Pill label={'kaynak: ' + veri.kaynak} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Nabız ölçümü istenmedi."
      />

      {/* Rozet VERİNİN ÜSTÜNDE: eksik ölçümü sayıları okuduktan SONRA
          öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu.
          Haber sayacı şekli skor sayacından farklı — ayrı rozet. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri.haberler} /> : null}

      {durum === 'veri' && veri ? (
        <View style={styles.nabiz}>
          <View style={styles.ust}>
            {/* Makine kodu da ekranda: çeviri kararın üstünü örtmesin. */}
            <Pill label={veri.durus.kod} tone="info" glyph={null} size="sm" />
            <Text style={[type.small, { color: colors.text, flex: 1 }]}>
              {NABIZ_METIN[veri.durus.kod] ?? 'motor kodu: ' + veri.durus.kod}
            </Text>
          </View>

          {/* HAM SAYILAR: -1..+1 arası motor çıktısı, yüzdeye
              ÇEVRİLMİYOR (uç başlığı: HAM SAYI kuralı). */}
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Faiz yönü ' +
              formatOran(veri.durus.faizYon) +
              '   ·   Enflasyon yönü ' +
              formatOran(veri.durus.enflasyonYon) +
              '   ·   Baskı ' +
              formatOran(veri.durus.baski)}
          </Text>

          {/* `degerlendirilen` NESNE: {faiz, enflasyon}. Tek sayı sanıp
              basmak ekrana "[object Object]" yazdırırdı. */}
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Duruşa giren taze manşet — faiz ' +
              veri.degerlendirilen.faiz +
              ' · enflasyon ' +
              veri.degerlendirilen.enflasyon +
              '   (son 2 gün: faiz ' +
              veri.taze.faiz2g +
              ' · enflasyon ' +
              veri.taze.enflasyon2g +
              ')'}
          </Text>

          {/* Eğilim listeleri MAKİNE SEKTÖR KODLARI (motor), Türkçe
              etiket tele çıkmıyor — olduğu gibi basılıyor. */}
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Duruşla yukarı eğilimli sektör kodları: ' +
              (veri.durus.egilimYukari.join(', ') || 'yok')}
          </Text>
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Duruşla aşağı eğilimli sektör kodları: ' +
              (veri.durus.egilimAsagi.join(', ') || 'yok')}
          </Text>

          {veri.konjonktur ? (
            <>
              <View style={styles.ust}>
                <Pill label={veri.konjonktur.faz} tone="info" glyph={null} size="sm" />
                <Text style={[type.small, { color: colors.text, flex: 1 }]}>
                  {FAZ_METIN[veri.konjonktur.faz] ?? 'motor kodu: ' + veri.konjonktur.faz}
                </Text>
              </View>
              <Text style={[type.micro, { color: colors.textDim }]}>
                {'Boyutlar — faiz ' +
                  formatOran(veri.konjonktur.boyutlar.rate) +
                  ' · enflasyon ' +
                  formatOran(veri.konjonktur.boyutlar.infl) +
                  ' · büyüme ' +
                  formatOran(veri.konjonktur.boyutlar.growth) +
                  ' · risk ' +
                  formatOran(veri.konjonktur.boyutlar.risk)}
              </Text>
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Fazın sektör kodları: ' + (veri.konjonktur.sektorler.join(', ') || 'yok')}
              </Text>
            </>
          ) : (
            // ÖLÇÜLMEDİ, ARIZA DEĞİL: ucun beklediği girdiyi UÇ söylüyor
            // (`eksik`), biz bir liste uydurmuyoruz.
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Konjonktür fazı ÖLÇÜLMEDİ — uç şu girdileri bekliyor: ' +
                (veri.eksik.join(', ') || 'bildirilmedi') +
                '. Bu uygulamada bu girdileri ölçen bir kaynak yok; uydurma sayı gönderilmiyor.'}
            </Text>
          )}

          {/* Çağıranın `q` sorgusu için okunan manşetler: DURUŞ
              MATEMATİĞİNE GİRMİYOR (uç başlığı). Sayı UÇTAN (`adet`);
              burada yeniden sayılmıyor. */}
          {sorgular.length ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Sorgu için okunan ek manşet (duruşa girmiyor): ' +
                sorgular.map((q) => q.sorgu + ' · ' + q.market + ' · ' + q.adet).join('   |   ')}
            </Text>
          ) : null}

          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Pencere: ' +
              veri.pencere.gun +
              ' gün · tazelik ' +
              veri.pencere.tazelikSaat +
              ' sa (ağırlık ' +
              formatOran(veri.pencere.tazelikAgirlik) +
              ') · motor ' +
              veri.surum.motor +
              ' · ' +
              veri.ms +
              ' ms'}
          </Text>
        </View>
      ) : null}

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

/**
 * 🔭 TEMATİK HABER BAŞLIĞI ARAMA — `/api/news`.
 *
 * NE: tema yazılır, uç o temayla manşet tarar; satırlar olduğu gibi
 * basılır. Alt düğme AYNI temayı 🔎 Arama ekranındaki 🔭 tematik keşifte
 * açar (iki yüzey köprüsü: `/arama` + `tema` parametresi).
 *
 * NEDEN AYRI İSTEK (kıyas/nabız turundan bağımsız): kullanıcı tema
 * yazdıkça kıyas sırası ya da nabız yeniden çekilmesin; tersi de geçerli
 * (⚡ Makro Nabız kartıyla aynı gerekçe).
 *
 * NEDEN HİSSE EŞLEŞTİRMESİ YOK: ÖLÇÜLDÜ 2026-10-25 — `/api/theme`
 * cevabı yalnız `{symbol, market, name, reason}` taşıyor, `/api/news`
 * cevabı da yalnız manşet maddeleri; HİÇBİRİ "bu manşet şu hisseyi
 * destekliyor" ilişkisini VERMİYOR. Bu ilişkiyi burada başlık metninde
 * sembol/şirket adı arayarak kurmak İSTEMCİDE HESAP olurdu (native
 * tarafta yasak) — o yüzden bu ekran yalnız başlıkları basıyor, eşleşme
 * iddiası etmiyor ve bunu kart altında AÇIKÇA yazıyor. Eşleşmeyi uç
 * verirse (öneri raporda) burada gösterilir.
 *
 * BURADA HESAP YOK: manşet sayısı (`adet`), sayaçlar ve tarihler uçtan;
 * tarih biçimlemesi `lib/format.ts`e ait.
 */
function TematikHaberKarti() {
  const { colors } = useTheme();

  // Gelen `tema` parametresi: 🔎 Arama ekranındaki 🔭 tematik keşiften
  // bu ekrana köprü kurulduğunda alan ONUNLA DOLUYOR ve arama kendi
  // kendine koşuyor — kullanıcı aynı temayı iki kez yazmasın.
  const params = useLocalSearchParams<{ tema?: string }>();
  const gelenTema = (params.tema ?? '').trim().slice(0, AZAMI_HABER_SORGU);

  const [metin, setMetin] = useState(gelenTema);
  const [sorgu, setSorgu] = useState(gelenTema);
  // Parametre DEĞİŞTİĞİNDE (aynı ekran açıkken yeni tema geldiğinde)
  // alanı yenilemek için son görülen değeri tutuyoruz. `useEffect`
  // yerine bu: efektle yazmak bir kare eski metni gösterirdi.
  const [sonGelen, setSonGelen] = useState(gelenTema);
  if (gelenTema && gelenTema !== sonGelen) {
    setSonGelen(gelenTema);
    setMetin(gelenTema);
    setSorgu(gelenTema);
  }

  const cagri = useCallback(
    (signal: AbortSignal) => fetchNews(sorgu, { market: 'TR', signal }),
    [sorgu],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'tema-haber:' + sorgu, {
    etkin: sorgu.length > 0,
  });

  const maddeler: HaberMadde[] = veri?.maddeler ?? [];
  const eksik = haberOlcumEksik(veri ?? null);

  return (
    <Card
      title="🔭 Tematik haber başlığı ara"
      subtitle="Tema yaz, manşetleri gör — ilişkili hisseler için 🔎 Arama'daki tematik keşif">
      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder="Tema: ör. savunma sanayi, veri merkezi, nükleer enerji"
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        maxLength={AZAMI_HABER_SORGU}
        returnKeyType="search"
        onSubmitEditing={() => setSorgu(metin.trim())}
        accessibilityLabel="Tematik haber başlığı arama alanı"
        style={[
          styles.alan,
          type.body,
          { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
      />
      <View style={styles.dugmeler}>
        <Dugme label="Başlık ara" onPress={() => setSorgu(metin.trim())} disabled={!metin.trim()} />
        <Dugme
          label="🔭 Tematik keşifte aç"
          variant="outline"
          tone="info"
          // AYNI TEMA, AYNI PARAMETRE: Arama ekranı `tema`yı okuyup
          // 🔭 keşfi (`/api/theme`) o temayla koşturuyor.
          onPress={() => router.navigate({ pathname: '/arama', params: { tema: metin.trim() } })}
          disabled={!metin.trim()}
        />
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Bir tema yaz ve 'Başlık ara'ya bas."
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri ? (
        eksik ? (
          // ÖLÇEMEDİM ≠ "haber yok": ucun kendi bildirdiği eksik.
          <OlcemedimKutu
            metin={
              'Manşet taraması TAMAMLANMADI — ' +
              (veri.uyari ?? 'uç tam tarama bildirmedi') +
              '. Aşağıdaki başlıklar gelenlerin tamamı değil.'
            }
            yenile={yenile}
          />
        ) : null
      ) : null}

      {durum === 'veri' && veri && veri.adet === 0 && !eksik ? (
        <VeriYok metin={'“' + sorgu + '” için uç manşet bulamadı — bu da ÖLÇÜLMÜŞ bir cevap.'} />
      ) : null}

      {durum === 'veri' && maddeler.length ? (
        <View style={styles.haberler}>
          {maddeler.map((m, i) => (
            <HaberSatiri key={(m.link || '') + '#' + i} madde={m} />
          ))}
        </View>
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          {'Uç ' + veri.adet + ' manşet döndü · sorgu “' + veri.q + '” · ' + veri.market +
            ' · ' + veri.ms + ' ms'}
        </Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
        {'Bu liste TEMANIN manşetleri — hangi manşetin hangi hisseyi desteklediği UÇTAN ' +
          'GELMİYOR, o yüzden burada hisse eşleştirmesi iddia edilmiyor. Temayla ilişkili ' +
          'hisseler için “🔭 Tematik keşifte aç”a bas.'}
      </Text>

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  kaydir: { maxHeight: 320 },
  nabiz: { gap: space.xs, paddingTop: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xs },
  sira: {
    ...type.small,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notlar: { gap: space.xs, marginTop: space.sm },
  // 🔭 tematik haber kartı — SALT SUNUM ölçüleri (Arama ekranındaki
  // arama alanıyla aynı: aynı iş aynı görünsün).
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  dugmeler: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', paddingTop: space.sm },
  haberler: { paddingTop: space.xs },
});
