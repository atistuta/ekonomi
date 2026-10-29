// =====================================================================
//  KEŞFET KARTLARI — tek içe aktarma noktası          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: Keşfet sekmesinin üç yüzeyini (🔥 Fırsatlar · 🔎 Tarama ·
//  🌍 Radar) tek yerden dışa açar.
//
//  NEDEN AYRI BİR KLASÖR VE `components/index.ts` DEĞİL: bu kartlar
//  TEK ekranın parçası. Çekirdek komponent girişine (Card/Pill/Durum...)
//  karışsalar,
//  "her ekranda kullanılabilir" yüzey ile "Keşfet'e özel" yüzey aynı
//  listede durur ve biri yarın yanlış ekrana taşınır. Sekme dosyası
//  `@/components/kesfet` yazıyor; çekirdek giriş dosyası değişmiyor.
//
//  NEDEN `*` DEĞİL AD AD: listede olmayan şey dışarıya çıkmaz — yüzey
//  bilinçli (çekirdek girişiyle aynı kural).
//
//  ── HANGİ KART HANGİ UCA GİDİYOR (ÖLÇÜLDÜ 2026-10-27) ──────────────
//  🔥 Fırsatlar → `/api/recommend` satırlarını PROP olarak alıyor;
//     turu sekme atıyor (kaynağı doğruydu, dokunulmadı).
//  🔎 Tarama   → KENDİ çekiyor: `/api/yfin` → `/api/tarama`.
//  🌍 Radar    → KENDİ çekiyor: `/api/radar`.
//  Önceki hâlde üçü de TEK recommend turunun dilimleriydi ve iki uç hiç
//  çağrılmıyordu: aynı veri üç ad altında görünüyordu. Üç kart aynı
//  turu paylaşamaz, çünkü üç AYRI ölçüm bunlar ve biri düşerken öteki
//  durabilir — ekranda da ayrı anlatılmaları gerekiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { FirsatlarKart, type FirsatlarKartProps } from './FirsatlarKart';
// 📉 Neden: POST /api/causal. UÇ AĞA ÇIKMIYOR — endeks hareketlerini ve
// gündem konseptlerini İSTEMCİDEN bekliyor, bu yüzden girdi PROP
// (ÖLÇÜLDÜ 2026-10-29: mobile/src/api içinde bu girdiyi ölçen uç yok).
// Prop verilmedikçe kart uca gitmez, "ölçemedim" der.
export { NedenKart, type NedenKartProps } from './NedenKart';
// Tek manşet satırı — SALT SUNUM. Bugün'deki 🔭 tematik haber kartı ve
// Arama'daki 📰 tema haberleri kartı aynı satırı basıyor (2026-10-25).
export { HaberSatiri, type HaberSatiriProps } from './HaberSatiri';
export { RadarKart, type RadarKartProps } from './RadarKart';
// Sektor dagilimi: /api/yfin -> POST /api/sektor. Medyanlar HAM KESIR
// gelir; yuzdeye cevirme kartin icinde TEK KEZ yapilir.
export { SektorKart, type SektorKartProps } from './SektorKart';
export { TaramaKart, type TaramaKartProps } from './TaramaKart';
// 🔭 Tema: /api/theme. Girdi serbest METİN olduğu için kartın İÇİNDE
// toplanıyor. Aynı uç Arama sekmesinde de okunuyor (arama.tsx:121) ve
// `?tema=` yol parametresi akışı ORADA yaşıyor — bu kart o akışa
// bağlanmadı (ÖLÇÜLDÜ 2026-10-29: kesfet.tsx `useLocalSearchParams`
// okumuyor).
export { TemaKart, type TemaKartProps } from './TemaKart';
