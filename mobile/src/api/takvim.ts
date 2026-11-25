// =====================================================================
//  /api/takvim SARMALAYICISI — KAP + BIST temettü + ABD olay takvimi
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `api/_kesif.js` → `takvimHandler` (:1043) ucunun tek ölçülmüş
//  istemci girişi: `fetchTakvim()` + cevabın TypeScript karşılığı.
//  Taşıyıcı `api/_takvim.js`; ÜÇ kaynağı ayrıştırıp ekrana hazır liste
//  indiriyor (KAP → finans.mynet.com HTML, temettü →
//  temettuhisseleri.com HTML, ABD olay takvimi →
//  www.federalreserve.gov `calendar.json`).
//
//  ÜÇÜNCÜ BACAK NEDEN EKLENDİ (2026-11-25): "ileriye dönük ABD olay
//  takvimi" isteği. ARAŞTIRILDI ve ÖLÇÜLDÜ: BLS `.ics` 403, Census
//  `.ics` gövdesi HTML (0 olay), Nasdaq ucu yalnız GEÇMİŞ,
//  TradingEconomics misafir anahtarı 410 Gone — ileriye dönük ABD
//  takvimini ÜCRETSİZ ve BELGELİ veren tek kaynak Fed'in kendi JSON'u.
//  ETKİ ROZETİ (Investing.com'un üç boğa simgesi) HİÇBİR ücretsiz
//  kaynakta YOK — bu yüzden BASILMIYOR, uydurulmuyor.
//
//  NEDEN BU UÇ NATIVE'DE EKSİKTİ (ÖLÇÜLDÜ 2026-10-29): uç ÜRETİMDE
//  CANLIYDI ama `mobile/` içinde onu çağıran hiçbir şey yoktu
//  (`grep -rn "api/takvim" mobile/` → 0 eşleşme; `client.ts`
//  `ENDPOINTS` haritasında `takvim` anahtarı yoktu). Web'in `calendar`
//  sekmesinin native karşılığı yoktu; bu dosya o boşluğu kapatıyor.
//
//  NEDEN `client.ts`'DE DEĞİL: `client.ts` SKOR ZİNCİRİNİN uçlarını ve
//  onların ortak kapısını taşıyor (`sembolUcu`: 8 sembol, `vade`, 58 sn).
//  `/api/takvim` o zincirin DIŞINDA: hiçbir skora girdi vermiyor
//  (taşıyıcı başlığı: "BU DOSYA SKORA DOKUNMAZ"), sembol parametresi YOK,
//  `vade` YOK ve kendi kapıları var (`kapsam` beyaz listesi + iki ayrı
//  adet tavanı). Aynı kapıya sokmak üç ayrı sözleşmeyi tek imzaya
//  zorlamak olurdu. `client.ts`'e YALNIZ adres eklendi (`ENDPOINTS.takvim`),
//  başka satırı değişmedi — gerekçe `yfin.ts` başlığıyla aynı.
//
//  NEDEN TÜRLER BU DOSYADA: `api/types.ts` skor sözleşmesinin yeri.
//  Takvim ayrı bir sözleşme ve ayrı değişiyor; yan yana koymak "hangi
//  alan hangi uçtan geliyor" ayrımını siler (yine `yfin.ts` gerekçesi).
//
//  ── ÖLÇÜLDÜ (2026-10-29, ÜRETİM — canlı istek) ─────────────────────
//  GET /api/takvim?kapsam=temettu  → 200, 13 377 bayt
//  GET /api/takvim?kapsam=kap      → 200,  9 718 bayt
//  GET /api/takvim?kapsam=hepsi    → 200, 22 918 bayt
//  (ABD bacagı bu üç ölçümden SONRA eklendi — `kapsam=abd` üretim
//   baytı HENÜZ ÖLÇÜLMEDİ, buraya sayı yazılmıyor. Kaynak gövdesi
//   ölçüldü: `calendar.json` 200, 550 608 bayt, 2618 olay, UTF-8 BOM.)
//  Üst alanlar (gövdeden okundu, varsayılmadı):
//    kapsam · kap? · kapAdet? · temettu? · temettuAdet? ·
//    temettuAtlanan? · temettuTekrar? · sayac · tam · ms · uyari
//    · `kapsam=kap`   → gövdede `temettu*` anahtarları HİÇ YOK.
//    · `kapsam=temettu` → gövdede `kap*` anahtarları HİÇ YOK.
//      Bu yüzden türde `?` (isteğe bağlı) ile `| null` BİRLİKTE var:
//      anahtarın YOKLUĞU "sormadım", değerin `null`u "ölçemedim",
//      `[]` ise "ölçtüm, yok". Üçü AYRI şey (uç başlığı aynısını yazıyor).
//    · `kapAdet: 30` · `temettuAdet: 120` (ucun varsayılanları)
//    · `temettuAtlanan: 0` · `temettuTekrar: 0`
//    · `sayac: {istek,basari,hata,zamanAsimi,kisa,bayt}` — `HaberSayac`
//      ile BİREBİR aynı şekil, bu yüzden `haberOlcumEksik()` bu gövdede
//      KULLANILABİLİR (aşağıda gerekçesi).
//    · `tam: true` · `ms: 98 / 334 / 16` · `uyari` metni dolu.
//
//  ÖLÇÜLMÜŞ TUZAK — `kap[].symbol` `null` OLABİLİR: 30 duyurunun 16'sı
//  `symbol: null`, `tickers: []` döndü (ölçüm: aynı canlı istek). Sebep
//  çok sembollü başlıklarda (`"***GRFIN ** EMVAR*** …"`) uçtaki regex'in
//  eşleşmemesi; bu BİLİNEN ve kasten onarılmamış bir arıza
//  (`app.js:255` ikizi). İSTEMCİ BAŞLIKTAN SEMBOL AYRIŞTIRMAZ: o,
//  native'de yasak olan "ekranda hesap" olurdu ve yanlış sembol basmak
//  ölçülmemiş veri uydurmaktır.
//
//  BURADA HESAP YOK: bu dosya hiçbir oranı ölçeklemez, tarih
//  biçimlemez, sıralama yapmaz. Sıralama uçta (`_takvim.js`), biçimleme
//  `lib/format.ts`.
//
//  BİRİM TUZAĞI — `temettu[].yieldPct` YÜZDE PUANI: ölçüldü 1.04 =
//  %1,04 (oran DEĞİL) → 100 ile ÇARPILMAZ, doğru biçimleyici
//  `formatPercent`. `amount` ise hisse başı PARA (0.0816) ve birimi
//  `currency` ('TRY') — `formatPrice(amount, currency)`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  apiGet,
  ENDPOINTS,
  type ApiResult,
  type HaberSayac,
  type RequestOptions,
} from './client';

