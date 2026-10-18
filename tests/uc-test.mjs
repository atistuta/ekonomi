#!/usr/bin/env node
// ===========================================================================
//  UÇ TESTLERİ — altı ucun kapıları   ·   AĞA ÇIKMAZ
// ===========================================================================
//
//  NEDEN VAR: üç ucun (/api/score · /api/recommend · /api/analyze) asıl işi —
//  gerçek skor, plan ve bütüncül okuma — ağa çıkmadan sınanamaz; onu
//  `tests/parity.mjs` fikstürlerle, `tests/duman.mjs` ise canlı ağda
//  (elle, CI dışı) ölçüyor.
//  Ama uç noktanın KAPI kısmı — hangi girdiyi kabul ettiği, hangi kodla
//  reddettiği, hata gövdesinde ne sızdırdığı — tamamen saf mantık ve ağa
//  çıkmadan ölçülebilir. Ölçülmezse sessizce bozulur: bir yazım hatası
//  `cok_sembol` kontrolünü etkisizleştirip 8 sembol sınırını kaldırabilir
//  ve bunu kimse farketmez, çünkü cevap yine 200 döner.
//
//  NE ÖLÇER (10 bölüm)  ① ② ③ ④ = score · ⑤ = recommend · ⑥ = analyze
//                       ⑦ = süre freni · ⑧ = theme · ⑨ = compare
//                       ⑩ = causal
//    ① yüzey              — default/ayristir/config yerinde mi
//    ② ayristir()         — pazar çözümü, yineleme, sınırlar, hata kodları
//    ③ handler kapısı     — CORS · OPTIONS · 405 · 4xx gövdeleri
//    ④ statik denetimler  — HAM SAYI kuralı ve sızıntı yasağı metinde
//    ⑤ /api/recommend     — aynı yüzey/kapı + KOPYA kapının sürüklenme kilidi
//    ⑥ /api/analyze       — aynı yüzey/kapı + bütüncül katmanın HAM SAYI
//                           disiplini (serbest Türkçe metin tele çıkmıyor mu)
//    ⑦ süre tavanı        — sembol İÇİNDE de duran fren (_ag.js)
//    ⑧ /api/theme         — LLM keşif ucu AYNI kabukta mı: method kapısı,
//                           uyarı metni, önbellek sabiti, `AZAMI_SORGU` tek
//                           kaynaktan, iç hata metni sızmıyor, ANAHTAR
//                           loglanmıyor, skor şeridi bulaşmıyor.
//                           NİYE BURADA: parity.mjs theme'i KORUMAZ.
//    ⑨ /api/compare       — dördüncü uç: AYNI kapı + `ASGARI_SEMBOL`
//                           (tek sembol kıyaslanamaz) + alım-bandına
//                           uzaklık sıralaması uydurma eşik içermiyor mu
//    ⑩ /api/causal        — beşinci uç: POST kapısı (girdi `AZAMI_SORGU`ya
//                           sığmıyor), gövde doğrulaması, ve nedensellik
//                           mantığının MOTORDA kaldığı (uçta kopyası yok)
//
//  AĞ YASAĞI — BU TESTİN EN ÖNEMLİ KURALI: HER ÜÇ ucun handler()'ı
//  yalnız ağ'a hiç gitmeyecek isteklerle çağrılır (OPTIONS, GET-dışı, ya da
//  doğrulamadan DÖNEN geçersiz sorgu). GEÇERLİ bir GET sorgusuyla
//  çağrılırsa Yahoo/SEC/İş Yatırım'a gerçekten çıkar; test ağ durumuna
//  bağımlı hale gelir ve CI'da rastgele kırmızı yanar. Geçerli girdiler bu
//  yüzden yalnız `ayristir()` ile — ağ'a dokunmayan saf fonksiyon —
//  sınanıyor.
//
//  NOT: üç ucu birlikte import etmek modül düzeyinde ÜÇ AYRI canliAg() +
//  buildMotor() kuruyor (Vercel'de de öyle: her uç kendi lambda'sı, kendi
//  motoru, kendi SEC önbelleği). Hepsi yalnız kapanış/nesne kuruyor, TEK bir
//  istek atmıyor — ağ ancak handler bir sembolü skorlarken açılıyor.
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
import recHandler, {
  ayristir as recAyristir, config as recConfig, AZAMI_SEMBOL as recAzami,
} from '../api/recommend.js';
import anaHandler, {
  ayristir as anaAyristir, config as anaConfig, AZAMI_SEMBOL as anaAzami,
} from '../api/analyze.js';
import kiyHandler, {
  ayristir as kiyAyristir, config as kiyConfig, AZAMI_SEMBOL as kiyAzami,
  ASGARI_SEMBOL, siraAnahtari, siralaKiyas,
} from '../api/compare.js';
import nedenHandler, {
  config as nedenConfig, ayristirGovde,
  AZAMI_HAREKET, AZAMI_KONSEPT, AZAMI_GOVDE_BAYT,
} from '../api/causal.js';
import { VADELER } from '../api/_ayar.js';
// ⑧ /api/theme — LLM keşif ucu. Modül düzeyinde motor KURMUYOR ve ağa
// ÇIKMIYOR (yalnız sabit + saf fonksiyon), bu yüzden içe almak bedava.
import temaHandler, {
  config as temaConfig, extractArray, cleanCandidates,
  AZAMI_SORGU as temaAzamiSorgu, AZAMI_ADAY, LLM_ISTEK_MS,
} from '../api/theme.js';
import { AZAMI_SORGU } from '../api/_girdi.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCORE_PATH = path.join(ROOT, 'api', 'score.js');
const RECOMMEND_PATH = path.join(ROOT, 'api', 'recommend.js');
const ANALYZE_PATH = path.join(ROOT, 'api', 'analyze.js');
const AKIS_PATH = path.join(ROOT, 'api', '_akis.js');
const THEME_PATH = path.join(ROOT, 'api', 'theme.js');
const COMPARE_PATH = path.join(ROOT, 'api', 'compare.js');
const CAUSAL_PATH = path.join(ROOT, 'api', 'causal.js');
const GIRDI_PATH = path.join(ROOT, 'api', '_girdi.js');
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
  console.log(`✅ ${gecen} denetim geçti — /api/score + /api/recommend + /api/analyze + /api/theme + /api/compare + /api/causal kapıları ve doğrulamaları yerinde.`);
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
  ok('yalnız üretilmiş taşıyıcılar + akış + girdi kapısı import ediliyor',
    ['./_motor.js', './_ayar.js', './_ag.js', './_akis.js', './_girdi.js']
      .every((m) => src.includes(`from '${m}'`)));

  // Sayaç motora tek bir sayı dahi GEÇİRMİYOR — yalnız gözlemci.
  ok('sayaç yalnız gözlemci (scoreOne\'a sayac geçmiyor)',
    !/scoreOne\([^)]*sayac/s.test(src));

  // N3: statik denetimin kendisi çalışıyor mu? Var olduğunu bildiğimiz bir
  // dizgeyi aramak boş testi yakalar.
  ok('N3 · statik arama gerçekten çalışıyor', src.includes('export default async function handler'));
}

// =========================================================================
// --- ÜÇ UCUN ORTAK AYRISTIR VEKTÖRÜ -------------------------------------
// ⑤b ve ⑥b aynı listeyi kullanıyor. İki ayrı liste tutulsaydı biri
// güncellenip öteki unutulurdu ve üçüncü uç yalnız ESKİ girdilerde
// sınanırdı — kopya sürüklenme kilidinin en sinsi kaçağı bu olurdu.
const AYRISTIR_VEKTOR = [
  {},
  { symbols: '' },
  { symbols: '   ' },
  { symbols: 'AAPL' },
  { symbols: 'aapl' },
  { symbols: 'THYAO.IS' },
  { symbols: 'THYAO:BIST,AAPL:US' },
  { symbols: 'THYAO,ASELS', market: 'bist' },
  { symbols: 'AAPL,AAPL' },
  { symbols: 'AAPL,aapl,AAPL:US' },
  { symbols: 'A,B,C,D,E,F,G,H' },
  { symbols: 'A,B,C,D,E,F,G,H,I' },
  { symbols: 'AAPL', vade: 'kisa' },
  { symbols: 'AAPL', vade: 'uzun' },
  { symbols: 'AAPL', vade: 'gunici' },
  { symbols: 'AAPL', vade: 'yillik' },
  { symbols: 'AAPL', market: 'XETRA' },
  { symbols: '!!!' },
  { symbols: 'AAPL,!!!' },
  { symbols: '1AAPL' },
  { symbols: 'AAPL:TOKYO' },
  { symbols: 'VERYLONGSYMBOL' },
  { symbols: 'X'.repeat(200) },
  { symbol: 'AAPL' },
  { symbols: null },
];

/** Saf fonksiyonu çağır; atan hali de karşılaştırılabilir metne çevir. */
const cagirSaf = (fn, q) => {
  try { return JSON.stringify(fn(q)); } catch (e) { return 'ATTI:' + ((e && e.message) || e); }
};

bolum('⑤ /api/recommend — ikinci uç, AYNI kapı');
// =========================================================================
// BU BÖLÜM NE: /api/recommend, /api/score'un döndürdüğü her şeyin ÜSTÜNE
// plan katmanını (levels + banda yakınlık + momentum + risk/ödül) koyuyor.
// Kapısı — sınırlar, `SEMBOL_BICIM`, `ayristir()`, `temizleSembol()` — iki
// dosyada AYNI METİN, yani bir KOPYA. Kopyanın tehlikesi sessiz ayrışma:
// biri `AZAMI_SEMBOL`'ü 12'ye çıkarırsa aynı sorgu iki uçta farklı kabul
// edilir ve hiçbir test kırmızı yanmaz. ⑤b ve ⑤e tam olarak bunu bekçiliyor.
//
// AĞ YASAĞI ⑤'te de geçerli: `recHandler` yalnız OPTIONS / GET-dışı /
// doğrulamadan DÖNEN sorgularla çağrılıyor. Geçerli girdiler `recAyristir`
// ile — ağ'a dokunmayan saf fonksiyon — sınanıyor.
//
// NOT: api/recommend.js'i import etmek İKİNCİ bir canliAg() + buildMotor()
// kuruyor (ayrı lambda, ayrı motor — dosyanın başlığında yazılı). İkisi de
// yalnız kapanış kuruyor, TEK bir istek atmıyor.

/** handler'ı çağır — hangi uç olduğu parametre. UYARI: ağsız istekler. */
async function cagirUc(h, method, query) {
  const res = sahteRes();
  await h({ method, query }, res);
  return res;
}

// --- ⑤a yüzey -----------------------------------------------------------
ok('⑤a · default dışa aktarma bir fonksiyon', typeof recHandler === 'function', typeof recHandler);
ok('⑤a · ayristir() dışa aktarılmış (ağsız sınanabilir)', typeof recAyristir === 'function', typeof recAyristir);
ok('⑤a · config.runtime = nodejs', recConfig && recConfig.runtime === 'nodejs', String(recConfig && recConfig.runtime));
// /api/score ile AYNI olmalı: plan katmanı SAF HESAP, yeni ağ isteği
// eklemiyor — yani zaman profili değişmiyor. Ayrışırsa biri sessizce kesilir.
ok('⑤a · config.maxDuration = 60 (/api/score ile aynı)',
  recConfig && recConfig.maxDuration === config.maxDuration && recConfig.maxDuration === 60,
  `recommend ${recConfig && recConfig.maxDuration} · score ${config && config.maxDuration}`);
ok('⑤a · AZAMI_SEMBOL /api/score ile aynı', recAzami === AZAMI_SEMBOL && recAzami === 8,
  `recommend ${recAzami} · score ${AZAMI_SEMBOL}`);

// --- ⑤b ayristir() iki uçta BİREBİR aynı --------------------------------
// Kopya kapının ASIL denetimi: aynı sorgu kümesinde iki `ayristir` aynı
// cevabı vermeli. Atan (throw) hal de karşılaştırılıyor — biri patlayıp
// öteki patlamazsa da ayrışma vardır.
{
  let ayrisan = null; let ayrNokta = 0;
  for (const q of AYRISTIR_VEKTOR) {
    const a = cagirSaf(ayristir, q);
    const b = cagirSaf(recAyristir, q);
    if (a !== b) { ayrisan = `${JSON.stringify(q)} → score ${a} · recommend ${b}`; break; }
    ayrNokta++;
  }
  ok('⑤b · ayristir() iki uçta birebir aynı cevap', ayrisan === null,
    ayrisan || `${ayrNokta} sorgu vektörü`);

  // N5: karşılaştırma gerçekten hassas mı? Bilerek ayrışan bir çift yollayıp
  // yakalandığını doğruluyoruz — yoksa ⑤b boş bir formalite olurdu.
  ok('N5 · ⑤b karşılaştırması ayrışmayı yakalıyor',
    cagirSaf(ayristir, { symbols: 'AAPL' }) !== cagirSaf(recAyristir, { symbols: 'MSFT' }),
    'farklı girdi farklı çıktı veriyor');

  // Vektörün hepsi reddedilse ⑤b "ikisi de her şeyi reddediyor"u da geçerdi.
  // Vektörde KABUL edilen hal de var mı?
  let kabul = 0;
  for (const q of AYRISTIR_VEKTOR) {
    try { if (!recAyristir(q).hata) kabul++; } catch { /* atan hal ⑤b'nin işi */ }
  }
  ok('N6 · vektör yalnız RET hallerinden oluşmuyor', kabul >= 10, `${kabul} kabul`);
}

