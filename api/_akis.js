// ===========================================================================
//  SKOR AKIŞI — tek kurulum yeri   ·   ELLE YAZILMIŞTIR (üretilmiş DEĞİL)
// ===========================================================================
//
//  NE: "bir sembolün skoru" nasıl hesaplanır — motorun hangi işlevi hangi
//  sırayla, hangi argümanla çağrılır. Motorun KENDİSİ değil; motoru çağıran
//  sıra. app.js'te bu sıra `getTaScoreFor` (:4581) ve temel sekmesinin
//  kurucularının içine gömülü duruyor.
//
//  NEDEN api/ ALTINDA: iki tüketicisi var ve ikisi de AYNI sırayı koşmak
//  zorunda —
//      · /api/score          → gerçek ağ ile
//      · tests/parity.mjs    → donmuş fikstürle, baseline.json'a karşı
//  Akış tests/ içinde kalsaydı sunucu onu göremezdi (.vercelignore tests/
//  hariç tutuyor) ve uca KOPYALANMASI gerekirdi. O gün iki akış doğar:
//  parite testi kendi kopyasının kendine uyduğunu doğrular, sunucudaki
//  sapma görünmez. Bu yüzden akış burada duruyor ve TEST onu içe alıyor —
//  baseline.json böylece sunucunun koşturduğu akışı da bekçiliyor.
//
//  ÜÇÜNCÜ TÜKETİCİ (2026-10-14): /api/recommend. Aynı sıranın ÜSTÜNE plan
//  katmanını ekliyor (levels + banda yakınlık + momentum + risk/ödül) ve
//  kendi çağrı sırasını KURMUYOR — `recommendOne` ile `scoreOne` aynı
//  `kayitHam`'ı paylaşıyor. İki uç ayrı sıra koşarsa "aynı motor, farklı
//  cevap" kapısı açılır; o kapı bu dosyanın var olma sebebiydi.
//
//  BU DOSYA ÜRETİLMİŞ DEĞİL: _motor.js app.js'ten, _ayar.js config.js'ten
//  türetilir, bu dosya türetilmez. `node tools/motor-uret.mjs` buna
//  dokunmaz; elle düzenlenir ve pariteyle korunur.
//
//  NE BİLMEZ: ağ, dosya sistemi, DOM, Node yerleşikleri. Yalnız TEK şeyle
//  konuşur —
//      eng  → buildMotor(H) çıktısı; eng._weights / eng._bench kurulu olmalı
//
//  İKİNCİ ARGÜMAN GİTTİ (2026-10-14): bir süre `K` adında ikinci bir
//  argüman daha vardı — F/K kriterinin ve FA/TA harmanının sabitleri,
//  sunucuda api/_ekran.js'ten, testte readRenderConstants()'tan. İkisi de
//  motora devredildiği gün (eng.faPeCriterion · eng.compositeBlend) o
//  argümanın taşıyacağı bir şey kalmadı: akış artık sabit TAŞIMIYOR,
//  yalnız motoru çağırıyor. Sabiti dışardan geçirmek "aynı motor, farklı
//  eşik" kazasının kapısıydı; kapandı.
//
//  HAM SAYI KURALI: burada hiçbir şey `Intl` ile biçimlenmez. Biçimlendirme
//  istemciye ait (BAGIMLILIK_GRAFIGI.md §5.1) — sunucu biçimlerse para
//  birimi ve ondalık ayracı sunucunun yerel ayarına kilitlenir.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

/**
 * Kayan nokta gürültüsünü dondur: 1e-9 düzeyinde fark "skor değişti" demek
 * değil. Parite karşılaştırması bu yuvarlamanın ÜSTÜNDE yapılıyor.
 */
export function round6(v) {
  if (v == null || typeof v !== 'number' || !isFinite(v)) return v == null ? null : v;
  return Math.round(v * 1e6) / 1e6;
}

