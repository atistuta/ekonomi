// ===========================================================================
//  api/_kesif.js — KEŞİF TAŞIYICISI  ·  ELLE YAZILMIŞTIR
//  tarama · sektör · radar · backtest · değerleme (metal/kripto)
// ===========================================================================
//
//  BU DOSYA BİR UÇ DEĞİL, TAŞIYICI. `_` öneki Vercel'de rotaya çevrilmez,
//  serverless fonksiyon SAYILMAZ. ÖLÇÜLDÜ: api/ altındaki `_` ÖNEKSİZ dosya
//  sayısı tam 12 (analyze, causal, chart, compare, news, poll, proxy, pulse,
//  recommend, score, theme, watchlist). Hobby planı bir deploy'a en çok 12
//  fonksiyon alıyor; 13.'sü deploy'u "Deploying outputs" adımında SESSİZCE
//  patlatıyor (api/proxy.js:14-26'daki ölçüm). Bu yüzden beş yeni uç YENİ
//  DOSYA DEĞİL: hepsi `vercel.json` rewrite'ı + `api/proxy.js`teki `__rota`
//  ayrıştırmasıyla ZATEN VAR OLAN proxy fonksiyonunun üstüne biniyor —
//  /api/yfin için 2026-10-19'da kurulan desenin BİREBİR aynısı
//  (api/_yfin.js'in `yfinHandler`ı). Fonksiyon sayısı 12'de KALIYOR;
//  tests/uc-test.mjs ⑮ bunu kalıcı olarak kilitliyor.
//
//  BÜTÇE: proxy.js'in `maxDuration: 30`unu PAYLAŞIYORUZ. Yeni bir sayı
//  UYDURULMADI — rewrite hedefi proxy fonksiyonu olduğu için bu beş yolun
//  bütçesi fiziksel olarak onun bütçesi. Beşinden yalnız `backtest` ağa
//  çıkıyor (tek Yahoo serisi, api/chart.js'in ölçtüğü maliyet); öteki dördü
//  AĞA HİÇ ÇIKMIYOR.
//
//  MANTIK BURADA DEĞİL, MOTORDA. Bu dosyada EŞİK, AĞIRLIK, FORMÜL YOKTUR.
//  Her uç: girdiyi doğrula → `buildMotor(AG.H)` ile kurulmuş motorun
//  dilimini çağır → HAM SAYIYI JSON olarak ver. Dilimler dalga-B1'de
//  app.js'ten ÜRETİLDİ (tools/motor-uret.mjs); bu uçlar onların ilk HTTP
//  tüketicisi. Bir sayı bu dosyaya yazılırsa ekran ile sunucu sessizce
//  ayrışır.
//
//  GİRDİYİ İSTEMCİ VERİYOR (api/causal.js'in (b) gerekçesi, api/pulse.js'in
//  "istemci verdi" yolu): `tarama` ve `sektor` Yahoo TEMEL verisi istiyor;
//  motorun içinde o veriyi çeken bir dilim YOK (`yfinQuery` app.js tarafında,
//  `buildMotor` dönüşünde değil — ölçüldü). İki seçenek vardı:
//    (a) uç kendisi /api/yfin'i içeriden çağırsın → `_yfin.js`in crumb
//        durumunu ve 12'lik kırpmasını ikinci bir yoldan sürmek demekti;
//    (b) ÖLÇÜMLERİ İSTEMCİ GÖNDERSİN, uç yalnız AKIL YÜRÜTSÜN → seçildi.
//  İstemci o kayıtları ZATEN /api/yfin'den alıyor. Sonuç: iki uç ağa hiç
//  çıkmıyor, tamamı ağsız ölçülebiliyor, kullanıcı verisi (liste/portföy)
//  motora GİRDİ olarak geliyor — `radarUniverse` benzeri bir evren uçta
//  UYDURULMUYOR.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1) — NE DÜŞÜRÜLDÜ:
//    · `scanCrit`/`priceOppChip` motorun dışa aktarımında YOK (HTML üretiyorlar).
//    · `scanScore().crits[].html` → düşürüldü, yalnız `cls` + ölçüt adı kaldı.
//    · `scanTag().txt` ('💎 Belirgin ucuz') → düşürüldü, `cls` kaldı.
//    · `SCAN_PRESETS[].desc` (HTML) ve `.emoji` → tele KONMADI.
//    · `computeBacktest().buckets[].label` ('60–100 · güçlü AL') → düşürüldü;
//      kova SIRA NUMARASIYLA dönüyor. Bu bir AL/SAT metnidir, tavsiye dilidir;
//      kovanın sayısı bilgidir, cümlesi değil.
//    · `computeMetalMacro`/`computeCryptoValue`ın `comps[].note` ve
//      `warnings[]` metinleri → düşürüldü (serbest Türkçe + tavsiye dili);
//      yalnız `uyariAdet` SAYISI geçiyor.
//    · `band.label`, `catLabel`, `SEK_META[].e`, `RADAR_THEMES[].emoji`
//      → düşürüldü.
//  Cevaplarda geçen metinler: MAKİNE KODU (`cls`, `basis`, `kategori`,
//  `neden`, sektör/tema anahtarı) ve ÖLÇÜT/SEKTÖR ADI (etiket).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { AZAMI_SORGU, PAZARLAR, temizleSembol, cozEndeks } from './_girdi.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  ROTA ADLARI — TEK KAYNAK.
//  `vercel.json`daki rewrite'lar, `api/proxy.js`teki ayrıştırma ve
//  tests/uc-test.mjs ⑮ bu listeyi okuyor. Bir ad üç yerde elle yazılsaydı
//  birindeki yazım hatası 404'ü ancak canlıda gösterirdi.
// ---------------------------------------------------------------------
export const ROTALAR = Object.freeze(['tarama', 'sektor', 'radar', 'backtest', 'deger', 'arama']);

