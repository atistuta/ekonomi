// =====================================================================
//  FiyatGrafigi — /api/chart serisinin kapanış grafiği  (FAZ 2/native)
// ---------------------------------------------------------------------
//  NE: `/api/chart` cevabının (`mumlar[]`) kapanış çizgisi + alan
//  dolgusu, iki fiyat etiketi (en az / en çok) ve iki tarih etiketi
//  (ilk / son). Dokunmasız — değer okuma yok.
//
//  NEDEN SUNUM KATMANI, HESAP DEĞİL: burada yapılan tek matematik
//  ÖLÇEKLEME (fiyat → piksel, dizin → piksel). Hareketli ortalama,
//  RSI, trend çizgisi, destek/direnç YOK ve olmayacak — onlar motorun
//  işi (`/api/analyze` → `plan.seviye.sma50` gibi). Bir gösterge bu
//  dosyada hesaplanırsa web ile native iki ayrı gösterge üretmeye
//  başlar; projenin "tek doğruluk kaynağı motor API" kuralı kırılır.
//
//  NEDEN TEK İSTİSNA "aralık değişimi": çizginin rengi ve ▲/▼ işareti
//  bir yöne ihtiyaç duyuyor. Yön, serinin İLK ve SON kapanışının ham
//  yüzde farkından geliyor — eşik tablosu, bant ya da sinyal DEĞİL;
//  `formatPercent`in zaten var olduğu türden bir ham değişim. Eşik
//  (±0,05 altı "yatay") `theme/signal.ts`'te tek yerde duruyor, burada
//  ikinci bir eşik yok.
//
//  NEDEN `react-native-svg`: ÖLÇÜLDÜ — `mobile/package.json`
//  bağımlılıklarında `react-native-svg: 15.15.4` var ve `TabIkon.tsx`
//  zaten kullanıyor. Yeni bağımlılık eklenmedi.
//
//  NEDEN `Durum` KOMPONENTİ KULLANILMIYOR: `Durum` kendi `Card`ını
//  çiziyor; bu komponent de bir `Card`. İç içe iki kart, kart
//  kenarlığını iki kez çizip ekranı gürültülü yapardı. Üç hâl burada
//  aynı metin kurallarıyla, kartın İÇİNDE çiziliyor.
//
//  ── DÖRT AYRI HÂL, DÖRT AYRI CÜMLE ────────────────────────────────
//   ① yükleniyor            → iskelet
//   ② hata (`unmeasured`)   → "ölçemedim" + yeniden dene
//   ③ hata (`no-data`)      → "veri yok", yeniden dene YOK
//   ④ 200 + `adet === 0`    → "bu aralıkta mum yok" — ARIZA DEĞİL,
//      veri cevabı. Bunu "ölçemedim" diye göstermek YALAN olurdu
//      (yeni halka arz / kapalı pazar bunu normal olarak üretir).
//  Ayrıca 200 gelse bile `tam === false` ise grafiğin ÜSTÜNDE "ölçüm
//  eksik" rozeti var — eksik seriyi sessizce çizmek en sinsi yalan.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Card } from './Card';
import { Dugme } from './Dugme';
import { OlcumNotu } from './Durum';
import { Pill } from './Pill';
import { Skeleton } from './Skeleton';
import type { ApiError } from '@/api/client';
import type { IstekDurum } from '@/api/istek';
import { ARALIKLAR, olcumEksik, type Aralik, type ChartResponse, type Mum } from '@/api/types';
import { formatGunAy, formatGunAyYil, formatPercent, formatPrice } from '@/lib/format';
import { numeric, radius, signalOf, space, toneColors, type, useTheme } from '@/theme';

/** Çizim alanı yüksekliği (piksel). Eksen etiketleri bunun dışında. */
const GRAFIK_YUKSEKLIK = 168;

/** Çizgi kalınlığı — mobilde 2 px ince ekranda kaybolmuyor, 3 kabalaşıyor. */
const CIZGI = 2;

/** Üst/alt nefes payı: çizgi kenara yapışınca kırpılmış görünür. */
const PAY = 6;

/**
 * Aralık seçicide gösterilenler. `1d` BİLEREK YOK: günlük adımda (`1d`
 * interval) tek günlük aralık bir ya da sıfır mum verir, yani grafik
 * değil nokta olur. Gün-içi grafiği ayrı bir adım (`5m`/`15m`) ister ve
 * bu komponent günlük seriye kurulu.
 */
const SECILEBILIR: readonly Aralik[] = ARALIKLAR.filter((a) => a !== '1d');

/** Çok yıllı aralıkta yıl olmadan tarih etiketi yanıltıcı olur. */
const YIL_GEREKEN: readonly Aralik[] = ['1y', '5y'];

export type FiyatGrafigiProps = {
  /** Hangi sembolün serisi — başlıkta görünür. */
  sembol: string;
  /** Para birimi için: BIST → TRY. Künyeden gelen `currency` önce gelir. */
  market?: 'US' | 'BIST';
  durum: IstekDurum;
  veri: ChartResponse | null;
  hata: ApiError | null;
  yenile: () => void;
  /** Yürürlükteki aralık — seçici bunu vurgular. */
  aralik: Aralik;
  onAralik: (a: Aralik) => void;
};

