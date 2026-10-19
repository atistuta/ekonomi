// =====================================================================
//  api/_onbellek.js — VERCEL KV ÖNBELLEK TAŞIYICISI (altıncı taşıyıcı)
//
//  NE: altı ucun PAYLAŞTIĞI önbellek katmanı — anahtar üretimi, okuma,
//  yazma ve "KV yoksa sessizce önbelleksiz devam" kuralı. Her uçta kopya
//  mantık YOK; uç yalnız `anahtar()` + `oku()` + `yaz()` çağırır.
//
//  TAŞIYICI AYRIMI — bu dosya ELLE YAZILIR:
//    ÜRETİLEN  : api/_motor.js (app.js'ten) · api/_ayar.js (config.js'ten)
//    ELLE YAZAN: api/_ag.js · api/_akis.js · api/_girdi.js · BU DOSYA.
//  `_` öneki Vercel'in bunu rota olarak yayınlamasını engelliyor.
//
//  ---------------------------------------------------------------------
//  NİYE VAR — ÖLÇÜLEN MALİYET (2026-10-18, sahte fetch, ağa çıkmadan;
//  sayım URL bazında, SEC zinciri gerçekçi bir ticker→CIK haritasıyla
//  sonuna kadar yürütülerek):
//
//    /api/score?symbols=AAPL        →  33 dış istek
//                                      30 × data.sec.gov companyconcept
//                                       1 × sec.gov company_tickers.json
//                                       2 × query1.finance.yahoo.com chart
//    /api/score?symbols=ASELS.IS    →   5 dış istek
//                                       3 × isyatirim.com.tr MaliTablo
//                                       2 × query1.finance.yahoo.com chart
//    /api/recommend?symbols=AAPL    →  33   (aynı zincir: scoreOne ⊂ recommendOne)
//    /api/analyze?symbols=AAPL      →  33   (aynı zincir)
//    /api/compare?symbols=AAPL,MSFT →  65   (sembol başına 32 + tur başına 1
//                                            ticker haritası; _ag.js `birKez`)
//    /api/causal (POST)             →   0   dış istek — SAF HESAP
//    /api/theme?q=…                 →   1   dış istek — ama PARA ile ödenen
//                                            tek istek (api.anthropic.com)
//
//  Yani skor şeridinin maliyeti EZİCİ BİÇİMDE temel (bilanço) tarafında:
//  bir ABD sembolünün 33 isteğinin 31'i SEC, yalnız 2'si fiyat. SEC'in
//  10 istek/sn sınırı yüzünden bu 31 istek arasında 125 ms zorunlu
//  bekleme var (_ag.js SEC_ARALIK_MS) → ÖLÇÜLEN 7,2 sn/sembol
//  (tests/duman.mjs, 2026-10-14). AZAMI_SEMBOL = 8 ile ≈ 58 sn, yani
//  maxDuration 60'ın dibi. Önbellek isabeti bu 33 isteği 1 KV okumasına
//  indiriyor.
//
//  ---------------------------------------------------------------------
//  TTL — NEDEN BU SAYILAR, VE NİYE FİYAT İLE TEMEL AYRI
//
//  Fiyat verisi ile bilanço verisinin tazelik ihtiyacı AYNI DEĞİL:
//    · FİYAT (Yahoo mum): motor adrese 5 dakikalık bir `_t` kovası
//      koyuyor (_motor.js:99) — yani ÜST KAYNAK ZATEN 300 sn
//      çözünürlükte. Bundan kısa bir TTL boşa KV trafiği, uzun bir TTL
//      ise motorun kendi çözünürlüğünden daha eski veri servis etmek.
//    · TEMEL (SEC companyconcept · İş Yatırım mali tablo): çeyrekte bir
//      değişiyor. Tek başına 6 saat (21.600 sn) tutulabilirdi.
//
//  AMA skor şeridinin ucu TEK GÖVDE döndürüyor ve o gövdenin İÇİNDE
//  canlı fiyat var (`fa.price`, alım bandı, kâr-al). Gövdeyi temel
//  verinin TTL'siyle (6 saat) tutmak, 6 saat önceki FİYATI yeniden
//  servis etmek olurdu. Bu yüzden BİRLEŞİK gövdenin TTL'si
//  BİLEŞENLERİN EN TAZESİNE eşit: `TTL_FIYAT = 300`.
//
//  SERT KURAL — ÖNBELLEK SKORU DEĞİŞTİRMEZ: her TTL, ucun ZATEN
//  yayınladığı `Cache-Control` penceresiyle BİREBİR aynı seçildi
//  (score/recommend/analyze/compare/chart: `max-age=300, s-maxage=300` ·
//  theme: `s-maxage=86400`). Böylece KV, istemci sözleşmesinin ÇOKTAN
//  izin verdiğinden daha eski hiçbir şey servis edemez — önbellek yeni
//  bir eskilik penceresi İCAT ETMİYOR, var olanı CDN'den KV'ye
//  genişletiyor. Aynı anahtar → aynı gövde; skorun DEĞERİ aynı kalır.
//
//  TEMELİ AYRI VE UZUN TTL'li KATMANA AYIRMAK (33 isteğin 31'ini 6 saat
//  boyunca sıfırlamak) BİLEREK YAPILMADI — ölçülmüş sebep: taze fiyat +
//  6 saatlik temel karışımı, aynı anda yapılacak TAZE bir hesaptan
//  FARKLI bir bileşke üretebilir (composite FA ve TA'yı harmanlıyor).
//  Bu, "önbellek skoru değiştirmez" kuralının ihlali olurdu. Bu ayrım
//  FAZ 2 işi ve ancak bileşke sözleşmesi "FA şu tarihli" alanını
//  taşıdığı gün dürüstçe yapılabilir. Bu yüzden burada TEK bir
//  `TTL_TEMEL` sabiti YOK: kullanılmayan sabit, yapılmamış işi yapılmış
//  gibi gösterir.
//
//  /api/chart DE `TTL_FIYAT` KULLANIYOR — VE AYRI BİR "İÇ GÜN" TTL'si
//  İCAT EDİLMEDİ (2026-10-19). İlk tasarımda 5m/15m/60m aralıkları için
//  `TTL_GRAFIK_ICI = 60` düşünülmüştü; ÖLÇÜM bunu çürüttü: motorun
//  adres kurucusu `_t` kovasını aralığa BAKMADAN 5 dakikada bir
//  çeviriyor (`_motor.js:105`). Yani 5 dakikalık kovanın İÇİNDE yapılan
//  ikinci istek üst kaynaktan da daha taze bir mum alamıyor. 60 sn'lik
//  bir pencere yayınlamak, motorun VEREMEDİĞİ bir tazeliği vaat etmek
//  olurdu — "ölçemedim"i "ölçtüm" gibi göstermek. Doğrusu tek sayı:
//  grafik gövdesinin TTL'si de 300, yayınlanan `Cache-Control` da 300.
//  Gün içi mumları gerçekten 60 sn tazelikle isteyen bir ekran çıkarsa
//  önce MOTORUN kovası aralığa duyarlı yapılmalı; sıra oradan başlar.
//
//  /api/pulse ÖNBELLEKLENMİYOR — /api/causal ile BİREBİR aynı gerekçe:
//  0 dış istek, saf hesap, girdi istemcinin POST gövdesi (başlıklar).
//  O gövdeyi anahtara özetlemek yeniden hesaplamaktan pahalı olurdu;
//  cevabı da `no-store`, yani paylaşılacak pencere yok.
//
//  /api/causal ÖNBELLEKLENMİYOR — ölçüm bunu söylüyor: 0 dış istek, saf
//  hesap, `maxDuration` 10. Üstelik girdisi en çok 64 KB gövde
//  (AZAMI_GOVDE_BAYT); o gövdeyi anahtara özetlemek + KV turu, yeniden
//  hesaplamaktan PAHALI olurdu. Ucun cevabı da `no-store` — paylaşılacak
//  bir pencere yok.
//
//  ---------------------------------------------------------------------
//  KV YOKSA UÇ ÇALIŞMAYA DEVAM EDER — bu dosyanın BİRİNCİ sözü.
//  Ortam değişkeni tanımsız · KV hata veriyor · KV yavaş → üçünde de
//  `oku()` null, `yaz()` false döner ve istek ÖNBELLEKSİZ yoluna devam
//  eder. İstek ASLA düşmez. `api/watchlist.js`in kurduğu kalıp izlendi
//  (aynı paket `@vercel/kv`, aynı `KV_REST_API_*` değişkenleri); YENİ
//  bir KV kurulumu icat edilmedi.
//
//  ZAMAN AŞIMI: KV turu `KV_ISTEK_MS` içinde bitmezse terk edilir
//  (`api/_ag.js`in süre freni fikri, KV'ye uygulanmış hali). Okuma
//  isabetinde 7,2 sn yerine ≤ 0,3 sn harcıyoruz; ıska durumunda 0,3 sn
//  zaten 7,2 sn'nin yanında görünmez.
//
//  SIR SIZDIRMA YASAĞI: bu dosya ne anahtar, ne token, ne de KV'nin
//  hata METNİNİ loglar — yalnız sabit bir Türkçe satır. Kullanıcı
//  e-postası hiçbir anahtara, loga ya da gövdeye GİRMEZ.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------
//  SABİTLER
// ---------------------------------------------------------------------

