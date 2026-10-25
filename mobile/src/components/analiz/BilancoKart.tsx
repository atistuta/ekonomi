// =====================================================================
//  📅 BilancoKart — yaklaşan bilanço takvimi           (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/yfin?...&deep=1` cevabındaki `earnings` künyesi: sonraki
//  bilanço tarihi, tarihin kesinleşmiş olup olmadığı, analist beklenti
//  bandı (EPS düşük–ortalama–yüksek), gelir beklentisi, analist sayısı
//  ve beklenen YoY büyümeler.
//
//  NEDEN `/api/yfin`: ÖLÇÜLDÜ (2026-10-25, üretim) ki bilanço takvimi
//  skor zincirinden GELMİYOR — `/api/analyze` cevabında takvim alanı
//  yok. Takvimi veren tek uç bu ve YALNIZ `deep=1` ile
//  (`api/_yfin.js` → `MODULES_DEEP = …,calendarEvents,earningsTrend`).
//
//  BURADA HESAP YOK:
//    · Tarih UNIX SANİYE geliyor; `formatGunAyYil` dönüşümü tek yerde
//      (`lib/format.ts`) — burada `new Date(t * 1000)` YAZILMIYOR.
//    · "Kaç gün kaldı" SAYILMIYOR. Geri sayım, cihaz saatiyle motorun
//      damgasını karıştıran bir TÜRETME olurdu; üstelik `estimate:true`
//      ile gelen tarih kesin değil — kesin olmayan tarihten kesin bir
//      "3 gün kaldı" üretmek yalan olurdu.
//    · Büyüme alanları KESİR (0,0701) geliyor; 100 ile ÇARPILMIYOR —
//      ölçek değiştirmek motorun işi (`lib/format.ts` başlığı). Bu
//      yüzden `formatOran`, `formatPercent` DEĞİL.
//
//  NEDEN `OlcumEksikRozet` YOK: bu uç `tam`/`sayac` döndürmüyor
//  (ölçüldü — gövdede yalnız `results`). Rozet skor sayacının şeklini
//  okuyor; buraya uydurma bir sayaç vermek "0 kesinti" diye YANLIŞ bir
//  dürüstlük raporu üretirdi. Elimizdeki tek dürüstlük işareti sembol
//  başına `ok` — o yüzden ölçülemeyen semboller AYRI bir blokta yazar.
//
//  NEDEN `fetch` YOK: `components/` içinde istek atılmaz; veri
//  `api/yfin.ts` → `fetchYfin()` ile ekranda çekilir, buraya props
//  olarak gelir.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatCompact, formatGunAyYil, formatOran, formatPrice } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

export type BilancoKartProps = {
  /** `fetchYfin(semboller, { deep: true })` gövdesi. */
  veri: YfinResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** Hangi semboller soruldu — boş sonuç cümlesini somut yapar. */
  semboller?: string[];
};