// ---------------------------------------------------------------------
//  SINIRLAR — niye bu sayılar
//  AZAMI_GOVDE_BAYT = 65536 · api/causal.js'teki AZAMI_GOVDE_BAYT ile AYNI
//    sayı, ÖLÇÜLEREK kopyalandı: yük (kayıt sayısı × alan sayısı) orada da
//    burada da istemcinin gönderdiği listeyle büyüyor. ASIL tavan budur.
//  AZAMI_OLCUM = 120 · ÖLÇÜM: istemci temel kayıtları /api/yfin'den 12'lik
//    kümeler hâlinde alıyor (api/_yfin.js:147 `slice(0, 12)`), yani 120 =
//    on tam tur. Bu sayı yalnız SAYILABİLİR bir hata verebilmek için var
//    (sessiz kırpma YOK); bayt tavanı çoğu zaman önce dolar.
//  `AZAMI_SEMBOL = 8` (api/_girdi.js) BURAYA UYMAZ: o, sembol başına AĞ TURU
//    olan skor uçlarının tavanı. Bu iki uç ağa çıkmıyor; 8'e kısmak
//    kullanıcının 40 hisselik listesini taranamaz yapardı.
// ---------------------------------------------------------------------
export const AZAMI_GOVDE_BAYT = 65536;
export const AZAMI_OLCUM = 120;

// `sekSortGroups(groups, mode)`un okuduğu kipler. Motor bu kümeyi bir sabit
// olarak dışa VERMİYOR (ölçüldü), bu yüzden GİRDİ BEYAZ LİSTESİ olarak
// burada duruyor — bir eşik ya da formül değil, kabul edilen dizgelerin
// listesi. tests/uc-test.mjs ⑮ bu dört dizgenin motorun metninde GERÇEKTEN
// geçtiğini ölçerek sürüklenmeyi kilitliyor.
export const SIRA_KIPLERI = Object.freeze(['cheap', 'growth', 'margin', 'count']);
export const VARSAYILAN_SIRA = 'cheap';

// `fetchYahooOHLC`un beyaz listesi — api/chart.js'teki İKİZİYLE aynı küme.
// NİYE KOPYA: `chart.js` içe alınsaydı modül düzeyinde İKİNCİ bir motor
// kurulurdu (her proxy soğuk başlangıcında iki `buildMotor`). Kopyanın
// bedeli tests/uc-test.mjs ⑮'teki SÜRÜKLENME KİLİDİ ile ödeniyor: iki liste
// ayrışırsa test kırmızı yanar.
export const ARALIKLAR = Object.freeze(['1d', '1mo', '3mo', '6mo', '1y', '5y']);
export const ADIMLAR = Object.freeze(['5m', '15m', '60m', '1d']);

// Backtest varsayılan penceresi. ÖLÇÜM (api/_motor.js:1978 BT_CFG +
// 2000 computeBacktest): `orta` için warmup 210 + H 45 + 40 = 295 bar
// gerekiyor, yani 1y/1d (~252 bar) YETMEZ → gün sonu varsayılanı 5y/1d.
// `gunici` warmup 120 + H 14 + 40 = 174 bar istiyor; 60m serisi Yahoo'da en
// çok 1y veriliyor → 1y/60m. Bunlar eşik değil, PENCERE seçimi; eşikler
// motorda.
const VARSAYILAN_ARALIK_GUN = '5y';
const VARSAYILAN_ADIM_GUN = '1d';
const VARSAYILAN_ARALIK_ICI = '1y';
const VARSAYILAN_ADIM_ICI = '60m';

// Yahoo temel kaydının bu uçların OKUDUĞU alanları. ÖLÇÜLDÜ:
//   · sayısal → `scanScore` (api/_motor.js:2417) ve `sekBuildGroups`in
//     okuduğu alanlar;
//   · metinsel → `sekClassify` (api/_motor.js:2612) sector/industry/name/
//     bizSummary üzerinden sınıflandırıyor.
// Beyaz liste KARA LİSTE DEĞİL: kaydın geri kalanı (website, country, …) bu
// dilimlerde okunmuyor, bu yüzden taşınmıyor.
export const OLCUM_SAYISAL = Object.freeze([
  'trailingPE', 'forwardPE', 'peg', 'priceToBook', 'priceToSales', 'evEbitda',
  'marketCap', 'profitMargin', 'returnOnEquity', 'revenueGrowth',
  'earningsGrowth', 'debtToEquity', 'dividendYield', 'price',
]);
export const OLCUM_METINSEL = Object.freeze(['sector', 'industry', 'name', 'bizSummary']);

function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — api/chart.js:180 ve api/score.js:171 ile AYNI
//  kabuk. Kendi kabuğumu uydurmadım: ağırlıklar aynı biçimde takılıyor ki
//  bir sapma tek uçta değil her uçta görünsün.
//  NOT: `api/proxy.js` bu dosyayı DİNAMİK import ediyor (`await import`),
//  böylece düz /api/proxy?url= trafiği motor kurulum maliyetini ÖDEMİYOR.
// ---------------------------------------------------------------------
let AG = null;
let ENG = null;
let KURULUM_HATASI = null;
try {
  AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
  ENG._weights = AG.H.window.TA_WEIGHTS;
  ENG._bench = AG.H.window.TA_BENCHMARK;
} catch (e) {
  KURULUM_HATASI = e;
}

/** Motor kuruldu mu — test bunu ağsız okuyabiliyor. */
export function motorHazir() { return !!(ENG && AG && !KURULUM_HATASI); }

/**
 * TEST KANCASI (`_onbellek.js:kvTak` ile aynı amaç). Testin SCAN_PRESETS /
 * METAL_MACRO_W / TA_HORIZON / RADAR_THEMES / SECTORS / BT_CFG beyaz
 * listelerini ucun KENDİ motorundan okuyabilmesi için var: aksi hâlde test
 * ya o listeleri ELLE kopyalar (sürüklenme) ya da İKİNCİ bir motor kurar
 * (soğuk başlangıç + iki ayrı imza). Üretimde kimse çağırmıyor.
 */
export function motorBak() { return ENG; }

// =====================================================================
//  ORTAK KAPILAR
// =====================================================================

