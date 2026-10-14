// ===========================================================================
//  tests/duman.mjs — CANLI DUMAN TESTİ        ·   ELLE KOŞULUR · CANLI AĞ
//                                            ·   CI'DA KOŞMAZ
// ===========================================================================
//
//  ⚠️ BU DOSYA VARSAYILAN TEST ZİNCİRİNE GİRMEZ. Kapı dörtlüsü
//  (uretim-test · uc-test · parity · PARITE_MOTOR=uretilmis parity) tamamen
//  ÇEVRİMDIŞIDIR; bu dosya ise Yahoo'ya, SEC'e ve İş Yatırım'a GERÇEKTEN
//  çıkar. Elle koşulur, CI'da koşmaz, otomatik bir adıma bağlanmaz.
//  (.github/workflows/poll-kap.yml yalnız worker/ altını koşuyor — buraya
//  sızma yolu yok; eklenirse bu uyarı yalan olur.)
//
//  NİYE VAR: /api/score ve /api/recommend yazıldığı günden beri tek bir
//  gerçek HTTP isteği yapmadı. vercel.json'daki memory/maxDuration değerleri
//  score için ölçüsüz seçilmiş, recommend için score'dan KOPYALANMIŞTI
//  (api/recommend.js kendi yorumunda "ÖLÇÜLMEDİ, TAHMİN" diyordu). Bu dosya
//  tahminin yerine SAYI koyar: duvar saati, tepe bellek, dönen alan listesi,
//  tam/kesinti sayaçları.
//
//  NE ÖLÇER
//    · duvar saati süresi  — handler çağrısının başı/sonu (maxDuration için)
//    · tepe heapUsed / rss — çağrı boyunca ÖRNEKLEME ile (memory için)
//    · gövde alan listesi  — istemci sözleşmesinin gerçekten döneni
//    · tam + sayaç         — ölçüm kesintili bir ağda mı yapıldı?
//
//  NİYE HER UÇ AYRI SÜREÇTE: Vercel'de her fonksiyon kendi lambda'sında
//  koşar, kendi belleğiyle. İki ucu aynı süreçte ölçmek ikinci ucun tepe
//  değerine birincinin çöp toplanmamış artığını katar. Ebeveyn süreç her uç
//  için bir çocuk doğurur (DUMAN_UC=score|recommend), çocuk TEK bir handler
//  çağrısı yapar ve ölçümü tek satır JSON olarak basar.
//
//  NİYE ÖRNEKLEME: Node bir "tepe bellek" sayacı tutmuyor;
//  process.memoryUsage() anlık değer veriyor. ÖRNEKLEME_MS aralığıyla
//  yoklanıyor — yani tepe değer ALT SINIRDIR, iki örnek arasında daha
//  yükseğine çıkmış olabilir. Marj bu yüzden cömert seçilmeli; vercel.json
//  gerekçesi buna dayanıyor.
//
//  SEC YOLU LOKALDE NASIL ÇALIŞIYOR: motorun secGet'i MY_PROXY boşsa
//  hiçbir şey denemeden null döner. api/_ag.js konağa MY_PROXY = 'sec:'
//  (SEC_ONEK) koyuyor; agFetch bu öneki görünce arkasındaki gerçek SEC
//  adresini çözüp izin listesinden geçirip DOĞRUDAN sec.gov'a çıkıyor.
//  Yani ne ortam değişkeni ne dağıtılmış bir proxy gerekiyor — api/proxy.js
//  bu testte hiç devreye girmiyor.
//
//  SINIRLAR — BİLEREK
//    · EN ÇOK 2 SEMBOL (biri ABD biri BIST). Üçüncü bir uzak tarafı boşuna
//      yormuyoruz; ölçüm için iki sembol yeterli.
//    · Tek çağrı, tek tur. Retry fırtınası YOK: uzak taraf 403/429/5xx
//      verirse sayaçta `kesinti` olarak görünür ve rapor gerçeği yazar.
//    · UA DEĞİŞTİRİLMEZ (api/_ag.js:41 "yeniden ölçmeden değiştirmeyin").
//      Kullanıcının e-posta adresi hiçbir başlığa konmaz.
//    · FİKSTÜRE YAZMAZ. tests/baseline.json ve tests/fixtures/ bu dosya
//      tarafından OKUNMAZ ve YAZILMAZ. Fikstür tazelemek capture.mjs'in işi
//      ve o ayrı bir karardır.
//
//  KOŞUM
//      node tests/duman.mjs                  # iki uç
//      node tests/duman.mjs score            # yalnız biri
//      DUMAN_SEMBOL=AAPL,ASELS.IS node tests/duman.mjs
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const UCLAR = ['score', 'recommend'];
const SEMBOLLER = process.env.DUMAN_SEMBOL || 'AAPL,ASELS.IS';
const VADE = process.env.DUMAN_VADE || 'orta';
const ORNEKLEME_MS = 20;
const MB = (b) => Math.round((b / 1048576) * 10) / 10;

