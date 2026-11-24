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

/**
 * Kriterin TEL BİÇİMİ: ham sayı + MAKİNE KODU. Türkçe cümle (`c.note`)
 * TAŞINMIYOR — §5.1: uçta cümle yok, eşik yok. Cümleyi native
 * `mobile/src/lib/sozluk.ts` `kod`dan kuruyor; `sayilar` o cümlenin
 * yerine geçecek ham ölçümler (`birim` bir makine kodudur: TRY/USD).
 *
 * `kod` / `sayilar` YOKSA alan HİÇ EKLENMİYOR: "sormadım" (alan yok) ile
 * "ölçemedim" (`null`) ayrımı telde korunuyor.
 */
function kriterTel(c) {
  const out = { key: c.key, weight: round6(c.weight), score: round6(c.score) };
  if (c.kod != null) out.kod = c.kod;
  if (c.sayilar && typeof c.sayilar === 'object') {
    const s = {};
    for (const k of Object.keys(c.sayilar)) {
      const v = c.sayilar[k];
      if (typeof v === 'string') s[k] = v;
      else if (typeof v === 'number' && isFinite(v)) s[k] = round6(v);
    }
    out.sayilar = s;
  }
  return out;
}

/**
 * 📐 Graham katmanının TEL BİÇİMİ — yalnız HAM sayı ve SABİT
 * KÜMELİ makine kodu: `reason` (no-data|neg-eps|no-growth), `badge`
 * (cheap|fair|expensive), `market` (US|BIST). Biçimlenmiş dize, para
 * simgesi ve Türkçe cümle TAŞINMIYOR — api/compare.js başlığı:
 * "cevapta biçimlenmiş tek alan yok". `bistValuation`ın döndürdüğü
 * `curSym` ('₺') bu BEYAZ LİSTEye GİRMEDİĞİ için tele de çıkmıyor;
 * biçimleme native'de kalıyor (mobile/src/lib/format.ts).
 *
 * Ölçülemeyen alan `null` kalır — 0 BASILMAZ. `ok:false` durumunda
 * SADECE `reason` taşınır: hesaplanmamış sayıyı tele koymak "ölçtüm"
 * demek olurdu.
 */
