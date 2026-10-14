// ===========================================================================
//  tests/sure.mjs — SÜRE TAVANI ÖLÇÜMÜ   ·   BELİRLENİMCİ · AĞA ÇIKMAZ
//                                        ·   ELLE KOŞULUR · CI'DA KOŞMAZ
// ===========================================================================
//
//  NİYE VAR: tests/duman.mjs (canlı ağ) 2026-10-14'te bir açık ÖLÇTÜ —
//  bozuk ağda AAPL+ASELS.IS için TEK ÇAĞRI 76,3 sn sürdü (31 SEC isteğinin
//  27'si kesinti). `BUTCE_MS` freni çalıştı (`tam:false`) ama 76,3 sn
//  `maxDuration` 60'ı aştı: Vercel o lambda'yı KESER, istemci gövdesiz bir
//  504 görür. Açık ÜÇ UCUN DA açığıydı.
//
//  O ölçüm TEKRARLANAMAZDI: "bozuk ağ" bir kaza, sipariş edilemez. Bu dosya
//  kazayı SİPARİŞ EDİLEBİLİR hale getirir — gerçek ağın yerine bir KARA
//  DELİK ağ koyar (hiç cevap vermez, yalnız iptal sinyaline uyar) ve ucun
//  duvar saatini ölçer. Hiçbir paket dışarı çıkmaz; sonuç her koşumda aynı.
//
//  NİYE globalThis.fetch YAMASI (üretim koduna test kancası DEĞİL):
//  api/_ag.js'in `cek()`i çıplak `fetch(...)` çağırıyor, yani çözüm anında
//  `globalThis.fetch`e düşüyor. Yamayı oraya koyunca `cek()`in GERÇEK
//  makinesi koşuyor: kendi AbortController'ı, kendi setTimeout'u, kendi
//  `finally`si. Üretim koduna "test modu" diye bir dal açmak bu makineyi
//  ölçüm dışında bırakırdı — ölçtüğümüz şey ölçmek istediğimiz şey olmazdı.
//
//  KARA DELİK NİYE İPTALE UYUYOR: gerçek `fetch` bir AbortSignal verilince
//  sinyal düşünce sözü REDDEDER. Uymayan bir sahte ağ `cek()`i sonsuza
//  kilitlerdi ve ölçüm hiç bitmezdi — yani yamanın iptale uyması bir kolaylık
//  değil, GERÇEĞE BENZEME koşulu.
//
//  NE ÖLÇER
//    · duvar saati — handler çağrısının başı/sonu (maxDuration'ın baktığı şey)
//    · kod + gövde — tavana çarpmak 200 mü döndürüyor, `tam` ne diyor
//    · sayaç       — `yok` (404 = veri cevabı) ile `kesinti` ayrımı korundu mu
//
//  SÖZLEŞME — TAVANA ÇARPMAK ARIZA DEĞİL: fren işini yapınca uç YİNE 200
//  döner, etkilenen sembol `tam:false` olur ("ölçemedim"). Bu, `score:null`
//  + `tam:true` ("ölçtüm, o şirkette o kalem yok") ile KARIŞTIRILMAMALI.
//  Sessiz sıfır yok: ölçülemeyen şey sayaçta `kesinti` olarak görünür.
//
//  SINIRLAR — BİLEREK
//    · Bu dosya ÜRETİM SABİTLERİYLE koşar (api/_ag.js TUR_TAVAN_MS /
//      TUR_BUTCE_MS, yahooMs/secMs/isMs varsayılanları). Yani YAVAŞTIR:
//      tavan 50 sn ise koşum da ~50 sn sürer. Kapı dörtlüsüne bu yüzden
//      GİRMEZ. Ölçeklenmiş, saniyenin altında koşan ve CI'da koşan ikizi
//      tests/uc-test.mjs ⑦ bölümünde (orada tavan opsiyonla küçültülüyor).
//    · FİKSTÜRE DOKUNMAZ: tests/baseline.json ve tests/fixtures/ ne okunur
//      ne yazılır.
//    · UA DEĞİŞTİRİLMEZ. Zaten tek bir paket dışarı çıkmıyor.
//
//  KOŞUM
//      node tests/sure.mjs                 # üç uç
//      node tests/sure.mjs score           # yalnız biri
//      SURE_SEMBOL=AAPL,ASELS.IS node tests/sure.mjs
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const UCLAR = ['score', 'recommend', 'analyze'];
// İki sembol: biri ABD (SEC yolu — 31 istek), biri BIST (İş Yatırım yolu,
// üç yılı SIRAYLA deniyor). 76,3 sn'lik canlı ölçüm de bu çiftle alınmıştı.
const SEMBOLLER = process.env.SURE_SEMBOL || 'AAPL,ASELS.IS';
const VADE = process.env.SURE_VADE || 'orta';