/**
 * Kapsam beyaz listesi — UCUN KENDİ kümesinin kopyası
 * (`api/_takvim.js` `KAPSAMLAR`). SESSİZ GENİŞLEME YOK: listede
 * olmayan bir değer uçta 400 `bad_kapsam` demek, o yüzden burada da
 * ağa çıkmadan kesiliyor.
 *
 * DÖRT değer (`'abd'` eklendi 2026-11-25). Ucun kendi kilidi
 * `tests/uc-test.mjs` ⑦a: `KAPSAMLAR.join(',') === 'hepsi,kap,temettu,abd'`
 * — bu dizi o sırayla BİREBİR aynı kalmalı.
 */
export const TAKVIM_KAPSAMLAR = ['hepsi', 'kap', 'temettu', 'abd'] as const;
export type TakvimKapsam = (typeof TAKVIM_KAPSAMLAR)[number];

/** Ucun varsayılan kapsamı (`api/_takvim.js` `VARSAYILAN_KAPSAM`). */
export const VARSAYILAN_TAKVIM_KAPSAM: TakvimKapsam = 'hepsi';

/**
 * KAP madde tavanı — ÖLÇÜLDÜ: `api/_takvim.js` `AZAMI_KAP = 60`.
 * Aşımı uç 400 `bad_limit` ile REDDEDİYOR (sessiz kırpma YOK, bkz.
 * `adetOku`), bu yüzden kapı burada da aynı sayıyla duruyor —
 * kullanıcı neyi sormadığını bilsin.
 */
