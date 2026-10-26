// =====================================================================
//  FiyatGrafigi — /api/chart serisi: mum + hacim + crosshair  (FAZ 2/native)
// ---------------------------------------------------------------------
//  NE: `/api/chart` cevabının (`mumlar[]`) MUM GÖVDELERİ (gövde + fitil),
//  altta ayrı ölçekli HACİM şeridi, dokunmatik CROSSHAIR (dokunulan
//  mumun tarihi + açılış/yüksek/düşük/kapanış künyesi), isteğe bağlı
//  ALIM/SATIM BANDI şeridi, iki fiyat etiketi (en az / en çok) ve iki
//  tarih etiketi (ilk / son).
//
//  NEDEN SUNUM KATMANI, HESAP DEĞİL: burada yapılan tek matematik
//  ÖLÇEKLEME (fiyat → piksel, dizin → piksel, hacim → piksel). Hareketli
//  ortalama, RSI, trend çizgisi, destek/direnç YOK ve olmayacak — onlar
//  motorun işi (`/api/analyze` → `plan.seviye.sma50` gibi). Bir gösterge
//  bu dosyada hesaplanırsa web ile native iki ayrı gösterge üretmeye
//  başlar; projenin "tek doğruluk kaynağı motor API" kuralı kırılır.
//
//  NEDEN TEK İSTİSNA "aralık değişimi": çizginin/başlığın rengi ve ▲/▼
//  işareti bir yöne ihtiyaç duyuyor. Yön, serinin İLK ve SON kapanışının
//  ham yüzde farkından geliyor — eşik tablosu, bant ya da sinyal DEĞİL.
//  Eşik (±0,05 altı "yatay") `theme/signal.ts`'te tek yerde duruyor.
//
//  NEDEN `react-native-svg`: ÖLÇÜLDÜ — `mobile/package.json:29`
//  `react-native-svg: 15.15.4`. Web tarafı (`index.html:631`) unpkg'den
//  `lightweight-charts@4.2.0` çekiyor ve `LightweightCharts.createChart`
//  ile çiziyor (`app.js:4028` civarı); o kütüphane DOM `<canvas>` ister,
//  React Native'de çalışmaz. Bu dosya onun native karşılığı: aynı görsel
//  kararlar (mum ↑/↓ iki renk, bant yarı saydam dikdörtgen + kesikli
//  kenar, crosshair) SVG ile yeniden kuruldu. YENİ BAĞIMLILIK EKLENMEDİ.
//
//  NEDEN `PanResponder`, `Gesture.Pan` DEĞİL: ÖLÇÜLDÜ —
//  `react-native-gesture-handler: ~2.32.0` package.json:25'te KURULU,
//  ama `grep -rn "GestureHandlerRootView" mobile/src mobile/app.json`
//  HİÇBİR SONUÇ vermiyor ve `src` içinde paketi kullanan tek dosya yok.
//  Kök sarmalayıcı olmadan `Gesture.Pan` iOS'ta sessizce hiç tetiklenmez
//  ve kökü kurmak bu şeridin dokunmadığı bir dosyayı (`src/app/_layout`)
//  değiştirmek olurdu. `PanResponder` RN çekirdeğinde (`react-native`
//  0.86.3) var, kök kurulum istemez. Dikey sürüklemede
//  `onPanResponderTerminationRequest` `true` dönüyor → kart bir
//  `ScrollView` içindeyken kaydırma ÇALIŞMAYA DEVAM EDER; yalnız yatay
//  sürükleme ve dokunma crosshair'e gider.
//
//  NEDEN MUM EŞİĞİ (`MUM_AZAMI`): ÖLÇÜLDÜ — 375 px telefonda kartın
//  içi ≈ 327 px. 6mo günlük seri ≈ 126 mum → mum başına 2,6 px yuva;
//  1y ≈ 252 mum → 1,3 px; 5y ≈ 1250 mum → 0,26 px, yani gövde ile fitil
//  aynı piksele düşer (mum "çizilmiş" görünür ama okunmaz) ve 2500 SVG
//  düğümü mobilde kare düşürür. Eşik 140: 1mo/3mo/6mo mum kalır,
//  1y/5y otomatik kapanış çizgisine düşer ve bu karar kullanıcıya tek
//  satırla SÖYLENİR — sessiz düşüş yalan olurdu.
//
//  NEDEN RENK TEK İŞARET DEĞİL: yükseliş mumu DOLU, düşüş mumu İÇİ BOŞ
//  (kart zemini + renkli kenar). Renk körü kullanıcı dolu/boş ayrımını
//  görür; ayrıca üstteki rozet ok (▲/▼) ve söz ("artış"/"düşüş") basıyor.
//
//  NEDEN `Durum` KOMPONENTİ (FAZ 3'te değişti): burada yerel bir
//  `HataGovde` vardı ve hata türlerini `kind !== 'no-data'` diye İKİYE
//  bölüyordu, yani `bad-request` (400 `bad_symbol`) "ölçemedim" kutusuna
//  düşüp işe yaramayan bir "Yeniden dene" düğmesi alıyordu. `Durum`a
//  `kartsiz` prop'u eklendi: kendi `Card`ını çizmiyor, bu kartın İÇİNDE
//  basılıyor.
//
//  ── AYRI HÂL, AYRI CÜMLE ──────────────────────────────────────────
//   ① yükleniyor            → grafik şeklinde iskelet
//   ② hata                  → `Durum`: dört türün dördü ayrı kutu
//   ③ 200 + `adet === 0`    → "bu aralıkta mum yok" — ARIZA DEĞİL,
//      veri cevabı. Bunu "ölçemedim" diye göstermek YALAN olurdu
//      (yeni halka arz / kapalı pazar bunu normal olarak üretir).
//   ④ `volume` gelmedi      → hacim şeridi HİÇ ÇİZİLMEZ ve "hacim
//      gelmedi" denir. Sıfır yüksekliğinde sütun çizmek "hacim yoktu"
//      diye okunur; ölçülmemişle sıfır aynı şey değil.
//  Ayrıca 200 gelse bile `tam === false` ise grafiğin ÜSTÜNDE "ölçüm
//  eksik" rozeti var — eksik seriyi sessizce çizmek en sinsi yalan.
//
//  NEDEN YASAL NOT BURADA YOK: ÖLÇÜLDÜ — bu kart `src/app/(tabs)/
//  analiz.tsx:189` içinde `ScreenShell`in altında basılıyor ve
//  `ScreenShell.tsx:68` zaten `Disclaimer` yazıyor. İkinci kez basmak
//  aynı cümleyi iki yerde tutmak olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Fragment, useMemo, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Card } from './Card';
import { Dugme } from './Dugme';
import { Durum, OlcumNotu } from './Durum';
import { Pill } from './Pill';
import { SkeletonChart } from './Skeleton';
import type { ApiError } from '@/api/client';
import type { IstekDurum } from '@/api/istek';
import { ARALIKLAR, olcumEksik, type Aralik, type ChartResponse, type Mum } from '@/api/types';
import {
  formatCompact,
  formatGunAy,
  formatGunAySaat,
  formatGunAyYil,
  formatPercent,
  formatPrice,
} from '@/lib/format';
import { numeric, radius, signalOf, space, toneColors, type, useTheme } from '@/theme';

