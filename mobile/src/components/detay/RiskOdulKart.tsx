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
//  ── MOMENTUM BLOĞU NEDEN BURADA (eklendi 2026-10-29, ŞERİT F) ─────
//  `plan.momentum` tipte vardı (`types.ts` PlanMomentum) ama HİÇBİR
//  ekranda basılmıyordu. Yeni kart açılmadı: momentum `plan`ın dördüncü
//  uzvu — `seviye` ve `riskOdul` bu kartta zaten basılıyor, `yakinlik`
//  başlık rozetinde duruyor. Momentumu ayrı karta koymak aynı `plan`
//  nesnesini iki kart arasında bölmek, `plan === null` gerekçesini de
//  iki yerde anlatmak demekti.
//
//  ALANLAR HAM (ölçüldü `api/_motor.js:950-975`, `momentumInfo`):
//  kapalı turda `{active:false}` ya da `{active:false, trendAligned,
//  adx, gapPct}`; açık turda `{active:true, zone:[alt,üst], gapPct,
//  adx, sma50, sma200}`. `zone`/`sma50`/`sma200` tipte AD İLE yok,
//  index imzasından (`[k: string]: unknown`) geliyor — bu yüzden
//  `sayiYa()`/`sayiDizisi()` kapısından geçiyorlar; tip genişletilmedi
//  çünkü alan kümesinin uçta sabit olmadığını tipin kendi notu söylüyor.
//
//  `gapPct` ÖLÇÜLDÜ = KESİR, YÜZDE PUANI DEĞİL (`_motor.js:963`:
//  `(p - bzTop) / p`). Adında "Pct" geçmesine aldanıp `formatPercent`e
//  vermek sayıyı 100 kat küçük gösterirdi; `formatOran` ile basılıyor ve
//  ×100 YAPILMIYOR — ölçeği altyazı söylüyor.
//
//  `sma50`/`sma200` momentum gövdesinde de geliyor ama BASILMIYOR:
//  `seviye` bölümünde aynı iki kalem zaten var (yukarıda SMA 50 / SMA
//  200 satırları). İkinci kez basmak kullanıcıya iki ayrı ölçüm sanısı
//  verirdi.
//
//  BURADA HESAP YOK: alım bandının ortası alınmaz, hedef-fiyat farkı
//  yüzdeye çevrilmez (`sellUpPct` zaten uçtan geliyor), R/R yeniden
//  bölünmez.
//
//  ── OYNAKLIK BLOĞU NEDEN BURADA (eklendi 2026-11-03, Ş8 #14) ──────
//  `atr / price * 100` app.js'te İKİ YERDE hesaplanıyor ve İKİ FARKLI
//  soruya cevap veriyordu: ATR kartı ÜÇ KADEMELİ oynaklık sınıfı +
//  "stop için ATR'nin 1.5-2 katı" cümlesi basıyor; katalizör satırı ise
//  yalnız UÇLARDA (>=4 / <1.5) konuşup ARADA SUSUYOR. İkisi motorda iki
//  ayrı makine koduna çevrildi (`atrVolKod` / `atrPlanKod`, kapısı
//  uc-test ⑤g) ve `plan`ın beşinci/altıncı uzvu olarak buraya geldi:
//  ATR satırı bu kartta ZATEN basılıyor, oranın sınıfını ayrı karta
//  koymak aynı sayıyı iki yerde aratmak olurdu.
//
//  SESSİZ BANT KORUNUYOR: `atrPlan.kod === null` = ÖLÇTÜM, söylenecek
//  bir şey yok → ekrana CÜMLE BASILMIYOR (web ile birebir). `atrPlan`
//  nesnesinin KENDİSİ `null` ise bu "ölçemedim"dir ve ayrı yazılıyor;
//  ikisini karıştırmak sessiz bantta da "ölçemedim" bastırırdı.
//
//  `stopKat` SAYILARI UÇTAN: "ATR × 1,5 – 2" notundaki iki sayı motorun
//  çıktısı; buraya yazılsa istemciye eşik yazmak olurdu (§5.1).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import type { AnalyzeRow, Market } from '@/api';
import { Card, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran, formatPercent, formatPrice } from '@/lib/format';
import { ATR_PLAN_SOZLUK, OYNAKLIK_SOZLUK, sozluktenSec } from '@/lib/sozluk';
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

