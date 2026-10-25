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
//  Cevapta temettü tarafından GELEN TEK ALAN `dividendYield`.
//  GELMEYENLER: temettü kesinti (ex-date) tarihi, ödeme tarihi, beyan
//  tarihi, hisse başı temettü TUTARI, dağıtım oranı, temettü geçmişi.
//  `api/_yfin.js` → `fetchOne` bunların hiçbirini basmıyor
//  (`summaryDetail`ten yalnız `dividendYield` okunuyor) ve `deep=1`
//  de bir şey eklemiyor (`calendarEvents`ten YALNIZ `earnings`
//  ayrıştırılıyor, `dividendDate` ayrıştırılmıyor).
//
//  Bu yüzden burada TAKVİM BASILMIYOR. Elimizde tarih yokken "Temettü
//  Takvimi" başlığı altında boş bir takvim ya da uydurma bir gün
//  göstermek, ürünün tek değişmez kuralını (veri yoksa UYDURMA)
//  kırardı. Kart ne ölçüldüyse onu gösteriyor ve EKSİĞİ AÇIKÇA YAZIYOR
//  — takvim satırı uç o alanları döndürdüğü gün eklenir.
//
//  BURADA HESAP YOK:
//    · `dividendYield` ORAN (0-1) geliyor — ölçüldü: KO 0,0229 ·
//      AAPL 0,0031 · THYAO.IS 0. 100 ile ÇARPILMIYOR; ölçek
//      değiştirmek motorun işi (`lib/format.ts` başlığı). Bu yüzden
//      `formatOran`, `formatPercent` DEĞİL — `formatPercent` yüzde
//      PUANI beklediği için 0,0229'u "%0,02" diye YANLIŞ basardı.
//    · Sıralama YOK: gelen dizi isteğin sırası (`api/_yfin.js`
//      sembolleri sırayla geziyor). "En yüksek verim" diye yeniden
//      sıralamak istemcide ikinci bir sıralama kuralı doğurur.
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

import { StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatOran, formatPrice } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

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

  const kunyeler = veri?.results ?? [];
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  // `ok:true` olan her sembol gösterilir — verim `null` ise de, `0` ise
  // de. Üçü AYRI cümle: ölçülemedi · ödemiyor · şu oranda ödüyor.
  const olculen = kunyeler.filter((k) => k.ok);

  return (
    <Card
      title="💰 Temettü"
      subtitle="Yalnız VERİM — tarih alanları bu uçtan gelmiyor"
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
            {olculen.map((k) => (
              <VerimSatiri key={k.symbol} kunye={k} />
            ))}

            {!olculen.length ? (
              <VeriYok kartsiz metin="Sorulan sembollerin hiçbirinin künyesi ölçülemedi." />
            ) : null}

            {/* TAKVİMİN NEDEN OLMADIĞI KARTIN İÇİNDE YAZAR: kullanıcı
                "takvim nerede" diye sormadan önce cevabı görsün.
                Eksiği gizleyip yalnız verimi göstermek, kartın adının
                verdiği sözü sessizce yemek olurdu. */}
            <View style={[styles.uyari, { borderColor: colors.border }]}>
              <Pill label="uçtan gelmiyor" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                Temettü kesinti (ex-date) ve ödeme tarihleri, hisse başı tutar ve dağıtım oranı
                künye ucunda ÖLÇÜLMEDİ — bu alanlar cevapta hiç yok. Takvim satırı, uç o alanları
                döndürdüğü gün eklenecek; uydurma tarih basılmıyor.
              </Text>
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
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
