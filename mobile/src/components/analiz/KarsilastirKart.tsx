// =====================================================================
//  ⚖️ KarsilastirKart — /api/compare sıralaması        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/compare` cevabının `sira` dizisini tablo olarak basar:
//  sembol · bileşke · TA · FA · sıra. Altında sıralanamayanlar.
//
//  NEDEN TABLO, NEDEN KART YIĞINI DEĞİL: karşılaştırmanın tek işi aynı
//  ölçütü yan yana okutmak. Her sembolü kendi kartına koymak, gözün
//  sayıları satır satır eşlemesini zorunlu kılar — kıyas kaybolur.
//
//  BURADA HESAP YOK — EN KRİTİK NOKTA BU:
//    · Sıra MOTORUN (`sira[].sira`). İstemci diziyi YENİDEN SIRALAMAZ:
//      `SiraKayit` notu ölçtü ki anahtar `dAtr`, eşitlik bozucu
//      `skor10` — ikinci bir sıralama kuralı yazmak iki ekranda iki
//      farklı birinci sıra demek olurdu. Dizi GELDİĞİ GİBİ basılıyor.
//    · `dAtr` "GÜN" DEĞİLDİR: (fiyat − bant üstü) ÷ ATR, yani uzaklığın
//      tipik bir günlük SALINIMIN kaç katı olduğu. ATR bir günün
//      yüksek−düşük genişliğidir, günlük net düşüş değil; dahası
//      mesafe-süre ilişkisi doğrusal değil. Bu yüzden ekranda "N günlük
//      düşüş" yazmıyoruz (düzeltildi 2026-10-25) — `formatBandUzakligi`.
//    · YÜZDE UZAKLIK UÇTAN GELMİYOR → türetilmiyor. `SiraKayit`e `pct`
//      eklenirse cümle "bandın %2,4 üstünde" ile tamamlanır.
//    · TA / FA / bileşke skorları `sonuclar[]`dan OKUNUR, türetilmez.
//      Bileşke `blendedShown`dur (motorun yuvarlaması); `blended`den
//      yuvarlama yapılmaz.
//    · `durum` (in|below|near|far) ve bantlar METİN olarak basılır;
//      eşik tablosu istemcide YOK.
//    · `rrRatio` BİLGİ — uç notu açıkça "sıralamaya girmez" diyor;
//      burada da sıralamaya girmiyor, yalnız künye satırında duruyor.
//
//  NEDEN `fetch` YOK: proje kuralı "ekranlar ister, komponentler
//  çizer" (`components/` içinde `fetch` yok). Veri props'tan gelir;
//  `durum`/`hata`/`yenile` de `useIstek`in döndürdüğü hâliyle.
//
//  NEDEN İKİ DİZİ TEK TABLOYA: `CompareResponse = AnalyzeResponse &
//  { sira, siralanamayan }`, yani skorlar `sonuclar`da, sıra `sira`da.
//  Eşleme sembol üzerinden yapılıyor; `sonuclar`da karşılığı olmayan
//  bir sıra kaydı SESSİZCE DÜŞMEZ, skorları `—` basar.
//
//  ── TEMEL METRİK TABLOSU (eklendi 2026-10-29) ──────────────────────
//  Web tarafında kıyasın GÖVDESİ 15 satırlık bir metrik ızgarası
//  (`app.js` `COMPARE_ROWS` + `paintCompare`); native'de o ızgara hiç
//  basılmıyordu. Alanlar `/api/compare` gövdesinde DEĞİL, künye ucunda
//  (`/api/yfin` → `YfinKunye`); bu yüzden ikinci bir props (`kunye`)
//  olarak GİRİYOR — kart `fetch` etmiyor (proje kuralı).
//
//  Satır sırası ve etiketleri WEB'DEN AYNEN alındı: aynı kıyası iki
//  üründe iki farklı dizilişle okumak, kullanıcının gözünün kurduğu
//  sırayı bozardı.
//
//  TABLODA HESAP YOK — ölçek değiştirilmiyor:
//    · `profitMargin` · `returnOnEquity` · `revenueGrowth` ·
//      `dividendYield` → ORAN (0-1). Web bunları `(v*100)` ile yüzdeye
//      çeviriyor; native ÇEVİRMİYOR (`lib/format.ts` başlığı: ölçek
//      değiştirmek motorun işi). Bu yüzden `formatOran`, başlıkta da
//      ölçeğin ne olduğu yazıyor.
//    · `debtToEquity` → YÜZDE PUANI (Yahoo `financialData.debtToEquity`,
//      ör. 150 = 1,50×). Web `/100` ile "x"e çeviriyor; native ham
//      sayıyı basıyor ve ölçeği etikette söylüyor.
//    · `rowExtrema` (satır bazlı en iyi/en kötü imi) MOTORA TAŞINDI
//      (Ş8 #10a, 2026-10-31): karşılaştırma `api/_motor.js`te, uç
//      `/api/yfin` cevabında `ekstrem` alanı olarak satırın en iyi/en
//      kötü SEMBOLÜNÜ bildiriyor. BURADA yalnız sembol eşitliği
//      aranıyor — sayı karşılaştırması, eşik, yön kuralı YOK (§5.1).
//      İm indeksle değil SEMBOLLE geliyor: tablo `ok:false` künyeleri
//      süzdüğü için indeks sessizce yanlış sütuna kayardı.
//      `computeCompareVerdict` karar cümlesi HÂLÂ NATIVE'DE YOK — o bir
//      istemci karar kuralı ve motora taşınmadı.
//    · `industry` web'de bir TÜRKÇE SÖZLÜKTEN geçiyor (`trIndustry`);
//      o sözlük istemci verisi, uçta yok — native kaynağın verdiği
//      metni basıyor, uydurma çeviri yapmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type {
  AnalyzeRow,
  ApiError,
  CompareResponse,
  IstekDurum,
  SiraKayit,
  YfinEkstremAlan,
  YfinKunye,
  YfinResponse,
} from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import {
  EMPTY,
  formatBandUzakligi,
  formatCompact,
  formatOran,
  formatPrice,
  formatScore,
} from '@/lib/format';
import type { Tone } from '@/theme';
import { numeric, space, toneColors, type, useTheme } from '@/theme';

