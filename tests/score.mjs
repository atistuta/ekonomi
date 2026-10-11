// =====================================================================
//  TEK SKORLAYICI  (tests/score.mjs)
// ---------------------------------------------------------------------
//  Hem referans dondurma (baseline.mjs) hem parite karşılaştırması
//  (parity.mjs) BU dosyayı kullanır. Sebep: "bir sembolün skoru nasıl
//  hesaplanır" sorusunun test tarafında TEK bir cevabı olsun. İki yerde
//  iki kopya olursa, parite testi iki kopyanın birbirine uyduğunu
//  doğrular — motora dair hiçbir şey söylemez.
//
//  ÖNEMLİ BULGU (2026-10-11, ölçülmüş): kullanıcının gördüğü ABD temel
//  skoru secFetchModel'in SAF çıktısı DEĞİL. Ekran katmanında (app.js
//  5648 / 7449 / 11876 — üç kopya) canlı fiyattan türetilen bir
//  "Değerleme (F/K)" kriteri kriter listesine EKLENİYOR:
//      pe = price / eps
//      score = pe < 0 ? 15 : faInterp(pe, [...])
//      weight 0.10, group 'valuation'
//  BIST'te böyle bir ek YOK — fa = computeFaScore(model.criteria) doğrudan.
//  Parite testi kullanıcının GÖRDÜĞÜ sayıyı korumak zorunda olduğu için
//  bu eki dahil ediyoruz; ama sabitleri elle yazmıyoruz: app.js'ten
//  REGEX ile okuyup üç kopyanın aynı olduğunu doğruluyoruz (readRenderConstants).
//  → Taşıma gereği: /api/score bu kriteri KENDİSİ sahiplenmeli, üç ekran
//    kopyası kalmamalı. (BAGIMLILIK_GRAFIGI.md §4'e işlendi.)
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEngine, readSymbols, ROOT, TESTS, FIX } from './engine.mjs';

export { buildEngine, readSymbols, ROOT, TESTS, FIX };

export const DIR_YAHOO = path.join(FIX, 'yahoo');
export const DIR_IS = path.join(FIX, 'isyatirim');
export const DIR_SEC = path.join(FIX, 'sec');

// Dosya adı güvenli anahtar: Yahoo sembolleri ^ ve . içerebilir.
export const keySafe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');
export const yahooKey = (ysym, range, interval) => `${keySafe(ysym)}_${range}_${interval}`;

// Düz metin geçiş sayısı (regex kaçağını yakalamak için).
function countAll(src, needle) {
  let n = 0, i = 0;
  for (;;) { const k = src.indexOf(needle, i); if (k < 0) return n; n++; i = k + 1; }
}

