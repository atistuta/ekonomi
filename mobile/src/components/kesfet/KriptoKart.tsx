// =====================================================================
//  ₿ KRİPTO PAZARI — /api/kripto                        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: sabit bir kimlik kümesi için üst kaynağın (CoinGecko) döndürdüğü
//  HAM pazar satırları: fiyat (USD), 24 saat değişimi, pazar değeri ve
//  sırası, hacim, dolaşan/azami arz, zirve ve zirveden uzaklık. Yanında
//  seçimlik KÜRESEL baskınlık sözlüğü.
//
//  ── NİYE BU UÇ BUGÜNE KADAR NATIVE'DE YOKTU ────────────────────────
//  `/api/kripto` web tarafında vardı, native'de HİÇ çağrılmıyordu.
//  Sözleşme tipleri ve `fetchKripto` 2026-11-03'te bağlandı (DEVAM.md
//  §20.16); bu kart o bağlantının ekrana ulaşan yüzü.
//
//  ── EVREN SABİT VE DÜRÜSTÇE YAZILI ────────────────────────────────
//  Kimlikler burada SABİT (`KIMLIKLER`). Bu bir seçki DEĞİL, bir TARAMA
//  DEĞİL, bir sıralama DEĞİL: pazar değeri en büyük bilinen kimlikler
//  okunuyor ve uçtan ne geldiyse o basılıyor. Kart altyazısında "sabit
//  kimlik listesi" yazıyor — "senin portföyün" demiyor.
//
//  ── ÜST KAYNAK BİLİNMEYEN KİMLİĞİ SESSİZCE DÜŞÜRÜYOR ──────────────
//  ÖLÇÜLDÜ (`api/_kripto.js`, kaynak okuma): tanınmayan kimlik üst
//  kaynakta cevaptan düşüyor ve bu `tam` bayrağını DÜŞÜRMÜYOR. Bu
//  yüzden eksik, `idler.length` ↔ `coinler.length` farkından okunuyor
//  ve künyeye YAZILIYOR. Bayrağa güvenip sessiz geçmek, ölçülmemiş
//  olanı ölçülmüş göstermek olurdu.
//
//  ── `maxSupplyAdet: null` "ÖLÇEMEDİM" DEĞİL ───────────────────────
//  Bu alanın `null`u ÜST SINIR YOK (sınırsız arz) anlamında. "Ölçüm
//  yok" cümlesi basmak yanlış olurdu; "üst sınır yok" yazılıyor.
//
//  ── BURADA EŞİK, SKOR, SIRALAMA YOK ───────────────────────────────
//  24 saat değişiminin yönü ▲/▼ karakteriyle taşınıyor (renk tek
//  taşıyıcı değil). "Çok yükseldi / düştü" gibi bir sınıflama YOK:
//  öyle bir eşik ne uçta ne burada, motorda da bu uç için tanımlı değil.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchKripto, useIstek, type KriptoCoin } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatCompact, formatPercent, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

/**
 * Sorulan kimlikler. CoinGecko KİMLİĞİ, sembol DEĞİL (`bitcoin`, değil
 * `BTC`; `avalanche-2`, değil `AVAX`) — uç sembolü tanımıyor.
 */
const KIMLIKLER = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'ripple',
  'cardano',
  'dogecoin',
  'avalanche-2',
] as const;

