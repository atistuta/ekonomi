// ===========================================================================
//  /api/news — HABER (manşet) uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NİYE VAR — ÖLÇÜLEN EKSİK (2026-10-24): native istemci (mobile/) RSS
//  TARAYAMIYOR. Webde manşetler tarayıcı vekiliyle okunuyor (app.js
//  `fetchVia` → `parseRSS`), ama o yol `DOMParser`a ve vekile bağlı;
//  ikisi de native tarafta yok. Kural "native ince istemci, hesap/veri
//  sunucuda" olduğu için haber taraması sunucuya ALINDI.
//
//  NEDEN BU AD: `/api/news` — öteki uçlar da İNGİLİZCE yol adı taşıyor
//  (`score`, `recommend`, `analyze`, `compare`, `causal`, `chart`,
//  `theme`, `pulse`). `/api/haber` tek Türkçe yol olurdu; yol adları
//  dosya adlarıdır, karışık dil bakımsızlık üretir.
//
//  NE: ham manşet dizisi + sayaç. BAŞKA HİÇBİR ŞEY. Bu uç skor
//  zincirinin (/api/score ⊂ recommend ⊂ analyze ⊂ compare) İÇİNDE DEĞİL,
//  YANINDA: bir eşik, ağırlık ya da skor alanı taşımıyor ve hiçbir skora
//  GİRDİ VERMİYOR. Dönen şey METİN — sayı değil.
//
//  AĞ TAŞIYICISI AYRI: `api/_haber.js`. `api/_ag.js` AÇILMADI,
//  DEĞİŞTİRİLMEDİ — oradaki beş konaklı `IZINLI` listesi SKOR şeridinin
//  güvenlik sözleşmesi ve haber oraya girmez. Gerekçenin tamamı
//  `api/_haber.js` başlığında yazılı.
//
//  HAM METİN KURALI (BAGIMLILIK_GRAFIGI.md §5.1): gövdede Intl/toFixed/
//  yüzde/para simgesi YOK. `pubDate` ÜST KAYNAĞIN VERDİĞİ GİBİ dönüyor
//  (RFC-822 dizgesi) — ms'e çevirmek ya da "3 saat önce" yazmak
//  biçimlemedir ve İSTEMCİDE kalır. Manşet metni çevrilmiyor,
//  kısaltılmıyor, emoji eklenmiyor.
//
//  SINIRLAR BURADA, `_girdi.js`te DEĞİL (chart.js'in kurduğu kalıp):
//  `q` bu uçta SERBEST METİN, sembol değil. Ortak sembol kapısından
//  geçirmek (`temizleSembol`) "Fed faiz kararı" gibi geçerli bir haber
//  sorgusunu reddetmek olurdu. Uzunluk tavanı da bu yüzden ayrı
//  (`AZAMI_HABER_SORGU`, ölçümü _haber.js'te).
//
//  …AMA `symbols=` KİPİ ORTAK KAPIDAN GEÇER — ÜSTTEKİNİN TERSİ DEĞİL,
//  AYNI FİKRİN ÖTEKİ YÜZÜ: `symbols` SERBEST METİN DEĞİL, SEMBOL. O
//  yüzden `_girdi.js`in `ayristir()`ından geçiyor ve onun ÖLÇÜLMÜŞ
//  tavanları aynen geçerli: `AZAMI_SEMBOL` = 8, `AZAMI_SORGU` = 128,
//  `SEMBOL_BICIM`, yineleyi atma, `cok_sembol` reddi. Bu uçta ELLE
//  YAZILMIŞ TEK BİR SEMBOL EŞİĞİ YOK — hata gövdeleri de o kapının
//  kendi kodları (`symbols_yok|too_long|bad_vade|bad_market|
//  symbols_bos|cok_sembol|bad_symbol`), burada yeniden yazılmadı.
//
//  `symbols=` NİYE GEREKTİ (ÖLÇÜLEN EKSİK): webin haber akışı portföyün
//  TÜM sembollerini TEK ekranda, her maddenin hangi hisseye ait
//  olduğunu bilerek gösteriyor (app.js:3308 `{ symbol, type, item }`,
//  app.js:3330 `Promise.allSettled(portfolio.map(...))`). Tek sorgulu
//  uç ile native istemci bunu ancak sembol başına bir HTTP isteğiyle
//  yapabilirdi (8 istek, 8 soğuk lambda). HİSSE↔HABER EŞLEMESİ de bu
//  kipin çıktısında duruyor: her maddenin `symbol` alanı.
//
//  ARİTMETİK (maxDuration 10 ile):
//    · Beslemeler PARALEL (pulse.js:530'un ölçülmüş kalıbı). En kötü hâl
//      8 × 6 sn değil, ~6 sn + ayrıştırma; diziliyse 48 sn olurdu.
//    · Madde tavanı: sembol başına `limit` (1..`AZAMI_MADDE`=25), yani
//      gövde en çok 8 × 25 = 200 madde. İKİSİ DE ÖLÇÜLMÜŞ SABİT; bu uç
//      üçüncü bir sayı UYDURMUYOR.
//
//  TEK SAYAÇ DEĞİL, SEMBOL BAŞINA SAYAÇ + TOPLAM: `haberCek` kendi
//  `tam`ını verilen sayaçtan hesaplıyor; sekiz besleme AYNI sayacı
//  paylaşsa bir sembolün zaman aşımı ÖTEKİ YEDİ sembolü de "ölçemedim"
//  gösterirdi. Her satır KENDİ sayacıyla ölçülüyor, sonra sayaçlar
//  toplanıyor: `semboller[i].tam` o satırın, gövdedeki `tam` hepsinin.
//
//  KV ÖNBELLEĞİ YOK — BİLEREK, SESSİZ EKSİKLİK DEĞİL: `api/_onbellek.js`
//  TTL'leri skor ve tema için ÖLÇÜLDÜ (TTL_FIYAT 300 · TTL_TEMA). Haber
//  için ölçülmüş bir TTL yok ve uydurmak, bayat manşeti "taze" diye
//  servis etmek olurdu. Yerine HTTP penceresi: başarılı ve DOLU cevap
//  120 sn (üst kaynak dakika başı tazeleniyor), eksik/boş cevap 30 sn
//  (öteki uçların `kisaOnbellek` kalıbı). Ölçülmüş bir TTL çıktığında KV
//  eklenir.
//
//  SÖZLEŞME — İKİ KİP, BİRİ ZORUNLU, İKİSİ BİRDEN OLMAZ
//
//  ① TEK SORGU (eski kip, GÖVDESİ DEĞİŞMEDİ)
//    GET /api/news?q=ASELSAN[&market=TR][&limit=10]
//      q      serbest metin ya da sembol (en çok 256 karakter)
//      market TR | US   (varsayılan TR — ölçüm: _haber.js PAZAR_YERELI)
//      limit  1..25     (varsayılan 10)
//    Cevap 200: { q, market, limit, maddeler[], adet, sayac, tam, ms, uyari }
//    SECIMLI: &adaylar=SEMBOL|PAZAR|ad;SEMBOL|PAZAR|ad  (en cok 14)
//      -> cevapta `tema` KARDES ALANI: { sozcukler[], ilgisiz[],
//         adaylar: { SEMBOL: [madde sirasi] } }. Hesap MOTORDA
//         (temaSorguSozcukleri - temaBaslikIlgili - themeNorm -
//         themeNewsHits). `maddeler` SUZULMEZ; ilgisiz olanin sirasi
//         bildirilir. Kip (2)/(3) ile birlikte 400 `adaylar_kip`.
//
//  ② ÇOKLU SEMBOL (yeni)
//    GET /api/news?symbols=THYAO,NVDA[&market=BIST][&limit=10]
//      symbols en çok 8 sembol (ortak kapı: _girdi.js `ayristir`)
//      market  US | BIST — SEMBOL pazarı (kipin kapısı _girdi.js, o
//              yüzden TR/US DEĞİL; satır başına haber yereline
//              `PAZAR_ESLEME` ile çevriliyor)
//      limit   1..25 · SEMBOL BAŞINA
//    Cevap 200: { q: null, symbols[], market, limit, maddeler[], adet,
//                 semboller[], sayac, tam, ms, uyari }
//      semboller[i] = { symbol, market, adet, tam } — satır başına ölçüm
//      maddeler      = BÜTÜN satırların maddeleri TEK düz dizide; hangi
//                      satırdan geldiği maddenin `symbol` alanında.
//
//  ③ GÜNDEM (yeni — webin `general` sekmesinin karşılığı)
//    GET /api/news?gundem=1[&market=TR][&limit=10]
//      gundem  1 | true — kipi AÇAN anahtar. `q`/`symbols` ile BİRLİKTE
//              verilemez (üç kip birbirini dışlar).
//      market  TR | US — HABER YERELİ (kip ①'in kümesiyle aynı liste ama
//              AYRI ölçülmüş küme: `_haber.js GUNDEM_YERELLER`; ikisi
//              ayrışırsa `tests/uc-test.mjs` söyler, sessizce birleşmez)
//      limit   1..25 — TEKİLLEŞTİRMEDEN SONRAKİ madde sayısı
//    Cevap 200: { q: null, gundem: true, market, limit, maddeler[], adet,
//                 besleme[], tekrar, sayac, tam, ms, uyari }
//      besleme[i] = { ad, durum: 'ok'|'bos', adet } — KAYNAK BAŞINA ölçüm.
//                   `durum` MAKİNE KODU; Türkçe etiket İSTEMCİDE. Düşen
//                   beslemenin adı GÖVDEDE duruyor: "5 kaynaktan 4'ü
//                   okundu" denebilsin. Webin `loadGeneral`ı (app.js:6534)
//                   reddedileni SESSİZCE düşürüyor — bu uç DÜŞÜRMÜYOR.
//      tekrar     = iki beslemede birden çıkıp TEKİLLEŞTİRİLEN madde
//                   sayısı. Sessizce yok olmuyor, SAYILIYOR.
//      tam        = HER beslemenin okunması + sayaçta arıza olmaması.
//                   Biri düştüyse `false` — ekran "eksik ölçüm" der.
//    NİYE SUNUCUDA: native RSS/XML ayrıştırmıyor (kabuk ince kalır).
//    Beslemelerin ölçümü, listeye alınma/alınmama gerekçeleri ve
//    T24'ün neden DIŞARIDA olduğu `api/_haber.js` gündem başlığında.
//
//    ÜÇ KİPTE DE maddeler[i] =
//      { title, link, pubDate, source, type, symbol } — HAM metin.
//      type   = 'NEWS' (bu uç KAP duyurusu üretmez; küme _haber.js'te)
//      symbol = çoklu kipte satırın sembolü · tek sorgu ve gündem
//               kipinde null (serbest metin ya da genel gündem bir
//               hisseye ait değildir — uydurulmaz)
//      source = gündem kipinde beslemenin adı (yayıncı beslemeleri
//               kaynağı madde içinde VERMİYOR; boş bırakmak "kaynağı
//               ölçemedim" demek olurdu, oysa ölçüldü)
//      adet        = maddeler.length — istemci boş listeyi alan okumadan
//                    görsün.
//      tam         = sayaçta hata/zaman aşımı/kısa gövde YOK mu.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'haber_alinamadi', uyari }   (içeriden gelen
//               hata METNİ İSTEMCİYE GİTMEZ; yalnız sunucuya loglanır)
//
//  BOŞ LİSTE ARIZA DEĞİL: hiç haberi olmayan bir sorgu geçerli bir
//  besleme ile 0 madde döndürür. O hâlde 200 + `maddeler: []` +
//  `adet: 0` + `tam: true` dönüyoruz. "Haber yok" ile "ölçemedim"
//  (`tam: false`) KARIŞTIRILMIYOR — _ag.js sayaç ayrımının aynı fikri.
//
//  NE DEĞİL: bu bir DUYGU/SENTIMENT SKORU DEĞİL. Manşet metni dönüyor;
//  ondan yön çıkarmak ⚡ Nabız'ın (api/pulse.js) işi ve o mantık MOTORDA.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

