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
// `NedenKart`ın ÖLÇÜLMÜŞ GİRDİ besleyicisi: `/api/gundem` →
// `gundemdenKonseptler` → kart. Kartın kendisi de dışa açık KALIYOR —
// başka bir girdi kaynağı (sunucu tarafı sabit evren şeridi) geçtiğinde
// besleyiciyi değiştirmek yetsin.
export { NedenBesleyici } from './NedenBesleyici';
// Tek manşet satırı — SALT SUNUM. Bugün'deki 🔭 tematik haber kartı ve
// Arama'daki 📰 tema haberleri kartı aynı satırı basıyor (2026-10-25).
export { HaberSatiri, type HaberSatiriProps } from './HaberSatiri';
// Haber akisinin motor olcumu (`duyarlilik`) — SALT SUNUM. Ayni ucun
// cevabindan geliyor, bu yuzden manset satirinin yanina konuldu.
export { DuyarlilikOzeti, type DuyarlilikOzetiProps } from './DuyarlilikOzeti';
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

// FAZ 3: `/api/kripto` — native'de BUGÜNE KADAR HİÇ çağrılmayan uç
// (çekici 2026-11-03'te bağlandı, DEVAM.md §20.16). Kimlik kümesi
// kartın İÇİNDE sabit: bir tarama ya da sıralama DEĞİL.
export { KriptoKart, type KriptoKartProps } from './KriptoKart';
// FAZ 3: `/api/metal` — adı yanıltıcı, FİYAT DÖNDÜRMEYEN bir HABER ucu.
// Kart adı bu yüzden "Maden haberi"; ons altın fiyatı Bugün sekmesindeki
// çok dönemli değişim kartında (`GC=F`) ölçülüyor.
export { MadenHaberKart } from './MadenHaberKart';

// FAZ 3: webin `⚡ Momentum girişi` SEKMESİNİN native karşılığı
// (`index.html:203` `#tab-momentum`). YENİ UÇ YOK, YENİ İSTEK YOK:
// ekranın hâlihazırdaki `/api/recommend` turunun `plan.momentum`
// uzvunu okuyor — rejim kararı MOTORUN (`api/_motor.js:981`).
// Satırları PROP alıyor; kendi `fetch`i yok.
export { MomentumKart, type MomentumKartProps } from './MomentumKart';
