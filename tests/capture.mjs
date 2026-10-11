// =====================================================================
//  HAM GİRDİ KAYDI  (tests/capture.mjs)   —   `node tests/capture.mjs`
// ---------------------------------------------------------------------
//  TEK SEFERLİK ve İNTERNET GEREKTİREN adım. 20 sembol için motorun
//  ihtiyaç duyduğu HAM girdileri tests/fixtures/ altına yazar:
//
//    yahoo/{YSEMBOL}_{aralik}_{periyot}.json → Yahoo chart yanıtının AYNISI
//    isyatirim/{SEMBOL}.json                 → fetchIsYatirimMali ÇIKTISI
//    sec/{SEMBOL}.json                       → {gerçek URL: metin | null}
//    sec/_tickers.json                       → company_tickers.json (küçültülmüş)
//
//  NEDEN ÇIKTI DEĞİL GİRDİ: parite testi "motor aynı girdiye aynı cevabı
//  veriyor mu" sorusunu sorar. Çıktıyı kaydedip çıktıyla karşılaştırmak
//  hiçbir şey ölçmez. Tek istisna İş Yatırım: URL'si new Date() ile
//  kuruluyor (yıl döndüğünde farklı yıl denenir) — o yüzden onun ÇIKTISI
//  donduruluyor ve motora parseIsMali'den giriliyor.
//
// ---------------------------------------------------------------------
//  ★ TAŞIMA HATASI VERİ DEĞİLDİR  (2026-10-11'de pahalı öğrenildi)
// ---------------------------------------------------------------------
//  Bu dosyanın ilk sürümü, vekil sunucu koşu ortasında erişilemez olunca
//  HER SEC isteğini `null` diye kaydetti — yani motora "bu us-gaap etiketi
//  YOK" dedi — ve 158 bankalanmış yanıtın ~140'ını üzerine yazdı. Parite
//  testinin tüm amacı sessiz kaymayı yakalamaktı; neredeyse bir ağ kesintisi
//  referans gerçek olarak donuyordu.
//
//  ÖLÇÜLDÜ (tahmin değil):
//    · SEC doğrudan, e-postasız UA ile          → HTTP 200
//    · SEC'te GERÇEKTEN olmayan us-gaap etiketi → HTTP 404  (temiz ayrım!)
//    · İş Yatırım MaliTablo doğrudan (tarayıcı başlıkları + Referer) → HTTP 200
//    · day-starter.vercel.app/api/proxy         → UND_ERR_CONNECT_TIMEOUT
//  → Vekil yolu ÇIKARILDI; her iki kaynağa DOĞRUDAN gidiliyor.
//
//  ÖLÇÜLDÜ: app.js:5963 `secGet` → `catch (e) { return null; }`.
//  Yani kabuktan FIRLATMAK işe yaramaz: motor onu da `null`a çevirir.
//  Bu yüzden taşıma hatası YAN KANALDA (failures[]) toplanır ve o sembolün
//  fikstürü HİÇ YAZILMAZ. Kayıt reddi, sessiz zehirlenmeden iyidir.
//
//  ÖLÇÜLDÜ: bankalanmış `null` geri alınamaz şekilde belirsizdir — "gerçek
//  404" mü, "zehirlenmiş kesinti" mi olduğu sonradan ayırt EDİLEMEZ. Kayıtlı
//  METİN ise tartışmasız kanıttır. Kural: METNE GÜVEN, NULL'U YENİDEN DOĞRULA.
//
//  Bu dosya parite koşusunda ÇALIŞMAZ. parity.mjs ağa hiç çıkmaz.
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import {
  buildEngine, readSymbols, FIX,
  DIR_YAHOO, DIR_IS, DIR_SEC, keySafe, yahooKey,
} from './score.mjs';

// Motora MY_PROXY olarak verilen işaretçi. secGet `base + encodeURIComponent(url)`
// kurar; kabuk öneki soyup GERÇEK adrese doğrudan gider. (`if (!base) return null`
// yüzünden boş olamaz.)
const SENTINEL = 'capture:';

// SEC: iletişim bilgisi İSTEMİYOR — e-postasız UA ölçülmüş HTTP 200 veriyor.
// Kullanıcının e-posta adresi buraya ASLA konmaz.
const UA_SEC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) sabah-bulteni-parite-testi';
const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const SEC_GAP_MS = 120;   // ≈8 istek/sn — SEC sınırı 10/sn
const SEC_TRY = 3;        // 429/5xx için yeniden deneme