export const TAKVIM_AZAMI_KAP = 60;

/** Temettü madde tavanı — ÖLÇÜLDÜ: `AZAMI_TEMETTU = 400`. */
export const TAKVIM_AZAMI_TEMETTU = 400;

/**
 * Ucun temettu icin ILAN ETTIGI varsayilan adet. Istemci bir adet
 * GONDERMEDIGINDE ucun uyguladigi tavan budur — sayi UYDURULMADI,
 * `api/_takvim.js` sozlesmesinden okundu.
 *
 * NEDEN BURADA: tavanin dolup dolmadigini gorebilmek icin istemcinin
 * "ne sorduguna" karsilik gelen sayiyi bilmesi gerekiyor (gelecek
 * temettu tuzagi — `TakvimResponse.temettuGelecekAdet` notu).
 */
export const TAKVIM_VARSAYILAN_TEMETTU = 120;

/**
 * ABD olay tavanı — ÖLÇÜLDÜ: `api/_takvim.js` `AZAMI_ABD = 200`.
 * Aşımı uç 400 `bad_limit` ile reddediyor (sessiz kırpma YOK).
 */
export const TAKVIM_AZAMI_ABD = 200;

/**
 * Ucun ABD için İLAN ETTİĞİ varsayılan adet (`VARSAYILAN_ABD = 60`).
 *
 * ÖLÇÜLMÜŞ TUZAK — TAVAN GERÇEKTEN DOLUYOR: kaynak 2618 olay
 * taşıyor; ileri süzgeçsiz çağrı TAM 200 madde döndü (= tavan).
 * Uç kendi `bugun`ünü her zaman gönderdiği için üretimde ileriye
 * dönük 80 madde kaldı (47 satır, `atlanan 570`) — yani varsayılan 60
 * ile liste KıRPILABİLİR. Ekran tavana değdiğini görebilsin diye bu
 * sayı burada yazılı; istemci sayı UYDURMUYOR.
 */
export const TAKVIM_VARSAYILAN_ABD = 60;

/**
 * Tek KAP duyurusu. Alan kümesi ucun ilan ettiği küme
 * (`api/_takvim.js` `KAP_MADDE_ALANLARI`) — FAZLA alan türetilmedi.
 *
 * İlk dört alan `HaberMadde` ile BİREBİR örtüşüyor (uç bunu bilerek
 * yapıyor: `_takvim.js` notu "madde alan adları bilerek `_haber.js`in
 * `MADDE_ALANLARI` kümesiyle ÖRTÜŞÜYOR"), bu yüzden bu madde
 * `HaberSatiri` bileşenine olduğu gibi verilebiliyor ve ikinci bir
 * satır bileşeni yazılmadı.
 */
export type TakvimKapMadde = {
  title: string;
  link: string;
  /** ISO + AÇIK dilim: "2026-10-29T19:13:00+03:00" (ölçüldü). */
  pubDate: string;
  /** Kaynağın kendi yazdığı hâl: "29 Eki 2026 19:13" (ölçüldü). */
  pubDateHam: string;
  /** Ölçüldü: daima "Mynet Finans" (`KAP_KAYNAK`). */
  source: string;
  /** Ölçüldü: daima "KAP" (`TAKVIM_TURU`). */
  type: string;
  /**
   * `null` OLABİLİR ve ÖLÇÜLDÜ: 30 duyurunun 16'sı `null` döndü.
   * Çok sembollü başlıkta uçtaki regex eşleşmiyor (bilinen arıza).
   * `null` → "sembol AYRIŞTIRILAMADI"; başlıktan türetmek YASAK.
   */
  symbol: string | null;
  /** Başlıkta geçen semboller; `symbol` `null` iken `[]` (ölçüldü). */
  tickers: string[];
};

/**
 * Tek temettü satırı. Alan kümesi `TEMETTU_MADDE_ALANLARI`.
 *
 * ÜÇ FARKLI ÖLÇEK AYNI SATIRDA — her alanın birimi yanında yazılı;
 * tek biçimleyiciye vermek 100 kat yanlış sayı basmak olurdu.
 */
