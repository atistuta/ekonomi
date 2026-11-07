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
//  ── BANT ETİKETİ + KATKI DÖKÜMÜ (eklendi 2026-10-29, ŞERİT F) ─────
//  Webdeki fırsat satırı bir bant etiketi (`r.label` / `r.cls`) ve
//  gösterge katkılarını da yazıyor; native satır bunların HİÇBİRİNİ
//  basmıyordu, oysa ikisi de `/api/recommend` gövdesinde GELİYOR:
//    · bileşke bant → `composite.label`, yoksa `composite.band`
//    · teknik bant  → `ta.label` (sınıfı `ta.cls`)
//    · katkılar     → `ta.breakdown[] = {key, score, weight}`
//  ÖLÇÜLDÜ (api/types.ts:61-68, :93-99): alanların hepsi SORU İŞARETLİ
//  ve `null` olabiliyor — motor bandı üretemediğinde sebebi `why`de
//  yazıyor. Bu yüzden etiket YOKSA rozet HİÇ basılmıyor; eşikten bant
//  türetmek (ör. "skor 70 üstü → güçlü") istemciye motor mantığı
//  taşımak olurdu ve YAPILMADI.
//
//  ROZET TONU NÖTR, `cls`e GÖRE RENKLENDİRİLMEDİ: sınıf kodunu renge
//  çevirmek, motorun sınıfına istemcide bir "iyi/kötü" yorumu eklemek
//  demekti. Sınıf metin olarak rozetin yanında yazılı — okunabiliyor,
//  yorumlanmıyor.
//
//  KATKIDAN YALNIZ İLK 2: döküm 8+ gösterge taşıyabiliyor ve satır bir
//  LİSTE satırı. Sıra MOTORUN sırası — istemci yeniden dizmiyor, bu
//  yüzden "ilk 2" keyfi bir seçim değil, motorun önceliği. Kesildiği de
//  yazılı (`+N`), sessizce düşmüyor.
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
import { EMPTY, formatImzaliSkor, formatOran, formatPrice, formatScore } from '@/lib/format';
import { FIRSAT_SOZLUK, sozluktenSec } from '@/lib/sozluk';
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
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
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

/** Boş/boşluk dizgiyi `null`a indirir: boş rozet basmamak için. */
function metinVarsa(v: string | null | undefined): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
}

/**
 * Bileşke bant etiketi — motorun yazdığı metin. `label` yoksa `band`
 * kodu basılıyor (kod da motorun; istemci ikisini de üretmiyor).
 */
function bilesikBant(satir: RecommendRow): string | null {
  return metinVarsa(satir.composite.label) ?? metinVarsa(satir.composite.band);
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
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
}) {
  const { colors } = useTheme();
  const sv = satir.plan?.seviye ?? null;
  const birim = paraBirimi(satir.market);
  const rr = rrDegeri(satir);
  const yk = satir.plan?.yakinlik?.state ?? null;

  // Bant etiketleri: üretilemediyse `null` — eşikten TÜRETİLMİYOR.
  const bant = bilesikBant(satir);
  const taBant = metinVarsa(satir.ta.label);
  const taSinif = metinVarsa(satir.ta.cls);
  // FIRSAT KATMANI (api/_akis.js `firsatKatmani`) — HAM sayı + KAPALI
  // KÜME. Hesabın tamamı motorda (`buyZoneProximity` + `momentumInfo` +
  // `priceOppAdj` + `oppCombined`); burada eşik/ağırlık/formül YOK.
  // Cümle `cls`e bakıp `lib/sozluk.ts`ten seçiliyor; kod sözlükte yoksa
  // `null` döner ve cümle HİÇ basılmaz (uydurma yapılmaz).
  const fr = satir.firsat;
  const frCumle = fr ? sozluktenSec(FIRSAT_SOZLUK, fr.cls) : null;
  // Katkı dökümü: motorun sırası korunuyor, ilk 2 basılıyor.
  const dokum = satir.ta.breakdown ?? [];
  const dokumIlk = dokum.slice(0, 2);
  const dokumKalan = dokum.length - dokumIlk.length;

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

      {/* BANT ROZETLERİ — motorun etiketi, tonu NÖTR (yorum yok). Etiket
          üretilmediyse rozet HİÇ basılmıyor; "bant yok" cümlesi de
          yazılmıyor, çünkü satırın asıl ölçümü (seviye/oran) ayrıca
          anlatılıyor ve her satıra ikinci bir eksiklik notu koymak kartı
          gürültüye boğardı. */}
      {bant || taBant ? (
        <View style={styles.bantlar}>
          {bant ? (
            <Pill label={'bileşke: ' + bant} tone="neutral" variant="outline" glyph={null} size="sm" />
          ) : null}
          {taBant ? (
            <Pill
              label={'teknik: ' + taBant + (taSinif ? ' (' + taSinif + ')' : '')}
              tone="neutral"
              variant="outline"
              glyph={null}
              size="sm"
            />
          ) : null}
        </View>
      ) : null}

      {/* FIRSAT KATMANI — ÜÇ AYRI DAL, hiçbiri diğerinin yerine geçmiyor:
            · alan HİÇ gelmedi (`undefined`) → uç bu sürümde göndermiyor,
              satıra not DÜŞÜLMEZ (eski uçla çalışan istemci her satıra
              yanlış bir eksiklik notu basardı).
            · alan `null` → uç ÖLÇEMEDİ (teknik skor yok). Bu söylenir.
            · sayılar var → HAM basılır; `0` da geçerli bir ölçüm olduğu
              için gizlenmez (`fiyatPuan` 0 = düzeltme sıfır çıktı). */}
      {fr === undefined ? null : fr === null ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Fiyat uygunluğu ölçülemedi — bileşik skor üretilmedi.
        </Text>
      ) : (
        <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
          {'bileşik ' +
            formatScore(fr.bilesik) +
            '  ·  fiyat katkısı ' +
            formatImzaliSkor(fr.fiyatPuan) +
            (frCumle ? '  ·  ' + frCumle : '')}
        </Text>
      )}

      {/* KATKI DÖKÜMÜ — gösterge adı ve motorun verdiği skor, HAM. */}
      {dokumIlk.length ? (
        <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
          {'katkı: ' +
            dokumIlk.map((d) => d.key + ' ' + formatScore(d.score)).join('  ·  ') +
            (dokumKalan > 0 ? '  ·  +' + String(dokumKalan) + ' gösterge daha' : '')}
        </Text>
      ) : null}

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
      onPress={() => onSembol(satir.sym, satir.market)}
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
  bantlar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
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
