// =====================================================================
//  🔎 TARAMA — motorun önayar taraması                 (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: takip listesi, motorun üç önayarından biriyle (`value` ·
//  `growth` · `quality`) taranır. Skoru ve ölçüt rozetlerini MOTOR
//  veriyor; bu kart yalnız basıyor.
//
//  ── NEDEN BU KART YENİDEN YAZILDI (ÖLÇÜLDÜ 2026-10-27) ─────────────
//  Önceki hâli `/api/recommend` satırlarını prop olarak alıp YERELDE
//  süzüyordu: dosyada `const ESIK = 70` ve "bileşke ≥ 70", "banda
//  yakın", "momentum" ölçütleri elle yazılıydı. İki ayrı kural ihlali:
//  (1) `/api/tarama` HİÇ çağrılmıyordu — ÖLÇÜLDÜ, ekranda tek bir
//  `fetchRecommend(liste,{vade:'orta'})` turu vardı ve aynı cevap üç
//  karta dağıtılıyordu; (2) eşik native'de yaşıyordu, oysa eşik/ağırlık
//  motorun tekelinde. Yerel eşik motor eşiğinden saparsa ekran motorun
//  söylemediği bir şeyi motorun ağzından söylerdi. `ESIK` ve
//  `TaramaOlcutId` bu yüzden SİLİNDİ, geri gelmemeli.
//
//  ── NEDEN İKİ ÇAĞRI (yfin → tarama) ────────────────────────────────
//  `/api/tarama` AĞA ÇIKMIYOR: ölçümleri İSTEMCİ veriyor
//  (api/types.ts `OlcumKayit` başlığı; web tarafında bunu `/api/yfin`
//  taraması yapıyor). Burada da aynı sıra: önce `fetchYfin` künyeleri
//  çeker, sonra `fetchTarama` skorlar. YENİ FETCH İŞLEVİ YAZILMADI —
//  var olan ikisi tek `useIstek` çağrısında BİRLEŞTİRİLDİ.
//  `deep: false` BİLEREK: `deep`in tek getirisi `earnings` (kazanç
//  takvimi) ve o `OlcumKayit`in alanı değil; derin tur bedava değil.
//
//  ── ÖLÇÜLMEYEN SAYI BASILMAZ ───────────────────────────────────────
//  Künye alanı yoksa `null` geçiyor, 0 GEÇMİYOR (F/K'sı olmayan şirket
//  "F/K = 0" ile en ucuz görünürdü). `ok:false` künye motora `ok:false`
//  olarak gidiyor; motor onu `atlanan[]`a yazıyor.
//  `atlanan[]` BOŞ DEĞİLSE EKRAN SUSMAZ: her kalem gerekçesiyle basılır.
//  `/api/yfin` en çok 12 sembol alıyor (`YFIN_AZAMI_SEMBOL`); liste
//  uzunsa KAÇ SEMBOLÜN TARANMADIĞI ekranda yazılı — sessiz kırpma yok.
//
//  SIRALAMA SUNUCUDAN: `sonuclar` skoru azalan sırada geliyor
//  (api/types.ts), istemci yeniden sıralamıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchTarama,
  fetchYfin,
  useIstek,
  YFIN_AZAMI_SEMBOL,
  type ApiResult,
  type OlcumKayit,
  type TaramaOlcut,
  type TaramaPreset,
  type TaramaResponse,
  type TaramaSonuc,
  type YfinKunye,
  TARAMA_PRESETLER,
} from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatScore } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type TaramaKartProps = {
  /** Taranacak semboller — kullanıcının takip listesi. */
  liste: readonly string[];
  onSembol?: (sym: string) => void;
};

/**
 * Önayar adları. Motorun makine kodunun TÜRKÇE KARŞILIĞI — yeni bir
 * önayar değil. Uç `name`/`desc` alanlarını bilerek düşürdüğü için
 * (tavsiye dili taşıyorlardı) ad burada duruyor.
 */
const PRESET_AD: Record<TaramaPreset, string> = {
  value: 'ucuzluk ölçütleri',
  growth: 'büyüme ölçütleri',
  quality: 'kalite ölçütleri',
};