/**
 * Alım bandı durumunun TÜRKÇESİ. Küme SABİT ve MOTORUN
 * (`SiraKayit.durum`: in | below | near | far) — burada yalnız etiket
 * çevirisi var, eşik ya da yeniden sınıflama YOK.
 */
const DURUM_METIN: Record<string, string> = {
  in: 'bandın içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandan uzak',
};

/**
 * Metrik satırı tanımı. SIRA VE ETİKET WEB'DEN (`app.js` COMPARE_ROWS);
 * `olcek` yalnız bir NOT — hiçbir dönüşüm tetiklemez, çünkü dönüşüm yok.
 */
type MetrikSatir = {
  /** `YfinKunye` alan adı. */
  alan: keyof YfinKunye;
  etiket: string;
  /** Hücre biçimi. Hepsi ham sayıyı BİÇİMLER, ölçek değiştirmez. */
  bicim: 'metin' | 'fiyat' | 'buyuk' | 'oran1' | 'oran2' | 'oran4';
  /** Ölçeğin ne olduğu — etiketin altında küçük punto. */
  olcek?: string;
};

/**
 * 15 temel metrik. SIRA WEB'LE AYNI (`app.js:12479`): sınıflandırma →
 * fiyat/büyüklük → değerleme çarpanları → kârlılık/büyüme → borç →
 * temettü. Diziyi yeniden sıralamak, aynı kıyasın iki üründe iki farklı
 * okunuşu demek olurdu.
 */