export function BilancoKart({ veri, durum, hata, yenile, semboller = [] }: BilancoKartProps) {
  const { colors } = useTheme();

  const kunyeler = veri?.results ?? [];
  // `ok:false` = Yahoo turu bu sembolde düştü → ÖLÇEMEDİM.
  // `ok:true` + `earnings == null` = takvim yok → VERİ CEVABI.
  // İki hâl ayrı yazılır; aynı cümleye koymak ölçüm kesintisini veri
  // yokluğu gibi göstermek olurdu.
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  const takvimli = kunyeler.filter((k) => k.ok && k.earnings);
  const takvimsiz = kunyeler.filter((k) => k.ok && !k.earnings).map((k) => k.symbol);

  return (
    <Card
      title="📅 Bilanço"
      subtitle="Yaklaşan kazanç tarihi + analist beklenti bandı — /api/yfin takvim alanları"
      right={
        durum === 'veri' && takvimli.length ? (
          <Pill label={takvimli.length + ' takvim'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={Math.max(1, semboller.length || 2)}
        sekil="satir"
        kartsiz
        bosMetin="Bir sembol seç; bilanço takvimi o zaman istenecek."
      />

      {durum === 'veri' ? (
        kunyeler.length ? (
          <>
            {takvimli.map((k) => (
              <TakvimSatiri key={k.symbol} kunye={k} />
            ))}

            {!takvimli.length ? (
              <VeriYok
                kartsiz
                metin="Sorulan sembollerin hiçbirinde yaklaşan bilanço tarihi yok."
              />
            ) : null}

            {takvimsiz.length ? (
              <View style={styles.dipnot}>
                <Pill label="takvim yok" tone="neutral" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {takvimsiz.join(', ') +
                    ' — künye geldi ama takvim alanı boş (veri cevabı, kesinti değil).'}
                </Text>
              </View>
            ) : null}

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
 * Tek sembolün takvim satırı.
 *
 * NEDEN PARA BİRİMİ `finCurrency`: EPS ve gelir RAPORLAMA para
 * biriminde (`api/_yfin.js` yorumu: "raporlama para birimi
 * (gelir/finansallar bunda)"). ADR'de kotasyon USD ama raporlama
 * başka olabilir (ölçüldü: THYAO.IS → currency TRY, finCurrency USD).
 * `currency` kullanmak gelirin başına yanlış simge koymak olurdu.
 * Bilinmiyorsa simge UYDURULMAZ (`formatPrice` zaten basmaz).
 */
function TakvimSatiri({ kunye }: { kunye: YfinKunye }) {
  const { colors } = useTheme();
  const e = kunye.earnings;
  if (!e) return null;

  const kur = kunye.finCurrency ?? null;
  const tarih = formatGunAyYil(e.ts);

  // Beklenti BANDI tek satırda: düşük – ortalama – yüksek. Tek sayı
  // basmak, bandın genişliğini (yani belirsizliği) gizlerdi.
  const epsBandi =
    e.epsLow != null || e.epsHigh != null
      ? formatPrice(e.epsLow, kur) + ' – ' + formatPrice(e.epsHigh, kur)
      : null;

  return (
    <View
      style={[styles.blok, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        (kunye.name ?? kunye.symbol) +
        ' bilanço tarihi ' +
        tarih +
        (e.estimate ? ', tarih kesinleşmedi' : '') +
        (e.epsAvg != null ? ', beklenen hisse başı kâr ' + formatPrice(e.epsAvg, kur) : '')
      }>
      <View style={styles.basliksatir}>
        <View style={styles.basliksol}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
            {kunye.symbol}
          </Text>
          {kunye.name ? (
            <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
              {kunye.name}
            </Text>
          ) : null}
        </View>
        <View style={styles.basliksag}>
          <Text style={[type.bodyBold, numeric, { color: colors.gold }]}>{tarih}</Text>
          {/* NEDEN AYRI ROZET: `estimate:true` tarihin ŞİRKETTEN
              GELMEDİĞİNİ, Yahoo'nun tahmini olduğunu söylüyor. Bunu
              yazmamak, tahmini kesin tarih gibi sunmak olurdu. */}
          {e.estimate ? (
            <Pill label="tarih tahmini" tone="gold" glyph={null} size="sm" />
          ) : (
            <Pill label="tarih kesin" tone="neutral" glyph={null} size="sm" />
          )}
        </View>
      </View>

      <Olcum
        etiket="Beklenen hisse başı kâr"
        deger={formatPrice(e.epsAvg, kur)}
        alt={epsBandi ? 'bant: ' + epsBandi : null}
      />
      <Olcum
        etiket="Beklenen gelir"
        deger={formatCompact(e.revAvg) + (kur ? ' ' + kur : '')}
        alt={
          e.revLow != null || e.revHigh != null
            ? 'bant: ' + formatCompact(e.revLow) + ' – ' + formatCompact(e.revHigh)
            : null
        }
      />
      <Olcum
        etiket="Beklenen kâr büyümesi"
        // KESİR — 100 ile çarpılmıyor (dosya başlığı). 0,07 = yedi yüzde.
        deger={formatOran(e.epsGrowth, 4)}
        alt="kesir (0,07 ≈ yüzde yedi) — ölçek motorun"
      />
      <Olcum
        etiket="Beklenen gelir büyümesi"
        deger={formatOran(e.revGrowth, 4)}
        alt="kesir — ölçek motorun"
      />
      <Olcum
        etiket="Beklentiyi veren analist"
        deger={e.numAnalysts != null ? String(e.numAnalysts) : '—'}
        alt={null}
      />
    </View>
  );
}

/** Etiket–değer satırı. Sayı sütunu `tabular-nums`, sağa dayalı. */
function Olcum({
  etiket,
  deger,
  alt,
}: {
  etiket: string;
  deger: string;
  alt: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.olcum}>
      <View style={styles.olcumSol}>
        <Text style={[type.small, { color: colors.textDim }]}>{etiket}</Text>
        {alt ? <Text style={[type.micro, { color: colors.textFaint }]}>{alt}</Text> : null}
      </View>
      <Text style={[type.smallBold, numeric, styles.olcumSag, { color: colors.text }]}>
        {deger}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: {
    gap: space.xs,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  basliksatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: space.xs,
  },
  basliksol: { flex: 1 },
  basliksag: { alignItems: 'flex-end', gap: space.xxs },
  olcum: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.xxs,
  },
  olcumSol: { flex: 1 },
  olcumSag: { textAlign: 'right' },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
