// =====================================================================
//  ⚡ MOMENTUM GİRİŞİ — rejimi AÇIK satırlar          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/recommend` turunun satırlarından `plan.momentum.active`
//  olanları ayırıp ADX'e göre dizer ve her birinin momentum künyesini
//  basar: sembol · ADX · banda boşluk · momentum alım bandı.
//
//  NİYE VAR (ÖLÇÜLDÜ 2026-11-03): webin `⚡ Momentum girişi` AYRI BİR
//  SEKMESİ var (`index.html:203` `#tab-momentum`) ve native'de karşılığı
//  YOKTU. Rejim native'de yalnız TEK sembolün detayında basılıyordu
//  (`components/detay/RiskOdulKart.tsx:319`); "evrende momentumu açık
//  olanlar hangileri" sorusunun native'de cevabı yoktu.
//
//  YENİ UÇ AÇILMADI, YENİ İSTEK DE ATILMIYOR: web o sekmede evreni
//  TARAYICIDA tarıyor (`app.js:8127 scanMomentumUniverse` → her sembol
//  için `ensureDailyCandles` + `computeVadeScore` + `momentumInfo`,
//  eşzamanlılık 4). Native'de gösterge matematiği YOK ve olmayacak;
//  aynı karar sunucuda ZATEN veriliyor: `api/_akis.js:305`
//  `momentum: hamYuvarla(eng.momentumInfo(r, vade))`. Keşfet sekmesi
//  de zaten TEK bir `fetchRecommend(liste, { vade: 'orta' })` atıyor
//  (`app/(tabs)/kesfet.tsx:95`) — webin o sekmesiyle AYNI vade, AYNI
//  evren (kullanıcının listesi). Yani bu kart ikinci bir tur ÖDEMİYOR,
//  ödenmiş turun okunmayan uzvunu basıyor.
//
//  NEDEN AYRI KART, RiskOdulKart'a EK DEĞİL: o kart TEK sembolün plan
//  dökümü (detay ekranı) ve momentum orada `plan`ın dördüncü uzvu
//  olarak zaten yazılı. Buradaki soru başka: evren genelinde SÜZGEÇ.
//  İki ekran aynı alanı iki ayrı soru için okuyor; ikisi birbirinin
//  yerine geçmiyor.
//
//  SIRALAMA SERBEST, HESAP DEĞİL: `adx` MOTORUN ürettiği sayı. İki
//  satırı o sayıya göre yan yana dizmek yeni bir ölçü doğurmuyor —
//  eşik, ağırlık, bölme, çarpma YOK. Eşitlikte teknik skora bakılıyor;
//  bu da motorun sayısı. Web aynı iki ölçütle diziyor (`app.js:8154`).
//
//  SÜZGEÇ DE HESAP DEĞİL: `active` bir BOOLEAN ve kararı motorun
//  (`api/_motor.js:981 momentumInfo` — ADX ≥ 22, skor ≥ 56, banda
//  boşluk vade eşiği). O eşiklerin HİÇBİRİ burada yazılı değil; kart
//  yalnız motorun verdiği bayrağa bakıyor.
//
//  `gapPct` KESİR, YÜZDE PUANI DEĞİL (`api/_motor.js:988`:
//  `(p - bzTop) / p`). `formatOran` ile basılıyor ve ×100 YAPILMIYOR —
//  RiskOdulKart ile AYNI ölçek. Web o sekmede `Math.round(gapPct*100)`
//  yazıyor; iki ekranda iki ayrı ölçek göstermek yerine native tek
//  ölçekte kalıyor ve ölçeği altyazı söylüyor.
//
//  `zone` TİPTE AD İLE YOK: `PlanMomentum`'un index imzasından
//  (`[k: string]: unknown`) geliyor, bu yüzden `sayiDizisi()` kapısından
//  geçiyor. Tip genişletilmedi — alan kümesinin uçta sabit olmadığını
//  tipin kendi notu söylüyor (RiskOdulKart'taki gerekçenin aynısı).
//
//  ÜÇ AYRI BOŞLUK, TEK CÜMLEYE SIKIŞTIRILMADI:
//    · hiçbir satırda rejim ölçülmemiş (`plan === null`, ör. vade
//      'gunici' → TA koşmadı) → "HİÇ ölçülmedi"
//    · ölçülmüş ama hiçbiri açık değil → "ölçtüm, N sembolde rejim
//      kapalı" (bu bir ÖLÇÜM, eksiklik değil)
//    · bir kısmı ölçülememiş → ayrı bir not, açık satırların yanında
//  Webin tek cümlesi ("uygun hisse yok") bu üçünü ayırmıyordu.
//
//  LİSTE ETİKETİ BASILMIYOR: web satırın altına "bu sembol hangi
//  listelerde" etiketi koyuyor (`app.js:8164 momListsFor`), çünkü orada
//  evren BİRDEN ÇOK kullanıcı listesinin birleşimi. Native'de takip
//  listesi TEK (`api/liste.ts`), yani etiket her satırda aynı şeyi
//  yazardı. Alan uydurulmadı, sessizce de düşürülmedi: gerekçesi burada.
//
//  VERİ BU KARTIN İÇİNDE ÇEKİLMİYOR: `fetch` yok. Tur sahibi ekran
//  (Keşfet) tek istek atıyor, kartlar prop okuyor.
//
//  BURADA HESAP YOK: bandın ortası alınmaz, fiyatla boşluk kıyaslanmaz,
//  ADX bir bandı doğurmaz.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, Market, PlanMomentum, RecommendRow, Sayac } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type MomentumKartProps = {
  /** `/api/recommend` turunun satırları. Kart bunu KENDİ çekmiyor. */
  satirlar: RecommendRow[];
  /** `useIstek` durumu — yükleniyor/boş/hata hâllerini `Durum` çiziyor. */
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /**
   * Turun künyesi (`tam` + `sayac`). Verilirse eksik ölçüm rozeti
   * satırların ÜSTÜNDE çizilir; verilmezse "ölçüm tam" iddiası
   * üretilmez.
   */
  kaynak?: { tam?: boolean; sayac?: Sayac } | null;
  /** Satıra dokunulunca çağrılır. `pazar` İKİNCİ parametre (BIST `.IS`). */
  onSembol?: (sym: string, pazar?: string | null) => void;
  /** Kaç satır gösterilsin. Verilmezse HEPSİ yazılır. */
  azami?: number;
};