/** Ölçekleme sonucu — saf sunum verisi. */
type Cizim = {
  cizgi: string;
  alan: string;
  enAz: number;
  enCok: number;
  ilkZaman: number;
  sonZaman: number;
  ilkKapanis: number;
  sonKapanis: number;
  /** İlk → son kapanış ham yüzde farkı (yalnız renk/ok için). */
  degisimYuzde: number | null;
};

/**
 * Seriyi SVG yoluna çevirir. Tek matematik: ölçekleme.
 * `null` döner → çizilecek geçerli nokta yok.
 */
function cizimHesapla(mumlar: Mum[], genislik: number): Cizim | null {
  // Tip `number` diyor ama çalışma zamanı güvencesi değil: NaN/null bir
  // mum tüm yolu bozar (`M NaN,NaN` → hiç çizilmez).
  const noktalar = mumlar.filter(
    (m) => m && Number.isFinite(m.close) && Number.isFinite(m.time),
  );
  if (noktalar.length < 2 || !(genislik > 0)) return null;

  const kapanislar = noktalar.map((m) => m.close);
  const enAz = Math.min(...kapanislar);
  const enCok = Math.max(...kapanislar);
  // Düz seri (enAz === enCok): sıfıra bölmeyi engelle, çizgiyi ortala.
  const aralikFiyat = enCok - enAz;
  const ic = GRAFIK_YUKSEKLIK - PAY * 2;

  const x = (i: number) => (i / (noktalar.length - 1)) * genislik;
  const y = (p: number) =>
    aralikFiyat > 0 ? PAY + (1 - (p - enAz) / aralikFiyat) * ic : PAY + ic / 2;

  let cizgi = '';
  for (let i = 0; i < noktalar.length; i += 1) {
    cizgi += (i === 0 ? 'M' : 'L') + x(i).toFixed(2) + ',' + y(noktalar[i].close).toFixed(2);
    if (i < noktalar.length - 1) cizgi += ' ';
  }
  // Alan dolgusu: aynı yol + tabana kapanış.
  const alan =
    cizgi +
    ' L' +
    x(noktalar.length - 1).toFixed(2) +
    ',' +
    GRAFIK_YUKSEKLIK +
    ' L0,' +
    GRAFIK_YUKSEKLIK +
    ' Z';

  const ilkKapanis = noktalar[0].close;
  const sonKapanis = noktalar[noktalar.length - 1].close;
  const degisimYuzde =
    ilkKapanis > 0 ? ((sonKapanis - ilkKapanis) / ilkKapanis) * 100 : null;

  return {
    cizgi,
    alan,
    enAz,
    enCok,
    ilkZaman: noktalar[0].time,
    sonZaman: noktalar[noktalar.length - 1].time,
    ilkKapanis,
    sonKapanis,
    degisimYuzde,
  };
}

