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
