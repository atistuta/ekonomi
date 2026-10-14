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
//  TA skoru — getTaScoreFor (app.js:4581) ile BİREBİR aynı yol:
//  5y/1d sembol mumları + 5y/1d endeks mumları (RAW) → computeVadeScore.
// ---------------------------------------------------------------------
export async function scoreTA(eng, sym, market, vade) {
  const cfg = (eng._weights || {})[vade];
  if (!cfg || cfg.intraday) return { score: null, why: 'vade gunluk degil' };
  let daily = null, bench = null;
  try { daily = (await eng.fetchYahooOHLC(sym, market, '5y', '1d')).candles; }
  catch (e) { return { score: null, why: 'mum alinamadi: ' + e.message }; }
  const bsym = (eng._bench || {})[market];
  if (bsym) {
    try { bench = (await eng.fetchYahooOHLC(bsym, 'RAW', '5y', '1d')).candles; }
    catch (e) { bench = null; } // app.js de aynısını yapar: RS devre dışı, skor normalize olur
  }
  const r = eng.computeVadeScore(daily, vade, undefined, bench);
  if (!r) return { score: null, why: 'computeVadeScore null' };
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
//  Bir sembolün TAM kaydı: TA + FA + bileşke.
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
export async function scoreOne(eng, row, vade, opt = {}) {
  const { sym, market } = row;
  const ta = await scoreTA(eng, sym, market, vade);
  let fa;
  if (market === 'BIST') {
    const mali = opt.getMali ? await opt.getMali(sym) : null;
    fa = await scoreFaBIST(eng, sym, mali);
  } else {
    fa = await scoreFaUS(eng, sym, opt.net);
  }
  return { sym, market, ta, fa, composite: composite(eng, fa.score, ta.score) };
}
