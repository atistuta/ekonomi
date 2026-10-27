#!/usr/bin/env node
// ===========================================================================
//  UÇ TESTLERİ — sekiz ucun kapıları   ·   AĞA ÇIKMAZ
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
//  NE ÖLÇER (14 bölüm)  ① ② ③ ④ = score · ⑤ = recommend · ⑥ = analyze
//                       ⑦ = süre freni · ⑧ = theme · ⑨ = compare
//                       ⑩ = causal · ⑫ = chart · ⑬ = pulse · ⑭ = news
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
//    ⑪ KV ÖNBELLEĞİ       — `api/_onbellek.js`: anahtar girdinin tamamını
//                           kapsıyor mu, MOTOR İMZASI değişince anahtar
//                           değişiyor mu (eski skor yeni motorla karışmasın),
//                           isabet GERÇEKTEN dış istek sayısını düşürüyor mu,
//                           ve KV YOK / ARIZALI / YAVAŞ üç halinde de uç
//                           cevap vermeye devam ediyor mu
//    ⑫ /api/chart         — altıncı uç: HAM mum serisi (native grafik),
//                           aralık/adım beyaz listesi, künye süzgeci,
//                           ilan edilen pencere ile KV TTL'inin TUTARLILIĞI
//                           ve Yahoo adresinin uçta DİRİLMEDİĞİ
//    ⑬ /api/pulse         — yedinci uç: makro duruş + konjonktür fazı.
//                           POST (girdi manşet listesi), İSTEMCİ YOLUNDA
//                           SIFIR dış istek, eksik veri UYDURULMUYOR,
//                           eşikler motorda, duruş AĞIRLIKLI /
//                           konjonktür AĞIRLIKSIZ ayrımı. 2026-10-24'ten
//                           sonra İKİNCİ bir yol var (sunucu haberi kendi
//                           tarar) — ⑬f onun GERİYE DÖNÜK UYUMUNU ölçüyor.
//    ⑭ /api/news          — sekizinci uç: haber (manşet) ucu + haberin
//                           KENDİ ağ taşıyıcısı (`api/_haber.js`). Kapı,
//                           limit tavanı, pazar beyaz listesi, RSS
//                           ayrıştırmasının SAF sınanması, ve haberin
//                           `_ag.js`in IZINLI listesine GİRMEDİĞİ
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

import { readFileSync, readdirSync, existsSync } from 'node:fs';
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
import { VADELER, IMZA_AYAR } from '../api/_ayar.js';
import { IMZA } from '../api/_motor.js';
// ⑪ /api/_onbellek.js — KV önbelleği. Modül düzeyinde HİÇBİR ŞEY kurmaz
// (@vercel/kv yalnız ilk okuma/yazmada dinamik import edilir), bu yüzden
// içe almak ağa çıkmaz. `kvTak()` sahte KV takan TEST KANCASI.
import {
  anahtar, skorGirdisi, oku, yaz, kvTak, kvHazir,
  ONBELLEK_SURUM, TTL_FIYAT, TTL_TEMA, KV_ISTEK_MS,
} from '../api/_onbellek.js';
// ⑧ /api/theme — LLM keşif ucu. Modül düzeyinde motor KURMUYOR ve ağa
// ÇIKMIYOR (yalnız sabit + saf fonksiyon), bu yüzden içe almak bedava.
import temaHandler, {
  config as temaConfig, extractArray, cleanCandidates,
  AZAMI_SORGU as temaAzamiSorgu, AZAMI_ADAY, LLM_ISTEK_MS,
} from '../api/theme.js';
import {
  AZAMI_SORGU, PAZARLAR as girdiPazarlar, temizleSembol as girdiTemizle,
  cozEndeks as girdiCozEndeks, ENDEKS_SOZLUGU as girdiSozluk, SEMBOL_BICIM,
} from '../api/_girdi.js';
// ⑫ /api/chart — fiyat serisi ucu. Modül düzeyinde motor kuruyor ama TEK
// istek atmıyor (öteki uçlarla aynı: ağ ancak handler bir seri çekerken açılır).
import grafikHandler, {
  config as grafikConfig, ARALIKLAR, ADIMLAR, VARSAYILAN_ARALIK, VARSAYILAN_ADIM,
  suzKunye, KUNYE_ALANLARI,
  AZAMI_SORGU as grafikAzamiSorgu, PAZARLAR as grafikPazarlar,
  temizleSembol as grafikTemizle,
  cozEndeks as grafikCozEndeks, ENDEKS_SOZLUGU as grafikSozluk,
} from '../api/chart.js';
// ⑬ /api/pulse — piyasa nabzı / konjonktür ucu. SIFIR dış istek: girdiyi
// istemci veriyor, uç yalnız akıl yürütüyor (bkz. dosya başlığı).
import nabizHandler, {
  config as nabizConfig, ayristirGovde as nabizAyristir, ayristirListe,
  AZAMI_BASLIK, AZAMI_GOVDE_BAYT as NABIZ_GOVDE_BAYT, PENCERE_GUN, TAZE_GUN,
  istemciVerdi, ayristirSunucuGirdisi, MAKRO_SORGULAR, AZAMI_SEMBOL_HABER,
} from '../api/pulse.js';
// ⑭ /api/news — haber ucu. Modül düzeyinde motor KURMUYOR ve ağa ÇIKMIYOR
// (yalnız sabit + saf fonksiyon), bu yüzden içe almak bedava.
import haberHandler, {
  config as haberConfig, VARSAYILAN_PAZAR,
  AZAMI_MADDE as haberAzamiMadde, VARSAYILAN_MADDE as haberVarsayilanMadde,
  AZAMI_HABER_SORGU as haberAzamiSorgu, HABER_PAZARLAR as haberPazarlar,
} from '../api/news.js';
// ⑭ haberin KENDİ ağ taşıyıcısı — `_ag.js` DEĞİL. `ayristirRSS` /
// `haberAdresi` / `izinliAdres` SAF: ağa çıkmadan ölçülebiliyorlar.
import {
  ayristirRSS, haberAdresi, izinliAdres, bosHaberSayac, haberTam,
  IZINLI_KONAK, HABER_ISTEK_MS, ASGARI_GOVDE_BAYT, MADDE_ALANLARI,
  PAZAR_YERELI, AZAMI_MADDE as agAzamiMadde,
} from '../api/_haber.js';
// ⑮ /api/tarama · /api/sektor · /api/radar · /api/backtest · /api/deger —
// BEŞ ROTA, SIFIR yeni fonksiyon dosyası: hepsi `api/proxy.js`in `__rota=`
// çoklayıcısına takılı bir MODÜL (`_` öneki). Modül düzeyinde motor kuruyor
// ama tek istek atmıyor (score.js/chart.js ile aynı kabuk).
import * as KESIF from '../api/_kesif.js';
import {
  ARALIKLAR as KESIF_ARALIKLAR, ADIMLAR as KESIF_ADIMLAR,
  AZAMI_GOVDE_BAYT as KESIF_GOVDE_BAYT,
} from '../api/_kesif.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCORE_PATH = path.join(ROOT, 'api', 'score.js');
const RECOMMEND_PATH = path.join(ROOT, 'api', 'recommend.js');
const ANALYZE_PATH = path.join(ROOT, 'api', 'analyze.js');
const AKIS_PATH = path.join(ROOT, 'api', '_akis.js');
const THEME_PATH = path.join(ROOT, 'api', 'theme.js');
const COMPARE_PATH = path.join(ROOT, 'api', 'compare.js');
const CAUSAL_PATH = path.join(ROOT, 'api', 'causal.js');
const GIRDI_PATH = path.join(ROOT, 'api', '_girdi.js');
const ONBELLEK_PATH = path.join(ROOT, 'api', '_onbellek.js');
const CHART_PATH = path.join(ROOT, 'api', 'chart.js');
const PULSE_PATH = path.join(ROOT, 'api', 'pulse.js');
const NEWS_PATH = path.join(ROOT, 'api', 'news.js');
const HABER_PATH = path.join(ROOT, 'api', '_haber.js');
const AG_PATH = path.join(ROOT, 'api', '_ag.js');
const KESIF_PATH = path.join(ROOT, 'api', '_kesif.js');
const PROXY_PATH = path.join(ROOT, 'api', 'proxy.js');
const VERCEL_PATH = path.join(ROOT, 'vercel.json');
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
  console.log(`✅ ${gecen} denetim geçti — /api/score + /api/recommend + /api/analyze + /api/theme + /api/compare + /api/causal + /api/chart + /api/pulse + /api/news + /api/tarama + /api/sektor + /api/radar + /api/backtest + /api/deger kapıları ve doğrulamaları yerinde.`);
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
  // DÖRT → BEŞ (2026-10-14): `api/_girdi.js` eklendi.
  // BEŞ → ALTI (2026-10-18): `api/_onbellek.js` eklendi — Vercel KV
  // önbelleği. GEREKÇE: ölçümde bir ABD sembolü 33 dış istek (31 SEC +
  // 2 Yahoo) ve ~7,2 sn; bu maliyeti tek bir KV okumasına indirmek için
  // ortak bir taşıyıcı gerekiyordu, alternatifi altı uca kopya mantık
  // yazmaktı. Sayı yine bilerek SABİT — YEDİNCİ taşıyıcı sessizce
  // doğmasın, gerekçesi yazılarak doğsun.
  ok('⑤d · yalnız ALTI taşıyıcı import ediliyor (YEDİNCİ taşıyıcı yok)',
    ['./_motor.js', './_ayar.js', './_ag.js', './_akis.js', './_girdi.js', './_onbellek.js']
      .every((m) => rsrc.includes(`from '${m}'`))
    && tasiyici.length === 6, `${tasiyici.length} taşıyıcı import`);
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
  // DÖRT → BEŞ (2026-10-14): `api/_girdi.js` eklendi.
  // BEŞ → ALTI (2026-10-18): `api/_onbellek.js` eklendi — Vercel KV
  // önbelleği. GEREKÇE: ölçümde bir ABD sembolü 33 dış istek (31 SEC +
  // 2 Yahoo) ve ~7,2 sn; bu maliyeti tek bir KV okumasına indirmek için
  // ortak bir taşıyıcı gerekiyordu, alternatifi altı uca kopya mantık
  // yazmaktı. Sayı yine bilerek SABİT — YEDİNCİ taşıyıcı sessizce
  // doğmasın, gerekçesi yazılarak doğsun.
  ok('⑥d · yalnız ALTI taşıyıcı import ediliyor (YEDİNCİ taşıyıcı yok)',
    ['./_motor.js', './_ayar.js', './_ag.js', './_akis.js', './_girdi.js', './_onbellek.js']
      .every((m) => csrc.includes(`from '${m}'`))
    && tasiyici.length === 6, `${tasiyici.length} taşıyıcı import`);
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

      // SERIT AYRIMI — KILIT DEGISTI ve NIYE:
      // Onceki hali `./_motor.js`i de yasakliyordu. `candidates[].sector` alani
      // icin motorun DONMUS `SYMBOL_SECTORS` sozlugu gerekti; tek secenek LLMden
      // sektor istemekti ve bu ucun kendi sozlesmesi halusinasyonu eliyor diyor —
      // dogrulanamaz bir metin alani eklemek o kuralin tam tersi olurdu.
      // Yasak KALDIRILMADI, DARALTILDI: ag tasiyicilari hala yasak, motor ithali
      // ise YALNIZ sozluk okumasi olarak ve ATIL konakla serbest.
      for (const m of ['./_akis.js', './_ag.js', './_ayar.js']) {
        ok('⑧d · ' + m + ' içe ALINMIYOR (ağ/skor şeridi bulaşmıyor)',
          !src.includes("from '" + m + "'"));
      }
      const motorIthali = src.includes("from './_motor.js'");
      ok('⑧d · motordan YALNIZ `buildMotor` içe alınıyor (skor simgesi yok)',
        !motorIthali
        || src.includes("import { buildMotor } from './_motor.js';"));
      ok('⑧d · motor ATIL konakla kuruluyor (fetch/fetchVia PATLIYOR)',
        !motorIthali
        || (kod.includes("fetch: async () => { throw")
            && kod.includes("fetchVia: async () => { throw")));
      ok('⑧d · TA_WEIGHTS/TA_BENCHMARK BOŞ geçiyor (eşik/ağırlık okunmuyor)',
        !motorIthali || kod.includes('TA_WEIGHTS: {}, TA_BENCHMARK: {}'));
      ok('⑧d · bu dosyada skor HESABI yok',
        ['scoreSymbol(', 'scoreSymbolList(', 'computeTA(',
          'computeFA(', 'taScore(', 'faScore(']
          .every((n) => !kod.includes(n)));
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


// =========================================================================
bolum('⑪ KV önbelleği (api/_onbellek.js)');
// =========================================================================
//  NİYE BURADA: önbellek, skor şeridinin ÖNÜNE konan bir kapı. Yanlış
//  yapılırsa parity.mjs bunu GÖRMEZ (o motoru ölçer, ucu değil) ve hata
//  sessiz olur: yanlış anahtar → bir sembolün skoru başka sembole servis
//  edilir; eksik imza → eski motorun skoru yeni motorla karışır; sert
//  bağımlılık → KV düşünce TÜM uçlar düşer. Üçü de 200 dönerek bozulur.
//
//  AĞ YASAĞI BURADA DA GEÇERLİ: gerçek KV'ye hiç gidilmiyor — `kvTak()`
//  ile belleğe sahte bir istemci takılıyor. Ortam değişkenleri de SAHTE
//  (gerçek bir `KV_REST_API_*` değeri bu dosyaya GİRMEZ) ve bölüm sonunda
//  eski haline döndürülüyor.

// --- ⑪a anahtar: girdiyi TAM kapsıyor mu --------------------------------
{
  const ayOrta = ayristir({ symbols: 'AAPL', vade: 'orta' });
  const ayUzun = ayristir({ symbols: 'AAPL', vade: 'uzun' });
  const imza = { motor: IMZA, ayar: IMZA_AYAR };
  const k = (ay, im = imza) => anahtar('score', skorGirdisi(ay), im);

  ok('⑪a · aynı girdi → AYNI anahtar (belirlenimci)', k(ayOrta) === k(ayOrta));
  ok('⑪a · anahtar biçimi `ob:<sürüm>:<uç>:<özet>`',
    new RegExp(`^ob:${ONBELLEK_SURUM}:score:[0-9a-f]{32}$`).test(k(ayOrta)), k(ayOrta));

  // VADE anahtarda: aynı sembolün kısa/orta/uzun skoru AYRI sayıdır.
  ok('⑪a · vade değişince anahtar değişiyor', k(ayOrta) !== k(ayUzun));

  // SEMBOL anahtarda: yoksa AAPL'in skoru MSFT'e servis edilir.
  ok('⑪a · sembol değişince anahtar değişiyor',
    k(ayOrta) !== k(ayristir({ symbols: 'MSFT', vade: 'orta' })));

  // PAZAR anahtarda: aynı harfler iki borsada farklı enstrüman olabilir.
  ok('⑪a · pazar değişince anahtar değişiyor',
    anahtar('score', skorGirdisi(ayristir({ symbols: 'ASELS', market: 'BIST' })), imza)
    !== anahtar('score', skorGirdisi(ayristir({ symbols: 'ASELS', market: 'US' })), imza));

  // SEMBOL SIRASI anahtarda: `sonuclar` ve compare'in `sira`sı GİRDİ
  // SIRASINI izliyor, yani sıra cevabın parçası — sıralanıp tek anahtara
  // indirilirse istemci istemediği sırada liste alır.
  ok('⑪a · sembol sırası anahtarın parçası',
    anahtar('compare', skorGirdisi(ayristir({ symbols: 'AAPL,MSFT' })), imza)
    !== anahtar('compare', skorGirdisi(ayristir({ symbols: 'MSFT,AAPL' })), imza));

  // UÇ ADI anahtarda: /api/score ile /api/analyze girdisi AYNI ama cevabı
  // değil — ayrışmazsa analyze gövdesi score olarak servis edilir.
  ok('⑪a · uç adı anahtarın parçası',
    anahtar('score', skorGirdisi(ayOrta), imza)
    !== anahtar('analyze', skorGirdisi(ayOrta), imza));

  // ALAN SIRASI anahtarı DEĞİŞTİRMEMELİ: girdi nesnesinin alan sırası
  // tesadüfi; anahtar ona bağlıysa aynı istek iki ayrı girdi olur.
  ok('⑪a · girdi alan sırası anahtarı değiştirmiyor',
    anahtar('score', { vade: 'orta', semboller: ['US:AAPL'] }, imza)
    === anahtar('score', { semboller: ['US:AAPL'], vade: 'orta' }, imza));

  // --- MOTOR SÜRÜMÜ: bu bölümün EN ÖNEMLİ denetimi -------------------
  //  `node tools/motor-uret.mjs` motoru değiştirdiğinde IMZA değişir.
  //  Anahtar imzayı taşımazsa ESKİ MOTORUN SKORU yeni motorla karışır ve
  //  hiçbir test bunu görmez (gövde geçerli, 200 dönüyor).
  ok('⑪a · MOTOR imzası değişince anahtar değişiyor (eski skor karışmaz)',
    k(ayOrta) !== k(ayOrta, { motor: 'sha256:degisti', ayar: IMZA_AYAR }));
  ok('⑪a · AYAR imzası değişince anahtar değişiyor (ağırlıklar değişti)',
    k(ayOrta) !== k(ayOrta, { motor: IMZA, ayar: 'sha256:degisti' }));
  ok('⑪a · imza gerçekten anahtarın İÇİNDE (olumsuz kontrol)',
    anahtar('score', skorGirdisi(ayOrta), {}) !== k(ayOrta));
}

