// =====================================================================
//  📏 ÇOK DÖNEMLİ DEĞİŞİM — /api/degisim                (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: dört sözlük endeksinin (`ENDEKS_SEMBOLLER`) aynı anda altı
//  dönemdeki yüzde değişimi: gün içi · 1 gün · 7 gün · 30 gün · 182 gün
//  · 365 gün. Her dönem için uç İKİ alan döndürüyor — yüzde ve o yüzdeyi
//  kuran REFERANS fiyat — ve ikisi de olduğu gibi basılıyor.
//
//  ── NİYE BU UÇ BUGÜNE KADAR NATIVE'DE YOKTU ────────────────────────
//  `/api/degisim` web tarafında vardı, native'de HİÇ çağrılmıyordu.
//  Sözleşme tipleri ve çekicisi 2026-11-03'te bağlandı (DEVAM.md
//  §20.16); bu kart o bağlantının EKRANA ULAŞAN ilk yüzü.
//
//  ── NİYE `EndeksNabziKarti` İLE ÇAKIŞMIYOR ─────────────────────────
//  O kart GÜNÜN nabzını ölçüyor (tek dönem, derin yorum). Bu kart AYNI
//  dört sembolün ZAMAN EKSENİNİ veriyor (altı dönem, yorum YOK). İkisi
//  ayrı uçlara gidiyor ve ayrı düşebiliyor; tek karta katlamak, biri
//  düştüğünde ölçülen ötekini de kaybettirirdi.
//
//  ── EVREN SABİT VE DÜRÜSTÇE YAZILI ────────────────────────────────
//  Ölçülen küme `ENDEKS_SEMBOLLER`: S&P 500 · Nasdaq · ons altın ·
//  BIST 100. Bu "senin evrenin" DEĞİL ve kart altyazısında böyle
//  yazıyor. Takip listesi bu uca GÖNDERİLMİYOR.
//
//  ── ÜÇÜNCÜ DURUM BURADA DA GEÇERLİ ────────────────────────────────
//  Bir dönem alanı gövdede HİÇ YOKSA o ölçüm İSTENMEDİ → hiçbir şey
//  çizilmiyor. Alan var ama `null` ise ölçüm İSTENDİ ve YAPILAMADI →
//  "ölçülemedi" yazılıyor. Hiçbir durumda `0` basılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  DEGISIM_DONEM_ALANLARI,
  DEGISIM_DONEMLER,
  ENDEKS_SEMBOLLER,
  fetchDegisim,
  useIstek,
  type DegisimDonem,
  type DegisimSatir,
} from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatPercent, formatPrice } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/** Dönemin ekranda görünen adı. Ad SÖZLÜK, eşik/ağırlık değil. */
const DONEM_ADI: Readonly<Record<DegisimDonem, string>> = {
  saatlik: 'gün içi',
  gunluk: '1 gün',
  haftalik: '7 gün',
  aylik: '30 gün',
  alti: '182 gün',
  yillik: '365 gün',
};

