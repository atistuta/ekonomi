// =====================================================================
//  DETAY GİRİŞİ — hisse detay kartları               (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/hisse/[sembol]` ekranının kartlarını tek yerden dışa açar.
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

export { BacktestKart, type BacktestKartProps } from './BacktestKart';
// `degerTuruOf` de dışa açık: ekran, kartı hiç basmamaya karar vermek
// için aynı sembol→metal eşlemesini kullanıyor (gerekçesi DegerKart'ta).
export { DegerKart, degerTuruOf, type DegerKartProps } from './DegerKart';
export { DetayBasligi, type DetayBasligiProps } from './DetayBasligi';
export { RiskOdulKart, type RiskOdulKartProps } from './RiskOdulKart';
export { Satir, type SatirProps } from './Satir';
export { TeknikKart, type TeknikKartProps } from './TeknikKart';
export { TemelKart, type TemelKartProps } from './TemelKart';
// ŞERİT F: `/api/yfin` temettü alanları. Adı `components/analiz`
// altındaki kartla aynı ama O KART BAŞKA: çok sembollü liste, yalnız
// `dividendYield`. İki giriş ayrı olduğu için ad çakışması yok;
// karıştırmamak için her iki dosyanın başlığında ayrım yazılı.
export { TemettuKart, type TemettuKartProps } from './TemettuKart';
export { TezKart, type TezKartProps } from './TezKart';
