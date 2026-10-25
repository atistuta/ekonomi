// =====================================================================
//  🔎 TARAMA — ölçüt süzgeci, YALNIZ KARŞILAŞTIRMA    (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/recommend` satırlarını kullanıcının seçtiği ölçütlere göre
//  süzer. Ölçütler çipten (basılabilir `Pill`) seçilir, birden çoğu
//  seçilirse VE ile birleşir ve kaç satırın geçtiği yazılır.
//
//  ── SÜZME NEDEN HESAP DEĞİL ────────────────────────────────────────
//  Her ölçüt UÇTAN GELEN BİR ALANIN karşılaştırmasıdır:
//    · `composite.blendedShown` ≥ 70   (motorun gösterdiği bileşke)
//    · `ta.score` ≥ 70                 (motorun teknik skoru)
//    · `fa.score` ≥ 70                 (motorun temel skoru)
//    · `plan.yakinlik.state` ∈ {in, near, below}  (motorun yakınlık kararı)
//    · `plan.momentum.active === true` (motorun rejim kararı)
//    · `tam === true`                  (turun kesintisizliği)
//  Hiçbiri yeni bir gösterge TÜRETMİYOR: toplama, ağırlıklandırma,
//  normalleştirme, bant eşlemesi YOK. 70 sayısı bir SÜZGEÇ AYARI —
//  kullanıcının "şu eşiğin üstünü göster" isteği; motorun skoruna
//  karışmıyor, skoru değiştirmiyor, yeni bir skor üretmiyor. Bir
//  gösterge eklemek gerekirse yeri MOTOR, burası değil.
//
//  NEDEN `blendedShown`, `blended` DEĞİL: `blendedShown` motorun
//  KULLANICIYA GÖSTERDİĞİ yuvarlanmış sayı (api/types.ts). Süzgeç ekranda
//  yazan sayıyla aynı sayıyı okumalı, yoksa "70" yazan satır 69,6 diye
//  süzgeçten düşer ve kullanıcı haklı olarak uygulamaya güvenmez.
//  `blendedShown` yoksa `blended`e düşülüyor — bu bir YEDEK OKUMA,
//  hesap değil.
//
//  NEDEN ÖLÇÜLEMEYEN SATIR ÖLÇÜTÜ GEÇMİYOR: `ta.score === null`
//  "düşük skor" DEĞİL, "ölçülemedi". İkisini aynı kefeye koyup eşiğin
//  altına atmak yanlış olurdu; bu yüzden süzgeç dışında kalan satırların
//  SAYISI ve içlerinden kaçının ölçümü eksik olduğu kartın dibinde
//  ayrıca yazılı — sessizce kaybolmuyorlar.
//
//  NEDEN SEÇİM RENKLE DEĞİL İŞARETLE: seçili çipin başında "•" var ve
//  tonu değişiyor; `accessibilityState.selected` da veriliyor. Renk tek
//  taşıyıcı olsaydı renk körü kullanıcı hangi ölçütün açık olduğunu
//  göremezdi (yol haritası kuralı).
//
//  VERİ BU KARTIN İÇİNDE ÇEKİLMİYOR: `fetch` yok; satırlar prop.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  olcumEksik,
  type ApiError,
  type IstekDurum,
  type Market,
  type RecommendRow,
  type Sayac,
} from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { formatPrice, formatScore } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

/** Süzgeç eşiği — SKOR DEĞİL, kullanıcı süzgecinin ayarı (bkz. başlık). */
const ESIK = 70;

/** Motorun "alım bandına yakın" saydığı durumlar (sabit küme, uçtan). */
const YAKIN_DURUMLAR = ['in', 'near', 'below'];

/** Ölçüt kimlikleri — çip etiketiyle süzgeç işlevini tek yerde bağlar. */
export type TaramaOlcutId =
  | 'bileske70'
  | 'ta70'
  | 'fa70'
  | 'bandaYakin'
  | 'momentum'
  | 'olcumTam';

