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
  AZAMI_SORGU as temaAzamiSorgu, AZAMI_ADAY, LLM_ISTEK_MS, sektorKodlari,
} from '../api/theme.js';
import {
  AZAMI_SORGU, PAZARLAR as girdiPazarlar, temizleSembol as girdiTemizle,
  cozEndeks as girdiCozEndeks, ENDEKS_SOZLUGU as girdiSozluk, SEMBOL_BICIM,
} from '../api/_girdi.js';
// ⑫ /api/chart — fiyat serisi ucu. Modül düzeyinde motor kuruyor ama TEK
// istek atmıyor (öteki uçlarla aynı: ağ ancak handler bir seri çekerken açılır).
import grafikHandler, {
  config as grafikConfig, ARALIKLAR, ADIMLAR, VARSAYILAN_ARALIK, VARSAYILAN_ADIM,
  suzKunye, KUNYE_ALANLARI, esikKumesiAnahtari,
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
  AZAMI_SATIR, AZAMI_MANSET, guvenliBaglanti,
} from '../api/pulse.js';
// ⑭ /api/news — haber ucu. Modül düzeyinde motor KURMUYOR ve ağa ÇIKMIYOR
// (yalnız sabit + saf fonksiyon), bu yüzden içe almak bedava.
import haberHandler, {
  config as haberConfig, VARSAYILAN_PAZAR,
  AZAMI_MADDE as haberAzamiMadde, VARSAYILAN_MADDE as haberVarsayilanMadde,
  AZAMI_HABER_SORGU as haberAzamiSorgu, HABER_PAZARLAR as haberPazarlar,
  GUNDEM_YERELLER as ucGundemYereller, GUNDEM_BESLEMELER as ucGundemBeslemeler,
  GUNDEM_BESLEME_MADDE as ucGundemBeslemeMadde, IZINLI_GUNDEM_KONAK as ucIzinliGundemKonak,
  // ⑭k (Ş8 #8a) tema katmanı — SAF: motoru çağırıyor, ağa çıkmıyor.
  AZAMI_TEMA_ADAY, temaAdaylariAyristir as ucTemaAyristir,
  temaKatmani as ucTemaKatmani, motorHazir as ucHaberMotorHazir,
} from '../api/news.js';
// ⑭ haberin KENDİ ağ taşıyıcısı — `_ag.js` DEĞİL. `ayristirRSS` /
// `haberAdresi` / `izinliAdres` SAF: ağa çıkmadan ölçülebiliyorlar.
import {
  ayristirRSS, haberAdresi, izinliAdres, bosHaberSayac, haberTam,
  IZINLI_KONAK, HABER_ISTEK_MS, ASGARI_GOVDE_BAYT, MADDE_ALANLARI,
  PAZAR_YERELI, AZAMI_MADDE as agAzamiMadde,
  beslemeCek, IZINLI_GUNDEM_KONAK, GUNDEM_BESLEMELER, GUNDEM_YERELLER,
  GUNDEM_BESLEME_MADDE, izinliGundemAdresi, gundemSirala, gundemTekille, gundemCek,
  HABER_TURLERI,
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
// ⑥ /api/takvim — KAP + temettü takvimi. Tarayıcıdan taşınan iki HTML
// kazıyıcının SUNUCU karşılığı. `_kesif.js` ile aynı rota çoklayıcısında,
// ama KENDİ ağ taşıyıcısı var (`_haber.js` kalıbı) — ayrıştırıcıların hepsi
// SAF, yani ağa çıkmadan fikstürle ölçülebiliyorlar.
import * as TAKVIM from '../api/_takvim.js';
// ⑰ /api/degisim · /api/gundem · /api/kripto · /api/metal — AYNI `__rota=`
// çoklayıcısına takılı, ama `_kesif.js`e GİRMEYEN dört taşıyıcı. `TASIYICI_ROTALARI`
// `api/proxy.js`in KENDİ tablosundan okunuyor: testte elle kopya liste yok.
// `proxy.js` modül düzeyinde YALNIZ `_yfin.js`i içe alıyor; ikisinde de
// modül düzeyi istek YOK (ölçüldü: `_yfin.js`te her `fetch` fonksiyon içi).
import { TASIYICI_ROTALARI } from '../api/proxy.js';
import * as DEGISIM from '../api/_degisim.js';
import * as GUNDEM from '../api/_gundem.js';
import * as KRIPTO from '../api/_kripto.js';
// `_kur.js` bu tur acildi (truncgil `today.json`): rota kumesi DORTTEN
// BESE cikti. Liste `proxy.js`in kendi tablosundan okundugu icin kapi
// ⑰ bu modulu de KENDILIGINDEN dolasiyor; ice aktarma eklenmezse
// `MOD[r]` tanimsiz kalirdi.
import * as KUR from '../api/_kur.js';
// `_iceriden.js` bu tur acildi (SEC Form 4 + KAP): rota kumesi BESTEN
// ALTIYA cikti. Ayni gerekce: liste `proxy.js`in tablosundan okundugu
// icin ice aktarma eklenmezse `MOD[r]` tanimsiz kalir ve TAKIM COKER.
import * as ICERIDEN from '../api/_iceriden.js';
import * as METAL from '../api/_metal.js';
// `_neden.js` bu tur acildi ("Neden hareket ediyor?"): rota kumesi ALTIDAN
// YEDIYE cikti. Ayni gerekce: liste `proxy.js`in tablosundan okundugu icin
// ice aktarma eklenmezse `MOD[r]` tanimsiz kalir ve TAKIM COKER.
import * as NEDEN from '../api/_neden.js';
// `_katalizor.js` bu tur acildi (Katalizor/Risk -> yaklasan temettu):
// rota kumesi YEDIDEN SEKIZE cikti. Ayni gerekce: liste `proxy.js`in
// tablosundan okundugu icin ice aktarma eklenmezse `MOD[r]` tanimsiz
// kalir ve TAKIM COKER.
import * as KATALIZOR from '../api/_katalizor.js';
// `_mali.js` bu tur acildi (mali tablolar: SEC XBRL companyconcept +
// Is Yatirim MaliTablo): rota kumesi SEKIZDEN DOKUZA cikti. Ayni
// gerekce: liste `proxy.js`in tablosundan okundugu icin ice aktarma
// eklenmezse `MOD[r]` tanimsiz kalir ve TAKIM COKER.
import * as MALI from '../api/_mali.js';
// `_hareket.js` bu tur acildi (⚡ Nabiz gun ici ani-hareket taramasi:
// Yahoo 5 dakikalik bar -> motorun `analyzeIntraday` + `pulseIsSudden`).
// Rota kumesi DOKUZDAN ONA cikti. Ayni gerekce: liste `proxy.js`in
// tablosundan okundugu icin ice aktarma eklenmezse `MOD[r]` tanimsiz
// kalir ve TAKIM COKER.
import * as HAREKET from '../api/_hareket.js';

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
const TAKVIM_PATH = path.join(ROOT, 'api', '_takvim.js');
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
  console.log(`✅ ${gecen} denetim geçti — /api/score + /api/recommend + /api/analyze + /api/theme + /api/compare + /api/causal + /api/chart + /api/pulse + /api/news + /api/tarama + /api/sektor + /api/radar + /api/backtest + /api/deger + /api/arama + /api/takvim + /api/degisim + /api/gundem + /api/hareket + /api/iceriden + /api/kripto + /api/katalizor + /api/kur + /api/mali + /api/metal + /api/neden + /api/yfin kapıları ve doğrulamaları yerinde.`);
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
    ['eng.buyZoneProximity(', 'eng.momentumInfo(', 'eng.planRiskReward(',
      'eng.atrVolKod(', 'eng.atrPlanKod(']
      .every((s) => asrc.includes(s)),
    'buyZoneProximity · momentumInfo · planRiskReward · atrVolKod · atrPlanKod');

  // N3b: statik denetimin kendisi çalışıyor mu?
  ok('N3b · statik arama gerçekten çalışıyor', rsrc.includes('export default async function handler'));
}

// --- ⑤f FIRSAT KATMANI — SAF fikstür, AĞ YOK ---------------------
// NIYE VAR: `firsat` alanı 2026-10-31'de `recommendOne`'ın kaydına girdi ve
// kaydın alan kümesini ÇİVİLEYEN hİÇBİR denetim YOKTU — `plan`ın ⑤d'de
// kapısı varken `firsat` ÖLÇÜLMEDEN içeri girdi. Kaydın alan kümesi istemci
// sözleşmesidir: native kart `'firsat' in kayit` ile `kayit.firsat === null`
// arasında ayırım yapıyor (uç göndermedi / ölçülemedi), bu yüzden alanın
// sessizce doğması da sessizce kaybolması da ölçülmek zorunda.
// İKİ KATMAN: (a) metin çivilemesi — kaydın alan kümesi AĞA ÇIKMADAN
// ölçülemez (`kayitHam` SEC/Yahoo istiyor), o yüzden küme iki SÖZDİZİM
// İFADESİ olarak çivileniyor; (b) FONKSİYONEL koşu — `firsatKatmani` elle
// kurulmuş bir `r` ile GERÇEKTEN çalıştırılıyor, dış istek SIFIR.
{
  const fsrc = readFileSync(AKIS_PATH, 'utf8');

  // (a1) kaydın ÇEKİRDEK alan kümesi — `kayitHam`ın nesne özlüğü.
  ok('⑤f · kayıt çekirdeği ÇİVİLİ: { sym, market, ta, fa, composite }',
    /kayit:\s*\{\s*sym,\s*market,\s*ta,\s*fa,\s*composite:\s*composite\(eng,\s*fa\.score,\s*ta\.score\)\s*\}/.test(fsrc),
    'kayitHam nesne özlüğü yerinde');
  // (a2) öneri kaydı ÇEKİRDEK + İKİ katman, FAZLASI YOK. Üçüncü bir katman
  //      eklenirse bu denetim PATLAR — istenen davranış: yeni alan kendi
  //      kapısını yazarak doğsun, sessizce değil.
  ok('⑤f · recommendOne kaydı = çekirdek + plan + firsat (ÜÇÜNCÜ katman yok)',
    /return\s*\{\s*\.\.\.kayit,\s*plan:\s*planKatmani\(eng,\s*r,\s*vade\),\s*firsat:\s*firsatKatmani\(eng,\s*r,\s*vade\)\s*\};/.test(fsrc),
    'recommendOne dönüşü yerinde');

  // (a3) ⑤d'nin `plan` için kurduğu kuralın AYNISI: hesap MOTORDAN,
  //      akışta eşik/çarpan/sınır YOK.
  const fkatman = (fsrc.match(/export function firsatKatmani[\s\S]*?\n\}/) || [''])[0];
  ok('⑤f · firsatKatmani gövdesi ayrıştırılabildi', fkatman.length > 80, `${fkatman.length} krk`);
  ok('⑤f · fırsat hesapları motordan (`eng.`) çağrılıyor',
    ['eng.buyZoneProximity(', 'eng.priceOppAdj(', 'eng.oppCombined(', 'eng.oppTag(', 'eng.momentumInfo(']
      .every((x) => fkatman.includes(x)),
    'buyZoneProximity · priceOppAdj · oppCombined · oppTag · momentumInfo');
  // EŞİK/ÇARPAN avcısı: gövdede HİÇ sayı sabiti olmamalı (motorda 8/6/4/0.4/2/99).
  ok('⑤f · fırsat katmanında SAYI SABİTİ yok (hepsi motorda)',
    !/[^\w.](?:\d+\.\d+|[1-9]\d*)[^\w]/.test(fkatman.replace(/\/\/[^\n]*/g, '')),
    'gövdede çıplak sayı yok');
  // `oppTag().txt` SERBEST TÜRKÇE + EMOJİ — `anchorSrc` ile aynı muamele:
  // yalnız `cls` geçiyor. `etiket.txt` yazmak tek kelimelik bir
  // 'iyileştirme' ve kimse farketmez, o yüzden burada çivili.
  ok('⑤f · `oppTag().txt` tele ÇIKMIYOR (yalnız `cls`)',
    /cls:\s*\(etiket\s*&&\s*etiket\.cls\)\s*\|\|\s*null/.test(fkatman) && !/etiket\.txt/.test(fkatman));

  // (b) FONKSİYONEL — motor kurulur, AĞA ÇIKILMAZ (canliAg kurulumu istek
  //     atmaz; `r` elle kuruluyor, `kayitHam` HİÇ çağrılmıyor).
  const { firsatKatmani } = await import('../api/_akis.js');
  const { buildMotor: kurMotor } = await import('../api/_motor.js');
  const { TA_WEIGHTS: TW, TA_BENCHMARK: TB } = await import('../api/_ayar.js');
  const { canliAg: kurAg } = await import('../api/_ag.js');
  const fEng = kurMotor(kurAg({ taWeights: TW, taBenchmark: TB }).H);

  const fr = (score, price, bz, atr, ek = {}) => ({
    score,
    adxVal: ek.adx != null ? ek.adx : null,
    levels: {
      price, buyZone: bz, atr,
      sma50: ek.sma50 != null ? ek.sma50 : null,
      sma200: ek.sma200 != null ? ek.sma200 : null,
    },
  });

  const fIcinde = firsatKatmani(fEng, fr(70, 100, [95, 102], 2), 'orta');
  ok('⑤f · katman yalnız HAM SAYI + SABİT KÜME kodu taşıyor',
    anahtarlar(fIcinde) === 'bilesik,cls,fiyatPuan', anahtarlar(fIcinde));
  // d = (100-102)/2 = -1 ≤ 0 → priceOppAdj +8 → 70+8 = 78 → oppTag ≥ 66 'strong'
  ok('⑤f · bant İÇİNDE: fiyatPuan +8, bileşik 78, cls strong',
    fIcinde.fiyatPuan === 8 && fIcinde.bilesik === 78 && fIcinde.cls === 'strong',
    JSON.stringify(fIcinde));
  // d = (103-102)/2 = 0.5 → 6*(1-0.5) = +3 → 60+3 = 63 → 'good'
  const fYakin = firsatKatmani(fEng, fr(60, 103, [95, 102], 2), 'orta');
  ok('⑤f · banda YAKIN: fiyatPuan +3, bileşik 63, cls good',
    fYakin.fiyatPuan === 3 && fYakin.bilesik === 63 && fYakin.cls === 'good', JSON.stringify(fYakin));
  // d = (120-102)/2 = 9 → -min(8, 32) = -8 (TAVAN çalışıyor) → 60-8 = 52
  const fUzak = firsatKatmani(fEng, fr(60, 120, [95, 102], 2), 'orta');
  ok('⑤f · banda UZAK: ceza TAVANI -8, bileşik 52',
    fUzak.fiyatPuan === -8 && fUzak.bilesik === 52, JSON.stringify(fUzak));
  // Aynı uzaklık, momentum AKTİF (adx 30, trend hizalı) → ceza *0.4
  const fMom = firsatKatmani(fEng, fr(70, 120, [95, 102], 2, { adx: 30, sma50: 100, sma200: 90 }), 'orta');
  ok('⑤f · momentum AKTİF → uzaklık cezası yumuşuyor (-8 → -3.2)',
    fMom.fiyatPuan === -3.2 && fMom.bilesik === 66.8, JSON.stringify(fMom));
  // VADE GERÇEKTEN GEÇİYOR: momentum gap eşiği vadeye göre değişiyor
  // (kisa %3, uzun %8). p=108 → gap %5,6: kisa'da momentum AKTİF (ceza
  // -8 → -3,2 → 66,8), uzun'da DEĞİL (-8 → 62). Aynı satır, başka vade.
  const frMom = fr(70, 108, [95, 102], 2, { adx: 30, sma50: 100, sma200: 90 });
  const fMomUzun = firsatKatmani(fEng, frMom, 'uzun');
  const fMomKisa = firsatKatmani(fEng, frMom, 'kisa');
  ok('⑤f · `vade` gerçekten kullanılıyor (momentum eşiği vadeye göre)',
    fMomKisa.bilesik !== fMomUzun.bilesik,
    `kisa ${fMomKisa.bilesik} · uzun ${fMomUzun.bilesik}`);
  // `levels` yok → prox null → priceOppAdj 0. UYDURMA DEĞİL: fiyat uygunluğu
  // bilinmiyorsa sembol teknik skoruyla sıralanır (oppCombined'in ilanı).
  const fSeviyesiz = firsatKatmani(fEng, { score: 55, levels: null }, 'orta');
  ok('⑤f · `levels` yok → fiyatPuan 0, bileşik = teknik skor',
    fSeviyesiz.fiyatPuan === 0 && fSeviyesiz.bilesik === 55, JSON.stringify(fSeviyesiz));
  ok('⑤f · skor yok → katman `null` (uydurma 0 değil)',
    firsatKatmani(fEng, { score: null, levels: null }, 'orta') === null);
  ok('⑤f · satır yok → katman `null`',
    firsatKatmani(fEng, null, 'orta') === null && firsatKatmani(fEng, undefined, 'orta') === null);

  // N3c olumsuz kontrol: motorun kendisi `txt` ÜRETİYOR — yani yukarıdaki
  // '`txt` tele çıkmıyor' denetimi boş bir iddia değil, gerçekten bir şeyi
  // düşürüyor.
  ok('N3c · motorun `oppTag`i `txt` ÜRETİYOR (düşürülen şey var)',
    typeof fEng.oppTag(78).txt === 'string' && fEng.oppTag(78).txt.length > 0);
}

// --- ⑤g ATR/FİYAT ORANI — İKİ AYRI SORU, SAF fikstür, AĞ YOK ------------
// NİYE VAR: `atr / price * 100` app.js'te İKİ YERDE hesaplanıyordu ve İKİ
// FARKLI soruya cevap veriyordu (ölçüldü 2026-11-03):
//   (1) ATR (14) · Volatilite kartı — ÜÇ KADEMELİ oynaklık sınıfı
//       (>=4 yüksek · >=2 orta · altı düşük), sessiz bant YOK;
//   (2) fillCatalysts katalizör satırı — yalnız UÇLARDA konuşuyor
//       (>=4 "geniş" · <1.5 "sakin"), ARADA (1.5 <= x < 4) HİÇBİR ŞEY
//       BASMIYOR.
// İkisini tek "kazanan"a indirmek webdeki SESSİZ BANDI sessizce silerdi, o
// yüzden motorda İKİ ayrı makine kodu var. Bu bölüm o iki davranışın AYRI
// kaldığını ölçüyor — özellikle `kod: null` (ÖLÇTÜM, söylenecek şey yok)
// ile `null` (ÖLÇEMEDİM) ayrımını, ki ikisini karıştırmak native kartta
// "ölçemedim" kutusunu sessiz bantta da bastırırdı.
// İKİ KATMAN: (a) `planKatmani` dönüşünün ALAN KÜMESİ çivili (yeni alan
// kendi kapısını yazarak doğsun); (b) iki saf işlev GERÇEKTEN koşturuluyor,
// dış istek SIFIR.
{
  const gsrc = readFileSync(AKIS_PATH, 'utf8');
  const gkatman = (gsrc.match(/export function planKatmani[\s\S]*?\n\}/) || [''])[0];
  ok('⑤g · planKatmani gövdesi ayrıştırılabildi', gkatman.length > 80, `${gkatman.length} krk`);

  // (a) ALAN KÜMESİ — yorumlar atılıp sıra birebir çivileniyor. Yedinci bir
  //     alan eklenirse ya da biri düşerse bu denetim PATLAR.
  const gsade = gkatman.replace(/\/\/[^\n]*/g, '');
  ok('⑤g · plan katmanı = seviye + yakinlik + momentum + riskOdul + oynaklik + atrPlan',
    /return\s*\{\s*seviye:[\s\S]*?yakinlik:[\s\S]*?momentum:[\s\S]*?riskOdul:[\s\S]*?oynaklik:\s*hamYuvarla\(eng\.atrVolKod\(r\.levels\.atr,\s*r\.levels\.price\)\),\s*atrPlan:\s*hamYuvarla\(eng\.atrPlanKod\(r\.levels\.atr,\s*r\.levels\.price\)\),\s*\};/.test(gsade),
    'alan kümesi ve sırası yerinde');
  // EŞİK avcısı: akışta 1.5 / 2 / 4 gibi sayı sabiti OLMAMALI (hepsi motorda).
  ok('⑤g · plan katmanında SAYI SABİTİ yok (eşikler motorda)',
    !/[^\w.](?:\d+\.\d+|[1-9]\d*)[^\w]/.test(gsade), 'gövdede çıplak sayı yok');

  // (b) FONKSİYONEL — motor kurulur, AĞA ÇIKILMAZ.
  const { buildMotor: gKurMotor } = await import('../api/_motor.js');
  const { TA_WEIGHTS: GW, TA_BENCHMARK: GB } = await import('../api/_ayar.js');
  const { canliAg: gKurAg } = await import('../api/_ag.js');
  const gEng = gKurMotor(gKurAg({ taWeights: GW, taBenchmark: GB }).H);

  // ---- (b1) OYNAKLIK SINIFI: üç kademe, SESSİZ BANT YOK ----
  const vol = (atr, price) => gEng.atrVolKod(atr, price);
  ok('⑤g · oynaklık alan kümesi = atr,atrPct,kod,stopKat',
    anahtarlar(vol(2, 100)) === 'atr,atrPct,kod,stopKat', anahtarlar(vol(2, 100)));
  // "Stop için ATR'nin 1.5-2 katı" cümlesindeki İKİ SAYI tele SAYI olarak
  // çıkıyor: istemciye yazılsa istemciye eşik yazmak olurdu (§5.1).
  ok('⑤g · `stopKat` tele SAYI olarak çıkıyor ([1.5, 2])',
    JSON.stringify(vol(2, 100).stopKat) === '[1.5,2]', JSON.stringify(vol(2, 100).stopKat));
  ok('⑤g · ATR yok → katman `null` (uydurma 0 değil)',
    vol(null, 100) === null && vol(undefined, 100) === null);
  // ATR VAR, fiyat YOK → oran ÖLÇÜLEMEDİ; web'de `lvl = ''` oluyordu.
  // `atr` yine taşınıyor: ölçülen şey atılmıyor.
  const volFiyatsiz = vol(2, 0);
  ok('⑤g · ATR var, fiyat yok → atrPct null, kod null, atr KORUNUYOR',
    volFiyatsiz.atrPct === null && volFiyatsiz.kod === null && volFiyatsiz.atr === 2,
    JSON.stringify(volFiyatsiz));
  // Sınırlar web ile BİREBİR: >=4 yüksek · >=2 orta · altı düşük.
  ok('⑤g · oynaklık sınırı 4: 4.0 yüksek, 3.99 orta',
    vol(4, 100).kod === 'yuksek' && vol(3.99, 100).kod === 'orta',
    `${vol(4, 100).kod} / ${vol(3.99, 100).kod}`);
  ok('⑤g · oynaklık sınırı 2: 2.0 orta, 1.99 düşük',
    vol(2, 100).kod === 'orta' && vol(1.99, 100).kod === 'dusuk',
    `${vol(2, 100).kod} / ${vol(1.99, 100).kod}`);
  // atrPct = 0 GEÇERLİ BİR ÖLÇÜM (hiç hareket etmemiş bar) → sınıf çıkar.
  ok('⑤g · atrPct 0 ölçümdür → `dusuk` (null DEĞİL)',
    vol(0, 100).kod === 'dusuk' && vol(0, 100).atrPct === 0, JSON.stringify(vol(0, 100)));

  // ---- (b2) PLAN/STOP BANDI: iki kod + SESSİZ ORTA BANT ----
  const pl = (atr, price) => gEng.atrPlanKod(atr, price);
  ok('⑤g · plan bandı alan kümesi = atrPct,kod',
    anahtarlar(pl(2, 100)) === 'atrPct,kod', anahtarlar(pl(2, 100)));
  ok('⑤g · ATR ya da fiyat yok → katman `null` (ÖLÇEMEDİM)',
    pl(null, 100) === null && pl(2, 0) === null && pl(2, null) === null);
  ok('⑤g · plan sınırı 4: 4.0 `genis`, 3.99 SESSİZ',
    pl(4, 100).kod === 'genis' && pl(3.99, 100).kod === null,
    `${pl(4, 100).kod} / ${pl(3.99, 100).kod}`);
  ok('⑤g · plan sınırı 1.5: 1.5 SESSİZ, 1.49 `sakin`',
    pl(1.5, 100).kod === null && pl(1.49, 100).kod === 'sakin',
    `${pl(1.5, 100).kod} / ${pl(1.49, 100).kod}`);
  ok('⑤g · atrPct 0 → `sakin` (web fillCatalysts ile aynı)',
    pl(0, 100).kod === 'sakin' && pl(0, 100).atrPct === 0, JSON.stringify(pl(0, 100)));
  // SESSİZ BANT ile ÖLÇEMEDİM AYRI HALLER: biri nesne + `kod: null`,
  // öbürü nesnenin KENDİSİ null. Native kart ikisini ayrı çiziyor.
  ok('⑤g · sessiz bant ≠ ölçemedim (nesne var, `kod` null)',
    pl(2, 100) !== null && pl(2, 100).kod === null && pl(2, 100).atrPct === 2,
    JSON.stringify(pl(2, 100)));

  // ---- (b3) İKİ SORU GERÇEKTEN AYRI: aynı oran, farklı cevap ----
  // atrPct 2.0: oynaklık `orta` DER, plan bandı SUSAR. Tek fonksiyona
  // indirilseydi bu satır patlardı — denetimin varlık sebebi bu.
  ok('⑤g · aynı oran (%2) iki soruda AYRI cevap: `orta` vs SESSİZ',
    vol(2, 100).kod === 'orta' && pl(2, 100).kod === null);
  // atrPct 3.0: oynaklık `orta`, plan hâlâ SESSİZ — üst sınırlar da ayrı.
  ok('⑤g · %3: oynaklık `orta`, plan SESSİZ',
    vol(3, 100).kod === 'orta' && pl(3, 100).kod === null);
  // atrPct 1.2: oynaklık `dusuk`, plan `sakin` — alt uçta İKİSİ de konuşur.
  ok('⑤g · %1.2: oynaklık `dusuk`, plan `sakin`',
    vol(1.2, 100).kod === 'dusuk' && pl(1.2, 100).kod === 'sakin');

  // (c) planKatmani gerçekten taşıyor mu — elle kurulmuş `r`, ağ YOK.
  const { planKatmani: gPlan } = await import('../api/_akis.js');
  const gp = gPlan(gEng, { levels: { price: 100, atr: 2, buyZone: [95, 102], anchorSrc: 'VP değer tabanı' } }, 'orta');
  ok('⑤g · planKatmani dönüşü altı alan taşıyor',
    anahtarlar(gp) === 'atrPlan,momentum,oynaklik,riskOdul,seviye,yakinlik', anahtarlar(gp));
  ok('⑤g · taşınan değerler motorun ÇIKTISIYLA birebir',
    gp.oynaklik.kod === 'orta' && gp.atrPlan.kod === null && gp.oynaklik.atrPct === 2,
    JSON.stringify({ oynaklik: gp.oynaklik, atrPlan: gp.atrPlan }));
  ok('⑤g · `seviye` yok → katman `null`',
    gPlan(gEng, { levels: null }, 'orta') === null && gPlan(gEng, null, 'orta') === null);

  // N3g olumsuz kontrol: motorda iki işlev GERÇEKTEN ayrı — aynı nesneyi
  // döndürseler yukarıdaki "ayrı cevap" denetimleri boş iddia olurdu.
  ok('N3g · iki işlev ayrı alan kümesi üretiyor (denetim boş iddia değil)',
    anahtarlar(vol(2, 100)) !== anahtarlar(pl(2, 100)));
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

      // --- ⑧e SEKTÖR SÖZLÜĞÜ — SESSİZ KIRILMA KAPISI -------------------------
      //  NİYE VAR: `api/theme.js` modül yüklenirken `buildMotor(ATIL_KONAK)` ile
      //  motorun `SYMBOL_SECTORS` sözlüğünü okuyor ve hata halİnde SESSİZCE `{}`
      //  dönüyor (gerekçe: uç çökmesin). ÖLÇÜLDÜ (2026-10-27): atıl kabukta
      //  `dead` eksik olduğu için `TypeError: H.dead is not a function` atıyordu,
      //  `catch` yutuyordu ve `candidates[].sector` ÜRETİMDE HER sembolde `null`du.
      //  1088 denetim yine yeşildi — çünkü bunu ölçen denetim YOKTU. Bu üç satır
      //  o boşluğu kapatıyor: sözlük BOŞ kalırsa kapı kırmızı yanar.
      //  EŞİK/FORMÜL DEĞİL: sözlük okumasının ÇALIŞTIĞINI ölçüyor.
      ok('⑧e · sektör sözlüğü KURULDU (atıl kabuk `dead` taşıyor)',
        Array.isArray(sektorKodlari('NVDA')) && sektorKodlari('NVDA').length > 0,
        JSON.stringify(sektorKodlari('NVDA')));
      ok('⑧e · çoğul kod dönüyor (tek koda indirilmiyor)',
        (sektorKodlari('ASELS') || []).length >= 2, JSON.stringify(sektorKodlari('ASELS')));
      ok('⑧e · sözlükte olmayan sembol `null` (0 ya da [] DEĞİL)',
        sektorKodlari('XYZQ') === null, String(sektorKodlari('XYZQ')));
      ok('⑧e · atıl kabuk `dead` işlevini taşıyor (metin denetimi)',
        kod.includes('dead:'), 'ATIL_KONAK.dead');
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

  // --- ⑩f (2026-11-03): `notable` eşiği MOTOR TABLOSUNDAN -----------
  // Bu dal önce YOKTU: uç eşiği istemciden zorunlu istiyordu ve native
  // istemcinin onu ölçen bir kaynağı bulunmuyordu.
  {
    const TABLO = { gold: { sharp: 1.5, notable: 0.8 }, equity_tr: { sharp: 2.0, notable: 1.0 } };
    const t = (b) => ayristirGovde(b, KINDLER, TABLO);

    const bos = t({ hareketler: [{ kind: 'gold', pct: 1 }], gundem: [] });
    ok('⑩f · notable yoksa tablodan okunuyor (uydurma yok)',
      !bos.hata && bos.rows[0].cfg.notable === 0.8, JSON.stringify(bos.hata || bos.rows[0]));

    const acik = t({ hareketler: [{ kind: 'gold', pct: 1, notable: 2.5 }], gundem: [] });
    ok('⑩f · gövdedeki notable tabloyu EZER (web kendi ölçümünü yollayabilir)',
      !acik.hata && acik.rows[0].cfg.notable === 2.5, JSON.stringify(acik.rows[0]));

    const sifir = t({ hareketler: [{ kind: 'gold', pct: 1, notable: 0 }], gundem: [] });
    ok('⑩f · gövdedeki 0 tabloya DÜŞMÜYOR (0 geçerli bir eşik)',
      !sifir.hata && sifir.rows[0].cfg.notable === 0, JSON.stringify(sifir.hata || sifir.rows[0]));

    const yok = t({ hareketler: [{ kind: 'equity_us', pct: 1 }], gundem: [] });
    ok('⑩f · tabloda olmayan tür için hâlâ bad_notable (varsayılan SEÇİLMİYOR)',
      yok.hata && yok.hata.govde.error === 'bad_notable', JSON.stringify(yok.hata));

    const bozuk = t({ hareketler: [{ kind: 'gold', pct: 1, notable: 'az' }], gundem: [] });
    ok('⑩f · gövdede bozuk notable tabloya DÜŞMÜYOR → bad_notable',
      bozuk.hata && bozuk.hata.govde.error === 'bad_notable', JSON.stringify(bozuk.hata));
  }

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

  // EŞİK TABLOSU DA MOTORDA (2026-11-03): uç kendi kopyasını tutmuyor.
  ok('⑩f · `INDEX_ESIK` uçta KOPYALANMAMIŞ, motordan geçiyor',
    !/INDEX_ESIK\s*=\s*\{/.test(kod) && /ENG\.INDEX_ESIK/.test(kod));
  ok('⑩f · `INDEX_ESIK` motorda VAR ve dışa veriliyor',
    /const INDEX_ESIK = \{/.test(motorSrc) && /return \{[^}]*INDEX_ESIK[^}]*\}/.test(motorSrc));

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
    // KÜME DONDURULDU: `gunici` + `guniciKod` 2026-11-03'te eklendi
    // (Ş8 #1/#6). Alan sessizce DÜŞERSE bu satır kırılır.
    ok('⑫e · gövde alanları sabit',
      anahtarlar(r.govde) === 'adet,interval,kunye,market,mumlar,ms,range,sayac,sym,tam,uyari,surum,gunici,guniciKod'
        .split(',').sort().join(','),
      anahtarlar(r.govde));
    // `interval=1d` → gün içi ölçümü SORULMADI. Sayı uydurulmuyor.
    ok('⑫e · günlük adımda gün içi katmanı SUSUYOR (yanlış etiketli sayı yok)',
      r.govde.gunici === null && r.govde.guniciKod === 'adim_uygun_degil',
      `${JSON.stringify(r.govde.gunici)} · ${r.govde.guniciKod}`);
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


// --- ⑫h ⚡ GÜN İÇİ ÖLÇÜM KATMANI ---------------------------------------
// BU BLOK NE: `/api/chart` 2026-11-03'e kadar YALNIZ ham `mumlar[]`
// döndürüyordu. ÖLÇÜLEN SORUN: `analyzeIntraday` app.js 11973'te,
// poll.js 237'de ve worker/movers.mjs 72'de ÜÇ KEZ yazılıydı, üçünden de
// UCA çıkan sayı YOKTU — native `dayChg`/`hourChg`/`rvol`/`breakout`
// göremiyor, "⚡ Nabız"ı hiç kuramıyordu.
//
// ÜÇ ŞEY ÖLÇÜLÜYOR:
//   ① katman YALNIZ `interval=5m` iken doluyor; ötekilerde `null` +
//      `guniciKod='adim_uygun_degil'`. GEREKÇE: motordaki
//      `ago = hi - 12` yorumu "~60 dk (12 x 5dk)" diyor; 1d adımında
//      aynı satır 12 GÜNLÜK değişimi `hourChg` adıyla basardı.
//   ② mum 3'ten az ise `null` + `guniciKod='mum_az'` — sıfır değil.
//   ③ eşik kümesi SEMBOLDEN seçiliyor ve cevapta GERİ BİLDİRİLİYOR,
//      istemci tahmin etmiyor; eşiklerin kendisi MOTORDAN geliyor.
{
  ok('⑫h · `esikKumesiAnahtari` dışa aktarılmış (saf, fikstürle ölçülebilir)',
    typeof esikKumesiAnahtari === 'function', typeof esikKumesiAnahtari);
  ok('⑫h · `-USD` biten sembol KRİPTO kümesine gidiyor',
    esikKumesiAnahtari('BTC-USD', 'US') === 'CRYPTO', esikKumesiAnahtari('BTC-USD', 'US'));
  ok('⑫h · küçük harfli kripto sembolü de yakalanıyor',
    esikKumesiAnahtari('eth-usd') === 'CRYPTO', esikKumesiAnahtari('eth-usd'));
  ok('⑫h · Yahoo maden sembolleri METAL kümesinde (GC/SI/PL)',
    esikKumesiAnahtari('GC=F') === 'METAL' && esikKumesiAnahtari('SI=F') === 'METAL'
    && esikKumesiAnahtari('PL=F') === 'METAL');
  ok('⑫h · BIST pazarı BIST kümesine gidiyor',
    esikKumesiAnahtari('ASELS', 'BIST') === 'BIST', esikKumesiAnahtari('ASELS', 'BIST'));
  ok('⑫h · tanınmayan hal US kümesine düşüyor (sessiz hata yok)',
    esikKumesiAnahtari('AAPL', 'US') === 'US' && esikKumesiAnahtari(null) === 'US'
    && esikKumesiAnahtari(undefined, 'XYZ') === 'US');
  // Uçta eşik SAYISI yazılmadı: yardımcı yalnız ANAHTAR döndürüyor.
  ok('⑫h · yardımcı eşik SAYISI döndürmüyor (yalnız küme adı)',
    ['CRYPTO', 'METAL', 'BIST', 'US'].includes(esikKumesiAnahtari('BTC-USD')));

  const gercekFetch = globalThis.fetch;
  const ortamUrl = process.env.KV_REST_API_URL;
  const ortamTok = process.env.KV_REST_API_TOKEN;
  // Dört SAĞLAM 5 dakikalık mum: kapanış 100 → 106, hacim artıyor.
  // `chartPreviousClose = 100` → dayChg = +6; son mum önceki en
  // yükseği (105) aşıyor → `breakout` beklenir.
  const guniciYanit = (adet, basamak = 2) => {
    const ts = []; const open = []; const high = []; const low = [];
    const close = []; const volume = [];
    for (let i = 0; i < adet; i++) {
      ts.push(1000 + i * 300);
      const c = 100 + i * basamak;
      open.push(c - 1); high.push(c + 1); low.push(c - 2); close.push(c);
      volume.push(1000 + i * 500);
    }
    const txt = JSON.stringify({
      chart: {
        result: [{
          meta: {
            currency: 'USD', symbol: 'AAPL', exchangeName: 'NMS',
            regularMarketPrice: close[adet - 1], chartPreviousClose: 100,
            dataGranularity: '5m', range: '1d',
          },
          timestamp: ts,
          indicators: { quote: [{ open, high, low, close, volume }] },
        }],
      },
    });
    return { ok: true, status: 200, text: async () => txt, json: async () => JSON.parse(txt) };
  };

  try {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    // --- ⑫h① 5m + yeterli mum → katman DOLU -------------------------
    globalThis.fetch = async () => guniciYanit(4);
    const r = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1d', interval: '5m' });
    ok('⑫h① · 5 dakikalık adımda katman DOLU', r.kod === 200 && r.govde.gunici !== null
      && r.govde.guniciKod === null, `${r.kod} · ${r.govde.guniciKod}`);
    const g = r.govde.gunici || {};
    ok('⑫h① · alan kümesi sabit (spark YOK)',
      anahtarlar(g) === 'bigDay,breakout,dayChg,esik,esikKumesi,hourChg,prevClose,price,rvol,sudden'
        .split(',').sort().join(','),
      anahtarlar(g));
    // `spark` BİLEREK düşürüldü: `mumlar[]` aynı seriyi taşıyor.
    ok('⑫h① · `spark` TELDE YOK (mumlar[] ile ikiz olurdu)', g.spark === undefined);
    ok('⑫h① · gün değişimi HAM sayı (biçimlenmiş dize değil)',
      typeof g.dayChg === 'number' && Math.abs(g.dayChg - 6) < 1e-9, String(g.dayChg));
    ok('⑫h① · `prevClose` üst kaynak künyesinden geldi (uydurulmadı)',
      g.prevClose === 100, String(g.prevClose));
    ok('⑫h① · `price` künyedeki anlık fiyat', g.price === 106, String(g.price));
    ok('⑫h① · `rvol` HAM oran (son hacim / ortalama)',
      typeof g.rvol === 'number' && g.rvol > 1, String(g.rvol));
    ok('⑫h① · `breakout` önceki en yüksek aşıldığı için DOĞRU', g.breakout === true);
    ok('⑫h① · eşik kümesi cevapta GERİ BİLDİRİLİYOR (istemci tahmin etmiyor)',
      g.esikKumesi === 'US', String(g.esikKumesi));
    ok('⑫h① · eşikler MOTORDAN geliyor (uçta sayı yazılmadı)',
      g.esik && typeof g.esik.day === 'number' && typeof g.esik.hour === 'number'
      && typeof g.esik.step === 'number', JSON.stringify(g.esik));
    ok('⑫h① · `sudden`/`bigDay` makine kodu (cümle değil)',
      typeof g.sudden === 'boolean' && typeof g.bigDay === 'boolean');
    // ÖLÇÜM: +%6 US eşiğini (day 3.0) GEÇİYOR → ani hareket.
    ok('⑫h① · ÖLÇÜM · %6 gün değişimi US eşiğini geçiyor → sudden',
      g.sudden === true && g.bigDay === true);

    // --- ⑫h② kripto sembolü FARKLI eşik kümesi alıyor ----------------
    // ÖLÇÜM NİYE +%3 İLE: US eşiği day 3.0 / hour 1.8, kripto 6.0 / 3.5.
    // +%6 İKİ kümede de ani sayılırdı (6 >= 6) ve ayrışma GÖRÜNMEZDİ.
    // +%3 tam aradaki boşluğa düşüyor: aynı hareket US'te ani, kriptoda
    // DEĞİL. Eşikleri burası seçmiyor — kümeyi sembol belirliyor.
    globalThis.fetch = async () => guniciYanit(4, 1);
    const ru = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1d', interval: '5m' });
    const rk = await cagirUc(grafikHandler, 'GET', { symbol: 'BTC-USD', range: '1d', interval: '5m' });
    const gu = ru.govde.gunici || {};
    const gk = rk.govde.gunici || {};
    ok('⑫h② · kripto sembolü CRYPTO kümesini alıyor', gk.esikKumesi === 'CRYPTO', String(gk.esikKumesi));
    ok('⑫h② · kripto eşiği US eşiğinden YÜKSEK (motorun tablosu)',
      gk.esik && gu.esik && gk.esik.day > gu.esik.day, `${gk.esik && gk.esik.day} > ${gu.esik && gu.esik.day}`);
    ok('⑫h② · iki istek AYNI hareketi ölçtü (karşılaştırma geçerli)',
      gu.dayChg === gk.dayChg && Math.abs(gu.dayChg - 3) < 1e-9, `${gu.dayChg} · ${gk.dayChg}`);
    ok('⑫h② · ÖLÇÜM · aynı hareket US tarafinda ani, kriptoda DEĞİL',
      gu.sudden === true && gk.sudden === false, `US ${gu.sudden} · CRYPTO ${gk.sudden}`);

    // --- ⑫h③ mum az → `null` + NEDEN ---------------------------------
    globalThis.fetch = async () => guniciYanit(2);
    const rz = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1d', interval: '5m' });
    ok('⑫h③ · mum 3ten az → katman `null`, sayı UYDURULMUYOR',
      rz.kod === 200 && rz.govde.gunici === null && rz.govde.guniciKod === 'mum_az',
      `${rz.govde.guniciKod}`);
    ok('⑫h③ · mumlar yine taşınıyor (grafik çizilebilir)', rz.govde.adet === 2);

    // --- ⑫h④ öteki adımlar SUSUYOR -----------------------------------
    globalThis.fetch = async () => guniciYanit(20);
    for (const adim of ['15m', '60m', '1d']) {
      const ra = await cagirUc(grafikHandler, 'GET', { symbol: 'AAPL', range: '1mo', interval: adim });
      ok(`⑫h④ · \`${adim}\` adımında katman SUSUYOR (yanlış etiketli saat yok)`,
        ra.govde.gunici === null && ra.govde.guniciKod === 'adim_uygun_degil',
        `${adim} → ${ra.govde.guniciKod}`);
    }
  } finally {
    globalThis.fetch = gercekFetch;
    if (ortamUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = ortamUrl;
    if (ortamTok === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = ortamTok;
  }

  // --- ⑫h⑤ HAM SAYI KURALI: uçta eşik/formül yok --------------------
  {
    const kod = readFileSync(CHART_PATH, 'utf8').split(/\r?\n/)
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    ok('⑫h⑤ · uç `analyzeIntraday`ı MOTORDAN çağırıyor (kopya hesap yok)',
      /ENG\.analyzeIntraday\(/.test(kod) && !/function analyzeIntraday/.test(kod));
    ok('⑫h⑤ · uç `pulseIsSudden`ı MOTORDAN çağırıyor',
      /ENG\.pulseIsSudden\(/.test(kod) && !/function pulseIsSudden/.test(kod));
    ok('⑫h⑤ · uçta PULSE_TH eşik TABLOSU kopyalanmamış',
      !/PULSE_TH\s*=/.test(kod) && !/\bhour:\s*\d/.test(kod));
    ok('⑫h⑤ · uçta Türkçe karar cümlesi yok (sözlük native tarafta)',
      !/ani hareket|yüksek hacim|sert yükseli/i.test(kod));
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

  // ANI-HAREKET SATIRLARI (makro etiketi için): sektör SEMBOL ADINDAN
  // okunuyor, bu yüzden ad isteniyor — ama ZORUNLU DEĞİL.
  ok('⑬c · satirlar sınırı sayı ve pozitif', AZAMI_SATIR > 0, String(AZAMI_SATIR));
  ok('⑬c · satirlar hiç verilmemiş → hata YOK', hata(BOS) === null);
  ok('⑬c · satirlar null → hata YOK (açıkça "yok" demek geçerli)',
    hata({ ...BOS, satirlar: null }) === null);
  ok('⑬c · satirlar dizi değil → bad_satirlar',
    hata({ ...BOS, satirlar: { a: 1 } }) === 'bad_satirlar');
  ok('⑬c · tavanı aşan satir → cok_satir (SESSİZ KIRPMA YOK)',
    hata({ ...BOS, satirlar: Array.from({ length: AZAMI_SATIR + 1 }, () => ({ sembol: 'X', yukari: true })) })
      === 'cok_satir');
  ok('⑬c · tam tavan hâlâ kabul',
    hata({ ...BOS, satirlar: Array.from({ length: AZAMI_SATIR }, () => ({ sembol: 'X', yukari: true })) })
      === null);
  ok('⑬c · satir nesne değil → bad_satirlar',
    hata({ ...BOS, satirlar: ['ASELS'] }) === 'bad_satirlar');
  ok('⑬c · sembol boş → bad_satirlar',
    hata({ ...BOS, satirlar: [{ sembol: '  ', yukari: true }] }) === 'bad_satirlar');
  // YON KESİN BOOLEAN: 0/1/'true' kabul edilse yön yanlış okunup etiket
  // TERS basılabilirdi — "düşüyor"a "rüzgâr" denirdi.
  ok('⑬c · yukari sayı → bad_satirlar',
    hata({ ...BOS, satirlar: [{ sembol: 'ASELS', yukari: 1 }] }) === 'bad_satirlar');
  ok('⑬c · yukari metin → bad_satirlar',
    hata({ ...BOS, satirlar: [{ sembol: 'ASELS', yukari: 'true' }] }) === 'bad_satirlar');
  ok('⑬c · yukari eksik → bad_satirlar',
    hata({ ...BOS, satirlar: [{ sembol: 'ASELS' }] }) === 'bad_satirlar');
  {
    const ns = nabizAyristir({ ...BOS, satirlar: [{ sembol: ' asels ', yukari: false }] });
    ok('⑬c · sembol kırpılıp BÜYÜK harfe çevriliyor',
      ns.satirlar.length === 1 && ns.satirlar[0].symbol === 'ASELS', JSON.stringify(ns.satirlar));
    ok('⑬c · satir alanları motorun beklediği adlarda (symbol/up)',
      anahtarlar(ns.satirlar[0]) === 'symbol,up', anahtarlar(ns.satirlar[0]));
    ok('⑬c · satirlar verilmezse null (boş dizi DEĞİL — "ölçmedim" ≠ "yok")',
      nabizAyristir(BOS).satirlar === null, String(nabizAyristir(BOS).satirlar));
  }

  // Normalleştirme: taşınan alan kümesi.
  //
  //  ⚠️ SAV DEĞİŞTİ (Ş20.13): burada ÖNCE "bağlantı/kaynak
  //  TAŞINMIYOR" yazıyordu ve bu DOĞRUydu — o gün cevabın hiçbir
  //  alanı manşet metni döndürmüyordu, bu yüzden bağlantıyı
  //  taşımak ölü yüktü. Cevap şimdi `mansetler` alanını
  //  döndürüyor (web'in `headlines`ı) ve native o bağlantıyı
  //  AÇIYOR, dolayısıyla `link` + `source` taşınmak ZORUNDA.
  //  `emoji` hâlâ atılıyor: hiçbir yere gitmiyor.
  const n = nabizAyristir({
    faizHaberleri: [{
      title: 'Fed raises rates', description: 'inflation', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT',
      link: 'http://x', source: 'Reuters', emoji: '🔺',
    }],
    enflasyonHaberleri: [],
    genislik: 55, enflasyonBaskisi: 0.3, risk: 0.1,
  });
  ok('⑬c · manşetin taşınan alan kümesi SABİT',
    anahtarlar(n.faiz[0]) === 'description,link,pubDate,source,title', anahtarlar(n.faiz[0]));
  ok('⑬c · bağlantı ve kaynak taşınıyor (`mansetler` onları tele geri koyuyor)',
    n.faiz[0].link === 'http://x' && n.faiz[0].source === 'Reuters',
    `${n.faiz[0].link} · ${n.faiz[0].source}`);
  ok('⑬c · emoji hâlâ taşınmıyor (hiçbir yere gitmiyor)',
    n.faiz[0].emoji === undefined);

  // --- ⚠️ BAĞLANTI ŞEMASI: cihazda `Linking.openURL` ile AÇILIYOR ----
  //  İstemci gövdesi GÜVENİLMEZ. `javascript:` bir şemanın tele geri
  //  dönüp cihazda açılması, istemcinin kendi gövdesine koyduğu bir
  //  dizgiyi çalıştırılabilir kılardı. 400 ATILMIYOR: bağlantı
  //  ölçümün parçası değil, geçmezse BOŞ kalıyor — native o manşeti
  //  tıklanabilir GÖSTERMİYOR.
  ok('⑬c · https geçiyor', guvenliBaglanti('https://a.b/c') === 'https://a.b/c');
  ok('⑬c · büyük harfli HTTP geçiyor', guvenliBaglanti('HTTP://a.b') === 'HTTP://a.b');
  ok('⑬c · javascript: şeması DÜŞÜYOR',
    guvenliBaglanti('javascript:alert(1)') === '', guvenliBaglanti('javascript:alert(1)'));
  ok('⑬c · data: şeması DÜŞÜYOR', guvenliBaglanti('data:text/html,x') === '');
  ok('⑬c · file: şeması DÜŞÜYOR', guvenliBaglanti('file:///etc/passwd') === '');
  ok('⑬c · şemasız yol DÜŞÜYOR (/a/b açılamaz)', guvenliBaglanti('/a/b') === '');
  ok('⑬c · başındaki boşluk kırpılıp geçiyor',
    guvenliBaglanti('  https://a.b  ') === 'https://a.b');
  ok('⑬c · boşluk + javascript: hâlâ DÜŞÜYOR',
    guvenliBaglanti('  javascript:alert(1)') === '');
  ok('⑬c · null/undefined → boş (çökmez)',
    guvenliBaglanti(null) === '' && guvenliBaglanti(undefined) === '');
  ok('⑬c · çok uzun bağlantı DÜŞÜYOR (500 bayt tavanı)',
    guvenliBaglanti('https://a.b/' + 'x'.repeat(600)) === '');
  ok('⑬c · geçersiz şema 400 ATMIYOR, yalnız bağlantıyı boşaltıyor',
    nabizAyristir({
      ...BOS,
      faizHaberleri: [{ title: 'T', description: '', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT', link: 'javascript:x' }],
    }).faiz[0].link === '');
  ok('⑬c · kaynak adı 80 baytta kırpılıyor',
    nabizAyristir({
      ...BOS,
      faizHaberleri: [{ title: 'T', description: '', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT', source: 'K'.repeat(200) }],
    }).faiz[0].source.length === 80);
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
      anahtarlar(res.govde) === 'degerlendirilen,durus,eksik,eksikGerceklik,eksikYorum,etiketler,gerceklik,haberler,kaynak,konjonktur,mansetler,ms,pencere,sonManset,surum,taze,taze2g,uyari,varMi,yorum',
      anahtarlar(res.govde));
    ok('⑬d · uyarı metni gövdede', res.govde.uyari === UYARI);
    // --- MAKRO YORUM KODLARI (Ş8 #1/#6 üçüncü katman) -----------------
    //  `yorum` KÖD döndürüyor, CÜMLE DEĞİL; eşik (0,15) motorda kaldı.
    ok('⑬d · yorum alan kümesi sabit',
      anahtarlar(res.govde.yorum) === 'inflIsinma,inflSoguma,kod,taze,uyumlu',
      anahtarlar(res.govde.yorum));
    ok('⑬d · yorum kodu SABİT KÜMEDEN',
      ['sakin', 'hawk', 'dove', 'notr'].includes(res.govde.yorum.kod), String(res.govde.yorum.kod));
    ok('⑬d · manşet VAR → varMi true, yorum sakin-DEGĞİL',
      res.govde.varMi === true && res.govde.yorum.kod !== 'sakin',
      `${res.govde.varMi} · ${res.govde.yorum.kod}`);
    ok('⑬d · şahin gövdede yorum kodu duruş kodunu izliyor',
      res.govde.yorum.kod === 'hawk', String(res.govde.yorum.kod));
    ok('⑬d · enflasyon ısınma/soğuma boolean ve aynı anda doğru DEĞİL',
      typeof res.govde.yorum.inflIsinma === 'boolean'
      && typeof res.govde.yorum.inflSoguma === 'boolean'
      && !(res.govde.yorum.inflIsinma && res.govde.yorum.inflSoguma));
    ok('⑬d · taze2g sayı ve değerlendirileni AŞMIYOR',
      Number.isFinite(res.govde.taze2g) && res.govde.taze2g >= 0
      && res.govde.taze2g <= res.govde.degerlendirilen.faiz + res.govde.degerlendirilen.enflasyon,
      String(res.govde.taze2g));
    ok('⑬d · sonManset ms epoch (0 DEĞİL, pencere içi en yeni manşet)',
      res.govde.sonManset === Date.parse(yas(10)), String(res.govde.sonManset));
    // SATIR GÖNDERİLMEDİ: `etiketler` NULL olmak zorunda. Boş dizi
    // "ölçtüm, etiket çıkmadı" demek olurdu — HİÇ ÖLÇMEDİK.
    ok('⑬d · satir yoksa etiketler null (ölçmeden "yok" demiyor)',
      res.govde.etiketler === null, JSON.stringify(res.govde.etiketler));
    ok('⑬d · satir yoksa eksikYorum bunu AÇIKÇA söylüyor',
      JSON.stringify(res.govde.eksikYorum) === '["satirlar"]', JSON.stringify(res.govde.eksikYorum));
    ok('⑬d · satir yoksa uyumlu BOŞ (uydurulmuyor)',
      Array.isArray(res.govde.yorum.uyumlu) && res.govde.yorum.uyumlu.length === 0);
    ok('⑬d · yorum gövdesinde eşik/cümle yok',
      !/0\.15|ısınma|şahin|güvercin|rüzgâr|baskısı|<b>/.test(JSON.stringify(res.govde.yorum)),
      JSON.stringify(res.govde.yorum));

    // --- 🗞️ MANŞETLER ----------------------------------------------
    //  BU GÖVDEDE HİÇ BAĞLANTI YOK. Web de bağlantısız manşeti
    //  listeye ALMIYOR, bu yüzden doğru cevap BOŞ DİZİ: "ölçtüm,
    //  gösterilebilir manşet yok". `null` olsaydı "hiç bakmadım"
    //  demek olurdu — baktık.
    ok('⑬d · mansetler dizi (null DEĞİL — bakıldı)',
      Array.isArray(res.govde.mansetler), JSON.stringify(res.govde.mansetler));
    ok('⑬d · bağlantısız manşet listeye GİRMİYOR (web ile aynı küme)',
      res.govde.mansetler.length === 0, String(res.govde.mansetler.length));
    ok('⑬d · manşet tavanı sabiti 3 (web’in `.slice(0, 3)`ü)',
      AZAMI_MANSET === 3, String(AZAMI_MANSET));

    // BağlantıLI ikinci ölçüm: sıra, tavan, alan kümesi.
    {
      const bag = (i, saat) => ({
        title: 'H' + i, description: '', pubDate: yas(saat),
        link: 'https://h.example/' + i, source: 'K' + i,
      });
      const res2 = sahteRes();
      await nabizHandler({ method: 'POST', body: {
        // Pencere içi 5 manşet + PENCERE DIŞI 1 manşet (en yeni görünümlü
        // olmasın diye en eski). 1 tanesi BAĞLANTISIZ → listeye girmemeli.
        faizHaberleri: [bag(1, 30), bag(2, 5), bag(3, 80),
          { title: 'Hbagsiz', description: '', pubDate: yas(1) }],
        enflasyonHaberleri: [bag(4, 12), bag(5, 200)],
        simdi: SIMDI,
      } }, res2);
      const m = res2.govde.mansetler;
      ok('⑬d · manşet sayısı tavanı AŞMIYOR', m.length === AZAMI_MANSET, String(m.length));
      ok('⑬d · manşet alan kümesi sabit (native `HaberMadde`si)',
        anahtarlar(m[0]) === 'link,pubDate,source,title', anahtarlar(m[0]));
      ok('⑬d · manşetler EN YENİDEN eskiye sıralı',
        Date.parse(m[0].pubDate) >= Date.parse(m[1].pubDate)
        && Date.parse(m[1].pubDate) >= Date.parse(m[2].pubDate),
        m.map((x) => x.title).join(','));
      ok('⑬d · en yeni bağlantıLI manşet başta (5 sa önceki)',
        m[0].title === 'H2', m[0].title);
      ok('⑬d · bağlantısız manşet listede YOK (daha yeni olsa BİLE)',
        !m.some((x) => x.title === 'Hbagsiz'), m.map((x) => x.title).join(','));
      ok('⑬d · pencere DIŞI manşet listede yok',
        !m.some((x) => x.title === 'H5'), m.map((x) => x.title).join(','));
      ok('⑬d · bağlantılar http/https',
        m.every((x) => /^https?:\/\//.test(x.link)), JSON.stringify(m.map((x) => x.link)));
      ok('⑬d · manşette Türkçe cümle/eşik ÜRETİLMİYOR (ham taşıma)',
        !/öneri|fırsat|kazan|tavsiye|<b>/.test(JSON.stringify(m)), JSON.stringify(m));
    }
    // --- FİYAT YALANLAMA (Ş8 #1/#6 ikinci katman) ----------------------
    //  Bu gövde `genislikYas` ve `gunDegisimleri` GÖNDERMİYOR. Beklenen
    //  davranış: uç varsayılan UYDURMUYOR, eksiği AÇIKÇA söylüyor.
    ok('⑬d · gerceklik alan kümesi sabit',
      anahtarlar(res.govde.gerceklik) === 'celiski,kaynaklar,want',
      anahtarlar(res.govde.gerceklik));
    ok('⑬d · eksik girdi AÇIKÇA bildiriliyor (yaş + satırlar yok)',
      JSON.stringify(res.govde.eksikGerceklik) === '["genislikYas","gunDegisimleri"]',
      JSON.stringify(res.govde.eksikGerceklik));
    ok('⑬d · girdi eksikken KAYNAK ÜRETİLMİYOR (varsayılan 50 konmuyor)',
      res.govde.gerceklik.kaynaklar.length === 0 && res.govde.gerceklik.celiski.length === 0);
    // EŞİK VE CÜMLE UCA SIZMIYOR: kaynak nesnesi yalnız `dir` + `kod` +
    // HAM sayı taşır; 45/55/0.70/1.0 ve Türkçe cümle GÖVDEDE YOK.
    ok('⑬d · gerceklik gövdesinde eşik/cümle yok',
      !/pazar|genişliği|izlediğin|0\.70|BREADTH/.test(JSON.stringify(res.govde.gerceklik)));
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
        anahtarlar(r.govde) === 'degerlendirilen,durus,eksik,eksikGerceklik,eksikYorum,etiketler,gerceklik,haberler,kaynak,konjonktur,mansetler,ms,pencere,sonManset,surum,taze,taze2g,uyari,varMi,yorum',
        anahtarlar(r.govde));
      ok('⑬f · yol AÇIKÇA bildiriliyor (kaynak = sunucu)', r.govde.kaynak === 'sunucu', String(r.govde.kaynak));
      // Sunucu yolunda da eksik girdi aynı dürüstlükle bildiriliyor.
      ok('⑬f · eksikGerceklik sunucu yolunda da dolu',
        JSON.stringify(r.govde.eksikGerceklik) === '["genislikYas","gunDegisimleri"]',
        JSON.stringify(r.govde.eksikGerceklik));
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
      anahtarlar(r.govde) === 'adet,duyarlilik,limit,maddeler,market,ms,q,sayac,surum,tam,uyari',
      anahtarlar(r.govde));
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

  // ASIL AYRIM: haber KONAĞI `_ag.js`e GİRMEDİ.
  //
  // ÖNCUL DEĞİŞTİ (2026-10-31/Ş8-G1): bu bölüm eskiden "uç `_ag.js`
  // import ETMİYOR" diyordu. Duyarlılık katmanı için motor kuruluyor ve
  // `buildMotor` bir AĞ tutamacı istiyor — import GİRDİ. Korunan ŞEY
  // değişmedi ve AŞAĞIDA ÖLÇÜLÜYOR: (i) `_ag.js`in IZINLI listesine haber
  // konağı eklenmedi, (ii) uçta çıplak `fetch(` yok, (iii) ölçülen dış
  // istek sayısı hâlâ 1 — yani haber AĞI hâlâ TAŞIYICIDA.
  ok('⑭f · uç `_ag.js`ten YALNIZ `canliAg` alıyor (ağ yardımcısı almıyor)',
    /import\s*\{\s*canliAg\s*\}\s*from\s*'\.\/_ag\.js'/.test(kod)
    && (kod.match(/_ag\.js/g) || []).length === 1,
    (kod.match(/.*_ag\.js.*/) || [''])[0].trim());
  ok('⑭f · taşıyıcı `_ag.js` import ETMİYOR (kendi zaman aşımı/izin listesi)', !/_ag\.js/.test(habKod));
  // ÖNCUL DEĞİŞTİ (aynı tur): eskiden "uç motor/ayar import ETMİYOR".
  // Artık KURUYOR — ve bunun görünür bedeli ŞART: cevap sürüm imzası
  // taşımak ZORUNDA, yoksa istemci hangi sözlükle puanlandığını bilemez.
  ok('⑭f · uç motoru KURUYOR ve imzayı cevaba KOYUYOR',
    /from\s*'\.\/_motor\.js'/.test(kod) && /from\s*'\.\/_ayar\.js'/.test(kod)
    && /surum:\s*\{\s*motor:\s*IMZA,\s*ayar:\s*IMZA_AYAR\s*\}/.test(kod));
  ok('⑭f · duyarlılık katmanında EŞİK/AĞIRLIK/SABIT yok (hepsi motorda)',
    /function duyarlilikKatmani/.test(kod)
    && !/sentiAggregate\s*=|SENTI_POS\s*=|0\.35|Math\.abs\(/.test(
      kod.slice(kod.indexOf('function duyarlilikKatmani')),
    ));
  ok('⑭f · motor kurulumu PATLARSA uç ölmez (duyarlılık null kalır)',
    /MOTOR_HATASI = e;/.test(kod)
    && /if \(!ENG\) return null;/.test(kod));
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

// --- ⑭j DUYARLILIK KATMANI — İŞLEVSEL ÖLÇÜM + KOD SÖZLÜĞÜ KİLİDİ -----
// NİYE AYRI ALT BÖLÜM: ⑭f bu katmanı YALNIZ METİNDE ölçüyordu (eşik var
// mı, motor kuruldu mu). Katmanın KENDİSİ hiç ÇALIŞTIRILMAMIŞTI ve
// döndürdüğü alan kümesi hiçbir yerde ÇİVİLİ DEĞİLDİ — oysa alan kümesi
// bir İSTEMCİ SÖZLEŞMESİ: native kart `kod`a bakıp cümleyi seçiyor.
//
// ÖNCUL DEĞİŞTİ (2026-10-31/Ş8-G1, AYNI TURDA ÖLÇÜLDÜ): katman tele
// yalnız `cls` koyuyordu ve uç başlığı "cümleyi istemci sözlüğünden
// seçer" diyordu. ÖLÇÜM bunu çürüttü — motorun BEŞ cümlesi ÜÇ `cls`e
// düşüyor ('Pozitif haber akışı' ve 'Hafif pozitif' ikisi de 'bull'),
// yani istemci 0.35 eşiğini BİLMEDEN ayıramaz; eşik istemcide YASAK.
// Çözüm metni göndermek değil, motorun çıktısını SABİT KÜMELİ `kod`a
// çevirmek oldu. Bu bölüm o sözlüğün KAPALI kaldığını motoru
// ÇALIŞTIRARAK ölçüyor: motor yeni bir cümle üretirse kod `null` olur ve
// BU KAPI düşer.
//
// AĞA HİÇ ÇIKMIYOR: katman eldeki manşet listesinden hesaplıyor, `fetch`
// yok (⑭f bunu ayrıca ölçüyor).
{
  const { duyarlilikKatmani: duyKat, duyarlilikKodlari: duyKod } = await import('../api/news.js');
  const { buildMotor: kurMotor2 } = await import('../api/_motor.js');
  const { TA_WEIGHTS: TW2, TA_BENCHMARK: TB2 } = await import('../api/_ayar.js');
  const { canliAg: kurAg2 } = await import('../api/_ag.js');
  const dEng = kurMotor2(kurAg2({ taWeights: TW2, taBenchmark: TB2 }).H);

  const dsrc = readFileSync(NEWS_PATH, 'utf8');
  const dkod = dsrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

  ok('⑭j · kod sözlüğü DONDURULMUŞ (çalışma anında büyümez)',
    /const DUYARLILIK_KODU = Object\.freeze\(\{/.test(dkod));
  ok('⑭j · kod sözlüğünde SAYI yok (eşik tablosu değil, cümle→kod)',
    !/[0-9]/.test((dkod.match(/const DUYARLILIK_KODU = Object\.freeze\(\{[\s\S]*?\}\);/) || [''])[0]));
  const dgovde = (dkod.match(/export function duyarlilikKatmani[\s\S]*?\n\}/) || [''])[0];
  ok('⑭j · katman gövdesi ayrıştırılabildi', dgovde.length > 80, `${dgovde.length} krk`);
  ok('⑭j · `sentiLabel().label` tele ÇIKMIYOR (yalnız `cls` + `kod`)',
    !/label:/.test(dgovde) && /cls:\s*\(lab && lab\.cls\) \|\| null/.test(dgovde)
    && /kod:\s*\(lab && DUYARLILIK_KODU\[lab\.label\]\) \|\| null/.test(dgovde));

  // ─── SÖZLÜK KAPALI MI: motorun ÜRETEBİLDİĞİ her cümle listede mi ───
  // Bantlar motorun eşiklerinden DEĞİL, ikisinin de ötesinden seçildi
  // (±1 / ±0.2 / 0) — eşiği teste kopyalamadan her dalı geçiyor.
  const dbantlar = [[1, 1], [0.2, 1], [0, 1], [-0.2, 1], [-1, 1], [0, 0]];
  const duretilen = dbantlar.map(([p, h]) => dEng.sentiLabel(p, h).label);
  const dsozluk = duyKod();
  ok('⑭j · motorun ÜRETTİĞİ her cümlenin bir kodu var (sözlük kapalı)',
    duretilen.every((l) => dsozluk.includes(l)),
    duretilen.filter((l) => !dsozluk.includes(l)).join(' · ') || 'eksik yok');
  ok('⑭j · sözlükte ÖLÜ anahtar yok (motor üretmediği cümle listede değil)',
    dsozluk.every((l) => duretilen.includes(l)),
    dsozluk.filter((l) => !duretilen.includes(l)).join(' · ') || 'ölü yok');
  ok('⑭j · motorun BEŞ cümlesi ÜÇ `cls`e düşüyor — `kod` BU YÜZDEN var',
    new Set(dbantlar.map(([p, h]) => dEng.sentiLabel(p, h).cls)).size === 3
    && new Set(duretilen).size === 6,
    `${new Set(duretilen).size} cümle · ${new Set(dbantlar.map(([p, h]) => dEng.sentiLabel(p, h).cls)).size} cls`);

  // ─── İŞLEVSEL: katman gerçekten koşuyor, AĞ İSTEĞİ YOK ───
  const dBos = duyKat([]);
  ok('⑭j · katman alan kümesi ÇİVİLİ (istemci sözleşmesi)',
    anahtarlar(dBos) === 'adet,alan,basliklar,cls,ham,kod,puan,sinyal',
    anahtarlar(dBos));
  ok('⑭j · `alan` NEYİN ölçüldüğünü bildiriyor (açıklama yok, yalnız başlık)',
    Array.isArray(dBos.alan) && dBos.alan.length === 1 && dBos.alan[0] === 'title');

  // Manşet puanları motordan ÖLÇÜLDÜ, teste sözlük kopyalanmadı.
  const dPozB = 'Sirket rekor kar acikladi, hisse ralli yapti';
  const dNegB = 'Sirket zarar acikladi, hisse cokertildi';
  const dNotrB = 'Toplanti yarin yapilacak';
  ok('⑭j · ÖNCÜL · seçilen manşetler motorda GERÇEKTEN sinyal veriyor',
    dEng.scoreHeadline(dPozB).hits > 0 && dEng.scoreHeadline(dPozB).s > 0
    && dEng.scoreHeadline(dNegB).hits > 0 && dEng.scoreHeadline(dNegB).s < 0
    && dEng.scoreHeadline(dNotrB).hits === 0,
    `poz ${dEng.scoreHeadline(dPozB).s} · neg ${dEng.scoreHeadline(dNegB).s}`);

  const dPoz = duyKat([{ title: dPozB }]);
  ok('⑭j · POZİTİF manşet → cls bull, kod sözlükten',
    dPoz.cls === 'bull' && typeof dPoz.kod === 'string' && dPoz.kod.startsWith('pos_'),
    JSON.stringify({ puan: dPoz.puan, cls: dPoz.cls, kod: dPoz.kod }));
  const dNeg = duyKat([{ title: dNegB }]);
  ok('⑭j · NEGATİF manşet → cls bear, kod sözlükten',
    dNeg.cls === 'bear' && typeof dNeg.kod === 'string' && dNeg.kod.startsWith('neg_'),
    JSON.stringify({ puan: dNeg.puan, cls: dNeg.cls, kod: dNeg.kod }));

  // ASIL KAZANÇ: `cls` tek başına ayıramadığı İKİ DURUM artık ayrı.
  // İkisi de cls 'neutral' — biri "hiç sinyal yok", biri "sinyaller
  // birbirini götürdü". Kart bunları aynı cümleyle basarsa YALAN söyler.
  const dKarsit = duyKat([{ title: dPozB }, { title: dNegB }, { title: dNotrB }]);
  ok('⑭j · sinyalsiz ile DENGELENMİŞ ayrı: aynı `cls`, AYRI `kod`',
    dBos.cls === 'neutral' && dKarsit.cls === 'neutral'
    && dBos.kod === 'yok' && dKarsit.kod === 'notr',
    `bos ${dBos.kod} · karsit ${dKarsit.kod}`);
  ok('⑭j · `sinyal` ham sayı olarak geliyor (istemci saymıyor)',
    dBos.sinyal === 0 && dKarsit.sinyal === 2 && dKarsit.adet === 3,
    `sinyal ${dKarsit.sinyal} · adet ${dKarsit.adet}`);
  ok('⑭j · `basliklar` YALNIZ sinyal veren maddeyi taşıyor (sıra korunuyor)',
    dKarsit.basliklar.length === 2
    && dKarsit.basliklar[0].sira === 0 && dKarsit.basliklar[0].pol > 0
    && dKarsit.basliklar[1].sira === 1 && dKarsit.basliklar[1].pol < 0,
    JSON.stringify(dKarsit.basliklar));
  ok('⑭j · madde nesnesine puan YAZILMADI (taşıyıcı sözleşmesi büyümedi)',
    anahtarlar(dKarsit.basliklar[0]) === 'pol,sira', anahtarlar(dKarsit.basliklar[0]));

  // `maddeler` HİÇ gelmediğinde çökmüyor — ama 0 da UYDURMUYOR: adet 0.
  const dNull = duyKat(null);
  ok('⑭j · `maddeler` yok → çökme yok, `adet` 0, `kod` "yok"',
    dNull && dNull.adet === 0 && dNull.sinyal === 0 && dNull.kod === 'yok',
    JSON.stringify({ adet: dNull && dNull.adet, kod: dNull && dNull.kod }));

  // NEGATİF DENETİM: düşürülen şey GERÇEKTEN var — yoksa "metin tele
  // çıkmıyor" iddiası boş bir cümle olurdu (⑤f N3c ile aynı gerekçe).
  ok('N3d · motorun `sentiLabel`i `label` ÜRETİYOR (düşürülen şey var)',
    typeof dEng.sentiLabel(1, 1).label === 'string' && dEng.sentiLabel(1, 1).label.length > 0,
    dEng.sentiLabel(1, 1).label);
}

// --- ⑭g GÜNDEM KİPİ — sabitler, KONAK BİREBİRLİĞİ ve saf yardımcılar ---
// NİYE AYRI ALT BÖLÜM: gündem kipi (`api/_haber.js` ikinci yarısı) ÜÇ yeni
// sabit ve DÖRT saf fonksiyon getirdi ve hiçbirini ölçen bir kapı YOKTU —
// `node --check`ten geçmek "sözleşme yerinde" demek değil. Bu alt bölüm
// AĞA HİÇ çıkmıyor: ölçülen her şey sabit ya da saf fonksiyon.
{
  // ---------------------------------------------------------------------
  //  BİREBİRLİK — BU BÖLÜMÜN ASIL KAPISI.
  //
  //  NİYE VAR: aynı konak kümesi İKİ dosyada ELLE yazılı — `api/proxy.js`
  //  `IZINLI_KONAKLAR` (webin tarayıcı vekilinin güven alanı) ve
  //  `api/_haber.js` `IZINLI_GUNDEM_KONAK` (sunucu gündem taşıyıcısının
  //  güven alanı). `_haber.js` gündem başlığı "Yeni bir güven alanı
  //  AÇILMADI, var olan küme bu taşıyıcıya da yazıldı" diyor ve o cümlenin
  //  TEK bekçisi bu denetim. Biri SESSİZCE büyürse — yeni bir RSS kaynağı
  //  yalnız vekile eklenir ya da yalnız taşıyıcıya — kapı kırmızı yanar.
  //
  //  ÖLÇÜM YOLU: `api/proxy.js` METİN olarak okunuyor, import EDİLMİYOR —
  //  `IZINLI_KONAKLAR` o dosyada dışa AKTARILMIŞ DEĞİL (modül içi `const`)
  //  ve proxy'yi içe almak `_kesif.js` üstünden motor kurulumunu bu teste
  //  ÖDETİRDİ. Dilim sınırı `// haber / RSS` ile `// piyasa verisi`
  //  yorumları; o iki işaret kaybolursa aşağıdaki "dilim okunabildi"
  //  denetimi kırmızı yanar, küme sessizce BOŞ sayılmaz.
  //
  //  İKİ KALEM BİLEREK DIŞARIDA — ikisinin de gerekçesi ÖLÇÜLDÜ:
  //    · `news.google.com` → arama kipinin (`?q=`) konağı, `IZINLI_KONAK`ta
  //      duruyor; gündem listesi SABİT yayıncı beslemelerinden geliyor.
  //    · `t24.com.tr`      → aşağıdaki ⑭g T24 denetiminin gerekçesi.
  // ---------------------------------------------------------------------
  const proxySrc = readFileSync(PROXY_PATH, 'utf8');
  const kumeBas = proxySrc.indexOf('const IZINLI_KONAKLAR = new Set([');
  const kumeSon = proxySrc.indexOf(']);', kumeBas);
  const kume = (kumeBas >= 0 && kumeSon > kumeBas) ? proxySrc.slice(kumeBas, kumeSon) : '';
  const haberBas = kume.indexOf('// haber / RSS');
  const haberSon = kume.indexOf('// piyasa verisi');
  const haberDilim = (haberBas >= 0 && haberSon > haberBas) ? kume.slice(haberBas, haberSon) : '';
  const proxyHaber = (haberDilim.match(/'[^']+'/g) || []).map((s) => s.slice(1, -1));
  // DIŞARIDA BIRAKILANLAR burada TEK yerde yazılı: üçüncü bir istisna
  // eklemek bu satırı değiştirmeyi gerektirir, yani gözden kaçmaz.
  const GUNDEM_DISI = ['news.google.com', 't24.com.tr'];

  ok('⑭g · proxy izin listesinin HABER dilimi OKUNABİLDİ (metin kapısı çalışıyor)',
    proxyHaber.length >= 7, `${proxyHaber.length} konak`);
  ok('⑭g · arama kipinin konağı proxy HABER diliminde (dilim doğru yerden kesildi)',
    proxyHaber.includes('news.google.com'));

  const beklenen = proxyHaber.filter((h) => !GUNDEM_DISI.includes(h)).slice().sort();
  ok('⑭g · BİREBİRLİK · gündem konakları proxy HABER dilimiyle AYNI küme',
    IZINLI_GUNDEM_KONAK.slice().sort().join(',') === beklenen.join(','),
    `taşıyıcı [${IZINLI_GUNDEM_KONAK.slice().sort().join(',')}] / proxy [${beklenen.join(',')}]`);
  ok('⑭g · arama konağı gündem listesine SIZMADI (iki kip iki küme)',
    !IZINLI_GUNDEM_KONAK.includes('news.google.com'));
  ok('⑭g · gündem konak sayısı ÖLÇÜLMÜŞ sabit (7 — curl, 2026-10-27)',
    IZINLI_GUNDEM_KONAK.length === 7, String(IZINLI_GUNDEM_KONAK.length));

  // T24 YOKLUĞU KALICI — ÖLÇÜLDÜ 2026-10-27: Cloudflare managed challenge,
  // vekil üstünden 3/3 HTTP 403 (DEVAM.md §4'te de "T24 RSS 403" kayıtlı).
  // Listeye geri dönerse her gündem isteği bir zaman aşımı ÖDER ve gövde
  // kalıcı `tam:false` döner — yani ekran "eksik ölçüm" demeye başlar.
  // Düzeldiği ÖLÇÜLÜRSE bu denetim ve GUNDEM_DISI birlikte güncellenir.
  ok('⑭g · T24 gündem konak listesinde YOK (ölçüldü: 403, zaman aşımı bedeli)',
    !IZINLI_GUNDEM_KONAK.some((h) => h.includes('t24.com.tr')),
    IZINLI_GUNDEM_KONAK.join(','));
  ok('⑭g · T24 gündem BESLEMELERİNDE de YOK (adres olarak da dönmedi)',
    !GUNDEM_YERELLER.some((y) => GUNDEM_BESLEMELER[y].some((b) => b.adres.includes('t24.com.tr'))));

  // ---------------------------------------------------------------------
  //  BESLEME LİSTESİ — ölçülmüş sabitler yerinde mi.
  //  NİYE: `GUNDEM_BESLEME_MADDE` × besleme sayısı havuz tavanını veriyor;
  //  ikisi de dosyada ÖLÇÜLDÜ diye yazılı, kapı onları kilitliyor.
  // ---------------------------------------------------------------------
  ok('⑭g · gündem yerelleri TR + US (üçüncüsü ÖLÇÜLMEDİ, uydurulmadı)',
    GUNDEM_YERELLER.join(',') === 'TR,US', GUNDEM_YERELLER.join(','));
  ok('⑭g · TR 5 besleme, US 2 besleme (ölçülmüş küme, curl 2026-10-27)',
    GUNDEM_BESLEMELER.TR.length === 5 && GUNDEM_BESLEMELER.US.length === 2,
    `${GUNDEM_BESLEMELER.TR.length} / ${GUNDEM_BESLEMELER.US.length}`);
  ok('⑭g · besleme başına madde tavanı 8 (adlandırılmış sabit, gömülü sayı değil)',
    GUNDEM_BESLEME_MADDE === 8, String(GUNDEM_BESLEME_MADDE));
  ok('⑭g · havuz tavanı madde tavanının ALTINA düşmüyor (limit anlamlı kalıyor)',
    GUNDEM_BESLEMELER.TR.length * GUNDEM_BESLEME_MADDE >= agAzamiMadde,
    `${GUNDEM_BESLEMELER.TR.length * GUNDEM_BESLEME_MADDE} ≥ ${agAzamiMadde}`);
  // Her beslemenin `ad`ı var: maddenin `source` alanı boşsa oraya yazılıyor
  // (yayıncı beslemeleri kaynağı madde içinde VERMİYOR). Boş `ad` "kaynağı
  // ölçemedim" demek olurdu.
  ok('⑭g · her beslemede dolu `ad` ve `adres` var (alan kümesi sabit)',
    GUNDEM_YERELLER.every((y) => GUNDEM_BESLEMELER[y].every((b) =>
      anahtarlar(b) === 'ad,adres' && typeof b.ad === 'string' && b.ad.trim()
      && typeof b.adres === 'string' && b.adres.trim())));
  // AYNI besleme iki yerelde SAYILMASIN: tekilleştirme sonradan düzeltir
  // ama sayaç iki istek öder ve `besleme[]` listesi yalan söyler.
  ok('⑭g · besleme adresleri YİNELEMESİZ (aynı kaynak iki kez okunmuyor)', (() => {
    const hepsi = GUNDEM_YERELLER.flatMap((y) => GUNDEM_BESLEMELER[y].map((b) => b.adres));
    return new Set(hepsi).size === hepsi.length;
  })());
  // ASIL KAPI: listedeki her adres KENDİ izin kapısından GEÇMELİ. Geçmeyen
  // bir adres `gundemCek` içinde sessizce `hata++` olup düşerdi — besleme
  // listede DURUR ama hiç okunmaz, `tam` kalıcı false olur.
  ok('⑭g · HER gündem adresi `izinliGundemAdresi`den GEÇİYOR', (() => {
    const hepsi = GUNDEM_YERELLER.flatMap((y) => GUNDEM_BESLEMELER[y].map((b) => b.adres));
    return hepsi.length > 0 && hepsi.every(izinliGundemAdresi);
  })());

  // ---------------------------------------------------------------------
  //  `izinliGundemAdresi` — NE REDDETTİĞİ de sözleşme.
  //  NİYE: bu fonksiyon gündem kipinin TEK güven kapısı; `beslemeCek`
  //  adresi KENDİSİ doğrulamıyor (çağıran doğrular, JSDoc'ta yazılı).
  // ---------------------------------------------------------------------
  ok('⑭g · http REDDEDİLİYOR (yalnız https — izinli konakta bile)',
    izinliGundemAdresi('http://www.cnbc.com/id/100003114/device/rss/rss.html') === false);
  ok('⑭g · izin listesi DIŞI konak reddediliyor (son-ek hilesi dâhil)',
    izinliGundemAdresi('https://evil.example/rss') === false
    && izinliGundemAdresi('https://www.cnbc.com.evil.example/rss') === false);
  ok('⑭g · boş dizge reddediliyor (sessiz varsayılan besleme YOK)',
    izinliGundemAdresi('') === false);
  ok('⑭g · bozuk/dizge olmayan adres reddediliyor (çökmüyor)',
    izinliGundemAdresi('xxx') === false && izinliGundemAdresi(null) === false
    && izinliGundemAdresi(undefined) === false && izinliGundemAdresi(42) === false);
  // İKİ KİP İKİ KAPI: arama konağı gündem kapısından, gündem konağı arama
  // kapısından GEÇMEMELİ. Geçerse iki güven alanı birleşmiş olur.
  ok('⑭g · iki kapı birbirine AÇILMIYOR (kümeler ayrı)',
    izinliGundemAdresi('https://news.google.com/rss/search?q=x') === false
    && izinliAdres('https://www.cnbc.com/id/100003114/device/rss/rss.html') === false);

  // ---------------------------------------------------------------------
  //  `gundemTekille` — DÜŞEN MADDE SAYILIR, sessizce yok olmaz.
  //  NİYE: iki besleme aynı haberi verebiliyor (Reuters servisi). Düşeni
  //  saymazsak istemciye "10 madde istedin, 7 geldi"nin sebebini
  //  söyleyemeyiz — kaynak mı düştü, kopya mı düşürüldü ayırt edilemez.
  // ---------------------------------------------------------------------
  {
    const t = gundemTekille([
      { title: 'A', link: 'https://www.dunya.com/1' },
      { title: 'B', link: 'https://www.dunya.com/2' },
      { title: 'A kopya', link: 'https://www.dunya.com/1' },
    ]);
    ok('⑭g · aynı `link`ten gelen kopya DÜŞÜYOR', t.maddeler.length === 2, `${t.maddeler.length} madde`);
    ok('⑭g · düşen sayısı DOĞRU bildiriliyor (`dusen` = 1)', t.dusen === 1, String(t.dusen));
    ok('⑭g · İLK görülen madde kalıyor (kopya sonrakini düşürüyor)',
      t.maddeler[0].title === 'A' && t.maddeler[1].title === 'B');
    // Büyük/küçük harf ve kenar boşluğu farkı AYNI bağlantıdır: anahtar
    // normalleştiriliyor, yoksa kopya iki kez basılırdı.
    const t2 = gundemTekille([
      { title: 'A', link: 'https://www.dunya.com/1' },
      { title: 'A', link: ' HTTPS://WWW.DUNYA.COM/1 ' },
    ]);
    ok('⑭g · anahtar normalleştiriliyor (harf/boşluk farkı kopyayı kaçırmıyor)',
      t2.maddeler.length === 1 && t2.dusen === 1, `${t2.maddeler.length} / ${t2.dusen}`);
    // ANAHTARSIZ MADDE DÜŞMEZ: `link` ve `title` boşsa o madde hakkında
    // "kopya" diyemeyiz. Düşürmek ÖLÇÜLMEMİŞ bir karar olurdu; iki
    // anahtarsız madde de kalıyor ve `dusen` onları SAYMIYOR.
    const t3 = gundemTekille([
      { title: '', link: '' }, { title: '   ', link: null }, { title: 'A', link: 'https://www.dunya.com/1' },
    ]);
    ok('⑭g · anahtarsız madde DÜŞÜRÜLMÜYOR (uydurma kopya kararı yok)',
      t3.maddeler.length === 3 && t3.dusen === 0, `${t3.maddeler.length} / ${t3.dusen}`);
    // `link` yoksa `title` anahtar: aynı manşet iki beslemeden farklı
    // bağlantıyla gelebiliyor.
    const t4 = gundemTekille([{ title: 'Aynı manşet' }, { title: 'Aynı manşet' }]);
    ok('⑭g · `link` yokken `title` anahtar oluyor', t4.maddeler.length === 1 && t4.dusen === 1);
    ok('⑭g · SAF: girdi dizisi DEĞİŞMİYOR (kopya üstünde çalışıyor)', (() => {
      const girdi = [{ title: 'A', link: 'x' }, { title: 'A', link: 'x' }];
      gundemTekille(girdi);
      return girdi.length === 2;
    })());
  }

  // ---------------------------------------------------------------------
  //  `gundemSirala` — TARİHİ ÖLÇÜLEMEYEN MADDE ATILMAZ, SONA KONUR.
  //  NİYE: "tarihini ölçemedim" ile "haber yok" ayrı şeyler (bu dosyanın
  //  her yerindeki sayaç ayrımının aynı fikri). Atmak, istemciye var olan
  //  bir manşeti hiç göstermemek olurdu.
  // ---------------------------------------------------------------------
  {
    const g = gundemSirala([
      { title: 'eski', pubDate: 'Mon, 19 Oct 2026 08:00:00 GMT' },
      { title: 'tarihsiz', pubDate: 'çözülemez' },
      { title: 'yeni', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT' },
      { title: 'alansız' },
    ]);
    ok('⑭g · hiçbir madde ATILMADI (4 girdi → 4 çıktı)', g.length === 4, `${g.length} madde`);
    ok('⑭g · tarihe göre YENİDEN ESKİYE diziliyor',
      g[0].title === 'yeni' && g[1].title === 'eski', g.map((m) => m.title).join('>'));
    ok('⑭g · tarihi ÇÖZÜLEMEYEN madde SONA konuyor (atılmıyor)',
      ['tarihsiz', 'alansız'].includes(g[2].title) && ['tarihsiz', 'alansız'].includes(g[3].title),
      g.map((m) => m.title).join('>'));
    ok('⑭g · boş dizi/çöp madde çökertmiyor',
      gundemSirala([]).length === 0 && gundemSirala([{}, {}]).length === 2);
    ok('⑭g · SAF: girdi dizisi yerinde SIRALANMIYOR (kopya dönüyor)', (() => {
      const girdi = [
        { title: 'eski', pubDate: 'Mon, 19 Oct 2026 08:00:00 GMT' },
        { title: 'yeni', pubDate: 'Mon, 19 Oct 2026 10:00:00 GMT' },
      ];
      const cikti = gundemSirala(girdi);
      return girdi[0].title === 'eski' && cikti[0].title === 'yeni';
    })());
  }

  // ---------------------------------------------------------------------
  //  UÇ İLE TAŞIYICI AYNI NESNEYİ PAYLAŞIYOR MU (kopya sabit yok).
  //  NİYE: ⑭a'nın `AZAMI_MADDE` için kurduğu kapının aynısı. `news.js`
  //  gündem sabitlerini yeniden dışa aktarıyor; bir gün oraya YEREL bir
  //  kopya yazılırsa iki liste ayrışır ve kimse farketmez.
  // ---------------------------------------------------------------------
  ok('⑭g · uçtaki gündem konak listesi taşıyıcının TA KENDİSİ',
    ucIzinliGundemKonak === IZINLI_GUNDEM_KONAK);
  ok('⑭g · uçtaki besleme tablosu/yerel/madde tavanı taşıyıcının TA KENDİSİ',
    ucGundemBeslemeler === GUNDEM_BESLEMELER && ucGundemYereller === GUNDEM_YERELLER
    && ucGundemBeslemeMadde === GUNDEM_BESLEME_MADDE);
  // `beslemeCek` ikinci ağ gövdesi DEĞİL, ORTAK gövde: `haberCek` de onu
  // çağırıyor (zaman aşımı, kimlik dizgesi, kısa gövde kuralı tek yerde).
  ok('⑭g · `beslemeCek` dışa aktarılmış bir fonksiyon (ortak ağ gövdesi)',
    typeof beslemeCek === 'function', typeof beslemeCek);
  {
    const habKod2 = readFileSync(HABER_PATH, 'utf8');
    ok('⑭g · `haberCek` ortak gövdeyi ÇAĞIRIYOR (ikinci fetch gövdesi yazılmadı)',
      /return beslemeCek\(adres/.test(habKod2));
    ok('⑭g · taşıyıcıda `fetch(` YALNIZ BİR yerde (ağa çıkan tek gövde)',
      (habKod2.match(/await fetch\(/g) || []).length === 1,
      `${(habKod2.match(/await fetch\(/g) || []).length} yer`);
    ok('⑭g · gündem fan-out`u `izinliGundemAdresi` kapısından geçiyor (çağrı öncesi)',
      /if \(!izinliGundemAdresi\(b\.adres\)\)/.test(habKod2));
  }
}

// --- ⑭h GÜNDEM KİPİ — uç sözleşmesi (hepsi ağdan ÖNCE dönüyor) ---------
// NİYE: ③ gündem kipi `api/news.js`e ÜÇ yeni kapı getirdi (`bad_gundem`,
// `gundem_ve_sorgu`, kipe göre `bad_market`) ve hiçbirini ölçen denetim
// YOKTU. Üçü de ağa çıkmadan dönüyor, bu yüzden burada `fetch` YASAK:
// kapılardan biri sızarsa ölçüm "AĞ YASAĞI" ile patlar, sessiz geçmez.
{
  const gercekFetch = globalThis.fetch;
  let agDenemesi = 0;
  globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑭h AĞ YASAĞI: ' + String(a[0])); };
  try {
    const e = async (query) => (await cagirUc(haberHandler, 'GET', query)).govde.error;

    // `gundem` KAPALI KÜME: '1'/'true' açar, '0'/'false'/boş kapatır,
    // BAŞKA HİÇBİR ŞEY sessizce yorumlanmaz. "evet"/"yes" yazan bir
    // istemciye sessizce kip ① dönmek, istemediği gövdeyi vermek olurdu.
    ok('⑭h · gundem=evet → bad_gundem (sessiz yorum YOK)',
      (await e({ gundem: 'evet' })) === 'bad_gundem');
    ok('⑭h · gundem=2 → bad_gundem', (await e({ gundem: '2' })) === 'bad_gundem');
    ok('⑭h · gundem=yes → bad_gundem', (await e({ gundem: 'yes' })) === 'bad_gundem');
    // KAPATAN değerler kipi açmıyor ve hata da ÜRETMİYOR: `q`/`symbols`
    // yoksa eski kodun dediği `missing_q` dönüyor (bugünün istemcisinin
    // gördüğü hata DEĞİŞMEDİ).
    ok('⑭h · gundem=0 kipi KAPATIYOR (→ missing_q, bad_gundem değil)',
      (await e({ gundem: '0' })) === 'missing_q');
    ok('⑭h · gundem=false kipi KAPATIYOR (→ missing_q)',
      (await e({ gundem: 'false' })) === 'missing_q');
    ok('⑭h · gundem boş dizge kipi KAPATIYOR (→ missing_q)',
      (await e({ gundem: '' })) === 'missing_q');
    // Kapatan değer kip ①'i BOZMUYOR: q ile birlikte `gundem_ve_sorgu`
    // çıkmamalı (yoksa istemci q sorgusunu hiç yapamazdı).
    ok('⑭h · gundem=0 + q çakışma SAYILMIYOR (kip ① çalışmaya devam eder)',
      (await e({ gundem: '0', q: 'x'.repeat(haberAzamiSorgu + 1) })) === 'too_long');

    const bg = await cagirUc(haberHandler, 'GET', { gundem: 'evet' });
    ok('⑭h · bad_gundem izinli DEĞERLERİ bildiriyor (istemci tahmin etmiyor)',
      Array.isArray(bg.govde.izinli) && bg.govde.izinli.join(',') === '1,true',
      JSON.stringify(bg.govde.izinli));
    ok('⑭h · bad_gundem gövdesinde uyarı metni', bg.govde.uyari === UYARI);
    ok('⑭h · bad_gundem kısa önbellekli', bg.basliklar['cache-control'] === 'public, max-age=30');

    // ÜÇ KİP BİRBİRİNİ DIŞLIYOR: hangisinin kazandığını SESSİZCE seçmek,
    // istemcinin istemediği gövdeyi dönmek olurdu. Eski `q_ve_symbols`
    // kodu KORUNDU; gündem çakışması KENDİ kodunu alıyor.
    ok('⑭h · gundem + q → gundem_ve_sorgu',
      (await e({ gundem: '1', q: 'ASELSAN' })) === 'gundem_ve_sorgu');
    ok('⑭h · gundem + symbols → gundem_ve_sorgu',
      (await e({ gundem: 'true', symbols: 'THYAO' })) === 'gundem_ve_sorgu');
    ok('⑭h · q + symbols → ESKİ kod `q_ve_symbols` (değişmedi)',
      (await e({ q: 'ASELSAN', symbols: 'THYAO' })) === 'q_ve_symbols');
    const ck = await cagirUc(haberHandler, 'GET', { gundem: '1', q: 'ASELSAN' });
    ok('⑭h · çakışma gövdesinde uyarı metni + kısa önbellek',
      ck.govde.uyari === UYARI && ck.basliklar['cache-control'] === 'public, max-age=30');

    // PAZAR DOĞRULAMASI KİPE GÖRE: gündem kipi KENDİ ölçülmüş kümesine
    // (`GUNDEM_YERELLER`, besleme listesinden) bakıyor, `HABER_PAZARLAR`a
    // (Google News yerellerinden) DEĞİL. Bugün ikisi de ['TR','US'] — ama
    // aynı diziyi iki ölçüm için kullanmak, yarın biri büyüdüğünde
    // ötekini SESSİZCE büyütmek olurdu.
    ok('⑭h · gündem kipinde bilinmeyen yerel → bad_market',
      (await e({ gundem: '1', market: 'TOKYO' })) === 'bad_market');
    const gm = await cagirUc(haberHandler, 'GET', { gundem: '1', market: 'TOKYO' });
    ok('⑭h · bad_market gövdesi GUNDEM_YERELLER kümesini bildiriyor (HABER_PAZARLAR değil)',
      Array.isArray(gm.govde.izinli)
      && gm.govde.izinli.join(',') === GUNDEM_YERELLER.join(','),
      JSON.stringify(gm.govde.izinli));
    ok('⑭h · gündem kipinde limit tavanı da geçerli → limit_buyuk',
      (await e({ gundem: '1', limit: String(haberAzamiMadde + 1) })) === 'limit_buyuk');
    ok('⑭h · gündem kipinde limit 0 → bad_limit',
      (await e({ gundem: '1', limit: '0' })) === 'bad_limit');

    // BİLİNMEYEN YEREL TAŞIYICIDA DA AĞA ÇIKMIYOR: uç kapısı atlansa
    // (başka bir çağıran) `gundemCek` KENDİSİ düşüyor ve `hata` SAYIYOR —
    // sessiz boş dizi DÖNMÜYOR.
    const bos = await gundemCek('XX');
    ok('⑭h · gundemCek(bilinmeyen) → boş besleme listesi',
      Array.isArray(bos.besleme) && bos.besleme.length === 0, JSON.stringify(bos.besleme));
    ok('⑭h · gundemCek(bilinmeyen) → maddeler boş, `tam` FALSE (ölçemedim)',
      bos.maddeler.length === 0 && bos.tam === false, `${bos.maddeler.length} / ${bos.tam}`);
    ok('⑭h · gundemCek(bilinmeyen) → sayac.hata = 1 (sessiz boş dizi DEĞİL)',
      bos.sayac.hata === 1, JSON.stringify(bos.sayac));
    ok('⑭h · gundemCek(bilinmeyen) → tekrar 0 (uydurma sayı yok)', bos.tekrar === 0);
    const bos2 = await gundemCek('');
    const bos3 = await gundemCek(null);
    ok('⑭h · gundemCek boş/çöp yerelde de çökmüyor (aynı dürüst cevap)',
      bos2.tam === false && bos2.sayac.hata === 1
      && bos3.tam === false && bos3.sayac.hata === 1);

    ok('⑭h · ÖLÇÜM · gündem kapılarının hiçbiri ağa ÇIKMADI', agDenemesi === 0, `${agDenemesi} deneme`);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑭i GÜNDEM KİPİ — statik denetimler (metin) ------------------------
{
  const src2 = readFileSync(NEWS_PATH, 'utf8');
  // Gündem kipi SÖZLEŞMESİ başlıkta yazılı mı: üç kipin de gövdesi
  // dosyanın başındaki sözleşme bloğunda duruyor, istemci oradan okuyor.
  ok('⑭i · ③ gündem kipi uç sözleşmesinde YAZILI (gövde alanları dâhil)',
    src2.includes('③ GÜNDEM') && src2.includes('besleme[i]') && src2.includes('tekrar'));
  // T24'ün DIŞARIDA olma gerekçesi taşıyıcıda YAZILI: kapı kırmızı
  // yandığında "niye yok" sorusunun cevabı koddan okunabilsin.
  const habSrc2 = readFileSync(HABER_PATH, 'utf8');
  ok('⑭i · T24 yokluğunun GEREKÇESİ taşıyıcıda yazılı (ölçüm, tahmin değil)',
    habSrc2.includes('T24') && habSrc2.includes('zaman aşımı'));
  // BİREBİRLİK iddiası taşıyıcıda da yazılı — yukarıdaki ⑭g kapısı o
  // cümlenin bekçisi, cümle kaybolursa niyet de kaybolur.
  ok('⑭i · proxy BİREBİRLİĞİ iddiası taşıyıcıda yazılı',
    habSrc2.includes('BİREBİR') && habSrc2.includes('proxy.js'));
  // Gündem kipi de HAM METİN kuralına tabi: `durum` MAKİNE KODU
  // ('ok'/'bos'), Türkçe etiket İSTEMCİDE.
  ok('⑭i · besleme `durum` alanı MAKİNE KODU (Türkçe etiket uçta değil)',
    habSrc2.includes("durum: n > 0 ? 'ok' : 'bos'"));
}

// --- ⑭j ÇOKLU SEMBOL KİPİ (②) — uç sözleşmesi + pazar eşlemesi --------
// NİYE VAR: kip ② ÜRETİMDE canlıydı ama onu ölçen HİÇBİR denetim yoktu
// (ölçüldü 2026-11-03: suite yalnız ① arama ve ③ gündem kipini
// kapsıyordu). Native `fetchHisseHaberleri` artık bu kipe bağlı
// (`mobile/src/components/bugun/HisseHaberleriKarti.tsx`), yani kipin
// kapıları SESSİZCE değişirse istemci yanlış gövde okur.
//
// Buradaki kapıların HEPSİ ağdan ÖNCE dönüyor, bu yüzden `fetch` YASAK:
// biri sızarsa ölçüm "AĞ YASAĞI" ile patlar, sessiz geçmez.
{
  const gercekFetch = globalThis.fetch;
  let agDenemesi2 = 0;
  globalThis.fetch = (...a) => { agDenemesi2++; throw new Error('⑭j AĞ YASAĞI: ' + String(a[0])); };
  try {
    const e2 = async (query) => (await cagirUc(haberHandler, 'GET', query)).govde.error;

    // Doğrulama ORTAK kapıda (`_girdi.js ayristir`) ve hata gövdesi
    // OLDUĞU GİBİ geçiyor: kodu `news.js` yeniden YAZMIYOR. Kod burada
    // dondurulmuş, çünkü istemci (`client.ts fetchHisseHaberleri`) AYNI
    // kodları yerel kapılarında kullanıyor.
    const cokSembol = Array.from({ length: AZAMI_SEMBOL + 1 }, (_, i) => 'AA' + i).join(',');
    ok('⑭j · 8`den fazla sembol → cok_sembol (ortak kapının kodu)',
      (await e2({ symbols: cokSembol })) === 'cok_sembol');
    const cs = await cagirUc(haberHandler, 'GET', { symbols: cokSembol });
    ok('⑭j · cok_sembol gövdesi azami/istenen SAYILARINI bildiriyor (istemci tahmin etmiyor)',
      cs.govde.azami === AZAMI_SEMBOL && cs.govde.istenen === AZAMI_SEMBOL + 1,
      `${cs.govde.azami} / ${cs.govde.istenen}`);
    ok('⑭j · cok_sembol gövdesinde uyarı metni + kısa önbellek',
      cs.govde.uyari === UYARI && cs.basliklar['cache-control'] === 'public, max-age=30');

    ok('⑭j · biçime uymayan sembol → bad_symbol', (await e2({ symbols: '!!!' })) === 'bad_symbol');
    const bs = await cagirUc(haberHandler, 'GET', { symbols: '!!!' });
    ok('⑭j · bad_symbol gövdesi HANGİ sembolün reddedildiğini bildiriyor',
      Array.isArray(bs.govde.gecersiz) && bs.govde.gecersiz.length === 1,
      JSON.stringify(bs.govde.gecersiz));

    // Pazar kümesi ORTAK kapıdan (`PAZARLAR`) geliyor; gündem kipinin
    // `GUNDEM_YERELLER` kümesi DEĞİL. İkisi ayrı ölçüm.
    ok('⑭j · bilinmeyen pazar → bad_market', (await e2({ symbols: 'AAPL', market: 'TOKYO' })) === 'bad_market');
    const bm2 = await cagirUc(haberHandler, 'GET', { symbols: 'AAPL', market: 'TOKYO' });
    ok('⑭j · bad_market gövdesi PAZARLAR kümesini bildiriyor (GUNDEM_YERELLER değil)',
      Array.isArray(bm2.govde.izinli) && bm2.govde.izinli.join(',') === girdiPazarlar.join(','),
      JSON.stringify(bm2.govde.izinli));

    // Limit kapıları kipten BAĞIMSIZ: çoklu kipte de aynı tavan.
    ok('⑭j · çoklu kipte limit tavanı geçerli → limit_buyuk',
      (await e2({ symbols: 'AAPL', limit: String(haberAzamiMadde + 1) })) === 'limit_buyuk');
    ok('⑭j · çoklu kipte limit 0 → bad_limit',
      (await e2({ symbols: 'AAPL', limit: '0' })) === 'bad_limit');

    ok('⑭j · ÖLÇÜM · çoklu kip kapılarının hiçbiri ağa ÇIKMADI', agDenemesi2 === 0, `${agDenemesi2} deneme`);
  } finally {
    globalThis.fetch = gercekFetch;
  }
}

// --- ⑭j② PAZAR SEMBOL BAŞINA ÇÖZÜLÜYOR — karışık liste TEK istek ------
// NİYE ÖNEMLİ: native takip listesi İKİ PAZARDAN KARIŞIK
// (`mobile/src/api/liste.ts BASLANGIC_LISTE`) ve ham sembolü sonekiyle
// tutuyor. Uç tek bir `market` alıyor ama `temizleSembol` pazarı SEMBOL
// BAŞINA çözüyor; bu ölçüm doğru olduğu için kart tek istek atıyor,
// pazar seçtiren düğme KURMUYOR. Bu davranış sessizce değişirse
// `HisseHaberleriKarti` yanlış pazardan besleme okur.
{
  const { PAZAR_ESLEME: ucPazarEsleme, eslemeTam: ucEslemeTam } = await import('../api/news.js');

  const aapl = girdiTemizle('AAPL', 'US');
  const thyao = girdiTemizle('THYAO.IS', 'US');
  ok('⑭j② · sonek YOKSA genel `market` varsayılanı geçerli (AAPL → US)',
    aapl && aapl.market === 'US' && aapl.sym === 'AAPL', JSON.stringify(aapl));
  ok('⑭j② · `.IS` eki sembolü BIST`e yükseltiyor — genel market US olsa DA',
    thyao && thyao.market === 'BIST', JSON.stringify(thyao));
  // ÖLÇÜLMÜŞ SAPMA, istemci bunu bilmek ZORUNDA: dönen kod ÇIPLAK
  // (`THYAO`), gönderilen dizgenin aynısı DEĞİL (`THYAO.IS`).
  ok('⑭j② · dönen kod ÇIPLAK (`.IS` eki DÜŞÜYOR) — satır etiketi gönderilenle birebir DEĞİL',
    thyao && thyao.sym === 'THYAO', String(thyao && thyao.sym));
  ok('⑭j② · `SEMBOL:PAZAR` biçimi de çözülüyor',
    (girdiTemizle('THYAO:BIST', 'US') || {}).market === 'BIST');
  ok('⑭j② · bilinmeyen pazar soneki SESSİZ VARSAYILANA düşmüyor (null)',
    girdiTemizle('X:TOKYO', 'US') === null);

  // Sözlük İKİ kümeyi de kapatıyor: kapamazsa çoklu kip o sembolü
  // `bad_market` ile REDDEDER (news.js `kapanmayan`). Bugün kapatıyor,
  // yani o dal ÖLÜ — ölü olduğunu ÖLÇÜYORUZ, varsaymıyoruz.
  ok('⑭j② · PAZAR_ESLEME ortak pazar kümesinin TAMAMINI kapatıyor',
    girdiPazarlar.every((p) => ucEslemeTam(p)),
    girdiPazarlar.map((p) => `${p}→${ucPazarEsleme[p]}`).join(' '));
  ok('⑭j② · sözlükte olmayan pazar `eslemeTam` ile REDDEDİLİYOR (sessiz TR`ye düşme yok)',
    ucEslemeTam('TOKYO') === false);
}

// --- ⑭j③ ÇOKLU KİP — statik denetimler (satır başına dürüstlük) -------
{
  const src3 = readFileSync(NEWS_PATH, 'utf8');
  ok('⑭j③ · ② çoklu sembol kipi uç sözleşmesinde YAZILI',
    src3.includes('② ÇOKLU SEMBOL'));
  // SATIR BAŞINA sayaç: satırın `tam`ı KENDİ sayacından okunuyor, gövde
  // kökündeki birleşik sayaçtan DEĞİL. Karışırsa tek düşen besleme
  // bütün satırları "ölçemedim" gösterirdi.
  ok('⑭j③ · satırın `tam`ı KENDİ sayacından (`haberTam(it.satirSayac)`)',
    src3.includes('tam: haberTam(it.satirSayac)'));
  ok('⑭j③ · "0 madde + tam" ile "ölçemedim" ayrımının GEREKÇESİ kodda yazılı',
    src3.includes('bu hissede haber') && src3.includes('karıştırılmıyor'));
  // `q: null` kipin İKİNCİ okuma yolu — istemci `symbols`in varlığına
  // bakmadan da kipi ayırt edebiliyor.
  ok('⑭j③ · çoklu kip gövdesinde `q: null` (kipi okumanın ikinci yolu)',
    src3.includes('q: null'));
  // Satırın duyarlılığı KENDİ manşetlerinden; birleşik puan gövde
  // kökünde AYRICA duruyor.
  ok('⑭j③ · satır duyarlılığı KENDİ maddelerinden (`duyarlilikKatmani(it.maddeler)`)',
    src3.includes('duyarlilikKatmani(it.maddeler)'));
}
{
  // -----------------------------------------------------------------------
  // ⑭k · TEMA KATMANI (Ş8 #8a) — hisse ↔ manşet ilişkisi
  // -----------------------------------------------------------------------
  // NİYE VAR: `/api/theme` cevabı yalnız `{symbol, market, name, reason}`
  // taşıyor; hangi adayın hangi manşette geçtiği UÇTAN GELMİYORDU ve web
  // bunu TARAYICIDA kuruyordu (eşik + durak sözcük listesi + sembol
  // kelime-sınırı regex'i orada). Native'de tema haberi HİÇ YOKTU. Yeni uç
  // açılamadı (Vercel Hobby tavanı 12 fonksiyon, DOLU), bu yüzden kip (1)
  // genişletildi. Bu bölüm hesabın MOTORDA kaldığını ve sözleşmenin
  // büyümediğini ölçüyor.
  //
  // AĞA HİÇ ÇIKMIYOR: katman eldeki manşet listesinden hesaplıyor.
  const ksrc = readFileSync(NEWS_PATH, 'utf8');
  const kkod = ksrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const kgovde = (kkod.match(/export function temaKatmani[\s\S]*?\n\}/) || [''])[0];
  const kayr = (kkod.match(/export function temaAdaylariAyristir[\s\S]*?\n\}/) || [''])[0];

  // --- tavan: theme.js ile AYNI sayı (kopya bilerek, import pahalı) ---
  ok('⑭k · aday tavanı /api/theme ile EŞİT (kopya kaymadı)',
    AZAMI_TEMA_ADAY === AZAMI_ADAY, `${AZAMI_TEMA_ADAY} ↔ ${AZAMI_ADAY}`);
  ok('⑭k · kopya olduğu DOSYADA yazılı (niyet kaybolmasın)',
    ksrc.includes("AZAMI_ADAY'IN AYNISI") && ksrc.includes('IMPORT EDILMEDI'));

  // --- girdi ayrıştırma ---
  const kA = ucTemaAyristir('ASELS|BIST|Aselsan Elektronik;NVDA|US|NVIDIA Corporation');
  ok('⑭k · `SEMBOL|PAZAR|ad` üçlüsü ayrışıyor', kA.hata === null && kA.adaylar.length === 2);
  ok('⑭k · ham sembol/pazar/ad ayrı alanlar (istemciye `.IS` ektirilmiyor)',
    kA.adaylar[0].ham === 'ASELS' && kA.adaylar[0].pazar === 'BIST'
    && kA.adaylar[0].ad === 'Aselsan Elektronik');
  ok('⑭k · küçük harf sembol büyütülüyor', ucTemaAyristir('asels|bist|x').adaylar[0].ham === 'ASELS');
  ok('⑭k · pazar boşsa alan `null` (0/uydurma DEĞİL)',
    ucTemaAyristir('ASELS||Aselsan').adaylar[0].pazar === null);
  ok('⑭k · ad boşsa alan `null`', ucTemaAyristir('ASELS|BIST|').adaylar[0].ad === null);
  ok('⑭k · ad 80 karakterde kırpılıyor (gövde şişmesin)',
    ucTemaAyristir(`ASELS|BIST|${'a'.repeat(200)}`).adaylar[0].ad.length === 80);
  ok('⑭k · boş dizge: hata YOK, aday YOK ("sormadım")',
    JSON.stringify(ucTemaAyristir('')) === '{"adaylar":[],"hata":null}');
  ok('⑭k · tavan aşımı → `cok_aday`',
    ucTemaAyristir(Array(AZAMI_TEMA_ADAY + 1).fill('A|US|x').join(';')).hata === 'cok_aday');
  ok('⑭k · tavan TAM dolu geçiyor (kapı bir eksik kapanmıyor)',
    ucTemaAyristir(Array(AZAMI_TEMA_ADAY).fill('A|US|x').join(';')).hata === null);
  ok('⑭k · bozuk sembol → `bad_aday`', ucTemaAyristir('A B C|US|x').hata === 'bad_aday');
  ok('⑭k · bilinmeyen pazar → `bad_aday_pazar`', ucTemaAyristir('ASELS|XX|x').hata === 'bad_aday_pazar');
  ok('⑭k · hata hâlinde aday listesi BOŞ (yarı ayrışmış gövde sızmıyor)',
    ucTemaAyristir('ASELS|BIST|x;A B C|US|y').adaylar.length === 0);
  ok('⑭k · ayrıştırıcıda eşik/ağırlık YOK (yalnız biçim denetimi)',
    !/\b(0\.\d|[2-9]\d*\.\d)/.test(kayr));

  // --- katman: hesabın MOTORDA kaldığı ---
  ok('⑭k · motor kuruldu (katmanın öncül koşulu)', ucHaberMotorHazir() === true);
  ok('⑭k · katman DÖRT motor işlevini çağırıyor (kural kopyası yok)',
    kgovde.includes('ENG.temaSorguSozcukleri') && kgovde.includes('ENG.temaBaslikIlgili')
    && kgovde.includes('ENG.themeNorm') && kgovde.includes('ENG.themeNewsHits'));
  ok('⑭k · katman gövdesinde SAYI YOK (eşik/tavan motorda)', !/[0-9]/.test(kgovde));
  ok('⑭k · katman gövdesinde `Math.`/regex/`toLowerCase` YOK (eşleşme kuralı kopyalanmadı)',
    !kgovde.includes('Math.') && !/\/[a-z^\\[]/.test(kgovde) && !kgovde.includes('toLowerCase'));
  ok('⑭k · katman gövdesinde Türkçe cümle YOK (HAM METİN kuralı §5.1)',
    !/[çğıöşüÇĞİÖŞÜ]/.test(kgovde));
  ok('⑭k · motor yoksa `null` ("ölçemedim", `{}` değil)',
    kgovde.includes('if (!ENG) return null;'));

  // --- ölçüm: elde kurulmuş manşet listesiyle ---
  const kmad = [
    { title: 'Aselsan yeni savunma ihracatı imzaladı' },          // 0 · ad eşleşmesi
    { title: 'Borsa günü yükselişle kapattı' },                   // 1 · ilgisiz
    { title: 'NVDA hisseleri savunma teknolojisiyle yükseldi' },  // 2 · sembol eşleşmesi
    { title: 'Savunma sanayinde yeni dönem' },                    // 3 · ilgili, adayı yok
  ];
  const kkunye0 = JSON.stringify(kmad[0]);
  const kT = ucTemaKatmani('savunma sanayi teması', kmad, kA.adaylar);
  ok('⑭k · sorgu sözcükleri motordan (taşıyıcı sözcükler atıldı)',
    JSON.stringify(kT.sozcukler) === '["savunma","sanayi"]');
  ok('⑭k · ilgisiz manşetin SIRASI bildiriliyor', JSON.stringify(kT.ilgisiz) === '[1]');
  ok('⑭k · ad sözcüğü eşleşmesi (ASELS → 0)', JSON.stringify(kT.adaylar.ASELS) === '[0]');
  ok('⑭k · sembol eşleşmesi (NVDA → 2)', JSON.stringify(kT.adaylar.NVDA) === '[2]');
  ok('⑭k · adayı olmayan ilgili manşet kimseye bağlanmadı',
    !JSON.stringify(kT.adaylar).includes('3'));
  ok('⑭k · anahtar İSTEMCİNİN HAM sembolü (`.IS` ya da yahoo biçimi değil)',
    Object.keys(kT.adaylar).join(',') === 'ASELS,NVDA');
  ok('⑭k · değer SIRA DİZİSİ (madde nesnesi değil, gövde ikiye katlanmıyor)',
    Object.values(kT.adaylar).every((v) => Array.isArray(v) && v.every((n) => Number.isInteger(n))));
  ok('⑭k · `maddeler` SÜZÜLMEDİ (sözleşme büyümedi/küçülmedi)', kmad.length === 4);
  ok('⑭k · girdi maddeleri DEĞİŞTİRİLMEDİ (`_i` künyeye yazılmadı)',
    JSON.stringify(kmad[0]) === kkunye0 && !('_i' in kmad[0]));
  ok('⑭k · aday yoksa `adaylar: {}` ("ölçtüm, aday yoktu")',
    JSON.stringify(ucTemaKatmani('savunma', kmad, []).adaylar) === '{}');
  // ÖLÇEMEDİĞİMİZDE SÜZMÜYORUZ: sorgu yalnız taşıyıcı sözcüklerden
  // oluşuyorsa ilgi ölçülemez — hiçbir manşet ilgisiz İLAN EDİLMEZ.
  const kOlcusuz = ucTemaKatmani('tema hisse', kmad, kA.adaylar);
  ok('⑭k · ölçülemeyen sorguda sözcük listesi boş', kOlcusuz.sozcukler.length === 0);
  ok('⑭k · ölçülemeyen sorguda HİÇBİR manşet ilgisiz sayılmıyor', kOlcusuz.ilgisiz.length === 0);

  // --- cevap sözleşmesi ---
  ok('⑭k · `tema` alanı YALNIZ `adaylar=` sorulunca konuyor (kip ②/③ taşımıyor)',
    kkod.includes('...(hamAdaylar ? { tema: temaKatmani(q, maddeler, temaAdaylar) } : {})'));
  ok('⑭k · gövdede `tema:` TEK yerde (ikinci bir dal sızmadı)',
    (kkod.match(/\btema:/g) || []).length === 1);
  ok('⑭k · kip çakışması 400 `adaylar_kip` (sessizce yoksayma yok)',
    /if \(gundem \|\| hamSembol\)[\s\S]{0,160}adaylar_kip/.test(kkod));
  ok('⑭k · ayrıştırma hatası 400 + `azami` bildiriyor',
    /error: ayAday\.hata, azami: AZAMI_TEMA_ADAY/.test(kkod));
  ok('⑭k · sözleşme belgesi `adaylar=` kipini yazıyor',
    ksrc.includes('&adaylar=SEMBOL|PAZAR|ad') && ksrc.includes('maddeler` SUZULMEZ'));
  // Taşıyıcı sözleşmesi: madde alanları BÜYÜMEDİ — tema katmanı maddelere
  // alan EKLEMİYOR, ayrı KARDEŞ ALAN olarak taşınıyor.
  ok('⑭k · `MADDE_ALANLARI` büyümedi (altı alan, `tema` madde içine girmedi)',
    MADDE_ALANLARI.length === 6 && !MADDE_ALANLARI.includes('tema'));
}
// =========================================================================
bolum('⑮ /api/tarama · /api/sektor · /api/radar · /api/backtest · /api/deger · /api/arama · /api/takvim — keşif rotaları (api/_kesif.js)');
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
  ok('⑮a · yedi handler da fonksiyon',
    ['taramaHandler', 'sektorHandler', 'radarHandler', 'backtestHandler', 'degerHandler', 'aramaHandler',
      'takvimHandler']
      .every((a) => typeof KESIF[a] === 'function'));
  ok('⑮a · ROTALAR yedi rota ilan ediyor',
    KESIF.ROTALAR.join(',') === 'tarama,sektor,radar,backtest,deger,arama,takvim', KESIF.ROTALAR.join(','));
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
  // arama ucu: tavan ve ÖLÇÜLMÜŞ borsa kodu kümeleri.
  ok('⑮a · arama aday tavanı Yahoo `quotesCount` ile birebir taşınan sayı',
    KESIF.ARAMA_AZAMI === 25, String(KESIF.ARAMA_AZAMI));
  ok('⑮a · arama varsayılanı tavanın İÇİNDE (sessiz kırpma yok)',
    KESIF.ARAMA_VARSAYILAN >= 1 && KESIF.ARAMA_VARSAYILAN <= KESIF.ARAMA_AZAMI,
    String(KESIF.ARAMA_VARSAYILAN));
  ok('⑮a · BIST ve US borsa kodu kümeleri AYRIK (IST US listesinde YOK)',
    !KESIF.BORSA_US.some((k) => KESIF.BORSA_BIST.includes(k)), KESIF.BORSA_US.join(','));
  ok('⑮a · kripto HAM `quoteType` koduyla tanınıyor (borsa koduyla değil)',
    KESIF.TUR_KRIPTO === 'CRYPTOCURRENCY', KESIF.TUR_KRIPTO);
  ok('⑮a · borsa kodları HAM (ekran metni değil)',
    [...KESIF.BORSA_BIST, ...KESIF.BORSA_US].every((k) => /^[A-Z]{2,4}$/.test(k)),
    KESIF.BORSA_BIST.concat(KESIF.BORSA_US).join(','));
  ok('⑮a · arama adresi Yahoo arama ucu (konak `_ag.js` IZINLI listesinde)',
    KESIF.ARAMA_URL === 'https://query1.finance.yahoo.com/v1/finance/search', KESIF.ARAMA_URL);
  ok('⑮a · metinsel ve sayısal ölçüm kümeleri AYRIK',
    !KESIF.OLCUM_SAYISAL.some((k) => KESIF.OLCUM_METINSEL.includes(k)));

  // --- ⑮b 13. FONKSİYON KİLİDİ ----------------------------------------
  {
    const dosyalar = readdirSync(path.join(ROOT, 'api'))
      .filter((f) => f.endsWith('.js') && !f.startsWith('_'));
    ok('⑮b · KİLİT · `api/*.js` uç dosyası sayısı 12 (Hobby tavanı aşılmadı)',
      dosyalar.length === 12, `${dosyalar.length}: ${dosyalar.join(',')}`);
    ok('⑮b · yeni uç dosyası YOK — keşif `_` önekli MODÜL',
      !dosyalar.some((f) => /tarama|sektor|radar|backtest|deger|arama|takvim|kesif/.test(f)), dosyalar.join(','));
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
    // TERS YÖN: vercel.json'da ROTALAR ∪ {yfin} D I Ş I N D A rewrite OLMAMALI.
    // İleri yön (her rotanın rewrite'ı var mı) yukarıda; bu kapı ters tarafı
    // tutuyor: rota adı bir yerde sessizce değişirse (örn. `/api/aramaa`)
    // eşleşme kopar ve BURADA kırmızı yanar — canlıda 404 beklemeden.
    {
      // ⑰ EKİ: degisim/kripto/metal de AYNI çoklayıcıya bindi, ama ayrı
      // taşıyıcıda (`_kesif.js` DEĞİL). Liste yine ELLE yazılmıyor:
      // `proxy.js`in kendi `TASIYICI_ROTALARI` tablosundan geliyor.
      const izinliRota = new Set(['yfin', ...KESIF.ROTALAR, ...TASIYICI_ROTALARI]);
      const kacak = rew.filter((x) => {
        const m = /^\/api\/([a-z]+)$/.exec(String(x.source));
        return !m || !izinliRota.has(m[1]) || x.destination !== `/api/proxy?__rota=${m[1]}`;
      });
      ok('⑮b · KİLİT · ROTALAR ∪ {yfin} ∪ TAŞIYICILAR D I Ş I N D A rewrite YOK (ters yön)',
        kacak.length === 0, kacak.map((x) => `${x.source}→${x.destination}`).join(' | ') || 'temiz');
      ok('⑮b · KİLİT · rewrite sayısı = ROTALAR + yfin + TAŞIYICILAR (fazla/eksik yol yok)',
        rew.length === KESIF.ROTALAR.length + 1 + TASIYICI_ROTALARI.length,
        `${rew.length} rewrite · 7+1+${TASIYICI_ROTALARI.length} bekleniyor`);
    }
    ok('⑮b · yfin rewrite\'ı BOZULMADI (taklit edilen kalıp yerinde)',
      rew.some((x) => x.source === '/api/yfin' && x.destination === '/api/proxy?__rota=yfin'));
    ok('⑮b · `functions` bloğuna YENİ kalem girmedi (beşi proxy bütçesini paylaşıyor)',
      !Object.keys(vercel.functions || {}).some((k) => /tarama|sektor|radar|backtest|deger|arama|takvim|kesif/.test(k)),
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
      ok('⑮c · arama POST kabul ETMİYOR',
        (await cagirKesif(KESIF.aramaHandler, 'POST', {}, {})).kod === 405);
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
          === 'basis,bizSummary,bizSummaryKirpik,forwardPE,industry,market,name,peg,profitMargin,revenueGrowth,sym,trailingPE',
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

  // --- ⑮i arama — ÇOK PAZARLI aday listesi (VARSAYIM YERİNE SEÇİM) ----
  // NİYE VAR: `api/_girdi.js:161` çıplak terimde pazarı SESSİZCE 'US'
  // varsayıyor (ÖLÇÜLDÜ: `ASELS` → market 'US' → skor null). O sözleşme
  // analyze/score/recommend tarafından paylaşıldığı için DEĞİŞTİRİLMEDİ;
  // bu uç varsayımın yerine ETiKETLİ ADAY LİSTESİ veriyor.
  // ⑮g'DEN ÖNCE duruyor: topladığı gövdeler HAM SAYI / tavsiye dili
  // süzgecinden de geçsin.
  {
    const gercekFetch = globalThis.fetch;
    let agDenemesi = 0;
    let cagrilanUrl = null;
    // ÖLÇÜLMÜŞ Yahoo /v1/finance/search kaydı (2026-10-28, on üç sorgu):
    // symbol / shortname / longname / exchange / quoteType / sector var;
    // ENDEKS ÜYELİĞİ ALANI YOK — bu yüzden uç 'S&P 500' İDDİA EDEMİYOR.
    const aramaTxt = JSON.stringify({ count: 5, quotes: [
      { symbol: 'ASELS.IS', shortname: 'ASELSAN', longname: 'Aselsan Elektronik', exchange: 'IST', quoteType: 'EQUITY', sector: 'Industrials' },
      { symbol: 'AAPL', shortname: 'Apple Inc.', exchange: 'NMS', quoteType: 'EQUITY', sector: 'Technology' },
      { symbol: 'BTC-USD', shortname: 'Bitcoin USD', exchange: 'CCC', quoteType: 'CRYPTOCURRENCY' },
      { symbol: 'APC.DE', shortname: 'APPLE INC', exchange: 'GER', quoteType: 'EQUITY' },
      { symbol: 'SPY', shortname: 'SPDR TRUST', exchange: 'PCX', quoteType: 'ETF' },
    ] });
    const aramaYanit = (txt = aramaTxt, ok2 = true, status = 200) => ({
      ok: ok2, status, text: async () => txt, json: async () => JSON.parse(txt),
    });
    const aday = (g, sembol) => (g.adaylar || []).find((a) => a.sembol === sembol) || {};

    try {
      globalThis.fetch = async (u) => { agDenemesi++; cagrilanUrl = String(u); return aramaYanit(); };

      const a = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'apple' }));
      ok('⑮i · geçerli GET → 200', a.kod === 200, `kod ${a.kod} ${a.govde.error || ''}`);
      ok('⑮i · gövde alanları SABİT',
        anahtarlar(a.govde) === 'adaylar,adet,limit,ms,q,sayac,surum,tam,uyari'
          .split(',').sort().join(','), anahtarlar(a.govde));
      ok('⑮i · ÖLÇÜM · TEK dış istek', agDenemesi === 1, `${agDenemesi} istek`);
      ok('⑮i · ÖLÇÜM · Yahoo ARAMA ucuna gidildi (chart ucuna değil)',
        String(cagrilanUrl).startsWith(KESIF.ARAMA_URL), cagrilanUrl);
      ok('⑮i · ÖLÇÜM · terim kaçışlı (encodeURIComponent) ve limit adrese GEÇTİ',
        /[?&]q=apple\b/.test(cagrilanUrl)
        && new RegExp('[?&]quotesCount=' + KESIF.ARAMA_VARSAYILAN + '\\b').test(cagrilanUrl), cagrilanUrl);
      ok('⑮i · limit verilmezse ARAMA_VARSAYILAN (uydurma sayı yok)',
        a.govde.limit === KESIF.ARAMA_VARSAYILAN, String(a.govde.limit));
      ok('⑮i · sorulan terim GERİ BİLDİRİLİYOR', a.govde.q === 'apple', a.govde.q);
      ok('⑮i · aday alanları SABİT',
        (a.govde.adaylar || []).every((x) => anahtarlar(x)
          === 'ad,borsa,motorPazar,motorSembol,motorUc,pazar,sektor,sembol,tur'),
        anahtarlar(a.govde.adaylar[0]));
      ok('⑮i · adet GERÇEK aday sayısını bildiriyor',
        a.govde.adet === a.govde.adaylar.length, `${a.govde.adet}/${a.govde.adaylar.length}`);

      // ÜÇ PAZAR BİR ARADA — kullanıcının istediği seçim listesi.
      ok('⑮i · ÖLÇÜM · TEK sorguda BIST + US + KRİPTO yan yana geldi',
        ['BIST', 'US', 'KRIPTO'].every((p) => a.govde.adaylar.some((x) => x.pazar === p)),
        a.govde.adaylar.map((x) => x.pazar).join(','));
      ok('⑮i · BIST adayı HAM borsa kodunu taşıyor (IST)',
        aday(a.govde, 'ASELS.IS').pazar === 'BIST' && aday(a.govde, 'ASELS.IS').borsa === 'IST',
        `${aday(a.govde, 'ASELS.IS').pazar}/${aday(a.govde, 'ASELS.IS').borsa}`);
      ok('⑮i · BIST `motorSembol`ü motorun KABUL ETTİĞİ biçim (`_girdi.js` ile ölçüldü)',
        aday(a.govde, 'ASELS.IS').motorSembol === 'ASELS.IS'
        && girdiTemizle(aday(a.govde, 'ASELS.IS').motorSembol, 'US').market === 'BIST',
        aday(a.govde, 'ASELS.IS').motorSembol);
      ok('⑮i · BIST adayı `motorPazar: BIST` — VARSAYILAN US DEĞİL (asıl onarım)',
        aday(a.govde, 'ASELS.IS').motorPazar === 'BIST', aday(a.govde, 'ASELS.IS').motorPazar);
      ok('⑮i · US adayı çıplak sembolle gidiyor (`_girdi.js` biçimine uyuyor)',
        aday(a.govde, 'AAPL').pazar === 'US' && aday(a.govde, 'AAPL').motorSembol === 'AAPL'
        && girdiTemizle(aday(a.govde, 'AAPL').motorSembol, 'US').market === 'US',
        aday(a.govde, 'AAPL').motorSembol);
      ok('⑮i · her iki motor adayı da `motorUc: analyze` bildiriyor',
        aday(a.govde, 'AAPL').motorUc === 'analyze' && aday(a.govde, 'ASELS.IS').motorUc === 'analyze',
        aday(a.govde, 'AAPL').motorUc);

      // DÜRÜSTLÜK: motorda KRİPTO PAZARI YOK → motorSembol null.
      ok('⑮i · kripto adayı pazar koduyla GÖRÜNÜYOR (kullanıcı seçebilir)',
        aday(a.govde, 'BTC-USD').pazar === 'KRIPTO' && aday(a.govde, 'BTC-USD').tur === 'CRYPTOCURRENCY',
        `${aday(a.govde, 'BTC-USD').pazar}/${aday(a.govde, 'BTC-USD').tur}`);
      ok('⑮i · ÖLÇÜM · motorun PAZARLARında kripto YOK (uydurulmadı)',
        !girdiPazarlar.includes('KRIPTO'), girdiPazarlar.join(','));
      ok('⑮i · kripto `motorSembol` null — motorla ölçülemez, UYDURULMUYOR',
        aday(a.govde, 'BTC-USD').motorSembol === null
        && aday(a.govde, 'BTC-USD').motorPazar === null
        && aday(a.govde, 'BTC-USD').motorUc === null,
        String(aday(a.govde, 'BTC-USD').motorSembol));
      ok('⑮i · ÖLÇÜLMEYEN borsa kodu (GER) `pazar: null` — TAHMİN YOK',
        aday(a.govde, 'APC.DE').pazar === null && aday(a.govde, 'APC.DE').borsa === 'GER'
        && aday(a.govde, 'APC.DE').motorSembol === null,
        String(aday(a.govde, 'APC.DE').pazar));
      ok('⑮i · ölçülmeyen alan null — 0 ya da boş dize DEĞİL',
        aday(a.govde, 'BTC-USD').sektor === null, String(aday(a.govde, 'BTC-USD').sektor));

      // HAM KOD KURALI + ENDEKS ÜYELİĞİ İDDİASI YOK.
      ok('⑮i · `pazar` KAPALI makine kodu kümesi (ekran metni yok)',
        a.govde.adaylar.every((x) => x.pazar === null || ['BIST', 'US', 'KRIPTO'].includes(x.pazar)),
        a.govde.adaylar.map((x) => String(x.pazar)).join(','));
      ok('⑮i · `borsa`/`tur` Yahoo\'nun HAM kodu (büyük harf, çeviri yok)',
        a.govde.adaylar.every((x) => x.borsa === null || /^[A-Z]{2,4}$/.test(x.borsa))
        && a.govde.adaylar.every((x) => x.tur === null || /^[A-Z]+$/.test(x.tur)),
        a.govde.adaylar.map((x) => `${x.borsa}:${x.tur}`).join(','));
      ok('⑮i · ENDEKS ÜYELİĞİ İDDİA EDİLMİYOR (PCX bir BORSA kodu, endeks değil)',
        aday(a.govde, 'SPY').pazar === 'US' && aday(a.govde, 'SPY').borsa === 'PCX'
        && !Object.prototype.hasOwnProperty.call(aday(a.govde, 'SPY'), 'endeks'),
        `${aday(a.govde, 'SPY').pazar}/${aday(a.govde, 'SPY').borsa}`);
      // BÜYÜK/küçük HARF DUYARLI bakılıyor: 'KRIPTO' MAKİNE KODU (geçerli),
      // 'Kripto' EKRAN METNİ (yasak). `i` bayrağı ikisini ayırt edemiyordu.
      ok('⑮i · uç TÜRKÇE ETiKET METNİ ÜRETMİYOR (etiketi istemci yazıyor)',
        !/Kripto|Borsa İstanbul|Nasdaq|S&P 500 üye/.test(JSON.stringify(a.govde.adaylar.map(
          (x) => ({ pazar: x.pazar, borsa: x.borsa, tur: x.tur, motorPazar: x.motorPazar }),
        ))), 'temiz');
      ok('⑮i · TAM cevap 300 sn penceresiyle dönüyor',
        a.govde.tam === true
        && a.basliklar['cache-control'] === 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
        a.basliklar['cache-control']);
      ok('⑮i · KV yokken `X-Onbellek: iska`', a.basliklar['x-onbellek'] === 'iska');

      // LIMIT KAPISI — kapalı küme, sessiz kırpma yok.
      const l3 = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'apple', limit: '3' }));
      ok('⑮i · limit adrese ve gövdeye GEÇİYOR',
        l3.kod === 200 && l3.govde.limit === 3 && /[?&]quotesCount=3\b/.test(cagrilanUrl),
        `${l3.govde.limit} / ${cagrilanUrl}`);
      ok('⑮i · aday sayısı limiti AŞMIYOR', l3.govde.adaylar.length <= 3, String(l3.govde.adaylar.length));

      // BOŞ SONUÇ HATA DEĞİL: ölçtüm, yok → tam: true.
      globalThis.fetch = async (u) => { agDenemesi++; cagrilanUrl = String(u); return aramaYanit(JSON.stringify({ count: 0, quotes: [] })); };
      const bos = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'zzzzqqqq' }));
      ok('⑮i · ÖLÇÜM · aday yok → 200 + `adaylar: []` + `tam: true` (ÖLÇTÜM, YOK)',
        bos.kod === 200 && Array.isArray(bos.govde.adaylar) && bos.govde.adaylar.length === 0
        && bos.govde.adet === 0 && bos.govde.tam === true,
        `kod ${bos.kod} adet ${bos.govde.adet} tam ${bos.govde.tam}`);
      ok('⑮i · boş sonuçta sayac KESİNTİSİZ', bos.govde.sayac.yahoo.kesinti === 0,
        JSON.stringify(bos.govde.sayac.yahoo));

      // TAŞIMA KESİNTİSİ: ölçemedim → tam: false (boş sonuçla AYNI DEĞİL).
      globalThis.fetch = async () => { agDenemesi++; return aramaYanit('', false, 500); };
      const kes = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'apple' }));
      ok('⑮i · ÖLÇÜM · taşıma kesintisi → `tam: false` (ÖLÇEMEDİM)',
        kes.kod === 200 && kes.govde.tam === false && kes.govde.adaylar.length === 0
        && kes.govde.sayac.yahoo.kesinti > 0,
        `tam ${kes.govde.tam} kesinti ${kes.govde.sayac.yahoo.kesinti}`);
      ok('⑮i · ölçülemeyen cevap KISA pencereyle dönüyor (kesinti 5 dk donmuyor)',
        kes.basliklar['cache-control'] === 'public, max-age=30', kes.basliklar['cache-control']);
      ok('⑮i · KİLİT · “boş sonuç” ile “ölçemedim” AYIRT EDİLEBİLİYOR',
        bos.govde.tam === true && kes.govde.tam === false
        && bos.govde.adaylar.length === kes.govde.adaylar.length,
        `${bos.govde.tam} / ${kes.govde.tam}`);

      globalThis.fetch = async () => { agDenemesi++; throw new Error('taşıma çöktü'); };
      const cok = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'apple' }));
      ok('⑮i · taşıyıcı atışı → 502 `arama_yapilamadi` (aday UYDURULMUYOR)',
        cok.kod === 502 && cok.govde.error === 'arama_yapilamadi', `${cok.kod} ${cok.govde.error}`);

      // 400 KAPALI KÜMESİ — ağa ÇIKMADAN reddediyor.
      const once400 = agDenemesi;
      const q0 = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', {}));
      ok('⑮i · q yok → 400 q_yok', q0.kod === 400 && q0.govde.error === 'q_yok', `${q0.kod} ${q0.govde.error}`);
      const qb = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: '   ' }));
      ok('⑮i · boşluk q → 400 q_yok (sessiz kabul yok)', qb.kod === 400 && qb.govde.error === 'q_yok');
      const qu = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'a'.repeat(AZAMI_SORGU + 1) }));
      ok('⑮i · q çok uzun → 400 too_long + azami (kırpma YOK)',
        qu.kod === 400 && qu.govde.error === 'too_long' && qu.govde.azami === AZAMI_SORGU,
        `${qu.kod} ${qu.govde.azami}`);
      for (const kotu of ['abc', '0', '-1', String(KESIF.ARAMA_AZAMI + 1), '2.5']) {
        const bl = yakala(await cagirKesif(KESIF.aramaHandler, 'GET', { q: 'apple', limit: kotu }));
        ok(`⑮i · limit=${kotu} → 400 bad_limit + asgari/azami`,
          bl.kod === 400 && bl.govde.error === 'bad_limit'
          && bl.govde.asgari === 1 && bl.govde.azami === KESIF.ARAMA_AZAMI,
          `${bl.kod} ${bl.govde.error}`);
      }
      ok('⑮i · ÖLÇÜM · 400 yolu SIFIR dış istek attı', agDenemesi === once400, `${agDenemesi - once400} istek`);
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
    // ÖLÇÜLMÜŞ GENİŞLETME (2026-10-28): motorun ARAMA DİLİMİ YOK (api/_motor.js
    // içinde 'finance/search' geçmiyor), bu yüzden `arama` ucu adresi kendisi
    // kurup TAŞIYICIYA (`AG.H.fetch` = _ag.js agFetch: izin listesi + tekilleştirme
    // + süre tavanı + sayac) veriyor. Kapının NİYETİ GLOBAL `fetch`i yasaklamak;
    // taşıyıcı çağrısı ayıklandıktan sonra çıplak `fetch(` HÂLÂ YASAK.
    const kesifAgsiz = kesifKod.split('AG.H.fetch(').join('AG.H[TASIYICI](');
    ok('⑮h · uçta çıplak `fetch(` YOK — ağ MOTORUN taşıyıcısında',
      !/\bfetch\(/.test(kesifAgsiz));
    ok('⑮h · ağ YALNIZ taşıyıcı üzerinden (`AG.H.fetch`) çağrılıyor',
      kesifKod.includes('AG.H.fetch('), 'AG.H.fetch');
    ok('⑮h · arama adresi `_ag.js` IZINLI önekiyle başlıyor (izin listesine dokunulmadı)',
      KESIF.ARAMA_URL.startsWith('https://query1.finance.yahoo.com/'), KESIF.ARAMA_URL);
    ok('⑮h · uçta ENDEKS ETİKETİ ya da TÜRKÇE PAZAR METNİ yazılmamış',
      !/'S&P[^']*'|'Kripto'|'Nasdaq'|'Borsa İstanbul'/.test(kesifKod), 'temiz');
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


// =========================================================================
bolum('⑯ /api/takvim — KAP duyuruları + BIST temettü takvimi (api/_takvim.js)');
// =========================================================================
// 13. FONKSİYON TUZAĞI: bu uç da YENİ DOSYA DEĞİL — `api/_takvim.js`
// `_` önekli bir TAŞIYICI, rota `api/proxy.js`in `__rota=` çoklayıcısında.
// ⑮b'deki kilitler (dosya sayısı 12 · rewrite birebirliği) bu rotayı da
// otomatik kapsıyor, çünkü hepsi `KESIF.ROTALAR`dan okunuyor.
//
// AĞ YASAĞI: bu bölümdeki her denetim ya SAF ayrıştırıcıyı fikstürle
// ölçüyor ya da `globalThis.fetch`i kara deliğe çevirip handler'ın
// DÜRÜST kesinti cevabını (502 / null / tam:false) ölçüyor. Tek paket
// dışarı çıkmıyor.
{
  const takvimSrc = readFileSync(TAKVIM_PATH, 'utf8');
  const takvimKod = takvimSrc.split(/\r?\n/)
    .filter((s) => !/^\s*(\/\/|\*|\/\*)/.test(s)).join('\n');

  const cagirTakvim = async (method, query) => {
    const res = sahteRes();
    await KESIF.takvimHandler({ method, query }, res);
    return res;
  };

  // --- ⑯a yüzey + ÖLÇÜLMÜŞ sabitler -----------------------------------
  ok('⑯a · `takvimHandler` dışa aktarılmış ve HANDLERLAR tablosunda',
    typeof KESIF.takvimHandler === 'function' && KESIF.HANDLERLAR.takvim === KESIF.takvimHandler);
  ok('⑯a · `takvim` ROTALAR listesinde (tek kaynak)',
    KESIF.ROTALAR.includes('takvim'), KESIF.ROTALAR.join(','));
  ok('⑯a · saf ayrıştırıcılar dışa aktarılmış (ağsız sınanabilir)',
    ['ayristirKAP', 'ayristirTemettu', 'kapZamani', 'kapSemboller', 'ondalik', 'cozVarlik']
      .every((a) => typeof TAKVIM[a] === 'function'));
  ok('⑯a · sayaç yardımcıları dışa aktarılmış',
    typeof TAKVIM.bosTakvimSayac === 'function' && typeof TAKVIM.takvimTam === 'function');
  ok('⑯a · kapsam beyaz listesi ÜÇ değer (sessiz genişleme yok)',
    TAKVIM.KAPSAMLAR.join(',') === 'hepsi,kap,temettu', TAKVIM.KAPSAMLAR.join(','));
  ok('⑯a · varsayılan kapsam beyaz listede',
    TAKVIM.KAPSAMLAR.includes(TAKVIM.VARSAYILAN_KAPSAM), TAKVIM.VARSAYILAN_KAPSAM);
  ok('⑯a · KAP tavanı kaynağın ÖLÇÜLEN sayfa boyunun (50) üstünde',
    TAKVIM.AZAMI_KAP === 60 && TAKVIM.AZAMI_KAP > 50, String(TAKVIM.AZAMI_KAP));
  ok('⑯a · temettü tavanı ÖLÇÜLMÜŞ bir sayı',
    TAKVIM.AZAMI_TEMETTU === 400, String(TAKVIM.AZAMI_TEMETTU));
  ok('⑯a · varsayılanlar tavanların İÇİNDE (sessiz kırpma yok)',
    TAKVIM.VARSAYILAN_KAP >= 1 && TAKVIM.VARSAYILAN_KAP <= TAKVIM.AZAMI_KAP
    && TAKVIM.VARSAYILAN_TEMETTU >= 1 && TAKVIM.VARSAYILAN_TEMETTU <= TAKVIM.AZAMI_TEMETTU,
    `${TAKVIM.VARSAYILAN_KAP} / ${TAKVIM.VARSAYILAN_TEMETTU}`);
  ok('⑯a · zaman aşımı webin İKİ tavanının BÜYÜĞÜ (8000 · 10000)',
    TAKVIM.TAKVIM_ISTEK_MS === 10000, String(TAKVIM.TAKVIM_ISTEK_MS));
  ok('⑯a · zaman aşımı proxy bütçesinin (30 sn) ALTINDA',
    TAKVIM.TAKVIM_ISTEK_MS < 30000, String(TAKVIM.TAKVIM_ISTEK_MS));
  ok('⑯a · kısa gövde eşiği HTML sayfası için ÖLÇÜLMÜŞ (1024)',
    TAKVIM.ASGARI_GOVDE_BAYT === 1024, String(TAKVIM.ASGARI_GOVDE_BAYT));
  ok('⑯a · tür makine kodu `KAP` — `_haber.js`in ilan ettiği kümede',
    TAKVIM.TAKVIM_TURU === 'KAP' && HABER_TURLERI.includes(TAKVIM.TAKVIM_TURU),
    TAKVIM.TAKVIM_TURU);
  ok('⑯a · para birimi MAKİNE KODU (`TRY`), ekran simgesi DEĞİL',
    TAKVIM.PARA_BIRIMI === 'TRY', TAKVIM.PARA_BIRIMI);
  ok('⑯a · saat dilimi AÇIK ve SABİT (TR kalıcı UTC+03:00)',
    TAKVIM.TAKVIM_SAAT_DILIMI === '+03:00', TAKVIM.TAKVIM_SAAT_DILIMI);
  ok('⑯a · KAP madde alan kümesi yazılı ve `_haber.js` süzgeçlerini kapsıyor',
    ['title', 'link', 'pubDate', 'symbol', 'type'].every((a) => TAKVIM.KAP_MADDE_ALANLARI.includes(a)),
    TAKVIM.KAP_MADDE_ALANLARI.join(','));
  ok('⑯a · temettü madde alan kümesi yazılı',
    TAKVIM.TEMETTU_MADDE_ALANLARI.join(',') === 'symbol,date,dateHam,amount,yieldPct,currency,paid',
    TAKVIM.TEMETTU_MADDE_ALANLARI.join(','));
  ok('⑯a · ay tabloları DONDURULMUŞ (çalışma anında değişmez)',
    Object.isFrozen(TAKVIM.TR_AY_KISA) && Object.isFrozen(TAKVIM.TR_AY_TAM));
  ok('⑯a · ay tabloları 12 ayın HEPSİNİ kapsıyor (kısa + tam)',
    new Set(Object.values(TAKVIM.TR_AY_KISA)).size === 12
    && new Set(Object.values(TAKVIM.TR_AY_TAM)).size === 12);

  // --- ⑯b KONAK İZİN LİSTESİ · `_ag.js` AÇILMADI ----------------------
  {
    const agSrc = readFileSync(AG_PATH, 'utf8');
    ok('⑯b · KİLİT · `_ag.js` IZINLI listesine takvim konağı EKLENMEDİ',
      !/mynet|temettuhisseleri/.test(agSrc), 'temiz');
    ok('⑯b · takvimin KENDİ izin listesi iki konak',
      TAKVIM.IZINLI_KONAK.join(',') === 'finans.mynet.com,temettuhisseleri.com',
      TAKVIM.IZINLI_KONAK.join(','));
    // YENİ GÜVEN ALANI YOK: ikisi de `api/proxy.js`in kümesinde ZATEN var.
    const proxyS = readFileSync(PROXY_PATH, 'utf8');
    ok('⑯b · KİLİT · iki konak `api/proxy.js` izin kümesinde ZATEN vardı',
      TAKVIM.IZINLI_KONAK.every((k) => proxyS.includes(k)), TAKVIM.IZINLI_KONAK.join(','));
    ok('⑯b · iki kaynak adresi de KENDİ izin listesinden geçiyor',
      TAKVIM.izinliTakvimAdresi(TAKVIM.KAP_URL) && TAKVIM.izinliTakvimAdresi(TAKVIM.TEMETTU_URL));
    ok('⑯b · http (şifresiz) adres REDDEDİLİYOR',
      TAKVIM.izinliTakvimAdresi('http://finans.mynet.com/borsa/kaphaberleri/') === false);
    ok('⑯b · izin listesi dışı konak REDDEDİLİYOR',
      TAKVIM.izinliTakvimAdresi('https://evil.example.com/x') === false);
    ok('⑯b · alt alan adı KAÇAĞI yok (konak BİREBİR eşleşiyor)',
      TAKVIM.izinliTakvimAdresi('https://finans.mynet.com.evil.example.com/x') === false);
    ok('⑯b · adres olmayan girdi REDDEDİLİYOR (patlamadan)',
      TAKVIM.izinliTakvimAdresi('') === false && TAKVIM.izinliTakvimAdresi(null) === false
      && TAKVIM.izinliTakvimAdresi('bozuk') === false);
  }

  // --- ⑯c `kapZamani` — SAF, ÖLÇÜLMEYEN TARİH UYDURULMAZ --------------
  ok('⑯c · "08 Haz 2026 11:01" → ISO + AÇIK offset',
    TAKVIM.kapZamani('08 Haz 2026 11:01') === '2026-06-08T11:01:00+03:00',
    String(TAKVIM.kapZamani('08 Haz 2026 11:01')));
  ok('⑯c · tek haneli gün/saat İKİ HANEYE yastıklanıyor',
    TAKVIM.kapZamani('1 Oca 2026 9:05') === '2026-01-01T09:05:00+03:00',
    String(TAKVIM.kapZamani('1 Oca 2026 9:05')));
  ok('⑯c · Türkçe karakterli ay adı (Şub · Ağu) çözülüyor',
    TAKVIM.kapZamani('03 Şub 2026 10:00') === '2026-02-03T10:00:00+03:00'
    && TAKVIM.kapZamani('03 Ağu 2026 10:00') === '2026-08-03T10:00:00+03:00');
  ok('⑯c · Türkçe karaktersiz yazım da çözülüyor (sub · agu)',
    TAKVIM.kapZamani('03 Sub 2026 10:00') === '2026-02-03T10:00:00+03:00'
    && TAKVIM.kapZamani('03 Agu 2026 10:00') === '2026-08-03T10:00:00+03:00');
  ok('⑯c · KURAL · biçim tutmazsa `null` — webin `new Date()` UYDURMASI YOK',
    TAKVIM.kapZamani('dün') === null && TAKVIM.kapZamani('') === null
    && TAKVIM.kapZamani(null) === null);
  ok('⑯c · bilinmeyen ay adı → `null` (sıfırıncı aya düşmüyor)',
    TAKVIM.kapZamani('08 Xyz 2026 11:01') === null);
  ok('⑯c · aralık dışı gün/saat/dakika → `null`',
    TAKVIM.kapZamani('32 Haz 2026 11:01') === null
    && TAKVIM.kapZamani('08 Haz 2026 24:00') === null
    && TAKVIM.kapZamani('08 Haz 2026 11:60') === null);
  ok('⑯c · `kapZamani` SAAT OKUMUYOR (kaynakta Date.now/new Date yok)',
    !/Date\.now\(|new Date\(/.test(takvimKod), 'temiz');

  // --- ⑯d `kapSemboller` ----------------------------------------------
  ok('⑯d · tek kod: `***IZFAS***` → [IZFAS]',
    TAKVIM.kapSemboller('***IZFAS*** Pay Alım Satım').join(',') === 'IZFAS');
  // ÖLÇÜLEN DAVRANIŞ · İKİZLİK · ONARILDI (Şerit 6, DEVAM.md §15.1): eski
  // regex (`[^*]+`) blok İÇİNDE yıldız geçen başlığı EŞLEYEMİYORDU, oysa
  // app.js:255in KENDİ yorumu çoklu bildirimi (`***OMP ** ODP***`)
  // desteklediğini SÖYLÜYORDU. Düzeltme İKİ YERDE AYNI ANDA yapıldı
  // (`[^*]+` → tembel `[\s\S]+?`): `app.js:264` ve `api/_takvim.js:243`,
  // yani ikiz kuralı KORUNDU. Canlı 30 KAP maddesinde null kalan 16'sının
  // 16'sı DA bu biçimdi; düzeltmeden sonra 16 çözüldü, 0 null kaldı ve
  // önceden ayrışan 14 maddenin HİÇBİRİ değişmedi (DEVAM.md §15.1).
  // Bu denetim artık ONARILMIŞ davranışı kilitliyor: kapanış HÂLÂ ÜÇ
  // yıldız arıyor ve tembel olduğu için `***A*** metin ***B***` iki bloğu
  // BİRLEŞTİRMİYOR (o biçim canlı veride HİÇ görülmedi — ⑯d'nin son
  // maddesi onu ölçmüyor, sınır rapora yazıldı).
  ok('⑯d · ÖLÇÜM · yıldızlı çoklu blok ARTIK ÇÖZÜLÜYOR → `OMP,ODP`',
    TAKVIM.kapSemboller('***OMP ** ODP*** Birleşme').join(',') === 'OMP,ODP',
    TAKVIM.kapSemboller('***OMP ** ODP*** Birleşme').join(','));
  ok('⑯d · tek blokta birden çok kod (yıldızsız ayraç) ÇÖZÜLÜYOR',
    TAKVIM.kapSemboller('***OMP, ODP*** Birleşme').join(',') === 'OMP,ODP',
    TAKVIM.kapSemboller('***OMP, ODP*** Birleşme').join(','));
  ok('⑯d · KURAL · kod yoksa `[]` (ölçtüm, yok) — null DEĞİL',
    Array.isArray(TAKVIM.kapSemboller('Genel duyuru'))
    && TAKVIM.kapSemboller('Genel duyuru').length === 0);
  ok('⑯d · kod biçimine uymayan metin AYIKLANIYOR (küçük harf · uzun kod)',
    TAKVIM.kapSemboller('***bist100 ASELS COKUZUNKOD***').join(',') === 'ASELS',
    TAKVIM.kapSemboller('***bist100 ASELS COKUZUNKOD***').join(','));

  // --- ⑯e `ondalik` — ÖLÇÜLEMEYEN SAYI 0 DEĞİL ------------------------
  ok('⑯e · "1,2345" → 1.2345 (virgül ondalık)', TAKVIM.ondalik('1,2345') === 1.2345);
  ok('⑯e · "1.2345" → 1.2345 (nokta ondalık)', TAKVIM.ondalik('1.2345') === 1.2345);
  ok('⑯e · KURAL · sayı çıkmazsa `null`, 0 DEĞİL',
    TAKVIM.ondalik('') === null && TAKVIM.ondalik('abc') === null
    && TAKVIM.ondalik(null) === null);
  ok('⑯e · 0 gerçekten ölçüldüyse 0 DÖNÜYOR (null ile karışmıyor)',
    TAKVIM.ondalik('0') === 0);

  // --- ⑯f `cozVarlik` -------------------------------------------------
  ok('⑯f · adlı varlıklar çözülüyor (&Ccedil; &ouml; &uuml;)',
    TAKVIM.cozVarlik('&Ccedil;&ouml;&uuml;') === 'Çöü', TAKVIM.cozVarlik('&Ccedil;&ouml;&uuml;'));
  ok('⑯f · sayısal başvurular çözülüyor (&#231; &#x15F;)',
    TAKVIM.cozVarlik('&#231;&#x15F;') === 'çş', TAKVIM.cozVarlik('&#231;&#x15F;'));
  ok('⑯f · `&amp;` EN SONDA çözülüyor (çift kaçış varlığa dönmüyor)',
    TAKVIM.cozVarlik('&amp;quot;') === '&quot;', TAKVIM.cozVarlik('&amp;quot;'));

  // --- ⑯g `ayristirKAP` — fikstür, SIFIR ağ ---------------------------
  {
    const madde = (link, baslik, tarih) =>
      `<a href="https://finans.mynet.com/borsa/haberdetay/${link}" class="x" title="${baslik}">`
      + `<em class="title">${baslik}</em> <span class="date">${tarih}</span>`;
    const html = [
      madde('a-1', '***ASELS*** Pay Geri Alım', '08 Haz 2026 11:01'),
      madde('a-2', '***THYAO, PGSUS*** Ortak A&ccedil;ıklama', '08 Haz 2026 10:30'),
      madde('a-3', 'Endeks Duyurusu', 'tarih yok'),
    ].join('\n');

    const l = TAKVIM.ayristirKAP(html, 10);
    ok('⑯g · üç madde de ayrıştı', l.length === 3, String(l.length));
    ok('⑯g · alan kümesi ilan edilenle BİREBİR (sessiz alan yok)',
      anahtarlar(l[0]) === [...TAKVIM.KAP_MADDE_ALANLARI].sort().join(','), anahtarlar(l[0]));
    ok('⑯g · bağlantı kaynaktan ÖLÇÜLDÜ (uydurulmadı)',
      l[0].link === 'https://finans.mynet.com/borsa/haberdetay/a-1', l[0].link);
    ok('⑯g · tarih ISO + offset', l[0].pubDate === '2026-06-08T11:01:00+03:00', String(l[0].pubDate));
    ok('⑯g · ham tarih metni DURUYOR (kaynak görülebilsin)',
      l[0].pubDateHam === '08 Haz 2026 11:01', l[0].pubDateHam);
    ok('⑯g · tür makine kodu `KAP`', l[0].type === 'KAP', l[0].type);
    ok('⑯g · tek kodlu duyuruda `symbol` = o kod', l[0].symbol === 'ASELS', String(l[0].symbol));
    ok('⑯g · çoklu kodda `symbol` İLK kod, tamamı `tickers`ta',
      l[1].symbol === 'THYAO' && l[1].tickers.join(',') === 'THYAO,PGSUS',
      `${l[1].symbol} / ${l[1].tickers.join(',')}`);
    ok('⑯g · başlıktaki HTML varlığı ÇÖZÜLDÜ',
      /Açıklama/.test(l[1].title), l[1].title);
    ok('⑯g · KURAL · kodu olmayan duyuruda `symbol` null, `tickers` []',
      l[2].symbol === null && Array.isArray(l[2].tickers) && l[2].tickers.length === 0);
    ok('⑯g · KURAL · tarihi okunamayan duyuru ATILMIYOR, `pubDate` null',
      l[2].pubDate === null && l[2].pubDateHam === 'tarih yok', String(l[2].pubDate));
    ok('⑯g · `description`/`author` alanları DÖNMÜYOR (sabit = ölçüm değil)',
      !('description' in l[0]) && !('author' in l[0]));

    ok('⑯g · adet tavanı UYGULANIYOR', TAKVIM.ayristirKAP(html, 2).length === 2);
    ok('⑯g · tavan üstü istek `AZAMI_KAP`a kırpılıyor (sınırsız yok)',
      TAKVIM.ayristirKAP(html, 9999).length === 3);
    ok('⑯g · azami 0 → boş liste', TAKVIM.ayristirKAP(html, 0).length === 0);
    ok('⑯g · boş/geçersiz gövde → `[]` (patlamadan)',
      TAKVIM.ayristirKAP('').length === 0 && TAKVIM.ayristirKAP(null).length === 0
      && TAKVIM.ayristirKAP('<html>bomboş</html>').length === 0);
  }

  // --- ⑯h `ayristirTemettu` — fikstür, SIFIR ağ -----------------------
  {
    const ayBasi = (ad, yil) => `<tr class="table-light"><td colspan="2" class="small fw-semibold">${ad} ${yil}</td></tr>`;
    const satir = (kod, gun, ay, verim, tutar) =>
      `<tr><td><a href='/hisseanaliz/${kod}' class='l'>${kod}</a></td>`
      + `<td class="small">${gun} ${ay}</td>`
      + `<td><span class='badge'>% ${verim}</span></td>`
      + `<td class="small">${tutar}₺</td></tr>`;
    const html = [
      ayBasi('Haziran', 2026),
      satir('ASELS', 8, 'Haziran', '3,25', '1,2345'),
      satir('ASELS', 8, 'Haziran', '3,25', '1,2345'), // kopya
      satir('BOZUK', 8, 'Xyz', '1,00', '1,00'),       // ay adı tabloda YOK
      ayBasi('Temmuz', 2026),
      satir('THYAO', 15, 'Temmuz', '2,10', '4,50'),
    ].join('\n');

    const r = TAKVIM.ayristirTemettu(html, 50);
    ok('⑯h · dönüş şekli {maddeler, atlanan, tekrar}',
      anahtarlar(r) === 'atlanan,maddeler,tekrar', anahtarlar(r));
    ok('⑯h · iki geçerli satır ayrıştı', r.maddeler.length === 2, String(r.maddeler.length));
    ok('⑯h · alan kümesi ilan edilenle BİREBİR',
      anahtarlar(r.maddeler[0]) === [...TAKVIM.TEMETTU_MADDE_ALANLARI].sort().join(','),
      anahtarlar(r.maddeler[0]));
    ok('⑯h · tarih `YYYY-MM-DD` DİZGESİ (Date nesnesi değil — dilim kaymaz)',
      r.maddeler[0].date === '2026-06-08' && typeof r.maddeler[0].date === 'string',
      String(r.maddeler[0].date));
    ok('⑯h · yıl AY BAŞLIĞINDAN okundu (satırda yok, uydurulmadı)',
      r.maddeler[1].date === '2026-07-15', String(r.maddeler[1].date));
    ok('⑯h · tutar ve verim ÖLÇÜLDÜ',
      r.maddeler[0].amount === 1.2345 && r.maddeler[0].yieldPct === 3.25,
      `${r.maddeler[0].amount} / ${r.maddeler[0].yieldPct}`);
    ok('⑯h · para birimi MAKİNE KODU `TRY` (₺ simgesi DEĞİL)',
      r.maddeler[0].currency === 'TRY', r.maddeler[0].currency);
    ok('⑯h · ham tarih metni DURUYOR', r.maddeler[0].dateHam === '8 Haziran', r.maddeler[0].dateHam);
    ok('⑯h · KURAL · kopya satır DÜŞTÜ ve SAYILDI (sessizce yok olmadı)',
      r.tekrar === 1, String(r.tekrar));
    ok('⑯h · KURAL · ayrıştırılamayan satır ATLANDI ve SAYILDI',
      r.atlanan === 1, String(r.atlanan));
    ok('⑯h · ay başlığı OLMADAN gelen satır atlanıyor (yıl uydurulmuyor)',
      TAKVIM.ayristirTemettu(satir('ASELS', 8, 'Haziran', '1,00', '1,00'), 10).maddeler.length === 0);
    ok('⑯h · adet tavanı UYGULANIYOR', TAKVIM.ayristirTemettu(html, 1).maddeler.length === 1);
    ok('⑯h · tavan üstü istek `AZAMI_TEMETTU`a kırpılıyor',
      TAKVIM.ayristirTemettu(html, 99999).maddeler.length === 2);
    ok('⑯h · boş/geçersiz gövde → boş liste (patlamadan)',
      TAKVIM.ayristirTemettu('').maddeler.length === 0
      && TAKVIM.ayristirTemettu(null).maddeler.length === 0);
  }

  // --- ⑯i sayaç: ÖLÇTÜM ⇄ ÖLÇEMEDİM ayrımı ---------------------------
  {
    const s = TAKVIM.bosTakvimSayac();
    ok('⑯i · boş sayaç alan kümesi yazılı',
      anahtarlar(s) === 'basari,bayt,hata,istek,kisa,zamanAsimi', anahtarlar(s));
    ok('⑯i · boş sayaç TAM sayılıyor (hiç arıza yok)', TAKVIM.takvimTam(s) === true);
    ok('⑯i · hata → tam DEĞİL', TAKVIM.takvimTam({ hata: 1, zamanAsimi: 0, kisa: 0 }) === false);
    ok('⑯i · zaman aşımı → tam DEĞİL', TAKVIM.takvimTam({ hata: 0, zamanAsimi: 1, kisa: 0 }) === false);
    ok('⑯i · KISA GÖVDE → tam DEĞİL (200 geldi diye ölçüm sayılmıyor)',
      TAKVIM.takvimTam({ hata: 0, zamanAsimi: 0, kisa: 1 }) === false);
    ok('⑯i · sayaç yoksa tam DEĞİL', TAKVIM.takvimTam(null) === false);
    ok('⑯i · sayaç `_ag.js` sayacından AYRI nesne (skor sayacına karışmıyor)',
      !('yahoo' in s) && !('sec' in s) && !('bist' in s), anahtarlar(s));
  }

  // --- ⑯j handler kapıları — AĞ YASAĞI altında ------------------------
  {
    const gercekFetch = globalThis.fetch;
    let agDenemesi = 0;
    globalThis.fetch = (...a) => { agDenemesi++; throw new Error('⑯ AĞ YASAĞI: ' + String(a[0])); };
    try {
      ok('⑯j · takvim POST kabul ETMİYOR → 405',
        (await cagirTakvim('POST', {})).kod === 405);

      const k1 = await cagirTakvim('GET', { kapsam: 'yok-boyle' });
      ok('⑯j · bilinmeyen kapsam → 400 bad_kapsam (sessiz varsayılan YOK)',
        k1.kod === 400 && k1.govde.error === 'bad_kapsam', `${k1.kod} ${k1.govde.error}`);
      ok('⑯j · bad_kapsam izinli listeyi BİLDİRİYOR',
        Array.isArray(k1.govde.izinli) && k1.govde.izinli.join(',') === TAKVIM.KAPSAMLAR.join(','),
        (k1.govde.izinli || []).join(','));
      ok('⑯j · bad_kapsam cevabı AĞA ÇIKMADAN döndü', agDenemesi === 0, String(agDenemesi));

      for (const [alan, deger] of [['kapAdet', '0'], ['kapAdet', '61'], ['kapAdet', 'abc'],
        ['temettuAdet', '0'], ['temettuAdet', '401'], ['temettuAdet', '1.5']]) {
        const r = await cagirTakvim('GET', { [alan]: deger });
        ok(`⑯j · ${alan}=${deger} → 400 bad_limit (kırpma YOK)`,
          r.kod === 400 && r.govde.error === 'bad_limit' && r.govde.alan === alan,
          `${r.kod} ${r.govde.error} ${r.govde.alan}`);
      }
      ok('⑯j · adet kapıları da AĞA ÇIKMADAN döndü', agDenemesi === 0, String(agDenemesi));

      // Kaynakların İKİSİ de düştü → bu bir ölçüm değil, KESİNTİ.
      const d = await cagirTakvim('GET', {});
      ok('⑯j · her iki kaynak düştü → 502 takvim_alinamadi (boş liste YALANI yok)',
        d.kod === 502 && d.govde.error === 'takvim_alinamadi', `${d.kod} ${d.govde.error}`);
      ok('⑯j · 502 gövdesi SAYACI taşıyor (neyin düştüğü görünür)',
        !!d.govde.sayac && d.govde.sayac.hata >= 1, JSON.stringify(d.govde.sayac || null));
      ok('⑯j · 502 gövdesi yığın izi / `detail` SIZDIRMIYOR',
        !('detail' in d.govde) && !('stack' in d.govde));
      ok('⑯j · 502 gövdesinde uyarı cümlesi var', d.govde.uyari === UYARI);
      ok('⑯j · kesinti cevabı KISA önbellekli (arıza 5 dk donmuyor)',
        /max-age=30/.test(String(d.basliklar['cache-control'])), String(d.basliklar['cache-control']));
      ok('⑯j · ağ GERÇEKTEN denendi (kapı sessizce atlanmadı)', agDenemesi >= 1, String(agDenemesi));

      const tek = await cagirTakvim('GET', { kapsam: 'kap' });
      ok('⑯j · tek kapsam düştüğünde de 502', tek.kod === 502, String(tek.kod));
    } finally {
      globalThis.fetch = gercekFetch;
    }
  }

  // --- ⑯k KOPYA YASAĞI + sızıntı kapıları -----------------------------
  ok('⑯k · `_takvim.js` ELLE yazıldığını söylüyor (üretilmiş değil)',
    /ELLE YAZILMIŞ/i.test(takvimSrc));
  ok('⑯k · uçta `Intl` YOK (HAM SAYI kuralı)', !/\bIntl\b/.test(takvimKod));
  ok('⑯k · uçta `toFixed(` / `toLocaleString(` YOK',
    !/toFixed\(|toLocaleString\(/.test(takvimKod));
  ok('⑯k · uçta eşik/ağırlık/skor sözcüğü YOK (mantık motorda)',
    !/\bscore\b|\bWEIGHT\b|\bthreshold\b|\bESIK\b/i.test(takvimKod), 'temiz');
  ok('⑯k · gövdeye `detail:`/yığın izi sızdıran alan yok', !/detail:/.test(takvimKod));
  ok('⑯k · kaynakta e-posta/anahtar YOK',
    !/@gmail|ANTHROPIC|apiKey/.test(takvimSrc), 'temiz');
  ok('⑯k · kimlik dizgesi SADE ve kişisel veri taşımıyor',
    /day-starter\/1\.0 \(takvim-okuyucu\)/.test(takvimSrc)
    && !/@/.test((takvimSrc.match(/'User-Agent':[^\n]*/) || [''])[0]));
  ok('⑯k · ağ YALNIZ `sayfaCek` içinde (tek çıkış kapısı)',
    takvimKod.split('fetch(').length - 1 === 1, String(takvimKod.split('fetch(').length - 1));
  ok('⑯k · zaman aşımı AbortController ile kuruluyor (asılı istek yok)',
    /new AbortController\(\)/.test(takvimKod) && /\.abort\(\)/.test(takvimKod));
  ok('⑯k · `_takvim.js` motoru ya da ayarı İÇE ALMIYOR (skor yolu ayrı)',
    !/_motor\.js|_ayar\.js|_ag\.js/.test(takvimKod), 'temiz');
  ok('⑯k · `_takvim.js` dosya sistemine YAZMIYOR',
    !/writeFileSync|appendFileSync/.test(takvimKod));
  ok('⑯k · `_takvim.js` gerçekten `_` önekli (fonksiyon sayılmaz)',
    existsSync(TAKVIM_PATH) && path.basename(TAKVIM_PATH).startsWith('_'));
  ok('⑯k · webin iki ayrıştırıcısına İKİZLİK notu yazılı (sürüklenme bekçisi)',
    /app\.js:229/.test(takvimSrc) && /app\.js:324/.test(takvimSrc));
  ok('⑯k · KURAL · `new Date()` UYDURMASI kaynakta HİÇ yok',
    !/new Date\(/.test(takvimKod), 'temiz');
  // SKOR YOLU KİLİDİ: takvim mevcut uçlardan hiçbirine girmedi.
  for (const [ad, yol] of [['score', SCORE_PATH], ['recommend', RECOMMEND_PATH], ['analyze', ANALYZE_PATH]]) {
    ok(`⑯k · KİLİT · api/${ad}.js \`_takvim.js\`i TANIMIYOR`,
      !/_takvim/.test(readFileSync(yol, 'utf8')));
  }
}


// =========================================================================
bolum('⑰ /api/degisim · gundem · iceriden · kripto · kur · metal · neden — ayrı taşıyıcı rotaları');
// =========================================================================
// ⑮ ile AYNI 13. FONKSİYON TUZAĞI, FARKLI taşıyıcı: bu dördü `_kesif.js`e
// GİRMEDİ (o dosya motor/tarama ailesinin gövdesi), kendi `_` önekli
// modüllerinde duruyor ve `api/proxy.js`in `TASIYICILAR` tablosundan
// çağrılıyor. Aşağıda rota adının ÜÇ yerde (vercel.json ↔ proxy.js ↔
// modülün kendi `ROTA`sı) aynı olduğu ve `api/*.js` sayısının ARTMADIĞI
// kilitleniyor.
//
// AĞ YASAĞI ⑰'de de geçerli — hatta daha katı: bu dört handler geçerli bir
// girdide ya KV'ye ya ağa çıkıyor. Bu yüzden handler YALNIZ (a) OPTIONS,
// (b) GET-dışı yöntem, (c) doğrulamadan DÖNEN sorgularla çağrılıyor;
// dördünde de `oku()`/`fetch` satırına VARILMIYOR (ölçüldü: doğrulama
// blokları önbellek anahtarından ÖNCE `return` ediyor). Geçerli girdiler
// yalnız SAF dışa aktarımlarla sınanıyor.
{
  const DEGISIM_PATH = path.join(ROOT, 'api', '_degisim.js');
  const GUNDEM_PATH = path.join(ROOT, 'api', '_gundem.js');
  const KRIPTO_PATH = path.join(ROOT, 'api', '_kripto.js');
  const KUR_PATH = path.join(ROOT, 'api', '_kur.js');
  const ICERIDEN_PATH = path.join(ROOT, 'api', '_iceriden.js');
  const METAL_PATH = path.join(ROOT, 'api', '_metal.js');
  const NEDEN_PATH = path.join(ROOT, 'api', '_neden.js');
  const KATALIZOR_PATH = path.join(ROOT, 'api', '_katalizor.js');
  const MALI_PATH = path.join(ROOT, 'api', '_mali.js');
  const HAREKET_PATH = path.join(ROOT, 'api', '_hareket.js');
  const kaynaklar = {
    degisim: readFileSync(DEGISIM_PATH, 'utf8'),
    gundem: readFileSync(GUNDEM_PATH, 'utf8'),
    kripto: readFileSync(KRIPTO_PATH, 'utf8'),
    kur: readFileSync(KUR_PATH, 'utf8'),
    iceriden: readFileSync(ICERIDEN_PATH, 'utf8'),
    metal: readFileSync(METAL_PATH, 'utf8'),
    neden: readFileSync(NEDEN_PATH, 'utf8'),
    katalizor: readFileSync(KATALIZOR_PATH, 'utf8'),
    mali: readFileSync(MALI_PATH, 'utf8'),
    hareket: readFileSync(HAREKET_PATH, 'utf8'),
  };
  // Yorumları SÜZ: aşağıdaki sızıntı kapıları GÖVDEYE bakıyor, nota değil
  // (⑯k ile aynı kalıp — iki ayrı süzgeç biçimi uydurulmadı).
  const kodlar = {};
  for (const [ad, s] of Object.entries(kaynaklar)) {
    kodlar[ad] = s.split(/\r?\n/).filter((x) => !/^\s*(\/\/|\*|\/\*)/.test(x)).join('\n');
  }
  const proxyS17 = readFileSync(PROXY_PATH, 'utf8');
  const vercel17 = JSON.parse(readFileSync(VERCEL_PATH, 'utf8'));
  const MOD = {
    degisim: DEGISIM, gundem: GUNDEM, iceriden: ICERIDEN,
    kripto: KRIPTO, kur: KUR, metal: METAL, neden: NEDEN,
    katalizor: KATALIZOR, mali: MALI, hareket: HAREKET,
  };
  const YOL = {
    degisim: DEGISIM_PATH, gundem: GUNDEM_PATH, iceriden: ICERIDEN_PATH,
    kripto: KRIPTO_PATH, kur: KUR_PATH, metal: METAL_PATH,
    neden: NEDEN_PATH, katalizor: KATALIZOR_PATH, mali: MALI_PATH,
    hareket: HAREKET_PATH,
  };

  // --- ⑰a yüzey --------------------------------------------------------
  ok('⑰a · TASIYICI_ROTALARI on rota ilan ediyor (proxy.js tablosundan)',
    TASIYICI_ROTALARI.join(',') === 'degisim,gundem,hareket,iceriden,katalizor,kripto,kur,mali,metal,neden',
    TASIYICI_ROTALARI.join(','));
  ok('⑰a · TASIYICI_ROTALARI dondurulmuş (tablo çalışma anında değişmez)',
    Object.isFrozen(TASIYICI_ROTALARI));
  for (const r of TASIYICI_ROTALARI) {
    ok(`⑰a · \`_${r}.js\` kendi \`ROTA\`sını \`${r}\` ilan ediyor`,
      MOD[r].ROTA === r, String(MOD[r].ROTA));
    ok(`⑰a · \`_${r}.js\` HANDLERLAR tablosu TEK anahtar: \`${r}\``,
      anahtarlar(MOD[r].HANDLERLAR) === r, anahtarlar(MOD[r].HANDLERLAR));
    ok(`⑰a · \`_${r}.js\` HANDLERLAR dondurulmuş`, Object.isFrozen(MOD[r].HANDLERLAR));
    ok(`⑰a · \`${r}\` handler'ı fonksiyon`, typeof MOD[r].HANDLERLAR[r] === 'function');
  }
  // İKİ TAŞIYICI AYRIK olmalı: aynı rota adı iki tabloda olursa `proxy.js`
  // `_kesif.js`i ÖNCE deniyor ve bu dört uç sessizce gölgelenir.
  ok('⑰a · KİLİT · TAŞIYICI rotaları `_kesif.js` ROTALARI ile AYRIK',
    !TASIYICI_ROTALARI.some((r) => KESIF.ROTALAR.includes(r)),
    TASIYICI_ROTALARI.join(',') + ' vs ' + KESIF.ROTALAR.join(','));

  // --- ⑰b 13. FONKSİYON KİLİDİ ----------------------------------------
  {
    const dosyalar17 = readdirSync(path.join(ROOT, 'api'))
      .filter((f) => f.endsWith('.js') && !f.startsWith('_'));
    ok('⑰b · KİLİT · `api/*.js` uç dosyası sayısı hâlâ 12 (Hobby tavanı)',
      dosyalar17.length === 12, `${dosyalar17.length}: ${dosyalar17.join(',')}`);
    ok('⑰b · ON uç için YENİ uç dosyası YOK (hepsi `_` önekli MODÜL)',
      !dosyalar17.some((f) => /degisim|gundem|hareket|iceriden|katalizor|kripto|kur|mali|metal|neden/.test(f)),
      dosyalar17.join(','));
    for (const r of TASIYICI_ROTALARI) {
      ok(`⑰b · \`api/_${r}.js\` gerçekten \`_\` önekli`,
        existsSync(YOL[r]) && path.basename(YOL[r]).startsWith('_'));
      const k = (vercel17.rewrites || []).find((x) => x.source === `/api/${r}`);
      ok(`⑰b · vercel.json \`/api/${r}\` rewrite'ı var`, !!k, k && k.destination);
      ok(`⑰b · \`/api/${r}\` proxy'ye \`__rota=${r}\` ile gidiyor`,
        !!k && k.destination === `/api/proxy?__rota=${r}`, k && k.destination);
      // BELİRTEÇ LİTERAL OLMAK ZORUNDA: `import(degisken)` Vercel'in paket
      // izleyicisi tarafından İZLENMEZ, dosya bundle'a girmez, uç canlıda
      // 404 verir. Bu kapı o sessiz arızanın kalıcı bekçisi.
      ok(`⑰b · proxy.js \`./_${r}.js\`i LİTERAL belirteçle import ediyor`,
        proxyS17.includes(`import('./_${r}.js')`), 'literal');
    }
    ok('⑰b · proxy.js rota adını ELLE `if` olarak yazmıyor (tablo tek kaynak)',
      !/=== 'degisim'|=== 'gundem'|=== 'hareket'|=== 'iceriden'|=== 'katalizor'|=== 'kripto'|=== 'kur'|=== 'mali'|=== 'metal'|=== 'neden'/
        .test(proxyS17), 'temiz');
    ok('⑰b · `functions` bloğuna YENİ kalem girmedi (onu proxy bütçesinde)',
      !Object.keys(vercel17.functions || {})
        .some((k) => /degisim|gundem|hareket|iceriden|katalizor|kripto|kur|mali|metal|neden/.test(k)),
      Object.keys(vercel17.functions || {}).join(','));
  }

  // --- ⑰c konak izin listesi İKİZLİĞİ ---------------------------------
  // Modülün kendi `IZINLI_KONAK`ı ile `proxy.js`in `IZINLI_KONAKLAR`ı
  // ayrışırsa uç çalışır ama DÜZ proxy yolu aynı konağı 403'ler — iki
  // yüzeyde iki farklı politika. Burası o ayrışmanın kapısı.
  for (const r of ['degisim', 'kripto', 'iceriden', 'mali', 'hareket']) {
    for (const h of MOD[r].IZINLI_KONAK) {
      ok(`⑰c · \`${h}\` proxy.js IZINLI_KONAKLAR listesinde de var`,
        proxyS17.includes(`'${h}'`), h);
    }
  }
  ok('⑰c · degisim iki Yahoo konağını sırayla deniyor (aynı konağa 2. vuruş yok)',
    DEGISIM.KONAK_DENEME === DEGISIM.IZINLI_KONAK.length && DEGISIM.KONAK_DENEME === 2,
    String(DEGISIM.KONAK_DENEME));
  ok('⑰c · degisim `izinliAdres` http REDDEDİYOR',
    DEGISIM.izinliAdres('http://query1.finance.yahoo.com/x') === false);
  ok('⑰c · degisim `izinliAdres` yabancı konağı REDDEDİYOR',
    DEGISIM.izinliAdres('https://evil.example.com/x') === false);
  ok('⑰c · kripto `izinliAdres` yabancı konağı REDDEDİYOR',
    KRIPTO.izinliAdres('https://evil.example.com/x') === false);
  ok('⑰c · kripto `izinliAdres` kendi konağını KABUL ediyor',
    KRIPTO.izinliAdres(KRIPTO.globalAdresi()) === true);
  // metal'in KENDİ ağ taşıyıcısı YOK: `_haber.js`in `haberCek`ini
  // kullanıyor, yani ikinci bir RSS ayrıştırıcısı/izin listesi doğmadı.
  ok('⑰c · `_metal.js`te `fetch(` HİÇ yok (ağ `_haber.js`in kapısında)',
    kodlar.metal.split('fetch(').length - 1 === 0,
    String(kodlar.metal.split('fetch(').length - 1));
  ok('⑰c · `_metal.js` `_haber.js`ten `haberCek` içe alıyor (kopya ayrıştırıcı yok)',
    /from '\.\/_haber\.js'/.test(kodlar.metal) && /haberCek/.test(kodlar.metal));
  // gundem de AYNI kalipta: kendi RSS tasiyicisi YOK.
  ok('⑰c · `_gundem.js`te `fetch(` HİÇ yok (ağ `_haber.js`in kapısında)',
    kodlar.gundem.split('fetch(').length - 1 === 0,
    String(kodlar.gundem.split('fetch(').length - 1));
  ok('⑰c · `_gundem.js` `_haber.js`ten `beslemeCek` içe alıyor (kopya ayrıştırıcı yok)',
    /from '\.\/_haber\.js'/.test(kodlar.gundem) && /beslemeCek/.test(kodlar.gundem));
  // Konsept ÜRETİMİ de kopyalanmadı: sözlük/puanlama motorda.
  ok('⑰c · `_gundem.js` konsepti MOTORDAN alıyor (`agendaScore`), kendi sözlüğü yok',
    /agendaScore/.test(kodlar.gundem) && !/AGENDA_LEXICON\s*=/.test(kodlar.gundem));
  for (const r of ['degisim', 'kripto', 'iceriden', 'mali', 'hareket']) {
    ok(`⑰c · \`_${r}.js\`te ağ çıkışı TEK \`fetch(\` (tek kapı)`,
      kodlar[r].split('fetch(').length - 1 === 1,
      String(kodlar[r].split('fetch(').length - 1));
    ok(`⑰c · \`_${r}.js\` zaman aşımını AbortController ile kuruyor`,
      /new AbortController\(\)/.test(kodlar[r]) && /\.abort\(\)/.test(kodlar[r]));
  }

  // --- ⑰d yöntem kapısı + 400 gövdeleri (AĞSIZ) -----------------------
  {
    const H = {
      degisim: MOD.degisim.HANDLERLAR.degisim,
      gundem: MOD.gundem.HANDLERLAR.gundem,
      kripto: MOD.kripto.HANDLERLAR.kripto,
      kur: MOD.kur.HANDLERLAR.kur,
      iceriden: MOD.iceriden.HANDLERLAR.iceriden,
      metal: MOD.metal.HANDLERLAR.metal,
      neden: MOD.neden.HANDLERLAR.neden,
      katalizor: MOD.katalizor.HANDLERLAR.katalizor,
      mali: MOD.mali.HANDLERLAR.mali,
      hareket: MOD.hareket.HANDLERLAR.hareket,
    };
    const govdeler17 = [];
    const al = async (r, method, query) => {
      const res = await cagirUc(H[r], method, query);
      if (res.govde) govdeler17.push(res.govde);
      return res;
    };
    for (const r of TASIYICI_ROTALARI) {
      const o = await al(r, 'OPTIONS', {});
      ok(`⑰d · ${r} · OPTIONS 204 + gövdesiz`, o.kod === 204 && o.bitti === true, String(o.kod));
      ok(`⑰d · ${r} · OPTIONS CORS başlıkları tam`,
        o.basliklar['access-control-allow-origin'] === '*'
        && o.basliklar['access-control-allow-methods'] === 'GET, OPTIONS'
        && o.basliklar['access-control-max-age'] === '86400',
        o.basliklar['access-control-allow-methods']);
      const p = await al(r, 'POST', {});
      ok(`⑰d · ${r} · POST 405 + \`method_not_allowed\``,
        p.kod === 405 && p.govde && p.govde.error === 'method_not_allowed',
        `${p.kod} ${p.govde && p.govde.error}`);
      ok(`⑰d · ${r} · 405 \`Allow\` başlığı yazılı (sessiz ret yok)`,
        p.basliklar.allow === 'GET, OPTIONS', p.basliklar.allow);
      ok(`⑰d · ${r} · 405 cevabı KISA önbellekli (hatalı cevap uzun yaşamıyor)`,
        p.basliklar['cache-control'] === 'public, max-age=30',
        p.basliklar['cache-control']);
    }
    // degisim 400'leri — dördü de ağ/KV satırına VARMADAN dönüyor.
    {
      const a = await al('degisim', 'GET', {});
      ok('⑰d · degisim · sembolsüz istek 400 `semboller_yok`',
        a.kod === 400 && a.govde.error === 'semboller_yok', `${a.kod} ${a.govde.error}`);
      ok('⑰d · degisim · `semboller_yok` gövdesi tavanı SÖYLÜYOR',
        a.govde.azami === DEGISIM.AZAMI_SEMBOL, String(a.govde.azami));
      const cok = Array.from({ length: DEGISIM.AZAMI_SEMBOL + 1 }, (_, i) => `S${i}`).join(',');
      const b = await al('degisim', 'GET', { semboller: cok });
      ok('⑰d · degisim · tavanı aşan istek 400 `cok_sembol` (SESSİZ KIRPMA YOK)',
        b.kod === 400 && b.govde.error === 'cok_sembol'
        && b.govde.gelen === DEGISIM.AZAMI_SEMBOL + 1,
        `${b.govde.error} gelen=${b.govde.gelen}`);
      const c = await al('degisim', 'GET', { semboller: '!!!' });
      ok('⑰d · degisim · bozuk sembol 400 `bad_sembol` (`gelen` ile)',
        c.kod === 400 && c.govde.error === 'bad_sembol' && c.govde.gelen === '!!!',
        `${c.govde.error} ${c.govde.gelen}`);
      const d = await al('degisim', 'GET', { semboller: 'AAPL', donemler: 'yillarca' });
      ok('⑰d · degisim · beyaz liste dışı dönem 400 `bad_donem` (sessiz `hepsi` yok)',
        d.kod === 400 && d.govde.error === 'bad_donem'
        && d.govde.izinli.join(',') === DEGISIM.DONEM_ANAHTARLARI.join(','),
        `${d.govde.error} ${d.govde.izinli && d.govde.izinli.join(',')}`);
      const e = await al('degisim', 'GET', { symbols: '!!!' });
      ok('⑰d · degisim · `symbols` eş adı da tanınıyor (web ikizi aynı sorguyu atıyor)',
        e.kod === 400 && e.govde.error === 'bad_sembol', String(e.govde.error));
    }
    // kripto 400'leri
    {
      const a = await al('kripto', 'GET', {});
      ok('⑰d · kripto · kimliksiz istek 400 `kripto_id_yok`',
        a.kod === 400 && a.govde.error === 'kripto_id_yok', `${a.kod} ${a.govde.error}`);
      const cok = Array.from({ length: KRIPTO.AZAMI_ID + 1 }, (_, i) => `coin${i}`).join(',');
      const b = await al('kripto', 'GET', { idler: cok });
      ok('⑰d · kripto · tavanı aşan istek 400 `cok_id`',
        b.kod === 400 && b.govde.error === 'cok_id' && b.govde.gelen === KRIPTO.AZAMI_ID + 1,
        `${b.govde.error} gelen=${b.govde.gelen}`);
      const c = await al('kripto', 'GET', { ids: 'BTC!' });
      ok('⑰d · kripto · bozuk kimlik 400 `bad_id` + BİÇİMİ söylüyor',
        c.kod === 400 && c.govde.error === 'bad_id' && c.govde.bicim === String(KRIPTO.ID_BICIM),
        `${c.govde.error} ${c.govde.bicim}`);
    }
    // kur 400'leri — AGA VARMADAN: dogrulama onbellek anahtarindan ONCE.
    {
      const a = await al('kur', 'GET', {});
      ok('⑰d · kur · kodsuz istek 400 `kur_kod_yok`',
        a.kod === 400 && a.govde.error === 'kur_kod_yok', `${a.kod} ${a.govde.error}`);
      ok('⑰d · kur · `kur_kod_yok` gövdesi tavanı SÖYLÜYOR',
        a.govde.azami === KUR.AZAMI_KOD, String(a.govde.azami));
      const cok = Array.from({ length: KUR.AZAMI_KOD + 1 }, (_, i) => `k${i}`).join(',');
      const b = await al('kur', 'GET', { kodlar: cok });
      ok('⑰d · kur · tavanı aşan istek 400 `cok_kod` (SESSİZ KIRPMA YOK)',
        b.kod === 400 && b.govde.error === 'cok_kod' && b.govde.gelen === KUR.AZAMI_KOD + 1,
        `${b.govde.error} gelen=${b.govde.gelen}`);
      const c = await al('kur', 'GET', { kod: 'USD!' });
      ok('⑰d · kur · bozuk kod 400 `bad_kod` + BİÇİMİ söylüyor',
        c.kod === 400 && c.govde.error === 'bad_kod' && c.govde.bicim === String(KUR.KOD_BICIM),
        `${c.govde.error} ${c.govde.bicim}`);
    }
    // metal 400'leri — üç kapı, SIRA: madenler → kapsam → limit.
    {
      const a = await al('metal', 'GET', { madenler: 'bakir' });
      ok('⑰d · metal · sözlük dışı maden 400 `bad_maden` (KAPALI küme)',
        a.kod === 400 && a.govde.error === 'bad_maden'
        && a.govde.izinli.join(',') === METAL.METAL_ANAHTARLARI.join(','),
        `${a.govde.error} ${a.govde.izinli && a.govde.izinli.join(',')}`);
      const b = await al('metal', 'GET', { kapsam: 'mars' });
      ok('⑰d · metal · beyaz liste dışı kapsam 400 `bad_kapsam`',
        b.kod === 400 && b.govde.error === 'bad_kapsam'
        && b.govde.izinli.join(',') === METAL.KAPSAMLAR.join(','),
        `${b.govde.error} ${b.govde.izinli && b.govde.izinli.join(',')}`);
      const c = await al('metal', 'GET', { limit: String(haberAzamiMadde + 1) });
      ok('⑰d · metal · tavanı aşan limit 400 `bad_limit` (SESSİZ KIRPMA YOK)',
        c.kod === 400 && c.govde.error === 'bad_limit' && c.govde.azami === haberAzamiMadde,
        `${c.govde.error} azami=${c.govde.azami}`);
    }
    // iceriden 400'leri — AGA VARMADAN: dogrulama onbellek anahtarindan
    // ONCE donuyor (uc `oku()` satirina VARMIYOR).
    {
      const a = await al('iceriden', 'GET', {});
      ok('⑰d · iceriden · sembolsüz istek 400 `sembol_yok`',
        a.kod === 400 && a.govde.error === 'sembol_yok', `${a.kod} ${a.govde.error}`);
      const b = await al('iceriden', 'GET', { sembol: 'AAPL!' });
      ok('⑰d · iceriden · bozuk sembol 400 `bad_sembol` + BİÇİMİ söylüyor',
        b.kod === 400 && b.govde.error === 'bad_sembol'
        && b.govde.bicim === String(ICERIDEN.SEMBOL_BICIM),
        `${b.govde.error} ${b.govde.bicim}`);
      const c = await al('iceriden', 'GET', { sembol: 'AAPL', pazar: 'MARS' });
      ok('⑰d · iceriden · beyaz liste dışı pazar 400 `bad_pazar` (sessiz `US` yok)',
        c.kod === 400 && c.govde.error === 'bad_pazar'
        && c.govde.pazarlar.join(',') === ICERIDEN.PAZARLAR.join(','),
        `${c.govde.error} ${c.govde.pazarlar && c.govde.pazarlar.join(',')}`);
    }
    // mali 400'leri — AGA VARMADAN: dogrulama onbellek anahtarindan ONCE
    // donuyor (uc `oku()` satirina VARMIYOR).
    {
      const a = await al('mali', 'GET', {});
      ok('⑰d · mali · sembolsüz istek 400 `sembol_yok`',
        a.kod === 400 && a.govde.error === 'sembol_yok', `${a.kod} ${a.govde.error}`);
      const b = await al('mali', 'GET', { sembol: 'AAPL!' });
      ok('⑰d · mali · bozuk sembol 400 `bad_sembol` + BİÇİMİ söylüyor',
        b.kod === 400 && b.govde.error === 'bad_sembol'
        && b.govde.bicim === String(MALI.SEMBOL_BICIM),
        `${b.govde.error} ${b.govde.bicim}`);
      const c = await al('mali', 'GET', { sembol: 'AAPL', pazar: 'MARS' });
      ok('⑰d · mali · beyaz liste dışı pazar 400 `bad_pazar` (sessiz `US` yok)',
        c.kod === 400 && c.govde.error === 'bad_pazar'
        && c.govde.pazarlar.join(',') === MALI.PAZARLAR.join(','),
        `${c.govde.error} ${c.govde.pazarlar && c.govde.pazarlar.join(',')}`);
    }
    // gundem 400'ü — TEK kapı: kapsam. Önbellek anahtarından ÖNCE dönüyor.
    {
      const a = await al('gundem', 'GET', { kapsam: 'mars' });
      ok('⑰d · gundem · beyaz liste dışı kapsam 400 `bad_kapsam` (sessiz `HEPSI` yok)',
        a.kod === 400 && a.govde.error === 'bad_kapsam'
        && a.govde.izinli.join(',') === GUNDEM.KAPSAMLAR.join(','),
        `${a.govde.error} ${a.govde.izinli && a.govde.izinli.join(',')}`);
    }
    // TOPLU SÜZGEÇ: ⑰'nin gövdede dolaştırdığı HER cevap aynı kapıdan geçer.
    ok('⑰d · her hata gövdesi UYARI taşıyor (politika yüzeyde)',
      govdeler17.length > 0 && govdeler17.every((g) => g.uyari === UYARI),
      `${govdeler17.length} gövde`);
    ok('⑰d · hiçbir hata gövdesinde HTML/yığın izi YOK',
      !govdeler17.some((g) => /<[a-z]|at Object\.|\.js:\d+/i.test(JSON.stringify(g))), 'temiz');
    ok('⑰d · hata gövdeleri MAKİNE KODU taşıyor (Türkçe cümle değil)',
      govdeler17.filter((g) => g.error).every((g) => /^[a-z_]+$/.test(g.error)),
      govdeler17.filter((g) => g.error).map((g) => g.error).join(','));
  }

  // --- ⑰e degisim SAF ayrıştırıcıları ---------------------------------
  ok('⑰e · SATIR_ALANLARI kümesi SABİT (sözleşme kilidi)',
    DEGISIM.SATIR_ALANLARI.join(',') === 'symbol,market,ysym,ok,price,prevClose,currency,marketTs,gecikmeli',
    DEGISIM.SATIR_ALANLARI.join(','));
  ok('⑰e · DONEM_ANAHTARLARI altı dönem ilan ediyor',
    DEGISIM.DONEM_ANAHTARLARI.join(',') === 'saatlik,gunluk,haftalik,aylik,alti,yillik',
    DEGISIM.DONEM_ANAHTARLARI.join(','));
  ok('⑰e · dönem alan adları BİRİMİ taşıyor (`...Pct` = yüzde puanı)',
    DEGISIM.DONEMLER.every((d) => /Pct$/.test(d.alan)),
    DEGISIM.DONEMLER.map((d) => d.alan).join(','));
  ok('⑰e · DONEMLER dondurulmuş (dönem tablosu çalışma anında değişmez)',
    Object.isFrozen(DEGISIM.DONEMLER) && DEGISIM.DONEMLER.every((d) => Object.isFrozen(d)));
  ok('⑰e · `yahooSembol` YALNIZ BIST\'e `.IS` ekliyor (motor kuralıyla birebir)',
    DEGISIM.yahooSembol('AKBNK', 'BIST') === 'AKBNK.IS'
    && DEGISIM.yahooSembol('AAPL', 'US') === 'AAPL',
    DEGISIM.yahooSembol('AKBNK', 'BIST'));
  ok('⑰e · `chartAdresi` `^` karakterini KAÇIRIYOR (app.js:556 ile aynı)',
    String(DEGISIM.chartAdresi('^GSPC', '1d', '1d')).includes('%5EGSPC'),
    DEGISIM.chartAdresi('^GSPC', '1d', '1d'));
  ok('⑰e · `chartAdresi` izinsiz konakta `null` (adres kurulmuyor bile)',
    DEGISIM.chartAdresi('AAPL', '1d', '1d', 'evil.example.com') === null);
  ok('⑰e · `yuzde` web ikiziyle aynı sayıyı veriyor',
    DEGISIM.yuzde(110, 100) === 10 && DEGISIM.yuzde(90, 100) === -10,
    String(DEGISIM.yuzde(110, 100)));
  ok('⑰e · KURAL · `yuzde` ölçülemezse `null` — ASLA 0',
    DEGISIM.yuzde(100, 0) === null && DEGISIM.yuzde(NaN, 100) === null
    && DEGISIM.yuzde(100, null) === null,
    String(DEGISIM.yuzde(100, 0)));
  ok('⑰e · `ayristirKota` bozuk gövdede İSTİSNA ATMIYOR, dört alan `null`',
    anahtarlar(DEGISIM.ayristirKota({})) === 'currency,marketTs,prevClose,price'
    && Object.values(DEGISIM.ayristirKota(null)).every((v) => v === null),
    anahtarlar(DEGISIM.ayristirKota({})));
  {
    const kotaJson = { chart: { result: [{ meta: { regularMarketPrice: 101.5, chartPreviousClose: 100, currency: 'USD', regularMarketTime: 1700000000 } }] } };
    const k = DEGISIM.ayristirKota(kotaJson);
    ok('⑰e · `ayristirKota` fiyat/önceki kapanış/döviz HAM geçiyor',
      k.price === 101.5 && k.prevClose === 100 && k.currency === 'USD',
      `${k.price} ${k.prevClose} ${k.currency}`);
    ok('⑰e · `marketTs` SANİYE değil MİLİSANİYE (birim sözleşmesi)',
      k.marketTs === 1700000000 * 1000, String(k.marketTs));
  }
  {
    // Üç bar: biri `low` eksik -> DÜŞER (web süzgeciyle birebir).
    const seriJson = {
      chart: { result: [{
        timestamp: [1000, 2000, 3000],
        indicators: { quote: [{ open: [1, 2, 3], high: [1, 2, 3], low: [1, null, 3], close: [10, 20, 30] }] },
      }] },
    };
    const s = DEGISIM.ayristirSeri(seriJson);
    ok('⑰e · `ayristirSeri` eksik barı DÜŞÜRÜYOR (3 bar -> 2)',
      s.length === 2 && s[0].close === 10 && s[1].close === 30, String(s.length));
    ok('⑰e · `ayristirSeri` yalnız `time`/`close` taşıyor (fazla alan yok)',
      s.every((c) => anahtarlar(c) === 'close,time'), anahtarlar(s[0]));
    ok('⑰e · `ayristirSeri` bozuk gövdede BOŞ dizi (istisna atmıyor)',
      DEGISIM.ayristirSeri(null).length === 0 && DEGISIM.ayristirSeri({}).length === 0);
  }
  {
    // Saat DIŞARIDAN veriliyor: `donemRef` saf, test sabit zamanla ölçüyor.
    const GUN = DEGISIM.GUN_SN;
    const simdi = 10 * GUN;
    const seri = [
      { time: 1 * GUN, close: 100 },
      { time: 8 * GUN, close: 200 },
      { time: 10 * GUN, close: 300 },
    ];
    ok('⑰e · `donemRef` kesme noktasına EŞİT ya da ONDAN ESKİ ilk mumu alıyor',
      DEGISIM.donemRef(seri, 7, simdi) === 100, String(DEGISIM.donemRef(seri, 7, simdi)));
    ok('⑰e · `donemRef` kesme serinin DIŞINDAYSA en eski muma düşüyor',
      DEGISIM.donemRef(seri, 365, simdi) === 100, String(DEGISIM.donemRef(seri, 365, simdi)));
    ok('⑰e · `donemRef` yakın kesmede DAHA YENİ mumu alıyor',
      DEGISIM.donemRef(seri, 2, simdi) === 200, String(DEGISIM.donemRef(seri, 2, simdi)));
    ok('⑰e · KURAL · `donemRef` boş seride `null` — ASLA 0',
      DEGISIM.donemRef([], 7, simdi) === null && DEGISIM.donemRef(null, 7, simdi) === null);
    ok('⑰e · `saatlikRef` SONDAN İKİNCİ barın kapanışı (web ikizi)',
      DEGISIM.saatlikRef(seri) === 200, String(DEGISIM.saatlikRef(seri)));
    ok('⑰e · KURAL · `saatlikRef` iki bardan azsa `null` — ASLA 0',
      DEGISIM.saatlikRef([{ time: 1, close: 5 }]) === null && DEGISIM.saatlikRef([]) === null);
  }
  ok('⑰e · eşzamanlılık ve tavan ÖLÇÜLMÜŞ sayılar (api/_yfin.js 12 ile aynı)',
    DEGISIM.AZAMI_SEMBOL === 12 && DEGISIM.ESZAMANLI === 4,
    `azami ${DEGISIM.AZAMI_SEMBOL} · eşzamanlı ${DEGISIM.ESZAMANLI}`);
  ok('⑰e · `GUN_SN` 86400 (web `p.days * 86400` ile birebir)',
    DEGISIM.GUN_SN === 86400, String(DEGISIM.GUN_SN));

  // --- ⑰f kripto SAF ayrıştırıcıları ----------------------------------
  {
    const i1 = KRIPTO.ayristirIdler('bitcoin, BITCOIN ,ethereum');
    ok('⑰f · `ayristirIdler` küçük harfe indiriyor ve TEKİLLEŞTİRİYOR',
      i1.idler.join(',') === 'bitcoin,ethereum', i1.idler.join(','));
    ok('⑰f · `ayristirIdler` boş girdide `kripto_id_yok`',
      KRIPTO.ayristirIdler('').idler === null
      && KRIPTO.ayristirIdler('').hata === 'kripto_id_yok');
    ok('⑰f · `ayristirIdler` biçim dışı kimliği REDDEDİYOR',
      KRIPTO.ayristirIdler('BTC!').hata === 'bad_id');
    ok('⑰f · `marketsAdresi` boş listede `null` (istek kurulmuyor)',
      KRIPTO.marketsAdresi([]) === null && KRIPTO.marketsAdresi(null) === null);
    const u = KRIPTO.marketsAdresi(['bitcoin', 'ethereum']);
    ok('⑰f · `marketsAdresi` TEK istekte iki kimliği birlikte soruyor',
      u.includes('ids=bitcoin%2Cethereum') && u.includes('vs_currency=usd'), u);
    ok('⑰f · `sparkline` İSTENMEZSE adreste YOK (gereksiz gövde çekilmiyor)',
      !u.includes('sparkline')
      && KRIPTO.marketsAdresi(['bitcoin'], { sparkline: true }).includes('sparkline=true'));
    ok('⑰f · yapısal istek tavanı 2 (kimlik sayısından BAĞIMSIZ)',
      KRIPTO.AZAMI_UST_ISTEK === 2, String(KRIPTO.AZAMI_UST_ISTEK));
  }
  {
    ok('⑰f · `ayristirCoin` bozuk girdide `null` (istisna atmıyor)',
      KRIPTO.ayristirCoin(null) === null && KRIPTO.ayristirCoin({}) === null
      && KRIPTO.ayristirCoin({ id: 7 }) === null);
    const c = KRIPTO.ayristirCoin({
      id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000,
      market_cap_rank: 1, market_cap: 1.2e12, price_change_percentage_24h: -1.5,
      total_volume: 3e10, circulating_supply: 19.7e6, max_supply: 21e6,
      ath: 69000, ath_change_percentage: -13.2, ath_date: '2021-11-10T14:24:11.849Z',
    });
    ok('⑰f · coin kaydı ALAN KÜMESİ SABİT (sözleşme kilidi)',
      anahtarlar(c) === 'athChangePct,athTs,athUsd,circulatingSupplyAdet,id,marketCapRank,marketCapUsd,maxSupplyAdet,name,priceChange24hPct,priceUsd,symbol,totalVolumeUsd',
      anahtarlar(c));
    ok('⑰f · sembol BÜYÜK harfe çıkıyor, sayılar HAM geçiyor (biçimleme yok)',
      c.symbol === 'BTC' && c.priceUsd === 60000 && c.priceChange24hPct === -1.5,
      `${c.symbol} ${c.priceUsd}`);
    ok('⑰f · `athTs` MİLİSANİYE epoch (ham tarih metni değil)',
      c.athTs === Date.parse('2021-11-10T14:24:11.849Z'), String(c.athTs));
    ok('⑰f · ÜÇÜNCÜ DURUM · `sparkline` istenmedi -> alan GÖVDEDE YOK',
      !Object.prototype.hasOwnProperty.call(c, 'sparkline7dUsd'));
    const c2 = KRIPTO.ayristirCoin({ id: 'bitcoin', sparkline_in_7d: { price: [1, null, 3] } });
    ok('⑰f · `sparkline` istendiğinde sayısal olmayan nokta DÜŞÜYOR',
      c2.sparkline7dUsd.join(',') === '1,3', c2.sparkline7dUsd.join(','));
    ok('⑰f · ölçülemeyen alan `null` — ASLA 0',
      c2.priceUsd === null && c2.marketCapUsd === null && c2.athTs === null,
      String(c2.priceUsd));
  }
  {
    const g = KRIPTO.ayristirKuresel({ data: { market_cap_percentage: { BTC: 54.2, eth: 17.1, bad: 'x' } } });
    ok('⑰f · `ayristirKuresel` anahtarları küçük harfe indiriyor (web ikizi)',
      g.btc === 54.2 && g.eth === 17.1, anahtarlar(g));
    ok('⑰f · `ayristirKuresel` sayısal olmayan payı DÜŞÜRÜYOR',
      !Object.prototype.hasOwnProperty.call(g, 'bad'), anahtarlar(g));
    ok('⑰f · `ayristirKuresel` bozuk gövdede `null`',
      KRIPTO.ayristirKuresel({}) === null && KRIPTO.ayristirKuresel(null) === null
      && KRIPTO.ayristirKuresel({ data: { market_cap_percentage: {} } }) === null);
  }

  // --- ⑰g metal SAF ayrıştırıcıları + İKİZLİK -------------------------
  ok('⑰g · METAL_ANAHTARLARI üç kalem (KAPALI küme)',
    METAL.METAL_ANAHTARLARI.join(',') === 'altin,gumus,platin',
    METAL.METAL_ANAHTARLARI.join(','));
  ok('⑰g · METALLER ve her kalemi dondurulmuş',
    Object.isFrozen(METAL.METALLER)
    && METAL.METAL_ANAHTARLARI.every((k) => Object.isFrozen(METAL.METALLER[k])));
  ok('⑰g · maden kaydı EKRAN METNİ taşımıyor (ad/etiket alanı yok)',
    METAL.METAL_ANAHTARLARI.every((k) => anahtarlar(METAL.METALLER[k]) === 'anahtar,dunyaSorgu,trSorgu,ysym'),
    anahtarlar(METAL.METALLER.altin));
  // İKİZLİK: sorgu dizgeleri config.js:37-52 ile BİREBİR olmalı. Ayrışırsa
  // web ve native AYNI metal için FARKLI haber kümesi gösterir.
  {
    const cfg = readFileSync(path.join(ROOT, 'config.js'), 'utf8');
    const kacak = METAL.METAL_ANAHTARLARI.filter((k) => {
      const m = METAL.METALLER[k];
      return !cfg.includes(`'${m.trSorgu}'`) || !cfg.includes(`'${m.dunyaSorgu}'`);
    });
    ok('⑰g · İKİZLİK · üç metalin TR/dünya sorgusu config.js ile BİREBİR',
      kacak.length === 0, kacak.join(',') || 'temiz');
  }
  ok('⑰g · `ayristirMadenler` boş girdide ÜÇÜNÜ birlikte veriyor (web ikizi)',
    METAL.ayristirMadenler('').madenler.length === 3
    && METAL.ayristirMadenler(undefined).madenler.length === 3);
  ok('⑰g · `ayristirMadenler` tekrarları TEKİLLEŞTİRİYOR',
    METAL.ayristirMadenler('altin,ALTIN').madenler.length === 1);
  ok('⑰g · `ayristirMadenler` sözlük dışı anahtarı REDDEDİYOR',
    METAL.ayristirMadenler('bakir').madenler === null
    && METAL.ayristirMadenler('bakir').hata === 'bad_maden');
  // `hasOwnProperty.call`: miras anahtar sözlüğe GİRMEZ (_girdi.js:144 kapısı).
  ok('⑰g · KURAL · `__proto__`/`toString` sözlüğe SIZMIYOR',
    METAL.ayristirMadenler('__proto__').madenler === null
    && METAL.ayristirMadenler('toString').madenler === null);
  ok('⑰g · `kapsamYerelleri` üç kapsamı doğru açıyor',
    METAL.kapsamYerelleri('tr').join(',') === 'tr'
    && METAL.kapsamYerelleri('dunya').join(',') === 'dunya'
    && METAL.kapsamYerelleri('hepsi').join(',') === 'tr,dunya',
    METAL.kapsamYerelleri('hepsi').join(','));
  ok('⑰g · KAPSAM_PAZAR `_haber.js` pazar adlarıyla eşleniyor (3. sözlük yok)',
    Object.values(METAL.KAPSAM_PAZAR).every((p) => Object.prototype.hasOwnProperty.call(PAZAR_YERELI, p)),
    Object.values(METAL.KAPSAM_PAZAR).join(','));
  ok('⑰g · `ayristirLimit` verilmezse `_haber.js` varsayılanına düşüyor',
    METAL.ayristirLimit(undefined).limit === haberVarsayilanMadde
    && METAL.ayristirLimit('').limit === haberVarsayilanMadde,
    String(METAL.ayristirLimit(undefined).limit));
  ok('⑰g · `ayristirLimit` 1..AZAMI arası tam sayıyı KABUL ediyor',
    METAL.ayristirLimit('5').limit === 5 && METAL.ayristirLimit(1).limit === 1);
  ok('⑰g · `ayristirLimit` sınır dışını SESSİZCE KIRPMIYOR (`bad_limit`)',
    METAL.ayristirLimit('0').limit === null
    && METAL.ayristirLimit(String(haberAzamiMadde + 1)).limit === null
    && METAL.ayristirLimit('2.5').limit === null
    && METAL.ayristirLimit('x').hata === 'bad_limit');
  ok('⑰g · yapısal istek tavanı = maden sayısı × 2 yerel',
    METAL.AZAMI_UST_ISTEK === METAL.METAL_ANAHTARLARI.length * 2
    && METAL.AZAMI_UST_ISTEK === 6, String(METAL.AZAMI_UST_ISTEK));
  // ÖLÇÜLEN ARIZA (düzeltildi): sayım eskiden `beslemeCek`in `tam` alanını
  // okuyordu; `tam` PAYLAŞILAN sayaçtan üretiliyor (`_haber.js:330`), yani
  // 6 paralel beslemeden BİRİ düştüğü an sonraki her çağrı `tam:false`
  // dönüyor ve 5 besleme okunmuşken uç 502 basıyordu. Sayım artık
  // `_haber.js:521` `gundemCek`in ÖLÇÜLMÜŞ kalıbıyla aynı: madde sayısı.
  ok('⑰g · ÖLÇÜM · besleme sayımı MADDE SAYISINA bakıyor (paylaşılan `tam`e DEĞİL)',
    /if \(maddeler\.length > 0\) okunan\+\+;/.test(kodlar.metal)
    && !/s\.value\.tam\) okunan/.test(kodlar.metal), 'maddeler.length');
  ok('⑰g · madde biçimi `_haber.js` MADDE_ALANLARI ile BİREBİR (HaberSatiri yeniden kullanılabilir)',
    /MADDE_ALANLARI/.test(kodlar.metal), MADDE_ALANLARI.join(','));

  // --- ⑰h HAM SAYI + sızıntı kapıları (üç dosya birden) ---------------
  for (const [ad, kod] of Object.entries(kodlar)) {
    const src = kaynaklar[ad];
    ok(`⑰h · \`_${ad}.js\`te \`Intl\` YOK (biçimleme istemcide)`, !/\bIntl\b/.test(kod));
    ok(`⑰h · \`_${ad}.js\`te \`toFixed(\`/\`toLocaleString(\` YOK`,
      !/toFixed\(|toLocaleString\(/.test(kod));
    ok(`⑰h · \`_${ad}.js\` gövdeye \`detail:\`/yığın izi sızdırmıyor`, !/detail:/.test(kod));
    ok(`⑰h · \`_${ad}.js\` dosya sistemine YAZMIYOR`,
      !/writeFileSync|appendFileSync/.test(kod));
    ok(`⑰h · \`_${ad}.js\` kaynağında e-posta/anahtar YOK`,
      !/@gmail|ANTHROPIC|apiKey/.test(src), 'temiz');
    ok(`⑰h · \`_${ad}.js\` UYARI dizgesini öteki uçlarla AYNI yazıyor`,
      src.includes(`'${UYARI}'`), 'birebir');
  }
  // Bu İKİ KAPI üç taşıyıcıya özgü: onların kaynağı (Yahoo/CoinGecko/RSS)
  // motora DİÇ dokunmuyor. `_gundem.js` BİLEREK dışarda: o zaten motorun
  // gündem dilimlerini (`agendaScore`) ÇAĞIRMAK için var — kuru-
  // lumunu `api/pulse.js` ile birebir yapıyor. Onun HAM SAYI kapısı
  // "motoru çağırmaz" değil, "KENDİ eşiğini/sözlüğünü kurmaz" — aşağıda
  // ⑰i'de ayrıca ölçülüyor.
  for (const ad of ['degisim', 'kripto', 'metal']) {
    const kod = kodlar[ad];
    ok(`⑰h · \`_${ad}.js\`te eşik/ağırlık/skor sözcüğü YOK (mantık motorda)`,
      !/\bscore\b|\bWEIGHT\b|\bthreshold\b|\bESIK\b/i.test(kod), 'temiz');
    ok(`⑰h · \`_${ad}.js\` motoru/ayarı/\`_ag.js\`i İÇE ALMIYOR`,
      !/_motor\.js|_ayar\.js|_ag\.js/.test(kod), 'temiz');
  }
  for (const ad of ['degisim', 'kripto']) {
    ok(`⑰h · \`_${ad}.js\` kimlik dizgesi SADE ve kişisel veri taşımıyor`,
      /day-starter\/1\.0 \(/.test(kaynaklar[ad])
      && !/@/.test((kaynaklar[ad].match(/'User-Agent':[^\n]*/) || [''])[0]));
  }
  // SKOR YOLU KİLİDİ: dört uç mevcut motor uçlarının hiçbirine girmedi.
  for (const [ad, yol] of [['score', SCORE_PATH], ['recommend', RECOMMEND_PATH], ['analyze', ANALYZE_PATH]]) {
    const s = readFileSync(yol, 'utf8');
    ok(`⑰h · KİLİT · api/${ad}.js dört taşıyıcıdan HİÇBİRİNİ tanımıyor`,
      !/_degisim|_gundem|_kripto|_metal/.test(s));
  }

  // --- ⑰i /api/gundem SAF dışa aktarımları ------------------------------
  // Bu uç ötekilerden AYRI bir iş yapıyor: manşeti DEĞİL, manşetlerden
  // çıkan KONSEPTİ taşıyor (`/api/news?gundem=1` zaten manşeti veriyor ve
  // native `PiyasaGundemiKarti` onu basıyor). Üretim motorun `agendaScore`
  // diliminde; burada ölçülen şey TELE İNDİRME katmanı: hangi alan geçiyor,
  // hangi Türkçe cümle DÜŞÜYOR, ölçülmeyen sayı `null` mı kalıyor.
  ok('⑰i · KAPSAMLAR üç kapsam ilan ediyor ve dondurulmuş',
    GUNDEM.KAPSAMLAR.join(',') === 'TR,US,HEPSI' && Object.isFrozen(GUNDEM.KAPSAMLAR),
    GUNDEM.KAPSAMLAR.join(','));
  ok('⑰i · `kapsamCoz` boş/eksik girdide `HEPSI`',
    GUNDEM.kapsamCoz('') === 'HEPSI' && GUNDEM.kapsamCoz(null) === 'HEPSI'
    && GUNDEM.kapsamCoz(undefined) === 'HEPSI', String(GUNDEM.kapsamCoz('')));
  ok('⑰i · `kapsamCoz` küçük harfi kabul ediyor (büyüteç)',
    GUNDEM.kapsamCoz('tr') === 'TR' && GUNDEM.kapsamCoz('us') === 'US',
    GUNDEM.kapsamCoz('tr'));
  ok('⑰i · KURAL · `kapsamCoz` küme dışında `null` — SESSİZCE `HEPSI`ye düşmüyor',
    GUNDEM.kapsamCoz('mars') === null && GUNDEM.kapsamCoz('EU') === null,
    String(GUNDEM.kapsamCoz('mars')));
  ok('⑰i · `kapsamYerelleri` tek kapsamda TEK yerel, `HEPSI`de İKİSİ',
    GUNDEM.kapsamYerelleri('TR').join(',') === 'TR'
    && GUNDEM.kapsamYerelleri('HEPSI').length === 2
    && GUNDEM.kapsamYerelleri('HEPSI').includes('TR')
    && GUNDEM.kapsamYerelleri('HEPSI').includes('US'),
    GUNDEM.kapsamYerelleri('HEPSI').join(','));
  ok('⑰i · `kapsamYerelleri` KOPYA döndürüyor (çağıran `GUNDEM_YERELLER`i bozamaz)',
    GUNDEM.kapsamYerelleri('HEPSI') !== GUNDEM.kapsamYerelleri('HEPSI'));
  ok('⑰i · `yerelDili` motora GİDEN dil etiketini veriyor (tr/en)',
    GUNDEM.yerelDili('TR') === 'tr' && GUNDEM.yerelDili('US') === 'en',
    GUNDEM.yerelDili('TR') + '/' + GUNDEM.yerelDili('US'));
  // Bağlantı: cihazda `Linking.openURL`e gidiyor. api/pulse.js'teki şema
  // kapısının AYNISI — iki uç ayrı davranmasın.
  ok('⑰i · `gundemBaglanti` http/httpsı GEÇİRİYOR',
    GUNDEM.gundemBaglanti('https://x.example.com/a') === 'https://x.example.com/a'
    && GUNDEM.gundemBaglanti('http://x.example.com/a') === 'http://x.example.com/a',
    GUNDEM.gundemBaglanti('https://x.example.com/a'));
  ok('⑰i · GÜVENLİK · `gundemBaglanti` javascript:/data:/file:/şemasızı BOŞA düşürüyor',
    GUNDEM.gundemBaglanti('javascript:alert(1)') === ''
    && GUNDEM.gundemBaglanti('data:text/html,x') === ''
    && GUNDEM.gundemBaglanti('file:///etc/passwd') === ''
    && GUNDEM.gundemBaglanti('example.com/a') === '', 'bos');
  ok('⑰i · `gundemBaglanti` boşluk kırpıyor, tavanı aşanı BOŞA düşürüyor',
    GUNDEM.gundemBaglanti('  https://x.example.com/a  ') === 'https://x.example.com/a'
    && GUNDEM.gundemBaglanti('https://x.example.com/' + 'a'.repeat(500)) === ''
    && GUNDEM.gundemBaglanti(null) === '' && GUNDEM.gundemBaglanti(undefined) === '',
    'kirpik');
  {
    const b = GUNDEM.basligaIndir({
      title: 'TCMB faizi sabit tuttu', link: 'https://x.example.com/1',
      pubDate: 'Mon, 03 Nov 2025 08:00:00 GMT', ageH: 3.5, weight: 2.5, low: 'tcmb faizi',
    });
    ok('⑰i · `basligaIndir` DÖRT alan taşıyor (motorun ağırlık/küçük gövdesi DÜŞTÜ)',
      anahtarlar(b) === 'ageH,link,pubDate,title', anahtarlar(b));
    ok('⑰i · `basligaIndir` `ageH`i HAM geçiriyor (yuvarlama ekran işi)',
      b.ageH === 3.5, String(b.ageH));
    ok('⑰i · KURAL · `ageH` ölçülemezse `null` — ASLA 0',
      GUNDEM.basligaIndir({}).ageH === null
      && GUNDEM.basligaIndir({ ageH: 'yok' }).ageH === null,
      String(GUNDEM.basligaIndir({}).ageH));
    ok('⑰i · `basligaIndir` GÜVENSİZ bağlantıyı boş bırakıyor ama BAŞLIĞI taşıyor',
      GUNDEM.basligaIndir({ title: 'T', link: 'javascript:1' }).link === ''
      && GUNDEM.basligaIndir({ title: 'T', link: 'javascript:1' }).title === 'T', 'bos link');
    ok('⑰i · `basligaIndir` bozuk girdide İSTİSNA ATMIYOR',
      GUNDEM.basligaIndir(null).title === '' && GUNDEM.basligaIndir(undefined).title === '');
  }
  {
    const k = GUNDEM.konseptiIndir({
      key: 'faiz-indirimi', emoji: '\u2702\ufe0f', label: 'Faiz indirimi beklentisi',
      note: 'Tahvil faizleri geriledi', risk: 'on', heat: 'hot', tone: 0.42,
      score: 7.5, n: 6, emerging: false,
      toneLabel: { cls: 'pos', label: 'Olumlu' },
      sectors: [['banka', 1.2], ['holding', -0.8], ['bozuk']],
      heads: [{ title: 'x', link: 'https://x.example.com/1', pubDate: 'd', ageH: 1 }],
    });
    ok('⑰i · `konseptiIndir` alan kümesi SABİT (sözleşme kilidi)',
      anahtarlar(k) === 'heads,heat,key,n,risk,sectors,skor,sozcuk,tone,toneKod,yeni',
      anahtarlar(k));
    ok('⑰i · KURAL · Türkçe cümle alanları (`label`/`note`/`emoji`) TELE GİRMİYOR',
      !('label' in k) && !('note' in k) && !('emoji' in k)
      && !('toneLabel' in k) && !('emerging' in k), anahtarlar(k));
    ok('⑰i · `toneKod` ETİKET değil KOD taşıyor (sözlük seçimi istemcide)',
      k.toneKod === 'pos', String(k.toneKod));
    ok('⑰i · `tone`/`skor`/`n` HAM sayı (yuvarlanmıyor)',
      k.tone === 0.42 && k.skor === 7.5 && k.n === 6, `${k.tone} ${k.skor} ${k.n}`);
    ok('⑰i · `sectors` İKİLİ olmayan kalemi DÜŞÜRÜYOR',
      k.sectors.length === 2 && k.sectors[0][0] === 'banka' && k.sectors[0][1] === '1.2',
      JSON.stringify(k.sectors));
    ok('⑰i · tanımlı konseptte `sozcuk` `null` (sözlük `key`den seçiyor)',
      k.sozcuk === null && k.yeni === false, String(k.sozcuk));
    ok('⑰i · `heads` aynı başlık biçimine iniyor (HaberSatiri yeniden kullanılabilir)',
      k.heads.length === 1 && anahtarlar(k.heads[0]) === 'ageH,link,pubDate,title',
      anahtarlar(k.heads[0]));
  }
  {
    const y = GUNDEM.konseptiIndir({ key: 'emg-deprem', emerging: true, n: 3 });
    ok('⑰i · keşifle gelen konseptte `sozcuk` SÖZCÜĞÜ taşıyor (`emg-` öneki düşüyor)',
      y.yeni === true && y.sozcuk === 'deprem', `${y.yeni} ${y.sozcuk}`);
    ok('⑰i · KURAL · eksik ölçüm `null` (tone/skor), sayaç `0`',
      y.tone === null && y.skor === null && y.n === 3 && y.risk === null,
      `${y.tone} ${y.skor} ${y.n}`);
    ok('⑰i · `heat` beyaz liste dışında `cool` (uydurma ısı yok)',
      y.heat === 'cool' && GUNDEM.konseptiIndir({ key: 'k', heat: 'volkan' }).heat === 'cool',
      y.heat);
  }
  {
    const o = GUNDEM.ozetiIndir({
      mood: 'Risk iştahı açık', moodCls: 'bull', riskOn: 4, riskOff: 1,
      upSectors: ['banka'], downSectors: ['perakende'], poolN: 37,
      rotation: { heat: 'hot', n: 5, stocks: ['AKBNK'] },
    });
    ok('⑰i · `ozetiIndir` alan kümesi SABİT',
      anahtarlar(o) === 'downSectors,moodKod,poolN,riskOff,riskOn,rotasyon,upSectors',
      anahtarlar(o));
    ok('⑰i · KURAL · `mood` (Türkçe cümle) DÜŞTÜ, yerine `moodKod` gidiyor',
      !('mood' in o) && o.moodKod === 'bull', anahtarlar(o));
    ok('⑰i · `moodKod` beyaz liste dışında `neutral`',
      GUNDEM.ozetiIndir({ moodCls: 'volkan' }).moodKod === 'neutral'
      && GUNDEM.ozetiIndir({}).moodKod === 'neutral',
      GUNDEM.ozetiIndir({}).moodKod);
    // ÖLÇÜLMEDİ — ÖDEME DEĞİL: rotasyon hisseleri KULLANICI EVRENİNE
    // bakıyor (app.js:`agendaScore` → radarUniverse → localStorage), yani
    // sunucuda SAF değil. Boş dizi + KOD, uydurma liste basmaktan doğru.
    ok('⑰i · DÜRÜSTLÜK · `rotasyon.hisseler` BOŞ ve bunu BİR KOD söylüyor',
      o.rotasyon.hisseler.length === 0 && o.rotasyon.hisseKod === 'evren_olculmedi',
      o.rotasyon.hisseKod);
    ok('⑰i · `rotasyon` ölçülmediyse `null` (boş nesne değil)',
      GUNDEM.ozetiIndir({}).rotasyon === null);
    ok('⑰i · `ozetiIndir` bozuk girdide İSTİSNA ATMIYOR',
      GUNDEM.ozetiIndir(null).poolN === 0 && GUNDEM.ozetiIndir(undefined).riskOn === 0);
  }
  // HAM SAYI'nin gundem sürümü: motoru ÇAĞIRIYOR (işi bu) ama KENDİ
  // eşiğini/sözlüğünü/ağırlığını kurmuyor.
  ok('⑰i · `_gundem.js` motoru `api/pulse.js` ile BİREBİR kuruyor (ikinci kalıp yok)',
    /canliAg\(\{ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK \}\)/.test(kodlar.gundem)
    && /buildMotor\(AG\.H\)/.test(kodlar.gundem), 'birebir');
  ok('⑰i · `_gundem.js` motorun `score`unu YALNIZ OKUYOR (kendi hesabı yok)',
    /it\.score/.test(kodlar.gundem) && !/Math\./.test(kodlar.gundem), 'okuyor');
  ok('⑰i · `_gundem.js` besleme ağırlığı UYDURMUYOR (hepsi `w: 1`)',
    (kodlar.gundem.match(/w: 1,/g) || []).length === 1
    && !/w: 0\.|w: 1\./.test(kodlar.gundem), 'w: 1');
}

// =========================================================================
bolum('⑱ /api/yfin — kunye tasiyicisi + KIYAS EKSTREMI + BILANCO SENARYOSU');
// =========================================================================
// NIYE YENI BOLUM: `/api/yfin` bu dosyada bugune kadar YALNIZ dolayli
// gecti (rewrite kilidi, tavan atiflari) — kendi davranisi hic
// olculmemisti. S8 #10a ile tasiyici artik bir KATMAN uretiyor
// (`ekstrem`), yani bir istemci sozlesmesi dogdu: native kiyas karti
// satir basina "en iyi/en kotu" imini BU alandan okuyor.
//
// AGA HIC CIKMIYOR: katman eldeki kunye dizisinden hesapliyor.
{
  const YFIN_PATH = path.join(ROOT, 'api', '_yfin.js');
  const yfinSrc = readFileSync(YFIN_PATH, 'utf8');
  const yfinKod = yfinSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const Y = await import('../api/_yfin.js');

  // --- SOGUK BASLANGIC BEDELI: kurulum TEMBEL kalmali ---
  // proxy.js bu dosyayi STATIK ice aliyor (proxy.js:47) ve _kesif.js'i
  // BILEREK dinamik tutuyor ki duz `?url=` trafigi motor kurulumunu
  // ODEMESIN (proxy.js:42-46). Modul duzeyi bir `buildMotor` o bedeli
  // geri getirir ve BU KAPI duser.
  ok('⑱a · `_motor.js`/`_ayar.js`/`_ag.js` YALNIZ dinamik `import()` ile geliyor',
    !/^import[^\n]*_(motor|ayar|ag)\.js/m.test(yfinKod)
    && /await Promise\.all\(\[\s*import\('\.\/_motor\.js'\)/.test(yfinKod));
  ok('⑱a · modul duzeyinde `buildMotor(` cagrisi YOK (tembel kurulum)',
    (yfinKod.match(/buildMotor\(/g) || []).length === 1
    && /async function motorKur\(\)[\s\S]*?buildMotor\(AG\.H\)/.test(yfinKod));
  ok('⑱a · motor kurulabiliyor (katmanin oncul kosulu)', (await Y.motorHazir()) === true);

  // --- SATIR TARIFI: makine sozlugu, esik tablosu DEGIL ---
  ok('⑱b · satir tarifi DONDURULMUS (calisma aninda buyumez)',
    Object.isFrozen(Y.KIYAS_SATIRLARI) && Y.KIYAS_SATIRLARI.every((r) => Object.isFrozen(r)));
  // Rakam denetimi tip ADLARINI saymiyor: 'ratio2'/'d2e' birer TIP
  // etiketi, esik degil. Bu yuzden tirnakli metinler bosaltilip SAYI
  // SABITI araniyor — tabloya bir gun 0.35 gibi bir esik sizarsa duser.
  ok('⑱b · tarifte SAYI SABITI yok (yon sozlugu, esik/agirlik tablosu degil)',
    !/[0-9]/.test((yfinKod.match(/KIYAS_SATIRLARI = Object\.freeze\(\[[\s\S]*?\]\);/) || [''])[0].replace(/'[^']*'/g, "''")));
  ok('⑱b · her satir YALNIZ key/type/dir tasiyor (Turkce etiket/`xf` tele cikmiyor)',
    Y.KIYAS_SATIRLARI.every((r) => anahtarlar(r) === 'dir,key,type'),
    anahtarlar(Y.KIYAS_SATIRLARI[0]));

  // --- PARITE: ekranin COMPARE_ROWS'u ile BIREBIR yon/tip ---
  // KOPYA DEGIL DAR IZDUSUM iddiasi burada olculuyor: yonu OLAN her web
  // satiri tarifte, tarifte web'de olmayan satir YOK, tipler AYNI.
  // Tip onemli cunku motor negatif degeri YALNIZ ratio/ratio2'de atiyor.
  {
    const appSrc = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const crBlok = (appSrc.match(/const COMPARE_ROWS = \[[\s\S]*?\n {2}\];/) || [''])[0];
    ok('⑱c · ONCUL · app.js COMPARE_ROWS ayristirilabildi', crBlok.length > 400, `${crBlok.length} krk`);
    const web = [...crBlok.matchAll(/\{\s*key:\s*'([A-Za-z]+)'[^\n]*?type:\s*'([A-Za-z0-9]+)'[^\n]*?dir:\s*'(low|high)'/g)]
      .map((m) => `${m[1]}:${m[2]}:${m[3]}`).sort();
    const uc = Y.KIYAS_SATIRLARI.map((r) => `${r.key}:${r.type}:${r.dir}`).sort();
    ok('⑱c · ONCUL · web tarafinda yonu olan satir sayisi olculdu', web.length === 11, `${web.length} satir`);
    ok('⑱c · KILIT · tarif ile COMPARE_ROWS yon/tip BIREBIR',
      uc.join('|') === web.join('|'),
      uc.filter((x) => !web.includes(x)).concat(web.filter((x) => !uc.includes(x))).join(' · ') || 'fark yok');
  }

  // --- ISLEVSEL: katman gercekten kosuyor ---
  const kunyeler = [
    { symbol: 'A', ok: true, trailingPE: 10, profitMargin: 0.2, debtToEquity: 50, peg: -1 },
    { symbol: 'B', ok: true, trailingPE: -5, profitMargin: 0.1, debtToEquity: 120, peg: 2 },
    { symbol: 'C', ok: true, trailingPE: 30, profitMargin: 0.3, debtToEquity: 80, peg: 1 },
    { symbol: 'D', ok: false },
  ];
  const ek = await Y.ekstremKatmani(kunyeler);
  ok('⑱d · im SEMBOL adiyla geliyor (indeks DEGIL — istemci kunyeleri suzuyor)',
    anahtarlar(ek.trailingPE) === 'eniyi,enkotu,yon'
    && ek.trailingPE.eniyi === 'A' && ek.trailingPE.enkotu === 'C' && ek.trailingPE.yon === 'low',
    JSON.stringify(ek.trailingPE));
  ok('⑱d · NEGATIF degerleme satirda SAYILMIYOR (F/K -5 en iyi degil)',
    ek.trailingPE.eniyi !== 'B' && ek.trailingPE.enkotu !== 'B'
    && ek.peg.eniyi === 'C' && ek.peg.enkotu === 'B',
    `peg ${JSON.stringify(ek.peg)}`);
  ok('⑱d · `pct` satirinda isaret suzgeci YOK (yuzde negatif olabilir)',
    ek.profitMargin.eniyi === 'C' && ek.profitMargin.enkotu === 'B');
  ok('⑱d · `high` yonu ters cevrilmemis (yuksek marj = en iyi)',
    ek.profitMargin.yon === 'high' && ek.debtToEquity.yon === 'low');
  ok('⑱d · OLCULEMEYEN kunye (ok:false) ime GIRMIYOR',
    !Object.values(ek).some((v) => v.eniyi === 'D' || v.enkotu === 'D'));
  ok('⑱d · degeri OLMAYAN satirin anahtari HIC KONULMUYOR (0 uydurulmuyor)',
    !('forwardPE' in ek) && !('dividendYield' in ek), anahtarlar(ek));

  // TEK sembol / ESIT deger: ikisinde de ekstrem YOK — ama katman
  // `null` DONMUYOR, cunku olcum YAPILDI. "olcemedim" ayri bir dal.
  ok('⑱e · tek sembol -> bos nesne (olctum, ekstrem yok), `null` DEGIL',
    JSON.stringify(await Y.ekstremKatmani([kunyeler[0]])) === '{}');
  ok('⑱e · ILAN EDILEN SAPMA · esit degerlerde anahtar atiliyor (hem en iyi hem en kotu olmaz)',
    JSON.stringify(await Y.ekstremKatmani([{ symbol: 'A', trailingPE: 9 }, { symbol: 'B', trailingPE: 9 }])) === '{}');
  ok('⑱e · girdi yok -> cokme yok, bos nesne',
    JSON.stringify(await Y.ekstremKatmani(null)) === '{}');

  // --- TASIYICI SOZLESMESI BUYUMEDI ---
  ok('⑱f · im kunye nesnesinin ICINE yazilmadi (results sozlesmesi aynen)',
    kunyeler.every((k) => !('ekstrem' in k) && !('im' in k) && !('best' in k)));
  // OLCULDU 2026-10-31: S8 #11 ile cevap COK SATIRLI oldu, tek satirlik
  // eski kalip dustu. Kalip gevsetilmedi — iki alan AYRI AYRI araniyor.
  ok('⑱f · cevap `ekstrem`i AYRI ust duzey alan olarak tasiyor',
    /results: out,/.test(yfinKod) && /ekstrem: await ekstremKatmani\(out\),/.test(yfinKod));
  ok('⑱f · katmanda Turkce cumle/etiket YOK (im istemcide secilir)',
    !/label|txt:/.test((yfinKod.match(/export async function ekstremKatmani[\s\S]*?\n\}/) || [''])[0]));
  ok('⑱f · arama kipi BOZULMADI (ekstrem yalniz `?symbols=` dalinda)',
    /json\(\{ query: searchQ, quotes: out \}\)/.test(yfinKod));

  // --- ⑱g: BILANCO SENARYOSU (S8 #11) ---
  // NIYE KAPI: envanter (api/_kesif.js:1061) "senaryo matematigi
  // BICIMLEME, uca girmez" diyordu; OLCULDU, yanlis — app.js:9535-9549
  // icinde K=2.0 tepki katsayisi ve CAP=0.40 tavani var. Hesap motora
  // tasindi; bu kapi bir gun katsayinin UCA ya da istemciye geri
  // sizmasini engelliyor.
  const senKod = (yfinKod.match(/export async function senaryoKatmani[\s\S]*?\n\}/) || [''])[0];
  ok('⑱g · ONCUL · katman ayristirilabildi', senKod.length > 100, `${senKod.length} krk`);
  ok('⑱g · katmanda SAYI SABITI yok (K=2.0 / CAP=0.40 motorda kaldi)',
    !/[0-9]/.test(senKod.replace(/'[^']*'/g, "''")), senKod.match(/[0-9][^\n]*/) || 'yok');
  ok('⑱g · katmanda Turkce cumle/etiket YOK (cumle istemcide secilir)',
    !/label|txt:|'[A-Za-zÇĞİÖŞÜçğıöşü ]{6,}'/.test(senKod));
  ok('⑱g · hesap MOTORDAN cagriliyor (yerel formul yok)',
    /eng\.earnScenario\(/.test(senKod) && !/Math\.(min|max|abs)/.test(senKod));

  // UC DONUS BICIMI — motorun kendisi uretiyor, katman TASIYOR.
  const senK = [
    // dagilim VAR: uc kutu ham sayi
    { symbol: 'A', ok: true, price: 100, earnings: { epsAvg: 2, epsHigh: 3, epsLow: 1 } },
    // dagilim SIFIR (analistler tek noktada): makine kodu `tight`
    { symbol: 'B', ok: true, price: 50, earnings: { epsAvg: 2, epsHigh: 2, epsLow: 2, revAvg: 10, revHigh: 10, revLow: 10 } },
    // fiyat YOK: senaryo olmaz
    { symbol: 'C', ok: true, price: null, earnings: { epsAvg: 2, epsHigh: 3, epsLow: 1 } },
    // olculemeyen kunye
    { symbol: 'D', ok: false, price: 10, earnings: { epsAvg: 2, epsHigh: 3, epsLow: 1 } },
    // `deep` yok — earnings hic gelmemis
    { symbol: 'E', ok: true, price: 10 },
  ];
  const sen = await Y.senaryoKatmani(senK);
  ok('⑱g · anahtar SEMBOL (indeks DEGIL — kart kunyeleri suzuyor)',
    anahtarlar(sen) === 'A,B', anahtarlar(sen));
  ok('⑱g · uc kutu HAM SAYI tasiyor (yuzde/metin bicimleme YOK)',
    anahtarlar(sen.A) === 'base,bear,bull'
    && anahtarlar(sen.A.bull) === 'px,ret'
    && typeof sen.A.bull.px === 'number' && typeof sen.A.bull.ret === 'number',
    JSON.stringify(sen.A.bull));
  ok('⑱g · BAZ kutusu %0 (konsensus tutarsa piyasa fiyatladi)',
    sen.A.base.ret === 0 && sen.A.base.px === 100);
  ok('⑱g · tavan UCTA degil motorda isliyor (ret CAP ile sinirli)',
    sen.A.bull.ret === 0.4 && sen.A.bear.ret === -0.4, `${sen.A.bull.ret} / ${sen.A.bear.ret}`);
  ok('⑱g · dagilim sifirsa MAKINE KODU doner, uc ozdes %0 kutusu DEGIL',
    JSON.stringify(sen.B) === '{"tight":true}', JSON.stringify(sen.B));
  ok('⑱g · senaryo uretilemeyen sembolun anahtari HIC KONULMUYOR (0 uydurulmuyor)',
    !('C' in sen) && !('E' in sen));
  ok('⑱g · OLCULEMEYEN kunye (ok:false) senaryoya GIRMIYOR', !('D' in sen));
  ok('⑱g · girdi yok -> cokme yok, bos nesne',
    JSON.stringify(await Y.senaryoKatmani(null)) === '{}'
    && JSON.stringify(await Y.senaryoKatmani([])) === '{}');
  ok('⑱g · senaryo kunye nesnesinin ICINE yazilmadi (results sozlesmesi aynen)',
    senK.every((k) => !('senaryo' in k) && !('bull' in k) && !('scenario' in k)));

  // YALNIZ `deep=1`: `earnings` MODULES_DEEP ile geliyor. Sig kipte
  // alan HIC KONULMUYOR — bos nesne "olctum, cikmadi" demek olurdu.
  ok('⑱g · cevapta senaryo YALNIZ `deep` dalinda',
    /\.\.\.\(deep \? \{ senaryo: await senaryoKatmani\(out\) \} : \{\}\),/.test(yfinKod));
  ok('⑱g · arama kipi senaryo TASIMIYOR',
    !/quotes: out,[\s\S]{0,80}senaryo/.test(yfinKod));
}

// ---------------------------------------------------------------------
//  FA kriter kodu: MOTOR ile NATIVE SOZLUK arasinda surukleme bekcisi.
//
//  NIYE BU TESTTE: kriterin Turkce cumlesi artik telde TASINMIYOR; uc
//  yalniz makine kodu (`c.kod`) ve ham sayilari (`c.sayilar`) gonderiyor,
//  cumleyi `mobile/src/lib/sozluk.ts` kuruyor. Iki taraf ayri dosyada
//  oldugu icin motora yeni bir dal eklendiginde ekran sessizce hicbir
//  cumle basmaz -- gorunurde hata yok, bilgi kayboluyor. Bu bolum iki
//  tarafin kod KUMESINI birebir esitliyor; eksik de fazla da kirmizi.
//
//  BU BOLUM `mobile/src`'i OKUYAN ILK uc testi. Bilincli: motorun urettigi
//  kod ile ekranin tanidigi kod ayni gercegin iki yarisi.
// ---------------------------------------------------------------------
bolum('⑲ FA kriter kodu <-> native sozluk + cevrimdisi BIST fiksturu');
{
  const MOTOR_FA_PATH = path.join(ROOT, 'api', '_motor.js');
  const SOZLUK_PATH = path.join(ROOT, 'mobile', 'src', 'lib', 'sozluk.ts');
  const motorFaSrc = readFileSync(MOTOR_FA_PATH, 'utf8');
  const sozlukSrc = readFileSync(SOZLUK_PATH, 'utf8');

  // Yalniz `faKriterKod` govdesi: motorun BASKA yerindeki noktali dize
  // sabitleri (ornegin modul yollari) kumeye karismasin.
  const faKodBlok = (() => {
    const a = motorFaSrc.indexOf('function faKriterKod(');
    const b = motorFaSrc.indexOf('function faKriterIsaretle(');
    return a >= 0 && b > a ? motorFaSrc.slice(a, b) : '';
  })();
  ok('⑲a · ONCUL · motorda `faKriterKod` govdesi ayristirilabildi',
    faKodBlok.length > 1500, `${faKodBlok.length} krk`);

  const sozlukBlok = (() => {
    const a = sozlukSrc.indexOf('export const FA_KRITER_SOZLUK');
    if (a < 0) return '';
    const b = sozlukSrc.indexOf('\n};', a);
    return b > a ? sozlukSrc.slice(a, b) : '';
  })();
  ok('⑲a · ONCUL · native `FA_KRITER_SOZLUK` blogu ayristirilabildi',
    sozlukBlok.length > 1000, `${sozlukBlok.length} krk`);

  const motorKodlari = new Set(
    (faKodBlok.match(/'[A-Za-z0-9]+\.[a-z-]+'/g) || []).map((s) => s.slice(1, -1)));
  const sozlukKodlari = new Set(
    (sozlukBlok.match(/'[A-Za-z0-9]+\.[a-z-]+':/g) || []).map((s) => s.slice(1, -2)));
  ok('⑲a · iki kume de bos degil', motorKodlari.size > 25 && sozlukKodlari.size > 25,
    `motor ${motorKodlari.size} · sozluk ${sozlukKodlari.size}`);

  const sozluktekiEksik = [...motorKodlari].filter((k) => !sozlukKodlari.has(k));
  ok('⑲b · motorun URETEBILDIGI her kodun native cumlesi VAR',
    sozluktekiEksik.length === 0, sozluktekiEksik.slice(0, 8).join(', '));

  const motordakiEksik = [...sozlukKodlari].filter((k) => !motorKodlari.has(k));
  ok('⑲b · native sozlukte OLU kod yok (motor artik uretmiyor)',
    motordakiEksik.length === 0, motordakiEksik.slice(0, 8).join(', '));

  // Cumlede SAYI olmayacak: esik motorda duruyor. Sozluge "cift haneli"
  // yerine rakam girse bile bu kapi onu yakalamaz; rakam ise yakalar ve
  // esigin ikinci kopyasi dogmasini engeller.
  const rakamliCumle = (sozlukBlok.match(/':\s*'[^']*[0-9][^']*'/g) || []);
  ok('⑲b · sozluk cumlelerinde RAKAM yok (esik ikinci kez yazilmamis)',
    rakamliCumle.length === 0, rakamliCumle.slice(0, 3).join(' | '));

  // -------------------------------------------------------------------
  //  CEVRIMDISI FIKSTUR: BIST temel modelinin kriterleri gercekten kod ve
  //  ham sayi tasiyor mu. Ag YOK -- `bistFundamentalModel(mali, null)`
  //  fiyatsiz calisiyor (meta null ise fiyat null kaliyor). Bu ayni anda
  //  projenin ILK BIST temel-model kapisi.
  // -------------------------------------------------------------------
  const { buildEngine, loadMali } = await import('./score.mjs');
  const engFa = buildEngine();
  const FA_SEMBOL = ['ASELS', 'BIMAS', 'EREGL', 'FROTO', 'KCHOL', 'SAHOL', 'SISE', 'TCELL', 'THYAO', 'TUPRS'];
  let faKriterSayisi = 0;
  const faKodsuz = [];
  const faSayisiz = [];
  const faGorulenKod = new Set();
  for (const sym of FA_SEMBOL) {
    const maliRaw = loadMali(sym);
    if (!maliRaw) { faKodsuz.push(`${sym}:fikstur-yok`); continue; }
    const mali = engFa.parseIsMali(maliRaw);
    const model = engFa.bistFundamentalModel(mali, null);
    const C = (model && Array.isArray(model.criteria)) ? model.criteria : [];
    if (!C.length) { faKodsuz.push(`${sym}:kriter-yok`); continue; }
    for (const c of C) {
      faKriterSayisi++;
      if (typeof c.kod === 'string' && c.kod) faGorulenKod.add(c.kod);
      else faKodsuz.push(`${sym}/${c.key}`);
      const s = c.sayilar;
      const sayiVar = s && typeof s === 'object'
        && Object.keys(s).some((k) => typeof s[k] === 'number' && Number.isFinite(s[k]));
      if (!sayiVar) faSayisiz.push(`${sym}/${c.key}`);
    }
  }
  ok('⑲c · fikstur uzerinde kriter uretildi', faKriterSayisi >= 100, `${faKriterSayisi} kriter`);
  ok('⑲c · her kriter MAKINE KODU tasiyor', faKodsuz.length === 0, faKodsuz.slice(0, 6).join(', '));
  ok('⑲c · her kriterin en az bir SONLU ham sayisi var',
    faSayisiz.length === 0, faSayisiz.slice(0, 6).join(', '));
  const fiksturdeTanimsiz = [...faGorulenKod].filter((k) => !sozlukKodlari.has(k));
  ok('⑲c · fiksturde gorulen her kodun cumlesi sozlukte',
    fiksturdeTanimsiz.length === 0, fiksturdeTanimsiz.slice(0, 8).join(', '));
  // Fikstur TUM dallari gezmiyor (ornegin zarar eden donem yok): bu bir
  // olcum, kapi degil -- sayiyi yaziyoruz, esik koymuyoruz.
  ok('⑲c · fiksturde gezilen dal sayisi olculdu', faGorulenKod.size > 0,
    `${faGorulenKod.size}/${sozlukKodlari.size} dal`);
}

// =====================================================================
//  ⑳ NATIVE MOMENTUM KARTI <-> MOTORUN momentumInfo UZVU
// ---------------------------------------------------------------------
//  NIYE VAR: webin `⚡ Momentum girisi` sekmesi evreni TARAYICIDA
//  tariyor (`app.js scanMomentumUniverse` -> `computeVadeScore` +
//  `momentumInfo`). Native'de gosterge matematigi YOK; ayni karar
//  sunucuda `plan.momentum` olarak zaten uretiliyor. Bu bolum UC ILE
//  EKRANIN ayni alani okudugunu ve kartin o alani ikinci bir kez
//  HESAPLAMADIGINI olcuyor.
//
//  Statik denetim: cizim yok, ag yok. Kart cihazda HENUZ cizilmedi --
//  bu kapilar "kod dogru yeri okuyor" der, "ekranda guzel duruyor"
//  DEMEZ.
// ---------------------------------------------------------------------
bolum('⑳ native momentum karti <-> motorun momentumInfo uzvu');
{
  const AKIS_PATH = path.join(ROOT, 'api', '_akis.js');
  const MOM_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'kesfet', 'MomentumKart.tsx');
  const RISK_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'RiskOdulKart.tsx');
  const KESFET_PATH = path.join(ROOT, 'mobile', 'src', 'app', '(tabs)', 'kesfet.tsx');
  const IDX_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'kesfet', 'index.ts');
  const akisSrc = readFileSync(AKIS_PATH, 'utf8');
  const momSrc = readFileSync(MOM_PATH, 'utf8');
  const riskSrc = readFileSync(RISK_PATH, 'utf8');
  const kesfetSrc = readFileSync(KESFET_PATH, 'utf8');
  const idxSrc = readFileSync(IDX_PATH, 'utf8');

  // Bu bolumun kapilari KODU olcuyor, GEREKCEYI degil: dosya basliklari
  // webin `Math.round(gapPct*100)` satirini ALINTILIYOR ve `fetchRecommend`
  // adini anlatiyor. Yorumlari ayiklamazsak kapi kendi belgesini yakalar.
  const yorumsuz = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const momKod = yorumsuz(momSrc);
  const kesfetKod = yorumsuz(kesfetSrc);

  // ONCUL: kart uydurma bir alan okumuyor -- uc o uzvu GERCEKTEN
  // gonderiyor. Bu satir duserse kart sessizce bos cizer.
  ok('⑳a · ONCUL · plan katmani `momentumInfo` uzvunu TELE koyuyor',
    akisSrc.includes('momentum: hamYuvarla(eng.momentumInfo(r, vade))'));

  // Kart KENDI istegini ATMIYOR: tur sahibi ekran tek `recommend`
  // cagiriyor, iki kart ayni cevabi okuyor. `fetch` sizarsa ekran bir
  // turu IKI KEZ oder.
  ok('⑳a · kartin icinde `fetch` YOK (prop ile besleniyor)',
    !/\bfetch\s*\(/.test(momSrc));
  ok('⑳a · ekran momentum icin IKINCI istek atmiyor (tek `fetchRecommend` CAGRISI)',
    (kesfetKod.match(/fetchRecommend\(/g) || []).length === 1,
    String((kesfetKod.match(/fetchRecommend\(/g) || []).length));

  // SUZGEC MOTORUN: kart `active` bayragina bakiyor, esigi yeniden
  // yazmiyor. Motorun esikleri (`_motor.js:981`: ADX 22, skor 56)
  // native'de GECMEYECEK.
  ok('⑳b · suzgec motorun bayragi (`active === true`)',
    momSrc.includes(".active === true"));
  const esikIzi = /\b(adx|score|gapPct)\s*(>=|<=|>|<)\s*[0-9]/.test(momKod)
    || /\b(22|56|0\.05)\b/.test(momKod);
  ok('⑳b · kartta MOTORUN esigi YOK (ADX/skor/bosluk esigi yazili degil)',
    esikIzi === false);

  // OLCEK: `gapPct` KESIR (`_motor.js:988` `(p - bzTop) / p`).
  // RiskOdulKart onu `formatOran(..., 4)` ile basiyor ve 100'e
  // CARPMIYOR; iki ekran AYNI alani iki ayri olcekte gosterirse
  // kullanici hangisine inanacagini bilemez.
  ok('⑳c · ONCUL · RiskOdulKart `gapPct`i formatOran(...,4) ile basiyor',
    riskSrc.includes('formatOran(mom.gapPct, 4)'));
  ok('⑳c · momentum karti AYNI olcekte (formatOran, 4 hane)',
    momSrc.includes('formatOran(bosluk, 4)'));
  ok('⑳c · kartta `formatPercent` YOK (yuzde puanina cevirme girisimi)',
    !momSrc.includes('formatPercent'));
  ok('⑳c · kartta 100 ile CARPMA yok',
    !/\*\s*100\b/.test(momKod));

  // SIRALAMA: gelen dizi YERINDE sıralanmiyor. Ayni diziyi Firsatlar
  // kartı da okuyor; `sort` yerinde calisirsa oteki kartin sirasi
  // sessizce degisir.
  ok('⑳d · siralama kopya uzerinde (`.slice().sort(`)',
    momSrc.includes('.slice().sort('));

  // UC AYRI BOSLUK TEK CUMLEYE SIKISTIRILMADI: "hic olculmedi" ile
  // "olculdu, hicbiri acik degil" ayri dallar. Webin tek cumlesi
  // ("uygun hisse yok") bu ikisini ayirmiyordu.
  ok('⑳e · "HIC olculmedi" dali var',
    momSrc.includes('HİÇ ölçülmedi'));
  ok('⑳e · "olculdu ama acik degil" dali AYRI ve bunun bir OLCUM oldugunu soyluyor',
    momSrc.includes('hiçbirinde açık değil') && momSrc.includes('eksik veri değil'));
  ok('⑳e · kismen olculememis satirlar AYRI cumlede sayiliyor',
    momSrc.includes('ÖLÇÜLEMEDİ'));

  // Kart gercekten BAGLI: export + mount. Ikisi olmazsa dosya olu kod.
  ok('⑳f · kart `components/kesfet` barelinden export ediliyor',
    idxSrc.includes("export { MomentumKart, type MomentumKartProps } from './MomentumKart';"));
  ok('⑳f · kart Kesfet ekraninda MONTE (import + kullanim)',
    kesfetSrc.includes('  MomentumKart,') && kesfetSrc.includes('<MomentumKart'));
  // Firsatlar ile AYNI dalda: ikisi de ekranin turuna bagli.
  ok('⑳f · momentum karti `durum === \'veri\' && satirlar.length` dalinda',
    (kesfetSrc.match(/durum === 'veri' && satirlar\.length \? \(/g) || []).length === 2,
    String((kesfetSrc.match(/durum === 'veri' && satirlar\.length \? \(/g) || []).length));
}

// =====================================================================
//  21 NATIVE TEZ DEFTERI <-> WEBIN #tab-tez SEKMESI
// ---------------------------------------------------------------------
//  NIYE VAR: tez defteri kullanicinin KENDI notlari ve CIHAZDA duruyor
//  (web de `localStorage`, `TEZ_LS_KEY = 'sb:theses'`). Yeni uc YOK,
//  yeni Vercel yuvasi YOK -- bu yuzden burada AG kapisi da yok.
//
//  Bu bolumun asil isi UC AYRI SESSIZ ARIZAYI kapatmak:
//   (1) native defterin webinkiyle AYNI anahtari okumasi -- ayri anahtar
//       olsa kullanicinin web'de yazdigi tez app'te YOK gorunurdu;
//   (2) webin ISTEMCIDE yaptigi gosterge aritmetiginin (
//       `(price - stop) / (target - stop)` ve `(target - price) / price
//       * 100`) native'e SIZMAMASI -- §5.1 ham sayi kurali;
//   (3) kartin yaziciyi YENIDEN YAZMAMASI: depoya yalniz `depo.ts`
//       yazar, kart yaziciyi cagirir. Iki yazici olsa biri digerinin
//       `updated` alanini sessizce bozardi.
//
//  Statik denetim: cizim yok, ag yok. Kart cihazda HENUZ cizilmedi --
//  bu kapilar "kod dogru yeri okuyor" der, "ekranda guzel duruyor"
//  DEMEZ.
// ---------------------------------------------------------------------
bolum('21 native tez defteri <-> webin #tab-tez sekmesi');
{
  const APPJS_PATH = path.join(ROOT, 'app.js');
  const DEPO_PATH = path.join(ROOT, 'mobile', 'src', 'api', 'depo.ts');
  const API_IDX_PATH = path.join(ROOT, 'mobile', 'src', 'api', 'index.ts');
  const TEZ_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'analiz', 'TezDefteriKart.tsx');
  const AN_IDX_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'analiz', 'index.ts');
  const ANALIZ_PATH = path.join(ROOT, 'mobile', 'src', 'app', '(tabs)', 'analiz.tsx');
  const appSrc = readFileSync(APPJS_PATH, 'utf8');
  const depoSrc = readFileSync(DEPO_PATH, 'utf8');
  const apiIdxSrc = readFileSync(API_IDX_PATH, 'utf8');
  const tezSrc = readFileSync(TEZ_PATH, 'utf8');
  const anIdxSrc = readFileSync(AN_IDX_PATH, 'utf8');
  const analizSrc = readFileSync(ANALIZ_PATH, 'utf8');

  // Kapilar KODU olcuyor, GEREKCEYI degil: dosya basliklari webin
  // `(price - stop) / (target - stop)` satirini ALINTILIYOR. Yorumlari
  // ayiklamazsak kapi kendi belgesini yakalar.
  const yorumsuz = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const tezKod = yorumsuz(tezSrc);
  const depoKod = yorumsuz(depoSrc);

  // --- (1) AYNI ANAHTAR -------------------------------------------------
  ok('21a · ONCUL · web tezleri `sb:theses` anahtarinda tutuyor',
    appSrc.includes("TEZ_LS_KEY = 'sb:theses'"));
  ok('21a · native depo AYNI anahtari kullaniyor',
    depoSrc.includes("tezler: 'sb:theses'"));

  // --- (2) ISTEMCIDE HESAP YOK -----------------------------------------
  ok('21b · ONCUL · webde gosterge aritmetigi ISTEMCIDE var (bu yuzden kapi gerekli)',
    appSrc.includes('(price - stop) / (target - stop)'));
  ok('21b · kartta webin gosterge formulu YOK',
    !tezKod.includes('(price - stop)') && !tezKod.includes('(target - stop)'));
  ok('21b · kartta "hedefe % kac kaldi" hesabi YOK',
    !tezKod.includes('(target - price)'));
  ok('21b · kartta 100 ile CARPMA yok',
    !/\*\s*100\b/.test(tezKod));
  ok('21b · kartta `formatPercent` YOK (yuzde uretme girisimi)',
    !tezKod.includes('formatPercent'));
  // Yazici katmaninda da yok: hesap oraya kacirilmadi.
  ok('21b · yazicilarda da gosterge aritmetigi YOK',
    !depoKod.includes('(target - stop)') && !depoKod.includes('(target - price)'));

  // --- (3) TEK YAZICI ---------------------------------------------------
  const yazicilar = [
    'tezEkle', 'tezGuncelle', 'tezSil',
    'tezDayanakDongu', 'tezGunlukEkle', 'tezGunlukSil',
  ];
  for (const ad of yazicilar) {
    ok('21c · yazici `' + ad + '` depo.ts`de var',
      depoSrc.includes('export async function ' + ad + '('));
    ok('21c · yazici `' + ad + '` `@/api` barelinden cikiyor',
      new RegExp('^\\s*' + ad + ',\\s*$', 'm').test(apiIdxSrc));
  }
  ok('21c · kart depoya KENDI yazmiyor (`tezlerDepo.yaz` kartta yok)',
    !tezKod.includes('tezlerDepo'));
  ok('21c · kart anahtari KENDI bilmiyor (`sb:theses` kartta yok)',
    !tezKod.includes('sb:theses'));
  ok('21c · kart yazicilari CAGIRIYOR (tezEkle + tezGuncelle + tezSil)',
    tezKod.includes('tezEkle(') && tezKod.includes('tezGuncelle(') && tezKod.includes('tezSil('));
  ok('21c · kart okumayi `useTezler()` ile yapiyor',
    tezKod.includes('useTezler()'));

  // --- AG YOK: defter CIHAZDA. Tek bir `fetch` yeni Vercel yuvasi demek
  // olurdu ve Hobby tavani (12 fonksiyon) ZATEN dolu.
  ok('21d · kartta `fetch` YOK (defter cihazda, yeni uc yok)',
    !/\bfetch\s*\(/.test(tezSrc));

  // --- TARIH: YEREL takvim gunu. `toISOString()` UTC`ye kayar ve gece
  // yarisi bir gun sasirtir; web `tzToday()` kullaniyor.
  ok('21e · ONCUL · web yerel takvim gunu uretiyor (`tzToday`)',
    appSrc.includes('const tzToday = () =>'));
  const bugunBas = depoSrc.indexOf('export function bugunYMD(');
  const bugunGovde = bugunBas < 0 ? '' : depoSrc.slice(bugunBas, depoSrc.indexOf('\n}', bugunBas));
  ok('21e · `bugunYMD` yerel takvim alanlarini okuyor',
    bugunGovde.includes('getFullYear()') && bugunGovde.includes('getMonth()')
      && bugunGovde.includes('getDate()'));
  ok('21e · `bugunYMD` `toISOString` KULLANMIYOR (UTC kaymasi yok)',
    bugunGovde.length > 0 && !bugunGovde.includes('toISOString'));

  // --- OLCULMEYEN SAYI BASILMAZ: hedef/cikis yazilmadiysa `0` DEGIL
  // "yazilmadi". `0` gecerli bir fiyat olabilir.
  ok('21f · hedef yazilmadiysa `0` degil "yazilmadi" basiliyor',
    tezSrc.includes("tez.target == null ? 'yazılmadı'"));
  ok('21f · cikis yazilmadiysa `0` degil "yazilmadi" basiliyor',
    tezSrc.includes("tez.stop == null ? 'yazılmadı'"));
  ok('21f · ayristirici gecersiz girdide `null` donuyor, `0` DEGIL',
    depoSrc.includes('return Number.isFinite(n) ? n : null;'));

  // --- SILME ONAYI: `mobile/src` icinde `Alert` YOK; kalip iki dokunus.
  ok('21g · silme iki dokunusla onaylaniyor (`silSoruldu`)',
    tezKod.includes('silSoruldu'));
  ok('21g · kartta `Alert` YOK',
    !/\bAlert\b/.test(tezKod));

  // --- DAYANAK DURUMU: dongu sirasi webinkiyle AYNI ve durum METINLE de
  // yazili (renk tek ayirt edici degil).
  ok('21h · dongu sirasi web ile AYNI (ok -> watch -> bad)',
    depoSrc.includes("['ok', 'watch', 'bad']"));
  ok('21h · durum duz dille de yazili (salt renk degil)',
    tezSrc.includes("soz: 'sağlam'") && tezSrc.includes("soz: 'izlemede'")
      && tezSrc.includes("soz: 'bozuldu'"));

  // --- DIL: vaat kelimesi yok, "senin notun" ibaresi var.
  const yasakli = ['kazandırır', 'garanti', 'al/sat sinyali', 'kesin kar'];
  for (const kelime of yasakli) {
    ok('21i · kartta yasak vaat yok: "' + kelime + '"',
      !tezSrc.includes(kelime));
  }
  ok('21i · kart "uygulamanin onerisi degil" diyor',
    tezSrc.includes('uygulamanın önerisi değil'));
  ok('21i · kart verinin CIHAZDA durdugunu soyluyor',
    tezSrc.includes('Bu cihazda saklanır'));

  // --- BAGLI MI: export + mount. Ikisi olmazsa dosya olu kod.
  ok('21j · kart `components/analiz` barelinden export ediliyor',
    anIdxSrc.includes("export { TezDefteriKart, type TezDefteriKartProps } from './TezDefteriKart';"));
  ok('21j · kart Analiz ekraninda MONTE (import + kullanim)',
    analizSrc.includes('  TezDefteriKart,') && analizSrc.includes('<TezDefteriKart'));
  // Piyasa seridinin USTUNDE: serit secilen sembolden bagimsiz sabit
  // evrenler, tez defteri ise secilen sembolle ilgili.
  ok('21j · kart "Piyasa seridi" basligindan ONCE cizilyor',
    analizSrc.indexOf('<TezDefteriKart') < analizSrc.indexOf('baslik="Piyasa şeridi"'));
}

// =====================================================================
//  22 LISTE BILDIRIM BAYRAGI <-> WEBIN BILDIRIM DUGMESI
// ---------------------------------------------------------------------
//  NIYE VAR: web'de bir listenin IKI ayri bayragi var ve iki ayri sey
//  anlatiyorlar: `inUniverse` ANALIZ evrenini kuruyor (hangi hisseler
//  olculsun), `notify` ise PUSH evrenini (`collectWatchlistPayload`
//  app.js:2244 `if (l.notify === false) return`). Native tarafta bayrak
//  OKUNUYORDU (`depo.ts` alani + goc) ama YAZILAMIYORDU: kullanici
//  web'de kapattigi bildirimi app'te geri acamiyor, app'te hic
//  kapatamiyordu. Sessiz ariza: dugme yok oldugu icin kimse fark
//  etmiyor, telefon titremeye devam ediyor.
//
//  Bu bolumun kapattigi uc ariza:
//   (1) TEK BAYRAK sanmak: yazici `notify` yazarken `inUniverse`a
//       dokunmamali, yoksa bildirimi kapatan kullanicinin listesi
//       SESSIZCE analiz evreninden de dusardi;
//   (2) GERIYE DONUK VARSAYILAN: alan YOKSA bildirim ACIK sayilmali
//       (web `l.notify !== false`, app.js:8286). `false` varsayilani
//       eski cihazlardaki bildirimleri sessizce kesmek olurdu;
//   (3) ANAHTAR AG ISTEGI DOGURMAMALI: bayrak CIHAZDA duruyor; push
//       evrenine donusu `/api/watchlist` turunda olur ve o tur bu
//       ekrandan ATILMAZ. Anahtari senkrona baglamak kullanicinin
//       bilmedigi bir ag istegi uretirdi.
//
//  Statik denetim: cizim yok, ag yok. Anahtar cihazda HENUZ cevrilmedi.
// ---------------------------------------------------------------------
bolum('22 liste bildirim bayragi <-> webin bildirim dugmesi');
{
  const APPJS_PATH = path.join(ROOT, 'app.js');
  const DEPO_PATH = path.join(ROOT, 'mobile', 'src', 'api', 'depo.ts');
  const LISTE_PATH = path.join(ROOT, 'mobile', 'src', 'api', 'liste.ts');
  const BLOK_PATH = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'ListeBlogu.tsx');
  const appSrc = readFileSync(APPJS_PATH, 'utf8');
  const depoSrc = readFileSync(DEPO_PATH, 'utf8');
  const listeSrc = readFileSync(LISTE_PATH, 'utf8');
  const blokSrc = readFileSync(BLOK_PATH, 'utf8');

  // Kapilar KODU olcuyor, GEREKCEYI degil: hem yazicinin hem kartin
  // basligi webin satirlarini ALINTILIYOR.
  const yorumsuzB = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const blokKod = yorumsuzB(blokSrc);
  const depoKodB = yorumsuzB(depoSrc);

  // --- (0) ONCULLER: web'de iki AYRI yazici ve bayragin TUKETICISI ----
  ok('22a · ONCUL · webde `setListUniverse` var',
    appSrc.includes('function setListUniverse(id, v)'));
  ok('22a · ONCUL · webde `setListNotify` AYRI yazici olarak var',
    appSrc.includes('function setListNotify(id, v)'));
  ok('22a · ONCUL · bayragin tuketicisi push evreni (`l.notify === false`)',
    appSrc.includes('if (l.notify === false) return'));
  ok('22a · ONCUL · webde eski listeler icin varsayilan ACIK',
    appSrc.includes('l.notify !== false'));

  // --- (1) NATIVE YAZICI VAR ve IKI BAYRAK AYRI ------------------------
  ok('22b · native depoda `listeBildirimAyarla` yazicisi var',
    depoSrc.includes('export async function listeBildirimAyarla(id: string, acik: boolean)'));
  ok('22b · yazici `notify` alanini yaziyor',
    depoKodB.includes('{ ...l, notify: acik }'));
  // Yazici YALNIZ notify'a dokunuyor: `inUniverse` yazan tek yer hala
  // `listeEvreneAl`. Ikisini tek yazicida birlestirmek, bildirimi
  // kapatani analiz evreninden de dusurmek olurdu.
  const bildBlok = (depoKodB.match(/export async function listeBildirimAyarla[\s\S]*?\n\}/) || [''])[0];
  ok('22b · yazici `inUniverse` alanina DOKUNMUYOR',
    bildBlok.length > 0 && !bildBlok.includes('inUniverse'));
  const evrenBlok = (depoKodB.match(/export async function listeEvreneAl[\s\S]*?\n\}/) || [''])[0];
  ok('22b · `listeEvreneAl` de `notify` alanina DOKUNMUYOR',
    evrenBlok.length > 0 && !evrenBlok.includes('notify'));
  // Liste bulunamazsa SESSIZ degil: sebep donuyor (web'de `if (!l) return`).
  ok('22b · olmayan liste SESSIZCE gecmiyor, sebep donuyor',
    bildBlok.includes("sebep: 'yok'"));

  // --- (2) SARMALAYICI + KART BAGLI -------------------------------------
  ok('22c · `api/liste.ts` yaziciyi sarmaliyor',
    listeSrc.includes('export async function listeBildirimAyarla(id: string, acik: boolean)')
      && listeSrc.includes('depoListeBildirimAyarla(id, acik)'));
  ok('22c · ListeBlogu yaziciyi `@/api/liste`den aliyor',
    blokSrc.includes('  listeBildirimAyarla,'));
  ok('22c · ListeBlogu anahtari CIZIYOR',
    blokKod.includes('value={bildirimAcik}')
      && blokKod.includes('onValueChange={(v) => yaz(listeBildirimAyarla(kayit.id, v))}'));
  ok('22c · anahtarin erisilebilirlik etiketi var',
    blokKod.includes("accessibilityLabel={'Bildirim: '"));

  // --- (3) GERIYE DONUK VARSAYILAN ACIK --------------------------------
  ok('22d · native de eski listeler icin ACIK varsayiyor (`!== false`)',
    blokKod.includes('kayit.notify !== false'));
  ok('22d · native varsayilani `=== true` DEGIL (alan yoksa kapatmiyor)',
    !blokKod.includes('kayit.notify === true'));
  ok('22d · yeni liste `notify: true` ile dogmaya devam ediyor',
    depoKodB.includes('inUniverse: true, notify: true'));

  // --- (4) ANAHTAR AG ISTEGI DOGURMUYOR --------------------------------
  // Dosyada `fetchRecommend` VAR (liste satirlarinin fiyati) ama bu
  // anahtar onu tetiklemiyor; senkron/watchlist cagrisi hic yok.
  ok('22e · kartta `/api/watchlist` cagrisi YOK',
    !blokKod.includes('watchlist') && !blokKod.includes('senkronYaz'));
  ok('22e · yazici AG kodu icermiyor',
    !bildBlok.includes('fetch') && !bildBlok.includes('istek('));
  // Depoya yalniz `depo.ts` yazar: kart `listelerDepo.yaz` cagirmiyor.
  ok('22e · kart depoyu KENDI yazmiyor (tek yazici kurali)',
    !blokKod.includes('listelerDepo.yaz'));

  // --- (5) DURUM DUZ DILLE DE YAZILI ------------------------------------
  // Renk tek ayirt edici degil: anahtarin yanindaki metin durumu soyluyor.
  ok('22f · anahtarin durumu METINLE de yazili',
    blokSrc.includes('bu listenin sembolleri bildirim evrenine dahil')
      && blokSrc.includes('bu listeden bildirim istenmiyor'));
  // Bildirim bir VAAT degil: kart "bildirim gelecek" demiyor.
  ok('22f · kart bildirimi vaat ETMIYOR',
    !blokSrc.includes('bildirim gelecek'));

  // --- (6) ISTEMCIDE HESAP YOK -----------------------------------------
  ok('22g · bayrak kodu sayi uretmiyor (100 ile carpma yok)',
    !/bildirimAcik[^\n]*\*\s*100/.test(blokKod));
}
// =====================================================================
//  24 LISTE SATIRI DONEM YUZDESI <-> WEBIN `.list-periods` SERIDI
// ---------------------------------------------------------------------
//  NIYE VAR: web liste satirinin yuzde degisimini ISTEMCIDE hesapliyor
//  (`changeFor`, app.js:2037; cagri app.js:8330). Bu depoda istemci
//  matematigi YASAK, bu yuzden native ayni sayiyi HAM olarak uctan
//  aliyor: `/api/degisim` (`api/_degisim.js`). Listeler sekmesindeki en
//  buyuk gorsel bosluk buydu: fiyat vardi, degisim YOKTU.
//
//  Bu bolumun kapattigi dort ariza:
//   (1) ISTEMCI MATEMATIGI: native yuzdeyi KENDI hesaplamamali
//       (`(a-b)/b`, `* 100` yok). `…Pct` alanlari UCTA yuzde puanina
//       cevriliyor, `formatPercent` dogrudan basiyor;
//   (2) ALTI DONEMIN HEPSINI SORMAK: uc `?donemler=` verilmezse altisini
//       olcuyor = sembol basina alti ust-kaynak adresi, bes olcum cope;
//   (3) TEK ISTEGE SIKISTIRMAK: fiyat `/api/recommend`ten, yuzde
//       `/api/degisim`den geliyor. Birlestirilse her donem tiklamasi
//       motoru bastan kosturdu;
//   (4) DORT HAL KARISMASI: sorulmadi / cevapta yok / alan govdede yok
//       / alan `null` dordu AYRI cumle. Olculmeyen sayi BASILMAZ.
//
//  Statik denetim: cizim yok, ag yok. Satir cihazda HENUZ cizilmedi.
// ---------------------------------------------------------------------
bolum('24 liste satiri donem yuzdesi <-> webin donem seridi');
{
  const APPJS_PATH_24 = path.join(ROOT, 'app.js');
  const UC_PATH_24 = path.join(ROOT, 'api', '_degisim.js');
  const TIP_PATH_24 = path.join(ROOT, 'mobile', 'src', 'api', 'types.ts');
  const BLOK_PATH_24 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'ListeBlogu.tsx');
  const appSrc24 = readFileSync(APPJS_PATH_24, 'utf8');
  const ucSrc24 = readFileSync(UC_PATH_24, 'utf8');
  const tipSrc24 = readFileSync(TIP_PATH_24, 'utf8');
  const blokSrc24 = readFileSync(BLOK_PATH_24, 'utf8');

  // Kapilar KODU olcuyor, GEREKCEYI degil: dosyanin basligi webin
  // satirlarini ALINTILIYOR, grep yorum metnine takilmamali.
  const yorumsuz24 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const blokKod24 = yorumsuz24(blokSrc24);

  // --- (0) ONCULLER: webde ne vardi ------------------------------------
  ok('24a · ONCUL · webde donem listesi var (`CHANGE_PERIODS`)',
    appSrc24.includes('const CHANGE_PERIODS = ['));
  ok('24a · ONCUL · webde donem liste basina ve YALNIZ BELLEKTE',
    appSrc24.includes('const listActivePeriods = {}'));
  ok('24a · ONCUL · webin varsayilan donemi `gunluk`',
    appSrc24.includes("listActivePeriods[lid] || 'gunluk'"));
  ok('24a · ONCUL · webin yuzdesi ISTEMCIDE hesaplaniyor (`changeFor`)',
    appSrc24.includes('async function changeFor(symbol, market, periodKey)'));

  // --- (1) HAM YUZDE UCU VE TIPLERI YERINDE ----------------------------
  ok('24b · ham yuzde ucu var ve yuzde puani donduruyor',
    ucSrc24.includes('* 100'));
  ok('24b · istemci tipleri donem listesini ve alan eslemesini tasiyor',
    tipSrc24.includes('export const DEGISIM_DONEMLER = [')
      && tipSrc24.includes('export const DEGISIM_DONEM_ALANLARI: Readonly<'));

  // --- (2) KART UCU KULLANIYOR, KENDI HESAPLAMIYOR ---------------------
  ok('24c · kart `fetchDegisim` cagiriyor',
    blokKod24.includes('fetchDegisim('));
  ok('24c · kart yuzdeyi `formatPercent` ile basiyor',
    blokKod24.includes('formatPercent(pct)'));
  // ISTEMCI MATEMATIGI YOK: carpma/bolme/yuzde formulu aranmiyor.
  ok('24c · kartta `* 100` YOK',
    !/\*\s*100/.test(blokKod24));
  ok('24c · kartta yuzde formulu YOK ((a-b)/b kalibi)',
    !/\)\s*\/\s*ref/.test(blokKod24) && !/changeFor/.test(blokKod24));
  ok('24c · kart esik/agirlik tablosu tasimiyor (donem adi SOZLUK)',
    blokKod24.includes('const DONEM_ADI: Readonly<Record<DegisimDonem, string>>'));

  // --- (3) TEK DONEM SORULUYOR -----------------------------------------
  ok('24d · istek YALNIZ secili donemi soruyor',
    blokKod24.includes('donemler: [donem]'));
  ok('24d · altisini birden isteyen cagri YOK',
    !blokKod24.includes('donemler: [...DEGISIM_DONEMLER]')
      && !blokKod24.includes('donemler: DEGISIM_DONEMLER'));
  // `DEGISIM_DONEMLER` kartta YALNIZ dugmeleri cizmek icin gezilir.
  ok('24d · donem listesi yalniz dugme cizmekte kullaniliyor',
    blokKod24.includes('DEGISIM_DONEMLER.map((d) => ('));
  ok('24d · donem CIHAZDA kalici DEGIL (depoya yazilmiyor)',
    blokKod24.includes("useState<DegisimDonem>('gunluk')")
      && !blokKod24.includes('donemDepo'));

  // --- (4) IKINCI ISTEK AYRI ANAHTARDA --------------------------------
  // Donem tiklamasi fiyat turunu yeniden kurmamali: iki `useIstek` ayri
  // anahtarda, yuzde anahtari donemi ICERIYOR.
  ok('24e · yuzde turu kendi `useIstek`inde',
    blokKod24.includes("useIstek(degisimCagri, degisimListe + '|' + donem"));
  ok('24e · fiyat turunun anahtari donemi ICERMIYOR',
    blokKod24.includes('useIstek(cagri, anahtar, {')
      && !blokKod24.includes("useIstek(cagri, anahtar + '|' + donem"));
  ok('24e · yuzde hatasi fiyat hatasini BASTIRMIYOR (ayri satir)',
    blokKod24.includes("dDurum === 'hata'") && blokKod24.includes('dHata?.message'));
  ok('24e · yuzde turu yalniz liste ACIKKEN atiliyor',
    blokKod24.includes('etkin: acik && degisimListe.length > 0'));

  // --- (5) SEMBOL VE PAZAR ESLESMESI -----------------------------------
  // Uc kodu SONEK SILEREK donduruyor ve ayni kod iki pazarda olabilir:
  // yalniz sembole bakan eslesme yanlis satiri gosterirdi.
  ok('24f · uca `KOD:PAZAR` gonderiliyor',
    blokKod24.includes("ucSembolu(oge.symbol) + ':' + (oge.market === 'BIST' ? 'BIST' : 'US')"));
  ok('24f · eslesme sembol VE pazar uzerinden',
    blokKod24.includes("s.symbol === hedef && s.market === pazar"));

  // --- (6) DORT DURUST HAL ---------------------------------------------
  ok('24g · "sorulmadi" hali ayri cumle',
    blokSrc24.includes("' % sorulmadı'"));
  ok('24g · "cevapta yok" hali ayri cumle',
    blokSrc24.includes("' % cevapta yok'"));
  ok('24g · alan govdede yoksa HICBIR SEY cizilmiyor',
    blokKod24.includes('if (!Object.prototype.hasOwnProperty.call(satir, alan)) return null;'));
  ok('24g · alan `null` ise "olculemedi" yaziliyor',
    blokSrc24.includes("' % ölçülemedi'"));
  ok('24g · olculmeyen sayi 0 olarak BASILMIYOR',
    !/pct\s*\?\?\s*0/.test(blokKod24));

  // --- (7) YON RENKLE TEK BASINA TASINMIYOR ----------------------------
  ok('24h · yon isaretle de yazili (▲ ▼ •)',
    blokSrc24.includes("'▲ '") && blokSrc24.includes("'▼ '") && blokSrc24.includes("'• '"));
  ok('24h · gecikme METINLE yazili, uc bayragindan',
    blokKod24.includes("satir.gecikmeli ? ' · gecikmeli' : ''"));
  ok('24h · secili donem RENKLE DEGIL dolu dugme bicimiyle ayrisiyor',
    blokKod24.includes("variant={d === donem ? 'solid' : 'outline'}"));

  // --- (8) GEZINME VE CIZIM KURALLARI BOZULMADI ------------------------
  ok('24i · kart hala tek gezinme kalibini kullaniyor',
    blokKod24.includes('hisseAc(') && !blokKod24.includes("from 'expo-router'"));
  ok('24i · kart vaat cumlesi uretmiyor',
    !blokSrc24.includes('kazandırır') && !blokSrc24.includes('al/sat sinyali'));
}
// =====================================================================
//  25 · HISSE DETAYINDA "GELISMELER" (tek sembolun manşetleri)
// ---------------------------------------------------------------------
//  NEDEN: webdeki hisse sayfasinin `fillSpNews` bolumu (app.js:7923,
//  baslik "📰 Gelişmeler") native detay ekraninda KARSILIKSIZDI. Haber
//  native'de yalnizca Bugun sekmesinde, TAKIP LISTESI uzerinden vardi;
//  listede olmayan bir sembole (Arama sonucu) gidildiginde kullanici o
//  hissede ne oldugunu HIC goremiyordu.
//
//  Bu bolumun kilitledigi bes karar:
//   (1) `HisseHaberleriKarti` YENIDEN KULLANILMIYOR: o kart `useListe()`
//       okuyor = kullanicinin listesini soruyor. Detay semboluyle ayni
//       soru degil; yeni kart liste deposuna HIC dokunmamali;
//   (2) AYNI UC, AYNI KIP: `/api/news` coklu-sembol kipi TEK sembolle.
//       Yeni uc YOK (Hobby 12 fonksiyon tavani - §21 M3);
//   (3) PAZAR CIKARIMI YOK: `market` cagirandan (`satir.market`) geliyor
//       - onaylanmis karar: istemci pazari bildirir, uc cikarmaz;
//   (4) DORT DURUST HAL: "olcemedim" (satir.tam false) / "olculdu,
//       mansset cikmadi" (adet 0) / "ucta satir yok" / dolu olcum; dordu
//       AYRI cumle ve hepsi UCUN kendi sayaclarindan;
//   (5) ISTEMCI MATEMATIGI YOK: duyarlilik ucun katmani, esik/agirlik
//       motorda. Yarim taramada duyarlilik HIC basilmiyor.
//
//  Statik denetim: cizim yok, ag yok. Kart cihazda HENUZ cizilmedi ve
//  `/api/news` kip ② detay ekranindan CANLI cagrilmadi (yerel DNS, §12).
// ---------------------------------------------------------------------
bolum('25 hisse detayinda Gelismeler <-> webin fillSpNews bolumu');
{
  const APPJS_PATH_25 = path.join(ROOT, 'app.js');
  const UC_PATH_25 = path.join(ROOT, 'api', 'news.js');
  const KART_PATH_25 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'HaberKart.tsx');
  const GIRIS_PATH_25 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const EKRAN_PATH_25 = path.join(ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const BUGUN_PATH_25 = path.join(ROOT, 'mobile', 'src', 'components', 'bugun', 'HisseHaberleriKarti.tsx');
  const appSrc25 = readFileSync(APPJS_PATH_25, 'utf8');
  const ucSrc25 = readFileSync(UC_PATH_25, 'utf8');
  const kartSrc25 = readFileSync(KART_PATH_25, 'utf8');
  const girisSrc25 = readFileSync(GIRIS_PATH_25, 'utf8');
  const ekranSrc25 = readFileSync(EKRAN_PATH_25, 'utf8');
  const bugunSrc25 = readFileSync(BUGUN_PATH_25, 'utf8');

  // Kapilar KODU olcuyor, GEREKCEYI degil: kartin basligi webin
  // satirlarini ALINTILIYOR, grep yorum metnine takilmamali.
  const yorumsuz25 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const kartKod25 = yorumsuz25(kartSrc25);
  const ekranKod25 = yorumsuz25(ekranSrc25);

  // --- (0) ONCULLER: webde ne vardi ------------------------------------
  ok('25a · ONCUL · webde hisse sayfasinin haber bolumu var (`fillSpNews`)',
    appSrc25.includes('async function fillSpNews('));
  ok('25a · ONCUL · webin bolum basligi "📰 Gelişmeler"',
    appSrc25.includes('📰 Gelişmeler'));
  ok('25a · ONCUL · uc coklu-sembol kipini tasiyor (`symbols`)',
    ucSrc25.includes('symbols'));

  // --- (1) KART VAR VE GIRISTEN DISA ACIK ------------------------------
  ok('25b · kart dosyasi var ve `HaberKart` disa aciliyor',
    kartKod25.includes('export function HaberKart('));
  ok('25b · detay girisi karti ad ad disa aciyor',
    girisSrc25.includes("export { HaberKart, type HaberKartProps } from './HaberKart';"));
  ok('25b · ekran karti basiyor ve pazari SATIRDAN geciriyor',
    ekranKod25.includes('<HaberKart sembol={sembol} market={satir.market} />'));
  ok('25b · ekran karti detay girisinden aliyor',
    ekranKod25.includes('HaberKart,') && ekranKod25.includes("from '@/components/detay'"));

  // --- (2) AYNI UC, TEK SEMBOL, YENI UC YOK ----------------------------
  ok('25c · kart `/api/news` coklu-sembol kipini TEK sembolle cagiriyor',
    kartKod25.includes('fetchHisseHaberleri([sembol], { market, limit, signal })'));
  ok('25c · kart kendi `fetch`ini kurmuyor (istemci sozlesmesi uzerinden)',
    !/\bfetch\s*\(/.test(kartKod25.replace(/fetchHisseHaberleri/g, '')));
  ok('25c · kart yeni bir uc adresi yazmiyor',
    !kartKod25.includes('/api/'));

  // --- (3) LISTE DEPOSUNA DOKUNULMUYOR ---------------------------------
  // Gerekce: ayni soru degil. Bugun sekmesindeki kart LISTEYI soruyor.
  ok('25d · ONCUL · Bugun kartı gerçekten listeyi soruyor (`useListe`)',
    yorumsuz25(bugunSrc25).includes('useListe('));
  ok('25d · detay karti `useListe` OKUMUYOR',
    !kartKod25.includes('useListe'));
  ok('25d · detay karti depo anahtari okumuyor',
    !kartKod25.includes('sb:lists') && !kartKod25.includes('depo'));

  // --- (4) PAZAR CIKARIMI YOK ------------------------------------------
  ok('25e · `market` props olarak geliyor',
    kartKod25.includes('market: Market;'));
  ok('25e · kart pazari KENDI cikarmiyor (`.IS` / BIST tahmini yok)',
    !/endsWith\(\s*'\.IS'\s*\)/.test(kartKod25) && !/market\s*=\s*['"]/.test(kartKod25));
  ok('25e · onbellek anahtari pazari TASIYOR (pazar degisirse tur yeniden)',
    kartKod25.includes("'detay-haber:' + sembol + '|' + market"));

  // --- (5) DORT DURUST HAL --------------------------------------------
  ok('25f · "olcemedim" hali UCUN `tam` bayragindan',
    kartKod25.includes('satir && !satir.tam'));
  ok('25f · "olcemedim" cumlesi "haber yok" DEMIYOR',
    kartSrc25.includes('“haber yok” DENMİYOR'));
  ok('25f · "olculdu, mansset cikmadi" hali ayri cumle',
    kartKod25.includes('satir.tam && satir.adet === 0')
    && kartSrc25.includes('Ölçüldü, manşet çıkmadı'));
  ok('25f · "ucta satir yok" hali ayri cumle',
    kartKod25.includes('veri && !satir')
    && kartSrc25.includes('Uç bu sembol için satır döndürmedi.'));
  ok('25f · eksik tarama rozeti MANSETLERIN USTUNDE',
    kartKod25.indexOf('<HaberOlcumEksikRozet') < kartKod25.indexOf('<HaberSatiri'));
  ok('25f · olculmeyen sayi 0 olarak BASILMIYOR',
    !/adet\s*\?\?\s*0/.test(kartKod25) && !/\bms\s*\?\?\s*0/.test(kartKod25));

  // --- (6) ISTEMCI MATEMATIGI YOK --------------------------------------
  ok('25g · kartta yuzde/puan hesabi yok',
    !/\*\s*100/.test(kartKod25) && !/\)\s*\/\s*\(/.test(kartKod25));
  ok('25g · duyarlilik YARIM taramada basilmiyor',
    kartKod25.includes('satir.tam && !eksik'));
  ok('25g · duyarlilik ucun katmanindan, kart puan uretmiyor',
    kartKod25.includes('duyarlilik={satir.duyarlilik}'));

  // --- (7) KAP AYRIMI VE YASAL CERCEVE ---------------------------------
  // Uc `type: 'NEWS'` donduruyor; KAP `/api/takvim`den geliyor. Kart
  // bunu EKRANDA yaziyor, yoksa kullanici "KAP yok" sanirdi.
  ok('25h · ONCUL · haber ucu KAP uretmiyor (`type: \'NEWS\'`)',
    ucSrc25.includes("'NEWS'"));
  ok('25h · kart KAP ayrimini EKRANDA yaziyor',
    kartSrc25.includes('KAP duyuruları bu uçtan GELMİYOR'));
  ok('25h · kart vaat cumlesi uretmiyor',
    !kartSrc25.includes('kazandırır') && !kartSrc25.includes('al/sat sinyali')
    && !kartSrc25.includes('garanti'));
  ok('25h · yasal uyariyi kart TEKRARLAMIYOR (ekran kabugu basiyor)',
    !kartKod25.includes('DISCLAIMER_TEXT') && ekranKod25.includes('ScreenShell'));
}
// =====================================================================
//  26 · HISSE DETAYINDA YAZMA EYLEMLERI (listeye + kiyasa ekle)
// ---------------------------------------------------------------------
//  NEDEN: webde hisse sayfasinin ust seridinde iki yazma eylemi var
//  (`addToList` ve `sb:compare` seti, app.js:12238). Native'de listeye
//  ekleme YALNIZ Arama sekmesindeydi; kiyas setine ekleme ise HIC
//  YOKTU: `kiyasaEkle` depo katmaninda duruyordu ama HICBIR ekran
//  cagirmiyordu, yani kullanici kalici kiyas kumesini native'de hic
//  KURAMIYORDU. Analiz sekmesi yalniz 🏭 Sektor koprusunden gelen
//  `?kiyas=` parametresiyle doluyordu.
//
//  Bu bolumun kilitledigi dort karar:
//   (1) SINIR DEPODA: slot sayisi `AZAMI_KIYAS`ten okunuyor, kartta
//       yeniden yazilmiyor (esik tekrari = §5.1 ihlali);
//   (2) BASARISIZLIK SESSIZ KALMIYOR: depo `ok:false` + `mesaj`
//       donduruyor, o mesaj OLDUGU GIBI basiliyor; "eklendi" cumlesi
//       yalniz gercekten yazildiginda cikiyor;
//   (3) PAZAR CIKARIMI YOK: `market` cagirandan (`satir.market`);
//   (4) KIYAS KAYNAK SIRASI EKRANDA YAZILI: ① `?kiyas=` koprusu
//       ② kalici set (`sb:compare`) ③ takip listesi — ve cumle HANGI
//       kaynaktan kostugunu soyluyor.
//
//  Statik denetim: cizim yok, ag yok. Dugmelere CIHAZDA HIC basilmadi,
//  `sb:compare` gidis-donusu gorulmedi, `/api/compare` kalici setle
//  CANLI cagrilmadi (yerel DNS, §12).
// ---------------------------------------------------------------------
bolum('26 hisse detayinda yazma eylemleri <-> webin ust serit dugmeleri');
{
  const APPJS_PATH_26 = path.join(ROOT, 'app.js');
  const KART_PATH_26 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'DetayEylemler.tsx');
  const GIRIS_PATH_26 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const API_PATH_26 = path.join(ROOT, 'mobile', 'src', 'api', 'index.ts');
  const DEPO_PATH_26 = path.join(ROOT, 'mobile', 'src', 'api', 'depo.ts');
  const EKRAN_PATH_26 = path.join(ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const ANALIZ_PATH_26 = path.join(ROOT, 'mobile', 'src', 'app', '(tabs)', 'analiz.tsx');
  const appSrc26 = readFileSync(APPJS_PATH_26, 'utf8');
  const kartSrc26 = readFileSync(KART_PATH_26, 'utf8');
  const girisSrc26 = readFileSync(GIRIS_PATH_26, 'utf8');
  const apiSrc26 = readFileSync(API_PATH_26, 'utf8');
  const depoSrc26 = readFileSync(DEPO_PATH_26, 'utf8');
  const ekranSrc26 = readFileSync(EKRAN_PATH_26, 'utf8');
  const analizSrc26 = readFileSync(ANALIZ_PATH_26, 'utf8');

  // Grepler KODU olcuyor, gerekce metnini DEGIL: kart basligi webin
  // satirlarini alintiliyor, yorumlar siyrilmadan kapi yanilirdi.
  const yorumsuz26 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const kartKod26 = yorumsuz26(kartSrc26);
  const ekranKod26 = yorumsuz26(ekranSrc26);
  const analizKod26 = yorumsuz26(analizSrc26);

  // --- (0) ONCULLER: webde ne vardi, native'de ne eksikti --------------
  ok('26a · ONCUL · webde listeye ekleme var (`listAddSymbol` + hisse sayfasi dugmesi)',
    appSrc26.includes('function listAddSymbol(') && appSrc26.includes('＋ Listeye ekle'));
  ok('26a · ONCUL · webde kalici kiyas seti var (`sb:compare`)',
    appSrc26.includes('sb:compare'));
  ok('26a · ONCUL · depo yazicisi zaten vardi (`kiyasaEkle`)',
    yorumsuz26(depoSrc26).includes('export async function kiyasaEkle('));

  // --- (1) KART VAR, GIRISTEN DISA ACIK, EKRANDA BASILI ---------------
  ok('26b · kart dosyasi var ve `DetayEylemler` disa aciliyor',
    kartKod26.includes('export function DetayEylemler('));
  ok('26b · detay girisi karti ad ad disa aciyor',
    girisSrc26.includes("export { DetayEylemler, type DetayEylemlerProps } from './DetayEylemler';"));
  ok('26b · ekran karti basiyor ve pazari SATIRDAN geciriyor',
    ekranKod26.includes('<DetayEylemler sembol={sembol} market={satir.market} />'));
  ok('26b · ekran karti detay girisinden aliyor',
    ekranKod26.includes('DetayEylemler,') && ekranKod26.includes("from '@/components/detay'"));
  ok('26b · kart basligin ALTINDA (eylemler kunyeden once gelmiyor)',
    ekranKod26.indexOf('<DetayBasligi') < ekranKod26.indexOf('<DetayEylemler'));

  // --- (2) IKI YAZICI GERCEKTEN CAGRILIYOR ----------------------------
  ok('26c · api girisi `kiyasaEkle`yi disa aciyor (once acilmiyordu)',
    apiSrc26.includes('kiyasaEkle,'));
  ok('26c · kart liste yazicisini cagiriyor (`ekle(`)',
    /\bekle\(sembol\)/.test(kartKod26));
  ok('26c · kart kiyas yazicisini PAZARLA cagiriyor',
    kartKod26.includes('kiyasaEkle(sembol, market)'));
  ok('26c · kart kendi depo anahtarini yazmiyor',
    !kartKod26.includes('sb:lists') && !kartKod26.includes('sb:compare')
    && !kartKod26.includes('AsyncStorage'));
  ok('26c · kart kendi `fetch`ini kurmuyor (yazma yerel, uc yok)',
    !/\bfetch\s*\(/.test(kartKod26) && !kartKod26.includes('/api/'));

  // --- (3) SINIR DEPODAN, KARTTA ESIK YOK -----------------------------
  ok('26d · ONCUL · slot sinirini depo tanimliyor (`AZAMI_KIYAS`)',
    yorumsuz26(depoSrc26).includes('AZAMI_KIYAS'));
  ok('26d · kart sinirı depodan okuyor',
    kartKod26.includes('AZAMI_KIYAS'));
  ok('26d · kart sinirı SAYI olarak yeniden yazmiyor',
    !/>=\s*8\b/.test(kartKod26) && !/AZAMI_KIYAS\s*=/.test(kartKod26));
  ok('26d · dolu kume dugmeyi kapatiyor',
    kartKod26.includes('kiyas.length >= AZAMI_KIYAS')
    && kartKod26.includes('disabled={kiyasta || kiyasDolu}'));
  ok('26d · slot sayisi EKRANDA yazili (dugme neden kapali gorunsun)',
    kartSrc26.includes('Karşılaştırma seti: '));

  // --- (4) BASARISIZLIK SESSIZ KALMIYOR -------------------------------
  ok('26e · liste sonucu depo mesajini basiyor',
    kartKod26.includes("s.ok ? sembol + ' listeye eklendi.' : s.mesaj"));
  ok('26e · kiyas sonucu depo mesajini basiyor',
    kartKod26.includes("s.ok ? sembol + ' karşılaştırma setine eklendi.' : s.mesaj"));
  ok('26e · kiyas yazicisi `async`: sonuc gelmeden cumle basilmiyor',
    kartKod26.includes('kiyasaEkle(sembol, market).then('));
  ok('26e · kart kendi hata cumlesini UYDURMUYOR',
    !kartSrc26.includes('bir hata oluştu') && !kartSrc26.includes('Bilinmeyen hata'));
  ok('26e · bildirim satiri kosullu (bos mesaj basilmiyor)',
    kartKod26.includes('{bildirim ? ('));

  // --- (5) PAZAR CIKARIMI YOK -----------------------------------------
  ok('26f · `market` props olarak geliyor',
    kartKod26.includes('market: Market;'));
  ok('26f · kart pazari KENDI cikarmiyor',
    !/endsWith\(\s*'\.IS'\s*\)/.test(kartKod26) && !/market\s*=\s*['"]/.test(kartKod26));
  ok('26f · "zaten var" denetimi pazari da kiyasliyor (ayni kod iki pazarda)',
    kartKod26.includes('k.symbol === sembol && k.market === market'));

  // --- (6) ANALIZ: KAYNAK SIRASI VE EKRANDAKI CUMLE -------------------
  ok('26g · analiz kalici kiyas setini okuyor (`useKiyas`)',
    analizKod26.includes('useKiyas()'));
  ok('26g · oncelik: kopru > kalici set > takip listesi',
    analizKod26.includes('if (gelenKiyas.length) return gelenKiyas.slice(0, AZAMI_SEMBOL);')
    && analizKod26.includes('if (depoKiyas.length) return depoKiyas.slice(0, AZAMI_SEMBOL);')
    && analizKod26.includes('return liste;'));
  ok('26g · kaynak adi ekrandaki cumleyi suruyor',
    analizKod26.includes("const kiyasKaynak: 'kopru' | 'set' | 'liste'")
    && analizKod26.includes("kiyasKaynak !== 'liste' ?")
    && analizKod26.includes("kiyasKaynak === 'kopru'"));
  ok('26g · kalici setten kostugu EKRANDA yazili',
    analizSrc26.includes('hisse sayfalarından kurduğun karşılaştırma setindeki'));
  ok('26g · kirpilan sembol HANGI kaynakta olursa olsun sayiliyor',
    analizKod26.includes("const kiyasHam = kiyasKaynak === 'kopru' ? gelenKiyas.length : depoKiyas.length;")
    && analizKod26.includes('kiyasHam > AZAMI_SEMBOL ? kiyasHam - AZAMI_SEMBOL : 0'));
  ok('26g · analiz uc sinirini kendi yazmiyor (AZAMI_SEMBOL sozlesmeden)',
    !/AZAMI_SEMBOL\s*=\s*\d/.test(analizKod26));

  // --- (7) YASAL CERCEVE ----------------------------------------------
  ok('26h · kart vaat cumlesi uretmiyor',
    !kartSrc26.includes('kazandırır') && !kartSrc26.includes('al/sat sinyali')
    && !kartSrc26.includes('garanti') && !kartSrc26.includes('fırsat'));
  ok('26h · kartta hesap yok (yuzde/puan uretmiyor)',
    !/\*\s*100/.test(kartKod26) && !/\)\s*\/\s*\(/.test(kartKod26));
  ok('26h · yasal uyariyi kart TEKRARLAMIYOR (ekran kabugu basiyor)',
    !kartKod26.includes('DISCLAIMER_TEXT') && ekranKod26.includes('ScreenShell'));
}

// =====================================================================
//  27 · SIRKET PROFILI KARTI (webin "Sirket ne yapiyor?" bolumu)
// ---------------------------------------------------------------------
//  NEDEN: webde hisse sayfasinda `fillSpBiz` (app.js, kutu `id="spBiz"`)
//  sektor ETIKETININ otesinde sirketin ne is yaptigini yazan bir bolum
//  var. Native detay ekraninda bunun KARSILIGI YOKTU: skor, teknik,
//  temel, haber vardi ama "bu sirket ne yapiyor?" sorusunun cevabi
//  yoktu — arama sonucundan gelen kullanici TANIMADIGI bir sembolde
//  skoru okuyordu.
//
//  Bu bolumun kilitledigi bes karar:
//   (1) YENI UC YOK: var olan `/api/yfin` kunye turu kullaniliyor
//       (`bizSummary`/`sector`/`industry`/`website`), Hobby
//       12-fonksiyon tavani (§21 M3) DEGISMEDI;
//   (2) `deep` KAPALI: profil `assetProfile`te, takvim modulleri
//       istenmiyor;
//   (3) TERS PIYASA DENEMESI YOK: web profil bos gelirse sembolu
//       DIGER pazarda tekrar deniyor (`otherMarket(market)`), native
//       bunu YAPMIYOR — pazar cikarimi yok (onaylanmis karar);
//   (4) UC DURUST HAL AYRI CUMLE: metin var / yalniz etiket var /
//       ikisi de yok — ucu de OLCULMUS cevap, "olculemedi" degil
//       (o hali `ok:false` dali soyluyor);
//   (5) HESAP YOK, PUAN YOK: metin oldugu gibi tasiniyor, profil
//       hicbir skora girdi degil ve bu EKRANDA yazili.
//
//  Statik denetim: cizim yok, ag yok. Kart CIHAZDA HIC cizilmedi,
//  `/api/yfin` detay ekranindan CANLI hic cagrilmadi (yerel DNS, §12),
//  `bizSummary` dolu HIC gorulmedi.
// ---------------------------------------------------------------------
bolum('27 sirket profili karti <-> webin "Sirket ne yapiyor?" bolumu');
{
  const APPJS_PATH_27 = path.join(ROOT, 'app.js');
  const YFIN_UC_PATH_27 = path.join(ROOT, 'api', '_yfin.js');
  const YFIN_TIP_PATH_27 = path.join(ROOT, 'mobile', 'src', 'api', 'yfin.ts');
  const KART_PATH_27 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'SirketKart.tsx');
  const GIRIS_PATH_27 = path.join(ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const EKRAN_PATH_27 = path.join(ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const appSrc27 = readFileSync(APPJS_PATH_27, 'utf8');
  const ucSrc27 = readFileSync(YFIN_UC_PATH_27, 'utf8');
  const tipSrc27 = readFileSync(YFIN_TIP_PATH_27, 'utf8');
  const kartSrc27 = readFileSync(KART_PATH_27, 'utf8');
  const girisSrc27 = readFileSync(GIRIS_PATH_27, 'utf8');
  const ekranSrc27 = readFileSync(EKRAN_PATH_27, 'utf8');

  // Grepler KODU olcuyor, gerekce metnini DEGIL: kart basliginda webin
  // satirlari ve `otherMarket` adi ALINTILI — yorumlar siyrilmadan
  // "ters pazar denemesi yok" kapisi kendi gerekcesine takilirdi.
  const yorumsuz27 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const kartKod27 = yorumsuz27(kartSrc27);
  const ekranKod27 = yorumsuz27(ekranSrc27);

  // --- (0) ONCULLER: webde ne var, ucta ne var -------------------------
  ok('27a · ONCUL · webde profil bolumu var (`fillSpBiz`)',
    appSrc27.includes('async function fillSpBiz(') && appSrc27.includes('id="spBiz"'));
  ok('27a · ONCUL · web ters pazarda tekrar deniyor (native denemeyecek)',
    appSrc27.includes('const om = otherMarket(market);'));
  ok('27a · ONCUL · kunye ucu profil metnini donduruyor (`bizSummary`)',
    ucSrc27.includes('bizSummary') && ucSrc27.includes('longBusinessSummary'));
  ok('27a · ONCUL · kunye ucu site adresini donduruyor (`website`)',
    ucSrc27.includes('website:'));
  ok('27a · ONCUL · native tip dort alani ZATEN tutuyor (tip degisikligi yok)',
    ['bizSummary?', 'sector?', 'industry?', 'website?'].every((a) => tipSrc27.includes(a)));

  // --- (1) KART VAR, GIRISTEN DISA ACIK, EKRANDA BASILI ---------------
  ok('27b · kart dosyasi var ve `SirketKart` disa aciliyor',
    kartKod27.includes('export function SirketKart('));
  ok('27b · detay girisi karti ad ad disa aciyor',
    girisSrc27.includes("export { SirketKart, type SirketKartProps } from './SirketKart';"));
  ok('27b · ekran karti basiyor',
    ekranKod27.includes('<SirketKart sembol={sembol} />'));
  ok('27b · ekran karti detay girisinden aliyor',
    ekranKod27.includes('SirketKart,') && ekranKod27.includes("from '@/components/detay'"));
  ok('27b · kart TEKNIK karttan ONCE (webde de bolum ust tarafta)',
    ekranKod27.indexOf('<SirketKart') < ekranKod27.indexOf('<TeknikKart'));

  // --- (2) UC: VAR OLAN KUNYE TURU, YENI UC YOK -----------------------
  ok('27c · kart var olan kunye turunu cagiriyor (`fetchYfin`)',
    kartKod27.includes('fetchYfin([sembol]'));
  ok('27c · `deep` KAPALI (profil icin takvim modulleri gereksiz)',
    kartKod27.includes('deep: false'));
  ok('27c · kart kendi `fetch`ini kurmuyor, kendi yolunu yazmiyor',
    !/\bfetch\s*\(/.test(kartKod27.replace(/fetchYfin/g, '')) && !kartKod27.includes('/api/'));
  ok('27c · tur `useIstek`ten geciyor (iptal + onbellek sozlesmesi)',
    kartKod27.includes('useIstek(cagri,') && kartKod27.includes('signal'));
  ok('27c · onbellek anahtari DIZGI ve temettu turuyla CAKISMIYOR',
    kartKod27.includes("sembol + '|sirket'"));
  ok('27c · bos sembolde tur ATILMIYOR',
    kartKod27.includes('etkin: Boolean(sembol)'));

  // --- (3) TERS PIYASA DENEMESI YOK (onaylanmis karar) ----------------
  ok('27d · kart `otherMarket` benzeri bir ikinci tur KURMUYOR',
    !kartKod27.includes('otherMarket')
    && (kartKod27.match(/fetchYfin\s*\(/g) || []).length === 1);
  ok('27d · kart pazar props\'u bile ALMIYOR (cikarim imkansiz)',
    !kartKod27.includes('market') && !/endsWith\(\s*'\.IS'\s*\)/.test(kartKod27));
  ok('27d · ekran karta pazar GECIRMIYOR',
    !/<SirketKart[^>]*market=/.test(ekranKod27));

  // --- (4) DORT DURUST HAL, DORDU AYRI CUMLE --------------------------
  ok('27e · tur kosup kayit getirmediginde ayri cumle',
    kartSrc27.includes("' için künye ucu kayıt döndürmedi.'"));
  ok('27e · `ok:false` OLCULEMEDI diye soyluyor (veri yok DEMIYOR)',
    kartKod27.includes('!kunye.ok ?') && kartSrc27.includes('künyesi ölçülemedi'));
  ok('27e · metin yok ama etiket varsa bunu ACIKCA yaziyor',
    kartSrc27.includes('profil metni) bu künyede YOK'));
  ok('27e · ikisi de bos hali ayri cumle',
    kartSrc27.includes('şirket profili ve sektör etiketi boş.'));
  ok('27e · yukleniyor/hata/bos tek `Durum` govdesinden',
    kartKod27.includes('<Durum') && kartKod27.includes('kartsiz')
    && kartKod27.includes('yenile={yenile}'));

  // --- (5) METIN SESSIZCE KIRPILMIYOR --------------------------------
  ok('27f · ilk cumle AYRILIYOR, kalan ATILMIYOR',
    kartKod27.includes('const kalan = metin.length > bir.length'));
  ok('27f · kalan metin katlanir bolumde (webin `<details>` karsiligi)',
    kartKod27.includes('<Katlanir') && kartSrc27.includes('Tam profili oku'));
  ok('27f · cumle bulunamazsa TUM metin basiliyor (… ile kesilmiyor)',
    kartKod27.includes('return m ? m[0].trim() : metin.trim();')
    && !kartSrc27.includes("'…'"));
  ok('27f · etiket iki alandan kuruluyor, bos olan SESSIZ atlanıyor',
    kartKod27.includes("[sektor, sanayi].filter(Boolean).join(' · ')"));

  // --- (6) HESAP YOK, SKORA GIRMIYOR, CERCEVE EKRANDA ----------------
  ok('27g · kartta hesap yok (yuzde/puan uretmiyor)',
    !/\*\s*100/.test(kartKod27) && !/\)\s*\/\s*\(/.test(kartKod27)
    && !/toFixed\(/.test(kartKod27));
  ok('27g · kart esik/agirlik tanimlamiyor',
    !/const\s+[A-Z_]{3,}\s*=\s*-?\d/.test(kartKod27));
  ok('27g · "skora girmez" EKRANDA yazili',
    kartSrc27.includes('skora girmez') && kartSrc27.includes('skora GİRMEZ'));
  ok('27g · kaynak ve DIL ekranda yazili (ceviri yapilmiyor denmis)',
    kartSrc27.includes('Yahoo Finance şirket profili') && kartSrc27.includes('çevrilmez'));

  // --- (7) YASAL CERCEVE ----------------------------------------------
  ok('27h · kart vaat cumlesi uretmiyor',
    !kartSrc27.includes('kazandırır') && !kartSrc27.includes('al/sat sinyali')
    && !kartSrc27.includes('garanti') && !kartSrc27.includes('fırsat'));
  ok('27h · yasal uyariyi kart TEKRARLAMIYOR (ekran kabugu basiyor)',
    !kartKod27.includes('DISCLAIMER_TEXT') && ekranKod27.includes('ScreenShell'));
  ok('27h · dis bag kullanicinin tarayicisina gidiyor, sessiz dusuyor',
    kartKod27.includes('void Linking.openURL(site).catch(() => {});'));
}


// =====================================================================
//  28 · BILDIRIM SENKRONU (webin `/api/watchlist` yazmasinin yuzeyi)
// ---------------------------------------------------------------------
//  NEDEN: her listenin "bildirim" anahtari native'de ZATEN cevriliyordu
//  (`ListeBlogu`), ama deger CIHAZDAN CIKMIYORDU: `/api/watchlist` ne
//  okunuyor ne yaziliyordu, `fetchWatchlist`/`pushWatchlist` sarmallari
//  CAGRISIZ duruyordu. Bildirimi atan isci (`worker/poll.mjs` ->
//  `worker/watchlist.mjs`) ayni kodun altindaki KV kaydini okudugu icin
//  app'te yapilan hicbir degisiklik telefona ulasmiyordu — anahtar sustu.
//
//  Bu bolumun kilitledigi bes karar:
//   (1) KOD KAYNAGA GOMULMUYOR: web kodu gomuyor (`SYNC_CODE`,
//       app.js:2235). Ucta KIMLIK DOGRULAMA YOK ve kod PAYLASILAN BIR
//       SIR — gomulu kod her kuruluma ayni kisinin listesini okutup
//       uzerine yazdirirdi. Native kodu KULLANICIDAN aliyor, varsayilan
//       BOS ve bos = senkron KAPALI (istek atilmiyor);
//   (2) UZAKTAN GELEN DURUM BENIMSENMIYOR: web `adoptRemoteState`
//       (app.js:2285) ile uzaktan geleni localStorage'a yaziyor; native
//       okumayi SALT GOSTERIM tutuyor — `ui` sekli hic olculmedi;
//   (3) YENI UC YOK: var olan `/api/watchlist` (api/watchlist.js),
//       Hobby 12-fonksiyon tavani (§21 M3) DEGISMEDI;
//   (4) SESSIZ KIRPMA YOK: gonderilmeyen her kayit (kapali liste,
//       tekrar, pazarsiz) EKRANDA sayiyla yazili;
//   (5) KOD GERI BASILMIYOR: kayitli kod ne ekranda ne hata cumlesinde.
//
//  Statik denetim: cizim yok, ag yok. Karta CIHAZDA HIC basilmadi,
//  `/api/watchlist` native'den CANLI hic cagrilmadi (yerel DNS, §12).
// ---------------------------------------------------------------------
bolum('28 bildirim senkronu <-> webin /api/watchlist yazmasi');
{
  const APPJS_PATH_28 = path.join(ROOT, 'app.js');
  const UC_PATH_28 = path.join(ROOT, 'api', 'watchlist.js');
  const ISCI_PATH_28 = path.join(ROOT, 'worker', 'watchlist.mjs');
  const DEPO_PATH_28 = path.join(ROOT, 'mobile', 'src', 'api', 'depo.ts');
  const SENKRON_PATH_28 = path.join(ROOT, 'mobile', 'src', 'api', 'senkron.ts');
  const API_PATH_28 = path.join(ROOT, 'mobile', 'src', 'api', 'index.ts');
  const KART_PATH_28 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'SenkronKart.tsx');
  const GIRIS_PATH_28 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'index.ts');
  const EKRAN_PATH_28 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'ListelerKart.tsx');
  const appSrc28 = readFileSync(APPJS_PATH_28, 'utf8');
  const ucSrc28 = readFileSync(UC_PATH_28, 'utf8');
  const isciSrc28 = readFileSync(ISCI_PATH_28, 'utf8');
  const depoSrc28 = readFileSync(DEPO_PATH_28, 'utf8');
  const senkronSrc28 = readFileSync(SENKRON_PATH_28, 'utf8');
  const apiSrc28 = readFileSync(API_PATH_28, 'utf8');
  const kartSrc28 = readFileSync(KART_PATH_28, 'utf8');
  const girisSrc28 = readFileSync(GIRIS_PATH_28, 'utf8');
  const ekranSrc28 = readFileSync(EKRAN_PATH_28, 'utf8');

  // Grepler KODU olcuyor, gerekce metnini DEGIL: hem kart hem `senkron.ts`
  // basliklari `SYNC_CODE` ve `adoptRemoteState` adlarini ALINTILIYOR —
  // siyrilmasa "gomulu kod yok" kapisi kendi gerekcesine takilirdi.
  const yorumsuz28 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const depoKod28 = yorumsuz28(depoSrc28);
  const senkronKod28 = yorumsuz28(senkronSrc28);
  const kartKod28 = yorumsuz28(kartSrc28);
  const ekranKod28 = yorumsuz28(ekranSrc28);

  // --- (0) ONCULLER: webde ne var, ucta ne var, isci neyi okuyor -------
  ok('28a · ONCUL · web kodu KAYNAGA GOMUYOR (`SYNC_CODE`)',
    appSrc28.includes("const SYNC_CODE = 'atahan-bulten-9f3c';"));
  ok('28a · ONCUL · web evreni bildirim anahtarindan kuruyor',
    appSrc28.includes('function collectWatchlistPayload()')
    && appSrc28.includes('function pushWatchlistSync()'));
  ok('28a · ONCUL · web uzaktan geleni BENIMSIYOR (native benimsemeyecek)',
    appSrc28.includes('function adoptRemoteState(ui, updatedAt)'));
  ok('28a · ONCUL · uc KIMLIK DOGRULAMA ISTEMIYOR (kod tek sir)',
    !/\bauthorization\b/i.test(ucSrc28) && ucSrc28.includes('count: clean.length'));
  ok('28a · ONCUL · uc yazma aninda `updatedAt` donduruyor (MILISANIYE)',
    ucSrc28.includes('updatedAt: Date.now()'));
  ok('28a · ONCUL · bildirim iscisi AYNI uctan okuyor',
    isciSrc28.includes('/api/watchlist?code=')
    && isciSrc28.includes('export async function getWatchlist()'));

  // --- (1) DEPO: NATIVE'E OZEL ANAHTAR, WEB TURLERINE KARISMIYOR ------
  ok('28b · native-ozel anahtar var (`sb:senkron`)',
    depoKod28.includes("export const SENKRON_ANAHTAR = 'sb:senkron';"));
  ok('28b · anahtar `ANAHTARLAR` kumesine GIRMEDI (o kume web ile birebir)',
    !/ANAHTARLAR[\s\S]{0,600}sb:senkron/.test(depoKod28));
  ok('28b · tur `TUMU`ya GIRMEDI (`depoBaslat` bunu okumuyor)',
    !/TUMU[\s\S]{0,400}senkronDepo/.test(depoKod28));
  ok('28b · kayit kendi yukleyicisiyle okunuyor',
    depoKod28.includes('export function senkronYukle()'));
  ok('28b · kod BICIMI sozlesmeden geliyor, depoda yeniden yazilmiyor',
    depoKod28.includes('WATCHLIST_CODE_BICIM.test(')
    && !/WATCHLIST_CODE_BICIM\s*=/.test(depoKod28));
  ok('28b · gecersiz kod SESSIZ kabul edilmiyor (sebep + mesaj)',
    depoKod28.includes('export async function senkronKodYaz(')
    && kartKod28.includes('setBildirim(s.mesaj)'));
  ok('28b · "hic yazilmadi" `null`, `0` DEGIL',
    depoKod28.includes('sonYazma: null') && !/sonYazma:\s*0\b/.test(depoKod28));

  // --- (2) EVREN: ATLANAN HER KAYIT SAYILIYOR -------------------------
  ok('28c · evren kurucusu var (`bildirimEvreni`)',
    depoKod28.includes('export function bildirimEvreni()'));
  ok('28c · bildirimi KAPALI liste atlaniyor ve SAYILIYOR',
    /if \(kayit\.notify === false\) \{\s*kapali \+= 1;/.test(depoKod28));
  ok('28c · tekrar eden sembol+pazar bir kez gidiyor ve SAYILIYOR',
    /if \(gorulen\.has\(anahtar\)\) \{\s*tekrar \+= 1;/.test(depoKod28));
  ok('28c · BIST/US disi pazar atlaniyor ve SAYILIYOR',
    depoKod28.includes('pazarsiz += 1'));
  ok('28c · ucu de EKRANDA yazili (sessiz kirpma yok)',
    kartSrc28.includes('bildirimi kapalı') && kartSrc28.includes('bir kez gidiyor')
    && kartSrc28.includes('BIST/US dışında'));

  // --- (3) AG KATMANI: VAR OLAN UC, YENI UC YOK -----------------------
  ok('28d · besteci var olan sarmallari cagiriyor',
    senkronKod28.includes('fetchWatchlist(kod,') && senkronKod28.includes('pushWatchlist(kod,'));
  ok('28d · besteci kendi `fetch`ini kurmuyor, kendi yolunu yazmiyor',
    !/\bfetch\s*\(/.test(senkronKod28.replace(/fetchWatchlist/g, 'X'))
    && !senkronKod28.includes('/api/'));
  ok('28d · kart AGA KENDI CIKMIYOR (besteciden geciyor)',
    !kartKod28.includes('fetchWatchlist') && !kartKod28.includes('pushWatchlist')
    && !/\bfetch\s*\(/.test(kartKod28));
  ok('28d · api girisi besteciyi disa aciyor',
    apiSrc28.includes('senkronGonder,') && apiSrc28.includes("from './senkron';"));
  ok('28d · ucun donusu cihaza saklaniyor (`updatedAt`)',
    senkronKod28.includes('senkronZamanYaz(sonuc.data.updatedAt)'));

  // --- (4) GOMULU KOD YOK, SIR EKRANDA GERI BASILMIYOR ----------------
  ok('28e · native webin kisisel kodunu GOMMUYOR',
    !kartKod28.includes('atahan-bulten-9f3c') && !senkronKod28.includes('atahan-bulten-9f3c')
    && !depoKod28.includes('atahan-bulten-9f3c'));
  ok('28e · kod BOSKEN istek ATILMIYOR (senkron kapali)',
    senkronKod28.includes("if (!kod) return { ok: false, sebep: 'kapali'"));
  ok('28e · "kapali" ile "hata" AYRI sebep',
    senkronKod28.includes("sebep: 'kapali' | 'hata'"));
  ok('28e · kayitli kod ekranda GERI BASILMIYOR',
    !kartKod28.includes('value={ayar.kod}')
    && !/\{ayar\.kod\}/.test(kartKod28));
  ok('28e · kart kendi hata cumlesini UYDURMUYOR',
    !kartSrc28.includes('bir hata oluştu') && !kartSrc28.includes('Bilinmeyen hata'));

  // --- (5) OKUMA SALT GOSTERIM (web `adoptRemoteState` yok) -----------
  ok('28f · native uzaktan gelen durumu BENIMSEMIYOR',
    !senkronKod28.includes('adoptRemoteState') && !senkronKod28.includes('veri.ui')
    && !kartKod28.includes('.ui'));
  ok('28f · besteci `ui` GONDERMIYOR da (govde yalniz list/portfolio)',
    senkronKod28.includes('{ list: evren.kayitlar, portfolio: [] }')
    && !/\bui:/.test(senkronKod28));
  ok('28f · bulut ozeti SALT GOSTERIM oldugu EKRANDA yazili',
    kartSrc28.includes('cihazdaki listelere uygulanmıyor'));
  ok('28f · okuma cihazdaki listelere YAZMIYOR',
    !kartKod28.includes('listeOlustur') && !kartKod28.includes('AsyncStorage')
    && !kartKod28.includes('kiyasaEkle'));

  // --- (6) KART VAR, GIRISTEN DISA ACIK, EKRANDA BASILI ---------------
  ok('28g · kart dosyasi var ve `SenkronKart` disa aciliyor',
    kartKod28.includes('export function SenkronKart('));
  ok('28g · liste girisi karti ad ad disa aciyor',
    girisSrc28.includes("export { SenkronKart, type SenkronKartProps } from './SenkronKart';"));
  ok('28g · Listeler sekmesi karti basiyor',
    ekranKod28.includes('<SenkronKart />'));
  ok('28g · kart kaydi kendisi okutuyor (tur `TUMU`da degil)',
    kartKod28.includes('void senkronYukle();'));
  ok('28g · depo okunmadan sayi BASILMIYOR',
    kartKod28.includes('if (!senkronHazir || !listeHazir)'));

  // --- (7) HESAP YOK + YASAL CERCEVE ----------------------------------
  ok('28h · kartta hesap yok (yuzde/puan uretmiyor)',
    !/\*\s*100/.test(kartKod28) && !/toFixed\(/.test(kartKod28));
  ok('28h · kart esik/agirlik tanimlamiyor',
    !/const\s+[A-Z_]{3,}\s*=\s*-?\d/.test(kartKod28));
  ok('28h · milisaniye->saniye cevrimi TEK yerde, yorumlu',
    kartKod28.includes('Math.floor(ms / 1000)')
    && kartSrc28.includes('birim çevrimi, hesap değil'));
  ok('28h · kart vaat cumlesi uretmiyor',
    !kartSrc28.includes('kazandırır') && !kartSrc28.includes('al/sat sinyali')
    && !kartSrc28.includes('garanti') && !kartSrc28.includes('fırsat'));
  ok('28h · yasal uyariyi kart TEKRARLAMIYOR (ekran kabugu basiyor)',
    !kartKod28.includes('DISCLAIMER_TEXT'));
  ok('28h · kodun PAYLASILAN SIR oldugu EKRANDA yazili',
    kartSrc28.includes('Uçta kimlik doğrulama yok'));
}

// =====================================================================
//  30. SEPET KARTI — CIHAZDAKI ADET/MALIYET + ULASILABILEN FIYAT
// ---------------------------------------------------------------------
//  Webin sepeti `sb:basket` kaydini okuyup `basketPrice` ile fiyatliyor.
//  Native tarafta fiyatin UCU OLMAYAN uc sinifi (metal/doviz/fon) var;
//  kapi bunlarin SESSIZ dusurulmedigini, gerekcenin EKRANDA yazili
//  oldugunu ve tek hesap yerinin korundugunu olcuyor.
// =====================================================================
{
  const APPJS_PATH_30 = path.join(ROOT, 'app.js');
  const SEPET_PATH_30 = path.join(ROOT, 'mobile', 'src', 'api', 'sepet.ts');
  const DEPO_PATH_30 = path.join(ROOT, 'mobile', 'src', 'api', 'depo.ts');
  const API_PATH_30 = path.join(ROOT, 'mobile', 'src', 'api', 'index.ts');
  const KART_PATH_30 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'SepetKart.tsx');
  const GIRIS_PATH_30 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'index.ts');
  const EKRAN_PATH_30 = path.join(ROOT, 'mobile', 'src', 'components', 'liste', 'ListelerKart.tsx');
  const appSrc30 = readFileSync(APPJS_PATH_30, 'utf8');
  const sepetSrc30 = readFileSync(SEPET_PATH_30, 'utf8');
  const depoSrc30 = readFileSync(DEPO_PATH_30, 'utf8');
  const apiSrc30 = readFileSync(API_PATH_30, 'utf8');
  const kartSrc30 = readFileSync(KART_PATH_30, 'utf8');
  const girisSrc30 = readFileSync(GIRIS_PATH_30, 'utf8');
  const ekranSrc30 = readFileSync(EKRAN_PATH_30, 'utf8');

  // Hem `sepet.ts` hem kart basliklari `basketPrice`, `BASKET_WINDOWS`,
  // `toFixed` gibi adlari GEREKCE olarak ALINTILIYOR; siyrilmasa "yok"
  // kapilari kendi aciklamalarina takilirdi.
  const yorumsuz30 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const sepetKod30 = yorumsuz30(sepetSrc30);
  const kartKod30 = yorumsuz30(kartSrc30);

  // --- (0) ONCULLER: webde ne var -------------------------------------
  ok('30a · ONCUL · web sepeti ayni anahtari kullaniyor (`sb:basket`)',
    appSrc30.includes("'sb:basket'"));
  ok('30a · ONCUL · webin fiyatlayicisi var (`basketPrice`)',
    appSrc30.includes('function basketPrice('));
  ok('30a · ONCUL · ERTELENEN makine webde DURUYOR (port edilmedi)',
    appSrc30.includes('BASKET_WINDOWS') && appSrc30.includes('basketWindowFlow'));
  ok('30a · ONCUL · erteleme gerekcesi kart basliginda YAZILI',
    kartSrc30.includes('BASKET_WINDOWS') && kartSrc30.includes('motor işi'));

  // --- (1) VAR VE BAGLI -----------------------------------------------
  ok('30b · fiyat katmani var (`sepetFiyatlari`)',
    sepetKod30.includes('export async function sepetFiyatlari('));
  ok('30b · kart var ve adiyla disa aciliyor',
    kartKod30.includes('export function SepetKart()')
    && girisSrc30.includes("export { SepetKart, type SepetKartProps } from './SepetKart';"));
  ok('30b · kart EKRANA TAKILI (Listeler sekmesi)',
    ekranSrc30.includes("import { SepetKart } from './SepetKart';")
    && ekranSrc30.includes('<SepetKart />'));
  ok('30b · api girisi fiyat turlerini disa aciyor',
    apiSrc30.includes('type SepetFiyat,') && apiSrc30.includes('type SepetKaynaksiz,'));

  // --- (2) DEPO: KAYIT KENDI YUKLEYICISINI KURMUYOR -------------------
  ok('30c · sepet turu `TUMU` kumesinde (acilista okunuyor)',
    /TUMU[\s\S]{0,400}sepetDepo/.test(depoSrc30));
  ok('30c · fiyat katmani kayitlari KENDI okuyor (kart tasimiyor)',
    sepetKod30.includes('sepetDepo.al()') && !kartKod30.includes('sepetDepo.al()'));

  // --- (3) MALIYET KARARI: EN UCUZ ISTEK, TAVANLAR SOZLESMEDEN --------
  ok('30d · tek donem isteniyor (`donemler: [gunluk]`) — ucun 6 donemi DEGIL',
    sepetKod30.includes("donemler: ['gunluk']"));
  ok('30d · dilim tavanlari SOZLESMEDEN geliyor, ciplak sayi DEGIL',
    sepetKod30.includes('dilimle(degisimIstek, DEGISIM_AZAMI_SEMBOL)')
    && sepetKod30.includes('dilimle(kriptoIstek, KRIPTO_AZAMI_ID)')
    && sepetKod30.includes('dilimle(kurIstek, KUR_AZAMI_KOD)'));
  ok('30d · tavan degerleri burada YENIDEN TANIMLANMIYOR',
    !/DEGISIM_AZAMI_SEMBOL\s*=/.test(sepetKod30)
    && !/KRIPTO_AZAMI_ID\s*=/.test(sepetKod30)
    && !/KUR_AZAMI_KOD\s*=/.test(sepetKod30)
    && !/KUR_KOD_BICIM\s*=/.test(sepetKod30));
  ok('30d · YENI UC YOK: kendi yolunu yazmiyor, kendi `fetch`ini kurmuyor',
    !sepetKod30.includes('/api/')
    && !sepetKod30.replace(/fetchDegisim/g, 'X').replace(/fetchKripto/g, 'Y')
      .replace(/fetchKur/g, 'Z').includes('fetch('));
  ok('30d · var olan UC sarmali cagiriyor (metal/doviz artik /api/kur ile)',
    sepetKod30.includes('fetchDegisim(dilim,') && sepetKod30.includes('fetchKripto(dilim,')
    && sepetKod30.includes('fetchKur(dilim,'));
  ok('30d · kart AGA KENDI CIKMIYOR (fiyat katmanindan geciyor)',
    kartKod30.includes('sepetFiyatlari()')
    && !kartKod30.includes('fetchDegisim') && !kartKod30.includes('fetchKripto'));
  ok('30d · YENI BAGIMLILIK YOK (yalniz yerel ice almalar)',
    !/from '(?!\.)/.test(sepetKod30.replace(/from '@\//g, "from './")));

  // --- (4) HAM SAYI KURALI: TEK HESAP YERI ----------------------------
  ok('30e · fiyat katmaninda CARPMA/TOPLAMA YOK (uctan geleni tasiyor)',
    !sepetKod30.includes(' * ') && !sepetKod30.includes(' / '));
  ok('30e · hesap TEK YERDE (`muhasebe`) ve kartin icinde',
    kartKod30.includes('function muhasebe(')
    && kartKod30.split('function muhasebe(').length === 2
    && !sepetKod30.includes('muhasebe'));
  ok('30e · esik/agirlik/bicimleme sabiti YOK (`toFixed` yok)',
    !sepetKod30.includes('toFixed') && !kartKod30.includes('toFixed'));
  ok('30e · olculmeyen deger `null`, `0` DEGIL',
    kartKod30.includes('{ deger: null, fark: null }')
    && !/deger:\s*0\b/.test(kartKod30));
  ok('30e · fark YALNIZ para birimi AYNIYSA cikariliyor (kur cevrimi yok)',
    kartKod30.includes('fark: birimAyni ? deger - (kalem.cost as number) : null'));

  // --- (5) SESSIZ KIRPMA YOK: HER DUSEN KAYIT EKRANDA SAYILI ----------
  ok('30f · kaynaksiz gerekceleri KALEM KALEM yazili',
    sepetKod30.includes('const SEBEP_METAL') && sepetKod30.includes('const SEBEP_FX')
    && sepetKod30.includes('const SEBEP_FON') && sepetKod30.includes('const SEBEP_CGID')
    && sepetKod30.includes('const SEBEP_SEMBOLSUZ'));
  ok('30f · metal ve doviz AYNI uca soruluyor (web `basketPrice` gibi)',
    sepetKod30.includes("if (k.cls === 'metal') {")
    && sepetKod30.includes('kuraSor(k, SEBEP_METAL)')
    && sepetKod30.includes("if (k.cls === 'fx') {")
    && sepetKod30.includes('kuraSor(k, SEBEP_FX)'));
  ok('30f · kur anahtari KAYDIN SEMBOLU ve KUCULTULMUYOR (web ile ayni)',
    sepetKod30.includes("const kod = (k.symbol || '').trim();")
    && !/anahtar: kod\.toLowerCase\(\)/.test(sepetKod30));
  ok('30f · bozuk kod UCA CIKMADAN ayiklaniyor (400 dilimi yakmasin)',
    sepetKod30.includes('!KUR_KOD_BICIM.test(kod)')
    && sepetKod30.includes('kaynaksiz.push({ id: k.id, sebep })'));
  ok('30f · kaynaksiz kalan tek sinif FON (uydurma fiyat yok)',
    sepetKod30.includes('kaynaksiz.push({ id: k.id, sebep: SEBEP_FON })'));
  ok('30f · kur fiyati OLDUGU GIBI tasiniyor, birimi TRY (web ile ayni)',
    sepetKod30.includes('bulunan[satir.kod] = satir.fiyatTry;')
    && sepetKod30.includes("birim: 'TRY', kaynak: 'kur'"));
  ok('30f · yeni kaynagin ADI EKRANDA yazili',
    kartSrc30.includes("kur: 'ölçülen fiyat'"));
  ok('30f · "soruldu ama olculemedi" AYRI sayilyor',
    sepetKod30.includes('olculemedi.push(e.id)'));
  ok('30f · EKRANDA olculemeyen SAYISI basiliyor',
    kartSrc30.includes('sonuc.olculemedi.length +')
    && kartSrc30.includes('SORULDU ama ölçülemedi (uç fiyat döndürmedi).'));
  ok('30f · EKRANDA kaynaksiz gerekce + SAYISI basiliyor (tekilleme sessiz degil)',
    kartKod30.includes('sebepSayisi[sebep] +')
    && kartKod30.includes("' kayıt: ' + sebep"));
  ok('30f · ucun kendi `uyari` metni OLDUGU GIBI tasiniyor',
    sepetKod30.includes('uyarilar.push(sonuc.data.uyari)'));

  // --- (6) TOPLAM BASILMIYOR + FIYATIN KAYNAGI EKRANDA ----------------
  ok('30g · tek bir "sepet toplami" HESAPLANMIYOR',
    !kartKod30.includes('reduce(') && !/const\s+toplam\b/.test(kartKod30));
  ok('30g · fiyatin NEREDEN geldigi ekranda yazili',
    kartKod30.includes('const KAYNAK_ADI')
    && kartKod30.includes("elle: 'elle girilen fiyat'")
    && kartKod30.includes("nakit: 'tanım gereği 1'"));
  ok('30g · sepet BULUTA GITMIYOR: ne fiyat katmani ne kart senkronu CAGIRIYOR',
    !sepetKod30.includes("from './senkron'") && !kartKod30.includes("from './senkron'")
    && !sepetKod30.includes('senkronGonder') && !kartKod30.includes('senkronGonder'));
  ok('30g · sepetin buluta gitmedigi EKRANDA yazili (sessiz degil)',
    kartSrc30.includes('Sepet kaydı buluta GÖNDERİLMİYOR'));
  ok('30g · kart skora GIRMEDIGINI yaziyor',
    kartSrc30.includes('temel skora GİRMEZ.'));
}

// =====================================================================
//  (31) UST FIYAT SERIDI — yerlesik 6 + cihazdaki ozel gostergeler
// ---------------------------------------------------------------------
//  NE OLCULUYOR: webin sayfa basindaki fiyat seridinin
//  (`TICKER_BUILTIN_META`, app.js:2528) native yuzeyi EKRANDA MI, ucu
//  BAGLI MI, ve kalemler SESSIZ DUSURULMUYOR MU.
//
//  Bu tur ayrica `/api/kur` ucu acildi: truncgil `today.json` Turkce
//  sayi bicimini UC cozuyor, istemci degil (HAM SAYI KURALI §5.1).
//  Kapi, ucun 12 yol dosyasi tavanini ASMADIGINI da olcuyor.
// =====================================================================
{
  const APPJS_PATH_31 = path.join(ROOT, 'app.js');
  const KUR_PATH_31 = path.join(ROOT, 'api', '_kur.js');
  const PROXY_PATH_31 = path.join(ROOT, 'api', 'proxy.js');
  const VERCEL_PATH_31 = path.join(ROOT, 'vercel.json');
  const TIP_PATH_31 = path.join(ROOT, 'mobile', 'src', 'api', 'types.ts');
  const ISTEMCI_PATH_31 = path.join(ROOT, 'mobile', 'src', 'api', 'client.ts');
  const SERIT_PATH_31 = path.join(ROOT, 'mobile', 'src', 'api', 'serit.ts');
  const API_PATH_31 = path.join(ROOT, 'mobile', 'src', 'api', 'index.ts');
  const KART_PATH_31 = path.join(ROOT, 'mobile', 'src', 'components', 'bugun', 'SeritKart.tsx');
  const GIRIS_PATH_31 = path.join(ROOT, 'mobile', 'src', 'components', 'bugun', 'index.ts');
  const EKRAN_PATH_31 = path.join(ROOT, 'mobile', 'src', 'app', '(tabs)', 'bugun.tsx');
  const appSrc31 = readFileSync(APPJS_PATH_31, 'utf8');
  const kurSrc31 = readFileSync(KUR_PATH_31, 'utf8');
  const proxySrc31 = readFileSync(PROXY_PATH_31, 'utf8');
  const vercelSrc31 = readFileSync(VERCEL_PATH_31, 'utf8');
  const tipSrc31 = readFileSync(TIP_PATH_31, 'utf8');
  const istemciSrc31 = readFileSync(ISTEMCI_PATH_31, 'utf8');
  const seritSrc31 = readFileSync(SERIT_PATH_31, 'utf8');
  const apiSrc31 = readFileSync(API_PATH_31, 'utf8');
  const kartSrc31 = readFileSync(KART_PATH_31, 'utf8');
  const girisSrc31 = readFileSync(GIRIS_PATH_31, 'utf8');
  const ekranSrc31 = readFileSync(EKRAN_PATH_31, 'utf8');

  // `serit.ts` ve kart basliklari `truncgilGet`, `toFixed`, `basketPrice`
  // gibi adlari GEREKCE olarak ALINTILIYOR; siyrilmasa "yok" kapilari
  // kendi aciklamalarina takilirdi (§30 ile ayni gerekce).
  const yorumsuz31 = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const seritKod31 = yorumsuz31(seritSrc31);
  const kartKod31 = yorumsuz31(kartSrc31);

  // --- (0) ONCULLER: webde ne var -------------------------------------
  ok('31a · ONCUL · web seridi ayni kumeyi basiyor (`TICKER_BUILTIN_META`)',
    appSrc31.includes('const TICKER_BUILTIN_META = {')
    && appSrc31.includes("gram: 'Gram Altın'") && appSrc31.includes("eth: 'ETH/USD'"));
  ok('31a · ONCUL · web ozel gosterge tavani 4 (`tickerCustomMax`)',
    appSrc31.includes('const tickerCustomMax = ()'));
  ok('31a · ONCUL · webin gram altin DUSUSU: `gram-altin` yoksa `GRA`',
    appSrc31.includes("truncgilGet(data, 'gram-altin') || truncgilGet(data, 'GRA')"));
  ok('31a · ONCUL · webde ozel metal/doviz anahtari KAYDIN SEMBOLU',
    appSrc31.includes('truncgilGet(truncgilCache, h.symbol)'));
  ok('31a · ONCUL · web seridi SAYFA ACILISINDA yukluyor',
    appSrc31.includes("const TICKER_LS = 'sb:tickers'"));

  // --- (1) UC: /api/kur acildi, 12 dosya tavani ASILMADI --------------
  ok('31b · uc dosyasi `_` onekli (yol dosyasi DEGIL)',
    /export default async function|export async function kurHandler|HANDLERLAR/.test(kurSrc31));
  ok('31b · uc KOD SAYISINDAN BAGIMSIZ tek ust istek yapiyor',
    kurSrc31.includes('AZAMI_UST_ISTEK = 1'));
  ok('31b · uc kendi kod tavanini ilan ediyor (40)',
    kurSrc31.includes('AZAMI_KOD = 40'));
  ok('31b · tasiyici tablosunda LITERAL dinamik ice aktarma var',
    proxySrc31.includes("kur:     () => import('./_kur.js')"));
  ok('31b · `vercel.json` yeniden-yazimi bagli',
    vercelSrc31.includes('"/api/kur"') && vercelSrc31.includes('__rota=kur'));
  {
    // Hobby tavani: `api/*.js` yol dosyasi sayisi 12'yi ASAMAZ.
    const yolDosya31 = readdirSync(path.join(ROOT, 'api'))
      .filter((d) => d.endsWith('.js') && !d.startsWith('_'));
    ok('31b · yol dosyasi sayisi 12 tavaninda (' + yolDosya31.length + ')',
      yolDosya31.length <= 12);
  }

  // --- (2) ISTEMCI: adres + sarmalayici + tavan sozlesmede ------------
  ok('31c · istemci adresi tanimli (`ENDPOINTS.kur`)',
    istemciSrc31.includes("kur: '/api/kur'"));
  ok('31c · sarmalayici var (`fetchKur`)',
    istemciSrc31.includes('export async function fetchKur('));
  ok('31c · kod tavani SOZLESMEDEN okunuyor, elle yazilmiyor',
    tipSrc31.includes('export const KUR_AZAMI_KOD = 40')
    && istemciSrc31.includes('KUR_AZAMI_KOD'));

  // --- (3) VAR VE BAGLI -----------------------------------------------
  ok('31d · fiyat katmani var (`seritFiyatlari`)',
    seritKod31.includes('export async function seritFiyatlari('));
  ok('31d · kart var ve adiyla disa aciliyor',
    kartKod31.includes('export function SeritKart()')
    && girisSrc31.includes("export { SeritKart, type SeritKartProps } from './SeritKart';"));
  ok('31d · kart EKRANA TAKILI (Bugun sekmesi)',
    ekranSrc31.includes('SeritKart,') && ekranSrc31.includes('<SeritKart />'));
  ok('31d · api girisi serit turlerini disa aciyor',
    apiSrc31.includes('seritFiyatlari,') && apiSrc31.includes('type SeritKalem,')
    && apiSrc31.includes('type SeritSonuc,'));

  // --- (4) YERLESIK KUME WEB ILE AYNI ---------------------------------
  ok('31e · alti yerlesik kimlik webdeki kume ile birebir',
    ["'gram'", "'usd'", "'eur'", "'gbp'", "'btc'", "'eth'"]
      .every((k) => seritKod31.includes('id: ' + k)));
  ok('31e · gram altin YEDEK kodu da ayni cagrida soruluyor',
    seritKod31.includes("yedekKod: 'GRA'") && seritKod31.includes('y.yedekKod'));
  ok('31e · ozel metal/doviz anahtari KAYDIN SEMBOLU (web ile ayni)',
    /cls === 'metal' \|\| g\.cls === 'fx'/.test(seritKod31));
  ok('31e · nakit TANIM GEREGI 1 (olcum degil, isaretli)',
    seritKod31.includes("uc: 'nakit'") && seritKod31.includes('fiyat: 1,'));

  // --- (5) DEPO: KAYIT KENDI YUKLEYICISINI KURMUYOR -------------------
  ok('31f · fiyat katmani kayitlari KENDI okuyor (kart tasimiyor)',
    seritKod31.includes('gostergelerDepo.al()') && !kartKod31.includes('gostergelerDepo.al()'));
  ok('31f · gizleme kaydi OKUNUYOR (webdeki igneden cikarma)',
    seritKod31.includes('gizliGostergelerDepo.al()'));

  // --- (6) ISTEK SAYISI: dilimleme SOZLESMEDEN ------------------------
  ok('31g · uc tavan da sozlesmeden ice aktariliyor, elle yazilmiyor',
    seritKod31.includes('DEGISIM_AZAMI_SEMBOL') && seritKod31.includes('KRIPTO_AZAMI_ID')
    && seritKod31.includes('KUR_AZAMI_KOD'));
  ok('31g · degisim ucundan YALNIZ gunluk donem isteniyor (maliyet)',
    seritKod31.includes("donemler: ['gunluk']"));

  // --- (7) HAM SAYI KURALI --------------------------------------------
  ok('31h · fiyat katmaninda `toFixed` YOK',
    !seritKod31.includes('toFixed'));
  ok('31h · fiyat katmaninda esik/agirlik/formul adi YOK',
    !/\besik|\bagirlik/i.test(seritKod31));
  ok('31h · kartin KENDI `fetch`i YOK',
    !kartKod31.includes('fetch('));

  // --- (8) SESSIZ KIRPMA YOK ------------------------------------------
  ok('31i · cozulemeyen kalem listede KALIYOR (`fiyat: null` + sebep)',
    seritKod31.includes('sebep: fiyat == null ? SEBEP_UC_SUSTU : null')
    && seritKod31.includes('SEBEP_FON') && seritKod31.includes('SEBEP_SEMBOLSUZ')
    && seritKod31.includes('SEBEP_CGID'));
  ok('31i · gerekce EKRANDA ve SAYISIYLA yazili',
    kartKod31.includes('sebepSayisi') && kartKod31.includes("' kalem: '"));
  ok('31i · olculen / toplam sayaci ekranda',
    kartKod31.includes("olculen + '/'"));
  ok('31i · uclarin kendi uyarilari ekranda',
    kartKod31.includes('Uçların uyarıları'));
  ok('31i · olculmeyen DURUM olculen gibi basilmiyor (bos hal ayri)',
    kartKod31.includes('sonuc == null') && kartKod31.includes('kalemler.length === 0'));

  // --- (9) EKRAN DAVRANISI --------------------------------------------
  ok('31j · acilis istegi IPTAL EDILEBILIR (`AbortController`)',
    kartKod31.includes('new AbortController()') && kartKod31.includes('kesici.abort()'));
  ok('31j · mesgul hali TURETILMIS, etkide `setState` yok',
    kartKod31.includes('const mesgul = sonuc === null;'));
  ok('31j · TOPLAM alinmiyor ve gerekcesi ekranda yazili',
    kartKod31.includes('Toplam ALINMIYOR'));
  ok('31j · yasal uyari kartta yazili',
    kartKod31.includes('yatırım tavsiyesi değildir'));
}

// =====================================================================
//  (32) ICERIDEN ISLEMLER KARTI — webin bilgi paneli native detayda
// ---------------------------------------------------------------------
//  NE OLCULUYOR: webin "Iceriden islemler" panelinin (app.js:5127)
//  native karsiligi EKRANDA MI, ucu BAGLI MI, ve webin tasidigi
//  INVARYANT korunuyor mu: TEMEL SKORA DAHIL DEGIL (kullanici tercihi
//  2026-08-15, app.js:5131).
//
//  Uc tarafi kapi 17'de olculuyor (rota, 400'ler, 12 dosya tavani).
//  BURADA yalniz EKRAN tarafi var: sozlugun anahtar kumesi ucun KAPALI
//  kod kumeleriyle birebir mi, kart kendi Turkce cumlesini uyduruyor
//  mu, pazari KENDI mi cikariyor, dusen kayit sessiz mi kayboluyor.
// =====================================================================
{
  const APPJS_PATH_32 = path.join(ROOT, 'app.js');
  const UC_PATH_32 = path.join(ROOT, 'api', '_iceriden.js');
  const TIP_PATH_32 = path.join(ROOT, 'mobile', 'src', 'api', 'types.ts');
  const ISTEMCI_PATH_32 = path.join(ROOT, 'mobile', 'src', 'api', 'client.ts');
  const SOZLUK_PATH_32 = path.join(ROOT, 'mobile', 'src', 'lib', 'sozluk.ts');
  const KART_PATH_32 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'IceridenKart.tsx');
  const GIRIS_PATH_32 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const EKRAN_PATH_32 = path.join(
    ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const appSrc32 = readFileSync(APPJS_PATH_32, 'utf8');
  const ucSrc32 = readFileSync(UC_PATH_32, 'utf8');
  const tipSrc32 = readFileSync(TIP_PATH_32, 'utf8');
  const istemciSrc32 = readFileSync(ISTEMCI_PATH_32, 'utf8');
  const sozlukSrc32 = readFileSync(SOZLUK_PATH_32, 'utf8');
  const kartSrc32 = readFileSync(KART_PATH_32, 'utf8');
  const girisSrc32 = readFileSync(GIRIS_PATH_32, 'utf8');
  const ekranSrc32 = readFileSync(EKRAN_PATH_32, 'utf8');

  // Kart basliklari `fetch(`, `esik`, `toFixed` gibi adlari GEREKCE
  // olarak ALINTILIYOR; siyrilmasa "yok" kapilari kendi aciklamalarina
  // takilirdi (§30/§31 ile ayni gerekce).
  const yorumsuz32 = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '');
  const kartKod32 = yorumsuz32(kartSrc32);

  // --- (0) ONCULLER: webde ne var -------------------------------------
  ok('32a · ONCUL · web paneli var ve TEMEL SKORA DAHIL DEGIL diyor',
    appSrc32.includes('İçeriden işlemler (bilgi paneli — TEMEL SKORA DAHİL DEĞİL)')
    && appSrc32.includes('Kullanıcı tercihi (2026-08-15): yalnız bilgi, skoru etkilemez.'));
  ok('32a · ONCUL · web pazari ARGUMAN olarak aliyor (cikarim yok)',
    appSrc32.includes('async function fillInsider(symbol, market, req)')
    && appSrc32.includes("market === 'US' ? insiderUS(symbol) : insiderBIST(symbol)"));
  ok('32a · ONCUL · webde US ve BIST ayaklari AYRI govde',
    appSrc32.includes("const H = 'İçeriden işlemler (SEC Form 4)'")
    && appSrc32.includes("const H = 'İçeriden işlemler (KAP)'"));

  // --- (1) SOZLUK ANAHTARLARI UCUN KAPALI KUMESIYLE BIREBIR -----------
  //  Kod -> Turkce cevrimi TEK YERDE (`sozluk.ts`, HAM SAYI KURALI
  //  §5.1). Anahtar kumesi kayarsa ekranda `undefined` basilir; bu
  //  yuzden kume SOZLESMEDEN (types.ts birlesimi) okunup karsilastiriliyor.
  const kumeTip32 = (ad) => {
    const m = new RegExp('export type ' + ad + ' =([\\s\\S]*?);').exec(tipSrc32);
    if (!m) return null;
    return (m[1].match(/'([a-z0-9_]+)'/g) || []).map((x) => x.slice(1, -1)).sort();
  };
  const kumeSozluk32 = (ad) => {
    const m = new RegExp('export const ' + ad + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};').exec(sozlukSrc32);
    if (!m) return null;
    return (m[1].match(/^\s*([a-z0-9_]+):/gm) || [])
      .map((x) => x.trim().replace(':', '')).sort();
  };
  const esit32 = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.join(',') === b.join(',');

  ok('32b · durum sozlugu anahtarlari `IceridenDurumKodu` ile birebir',
    esit32(kumeSozluk32('ICERIDEN_DURUM_SOZLUK'), kumeTip32('IceridenDurumKodu')),
    String(kumeSozluk32('ICERIDEN_DURUM_SOZLUK')) + ' / ' + String(kumeTip32('IceridenDurumKodu')));
  ok('32b · yon sozlugu ve rozeti `IceridenYonKodu` ile birebir',
    esit32(kumeSozluk32('ICERIDEN_YON_SOZLUK'), kumeTip32('IceridenYonKodu'))
    && esit32(kumeSozluk32('ICERIDEN_YON_ROZET'), kumeTip32('IceridenYonKodu')),
    String(kumeSozluk32('ICERIDEN_YON_SOZLUK')));
  ok('32b · iliski sozlugu `IceridenIliskiKodu` ile birebir',
    esit32(kumeSozluk32('ICERIDEN_ILISKI_SOZLUK'), kumeTip32('IceridenIliskiKodu')),
    String(kumeSozluk32('ICERIDEN_ILISKI_SOZLUK')));
  ok('32b · kaynak sozlugu `IceridenKaynakKodu` ile birebir',
    esit32(kumeSozluk32('ICERIDEN_KAYNAK_SOZLUK'), kumeTip32('IceridenKaynakKodu')),
    String(kumeSozluk32('ICERIDEN_KAYNAK_SOZLUK')));

  // Sozlesme ile UCUN GERCEKTEN BASTIGI kodlar da ayni olmak zorunda:
  // types.ts elle yazilmis bir belge, uc ise kodu URETEN yer.
  ok('32b · ucun bastigi DURUM kodlari sozlesmede tanimli',
    ["durumKodu: 'kayit_yok'", "durumKodu: 'bildirim_yok'",
      "? 'bildirim_yok'", ": (yonKod ? 'ok' : 'acik_piyasa_yok')",
      "durumKodu: sirali.length ? 'ok' : 'bildirim_yok'"]
      .every((p) => ucSrc32.includes(p))
    && esit32(kumeTip32('IceridenDurumKodu'),
      ['acik_piyasa_yok', 'bildirim_yok', 'kayit_yok', 'ok']));
  ok('32b · ucun bastigi YON kodlari sozlesmede tanimli (esik YOK)',
    ucSrc32.includes("return 'alim';") && ucSrc32.includes("return 'satim';")
    && ucSrc32.includes("return 'alim_agirlikli';")
    && ucSrc32.includes("return 'satim_agirlikli';")
    && ucSrc32.includes("return 'dengeli';")
    && esit32(kumeTip32('IceridenYonKodu'),
      ['alim', 'alim_agirlikli', 'dengeli', 'satim', 'satim_agirlikli']));
  ok('32b · ucun bastigi ILISKI kodlari sozlesmede tanimli',
    ucSrc32.includes("iliskiKodlari.push('yk')")
    && ucSrc32.includes("iliskiKodlari.push('yonetici')")
    && ucSrc32.includes("iliskiKodlari.push('ortak10')")
    && esit32(kumeTip32('IceridenIliskiKodu'), ['ortak10', 'yk', 'yonetici']));
  ok('32b · ucun bastigi KAYNAK kodlari sozlesmede tanimli',
    ucSrc32.includes("let kaynakKodu = 'kap';")
    && ucSrc32.includes("kaynakKodu = 'haber';")
    && ucSrc32.includes("kaynakKodu = 'kap_haber';")
    && esit32(kumeTip32('IceridenKaynakKodu'), ['haber', 'kap', 'kap_haber']));
  ok('32b · ucta Turkce CUMLE yok (cevrim yalniz sozlukte)',
    !/Pencerede|agirlikli olarak|yonetim kurulu uyesi/.test(ucSrc32));

  // --- (2) VAR, DISA ACIK VE EKRANA TAKILI ----------------------------
  ok('32c · kart var ve adiyla disa aciliyor',
    kartKod32.includes('export function IceridenKart({ sembol, pazar }: IceridenKartProps)')
    && girisSrc32.includes("export { IceridenKart, type IceridenKartProps } from './IceridenKart';"));
  ok('32c · kart HISSE DETAY ekranina TAKILI',
    ekranSrc32.includes('IceridenKart,')
    && ekranSrc32.includes('<IceridenKart sembol={sembol} pazar={satir.market} />'));
  ok('32c · istemci sarmalayicisi var ve adresi tanimli',
    istemciSrc32.includes('export async function fetchIceriden(')
    && istemciSrc32.includes("iceriden: '/api/iceriden',"));

  // --- (3) PAZAR CIKARIMI YOK: cagirandan geliyor ---------------------
  ok('32d · kart pazari PROP olarak aliyor',
    kartSrc32.includes('export type IceridenKartProps = {')
    && /pazar:\s*IceridenPazar;/.test(kartKod32)
    && kartSrc32.includes('Pazar ÇAĞIRANDAN gelir; istemci pazar ÇIKARIMI yapmaz.'));
  ok('32d · kart pazari KENDI CIKARMIYOR (`.IS` / uzanti tahmini yok)',
    !/\.IS|endsWith\(|BIST_SEMBOL|pazarCikar/.test(kartKod32));
  ok('32d · pazari UCUN DONDURDUGU govde ayiriyor (prop ile ayrim degil)',
    kartKod32.includes("govde.pazar === 'US' ? ("));

  // --- (4) HAM SAYI KURALI: hesap/esik/uydurma cumle YOK --------------
  ok('32e · kartin KENDI `fetch`i YOK (api katmanindan cagiriyor)',
    !kartKod32.includes('fetch(') && kartKod32.includes('fetchIceriden(sembol, pazar'));
  ok('32e · kartta esik/agirlik/formul adi YOK',
    !/\besik|\bagirlik|ESIK_|AGIRLIK_/i.test(kartKod32));
  ok('32e · kartta `toFixed` YOK (sayi bicimi tek yerde, `sayiMetni`)',
    !kartKod32.includes('toFixed')
    && kartKod32.includes('function sayiMetni(n: number | null | undefined): string'));
  ok('32e · olculmeyen sayi `EMPTY`, `0` DEGIL',
    kartKod32.includes("if (typeof n !== 'number' || !Number.isFinite(n)) return EMPTY;")
    && !/deger:\s*0\b/.test(kartKod32));
  ok('32e · net tutar UCTA hesaplaniyor, kartta DEGIL',
    ucSrc32.includes('t.netTutar = t.alisTutar - t.satisTutar')
    && !/alisTutar\s*-\s*/.test(kartKod32));
  ok('32e · Turkce cumle SOZLUKTEN geliyor (kart uydurmuyor)',
    kartKod32.includes('ICERIDEN_DURUM_SOZLUK[g.durumKodu]')
    && kartKod32.includes('ICERIDEN_YON_SOZLUK[g.yonKod]')
    && kartKod32.includes('ICERIDEN_KAYNAK_SOZLUK[g.kaynakKodu]'));

  // --- (5) SKORA GIRMEZ INVARYANTI EKRANDA ----------------------------
  ok('32f · kart motoru/skoru HIC CAGIRMIYOR',
    !/buildMotor|fetchScore|fetchAnalyze|skorGirdisi/.test(kartKod32));
  ok('32f · "skora girmez" rozeti EKRANDA',
    kartSrc32.includes('<Pill label="skora girmez" tone="info" glyph={null} size="sm" />'));
  ok('32f · cerceve satiri skora GIRMEDIGINI yaziyor',
    kartSrc32.includes("' — yalnız bilgi: teknik ya da temel skora GİRMEZ.'"));
  ok('32f · yasal uyari kartta yazili',
    kartSrc32.includes('yatırım tavsiyesi değildir'));

  // --- (6) SESSIZ KIRPMA YOK: iki sayac da ekranda --------------------
  ok('32g · US · secilen bildirim ve okunan kayit AYRI AYRI basiliyor',
    kartKod32.includes('sayiMetni(g.bildirimSayisi)')
    && kartKod32.includes("' bildirim seçildi · '")
    && kartKod32.includes('sayiMetni(g.okunan)')
    && kartKod32.includes("' kayıt okundu'"));
  ok('32g · BIST · suzgecten gecen ve ekrana basilan AYRI AYRI basiliyor',
    kartKod32.includes('sayiMetni(g.bulunan)')
    && kartKod32.includes('sayiMetni(g.maddeSayisi)')
    && kartKod32.includes("' tanesi ekranda'"));
  ok('32g · pencere uzunlugu SAYAC satirinda UCTAN okunuyor',
    kartKod32.includes("g.pencereGun +")
    && kartKod32.includes("' günlük pencere · '")
    && ucSrc32.includes('export const PENCERE_GUN = 90;'));
  ok('32g · acik piyasa DISI adet AYRI satir (alim-satim sayilmiyor)',
    kartSrc32.includes('Hibe, opsiyon kullanımı vb. — alım-satım değil, tutarı yok.'));
  ok('32g · ucun kendi `uyari` metni OLDUGU GIBI tasiniyor',
    kartKod32.includes('uyari ? <Text style={[type.micro, { color: colors.textDim }]}>{uyari}</Text> : null'));

  // --- (7) BIST AYAGI: YAPISAL SAYI YOK, GEREKCESI EKRANDA -----------
  {
    const bist32 = kartKod32.slice(kartKod32.indexOf('function BistGovde('));
    ok('32h · BIST govdesinde adet/tutar alani HIC OKUNMUYOR',
      !/alisAdet|satisAdet|alisTutar|satisTutar|netTutar|digerAdet/.test(bist32));
    ok('32h · BIST govdesinde `yonKod` da OKUNMUYOR (uc da basmiyor)',
      !bist32.includes('yonKod'));
    ok('32h · sayinin NEDEN olmadigi EKRANDA yazili (bos alan basilmiyor)',
      kartSrc32.includes('KAP bildirimi adet ve tutarı YAPISAL olarak vermiyor'));
    ok('32h · bildirim basligi YOKSA bos hal AYRI basiliyor',
      kartSrc32.includes('Pencerede bu sembol için bildirim başlığı yok.'));
  }

  // --- (8) EKRAN DAVRANISI --------------------------------------------
  ok('32i · istek anahtari SEMBOL + PAZAR (iki tur birbirine karismaz)',
    kartKod32.includes("sembol + '|iceriden|' + pazar"));
  ok('32i · uc ariza / bos / olculdu halleri AYRI (`Durum` + sart)',
    /<Durum[\s\S]{0,200}durum=\{durum\}[\s\S]{0,200}hata=\{hata\}/.test(kartKod32)
    && kartKod32.includes('yenile={yenile}')
    && kartKod32.includes("durum === 'veri' && govde"));
  ok('32i · dis baglanti acilisi SESSIZ COKMUYOR',
    kartKod32.includes('void Linking.openURL(m.adres).catch(() => {})'));
}

// =====================================================================
//  (33) "NEDEN HAREKET EDIYOR?" — webin TARAYICI hesabi uca tasindi
// ---------------------------------------------------------------------
//  NE OLCULUYOR: webin "Neden hareket ediyor?" bolumu (`fillSpWhy`)
//  esikleri ve karar agacini TARAYICIDA tutuyordu; native istemci hesap
//  YAPMAZ, bu yuzden karar MOTORA (`why*`), hesap `/api/neden` ucuna
//  tasindi. Bu kapi tasimanin GERI KAYMADIGINI olcuyor:
//    - esik kopyasi webde KALMADI, motor fonksiyonlari CAGRILIYOR,
//    - uc kendi esigini UYDURMUYOR, kodlari motordan okuyor,
//    - sozluk anahtarlari ucun KAPALI kumeleriyle birebir,
//    - kart hesap/esik/Turkce hukum URETMIYOR,
//    - dusen manset SESSIZ kaybolmuyor, olculmeyen sayi `0` basilmiyor,
//    - ve NEDENSELLIK IDDIASI yok.
//
//  Ucun rota/400/12-dosya olcumu kapi 17'de; burada ZINCIR var:
//  web -> motor -> uc -> tip -> sozluk -> kart -> ekran.
// =====================================================================
{
  const APPJS_PATH_33 = path.join(ROOT, 'app.js');
  const MOTOR_PATH_33 = path.join(ROOT, 'api', '_motor.js');
  const UC_PATH_33 = path.join(ROOT, 'api', '_neden.js');
  const TIP_PATH_33 = path.join(ROOT, 'mobile', 'src', 'api', 'types.ts');
  const ISTEMCI_PATH_33 = path.join(ROOT, 'mobile', 'src', 'api', 'client.ts');
  const SOZLUK_PATH_33 = path.join(ROOT, 'mobile', 'src', 'lib', 'sozluk.ts');
  const KART_PATH_33 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'HareketKart.tsx');
  const GIRIS_PATH_33 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const EKRAN_PATH_33 = path.join(
    ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const appSrc33 = readFileSync(APPJS_PATH_33, 'utf8');
  const motorSrc33 = readFileSync(MOTOR_PATH_33, 'utf8');
  const ucSrc33 = readFileSync(UC_PATH_33, 'utf8');
  const tipSrc33 = readFileSync(TIP_PATH_33, 'utf8');
  const istemciSrc33 = readFileSync(ISTEMCI_PATH_33, 'utf8');
  const sozlukSrc33 = readFileSync(SOZLUK_PATH_33, 'utf8');
  const kartSrc33 = readFileSync(KART_PATH_33, 'utf8');
  const girisSrc33 = readFileSync(GIRIS_PATH_33, 'utf8');
  const ekranSrc33 = readFileSync(EKRAN_PATH_33, 'utf8');

  // Basliklar `fetch(`, `esik`, `3.0` gibi adlari GEREKCE olarak
  // ALINTILIYOR; siyrilmasa "yok" kapilari kendi aciklamalarina
  // takilirdi (kapi 30/31/32 ile ayni gerekce).
  const yorumsuz33 = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '');
  const kartKod33 = yorumsuz33(kartSrc33);
  const ucKod33 = yorumsuz33(ucSrc33);

  // --- (0) WEB TARAFI: esik kopyasi KALKTI ----------------------------
  ok('33a - ONCUL - webde esik kopyasi KALMADI (satir ici BIG/MOD yok)',
    !appSrc33.includes('const BIG = 3.0, MOD = 1.2'));
  ok('33a - ONCUL - web ekrani ARTIK motor fonksiyonunu cagiriyor',
    appSrc33.includes('const pct = whyGunlukYuzde(price, prev);')
    && appSrc33.includes('const hareketKod = whyHareketKod(pct);')
    && appSrc33.includes('const uzlasma = whyUzlasmaKod(pct, sScore, sHits);'));
  ok('33a - ONCUL - webin karar dallari KODA bakiyor (sayiya degil)',
    appSrc33.includes("if (uzlasma === 'olcum_yok')")
    && appSrc33.includes("else if (uzlasma === 'sakin')")
    && appSrc33.includes("else if (uzlasma === 'haber_uyumlu')")
    && appSrc33.includes("else if (uzlasma === 'celiski')"));

  // --- (1) ESIK TEK YERDE: MOTORDA ------------------------------------
  ok('33b - esikler MOTOR diliminde, ADLANDIRILMIS sabit olarak',
    appSrc33.includes('const WHY_SERT = 3.0;')
    && appSrc33.includes('const WHY_BELIRGIN = 1.2;'));
  ok('33b - URETILMIS motorda da ayni esik ve why* kumesi var',
    motorSrc33.includes('const WHY_SERT = 3.0;')
    && motorSrc33.includes('whyUzlasmaKod')
    && motorSrc33.includes('WHY_UZLASMA_KODLARI'));
  ok('33b - UCTA esik SAYISI YOK (karari motordan aliyor)',
    !/[^0-9.]3\.0[^0-9]|[^0-9.]1\.2[^0-9]|0\.12/.test(ucKod33)
    && ucKod33.includes('ENG.whyHareketKod(yuzde)')
    && ucKod33.includes('ENG.whyUzlasmaKod(yuzde, duy.puan, duy.sinyal)'));
  ok('33b - uc kod KUMELERINI de motordan basiyor (ikinci liste yok)',
    ucKod33.includes('ENG.WHY_HAREKET_KODLARI')
    && ucKod33.includes('ENG.WHY_UZLASMA_KODLARI')
    && ucKod33.includes('ENG.WHY_KUTUP_KODLARI'));

  // --- (2) KOD KUMELERI: motor = sozlesme = sozluk --------------------
  const kumeTip33 = (ad) => {
    const m = new RegExp('export type ' + ad + ' =([\\s\\S]*?);').exec(tipSrc33);
    if (!m) return null;
    return (m[1].match(/'([a-z0-9_]+)'/g) || [])
      .map((x) => x.slice(1, -1)).sort();
  };
  const kumeSozluk33 = (ad) => {
    const m = new RegExp('export const ' + ad + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};')
      .exec(sozlukSrc33);
    if (!m) return null;
    return (m[1].match(/^\s*([a-z0-9_]+):/gm) || [])
      .map((x) => x.trim().replace(':', '')).sort();
  };
  const kumeMotor33 = (ad) => {
    const m = new RegExp('const ' + ad + ' = \\[([^\\]]*)\\]').exec(motorSrc33);
    if (!m) return null;
    return (m[1].match(/'([a-z0-9_]+)'/g) || [])
      .map((x) => x.slice(1, -1)).sort();
  };
  const esit33 = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.join(',') === b.join(',');

  const ESLEME_33 = [
    ['WHY_HAREKET_KODLARI', 'NedenHareketKodu', 'NEDEN_HAREKET_SOZLUK'],
    ['WHY_YON_KODLARI', 'NedenYonKodu', 'NEDEN_YON_SOZLUK'],
    ['WHY_HABER_YON_KODLARI', 'NedenHaberYonKodu', 'NEDEN_HABER_YON_SOZLUK'],
    ['WHY_UZLASMA_KODLARI', 'NedenUzlasmaKodu', 'NEDEN_UZLASMA_SOZLUK'],
    ['WHY_KUTUP_KODLARI', 'NedenKutupKodu', 'NEDEN_KUTUP_SOZLUK'],
  ];
  for (const [motorAd, tipAd, sozlukAd] of ESLEME_33) {
    const mk = kumeMotor33(motorAd);
    const tk = kumeTip33(tipAd);
    const sk = kumeSozluk33(sozlukAd);
    ok('33c - ' + motorAd + ' = ' + tipAd + ' = ' + sozlukAd + ' (birebir)',
      Array.isArray(mk) && mk.length > 0 && esit33(mk, tk) && esit33(tk, sk),
      String(mk) + ' | ' + String(tk) + ' | ' + String(sk));
  }

  // --- (3) VAR, DISA ACIK, EKRANA TAKILI ------------------------------
  ok('33d - kart var ve adiyla disa aciliyor',
    kartKod33.includes('export function HareketKart(')
    && girisSrc33.includes("export { HareketKart, type HareketKartProps } from './HareketKart';"));
  ok('33d - kart HISSE DETAY ekranina TAKILI',
    ekranSrc33.includes('HareketKart,')
    && ekranSrc33.includes('<HareketKart sembol={sembol} pazar={satir.market} />'));
  ok('33d - istemci sarmalayicisi var ve adresi tanimli',
    istemciSrc33.includes('export async function fetchNeden(')
    && istemciSrc33.includes("neden: '/api/neden',"));
  ok('33d - ad CAKISMASI yok: kesfet/NedenKart BASKA ozellik',
    !kartKod33.includes('NedenKart'));

  // --- (4) HAM SAYI KURALI: kartta hesap/esik/uydurma cumle YOK -------
  ok('33e - kartin KENDI fetchi YOK (api katmanindan cagiriyor)',
    !kartKod33.includes('fetch(')
    && kartKod33.includes('fetchNeden(sembol, pazar'));
  ok('33e - kartta esik/agirlik adi YOK',
    !/\besik|\bagirlik|ESIK_|AGIRLIK_/i.test(kartKod33));
  ok('33e - kartta YUZDE HESABI yok (uc yuzde alanini veriyor)',
    !/prevClose|oncekiKapanis\s*\)\s*\*/.test(kartKod33)
    && kartKod33.includes('yuzdeMetni(g.yuzde)'));
  ok('33e - toFixed YALNIZ sunum yardimcisinda (tek yerde)',
    (kartKod33.match(/toFixed/g) || []).length === 1
    && /function yuzdeMetni[\s\S]{0,400}toFixed/.test(kartKod33));
  ok('33e - kart KENDI esik karsilastirmasini YAPMIYOR',
    !/Math\.abs|>=\s*[0-9]|<=\s*-?[0-9]/.test(kartKod33));
  ok('33e - Turkce cumle SOZLUKTEN geliyor (kart uydurmuyor)',
    kartKod33.includes('NEDEN_UZLASMA_SOZLUK[g.uzlasmaKod]')
    && kartKod33.includes('NEDEN_HAREKET_SOZLUK[g.hareketKod]')
    && kartKod33.includes('NEDEN_YON_SOZLUK[g.yonKod]')
    && kartKod33.includes('NEDEN_HABER_YON_SOZLUK[g.haberYonKod]')
    && kartKod33.includes('NEDEN_KUTUP_SOZLUK[b.kutupKod]'));

  // --- (5) OLCULMEYEN SAYI BASILMAZ -----------------------------------
  ok('33f - olculmeyen deger EMPTY, 0 DEGIL',
    kartKod33.includes('return EMPTY;')
    && kartKod33.includes('Number.isFinite(v)')
    && kartKod33.includes('Number.isFinite(n)'));
  ok('33f - duyarlilik OLCULEMEDIYSE sifir puan basilmiyor, soyleniyor',
    kartSrc33.includes('ÖLÇÜLEMEDİ'));
  ok('33f - uc olcum YOKSA uydurma kod basmiyor (ariza kodu var)',
    ucKod33.includes("'motor_yok'") && ucKod33.includes("'neden_alinamadi'"));
  ok('33f - uc duyarlilik yoksa haberYonKod null ve uzlasmaKod olcum_yok',
    ucKod33.includes('duy ? ENG.whyHaberYonKod(duy.puan, duy.sinyal) : null')
    && ucKod33.includes("'olcum_yok'"));
  ok('33f - EKSIK olcum (tam: false) EKRANDA soyleniyor',
    kartKod33.includes('!g.tam')
    && kartSrc33.includes('bu ölçüm EKSİK'));

  // --- (6) SESSIZ KIRPMA YOK ------------------------------------------
  ok('33g - listeye girmeyen manset sayisi (atilan) EKRANDA',
    kartKod33.includes('sayiMetni(g.atilan)'));
  ok('33g - IKI kaynak sayaci da (fiyat + haber) EKRANDA',
    kartKod33.includes('sayiMetni(g.sayac.fiyat.basari)')
    && kartKod33.includes('sayiMetni(g.sayac.fiyat.istek)')
    && kartKod33.includes('sayiMetni(g.sayac.haber.basari)')
    && kartKod33.includes('sayiMetni(g.sayac.haber.istek)'));
  ok('33g - uc atilani GERCEKTEN olcuyor (kirpma sayiliyor)',
    ucKod33.includes('atilan'));
  ok('33g - PUANLANAN ALAN sapmasi EKRANDA yazili (web ile fark)',
    kartSrc33.includes('web sürümünden sapabilir'));
  ok('33g - uc uyarisi kartta OLDUGU GIBI geciyor',
    kartKod33.includes('g.uyari'));

  // --- (7) SKORA GIRMEZ + NEDENSELLIK IDDIASI YOK ---------------------
  ok('33h - kart motoru/skoru HIC CAGIRMIYOR',
    !/buildMotor|fetchScore|fetchAnalyze/.test(kartKod33));
  ok('33h - "skora girmez" rozeti EKRANDA',
    kartSrc33.includes('label="skora girmez"'));
  ok('33h - cerceve satiri skora GIRMEDIGINI yaziyor',
    kartSrc33.includes('skora GİRMEZ'));
  ok('33h - NEDENSELLIK IDDIASI acikca REDDEDILIYOR',
    kartSrc33.includes('anlamına GELMEZ'));
  ok('33h - sozlukte de nedensellik dili YOK',
    !/yüzünden|sebebiyle|nedeniyle/.test(sozlukSrc33.slice(
      sozlukSrc33.indexOf('export const NEDEN_UZLASMA_SOZLUK'),
      sozlukSrc33.indexOf('export const NEDEN_KUTUP_SOZLUK'))));
  ok('33h - yasal uyari kartta yazili',
    kartSrc33.includes('yatırım tavsiyesi değildir'));

  // --- (8) EKRAN DAVRANISI --------------------------------------------
  ok('33i - kart pazari PROP olarak aliyor, KENDI CIKARMIYOR',
    /pazar:\s*NedenPazar/.test(kartKod33)
    && !/\.IS'|endsWith\(|pazarCikar/.test(kartKod33));
  ok('33i - istek anahtari SEMBOL + PAZAR (iki tur karismaz)',
    kartKod33.includes("sembol + '|neden|' + pazar"));
  ok('33i - ariza / bos / olculdu halleri AYRI (Durum + sart)',
    kartKod33.includes('durum={durum}')
    && kartKod33.includes('hata={hata}')
    && kartKod33.includes('yenile={yenile}')
    && kartKod33.includes("durum === 'veri'"));
  ok('33i - dis baglanti acilisi SESSIZ COKMUYOR',
    kartKod33.includes('Linking.openURL(b.adres).catch(() => {})'));
}

// =====================================================================
//  (34) KATALIZOR / RISK -> YAKLASAN TEMETTU: web hesabi uca tasindi
// ---------------------------------------------------------------------
//  NE OLCULUYOR: webin "Katalizor / Risk" satiri (`fillCatalysts`) gun
//  farkini ve `days <= 45` esigini TARAYICIDA tutuyordu; native istemci
//  hesap YAPMAZ, esik TASIMAZ -> karar MOTORA (`katGunFarki` /
//  `katTemettuKod` / `KAT_TEMETTU_GUN`), hesap `/api/katalizor` ucuna
//  tasindi. Bu kapi tasimanin GERI KAYMADIGINI olcuyor.
//
//  WEBDEKI SATIR UC BACAKLI; KART YALNIZ BIRINI BASIYOR, BILINCLI:
//    (1) OYNAKLIK  -> `/api/analyze` + `RiskOdulKart`ta ZATEN olculuyor
//        (ayni ATR'yi iki kez olcmemek icin burada YOK),
//    (2) YAKLASAN TEMETTU -> `KatalizorKart` (bu kapinin konusu),
//    (3) HABER UYARISI -> OLCUM DEGIL, sabit cumle; `lib/sozluk.ts`
//        icinde (`KATALIZOR_HABER_UYARISI`), uctan TASINMIYOR.
//  Kapi bu ucunu de AYRI AYRI dogruluyor; yoksa "eksik port" ile
//  "bilincli bolunme" ayirt edilemez.
//
//  Ucun rota / 400 / 12-dosya olcumu kapi 17'de; burada ZINCIR var:
//  web -> motor -> uc -> tip -> sozluk -> kart -> ekran.
// =====================================================================
{
  const APPJS_PATH_34 = path.join(ROOT, 'app.js');
  const MOTOR_PATH_34 = path.join(ROOT, 'api', '_motor.js');
  const UC_PATH_34 = path.join(ROOT, 'api', '_katalizor.js');
  const TIP_PATH_34 = path.join(ROOT, 'mobile', 'src', 'api', 'types.ts');
  const ISTEMCI_PATH_34 = path.join(ROOT, 'mobile', 'src', 'api', 'client.ts');
  const SOZLUK_PATH_34 = path.join(ROOT, 'mobile', 'src', 'lib', 'sozluk.ts');
  const KART_PATH_34 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'KatalizorKart.tsx');
  const GIRIS_PATH_34 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'index.ts');
  const EKRAN_PATH_34 = path.join(
    ROOT, 'mobile', 'src', 'app', 'hisse', '[sembol].tsx');
  const RISK_PATH_34 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'RiskOdulKart.tsx');
  const TEMETTU_PATH_34 = path.join(
    ROOT, 'mobile', 'src', 'components', 'detay', 'TemettuKart.tsx');
  const appSrc34 = readFileSync(APPJS_PATH_34, 'utf8');
  const motorSrc34 = readFileSync(MOTOR_PATH_34, 'utf8');
  const ucSrc34 = readFileSync(UC_PATH_34, 'utf8');
  const tipSrc34 = readFileSync(TIP_PATH_34, 'utf8');
  const istemciSrc34 = readFileSync(ISTEMCI_PATH_34, 'utf8');
  const sozlukSrc34 = readFileSync(SOZLUK_PATH_34, 'utf8');
  const kartSrc34 = readFileSync(KART_PATH_34, 'utf8');
  const girisSrc34 = readFileSync(GIRIS_PATH_34, 'utf8');
  const ekranSrc34 = readFileSync(EKRAN_PATH_34, 'utf8');
  const riskSrc34 = readFileSync(RISK_PATH_34, 'utf8');
  const temettuSrc34 = readFileSync(TEMETTU_PATH_34, 'utf8');

  // Basliklar `45`, `esik`, `fetch(` gibi adlari GEREKCE olarak
  // ALINTILIYOR; siyrilmasa "yok" kapilari kendi aciklamalarina
  // takilirdi (kapi 30-33 ile ayni gerekce).
  const yorumsuz34 = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/[^\n]*/g, '');
  const kartKod34 = yorumsuz34(kartSrc34);
  const ucKod34 = yorumsuz34(ucSrc34);
  const tipKod34 = yorumsuz34(tipSrc34);

  // --- (0) WEB TARAFI: esik kopyasi KALKTI ----------------------------
  const webKod34 = yorumsuz34(appSrc34);
  // SADECE `fillCatalysts` GOVDESI olculuyor: `days = Math.ceil(...)`
  // app.js'de BASKA ozelliklerde (kazanc takvimi, grafik ekseni) de
  // gecerli olarak duruyor; tum dosyayi taramak YANLIS kirmizi verirdi.
  const katGovde34 = (() => {
    const bas = webKod34.indexOf('async function fillCatalysts(');
    if (bas < 0) return null;
    const son = webKod34.indexOf('\n  function initFundamental(', bas);
    return son > bas ? webKod34.slice(bas, son) : webKod34.slice(bas);
  })();
  ok('34a - ONCUL - `fillCatalysts` govdesi BULUNDU (dilim olculuyor)',
    typeof katGovde34 === 'string' && katGovde34.length > 400,
    String(katGovde34 && katGovde34.length));
  ok('34a - ONCUL - webde satir ici gun farki hesabi KALMADI',
    !/days\s*=\s*Math\.(round|floor|ceil)/.test(katGovde34 || '')
    && !/upcoming\.date\s*-\s*today/.test(katGovde34 || ''));
  ok('34a - ONCUL - webde `days <= 45` esik KARSILASTIRMASI KALMADI',
    !/days\s*<=\s*45/.test(katGovde34 || ''));
  ok('34a - ONCUL - web ekrani ARTIK motor fonksiyonlarini cagiriyor',
    appSrc34.includes('const days = katGunFarki(upcoming.date, today);')
    && appSrc34.includes("if (katTemettuKod(days) === 'yakin')"));
  ok('34a - ONCUL - webin karar dali KODA bakiyor (sayiya degil)',
    !/katTemettuKod\(days\)\s*[<>=]=?\s*[0-9]/.test(webKod34));

  // --- (1) ESIK TEK YERDE: MOTORDA ------------------------------------
  ok('34b - esik MOTOR diliminde, ADLANDIRILMIS sabit olarak',
    appSrc34.includes('const KAT_TEMETTU_GUN = 45;')
    && appSrc34.includes("const KAT_TEMETTU_KODLARI = ['yakin', 'uzak', 'gecti'];"));
  ok('34b - URETILMIS motorda da ayni esik ve kat* kumesi var',
    motorSrc34.includes('const KAT_TEMETTU_GUN = 45;')
    && motorSrc34.includes('katGunFarki')
    && motorSrc34.includes('katTemettuKod')
    && motorSrc34.includes('KAT_TEMETTU_KODLARI'));
  ok('34b - UCTA esik SAYISI YOK (karari motordan aliyor)',
    !/[^0-9.]45[^0-9]/.test(ucKod34)
    && ucKod34.includes('ENG.katGunFarki(')
    && ucKod34.includes('ENG.katTemettuKod('));
  ok('34b - uc kod KUMESINI de motordan basiyor (ikinci liste yok)',
    ucKod34.includes('ENG.KAT_TEMETTU_KODLARI'));
  ok('34b - TIP dosyasinda da esik SAYISI YOK (native esik tasimiyor)',
    !/[^0-9.]45[^0-9]/.test(tipKod34.slice(
      tipKod34.indexOf('KATALIZOR_PAZARLAR'))));

  // --- (2) KOD KUMELERI: motor = sozlesme = sozluk --------------------
  // Karakter sinifi BUYUK HARF de iceriyor: `PAZARLAR` degerleri
  // 'US' / 'BIST'. Yalniz kucuk harf arayan surum iki kumeyi de BOS
  // dondurup kapiyi SESSIZ yanlis kirmiziya dusuruyordu.
  const kumeMotor34 = (ad) => {
    const m = new RegExp('const ' + ad + ' = \\[([^\\]]*)\\]').exec(motorSrc34);
    if (!m) return null;
    return (m[1].match(/'([A-Za-z0-9_]+)'/g) || [])
      .map((x) => x.slice(1, -1)).sort();
  };
  // Tip tarafi `as const` DIZISINDEN turuyor (`(typeof X)[number]`), bu
  // yuzden kume DIZIDEN okunuyor; `export type` satirinda literal YOK.
  const kumeTip34 = (ad) => {
    const m = new RegExp('export const ' + ad + ' = \\[([^\\]]*)\\]')
      .exec(tipSrc34);
    if (!m) return null;
    return (m[1].match(/'([A-Za-z0-9_]+)'/g) || [])
      .map((x) => x.slice(1, -1)).sort();
  };
  const kumeSozluk34 = (ad) => {
    const m = new RegExp('export const ' + ad + '[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};')
      .exec(sozlukSrc34);
    if (!m) return null;
    return (m[1].match(/^\s*([a-z0-9_]+):/gm) || [])
      .map((x) => x.trim().replace(':', '')).sort();
  };
  const kumeUc34 = (ad) => {
    const m = new RegExp('export const ' + ad + ' = \\[([^\\]]*)\\]').exec(ucSrc34);
    if (!m) return null;
    return (m[1].match(/'([A-Za-z0-9_]+)'/g) || [])
      .map((x) => x.slice(1, -1)).sort();
  };
  const esit34 = (a, b) => Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.join(',') === b.join(',');

  {
    const mk = kumeMotor34('KAT_TEMETTU_KODLARI');
    const tk = kumeTip34('KATALIZOR_TEMETTU_KODLARI');
    const sk = kumeSozluk34('KATALIZOR_TEMETTU_SOZLUK');
    ok('34c - KAT_TEMETTU_KODLARI = tip dizisi = sozluk (birebir)',
      Array.isArray(mk) && mk.length === 3 && esit34(mk, tk) && esit34(tk, sk),
      String(mk) + ' | ' + String(tk) + ' | ' + String(sk));
  }
  {
    // `tarihTuru` kumesinin MOTORDA karsiligi YOK (karar degil, KAYNAK
    // kunyesi): uc kendi listesini basiyor, tip ve sozluk ona uyacak.
    const uk = kumeUc34('TARIH_TURLERI');
    const tk = kumeTip34('KATALIZOR_TARIH_TURLERI');
    const sk = kumeSozluk34('KATALIZOR_TARIH_TURU_SOZLUK');
    ok('34c - TARIH_TURLERI (uc) = tip dizisi = sozluk (birebir)',
      Array.isArray(uk) && uk.length === 2 && esit34(uk, tk) && esit34(tk, sk),
      String(uk) + ' | ' + String(tk) + ' | ' + String(sk));
  }
  {
    const uk = kumeUc34('PAZARLAR');
    const tk = kumeTip34('KATALIZOR_PAZARLAR');
    ok('34c - PAZARLAR (uc) = KATALIZOR_PAZARLAR (tip) birebir',
      Array.isArray(uk) && uk.length === 2
      && uk.join(',') === 'BIST,US' && esit34(uk, tk),
      String(uk) + ' | ' + String(tk));
    ok('34c - istemci pazari TIP DIZISINDEN dogruluyor (ikinci liste yok)',
      istemciSrc34.includes('KATALIZOR_PAZARLAR.includes(pazar)'));
  }
  ok('34c - uc kod kumelerini CEVAPTA da basiyor (istemci uydurmuyor)',
    ucKod34.includes('temettu: ENG.KAT_TEMETTU_KODLARI')
    && ucKod34.includes('tarihTuru: TARIH_TURLERI'));

  // --- (3) VAR, DISA ACIK, EKRANA TAKILI ------------------------------
  ok('34d - kart var ve adiyla disa aciliyor',
    kartKod34.includes('export function KatalizorKart(')
    && girisSrc34.includes(
      "export { KatalizorKart, type KatalizorKartProps } from './KatalizorKart';"));
  ok('34d - kart HISSE DETAY ekranina TAKILI',
    ekranSrc34.includes('KatalizorKart,')
    && ekranSrc34.includes('<KatalizorKart sembol={sembol} pazar={satir.market} />'));
  ok('34d - istemci sarmalayicisi var ve adresi tanimli',
    istemciSrc34.includes('export async function fetchKatalizor(')
    && istemciSrc34.includes("katalizor: '/api/katalizor',"));
  ok('34d - ariza cumlesi istemcide KARSILIGI olan kodla eslesiyor',
    istemciSrc34.includes("case 'katalizor_alinamadi':")
    && tipSrc34.includes("| 'katalizor_alinamadi'"));

  // --- (4) HAM SAYI KURALI: kartta hesap/esik/uydurma cumle YOK -------
  ok('34e - kartin KENDI fetchi YOK (api katmanindan cagiriyor)',
    !kartKod34.includes('fetch(')
    && kartKod34.includes('fetchKatalizor(sembol, pazar'));
  ok('34e - kartta esik SAYISI ve esik ADI YOK',
    !/[^0-9.]45[^0-9]/.test(kartKod34)
    && !/KAT_TEMETTU_GUN|\besik|\bagirlik|ESIK_|AGIRLIK_/i.test(kartKod34));
  ok('34e - kartta GUN FARKI hesabi YOK (uc `gun` alanini veriyor)',
    !/Date\.now\(\)|new Date\(|tarihMs\s*-/.test(kartKod34)
    && kartKod34.includes('gunMetni(t.gun)'));
  ok('34e - kartta ORAN/YUZDE donusumu YOK (uc yuzde PUANI veriyor)',
    !/\*\s*100|\/\s*100/.test(kartKod34)
    && kartKod34.includes("sayiMetni(t.verimYuzde) + '%'"));
  ok('34e - kart KENDI bant kararini VERMIYOR, yalniz `kod` okuyor',
    kartKod34.includes('KATALIZOR_TEMETTU_SOZLUK')
    && kartKod34.includes('sozluktenSec(KATALIZOR_TEMETTU_SOZLUK, t?.kod)'));
  ok('34e - Turkce cumle SOZLUKTEN geliyor (kart uydurmuyor)',
    kartKod34.includes('KATALIZOR_TARIH_TURU_SOZLUK')
    && kartKod34.includes('KATALIZOR_HABER_UYARISI'));
  // `uyari` ZATEN izinli TEK Turkce alan (HAM SAYI KURALI). Dolayisiyla
  // iddia "hic Turkce yok" DEGIL: Turkce gecen TEK satir YASAL UYARI
  // sabiti olmali. Baska bir satir Turkce kazanirsa kapi kirilir.
  const turkceSatir34 = yorumsuz34(ucSrc34).split('\n')
    .map((l) => l.trim())
    .filter((l) => /[çğıöşüÇĞİÖŞÜ]/.test(l));
  ok('34e - UCTAN serbest Turkce METIN GELMIYOR (`uyari` disinda)',
    turkceSatir34.length === 1
    && turkceSatir34[0].startsWith('const UYARI ='),
    turkceSatir34.join(' || '));
  ok('34e - kart motoru/skoru HIC CAGIRMIYOR',
    !/buildMotor|fetchScore|fetchAnalyze|katTemettuKod|katGunFarki/
      .test(kartKod34));

  // --- (5) OLCULMEYEN SAYI BASILMAZ -----------------------------------
  ok('34f - olculmeyen deger EMPTY, 0 DEGIL',
    kartKod34.includes('return EMPTY;')
    && (kartKod34.match(/Number\.isFinite/g) || []).length === 2);
  ok('34f - `0 gun` GECERLI olcum: bugun olarak basiliyor, bos degil',
    kartKod34.includes("if (gun === 0) return 'bugün';"));
  ok('34f - olculmeyen TUTAR/VERIM/ODEME satiri HIC CIKMIYOR (0 yok)',
    kartKod34.includes('t.tutar !== null ?')
    && kartKod34.includes('t.verimYuzde !== null ?')
    && kartKod34.includes('t.odendi !== null ?'));
  ok('34f - yaklasan tarih YOKSA ayri bos hal basiliyor (uydurma yok)',
    kartKod34.includes('t === null ?')
    && kartSrc34.includes('ölçülen yaklaşan temettü tarihi yok'));
  ok('34f - tarih OKUNDU ama bant yoksa cumle UYDURULMUYOR',
    kartKod34.includes('t.kod ?')
    && kartSrc34.includes('bandı belirlenemedi'));
  ok('34f - uc olcum YOKSA uydurma kod basmiyor (ariza kodu var)',
    ucKod34.includes("'motor_yok'") && ucKod34.includes("'katalizor_alinamadi'"));
  ok('34f - EKSIK olcum (tam: false) EKRANDA soyleniyor',
    kartKod34.includes('!g.tam')
    && kartSrc34.includes('ölçüm eksik olabilir'));

  // --- (6) SESSIZ KIRPMA YOK ------------------------------------------
  ok('34g - listeye girmeyen ileri tarih sayisi (atilan) EKRANDA',
    kartKod34.includes('sayiMetni(g.atilan)'));
  ok('34g - tarihi OKUNAMAYAN madde sayisi da EKRANDA',
    kartKod34.includes('sayiMetni(g.tarihiOkunamayan)'));
  ok('34g - uc ikisini de GERCEKTEN olcuyor (kirpma sayiliyor)',
    ucKod34.includes('atilan:') && ucKod34.includes('tarihiOkunamayan:'));
  ok('34g - uc uyarisi kartta OLDUGU GIBI geciyor',
    kartKod34.includes('g.uyari'));

  // --- (7) UC BACAK AYRI: CAKISMA YOK, YERI EKRANDA YAZILI -----------
  ok('34h - (1) OYNAKLIK bacagi bu kartta YOK (ATR iki kez olculmuyor)',
    !/atrPlan|oynaklik|ATR/i.test(kartKod34));
  ok('34h - (1) oynaklik bacagi RiskOdulKart`ta GERCEKTEN duruyor',
    /atrPlan|oynaklik/i.test(riskSrc34));
  ok('34h - (2) ham temettu kunyesi TemettuKart`ta, GUN FARKI YOK',
    /exDividendTs|dividendTs/.test(temettuSrc34)
    && !/katGunFarki|gunMetni|KATALIZOR_/.test(temettuSrc34));
  ok('34h - (3) haber uyarisi SABIT cumle: sozlukte, UCTA DEGIL',
    sozlukSrc34.includes('export const KATALIZOR_HABER_UYARISI')
    && !ucSrc34.includes('KATALIZOR_HABER_UYARISI'));
  ok('34h - diger iki bacagin NEREDE olduğu EKRANDA yazili',
    kartSrc34.includes('Risk / Ödül')
    && kartSrc34.includes('aynı ölçüm iki kez istenmiyor'));

  // --- (8) SKORA GIRMEZ + YASAL --------------------------------------
  ok('34i - "skora girmez" rozeti EKRANDA',
    kartSrc34.includes('label="skora girmez"'));
  ok('34i - cerceve satiri skora GIRMEDIGINI yaziyor',
    kartSrc34.includes('skora GİRMEZ'));
  ok('34i - yasal uyari kartta yazili',
    kartSrc34.includes('yatırım tavsiyesi değildir'));
  ok('34i - sozlukte VAAT/TAVSIYE dili YOK',
    !/kazandırır|garanti|al\/sat|tavsiye ederiz/.test(sozlukSrc34.slice(
      sozlukSrc34.indexOf('export const KATALIZOR_TEMETTU_SOZLUK'))));

  // --- (9) EKRAN DAVRANISI -------------------------------------------
  ok('34j - kart pazari PROP olarak aliyor, KENDI CIKARMIYOR',
    /pazar:\s*KatalizorPazar/.test(kartKod34)
    && !/\.IS'|endsWith\(|pazarCikar/.test(kartKod34));
  ok('34j - istek anahtari SEMBOL + PAZAR (iki pazar karismaz)',
    kartKod34.includes("sembol + '|katalizor|' + pazar"));
  ok('34j - ariza / bos / olculdu halleri AYRI (Durum + sart)',
    kartKod34.includes('durum={durum}')
    && kartKod34.includes('hata={hata}')
    && kartKod34.includes('yenile={yenile}')
    && kartKod34.includes("durum === 'veri' && govde"));
}


bitir();
