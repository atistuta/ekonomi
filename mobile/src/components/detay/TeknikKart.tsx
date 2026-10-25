// =====================================================================
//  TeknikKart — 📈 teknik skor + gösterge dökümü       (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `ta.score` (0-100) + rejim/ADX künyesi + `ta.breakdown` kalemleri
//  satır satır: gösterge adı · alt-skoru · ağırlığı.
//
//  NEDEN DÖKÜM GÖSTERİLİYOR: skorun TEK başına bir sayı olması onu
//  kara kutu yapar. Döküm "neden 63" sorusunun motordan gelen cevabı;
//  ürünün satış noktası da bu (bilgi aracı, tavsiye değil).
//
//  ── BURADA HESAP YOK, EN ÇOK BURADA ÖNEMLİ ────────────────────────
//  `breakdown[]` ağırlık VE alt-skor taşıyor; ikisini çarpıp toplamak
//  teknik skoru İSTEMCİDE yeniden üretmek olurdu. Motor zaten `score`u
//  gönderiyor; ikinci bir hesap, iki sayının bir gün ayrışması demek.
//  Ağırlıklar YALNIZ gösterilir (`formatOran`), çarpılmaz, yüzdeye
//  çevrilmez, normalize edilmez.
//
//  ── KATKI (`contrib`) SÜTUNU NEDEN YOK ─────────────────────────────
//  Motor kendi içinde `contrib = weight * (score - 50) * scale` ve
//  `wPct` üretiyor (api/_motor.js) ama uç noktanın SÖZLEŞMESİ bu iki
//  alanı TAŞIMIYOR: `api/_akis.js` dökümü `{key, score, weight}` olarak
//  kırpıyor (ÖLÇÜLDÜ, kaynak satırı: breakdown map). Katkıyı burada
//  `weight * (score - 50)` diye yeniden kurmak, motorun ölçek katsayısı
//  olmadan YANLIŞ bir sayı üretip onu motorun sayısıymış gibi göstermek
//  olurdu. Bu yüzden ekranda ne gelmişse o var: alt-skor ve ağırlık.
//
//  ── ETİKET ÇEVİRİSİ NEDEN İSTEMCİDE ───────────────────────────────
//  Motorda `TA_KEY_LABEL` var ama uç yalnız `key` gönderiyor (aynı
//  kırpma). Ham anahtarı ('ttmpl') kullanıcıya göstermek anlamsız;
//  aşağıdaki tablo SADECE ad çevirisi — eşik, sıra ya da ağırlık
//  TAŞIMIYOR, yani motorla çelişemez. Bilinmeyen anahtar gizlenmez,
//  olduğu gibi basılır (yeni gösterge sessizce kaybolmasın).
//
//  NEDEN `score === null` KIRMIZI DEĞİL: vade 'gunici' iken günlük
//  mumla TA üretilmiyor ve `ta.why` sebebi söylüyor — bu bir VERİ
//  cevabı, hata değil (types.ts üç durum notu ①).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { AnalyzeRow } from '@/api';
import { Satir } from './Satir';
import { Card, Pill, ScoreGauge, VeriYok } from '@/components';
import { EMPTY, formatOran, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/**
 * Gösterge anahtarı → Türkçe ad. Motordaki `TA_KEY_LABEL` aynası;
 * YALNIZ ad çevirisi (bkz. başlıktaki gerekçe).
 */
const TA_ETIKET: Record<string, string> = {
  trend: 'Trend (MA)',
  ichimoku: 'Ichimoku',
  macd: 'MACD',
  rsi: 'RSI',
  stoch: 'Stokastik',
  boll: 'Bollinger',
  obv: 'OBV · Hacim',
  vp: 'Hacim profili',
  oflow: 'Emir akışı (tahmini)',
  rs: 'Göreli güç (RS)',
  volconf: 'Hacim teyidi',
  ttmpl: 'Trend şablonu',
};

export type TeknikKartProps = {
  satir: AnalyzeRow;
};

export function TeknikKart({ satir }: TeknikKartProps) {
  const { colors } = useTheme();
  const ta = satir.ta;
  const dokum = ta.breakdown ?? [];

  return (
    <Card
      title="📈 Teknik analiz"
      subtitle="Göstergeler ve ağırlıkları motordan; istemci hiçbirini toplamaz."
      right={ta.regime ? <Pill label={ta.regime} tone="info" glyph={null} size="sm" /> : null}>
      <ScoreGauge score={ta.score} caption="Teknik" band={ta.label ?? undefined} />

      {/* Sebep YALNIZ uçtan: "ölçülemedi" cümlesini biz yazmıyoruz. */}
      {ta.score === null && ta.why ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Teknik üretilmedi: ' + ta.why}
        </Text>
      ) : null}

      {/* Künye: kaç mumla ölçüldü, ADX kaç. Yorum YOK — çıplak sayı. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'ADX ' +
          (typeof ta.adx === 'number' ? formatOran(ta.adx) : EMPTY) +
          ' · ' +
          (typeof ta.bars === 'number' ? ta.bars : EMPTY) +
          ' mum' +
          (typeof ta.benchBars === 'number' ? ' · endeks ' + ta.benchBars + ' mum' : '')}
      </Text>

      {dokum.length ? (
        <View style={styles.dokum}>
          <Text style={[type.smallBold, { color: colors.text }]}>
            {dokum.length + ' gösterge ölçüldü'}
          </Text>
          {/* Alt-skor 0-100: motorun gönderdiği sayı, ölçek değişmez. */}
          {dokum.map((b) => (
            <Satir
              key={b.key}
              etiket={TA_ETIKET[b.key] ?? b.key}
              not={'ağırlık ' + formatOran(b.weight)}
              deger={formatScore(b.score) + ' /100'}
              erisimEtiketi={
                (TA_ETIKET[b.key] ?? b.key) +
                ' alt skoru ' +
                formatScore(b.score) +
                ', ağırlık ' +
                formatOran(b.weight)
              }
            />
          ))}
        </View>
      ) : (
        // Döküm gelmemiş olması HATA DEĞİL: skor üretilmediyse döküm de
        // yoktur. "veri yok" kutusu bunu olduğu gibi söyler.
        <VeriYok metin="Gösterge dökümü bu turda gelmedi." kartsiz />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  dokum: { gap: space.xs },
});
