// =====================================================================
//  RiskOdulKart — ⚖️ seviyeler ve risk/ödül          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `plan.seviye` kalemleri (alım bandı, hedef, stop, R/R, SMA50/200,
//  ATR) ve `plan.riskOdul` kalemleri (hedefe uzaklık %, kırılım %,
//  ATR stop, mesafe oranı) satır satır — hepsi motorun verdiği hâliyle.
//
//  NEDEN TEK KARTTA İKİSİ: `seviye` fiyat çıpalarını, `riskOdul` o
//  çıpalara UZAKLIĞI söylüyor. İki kart olsa kullanıcı aynı sayıyı iki
//  yerde arardı; burada çıpa üstte, uzaklık altta.
//
//  ── `rrRatio` NEDEN "OLASILIK DEĞİL" DİYE YAZIYOR ─────────────────
//  Uç notu açık (types.ts PlanRiskOdul): `rrRatio` YALNIZ mesafe oranı.
//  Altyazı olmadan 2,4 gibi bir sayı "kazanma şansı" sanılır — bu bir
//  tavsiye izlenimi yaratır (SPK çizgisi). Altyazı bu yüzden süs değil,
//  ürün kuralı.
//
//  ── `plan === null` NEDEN HATA DEĞİL ──────────────────────────────
//  types.ts'in kendi notu: "plan = null → TA koşmadı (ör. vade
//  'gunici')". Kırmızı hata kutusu basmak kullanıcıya "bir şey bozuldu"
//  demekti; doğrusu "bu vadede seviye üretilmiyor" cümlesi. `VeriYok`
//  bunu nötr tonda söylüyor, `Durum` hata gövdesi devreye girmiyor.
//
//  ── YÖN İŞARETİ (▲/▼) NEREDEN GELİYOR ─────────────────────────────
//  Yüzde kalemlerinde (`sellUpPct`, `brkPct`) işaret `signalOf()`ten
//  geliyor — eşik theme/signal.ts'te TEK yerde duruyor, bu dosya kendi
//  eşiğini uydurmuyor. Renk YALNIZ `toneColors()` token'ından; anlam
//  renge TEK BAŞINA bağlı değil, işaret ve metin de var (renk körü
//  güvenliği). Fiyat kalemlerine (hedef/stop) işaret KONULMUYOR: bir
//  hedef fiyatı "artış" diye işaretlemek, fiyatla kıyaslama hesabı
//  yapmak olurdu.
//
//  BURADA HESAP YOK: alım bandının ortası alınmaz, hedef-fiyat farkı
//  yüzdeye çevrilmez (`sellUpPct` zaten uçtan geliyor), R/R yeniden
//  bölünmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import type { AnalyzeRow, Market } from '@/api';
import { Card, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran, formatPercent, formatPrice } from '@/lib/format';
import { signalOf, space, toneColors, type, useTheme } from '@/theme';

/**
 * Alım bandına yakınlık durumu (motorun sabit kümesi: in | below | near |
 * far) → Türkçe etiket. Eşik ya da yeniden sınıflama YOK; ham `state`
 * değerini ekrana basmak kullanıcıya İngilizce makine kodu göstermekti.
 */
