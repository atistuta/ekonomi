// ===========================================================================
//  /api/pulse — PİYASA NABZI / KONJONKTÜR uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NEDEN BU AD: ELITE_ROADMAP.md:314 bu ucu ADIYLA ÇAĞIRIYOR — "compare +
//  pulse (⚡ Nabız)". Ad uydurulmadı, plandan alındı. Ekranda da iki kutu
//  aynı matematiği paylaşıyor: "⚡ Nabız"ın makro duruşu ve "Makro"
//  sekmesinin konjonktür kartı. Tek uç ikisini birlikte döndürüyor çünkü
//  ikisinin ÇEKİRDEĞİ aynı: faiz yönü + enflasyon yönü.
//
//  ---------------------------------------------------------------------
//  HABERİ KİM TARAR — ÖLÇÜLDÜ, SONRA SEÇİLDİ (2026-10-19)
//
//  (a) Uç haberi KENDİ tarasın (Google News RSS). ÖLÇÜM: `api/_ag.js`in
//      `IZINLI` konak listesinde TAM BEŞ giriş var (query1/query2
//      finance.yahoo.com · www.sec.gov · data.sec.gov ·
//      www.isyatirim.com.tr) ve HİÇBİRİ haber/RSS konağı değil. Listenin
//      kendi yorumu "başka yere uzanan dilim SESSİZCE değil GÜRÜLTÜYLE
//      düşsün" diyor. Yani bu seçenek, ağ taşıyıcısının güvenlik
//      sözleşmesini bu uç için genişletmek demekti.
//  (b) Girdiyi İSTEMCİ versin, uç yalnız AKIL YÜRÜTSÜN → SEÇİLDİ.
//      /api/causal'da aynı karar aynı gerekçeyle verildi; iki uçta iki
//      farklı kalıp olması, ikisini de bakımsız bırakırdı. İstemci
//      manşetleri ZATEN topluyor (RSS'i tarayıcı vekiliyle okuyor);
//      aynı listeyi sunucuya bir daha okutmak ikinci bir dış bağımlılık
//      ve ikinci bir hız sınırı demekti.
//
//  SONUÇ: bu uç SIFIR dış istek yapıyor. Ağ taşıyıcısına yeni konak
//  EKLENMEDİ; `_ag.js`e DOKUNULMADI.
//
//  ---------------------------------------------------------------------
//  2026-10-24'TE KARAR DEĞİŞTİ — ESKİSİ YUKARIDA DURUYOR, SİLİNMEDİ
//
//  NİYE DEĞİŞTİ: yukarıdaki (b) kararı "İSTEMCİ manşetleri ZATEN
//  topluyor" ölçümüne dayanıyordu. O ölçüm WEB İÇİN doğruydu ve NATIVE
//  İÇİN YANLIŞ çıktı. Native istemci (mobile/) RSS TARAYAMIYOR:
//  webdeki yol `fetchVia` (tarayıcı vekili) + `parseRSS` (`DOMParser`)
//  üzerinden gidiyor, ikisi de native tarafta YOK. Yani (b) kararı
//  native istemciye ⚡ Nabız'ı KAPATIYORDU — "native ince istemci,
//  hesap/veri sunucuda" kuralının tam tersi.
//
//  (a)'nın ESKİ GEREKÇESİ HÂLÂ GEÇERLİ ve ÇÖZÜLDÜ: haber `_ag.js`in beş
//  konaklı `IZINLI` listesine GİRMEDİ. `_ag.js` AÇILMADI,
//  DEĞİŞTİRİLMEDİ. Haberin KENDİ taşıyıcısı var: `api/_haber.js` —
//  kendi konak izin listesi (yalnız `news.google.com`), kendi zaman
//  aşımı (6000 ms), kendi sayaçları. Skor şeridinin konak sözleşmesi
//  BİR MİLİMETRE genişlemedi.
//
//  GERİYE DÖNÜK UYUM ŞART — MEVCUT WEB BUNA BAĞLI: istemci manşet
//  gönderirse DAVRANIŞ DEĞİŞMEZ; uç ağa ÇIKMAZ, tek bir sayı farklı
//  dönmez. Sunucu yolu YALNIZ manşet gelmediğinde ve `q`/`semboller`
//  verildiğinde açılır. Hangi yolun kullanıldığı cevapta AÇIKÇA
//  yazıyor: `kaynak: 'istemci' | 'sunucu'`. Tahmin edilmesi gereken bir
//  şey bırakılmadı.
//
//  SORGULAR UYDURULMADI: sunucu yolu app.js:11629-11630'daki pmFed /
//  pmInfl sorgularını BİREBİR kullanıyor (aşağıda MAKRO_SORGULAR).
//  Yeni bir sorgu yazmak, sunucunun okuduğu manşet kümesini ekranın
//  okuduğundan AYRIŞTIRMAK olurdu — aynı duruş iki yerde iki değer
//  verirdi.
//
//  SKOR DEĞİŞMEDİ: haber katmanı hiçbir skora GİRDİ VERMİYOR. Bu uç
//  skor zincirinin (/api/score ⊂ recommend ⊂ analyze ⊂ compare) İÇİNDE
//  değil, YANINDA — ve değişiklik yalnız GİRDİNİN NEREDEN GELDİĞİNİ
//  etkiliyor, girdiyle NE YAPILDIĞINI değil. Yön matematiği hâlâ
//  motorda, tek eşik buraya kopyalanmadı.
//
//  ---------------------------------------------------------------------
//  MANTIK YENİDEN YAZILMADI — MOTORA DİLİMLENDİ
//
//  Yön matematiği app.js'te, ama AĞA ÇIKAN iki fonksiyonun (computeMacro ·
//  computePulseMacro) İÇİNDE gömülüydü. Bu uç eşikleri ikinci kez
//  yazsaydı iki kopya doğar, bir gün ayrışırlardı. Bu yüzden saf
//  parçalar app.js'te YERİNDE AYRI FONKSİYONLARA çıkarıldı (orijinal
//  fonksiyonlar artık onları çağırıyor — değerler DEĞİŞMEDİ) ve
//  `tests/engine.mjs`e iki dilim olarak eklendi: 'makro-faz' +
//  'nabiz-yon'. Motor yeniden üretildi; İKİ PARİTE ŞERİDİ DE FARK 0
//  verdi, yani skorun değeri kılını kıpırdatmadı.
//
//  Bu uçtan çağrılan motor adları: rateDirection · inflDirection ·
//  pulseFreshWithin · pulseFreshWeight · pulseStance · pulseRecentCount ·
//  macroGrowth · macroPhase · CYCLE_PHASES. Burada tek eşik, ağırlık ya
//  da çarpan YOK — hepsi motorda.
//
//  ---------------------------------------------------------------------
//  İKİ FARKLI "ENFLASYON" VAR — KARIŞTIRILMADI (ölçülmüş ayrım)
//
//    · ⚡ Nabız duruşu: `inflDirection(manşetler, tazelikAğırlığı)` →
//      -1..+1 YÖN. Manşet metninden okunur.
//    · Konjonktür kartı: `dims.infl` → 0..1 BASKI. app.js'te manşetten
//      DEĞİL, petrol+altın gündeminin başlık SAYISINDAN üretiliyor
//      (computeMacro: `Math.min(1, inflN / 10)` + ton düzeltmesi).
//
//  İkisi aynı sayı DEĞİL ve uç birini öbürünün yerine KOYMUYOR. Konjonktür
//  bloğu bu yüzden `enflasyonBaskisi`/`risk`/`genislik` sayılarını
//  İSTEMCİDEN istiyor: onları manşetten üretmek, app.js'in yapmadığı bir
//  hesabı yapmak ve ekranla ayrışmak olurdu.
//
//  Aynı sebeple faiz yönü İKİ KEZ hesaplanıyor: duruş için AĞIRLIKLI
//  (tazelik ağırlığıyla, computePulseMacro'nun yaptığı gibi), konjonktür
//  için AĞIRLIKSIZ (computeMacro `rateDirection(td.fed.items)` diye
//  ağırlık VERMEDEN çağırıyor). Tek bir sayıya indirmek "sadeleştirme"
//  değil, ekrandan SAPMA olurdu.
//
//  ---------------------------------------------------------------------
//  EKSİK VERİ UYDURULMAZ: `genislik` (piyasa genişliği) gelmezse
//  konjonktür bloğu `null` döner ve `eksik` dizisi nesi eksik olduğunu
//  SÖYLER. Varsayılan 50 koymak, ölçülmemiş bir genişlikten faz üretmek
//  olurdu — "veri yok" ile "ölçtüm" karışırdı.
//
//  ---------------------------------------------------------------------
//  NİYE BU ÜÇ ALAN HÂLÂ İSTEMCİDEN GELİYOR — ÖLÇÜLDÜ (2026-10-27)
//
//  Soru: `genislik` / `enflasyonBaskisi` / `risk` UÇTA hesaplanabilir mi?
//  Üç formülün de app.js'te NEREDE olduğu bulundu (satır numaraları o
//  günün dosyasına göredir; kilit `tests/nabiz-alan-test.mjs` ②'de
//  DESENLE tutuluyor, satırla değil):
//    · enflasyon baskısı   app.js ~10642-10645  (`inflN / 10`, petrol
//      tonu 0.15 üstündeyse +0.15)
//    · jeopolitik risk      app.js ~10646       (`(war + hormuz) / 10`)
//    · piyasa genişliği     app.js ~10648-10651 (evrenin ORTALAMA TA
//      skoru; `taAllSymbols()` + sembol başına bir TA çağrısı)
//    · yardımcı `themeHeat` app.js ~10327-10335 (3 günlük pencere)
//
//  ÖLÇÜM: bu dördünün HİÇBİRİ `api/_motor.js` içinde YOK (`inflN`,
//  war/hormuz sayımı, `taVals`, `themeHeat` dizgeleri üretilmiş motorda
//  aranıp bulunamadı). `makro-faz` dilimi `CYCLE_PHASES`te başlıyor ve
//  "Makro nabzını hesapla" yorumunda BİTİYOR — yani `computeMacro`
//  gövdesi, dolayısıyla üç formül de dilimin DIŞINDA kalıyor.
//
//  SONUÇ: hesabı buraya YAZMAK yasak ("motorda hesap, uçta taşıma") ve
//  motorda da yok. O yüzden bu uç değişmedi; üçü GİRDİ olarak kalıyor,
//  gelmezlerse `konjonktur` null + `eksik` konuşuyor. Uydurma formül
//  yazmak yerine BULGU bırakıldı — motor şeridine devredilecek:
//    · `themeHeat` (app.js 10327-10335) SAF (yalnız Date.now()) → olduğu
//      gibi dilimlenebilir.
//    · enflasyon baskısı + risk aritmetiği ÖNCE app.js içinde kendi saf
//      yardımcısına çıkarılmalı: `computeMacro` ağa çıkıyor
//      (`fetchThemesData`) ve modül durumu yazıyor; `macroGrowth` /
//      `macroPhase` için aynı iş zaten 2026-10-19'da böyle yapılmış.
//    · piyasa genişliği SUNUCUDA HESAPLANAMAZ: evren `taAllSymbols()` →
//      `loadLists()` → localStorage, yani KULLANICIYA ÖZEL liste; üstüne
//      sembol başına bir TA çağrısı gerekir ve bu maxDuration 10'u aşar.
//      Bu alan ya istemciden gelmeli ya da ayrı bir sözleşmeyle
//      (kullanıcı listesi + bütçe ölçümü) ele alınmalı.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): gövdede Intl/toFixed/
//  yüzde/para simgesi ve serbest Türkçe YOK. Duruş `kod` olarak dönüyor
//  (hawk|dove|neu), faz `kod` olarak dönüyor (early|mid|late|recession),
//  sektörler MAKİNE KODU dizisi. "🔺 Sıkılaşma / şahin baskı",
//  "Geç döngü" gibi cümleler app.js'te PMAC_STANCE_TR ve
//  CYCLE_PHASES.label içinde KALIYOR — motorda da duruyorlar ama BİLEREK
//  dışa verilmiyorlar.
//
//  ÖNBELLEK YOK: istemci yolunda 0 dış istek + girdi POST gövdesi. Gövdeyi
//  anahtara özetlemek yeniden hesaplamaktan pahalı olurdu (gerekçe
//  api/_onbellek.js başlığında yazılı). Cevap `no-store`.
//
//  NE DEĞİL: bu bir PİYASA TAHMİNİ DEĞİL. Manşet sayımından çıkan bir
//  EĞİLİM OKUMASIDIR; korelasyon nedensellik değildir. "Şu sektörü al"
//  demez, "faiz yönü şu tarafa ağır basıyor, tarihsel olarak şu sektör
//  grubu faize duyarlıdır" der. Bilgi amaçlıdır.
//
//  SÖZLEŞME
//    POST /api/pulse   Content-Type: application/json
//    Gövde: {
//      faizHaberleri:      [{ title, description?, pubDate }],   // bkz. ↓
//      enflasyonHaberleri: [{ title, description?, pubDate }],   // bkz. ↓
//        İKİSİ DE GELİRSE ya da BİRİ GELİRSE → İSTEMCİ YOLU (eski
//        davranış, ağa çıkılmaz). HİÇBİRİ GELMEZSE ve `q`/`semboller`
//        verilmişse → SUNUCU YOLU (uç haberi kendi tarar). İkisi de
//        yoksa eski hata: 400 `faizHaberleri_yok`.
//      q?:                 serbest metin — sunucu yolunu AÇAR
//      semboller?:         ['ASELS','THYAO'] ya da 'ASELS,THYAO' — açar
//      haberPazari?:       TR | US  (sembol haberinin yerel ayarı)
//      genislik?:          0..100   (evrenin ortalama TA skoru)
//      enflasyonBaskisi?:  0..1     (computeMacro dims.infl)
//      risk?:              0..1     (jeopolitik risk, dims.risk)
//      simdi?:             ms damgası — YALNIZ test/yeniden oynatma için
//    }
//    Cevap 200: {
//      durus: { faizYon, enflasyonYon, baski, kod, egilimYukari[], egilimAsagi[] },
//      taze: { faiz2g, enflasyon2g },
//      pencere: { gun, tazelikSaat, tazelikAgirlik },
//      degerlendirilen: { faiz, enflasyon },
//      konjonktur: { faz, boyutlar: {rate,infl,growth,risk}, sektorler[] } | null,
//      kaynak: 'istemci' | 'sunucu',
//      haberler: null | { faiz, enflasyon, sorgu: [{sorgu, market,
//                         adet, maddeler[]}], sayac, tam },
//      eksik: [...], surum, ms, uyari
//    }
//      kaynak    manşetleri KİMİN topladığı. 'istemci' iken `haberler`
//                null'dır ve uç ağa HİÇ çıkmamıştır.
//      haberler  sunucu yolunun ÖLÇÜMÜ. `faiz`/`enflasyon` = DURUŞA
//                giren manşet SAYILARI (metin değil: duruş onlardan
//                üretildi, tele geri dönmelerinin anlamı yok).
//                `sorgu[]` = çağıranın `q`/`semboller`i için okunan
//                manşetler; bunlar DURUŞ MATEMATİĞİNE GİRMİYOR
//                (sembol haberinden makro duruş çıkarmak, app.js'in
//                yapmadığı bir hesap olurdu) — istemci onları ekranda
//                gösterebilsin diye METİN olarak dönüyorlar.
//                `tam` false ise manşet taraması EKSİK: duruş yine
//                dönüyor ama DAHA AZ manşetle hesaplandı.
//      faizYon/enflasyonYon/baski  -1..+1 HAM sayı
//      kod   hawk|dove|neu   (SABİT KÜME, motordan)
//      faz   early|mid|late|recession   (SABİT KÜME, motordan)
//      BOŞ CEVAP ARIZA DEĞİL: taze manşet yoksa yönler 0 ve kod 'neu'
//      döner (app.js'te de kutu nötr görünür) — dürüst sessizlik.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'nabiz_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';
// Haberin KENDİ taşıyıcısı — `_ag.js` DEĞİL (gerekçe: dosya başlığı +
// api/_haber.js başlığı). `canliAg` yukarıda yalnız MOTORU KURMAK için
// duruyor; haber onun `fetch` yüzeyinden GEÇMİYOR.
import {
  haberCek, bosHaberSayac, haberTam, AZAMI_HABER_SORGU, HABER_PAZARLAR,
} from './_haber.js';

