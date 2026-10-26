// =====================================================================
//  TÜRLÜ DEPO — dokuz kullanıcı verisi türü, cihazda           (ŞERİT 1)
// ---------------------------------------------------------------------
//  NE: web PWA'nın `localStorage`da tuttuğu KULLANICI VERİSİ türlerini
//  native tarafta da saklar: adlandırılmış listeler, portföy, sepet,
//  sepet geçmişi, hamle günlüğü, tezler, kıyas seti, son aramalar ve
//  iğnelenmiş göstergeler. Nakit ayrı bir tür DEĞİL (aşağıda, ÖLÇÜLDÜ).
//
//  NEDEN BURADA: bu dokuz türün HİÇBİRİ bir uç noktadan gelemez —
//  kullanıcının kendi girdisi. Uç noktalar (`client.ts`, `yfin.ts`)
//  yalnız ölçüm döndürür. Dolayısıyla tek kalıcılık yeri cihaz.
//
//  NEDEN WEB'İN ANAHTARLARI BİREBİR: `lib/kalici.ts:43` listeler için
//  bunu bilerek yapıyor (`sb:lists`). Aynı ilke sürdürüldü: web lab ile
//  native AYNI veriye bakmalı, aradaki köprü bir ÇEVİRİCİ gerektirmesin.
//  Her anahtar aşağıda app.js satır numarasıyla ÖLÇÜLDÜ.
//
//  ÖLÇÜLDÜ (app.js, salt okuma):
//    ① adlandırılmış listeler   `sb:lists`             app.js:1923
//       şekil: {id,name,items:[{symbol,market,query}],inUniverse?,notify?}
//       (`loadLists` 1926, `createList` 1935 `inUniverse:true, notify:true`)
//    ② kullanıcı portföyü       `sb:userPortfolio`     app.js:1653
//       şekil: {symbol,market,query}  (ekleme app.js:1718)
//       + gizlenen tohumlar     `sb:hiddenPortfolio`   app.js:1654
//       şekil: {symbol,market}        (ekleme app.js:1732)
//       NOT: `getPortfolio()` (app.js:1675) artık BU anahtarı değil,
//       listelerin `inUniverse` kutucuğunu okuyor; iki anahtar geriye
//       dönük uyum için korunuyor, biz de şeklini koruyoruz.
//    ③ sepet                    `sb:basket`            app.js:2237
//       şekil: app.js:3125 `holding` — {id,cls,symbol,cgId,name,unit,
//       emoji,qty,cost,costCur,addDate,addPrice,manualPrice}
//       sınıflar app.js:2259 `BASKET_CLASSES`:
//       fx · us · bist · crypto · metal · fund · cash
//    ④ sepet geçmişi            `sb:basket:history`    app.js:2238
//       şekil: {date:'YYYY-AA-GG', total, byClass:{sınıf:sayı}}
//       sınır: 400 kayıt (app.js:2590)
//    ⑤ hamle günlüğü            `sb:basket:moves`      app.js:2239
//       şekil: app.js:2244 + çağrı yerleri (3132, 3200) — {id,ts,type,
//       cls,symbol,name,emoji,qty,price,cur,valTRY,pl,holdingId,before,
//       basketFlow};  sınır: 500 kayıt (app.js:2246)
//    ⑥ NAKİT BAKİYE — AYRI ANAHTAR YOK (ölçüm düzeltmesi)
//       app.js:3181 `findCashHolding` / 3182 `cashBalance`: nakit,
//       `sb:basket` içinde `cls:'cash'` olan bir KALEM; sembol para
//       birimi (TRY/USD), `qty` bakiye, `cost:1`. index.html:566/573
//       `cashCurChips`/`cashOpChips` yalnız MODAL arayüzü — kalıcı
//       veri değil. Bu yüzden burada okuma yardımcısı var (`nakitBakiye`),
//       ayrı tür YOK: ikinci bir yer uydurmak iki doğruluk kaynağı demekti.
//    ⑦ tezler                   `sb:theses`            app.js:9543
//       şekil: app.js:9770 — {id,created,symbol,market,name,position,
//       conviction,thesis,pillars:[{text,status}],risks:[],target,stop,
//       catalysts:[{date,text}],updated,log:[{date,imp,note}]}
//    ⑧ kıyas seti               `sb:compare`           app.js:12238
//       şekil: {symbol,market,query};  sınır: 8 (app.js:12722)
//    ⑨ son aramalar             `sb:recentSearch`      app.js:2167
//       şekil: {symbol,market};  sınır: 12 (app.js:2174)
//       + iğnelenmiş göstergeler `sb:tickers`           app.js:2366
//       şekil: {id,cls,symbol,cgId?,label} (app.js:2478-2489)
//       sınır: 4 (app.js:2368-2369 `TICKER_TOTAL_MAX 10 − TICKER_BUILTIN 6`)
//       + gizlenen yerleşikler  `sb:ticker:hidden`     app.js:2375
//       şekil: string[] (yerleşik anahtarları: gram/usd/eur/gbp/btc/eth)
//
//  NEDEN SÜRÜM ANAHTARI AYRI VE YENİ (`sb:depo:surum`): `lib/kalici.ts`
//  `sb:lists:surum`ü KENDİSİ yazıyor (SEMA_SURUM=1, kalici.ts:186). Aynı
//  anahtarı buradan da yazsaydık iki yazar birbirinin sürümünü ezerdi.
//  Bu katmanın sürümü komşu, native'e özel anahtarda duruyor; web'in
//  kayıtları ŞEKİL olarak hiç değişmiyor.
//
//  DÜRÜST BOZULMA: AsyncStorage özel pencerede / kota dolu cihazda
//  yazmayabilir. `kalici.ts:195 depoCalisiyorMu()` bunu sınıyor; burada
//  o işlev kullanılıyor, yenisi uydurulmadı. Okunamayan kayıt ATILIR ve
//  `budandiMi()` ile yüzeye çıkar (liste.ts:113 `kayitBudandiMi` kalıbı).
//  Sessizce varsayılana dönmek yok: "kayıt yok" ile "kayıt bozuk" AYRI.
//
//  SESSİZ SIFIR YASAK: `0` geçerli bir adet/bakiye, `null` ise ÖLÇÜM YOK.
//  Süzgeçler `0`ı `null`a, `null`ı `0`a ÇEVİRMEZ (`sayiVeyaNull`).
//
//  BURADA HESAP YOK: skor, eşik, ağırlık, yüzde, kuruş yuvarlaması —
//  hiçbiri. Biçimleme `lib/format.ts`in işi; depo HAM sayı tutar.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useSyncExternalStore } from 'react';

