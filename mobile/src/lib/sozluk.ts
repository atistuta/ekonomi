// =====================================================================
//  SÖZLÜK — makine kodu → Türkçe cümle
// =====================================================================
//  NİYE VAR: HAM SAYI KURALI uç ile native arasında serbest Türkçe metin
//  taşımayı yasaklıyor (BAGIMLILIK_GRAFIGI.md §5.1). Uç motorun kendi
//  çıktısını SABİT KÜMELİ bir koda çeviriyor; cümleyi istemci BURADAN
//  seçiyor. Böylece eşik/ağırlık YALNIZ motorda kalıyor.
//
//  BU DOSYADA HESAP YOK: ne eşik, ne ağırlık, ne formül, ne karşılaştırma.
//  Yalnız kod → cümle eşlemesi. Kod sözlükte yoksa cümle de yok (`null`) —
//  uydurma cümle basılmaz.
//
//  SÖZCÜK SEÇİMİ BİLİNÇLİ: webdeki metinler ('🔥 Güçlü Fırsat',
//  '⛔ Uzak dur') VAAT ve TAVSİYE dili; native'de yasak. Burada aynı
//  kapalı küme ÖLÇÜM diliyle yazıldı: hangi bantta olduğunu bildirir,
//  ne yapılacağını söylemez.
// =====================================================================

import type {
  BildirimErrorCode,
  DuyarlilikKod,
  FirsatCls,
  HareketErrorCode,
  HareketKodu,
  KatalizorTarihTuru,
  KatalizorTemettuKodu,
  IceridenDurumKodu,
  IceridenIliskiKodu,
  IceridenKaynakKodu,
  IceridenYonKodu,
  MaliDurumKodu,
  MaliKalemKodu,
  NedenHareketKodu,
  NedenHaberYonKodu,
  NedenKutupKodu,
  NedenUzlasmaKodu,
  NedenYonKodu,
  PushIzin,
  PushKurSebep,
  Vade,
  VarlikSinifi,
} from '@/api';

/**
 * `oppTag().cls` (app.js:9111) → bant cümlesi. Eşikler (66/56/52/48/44)
 * motorda; burada sayı YOK, yalnız bandın ADI geçiyor.
 */
export const FIRSAT_SOZLUK: Record<FirsatCls, string> = {
  strong: 'Bileşik skor en üst bantta',
  good: 'Bileşik skor üst bantta',
  watch: 'Bileşik skor orta-üst bantta',
  neutral: 'Bileşik skor nötr bantta',
  weak: 'Bileşik skor alt bantta',
  risk: 'Bileşik skor en alt bantta',
};

/** Rozete sığan kısa biçim — aynı kapalı küme, aynı ton. */
export const FIRSAT_ROZET: Record<FirsatCls, string> = {
  strong: 'en üst bant',
  good: 'üst bant',
  watch: 'orta-üst bant',
  neutral: 'nötr bant',
  weak: 'alt bant',
  risk: 'en alt bant',
};

/**
 * `api/news.js DUYARLILIK_KODU` → cümle. `cls` ile seçilemiyor: motorun
 * beş cümlesi üç `cls`e düşüyor (ÖLÇÜLDÜ, uc-test ⑭j). `'yok'` hiç
 * sinyal veren manşet olmadığını, `'notr'` sinyallerin birbirini
 * götürdüğünü söyler — ikisi de `cls: 'neutral'`, ayrı cümle.
 */
export const DUYARLILIK_SOZLUK: Record<DuyarlilikKod, string> = {
  pos_guclu: 'Pozitif haber akışı',
  pos_hafif: 'Hafif pozitif haber akışı',
  notr: 'Nötr haber akışı (sinyaller birbirini dengeledi)',
  neg_hafif: 'Hafif negatif haber akışı',
  neg_guclu: 'Negatif haber akışı',
  yok: 'Haber sinyali yok',
};

/** Rozete sığan kısa biçim. */
export const DUYARLILIK_ROZET: Record<DuyarlilikKod, string> = {
  pos_guclu: 'pozitif',
  pos_hafif: 'hafif pozitif',
  notr: 'nötr',
  neg_hafif: 'hafif negatif',
  neg_guclu: 'negatif',
  yok: 'sinyal yok',
};

/**
 * `atrVolKod().kod` (motor, Ş8 #14) → oynaklık bandı cümlesi. Eşikler
 * (2 / 4) motorda; burada sayı YOK, yalnız bandın ADI geçiyor.
 *
 * TON: webdeki cümle "yüksek volatilite" diyordu; anlamı aynı, dili
 * ÖLÇÜM. Ne yapılacağını söylemiyor.
 */
export const OYNAKLIK_SOZLUK: Record<string, string> = {
  yuksek: 'Yüksek oynaklık bandında',
  orta: 'Orta oynaklık bandında',
  dusuk: 'Düşük oynaklık bandında',
};

/** Rozete / satır notuna sığan kısa biçim — aynı kapalı küme. */
export const OYNAKLIK_ROZET: Record<string, string> = {
  yuksek: 'yüksek oynaklık',
  orta: 'orta oynaklık',
  dusuk: 'düşük oynaklık',
};

/**
 * `atrPlanKod().kod` (motor, Ş8 #14) → plan/stop bandı cümlesi. İKİ kod
 * var, ÜÇÜNCÜ YOK: motor orta bantta `null` döndürüyor ve o halde ekranda
 * CÜMLE BASILMIYOR (web `fillCatalysts` ile birebir — orada da arada
 * hiçbir madde eklenmiyordu). Sözlüğe "orta" girdisi eklemek webdeki
 * SESSİZLİĞİ bozardı.
 */
export const ATR_PLAN_SOZLUK: Record<string, string> = {
  genis: 'Fiyat bölgeleri geniş ölçülüyor — giriş ve çıkış aralıkları açık',
  sakin: 'Seyir sakin ölçülüyor — bölge sınırları birbirine yakın',
};