export type TakvimTemettuMadde = {
  /** BIST sembolü (`.IS` eki YOK — ölçüldü: "DESA", "ASELS"). */
  symbol: string;
  /** ISO gün: "2026-10-30" (ölçüldü). Saat/dilim taşımıyor. */
  date: string;
  /** Kaynağın Türkçe hâli: "30 Ekim" (ölçüldü). */
  dateHam: string;
  /** Hisse başı tutar — **PARA**, birimi `currency`. Ölçüldü: 0.0816. */
  amount: number;
  /**
   * Verim — **YÜZDE PUANI** (ölçüldü: 1.04 = %1,04), ORAN DEĞİL.
   * `formatOran`a verilirse kullanıcı 0-1 oranı sanır → 100 kat yanlış
   * okuma. Doğru biçimleyici `formatPercent`; 100 ile ÇARPILMAZ.
   */
  yieldPct: number;
  /** Makine kodu ('TRY'), ekran simgesi değil (`PARA_BIRIMI`). */
  currency: string;
  /**
   * Odeme gunu GECTI mi — `temettuOdendi(tarih, bugun)`
   * (api/_takvim.js). UC DEGER, UCU DE AYRI:
   *   · `true`  → tarih BUGUN ya da GECMIS
   *   · `false` → tarih GELECEK
   *   · `null`  → OLCULEMEDI (uca `bugun` gelmedi / tarih cozulmedi)
   *
   * ⚠️ `null` "odenmedi" DEGIL. `false` ile `null` ayni yazilamaz.
   */
  paid: boolean | null;
};

/**
 * Tek ABD olayı. Alan kümesi ucun ilan ettiği küme
 * (`api/_takvim.js` `ABD_MADDE_ALANLARI`) — FAZLA alan türetilmedi.
 *
 * İKİ SAAT ALANI AYRI ŞEY: `an` makine zamanı (ISO + açık dilim),
 * `saatHam` kaynağın kendi yazdığı metin. Biri biçimlemeye, öteki
 * "kaynak ne yazmış" göstermeye yarar; tek alana indirmek ölçülen
 * veriyi kaybetmek olurdu.
 */
export type TakvimAbdMadde = {
  /** ABD takvim günü, ISO: "2026-12-09" (ölçüldü). */
  date: string;
  /**
   * ISO + AÇIK dilim: "2026-12-09T14:00:00-05:00" (ölçüldü).
   *
   * `null` OLABİLİR ve ÖLÇÜLDÜ: ileriye dönük 80 maddenin 4'ü
   * SAATSİZ geldi. `null` → "günü var, saati yok"; uç bunları gün
   * içinde EN SONA sıralıyor. Saat uydurmak yasak.
   *
   * YAZ SAATİ TUZAĞI: dilim eki sabit DEĞİL — ölçüldü, Aralık
   * "-05:00", Temmuz "-04:00". `an`ı kendi dilimine çevirmek
   * `lib/format.ts`in işi; burada ham hâliyle duruyor.
   */
  an: string | null;
  /**
   * Kaynağın kendi yazdığı saat: "2:00 p.m." (ölçüldü).
   * Çözülemeyen/boş hâllerde `null`.
   */
  saatHam: string | null;
  title: string;
  /**
   * MAKİNE KODU — Türkçesi `lib/sozluk.ts` `ABD_TAKVIM_TUR_SOZLUK`te
   * (TÜRKÇE TEK YERDE). Ucun `ABD_TUR_ESLEME` kümesi dokuz kod
   * üretiyor; TANIMADIĞI tür `'diger'` oluyor ve SATIR ATıLMIYOR.
   *
   * Ölçüldü (ileriye dönük dağılım): veri 74 · fomc 3 · diger 2 · bej 1.
   */
  tur: string;
  /**
   * Canlı yayın var mı.
   *
   * ADRES TAŞIMIYOR — bilinçli: kaynak üçüncü taraf yayın
   * adresleri yazıyor, uç bunları GÖVDEYE KOYMUYOR. Ölçüldü ve
   * `tests/uc-test.mjs` ⑦l'de kilitlendi:
   * `JSON.stringify(maddeler).includes('http') === false`.
   */
  canli: boolean;
  /** Ölçüldü: daima "Federal Reserve" (`ABD_KAYNAK`). */
  kaynak: string;
};

