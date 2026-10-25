// =====================================================================
//  BİÇİMLENDİRME — ham sayı → görünen metin          (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: `Intl.NumberFormat` sarmalayıcıları. Para, yüzde, büyük sayı.
//
//  NEDEN İSTEMCİDE: `BAGIMLILIK_GRAFIGI.md` §5.1 ölçtü ve karara bağladı —
//  "**/api/score ham sayı döndürmeli.** tr-TR / en-US biçimlendirmesi
//  istemcide kalır. Sunucu Intl çıktısı döndürürse para birimi ve ondalık
//  ayracı sunucunun yerel ayarına kilitlenir; mobil istemci bunu bir daha
//  düzeltemez." Bu dosya o kararın istemci yarısı.
//
//  NEDEN TEK DOSYA: aynı fiyatın iki ekranda iki farklı ondalıkla
//  görünmesi, ürünü "özensiz" yapan şeylerin başında geliyor
//  (AldınGitti dersi). Ondalık kararı burada bir kez verilir.
//
//  ── "VERİ YOK" ASLA 0 DEĞİL ────────────────────────────────────────
//  `null`/`undefined`/`NaN` girince "0,00" DÖNMEZ — tire (`—`) döner.
//  Sıfır gerçek bir ölçümdür; boşluk değildir. Bu ayrım motor tarafında
//  da böyle kurulu (bkz. src/api/client.ts).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Ürün dili tek: Türkçe. Ondalık virgül, binlik nokta. */
const LOCALE = 'tr-TR';

/** Ölçülemeyen / gelmeyen değerin görünen hâli. */
export const EMPTY = '—';

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Fiyat. Para birimi kodu motordan gelir (BIST `TRY`, ABD `USD`, ADR'de
 * `KRW`/`JPY`/`TWD` olabilir — bkz. hafıza notu "finCurrency").
 * Para birimi bilinmiyorsa simge UYDURULMAZ, yalnız sayı basılır.
 */
export function formatPrice(value: number | null | undefined, currency?: string | null): string {
  if (!isNum(value)) return EMPTY;
  // Kuruş hassasiyeti: 100'ün altında 2 ondalık, üstünde 2 ondalık yeter;
  // 10.000 üstünde ondalık gürültüdür (mobil satırda yer yok).
  const digits = Math.abs(value) >= 10000 ? 0 : 2;
  try {
    if (currency) {
      return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    }
    return new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    // Geçersiz para birimi kodu Intl'i patlatır — sayıyı kaybetmeyelim.
    return value.toFixed(digits);
  }
}