import { depoCalisiyorMu } from '@/lib/kalici';

import { AZAMI_SEMBOL } from './types';

// ---------------------------------------------------------------------
//  1. ANAHTARLAR — web ile BİREBİR (yukarıdaki ölçüm bloğu)
// ---------------------------------------------------------------------

export const ANAHTARLAR = {
  listeler: 'sb:lists',
  portfoy: 'sb:userPortfolio',
  gizliPortfoy: 'sb:hiddenPortfolio',
  sepet: 'sb:basket',
  sepetGecmis: 'sb:basket:history',
  hamleler: 'sb:basket:moves',
  tezler: 'sb:theses',
  kiyas: 'sb:compare',
  aramalar: 'sb:recentSearch',
  gostergeler: 'sb:tickers',
  gizliGostergeler: 'sb:ticker:hidden',
} as const;

/** Bu katmanın şema sürümü. Web'in kayıt ŞEKLİ değişmez (başlık notu). */
export const DEPO_SURUM_ANAHTAR = 'sb:depo:surum';
/** Göç bir kez koşsun diye nişan. İdempotentlik buna dayanıyor. */
export const DEPO_GOC_ANAHTAR = 'sb:depo:goc';
/** Göç öncesi HAM kayıt. Göç yarıda kalırsa eski veri burada durur. */
export const DEPO_YEDEK_ANAHTAR = 'sb:lists:goc-yedek';
export const DEPO_SURUM = 2;

/** Göçün varsayılan tek listesi — `kalici.ts:50-51` ile AYNI kimlik/ad. */
export const VARSAYILAN_LISTE_ID = 'mobil';
export const VARSAYILAN_LISTE_AD = 'Takip';

/** Web'in sınırları (app.js ölçümleri). Depo bunları KENDİ İÇİNDE tutar. */
export const AZAMI_GECMIS = 400; // app.js:2590
export const AZAMI_HAMLE = 500; // app.js:2246
export const AZAMI_KIYAS = 8; // app.js:12722
export const AZAMI_ARAMA = 12; // app.js:2174
export const AZAMI_GOSTERGE = 4; // app.js:2368-2369

// ---------------------------------------------------------------------
//  2. TİPLER — web'deki alan adlarıyla BİREBİR (çevirici gerekmesin)
// ---------------------------------------------------------------------

export type Pazar = 'US' | 'BIST';

/** Sepet varlık sınıfları — app.js:2259 `BASKET_CLASSES`. */
export type VarlikSinifi = 'fx' | 'us' | 'bist' | 'crypto' | 'metal' | 'fund' | 'cash';

export type ListeOge = { symbol: string; market: string; query: string };

export type ListeKaydi = {
  id: string;
  name: string;
  items: ListeOge[];
  /** `false` ⇒ evrene DAHİL DEĞİL. Yokluğu "dahil" demek (app.js:1678). */
  inUniverse?: boolean;
  notify?: boolean;
};

export type PortfoyOge = { symbol: string; market: string; query: string };
export type GizliPortfoyOge = { symbol: string; market: string };

export type SepetKalemi = {
  id: string;
  cls: VarlikSinifi;
  symbol: string;
  cgId: string | null;
  name: string;
  unit: string | null;
  emoji: string;
  /** Adet/miktar. HAM sayı; `0` geçerli, `null` "girilmemiş". */
  qty: number | null;
  /** Birim maliyet. Yuvarlama YOK (biçimleme `lib/format.ts`in işi). */
  cost: number | null;
  costCur: string;
  addDate: string;
  addPrice: number | null;
  manualPrice: number | null;
};

export type SepetGecmisKaydi = {
  /** 'YYYY-AA-GG' — app.js:2586 `toISOString().slice(0,10)`. */
  date: string;
  total: number | null;
  byClass: Record<string, number>;
};

export type Hamle = {
  id: string;
  ts: string;
  type: string;
  cls: VarlikSinifi;
  symbol: string;
  name: string;
  emoji: string;
  qty: number | null;
  price: number | null;
  cur: string;
  valTRY: number | null;
  /** Gerçekleşen kâr/zarar. `null` = ölçüm yok, `0` = sıfır. */
  pl: number | null;
  holdingId: string | null;
  before: number | null;
  basketFlow: number | null;
};

export type TezDayanak = { text: string; status: 'ok' | 'watch' | 'bad' };
export type TezKatalizor = { date: string; text: string };
export type TezGunluk = { date: string; imp: string; note: string };

export type Tez = {
  id: string;
  created: string;
  updated: string;
  symbol: string;
  market: string;
  name: string;
  position: 'long' | 'short';
  conviction: 'hi' | 'mid' | 'lo';
  thesis: string;
  pillars: TezDayanak[];
  risks: string[];
  target: number | null;
  stop: number | null;
  catalysts: TezKatalizor[];
  log: TezGunluk[];
};

export type KiyasOge = { symbol: string; market: string; query: string };
export type AramaKaydi = { symbol: string; market: string };

export type Gosterge = {
  id: string;
  cls: VarlikSinifi;
  symbol: string;
  cgId: string | null;
  label: string;
};

/** Reddin SEBEBİ taşınır — `liste.ts:61 EkleSonuc` kalıbı. */
export type YazSonuc =
  | { ok: true }
  | { ok: false; sebep: 'bos' | 'zaten_var' | 'dolu' | 'yok' | 'yazilamadi'; mesaj: string };

// ---------------------------------------------------------------------
//  3. SÜRÜCÜ — AsyncStorage, ama ÇAKILI DEĞİL
// ---------------------------------------------------------------------
//  NEDEN ARA KATMAN: saf Node'da (testler) `@react-native-async-storage`
//  yüklenmez — yerel RN modülü bekler. `tests/cozucu-kanca.mjs` yalnız
//  `@/lib/kalici`yı yedekliyor; bu dosya için de bir giriş gerekiyordu.
//  Sürücü ATANABİLİR: test bellek-içi sürücü koyar, uygulama hiçbir şey
//  yapmaz ve varsayılan (AsyncStorage) devreye girer.
// ---------------------------------------------------------------------