// --- ⑤c handler kapısı (ağsız yollar) -----------------------------------
{
  const o = await cagirUc(recHandler, 'OPTIONS', {});
  ok('⑤c · OPTIONS → 204, gövde yok', o.kod === 204 && o.bitti === true && o.govde === null,
    `kod ${o.kod} bitti ${o.bitti}`);
  ok('⑤c · CORS başlıkları /api/score ile aynı küme',
    o.basliklar['access-control-allow-origin'] === '*'
    && o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS'
    && o.basliklar['access-control-max-age'] === '86400',
    JSON.stringify(o.basliklar));

  const p = await cagirUc(recHandler, 'POST', {});
  ok('⑤c · POST → 405 + Allow', p.kod === 405 && p.basliklar.allow === 'GET, OPTIONS',
    `kod ${p.kod} allow ${p.basliklar.allow}`);
  ok('⑤c · 405 gövdesi yalnız error + uyari',
    anahtarlar(p.govde) === 'error,uyari', anahtarlar(p.govde));

  // Geçersiz GET'ler: doğrulamadan DÖNER, ağ açılmaz.
  const q = await cagirUc(recHandler, 'GET', {});
  ok('⑤c · GET symbols yok → 400 symbols_yok', q.kod === 400 && q.govde.error === 'symbols_yok',
    `${q.kod} ${q.govde && q.govde.error}`);
  // ③'teki N2'nin aynısı, AMA ikinci motor için: kurulum patlamış olsaydı
  // 503 dönerdi, çünkü o kontrol ayristir'dan ÖNCE koşuyor.
  ok('N7 · /api/recommend modül düzeyi motor kurulumu başarılı (503 değil)', q.kod !== 503, `kod ${q.kod}`);

  const r2 = await cagirUc(recHandler, 'GET', { symbols: 'AAPL', vade: 'yillik' });
  const r3 = await cagirUc(recHandler, 'GET', { symbols: 'A,B,C,D,E,F,G,H,I' });
  const r4 = await cagirUc(recHandler, 'GET', { symbols: '!!!' });
  const r5 = await cagirUc(recHandler, 'GET', { symbols: 'AAPL', market: 'XETRA' });
  ok('⑤c · bozuk vade → 400 bad_vade', r2.kod === 400 && r2.govde.error === 'bad_vade',
    `${r2.kod} ${r2.govde && r2.govde.error}`);
  ok('⑤c · 9 sembol → 400 cok_sembol', r3.kod === 400 && r3.govde.error === 'cok_sembol',
    `${r3.kod} ${r3.govde && r3.govde.error}`);
  ok('⑤c · biçimsiz sembol → 400 bad_symbol', r4.kod === 400 && r4.govde.error === 'bad_symbol',
    `${r4.kod} ${r4.govde && r4.govde.error}`);
  ok('⑤c · tanınmayan pazar → 400 bad_market', r5.kod === 400 && r5.govde.error === 'bad_market',
    `${r5.kod} ${r5.govde && r5.govde.error}`);

  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['cok_sembol', r3], ['bad_symbol', r4], ['bad_market', r5]]) {
    ok(`⑤c · ${ad} gövdesinde uyarı metni var`, res.govde && res.govde.uyari === UYARI,
      String(res.govde && res.govde.uyari).slice(0, 20));
  }
  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['bad_symbol', r4]]) {
    const metin = JSON.stringify(res.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
    ok(`⑤c · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
  }
  ok('⑤c · hata yolu Cache-Control: max-age=30',
    q.basliklar['cache-control'] === 'public, max-age=30', q.basliklar['cache-control']);
}

// --- ⑤d statik denetimler — api/recommend.js + api/_akis.js metni -------
{
  const rsrc = readFileSync(RECOMMEND_PATH, 'utf8');
  const rkod = rsrc.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  ok('⑤d · dosya uyarı metnini taşıyor', rsrc.includes(UYARI));
  ok('N4b · yorum ayıklama çalışıyor (başlık düştü)',
    /\bIntl\b/.test(rsrc) && !/\bIntl\b/.test(rkod), 'başlıkta var, kodda yok');

  // HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1). Plan katmanı bu kuralın en
  // kırılgan yeri: buyZoneProximity'nin SÖKÜLEN `txt` alanı '🟢 … 1.2×ATR'
  // taşıyordu. Biri "kolay olsun" diye geri koyarsa uç nokta Türkçe cümle
  // yayınlamaya başlar ve native istemci kendi dilinde yazma hakkını
  // kaybeder. Bu yüzden emoji ve para/yüzde simgesi de aranıyor.
  ok('⑤d · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(rkod));
  ok('⑤d · HAM SAYI · `toFixed(` yok', !rkod.includes('toFixed('));
  ok('⑤d · HAM SAYI · `toLocaleString` yok', !rkod.includes('toLocaleString'));
  const emojiVar = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(rkod);
  ok('⑤d · HAM SAYI · kodda emoji yok', !emojiVar, emojiVar ? 'emoji bulundu' : 'temiz');
  // `$` ARANMIYOR: `SEMBOL_BICIM` düzenli ifadesinde `$` çıpa olarak var.
  const paraVar = /[₺€£¥₩%]|×ATR/.test(rkod);
  ok('⑤d · HAM SAYI · kodda para/yüzde simgesi yok', !paraVar, paraVar ? 'simge bulundu' : 'temiz');

  // Motor/skor dokunulmazlığı: bu dosya app.js/config.js'i ne import eder
  // ne okur — motor yalnız üretilmiş taşıyıcılardan geliyor.
  ok('⑤d · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(rsrc));
  const tasiyici = rsrc.match(/^import .* from '\.\/_[a-z]+\.js';$/gm) || [];
  // DÖRT → BEŞ (2026-10-14): `api/_girdi.js` eklendi. Sayı bilerek SABİT —
  // altıncı bir taşıyıcı sessizce doğmasın, gerekçesi yazılarak doğsun.
  ok('⑤d · yalnız BEŞ taşıyıcı import ediliyor (ALTINCI taşıyıcı yok)',
    ['./_motor.js', './_ayar.js', './_ag.js', './_akis.js', './_girdi.js']
      .every((m) => rsrc.includes(`from '${m}'`))
    && tasiyici.length === 5, `${tasiyici.length} taşıyıcı import`);
  // api/score.js'i import ETMEZ: ettiği an recommend lambda'sı İKİ motor
  // kurar ve SEC önbellekleri (`secCikMap`/`secModelCache`) ikiye bölünür.
  ok('⑤d · api/score.js import edilmiyor', !/from\s+['"]\.\/score\.js['"]/.test(rsrc));

  // Sayaç motora tek bir sayı dahi GEÇİRMİYOR — yalnız gözlemci.
  ok('⑤d · sayaç yalnız gözlemci (recommendOne\'a sayac geçmiyor)',
    !/recommendOne\([^)]*sayac/s.test(rsrc));

  // Başarısız sembol kaydı `plan` alanını HER ZAMAN taşıyor: istemci
  // `'plan' in kayit` ile `kayit.plan` arasında ayrım yapmak zorunda kalmasın.
  ok('⑤d · sembol hata kaydında `plan: null` var', /plan:\s*null/.test(rkod));
  ok('⑤d · 502 yolunda yalnız makine kodu var',
    rkod.includes("error: 'oneri_hesaplanamadi'")
    && !/res\.status\(502\)[\s\S]{0,200}stack/.test(rkod));

  // `surum` BİÇİMİ istemci sözleşmesi: /api/score ile aynı iki anahtar.
  // Ayrışırsa istemci iki uçtan gelen motor sürümünü karşılaştıramaz.
  ok('⑤d · `surum` biçimi /api/score ile aynı ({ motor, ayar })',
    rkod.includes('surum: { motor: IMZA, ayar: IMZA_AYAR }')
    && readFileSync(SCORE_PATH, 'utf8').includes('surum: { motor: IMZA, ayar: IMZA_AYAR }'));

  // `anchorSrc` TELE KONMAZ: serbest TÜRKÇE metin ("VP değer tabanı" gibi),
  // HAM SAYI kuralının dışında. Gerekçe api/_akis.js planKatmani'nda yazılı;
  // burada çivilenmesi gerek, çünkü `...r.levels` yazmak tek karakterlik bir
  // "düzeltme" ve kimse farketmez.
  const asrc = readFileSync(AKIS_PATH, 'utf8');
  ok('⑤d · planKatmani `anchorSrc`i söküyor (serbest metin tele çıkmaz)',
    /const\s*\{\s*anchorSrc\s*,\s*\.\.\.seviye\s*\}\s*=\s*r\.levels/.test(asrc),
    'anchorSrc destructuring yerinde');
  // Plan katmanının üç hesabı da MOTORDAN çağrılıyor; akış eşik/çarpan
  // taşımıyor (Commit C/D1 kuralı: sayı motorda, cümle çağrı noktasında).
  ok('⑤d · plan hesapları motordan (`eng.`) çağrılıyor, akışta sabit yok',
    ['eng.buyZoneProximity(', 'eng.momentumInfo(', 'eng.planRiskReward(']
      .every((s) => asrc.includes(s)),
    'buyZoneProximity · momentumInfo · planRiskReward');

  // N3b: statik denetimin kendisi çalışıyor mu?
  ok('N3b · statik arama gerçekten çalışıyor', rsrc.includes('export default async function handler'));
}

// --- ⑤e TAŞIYICI KİMLİK KİLİDİ (eski ÜÇ YÖNLÜ METİN kilidinin yerine) ---
// NE DEĞİŞTİ VE NİYE: burada eskiden üç ucun doğrulama bölgesi METİN olarak
// karşılaştırılıyordu (61 kod satırı / 2.401 krk, yorumlar çıkarılarak) ve
// iki denetim vardı — N9 (ayıklama boş değil) + ⑤e (üçü birebir aynı).
// O kilit kopyayı ÖLÇÜYORDU ama ortadan KALDIRMIYORDU. Kopya artık YOK:
// sınırlar + `ayristir` + `temizleSembol` `api/_girdi.js`e (beşinci
// taşıyıcı) taşındı, üç uç onu içe alıp yeniden dışa aktarıyor.
//
// Metin karşılaştırması bu yüzden ANLAMSIZ: ayıklanacak bölge kalmadı ve
// üç boş dizge "eşit" çıkardı — tam olarak N9'un engellediği sessiz yeşil.
// Yerine ÜÇ TÜR kimlik denetimi kondu, hepsi metinden GÜÇLÜ:
//   ① üç uç gerçekten taşıyıcıyı kullanıyor (statik import denetimi),
//   ② hiçbiri yerel kopya DİRİLTMEDİ (statik düzenli ifade),
//   ③ üç ucun `ayristir`i AYNI FONKSİYON NESNESİ + vektör eşitliği.
// ③ en sağlamı: aynı nesneyse ayrışma fiziksel olarak mümkün değil.
// DENETİM SAYISI ARTTI (2 → 12): tek metin karşılaştırması, kopyanın geri
// gelebileceği her yolu ayrı ayrı kapatan denetimlere bölündü.
{
  const girdi = await import('../api/_girdi.js');
  // Yorum satırlarını atan okuyucu: bu bölümün BÜTÜN statik denetimleri
  // KODA bakmak zorunda. Gerekçe metninde `canliAg` ya da `const PAZARLAR`
  // geçmesi suç değil — bu dosyalar bilerek uzun gerekçe taşıyor; KODDA
  // geçmesi suç. (Bu yazılırken ⑤e④ tam bu yüzden kırmızı yandı: taşıyıcı
  // başlığı "konak/motor kurulumu (canliAg + buildMotor) uçlarda KALDI"
  // diye ANLATIYOR, ağa çıkmıyor.)
  const kodu = (yol) => readFileSync(yol, 'utf8').split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const UCLAR = [
    ['score', SCORE_PATH, ayristir, AZAMI_SEMBOL],
    ['recommend', RECOMMEND_PATH, recAyristir, recAzami],
    ['analyze', ANALYZE_PATH, anaAyristir, anaAzami],
    // DÖRDÜNCÜ uç (2026-10-18): /api/compare da girdi kapısını taşıyıcıdan
    // alıyor. Listeye eklenmeseydi kopya kilidi yeni uçta HİÇ koşmazdı —
    // kilidin en sessiz kaçağı budur.
    ['compare', COMPARE_PATH, kiyAyristir, kiyAzami],
  ];

  // ① Taşıyıcı gerçekten kullanılıyor mu. `export { } from` TEK BAŞINA
  // yetmiyor (yerel bağlama yaratmaz, handler çöker — bu yazılırken
  // `ReferenceError: ayristir is not defined` ile kırmızı yandı), o yüzden
  // İÇE ALMA da aranıyor.
  for (const [ad, yol] of UCLAR) {
    const src = readFileSync(yol, 'utf8');
    ok(`⑤e① · ${ad}: girdi kapısını \`_girdi.js\`ten İÇE ALIYOR`,
      /^import \{[^}]*ayristir[^}]*\} from '\.\/_girdi\.js';$/m.test(src));
  }

  // ② Yerel kopya DİRİLTİLMEDİ. Yorumlar çıkarılıyor: gerekçe metninde
  // `const PAZARLAR` geçmesi suç değil, KODDA geçmesi suç.
  const YASAK = [
    // `export` ÖNEKİ İSTEĞE BAĞLI: dışa aktarılmayan bir yerel kopya da
    // diriltmedir. Bu desen bir zaman `export const` şart koşuyordu; düz
    // `const AZAMI_SEMBOL = …` yazan bir mutasyon ⑤e②'yi SESSİZ GEÇTİ
    // (⑤a/⑥a/⑤e③ yakaladı, ama bu tarama yakalamalıydı). Diğer beş desen
    // zaten düz `const`/`function` arıyor — asimetri kasıtlı değildi.
    [/(?:export\s+)?const\s+AZAMI_SEMBOL\s*=/, 'AZAMI_SEMBOL sabiti'],
    [/const\s+PAZARLAR\s*=/, 'PAZARLAR'],
    [/const\s+VARSAYILAN_VADE\s*=/, 'VARSAYILAN_VADE'],
    [/const\s+AZAMI_SORGU\s*=/, 'AZAMI_SORGU'],
    [/const\s+SEMBOL_BICIM\s*=/, 'SEMBOL_BICIM'],
    [/function\s+temizleSembol\s*\(/, 'temizleSembol()'],
    [/(?:export\s+)?function\s+ayristir\s*\(/, 'ayristir() gövdesi'],   // aynı sebep
  ];
  for (const [ad, yol] of UCLAR) {
    const kod = kodu(yol);
    const dirilen = YASAK.filter(([re]) => re.test(kod)).map(([, n]) => n);
    ok(`⑤e② · ${ad}: KODDA yerel kopya yok (sınır/ayristir/temizleSembol taşıyıcıda)`,
      dirilen.length === 0, dirilen.length ? `DİRİLEN: ${dirilen.join(', ')}` : 'temiz');
  }

  // ③ Kimlik: üçü de taşıyıcının TEK bağlamasını dışa aktarıyor.
  ok('⑤e③ · üç ucun `ayristir`i AYNI FONKSİYON NESNESİ (kopya fiziksel olarak yok)',
    ayristir === girdi.ayristir && recAyristir === girdi.ayristir
    && anaAyristir === girdi.ayristir);
  ok('⑤e③ · /api/compare ucunun `ayristir`i de AYNI NESNE (dördüncü uç)',
    kiyAyristir === girdi.ayristir);
  ok('⑤e③ · /api/compare AZAMI_SEMBOL sınırı da taşıyıcıdan',
    kiyAzami === girdi.AZAMI_SEMBOL, String(kiyAzami));

  ok('⑤e③ · üç ucun AZAMI_SEMBOL sınırı taşıyıcıdan geliyor ve aynı',
    AZAMI_SEMBOL === girdi.AZAMI_SEMBOL && recAzami === girdi.AZAMI_SEMBOL
    && anaAzami === girdi.AZAMI_SEMBOL, `${AZAMI_SEMBOL}`);

  // Vektör eşitliği: kimlik denetimi birinin `ayristir`i SARMASINI
  // (ör. kendi sınırını uygulayıp sonra çağırmasını) yakalamayabilir —
  // davranış da ölçülüyor. Girdiler sınırların HER İKİ yanına basıyor.
  const VEKTOR = [
    {}, { symbols: '' }, { symbols: 'AAPL' }, { symbol: 'AAPL' },
    { symbols: 'AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,AVGO' },           // tam sınır
    { symbols: 'AAPL,MSFT,NVDA,GOOGL,AMZN,META,TSLA,AVGO,AMD' },       // sınır+1
    { symbols: 'A'.repeat(129) },                                      // AZAMI_SORGU+1
    { symbols: 'ASELS.IS' }, { symbols: 'ASELS:BIST' }, { symbols: 'BMW:XETRA' },
    { symbols: 'AAPL', vade: 'kisa' }, { symbols: 'AAPL', vade: 'yok-boyle' },
    { symbols: 'AAPL', market: 'BIST' }, { symbols: 'AAPL', market: 'NASDAQ' },
    { symbols: 'AAPL,AAPL' }, { symbols: 'aapl , msft ' }, { symbols: ',,,' },
    { symbols: '1AAPL' }, { symbols: 'TOOOOOLONGSYM' },
  ];
  let ayrisan = '';
  for (const g of VEKTOR) {
    const bek = JSON.stringify(ayristir(g));
    for (const [ad, , fn] of UCLAR.slice(1)) {
      if (JSON.stringify(fn(g)) !== bek) { ayrisan = `${ad} · girdi ${JSON.stringify(g)}`; break; }
    }
    if (ayrisan) break;
  }
  ok('⑤e③ · `ayristir()` vektör eşitliği (19 girdi, sınırların iki yanı)',
    !ayrisan, ayrisan || `${VEKTOR.length} girdi üç uçta aynı`);

  // ④ Taşıyıcının kendi disiplini: girdi kapısı SAF olmalı — ağa çıkmaz,
  // motor/akış içe almaz. Çıkarsa doğrulama artık fikstürsüz sınanamaz.
  const gkod = kodu(GIRDI_PATH);
  const gimport = gkod.match(/^import .* from '\.\/_[a-z]+\.js';$/gm) || [];
  ok('⑤e④ · `_girdi.js` YALNIZ `_ayar.js` içe alıyor (ağ/motor/akış yok)',
    gimport.length === 1 && gkod.includes("from './_ayar.js'"),
    gimport.join(' · ') || 'hiç import yok');
  ok('⑤e④ · `_girdi.js` ağa çıkmıyor (`fetch`/`canliAg` yok)',
    !/fetch\s*\(/.test(gkod) && !gkod.includes('canliAg'));
  // HAM SAYI kuralı taşıyıcıda da geçerli: hata gövdeleri yalnız makine kodu.
  ok('⑤e④ · `_girdi.js` HAM SAYI (`toFixed`/`Intl`/`toLocaleString` yok)',
    !gkod.includes('toFixed(') && !/Intl/.test(gkod)
    && !gkod.includes('toLocaleString'));
}

// =========================================================================
bolum('⑥ /api/analyze — üçüncü uç, AYNI kapı + bütüncül katman');
// =========================================================================
// BU BÖLÜM NE: /api/analyze, /api/recommend'ın döndürdüğü her şeyin ÜSTÜNE
// bütüncül okumayı (`faKarar` + `butunculluk`) koyuyor — iç içe geçmiş üç
// uç: scoreOne ⊂ recommendOne ⊂ analyzeOne. Kapısı yine AYNI METİN, yani
// ÜÇÜNCÜ kopya; sürüklenme kilidi ⑤e'de üç yönlü hale getirildi.
//
// ⑥'nın kendine ait asıl işi: bütüncül katman, HAM SAYI kuralının EN
// kaygan yeri. Motorun `computeHolisticScore`u serbest Türkçe metin de
// üretiyor (`parts[].note`, `growthNote.txt`, `COMPOSITE_MATRIX[...].txt`
// gibi) — akış bunları SÖKÜYOR ve tele yalnız sabit kümeli etiket + sayı
// çıkıyor. Biri "istemcide cümle kurmak zahmetli" diye `...hol` yazarsa uç
// nokta Türkçe cümle yayınlamaya başlar; ⑥e tam olarak bunu bekçiliyor.
//
// AĞ YASAĞI ⑥'da da geçerli: `anaHandler` yalnız OPTIONS / GET-dışı /
// doğrulamadan DÖNEN sorgularla çağrılıyor. Geçerli girdiler `anaAyristir`
// ile — ağ'a dokunmayan saf fonksiyon — sınanıyor.

// --- ⑥a yüzey -----------------------------------------------------------
ok('⑥a · default dışa aktarma bir fonksiyon', typeof anaHandler === 'function', typeof anaHandler);
ok('⑥a · ayristir() dışa aktarılmış (ağsız sınanabilir)', typeof anaAyristir === 'function', typeof anaAyristir);
ok('⑥a · config.runtime = nodejs', anaConfig && anaConfig.runtime === 'nodejs', String(anaConfig && anaConfig.runtime));
// /api/score ve /api/recommend ile AYNI olmalı. Bütüncül katman da SAF
// HESAP: tests/duman.mjs ölçtü — /api/score'un üstüne yeni AĞ isteği
// eklemiyor. Zaman profili değişmiyorsa süre tavanı da değişmemeli.
ok('⑥a · config.maxDuration = 60 (üç uçta aynı)',
  anaConfig && anaConfig.maxDuration === config.maxDuration
  && anaConfig.maxDuration === recConfig.maxDuration && anaConfig.maxDuration === 60,
  `analyze ${anaConfig && anaConfig.maxDuration} · recommend ${recConfig && recConfig.maxDuration} · score ${config && config.maxDuration}`);
ok('⑥a · AZAMI_SEMBOL üç uçta aynı', anaAzami === AZAMI_SEMBOL && anaAzami === recAzami && anaAzami === 8,
  `analyze ${anaAzami} · recommend ${recAzami} · score ${AZAMI_SEMBOL}`);

// --- ⑥b ayristir() ÜÇ uçta BİREBİR aynı ---------------------------------
// ⑤b ile AYNI vektör kullanılıyor (modül düzeyinde, tek liste). İki ayrı
// liste tutulsaydı biri güncellenip öteki unutulur ve üçüncü uç yalnız ESKİ
// girdilerde sınanırdı — kopya kilidinin en sinsi kaçağı bu olurdu.
{
  let ayrisan = null; let ayrNokta = 0;
  for (const q of AYRISTIR_VEKTOR) {
    const a = cagirSaf(ayristir, q);
    const c = cagirSaf(anaAyristir, q);
    if (a !== c) { ayrisan = `${JSON.stringify(q)} → score ${a} · analyze ${c}`; break; }
    ayrNokta++;
  }
  ok('⑥b · ayristir() score ile birebir aynı cevap', ayrisan === null,
    ayrisan || `${ayrNokta} sorgu vektörü`);

  let ayrisan2 = null;
  for (const q of AYRISTIR_VEKTOR) {
    const b = cagirSaf(recAyristir, q);
    const c = cagirSaf(anaAyristir, q);
    if (b !== c) { ayrisan2 = `${JSON.stringify(q)} → recommend ${b} · analyze ${c}`; break; }
  }
  ok('⑥b · ayristir() recommend ile birebir aynı cevap', ayrisan2 === null,
    ayrisan2 || `${AYRISTIR_VEKTOR.length} sorgu vektörü`);

  // N10: karşılaştırma gerçekten hassas mı — ⑤b'deki N5'in üçüncü uç eşi.
  ok('N10 · ⑥b karşılaştırması ayrışmayı yakalıyor',
    cagirSaf(ayristir, { symbols: 'AAPL' }) !== cagirSaf(anaAyristir, { symbols: 'MSFT' }),
    'farklı girdi farklı çıktı veriyor');

  // Vektörün hepsi reddedilse ⑥b "üçü de her şeyi reddediyor"u da geçerdi.
  let kabul = 0;
  for (const q of AYRISTIR_VEKTOR) {
    try { if (!anaAyristir(q).hata) kabul++; } catch { /* atan hal ⑥b'nin işi */ }
  }
  ok('N11 · vektör analyze için de yalnız RET hallerinden oluşmuyor', kabul >= 10, `${kabul} kabul`);
}

// --- ⑥c handler kapısı (ağsız yollar) -----------------------------------
{
  const o = await cagirUc(anaHandler, 'OPTIONS', {});
  ok('⑥c · OPTIONS → 204, gövde yok', o.kod === 204 && o.bitti === true && o.govde === null,
    `kod ${o.kod} bitti ${o.bitti}`);
  ok('⑥c · CORS başlıkları öteki iki uçla aynı küme',
    o.basliklar['access-control-allow-origin'] === '*'
    && o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS'
    && o.basliklar['access-control-max-age'] === '86400',
    JSON.stringify(o.basliklar));

  const p = await cagirUc(anaHandler, 'POST', {});
  ok('⑥c · POST → 405 + Allow', p.kod === 405 && p.basliklar.allow === 'GET, OPTIONS',
    `kod ${p.kod} allow ${p.basliklar.allow}`);
  ok('⑥c · 405 gövdesi yalnız error + uyari',
    anahtarlar(p.govde) === 'error,uyari', anahtarlar(p.govde));

  // Geçersiz GET'ler: doğrulamadan DÖNER, ağ açılmaz.
  const q = await cagirUc(anaHandler, 'GET', {});
  ok('⑥c · GET symbols yok → 400 symbols_yok', q.kod === 400 && q.govde.error === 'symbols_yok',
    `${q.kod} ${q.govde && q.govde.error}`);
  // N7'nin ÜÇÜNCÜ motor için eşi: modül düzeyi kurulum patlamış olsaydı 503
  // dönerdi, çünkü o kontrol ayristir'dan ÖNCE koşuyor.
  ok('N12 · /api/analyze modül düzeyi motor kurulumu başarılı (503 değil)', q.kod !== 503, `kod ${q.kod}`);

  const r2 = await cagirUc(anaHandler, 'GET', { symbols: 'AAPL', vade: 'yillik' });
  const r3 = await cagirUc(anaHandler, 'GET', { symbols: 'A,B,C,D,E,F,G,H,I' });
  const r4 = await cagirUc(anaHandler, 'GET', { symbols: '!!!' });
  const r5 = await cagirUc(anaHandler, 'GET', { symbols: 'AAPL', market: 'XETRA' });
  ok('⑥c · bozuk vade → 400 bad_vade', r2.kod === 400 && r2.govde.error === 'bad_vade',
    `${r2.kod} ${r2.govde && r2.govde.error}`);
  ok('⑥c · 9 sembol → 400 cok_sembol', r3.kod === 400 && r3.govde.error === 'cok_sembol',
    `${r3.kod} ${r3.govde && r3.govde.error}`);
  ok('⑥c · biçimsiz sembol → 400 bad_symbol', r4.kod === 400 && r4.govde.error === 'bad_symbol',
    `${r4.kod} ${r4.govde && r4.govde.error}`);
  ok('⑥c · tanınmayan pazar → 400 bad_market', r5.kod === 400 && r5.govde.error === 'bad_market',
    `${r5.kod} ${r5.govde && r5.govde.error}`);

  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['cok_sembol', r3], ['bad_symbol', r4], ['bad_market', r5]]) {
    ok(`⑥c · ${ad} gövdesinde uyarı metni var`, res.govde && res.govde.uyari === UYARI,
      String(res.govde && res.govde.uyari).slice(0, 20));
  }
  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['bad_vade', r2], ['bad_symbol', r4]]) {
    const metin = JSON.stringify(res.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
    ok(`⑥c · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
  }
  ok('⑥c · hata yolu Cache-Control: max-age=30',
    q.basliklar['cache-control'] === 'public, max-age=30', q.basliklar['cache-control']);
}

// --- ⑥d statik denetimler — api/analyze.js metni -------------------------
{
  const csrc = readFileSync(ANALYZE_PATH, 'utf8');
  const ckod = csrc.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  ok('⑥d · dosya uyarı metnini taşıyor', csrc.includes(UYARI));
  ok('N13 · yorum ayıklama çalışıyor (başlık düştü)',
    /\bIntl\b/.test(csrc) && !/\bIntl\b/.test(ckod), 'başlıkta var, kodda yok');

  // HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1) — ⑤d ile aynı küme.
  ok('⑥d · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(ckod));
  ok('⑥d · HAM SAYI · `toFixed(` yok', !ckod.includes('toFixed('));
  ok('⑥d · HAM SAYI · `toLocaleString` yok', !ckod.includes('toLocaleString'));
  const emojiVar = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(ckod);
  ok('⑥d · HAM SAYI · kodda emoji yok', !emojiVar, emojiVar ? 'emoji bulundu' : 'temiz');
  const paraVar = /[₺€£¥₩%]|×ATR/.test(ckod);
  ok('⑥d · HAM SAYI · kodda para/yüzde simgesi yok', !paraVar, paraVar ? 'simge bulundu' : 'temiz');

  ok('⑥d · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(csrc));
  const tasiyici = csrc.match(/^import .* from '\.\/_[a-z]+\.js';$/gm) || [];
  // DÖRT → BEŞ (2026-10-14): `api/_girdi.js` eklendi. Sayı bilerek SABİT —
  // altıncı bir taşıyıcı sessizce doğmasın, gerekçesi yazılarak doğsun.
  ok('⑥d · yalnız BEŞ taşıyıcı import ediliyor (ALTINCI taşıyıcı yok)',
    ['./_motor.js', './_ayar.js', './_ag.js', './_akis.js', './_girdi.js']
      .every((m) => csrc.includes(`from '${m}'`))
    && tasiyici.length === 5, `${tasiyici.length} taşıyıcı import`);
  // Öteki UÇLARI import ETMEZ: ettiği an analyze lambda'sı iki motor kurar
  // ve SEC önbellekleri (`secCikMap`/`secModelCache`) ikiye bölünür.
  ok('⑥d · api/score.js ve api/recommend.js import edilmiyor',
    !/from\s+['"]\.\/(score|recommend)\.js['"]/.test(csrc));

  // Sayaç motora tek bir sayı dahi GEÇİRMİYOR — yalnız gözlemci.
  ok('⑥d · sayaç yalnız gözlemci (analyzeOne\'a sayac geçmiyor)',
    !/analyzeOne\([^)]*sayac/s.test(csrc));

  // Başarısız sembol kaydı HER İKİ üst katman alanını da taşıyor: istemci
  // `'analiz' in kayit` ile `kayit.analiz` arasında ayrım yapmak zorunda
  // kalmasın.
  ok('⑥d · sembol hata kaydında `plan: null` var', /plan:\s*null/.test(ckod));
  ok('⑥d · sembol hata kaydında `analiz: null` var', /analiz:\s*null/.test(ckod));
  ok('⑥d · 502 yolunda yalnız makine kodu var',
    ckod.includes("error: 'analiz_hesaplanamadi'")
    && !/res\.status\(502\)[\s\S]{0,200}stack/.test(ckod));

  // `surum` BİÇİMİ istemci sözleşmesi: üç uçta aynı iki anahtar. Ayrışırsa
  // istemci üç uçtan gelen motor sürümünü karşılaştıramaz.
  ok('⑥d · `surum` biçimi öteki iki uçla aynı ({ motor, ayar })',
    ckod.includes('surum: { motor: IMZA, ayar: IMZA_AYAR }')
    && readFileSync(SCORE_PATH, 'utf8').includes('surum: { motor: IMZA, ayar: IMZA_AYAR }')
    && readFileSync(RECOMMEND_PATH, 'utf8').includes('surum: { motor: IMZA, ayar: IMZA_AYAR }'));
}

// --- ⑥e bütüncül katmanın HAM SAYI disiplini — api/_akis.js metni -------
// Bu bölümün çivilediği şey TEK satırlık bir "kolaylık"la bozulabilir:
// `...hol` yazmak yeterli. O yüzden analizKatmani'nin DİLİMİ ayrı ayıklanıp
// sınanıyor — planKatmani'nin metni karışmasın.
{
  const asrc2 = readFileSync(AKIS_PATH, 'utf8');
  const i0 = asrc2.indexOf('export function analizKatmani(');
  const i1 = asrc2.indexOf('export async function analyzeOne(');
  const dilim = (i0 >= 0 && i1 > i0) ? asrc2.slice(i0, i1) : '';
  const dkod = dilim.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  // Önce AYIKLAMA çalışıyor mu: boş dilim aşağıdaki bütün "yok" denetimlerini
  // sessizce yeşil yapardı.
  ok('N14 · analizKatmani dilimi ayıklanabildi (boş değil)',
    dilim.length > 600 && dkod.includes('return {'), `${dilim.length} krk`);

  // Bütüncül okuma MOTORDAN geliyor — akış kendi matrisini/eşiğini kurmuyor.
  ok('⑥e · bütüncül skor motordan (`eng.computeHolisticScore`) çağrılıyor',
    dkod.includes('eng.computeHolisticScore('));
  ok('⑥e · FA kararı motordan (`eng.faVerdict`) çağrılıyor',
    dkod.includes('eng.faVerdict('));
  // COMPOSITE_MATRIX konumlaması ZATEN composite()'te taşınıyor; burada
  // tekrarlanırsa aynı sayı iki yerden üretilir ve biri sessizce ayrışır.
  ok('⑥e · COMPOSITE_MATRIX analizKatmani\'nda TEKRARLANMIYOR',
    !dkod.includes('COMPOSITE_MATRIX'));

  // SERBEST TÜRKÇE METİN TELE ÇIKMIYOR: `parts[].note` ve `growthNote.txt`
  // sökülüyor, yalnız sabit kümeli sınıf kodu (`cls`) geçiyor.
  ok('⑥e · `growthNote.txt` tele konmuyor (yalnız `cls` geçiyor)',
    dkod.includes('growthNote.cls') && !dkod.includes('growthNote.txt'));
  ok('⑥e · direk `note` alanı tele konmuyor',
    !/\.note\b/.test(dkod) && !/\bnote:/.test(dkod));
  // `direkler` TAM olarak dört alan taşıyor: k · w · v · conf. `...p` yazmak
  // `note`u sessizce geri getirirdi.
  ok('⑥e · `direkler` yalnız k · w · v · conf alanlarını taşıyor',
    /\{\s*k:\s*p\.k,\s*w:\s*round6\(p\.w\),\s*v:\s*round6\(p\.v\),\s*conf:\s*p\.conf,?\s*\}/s.test(dkod)
    && !/\.\.\.p\b/.test(dkod));

  // Eşik/çarpan akışta DEĞİL (sayı motorda, cümle çağrı noktasında). Tek bir
  // `skor10 >= 7` bile motoru atlayan İKİNCİ bir karar kuralı demek olur.
  const esikler = dkod.match(/[<>]=?\s*\d/g) || [];
  ok('⑥e · analizKatmani sayısal eşik karşılaştırması taşımıyor',
    esikler.length === 0, esikler.length ? esikler.join(' ') : 'eşik yok');

  // Biçimlendirme de yok: HAM SAYI kuralı akışın bu parçası için de geçerli.
  ok('⑥e · analizKatmani biçimlendirme yapmıyor (`toFixed`/`Intl` yok)',
    !dkod.includes('toFixed(') && !/\bIntl\b/.test(dkod));
}

// =========================================================================
bolum('⑦ SÜRE TAVANI — sembol İÇİNDE de duran fren');
// =========================================================================
// BU BÖLÜM NE: tests/sure.mjs'in CI'da koşabilen, saniyenin altında biten
// ikizi. O dosya ÜRETİM sabitleriyle koşuyor (tavan 50 sn → koşum 50 sn) ve
// bu yüzden kapı dörtlüsüne giremiyor; burada aynı fren MİLİSANİYELERE
// küçültülüp sınanıyor (`canliAg({ tavanMs, butceMs })`).
//
// NİYE VAR: ölçüm bir açık buldu (tests/duman.mjs canlı, tests/sure.mjs
// belirlenimci) — AAPL+ASELS.IS için TEK ÇAĞRI 76,0 sn sürdü, `maxDuration`
// 60 aşıldı, Vercel lambda'yı KESERDİ. Sebep: `BUTCE_MS` yalnız SEMBOLLER
// ARASINDA bakılıyordu; sembol içindeki isteklerin TOPLAMINA üst sınır
// yoktu. Düzeltme `api/_ag.js`e MUTLAK SON TARİH koydu. Bu bölüm o son
// tarihin gerçekten kestiğini ve SÖZLEŞMEYE uyduğunu ölçüyor.
//
// AĞ YASAĞI: tek bir paket dışarı çıkmaz. `globalThis.fetch` bir KARA DELİK
// ile değiştiriliyor (hiç çözülmez, yalnız iptal sinyaline uyar — gerçek
// fetch de öyle yapıyor) ve bölüm sonunda GERİ KONUYOR. Kara delik iptale
// uymazsa `cek()` sonsuza kilitlenirdi; yani bu bir kolaylık değil, gerçeğe
// benzeme koşulu.
{
  const { canliAg, bosSayac, sayacTam, TUR_BUTCE_MS, TUR_TAVAN_MS } =
    await import('../api/_ag.js');

  // --- ⑦a sayı TEK yerde mi -------------------------------------------
  // Asıl kazanç bu: eşik üç uca kopyalanmadı. Bir uca elle `BUTCE_MS`
  // yazan biri bu denetimi kırmızı yakar.
  ok('⑦a · süre eşikleri `api/_ag.js`ten dışa aktarılıyor (tek sayı yeri)',
    TUR_BUTCE_MS === 45000 && TUR_TAVAN_MS === 50000,
    `butce ${TUR_BUTCE_MS} · tavan ${TUR_TAVAN_MS}`);

  // TAVAN > BÜTÇE olmak ZORUNDA: 45'ten sonra yeni sembole başlanmıyor,
  // kalan 5 sn BAŞLAMIŞ sembolün toparlanmasına kalıyor. Eşit olsalardı
  // 45. sn'de başlayan sembol anında tavana çarpar, boşuna kesinti üretirdi.
  ok('⑦a · TUR_TAVAN_MS > TUR_BUTCE_MS (başlamış sembole toparlanma payı)',
    TUR_TAVAN_MS > TUR_BUTCE_MS, `${TUR_TAVAN_MS} > ${TUR_BUTCE_MS}`);

  // Tavan `maxDuration`ın ALTINDA olmalı, yoksa fren kesilme anında döner.
  // Üç ucun `config.maxDuration`ı okunuyor — sayı burada ikinci kez yazılmıyor.
  for (const [ad, cfg] of [['score', config], ['recommend', recConfig], ['analyze', anaConfig]]) {
    ok(`⑦a · ${ad}: TUR_TAVAN_MS < maxDuration (serileştirmeye pay var)`,
      TUR_TAVAN_MS < cfg.maxDuration * 1000,
      `${TUR_TAVAN_MS} ms < ${cfg.maxDuration} sn`);
  }

  // Uçlarda eşik SAYISI kalmadı: `butceDoldu()` çağrılıyor, sayı taşınmıyor.
  for (const [ad, p] of [['score', SCORE_PATH], ['recommend', RECOMMEND_PATH], ['analyze', ANALYZE_PATH]]) {
    const src = readFileSync(p, 'utf8');
    const kodSatir = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    ok(`⑦a · ${ad}: KODDA kendi BUTCE_MS sabiti yok (taşıyıcıya soruyor)`,
      !/const\s+BUTCE_MS\s*=/.test(kodSatir) && kodSatir.includes('AG.butceDoldu()'));
  }

  // --- ⑦b KARA DELİK AĞ: fren gerçekten kesiyor mu ---------------------
  const gercekFetch = globalThis.fetch;
  let acilanIstek = 0;
  globalThis.fetch = (url, o = {}) => {
    acilanIstek++;
    return new Promise((_coz, reddet) => {
      const iptal = () => { const e = new Error('aborted'); e.name = 'AbortError'; reddet(e); };
      const s = o.signal;
      if (s) { if (s.aborted) { iptal(); return; } s.addEventListener('abort', iptal, { once: true }); }
    });
  };

  try {
    // Ölçekli kurulum: tavan 300 ms, her istek 5 sn istiyor. Tavan OLMASAYDI
    // tek istek 5 sn sürerdi; tavan varsa toplam ~300 ms'de biter.
    // İstek sayısı 6: ölçülen gerçek koşumun (tests/sure.mjs) açtığı sayı.
    const TAVAN = 300;
    const AG2 = canliAg({
      taWeights: {}, taBenchmark: {},
      yahooMs: 5000, secMs: 5000, isMs: 5000,
      tavanMs: TAVAN, butceMs: 200,
    });

    AG2.yeniTur();
    const sayac = bosSayac();
    AG2.odakla(sayac);
    const t0 = Date.now();
    // Altı Yahoo isteği SIRAYLA — tavan olmasa 6 × 5 sn = 30 sn.
    for (let i = 0; i < 6; i++) {
      try { await AG2.H.fetch(`https://query1.finance.yahoo.com/v8/finance/chart/T${i}`); }
      catch { /* fren ya da zaman aşımı; ikisi de `kesinti` */ }
    }
    const gecenMs = Date.now() - t0;
    AG2.odakla(null);

    ok('⑦b · tavan sembol İÇİNDE kesiyor (6 sıralı istek, her biri 5 sn isterdi)',
      gecenMs < TAVAN * 3, `${gecenMs} ms < ${TAVAN * 3} ms (tavansız ≈ 30.000 ms)`);

    // Tavandan sonra ağa HİÇ çıkılmıyor: soket bile açılmıyor.
    ok('⑦b · tavandan sonra ağa hiç çıkılmıyor (6 istekten yalnız bir kısmı soket açtı)',
      acilanIstek > 0 && acilanIstek < 6, `${acilanIstek}/6 soket açıldı`);

    // --- ⑦c SÖZLEŞME: tavan = `kesinti`, 404 = `yok` ------------------
    // Ölçemediğimiz şey SESSİZ SIFIR değil. Altı istek de kesinti sayılmalı
    // (zaman aşımına düşen ilk istek + tavanın kestiği beşi).
    ok('⑦c · tavana çarpan istek `kesinti` sayılıyor (sessiz sıfır yok)',
      sayac.yahoo.kesinti === 6, `yahoo istek ${sayac.yahoo.istek} · kesinti ${sayac.yahoo.kesinti}`);

    // SAYAÇ AYRIMI KORUNDU: tavan `yok`a dokunmuyor. 404 bir VERİ cevabı
    // ("o kalem yok"), tavan ise ÖLÇEMEDİM. Fren bu ikisini karıştırırsa
    // istemci "düşük skor" ile "ölçemedim"i ayırt edemez.
    ok('⑦c · tavan `yok` sayacını kirletmiyor (404 = veri cevabı ayrı kaldı)',
      sayac.sec.yok === 0);

    // `tam:false` = ÖLÇEMEDİM. Tavana çarpmak bir ARIZA değil; uç 200
    // dönmeye devam eder, ama bu bayrak düşer.
    ok('⑦c · kesinti varken sayacTam false (= "ölçemedim", "veri yok" değil)',
      sayacTam(sayac) === false);

    // --- ⑦d SEMBOLLER ARASI fren ayrı ve çalışıyor --------------------
    // `butceMs: -1` — SIFIR DEĞİL. Son tarih `t0 + butceMs` ve karşılaştırma
    // `Date.now() > butce`; sıfırla son tarih tam `t0` olur ve aynı
    // milisaniye içinde "dolmuş" SAYILMAZ. Ölçerken bu denetim kırmızı
    // yandı: hata frende değil, varsayımdaydı — dolu olması için son tarih
    // GEÇMİŞTE olmalı. Üretimde (45000) `>` ile `>=` farkı yok, o yüzden
    // taşıyıcıya dokunulmadı; düzeltme testin kendisine yazıldı.
    const AG3 = canliAg({ taWeights: {}, taBenchmark: {}, tavanMs: 9999, butceMs: -1 });
    AG3.yeniTur();
    ok('⑦d · butceDoldu() semboller arası freni veriyor (geçmiş son tarih → dolu)',
      AG3.butceDoldu() === true);

    const AG4 = canliAg({ taWeights: {}, taBenchmark: {}, tavanMs: 9999, butceMs: 9999 });
    AG4.yeniTur();
    ok('⑦d · taze turda bütçe DOLU DEĞİL (fren yanlış yere basmıyor)',
      AG4.butceDoldu() === false && AG4.tavanDoldu() === false && AG4.kalanMs() > 0,
      `kalan ${AG4.kalanMs()} ms`);

    // `yeniTur()` saati de sıfırlıyor: ikinci istek birincinin dolmuş
    // tavanını DEVRALMAZ. Sıcak lambda'da bu hata her isteği boş döndürürdü.
    const AG5 = canliAg({ taWeights: {}, taBenchmark: {}, tavanMs: 40, butceMs: 40 });
    AG5.yeniTur();
    await new Promise((r) => setTimeout(r, 70));
    const dolduMu = AG5.tavanDoldu();
    AG5.yeniTur(); // yeni istek
    ok('⑦d · yeniTur() süre saatini SIFIRLIYOR (sıcak lambda ikinci isteği boş dönmez)',
      dolduMu === true && AG5.tavanDoldu() === false && AG5.butceDoldu() === false);
  } finally {
    globalThis.fetch = gercekFetch; // kara delik bölümle sınırlı
  }
}


// =========================================================================
bolum('⑧ /api/theme — LLM keşif ucu, AYNI kabuk');
// =========================================================================
//  NİYE BU BÖLÜM VAR: `tests/parity.mjs` theme'i KORUMAZ — theme skor
//  şeridinde değil (motor/akış içe almıyor, fikstürü yok). Yani bu ucun
//  kabuğu ölçülmezse HİÇBİR test onu görmez. ELITE_ROADMAP FAZ 1 "uçları
//  aynı kabuk disiplinine sok" maddesi tam olarak bunu kapatıyor.
//
//  AĞ YASAĞI ⑧'de de geçerli ve burada DAHA SIKI tahsil ediliyor: handler
//  yalnız ağ'a hiç gitmeyen yollarla çağrılıyor (OPTIONS · GET-dışı ·
//  q yok · q çok uzun · anahtar yok) ve `globalThis.fetch` bölüm boyunca
//  PATLAYAN bir sahte ile değiştiriliyor. Bir regresyon bu yollardan
//  birinde ağ açarsa test kırmızı yanar, sessizce yavaşlamaz.
{
  const gercekFetch = globalThis.fetch;
  const gercekAnahtar = process.env.ANTHROPIC_API_KEY;
  let agDenemesi = 0;
  globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑧ AĞ YASAĞI: ' + String(a[0])); };
  try {
    const cagirTema = async (method, query) => {
      const res = sahteRes();
      await temaHandler({ method, query }, res);
      return res;
    };

    // --- ⑧a yüzey -------------------------------------------------------
    ok('⑧a · default dışa aktarma bir fonksiyon', typeof temaHandler === 'function', typeof temaHandler);
    ok('⑧a · config.runtime = nodejs', temaConfig && temaConfig.runtime === 'nodejs',
      String(temaConfig && temaConfig.runtime));
    // 30 BİLEREK SABİT: theme tek bir LLM çağrısı yapıyor, skor uçlarının
    // 60'ına (8 sembol × 7,2 sn) ihtiyacı yok. Sayı değişirse gerekçesi
    // ÖLÇÜLMÜŞ olmalı — bu denetim onu tartışmaya zorlar.
    ok('⑧a · config.maxDuration = 30', temaConfig && temaConfig.maxDuration === 30,
      String(temaConfig && temaConfig.maxDuration));
    ok('⑧a · saf yardımcılar dışa aktarılmış (ağsız sınanabilir)',
      typeof extractArray === 'function' && typeof cleanCandidates === 'function');

    // --- ⑧b SINIR TEK KAYNAKTAN (ölçülen sapma ④) -----------------------
    // theme'de yerel `120`, `_girdi.js`te `128` vardı. Artık tek bağlama.
    ok('⑧b · AZAMI_SORGU `_girdi.js` ile AYNI NESNE/DEĞER (kopya yok)',
      temaAzamiSorgu === AZAMI_SORGU && temaAzamiSorgu === 128,
      `theme ${temaAzamiSorgu} · _girdi ${AZAMI_SORGU}`);
    ok('⑧b · AZAMI_ADAY adlandırılmış sabit (gömülü 14 değil)', AZAMI_ADAY === 14, String(AZAMI_ADAY));
    // Süre freni maxDuration'ın ALTINDA olmalı: platform kesmeden önce biz
    // kesmeliyiz, yoksa istemci HİÇ cevap almaz.
    ok('⑧b · LLM_ISTEK_MS < maxDuration (fren platformdan önce basıyor)',
      LLM_ISTEK_MS > 0 && LLM_ISTEK_MS < temaConfig.maxDuration * 1000,
      `${LLM_ISTEK_MS} ms < ${temaConfig.maxDuration * 1000} ms`);

    // --- ⑧c handler kapısı (ağsız yollar) -------------------------------
    const o = await cagirTema('OPTIONS', {});
    ok('⑧c · OPTIONS → 204, gövde yok', o.kod === 204 && o.bitti === true && o.govde === null,
      `kod ${o.kod}`);
    ok('⑧c · CORS başlıkları /api/score ile aynı küme',
      o.basliklar['access-control-allow-origin'] === '*'
      && o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS'
      && o.basliklar['access-control-max-age'] === '86400',
      JSON.stringify(o.basliklar));

    // Ölçülen sapma ②: POST eskiden GET gibi işleniyordu.
    const p = await cagirTema('POST', { q: 'yapay zeka' });
    ok('⑧c · POST → 405 + Allow (eskiden GET gibi işleniyordu)',
      p.kod === 405 && p.basliklar.allow === 'GET, OPTIONS', `${p.kod} ${p.basliklar.allow}`);
    ok('⑧c · 405 gövdesi yalnız error + uyari', anahtarlar(p.govde) === 'error,uyari',
      anahtarlar(p.govde));
    const d = await cagirTema('DELETE', {});
    ok('⑧c · DELETE → 405 (kapı tek yönteme bakmıyor)', d.kod === 405, `kod ${d.kod}`);

    const q0 = await cagirTema('GET', {});
    ok('⑧c · q yok → 400 missing_q', q0.kod === 400 && q0.govde.error === 'missing_q',
      `${q0.kod} ${q0.govde && q0.govde.error}`);
    const q1 = await cagirTema('GET', { q: '   ' });
    ok('⑧c · yalnız boşluk → 400 missing_q (trim ediliyor)',
      q1.kod === 400 && q1.govde.error === 'missing_q', `${q1.kod} ${q1.govde && q1.govde.error}`);

    const q2 = await cagirTema('GET', { q: 'x'.repeat(AZAMI_SORGU + 1) });
    ok('⑧c · AZAMI_SORGU+1 → 400 too_long', q2.kod === 400 && q2.govde.error === 'too_long',
      `${q2.kod} ${q2.govde && q2.govde.error}`);
    ok('⑧c · too_long gövdesi sınırı SAYI olarak bildiriyor', q2.govde.azami === AZAMI_SORGU,
      String(q2.govde.azami));

    // Anahtar yok → 200 + no_key. Bu bir ARIZA DEĞİL: istemci haber
    // katmanına düşsün diye dürüst bir durum bildirimi. Ortam değişkeni
    // BİLEREK siliniyor; aksi halde anahtarı olan bir makinede bu denetim
    // gerçekten Anthropic'e çıkardı.
    delete process.env.ANTHROPIC_API_KEY;
    const nk = await cagirTema('GET', { q: 'nükleer enerji' });
    ok('⑧c · anahtar yok → 200 + error no_key (hata değil, durum)',
      nk.kod === 200 && nk.govde.error === 'no_key', `${nk.kod} ${nk.govde && nk.govde.error}`);
    ok('⑧c · no_key gövdesinde candidates HER ZAMAN dizi',
      Array.isArray(nk.govde.candidates) && nk.govde.candidates.length === 0);
    ok('⑧c · no_key gövdesinde `ms` HAM sayı', typeof nk.govde.ms === 'number', typeof nk.govde.ms);

    // Ölçülen sapma ①: hiçbir gövdede uyarı metni YOKTU.
    for (const [ad, res] of [['405', p], ['missing_q', q0], ['too_long', q2], ['no_key', nk]]) {
      ok(`⑧c · ${ad} gövdesinde uyarı metni var`, res.govde && res.govde.uyari === UYARI,
        String(res.govde && res.govde.uyari).slice(0, 20));
    }

    // Ölçülen sapma ⑤: `detail: e.message` iç hata metnini sızdırıyordu.
    for (const [ad, res] of [['405', p], ['missing_q', q0], ['too_long', q2], ['no_key', nk]]) {
      const metin = JSON.stringify(res.govde || {});
      const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
      ok(`⑧c · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
      ok(`⑧c · ${ad} gövdesinde \`detail\` alanı yok`, !('detail' in (res.govde || {})));
    }

    // Ölçülen sapma ③: no_key 60, llm_error 30 — iki farklı sayı vardı.
    for (const [ad, res] of [['405', p], ['missing_q', q0], ['too_long', q2], ['no_key', nk]]) {
      ok(`⑧c · ${ad} kısa önbellekli (üç uçla AYNI sabit)`,
        res.basliklar['cache-control'] === 'public, max-age=30', res.basliklar['cache-control']);
    }

    // AĞ YASAĞI tahsili: yukarıdaki yolların HİÇBİRİ soket açmadı.
    ok('⑧c · ağsız yolların hiçbiri fetch çağırmadı', agDenemesi === 0, `${agDenemesi} deneme`);

    // --- ⑧d statik denetimler — api/theme.js metni -----------------------
    {
      const src = readFileSync(THEME_PATH, 'utf8');
      const kod = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

      ok('⑧d · dosya uyarı metnini taşıyor', src.includes(UYARI));
      ok('N8 · yorum ayıklama çalışıyor (başlık düştü)',
        /\bIntl\b/.test(src) && !/\bIntl\b/.test(kod), 'başlıkta var, kodda yok');

      // HAM SAYI kuralının ASIL ölçtüğü şey: biçimlenmiş sayı. `reason`
      // serbest metni BİLEREK kalıyor (gerekçe theme.js başlığında) — ama
      // biçimlenmiş sayı burada da sıfır olmalı.
      ok('⑧d · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
      ok('⑧d · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
      ok('⑧d · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));

      // ANAHTAR DİSİPLİNİ — en pahalı sızıntı. Anahtar ne loglanır ne
      // cevaba konur ne URL'ye girer; yalnız `x-api-key` başlığında.
      const logSatirlari = kod.split('\n').filter((l) => /console\.(log|error|warn|info)/.test(l));
      ok('⑧d · ANAHTAR loglanmıyor (console.* satırlarında apiKey/ANTHROPIC yok)',
        !logSatirlari.some((l) => /apiKey|ANTHROPIC_API_KEY/.test(l)),
        logSatirlari.length + ' log satırı tarandı');
      ok('N8 · log taraması boş değil (gerçekten console satırı var)', logSatirlari.length > 0,
        String(logSatirlari.length));
      ok('⑧d · ANAHTAR cevap gövdesine konmuyor (res.json içinde apiKey yok)',
        !/res\.status\([^)]*\)\.json\([^;]*apiKey/s.test(kod));
      ok('⑧d · ANAHTAR yalnız `x-api-key` başlığında',
        (kod.match(/apiKey/g) || []).length > 0
        && /'x-api-key':\s*apiKey/.test(kod));
      ok('⑧d · ANAHTAR URL\'ye girmiyor (sorgu dizesine eklenmiyor)',
        !/[?&][^'"\n]*\$\{?apiKey/.test(kod));

      // Ölçülen sapma ⑤ — kodda da yok, yalnız gövdede değil.
      ok('⑧d · `detail:` alanı koddan sökülmüş', !/\bdetail\s*:/.test(kod));

      // Ölçülen sapma ⑥ — hata yolunda log var.
      ok('⑧d · hata yolunda `api/theme:` önekli log var (üç uçla aynı kalıp)',
        /console\.error\('api\/theme:/.test(kod));

      // Ölçülen sapma ⑦ — fetch'te süre freni.
      ok('⑧d · LLM fetch\'inde AbortSignal freni var', /signal:\s*AbortSignal\.timeout/.test(kod));

      // Ölçülen sapma ④ — sınır içe alınıyor, yerel kopya yok.
      ok('⑧d · AZAMI_SORGU `_girdi.js`ten içe alınıyor',
        /^import \{[^}]*AZAMI_SORGU[^}]*\} from '\.\/_girdi\.js';$/m.test(src));
      ok('⑧d · yerel `AZAMI_SORGU = ` sabiti DİRİLMEMİŞ',
        !/^\s*(const|let|export const)\s+AZAMI_SORGU\s*=/m.test(kod));

      // ŞERİT AYRIMI: theme SKOR şeridine dokunmaz. Motor/akış/ağ taşıyıcısı
      // içe alınmaz — alınsaydı LLM ucu skorun bağımlılık ağacına girerdi.
      for (const m of ['./_motor.js', './_akis.js', './_ag.js', './_ayar.js']) {
        ok(`⑧d · \`${m}\` içe ALINMIYOR (skor şeridi bulaşmıyor)`, !src.includes(`from '${m}'`));
      }
      ok('⑧d · app.js / config.js import edilmiyor',
        !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));

      // `api.anthropic.com` YALNIZ burada. `api/_ag.js` (Yahoo/SEC/İş Yatırım
      // konağı) bu adresi TANIMAMALI — bir gün tanırsa skor şeridi LLM'e
      // bağlanmış olur ve parite testi bunu göremez.
      const agSrc = readFileSync(path.join(ROOT, 'api', '_ag.js'), 'utf8');
      ok('⑧d · `api/_ag.js` `api.anthropic.com` TANIMIYOR',
        !/anthropic/i.test(agSrc));

      ok('N8 · statik arama gerçekten çalışıyor',
        src.includes('export default async function handler'));
    }

    // --- ⑧e saf yardımcılar — ağsız vektörler ---------------------------
    {
      // extractArray: prefill '[' ile başladığımız için girdi KAPANIŞSIZ gelir.
      ok('⑧e · extractArray boş girdi → []', extractArray('').length === 0);
      ok('⑧e · extractArray null → []', extractArray(null).length === 0);
      ok('⑧e · extractArray prefill tamamlıyor (kapanış yok)',
        extractArray('{"symbol":"CEG"}').length === 1);
      ok('⑧e · extractArray kod çitini temizliyor',
        extractArray('```json\n{"symbol":"VST"}]\n```').length === 1);
      ok('⑧e · extractArray bozuk JSON → [] (patlamıyor)',
        Array.isArray(extractArray('{{{nonsense')) && extractArray('{{{nonsense').length === 0);

      // cleanCandidates: normalize + süzgeç.
      const ham = [
        { symbol: 'ceg', market: 'us', name: ' Constellation ', reason: ' Nükleer taban yük ' },
        { symbol: 'ASELS', market: 'BIST' },            // .IS eklenmeli
        { symbol: 'THYAO.IS' },                         // pazar sembolden çözülmeli
        { symbol: 'CEG' },                              // yineleme → atılmalı
        { symbol: '!!!' },                              // biçimsiz → atılmalı
        null, 'metin', 42,                              // nesne değil → atılmalı
      ];
      const temiz = cleanCandidates(ham);
      ok('⑧e · cleanCandidates sembolü büyütüyor + kırpıyor',
        temiz[0].symbol === 'CEG' && temiz[0].name === 'Constellation'
        && temiz[0].reason === 'Nükleer taban yük', JSON.stringify(temiz[0]));
      ok('⑧e · BIST adayına `.IS` garantisi', temiz[1].symbol === 'ASELS.IS' && temiz[1].market === 'BIST',
        JSON.stringify(temiz[1]));
      ok('⑧e · `.IS` ekinden pazar çözülüyor', temiz[2].symbol === 'THYAO.IS' && temiz[2].market === 'BIST',
        JSON.stringify(temiz[2]));
      ok('⑧e · yineleme / biçimsiz / nesne-olmayan eleniyor', temiz.length === 3,
        `${temiz.length} aday: ` + temiz.map((c) => c.symbol).join(','));
      ok('⑧e · eksik name/reason `null` (boş dize değil)',
        temiz[1].name === null && temiz[1].reason === null);
      ok('⑧e · cleanCandidates dizi olmayan girdiye dayanıyor',
        cleanCandidates(null).length === 0 && cleanCandidates('x').length === 0);

      // AZAMI_ADAY tavanı gerçekten basıyor mu.
      const cok = Array.from({ length: 30 }, (_, i) => ({ symbol: 'S' + i, market: 'US' }));
      ok('⑧e · AZAMI_ADAY tavanı basıyor', cleanCandidates(cok).length === AZAMI_ADAY,
        `${cleanCandidates(cok).length} / ${AZAMI_ADAY}`);

      // `reason` 140 karakterde kırpılıyor — serbest metin KALIYOR ama
      // sınırsız değil (theme.js başlığındaki HAM SAYI gerekçesi).
      const uzun = cleanCandidates([{ symbol: 'X', reason: 'a'.repeat(500) }]);
      ok('⑧e · `reason` 140 karakterde kırpılıyor', uzun[0].reason.length === 140,
        String(uzun[0].reason.length));
      ok('⑧e · `name` 80 karakterde kırpılıyor',
        cleanCandidates([{ symbol: 'X', name: 'b'.repeat(500) }])[0].name.length === 80);

      // N8 olumsuz kontrol: süzgeç her şeyi atmıyor (boş test değil).
      ok('N8 · cleanCandidates geçerli adayı GERÇEKTEN geçiriyor',
        cleanCandidates([{ symbol: 'NVDA' }]).length === 1);
    }
  } finally {
    globalThis.fetch = gercekFetch;
    if (gercekAnahtar === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = gercekAnahtar;
  }
}


// =========================================================================
bolum('⑨ /api/compare — dördüncü uç, AYNI kapı + alım-bandı sıralaması');
// =========================================================================
// BU BÖLÜM NE: /api/compare, /api/analyze'ın döndürdüğü HER ŞEYİ aynen
// döndürüp üstüne tek bir şey ekliyor — `sira`: sembolleri "şu an alım
// bandına uzaklık"a göre dizen satır. Zincir dört halkalı:
//     scoreOne ⊂ recommendOne ⊂ analyzeOne ⊂ /api/compare
// Sıralama app.js:12615'ten BİREBİR alındı; bu uç yeni bir eşik, ağırlık
// ya da puan UYDURMUYOR. ⑨ bunu bekçiliyor: sıra saf bir okuma mı, yoksa
// sessizce ikinci bir motor mu olmuş.
//
// AĞ YASAĞI ⑨'da EN KRİTİK yerde: iki GEÇERLİ sembolle çağrılırsa uç
// gerçekten Yahoo/SEC'e çıkar. Bu yüzden handler yalnız OPTIONS / GET-dışı
// / doğrulamadan DÖNEN sorgularla çağrılıyor; sıralama ise `siralaKiyas`
// fikstürüyle — ağa dokunmayan saf fonksiyon — ölçülüyor.

// --- ⑨a yüzey ----------------------------------------------------------
ok('⑨a · default dışa aktarma bir fonksiyon', typeof kiyHandler === 'function', typeof kiyHandler);
ok('⑨a · config.runtime = nodejs', kiyConfig && kiyConfig.runtime === 'nodejs', String(kiyConfig && kiyConfig.runtime));
ok('⑨a · config.maxDuration = 60 (analyze ile aynı: aynı ağ turu)',
  kiyConfig && kiyConfig.maxDuration === anaConfig.maxDuration && kiyConfig.maxDuration === 60,
  `compare ${kiyConfig && kiyConfig.maxDuration} · analyze ${anaConfig && anaConfig.maxDuration}`);
ok('⑨a · ASGARI_SEMBOL = 2 (tek sembol KIYASLANAMAZ)', ASGARI_SEMBOL === 2, String(ASGARI_SEMBOL));
ok('⑨a · ASGARI_SEMBOL < AZAMI_SEMBOL (aralık tutarlı)', ASGARI_SEMBOL < kiyAzami,
  `${ASGARI_SEMBOL}..${kiyAzami}`);
ok('⑨a · saf sıralayıcılar dışa aktarılmış (ağsız sınanabilir)',
  typeof siraAnahtari === 'function' && typeof siralaKiyas === 'function');

// --- ⑨b handler kapısı (ağa ÇIKMAYAN istekler) --------------------------
{
  const cagirKiy = async (method, query) => {
    const res = sahteRes();
    await kiyHandler({ method, query }, res);
    return res;
  };

  const o = await cagirKiy('OPTIONS', {});
  ok('⑨b · OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('⑨b · CORS yöntem başlığı GET, OPTIONS',
    o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('⑨b · CORS ön-uçuş önbelleği 86400', o.basliklar['access-control-max-age'] === '86400');

  const p = await cagirKiy('POST', {});
  ok('⑨b · POST → 405 + Allow', p.kod === 405 && p.basliklar.allow === 'GET, OPTIONS',
    `kod ${p.kod} · allow ${p.basliklar.allow}`);

  const q = await cagirKiy('GET', {});
  ok('⑨b · symbols yok → 400 symbols_yok', q.kod === 400 && q.govde.error === 'symbols_yok',
    `kod ${q.kod} · ${q.govde && q.govde.error}`);
  ok('N12 · modül düzeyi motor kurulumu başarılı (503 değil)', q.kod !== 503, `kod ${q.kod}`);

  // ASGARI kapısı — ⑨'nun kendine ait TEK kapı kuralı. Tek sembol doğrulama
  // kapısından GEÇİYOR (score/recommend/analyze için geçerli), ama kıyas
  // ucunda ANLAMSIZ: kendisiyle kıyaslanamaz. Burada 400 dönmezse uç ağa
  // çıkıp tek satırlık bir "sıralama" üretirdi.
  const t = await cagirKiy('GET', { symbols: 'AAPL' });
  ok('⑨b · tek sembol → 400 az_sembol (ağa ÇIKMADAN)',
    t.kod === 400 && t.govde.error === 'az_sembol', `kod ${t.kod} · ${t.govde && t.govde.error}`);
  ok('⑨b · az_sembol gövdesi asgariyi ve isteneni bildiriyor',
    t.govde.asgari === ASGARI_SEMBOL && t.govde.istenen === 1, JSON.stringify(t.govde));

  const r3 = await cagirKiy('GET', { symbols: 'A,B,C,D,E,F,G,H,I' });
  ok('⑨b · 9 sembol → 400 cok_sembol (taşıyıcı kapısı önce koşuyor)',
    r3.kod === 400 && r3.govde.error === 'cok_sembol', `${r3.govde && r3.govde.error}`);

  for (const [ad, res] of [['405', p], ['symbols_yok', q], ['az_sembol', t], ['cok_sembol', r3]]) {
    ok(`⑨b · ${ad} gövdesinde uyarı metni var`, res.govde && res.govde.uyari === UYARI);
    const metin = JSON.stringify(res.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
    ok(`⑨b · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
  }
  ok('⑨b · hata yolu Cache-Control: max-age=30',
    q.basliklar['cache-control'] === 'public, max-age=30', q.basliklar['cache-control']);
}

// --- ⑨c sıralama — SAF fikstür, ağ yok ----------------------------------
{
  const kayit = (sym, state, dAtr, skor10, rr) => ({
    sym,
    market: 'US',
    plan: { yakinlik: { state, dAtr }, riskOdul: { rrRatio: rr } },
    analiz: { butunculluk: { skor10 } },
  });

  ok('⑨c · siraAnahtari: band İÇİ → 0', siraAnahtari({ state: 'in', dAtr: 0.4 }) === 0);
  ok('⑨c · siraAnahtari: band ALTI (negatif dAtr) → 0 (uzaklık değil, fırsat)',
    siraAnahtari({ state: 'below', dAtr: -1.7 }) === 0);
  ok('⑨c · siraAnahtari: band yakını → dAtr', siraAnahtari({ state: 'near', dAtr: 0.6 }) === 0.6);
  ok('⑨c · siraAnahtari: uzak → dAtr', siraAnahtari({ state: 'far', dAtr: 3.2 }) === 3.2);
  ok('⑨c · siraAnahtari: yakınlık yok → null (0 DEĞİL)', siraAnahtari(null) === null);
  ok('⑨c · siraAnahtari: dAtr null → null', siraAnahtari({ state: 'far', dAtr: null }) === null);

  const { sira, siralanamayan } = siralaKiyas([
    kayit('FAR', 'far', 3.0, 9.0, 2.0),
    kayit('NEAR', 'near', 0.5, 5.0, 1.1),
    kayit('IN', 'in', 0.2, 6.0, 1.5),
    kayit('BELOW', 'below', -1.2, 8.0, 3.0),
    { sym: 'PLANSIZ', market: 'US', plan: null, analiz: null },
    { sym: 'YAKINSIZ', market: 'US', plan: { yakinlik: null }, analiz: null },
  ]);

  ok('⑨c · sıra uzaklığa göre artan', sira.map((x) => x.sym).join(',') === 'BELOW,IN,NEAR,FAR',
    sira.map((x) => `${x.sym}:${x.dAtr}`).join(' '));
  ok('⑨c · eşit uzaklıkta bütüncül skor TIE-BREAK (BELOW 8.0 > IN 6.0)',
    sira[0].sym === 'BELOW' && sira[1].sym === 'IN', `${sira[0].sym} < ${sira[1].sym}`);
  ok('⑨c · `sira` alanı 1\'den başlayıp artıyor',
    sira.every((x, i) => x.sira === i + 1), sira.map((x) => x.sira).join(','));
  ok('⑨c · planı olmayan sembol UYDURULMUYOR, `siralanamayan`a düşüyor',
    siralanamayan.join(',') === 'PLANSIZ,YAKINSIZ', siralanamayan.join(','));
  ok('⑨c · sıralanamayan sıraya hiç girmiyor', sira.length === 4, String(sira.length));
  ok('⑨c · satır yalnız SABİT KÜME kodu + HAM sayı taşıyor',
    anahtarlar(sira[0]) === 'dAtr,durum,market,rrRatio,sira,skor10,sym', anahtarlar(sira[0]));
  ok('⑨c · `durum` motorun sabit kümesinden',
    sira.every((x) => ['in', 'below', 'near', 'far'].includes(x.durum)));
  ok('⑨c · eksik bütüncül skor `null` (uydurma 0 değil)',
    siralaKiyas([kayit('X', 'far', 1, null, null)]).sira[0].skor10 === null);
  ok('⑨c · boş girdiye dayanıyor',
    siralaKiyas(null).sira.length === 0 && siralaKiyas([]).siralanamayan.length === 0);

  // N13 olumsuz kontrol: sıralama GERÇEKTEN sıralıyor (girdi sırası değil).
  ok('N13 · sıra girdi sırasının kopyası DEĞİL',
    sira[0].sym !== 'FAR', `ilk: ${sira[0].sym}`);
}

// --- ⑨d statik denetimler ----------------------------------------------
{
  const src = readFileSync(COMPARE_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok('⑨d · dosya uyarı metnini taşıyor', src.includes(UYARI));
  ok('N14 · yorum ayıklama çalışıyor (başlık düştü)',
    /app\.js:12615/.test(src) && !/app\.js:12615/.test(kod), 'başlıkta var, kodda yok');
  ok('⑨d · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('⑨d · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('⑨d · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));
  ok('⑨d · hata yolunda `api/compare:` önekli log var',
    /console\.error\('api\/compare:/.test(kod));
  ok('⑨d · 502 yalnız makine kodu döndürüyor',
    /error:\s*'kiyas_hesaplanamadi'/.test(kod) && !/\bdetail\s*:/.test(kod));
  ok('⑨d · motoru `_motor.js`ten alıyor (ikinci motor kopyası yok)',
    /from '\.\/_motor\.js'/.test(src) && !/from '\.\.\/app\.js'/.test(src));
  ok('⑨d · akışı `_akis.js`ten alıyor (scoreOne/recommendOne yeniden yazılmamış)',
    /analyzeOne/.test(kod) && !/function\s+(scoreOne|recommendOne|analyzeOne)\s*\(/.test(kod));
  // Sıralamada UYDURULMUŞ eşik olmamalı: app.js'teki tek sayı 1e-9 (kayan
  // nokta toleransı). Yeni bir "0.75 ATR altı iyi" gibi sabit girerse
  // ekran ile sunucu sessizce ayrışır.
  const siraBlok = kod.slice(kod.indexOf('export function siralaKiyas'));
  const sayilar = (siraBlok.slice(0, siraBlok.indexOf('\n}')).match(/(?<![\w.])-?\d+(?:\.\d+)?(?:e-?\d+)?/gi) || [])
    .filter((n) => !['0', '1', '-1', '1e-9'].includes(n));
  ok('⑨d · sıralamada uydurulmuş eşik YOK', sayilar.length === 0, sayilar.join(',') || 'temiz');
}

// =========================================================================
bolum('⑩ /api/causal — beşinci uç, haber ⇄ piyasa nedenselliği (POST)');
// =========================================================================
// BU BÖLÜM NE: /api/causal, "📉 Günün Nedeni" ekranının SAYISAL çekirdeği.
// Öteki dört uçtan iki yerde AYRILIYOR ve ikisi de bilerek:
//   ① POST — girdisi (endeks hareketleri + gündem konseptleri) sorgu
//      dizgisine SIĞMIYOR, `AZAMI_SORGU=128`i ilk konseptte aşıyor.
//   ② AĞA HİÇ ÇIKMIYOR — bu yüzden GEÇERLİ bir istekle çağırmak CI'da
//      güvenli; ⑩ ucun ASIL cevabını da ölçebiliyor (⑨'da yapamadığımız).
// Mantık bu dosyada DEĞİL: app.js'in nedensellik bölgesi tests/engine.mjs'e
// onuncu dilim olarak eklenip motor yeniden üretildi. ⑩ kopyanın geri
// gelmediğini de bekçiliyor.

// --- ⑩a yüzey ----------------------------------------------------------
ok('⑩a · default dışa aktarma bir fonksiyon', typeof nedenHandler === 'function', typeof nedenHandler);
ok('⑩a · config.runtime = nodejs', nedenConfig && nedenConfig.runtime === 'nodejs');
ok('⑩a · config.maxDuration = 10 (ağ turu YOK, 60 kopyalanmadı)',
  nedenConfig && nedenConfig.maxDuration === 10, String(nedenConfig && nedenConfig.maxDuration));
ok('⑩a · ayristirGovde() dışa aktarılmış (ağsız sınanabilir)', typeof ayristirGovde === 'function');
ok('⑩a · sınırlar sayı ve pozitif',
  AZAMI_HAREKET > 0 && AZAMI_KONSEPT > 0 && AZAMI_GOVDE_BAYT > 0,
  `${AZAMI_HAREKET} · ${AZAMI_KONSEPT} · ${AZAMI_GOVDE_BAYT}`);

// --- ⑩b method kapısı — GET DEĞİL ---------------------------------------
{
  const cagirNeden = async (method, body) => {
    const res = sahteRes();
    await nedenHandler({ method, body }, res);
    return res;
  };

  const o = await cagirNeden('OPTIONS');
  ok('⑩b · OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('⑩b · CORS yöntem başlığı POST, OPTIONS (öteki dört uçtan AYRI)',
    o.basliklar['access-control-allow-methods'] === 'POST, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('⑩b · CORS köken başlığı *', o.basliklar['access-control-allow-origin'] === '*');
  ok('⑩b · Content-Type başlığı ön-uçuşta izinli',
    /Content-Type/i.test(o.basliklar['access-control-allow-headers'] || ''),
    o.basliklar['access-control-allow-headers']);

  const g = await cagirNeden('GET');
  ok('⑩b · GET → 405 (bu uç POST)', g.kod === 405 && g.govde.error === 'method_not_allowed',
    `kod ${g.kod}`);
  ok('⑩b · 405 Allow başlığı POST, OPTIONS', g.basliklar.allow === 'POST, OPTIONS', g.basliklar.allow);
  ok('⑩b · hata yolu Cache-Control: max-age=30',
    g.basliklar['cache-control'] === 'public, max-age=30', g.basliklar['cache-control']);
  ok('N15 · modül düzeyi motor kurulumu başarılı (503 değil)', g.kod !== 503, `kod ${g.kod}`);
}

// --- ⑩c gövde doğrulaması — ağsız vektörler -----------------------------
{
  const KINDLER = ['equity_tech', 'equity_us', 'equity_tr', 'gold'];
  const hata = (b) => { const r = ayristirGovde(b, KINDLER); return r.hata ? r.hata.govde.error : null; };

  ok('⑩c · gövde yok → govde_yok', hata(null) === 'govde_yok', String(hata(null)));
  ok('⑩c · dizi gövde → govde_yok', hata([]) === 'govde_yok');
  ok('⑩c · hareketler dizi değil → hareketler_yok', hata({ gundem: [] }) === 'hareketler_yok');
  ok('⑩c · gundem dizi değil → gundem_yok', hata({ hareketler: [] }) === 'gundem_yok');
  ok('⑩c · bilinmeyen endeks türü → bad_kind (sessiz 0 skor DEĞİL)',
    hata({ hareketler: [{ kind: 'kripto', pct: 1, notable: 1 }], gundem: [] }) === 'bad_kind');
  ok('⑩c · pct sayı değil → bad_pct',
    hata({ hareketler: [{ kind: 'gold', pct: 'çok', notable: 1 }], gundem: [] }) === 'bad_pct');
  ok('⑩c · notable yok → bad_notable (eşik UYDURULMUYOR)',
    hata({ hareketler: [{ kind: 'gold', pct: 1 }], gundem: [] }) === 'bad_notable');
  ok('⑩c · negatif notable → bad_notable',
    hata({ hareketler: [{ kind: 'gold', pct: 1, notable: -1 }], gundem: [] }) === 'bad_notable');
  ok('⑩c · konsept anahtarsız → konsept_key_yok',
    hata({ hareketler: [], gundem: [{ sectors: [] }] }) === 'konsept_key_yok');
  ok('⑩c · hareket tavanı → cok_hareket (kırpma YOK)',
    hata({ hareketler: Array.from({ length: AZAMI_HAREKET + 1 }, () => ({ kind: 'gold', pct: 1, notable: 1 })), gundem: [] })
      === 'cok_hareket');
  ok('⑩c · konsept tavanı → cok_konsept (kırpma YOK)',
    hata({ hareketler: [], gundem: Array.from({ length: AZAMI_KONSEPT + 1 }, (_, i) => ({ key: 'k' + i })) })
      === 'cok_konsept');
  ok('⑩c · tam tavan hâlâ kabul',
    hata({ hareketler: Array.from({ length: AZAMI_HAREKET }, () => ({ kind: 'gold', pct: 1, notable: 1 })), gundem: [] })
      === null);

  // Normalleştirme: motorun okumadığı alanlar TAŞINMIYOR, okudukları hayatta.
  const n = ayristirGovde({
    hareketler: [{ kind: 'equity_tech', pct: 1.8, notable: 0.8, fazla: 'x' }],
    gundem: [{
      key: 'ai',
      label: 'Yapay zekâ',
      emoji: '🤖',
      sectors: [['ai', 'up'], ['bozuk'], 'metin'],
      risk: 'on',
      tone: 0.4,
      heat: 'hot',
      heads: [{ title: 'Manşet', link: 'http://x', ageH: 3 }, { title: 'yaşsız' }],
    }],
  }, KINDLER);
  ok('⑩c · hareket motor biçimine çevriliyor (`cfg.kind`/`cfg.notable`)',
    n.rows[0].cfg.kind === 'equity_tech' && n.rows[0].cfg.notable === 0.8 && n.rows[0].pct === 1.8,
    JSON.stringify(n.rows[0]));
  ok('⑩c · hareketteki fazla alan atılıyor', anahtarlar(n.rows[0]) === 'cfg,pct');
  ok('⑩c · konseptten yalnız motorun OKUDUĞU alanlar geçiyor',
    anahtarlar(n.ag.items[0]) === 'heads,heat,key,risk,sectors,tone', anahtarlar(n.ag.items[0]));
  ok('⑩c · başlık/emoji taşınmıyor (tele geri dönmeyecekler)',
    n.ag.items[0].label === undefined && n.ag.items[0].emoji === undefined);
  ok('⑩c · bozuk sektör çifti eleniyor', n.ag.items[0].sectors.length === 1,
    JSON.stringify(n.ag.items[0].sectors));
  ok('⑩c · manşetten yalnız `ageH` okunuyor, yaşsız manşet eleniyor',
    n.ag.items[0].heads.length === 1 && anahtarlar(n.ag.items[0].heads[0]) === 'ageH',
    JSON.stringify(n.ag.items[0].heads));
  const vars1 = ayristirGovde({ hareketler: [], gundem: [{ key: 'k', risk: 'belki', heat: 'volkanik' }] }, KINDLER);
  ok('⑩c · bilinmeyen risk/heat güvenli varsayılana düşüyor',
    vars1.ag.items[0].risk === null && vars1.ag.items[0].heat === 'cool',
    JSON.stringify(vars1.ag.items[0]));
  ok('N16 · doğrulama GERÇEKTEN geçiriyor (boş test değil)', !n.hata && n.rows.length === 1);
}

// --- ⑩d gerçek cevap — AĞA ÇIKMADIĞI İÇİN ölçülebiliyor ------------------
{
  const res = sahteRes();
  await nedenHandler({
    method: 'POST',
    body: {
      hareketler: [
        { kind: 'equity_tech', pct: 1.8, notable: 0.8 },   // belirgin
        { kind: 'gold', pct: 0.1, notable: 0.8 },          // belirgin DEĞİL
      ],
      gundem: [
        { key: 'ai', sectors: [['ai', 'up'], ['semis', 'up']], risk: 'on', tone: 0.4, heat: 'hot', heads: [{ ageH: 3 }] },
        { key: 'savas', sectors: [['defense', 'up']], risk: 'off', tone: -0.5, heat: 'warm', heads: [{ ageH: 20 }] },
      ],
    },
  }, res);

  ok('⑩d · geçerli POST → 200', res.kod === 200, `kod ${res.kod}`);
  ok('⑩d · gövde alanları sabit', anahtarlar(res.govde) === 'baglar,degerlendirilen,eslesen,ms,surum,uyari',
    anahtarlar(res.govde));
  ok('⑩d · uyarı metni gövdede', res.govde.uyari === UYARI);
  ok('⑩d · belirgin hareket gündemle eşleşti', res.govde.baglar.length === 1,
    JSON.stringify(res.govde.baglar.map((b) => b.kind)));
  ok('⑩d · eşiğin ALTINDAKİ hareket düşüyor (uydurma bağ yok)',
    !res.govde.baglar.some((b) => b.kind === 'gold'));
  ok('⑩d · `degerlendirilen` istenen hareket sayısı, `eslesen` bağ sayısı',
    res.govde.degerlendirilen === 2 && res.govde.eslesen === 1,
    `${res.govde.degerlendirilen}/${res.govde.eslesen}`);
  ok('⑩d · bağ yalnız kind + HAM pct + links taşıyor',
    anahtarlar(res.govde.baglar[0]) === 'kind,links,pct', anahtarlar(res.govde.baglar[0]));
  ok('⑩d · link yalnız konsept ANAHTARI + HAM skor + sektör kodları',
    anahtarlar(res.govde.baglar[0].links[0]) === 'key,sektorler,skor',
    anahtarlar(res.govde.baglar[0].links[0]));
  ok('⑩d · `why` SERBEST TÜRKÇESİ tele ÇIKMIYOR',
    !JSON.stringify(res.govde).includes('risk iştahı')
    && !JSON.stringify(res.govde).includes('riskten kaçış'));
  ok('⑩d · skor HAM sayı (biçimlenmiş dize değil)', typeof res.govde.baglar[0].links[0].skor === 'number');
  ok('⑩d · motor + ayar imzası bildiriliyor',
    /^sha256:/.test(res.govde.surum.motor) && /^sha256:/.test(res.govde.surum.ayar),
    JSON.stringify(res.govde.surum));
  ok('⑩d · gövdeye bağlı cevap CDN\'de paylaşılmıyor (no-store)',
    res.basliklar['cache-control'] === 'no-store', res.basliklar['cache-control']);

  // Dürüst sessizlik: eşleşme yoksa 200 + BOŞ liste, uydurma bağ değil.
  const bos = sahteRes();
  await nedenHandler({ method: 'POST', body: { hareketler: [{ kind: 'gold', pct: 0.1, notable: 2 }], gundem: [] } }, bos);
  ok('⑩d · eşleşme yok → 200 + boş `baglar` (hata DEĞİL)',
    bos.kod === 200 && bos.govde.baglar.length === 0 && bos.govde.eslesen === 0, `kod ${bos.kod}`);

  // Bozuk JSON dizgesi — Vercel'in ayrıştıramadığı gövde.
  const bozuk = sahteRes();
  await nedenHandler({ method: 'POST', body: '{yarım' }, bozuk);
  ok('⑩d · bozuk JSON → 400 bozuk_json', bozuk.kod === 400 && bozuk.govde.error === 'bozuk_json');
  const buyuk = sahteRes();
  await nedenHandler({ method: 'POST', body: 'x'.repeat(AZAMI_GOVDE_BAYT + 1) }, buyuk);
  ok('⑩d · tavanı aşan gövde → 413 govde_buyuk', buyuk.kod === 413 && buyuk.govde.error === 'govde_buyuk');

  for (const [ad, r] of [['bozuk_json', bozuk], ['govde_buyuk', buyuk]]) {
    ok(`⑩d · ${ad} gövdesinde uyarı metni var`, r.govde.uyari === UYARI);
    const metin = JSON.stringify(r.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
    ok(`⑩d · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
  }
}

// --- ⑩e statik denetimler — mantık MOTORDA kalmalı -----------------------
{
  const src = readFileSync(CAUSAL_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  ok('⑩e · dosya uyarı metnini taşıyor', src.includes(UYARI));
  ok('N17 · yorum ayıklama çalışıyor (başlık düştü)',
    /HAM SAYI KURALI/.test(src) && !/HAM SAYI KURALI/.test(kod), 'başlıkta var, kodda yok');
  ok('⑩e · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('⑩e · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('⑩e · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));
  ok('⑩e · hata yolunda `api/causal:` önekli log var',
    /console\.error\('api\/causal:/.test(kod));
  ok('⑩e · 502 yalnız makine kodu döndürüyor',
    /error:\s*'neden_hesaplanamadi'/.test(kod) && !/\bdetail\s*:/.test(kod));

  // KOPYA YASAĞI — ⑩'un en pahalı denetimi. Mantık motorda; uçta yeniden
  // yazılırsa app.js ile sessizce ayrışan ikinci bir nedensellik doğar.
  ok('⑩e · `causalAlign` uçta YENİDEN YAZILMAMIŞ',
    !/function\s+causalAlign\s*\(/.test(kod));
  ok('⑩e · `computeCausalLinks` uçta YENİDEN YAZILMAMIŞ',
    !/function\s+computeCausalLinks\s*\(/.test(kod));
  ok('⑩e · `CAUSAL_INDEX_AFFINITY` tablosu uçta KOPYALANMAMIŞ',
    !/CAUSAL_INDEX_AFFINITY\s*=/.test(kod));
  ok('⑩e · üçü de MOTORDAN okunuyor (`ENG.`)',
    /ENG\.computeCausalLinks\(/.test(kod) && /ENG\.CAUSAL_INDEX_AFFINITY/.test(kod));
  ok('⑩e · gürültü eşiği (1.6) uçta DİRİLMEMİŞ', !/1\.6/.test(kod));
  ok('⑩e · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));

  // Motor gerçekten taşıyor mu — statik denetimin olumsuz kontrolü.
  const motorSrc = readFileSync(path.join(ROOT, 'api', '_motor.js'), 'utf8');
  ok('N18 · motor nedensellik dilimini GERÇEKTEN taşıyor',
    /function\s+computeCausalLinks\s*\(/.test(motorSrc)
    && /CAUSAL_INDEX_AFFINITY\s*=/.test(motorSrc));
  ok('⑩e · motor dışa aktarım listesinde üç sembol de var',
    /return \{[^}]*CAUSAL_INDEX_AFFINITY[^}]*causalAlign[^}]*computeCausalLinks[^}]*\}/.test(motorSrc));

  // DOM ve LLM dilimin DIŞINDA kaldı: motora sızmamalı.
  ok('⑩e · motora DOM sızmadı (`renderCausalLinks` yok)',
    !/renderCausalLinks/.test(motorSrc));
  ok('⑩e · motora LLM çağrısı sızmadı (`causalExplainLLM` yok)',
    !/causalExplainLLM/.test(motorSrc));
  ok('⑩e · uçta ANTHROPIC anahtarı geçmiyor', !/ANTHROPIC|apiKey/.test(src));
}


bitir();
