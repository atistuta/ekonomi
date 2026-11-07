// Yahoo Finance "fundamentals" TASIYICISI — artik kendi basina bir rota DEGIL.
// Genel yol AYNI kaldi: https://<app>.vercel.app/api/yfin?symbols=NVDA,ASELS.IS
//
// NEDEN TASIYICIYA DONDU: Vercel Hobby plani bir deploy'a en fazla 12
// serverless fonksiyon aliyor. api/ altinda 13 rota olmustu (news.js 13.'ydi)
// ve 2026-10-19'dan beri HER deploy "Deploying outputs" adiminda sessizce
// patliyordu. Hatanin sozu sozune (vercel deploy preview ile olculdu):
//   "No more than 12 Serverless Functions can be added to a Deployment on
//    the Hobby plan. Create a team (Pro plan) to deploy more."
// `_` ile baslayan dosyalar Vercel'de rotaya CEVRILMEZ -> fonksiyon sayilmaz.
// Bu dosya artik api/proxy.js icinden cagriliyor; /api/yfin yolunu
// vercel.json'daki rewrite /api/proxy?__rota=yfin'e tasiyor. Motor uclarinin
// 9'una (score/recommend/analyze/theme/compare/causal/chart/pulse/news)
// DOKUNULMADI; onlar tests/uc-test.mjs tarafindan dosya dosya denetleniyor.
//
// ESLESME: proxy ve yfin ikisi de I/O-bound dis rolesi ve ikisi de
// maxDuration 30 idi -> ayni butcede birlesiyorlar. Yan fayda: asagidaki
// modul duzeyi CRUMB onbellegi artik proxy trafigiyle de sicak kaliyor.
// Yahoo v10 quoteSummary artık crumb+cookie ister (aksi halde 401 "Invalid Crumb").
// Bu handshake tarayıcıdan/CORS proxy'den yapılamaz; sunucu tarafında yapıp
// P/E, forward P/E, PEG, sektör, marj vb. temel kıyas metriklerini temiz JSON döneriz.

// config BURADAN KALKTI: Vercel yalniz rota dosyalarinin `config`'ini okur,
// bu dosya rota degil. Birlesik fonksiyonun butcesi api/proxy.js'te duruyor
// (runtime nodejs, maxDuration 30 — yfin'in eski degeriyle AYNI).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const MODULES = 'summaryDetail,defaultKeyStatistics,summaryProfile,financialData,price';
// deep=1 → bilanço takvimi + analist konsensüsü (Bilanço Öncesi Paneli için)
const MODULES_DEEP = MODULES + ',calendarEvents,earningsTrend';

// ---------------------------------------------------------------------
// KIYAS EKSTREMI (S8 #10a) — satir bazli "en iyi / en kotu" sutun imi.
//
// NIYE BU TASIYICIDA: kiyas tablosunu besleyen kunye dizisi burada
// uretiliyor (`fetchOne`). Ekran (app.js:13077) ayni imi `rowExtrema` ile
// KENDI icinde hesapliyordu; native kart o hesabi YAPAMAZ cunku "hangi
// yon daha iyi" bir KARSILASTIRMA KURALI ve istemcide esik/kiyas yasak
// (BAGIMLILIK_GRAFIGI §5.1).
//
// BOLUNME: karsilastirmanin KENDISI motorda (`rowExtrema`, dilim
// `kiyas-uc`), satir TARIFI burada. Tarif bir esik/agirlik tablosu DEGIL
// — hangi alanin hangi yonde "daha iyi" sayildigini bildiren makine
// sozlugu; icinde SAYI yok. app.js'teki COMPARE_ROWS'tan BILEREK
// kopyalanmadi: oradaki satirlar Turkce `label`/`hint` ve
// `xf: trIndustry` fonksiyon referansi tasiyor, ikisi de tele cikmamali.
// KOPYA DEGIL, DAR IZDUSUM: yalniz yonu OLAN 11 satir, yalniz
// key/type/dir ile. `type` gerekiyor cunku motor negatif degerlemeyi
// (F/K < 0 = zarar) YALNIZ ratio/ratio2 satirinda atiyor.
export const KIYAS_SATIRLARI = Object.freeze([
  Object.freeze({ key: 'trailingPE', type: 'ratio', dir: 'low' }),
  Object.freeze({ key: 'forwardPE', type: 'ratio', dir: 'low' }),
  Object.freeze({ key: 'peg', type: 'ratio2', dir: 'low' }),
  Object.freeze({ key: 'priceToBook', type: 'ratio', dir: 'low' }),
  Object.freeze({ key: 'priceToSales', type: 'ratio', dir: 'low' }),
  Object.freeze({ key: 'evEbitda', type: 'ratio', dir: 'low' }),
  Object.freeze({ key: 'profitMargin', type: 'pct', dir: 'high' }),
  Object.freeze({ key: 'returnOnEquity', type: 'pct', dir: 'high' }),
  Object.freeze({ key: 'revenueGrowth', type: 'pct', dir: 'high' }),
  Object.freeze({ key: 'debtToEquity', type: 'd2e', dir: 'low' }),
  Object.freeze({ key: 'dividendYield', type: 'pct', dir: 'high' }),
]);

