// =====================================================================
//  RENK TOKEN'LARI — tasarım sistemi tabanı            (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: uygulamanın kullandığı BÜTÜN renkler burada. Komponentlerin
//  içine tek bir sert kodlu hex serpilmez — `useTheme()` ile buradan
//  okunur.
//
//  NEDEN TEK YER: yol haritası "koyu/açık tema" (FAZ 3) diyor. Renk
//  komponente gömülürse açık tema geri dönülemez biçimde imkânsızlaşır:
//  40 dosyada hex avlamak gerekir. Token'la açık tema bir sözlük
//  eklemekten ibaret kalır.
//
//  NEDEN WEB'DEN FARKLI: web PWA'nın paleti (`styles.css:1-22`) menekşe
//  vurgulu (`--accent:#6366f1`) ve lacivert zeminli (`--bg:#0a0e1a`).
//  Native kasıtlı olarak farklı: yol haritasının belirttiği **koyu
//  mürekkep #0F1522 + altın #D4A24E** ekseni. Altın vurgu rengi, menekşe
//  değil — "elit/ciddi finans" hissi hedefi bu. Web→native eşleme
//  tablosu: mobile/MOBIL_NOTLAR.md.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

/** Tek bir temanın renk sözlüğü. Açık tema de bu şekli doldurmak zorunda. */
export type ColorTokens = {
  /** Ekran zemini — koyu mürekkep. */
  bg: string;
  /** Zeminden bir tık açık yüzey (bölüm ayırıcı, alt başlık şeridi). */
  bgSoft: string;
  /** Kart yüzeyi. */
  bgCard: string;
  /** Kart üstü yükseltilmiş yüzey (iç kart, seçili satır). */
  bgElevated: string;
  /** Basılı/seçili geri bildirim zemini. */
  bgPressed: string;

  /** Varsayılan kenar çizgisi. */
  border: string;
  /** Vurgulu kenar (seçili kart, odak). */
  borderStrong: string;

  /** Birincil metin. */
  text: string;
  /** İkincil metin — etiket, alt satır. */
  textDim: string;
  /** Üçüncül metin — ipucu, dipnot. */
  textFaint: string;
  /** Koyu zemin üstünde değil, ALTIN/renkli dolgu üstünde duran metin. */
  textOnAccent: string;

  /** Marka vurgusu — altın. */
  gold: string;
  /** Altının zemin tonu (pill arka planı). */
  goldSoft: string;

  /** Pozitif sinyal — yeşil. */
  positive: string;
  positiveSoft: string;
  /** Negatif sinyal — mercan. */
  negative: string;
  negativeSoft: string;
  /** Yönsüz / yatay sinyal. */
  neutral: string;
  neutralSoft: string;
  /** Bilgi / nötr-mavi (bağlam notu, "bilgi amaçlı" rozetleri). */
  info: string;
  infoSoft: string;

  /** Yükleniyor iskeleti — taban ve parıltı. */
  skeleton: string;
  skeletonHighlight: string;

  /**
   * Sektör çipi tonları. Sektör adı bir indekse eşlenir (SectorChip),
   * böylece aynı sektör her ekranda aynı tonu alır — renk anlam taşımaz,
   * yalnız ayırt eder.
   */
  sector: readonly string[];
};

/** Koyu tema — BİRİNCİL. Ürün bu renklerle tasarlandı. */
export const darkColors: ColorTokens = {
  bg: '#0F1522',
  bgSoft: '#141C2C',
  bgCard: '#182134',
  bgElevated: '#1E293E',
  bgPressed: '#232F47',

  border: '#26314A',
  borderStrong: '#364566',

  text: '#F3F6FC',
  textDim: '#8C96AE',
  textFaint: '#5D6881',
  textOnAccent: '#0F1522',

  gold: '#D4A24E',
  goldSoft: 'rgba(212, 162, 78, 0.15)',

  positive: '#3FBF8F',
  positiveSoft: 'rgba(63, 191, 143, 0.15)',
  negative: '#EF7060',
  negativeSoft: 'rgba(239, 112, 96, 0.15)',
  neutral: '#8C96AE',
  neutralSoft: 'rgba(140, 150, 174, 0.14)',
  info: '#5B93D6',
  infoSoft: 'rgba(91, 147, 214, 0.14)',

  skeleton: '#1C2639',
  skeletonHighlight: '#25334C',

  sector: ['#D4A24E', '#5B93D6', '#3FBF8F', '#B98BD9', '#E09A5F', '#6FA8B5'],
};

/**
 * Açık tema — İSKELET. Yol haritası koyuyu birincil sayıyor; buradaki
 * amaç "açık tema mümkün kalsın" (FAZ 3) sözünü YAPISAL tutmak: aynı
 * anahtar kümesi dolu olduğu için hiçbir komponent açık temada patlamaz.
 * Kontrast cilası FAZ 3'ün işi — şimdilik ölçülmedi, iddia edilmiyor.
 */
export const lightColors: ColorTokens = {
  bg: '#F6F8FC',
  bgSoft: '#EDF1F8',
  bgCard: '#FFFFFF',
  bgElevated: '#F3F6FB',
  bgPressed: '#E6EBF4',

  border: '#DCE3EF',
  borderStrong: '#B9C4D8',

  text: '#111A2B',
  textDim: '#54607A',
  textFaint: '#7C879E',
  textOnAccent: '#FFFFFF',

  gold: '#9C6F1E',
  goldSoft: 'rgba(156, 111, 30, 0.12)',

  positive: '#0D7F5C',
  positiveSoft: 'rgba(13, 127, 92, 0.12)',
  negative: '#C2402C',
  negativeSoft: 'rgba(194, 64, 44, 0.12)',
  neutral: '#54607A',
  neutralSoft: 'rgba(84, 96, 122, 0.12)',
  info: '#2F6CB0',
  infoSoft: 'rgba(47, 108, 176, 0.12)',

  skeleton: '#E4EAF3',
  skeletonHighlight: '#F1F5FB',

  sector: ['#9C6F1E', '#2F6CB0', '#0D7F5C', '#7B4FA8', '#A65A1E', '#3E7A86'],
};