/**
 * Yüzde değişim. Motor `1.4` gibi YÜZDE PUANI döner (oran değil),
 * o yüzden 100'e bölünmez. İşaret her zaman görünür (`+`/`−`) —
 * yön bilgisini renge bırakmamak için (bkz. theme/signal.ts).
 */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return EMPTY;
  const body = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(value));
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${body}%`;
}

/** 0-100 skor. Tam sayı — motorun ondalığı ekranda anlam taşımıyor. */
export function formatScore(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/**
 * 0-1 aralığındaki motor oranı (bütüncüllük direkleri `v`, ağırlık `w`).
 * ÖLÇÜLDÜ (2026-10-18): /api/analyze `direkler[].v` 0,68403 gibi ORAN
 * döndürüyor. Bunu skor gibi yuvarlamak ekranda "1" yazdırırdı — yanlış.
 * 100'e ÇARPILMAZ: ölçek değiştirmek motorun işidir, istemci yalnız basar.
 */
export function formatOran(value: number | null | undefined, digits = 2): string {
  if (!isNum(value)) return EMPTY;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * Alım bandına uzaklığın TÜRKÇESİ. Motorun `dAtr` alanı =
 * (fiyat − bant üst sınırı) ÷ ATR, yani "uzaklık, hissenin tipik bir
 * günlük SALINIMININ kaç katı".
 *
 * NEDEN "GÜN" DEMİYOR: ATR bir günün salınım genişliğidir (yüksek−düşük),
 * günlük net düşüş değil; ayrıca mesafe ile geçecek süre doğrusal değil
 * yaklaşık karesel ölçeklenir. "0,9×ATR = 0,9 günlük düşüş" cümlesi bu iki
 * sebepten yanlıştı ve hatayı daima "sandığından yakın" yönüne yapıyordu.
 *
 * BURADA HESAP YOK: gelen sayı yalnız biçimlenir — ölçek değişmez, eşik
 * yoktur. `dAtr` uçta bandın içinde/altında olanlar için 0'a kırpılıyor
 * (api/compare.js), o yüzden 0 "uzaklık yok" diye okunur.
 * YÜZDE UZAKLIK UÇTAN GELMİYOR; türetilmez (bkz. motor şeridi önerisi).
 */
export function formatBandUzakligi(dAtr: number | null | undefined): string {
  if (!isNum(dAtr)) return 'banda uzaklığı ölçülmedi';
  const d = Math.abs(dAtr);
  if (d < 0.05) return 'bandın içinde ya da altında — uzaklık yok';
  if (d >= 10) return 'tipik günlük salınımın 10 katından fazla uzakta';
  // 3 katın altında ondalık: sıralamayı belirleyen ayrım ekranda kaybolmasın.
  return `tipik günlük salınımın ${formatOran(d, d < 3 ? 1 : 0)} katı kadar uzakta`;
}

/** Hacim / piyasa değeri gibi büyük sayılar: 1,2 Mr · 340 Mn · 12 B. */
export function formatCompact(value: number | null | undefined): string {
  if (!isNum(value)) return EMPTY;
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, 'Tn'],
    [1e9, 'Mr'],
    [1e6, 'Mn'],
    [1e3, 'B'],
  ];
  for (const [scale, suffix] of units) {
    if (abs >= scale) {
      const n = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(value / scale);
      return `${n} ${suffix}`;
    }
  }
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(value);
}

/**
 * UNIX **SANİYE** damgası → kısa gün/ay ("24 Eki").
 *
 * NEDEN SANİYE: `/api/chart` mum damgası 10 haneli (ÖLÇÜLDÜ: 1790256600),
 * `Date` ise milisaniye bekler. Dönüşümü burada bir kez yapıyoruz;
 * ekranda `new Date(t * 1000)` yazılması yasak (iki kaynak doğar).
 *
 * NEDEN AY ADI SAYI DEĞİL: eksen etiketinde "24.10" ile "10.24" ayırt
 * edilemez; ay adı yerelden gelir ve belirsizlik kalmaz.
 */
export function formatGunAy(saniye: number | null | undefined): string {
  if (!isNum(saniye)) return EMPTY;
  const d = new Date(saniye * 1000);
  if (Number.isNaN(d.getTime())) return EMPTY;
  try {
    return new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(d);
  } catch {
    return EMPTY;
  }
}

/**
 * UNIX **SANİYE** damgası → gün/ay/yıl ("24 Eki 2026"). Çok yıllı
 * aralıklarda (1y / 5y) yıl olmadan ilk etiket yanıltıcı olur.
 */
export function formatGunAyYil(saniye: number | null | undefined): string {
  if (!isNum(saniye)) return EMPTY;
  const d = new Date(saniye * 1000);
  if (Number.isNaN(d.getTime())) return EMPTY;
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return EMPTY;
  }
}

/**
 * Haber maddesinin HAM `pubDate` dizgesi → "24 Eki 2026 09:41".
 *
 * NEDEN BURADA: uç nokta tarihi ÜST KAYNAĞIN VERDİĞİ GİBİ (RFC-822)
 * döndürüyor ve bunu biçimlemek istemcinin işi (api/news.js:26-30).
 * Biçimleme tek yerden geçsin diye ekranda `new Date(...)` yazılmıyor.
 *
 * NEDEN `EMPTY` DEĞİL, HAM METNE DÜŞÜYOR: RFC-822 ayrıştırması Hermes'te
 * ISO olmayan biçimler için uygulamaya bağlı. Ayrıştırma tutmazsa elimizde
 * YİNE DE kaynağın söylediği tarih var; onu silip "—" yazmak ölçülmüş bir
 * bilgiyi atmak olurdu. Uydurma da yapılmıyor: ya biçimlenmiş tarih ya
 * kaynağın kendi metni.
 */
export function formatHaberTarih(ham: string | null | undefined): string {
  const metin = String(ham ?? '').trim();
  if (!metin) return EMPTY;
  const ms = Date.parse(metin);
  if (!Number.isFinite(ms)) return metin;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return metin;
  try {
    return new Intl.DateTimeFormat(LOCALE, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return metin;
  }
}
