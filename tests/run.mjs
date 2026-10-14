// =====================================================================
//  PARİTE KOŞUSU  (tests/run.mjs)
// ---------------------------------------------------------------------
//  Dondurulmuş girdiler üzerinde motoru koşturup TEK bir anlık görüntü
//  nesnesi üretir. baseline.mjs bunu diske yazar, parity.mjs aynısını
//  üretip diske yazılanla karşılaştırır. İKİSİ DE BU DOSYAYI kullanır —
//  "referansı üreten kod" ile "paritesi ölçülen kod" aynı olmak zorunda,
//  yoksa test kendi iki kopyasını karşılaştırır ve hiçbir şey ölçmez.
//
//  AĞA ÇIKIŞ YOK: makeOfflineFetch yalnız fixtures/ altını servis eder,
//  kayıtta olmayan istek patlar. Böylece "veri çekemedim → skor null →
//  parite geçti" sahte başarısı imkânsız.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  buildEngine, readSymbols, makeOfflineFetch,
  scoreOne, round6,
} from './score.mjs';

// ---------------------------------------------------------------------
//  Sentetik bileşke vektörleri — computeHolisticScore (Sonuç/Yatırım Planı
//  skoru) ağ verisine HİÇ bağlı değil, saf fonksiyon. Elle yazılmış girdi
//  vektörleriyle dondurmak, taşımada en çok kayma riski taşıyan büyüme-
//  farkında değerleme direğini (growthSoft/slope/baseFair) kilitler.
// ---------------------------------------------------------------------
export const HOLISTIC_CASES = [
  ['bantta-kaliteli', {
    faScore: 72, taScore: 58, levels: { price: 100, buyZone: [92, 104] },
    revGrowth: 14, netMargin: 18, trailingPE: 22, forwardPE: 19, peg: 1.4,
  }],
  ['bant-alti-ucuz', {
    faScore: 65, taScore: 44, levels: { price: 85, buyZone: [90, 100] },
    revGrowth: 6, netMargin: 11, trailingPE: 9, forwardPE: 8, peg: 0.8,
  }],
  ['pahali-yavas-buyume', {
    faScore: 48, taScore: 52, levels: { price: 150, buyZone: [90, 100] },
    revGrowth: 4, netMargin: 7, trailingPE: 48, forwardPE: 40, peg: 4.5,
  }],
  ['pahali-hizli-buyume', {
    faScore: 70, taScore: 66, levels: { price: 150, buyZone: [90, 100] },
    revGrowth: 42, netMargin: 28, trailingPE: 55, forwardPE: 38, peg: 1.1,
  }],
  ['momentum-rejimi', {
    faScore: 61, taScore: 74, levels: { price: 150, buyZone: [90, 100] },
    momActive: true, revGrowth: 25, netMargin: 20, trailingPE: 40, forwardPE: 31, peg: 1.6,
  }],
  ['kar-oncesi-tematik', {
    faScore: 40, taScore: 60, levels: { price: 30, buyZone: [20, 25] },
    revGrowth: 60, netMargin: -15, trailingPE: null, forwardPE: null, peg: null,
  }],
  // PEG yok + F/K>25: cezali dal. Ciftin ikinci yarisi (revGrowth>=20) muaf —
  // ikisi birlikte muafiyet sinirini kilitler.
  ['peg-yok-pahali-fk', {
    faScore: 55, taScore: 50, levels: { price: 140, buyZone: [90, 100] },
    valuation: { pe: 34 }, revGrowth: 8, netMargin: 12, trailingPE: 34, forwardPE: 30, peg: null,
  }],
  ['peg-yok-pahali-ama-buyuyor', {
    faScore: 58, taScore: 55, levels: { price: 140, buyZone: [90, 100] },
    valuation: { pe: 34 }, revGrowth: 28, netMargin: 19, trailingPE: 34, forwardPE: 26, peg: null,
  }],
  ['veri-yok-notr', {
    faScore: null, taScore: null, levels: null,
  }],
];

export async function runAll(opt = {}) {
  const net = makeOfflineFetch();
  const eng = buildEngine({ fetch: net.fetch, fetchVia: net.fetchVia });
  const { rows, vade } = readSymbols();

  const symbols = {};
  const skipped = [];
  for (const row of rows) {
    const r = await scoreOne(eng, row, vade, { net });
    symbols[row.sym] = r;
    if (r.ta.score == null || r.fa.score == null) {
      skipped.push(`${row.sym} (ta=${r.ta.score} fa=${r.fa.score}${r.fa.why ? ' · ' + r.fa.why : ''}${r.ta.why ? ' · ' + r.ta.why : ''})`);
    }
  }

  // computeHolisticScore: metin BİÇİMİ kasten dondurulmuyor (FAZ 1/3 token
  // dizisine geçecek) — yalnız SKOR, bant ve sınıflandırma dondurulur.
  const holistic = {};
  for (const [name, inp] of HOLISTIC_CASES) {
    const h = eng.computeHolisticScore(inp);
    holistic[name] = {
      score10: round6(h.score10),
      band: h.band ? { l: h.band.l, c: h.band.c } : null,
      coreSoft: round6(h.coreSoft),
      thematic: !!h.thematic,
      growthCls: h.growthNote ? h.growthNote.cls : null,
      // app.js'te direk alanlari: k (ad), w (agirlik), v (0..1 deger), note, conf.
      // note = kurulmus cumle → dondurulmaz (FAZ 1/3 token dizisine gececek).
      parts: (h.parts || []).map((p) => ({
        k: p.k, w: round6(p.w), v: round6(p.v), conf: p.conf,
      })),
    };
  }

  return {
    _not: 'Skor paritesi referansı. Elle DÜZENLENMEZ — `node tests/baseline.mjs` ile yenilenir. Bilgi amaçlıdır, yatırım tavsiyesi değildir.',
    vade,
    // Sabitler MOTORDAN okunuyor (2026-10-14). Önceden readRenderConstants()
    // app.js ekran katmanından regex ile çıkarıyordu; kriter ve harman
    // motora devredildiği gün kaynak da motor oldu. Alan ADLARI ve
    // DEĞERLERİ bilerek aynı bırakıldı — baseline.json'u kaydırmamak için.
    sabitler: {
      pe: { weight: eng.FA_PE.weight, neg: eng.FA_PE.neg, bp: eng.FA_PE.bp },
      blend: { fa: eng.COMPOSITE_BLEND.fa, ta: eng.COMPOSITE_BLEND.ta },
      benchmark: eng._bench,
    },
    dilimler: eng._slices,
    symbols,
    holistic,
    _meta: opt.meta || {},
    _okunan: { yahoo: net.seen.yahoo, sec: net.seen.sec, secBos: net.seen.secMiss },
    _eksik: skipped,
  };
}
