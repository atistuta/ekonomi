// =====================================================================
//  ANALİZ — 4. sekme, MOTORA BAĞLI                    (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: tek sembol derin dalış: /api/analyze → TA + FA + bileşke skor +
//  bütüncül skor (0-10) + üç direk + plan seviyeleri + risk/ödül.
//
//  NEDEN /api/analyze: sözleşme iç içe (score ⊂ recommend ⊂ analyze);
//  derin dalış için gereken HER alan tek turda geliyor. Üç ayrı uç
//  çağırmak üç ayrı anlık görüntüyü yan yana koymak olurdu — fiyat bir
//  turdan, skor başka turdan gelirse ekran kendi içinde çelişir.
//
//  BURADA HESAP YOK — EN KRİTİK EKRAN BU:
//    · skor10 uçtan gelir; direklerin ağırlıklı toplamı İSTEMCİDE
//      YENİDEN HESAPLANMAZ (yuvarlama bile motorun işi).
//    · blendedShown motorun gösterdiği tam sayıdır; blended'den
//      yuvarlama yapılmaz.
//    · Bantlar (band, faKarar.label) metin olarak basılır, eşik
//      tablosu istemcide YOK.
//    · breakdown ağırlıkları yalnız GÖSTERİLİR, çarpılıp toplanmaz.
//
//  NEDEN SEMBOL SEÇİCİ TAKİP LİSTESİNDEN: serbest metin girişi Arama
//  sekmesinin işi (5 menü düzeni korunuyor); burada liste + Listeler/
//  Bugün/Keşfet'ten gelen sym parametresi var.
//
//  GRAFİK ARTIK VAR: `/api/chart` yazıldı ve ÖLÇÜLDÜ (2026-10-24,
//  üretim): ?symbol=AAPL&range=1mo → 200, adet 22, tam true.
//  Bu yüzden eski "fiyat serisi döndüren uç YOK" notu düştü.
//
//  NEDEN İKİNCİ BİR İSTEK: grafik /api/analyze'dan GELMİYOR, ayrı uç.
//  Aynı `useIstek` ile ikinci çağrı atılıyor çünkü aralık (1mo…5y)
//  kullanıcı elinde ve her değişiklikte analizi baştan ölçmek 45-55
//  saniyelik skor turunu boşa tekrarlardı. Grafik ucu tek dış istekle
//  262 ms döndü — ayrı tutmak ucuz.
//
//  NEDEN GRAFİK İSTEĞİ EKRANDA, KOMPONENTTE DEĞİL: proje kuralı
//  "ekranlar ister, komponentler çizer" (`components/` içinde `fetch`
//  yok). `FiyatGrafigi` saf sunum: durum/veri/hata props'tan gelir.
//
//  ÜÇ LİSTE KARTI DAHA (⚖️ Karşılaştır · 📅 Bilanço · 💰 Temettü):
//  bunlar TEK sembolün değil TAKİP LİSTESİNİN kartları ve ayrı uçlardan
//  besleniyor — `/api/compare` (sıralama) ve `/api/yfin` (künye). Üçü de
//  derin dalışın ALTINDA, çünkü seçilen sembolün dökümü ekranın konusu;
//  liste karşılaştırması bağlamı.
//
//  NEDEN BİLANÇO VE TEMETTÜ TEK İSTEK PAYLAŞIYOR: ikisi de aynı
//  `/api/yfin` künyesinin farklı alanlarını okuyor (`earnings` ve
//  `dividendYield`). İki istek atmak aynı veri için iki kez ödemek ve
//  iki kartın farklı anlık görüntü göstermesi riskiydi.
//
//  NEDEN AYRI İSTEKLER (analizden bağımsız): analiz turu 45-55 sn,
//  compare/yfin saniyeler. Biri düşerken öteki durabilir ve ekranda
//  AYRI anlatılmalı — tek `durum` üçünü birbirine bağlardı.
//
//  BURADA DA HESAP YOK: `dividendYield` 0-1 ORANI olarak geliyor ve
//  `formatOran` ile basılıyor; 100 ile çarpıp "%" yazmak ölçek
//  değiştirmek olurdu (motorun işi). Bilanço tarihi uçtan gelen unix
//  saniye; "kaç gün kaldı" sayacı YOK — cihaz saatiyle motor damgasını
//  karıştırmak ölçüm uydurmaktır.
//
//  İKİ KART DAHA (₿ Kripto · 🥇 Kıymetli maden): web'in `renderCrypto`
//  ve `renderMetals` blokları. Bunlar seçilen sembolden BAĞIMSIZ sabit
//  evrenler, o yüzden EN ALTTA ve AYRI isteklerle. Liste künyesine
//  eklenmediler çünkü künye ucu 12 sembolden fazlasını SESSİZCE kırpıyor
//  — takip listesi + 10 kripto + 3 maden tek turda sınırı aşardı ve
//  kırpılan sembol kullanıcıya "veri yok" gibi görünürdü.
//
//  BU İKİ KARTTA UÇ YOK DİYE YAPILMAYANLAR: 24s değişim, piyasa değeri
//  sırası, hacim, BTC hâkimiyeti, arz, zirve uzaklığı (web'de CoinGecko
//  ham geçişinden geliyordu) ve TL/gram maden fiyatları + ziynet
//  kalemleri (truncgil ham geçişi). Ham geçiş bir SÖZLEŞME değil;
//  ölçülmeyen alan çizilmiyor, istemcide türetilmiyor.
//
//  ── 🏭 SEKTÖR → ⚖️ KARŞILAŞTIR KÖPRÜSÜ ────────────────────────────
//  Keşfet'teki 🏭 Sektör dağılımı kartı bir grubun sembollerini `kiyas`
//  yol parametresiyle (virgülle ayrık) BU ekrana taşıyor; parametre
//  varsa ⚖️ Karşılaştır turu TAKİP LİSTESİ yerine O SEMBOLLERLE
//  koşuyor. Yeni sekme açılmadı, yeni uç çağrılmadı, ikinci bir tur
//  eklenmedi — AYNI `/api/compare` turunun girdisi değişiyor.
//
//  SINIR SESSİZ KIRPILMIYOR: `/api/compare` bir turda en çok
//  `AZAMI_SEMBOL` sembol alıyor ve fazlasını 400 ile REDDEDİYOR
//  (api/client.ts `sembolUcu`). Gelen küme büyükse ilk `AZAMI_SEMBOL`
//  sorulup DIŞARIDA KALAN SAYI EKRANA YAZILIYOR.
//
//  KÜNYE TURU LİSTENİN: temel metrik tablosu `/api/yfin` turundan
//  geliyor ve o tur TAKİP LİSTESİYLE koşuyor (Bilanço + Temettü da aynı
//  turu paylaşıyor). İkinci bir künye turu açmak aynı veriyi iki kez
//  sormak olurdu; bu yüzden tablo taşınan kümeden GENİŞ olabilir ve
//  bunu kart üstündeki not AÇIKÇA yazıyor.
//
//  ── SIRALAMA KURALI (TASARIM TURU 2) ───────────────────────────────
//  1) Seçimin kendisi (Sembol kartı)
//  2) Seçilen sembolün ölçümü: grafik (hızlı uç) → skorlar (yavaş tur)
//  3) Liste genişliğindeki turlar: kıyas · bilanço · temettü
//  4) Seçilen sembolle İLGİSİZ sabit evrenler: kripto · maden (EN ALTTA)
//  ÖLÇÜLDÜ 2026-10-31: sıra ZATEN bu; hiçbir kart taşınmadı. Grafiğin
//  skorlardan önce gelme gerekçesi (262 ms ↔ 45-55 sn) KORUNDU —
//  "karar önce" kuralı o ölçümü ezmiyor. Bölüm başlıkları eklendi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AZAMI_SEMBOL,
  VARSAYILAN_ARALIK,
  fetchAnalyze,
  fetchChart,
  fetchCompare,
  fetchYfin,
  useIstek,
  useKiyas,
  useListe,
  type AnalyzeRow,
  type Aralik,
  type Direk,
  type PlanSeviye,
  type Vade,
} from '@/api';
import {
  BolumBasligi,
  Card,
  Dugme,
  Durum,
  FiyatGrafigi,
  OlcumEksikRozet,
  Pill,
  ScoreGauge,
  ScreenShell,
  VadeSecici,
  VeriYok,
} from '@/components';
import {
  BilancoKart,
  KRIPTO_SEMBOLLER,
  KarsilastirKart,
  KriptoKart,
  METAL_SEMBOLLER,
  MaliTablolarKart,
  MetalKart,
  TemettuKart,
  TezDefteriKart,
} from '@/components/analiz';
import { formatOran, formatPercent, formatPrice, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/** Direk kodları — SABİT KÜME (motor). Yalnız etiket çevirisi. */
const DIREK_METIN: Record<string, string> = {
  value: 'Değer',
  quality: 'Kalite',
  growth: 'Büyüme',
  momentum: 'Momentum',
  risk: 'Risk',
};

export default function AnalizScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  // KIYAS SETI (`sb:compare`): detay ekranindaki "Karsilastirmaya
  // ekle" dugmesinin yazdigi KALICI kume. Oncelik sirasi EKRANDA
  // yazili: ① `?kiyas=` koprusu (acik gezinme) ② kalici set
  // ③ takip listesi. Ucuncu basamak eski davranis.
  const kiyasSeti = useKiyas();
  const params = useLocalSearchParams<{ sym?: string; kiyas?: string }>();
  const [secili, setSecili] = useState<string | null>(null);

  const sembol = useMemo(() => {
    const p = typeof params.sym === 'string' ? params.sym.toUpperCase() : null;
    return secili ?? p ?? liste[0] ?? null;
  }, [secili, params.sym, liste]);

  // VADE: motorun DÖRT penceresi (gunici · kisa · orta · uzun) native'de
  // 'orta'ya SABİTLENMİŞTİ; üçü ekrana hiç ulaşmıyordu. Varsayılan
  // 'orta' — seçim yapılmadığında eski davranış birebir aynı.
  //
  // TEK DURUM, İKİ TUR: analiz turu da kıyas turu da AYNI vadeyi
  // kullanıyor. İkisine ayrı seçici koymak, aynı ekranda iki farklı
  // pencereden gelen sayıları yan yana göstermek olurdu.
  const [vade, setVade] = useState<Vade>('orta');

  const cagri = useCallback(
    (signal: AbortSignal) => fetchAnalyze(sembol ? [sembol] : [], { vade, signal }),
    [sembol, vade],
  );
  // ANAHTAR VADEYİ TAŞIYOR (zorunlu): çıplak `sembol` anahtarı vade
  // değiştiğinde önceki vadenin önbellekli satırını basardı.
  const { durum, veri, hata, yenile } = useIstek(cagri, (sembol ?? '') + '|' + vade, {
    etkin: Boolean(sembol),
  });

  const satir: AnalyzeRow | null = veri?.sonuclar?.[0] ?? null;

  // ── GRAFİK: ayrı uç, ayrı istek, kullanıcı elinde aralık ──────────
  // NEDEN ENDEKS SÜZGECİ: `/api/chart` '^' ile başlayan sembolü 400
  // `bad_symbol` ile reddediyor (ÖLÇÜLDÜ: ?symbol=^GSPC). İstemci de
  // denemesin diye istek burada kapatılıyor — kırmızı kutu yerine hiç
  // sorulmamış grafik.
  const [aralik, setAralik] = useState<Aralik>(VARSAYILAN_ARALIK);
  const grafiklenebilir = Boolean(sembol) && !(sembol ?? '').startsWith('^');
  const grafikCagri = useCallback(
    (signal: AbortSignal) =>
      fetchChart(sembol ?? '', { range: aralik, interval: '1d', signal }),
    [sembol, aralik],
  );
  const grafik = useIstek(grafikCagri, (sembol ?? '') + '|' + aralik, {
    etkin: grafiklenebilir,
  });

  // ── LİSTE KARTLARI: iki ayrı uç, ikisi de takip listesinin tamamı ──
  // NEDEN `liste` ANAHTARI: liste değişmedikçe yeniden sorulmuyor;
  // sembol seçimi bu iki turu TETİKLEMİYOR (seçim tek sembolün dökümünü
  // değiştirir, listeyi değiştirmez).
  //
  // 🏭 SEKTÖR KÖPRÜSÜ: `kiyas` parametresi varsa kıyas turu O SEMBOLLERLE
  // koşuyor. Parametre YOKSA davranış eskisi gibi (takip listesi).
  const gelenKiyas = useMemo(() => {
    const ham = typeof params.kiyas === 'string' ? params.kiyas : '';
    return ham
      .split(',')
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
  }, [params.kiyas]);
  const depoKiyas = useMemo(
    () => kiyasSeti.map((k) => k.symbol).filter(Boolean),
    [kiyasSeti],
  );
  const kiyasListesi = useMemo(() => {
    if (gelenKiyas.length) return gelenKiyas.slice(0, AZAMI_SEMBOL);
    if (depoKiyas.length) return depoKiyas.slice(0, AZAMI_SEMBOL);
    return liste;
  }, [gelenKiyas, depoKiyas, liste]);
  // Kume NEREDEN geldi: cumleyi ekranda somut yapmak icin.
  const kiyasKaynak: 'kopru' | 'set' | 'liste' = gelenKiyas.length
    ? 'kopru'
    : depoKiyas.length
      ? 'set'
      : 'liste';
  // Kırpılan sembol sayısı: GİZLENMİYOR, kartın üstünde yazıyor.
  // Kırpma HANGİ kaynaktan gelirse gelsin sayılıyor: kalıcı kıyas
  // seti de (8 slot) uç sınırının (AZAMI_SEMBOL) üstüne çıkabilir.
  const kiyasHam = kiyasKaynak === 'kopru' ? gelenKiyas.length : depoKiyas.length;
  const kiyasDisarida =
    kiyasKaynak !== 'liste' && kiyasHam > AZAMI_SEMBOL ? kiyasHam - AZAMI_SEMBOL : 0;

  const karsilastirCagri = useCallback(
    (signal: AbortSignal) => fetchCompare(kiyasListesi, { vade, signal }),
    [kiyasListesi, vade],
  );
  const karsilastir = useIstek(
    karsilastirCagri,
    'compare:' + kiyasListesi.join(',') + '|' + vade,
    { etkin: kiyasListesi.length > 0 },
  );

  // TEK yfin turu, İKİ kart: Bilanço `earnings`, Temettü `dividendYield`
  // okuyor. `deep` varsayılan açık — `earnings` yalnız onunla geliyor.
  const kunyeCagri = useCallback(
    (signal: AbortSignal) => fetchYfin(liste, { signal }),
    [liste],
  );
  const kunye = useIstek(kunyeCagri, 'yfin:' + liste.join(','), { etkin: liste.length > 0 });

  // ── KRİPTO + MADEN: SABİT evrenler, takip listesine BAĞLI DEĞİL ────
  // NEDEN AYRI İKİ İSTEK (liste künyesiyle birleşmedi): künye ucu en
  // çok 12 sembol alıyor ve fazlasını SESSİZCE kırpıyor
  // (`api/_yfin.js` → `.slice(0, 12)`). Takip listesi + 10 kripto + 3
  // maden tek turda 12'yi aşar ve kırpılan sembol kullanıcıya "veri
  // yok" gibi görünürdü. Üç ayrı tur, üç ayrı durum kutusu.
  //
  // NEDEN `deep: false`: `deep=1` yalnız `calendarEvents` +
  // `earningsTrend` modüllerini ekliyor (bilanço takvimi). Kriptoda ve
  // vadeli maden sözleşmesinde bilanço YOK — iki modülü boşuna
  // istemek her turda gereksiz dış çağrı demekti.
  const kriptoCagri = useCallback(
    (signal: AbortSignal) => fetchYfin(KRIPTO_SEMBOLLER.slice(), { deep: false, signal }),
    [],
  );
  const kripto = useIstek(kriptoCagri, 'yfin:kripto');

  const metalCagri = useCallback(
    (signal: AbortSignal) => fetchYfin(METAL_SEMBOLLER.slice(), { deep: false, signal }),
    [],
  );
  const metal = useIstek(metalCagri, 'yfin:metal');

  return (
    <ScreenShell
      title="Analiz"
      subtitle="Tek hisse derin dalış — tüm skorlar motor API'den."
      note="Fiyat grafiği /api/chart ucundan gelir; çizim sunum katmanıdır, gösterge hesabı motorda.">
      <Card title="Sembol" subtitle="Takip listesinden seç (serbest arama: Arama sekmesi)">
        <View style={styles.secici}>
          {liste.map((s) => (
            <Dugme
              key={s}
              label={s}
              size="sm"
              variant={s === sembol ? 'solid' : 'outline'}
              tone={s === sembol ? 'gold' : 'neutral'}
              onPress={() => setSecili(s)}
            />
          ))}
        </View>
        {/* TASARIM TURU 2 — TEK GÖRSEL BİÇİM: bu cümle ham `<Text>`ti,
            oysa AYNI cümle Bugün ve Keşfet'te `Durum`un `bosMetin`i
            olarak, yani `VeriYok` gövdesinde çiziliyor. Aynı bilgi iki
            ayrı görünümdeydi. `kartsiz`: gövde zaten bir `Card` içinde.
            ÜÇ DAL KARIŞTIRILMADI — bu dal "liste boş" (kullanıcı henüz
            sembol eklemedi); "uç göndermedi" ve "ölçülemedi" dalları
            aşağıdaki `Durum`/`VeriYok` çağrılarında AYRI duruyor. */}
        {!liste.length ? (
          <VeriYok metin="Takip listesi boş. Arama sekmesinden sembol ekle." kartsiz />
        ) : null}
      </Card>

      {/* VADE SEÇİCİ: sembol kartının HEMEN ALTINDA, çünkü ekranın iki
          girdisi var (hangi sembol · hangi pencere) ve ikisi de ölçüm
          başlamadan önce seçiliyor. Hem derin dalış hem kıyas turu bu
          seçimi kullanıyor. */}
      <Card
        title="Vade"
        subtitle="Motorun hangi penceresi sorulacak — derin dalış ve ⚖️ Karşılaştır turu bu seçimle koşuyor.">
        <VadeSecici deger={vade} onDegis={setVade} />
      </Card>

      <BolumBasligi
        baslik="Seçilen sembolün ölçümü"
        kunye="Grafik hızlı uçtan, skorlar yavaş turdan; ikisi AYRI ölçüm."
      />

      {/* NEDEN SKOR KARTLARINDAN ÖNCE: grafik ucu 262 ms, analiz turu
          45-55 sn. Grafiği aşağıya koymak, hızlı gelen veriyi yavaş
          olanın arkasında bekletmek olurdu. Sembol seçicinin hemen
          altında, çünkü seçilen sembolün ilk somut karşılığı bu. */}
      {grafiklenebilir ? (
        <FiyatGrafigi
          sembol={sembol ?? ''}
          market={satir?.market}
          durum={grafik.durum}
          veri={grafik.veri}
          hata={grafik.hata}
          yenile={grafik.yenile}
          aralik={aralik}
          onAralik={setAralik}
          // MOTORUN BANDI, İSTEMCİNİN DEĞİL: `plan.seviye.buyZone` /
          // `sellZone` sözleşmede VAR (api/types.ts:228-229, `PlanSeviye`)
          // ve bu ekran onu ZATEN aynı turdan okuyor. Burada bir eşik
          // hesaplanmıyor, alan OLDUĞU GİBİ geçiliyor; `plan.seviye`
          // yoksa `null` gidiyor ve grafik şeridi HİÇ çizilmiyor —
          // olmayan bandı çizmek uydurma olurdu.
          bant={
            satir?.plan?.seviye
              ? {
                  buyZone: satir.plan.seviye.buyZone,
                  sellZone: satir.plan.seviye.sellZone,
                }
              : null
          }
        />
      ) : null}

      {/* NEDEN `sekil="skor"`: bu ekranın beklediği içerik üç `ScoreGauge`
          (sayı + bant + çubuk), liste satırı DEĞİL. Eskiden burada satır
          iskeleti vardı: iskelet "fiyat listesi gelecek" diyor, sonra
          skor kartı yerleşiyordu — hem söz yalan hem düzen sıçraması.
          Üç parça, kartın gerçek sayısı. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="skor"
        bosMetin="Bir sembol seç; ölçüm o zaman istenecek."
      />

      {durum === 'veri' ? (
        satir ? (
          <>
            <Card
              title={satir.sym}
              subtitle={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD piyasası'}
              right={
                <Pill
                  label={formatPrice(
                    satir.plan?.seviye?.price ?? satir.fa.price,
                    satir.market === 'BIST' ? 'TRY' : null,
                  )}
                  tone="info"
                  glyph={null}
                  size="sm"
                />
              }>
              {/* Eksik ölçüm rozeti SKORLARIN ÜSTÜNDE: `tam:false` ile
                  gelen bir skoru önce gösterip altına künye düşmek,
                  eksik ölçümü tam ölçüm gibi sunmaktı. */}
              <OlcumEksikRozet kaynak={satir} />
              <ScoreGauge
                score={satir.ta.score}
                caption="Teknik"
                band={satir.ta.label ?? undefined}
              />
              <ScoreGauge score={satir.fa.score} caption="Temel" />
              <ScoreGauge
                score={satir.composite.blendedShown}
                caption="Bileşke"
                band={satir.composite.band ?? undefined}
              />
              {satir.ta.score === null && satir.ta.why ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Teknik ölçülemedi: ' + satir.ta.why}
                </Text>
              ) : null}
              {satir.fa.score === null && satir.fa.why ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Temel ölçülemedi: ' + satir.fa.why}
                </Text>
              ) : null}
            </Card>

            <Card
              title="Bütüncül skor"
              subtitle="0-10 · motorun hesabı, istemci yeniden toplamaz"
              right={
                satir.analiz?.faKarar ? (
                  <Pill label={satir.analiz.faKarar.label} tone="gold" glyph={null} size="sm" />
                ) : null
              }>
              <Text style={[type.display, { color: colors.text }]}>
                {formatScore(satir.analiz?.butunculluk?.skor10) + ' / 10'}
              </Text>
              {satir.analiz?.butunculluk?.band ? (
                <Text style={[type.small, { color: colors.textDim }]}>
                  {satir.analiz.butunculluk.band.l}
                </Text>
              ) : (
                <Text style={[type.small, { color: colors.textDim }]}>Bant ölçülemedi.</Text>
              )}
              {(satir.analiz?.butunculluk?.direkler ?? []).map((d: Direk) => (
                <View key={d.k} style={styles.direk}>
                  <Text style={[type.small, { color: colors.text }]}>{DIREK_METIN[d.k] ?? d.k}</Text>
                  <Text style={[type.small, { color: colors.textDim }]}>
                    {formatOran(d.v) +
                      '  · ağırlık ' +
                      formatOran(d.w) +
                      (d.conf ? '' : '  (düşük güven)')}
                  </Text>
                </View>
              ))}
            </Card>

            {satir.plan?.seviye ? <SeviyeKart seviye={satir.plan.seviye} satir={satir} /> : null}

            {satir.plan?.riskOdul ? (
              <Card title="Risk / ödül" subtitle="Yalnız mesafe oranı — OLASILIK DEĞİL">
                <Text style={[type.small, { color: colors.text }]}>
                  {'▲ kâr-al mesafesi ' + formatPercent(satir.plan.riskOdul.sellUpPct)}
                </Text>
                <Text style={[type.small, { color: colors.text }]}>
                  {'▼ kırılma mesafesi ' + formatPercent(satir.plan.riskOdul.brkPct)}
                </Text>
                <Text style={[type.small, { color: colors.textDim }]}>
                  {'Oran: ' +
                    (typeof satir.plan.riskOdul.rrRatio === 'number'
                      ? satir.plan.riskOdul.rrRatio.toFixed(1) + '× (1 riske kaç ödül)'
                      : 'ölçülemedi')}
                </Text>
              </Card>
            ) : null}

            {satir.ta.breakdown?.length ? <TaDokum satir={satir} /> : null}
          </>
        ) : (
          <VeriYok metin={(sembol ?? 'Sembol') + ' için motor sonuç döndürmedi.'} />
        )
      ) : null}

      {/* 📊 MALİ TABLOLAR — SEÇİLEN SEMBOLÜN ölçümü, bu yüzden liste
          turlarının ÜSTÜNDE. Kendi isteğini kendi atıyor (kalıp:
          `detay/IceridenKart.tsx`); derin dalışın durumuna BAĞLI DEĞİL.

          PAZAR BİR HESAP DEĞİL, BİÇİM EŞLEMESİ: '.IS' ile biten sembol
          BIST, ötekiler ABD — aynı eşleme `kesfet/TaramaKart.tsx:130`
          ve `analiz/BilancoKart.tsx` başlığında da yerinde yapılıyor;
          `lib/` DEĞİŞTİRİLMEDİ.

          Kart TEMEL SKORA GİRMİYOR: ham kalem gösteriyor, marj/oran
          HESAPLAMIYOR. */}
      {sembol ? (
        <MaliTablolarKart
          sembol={sembol}
          pazar={sembol.toUpperCase().endsWith('.IS') ? 'BIST' : 'US'}
        />
      ) : null}

      <BolumBasligi
        baslik="Liste genişliğindeki turlar"
        kunye="Girdisi takip listen; seçilen sembolün turundan bağımsız."
      />

      {/* Liste kartları: derin dalışın DURUMUNA bağlı değil — kendi
          istekleri, kendi durum/hata kutuları. */}
      {/* TAŞINAN KÜME EKRANDA YAZILI: kullanıcı kıyasın neyle koştuğunu
          tahmin etmesin. Künye tablosunun daha geniş olabileceği de
          burada söyleniyor (künye turu takip listesiyle koşuyor). */}
      {kiyasKaynak !== 'liste' ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {(kiyasKaynak === 'kopru'
            ? '⚖️ Kıyas 🏭 Sektör dağılımından taşınan '
            : '⚖️ Kıyas, hisse sayfalarından kurduğun karşılaştırma setindeki ') +
            kiyasListesi.length +
            ' sembolle koşuyor: ' +
            kiyasListesi.join(', ') +
            (kiyasDisarida > 0
              ? ' · ' +
                kiyasDisarida +
                ' sembol bu tura GİRMEDİ: kıyas ucu bir turda en çok ' +
                AZAMI_SEMBOL +
                ' sembol alıyor.'
              : '') +
            ' · Alttaki temel metrik tablosu TAKİP LİSTESİNİN künye turundan gelir, bu kümeden geniş olabilir.'}
        </Text>
      ) : null}
      <KarsilastirKart
        veri={karsilastir.veri}
        durum={karsilastir.durum}
        hata={karsilastir.hata}
        yenile={karsilastir.yenile}
        semboller={kiyasListesi}
        /* Temel metrik tablosunun kaynağı — SIRALAMADAN AYRI UÇ. Aynı
           `kunye` turu Bilanço ve Temettü kartlarını da besliyor; ikinci
           bir tur açmak aynı veriyi iki kez sormak olurdu. */
        kunye={kunye.veri}
      />
      <BilancoKart
        veri={kunye.veri}
        durum={kunye.durum}
        hata={kunye.hata}
        yenile={kunye.yenile}
        semboller={liste}
      />
      <TemettuKart
        veri={kunye.veri}
        durum={kunye.durum}
        hata={kunye.hata}
        yenile={kunye.yenile}
        semboller={liste}
      />

      {/* NEDEN BURADA: tez defteri kullanıcının KENDİ notları ve
          CİHAZDA duruyor (yeni uç yok). Seçilen sembolle ilgili bir
          yüzey olduğu için piyasa şeridinin ÜSTÜNDE; şerit ise
          sembolden bağımsız sabit evrenler. */}
      <TezDefteriKart onerilenSembol={sembol ?? undefined} />

      <BolumBasligi
        baslik="Piyasa şeridi"
        kunye="Seçilen sembolle ilgisiz sabit evrenler; bağlam, döküm değil."
      />

      {/* NEDEN EN ALTTA: bu iki kart SEÇİLEN SEMBOLLE İLGİSİZ sabit
          evrenler (kripto + maden). Ekranın konusu tek hissenin
          dökümü; piyasa şeridi bağlam. Kendi istekleri, kendi durum
          kutuları — biri düşerken öteki durmuyor. */}
      <KriptoKart
        veri={kripto.veri}
        durum={kripto.durum}
        hata={kripto.hata}
        yenile={kripto.yenile}
      />
      <MetalKart
        veri={metal.veri}
        durum={metal.durum}
        hata={metal.hata}
        yenile={metal.yenile}
      />
    </ScreenShell>
  );
}

