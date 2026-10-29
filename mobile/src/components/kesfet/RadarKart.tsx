// =====================================================================
//  🌍 RADAR — motorun tema → sektör sözlüğü            (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/radar`ın döndürdüğü tema listesi. Her tema için etiket,
//  haber dili, haber taramasının ARAMA METNİ (`sorgu`) ve temanın
//  dokunduğu sektörler + yön etiketi (`etkiler`). Bir sektör seçilirse
//  uç o etikete sahip MOTOR SÖZLÜĞÜNDEKİ sembolleri de döndürüyor.
//
//  ── NEDEN BU KART YENİDEN YAZILDI (ÖLÇÜLDÜ 2026-10-27) ─────────────
//  Önceki hâli `/api/recommend` satırlarını prop olarak alıp takip
//  listesinin durum tablosunu çiziyordu. ÖLÇÜLDÜ (`(tabs)/kesfet.tsx`
//  eski :74): ekranda TEK bir `fetchRecommend(liste, {vade:'orta'})`
//  turu vardı ve aynı cevap üç karta (Radar · Fırsatlar · Tarama)
//  dağıtılıyordu; `/api/radar` HİÇ çağrılmıyordu. Yani üç kart aynı
//  veriyi üç ad altında gösteriyordu — kullanıcıya üç ayrı ölçüm
//  yapılmış gibi görünüyordu, oysa bir ölçüm vardı. Bu kart artık KENDİ
//  ucuna gidiyor ve takip listesinin durum tablosu DEĞİL.
//
//  ── BU KART BİR AL/SAT İŞARETİ DEĞİL ───────────────────────────────
//  `etkiler` kaleminin `up`/`down` değeri motorun SÖZLÜĞÜNDE yazılı bir
//  YÖN ETİKETİ (api/types.ts `RadarYon`). "Şu sektör yükselir" demiyor,
//  "bu tema bu sektöre bu yönde dokunur" diyor. Metin uçtan geldiği gibi
//  basılıyor; burada eşik, ağırlık, skor, sıralama YOK.
//
//  NEDEN YÖN RENKLE DEĞİL İŞARETLE: yön ▲/▼ karakteriyle taşınıyor ve
//  tonu nötr. Renk tek taşıyıcı olsaydı renk körü kullanıcı yönü hiç
//  göremezdi (yol haritası kuralı).
//
//  NEDEN SEKTÖR ADLARI BİR DURUMDA SAKLANIYOR: `sektorler` sözlüğü her
//  cevapta geliyor ama sektör seçimi `useIstek` anahtarını değiştirdiği
//  için yeni tur sırasında `veri` bir an `null` oluyor. Çipler o anda
//  ekrandan kaybolsa kullanıcı seçimini geri alamazdı. Bu bir ÖNBELLEK,
//  hesap değil — hiçbir sayıya dokunmuyor.
//
//  VERİ BU KARTIN İÇİNDE ÇEKİLİYOR (bilinçli): `/api/radar` saf sözlük
//  okuması, recommend turuyla ilgisi yok; biri düşerken öteki durabilir
//  ve ekranda ikisi AYRI anlatılmalı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchRadar, useIstek, type RadarTema } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type RadarKartProps = {
  /**
   * Sembol dokunuşunun karşılığı çağıranın kararı; verilmezse
   * `semboller` listesi basılır ama basılabilir değildir.
   */
  onSembol?: (sym: string) => void;
  /** Açılışta seçili sektör. `semboller` YALNIZ bir sektör seçiliyken gelir. */
  baslangicSektor?: string | null;
};

