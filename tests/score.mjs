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
//  REGEX ile okuyup üç kopyanın aynı olduğunu doğruluyoruz (readRenderConstants
//  — gövdesi tests/engine.mjs'te; api/score.js de aynı çıkarımı kullanacak, bu
//  yüzden testin değil DİLİMLEYİCİNİN yanında duruyor).
//  → Taşıma gereği: /api/score bu kriteri KENDİSİ sahiplenmeli, üç ekran
//    kopyası kalmamalı. (BAGIMLILIK_GRAFIGI.md §4'e işlendi.)
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================
//
//  AKIŞ ARTIK BURADA DEĞİL (2026-10-14): scoreTA / scoreFaUS / scoreFaBIST /
//  composite / scoreOne gövdeleri `api/_akis.js`'e TAŞINDI. Sebep: aynı akışı
//  /api/score de koşmak zorunda ve .vercelignore tests/ dizinini hariç
//  tutuyor — akış burada kalsaydı uca KOPYALANACAKTI. O gün parite testi
//  kendi kopyasını doğrular, sunucudaki sapma görünmez olurdu. Şimdi tersi:
//  baseline.json sunucunun koşturduğu akışı bekçiliyor.
//  Bu dosyada KALAN: fikstür tesisatı (çevrimdışı ağ kabuğu, kayıt okuma) ve
//  akışın test tarafı sarmalayıcısı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildEngine, readSymbols, readRenderConstants, ROOT, TESTS, FIX,
} from './engine.mjs';
import {
  round6, scoreTA, scoreFaUS, scoreFaBIST, composite,
  scoreOne as akisScoreOne,
} from '../api/_akis.js';

export { buildEngine, readSymbols, readRenderConstants, ROOT, TESTS, FIX };
export { round6, scoreTA, scoreFaUS, scoreFaBIST, composite };
export const DIR_YAHOO = path.join(FIX, 'yahoo');
export const DIR_IS = path.join(FIX, 'isyatirim');
export const DIR_SEC = path.join(FIX, 'sec');

// Dosya adı güvenli anahtar: Yahoo sembolleri ^ ve . içerebilir.
export const keySafe = (s) => String(s).replace(/[^A-Za-z0-9._-]/g, '-');
export const yahooKey = (ysym, range, interval) => `${keySafe(ysym)}_${range}_${interval}`;

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
//  Akışın test tarafı sarmalayıcısı.
//
//  Gövde `api/_akis.js`'te; burada yalnız BIST mali tablosunun nereden
//  geleceği bağlanıyor. Taşıyıcı dosya sistemi bilmez (Vercel'de koşacak),
//  bu yüzden çözücüyü çağıran verir: sunucu canlı fetchIsYatirimMali, test
//  diskteki kaydı. İmza değişmedi — run.mjs eskisi gibi `{ net }` geçiyor.
// ---------------------------------------------------------------------
export async function scoreOne(eng, K, row, vade, opt = {}) {
  return akisScoreOne(eng, K, row, vade, {
    net: opt.net,
    // opt.mali açıkça verildiyse (null dahil) ona uy; verilmediyse kayda bak.
    getMali: async (sym) => (opt.mali !== undefined ? opt.mali : loadMali(sym)),
  });
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