function SeviyeKart({ seviye, satir }: { seviye: PlanSeviye; satir: AnalyzeRow }) {
  const { colors } = useTheme();
  const kur = satir.market === 'BIST' ? 'TRY' : null;
  const bant = (z: number[] | null) =>
    z && z.length === 2 ? formatPrice(z[0], kur) + ' – ' + formatPrice(z[1], kur) : 'ölçülemedi';

  const satirlar: [string, string][] = [
    ['Uygun alım bandı', bant(seviye.buyZone as number[] | null)],
    ['Kâr-al bandı', bant(seviye.sellZone as number[] | null)],
    ['Hedef', formatPrice(seviye.target, kur)],
    ['Zarar kes', formatPrice(seviye.stop, kur)],
    ['SMA50 / SMA200', formatPrice(seviye.sma50, kur) + ' / ' + formatPrice(seviye.sma200, kur)],
    ['ATR', formatPrice(seviye.atr, kur)],
  ];

  return (
    <Card title="Plan seviyeleri" subtitle="Bantları motor belirler; istemci eşik tutmaz">
      {satirlar.map(([k, v]) => (
        <View key={k} style={styles.direk}>
          <Text style={[type.small, { color: colors.textDim }]}>{k}</Text>
          <Text style={[type.small, { color: colors.text }]}>{v}</Text>
        </View>
      ))}
    </Card>
  );
}

function TaDokum({ satir }: { satir: AnalyzeRow }) {
  const { colors } = useTheme();
  const [acik, setAcik] = useState(false);

  return (
    <Card
      title="Teknik gösterge dökümü"
      subtitle={'Rejim: ' + (satir.ta.regime ?? 'ölçülemedi')}
      right={
        <Dugme
          label={acik ? 'Kapat' : 'Göster'}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setAcik((o) => !o)}
        />
      }>
      {acik ? (
        (satir.ta.breakdown ?? []).map((b) => (
          <View key={b.key} style={styles.direk}>
            <Text style={[type.small, { color: colors.textDim }]}>{b.key}</Text>
            <Text style={[type.small, { color: colors.text }]}>
              {formatScore(b.score) + '  · ağırlık ' + formatScore(b.weight)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {(satir.ta.breakdown?.length ?? 0) + ' gösterge ölçüldü. Ağırlıklar motorun.'}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  secici: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  direk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 4,
  },
});