/** Çizim alanı yüksekliği (piksel). Eksen etiketleri bunun dışında. */
const GRAFIK_YUKSEKLIK = 168;

/** Çizgi kalınlığı — mobilde 2 px ince ekranda kaybolmuyor, 3 kabalaşıyor. */
const CIZGI = 2;

/** Üst/alt nefes payı: çizgi kenara yapışınca kırpılmış görünür. */
const PAY = 6;

/**
 * Mum gövdesi çizilen EN ÇOK mum sayısı. Üstünde otomatik kapanış
 * çizgisine düşülür (sebep dosya başındaki "NEDEN MUM EŞİĞİ" bloğunda
 * ölçüldü: 375 px telefonda 140 mum ≈ 2,3 px yuva, altı okunmaz).
 */
const MUM_AZAMI = 140;

/** Hacim şeridinin çizim alanındaki payı — görevde verilen ~%18. */
const HACIM_ORAN = 0.18;

/** Hacim şeridi ile fiyat alanı arasındaki boşluk (eksenler karışmasın). */
const HACIM_BOSLUK = 6;

/** Doji (open === close): gövde 0 px olurdu, hiç görünmezdi. */
const MUM_EN_AZ_GOVDE = 1;

/** Fitil kalınlığı — gövdeden ince olmalı, yoksa mum dikdörtgene döner. */
const FITIL = 1;

/**
 * Aralık seçicide gösterilenler. `1d` BİLEREK YOK: günlük adımda (`1d`
 * interval) tek günlük aralık bir ya da sıfır mum verir, yani grafik
 * değil nokta olur. Gün-içi grafiği ayrı bir adım (`5m`/`15m`) ister ve
 * bu komponent günlük seriye kurulu.
 */
const SECILEBILIR: readonly Aralik[] = ARALIKLAR.filter((a) => a !== '1d');

/** Çok yıllı aralıkta yıl olmadan tarih etiketi yanıltıcı olur. */
const YIL_GEREKEN: readonly Aralik[] = ['1y', '5y'];

