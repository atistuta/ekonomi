// =====================================================================
//  KALICI DEPO — listeler cihazda saklanır            (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: kullanıcının takip listesini cihazda tutar. Uygulama kapanıp
//  açılınca liste yerinde durur.
//
//  NEDEN AsyncStorage: tek ihtiyaç "küçük bir JSON kalıcı kalsın".
//  SecureStore gizli veri için (burada gizli veri YOK — yalnız sembol
//  adları), SQLite ise şema/göç yükü getirir ve web lab'ında wasm
//  gerektirir. AsyncStorage web'de `localStorage`a düşüyor, yani
//  tarayıcı laboratuvarında da GERÇEKTEN kalıcı — kanıtlanabilir.
//
//  NEDEN ŞEKİL WEB'DEN KOPYA: web PWA listeleri `localStorage`da
//  `sb:lists` anahtarında, `[{ id, name, items:[{symbol,market,query}] }]`
//  biçiminde tutuyor (app.js:1892 `LISTS_LS_KEY` / `loadLists`). Aynı
//  anahtar ve aynı şekil kullanıldı; böylece ileride bulut senkronu ya
//  da web→native içe aktarma geldiğinde ÇEVİRİCİ yazmak gerekmiyor.
//  Web dosyalarına DOKUNULMADI.
//
//  NEDEN AYRI SÜRÜM ANAHTARI (`sb:lists:surum`): şema sürümünü kaydın
//  İÇİNE koymak web'in dizi şeklini bozardı (web `Array.isArray`
//  bekliyor, app.js:1895). Sürüm komşu anahtarda duruyor: kayıt
//  web-uyumlu kalıyor, göç yolu da açık. Sürümü olmayan kayıt =
//  "web'den gelmiş / eski" sayılır ve v1 gibi okunur.
//
//  NEDEN HER OKUMA SAVUNMALI: depodaki kayıt kullanıcının cihazında
//  bozulabilir (yarım yazma, elle müdahale, eski sürüm). `JSON.parse`
//  tek başına uygulamayı ÇÖKERTİR. Burada her alan tek tek süzülüyor;
//  tanımadığı şeyi atıyor, hiçbir koşulda fırlatmıyor. En kötü durum
//  "kayıt yok" — açılış listesine dönülür, uygulama açılır.
//
//  BURADA HESAP YOK: saklanan tek şey sembol adları. Skor, eşik,
//  sıralama ya da gösterge yok; her sayı uçtan geliyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AZAMI_SEMBOL } from '@/api/types';

/** Web ile AYNI anahtar (app.js:1892 `LISTS_LS_KEY`). */
export const DEPO_ANAHTAR = 'sb:lists';
/** Şema sürümü komşu anahtarda — web'in dizi şekli bozulmasın. */
export const SURUM_ANAHTAR = 'sb:lists:surum';
/** Bugünkü şema sürümü. Şekil değişirse ARTAR ve `goc()` köprü kurar. */
export const SEMA_SURUM = 1;

/** Native tarafın tuttuğu tek listenin kimliği. */
const MOBIL_LISTE_ID = 'mobil';
const MOBIL_LISTE_AD = 'Takip';

/** Web kaydındaki tek satır. Alanlar web'deki adlarla BİREBİR. */
type DepoOge = { symbol: string; market: string; query: string };
type DepoListe = { id: string; name: string; items: DepoOge[]; [k: string]: unknown };

export type OkumaSonuc = {
  /** Süzülmüş semboller. Kayıt yoksa `null` — "boş liste" ile aynı şey DEĞİL. */
  semboller: string[] | null;
  /** Kayıt vardı ama bir kısmı atıldı mı (bozuk/aşım). Dürüstlük notu için. */
  budandi: boolean;
};

/**
 * Sembolden pazar türetir. BU BİR HESAP DEĞİL, biçim eşlemesi: `.IS`
 * soneki Borsa İstanbul demek (motor sözleşmesi, api/_girdi.js aynı
 * ayrımı yapıyor). Skorla, eşikle, sıralamayla ilgisi yok.
 */
function pazarOf(sembol: string): string {
  return sembol.endsWith('.IS') ? 'BIST' : 'US';
}

function normalize(ham: unknown): string {
  return String(ham ?? '')
    .trim()
    .toUpperCase();
}

/** Tek öğeyi süzer. Tanınmayan her şey `null` → atılır. */
function ogeSuz(ham: unknown): string | null {
  if (typeof ham === 'string') return normalize(ham) || null;
  if (ham && typeof ham === 'object') {
    const s = normalize((ham as { symbol?: unknown }).symbol);
    return s || null;
  }
  return null;
}