// =========================================================================
//  ÇOCUK — tek ucu ölç
// =========================================================================
if (process.env.DUMAN_UC) {
  const uc = process.env.DUMAN_UC;
  if (!UCLAR.includes(uc)) { console.error(`bilinmeyen uc: ${uc}`); process.exit(2); }

  const mod = await import(new URL(`../api/${uc}.js`, import.meta.url).href);
  const handler = mod.default;

  // Vercel'in verdiği `res` nesnesinin kullandığımız kadarı — uc-test.mjs'teki
  // sahteRes ile aynı yüzey. Oradan BİLEREK kopyalandı: bu dosya kapı
  // zincirine girmiyor, çevrimdışı testi canlı ağ testine bağımlı yapmak
  // istemiyoruz.
  const res = { kod: null, govde: null, basliklar: {}, bitti: false };
  res.setHeader = (k, v) => { res.basliklar[String(k).toLowerCase()] = String(v); };
  res.status = (k) => { res.kod = k; return res; };
  res.json = (g) => { res.govde = g; return res; };
  res.end = () => { res.bitti = true; return res; };

  // Modül yüklendikten SONRAKİ taban: konak + motor kurulumu da dahil.
  // Tepe değerden bunu ÇIKARMIYORUZ — lambda'nın ödediği bellek bu taban
  // dahil olan toplam.
  const taban = process.memoryUsage();
  let tepeHeap = taban.heapUsed, tepeRss = taban.rss, ornek = 0;
  const yokla = () => {
    const m = process.memoryUsage();
    if (m.heapUsed > tepeHeap) tepeHeap = m.heapUsed;
    if (m.rss > tepeRss) tepeRss = m.rss;
    ornek++;
  };
  const zamanlayici = setInterval(yokla, ORNEKLEME_MS);

  const t0 = process.hrtime.bigint();
  let patlak = null;
  try {
    await handler({ method: 'GET', query: { symbols: SEMBOLLER, vade: VADE } }, res);
  } catch (e) {
    patlak = (e && e.message) || String(e);
  }
  const duvarMs = Number(process.hrtime.bigint() - t0) / 1e6;
  clearInterval(zamanlayici);
  yokla();

  const g = res.govde || {};
  const olcum = {
    uc,
    kod: res.kod,
    patlak,
    duvarMs: Math.round(duvarMs),
    icMs: g.ms == null ? null : g.ms,        // ucun kendi ölçtüğü süre
    tabanHeap: taban.heapUsed,
    tabanRss: taban.rss,
    tepeHeap,
    tepeRss,
    ornek,
    alanlar: Object.keys(g).sort(),
    tam: g.tam == null ? null : g.tam,
    sayac: g.sayac || null,
    basliklar: res.basliklar,
    sonuclar: Array.isArray(g.sonuclar) ? g.sonuclar.map((s) => ({
      sym: s.sym,
      market: s.market,
      tam: s.tam,
      taScore: s.ta ? s.ta.score : null,
      faScore: s.fa ? s.fa.score : null,
      compositeBand: s.composite ? s.composite.band : null,
      planVar: Object.prototype.hasOwnProperty.call(s, 'plan') ? s.plan != null : null,
      sayac: s.sayac || null,
      kayitAlanlari: Object.keys(s).sort(),
    })) : null,
    atlanan: g.atlanan || null,
    surum: g.surum || null,
  };
  console.log('DUMAN_JSON ' + JSON.stringify(olcum));
  process.exit(0);
}

