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
//  ── EKLENDİ (2026-10-26): PAZAR SÜZGECİ + TARİH SIRALI LİSTE ────────
//  NE: web'in `earnMktChips` çipleri (index.html:146) ve tarihe göre
//  sıralı liste görünümü. Web kartında bu iki şey vardı, yerli kartta
//  YOKTU.
//
//  YENİ ALAN GEREKMEDİ — ÖLÇÜLDÜ: sıralama anahtarı `earnings.ts`
//  (api/_yfin.js:52-77 `parseEarnings`, `mobile/src/api/yfin.ts:79-97`
//  `YfinEarnings`), pazar ise sembolün KENDİSİNDEN okunuyor. Uca tek
//  alan eklenmedi, tek yeni çağrı yazılmadı.
//
//  PAZAR BİR HESAP DEĞİL, BİÇİM EŞLEMESİ: '.IS' ile biten sembol BIST,
//  ötekiler ABD (aynı eşleme `lib/kalici.ts:69` `pazarOf`'ta var ama o
//  fonksiyon dışa açık DEĞİL; `kesfet/` ve `detay/` kartları da aynı
//  eşlemeyi yerinde yapıyor — ör. `kesfet/TaramaKart.tsx:130`). Burada
//  da yerinde yapılıyor; `lib/` DEĞİŞTİRİLMEDİ.
//
//  SIRALAMA EŞİK DEĞİL: `ts` ARTAN sıraya diziliyor, yani "en yakın
//  tarih üstte". Hiçbir tarih atlanmıyor, hiçbir pencere uydurulmuyor
//  ("önümüzdeki 30 gün" gibi bir eşik YOK — o eşik motorun işi olurdu).
//  `ts == null` olan künye (tarih yok ama beklenti var — `parseEarnings`
//  bu hâlde de nesne döndürüyor) EN SONA konuyor ve ayrıca "tarih
//  ölçülmedi" yazıyor; onu tarihli kayıtların arasına sokmak sıranın
//  anlamını bozardı.
//
//  SÜZGEÇ GİZLEMEZ, SAYAR: bir pazar çipi seçiliyken kaç satırın
//  görünmediği YAZIYOR. Sessizce kırpılan liste, kullanıcının
//  sorduğu ama görmediği sembol demektir.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { YFIN_AZAMI_SEMBOL } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatCompact, formatGunAyYil, formatOran, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

/**
 * Pazar süzgeci çipleri — web'in `earnMktChips` kümesiyle aynı üç
 * seçenek. `null` = süzgeç kapalı ("Tümü").
 */
type PazarSuzgec = null | 'BIST' | 'US';

const SUZGECLER: readonly { id: PazarSuzgec; etiket: string }[] = [
  { id: null, etiket: 'Tümü' },
  { id: 'BIST', etiket: 'BIST' },
  { id: 'US', etiket: 'ABD' },
];

/**
 * Sembolden pazar. HESAP DEĞİL, biçim eşlemesi: '.IS' eki BIST demek
 * (api/_girdi.js:139 `temizleSembol` aynı eki aynı anlamda okuyor).
 */
