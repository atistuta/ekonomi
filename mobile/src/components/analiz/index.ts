// =====================================================================
//  ANALİZ KARTLARI — tek içe aktarma noktası          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: Analiz sekmesine takılacak üç yüzeyi tek yerden dışa açar:
//  ⚖️ Karşılaştır · 📅 Bilanço · 💰 Temettü.
//
//  NEDEN AYRI KLASÖR, NEDEN `components/index.ts`E EKLENMEDİ: bu üç
//  kart TEK EKRANIN (Analiz) parçası ve `/api/compare` + `/api/yfin`
//  sözleşmelerine bağlı. `components/` kökü ekranlar arası PAYLAŞILAN
//  yüzeyin yeri (Card, Pill, Durum, Skeleton); tek ekrana özel kartları
//  oraya koymak, paylaşılan ile özel arasındaki ayrımı siler ve her yeni
//  ekran kök dizini şişirir. `detay/` ve `kesfet/` klasörleri de aynı
//  gerekçeyle ayrı duruyor.
//
//  NEDEN `*` DEĞİL AD AD: `components/index.ts` başlığındaki gerekçe
//  birebir geçerli — yıldızla açmak yarım bir dosyayı kazayla kamuya
//  açar. Listede olmayan şey dışarıya çıkmaz.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { BilancoKart, type BilancoKartProps } from './BilancoKart';
export { KarsilastirKart, type KarsilastirKartProps } from './KarsilastirKart';
export { TemettuKart, type TemettuKartProps } from './TemettuKart';
