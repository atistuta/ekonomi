// ===========================================================================
//  /api/analyze — HAM bütüncül analiz uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: /api/recommend'in döndürdüğü her şey (TA skoru + FA skoru + bileşke +
//  plan) ve ÜSTÜNE kullanıcının "Analiz" ekranlarında gördüğü BÜTÜNCÜL
//  OKUMA — temel karar rozeti + üç direğe (temel · teknik · değerleme)
//  dayanan 0-10 bütüncül skor. Zincir İÇ İÇE:
//
//      /api/score  ⊂  /api/recommend  ⊂  /api/analyze
//
//  Alan adları ve SIRALARI korunuyor, her uç tek bir alan ekliyor
//  (`plan`, sonra `analiz`). Böylece /api/score için yazılmış istemci
//  çözücüsü üç uçta da çalışıyor.
//
//  GÖÇ GEREKMEDİ — ÖNCE ÖLÇÜLDÜ, SONRA YAZILDI (FAZ 1/5-E). Bu adımın en
//  pahalı hatası gereksiz bir göç olurdu. Yazmadan önce üç yer okundu:
//    api/_motor.js:1661  dışa aktarım listesi — `faVerdict`,
//                        `computeHolisticScore`, `COMPOSITE_MATRIX`,
//                        `COMPOSITE_BLEND`, `compositeBlend`, `faBand`,
//                        `taBand` ZATEN MOTORDA.
//    app.js:5432         fillResultPlan  (Sonuç / Yatırım Planı ekranı)
//    app.js:12177        compareVerdict  (Karşılaştır ekranı)
//  İki ekran tüketicisinin ikisi de yalnız bu motor işlevlerini çağırıyor;
//  ekranda kalan tek şey CÜMLE. Sonuç: app.js'e ve config.js'e DOKUNULMADI,
//  tools/motor-uret.mjs yeniden KOŞMADI, motor imzası DEĞİŞMEDİ. Parite
//  FARK 0 bunun kanıtı — skor değeri bu adımda kılını kıpırdatmadı.
//
//  NOT: index.html'de "Analiz" tek bir sekme DEĞİL, bir sekme GRUBU
//  (index.html:93 — Karşılaştır · Tez · Teknik · Temel · Bilanço ·
//  Temettü). Bu uç o grubun TAMAMINI karşılamıyor; grubun ortak
//  omurgasını — bileşke konumlama + bütüncül skor — karşılıyor. Tez,
//  Bilanço ve Temettü ayrı veri ayaklarına bağlı ve bu adımın dışında.
//
//  DÖRT PARÇA, BEŞİNCİ TAŞIYICI YOK:
//      api/_motor.js  buildMotor(H)                 motorun kendisi
//      api/_ayar.js   TA_WEIGHTS · TA_BENCHMARK     el ağırlıkları
//      api/_ag.js     canliAg()                     canlı ağ + konak + sayaç
//      api/_akis.js   analyzeOne()                  çağrı sırası
//  Burada eşik, ağırlık ya da çarpan YOK: üç direğin ağırlıkları
//  (0.40/0.30/0.30), bant eşikleri ve büyüme eğimi motorda yazılı. Bir sayı
//  buraya yazılırsa parite testi onu GÖRMEZ (baseline.json yalnız akışı
//  bekçiliyor) ve sunucu ile ekran sessizce ayrışır.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): cevapta `Intl` ile
//  biçimlenmiş TEK alan yok. Bütüncül katman bu kuralın en kırılgan yeri,
//  çünkü motorun döndürdüğü üç alan SERBEST TÜRKÇE CÜMLE taşıyor ve üçü de
//  tele konmadan SÖKÜLDÜ (gerekçeleri _akis.js `analizKatmani`nda):
//      parts[].note                serbest cümle + Math.round + yüzde
//      growthNote.txt              serbest cümle + peg.toFixed(2)
//      COMPOSITE_MATRIX[...].txt   serbest cümle + <b>/<i> HTML
//  Cevapta geçen metinler yalnız SABİT KÜME etiketleri: `faKarar.label`
//  (6 değer), `band.l` (5 değer), `band.c` (bull|neutral|bear),
//  `direkler[].k` (3 değer), `buyumeCls` (good|mid|bad|thm|na).
//
//  `thematic` BİLEREK DÖNMÜYOR: motor onu ancak Yahoo quoteSummary
//  metrikleri elimizdeyse hesaplayabiliyor, bu uç o ayağa sahip değil, ve
//  sabit bir `false` "tematik değil" diye okunur — oysa gerçek
//  "bilmiyorum". §5.4'ün `yok`/`kesinti` ayrımının aynısı.
//
//  KAPI /api/score VE /api/recommend İLE BİREBİR AYNI — ve bu ÜÇÜNCÜ
//  KOPYADIR. Sınırlar, `SEMBOL_BICIM`, `ayristir()`, `temizleSembol()` ve
//  modül düzeyi kurulum üç dosyada aynı metin. api/recommend.js:37 "üçüncü
//  bir uç aynı kapıya ihtiyaç duyduğu gün kopya değil TAŞIYICI doğru cevap
//  olur" diye yazıyordu; o gün geldi. Beşinci taşıyıcıyı (api/_girdi.js)
//  açmak İKİ YAYINDA OLAN ucu değiştirmek demek, bu adımın kapsamı değil
//  ve kullanıcının kararı — bu yüzden kopya sürdürüldü ve
//  tests/uc-test.mjs ⑤e kilidi ÜÇ YOLLU karşılaştırmaya çıkarıldı.
//  BORÇ KAYDEDİLDİ, atlanmadı.
//
//  KONAK NEDEN MODÜL DÜZEYİNDE: /api/score'daki gerekçenin aynısı — motor
//  kapanışı secCikMap ve secModelCache önbelleklerini taşıyor. DİKKAT: bu
//  uç kendi lambda'sı olduğu için kendi motorunu ve kendi önbelleğini
//  kurar; öteki iki ucun sıcak önbelleği buraya gelmez.
//
//  SAYAÇ NE SÖYLER (§5.4): `yok` ile `kesinti` AYRI alanlar. SEC'in var
//  olmayan bir us-gaap etiketine verdiği 404 bir VERİ CEVABI, taşıma hatası
//  değil. Sayaç motora tek bir sayı dahi GEÇİRMİYOR.
//
//  NE DÖNMEZ: yığın izi, dosya yolu, iç hata metni. Hata yolunda yalnız bir
//  makine kodu dönüyor, ayrıntı sunucu günlüğüne (console.error) yazılıyor.
//
//  SÖZLEŞME
//    GET /api/analyze?symbols=AAPL,THYAO.IS&vade=orta[&market=US]
//      Sorgu ayrıştırma öteki iki uçla BİREBİR aynı (yukarıdaki kopya notu).
//    Cevap 200: { vade, istenen, sonuclar[], atlanan[], sayac, tam,
//                 surum, ms, uyari }
//      sonuclar[i] = /api/recommend'in kaydı + `analiz`:
//        analiz.faKarar       { label, band }   band: na|strong|good|
//                                               mixed|weak|risk
//        analiz.butunculluk   { skor10, band { l, c }, direkler[], coreSoft,
//                               buyumeCls }
//          skor10     0-10, bir ondalık — üç direğin ağırlıklı toplamı
//          band.c     bull | neutral | bear
//          direkler[] { k, w, v, conf } — w ağırlık, v 0-1 direk değeri,
//                       conf=false o direğin verisi YOKTU (nötr sayıldı)
//          coreSoft   kaç direk eksik (0-3). 2+ ise skor "sınırlı veri"
//          buyumeCls  good|mid|bad|thm|na — 'na' = büyüme okunamadı
//      `butunculluk` NULL OLMAZ (plan olabilir): motor eksik direği nötr 50
//      sayıp eksikliği `coreSoft`/`conf` ile BİLDİRİYOR, gizlemiyor.
//      Her sayı HAM: biçimleme ve cümle istemciye ait.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'analiz_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, VADELER, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { analyzeOne } from './_akis.js';