for (const d of [FIX, DIR_YAHOO, DIR_IS, DIR_SEC]) fs.mkdirSync(d, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o));
const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const filledOf = (m) => Object.values(m).filter((v) => v !== null).length;

const stat = {
  yahoo: 0, yahooSkip: 0, yahooFail: 0,
  secNew: 0, sec404: 0, secReuse: 0, secRecheck: 0,
  is: 0, isSkip: 0, isFail: 0,
  refused: 0,
};

const resJson = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
const resText = (t) => ({ ok: true, status: 200, text: async () => t, json: async () => JSON.parse(t) });
const resMiss = () => ({ ok: false, status: 404, text: async () => '', json: async () => { throw new Error('404'); } });

// Sembol başına SEC bağlamı. `failures` doluysa fikstür YAZILMAZ.
let cur = null;
let lastSecAt = 0;

async function secThrottle() {
  const wait = SEC_GAP_MS - (Date.now() - lastSecAt);
  if (wait > 0) await sleep(wait);
  lastSecAt = Date.now();
}

// ---------------------------------------------------------------------
//  Kaydeden ağ kabuğu (fetch sözleşmesi: Response benzeri nesne)
// ---------------------------------------------------------------------
async function recFetch(url) {
  // --- Yahoo chart ---
  const ym = /\/v8\/finance\/chart\/([^?]+)\?range=([^&]+)&interval=([^&]+)/.exec(url);
  if (ym) {
    const k = yahooKey(decodeURIComponent(ym[1]), ym[2], ym[3]);
    const p = path.join(DIR_YAHOO, k + '.json');
    if (fs.existsSync(p)) { stat.yahooSkip++; return resJson(readJson(p)); }
    let j = null;
    for (let i = 0; i < 3 && !j; i++) {
      if (i) await sleep(800 * i);
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA_WEB, Accept: 'application/json' } });
        if (!r.ok) continue;
        const o = await r.json();
        if (o && o.chart && o.chart.result) j = o;
      } catch (_) { /* yeniden dene */ }
    }
    if (!j) { stat.yahooFail++; return resMiss(); }   // BAŞARISIZSA YAZMA
    writeJson(p, j);
    stat.yahoo++;
    return resJson(j);
  }

  // --- SEC (secGet, SENTINEL önekiyle gelir) ---
  if (url.startsWith(SENTINEL)) {
    const real = decodeURIComponent(url.slice(SENTINEL.length));

    // Ticker listesi: tüm semboller için ortak, KÜÇÜLTÜLMÜŞ yazılır.
    if (real.includes('company_tickers.json')) {
      const p = path.join(DIR_SEC, '_tickers.json');
      if (fs.existsSync(p)) return resText(fs.readFileSync(p, 'utf8'));
      await secThrottle();
      const r = await fetch(real, { headers: { 'User-Agent': UA_SEC } });
      if (!r.ok) throw new Error('ticker listesi alinamadi: HTTP ' + r.status);
      const txt = await r.text();
      const obj = JSON.parse(txt);
      const want = new Set(readSymbols().rows.filter((x) => x.market === 'US').map((x) => x.sym.toUpperCase()));
      const small = {};
      let i = 0;
      for (const e of Object.values(obj)) {
        if (e && e.ticker && want.has(String(e.ticker).toUpperCase())) small[i++] = e;
      }
      if (i !== want.size) throw new Error(`ticker eksik: ${i}/${want.size} bulundu`);
      const out = JSON.stringify(small);
      fs.writeFileSync(p, out);
      console.log(`  _tickers.json kucultuldu: ${(txt.length / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(1)} KB (${i} kayit)`);
      return resText(out); // küçültülmüşün YETTİĞİNİ aynı koşuda kanıtla
    }

    if (!cur) throw new Error('SEC istegi geldi ama sembol baglami yok');

    // Bankalanmış METİN tartışmasız kanıt → yeniden çekme.
    if (real in cur.banked) { stat.secReuse++; return resText(cur.banked[real]); }
    // Bu koşuda zaten karar verildi.
    if (real in cur.pending) {
      return cur.pending[real] === null ? resMiss() : resText(cur.pending[real]);
    }
    if (cur.nulled.has(real)) stat.secRecheck++;   // eski `null` yeniden doğrulanıyor

    let why = 'bilinmeyen';
    for (let i = 0; i < SEC_TRY; i++) {
      if (i) await sleep(1200 * i);
      await secThrottle();
      let r;
      try {
        r = await fetch(real, { headers: { 'User-Agent': UA_SEC } });
      } catch (e) {
        why = 'ag: ' + ((e.cause && e.cause.code) || e.name || e.message);
        continue;
      }
      // 404 = etiket GERÇEKTEN yok. Tek meşru `null` kaynağı. (ölçüldü)
      if (r.status === 404) { cur.pending[real] = null; stat.sec404++; return resMiss(); }
      if (!r.ok) { why = 'HTTP ' + r.status; continue; }
      let txt;
      try { txt = await r.text(); } catch (e) { why = 'govde: ' + e.message; continue; }
      // 200 + neredeyse boş gövde: veri değil, anomali. `null` olarak DONDURMA.
      if (!txt || txt.length <= 2) { why = 'HTTP 200 ama govde ' + (txt ? txt.length : 0) + ' bayt'; continue; }
      cur.pending[real] = txt; stat.secNew++;
      return resText(txt);
    }
    // Taşıma hatası: KAYDETME, yan kanala yaz, fikstür yazımı iptal olacak.
    cur.failures.push({ url: real, why });
    return resMiss();
  }

  throw new Error('kayitta beklenmeyen istek: ' + url);
}