/**
 * Index imzasından (`[k: string]: unknown`) gelen `[alt, üst]` dizisi:
 * iki ucu da SAYI ise döner, değilse `null`. Dönüştürme YOK — `Number(v)`
 * yazmak ucun göndermediği bir sayıyı uydurmak olurdu.
 */
function sayiDizisi(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const sayilar = v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return sayilar.length >= 2 ? sayilar : null;
}

/** Üç dal: alan bildirilmemiş → '—'; `true`/`false` → Türkçesi. Yorum yok. */
function evetHayir(v: unknown): string {
  if (typeof v !== 'boolean') return EMPTY;
  return v ? 'evet' : 'hayır';
}

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

  // Momentum: ham alanlar; `zone` index imzasından geldiği için kapıdan geçiyor.
  const mom = plan.momentum;
  const momBant = sayiDizisi(mom?.zone);

  // ── OYNAKLIK (başlıktaki gerekçe) ─────────────────────────────────
  // `undefined` = uç bu alanı göndermedi (eski sürüm) → HİÇBİR ŞEY
  // çizilmez; `null` = ölçemedim. İkisi ayrı dal.
  const vol = plan.oynaklik;
  const volCumle = sozluktenSec(OYNAKLIK_SOZLUK, vol?.kod);
  // Notun SAYILARI uçtan (`stopKat`); burada çarpan yazılmıyor.
  const stopNot =
    vol?.stopKat && vol.stopKat.length >= 2
      ? 'yaygın stop mesafesi: ATR × ' +
        formatOran(vol.stopKat[0]) +
        ' – ' +
        formatOran(vol.stopKat[1])
      : undefined;
  // SESSİZ BANT: `kod === null` ise cümle YOK (web `fillCatalysts` ile
  // birebir). Nesne `null` ise "ölçemedim" ayrıca yazılıyor.
  const bandCumle = sozluktenSec(ATR_PLAN_SOZLUK, plan.atrPlan?.kod);

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

      {/* OYNAKLIK — başlıktaki gerekçe. Sınıf motordan, eşik burada yok.
          Alan HİÇ gelmediyse (eski uç sürümü) blok çizilmez: sorulmayan
          sorunun cevabı ekranda görünmez. */}
      {vol === undefined ? null : vol === null ? (
        <VeriYok metin="Oynaklık sınıfı bu turda ölçülemedi." kartsiz />
      ) : (
        <View style={styles.liste}>
          <Text style={[type.microBold, { color: colors.textDim }]}>Oynaklık (ATR / fiyat)</Text>
          <Satir
            etiket="ATR / fiyat"
            not="günlük ortalama bar aralığının fiyata oranı"
            deger={formatPercent(vol.atrPct)}
          />
          <Satir
            etiket="Oynaklık bandı"
            not={stopNot}
            deger={volCumle ?? EMPTY}
          />
          {/* İKİNCİ SORU: plan/stop bandı. Sessiz bantta HİÇBİR ŞEY. */}
          {plan.atrPlan === null ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Plan bandı ölçülemedi.
            </Text>
          ) : bandCumle ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>{bandCumle}</Text>
          ) : null}
        </View>
      )}

      {/* MOMENTUM — başlıktaki gerekçe. Ham alanlar, eşik/çevrim yok. */}
      {mom ? (
        <View style={styles.liste}>
          <Text style={[type.microBold, { color: colors.textDim }]}>Momentum rejimi</Text>
          <Satir
            etiket="Rejim"
            not="motorun kararı — eşik istemcide yok"
            deger={mom.active ? 'açık' : 'kapalı'}
          />
          <Satir etiket="Trend hizası" deger={evetHayir(mom.trendAligned)} />
          <Satir etiket="ADX" deger={formatOran(mom.adx, 1)} />
          <Satir
            etiket="Banda boşluk"
            not="KESİR — 0,0200 yüzde 2 demek; uç yüzdeye çevirmiyor"
            deger={formatOran(mom.gapPct, 4)}
          />
          {momBant ? <Satir etiket="Momentum alım bandı" deger={bant(momBant)} /> : null}
        </View>
      ) : (
        <VeriYok metin="Momentum rejimi bu turda ölçülmedi." kartsiz />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  liste: { gap: space.xxs },
});
