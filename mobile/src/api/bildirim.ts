// =====================================================================
//  BİLDİRİM — bu cihazın push jetonunu `/api/bildirim` ucuna taşıyan
//              katman                                      (şerit B)
// ---------------------------------------------------------------------
//  NE: bildirim iznini ister, cihazın Expo push jetonunu alır, senkron
//  kodunun altındaki buluta yazar ve sonucu CİHAZA (`sb:push`) saklar.
//
//  NEDEN AYRI DOSYA (tek-uç sarmalayıcısı değil): `./senkron` ile AYNI
//  gerekçe — burada depo + uç BİRLİKTE derleniyor (izin → jeton →
//  cihazdaki senkron kodu → uca yaz → kaydı sakla). `client.ts` yalnız
//  ağ katmanı; izin/jeton gibi CİHAZ yetenekleri oraya girmez.
//
//  KOD BOŞSA İSTEK ATILMAZ: senkron kodu girilmemişse ağa HİÇ
//  çıkılmıyor (`senkron.ts` `KAPALI_MESAJ` deseni). "Kapalı" ile
//  "hata" AYRI hâller; karıştırılmıyor.
//
//  CÜMLE BURADA ÜRETİLMİYOR: her yol yalnız bir `sebep` kodu döner,
//  Türkçe cümleyi `lib/sozluk.ts` seçer. Böylece aynı hâlin iki ayrı
//  cümlesi doğmuyor ve bu dosyada serbest metin birikmiyor.
//
//  JETON NE EKRANA NE LOGA: jeton kişiye özel bir adres. Dönen birleşim
//  jetonu YALNIZ `pushJetonAl`dan verir (çağıran onu depoya yazar);
//  `pushKur` sonucu jetonu TAŞIMAZ.
//
//  PROJE KİMLİĞİ GÖMÜLÜ DEĞİL: `getExpoPushTokenAsync` için gereken
//  `projectId`, `app.json`daki `extra.eas.projectId`den `expo-constants`
//  ile OKUNUYOR. Kaynağa ikinci bir kopya yazmak, biri değişince
//  ötekinin sessizce yanlış kalması demekti.
//
//  HESAP YOK: eşik/ağırlık/formül yok; uçtan gelen sayı olduğu gibi
//  taşınıyor.
//
//  ÖLÇÜLDÜ (kurulu tip tanımları, 2026-11-07):
//    · `expo-notifications` requestPermissionsAsync/getPermissionsAsync
//      → `NotificationPermissionsStatus` (`granted`, `status`,
//      `canAskAgain`) · `getExpoPushTokenAsync(options?)` →
//      `{ type: 'expo'; data: string }`, `options.projectId`
//      varsayılanı `Constants.expoConfig.extra.eas.projectId`.
//    · `expo-device` → `isDevice: boolean`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fetchBildirimDurum, pushJetonKaydet } from './client';
import { pushDepo, pushIzinYaz, pushJetonYaz, senkronDepo, type PushIzin } from './depo';
import type { BildirimDurumResponse } from './types';

/** Ucun kabul ettiği platform kümesi — `client.ts` kapısıyla aynı. */
type PushPlatform = 'ios' | 'android';

// ---------------------------------------------------------------------
//  1. İZİN
// ---------------------------------------------------------------------

export type BildirimIzinSonuc =
  | { ok: true; sebep: 'verildi'; izin: 'verildi' }
  | { ok: false; sebep: 'reddedildi' | 'sorulamadi'; izin: PushIzin };

/**
 * Bildirim iznini ister ve ÖLÇÜLEN hâli cihaza yazar.
 *
 * ÖNCE OKUNUYOR: izin zaten verilmişse sistem penceresi açılmıyor
 * (`getPermissionsAsync`); verilmemişse soruluyor.
 *
 * `sorulamadi` AYRI BİR HÂL: çağrı patlarsa "reddedildi" yazmıyoruz —
 * ölçülememiş hâli olumsuz ölçüme çevirmek sessiz uydurma olurdu. O
 * dalda depodaki `izin` DEĞİŞMEZ.
 */