/** CORS + OPTIONS + yöntem + motor kapısı. true dönerse cevap YAZILDI. */
function kapi(req, res, yontemler) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', yontemler);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }

  const izinli = yontemler.split(',').map((s) => s.trim());
  if (!izinli.includes(req.method)) {
    res.setHeader('Allow', yontemler);
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return true;
  }
  if (!motorHazir()) {
    console.error('api/_kesif: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
    kisaOnbellek(res);
    res.status(503).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return true;
  }
  return false;
}

/** Gövdeyi çöz. Hata hâlinde cevabı YAZAR ve null döner. */
function govdeAl(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > AZAMI_GOVDE_BAYT) {
      kisaOnbellek(res);
      res.status(413).json({ error: 'govde_buyuk', azami: AZAMI_GOVDE_BAYT, uyari: UYARI });
      return null;
    }
    try { body = JSON.parse(body); } catch { body = null; }
    if (!body) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bozuk_json', uyari: UYARI });
      return null;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'govde_yok', uyari: UYARI });
    return null;
  }
  return body;
}

/**
 * İstemcinin gönderdiği Yahoo temel kayıtlarını doğrula.
 * SAF: ağa çıkmaz, motoru çağırmaz. Sembol kapısı `_girdi.js`in TA KENDİSİ
 * (`temizleSembol` / `cozEndeks` / `PAZARLAR`) — yeni bir desen UYDURULMADI.
 * @returns {{kayitlar:object[]} | {hata:{http:number, govde:object}}}
 */
export function ayristirOlcumler(liste) {
  const hata = (http, govde) => ({ hata: { http, govde } });
  if (!Array.isArray(liste)) return hata(400, { error: 'olcumler_yok' });
  if (!liste.length) return hata(400, { error: 'olcumler_bos' });
  if (liste.length > AZAMI_OLCUM) {
    return hata(400, { error: 'cok_olcum', azami: AZAMI_OLCUM, istenen: liste.length });
  }

  const kayitlar = [];
  const gorulen = new Set();
  for (const o of liste) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return hata(400, { error: 'bad_olcum' });

    const ham = String(o.symbol ?? '').trim();
    if (!ham) return hata(400, { error: 'symbols_bos' });
    if (ham.length > AZAMI_SORGU) return hata(400, { error: 'too_long', azami: AZAMI_SORGU });
    const gPazar = String(o.market ?? '').trim().toUpperCase();
    if (gPazar && !PAZARLAR.includes(gPazar)) return hata(400, { error: 'bad_market', izinli: PAZARLAR });
    const hedef = cozEndeks(ham) || temizleSembol(ham, gPazar || 'US');
    if (!hedef) return hata(400, { error: 'bad_symbol', gecersiz: [ham.slice(0, 16)] });

    const kimlik = hedef.market + ':' + hedef.sym;
    if (gorulen.has(kimlik)) continue;   // yineleme TEKİLLEŞTİRİLİYOR (_girdi.js:ayristir kalıbı)
    gorulen.add(kimlik);

    // Motorun beklediği `m` kaydı. `ok` alanı istemciden GELDİĞİ GİBİ
    // taşınıyor: `scanScore` onu 'no-data' gerekçesine çeviriyor, yani
    // "veri gelmedi" ile "ölçüm kötü" ayrımı MOTORDA kalıyor.
    const m = { symbol: hedef.sym, ok: o.ok !== false };
    for (const k of OLCUM_SAYISAL) {
      // DİKKAT: `Number(null)` 0, `Number('')` 0 veriyor. Çıplak `Number()`
      // kullanılsa ÖLÇÜLMEMİŞ bir alan 0 olarak girerdi (ölçüldü: testte
      // yakalandı) — F/K'sı olmayan şirket "F/K = 0" ile en ucuz görünürdü.
      const ham = o[k];
      const v = (ham === null || ham === undefined || ham === '') ? NaN : Number(ham);
      m[k] = Number.isFinite(v) ? v : null;   // ÖLÇÜLMEMİŞ SAYI 0 DEĞİL, null
    }
    for (const k of OLCUM_METINSEL) {
      m[k] = o[k] == null ? null : String(o[k]).slice(0, 2048);
    }
    kayitlar.push({ sym: hedef.sym, market: hedef.market, m });
  }
  if (!kayitlar.length) return hata(400, { error: 'olcumler_bos' });
  return { kayitlar };
}

/** Sayısal sorgu alanı: yok/boş → null, sayı değil → undefined (hata). */
function sorguSayi(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// =====================================================================
//  /api/tarama  —  POST
// =====================================================================
//  SÖZLEŞME
//    POST /api/tarama      Content-Type: application/json
//    Gövde: {
//      preset: 'value' | 'growth' | 'quality'   (motorun SCAN_PRESETS anahtarı)
//      olcumler: [ { symbol, market?, ok?, trailingPE?, priceToBook?, … } ]
//                en çok AZAMI_OLCUM kayıt, en çok AZAMI_GOVDE_BAYT bayt
//    }
//    Cevap 200: { preset, sonuclar[], atlanan[], degerlendirilen, surum, ms, uyari }
//      sonuclar[] = { sym, market, skor, cls, present, olcutler:[{ad, cls}] }
//        `skor` HAM sayı (yuvarlanmamış — biçimlemek istemcinin işi).
//        `cls`  `scanTag`ın makine kodu (strong|good|weak). Metni ('💎 Belirgin
//               ucuz') TELE KONMADI — tavsiye dilidir.
//        olcutler[].cls = motorun ölçüt sınıfı; `ad` bir ölçüt adı ('F/K').
//      atlanan[] = { sym, market, neden }  neden = motorun `reason`ı
//        ('no-data' | 'neg-earnings'). SKOR UYDURULMUYOR; "ölçemedim" dürüstçe
//        ayrı listede duruyor — 0 yazmak zarar eden şirketi "ucuz" gösterirdi.
//    Cevap 4xx: { error: <makine kodu>, …, uyari }
//    Cevap 502: { error: 'tarama_hesaplanamadi', uyari }
//    AĞA ÇIKMAZ.
// =====================================================================
export async function taramaHandler(req, res) {
  if (kapi(req, res, 'POST, OPTIONS')) return;
  const body = govdeAl(req, res);
  if (!body) return;

  // Beyaz liste MOTORDAN okunuyor — uçta kopya anahtar listesi yok.
  // `scanTag` bilinmeyen presette PATLIYOR (ölçüldü: SCAN_PRESETS[preset].tags),
  // bu yüzden kapı burada ZORUNLU.
  const presetler = Object.keys(ENG.SCAN_PRESETS);
  const preset = String(body.preset ?? '').trim();
  if (!presetler.includes(preset)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_preset', izinli: presetler, uyari: UYARI });
    return;
  }

  const ay = ayristirOlcumler(body.olcumler);
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }

  const t0 = Date.now();
  try {
    const sonuclar = [];
    const atlanan = [];
    for (const k of ay.kayitlar) {
      const r = ENG.scanScore(preset, k.m);
      if (!r || !r.ok || r.score == null) {
        atlanan.push({ sym: k.sym, market: k.market, neden: (r && r.reason) || 'no-data' });
        continue;
      }
      const etiket = ENG.scanTag(preset, r.score);
      sonuclar.push({
        sym: k.sym,
        market: k.market,
        skor: r.score,
        cls: (etiket && etiket.cls) || null,
        present: r.present,
        olcutler: (r.crits || []).map((c) => ({ ad: c.label, cls: c.cls })),
      });
    }
    // Sıralama bir KARAR DEĞİL, motorun verdiği skorun azalan dizilişi.
    sonuclar.sort((a, b) => b.skor - a.skor);

    res.setHeader('Cache-Control', 'no-store');   // gövdeye bağlı, kullanıcıya özel
    res.status(200).json({
      preset,
      sonuclar,
      atlanan,
      degerlendirilen: ay.kayitlar.length,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/_kesif tarama:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'tarama_hesaplanamadi', uyari: UYARI });
  }
}

