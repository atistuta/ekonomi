// =====================================================================
//  SUPABASE İSTEMCİSİ — yapılandırılmamış olabilir    (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Supabase istemcisini env'den kurar. Anahtar yoksa KURMAZ ve
//  bunu dürüstçe söyler — uygulama çökmez, ekran "senkron kapalı" der.
//
//  NEDEN ANAHTAR YOK: Supabase projesi henüz açılmadı. Yol haritasında
//  Supabase'in işi FAZ 2 (listelerin cihazlar arası senkronu) ve FAZ 4
//  (Apple/Google ile giriş). FAZ 1'in işi yalnız BAĞLANTI NOKTASINI
//  kurmak. Sahte bir anahtar yazmak en kötü seçenek olurdu: kod
//  "yapılandırılmış" görünür, çalışma anında anlamsız 401'ler döner ve
//  teşhis saatler alır. Bu yüzden eksiklik AÇIKÇA modellendi.
//
//  NEDEN `null` DÖNÜYOR, ATMIYOR: modül yüklenirken `throw` etmek
//  uygulamayı ilk karede beyaz ekrana düşürürdü. Senkron, ürünün
//  ÇEKİRDEĞİ DEĞİL — skorlar motor API'den geliyor. Supabase yoksa
//  uygulama yerel verilerle çalışmaya devam etmeli.
//
//  NEDEN OTURUM KALICI DEĞİL: `persistSession` React Native'de
//  AsyncStorage ister (kurulu değil, FAZ 4'ün işi). Şimdi `true`
//  bırakılırsa supabase-js web'deki `localStorage`'a tutunur, native'de
//  uyarı basar. Kalıcı oturum FAZ 4'te bilinçli kurulacak.
//
//  Kurulum (anahtarlar geldiğinde): `mobile/.env.example`'ı
//  `mobile/.env.local` olarak kopyalayıp iki değeri doldur.
//  `.env*.local` git'te yok (mobile/.gitignore).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** İkisi de doluysa yapılandırılmış sayılır. Biri eksikse değil. */
export const isSupabaseConfigured: boolean = Boolean(url && anonKey);

/**
 * İstemci — yapılandırılmamışsa `null`. Doğrudan kullanmak yerine
 * `getSupabase()` tercih edilsin: oradaki ayrık birleşim, çağıranı
 * eksik yapılandırmayı ele almaya zorlar.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        // URL'de oturum arama yalnız web OAuth akışında anlamlı (FAZ 4).
        detectSessionInUrl: false,
      },
    })
  : null;

export type SupabaseState =
  | { ok: true; client: SupabaseClient }
  | { ok: false; reason: 'not-configured'; message: string };

/**
 * Senkron katmanına erişim. "Yapılandırılmadı" bir HATA değil, geçerli
 * bir durum — ekranlar bunu kendi boş durumlarında gösterir.
 */
export function getSupabase(): SupabaseState {
  if (supabase) return { ok: true, client: supabase };
  return {
    ok: false,
    reason: 'not-configured',
    message:
      'Bulut senkronu yapılandırılmadı — listeler yalnız bu cihazda tutuluyor. ' +
      'Senkron FAZ 2/FAZ 4 ile açılacak.',
  };
}