// maxDuration 60 · memory 512 — İKİSİ DE ÖLÇÜLDÜ (2026-10-14, tests/duman.mjs).
// Bu uç için değerler /api/score'dan KOPYALANMADI: tests/duman.mjs'in UCLAR
// listesine 'analyze' eklenip canlı ölçüm ayrıca koşuldu.
//
// ÖLÇÜLEN (lokal, Node v24, tek ABD sembolü AAPL, tek çağrı, tam=true):
//   duvar saati   7.405 ms   (/api/score aynı sorguda 7.213 ms)
//   tepe heapUsed 16,9 MB    · tepe rss 88,3 MB  (/api/score: 18,6 / 88,3 MB)
//   sayaç: yahoo 3/0 · sec 31 istek/3 yok/0 kesinti · tekrar 0
//   bütüncül katman gerçekten üretti: faKarar=strong · skor10=6,4 ·
//   band=neutral · coreSoft=0 · üç direğin üçü de conf=true
//
// NE ÖĞRENDİK: bütüncül katman SAF HESAP — /api/score'un üstüne 192 ms
// (%2,7) ve 0 MB rss ekliyor (tepe rss iki uçta da 88,3 MB). Yani
// computeHolisticScore + faVerdict tek bir ağ isteği DAHA yapmıyor; zaten
// inmiş mumlar ve SEC modeli üzerinden çalışıyor. Bu, analyze'ın recommend'i
// SARMASI kararını da doğruluyor: istemci iki uç çağırmak zorunda kalsaydı
// mumlar + SEC modeli İKİNCİ KEZ inecekti (31 SEC isteği), burada 0 ek istek.
//
// NEDEN 512: ölçülen tepe rss 88,3 MB. AZAMI_SEMBOL = 8'e doğrusal uzatma:
// taban 56,2 MB + 8 × ~32 MB ≈ 313 MB. 256 bunun ALTINDA kalıyor, o yüzden
// 256'ya inilmedi. 1024 ise hiçbir ölçüme dayanmıyor. 512 = öteki iki uçla
// aynı kademe; üç ucun aynı kademede olması ayrıca ÖLÇÜLEBİLİRLİK avantajı
// (dağıtımdan sonra süre farkı görülürse bellek değişken olmayacak).
//
// NEDEN maxDuration 60: tek sembol 7,4 sn → 8 sembol ≈ 59 sn, yani BUTCE_MS
// (45 sn) freni gerçekten devreye girer ve başlamış sembolün bitmesi +
// serileştirme için 60 sn'ye ihtiyaç var. 30 sn YETMEZ.
//
// ÖLÇÜLEN AMA ÇÖZÜLMEYEN (dürüstlük notu): aynı ölçüm AAPL+ASELS.IS ile
// bozuk ağda koşulduğunda TEK ÇAĞRI 76,3 sn sürdü (sec 31 istek / 27
// KESİNTİ). BUTCE_MS freni çalıştı — ASELS `atlanan`a düştü ve `tam:false`
// döndü — ama 76,3 sn > 60 sn, yani Vercel o lambda'yı KESERDİ. Sebep:
// BUTCE_MS yalnız SEMBOLLER ARASINDA bakılıyor, bir sembolün içindeki 31
// SEC isteğinin her biri api/_ag.js'te 10 sn'lik kendi zaman aşımına sahip
// (_ag.js:187) ve bunların toplamına üst sınır YOK. Bu açık ÜÇ UCUN DA
// açığı, bu adımda doğmadı ve burada kapatılmadı: kapatmak ya ortak
// doğrulama bölgesindeki BUTCE_MS'i ya da _ag.js'in zaman aşımlarını
// değiştirmek demek — ikisi de bu adımın kapsamı dışında, üç ucu birlikte
// ilgilendiren ayrı bir karar.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — /api/score ve /api/recommend ile AYNI; gerekçeler ilkinde
//  uzun uzun yazılı (api/score.js:78). Kısaca: AZAMI_SEMBOL = 8 istemcinin
//  Karşılaştır tavanı; BUTCE_MS bir GARANTİ DEĞİL, bir fren (kontrol yeni
//  sembole BAŞLAMADAN önce yapılıyor, başlamış sembol kesilemiyor). Bu
//  dosyada sayıların DEĞİŞMEMESİ gerekiyor: ayrışırlarsa aynı sorgu üç uçta
//  farklı kabul edilir. uc-test ⑤e üç dosyayı birlikte bekçiliyor.
// ---------------------------------------------------------------------