export type DepoSurucu = {
  oku(anahtar: string): Promise<string | null>;
  yaz(anahtar: string, deger: string): Promise<void>;
  sil(anahtar: string): Promise<void>;
};

let surucu: DepoSurucu | null = null;
let surucuDenendi = false;

/** YALNIZ ölçüm/test için. Uygulama bunu çağırmaz. */
export function depoSurucuAta(yeni: DepoSurucu | null): void {
  surucu = yeni;
  surucuDenendi = yeni != null;
}

async function surucuAl(): Promise<DepoSurucu | null> {
  if (surucu) return surucu;
  if (surucuDenendi) return null;
  surucuDenendi = true;
  try {
    const mod = await import('@react-native-async-storage/async-storage');
    const as = (mod as { default?: unknown }).default as {
      getItem(k: string): Promise<string | null>;
      setItem(k: string, v: string): Promise<void>;
      removeItem(k: string): Promise<void>;
    };
    if (!as || typeof as.getItem !== 'function') return null;
    surucu = {
      oku: (a) => as.getItem(a),
      yaz: (a, d) => as.setItem(a, d),
      sil: (a) => as.removeItem(a),
    };
    return surucu;
  } catch {
    // Depo hiç açılmadı: kalıcılık YOK, uygulama yine çalışır. Sessiz
    // kalınmıyor — `depoYazabilirMi()` bunu ekrana taşıyor.
    return null;
  }
}

async function hamOku(anahtar: string): Promise<string | null> {
  const s = await surucuAl();
  if (!s) return null;
  try {
    return await s.oku(anahtar);
  } catch {
    return null;
  }
}

async function hamYaz(anahtar: string, deger: string): Promise<boolean> {
  const s = await surucuAl();
  if (!s) return false;
  try {
    await s.yaz(anahtar, deger);
    return true;
  } catch {
    return false;
  }
}

async function hamSil(anahtar: string): Promise<boolean> {
  const s = await surucuAl();
  if (!s) return false;
  try {
    await s.sil(anahtar);
    return true;
  } catch {
    return false;
  }
}

/**
 * Depo gerçekten yazıp okuyabiliyor mu? `kalici.ts:195` sınaması
 * KULLANILIYOR (yenisi uydurulmadı); sürücü atanmışsa onunla aynı
 * sınama burada koşar, çünkü kalici doğrudan AsyncStorage'a bakıyor.
 */
export async function depoYazabilirMi(): Promise<boolean> {
  if (surucu) {
    const sinama = 'sb:depo:sinama';
    const yazildi = await hamYaz(sinama, '1');
    if (!yazildi) return false;
    const geri = await hamOku(sinama);
    await hamSil(sinama);
    return geri === '1';
  }
  return depoCalisiyorMu();
}

// ---------------------------------------------------------------------
//  4. SÜZGEÇ YARDIMCILARI — hiçbiri FIRLATMAZ
// ---------------------------------------------------------------------

function metin(ham: unknown, varsayilan = ''): string {
  return typeof ham === 'string' ? ham : varsayilan;
}

/**
 * Sayı ya da `null`. SESSİZ SIFIR YASAK: `0` olduğu gibi kalır,
 * `null`/`undefined`/`NaN` ise `null` olur — ikisi AYNI ŞEY DEĞİL.
 */
function sayiVeyaNull(ham: unknown): number | null {
  if (typeof ham === 'number' && Number.isFinite(ham)) return ham;
  return null;
}

function nesneMi(ham: unknown): ham is Record<string, unknown> {
  return !!ham && typeof ham === 'object' && !Array.isArray(ham);
}

function sembolNormal(ham: unknown): string {
  return metin(ham).trim().toUpperCase();
}

const SINIFLAR: readonly VarlikSinifi[] = ['fx', 'us', 'bist', 'crypto', 'metal', 'fund', 'cash'];

function sinifSuz(ham: unknown): VarlikSinifi | null {
  const s = metin(ham);
  return (SINIFLAR as readonly string[]).includes(s) ? (s as VarlikSinifi) : null;
}

/** Ham diziyi öğe süzgecinden geçirir. Atılan her satır `budandi` yapar. */
function diziSuz<T>(ham: unknown, suz: (o: unknown) => T | null, azami?: number): { deger: T[]; budandi: boolean } {
  if (!Array.isArray(ham)) return { deger: [], budandi: ham != null };
  let budandi = false;
  const cikti: T[] = [];
  for (const o of ham) {
    const t = suz(o);
    if (t == null) {
      budandi = true;
      continue;
    }
    if (azami != null && cikti.length >= azami) {
      budandi = true;
      break;
    }
    cikti.push(t);
  }
  return { deger: cikti, budandi };
}

// ---------------------------------------------------------------------
//  5. TÜR SÜZGEÇLERİ — her tür için ayrı, alan alan
// ---------------------------------------------------------------------

function listeOgeSuz(ham: unknown): ListeOge | null {
  if (typeof ham === 'string') {
    const s = sembolNormal(ham);
    return s ? { symbol: s, market: pazarOf(s), query: s } : null;
  }
  if (!nesneMi(ham)) return null;
  const s = sembolNormal(ham.symbol);
  if (!s) return null;
  return {
    symbol: s,
    market: metin(ham.market) || pazarOf(s),
    query: metin(ham.query) || s,
  };
}

/** `.IS` soneki = Borsa İstanbul. Biçim eşlemesi, HESAP DEĞİL (kalici.ts:69). */
function pazarOf(sembol: string): Pazar {
  return sembol.endsWith('.IS') ? 'BIST' : 'US';
}

function listeKaydiSuz(ham: unknown): ListeKaydi | null {
  if (!nesneMi(ham)) return null;
  const id = metin(ham.id);
  if (!id) return null;
  // Sınır LİSTE BAŞINA 8: bir liste = bir uç turu (`AZAMI_SEMBOL`,
  // api/_girdi.js aşımı kırpmıyor, 400 ile REDDEDİYOR). Birden çok
  // liste olabilir; tek çağrıya 8'den fazla sembol GİTMEZ.
  const { deger: items, budandi } = diziSuz(ham.items, listeOgeSuz, AZAMI_SEMBOL);
  // İÇ budama DIŞARIYA taşınmalı: öğe atıldığı halde liste sağlam
  // göründüğünde ekran "kayıt tam" derdi — sessiz budama olurdu.
  if (budandi) icBudandi = true;
  const kayit: ListeKaydi = { id, name: metin(ham.name) || id, items };
  if (typeof ham.inUniverse === 'boolean') kayit.inUniverse = ham.inUniverse;
  if (typeof ham.notify === 'boolean') kayit.notify = ham.notify;
  return kayit;
}

