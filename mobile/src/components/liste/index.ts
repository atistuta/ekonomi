// =====================================================================
//  components/liste — Listeler sekmesinin kartları    (ŞERİT F7 / native)
// ---------------------------------------------------------------------
//  NE: 1. sekmenin (Listeler) adlandırılmış liste YÖNETİMİ yüzeyi. Web'de
//  `renderLists` / `renderListBlock` (app.js:7958, 7978) ne gösteriyorsa
//  native'de ÖLÇÜLMÜŞ ucu/deposu olan kısmı buradan geliyor.
//
//  NEDEN `*` DEĞİL AD AD: yıldız dışa aktarım, ağaç budamayı kesiyor ve
//  "bu ad nereden geldi?" sorusunu okunamaz hâle getiriyor. Aynı kural
//  components/kesfet/index.ts'te de yazılı.
//
//  SIRA: dıştan içe — ekranın koyduğu kart önce, onun parçaları sonra.
// =====================================================================

export { ListelerKart, type ListelerKartProps } from './ListelerKart';
export { ListeBlogu, type ListeBloguProps } from './ListeBlogu';
export { YeniListeKart, type YeniListeKartProps } from './YeniListeKart';
export { SenkronKart, type SenkronKartProps } from './SenkronKart';
export { SepetKart, type SepetKartProps } from './SepetKart';
// FAZ 3: sepete YAZMA yüzeyleri. `depo.ts` sepet türü native'de OKUNUYORDU
// (`SepetKart`) ama ona yazan hiçbir ekran yoktu; sepet kaydı buluta da
// gönderilmiyor (senkron gövdesi yalnız takip listesini taşıyor), yani
// telefonda sepet kurmanın HİÇBİR yolu yoktu. Eksik olan ekran, veri değil.
// Yeni SEKME açılmadı, 5'li menü değişmedi.
export { SepetEkleKart, type SepetEkleKartProps } from './SepetEkleKart';
export { NakitKart, type NakitKartProps } from './NakitKart';
// `hamlelerDepo` / `useHamleler` / `AZAMI_HAMLE` native'de VARDI ve HİÇ
// gösterilmiyordu — `HamleKart` o günlüğün İLK tüketicisi.
export { HamleKart, type HamleKartProps } from './HamleKart';
// ŞERİT B: telefon bildiriminin CİHAZ yüzeyi. `SenkronKart` listeleri
// buluta taşıyordu ama CİHAZI kaydeden hiçbir ekran yoktu — izin de
// jeton da uygulamadan hiç istenmiyordu. Eksik olan ekran, veri değil.
// Yeni SEKME açılmadı, 5'li menü değişmedi.
export { BildirimKart, type BildirimKartProps } from './BildirimKart';