// Haberin KENDİ taşıyıcısı.
//
// ÖLHÜKMÜ DEĞİŞTİ (2026-10-31/Ş8-G1): bu yorum eskiden "`_motor.js` İÇE
// ALINMIYOR: bu uç motor kurmuyor, skor okumuyor, sürüm imzası
// taşımıyor" diyordu. Artık motoru KURUYOR, çünkü haber duyarlılık
// katmanı (`scoreHeadline` + `sentiAggregate` + `sentiLabel`) motorun
// sözlüğüne ve eşiklerine bağlı. Manşet METNİ hâlâ motora bağlı
// değil; o metne verilen PUAN bağlı, bu yüzden cevap `surum` taşıyor.
// `_ag.js` yalnız motoru kurmak için alınıyor — bu uç motorun hiçbir
// AĞ çağrısını kullanmıyor, duyarlılık ELDEKİ manşetten hesaplanıyor.
import {
  haberCek, bosHaberSayac, haberTam,
  AZAMI_MADDE, VARSAYILAN_MADDE, AZAMI_HABER_SORGU, HABER_PAZARLAR,
  MADDE_ALANLARI, HABER_TURLERI,
  gundemCek, GUNDEM_YERELLER, GUNDEM_BESLEMELER, GUNDEM_BESLEME_MADDE,
  IZINLI_GUNDEM_KONAK,
} from './_haber.js';

