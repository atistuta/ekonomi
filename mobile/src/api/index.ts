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

// `client.ts` kendi içinde `export * from './types'` yapıyor, bu yüzden
// uç sözleşmeleri (ScoreResponse, ChartResponse, ARALIKLAR, Aralik …) ve
// çağrılar (fetchScore … fetchChart) bu tek satırdan geçiyor. İkinci bir
// `export` satırı yazmak aynı adı iki yerden açmak olurdu.
export * from './client';

// NEDEN AYRI SATIR: `yfin.ts` skor zincirinin DIŞINDA bir uç (Yahoo
// künyesi: yaklaşan bilanço + temettü oranı) ve `client.ts`'in sembol
// kapısından geçmiyor — kendi sembol sınırı (12) ve kendi bütçesi
// (28 sn) var. `client.ts` içine katmak, skor sözleşmesiyle künye
// sözleşmesini aynı dosyada karıştırmak olurdu.
export {
  YFIN_AZAMI_SEMBOL,
  YFIN_TIMEOUT_MS,
  fetchYfin,
  yfinSozluk,
  type YfinEarnings,
  type YfinKunye,
  type YfinOptions,
  type YfinResponse,
} from './yfin';
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
