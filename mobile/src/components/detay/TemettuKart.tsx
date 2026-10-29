// =====================================================================
//  💵 TemettuKart — temettü künyesi (hisse detayı)     (ŞERİT F / native)
// ---------------------------------------------------------------------
//  NE: `/api/yfin` künyesinin TEMETTÜ alanları — yıllık/son 12 aylık
//  hisse başı tutar, son tek ödeme, dağıtım oranı, iki verim ölçeği ve
//  üç tarih (son ödeme · kesinti/ex-date · ödeme günü).
//
//  NEDEN YENİ KART, DETAYDAKİ BİRİ GENİŞLETİLMEDİ: detay klasöründeki
//  beş kartın hepsi `AnalyzeRow`a bağlı (`TeknikKart`, `TemelKart`,
//  `TezKart`, `RiskOdulKart`, `DetayBasligi`) — temettü o kayıtta HİÇ
//  YOK, `/api/yfin` ayrı uç. `BacktestKart`/`DegerKart` kendi uçlarını
//  çağırıyor ama o uçlar temettü ölçmüyor. Yani genişletilecek uygun
//  kart yoktu; bu kart `BacktestKart`ın DESENİNİ izliyor: kendi isteği,
//  kendi zaman aşımı, kendi `Durum` gövdesi.
//
//  NEDEN `components/analiz/TemettuKart` KULLANILMADI: o kart ÇOK
//  SEMBOLLÜ bir liste (pazar süzgeci + verime göre sıralama) ve yalnız
//  `dividendYield` basıyor; girdisini Analiz sekmesi kendi turundan
//  veriyor (`veri`/`durum`/`hata` props). Tek sembollü detay ekranına
//  liste kartı sokmak, hem props zincirini ekrana taşımak hem de
//  sıralama/süzgeç gibi burada anlamsız bir yüzey getirmek olurdu.
//
//  ── ÜÇ AYRI ÖLÇEK, ÜÇ AYRI BİÇİMLEYİCİ (ÖLÇÜLDÜ: api/_yfin.js) ─────
//    · PARA BİRİMİ (hisse başı): dividendRate ·
//      trailingAnnualDividendRate · lastDividendValue → `formatPrice`
//      (+ künyeden gelen `currency`; para birimi bilinmiyorsa simge
//      UYDURULMAZ, `formatPrice` yalnız sayı basar).
//    · ORAN (0-1): payoutRatio · trailingAnnualDividendYield →
//      `formatOran`. `formatPercent` YÜZDE PUANI beklediği için bu iki
//      alanda 100 kat küçük sayı basardı.
//    · YÜZDE PUANI: dividendYield5y (2.41 = %2,41) → `formatOran` +
//      '%' işareti. Burada `formatOran`a çıplak verilse "2,41" yazar ve
//      kullanıcı bunu 0-1 oranı sanar; `formatPercent` ise yön işareti
//      ekler ("+2,41%") ki verim bir DEĞİŞİM değil — işaret yanlış
//      anlam taşır. Bu yüzden sayı `formatOran`la biçimlenip yanına
//      yalnız birim yazılıyor. ÖLÇEK DEĞİŞTİRİLMİYOR: 100'e bölme yok.
//    · UNIX SANİYE: lastDividendTs · exDividendTs · dividendTs →
//      `formatGunAyYil` (saniye→milisaniye çevrimi O İŞLEVİN İÇİNDE).
//      Burada elle `new Date(t * 1000)` kurmak, yerel tarih biçimleyici
//      çağırmak ya da ECMA-402 arayüzüne dokunmak YASAK (Hermes kuralı
//      — tek biçimleme kaynağı `lib/format.ts`).
//
//  ── ÜÇ AYRI HÂL, ÜÇ AYRI CÜMLE ────────────────────────────────────
//    · alan `undefined`  → SORULMADI (cevapta anahtar hiç yok; eski
//      sürüm bir uç ya da `deep` kapalı istek)
//    · alan `null`       → ÖLÇÜLEMEDİ (uç `num()` ile `null` bastı)
//    · alan `0`          → ÖLÇÜLDÜ, değer sıfır — "veri yok" DEĞİL
//  Üçünü tek "—" altında birleştirmek ölçülmüş bilgiyi silmek olurdu;
//  `0` basmak da ölçülemeyeni "ödeme yok" göstermek olurdu.
//
//  BURADA HESAP YOK: hiçbir alan çarpılmıyor, bölünmüyor, toplanmıyor;
//  tutar × adet, verim × fiyat, yıllık tutar ÷ fiyat gibi TÜRETMELER
//  YAPILMIYOR. Eşik yok, skor yok, karar cümlesi yok — ham sayı ve
//  Türkçe etiket.
//
//  UÇTA OLMAYANLAR (uydurulmuyor, alanı da açılmadı): beyan (ilan)
//  tarihi — Yahoo `quoteSummary`'de yok — ve temettü GEÇMİŞİ (ayrı
//  çağrı gerekiyor: `chart?events=div`). İkisi kartta açıkça yazıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import { fetchYfin, useIstek, type YfinKunye } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { EMPTY, formatGunAyYil, formatOran, formatPrice } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/**
 * Bir alanın ÜÇ hâli. `undefined` ile `null`ı ayıran tek yer burası;
 * kartın geri kalanı bu etikete bakıyor.
 */