/**
 * Gün-içi aralık: tarih tek başına AYIRT ETMİYOR — aynı günün 5m/15m/60m
 * mumlarının hepsi "24 Eki" basar ve imleç hangi mumun üzerinde olduğunu
 * söylemez. ÖLÇÜLDÜ: `ARALIKLAR` içinde gün-içi olan tek değer `'1d'`
 * (api/types.ts:398); o yüzden küme tek elemanlı ve liste hâlinde —
 * sözleşmeye ikinci bir gün-içi aralık eklenirse buraya yazılır.
 *
 * `'1d'` grafiğin kendi çip satırında SEÇİLEMEZ (`SECILEBILIR`), ama
 * `aralik` bir PROP: çağıran gün-içi seriyi geçirebilir.
 */
const SAAT_GEREKEN: readonly Aralik[] = ['1d'];

/**
 * Alım/satım bandı — `/api/recommend` → `plan.seviye.buyZone/sellZone`.
 * BU KOMPONENT KENDİ ÇEKMEZ: prop olarak alır, ağ çağrısı eklenmedi.
 * Verilmezse hiçbir şey çizilmez; uydurma bant yok.
 */
export type GrafikBant = {
  buyZone?: readonly number[] | number[] | null;
  sellZone?: readonly number[] | number[] | null;
};

export type FiyatGrafigiProps = {
  /** Hangi sembolün serisi — başlıkta görünür. */
  sembol: string;
  /** Para birimi için: BIST → TRY. Künyeden gelen `currency` önce gelir. */
  market?: 'US' | 'BIST';
  durum: IstekDurum;
  veri: ChartResponse | null;
  hata: ApiError | null;
  yenile: () => void;
  /** Yürürlükteki aralık — seçici bunu vurgular. */
  aralik: Aralik;
  onAralik: (a: Aralik) => void;
  /** Motorun alım/satım bandı. Yoksa şerit çizilmez (bkz. `GrafikBant`). */
  bant?: GrafikBant | null;
};

/** Tek mumun piksel karşılığı — saf sunum verisi. */
type MumCizim = {
  /** Gövde dikdörtgeninin sol kenarı. */
  x: number;
  w: number;
  govdeUst: number;
  govdeYuk: number;
  /** Fitil: yüksek → düşük. Gövdenin ortasından geçer. */
  orta: number;
  fitilUst: number;
  fitilAlt: number;
  /** `close >= open` → dolu gövde; değilse içi boş. */
  yukselis: boolean;
};

/** Tek hacim sütununun piksel karşılığı. Fiyat ekseninden AYRI ölçek. */
type HacimCizim = {
  x: number;
  w: number;
  ust: number;
  yuk: number;
  yukselis: boolean;
};

/** Ölçekleme sonucu — saf sunum verisi. */
type Cizim = {
  /** Çizime giren (geçerli) mumlar; crosshair bunların üzerinde gezer. */
  noktalar: Mum[];
  cizgi: string;
  alan: string;
  /** `null` → mum eşiği aşıldı, kapanış çizgisi gösteriliyor. */
  mumlar: MumCizim[] | null;
  /** Eşik aşıldığı için çizgiye düşüldü mü (kullanıcıya söylenir). */
  kalabalik: boolean;
  /** `null` → hiç geçerli `volume` gelmedi; şerit çizilmez. */
  hacim: HacimCizim[] | null;
  /** Fiyat alanının yüksekliği (hacim şeridi varsa kısalır). */
  fiyatYuk: number;
  /** Bir mumun yatay yuvası (piksel) — crosshair dizin çözümü için. */
  slot: number;
  /** Fiyat → piksel. Crosshair ve bant şeridi de bunu kullanır. */
  yFiyat: (p: number) => number;
  /** Dizin → mum merkezi (piksel). */
  xDizin: (i: number) => number;
  enAz: number;
  enCok: number;
  /** Ölçek uçları kapanıştan mı, yüksek/düşükten mi geldi (etiket sözü). */
  olcekFitilden: boolean;
  ilkZaman: number;
  sonZaman: number;
  ilkKapanis: number;
  sonKapanis: number;
  /** İlk → son kapanış ham yüzde farkı (yalnız renk/ok için). */
  degisimYuzde: number | null;
};

