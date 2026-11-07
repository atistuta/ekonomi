// =====================================================================
//  Satir — ölçüm satırının detay takma adı            (TASARIM TURU 1)
// ---------------------------------------------------------------------
//  NE: tanım artık `components/OlcumSatiri.tsx` içinde. Bu dosya yalnız
//  eski adı ayakta tutuyor.
//
//  NEDEN TAŞINDI: satır düzeni detay ekranına özel değil — `bugun/`,
//  `kesfet/` ve `analiz/` kartları da aynı anahtar/değer satırını
//  istiyor, ama bu dosya kök barrel'dan dışa açık olmadığı için onlara
//  ULAŞAMIYORDU ve her kart kendi satırını elle yazıyordu. Tanım kök
//  komponentlere alındı (gerekçenin tamamı orada), üç kademeli
//  hiyerarşi orada kuruldu.
//
//  NEDEN DOSYA SİLİNMEDİ: yedi detay kartı `import { Satir } from
//  './Satir'` yazıyor ve `detay/index.ts` bu adı dışa açıyor. Takma ad
//  kalınca tasarım turu o yedi dosyanın import satırlarına dokunmuyor —
//  değişiklik yüzeyi küçük kalıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { OlcumSatiri as Satir, type OlcumSatiriProps as SatirProps } from '../OlcumSatiri';
