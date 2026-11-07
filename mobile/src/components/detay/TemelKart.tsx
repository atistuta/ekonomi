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
//  EŞİK MOTORDA. Bu yüzden rozet ÖLÇÜM DURUMUNU söylüyor ("ölçüldü" /
//  "ölçülemedi"), yargıyı değil: alt-skor sayısı yanında duruyor,
//  yargıyı kullanıcı motorun skorundan okuyor.
//
//  ── KRİTERİN CÜMLESİ: KOD + HAM SAYI (#12, 2026-11-03) ────────────
//  Web'in kriter `note` cümlesi uzun süre native'e HİÇ ulaşmıyordu:
//  `api/_akis.js` kriteri `{key, weight, score}`e kırpıyordu. Artık uç
//  cümle yerine MAKİNE KODU (`c.kod`) ve ham ölçümleri (`c.sayilar`)
//  gönderiyor. Cümle `lib/sozluk.ts` `FA_KRITER_SOZLUK`tan SEÇİLİYOR;
//  burada ne eşik ne formül var — `sayilar` yalnız BİÇİMLENİYOR
//  (`lib/format.ts`), hiçbir alan başka bir alandan türetilmiyor.
//  `birim` alanı bir makine kodu (`TRY`/`USD`), cümle değil.
//
//  ÜÇ DURUM AYRI ÇİZİLİYOR: `kod` alanı YOKSA kriter sözlükte
//  sorulmamış (hiçbir şey basılmaz), `null` ise sorulup ölçülememiş,
//  dolu ise cümle basılır. Kod sözlükte yoksa yine cümle basılmaz —
//  uydurma cümle yerine sessizlik.
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
//  ── KİREMİTLER (eklendi 2026-10-29) ────────────────────────────────
//  Web'de temel panelinin EN ÜSTÜNDE dört kiremit var (`app.js:5873`
//  civarı `tiles`): Son Fiyat · Piyasa Değeri · F/K (TTM) · HBK (TTM).
//  Native'de o düzen hiç basılmıyordu; fiyat/F-K/HBK yalnız tek satırlık
//  bir künye metninde geçiyordu.
//
//  ÜÇÜ `AnalyzeRow`DA, BİRİ DEĞİL: `fa.price` · `fa.pe` · `fa.eps`
//  analiz turundan geliyor; PİYASA DEĞERİ o kayıtta HİÇ YOK — künye
//  ucunda (`/api/yfin` → `marketCap`). Web onu `price × (ni / eps)` ile
//  TÜRETİYOR; native TÜRETMEZ (§5.1 ham sayı kuralı) — ya künyeden
//  gelen ham sayı basılır ya hiçbir şey.
//
//  NEDEN KART KENDİ TURUNU ATIYOR: aynı klasördeki `BacktestKart`,
//  `DegerKart` ve `TemettuKart` deseni bu — analiz turunun DIŞINDAKİ
//  bir uç, kendi zaman aşımı, kendi `Durum`u. Piyasa değerini ekran
//  props zincirine takmak, `AnalyzeRow` almayan bir alanı beş kartın
//  ortak sözleşmesine sokmak olurdu.
//
//  `deep: false`: `marketCap` `summaryDetail` modülünde
//  (`api/_yfin.js:104`); `deep=1` yalnız bilanço takvimi modüllerini
//  ekliyor — burada gereksiz dış çağrı olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import { fetchYfin, useIstek, type AnalyzeRow } from '@/api';
import {
  Card,
  Katlanir,
  OlcumBaslik,
  OlcumEksikRozet,
  Pill,
  ScoreGauge,
  VeriYok,
} from '@/components';
import { EMPTY, formatCompact, formatOran, formatPercent, formatPrice, formatScore } from '@/lib/format';
import { FA_KRITER_SOZLUK, sozluktenSec } from '@/lib/sozluk';
import { numeric, radius, space, type, useTheme } from '@/theme';

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

/**
 * `c.sayilar` alan adı → Türkçe ad + BİÇİM.                  (#12, 2026-11-03)
 *
 * YALNIZ AD VE BİÇİM EŞLEMESİ: hesap yok, eşik yok, hiçbir alan başka bir
 * alandan türetilmiyor. Bilinmeyen alan adı GİZLENMİYOR, ham adıyla ve
 * nötr biçimde basılıyor — uç yeni bir ölçüm eklediğinde ekran onu yutmaz.
 *
 * `birim` BU TABLODA YOK: o bir ölçüm değil, para birimi KODU (`TRY` /
 * `USD`) — tutar alanlarının biçimlendiricisine parametre olarak giriyor.
 *
 * `onceki` / `simdi` NİYE NÖTR BİÇİM: bu iki alan kriterden kritere başka
 * şey taşıyor (ROA ve brüt marj yüzde puanı, cari oran ise oran). Hepsine
 * "%" basmak, ölçünün yarısına yanlış birim takmak olurdu; birim UYDURMAK
 * yerine sayı ham basılıyor.
 */
