// =====================================================================
//  DETAY GİRİŞİ — hisse detay kartları               (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/hisse/[sembol]` ekranının beş kartını tek yerden dışa açar.
//
//  NEDEN AYRI GİRİŞ (`@/components/detay`), KÖK BARREL'A EKLEMEK YOK:
//  bu kartlar TEK ekrana ait ve `AnalyzeRow` sözleşmesine bağlı; kök
//  `components/index.ts` çekirdek (ekrandan bağımsız) komponentlerin
//  yüzeyi. Ayrıca o dosyada başka ajanlar çalışıyor — alt klasörün kendi
//  girişi olunca iki değişiklik birbirine değmiyor.
//
//  NEDEN `*` DEĞİL AD AD: kök barrel'ın gerekçesiyle aynı — listede
//  olmayan şey dışarı çıkmaz, yüzey bilinçli kalır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { DetayBasligi, type DetayBasligiProps } from './DetayBasligi';
export { RiskOdulKart, type RiskOdulKartProps } from './RiskOdulKart';
export { Satir, type SatirProps } from './Satir';
export { TeknikKart, type TeknikKartProps } from './TeknikKart';
export { TemelKart, type TemelKartProps } from './TemelKart';
export { TezKart, type TezKartProps } from './TezKart';