/**
 * `listeKaydiSuz`un İÇ budamasını taşıyan bayrak. Süzgeç imzası tek
 * değer döndürdüğü için (diziSuz sözleşmesi) bayrak modül düzeyinde;
 * `listelerSuz` onu her çağrıda sıfırlıyor, yani senkron ve yerel.
 */
let icBudandi = false;

function listelerSuz(ham: unknown): { deger: ListeKaydi[]; budandi: boolean } {
  icBudandi = false;
  const { deger, budandi } = diziSuz(ham, listeKaydiSuz);
  return { deger, budandi: budandi || icBudandi };
}

function portfoySuz(ham: unknown): PortfoyOge | null {
  if (!nesneMi(ham)) return null;
  const s = sembolNormal(ham.symbol);
  if (!s) return null;
  return { symbol: s, market: metin(ham.market) || pazarOf(s), query: metin(ham.query) || s };
}

function gizliPortfoySuz(ham: unknown): GizliPortfoyOge | null {
  if (!nesneMi(ham)) return null;
  const s = sembolNormal(ham.symbol);
  if (!s) return null;
  return { symbol: s, market: metin(ham.market) || pazarOf(s) };
}

function sepetSuz(ham: unknown): SepetKalemi | null {
  if (!nesneMi(ham)) return null;
  const id = metin(ham.id);
  const cls = sinifSuz(ham.cls);
  if (!id || !cls) return null;
  return {
    id,
    cls,
    symbol: metin(ham.symbol),
    cgId: typeof ham.cgId === 'string' ? ham.cgId : null,
    name: metin(ham.name),
    unit: typeof ham.unit === 'string' ? ham.unit : null,
    emoji: metin(ham.emoji),
    qty: sayiVeyaNull(ham.qty),
    cost: sayiVeyaNull(ham.cost),
    costCur: metin(ham.costCur) || 'TRY',
    addDate: metin(ham.addDate),
    addPrice: sayiVeyaNull(ham.addPrice),
    manualPrice: sayiVeyaNull(ham.manualPrice),
  };
}

function sinifSayilariSuz(ham: unknown): Record<string, number> {
  const cikti: Record<string, number> = {};
  if (!nesneMi(ham)) return cikti;
  for (const k of Object.keys(ham)) {
    const v = sayiVeyaNull(ham[k]);
    if (v != null) cikti[k] = v;
  }
  return cikti;
}

function gecmisSuz(ham: unknown): SepetGecmisKaydi | null {
  if (!nesneMi(ham)) return null;
  const date = metin(ham.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { date, total: sayiVeyaNull(ham.total), byClass: sinifSayilariSuz(ham.byClass) };
}

function hamleSuz(ham: unknown): Hamle | null {
  if (!nesneMi(ham)) return null;
  const id = metin(ham.id);
  const cls = sinifSuz(ham.cls);
  if (!id || !cls) return null;
  return {
    id,
    ts: metin(ham.ts),
    type: metin(ham.type),
    cls,
    symbol: metin(ham.symbol),
    name: metin(ham.name),
    emoji: metin(ham.emoji),
    qty: sayiVeyaNull(ham.qty),
    price: sayiVeyaNull(ham.price),
    cur: metin(ham.cur) || 'TRY',
    valTRY: sayiVeyaNull(ham.valTRY),
    pl: sayiVeyaNull(ham.pl),
    holdingId: typeof ham.holdingId === 'string' ? ham.holdingId : null,
    before: sayiVeyaNull(ham.before),
    basketFlow: sayiVeyaNull(ham.basketFlow),
  };
}

function dayanakSuz(ham: unknown): TezDayanak | null {
  if (typeof ham === 'string') return ham.trim() ? { text: ham.trim(), status: 'ok' } : null;
  if (!nesneMi(ham)) return null;
  const text = metin(ham.text).trim();
  if (!text) return null;
  const st = metin(ham.status);
  return { text, status: st === 'watch' || st === 'bad' ? st : 'ok' };
}

function katalizorSuz(ham: unknown): TezKatalizor | null {
  if (!nesneMi(ham)) return null;
  const text = metin(ham.text).trim();
  if (!text) return null;
  return { date: metin(ham.date), text };
}

function gunlukSuz(ham: unknown): TezGunluk | null {
  if (!nesneMi(ham)) return null;
  const note = metin(ham.note).trim();
  if (!note) return null;
  return { date: metin(ham.date), imp: metin(ham.imp), note };
}

function metinSuz(ham: unknown): string | null {
  const s = metin(ham).trim();
  return s || null;
}

function tezSuz(ham: unknown): Tez | null {
  if (!nesneMi(ham)) return null;
  const id = metin(ham.id);
  const symbol = sembolNormal(ham.symbol);
  if (!id || !symbol) return null;
  const conv = metin(ham.conviction);
  return {
    id,
    created: metin(ham.created),
    updated: metin(ham.updated),
    symbol,
    market: metin(ham.market) || pazarOf(symbol),
    name: metin(ham.name),
    position: metin(ham.position) === 'short' ? 'short' : 'long',
    conviction: conv === 'hi' || conv === 'lo' ? conv : 'mid',
    thesis: metin(ham.thesis),
    pillars: diziSuz(ham.pillars, dayanakSuz).deger,
    risks: diziSuz(ham.risks, metinSuz).deger,
    target: sayiVeyaNull(ham.target),
    stop: sayiVeyaNull(ham.stop),
    catalysts: diziSuz(ham.catalysts, katalizorSuz).deger,
    log: diziSuz(ham.log, gunlukSuz).deger,
  };
}

function kiyasSuz(ham: unknown): KiyasOge | null {
  if (!nesneMi(ham)) return null;
  const s = sembolNormal(ham.symbol);
  if (!s) return null;
  return { symbol: s, market: metin(ham.market) || pazarOf(s), query: metin(ham.query) || s };
}

function aramaSuz(ham: unknown): AramaKaydi | null {
  if (!nesneMi(ham)) return null;
  const s = sembolNormal(ham.symbol);
  if (!s) return null;
  return { symbol: s, market: metin(ham.market) || pazarOf(s) };
}

function gostergeSuz(ham: unknown): Gosterge | null {
  if (!nesneMi(ham)) return null;
  const cls = sinifSuz(ham.cls);
  if (!cls) return null;
  const symbol = metin(ham.symbol);
  const cgId = typeof ham.cgId === 'string' ? ham.cgId : null;
  const id = metin(ham.id) || (cls + '-' + (cgId || symbol)).replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!id || !symbol) return null;
  return { id, cls, symbol, cgId, label: metin(ham.label) || symbol };
}