/**
 * Ham kaydı sembol listesine çevirir. ÇÖKMEZ: dizi değilse, öğeler
 * nesne değilse, `items` eksikse — hepsinde en kötü sonuç boş liste.
 */
function kayitSuz(ham: unknown): { semboller: string[]; budandi: boolean } {
  if (!Array.isArray(ham)) return { semboller: [], budandi: ham != null };
  let budandi = false;
  const cikti: string[] = [];
  for (const liste of ham) {
    const items = (liste as DepoListe | null)?.items;
    if (!Array.isArray(items)) {
      if (liste != null) budandi = true;
      continue;
    }
    for (const oge of items) {
      const s = ogeSuz(oge);
      if (!s) {
        budandi = true;
        continue;
      }
      if (cikti.includes(s)) continue;
      if (cikti.length >= AZAMI_SEMBOL) {
        // Motor turu başına sınır 8 (AZAMI_SEMBOL). Fazlası uçtan 400
        // dönerdi; sessizce kesip kullanıcıya NOT ediyoruz.
        budandi = true;
        break;
      }
      cikti.push(s);
    }
  }
  return { semboller: cikti, budandi };
}

/**
 * Sürüm göçü. Şu an tek sürüm var; köprü YAPISAL olarak duruyor ki
 * şema değişince okuma yolu değil bu fonksiyon değişsin.
 */
function goc(ham: unknown, surum: number): unknown {
  if (surum >= SEMA_SURUM) return ham;
  // v0 (sürüm anahtarı yok) = web'in kendi kaydı; şekli v1 ile aynı.
  return ham;
}

/** Kayıttan listeyi okur. Hiçbir koşulda fırlatmaz. */
export async function listeOku(): Promise<OkumaSonuc> {
  try {
    const [ham, surumHam] = await Promise.all([
      AsyncStorage.getItem(DEPO_ANAHTAR),
      AsyncStorage.getItem(SURUM_ANAHTAR),
    ]);
    if (ham == null) return { semboller: null, budandi: false };
    let cozuk: unknown;
    try {
      cozuk = JSON.parse(ham);
    } catch {
      // Bozuk JSON: kayıt yok sayılır, uygulama açılır.
      return { semboller: null, budandi: true };
    }
    const surum = Number(surumHam);
    const { semboller, budandi } = kayitSuz(goc(cozuk, Number.isFinite(surum) ? surum : 0));
    return { semboller, budandi };
  } catch {
    // Depo hiç açılmadıysa (özel pencere, kota) kalıcılık yoktur —
    // uygulama yine çalışır, sessizce açılış listesine düşer.
    return { semboller: null, budandi: false };
  }
}

/**
 * Listeyi yazar. Kayıttaki BAŞKA listeler (ör. web'den gelen "🤖 Robot")
 * aynen korunur: native tek liste gösteriyor ama başkasının verisini
 * silmiyor.
 */
export async function listeYaz(semboller: readonly string[]): Promise<void> {
  const items: DepoOge[] = semboller.map((s) => ({
    symbol: s,
    market: pazarOf(s),
    query: s,
  }));
  const mobil: DepoListe = { id: MOBIL_LISTE_ID, name: MOBIL_LISTE_AD, items };
  try {
    let digerleri: DepoListe[] = [];
    try {
      const ham = await AsyncStorage.getItem(DEPO_ANAHTAR);
      const cozuk = ham == null ? null : JSON.parse(ham);
      if (Array.isArray(cozuk)) {
        digerleri = cozuk.filter(
          (l): l is DepoListe =>
            !!l && typeof l === 'object' && (l as DepoListe).id !== MOBIL_LISTE_ID,
        );
      }
    } catch {
      // Eski kayıt okunamadı: üstüne yazmak, kalıcılığı hiç vermemekten iyi.
      digerleri = [];
    }
    await AsyncStorage.multiSet([
      [DEPO_ANAHTAR, JSON.stringify([mobil, ...digerleri])],
      [SURUM_ANAHTAR, String(SEMA_SURUM)],
    ]);
  } catch {
    // Yazma başarısız: oturum içi liste yine çalışır, sessiz kalınmaz —
    // çağıran taraf `kaliciMi` ile durumu ekranda gösteriyor.
  }
}

/** Depo gerçekten yazıp okuyabiliyor mu? Ekranda dürüstçe söylenir. */
export async function depoCalisiyorMu(): Promise<boolean> {
  const sinama = 'sb:depo:sinama';
  try {
    await AsyncStorage.setItem(sinama, '1');
    const geri = await AsyncStorage.getItem(sinama);
    await AsyncStorage.removeItem(sinama);
    return geri === '1';
  } catch {
    return false;
  }
}
