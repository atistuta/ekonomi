// =====================================================================
//  🌍 RADAR — takip listesinin tek bakışta hâli       (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: takip listesindeki her sembol için üç şey yan yana: motorun
//  bileşke skoru, `plan.yakinlik.state` kararı ve `tam` bayrağı. Eksik
//  ölçümü olan satır `OlcumEksikRozet` ile İŞARETLENİR.
//
//  NEDEN "RADAR" BİR LİSTE DEĞİL DE DURUM TABLOSU: Fırsatlar sıralıyor,
//  Tarama süzüyor — ikisi de evreni DARALTIYOR. Kullanıcının bir de
//  daraltılmamış hâli görmesi gerekiyor, yoksa "listemdeki şu sembol
//  nerede?" sorusunun cevabı yok. Burada hiçbir satır düşmüyor.
//
//  ── `composite.score` DİYE BİR ALAN YOK (ÖLÇÜLDÜ) ──────────────────
//  Uç sözleşmesinde (api/types.ts `ScoreComposite`) bileşkenin alanları
//  `band`, `label`, `blended`, `blendedShown`. `score` adı skor
//  tarafında `ta.score`/`fa.score` için kullanılıyor. Bu yüzden kart
//  `blendedShown` (motorun GÖSTERDİĞİ yuvarlanmış sayı) okuyor,
//  yoksa `blended`e düşüyor. Var olmayan bir alanı okumak satırın
//  sessizce boş kalması demekti; yeni bir sayı türetmek ise istemcide
//  skor hesaplamak olurdu — ikisi de yapılmadı.
//
//  NEDEN `tam` AYRI BİR SÜTUN: HTTP 200 + `tam:false` bir başarı DEĞİL.
//  Satırın skoru gelmiş olabilir ama turun bir ayağı kesilmiştir;
//  kullanıcı o skoru okurken eksik ölçümü BİLMEK zorunda. Rozet
//  sayıların önünde duruyor ve veriyi gizlemiyor (ölçülen kalemler
//  gerçekten ölçüldü).
//
//  NEDEN MOTORUN DÖNDÜRMEDİĞİ SEMBOLLER DE YAZILI: `liste` verilirse
//  cevapta karşılığı olmayan semboller "ölçülmedi" diye BASILIYOR.
//  Sessizce atlamak, kullanıcının listesinde olan bir sembolün ekranda
//  hiç görünmemesi demekti — "iyi haber yok" sanılırdı.
//
//  SIRALAMA: `liste` verildiyse KULLANICININ sırası korunuyor; motorun
//  dönüş sırası değil. Yeni bir sıra kuralı (skora göre dizmek)
//  üretilmiyor — o Fırsatlar kartının işi.
//
//  VERİ BU KARTIN İÇİNDE ÇEKİLMİYOR: `fetch` yok; satırlar prop.
//
//  ── `.IS` EŞLEŞTİRMESİ (ÖLÇÜLDÜ 2026-10-25, üretim) ────────────────
//  Takip listesinde sembol `THYAO.IS` yazıyor; `/api/recommend` AYNI
//  satırı `sym: "THYAO"` olarak döndürüyor (`market: "BIST"`). Birebir
//  dizgi eşleştirmesi bu yüzden ekrana YANLIŞ BİR İDDİA bastırdı:
//  Fırsatlar ve Tarama kartları THYAO'yu ölçülmüş gösterirken Radar
//  "motor bu sembol için satır döndürmedi" diyordu. Eşleştirme artık
//  anahtar üzerinden: büyük harf + sondaki `.IS` kırpılmış. Bu bir
//  EŞLEME, hesap değil — hiçbir sayıya dokunulmuyor ve ekranda yazan
//  etiket kullanıcının listesindeki hâli kalıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  olcumEksik,
  type ApiError,
  type IstekDurum,
  type RecommendRow,
  type Sayac,
} from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { formatScore } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type RadarKartProps = {
  /** `/api/recommend` turunun satırları. Kart bunu KENDİ çekmiyor. */
  satirlar: RecommendRow[];
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** Turun künyesi; verilirse eksik ölçüm rozeti listenin üstünde çizilir. */
  kaynak?: { tam?: boolean; sayac?: Sayac } | null;
  /**
   * Kullanıcının takip listesi. Verilirse SIRA bu listeden gelir ve
   * cevapta karşılığı olmayan semboller "ölçülmedi" diye yazılır.
   * Verilmezse yalnız gelen satırlar, geldikleri sırada basılır.
   */
  liste?: readonly string[];
  /** Zaman bütçesi dolduğu için hiç başlanmayanlar (`cevap.atlanan`). */
  atlanan?: readonly string[];
  /** Satır dokunuşunun karşılığı çağıranın kararı; yoksa satır basılmaz. */
  onSembol?: (sym: string) => void;
};

