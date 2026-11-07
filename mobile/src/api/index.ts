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
  type YfinEkstremAlan,
  type YfinEkstremSatir,
  type YfinKunye,
  type YfinOptions,
  type YfinResponse,
  type YfinSenaryo,
  type YfinSenaryoKutu,
} from './yfin';
// NEDEN AYRI SATIR: `takvim.ts` skor zincirinin DIŞINDA bir uç (KAP
// duyuruları + BIST temettü takvimi) ve `client.ts`'in sembol kapısından
// geçmiyor — sembol parametresi hiç YOK, `vade` YOK, kendi kapsam beyaz
// listesi ve iki ayrı adet tavanı (60 / 400) var. `client.ts` içine
// katmak, skor sözleşmesiyle takvim sözleşmesini aynı dosyada
// karıştırmak olurdu (`yfin.ts` ile aynı gerekçe). `client.ts`'e yalnız
// ADRES eklendi (`ENDPOINTS.takvim`).
export {
  TAKVIM_AZAMI_KAP,
  TAKVIM_AZAMI_TEMETTU,
  TAKVIM_KAPSAMLAR,
  TAKVIM_TIMEOUT_MS,
  TAKVIM_VARSAYILAN_TEMETTU,
  VARSAYILAN_TAKVIM_KAPSAM,
  fetchTakvim,
  type TakvimErrorCode,
  type TakvimKapMadde,
  type TakvimKapsam,
  type TakvimOptions,
  type TakvimResponse,
  type TakvimTemettuMadde,
} from './takvim';
export { useIstek, type IstekAyar, type IstekDurum, type IstekSonuc } from './istek';

// NEDEN AYRI SATIR: `neden.ts` AĞ DEĞİL, SAF EŞLEYİCİ — `/api/gundem`
// ölçümünü `/api/causal` isteğinin `gundem` alanına çeviriyor. İki uç
// SÖZLEŞMESİ ARASINDA durduğu için ne `client.ts`e ne `types.ts`e ait;
// gerekçe dosyanın başlığında yazılı.
export {
  gundemdenKonseptler,
  type GundemKopruOlcum,
  type GundemKopruSonuc,
} from './neden';

// NEDEN AYRI SATIR: `hareket.ts` AĞA ÇIKAR (`/api/chart` ×4) ama
// `client.ts`e GİRMEDİ — orada her dosya TEK uç sarmalıyor, bu ise
// dört çağrıyı TEK ölçüme toplayan bir derleyici.
export {
  fetchNedenHareketleri,
  type HareketAyar,
  type HareketDusen,
  type HareketOlcumu,
  NEDEN_ENDEKSLERI,
} from './hareket';
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
  SENKRON_ANAHTAR,
  AZAMI_ARAMA,
  AZAMI_GECMIS,
  AZAMI_GOSTERGE,
  AZAMI_HAMLE,
  AZAMI_KIYAS,
  AZAMI_SEPET,
  DEPO_GOC_ANAHTAR,
  DEPO_SURUM,
  DEPO_SURUM_ANAHTAR,
  DEPO_YEDEK_ANAHTAR,
  VARSAYILAN_LISTE_AD,
  VARSAYILAN_LISTE_ID,
  aramaHatirla,
  bildirimEvreni,
  aramalarDepo,
  bugunYMD,
  depoBaslat,
  depoSurucuAta,
  depoYazabilirMi,
  gizliGostergelerDepo,
  gizliPortfoyDepo,
  goc,
  gostergeCikar,
  gostergeEkle,
  gostergelerDepo,
  hamlelerDepo,
  katalizorSatirlari,
  kiyasDepo,
  kiyasaEkle,
  listelerDepo,
  listelerTazele,
  metinSatirlari,
  nakitAyarla,
  nakitBakiye,
  portfoyDepo,
  sayiOku,
  senkronDepo,
  senkronKodYaz,
  senkronYukle,
  senkronZamanYaz,
  sepetDepo,
  sepetGecmisDepo,
  sepeteEkle,
  sepettenCikar,
  tezDayanakDongu,
  tezEkle,
  tezGuncelle,
  tezGunlukEkle,
  tezGunlukSil,
  tezSil,
  tezlerDepo,
  useAramalar,
  useGostergeler,
  useHamleler,
  useKiyas,
  usePortfoy,
  useSepet,
  useSenkron,
  useSenkronHazir,
  useSepetGecmis,
  useTezler,
  useTur,
  useTurHazir,
  type AramaKaydi,
  type BildirimEvreni,
  type DepoSurucu,
  type GizliPortfoyOge,
  type GocSonuc,
  type Gosterge,
  type Hamle,
  type KiyasOge,
  type Pazar,
  type PortfoyOge,
  type SenkronAyar,
  type SepetGecmisKaydi,
  type SepetGirdi,
  type SepetKalemi,
  type Tez,
  type TezDayanak,
  type TezGirdi,
  type TezGunluk,
  type TezKatalizor,
  type TurDepo,
  type VarlikSinifi,
} from './depo';

// NEDEN AYRI SATIR: `senkron.ts` AĞA ÇIKAR (`/api/watchlist`) ama
// `client.ts`e GİRMEDİ — orada her dosya TEK uç sarmalıyor, bu ise
// CİHAZ DEPOSU ile ucu birlikte derliyor: listelerden bildirim evrenini
// kurar, uca yazar, ucun döndürdüğü anı cihaza saklar. `./hareket`
// satırının aynı gerekçesi.
export {
  senkronCek,
  senkronGonder,
  type SenkronCekSonuc,
  type SenkronGonderSonuc,
} from './senkron';

// NEDEN AYRI SATIR: `sepet.ts` de CIHAZ DEPOSU ile ucu birlikte
// derliyor — sepet kayitlarini sinifa gore ayirip ULASILABILEN fiyati
// iki uctan (`/api/degisim`, `/api/kripto`) toplu getiriyor. Metal, fx
// ve fon icin native'de fiyat kaynagi YOK; gerekcesi dosya basliginda.
export {
  sepetFiyatlari,
  type SepetFiyat,
  type SepetFiyatSonuc,
  type SepetKaynaksiz,
} from './sepet';

// NEDEN AYRI SATIR: `serit.ts` de CIHAZ DEPOSU ile ucu birlikte
// derliyor — ust seridin yerlesik alti kalemini (`TICKER_BUILTIN_META`)
// ve cihazdaki ozel gostergeleri sinifa gore ayirip ULASILABILEN fiyati
// uc uctan (`/api/kur`, `/api/kripto`, `/api/degisim`) toplu getiriyor.
// `./sepet` ile BIRLESTIRILMEDI: sepet adet/maliyet tasiyan kayitlari
// fiyatliyor, serit yalniz fiyat basiyor; gerekce dosya basliginda.
export {
  seritFiyatlari,
  SERIT_YERLESIK_IDLER,
  type SeritKalem,
  type SeritSonuc,
} from './serit';