// MOTOR KURULUMU TEMBEL — ve bu bir USLUP secimi DEGIL, OLCULMUS bir
// kisit: `api/proxy.js:47` bu dosyayi STATIK ice aliyor, _kesif.js'i ise
// BILEREK dinamik (proxy.js:42-46: "DUZ /api/proxy?url= trafigi de her
// soguk baslangicta o kurulumu ODERDI"). Modul duzeyinde `buildMotor`
// cagirsaydim tam o bedeli geri getirmis olurdum. Boylece kurulum YALNIZ
// `?symbols=` kipinde, ilk cagrida bir kez odeniyor; ESM modul onbellegi
// ikinci cagrida yineletmiyor.
let ENG;                    // undefined = HENUZ DENENMEDI · null = kurulamadi
let MOTOR_HATASI = null;

async function motorKur() {
  if (ENG !== undefined) return ENG;
  try {
    const [{ buildMotor }, ayar, ag] = await Promise.all([
      import('./_motor.js'), import('./_ayar.js'), import('./_ag.js'),
    ]);
    const AG = ag.canliAg({ taWeights: ayar.TA_WEIGHTS, taBenchmark: ayar.TA_BENCHMARK });
    ENG = buildMotor(AG.H);
  } catch (e) {
    MOTOR_HATASI = e;
    ENG = null;
  }
  return ENG;
}

/** Motor kurulabiliyor mu — test bunu agsiz okuyabiliyor. */
export async function motorHazir() {
  return !!(await motorKur()) && !MOTOR_HATASI;
}

/**
 * Satir bazli ekstrem — SEMBOL ADIYLA, indeksle DEGIL.
 *
 * NIYE SEMBOL: ekran ayni diziyi cizdigi icin indeksle calisabiliyor;
 * native kart olculemeyen kunyeleri SUZUYOR (`kunyeler.filter(k => k.ok)`),
 * yani indeks sessizce kayardi. Sembol tasimak o kaymayi imkansiz kiliyor.
 *
 * Anahtar, 2'den az GECERLI deger varsa HIC KONULMAZ (motorun `{}`
 * donusu) — "olculemedi" ile "ekstrem yok" ayri kalsin.
 *
 * ILAN EDILEN SAPMA: en iyi ile en kotu AYNI sembole dustugunde (butun
 * degerler esit) anahtar atiliyor. Ekran o durumda ayni hucreye iki
 * sinifi birden basiyor; "hem en iyi hem en kotu" bir ime cevrilemez,
 * esitlikte ekstrem YOKTUR demek daha dogru.
 *
 * `null` donusu = motor kurulamadi, yani OLCEMEDIM. Bos nesne `{}` =
 * "olctum, hicbir satirda ekstrem cikmadi" — ayri iki durum.
 */
export async function ekstremKatmani(kunyeler) {
  const eng = await motorKur();
  if (!eng) return null;
  const liste = Array.isArray(kunyeler) ? kunyeler : [];
  const cikti = {};
  for (const satir of KIYAS_SATIRLARI) {
    const e = eng.rowExtrema(satir, liste);
    if (e == null || e.best == null || e.worst == null) continue;
    const eniyi = liste[e.best] && liste[e.best].symbol;
    const enkotu = liste[e.worst] && liste[e.worst].symbol;
    if (!eniyi || !enkotu || eniyi === enkotu) continue;
    cikti[satir.key] = { yon: satir.dir, eniyi, enkotu };
  }
  return cikti;
}