// =========================================================================
//  ÇOCUK — tek ucu ölç
//
//  NİYE AYRI SÜREÇ: `globalThis.fetch` yaması SÜREÇ GENELİNDE. Üç ucu aynı
//  süreçte ölçmek, ilk ucun modül düzeyinde kurduğu konağı (ve onun sıcak
//  SEC önbelleklerini) ikinci ölçüme taşırdı. Her uç kendi lambda'sında
//  koşuyor; ölçüm de öyle koşmalı. tests/duman.mjs aynı gerekçeyle böyle.
// =========================================================================
if (process.env.SURE_UC) {
  const uc = process.env.SURE_UC;
  if (!UCLAR.includes(uc)) { console.error(`bilinmeyen uc: ${uc}`); process.exit(2); }

  // --- KARA DELİK AĞ: modül yüklenmeden ÖNCE kurulur ---------------------
  // api/_ag.js `fetch`i çağrı anında çözüyor, yani sıra teorik olarak önemsiz;
  // yine de yama ÖNCE kuruluyor ki modül düzeyi bir istek (yok, ama olsa)
  // gerçek ağa sızmasın.
  let istek = 0;
  globalThis.fetch = (url, o = {}) => {
    istek++;
    return new Promise((_coz, reddet) => {
      const iptal = () => {
        const e = new Error('The operation was aborted');
        e.name = 'AbortError';
        reddet(e);
      };
      const s = o.signal;
      if (s) {
        if (s.aborted) { iptal(); return; }
        s.addEventListener('abort', iptal, { once: true });
      }
      // Hiç çözülmez: uzak taraf paketi yutuyor. Tek çıkış iptal sinyali —
      // yani `cek()`in kendi zaman aşımı.
    });
  };

  const mod = await import(new URL(`../api/${uc}.js`, import.meta.url).href);
  const handler = mod.default;

  // Vercel `res`inin kullandığımız kadarı — tests/duman.mjs ve
  // tests/uc-test.mjs'teki sahteRes ile aynı yüzey.
  const res = { kod: null, govde: null, basliklar: {}, bitti: false };
  res.setHeader = (k, v) => { res.basliklar[String(k).toLowerCase()] = String(v); };
  res.status = (k) => { res.kod = k; return res; };
  res.json = (g) => { res.govde = g; return res; };
  res.end = () => { res.bitti = true; return res; };

  const t0 = process.hrtime.bigint();
  let patlak = null;
  try {
    await handler({ method: 'GET', query: { symbols: SEMBOLLER, vade: VADE } }, res);
  } catch (e) {
    patlak = (e && e.message) || String(e);
  }
  const duvarMs = Number(process.hrtime.bigint() - t0) / 1e6;

  const g = res.govde || {};
  console.log('SURE_JSON ' + JSON.stringify({
    uc,
    kod: res.kod,
    patlak,
    duvarMs: Math.round(duvarMs),
    icMs: g.ms == null ? null : g.ms,
    agIstek: istek,            // kara deliğe kaç paket gitti
    tam: g.tam == null ? null : g.tam,
    sayac: g.sayac || null,
    atlanan: g.atlanan || null,
    alanlar: Object.keys(g).sort(),
    sonuclar: Array.isArray(g.sonuclar) ? g.sonuclar.map((s) => ({
      sym: s.sym,
      market: s.market,
      tam: s.tam,
      taScore: s.ta ? s.ta.score : null,
      taWhy: s.ta ? s.ta.why || null : null,
      faScore: s.fa ? s.fa.score : null,
      faWhy: s.fa ? s.fa.why || null : null,
      sayac: s.sayac || null,
    })) : null,
  }));
  process.exit(0);
}

// =========================================================================
//  EBEVEYN
// =========================================================================
const istenen = process.argv.slice(2).filter((a) => UCLAR.includes(a));
const kosulacak = istenen.length ? istenen : UCLAR;
const buDosya = fileURLToPath(import.meta.url);

// maxDuration vercel.json'dan DEĞİL buradan okunmuyor: bu sayı üç ucun
// `export const config`unda yazılı ve ölçümün kıyas çizgisi o. Elle
// yazılmasının sebebi, ölçümün "60'ın altında mı" sorusuna bakması.
const MAX_DURATION_SN = 60;

console.log('='.repeat(74));
console.log('  SURE TAVANI OLCUMU — belirlenimci, aga cikmaz (kara delik fetch)');
console.log(`  semboller: ${SEMBOLLER}   vade: ${VADE}   kiyas: maxDuration ${MAX_DURATION_SN} sn`);
console.log('='.repeat(74));

