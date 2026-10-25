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
//  BURADA HESAP YOK: sıra, durum, skor10, duruş kodu, yönler, faz —
//  hepsi uç alanları. Nabız kartında da eşik/ortalama/işaret kararı
//  YOK; yalnız sabit kümeden Türkçe karşılık seçiliyor ve biçimleme
//  `lib/format.ts`e bırakılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  fetchCompare,
  fetchPulse,
  useHazir,
  useIstek,
  useListe,
  type NabizSorguHaber,
  type SiraKayit,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Durum,
  HaberOlcumEksikRozet,
  OlcumEksikRozet,
  Pill,
  ScreenShell,
  VeriYok,
} from '@/components';
import { formatOran, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

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

      <MakroNabizKarti />

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
});