/**
 * Bilanco senaryosu — Boga/Baz/Ayi. HESAP MOTORDA (`earnScenario`,
 * dilim `earn-senaryo`): tepki katsayisi K=2.0 ve tavan CAP=0.40 orada,
 * BURADA ve istemcide YOK.
 *
 * NIYE BU KATMAN DOGDU: envanterde (api/_kesif.js:1061) "senaryo
 * matematigi BICIMLEME, uca girmez" yaziyordu. OLCULDU, yanlis: icinde
 * katsayi, tavan ve dagilim aritmetigi var. Yani web bu sayiyi
 * TARAYICIDA uretiyordu ve ince istemci ya formulu kopyalayacak (§5.1
 * ihlali) ya da ozellik eksik kalacakti.
 *
 * NIYE KUNYENIN ICINE DEGIL AYRI ALAN: `results` sozlesmesi
 * (`YfinKunye`) buyumesin — `ekstrem` ile AYNI gerekce, ayni bicim.
 * Anahtar SEMBOL (indeks degil): native kart olculemeyen kunyeleri
 * suzuyor.
 *
 * YALNIZ `deep=1`: senaryo `earnings` dagilimindan cikiyor, o da yalniz
 * MODULES_DEEP ile geliyor. `deep` yoksa katman HIC calismaz ve alan
 * `{}` olur — "sormadim" ile "olcemedim" karismasin diye `null` DEGIL.
 *
 * DORT HAL: alan yok = uc gondermiyor · `null` = motor kurulamadi
 * (OLCEMEDIM) · `{}` = olctum, hicbir sembolde senaryo cikmadi · sembol
 * anahtari = ya `{ tight: true }` (dagilim sifir — motorun makine kodu,
 * ucu uydurulmus %0 kutusuyla doldurmuyoruz) ya da uc kutu ham sayi.
 * Senaryo uretilemeyen sembolun anahtari HIC KONULMAZ.
 */
export async function senaryoKatmani(kunyeler) {
  const eng = await motorKur();
  if (!eng) return null;
  const liste = Array.isArray(kunyeler) ? kunyeler : [];
  const cikti = {};
  for (const k of liste) {
    if (!k || !k.ok || !k.symbol) continue;
    const sc = eng.earnScenario(k);
    if (sc == null) continue;
    cikti[k.symbol] = sc;
  }
  return cikti;
}

// Crumb+cookie'yi fonksiyon ömrü boyunca (warm lambda) tekrar kullan.
let CRUMB = null; // { cookie, crumb, ts }
async function getCrumb(force) {
  if (!force && CRUMB && (Date.now() - CRUMB.ts) < 30 * 60 * 1000) return CRUMB;
  const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } }).catch(() => null);
  const cookie = (r1 && r1.headers.get('set-cookie')) || '';
  const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie },
  });
  const crumb = (await cr.text()).trim();
  if (!crumb || /[<{]/.test(crumb)) throw new Error('crumb alınamadı');
  CRUMB = { cookie, crumb, ts: Date.now() };
  return CRUMB;
}

const num = (o) => (o && typeof o.raw === 'number') ? o.raw : null;

// calendarEvents + earningsTrend → sonraki bilanço tarihi + analist konsensüsü.
// epsAvg/High/Low & revAvg → calendarEvents.earnings; analist sayısı & YoY büyüme → earningsTrend "0q".
function parseEarnings(R) {
  const ce = R.calendarEvents && R.calendarEvents.earnings;
  const dates = ce && Array.isArray(ce.earningsDate) ? ce.earningsDate : [];
  const ts = dates.map((d) => num(d)).filter((x) => x != null).sort((a, b) => a - b)[0] || null;
  // earningsTrend "0q" = içinde bulunulan/yaklaşan çeyrek → analist sayısı + YoY büyüme
  const trend = (R.earningsTrend && Array.isArray(R.earningsTrend.trend)) ? R.earningsTrend.trend : [];
  const q0 = trend.find((t) => t && t.period === '0q') || null;
  const ee = q0 && q0.earningsEstimate || {}, re = q0 && q0.revenueEstimate || {};
  const epsAvg = num(ce && ce.earningsAverage) ?? num(ee.avg);
  const epsHigh = num(ce && ce.earningsHigh) ?? num(ee.high);
  const epsLow = num(ce && ce.earningsLow) ?? num(ee.low);
  if (ts == null && epsAvg == null) return null;
  return {
    ts,                                        // saniye (unix)
    estimate: !!(ce && ce.isEarningsDateEstimate), // tarih tahmini mi (kesinleşmemiş)
    epsAvg, epsHigh, epsLow,
    revAvg: num(ce && ce.revenueAverage) ?? num(re.avg),
    revHigh: num(ce && ce.revenueHigh) ?? num(re.high),
    revLow: num(ce && ce.revenueLow) ?? num(re.low),
    numAnalysts: num(ee.numberOfAnalysts) ?? num(re.numberOfAnalysts),
    epsGrowth: num(ee.growth),                 // beklenen YoY kâr büyümesi (kesir)
    revGrowth: num(re.growth),                 // beklenen YoY gelir büyümesi (kesir)
  };
}

