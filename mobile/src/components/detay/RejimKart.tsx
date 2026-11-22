// =====================================================================
//  RejimKart — teknik skorun VADEYE göre değişimi      (PROcess / native)
// ---------------------------------------------------------------------
//  NE: aynı sembolün KISA · ORTA · UZUN penceresindeki teknik skoru ve
//  motorun rejim rozetini (`ta.regime`) yan yana basar. Tasarım dilinde
//  "rejim grafiği" diye geçen üç renkli çubuk bu.
//
//  NEDEN GEREKLİ: ekran tek vade gösteriyordu. Motor DÖRT pencere
//  taşıyor ve aynı hisse kısa vadede zayıf, uzun vadede güçlü olabilir —
//  kullanıcı bunu ancak vadeyi tek tek değiştirip akılda tutarak
//  görebiliyordu. Karşılaştırmayı EKRAN yapıyor, kullanıcının belleği
//  değil.
//
//  NEDEN TEKNİK SKOR, BİLEŞKE DEĞİL: temel ayak vadeye göre DEĞİŞMİYOR
//  (aynı mali tablo), rejim de teknik bir kavram. Üç pencerenin farkı
//  teknik ayaktan geliyor; bileşkeyi basmak farkı temel ayağın sabit
//  katkısıyla sulandırırdı. Bileşke skor ekranın başlık şeridinde
//  (`DetayBasligi`) zaten duruyor.
//
//  NEDEN 'gunici' SATIRI YOK: motor o pencerede teknik ayağı
//  KOŞTURMUYOR ve `ta.score` `null` dönüyor (lib/sozluk.ts VADE_NOTU).
//  Her açılışta değişmeyecek bir "ölçülmedi" satırı basmak kartı
//  gürültüye boğardı; vade seçicide o pencere yine duruyor.
//
//  NEDEN DÜĞMEYLE, KENDİLİĞİNDEN DEĞİL: her satır AYRI bir `/api/score`
//  turu ve o uç tek sembolde 45-55 sn yiyebiliyor (client.ts
//  SCORE_TIMEOUT_MS gerekçesi). Ekran açılışında iki tur daha atmak,
//  detay sayfasını kimse istemeden üç katı yavaşlatırdı. Kullanıcı
//  isteyince ölçülüyor.
//
//  SEÇİLİ VADE YENİDEN SORULMUYOR: o pencerenin satırı ekranın elindeki
//  `analyze` kaydından geliyor (`satir`). Aynı ölçümü ikinci kez istemek
//  hem bütçe hem de iki turun farklı sayı döndürme riski demekti.
//
//  BURADA HESAP YOK: skor, bant, rejim adı; üçü de uçtan geldiği gibi
//  basılıyor. Vadeler arasında fark/sıralama/"en iyi vade" ÜRETMİYOR —
//  o bir karar olurdu ve motorun işi (HAM SAYI KURALI).
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: bir pencere ölçülemediyse çubuk sıfır
//  gösterilmiyor, `ScoreGauge` tire basıyor ve sebebi (`ta.why`) altına
//  yazılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchScore,
  useIstek,
  type AnalyzeRow,
  type ApiResult,
  type Market,
  type ScoreRow,
  type Vade,
} from '@/api';
import { Card, Durum, Dugme, Pill, ScoreGauge } from '@/components';
import { VADE_SOZLUK } from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

/**
 * Kartın bastığı pencereler — başlıktaki gerekçeyle 'gunici' dışarıda.
 * Sıra `VADE_SIRASI`nın bu üçlüdeki sırasıyla aynı (kısa → uzun).
 */
const REJIM_VADELERI: readonly Vade[] = ['kisa', 'orta', 'uzun'];

export type RejimKartProps = {
  /** Ekranın çözdüğü sembol (BIST'te '.IS' sonekli) — uç bunu istiyor. */
  sembol: string;
  /** Pazar ÇAĞIRANDAN geliyor; kart pazar çıkarımı yapmıyor. */
  market: Market;
  /** Ekranda seçili vade — bu pencere yeniden SORULMUYOR. */
  seciliVade: Vade;
  /** Seçili vadenin elde duran kaydı. */
  satir: AnalyzeRow;
};

/** Vade → satır eşlemesi. Eksik pencere `null` ("ölçemedim"). */
type RejimVeri = Record<string, ScoreRow | null>;