const METRIKLER: readonly MetrikSatir[] = [
  { alan: 'sector', etiket: 'Sektör', bicim: 'metin' },
  { alan: 'industry', etiket: 'Detay', bicim: 'metin', olcek: 'kaynağın sınıflandırması' },
  { alan: 'price', etiket: 'Fiyat', bicim: 'fiyat' },
  { alan: 'marketCap', etiket: 'Piyasa Değeri', bicim: 'buyuk' },
  { alan: 'trailingPE', etiket: 'F/K', bicim: 'oran1' },
  { alan: 'forwardPE', etiket: 'İleri F/K', bicim: 'oran1' },
  { alan: 'peg', etiket: 'PEG', bicim: 'oran2' },
  { alan: 'priceToBook', etiket: 'PD/DD', bicim: 'oran1' },
  { alan: 'priceToSales', etiket: 'F/S (Fiyat/Satış)', bicim: 'oran1' },
  { alan: 'evEbitda', etiket: 'FD/FAVÖK', bicim: 'oran1' },
  { alan: 'profitMargin', etiket: 'Net Kâr Marjı', bicim: 'oran4', olcek: 'oran, 0-1' },
  {
    alan: 'returnOnEquity',
    etiket: 'Özsermaye Kârlılığı',
    bicim: 'oran4',
    olcek: 'oran, 0-1',
  },
  {
    alan: 'revenueGrowth',
    etiket: 'Gelir Büyümesi (yıllık)',
    bicim: 'oran4',
    olcek: 'oran, 0-1',
  },
  {
    alan: 'debtToEquity',
    etiket: 'Borç/Özsermaye',
    bicim: 'oran1',
    olcek: 'yüzde puanı (150 = 1,50×)',
  },
  { alan: 'dividendYield', etiket: 'Temettü Verimi', bicim: 'oran4', olcek: 'oran, 0-1' },
];

/**
 * Tek hücre metni. ÜÇ DAL AYRI:
 *   · alan künyede YOK (`undefined`) → "sormadım" → `EMPTY`
 *   · alan `null`                    → "ölçemedim" → `EMPTY`
 *   · sayı/metin geldi               → biçimlenir (0 dâhil; 0 ölçümdür)
 * İkisi de `—` basıyor ama gerekçe satır altındaki rozetlerde ayrışıyor
 * (`ok:false` = künye turu düştü). Hücrede uydurma sayı YOK.
 */
function hucre(satir: MetrikSatir, kunye: YfinKunye): string {
  const ham = kunye[satir.alan];
  if (ham == null) return EMPTY;
  if (satir.bicim === 'metin') {
    const metin = String(ham).trim();
    return metin || EMPTY;
  }
  if (typeof ham !== 'number' || !Number.isFinite(ham)) return EMPTY;
  switch (satir.bicim) {
    case 'fiyat':
      return formatPrice(ham, kunye.currency ?? null);
    case 'buyuk':
      return formatCompact(ham);
    case 'oran1':
      return formatOran(ham, 1);
    case 'oran2':
      return formatOran(ham, 2);
    default:
      return formatOran(ham, 4);
  }
}

/** Hücre imi — ton + ok + KELİME. Renk tek taşıyıcı değil. */
type EkstremIm = { tone: Tone; metin: string };

/**
 * Satır + sembol için im. İÇİNDE KARŞILAŞTIRMA YOK: uç satırın en
 * iyi/en kötü sembolünü söylüyor, burada yalnız `===` eşitliği var.
 * Sözlükte satır yoksa (`undefined`) ya da sembol ikisinden biri
 * değilse `null` → hücreye hiçbir şey basılmaz.
 */
function imSec(
  ekstrem: YfinResponse['ekstrem'],
  alan: keyof YfinKunye,
  sembol: string,
): EkstremIm | null {
  const satir = ekstrem ? ekstrem[alan as YfinEkstremAlan] : undefined;
  if (!satir) return null;
  if (satir.eniyi === sembol) return { tone: 'positive', metin: '▲ en iyi' };
  if (satir.enkotu === sembol) return { tone: 'negative', metin: '▼ en kötü' };
  return null;
}

export type KarsilastirKartProps = {
  /** `/api/compare` gövdesi. `null` → henüz veri yok. */
  veri: CompareResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /**
   * Hangi semboller soruldu — boş sonuçta cümleyi somut yapar
   * ("THYAO.IS, KO için sıralama dönmedi"). Verilmezse genel cümle.
   */
  semboller?: string[];
  /**
   * `/api/yfin` gövdesi — TEMEL METRİK TABLOSUNUN kaynağı. Ayrı props,
   * çünkü ayrı uç: sıralama gelirken künye düşebilir (ya da tersi) ve
   * iki bloğun eksikliği AYRI yazılmalı. `undefined` → ekran künyeyi
   * HİÇ SORMADI, tablo basılmaz; `null` → istek sürüyor/boş.
   */
  kunye?: YfinResponse | null;
};