// Önbellek ŞEMA sürümü. Anahtar BİÇİMİ ya da gövde sözleşmesi değişirse
// bu artar ve eski girdiler kendiliğinden erişilemez olur. Motor sürümü
// AYRI bir eksen: o `anahtar()`a imza olarak giriyor.
export const ONBELLEK_SURUM = 'o1';

// Fiyat kovası: motorun kendi `_t` kovasıyla ve ucun yayınladığı
// `max-age=300` ile AYNI sayı. Üç yerde aynı sayı tesadüf değil, sözleşme.
export const TTL_FIYAT = 300;

// Tema adayları: api/theme.js'in yayınladığı `s-maxage=86400` ile aynı.
export const TTL_TEMA = 86400;

// KV turu için süre freni. Uçların `maxDuration`ı (60 sn / 30 sn) yanında
// görünmez; ama KV takılırsa isteği bloke etmesin.
export const KV_ISTEK_MS = 300;

// ---------------------------------------------------------------------
//  KV HAZIR MI — ortam değişkeni YOKLAMASI, ağ turu DEĞİL.
//  `api/watchlist.js`in beklediği değişkenlerin aynısı: Vercel
//  dashboard → Storage → KV bağlanınca ikisi de otomatik gelir.
// ---------------------------------------------------------------------
export function kvHazir() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// `@vercel/kv` modülü tembel içe alınıyor: KV hiç yapılandırılmamışsa
// modül belleğe bile çekilmesin, bir içe alma hatası ucu düşürmesin.
let _kv = null;
let _kvKirik = false;
async function kvAl() {
  if (_kvKirik) return null;
  if (_kv) return _kv;
  try {
    const m = await import('@vercel/kv');
    _kv = m.kv;
    return _kv;
  } catch (_) {
    _kvKirik = true;            // bir daha denemeyelim (sıcak lambda)
    console.error('onbellek: @vercel/kv yuklenemedi (onbelleksiz devam)');
    return null;
  }
}