/**
 * ⚡ GÜN İÇİ NABIZ (`/api/chart` → `gunici`, Ş8 #1/#6) → cümle.
 *
 * UÇTAN GELEN ALANLAR BOOLEAN: `sudden` (saatlik VEYA günlük eşik
 * aşıldı), `bigDay` (yalnız günlük eşik), `breakout` (gün içi önceki
 * en yükseği aştı). EŞİK SAYILARI MOTORDA (`PULSE_TH`) — native hiçbir
 * eşiği ne taşıyor ne karşılaştırıyor; yalnız motorun verdiği
 * boolean'ı cümleye çeviriyor.
 *
 * "SAKİN" GİRDİSİ YOK: üçü de `false` ise ekranda CÜMLE BASILMIYOR
 * (ATR orta bandıyla aynı kural — ölçüm var, söylenecek bir şey yok).
 */
export const GUNICI_SOZLUK: Record<string, string> = {
  gun_buyuk: 'Günlük hareket motorun eşiğini aştı',
  ani_saatlik: 'Son saatlik hareket motorun eşiğini aştı',
  kirilim: 'Fiyat gün içi önceki en yükseği aştı',
};

/**
 * Boolean üçlüsü → TEK kod. SAF ve eşiksiz: burada hiçbir sayı
 * karşılaştırılmıyor, yalnız hangi cümlenin basılacağına karar
 * veriliyor (günlük > saatlik > kırılım). `null` → satır çizilmez.
 *
 * NİYE BURADA: karar cümle seçimidir, bileşenin işi değil — aynı
 * sıralama iki kartta ayrı ayrı yazılmasın diye tek yerde.
 */
export function guniciNabizKodu(
  o: { sudden?: boolean; bigDay?: boolean; breakout?: boolean } | null | undefined,
): string | null {
  if (!o) return null;
  if (o.bigDay === true) return 'gun_buyuk';
  if (o.sudden === true) return 'ani_saatlik';
  if (o.breakout === true) return 'kirilim';
  return null;
}

/**
 * `guniciKod` SESSİZLİKLERİ. İKİ kod var, sözlükte BİR tane:
 *   · `mum_az`           → ÖLÇEMEDİM (3'ten az mum) — yazılır.
 *   · `adim_uygun_degil` → SORMADIM (adım 5m değil) — CÜMLE YOK,
 *     ekranda hiç satır çizilmez. Kullanıcıya sormadığımız bir şeyi
 *     "ölçemedim" diye yazmak yalan olurdu.
 */
export const GUNICI_SESSIZLIK_SOZLUK: Record<string, string> = {
  mum_az: 'gün içi nabız ölçülemedi — seride 3 mumdan az veri var',
};

/**
 * ⚠️ FİYAT YALANLAMA kaynak kodları → Türkçe ÖLÇÜM cümlesi.
 * CÜMLELER ÖLÇÜM DİLİNDE: ne tavsiye ne vaat. Sayıları BU SÖZLÜK
 * YAZMAZ — çağıran ham sayıyı kendi biçimleyip cümlenin yanına koyar.
 * EVREN AÇIKÇA YAZILI: cümle "senin evrenin" demiyor — ölçüm sabit
 * bir evren üzerinden alınıyor.
 */
export const GERCEKLIK_SOZLUK: Record<string, string> = {
  genislik_zayif: 'piyasa genişliği zayıf — ölçülen evrenin ortalama teknik skoru nötrün altında',
  genislik_guclu: 'piyasa genişliği güçlü — ölçülen evrenin ortalama teknik skoru nötrün üstünde',
  satirlar_eksi: 'ölçülen sembollerin büyük bölümü bugün ekside',
  satirlar_arti: 'ölçülen sembollerin büyük bölümü bugün artıda',
};

/**
 * `eksikGerceklik` kodları → NESİ ÖLÇÜLMEDİ cümlesi. Bu dizi
 * BOŞLUĞU DÜRÜSTLEŞTİRİR: kaynağın düşmesi "fiyat duruşu
 * onayladı" DEĞİL, "ölçemedim" demek.
 */
export const GERCEKLIK_EKSIK_SOZLUK: Record<string, string> = {
  genislik: 'piyasa genişliği ölçümü alınmadı',
  genislikYas: 'piyasa genişliğinin yaşı bilinmiyor — bayat ölçüm fiyat gerçekliği sayılmıyor',
  gunDegisimleri: 'sembollerin gününü ölçen veri alınmadı',
};

/**
 * ⚠️ MAKRO YORUM kodları → Türkçe ÖLÇÜM cümlesi (motor
 * `pulseMakroYorumKod`). TAVSİYE DEĞİL: cümleler ne al/sat der ne
 * vaat eder — yalnız manşetlerden OKUNAN yönü anlatır.
 * EŞİK SAYISI YOK: eşik motorda kalır; buraya yalnız `inflIsinma` /
 * `inflSoguma` boolean'ı gelir.
 */
export const MAKRO_YORUM_SOZLUK: Record<string, string> = {
  sakin: 'öne çıkan faiz/enflasyon manşeti yok — makro cephe sakin',
  hawk: 'faiz tarafında şahin/sıkılaşma okunuyor',
  dove: 'faiz tarafında güvercin/gevşeme okunuyor',
  notr: 'faiz yönü net değil — şahin ve güvercin manşetler dengede',
};

/**
 * Yorumun YAN CÜMLELERİ. Hepsi ayrı anahtar: ekran hangisini
 * basacağını uctan gelen boolean'a göre seçiyor, cümle kurmuyor.
 */
export const MAKRO_YORUM_EK_SOZLUK: Record<string, string> = {
  inflIsinma: 'enflasyon tarafı da ısınıyor',
  inflSoguma: 'enflasyon tarafı da soğuyor',
  taze: 'yön son 2 günün manşetlerinden okundu',
  bayat: 'yön son 2 günün dışındaki manşetlerden okundu',
};

/**
 * `eksikYorum` kodları → NESİ ÖLÇÜLMEDİ cümlesi.
 */
export const MAKRO_YORUM_EKSIK_SOZLUK: Record<string, string> = {
  satirlar: 'ani-hareket satırları gönderilmedi — duruşla uyumlu sembol ARANMADI',
};

/**
 * ⚠️ Ani-hareket satırının makro etiketi (motor
 * `pulseMakroEtiketKod`) → Türkçe. SEKTÖR KARŞILAŞTIRMASI MOTORDA
 * yapıldı; burada yalnız kodun karşılığı var.
 */
