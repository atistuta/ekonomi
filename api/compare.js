// ===========================================================================
//  /api/compare — ÇOK SEMBOLLÜ KIYAS uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: /api/analyze'ın döndürdüğü her şey (TA + FA + bileşke + plan +
//  bütüncül okuma) ve ÜSTÜNE SEMBOLLER ARASI tek alan: `sira`. Zincir
//  İÇ İÇE devam ediyor:
//
//      /api/score ⊂ /api/recommend ⊂ /api/analyze ⊂ /api/compare
//
//  Alan adları ve sıraları korunuyor, bu uç da TEK bir alan ekliyor
//  (`sira`). /api/score için yazılmış istemci çözücüsü dört uçta da çalışır.
//
//  GÖÇ GEREKMEDİ — ÖNCE ÖLÇÜLDÜ, SONRA YAZILDI (2026-10-18). Karşılaştır
//  ekranının sayısal çekirdeği zaten motordaydı; yazmadan önce üç yer
//  okundu:
//    api/_motor.js  buyZoneProximity (state + dAtr) · planRiskReward
//                   (rrRatio) · computeHolisticScore (skor10) — ÜÇÜ DE
//                   MOTORDA.
//    api/_akis.js   analyzeOne → plan.yakinlik · plan.riskOdul ·
//                   analiz.butunculluk — üçü de ZATEN TELE ÇIKIYOR.
//    app.js:12615   "🥇 Alım sırası (şu an)" — ekrandaki sıralama.
//  Sonuç: app.js'e DOKUNULMADI, bu uç için motor YENİDEN ÜRETİLMEDİ,
//  skorun DEĞERİ kılını kıpırdatmadı. (Aynı adımda /api/causal için motor
//  yeniden üretildi; bu ucun kullandığı hiçbir sayı o dilimden gelmiyor.)
//
//  SIRALAMA EKRANDAN BİREBİR ALINDI — YENİ EŞİK UYDURULMADI. app.js:12626
//  üç satırlık karşılaştırıcıyı taşıyor:
//    ① anahtar = fiyatın bandın TAVANI üstünde kaç ORTALAMA GÜNLÜK HAREKET
//       (dAtr) olduğu; bandın içinde/altında olan 0 sayılır → "şu an
//       alınabilir" grubu en üstte.
//    ② eşitlik Bütüncül/Temel Uygunluk skoruyla (skor10, yüksek önce).
//  Yüzde (aboveGap) BİLEREK kullanılmıyor: yüzde hisseler arası
//  kıyaslanabilir değil (aynı %2,7 oynak hissede ~1 gün, sakin hissede
//  ~3-4 gün). Gerekçe app.js:12615-12624'te uzun uzun yazılı, buraya
//  kopyalanmıyor.
//
//  dAtr'yi BU UÇ HESAPLAMIYOR: motorun buyZoneProximity'si üretiyor
//  (_motor.js) ve _akis.js `plan.yakinlik` olarak geçiriyor. Ekrandaki
//  kopya `v.dAtr || 0` ile bandın altını 0'a kırpıyordu; motorun dAtr'si
//  bandın altında NEGATİF oluyor, bu yüzden kırpma `state`e bakılarak
//  AÇIKÇA yapılıyor (aşağıda `siraAnahtari`). İkisi aynı sırayı üretir —
//  ikisi de "bandın içinde/altında = 0" diyor.
//
//  NE DEĞİL: bu bir TAVSİYE SIRASI DEĞİL, yalnız FİYAT-UZAKLIK kıyasıdır.
//  "En üstteki al" demez; "şu an hangisi alım aralığına en yakın" der.
//  Düşük fiyat düşen bıçak da olabilir. Bilgi amaçlıdır.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): cevapta biçimlenmiş tek
//  alan yok — Intl/toFixed/yüzde/para simgesi geçmiyor. `sira`nın taşıdığı
//  tek metin SABİT KÜME: `durum` ∈ in|below|near|far (motorun
//  buyZoneProximity `state`i). Madalya (🥇/🥈/🥉), "✓ Alım bandında" gibi
//  cümleler ve tr-TR biçimlemesi İSTEMCİDE kalıyor.
//
//  EN AZ İKİ SEMBOL: tek sembollü bir "kıyas" sessizce anlamsız bir cevap
//  döndürürdü (tek elemanlı sıra = her zaman 1.). `az_sembol` ile AÇIKÇA
//  reddediliyor — istemci /api/analyze'a yönelsin.
//
//  BEŞ PARÇA, ALTINCI TAŞIYICI YOK: _motor · _ayar · _ag · _akis · _girdi.
//  Burada eşik, ağırlık ya da çarpan YOK.
//
//  SÖZLEŞME
//    GET /api/compare?symbols=AAPL,MSFT,THYAO.IS&vade=orta[&market=US]
//      Sorgu ayrıştırma öteki üç uçla BİREBİR aynı (`_girdi.js ayristir`).
//    Cevap 200: { vade, istenen, sonuclar[], sira[], siralanamayan[],
//                 atlanan[], sayac, tam, surum, ms, uyari }
//      sonuclar[i] = /api/analyze kaydının AYNISI (alan adları korunur).
//      sira[]      = sıralanabilen semboller, 1'den başlayarak:
//        { sym, market, sira, durum, dAtr, skor10, rrRatio }
//        durum   in|below|near|far   (SABİT KÜME, motordan)
//        dAtr    HAM sayı — sıralama anahtarı (0 = banda girmiş/altında)
//        skor10  bütüncül skor, eşitlik bozucu (null olabilir)
//        rrRatio risk/ödül oranı — BİLGİ, sıralamaya GİRMEZ
//      `sira` sonuclar'ı YENİDEN YAZMAZ, yalnız SIRALAR: aynı sembol iki
//      yerde de tam kaydıyla okunabilir.
//      siralanamayan[] = alım bandı ya da fiyatı olmayan semboller
//                        (plan yok / vade 'gunici'): sessizce düşürülmez.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'kiyas_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { analyzeOne } from './_akis.js';