/**
 * FOMC FAİZ BEKLENTİSİ — `api/_faiz.js` gövdesinin BİREBİR aynası.
 *
 * NE: 30 günlük Fed Funds vadeli sözleşmesinin (ZQ) KENDİ fiyatından
 * okunan, karar sonrası politika faizi. TAHMİN ÜRETİLMİYOR; piyasanın
 * o an ödediği fiyat çevriliyor. Dolayısıyla bu bir ÖLÇÜM, görüş değil.
 *
 * NASIL: karar ayından ÖNCEKİ ayın sözleşmesi karar öncesi oranı verir
 * (o ayda toplantı yoksa oran ay boyunca sabittir). Karar AYININ
 * sözleşmesi ise ayın ORTALAMA oranını verir — eski ve yeni oranın gün
 * ağırlıklı karışımı. Eski ayak bilindiğine göre YENİ oran çözülür.
 *
 * `null` = ÖLÇÜLEMEDİ, asla "0" ya da "değişim yok" demek değil.
 * Nedeni `kod` alanında yazılı.
 */
export type TakvimFaiz = {
  /** FOMC karar günü (ISO) — takvimin kendi içinden geldi. `null` → yok. */
  toplanti: string | null;
  /** Karar ayından önceki ayın ZQ sözleşmesi, örn. "ZQX26.CBT". */
  oncekiSembol: string | null;
  /** Karar ayının ZQ sözleşmesi, örn. "ZQZ26.CBT". */
  toplantiSembol: string | null;
  /** Sözleşme fiyatı (100 − yıllık oran) — HAM, yuvarlanmadı. */
  oncekiFiyat: number | null;
  toplantiFiyat: number | null;
  /** Karar ÖNCESİ ima edilen politika faizi (%). */
  oncesiOran: number | null;
  /** Karar AYININ ortalama ima edilen oranı (%) — karışım. */
  ayOrtalamaOran: number | null;
  /** Karar SONRASI çözülen oran (%). */
  sonrasiOran: number | null;
  /**
   * Beklenen değişim, BAZ PUAN. Pozitif = artış beklentisi.
   * `null` → ölçülemedi (fiyat yok ya da toplantı yok).
   */
  degisimBp: number | null;
  /**
   * FOMC'nin KENDİ adım boyu (25 bp) — EŞİK DEĞİL, ölçek birimi.
   * Ekran "kaç adım" diye okumak isterse bölen bu.
   */
  basamakBp: number;
  /**
   * `degisimBp / basamakBp` — KIRPILMAMIŞ ham oran. 1 civarı = tam bir
   * adım, 0.5 = yarım adım fiyatlanıyor. Yuvarlanmadı.
   */
  basamakOrani: number | null;
  /** +1 artış · −1 indirim · 0 değişim yok. `null` → ölçülemedi. */
  yon: number | null;
  /** Karar ayının gün sayısı ve ayın kaçıncı günü karar olduğu. */
  gunSayisi: number | null;
  toplantiGunu: number | null;
  /** Gün ağırlıkları — eski ve yeni oranın ay içindeki payı. */
  agirlikEski: number | null;
  agirlikYeni: number | null;
  /**
   * Kullanılan ağırlık SÖZLEŞMESİ (makine kodu):
   * `'ertesi-gun'` → yeni oran kararın ERTESİ İŞ GÜNÜ yürürlükte
   * (Fed'in kendi uygulama notu ve CME FedWatch bu bölmeyi kullanıyor;
   * ölçüldü: tam 25 bp'lik temiz bir adıma oturuyor).
   */
  agirlikYontemi: string | null;
  /**
   * ÖTEKİ sözleşmeye göre aynı ölçüm (`'toplanti-gunu'`), yan yana
   * basılabilsin diye. Ölçülen duyarlılık ~1 bp — yani seçim sonucu
   * kökünden değiştirmiyor, ama sayı saklanmıyor.
   */
  degisimBpAlternatif: number | null;
  agirlikYontemiAlternatif: string;
  /**
   * ÜÇ DEĞERLİ: `true` → önceki ayda DA toplantı var (o ayın
   * sözleşmesi sabit oran taşımaz, ölçüm geçersiz) · `false` → yok
   * (ölçüm geçerli) · `null` → BİLİNMİYOR (takvim listesi
   * gelmedi). `null` ölçümü ENGELLEMEZ; yalnız kesinliği azaltır.
   */
  oncekiAydaToplanti: boolean | null;
  /** Ölçüldü: daima "CME ZQ (Yahoo Finance)". */
  kaynak: string;
  /**
   * MAKİNE KODU — Türkçesi `lib/sozluk.ts` `FAIZ_KOD_SOZLUK`te
   * (TÜRKÇE TEK YERDE). `null` = ÖLÇÜLDÜ, sorun yok.
   * Kodlar: `toplanti_yok` · `onceki_ay_toplantili` · `fiyat_okunamadi`.
   */
  kod: string | null;
  /**
   * FAİZ BACAĞININ KENDİ SAYACI — gövdenin `sayac`ından AYRI.
   * Sebebi: ZQ isteği düşse KAP+temettü gövdesi "eksik"
   * damgalanmasın. Şekli yine aynı altı alan.
   */
  sayac: HaberSayac;
  /** `false` → faiz bacağında kesinti oldu. Gövdenin `tam`ı etkilenmez. */
  tam: boolean;
};

