// =====================================================================
//  SENKRON — bildirim evrenini `/api/watchlist` ucuna taşıyan katman
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: cihazdaki listelerden BİLDİRİM EVRENİNİ kurup uca yazar, ve o
//  kodun altında bulutta NE DURDUĞUNU okur. Webin `pushWatchlistSync` /
//  `pullWatchlistSync` (`app.js:2262` / `app.js:2290`) karşılığı.
//
//  NEDEN GEREKLİ: native, her listenin `notify` anahtarını ZATEN
//  çeviriyordu (`ListeBlogu.tsx` → `listeBildirimAyarla`), ama bu değer
//  CİHAZDAN HİÇ ÇIKMIYORDU: `/api/watchlist` uygulamadan ne okunuyor ne
//  yazılıyordu (`fetchWatchlist`/`pushWatchlist` yazılı duruyordu,
//  ÇAĞIRANI YOKTU). Telefon bildirimini atan işçi (`worker/poll.mjs`)
//  KV'deki listeyi okuduğu için, uygulamadaki anahtar PRATİKTE
//  SÜSTÜ. Bu katman o boşluğu kapatıyor.
//
//  NEDEN AYRI DOSYA (tek-uç sarmalayıcısı değil): burada depo + uç
//  birlikte derleniyor (listeleri oku → evreni kur → yaz → dönen anı
//  sakla), `./neden` ve `./hareket` modüllerinin aynı gerekçesi.
//
//  WEBDEN BİLEREK AYRILAN İKİ NOKTA:
//   (1) KOD GÖMÜLÜ DEĞİL: web `SYNC_CODE`u kaynağa gömüyor
//       (`app.js:2235`, gerekçesi "kişisel uygulama"). Uçta kimlik
//       doğrulama YOK (§21.3) ve native mağazaya çıkacak — kod cihazda,
//       kullanıcının kendi yazdığı değer, varsayılanı BOŞ = KAPALI.
//   (2) UZAK `ui` KENDILIGINDEN BENIMSENMIYOR: web `adoptRemoteState`
//       ile uzaktan gelen `ui`yi her acilista localStorage'a YAZIYOR
//       (`app.js:2131`). Native bunu OTOMATIK yapmiyor — `senkronCek`
//       hala SALT GOSTERIM. Benimseme yalnizca kullanicinin BASTIGI
//       dugmeyle oluyor: `senkronListeAktar` (asagida). Gerekce: uzak
//       kayit paylasilan bir kodun altinda duruyor ve ucta kimlik
//       dogrulama yok (§21.3); her acilista sessizce benimsemek,
//       telefondaki listeleri kullanicinin bilmedigi bir anda
//       degistirirdi.
//
//  Ayrıca `ui` GÖNDERİLMİYOR (bkz. `client.ts` `pushWatchlist` notu):
//  gövde yalnız `list`/`portfolio` taşıyor.
//
//  HESAP YOK: bu dosyada eşik/ağırlık/formül yok, sayı üretilmiyor;
//  uçtan gelen sayılar olduğu gibi taşınıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  bildirimEvreni,
  senkronDepo,
  senkronZamanYaz,
  type BildirimEvreni,
} from './depo';
import { listeleriAktar, type ListeAktarSonuc } from './liste';
import { fetchWatchlist, pushWatchlist } from './client';
import type { WatchlistResponse, WatchlistYazResponse } from './types';

/** Kod boşsa hiçbir istek atılmaz; "kapalı" ile "hata" AYRI hâller. */
const KAPALI_MESAJ =
  'Senkron kodu girilmedi — bu cihazdaki listeler buluta gönderilmiyor.';

export type SenkronGonderSonuc =
  | { ok: true; evren: BildirimEvreni; yanit: WatchlistYazResponse }
  | { ok: false; sebep: 'kapali' | 'hata'; mesaj: string; evren: BildirimEvreni };

export type SenkronCekSonuc =
  | { ok: true; veri: WatchlistResponse }
  | { ok: false; sebep: 'kapali' | 'hata'; mesaj: string };

/**
 * Bildirim evrenini uca YAZAR. Başarıda ucun bildirdiği `updatedAt`
 * cihaza saklanıyor — ekran "en son ne zaman gönderildi" diyebilsin.
 *
 * BOŞ EVREN DE GÖNDERİLİR: hiçbir listede bildirim açık değilse uca
 * BOŞ liste yazmak doğru davranış (işçi artık kimseyi izlemesin).
 * Bu yüzden `kayitlar.length === 0` bir hata değil.
 */