// ---------------------------------------------------------------------
//  6. TÜR DEPOSU — abonelik + `hazir` bayrağı (liste.ts kalıbı)
// ---------------------------------------------------------------------
//  NEDEN `hazir`: depo okuması asenkron. Bayrak olmasaydı ekran önce
//  boş veriyle motora gider, kayıt gelince ikinci kez giderdi — iki tur,
//  iki anlık görüntü (liste.ts:20-23 aynı gerekçe).
// ---------------------------------------------------------------------

export type TurDepo<T> = {
  readonly anahtar: string;
  /** Bellekteki anlık değer. Kimliği YAZINCA değişir (hook için şart). */
  al(): T;
  /** Depodan okur ve belleğe alır. Hiçbir koşulda fırlatmaz. */
  oku(): Promise<T>;
  /** Depoya yazar. `false` = yazılamadı (kota/özel pencere). */
  yaz(deger: T): Promise<boolean>;
  /**
   * Belleği tazeler, depoya YAZMAZ. Başka bir yazar (ör. `lib/kalici.ts`
   * `listeYaz`) aynı anahtarı güncellediğinde iki kez yazmamak için var.
   */
  bellegeKoy(deger: T): void;
  /** Kaydı siler. Bellekteki değer boşa döner. */
  temizle(): Promise<boolean>;
  /** Depo okuması bitti mi? */
  hazirMi(): boolean;
  /** Kayıttan bozuk/aşan satır atıldı mı? (`liste.ts:113` kalıbı) */
  budandiMi(): boolean;
  abone(d: () => void): () => void;
};

function turYap<T>(
  anahtar: string,
  bos: () => T,
  suz: (ham: unknown) => { deger: T; budandi: boolean },
): TurDepo<T> {
  let deger: T = bos();
  let hazir = false;
  let budandi = false;
  let okuma: Promise<T> | null = null;
  const dinleyiciler = new Set<() => void>();

  function yayinla() {
    for (const d of dinleyiciler) d();
  }

  async function okuBirKez(): Promise<T> {
    const ham = await hamOku(anahtar);
    if (ham == null) {
      // Kayıt YOK — "boş" ile aynı şey değil ama ekranda aynı görünür;
      // ayrım `budandi` üzerinden yapılıyor (bozuk kayıt budar).
      hazir = true;
      yayinla();
      return deger;
    }
    let cozuk: unknown;
    try {
      cozuk = JSON.parse(ham);
    } catch {
      // Bozuk/yarım JSON: kayıt ATILIR, uygulama açılır, dürüstçe NOT edilir.
      budandi = true;
      hazir = true;
      yayinla();
      return deger;
    }
    const sonuc = suz(cozuk);
    deger = sonuc.deger;
    budandi = sonuc.budandi;
    hazir = true;
    yayinla();
    return deger;
  }

  return {
    anahtar,
    al: () => deger,
    oku() {
      if (!okuma) okuma = okuBirKez();
      return okuma;
    },
    async yaz(yeni: T) {
      deger = yeni;
      hazir = true;
      yayinla();
      return hamYaz(anahtar, JSON.stringify(yeni));
    },
    bellegeKoy(yeni: T) {
      deger = yeni;
      hazir = true;
      yayinla();
    },
    async temizle() {
      deger = bos();
      budandi = false;
      hazir = true;
      yayinla();
      return hamSil(anahtar);
    },
    hazirMi: () => hazir,
    budandiMi: () => budandi,
    abone(d: () => void) {
      dinleyiciler.add(d);
      return () => dinleyiciler.delete(d);
    },
  };
}

// ---------------------------------------------------------------------
//  7. TÜR ÖRNEKLERİ — dokuz tür (nakit ayrı tür DEĞİL, bkz. ⑥)
// ---------------------------------------------------------------------

export const listelerDepo = turYap<ListeKaydi[]>(
  ANAHTARLAR.listeler,
  () => [],
  listelerSuz,
);

export const portfoyDepo = turYap<PortfoyOge[]>(
  ANAHTARLAR.portfoy,
  () => [],
  (ham) => diziSuz(ham, portfoySuz),
);

export const gizliPortfoyDepo = turYap<GizliPortfoyOge[]>(
  ANAHTARLAR.gizliPortfoy,
  () => [],
  (ham) => diziSuz(ham, gizliPortfoySuz),
);

export const sepetDepo = turYap<SepetKalemi[]>(
  ANAHTARLAR.sepet,
  () => [],
  (ham) => diziSuz(ham, sepetSuz),
);

export const sepetGecmisDepo = turYap<SepetGecmisKaydi[]>(
  ANAHTARLAR.sepetGecmis,
  () => [],
  (ham) => diziSuz(ham, gecmisSuz, AZAMI_GECMIS),
);

export const hamlelerDepo = turYap<Hamle[]>(
  ANAHTARLAR.hamleler,
  () => [],
  (ham) => diziSuz(ham, hamleSuz, AZAMI_HAMLE),
);

export const tezlerDepo = turYap<Tez[]>(
  ANAHTARLAR.tezler,
  () => [],
  (ham) => diziSuz(ham, tezSuz),
);

export const kiyasDepo = turYap<KiyasOge[]>(
  ANAHTARLAR.kiyas,
  () => [],
  (ham) => diziSuz(ham, kiyasSuz, AZAMI_KIYAS),
);

export const aramalarDepo = turYap<AramaKaydi[]>(
  ANAHTARLAR.aramalar,
  () => [],
  (ham) => diziSuz(ham, aramaSuz, AZAMI_ARAMA),
);

export const gostergelerDepo = turYap<Gosterge[]>(
  ANAHTARLAR.gostergeler,
  () => [],
  (ham) => diziSuz(ham, gostergeSuz, AZAMI_GOSTERGE),
);

export const gizliGostergelerDepo = turYap<string[]>(
  ANAHTARLAR.gizliGostergeler,
  () => [],
  (ham) => diziSuz(ham, metinSuz),
);