export const AZAMI_SEMBOL = 8;
const BUTCE_MS = 45000;
const PAZARLAR = ['US', 'BIST'];
const VARSAYILAN_VADE = 'orta';
const AZAMI_SORGU = 128; // api/theme.js'in `too_long` eşiğiyle aynı fikir

// Sembol biçimi api/watchlist.js cleanList() ile AYNI — iki uç aynı sembol
// kümesini kabul etmeli, yoksa listeye eklenen bir sembol skorlanamaz.
const SEMBOL_BICIM = /^[A-Z][A-Z0-9.\-]{0,7}$/;

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (başlıktaki gerekçe).
//  try/catch: kurulum patlarsa soğuk başlangıç çöker ve platform biçimsiz
//  bir 500 döner. Hatayı yakalayıp handler'da temiz bir 503'e çeviriyoruz.
//
//  Bu blok /api/score'un kurulumuyla AYNI — ve ayrı bir lambda olduğu için
//  AYRI bir motor nesnesi. İki uç önbellek PAYLAŞMAZ: /api/score'un sıcak
//  secCikMap'i buraya gelmez, ilk /api/analyze isteği SEC'e yeniden çıkar.
//  Bu bir kusur değil, platformun şekli; ölçüm yapılırsa buraya yazılmalı.
// ---------------------------------------------------------------------
let AG = null;
let ENG = null;
let KURULUM_HATASI = null;
try {
  AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
  // _akis.js'in scoreTA'sı ağırlıkları ve endeksi motor nesnesinden okuyor;
  // buildMotor yalnız 23 motor sembolünü döndürüyor, bu iki alanı çağıran
  // takar. tests/engine.mjs:249 parite şeridinde aynısını yapıyor — oradan
  // saparsak test ile sunucu farklı ağırlıklarla skorlar.
  // Değerler KONAKTAN okunuyor (import'tan değil): tek doğruluk kaynağı
  // motora gerçekten verilmiş olan nesne.
  ENG._weights = AG.H.window.TA_WEIGHTS;
  ENG._bench = AG.H.window.TA_BENCHMARK;
} catch (e) {
  KURULUM_HATASI = e;
}