export function FiyatGrafigi({
  sembol,
  market,
  durum,
  veri,
  hata,
  yenile,
  aralik,
  onAralik,
}: FiyatGrafigiProps) {
  const { colors } = useTheme();
  // Genişlik ölçülmeden çizilemez: SVG viewBox'ı gerçek piksele oturmalı,
  // yoksa yol kartın dışına taşar. İlk çerçevede 0, `onLayout` sonrası
  // gerçek değer gelir.
  const [genislik, setGenislik] = useState(0);

  const olc = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== genislik) setGenislik(w);
  };

  const cizim = useMemo(
    () => (veri?.mumlar?.length ? cizimHesapla(veri.mumlar, genislik) : null),
    [veri, genislik],
  );

  const kur = veri?.kunye?.currency ?? (market === 'BIST' ? 'TRY' : null);
  const sinyal = signalOf(cizim?.degisimYuzde);
  const ton = toneColors(colors, sinyal.tone);
  const tarih = YIL_GEREKEN.includes(aralik) ? formatGunAyYil : formatGunAy;

  // SVG `id` BELGE GENELİNDE tek olmak zorunda: iki grafik yan yana
  // basılırsa sabit bir id ikinci grafiğin dolgusunu birincinin rengiyle
  // boyar (ilk tanım kazanır). Sembol + ton ile ayrıştırıyoruz.
  const alanId = 'fg-' + sembol.replace(/[^A-Z0-9]/gi, '') + '-' + sinyal.tone;

  const secici = (
    <View style={styles.secici}>
      {SECILEBILIR.map((a) => (
        <Dugme
          key={a}
          label={a}
          size="sm"
          variant={a === aralik ? 'solid' : 'outline'}
          tone={a === aralik ? 'gold' : 'neutral'}
          onPress={() => onAralik(a)}
        />
      ))}
    </View>
  );

  return (
    <Card
      title="Fiyat grafiği"
      subtitle={sembol + ' · kapanış serisi · /api/chart'}
      right={
        cizim ? (
          <Pill
            label={sinyal.arrow + ' ' + formatPercent(cizim.degisimYuzde)}
            tone={sinyal.tone}
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      {secici}

      {durum === 'yukleniyor' ? (
        <>
          <Skeleton width="100%" height={GRAFIK_YUKSEKLIK} rounded="md" />
          <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
            Fiyat serisi ölçülüyor…
          </Text>
        </>
      ) : null}

      {durum === 'bos' ? (
        <Text style={[type.small, { color: colors.textDim }]}>
          Bir sembol seç; seri o zaman istenecek.
        </Text>
      ) : null}

      {durum === 'hata' ? <HataGovde hata={hata} yenile={yenile} /> : null}

      {durum === 'veri' ? (
        <>
          {olcumEksik(veri) ? (
            <View style={styles.rozet}>
              <Pill label="ölçüm eksik" tone="gold" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textFaint, flex: 1 }]}>
                Seri eksik tamamlandı — grafik bu turda gelen mumları gösteriyor.
              </Text>
            </View>
          ) : null}

          {!veri || veri.adet === 0 ? (
            // 200 + boş seri: VERİ CEVABI. "Yeniden dene" YOK — aynı
            // boş sonuç gelir. Sebep tahmin EDİLMEZ, olasılık söylenir.
            <>
              <Pill label="veri yok" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.small, { color: colors.textDim, marginTop: space.sm }]}>
                {'Bu aralıkta (' + aralik + ') mum yok. Motor ölçtü; seri boş döndü.'}
              </Text>
            </>
          ) : !cizim ? (
            // Seri var ama iki geçerli nokta yok (tek mum / bozuk alanlar)
            // ya da genişlik henüz ölçülmedi.
            <View onLayout={olc} style={styles.tuval}>
              <Text style={[type.small, { color: colors.textDim }]}>
                {veri.adet === 1
                  ? 'Tek mum geldi — çizgi için en az iki kapanış gerekiyor.'
                  : 'Çizim alanı ölçülüyor…'}
              </Text>
            </View>
          ) : (
            <>
              <View onLayout={olc} style={styles.tuval}>
                {genislik > 0 ? (
                  <Svg
                    width={genislik}
                    height={GRAFIK_YUKSEKLIK}
                    accessibilityLabel={
                      sembol +
                      ' kapanış grafiği, ' +
                      aralik +
                      ', ' +
                      sinyal.a11yLabel +
                      ', ' +
                      formatPercent(cizim.degisimYuzde)
                    }>
                    <Defs>
                      <LinearGradient id={alanId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={ton.fg} stopOpacity="0.28" />
                        <Stop offset="1" stopColor={ton.fg} stopOpacity="0" />
                      </LinearGradient>
                    </Defs>
                    <Path d={cizim.alan} fill={'url(#' + alanId + ')'} />
                    <Path
                      d={cizim.cizgi}
                      fill="none"
                      stroke={ton.fg}
                      strokeWidth={CIZGI}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  </Svg>
                ) : null}
              </View>

              {/* Y ekseni: en çok / en az. Renk tek işaret olmasın diye
                  etiketler SÖZLE de ayrışıyor. */}
              <View style={styles.yekseni}>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'En çok ' + formatPrice(cizim.enCok, kur)}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'En az ' + formatPrice(cizim.enAz, kur)}
                </Text>
              </View>

              {/* X ekseni: ilk / son tarih. */}
              <View style={styles.xekseni}>
                <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                  {tarih(cizim.ilkZaman)}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                  {tarih(cizim.sonZaman)}
                </Text>
              </View>

              <View style={styles.ozet}>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'İlk ' + formatPrice(cizim.ilkKapanis, kur)}
                </Text>
                <Text style={[type.micro, numeric, { color: ton.fg }]}>
                  {sinyal.arrow + ' ' + sinyal.word}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'Son ' + formatPrice(cizim.sonKapanis, kur)}
                </Text>
              </View>

              <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                {veri.adet + ' mum · adım ' + veri.interval + ' · kapanış fiyatı'}
              </Text>
              <OlcumNotu kaynak={veri} />
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Hata gövdesi. "veri yok" ile "ölçemedim" ayrı: yalnız ikincisinde
 * yeniden deneme anlamlı (`Durum` komponentiyle AYNI kural — metin
 * `client.ts`ten gelir, burada ikinci bir cümle uydurulmaz).
 */
function HataGovde({ hata, yenile }: { hata: ApiError | null; yenile: () => void }) {
  const { colors } = useTheme();
  const olcemedim = hata?.kind !== 'no-data';
  return (
    <View>
      <Pill
        label={olcemedim ? 'ölçemedim' : 'veri yok'}
        tone={olcemedim ? 'gold' : 'neutral'}
        glyph={null}
        size="sm"
      />
      <Text style={[type.small, { color: colors.text, marginTop: space.sm }]}>
        {hata?.message ?? 'Fiyat serisi alınamadı.'}
      </Text>
      {olcemedim ? (
        <Dugme label="Yeniden dene" onPress={yenile} style={{ marginTop: space.md }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  secici: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tuval: {
    width: '100%',
    height: GRAFIK_YUKSEKLIK,
    justifyContent: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  rozet: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  yekseni: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  xekseni: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  ozet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
});
