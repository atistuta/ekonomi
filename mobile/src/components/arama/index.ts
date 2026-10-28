// =====================================================================
//  ARAMA KARTLARI — tek içe aktarma noktası                  (native)
// ---------------------------------------------------------------------
//  NE: Arama sekmesinin çok pazarlı aday listesini dışa açar.
//
//  NEDEN AYRI KLASÖR VE `components/index.ts` DEĞİL: bu kart TEK ekranın
//  parçası. Çekirdek komponent girişine (Card/Pill/Durum...) karışsa,
//  "her ekranda kullanılabilir" yüzey ile "Arama'ya özel" yüzey aynı
//  listede durur ve biri yarın yanlış ekrana taşınır. Sekme dosyası
//  `@/components/arama` yazıyor; çekirdek giriş dosyası değişmiyor.
//  (Aynı kural: `components/kesfet/index.ts`.)
//
//  NEDEN `*` DEĞİL AD AD: listede olmayan şey dışarıya çıkmaz.
//
//  HANGİ KART HANGİ UCA GİDİYOR: 🔎 Adaylar → KENDİ çekiyor,
//  `/api/arama` (api/_kesif.js `aramaHandler`). Sembol skoru
//  (/api/recommend) ve tema (/api/theme) turları AYRI — biri düşerken
//  öteki durabilir, ekranda da ayrı anlatılıyorlar.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { AdayKarti, type AdayKartiProps } from './AdayKarti';
