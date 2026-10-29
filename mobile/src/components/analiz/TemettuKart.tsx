// =====================================================================
//  💰 TemettuKart — temettü verimi (TAKVİM YOK)        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/yfin` cevabındaki `dividendYield` alanı — sorulan
//  sembollerin temettü VERİMİ, oran olarak.
//
//  ── NEDEN "TAKVİM" DEĞİL, NEDEN BAŞLIK BÖYLE ───────────────────────
//  Bu kart "Temettü Takvimi" olarak istendi. ÖLÇÜLDÜ (2026-10-25,
//  üretim):
//      GET /api/yfin?symbols=AAPL&deep=1
//      GET /api/yfin?symbols=THYAO.IS,KO&deep=1
//  O gün cevapta temettü tarafından GELEN TEK ALAN `dividendYield`'dı.
//
//  ── DÜZELTME (ÖLÇÜLDÜ 2026-10-29, `api/_yfin.js:118-128` okundu) ────
//  Uç ARTIK tutar (`dividendRate`, `trailingAnnualDividendRate`,
//  `lastDividendValue`), dağıtım oranı (`payoutRatio`), ikinci bir
//  verim ölçeği (`dividendYield5y`, `trailingAnnualDividendYield`) ve
//  ÜÇ TARİH (`lastDividendTs`, `exDividendTs`, `dividendTs`) da
//  döndürüyor. HÂLÂ GELMEYEN yalnız ikisi: beyan (ilan) tarihi ve
//  temettü geçmişi (`EKSIK_ALANLAR`).
//
//  BU KART YİNE DE YALNIZ VERİM BASIYOR: burası ÇOK SEMBOLLÜ bir liste
//  (pazar süzgeci + verime göre sıralama) ve dokuz alanı her satıra
//  sığdırmak satırı okunmaz yapardı. Tam künye TEK SEMBOLDE, hisse
//  detay ekranındaki `components/detay/TemettuKart` kartında — orada üç
//  ölçek (oran / yüzde puanı / para birimi) ayrı ayrı biçimleniyor.
//  Kart yine ne ölçtüyse onu gösteriyor ve EKSİĞİ AÇIKÇA YAZIYOR.
//
//  BURADA HESAP YOK:
//    · `dividendYield` ORAN (0-1) geliyor — ölçüldü: KO 0,0229 ·
//      AAPL 0,0031 · THYAO.IS 0. 100 ile ÇARPILMIYOR; ölçek
//      değiştirmek motorun işi (`lib/format.ts` başlığı). Bu yüzden
//      `formatOran`, `formatPercent` DEĞİL — `formatPercent` yüzde
//      PUANI beklediği için 0,0229'u "%0,02" diye YANLIŞ basardı.
//    · SIRALAMA (eklendi 2026-10-26): verim AZALAN. Bu bir EŞİK ya da
//      skor değil — aynı alanın yeniden DİZİLİŞİ; hiçbir sayı türetmiyor.
//      Sıranın NE OLDUĞU kartta yazılı, böylece ikinci bir gizli kural
//      doğmuyor. `null` (ölçülemedi) EN SONA, `0` (ödemiyor) nullardan
//      ÖNCE: `0` ölçülmüş bir bilgi, boşluk değil.
//    · PAZAR SÜZGECİ (eklendi 2026-10-26): Tümü/BIST/ABD. Pazar ayrımı
//      SEMBOLÜN EKİNDEN okunuyor (`.IS` → BIST), uçtan gelen bir skordan
//      değil — `api/_girdi.js` PAZARLAR aynı ayrımı kuruyor.
//
//  ── EKSİK ALANLAR ARTIK TEK TEK EKRANDA ────────────────────────────
//  Aşağıdaki başlık yorumundaki eksik listesi `EKSIK_ALANLAR` dizisine
//  taşındı ve kartın içinde MADDE MADDE basılıyor. Eksiği yalnız kaynak
//  yorumunda saklamak, kullanıcıya "temettü = verim" demek olurdu.
//
//  `0` GERÇEK BİR ÖLÇÜM: "temettü ödemiyor" demek, "veri yok" DEĞİL.
//  İkisi ayrı cümle — `null` ile `0`ı aynı kutuya koymak ölçülmüş bir
//  bilgiyi silmek olurdu.
//
//  NEDEN `OlcumEksikRozet` YOK: uç `tam`/`sayac` döndürmüyor (gövdede
//  yalnız `results`); uydurma sayaç yanlış bir dürüstlük raporu olurdu.
//  Dürüstlük işareti sembol başına `ok`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { YFIN_AZAMI_SEMBOL } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatOran, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

