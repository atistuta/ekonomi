// =====================================================================
//  🪙 MADEN HABERİ — /api/metal                          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  ⚠️ BU KART FİYAT GÖSTERMEZ. `/api/metal` adı yanıltıcı: fiyat
//  döndürmüyor, üç maden (altın · gümüş · platin) için TR ve/veya dünya
//  RSS HABER MADDELERİ döndürüyor. Ons altın FİYATI bu uçta değil —
//  Bugün sekmesindeki çok dönemli değişim kartı onu `GC=F` ile ölçüyor.
//  Bu yüzden kartın adı "Maden haberi", altyazısı da bunu yazıyor:
//  kullanıcı burada fiyat aramasın.
//
//  ── NİYE BU UÇ BUGÜNE KADAR NATIVE'DE YOKTU ────────────────────────
//  `/api/metal` web tarafında vardı, native'de HİÇ çağrılmıyordu.
//  Sözleşme tipleri ve `fetchMetal` 2026-11-03'te bağlandı (DEVAM.md
//  §20.16); bu kart o bağlantının ekrana ulaşan yüzü.
//
//  ── KAPSAM ÇİPİ NİYE VAR ──────────────────────────────────────────
//  Uç `hepsi` · `tr` · `dunya` kapalı kümesini kabul ediyor ve kapsam
//  CEVABIN ŞEKLİNİ değiştiriyor: `tr` seçilince satırda `dunya` alanı
//  HİÇ GELMİYOR. O da üçüncü durum: alan yok → SORULMADI (boş değil).
//  Çip olmasa kullanıcı neyi görmediğini bilemezdi.
//
//  ── MADDE SAYISI: KIRPMA EKRANDA DEĞİL ────────────────────────────
//  Limit UCA gönderiliyor (`METAL_VARSAYILAN_LIMIT`), burada ikinci bir
//  kırpma yapılmıyor. Kaç madde basıldığı künyede yazılı.
//
//  ── ÖLÇÜM EKSİĞİ ROZETİ NİYE HABER ROZETİ ─────────────────────────
//  Bu uç gerçekten BESLEME okuyor (`api/_haber.js`), sayacı da haber
//  sayacıyla aynı altı alanı taşıyor. Bu yüzden skor biçimli
//  `OlcumEksikRozet` DEĞİL, `HaberOlcumEksikRozet` kullanılıyor — iki
//  rozetin karıştırılmaması `Durum.tsx` başlığında yazılı kural.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchMetal,
  METAL_KAPSAMLAR,
  useIstek,
  VARSAYILAN_METAL_KAPSAM,
  type HaberMadde,
  type MetalKapsam,
  type MetalSatir,
} from '@/api';
import { Card, Durum, HaberOlcumEksikRozet, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

import { HaberSatiri } from './HaberSatiri';

/** Maden adı — SÖZLÜK, eşik değil. Bilinmeyen anahtar ham basılıyor. */
const MADEN_ADI: Readonly<Record<string, string>> = {
  altin: 'Altın',
  gumus: 'Gümüş',
  platin: 'Platin',
};

/** Kapsam çipinin etiketi. */
const KAPSAM_ADI: Readonly<Record<string, string>> = {
  hepsi: 'TR + dünya',
  tr: 'yalnız TR',
  dunya: 'yalnız dünya',
};

export function MadenHaberKart() {
  const { colors } = useTheme();
  const [kapsam, setKapsam] = useState<MetalKapsam>(VARSAYILAN_METAL_KAPSAM);

  // `madenler` ve `limit` VERİLMİYOR: uç üçünü birlikte ve kendi
  // varsayılan madde sayısıyla ölçüyor. İstemcinin kendi sayısını
  // dayatması, ucun varsayılanı değiştiğinde sessizce eski kalmak olurdu.
  const cagri = useCallback((signal: AbortSignal) => fetchMetal({ kapsam, signal }), [kapsam]);
  const { durum, veri, hata, yenile } = useIstek(cagri, 'maden-haber:' + kapsam);

  const satirlar: MetalSatir[] = veri?.satirlar ?? [];
  const sayac = veri?.sayac;
  const basilan = satirlar.reduce(
    (t, s) => t + (s.tr?.length ?? 0) + (s.dunya?.length ?? 0),
    0,
  );

  return (
    <Card
      title="🪙 Maden haberi"
      subtitle="Altın · gümüş · platin haber maddeleri — fiyat değil (fiyat: Bugün › çok dönemli değişim)">
      <View style={styles.cipler}>
        {METAL_KAPSAMLAR.map((k) => (
          <KapsamCipi
            key={k}
            etiket={KAPSAM_ADI[k] ?? k}
            aktif={kapsam === k}
            onPress={() => setKapsam(k)}
          />
        ))}
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Maden haberi henüz sorulmadı."
      />

      {durum === 'veri' && veri ? (
        <>
          <HaberOlcumEksikRozet kaynak={veri} />

          {veri.tam === false ? (
            <OlcemedimKutu
              metin="Beslemelerin bir bölümü okunamadı: aşağıdaki liste EKSİK."
              yenile={yenile}
            />
          ) : null}

          {!satirlar.length ? (
            <VeriYok kartsiz metin="Uç hiçbir maden için satır döndürmedi." />
          ) : (
            satirlar.map((s) => <MadenBlogu key={String(s.maden)} satir={s} />)
          )}

          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {satirlar.length +
              ' maden · ' +
              basilan +
              ' madde basıldı (uç madde sayısı: ' +
              veri.limit +
              ')' +
              (sayac
                ? ' · besleme isteği: ' +
                  sayac.istek +
                  ' (başarı ' +
                  sayac.basari +
                  ' · hata ' +
                  sayac.hata +
                  ' · zaman aşımı ' +
                  sayac.zamanAsimi +
                  ' · kısa gövde ' +
                  sayac.kisa +
                  ')'
                : '') +
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

/** Tek maden: kapsamın izin verdiği yerellerin maddeleri. */
function MadenBlogu({ satir }: { satir: MetalSatir }) {
  const { colors } = useTheme();
  const ad = MADEN_ADI[String(satir.maden)] ?? String(satir.maden);

  return (
    <View style={[styles.blok, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]}>{ad}</Text>
        <View style={styles.bosluk} />
        {/* `ysym` uçtan geliyor; FİYAT ölçümü BURADA YAPILMIYOR —
            sembolü yazmak, fiyatın hangi sembolle ölçülebileceğini
            söylemek içindir. */}
        {satir.ysym ? (
          <Pill
            label={satir.ysym + ' (fiyat bu uçta değil)'}
            tone="neutral"
            variant="outline"
            glyph={null}
            size="sm"
          />
        ) : null}
      </View>

      <YerelBolum satir={satir} alan="tr" etiket="Türkiye" />
      <YerelBolum satir={satir} alan="dunya" etiket="Dünya" />
    </View>
  );
}

/**
 * Bir yerelin maddeleri. ÜÇ DURUM: alan yok → kapsam dışı, hiçbir şey
 * çizilmiyor; boş dizi → "ölçtüm, madde yok"; dolu → maddeler.
 */
function YerelBolum({
  satir,
  alan,
  etiket,
}: {
  satir: MetalSatir;
  alan: 'tr' | 'dunya';
  etiket: string;
}) {
  const { colors } = useTheme();

  // Kapsam bu yereli istemediyse alan GÖVDEDE YOK: "madde yok" demek,
  // sorulmamış olanı ölçülmüş göstermek olurdu.
  if (!Object.prototype.hasOwnProperty.call(satir, alan)) return null;

  const maddeler: HaberMadde[] = satir[alan] ?? [];

  return (
    <View style={styles.bolum}>
      <Text style={[type.microBold, { color: colors.textDim }]}>{etiket}</Text>
      {!maddeler.length ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu yerelde pencere içinde madde bulunmadı.
        </Text>
      ) : (
        maddeler.map((m, i) => <HaberSatiri key={(m.link || m.title) + ':' + i} madde={m} />)
      )}
    </View>
  );
}

/** Kapsam çipi. Seçim RENKLE DEĞİL: başta "•", tonu da değişiyor. */
function KapsamCipi({
  etiket,
  aktif,
  onPress,
}: {
  etiket: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={'Kapsam: ' + etiket + (aktif ? ' — seçili' : '')}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.cipKabi,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      <Pill
        label={(aktif ? '• ' : '') + etiket}
        tone={aktif ? 'gold' : 'neutral'}
        variant={aktif ? 'soft' : 'outline'}
        glyph={null}
        size="sm"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blok: {
    gap: space.xs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bolum: { gap: space.xxs },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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