// ---------------------------------------------------------------------
//  İş Yatırım: metin döndürür (app.js fetchVia sözleşmesi).
//  MaliTablo uç noktası DOĞRUDAN çalışıyor — tarayıcı başlıkları + Referer
//  şart (ölçüldü: HTTP 200, 27 KB). Ana sayfa zaman aşımına düşüyor ama
//  gerekmiyor.
// ---------------------------------------------------------------------
async function recFetchVia(url, { timeout = 20000 } = {}) {
  const cc = /companyCode=([A-Z0-9]+)/i.exec(url);
  const headers = {
    'User-Agent': UA_WEB,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: cc
      ? `https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=${cc[1]}`
      : 'https://www.isyatirim.com.tr/',
  };
  let last = 'bilinmeyen';
  for (let i = 0; i < 3; i++) {
    if (i) await sleep(1000 * i);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctl.signal });
      if (!r.ok) { last = 'HTTP ' + r.status; continue; }
      const txt = await r.text();
      if (!txt || txt.length <= 50) { last = 'bos yanit (' + (txt ? txt.length : 0) + ')'; continue; }
      return txt;
    } catch (e) {
      last = (e.cause && e.cause.code) || e.name || e.message;
    } finally { clearTimeout(t); }
  }
  throw new Error(last);
}

// ---------------------------------------------------------------------
//  SEC fikstürünü GERİLEME KORUMALI yaz.
//  Bugün AAPL/AMD/AMZN/GOOGL/META/MSFT/NVDA'yı kurtaracak olan koruma bu.
// ---------------------------------------------------------------------
function writeSecFixture(sym) {
  const p = path.join(DIR_SEC, keySafe(sym) + '.json');
  if (cur.failures.length) {
    stat.refused++;
    return `sec ⚠ YAZILMADI — ${cur.failures.length} tasima hatasi (${cur.failures[0].why})`;
  }
  const merged = { ...cur.banked, ...cur.pending };
  const disk = readJson(p);
  if (disk) {
    const was = filledOf(disk), now = filledOf(merged);
    if (now < was) {
      stat.refused++;
      return `sec ⚠ YAZILMADI — gerileme korumasi: ${was} dolu → ${now} dolu`;
    }
  }
  writeJson(p, merged);
  const hit = filledOf(merged);
  return `sec ✓ (${hit} dolu / ${Object.keys(merged).length - hit} yok-404)`;
}

