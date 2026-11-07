// =====================================================================
//  GEZİNME KALIBI — sembole dokunan her yüzey aynı biçimde gider
//                                                   (TASARIM TURU 2)
// ---------------------------------------------------------------------
//  NE: `hisse/[sembol]` rotasına gidişin TEK çağrı biçimi.
//
//  NEDEN TEK DOSYA: tur 2 ölçümü, aynı rotaya İKİ AYRI biçimde
//  gidildiğini buldu. Listeler/Arama `{ sembol, pazar }` gönderirken
//  Bugün (sıra satırı) ve Keşfet (kart satırları) yalnız `{ sembol }`
//  gönderiyordu. `pazar` ÜRÜN DAVRANIŞI: `app/hisse/[sembol].tsx`
//  başlığındaki ölçüm `?symbols=THYAO` → market US · ta null · fa null
//  iken `?symbols=THYAO.IS` → market BIST · ta 29.39 · fa 62.34 diyor.
//  Yani `pazar` düşen her dokunuşta BIST hissesi yanlış borsada
//  ölçülüyordu. Kalıp tek yere alındı ki biçim bir daha ayrışmasın.
//
//  BURADA HESAP YOK: sembol ve pazar kodu olduğu gibi taşınır; ek,
//  kırpma, büyütme/küçültme YAPILMAZ. `.IS` ekini hâlâ yalnız
//  hisse ekranının kendi çözümleme sırası koyar.
// =====================================================================

import { router } from 'expo-router';

/**
 * Hisse detay ekranını aç.
 *
 * `pazar` İSTEĞE BAĞLI ve bu bilinçli: Keşfet'in ⚡ Radar bölümü
 * sözlükten ÇIPLAK sembol dizgileri veriyor (`components/kesfet/
 * RadarKart.tsx`), uçta o satır için pazar alanı YOK. Bilinmeyen pazarı
 * uydurmak yerine hiç göndermiyoruz — hisse ekranı o durumda kendi
 * çözümleme sırasını (kullanıcının liste yazımı → çıplak) işletir.
 */
export function hisseAc(sembol: string, pazar?: string | null): void {
  router.push({
    pathname: '/hisse/[sembol]',
    params: pazar ? { sembol, pazar } : { sembol },
  });
}