// =====================================================================
//  /api/sektor  —  POST
// =====================================================================
//  SÖZLEŞME
//    POST /api/sektor      Content-Type: application/json
//    Gövde: { olcumler: [ … /api/tarama ile AYNI kayıt ], sira?: kip }
//      sira ∈ SIRA_KIPLERI (cheap|growth|margin|count), varsayılan cheap
//    Cevap 200: { sira, gruplar[], degerlendirilen, siniflanan, surum, ms, uyari }
//      gruplar[] = { anahtar, n, medPe, medFpe, medGrowth, medMargin, medPeg,
//                    hisseler: [ { sym, market, basis, trailingPE, forwardPE,
//                                  revenueGrowth, profitMargin, peg } ] }
//      `anahtar` SEK_META anahtarı ('Technology' … '_other'). Emoji (`e`) ve
//      Türkçe ad (`n`) TELE KONMADI: istemcide zaten var.
//      `basis` sınıflandırmanın hangi kademeden geldiği —
//              sector|industry|fund|tag|biz|null (motorun `sekClassify`ı).
//
//    DÜRÜST AYRIM (app.js'in ekran gruplamasıyla fark):
//      · Motorun `sekBuildGroups`u DIŞA VERİLMEMİŞ (modül düzeyi `sekMem`
//        okuyor), bu yüzden kovalama burada yapılıyor — ama yalnız VERİ
//        TOPLAMA: anahtar `ENG.sekClassify`dan, medyan `ENG.sekMedian`dan
//        geliyor. Uçta eşik/formül yok.
//      · app.js `pe` için trailingPE yoksa forwardPE'ye DÜŞÜYOR. O yedek BİR
//        KARAR; uca kopyalanmadı. İki alan AYRI AYRI medyanlanıyor
//        (`medPe` / `medFpe`) — hangisini kullanacağını istemci bilir.
//      · app.js büyüme/marjı ×100 ile yüzdeye çeviriyor (EKRAN ölçeklemesi).
//        Burada HAM KESİR dönüyor (HAM SAYI kuralı). `sekSortGroups`un
//        sıralaması tek-yönlü ölçeklemeden ETKİLENMEZ.
//    AĞA ÇIKMAZ.
// =====================================================================
export async function sektorHandler(req, res) {
  if (kapi(req, res, 'POST, OPTIONS')) return;
  const body = govdeAl(req, res);
  if (!body) return;

  const sira = String(body.sira ?? VARSAYILAN_SIRA).trim();
  if (!SIRA_KIPLERI.includes(sira)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_sira', izinli: SIRA_KIPLERI, uyari: UYARI });
    return;
  }

  const ay = ayristirOlcumler(body.olcumler);
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }

  const t0 = Date.now();
  try {
    const kova = new Map();
    let siniflanan = 0;
    for (const k of ay.kayitlar) {
      if (k.m.ok === false) continue;       // veri gelmemiş kayıt gruba GİRMEZ
      const cl = ENG.sekClassify(k.m, { symbol: k.sym, market: k.market });
      siniflanan++;
      if (!kova.has(cl.key)) kova.set(cl.key, { anahtar: cl.key, hisseler: [] });
      kova.get(cl.key).hisseler.push({
        sym: k.sym,
        market: k.market,
        basis: cl.basis,
        trailingPE: k.m.trailingPE,
        forwardPE: k.m.forwardPE,
        revenueGrowth: k.m.revenueGrowth,
        profitMargin: k.m.profitMargin,
        peg: k.m.peg,
      });
    }

    // Medyanlar MOTORUN `sekMedian`ıyla — uçta sıralama/orta-nokta mantığı yok.
    const pozitif = (v) => (v != null && v > 0 ? v : null);
    const gruplar = [...kova.values()].map((g) => ({
      ...g,
      n: g.hisseler.length,
      medPe: ENG.sekMedian(g.hisseler.map((s) => pozitif(s.trailingPE))),
      medFpe: ENG.sekMedian(g.hisseler.map((s) => pozitif(s.forwardPE))),
      medGrowth: ENG.sekMedian(g.hisseler.map((s) => s.revenueGrowth)),
      medMargin: ENG.sekMedian(g.hisseler.map((s) => s.profitMargin)),
      medPeg: ENG.sekMedian(g.hisseler.map((s) => s.peg)),
    }));
    const sirali = ENG.sekSortGroups(gruplar, sira);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      sira,
      gruplar: sirali,
      degerlendirilen: ay.kayitlar.length,
      siniflanan,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/_kesif sektor:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'sektor_hesaplanamadi', uyari: UYARI });
  }
}

