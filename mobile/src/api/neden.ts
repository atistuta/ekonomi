// =====================================================================
//  GÜNDEM ÖLÇÜMÜ → /api/causal GİRDİSİ  (saf eşleyici, FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `fetchGundemKonsept` (`/api/gundem`) cevabındaki `konseptler`
//  dizisini `/api/causal` isteğinin `gundem` alanının beklediği şekle
//  çeviren TEK işlev. Ağ YOK, durum YOK, React YOK: girdi diziden
//  çıktı diziye saf dönüşüm.
//
//  ── NİYE AYRI BİR DOSYA ────────────────────────────────────────────
//  İki uç sözleşmesi ARASINDA duruyor. `client.ts` çağrıları taşıyor,
//  `types.ts` sözleşmeleri; bu dosya ikisinden de bağımsız bir KÖPRÜ.
//  Eşleyiciyi `fetchCausal`ın içine saklamak, o fonksiyonun gövdeyi
//  "OLDUĞU GİBİ" geçirme sözünü bozardı (client.ts `fetchCausal`
//  başlığı: "alan budama/normalleştirme YAPILMIYOR"). Kartın içine
//  saklamak da aynı çeviriyi ikinci bir ekran istediğinde kopyalardı.
//
//  ── NİYE BU KÖPRÜ GEREKİYORDU ──────────────────────────────────────
//  `fetchCausal` başlığının kendi sözü: "gündem ÜRETİMİ (RSS taraması +
//  konsept çıkarımı) SUNUCU İŞİ ve AYRI BİR ŞERİDE devredilecek".
//  O şerit `/api/gundem` olarak açıldı (api/_gundem.js). Nedensellik
//  ekranı girdisini artık UYDURMUYOR, bu ÖLÇÜLMÜŞ cevaptan alıyor.
//
//  ── BURADA EŞİK/AĞIRLIK/FORMÜL YOK ─────────────────────────────────
//  Hiçbir sayı türetilmiyor: `tone`, `risk`, `heat`, `ageH` olduğu gibi
//  geçiyor. Tek yapılan iş TÜR DARALTMA ve EKSİK ALAN DÜŞÜRME — ikisi
//  de `/api/causal`ın kendi kapılarının (api/causal.js:183-197) ekrana
//  taşınması değil, o kapılardan GEÇEMEYECEK öğenin sessiz veri kaybı
//  olmasını önlemek. Sıralama MOTORUN: dizi hiç yeniden sıralanmıyor.
//
//  ── İKİ TÜR UYUŞMAZLIĞI, İKİSİ DE DÜŞÜRMEYLE ÇÖZÜLÜYOR ─────────────
//  1) `GundemKonsept.sectors` demeti `[string, NedenSektorYon | string]`
//     (uç sözlüğü büyürse ekran çökmesin diye gevşek), oysa
//     `NedenKonseptGirdi.sectors` `[string, NedenSektorYon]` istiyor.
//     `as` ile zorlamak, küme dışı bir yönü tele sokup ucun süzgecine
//     (:184) yem etmek olurdu — ÖLÇÜLEN sektör sessizce kaybolurdu.
//     Bunun yerine küme dışı yön BURADA düşüyor ve kaç tanesinin
//     düştüğü `GundemKopruOlcum.sektorDusen` ile SAYILIYOR.
//  2) `GundemBaslik.ageH` `number | null` ("null = ölçülemedi, ASLA 0"),
//     oysa `NedenBaslikGirdi.ageH` ZORUNLU sayı. `0`a çevirmek
//     "manşet şu an çıktı" demek olurdu; ölçülemeyen yaş DÜŞÜYOR ve
//     `basligiDusen` ile sayılıyor.
//
//  ── TAVAN SESSİZ DEĞİL ─────────────────────────────────────────────
//  `AZAMI_KONSEPT` (60) ucun kendi sınırı; aşan istek 400 döner. Burada
//  kırpılıyor ÇÜNKÜ 61. konsept yüzünden ÖLÇÜLEN 60'ı da kaybetmek
//  daha kötü olurdu — ama kırpıldığı `GundemKopruOlcum.kirpildi` ile
//  söyleniyor, ekran bunu yazabilsin.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  AZAMI_KONSEPT,
  type GundemKonsept,
  type NedenBaslikGirdi,
  type NedenKonseptGirdi,
  type NedenSektorYon,
} from './types';

