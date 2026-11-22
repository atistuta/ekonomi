// =====================================================================
//  components/anket — açılış anketi ve profil özeti   (PROcess / native)
// ---------------------------------------------------------------------
//  NE: ilk açılışta görünen yatırım profili anketi (`AnketEkrani`) ve
//  yanıtları gösterip anketi geri alan kart (`ProfilKart`).
//
//  NEDEN AYRI KLASÖR: ikisi de TEK akışın parçası, çekirdek komponent
//  girişine (Card/Pill/Durum...) karışmamaları gerekiyor — kesfet/ ve
//  liste/ ile aynı kural.
//
//  NEDEN `*` DEĞİL AD AD: listede olmayan şey dışarıya çıkmaz.
//
//  ANKET BİR ROTA DEĞİL: `AnketEkrani` kök düzenin (`app/_layout.tsx`)
//  `<Slot/>` yerine bastığı bir KAPI. Altıncı sekme açılmadı, 5'li menü
//  değişmedi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { AnketEkrani, type AnketEkraniProps } from './AnketEkrani';
export { ProfilKart, type ProfilKartProps } from './ProfilKart';
