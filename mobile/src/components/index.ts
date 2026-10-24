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
// FAZ 2: üç durumun tek gövdesi (yükleniyor · hata · boş) + dürüstlük notu.
export { Durum, OlcumNotu, VeriYok, type DurumProps, type VeriYokProps } from './Durum';
// FAZ 2: /api/chart kapanış serisinin grafiği (react-native-svg).
export { FiyatGrafigi, type FiyatGrafigiProps } from './FiyatGrafigi';
export { Badge, Pill, type PillProps } from './Pill';
export { ScoreGauge, type ScoreGaugeProps } from './ScoreGauge';
export { ScreenShell, type ScreenShellProps } from './ScreenShell';
export { SectorChip, type SectorChipProps } from './SectorChip';
export { Skeleton, SkeletonRow, SkeletonText, type SkeletonProps } from './Skeleton';
// FAZ 3: sekme çubuğunun vektör ikonları (emoji yerine).
export { TabIkon, type TabIkonAd, type TabIkonProps } from './TabIkon';
export { ROW_HEIGHT, TickerRow, type TickerRowProps } from './TickerRow';