const YAKINLIK_METIN: Record<string, string> = {
  in: 'bandın içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

/** Kâr-al / kırılım kaynağı (sabit küme) → okunur ek. */
const KAYNAK_ETIKET: Record<string, string> = {
  target: 'hedef',
  sellZone: 'satış bandı',
  atr: 'ATR',
  poc: 'hacim yoğunluğu',
  sma50: 'SMA50',
  sma200: 'SMA200',
  high: 'zirve',
};

export type RiskOdulKartProps = {
  satir: AnalyzeRow;
};

/** Pazar → para birimi. Bilinmeyen pazarda simge UYDURULMAZ. */
function kurOf(market: Market): string | null {
  return market === 'BIST' ? 'TRY' : null;
}

export function RiskOdulKart({ satir }: RiskOdulKartProps) {
  const { colors } = useTheme();
  const plan = satir.plan;
  const kur = kurOf(satir.market);

  // TA KOŞMADI (başlıktaki gerekçe) — hata değil, veri cevabı.
  if (!plan) {
    return (
      <Card title="⚖️ Risk / ödül" subtitle="Seviyeler teknik turda üretilir.">
        <VeriYok
          metin="Bu kayıt için teknik tur koşmadı (ör. gün içi vade); seviye ve risk/ödül üretilmedi."
          kartsiz
        />
      </Card>
    );
  }

  const s = plan.seviye;
  const r = plan.riskOdul;

  // Bant [alt, üst] olarak geliyor; ortası ALINMAZ, iki uç basılır.
  const bant = (dizi: number[] | null | undefined): string => {
    if (!dizi || dizi.length < 2) return EMPTY;
    return formatPrice(dizi[0], kur) + ' – ' + formatPrice(dizi[1], kur);
  };

  // Yüzde kalemi: işaret + ton TEK yerden (signalOf), eşik burada yok.
  const yuzde = (deger: number | null | undefined) => {
    const sinyal = signalOf(deger ?? null);
    const varMi = typeof deger === 'number' && Number.isFinite(deger);
    return {
      deger: formatPercent(deger),
      // Veri yoksa yön işareti BASILMAZ: '→' bile bir iddiadır.
      isaret: varMi ? sinyal.arrow : null,
      renk: varMi ? toneColors(colors, sinyal.tone).fg : undefined,
      a11y: varMi ? sinyal.a11yLabel : 'veri yok',
    };
  };

  const hedefUzak = yuzde(r?.sellUpPct);
  const kirilim = yuzde(r?.brkPct);

  return (
    <Card
      title="⚖️ Risk / ödül"
      subtitle="Mesafe oranı OLASILIK DEĞİL — motorun ölçtüğü uzaklıklar."
      right={
        plan.yakinlik?.state ? (
          <Pill
            label={YAKINLIK_METIN[plan.yakinlik.state] ?? plan.yakinlik.state}
            tone="neutral"
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      {s ? (
        <View style={styles.liste}>
          <Satir etiket="Uygun alım bandı" deger={bant(s.buyZone)} />
          <Satir etiket="Satış bandı" deger={bant(s.sellZone)} />
          <Satir
            etiket="Hedef"
            not={s.sellKind ? 'kaynak: ' + (KAYNAK_ETIKET[s.sellKind] ?? s.sellKind) : undefined}
            deger={formatPrice(s.target, kur)}
          />
          <Satir etiket="Stop" deger={formatPrice(s.stop, kur)} />
          <Satir
            etiket="R / R"
            not="ödül-risk mesafe oranı — olasılık değil"
            deger={formatOran(s.rr)}
          />
          <Satir etiket="SMA 50" deger={formatPrice(s.sma50, kur)} />
          <Satir etiket="SMA 200" deger={formatPrice(s.sma200, kur)} />
          <Satir
            etiket="ATR"
            not={
              typeof s.zMult === 'number' ? 'bant çarpanı ' + formatOran(s.zMult) : undefined
            }
            deger={formatOran(s.atr)}
          />
          <Satir etiket="Hacim yoğunluğu (POC)" deger={formatPrice(s.poc, kur)} />
        </View>
      ) : (
        <VeriYok metin="Seviye dökümü bu turda gelmedi." kartsiz />
      )}

      {/* Çıpanın kaygan mı sabit mi olduğu motordan geliyor; yorum yok. */}
      {s?.anchorKind ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Çıpa: ' + s.anchorKind}
        </Text>
      ) : null}

      {r ? (
        <View style={styles.liste}>
          <Satir
            etiket="Hedefe uzaklık"
            isaret={hedefUzak.isaret}
            renk={hedefUzak.renk}
            deger={hedefUzak.deger}
            not={r.sellKind ? 'kaynak: ' + (KAYNAK_ETIKET[r.sellKind] ?? r.sellKind) : undefined}
            erisimEtiketi={'Hedefe uzaklık ' + hedefUzak.deger + ', ' + hedefUzak.a11y}
          />
          <Satir
            etiket="Kırılım seviyesine uzaklık"
            isaret={kirilim.isaret}
            renk={kirilim.renk}
            deger={kirilim.deger}
            not={r.brkKind ? 'kaynak: ' + (KAYNAK_ETIKET[r.brkKind] ?? r.brkKind) : undefined}
            erisimEtiketi={'Kırılım seviyesine uzaklık ' + kirilim.deger + ', ' + kirilim.a11y}
          />
          <Satir etiket="Birincil kırılım" deger={formatPrice(r.brkPrimary, kur)} />
          <Satir etiket="Ana kırılım" deger={formatPrice(r.brkMajor, kur)} />
          <Satir etiket="ATR stop" deger={formatPrice(r.atrStop, kur)} />
          <Satir
            etiket="Mesafe oranı"
            not="OLASILIK DEĞİL"
            deger={formatOran(r.rrRatio)}
          />
        </View>
      ) : (
        <VeriYok metin="Risk / ödül kalemleri bu turda gelmedi." kartsiz />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  liste: { gap: space.xxs },
});