// Sembol kapısı ORTAK: skor şeridinin kullandığı AYNI fonksiyon nesnesi
// (gerekçe _girdi.js:155 — kopya yok, ayrışma yok). Bu uç motor kurmuyor,
// yalnız GİRDİ DOĞRULAMASINI ödünç alıyor.
import { ayristir, AZAMI_SEMBOL } from './_girdi.js';

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';

// Motor kurulumu `_kesif.js:165` kalibi — YENI kalip uydurulmadi. Kurulum
// PATLARSA uc 500 donmez: duyarlilik katmani `null` kalir ve manset akisi
// AYNEN calisir (manset metni motora bagli degil). Bu BILINCLI bir
// bolunme: haberi gormek skordan daha temel.
let ENG = null;
let MOTOR_HATASI = null;
try {
  const AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
} catch (e) {
  MOTOR_HATASI = e;
}

/** Motor kuruldu mu — test bunu agsiz okuyabiliyor. */
export function motorHazir() { return !!(ENG && !MOTOR_HATASI); }

// AZAMI_ADAY'IN AYNISI (api/theme.js:224 = 14) ama IMPORT EDILMEDI:
// `theme.js` modul duzeyinde LLM anahtarini ve hiz sayacini kuruyor;
// onu buraya ice almak her haber istegine o bedeli odetirdi. Sayi
// KOPYALANDI ve kapi iki dosyanin esitligini denetliyor.
export const AZAMI_TEMA_ADAY = 14;