async function fetchOne(sym, ck, deep) {
  const mods = deep ? MODULES_DEEP : MODULES;
  const u = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=${mods}&crumb=${encodeURIComponent(ck.crumb)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA, 'Cookie': ck.cookie } });
  if (r.status === 401) { const e = new Error('401'); e.needCrumb = true; throw e; }
  const j = await r.json().catch(() => null);
  const R = j?.quoteSummary?.result?.[0];
  if (!R) return { symbol: sym, ok: false };
  const sd = R.summaryDetail || {}, ks = R.defaultKeyStatistics || {},
        pr = R.summaryProfile || {}, fd = R.financialData || {}, p = R.price || {},
        ce = R.calendarEvents || {}; // yalnız deep=1'de dolu (MODULES_DEEP)
  return {
    symbol: sym, ok: true,
    ...(deep ? { earnings: parseEarnings(R) } : {}),
    name: p.shortName || p.longName || null,
    currency: p.currency || null,             // işlem/kotasyon para birimi (ADR → USD)
    finCurrency: fd.financialCurrency || null, // raporlama para birimi (gelir/finansallar bunda)
    sector: pr.sector || null,
    industry: pr.industry || null,
    bizSummary: pr.longBusinessSummary || null, // şirketin ne yaptığı (sektör etiketinin ötesi)
    country: pr.country || null,
    website: pr.website || null,
    trailingPE: num(sd.trailingPE),
    forwardPE: num(sd.forwardPE),
    peg: num(ks.pegRatio) ?? num(ks.trailingPegRatio),
    priceToBook: num(ks.priceToBook),
    priceToSales: num(sd.priceToSalesTrailing12Months),
    evEbitda: num(ks.enterpriseToEbitda),
    marketCap: num(sd.marketCap) ?? num(p.marketCap),
    profitMargin: num(fd.profitMargins),
    returnOnEquity: num(fd.returnOnEquity),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth),
    debtToEquity: num(fd.debtToEquity),
    dividendYield: num(sd.dividendYield),
    // --- TEMETTÜ ALANLARI ---
    // Moduller (summaryDetail / defaultKeyStatistics / calendarEvents) zaten ISTENIYORDU
    // ama okunmuyordu. Esleme Yahoo v10 quoteSummary govdesinden OLCULDU.
    // num() kurali: olculemeyen alan null doner, ASLA 0. Cunku Number(null)===0 ve
    // 0 basmak "temettu dagitmiyor" ile "veri yok"u ayni gosterir (olculmus hata).
    // BIRIM TUZAGI: oran mi puan mi karisik — her alanin yanina yazildi. Istemci
    // bicimlendirir; burada yuzdeye cevirme/yuvarlama YAPILMAZ (ham sayi kurali).
    dividendRate: num(sd.dividendRate),                               // hisse basina yillik temettu (currency birimi)
    payoutRatio: num(sd.payoutRatio),                                 // 0–1 ORAN
    dividendYield5y: num(sd.fiveYearAvgDividendYield),                // DIKKAT: YUZDE PUANI (2.41 = %2,41), oran DEGIL
    trailingAnnualDividendRate: num(sd.trailingAnnualDividendRate),   // son 12 ayda fiilen odenen, hisse basina
    trailingAnnualDividendYield: num(sd.trailingAnnualDividendYield), // 0–1 ORAN
    lastDividendValue: num(ks.lastDividendValue),                     // son tek temettu tutari, hisse basina
    lastDividendTs: num(ks.lastDividendDate),                         // SANIYE (unix)
    // Temettu kesilme (ex-date): summaryDetail birincil, calendarEvents yedek (yedek yalniz deep=1'de dolu).
    exDividendTs: num(sd.exDividendDate) ?? num(ce.exDividendDate),   // SANIYE (unix)
    // Odeme tarihi YALNIZ calendarEvents'ta var → deep=1 olmadan olculemez, o yuzden null.
    dividendTs: deep ? num(ce.dividendDate) : null,                   // SANIYE (unix)
    // ILAN TARIHI (declaration date) Yahoo quoteSummary'de YOK — uydurulmadi, alan da acilmadi.
    // TEMETTU GECMISI de burada YOK: ayri cagri gerekiyor
    // (v8/finance/chart?events=div → events.dividends). Bu serit disi, tasinmadi.
    // --- 52 HAFTA BANDI ---
    // Modul (summaryDetail) ZATEN isteniyordu, iki alan okunmuyordu: ek
    // ust-kaynak istegi YOK, ayni govdeden geliyor.
    // HAM FIYAT, `currency` biriminde — `price` ile AYNI olcek.
    // BANT ICINDEKI KONUM (yuzde kac) BURADA HESAPLANMIYOR: o bir turetme
    // ((price-lo)/(hi-lo)); ikizi app.js:5918 ve app.js:6259 onu EKRANDA
    // kuruyor. Uc yalniz iki ham siniri dondurur.
    // IKIZ NOT: ayni iki alan `/api/chart`in `kunye`sinde de var
    // (api/chart.js:139, Yahoo chart meta'sindan) — adlar BILEREK ayni.
    fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),                       // currency birimi
    fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),                         // currency birimi
    price: num(p.regularMarketPrice) ?? num(sd.previousClose),
  };
}

