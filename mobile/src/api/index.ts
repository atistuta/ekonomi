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
  YFIN_AZAMI_ARAMA_SONUC,
  YFIN_TIMEOUT_MS,
  fetchYfin,
  // NEDEN AYRI ÇAĞRI, `fetchYfin` İÇİNE KATILMADI: arama dalı sunucuda
  // `{query, quotes}` döndürüp sembol dalından ÖNCE çıkıyor
  // (api/_yfin.js:137 ↔ :167). Tek işleve katlamak dönüş türünü birleşime
  // çevirir ve mevcut her çağıranı daraltmaya zorlardı.
  fetchYfinArama,
  yfinSozluk,
  type YfinArama,
  type YfinAramaSonuc,
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

// NEDEN AYRI SATIR: `depo.ts` AĞ DEĞİL, CİHAZ — web'in dokuz kullanıcı
// verisi türünün (listeler · portföy · sepet · geçmiş · hamleler · tezler
// · kıyas · aramalar · göstergeler) native karşılığı. `client.ts` içine
// katmak uç sözleşmesiyle yerel depo şemasını aynı dosyada karıştırmak
// olurdu. Ekranlar bu satır sayesinde `@/api/depo` diye derine inmiyor.
//
// LİSTEDE OLMAYAN ADLAR: `kayitBudandiMi`, `useListeler`, `evrenSemboller`
// ve `ListeKaydi`/`ListeOge`/`YazSonuc` bilerek YOK — onları `liste.ts`
// zaten yukarıda dışa açıyor (liste.ts:218-219). İki yerden açmak aynı
// adı çakıştırırdı.
export {
  ANAHTARLAR,
  AZAMI_ARAMA,
  AZAMI_GECMIS,
  AZAMI_GOSTERGE,
  AZAMI_HAMLE,
  AZAMI_KIYAS,
  DEPO_GOC_ANAHTAR,
  DEPO_SURUM,
  DEPO_SURUM_ANAHTAR,
  DEPO_YEDEK_ANAHTAR,
  VARSAYILAN_LISTE_AD,
  VARSAYILAN_LISTE_ID,
  aramalarDepo,
  depoBaslat,
  depoSurucuAta,
  depoYazabilirMi,
  gizliGostergelerDepo,
  gizliPortfoyDepo,
  goc,
  gostergelerDepo,
  hamlelerDepo,
  kiyasDepo,
  listelerDepo,
  listelerTazele,
  portfoyDepo,
  sepetDepo,
  sepetGecmisDepo,
  tezlerDepo,
  useAramalar,
  useGostergeler,
  useHamleler,
  useKiyas,
  usePortfoy,
  useSepet,
  useSepetGecmis,
  useTezler,
  useTur,
  useTurHazir,
  type AramaKaydi,
  type DepoSurucu,
  type GizliPortfoyOge,
  type GocSonuc,
  type Gosterge,
  type Hamle,
  type KiyasOge,
  type Pazar,
  type PortfoyOge,
  type SepetGecmisKaydi,
  type SepetKalemi,
  type Tez,
  type TezDayanak,
  type TezGunluk,
  type TezKatalizor,
  type TurDepo,
  type VarlikSinifi,
} from './depo';