/** Motorun gösterdiği bileşke. Yedek okuma, hesap değil (bkz. başlık). */
function bileske(r: RecommendRow): number | null {
  const v = r.composite?.blendedShown ?? r.composite?.blended ?? null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Eşleştirme anahtarı: büyük harf + sondaki `.IS` kırpılmış. Uç, BIST
 * sembolünü soneksiz döndürüyor (bkz. başlık). Yalnız karşılaştırma
 * için; ekrana basılan etiket kullanıcının yazdığı hâl.
 */
function anahtar(sym: string): string {
  const s = String(sym).trim().toUpperCase();
  return s.endsWith('.IS') ? s.slice(0, -3) : s;
}

/** Ekranda bir satırın taşıyabileceği iki hâl: ölçülmüş ya da hiç yok. */
type RadarKayit =
  | { sym: string; satir: RecommendRow }
  | { sym: string; satir: null; sebep: 'atlandi' | 'donmedi' };

export function RadarKart({
  satirlar,
  durum,
  hata,
  yenile,
  kaynak,
  liste,
  atlanan,
  onSembol,
}: RadarKartProps) {
  const { colors } = useTheme();

  const kayitlar = useMemo<RadarKayit[]>(() => {
    const harita = new Map(satirlar.map((r) => [anahtar(r.sym), r]));
    const atlananSet = new Set((atlanan ?? []).map(anahtar));
    // Sıra kullanıcının listesinden; liste yoksa motorun dönüş sırası.
    const siralı = liste && liste.length ? liste : satirlar.map((r) => r.sym);
    return siralı.map((sym) => {
      const satir = harita.get(anahtar(sym));
      if (satir) return { sym, satir };
      return { sym, satir: null, sebep: atlananSet.has(anahtar(sym)) ? 'atlandi' : 'donmedi' };
    });
  }, [satirlar, liste, atlanan]);

  const eksikSayisi = kayitlar.filter((k) => k.satir && olcumEksik(k.satir)).length;
  const olcumsuz = kayitlar.filter((k) => !k.satir).length;

  return (
    <Card
      title="🌍 Radar"
      subtitle="Takip listesinin tek bakışta hâli — bileşke · yakınlık · ölçüm">
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
          {kaynak ? <OlcumEksikRozet kaynak={kaynak} /> : null}

          {!kayitlar.length ? (
            <VeriYok
              kartsiz
              metin="Radar için satır yok: motor sonuç döndürmedi ve takip listesi de boş."
            />
          ) : (
            kayitlar.map((k) =>
              k.satir ? (
                <RadarSatiri key={k.sym} satir={k.satir} onSembol={onSembol} />
              ) : (
                <OlculmeyenSatir key={k.sym} sym={k.sym} sebep={k.sebep} />
              ),
            )
          )}

          {/* Dipnot SAYIYLA: "bir şeyler eksik" demek yerine kaç satırın
              eksik olduğu yazılı. */}
          {eksikSayisi > 0 || olcumsuz > 0 ? (
            <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
              {[
                eksikSayisi > 0 ? eksikSayisi + ' satırın ölçümü eksik tamamlandı.' : null,
                olcumsuz > 0 ? olcumsuz + ' sembol için hiç ölçüm dönmedi.' : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Ölçülmüş satır. Üç bilgi: bileşke (uçtan), yakınlık durumu (uçtan),
 * ölçüm tamlığı (uçtan). Hiçbiri burada türetilmiyor.
 */
function RadarSatiri({
  satir,
  onSembol,
}: {
  satir: RecommendRow;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const bl = bileske(satir);
  const yk = satir.plan?.yakinlik?.state ?? null;
  const eksik = olcumEksik(satir);

  const govde = (
    <>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {satir.sym}
        </Text>
        {/* Yakınlık motorun KARARI; etiket metni olduğu gibi basılıyor. */}
        <Pill label={yk ?? 'yakınlık ölçülemedi'} tone="info" glyph={null} size="sm" />
        <View style={styles.bosluk} />
        <Text
          style={[type.smallBold, styles.num, { color: colors.text }]}
          accessibilityLabel={'bileşke skoru ' + formatScore(bl)}>
          {formatScore(bl)}
        </Text>
      </View>
      {/* Bant da uçtan: `composite.band` yoksa sebebi (`why`) yazılı. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        {'bant ' + (satir.composite?.band ?? 'ölçülemedi') +
          (satir.composite?.band ? '' : satir.composite?.why ? ' — ' + satir.composite.why : '')}
      </Text>
      {/* Eksik ölçüm rozeti SAYILARIN altında değil satırın içinde:
          hangi sembolün ölçümü eksik, o sembolün yanında yazıyor. */}
      {eksik ? <OlcumEksikRozet kaynak={satir} /> : null}
    </>
  );

  if (!onSembol) {
    return <View style={styles.satir}>{govde}</View>;
  }

  return (
    <Pressable
      onPress={() => onSembol(satir.sym)}
      accessibilityRole="button"
      accessibilityLabel={satir.sym + ' — analize git'}
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

/**
 * Listede olup cevapta OLMAYAN sembol. İki ayrı sebep, iki ayrı cümle:
 * `atlandi` turun zaman bütçesi dolduğu için hiç başlanmadı (motor
 * SÖYLÜYOR: `cevap.atlanan`), `donmedi` ise sebebi bilinmiyor. İkincisi
 * için sebep UYDURULMUYOR.
 */
function OlculmeyenSatir({
  sym,
  sebep,
}: {
  sym: string;
  sebep: 'atlandi' | 'donmedi';
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.textDim }]} numberOfLines={1}>
          {sym}
        </Text>
        <Pill label="ölçülmedi" tone="gold" glyph={null} size="sm" />
      </View>
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {sebep === 'atlandi'
          ? 'Tur zaman bütçesi dolduğu için bu sembole hiç başlanmadı.'
          : 'Motor bu sembol için satır döndürmedi — sebebini ölçemedim.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  basilabilir: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