/** Tüm türler — göç ve toplu okuma için. */
const TUMU = [
  listelerDepo,
  portfoyDepo,
  gizliPortfoyDepo,
  sepetDepo,
  sepetGecmisDepo,
  hamlelerDepo,
  tezlerDepo,
  kiyasDepo,
  aramalarDepo,
  gostergelerDepo,
  gizliGostergelerDepo,
] as const;

/** Herhangi bir türün kaydından satır atıldı mı? (`liste.ts:113` kalıbı) */
export function kayitBudandiMi(): boolean {
  return TUMU.some((t) => t.budandiMi());
}

// ---------------------------------------------------------------------
//  8. REACT KANCALARI — `liste.ts:174 useListe` / `:108 useHazir` kalıbı
// ---------------------------------------------------------------------

export function useTur<T>(depo: TurDepo<T>): T {
  return useSyncExternalStore(depo.abone, depo.al, depo.al);
}

/** Ekran motora gitmeden ÖNCE depo okumasını bekler. */
export function useTurHazir<T>(depo: TurDepo<T>): boolean {
  return useSyncExternalStore(depo.abone, depo.hazirMi, depo.hazirMi);
}

export function useListeler(): ListeKaydi[] {
  return useTur(listelerDepo);
}
export function usePortfoy(): PortfoyOge[] {
  return useTur(portfoyDepo);
}
export function useSepet(): SepetKalemi[] {
  return useTur(sepetDepo);
}
export function useSepetGecmis(): SepetGecmisKaydi[] {
  return useTur(sepetGecmisDepo);
}
export function useHamleler(): Hamle[] {
  return useTur(hamlelerDepo);
}
export function useTezler(): Tez[] {
  return useTur(tezlerDepo);
}
export function useKiyas(): KiyasOge[] {
  return useTur(kiyasDepo);
}
export function useAramalar(): AramaKaydi[] {
  return useTur(aramalarDepo);
}
export function useGostergeler(): Gosterge[] {
  return useTur(gostergelerDepo);
}

// ---------------------------------------------------------------------
//  9. GÖÇ — düz sembol dizisi → adlandırılmış liste şeması
// ---------------------------------------------------------------------
//  ÖLÇÜM DÜZELTMESİ: `lib/kalici.ts:168` native tarafta ZATEN web şeklini
//  yazıyor (`[{id:'mobil', name:'Takip', items:[…]}]`). DÜZ olan, uç
//  katmanının BELLEKTEKİ görünümü (`liste.ts:65 liste: string[]`).
//  Yine de düz dizi kaydı MÜMKÜN: eski bir sürüm ya da elle müdahale.
//  Göç bu durumu KAYIPSIZ karşılar.
//
//  ÜÇ KURAL:
//   ① BİR KEZ: nişan (`sb:depo:goc`) varsa dokunulmaz.
//   ② İDEMPOTENT: nişan silinse bile ikinci koşu aynı sonucu verir —
//      zaten adlandırılmış kayıt olduğu gibi bırakılır.
//   ③ KAYIP YOK: dönüştürmeden ÖNCE ham kayıt `sb:lists:goc-yedek`e
//      kopyalanır. Yazma başarısız olursa eski kayıt SİLİNMEZ ve nişan
//      KONULMAZ; bir sonraki açılış yeniden dener.
// ---------------------------------------------------------------------

export type GocSonuc = {
  /** Dönüştürme gerçekten koştu mu? */
  kostu: boolean;
  /** Göçe giren sembol sayısı (kayıpsızlık ölçümü). */
  sembol: number;
  /** Neden koşmadı / ne oldu — Türkçe tek satır. */
  not: string;
};

export async function goc(): Promise<GocSonuc> {
  const nisan = await hamOku(DEPO_GOC_ANAHTAR);
  if (nisan === String(DEPO_SURUM)) {
    return { kostu: false, sembol: 0, not: 'Göç daha önce tamamlanmış.' };
  }
  const ham = await hamOku(ANAHTARLAR.listeler);
  if (ham == null) {
    // Kayıt yok: göçecek veri yok, ama nişanı koy — ilk kurulum.
    await hamYaz(DEPO_GOC_ANAHTAR, String(DEPO_SURUM));
    await hamYaz(DEPO_SURUM_ANAHTAR, String(DEPO_SURUM));
    return { kostu: false, sembol: 0, not: 'Kayıt yok; göçecek veri yok.' };
  }
  let cozuk: unknown;
  try {
    cozuk = JSON.parse(ham);
  } catch {
    // Bozuk kayıt: DOKUNMA. Silmek, kurtarılabilir veriyi yok etmek olurdu.
    return { kostu: false, sembol: 0, not: 'Kayıt okunamadı; eski veri olduğu gibi bırakıldı.' };
  }
  const duz = Array.isArray(cozuk) && cozuk.every((x) => typeof x === 'string');
  if (!duz) {
    // Zaten adlandırılmış şema (ya da tanınmayan şekil): dönüştürme YOK.
    await hamYaz(DEPO_GOC_ANAHTAR, String(DEPO_SURUM));
    await hamYaz(DEPO_SURUM_ANAHTAR, String(DEPO_SURUM));
    return { kostu: false, sembol: 0, not: 'Kayıt zaten adlandırılmış liste şemasında.' };
  }
  const { deger: items } = diziSuz(cozuk, listeOgeSuz, AZAMI_SEMBOL);
  const yeni: ListeKaydi[] = [
    { id: VARSAYILAN_LISTE_ID, name: VARSAYILAN_LISTE_AD, items, inUniverse: true, notify: true },
  ];
  // ③ önce YEDEK, sonra dönüştürme. Yedek yazılamazsa göç başlatılmaz.
  const yedekOk = await hamYaz(DEPO_YEDEK_ANAHTAR, ham);
  if (!yedekOk) {
    return { kostu: false, sembol: 0, not: 'Yedek yazılamadı; göç başlatılmadı, eski veri yerinde.' };
  }
  const yazildi = await hamYaz(ANAHTARLAR.listeler, JSON.stringify(yeni));
  if (!yazildi) {
    return { kostu: false, sembol: 0, not: 'Yazma başarısız; eski kayıt ve yedek yerinde.' };
  }
  await hamYaz(DEPO_GOC_ANAHTAR, String(DEPO_SURUM));
  await hamYaz(DEPO_SURUM_ANAHTAR, String(DEPO_SURUM));
  return {
    kostu: true,
    sembol: items.length,
    not: items.length + ' sembol "' + VARSAYILAN_LISTE_AD + '" listesine taşındı.',
  };
}