// ---------------------------------------------------------------------
//  TA'nın HAM koşusu — getTaScoreFor (app.js:4581) ile BİREBİR aynı yol:
//  5y/1d sembol mumları + 5y/1d endeks mumları (RAW) → computeVadeScore.
//
//  NEDEN AYRI BİR İŞLEV (2026-10-14): `scoreTA` motor sonucunu BİLEREK
//  daraltıyor — `levels` DÖNDÜRMÜYOR. /api/recommend ise tam `levels`'a ve
//  motorun plan katmanının okuduğu `score` (0-100) / `adxVal` alanlarına
//  ihtiyaç duyuyor. İki seçenek vardı:
//    ① scoreTA'nın çıktısını genişletmek — /api/score'un İSTEMCİ
//       SÖZLEŞMESİNİ ve parite anlık görüntüsünü değiştirirdi;
//    ② ham koşuyu dışa almak, daraltmayı yerinde bırakmak.
//  ② seçildi: scoreTA'nın döndürdüğü nesne harfiyen aynı kaldı.
//
//  MUMLAR PAHALI: sembol başına BİR kez koşulur, iki tüketici (skor yüzeyi
//  ve plan katmanı) aynı ham sonucu paylaşır. _ag.js'in `birKez`'i yalnız
//  ENDEKS mumlarını tekilliyor; sembol mumunu iki kez istemek iki indirme
//  demek olurdu.
// ---------------------------------------------------------------------
async function taHam(eng, sym, market, vade) {
  const cfg = (eng._weights || {})[vade];
  if (!cfg || cfg.intraday) return { why: 'vade gunluk degil' };
  let daily = null, bench = null;
  try { daily = (await eng.fetchYahooOHLC(sym, market, '5y', '1d')).candles; }
  catch (e) { return { why: 'mum alinamadi: ' + e.message }; }
  const bsym = (eng._bench || {})[market];
  if (bsym) {
    try { bench = (await eng.fetchYahooOHLC(bsym, 'RAW', '5y', '1d')).candles; }
    catch (e) { bench = null; } // app.js de aynısını yapar: RS devre dışı, skor normalize olur
  }
  const r = eng.computeVadeScore(daily, vade, undefined, bench);
  if (!r) return { why: 'computeVadeScore null' };
  return { r, daily, bench };
}

/**
 * Ham TA sonucunun DARALTILMIŞ yüzeyi — /api/score'un döndürdüğü şey.
 * Alan kümesi değişirse istemci sözleşmesi değişir; dikkat.
 */
function taYuzey(ham) {
  const { r, daily, bench } = ham;
  return {
    score: round6(r.score),
    raw: round6(r.raw),
    label: r.label,
    cls: r.cls,
    regime: r.regime,
    adx: round6(r.adxVal),
    bars: daily.length,
    benchBars: bench ? bench.length : 0,
    // Kırılım: parite bozulursa HANGİ göstergenin kaydığını söyler.
    breakdown: (r.breakdown || []).map((b) => ({ key: b.key, score: round6(b.score), weight: round6(b.weight) })),
  };
}

// ---------------------------------------------------------------------
//  TA skoru — ham koşu + daraltma. Üç başarısızlık yolunun hepsi
//  `{ score: null, why }` döndürüyor (devretmeden önce de böyleydi).
// ---------------------------------------------------------------------
export async function scoreTA(eng, sym, market, vade) {
  const ham = await taHam(eng, sym, market, vade);
  return ham.r ? taYuzey(ham) : { score: null, why: ham.why };
}

// ---------------------------------------------------------------------
//  FA skoru — ABD: secFetchModel + motorun F/K kriteri.
//  F/K eki artık MOTORDA (eng.faPeCriterion) — ekran da aynısını çağırıyor.
// ---------------------------------------------------------------------
export async function scoreFaUS(eng, sym, net) {
  let price = null;
  try { price = (await eng.fetchYahooOHLC(sym, 'US', '1y', '1d')).meta.regularMarketPrice; }
  catch (e) { price = null; }
  if (net && net.setSecSymbol) net.setSecSymbol(sym);
  let sec = null;
  try { sec = await eng.secFetchModel(sym); } catch (e) { sec = null; }
  if (!sec) return { score: null, why: 'secFetchModel null', price: null };

  const criteria = sec.criteria.slice();
  const eps = sec.metrics.eps;
  let pe = null;
  if (price != null && eps) {
    pe = price / eps;
    // `note` boş: uç nokta ham sayı döndürür, cümle istemcinin işi.
    criteria.push(eng.faPeCriterion(pe, ''));
  }
  const fa = eng.computeFaScore(criteria);
  return {
    score: round6(fa.score), present: round6(fa.present), total: round6(fa.total),
    price: round6(price), eps: round6(eps), pe: round6(pe),
    criteria: criteria.map((c) => ({ key: c.key, weight: round6(c.weight), score: round6(c.score) })),
  };
}