type Olcut = {
  id: TaramaOlcutId;
  etiket: string;
  /** Satırın ölçütü geçip geçmediği. YALNIZ alan karşılaştırması. */
  gecer: (r: RecommendRow) => boolean;
};

/** Motorun gösterdiği bileşke. Yedek okuma: `blendedShown` → `blended`. */
function bileske(r: RecommendRow): number | null {
  const v = r.composite?.blendedShown ?? r.composite?.blended ?? null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function esikGecer(v: number | null | undefined): boolean {
  // `null` → ölçülemedi. "Eşiğin altında" DEĞİL; ölçüt geçmiyor ama
  // bunun sebebi kartın dibinde ayrıca sayılıyor.
  return typeof v === 'number' && Number.isFinite(v) && v >= ESIK;
}

const OLCUTLER: readonly Olcut[] = [
  {
    id: 'bileske70',
    etiket: 'bileşke ≥ ' + ESIK,
    gecer: (r) => esikGecer(bileske(r)),
  },
  { id: 'ta70', etiket: 'teknik ≥ ' + ESIK, gecer: (r) => esikGecer(r.ta?.score) },
  { id: 'fa70', etiket: 'temel ≥ ' + ESIK, gecer: (r) => esikGecer(r.fa?.score) },
  {
    id: 'bandaYakin',
    etiket: 'alım bandına yakın',
    gecer: (r) => {
      const s = r.plan?.yakinlik?.state;
      return typeof s === 'string' && YAKIN_DURUMLAR.includes(s);
    },
  },
  { id: 'momentum', etiket: 'momentum aktif', gecer: (r) => r.plan?.momentum?.active === true },
  { id: 'olcumTam', etiket: 'ölçümü tam', gecer: (r) => r.tam === true },
];

export type TaramaKartProps = {
  /** `/api/recommend` turunun satırları. Kart bunu KENDİ çekmiyor. */
  satirlar: RecommendRow[];
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** Turun künyesi; verilirse eksik ölçüm rozeti çizilir. */
  kaynak?: { tam?: boolean; sayac?: Sayac } | null;
  /** Satır dokunuşunun karşılığı çağıranın kararı; yoksa satır basılmaz. */
  onSembol?: (sym: string) => void;
  /** Açılışta seçili ölçütler. Verilmezse süzgeç KAPALI başlar. */
  baslangicOlcutler?: readonly TaramaOlcutId[];
};

/** Pazar → para birimi kodu. Eşleme, hesap değil. */
function paraBirimi(market: Market): string | null {
  return market === 'BIST' ? 'TRY' : null;
}

export function TaramaKart({
  satirlar,
  durum,
  hata,
  yenile,
  kaynak,
  onSembol,
  baslangicOlcutler,
}: TaramaKartProps) {
  const { colors } = useTheme();
  const [secili, setSecili] = useState<TaramaOlcutId[]>(() => [...(baslangicOlcutler ?? [])]);

  const degistir = (id: TaramaOlcutId) => {
    setSecili((onceki) =>
      onceki.includes(id) ? onceki.filter((x) => x !== id) : [...onceki, id],
    );
  };

  // Süzme: seçili her ölçüt VE ile birleşiyor. Hiçbiri seçili değilse
  // liste olduğu gibi geçiyor — "hiç ölçüt yok" demek "hiç satır yok"
  // demek değil.
  const gecen = useMemo(() => {
    if (!secili.length) return satirlar;
    const aktif = OLCUTLER.filter((o) => secili.includes(o.id));
    return satirlar.filter((r) => aktif.every((o) => o.gecer(r)));
  }, [satirlar, secili]);

  // Süzgeçten düşenlerin kaçı ÖLÇÜLEMEDİ: "eşiğin altında kaldı" ile
  // "ölçülemedi" aynı cümlede anlatılmasın.
  const dusenEksik = useMemo(() => {
    const gecenSet = new Set(gecen.map((r) => r.sym));
    return satirlar.filter((r) => !gecenSet.has(r.sym) && olcumEksik(r)).length;
  }, [satirlar, gecen]);

  return (
    <Card
      title="🔎 Tarama"
      subtitle="Ölçüt süzgeci — yalnız motorun döndürdüğü alanların karşılaştırması">
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="sira"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {durum === 'veri' ? (
        <>
          <View style={styles.cipler}>
            {OLCUTLER.map((o) => {
              const aktif = secili.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => degistir(o.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={
                    'Ölçüt: ' + o.etiket + (aktif ? ' — açık, kapatmak için dokun' : ' — kapalı')
                  }
                  hitSlop={space.sm}
                  style={({ pressed }) => [
                    styles.cipKabi,
                    pressed ? { backgroundColor: colors.bgPressed } : null,
                  ]}>
                  {/* Seçim RENKLE DEĞİL: başta "•", tonu da değişiyor. */}
                  <Pill
                    label={(aktif ? '• ' : '') + o.etiket}
                    tone={aktif ? 'gold' : 'neutral'}
                    variant={aktif ? 'soft' : 'outline'}
                    glyph={null}
                    size="sm"
                  />
                </Pressable>
              );
            })}
          </View>

          <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
            {secili.length
              ? gecen.length + ' / ' + satirlar.length + ' satır ' + secili.length + ' ölçütü geçti'
              : satirlar.length + ' satır — süzgeç kapalı, hepsi yazılı'}
          </Text>

          {kaynak ? <OlcumEksikRozet kaynak={kaynak} /> : null}

          {!satirlar.length ? (
            <VeriYok
              kartsiz
              metin="Motor bu semboller için sonuç döndürmedi; süzülecek satır yok."
            />
          ) : !gecen.length ? (
            // Satır VAR, ölçüt geçen yok. İkisi ayrı cümle: ölçüldü ve
            // hiçbiri ölçütü geçmedi.
            <VeriYok
              kartsiz
              metin="Satırlar ölçüldü ama seçili ölçütleri geçen sembol yok. Bir ölçüt kapatıp dene."
            />
          ) : (
            gecen.map((r) => <TaramaSatiri key={r.sym} satir={r} onSembol={onSembol} />)
          )}

          {dusenEksik > 0 ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Süzgeç dışında kalan ' +
                dusenEksik +
                ' satırın ölçümü eksikti — “eşiğin altında” demiyoruz, ÖLÇEMEDİK.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Süzgeci geçen satırın künyesi. Gösterilen her sayı UÇTAN: bileşke,
 * teknik, temel ve fiyat. Süzgeç bu sayıların hiçbirini değiştirmiyor.
 */
function TaramaSatiri({
  satir,
  onSembol,
}: {
  satir: RecommendRow;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const birim = paraBirimi(satir.market);
  const bl = bileske(satir);
  const bant = satir.composite?.band ?? null;

  const govde = (
    <>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {satir.sym}
        </Text>
        {bant ? <Pill label={bant} tone="info" glyph={null} size="sm" /> : null}
        <View style={styles.bosluk} />
        <Text style={[type.smallBold, styles.num, { color: colors.text }]}>
          {'bileşke ' + formatScore(bl)}
        </Text>
      </View>
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'teknik ' +
          formatScore(satir.ta?.score) +
          ' · temel ' +
          formatScore(satir.fa?.score) +
          ' · fiyat ' +
          formatPrice(satir.fa?.price, birim)}
      </Text>
    </>
  );

  if (!onSembol) {
    return <View style={styles.satir}>{govde}</View>;
  }

  return (
    <Pressable
      onPress={() => onSembol(satir.sym)}
      accessibilityRole="button"
      accessibilityLabel={satir.sym + ' — analize git'}
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
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Çipin kendisi küçük; dokunma hedefi 44'ü kabı tutuyor.
  cipKabi: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