/** Test kancası: sahte KV takmak için. Üretim yolunda ÇAĞRILMAZ. */
export function kvTak(sahte) {
  _kv = sahte;
  _kvKirik = false;
}

// ---------------------------------------------------------------------
//  ANAHTAR — DETERMİNİSTİK ve GİRDİYİ TAM KAPSAR.
//
//  Kapsam: uç adı + sembol/pazar/vade (ya da tema sorgusu) + MOTOR
//  İMZASI + AYAR İMZASI + şema sürümü. Motor imzası anahtarın İÇİNDE
//  olduğu için `node tools/motor-uret.mjs` motoru değiştirdiği an TÜM
//  eski girdiler kendiliğinden geçersizleşir — eski skor yeni motorla
//  KARIŞAMAZ. (Bu, önbelleği elle temizleme ihtiyacını da kaldırıyor.)
//
//  SEMBOL SIRASI KORUNUR, sıralanmaz: `sonuclar` dizisi girdi sırasını
//  izliyor ve `/api/compare` o sıraya bakan `sira` alanını üretiyor.
//  Sıralamak "AAPL,MSFT" ile "MSFT,AAPL"i aynı anahtara düşürür ve
//  istemciye YANLIŞ SIRADA bir gövde servis ederdi.
//
//  Kanonik metin sha256'ya veriliyor: anahtar uzunluğu girdiyle
//  büyümesin (8 sembol × 12 karakter + vade + iki imza ≈ 200 karakter).
//  Önek okunabilir kalıyor ki KV'de göz ile ayıklanabilsin.
// ---------------------------------------------------------------------
export function anahtar(uc, girdi = {}, imza = {}) {
  const parcalar = [
    'uc=' + String(uc),
    'motor=' + String(imza.motor || '-'),
    'ayar=' + String(imza.ayar || '-'),
  ];
  // Girdi alanları ADLARINA göre sıralanıyor: nesne alan sırası anahtarı
  // değiştirmesin. DEĞERLER olduğu gibi (dizi sırası anlamlı).
  for (const ad of Object.keys(girdi).sort()) {
    const v = girdi[ad];
    if (v === undefined || v === null) continue;
    parcalar.push(ad + '=' + (Array.isArray(v) ? v.join(',') : String(v)));
  }
  const kanonik = parcalar.join('|');
  const ozet = createHash('sha256').update(kanonik, 'utf8').digest('hex').slice(0, 32);
  return `ob:${ONBELLEK_SURUM}:${uc}:${ozet}`;
}