// ---------------------------------------------------------------------
//  Girdi ayrıştırma — AĞA ÇIKMAZ, bu yüzden ayrı ve dışa aktarılmış:
//  tests/uc-test.mjs doğrulamayı fikstür ya da ağ olmadan sınayabiliyor.
//  (Vercel yalnız `default` dışa aktarmayı yönlendiriyor; fazladan adlı
//  dışa aktarma rotayı etkilemiyor.)
// ---------------------------------------------------------------------
export function ayristir(q = {}) {
  const hata = (http, govde) => ({ hata: { http, govde } });

  const ham = String(q.symbols ?? q.symbol ?? '').trim();
  if (!ham) return hata(400, { error: 'symbols_yok', azami: AZAMI_SEMBOL });
  if (ham.length > AZAMI_SORGU) return hata(400, { error: 'too_long', azami: AZAMI_SORGU });

  const vade = String(q.vade ?? VARSAYILAN_VADE).trim();
  if (!VADELER.includes(vade)) return hata(400, { error: 'bad_vade', izinli: VADELER });

  const gPazar = String(q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) return hata(400, { error: 'bad_market', izinli: PAZARLAR });

  const parcalar = ham.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parcalar.length) return hata(400, { error: 'symbols_bos' });
  // Kırpmak YERİNE reddediyoruz: api/yfin.js slice(0, 12) ile sessizce
  // kırpıyor, ama orada eksik sembol yalnız bir kıyas satırı düşürüyor.
  // Burada eksik sembol EKSİK SKOR demek olurdu ve istemci bunu farketmez.
  if (parcalar.length > AZAMI_SEMBOL) {
    return hata(400, { error: 'cok_sembol', azami: AZAMI_SEMBOL, istenen: parcalar.length });
  }

  const rows = [];
  const gecersiz = [];
  const gorulen = new Set();
  for (const p of parcalar) {
    const r = temizleSembol(p, gPazar || 'US');
    if (!r) { gecersiz.push(String(p).slice(0, 16)); continue; }
    const anahtar = r.market + ':' + r.sym;
    if (gorulen.has(anahtar)) continue; // yineleyi at: aynı sembol iki kez skorlanmaz
    gorulen.add(anahtar);
    rows.push(r);
  }
  if (gecersiz.length) return hata(400, { error: 'bad_symbol', gecersiz });

  return { rows, vade, market: gPazar || 'US' };
}

/**
 * Tek sembolü temizle ve pazarını çöz. Dönen `sym` motorun beklediği ÇIPLAK
 * koddur: yahooSymbol() BIST'e '.IS'i kendisi ekliyor (_motor.js:89),
 * fetchIsYatirimMali ise companyCode olarak çıplak kodu istiyor.
 */
function temizleSembol(ham, varsayilanPazar) {
  let s = String(ham).toUpperCase().trim();
  let pazar = varsayilanPazar;
  const iki = s.split(':');
  if (iki.length === 2) {
    if (!PAZARLAR.includes(iki[1])) return null;
    pazar = iki[1];
    s = iki[0];
  } else if (s.endsWith('.IS')) {
    pazar = 'BIST';
    s = s.slice(0, -3);
  }
  s = s.slice(0, 8);
  if (!SEMBOL_BICIM.test(s)) return null;
  return { sym: s, market: pazar };
}

