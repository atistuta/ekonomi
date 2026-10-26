// =====================================================================
//  📊 EndeksNabziKarti — büyük endekslerin GÜNLÜK hareketi
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderIndexPulse` (app.js:11297) kaleminin yerli
//  karşılığı. Web'in `INDEX_PULSE` listesini (app.js:11246-11251) OKUDU,
//  kendi listesini SEÇMEDİ: BIST 100 · S&P 500 · NASDAQ · Altın (ons).
//  Her endeks için günlük mum serisi (`/api/chart`, range '1d') istenir
//  ve seri KÜNYESİ basılır.
//
//  ── NEDEN WEB'İN "NEDEN"LERİ BURADA YOK ────────────────────────────
//  Web kartı hareketin SEBEBİNİ de yazıyor (`indexWhyFactors`,
//  app.js:11253) ve bunu makro boyutlardan (faiz/enflasyon/risk/büyüme)
//  + "sıcak gündem" temalarından ÇIKARIYOR; ayrıca kendi eşiklerini
//  taşıyor (`sharp`, `notable` — her endeks için elle yazılmış sayılar).
//  O eşikler ve o çıkarım MOTORUN işi. Bu dosya bir bileşen: tek bir
//  eşik, tek bir ağırlık, tek bir çıkarım cümlesi taşımıyor. "Sert
//  hareket" / "belirgin" rozetlerini basmak, uçtan GELMEYEN bir eşiği
//  istemcide uydurmak olurdu. Bu yüzden kart hareketin BÜYÜKLÜĞÜNÜ
//  yazar, hareketi YORUMLAMAZ.
//
//  ── ÖLÇÜLDÜ (2026-10-26, KAYNAK OKUMASI — canlı istek atılmadı) ─────
//  `/api/chart` ortak sembol kapısından geçiyor: `temizleSembol`
//  (api/_girdi.js:132) → `SEMBOL_BICIM = /^[A-Z][A-Z0-9.\-]{0,7}$/`
//  (api/_girdi.js:79). Bu biçim `^` ve `=` KARAKTERLERİNİ KABUL ETMİYOR.
//  Uç dosyasının kendi başlığı da bunu açıkça yazıyor (api/chart.js,
//  "ENDEKS (^GSPC, ^XU100) BU UÇTAN İSTENEMEZ" bloğu), istemci kapısı
//  da `^` ile başlayan sembolü ağa ÇIKARMADAN kesiyor
//  (mobile/src/api/client.ts:727).
//  Dört kalemin tek tek sonucu:
//    · XU100 (BIST) → biçim GEÇER. Motor `yahooSymbol` ile '.IS' ekliyor
//      (api/_motor.js:95) → üst kaynağa `XU100.IS` gidiyor. Ucun KAPISI
//      bu sembolü geçiriyor; üst kaynağın mum döndürüp döndürmediği
//      ÖLÇÜLEMEDİ (bu turda canlı istek yasaktı) — kart boş seriyi
//      "ölçemedim" diye DEĞİL, "bu aralıkta mum yok" diye yazar.
//    · ^GSPC, ^IXIC → biçim REDDEDER (`^`). İstek kesin 400
//      `bad_symbol`. Ağa çıkarmanın anlamı yok.
//    · GC=F (altın onsu) → biçim REDDEDER (`=`). DİKKAT: istemci kapısı
//      yalnız `^`e bakıyor, yani bu sembol ağa ÇIKAR ve 400 ile döner.
//      Bu yüzden `destekli: false` BURADA yazılı: boşa istek atmıyoruz.
//  Desteklenmeyen kalem GİZLENMİYOR, satırı basılıyor ve "bu sembol
//  ölçülemedi" denip SEBEBİ yazılıyor. Satırı hiç basmamak, kullanıcıya
//  "altın hareket etmedi" demek olurdu — ki bu bir yalan olur.
//
//  ── BURADA HESAP VAR MI ────────────────────────────────────────────
//  Tek aritmetik: günlük değişim = (son kapanış − ilk açılış) ÷ ilk
//  açılış × 100. Bu bir KÜNYE aritmetiği (serinin iki ucu), gösterge
//  DEĞİL: eşik yok, ağırlık yok, pencere seçimi yok — pencereyi `range`
//  belirliyor ve `range` ekranın verdiği parametre. Bunun ÖTESİNDE
//  hiçbir sayı türetilmiyor: ortalama yok, oynaklık yok, skor yok.
//  `signalOf` yön okunu veriyor (theme/signal.ts) — eşiği orada,
//  TEK yerde yazılı (renk körü güvenli ▲/▼ kuralı).
//
//  NEDEN `fetch` YOK: `components/` içinde istek atılmaz. Kart,
//  ekranın SIRAYLA topladığı ölçümleri props olarak alır. Uç TEK sembol
//  alıyor (`cok_sembol`, azami 1) → endeks başına bir çağrı; dört
//  çağrıyı aynı anda atmak bir istek fırtınası olurdu. Sıra ve bütçe
//  ekranda; kart ölçülen tur süresini (`turMs`) olduğu gibi YAZAR,
//  gizlemez.
//
//  NEDEN `Disclaimer` BASILMIYOR: ekran kabuğu (`ScreenShell.tsx:68`)
//  zorunlu notu sayfanın en altında ZATEN basıyor. İkinci kez basmak
//  aynı cümleyi iki yerde göstermek olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { ApiError, ChartResponse, IstekDurum, Market } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { formatGunAy, formatPercent, formatPrice } from '@/lib/format';
import { numeric, signalOf, space, type, useTheme } from '@/theme';

/**
 * Tek endeks tanımı. Liste web'den OKUNDU (app.js:11246-11251), burada
 * SEÇİLMEDİ. Web'in `sharp`/`notable` eşikleri BİLEREK taşınmadı
 * (dosya başlığı): eşik motorun işi.
 */
export type EndeksTanim = {
  key: string;
  /** Kullanıcıya görünen ad — web'deki `name` alanı. */
  ad: string;
  emoji: string;
  /** `/api/chart`e gidecek sembol. */
  sembol: string;
  pazar: Market;
  /**
   * `/api/chart` ortak sembol kapısı bu sembolü KABUL EDİYOR MU
   * (ölçüldü: dosya başlığı). `false` → ekran bu kalem için İSTEK
   * ATMAZ; kart satırı "ölçülemedi" diye basar.
   */
  destekli: boolean;
  /** `destekli:false` ise sebebi — kullanıcıya yazılır. */
  red?: string;
};

/**
 * Web'in `INDEX_PULSE` listesi, birebir aynı sıra ve aynı semboller.
 * Yalnız `sharp`/`notable` eşikleri yok (gerekçe dosya başlığında).
 */
export const ENDEKS_NABIZ: readonly EndeksTanim[] = [
  { key: 'XU100', ad: 'BIST 100', emoji: '🇹🇷', sembol: 'XU100', pazar: 'BIST', destekli: true },
  {
    key: 'GSPC',
    ad: 'S&P 500',
    emoji: '🇺🇸',
    sembol: '^GSPC',
    pazar: 'US',
    destekli: false,
    red: "grafik ucu '^' ile başlayan sembolü kabul etmiyor",
  },
  {
    key: 'IXIC',
    ad: 'NASDAQ',
    emoji: '💻',
    sembol: '^IXIC',
    pazar: 'US',
    destekli: false,
    red: "grafik ucu '^' ile başlayan sembolü kabul etmiyor",
  },
  {
    key: 'GOLD',
    ad: 'Altın (ons)',
    emoji: '🥇',
    sembol: 'GC=F',
    pazar: 'US',
    destekli: false,
    red: "grafik ucu '=' içeren sembolü kabul etmiyor",
  },
];

/**
 * Ekranın bir endeks için topladığı sonuç. `veri` ve `hata` İKİSİ DE
 * `null` olabilir: o hâl "bu kalem hiç sorulmadı" demek (desteklenmeyen
 * sembol) ve "ölçüldü ama boş geldi"den AYRI yazılır.
 */
export type EndeksOlcum = {
  /** `ENDEKS_NABIZ` kaleminin `key`i. */
  key: string;
  veri: ChartResponse | null;
  hata: ApiError | null;
};

export type EndeksNabziKartiProps = {
  /** Ekranın SIRAYLA topladığı ölçümler — sıra önemsiz, `key` eşlenir. */
  olcumler: EndeksOlcum[];
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /**
   * Sıralı çağrı turunun ÖLÇÜLEN süresi (ms). Verilmezse yazılmaz —
   * uydurma bir süre basmaktan iyidir.
   */
  turMs?: number | null;
};

export function EndeksNabziKarti({
  olcumler,
  durum,
  hata,
  yenile,
  turMs = null,
}: EndeksNabziKartiProps) {
  const { colors } = useTheme();

  const bul = (key: string) => olcumler.find((o) => o.key === key) ?? null;
  const desteklenen = ENDEKS_NABIZ.filter((t) => t.destekli);

  return (
    <Card
      title="📊 Endeks Nabzı"
      subtitle="Büyük endekslerin günlük hareketi — /api/chart günlük serisi"
      right={
        durum === 'veri' ? (
          <Pill
            label={desteklenen.length + ' / ' + ENDEKS_NABIZ.length + ' ölçülebilir'}
            tone="info"
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={ENDEKS_NABIZ.length}
        sekil="satir"
        kartsiz
        bosMetin="Endeks serileri henüz istenmedi."
      />

      {durum === 'veri' ? (
        <>
          {ENDEKS_NABIZ.map((tanim) => (
            <EndeksSatiri key={tanim.key} tanim={tanim} olcum={bul(tanim.key)} />
          ))}

          {!desteklenen.length ? (
            <VeriYok
              kartsiz
              metin="Listedeki endekslerin hiçbiri grafik ucunun sembol biçimine uymuyor; ölçülecek seri yok."
            />
          ) : null}

          {/* SÜRE GİZLENMİYOR: uç TEK sembol alıyor, bu yüzden endeks
              sayısı kadar sıralı çağrı var. Kullanıcı neyi beklediğini
              bilsin. `turMs` verilmediyse SATIR HİÇ ÇİZİLMEZ. */}
          {turMs != null && Number.isFinite(turMs) ? (
            <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
              {desteklenen.length +
                ' seri sırayla istendi — ölçülen tur süresi ' +
                String(Math.round(turMs)) +
                ' ms.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek endeks satırı. DÖRT AYRI HÂL, dördü ayrı cümle:
 *   · sorulmadı  → sembol biçimi ucun kapısından geçmiyor (ölçülemedi)
 *   · hata       → istek düştü (ölçemedim)
 *   · boş seri   → 200 geldi, `adet: 0` (VERİ cevabı: mum yok)
 *   · dolu seri  → günlük değişim + son kapanış
 */
function EndeksSatiri({ tanim, olcum }: { tanim: EndeksTanim; olcum: EndeksOlcum | null }) {
  const { colors } = useTheme();

  const veri = olcum?.veri ?? null;
  const istekHatasi = olcum?.hata ?? null;

  // Mumlar TİPTE `number`, ama tip güvencesi çalışma zamanı güvencesi
  // değil (api/types.ts:383 notu) — süzgeçten geçiriliyor.
  const mumlar = (veri?.mumlar ?? []).filter(
    (m) => Number.isFinite(m.open) && Number.isFinite(m.close),
  );
  const ilk = mumlar.length ? mumlar[0] : null;
  const son = mumlar.length ? mumlar[mumlar.length - 1] : null;

  // TEK aritmetik (dosya başlığı): serinin iki ucu. İlk açılış 0 ise
  // bölme yapılmaz — `null` kalır, "ölçülemedi" yazar. Sıfıra bölümden
  // doğan `Infinity`yi yüzde diye basmak uydurma olurdu.
  const yuzde =
    ilk && son && ilk.open !== 0 ? ((son.close - ilk.open) / ilk.open) * 100 : null;

  const isaret = signalOf(yuzde);
  const kur = veri?.kunye?.currency ?? (tanim.pazar === 'BIST' ? 'TRY' : null);

  const a11y =
    tanim.ad +
    (!tanim.destekli
      ? ', bu sembol ölçülemedi'
      : istekHatasi
        ? ', ölçüm düştü'
        : !veri
          ? ', ölçüm yok'
          : !mumlar.length
            ? ', bu aralıkta mum yok'
            : yuzde == null
              ? ', günlük değişim ölçülemedi'
              : ', günlük ' + isaret.a11yLabel + ' ' + formatPercent(yuzde));

  return (
    <View style={[styles.satir, { borderColor: colors.border }]} accessible accessibilityLabel={a11y}>
      <View style={styles.sol}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {tanim.emoji + ' ' + tanim.ad}
        </Text>
        <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
          {tanim.sembol + ' · ' + (tanim.pazar === 'BIST' ? 'Borsa İstanbul' : 'ABD piyasası')}
        </Text>
        {/* Her hâlin KENDİ cümlesi var; "—" tek başına hangi hâl
            olduğunu anlatmaz. */}
        {!tanim.destekli ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'bu sembol ölçülemedi — ' + (tanim.red ?? 'uç bu sembol biçimini kabul etmiyor')}
          </Text>
        ) : istekHatasi ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'ölçemedim — ' + istekHatasi.message}
          </Text>
        ) : !veri ? (
          <Text style={[type.micro, { color: colors.textDim }]}>bu kalem için ölçüm gelmedi.</Text>
        ) : !mumlar.length ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'ölçüldü, bu aralıkta mum yok (adet ' + String(veri.adet) + ') — kapalı pazar olabilir.'}
          </Text>
        ) : (
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'ilk açılıştan son kapanışa · ' +
              String(mumlar.length) +
              ' mum · ' +
              veri.range +
              '/' +
              veri.interval +
              (son ? ' · son mum ' + formatGunAy(son.time) : '')}
          </Text>
        )}
      </View>

      <View style={styles.sag}>
        {!tanim.destekli || istekHatasi || !veri || yuzde == null ? (
          <Pill label="ölçülemedi" tone="gold" glyph={null} size="sm" />
        ) : (
          <>
            {/* Yön RENKLE DEĞİL okla da: `signalOf` ikisini birlikte
                veriyor (theme/signal.ts gerekçesi). */}
            <Pill label={formatPercent(yuzde)} tone={isaret.tone} glyph={isaret.arrow} size="sm" />
            <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
              {'son ' + formatPrice(son ? son.close : null, kur)}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  satir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sol: { flex: 1, gap: space.xxs },
  sag: { alignItems: 'flex-end', gap: space.xxs },
  num: { ...numeric, marginTop: space.sm },
});

/**
 * Kartın dışında, ÇAĞIRANIN kullanması için: bir ölçüm gövdesinin
 * eksik olup olmadığını aynı rozetle yazdırır. `/api/chart` gövdesi
 * `tam` + `sayac` TAŞIYOR (api/types.ts:456-466), yani skor sayacının
 * şekli burada GERÇEKTEN var — bu yüzden `OlcumEksikRozet` bu uçta
 * KULLANILABİLİR (künye ucunda kullanılamıyordu).
 */
export function EndeksOlcumNotu({ veri }: { veri: ChartResponse | null }) {
  return <OlcumEksikRozet kaynak={veri} />;
}
