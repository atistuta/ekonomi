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
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  VARSAYILAN_ARALIK,
  fetchAnalyze,
  fetchChart,
  useIstek,
  useListe,
  type AnalyzeRow,
  type Aralik,
  type Direk,
  type PlanSeviye,
} from '@/api';
import {
  Card,
  Dugme,
  Durum,
  FiyatGrafigi,
  OlcumEksikRozet,
  Pill,
  ScoreGauge,
  ScreenShell,
  VeriYok,
} from '@/components';
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
  const params = useLocalSearchParams<{ sym?: string }>();
  const [secili, setSecili] = useState<string | null>(null);

  const sembol = useMemo(() => {
    const p = typeof params.sym === 'string' ? params.sym.toUpperCase() : null;
    return secili ?? p ?? liste[0] ?? null;
  }, [secili, params.sym, liste]);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchAnalyze(sembol ? [sembol] : [], { vade: 'orta', signal }),
    [sembol],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol ?? '', { etkin: Boolean(sembol) });

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
        {!liste.length ? (
          <Text style={[type.small, { color: colors.textDim }]}>
            Takip listesi boş. Arama sekmesinden sembol ekle.
          </Text>
        ) : null}
      </Card>

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