export const MAKRO_ETIKET_SOZLUK: Record<string, string> = {
  faiz_baski: 'faiz/enflasyon baskısı',
  faiz_ruzgar: 'faiz/enflasyon rüzgârı',
};

/**
 * `/api/gundem` KONSEPT ANAHTARI → Türkçe başlık. Anahtarlar motorun
 * `AGENDA_LEXICON`ından (api/_motor.js:3329) BİREBİR kopyalandı; metinler
 * motordaki `label` alanlarının aynısı — emoji ALıNMADI (native'de
 * rozet metni emoji taşımıyor).
 *
 * `emg-` ANAHTARLARI BURADA YOK ve OLMAYACAK: onlar motorun ONCEDEN
 * TANIMLANMAMIŞ, manşetlerden ÇIKARDIĞI sözcükler (`emg-deprem`). Uç
 * onları `yeni: true` + `sozcuk` alanıyla ayrı işaretliyor; ekran
 * `sozcuk`u OLDUĞU GİBİ basar, sözlükten cümle aramaz.
 */
export const GUNDEM_KONSEPT_SOZLUK: Record<string, string> = {
  rates: 'Faiz / Merkez Bankaları',
  inflation: 'Enflasyon / Fiyat Baskısı',
  oil: 'Petrol / Enerji Arzı',
  gold: 'Altın / Güvenli Liman',
  geopolitics: 'Jeopolitik / Çatışma',
  trade: 'Ticaret / Tarifeler',
  'ai-boom': 'Yapay Zeka Yatırımı / Çip',
  'ai-risk': 'YZ Düzenleme / Güvenlik Riski',
  rotation: 'Değer Rotasyonu / Piyasa Tepesi',
  crypto: 'Kripto / Bitcoin',
  software: 'Yazılım / Siber Güvenlik / Bulut',
  biotech: 'İlaç / Biyoteknoloji / Sağlık',
  materials: 'Metal / Madencilik / Nadir Toprak',
  earnings: 'Bilanço / Kâr Sezonu',
  recession: 'Resesyon / Büyüme Endişesi',
  jobs: 'İstihdam / İşgücü',
  currency: 'Kur / Dolar / Lira',
  realestate: 'Konut / Gayrimenkul',
  'energy-transition': 'Temiz Enerji / EV',
  china: 'Çin Ekonomisi',
  bigtech: 'Büyük Teknoloji / Regülasyon',
  defense: 'Savunma / NATO',
  politics: 'Seçim / Siyaset / Bütçe',
};

/**
 * Konseptin `sectors` çiftlerindeki SEKTÖR KODU → Türkçe. Kodlar
 * motorun `SECTORS` sözlüğünden (app.js:10443) birebir; `SEK_META` ile
 * KARIŞTIRILMASIN — o Yahoo'nun sektör adları, bu gündem şeridinin
 * KISA kod kümesi.
 */
export const GUNDEM_SEKTOR_SOZLUK: Record<string, string> = {
  energy: 'Enerji/Petrol',
  defense: 'Savunma',
  tech: 'Teknoloji',
  semis: 'Çip/Yarı İletken',
  clean: 'Temiz Enerji',
  gold: 'Altın/Değerli Maden',
  banks: 'Banka/Finans',
  staples: 'Temel Tüketim',
  auto: 'Otomotiv',
  reit: 'Gayrimenkul',
  utilities: 'Elektrik/Altyapı',
  space: 'Uzay/Uydu',
  biotech: 'Biyotek/Sağlık',
  industrials: 'Sanayi',
  intl: 'Global/Gelişen Piyasa',
  software: 'Yazılım/Siber',
  crypto: 'Kripto/Blok Zinciri',
  materials: 'Metal/Madencilik',
};

/** Sektör çiftinin YÖNÜ (`'up'`/`'down'`) → ölçüm dili. */
export const GUNDEM_YON_SOZLUK: Record<string, string> = {
  up: 'ilgi yönünde',
  down: 'baskı yönünde',
};

/**
 * Konseptin `heat` bandı. EŞİK MOTORDA (başlık sayısı + tazelik
 * ağırlığı); burada yalnız bandın ADI.
 */
export const GUNDEM_ISI_SOZLUK: Record<string, string> = {
  hot: 'yoğun manşet akışı',
  warm: 'orta yoğunlukta manşet akışı',
  cool: 'seyrek manşet akışı',
};

/** Konseptin risk yönü (`AGENDA_LEXICON[].risk`). */
export const GUNDEM_RISK_SOZLUK: Record<string, string> = {
  on: 'risk alma eğilimiyle anılan konsept',
  off: 'riskten kaçınmayla anılan konsept',
};

/**
 * ÖZETiN `moodKod`u — motorun `agendaScore().summary.moodCls`i.
 * EŞİK MOTORDA (risk-on/risk-off ağırlık farkı); burada sayı YOK.
 */
export const GUNDEM_HAVA_SOZLUK: Record<string, string> = {
  bull: 'Manşetlerde risk alma eğilimi önde',
  bear: 'Manşetlerde riskten kaçınma önde',
  neutral: 'Manşetlerde iki yön dengede',
};

/**
 * Konseptin `toneKod`u — motorun `sentiLabel().cls`i (api/_motor.js:2726).
 * `GUNDEM_HAVA_SOZLUK` ile AYNI KOD KÜMESİ, AYRI CÜMLE: biri PiYASANIN
 * tamamını, bu TEK konseptin manşet tonunu anlatıyor.
 */
export const GUNDEM_TON_SOZLUK: Record<string, string> = {
  bull: 'pozitif manşet tonu',
  bear: 'negatif manşet tonu',
  neutral: 'nötr manşet tonu',
};

/**
 * `ozet.rotasyon.hisseKod` — NEDEN hisse listesi BOŞ geliyor.
 * Burada TEK kod var çünkü uç şu an tek sebep bildiriyor: sabit bir
 * hisse evreni ÖLÇÜLMEDİ. Kod geldiğinde ekran bunu YAZAR, boş liste
 * basmaz — "ölçtüm, eşleşme yok" demek yanıltıcı olurdu.
 */
export const GUNDEM_EVREN_SOZLUK: Record<string, string> = {
  evren_olculmedi: 'Hisse eşlemesi ölçülmedi (sabit evren bu uçta yok)',
};

