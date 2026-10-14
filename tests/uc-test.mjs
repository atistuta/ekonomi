#!/usr/bin/env node
// ===========================================================================
//  UÇ TESTİ — /api/score doğrulaması ve hata yolu   ·   AĞA ÇIKMAZ
// ===========================================================================
//
//  NEDEN VAR: /api/score'un asıl işi (gerçek skor) ağa çıkmadan sınanamaz —
//  onu `tests/parity.mjs` fikstürlerle, kullanıcı ise canlı koşuyla ölçüyor.
//  Ama uç noktanın KAPI kısmı — hangi girdiyi kabul ettiği, hangi kodla
//  reddettiği, hata gövdesinde ne sızdırdığı — tamamen saf mantık ve ağa
//  çıkmadan ölçülebilir. Ölçülmezse sessizce bozulur: bir yazım hatası
//  `cok_sembol` kontrolünü etkisizleştirip 8 sembol sınırını kaldırabilir
//  ve bunu kimse farketmez, çünkü cevap yine 200 döner.
//
//  NE ÖLÇER (4 bölüm)
//    ① yüzey              — default/ayristir/config yerinde mi
//    ② ayristir()         — pazar çözümü, yineleme, sınırlar, hata kodları
//    ③ handler kapısı     — CORS · OPTIONS · 405 · 4xx gövdeleri
//    ④ statik denetimler  — HAM SAYI kuralı ve sızıntı yasağı metinde
//
//  AĞ YASAĞI — BU TESTİN EN ÖNEMLİ KURALI: handler() yalnız ağ'a hiç
//  gitmeyecek isteklerle çağrılır (OPTIONS, GET-dışı yöntem, ya da
//  doğrulamadan DÖNEN geçersiz sorgu). GEÇERLİ bir GET sorgusuyla
//  çağrılırsa Yahoo/SEC/İş Yatırım'a gerçekten çıkar; test ağ durumuna
//  bağımlı hale gelir ve CI'da rastgele kırmızı yanar. Geçerli girdiler bu
//  yüzden yalnız `ayristir()` ile — ağ'a dokunmayan saf fonksiyon —
//  sınanıyor.
//
//  NOT: api/score.js'i import etmek modül düzeyinde canliAg() + buildMotor()
//  kuruyor. İkisi de yalnız kapanış/nesne kuruyor, TEK bir istek atmıyor —
//  ağ ancak handler bir sembolü skorlarken açılıyor.
//
//  KULLANIM
//    node tests/uc-test.mjs          → çıkış kodu 0 (hepsi geçti) / 1
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import handler, { ayristir, config, AZAMI_SEMBOL } from '../api/score.js';
import { VADELER } from '../api/_ayar.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCORE_PATH = path.join(ROOT, 'api', 'score.js');
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// --- küçük koşum defteri (tests/uretim-test.mjs ile aynı kalıp) -----------
let gecen = 0;
const hatalar = [];
const ok = (ad, kosul, ek = '') => {
  if (kosul) { gecen++; console.log(`  ✓ ${ad}${ek ? `  (${ek})` : ''}`); }
  else { hatalar.push(ad + (ek ? ` — ${ek}` : '')); console.log(`  ✗ ${ad}${ek ? ` — ${ek}` : ''}`); }
};
const bolum = (ad) => console.log(`\n${ad}`);
const bitir = () => {
  console.log(`\n${'─'.repeat(70)}`);
  if (hatalar.length) {
    console.log(`❌ ${hatalar.length} başarısız / ${gecen + hatalar.length} denetim`);
    for (const h of hatalar) console.log(`   · ${h}`);
    console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
    process.exit(1);
  }
  console.log(`✅ ${gecen} denetim geçti — /api/score kapısı ve doğrulaması yerinde.`);
  console.log('Bilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(0);
};

/** Vercel'in verdiği `res` nesnesinin sınandığımız kadarı. */
function sahteRes() {
  const r = { kod: null, govde: null, basliklar: {}, bitti: false };
  r.setHeader = (k, v) => { r.basliklar[String(k).toLowerCase()] = String(v); };
  r.status = (k) => { r.kod = k; return r; };
  r.json = (g) => { r.govde = g; return r; };
  r.end = () => { r.bitti = true; return r; };
  return r;
}

/** handler'ı çağır. UYARI: yalnız ağ'a çıkmayan isteklerle (başlığa bak). */
async function cagir(method, query) {
  const res = sahteRes();
  await handler({ method, query }, res);
  return res;
}

const anahtarlar = (o) => Object.keys(o || {}).sort().join(',');

// =========================================================================
bolum('① yüzey');
// =========================================================================
ok('default dışa aktarma bir fonksiyon', typeof handler === 'function', typeof handler);
ok('ayristir() dışa aktarılmış (ağsız sınanabilir)', typeof ayristir === 'function', typeof ayristir);
ok('config.runtime = nodejs', config && config.runtime === 'nodejs', String(config && config.runtime));
// 30 sn YETMEZ: tek bir BIST sembolü en kötü halde üç İş Yatırım denemesi
// (3 × 7 sn) + mumlarla onu aşıyor. Bu sayı düşerse sessiz kesinti başlar.
ok('config.maxDuration = 60', config && config.maxDuration === 60, String(config && config.maxDuration));
ok('AZAMI_SEMBOL = 8 (istemcinin Karşılaştır tavanı)', AZAMI_SEMBOL === 8, String(AZAMI_SEMBOL));

// =========================================================================
bolum('② ayristir() — saf, ağsız');
// =========================================================================
{
  // Varsayılanlar: pazar US, vade orta.
  const a = ayristir({ symbols: 'AAPL' });
  ok('tek sembol: hata yok', !a.hata, a.hata ? a.hata.govde.error : '');
  ok('tek sembol: vade varsayılanı orta', a.vade === 'orta', String(a.vade));
  ok('tek sembol: pazar varsayılanı US', a.rows && a.rows[0] && a.rows[0].market === 'US', JSON.stringify(a.rows));
  ok('tek sembol: sembol büyük harfe çevrilmiş', ayristir({ symbols: 'aapl' }).rows[0].sym === 'AAPL');

  // `.IS` eki SOYULUR: motorun yahooSymbol'ü onu kendisi geri ekliyor
  // (_motor.js:89) ve fetchIsYatirimMali çıplak companyCode istiyor. Ek
  // soyulmazsa Yahoo'ya "THYAO.IS.IS" gider.
  const b = ayristir({ symbols: 'THYAO.IS' });
  ok('.IS eki → pazar BIST', b.rows[0].market === 'BIST', JSON.stringify(b.rows[0]));
  ok('.IS eki SOYULUR (çıplak kod)', b.rows[0].sym === 'THYAO', b.rows[0].sym);

  // `SYM:BIST` yazımı — istemcinin listelerinde pazar ayrı alanda tutuluyor.
  const c = ayristir({ symbols: 'THYAO:BIST,AAPL:US' });
  ok('SYM:BIST yazımı pazarı taşıyor',
    c.rows.length === 2 && c.rows[0].market === 'BIST' && c.rows[1].market === 'US',
    JSON.stringify(c.rows));

  // `?market=` tüm eki olmayan sembollerin varsayılanı.
  const d = ayristir({ symbols: 'THYAO,ASELS', market: 'bist' });
  ok('?market=bist (küçük harf) kabul ve uygulanıyor',
    d.rows.length === 2 && d.rows.every((r) => r.market === 'BIST'), JSON.stringify(d.rows));

  // Yineleme: aynı sembol iki kez skorlanmaz — ikinci kez ağa çıkmak boşa
  // istek, hız sınırına yaklaşma ve iki kez aynı sayı demek.
  const e = ayristir({ symbols: 'AAPL,aapl,AAPL' });
  ok('yineleyen sembol atılıyor', e.rows.length === 1, `${e.rows.length} satır`);
  // ...ama pazar farklıysa AYRI sembol: aynı kod iki borsada olabilir.
  const f = ayristir({ symbols: 'AAPL:US,AAPL:BIST' });
  ok('aynı kod farklı pazar AYRI kalıyor', f.rows.length === 2, `${f.rows.length} satır`);

  // Sınırlar ve hata kodları — her biri 400 ve makine-okunur bir kod.
  const g1 = ayristir({});
  ok('symbols yok → 400 symbols_yok',
    g1.hata && g1.hata.http === 400 && g1.hata.govde.error === 'symbols_yok',
    JSON.stringify(g1.hata && g1.hata.govde));

  const g2 = ayristir({ symbols: 'A'.repeat(200) });
  ok('aşırı uzun sorgu → 400 too_long',
    g2.hata && g2.hata.govde.error === 'too_long', JSON.stringify(g2.hata && g2.hata.govde));

  const g3 = ayristir({ symbols: 'AAPL', vade: 'haftalik' });
  ok('bilinmeyen vade → 400 bad_vade',
    g3.hata && g3.hata.govde.error === 'bad_vade', JSON.stringify(g3.hata && g3.hata.govde));
  ok('bad_vade izinli listesi _ayar.js VADELER',
    g3.hata && JSON.stringify(g3.hata.govde.izinli) === JSON.stringify(VADELER),
    JSON.stringify(g3.hata && g3.hata.govde.izinli));
  // VADELER'in HEPSİ kabul edilmeli — biri reddedilirse o vade uçtan erişilemez.
  ok('VADELER içindeki her vade kabul ediliyor',
    VADELER.every((v) => ayristir({ symbols: 'AAPL', vade: v }).vade === v), VADELER.join(','));

  const g4 = ayristir({ symbols: 'AAPL', market: 'NASDAQ' });
  ok('bilinmeyen market → 400 bad_market',
    g4.hata && g4.hata.govde.error === 'bad_market', JSON.stringify(g4.hata && g4.hata.govde));

  // Kırpmak YERİNE reddetme: sessizce kırpılan sembol EKSİK SKOR demek.
  const g5 = ayristir({ symbols: 'A,B,C,D,E,F,G,H,I' });
  ok('9 sembol → 400 cok_sembol (kırpma YOK)',
    g5.hata && g5.hata.govde.error === 'cok_sembol'
    && g5.hata.govde.azami === AZAMI_SEMBOL && g5.hata.govde.istenen === 9,
    JSON.stringify(g5.hata && g5.hata.govde));
  ok('tam 8 sembol hâlâ kabul',
    !ayristir({ symbols: 'A,B,C,D,E,F,G,H' }).hata, '8 satır');

  const g6 = ayristir({ symbols: 'AAPL,../../etc/passwd' });
  ok('biçimsiz sembol → 400 bad_symbol',
    g6.hata && g6.hata.govde.error === 'bad_symbol', JSON.stringify(g6.hata && g6.hata.govde));
  ok('bad_symbol geçersiz girdiyi KIRPARAK yansıtıyor (16 krk)',
    g6.hata && Array.isArray(g6.hata.govde.gecersiz)
    && g6.hata.govde.gecersiz.every((s) => s.length <= 16),
    JSON.stringify(g6.hata && g6.hata.govde.gecersiz));

  const g7 = ayristir({ symbols: ',,,' });
  ok('yalnız virgül → 400 (boş liste geçmiyor)', !!g7.hata,
    JSON.stringify(g7.hata && g7.hata.govde));

  // Olumsuz denetim: bu testin kendisi boş değil mi? Geçersiz bir pazarla
  // kurulmuş `SYM:XETRA` reddedilmeli, sessizce US'e düşmemeli.
  const g8 = ayristir({ symbols: 'BMW:XETRA' });
  ok('N1 · SYM:<bilinmeyen pazar> sessizce US olmuyor',
    g8.hata && g8.hata.govde.error === 'bad_symbol', JSON.stringify(g8.hata && g8.hata.govde));
}

// =========================================================================
bolum('③ handler kapısı — ağa çıkmayan istekler');
// =========================================================================
{
  const o = await cagir('OPTIONS', {});
  ok('OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('CORS köken başlığı * (api/yfin.js ile aynı)',
    o.basliklar['access-control-allow-origin'] === '*', o.basliklar['access-control-allow-origin']);
  ok('CORS yöntem başlığı GET, OPTIONS',
    o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('CORS ön-uçuş önbelleği 86400', o.basliklar['access-control-max-age'] === '86400',
    o.basliklar['access-control-max-age']);

  const p = await cagir('POST', {});
  ok('POST → 405', p.kod === 405, `kod ${p.kod}`);
  ok('405 Allow başlığı var', p.basliklar.allow === 'GET, OPTIONS', p.basliklar.allow);
  ok('405 gövdesi yalnız error + uyari',
    anahtarlar(p.govde) === 'error,uyari', anahtarlar(p.govde));

  // Geçersiz GET: doğrulamadan DÖNER, ağ açılmaz.
  const q = await cagir('GET', {});
  ok('GET symbols yok → 400 symbols_yok', q.kod === 400 && q.govde.error === 'symbols_yok',
    `${q.kod} ${q.govde && q.govde.error}`);
  // Bu denetim aynı zamanda modül düzeyi kurulumun BAŞARILI olduğunu
  // kanıtlıyor: kurulum patlamış olsaydı 503 motor_kurulamadi dönerdi,
  // çünkü o kontrol ayristir'dan ÖNCE koşuyor.
  ok('N2 · modül düzeyi motor kurulumu başarılı (503 değil)', q.kod !== 503, `kod ${q.kod}`);

  const r2 = await cagir('GET', { symbols: 'AAPL', vade: 'yillik' });
  ok('GET bozuk vade → 400 bad_vade', r2.kod === 400 && r2.govde.error === 'bad_vade',
    `${r2.kod} ${r2.govde && r2.govde.error}`);
  const r3 = await cagir('GET', { symbols: 'A,B,C,D,E,F,G,H,I' });
  ok('GET 9 sembol → 400 cok_sembol', r3.kod === 400 && r3.govde.error === 'cok_sembol',
    `${r3.kod} ${r3.govde && r3.govde.error}`);
  const r4 = await cagir('GET', { symbols: '!!!' });
  ok('GET biçimsiz sembol → 400 bad_symbol', r4.kod === 400 && r4.govde.error === 'bad_symbol',
    `${r4.kod} ${r4.govde && r4.govde.error}`);

  // Her hata gövdesinde uyarı var mı — ekranda hangi yoldan görünürse
  // görünsün "bilgi amaçlıdır" metni cevabın içinde.
  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['cok_sembol', r3], ['bad_symbol', r4]]) {
    ok(`${ad} gövdesinde uyarı metni var`, res.govde && res.govde.uyari === UYARI,
      String(res.govde && res.govde.uyari).slice(0, 20));
  }

  // Sızıntı yasağı: hata gövdelerinde yığın izi / dosya yolu / iç mesaj yok.
  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['bad_symbol', r4]]) {
    const metin = JSON.stringify(res.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
    ok(`${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
  }

  // Hata yolu KISA önbellekli: bir kesintiyi CDN'e 5 dk dondurmak, kesinti
  // geçtikten sonra da eski cevabı servis etmek olurdu.
  ok('hata yolu Cache-Control: max-age=30',
    q.basliklar['cache-control'] === 'public, max-age=30', q.basliklar['cache-control']);
}

// =========================================================================
bolum('④ statik denetimler — api/score.js metni');
// =========================================================================
{
  const src = readFileSync(SCORE_PATH, 'utf8');

  ok('dosya uyarı metnini taşıyor', src.includes(UYARI));

  // Tam-satır yorumlar ÇIKARILIR: api/score.js'in başlık bloğu kuralı
  // ANLATMAK için "Intl" sözcüğünü geçiriyor. Ham metinde arasak kendi
  // açıklamasını ihlal saymış olurduk — aranan şey yorumda değil KODDA mı.
  const kod = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  ok('N4 · yorum ayıklama çalışıyor (başlık düştü)',
    /\bIntl\b/.test(src) && !/\bIntl\b/.test(kod), 'başlıkta var, kodda yok');

  // HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): biçimleme istemcinin işi.
  // Sunucu biçimlerse çıktı sunucunun yerel ayarına kilitlenir.
  ok('HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));

  // Motor/skor dokunulmazlığı: bu dosya app.js/config.js'i ne import eder
  // ne okur — motor yalnız üretilmiş taşıyıcılardan geliyor.
  ok('app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));
  ok('yalnız üretilmiş taşıyıcılar + akış import ediliyor',
    ['./_motor.js', './_ayar.js', './_ekran.js', './_ag.js', './_akis.js']
      .every((m) => src.includes(`from '${m}'`)));

  // Sayaç motora tek bir sayı dahi GEÇİRMİYOR — yalnız gözlemci.
  ok('sayaç yalnız gözlemci (scoreOne\'a sayac geçmiyor)',
    !/scoreOne\([^)]*sayac/s.test(src));

  // N3: statik denetimin kendisi çalışıyor mu? Var olduğunu bildiğimiz bir
  // dizgeyi aramak boş testi yakalar.
  ok('N3 · statik arama gerçekten çalışıyor', src.includes('export default async function handler'));
}

bitir();