/**
 * `/api/takvim` cevabı.
 *
 * NEDEN HEM `?` HEM `| null`: ikisi AYRI anlam taşıyor ve uç bunu
 * ayırıyor. Anahtar GÖVDEDE YOKSA o kaynak HİÇ İSTENMEDİ (`kapsam`
 * dışı kaldı); anahtar VAR ama `null` ise İSTENDİ ve OKUNAMADI
 * (`tam:false` ile birlikte); `[]` ise okundu ve boş. Tek bir
 * `kap: TakvimKapMadde[]` yazmak bu üç hâli birbirine karıştırırdı.
 */
export type TakvimResponse = {
  /** İsteğin yankısı — gönderdiğimiz (ya da ucun varsaydığı) kapsam. */
  kapsam: TakvimKapsam | string;
  kap?: TakvimKapMadde[] | null;
  /** Ucun saydığı adet; istemci yeniden saymaz. `null` → ölçülemedi. */
  kapAdet?: number | null;
  temettu?: TakvimTemettuMadde[] | null;
  temettuAdet?: number | null;
  /** Ayrıştırıcının ATLADIĞI satır sayısı — sessizce kaybolmasın. */
  temettuAtlanan?: number | null;
  /** TEKİLLEŞTİRİLEN satır sayısı. */
  temettuTekrar?: number | null;
  /**
   * `paid === true` olan satir sayisi — UCUN saydigi adet
   * (api/_kesif.js sozlesmesi + api/_takvim.js govdesi).
   */
  temettuGecmisAdet?: number | null;
  /**
   * `paid === false` olan satir sayisi (GELECEK odemeler).
   *
   * ⚠️ OLCULMUS TUZAK: kaynak aylari OCAK→ARALIK siralı basiyor ve uc
   * maddeleri DOKUMAN SIRASINDA tavana kadar aliyor. Yilin ikinci
   * yarisinda varsayilan tavan (120) GECMIS satirlarla dolabiliyor ve
   * gelecek temettu HIC gorunmeyebiliyor. Istemci `temettuGelecekAdet
   * === 0` ve basilan adet tavana degmis ise `temettuAdet=400` ile
   * YENIDEN SORMALI (uc bunu kendisi yapmiyor).
   */
  temettuGelecekAdet?: number | null;
  /** Ucun `paid` kiyasinda kullandigi gun (ISO) — `null` → yoktu. */
  temettuBugun?: string | null;
  /**
   * İLERİYE DÖNÜK ABD olayları, güne ve saate göre SIRALI (sıralama
   * uçta; istemci yeniden sıralamaz). Saatsiz maddeler günün SONUNDA.
   */
  abd?: TakvimAbdMadde[] | null;
  abdAdet?: number | null;
  /** Ucun kendi hesapladiğı ABD takvim günü (ISO) — sınır günü. */
  abdBugun?: string | null;
  /**
   * Ayrıştırıcının ATLADIĞI satır sayısı.
   *
   * ÖLÇÜLDÜ ve BÜYÜK: 2618 olayın 570'inde `month` alanı boş (569
   * `""`, 1 `"YOK"`), bu yüzden `atlanan` ÜRETİMDE 570 ölçüldü. Bu
   * ARIZA DEĞİL, kaynağın kendi şekli; 570'in 370'i tarihli bir
   * satırla aynı `title|days` çiftini paylaşıyor (yani çoğu KOPYA).
   * Ekran bu sayıyı "hata" diye BASMAZ.
   *
   * İLERİ SÜZGEÇ BU SAYIYA GİRMEZ: geçmişte kalan günler
   * `atlanan`ı ARTIRMIYOR (uç ayrı dal kullanıyor).
   */
  abdAtlanan?: number | null;
  /**
   * FOMC faiz beklentisi — YALNIZ ABD bacağı istendiğinde var.
   *
   * ÜÇ HÂL AYRI: anahtar YOKSA istenmedi · `null` ise bacak komple
   * düştü · nesne VAR ama `kod` dolu ise ÖLÇÜLEMEDİ ve nedeni
   * `kod`da. `kod: null` = ölçüldü.
   */
  faiz?: TakvimFaiz | null;
  /**
   * Şekli `HaberSayac` ile BİREBİR aynı (ölçüldü: aynı altı alan).
   * Bu yüzden `haberOlcumEksik()` bu gövdede kullanılabiliyor ve
   * ekranda ikinci bir "eksik mi" eşiği yazılmıyor.
   */
  sayac: HaberSayac;
  /** `false` → 200 olsa bile İSTENEN kaynakların biri ölçülemedi. */
  tam: boolean;
  ms: number;
  uyari: string;
};