const olcumler = [];
for (const uc of kosulacak) {
  process.stdout.write(`\n  ${uc} olculuyor (uzun surebilir, tavan kadar)...`);
  const cikti = await new Promise((coz) => {
    const p = spawn(process.execPath, [buDosya], {
      env: { ...process.env, SURE_UC: uc, SURE_SEMBOL: SEMBOLLER, SURE_VADE: VADE },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.on('close', () => coz(buf));
  });
  const satir = cikti.split('\n').find((l) => l.startsWith('SURE_JSON '));
  if (!satir) { console.log(' OLCULEMEDI (cocuk JSON basmadi)'); continue; }
  const o = JSON.parse(satir.slice('SURE_JSON '.length));
  olcumler.push(o);
  console.log(` ${(o.duvarMs / 1000).toFixed(1)} sn`);
}

// --- TABLO ---------------------------------------------------------------
console.log('\n' + '-'.repeat(74));
console.log('  OLCULEN');
console.log('-'.repeat(74));
for (const o of olcumler) {
  const asti = o.duvarMs > MAX_DURATION_SN * 1000;
  console.log(`\n  /api/${o.uc}`);
  console.log(`    duvar saati     : ${(o.duvarMs / 1000).toFixed(1)} sn  ${asti ? `>>> ${MAX_DURATION_SN} sn ASILDI — Vercel KESER` : `<= ${MAX_DURATION_SN} sn (tavan tuttu)`}`);
  console.log(`    ucun ic olcumu  : ${o.icMs == null ? '(govde yok)' : (o.icMs / 1000).toFixed(1) + ' sn'}`);
  console.log(`    HTTP kod        : ${o.kod}${o.patlak ? '  PATLAK: ' + o.patlak : ''}`);
  console.log(`    kara delige giden istek: ${o.agIstek}`);
  console.log(`    tam             : ${o.tam}`);
  console.log(`    atlanan         : ${JSON.stringify(o.atlanan)}`);
  if (o.sayac) {
    const s = o.sayac;
    console.log(`    sayac           : yahoo ${s.yahoo.istek}/${s.yahoo.kesinti}kes · sec ${s.sec.istek}/${s.sec.yok}yok/${s.sec.kesinti}kes · bist ${s.bist.istek}/${s.bist.kesinti}kes · tekrar ${s.tekrar}`);
  }
  for (const r of o.sonuclar || []) {
    console.log(`    ${r.market}:${r.sym} tam=${r.tam} ta=${r.taScore}${r.taWhy ? ' (' + r.taWhy + ')' : ''} fa=${r.faScore}${r.faWhy ? ' (' + r.faWhy + ')' : ''}`);
  }
}

// --- SÖZLEŞME DENETİMİ ---------------------------------------------------
// Ölçüm tek başına "iyi/kötü" demiyor; sözleşme diyor. Üç koşul:
//   ① duvar saati maxDuration'ın ALTINDA
//   ② tavana çarpan uç YİNE 200 döndü (arıza değil, fren)
//   ③ ölçülemeyen şey `tam:false` + sayaçta `kesinti` (sessiz sıfır yok)
console.log('\n' + '-'.repeat(74));
console.log('  SOZLESME');
console.log('-'.repeat(74));
let kirmizi = 0;
for (const o of olcumler) {
  const c1 = o.duvarMs <= MAX_DURATION_SN * 1000;
  const c2 = o.kod === 200;
  const kes = o.sayac ? (o.sayac.yahoo.kesinti + o.sayac.sec.kesinti + o.sayac.bist.kesinti) : 0;
  const c3 = o.tam === false && kes > 0;
  for (const [ad, v, not] of [
    [`① /api/${o.uc} duvar saati <= ${MAX_DURATION_SN} sn`, c1, `${(o.duvarMs / 1000).toFixed(1)} sn`],
    [`② /api/${o.uc} tavana carpinca YINE 200`, c2, `kod ${o.kod}`],
    [`③ /api/${o.uc} tam:false + sayacta kesinti (sessiz sifir yok)`, c3, `tam=${o.tam} kesinti=${kes}`],
  ]) {
    console.log(`  ${v ? 'OK  ' : 'KIRMIZI'} ${ad}  (${not})`);
    if (!v) kirmizi++;
  }
}
console.log('\n' + '-'.repeat(74));
console.log(kirmizi === 0
  ? `  TUM SOZLESME MADDELERI YESIL — ${olcumler.length} uc olculdu.`
  : `  ${kirmizi} MADDE KIRMIZI — yukaridaki olculen sayilara bak.`);
console.log('  Bilgi amaclidir, yatirim tavsiyesi degildir.');
process.exit(kirmizi === 0 ? 0 : 1);