type PazarSuzgec = null | 'BIST' | 'US';

const SUZGECLER: readonly { id: PazarSuzgec; etiket: string }[] = [
  { id: null, etiket: 'Tümü' },
  { id: 'BIST', etiket: 'BIST' },
  { id: 'US', etiket: 'ABD' },
];

/** `.IS` eki BIST demek (`api/_motor.js` `yahooSymbol` aynı eki ekliyor). */
function pazarOf(sembol: string): 'BIST' | 'US' {
  return sembol.toUpperCase().endsWith('.IS') ? 'BIST' : 'US';
}

/**
 * Künye ucunun TEMETTÜ TARAFINDA DÖNDÜRMEDİĞİ alanlar — tek tek.
 *
 * LİSTE KISALDI (ÖLÇÜLDÜ 2026-10-29, `api/_yfin.js:118-128` kaynak
 * okuma): tutar (`dividendRate`, `trailingAnnualDividendRate`,
 * `lastDividendValue`), dağıtım oranı (`payoutRatio`) ve tarihler
 * (`exDividendTs`, `dividendTs`, `lastDividendTs`) ARTIK GELİYOR —
 * onları "ölçülmedi" diye yazmak ölçülmüş veriyi yok saymak olurdu.
 * BU LİSTEDE KALAN İKİSİ gerçekten uçta YOK.
 *
 * BU KART O ALANLARI BASMIYOR (çok sembollü liste; dokuz alanı yan yana
 * koymak satırı okunmaz yapardı): tam künye tek sembolde, hisse detay
 * ekranındaki `components/detay/TemettuKart` kartında.
 */
const EKSIK_ALANLAR: readonly string[] = [
  'Beyan (ilan) tarihi',
  'Geçmiş temettü ödemeleri',
];

export type TemettuKartProps = {
  /** `fetchYfin(semboller)` gövdesi. */
  veri: YfinResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** Hangi semboller soruldu — boş sonuç cümlesini somut yapar. */
  semboller?: string[];
};