export async function senkronGonder(signal?: AbortSignal): Promise<SenkronGonderSonuc> {
  const evren = bildirimEvreni();
  const kod = senkronDepo.al().kod;
  if (!kod) return { ok: false, sebep: 'kapali', mesaj: KAPALI_MESAJ, evren };

  // `portfolio: []` — webde de portföy kavramı kaldırıldı (app.js:2252).
  const sonuc = await pushWatchlist(kod, { list: evren.kayitlar, portfolio: [] }, { signal });
  if (!sonuc.ok) {
    return { ok: false, sebep: 'hata', mesaj: sonuc.error.message, evren };
  }
  await senkronZamanYaz(sonuc.data.updatedAt);
  return { ok: true, evren, yanit: sonuc.data };
}

/**
 * Bulutta o kodun altında NE DURDUĞUNU okur. SALT GÖSTERİM: dönen
 * `list`/`portfolio` cihazdaki listelere YAZILMAZ, `ui` BENİMSENMEZ.
 *
 * Boş `list` "ölçemedim" DEĞİL: "bu kodun altında liste yok" demek
 * (`client.ts` notu), bu yüzden burada hataya çevrilmiyor.
 */
export async function senkronCek(signal?: AbortSignal): Promise<SenkronCekSonuc> {
  const kod = senkronDepo.al().kod;
  if (!kod) return { ok: false, sebep: 'kapali', mesaj: KAPALI_MESAJ };

  const sonuc = await fetchWatchlist(kod, { signal });
  if (!sonuc.ok) return { ok: false, sebep: 'hata', mesaj: sonuc.error.message };
  return { ok: true, veri: sonuc.data };
}


/**
 * Webin `ui` surumu: `SYNC_STATE_V` (`app.js:2309`). Surum eslesmezse
 * HICBIR SEY benimsenmiyor — bilmedigimiz bir sekli suzgece sokmak,
 * "bos geldi" ile "baska surum" hallerini karistirirdi.
 */
export const UI_SURUM = 1;

const BICIM_MESAJ =
  'Buluttaki kayit beklenen bicimde degil (surum eslesmedi) — cihazdaki listelere dokunulmadi.';

/**
 * Uzak `ui` govdesinden LISTE DIZISINI cikarir. SAF: aga cikmiyor,
 * cihaza yazmiyor, suzmuyor — yalnizca "benimsenebilir mi" sorusunu
 * yanitliyor. Suzme isi `listeleriAktar` icindeki `listelerSuz`de.
 */
export function uiListeleriCikar(ui: unknown): unknown[] | null {
  if (!ui || typeof ui !== 'object') return null;
  const n = ui as { v?: unknown; lists?: unknown };
  if (n.v !== UI_SURUM) return null;
  if (!Array.isArray(n.lists)) return null;
  return n.lists;
}

export type SenkronAktarSonuc =
  | { ok: true; eklenen: number; guncellenen: number; korunan: number; budandi: boolean }
  | {
      ok: false;
      sebep: 'kapali' | 'hata' | 'bicim' | 'bos' | 'yazilamadi';
      mesaj: string;
    };

/**
 * WEBDEKI LISTELERI BU CIHAZA ALIR. Kullanicinin BASTIGI dugmeyle
 * calisir, acilista KENDILIGINDEN KOSMAZ (bkz. baslik (2)).
 *
 * Akis: uctan oku → `ui` surumunu dogrula → liste dizisini cihazin
 * kendi suzgecinden gecirip birlestir. Cihazda olup bulutta olmayan
 * liste KORUNUR; ayni `id` uzerine yazilir (gerekce `depo.ts`
 * `listeleriAktar` basliginda).
 */
export async function senkronListeAktar(signal?: AbortSignal): Promise<SenkronAktarSonuc> {
  const cekim = await senkronCek(signal);
  if (!cekim.ok) return { ok: false, sebep: cekim.sebep, mesaj: cekim.mesaj };
  const uzakListeler = uiListeleriCikar(cekim.veri.ui);
  if (!uzakListeler) return { ok: false, sebep: 'bicim', mesaj: BICIM_MESAJ };
  const sonuc: ListeAktarSonuc = await listeleriAktar(uzakListeler);
  return sonuc;
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