// ---------------------------------------------------------------------
// app.js'teki EKRAN KATMANI sabitlerini kaynaktan oku (elle kopyalama yok).
// Sabitler kayarsa test "geçmez"; "farklı sabitle ölçmüş" olmaz.
// ---------------------------------------------------------------------
export function readRenderConstants() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

  // --- 1) F/K kriteri: criteria.push({ key: 'pe', group: 'valuation', weight: … })
  const pushRe = /criteria\.push\(\{\s*key:\s*'pe',\s*group:\s*'valuation',\s*weight:\s*([\d.]+)/g;
  const sites = [];
  for (let m; (m = pushRe.exec(src)); ) {
    const at = m.index;
    const win = src.slice(Math.max(0, at - 700), at); // push'tan ÖNCEki pencere
    // EN YAKIN önceki eşleşmeyi al: pencerede birden fazla faInterp olabilir.
    const last = (re) => { let r = null; for (let x; (x = re.exec(win)); ) r = x; return r; };
    const bp = last(/faInterp\(pe,\s*(\[\[[^;]*?\]\])\)/g);
    const neg = last(/pe < 0\s*(?:\?|\)\s*\{\s*score\s*=)\s*(\d+)/g);
    if (!bp) throw new Error(`F/K kriteri ${at} konumunda: faInterp(pe, …) kırılım dizisi bulunamadi`);
    if (!neg) throw new Error(`F/K kriteri ${at} konumunda: pe<0 skoru bulunamadi`);
    sites.push({ at, weight: Number(m[1]), bpTxt: bp[1].replace(/\s+/g, ''), neg: Number(neg[1]) });
  }
  if (sites.length < 1) throw new Error("app.js: key:'pe' kriter eklemesi hic bulunamadi — ekran katmani degismis olabilir");
  const first = sites[0];
  for (const s of sites) {
    if (s.weight !== first.weight || s.bpTxt !== first.bpTxt || s.neg !== first.neg)
      throw new Error(
        `F/K kriteri KOPYALARI AYRISMIS — ekranlar artik ayni skoru uretmiyor.\n` +
        `  ${first.at}: w=${first.weight} neg=${first.neg} bp=${first.bpTxt}\n` +
        `  ${s.at}: w=${s.weight} neg=${s.neg} bp=${s.bpTxt}`);
  }
  const peBp = JSON.parse(first.bpTxt);

  // --- 2) Bileşke ağırlıkları: blended = 0.55 * faScore + 0.45 * X.score;
  // "const" OLMADAN da geçiyor (app.js:12023 → let blended önceden tanımlı).
  const blRe = /\bblended = ([\d.]+) \* faScore \+ ([\d.]+) \* [A-Za-z_$][\w$.]*\.score;/g;
  const bls = [];
  for (let m; (m = blRe.exec(src)); ) bls.push({ at: m.index, fa: Number(m[1]), ta: Number(m[2]) });
  if (!bls.length) throw new Error('app.js: bileske formulu (blended = … faScore …) bulunamadi');
  for (const b of bls) {
    if (b.fa !== bls[0].fa || b.ta !== bls[0].ta)
      throw new Error(`bileske agirliklari KOPYALAR ARASINDA AYRISMIS: ${bls[0].fa}/${bls[0].ta} vs ${b.fa}/${b.ta} (konum ${b.at})`);
  }
  // KAÇAK KONTROLÜ: regex'in gözden kaçırdığı bir harman olmasın.
  const blAll = countAll(src, '* faScore +');
  if (blAll !== bls.length)
    throw new Error(`bileske harmani: dosyada ${blAll} konum var, regex ${bls.length} tanesini yakaladi — biri farkli yazilmis`);
  const peAll = countAll(src, "key: 'pe'");
  if (peAll !== sites.length)
    throw new Error(`F/K kriteri: dosyada ${peAll} konum var, regex ${sites.length} tanesini yakaladi — biri farkli yazilmis`);

  return {
    pe: { weight: first.weight, neg: first.neg, bp: peBp, sites: sites.length },
    blend: { fa: bls[0].fa, ta: bls[0].ta, sites: bls.length },
  };
}

// ---------------------------------------------------------------------
// Sahte Response: motor yalnız .ok / .json() / .text() kullanıyor.
// ---------------------------------------------------------------------
const resJson = (obj) => ({ ok: true, status: 200, json: async () => obj, text: async () => JSON.stringify(obj) });
const resText = (txt) => ({ ok: true, status: 200, text: async () => txt, json: async () => JSON.parse(txt) });
const resMiss = () => ({ ok: false, status: 404, text: async () => '', json: async () => { throw new Error('404'); } });

// ---------------------------------------------------------------------
// ÇEVRİMDIŞI ağ kabuğu: yalnız kayıtlı girdileri servis eder.
// Kayıtta olmayan bir istek SESSİZCE boş dönmez — patlar. Yoksa parite
// testi "veri yok" halini ölçüp "geçti" der.
// ---------------------------------------------------------------------
export function makeOfflineFetch() {
  const seen = { yahoo: 0, sec: 0, secMiss: 0 };
  const secCache = {};

  const loadSec = (sym) => {
    if (!secCache[sym]) {
      const p = path.join(DIR_SEC, keySafe(sym) + '.json');
      if (!fs.existsSync(p)) throw new Error(`SEC kaydi yok: ${p} — once "node tests/capture.mjs" calistir`);
      secCache[sym] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    return secCache[sym];
  };

  // Hangi sembolün SEC kaydına bakacağımızı bilmemiz gerekiyor; secFetchModel
  // sembolü URL'ye koymadığı için (CIK kullanır) skorlayıcı bunu bildirir.
  let secSym = null;
  const setSecSymbol = (s) => { secSym = s; };

  const fetchShim = async (url) => {
    // --- Yahoo chart ---
    const ym = /\/v8\/finance\/chart\/([^?]+)\?range=([^&]+)&interval=([^&]+)/.exec(url);
    if (ym) {
      const k = yahooKey(decodeURIComponent(ym[1]), ym[2], ym[3]);
      const p = path.join(DIR_YAHOO, k + '.json');
      if (!fs.existsSync(p)) throw new Error(`Yahoo kaydi yok: ${k}.json — once "node tests/capture.mjs" calistir`);
      seen.yahoo++;
      return resJson(JSON.parse(fs.readFileSync(p, 'utf8')));
    }
    // --- SEC (secGet, 'fixture:' önekiyle gelir) ---
    if (url.startsWith('fixture:')) {
      const real = decodeURIComponent(url.slice('fixture:'.length));
      // company_tickers.json tüm semboller için ortak
      if (real.includes('company_tickers.json')) {
        const p = path.join(DIR_SEC, '_tickers.json');
        if (!fs.existsSync(p)) throw new Error('SEC ticker kaydi yok: _tickers.json');
        seen.sec++;
        return resText(fs.readFileSync(p, 'utf8'));
      }
      if (!secSym) throw new Error('SEC istegi geldi ama hangi sembol oldugu bildirilmedi (setSecSymbol)');
      const map = loadSec(secSym);
      if (!(real in map)) throw new Error(`SEC kaydi eksik (${secSym}): ${real}`);
      const v = map[real];
      seen.sec++;
      if (v === null) { seen.secMiss++; return resMiss(); } // kaçırılan etiket: aynı atlamayı üret
      return resText(v);
    }
    throw new Error('beklenmeyen istek (parite kosusunda canli cikis YASAK): ' + url);
  };

  const fetchViaShim = async () => {
    throw new Error('fetchVia cagrildi — BIST mali tablosu kayittan gelmeli, aga cikilmamali');
  };

  return { fetch: fetchShim, fetchVia: fetchViaShim, setSecSymbol, seen };
}

export function loadMali(sym) {
  const p = path.join(DIR_IS, keySafe(sym) + '.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j && j.rows ? j : null;
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
//  FA skoru — ABD: secFetchModel + ekran katmanının F/K kriteri.
// ---------------------------------------------------------------------
export async function scoreFaUS(eng, sym, K, net) {
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
    const score = pe < 0 ? K.pe.neg : eng.faInterp(pe, K.pe.bp);
    criteria.push({ key: 'pe', group: 'valuation', weight: K.pe.weight, label: 'Değerleme (F/K)', score, note: '' });
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
//  DİKKAT: F/K eki YOK (ekran katmanı BIST'te kriter eklemiyor).
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
export function composite(eng, K, faScore, taScore) {
  if (faScore == null || taScore == null) return { band: null, why: 'eksik skor' };
  const fb = eng.faBand(faScore), tb = eng.taBand(taScore);
  const cell = eng.COMPOSITE_MATRIX[fb + ':' + tb];
  const blended = K.blend.fa * faScore + K.blend.ta * taScore;
  return {
    faBand: fb, taBand: tb,
    band: cell ? cell.band : null,
    label: cell ? cell.label : null,
    blended: round6(blended),
    blendedShown: Math.round(blended), // kullanıcının gördüğü tam sayı
  };
}

// Kayan nokta gürültüsünü dondur: 1e-9 düzeyinde fark "skor değişti" demek değil.
export function round6(v) {
  if (v == null || typeof v !== 'number' || !isFinite(v)) return v == null ? null : v;
  return Math.round(v * 1e6) / 1e6;
}

// ---------------------------------------------------------------------
//  Bir sembolün TAM kaydı: TA + FA + bileşke.
// ---------------------------------------------------------------------
export async function scoreOne(eng, K, row, vade, opt = {}) {
  const { sym, market } = row;
  const ta = await scoreTA(eng, sym, market, vade);
  const fa = market === 'BIST'
    ? await scoreFaBIST(eng, sym, opt.mali !== undefined ? opt.mali : loadMali(sym))
    : await scoreFaUS(eng, sym, K, opt.net);
  return { sym, market, ta, fa, composite: composite(eng, K, fa.score, ta.score) };
}

// Kendi kendini sınama: `node tests/score.mjs` — yalnız sabit çıkarımını doğrular.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const K = readRenderConstants();
  console.log(`F/K kriteri: ${K.pe.sites} ekran kopyasi, HEPSI AYNI`);
  console.log(`  agirlik ${K.pe.weight} · pe<0 skoru ${K.pe.neg} · kirilim ${JSON.stringify(K.pe.bp)}`);
  console.log(`Bileske: ${K.blend.sites} kopya, HEPSI AYNI — FA %${K.blend.fa * 100} + TA %${K.blend.ta * 100}`);
  const e = buildEngine();
  console.log(`faBand(72)=${e.faBand(72)} taBand(50)=${e.taBand(50)} hucre=${e.COMPOSITE_MATRIX['hi:mid'].band}`);
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
}