/** Ucun makine hata kodları (`takvimHandler` + taşıyıcı). */
export type TakvimErrorCode =
  | 'bad_kapsam'
  | 'bad_limit'
  | 'method_not_allowed'
  | 'takvim_alinamadi';

/**
 * Ucun bütçesi. ÖLÇÜLDÜ: `api/proxy.js` `maxDuration: 30` ve
 * `api/_takvim.js` `TAKVIM_ISTEK_MS = 10000`.
 *
 * ÜÇ KAYNAK PARALEL (2026-11-25'ten beri; önce ikiydi). Paralel
 * oldukları için en kötü hâl üç × 10 sn DEĞİL ~10 sn + ayrıştırma;
 * ama bu sayı ARTIK SEÇİM DEĞİL, ZORUNLU: 28 sn, proxy'nin 30 sn'lik
 * tavanının hemen altında kalan en büyük değer. Gerekçesi
 * `fetchTakvim` başlığında.
 */
export const TAKVIM_TIMEOUT_MS = 28_000;

export type TakvimOptions = Omit<RequestOptions, 'query'> & {
  /** Verilmezse ucun varsayılanı ('hepsi') kullanılır. */
  kapsam?: TakvimKapsam;
  /** 1..60. Verilmezse ucun varsayılanı (30); istemci sayı uydurmaz. */
  kapAdet?: number;
  /** 1..400. Verilmezse ucun varsayılanı (120). */
  temettuAdet?: number;
  /** 1..200. Verilmezse ucun varsayılanı (60). */
  abdAdet?: number;
};

/** Yerel kapı — ucun KENDİ kodunu taşıyan `ApiResult` hatası. */
function takvimKapi<T>(code: TakvimErrorCode, message: string): ApiResult<T> {
  return {
    ok: false,
    error: { kind: 'bad-request', message, endpoint: ENDPOINTS.takvim, code },
  };
}

