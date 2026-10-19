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
//  NEDEN KALICI DEĞİL (ÖNEMLİ, DÜRÜST SINIR): bu depo BELLEKTE. Uygulama
//  kapanınca ya da sayfa yenilenince başlangıç listesine döner.
//  Nedeni ölçülmüş bir eksiklik: `mobile/package.json`da bir kalıcılık
//  bağımlılığı YOK (AsyncStorage kurulu değil) ve yol haritası Listeler
//  maddesini doğrudan **Supabase senkronuna** bağlıyor — anahtar
//  olmadan o ayak kurulamıyor (`api/supabase.ts` bunu dürüstçe söylüyor).
//  Yarım bir yerel kalıcılık yazmak, sonra Supabase gelince ikinci bir
//  doğruluk kaynağı demekti. Bu yüzden KALICILIK AÇIK BIRAKILDI ve
//  ekranda yazıyor — "bitti" denmiyor.
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
const dinleyiciler = new Set<() => void>();

function yayinla() {
  for (const d of dinleyiciler) d();
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
  yayinla();
  return { ok: true, sembol };
}

export function cikar(ham: string): void {
  const sembol = normalizeSembol(ham);
  if (!liste.includes(sembol)) return;
  liste = liste.filter((s) => s !== sembol);
  yayinla();
}

export function doluMu(): boolean {
  return liste.length >= AZAMI_SEMBOL;
}

/** Ekranların okuma yolu. Liste değişince abone ekranlar yeniden çizilir. */
export function useListe(): string[] {
  return useSyncExternalStore(abone, anlik, anlik);
}