type Hal = 'sorulmadi' | 'olcemedim' | 'var';

function halOf(v: number | null | undefined): Hal {
  if (v === undefined) return 'sorulmadi';
  // `NaN`/`Infinity` uçta `num()` süzgecinden geçmez, ama tür izin
  // verdiği için burada da ölçülemeyen sayılıyor — ekranda "NaN" yazmak
  // ölçülmemiş bir sayı basmaktır.
  if (v === null || !Number.isFinite(v)) return 'olcemedim';
  return 'var';
}

/** Ölçülemeyen/sorulmayan alanın alt satır notu — iki hâl ayrı cümle. */
function eksikNotu(hal: Hal): string {
  return hal === 'sorulmadi' ? 'bu alan cevapta hiç yok — sorulmadı' : 'uç ölçemedi';
}

export type TemettuKartProps = {
  /** Ucun isteyeceği sembol — çağıranın yazımı (BIST'te `.IS` sonekli). */
  sembol: string;
};

export function TemettuKart({ sembol }: TemettuKartProps) {
  const { colors } = useTheme();

  // `deep` AÇIK: `dividendTs` (ödeme günü) YALNIZ `calendarEvents` ile
  // geliyor (`api/_yfin.js:128`). Kapalı istekte o alan `null` döner ve
  // kart "ölçülemedi" derdi — oysa sorulmamış olurdu. `deep` varsayılanı
  // zaten açık (`fetchYfin`), burada NİYET olarak yazılı.
  const cagri = useCallback(
    (signal: AbortSignal) => fetchYfin([sembol], { deep: true, signal }),
    [sembol],
  );

  // Anahtar DİZGİ: `useIstek` nesne anahtarı kabul etmiyor (sonsuz tur).
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|temettu', {
    etkin: Boolean(sembol),
  });

  const kunye: YfinKunye | null = veri?.results?.[0] ?? null;

  return (
    <Card
      title="💵 Temettü künyesi"
      subtitle="Künye ucundan gelen ham alanlar — tutar, oran ve tarihler."
      right={
        durum === 'veri' && kunye?.ok ? (
          <Pill label="künye ölçüldü" tone="info" glyph={null} size="sm" />
        ) : null
      }>
      {/* Yükleniyor · boş · dört hata türü: tek gövde, kart içinde. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={4}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' ? (
        !kunye ? (
          // Tur koştu, kayıt gelmedi: hata değil, veri cevabı.
          <VeriYok kartsiz metin={sembol + ' için künye ucu kayıt döndürmedi.'} />
        ) : !kunye.ok ? (
          // `ok:false` → SEMBOL DIŞINDA HİÇBİR ALAN YOK (api/yfin.ts
          // ölçümü). Burada satır basmak, boş alanları "temettü yok"
          // diye göstermek olurdu.
          <VeriYok
            kartsiz
            metin={sembol + ' künyesi ölçülemedi (Yahoo turu düştü) — temettü alanları yok.'}
          />
        ) : (
          <TemettuGovde kunye={kunye} />
        )
      ) : null}

      {durum === 'veri' && kunye?.ok ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Tutarlar hisse başı' +
            (kunye.currency ? ' (' + kunye.currency + ')' : '') +
            '. “—” o alanın ölçülemediğini söyler; ölçülen 0 ise 0 yazar — ikisi aynı şey değil.'}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * Dokuz alanın gövdesi. AYRI İŞLEV: `kunye.ok` burada KESİN `true`,
 * yani her satırda ikinci bir koşul zinciri yazılmıyor.
 */
function TemettuGovde({ kunye }: { kunye: YfinKunye }) {
  const { colors } = useTheme();
  const kur = kunye.currency ?? null;

  // Para birimi alanları — hisse başı TUTAR.
  const yillik = halOf(kunye.dividendRate);
  const son12 = halOf(kunye.trailingAnnualDividendRate);
  const sonTek = halOf(kunye.lastDividendValue);
  // Oran / yüzde puanı alanları.
  const payout = halOf(kunye.payoutRatio);
  const verim12 = halOf(kunye.trailingAnnualDividendYield);
  const verim5y = halOf(kunye.dividendYield5y);
  // Tarih alanları — UNIX SANİYE.
  const sonTarih = halOf(kunye.lastDividendTs);
  const exTarih = halOf(kunye.exDividendTs);
  const odemeTarih = halOf(kunye.dividendTs);

  // Hiçbir alanı ölçülemeyen künye: dokuz satır "—" basmak yerine tek
  // dürüst cümle. SAYILMA DEĞİL, var/yok denetimi — eşik yok.
  const olculenVar =
    yillik === 'var' ||
    son12 === 'var' ||
    sonTek === 'var' ||
    payout === 'var' ||
    verim12 === 'var' ||
    verim5y === 'var' ||
    sonTarih === 'var' ||
    exTarih === 'var' ||
    odemeTarih === 'var';

  return (
    <View style={styles.govde}>
      {!olculenVar ? (
        <VeriYok
          kartsiz
          metin="Künye ölçüldü ama temettü alanlarının hiçbiri gelmedi — bu sembol için uçta temettü verisi yok."
        />
      ) : null}

      <View style={styles.liste}>
        {/* ── TUTARLAR (para birimi) ── */}
        <Satir
          etiket="Yıllık temettü (hisse başı)"
          not={yillik === 'var' ? 'ilan edilmiş yıllık tutar' : eksikNotu(yillik)}
          deger={yillik === 'var' ? formatPrice(kunye.dividendRate, kur) : EMPTY}
        />
        <Satir
          etiket="Son 12 ayda ödenen (hisse başı)"
          not={son12 === 'var' ? 'fiilen ödenen tutar' : eksikNotu(son12)}
          deger={son12 === 'var' ? formatPrice(kunye.trailingAnnualDividendRate, kur) : EMPTY}
        />
        <Satir
          etiket="Son tek ödeme (hisse başı)"
          not={sonTek === 'var' ? 'tek dağıtımın tutarı' : eksikNotu(sonTek)}
          deger={sonTek === 'var' ? formatPrice(kunye.lastDividendValue, kur) : EMPTY}
        />

        {/* ── ORANLAR (0-1) ── */}
        <Satir
          etiket="Dağıtım oranı (payout)"
          not={payout === 'var' ? 'oran, 0-1 ölçeği — ucun ham ölçeği' : eksikNotu(payout)}
          deger={payout === 'var' ? formatOran(kunye.payoutRatio, 4) : EMPTY}
        />
        <Satir
          etiket="Son 12 ay temettü verimi"
          not={verim12 === 'var' ? 'oran, 0-1 ölçeği — ucun ham ölçeği' : eksikNotu(verim12)}
          deger={verim12 === 'var' ? formatOran(kunye.trailingAnnualDividendYield, 4) : EMPTY}
        />

        {/* ── YÜZDE PUANI — ÖTEKİ İKİ VERİMLE AYNI ÖLÇEKTE DEĞİL ── */}
        <Satir
          etiket="5 yıl ortalama temettü verimi"
          not={
            verim5y === 'var'
              ? 'YÜZDE PUANI — üstteki 0-1 oranlarıyla aynı ölçek değil'
              : eksikNotu(verim5y)
          }
          // Sayı `formatOran`la biçimleniyor, ölçek DEĞİŞTİRİLMİYOR;
          // '%' yalnız birim işareti (gerekçesi başlıkta).
          deger={verim5y === 'var' ? formatOran(kunye.dividendYield5y, 2) + '%' : EMPTY}
          erisimEtiketi={
            verim5y === 'var'
              ? 'Beş yıl ortalama temettü verimi yüzde ' + formatOran(kunye.dividendYield5y, 2)
              : 'Beş yıl ortalama temettü verimi ' + eksikNotu(verim5y)
          }
        />

        {/* ── TARİHLER (UNIX SANİYE → formatGunAyYil) ── */}
        <Satir
          etiket="Son ödemenin tarihi"
          not={sonTarih === 'var' ? 'son tek dağıtımın günü' : eksikNotu(sonTarih)}
          deger={sonTarih === 'var' ? formatGunAyYil(kunye.lastDividendTs) : EMPTY}
        />
        <Satir
          etiket="Temettü kesinti tarihi (ex-date)"
          not={exTarih === 'var' ? 'künyedeki kesinti günü' : eksikNotu(exTarih)}
          deger={exTarih === 'var' ? formatGunAyYil(kunye.exDividendTs) : EMPTY}
        />
        <Satir
          etiket="Ödeme tarihi"
          not={
            odemeTarih === 'var'
              ? 'takvim modülünden (deep)'
              : eksikNotu(odemeTarih) + ' — yalnız takvim modülünde var'
          }
          deger={odemeTarih === 'var' ? formatGunAyYil(kunye.dividendTs) : EMPTY}
        />
      </View>

      {/* UÇTA HİÇ OLMAYAN İKİ ALAN: eksikliği yalnız kaynak yorumunda
          saklamak, kullanıcıya "temettü künyesi = bu dokuz satır"
          demek olurdu. Tarih/geçmiş UYDURULMUYOR. */}
      <View style={[styles.uyari, { borderColor: colors.border }]}>
        <Pill label="uçta yok" tone="neutral" glyph={null} size="sm" />
        <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
          Beyan (ilan) tarihi ve geçmiş temettü ödemeleri bu künye cevabında HİÇ YOK (eksik ölçüm
          değil, alan yok) — uydurma tarih basılmıyor.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  govde: { gap: space.sm },
  liste: { gap: space.xxs },
  uyari: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
