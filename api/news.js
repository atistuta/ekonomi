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

// Haberin KENDİ taşıyıcısı. `_ag.js` / `_motor.js` / `_ayar.js` İÇE
// ALINMIYOR: bu uç motor kurmuyor, skor okumuyor, sürüm imzası
// taşımıyor — çünkü manşet metni motorun imzasına bağlı değil.
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