/**
 * Kod → cümle. Kod `null`/`undefined`/sözlükte yok ise `null` döner:
 * çağıran "ölçülemedi" dalını çizer, cümle UYDURMAZ.
 */
export function sozluktenSec<K extends string>(
  sozluk: Record<K, string>,
  kod: string | null | undefined,
): string | null {
  if (typeof kod !== 'string' || !kod) return null;
  return Object.prototype.hasOwnProperty.call(sozluk, kod) ? sozluk[kod as K] : null;
}

/**
 * FA kriterinin `kod`u → Türkçe cümle.                      (#12, 2026-11-03)
 *
 * NİYE VAR: web'de her kriterin bir `note` cümlesi vardı (`app.js`
 * `bistFundamentalModel` / `secFetchModel`), ama `api/_akis.js` kriteri
 * `{key, weight, score}`e kırpıyordu — ne cümle ne de cümlenin dayandığı
 * ham sayı native'e ulaşıyordu. Artık uç cümle yerine MAKİNE KODU
 * (`c.kod`) ve HAM SAYILAR (`c.sayilar`) gönderiyor; cümle TEK YERDE,
 * burada kuruluyor.
 *
 * BU SÖZLÜKTE SAYI YOK: "çift haneli", "birin altında" gibi EŞİĞİ
 * açığa vuran ifadeler bilinçli olarak YAZILMADI. Eşik motorun
 * `faKriterKod()` dalında duruyor; onu burada tekrar yazmak, motor eşiği
 * değiştiğinde ekranın sessizce yanlış cümleyi basması olurdu. Cümleler
 * yalnız DALIN ADINI söylüyor ("güçlü kademede"), sayıyı değil — sayıyı
 * kullanıcı `sayilar`dan ham hâliyle görüyor.
 *
 * KOD SÖZLÜKTE YOKSA CÜMLE DE YOK (`sozluktenSec` → `null`): uç yeni bir
 * dal eklediğinde ekran uydurma cümle basmaz, sessizce hiçbir şey yazmaz.
 */
export const FA_KRITER_SOZLUK: Record<string, string> = {
  'netMargin.saglikli': 'Net kâr marjı güçlü kademede',
  'netMargin.ince': 'Net kâr marjı pozitif ama ince kademede',
  'netMargin.zarar': 'Net kâr marjı negatif — dönem zararı',
  'ocfMargin.olculdu': 'Faaliyet nakit akışı marjı ölçüldü',
  'ebitdaMargin.olculdu': 'FAVÖK marjı ölçüldü',
  'roe.olculdu': 'Özkaynak kârlılığı ölçüldü',
  // BIST ayağının TL ölçümü enflasyondan ARINDIRILMADI; motor bunu ayrı
  // bir kodla söylüyor çünkü aynı sayı ABD ayağında başka şey anlatıyor.
  'roe.nominal-try': 'Özkaynak kârlılığı nominal TL — enflasyon arındırılmadı',
  'roa.olculdu': 'Aktif kârlılığı ölçüldü',
  'revYoY.olculdu': 'Yıllık gelir değişimi ölçüldü',
  'revYoY.nominal-try': 'Gelir değişimi nominal TL — enflasyon arındırılmadı',
  'revCagr.olculdu': 'Üç yıllık bileşik gelir büyümesi ölçüldü',
  'revCagr.nominal-try': 'Üç yıllık büyüme nominal TL — enflasyon arındırılmadı',
  'netTrend.artti': 'Net kâr bir önceki döneme göre arttı',
  'netTrend.azaldi': 'Net kâr bir önceki döneme göre azaldı',
  // "ölçemedim" DEĞİL: borç kalemi sıfır olduğu için oran KURULAMIYOR.
  'cashLt.borc-yok': 'Uzun vadeli finansal borç yok — oran kurulamıyor',
  'cashLt.oran': 'Nakit / uzun vadeli borç oranı ölçüldü',
  'ndEbitda.net-nakit': 'Net borç yok — şirket net nakit pozisyonda',
  'ndEbitda.dusuk': 'Net borç / FAVÖK düşük kademede',
  'ndEbitda.orta': 'Net borç / FAVÖK orta kademede',
  'ndEbitda.yuksek': 'Net borç / FAVÖK yüksek kademede',
  'd2e.saglikli': 'Borç / özkaynak düşük kademede',
  'd2e.orta': 'Borç / özkaynak orta kademede',
  'd2e.yuksek': 'Borç / özkaynak yüksek kademede',
  'curRatio.olculdu': 'Cari oran ölçüldü',
  'quickRatio.olculdu': 'Asit-test oranı ölçüldü — stok hariç',
  'fcfPos.pozitif': 'Serbest nakit akışı pozitif',
  'fcfPos.negatif': 'Serbest nakit akışı negatif',
  'accruals.nakit-destekli': 'Faaliyet nakit akışı net kârın üzerinde',
  'accruals.donusmuyor': 'Faaliyet nakit akışı net kârın altında',
  'roaUp.iyilesiyor': 'Aktif kârlılığı bir önceki döneme göre yükseldi',
  'roaUp.geriliyor': 'Aktif kârlılığı bir önceki döneme göre geriledi',
  'gmUp.gucleniyor': 'Brüt marj bir önceki döneme göre yükseldi',
  'gmUp.zayifliyor': 'Brüt marj bir önceki döneme göre geriledi',
  'crUp.gucleniyor': 'Cari oran bir önceki döneme göre yükseldi',
  'crUp.zayifliyor': 'Cari oran bir önceki döneme göre geriledi',
  'pe.olculdu': 'Fiyat / kazanç oranı ölçüldü',
  'pe.negatif': 'F/K negatif — zarar eden şirkette oran yorumlanamaz',
};


// ---------------------------------------------------------------------
//  ICERIDEN ISLEMLER (SEC Form 4 / KAP) — TEMEL SKORA DAHIL DEGIL
// ---------------------------------------------------------------------
//  Uc dort ayri kapali kod kumesi donduruyor (`api/_iceriden.js`);
//  Turkcesi BURADA. Ucta tek Turkce cumle YOK.
//
//  WEBDEN AYRILAN TON: web "guclu alim sinyali" diyor (app.js:5293
//  civari, VAAT dili). Burada yalniz OLCUMUN ADI geciyor: kimin ne
//  yaptigi yazili, ne yapilacagi DEGIL.

