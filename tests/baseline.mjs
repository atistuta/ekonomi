// =====================================================================
//  REFERANS DONDURMA  (tests/baseline.mjs)
// ---------------------------------------------------------------------
//  `node tests/baseline.mjs`          → yoksa tests/baseline.json üretir
//  `node tests/baseline.mjs --zorla`  → VAR OLANI EZER (bilinçli onay)
//
//  ★ EZME KORUMASI NEDEN VAR: bu dosya "doğru cevap" dosyasıdır. Parite
//  testi kırmızı yandığında refleks olarak baseline'ı yenilemek, gerçek
//  bir skor kaymasını "yeni doğru" ilan etmek demektir — yani testi
//  sessizce iptal etmek. Ezmek için --zorla yazmak zorunda olmak, o anı
//  bir KARAR haline getirir.
//
//  Dondurulan: skorlar, ağırlıklar, bantlar, sınıf adları, kırılımlar.
//  Dondurulmayan: kurulmuş cümleler (not/txt) — FAZ 1/3'te token dizisine
//  geçecekleri için biçim değişikliği parite kırmamalı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { TESTS } from './engine.mjs';
import { runAll } from './run.mjs';

const OUT = path.join(TESTS, 'baseline.json');
const force = process.argv.includes('--zorla');

if (fs.existsSync(OUT) && !force) {
  console.error('baseline.json ZATEN VAR — üzerine yazılmadı.');
  console.error('');
  console.error('  Parite testi kırmızı yanıyorsa önce NEDENİNİ bul:');
  console.error('      node tests/parity.mjs');
  console.error('  Kayma gerçekten istenen bir değişiklikse, bilinçli olarak yenile:');
  console.error('      node tests/baseline.mjs --zorla');
  process.exit(1);
}

const snap = await runAll({
  meta: {
    olusturuldu: new Date().toISOString().slice(0, 10),
    node: process.version,
    // _meta parite karşılaştırmasına GİRMEZ (parity.mjs atlar) — yoksa
    // her yenilemede tarih değişip her koşu kırmızı yanardı.
  },
});

fs.writeFileSync(OUT, JSON.stringify(snap, null, 2) + '\n', 'utf8');

// Tabloda okunur bicim. DOSYAYA yazilan deger tam hassasiyettedir —
// bu yalnizca ekran bicimi.
const num = (v) => (v == null ? '—' : v.toFixed(1));

const n = Object.keys(snap.symbols).length;
console.log(`REFERANS DONDURULDU — ${n} sembol, ${Object.keys(snap.holistic).length} bileşke vektörü`);
console.log('');
console.log('  sembol   pazar    TA    FA  bileşke  bant');
console.log('  ' + '-'.repeat(48));
for (const [sym, r] of Object.entries(snap.symbols)) {
  const c = r.composite;
  console.log(
    '  ' + sym.padEnd(8) + String(r.market).padEnd(6)
    + num(r.ta.score).padStart(6)
    + num(r.fa.score).padStart(7)
    + String(c.blendedShown ?? '—').padStart(8)
    + '  ' + (c.band ?? '—'),
  );
}
console.log('');
console.log(`  fikstür okuma: ${snap._okunan.yahoo} Yahoo · ${snap._okunan.sec} SEC (${snap._okunan.secBos} boş etiket)`);
console.log(`  motor dilimi : ${snap.dilimler.reduce((a, s) => a + s.lines, 0)} satır`);
if (snap._eksik.length) {
  console.log('');
  console.log(`  ⚠ ${snap._eksik.length} sembolde eksik skor dondu — referans YİNE DE geçerli,`);
  console.log('    ama bu semboller parite açısından zayıf (null == null her zaman eşit):');
  for (const e of snap._eksik) console.log('      · ' + e);
}
console.log('');
console.log(`yazıldı: ${OUT}`);
console.log('Sıradaki: node tests/parity.mjs');
console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