const FA_SAYI_ALANI: Record<string, { ad: string; bicim: 'yuzde' | 'oran' | 'kat' | 'tutar' }> = {
  pct: { ad: 'ölçüm', bicim: 'yuzde' },
  kat: { ad: 'kat', bicim: 'kat' },
  oran: { ad: 'oran', bicim: 'oran' },
  tutar: { ad: 'tutar', bicim: 'tutar' },
  nakit: { ad: 'nakit', bicim: 'tutar' },
  borc: { ad: 'uzun vadeli borç', bicim: 'tutar' },
  stok: { ad: 'stok', bicim: 'tutar' },
  ocf: { ad: 'faaliyet nakit akışı', bicim: 'tutar' },
  netKar: { ad: 'net kâr', bicim: 'tutar' },
  onceki: { ad: 'önceki dönem', bicim: 'oran' },
  simdi: { ad: 'bu dönem', bicim: 'oran' },
};

/**
 * `c.sayilar` → tek satırlık HAM ölçüm metni. Ölçülemeyen alan (sayı
 * değil ya da sonsuz) ATLANIR: `0` basmak yok. Hiçbir alan basılamazsa
 * `null` döner ve çağıran satır çizmez ("ölçtüm, sayı çıkmadı" ile
 * "sormadım" ayrımı cümlede değil, kodun varlığında duruyor).
 */
function faSayiSatiri(sayilar: Record<string, number | string> | null | undefined): string | null {
  if (!sayilar || typeof sayilar !== 'object') return null;
  const birim = typeof sayilar.birim === 'string' ? sayilar.birim : null;
  const parcalar: string[] = [];
  for (const alan of Object.keys(sayilar)) {
    if (alan === 'birim') continue;
    const v = sayilar[alan];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const tanim = FA_SAYI_ALANI[alan];
    const bicim = tanim?.bicim ?? 'oran';
    const metin =
      bicim === 'yuzde'
        ? formatPercent(v)
        : bicim === 'kat'
          ? formatOran(v) + '×'
          : bicim === 'tutar'
            ? formatCompact(v) + (birim ? ' ' + birim : '')
            : formatOran(v);
    parcalar.push((tanim?.ad ?? alan) + ' ' + metin);
  }
  return parcalar.length ? parcalar.join(' · ') : null;
}

export type TemelKartProps = {
  satir: AnalyzeRow;
  /**
   * Künye ucunun isteyeceği sembol — ÇAĞIRANIN yazımı (BIST'te `.IS`
   * sonekli). Verilmezse `satir.sym`e düşer; o yazım sonek taşımıyorsa
   * künye turu BIST kaydını bulamaz ve piyasa değeri "ölçülemedi"
   * görünür — bu yüzden ekran kendi çözdüğü sembolü veriyor.
   */
  sembol?: string;
};

