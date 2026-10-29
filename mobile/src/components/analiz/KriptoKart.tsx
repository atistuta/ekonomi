// =====================================================================
//  ₿ KriptoKart — kripto künye şeridi                  (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderCrypto` (app.js:6856) bloğunun YERLİ karşılığı:
//  sabit kripto evreni (web'in `BM_CRYPTO` listesi, app.js:2290-2301)
//  için ad, kotasyon para birimi, fiyat ve piyasa değeri.
//
//  NEDEN `/api/yfin`: ÖLÇÜLDÜ (2026-10-29, üretim):
//    GET /api/yfin?symbols=BTC-USD,…,DOT-USD → 200
//    10 sembolün 10'u `ok:true`; `name`, `currency`, `price`,
//    `marketCap`, `website` DOLU geldi.
//  Web bu bloğu CoinGecko'dan (`api.coingecko.com`) çekiyor; mobilde
//  CoinGecko'ya giden ÖLÇÜLÜ bir uç YOK — `api/proxy.js` ham geçiş
//  izni veriyor ama `ENDPOINTS` içinde böyle bir giriş yok ve ham geçiş
//  bir SÖZLEŞME değil. Bu yüzden veri kaynağı künye ucudur.
//
//  WEB'DE OLAN, BURADA OLMAYAN ALANLAR — UÇ YOK (uydurulmadı):
//    · 24 saatlik değişim (`price_change_percentage_24h`)
//    · piyasa değeri SIRASI (`market_cap_rank`)
//    · 24s hacim (`total_volume`), BTC hâkimiyeti (`cgGlobal`)
//    · dolaşan/azami arz (`circulating_supply`, `max_supply`)
//    · zirve ve zirveden uzaklık (`ath`, `ath_change_percentage`)
//    · "Değer & Tokenomik" skoru (`computeCryptoValue`) — `/api/deger`
//      POST'u CoinGecko `/coins/{id}` BELGESİNİ gövdede istiyor
//      (`DegerKriptoRequest.belge`); o belgeyi mobilde ölçen uç yok.
//  Bu alanların hiçbiri BURADA TÜRETİLMEDİ. 24s değişimi `/api/chart`
//  mumlarından çıkarmak İSTEMCİ HESABI olurdu (kapanış farkı + ölçek),
//  piyasa değerinden sıra üretmek de sıralama hesabı olurdu.
//
//  BURADA HESAP YOK: `price` ve `marketCap` olduğu gibi basılır;
//  TRY'ye çevrilmez (web `toTRY` ile çeviriyordu, kur ham geçişten
//  geliyordu — ölçülü kur ucu yok, çevirmek uydurma kur demekti).
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: sembol başına `ok:false` = ÖLÇEMEDİM,
//  ayrı blokta sembol adıyla yazar. `ok:true` + `price == null` =
//  künye geldi, fiyat alanı boş — o satır "fiyat ölçülmedi" yazar,
//  çıplak sıfır veya tire DEĞİL.
//
//  NEDEN `fetch` YOK: `components/` içinde istek atılmaz; veri ekranda
//  (`app/(tabs)/analiz.tsx`) `fetchYfin(KRIPTO_SEMBOLLER, {deep:false})`
//  ile çekilir, buraya props olarak gelir.
//
//  NEDEN RENK TEK İŞARET DEĞİL: bu kartta yön/yükseliş gösteren bir
//  alan YOK (24s değişim ölçülmüyor), bu yüzden renkle anlatılan hiçbir
//  şey de yok — ton yalnız başlık rozetinde.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatCompact, formatPrice } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/**
 * Kripto evreni — web'in `BM_CRYPTO` listesiyle AYNI on varlık
 * (app.js:2290-2301), Yahoo sembolüne çevrilmiş hâli.
 *
 * NEDEN SABİT LİSTE: kullanıcının takip listesi hisse sembolleri
 * tutuyor; kripto bloğu web'de de sabit bir evrendi. Liste 10 öge —
 * künye ucunun 12 sembol sınırının (YFIN_AZAMI_SEMBOL) altında, yani
 * hiçbir sembol SESSİZCE kırpılmıyor.
 *
 * NEDEN '-USD' EKİ: künye ucu Yahoo sembolü bekliyor ve ÖLÇÜLDÜ
 * (2026-10-29) ki 'BTC-USD' biçimi 10/10 `ok:true` döndürüyor.
 */
