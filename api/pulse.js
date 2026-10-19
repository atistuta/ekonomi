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
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): gövdede Intl/toFixed/
//  yüzde/para simgesi ve serbest Türkçe YOK. Duruş `kod` olarak dönüyor
//  (hawk|dove|neu), faz `kod` olarak dönüyor (early|mid|late|recession),
//  sektörler MAKİNE KODU dizisi. "🔺 Sıkılaşma / şahin baskı",
//  "Geç döngü" gibi cümleler app.js'te PMAC_STANCE_TR ve
//  CYCLE_PHASES.label içinde KALIYOR — motorda da duruyorlar ama BİLEREK
//  dışa verilmiyorlar.
//
//  ÖNBELLEK YOK: 0 dış istek + girdi istemcinin POST gövdesi. Gövdeyi
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
//      faizHaberleri:      [{ title, description?, pubDate }],   // zorunlu
//      enflasyonHaberleri: [{ title, description?, pubDate }],   // zorunlu
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
//      eksik: [...], surum, ms, uyari
//    }
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

// maxDuration 10 · /api/causal ile AYNI kademe ve aynı gerekçe: bu uç
// AĞA ÇIKMIYOR. Öteki uçların 30-60 sn'si Yahoo/SEC turu içindi; buraya
// kopyalamak ölçülmemiş bir sayı yazmak olurdu. İş yükü: iki regex
// taraması × en çok 240 manşet — milisaniyeler.
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

  const ay = ayristirGovde(body);
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }

  const t0 = Date.now();
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
