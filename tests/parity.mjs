// =====================================================================
//  SKOR PARİTESİ TESTİ  (tests/parity.mjs)   —   `node tests/parity.mjs`
// ---------------------------------------------------------------------
//  Dondurulmuş girdiler üzerinde motoru YENİDEN koşturur ve çıktıyı
//  tests/baseline.json ile karşılaştırır. Beklenen sonuç: FARK 0.
//
//  Bu testin varlık nedeni: /api/score çıkarımı sırasında skor 73'ten
//  71'e kayarsa, elle gözle BUNU FARK ETMEK İMKÂNSIZ. Motor parçalanmaya
//  başlamadan önce "doğru cevap" dondurulmak zorunda.
//
//  KASITLI AYRIM:
//    · skor/ağırlık/bant/sınıf farkı  → HATA (çıkış kodu 1)
//    · dilim satır sayısı değişimi    → UYARI (app.js düzenlenmiş olabilir;
//      skor aynı kaldıysa bu bir sorun DEĞİL — test "kaynak değişmedi"
//      demez, "skor değişmedi" der)
//    · kurulmuş cümleler              → hiç dondurulmaz, karşılaştırılmaz
//
//  AĞA ÇIKIŞ YOK: fikstürde olmayan tek bir istek bile testi patlatır,
//  böylece "veri gelmedi → skor null → iki taraf da null → geçti" sahte
//  başarısı imkânsız.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { TESTS } from './engine.mjs';
import { runAll } from './run.mjs';

const REF = path.join(TESTS, 'baseline.json');

if (!fs.existsSync(REF)) {
  console.error('baseline.json yok — karşılaştıracak referans bulunamadı.');
  console.error('  Önce: node tests/capture.mjs   (ham girdileri dondurur)');
  console.error('  Sonra: node tests/baseline.mjs (doğru cevabı dondurur)');
  process.exit(1);
}

// ---------------------------------------------------------------------
//  Derin fark. Yol adlarıyla rapor verir ki "hangi gösterge kaydı"
//  sorusu tek bakışta cevaplanabilsin.
// ---------------------------------------------------------------------
function diff(a, b, at, out) {
  if (a === b) return;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) { out.push({ at, was: a, now: b, note: `tür ${ta} → ${tb}` }); return; }
  if (ta === 'array') {
    if (a.length !== b.length) {
      out.push({ at: at + '.length', was: a.length, now: b.length });
      return; // uzunluk kaydıysa öge-öge fark gürültüden başka bir şey değil
    }
    for (let i = 0; i < a.length; i++) diff(a[i], b[i], `${at}[${i}]`, out);
    return;
  }
  if (ta === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a)) { out.push({ at: `${at}.${k}`, was: '(yok)', now: b[k] }); continue; }
      if (!(k in b)) { out.push({ at: `${at}.${k}`, was: a[k], now: '(yok)' }); continue; }
      diff(a[k], b[k], `${at}.${k}`, out);
    }
    return;
  }
  out.push({ at, was: a, now: b });
}

// NaN JSON'da null'a dönüşür — round-trip onu gizler. Önce ham tarama.
function scanNaN(v, at, out) {
  if (typeof v === 'number') { if (Number.isNaN(v)) out.push(at); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) scanNaN(v[k], `${at}.${k}`, out);
}

const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
const rawLive = await runAll();

const nans = [];
scanNaN(rawLive, '', nans);

// Her iki taraf da aynı JSON normalleşmesinden geçsin (undefined/NaN/eksik
// anahtar farkları sahte fark üretmesin) — baseline.json zaten JSON'dur.
const live = JSON.parse(JSON.stringify(rawLive));

const fmt = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));
const pad = (s, n) => String(s).padEnd(n);

console.log('SKOR PARİTESİ TESTİ');
console.log(`  referans : ${path.basename(REF)} (${ref._meta?.olusturuldu || 'tarih yok'})`);
console.log(`  evren    : ${Object.keys(ref.symbols).length} sembol · vade=${ref.vade}`);
console.log(`  taşıma   : yalnız fikstür (ağa çıkış yok) — ${live._okunan.yahoo} Yahoo, ${live._okunan.sec} SEC okuma`);
console.log('');