export function TemelKart({ satir, sembol }: TemelKartProps) {
  const { colors } = useTheme();
  const fa = satir.fa;
  const kriterler = fa.criteria ?? [];

  // PİYASA DEĞERİ İÇİN AYRI TUR (başlıktaki gerekçe). Kartın geri kalanı
  // bu turun durumuna BAĞLI DEĞİL: künye düşse de temel skor ve
  // kriterler basılır — komşu istek düştüğü için ölçülmüş veriyi
  // saklamak olurdu.
  const kunyeSembol = sembol ?? satir.sym;
  const kunyeCagri = useCallback(
    (signal: AbortSignal) => fetchYfin([kunyeSembol], { deep: false, signal }),
    [kunyeSembol],
  );
  // Anahtar DİZGİ (`useIstek` nesne anahtarı kabul etmiyor) ve `|temel`
  // ekiyle ayrı: aynı ekrandaki temettü kartı da künye çekiyor, iki
  // isteğin anahtarı çakışmasın.
  const kunye = useIstek(kunyeCagri, kunyeSembol + '|temel', {
    etkin: Boolean(kunyeSembol),
  });
  const kunyeKayit = kunye.veri?.results?.[0] ?? null;
  // ÜÇ DAL: künye turu daha bitmedi (`durum !== 'veri'`) → "sormadım
  // değil, bekliyor"; `ok:false` ya da alan `null` → ölçülemedi; sayı
  // geldi → basılır. Hiçbir dalda 0 UYDURULMUYOR.
  const piyasaDegeri =
    kunyeKayit?.ok && typeof kunyeKayit.marketCap === 'number' ? kunyeKayit.marketCap : null;
  const piyasaKur = kunyeKayit?.currency ?? null;
  // 52 HAFTALIK TEPE/DIP — AYNI künye turundan (ek ağ turu AÇILMADI;
  // `deep:false` cevabının `summaryDetail` bloğunda geliyor).
  // ⚠️ BANT KONUMU TÜRETİLMİYOR: `(fiyat - dip) / (tepe - dip)` bir
  // türev oran ve native'de yasak. İki sayı AYRI AYRI basılıyor,
  // fiyat zaten kendi kiremidinde.
  const haftaTepe =
    kunyeKayit?.ok && typeof kunyeKayit.fiftyTwoWeekHigh === 'number'
      ? kunyeKayit.fiftyTwoWeekHigh
      : null;
  const haftaDip =
    kunyeKayit?.ok && typeof kunyeKayit.fiftyTwoWeekLow === 'number'
      ? kunyeKayit.fiftyTwoWeekLow
      : null;
  // ÜÇ DAL AYRI: tur sürüyor · alan gövdede HİÇ YOK (eski uç, "sorulmadı")
  // · alan var ama `null`/sayı değil ("ölçemedi").
  // TASARIM TURU 1: DÖRDÜNCÜ dal (ölçüm başarılı) artık `null` dönüyor,
  // yani kiremidin altına not BASILMIYOR — "künye ucundan (52 hafta)"
  // cümlesi iki kiremitte iki kez tekrar etmek yerine bölüm başlığında
  // BİR kez duruyor. Bilgi silinmedi, yeri değişti. Ölçüm EKSİKLİĞİNİ
  // anlatan üç dal olduğu gibi kaldı: eksiklik satırın kendi künyesi.
  function haftaNot(
    deger: number | null,
    anahtar: 'fiftyTwoWeekHigh' | 'fiftyTwoWeekLow',
  ): string | null {
    if (kunye.durum !== 'veri') return 'künye turu sürüyor';
    if (kunyeKayit === null || !(anahtar in kunyeKayit)) return 'uç bu alanı GÖNDERMEDİ';
    if (deger === null) return 'künye ölçemedi — türetilmiyor';
    return null;
  }

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

      {/* KİREMİTLER — web'in dört kiremidi, aynı sıra ve adlarla.
          Eski tek satırlık "EPS … · F/K …" künyesi BURAYA KATLANDI;
          aynı sayıyı iki yerde basmak, birini güncelleyip ötekini
          unutma kapısıydı. F/K burada fiyat ÷ HBK ile yeniden
          kurulmuyor (uç `pe` gönderiyor), piyasa değeri de
          türetilmiyor. */}
      <View style={styles.kiremitler}>
        <Kiremit
          etiket="Son Fiyat"
          deger={formatPrice(fa.price, piyasaKur)}
          not={fa.price === null ? 'uç ölçemedi' : null}
        />
        <Kiremit
          etiket="Piyasa Değeri"
          deger={formatCompact(piyasaDegeri)}
          not={
            kunye.durum !== 'veri'
              ? 'künye turu sürüyor'
              : piyasaDegeri === null
                ? 'künye ölçemedi — türetilmiyor'
                : 'künye ucundan'
          }
        />
        <Kiremit
          etiket="F/K (TTM)"
          deger={typeof fa.pe === 'number' ? formatOran(fa.pe) : EMPTY}
          not={typeof fa.pe === 'number' ? null : 'uç ölçemedi'}
        />
        <Kiremit
          etiket="HBK (TTM)"
          deger={typeof fa.eps === 'number' ? formatOran(fa.eps) : EMPTY}
          not={typeof fa.eps === 'number' ? null : 'uç ölçemedi'}
        />
      </View>

      {/* TASARIM TURU 1: 52 hafta kiremitleri AYRI BÖLÜM. Gerekçe: dördü
          `/api/analyze` ucundan, ikisi `/api/yfin` künyesinden geliyor ve
          ikisinin ölçüm penceresi (52 hafta) ile birimi (PARA) ortak.
          Altı kiremit tek ızgarada dururken bu ayrım görünmüyordu ve
          kaynak künyesi iki kiremitte iki kez yazılıyordu. */}
      <View style={styles.hafta}>
        <OlcumBaslik baslik="52 hafta aralığı" birim="PARA" not="künye ucundan" />
        <View style={styles.kiremitler}>
          <Kiremit
            etiket="52 Hafta Tepe"
            deger={haftaTepe === null ? EMPTY : formatPrice(haftaTepe, piyasaKur)}
            not={haftaNot(haftaTepe, 'fiftyTwoWeekHigh')}
          />
          <Kiremit
            etiket="52 Hafta Dip"
            deger={haftaDip === null ? EMPTY : formatPrice(haftaDip, piyasaKur)}
            not={haftaNot(haftaDip, 'fiftyTwoWeekLow')}
          />
        </View>
        {haftaTepe !== null || haftaDip !== null ? (
          <Text style={[type.micro, { color: colors.textFaint }]}>
            Fiyatın bu aralığın neresinde durduğu HESAPLANMADI — o bir türev
            oran ve bu ekranda hesap yapılmıyor.
          </Text>
        ) : null}
      </View>

      {kriterler.length ? (
        // TASARIM TURU 1: kriter listesi katlanır ve VARSAYILAN AÇIK —
        // temel skorun "neden" cevabı bu liste; ham künye değil. "/100"
        // her satırda tekrar etmek yerine başlıkta bir kez.
        <Katlanir
          baslik="Kriter dökümü"
          ozet={kriterler.length + ' kriter'}
          birim="alt skor 0-100"
          acikBaslangic>
          {kriterler.map((c) => {
            const olculdu = typeof c.score === 'number' && Number.isFinite(c.score);
            const ad = FA_ETIKET[c.key] ?? c.key;
            // Cümle SÖZLÜKTEN (başlıktaki gerekçe): kod yoksa, `null` ise
            // ya da sözlükte karşılığı yoksa `null` döner → satır çizilmez.
            const cumle = sozluktenSec(FA_KRITER_SOZLUK, c.kod);
            const sayiMetni = faSayiSatiri(c.sayilar);
            return (
              <View key={c.key} style={styles.satirSarmal}>
                <Satir
                  etiket={ad}
                  not={'ağırlık ' + formatOran(c.weight)}
                  deger={olculdu ? formatScore(c.score) : EMPTY}
                  erisimEtiketi={
                    (olculdu
                      ? ad + ' alt skoru ' + formatScore(c.score) + ', ağırlık ' + formatOran(c.weight)
                      : ad + ' ölçülemedi') + (cumle ? '. ' + cumle : '')
                  }
                />
                {cumle ? (
                  <Text style={[type.micro, { color: colors.textDim }]}>{cumle}</Text>
                ) : null}
                {sayiMetni ? (
                  <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
                    {sayiMetni}
                  </Text>
                ) : null}
                {/* ROZET YARGI DEĞİL ÖLÇÜM DURUMU (başlıktaki gerekçe):
                    `score === null` olan kriter skora hiç girmiyor
                    (api/_motor.js computeFaScore `c.score != null`). */}
                {olculdu ? null : (
                  <Pill label="ölçülemedi" tone="gold" glyph={null} size="sm" />
                )}
              </View>
            );
          })}
        </Katlanir>
      ) : (
        <VeriYok metin="Kriter listesi bu turda gelmedi." kartsiz />
      )}
    </Card>
  );
}