// =========================================================================
//  EBEVEYN — her uç için bir çocuk, sonra tablo
// =========================================================================
const istenen = process.argv.slice(2).filter((a) => UCLAR.includes(a));
const kosulacak = istenen.length ? istenen : UCLAR;
const buDosya = fileURLToPath(import.meta.url);

console.log('='.repeat(74));
console.log('  CANLI DUMAN TESTI — gercek aga cikar, CI\'da kosmaz');
console.log('='.repeat(74));
console.log(`  semboller : ${SEMBOLLER}`);
console.log(`  vade      : ${VADE}`);
console.log(`  ornekleme : ${ORNEKLEME_MS} ms (tepe bellek ALT SINIRDIR)`);
console.log(`  uclar     : ${kosulacak.join(', ')}`);
console.log('');

function cocuk(uc) {
  return new Promise((coz) => {
    const p = spawn(process.execPath, [buDosya], {
      env: { ...process.env, DUMAN_UC: uc, DUMAN_SEMBOL: SEMBOLLER, DUMAN_VADE: VADE },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let cikti = '', hata = '';
    p.stdout.on('data', (d) => { cikti += d; });
    p.stderr.on('data', (d) => { hata += d; });
    p.on('close', (kod) => {
      const satir = cikti.split(/\r?\n/).find((s) => s.startsWith('DUMAN_JSON '));
      let olcum = null;
      if (satir) { try { olcum = JSON.parse(satir.slice('DUMAN_JSON '.length)); } catch { /* altta raporlanir */ } }
      coz({ uc, kod, olcum, hata: hata.trim(), cikti: cikti.trim() });
    });
  });
}

const sonuc = [];
for (const uc of kosulacak) {
  process.stdout.write(`  -> /api/${uc} kosuyor...`);
  const r = await cocuk(uc);
  process.stdout.write(r.olcum ? ` ${r.olcum.duvarMs} ms\n` : ' OLCULEMEDI\n');
  sonuc.push(r);
}

console.log('');
for (const r of sonuc) {
  console.log('-'.repeat(74));
  console.log(`/api/${r.uc}`);
  console.log('-'.repeat(74));
  if (!r.olcum) {
    console.log(`  x olcum alinamadi (cocuk cikis kodu ${r.kod})`);
    if (r.hata) console.log(`    stderr: ${r.hata.split(/\r?\n/).slice(0, 8).join('\n            ')}`);
    continue;
  }
  const o = r.olcum;
  console.log(`  HTTP               : ${o.kod}${o.patlak ? `   ! handler firlatti: ${o.patlak}` : ''}`);
  console.log(`  duvar saati        : ${o.duvarMs} ms      (ucun kendi ms alani: ${o.icMs})`);
  console.log(`  taban heapUsed/rss : ${MB(o.tabanHeap)} / ${MB(o.tabanRss)} MB   (modul+motor kurulumu sonrasi)`);
  console.log(`  TEPE heapUsed      : ${MB(o.tepeHeap)} MB`);
  console.log(`  TEPE rss           : ${MB(o.tepeRss)} MB      (${o.ornek} ornek)`);
  console.log(`  govde alanlari     : ${o.alanlar.join(', ')}`);
  console.log(`  tam                : ${o.tam}`);
  console.log(`  atlanan            : ${JSON.stringify(o.atlanan)}`);
  if (o.sayac) {
    const s = o.sayac;
    console.log(`  genel sayac        : yahoo ${s.yahoo.istek} istek / ${s.yahoo.kesinti} kesinti · ` +
      `sec ${s.sec.istek} istek / ${s.sec.yok} yok / ${s.sec.kesinti} kesinti · ` +
      `bist ${s.bist.istek} istek / ${s.bist.kesinti} kesinti · tekrar ${s.tekrar}`);
  }
  if (o.surum) console.log(`  surum              : motor ${o.surum.motor} · ayar ${o.surum.ayar}`);
  console.log(`  cache-control      : ${o.basliklar['cache-control'] || '-'}`);
  if (o.sonuclar) {
    for (const s of o.sonuclar) {
      const c = s.sayac;
      console.log(`    · ${s.market}:${s.sym}  ta=${s.taScore}  fa=${s.faScore}  ` +
        `bileske=${s.compositeBand}  plan=${s.planVar}  tam=${s.tam}`);
      if (c) console.log(`        sayac: yahoo ${c.yahoo.istek}/${c.yahoo.kesinti} · ` +
        `sec ${c.sec.istek}/${c.sec.yok}/${c.sec.kesinti} · bist ${c.bist.istek}/${c.bist.kesinti} · tekrar ${c.tekrar}`);
      console.log(`        kayit alanlari: ${s.kayitAlanlari.join(', ')}`);
    }
  }
}

// ---- vercel.json için ölçülen girdi --------------------------------------
// Bu bir ÖNERİ, karar değil: tepe rss örneklemeyle alındığı için alt sınır.
// Vercel'in bellek kademeleri sabit; en yakın üst kademeye çıkıp üstüne pay
// bırakmak gerekiyor. Pay niye büyük: (a) tepe değer alt sınır, (b) sıcak
// lambda'da art arda istek çöp toplanmadan üst üste binebilir, (c) belleği
// aşan lambda 500 döner — fazladan bellek ucuz, çöken uç pahalı.
const KADEMELER = [128, 256, 512, 1024, 1769, 3008];
const basarili = sonuc.filter((r) => r.olcum && r.olcum.kod === 200);
if (basarili.length) {
  const enTepe = Math.max(...basarili.map((r) => r.olcum.tepeRss));
  const enUzun = Math.max(...basarili.map((r) => r.olcum.duvarMs));
  const ikiKat = MB(enTepe * 2);
  console.log('');
  console.log('-'.repeat(74));
  console.log('vercel.json icin olculen girdi');
  console.log('-'.repeat(74));
  console.log(`  olculen en yuksek tepe rss : ${MB(enTepe)} MB`);
  console.log(`  olculen en uzun duvar saati: ${enUzun} ms  (~${Math.round(enUzun / 1000)} s)`);
  console.log(`  2x pay ile taban           : ${ikiKat} MB -> en yakin kademe: ${KADEMELER.find((k) => k >= ikiKat) || 3008}`);
  console.log('  NOT: lokal olcum Windows/Node surumune bagli; Vercel fra1 lambda\'si');
  console.log('       ayni degeri vermez. Bu sayi TAHMINDEN iyi, dagitim olcumunden kotu.');
}

const kotu = sonuc.filter((r) => !r.olcum || r.olcum.kod !== 200 || r.olcum.tam !== true);
console.log('');
if (kotu.length) {
  console.log(`! ${kotu.length} uc yesil degil: ${kotu.map((r) => r.uc).join(', ')} — yukaridaki sayaclara bak.`);
} else {
  console.log(`OK — ${sonuc.length} uc da 200 + tam=true dondu.`);
}
console.log('Bilgi amaclidir, yatirim tavsiyesi degildir.');