// =====================================================================
//  /api/radar  —  GET
// =====================================================================
//  SÖZLEŞME
//    GET /api/radar[?tema=<anahtar>][&sektor=<anahtar>]
//    Cevap 200: { temalar[], sektorler{}, semboller?, surum, ms, uyari }
//      temalar[] = { anahtar, etiket, dil, sorgu, etkiler: [[sektor,'up'|'down']] }
//        `sorgu` haber taramasının ARAMA METNİ — istemci onu /api/news ya da
//        /api/proxy üzerinden kullanıyor. `emoji` TELE KONMADI.
//      sektorler = SECTORS sözlüğü (anahtar → sektör adı); ad bir etikettir.
//      semboller = yalnız `sektor=` verildiğinde: SYMBOL_SECTORS'ta o etikete
//        sahip semboller. EVRENİ UÇ UYDURMUYOR — bu motorun sözlüğü;
//        KULLANICININ listesi `tarama`/`sektor`a GİRDİ olarak gelir.
//    Cevap 4xx: { error: 'bad_tema' | 'bad_sektor' | 'too_long', izinli[], uyari }
//    AĞA ÇIKMAZ — saf sözlük okuması.
// =====================================================================
export async function radarHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};
  const t0 = Date.now();

  const hamTema = String(q.tema ?? '').trim();
  const hamSektor = String(q.sektor ?? '').trim();
  if (hamTema.length > AZAMI_SORGU || hamSektor.length > AZAMI_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_SORGU, uyari: UYARI });
    return;
  }

  try {
    const temaAnahtarlari = ENG.RADAR_THEMES.map((t) => t.key);
    if (hamTema && !temaAnahtarlari.includes(hamTema)) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_tema', izinli: temaAnahtarlari, uyari: UYARI });
      return;
    }
    const sektorAnahtarlari = Object.keys(ENG.SECTORS);
    if (hamSektor && !sektorAnahtarlari.includes(hamSektor)) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_sektor', izinli: sektorAnahtarlari, uyari: UYARI });
      return;
    }

    const temalar = ENG.RADAR_THEMES
      .filter((t) => !hamTema || t.key === hamTema)
      .map((t) => ({
        anahtar: t.key,
        etiket: t.label,
        dil: t.lang,
        sorgu: t.q,
        etkiler: t.impacts,
      }));

    const govde = {
      temalar,
      sektorler: ENG.SECTORS,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    };
    if (hamSektor) {
      govde.semboller = Object.keys(ENG.SYMBOL_SECTORS)
        .filter((s) => (ENG.SYMBOL_SECTORS[s] || []).includes(hamSektor));
    }

    // Saf sözlük: içerik yalnız MOTOR İMZASI değişince değişiyor. İlan edilen
    // pencere api/chart.js'in TAM yoluyla aynı (300 sn) — yeni bir sayı yok.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json(govde);
  } catch (e) {
    console.error('api/_kesif radar:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'radar_alinamadi', uyari: UYARI });
  }
}

// =====================================================================
//  /api/backtest  —  GET   (bu beşlinin AĞA ÇIKAN TEK ucu)
// =====================================================================
//  SÖZLEŞME
//    GET /api/backtest?symbol=AAPL[&market=US|BIST]
//                      [&vade=kisa|orta|uzun|gunici][&range=…][&interval=…]
//      vade beyaz listesi MOTORDAN (`TA_HORIZON` anahtarları).
//      range/interval verilmezse `BT_CFG[vade].intraday` bayrağına göre
//      seçiliyor: gün içi → 1y/60m, gün sonu → 5y/1d.
//    Cevap 200: { sym, market, vade, range, interval, adet, sonuc, sayac,
//                 tam, surum, ms, uyari }
//      sonuc = motorun `computeBacktest` çıktısı, TEK DEĞİŞİKLİKLE:
//        `buckets[].label` DÜŞÜRÜLDÜ ('60–100 · güçlü AL' bir AL/SAT
//        metnidir); kovalar `i` SIRA NUMARASIYLA dönüyor. Geri kalan alanlar
//        BİREBİR ham sayı (ic, sharpe, mdd, stratRet, bhRet, winRate, …).
//      `sonuc` null OLABİLİR: motor seri kısaysa (warmup+H+40) ya da örnek
//      sayısı 12'nin altındaysa null döndürüyor. Bu ARIZA DEĞİL, dürüst
//      "ölçemedim" — 0 yazmak uydurma olurdu.
//      `sayac`/`tam` = ölçüm dürüstlüğü (api/chart.js ile aynı küme).
//    Cevap 4xx: { error: <makine kodu>, izinli?, uyari }
//    Cevap 502: { error: 'backtest_hesaplanamadi', uyari }
// =====================================================================
export async function backtestHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const ham = String(q.symbol ?? q.symbols ?? '').trim();
  if (!ham) { kisaOnbellek(res); res.status(400).json({ error: 'symbol_yok', uyari: UYARI }); return; }
  if (ham.length > AZAMI_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_SORGU, uyari: UYARI });
    return;
  }
  if (ham.includes(',')) {   // SESSİZ KIRPMA YOK (api/chart.js kalıbı)
    kisaOnbellek(res);
    res.status(400).json({ error: 'cok_sembol', azami: 1, uyari: UYARI });
    return;
  }
  const gPazar = String(q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: PAZARLAR, uyari: UYARI });
    return;
  }
  const hedef = cozEndeks(ham) || temizleSembol(ham, gPazar || 'US');
  if (!hedef) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_symbol', gecersiz: [ham.slice(0, 16)], uyari: UYARI });
    return;
  }

  const vadeler = Object.keys(ENG.TA_HORIZON);
  const vade = String(q.vade ?? 'orta').trim();
  if (!vadeler.includes(vade)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_vade', izinli: vadeler, uyari: UYARI });
    return;
  }

  const gunIci = !!(ENG.BT_CFG[vade] && ENG.BT_CFG[vade].intraday);
  const range = String(q.range ?? (gunIci ? VARSAYILAN_ARALIK_ICI : VARSAYILAN_ARALIK_GUN)).trim();
  if (!ARALIKLAR.includes(range)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_range', izinli: ARALIKLAR, uyari: UYARI });
    return;
  }
  const interval = String(q.interval ?? (gunIci ? VARSAYILAN_ADIM_ICI : VARSAYILAN_ADIM_GUN)).trim();
  if (!ADIMLAR.includes(interval)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_interval', izinli: ADIMLAR, uyari: UYARI });
    return;
  }

  const t0 = Date.now();

  // Önbellek anahtarı MOTOR İMZASINI taşıyor: motor yeniden üretildiği an eski
  // backtest sonuçları kendiliğinden geçersizleşiyor (api/chart.js kalıbı).
  const obAnahtar = anahtar(
    'backtest',
    { market: hedef.market, sym: hedef.sym, vade, range, interval },
    { motor: IMZA, ayar: IMZA_AYAR },
  );
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    AG.yeniTur();
    const sayac = bosSayac();
    AG.odakla(sayac);
    let seri = null;
    let hamSonuc = null;
    try {
      seri = await ENG.fetchYahooOHLC(hedef.sym, hedef.market, range, interval);
      const mum = (seri && seri.candles) || [];
      // TEK satır motor çağrısı — eşik, ufuk, kova sınırı HEPSİ motorda.
      hamSonuc = mum.length ? await ENG.computeBacktest(mum, vade) : null;
    } finally {
      AG.odakla(null);
    }

    const mumlar = (seri && seri.candles) || [];
    const tam = sayacTam(sayac);
    const sonuc = hamSonuc ? {
      ...hamSonuc,
      // Tavsiye dili TELE KONMUYOR: kova ADI yerine SIRA NUMARASI.
      buckets: (hamSonuc.buckets || []).map((b, i) => ({ i, n: b.n, avg: b.avg, pos: b.pos })),
    } : null;

    if (tam && sonuc) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    } else {
      kisaOnbellek(res);
    }

    const govde = {
      sym: hedef.sym,
      market: hedef.market,
      vade,
      range,
      interval,
      adet: mumlar.length,
      sonuc,
      sayac,
      tam,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    };
    // Yalnız TAM ve DOLU gövde önbellekleniyor — kesintiyi 5 dk dondurmak yok.
    if (tam && sonuc) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.status(200).json(govde);
  } catch (e) {
    console.error('api/_kesif backtest:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'backtest_hesaplanamadi', uyari: UYARI });
  }
}