/**
 * `adaylar=` dizgesini ayristir. BICIM: `SEMBOL|PAZAR|ad` ucluleri,
 * `;` ile ayrilir. PAZAR bos olabilir.
 *
 * NIYE PAZAR AYRI ALAN: `/api/theme` adayi `{symbol:'ASELS',
 * market:'BIST'}` olarak veriyor - sembolde `.IS` YOK. Pazari
 * dusurup `.IS` ekini istemciye ektirmek, istemciye kural yazmak
 * olurdu (SS5.1). Normalizasyonu motor yapiyor (`themeNorm`).
 *
 * @returns {{adaylar: object[], hata: string|null}}
 */
export function temaAdaylariAyristir(ham) {
  const metin = String(ham || '').trim();
  if (!metin) return { adaylar: [], hata: null };
  const parcalar = metin.split(';').map((p) => p.trim()).filter(Boolean);
  if (parcalar.length > AZAMI_TEMA_ADAY) return { adaylar: [], hata: 'cok_aday' };
  const out = [];
  for (const p of parcalar) {
    const alan = p.split('|');
    const sym = String(alan[0] || '').trim().toUpperCase();
    const pazar = String(alan[1] || '').trim().toUpperCase();
    const ad = String(alan.slice(2).join('|') || '').trim().slice(0, 80);
    if (!/^[A-Z0-9.\-]{1,12}$/.test(sym)) return { adaylar: [], hata: 'bad_aday' };
    if (pazar && pazar !== 'BIST' && pazar !== 'US') return { adaylar: [], hata: 'bad_aday_pazar' };
    out.push({ ham: sym, pazar: pazar || null, ad: ad || null });
  }
  return { adaylar: out, hata: null };
}

/**
 * TEMA KATMANI (S8 #8a) - iki kural, ikisi de MOTORDA:
 *   (1) ILGI SUZGECI (`temaSorguSozcukleri` + `temaBaslikIlgili`):
 *       Google News RSS, genel bir ifadeye sorgu sozcuklerinin HICBIRI
 *       gecmeyen basliklarla yanit veriyor (OLCULDU 2026-10-27). Esik
 *       ">=4 harf" ve durak sozcuk listesi MOTORDA.
 *   (2) ADAY<->BASLIK ESLESMESI (`themeNewsHits`): sembol kelime-siniri
 *       ya da ad sozcugu (>=4 harf); tavan motorun kendi `max||4`u -
 *       BURADA sayi yazilmadi.
 *
 * NIYE BU KATMAN DOGDU: `/api/theme` cevabi yalniz
 * `{symbol, market, name, reason}` tasiyor; hisse<->haber iliskisi
 * UCTAN GELMIYORDU ve web onu TARAYICIDA kuruyordu. Nativede tema
 * haberi HIC YOKTU. Yeni uc acilamadi: Vercel Hobby tavani 12
 * fonksiyon ve dolu - bu yuzden kip (1) genisletildi.
 *
 * NIYE `maddeler` SUZULMEDI: mevcut sozlesme bozulurdu (ayni istek
 * daha az madde donmeye baslardi). Ilgisiz maddelerin SIRA NUMARASI
 * bildiriliyor, karari istemci veriyor.
 *
 * ESLESME DEGERI SIRA DIZISI (madde nesnesi DEGIL): ayni cevabin
 * `maddeler` dizisine indeks. Govdeyi ikiye katlamiyor ve iki kopyanin
 * birbirinden kaymasi imkansiz.
 *
 * ANAHTAR ISTEMCININ GONDERDIGI HAM SEMBOL: `/api/theme`ten gelen
 * `candidate.symbol` ne ise o. `yahoo` bicimine cevirmek istemciyi
 * anahtar uretmeye zorlardi.
 *
 * DORT HAL: alan yok = istemci `adaylar=` sormadi - `null` = motor
 * kurulamadi (OLCEMEDIM) - `adaylar: {}` = aday yoktu - bos dizi `[]`
 * = OLCTUM, o sembol hicbir baslikta gecmiyor (0 uydurma degil, olcum).
 *
 * @returns {object|null}
 */
export function temaKatmani(q, maddeler, adaylar) {
  if (!ENG) return null;
  const list = Array.isArray(maddeler) ? maddeler : [];
  const sozcukler = ENG.temaSorguSozcukleri(q);
  const ilgisiz = [];
  // Motora SIRA TASIYAN kutular veriliyor: `themeNewsHits` yalniz
  // `it.title` okuyup NESNENIN KENDISINI donduruyor, biz `_i`yi geri
  // aliyoruz. Eslesme kurali boylece motorda KALDI, burada kopyasi yok.
  const ilgili = [];
  list.forEach((m, i) => {
    const title = String((m && m.title) || '');
    if (ENG.temaBaslikIlgili(title, sozcukler)) ilgili.push({ title, _i: i });
    else ilgisiz.push(i);
  });
  const esl = {};
  for (const a of Array.isArray(adaylar) ? adaylar : []) {
    const n = ENG.themeNorm(a.ham, a.pazar);
    const vurus = ENG.themeNewsHits({ base: n.base, name: a.ad }, ilgili);
    esl[a.ham] = vurus.map((it) => it._i);
  }
  return { sozcukler, ilgisiz, adaylar: esl };
}