/** Açılış: göçü koşar, sonra tüm türleri okur. Fırlatmaz. */
export async function depoBaslat(): Promise<void> {
  await goc();
  await Promise.all(TUMU.map((t) => t.oku()));
}

/** Kayıt diskten değiştiyse (başka yazar) belleği tazeler. */
export async function listelerTazele(): Promise<void> {
  const ham = await hamOku(ANAHTARLAR.listeler);
  let cozuk: unknown = null;
  if (ham != null) {
    try {
      cozuk = JSON.parse(ham);
    } catch {
      return; // bozuk kayıt: bellekteki iyi değeri ezmeyiz
    }
  }
  const { deger } = listelerSuz(cozuk);
  // YAZMIYOR: kayıt az önce başka bir yazar tarafından yazıldı; ikinci
  // yazma aynı içeriği kotaya ikinci kez ödetirdi.
  listelerDepo.bellegeKoy(deger);
}

// ---------------------------------------------------------------------
//  10. ADLANDIRILMIŞ LİSTE İŞLEMLERİ — sınır SEBEBİYLE reddedilir
// ---------------------------------------------------------------------

function kimlikUret(onek: string): string {
  return onek + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function listeleriAl(): ListeKaydi[] {
  return listelerDepo.al();
}

export async function listeOlustur(ad: string): Promise<YazSonuc> {
  const nm = metin(ad).trim();
  if (!nm) return { ok: false, sebep: 'bos', mesaj: 'Liste adı yazılmadı.' };
  const listeler = listelerDepo.al();
  if (listeler.some((l) => l.name.toLocaleUpperCase('tr-TR') === nm.toLocaleUpperCase('tr-TR'))) {
    return { ok: false, sebep: 'zaten_var', mesaj: nm + ' adlı liste zaten var.' };
  }
  const yeni: ListeKaydi = { id: kimlikUret('l'), name: nm, items: [], inUniverse: true, notify: true };
  const yazildi = await listelerDepo.yaz([...listeler, yeni]);
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

const YAZILAMADI =
  'Cihaz deposuna yazılamadı (yer dolu ya da özel pencere). Değişiklik bu oturumda geçerli, uygulama kapanınca kaybolur.';

export async function listeSil(id: string): Promise<YazSonuc> {
  const listeler = listelerDepo.al();
  if (!listeler.some((l) => l.id === id)) {
    return { ok: false, sebep: 'yok', mesaj: 'Liste bulunamadı.' };
  }
  const yazildi = await listelerDepo.yaz(listeler.filter((l) => l.id !== id));
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

export async function listeYenidenAdlandir(id: string, ad: string): Promise<YazSonuc> {
  const nm = metin(ad).trim();
  if (!nm) return { ok: false, sebep: 'bos', mesaj: 'Liste adı yazılmadı.' };
  const listeler = listelerDepo.al();
  if (!listeler.some((l) => l.id === id)) {
    return { ok: false, sebep: 'yok', mesaj: 'Liste bulunamadı.' };
  }
  const yazildi = await listelerDepo.yaz(listeler.map((l) => (l.id === id ? { ...l, name: nm } : l)));
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/** Liste evrene dahil mi (web'in "evrene dahil et" kutucuğu, app.js:1678). */
export async function listeEvreneAl(id: string, dahil: boolean): Promise<YazSonuc> {
  const listeler = listelerDepo.al();
  if (!listeler.some((l) => l.id === id)) {
    return { ok: false, sebep: 'yok', mesaj: 'Liste bulunamadı.' };
  }
  const yazildi = await listelerDepo.yaz(
    listeler.map((l) => (l.id === id ? { ...l, inUniverse: dahil } : l)),
  );
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/**
 * Listeye sembol ekler. SINIR LİSTE BAŞINA 8 (`AZAMI_SEMBOL`): bir liste
 * tek bir uç turuna karşılık geliyor ve uç nokta aşımı KIRPMIYOR, 400 ile
 * reddediyor (api/_girdi.js, liste.ts:30-33). Birden çok liste olabilir,
 * ama tek çağrıya 8'den fazla sembol gitmez. Aşım SESSİZ DEĞİL: sebep döner.
 */
export async function listeyeEkle(id: string, hamSembol: string): Promise<YazSonuc> {
  const sembol = sembolNormal(hamSembol);
  if (!sembol) return { ok: false, sebep: 'bos', mesaj: 'Sembol yazılmadı.' };
  const listeler = listelerDepo.al();
  const liste = listeler.find((l) => l.id === id);
  if (!liste) return { ok: false, sebep: 'yok', mesaj: 'Liste bulunamadı.' };
  if (liste.items.some((i) => i.symbol === sembol)) {
    return { ok: false, sebep: 'zaten_var', mesaj: sembol + ' bu listede zaten var.' };
  }
  if (liste.items.length >= AZAMI_SEMBOL) {
    return {
      ok: false,
      sebep: 'dolu',
      mesaj:
        '"' +
        liste.name +
        '" dolu: motor tek turda en çok ' +
        AZAMI_SEMBOL +
        ' sembol ölçüyor. Önce bir sembol çıkar ya da yeni liste aç.',
    };
  }
  const oge: ListeOge = { symbol: sembol, market: pazarOf(sembol), query: sembol };
  const yazildi = await listelerDepo.yaz(
    listeler.map((l) => (l.id === id ? { ...l, items: [...l.items, oge] } : l)),
  );
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

export async function listedenCikar(id: string, hamSembol: string): Promise<YazSonuc> {
  const sembol = sembolNormal(hamSembol);
  const listeler = listelerDepo.al();
  const liste = listeler.find((l) => l.id === id);
  if (!liste) return { ok: false, sebep: 'yok', mesaj: 'Liste bulunamadı.' };
  if (!liste.items.some((i) => i.symbol === sembol)) {
    return { ok: false, sebep: 'yok', mesaj: sembol + ' bu listede yok.' };
  }
  const yazildi = await listelerDepo.yaz(
    listeler.map((l) =>
      l.id === id ? { ...l, items: l.items.filter((i) => i.symbol !== sembol) } : l,
    ),
  );
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/**
 * Motora gidecek sembol evreni: `inUniverse !== false` listelerin
 * tekilleştirilmiş sembolleri (web `getPortfolio()`, app.js:1675 aynı
 * kural). SINIR UÇ TURU BAŞINA 8 — fazlası `budandi` ile bildirilir,
 * sessizce kesilmez.
 */
export function evrenSemboller(): { semboller: string[]; budandi: boolean } {
  const cikti: string[] = [];
  let budandi = false;
  for (const l of listelerDepo.al()) {
    if (l.inUniverse === false) continue;
    for (const i of l.items) {
      if (cikti.includes(i.symbol)) continue;
      if (cikti.length >= AZAMI_SEMBOL) {
        budandi = true;
        return { semboller: cikti, budandi };
      }
      cikti.push(i.symbol);
    }
  }
  return { semboller: cikti, budandi };
}

// ---------------------------------------------------------------------
//  11. NAKİT — AYRI TÜR DEĞİL, sepetin `cls:'cash'` kalemleri
// ---------------------------------------------------------------------
//  ÖLÇÜLDÜ: app.js:3181 `findCashHolding(arr, cur)` /
//  app.js:3182 `cashBalance(cur)`. Bakiye `qty` alanında, para birimi
//  `symbol` alanında (TRY/USD). Burada yalnız OKUMA var; yazma sepet
//  türünden geçer, çünkü ikinci bir yer uydurmak iki doğruluk kaynağı
//  demekti. HESAP YOK: kur çevirimi, toplam, yüzde — hiçbiri burada değil.
// ---------------------------------------------------------------------

export function nakitBakiye(paraBirimi: string): number | null {
  const pb = metin(paraBirimi).toUpperCase() || 'TRY';
  const kalem = sepetDepo.al().find((h) => h.cls === 'cash' && (h.symbol || 'TRY').toUpperCase() === pb);
  // Kalem YOKSA `null` ("girilmemiş"), kalem varsa `qty` olduğu gibi —
  // `0` bakiye ile "bakiye girilmemiş" AYNI ŞEY DEĞİL.
  return kalem ? kalem.qty : null;
}

// ---------------------------------------------------------------------
//  12. SINIRLI EKLEME YARDIMCILARI — web'in sınırları, SEBEPLE
// ---------------------------------------------------------------------

export async function kiyasaEkle(hamSembol: string, pazar?: string): Promise<YazSonuc> {
  const sembol = sembolNormal(hamSembol);
  if (!sembol) return { ok: false, sebep: 'bos', mesaj: 'Sembol yazılmadı.' };
  const mevcut = kiyasDepo.al();
  const mkt = metin(pazar) || pazarOf(sembol);
  if (mevcut.some((i) => i.symbol === sembol && i.market === mkt)) {
    return { ok: false, sebep: 'zaten_var', mesaj: sembol + ' kıyas setinde zaten var.' };
  }
  if (mevcut.length >= AZAMI_KIYAS) {
    return {
      ok: false,
      sebep: 'dolu',
      mesaj:
        'Karşılaştır bölümündeki ' +
        AZAMI_KIYAS +
        ' slotun hepsi dolu — yeni sembol eklemek için önce birini çıkar.',
    };
  }
  const yazildi = await kiyasDepo.yaz([...mevcut, { symbol: sembol, market: mkt, query: sembol }]);
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/** Son aramalar: en yeni başa, sınır 12 (app.js:2174). Yineleme taşınır. */
export async function aramaHatirla(hamSembol: string, pazar?: string): Promise<YazSonuc> {
  const sembol = sembolNormal(hamSembol);
  if (!sembol) return { ok: false, sebep: 'bos', mesaj: 'Sembol yazılmadı.' };
  const mkt = metin(pazar) || pazarOf(sembol);
  const kalan = aramalarDepo.al().filter((x) => !(x.symbol === sembol && x.market === mkt));
  const yazildi = await aramalarDepo.yaz(
    [{ symbol: sembol, market: mkt }, ...kalan].slice(0, AZAMI_ARAMA),
  );
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

export async function gostergeEkle(gosterge: Gosterge): Promise<YazSonuc> {
  const suzuk = gostergeSuz(gosterge);
  if (!suzuk) return { ok: false, sebep: 'bos', mesaj: 'Gösterge tanınmadı.' };
  const mevcut = gostergelerDepo.al();
  if (mevcut.some((g) => g.id === suzuk.id)) {
    return { ok: false, sebep: 'zaten_var', mesaj: suzuk.label + ' şeritte zaten var.' };
  }
  if (mevcut.length >= AZAMI_GOSTERGE) {
    return {
      ok: false,
      sebep: 'dolu',
      mesaj:
        'Şeritte en çok ' +
        AZAMI_GOSTERGE +
        ' özel gösterge var olabilir — önce birini kaldır.',
    };
  }
  const yazildi = await gostergelerDepo.yaz([...mevcut, suzuk]);
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/** Hamle günlüğüne satır. Sınır 500 (app.js:2246): en ESKİ satır düşer. */
export async function hamleEkle(hamle: Omit<Hamle, 'id' | 'ts'> & Partial<Pick<Hamle, 'id' | 'ts'>>): Promise<YazSonuc> {
  const kayit = hamleSuz({
    ...hamle,
    id: hamle.id || kimlikUret('m'),
    ts: hamle.ts || new Date().toISOString(),
  });
  if (!kayit) return { ok: false, sebep: 'bos', mesaj: 'Hamle kaydı tanınmadı.' };
  const mevcut = hamlelerDepo.al();
  const yazildi = await hamlelerDepo.yaz([...mevcut, kayit].slice(-AZAMI_HAMLE));
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

/** Günlük sepet anlık görüntüsü. Aynı güne İKİNCİ kayıt yazılmaz (app.js:2589). */
export async function gecmisKaydet(kayit: SepetGecmisKaydi): Promise<YazSonuc> {
  const suzuk = gecmisSuz(kayit);
  if (!suzuk) return { ok: false, sebep: 'bos', mesaj: 'Geçmiş kaydı tanınmadı.' };
  const mevcut = [...sepetGecmisDepo.al()];
  if (mevcut.length && mevcut[mevcut.length - 1].date === suzuk.date) {
    mevcut[mevcut.length - 1] = suzuk;
  } else {
    mevcut.push(suzuk);
  }
  const yazildi = await sepetGecmisDepo.yaz(mevcut.slice(-AZAMI_GECMIS));
  return yazildi ? { ok: true } : { ok: false, sebep: 'yazilamadi', mesaj: YAZILAMADI };
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