/** Turun hangi dürüst hâlle bittigi. `ok` disindakiler HATA DEGIL. */
export const ICERIDEN_DURUM_SOZLUK: Record<IceridenDurumKodu, string> = {
  ok: 'Pencerede içeriden işlem bildirimi bulundu',
  // `cik`/sembol eslesmesi kurulamadi: ust kaynakta BOYLE BIR KAYIT YOK.
  kayit_yok: 'Bu sembol için içeriden işlem kaydı bulunamadı',
  // Kayit var, pencerede bildirim yok. Tur KOSTU, sonuc BOS.
  bildirim_yok: 'Pencerede yeni bir bildirim yok',
  // Bildirim var ama hepsi hibe/opsiyon gibi acik piyasa disi islem.
  acik_piyasa_yok: 'Bildirimler açık piyasa alım-satımı içermiyor',
};

/** Pencerenin net yonu — ESIK MOTORDA (`yonKoduAl`), burada sayı YOK. */
export const ICERIDEN_YON_SOZLUK: Record<IceridenYonKodu, string> = {
  alim: 'Pencerede yalnız alım var',
  satim: 'Pencerede yalnız satım var',
  alim_agirlikli: 'Pencerede alım ağırlıklı',
  satim_agirlikli: 'Pencerede satım ağırlıklı',
  dengeli: 'Alım ve satım birbirine yakın',
};

/** Rozete sigan kisa bicim — ayni kapali kume. */
export const ICERIDEN_YON_ROZET: Record<IceridenYonKodu, string> = {
  alim: 'yalnız alım',
  satim: 'yalnız satım',
  alim_agirlikli: 'alım ağırlıklı',
  satim_agirlikli: 'satım ağırlıklı',
  dengeli: 'dengeli',
};

/** Bildirimi verenin sirketle iliskisi (Form 4 kutulari). */
export const ICERIDEN_ILISKI_SOZLUK: Record<IceridenIliskiKodu, string> = {
  yk: 'yönetim kurulu üyesi',
  yonetici: 'üst düzey yönetici',
  ortak10: '%10+ pay sahibi',
};

/** BIST ayaginda satirlarin HANGI beslemeden geldigi. */
export const ICERIDEN_KAYNAK_SOZLUK: Record<IceridenKaynakKodu, string> = {
  kap: 'KAP bildirim beslemesi',
  // KAP beslemesi sembolu dusurmus; satirlar haber yedeginden.
  haber: 'haber yedeği (KAP beslemesinde bu sembol yok)',
  kap_haber: 'KAP beslemesi + haber yedeği',
};

// ---------------------------------------------------------------------
//  "Neden hareket ediyor?" — /api/neden kod kümeleri
// ---------------------------------------------------------------------
//  Eşikler (3.0 / 1.2 / 0.12) MOTORDA; burada sayı YOK. Cümleler ÖLÇÜM
//  dili: ne olduğunu bildirir, ne yapılacağını DEĞİL.

/** Günlük hareketin büyüklüğü. */
export const NEDEN_HAREKET_SOZLUK: Record<NedenHareketKodu, string> = {
  // Fiyat ya da önceki kapanış gelmedi: ÖLÇEMEDİM. 'sakin' demek yalan olurdu.
  olcum_yok: 'Günlük değişim ölçülemedi',
  sakin: 'Günlük hareket sakin',
  belirgin: 'Günlük hareket belirgin',
  sert: 'Günlük hareket sert',
};

/** Hareketin yönü — rozete sığan kısa biçim. */
export const NEDEN_YON_SOZLUK: Record<NedenYonKodu, string> = {
  olcum_yok: 'yön ölçülemedi',
  yatay: 'yatay',
  yukselis: 'yükseliş',
  dusus: 'düşüş',
};

/** Haber akışının yönü. */
export const NEDEN_HABER_YON_SOZLUK: Record<NedenHaberYonKodu, string> = {
  // Hiç eşleyen sözcük görülmedi — 'notr' ile AYRI olgu.
  sinyal_yok: 'Manşetlerde yönlü bir sinyal yok',
  notr: 'Haber akışı dengeli',
  pozitif: 'Haber akışı pozitif tarafta',
  negatif: 'Haber akışı negatif tarafta',
};

/**
 * Kartın asıl cümlesi: hareket ile haber akışının uzlaşması.
 * Hiçbiri NEDEN belirtmiyor — "şu yüzden yükseldi" bir NEDENSELLİK
 * iddiası olurdu ve ölçülmedi; cümleler yalnız İKİ ÖLÇÜMÜN ilişkisini
 * bildiriyor.
 */
export const NEDEN_UZLASMA_SOZLUK: Record<NedenUzlasmaKodu, string> = {
  olcum_yok: 'Günlük değişim ölçülemedi, karşılaştırma yapılamadı',
  sakin: 'Hareket, haber akışıyla ilişkilendirilecek kadar büyük değil',
  haber_uyumlu: 'Hareketin yönü haber akışının yönüyle aynı tarafta',
  celiski: 'Hareketin yönü haber akışının yönüyle ters tarafta',
  haber_yok: 'Hareket var, manşetlerde buna eşlik eden yönlü sinyal yok',
};

/** Tek manşetin kutbu. */
export const NEDEN_KUTUP_SOZLUK: Record<NedenKutupKodu, string> = {
  notr: 'nötr',
  pozitif: 'pozitif',
  negatif: 'negatif',
};
/**
 * `katTemettuKod()` (motor, Ş8 (G)) → yaklaşan temettü cümlesi.
 *
 * ÜÇ KOD VAR, WEB'DE İKİSİ SUSUYORDU: web `fillCatalysts` yalnız eşik
 * içindeki maddeyi basıyor, `uzak` ve `gecti` hallerinde HİÇBİR ŞEY
 * yazmıyordu. O susma bir bilgi kaybıydı — "temettü var ama uzak" ile
 * "temettü yok" ekranda aynı görünüyordu. Üç kodun üçü de cümleli.
 *
 * 45 GÜN EŞİĞİ BU DOSYADA YOK: eşik motorda (`KAT_TEMETTU_GUN`).
 * Burada yalnız kodun ADI geçiyor, sayı GEÇMİYOR.
 *
 * GÜN SAYISI CÜMLEYE GÖMÜLMÜYOR: kaç gün kaldığı ayrı bir ÖLÇÜM
 * (`temettu.gun`) ve kart onu kendi satırında basıyor; cümleye
 * gömmek ölçümü metnin içine saklamak olurdu.
 */