export function KarsilastirKart({
  veri,
  durum,
  hata,
  yenile,
  semboller = [],
  kunye,
}: KarsilastirKartProps) {
  const { colors } = useTheme();

  // Sembol → skor satırı. `find()` ile iç içe döngü kurmamak için;
  // sıralama BURADA DEĞİŞMİYOR, yalnız arama hızlanıyor.
  const skorlar = new Map<string, AnalyzeRow>();
  for (const s of veri?.sonuclar ?? []) skorlar.set(s.sym.toUpperCase(), s);

  const sira = veri?.sira ?? [];
  const siralanamayan = veri?.siralanamayan ?? [];

  // Künye SORULMADIYSA (`undefined`) tablo hiç çizilmez; sorulmuş ama
  // hiçbir sembolü ölçülememişse (`ok:false`) tablo yerine gerekçe.
  const kunyeSoruldu = kunye !== undefined;
  const kunyeler = kunye?.results ?? [];
  const olculenKunye = kunyeler.filter((k) => k.ok);
  const olculemeyenKunye = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);

  // EKSTREM İMİ — ÜÇ HÂL AYRI ÇİZİLİYOR. `undefined` ile `null`ı aynı
  // cümleye koymak "uç göndermedi" ile "uç ölçemedi"yi karıştırmak
  // olurdu; eski uçla çalışan istemci her tabloya yanlış bir eksiklik
  // notu basardı.
  const ekstrem = kunye?.ekstrem;
  let imNotu = 'Satır bazlı en iyi/en kötü imi uçtan geliyor; kıyas kararı okuyucunun.';
  if (ekstrem === undefined) imNotu = 'En iyi/en kötü imi bu sürümde uçtan gelmiyor.';
  else if (ekstrem === null) imNotu = 'En iyi/en kötü imi uçta ölçülemedi.';

  return (
    <Card
      title="⚖️ Karşılaştır"
      subtitle="Sıra motorun; istemci diziyi yeniden sıralamaz"
      right={
        durum === 'veri' && sira.length ? (
          <Pill label={sira.length + ' sembol'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      {/* `kartsiz`: zaten bir `Card`ın içindeyiz, iç içe iki kenar
          çizilmesin. İskelet şekli 'sira' — ekranın GERÇEKTEN beklediği
          içerik sıralama satırı, fiyat satırı değil. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={Math.max(2, semboller.length || 3)}
        sekil="sira"
        kartsiz
        bosMetin="En az iki sembol seç; kıyas o zaman istenecek."
      />

      {durum === 'veri' ? (
        sira.length ? (
          <>
            {/* Eksik ölçüm rozeti TABLONUN ÜSTÜNDE: `tam:false` ile
                gelen bir sıralamayı önce gösterip altına künye düşmek,
                eksik ölçümü tam ölçüm gibi sunmaktı. */}
            <OlcumEksikRozet kaynak={veri} />

            <View style={[styles.baslik, { borderColor: colors.border }]}>
              <Text style={[type.micro, styles.hSembol, { color: colors.textDim }]}>SEMBOL</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>BİLEŞKE</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>TA</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>FA</Text>
              <Text style={[type.micro, styles.hSira, { color: colors.textDim }]}>SIRA</Text>
            </View>

            {sira.map((k) => (
              <Satir key={k.sym} kayit={k} skor={skorlar.get(k.sym.toUpperCase()) ?? null} />
            ))}

            {/* NEDEN AYRI BLOK, NEDEN SESSİZ DÜŞMÜYOR: uç notu
                (`CompareResponse.siralanamayan`) "sessizce düşürülmez,
                ekranda yazar" diyor. Sorulan ama sıralanamayan sembolü
                listeden çıkarmak, kullanıcıya eksik bir kıyası tam
                kıyas gibi göstermek olurdu. */}
            {siralanamayan.length ? (
              <View style={styles.dipnot}>
                <Pill label="sıralanamadı" tone="neutral" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {siralanamayan.join(', ') +
                    ' — alım bandı ya da fiyatı ölçülemedi, sıraya girmedi.'}
                </Text>
              </View>
            ) : null}

            {/* ATLANAN AYRI BİR ŞEY: `siralanamayan` ÖLÇÜLDÜ ama bandı
                yok; `atlanan` ise zaman bütçesi dolduğu için HİÇ
                BAŞLANMADI (`ScoreResponse.atlanan` notu). İkisini aynı
                cümleye koymak "ölçtüm, sonuç yok" ile "ölçemedim"i
                karıştırmak olurdu. */}
            {(veri?.atlanan?.length ?? 0) > 0 ? (
              <View style={styles.dipnot}>
                <Pill label="ölçülmedi" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {(veri?.atlanan ?? []).join(', ') +
                    ' — zaman bütçesi dolduğu için bu turda hiç ölçülmedi.'}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <VeriYok
            kartsiz
            metin={
              (semboller.length ? semboller.join(', ') : 'Seçilen semboller') +
              ' için motor sıralama döndürmedi.'
            }
          />
        )
      ) : null}

      {/* ── TEMEL METRİK TABLOSU ──────────────────────────────────────
          NEDEN SIRALAMA DURUMUNA BAĞLI DEĞİL: künye AYRI UÇ. Sıralama
          düşerken künye gelmiş olabilir; tabloyu `durum`a bağlamak
          ölçülmüş veriyi sırf komşu istek düştüğü için saklamak olurdu.
          `kunyeSoruldu` false ise blok HİÇ YOK — "sormadım" ile
          "ölçemedim" ayrı iki hâl. */}
      {kunyeSoruldu ? (
        <View style={[styles.bolum, { borderColor: colors.border }]}>
          <Text style={[type.smallBold, { color: colors.text }]}>Temel metrikler</Text>
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Künye ucunun ham alanları — satır sırası web ile aynı. Ölçek değiştirilmiyor. ' +
              imNotu}
          </Text>

          {olculenKunye.length ? (
            // Yatay kaydırma: sembol sütunu SABİT GENİŞLİK. Esnek sütun
            // 5-6 sembolde rakamları üst üste bindiriyordu; sayı sütunu
            // kayınca satır kıyası kaybolur (kartın tek işi o kıyas).
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={[styles.mBaslik, { borderColor: colors.border }]}>
                  <Text style={[type.micro, styles.mEtiket, { color: colors.textDim }]}>
                    METRİK
                  </Text>
                  {olculenKunye.map((k) => (
                    <Text
                      key={k.symbol}
                      style={[type.smallBold, styles.mHucre, { color: colors.text }]}
                      numberOfLines={1}>
                      {k.symbol}
                    </Text>
                  ))}
                </View>

                {METRIKLER.map((m) => (
                  <View key={m.alan} style={[styles.mSatir, { borderColor: colors.border }]}>
                    <View style={styles.mEtiket}>
                      <Text style={[type.small, { color: colors.textDim }]}>{m.etiket}</Text>
                      {m.olcek ? (
                        <Text style={[type.micro, { color: colors.textFaint }]}>{m.olcek}</Text>
                      ) : null}
                    </View>
                    {olculenKunye.map((k) => {
                      const im = imSec(ekstrem, m.alan, k.symbol);
                      return (
                        <View key={k.symbol} style={styles.mHucreKutu}>
                          <Text
                            style={[
                              type.small,
                              m.bicim === 'metin' ? null : numeric,
                              styles.mHucreMetin,
                              { color: colors.text },
                            ]}
                            numberOfLines={2}>
                            {hucre(m, k)}
                          </Text>
                          {/* İm SAYIYA DOKUNMUYOR: ham değer yukarıda
                              olduğu gibi duruyor, im ALTINA ayrı satır
                              olarak düşüyor. Renk + ok + kelime birden
                              taşıyor (renk tek başına taşıyıcı değil). */}
                          {im ? (
                            <Text
                              style={[
                                type.micro,
                                styles.mHucreMetin,
                                { color: toneColors(colors, im.tone).fg },
                              ]}>
                              {im.metin}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <VeriYok
              kartsiz
              metin={
                kunyeler.length
                  ? 'Sorulan sembollerin hiçbirinin künyesi ölçülemedi.'
                  : 'Künye ucu bu tur için sonuç döndürmedi.'
              }
            />
          )}

          {olculemeyenKunye.length ? (
            <View style={styles.dipnot}>
              <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                {olculemeyenKunye.join(', ') +
                  ' — künye turu düştü, bu sembolün temel alanları ölçülemedi.'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Tek sıralama satırı. Sayılar `tabular-nums` (`theme/typography.ts`
 * → `numeric`) — orantılı rakam sütunu satırdan satıra kaydırırdı.
 */
function Satir({ kayit, skor }: { kayit: SiraKayit; skor: AnalyzeRow | null }) {
  const { colors } = useTheme();

  const bilesike = skor?.composite.blendedShown ?? null;
  const taSkor = skor?.ta.score ?? null;
  const faSkor = skor?.fa.score ?? null;
  const durumMetni = DURUM_METIN[kayit.durum] ?? kayit.durum;

  return (
    <View
      style={[styles.satir, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        kayit.sym +
        ', sıra ' +
        kayit.sira +
        ', bileşke ' +
        formatScore(bilesike) +
        ', teknik ' +
        formatScore(taSkor) +
        ', temel ' +
        formatScore(faSkor) +
        ', ' +
        durumMetni +
        ', ' +
        formatBandUzakligi(kayit.dAtr)
      }>
      <View style={styles.hSembol}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {kayit.sym}
        </Text>
        <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
          {durumMetni}
        </Text>
      </View>
      <Text style={[type.smallBold, numeric, styles.hSayi, { color: colors.text }]}>
        {formatScore(bilesike)}
      </Text>
      <Text style={[type.small, numeric, styles.hSayi, { color: colors.textDim }]}>
        {formatScore(taSkor)}
      </Text>
      <Text style={[type.small, numeric, styles.hSayi, { color: colors.textDim }]}>
        {formatScore(faSkor)}
      </Text>
      <Text style={[type.smallBold, numeric, styles.hSira, { color: colors.gold }]}>
        {String(kayit.sira)}
      </Text>

      {/* KÜNYE SATIRI: motorun sıralama anahtarı (`dAtr`) ve
          sıralamaya GİRMEYEN bilgi (`rrRatio`, `skor10`). Ayrı satırda,
          çünkü tablo sütunu olsalardı aynı ağırlıkta okunurlardı —
          `rrRatio` ise uç notunun açıkça "bilgi" dediği alan. */}
      <Text style={[type.micro, numeric, styles.kunye, { color: colors.textFaint }]}>
        {'Alım bandına: ' +
          formatBandUzakligi(kayit.dAtr) +
          '  ·  bütüncül ' +
          formatOran(kayit.skor10, 1) +
          '/10  ·  R/Ö ' +
          (typeof kayit.rrRatio === 'number' ? kayit.rrRatio.toFixed(1) + '×' : '—') +
          ' (bilgi, sıraya girmez)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  baslik: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  satir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hSembol: { flex: 3, minWidth: 64 },
  bolum: {
    gap: space.xs,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mBaslik: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mSatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // SABİT genişlik: sütunlar satırdan satıra kaymasın (yatay kaydırma
  // bu yüzden var — esnek sütun kıyası bozuyordu).
  mEtiket: { width: 150, paddingRight: space.sm },
  mHucre: { width: 108, paddingRight: space.sm, textAlign: 'right' },
  // Hücre artık İKİ satır taşıyabiliyor (ham sayı + ekstrem imi), bu
  // yüzden genişlik `View`e, hizalama metne geçti. Genişlik AYNI kaldı:
  // sütunların satırdan satıra kaymaması kartın tek işi olan kıyasın
  // ön koşulu.
  mHucreKutu: { width: 108, paddingRight: space.sm },
  mHucreMetin: { alignSelf: 'stretch', textAlign: 'right' },
  hSayi: { flex: 2, textAlign: 'right' },
  hSira: { flex: 1.2, textAlign: 'right' },
  // Künye tam satır: `flexWrap` ile alt sıraya düşer.
  kunye: { width: '100%' },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