/** `DegisimSatir` alanından SAYI çıkarır; sayı değilse `null`. */
function sayi(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export type DonemDegisimKartiProps = {
  /** Sembole dokunuşun karşılığı çağıranın kararı. */
  onSembol?: (sym: string) => void;
};

export function DonemDegisimKarti({ onSembol }: DonemDegisimKartiProps) {
  const { colors } = useTheme();

  // `donemler` VERİLMİYOR: uç boş değeri "hepsi" sayıyor. İstemcinin
  // kendi listesini dayatması, ucun varsayılanı yarın büyüdüğünde
  // sessizce eski kalmak olurdu.
  const cagri = useCallback((signal: AbortSignal) => fetchDegisim([...ENDEKS_SEMBOLLER], { signal }), []);
  // Anahtar SABİT: girdi yok (küme sabit), yeniden tetikleyecek değişken yok.
  const { durum, veri, hata, yenile } = useIstek(cagri, 'donem-degisim');

  const satirlar: DegisimSatir[] = veri?.satirlar ?? [];
  const sayac = veri?.sayac;
  // Sorulan ↔ dönen farkı SESSİZ GEÇMİYOR: uç bir sembolü çözemezse
  // satır hiç gelmiyor, `tam` da her zaman düşmüyor.
  const sorulan = veri?.semboller?.length ?? 0;

  return (
    <Card
      title="📏 Çok dönemli değişim"
      subtitle="S&P 500 · Nasdaq · ons altın · BIST 100 üzerinden ölçüldü — takip listen değil">
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={4}
        sekil="satir"
        bosMetin="Dönem değişimi henüz sorulmadı."
      />

      {durum === 'veri' && veri ? (
        <>
          {!satirlar.length ? (
            <VeriYok kartsiz metin="Uç hiçbir sembol için değişim döndürmedi." />
          ) : (
            satirlar.map((s) => <SembolBlogu key={s.symbol} satir={s} onSembol={onSembol} />)
          )}

          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {sorulan +
              ' sembol soruldu · ' +
              satirlar.length +
              ' tanesi ölçüldü' +
              (sayac
                ? ' · üst kaynak isteği: ' +
                  sayac.istek +
                  ' (başarı ' +
                  sayac.basari +
                  ' · hata ' +
                  sayac.hata +
                  ' · zaman aşımı ' +
                  sayac.zamanAsimi +
                  ')'
                : '') +
              (veri.tam === false ? ' · ölçüm EKSİK' : '') +
              '.'}
          </Text>

          {veri.uyari ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>{veri.uyari}</Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/** Tek sembolün bloğu: fiyat künyesi + ölçülen dönemler. */
function SembolBlogu({
  satir,
  onSembol,
}: {
  satir: DegisimSatir;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const fiyat = sayi(satir.price);
  const onceki = sayi(satir.prevClose);

  return (
    <View style={[styles.blok, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <Text
          {...(onSembol
            ? {
                accessibilityRole: 'button' as const,
                accessibilityLabel: satir.symbol + ' — hisse sayfasına git',
                onPress: () => onSembol(satir.symbol),
              }
            : null)}
          style={[type.smallBold, { color: colors.text }]}>
          {satir.symbol}
        </Text>
        <View style={styles.bosluk} />
        {/* Gecikme RENKLE DEĞİL metinle: uç `gecikmeli` diyorsa yazıyoruz. */}
        {satir.gecikmeli ? (
          <Pill label="gecikmeli" tone="gold" variant="outline" glyph={null} size="sm" />
        ) : null}
        {satir.ok === false ? (
          <Pill label="ölçülemedi" tone="neutral" variant="outline" glyph={null} size="sm" />
        ) : null}
      </View>

      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {(fiyat == null
          ? 'fiyat ölçülemedi'
          : 'fiyat ' + formatPrice(fiyat, satir.currency)) +
          ' · ' +
          (onceki == null
            ? 'önceki kapanış ölçülemedi'
            : 'önceki kapanış ' + formatPrice(onceki, satir.currency))}
      </Text>

      <View style={styles.cipler}>
        {DEGISIM_DONEMLER.map((d) => (
          <DonemCipi key={d} satir={satir} donem={d} />
        ))}
      </View>
    </View>
  );
}

/**
 * Tek dönem. ÜÇ DURUM: alan gövdede yok → hiçbir şey çizilmiyor;
 * alan var `null` → "ölçülemedi"; sayı → yüzde + referans fiyat.
 */
function DonemCipi({ satir, donem }: { satir: DegisimSatir; donem: DegisimDonem }) {
  const { colors } = useTheme();
  const { alan, refAlan } = DEGISIM_DONEM_ALANLARI[donem];

  // "Sormadım" ile "ölçemedim" ayrımı alanın VARLIĞINDAN okunuyor.
  if (!Object.prototype.hasOwnProperty.call(satir, alan)) return null;

  const pct = sayi(satir[alan]);
  const ref = sayi(satir[refAlan]);
  const ad = DONEM_ADI[donem];

  if (pct == null) {
    return (
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {ad + ': ölçülemedi'}
      </Text>
    );
  }

  return (
    <View style={styles.donem}>
      <Text style={[type.micro, { color: colors.textDim }]}>{ad}</Text>
      <Text
        style={[
          type.smallBold,
          styles.num,
          // Yön İŞARETLE de taşınıyor: renk tek taşıyıcı değil.
          { color: pct > 0 ? colors.positive : pct < 0 ? colors.negative : colors.text },
        ]}>
        {(pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '• ') + formatPercent(pct)}
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
        {ref == null ? 'referans ölçülemedi' : 'ref ' + formatPrice(ref, satir.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: {
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  donem: { gap: 0, minWidth: 92 },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