// DİKKAT — `export { ... } from` YETMEZ: yerel bağlama yaratmaz, handler
// `ayristir`i çağırıyor. (Gerekçe: api/analyze.js:190.)
import { AZAMI_SEMBOL, ayristir } from './_girdi.js';
export { AZAMI_SEMBOL, ayristir };

// ÖNBELLEK — altı ucun PAYLAŞTIĞI taşıyıcı; bu dosyada kopya mantık YOK.
// TTL gerekçesi ve uç başına ÖLÇÜLEN dış istek sayıları orada yazılı.
import { anahtar, skorGirdisi, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// En az iki sembol: tek sembollü kıyas yok (başlıktaki gerekçe).
export const ASGARI_SEMBOL = 2;

// maxDuration 60 · /api/analyze ile AYNI KADEME ve aynı gerekçe: bu uç
// analyzeOne'ı sembol başına BİR KEZ çağırıyor, üstüne SIFIR ağ isteği
// ekliyor (sıralama saf hesap, elde olan sayılardan). Yani süre profili
// /api/analyze'ın profilidir; ayrı bir sayı uydurmak ölçüme dayanmazdı.
// 8 sembol ≈ 59 sn → süre freni (_ag.js TUR_BUTCE_MS 45 sn) gerçekten
// devreye girer ve başlamış sembolün bitmesi için 60 sn gerekir.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// ---------------------------------------------------------------------
//  Sıralama anahtarı — app.js:12626'nın aynısı, tek fark kırpmanın AÇIK
//  yazılması. Ekranda `v.dAtr || 0` vardı çünkü oradaki dAtr zaten bandın
//  üstünde değilse 0 kuruluyordu; motorun dAtr'si bandın altında negatif,
//  o yüzden `state`e bakıp 0'a çekiyoruz. Sonuç sıra AYNI.
// ---------------------------------------------------------------------
export function siraAnahtari(yakinlik) {
  if (!yakinlik || yakinlik.dAtr == null) return null;
  if (yakinlik.state === 'in' || yakinlik.state === 'below') return 0;
  return yakinlik.dAtr > 0 ? yakinlik.dAtr : 0;
}

/**
 * Sembolleri "şu an alım bandına uzaklık"a göre sırala. SAF: ağa çıkmaz,
 * motora dokunmaz, yeni sayı üretmez — yalnız elde olan motor sayılarını
 * okur. Bu yüzden dışa aktarılıyor: tests/uc-test.mjs fikstürle ölçebiliyor.
 * @returns {{sira: object[], siralanamayan: string[]}}
 */
export function siralaKiyas(sonuclar) {
  const aday = [];
  const siralanamayan = [];
  for (const k of (sonuclar || [])) {
    const anahtar = siraAnahtari(k && k.plan && k.plan.yakinlik);
    if (anahtar == null) { siralanamayan.push(k && k.sym); continue; }
    const b = (k.analiz && k.analiz.butunculluk) || null;
    aday.push({
      sym: k.sym,
      market: k.market,
      sira: 0, // aşağıda doldurulur
      durum: k.plan.yakinlik.state,
      dAtr: anahtar,
      skor10: (b && b.skor10 != null) ? b.skor10 : null,
      rrRatio: (k.plan.riskOdul && k.plan.riskOdul.rrRatio != null) ? k.plan.riskOdul.rrRatio : null,
    });
  }
  aday.sort((a, b) => {
    if (Math.abs(a.dAtr - b.dAtr) > 1e-9) return a.dAtr - b.dAtr;
    const sa = a.skor10 != null ? a.skor10 : -1;
    const sb = b.skor10 != null ? b.skor10 : -1;
    return sb - sa;
  });
  aday.forEach((x, i) => { x.sira = i + 1; });
  return { sira: aday, siralanamayan };
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/score.js).
//  Bu uç kendi lambda'sı, yani kendi motoru ve kendi SEC önbelleği.
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }

  if (KURULUM_HATASI || !AG || !ENG) {
    console.error('api/compare: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
    kisaOnbellek(res);
    res.status(503).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return;
  }

  const ay = ayristir(req.query || {});
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }
  // Tek sembolle kıyas yok — sessiz anlamsız cevap yerine açık ret.
  if (ay.rows.length < ASGARI_SEMBOL) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'az_sembol', asgari: ASGARI_SEMBOL, istenen: ay.rows.length, uyari: UYARI });
    return;
  }

  const t0 = Date.now();

  // --- ÖNBELLEK OKUMASI (api/_onbellek.js) ---------------------------
  //  İsabet = ÖLÇÜLEN 65 dış isteğin (AAPL+MSFT; sembol başına 32 + tur başına 1) yerine TEK KV okuması.
  //  Anahtar MOTOR İMZASINI taşıyor: `node tools/motor-uret.mjs` motoru
  //  değiştirdiği an eski girdiler kendiliğinden geçersizleşir, eski skor
  //  yeni motorla KARIŞAMAZ.
  //  KV yoksa / arızalıysa / yavaşsa `oku()` null döner ve buradan AŞAĞI
  //  önbelleksiz yola devam ederiz — istek ASLA düşmez.
  const obAnahtar = anahtar('compare', skorGirdisi(ay), { motor: IMZA, ayar: IMZA_AYAR });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    // YALNIZ `tam:true` gövde yazıldığı için isabette pencere de TAM yol
    // ile aynı — yeni bir eskilik penceresi icat edilmiyor.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    // Gövde OLDUĞU GİBİ servis ediliyor: skorun DEĞERİ değişmez. Yalnız
    // `ms` yeniden ölçülüyor — o alan İSTEĞİN süresi, skorun parçası değil.
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');
  try {
    AG.yeniTur();
    const sonuclar = [];
    const atlanan = [];
    try {
      for (const row of ay.rows) {
        if (AG.butceDoldu()) { atlanan.push(row.sym); continue; }
        const sayac = bosSayac();
        AG.odakla(sayac);
        let kayit;
        try {
          kayit = await analyzeOne(ENG, row, ay.vade, {
            getMali: (s) => ENG.fetchIsYatirimMali(s),
          });
        } catch (e) {
          console.error('api/compare: sembol hatasi', row.market, row.sym, '—', (e && e.message) || e);
          kayit = {
            sym: row.sym,
            market: row.market,
            ta: { score: null, why: 'hesaplanamadi' },
            fa: { score: null, why: 'hesaplanamadi', price: null },
            composite: { band: null, why: 'eksik skor' },
            plan: null,
            analiz: null,
          };
        }
        sonuclar.push({ ...kayit, sayac, tam: sayacTam(sayac) });
      }
    } finally {
      AG.odakla(null);
    }

    // Sıralama SAF: ağ isteği yok, motor çağrısı yok — yukarıda inmiş
    // sayıların okunması. Süre freninden SONRA koşuyor: atlanan semboller
    // sıraya hiç girmiyor, uydurulmuş bir yer almıyorlar.
    const { sira, siralanamayan } = siralaKiyas(sonuclar);

    const genel = AG.genel;
    const tam = sayacTam(genel) && atlanan.length === 0;

    if (tam) res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    else kisaOnbellek(res);

    const govde = {
      vade: ay.vade,
      istenen: ay.rows.length,
      sonuclar,
      sira,
      siralanamayan,
      atlanan,
      sayac: genel,
      tam,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    };

    // Yalnız TAM cevap önbellekleniyor: `tam:false` "ölçemedim" demek ve
    // uç o hâlde pencereyi zaten max-age=30'a düşürüyor. Bir kesintiyi
    // 5 dakika dondurmak, kesinti geçtikten sonra da eski cevabı servis
    // etmek olurdu. Yazma arızası cevabı DÜŞÜRMEZ (`yaz()` false döner).
    if (tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.status(200).json(govde);
  } catch (e) {
    console.error('api/compare:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'kiyas_hesaplanamadi', uyari: UYARI });
  }
}
