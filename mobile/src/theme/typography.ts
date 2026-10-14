// =====================================================================
//  TİPOGRAFİ TOKEN'LARI                                (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: metin ölçekleri, iki ağırlık ve SAYI stili.
//
//  NEDEN İKİ AĞIRLIK: yol haritası kuralı ("tipografi, 2 ağırlık").
//  Üç-dört ağırlık karışınca hiyerarşi ağırlıkla değil GÜRÜLTÜYLE
//  kurulur; ayrım boyut + renk ile yapılır, ağırlıkla değil.
//
//  NEDEN SİSTEM FONTU (Inter + expo-font DEĞİL): ölçülmüş gerekçe —
//  iOS'ta SF Pro, Android'de Roboto zaten tabular rakam varyantı taşır
//  ve `fontVariant: ['tabular-nums']` ile hizalanır. Harici font
//  eklemek (a) ilk açılışta font yüklenene kadar metin zıplaması (FOUT)
//  (b) ~300 KB paket yükü (c) `expo-font` + splash bekletme karmaşası
//  getirir. Yol haritasının "algılanan anında-açılış" (FAZ 3) hedefiyle
//  çelişir. Inter kararı FAZ 3 cila turuna bırakıldı — o zaman GÖRSEL
//  bir gerekçeyle alınır, varsayımla değil.
//
//  ── SAYI YUVASI (`tabular-nums`) NEDEN ZORUNLU ─────────────────────
//  Finans listesinde orantılı rakamlar satırdan satıra kayar; fiyat
//  sütunu "zıplar". `tests/metin.mjs` bu kararı motor tarafında zaten
//  verdi: belirteç rolü `s` (sayı) → `fontVariant: ['tabular-nums']`.
//  Aşağıdaki `numeric` o sözleşmenin native tarafıdır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type { TextStyle } from 'react-native';

/** İki ağırlık — başka ağırlık kullanılmaz. */
export const weight = {
  /** Gövde metni. */
  regular: '400',
  /** Başlık, sayı, etiket. */
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

/**
 * Sayı yuvası stili. Fiyat / yüzde / skor gösteren HER metin bunu alır.
 * Tek yerde durur ki "bu satırda tabular var mı?" sorusu bir daha
 * sorulmasın.
 */
export const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Metin ölçeği. `letterSpacing` mutlak piksel (RN `em` tanımaz) —
 * web'deki `-0.01em` 15px gövdede ≈ -0.15px'e denk geliyor.
 */
export const type = {
  /** Ekran üstü büyük başlık. */
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: weight.bold,
    letterSpacing: -0.4,
  },
  /** Bölüm / kart başlığı. */
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: weight.bold,
    letterSpacing: -0.3,
  },
  /** Alt başlık. */
  heading: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: weight.bold,
    letterSpacing: -0.2,
  },
  /** Gövde — web'deki 15px ile aynı. */
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: weight.regular,
    letterSpacing: -0.15,
  },
  /** Gövde vurgulu. */
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: weight.bold,
    letterSpacing: -0.15,
  },
  /** Küçük metin — etiket, ikincil satır. */
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: weight.regular,
    letterSpacing: -0.1,
  },
  smallBold: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: weight.bold,
    letterSpacing: -0.1,
  },
  /** En küçük — dipnot, disclaimer, sekme etiketi. */
  micro: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: weight.regular,
    letterSpacing: 0,
  },
  microBold: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: weight.bold,
    letterSpacing: 0,
  },
  /** Büyük sayı — skor göstergesi. */
  numberLarge: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: weight.bold,
    letterSpacing: -1,
    ...numeric,
  },
} as const satisfies Record<string, TextStyle>;

/**
 * BELİRTEÇ ROLÜ → NATIVE STİL.
 *
 * `tests/metin.mjs` (FAZ 1/3 kararı) motorun düz metin yerine belirteç
 * dizisi döndürmesine karar verdi: `['s','₺12,40']` gibi. Orada
 * `RN_STYLE` adıyla duran eşleme burada token'larla yeniden kurulu —
 * DOĞRULUK KAYNAĞI `tests/metin.mjs`, burası onun native aynası.
 * FAZ 2'de belirteç oluşturucu (`<MotorMetin>`) bu eşlemeyi tüketecek;
 * iki taraf ayrışırsa `tests/metin-test.mjs` tarafı kazanır.
 *
 *   v = vurgu · e = etiket öneki · s = sayı · d = soluk ikincil · i = italik
 */
export const textRole = {
  v: { fontWeight: weight.bold },
  e: { fontWeight: weight.bold },
  s: { fontWeight: weight.bold, ...numeric },
  d: { opacity: 0.85, ...numeric },
  i: { fontStyle: 'italic' },
} as const satisfies Record<string, TextStyle>;