/** Pazar → para birimi kodu. Eşleme, hesap değil (BIST ₺, ABD simgesiz). */
function paraBirimi(market: Market): string | null {
  return market === 'BIST' ? 'TRY' : null;
}

/**
 * Index imzasından gelen `[alt, üst]` dizisi: iki ucu da SAYI ise döner.
 * Dönüştürme YOK — `Number(v)` yazmak ucun göndermediği bir sayıyı
 * uydurmak olurdu (RiskOdulKart `sayiDizisi` ile aynı kapı).
 */
function sayiDizisi(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const sayilar = v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return sayilar.length >= 2 ? sayilar : null;
}

/** Sayı mı? `0` geçerli bir ölçümdür, `null`/`undefined` değildir. */
function sayiVarsa(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Rejim ÖLÇÜLDÜ MÜ: `plan === null` → TA koşmadı (ölçüm yok).
 * `plan.momentum === null` → uç ölçemedi. İkisi de "ölçülmedi" sayılır;
 * motorun kapalı turu (`{active:false}`) ise ÖLÇÜLMÜŞ bir cevaptır.
 */
function rejim(satir: RecommendRow): PlanMomentum | null {
  const m = satir.plan?.momentum;
  return m && typeof m === 'object' ? m : null;
}

export function MomentumKart({
  satirlar,
  durum,
  hata,
  yenile,
  kaynak,
  onSembol,
  azami,
}: MomentumKartProps) {
  const { colors } = useTheme();

  // Üç küme AYRI sayılıyor; hiçbiri ötekinin yerine geçmiyor.
  const olculen = satirlar.filter((r) => rejim(r) !== null);
  const olcemeyen = satirlar.length - olculen.length;
  const acik = olculen.filter((r) => rejim(r)?.active === true);

  // `slice()` bilinçli: gelen diziyi yerinde sıralamak aynı diziyi okuyan
  // öteki kartların (Fırsatlar) sırasını da sessizce değiştirirdi.
  const sirali = acik.slice().sort((a, b) => {
    const aa = sayiVarsa(rejim(a)?.adx);
    const ab = sayiVarsa(rejim(b)?.adx);
    if (aa !== null && ab !== null && aa !== ab) return ab - aa;
    if (aa === null && ab !== null) return 1;
    if (ab === null && aa !== null) return -1;
    // Eşitlikte motorun teknik skoru; o da ölçülemediyse sıra korunur.
    const sa = sayiVarsa(a.ta.score);
    const sb = sayiVarsa(b.ta.score);
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa;
  });
  const gosterilen = typeof azami === 'number' && azami > 0 ? sirali.slice(0, azami) : sirali;
  const kesilen = sirali.length - gosterilen.length;

  return (
    <Card
      title="⚡ Momentum girişi"
      subtitle="Rejim kararı MOTORUN; banda boşluk KESİR olarak yazılı (0,0500 = yüzde 5)">
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={2}
        sekil="sira"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {durum === 'veri' ? (
        <>
          {/* UYARI SÜZGEÇTEN ÖNCE: neyin süzüldüğü, satırlar görülmeden
              okunuyor. "Rejim açık" bir yön ya da kesinlik iddiası
              değil; motorun trend gücü + banda boşluk okuması. */}
          <View style={[styles.uyari, { borderColor: colors.border }]}>
            <Pill label="rejim ≠ kesinlik" tone="info" glyph={null} size="sm" />
            <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
              “Rejim açık”, motorun trend gücü ve banda boşluk ölçümünün birlikte okunması
              demek. Yön iddiası ya da giriş emri DEĞİLDİR; eşikler motorda.
            </Text>
          </View>

          {kaynak ? <OlcumEksikRozet kaynak={kaynak} /> : null}

          {/* ÜÇ AYRI DAL (başlıktaki gerekçe). */}
          {!olculen.length ? (
            <VeriYok
              kartsiz
              metin="Momentum rejimi bu turda HİÇ ölçülmedi — satırların teknik ayağı koşmadı."
            />
          ) : !gosterilen.length ? (
            <VeriYok
              kartsiz
              metin={
                olculen.length +
                ' sembolde rejim ölçüldü; hiçbirinde açık değil. Bu bir ölçüm, eksik veri değil.'
              }
            />
          ) : (
            gosterilen.map((r) => <MomentumSatiri key={r.sym} satir={r} onSembol={onSembol} />)
          )}

          {/* AÇIK SATIRLARIN YANINDAKİ EKSİKLİK AYRI CÜMLE: ölçülmüş
              satırların sayısıyla karıştırılmıyor. */}
          {olcemeyen > 0 ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {olcemeyen +
                ' sembolde rejim ÖLÇÜLEMEDİ (plan üretilmedi); bu satırlar yukarıdaki süzgece hiç girmedi.'}
            </Text>
          ) : null}

          {kesilen > 0 ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {kesilen + ' satır daha açık; burada ilk ' + gosterilen.length + ' tanesi yazılı.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek momentum satırı. Üç sayı da HAM; biçimleme `lib/format.ts`.
 *
 * NEDEN BAND BİR SATIR AŞAĞIDA: `zone` İKİ fiyat ve satırın en uzun
 * kalemi. Sembolle aynı satıra sıkıştırmak ADX'i kenara itiyordu.
 */
function MomentumSatiri({
  satir,
  onSembol,
}: {
  satir: RecommendRow;
  onSembol?: (sym: string, pazar?: string | null) => void;
}) {
  const { colors } = useTheme();
  const mom = rejim(satir);
  const birim = paraBirimi(satir.market);
  const bant = sayiDizisi(mom?.zone);
  const adx = sayiVarsa(mom?.adx);
  const bosluk = sayiVarsa(mom?.gapPct);

  const govde = (
    <>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {satir.sym}
        </Text>
        <Pill label="rejim açık" tone="neutral" variant="outline" glyph={null} size="sm" />
        <View style={styles.bosluk} />
        {/* Etiket metinle yazılı ki sayı tek başına anlamsız kalmasın. */}
        <Text style={[type.smallBold, styles.num, { color: colors.gold }]}>
          {'ADX ' + (adx === null ? EMPTY : formatOran(adx, 1))}
        </Text>
      </View>

      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'banda boşluk ' + (bosluk === null ? EMPTY : formatOran(bosluk, 4)) + '  (kesir)'}
      </Text>

      {bant ? (
        <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
          {'momentum alım bandı ' +
            formatPrice(bant[0], birim) +
            ' – ' +
            formatPrice(bant[1], birim)}
        </Text>
      ) : (
        // Rejim açık ama band gelmedi → uydurulmuyor, söyleniyor.
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu satırda momentum alım bandı gelmedi.
        </Text>
      )}
    </>
  );

  if (!onSembol) {
    return <View style={styles.satir}>{govde}</View>;
  }

  return (
    <Pressable
      onPress={() => onSembol(satir.sym, satir.market)}
      accessibilityRole="button"
      accessibilityLabel={satir.sym + ' momentum satırı — analize git'}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.satir,
        styles.basilabilir,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      {govde}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  basilabilir: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  uyari: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