export const KATALIZOR_TEMETTU_SOZLUK: Record<KatalizorTemettuKodu, string> = {
  yakin: 'Temettü tarihi yaklaşıyor — tarih civarında fiyatta düzeltme ölçülebilir',
  uzak: 'Temettü tarihi ölçüldü, henüz uzak',
  gecti: 'Ölçülen temettü tarihi geçmiş',
};

/**
 * Ölçülen tarihin HANGİ tarih olduğu. ÖLÇÜLMÜŞ ASİMETRİ: BIST kaynağı
 * ÖDEME gününü, Yahoo künyesi ağırlıklı olarak KESİLME (ex) gününü
 * yayınlıyor. İkisi aynı alana yazıldığı için hangisinin ölçüldüğü
 * ekranda SÖYLENİYOR — "temettü tarihi" diye birleştirmek iki farklı
 * günü aynı gün gibi göstermek olurdu.
 */
export const KATALIZOR_TARIH_TURU_SOZLUK: Record<KatalizorTarihTuru, string> = {
  odeme: 'ödeme günü',
  kesilme: 'hak kesilme (ex) günü',
};

/**
 * KATALİZÖR SATIRININ SABİT UYARISI — web `fillCatalysts`in son
 * maddesi. Bir ÖLÇÜM değil, DEĞİŞMEZ bir cümle: bu yüzden uçtan
 * taşınmıyor (uç yalnız `uyari` alanını Türkçe döndürebilir) ve
 * burada sabit olarak duruyor.
 */
export const KATALIZOR_HABER_UYARISI =
  'Manşetler ölçüm değildir — başlık sayısı ve yönü sayılır, içeriği doğrulanmaz.';


/**
 * VADE SIRASI — motorun `api/_ayar.js` VADELER dizisiyle AYNI sıra.
 * Burada SAYI yok: hangi vadede hangi pencere/ağırlık kullanıldığı
 * motorun işi. Dizi yalnız seçicinin düğme sırasını belirliyor.
 */
export const VADE_SIRASI: readonly Vade[] = ['gunici', 'kisa', 'orta', 'uzun'];

/**
 * `vade` kodu → düğme etiketi. `Record<Vade, …>`: motor yeni bir vade
 * eklerse `tsc` kırılır, etiket sessizce eksik kalmaz.
 */
export const VADE_SOZLUK: Record<Vade, string> = {
  gunici: 'Gün içi',
  kisa: 'Kısa',
  orta: 'Orta-uzun',
  uzun: 'Uzun',
};

/**
 * Seçimin NE DEĞİŞTİRDİĞİ. Eşik/ağırlık SÖYLENMİYOR (motorda), yalnız
 * hangi pencerenin sorulduğu ve gün içi vadenin ÖLÇÜLMÜŞ istisnası:
 * motor o vadede teknik ayağı koşturmuyor, teknik skor `null` dönüyor
 * (`api/types.ts` → `Vade`). Bunu yazmamak boş kartı arıza gibi
 * gösterirdi.
 */
export const VADE_NOTU: Record<Vade, string> = {
  gunici:
    'Gün içi vadede motor teknik ayağı koşturmuyor — teknik skor ve plan ölçülmeden geliyor.',
  kisa: 'Kısa vade: motor ağırlıklarını bu pencereye göre seçiyor.',
  orta: 'Orta-uzun vade — motorun varsayılan penceresi.',
  uzun: 'Uzun vade: motor ağırlıklarını bu pencereye göre seçiyor.',
};

/**
 * `SepetKalemi.cls` → varlık sınıfı adı. Kapalı küme `depo.ts`
 * `SINIFLAR` dizisiyle AYNI; `Record<VarlikSinifi, …>` olduğu için
 * yeni bir sınıf eklenirse `tsc` kırılır.
 *
 * NEDEN BURADA: bu eşleme `SepetKart.tsx` içinde YEREL bir sabitti.
 * Sepete yazma kartları (ekle · nakit · hamle günlüğü) aynı adları
 * kullanıyor; ikinci bir kopya çıkarmak aynı Türkçeyi iki yerde tutmak
 * olurdu (TÜRKÇE TEK YERDE).
 */
export const VARLIK_SINIFI_SOZLUK: Record<VarlikSinifi, string> = {
  bist: 'BIST hissesi',
  us: 'ABD hissesi',
  crypto: 'Kripto',
  metal: 'Metal',
  fx: 'Döviz',
  fund: 'Fon',
  cash: 'Nakit',
};

/**
 * Sepete yazma kartlarında kullanıcının seçebildiği sınıflar.
 *
 * `cash` BU DİZİDE YOK: nakdin adedi BAKİYE, maliyeti her zaman 1 ve
 * web'de de ayrı kod yolundan geçiyor (`adjustCash`, app.js:3380-3404).
 * `depo.ts` `sepeteEkle` de `cls==='cash'` girdisini REDDEDİYOR —
 * burada göstermek kullanıcıyı kesin bir reddin üstüne sürmek olurdu.
 */
export const SEPET_SINIF_SIRASI: readonly VarlikSinifi[] = [
  'bist',
  'us',
  'crypto',
  'metal',
  'fx',
  'fund',
];