// ---------------------------------------------------------------------
//  FA skoru — BIST: İş Yatırım mali tablo → bistFundamentalModel.
//  DİKKAT: F/K eki YOK (BIST'te kriterler mali tablodan kuruluyor).
// ---------------------------------------------------------------------
export async function scoreFaBIST(eng, sym, maliRaw) {
  let meta = null;
  try { meta = (await eng.fetchYahooOHLC(sym, 'BIST', '1y', '1d')).meta; }
  catch (e) { meta = null; }
  if (!maliRaw) return { score: null, why: 'mali tablo yok', price: null };
  const mali = eng.parseIsMali(maliRaw);
  const model = eng.bistFundamentalModel(mali, meta);
  const fa = eng.computeFaScore(model.criteria);
  return {
    score: round6(fa.score), present: round6(fa.present), total: round6(fa.total),
    price: round6(meta && meta.regularMarketPrice),
    years: mali.years,
    criteria: model.criteria.map((c) => ({ key: c.key, weight: round6(c.weight), score: round6(c.score) })),
  };
}

// ---------------------------------------------------------------------
//  Bileşke — app.js:4781 ile aynı: 3×3 konumlama + ağırlıklı harman.
// ---------------------------------------------------------------------
export function composite(eng, faScore, taScore) {
  if (faScore == null || taScore == null) return { band: null, why: 'eksik skor' };
  const fb = eng.faBand(faScore), tb = eng.taBand(taScore);
  const cell = eng.COMPOSITE_MATRIX[fb + ':' + tb];
  const blended = eng.compositeBlend(faScore, taScore);
  return {
    faBand: fb, taBand: tb,
    band: cell ? cell.band : null,
    label: cell ? cell.label : null,
    blended: round6(blended),
    blendedShown: Math.round(blended), // kullanıcının gördüğü tam sayı
  };
}

// ---------------------------------------------------------------------
//  Bir sembolün TAM kaydı (ham): TA + FA + bileşke, YANINDA motorun ham TA
//  sonucu. `scoreOne` hamın yalnız KAYDINI kullanır, `recommendOne` ikisini
//  — böylece mumlar sembol başına bir kez iner (gerekçe taHam'da).
//
//  BIST mali tablosunu bu akış KENDİ ÇEKMEZ — çağıran verir. Sunucu canlı
//  `eng.fetchIsYatirimMali` geçer, parite testi diskteki fikstürü. İkisi de
//  aynı `scoreFaBIST`'e düşer; "veriyi nereden aldım" sorusu akışın dışında
//  kalınca testin canlı ağa sızma yolu da kapanmış oluyor.
//
//  @param {object} eng   buildMotor(H) çıktısı (_weights / _bench kurulu)
//  @param {{sym:string, market:string}} row
//  @param {string} vade  'kisa' | 'orta' | 'uzun'  ('gunici' intraday → TA null)
//  @param {object} [opt]
//  @param {(sym:string)=>Promise<object|null>} [opt.getMali] BIST mali tablo çözücü
//  @param {{setSecSymbol?:Function}} [opt.net] SEC kabuğuna sembolü bildirir (test)
// ---------------------------------------------------------------------
async function kayitHam(eng, row, vade, opt = {}) {
  const { sym, market } = row;
  const ham = await taHam(eng, sym, market, vade);
  const ta = ham.r ? taYuzey(ham) : { score: null, why: ham.why };
  let fa;
  if (market === 'BIST') {
    const mali = opt.getMali ? await opt.getMali(sym) : null;
    fa = await scoreFaBIST(eng, sym, mali);
  } else {
    fa = await scoreFaUS(eng, sym, opt.net);
  }
  return {
    kayit: { sym, market, ta, fa, composite: composite(eng, fa.score, ta.score) },
    r: ham.r || null,
  };
}

