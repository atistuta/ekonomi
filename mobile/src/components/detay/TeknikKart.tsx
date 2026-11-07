// =====================================================================
//  TeknikKart — 📈 teknik skor + gösterge dökümü       (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `ta.score` (0-100) + rejim/ADX künyesi + `ta.breakdown` kalemleri
//  satır satır: gösterge adı · alt-skoru · ağırlığı.
//
//  NEDEN DÖKÜM GÖSTERİLİYOR: skorun TEK başına bir sayı olması onu
//  kara kutu yapar. Döküm "neden 63" sorusunun motordan gelen cevabı;
//  ürünün satış noktası da bu (bilgi aracı, tavsiye değil).
//
//  ── BURADA HESAP YOK, EN ÇOK BURADA ÖNEMLİ ────────────────────────
//  `breakdown[]` ağırlık VE alt-skor taşıyor; ikisini çarpıp toplamak
//  teknik skoru İSTEMCİDE yeniden üretmek olurdu. Motor zaten `score`u
//  gönderiyor; ikinci bir hesap, iki sayının bir gün ayrışması demek.
//  Ağırlıklar YALNIZ gösterilir (`formatOran`), çarpılmaz, yüzdeye
//  çevrilmez, normalize edilmez.
//
//  ── KATKI (`contrib`) SÜTUNU NEDEN YOK ─────────────────────────────
//  Motor kendi içinde `contrib = weight * (score - 50) * scale` ve
//  `wPct` üretiyor (api/_motor.js) ama uç noktanın SÖZLEŞMESİ bu iki
//  alanı TAŞIMIYOR: `api/_akis.js` dökümü `{key, score, weight}` olarak
//  kırpıyor (ÖLÇÜLDÜ, kaynak satırı: breakdown map). Katkıyı burada
//  `weight * (score - 50)` diye yeniden kurmak, motorun ölçek katsayısı
//  olmadan YANLIŞ bir sayı üretip onu motorun sayısıymış gibi göstermek
//  olurdu. Bu yüzden ekranda ne gelmişse o var: alt-skor ve ağırlık.
//
//  ── ETİKET ÇEVİRİSİ NEDEN İSTEMCİDE ───────────────────────────────
//  Motorda `TA_KEY_LABEL` var ama uç yalnız `key` gönderiyor (aynı
//  kırpma). Ham anahtarı ('ttmpl') kullanıcıya göstermek anlamsız;
//  aşağıdaki tablo SADECE ad çevirisi — eşik, sıra ya da ağırlık
//  TAŞIMIYOR, yani motorla çelişemez. Bilinmeyen anahtar gizlenmez,
//  olduğu gibi basılır (yeni gösterge sessizce kaybolmasın).
//
//  NEDEN `score === null` KIRMIZI DEĞİL: vade 'gunici' iken günlük
//  mumla TA üretilmiyor ve `ta.why` sebebi söylüyor — bu bir VERİ
//  cevabı, hata değil (types.ts üç durum notu ①).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { AnalyzeRow, TaHam } from '@/api';
import { Satir } from './Satir';
import { Card, Katlanir, OlcumBaslik, Pill, ScoreGauge, VeriYok } from '@/components';
import { EMPTY, formatCompact, formatOran, formatPrice, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/**
 * Gösterge anahtarı → Türkçe ad. Motordaki `TA_KEY_LABEL` aynası;
 * YALNIZ ad çevirisi (bkz. başlıktaki gerekçe).
 */
const TA_ETIKET: Record<string, string> = {
  trend: 'Trend (MA)',
  ichimoku: 'Ichimoku',
  macd: 'MACD',
  rsi: 'RSI',
  stoch: 'Stokastik',
  boll: 'Bollinger',
  obv: 'OBV · Hacim',
  vp: 'Hacim profili',
  oflow: 'Emir akışı (tahmini)',
  rs: 'Göreli güç (RS)',
  volconf: 'Hacim teyidi',
  ttmpl: 'Trend şablonu',
};

/**
 * Mum örüntüsünün MAKİNE KODU → Türkçe ad (`TaHamMumKodu` notunun
 * beklettigi tablo). YALNIZ AD ÇEVİRİSİ: eşik, yön yorumu, önem
 * sırası TAŞIMIYOR, o yüzden motorla çelişemez. Kümede olmayan bir kod
 * gelirse kodun KENDİSİ basılır — yeni örüntü sessizce kaybolmaz.
 */
const MUM_ETIKET: Record<string, string> = {
  bullishEngulfing: 'Yükselen yutan mum',
  bearishEngulfing: 'Düşen yutan mum',
  darkCloudCover: 'Kara bulut örtüsü',
  piercingLine: 'Delen çizgi',
  bullishHarami: 'Yükselen harami',
  bearishHarami: 'Düşen harami',
  hammer: 'Çekiç',
  shootingStar: 'Kayan yıldız',
};

/** Örüntü yönü kodu → Türkçe ad. Yine yalnız çeviri. */
const MUM_YON_ETIKET: Record<string, string> = {
  bull: 'yukarı yönlü örüntü',
  bear: 'aşağı yönlü örüntü',
  neutral: 'yönsüz örüntü',
};

/** Fib penceresi yönü kodu → Türkçe ad. */
const FIB_YON_ETIKET: Record<string, string> = {
  up: 'pencere tepeden dibe değil, dipten tepeye kuruldu (up)',
  down: 'pencere tepeden dibe kuruldu (down)',
};

/**
 * HAM SÖZLÜK BİÇİMLEYİCİLERİ — ALTI AYRI BİRİM, ALTI AYRI
 * BİÇİMLEYİCİ. Hepsini tek `formatOran`la basmak, hacmi (milyonlar)
 * fiyatla, 0-100 puanı kesirle aynı ölçekte göstermek olurdu.
 *
 * `formatPrice` PARA grubunda BİRİM KODU OLMADAN çağrılıyor: `AnalyzeRow`
 * (ve `ta.ham`) ENSTRÜMANIN para birimini GÖNDERMİYOR — "TRY" ya da
 * "USD" varsaymak uydurma olurdu, o yüzden simge yok, birim etikette
 * yazılı.
 */
type HamBirim = 'para' | 'puan' | 'fark' | 'hacim' | 'kat' | 'bar';

const BIRIM_NOTU: Record<HamBirim, string> = {
  para: 'PARA (enstrümanın kendi birimi — uç birim kodu göndermiyor)',
  puan: '0-100 puan',
  fark: 'fiyat birimi fark',
  hacim: 'HACİM (adet)',
  kat: 'birimsiz kat',
  bar: 'bar sayısı',
};

function hamBicim(birim: HamBirim, deger: number): string {
  if (birim === 'para') return formatPrice(deger);
  if (birim === 'hacim') return formatCompact(deger);
  if (birim === 'puan') return formatOran(deger, 1);
  if (birim === 'fark') return formatOran(deger, 3);
  if (birim === 'bar') return formatOran(deger, 0);
  return formatOran(deger, 2);
}

/**
 * Ham sözlüğün EKRAN DÜZENİ: birime göre alt bölümler, her alanın
 * Türkçe adı ve HAM ANAHTARI. Anahtarlar `TaHam` türünden — uca yeni
 * alan girer de burada karşılığı olmazsa derleme ile yakalanmıyor ama
 * sıralama/yorum taşımadığı için motorla çelişemez.
 *
 * `fibYon`, `mumKodu`, `mumSinyali` BU TABLODA YOK: üçü de MAKİNE KODU,
 * sayı değil — aşağıda ayrı basılıyorlar.
 */
const HAM_BOLUMLER: {
  baslik: string;
  birim: HamBirim;
  /** Pencereye bağlı alanları taşıyan bölüm mü (etikette yazılıyor). */
  pencereye_bagli?: boolean;
  alanlar: [keyof TaHam, string][];
}[] = [
  {
    baslik: 'Fiyat ve ortalamalar',
    birim: 'para',
    alanlar: [
      ['fiyat', 'Son kapanış'],
      ['ema20', 'EMA 20'],
      ['sma50', 'SMA 50'],
      ['sma200', 'SMA 200'],
      ['bollUst', 'Bollinger üst'],
      ['bollOrta', 'Bollinger orta'],
      ['bollAlt', 'Bollinger alt'],
      ['atr', 'ATR'],
      ['tenkan', 'Tenkan'],
      ['kijun', 'Kijun'],
      ['senkouA', 'Senkou A'],
      ['senkouB', 'Senkou B'],
    ],
  },
  {
    baslik: 'Salınım göstergeleri',
    birim: 'puan',
    alanlar: [
      ['rsi', 'RSI'],
      ['rsi3Once', 'RSI (3 bar önce)'],
      ['stochK', 'Stokastik %K'],
      ['stochD', 'Stokastik %D'],
      ['adx', 'ADX'],
      ['plusDI', '+DI'],
      ['minusDI', '−DI'],
    ],
  },
  {
    baslik: 'MACD',
    birim: 'fark',
    alanlar: [
      ['macdCizgi', 'MACD çizgisi'],
      ['macdSinyal', 'MACD tetik çizgisi'],
      ['macdHist', 'Histogram'],
      ['macdHistOnceki', 'Histogram (bir önceki bar)'],
    ],
  },
  {
    baslik: 'Hacim',
    birim: 'hacim',
    alanlar: [
      ['obv', 'OBV'],
      ['obv20Once', 'OBV (20 bar önce)'],
    ],
  },
  {
    baslik: 'Fibonacci penceresi',
    birim: 'para',
    pencereye_bagli: true,
    alanlar: [
      ['fibHi', 'Pencere tepesi'],
      ['fibLo', 'Pencere dibi'],
      ['fibFark', 'Tepe − dip farkı (uç ölçtü)'],
    ],
  },
  {
    baslik: 'Hacim profili',
    birim: 'para',
    pencereye_bagli: true,
    alanlar: [
      ['vpPoc', 'Denge noktası (POC)'],
      ['vpVah', 'Değer alanı üst sınırı'],
      ['vpVal', 'Değer alanı alt sınırı'],
    ],
  },
  {
    baslik: 'Emir akışı (tahmini) — oran',
    birim: 'puan',
    pencereye_bagli: true,
    alanlar: [['ofAlisYuzde', 'Alış tarafı payı']],
  },
  {
    baslik: 'Emir akışı (tahmini) — hacim',
    birim: 'hacim',
    pencereye_bagli: true,
    alanlar: [
      ['ofCvdDegisim', 'Kümülatif delta eğimi'],
      ['ofBugunDelta', 'Günün deltası'],
    ],
  },
  {
    baslik: 'Emir akışı (tahmini) — fiyat eğimi',
    birim: 'para',
    pencereye_bagli: true,
    alanlar: [['ofFiyatDegisim', 'Aynı penceredeki fiyat eğimi']],
  },
  {
    baslik: 'Emir akışı (tahmini) — kat',
    birim: 'kat',
    pencereye_bagli: true,
    alanlar: [['ofBugunZ', 'Günün deltasının kat ölçüsü']],
  },
  {
    baslik: 'Pencere uzunlukları',
    birim: 'bar',
    alanlar: [
      ['bar', 'Okunan mum sayısı'],
      ['ichiBase', 'Ichimoku kaydırma uzunluğu'],
      ['ofPencere', 'Emir akışı penceresi'],
    ],
  },
];

/**
 * Kapalı hâldeki özet satırının sayıları. BURADA ÖLÇÜM HESABI YOK:
 * ikisi de yukarıdaki SABİT yerleşim tablosunun uzunluğu (kaç bölüm
 * basıyoruz, kaç alan basıyoruz), uçtan gelen bir sayının türevi değil.
 * Sabit olarak tutuluyor ki özet metni "11" / "42" diye elle yazılmasın
 * ve tabloya alan eklendiğinde kendiliğinden güncellensin.
 */
const HAM_BOLUM_SAYISI = HAM_BOLUMLER.length;
const HAM_ALAN_SAYISI = HAM_BOLUMLER.reduce((n, b) => n + b.alanlar.length, 0);

/**
 * ÜÇ DAL AYRI: anahtar gövdede HİÇ YOK (`undefined`) → "uç göndermedi"
 * (eski uç sürümü) · `null` → "ölçemedi" · sayı → basılır. `0`
 * GEÇERLİ bir OBV/MACD değeri, o yüzden `0` ile `null` ayrı ele alınıyor.
 */
function hamDurum(ham: TaHam, anahtar: keyof TaHam): { deger: number | null; gonderildi: boolean } {
  const gonderildi = anahtar in ham;
  const v = ham[anahtar];
  return { deger: typeof v === 'number' && Number.isFinite(v) ? v : null, gonderildi };
}

export type TeknikKartProps = {
  satir: AnalyzeRow;
};

export function TeknikKart({ satir }: TeknikKartProps) {
  const { colors } = useTheme();
  const ta = satir.ta;
  const dokum = ta.breakdown ?? [];
  // ÜÇ DAL: alan gövdede YOK (`undefined`, eski uç) · `null`
  // (ölçülemedi) · sözlük (ölçüldü). Boş sözlük UYDURULMUYOR.
  const hamSorulmus = 'ham' in ta;
  const ham: TaHam | null = ta.ham ?? null;

  return (
    <Card
      title="📈 Teknik analiz"
      subtitle="Göstergeler ve ağırlıkları motordan; istemci hiçbirini toplamaz."
      right={ta.regime ? <Pill label={ta.regime} tone="info" glyph={null} size="sm" /> : null}>
      <ScoreGauge score={ta.score} caption="Teknik" band={ta.label ?? undefined} />

      {/* Sebep YALNIZ uçtan: "ölçülemedi" cümlesini biz yazmıyoruz. */}
      {ta.score === null && ta.why ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Teknik üretilmedi: ' + ta.why}
        </Text>
      ) : null}

      {/* Künye: kaç mumla ölçüldü, ADX kaç. Yorum YOK — çıplak sayı. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'ADX ' +
          (typeof ta.adx === 'number' ? formatOran(ta.adx) : EMPTY) +
          ' · ' +
          (typeof ta.bars === 'number' ? ta.bars : EMPTY) +
          ' mum' +
          (typeof ta.benchBars === 'number' ? ' · endeks ' + ta.benchBars + ' mum' : '')}
      </Text>

      {dokum.length ? (
        // TASARIM TURU 1: döküm VARSAYILAN AÇIK. Gerekçe: "neden 63"
        // sorusunun cevabı bu liste — skorun birincil açıklaması, ham
        // sözlük gibi ikincil künye değil. Katlanır olması uzun listeyi
        // kapatma imkânını yine veriyor.
        <Katlanir
          baslik="Gösterge dökümü"
          ozet={dokum.length + ' gösterge ölçüldü'}
          birim="alt skor 0-100"
          acikBaslangic>
          {/* Alt-skor 0-100: motorun gönderdiği sayı, ölçek değişmez.
              "/100" ARTIK SATIRDA DEĞİL başlıkta: 12 satırda 12 kez
              tekrar etmek yerine bölüm başına bir kez. */}
          {dokum.map((b) => (
            <Satir
              key={b.key}
              etiket={TA_ETIKET[b.key] ?? b.key}
              not={'ağırlık ' + formatOran(b.weight)}
              deger={formatScore(b.score)}
              erisimEtiketi={
                (TA_ETIKET[b.key] ?? b.key) +
                ' alt skoru ' +
                formatScore(b.score) +
                ', ağırlık ' +
                formatOran(b.weight)
              }
            />
          ))}
        </Katlanir>
      ) : (
        // Döküm gelmemiş olması HATA DEĞİL: skor üretilmediyse döküm de
        // yoktur. "veri yok" kutusu bunu olduğu gibi söyler.
        <VeriYok metin="Gösterge dökümü bu turda gelmedi." kartsiz />
      )}

      {/* ---------- HAM GÖSTERGE SÖZLÜĞÜ ---------- */}
      {/* TASARIM TURU 1: 11 bölüm / 42 alan VARSAYILAN KAPALI. Hiçbir
          alan silinmedi — kapalı hâlde özet satırı içeride ne olduğunu
          söylüyor, isteyen açıyor. Üç dal (göndermedi / ölçemedi /
          sözlük) kapağın İÇİNDE aynen duruyor. */}
      <View style={styles.ham}>
        <Katlanir
          baslik="Ham gösterge değerleri"
          ozet={
            HAM_BOLUM_SAYISI + ' bölüm · ' + HAM_ALAN_SAYISI + ' sayısal alan + örüntü kodları'
          }>
          {!hamSorulmus ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Uç bu turda ham sözlüğü GÖNDERMEDİ (alan gövdede hiç yok).
            </Text>
          ) : ham === null ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Ham sözlük ÖLÇÜLEMEDİ (uç bu alanı null döndürdü) — göstergelerin
              sıfır olduğu anlamına GELMEZ.
            </Text>
          ) : (
            <View style={styles.hamIc}>
              {/* PENCERE AYRIMI ETIKETTE: uç bu sözlüğü 5y/1d penceresinde
                  ölçüyor, web kartı ise görünen periyodu kullanıyor.
                  "Pencereye bağlı" işaretli bölümler BU YÜZDEN web kartıyla
                  AYNI SAYIYI VERMEZ — karşılaştırmadan önce okunan mum
                  sayısına bak. */}
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Uç bu değerleri 5 yıl / günlük mum penceresinde ölçtü; okunan mum: ' +
                  (typeof ham.bar === 'number' ? formatOran(ham.bar, 0) : EMPTY) +
                  '. "Pencereye bağlı" işaretli bölümler web kartıyla AYNI SAYIYI VERMEZ, ' +
                  'çünkü web görünen periyodu kullanıyor. Sayılar uçtan geldiği gibi; ' +
                  'burada hiçbir oran, fark ya da eşik hesaplanmıyor.'}
              </Text>

              {HAM_BOLUMLER.map((bolum) => (
                <View key={bolum.baslik} style={styles.hamBolum}>
                  {/* BİRİM BURADA, SATIRDA DEĞİL: bölümün 12 satırı aynı
                      birimi paylaşıyor; birim bölüm başına BİR kez yazılıyor.
                      Satırın notunda yalnız ham alan adı kalıyor (uçla
                      karşılaştırırken gereken tek künye). */}
                  <OlcumBaslik
                    baslik={bolum.baslik}
                    birim={BIRIM_NOTU[bolum.birim]}
                    not={bolum.pencereye_bagli ? 'PENCEREYE BAĞLI' : null}
                  />
                  {bolum.alanlar.map(([anahtar, etiket]) => {
                    const durum = hamDurum(ham, anahtar);
                    const metin = !durum.gonderildi
                      ? 'uç göndermedi'
                      : durum.deger === null
                        ? 'ölçemedi'
                        : hamBicim(bolum.birim, durum.deger);
                    return (
                      <Satir
                        key={String(anahtar)}
                        etiket={etiket}
                        not={String(anahtar)}
                        deger={durum.gonderildi && durum.deger !== null ? metin : EMPTY}
                        erisimEtiketi={
                          etiket + ': ' + metin + ' (' + BIRIM_NOTU[bolum.birim] + ')'
                        }
                      />
                    );
                  })}
                </View>
              ))}

              {/* MAKİNE KODLARI — sayı değil, o yüzden biçimleyici yok.
                  Bilinmeyen kod HAM basılıyor. */}
              <View style={styles.hamBolum}>
                <OlcumBaslik
                  baslik="Son mum örüntüsü ve yön kodları"
                  birim="makine kodu, sayı değil"
                  not="sabit küme"
                />
                <Satir
                  etiket="Mum örüntüsü"
                  not="mumKodu"
                  deger={
                    ham.mumKodu === null || ham.mumKodu === undefined
                      ? EMPTY
                      : (MUM_ETIKET[ham.mumKodu] ?? ham.mumKodu)
                  }
                  erisimEtiketi={
                    'Mum örüntüsü: ' +
                    (ham.mumKodu == null
                      ? 'örüntü yok ya da ölçülemedi'
                      : (MUM_ETIKET[ham.mumKodu] ?? ham.mumKodu))
                  }
                />
                <Satir
                  etiket="Örüntü yönü"
                  not="mumSinyali"
                  deger={
                    ham.mumSinyali === null || ham.mumSinyali === undefined
                      ? EMPTY
                      : (MUM_YON_ETIKET[ham.mumSinyali] ?? ham.mumSinyali)
                  }
                />
                <Satir
                  etiket="Fibonacci penceresinin yönü"
                  not="fibYon · PENCEREYE BAĞLI"
                  deger={
                    ham.fibYon === null || ham.fibYon === undefined
                      ? EMPTY
                      : (FIB_YON_ETIKET[ham.fibYon] ?? ham.fibYon)
                  }
                />
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  Örüntü alanları boş olabilir: son barda örüntü bulunmadığında uç
                  null döndürüyor — bu bir ölçüm cevabı, hata değil.
                </Text>
              </View>
            </View>
          )}
        </Katlanir>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  ham: { paddingTop: space.md },
  // İç sözlük: bölümler arası boşluk. Bölüm başlığının kendi üst boşluğu
  // `OlcumBaslik` içinde (tek yerde) duruyor.
  hamIc: { gap: space.xs },
  hamBolum: { gap: space.xxs },
});