// maxDuration 10 · İSTEMCİ YOLUNDA /api/causal ile aynı kademe (ağ turu
// yok). SUNUCU YOLU bu tavanı AŞMIYOR, ÖLÇÜLDÜ: istekler PARALEL gidiyor
// ve `_haber.js` her birine 6000 ms zaman aşımı koyuyor, yani en kötü hâl
// 6 sn + regex ayrıştırma. 10 sn tavanı KORUNDU; 30/60 sn'ye çıkarmak
// ölçülmemiş bir sayı yazmak olurdu.
export const config = { runtime: 'nodejs', maxDuration: 10 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — niye bu sayılar (causal.js'in kurduğu kalıp)
//  AZAMI_BASLIK = 120 · liste BAŞINA. Google News RSS tek sorguda ~100
//    madde döndürüyor; 120 bunun rahat üstü, ama "sınırsız" değil.
//  AZAMI_GOVDE_BAYT = 131072 · ARİTMETİK: başlık + açıklama ortalama
//    ~300 bayt; 2 liste × 120 madde × 300 ≈ 72 KB. 128 KB bunun üstünde
//    ama bir ucun belleğini şişirmeye yetmeyecek kadar yakın.
//    /api/causal'ın 64 KB'ı burada yetmezdi: orada taşınan şey başlık
//    METNİ değil, yaş sayılarıydı.
//  Bu sayılar GİRDİ KAPISINA (_girdi.js) konmadı: o taşıyıcı SEMBOL
//  sorgusunun kapısı, bu uç sembol almıyor. Oraya koymak altı uca
//  ilgisiz sabitler taşırdı.
// ---------------------------------------------------------------------
export const AZAMI_BASLIK = 120;
export const AZAMI_GOVDE_BAYT = 131072;

// ---------------------------------------------------------------------
//  PENCERE GÜNÜ — app.js'teki ÇAĞRI NOKTASIYLA aynı sayı.
//  Motorda SABİT DEĞİL, `pulseFreshWithin(items, days)` argümanı: app.js
//  faiz ve enflasyon için 14, "büyük manşet" için 7 veriyor. Bu uç
//  büyük manşet döndürmediği (o blok tamamen sunum) için tek sayı
//  taşıyor. Motora sabit olarak gömmek, çağrı noktasının esnekliğini
//  kaldırmak ve app.js'i değiştirmek olurdu.
//  TAZE SAYIMI 2 GÜN: app.js'in `fresh2d` alanıyla aynı.
// ---------------------------------------------------------------------
export const PENCERE_GUN = 14;
export const TAZE_GUN = 2;

// ---------------------------------------------------------------------
//  SUNUCU YOLUNUN SORGULARI — UYDURULMADI, app.js'ten BİREBİR ALINDI
//  (app.js:11629 `pmFed` · app.js:11630 `pmInfl`). Dil/pazar da oradan:
//  faiz sorgusu TR, enflasyon sorgusu EN. Metni burada "iyileştirmek",
//  sunucunun okuduğu manşet kümesini ekranın okuduğundan ayrıştırır ve
//  aynı duruş iki yerde iki değer verirdi.
//  pmBig (büyük manşet) BİLEREK YOK: bu uç büyük manşet DÖNDÜRMÜYOR,
//  o blok tamamen sunum (dosya başlığında yazılı).
// ---------------------------------------------------------------------
export const MAKRO_SORGULAR = {
  faiz: {
    market: 'TR',
    q: '(Fed OR Powell OR FOMC OR "Merkez Bankası") (faiz OR "interest rate" OR "rate cut" OR "rate hike" OR "faiz kararı" OR hawkish OR dovish)',
  },
  enflasyon: {
    market: 'US',
    q: '(CPI OR inflation OR "consumer price" OR "Treasury yield" OR "10-year yield" OR "jobs report" OR PCE)',
  },
};

// Sunucu yolunda bir beslemeden okunan azami manşet. AZAMI_BASLIK (120)
// İSTEMCİ yolunun tavanı ve orada girdiyi istemci TOPLAMIŞ oluyor —
// bedava. Sunucu yolunda her manşet BİZİM taradığımız bayt, o yüzden
// taşıyıcının kendi tavanı (`_haber.js` AZAMI_MADDE = 25) geçerli.
export const SUNUCU_AZAMI_MADDE = 25;

// Sembol başına haber İSTEĞİ sayısı değil, SEMBOL sayısı tavanı.
// ARİTMETİK: 2 makro + 4 sembol = 6 PARALEL istek × 6 sn zaman aşımı,
// hepsi 10 sn `maxDuration` tavanının altında. Beşinci sembol tavanı
// aşmıyor ama ölçülmemiş; gerekirse ÖLÇÜLÜP büyütülür.
export const AZAMI_SEMBOL_HABER = 4;

/**
 * İstemci manşet VERDİ Mİ? Tek soru, tek yerde — iki ayrı yerde
 * sorulursa bir gün ayrışır ve geriye dönük uyum sessizce kırılır.
 * SAF. Dışa aktarılıyor: tests/uc-test.mjs ağsız ölçebiliyor.
 */
export function istemciVerdi(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Array.isArray(body.faizHaberleri) || Array.isArray(body.enflasyonHaberleri);
}

/**
 * Sunucu yolunun girdisini çöz: `q` ve/veya `semboller`.
 * SAF: ağa çıkmaz. Dışa aktarılıyor — ağsız sınanabiliyor.
 *
 * SESSİZ KIRPMA YOK: sembol tavanı aşılırsa açıkça reddediliyor
 * (chart.js'in `cok_sembol` kararıyla aynı fikir).
 *
 * @returns {{sorgular:{sorgu:string,market:string}[], pazar:string}
 *           | {error:string, ...}}
 */
export function ayristirSunucuGirdisi(body) {
  const pazarHam = String((body && body.haberPazari) ?? 'TR').trim().toUpperCase();
  if (!HABER_PAZARLAR.includes(pazarHam)) {
    return { error: 'bad_haberPazari', izinli: HABER_PAZARLAR };
  }

  // `semboller` iki biçimde gelebilir — app.js'in alışkanlığı virgüllü
  // dizge, native taraf dizi gönderiyor. İkisi de kabul; üçüncü bir tür
  // REDDEDİLİYOR.
  let ham = [];
  const s = body && body.semboller;
  if (Array.isArray(s)) ham = s;
  else if (typeof s === 'string') ham = s.split(',');
  else if (s !== undefined && s !== null && s !== '') return { error: 'bad_semboller' };

  const semboller = [];
  for (const it of ham) {
    const t = String(it ?? '').trim();
    if (!t) continue;
    if (t.length > AZAMI_HABER_SORGU) return { error: 'too_long', azami: AZAMI_HABER_SORGU };
    semboller.push(t);
  }
  if (semboller.length > AZAMI_SEMBOL_HABER) {
    return { error: 'cok_sembol', azami: AZAMI_SEMBOL_HABER, istenen: semboller.length };
  }

  const q = String((body && body.q) ?? '').trim();
  if (q.length > AZAMI_HABER_SORGU) return { error: 'too_long', azami: AZAMI_HABER_SORGU };

  const sorgular = [];
  if (q) sorgular.push({ sorgu: q, market: pazarHam });
  for (const sym of semboller) sorgular.push({ sorgu: sym, market: pazarHam });

  // Ne `q` ne `semboller` → sunucu yolu AÇILMAZ. Çağıran bunu
  // "istemci yolu" diye okur ve eski 400'e düşer.
  if (!sorgular.length) return { error: 'girdi_yok' };

  return { sorgular, pazar: pazarHam };
}

function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/score.js).
//  Bu uç motorun yalnız makro/nabız dilimlerini kullanıyor ama
//  buildMotor bölünmez bir bütün; ağırlıklar yine de takılıyor ki motor
//  nesnesi öteki uçlarla AYNI biçimde kurulsun.
// ---------------------------------------------------------------------
let ENG = null;
let KURULUM_HATASI = null;
try {
  const AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
  ENG._weights = AG.H.window.TA_WEIGHTS;
  ENG._bench = AG.H.window.TA_BENCHMARK;
} catch (e) {
  KURULUM_HATASI = e;
}

/**
 * Tek manşet listesini doğrula ve motorun okuduğu alanlara İNDİR.
 * Motor yalnız `title` + `description` (regex) ve `pubDate` (tarih)
 * okuyor; bağlantı, kaynak adı, emoji BİLEREK atılıyor — tele geri
 * dönmeyecekleri için taşınmalarının anlamı yok.
 * @returns {object[] | {error:string, ...}}
 */
export function ayristirListe(ham, ad) {
  if (!Array.isArray(ham)) return { error: ad + '_yok' };
  if (ham.length > AZAMI_BASLIK) {
    return { error: 'cok_baslik', alan: ad, azami: AZAMI_BASLIK, istenen: ham.length };
  }
  const out = [];
  for (const it of ham) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return { error: 'bad_baslik', alan: ad };
    out.push({
      title: String(it.title ?? ''),
      description: String(it.description ?? ''),
      pubDate: it.pubDate == null ? '' : String(it.pubDate),
    });
  }
  return out;
}