function grahamTel(gr) {
  if (!gr) return null;
  if (!gr.ok) return { ok: false, reason: gr.reason || null };
  return {
    ok: true, market: gr.market || null, badge: gr.badge,
    value: round6(gr.value), diffPct: round6(gr.diffPct),
    grahamNumber: round6(gr.grahamNumber), gnDiffPct: round6(gr.gnDiffPct),
    eps: round6(gr.eps), bvps: round6(gr.bvps),
    gUsed: round6(gr.gUsed), gRaw: round6(gr.gRaw), gClamped: !!gr.gClamped,
    impliedPE: round6(gr.impliedPE),
  };
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
    // `note` boş: uç nokta ham sayı + makine kodu döndürür (`faPeCriterion`
    // `kod`u kendisi takıyor), cümleyi native kuruyor.
    criteria.push(eng.faPeCriterion(pe, ''));
  }
  // 📐 Benjamin Graham's Formula — SADECE BİLGİ; FA/TA/bileşke skora DOKUNMAZ.
  // Formülün tamamı MOTORDA (eng.grahamIn → eng.computeGraham); burada eşik,
  // katsayı, kırpma YOK — yalnız motorun beklediği `valuation` kabı kuruluyor.
  // OLCULDU (2026-11-22): sec.metrics = { ni, rev, eps, fcf, netDebt, totalDebt,
  // ebitda, revCagr, revYoY, equity } (app.js:7135) — `shares` ve `bvps` bu
  // alanlardan HAM BÖLME ile çıkıyor, yukarıdaki `pe = price / eps` ile aynı cins.
  // `g` (büyüme) YENİDEN YAZILMIYOR: eng.usDcfIn onu zaten üretiyor — iki
  // doğruluk kaynağı olmasın.
  let graham = null;
  try {
    const shares = (sec.metrics.ni != null && eps) ? sec.metrics.ni / eps : null;
    const bvps = (sec.metrics.equity != null && shares != null && shares > 0)
      ? sec.metrics.equity / shares : null;
    graham = grahamTel(eng.computeGraham(eng.grahamIn(
      { eps, bvps, price, market: 'US', dcfIn: eng.usDcfIn(sec, price, eps) }, price)));
  } catch (e) { graham = null; }
  const fa = eng.computeFaScore(criteria);
  return {
    score: round6(fa.score), present: round6(fa.present), total: round6(fa.total),
    price: round6(price), eps: round6(eps), pe: round6(pe),
    criteria: criteria.map(kriterTel),
    // `graham` EN SONDA: `kayitHam` onu ayırırken geri kalan alanların
    // SIRASI (istemci sözleşmesi) harfiyen korunsun.
    graham,
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
  // 📐 Benjamin Graham's Formula — BIST bacağı. `bistValuation` 2026-11-22'de
  // MOTORA alındı (dilim `bist-val`): HBK, DDB ve büyüme oradan geliyor, burada
  // formül YOK. Piyasa değeri bir AĞ ayağı gerektirdiği için `try` içinde:
  // Graham ölçülemezse `null` döner, FA SKORU ETKİLENMEZ.
  let graham = null;
  try {
    const val = await eng.bistValuation(sym, model.metrics);
    graham = grahamTel(eng.computeGraham(eng.grahamIn(val, val && val.price)));
  } catch (e) { graham = null; }
  const fa = eng.computeFaScore(model.criteria);
  return {
    score: round6(fa.score), present: round6(fa.present), total: round6(fa.total),
    price: round6(meta && meta.regularMarketPrice),
    years: mali.years,
    criteria: model.criteria.map(kriterTel),
    graham,
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
  // 📐 Graham katmanı `fa`dan AYRILIYOR. NEDENİ ÖLÇÜLDÜ (2026-11-22):
  // `scoreOne` bu kaydı OLDUĞU GİBİ döndürüyor, tests/run.mjs onu
  // tests/baseline.json’a koyuyor ve tests/parity.mjs anahtar kümesini
  // birebir karşılaştırıyor (parity.mjs:56 — yeni anahtar = FARK).
  // Graham SADECE BİLGİ olduğu için /api/score’un alan kümesini ve parite
  // referansını kaydırmaya DEĞMEZ: `analiz` katmanında taşınıyor.
  // (Alternatif baseline’ı `--zorla` ile yenilemekti; "yeni doğru cevap bu"
  // demek olurdu — skor DEĞİŞMEDİĞİ için yanlış olurdu.)
  const { graham: grahamHam, ...faTel } = fa;
  return {
    kayit: { sym, market, ta, fa: faTel, composite: composite(eng, faTel.score, ta.score) },
    r: ham.r || null,
    graham: grahamHam || null,
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
//      atrVolKod           ATR/fiyat oranının ÜÇ KADEMELİ oynaklık sınıfı
//      atrPlanKod          aynı oranın PLAN/STOP uyarısı — SESSİZ orta bandı
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
    // ---- #14: ATR/fiyat oranının İKİ AYRI SORUSU ----
    //  `seviye.atr` ve `seviye.price` TELDE ZATEN VAR; oran istemcide
    //  BÖLÜNEBİLİR. Telde duran şey oran değil, oranın SINIFLANDIRILMASI:
    //  eşikler (2 / 4 ile 1.5 / 4) motorda kalsın diye.
    //
    //  NİYE İKİ ALAN: web bu oranı iki yerde hesaplıyor ve iki farklı
    //  soruya cevap veriyordu — ATR kartı ÜÇ KADEMELİ sınıf + "stop için
    //  1.5-2 kat" cümlesi basıyor, katalizör satırı ise yalnız uçlarda
    //  (>=4 / <1.5) konuşup ARADA SUSUYOR. Tek alana indirmek webdeki
    //  davranışlardan birini sessizce silerdi (ölçüldü 2026-11-03:
    //  app.js ATR kartı ile fillCatalysts).
    //
    //  `oynaklik.kod` null = ATR var, fiyat yok → oran ölçülemedi.
    //  `atrPlan.kod` null = ÖLÇTÜM, söylenecek bir şey yok (sessiz bant);
    //  `atrPlan` kendisi null = ölçemedim. İki hal AYRI.
    //
    //  `stopKat` SAYI olarak taşınıyor ([1.5, 2]) — o iki sayıyı
    //  istemciye yazmak istemciye eşik yazmak olurdu (§5.1).
    oynaklik: hamYuvarla(eng.atrVolKod(r.levels.atr, r.levels.price)),
    atrPlan: hamYuvarla(eng.atrPlanKod(r.levels.atr, r.levels.price)),
  };
}

// ---------------------------------------------------------------------
//  Bir sembolün TAM ÖNERİ kaydı: skor kaydı + plan katmanı.
//  `scoreOne`'un döndürdüğü her alan aynı adla ve aynı sırada duruyor;
//  üstüne tek bir alan ekleniyor (`plan`). Böylece /api/recommend'i
//  tüketen istemci /api/score'un çözücüsünü yeniden kullanabiliyor.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
//  FIRSAT KATMANI — motorun URETTIGI firsat siralamasini tele koyar.
//
//  Ucu de MOTORDA (app.js -> _motor.js, 2026-10-31/S8-G1):
//      priceOppAdj   fiyatin uygun alim bandina ATR-olcekli uzakligi -> +-8 puan
//      oppCombined   teknik skor + fiyat uygunlugu, 2..99 bandina kirpilmis
//      oppTag        bilesik skorun SABIT KUMELI sinif kodu
//  Bu islev HESAP YAPMIYOR: esik, carpan, ATR katsayisi, kirpma siniri
//  tasimiyor. Eskiden ucu de app.js icinde satir ici duruyordu
//  (`renderOpportunities`), yani web hesapliyor native sayisiz kaliyordu.
//
//  `oppTag().txt` BILEREK TELE KONMUYOR: serbest TURKCE metin
//  ("Guclu Firsat", "Uzak dur"...) — HAM SAYI KURALI (BAGIMLILIK_GRAFIGI
//  §5.1) yalniz SABIT KUMELI makine kodunu gecirir. `cls` kumesi:
//  'strong' | 'good' | 'watch' | 'neutral' | 'weak' | 'risk'. Cumleyi
//  istemci kendi sozlugunden secer.
//
//  OLCULMUS SAPMA, SAYIYLA ORTULMEDI: web Firsatlar taraycisi momentumu
//  HEP 'orta' vadeyle olcuyor (app.js, `momentumInfo(r, 'orta')`); bu
//  katman cagirinin ISTEDIGI vadeyi kullaniyor — `planKatmani` ile AYNI
//  vade, boylece tek cevabin icinde iki farkli momentum rejimi olmuyor.
//
//  `buyZoneProximity`/`momentumInfo` `planKatmani`de de cagriliyor: ikisi
//  de `r` uzerinde SAF matematik, AG ISTEGI YOK — tekrar cagri bedeli
//  olculebilir degil, paylasilan degisken ise iki katmani birbirine
//  baglardi (biri susunca oteki de susardi).
//
//  @returns {object|null} r ya da skor yoksa null ("TA kosmadi", bos kayit degil)
// ---------------------------------------------------------------------
export function firsatKatmani(eng, r, vade) {
  if (!r || r.score == null) return null;
  const prox = eng.buyZoneProximity(r);
  const fiyatPuan = eng.priceOppAdj(prox, eng.momentumInfo(r, vade));
  const bilesik = eng.oppCombined(r.score, fiyatPuan);
  const etiket = eng.oppTag(bilesik);
  return {
    fiyatPuan: hamYuvarla(fiyatPuan),
    bilesik: hamYuvarla(bilesik),
    cls: (etiket && etiket.cls) || null,
  };
}

export async function recommendOne(eng, row, vade, opt = {}) {
  const { kayit, r } = await kayitHam(eng, row, vade, opt);
  return { ...kayit, plan: planKatmani(eng, r, vade), firsat: firsatKatmani(eng, r, vade) };
}

// ---------------------------------------------------------------------
//  BÜTÜNCÜL (ANALİZ) KATMANI — motorun ÜRETTİĞİ bütüncül okumayı tele koyar.
//
//  GÖÇ GEREKMEDİ — ÖNCE DOĞRULANDI (2026-10-14, FAZ 1/5-E). Yazmadan önce
//  üç yer okundu:
//    api/_motor.js:1661  dışa aktarım listesinde `faVerdict`,
//                        `computeHolisticScore`, `COMPOSITE_MATRIX`,
//                        `COMPOSITE_BLEND`, `compositeBlend`, `faBand`,
//                        `taBand` ZATEN VAR.
//    app.js:5432         fillResultPlan  — Sonuç/Yatırım Planı ekranı
//    app.js:12177        compareVerdict  — Karşılaştır ekranı
//  İki tüketicinin ikisi de yalnız bu motor işlevlerini çağırıyor; ekranda
//  kalan tek şey CÜMLE. Dolayısıyla app.js'e ve config.js'e DOKUNULMADI,
//  tools/motor-uret.mjs yeniden KOŞMADI, motor imzası DEĞİŞMEDİ. Parite
//  FARK 0 bunun kanıtı. Gereksiz göç en pahalı hata olurdu.
//
//  COMPOSITE_MATRIX KONUMLAMASI BURADA TEKRARLANMIYOR: yukarıdaki
//  `composite()` zaten faBand/taBand/band/label/blended döndürüyor ve
//  /api/score'un kaydında duruyor. Bu katman yalnız ÜSTÜNE KOYDUĞU şeyi
//  taşıyor — `faVerdict` rozeti + 0-10 bütüncül skor.
//
//  BU İŞLEV HESAP YAPMIYOR: eşik, ağırlık, çarpan taşımıyor. Üç direğin
//  ağırlıkları (0.40/0.30/0.30), bant eşikleri ve büyüme eğimi motorda
//  yazılı. Bir sayı buraya yazılırsa parite testi onu GÖRMEZ ve sunucu ile
//  ekran sessizce ayrışır.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1) — SÖKÜLEN ÜÇ ALAN:
//    parts[].note      serbest Türkçe + Math.round + yüzde işareti
//                      ("Fiyat alım bandının ~yüzde 37 üzerinde — ...")
//    growthNote.txt    serbest Türkçe + peg.toFixed(2)
//    COMPOSITE_MATRIX[...].txt   serbest Türkçe + <b>/<i> HTML etiketi
//  Üçü de `planKatmani`nın `anchorSrc`e yaptığı muameleyi görüyor: SAYI ve
//  SABİT KÜMELİ KOD geçer, biçimlenmiş cümle geçmez. `growthNote`tan yalnız
//  `cls` (good|mid|bad|thm|na) kalıyor; cümleyi istemci kuruyor.
//
//  GEÇEN SABİT KÜMELİ ETİKETLER: `faKarar.label` (6 değer), `band.l`
//  (5 değer), `band.c` (bull|neutral|bear), `direkler[].k` (3 değer).
//  `k`yi makine koduna çevirmek bir EŞLEME TABLOSU gerektirirdi — tablo
//  burada dursa akış sabit taşımaya başlar, motorda dursa app.js değişir;
//  `planKatmani`nın `anchorSrc` için verdiği kararın aynısı geçerli.
//
//  `thematic` BİLEREK TAŞINMIYOR. Motor onu ancak değerleme verisi
//  elimizdeyse hesaplayabiliyor (trailingPE/forwardPE/netMargin); bu uç o
//  verileri geçmediği için `thematic` HER ZAMAN false döner. false ise
//  "tematik değil" demektir, oysa gerçek "bilmiyorum" — §5.4'ün `yok` ile
//  `kesinti` ayrımının aynısı. Sabit bir false'u cevap kılığında yollamak
//  yerine alan hiç konmuyor. `buyumeCls` ise taşınıyor, çünkü onun 'na'
//  değeri ZATEN "okunamadı" demek: dürüst bir boş-durum kodu.
//
//  NEDEN O ÜÇ METRİK GEÇMİYOR: peg · revGrowth · netMargin · forwardPE ·
//  trailingPE Yahoo quoteSummary (crumb) ayağından geliyor — api/yfin.js'te,
//  api/_ag.js'in canlı ağ katmanında DEĞİL. Yeni bir ağ ayağı açmak bu
//  adımın kapsamı dışı. app.js'in iki tüketicisinden biri (fillResultPlan)
//  da tam olarak aynısını yapıyor: o alanları geçmiyor, motorun kendi
//  yorumu bunu "Sonuç ekranı bu alanları geçmez" diye yazıyor. Yani bu uç
//  Sonuç ekranıyla BİREBİR aynı girdiyle koşuyor; eksiklik Karşılaştır
//  ekranına göredir ve ÖLÇÜLDÜ, atlanmadı.
//
//  `valuation` SADELEŞTİRİLDİ, KISITLANMADI: motor `valuation`dan yalnız
//  `.pe` okuyor (_motor.js:1155, tek kullanım). Bu yüzden `{ pe }` geçmek
//  app.js'in tam `valuation` nesnesini geçmesiyle DAVRANIŞ OLARAK AYNI.
//  BIST'te `pe` YOK: `scoreFaBIST` üretmiyor. GÜNCELLENDİ (2026-11-22):
//  `bistValuation` ve `fetchBistMarketCap` MOTORA alındı (dilim `bist-val`),
//  yani F/K artık ÖLÇÜLEBİLİR — Graham bacağı onu kullanıyor. Buna
//  rağmen `valuation.pe` BİLEREK boş bırakıldı: computeHolisticScore onu
//  OKUYOR, yani eklemek BIST skorlarını KAYDIRIRDI (parite FARK 0 bozulur).
//  Skoru değiştiren adım ayrı ve AÇIK ONAY ister. Sonuç: BIST'te F/K bazlı
//  değerleme cezası hâlâ uygulanmıyor — BİLİNEN eksik, sessiz değil.
//
//  @param {object} eng   buildMotor(H) çıktısı
//  @param {object} kayit kayitHam'ın kaydı (fa.score · ta.score · fa.pe)
//  @param {object|null} r    computeVadeScore'un HAM dönüşü
//  @param {object|null} plan planKatmani'nin dönüşü (momentum yeniden
//                            hesaplanmasın: mum pahalı değil ama çift
//                            hesap iki doğruluk kaynağı demek)
// ---------------------------------------------------------------------
export function analizKatmani(eng, kayit, r, plan, graham) {
  const faScore = (kayit && kayit.fa) ? kayit.fa.score : null;
  const taScore = (kayit && kayit.ta) ? kayit.ta.score : null;
  const pe = (kayit && kayit.fa && kayit.fa.pe != null) ? kayit.fa.pe : null;
  const hol = eng.computeHolisticScore({
    faScore,
    taScore,
    levels: (r && r.levels) || null,
    valuation: (pe != null) ? { pe } : null,
    momActive: !!(plan && plan.momentum && plan.momentum.active),
  });
  return {
    faKarar: eng.faVerdict(faScore),
    // `butunculluk` NULL OLMUYOR — `plan`dan farklı. Planın ön koşulu var
    // (levels yoksa plan yoktur); bütüncül skorun yok: motor eksik direği
    // nötr 50 sayıp `coreSoft` ile KAÇ direğin eksik olduğunu kendisi
    // söylüyor. Yani boşluk gizlenmiyor, sayıyla bildiriliyor.
    butunculluk: {
      skor10: round6(hol.score10),
      band: hol.band,
      direkler: (hol.parts || []).map((p) => ({
        k: p.k, w: round6(p.w), v: round6(p.v), conf: p.conf,
      })),
      coreSoft: hol.coreSoft,
      buyumeCls: hol.growthNote ? hol.growthNote.cls : null,
    },
    // 📐 Benjamin Graham's Formula — HAM sayı + makine kodu; SADECE BİLGİ.
    // `butunculluk` ile YAN YANA duruyor ama onun İÇİNE GİRMİYOR:
    // computeHolisticScore bu alanların hiçbirini ne okur ne yazar, bu yüzden
    // bileşke/uygunluk skoru DEĞİŞMEZ (parite FARK 0 bunun kanıtı).
    // Ölçülemediyse `null` — "hesaplayamadım" ile "sıfır" ayrı şeyler.
    graham: graham || null,
    // 🧮 Genel Skor (1–100) = bileşke + Graham marjı + HABER.
    // Eşik/ağırlık/formul YOK burada: tamamı motorda (eng.computeOverall100).
    // `grahamMarj` KESİR ve POZİTİF = ucuz; `diffPct` ise YÜZDE ve NEGATİF =
    // ucuz — bu yüzden işaret çevrilip 100'e bölünüyor.
    // `haberSkor` BİLEREK null: bu uç noktanın haber girdisi YOK (RSS çekmiyor,
    // `computeNewsSentiment` burada koşmuyor). Motor eksik bacağı 0 saymaz,
    // ağırlığı düşürüp `guvenKod`u 'kismi'ye çeker — yani eksik görünür,
    // gizlenmez. Web (app.js) aynı motora haber bacağını da besliyor.
    overall: (() => {
      const gm = (graham && graham.ok && graham.diffPct != null) ? -graham.diffPct / 100 : null;
      const ov = eng.computeOverall100({ score10: hol.score10, grahamMarj: gm, haberSkor: null });
      if (!ov || ov.skor == null) return null;
      return {
        skor: ov.skor, taban: round6(ov.taban),
        bantKod: ov.bantKod, bantCls: ov.bantCls,
        delta: {
          graham: round6(ov.delta.graham), haber: round6(ov.delta.haber),
          toplam: round6(ov.delta.toplam), kirpildi: !!ov.delta.kirpildi,
        },
        eksik: ov.eksik || [], guvenKod: ov.guvenKod,
      };
    })(),
  };
}

// ---------------------------------------------------------------------
//  Bir sembolün TAM ANALİZ kaydı: öneri kaydı + bütüncül katman.
//  `recommendOne`'un döndürdüğü her alan aynı adla ve aynı sırada duruyor;
//  üstüne tek bir alan ekleniyor (`analiz`). Zincir böylece İÇ İÇE:
//      scoreOne  ⊂  recommendOne  ⊂  analyzeOne
//  /api/score'un çözücüsü üç uçta da çalışıyor.
//
//  NEDEN PLANI DA TAŞIYOR (üstünü örtmek değil): Karşılaştır ekranı
//  (app.js:12177) bütüncül skoru planRiskReward ile BİRLİKTE gösteriyor.
//  `analiz` planı taşımazsa istemci aynı ekran için /api/recommend'i de
//  çağırmak zorunda kalır — mumlar ve SEC modeli İKİNCİ KEZ inerdi.
//  Ölçülen maliyet: tek ABD sembolü 7,2 sn ve 31 SEC isteği (duman testi).
//  Burada ise `kayitHam` sembol başına BİR kez koşuyor.
// ---------------------------------------------------------------------
export async function analyzeOne(eng, row, vade, opt = {}) {
  const { kayit, r, graham } = await kayitHam(eng, row, vade, opt);
  const plan = planKatmani(eng, r, vade);
  return { ...kayit, plan, analiz: analizKatmani(eng, kayit, r, plan, graham) };
}