/** Sayı mı? Değilse `null` — `0` yerine geçmiyor. */
function sayi(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export type KriptoKartProps = {
  /** Açılışta küresel baskınlık sorulsun mu (uç varsayılanı: evet). */
  kureselIstensinMi?: boolean;
};

export function KriptoKart({ kureselIstensinMi = true }: KriptoKartProps) {
  const { colors } = useTheme();
  // Küresel sözlük AÇIP KAPATILABİLİR: `false` verildiğinde uç alanı
  // gövdeden TÜMÜYLE kaldırıyor ("sormadım"), `null` yapmıyor.
  const [kuresel, setKuresel] = useState<boolean>(kureselIstensinMi);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchKripto([...KIMLIKLER], { kuresel, signal }),
    [kuresel],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'kripto:' + (kuresel ? '1' : '0'));

  const coinler: KriptoCoin[] = veri?.coinler ?? [];
  const sorulan = veri?.idler?.length ?? 0;
  const dusen = sorulan - coinler.length;
  const sayac = veri?.sayac;
  // ÜÇ DURUM: alan yok → sormadım; `null` → ölçemedim; sözlük → ölçtüm.
  const kureselVar = veri ? Object.prototype.hasOwnProperty.call(veri, 'kuresel') : false;
  const kureselSozluk = veri?.kuresel ?? null;

  return (
    <Card
      title="₿ Kripto pazarı"
      subtitle="Sabit kimlik listesi — üst kaynağın ham pazar satırları">
      <View style={styles.cipler}>
        <Anahtar
          etiket={kuresel ? '• küresel baskınlık soruluyor' : 'küresel baskınlık sorulmuyor'}
          aktif={kuresel}
          onPress={() => setKuresel(!kuresel)}
        />
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={4}
        sekil="satir"
        bosMetin="Kripto pazarı henüz sorulmadı."
      />

      {durum === 'veri' && veri ? (
        <>
          {!coinler.length ? (
            <VeriYok kartsiz metin="Uç hiçbir kimlik için pazar satırı döndürmedi." />
          ) : (
            coinler.map((c) => <CoinBlogu key={c.id} coin={c} />)
          )}

          {/* Küresel sözlük HAM basılıyor: anahtarları uç belirliyor
              (`Record<string, number>`), burada çevrilmiyor. */}
          {kureselVar ? (
            kureselSozluk == null ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                Küresel baskınlık soruldu, ölçülemedi.
              </Text>
            ) : !Object.keys(kureselSozluk).length ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                Küresel baskınlık ölçüldü, sözlük boş döndü.
              </Text>
            ) : (
              <View style={styles.bolum}>
                <Text style={[type.microBold, { color: colors.textDim }]}>
                  Küresel baskınlık (uçtan geldiği gibi)
                </Text>
                <View style={styles.cipler}>
                  {Object.keys(kureselSozluk)
                    .sort((a, b) => a.localeCompare(b))
                    .map((k) => (
                      <Pill
                        key={k}
                        label={k + ' ' + formatPercent(kureselSozluk[k])}
                        tone="neutral"
                        variant="outline"
                        glyph={null}
                        size="sm"
                      />
                    ))}
                </View>
              </View>
            )
          ) : null}

          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {sorulan +
              ' kimlik soruldu · ' +
              coinler.length +
              ' tanesi ölçüldü' +
              // Üst kaynak bilinmeyen kimliği `tam`ı düşürmeden atıyor.
              (dusen > 0 ? ' · ' + dusen + ' kimlik üst kaynakta bulunamadı' : '') +
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

/** Tek coin. Ölçülmeyen her alan kendi cümlesini basıyor, `0` basmıyor. */
function CoinBlogu({ coin }: { coin: KriptoCoin }) {
  const { colors } = useTheme();
  const fiyat = sayi(coin.priceUsd);
  const chg = sayi(coin.priceChange24hPct);
  const sira = sayi(coin.marketCapRank);
  const deger = sayi(coin.marketCapUsd);
  const hacim = sayi(coin.totalVolumeUsd);
  const dolasan = sayi(coin.circulatingSupplyAdet);
  const azami = sayi(coin.maxSupplyAdet);
  const ath = sayi(coin.athUsd);
  const athFark = sayi(coin.athChangePct);

  return (
    <View style={[styles.blok, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {(coin.name ?? '').trim() || coin.id}
        </Text>
        {coin.symbol ? (
          <Pill
            label={coin.symbol.toUpperCase()}
            tone="neutral"
            variant="outline"
            glyph={null}
            size="sm"
          />
        ) : null}
        <View style={styles.bosluk} />
        {sira == null ? null : (
          <Pill label={'#' + sira} tone="info" variant="outline" glyph={null} size="sm" />
        )}
      </View>

      <View style={styles.ust}>
        <Text style={[type.smallBold, styles.num, { color: colors.text }]}>
          {fiyat == null ? 'fiyat ölçülemedi' : formatPrice(fiyat, 'USD')}
        </Text>
        <View style={styles.bosluk} />
        {chg == null ? (
          <Text style={[type.micro, { color: colors.textFaint }]}>24s ölçülemedi</Text>
        ) : (
          <Text
            style={[
              type.smallBold,
              styles.num,
              { color: chg > 0 ? colors.positive : chg < 0 ? colors.negative : colors.text },
            ]}>
            {(chg > 0 ? '▲ ' : chg < 0 ? '▼ ' : '• ') + formatPercent(chg) + ' / 24s'}
          </Text>
        )}
      </View>

      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {(deger == null ? 'pazar değeri ölçülemedi' : 'pazar değeri ' + formatCompact(deger)) +
          ' · ' +
          (hacim == null ? 'hacim ölçülemedi' : '24s hacim ' + formatCompact(hacim))}
      </Text>

      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {(dolasan == null ? 'dolaşan arz ölçülemedi' : 'dolaşan ' + formatCompact(dolasan)) +
          ' · ' +
          // `null` BURADA "ölçemedim" DEĞİL: üst sınır yok demek.
          (coin.maxSupplyAdet === null
            ? 'üst sınır yok'
            : azami == null
              ? 'azami arz ölçülemedi'
              : 'azami ' + formatCompact(azami))}
      </Text>

      <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
        {(ath == null ? 'zirve ölçülemedi' : 'zirve ' + formatPrice(ath, 'USD')) +
          ' · ' +
          (athFark == null ? 'zirveden uzaklık ölçülemedi' : formatPercent(athFark) + ' zirveye göre')}
      </Text>
    </View>
  );
}

/** Açma/kapama çipi. Durum RENKLE DEĞİL: başta "•" ve metin değişiyor. */
function Anahtar({
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
      accessibilityRole="switch"
      accessibilityState={{ checked: aktif }}
      accessibilityLabel={etiket}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.cipKabi,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      <Pill
        label={etiket}
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
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bolum: { gap: space.xs, paddingTop: space.sm },
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