export function TemettuKart({ veri, durum, hata, yenile, semboller = [] }: TemettuKartProps) {
  const { colors } = useTheme();
  const [suzgec, setSuzgec] = useState<PazarSuzgec>(null);

  const kunyeler = veri?.results ?? [];
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  // `ok:true` olan her sembol gösterilir — verim `null` ise de, `0` ise
  // de. Üçü AYRI cümle: ölçülemedi · ödemiyor · şu oranda ödüyor.
  const olculen = kunyeler.filter((k) => k.ok);

  // VERİM AZALAN. `slice()` ile kopya: gelen diziyi yerinde sıralamak
  // props'u mutasyona uğratırdı. `null` en sonda — ölçülemeyeni sıfır
  // sananın yanına koymak iki ayrı hâli birleştirmek olurdu.
  const sirali = useMemo(
    () =>
      olculen.slice().sort((a, b) => {
        const va = typeof a.dividendYield === 'number' ? a.dividendYield : null;
        const vb = typeof b.dividendYield === 'number' ? b.dividendYield : null;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return vb - va;
      }),
    // `olculen` her renderda yeniden türüyor; kimliği `kunyeler`e bağlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kunyeler],
  );

  const gorunen = suzgec ? sirali.filter((k) => pazarOf(k.symbol) === suzgec) : sirali;
  // SÜZGEÇ SESSİZ KIRPMAZ: kaçının görünmediği yazılır.
  const suzulen = sirali.length - gorunen.length;
  // Uç 12'den fazlasını sessizce kırpıyor (`api/yfin.ts` gerekçesi).
  const asim = Math.max(0, semboller.length - YFIN_AZAMI_SEMBOL);

  return (
    <Card
      title="💰 Temettü"
      subtitle="Listede yalnız VERİM — tutar/tarih alanları hisse ekranında"
      right={
        durum === 'veri' && olculen.length ? (
          <Pill label={olculen.length + ' sembol'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={Math.max(1, semboller.length || 2)}
        sekil="satir"
        kartsiz
        bosMetin="Bir sembol seç; temettü verimi o zaman istenecek."
      />

      {durum === 'veri' ? (
        kunyeler.length ? (
          <>
            {/* PAZAR ÇİPLERİ — seçim RENKLE DEĞİL: başta "•" ve ton. */}
            <View style={styles.cipler}>
              {SUZGECLER.map((s) => {
                const aktif = suzgec === s.id;
                const adet = s.id
                  ? sirali.filter((k) => pazarOf(k.symbol) === s.id).length
                  : sirali.length;
                return (
                  <Pressable
                    key={s.etiket}
                    onPress={() => setSuzgec(s.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktif }}
                    accessibilityLabel={
                      'Pazar: ' +
                      s.etiket +
                      ', ' +
                      String(adet) +
                      ' sembol' +
                      (aktif ? ' — seçili' : '')
                    }
                    hitSlop={space.sm}
                    style={({ pressed }) => [
                      styles.cipKabi,
                      pressed ? { backgroundColor: colors.bgPressed } : null,
                    ]}>
                    <Pill
                      label={(aktif ? '• ' : '') + s.etiket + ' (' + String(adet) + ')'}
                      tone={aktif ? 'gold' : 'neutral'}
                      variant={aktif ? 'soft' : 'outline'}
                      glyph={null}
                      size="sm"
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Sıranın NE OLDUĞU yazılı — gizli kural bırakmıyoruz. */}
            <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
              {gorunen.length
                ? 'Verime göre azalan sıralı; ölçülemeyenler en sonda.' +
                  (suzulen > 0 ? ' Süzgeç ' + String(suzulen) + ' satırı gizliyor.' : '')
                : 'Bu süzgeçte gösterilecek sembol yok.'}
            </Text>

            {asim > 0 ? (
              <View style={styles.dipnot}>
                <Pill label="sorulmadı" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {'Künye ucu en çok ' +
                    String(YFIN_AZAMI_SEMBOL) +
                    ' sembol alıyor; ' +
                    String(asim) +
                    ' sembol hiç sorulmadı — eksikliği "temettü yok" diye okumayın.'}
                </Text>
              </View>
            ) : null}

            {gorunen.map((k) => (
              <VerimSatiri key={k.symbol} kunye={k} />
            ))}

            {!olculen.length ? (
              <VeriYok kartsiz metin="Sorulan sembollerin hiçbirinin künyesi ölçülemedi." />
            ) : !gorunen.length ? (
              <VeriYok
                kartsiz
                metin={
                  'Künye ölçüldü ama ' +
                  (suzgec === 'BIST' ? 'BIST' : 'ABD') +
                  ' tarafında sorulan sembol yok.'
                }
              />
            ) : null}

            {/* TAKVİMİN NEDEN OLMADIĞI KARTIN İÇİNDE YAZAR: kullanıcı
                "takvim nerede" diye sormadan önce cevabı görsün.
                Eksiği gizleyip yalnız verimi göstermek, kartın adının
                verdiği sözü sessizce yemek olurdu. */}
            <View style={[styles.uyari, { borderColor: colors.border }]}>
              <View style={styles.uyariIc}>
                <View style={styles.uyariBas}>
                  <Pill label="uçtan gelmiyor" tone="neutral" glyph={null} size="sm" />
                  <Text style={[type.smallBold, { color: colors.text, flex: 1 }]}>
                    Künye ucunda hiç olmayan alanlar
                  </Text>
                </View>
                {/* MADDE MADDE: tek bir cümleye sıkıştırmak eksiğin
                    boyutunu küçük gösterirdi. Her satır, uç o alanı
                    döndürmediği için BOŞ — tarih uydurulmuyor. */}
                {EKSIK_ALANLAR.map((alan) => (
                  <View key={alan} style={styles.eksikSatir}>
                    <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>{alan}</Text>
                    <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                      ölçülmedi
                    </Text>
                  </View>
                ))}
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  Bu iki alan künye cevabında HİÇ YOK (eksik ölçüm değil, alan yok); uydurma tarih
                  basılmıyor. Tutar, dağıtım oranı ve kesinti/ödeme tarihleri uçtan GELİYOR — bu
                  liste kartında değil, hisse detay ekranındaki temettü künyesinde.
                </Text>
              </View>
            </View>

            {olculemeyen.length ? (
              <View style={styles.dipnot}>
                <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {olculemeyen.join(', ') + ' — künye turu düştü, bu sembol ölçülemedi.'}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <VeriYok
            kartsiz
            metin={
              (semboller.length ? semboller.join(', ') : 'Seçilen semboller') +
              ' için künye ucu sonuç döndürmedi.'
            }
          />
        )
      ) : null}
    </Card>
  );
}

/**
 * Tek sembolün verim satırı. ÜÇ AYRI HÂL:
 *   · `null`/yok → ölçülemedi (rozet: ölçülemedi)
 *   · `0`        → temettü ödemiyor (ÖLÇÜLDÜ, veri cevabı)
 *   · `>0`       → oran basılır
 */
function VerimSatiri({ kunye }: { kunye: YfinKunye }) {
  const { colors } = useTheme();
  const verim = typeof kunye.dividendYield === 'number' ? kunye.dividendYield : null;
  const kur = kunye.currency ?? null;

  const durumMetni =
    verim == null
      ? 'verim ölçülemedi'
      : verim === 0
        ? 'temettü ödemiyor (ölçülen verim 0)'
        : 'oran, 0-1 ölçeğinde — motorun ham ölçeği';

  return (
    <View
      style={[styles.satir, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        (kunye.name ?? kunye.symbol) +
        ', ' +
        (verim == null
          ? 'temettü verimi ölçülemedi'
          : verim === 0
            ? 'temettü ödemiyor'
            : 'temettü verim oranı ' + formatOran(verim, 4))
      }>
      <View style={styles.sol}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {kunye.symbol}
        </Text>
        {kunye.name ? (
          <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
            {kunye.name}
          </Text>
        ) : null}
        <Text style={[type.micro, { color: colors.textFaint }]}>{durumMetni}</Text>
      </View>
      <View style={styles.sag}>
        {verim == null ? (
          <Pill label="ölçülemedi" tone="gold" glyph={null} size="sm" />
        ) : (
          <Text style={[type.bodyBold, numeric, { color: colors.text }]}>
            {formatOran(verim, 4)}
          </Text>
        )}
        {/* Fiyat BİLGİ olarak: verimi tek başına okumak zor, ama fiyatla
            verimi ÇARPIP tutar üretmek bir TÜRETME olurdu — yapılmıyor.
            Fiyat yalnız yan yana duruyor. */}
        <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
          {'fiyat ' + formatPrice(kunye.price, kur)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sol: { flex: 1, gap: space.xxs },
  sag: { alignItems: 'flex-end', gap: space.xxs },
  uyari: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  uyariIc: { flex: 1, gap: space.xs },
  uyariBas: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eksikSatir: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  cipler: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingBottom: space.xs,
  },
  cipKabi: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  num: { ...numeric, paddingBottom: space.xs },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