// --- 1) dilim sürüklenmesi: UYARI, hata değil --------------------------
const refSlice = (ref.dilimler || []).reduce((a, s) => a + s.lines, 0);
const liveSlice = (live.dilimler || []).reduce((a, s) => a + s.lines, 0);
if (refSlice !== liveSlice) {
  console.log(`  ⚠ motor kaynağı değişmiş: ${refSlice} → ${liveSlice} satır.`);
  for (const s of live.dilimler) {
    const o = (ref.dilimler || []).find((x) => x.name === s.name);
    if (o && o.lines !== s.lines) console.log(`      ${pad(s.name, 10)} ${o.lines} → ${s.lines} satır`);
  }
  console.log('    Skorlar aşağıda aynı kaldıysa SORUN YOK — düzenleme skoru etkilememiş.');
  console.log('');
}

// --- 2) asıl karşılaştırma -------------------------------------------
// _meta (tarih/node sürümü) ve dilimler kasten dışarıda.
const strict = (o) => {
  const { _meta, dilimler, ...rest } = o;
  return rest;
};
const found = [];
diff(strict(ref), strict(live), '', found);

// Sembol başına grupla ki tablo okunabilir olsun.
const bySym = new Map();
const other = [];
for (const d of found) {
  const m = /^\.symbols\.([^.[]+)/.exec(d.at) || /^\.holistic\.([^.[]+)/.exec(d.at);
  if (m) {
    if (!bySym.has(m[1])) bySym.set(m[1], []);
    bySym.get(m[1]).push(d);
  } else other.push(d);
}

const names = [...Object.keys(ref.symbols), ...Object.keys(ref.holistic)];
for (const name of names) {
  const ds = bySym.get(name) || [];
  const r = ref.symbols[name];
  const tag = r
    ? `ta ${pad(r.ta.score ?? '—', 4)} fa ${pad(r.fa.score ?? '—', 4)} bileşke ${pad(r.composite.blendedShown ?? '—', 4)}`
    : `skor ${pad(ref.holistic[name].score10, 5)}/10`;
  if (!ds.length) {
    console.log(`  ✓ ${pad(name, 28)} ${tag}`);
  } else {
    console.log(`  ✗ ${pad(name, 28)} ${tag}   — ${ds.length} FARK`);
    for (const d of ds.slice(0, 8)) {
      const short = d.at.replace(new RegExp(`^\\.(symbols|holistic)\\.${name}\\.?`), '');
      console.log(`        ${pad(short || '(kök)', 34)} ${fmt(d.was)}  →  ${fmt(d.now)}${d.note ? '   [' + d.note + ']' : ''}`);
    }
    if (ds.length > 8) console.log(`        … ve ${ds.length - 8} fark daha`);
  }
}

if (other.length) {
  console.log('');
  console.log('  sembol dışı farklar (sabitler / evren / fikstür okuma):');
  for (const d of other) {
    console.log(`      ${pad(d.at, 40)} ${fmt(d.was)}  →  ${fmt(d.now)}${d.note ? '   [' + d.note + ']' : ''}`);
  }
}

console.log('');
if (nans.length) {
  console.log(`  ⚠ ${nans.length} alanda NaN üretildi (JSON'da null'a dönüşüp gizlenir):`);
  for (const n of nans.slice(0, 10)) console.log('      ' + n);
}

if (found.length === 0 && nans.length === 0) {
  console.log(`✅ FARK 0 — parite tam. ${names.length} karşılaştırma noktası birebir aynı.`);
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(0);
}

console.log(`❌ PARİTE BOZUK — ${found.length} fark${nans.length ? ` + ${nans.length} NaN` : ''}.`);
console.log('');
console.log('  Ne yapmalı:');
console.log('    1) Yukarıdaki yol adı hangi göstergenin/kriterin kaydığını söyler.');
console.log('    2) Kayma İSTENMEYEN ise: app.js\'teki değişikliği geri al.');
console.log('    3) Kayma BİLİNÇLİ bir iyileştirme ise: node tests/baseline.mjs --zorla');
console.log('       (bunu yapmak "yeni doğru cevap bu" demektir — hafife alma.)');
console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
process.exit(1);
