// =====================================================================
//  DETAY GİRİŞİ — hisse detay kartları               (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/hisse/[sembol]` ekranının kartlarını tek yerden dışa açar.
//
//  NEDEN AYRI GİRİŞ (`@/components/detay`), KÖK BARREL'A EKLEMEK YOK:
//  bu kartlar TEK ekrana ait ve `AnalyzeRow` sözleşmesine bağlı; kök
//  `components/index.ts` çekirdek (ekrandan bağımsız) komponentlerin
//  yüzeyi. Ayrıca o dosyada başka ajanlar çalışıyor — alt klasörün kendi
//  girişi olunca iki değişiklik birbirine değmiyor.
//
//  NEDEN `*` DEĞİL AD AD: kök barrel'ın gerekçesiyle aynı — listede
//  olmayan şey dışarı çıkmaz, yüzey bilinçli kalır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export { BacktestKart, type BacktestKartProps } from './BacktestKart';
// `degerTuruOf` de dışa açık: ekran, kartı hiç basmamaya karar vermek
// için aynı sembol→metal eşlemesini kullanıyor (gerekçesi DegerKart'ta).
export { DegerKart, degerTuruOf, type DegerKartProps } from './DegerKart';
export { DetayBasligi, type DetayBasligiProps } from './DetayBasligi';
// YAZMA EYLEMLERI: takip listesine ve kiyas setine ekleme. Kiyas
// setini kuracak BASKA bir yuzey yoktu (gerekce dosyada).
export { DetayEylemler, type DetayEylemlerProps } from './DetayEylemler';
// ANALYZE TURUNUN DIŞI: `/api/news` çoklu-sembol kipi TEK sembolle.
// Adı `components/bugun/HisseHaberleriKarti` ile karışmasın diye kısa:
// o kart TAKİP LİSTESİNİ soruyor, bu kart TEK sembolü (gerekçe dosyada).
export { HaberKart, type HaberKartProps } from './HaberKart';
// NEDEN HAREKET EDIYOR: `/api/neden`. Webin ayni adli bolumu
// (`fillSpWhy`) TARAYICIDA hesapliyordu; karar motora, hesap uca
// tasindi. Ad `HareketKart`, cunku `components/kesfet/NedenKart`
// BASKA bir ozellik (nedensel baglantilar). SKORA GIRMEZ.
export { HareketKart, type HareketKartProps } from './HareketKart';
// ICERIDEN ISLEMLER: `/api/iceriden` (SEC Form 4 / KAP). Webin
// "Iceriden islemler" bolumu; native detayda KARSILIGI YOKTU.
// TEMEL SKORA DAHIL DEGIL (kullanici tercihi) — kart bunu EKRANDA
// yaziyor. US ve BIST ayaklari AYRI govde: BIST'te adet/tutar YOK.
export { IceridenKart, type IceridenKartProps } from './IceridenKart';
// KATALIZOR / RISK: `/api/katalizor`. Webin ayni adli satirinin
// YAKLASAN TEMETTU bacagi; gun farki ve 45 gun esigi webde
// TARAYICIDAYDI -> karar motora, hesap uca tasindi. Oynaklik bacagi
// `RiskOdulKart`ta, ham temettu kunyesi `TemettuKart`ta; ucu de ayri
// (gerekce dosyada). SKORA GIRMEZ.
export { KatalizorKart, type KatalizorKartProps } from './KatalizorKart';
export { RiskOdulKart, type RiskOdulKartProps } from './RiskOdulKart';
export { Satir, type SatirProps } from './Satir';
// SIRKET PROFILI: `/api/yfin` kunyesindeki `bizSummary`/`sector`/
// `industry`/`website`. Webin "Sirket ne yapiyor?" bolumu
// (app.js fillSpBiz); native detayda KARSILIGI YOKTU. Webin ters
// pazar denemesi BILEREK tasinmadi (gerekce dosyada).
export { SirketKart, type SirketKartProps } from './SirketKart';
export { TeknikKart, type TeknikKartProps } from './TeknikKart';
export { TemelKart, type TemelKartProps } from './TemelKart';
// ŞERİT F: `/api/yfin` temettü alanları. Adı `components/analiz`
// altındaki kartla aynı ama O KART BAŞKA: çok sembollü liste, yalnız
// `dividendYield`. İki giriş ayrı olduğu için ad çakışması yok;
// karıştırmamak için her iki dosyanın başlığında ayrım yazılı.
export { TemettuKart, type TemettuKartProps } from './TemettuKart';
export { TezKart, type TezKartProps } from './TezKart';