export const KRIPTO_SEMBOLLER: readonly string[] = [
  'BTC-USD',
  'ETH-USD',
  'BNB-USD',
  'SOL-USD',
  'XRP-USD',
  'ADA-USD',
  'DOGE-USD',
  'AVAX-USD',
  'TRX-USD',
  'DOT-USD',
];

export type KriptoKartProps = {
  /** `fetchYfin(KRIPTO_SEMBOLLER, { deep: false })` gövdesi. */
  veri: YfinResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
};

export function KriptoKart({ veri, durum, hata, yenile }: KriptoKartProps) {
  const { colors } = useTheme();

  const kunyeler = veri?.results ?? [];
  // `ok:false` = Yahoo turu bu sembolde düştü → ÖLÇEMEDİM.
  // Fiyatı gelen satırlarla aynı listeye koymak, kesintiyi veri
  // yokluğu gibi göstermek olurdu.
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  const gelenler = kunyeler.filter((k) => k.ok);

  return (
    <Card
      title="₿ Kripto"
      subtitle="Sabit kripto evreni — /api/yfin künye alanları (fiyat + piyasa değeri)"
      right={
        durum === 'veri' && gelenler.length ? (
          <Pill label={String(gelenler.length) + ' künye'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={4}
        sekil="satir"
        kartsiz
        bosMetin="Kripto künyesi henüz istenmedi."
      />

      {durum === 'veri' ? (
        kunyeler.length ? (
          <>
            {gelenler.map((k) => (
              <KriptoSatiri key={k.symbol} kunye={k} />
            ))}

            {!gelenler.length ? (
              <VeriYok kartsiz metin="Künye ucu bu evrende hiçbir sembolü ölçemedi." />
            ) : null}

            {/* ÖLÇÜLMEYEN ALANLAR YAZILI: kullanıcı web'de gördüğü
                24s değişimi burada bulamayınca "eksik" değil
                "ölçülmüyor" olduğunu bilsin. */}
            <View style={styles.dipnot}>
              <Pill label="ölçülmüyor" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                24 saatlik değişim, piyasa değeri sırası, hacim, hâkimiyet, arz ve zirve
                uzaklığı bu uçta YOK — ölçülmediği için yazılmıyor, hesaplanmıyor.
              </Text>
            </View>

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
          <VeriYok kartsiz metin="Künye ucu kripto evreni için sonuç döndürmedi." />
        )
      ) : null}
    </Card>
  );
}

/**
 * Tek varlığın künye satırı.
 *
 * NEDEN `currency` (finCurrency DEĞİL): basılan iki sayı da KOTASYON
 * tarafında — `price` Yahoo'nun kotasyon para birimi, `marketCap` aynı
 * birimde (ölçüldü: BTC-USD → currency USD, marketCap 1.61e12 USD).
 * `finCurrency` raporlama para birimi ve kriptoda tamamı `null`.
 */
function KriptoSatiri({ kunye }: { kunye: YfinKunye }) {
  const { colors } = useTheme();
  const kur = kunye.currency ?? null;
  const fiyatVar = typeof kunye.price === 'number' && Number.isFinite(kunye.price);
  const degerVar = typeof kunye.marketCap === 'number' && Number.isFinite(kunye.marketCap);

  return (
    <View
      style={[styles.blok, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        (kunye.name ?? kunye.symbol) +
        (fiyatVar ? ', fiyat ' + formatPrice(kunye.price, kur) : ', fiyat ölçülmedi') +
        (degerVar
          ? ', piyasa değeri ' + formatCompact(kunye.marketCap) + (kur ? ' ' + kur : '')
          : ', piyasa değeri ölçülmedi')
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
          {fiyatVar ? (
            <Text style={[type.bodyBold, numeric, { color: colors.text }]}>
              {formatPrice(kunye.price, kur)}
            </Text>
          ) : (
            <Pill label="fiyat ölçülmedi" tone="gold" glyph={null} size="sm" />
          )}
        </View>
      </View>

      <View style={styles.olcum}>
        <Text style={[type.small, { color: colors.textDim }]}>Piyasa değeri</Text>
        {degerVar ? (
          <Text style={[type.smallBold, numeric, styles.olcumSag, { color: colors.text }]}>
            {formatCompact(kunye.marketCap) + (kur ? ' ' + kur : '')}
          </Text>
        ) : (
          <Text style={[type.micro, { color: colors.textDim }]}>ölçülmedi</Text>
        )}
      </View>
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
  olcumSag: { textAlign: 'right' },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