// =====================================================================
//  /api/deger  —  GET (metal makro) · POST (kripto)
// =====================================================================
//  SÖZLEŞME — METAL (GET)
//    GET /api/deger?tur=gram-altin|gumus|platin
//        [&dxyChg=][&tnxChg=][&vix=][&gsr=][&pgr=][&cuChg=][&ownM=][&ownH=]
//      `tur` beyaz listesi MOTORDAN (`METAL_MACRO_W` anahtarları). KAPI
//      ZORUNLU: `computeMetalMacro` bilinmeyen anahtarda SESSİZCE genel bir
//      ağırlık kümesine düşüyor (ölçüldü) — yani kapı olmasa uç ölçmediği bir
//      sayıyı ölçmüş gibi verirdi.
//      Ölçüler İSTEMCİDEN geliyor: motorun `metalMacroInputs`u DIŞA
//      VERİLMEMİŞ ve `api/_ag.js`in IZINLI listesi yalnız Yahoo/SEC/İş
//      Yatırım'ı taşıyor. Uç bu ölçümleri KENDİ ÇEKEMEZ; istemci /api/chart
//      ve /api/proxy ile zaten çekiyor. Verilmeyen ölçüm null geçiyor, motor
//      onu nötr alıp çekincesine yazıyor — uç 0 UYDURMUYOR.
//
//  SÖZLEŞME — KRİPTO (POST)
//    POST /api/deger   { tur: 'kripto', belge: <CoinGecko /coins/{id} belgesi> }
//      Belgeyi İSTEMCİ veriyor (api/causal.js'in (b) gerekçesi): motorun
//      `cryptoDetail`i DIŞA VERİLMEMİŞ ve `api.coingecko.com` `_ag.js`in
//      IZINLI listesinde YOK — motor o adrese çıkamaz. İstemci belgeyi
//      /api/proxy üzerinden alıyor (konak proxy'nin izin listesinde VAR).
//
//  Cevap 200 (ikisi de): { tur, skor, cls, kategori?, bilesenler[],
//                          uyariAdet, surum, ms, uyari }
//    bilesenler[] = { ad, skor, w }  — `note` METNİ DÜŞÜRÜLDÜ.
//    `cls` = `scoreBand`ın makine kodu; `band.label` ('Elverişli rejim')
//    ve `catLabel` TELE KONMADI.
//    `uyariAdet` = motorun `warnings` SAYISI. Metinler tavsiye dili taşıyor,
//    bu yüzden geçmiyor; sayısı yine de dürüstlük bilgisi — kaç çekince var,
//    istemci biliyor.
//  Cevap 4xx: { error: 'bad_tur' | 'bad_olcum' | 'belge_yok' | …, uyari }
//  Cevap 502: { error: 'deger_hesaplanamadi', uyari }
//  AĞA ÇIKMAZ.
// =====================================================================
export async function degerHandler(req, res) {
  if (kapi(req, res, 'GET, POST, OPTIONS')) return;

  const metaller = Object.keys(ENG.METAL_MACRO_W);
  const t0 = Date.now();

  const bitir = (tur, r, kategori) => {
    res.setHeader('Cache-Control', 'no-store');   // girdiye bağlı, kullanıcıya özel
    res.status(200).json({
      tur,
      skor: r.score,
      cls: (r.band && r.band.cls) || null,
      ...(kategori ? { kategori } : {}),
      bilesenler: (r.comps || []).map((c) => ({ ad: c.label, skor: c.score, w: c.w })),
      uyariAdet: (r.warnings || []).length,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  };

  if (req.method === 'POST') {
    const body = govdeAl(req, res);
    if (!body) return;
    const tur = String(body.tur ?? '').trim();
    if (tur !== 'kripto') {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_tur', izinli: ['kripto'], not: 'metal icin GET', uyari: UYARI });
      return;
    }
    const belge = body.belge;
    if (!belge || typeof belge !== 'object' || Array.isArray(belge)) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'belge_yok', uyari: UYARI });
      return;
    }
    try {
      const r = ENG.computeCryptoValue(belge);
      bitir('kripto', r, r && r.category);
    } catch (e) {
      console.error('api/_kesif deger kripto:', (e && e.stack) || e);
      kisaOnbellek(res);
      res.status(502).json({ error: 'deger_hesaplanamadi', uyari: UYARI });
    }
    return;
  }

  // --- GET: metal makro ----------------------------------------------
  const q = req.query || {};
  const tur = String(q.tur ?? '').trim();
  if (!metaller.includes(tur)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_tur', izinli: [...metaller, 'kripto'], uyari: UYARI });
    return;
  }

  const alanlar = ['dxyChg', 'tnxChg', 'vix', 'gsr', 'pgr', 'cuChg', 'ownM', 'ownH'];
  const d = {};
  for (const a of alanlar) {
    const v = sorguSayi(q[a]);
    if (v === undefined) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_olcum', alan: a, uyari: UYARI });
      return;
    }
    d[a] = v;   // verilmeyen ölçüm null — motor nötr alıyor, uç 0 yazmıyor
  }

  try {
    const r = ENG.computeMetalMacro(tur, d);
    bitir(tur, r, null);
  } catch (e) {
    console.error('api/_kesif deger metal:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'deger_hesaplanamadi', uyari: UYARI });
  }
}