// Hata ve eksik cevaplar KISA önbelleklenir: bir kesintiyi CDN'e 5 dakika
// dondurmak, kesinti geçtikten sonra da eski cevabı servis etmek olurdu.
// api/score.js, api/yfin.js ve api/theme.js hata yolunda aynısını yapıyor.
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export default async function handler(req, res) {
  // CORS — api/score.js ile birebir aynı küme (yeni kalıp uydurulmadı).
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
    // Ayrıntı yalnız sunucu günlüğüne; cevapta iç detay yok.
    console.error('api/analyze: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
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

  const t0 = Date.now();
  try {
    AG.yeniTur(); // sayaçlar + "aynı adrese iki kez çıkma" haritası sıfır
    const sonuclar = [];
    const atlanan = [];
    try {
      for (const row of ay.rows) {
        if (Date.now() - t0 > BUTCE_MS) { atlanan.push(row.sym); continue; }
        // Sembol başına AYRI sayaç: hangi sembolde ölçemediğimiz görünsün.
        const sayac = bosSayac();
        AG.odakla(sayac);
        let kayit;
        try {
          kayit = await analyzeOne(ENG, row, ay.vade, {
            // BIST mali tablosunu akış kendisi çekmiyor — çağıran veriyor.
            // Uçta canlı motor, parite testinde diskteki fikstür.
            getMali: (s) => ENG.fetchIsYatirimMali(s),
          });
        } catch (e) {
          // Bir sembolün patlaması turu bitirmez: kalanlar analiz edilir.
          console.error('api/analyze: sembol hatasi', row.market, row.sym, '—', (e && e.message) || e);
          kayit = {
            sym: row.sym,
            market: row.market,
            ta: { score: null, why: 'hesaplanamadi' },
            fa: { score: null, why: 'hesaplanamadi', price: null },
            composite: { band: null, why: 'eksik skor' },
            // `plan: null` BOŞ PLAN DEĞİL, "plan üretilemedi" demek. Alanı
            // hiç koymamak istemciyi `'plan' in kayit` ile `kayit.plan`
            // arasında ayrım yapmaya zorlardı; başarılı yolda da plan
            // null olabiliyor (vade 'gunici'), yani alan HER ZAMAN var.
            plan: null,
            // `analiz: null` aynı sözleşme, AMA farklı bir anlam taşıyor:
            // başarılı yolda bu alan ASLA null olmuyor (motor eksik direği
            // nötr sayıp eksikliği coreSoft/conf ile bildiriyor — gerekçe
            // api/_akis.js analizKatmani'nda). Yani null görmek istemci
            // için tek anlama geliyor: "bu sembol patladı".
            analiz: null,
          };
        }
        sonuclar.push({ ...kayit, sayac, tam: sayacTam(sayac) });
      }
    } finally {
      AG.odakla(null); // sayaç odağı genele dönsün (sonraki istek temiz başlar)
    }

    const genel = AG.genel;
    // `tam` ÖLÇÜLEBİLİRLİK bayrağı, "skor var mı" bayrağı değil: kesinti
    // yoksa ve atlanan sembol yoksa true. Skorun null olması (örn. SEC'te
    // o şirket yok) `tam`ı bozmaz — o bir VERİ CEVABI. Eksik direk
    // (coreSoft > 0) da bozmaz: o da bir VERİ durumu, taşıma hatası değil.
    const tam = sayacTam(genel) && atlanan.length === 0;

    // Tam cevap: öteki iki uçla AYNI önbellek penceresi. Gerekçe motorda:
    // fetchYahooOHLC adrese 5 dakikalık bir `_t` kovası koyuyor
    // (_motor.js:99), yani mum verisi zaten 5 dk çözünürlükte. Bütüncül
    // katman o mumlardan ve SEC modelinden türüyor; daha taze bir pencere
    // YANILTICI olurdu.
    if (tam) res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    else kisaOnbellek(res);

    res.status(200).json({
      vade: ay.vade,
      istenen: ay.rows.length,
      sonuclar,
      atlanan,
      sayac: genel,
      tam,
      // `surum` öteki iki uçla AYNI BİÇİM: { motor, ayar }. Bütüncül katman
      // da motorun içinde olduğu için ayrı bir "analiz imzası" YOK — bir
      // gün bütüncül okuma motordan çıkarsa bu alan üçüncü bir anahtar
      // kazanır ve o bir istemci sözleşmesi değişikliği olur.
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/analyze:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'analiz_hesaplanamadi', uyari: UYARI });
  }
}