export async function bildirimIzniIste(): Promise<BildirimIzinSonuc> {
  try {
    const mevcut = await Notifications.getPermissionsAsync();
    const durum = mevcut.granted ? mevcut : await Notifications.requestPermissionsAsync();
    const izin: PushIzin = durum.granted ? 'verildi' : 'reddedildi';
    await pushIzinYaz(izin);
    if (izin === 'verildi') return { ok: true, sebep: 'verildi', izin };
    return { ok: false, sebep: 'reddedildi', izin };
  } catch {
    // Depoya YAZMIYORUZ: ölçüm yapılamadı, önceki hâl geçerli kalsın.
    return { ok: false, sebep: 'sorulamadi', izin: pushDepo.al().izin };
  }
}

// ---------------------------------------------------------------------
//  2. JETON
// ---------------------------------------------------------------------

export type PushJetonSonuc =
  | { ok: true; sebep: 'alindi'; jeton: string; platform: PushPlatform }
  | {
      ok: false;
      sebep: 'cihaz_degil' | 'platform_disi' | 'proje_yok' | 'jeton_alinamadi';
    };

/**
 * `app.json` → `extra.eas.projectId`. `expo-constants` `extra`yı
 * tiplenmemiş sözlük olarak veriyor; burada DARALTILIYOR, `any`
 * sızdırılmıyor. Değer yoksa `null` — uydurma kimlik üretilmiyor.
 */
function projeKimligi(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  if (!extra || typeof extra !== 'object') return null;
  const eas: unknown = (extra as Record<string, unknown>).eas;
  if (!eas || typeof eas !== 'object') return null;
  const kimlik: unknown = (eas as Record<string, unknown>).projectId;
  return typeof kimlik === 'string' && kimlik.trim() !== '' ? kimlik.trim() : null;
}

/**
 * Bu cihazın Expo push jetonunu alır.
 *
 * `cihaz_degil` BİR ARIZA DEĞİL: benzeticide/emülatörde push jetonu
 * ALINAMAZ (`Device.isDevice === false`). Bunu "hata" saymak,
 * geliştirme sırasında ekranda sürekli yanlış bir bilgi basmak olurdu —
 * bu yüzden ayrı bir hâl olarak dönüyor.
 *
 * `platform_disi`: uç yalnız 'ios'/'android' kabul ediyor; webde bu yol
 * hiç çalıştırılmamalı.
 *
 * İZNİ BURADA İSTEMİYOR: izin ayrı bir adım (`bildirimIzniIste`), çünkü
 * kullanıcıya sistem penceresini AÇAN eylem açıkça görünür kalmalı.
 */
export async function pushJetonAl(): Promise<PushJetonSonuc> {
  if (!Device.isDevice) return { ok: false, sebep: 'cihaz_degil' };

  const platform = Platform.OS;
  if (platform !== 'ios' && platform !== 'android') {
    return { ok: false, sebep: 'platform_disi' };
  }

  const projectId = projeKimligi();
  if (!projectId) return { ok: false, sebep: 'proje_yok' };

  try {
    const jeton = await Notifications.getExpoPushTokenAsync({ projectId });
    const deger = String(jeton?.data ?? '').trim();
    if (deger === '') return { ok: false, sebep: 'jeton_alinamadi' };
    return { ok: true, sebep: 'alindi', jeton: deger, platform };
  } catch {
    // Yakalanan hata METNİ yüzeye çıkmıyor: jetonu/kimliği taşıyabilir.
    return { ok: false, sebep: 'jeton_alinamadi' };
  }
}

// ---------------------------------------------------------------------
//  3. KURULUM (izin → jeton → uca yaz → cihaza sakla)
// ---------------------------------------------------------------------

export type PushKurSebep =
  | 'kapali'
  | 'reddedildi'
  | 'sorulamadi'
  | 'cihaz_degil'
  | 'platform_disi'
  | 'proje_yok'
  | 'jeton_alinamadi'
  | 'uc_hatasi';