/** Skor şeridinin ortak girdi özeti — dört uç AYNI fonksiyonu çağırır. */
export function skorGirdisi(ay) {
  return {
    vade: ay.vade,
    market: ay.market,
    semboller: (ay.rows || []).map((r) => `${r.market}:${r.sym}`),
  };
}

// ---------------------------------------------------------------------
//  ZAMAN AŞIMLI SARMAL — KV takılırsa isteği bekletmesin.
//  `Promise.race` ile: kaybeden tur terk edilir (sonucu yok sayılır).
// ---------------------------------------------------------------------
function sureli(vaat, ms) {
  return new Promise((coz) => {
    let bitti = false;
    const z = setTimeout(() => { if (!bitti) { bitti = true; coz({ asti: true }); } }, ms);
    vaat.then(
      (d) => { if (!bitti) { bitti = true; clearTimeout(z); coz({ deger: d }); } },
      () => { if (!bitti) { bitti = true; clearTimeout(z); coz({ hata: true }); } },
    );
  });
}

// ---------------------------------------------------------------------
//  OKU — isabet varsa gövde, YOKSA ya da HER TÜRLÜ arızada `null`.
//  `null` dönmesi "önbelleksiz devam et" demektir, "hata" demez.
// ---------------------------------------------------------------------
export async function oku(key) {
  if (!key || !kvHazir()) return null;
  const kv = await kvAl();
  if (!kv) return null;
  let s;
  try {
    s = await sureli(Promise.resolve().then(() => kv.get(key)), KV_ISTEK_MS);
  } catch (_) {
    // `kv.get` senkron fırlatırsa (yapılandırma hatası) buraya düşer.
    console.error('onbellek: okuma basarisiz (onbelleksiz devam)');
    return null;
  }
  if (s.asti) { console.error('onbellek: okuma zaman asti (onbelleksiz devam)'); return null; }
  if (s.hata) { console.error('onbellek: okuma basarisiz (onbelleksiz devam)'); return null; }
  const d = s.deger;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  return d;
}

// ---------------------------------------------------------------------
//  YAZ — başarılıysa true, HER TÜRLÜ arızada false. Arıza isteği DÜŞÜRMEZ.
//  Yazma İSKA yolunda oluyor: o istek zaten ~7 sn harcadı, 0,3 sn'lik
//  tavan görünmez. `await` ediliyor çünkü sunucusuz ortamda cevap
//  dönünce süreç dondurulabilir ve bekletilmemiş bir yazma kaybolur.
// ---------------------------------------------------------------------
export async function yaz(key, govde, ttlSn) {
  if (!key || !govde || !kvHazir()) return false;
  const kv = await kvAl();
  if (!kv) return false;
  let s;
  try {
    s = await sureli(Promise.resolve().then(() => kv.set(key, govde, { ex: ttlSn })), KV_ISTEK_MS);
  } catch (_) {
    console.error('onbellek: yazma basarisiz (onbelleksiz devam)');
    return false;
  }
  if (s.asti) { console.error('onbellek: yazma zaman asti (onbelleksiz devam)'); return false; }
  if (s.hata) { console.error('onbellek: yazma basarisiz (onbelleksiz devam)'); return false; }
  return true;
}