/**
 * 0..1 aralığında İSTEĞE BAĞLI sayı. Gelmezse null (eksik), geldiyse
 * aralık DIŞINDAYSA hata — sessizce kırpmak, istemcinin farketmediği
 * yanlış bir faz üretirdi.
 */
function sayi01(v, ad) {
  if (v === undefined || v === null || v === '') return { yok: true };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) return { error: 'bad_' + ad };
  return { deger: n };
}

/**
 * Gövdeyi doğrula ve motorun beklediği biçime çevir. SAF: ağa çıkmaz,
 * motoru ÇAĞIRMAZ. Bu yüzden dışa aktarılıyor — tests/uc-test.mjs ağsız
 * ölçebiliyor.
 * @returns {{faiz:object[], enflasyon:object[], genislik:(number|null),
 *            enflasyonBaskisi:(number|null), risk:(number|null),
 *            simdi:(number|null)} | {hata:{http:number, govde:object}}}
 */
export function ayristirGovde(body) {
  const hata = (http, govde) => ({ hata: { http, govde } });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return hata(400, { error: 'govde_yok' });

  const faiz = ayristirListe(body.faizHaberleri, 'faizHaberleri');
  if (faiz.error) return hata(400, faiz);
  const enflasyon = ayristirListe(body.enflasyonHaberleri, 'enflasyonHaberleri');
  if (enflasyon.error) return hata(400, enflasyon);

  // Genişlik 0..100: evrenin ORTALAMA TA SKORU (computeMacro'da öyle
  // üretiliyor), yüzde değil. Aralık dışı sessizce kırpılmaz.
  let genislik = null;
  if (!(body.genislik === undefined || body.genislik === null || body.genislik === '')) {
    const g = Number(body.genislik);
    if (!Number.isFinite(g) || g < 0 || g > 100) return hata(400, { error: 'bad_genislik' });
    genislik = g;
  }

  const eb = sayi01(body.enflasyonBaskisi, 'enflasyonBaskisi');
  if (eb.error) return hata(400, eb);
  const rk = sayi01(body.risk, 'risk');
  if (rk.error) return hata(400, rk);

  // `simdi` YALNIZ test / yeniden oynatma içindir: tazelik penceresini
  // sabitleyip cevabı deterministik yapar. Verilmezse Date.now().
  let simdi = null;
  if (!(body.simdi === undefined || body.simdi === null || body.simdi === '')) {
    const s = Number(body.simdi);
    if (!Number.isFinite(s) || s <= 0) return hata(400, { error: 'bad_simdi' });
    simdi = s;
  }

  return {
    faiz,
    enflasyon,
    genislik,
    enflasyonBaskisi: eb.yok ? null : eb.deger,
    risk: rk.yok ? null : rk.deger,
    simdi,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET DEĞİL: girdi manşet LİSTESİ, sorgu dizgisine sığmaz (başlıktaki
  // (b) kararı). /api/causal ile aynı sebep.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }

  if (KURULUM_HATASI || !ENG) {
    console.error('api/pulse: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
    kisaOnbellek(res);
    res.status(503).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return;
  }

  // Vercel Node runtime gövdeyi Content-Type JSON ise kendi ayrıştırıyor;
  // dizge gelirse elle çözüyoruz (api/watchlist.js:77 ile aynı kalıp).
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > AZAMI_GOVDE_BAYT) {
      kisaOnbellek(res);
      res.status(413).json({ error: 'govde_buyuk', azami: AZAMI_GOVDE_BAYT, uyari: UYARI });
      return;
    }
    try { body = JSON.parse(body); } catch { body = null; }
    if (!body) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bozuk_json', uyari: UYARI });
      return;
    }
  }

  const t0 = Date.now();

  // -------------------------------------------------------------------
  //  YOL SEÇİMİ — GERİYE DÖNÜK UYUM ÖNCE GELİR (2026-10-24 kararı,
  //  gerekçe dosya başlığında). İstemci manşet verdiyse BU BLOK HİÇ
  //  ÇALIŞMAZ: ne ağ açılır, ne gövde değişir, ne tek bir sayı kayar.
  // -------------------------------------------------------------------
  let kaynak = 'istemci';
  let haberler = null;

  if (!istemciVerdi(body)) {
    const sg = ayristirSunucuGirdisi(body);
    // `girdi_yok` = çağıran sunucu yolunu İSTEMEDİ. Eski davranışa
    // düşüyoruz (aşağıda 400 `faizHaberleri_yok`) — yeni bir hata kodu
    // icat etmek, bugünün istemcisinin gördüğü cevabı değiştirmek olurdu.
    if (sg.error && sg.error !== 'girdi_yok') {
      kisaOnbellek(res);
      res.status(400).json({ ...sg, uyari: UYARI });
      return;
    }
    if (!sg.error) {
      try {
        // TEK SAYAÇ, bütün beslemeler için: `tam` ancak HEPSİ eksiksiz
        // okunduğunda true olur. Beslemeleri ayrı ayrı "tam" ilan edip
        // birini kaçırmak, eksik duruşu tam göstermek olurdu.
        const sayac = bosHaberSayac();

        // PARALEL: diziliyse 6 × 6 sn en kötü hâl 36 sn olur ve 10 sn
        // tavanını aşardı (yukarıdaki maxDuration aritmetiği).
        const [fz, enf, ...ek] = await Promise.all([
          haberCek(MAKRO_SORGULAR.faiz.q, {
            market: MAKRO_SORGULAR.faiz.market, limit: SUNUCU_AZAMI_MADDE, sayac,
          }),
          haberCek(MAKRO_SORGULAR.enflasyon.q, {
            market: MAKRO_SORGULAR.enflasyon.market, limit: SUNUCU_AZAMI_MADDE, sayac,
          }),
          ...sg.sorgular.map((it) => haberCek(it.sorgu, {
            market: it.market, limit: SUNUCU_AZAMI_MADDE, sayac,
          })),
        ]);

        // Taşıyıcının maddesi `{title, link, pubDate, source}`; motor
        // `title` + `description` + `pubDate` okuyor. `description`
        // UYDURULMUYOR: taşıyıcı döndürmüyor, boş geçiyor.
        const cevir = (r) => (r.maddeler || []).map((m) => ({
          title: m.title, description: '', pubDate: m.pubDate,
        }));

        // Gövde YERİNDE değiştirilmiyor, YENİSİ kuruluyor: çağıranın
        // öteki alanları (genislik/risk/simdi) olduğu gibi korunuyor ve
        // doğrulama ORTAK kapıdan (`ayristirGovde`) geçiyor — sunucu
        // yolu için İKİNCİ bir doğrulama yazılmadı.
        body = {
          ...body,
          faizHaberleri: cevir(fz),
          enflasyonHaberleri: cevir(enf),
        };

        kaynak = 'sunucu';
        haberler = {
          faiz: body.faizHaberleri.length,
          enflasyon: body.enflasyonHaberleri.length,
          sorgu: sg.sorgular.map((it, i) => ({
            sorgu: it.sorgu,
            market: it.market,
            adet: (ek[i] && ek[i].maddeler ? ek[i].maddeler.length : 0),
            maddeler: (ek[i] && ek[i].maddeler) || [],
          })),
          sayac,
          tam: haberTam(sayac),
        };
      } catch (e) {
        // Haber taraması çökse bile uç 502 DÖNMÜYOR: duruş boş
        // manşetlerle "nötr" olarak hesaplanabilir ve bu DÜRÜST bir
        // sessizliktir. Ama sessiz DEĞİL — `haberler.tam` false.
        console.error('api/pulse: haber taramasi basarisiz —', (e && e.stack) || e);
        const sayac = bosHaberSayac();
        sayac.hata++;
        body = { ...body, faizHaberleri: [], enflasyonHaberleri: [] };
        kaynak = 'sunucu';
        haberler = { faiz: 0, enflasyon: 0, sorgu: [], sayac, tam: false };
      }
    }
  }

  const ay = ayristirGovde(body);
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }

  try {
    const simdi = ay.simdi;

    // --- ⚡ Nabız duruşu: AĞIRLIKLI yollar (computePulseMacro'nun yolu)
    const faizTaze = ENG.pulseFreshWithin(ay.faiz, PENCERE_GUN, simdi);
    const enfTaze = ENG.pulseFreshWithin(ay.enflasyon, PENCERE_GUN, simdi);
    const wOf = ENG.pulseFreshWeight(simdi);
    const faizYon = ENG.rateDirection(faizTaze, wOf);
    const enflasyonYon = ENG.inflDirection(enfTaze, wOf);
    const st = ENG.pulseStance(faizYon, enflasyonYon);

    // --- Konjonktür kartı: computeMacro'nun yolu
    //  Faiz yönü burada AĞIRLIKSIZ (app.js `rateDirection(td.fed.items)`
    //  diye çağırıyor) ve pencere UYGULANMIYOR — iki yol bilerek ayrı.
    const eksik = [];
    if (ay.genislik === null) eksik.push('genislik');
    if (ay.enflasyonBaskisi === null) eksik.push('enflasyonBaskisi');
    if (ay.risk === null) eksik.push('risk');

    let konjonktur = null;
    if (!eksik.length) {
      const rate = ENG.rateDirection(ay.faiz);
      const growth = ENG.macroGrowth(ay.genislik);
      const boyutlar = { rate, infl: ay.enflasyonBaskisi, growth, risk: ay.risk };
      const faz = ENG.macroPhase(boyutlar);
      const kayit = ENG.CYCLE_PHASES[faz] || null;
      konjonktur = {
        faz,
        boyutlar,
        // Yalnız SEKTÖR KODLARI: `label`/`emoji`/`desc` serbest Türkçe,
        // motorda duruyor ama tele ÇIKMIYOR (HAM SAYI kuralı).
        sektorler: (kayit && Array.isArray(kayit.sectors)) ? kayit.sectors.slice() : [],
      };
    }

    // Gövdeye bağlı, istemciye özel cevap: CDN'de paylaşılmamalı.
    // Öteki uçların 5 dakikalık penceresi burada YANLIŞ olurdu.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      durus: {
        faizYon,
        enflasyonYon,
        baski: st.pressure,
        kod: st.cls,
        egilimYukari: st.biasUp,
        egilimAsagi: st.biasDown,
      },
      taze: {
        faiz2g: ENG.pulseRecentCount(ay.faiz, TAZE_GUN),
        enflasyon2g: ENG.pulseRecentCount(ay.enflasyon, TAZE_GUN),
      },
      pencere: {
        gun: PENCERE_GUN,
        tazelikSaat: ENG.PULSE_FRESH_H,
        tazelikAgirlik: ENG.PULSE_FRESH_W,
      },
      degerlendirilen: { faiz: faizTaze.length, enflasyon: enfTaze.length },
      konjonktur,
      // Yol AÇIKÇA bildiriliyor — istemci tahmin etmiyor.
      kaynak,
      haberler,
      eksik,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/pulse:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'nabiz_hesaplanamadi', uyari: UYARI });
  }
}