/**
 * Takvim çağrısı: GET /api/takvim?kapsam=hepsi&kapAdet=30&temettuAdet=120
 *
 * NEDEN `DEFAULT_TIMEOUT_MS` (12 sn) DEĞİL, 28 sn: uç ÜÇ kaynağı
 * PARALEL çekiyor (iki HTML sayfası + Fed'in 550 KB'lık `calendar.json`'u)
 * ama kendi istek tavanı 10 sn (`TAKVIM_ISTEK_MS`) ve üstüne ayrıştırma
 * var; `api/proxy.js` bütçesi 30 sn. 12 sn'lik ortak varsayılan, uç hâlâ
 * çalışırken bağlantıyı keser ve çalışan bir ölçümü "zaman aşımı" diye
 * gösterirdi — ucun DÜRÜST sayacını göremezdik. Tavan 28 sn: üçüncü
 * bacakla birlikte artık SEÇİM değil, proxy'nin 30 sn'sinin altında
 * kalan en büyük değer — cevabı ucun kendisi yazsın.
 *
 * NEDEN YEREL KAPILAR: uç aşımı SESSİZCE KIRPMIYOR, 400 ile reddediyor
 * (`adetOku`, `bad_limit`). Ağa çıkıp 400 yemek yerine aynı kodu burada
 * üretmek, kullanıcıya "istediğin sayı sorulmadı"yı doğru söylemek
 * demek — `fetchArama`nın yerel kapılarıyla aynı desen.
 *
 * BOŞ LİSTE HATA DEĞİL: 200 + `kap: []` ÖLÇÜLMÜŞ bir cevaptır
 * ("okudum, duyuru yok"). `null` ayrı dal: "istedim, okuyamadım".
 * Ayrımı ekran yapar; bu işlev ikisini de `ok: true` geçirir.
 */
export async function fetchTakvim(
  options: TakvimOptions = {},
): Promise<ApiResult<TakvimResponse>> {
  const {
    kapsam,
    kapAdet,
    temettuAdet,
    abdAdet,
    timeoutMs = TAKVIM_TIMEOUT_MS,
    signal,
  } = options;

  if (kapsam !== undefined && !(TAKVIM_KAPSAMLAR as readonly string[]).includes(kapsam)) {
    return takvimKapi<TakvimResponse>(
      'bad_kapsam',
      'Takvim kapsamı şunlardan biri olmalı: ' + TAKVIM_KAPSAMLAR.join(', ') + '.',
    );
  }
  if (
    kapAdet !== undefined &&
    (!Number.isInteger(kapAdet) || kapAdet < 1 || kapAdet > TAKVIM_AZAMI_KAP)
  ) {
    return takvimKapi<TakvimResponse>(
      'bad_limit',
      'KAP duyuru adedi 1 ile ' + TAKVIM_AZAMI_KAP + ' arasında olmalı.',
    );
  }
  if (
    temettuAdet !== undefined &&
    (!Number.isInteger(temettuAdet) || temettuAdet < 1 || temettuAdet > TAKVIM_AZAMI_TEMETTU)
  ) {
    return takvimKapi<TakvimResponse>(
      'bad_limit',
      'Temettü satırı adedi 1 ile ' + TAKVIM_AZAMI_TEMETTU + ' arasında olmalı.',
    );
  }
  if (
    abdAdet !== undefined &&
    (!Number.isInteger(abdAdet) || abdAdet < 1 || abdAdet > TAKVIM_AZAMI_ABD)
  ) {
    return takvimKapi<TakvimResponse>(
      'bad_limit',
      'ABD olay adedi 1 ile ' + TAKVIM_AZAMI_ABD + ' arasında olmalı.',
    );
  }

  return apiGet<TakvimResponse>(ENDPOINTS.takvim, {
    // `buildUrl` `undefined`/`null` anahtarları ATLIYOR: verilmeyen
    // parametre sorguya hiç basılmıyor ve ucun kendi varsayılanı
    // geçerli oluyor. Burada bir varsayılan yazmak, ucun sayısını
    // istemcide İKİNCİ kez tanımlamak olurdu.
    query: { kapsam, kapAdet, temettuAdet, abdAdet },
    timeoutMs,
    signal,
  });
}