/**
 * KÜNYE ÇEKİMİ — crumb tazeleme ve BİR KEZLİK yineleme burada.
 *
 * NİYE AYRI FONKSİYON (ölçüldü 2026-11-05): bu döngü `yfinHandler`ın
 * İÇİNDE duruyordu, yani HTTP isteği olmadan çağrılamıyordu. `/api/katalizor`
 * ucu ABD temettü tarihini AYNI künyeden okuyor; döngüyü oraya KOPYALAMAK
 * ikinci bir Yahoo yolu açmak, iki yerde ayrışan crumb mantığı demekti.
 * Gövde BİREBİR taşındı — `yfinHandler` artık bu fonksiyonu çağırıyor.
 *
 * `ok: false` = o sembol ÖLÇÜLEMEDİ. Dizi sırası girdi sırasıyla aynı.
 *
 * @param {string[]} semboller  Yahoo sembolleri (BIST için '.IS' ekli)
 * @param {{deep?:boolean}} sec
 * @returns {Promise<object[]>}
 */
export async function kunyeCek(semboller, sec = {}) {
  const deep = !!sec.deep;
  const liste = Array.isArray(semboller) ? semboller : [];
  let ck = await getCrumb(false);
  const out = [];
  for (const sym of liste) {
    try {
      out.push(await fetchOne(sym, ck, deep));
    } catch (e) {
      if (e.needCrumb) { // crumb bayatladı → tazele, bir kez daha dene
        ck = await getCrumb(true);
        try { out.push(await fetchOne(sym, ck, deep)); }
        catch (_) { out.push({ symbol: sym, ok: false }); }
      } else {
        out.push({ symbol: sym, ok: false });
      }
    }
  }
  return out;
}

export async function yfinHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // ?search=<q> → Yahoo autocomplete: bir yazıyı borsasıyla çöz (BIST .IS mi ABD mi).
  // Evrensel arama kutusunun hisse çözümleyicisi bunu kullanır. Crumb gerekmez.
  const searchQ = (req.query?.search || '').toString().trim();
  if (searchQ) {
    try {
      const u = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQ)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&lang=en-US&region=US`;
      const r = await fetch(u, { headers: { 'User-Agent': UA } });
      const j = await r.json().catch(() => null);
      const quotes = (j && Array.isArray(j.quotes)) ? j.quotes : [];
      const out = quotes.map((q) => ({
        symbol: q.symbol || null,
        name: q.shortname || q.longname || null,
        exch: q.exchange || null,
        exchDisp: q.exchDisp || null,
        type: q.quoteType || null,
      })).filter((q) => q.symbol);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({ query: searchQ, quotes: out });
    } catch (e) {
      res.setHeader('Cache-Control', 'public, max-age=30');
      res.status(502).json({ error: String(e && e.message || e), quotes: [] });
    }
    return;
  }

  const raw = (req.query?.symbols || '').toString().trim();
  if (!raw) { res.status(400).json({ error: 'Missing ?symbols=' }); return; }
  const symbols = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
  const deep = !!(req.query?.deep);

  try {
    // Döngü `kunyeCek`e taşındı — `/api/katalizor` AYNI yolu kullanıyor.
    const out = await kunyeCek(symbols, { deep });
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    // `ekstrem` AYRI bir alan: `results` sozlesmesi BUYUMEDI, kunye
    // nesnelerinin icine im yazilmadi.
    res.status(200).json({
      results: out,
      ekstrem: await ekstremKatmani(out),
      // `deep` yoksa `earnings` HIC GELMIYOR, dolayisiyla senaryo da
      // olculemez. Bos nesne donmek "olctum, cikmadi" demek olurdu —
      // yanlis. Bu kipte alan HIC KONULMUYOR.
      ...(deep ? { senaryo: await senaryoKatmani(out) } : {}),
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
