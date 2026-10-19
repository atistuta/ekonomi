// =====================================================================
//  TAKİP LİSTESİ — tek kaynak, üç ekranın paylaştığı durum (FAZ 2)
// ---------------------------------------------------------------------
//  NE: kullanıcının izlediği semboller. Listeler, Bugün ve Keşfet AYNI
//  listeyi okuyor; Arama ekranı ona sembol ekliyor.
//
//  NEDEN MODÜL DÜZEYİNDE DEPO VE `useState` DEĞİL: sekmeler arası
//  paylaşılan bir durum. Her sekme kendi `useState`ini tutsa, Arama'dan
//  eklenen sembol Listeler'de görünmezdi. React 18'in
//  `useSyncExternalStore`u tam bu iş için var ve bir bağımlılık
//  (Zustand/Redux) eklemeden çözüyor.
//
//  KALICILIK (FAZ 3, KAPANDI): depo artık cihazda saklanıyor
//  (`lib/kalici.ts`, AsyncStorage, web'le aynı `sb:lists` anahtarı ve
//  şekli). Açılışta kayıt OKUNUR, her değişiklikte YAZILIR. Bulut
//  senkronu (Supabase) hâlâ ayrı bir ayak ve anahtarı yok; yerel kayıt
//  o gelene kadar TEK doğruluk kaynağı, geldiğinde de cihaz-önbelleği
//  olarak aynı şekli konuşuyor — çevirici gerekmeyecek.
//
//  NEDEN "HAZIR" BAYRAĞI: depo okuması asenkron. Bayrak olmasaydı
//  ekranlar önce açılış listesiyle motora gider, kayıt gelince ikinci
//  kez giderdi — iki tur, iki anlık görüntü. Ekranlar `useHazir()`
//  ile BEKLİYOR; iskelet gösteriliyor, sahte veri değil.
//
//  NEDEN BAŞLANGIÇ LİSTESİ VAR: web'de de tek-seferlik tohum listeler var
//  (bkz. "🤖 Robot" listesi). Sembol ADI bir ölçüm DEĞİL — uydurma veri
//  değil. Bu satırlardaki her SAYI uçtan geliyor; liste boş olsaydı
//  ekranlar "veri yok" gösterir ve motor bağlantısı hiç ölçülemezdi.
//
//  NEDEN SINIR 8: motor sözleşmesi (`AZAMI_SEMBOL`, api/_girdi.js). Uç
//  nokta aşımı kırpmıyor, 400 ile reddediyor. Depo 8'den fazlasını kabul
//  ederse ekran topluca "çok sembol" hatası gösterirdi; bu yüzden ekleme
//  sınırda SESSİZCE başarısız olmuyor, `ekle()` sebep döndürüyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useSyncExternalStore } from 'react';

import { listeOku, listeYaz } from '@/lib/kalici';

import { AZAMI_SEMBOL } from './types';

/**
 * Başlangıç listesi — iki pazardan karışık, BİLEREK.
 *
 * NEDEN HEM ABD HEM BIST: iki ayrı veri ayağı (Yahoo+SEC / Yahoo+İş
 * Yatırım) ve ölçüldü ki ABD tarafında SEC kesintisi FA skorunu `null`
 * bırakabiliyor (2026-10-18 canlı ölçüm). Liste tek pazardan olsaydı
 * "ölçülemedi" durumu ya hiç görünmez ya her satırda görünürdü — ikisi
 * de yanıltıcı.
 */
export const BASLANGIC_LISTE: readonly string[] = [
  'AAPL',
  'MSFT',
  'NVDA',
  'THYAO.IS',
  'ASELS.IS',
];

export type EkleSonuc =
  | { ok: true; sembol: string }
  | { ok: false; sebep: 'bos' | 'zaten_var' | 'dolu'; mesaj: string };

let liste: string[] = [...BASLANGIC_LISTE];
/** Depo okuması bitti mi? Ekranlar bunu bekler (bkz. başlık notu). */
let hazir = false;
/** Kayıttan bir kısmı atıldı mı — ekranda dürüstçe söylenir. */
let budandi = false;
const dinleyiciler = new Set<() => void>();

function yayinla() {
  for (const d of dinleyiciler) d();
}

/** Depoya yazma: ateşle-ve-unut, ama SESSİZ DEĞİL — kalici.ts yutuyor. */
function kaydet() {
  void listeYaz(liste);
}

/**
 * Açılışta kaydı okur. Kayıt yoksa (ilk kurulum) açılış listesi
 * YAZILIR — web'in `loadLists()` davranışıyla aynı (app.js: tohumu
 * kaydeder). Böylece kullanıcının ilk silmesi de kalıcı olur.
 */
const hazirlandi: Promise<void> = (async () => {
  const sonuc = await listeOku();
  if (sonuc.semboller) {
    liste = sonuc.semboller;
  } else {
    void listeYaz(liste);
  }
  budandi = sonuc.budandi;
  hazir = true;
  yayinla();
})();

/** Testler/ölçüm için: depo okuması bitene kadar bekler. */
export function depoHazir(): Promise<void> {
  return hazirlandi;
}

function hazirAnlik(): boolean {
  return hazir;
}

/** Ekranlar motora gitmeden önce depo okumasını bekler. */
export function useHazir(): boolean {
  return useSyncExternalStore(abone, hazirAnlik, hazirAnlik);
}

/** Kayıttan bozuk/aşan satır atıldı mı? Dürüstlük notu için. */
export function kayitBudandiMi(): boolean {
  return budandi;
}

function abone(d: () => void) {
  dinleyiciler.add(d);
  return () => dinleyiciler.delete(d);
}

function anlik(): string[] {
  return liste;
}

/** Sembolü uç noktanın beklediği biçime getirir: trim + BÜYÜK harf. */
export function normalizeSembol(ham: string): string {
  return String(ham ?? '')
    .trim()
    .toUpperCase();
}

export function listeAl(): string[] {
  return liste;
}

export function ekle(ham: string): EkleSonuc {
  const sembol = normalizeSembol(ham);
  if (!sembol) {
    return { ok: false, sebep: 'bos', mesaj: 'Sembol yazılmadı.' };
  }
  if (liste.includes(sembol)) {
    return { ok: false, sebep: 'zaten_var', mesaj: sembol + ' listede zaten var.' };
  }
  if (liste.length >= AZAMI_SEMBOL) {
    return {
      ok: false,
      sebep: 'dolu',
      mesaj:
        'Liste dolu: motor tek turda en çok ' +
        AZAMI_SEMBOL +
        ' sembol ölçüyor. Önce bir sembol çıkar.',
    };
  }
  liste = [...liste, sembol];
  kaydet();
  yayinla();
  return { ok: true, sembol };
}

export function cikar(ham: string): void {
  const sembol = normalizeSembol(ham);
  if (!liste.includes(sembol)) return;
  liste = liste.filter((s) => s !== sembol);
  kaydet();
  yayinla();
}

export function doluMu(): boolean {
  return liste.length >= AZAMI_SEMBOL;
}

/** Ekranların okuma yolu. Liste değişince abone ekranlar yeniden çizilir. */
export function useListe(): string[] {
  return useSyncExternalStore(abone, anlik, anlik);
}
