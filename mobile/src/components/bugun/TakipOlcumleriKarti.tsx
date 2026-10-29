// =====================================================================
//  🧭 TakipOlcumleriKarti — kıyas turunun SEMBOL BAŞINA ölçümü
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderToday` (app.js:11602) listesinin sembol başına
//  GÖSTERDİĞİ sayıların yerli karşılığı: teknik skor, temel skor ve
//  kapsaması, bütüncül bant, bütüncül 0-10 skor, fiyat/F-K, plan
//  seviyeleri ve risk-ödül oranı.
//
//  ── NEDEN YENİ İSTEK YOK ───────────────────────────────────────────
//  Bu sayılar Bugün ekranının ZATEN attığı `/api/compare` turunun
//  gövdesinde geliyordu: `sonuclar[]` dizisi (api/types.ts:337 —
//  `CompareResponse = AnalyzeResponse & { sira, siralanamayan }`, yani
//  `sonuclar` KAYDI score ⊂ recommend ⊂ analyze zincirinin tamamını
//  taşıyor). Ekran bugüne kadar yalnız `sira` dizisini basıyordu;
//  ölçülmüş veri okunmadan çöpe gidiyordu. Kart bu yüzden props ile
//  besleniyor, kendi `fetch`ini ATMIYOR (`components/` içinde istek
//  yasak) ve sayfaya ikinci bir dış istek EKLEMİYOR.
//
//  ── WEB'İN NEYİ TAŞINMADI (bilerek) ────────────────────────────────
//  Web bu listede kendi FAYDA sayısını üretiyor: `u = sc.score (+6 makro
//  sektör) (+5 gündem kuyruğu) (−4 olumsuz haber)`, sonra 2..99 arasına
//  kırpıp 🔥/🟢/🟡/⚪/🔻 rozetlerini 64/58/52/46 eşikleriyle seçiyor ve
//  sıralamayı o sayıya göre yapıyor. O artı/eksi puanlar ve o eşikler
//  İSTEMCİDE YAZILMIŞ bir formül — HAM SAYI kuralının tam olarak
//  yasakladığı şey. Bu kart tek bir sayı türetmiyor: uçtan gelen alanı
//  olduğu gibi basıyor, sıralamayı da MOTORUN `sira` dizisine bırakıyor
//  (o dizi ekranın ilk kartında zaten basılıyor).
//  Web'in "sebep çipleri" de (📈 ta≥56, 📉 ta≤45, 🎯 doğru sektör,
//  🌍 gündem rüzgârı, 📰 duyarlılık) ya eşik ya da uçta OLMAYAN alan —
//  üçü de taşınmadı.
//
//  ── ÖLÇÜLMEYEN SAYI BASILMAZ ───────────────────────────────────────
//  Her alan `| null`: motor "ölçemedim"i `null` ile söylüyor. `null`
//  gelen hiçbir yere 0 ya da boş dize yazılmıyor; o satır kendi
//  cümlesini yazıyor ve varsa ucun verdiği SEBEBİ (`ta.why` / `fa.why` /
//  `composite.why`) olduğu gibi gösteriyor. `plan === null` da hata
//  değil: TA koşmadı demek (api/types.ts notu) ve öyle yazılıyor.
//  Satır bazında `tam:false` ise rozet sayıların ÜSTÜNDE duruyor.
//
//  NEDEN `Disclaimer` BASILMIYOR: ekran kabuğu (`ScreenShell.tsx:68`)
//  zorunlu notu sayfanın en altında ZATEN basıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { AnalyzeRow, ApiError, IstekDurum, Vade } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { formatBandUzakligi, formatOran, formatPrice, formatScore } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/**
 * Fiyatın alım bandına göre yeri — SABİT KÜME (motorun `yakinlik.state`),
 * yalnız Türkçeye çevriliyor. Eşik burada yok: kararı uç verdi.
 */
const YAKINLIK_METIN: Record<string, string> = {
  in: 'alım bandının içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

export type TakipOlcumleriKartiProps = {
  /** `/api/compare` gövdesinin `sonuclar` dizisi — ekran veriyor. */
  sonuclar: AnalyzeRow[];
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** Turun vadesi (uçtan). Verilmezse rozet çizilmez. */
  vade?: Vade | null;
};

export function TakipOlcumleriKarti({
  sonuclar,
  durum,
  hata,
  yenile,
  vade = null,
}: TakipOlcumleriKartiProps) {
  return (
    <Card
      title="🧭 Takip ölçümleri"
      subtitle="Aynı kıyas turunun sembol başına ham ölçümü — ikinci istek atılmıyor"
      right={vade ? <Pill label={vade} tone="info" glyph={null} size="sm" /> : null}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={Math.max(sonuclar.length, 2)}
        sekil="satir"
        kartsiz
        bosMetin="Kıyas turu henüz istenmedi."
      />

      {durum === 'veri' ? (
        sonuclar.length ? (
          <ScrollView style={styles.kaydir} nestedScrollEnabled>
            {sonuclar.map((satir) => (
              <OlcumSatiri key={satir.sym + ':' + satir.market} satir={satir} />
            ))}
          </ScrollView>
        ) : (
          // ÖLÇÜLDÜ, SONUÇ YOK: hata değil veri cevabı.
          <VeriYok kartsiz metin="Kıyas turu hiçbir sembol için ölçüm döndürmedi." />
        )
      ) : null}
    </Card>
  );
}

/** Tek sembolün ölçüm bloğu. Dört küme: teknik · temel · bütüncül · plan. */
function OlcumSatiri({ satir }: { satir: AnalyzeRow }) {
  const { colors } = useTheme();

  const ta = satir.ta;
  const fa = satir.fa;
  const bilesik = satir.composite;
  const plan = satir.plan;
  const analiz = satir.analiz ?? null;
  const butun = analiz?.butunculluk ?? null;
  const faKarar = analiz?.faKarar ?? null;

  const kur = satir.market === 'BIST' ? 'TRY' : 'USD';

  return (
    <View style={[styles.blok, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {satir.sym}
        </Text>
        <Pill
          label={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD piyasası'}
          tone="info"
          glyph={null}
          size="sm"
        />
      </View>

      {/* Rozet SAYILARIN ÜSTÜNDE: eksik ölçümü sayıları okuduktan SONRA
          öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      <OlcumEksikRozet kaynak={satir} />

      {/* ── TEKNİK ──────────────────────────────────────────────── */}
      <Text style={[type.micro, numeric, { color: colors.textDim }]}>
        {ta.score == null
          ? 'Teknik skor ölçülemedi' + (ta.why ? ' — ' + ta.why : '.')
          : 'Teknik skor ' +
            formatScore(ta.score) +
            '/100' +
            (ta.label ? ' · ' + ta.label : '') +
            (ta.regime ? ' · rejim ' + ta.regime : '') +
            (ta.adx == null ? '' : ' · ADX ' + formatOran(ta.adx, 1))}
      </Text>

      {/* ── TEMEL ───────────────────────────────────────────────── */}
      <Text style={[type.micro, numeric, { color: colors.textDim }]}>
        {fa.score == null
          ? 'Temel skor ölçülemedi' + (fa.why ? ' — ' + fa.why : '.')
          : 'Temel skor ' +
            formatScore(fa.score) +
            '/100' +
            // Kapsama UÇTAN: dolan kriter ağırlığı / toplam ağırlık.
            (fa.present == null || fa.total == null
              ? ''
              : ' · kapsama ' + formatOran(fa.present, 0) + '/' + formatOran(fa.total, 0))}
      </Text>
      <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
        {'Fiyat ' +
          formatPrice(fa.price, kur) +
          ' · F/K ' +
          (fa.pe == null ? 'ölçülemedi' : formatOran(fa.pe)) +
          ' · EPS ' +
          (fa.eps == null ? 'ölçülemedi' : formatOran(fa.eps))}
      </Text>

      {/* ── BÜTÜNCÜL ────────────────────────────────────────────── */}
      <Text style={[type.micro, numeric, { color: colors.textDim }]}>
        {bilesik.band == null
          ? 'Bütüncül bant ölçülemedi' + (bilesik.why ? ' — ' + bilesik.why : '.')
          : 'Bütüncül bant ' +
            bilesik.band +
            (bilesik.label ? ' · ' + bilesik.label : '') +
            (bilesik.blendedShown == null
              ? ''
              : ' · harman ' + formatScore(bilesik.blendedShown) + '/100')}
      </Text>
      {butun ? (
        <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
          {'Bütüncül skor ' +
            (butun.skor10 == null ? 'ölçülemedi' : formatScore(butun.skor10) + '/10') +
            (butun.band ? ' · ' + butun.band.l : '') +
            (faKarar ? ' · temel karar ' + faKarar.label + ' (' + faKarar.band + ')' : '')}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bütüncül skor bu satır için gelmedi.
        </Text>
      )}

      {/* ── PLAN ────────────────────────────────────────────────── */}
      {plan == null ? (
        // `plan: null` HATA DEĞİL: teknik analiz koşmadı (uç notu).
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Plan üretilmedi — bu vade için teknik analiz koşmadı.
        </Text>
      ) : (
        <>
          <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
            {'Plan — son fiyat ' +
              formatPrice(plan.seviye?.price ?? null, kur) +
              ' · hedef ' +
              formatPrice(plan.seviye?.target ?? null, kur) +
              ' · stop ' +
              formatPrice(plan.seviye?.stop ?? null, kur)}
          </Text>
          <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
            {'Risk-ödül mesafe oranı ' +
              (plan.riskOdul?.rrRatio == null
                ? 'ölçülemedi'
                : formatOran(plan.riskOdul.rrRatio)) +
              ' (yalnız mesafe oranı, olasılık değil — uç notu)'}
          </Text>
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Fiyatın yeri: ' +
              (plan.yakinlik == null
                ? 'ölçülemedi'
                : (YAKINLIK_METIN[plan.yakinlik.state] ?? 'motor kodu: ' + plan.yakinlik.state) +
                  ' · ' +
                  formatBandUzakligi(plan.yakinlik.dAtr))}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kaydir: { maxHeight: 420 },
  blok: {
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xxs },
});