/**
 * /api/score'un sembol kaydı. Alan kümesi ve SIRASI istemci sözleşmesidir.
 */
export async function scoreOne(eng, row, vade, opt = {}) {
  return (await kayitHam(eng, row, vade, opt)).kayit;
}

/**
 * Ağaçtaki her SAYIYI round6'dan geçir; dize / boolean / null olduğu gibi
 * kalsın. Alan adı LİSTELEMEZ ve bilerek: motor plana yeni bir alan
 * eklediğinde burada güncellenmeyi bekleyen bir liste olmadığı için o alan
 * sessizce düşmüyor. (round6 sonlu olmayan sayıyı olduğu gibi döndürür —
 * NaN/Infinity JSON'da zaten null olur.)
 */
function hamYuvarla(v) {
  if (typeof v === 'number') return round6(v);
  if (Array.isArray(v)) return v.map(hamYuvarla);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = hamYuvarla(v[k]);
    return o;
  }
  return v;
}

// ---------------------------------------------------------------------
//  PLAN KATMANI — motorun ÜRETTİĞİ planı tele koyar.
//
//  Dördünün hepsi MOTORDA (app.js → _motor.js, 2026-10-14/D1):
//      levels              computeVadeScore'un dönüşünde hazır
//      buyZoneProximity    fiyat alım bandına göre nerede
//      momentumInfo        pahalı ama trend güçlüyse kademeli giriş bölgesi
//      planRiskReward      kâr-al mesafesi · negatif kırılma katı · R/Ö
//  Bu işlev HESAP YAPMIYOR: eşik, çarpan, ATR katsayısı taşımıyor; yalnız
//  motoru çağırıp sayıyı yuvarlıyor. Bir eşik buraya yazılırsa parite testi
//  onu GÖRMEZ ve sunucu ile ekran sessizce ayrışır.
//
//  `anchorSrc` BİLEREK TELE KONMUYOR. `levels.anchorSrc` serbest TÜRKÇE
//  metin ('VP değer tabanı', 'SMA200 (ana trend)', 'ATR izdüşümü', 'yakın
//  destek'...) — HAM SAYI KURALI'nın (BAGIMLILIK_GRAFIGI.md §5.1) izin
//  verdiği şey SABİT KÜMELİ makine kodu, biçimlenmiş cümle değil. Onu
//  makine koduna çevirmek bir eşleme TABLOSU gerektirirdi; tablo burada
//  dursa akış sabit taşımaya başlar, motorda dursa app.js değişir —
//  ikisi de bu adımın kapsamı dışında. Niteliği `anchorKind` taşıyor
//  ('sabit' | 'kaygan' | 'projeksiyon' — üç değerli sabit küme).
//
//  @param {object} eng   buildMotor(H) çıktısı
//  @param {object|null} r  computeVadeScore'un HAM dönüşü
//  @param {string} vade  momentum eşikleri vadeye göre (motorda yazılı)
//  @returns {object|null} r yoksa null ("TA koşmadı", boş plan değil)
// ---------------------------------------------------------------------
export function planKatmani(eng, r, vade) {
  if (!r || !r.levels) return null;
  const { anchorSrc, ...seviye } = r.levels; // eslint-disable-line no-unused-vars
  return {
    seviye: hamYuvarla(seviye),
    yakinlik: hamYuvarla(eng.buyZoneProximity(r)),
    momentum: hamYuvarla(eng.momentumInfo(r, vade)),
    riskOdul: hamYuvarla(eng.planRiskReward(r.levels)),
  };
}

// ---------------------------------------------------------------------
//  Bir sembolün TAM ÖNERİ kaydı: skor kaydı + plan katmanı.
//  `scoreOne`'un döndürdüğü her alan aynı adla ve aynı sırada duruyor;
//  üstüne tek bir alan ekleniyor (`plan`). Böylece /api/recommend'i
//  tüketen istemci /api/score'un çözücüsünü yeniden kullanabiliyor.
// ---------------------------------------------------------------------
export async function recommendOne(eng, row, vade, opt = {}) {
  const { kayit, r } = await kayitHam(eng, row, vade, opt);
  return { ...kayit, plan: planKatmani(eng, r, vade) };
}
