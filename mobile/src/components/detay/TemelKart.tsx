// =====================================================================
//  TemelKart — 📊 temel skor + kriter listesi          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `fa.score` (0-100), kapsama (`present`/`total`), EPS/F/K künyesi
//  ve `fa.criteria` kalemleri satır satır: kriter adı · alt-skoru ·
//  ağırlığı.
//
//  NEDEN KAPSAMA AYRI GÖSTERİLİYOR: 40 kriterden 12'si dolmuşsa skor
//  yine 0-100 çıkıyor ama ARKASINDA daha az veri var. `present/total`
//  motorun kendi saydığı kapsama ölçüsü (types.ts) — bunu saklamak,
//  yarım ölçümü tam ölçüm gibi sunmak olurdu. İSTEMCİ SAYMIYOR: dizinin
//  boyunu `total` yerine kullanmak ikinci bir doğruluk kaynağı açardı.
//
//  ── NEDEN "GEÇTİ / KALDI" ROZETİ YOK ──────────────────────────────
//  Web'de kriterin rengi `faScoreSig(c.score)` ile seçiliyor — yani
//  EŞİK MOTORDA. Uç nokta kriter başına yalnız `{key, weight, score}`
//  gönderiyor (api/_akis.js kırpması); `sig` / `label` / `note` telde
//  YOK. "60 üstü geçti" gibi bir eşiği burada yazmak, istemciye
//  motorun kararını taklit ettirmek olurdu — aynı kriterin webde "orta"
//  native'de "geçti" görünmesi demek. Bu yüzden rozet ÖLÇÜM DURUMUNU
//  söylüyor ("ölçüldü" / "ölçülemedi"), yargıyı değil: alt-skor sayısı
//  yanında duruyor, yargıyı kullanıcı motorun skorundan okuyor.
//
//  NEDEN `tam === false` ROZETİ BURADA DA: temel ayak SEC EDGAR / İş
//  Yatırım'a çıkıyor; o kaynak kesilirse skor düşük DEĞİL, EKSİK ölçülür
//  (types.ts durum ②). `OlcumEksikRozet` bu ayrımı sayıların ÜSTÜNDE
//  söylüyor; `sec.yok` ise kesinti sayılmaz (dosya SEC'te yok = veri
//  cevabı) ve rozet basmaz — o ayrım `olcumEksik()` içinde, burada
//  yeniden yazılmıyor.
//
//  BURADA HESAP YOK: alt-skorlar ağırlıkla çarpılıp toplanmaz, F/K
//  oranı EPS ve fiyattan yeniden kurulmaz (uç `pe` gönderiyor).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import type { AnalyzeRow } from '@/api';
import { Card, OlcumEksikRozet, Pill, ScoreGauge, VeriYok } from '@/components';
import { EMPTY, formatOran, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/**
 * Kriter anahtarı → Türkçe ad. Motordaki kriter `label`larının aynası;
 * YALNIZ ad çevirisi — eşik, ağırlık ya da sıra taşımaz (başlıktaki
 * gerekçe). Bilinmeyen anahtar gizlenmez, ham hâliyle basılır.
 */
const FA_ETIKET: Record<string, string> = {
  pe: 'Değerleme (F/K)',
  netMargin: 'Net kâr marjı',
  ebitdaMargin: 'FAVÖK marjı',
  ocfMargin: 'Faaliyet nakit akışı marjı',
  roe: 'Özkaynak kârlılığı (ROE)',
  roa: 'Aktif kârlılığı (ROA)',
  revYoY: 'Gelir büyümesi (YoY)',
  revCagr: '3 yıllık gelir BYBO',
  netTrend: 'Net kâr yönü',
  cashLt: 'Nakit / uzun vadeli borç',
  ndEbitda: 'Net borç / FAVÖK',
  d2e: 'Borç / özkaynak',
  curRatio: 'Cari oran',
  quickRatio: 'Asit-test (likit) oranı',
  fcfPos: 'Serbest nakit akışı',
  accruals: 'Nakit kalitesi (OCF > net kâr)',
  roaUp: 'Aktif kârlılığı trendi',
  gmUp: 'Brüt marj trendi',
  crUp: 'Cari oran trendi',
};

export type TemelKartProps = {
  satir: AnalyzeRow;
};

export function TemelKart({ satir }: TemelKartProps) {
  const { colors } = useTheme();
  const fa = satir.fa;
  const kriterler = fa.criteria ?? [];

  return (
    <Card
      title="📊 Temel analiz"
      subtitle="Kriterler ve ağırlıkları motordan; eşik tablosu istemcide yok."
      right={
        typeof fa.present === 'number' && typeof fa.total === 'number' ? (
          <Pill
            label={fa.present + ' / ' + fa.total + ' kriter'}
            tone="neutral"
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      {/* `tam:false` → ÖLÇEMEDİM. Skorun ÜSTÜNDE durur, veriyi gizlemez. */}
      <OlcumEksikRozet kaynak={satir} />

      <ScoreGauge score={fa.score} caption="Temel" />

      {fa.score === null && fa.why ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Temel üretilmedi: ' + fa.why}
        </Text>
      ) : null}

      {/* Künye: EPS ve F/K uçtan geldiği gibi; F/K burada bölünerek
          YENİDEN kurulmaz. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'EPS ' +
          (typeof fa.eps === 'number' ? formatOran(fa.eps) : EMPTY) +
          ' · F/K ' +
          (typeof fa.pe === 'number' ? formatOran(fa.pe) : EMPTY)}
      </Text>

      {kriterler.length ? (
        <View style={styles.liste}>
          {kriterler.map((c) => {
            const olculdu = typeof c.score === 'number' && Number.isFinite(c.score);
            const ad = FA_ETIKET[c.key] ?? c.key;
            return (
              <View key={c.key} style={styles.satirSarmal}>
                <Satir
                  etiket={ad}
                  not={'ağırlık ' + formatOran(c.weight)}
                  deger={olculdu ? formatScore(c.score) + ' /100' : EMPTY}
                  erisimEtiketi={
                    olculdu
                      ? ad + ' alt skoru ' + formatScore(c.score) + ', ağırlık ' + formatOran(c.weight)
                      : ad + ' ölçülemedi'
                  }
                />
                {/* ROZET YARGI DEĞİL ÖLÇÜM DURUMU (başlıktaki gerekçe):
                    `score === null` olan kriter skora hiç girmiyor
                    (api/_motor.js computeFaScore `c.score != null`). */}
                {olculdu ? null : (
                  <Pill label="ölçülemedi" tone="gold" glyph={null} size="sm" />
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <VeriYok metin="Kriter listesi bu turda gelmedi." kartsiz />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  liste: { gap: space.xs },
  satirSarmal: { gap: space.xxs },
});
