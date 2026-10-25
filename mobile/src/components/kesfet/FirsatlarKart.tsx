// =====================================================================
//  🔥 FIRSATLAR — risk/ödül sıralı plan satırları     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/recommend` turundan gelen satırları `plan.riskOdul.rrRatio`
//  büyükten küçüğe dizip her birinin plan künyesini basar: sembol ·
//  fiyat · hedef · stop · rr. Seviyeler `plan.seviye`den, oran
//  `plan.riskOdul`dan okunuyor.
//
//  NEDEN SIRALAMA SERBEST, HESAP DEĞİL: `rrRatio` MOTORUN ürettiği
//  sayı (api/recommend sözleşmesi). Burada iki satırı o sayıya göre
//  yan yana dizmek yeni bir ölçü DOĞURMUYOR — hiçbir bölme, çarpma,
//  eşik ya da bant istemcide kurulmuyor. Motor "2,4" dediyse ekranda
//  2,4 yazıyor; sıra yalnızca okuma kolaylığı.
//
//  ── `rrRatio` NEDEN AÇIKÇA UYARI İSTİYOR ──────────────────────────
//  Uç notu birebir şöyle diyor: `rrRatio` YALNIZ MESAFE ORANI, olasılık
//  DEĞİL (bkz. api/types.ts `PlanRiskOdul`). Yani "3,0" demek "kazanma
//  şansı %75" demek değil; hedefe olan uzaklığın stopa olan uzaklığa
//  bölümü. Bu kart satırları o sayıya göre dizdiği için EN ÜSTTEKİ
//  satır "en iyi fırsat" gibi okunmaya en açık olan satır. Uyarıyı
//  dipnota değil kartın BAŞINA koyuyoruz: kullanıcı sıralamayı
//  görmeden önce neyin sıralandığını okuyor.
//
//  NEDEN ÖLÇÜLEMEYENLER EN SONDA, SİLİNMİŞ DEĞİL: `rrRatio === null`
//  "fırsat değil" demek değil, "bu satırda oran ÖLÇÜLEMEDİ" demek.
//  Satırı listeden düşürmek, ölçülmüş fiyat/seviye bilgisini de çöpe
//  atmak ve kullanıcıya eksik bir evren göstermek olurdu. Sona konup
//  oran yerine tire basılıyor.
//
//  NEDEN `plan === null` ARIZA DEĞİL: TA koşmadıysa (ör. vade
//  'gunici') plan hiç gelmiyor. O satır burada plansız görünür ve
//  sebebi yazılır; uydurma seviye üretilmez.
//
//  VERİ BU KARTIN İÇİNDE ÇEKİLMİYOR: `fetch` yok. Tur sahibi ekran
//  (Keşfet sekmesi) tek bir istek atıyor ve sonucu üç karta prop
//  olarak veriyor — üç kart üç ayrı istek atsa aynı veri için üç tur
//  ödenirdi ve üçü farklı anlık görüntü gösterebilirdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, Market, RecommendRow, Sayac } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type FirsatlarKartProps = {
  /** `/api/recommend` turunun satırları. Kart bunu KENDİ çekmiyor. */
  satirlar: RecommendRow[];
  /** `useIstek` durumu — yükleniyor/boş/hata hâllerini `Durum` çiziyor. */
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /**
   * Turun künyesi (`tam` + `sayac`). Verilirse eksik ölçüm rozeti
   * satırların ÜSTÜNDE çizilir. Verilmezse rozet hiç çizilmez —
   * "ölçüm tam" diye bir iddia üretilmez.
   */
  kaynak?: { tam?: boolean; sayac?: Sayac } | null;
  /**
   * Satıra dokunulduğunda ne olacağı ÇAĞIRANIN kararı (yönlendirme
   * sekmenin işi). Verilmezse satır basılabilir GÖRÜNMÜYOR: dokununca
   * hiçbir şey olmayan bir satır, çalışıyormuş gibi görünen bir yalan.
   */
  onSembol?: (sym: string) => void;
  /** Kaç satır gösterilsin. Sıralı listede dip kuyruğu kesmek için. */
  azami?: number;
};

/** Pazar → para birimi kodu. Eşleme, hesap değil (BIST ₺, ABD simgesiz). */
function paraBirimi(market: Market): string | null {
  return market === 'BIST' ? 'TRY' : null;
}

/**
 * `rrRatio` okunur hâli — sayı YOKSA tire. `0` gerçek bir ölçümdür ve
 * tire basılmaz (bkz. lib/format.ts başlığı).
 */