/** Sonlu sayı mı — `null`/`NaN`/`±Infinity` hepsi burada elenir. */
function say(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Dokunulan X → en yakın mumun dizini. Saf aritmetik, durum tutmaz;
 * `PanResponder` kapanışından çağrıldığı için modül düzeyinde.
 */
function dizinBul(x: number, slot: number, adet: number): number | null {
  if (!say(x) || !(slot > 0) || adet < 1) return null;
  const i = Math.round(x / slot - 0.5);
  return Math.min(adet - 1, Math.max(0, i));
}

/**
 * Seriyi SVG yollarına / dikdörtgenlerine çevirir. Tek matematik:
 * ölçekleme. `null` döner → çizilecek geçerli nokta yok.
 */
function cizimHesapla(mumlar: Mum[], genislik: number): Cizim | null {
  // Tip `number` diyor ama çalışma zamanı güvencesi değil: NaN/null bir
  // mum tüm yolu bozar (`M NaN,NaN` → hiç çizilmez).
  const noktalar = mumlar.filter((m) => m && say(m.close) && say(m.time));
  if (noktalar.length < 2 || !(genislik > 0)) return null;

  const adet = noktalar.length;
  // Eşik kararı: üstünde mum gövdesi çizilmez (sebep: MUM_AZAMI yorumu).
  const mumCiz = adet <= MUM_AZAMI;

  // Hacim AYRI ÖLÇEK ve AYRI VARLIK sorusu: tip `number` dese de uçtan
  // `null` gelebiliyor. Geçersiz/0 olanlar sütun üretmez; HİÇ geçerli
  // yoksa şerit tamamen yok (0 çizmek "hacim sıfırdı" diye okunurdu).
  const hacimler = noktalar.map((m) => (say(m.volume) && m.volume > 0 ? m.volume : null));
  const gecerliHacim = hacimler.filter((v): v is number => v !== null);
  const hacimVar = gecerliHacim.length > 0;
  const enCokHacim = hacimVar ? Math.max(...gecerliHacim) : 0;

  const hacimYuk = hacimVar ? Math.round(GRAFIK_YUKSEKLIK * HACIM_ORAN) : 0;
  const fiyatYuk = GRAFIK_YUKSEKLIK - (hacimVar ? hacimYuk + HACIM_BOSLUK : 0);

  // Ölçek uçları: mum çizilirken fitiller (high/low) kırpılmasın diye
  // onlardan; çizgi modunda yalnız kapanışlardan (eksen sözüyle uyumlu).
  let enAz = Infinity;
  let enCok = -Infinity;
  for (const m of noktalar) {
    const degerler = mumCiz
      ? [m.close, m.open, m.high, m.low].filter(say)
      : [m.close];
    for (const v of degerler) {
      if (v < enAz) enAz = v;
      if (v > enCok) enCok = v;
    }
  }
  if (!say(enAz) || !say(enCok)) return null;

  // Düz seri (enAz === enCok): sıfıra bölmeyi engelle, çizgiyi ortala.
  const aralikFiyat = enCok - enAz;
  const ic = Math.max(1, fiyatYuk - PAY * 2);

  const slot = genislik / adet;
  const xDizin = (i: number) => (i + 0.5) * slot;
  const yFiyat = (p: number) =>
    aralikFiyat > 0 ? PAY + (1 - (p - enAz) / aralikFiyat) * ic : PAY + ic / 2;

  // Gövde/sütun genişliği yuvanın %68'i: komşu mumlar arasında boşluk
  // kalsın. 14 px üst sınır, az mumda (1mo ≈ 21) kalın bloklar olmasın.
  const govdeW = Math.max(0.8, Math.min(slot * 0.68, 14));

  let cizgi = '';
  for (let i = 0; i < adet; i += 1) {
    cizgi +=
      (i === 0 ? 'M' : 'L') + xDizin(i).toFixed(2) + ',' + yFiyat(noktalar[i].close).toFixed(2);
    if (i < adet - 1) cizgi += ' ';
  }
  // Alan dolgusu: aynı yol, iki kenara kadar uzatılıp tabana kapanıyor
  // (mum merkezleri 0 ve `genislik`e değmediği için kenarda boşluk kalmasın).
  const alan =
    cizgi +
    ' L' +
    genislik.toFixed(2) +
    ',' +
    yFiyat(noktalar[adet - 1].close).toFixed(2) +
    ' L' +
    genislik.toFixed(2) +
    ',' +
    fiyatYuk +
    ' L0,' +
    fiyatYuk +
    ' L0,' +
    yFiyat(noktalar[0].close).toFixed(2) +
    ' Z';

  const mumCizim: MumCizim[] | null = mumCiz
    ? noktalar.map((m, i) => {
        // Eksik alanlar kapanışa düşürülür: uydurma değil, "bu mumda o
        // ölçü gelmedi" hâlinin çizimdeki en dürüst karşılığı (gövde
        // yassılır, fitil uzamaz). Künye satırı eksik olanı `—` basar.
        const o = say(m.open) ? m.open : m.close;
        const c = m.close;
        const hi = say(m.high) ? Math.max(m.high, o, c) : Math.max(o, c);
        const lo = say(m.low) ? Math.min(m.low, o, c) : Math.min(o, c);
        const yO = yFiyat(o);
        const yC = yFiyat(c);
        const orta = xDizin(i);
        return {
          x: orta - govdeW / 2,
          w: govdeW,
          govdeUst: Math.min(yO, yC),
          govdeYuk: Math.max(MUM_EN_AZ_GOVDE, Math.abs(yC - yO)),
          orta,
          fitilUst: yFiyat(hi),
          fitilAlt: yFiyat(lo),
          yukselis: c >= o,
        };
      })
    : null;

  const hacimCizim: HacimCizim[] | null = hacimVar
    ? noktalar
        .map((m, i) => {
          const v = hacimler[i];
          if (v === null) return null;
          const h = Math.max(1, (v / enCokHacim) * hacimYuk);
          const o = say(m.open) ? m.open : m.close;
          return {
            x: xDizin(i) - govdeW / 2,
            w: govdeW,
            ust: GRAFIK_YUKSEKLIK - h,
            yuk: h,
            yukselis: m.close >= o,
          };
        })
        .filter((b): b is HacimCizim => b !== null)
    : null;

  const ilkKapanis = noktalar[0].close;
  const sonKapanis = noktalar[adet - 1].close;
  const degisimYuzde = ilkKapanis > 0 ? ((sonKapanis - ilkKapanis) / ilkKapanis) * 100 : null;

  return {
    noktalar,
    cizgi,
    alan,
    mumlar: mumCizim,
    kalabalik: !mumCiz,
    hacim: hacimCizim,
    fiyatYuk,
    slot,
    yFiyat,
    xDizin,
    enAz,
    enCok,
    olcekFitilden: mumCiz,
    ilkZaman: noktalar[0].time,
    sonZaman: noktalar[adet - 1].time,
    ilkKapanis,
    sonKapanis,
    degisimYuzde,
  };
}

/**
 * Bant [alt, üst] → çizim alanına KIRPILMIŞ dikdörtgen. Bant görünür
 * fiyat aralığının tamamen dışındaysa `null` döner: kenara yapıştırılmış
 * bir şerit "bant tam burada" diye okunurdu.
 */
function bantDikdortgen(
  z: readonly number[] | number[] | null | undefined,
  cizim: Cizim,
): { ust: number; yuk: number } | null {
  if (!Array.isArray(z) || z.length < 2) return null;
  const a = z[0];
  const b = z[1];
  if (!say(a) || !say(b)) return null;
  const y1 = cizim.yFiyat(Math.max(a, b));
  const y2 = cizim.yFiyat(Math.min(a, b));
  const ust = Math.max(0, Math.min(y1, y2));
  const alt = Math.min(cizim.fiyatYuk, Math.max(y1, y2));
  if (!(alt > ust)) return null;
  return { ust, yuk: alt - ust };
}

export function FiyatGrafigi({
  sembol,
  market,
  durum,
  veri,
  hata,
  yenile,
  aralik,
  onAralik,
  bant,
}: FiyatGrafigiProps) {
  const { colors } = useTheme();
  // Genişlik ölçülmeden çizilemez: SVG viewBox'ı gerçek piksele oturmalı,
  // yoksa yol kartın dışına taşar. İlk çerçevede 0, `onLayout` sonrası
  // gerçek değer gelir.
  const [genislik, setGenislik] = useState(0);
  /** Crosshair'in durduğu mumun dizini. `null` → dokunulmadı. */
  const [izlenen, setIzlenen] = useState<number | null>(null);
  const [izAralik, setIzAralik] = useState<Aralik>(aralik);

  // Aralık değişti → eski dizin başka bir tarihi işaret ediyor olurdu.
  // React'in onayladığı "render sırasında türetilmiş durumu düzelt" kalıbı
  // (useEffect bir çerçeve geç kalır ve o çerçevede YANLIŞ künye basılır).
  if (izAralik !== aralik) {
    setIzAralik(aralik);
    setIzlenen(null);
  }

  const olc = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== genislik) setGenislik(w);
  };

  const cizim = useMemo(
    () => (veri?.mumlar?.length ? cizimHesapla(veri.mumlar, genislik) : null),
    [veri, genislik],
  );

  // NEDEN `useMemo`, `useRef` DEĞİL: ÖLÇÜLDÜ — `useRef(PanResponder
  // .create(...)).current` yazıldığında `npx expo lint` üç `react-hooks/
  // refs` HATASI verdi ("Cannot access refs during render", 447/450/610).
  // Kural haklı: `panHandlers` render sırasında okunuyor. `useMemo` ile
  // responder yalnız ÖLÇÜ DEĞİŞİNCE (yuva genişliği / mum sayısı)
  // yeniden kuruluyor — sürükleme sırasında bu ikisi sabit olduğu için
  // el değiştirme olmuyor, `setIzlenen` ise zaten kararlı.
  const slot = cizim?.slot ?? 0;
  const mumAdet = cizim?.noktalar.length ?? 0;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Dokunma da bir okuma: tek parmak basınca o mumun künyesi gelir.
        onStartShouldSetPanResponder: () => true,
        // Yatay sürükleme crosshair, dikey sürükleme kaydırma.
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy),
        // Kart bir `ScrollView` içinde: dikey kaydırma isteği gelirse bırak.
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: (e) => setIzlenen(dizinBul(e.nativeEvent.locationX, slot, mumAdet)),
        onPanResponderMove: (e) => setIzlenen(dizinBul(e.nativeEvent.locationX, slot, mumAdet)),
      }),
    [slot, mumAdet],
  );

  const kur = veri?.kunye?.currency ?? (market === 'BIST' ? 'TRY' : null);
  const sinyal = signalOf(cizim?.degisimYuzde);
  const ton = toneColors(colors, sinyal.tone);
  // NEDEN `toLocaleDateString` YOK: Hermes'te `Intl` sınırlı ve biçim tek
  // yerden gelmeli — `lib/format.ts`. Burada kendi biçimleyicimizi yazmak
  // yasak (iki doğruluk kaynağı doğar). Üç biçim, aralığa göre: gün-içinde
  // saat şart (yoksa imleç hangi mumda olduğunu söylemez), çok yıllıda yıl
  // şart, arada ikisi de gürültü.
  const tarih = SAAT_GEREKEN.includes(aralik)
    ? formatGunAySaat
    : YIL_GEREKEN.includes(aralik)
      ? formatGunAyYil
      : formatGunAy;

  // SVG `id` BELGE GENELİNDE tek olmak zorunda: iki grafik yan yana
  // basılırsa sabit bir id ikinci grafiğin dolgusunu birincinin rengiyle
  // boyar (ilk tanım kazanır). Sembol + ton ile ayrıştırıyoruz.
  const alanId = 'fg-' + sembol.replace(/[^A-Z0-9]/gi, '') + '-' + sinyal.tone;

  // Crosshair'in durduğu mum. Dizin seri kısaldıysa aralık dışında
  // kalabilir — o hâlde künye BASILMAZ (yanlış mumun sayısı yalandır).
  const izMum =
    cizim && izlenen !== null && izlenen >= 0 && izlenen < cizim.noktalar.length
      ? cizim.noktalar[izlenen]
      : null;

  const alimBandi = cizim ? bantDikdortgen(bant?.buyZone, cizim) : null;
  const satimBandi = cizim ? bantDikdortgen(bant?.sellZone, cizim) : null;

  const secici = (
    <View style={styles.secici}>
      {SECILEBILIR.map((a) => (
        <Dugme
          key={a}
          label={a}
          size="sm"
          variant={a === aralik ? 'solid' : 'outline'}
          tone={a === aralik ? 'gold' : 'neutral'}
          onPress={() => onAralik(a)}
        />
      ))}
    </View>
  );

  return (
    <Card
      title="Fiyat grafiği"
      subtitle={sembol + ' · ' + (cizim?.mumlar ? 'mum serisi' : 'kapanış serisi') + ' · /api/chart'}
      right={
        cizim ? (
          <Pill
            label={sinyal.arrow + ' ' + formatPercent(cizim.degisimYuzde)}
            tone={sinyal.tone}
            glyph={null}
            size="sm"
          />
        ) : null
      }>
      {secici}

      {durum === 'yukleniyor' ? (
        <>
          <SkeletonChart height={GRAFIK_YUKSEKLIK} />
          <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
            Fiyat serisi ölçülüyor…
          </Text>
        </>
      ) : null}

      {/* NEDEN HATA/BOŞ GÖVDESİ ARTIK `Durum`: burada eskiden yerel bir
          `HataGovde` vardı ve `kind !== 'no-data'` diye İKİYE bölüyordu.
          `/api/chart` 400 `bad_symbol` döndürebiliyor (ÖLÇÜLDÜ: ?symbol=
          ^GSPC) ve o hâlde kullanıcı "ölçemedim" + işe yaramayan bir
          "Yeniden dene" düğmesi görüyordu. Dört türün tek karar yeri
          `Durum`; ikinci bir kopya tutmak o kuralın yarısını kaçırmak
          demekti. `kartsiz`: bu gövde zaten bir `Card` içinde. */}
      {durum === 'bos' || durum === 'hata' ? (
        <Durum
          durum={durum}
          hata={hata}
          yenile={yenile}
          sekil="grafik"
          kartsiz
          bosMetin="Bir sembol seç; seri o zaman istenecek."
        />
      ) : null}

      {durum === 'veri' ? (
        <>
          {olcumEksik(veri) ? (
            <View style={styles.rozet}>
              <Pill label="ölçüm eksik" tone="gold" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textFaint, flex: 1 }]}>
                Seri eksik tamamlandı — grafik bu turda gelen mumları gösteriyor.
              </Text>
            </View>
          ) : null}

          {!veri || veri.adet === 0 ? (
            // 200 + boş seri: VERİ CEVABI. "Yeniden dene" YOK — aynı
            // boş sonuç gelir. Sebep tahmin EDİLMEZ, olasılık söylenir.
            <>
              <Pill label="veri yok" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.small, { color: colors.textDim, marginTop: space.sm }]}>
                {'Bu aralıkta (' + aralik + ') mum yok. Motor ölçtü; seri boş döndü.'}
              </Text>
            </>
          ) : !cizim ? (
            // Seri var ama iki geçerli nokta yok (tek mum / bozuk alanlar)
            // ya da genişlik henüz ölçülmedi.
            <View onLayout={olc} style={styles.tuval}>
              <Text style={[type.small, { color: colors.textDim }]}>
                {veri.adet === 1
                  ? 'Tek mum geldi — çizgi için en az iki kapanış gerekiyor.'
                  : 'Çizim alanı ölçülüyor…'}
              </Text>
            </View>
          ) : (
            <>
              {/* Crosshair künyesi: dokunulan mumun tarihi + O-H-L-C.
                  Dokunulmadan önce ne yapılacağını söyleyen tek satır
                  duruyor — boş alan "burada bir şey yok" diye okunur. */}
              {izMum ? (
                <View style={styles.kunye}>
                  <Text style={[type.micro, numeric, { color: colors.text }]}>
                    {tarih(izMum.time) + ' · Kap ' + formatPrice(izMum.close, kur)}
                  </Text>
                  <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                    {'Aç ' +
                      formatPrice(say(izMum.open) ? izMum.open : null, kur) +
                      ' · Yük ' +
                      formatPrice(say(izMum.high) ? izMum.high : null, kur) +
                      ' · Düş ' +
                      formatPrice(say(izMum.low) ? izMum.low : null, kur)}
                  </Text>
                  <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                    {say(izMum.volume) && izMum.volume > 0
                      ? 'Hacim ' + formatCompact(izMum.volume)
                      : 'Hacim ölçülmedi'}
                  </Text>
                </View>
              ) : (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  Grafiğe dokun ya da parmağını yatay kaydır — o mumun künyesi burada çıkar.
                </Text>
              )}

              <View onLayout={olc} style={styles.tuval} {...pan.panHandlers}>
                {genislik > 0 ? (
                  <Svg
                    width={genislik}
                    height={GRAFIK_YUKSEKLIK}
                    accessibilityLabel={
                      sembol +
                      ' ' +
                      (cizim.mumlar ? 'mum grafiği' : 'kapanış grafiği') +
                      ', ' +
                      aralik +
                      ', ' +
                      sinyal.a11yLabel +
                      ', ' +
                      formatPercent(cizim.degisimYuzde) +
                      (cizim.hacim ? ', hacim şeridi var' : ', hacim gelmedi')
                    }>
                    <Defs>
                      <LinearGradient id={alanId} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={ton.fg} stopOpacity="0.28" />
                        <Stop offset="1" stopColor={ton.fg} stopOpacity="0" />
                      </LinearGradient>
                    </Defs>

                    {/* ① Bant şeritleri EN ALTTA: fiyatın üstünü kapamasın.
                        Web'deki `makeBuyZonePrimitive` (app.js:3866-3889)
                        dolu dikdörtgen + kesikli kenar çiziyor; native
                        karşılığı bu. Prop gelmediyse hiçbiri çizilmez. */}
                    {alimBandi ? (
                      <>
                        <Rect
                          x={0}
                          y={alimBandi.ust}
                          width={genislik}
                          height={alimBandi.yuk}
                          fill={colors.positive}
                          fillOpacity={0.13}
                        />
                        <Line
                          x1={0}
                          y1={alimBandi.ust}
                          x2={genislik}
                          y2={alimBandi.ust}
                          stroke={colors.positive}
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          strokeDasharray="4,3"
                        />
                        <Line
                          x1={0}
                          y1={alimBandi.ust + alimBandi.yuk}
                          x2={genislik}
                          y2={alimBandi.ust + alimBandi.yuk}
                          stroke={colors.positive}
                          strokeOpacity={0.55}
                          strokeWidth={1}
                          strokeDasharray="4,3"
                        />
                      </>
                    ) : null}
                    {satimBandi ? (
                      <Rect
                        x={0}
                        y={satimBandi.ust}
                        width={genislik}
                        height={satimBandi.yuk}
                        fill={colors.negative}
                        fillOpacity={0.11}
                      />
                    ) : null}

                    {/* ② Fiyat: ya mum gövdeleri ya kapanış çizgisi. */}
                    {cizim.mumlar ? (
                      cizim.mumlar.map((m, i) => {
                        const renk = m.yukselis ? colors.positive : colors.negative;
                        return (
                          <Fragment key={i}>
                            <Line
                              x1={m.orta}
                              y1={m.fitilUst}
                              x2={m.orta}
                              y2={m.fitilAlt}
                              stroke={renk}
                              strokeWidth={FITIL}
                            />
                            {/* Dolu = yükseliş, içi boş = düşüş. Renk tek
                                işaret değil (renk körü güvenli). */}
                            <Rect
                              x={m.x}
                              y={m.govdeUst}
                              width={m.w}
                              height={m.govdeYuk}
                              fill={m.yukselis ? renk : colors.bgCard}
                              stroke={renk}
                              strokeWidth={m.yukselis ? 0 : 1}
                            />
                          </Fragment>
                        );
                      })
                    ) : (
                      <>
                        <Path d={cizim.alan} fill={'url(#' + alanId + ')'} />
                        <Path
                          d={cizim.cizgi}
                          fill="none"
                          stroke={ton.fg}
                          strokeWidth={CIZGI}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </>
                    )}

                    {/* ③ Hacim: alt şerit, AYRI ÖLÇEK. `volume` gelmediyse
                        bu dizi `null` ve burada hiçbir şey çizilmez. */}
                    {cizim.hacim?.map((h, i) => (
                      <Rect
                        key={'h' + i}
                        x={h.x}
                        y={h.ust}
                        width={h.w}
                        height={h.yuk}
                        fill={h.yukselis ? colors.positive : colors.negative}
                        fillOpacity={0.45}
                      />
                    ))}

                    {/* ④ Crosshair EN ÜSTTE. */}
                    {izMum && cizim && izlenen !== null ? (
                      <>
                        <Line
                          x1={cizim.xDizin(izlenen)}
                          y1={0}
                          x2={cizim.xDizin(izlenen)}
                          y2={GRAFIK_YUKSEKLIK}
                          stroke={colors.textDim}
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                        <Line
                          x1={0}
                          y1={cizim.yFiyat(izMum.close)}
                          x2={genislik}
                          y2={cizim.yFiyat(izMum.close)}
                          stroke={colors.textDim}
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                        <Circle
                          cx={cizim.xDizin(izlenen)}
                          cy={cizim.yFiyat(izMum.close)}
                          r={3}
                          fill={colors.bgCard}
                          stroke={ton.fg}
                          strokeWidth={2}
                        />
                      </>
                    ) : null}
                  </Svg>
                ) : null}
              </View>

              {/* Y ekseni: en çok / en az. Renk tek işaret olmasın diye
                  etiketler SÖZLE de ayrışıyor. Mum modunda uçlar fitilden
                  (yüksek/düşük), çizgi modunda kapanıştan geliyor. */}
              <View style={styles.yekseni}>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'En çok ' + formatPrice(cizim.enCok, kur)}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'En az ' + formatPrice(cizim.enAz, kur)}
                </Text>
              </View>

              {/* X ekseni: ilk / son tarih. */}
              <View style={styles.xekseni}>
                <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                  {tarih(cizim.ilkZaman)}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                  {tarih(cizim.sonZaman)}
                </Text>
              </View>

              <View style={styles.ozet}>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'İlk ' + formatPrice(cizim.ilkKapanis, kur)}
                </Text>
                <Text style={[type.micro, numeric, { color: ton.fg }]}>
                  {sinyal.arrow + ' ' + sinyal.word}
                </Text>
                <Text style={[type.micro, numeric, { color: colors.textDim }]}>
                  {'Son ' + formatPrice(cizim.sonKapanis, kur)}
                </Text>
              </View>

              <Text style={[type.micro, numeric, { color: colors.textFaint }]}>
                {veri.adet +
                  ' mum · adım ' +
                  veri.interval +
                  ' · ' +
                  (cizim.mumlar ? 'mum gövdesi (dolu ▲ / içi boş ▼)' : 'kapanış fiyatı')}
              </Text>

              {/* Eşik aşıldı: SESSİZ DÜŞÜŞ YOK, tek satırla söylenir. */}
              {cizim.kalabalik ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Bu yoğunlukta (' +
                    cizim.noktalar.length +
                    ' mum, eşik ' +
                    MUM_AZAMI +
                    ') mum gövdesi okunmaz — kapanış çizgisine düşüldü.'}
                </Text>
              ) : null}

              {/* Hacim yoksa 0 çizilmez, söylenir. */}
              {!cizim.hacim ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  Hacim gelmedi — alt şerit çizilmedi.
                </Text>
              ) : null}

              {/* Bant şeridi SADECE prop geldiğinde; kaynağı da yazılır ki
                  "grafiğin kendi hesabı" sanılmasın. */}
              {alimBandi || satimBandi ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {(alimBandi ? 'Alım bandı' : '') +
                    (alimBandi && satimBandi ? ' ve satım bandı' : satimBandi ? 'Satım bandı' : '') +
                    ' şerit olarak çizildi — motorun planından geldi, grafik hesaplamadı.'}
                </Text>
              ) : null}

              <OlcumNotu kaynak={veri} />
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  secici: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tuval: {
    width: '100%',
    height: GRAFIK_YUKSEKLIK,
    justifyContent: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  rozet: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kunye: { gap: 2 },
  yekseni: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  xekseni: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  ozet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
});
