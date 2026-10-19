// =====================================================================
//  API GİRİŞİ — ekranların tek içe aktarma noktası   (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: istemci katmanını tek yerden dışa açar.
//
//  NEDEN: kural "ekranlar doğrudan `fetch` çağırmaz". Ekranlar
//  `@/api` yazdığı sürece ağ erişiminin TEK yolu bu dosyadan geçen
//  işlevlerdir; `fetch` bu paketin dışına hiç sızmaz. Yarın taban adres,
//  önbellek ya da yetkilendirme değişirse değişen dosya `client.ts`
//  olur, beş ekran değil.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

export * from './client';
export { useIstek, type IstekAyar, type IstekDurum, type IstekSonuc } from './istek';
export {
  BASLANGIC_LISTE,
  cikar,
  depoHazir,
  doluMu,
  ekle,
  kayitBudandiMi,
  listeAl,
  normalizeSembol,
  useHazir,
  useListe,
  type EkleSonuc,
} from './liste';
