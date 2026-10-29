// =====================================================================
//  BUGÜN KARTLARI — tek içe aktarma noktası           (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: "Bugün" sekmesine takılacak yüzeyleri tek yerden dışa açar.
//  Üç kalem: 📊 Endeks Nabzı · 📰 Piyasa gündemi · 🧭 Takip ölçümleri.
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
  PiyasaGundemiKarti,
  type PiyasaGundemiKartiProps,
} from './PiyasaGundemiKarti';

export {
  ENDEKS_NABIZ,
  EndeksNabziKarti,
  EndeksOlcumNotu,
  type EndeksNabziKartiProps,
  type EndeksOlcum,
  type EndeksTanim,
} from './EndeksNabziKarti';

export {
  TakipOlcumleriKarti,
  type TakipOlcumleriKartiProps,
} from './TakipOlcumleriKarti';

// FAZ 3: web'in `calendar` sekmesinin native karşılığı. Uç (`/api/takvim`)
// ÜRETİMDE CANLIYDI ama `mobile/` içinde onu çağıran hiçbir şey yoktu
// (ölçüldü 2026-10-29: `grep -rn "api/takvim" mobile/` → 0 eşleşme) —
// ölçülmüş veri çöpe gidiyordu. Yeni SEKME açılmadı, 5'li menü değişmedi.
export { TakvimKart, type TakvimKartProps } from './TakvimKart';
