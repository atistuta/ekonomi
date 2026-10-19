// =====================================================================
//  SEKME İKONLARI — vektör, emoji DEĞİL                (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: alt sekme çubuğunun beş ikonu. Hepsi aynı 24×24 ızgarada, aynı
//  çizgi kalınlığında çizilmiş çizgi ikonlar.
//
//  NEDEN EMOJİ DEĞİL (ÖLÇÜLDÜ): emoji ikonu SİSTEM fontundan geliyor —
//  iOS, Android ve tarayıcı aynı sekme için ÜÇ FARKLI resim çiziyor,
//  boyutları ve optik ağırlıkları tutmuyor. Dahası emoji KENDİ rengini
//  taşıyor: `tabBarActiveTintColor` (altın) emojiye işlemiyor, yani
//  "seçili sekme" ayrımı yalnız yazıda kalıyordu. Vektörde renk
//  dışarıdan geliyor ve seçili durum ikonda da görülüyor.
//
//  NEDEN `react-native-svg`: Expo'nun önerdiği, SDK ile sürümlenen
//  paket (`npx expo install react-native-svg`) ve web lab'ında aynı
//  kodu çalıştırıyor. Alternatif "View'lardan şekil kurmak" beş ikon
//  için okunmaz bir stil yığını olurdu; bir ikon FONTU (ör. 3 MB'lık
//  set) ise beş ikon uğruna taşınan ölü ağırlıktı.
//
//  NEDEN RENK TEK TAŞIYICI DEĞİL: ikon + METİN etiketi birlikte
//  duruyor (sekme başlıkları açık), seçili sekme ayrıca kalın. Renk
//  körü kullanıcı için anlam kaybı yok.
//
//  BURADA HESAP YOK: bunlar çizim; hiçbir sayı, eşik ya da sıralama
//  üretmiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import Svg, { Circle, Line, Path } from 'react-native-svg';

/** Sekme ikonu adları — `(tabs)/_layout.tsx` ile birebir. */
export type TabIkonAd = 'listeler' | 'bugun' | 'kesfet' | 'analiz' | 'arama';

export type TabIkonProps = {
  ad: TabIkonAd;
  /** Sekme durumundan gelir (aktif = altın, pasif = soluk). */
  color: string;
  /** Kenar uzunluğu. Sekme çubuğu için 24 yeterli. */
  size?: number;
};

/** Tüm ikonlarda AYNI kalınlık — optik ağırlık tutsun. */
const KALINLIK = 1.8;

export function TabIkon({ ad, color, size = 24 }: TabIkonProps) {
  const ortak = {
    stroke: color,
    strokeWidth: KALINLIK,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {ad === 'listeler' ? (
        <>
          {/* Liste: üç satır + işaret noktaları. */}
          <Circle cx={5} cy={7} r={1.3} fill={color} stroke="none" />
          <Circle cx={5} cy={12} r={1.3} fill={color} stroke="none" />
          <Circle cx={5} cy={17} r={1.3} fill={color} stroke="none" />
          <Line x1={9.5} y1={7} x2={19.5} y2={7} {...ortak} />
          <Line x1={9.5} y1={12} x2={19.5} y2={12} {...ortak} />
          <Line x1={9.5} y1={17} x2={16} y2={17} {...ortak} />
        </>
      ) : null}

      {ad === 'bugun' ? (
        <>
          {/* Yayın/nabız: merkezden yayılan iki yay — "bugün ne oluyor". */}
          <Circle cx={12} cy={12} r={2} fill={color} stroke="none" />
          <Path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2" {...ortak} />
          <Path d="M16.6 7.4a6.5 6.5 0 0 1 0 9.2" {...ortak} />
          <Path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8" {...ortak} />
          <Path d="M19.4 4.6a10.5 10.5 0 0 1 0 14.8" {...ortak} />
        </>
      ) : null}

      {ad === 'kesfet' ? (
        <>
          {/* Pusula: keşif. İbre iki üçgen. */}
          <Circle cx={12} cy={12} r={8.5} {...ortak} />
          <Path d="M15.2 8.8 13.4 13.4 8.8 15.2 10.6 10.6Z" {...ortak} />
        </>
      ) : null}

      {ad === 'analiz' ? (
        <>
          {/* Gösterge: ScoreGauge'ın küçük kardeşi — yay + ibre. */}
          <Path d="M3.8 17.2a9 9 0 1 1 16.4 0" {...ortak} />
          <Line x1={12} y1={17.2} x2={16.2} y2={10.6} {...ortak} />
          <Circle cx={12} cy={17.2} r={1.5} fill={color} stroke="none" />
        </>
      ) : null}

      {ad === 'arama' ? (
        <>
          {/* Büyüteç. */}
          <Circle cx={10.8} cy={10.8} r={6.3} {...ortak} />
          <Line x1={15.4} y1={15.4} x2={20} y2={20} {...ortak} />
        </>
      ) : null}
    </Svg>
  );
}