// =====================================================================
//  /api/arama  —  GET
// =====================================================================
//  NİYE VAR — ÖLÇÜLDÜ (2026-10-28)
//    `api/_girdi.js:161` çıplak bir terimde pazarı SESSİZCE 'US' VARSAYIYOR:
//    `ASELS` → {sym:'ASELS', market:'US'} → scoreFaUS → skor null,
//    why='secFetchModel null'. BIST bacağına ancak `ASELS.IS` / `ASELS:BIST`
//    / `&market=BIST` ulaşıyor. O sözleşme analyze.js:302, score.js:257 ve
//    recommend.js:253 tarafından PAYLAŞILIYOR, bu yüzden DEĞİŞTİRİLMEDİ —
//    bu uç varsayımın YERİNE geçen dürüst yolu veriyor: pazarı tahmin etmek
//    yerine ÇOK PAZARLI ADAY LİSTESİ döndürüyor, seçimi istemciye bırakıyor.
//
//  SÖZLEŞME
//    GET /api/arama?q=<terim>[&limit=N]      (N tamsayı, 1..ARAMA_AZAMI)
//    Cevap 200: { q, limit, adaylar[], adet, sayac, tam, surum, ms, uyari }
//      adaylar[] = { sembol, ad, borsa, tur, sektor,
//                    pazar, motorSembol, motorPazar, motorUc }
//        sembol      · Yahoo'nun HAM sembolü ('ASELS.IS', 'AAPL', 'BTC-USD')
//        ad          · shortname ?? longname ?? null  (ölçülmezse null)
//        borsa       · Yahoo'nun HAM borsa kodu ('IST','NMS','NYQ','CCC',…)
//        tur         · Yahoo'nun HAM quoteType'ı ('EQUITY','ETF','FUTURE',…)
//        pazar       · 'BIST' | 'US' | 'KRIPTO' | null  — ÖLÇÜLMÜŞ kod
//                      kümelerinden türetilen MAKİNE KODU, metin DEĞİL.
//        motorSembol · motorun KABUL ETTİĞİ biçim (null = bu motorla ölçülemez)
//      HAM KOD KURALI: bu uç 'S&P 500' / 'Kripto' gibi EKRAN METNİ ÜRETMEZ;
//      etiketi istemci yazar. ÖZELLİKLE ENDEKS ÜYELİĞİ İDDİA EDİLMİYOR:
//      Yahoo arama kaydında endeks üyeliği alanı YOK (ölçüldü) — 'NYQ' bir
//      BORSA kodudur, 'S&P 500 üyesi' demek UYDURMA olurdu.
//    Cevap 4xx: { error: 'q_yok' | 'too_long' | 'bad_limit' | …, uyari }
//    Cevap 502: { error: 'arama_yapilamadi', uyari }
//
//  DÜRÜSTLÜK: aday bulunamaması HATA DEĞİL → { adaylar: [], tam: true }.
//  Taşıma kesintisinde `tam: false` (sayac.yahoo.kesinti > 0) — "ölçtüm,
//  yok" ile "ölçemedim" ayrı duruyor. Boş liste 0 ile doldurulmuyor.
// =====================================================================

// Aday tavanı. UYDURULMADI: Yahoo arama ucunun `quotesCount`u bu sayıyla
// BİREBİR geçiyor; 25, ölçülen en kalabalık sorguda (apple) dönen kayıt
// sayısının üstünde kalıyor, yani kullanıcı kırpılmayı görmüyor.
export const ARAMA_AZAMI = 25;
export const ARAMA_VARSAYILAN = 10;

// Yahoo arama ucu. Konak `api/_ag.js`in IZINLI listesinde ZATEN VAR
// (query1.finance.yahoo.com) — izin listesine dokunulmadı.
export const ARAMA_URL = 'https://query1.finance.yahoo.com/v1/finance/search';

