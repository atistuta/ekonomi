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

// FAZ 3: web'in `news` sekmesinin (`index.html:78` → 📰 Hisse Haberleri)
// native karsiligi. `/api/news` coklu-sembol kipi (②) URETIMDE CANLIYDI
// ama `mobile/` icinde onu cagiran hicbir sey yoktu (olculdu 2026-11-03)
// — olculmus veri cope gidiyordu. Yeni SEKME acilmadi, 5'li menu
// degismedi.
export { HisseHaberleriKarti, type HisseHaberleriKartiProps } from './HisseHaberleriKarti';

// FAZ 3: `/api/gundem` (api/_gundem.js) — MANŞETİN ÜSTÜNDEKİ konsept
// ölçümü. `PiyasaGundemiKarti` ile AYNI beslemeleri okuyor ama FARKLI
// şeyi ölçüyor; gerekçe kartın başlığında yazılı. Yeni SEKME yok.
export { GundemKonseptKarti, type GundemKonseptKartiProps } from './GundemKonseptKarti';

// FAZ 3: `/api/degisim` — native'de BUGÜNE KADAR HİÇ çağrılmayan uç
// (çekici 2026-11-03'te bağlandı, DEVAM.md §20.16). `EndeksNabziKarti`
// GÜNÜN nabzını ölçüyor, bu kart AYNI dört sembolün ALTI DÖNEMİNİ;
// ikisi ayrı uçlara gidiyor ve ayrı düşebiliyor. Yeni SEKME yok.
export { DonemDegisimKarti, type DonemDegisimKartiProps } from './DonemDegisimKarti';

// NEDEN BARREL: `SeritKart` webin sayfa basindaki fiyat seridinin
// (`TICKER_BUILTIN_META`) native yuzeyi. Kartin KENDI `fetch`i yok —
// olcumu `seritFiyatlari()` derliyor (`src/api/serit.ts`), kart basar.
export { SeritKart, type SeritKartProps } from './SeritKart';

// NEDEN BARREL: `GostergeKart` `SeritKart`in EKSİK ekranı. Ölçüldü:
// `gostergeEkle` (api/depo.ts) native'de VARDI ama ÇAĞIRANI YOKTU —
// kullanıcı webde iğnelediği göstergeyi telefonda görüyor, ama
// ekleyemiyor ve kaldıramıyordu. Çıkarma yazıcısı (`gostergeCikar`)
// bu turda aynı dosyaya eklendi. Yeni SEKME açılmadı.
export { GostergeKart, type GostergeKartProps } from './GostergeKart';

// NEDEN BARREL: ⚡ Ani hareket, /api/hareket ucunun native'deki İLK
// yüzü. Ölçüldü: uç ve `vercel.json` yeniden-yazımı yazılıydı ama
// `mobile/` içinde onu çağıran hiçbir şey yoktu — ölçülmüş veri ekrana
// ulaşmıyordu. Kart Bugün sekmesine takıldı, YENİ SEKME AÇILMADI.
export { AniHareketKart, type AniHareketKartProps } from './AniHareketKart';