// ---------------------------------------------------------------------
async function main() {
  const { rows, vade } = readSymbols();
  const eng = buildEngine({ myProxy: SENTINEL, fetch: recFetch, fetchVia: recFetchVia });
  const bench = eng._bench || {};

  console.log(`HAM GIRDI KAYDI — ${rows.length} sembol, vade=${vade}`);
  console.log('tasima: SEC + Is Yatirim DOGRUDAN (vekil yok). Var olan dosyalar atlanir.');
  console.log('kural: taşıma hatası veri değildir — hatali sembolun fiksturu YAZILMAZ.\n');

  // --- 1) Endeksler (RS göstergesi için) ---
  for (const m of ['BIST', 'US']) {
    const s = bench[m];
    if (!s) continue;
    try { await eng.fetchYahooOHLC(s, 'RAW', '5y', '1d'); console.log(`endeks ${m.padEnd(4)} ${s} ✓`); }
    catch (e) { console.error(`endeks ${m.padEnd(4)} ${s} ✗ ${e.message}`); }
  }
  console.log('');

  // --- 2) Sembol başına: mumlar + temel veri ---
  for (const row of rows) {
    const { sym, market } = row;
    const line = [];

    for (const range of ['5y', '1y']) {
      try {
        const r = await eng.fetchYahooOHLC(sym, market, range, '1d');
        line.push(`mum/${range} ${r && r.candles && r.candles.length ? '✓' : '✗ bos'}`);
      } catch (e) { line.push(`mum/${range} ✗`); }
    }

    if (market === 'BIST') {
      const p = path.join(DIR_IS, keySafe(sym) + '.json');
      if (fs.existsSync(p)) {
        const d = readJson(p);
        stat.isSkip++;
        line.push(`mali · atlandi (${d.years[0]}, ${d.rows.length} kalem)`);
      } else {
        try {
          const res = await eng.fetchIsYatirimMali(sym);
          if (res && res.rows && res.rows.length) {
            writeJson(p, res);
            stat.is++; line.push(`mali ✓ (${res.years[0]}, ${res.rows.length} kalem)`);
          } else { stat.isFail++; line.push('mali ✗ (motor bos dondu — YAZILMADI)'); }
        } catch (e) { stat.isFail++; line.push('mali ✗ ' + e.message); }
      }
    } else {
      // Diskteki haritayı yükle: METNE güven, `null`u yeniden doğrula.
      const disk = readJson(path.join(DIR_SEC, keySafe(sym) + '.json')) || {};
      const banked = {}; const nulled = new Set();
      for (const [k, v] of Object.entries(disk)) {
        if (v === null) nulled.add(k); else banked[k] = v;
      }
      cur = { sym, banked, nulled, pending: {}, failures: [] };
      try {
        await eng.secFetchModel(sym);
      } catch (e) {
        cur.failures.push({ url: '(motor)', why: e.message });
      }
      line.push(writeSecFixture(sym));
      if (cur.failures.length) {
        for (const f of cur.failures.slice(0, 3)) {
          console.error(`       ! ${f.why}  ${f.url.replace('https://data.sec.gov/api/xbrl/companyconcept/', '')}`);
        }
      }
      cur = null;
    }
    console.log(`${market.padEnd(4)} ${sym.padEnd(6)} ${line.join('  ·  ')}`);
  }

  console.log('\n--- ozet ---');
  console.log(`Yahoo mum : ${stat.yahoo} yeni, ${stat.yahooSkip} atlandi, ${stat.yahooFail} basarisiz`);
  console.log(`SEC istek : ${stat.secNew} yeni dolu, ${stat.sec404} gercek-404, ${stat.secReuse} bankadan, ${stat.secRecheck} null-yeniden-dogrulandi`);
  console.log(`Is Yatirim: ${stat.is} yeni, ${stat.isSkip} atlandi, ${stat.isFail} basarisiz`);
  console.log(`\nfixtures: ${FIX}`);

  const bad = stat.refused + stat.yahooFail + stat.isFail;
  if (bad) {
    console.error(`\n⚠ ${stat.refused} fikstur REDDEDILDI, ${stat.yahooFail} mum + ${stat.isFail} mali eksik.`);
    console.error('  Eksikler YAZILMADI — var olan iyi veri korundu. Tasima duzelince tekrar kos.');
    console.error('  Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
    process.exit(1);
  }
  console.log('Siradaki: node tests/baseline.mjs');
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
}

main().catch((e) => { console.error('KAYIT HATASI: ' + e.message); process.exit(1); });