export type PushKurSonuc =
  | {
      ok: true;
      sebep: 'kuruldu';
      /** Buluttaki kayıtlı cihaz sayısı — UÇTA sayıldı. */
      sayi: number;
      /** UNIX MİLİSANİYE — ucun bildirdiği an. */
      updatedAt: number;
      /** Cihaz deposuna yazılamadıysa `false`: kayıt bu oturumluk. */
      saklandi: boolean;
    }
  | {
      ok: false;
      sebep: PushKurSebep;
      /** Ucun MAKİNE hata kodu — cümleyi sözlük seçer. `null` = yok. */
      kod: string | null;
    };

/**
 * Tüm zinciri yürütür. SIRA BİLİNÇLİ:
 *   ① senkron kodu — BOŞSA ağa HİÇ çıkılmaz ve izin penceresi de
 *     AÇILMAZ. Kullanıcıdan izin isteyip sonra "kod yok" demek, bir şey
 *     olmayacağını bilerek sistem penceresi açmak olurdu.
 *   ② izin · ③ jeton · ④ uca yazma · ⑤ cihaza saklama.
 *
 * Her duraktan AYRI `sebep` dönüyor; cümleyi sözlük üretiyor.
 */
export async function pushKur(signal?: AbortSignal): Promise<PushKurSonuc> {
  // `al()` yalnız bellekteki kopyayı verir; kart henüz okumamış
  // olabilir — bu yüzden depodan OKUNUYOR.
  const ayar = await senkronDepo.oku();
  if (!ayar.kod) return { ok: false, sebep: 'kapali', kod: null };

  const izin = await bildirimIzniIste();
  if (!izin.ok) return { ok: false, sebep: izin.sebep, kod: null };

  const jeton = await pushJetonAl();
  if (!jeton.ok) return { ok: false, sebep: jeton.sebep, kod: null };

  const yanit = await pushJetonKaydet(
    ayar.kod,
    { token: jeton.jeton, platform: jeton.platform },
    { signal },
  );
  if (!yanit.ok) {
    return { ok: false, sebep: 'uc_hatasi', kod: yanit.error.code ?? null };
  }

  // Uca YAZILDIĞI an ucun bildirdiği `updatedAt`ten türetiliyor; cihaz
  // saatiyle "şimdi" yazmak ölçülmemiş bir an uydurmak olurdu.
  const ts = new Date(yanit.data.updatedAt).toISOString();
  const saklandi = await pushJetonYaz(jeton.jeton, jeton.platform, ts);
  return {
    ok: true,
    sebep: 'kuruldu',
    sayi: yanit.data.sayi,
    updatedAt: yanit.data.updatedAt,
    saklandi,
  };
}

// ---------------------------------------------------------------------
//  4. BULUT DURUMU (salt gösterim)
// ---------------------------------------------------------------------

export type BildirimDurumSonuc =
  | { ok: true; veri: BildirimDurumResponse }
  | { ok: false; sebep: 'kapali' | 'uc_hatasi'; kod: string | null };

/**
 * Bulutta o kodun altında KAÇ cihaz kayıtlı olduğunu okur.
 *
 * ⚠️ Uç JETON LİSTESİ DÖNDÜRMÜYOR (bilinçli sızıntı kapısı), bu yüzden
 * bu çağrı "BU cihaz kayıtlı mı?" sorusunu YANITLAMAZ. O yanıt cihazın
 * kendi kaydında (`sb:push`); ekran ikisini AYRI çizmek zorunda.
 */
export async function bildirimDurumOku(signal?: AbortSignal): Promise<BildirimDurumSonuc> {
  const ayar = await senkronDepo.oku();
  if (!ayar.kod) return { ok: false, sebep: 'kapali', kod: null };

  const sonuc = await fetchBildirimDurum(ayar.kod, { signal });
  if (!sonuc.ok) return { ok: false, sebep: 'uc_hatasi', kod: sonuc.error.code ?? null };
  return { ok: true, veri: sonuc.data };
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