export function RadarKart({ onSembol, baslangicSektor }: RadarKartProps) {
  const { colors } = useTheme();
  const [sektor, setSektor] = useState<string | null>(baslangicSektor ?? null);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchRadar({ sektor: sektor ?? undefined, signal }),
    [sektor],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'radar:' + (sektor ?? ''));

  // Sektör adları önbelleği (bkz. başlık). Yalnız DOLU sözlük yazılıyor:
  // boş bir cevap, elde duran adları silmesin.
  //
  // NEDEN `useEffect` DEĞİL (ŞERİT F6 / 2026-10-29): önbellek bir effect
  // içinde `setSektorAdlari` ile yazılıyordu ve `react-hooks/
  // set-state-in-effect` bunu HATA sayıyor (ölçüldü: eslint EXIT 1,
  // RadarKart.tsx:74) — effect gövdesindeki setState basamaklı render
  // doğuruyor. Davranış AYNI tutuldu: dolu sözlük gelirse önbellek
  // güncellenir, boş/eksik cevap elde duranı SİLMEZ. Değişen tek şey
  // yazmanın render sırasında olması (React'in "prop değişince state
  // ayarla" deseni), yani bir render turu daha kısa.
  const [sektorAdlari, setSektorAdlari] = useState<Record<string, string>>({});
  const gelenAdlar = veri?.sektorler;
  if (gelenAdlar && Object.keys(gelenAdlar).length && gelenAdlar !== sektorAdlari) {
    setSektorAdlari(gelenAdlar);
  }

  const temalar: RadarTema[] = veri?.temalar ?? [];
  // `semboller` SADECE `sektor=` verildiğinde geliyor (api/types.ts).
  // `undefined` ile boş dizi AYRI: biri "sorulmadı", öteki "sorulduk, yok".
  const semboller = veri?.semboller;

  const sektorCipleri = useMemo(
    () => Object.keys(sektorAdlari).sort((a, b) => a.localeCompare(b, 'tr')),
    [sektorAdlari],
  );

  const sektorAdi = useCallback(
    (anahtar: string) => sektorAdlari[anahtar] ?? anahtar,
    [sektorAdlari],
  );

  return (
    <Card
      title="🌍 Radar"
      subtitle="Motorun tema → sektör sözlüğü — yön etiketi, al/sat işareti değil">
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="sira"
        bosMetin="Radar sözlüğü henüz sorulmadı."
      />

      {durum === 'veri' ? (
        <>
          {sektorCipleri.length ? (
            <View style={styles.cipler}>
              {/* "Hepsi" çipi: seçim kaldırıldığında uç `semboller`
                  döndürmüyor, yalnız tema listesi geliyor. */}
              <SektorCipi
                etiket="tüm temalar"
                aktif={sektor == null}
                onPress={() => setSektor(null)}
              />
              {sektorCipleri.map((k) => (
                <SektorCipi
                  key={k}
                  etiket={sektorAdi(k)}
                  aktif={sektor === k}
                  onPress={() => setSektor(sektor === k ? null : k)}
                />
              ))}
            </View>
          ) : null}

          {!temalar.length ? (
            <VeriYok
              kartsiz
              metin={
                sektor
                  ? '“' + sektorAdi(sektor) + '” için motor sözlüğünde tema yok.'
                  : 'Motor sözlüğü tema döndürmedi.'
              }
            />
          ) : (
            temalar.map((t) => (
              <TemaSatiri key={t.anahtar} tema={t} sektorAdi={sektorAdi} />
            ))
          )}

          {/* Sektör sembolleri: motorun SÖZLÜĞÜNDEKİ semboller.
              Kullanıcının takip listesi DEĞİL — başlıkta yazılı. */}
          {sektor ? (
            semboller === undefined ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                Uç bu sektör için sembol listesi döndürmedi — ÖLÇEMEDİM.
              </Text>
            ) : !semboller.length ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'“' + sektorAdi(sektor) + '” etiketini taşıyan sembol motor sözlüğünde yok.'}
              </Text>
            ) : (
              <View style={styles.bolum}>
                <Text style={[type.microBold, { color: colors.textDim }]}>
                  {sektorAdi(sektor) + ' — motor sözlüğündeki semboller (takip listesi değil)'}
                </Text>
                <View style={styles.cipler}>
                  {semboller.map((s) => (
                    <SembolCipi key={s} sym={s} onSembol={onSembol} />
                  ))}
                </View>
              </View>
            )
          ) : null}

          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {temalar.length + ' tema · ' + sektorCipleri.length + ' sektör sözlükten okundu.'}
          </Text>
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek tema. Dört bilgi de UÇTAN: etiket, haber dili, haber sorgusu ve
 * sektör etkileri. Hiçbiri burada türetilmiyor, çevrilmiyor, kısaltılmıyor.
 */
function TemaSatiri({
  tema,
  sektorAdi,
}: {
  tema: RadarTema;
  sektorAdi: (anahtar: string) => string;
}) {
  const { colors } = useTheme();
  const etkiler = tema.etkiler ?? [];

  return (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={2}>
          {tema.etiket || tema.anahtar}
        </Text>
        <View style={styles.bosluk} />
        {/* Haber dili uçtan ('tr' | 'en' ölçüldü, küme kapalı değil). */}
        <Pill label={tema.dil || 'dil bildirilmedi'} tone="neutral" glyph={null} size="sm" />
      </View>

      <Text style={[type.micro, { color: colors.textDim }]}>
        {'haber sorgusu: ' + (tema.sorgu || 'verilmedi')}
      </Text>

      {etkiler.length ? (
        <View style={styles.cipler}>
          {etkiler.map(([anahtar, yon], i) => (
            <Pill
              key={anahtar + ':' + yon + ':' + i}
              label={sektorAdi(anahtar)}
              tone="info"
              // Yön RENKLE DEĞİL işaretle: ▲/▼ karakteri taşıyor.
              glyph={yon === 'up' ? '▲' : yon === 'down' ? '▼' : null}
              size="sm"
            />
          ))}
        </View>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu tema için sektör etkisi sözlükte yazılı değil.
        </Text>
      )}
    </View>
  );
}

/** Sektör süzgeci çipi. Seçim RENKLE DEĞİL: başta "•", tonu da değişiyor. */
function SektorCipi({
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
      accessibilityLabel={'Sektör: ' + etiket + (aktif ? ' — seçili' : '')}
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

/** Sözlükteki sembol. Basılabilir olması çağıranın `onSembol`una bağlı. */
function SembolCipi({ sym, onSembol }: { sym: string; onSembol?: (sym: string) => void }) {
  const { colors } = useTheme();
  const govde = <Pill label={sym} tone="neutral" variant="outline" glyph={null} size="sm" />;

  if (!onSembol) return govde;

  return (
    <Pressable
      onPress={() => onSembol(sym)}
      accessibilityRole="button"
      accessibilityLabel={sym + ' — hisse sayfasına git'}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.cipKabi,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      {govde}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  bolum: { gap: space.xs, paddingTop: space.sm },
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
