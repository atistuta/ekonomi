// =====================================================================
//  BacktestKart — 🕰️ geçmiş ölçümü                    (ŞERİT F5 / native)
// ---------------------------------------------------------------------
//  NE: `/api/backtest` cevabı (`fetchBacktest`): motorun kendi
//  göstergesinin GEÇMİŞ seride ileri getiriyle ilişkisi — örnek sayısı,
//  isabet oranları, skor kovaları, bilgi katsayısı, strateji/elde tutma
//  getirisi, en derin düşüş.
//
//  NEDEN AYRI KART VE AYRI İSTEK: detay ekranının öteki beş kartı TEK
//  `fetchAnalyze` turundan besleniyor; backtest o turun İÇİNDE YOK —
//  kendi ucu var, mum serisini kendisi çekiyor ve kendi (daha uzun)
//  zaman aşımını taşıyor (`BACKTEST_TIMEOUT_MS`, gerekçesi client.ts).
//  Analyze turuna bağlamak, ucun yavaş olduğu her durumda bütün ekranı
//  bekletmek olurdu; ayrı istek ayrı `Durum` gövdesi demek.
//
//  ── `sonuc === null` NEDEN HATA DEĞİL ─────────────────────────────
//  types.ts'in kendi uyarısı: motor seri `warmup + H + 40` barın
//  altındaysa ya da örnek sayısı 12'nin altındaysa `null` döndürüyor —
//  yani sunucuya ULAŞTIK ve sunucu dürüstçe "ölçemedim" dedi
//  (`r.ok === true` + `data.sonuc === null` AYNI ANDA gelir). Bu yüzden
//  burada `Durum`un kırmızı hata gövdesi DEĞİL, `OlcemedimKutu`
//  kullanılıyor; `ApiError.kind === 'unmeasured'` (ağ/5xx/zaman aşımı)
//  ile KARIŞTIRILMIYOR — onu `Durum` kendi dalında zaten yazıyor.
//  "Yeniden dene" düğmesi bilerek VERİLMİYOR: seri kısa olduğu için
//  ölçülemedi, tekrar denemek aynı cevabı verir.
//
//  ── ORANLAR NEDEN YÜZDEYE ÇEVRİLMİYOR ────────────────────────────
//  types.ts: bütün oranlar HAM KESİR (`baseUp`, `alHit`, `ic`,
//  `stratRet`, `mdd`, `winRate`, kova `avg`/`pos`). 100'le çarpmak ölçek
//  değiştirmek, yani istemcide hesap yapmaktır (`formatPercent` ise
//  YÜZDE PUANI bekliyor — lib/format.ts notu). Hepsi `formatOran` ile
//  OLDUĞU GİBİ basılıyor, etikette "kesir" yazıyor.
//
//  ── KOVA SINIRLARI VE 'AL/SAT' ADLARI NEDEN YOK ──────────────────
//  Uç `buckets[].label`ı BİLEREK düşürdü (api/_kesif.js:653 — '60–100 ·
//  güçlü AL' bir AL/SAT dili) ve yerine `i` SIRA numarasını koydu.
//  İstemci kova sınırlarını BİLMİYOR ve uydurmuyor; `alN`/`satN`/`dirN`
//  kalemleri de eşik SAYISI olmadan, yalnız "yüksek / düşük / yön
//  belirgin skorlu örnekler" diye adlandırılıyor. Eşiği buraya yazmak,
//  motor eşiği değiştirdiğinde ekranın YANLIŞ sayı anlatması olurdu.
//
//  ── `tam === false` NEDEN SUSTURULMUYOR ───────────────────────────
//  Seri eksik çekildiyse ölçüm o eksikle yapıldı (types.ts uyarısı).
//  `OlcumNotu` künyeyi (`tam` + `sayac`) olduğu gibi yazıyor.
//
//  BURADA HESAP YOK: hiçbir oran çarpılmıyor, bölünmüyor, toplanmıyor;
//  kova katkısı türetilmiyor, isabet oranları karşılaştırılmıyor.
//  Ekran yalnız motorun gönderdiği sayıları biçimliyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import {
  fetchBacktest,
  useIstek,
  type BacktestSonuc,
  type Market,
  type Vade,
} from '@/api';
import { Card, Durum, OlcemedimKutu, OlcumNotu, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export type BacktestKartProps = {
  /** Ucun isteyeceği sembol — çağıranın yazımı (BIST'te `.IS` sonekli). */
  sembol: string;
  /** Satırın pazarı. Verilmezse uca hiç yazılmaz, kararı sunucu verir. */
  market?: Market;
  /** Ölçüm vadesi. Detay ekranı 'orta' kullanıyor (ekran gerekçesi orada). */
  vade?: Vade;
};

export function BacktestKart({ sembol, market, vade = 'orta' }: BacktestKartProps) {
  const { colors } = useTheme();

  const cagri = useCallback(
    (signal: AbortSignal) => fetchBacktest(sembol, { vade, market, signal }),
    [sembol, market, vade],
  );

  // Anahtar DİZGİ: `useIstek`in kendi notu (nesne koymak sonsuz tur).
  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    sembol + '|' + vade + '|' + (market ?? ''),
    { etkin: Boolean(sembol) },
  );

  return (
    <Card
      title="🕰️ Geçmiş ölçümü"
      subtitle="Geçmişe dönük bir ÖLÇÜM — gelecek için bir vaat değil."
      right={
        veri?.sonuc ? (
          <Pill
            label={veri.sonuc.nSamples + ' örnek'}
            tone="neutral"
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      {/* Yükleniyor · boş · dört hata türü: tek gövde, kart içinde. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' && veri ? (
        veri.sonuc ? (
          <SonucGovde sonuc={veri.sonuc} adet={veri.adet} />
        ) : (
          // SUNUCU ÖLÇEMEDİ (seri kısa / örnek az) — hata değil.
          <OlcemedimKutu
            metin={
              'Motor bu sembol ve vade için geçmiş ölçümü üretemedi: seri ölçüme yetmiyor. Çekilen mum: ' +
              (typeof veri.adet === 'number' ? veri.adet : EMPTY) +
              '.'
            }
            kartsiz
          />
        )
      ) : null}

      {/* Künye: kesinti varsa ölçüm o eksikle yapıldı. */}
      {durum === 'veri' && veri ? <OlcumNotu kaynak={veri} /> : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Seri: ' + veri.range + ' · adım ' + veri.interval + ' · vade ' + veri.vade}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * Ölçüm gövdesi. AYRI İŞLEV: `sonuc` burada `null` DEĞİL, yani her
 * alanda ikinci bir `?.` zinciri yazmak gerekmiyor — ölçülmemiş alanları
 * (`alHit`, `winRate`, kova `avg`/`pos`) `formatOran` tire'ye çeviriyor,
 * 0'a ÇEVİRMİYOR.
 */
function SonucGovde({ sonuc, adet }: { sonuc: BacktestSonuc; adet: number }) {
  const { colors } = useTheme();
  const kovalar = sonuc.buckets ?? [];

  return (
    <View style={styles.govde}>
      {/* Künye — çıplak sayılar, yorum yok. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Ufuk ' +
          sonuc.H +
          ' bar · adım ' +
          sonuc.stride +
          ' · ısınma ' +
          sonuc.warmup +
          ' · ' +
          (sonuc.intraday ? 'gün içi seri' : 'günlük seri') +
          ' · çekilen mum ' +
          (typeof adet === 'number' ? adet : EMPTY)}
      </Text>

      <View style={styles.liste}>
        <Satir
          etiket="Ölçülen örnek sayısı"
          deger={String(sonuc.nSamples)}
          erisimEtiketi={'Ölçülen örnek sayısı ' + sonuc.nSamples}
        />
        <Satir
          etiket="Taban: pozitif biten örnek oranı"
          not="bütün örnekler — kesir"
          deger={formatOran(sonuc.baseUp)}
        />
        <Satir
          etiket="Yüksek skorlu örneklerde ileride yükselen oran"
          not={sonuc.alN + ' örnek — kesir'}
          deger={formatOran(sonuc.alHit)}
        />
        <Satir
          etiket="Düşük skorlu örneklerde ileride düşen oran"
          not={sonuc.satN + ' örnek — kesir'}
          deger={formatOran(sonuc.satHit)}
        />
        <Satir
          etiket="Yön belirgin örneklerde yön tutma oranı"
          not={sonuc.dirN + ' örnek — kesir'}
          deger={formatOran(sonuc.dirHit)}
        />
        <Satir
          etiket="Bilgi katsayısı (Spearman)"
          not="skor ile ileri getiri sıra ilişkisi"
          deger={formatOran(sonuc.ic)}
        />
        <Satir
          etiket="Kovalar artan sırada mı"
          not="motorun kendi bayrağı"
          deger={sonuc.monotonic ? 'Evet' : 'Hayır'}
          erisimEtiketi={
            'Kovalar artan sırada mı: ' + (sonuc.monotonic ? 'evet' : 'hayır')
          }
        />
        <Satir
          etiket="Motor kuralı dizisinin getirisi"
          not="geçmiş ölçüm — kesir"
          deger={formatOran(sonuc.stratRet)}
        />
        <Satir
          etiket="Sürekli elde tutma getirisi"
          not="karşılaştırma tabanı — kesir"
          deger={formatOran(sonuc.bhRet)}
        />
        <Satir etiket="Sharpe" not="motorun ölçtüğü hâliyle" deger={formatOran(sonuc.sharpe)} />
        <Satir etiket="En derin düşüş" not="kesir" deger={formatOran(sonuc.mdd)} />
        <Satir etiket="Durum değişimi sayısı" deger={String(sonuc.switches)} />
        <Satir
          etiket="Pozitif biten dönem oranı"
          not={sonuc.longIv + ' tutulan dönem — kesir'}
          deger={formatOran(sonuc.winRate)}
        />
      </View>

      {/* Kovalar: SINIR YOK, yalnız motorun sıra numarası (başlık notu). */}
      {kovalar.length ? (
        <View style={styles.liste}>
          <Text style={[type.smallBold, { color: colors.text }]}>
            {kovalar.length + ' skor kovası (sınırları uç göndermiyor)'}
          </Text>
          {kovalar.map((k) => (
            <Satir
              key={k.i}
              etiket={'Kova ' + k.i}
              not={
                k.n + ' örnek · pozitif biten oranı ' + formatOran(k.pos)
              }
              deger={formatOran(k.avg)}
              erisimEtiketi={
                'Kova ' +
                k.i +
                ', ' +
                k.n +
                ' örnek, ortalama ileri getiri ' +
                formatOran(k.avg) +
                ', pozitif biten oranı ' +
                formatOran(k.pos)
              }
            />
          ))}
        </View>
      ) : (
        // Kova dizisi gelmemişse uydurma satır basılmaz.
        <VeriYok metin="Skor kovaları bu turda gelmedi." kartsiz />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  govde: { gap: space.sm },
  liste: { gap: space.xxs },
});