/**
 * Şeride İĞNELENEBİLEN sınıflar — `GostergeKart` düğme sırası.
 *
 * ÖLÇÜLDÜ, web'den DARALTILDI ve nedeni yazılı: web beş sınıf
 * iğneliyor (`tkSetClass`, app.js:2646-2663) ama üçü KATALOGDAN
 * seçiliyor — `BM_FX`, `BM_METALS`, `BM_CRYPTO` açılır listeleri.
 * Native'de döviz ve metal katalogu YOK (ölçüldü 2026-11-06: `BM_FX`
 * ve `BM_METALS` için `mobile/src` içinde eşleşme sıfır); kripto
 * evreni VAR ama YAHOO sembolü tutuyor
 * (`components/analiz/KriptoKart.tsx` → `KRIPTO_SEMBOLLER`, 'BTC-USD'),
 * şerit ise CoinGecko kimliği bekliyor — `cgId` olmadan kayıt
 * fiyatlanamıyor (`api/serit.ts` → `SEBEP_CGID`). Elle yazılan
 * sembolün ölçülebildiği tek yol BIST/ABD: `serit.ts` onları
 * `/api/degisim` ucuna götürüyor.
 * `fund` burada YOK — şeritte fonun fiyat ucu yok (`SEBEP_FON`);
 * `cash` da yok (şerit kaydı bakiye taşımıyor, fiyatı tanım gereği 1).
 * Ölçülemeyecek bir kaydı iğnelemeye bırakmak, kullanıcıyı baştan
 * belli bir '—' üstüne sürmek olurdu.
 */
export const GOSTERGE_SINIF_SIRASI: readonly VarlikSinifi[] = ['bist', 'us'];

/**
 * `Hamle.type` → Türkçe. Tür `string` (açık küme) çünkü günlük webde de
 * aynı alanı serbest tutuyor; sözlükte olmayan kod için cümle YOK —
 * çağıran ham kodu basıyor, uydurma cümle basılmıyor.
 *
 * ÖLÇÜLDÜ: web dört değer yazıyor — `add`/`remove` (sepet ve nakit,
 * app.js:3331/3357/3397) ve `buy`/`sell` (gizli portföy,
 * app.js:3166/3202/3221). Native YALNIZ `add`/`remove` yazıyor; öteki
 * ikisi sözlükte duruyor çünkü günlük aynı türü paylaşıyor.
 */
export const HAMLE_TURU_SOZLUK: Readonly<Record<string, string>> = {
  add: 'eklendi',
  remove: 'çıkarıldı',
  buy: 'alış kaydı',
  sell: 'satış kaydı',
};


// ---------------------------------------------------------------------
//  MALI TABLOLAR (/api/mali) — TEMEL SKORA DAHIL DEGIL
// ---------------------------------------------------------------------
//  Uc iki kapali kod kumesi donduruyor (`api/_mali.js`): kalem kodu ve
//  durum kodu. Turkcesi BURADA, ucta tek Turkce cumle YOK.
//
//  BU TABLOLARDA HESAP YOK: kalemin "iyi" mi "kotu" mu oldugu
//  YAZILMIYOR, yalnız ADI yaziliyor. Marj/oran/buyume gibi TURETME
//  motorda; bu kart yalniz olculen sayiyi gosteriyor.

/** Turun hangi dürüst hâlle bittigi. `ok` disindakiler HATA DEGIL:
 *  ariza hali AYRI (502 `mali_alinamadi`). */
export const MALI_DURUM_SOZLUK: Record<MaliDurumKodu, string> = {
  ok: 'Yıllık mali tablo kalemleri bulundu',
  // Sembol->CIK eslesmesi kurulamadi: ust kaynakta BOYLE BIR KAYIT YOK
  // (ETF ya da yabanci ozel sirket olabilir).
  kayit_yok: 'Bu sembol için mali tablo kaydı bulunamadı',
  // Kaynak cevap verdi ama yillik donem cikmadi (yeni halka arz, farkli
  // finansal grup). Tur KOSTU, sonuc BOS.
  tablo_yok: 'Kaynakta yıllık mali tablo dönemi bulunamadı',
  // Donem bulundu ama hicbir kalem okunamadi.
  kalem_yok: 'Dönem bulundu ama taşınacak kalem ölçülemedi',
};

/** Kalem kodu -> kalemin ADI. Isimler ust kaynaklarin kendi
 *  basliklariyla uyumlu tutuldu; yorum/hüküm TASIMIYORLAR. */
export const MALI_KALEM_SOZLUK: Record<MaliKalemKodu, string> = {
  gelir: 'Satış gelirleri',
  brutKar: 'Brüt kâr',
  faaliyetKari: 'Faaliyet kârı',
  netKar: 'Net dönem kârı',
  amortisman: 'Amortisman ve tükenme',
  faaliyetNakitAkisi: 'Faaliyetlerden nakit akışı',
  yatirimHarcamasi: 'Maddi duran varlık yatırımı',
  serbestNakitAkisi: 'Serbest nakit akışı',
  donenVarliklar: 'Dönen varlıklar',
  duranVarliklar: 'Duran varlıklar',
  toplamVarliklar: 'Toplam varlıklar',
  nakitVeBenzeri: 'Nakit ve nakit benzerleri',
  kisaVadeliYatirimlar: 'Kısa vadeli yatırımlar',
  stoklar: 'Stoklar',
  kisaVadeliYukumlulukler: 'Kısa vadeli yükümlülükler',
  toplamYukumlulukler: 'Toplam yükümlülükler',
  kisaVadeliFinansalBorc: 'Kısa vadeli finansal borç',
  uzunVadeliFinansalBorc: 'Uzun vadeli finansal borç',
  ozkaynak: 'Özkaynaklar',
};

/** Kalemin HANGI tabloda durdugu — yalnız GRUPLAMA etiketi, hüküm
 *  degil. Kart kalemleri bu uc oberge altinda siralıyor. */
export const MALI_GRUP_SOZLUK: Record<MaliKalemKodu, string> = {
  gelir: 'Gelir tablosu',
  brutKar: 'Gelir tablosu',
  faaliyetKari: 'Gelir tablosu',
  netKar: 'Gelir tablosu',
  amortisman: 'Nakit akışı',
  faaliyetNakitAkisi: 'Nakit akışı',
  yatirimHarcamasi: 'Nakit akışı',
  serbestNakitAkisi: 'Nakit akışı',
  donenVarliklar: 'Bilanço',
  duranVarliklar: 'Bilanço',
  toplamVarliklar: 'Bilanço',
  nakitVeBenzeri: 'Bilanço',
  kisaVadeliYatirimlar: 'Bilanço',
  stoklar: 'Bilanço',
  kisaVadeliYukumlulukler: 'Bilanço',
  toplamYukumlulukler: 'Bilanço',
  kisaVadeliFinansalBorc: 'Bilanço',
  uzunVadeliFinansalBorc: 'Bilanço',
  ozkaynak: 'Bilanço',
};