export function RejimKart({ sembol, market, seciliVade, satir }: RejimKartProps) {
  const { colors } = useTheme();
  const [acik, setAcik] = useState(false);

  // Sorulacak pencereler: seçili vade elde olduğu için o çıkarılıyor.
  // Dizgi anahtar (`sorulacakIz`) bağımlılık için: diziyi bağımlılığa
  // koymak her render'da yeni kimlik üretir ve istek sonsuz döner
  // (api/istek.ts başlığındaki gerekçe).
  const sorulacakIz = REJIM_VADELERI.filter((v) => v !== seciliVade).join(',');

  const cagri = useCallback(
    async (signal: AbortSignal): Promise<ApiResult<RejimVeri>> => {
      const sorulacak = sorulacakIz.split(',').filter(Boolean) as Vade[];
      // PARALEL: pencereler birbirini beklemiyor; sıralı atmak bekleme
      // süresini toplar (iki kez 45-55 sn).
      const sonuclar = await Promise.all(
        sorulacak.map((v) => fetchScore([sembol], { vade: v, market, signal })),
      );
      // HATA HATADIR: zaman aşımı/kota bütün pencereleri aynı anda
      // vuruyor. Yarım kart basmak "uzun vade ölçülmedi" gibi YANLIŞ
      // bir cümle kurardı; `Durum` gövdesi yeniden denemeyi sunuyor.
      for (const s of sonuclar) {
        if (!s.ok) return s;
      }
      const veri: RejimVeri = {};
      sorulacak.forEach((v, i) => {
        const s = sonuclar[i];
        veri[v] = s && s.ok ? (s.data.sonuclar?.[0] ?? null) : null;
      });
      return { ok: true, data: veri };
    },
    [sembol, market, sorulacakIz],
  );

  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|rejim|' + seciliVade, {
    etkin: acik,
  });

  return (
    <Card
      title="Vadeye göre rejim"
      subtitle="Aynı hissenin kısa · orta · uzun penceresindeki teknik skoru ve motorun rejim rozeti.">
      {!acik ? (
        <View style={styles.govde}>
          <Text style={[type.small, { color: colors.textDim }]}>
            Her pencere motorda ayrı bir tur. Ölçüm uzun sürebilir, bu yüzden isteğe bağlı.
          </Text>
          <Dugme
            label="Üç vadeyi ölç"
            size="sm"
            variant="solid"
            tone="vurgu"
            onPress={() => setAcik(true)}
          />
        </View>
      ) : (
        <View style={styles.govde}>
          <Durum
            durum={durum}
            hata={hata}
            yenile={yenile}
            iskelet={2}
            sekil="skor"
            kartsiz
            bosMetin="Ölçüm bekleniyor."
          />
          {/* Yükleniyor hâlinde de satırlar duruyor: seçili pencere
              ELDE, onu iskeletin arkasına saklamak eldeki ölçümü
              gizlemek olurdu. */}
          {durum === 'veri' || durum === 'yukleniyor' ? (
            <View style={styles.satirlar}>
              {REJIM_VADELERI.map((v) => (
                <RejimSatiri
                  key={v}
                  vade={v}
                  satir={v === seciliVade ? satir : (veri?.[v] ?? null)}
                  secili={v === seciliVade}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        Gün içi penceresi burada yok: motor o vadede teknik ayağı koşturmuyor.
      </Text>
    </Card>
  );
}

/**
 * Tek pencere. `satir` `null` ise HENÜZ gelmedi ya da uç kayıt
 * döndürmedi — çubuk sıfır değil TİRE basıyor (ScoreGauge sözleşmesi).
 */
function RejimSatiri({
  vade,
  satir,
  secili,
}: {
  vade: Vade;
  satir: ScoreRow | null;
  secili: boolean;
}) {
  const { colors } = useTheme();
  const ta = satir?.ta ?? null;

  return (
    <View style={styles.satir}>
      <View style={styles.basliklar}>
        <Text style={[type.smallBold, { color: colors.text }]}>{VADE_SOZLUK[vade]}</Text>
        {/* SEÇİLİ PENCERE İŞARETLİ: kullanıcı yukarıdaki kartların
            hangi vadeyi gösterdiğini bu rozetten eşliyor. */}
        {secili ? <Pill label="ekranda" tone="vurgu" glyph={null} size="sm" /> : null}
        {/* REJİM ADI MOTORDAN: 'trend' / 'yatay' metnini kart
            uydurmuyor, gelmezse rozet HİÇ basılmıyor. */}
        {ta?.regime ? <Pill label={ta.regime} tone="info" glyph={null} size="sm" /> : null}
      </View>

      <ScoreGauge score={ta?.score ?? null} band={satir?.composite.taBand ?? undefined} size="sm" />

      {/* Skor yoksa sebebi UÇTAN; genel bir "veri gelmedi" cümlesi
          motorun söylediği somut sebebi çöpe atmak olurdu. */}
      {ta && ta.score == null && ta.why ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>{ta.why}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.sm },
  satirlar: { gap: space.md },
  satir: { gap: space.xs },
  basliklar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
});

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