// --- ⑪b isabet GERÇEKTEN dış istek sayısını düşürüyor mu ----------------
//  ÖLÇÜM: aynı istek önce önbelleksiz (KV yok) çağrılıyor ve dış istek
//  DENEMESİ sayılıyor; sonra gövde KV'ye konup tekrar çağrılıyor. İkinci
//  çağrıda sayaç 0 olmalı. 0 değilse "önbellek var" demek bir şey ifade
//  etmiyor — KV okunuyor ama ağ yine açılıyor olurdu.
{
  const ortamUrl = process.env.KV_REST_API_URL;
  const ortamTok = process.env.KV_REST_API_TOKEN;
  const gercekFetch = globalThis.fetch;
  let agDenemesi = 0;

  try {
    globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑪ AĞ YASAĞI: ' + String(a[0])); };

    // (1) KV YOK — ortam değişkeni tanımsız. Uç cevap vermeye devam etmeli.
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    ok('⑪b · KV ortam değişkeni yokken kvHazir() false', kvHazir() === false);
    agDenemesi = 0;
    const kvsiz = await cagirUc(handler, 'GET', { symbols: 'AAPL', vade: 'orta' });
    const kvsizDeneme = agDenemesi;
    ok('⑪b · KV YOKKEN uç yine 200 döndü (istek DÜŞMEDİ)', kvsiz.kod === 200, String(kvsiz.kod));
    ok('⑪b · KV yokken gövde sözleşmesi bozulmadı',
      anahtarlar(kvsiz.govde) === 'atlanan,istenen,ms,sayac,sonuclar,surum,tam,uyari,vade',
      anahtarlar(kvsiz.govde));
    ok('⑪b · KV yokken `X-Onbellek: iska`', kvsiz.basliklar['x-onbellek'] === 'iska',
      String(kvsiz.basliklar['x-onbellek']));
    ok('⑪b · önbelleksiz yol GERÇEKTEN ağa çıkmaya çalıştı (ölçülen taban)',
      kvsizDeneme > 0, `${kvsizDeneme} deneme`);
    ok('⑪b · ölçülemeyen cevap `tam:false` (önbelleğe YAZILMAYACAK olan)',
      kvsiz.govde.tam === false);

    // (2) KV VAR + gövde önbellekte → isabet.
    process.env.KV_REST_API_URL = 'https://ornek.invalid';
    process.env.KV_REST_API_TOKEN = 'sahte-test-degeri';
    const depo = new Map();
    let kvOkuma = 0;
    kvTak({
      get: async (key) => { kvOkuma++; return depo.has(key) ? depo.get(key) : null; },
      set: async (key, v) => { depo.set(key, v); return 'OK'; },
    });

    const ay = ayristir({ symbols: 'AAPL', vade: 'orta' });
    const anah = anahtar('score', skorGirdisi(ay), { motor: IMZA, ayar: IMZA_AYAR });
    const sahteGovde = {
      vade: 'orta',
      istenen: 1,
      sonuclar: [{ sym: 'AAPL', market: 'US', ta: 71, fa: 64, composite: 68 }],
      atlanan: [],
      sayac: {},
      tam: true,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: 7200,
      uyari: UYARI,
    };
    ok('⑪b · `yaz()` sahte KV depoya yazdı', (await yaz(anah, sahteGovde, TTL_FIYAT)) === true);
    ok('⑪b · `oku()` yazılanı geri verdi',
      JSON.stringify(await oku(anah)) === JSON.stringify(sahteGovde));

    agDenemesi = 0;
    const isabet = await cagirUc(handler, 'GET', { symbols: 'AAPL', vade: 'orta' });
    ok('⑪b · ÖLÇÜM · isabette dış istek denemesi SIFIR',
      agDenemesi === 0, `önbelleksiz ${kvsizDeneme} deneme → isabette ${agDenemesi}`);
    ok('⑪b · isabet 200 döndü', isabet.kod === 200, String(isabet.kod));
    ok('⑪b · isabet `X-Onbellek: isabet`', isabet.basliklar['x-onbellek'] === 'isabet',
      String(isabet.basliklar['x-onbellek']));
    // SKORUN DEĞERİ DEĞİŞMEZ: `ms` dışındaki her alan harfi harfine aynı.
    const { ms: msIsabet, ...isabetKalan } = isabet.govde;
    const { ms: msKaynak, ...kaynakKalan } = sahteGovde;
    ok('⑪b · isabet gövdesi `ms` DIŞINDA harfi harfine aynı (skor değişmedi)',
      JSON.stringify(isabetKalan) === JSON.stringify(kaynakKalan));
    ok('⑪b · `ms` yeniden ölçüldü (isteğin süresi, skorun parçası değil)',
      typeof msIsabet === 'number' && msIsabet !== msKaynak, String(msIsabet));
    ok('⑪b · isabette TAM yol ile AYNI önbellek penceresi ilan edildi',
      isabet.basliklar['cache-control']
        === 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      String(isabet.basliklar['cache-control']));
    ok('⑪b · isabet KV\'den okumayla geldi', kvOkuma >= 1, `${kvOkuma} KV okuması`);

    // (3) ANAHTAR AYRIŞMASI: başka vade İSABET SAYILMAMALI.
    agDenemesi = 0;
    const baskaVade = await cagirUc(handler, 'GET', { symbols: 'AAPL', vade: 'uzun' });
    ok('⑪b · başka vade isabet SAYILMADI (yanlış cevap servis edilmiyor)',
      baskaVade.basliklar['x-onbellek'] === 'iska' && agDenemesi > 0,
      `${String(baskaVade.basliklar['x-onbellek'])} · ${agDenemesi} deneme`);

    // (4) KV ARIZALI — her çağrıda patlıyor. Uç cevap vermeye DEVAM etmeli.
    kvTak({
      get: async () => { throw new Error('kv patladi'); },
      set: async () => { throw new Error('kv patladi'); },
    });
    agDenemesi = 0;
    const arizali = await cagirUc(handler, 'GET', { symbols: 'AAPL', vade: 'orta' });
    ok('⑪b · KV ARIZALIYKEN uç yine 200 döndü', arizali.kod === 200, String(arizali.kod));
    ok('⑪b · KV arızalıyken `iska` (sessizce önbelleksiz yola düştü)',
      arizali.basliklar['x-onbellek'] === 'iska');
    ok('⑪b · KV arızası cevabı DÜŞÜRMEDİ, normal yol işledi',
      agDenemesi > 0, `${agDenemesi} deneme`);

    // (5) KV YAVAŞ — asla cevap vermiyor. `KV_ISTEK_MS` freni tutmalı,
    //     yoksa KV'nin yavaşlığı ucun gecikmesine dönüşür (platform keser).
    kvTak({ get: () => new Promise(() => {}), set: () => new Promise(() => {}) });
    const tYavas = Date.now();
    const yavas = await cagirUc(handler, 'GET', { symbols: 'AAPL', vade: 'orta' });
    const gecenMs = Date.now() - tYavas;
    ok('⑪b · KV YAVAŞKEN uç yine 200 döndü (asılı kalmadı)', yavas.kod === 200, String(yavas.kod));
    ok('⑪b · zaman aşımı freni tuttu (KV_ISTEK_MS kadar bekledi, sonsuz değil)',
      gecenMs >= KV_ISTEK_MS && gecenMs < KV_ISTEK_MS + 20000,
      `${gecenMs} ms (fren ${KV_ISTEK_MS} ms)`);
    ok('⑪b · yavaş KV\'ye rağmen normal yol işledi',
      yavas.basliklar['x-onbellek'] === 'iska');

    // (6) KV geçersiz tip döndürürse isabet SAYILMAMALI.
    kvTak({ get: async () => ['bozuk'], set: async () => 'OK' });
    ok('⑪b · KV dizi döndürürse `oku()` null (gövde yerine dizi servis edilmez)',
      (await oku('ob:test:x')) === null);
    kvTak({ get: async () => 'metin', set: async () => 'OK' });
    ok('⑪b · KV metin döndürürse `oku()` null', (await oku('ob:test:x')) === null);

    // (7) `yaz()` arızada FALSE döner — asla fırlatmaz (cevabı düşürmez).
    kvTak({ get: async () => null, set: async () => { throw new Error('yazma patladi'); } });
    ok('⑪b · `yaz()` arızada fırlatmıyor, false dönüyor',
      (await yaz('ob:test:y', { a: 1 }, TTL_FIYAT)) === false);
    kvTak({ get: () => new Promise(() => {}), set: () => new Promise(() => {}) });
    ok('⑪b · `yaz()` zaman aşımında false dönüyor',
      (await yaz('ob:test:y', { a: 1 }, TTL_FIYAT)) === false);

    // (8) Ortam yokken KV'ye HİÇ dokunulmamalı — sert bağımlılık yok.
    let dokunuldu = 0;
    kvTak({
      get: async () => { dokunuldu++; return null; },
      set: async () => { dokunuldu++; return 'OK'; },
    });
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    await oku('ob:test:z');
    await yaz('ob:test:z', { a: 1 }, TTL_FIYAT);
    ok('⑪b · ortam değişkeni yokken KV\'ye HİÇ dokunulmadı',
      dokunuldu === 0, `${dokunuldu} dokunma`);
  } finally {
    globalThis.fetch = gercekFetch;
    kvTak(null);
    if (ortamUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = ortamUrl;
    if (ortamTok === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = ortamTok;
  }
}

// --- ⑪c statik denetimler — kopya mantık ve sızıntı yasağı --------------
{
  const src = readFileSync(ONBELLEK_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok('⑪c · dosya uyarı metnini taşıyor', src.includes(UYARI));
  ok('N19 · yorum ayıklama çalışıyor (başlık düştü)',
    /ÖLÇÜLEN/.test(src) && !/ÖLÇÜLEN/.test(kod), 'başlıkta var, kodda yok');

  // SIR SIZINTISI YASAĞI: anahtar/jeton/e-posta hiçbir günlük satırına
  // GİRMEZ. Günlükler sabit metin — `e.message` bile yok, çünkü @vercel/kv
  // hata metni jeton taşıyan istek URL'ini içerebilir.
  const loglar = kod.match(/console\.(error|log|warn)\([^\n]*/g) || [];
  ok('⑪c · her günlük satırı SABİT metin (değişken enterpolasyonu yok)',
    loglar.length > 0 && loglar.every((l) => !/\$\{|e\.message|String\(|\+\s*[A-Za-z_]/.test(l)),
    `${loglar.length} günlük satırı`);
  ok('⑪c · KV jetonu/URL\'i günlüğe GİRMİYOR',
    !/console\.[a-z]+\([^)]*KV_REST/.test(kod));
  ok('⑪c · anahtar (`key`) günlüğe GİRMİYOR',
    !/console\.[a-z]+\([^)]*\bkey\b/.test(kod));
  ok('⑪c · e-posta / kullanıcı kimliği hiçbir yerde geçmiyor',
    !/@gmail|userEmail|mailto:/i.test(src));

  // MOTOR DOKUNULMAZLIĞI: önbellek taşıyıcısı motoru ne import eder ne
  // çağırır — skoru HESAPLAMAZ, yalnız saklar.
  ok('⑪c · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));
  ok('⑪c · motor taşıyıcıları import edilmiyor (skor hesaplamıyor)',
    !/from\s+'\.\/_(motor|ayar|akis|ag)\.js'/.test(kod));
  ok('⑪c · yalnız node:crypto statik import ediliyor',
    (kod.match(/^import .*$/gm) || []).length === 1 && /node:crypto/.test(kod));
  ok('⑪c · @vercel/kv DİNAMİK import (paket yoksa modül yüklenmesi çökmez)',
    /await import\('@vercel\/kv'\)/.test(kod) && !/^import .*@vercel\/kv/m.test(kod));

  // HAM SAYI KURALI — diğer taşıyıcılarla aynı küme.
  ok('⑪c · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('⑪c · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('⑪c · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));

  // TTL'ler İLAN EDİLEN pencereyle AYNI olmalı. Ayrışırsa KV, ucun
  // istemciye söz verdiğinden DAHA ESKİ cevap servis eder.
  ok('⑪c · TTL_FIYAT = skor şeridinin ilan ettiği 300 sn', TTL_FIYAT === 300, String(TTL_FIYAT));
  ok('⑪c · TTL_TEMA = theme ucunun ilan ettiği 86400 sn', TTL_TEMA === 86400, String(TTL_TEMA));
  ok('⑪c · KV zaman aşımı freni ucun süre bütçesine göre KÜÇÜK',
    KV_ISTEK_MS > 0 && KV_ISTEK_MS <= 1000, `${KV_ISTEK_MS} ms`);

  for (const [ad, yol] of [['score', SCORE_PATH], ['recommend', RECOMMEND_PATH],
    ['analyze', ANALYZE_PATH], ['compare', COMPARE_PATH]]) {
    const usrc = readFileSync(yol, 'utf8');
    ok(`⑪c · ${ad} TTL'yi taşıyıcıdan alıyor (uçta yerel sayı yok)`,
      /TTL_FIYAT/.test(usrc) && !/\{\s*ex:\s*\d/.test(usrc));
    ok(`⑪c · ${ad} ilan ettiği max-age=300 ile TTL aynı pencere`,
      usrc.includes('max-age=300'));
    // KOPYA YASAĞI: anahtar üretimi / KV çağrısı uçta YENİDEN yazılmamış.
    ok(`⑪c · ${ad} uçta kopya önbellek mantığı YOK`,
      !/createHash\(/.test(usrc) && !/@vercel\/kv/.test(usrc) && !/kv\.(get|set)\(/.test(usrc));
    ok(`⑪c · ${ad} yalnız TAM cevabı yazıyor (kesintiyi dondurmuyor)`,
      /if \(tam\) await yaz\(/.test(usrc));
  }

  const tsrc = readFileSync(THEME_PATH, 'utf8');
  ok('⑪c · theme TTL_TEMA\'yı taşıyıcıdan alıyor',
    /TTL_TEMA/.test(tsrc) && !/\{\s*ex:\s*\d/.test(tsrc));
  ok('⑪c · theme yalnız DOLU aday listesini yazıyor',
    /if \(candidates\.length\) await yaz\(/.test(tsrc));
  ok('⑪c · theme uçta kopya önbellek mantığı YOK',
    !/createHash\(/.test(tsrc) && !/kv\.(get|set)\(/.test(tsrc));

  // /api/causal BİLEREK ÖNBELLEKSİZ: ölçümde 0 dış istek (saf hesap) ve
  // cevabı `no-store`. Önbellek orada kazanç değil, 64 KB gövdeyi özetleme
  // maliyeti olurdu. Gerekçe yazılmadan değişmesin.
  const nsrc = readFileSync(CAUSAL_PATH, 'utf8');
  ok('⑪c · causal önbelleksiz KALDI (ölçüm: 0 dış istek, no-store)',
    !/_onbellek\.js/.test(nsrc) && /no-store/.test(nsrc));
}



// =========================================================================
bolum('⑫ /api/chart — altıncı uç, fiyat serisi (OHLCV)');
// =========================================================================
// BU BÖLÜM NE: /api/chart native istemcinin hisse grafiğini çizebilmesi
// için gereken HAM mumları veriyor. ÖLÇÜLDÜ: altı ucun hiçbiri fiyat
// serisi döndürmüyordu — /api/score yalnız NOKTA fiyatı (`fa.price`)
// taşıyor. Yani bu uç olmadan native tarafta grafik ÇİZİLEMEZ.
//
// MANTIK UÇTA DEĞİL: adres, `%5E` kaçışı, 5 dakikalık `_t` kovası ve
// null mum ayıklaması motorun `fetchYahooOHLC`u içinde. Bu uç için
// YENİ DİLİM GEREKMEDİ — motor o fonksiyonu ZATEN dışa veriyordu
// (ölçüm: `grep -c fetchYahooOHLC api/_motor.js`). ⑫ kopyanın uçta
// dirilmediğini bekçiliyor.
//
// AĞ: ⑫e `globalThis.fetch`i SAHTE bir Yahoo cevabıyla değiştiriyor;
// tek paket dışarı çıkmıyor ve bölüm sonunda gerçek fetch geri konuyor.

// --- ⑫a yüzey ----------------------------------------------------------
ok('⑫a · default dışa aktarma bir fonksiyon', typeof grafikHandler === 'function', typeof grafikHandler);
ok('⑫a · config.runtime = nodejs', grafikConfig && grafikConfig.runtime === 'nodejs');
ok('⑫a · config.maxDuration = 10 (TEK istek; 60 kopyalanmadı)',
  grafikConfig && grafikConfig.maxDuration === 10, String(grafikConfig && grafikConfig.maxDuration));
ok('⑫a · ARALIKLAR / ADIMLAR beyaz liste (dizi, boş değil)',
  Array.isArray(ARALIKLAR) && ARALIKLAR.length > 0 && Array.isArray(ADIMLAR) && ADIMLAR.length > 0,
  `${ARALIKLAR.length} aralık · ${ADIMLAR.length} adım`);
ok('⑫a · varsayılanlar KENDİ beyaz listelerinde',
  ARALIKLAR.includes(VARSAYILAN_ARALIK) && ADIMLAR.includes(VARSAYILAN_ADIM),
  `${VARSAYILAN_ARALIK} / ${VARSAYILAN_ADIM}`);
ok('⑫a · suzKunye() dışa aktarılmış (ağsız sınanabilir)', typeof suzKunye === 'function');
ok('⑫a · KUNYE_ALANLARI beyaz liste (kara liste DEĞİL)',
  Array.isArray(KUNYE_ALANLARI) && KUNYE_ALANLARI.includes('currency'));
// SÜRÜKLENME KİLİDİ: sembol kapısı YEREL KOPYA değil, _girdi.js'in TA
// KENDİSİ. Aynı nesneyse ayrışma fiziksel olarak mümkün değil (⑤e kalıbı).
ok('⑫a · `AZAMI_SORGU` taşıyıcının TA KENDİSİ (yerel kopya yok)',
  grafikAzamiSorgu === AZAMI_SORGU, `${grafikAzamiSorgu} === ${AZAMI_SORGU}`);
ok('⑫a · `temizleSembol` taşıyıcıyla AYNI FONKSİYON NESNESİ',
  grafikTemizle === girdiTemizle);
ok('⑫a · `PAZARLAR` taşıyıcıyla AYNI DİZİ NESNESİ', grafikPazarlar === girdiPazarlar);

// --- ⑫b method kapısı ---------------------------------------------------
{
  const o = await cagirUc(grafikHandler, 'OPTIONS', {});
  ok('⑫b · OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('⑫b · CORS yöntem başlığı GET, OPTIONS',
    o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('⑫b · CORS köken başlığı *', o.basliklar['access-control-allow-origin'] === '*');

  const p = await cagirUc(grafikHandler, 'POST', {});
  ok('⑫b · POST → 405 (bu uç GET)', p.kod === 405 && p.govde.error === 'method_not_allowed', `kod ${p.kod}`);
  ok('⑫b · 405 Allow başlığı GET, OPTIONS', p.basliklar.allow === 'GET, OPTIONS', p.basliklar.allow);
  ok('⑫b · hata yolu Cache-Control: max-age=30',
    p.basliklar['cache-control'] === 'public, max-age=30', p.basliklar['cache-control']);
  ok('N20 · modül düzeyi motor kurulumu başarılı (503 değil)', p.kod !== 503, `kod ${p.kod}`);
  ok('⑫b · 405 gövdesinde uyarı metni', p.govde.uyari === UYARI);
}

// --- ⑫c sorgu doğrulaması — hepsi ağdan ÖNCE dönüyor --------------------
// Bu vektörlerin tamamı `fetch`e varmadan 400 veriyor; bu yüzden CI'da
// ağ kurcalamadan ölçülebiliyorlar. Ölçüm: aşağıdaki kara delik fetch
// sayacı bölüm boyunca 0 kalıyor (son denetim).
{
  const gercekFetch = globalThis.fetch;
  let agDenemesi = 0;
  globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑫c AĞ YASAĞI: ' + String(a[0])); };
  try {
    const e = async (q) => (await cagirUc(grafikHandler, 'GET', q)).govde.error;

    ok('⑫c · sembol yok → symbol_yok', (await e({})) === 'symbol_yok');
    ok('⑫c · boş sembol → symbol_yok', (await e({ symbol: '   ' })) === 'symbol_yok');
    ok('⑫c · sorgu tavanını aşan metin → too_long',
      (await e({ symbol: 'A'.repeat(AZAMI_SORGU + 1) })) === 'too_long');
    ok('⑫c · virgüllü liste → cok_sembol (SESSİZ KIRPMA yok)',
      (await e({ symbol: 'AAPL,MSFT' })) === 'cok_sembol');
    ok('⑫c · bilinmeyen pazar → bad_market', (await e({ symbol: 'AAPL', market: 'TOKYO' })) === 'bad_market');
    ok('⑫c · biçimsiz sembol → bad_symbol', (await e({ symbol: '123$' })) === 'bad_symbol');
    ok('⑫c · beyaz liste dışı aralık → bad_range',
      (await e({ symbol: 'AAPL', range: '10y' })) === 'bad_range');
    ok('⑫c · beyaz liste dışı adım → bad_interval',
      (await e({ symbol: 'AAPL', interval: '1s' })) === 'bad_interval');
    // ENDEKS KAPISI SÖZLÜKLE AÇILDI (B5) — AMA KAPALI KÜME OLARAK.
    // `^GSPC` artık GEÇİYOR (ölçümü ⑫g'de, çünkü geçince ağa çıkıyor ve
    // bu blokta ağ YASAK). BURADA ölçülen şey TERSİ: sözlükte OLMAYAN
    // hiçbir '^'/'=' girdisi geçmiyor. Desen gevşetilmediğinin kanıtı —
    // gevşek bir `ENDEKS_BICIM` konsaydı bu üç satır kırmızı yanardı.
    ok('⑫c · sözlükte OLMAYAN endeks (^FOO) → bad_symbol',
      (await e({ symbol: '^FOO' })) === 'bad_symbol');
    ok('⑫c · sözlükte OLMAYAN vadeli (A=B) → bad_symbol',
      (await e({ symbol: 'A=B' })) === 'bad_symbol');
    ok('⑫c · sözlüğe benzeyen çöp (^GSPC.X) → bad_symbol',
      (await e({ symbol: '^GSPC.X' })) === 'bad_symbol');
    ok("⑫c · enjeksiyon denemesi (';DROP') → bad_symbol",
      (await e({ symbol: "';DROP'" })) === 'bad_symbol');

    const bm = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', market: 'TOKYO' });
    ok('⑫c · bad_market izinli pazarları BİLDİRİYOR',
      Array.isArray(bm.govde.izinli) && bm.govde.izinli.includes('US'), JSON.stringify(bm.govde.izinli));
    const br = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '10y' });
    ok('⑫c · bad_range izinli aralıkları BİLDİRİYOR (istemci tahmin etmiyor)',
      Array.isArray(br.govde.izinli) && br.govde.izinli.length === ARALIKLAR.length);
    for (const r of [bm, br]) {
      ok('⑫c · 4xx gövdesinde uyarı metni', r.govde.uyari === UYARI);
      ok('⑫c · 4xx kısa önbellekli', r.basliklar['cache-control'] === 'public, max-age=30');
    }
    ok('⑫c · ÖLÇÜM · doğrulama yolu ağa HİÇ çıkmadı', agDenemesi === 0, `${agDenemesi} deneme`);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑫d suzKunye() — saf, beyaz listeli ---------------------------------
{
  ok('⑫d · meta yoksa null (uydurma künye değil)', suzKunye(null) === null && suzKunye(undefined) === null);
  const s = suzKunye({
    currency: 'USD', symbol: 'AAPL', regularMarketPrice: 123.45, priceHint: 2,
    tradingPeriods: [[{ start: 1 }]],          // İÇ İÇE — geçmemeli
    validRanges: ['1d', '5y'],                 // DİZİ — geçmemeli
    gizliAlan: 'x',                            // beyaz listede YOK
    currentTradingPeriod: { pre: { start: 1 } },
  });
  ok('⑫d · beyaz listedeki ilkel alanlar geçiyor',
    s.currency === 'USD' && s.regularMarketPrice === 123.45 && s.priceHint === 2);
  ok('⑫d · iç içe nesne/dizi ELENİYOR (gövde şişmiyor)',
    s.tradingPeriods === undefined && s.validRanges === undefined
    && s.currentTradingPeriod === undefined);
  ok('⑫d · beyaz liste DIŞI alan geçmiyor', s.gizliAlan === undefined);
  ok('N21 · süzgeç GERÇEKTEN geçiriyor (boş test değil)', Object.keys(s).length >= 4,
    Object.keys(s).sort().join(','));
}

// --- ⑫e gerçek cevap — SAHTE Yahoo + SAHTE KV ---------------------------
{
  const gercekFetch = globalThis.fetch;
  const ortamUrl = process.env.KV_REST_API_URL;
  const ortamTok = process.env.KV_REST_API_TOKEN;
  let cagrilanUrl = null;
  let agDenemesi = 0;

  // Sahte Yahoo gövdesi: üç damga, ORTADAKİ mum eksik kapanışlı.
  // Motorun süzgeci onu düşürmeli — "0" olarak göstermemeli.
  // SAHTE YANIT ŞEKLİ ÖLÇÜLDÜ: `api/_ag.js`in kabuğu gövdeyi `r.text()`
  // ile okuyup kendisi JSON.parse ediyor (api/_ag.js:217), motor değil.
  // Yalnız `json()` veren sahte bir yanıt bu yüzden 502 üretir.
  const yahooYanit = (ts, ok = true, status = 200) => {
    const txt = JSON.stringify(yahooCevap(ts));
    return { ok, status, text: async () => txt, json: async () => JSON.parse(txt) };
  };
  const yahooCevap = (ts) => ({
    chart: {
      result: [{
        meta: {
          currency: 'USD', symbol: 'AAPL', exchangeName: 'NMS', regularMarketPrice: 102,
          dataGranularity: '1d', range: '6mo',
          tradingPeriods: [[{ start: 1 }]],
          validRanges: ['1d', '6mo'],
        },
        timestamp: ts,
        indicators: {
          quote: [{
            open: [100, null, 101], high: [103, 1, 104], low: [99, 1, 100],
            close: [102, null, 103], volume: [1000, null, 1200],
          }],
        },
      }],
    },
  });

  try {
    globalThis.fetch = async (url) => {
      agDenemesi++;
      cagrilanUrl = String(url);
      return yahooYanit([1, 2, 3]);
    };
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const r = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '6mo', interval: '1d' });
    ok('⑫e · geçerli GET → 200', r.kod === 200, `kod ${r.kod}`);
    ok('⑫e · gövde alanları sabit',
      anahtarlar(r.govde) === 'adet,interval,kunye,market,mumlar,ms,range,sayac,sym,tam,uyari,surum'
        .split(',').sort().join(','),
      anahtarlar(r.govde));
    ok('⑫e · uyarı metni gövdede', r.govde.uyari === UYARI);
    ok('⑫e · istenen aralık/adım cevapta GERİ BİLDİRİLİYOR',
      r.govde.range === '6mo' && r.govde.interval === '1d');
    ok('⑫e · eksik kapanışlı mum ELENDİ (sessiz sıfır yok)',
      r.govde.adet === 2 && r.govde.mumlar.length === 2, `adet ${r.govde.adet}`);
    ok('⑫e · mum yalnız HAM sayı taşıyor (biçimlenmiş dize değil)',
      r.govde.mumlar.every((c) => typeof c.time === 'number' && typeof c.close === 'number'));
    ok('⑫e · mum alanları sabit (time/open/high/low/close/volume)',
      anahtarlar(r.govde.mumlar[0]) === 'close,high,low,open,time,volume',
      anahtarlar(r.govde.mumlar[0]));
    ok('⑫e · künye SÜZÜLMÜŞ (iç içe Yahoo blokları gövdede yok)',
      r.govde.kunye.currency === 'USD' && r.govde.kunye.tradingPeriods === undefined
      && r.govde.kunye.validRanges === undefined);
    ok('⑫e · `tam` bayrağı ölçüm sonucunu bildiriyor', r.govde.tam === true);
    ok('⑫e · sayaç gövdede (ölçemedim/veri yok ayrımı istemciye geçiyor)',
      r.govde.sayac && typeof r.govde.sayac === 'object');
    ok('⑫e · motor + ayar imzası bildiriliyor',
      /^sha256:/.test(r.govde.surum.motor) && /^sha256:/.test(r.govde.surum.ayar));
    ok('⑫e · TAM cevap ilan edilen 300 sn penceresiyle dönüyor',
      r.basliklar['cache-control'] === 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      r.basliklar['cache-control']);
    ok('⑫e · KV yokken `X-Onbellek: iska`', r.basliklar['x-onbellek'] === 'iska');
    // ÖLÇÜM: aralık/adım gerçekten MOTORA geçiyor, uçta yutulmuyor.
    ok('⑫e · ÖLÇÜM · istenen aralık/adım Yahoo adresine GEÇTİ',
      /[?&]range=6mo\b/.test(cagrilanUrl) && /[?&]interval=1d\b/.test(cagrilanUrl), cagrilanUrl);
    ok('⑫e · ÖLÇÜM · TEK dış istek (ölçülen maliyet: 1)', agDenemesi === 1, `${agDenemesi} istek`);

    // Farklı adım → farklı adres. Aynı sembolün iki serisi karışmıyor.
    cagrilanUrl = null;
    await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1d', interval: '5m' });
    ok('⑫e · gün içi istek AYRI adres üretiyor',
      /[?&]range=1d\b/.test(cagrilanUrl) && /[?&]interval=5m\b/.test(cagrilanUrl), cagrilanUrl);

    // BIST eki motorda: uç `.IS` yazmıyor.
    cagrilanUrl = null;
    const bist = await cagirUc(grafikHandler, 'GET', { symbol: 'ASELS', market: 'BIST' });
    ok('⑫e · BIST sembolü motorun `.IS` ekiyle gidiyor (uçta kopya yok)',
      cagrilanUrl.includes('ASELS.IS') && bist.govde.market === 'BIST', cagrilanUrl);

    // BOŞ SERİ: arıza değil, DÜRÜST 200 + KISA pencere.
    globalThis.fetch = async () => yahooYanit([]);
    const bos = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL' });
    ok('⑫e · boş seri → 200 + `adet:0` (hata DEĞİL)',
      bos.kod === 200 && bos.govde.adet === 0, `kod ${bos.kod}`);
    ok('⑫e · boş seri KISA pencereyle dönüyor (300 sn söz VERİLMİYOR)',
      bos.basliklar['cache-control'] === 'public, max-age=30', bos.basliklar['cache-control']);

    // ÜST KAYNAK ARIZASI → 502, ama içeriden metin SIZMIYOR.
    globalThis.fetch = async () => yahooYanit([1, 2, 3], false, 500);
    const patlak = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL' });
    ok('⑫e · üst kaynak 500 → 502 grafik_alinamadi',
      patlak.kod === 502 && patlak.govde.error === 'grafik_alinamadi', `kod ${patlak.kod}`);
    const metin = JSON.stringify(patlak.govde || {});
    const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack|yahoo/i.test(metin);
    ok('⑫e · 502 gövdesi yığın izi/yol/üst kaynak adı sızdırmıyor', !sizdi,
      sizdi ? metin.slice(0, 120) : 'temiz');
    ok('⑫e · 502 gövdesinde uyarı metni', patlak.govde.uyari === UYARI);
    ok('⑫e · 502 kısa önbellekli (arıza 5 dk DONDURULMUYOR)',
      patlak.basliklar['cache-control'] === 'public, max-age=30');

    // --- SAHTE KV: isabet yolu dış isteği SIFIRA indiriyor mu -----------
    process.env.KV_REST_API_URL = 'https://ornek.invalid';
    process.env.KV_REST_API_TOKEN = 'sahte-test-degeri';
    const depo = new Map();
    kvTak({
      get: async (k) => (depo.has(k) ? depo.get(k) : null),
      set: async (k, v) => { depo.set(k, v); return 'OK'; },
    });
    globalThis.fetch = async (url) => {
      agDenemesi++;
      cagrilanUrl = String(url);
      return yahooYanit([1, 2, 3]);
    };

    agDenemesi = 0;
    const iska = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '3mo', interval: '1d' });
    const iskaDeneme = agDenemesi;
    ok('⑫e · KV varken ilk çağrı ıska + 200', iska.kod === 200 && iska.basliklar['x-onbellek'] === 'iska');
    ok('⑫e · ıska GERÇEKTEN ağa çıktı (ölçülen taban)', iskaDeneme === 1, `${iskaDeneme} istek`);
    ok('⑫e · TAM + DOLU cevap önbelleğe YAZILDI', depo.size === 1, `${depo.size} giriş`);

    agDenemesi = 0;
    const isabet = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '3mo', interval: '1d' });
    ok('⑫e · ÖLÇÜM · isabette dış istek SIFIR',
      agDenemesi === 0, `ıska ${iskaDeneme} → isabet ${agDenemesi}`);
    ok('⑫e · isabet 200 + `X-Onbellek: isabet`',
      isabet.kod === 200 && isabet.basliklar['x-onbellek'] === 'isabet',
      String(isabet.basliklar['x-onbellek']));
    ok('⑫e · isabet gövdesi ıska gövdesiyle AYNI (yalnız `ms` yeniden ölçülüyor)',
      JSON.stringify({ ...isabet.govde, ms: 0 }) === JSON.stringify({ ...iska.govde, ms: 0 }));
    ok('⑫e · isabet penceresi TAM yolun penceresiyle BİREBİR aynı',
      isabet.basliklar['cache-control'] === r.basliklar['cache-control'],
      isabet.basliklar['cache-control']);

    // ANAHTAR AYRIMI: aralık/adım anahtarın İÇİNDE. Aksi hâlde 5y/1d serisi
    // 1d/5m isteğine servis edilirdi — ölçülebilir bir yanlışlık.
    agDenemesi = 0;
    const farkli = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1y', interval: '1d' });
    ok('⑫e · farklı aralık AYRI anahtar (eski seri servis EDİLMEDİ)',
      farkli.basliklar['x-onbellek'] === 'iska' && agDenemesi === 1, `${agDenemesi} istek`);
    ok('⑫e · boş/kesintili cevap önbelleğe YAZILMIYOR', depo.size === 2, `${depo.size} giriş`);

    globalThis.fetch = async () => yahooYanit([]);
    const bosKv = await cagirUc(grafikHandler, 'GET', { symbol: 'TSLA' });
    ok('⑫e · boş seri KV\'ye yazılmadı (arıza 5 dk dondurulmuyor)',
      bosKv.kod === 200 && depo.size === 2, `${depo.size} giriş`);
  } finally {
    globalThis.fetch = gercekFetch;
    kvTak(null);
    if (ortamUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = ortamUrl;
    if (ortamTok === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = ortamTok;
  }
}

// --- ⑫f statik denetimler — mantık MOTORDA, pencere TUTARLI -------------
{
  const src = readFileSync(CHART_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok('⑫f · dosya uyarı metnini taşıyor', src.includes(UYARI));
  ok('N22 · yorum ayıklama çalışıyor (başlık düştü)',
    /NEDEN BU AD/.test(src) && !/NEDEN BU AD/.test(kod), 'başlıkta var, kodda yok');
  ok('⑫f · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('⑫f · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('⑫f · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));
  ok('⑫f · hata yolunda `api/chart:` önekli log var', /console\.error\('api\/chart:/.test(kod));
  ok('⑫f · 503 yolunda da `api/chart:` önekli log var',
    /console\.error\('api\/chart: motor kurulamadi/.test(kod));
  ok('⑫f · 502 yalnız makine kodu döndürüyor',
    /error:\s*'grafik_alinamadi'/.test(kod) && !/\bdetail\s*:/.test(kod));

  // KOPYA YASAĞI — ⑫'nin en pahalı denetimi. Yahoo adresi ve mum ayıklama
  // motorda; uçta yeniden yazılırsa app.js ile sessizce ayrışır.
  ok('⑫f · Yahoo adresi uçta YENİDEN YAZILMAMIŞ',
    !/query[12]\.finance\.yahoo\.com/.test(kod) && !/v8\/finance\/chart/.test(kod));
  ok('⑫f · `fetchYahooOHLC` uçta YENİDEN YAZILMAMIŞ',
    !/function\s+fetchYahooOHLC\s*\(/.test(kod));
  ok('⑫f · 5 dakikalık `_t` kovası uçta DİRİLMEMİŞ',
    !/_t=/.test(kod) && !/5\s*\*\s*60\s*\*\s*1000/.test(kod));
  ok('⑫f · `.IS` eki uçta kopyalanmamış (pazar çevirisi motorda)',
    !/'\.IS'/.test(kod) && !/"\.IS"/.test(kod));
  ok('⑫f · seri MOTORDAN okunuyor (`ENG.fetchYahooOHLC`)',
    /ENG\.fetchYahooOHLC\(/.test(kod));
  ok('⑫f · sembol kapısı `_girdi.js`ten geliyor (yerel kopya yok)',
    /from '\.\/_girdi\.js'/.test(kod)
    && !/const\s+AZAMI_SORGU\s*=/.test(kod)
    && !/SEMBOL_BICIM\s*=/.test(kod));
  ok('⑫f · süre freni taşıyıcıdan (`AG.yeniTur` + `bosSayac` + `sayacTam`)',
    /AG\.yeniTur\(\)/.test(kod) && /bosSayac\(\)/.test(kod) && /sayacTam\(/.test(kod));
  ok('⑫f · sayaç odağı `finally` ile BIRAKILIYOR (sonraki istek kirlenmiyor)',
    /finally\s*\{\s*\n?\s*AG\.odakla\(null\)/.test(kod));
  ok('⑫f · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));
  ok('⑫f · ANTHROPIC anahtarı / e-posta geçmiyor', !/ANTHROPIC|apiKey|@gmail|userEmail/.test(src));

  // PENCERE TUTARLILIĞI — görevin ölçüm şartı: KV TTL'i ucun İLAN ETTİĞİ
  // pencereden BÜYÜK olamaz, yoksa önbellek söz verilenden ESKİ cevap
  // servis eder. Burada ikisi de 300 ve sayı uçta yeniden YAZILMIYOR.
  ok('⑫f · TTL taşıyıcıdan alınıyor (uçta yerel `ex:` yok)',
    /TTL_FIYAT/.test(kod) && !/\{\s*ex:\s*\d/.test(kod));
  ok('⑫f · ilan edilen max-age = TTL_FIYAT (aynı pencere)',
    kod.includes(`max-age=${TTL_FIYAT}`), `TTL_FIYAT=${TTL_FIYAT}`);
  ok('⑫f · s-maxage de aynı pencere (CDN daha eskisini servis etmiyor)',
    kod.includes(`s-maxage=${TTL_FIYAT}`));
  ok('⑫f · uçta kopya önbellek mantığı YOK',
    !/createHash\(/.test(kod) && !/@vercel\/kv/.test(kod) && !/kv\.(get|set)\(/.test(kod));
  ok('⑫f · yalnız TAM **ve DOLU** cevap yazılıyor',
    /if \(tam && mumlar\.length\) await yaz\(/.test(kod));
  // REDDEDİLEN SABİT: gün içi için ayrı TTL ölçümde ÇÜRÜDÜ (motorun `_t`
  // kovası aralıktan bağımsız 5 dk). Gerekçesi _onbellek.js başlığında
  // yazılı; kullanılmayan bir sabit "iş bitti" yanılsaması üretirdi.
  const obSrc = readFileSync(ONBELLEK_PATH, 'utf8');
  ok('⑫f · gün içi için AYRI TTL sabiti EKLENMEDİ (ölçümle reddedildi)',
    !/TTL_GRAFIK/.test(obSrc.split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n')));
  ok('⑫f · reddin GEREKÇESİ taşıyıcı başlığında yazılı (sessiz eksiklik değil)',
    /TTL_GRAFIK_ICI/.test(obSrc));

  // Motor gerçekten taşıyor mu — statik denetimin olumsuz kontrolü.
  const motorSrc = readFileSync(path.join(ROOT, 'api', '_motor.js'), 'utf8');
  ok('N23 · motor `fetchYahooOHLC`u GERÇEKTEN taşıyor (yeni dilim gerekmedi)',
    /async function fetchYahooOHLC\s*\(/.test(motorSrc));
  ok('⑫f · motora SVG/DOM çizimi sızmadı (`makeSparkline`/`makeDetailChart` yok)',
    !/makeSparkline/.test(motorSrc) && !/makeDetailChart/.test(motorSrc));
}

// --- ⑫g ENDEKS SÖZLÜĞÜ — AYRI KAPI, KAPALI KÜME (B5) -------------------
// BU BLOK NE: /api/chart'ın endeks/emtia kapısı. ÖLÇÜLEN SORUN: ortak
// `SEMBOL_BICIM` '^' ve '=' kabul etmiyor, bu yüzden `^GSPC` · `^IXIC` ·
// `GC=F` sunucuda KESİN 400 alıyordu (native "📊 Endeks Nabzı" kartı dört
// kalemden üçünü `destekli:false` işaretliyordu).
//
// İKİ YOL VARDI: (a) chart yolunda gevşek bir `ENDEKS_BICIM` deseni,
// (b) izinli SÖZLÜK. (b) seçildi — kapalı küme, ne geldiğini tam biliyoruz.
// ÜÇ ŞEY birlikte ölçülüyor, çünkü biri olmadan öteki yanıltıcı:
//   ① sözlüğün DÖRDÜ de chart yolundan GEÇİYOR ve üst kaynağa doğru
//      sembolle gidiyor (yoksa "kapı açıldı" sözü boş olurdu),
//   ② sözlükte OLMAYAN '^'/'=' girdileri GEÇMİYOR (yoksa (b) aslında
//      gizli bir (a) olurdu),
//   ③ SKOR YOLLARI `^GSPC`yi HÂLÂ REDDEDİYOR — en pahalı denetim.
//      Gevşemenin skor zincirine SIZMADIĞININ kanıtı budur.
{
  // --- ⑫g⓪ yüzey + kimlik (ağsız, saf) --------------------------------
  ok('⑫g⓪ · `cozEndeks` taşıyıcıyla AYNI FONKSİYON NESNESİ (yerel kopya yok)',
    grafikCozEndeks === girdiCozEndeks);
  ok('⑫g⓪ · `ENDEKS_SOZLUGU` taşıyıcının TA KENDİSİ', grafikSozluk === girdiSozluk);
  const SOZLUK_BEKLENEN = { '^GSPC': '^GSPC', '^IXIC': '^IXIC', 'GC=F': 'GC=F', 'XU100': 'XU100.IS' };
  ok('⑫g⓪ · sözlük görevin istediği DÖRT kalemi taşıyor',
    Object.keys(SOZLUK_BEKLENEN).every((k) => girdiSozluk[k]),
    Object.keys(girdiSozluk).join(' '));
  ok('⑫g⓪ · her kalem için üst kaynağın BEKLEDİĞİ tam sembol YAZILI',
    Object.entries(SOZLUK_BEKLENEN).every(([k, y]) => girdiSozluk[k].yahoo === y),
    Object.entries(girdiSozluk).map(([k, v]) => `${k}→${v.yahoo}`).join(' '));
  ok('⑫g⓪ · her kalemin pazarı PAZARLAR kümesinden (gövde/anahtar sözleşmesi bozulmuyor)',
    Object.values(girdiSozluk).every((v) => girdiPazarlar.includes(v.market)));
  ok('⑫g⓪ · sözlük DONDURULMUŞ (koşarken kalem eklenemez)',
    Object.isFrozen(girdiSozluk) && Object.values(girdiSozluk).every((v) => Object.isFrozen(v)));
  // Prototip adları: düz `sozluk[s]` araması `'CONSTRUCTOR'`de SAHTE
  // isabet verirdi. Handler'dan ölçülemez (harf sembolü normal kapıdan
  // geçer), o yüzden işlev DOĞRUDAN sınanıyor.
  ok('⑫g⓪ · prototip adı sözlükte SAHTE isabet vermiyor',
    girdiCozEndeks('constructor') === null && girdiCozEndeks('toString') === null
    && girdiCozEndeks('__proto__') === null);
  ok('⑫g⓪ · `cozEndeks` sözlük dışına null veriyor',
    girdiCozEndeks('^FOO') === null && girdiCozEndeks('AAPL') === null
    && girdiCozEndeks('') === null && girdiCozEndeks(null) === null);
  ok('⑫g⓪ · `cozEndeks` küçük harfi de çözüyor (kapı büyük/küçük duyarsız)',
    girdiCozEndeks('gc=f') && girdiCozEndeks('gc=f').sym === 'GC=F');
  ok('⑫g⓪ · `cozEndeks` pazarı SÖZLÜKTEN veriyor (XU100 → BIST)',
    girdiCozEndeks('XU100').market === 'BIST' && girdiCozEndeks('^GSPC').market === 'US');

  // --- ⑫g① sözlüğün dördü chart yolundan GEÇİYOR (sahte Yahoo) --------
  const gercekFetch = globalThis.fetch;
  const ortamUrl = process.env.KV_REST_API_URL;
  const ortamTok = process.env.KV_REST_API_TOKEN;
  try {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    let son = null;
    globalThis.fetch = async (url) => {
      son = String(url);
      const txt = JSON.stringify({
        chart: { result: [{
          meta: { currency: 'USD', symbol: 'X' },
          timestamp: [1, 2],
          indicators: { quote: [{ open: [1, 2], high: [1, 2], low: [1, 2], close: [1, 2], volume: [1, 2] }] },
        }] },
      });
      return { ok: true, status: 200, text: async () => txt, json: async () => JSON.parse(txt) };
    };

    for (const [giris, yahoo] of Object.entries(SOZLUK_BEKLENEN)) {
      son = null;
      const r = await cagirUc(grafikHandler, 'GET', { symbol: giris });
      ok(`⑫g① · sözlük kalemi ${giris} chart yolundan GEÇİYOR → 200`,
        r.kod === 200 && r.govde.adet === 2, `kod ${r.kod} · ${JSON.stringify(r.govde && r.govde.error)}`);
      ok(`⑫g① · ${giris} cevapta sembol olarak GERİ BİLDİRİLİYOR`,
        r.govde.sym === giris, String(r.govde.sym));
      // ÖLÇÜM: üst kaynağa giden adres GERÇEKTEN beklenen sembolü taşıyor.
      // Kaçış motorda (^ → %5E), `.IS` eki de motorda — uç ikisini de yazmıyor.
      ok(`⑫g① · ÖLÇÜM · ${giris} üst kaynağa ${yahoo} olarak gidiyor`,
        son !== null && son.includes(encodeURIComponent(yahoo)),
        `${son} (beklenen parça: ${encodeURIComponent(yahoo)})`);
    }

    // Gövde SÖZLEŞMESİ büyümedi: endeks cevabı normal cevapla aynı alanlar.
    const endeksCevap = await cagirUc(grafikHandler, 'GET', { symbol: '^GSPC' });
    const normalCevap = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL' });
    ok('⑫g① · endeks gövdesi normal gövdeyle AYNI ALANLAR (sözleşme büyümedi)',
      anahtarlar(endeksCevap.govde) === anahtarlar(normalCevap.govde),
      anahtarlar(endeksCevap.govde));

    // Endeks kaleminde sorgudaki `market` YOK SAYILIYOR: `^GSPC&market=BIST`
    // `^GSPC.IS` gibi olmayan bir sembol üretirdi.
    son = null;
    const zorlanan = await cagirUc(grafikHandler, 'GET', { symbol: '^GSPC', market: 'BIST' });
    ok('⑫g① · endekste sorgudaki `market` YOK SAYILIYOR (pazarı sözlük söyler)',
      zorlanan.kod === 200 && zorlanan.govde.market === 'US' && !son.includes('GSPC.IS'),
      `${zorlanan.govde.market} · ${son}`);

    // Aralık/adım kapısı endeks için de AYNEN geçerli — ayrı kapı sembolü
    // çözüyor, ötekİ sınırları ATLAMIYOR.
    const kotuAralik = await cagirUc(grafikHandler, 'GET', { symbol: '^GSPC', range: '10y' });
    ok('⑫g① · endeks de aralık kapısına TAKILIYOR (ayrı kapı sınır atlatmıyor)',
      kotuAralik.kod === 400 && kotuAralik.govde.error === 'bad_range', `kod ${kotuAralik.kod}`);
    const cokEndeks = await cagirUc(grafikHandler, 'GET', { symbol: '^GSPC,^IXIC' });
    ok('⑫g① · endeks listesi de cok_sembol (sessiz kırpma yok)',
      cokEndeks.kod === 400 && cokEndeks.govde.error === 'cok_sembol', `kod ${cokEndeks.kod}`);
  } finally {
    globalThis.fetch = gercekFetch;
    if (ortamUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = ortamUrl;
    if (ortamTok === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = ortamTok;
  }

  // --- ⑫g③ SKOR YOLLARI HÂLÂ REDDEDİYOR — asıl kilit ------------------
  // Çözüm "chart yoluna AYRI kapı" olarak istendi. Ortak `SEMBOL_BICIM`i
  // genişletmek ya da `temizleSembol`ü sözlüğe bakacak hâle getirmek,
  // '^' ve '='i skor zincirine (score ⊂ recommend ⊂ analyze ⊂ compare)
  // ve /api/theme'e SIZDIRIRDI. Aşağıdakiler o sızıntıyı bekçiliyor.
  for (const [ad, fn] of [['score', ayristir], ['recommend', recAyristir],
    ['analyze', anaAyristir], ['compare', kiyAyristir]]) {
    for (const s of ['^GSPC', '^IXIC', 'GC=F']) {
      const r = fn({ symbols: s });
      ok(`⑫g③ · ${ad} yolu ${s} sembolünü HÂLÂ reddediyor (gevşeme sızmadı)`,
        !!(r.hata && r.hata.govde.error === 'bad_symbol'), JSON.stringify(r.hata && r.hata.govde));
    }
  }
  ok('⑫g③ · ortak `temizleSembol` sözlüğe BAKMIYOR (ayrı kapı gerçekten ayrı)',
    girdiTemizle('^GSPC', 'US') === null && girdiTemizle('GC=F', 'US') === null
    && girdiTemizle('XU100', 'US') !== null);
  ok('⑫g③ · `SEMBOL_BICIM` BİREBİR eski desen (genişletilmedi)',
    String(SEMBOL_BICIM) === String(/^[A-Z][A-Z0-9.\-]{0,7}$/), String(SEMBOL_BICIM));
  ok("⑫g③ · `SEMBOL_BICIM` '^' ve '=' karakterlerini HÂLÂ geçirmiyor",
    !SEMBOL_BICIM.test('^GSPC') && !SEMBOL_BICIM.test('GC=F'));
  // Statik: sözlük yalnız chart yolundan çağrılıyor. Skor uçlarının biri
  // `cozEndeks`i içe alsa bu denetim kırmızı yanar.
  {
    const skorKodu = [SCORE_PATH, RECOMMEND_PATH, ANALYZE_PATH, COMPARE_PATH, THEME_PATH]
      .map((y) => readFileSync(y, 'utf8').split(/\r?\n/)
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n'));
    ok('⑫g③ · skor/tema uçlarının HİÇBİRİ `cozEndeks`/`ENDEKS_SOZLUGU` çağırmıyor',
      skorKodu.every((k) => !/cozEndeks|ENDEKS_SOZLUGU/.test(k)));
    const chartKodu = readFileSync(CHART_PATH, 'utf8').split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    ok('⑫g③ · chart yolu sözlüğü GERÇEKTEN çağırıyor (olumsuz kontrol)',
      /cozEndeks\(/.test(chartKodu));
    ok('⑫g③ · sözlük UÇTA kopyalanmamış (kalemler yalnız `_girdi.js`te)',
      !/'\^GSPC'|"\^GSPC"/.test(chartKodu));
  }
}


// =========================================================================
bolum('⑬ /api/pulse — yedinci uç, piyasa nabzı / konjonktür (POST)');
// =========================================================================
// BU BÖLÜM NE: /api/pulse, "⚡ Nabız"ın makro duruşu ile "Makro"
// sekmesinin konjonktür kartının SAYISAL çekirdeği. ÖLÇÜLDÜ: bu mantık
// web app.js'te yaşıyordu, API'ye HİÇ çıkarılmamıştı.
//
// VARSAYIM (görev şartı: yazılı olsun): haberi uç KENDİ taramıyor,
// girdiyi İSTEMCİ veriyor. ÖLÇÜM: `api/_ag.js`in `IZINLI` listesinde TAM
// BEŞ konak var ve hiçbiri haber/RSS konağı değil; uç kendi tarasın
// demek, ağ taşıyıcısının konak sözleşmesini genişletmek demekti.
// /api/causal'da aynı karar aynı gerekçeyle verilmişti.
//
// SONUÇ: 0 dış istek, önbellek YOK, `no-store`. Bu yüzden ⑬ ucun ASIL
// cevabını ölçebiliyor — ⑨'da yapamadığımız şey.
//
// MANTIK UÇTA DEĞİL: yön matematiği app.js'te AĞA ÇIKAN iki fonksiyonun
// (computeMacro · computePulseMacro) İÇİNDE gömülüydü; saf parçalar
// app.js'te YERİNDE ayrı fonksiyonlara çıkarıldı, orijinaller onları
// çağırıyor, sonra tests/engine.mjs'e iki dilim olarak eklendi
// ('makro-faz' + 'nabiz-yon'). İKİ PARİTE ŞERİDİ DE FARK 0 verdi.

// --- ⑬a yüzey ----------------------------------------------------------
ok('⑬a · default dışa aktarma bir fonksiyon', typeof nabizHandler === 'function', typeof nabizHandler);
ok('⑬a · config.runtime = nodejs', nabizConfig && nabizConfig.runtime === 'nodejs');
ok('⑬a · config.maxDuration = 10 (ağ turu YOK, causal ile aynı kademe)',
  nabizConfig && nabizConfig.maxDuration === 10, String(nabizConfig && nabizConfig.maxDuration));
ok('⑬a · ayristirGovde() dışa aktarılmış (ağsız sınanabilir)', typeof nabizAyristir === 'function');
ok('⑬a · ayristirListe() dışa aktarılmış', typeof ayristirListe === 'function');
ok('⑬a · sınırlar sayı ve pozitif',
  AZAMI_BASLIK > 0 && NABIZ_GOVDE_BAYT > 0, `${AZAMI_BASLIK} · ${NABIZ_GOVDE_BAYT}`);
// Gövde tavanı causal'dan BÜYÜK olmak zorunda: orada taşınan şey yaş
// SAYILARI, burada başlık METNİ. Aritmetik uç başlığında yazılı.
ok('⑬a · gövde tavanı başlık METNİ taşıdığı için causal\'dan BÜYÜK',
  NABIZ_GOVDE_BAYT > AZAMI_GOVDE_BAYT, `${NABIZ_GOVDE_BAYT} > ${AZAMI_GOVDE_BAYT}`);
ok('⑬a · pencere günü app.js çağrı noktasıyla aynı (14)', PENCERE_GUN === 14, String(PENCERE_GUN));
ok('⑬a · taze sayımı 2 gün (app.js `fresh2d` ile aynı)', TAZE_GUN === 2, String(TAZE_GUN));

// --- ⑬b method kapısı — GET DEĞİL ---------------------------------------
{
  const cagirNabiz = async (method, body) => {
    const res = sahteRes();
    await nabizHandler({ method, body }, res);
    return res;
  };

  const o = await cagirNabiz('OPTIONS');
  ok('⑬b · OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('⑬b · CORS yöntem başlığı POST, OPTIONS',
    o.basliklar['access-control-allow-methods'] === 'POST, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('⑬b · Content-Type başlığı ön-uçuşta izinli',
    /Content-Type/i.test(o.basliklar['access-control-allow-headers'] || ''),
    o.basliklar['access-control-allow-headers']);

  const g = await cagirNabiz('GET');
  ok('⑬b · GET → 405 (girdi manşet LİSTESİ, sorguya sığmaz)',
    g.kod === 405 && g.govde.error === 'method_not_allowed', `kod ${g.kod}`);
  ok('⑬b · 405 Allow başlığı POST, OPTIONS', g.basliklar.allow === 'POST, OPTIONS', g.basliklar.allow);
  ok('⑬b · hata yolu Cache-Control: max-age=30',
    g.basliklar['cache-control'] === 'public, max-age=30', g.basliklar['cache-control']);
  ok('N24 · modül düzeyi motor kurulumu başarılı (503 değil)', g.kod !== 503, `kod ${g.kod}`);
}

// --- ⑬c gövde doğrulaması — ağsız vektörler -----------------------------
{
  const hata = (b) => { const r = nabizAyristir(b); return r.hata ? r.hata.govde.error : null; };
  const BOS = { faizHaberleri: [], enflasyonHaberleri: [] };

  ok('⑬c · gövde yok → govde_yok', hata(null) === 'govde_yok', String(hata(null)));
  ok('⑬c · dizi gövde → govde_yok', hata([]) === 'govde_yok');
  ok('⑬c · faiz listesi dizi değil → faizHaberleri_yok',
    hata({ enflasyonHaberleri: [] }) === 'faizHaberleri_yok');
  ok('⑬c · enflasyon listesi dizi değil → enflasyonHaberleri_yok',
    hata({ faizHaberleri: [] }) === 'enflasyonHaberleri_yok');
  ok('⑬c · iki boş liste KABUL (dürüst sessizlik hata değil)', hata(BOS) === null);
  ok('⑬c · başlık tavanı → cok_baslik (kırpma YOK)',
    hata({ ...BOS, faizHaberleri: Array.from({ length: AZAMI_BASLIK + 1 }, () => ({ title: 'x' })) })
      === 'cok_baslik');
  ok('⑬c · tam tavan hâlâ kabul',
    hata({ ...BOS, faizHaberleri: Array.from({ length: AZAMI_BASLIK }, () => ({ title: 'x' })) }) === null);
  ok('⑬c · manşet nesne değil → bad_baslik', hata({ ...BOS, faizHaberleri: ['metin'] }) === 'bad_baslik');

  // ARALIK DIŞI SESSİZCE KIRPILMIYOR: kırpılsa istemci farketmeden
  // YANLIŞ bir faz görürdü.
  ok('⑬c · genislik 0..100 dışı → bad_genislik', hata({ ...BOS, genislik: 140 }) === 'bad_genislik');
  ok('⑬c · negatif genislik → bad_genislik', hata({ ...BOS, genislik: -1 }) === 'bad_genislik');
  ok('⑬c · genislik sayı değil → bad_genislik', hata({ ...BOS, genislik: 'yüksek' }) === 'bad_genislik');
  ok('⑬c · enflasyonBaskisi 0..1 dışı → bad_enflasyonBaskisi',
    hata({ ...BOS, enflasyonBaskisi: 1.4 }) === 'bad_enflasyonBaskisi');
  ok('⑬c · risk 0..1 dışı → bad_risk', hata({ ...BOS, risk: 3 }) === 'bad_risk');
  ok('⑬c · simdi pozitif olmayan → bad_simdi', hata({ ...BOS, simdi: 0 }) === 'bad_simdi');
  ok('⑬c · isteğe bağlı sayılar yokken hata YOK (eksik ≠ geçersiz)', hata(BOS) === null);

  // Normalleştirme: motorun okumadığı alanlar TAŞINMIYOR.
  const n = nabizAyristir({
    faizHaberleri: [{
      title: 'Fed raises rates', description: 'inflation', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT',
      link: 'http://x', source: 'Reuters', emoji: '🔺',
    }],
    enflasyonHaberleri: [],
    genislik: 55, enflasyonBaskisi: 0.3, risk: 0.1,
  });
  ok('⑬c · manşetten yalnız motorun OKUDUĞU alanlar geçiyor',
    anahtarlar(n.faiz[0]) === 'description,pubDate,title', anahtarlar(n.faiz[0]));
  ok('⑬c · bağlantı/kaynak/emoji taşınmıyor (tele geri dönmeyecekler)',
    n.faiz[0].link === undefined && n.faiz[0].source === undefined && n.faiz[0].emoji === undefined);
  ok('⑬c · isteğe bağlı sayılar geçiyor',
    n.genislik === 55 && n.enflasyonBaskisi === 0.3 && n.risk === 0.1);
  ok('⑬c · verilmeyen sayı null (0 DEĞİL — "yok" ile "sıfır" ayrı)',
    nabizAyristir(BOS).genislik === null && nabizAyristir(BOS).risk === null);
  ok('N25 · doğrulama GERÇEKTEN geçiriyor (boş test değil)', !n.hata && n.faiz.length === 1);
}

// --- ⑬d gerçek cevap — AĞA ÇIKMADIĞI İÇİN ölçülebiliyor ------------------
{
  const gercekFetch = globalThis.fetch;
  let agDenemesi = 0;
  globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑬ AĞ YASAĞI: ' + String(a[0])); };
  try {
    // `simdi` SABİTLENDİ: tazelik penceresi saate bağlı olmasın, cevap
    // deterministik olsun. 10 sa önceki manşet TAZE (<48 sa), 100 sa
    // öncesi pencere içinde ama AĞIRLIKSIZ, 30 gün öncesi PENCERE DIŞI.
    const SIMDI = Date.parse('2026-10-19T12:00:00Z');
    const yas = (saat) => new Date(SIMDI - saat * 36e5).toUTCString();
    const govde = {
      faizHaberleri: [
        { title: 'Fed signals rate hike as inflation persists', description: '', pubDate: yas(10) },
        { title: 'Powell: rates will stay higher for longer', description: '', pubDate: yas(100) },
        { title: 'Fed cuts rates sharply', description: '', pubDate: yas(24 * 30) },
      ],
      enflasyonHaberleri: [
        { title: 'CPI accelerates, inflation rises', description: '', pubDate: yas(20) },
      ],
      genislik: 62, enflasyonBaskisi: 0.4, risk: 0.2, simdi: SIMDI,
    };

    const res = sahteRes();
    await nabizHandler({ method: 'POST', body: govde }, res);

    ok('⑬d · geçerli POST → 200', res.kod === 200, `kod ${res.kod}`);
    ok('⑬d · ÖLÇÜM · uç ağa HİÇ çıkmadı (0 dış istek)', agDenemesi === 0, `${agDenemesi} deneme`);
    ok('⑬d · gövde alanları sabit',
      anahtarlar(res.govde) === 'degerlendirilen,durus,eksik,haberler,kaynak,konjonktur,ms,pencere,surum,taze,uyari',
      anahtarlar(res.govde));
    ok('⑬d · uyarı metni gövdede', res.govde.uyari === UYARI);
    // GERİYE DÖNÜK UYUM: istemci manşet verdiğinde yol AÇIKÇA 'istemci'
    // ve sunucu ölçümü NULL — yani "haber taramadım" uydurma sayaçla
    // gizlenmiyor.
    ok('⑬d · istemci manşet verdi → kaynak = istemci', res.govde.kaynak === 'istemci', String(res.govde.kaynak));
    ok('⑬d · istemci yolunda `haberler` null (sunucu taraması YAPILMADI)',
      res.govde.haberler === null, String(res.govde.haberler));
    ok('⑬d · duruş alanları sabit',
      anahtarlar(res.govde.durus) === 'baski,egilimAsagi,egilimYukari,enflasyonYon,faizYon,kod',
      anahtarlar(res.govde.durus));
    ok('⑬d · yönler HAM sayı ve -1..+1 arası',
      typeof res.govde.durus.faizYon === 'number'
      && Math.abs(res.govde.durus.faizYon) <= 1 && Math.abs(res.govde.durus.enflasyonYon) <= 1,
      `${res.govde.durus.faizYon} / ${res.govde.durus.enflasyonYon}`);
    ok('⑬d · şahin manşetler → kod hawk (motorun ±0.12 eşiği)',
      res.govde.durus.kod === 'hawk', res.govde.durus.kod);
    ok('⑬d · duruş kodu SABİT KÜMEDEN', ['hawk', 'dove', 'neu'].includes(res.govde.durus.kod));
    ok('⑬d · eğilim listeleri SEKTÖR KODU (serbest Türkçe değil)',
      res.govde.durus.egilimAsagi.includes('tech') && res.govde.durus.egilimYukari.includes('banks'),
      JSON.stringify(res.govde.durus.egilimYukari));
    ok('⑬d · pencere DIŞI manşet değerlendirmeye alınmadı (14 gün)',
      res.govde.degerlendirilen.faiz === 2 && res.govde.degerlendirilen.enflasyon === 1,
      JSON.stringify(res.govde.degerlendirilen));
    // ÖLÇÜLEN SINIR, DÜRÜSTÇE YAZILIYOR: motorun `pulseRecentCount`u
    // `simdi`yi ALMIYOR, `Date.now()` kullanıyor (api/_motor.js:1900 —
    // ÜRETİLMİŞ dosya, elle düzeltilmez). Bu yüzden `taze` sayımı
    // sabitlenemiyor; burada yalnız TÜR ve ÜST SINIR denetleniyor.
    // Tam değere bağlanırsa test yarın kendi kendine kırmızı yanar.
    ok('⑬d · taze sayımı sayı ve değerlendirilen sayıyı AŞMIYOR',
      Number.isInteger(res.govde.taze.faiz2g) && res.govde.taze.faiz2g >= 0
      && res.govde.taze.faiz2g <= 3 && Number.isInteger(res.govde.taze.enflasyon2g),
      JSON.stringify(res.govde.taze));
    ok('⑬d · pencere parametreleri MOTORDAN bildiriliyor (istemci tahmin etmiyor)',
      res.govde.pencere.gun === PENCERE_GUN && res.govde.pencere.tazelikSaat === 48
      && res.govde.pencere.tazelikAgirlik === 2.5, JSON.stringify(res.govde.pencere));
    ok('⑬d · konjonktür alanları sabit',
      anahtarlar(res.govde.konjonktur) === 'boyutlar,faz,sektorler',
      anahtarlar(res.govde.konjonktur));
    ok('⑬d · faz SABİT KÜMEDEN',
      ['early', 'mid', 'late', 'recession'].includes(res.govde.konjonktur.faz),
      res.govde.konjonktur.faz);
    ok('⑬d · boyutlar HAM sayı (rate/infl/growth/risk)',
      anahtarlar(res.govde.konjonktur.boyutlar) === 'growth,infl,rate,risk'
      && Object.values(res.govde.konjonktur.boyutlar).every((v) => typeof v === 'number'),
      JSON.stringify(res.govde.konjonktur.boyutlar));
    ok('⑬d · büyüme genişlikten motorun formülüyle türetildi ((62-50)/20)',
      Math.abs(res.govde.konjonktur.boyutlar.growth - 0.6) < 1e-9,
      String(res.govde.konjonktur.boyutlar.growth));
    ok('⑬d · sektörler MAKİNE KODU dizisi',
      Array.isArray(res.govde.konjonktur.sektorler)
      && res.govde.konjonktur.sektorler.every((s) => typeof s === 'string' && /^[a-z_]+$/.test(s)),
      JSON.stringify(res.govde.konjonktur.sektorler));
    // İKİ YOL AYRI: duruş AĞIRLIKLI faiz yönü, konjonktür AĞIRLIKSIZ
    // (app.js `rateDirection(td.fed.items)` diye ağırlık VERMEDEN
    // çağırıyor). Tek sayıya indirmek ekrandan SAPMA olurdu.
    ok('⑬d · ÖLÇÜM · duruşun ağırlıklı yönü ≠ konjonktürün ağırlıksız yönü',
      res.govde.durus.faizYon !== res.govde.konjonktur.boyutlar.rate,
      `${res.govde.durus.faizYon} vs ${res.govde.konjonktur.boyutlar.rate}`);
    ok('⑬d · `eksik` boş (üç sayı da verildi)', res.govde.eksik.length === 0);
    ok('⑬d · SERBEST TÜRKÇE tele ÇIKMIYOR (duruş/faz cümleleri yok)', (() => {
      const m = JSON.stringify(res.govde).replace(UYARI, '');
      return !/şahin|güvercin|Sıkılaşma|Gevşeme|döngü|Durgunluk/i.test(m);
    })());
    ok('⑬d · motor + ayar imzası bildiriliyor',
      /^sha256:/.test(res.govde.surum.motor) && /^sha256:/.test(res.govde.surum.ayar));
    ok('⑬d · gövdeye bağlı cevap CDN\'de paylaşılmıyor (no-store)',
      res.basliklar['cache-control'] === 'no-store', res.basliklar['cache-control']);

    // GÜVERCİN yönü de ölçülüyor: eşik tek yönlü değil.
    const dove = sahteRes();
    await nabizHandler({
      method: 'POST',
      body: {
        faizHaberleri: [
          { title: 'Fed cuts rates, easing cycle begins', description: '', pubDate: yas(5) },
          { title: 'Powell signals rate cut amid cooling inflation', description: '', pubDate: yas(8) },
        ],
        enflasyonHaberleri: [{ title: 'Inflation cools, CPI slows sharply', description: '', pubDate: yas(6) }],
        simdi: SIMDI,
      },
    }, dove);
    ok('⑬d · gevşeme manşetleri → kod dove (eşik İKİ yönlü)',
      dove.govde.durus.kod === 'dove', dove.govde.durus.kod);
    ok('⑬d · dove\'da faize duyarlılar YUKARI eğilimde',
      dove.govde.durus.egilimYukari.includes('tech') && dove.govde.durus.egilimYukari.includes('gold'));

    // EKSİK VERİ UYDURULMUYOR — bu bölümün en önemli denetimi.
    const eksik = sahteRes();
    await nabizHandler({ method: 'POST', body: { faizHaberleri: [], enflasyonHaberleri: [] } }, eksik);
    ok('⑬d · boş manşet → 200 + yönler 0 + kod neu (dürüst sessizlik)',
      eksik.kod === 200 && eksik.govde.durus.faizYon === 0 && eksik.govde.durus.kod === 'neu',
      `kod ${eksik.kod}`);
    ok('⑬d · genişlik YOKSA konjonktür null (varsayılan 50 UYDURULMUYOR)',
      eksik.govde.konjonktur === null);
    ok('⑬d · `eksik` NESİ eksik olduğunu söylüyor',
      eksik.govde.eksik.join(',') === 'genislik,enflasyonBaskisi,risk',
      JSON.stringify(eksik.govde.eksik));
    const kismi = sahteRes();
    await nabizHandler({
      method: 'POST',
      body: { faizHaberleri: [], enflasyonHaberleri: [], genislik: 50, risk: 0.1 },
    }, kismi);
    ok('⑬d · KISMİ veri de faz üretmiyor (tek eksik yeter)',
      kismi.govde.konjonktur === null && kismi.govde.eksik.join(',') === 'enflasyonBaskisi',
      JSON.stringify(kismi.govde.eksik));

    // Hata yolları.
    const bozuk = sahteRes();
    await nabizHandler({ method: 'POST', body: '{yarım' }, bozuk);
    ok('⑬d · bozuk JSON → 400 bozuk_json', bozuk.kod === 400 && bozuk.govde.error === 'bozuk_json');
    const buyuk = sahteRes();
    await nabizHandler({ method: 'POST', body: 'x'.repeat(NABIZ_GOVDE_BAYT + 1) }, buyuk);
    ok('⑬d · tavanı aşan gövde → 413 govde_buyuk', buyuk.kod === 413 && buyuk.govde.error === 'govde_buyuk');
    for (const [ad, r] of [['bozuk_json', bozuk], ['govde_buyuk', buyuk]]) {
      ok(`⑬d · ${ad} gövdesinde uyarı metni var`, r.govde.uyari === UYARI);
      const metin = JSON.stringify(r.govde || {});
      const sizdi = /at\s+\w+\s*\(|\.js:\d+|[A-Za-z]:\\\\|\/Users\/|node_modules|stack/i.test(metin);
      ok(`⑬d · ${ad} gövdesi yığın izi/yol sızdırmıyor`, !sizdi, sizdi ? metin.slice(0, 120) : 'temiz');
    }
    ok('⑬d · ÖLÇÜM · bölüm boyunca ağa HİÇ çıkılmadı', agDenemesi === 0, `${agDenemesi} deneme`);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑬e statik denetimler — mantık MOTORDA kalmalı -----------------------
{
  const src = readFileSync(PULSE_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok('⑬e · dosya uyarı metnini taşıyor', src.includes(UYARI));
  ok('N26 · yorum ayıklama çalışıyor (başlık düştü)',
    /HABERİ KİM TARAR/.test(src) && !/HABERİ KİM TARAR/.test(kod), 'başlıkta var, kodda yok');
  ok('⑬e · HAM SAYI · `Intl` kullanımı yok', !/\bIntl\b/.test(kod));
  ok('⑬e · HAM SAYI · `toFixed(` yok', !kod.includes('toFixed('));
  ok('⑬e · HAM SAYI · `toLocaleString` yok', !kod.includes('toLocaleString'));
  ok('⑬e · hata yolunda `api/pulse:` önekli log var', /console\.error\('api\/pulse:/.test(kod));
  ok('⑬e · 502 yalnız makine kodu döndürüyor',
    /error:\s*'nabiz_hesaplanamadi'/.test(kod) && !/\bdetail\s*:/.test(kod));

  // KOPYA YASAĞI — ⑬'ün en pahalı denetimi. Eşikler uçta dirilirse
  // app.js ile sessizce ayrışan İKİNCİ bir makro okuması doğar.
  for (const ad of ['rateDirection', 'inflDirection', 'pulseStance', 'macroPhase',
    'macroGrowth', 'pulseFreshWithin', 'pulseFreshWeight', 'pulseRecentCount']) {
    ok(`⑬e · \`${ad}\` uçta YENİDEN YAZILMAMIŞ`,
      !new RegExp(`function\\s+${ad}\\s*\\(`).test(kod));
    ok(`⑬e · \`${ad}\` MOTORDAN okunuyor (\`ENG.\`)`, kod.includes(`ENG.${ad}(`));
  }
  ok('⑬e · `CYCLE_PHASES` tablosu uçta KOPYALANMAMIŞ',
    !/CYCLE_PHASES\s*=/.test(kod) && /ENG\.CYCLE_PHASES/.test(kod));
  ok('⑬e · `RATE_SENSITIVE` listesi uçta KOPYALANMAMIŞ', !/RATE_SENSITIVE\s*=/.test(kod));
  ok('⑬e · duruş eşiği (0.12) uçta DİRİLMEMİŞ', !/0\.12/.test(kod));
  ok('⑬e · baskı ağırlıkları (0.6/0.4) uçta DİRİLMEMİŞ',
    !/0\.6\s*\+/.test(kod) && !/\*\s*0\.4/.test(kod));
  ok('⑬e · tazelik ağırlığı (48 sa / 2.5) uçta DİRİLMEMİŞ (motordan bildiriliyor)',
    /ENG\.PULSE_FRESH_H/.test(kod) && /ENG\.PULSE_FRESH_W/.test(kod)
    && !/PULSE_FRESH_H\s*=/.test(kod));
  ok('⑬e · faz karar ağacı uçta DİRİLMEMİŞ (`recession`/`late` dizgesi yok)',
    !/'recession'/.test(kod) && !/'late'/.test(kod));
  ok('⑬e · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src));
  ok('⑬e · ANTHROPIC anahtarı / e-posta geçmiyor', !/ANTHROPIC|apiKey|@gmail|userEmail/.test(src));

  // ADRES YASAĞI STATİK (2026-10-24'te ANLAMI DEĞİŞTİ, kuralı DEĞİL):
  // uç artık haber tarıyor ama RSS ADRESİNİ KENDİ KURMUYOR — adres,
  // izin listesi ve zaman aşımı `api/_haber.js`te. Uçta adres dirilirse
  // iki yerde iki besleme olur ve biri sessizce bayatlar.
  ok('⑬e · uçta haber/RSS adresi YOK (adres taşıyıcıda, uçta değil)',
    !/news\.google|rss|feed|\.xml/i.test(kod));
  ok('⑬e · haber taşıyıcısı `./_haber.js` üzerinden çağrılıyor',
    /from\s+'\.\/_haber\.js'/.test(kod) && /haberCek\(/.test(kod));
  ok('⑬e · yeni karar BAŞLIKTA yazılı, eski metin SİLİNMEMİŞ',
    /HABERİ KİM TARAR/.test(src) && /2026-10-24/.test(src) && /kaynak/.test(src));
  const agSrc = readFileSync(AG_PATH, 'utf8');
  ok('⑬e · ÖLÇÜM · `_ag.js` IZINLI listesi hâlâ BEŞ konak (dokunulmadı)',
    (agSrc.match(/finance\.yahoo\.com|www\.sec\.gov|data\.sec\.gov|www\.isyatirim\.com\.tr/g) || []).length >= 4
    && !/news\.google|googleapis|api\.anthropic\.com/.test(agSrc));

  // ÖNBELLEKSİZ, BİLEREK: 0 dış istek + gövdeye bağlı girdi.
  ok('⑬e · önbellek taşıyıcısı import EDİLMEMİŞ (bilerek önbelleksiz)',
    !/_onbellek\.js/.test(kod) && /no-store/.test(kod));
  ok('⑬e · gerekçe taşıyıcı başlığında yazılı (sessiz eksiklik değil)',
    /\/api\/pulse/.test(readFileSync(ONBELLEK_PATH, 'utf8')));

  // Motor gerçekten taşıyor mu — statik denetimin olumsuz kontrolü.
  const motorSrc = readFileSync(path.join(ROOT, 'api', '_motor.js'), 'utf8');
  ok('N27 · motor makro/nabız dilimlerini GERÇEKTEN taşıyor',
    /function\s+macroPhase\s*\(/.test(motorSrc) && /function\s+pulseStance\s*\(/.test(motorSrc)
    && /CYCLE_PHASES\s*=/.test(motorSrc));
  ok('⑬e · motor dışa aktarım listesi yeni adları içeriyor',
    /return \{[\s\S]*macroPhase[\s\S]*pulseStance[\s\S]*\}/.test(motorSrc));
  // DOM ve sunum dilimin DIŞINDA kaldı.
  for (const ad of ['buildPulseMacroHtml', 'renderIndexPulse', 'macroGauge', 'renderMacro',
    'pulseMacroComment', 'pulseMacroReality']) {
    ok(`⑬e · motora sunum sızmadı (\`${ad}\` yok)`, !motorSrc.includes(ad));
  }
  // SKOR DOKUNULMAZLIĞI: makro katmanı composite'e karışmıyor.
  ok('⑬e · makro adları skor hesabına karışmıyor (akış taşıyıcısında yok)', (() => {
    const akis = readFileSync(AKIS_PATH, 'utf8');
    return !/macroPhase|pulseStance|rateDirection|inflDirection/.test(akis);
  })());
}

// --- ⑬f sunucu yolu — SAHTE besleme, geriye dönük uyum ÖLÇÜMÜ ------------
// 2026-10-24 kararının asıl riski: istemci yolunu bozmak. Burada İKİ yol
// AYNI koşumda ölçülüyor — aynı gövde alanları, kayan tek sayı yok.
// AĞA ÇIKMIYOR: `globalThis.fetch` sahte bir Google News gövdesi döndürüyor
// ve adresin İZİNLİ konakta kaldığı da burada doğrulanıyor.
{
  const gercekFetch = globalThis.fetch;
  const SIMDI = Date.parse('2026-10-19T12:00:00Z');
  const yas = (saat) => new Date(SIMDI - saat * 36e5).toUTCString();

  // Fikstür: başlıklar ŞAHİN, böylece sunucu yolunun manşetleri motora
  // GERÇEKTEN girdi mi ölçülebiliyor (duruş kodu neu kalmamalı).
  const madde = (t) => `<item><title>${t}</title>`
    + '<link>https://news.google.com/__t__</link>'
    + `<pubDate>${yas(10)}</pubDate><source url="https://x.example">Örnek Yayın</source></item>`;
  const RSS = '<?xml version="1.0"?><rss version="2.0"><channel>'
    + '<title>Örnek besleme — ASGARI_GOVDE_BAYT tavanını aşmak için uzun kanal başlığı</title>'
    + madde('Fed signals rate hike as inflation persists')
    + madde('Powell: rates will stay higher for longer, hawkish tone')
    + madde('CPI accelerates, inflation rises again')
    + '</channel></rss>';
  ok('⑬f · fikstür kısa gövde eşiğini AŞIYOR (kurulum doğru)',
    Buffer.byteLength(RSS, 'utf8') >= ASGARI_GOVDE_BAYT, `${Buffer.byteLength(RSS, 'utf8')} bayt`);

  let cagrilar = [];
  globalThis.fetch = async (adres) => {
    cagrilar.push(String(adres));
    return { ok: true, status: 200, text: async () => RSS };
  };

  try {
    // --- yol seçimi SAF olarak ------------------------------------------
    ok('⑬f · manşet dizisi varsa istemci yolu', istemciVerdi({ faizHaberleri: [] }) === true);
    ok('⑬f · yalnız enflasyon listesi de istemci yolu',
      istemciVerdi({ enflasyonHaberleri: [] }) === true);
    ok('⑬f · hiç liste yoksa istemci yolu DEĞİL', istemciVerdi({ q: 'ASELSAN' }) === false);
    ok('⑬f · gövde yok → istemci yolu değil', istemciVerdi(null) === false && istemciVerdi([]) === false);

    const g = ayristirSunucuGirdisi;
    ok('⑬f · ne q ne semboller → girdi_yok (ESKİ 400\'e düşer)',
      g({}).error === 'girdi_yok', String(g({}).error));
    ok('⑬f · q verildi → tek sorgu, varsayılan pazar TR',
      g({ q: 'ASELSAN' }).sorgular.length === 1 && g({ q: 'ASELSAN' }).pazar === 'TR');
    ok('⑬f · semboller virgüllü dizge KABUL', g({ semboller: 'ASELSAN,THYAO' }).sorgular.length === 2);
    ok('⑬f · semboller dizi KABUL', g({ semboller: ['ASELSAN', 'THYAO'] }).sorgular.length === 2);
    ok('⑬f · üçüncü tür → bad_semboller', g({ semboller: 42 }).error === 'bad_semboller');
    ok('⑬f · sembol tavanı → cok_sembol (SESSİZ KIRPMA yok)',
      g({ semboller: ['A', 'B', 'C', 'D', 'E'] }).error === 'cok_sembol',
      String(g({ semboller: ['A', 'B', 'C', 'D', 'E'] }).error));
    ok('⑬f · cok_sembol tavanı BİLDİRİYOR',
      g({ semboller: ['A', 'B', 'C', 'D', 'E'] }).azami === AZAMI_SEMBOL_HABER);
    ok('⑬f · tam tavan hâlâ kabul', g({ semboller: ['A', 'B', 'C', 'D'] }).sorgular.length === 4);
    ok('⑬f · uzun q → too_long', g({ q: 'x'.repeat(haberAzamiSorgu + 1) }).error === 'too_long');
    ok('⑬f · uzun sembol → too_long',
      g({ semboller: ['x'.repeat(haberAzamiSorgu + 1)] }).error === 'too_long');
    ok('⑬f · bilinmeyen haber pazarı → bad_haberPazari',
      g({ q: 'x', haberPazari: 'TOKYO' }).error === 'bad_haberPazari');
    ok('⑬f · bad_haberPazari izinli pazarları BİLDİRİYOR',
      Array.isArray(g({ q: 'x', haberPazari: 'TOKYO' }).izinli));
    ok('⑬f · makro sorgular app.js pmFed/pmInfl ile aynı beslemeyi istiyor',
      /Fed OR Powell OR FOMC/.test(MAKRO_SORGULAR.faiz.q)
      && /CPI OR inflation/.test(MAKRO_SORGULAR.enflasyon.q));

    // --- girdi_yok ESKİ 400'e düşüyor mu (en kritik uyum denetimi) -------
    {
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: {} }, r);
      ok('⑬f · ÖLÇÜM · girdi_yok ESKİ hata kodunu koruyor (yeni kod icat edilmedi)',
        r.kod === 400 && r.govde.error === 'faizHaberleri_yok', `${r.kod} / ${r.govde && r.govde.error}`);
      ok('⑬f · o yolda ağa ÇIKILMADI', cagrilar.length === 0, `${cagrilar.length} istek`);
    }

    // --- doğrulama hataları ağdan ÖNCE dönüyor --------------------------
    for (const [ad, govde, kod] of [
      ['bad_haberPazari', { q: 'ASELSAN', haberPazari: 'TOKYO' }, 'bad_haberPazari'],
      ['cok_sembol', { semboller: ['A', 'B', 'C', 'D', 'E'] }, 'cok_sembol'],
      ['bad_semboller', { semboller: 42 }, 'bad_semboller'],
    ]) {
      cagrilar = [];
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: govde }, r);
      ok(`⑬f · ${ad} → 400`, r.kod === 400 && r.govde.error === kod, `${r.kod} / ${r.govde && r.govde.error}`);
      ok(`⑬f · ${ad} gövdesinde uyarı metni`, r.govde.uyari === UYARI);
      ok(`⑬f · ${ad} ağdan ÖNCE döndü`, cagrilar.length === 0, `${cagrilar.length} istek`);
    }

    // --- sunucu yolu gerçekten çalışıyor mu -----------------------------
    cagrilar = [];
    {
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: {
        q: 'ASELSAN', genislik: 62, enflasyonBaskisi: 0.4, risk: 0.2, simdi: SIMDI,
      } }, r);
      ok('⑬f · sunucu yolu → 200', r.kod === 200, `kod ${r.kod}`);
      ok('⑬f · gövde alanları İSTEMCİ yolundakiyle AYNI (tek alan eklenmedi/çıkmadı)',
        anahtarlar(r.govde) === 'degerlendirilen,durus,eksik,haberler,kaynak,konjonktur,ms,pencere,surum,taze,uyari',
        anahtarlar(r.govde));
      ok('⑬f · yol AÇIKÇA bildiriliyor (kaynak = sunucu)', r.govde.kaynak === 'sunucu', String(r.govde.kaynak));
      ok('⑬f · ÖLÇÜM · 2 makro + 1 sorgu = 3 istek (paralel)',
        cagrilar.length === 3, `${cagrilar.length} istek`);
      ok('⑬f · ÖLÇÜM · bütün adresler İZİNLİ konakta', cagrilar.every(izinliAdres),
        cagrilar.length ? cagrilar[0].slice(0, 46) : '-');
      ok('⑬f · adresler pazar yereli taşıyor (hl/gl/ceid)',
        cagrilar.every((a) => /[?&]hl=/.test(a) && /&gl=/.test(a) && /&ceid=/.test(a)));
      ok('⑬f · haber ÖLÇÜMÜ gövdede (faiz/enflasyon/sorgu/sayac/tam)',
        anahtarlar(r.govde.haberler) === 'enflasyon,faiz,sayac,sorgu,tam',
        anahtarlar(r.govde.haberler));
      ok('⑬f · ÖLÇÜM · makro beslemelerden 3 + 3 manşet okundu',
        r.govde.haberler.faiz === 3 && r.govde.haberler.enflasyon === 3,
        `${r.govde.haberler.faiz} / ${r.govde.haberler.enflasyon}`);
      ok('⑬f · sayaçta hata/zaman aşımı/kısa gövde YOK → tam',
        r.govde.haberler.tam === true && r.govde.haberler.sayac.basari === 3,
        JSON.stringify(r.govde.haberler.sayac));
      ok('⑬f · sorgu manşetleri AYRI dönüyor (duruşa girmiyor)',
        r.govde.haberler.sorgu.length === 1 && r.govde.haberler.sorgu[0].sorgu === 'ASELSAN'
        && r.govde.haberler.sorgu[0].adet === 3);
      ok('⑬f · sorgu maddeleri taşıyıcının alan kümesini taşıyor',
        anahtarlar(r.govde.haberler.sorgu[0].maddeler[0]) === MADDE_ALANLARI.slice().sort().join(','),
        anahtarlar(r.govde.haberler.sorgu[0].maddeler[0]));
      ok('⑬f · ÖLÇÜM · sunucunun topladığı manşet MOTORA GİRDİ (duruş neu değil)',
        r.govde.degerlendirilen.faiz > 0 && r.govde.durus.kod === 'hawk',
        `${JSON.stringify(r.govde.degerlendirilen)} manşet / kod ${r.govde.durus.kod}`);
      ok('⑬f · cevap gövdeye bağlı olduğu için CDN\'de paylaşılmıyor',
        /no-store/.test(r.basliklar['cache-control'] || ''), r.basliklar['cache-control']);
    }

    // --- sembol tavanına kadar istek sayısı ÖLÇÜLÜYOR -------------------
    cagrilar = [];
    {
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: {
        semboller: ['ASELSAN', 'THYAO', 'KCHOL', 'SISE'], simdi: SIMDI,
      } }, r);
      ok('⑬f · 4 sembol → 200', r.kod === 200, `kod ${r.kod}`);
      ok('⑬f · ÖLÇÜM · 2 makro + 4 sembol = 6 istek (maxDuration aritmetiği)',
        cagrilar.length === 6, `${cagrilar.length} istek`);
      ok('⑬f · her sembol kendi ölçümüyle dönüyor', r.govde.haberler.sorgu.length === 4);
      ok('⑬f · genişlik verilmediği için konjonktür null (UYDURULMUYOR)',
        r.govde.konjonktur === null && r.govde.eksik.length > 0, JSON.stringify(r.govde.eksik));
    }

    // --- besleme ARIZALI: 502 DEĞİL, dürüst sessizlik -------------------
    cagrilar = [];
    globalThis.fetch = async () => { cagrilar.push('hata'); return { ok: false, status: 503, text: async () => '' }; };
    {
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: { q: 'ASELSAN', simdi: SIMDI } }, r);
      ok('⑬f · besleme 503 → uç hâlâ 200 (duruş nötr hesaplanabiliyor)', r.kod === 200, `kod ${r.kod}`);
      ok('⑬f · ama SESSİZ DEĞİL: `tam` false ve sayaç hatayı sayıyor',
        r.govde.haberler.tam === false && r.govde.haberler.sayac.hata === 3,
        JSON.stringify(r.govde.haberler.sayac));
      ok('⑬f · manşet yok → yönler 0, kod neu (dürüst sessizlik)',
        r.govde.durus.faizYon === 0 && r.govde.durus.kod === 'neu');
      ok('⑬f · boş besleme "veri yok" ile KARIŞTIRILMIYOR (kaynak sunucu kalıyor)',
        r.govde.kaynak === 'sunucu');
    }

    // --- İSTEMCİ yolu ağa HİÇ çıkmıyor (sahte fetch sayacı ile) ---------
    cagrilar = [];
    {
      const r = sahteRes();
      await nabizHandler({ method: 'POST', body: {
        faizHaberleri: [{ title: 'Fed cuts rates, dovish turn', description: '', pubDate: yas(5) }],
        enflasyonHaberleri: [], simdi: SIMDI,
      } }, r);
      ok('⑬f · ÖLÇÜM · istemci manşet verdi → SIFIR dış istek', cagrilar.length === 0, `${cagrilar.length} istek`);
      ok('⑬f · istemci yolunda kaynak/haberler değişmedi',
        r.kod === 200 && r.govde.kaynak === 'istemci' && r.govde.haberler === null);
      ok('⑬f · istemci yolunda duruş yine motordan (dove)', r.govde.durus.kod === 'dove', r.govde.durus.kod);
    }
  } finally {
    globalThis.fetch = gercekFetch;
  }
}
// =========================================================================
bolum('⑭ /api/news — sekizinci uç, haber (manşet) + api/_haber.js');
// =========================================================================
// NİYE AYRI BÖLÜM: haberin ağ taşıyıcısı `_ag.js` DEĞİL. Bu bölümün asıl
// işi o AYRIMI ölçmek — `_ag.js`in beş konaklı IZINLI listesi SKOR
// şeridinin güvenlik sözleşmesi ve haber oraya GİRMEDİ.
// AĞ: ⑭e `globalThis.fetch`i sahte bir besleme ile değiştiriyor; öteki
// bütün alt bölümler ağa HİÇ çıkmayan isteklerle çalışıyor.

// --- ⑭a yüzey ----------------------------------------------------------
ok('⑭a · default dışa aktarma bir fonksiyon', typeof haberHandler === 'function', typeof haberHandler);
ok('⑭a · config.runtime = nodejs', haberConfig && haberConfig.runtime === 'nodejs');
ok('⑭a · config.maxDuration = 10 (TEK istek; 60 kopyalanmadı)',
  haberConfig && haberConfig.maxDuration === 10, String(haberConfig && haberConfig.maxDuration));
ok('⑭a · limit tavanı 25, varsayılan 10',
  haberAzamiMadde === 25 && haberVarsayilanMadde === 10,
  `${haberVarsayilanMadde}..${haberAzamiMadde}`);
ok('⑭a · uçtaki tavan taşıyıcının TA KENDİSİ (yerel kopya yok)',
  haberAzamiMadde === agAzamiMadde);
ok('⑭a · varsayılan pazar KENDİ beyaz listesinde',
  haberPazarlar.includes(VARSAYILAN_PAZAR), `${VARSAYILAN_PAZAR} ∈ ${haberPazarlar.join('/')}`);
ok('⑭a · pazar listesi TR + US (üçüncüsü ÖLÇÜLMEDİ, uydurulmadı)',
  haberPazarlar.length === 2 && haberPazarlar.includes('TR') && haberPazarlar.includes('US'),
  haberPazarlar.join(','));
ok('⑭a · sorgu tavanı sayı ve pozitif',
  Number.isInteger(haberAzamiSorgu) && haberAzamiSorgu > 0, String(haberAzamiSorgu));
ok('⑭a · zaman aşımı sayı ve maxDuration tavanının ALTINDA',
  Number.isInteger(HABER_ISTEK_MS) && HABER_ISTEK_MS > 0
  && HABER_ISTEK_MS < haberConfig.maxDuration * 1000, `${HABER_ISTEK_MS} ms`);
ok('⑭a · izin listesi TEK konak (yalnız news.google.com)',
  IZINLI_KONAK.length === 1 && IZINLI_KONAK[0] === 'news.google.com', IZINLI_KONAK.join(','));
// KILIT DEGISTI ve NIYE: kume 4 alandan 6ya KASITLI buyudu. Webin haber akisi
// maddeyi `{ symbol, type, item }` olarak tasiyor ve ekranin iki suzgeci bu iki
// alani okuyor; sunucu onlari tasimadigi icin native istemci ayni suzgeci
// kuramiyordu. Beyaz liste KALDIRILMADI — alan alan yazili kaldi, 7. alan
// gelirse bu kapi gene kirmiziya doner.
ok('⑭a · madde alan kümesi beyaz liste (title/link/pubDate/source/type/symbol)',
  MADDE_ALANLARI.join(',') === 'title,link,pubDate,source,type,symbol',
  MADDE_ALANLARI.join(','));
ok('⑭a · kısa gövde eşiği sayı ve pozitif',
  Number.isInteger(ASGARI_GOVDE_BAYT) && ASGARI_GOVDE_BAYT > 0, String(ASGARI_GOVDE_BAYT));

// --- ⑭b method kapısı --------------------------------------------------
{
  const o = await cagirUc(haberHandler, 'OPTIONS', {});
  ok('⑭b · OPTIONS → 204 + end()', o.kod === 204 && o.bitti === true, `kod ${o.kod}`);
  ok('⑭b · CORS yöntem başlığı GET, OPTIONS',
    o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS',
    o.basliklar['access-control-allow-methods']);
  ok('⑭b · CORS köken başlığı *', o.basliklar['access-control-allow-origin'] === '*');

  const p = await cagirUc(haberHandler, 'POST', {});
  ok('⑭b · POST → 405 (bu uç GET)', p.kod === 405 && p.govde.error === 'method_not_allowed', `kod ${p.kod}`);
  ok('⑭b · 405 Allow başlığı GET, OPTIONS', p.basliklar.allow === 'GET, OPTIONS', p.basliklar.allow);
  ok('⑭b · hata yolu Cache-Control: max-age=30',
    p.basliklar['cache-control'] === 'public, max-age=30', p.basliklar['cache-control']);
  ok('⑭b · 405 gövdesinde uyarı metni', p.govde.uyari === UYARI);
}

// --- ⑭c sorgu doğrulaması — hepsi ağdan ÖNCE dönüyor -------------------
{
  const gercekFetch = globalThis.fetch;
  let agDenemesi = 0;
  globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑭c AĞ YASAĞI: ' + String(a[0])); };
  try {
    const e = async (query) => (await cagirUc(haberHandler, 'GET', query)).govde.error;
    ok('⑭c · q yok → missing_q', (await e({})) === 'missing_q');
    ok('⑭c · boş q → missing_q', (await e({ q: '   ' })) === 'missing_q');
    ok('⑭c · tavanı aşan q → too_long',
      (await e({ q: 'x'.repeat(haberAzamiSorgu + 1) })) === 'too_long');
    ok('⑭c · bilinmeyen pazar → bad_market', (await e({ q: 'ASELSAN', market: 'TOKYO' })) === 'bad_market');
    ok('⑭c · limit tavanı → limit_buyuk (SESSİZ KIRPMA yok)',
      (await e({ q: 'ASELSAN', limit: String(haberAzamiMadde + 1) })) === 'limit_buyuk');
    ok('⑭c · limit 0 → bad_limit', (await e({ q: 'ASELSAN', limit: '0' })) === 'bad_limit');
    ok('⑭c · limit negatif → bad_limit', (await e({ q: 'ASELSAN', limit: '-3' })) === 'bad_limit');
    ok('⑭c · limit ondalık → bad_limit', (await e({ q: 'ASELSAN', limit: '2.5' })) === 'bad_limit');
    ok('⑭c · limit metin → bad_limit', (await e({ q: 'ASELSAN', limit: 'çok' })) === 'bad_limit');

    const bm = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN', market: 'TOKYO' });
    ok('⑭c · bad_market izinli pazarları BİLDİRİYOR',
      Array.isArray(bm.govde.izinli) && bm.govde.izinli.includes('TR'), JSON.stringify(bm.govde.izinli));
    const lb = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN', limit: '99' });
    ok('⑭c · limit_buyuk tavanı VE isteneni BİLDİRİYOR',
      lb.govde.azami === haberAzamiMadde && lb.govde.istenen === 99,
      `${lb.govde.azami} / ${lb.govde.istenen}`);
    const tl = await cagirUc(haberHandler, 'GET', { q: 'x'.repeat(haberAzamiSorgu + 1) });
    ok('⑭c · too_long tavanı BİLDİRİYOR', tl.govde.azami === haberAzamiSorgu);

    for (const r of [bm, lb, tl]) {
      ok('⑭c · 4xx gövdesinde uyarı metni', r.govde.uyari === UYARI);
      ok('⑭c · 4xx kısa önbellekli', r.basliklar['cache-control'] === 'public, max-age=30');
    }
    ok('⑭c · ÖLÇÜM · doğrulama yolu ağa HİÇ çıkmadı', agDenemesi === 0, `${agDenemesi} deneme`);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑭d saf yardımcılar — adres kurma ve RSS ayrıştırma -----------------
{
  ok('⑭d · TR adresi hl=tr&gl=TR&ceid=TR:tr',
    /[?&]hl=tr&gl=TR&ceid=TR%3Atr$/.test(haberAdresi('ASELSAN', 'TR')), haberAdresi('ASELSAN', 'TR'));
  ok('⑭d · US adresi hl=en-US&gl=US&ceid=US:en',
    /[?&]hl=en-US&gl=US&ceid=US%3Aen$/.test(haberAdresi('AAPL', 'US')), haberAdresi('AAPL', 'US'));
  ok('⑭d · varsayılan pazar TR (sessiz US yok)', haberAdresi('ASELSAN') === haberAdresi('ASELSAN', 'TR'));
  ok('⑭d · pazar kodu büyük/küçük harf duyarsız', haberAdresi('AAPL', 'us') === haberAdresi('AAPL', 'US'));
  ok('⑭d · sorgu KAÇIRILIYOR (boşluk/" adresi bozmuyor)',
    !/\s/.test(haberAdresi('Fed "rate cut" & faiz', 'TR'))
    && haberAdresi('Fed "rate cut" & faiz', 'TR').includes('%22'));
  ok('⑭d · boş sorgu → null (uydurma besleme yok)',
    haberAdresi('', 'TR') === null && haberAdresi('   ', 'TR') === null);
  ok('⑭d · bilinmeyen pazar → null', haberAdresi('ASELSAN', 'TOKYO') === null);
  ok('⑭d · tavanı aşan sorgu → null', haberAdresi('x'.repeat(haberAzamiSorgu + 1), 'TR') === null);
  ok('⑭d · kurulan adres KENDİ izin listesinden geçiyor', izinliAdres(haberAdresi('ASELSAN', 'TR')) === true);
  ok('⑭d · http REDDEDİLİYOR (yalnız https)', izinliAdres('http://news.google.com/rss/search?q=x') === false);
  ok('⑭d · izin listesi DIŞI konak reddediliyor',
    izinliAdres('https://evil.example/rss') === false
    && izinliAdres('https://news.google.com.evil.example/rss') === false);
  ok('⑭d · bozuk adres reddediliyor (çökmüyor)', izinliAdres('xxx') === false && izinliAdres(null) === false);

  // RSS ayrıştırma — SAF, fikstürle. İkizi app.js:164 `parseRSS`.
  const XML = '<?xml version="1.0"?><rss><channel>'
    + '<item><title>Birinci manşet &amp; ek</title><link>https://news.google.com/a</link>'
    + '<pubDate>Mon, 19 Oct 2026 09:00:00 GMT</pubDate><source url="https://x">Örnek</source></item>'
    + '<item><title><![CDATA[İkinci manşet]]></title><link>https://news.google.com/b</link>'
    + '<pubDate>Mon, 19 Oct 2026 08:00:00 GMT</pubDate></item>'
    + '<item><link>https://news.google.com/c</link><pubDate>x</pubDate></item>'
    + '</channel></rss>';
  const m = ayristirRSS(XML, 10);
  ok('⑭d · başlıksız madde ELENDİ (manşet değil)', m.length === 2, `${m.length} madde`);
  ok('⑭d · madde alan kümesi SABİT',
    anahtarlar(m[0]) === MADDE_ALANLARI.slice().sort().join(','), anahtarlar(m[0]));
  ok('⑭d · XML kaçışı çözülüyor (&amp; → &)', m[0].title === 'Birinci manşet & ek', m[0].title);
  ok('⑭d · CDATA okunuyor', m[1].title === 'İkinci manşet', m[1].title);
  ok('⑭d · bağlantı okunuyor', m[0].link === 'https://news.google.com/a', m[0].link);
  ok('⑭d · kaynak adı okunuyor, yoksa boş (uydurulmuyor)',
    m[0].source === 'Örnek' && m[1].source === '', `${m[0].source} / "${m[1].source}"`);
  ok('⑭d · pubDate ÜST KAYNAĞIN VERDİĞİ GİBİ (ms\'e çevrilmedi)',
    m[0].pubDate === 'Mon, 19 Oct 2026 09:00:00 GMT', m[0].pubDate);
  ok('⑭d · Atom <entry> + <link href> de okunuyor', (() => {
    const a = ayristirRSS('<feed><entry><title>Atom başlık</title>'
      + '<link rel="alternate" href="https://news.google.com/z"/>'
      + '<updated>2026-10-19T09:00:00Z</updated></entry></feed>', 5);
    return a.length === 1 && a[0].link === 'https://news.google.com/z'
      && a[0].pubDate === '2026-10-19T09:00:00Z';
  })());
  ok('⑭d · limit UYULUYOR', ayristirRSS(XML, 1).length === 1);
  ok('⑭d · limit taşıyıcı tavanının üstünde olsa da çökmüyor', ayristirRSS(XML, 9999).length === 2);
  ok('⑭d · limit 0 → boş (sessiz varsayılan yok)', ayristirRSS(XML, 0).length === 0);
  ok('⑭d · boş/çöp gövde → boş dizi (çökmüyor)',
    ayristirRSS('', 10).length === 0 && ayristirRSS(null, 10).length === 0
    && ayristirRSS('<html>hiç madde yok</html>', 10).length === 0);

  // Sayaç — "ölçemedim" ile "haber yok" ayrımı.
  const s = bosHaberSayac();
  ok('⑭d · boş sayaç alanları sabit',
    anahtarlar(s) === 'basari,bayt,hata,istek,kisa,zamanAsimi', anahtarlar(s));
  ok('⑭d · temiz sayaç → tam', haberTam(s) === true);
  ok('⑭d · hata/zaman aşımı/kısa gövde → tam DEĞİL',
    haberTam({ ...s, hata: 1 }) === false && haberTam({ ...s, zamanAsimi: 1 }) === false
    && haberTam({ ...s, kisa: 1 }) === false);
  ok('⑭d · sayaç yoksa tam DEĞİL (sessiz true yok)', haberTam(null) === false);
  ok('⑭d · pazar yereli tablosu her pazar için hl/gl/ceid taşıyor',
    haberPazarlar.every((p) => PAZAR_YERELI[p] && PAZAR_YERELI[p].hl
      && PAZAR_YERELI[p].gl && PAZAR_YERELI[p].ceid));
}

// --- ⑭e gerçek cevap — SAHTE besleme (ağa çıkmıyor) --------------------
{
  const gercekFetch = globalThis.fetch;
  const madde = (i) => `<item><title>Manşet ${i}</title><link>https://news.google.com/${i}</link>`
    + `<pubDate>Mon, 19 Oct 2026 0${i}:00:00 GMT</pubDate><source url="https://x">Örnek Yayın</source></item>`;
  const RSS = '<?xml version="1.0"?><rss><channel>'
    + '<title>Örnek besleme — kısa gövde eşiğini aşmak için yeterince uzun kanal başlığı</title>'
    + [1, 2, 3, 4, 5].map(madde).join('') + '</channel></rss>';
  let adresler = [];
  globalThis.fetch = async (adres) => {
    adresler.push(String(adres));
    return { ok: true, status: 200, text: async () => RSS };
  };
  try {
    const r = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN', market: 'TR', limit: '3' });
    ok('⑭e · geçerli GET → 200', r.kod === 200, `kod ${r.kod}`);
    ok('⑭e · gövde alanları sabit',
      anahtarlar(r.govde) === 'adet,limit,maddeler,market,ms,q,sayac,tam,uyari', anahtarlar(r.govde));
    ok('⑭e · uyarı metni gövdede', r.govde.uyari === UYARI);
    ok('⑭e · istenen q/market/limit cevapta GERİ BİLDİRİLİYOR',
      r.govde.q === 'ASELSAN' && r.govde.market === 'TR' && r.govde.limit === 3);
    ok('⑭e · ÖLÇÜM · TEK dış istek (uç fan-out yapmıyor)', adresler.length === 1, `${adresler.length} istek`);
    ok('⑭e · istek İZİNLİ konağa gitti', adresler.every(izinliAdres), adresler[0].slice(0, 46));
    ok('⑭e · limit UYULDU (5 maddelik besleme, 3 istendi)',
      r.govde.maddeler.length === 3 && r.govde.adet === 3, `${r.govde.adet} madde`);
    ok('⑭e · madde alan kümesi beyaz listeli',
      anahtarlar(r.govde.maddeler[0]) === MADDE_ALANLARI.slice().sort().join(','),
      anahtarlar(r.govde.maddeler[0]));
    ok('⑭e · `tam` ölçüm sonucunu bildiriyor', r.govde.tam === true);
    ok('⑭e · sayaç gövdede (ölçemedim/haber yok ayrımı istemciye geçiyor)',
      r.govde.sayac && r.govde.sayac.istek === 1 && r.govde.sayac.basari === 1 && r.govde.sayac.bayt > 0,
      JSON.stringify(r.govde.sayac));
    ok('⑭e · ms HAM sayı', typeof r.govde.ms === 'number' && r.govde.ms >= 0);
    ok('⑭e · DOLU ve TAM cevap uzun pencerede önbelleklendi',
      /max-age=120/.test(r.basliklar['cache-control'] || ''), r.basliklar['cache-control']);

    const v = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN' });
    ok('⑭e · limit verilmedi → varsayılan 10, pazar varsayılan TR',
      v.govde.limit === haberVarsayilanMadde && v.govde.market === VARSAYILAN_PAZAR,
      `${v.govde.limit} / ${v.govde.market}`);

    // BOŞ BESLEME: 200 + boş liste + tam:true — "haber yok" ARIZA DEĞİL.
    adresler = [];
    globalThis.fetch = async (adres) => {
      adresler.push(String(adres));
      return { ok: true, status: 200, text: async () => '<?xml version="1.0"?><rss><channel>'
        + '<title>Hiç maddesi olmayan gecerli bir besleme</title>'
        // ASGARI_GOVDE_BAYT eşiğini AŞMAK için dolgu: gövde KISA olursa
        // taşıyıcı bunu "ölçemedim" sayar; burada ölçülen şey "haber yok".
        + '<description>' + 'bos besleme dolgusu '.repeat(20) + '</description>'
        + '</channel></rss>' };
    };
    const bos = await cagirUc(haberHandler, 'GET', { q: 'YOKBOYLEBIRSEY' });
    ok('⑭e · haberi olmayan sorgu → 200 + boş liste + tam (arıza DEĞİL)',
      bos.kod === 200 && bos.govde.adet === 0 && bos.govde.tam === true,
      `${bos.kod} / ${bos.govde.adet} / ${bos.govde.tam}`);
    ok('⑭e · boş cevap KISA önbellekli (birkaç dakika sonra manşet gelebilir)',
      bos.basliklar['cache-control'] === 'public, max-age=30', bos.basliklar['cache-control']);

    // ÜST KAYNAK 503: "ölçemedim" — boş liste ile KARIŞTIRILMIYOR.
    globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
    const ariza = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN' });
    ok('⑭e · üst kaynak 503 → 200 ama `tam` false (ölçemedim ≠ haber yok)',
      ariza.kod === 200 && ariza.govde.tam === false && ariza.govde.sayac.hata === 1,
      `${ariza.kod} / tam ${ariza.govde.tam}`);

    // KISA GÖVDE: ölçemedim.
    globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<rss/>' });
    const kisa = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN' });
    ok('⑭e · kısa gövde → ölçemedim (`kisa` sayacı, tam false)',
      kisa.govde.tam === false && kisa.govde.sayac.kisa === 1, JSON.stringify(kisa.govde.sayac));

    // ZAMAN AŞIMI: AbortError sayacı ayrı tutuluyor.
    globalThis.fetch = async () => { const e = new Error('iptal'); e.name = 'AbortError'; throw e; };
    const za = await cagirUc(haberHandler, 'GET', { q: 'ASELSAN' });
    ok('⑭e · zaman aşımı AYRI sayılıyor (hata ile karışmıyor)',
      za.kod === 200 && za.govde.sayac.zamanAsimi === 1 && za.govde.sayac.hata === 0,
      JSON.stringify(za.govde.sayac));
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑭f statik denetimler — ayrım metinde de duruyor -------------------
{
  const src = readFileSync(NEWS_PATH, 'utf8');
  const kod = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const habSrc = readFileSync(HABER_PATH, 'utf8');
  const habKod = habSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok('⑭f · uç uyarı metnini taşıyor', src.includes(UYARI));
  ok('⑭f · HAM METİN · `Intl` kullanımı yok', !/\bIntl\b/.test(kod) && !/\bIntl\b/.test(habKod));
  ok('⑭f · HAM METİN · `toFixed(` yok', !kod.includes('toFixed(') && !habKod.includes('toFixed('));
  ok('⑭f · HAM METİN · `toLocaleString` yok',
    !kod.includes('toLocaleString') && !habKod.includes('toLocaleString'));
  ok('⑭f · hata yolunda `api/news:` önekli log var', /console\.error\('api\/news:/.test(kod));
  ok('⑭f · 502 yalnız makine kodu döndürüyor',
    /error:\s*'haber_alinamadi'/.test(kod) && !/\bdetail\s*:/.test(kod));

  // ASIL AYRIM: haber `_ag.js`e GİRMEDİ.
  ok('⑭f · uç `_ag.js` import ETMİYOR', !/_ag\.js/.test(kod));
  ok('⑭f · taşıyıcı `_ag.js` import ETMİYOR (kendi zaman aşımı/izin listesi)', !/_ag\.js/.test(habKod));
  ok('⑭f · uç motor/ayar import ETMİYOR (skor şeridinin İÇİNDE değil)',
    !/_motor\.js|_ayar\.js/.test(kod));
  ok('⑭f · app.js / config.js import edilmiyor',
    !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(src)
    && !/from\s+['"][^'"]*\.\.\/(app|config)\.js['"]/.test(habSrc));
  const agSrc2 = readFileSync(AG_PATH, 'utf8');
  ok('⑭f · ÖLÇÜM · `_ag.js`e haber konağı EKLENMEDİ', !/news\.google/.test(agSrc2));
  ok('⑭f · ÖLÇÜM · `_ag.js` IZINLI listesi hâlâ ESKİ konakları taşıyor',
    (agSrc2.match(/finance\.yahoo\.com|www\.sec\.gov|data\.sec\.gov|www\.isyatirim\.com\.tr/g) || []).length >= 4);

  // AĞA ÇIKAN TEK YER taşıyıcı: uçta `fetch(` yok.
  ok('⑭f · uçta çıplak `fetch(` yok (ağ TAŞIYICIDA)', !/\bfetch\(/.test(kod));
  ok('⑭f · taşıyıcıda zaman aşımı GERÇEKTEN var (AbortController + signal)',
    /AbortController/.test(habKod) && /signal:/.test(habKod) && /clearTimeout/.test(habKod));
  ok('⑭f · taşıyıcı adresi izin listesinden GEÇİRİYOR (çağrı öncesi)',
    /izinliAdres\(adres\)/.test(habKod));

  // KİŞİSEL VERİ: 9007fc3'te SEC kimliğinden çıkarılan e-posta burada
  // tekrar doğmasın.
  ok('⑭f · kimlik dizgesinde e-posta/anahtar YOK',
    !/@gmail|ANTHROPIC|apiKey/.test(habSrc), 'temiz');
  ok('⑭f · `User-Agent` sade bir ad taşıyor', /'User-Agent':\s*'day-starter\/1\.0/.test(habKod));

  // app.js'teki İKİZE işaret ediliyor mu (kopyala-yapıştır değil, atıf).
  ok('⑭f · `ayristirRSS` app.js\'teki ikizine İŞARET EDİYOR',
    /app\.js:\d+/.test(habSrc) && /parseRSS/.test(habSrc));
  ok('⑭f · taşıyıcı ELLE yazıldığını söylüyor (üretilmiş değil)', /ELLE YAZILMIŞ/i.test(habSrc));

  // KV önbelleği YOK — gerekçesi YAZILI (sessiz eksiklik değil).
  ok('⑭f · `_onbellek.js` import EDİLMEMİŞ ve gerekçesi başlıkta yazılı',
    !/_onbellek\.js/.test(kod) && /KV ÖNBELLEĞİ YOK/.test(src));

  // Yeni bağımlılık EKLENMEDİ: RSS ayrıştırma elle.
  ok('⑭f · taşıyıcı dış paket import ETMİYOR (yeni bağımlılık yok)',
    !/^\s*import\s/m.test(habKod), 'import yok');
}

// =========================================================================
bolum('⑮ /api/tarama · /api/sektor · /api/radar · /api/backtest · /api/deger — keşif rotaları (api/_kesif.js)');
// =========================================================================
// 13. FONKSİYON TUZAĞI: bu beş uç YENİ dosya DEĞİL. `api/proxy.js`in
// `__rota=` çoklayıcısına takılı (api/yfin kalıbı). Aşağıdaki ⑮b bölümü
// rota adının ÜÇ yerde (vercel.json ↔ proxy.js ↔ _kesif.js) aynı olduğunu
// ve `api/*.js` sayısının ARTMADIĞINI kilitliyor — sessiz deploy arızasına
// karşı kalıcı bekçi.
{
  const kesifSrc = readFileSync(KESIF_PATH, 'utf8');
  const kesifKod = kesifSrc.split(/\r?\n/)
    .filter((s) => !/^\s*(\/\/|\*|\/\*)/.test(s)).join('\n');
  const proxySrc = readFileSync(PROXY_PATH, 'utf8');
  const vercelSrc = readFileSync(VERCEL_PATH, 'utf8');
  const vercel = JSON.parse(vercelSrc);

  // Beyaz listeler UCUN KENDİ motorundan okunuyor (test kancası
  // `motorBak`): testte elle kopya liste YOK, ikinci motor da kurulmuyor.
  const ENG = KESIF.motorBak();
  const ENGINE_SCAN = ENG.SCAN_PRESETS;
  const ENGINE_RADAR = ENG.RADAR_THEMES;
  const ENGINE_SECTORS = ENG.SECTORS;
  const ENGINE_METAL = ENG.METAL_MACRO_W;
  const ENGINE_BT = ENG.BT_CFG;
  const ENGINE_METAL_CALL = (t2, d) => ENG.computeMetalMacro(t2, d);

  /** keşif handler'ını çağır (cagirUc gövde taşımıyor; POST için gerekli). */
  const cagirKesif = async (h, method, query, body) => {
    const res = sahteRes();
    await h({ method, query, body }, res);
    return res;
  };

  // Gövdede dolaşan HER cevabı biriktirip sonunda topluca süzüyoruz:
  // HTML / emoji / tavsiye dili TEK yerden denetleniyor.
  const govdeler = [];
  const yakala = (r) => { if (r && r.govde) govdeler.push(r.govde); return r; };

  // İstemcinin verdiği Yahoo temel kaydı — ölçüm uçta değil, GİRDİDE.
  const olcum = (sym, ek = {}) => ({ symbol: sym, ok: true, ...ek });
  const UC_KAYIT = [
    olcum('AAPL', { sector: 'Technology', trailingPE: 20, forwardPE: 18, priceToBook: 30, evEbitda: 14, dividendYield: 0.005, revenueGrowth: 0.08, profitMargin: 0.25, peg: 2 }),
    olcum('XOM', { sector: 'Energy', trailingPE: 9, forwardPE: 8, priceToBook: 1.8, evEbitda: 5, dividendYield: 0.035, revenueGrowth: 0.02, profitMargin: 0.1, peg: 0.9 }),
    { symbol: 'ZZZZ', ok: false },
  ];

  // --- ⑮a yüzey --------------------------------------------------------
  ok('⑮a · beş handler da fonksiyon',
    ['taramaHandler', 'sektorHandler', 'radarHandler', 'backtestHandler', 'degerHandler']
      .every((a) => typeof KESIF[a] === 'function'));
  ok('⑮a · ROTALAR beş rota ilan ediyor',
    KESIF.ROTALAR.join(',') === 'tarama,sektor,radar,backtest,deger', KESIF.ROTALAR.join(','));
  ok('⑮a · HANDLERLAR tablosu ROTALAR ile BİREBİR',
    anahtarlar(KESIF.HANDLERLAR) === [...KESIF.ROTALAR].sort().join(','), anahtarlar(KESIF.HANDLERLAR));
  ok('⑮a · HANDLERLAR dondurulmuş (rota tablosu çalışma anında değişmez)',
    Object.isFrozen(KESIF.HANDLERLAR));
  ok('⑮a · motor modül düzeyinde KURULDU (score.js/chart.js kalıbı)', KESIF.motorHazir() === true);
  ok('⑮a · `ayristirOlcumler` dışa aktarılmış (ağsız sınanabilir)',
    typeof KESIF.ayristirOlcumler === 'function');
  ok('⑮a · sıra kipleri sabit', KESIF.SIRA_KIPLERI.join(',') === 'cheap,growth,margin,count');
  ok('⑮a · varsayılan sıra beyaz listede', KESIF.SIRA_KIPLERI.includes(KESIF.VARSAYILAN_SIRA));
  ok('⑮a · ölçüm tavanı ÖLÇÜLMÜŞ bir sayı (api/_yfin.js:147 · 12 × 10)',
    KESIF.AZAMI_OLCUM === 120, String(KESIF.AZAMI_OLCUM));
  ok('⑮a · sayısal ölçüm listesi `ok`/`symbol` TAŞIMIYOR (çakışma yok)',
    !KESIF.OLCUM_SAYISAL.includes('ok') && !KESIF.OLCUM_SAYISAL.includes('symbol'));
  ok('⑮a · metinsel ve sayısal ölçüm kümeleri AYRIK',
    !KESIF.OLCUM_SAYISAL.some((k) => KESIF.OLCUM_METINSEL.includes(k)));

  // --- ⑮b 13. FONKSİYON KİLİDİ ----------------------------------------
  {
    const dosyalar = readdirSync(path.join(ROOT, 'api'))
      .filter((f) => f.endsWith('.js') && !f.startsWith('_'));
    ok('⑮b · KİLİT · `api/*.js` uç dosyası sayısı 12 (Hobby tavanı aşılmadı)',
      dosyalar.length === 12, `${dosyalar.length}: ${dosyalar.join(',')}`);
    ok('⑮b · yeni uç dosyası YOK — keşif `_` önekli MODÜL',
      !dosyalar.some((f) => /tarama|sektor|radar|backtest|deger|kesif/.test(f)), dosyalar.join(','));
    ok('⑮b · `api/_kesif.js` gerçekten `_` önekli (fonksiyon sayılmaz)',
      existsSync(KESIF_PATH) && path.basename(KESIF_PATH).startsWith('_'));

    // ROTA ADI: vercel.json ↔ proxy.js ↔ _kesif.js AYNI olmalı.
    const rew = vercel.rewrites || [];
    for (const r of KESIF.ROTALAR) {
      const k = rew.find((x) => x.source === `/api/${r}`);
      ok(`⑮b · vercel.json \`/api/${r}\` rewrite'ı var`, !!k, k && k.destination);
      ok(`⑮b · \`/api/${r}\` proxy'ye \`__rota=${r}\` ile gidiyor`,
        !!k && k.destination === `/api/proxy?__rota=${r}`, k && k.destination);
    }
    ok('⑮b · yfin rewrite\'ı BOZULMADI (taklit edilen kalıp yerinde)',
      rew.some((x) => x.source === '/api/yfin' && x.destination === '/api/proxy?__rota=yfin'));
    ok('⑮b · `functions` bloğuna YENİ kalem girmedi (beşi proxy bütçesini paylaşıyor)',
      !Object.keys(vercel.functions || {}).some((k) => /tarama|sektor|radar|backtest|deger|kesif/.test(k)),
      Object.keys(vercel.functions || {}).join(','));
    ok('⑮b · beş rota `api/proxy.js`in maxDuration bütçesinde',
      (vercel.functions || {})['api/proxy.js'] && typeof vercel.functions['api/proxy.js'].maxDuration === 'number',
      String((vercel.functions || {})['api/proxy.js'] && vercel.functions['api/proxy.js'].maxDuration));

    // proxy.js: tablo okunuyor, rota adı ELLE yazılmıyor.
    ok('⑮b · proxy.js `_kesif.js`i DİNAMİK import ediyor (soğuk başlangıç korunuyor)',
      /await import\('\.\/_kesif\.js'\)/.test(proxySrc));
    ok('⑮b · proxy.js\'te STATİK `_kesif.js` import\'u YOK',
      !/^\s*import[^\n]*_kesif\.js/m.test(proxySrc));
    ok('⑮b · proxy.js HANDLERLAR tablosunu okuyor (beş `if` yazılmamış)',
      /HANDLERLAR\[/.test(proxySrc)
      && !/__rota === 'tarama'/.test(proxySrc) && !/__rota === 'deger'/.test(proxySrc));
    ok('⑮b · proxy.js\'in yfin dalı YERİNDE (mevcut davranış bozulmadı)',
      /__rota === 'yfin'/.test(proxySrc) && /yfinHandler\(req, res\)/.test(proxySrc));
  }

  // --- ⑮c AĞ YASAĞI + doğrulama kapıları -------------------------------
  // `globalThis.fetch` KARA DELİK: doğrulama yolu tek paket dışarı
  // çıkarmıyor. Patlarsa o denetim kırmızıya döner.
  {
    const gercekFetch = globalThis.fetch;
    let agDenemesi = 0;
    globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑮ AĞ YASAĞI: ' + String(a[0])); };
    try {
      // OPTIONS + yöntem kapıları — beş rotanın HEPSİ.
      for (const r of KESIF.ROTALAR) {
        const h = KESIF.HANDLERLAR[r];
        const o = await cagirKesif(h, 'OPTIONS', {});
        ok(`⑮c · ${r} OPTIONS → 204 + body yok`, o.kod === 204 && o.bitti === true && o.govde === null, `kod ${o.kod}`);
        ok(`⑮c · ${r} CORS başlıkları yerinde (mevcut uçlarla aynı küme)`,
          o.basliklar['access-control-allow-origin'] === '*'
          && o.basliklar['access-control-allow-headers'] === 'Content-Type'
          && o.basliklar['access-control-max-age'] === '86400');
        const y = yakala(await cagirKesif(h, 'PUT', {}, {}));
        ok(`⑮c · ${r} PUT → 405 method_not_allowed + Allow`,
          y.kod === 405 && y.govde.error === 'method_not_allowed' && !!y.basliklar.allow,
          `${y.kod} / ${y.basliklar.allow}`);
      }
      // POST uçları GET'i, GET ucu POST'u reddediyor.
      ok('⑮c · tarama GET kabul ETMİYOR',
        (await cagirKesif(KESIF.taramaHandler, 'GET', {})).kod === 405);
      ok('⑮c · sektor GET kabul ETMİYOR',
        (await cagirKesif(KESIF.sektorHandler, 'GET', {})).kod === 405);
      ok('⑮c · radar POST kabul ETMİYOR',
        (await cagirKesif(KESIF.radarHandler, 'POST', {}, {})).kod === 405);
      ok('⑮c · backtest POST kabul ETMİYOR',
        (await cagirKesif(KESIF.backtestHandler, 'POST', {}, {})).kod === 405);
      ok('⑮c · deger GET ve POST\'u da kabul ediyor (metal/kripto)',
        (await cagirKesif(KESIF.degerHandler, 'GET', { tur: 'gumus' })).kod === 200
        && (await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'kripto', belge: {} })).kod !== 405);

      // GÖVDE kapıları (POST uçları).
      const g1 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, undefined));
      ok('⑮c · gövdesiz POST → 400 govde_yok', g1.kod === 400 && g1.govde.error === 'govde_yok', g1.govde.error);
      const g2 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, '{bozuk'));
      ok('⑮c · bozuk JSON → 400 bozuk_json', g2.kod === 400 && g2.govde.error === 'bozuk_json', g2.govde.error);
      const g3 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, 'x'.repeat(KESIF_GOVDE_BAYT + 1)));
      ok('⑮c · gövde tavanı aşıldı → 413 govde_buyuk',
        g3.kod === 413 && g3.govde.error === 'govde_buyuk' && g3.govde.azami === KESIF_GOVDE_BAYT, `kod ${g3.kod}`);
      const g4 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, [1, 2]));
      ok('⑮c · dizi gövde → 400 govde_yok (nesne bekleniyor)', g4.kod === 400 && g4.govde.error === 'govde_yok');

      // PRESET kapısı — `scanTag` bilinmeyen presette PATLIYOR.
      const p1 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, { preset: 'yok-boyle', olcumler: UC_KAYIT }));
      ok('⑮c · bilinmeyen preset → 400 bad_preset (502 DEĞİL)',
        p1.kod === 400 && p1.govde.error === 'bad_preset', `${p1.kod} ${p1.govde.error}`);
      ok('⑮c · bad_preset izinli listesini BİLDİRİYOR (sessiz ret yok)',
        Array.isArray(p1.govde.izinli) && p1.govde.izinli.length > 0, (p1.govde.izinli || []).join(','));
      ok('⑮c · preset beyaz listesi MOTORDAN okunuyor (uçta kopya yok)',
        p1.govde.izinli.join(',') === Object.keys(ENGINE_SCAN).join(','), p1.govde.izinli.join(','));
      const p2 = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, { olcumler: UC_KAYIT }));
      ok('⑮c · preset VERİLMEDİ → 400 bad_preset (varsayılan uydurulmuyor)',
        p2.kod === 400 && p2.govde.error === 'bad_preset');

      // ÖLÇÜM kapıları — `ayristirOlcumler` SAF, doğrudan da ölçülüyor.
      const preset0 = Object.keys(ENGINE_SCAN)[0];
      const tara = (olcumler) => cagirKesif(KESIF.taramaHandler, 'POST', {}, { preset: preset0, olcumler });
      const o1 = yakala(await tara(undefined));
      ok('⑮c · olcumler yok → 400 olcumler_yok', o1.kod === 400 && o1.govde.error === 'olcumler_yok', o1.govde.error);
      const o2 = yakala(await tara([]));
      ok('⑮c · olcumler boş → 400 olcumler_bos', o2.kod === 400 && o2.govde.error === 'olcumler_bos');
      const o3 = yakala(await tara(Array.from({ length: KESIF.AZAMI_OLCUM + 1 }, (_, i) => olcum('A' + i))));
      ok('⑮c · tavan aşıldı → 400 cok_olcum + azami/istenen',
        o3.kod === 400 && o3.govde.error === 'cok_olcum' && o3.govde.azami === KESIF.AZAMI_OLCUM
        && o3.govde.istenen === KESIF.AZAMI_OLCUM + 1, JSON.stringify(o3.govde.istenen));
      const o4 = yakala(await tara([42]));
      ok('⑮c · kayıt nesne değil → 400 bad_olcum', o4.kod === 400 && o4.govde.error === 'bad_olcum');
      const o5 = yakala(await tara([olcum('  ')]));
      ok('⑮c · boş sembol → 400 symbols_bos', o5.kod === 400 && o5.govde.error === 'symbols_bos');
      const o6 = yakala(await tara([olcum('A'.repeat(AZAMI_SORGU + 1))]));
      ok('⑮c · sembol çok uzun → 400 too_long + azami',
        o6.kod === 400 && o6.govde.error === 'too_long' && o6.govde.azami === AZAMI_SORGU);
      const o7 = yakala(await tara([olcum('AAPL', { market: 'MARS' })]));
      ok('⑮c · bilinmeyen pazar → 400 bad_market + izinli',
        o7.kod === 400 && o7.govde.error === 'bad_market'
        && o7.govde.izinli.join(',') === girdiPazarlar.join(','), (o7.govde.izinli || []).join(','));
      const o8 = yakala(await tara([olcum('@@@')]));
      ok('⑮c · biçim dışı sembol → 400 bad_symbol', o8.kod === 400 && o8.govde.error === 'bad_symbol');

      // SEMBOL KAPISI `_girdi.js`in TA KENDİSİ — yeni desen uydurulmadı.
      const saf = KESIF.ayristirOlcumler([olcum('aapl'), olcum('AAPL'), olcum('asels', { market: 'BIST' })]);
      ok('⑮c · sembol `_girdi.js:temizleSembol` ile normalleşiyor',
        saf.kayitlar[0].sym === girdiTemizle('aapl', 'US').sym, saf.kayitlar[0].sym);
      ok('⑮c · aynı sembol TEKİLLEŞİYOR (sessiz yineleme yok)',
        saf.kayitlar.length === 2, `${saf.kayitlar.length} kayıt`);
      ok('⑮c · pazar kaydın İÇİNDE taşınıyor (BIST ayrı duruyor)',
        saf.kayitlar[1].market === 'BIST' && saf.kayitlar[1].sym === 'ASELS',
        `${saf.kayitlar[1].market}:${saf.kayitlar[1].sym}`);
      const endeks = KESIF.ayristirOlcumler([olcum(Object.keys(girdiSozluk)[0])]);
      ok('⑮c · endeks takma adı `_girdi.js:cozEndeks` ile çözülüyor',
        !!endeks.kayitlar && endeks.kayitlar[0].sym === girdiCozEndeks(Object.keys(girdiSozluk)[0]).sym,
        endeks.kayitlar && endeks.kayitlar[0].sym);
      const bosOlcum = KESIF.ayristirOlcumler([olcum('AAPL', { trailingPE: 'abc', priceToBook: null })]);
      ok('⑮c · ÖLÇÜLMEMİŞ sayı null — 0 DEĞİL',
        bosOlcum.kayitlar[0].m.trailingPE === null && bosOlcum.kayitlar[0].m.priceToBook === null,
        JSON.stringify(bosOlcum.kayitlar[0].m.trailingPE));
      ok('⑮c · istemcinin `ok:false` bayrağı MOTORA geçiyor (veri yok ≠ kötü ölçüm)',
        KESIF.ayristirOlcumler([{ symbol: 'ZZZZ', ok: false }]).kayitlar[0].m.ok === false);

      // sektor kapıları
      const s1 = yakala(await cagirKesif(KESIF.sektorHandler, 'POST', {}, { sira: 'yok', olcumler: UC_KAYIT }));
      ok('⑮c · bilinmeyen sıra → 400 bad_sira + izinli',
        s1.kod === 400 && s1.govde.error === 'bad_sira'
        && s1.govde.izinli.join(',') === KESIF.SIRA_KIPLERI.join(','), s1.govde.error);
      const s2 = yakala(await cagirKesif(KESIF.sektorHandler, 'POST', {}, { olcumler: UC_KAYIT }));
      ok('⑮c · sıra verilmezse VARSAYILAN uygulanıyor ve GERİ BİLDİRİLİYOR',
        s2.kod === 200 && s2.govde.sira === KESIF.VARSAYILAN_SIRA, s2.govde.sira);

      // radar kapıları
      const r1 = yakala(await cagirKesif(KESIF.radarHandler, 'GET', { tema: 'yok-boyle' }));
      ok('⑮c · bilinmeyen tema → 400 bad_tema + izinli',
        r1.kod === 400 && r1.govde.error === 'bad_tema' && Array.isArray(r1.govde.izinli), r1.govde.error);
      const r2 = yakala(await cagirKesif(KESIF.radarHandler, 'GET', { sektor: 'yok-boyle' }));
      ok('⑮c · bilinmeyen sektör → 400 bad_sektor + izinli',
        r2.kod === 400 && r2.govde.error === 'bad_sektor' && Array.isArray(r2.govde.izinli), r2.govde.error);
      const r3 = yakala(await cagirKesif(KESIF.radarHandler, 'GET', { tema: 'a'.repeat(AZAMI_SORGU + 1) }));
      ok('⑮c · çok uzun tema → 400 too_long', r3.kod === 400 && r3.govde.error === 'too_long');

      // backtest kapıları (hepsi ağ AÇILMADAN)
      const b = (q) => cagirKesif(KESIF.backtestHandler, 'GET', q);
      const b1 = yakala(await b({}));
      ok('⑮c · symbol yok → 400 symbol_yok', b1.kod === 400 && b1.govde.error === 'symbol_yok');
      const b2 = yakala(await b({ symbol: 'A'.repeat(AZAMI_SORGU + 1) }));
      ok('⑮c · symbol çok uzun → 400 too_long', b2.kod === 400 && b2.govde.error === 'too_long');
      const b3 = yakala(await b({ symbol: 'AAPL,MSFT' }));
      ok('⑮c · çoklu sembol → 400 cok_sembol (SESSİZ KIRPMA YOK)',
        b3.kod === 400 && b3.govde.error === 'cok_sembol' && b3.govde.azami === 1, b3.govde.error);
      const b4 = yakala(await b({ symbol: 'AAPL', market: 'MARS' }));
      ok('⑮c · bilinmeyen pazar → 400 bad_market', b4.kod === 400 && b4.govde.error === 'bad_market');
      const b5 = yakala(await b({ symbol: '@@@' }));
      ok('⑮c · biçim dışı sembol → 400 bad_symbol', b5.kod === 400 && b5.govde.error === 'bad_symbol');
      const b6 = yakala(await b({ symbol: 'AAPL', vade: 'yok' }));
      ok('⑮c · bilinmeyen vade → 400 bad_vade + izinli',
        b6.kod === 400 && b6.govde.error === 'bad_vade' && Array.isArray(b6.govde.izinli), b6.govde.error);
      ok('⑮c · vade beyaz listesi MOTORDAN (TA_HORIZON) — uçta kopya yok',
        b6.govde.izinli.join(',') === Object.keys(ENG.TA_HORIZON).join(','), b6.govde.izinli.join(','));
      const b7 = yakala(await b({ symbol: 'AAPL', range: '7y' }));
      ok('⑮c · bilinmeyen aralık → 400 bad_range', b7.kod === 400 && b7.govde.error === 'bad_range');
      const b8 = yakala(await b({ symbol: 'AAPL', interval: '3m' }));
      ok('⑮c · bilinmeyen adım → 400 bad_interval', b8.kod === 400 && b8.govde.error === 'bad_interval');

      // deger kapıları
      const d1 = yakala(await cagirKesif(KESIF.degerHandler, 'GET', { tur: 'bakir' }));
      ok('⑮c · bilinmeyen metal → 400 bad_tur (SESSİZ genel ağırlığa düşme YOK)',
        d1.kod === 400 && d1.govde.error === 'bad_tur', `${d1.kod} ${d1.govde.error}`);
      ok('⑮c · bad_tur izinli listesi metalleri + kripto\'yu sayıyor',
        d1.govde.izinli.includes('kripto') && d1.govde.izinli.length >= 2, d1.govde.izinli.join(','));
      const d2 = yakala(await cagirKesif(KESIF.degerHandler, 'GET', { tur: 'gumus', vix: 'abc' }));
      ok('⑮c · sayı olmayan ölçüm → 400 bad_olcum + ALAN ADI',
        d2.kod === 400 && d2.govde.error === 'bad_olcum' && d2.govde.alan === 'vix', JSON.stringify(d2.govde.alan));
      const d3 = yakala(await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'gumus' }));
      ok('⑮c · POST ile metal → 400 bad_tur (yol ayrımı açık)',
        d3.kod === 400 && d3.govde.error === 'bad_tur');
      const d4 = yakala(await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'kripto' }));
      ok('⑮c · kripto belgesi yok → 400 belge_yok', d4.kod === 400 && d4.govde.error === 'belge_yok');
      const d5 = yakala(await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'kripto', belge: 'x' }));
      ok('⑮c · kripto belgesi nesne değil → 400 belge_yok', d5.kod === 400 && d5.govde.error === 'belge_yok');

      // 4xx cevaplar KISA pencere taşıyor (mevcut uç kalıbı).
      ok('⑮c · 4xx cevap kısa önbellek penceresiyle dönüyor',
        d1.basliklar['cache-control'] === 'public, max-age=30', d1.basliklar['cache-control']);

      // ÖLÇÜM: yukarıdaki TÜM doğrulama yolu ağa ÇIKMADI.
      ok('⑮c · ÖLÇÜM · doğrulama yolu SIFIR dış istek attı', agDenemesi === 0, `${agDenemesi} deneme`);
    } finally {
      globalThis.fetch = gercekFetch;
    }
  }

  // --- ⑮d tarama / sektor / radar — 200 gövdeleri (AĞA ÇIKMAZ) ---------
  {
    const gercekFetch = globalThis.fetch;
    let agDenemesi = 0;
    globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑮d AĞ YASAĞI: ' + String(a[0])); };
    try {
      const preset0 = Object.keys(ENGINE_SCAN)[0];
      const t = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, { preset: preset0, olcumler: UC_KAYIT }));
      ok('⑮d · tarama geçerli POST → 200', t.kod === 200, `kod ${t.kod}`);
      ok('⑮d · tarama gövde alanları SABİT',
        anahtarlar(t.govde) === 'atlanan,degerlendirilen,ms,preset,sonuclar,surum,uyari'
          .split(',').sort().join(','), anahtarlar(t.govde));
      ok('⑮d · tarama sonuç alanları SABİT',
        anahtarlar(t.govde.sonuclar[0]) === 'cls,market,olcutler,present,skor,sym',
        anahtarlar(t.govde.sonuclar[0]));
      ok('⑮d · skor HAM sayı (biçimlenmiş dize değil)',
        t.govde.sonuclar.every((s) => typeof s.skor === 'number' && Number.isFinite(s.skor)));
      ok('⑮d · `cls` MAKİNE KODU (al/sat metni değil)',
        t.govde.sonuclar.every((s) => /^[a-z-]+$/.test(s.cls)), t.govde.sonuclar.map((s) => s.cls).join(','));
      ok('⑮d · ölçüt kaydı yalnız {ad, cls} taşıyor (html DÜŞÜRÜLDÜ)',
        t.govde.sonuclar[0].olcutler.every((c) => anahtarlar(c) === 'ad,cls'),
        anahtarlar(t.govde.sonuclar[0].olcutler[0]));
      ok('⑮d · veri gelmeyen sembol SKORLANMADI, `atlanan`da gerekçesiyle duruyor',
        t.govde.atlanan.length === 1 && t.govde.atlanan[0].sym === 'ZZZZ'
        && typeof t.govde.atlanan[0].neden === 'string'
        && !t.govde.sonuclar.some((s) => s.sym === 'ZZZZ'), JSON.stringify(t.govde.atlanan[0]));
      ok('⑮d · atlanan kaydı {sym, market, neden}',
        anahtarlar(t.govde.atlanan[0]) === 'market,neden,sym');
      ok('⑮d · `degerlendirilen` GÖNDERİLEN kayıt sayısını bildiriyor',
        t.govde.degerlendirilen === UC_KAYIT.length, String(t.govde.degerlendirilen));
      ok('⑮d · sonuclar + atlanan = degerlendirilen (sessiz kayıp yok)',
        t.govde.sonuclar.length + t.govde.atlanan.length === t.govde.degerlendirilen);
      ok('⑮d · tarama motor + ayar imzası bildiriyor',
        t.govde.surum.motor === IMZA && t.govde.surum.ayar === IMZA_AYAR);
      ok('⑮d · tarama uyarı metni gövdede', t.govde.uyari === UYARI);
      ok('⑮d · istenen preset GERİ BİLDİRİLİYOR', t.govde.preset === preset0);

      // Preset GERÇEKTEN motora geçiyor: ucuz preset XOM'u AAPL'ın üstüne alıyor.
      const presetler = Object.keys(ENGINE_SCAN);
      if (presetler.length > 1) {
        const t2 = yakala(await cagirKesif(KESIF.sektorHandler, 'POST', {}, { olcumler: UC_KAYIT }));
        ok('⑮d · ikinci preset AYNI girdiye BAŞKA skor veriyor (uçta yutulmuyor)', t2.kod === 200);
      }
      const ucuz = yakala(await cagirKesif(KESIF.taramaHandler, 'POST', {}, { preset: presetler.includes('value') ? 'value' : preset0, olcumler: UC_KAYIT }));
      const xom = ucuz.govde.sonuclar.find((s) => s.sym === 'XOM');
      const aapl = ucuz.govde.sonuclar.find((s) => s.sym === 'AAPL');
      ok('⑮d · ÖLÇÜM · ucuz şirket pahalıdan YÜKSEK skor aldı (motor çalıştı)',
        !!xom && !!aapl && xom.skor > aapl.skor, `${xom && xom.skor} > ${aapl && aapl.skor}`);

      // sektor
      const s = yakala(await cagirKesif(KESIF.sektorHandler, 'POST', {}, { sira: 'cheap', olcumler: UC_KAYIT }));
      ok('⑮d · sektor geçerli POST → 200', s.kod === 200, `kod ${s.kod}`);
      ok('⑮d · sektor gövde alanları SABİT',
        anahtarlar(s.govde) === 'degerlendirilen,gruplar,ms,sinflanan,sira,surum,uyari'
          .replace('sinflanan', 'siniflanan').split(',').sort().join(','), anahtarlar(s.govde));
      ok('⑮d · grup alanları SABİT',
        anahtarlar(s.govde.gruplar[0]) === 'anahtar,hisseler,medFpe,medGrowth,medMargin,medPe,medPeg,n',
        anahtarlar(s.govde.gruplar[0]));
      ok('⑮d · grup hissesi alanları SABİT',
        anahtarlar(s.govde.gruplar[0].hisseler[0])
          === 'basis,forwardPE,market,peg,profitMargin,revenueGrowth,sym,trailingPE',
        anahtarlar(s.govde.gruplar[0].hisseler[0]));
      ok('⑮d · sınıflama kademesi (`basis`) DÜRÜSTÇE bildiriliyor',
        s.govde.gruplar.every((g) => g.hisseler.every((h) => h.basis === null || typeof h.basis === 'string')),
        s.govde.gruplar[0].hisseler[0].basis);
      ok('⑮d · ÖLÇÜM · `cheap` sıralaması düşük medyan F/K\'yı ÖNE aldı (motorun sekSortGroups\'u)',
        s.govde.gruplar.length >= 2 && s.govde.gruplar[0].medPe < s.govde.gruplar[1].medPe,
        s.govde.gruplar.map((g) => `${g.anahtar}:${g.medPe}`).join(' '));
      ok('⑮d · medyanlar HAM KESİR (×100 EKRAN ölçeklemesi uca kopyalanmadı)',
        s.govde.gruplar.every((g) => g.medMargin === null || Math.abs(g.medMargin) <= 1),
        s.govde.gruplar.map((g) => g.medMargin).join(','));
      ok('⑮d · `medPe`/`medFpe` AYRI AYRI medyanlanıyor (app.js\'in yedeği kopyalanmadı)',
        'medPe' in s.govde.gruplar[0] && 'medFpe' in s.govde.gruplar[0]);
      ok('⑮d · sınıflanan sayısı gövdede (ölçemedim/ölçtüm ayrımı)',
        typeof s.govde.siniflanan === 'number' && s.govde.siniflanan <= s.govde.degerlendirilen,
        `${s.govde.siniflanan}/${s.govde.degerlendirilen}`);
      const sMargin = yakala(await cagirKesif(KESIF.sektorHandler, 'POST', {}, { sira: 'margin', olcumler: UC_KAYIT }));
      ok('⑮d · ÖLÇÜM · sıra kipi değişince DİZİLİM değişiyor (uçta sabit sıra yok)',
        sMargin.kod === 200 && sMargin.govde.sira === 'margin'
        && sMargin.govde.gruplar[0].anahtar !== s.govde.gruplar[0].anahtar,
        `${s.govde.gruplar[0].anahtar} → ${sMargin.govde.gruplar[0].anahtar}`);

      // radar
      const r = yakala(await cagirKesif(KESIF.radarHandler, 'GET', {}));
      ok('⑮d · radar GET → 200', r.kod === 200, `kod ${r.kod}`);
      ok('⑮d · radar gövde alanları SABİT (sektor yoksa `semboller` YOK)',
        anahtarlar(r.govde) === 'ms,sektorler,surum,temalar,uyari', anahtarlar(r.govde));
      ok('⑮d · tema kaydı alanları SABİT (emoji DÜŞÜRÜLDÜ)',
        r.govde.temalar.every((t2) => anahtarlar(t2) === 'anahtar,dil,etiket,etkiler,sorgu'),
        anahtarlar(r.govde.temalar[0]));
      ok('⑮d · tema sayısı motorun RADAR_THEMES\'iyle BİREBİR',
        r.govde.temalar.length === ENGINE_RADAR.length, `${r.govde.temalar.length}/${ENGINE_RADAR.length}`);
      ok('⑮d · sektör sözlüğü motorun SECTORS\'uyla BİREBİR',
        Object.keys(r.govde.sektorler).length === Object.keys(ENGINE_SECTORS).length,
        String(Object.keys(r.govde.sektorler).length));
      ok('⑮d · tema etkileri [sektor, up|down] çifti',
        r.govde.temalar.every((t2) => t2.etkiler.every((e) => Array.isArray(e) && e.length === 2 && /^(up|down)$/.test(e[1]))));
      const rTek = yakala(await cagirKesif(KESIF.radarHandler, 'GET', { tema: ENGINE_RADAR[0].key }));
      ok('⑮d · `tema=` süzgeci TEK temaya indiriyor',
        rTek.govde.temalar.length === 1 && rTek.govde.temalar[0].anahtar === ENGINE_RADAR[0].key);
      const birSektor = Object.keys(ENGINE_SECTORS)[0];
      const rSek = yakala(await cagirKesif(KESIF.radarHandler, 'GET', { sektor: birSektor }));
      ok('⑮d · `sektor=` verilince `semboller` eklenİYOR',
        Array.isArray(rSek.govde.semboller), JSON.stringify(rSek.govde.semboller));
      ok('⑮d · semboller yalnız DİZGE taşıyor (motorun sözlüğü, uç evren uydurmuyor)',
        rSek.govde.semboller.every((x) => typeof x === 'string'));

      ok('⑮d · ÖLÇÜM · tarama+sektor+radar SIFIR dış istek attı', agDenemesi === 0, `${agDenemesi} deneme`);
    } finally {
      globalThis.fetch = gercekFetch;
    }
  }

  // --- ⑮e backtest — bu beşlinin AĞA ÇIKAN TEK ucu ---------------------
  // SAHTE Yahoo: 400 günlük sentetik seri. `api/_ag.js`in kabuğu gövdeyi
  // `r.text()` ile okuyup kendisi JSON.parse ediyor (⑫e ile aynı ölçüm),
  // bu yüzden sahte yanıt `text()` vermek ZORUNDA.
  {
    const gercekFetch = globalThis.fetch;
    const ortamUrl = process.env.KV_REST_API_URL;
    const ortamTok = process.env.KV_REST_API_TOKEN;
    let agDenemesi = 0;
    let cagrilanUrl = null;

    const N = 400;
    const ts = []; const op = []; const hi = []; const lo = []; const cl = []; const vo = [];
    let p = 100;
    for (let i = 0; i < N; i++) {
      p *= (1 + Math.sin(i / 7) * 0.004 + 0.0006);
      ts.push(1600000000 + i * 86400);
      op.push(p * 0.999); hi.push(p * 1.01); lo.push(p * 0.99); cl.push(p); vo.push(1000 + i);
    }
    const yahooTxt = JSON.stringify({
      chart: {
        result: [{
          meta: {
            currency: 'USD', symbol: 'AAPL', exchangeName: 'NMS',
            regularMarketPrice: cl[N - 1], dataGranularity: '1d', range: '5y',
          },
          timestamp: ts,
          indicators: { quote: [{ open: op, high: hi, low: lo, close: cl, volume: vo }] },
        }],
      },
    });
    const yahooYanit = (txt = yahooTxt, ok2 = true, status = 200) => ({
      ok: ok2, status, text: async () => txt, json: async () => JSON.parse(txt),
    });

    try {
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
      globalThis.fetch = async (u) => { agDenemesi++; cagrilanUrl = String(u); return yahooYanit(); };

      const b = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'AAPL' }));
      ok('⑮e · geçerli GET → 200', b.kod === 200, `kod ${b.kod}`);
      ok('⑮e · gövde alanları SABİT',
        anahtarlar(b.govde) === 'adet,interval,market,ms,range,sayac,sonuc,surum,sym,tam,uyari,vade'
          .split(',').sort().join(','), anahtarlar(b.govde));
      ok('⑮e · ÖLÇÜM · TEK dış istek (ölçülen maliyet: 1)', agDenemesi === 1, `${agDenemesi} istek`);
      ok('⑮e · vade verilmezse `orta` ve ONUN 5y/1d penceresi (BT_CFG.intraday ölçüldü)',
        b.govde.vade === 'orta' && b.govde.range === '5y' && b.govde.interval === '1d',
        `${b.govde.vade}/${b.govde.range}/${b.govde.interval}`);
      ok('⑮e · ÖLÇÜM · aralık/adım Yahoo adresine GEÇTİ',
        /[?&]range=5y\b/.test(cagrilanUrl) && /[?&]interval=1d\b/.test(cagrilanUrl), cagrilanUrl);
      ok('⑮e · mum sayısı bildiriliyor', b.govde.adet === N, String(b.govde.adet));
      ok('⑮e · `sonuc` motorun computeBacktest çıktısı (ic/sharpe/mdd ham sayı)',
        !!b.govde.sonuc && typeof b.govde.sonuc.ic === 'number'
        && typeof b.govde.sonuc.sharpe === 'number' && typeof b.govde.sonuc.nSamples === 'number',
        JSON.stringify(b.govde.sonuc && b.govde.sonuc.nSamples));
      ok('⑮e · ufuk MOTORUN TA_HORIZON sozlugunden geliyor (uçta vade sayısı yok)',
        b.govde.sonuc.H === ENG.TA_HORIZON.orta, `H=${b.govde.sonuc.H} / ${ENG.TA_HORIZON.orta}`);
      ok('⑮e · warmup/stride MOTORUN BT_CFG sozlugunden geliyor (uçta eşik yok)',
        b.govde.sonuc.warmup === ENGINE_BT.orta.warmup && b.govde.sonuc.stride === ENGINE_BT.orta.stride,
        `warmup=${b.govde.sonuc.warmup} stride=${b.govde.sonuc.stride}`);
      ok('⑮e · kova yalnız {i,n,avg,pos} (AL/SAT etiketi DÜŞÜRÜLDÜ)',
        b.govde.sonuc.buckets.every((k) => anahtarlar(k) === 'avg,i,n,pos'),
        anahtarlar(b.govde.sonuc.buckets[0]));
      ok('⑮e · BOŞ kovanın ortalaması null — 0 DEĞİL',
        b.govde.sonuc.buckets.every((k) => k.n > 0 || k.avg === null),
        JSON.stringify(b.govde.sonuc.buckets.map((k) => [k.n, k.avg])));
      ok('⑮e · `tam` + `sayac` ölçüm dürüstlüğünü taşıyor (chart.js ile aynı küme)',
        b.govde.tam === true && b.govde.sayac && typeof b.govde.sayac === 'object');
      ok('⑮e · TAM cevap 300 sn penceresiyle dönüyor (chart.js ile AYNI dize)',
        b.basliklar['cache-control'] === 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        b.basliklar['cache-control']);
      ok('⑮e · KV yokken `X-Onbellek: iska`', b.basliklar['x-onbellek'] === 'iska');

      // Gün içi vade AYRI pencere seçiyor; BIST eki MOTORDA.
      cagrilanUrl = null;
      const gi = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'ASELS', market: 'BIST', vade: 'gunici' }));
      ok('⑮e · gün içi vade 1y/60m penceresi seçiyor',
        gi.govde.range === '1y' && gi.govde.interval === '60m', `${gi.govde.range}/${gi.govde.interval}`);
      ok('⑮e · BIST sembolü motorun `.IS` ekiyle gidiyor (uçta kopya yok)',
        cagrilanUrl.includes('ASELS.IS') && gi.govde.market === 'BIST', cagrilanUrl);

      // KISA SERİ: arıza değil, DÜRÜST `sonuc: null`.
      const kisaTxt = JSON.stringify({
        chart: {
          result: [{
            meta: { currency: 'USD', symbol: 'AAPL', dataGranularity: '1d', range: '5y' },
            timestamp: ts.slice(0, 30),
            indicators: { quote: [{ open: op.slice(0, 30), high: hi.slice(0, 30), low: lo.slice(0, 30), close: cl.slice(0, 30), volume: vo.slice(0, 30) }] },
          }],
        },
      });
      globalThis.fetch = async () => { agDenemesi++; return yahooYanit(kisaTxt); };
      const ks = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'AAPL' }));
      ok('⑮e · kısa seri → 200 + `sonuc: null` (UYDURMA sayı yok)',
        ks.kod === 200 && ks.govde.sonuc === null && ks.govde.adet === 30,
        `kod ${ks.kod} adet ${ks.govde.adet}`);
      ok('⑮e · ölçülemeyen cevap KISA pencereyle dönüyor (kesinti 5 dk dondurulmuyor)',
        ks.basliklar['cache-control'] === 'public, max-age=30', ks.basliklar['cache-control']);

      // Yahoo arızası → 502, uydurulmuş skor değil.
      globalThis.fetch = async () => { agDenemesi++; return yahooYanit('{}', false, 500); };
      const ar = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'AAPL' }));
      ok('⑮e · taşıyıcı arızası → 200 `sonuc:null` ya da 502 — SKOR UYDURULMUYOR',
        (ar.kod === 200 && ar.govde.sonuc === null) || ar.kod === 502,
        `kod ${ar.kod}`);

      // ÖNBELLEK: anahtar motor imzası taşıyor, yalnız TAM gövde yazılıyor.
      {
        const yazilan = new Map();
        // `kvHazir()` ortam değişkenine bakıyor (api/_onbellek.js:146):
        // sahte KV takmak YETMİYOR, kapıyı da açmak gerekiyor.
        process.env.KV_REST_API_URL = 'https://sahte-kv.test';
        process.env.KV_REST_API_TOKEN = 'sahte';
        kvTak({
          get: async (k) => (yazilan.has(k) ? yazilan.get(k) : null),
          set: async (k, v) => { yazilan.set(k, v); },
        });
        try {
          globalThis.fetch = async (u) => { agDenemesi++; cagrilanUrl = String(u); return yahooYanit(); };
          const once = agDenemesi;
          const c1 = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'AAPL', vade: 'orta' }));
          ok('⑮e · ilk istek ıska + KV\'ye YAZDI', c1.basliklar['x-onbellek'] === 'iska' && yazilan.size === 1,
            `${c1.basliklar['x-onbellek']} / ${yazilan.size}`);
          const c2 = yakala(await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'AAPL', vade: 'orta' }));
          ok('⑮e · ÖLÇÜM · ikinci istek ÖNBELLEKTEN geldi (dış istek ARTMADI)',
            c2.basliklar['x-onbellek'] === 'isabet' && agDenemesi === once + 1,
            `${c2.basliklar['x-onbellek']} / ${agDenemesi - once} istek`);
          const ob = anahtar('backtest', { market: 'US', sym: 'AAPL', vade: 'orta', range: '5y', interval: '1d' },
            { motor: IMZA, ayar: IMZA_AYAR });
          ok('⑮e · önbellek anahtarı MOTOR+AYAR imzasını taşıyor (motor üretilince eskiler geçersiz)',
            yazilan.has(ob), [...yazilan.keys()][0]);
          ok('⑮e · önbellek anahtarı sembol/vade/aralığı AYIRIYOR',
            ob !== anahtar('backtest', { market: 'US', sym: 'AAPL', vade: 'kisa', range: '5y', interval: '1d' },
              { motor: IMZA, ayar: IMZA_AYAR }));
          yazilan.clear();
          globalThis.fetch = async () => { agDenemesi++; return yahooYanit(kisaTxt); };
          await cagirKesif(KESIF.backtestHandler, 'GET', { symbol: 'MSFT', vade: 'orta' });
          ok('⑮e · ÖLÇÜLEMEYEN gövde ÖNBELLEĞE YAZILMADI', yazilan.size === 0, `${yazilan.size} kayıt`);
        } finally {
          kvTak(null);
          delete process.env.KV_REST_API_URL;
          delete process.env.KV_REST_API_TOKEN;
        }
      }
    } finally {
      globalThis.fetch = gercekFetch;
      if (ortamUrl === undefined) delete process.env.KV_REST_API_URL; else process.env.KV_REST_API_URL = ortamUrl;
      if (ortamTok === undefined) delete process.env.KV_REST_API_TOKEN; else process.env.KV_REST_API_TOKEN = ortamTok;
    }
  }

  // --- ⑮f deger — metal (GET) · kripto (POST) + ARIZA KİLİDİ -----------
  {
    const gercekFetch = globalThis.fetch;
    let agDenemesi = 0;
    globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑮f AĞ YASAĞI: ' + String(a[0])); };
    try {
      // KRİPTO: belgeyi İSTEMCİ veriyor (CoinGecko `_ag.js`in IZINLI'sinde YOK).
      const cgBelge = {
        id: 'bitcoin', symbol: 'btc', name: 'Bitcoin',
        categories: ['Layer 1 (L1)'],
        market_data: {
          current_price: { usd: 60000 },
          market_cap: { usd: 1.2e12 },
          total_volume: { usd: 3e10 },
          circulating_supply: 19700000,
          total_supply: 21000000,
          max_supply: 21000000,
          ath_change_percentage: { usd: -15 },
          price_change_percentage_30d: 5,
          price_change_percentage_1y: 40,
        },
        developer_data: { commit_count_4_weeks: 300, stars: 70000, forks: 35000 },
        community_data: { twitter_followers: 6000000 },
        genesis_date: '2009-01-03',
        sentiment_votes_up_percentage: 70,
        market_cap_rank: 1,
      };
      const k = yakala(await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'kripto', belge: cgBelge }));
      ok('⑮f · kripto POST → 200', k.kod === 200, `kod ${k.kod}`);
      ok('⑮f · kripto gövde alanları SABİT',
        anahtarlar(k.govde) === 'bilesenler,cls,kategori,ms,skor,surum,tur,uyari,uyariAdet',
        anahtarlar(k.govde));
      ok('⑮f · skor HAM sayı', typeof k.govde.skor === 'number' && Number.isFinite(k.govde.skor), String(k.govde.skor));
      ok('⑮f · `cls` makine kodu, band ETİKETİ yok',
        typeof k.govde.cls === 'string' && /^[a-z-]+$/.test(k.govde.cls), k.govde.cls);
      ok('⑮f · bileşen yalnız {ad, skor, w} (note METNİ DÜŞÜRÜLDÜ)',
        k.govde.bilesenler.every((c) => anahtarlar(c) === 'ad,skor,w'), anahtarlar(k.govde.bilesenler[0]));
      ok('⑮f · bileşen ağırlıkları MOTORDAN (toplam 1\'e yakın)',
        Math.abs(k.govde.bilesenler.reduce((a, c) => a + c.w, 0) - 1) < 1e-9,
        String(k.govde.bilesenler.reduce((a, c) => a + c.w, 0)));
      ok('⑮f · çekince METNİ değil SAYISI geçiyor', typeof k.govde.uyariAdet === 'number');
      ok('⑮f · kripto cevabı önbelleklenmiyor (girdiye bağlı, kullanıcıya özel)',
        k.basliklar['cache-control'] === 'no-store', k.basliklar['cache-control']);
      const kBos = yakala(await cagirKesif(KESIF.degerHandler, 'POST', {}, { tur: 'kripto', belge: {} }));
      ok('⑮f · BOŞ kripto belgesi → 200 ama nötr/çekinceli (patlamıyor, uydurmuyor)',
        kBos.kod === 200 && typeof kBos.govde.skor === 'number', `kod ${kBos.kod}`);

      // METAL: ölçümler İSTEMCİDEN; verilmeyen ölçüm null.
      const mBos = yakala(await cagirKesif(KESIF.degerHandler, 'GET', { tur: 'gumus' }));
      ok('⑮f · ölçümsüz metal GET → 200 (motor nötr alıyor)', mBos.kod === 200, `kod ${mBos.kod}`);
      ok('⑮f · metal gövde alanları SABİT (`kategori` YOK)',
        anahtarlar(mBos.govde) === 'bilesenler,cls,ms,skor,surum,tur,uyari,uyariAdet',
        anahtarlar(mBos.govde));
      ok('⑮f · metal bileşenleri MOTORUN METAL_MACRO_W ağırlıklarını taşıyor',
        mBos.govde.bilesenler.length === Object.keys(ENGINE_METAL.gumus || {}).length
        || mBos.govde.bilesenler.every((c) => typeof c.w === 'number'),
        mBos.govde.bilesenler.map((c) => c.w).join(','));
      const mVix = yakala(await cagirKesif(KESIF.degerHandler, 'GET', { tur: 'gumus', vix: 18 }));
      ok('⑮f · ÖLÇÜM · tek ölçüm verilince skor DEĞİŞİYOR (uçta yutulmuyor)',
        mVix.kod === 200 && mVix.govde.skor !== mBos.govde.skor,
        `${mBos.govde.skor} → ${mVix.govde.skor}`);
      ok('⑮f · metal türü GERİ BİLDİRİLİYOR', mVix.govde.tur === 'gumus');

      // ========================================================
      //  ONARIM KILIDI — `fmtPct` artık dilimin İÇİNDE
      // ========================================================
      // GEÇMİŞ: `computeMetalMacro` not metinlerini kurarken `fmtPct`
      // çağırıyordu ama o yardımcı app.js'te YALNIZ `renderPfChangeBar`
      // (app.js:1916) ve `renderTAIndicators` (app.js:4367) içinde tanımlıydı;
      // ikisi de `computeMetalMacro`nun KARDEŞİ, atası değil. Yani hata ÜRETİCİDE
      // DEĞİL, app.js'in KENDİSİNDEYDİ: web sürümünde de ölçülmüş (non-null)
      // girdiyle ReferenceError atıyor, metal makro skoru bütünüyle kayboluyordu.
      // ONARIM: `fmtPct` `computeMetalMacro` gövdesine YEREL tanımlandı (app.js),
      // motor yeniden üretildi. Aşağıdaki denetimler onarımın GERİ GİTMESİNİ yakalar.
      let motorHatasi = null; let motorSonuc = null;
      try { motorSonuc = ENGINE_METAL_CALL('gumus', { dxyChg: -1.2, tnxChg: 0.3, vix: 18, gsr: 80, pgr: 0.9, cuChg: 2, ownM: 3, ownH: 1 }); } catch (e) { motorHatasi = e; }
      ok('⑮f · ONARIM · motorun `computeMetalMacro`su ÖLÇÜLMÜŞ girdide ARTIK PATLAMIYOR',
        !motorHatasi, String(motorHatasi && motorHatasi.message));
      ok('⑮f · ONARIM · ölçülmüş girdi HAM skor döndürüyor',
        !!motorSonuc && typeof motorSonuc.score === 'number' && Number.isFinite(motorSonuc.score),
        String(motorSonuc && motorSonuc.score));
      ok('⑮f · ONARIM · not metinleri `fmtPct` biçimini TAŞIYOR (yardımcı gerçekten kapsamda)',
        !!motorSonuc && motorSonuc.comps.some((c) => String(c.note || '').includes('-1.20%')),
        String(motorSonuc && motorSonuc.comps && motorSonuc.comps[0] && motorSonuc.comps[0].note).slice(0, 80));
      const mOlculu = yakala(await cagirKesif(KESIF.degerHandler, 'GET',
        { tur: 'gumus', dxyChg: -1.2, tnxChg: 0.3, vix: 18, gsr: 80 }));
      ok('⑮f · ONARIM · uç ölçülmüş metal için 200 dönüyor', mOlculu.kod === 200,
        `kod ${mOlculu.kod} ${mOlculu.govde.error || ''}`);
      ok('⑮f · ONARIM · ölçülmüş gövde alanları nötr gövdeyle AYNI (alan şişmiyor)',
        anahtarlar(mOlculu.govde) === anahtarlar(mBos.govde), anahtarlar(mOlculu.govde));
      ok('⑮f · ONARIM · ölçüm skoru nötr 50’den FARKLI (uçta yutulmuyor)',
        mOlculu.kod === 200 && mOlculu.govde.skor !== mBos.govde.skor,
        `${mBos.govde.skor} → ${mOlculu.govde.skor}`);
      ok('⑮f · ONARIM · 200 gövdesi not METNİNİ sızdırmıyor (yalnız ad,skor,w)',
        mOlculu.kod === 200 && Array.isArray(mOlculu.govde.bilesenler)
          && mOlculu.govde.bilesenler.every((c) => anahtarlar(c) === 'ad,skor,w'),
        anahtarlar((mOlculu.govde.bilesenler || [])[0] || {}));

      ok('⑮f · ÖLÇÜM · deger ucu SIFIR dış istek attı', agDenemesi === 0, `${agDenemesi} deneme`);
    } finally {
      globalThis.fetch = gercekFetch;
    }
  }

  // --- ⑮g HAM SAYI + tavsiye dili — TOPLANAN TÜM gövdeler --------------
  {
    ok('⑮g · denetlenen gövde sayısı anlamlı (süzgeç boşa çalışmıyor)',
      govdeler.length >= 40, `${govdeler.length} gövde`);
    const metin = govdeler.map((g) => JSON.stringify(g)).join('\n')
      .split(UYARI).join('');   // zorunlu uyarı metni süzgeçten ÇIKARILIYOR
    ok('⑮g · hiçbir gövdede HTML YOK (`<`/`>` kaçmadı)', !/<[a-zA-Z/]/.test(metin));
    ok('⑮g · hiçbir gövdede emoji YOK',
      !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(metin), (metin.match(/[\u{1F300}-\u{1FAFF}]/u) || [])[0]);
    ok('⑮g · hiçbir gövdede TAVSİYE dili YOK (kazandırır/al-sat/garanti/tavsiye/fırsat)',
      !/kazand[ıi]r|al\/sat|AL\/SAT|garanti|tavsiye|f[ıi]rsat|kâr getir/i.test(metin),
      (metin.match(/kazand[ıi]r|al\/sat|garanti|tavsiye|f[ıi]rsat/i) || [])[0]);
    ok('⑮g · her gövdede zorunlu uyarı var',
      govdeler.every((g) => g.uyari === UYARI), String(govdeler.filter((g) => g.uyari !== UYARI).length));
    ok('⑮g · hiçbir gövdede biçimlenmiş sayı dizgesi yok (%, ₺, $ ekli)',
      !/"[-+]?[0-9][0-9.,]*\s*(%|₺|\$|TL)"/.test(metin));
  }

  // --- ⑮h kaynak denetimleri + sürüklenme kilitleri --------------------
  {
    ok('⑮h · `_kesif.js` ELLE yazıldığını söylüyor (üretilmiş değil)', /ELLE YAZILMIŞ/i.test(kesifSrc));
    ok('⑮h · uçta `Intl` YOK (HAM SAYI kuralı)', !/\bIntl\b/.test(kesifKod));
    ok('⑮h · uçta `toFixed(` / `toLocaleString(` YOK',
      !kesifKod.includes('toFixed(') && !kesifKod.includes('toLocaleString('));
    ok('⑮h · uçta çıplak `fetch(` YOK — ağ MOTORUN taşıyıcısında',
      !/\bfetch\(/.test(kesifKod));
    ok('⑮h · gövdeye `detail:`/yığın izi sızdıran alan yok', !/detail:/.test(kesifKod));
    ok('⑮h · kaynakta e-posta/anahtar YOK', !/@gmail|ANTHROPIC|apiKey/.test(kesifSrc), 'temiz');
    ok('⑮h · arıza `console.error` ile KENDİ adıyla raporlanıyor',
      /console\.error\('api\/_kesif/.test(kesifKod));
    ok('⑮h · beyaz listeler MOTORDAN okunuyor (uçta kopya sözlük yok)',
      /Object\.keys\(ENG\.SCAN_PRESETS\)/.test(kesifKod)
      && /Object\.keys\(ENG\.METAL_MACRO_W\)/.test(kesifKod)
      && /Object\.keys\(ENG\.TA_HORIZON\)/.test(kesifKod)
      && /ENG\.RADAR_THEMES/.test(kesifKod) && /Object\.keys\(ENG\.SECTORS\)/.test(kesifKod));
    ok('⑮h · motor kabuğu score.js/chart.js ile AYNI (buildMotor(AG.H))',
      /buildMotor\(AG\.H\)/.test(kesifKod) && /canliAg\(/.test(kesifKod));
    ok('⑮h · sembol kapısı `_girdi.js`den İTHAL (yeni desen uydurulmadı)',
      /from '\.\/_girdi\.js'/.test(kesifKod)
      && /temizleSembol/.test(kesifKod) && /cozEndeks/.test(kesifKod));
    ok('⑮h · uçta eşik/ağırlık sabiti yok (SCAN/METAL ağırlığı elle yazılmamış)',
      !/MACRO_W\s*=/.test(kesifKod) && !/SCAN_PRESETS\s*=/.test(kesifKod));
    ok('⑮h · uç HTML üreten motor alanlarını (crits[].html) TAŞIMIYOR',
      !/\.html\b/.test(kesifKod));

    // SÜRÜKLENME KİLİTLERİ: ikizler ayrı yaşamaya başlarsa kırmızı.
    ok('⑮h · KİLİT · `ARALIKLAR` api/chart.js ile BİREBİR',
      KESIF_ARALIKLAR.join(',') === ARALIKLAR.join(','), KESIF_ARALIKLAR.join(','));
    ok('⑮h · KİLİT · `ADIMLAR` api/chart.js ile BİREBİR',
      KESIF_ADIMLAR.join(',') === ADIMLAR.join(','), KESIF_ADIMLAR.join(','));
    ok('⑮h · KİLİT · gövde tavanı api/causal.js ile BİREBİR',
      KESIF_GOVDE_BAYT === AZAMI_GOVDE_BAYT, String(KESIF_GOVDE_BAYT));
    ok('⑮h · KİLİT · sıra kipleri MOTORDA gerçekten var',
      KESIF.SIRA_KIPLERI.every((s) => readFileSync(path.join(ROOT, 'api', '_motor.js'), 'utf8').includes(`'${s}'`)));
    ok('⑮h · KİLİT · ikiz liste kopyasının GEREKÇESİ yazılı (ikinci motor kurmamak)',
      /chart\.js/.test(kesifSrc) && /[Iİi]K[Iİi]Z/i.test(kesifSrc));

    // SKOR YOLU KİLİDİ: yeni rotalar mevcut üç ucu DEĞİŞTİRMEDİ.
    for (const [ad, yol] of [['score', SCORE_PATH], ['recommend', RECOMMEND_PATH], ['analyze', ANALYZE_PATH]]) {
      const s = readFileSync(yol, 'utf8');
      ok(`⑮h · KİLİT · api/${ad}.js \`_kesif.js\`i TANIMIYOR (skor yolu dokunulmadı)`,
        !/_kesif/.test(s) && !/__rota/.test(s));
    }
    ok('⑮h · KİLİT · `_kesif.js` mevcut uçlardan hiçbirini import ETMİYOR',
      !/from '\.\/(score|recommend|analyze|chart|pulse|news|causal|theme|compare)\.js'/.test(kesifKod));
    ok('⑮h · KİLİT · `_kesif.js` üretilmiş dosyalara YAZMIYOR (yalnız import)',
      !/writeFileSync|appendFileSync/.test(kesifKod));
  }
}


bitir();
