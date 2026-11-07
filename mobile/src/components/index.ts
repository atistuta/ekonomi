// =====================================================================
//  KOMPONENT GİRİŞİ — tek içe aktarma noktası         (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Çekirdek komponentleri tek yerden dışa açar.
//
//  NEDEN: ekranlar `@/components` yazar, dosya yolu yazmaz. Bir komponent
//  taşındığında ya da ikiye bölündüğünde (ör. FAZ 2'de ScoreGauge'ın
//  SVG sürümü) değişen tek dosya bu olur; ekranların hiçbiri
//  dokunulmaz.
//
//  NEDEN `*` DEĞİL AD AD: yıldızla açmak, şablondan kalma ya da yarım
//  bir dosyayı kazayla kamuya açar. Burada listede olmayan şey dışarıya
//  çıkmaz — yüzey bilinçli.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { Card, type CardProps } from './Card';
export { Disclaimer, DISCLAIMER_TEXT, type DisclaimerProps } from './Disclaimer';
export { Dugme, type DugmeProps } from './Dugme';
// FAZ 2/3: bütün durumların tek gövdesi (yükleniyor · boş · dört hata
// türü) + eksik ölçüm rozeti/künyesi.
export {
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  OlcumEksikRozet,
  OlcumNotu,
  VeriYok,
  type DurumProps,
  type HaberOlcumNotuProps,
  type IskeletSekil,
  type OlcemedimKutuProps,
  type OlcumNotuProps,
  type VeriYokProps,
} from './Durum';
// FAZ 2: /api/chart kapanış serisinin grafiği (react-native-svg).
export { FiyatGrafigi, type FiyatGrafigiProps } from './FiyatGrafigi';
// TASARIM TURU 1: varsayılan KAPALI ölçüm bölümü. Yoğunluk kuralı tek
// komponentte; altı kart aynı açma/kapama ve erişilebilirlik durumunu
// paylaşıyor (gerekçe dosyanın başlığında).
export { Katlanir, type KatlanirProps } from './Katlanir';
// TASARIM TURU 1: ürünün TEK anahtar/değer satırı + bölüm başlığı.
// `detay/Satir.tsx` buraya yönlenen takma ad.
export {
  OlcumBaslik,
  OlcumSatiri,
  type OlcumBaslikProps,
  type OlcumSatiriProps,
} from './OlcumSatiri';
// TASARIM TURU 2: uzun sekmelerde kartlar arası yapısal ayrım.
export { BolumBasligi, type BolumBasligiProps } from './BolumBasligi';
export { Badge, Pill, type PillProps } from './Pill';
export { ScoreGauge, type ScoreGaugeProps } from './ScoreGauge';
export { ScreenShell, type ScreenShellProps } from './ScreenShell';
export { SectorChip, type SectorChipProps } from './SectorChip';
export {
  Skeleton,
  SkeletonChart,
  SkeletonRow,
  SkeletonScoreCard,
  SkeletonSiraRow,
  SkeletonText,
  type SkeletonProps,
} from './Skeleton';
// FAZ 3: sekme çubuğunun vektör ikonları (emoji yerine).
export { TabIkon, type TabIkonAd, type TabIkonProps } from './TabIkon';
export { ROW_HEIGHT, TickerRow, type TickerRowProps } from './TickerRow';
// FAZ 3: motorun DORT vade penceresi (gunici/kisa/orta/uzun) native'de
// 'orta'ya sabitlenmisti; secim artik kullanicida.
export { VadeSecici, type VadeSeciciProps } from './VadeSecici';