function pazarOf(sembol: string): 'BIST' | 'US' {
  return sembol.toUpperCase().endsWith('.IS') ? 'BIST' : 'US';
}

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
  const [suzgec, setSuzgec] = useState<PazarSuzgec>(null);

  const kunyeler = veri?.results ?? [];
  // `ok:false` = Yahoo turu bu sembolde düştü → ÖLÇEMEDİM.
  // `ok:true` + `earnings == null` = takvim yok → VERİ CEVABI.
  // İki hâl ayrı yazılır; aynı cümleye koymak ölçüm kesintisini veri
  // yokluğu gibi göstermek olurdu.
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  const takvimli = kunyeler.filter((k) => k.ok && k.earnings);
  const takvimsiz = kunyeler.filter((k) => k.ok && !k.earnings).map((k) => k.symbol);

  // TARİH SIRALI: `ts` ARTAN (en yakın üstte). `ts == null` olanlar EN
  // SONA — tarihsiz bir kaydı tarihlilerin arasına sokmak sıranın
  // anlamını bozardı. `slice()` ile kopya: gelen diziyi yerinde
  // sıralamak props'u mutasyona uğratırdı.
  const sirali = useMemo(
    () =>
      takvimli.slice().sort((a, b) => {
        const ta = a.earnings?.ts ?? null;
        const tb = b.earnings?.ts ?? null;
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1;
        if (tb == null) return -1;
        return ta - tb;
      }),
    // `takvimli` her renderda yeniden türüyor; `kunyeler` kimliği
    // değişmediği sürece sıralama da değişmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kunyeler],
  );

  const gorunen = suzgec ? sirali.filter((k) => pazarOf(k.symbol) === suzgec) : sirali;
  // SÜZGEÇ SESSİZ KIRPMAZ: kaçının görünmediği yazılır.
  const suzulen = sirali.length - gorunen.length;
  // Uç 12'den fazlasını SESSİZCE kırpıyor (`api/yfin.ts` YFIN_AZAMI_SEMBOL
  // gerekçesi) — aşım varsa kullanıcıya söylenir, uydurulmaz.
  const asim = Math.max(0, semboller.length - YFIN_AZAMI_SEMBOL);

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
            {/* PAZAR ÇİPLERİ — web'deki `earnMktChips` karşılığı.
                Seçim RENKLE DEĞİL: başta "•" ve ton değişiyor
                (kesfet/TaramaKart.tsx:202 ile aynı kalıp). */}
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
                      ' takvim' +
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

            {/* Sıranın NE OLDUĞU yazılı: kullanıcı listedeki düzenin
                nereden geldiğini bilmeden okumasın. */}
            <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
              {gorunen.length
                ? 'Yaklaşan bilanço tarihine göre sıralı (en yakın üstte).' +
                  (suzulen > 0 ? ' Süzgeç ' + String(suzulen) + ' satırı gizliyor.' : '')
                : 'Bu süzgeçte gösterilecek takvim yok.'}
            </Text>

            {asim > 0 ? (
              <View style={styles.dipnot}>
                <Pill label="sorulmadı" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {'Künye ucu en çok ' +
                    String(YFIN_AZAMI_SEMBOL) +
                    ' sembol alıyor; ' +
                    String(asim) +
                    ' sembol hiç sorulmadı — eksikliği "takvim yok" diye okumayın.'}
                </Text>
              </View>
            ) : null}

            {gorunen.map((k) => (
              <TakvimSatiri key={k.symbol} kunye={k} />
            ))}

            {!takvimli.length ? (
              <VeriYok
                kartsiz
                metin="Sorulan sembollerin hiçbirinde yaklaşan bilanço tarihi yok."
              />
            ) : !gorunen.length ? (
              // Takvim VAR ama bu pazarda yok. İki ayrı cümle.
              <VeriYok
                kartsiz
                metin={
                  'Takvim ölçüldü ama ' +
                  (suzgec === 'BIST' ? 'BIST' : 'ABD') +
                  ' tarafında yaklaşan bilanço tarihi yok.'
                }
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
  // TARİH ÖLÇÜLMEDİ ≠ TARİH YOK: `ts` boşsa çıplak tire basmak, beklenti
  // bandı ölçülmüş olduğu hâlde satırı "bozuk" gösterirdi. Cümle yazılır.
  const tarihVar = typeof e.ts === 'number' && Number.isFinite(e.ts);
  const tarih = tarihVar ? formatGunAyYil(e.ts) : 'tarih ölçülmedi';

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
        (tarihVar ? ' bilanço tarihi ' + tarih : ' bilanço tarihi ölçülmedi') +
        (tarihVar && e.estimate ? ', tarih kesinleşmedi' : '') +
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
          <Text
            style={[
              tarihVar ? type.bodyBold : type.micro,
              tarihVar ? numeric : null,
              { color: tarihVar ? colors.gold : colors.textDim },
            ]}>
            {tarih}
          </Text>
          {/* NEDEN AYRI ROZET: `estimate:true` tarihin ŞİRKETTEN
              GELMEDİĞİNİ, Yahoo'nun tahmini olduğunu söylüyor. Bunu
              yazmamak, tahmini kesin tarih gibi sunmak olurdu. */}
          {!tarihVar ? (
            <Pill label="tarih yok" tone="neutral" glyph={null} size="sm" />
          ) : e.estimate ? (
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
  // Çip şeridi — kesfet/TaramaKart.tsx `cipler`/`cipKabi` ile aynı.
  // `minHeight: hitSlopMin` dokunma hedefini 44pt'nin altına düşürmez.
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