function rrDegeri(satir: RecommendRow): number | null {
  const v = satir.plan?.riskOdul?.rrRatio;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function FirsatlarKart({
  satirlar,
  durum,
  hata,
  yenile,
  kaynak,
  onSembol,
  azami,
}: FirsatlarKartProps) {
  const { colors } = useTheme();

  // Sıralama: oran BÜYÜKTEN küçüğe, ölçülemeyenler en sonda. `slice()`
  // bilinçli — gelen diziyi yerinde sıralamak, aynı diziyi okuyan öteki
  // kartların sırasını da sessizce değiştirirdi.
  const sirali = satirlar.slice().sort((a, b) => {
    const ra = rrDegeri(a);
    const rb = rrDegeri(b);
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return rb - ra;
  });
  const gosterilen = typeof azami === 'number' && azami > 0 ? sirali.slice(0, azami) : sirali;
  const kesilen = sirali.length - gosterilen.length;

  return (
    <Card
      title="🔥 Fırsatlar"
      subtitle="Motorun risk/ödül oranına göre dizili plan satırları">
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
          {/* UYARI SIRALAMANIN ÜSTÜNDE: ne sıralandığı, sıralama
              görülmeden okunuyor. */}
          <View style={[styles.uyari, { borderColor: colors.border }]}>
            <Pill label="oran ≠ olasılık" tone="info" glyph={null} size="sm" />
            <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
              `rr` YALNIZ mesafe oranıdır: hedefe uzaklığın stopa uzaklığa bölümü. Kazanma
              olasılığı DEĞİLDİR ve üstteki satır “en iyi hisse” anlamına gelmez.
            </Text>
          </View>

          {kaynak ? <OlcumEksikRozet kaynak={kaynak} /> : null}

          {!gosterilen.length ? (
            <VeriYok
              kartsiz
              metin="Motor bu semboller için sonuç döndürmedi; sıralanacak plan satırı yok."
            />
          ) : (
            gosterilen.map((r) => (
              <FirsatSatiri key={r.sym} satir={r} onSembol={onSembol} />
            ))
          )}

          {kesilen > 0 ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {kesilen + ' satır daha var; burada ilk ' + gosterilen.length + ' tanesi yazılı.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek plan satırı. Dört sayı da HAM gelir, biçimleme `lib/format.ts`.
 *
 * NEDEN HEDEF/STOP AYNI SATIRDA VE ▲/▼ İŞARETLİ: ikisi fiyatın iki
 * yönündeki seviye. Yalnız renkle ayırmak renk körü kullanıcıda ayrımı
 * yok ederdi; işaret metnin İÇİNDE taşınıyor.
 */
function FirsatSatiri({
  satir,
  onSembol,
}: {
  satir: RecommendRow;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const sv = satir.plan?.seviye ?? null;
  const birim = paraBirimi(satir.market);
  const rr = rrDegeri(satir);
  const yk = satir.plan?.yakinlik?.state ?? null;

  const govde = (
    <>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {satir.sym}
        </Text>
        {yk ? <Pill label={yk} tone="info" glyph={null} size="sm" /> : null}
        <View style={styles.bosluk} />
        {/* Oranın kendisi: etiket metinle yazılı ki rozet rengi tek
            taşıyıcı olmasın. */}
        <Text style={[type.smallBold, styles.num, { color: colors.gold }]}>
          {'rr ' + (rr === null ? EMPTY : formatOran(rr))}
        </Text>
      </View>

      {sv ? (
        <>
          <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
            {'fiyat ' + formatPrice(sv.price, birim)}
          </Text>
          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {'▲ hedef ' +
              formatPrice(sv.target, birim) +
              '   ▼ stop ' +
              formatPrice(sv.stop, birim)}
          </Text>
        </>
      ) : (
        // `plan === null` → TA koşmadı. Seviye uydurulmuyor.
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu satır için plan üretilmedi (teknik ayak koşmadı) — seviye ölçülemedi.
        </Text>
      )}
    </>
  );

  if (!onSembol) {
    return <View style={styles.satir}>{govde}</View>;
  }

  return (
    <Pressable
      onPress={() => onSembol(satir.sym)}
      accessibilityRole="button"
      accessibilityLabel={satir.sym + ' plan satırı — analize git'}
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
  // Basılabilir satır dokunma hedefi alt sınırını tutar (layout.hitSlopMin).
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