/**
 * `cls` rozetinin metni — motorun `scanTag` makine kodunun karşılığı
 * (api/types.ts `TARAMA_CLS`). Eşiği motor koydu; burada yalnız çeviri.
 */
const CLS_AD: Record<string, string> = {
  strong: 'ölçütlere güçlü uyum',
  good: 'ölçütlere kısmi uyum',
  weak: 'ölçütlere zayıf uyum',
};

/** Atlanma gerekçesi — motorun `reason`ı (api/_kesif.js:334). */
const NEDEN_AD: Record<string, string> = {
  'no-data': 'temel veri gelmedi — ÖLÇEMEDİM',
  'neg-earnings': 'kâr negatif olduğu için bu önayarla skorlanmadı',
};

/** Ölçüt rozetinin metni. `na` = ÖLÇÜLEMEDİ, "nötr" DEĞİL. */
const OLCUT_CLS_AD: Record<string, string> = {
  pass: 'karşılıyor',
  mid: 'sınırda',
  fail: 'karşılamıyor',
  na: 'ölçülemedi',
};

/** Ölçülmemiş sayı `null` — 0 DEĞİL. */
function sayi(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function metin(v: string | null | undefined): string | null {
  return typeof v === 'string' && v ? v : null;
}

/**
 * Künye → ölçüm kaydı. `market` BİLEREK VERİLMİYOR: sunucu `.IS`
 * ekiyle biten sembolü kendisi BIST'e çözüyor (ÖLÇÜLDÜ
 * `api/_girdi.js:204 temizleSembol`). İstemcinin pazar tahmin etmesi
 * uydurma bir eşleme olurdu.
 */
function olcumYap(k: YfinKunye): OlcumKayit {
  return {
    symbol: k.symbol,
    ok: k.ok,
    trailingPE: sayi(k.trailingPE),
    forwardPE: sayi(k.forwardPE),
    peg: sayi(k.peg),
    priceToBook: sayi(k.priceToBook),
    priceToSales: sayi(k.priceToSales),
    evEbitda: sayi(k.evEbitda),
    marketCap: sayi(k.marketCap),
    profitMargin: sayi(k.profitMargin),
    returnOnEquity: sayi(k.returnOnEquity),
    revenueGrowth: sayi(k.revenueGrowth),
    earningsGrowth: sayi(k.earningsGrowth),
    debtToEquity: sayi(k.debtToEquity),
    dividendYield: sayi(k.dividendYield),
    price: sayi(k.price),
    sector: metin(k.sector),
    industry: metin(k.industry),
    name: metin(k.name),
  };
}

export function TaramaKart({ liste, onSembol }: TaramaKartProps) {
  const { colors } = useTheme();
  const [preset, setPreset] = useState<TaramaPreset>('value');

  // Kırpma AÇIK: `fetchYfin` 12'den fazlasını reddediyor; kaç sembolün
  // dışarıda kaldığı aşağıda ekrana yazılıyor.
  const evren = useMemo(() => liste.slice(0, YFIN_AZAMI_SEMBOL), [liste]);
  const disarida = liste.length - evren.length;

  const cagri = useCallback(
    async (signal: AbortSignal): Promise<ApiResult<TaramaResponse>> => {
      const kunye = await fetchYfin([...evren], { deep: false, signal });
      if (!kunye.ok) return { ok: false, error: kunye.error };
      const olcumler = kunye.data.results.map(olcumYap);
      return fetchTarama(preset, olcumler, { signal });
    },
    [evren, preset],
  );

  const { durum, veri, hata, yenile } = useIstek(cagri, preset + '|' + evren.join(','), {
    etkin: evren.length > 0,
  });

  const sonuclar: TaramaSonuc[] = veri?.sonuclar ?? [];
  const atlanan = veri?.atlanan ?? [];

  return (
    <Card
      title="🔎 Tarama"
      subtitle={'Takip listesi · ' + PRESET_AD[preset] + ' — al/sat işareti değil'}>
      <View style={styles.cipler}>
        {TARAMA_PRESETLER.map((p) => (
          <PresetCipi
            key={p}
            etiket={PRESET_AD[p]}
            aktif={p === preset}
            onPress={() => setPreset(p)}
          />
        ))}
      </View>

      {!liste.length ? (
        <VeriYok kartsiz metin="Takip listesi boş — taranacak sembol yok." />
      ) : (
        <>
          <Durum
            durum={durum}
            hata={hata}
            yenile={yenile}
            kartsiz
            iskelet={3}
            sekil="sira"
            bosMetin="Tarama henüz çalıştırılmadı."
          />

          {durum === 'veri' ? (
            <>
              {!sonuclar.length ? (
                <VeriYok
                  kartsiz
                  metin="Bu önayarla skorlanabilen sembol çıkmadı — aşağıdaki gerekçelere bakın."
                />
              ) : (
                // Sıra SUNUCUDAN; burada yeniden sıralama yok.
                sonuclar.map((s) => (
                  <TaramaSatiri key={s.market + ':' + s.sym} sonuc={s} onSembol={onSembol} />
                ))
              )}

              {/* `atlanan[]` boş değilse ekran SUSMAZ. */}
              {atlanan.length ? (
                <View style={styles.bolum}>
                  <Text style={[type.microBold, { color: colors.textDim }]}>
                    {'Skorlanmayan ' + atlanan.length + ' sembol (sıfır skor DEĞİL):'}
                  </Text>
                  {atlanan.map((a) => (
                    <Text
                      key={a.market + ':' + a.sym}
                      style={[type.micro, { color: colors.textFaint }]}>
                      {a.sym + ' — ' + (NEDEN_AD[a.neden] ?? a.neden)}
                    </Text>
                  ))}
                </View>
              ) : null}

              {disarida > 0 ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Listedeki ' +
                    disarida +
                    ' sembol bu turda TARANMADI: tek turda en çok ' +
                    YFIN_AZAMI_SEMBOL +
                    ' sembolün temel verisi çekilebiliyor.'}
                </Text>
              ) : null}

              <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
                {(veri?.degerlendirilen ?? 0) + ' kayıt değerlendirildi · motor ' + (veri?.surum?.motor ?? '?')}
              </Text>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

/** Tek taranmış kayıt. Skor ve rozetler MOTORDAN; burada hesap yok. */
function TaramaSatiri({
  sonuc,
  onSembol,
}: {
  sonuc: TaramaSonuc;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const clsMetni = sonuc.cls ? (CLS_AD[sonuc.cls] ?? sonuc.cls) : null;

  const govde = (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {sonuc.sym}
        </Text>
        <View style={styles.bosluk} />
        <Text style={[type.smallBold, styles.num, { color: colors.text }]}>
          {formatScore(sonuc.skor)}
        </Text>
      </View>

      <Text style={[type.micro, { color: colors.textDim }]}>
        {(clsMetni ? clsMetni + ' · ' : '') + sonuc.present + ' ölçüt ölçüldü'}
      </Text>

      {sonuc.olcutler?.length ? (
        <View style={styles.cipler}>
          {sonuc.olcutler.map((o: TaramaOlcut, i) => (
            <Pill
              key={o.ad + ':' + i}
              label={o.ad + ' — ' + (OLCUT_CLS_AD[o.cls] ?? o.cls)}
              tone="neutral"
              variant="outline"
              glyph={null}
              size="sm"
            />
          ))}
        </View>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Motor bu kayıt için ölçüt dökümü döndürmedi.
        </Text>
      )}
    </View>
  );

  if (!onSembol) return govde;

  return (
    <Pressable
      onPress={() => onSembol(sonuc.sym)}
      accessibilityRole="button"
      accessibilityLabel={sonuc.sym + ' — hisse sayfasına git'}
      style={({ pressed }) => (pressed ? { backgroundColor: colors.bgPressed } : null)}>
      {govde}
    </Pressable>
  );
}

/** Önayar çipi. Seçim RENKLE DEĞİL: başta "•" ve erişilebilirlik durumu. */
function PresetCipi({
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
      accessibilityLabel={'Önayar: ' + etiket + (aktif ? ' — seçili' : '')}
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
  satir: { gap: space.xxs, paddingVertical: space.sm },
  bolum: { gap: space.xxs, paddingTop: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Çip küçük; 44'lük dokunma hedefini kabı tutuyor.
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