/**
 * Tek kiremit. Sayı `tabular-nums` — dört kiremit yan yana dururken
 * orantılı rakam sütunları birbirine göre kayıyordu.
 *
 * `not` ÖLÇÜM DURUMUNU söylüyor, yargı DEĞİL: "ölçemedi" ile "sürüyor"
 * aynı tire altında birleşirse kullanıcı bekleyen turu veri yokluğu
 * sanar.
 */
function Kiremit({
  etiket,
  deger,
  not,
}: {
  etiket: string;
  deger: string;
  not?: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.kiremit, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={etiket + ': ' + deger + (not ? ', ' + not : '')}>
      <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={1}>
        {etiket}
      </Text>
      <Text style={[type.bodyBold, numeric, { color: colors.text }]} numberOfLines={1}>
        {deger}
      </Text>
      {not ? (
        <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
          {not}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  satirSarmal: { gap: space.xxs },
  // Ham olcum satiri tabular-nums: alt alta duran sayilar kaymasin.
  num: { ...numeric },
  // 52 hafta bölümü: başlık + ızgara + ölçüm notu tek grup.
  hafta: { gap: space.xs },
  kiremitler: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  // İki sütun hedefi: `minWidth` ile dar ekranda alta düşüyor, geniş
  // ekranda dördü iki sıraya yerleşiyor.
  kiremit: {
    flexGrow: 1,
    flexBasis: '42%',
    minWidth: 120,
    gap: space.xxs,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
});
