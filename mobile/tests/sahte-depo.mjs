// =====================================================================
//  SAHTE DEPO — `@/lib/kalici` yerine geçen bellek-içi yedek
// ---------------------------------------------------------------------
//  NEDEN GEREKLİ: `src/api/liste.ts`, `@/lib/kalici` üzerinden
//  `@react-native-async-storage/async-storage` içe aktarıyor. O paket
//  yerel bir RN modülü bekler; saf Node'da yüklenmez. Testin kendisi
//  liste.ts'i KOPYALAMASIN diye (kök repo kuralı: "motor kopyalanırsa iki
//  sürüm doğar ve test kendi kopyasını doğrular, yani hiçbir şeyi")
//  gerçek liste.ts yükleniyor, yalnız DEPO AYAĞI bu dosyayla
//  değiştiriliyor — `tests/cozucu.mjs` içindeki çözücü kancası ile.
//
//  NE TAKLİT EDİLİYOR: yalnız liste.ts'in kullandığı iki işlev
//  (`listeOku`, `listeYaz`). Başka bir şey eklenmedi.
//
//  AĞ YOK · DOSYA YOK: her şey bellekte, deterministik.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Açılışta liste.ts'e verilecek okuma sonucu. Test bunu ÖNCE kurar. */
let okumaSonuc = { semboller: null, budandi: false };

/** liste.ts'in depoya YAZDIĞI her şey — yazma gerçekten oldu mu diye. */
export const yazmalar = [];

/** Test kurulumu: liste.ts içe aktarılmadan ÖNCE çağrılır. */
export function kur(sonuc) {
  okumaSonuc = sonuc;
  yazmalar.length = 0;
}

export async function listeOku() {
  return okumaSonuc;
}

export async function listeYaz(semboller) {
  yazmalar.push([...semboller]);
}

export async function depoCalisiyorMu() {
  return true;
}

export const DEPO_ANAHTAR = 'sb:lists';
export const SURUM_ANAHTAR = 'sb:lists:surum';
export const SEMA_SURUM = 1;
