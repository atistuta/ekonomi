// =====================================================================
//  BUGÜN KARTLARI — tek içe aktarma noktası           (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: "Bugün" sekmesine takılacak yüzeyleri tek yerden dışa açar.
//  Şimdilik bir kalem: 📊 Endeks Nabzı.
//
//  NEDEN AYRI KLASÖR, NEDEN `components/index.ts`E EKLENMEDİ: gerekçe
//  `analiz/index.ts` başlığıyla BİREBİR aynı — `components/` kökü
//  ekranlar arası PAYLAŞILAN yüzeyin yeri (Card, Pill, Durum, Skeleton);
//  tek ekrana özel kartları oraya koymak paylaşılan ile özel arasındaki
//  ayrımı siler ve her yeni ekran kök dizini şişirir. `analiz/`,
//  `detay/` ve `kesfet/` de aynı gerekçeyle ayrı duruyor.
//
//  NEDEN `*` DEĞİL AD AD: yıldızla açmak yarım bir dosyayı kazayla
//  kamuya açar. Listede olmayan şey dışarıya çıkmaz.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export {
  ENDEKS_NABIZ,
  EndeksNabziKarti,
  EndeksOlcumNotu,
  type EndeksNabziKartiProps,
  type EndeksOlcum,
  type EndeksTanim,
} from './EndeksNabziKarti';