export {
  AZAMI_MADDE, VARSAYILAN_MADDE, AZAMI_HABER_SORGU, HABER_PAZARLAR,
  MADDE_ALANLARI, HABER_TURLERI, AZAMI_SEMBOL, ayristir,
  GUNDEM_YERELLER, GUNDEM_BESLEMELER, GUNDEM_BESLEME_MADDE,
  IZINLI_GUNDEM_KONAK,
};

// maxDuration 10 · ÖLÇÜLEN gerekçe: kip ① TEK dış istek yapıyor, kip ②
// en çok 8, kip ③ en çok 5 — AMA HEPSİ PARALEL (`Promise.all` /
// `allSettled`), yani duvar saati `_haber.js HABER_ISTEK_MS` = 6000
// zaman aşımının altında kalıyor, 8 × 6 ya da 5 × 6 değil. /api/chart
// ile AYNI kademe. /api/score'un 30-60 sn'si buraya kopyalanmadı.
export const config = { runtime: 'nodejs', maxDuration: 10 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Varsayılan pazar — ekranın çoğunluğu TR (app.js'te `hl=tr` çağrıları
// `hl=en-US` çağrılarından fazla). Sessiz varsayılan DEĞİL: cevapta
// `market` alanı hangi pazarın kullanıldığını BİLDİRİYOR.
export const VARSAYILAN_PAZAR = 'TR';

// SEMBOL PAZARI → HABER YERELİ. KAPALI SÖZLÜK, tahmin yok: solu
// `_girdi.js` PAZARLAR (['US','BIST']), sağı `_haber.js` HABER_PAZARLAR
// (['TR','US']). İki ölçülmüş küme arasında İKİ giriş var ve ikisi de
// yazılı; üçüncü bir pazar eklenirse bu sözlük DERLEME ANINDA değil,
// aşağıdaki `eslemeTam` ölçümünde patlar (sessizce 'TR'ye düşmez).
export const PAZAR_ESLEME = { BIST: 'TR', US: 'US' };

// Sözlüğün iki kümeyi de kapattığını ÖLÇ: eksik giriş sessiz varsayılan
// üretirdi. `false` çıkarsa çoklu kip o sembolü REDDEDER (aşağıda).
export const eslemeTam = (pazar) =>
  Object.prototype.hasOwnProperty.call(PAZAR_ESLEME, pazar)
  && HABER_PAZARLAR.includes(PAZAR_ESLEME[pazar]);

// Sayaçları topla. Anahtar kümesi `bosHaberSayac()`ten OKUNUYOR, elle
// yazılmıyor — taşıyıcı yarın bir sayaç eklerse buraya da gelir.
function sayacTopla(hedef, kaynak) {
  for (const k of Object.keys(hedef)) hedef[k] += Number(kaynak?.[k] || 0);
  return hedef;
}

// Motorun `sentiLabel().label` KAPALI KUMESINI makine koduna cevirir.
//
// NIYE VAR (ONCUL DEGISTI 2026-10-31/S8-G1): bu katman eskiden tele
// yalniz `cls` koyuyordu ('bull'|'neutral'|'bear') ve asagidaki baslik
// "cumleyi istemci sozlugunden secer" diyordu. OLCULDU ki secemiyor:
// motorun BES ayri cumlesi UC `cls`e dusuyor — 'Pozitif haber akisi' ile
// 'Hafif pozitif' ayni 'bull'. Istemci ikisini ayirmak icin 0.35 esigini
// BILMEK zorunda kalirdi; esik ucta da istemcide de YASAK (HAM SAYI
// KURALI). Cozum metni gondermek DEGIL: motorun kendi ciktisini SABIT
// KUMELI bir koda cevirmek. Esik hala YALNIZ motorda.
//
// BU BIR ESIK TABLOSU DEGIL: anahtarlar motorun URETTIGI cumleler, sayi
// yok. Motor cumlesini degistirirse kod `null` olur (uydurma yapmaz) ve
// uc-test ⑭j bunu AYNI TURDA yakalar — her label'in bir kodu oldugunu
// motoru CALISTIRARAK olcuyor.
const DUYARLILIK_KODU = Object.freeze({
  'Pozitif haber akışı': 'pos_guclu',
  'Hafif pozitif': 'pos_hafif',
  'Nötr haber akışı': 'notr',
  'Hafif negatif': 'neg_hafif',
  'Negatif haber akışı': 'neg_guclu',
  'Haber sinyali yok': 'yok',
});

/** Test bunu agsiz okuyabiliyor — sozlugun KAPALI oldugunu kanitlamak icin. */
export function duyarlilikKodlari() { return Object.keys(DUYARLILIK_KODU); }

// ---------------------------------------------------------------------
//  DUYARLILIK KATMANI — motorun URETTIGI haber nabzini tele koyar.
//
//  Ucu de MOTORDA (app.js -> _motor.js):
//      scoreHeadline    SENTI_POS/SENTI_NEG sozluguyle baslik basina +-puan
//      sentiAggregate   toplami -1..+1 bandina indiren yumusak sikistirma
//      sentiLabel       bandin SABIT KUMELI sinif kodu
//  Bu islev HESAP YAPMIYOR: sozluk, sabit 4, esikler (0.35/0.12) hepsi
//  motorda. YENI AG ISTEGI YOK — ELDEKI manset listesinden hesaplaniyor
//  (webin de yaptigi sey: app.js da ayni manset listesinden okuyor).
//
//  `sentiLabel().label` BILEREK TELE KONMUYOR: serbest TURKCE metin
//  ("Pozitif haber akisi"...). Gecen IKI SABIT KUME var: `cls`
//  ('bull'|'neutral'|'bear' — renk icin) ve `kod` (yukaridaki
//  DUYARLILIK_KODU kumesi — CUMLE icin). Cumleyi istemci `kod`a bakip
//  kendi sozlugunden secer; `cls` ile secmek BES cumleyi UCE dusururdu.
//
//  OLCULMUS SAPMA, SAYIYLA ORTULMEDI: web puani `title + description`
//  uzerinden hesapliyor; bu tasiyicinin madde alan kumesinde
//  (`_haber.js MADDE_ALANLARI`) `description` YOK, yalniz `title` var.
//  Yani ucun puani webin puanindan SAPAR. Alani uydurmak (bos dizge
//  eklemek) sapmayi gizlerdi; cevap `alan: [...]` ile NEYIN olculdugunu
//  BILDIRIYOR. Besleme aciklama tasimaya baslarsa duzelecek tek yer
//  `_haber.js` olur.
//
//  `basliklar` madde BASINA ham kutupluluk: `sira` = `maddeler` dizisindeki
//  indeks, `pol` = scoreHeadline().s. Madde nesnesinin ICINE yazilmadi —
//  `MADDE_ALANLARI` tasiyicinin sozlesmesi ve sessizce buyumemesi icin
//  orada yazili. Yalniz SINYAL VEREN basliklar listede (pol !== 0).
//
//  @returns {object|null} motor kurulmadiysa null ("olcemedim", sifir degil)
// ---------------------------------------------------------------------
export function duyarlilikKatmani(maddeler) {
  if (!ENG) return null;
  const list = Array.isArray(maddeler) ? maddeler : [];
  let ham = 0;
  let sinyal = 0;
  const basliklar = [];
  list.forEach((m, i) => {
    const r = ENG.scoreHeadline(String((m && m.title) || ''));
    if (!r.hits) return;
    ham += r.s;
    sinyal += r.hits;
    basliklar.push({ sira: i, pol: round6(r.s) });
  });
  const puan = ENG.sentiAggregate(ham, sinyal);
  const lab = ENG.sentiLabel(puan, sinyal);
  return {
    puan: round6(puan),
    ham: round6(ham),
    sinyal,
    basliklar,
    adet: list.length,
    cls: (lab && lab.cls) || null,
    kod: (lab && DUYARLILIK_KODU[lab.label]) || null,
    alan: ['title'],
  };
}

// Kayan nokta gurultusunu dondur (`_akis.js:50` ile ayni gerekce ve ayni
// esik): 0.1+0.2 gibi toplamlar tele 0.30000000000000004 olarak gitmesin.
function round6(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : v;
}

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export default async function handler(req, res) {
  // CORS — api/chart.js ile birebir aynı küme (yeni kalıp uydurulmadı).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }

  const sorgu = req.query || {};

  const q = String(sorgu.q ?? '').trim();
  const hamSembol = String(sorgu.symbols ?? '').trim();

  // `gundem` ANAHTARI KAPALI KÜME: '1'/'true' açar, '0'/'false'/boş
  // kapatır, BAŞKA HİÇBİR ŞEY sessizce yorumlanmaz. "evet" yazan bir
  // istemciye sessizce kip ① dönmek, istemediği gövdeyi vermek olurdu.
  const hamGundem = String(sorgu.gundem ?? '').trim().toLowerCase();
  const GUNDEM_ACIK = ['1', 'true'];
  const GUNDEM_KAPALI = ['', '0', 'false'];
  if (!GUNDEM_ACIK.includes(hamGundem) && !GUNDEM_KAPALI.includes(hamGundem)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_gundem', izinli: GUNDEM_ACIK, uyari: UYARI });
    return;
  }
  const gundem = GUNDEM_ACIK.includes(hamGundem);

  // ÜÇ KİP BİRDEN OLMAZ: hangisinin kazandığını SESSİZCE seçmek,
  // istemcinin istemediği gövdeyi dönmek olurdu. Eski `q_ve_symbols`
  // kodu KORUNDU (bugünün istemcisinin gördüğü hata değişmiyor); gündem
  // çakışması kendi kodunu alıyor.
  if (q && hamSembol) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'q_ve_symbols', uyari: UYARI });
    return;
  }
  if (gundem && (q || hamSembol)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'gundem_ve_sorgu', uyari: UYARI });
    return;
  }
  // Hiçbiri yoksa ESKİ kod ne diyorduysa o: `missing_q` (yeni kod
  // uydurulmadı, bugünün istemcisinin gördüğü hata değişmiyor).
  if (!q && !hamSembol && !gundem) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'missing_q', uyari: UYARI });
    return;
  }
  // Uzunluk tavanı YALNIZ serbest metne: `symbols`in tavanı (128)
  // `_girdi.js` kapısında ve kendi `too_long`unu kendisi döner.
  if (q && q.length > AZAMI_HABER_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_HABER_SORGU, uyari: UYARI });
    return;
  }

  // Pazar doğrulaması KİPE GÖRE: tek sorgu kipinde haber yereli
  // (TR|US), çoklu kipte SEMBOL pazarı (US|BIST) ve onu `ayristir`
  // doğruluyor — iki ayrı küme, iki ayrı kapı, karıştırılmıyor.
  let market = VARSAYILAN_PAZAR;
  if (q || gundem) {
    // Gündem kipi KENDİ ölçülmüş kümesine bakıyor (`GUNDEM_YERELLER`),
    // `HABER_PAZARLAR`a DEĞİL: bugün ikisi de ['TR','US'] ama biri
    // besleme listesinden, öteki Google News yerellerinden geliyor.
    // Aynı diziyi iki ölçüm için kullanmak, yarın biri büyüdüğünde
    // ötekini SESSİZCE büyütmek olurdu.
    const izinliYerel = gundem ? GUNDEM_YERELLER : HABER_PAZARLAR;
    market = String(sorgu.market ?? VARSAYILAN_PAZAR).trim().toUpperCase();
    if (!izinliYerel.includes(market)) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_market', izinli: izinliYerel, uyari: UYARI });
      return;
    }
  }

  // Limit SESSİZCE KIRPILMAZ: tavanı aşan istek açıkça reddediliyor
  // (chart.js'in `cok_sembol` kararıyla aynı fikir — sessiz kırpma
  // istemcinin farketmediği eksik veridir).
  let limit = VARSAYILAN_MADDE;
  if (!(sorgu.limit === undefined || sorgu.limit === null || sorgu.limit === '')) {
    const n = Number(sorgu.limit);
    if (!Number.isInteger(n) || n < 1) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_limit', azami: AZAMI_MADDE, uyari: UYARI });
      return;
    }
    if (n > AZAMI_MADDE) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'limit_buyuk', azami: AZAMI_MADDE, istenen: n, uyari: UYARI });
      return;
    }
    limit = n;
  }

  // `adaylar=` YALNIZ kip (1)de anlamli: ilgi suzgeci sorgu
  // sozcuklerinden cikiyor, kip (2)/(3)te sorgu metni YOK. Sessizce
  // yoksaymak istemciye istemedigi govdeyi vermek olurdu.
  const hamAdaylar = String(sorgu.adaylar ?? '').trim();
  let temaAdaylar = [];
  if (hamAdaylar) {
    if (gundem || hamSembol) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'adaylar_kip', uyari: UYARI });
      return;
    }
    const ayAday = temaAdaylariAyristir(hamAdaylar);
    if (ayAday.hata) {
      kisaOnbellek(res);
      res.status(400).json({ error: ayAday.hata, azami: AZAMI_TEMA_ADAY, uyari: UYARI });
      return;
    }
    temaAdaylar = ayAday.adaylar;
  }

  const t0 = Date.now();

  try {
    // ------------------------------------------------------------------
    //  ③ GÜNDEM KİPİ
    // ------------------------------------------------------------------
    if (gundem) {
      const sayac = bosHaberSayac();
      const g = await gundemCek(market, { limit, sayac });
      const maddeler = g.maddeler || [];

      // Kip ① ve ② ile AYNI pencere kuralı: TAM ve DOLU cevap 120 sn,
      // eksik ya da boş cevap 30 sn. Yeni sayı uydurulmadı.
      if (g.tam && maddeler.length) {
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=240');
      } else {
        kisaOnbellek(res);
      }

      res.status(200).json({
        // `q: null` — bu kipte serbest metin YOK (kip ②'nin aynı kararı).
        q: null,
        gundem: true,
        market,
        limit,
        maddeler,
        adet: maddeler.length,
        duyarlilik: duyarlilikKatmani(maddeler),
        // Duyarlılık puanı motorun sözlüğüne bağlı -> imza TAŞINIYOR.
        surum: { motor: IMZA, ayar: IMZA_AYAR },
        // KAYNAK BAŞINA ölçüm: düşen beslemenin ADI gövdede duruyor.
        besleme: g.besleme,
        tekrar: g.tekrar,
        sayac,
        tam: g.tam,
        ms: Date.now() - t0,
        uyari: UYARI,
      });
      return;
    }

    // ------------------------------------------------------------------
    //  ② ÇOKLU SEMBOL KİPİ
    // ------------------------------------------------------------------
    if (hamSembol) {
      // Doğrulama ORTAK kapıda; hata gövdesi OLDUĞU GİBİ geçiyor
      // (`cok_sembol`/`bad_symbol`/`too_long` burada yeniden yazılmadı).
      const ay = ayristir({ symbols: hamSembol, market: sorgu.market });
      if (ay.hata) {
        kisaOnbellek(res);
        res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
        return;
      }

      // Sözlükte karşılığı olmayan pazar SESSİZ VARSAYILANA DÜŞMEZ,
      // reddedilir: 'TR'ye düşürmek ABD hissesine Türkçe besleme
      // vermek (ya da tersi) olurdu ve istemci bunu farketmezdi.
      const kapanmayan = ay.rows.filter((r) => !eslemeTam(r.market)).map((r) => r.market);
      if (kapanmayan.length) {
        kisaOnbellek(res);
        res.status(400).json({
          error: 'bad_market', izinli: Object.keys(PAZAR_ESLEME),
          gecersiz: kapanmayan, uyari: UYARI,
        });
        return;
      }

      // PARALEL (pulse.js:530 kalıbı) + SATIR BAŞINA SAYAÇ: bir
      // sembolün zaman aşımı ötekileri "ölçemedim" göstermesin.
      const satirlar = await Promise.all(ay.rows.map(async (r) => {
        const satirSayac = bosHaberSayac();
        const s = await haberCek(r.sym, {
          market: PAZAR_ESLEME[r.market], limit, sayac: satirSayac, symbol: r.sym,
        });
        return { row: r, maddeler: s.maddeler || [], satirSayac };
      }));

      const sayac = bosHaberSayac();
      const maddeler = [];
      const semboller = [];
      for (const it of satirlar) {
        for (const m of it.maddeler) maddeler.push(m);
        sayacTopla(sayac, it.satirSayac);
        semboller.push({
          symbol: it.row.sym,
          market: it.row.market,
          adet: it.maddeler.length,
          // Satırın KENDİ ölçümü: 0 madde + tam:true = "bu hissede haber
          // yok", tam:false = "ölçemedim". İkisi karıştırılmıyor.
          tam: haberTam(it.satirSayac),
          // SATIRIN KENDİ manşetleri — çoklu kipte birleşik puan tek
          // hisseyi anlatmaz. Birleşik puan gövde kökünde AYRICA duruyor.
          duyarlilik: duyarlilikKatmani(it.maddeler),
        });
      }
      const tamCoklu = haberTam(sayac);

      if (tamCoklu && maddeler.length) {
        res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=240');
      } else {
        kisaOnbellek(res);
      }

      res.status(200).json({
        // `q: null` — bu kipte serbest metin YOK. Alanı düşürmek yerine
        // null bırakıyoruz: istemci tek bir gövde şeması okuyor ve
        // "hangi kip" sorusunu `symbols`in varlığından değil
        // `q === null`dan da okuyabiliyor.
        q: null,
        symbols: ay.rows.map((r) => r.sym),
        market: ay.market,
        limit,
        maddeler,
        adet: maddeler.length,
        semboller,
        duyarlilik: duyarlilikKatmani(maddeler),
        // Duyarlılık puanı motorun sözlüğüne bağlı -> imza TAŞINIYOR.
        surum: { motor: IMZA, ayar: IMZA_AYAR },
        sayac,
        tam: tamCoklu,
        ms: Date.now() - t0,
        uyari: UYARI,
      });
      return;
    }

    const sayac = bosHaberSayac();
    const sonuc = await haberCek(q, { market, limit, sayac });
    const maddeler = sonuc.maddeler || [];
    const tam = haberTam(sayac);

    // TAM ve DOLU cevap 120 sn; eksik ya da boş cevap 30 sn — birkaç
    // dakika sonra manşet gelmiş olabilir (chart.js'in boş seri kararı).
    if (tam && maddeler.length) {
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=240');
    } else {
      kisaOnbellek(res);
    }

    res.status(200).json({
      q,
      market,
      limit,
      maddeler,
      adet: maddeler.length,
      duyarlilik: duyarlilikKatmani(maddeler),
      // `adaylar=` sorulmadiysa alan HIC KONULMUYOR ("sormadim" ile
      // "olcemedim" ayri kalsin). Kip (2) ve (3)te de YOK: ikisinde de
      // serbest metin sorgu YOK, dolayisiyla ilgi suzgeci olculemez.
      ...(hamAdaylar ? { tema: temaKatmani(q, maddeler, temaAdaylar) } : {}),
      // Duyarlılık puanı motorun sözlüğüne bağlı -> imza TAŞINIYOR.
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      sayac,
      tam,
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    // İÇERİDEN gelen metin İSTEMCİYE GİTMEZ (yığın izi / dosya yolu /
    // adres sızmasın) — yalnız sunucu kaydına.
    console.error('api/news:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'haber_alinamadi', uyari: UYARI });
  }
}
