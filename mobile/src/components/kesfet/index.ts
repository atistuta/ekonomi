// =====================================================================
//  KEŞFET KARTLARI — tek içe aktarma noktası          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: Keşfet sekmesinin üç yüzeyini (🔥 Fırsatlar · 🔎 Tarama ·
//  🌍 Radar) tek yerden dışa açar.
//
//  NEDEN AYRI BİR KLASÖR VE `components/index.ts` DEĞİL: bu üç kart
//  TEK ekranın parçası ve hepsi `/api/recommend` satırlarının şeklini
//  biliyor. Çekirdek komponent girişine (Card/Pill/Durum...) karışsalar,
//  "her ekranda kullanılabilir" yüzey ile "Keşfet'e özel" yüzey aynı
//  listede durur ve biri yarın yanlış ekrana taşınır. Sekme dosyası
//  `@/components/kesfet` yazıyor; çekirdek giriş dosyası değişmiyor.
//
//  NEDEN `*` DEĞİL AD AD: listede olmayan şey dışarıya çıkmaz — yüzey
//  bilinçli (çekirdek girişiyle aynı kural).
//
//  BU KARTLAR VERİ ÇEKMEZ: üçü de satırları PROP olarak alıyor. Tek
//  turu sekme atıyor; aksi hâlde aynı veri için üç istek ödenir ve üç
//  kart üç ayrı anlık görüntü gösterebilirdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { FirsatlarKart, type FirsatlarKartProps } from './FirsatlarKart';
// Tek manşet satırı — SALT SUNUM. Bugün'deki 🔭 tematik haber kartı ve
// Arama'daki 📰 tema haberleri kartı aynı satırı basıyor (2026-10-25).
export { HaberSatiri, type HaberSatiriProps } from './HaberSatiri';
export { RadarKart, type RadarKartProps } from './RadarKart';
export { TaramaKart, type TaramaKartProps, type TaramaOlcutId } from './TaramaKart';