// HAM borsa kodu → pazar kodu. Liste ÖLÇÜLDÜ (2026-10-28, on üç sorgu):
//   IST → BIST · NYQ NMS NAS NGM PCX BTS OQX PNK → US · CCC → kripto.
// Ölçülmeyen kod (TOR, MEX, GER, FRA, VIE, LSE, BUE, CME, NEO, VAN, PAR,
// HAM …) `pazar: null` alıyor: TAHMİN EDİLMİYOR. Kümeye kod eklemek bir
// ölçüm işidir, kolaylık işi değil.
export const BORSA_BIST = Object.freeze(['IST']);
export const BORSA_US = Object.freeze(['NYQ', 'NMS', 'NAS', 'NGM', 'PCX', 'BTS', 'OQX', 'PNK']);
export const TUR_KRIPTO = 'CRYPTOCURRENCY';

function aramaPazar(borsa, tur) {
  if (tur === TUR_KRIPTO) return 'KRIPTO';
  if (BORSA_BIST.includes(borsa)) return 'BIST';
  if (BORSA_US.includes(borsa)) return 'US';
  return null;
}

/**
 * Tek Yahoo arama kaydı → aday. Motor biçimi TAHMİN EDİLMİYOR, `_girdi.js`in
 * KENDİ kapısına sorularak bulunuyor: `cozEndeks` (kapalı endeks sözlüğü,
 * yalnız /api/chart kabul ediyor) ve `temizleSembol`. ÖLÇÜM: PAZARLAR =
 * ['US','BIST'] — motorda KRİPTO PAZARI YOK, bu yüzden kripto adayının
 * `motorSembol`ü null. BIST'te motorun kabul ettiği biçim `<SYM>.IS`
 * (`temizleSembol` '.IS' sonekini BIST'e çeviriyor; `<SYM>:BIST` de geçer).
 */
function aramaAday(k) {
  const kayit = k && typeof k === 'object' ? k : {};
  const sembol = typeof kayit.symbol === 'string' ? kayit.symbol.trim() : '';
  if (!sembol) return null;
  const metin = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const borsa = metin(kayit.exchange);
  const tur = metin(kayit.quoteType);
  const pazar = aramaPazar(borsa, tur);

  let motorSembol = null;
  let motorPazar = null;
  let motorUc = null;
  const endeks = cozEndeks(sembol);
  if (endeks) {
    motorSembol = endeks.sym;
    motorPazar = endeks.market;
    motorUc = 'chart';          // endeks sözlüğünü YALNIZ /api/chart okuyor
  } else if (pazar === 'BIST' || pazar === 'US') {
    const c = temizleSembol(sembol, pazar);
    if (c && c.market === pazar) {
      motorSembol = pazar === 'BIST' ? c.sym + '.IS' : c.sym;
      motorPazar = c.market;
      motorUc = 'analyze';
    }
  }

  return {
    sembol,
    ad: metin(kayit.shortname) || metin(kayit.longname),
    borsa,
    tur,
    sektor: metin(kayit.sector),
    pazar,
    motorSembol,
    motorPazar,
    motorUc,
  };
}

export async function aramaHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;
  const q = req.query || {};

  const ham = String(q.q ?? '').trim();
  if (!ham) { kisaOnbellek(res); res.status(400).json({ error: 'q_yok', uyari: UYARI }); return; }
  if (ham.length > AZAMI_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_SORGU, uyari: UYARI });
    return;
  }
  // SESSİZ VARSAYILAN YOK: `limit` verilmemişse ARAMA_VARSAYILAN, verilmiş
  // ama tamsayı/aralık dışıysa 400. Kırpma da yok.
  const nLimit = sorguSayi(q.limit);
  const limitKotu = nLimit === undefined
    || (nLimit !== null && (!Number.isInteger(nLimit) || nLimit < 1 || nLimit > ARAMA_AZAMI));
  if (limitKotu) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_limit', asgari: 1, azami: ARAMA_AZAMI, uyari: UYARI });
    return;
  }
  const limit = nLimit === null ? ARAMA_VARSAYILAN : nLimit;

  const t0 = Date.now();
  const obAnahtar = anahtar(
    'arama',
    { q: ham.toLowerCase(), limit },
    { motor: IMZA, ayar: IMZA_AYAR },
  );
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  try {
    AG.yeniTur();
    const sayac = bosSayac();
    AG.odakla(sayac);
    let kayitlar = null;    // null = OKUNAMADI (tam:false), [] = ÖLÇTÜM, YOK
    try {
      const url = ARAMA_URL
        + '?q=' + encodeURIComponent(ham)
        + '&quotesCount=' + limit
        + '&newsCount=0&enableFuzzyQuery=false';
      // Ağ MOTORUN taşıyıcısında: `AG.H.fetch` = `api/_ag.js`in agFetch'i
      // (izin listesi + tur başı tekilleştirme + süre tavanı + sayaç).
      // Motorun bir ARAMA DİLİMİ YOK (ölçüldü: api/_motor.js içinde
      // 'finance/search' geçmiyor), bu yüzden adres burada kuruluyor.
      const r = await AG.H.fetch(url);
      if (r && r.ok) {
        const belge = await r.json();
        kayitlar = Array.isArray(belge && belge.quotes) ? belge.quotes : [];
      }
    } finally {
      AG.odakla(null);
    }

    const tam = sayacTam(sayac) && kayitlar !== null;
    const adaylar = (kayitlar || []).map(aramaAday).filter(Boolean).slice(0, limit);

    if (tam) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    } else {
      kisaOnbellek(res);
    }

    const govde = {
      q: ham,
      limit,
      adaylar,
      adet: adaylar.length,
      sayac,
      tam,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    };
    // Yalnız TAM gövde önbellekleniyor; kesintiyi 5 dk dondurmak yok.
    if (tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.status(200).json(govde);
  } catch (e) {
    console.error('api/_kesif arama:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'arama_yapilamadi', uyari: UYARI });
  }
}

// ---------------------------------------------------------------------
//  ROTA → HANDLER. `api/proxy.js` bu tabloyu okuyor; orada altı `if`
//  yazılsaydı rota adı üç yerde değil dört yerde elle yazılmış olurdu.
// ---------------------------------------------------------------------
export const HANDLERLAR = Object.freeze({
  tarama: taramaHandler,
  sektor: sektorHandler,
  radar: radarHandler,
  backtest: backtestHandler,
  deger: degerHandler,
  arama: aramaHandler,
});