// =====================================================================
//  ANI HAREKET  (/api/hareket — api/_hareket.js)
// ---------------------------------------------------------------------
//  Uç yalnız KAPALI KÜMEDEN kod yolluyor; cümle burada seçiliyor.
//  Cümlelerde SAYI YOK: eşiği uç tutuyor, burada yeniden yazılsa iki
//  ayrı eşik kaynağı doğar ve biri değişince öteki sessizce yanlış
//  olur.
//  Cümleler ÖLÇÜM dili: ne olduğunu söylüyor, ne yapılacağını
//  söylemiyor.
// =====================================================================

/** `HareketSatir.kodlar` → tam cümle. */
export const ANI_HAREKET_SOZLUK: Record<HareketKodu, string> = {
  ani: 'Gün içi fiyat, kendi son mumlarına göre ANİ biçimde ayrıştı.',
  buyuk_gun:
    'Günlük değişim, bu sembolün olağan gün içi salınımının dışına çıktı.',
  kirilma: 'Fiyat, ölçüm penceresindeki önceki tepeyi aştı.',
};

/** Aynı kodun ROZET boyu karşılığı — satır başlığında yer dar. */
export const ANI_HAREKET_ROZET: Record<HareketKodu, string> = {
  ani: 'ani hareket',
  buyuk_gun: 'büyük gün',
  kirilma: 'kırılma',
};

/**
 * Ucun MAKİNE hata kodu → cümle. İstemci kapıları (`fetchHareket`)
 * kendi cümlesini zaten taşıyor; bu sözlük, sunucudan DÖNEN kodu
 * ekranda adıyla anmak için var — `error.code` ham kalırken kullanıcı
 * bir cümle görsün diye.
 */
export const HAREKET_ARIZA_SOZLUK: Record<HareketErrorCode, string> = {
  semboller_yok: 'Ölçüm için sembol gönderilmedi.',
  bad_sembol: 'Gönderilen sembollerden biri uçta çözülemedi.',
  cok_sembol: 'Tek istekte alınabilecek sembol sayısı aşıldı.',
  method_not_allowed: 'Uç bu istek biçimini kabul etmiyor.',
  motor_yok: 'Ölçüm motoru yüklenemedi — ölçüm yapılamadı.',
  hareket_alinamadi: 'Motora ulaşıldı ama gün içi mumlar okunamadı.',
};

// =====================================================================
//  BİLDİRİM YÜZÜ  (/api/bildirim + cihaz izni — şerit B)
// ---------------------------------------------------------------------
//  Cümlelerde SAYI YOK: kaç cihazın kayıtlı olduğunu UÇ sayıyor
//  (`sayi`), ekran o sayıyı ayrı basıyor. Cümleye sayı yazmak ikinci
//  bir kaynak doğurur ve biri değişince öteki sessizce yanlış kalır.
//
//  Cümleler ÖLÇÜM dili: ne olduğunu söylüyor, ne yapılacağını
//  söylemiyor; vaat kurmuyor.
//
//  ÜÇ HÂL AYRI: izin HİÇ sorulmadı · verildi · reddedildi. "Sorulmadı"
//  ile "reddedildi" aynı cümleye konmuyor — ölçülmemişi olumsuz ölçüm
//  gibi anlatmak olurdu.
// =====================================================================

/** `PushDurum.izin` → tam cümle. */
export const PUSH_IZIN_SOZLUK: Record<PushIzin, string> = {
  bilinmiyor: 'Bildirim izni bu cihazda henüz sorulmadı.',
  verildi: 'Bu cihaz bildirim göstermeye izinli.',
  reddedildi: 'Bu cihazda bildirim izni kapalı — telefon ayarlarından açılabilir.',
};

/** Aynı hâlin ROZET boyu karşılığı — kart başlığında yer dar. */
export const PUSH_IZIN_ROZET: Record<PushIzin, string> = {
  bilinmiyor: 'sorulmadı',
  verildi: 'izinli',
  reddedildi: 'kapalı',
};

/**
 * `pushKur` başarısız dalının `sebep`i → cümle. Her durak AYRI cümle
 * taşıyor; "bir şeyler ters gitti" demek, hangi adımın ölçülemediğini
 * gizlemek olurdu.
 */
export const PUSH_KUR_SOZLUK: Record<PushKurSebep, string> = {
  kapali:
    'Senkron kodu girilmedi — kod olmadan bu cihaz bildirim için kaydedilemiyor.',
  reddedildi: 'Bildirim izni verilmedi, bu cihaz kaydedilmedi.',
  sorulamadi: 'Bildirim izni okunamadı — izin durumu ölçülemedi.',
  cihaz_degil:
    'Bildirim adresi yalnız gerçek telefonda alınabiliyor; benzeticide ölçüm yapılamıyor.',
  platform_disi: 'Bu platformda bildirim kaydı yapılamıyor.',
  proje_yok: 'Uygulama kimliği okunamadı — bildirim adresi istenemedi.',
  jeton_alinamadi: 'Bu cihazın bildirim adresi alınamadı.',
  uc_hatasi: 'Kayıt sunucusuna ulaşıldı ama işlem tamamlanamadı.',
};

/**
 * Ucun MAKİNE hata kodu → cümle. İstemci kapıları (`pushJetonKaydet`)
 * kendi cümlesini zaten taşıyor; bu sözlük SUNUCUDAN DÖNEN kodu ekranda
 * bir cümleyle anmak için var.
 */
export const BILDIRIM_ARIZA_SOZLUK: Record<BildirimErrorCode, string> = {
  kod_yok: 'Senkron kodu gönderilmedi.',
  jeton_yok: 'Bildirim adresi gönderilmedi.',
  bad_jeton: 'Gönderilen bildirim adresi uçta geçerli bulunmadı.',
  method_not_allowed: 'Uç bu istek biçimini kabul etmiyor.',
  rate_limited: 'Uç bu kod için çok sık istek aldı, kayıt şimdilik alınmadı.',
  kv_yok: 'Kayıt deposuna ulaşılamadı — kayıt yapılamadı.',
};