/**
 * Köprünün KENDİ ölçüm künyesi. Ekran "neyi gönderdim, neyi
 * düşürdüm" diyebilsin diye var: sessiz kayıp yok.
 */
export type GundemKopruOlcum = {
  /** Uçtan gelen konsept sayısı. */
  gelen: number;
  /** Teli geçen konsept sayısı (`<= AZAMI_KONSEPT`). */
  giden: number;
  /** `AZAMI_KONSEPT` tavanı yüzünden kırpıldı mı. */
  kirpildi: boolean;
  /** Yönü `up`/`down` kümesi dışında olduğu için düşen sektör demeti. */
  sektorDusen: number;
  /** `ageH` ölçülemediği (null/sonsuz) için düşen manşet. */
  basligiDusen: number;
};

/** Köprünün dönüşü: girdi + onun künyesi, tek nesnede. */
export type GundemKopruSonuc = {
  gundem: NedenKonseptGirdi[];
  olcum: GundemKopruOlcum;
};

/**
 * Sektör yönünü DARALTIR. Küme dışı dizgi `null` döner ve çağıran onu
 * düşürür — burada varsayılan bir yön SEÇİLMİYOR.
 */
function yonDaralt(ham: NedenSektorYon | string): NedenSektorYon | null {
  return ham === 'up' || ham === 'down' ? ham : null;
}

/**
 * `GundemKonsept[]` → `NedenKonseptGirdi[]`.
 *
 * Boş dizi girdi, boş dizi çıktı döner: "ölçtüm, konsept yok" bilgisi
 * KORUNUYOR (çağıran `undefined` ile `[]` arasındaki ayrımı kendi
 * elinde tutar — `NedenKart` iki dalı ayrı yazıyor).
 */
export function gundemdenKonseptler(
  konseptler: readonly GundemKonsept[] | null | undefined,
): GundemKopruSonuc {
  const kaynak = konseptler ?? [];
  let sektorDusen = 0;
  let basligiDusen = 0;

  const tumu: NedenKonseptGirdi[] = [];
  for (const k of kaynak) {
    // `key` ZORUNLU: boşsa uç 400 `konsept_key_yok` döner. O isteği hiç
    // atmamak yerine SADECE o konsepti düşürmek, ölçülen gerisini
    // kurtarıyor.
    if (!k || typeof k.key !== 'string' || !k.key.length) continue;

    const sectors: [string, NedenSektorYon][] = [];
    for (const demet of k.sectors ?? []) {
      if (!Array.isArray(demet) || demet.length !== 2) {
        sektorDusen += 1;
        continue;
      }
      const yon = yonDaralt(demet[1]);
      if (yon === null) {
        sektorDusen += 1;
        continue;
      }
      sectors.push([String(demet[0]), yon]);
    }

    const heads: NedenBaslikGirdi[] = [];
    for (const h of k.heads ?? []) {
      // `null` yaş DÜŞÜYOR, `0`a ÇEVRİLMİYOR: 0 "şu an çıktı" demek.
      if (!h || typeof h.ageH !== 'number' || !Number.isFinite(h.ageH)) {
        basligiDusen += 1;
        continue;
      }
      heads.push({ ageH: h.ageH });
    }

    tumu.push({
      key: k.key,
      sectors,
      risk: k.risk,
      tone: k.tone,
      heat: k.heat,
      heads,
    });
  }

  const kirpildi = tumu.length > AZAMI_KONSEPT;
  const gundem = kirpildi ? tumu.slice(0, AZAMI_KONSEPT) : tumu;

  return {
    gundem,
    olcum: {
      gelen: kaynak.length,
      giden: gundem.length,
      kirpildi,
      sektorDusen,
      basligiDusen,
    },
  };
}
