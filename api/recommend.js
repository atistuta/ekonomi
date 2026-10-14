// ===========================================================================
//  /api/recommend — HAM öneri uç noktası          ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: /api/score'un döndürdüğü her şey (TA skoru + FA skoru + bileşke) ve
//  ÜSTÜNE kullanıcının ekranda gördüğü PLAN — alım/satım bölgeleri, fiyatın
//  banda uzaklığı, momentum rejimi, risk/ödül. Hiçbir şey hesaplamaz;
//  /api/score ile AYNI dört parçayı birleştirir:
//
//      api/_motor.js  buildMotor(H)                 motorun kendisi
//      api/_ayar.js   TA_WEIGHTS · TA_BENCHMARK     el ağırlıkları
//      api/_ag.js     canliAg()                     canlı ağ + konak + sayaç
//      api/_akis.js   recommendOne()                çağrı sırası
//      api/_girdi.js  ayristir() · AZAMI_SEMBOL     girdi kapısı + sınırlar
//
//  ALTINCI TAŞIYICI YOK ve olmamalı: plan katmanının dördü de (levels,
//  buyZoneProximity, momentumInfo, planRiskReward) 2026-10-14'te MOTORA
//  devredildi (app.js → _motor.js, D1). Burada eşik, çarpan ya da ATR
//  katsayısı YOK — bir sayı buraya yazılırsa parite testi onu GÖRMEZ
//  (baseline.json yalnız akışı bekçiliyor) ve sunucu ile ekran sessizce
//  ayrışır.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): cevapta `Intl` ile
//  biçimlenmiş TEK alan yok — yüzde işareti, para birimi, binlik ayracı,
//  emoji üretilmiyor. Planın kendisi bu kuralın en kırılgan yeri: ekran
//  katmanında `buyZoneProximity` bir zamanlar `txt: '🟢 … 1.2×ATR'` alanı
//  taşıyordu; devredilirken o alan BİLEREK söküldü ve cümle çağrı
//  noktasında bırakıldı. Cevapta geçen metinler yalnız sabit küme
//  etiketleri (`state`, `cls`, `sellKind`, `brkKind`, `anchorKind`, bant
//  adı, rejim adı, `why` sebebi). `levels.anchorSrc` serbest TÜRKÇE metin
//  olduğu için tele KONMUYOR — gerekçesi _akis.js `planKatmani`'nda.
//
//  KAPI /api/score İLE AYNI — ve artık KOPYA DEĞİL. Burada bir zaman
//  "beşinci bir taşıyıcı açmak bu adımın kapsamı dışındaydı; üçüncü bir uç
//  aynı kapıya ihtiyaç duyduğu gün kopya değil TAŞIYICI doğru cevap olur"
//  yazıyordu. O gün geldi: sınırlar + `SEMBOL_BICIM` + `ayristir()` +
//  `temizleSembol()` 2026-10-14'te `api/_girdi.js`e taşındı (61 kod satırı
//  / 2.401 krk × 3 kopya ÖLÇÜLDÜ, sonra silindi). Üç uç aynı fonksiyon
//  NESNESİNİ içe alıyor; tests/uc-test.mjs ⑤e artık metin değil KİMLİK
//  ölçüyor. Ayrışma fiziksel olarak mümkün değil.
//
//  KONAK NEDEN MODÜL DÜZEYİNDE: /api/score'daki gerekçenin aynısı — motor
//  kapanışı secCikMap (sembol → SEC CIK) ve secModelCache (sembol → temel
//  model) önbelleklerini taşıyor; her istekte yeniden kurulsalar aynı
//  sembol için SEC'e tekrar tekrar çıkılırdı. DİKKAT: bu uç kendi lambda'sı
//  olduğu için kendi motorunu ve kendi önbelleğini kurar; /api/score'un
//  sıcak önbelleği buraya gelmez.
//
//  SAYAÇ NE SÖYLER (§5.4): `yok` ile `kesinti` AYRI alanlar. SEC'in var
//  olmayan bir us-gaap etiketine verdiği 404 bir VERİ CEVABI ("bu şirkette
//  o kalem yok"), taşıma hatası değil. Böylece istemci "düşük skor" ile
//  "ölçemedim"i ayırt edebiliyor. Sayaç motora tek bir sayı dahi GEÇİRMİYOR.
//
//  NE DÖNMEZ: yığın izi, dosya yolu, iç hata metni. Hata yolunda yalnız bir
//  makine kodu dönüyor, ayrıntı sunucu günlüğüne (console.error) yazılıyor.
//
//  SÖZLEŞME
//    GET /api/recommend?symbols=AAPL,THYAO.IS&vade=orta[&market=US]
//      Sorgu ayrıştırma /api/score ile BİREBİR aynı (yukarıdaki kopya notu).
//    Cevap 200: { vade, istenen, sonuclar[], atlanan[], sayac, tam,
//                 surum, ms, uyari }
//      sonuclar[i] = /api/score'un kaydı + `plan`:
//        plan = null                       → TA koşmadı (örn. vade 'gunici')
//        plan.seviye    { price, target, stop, rr, poc, atr, buyZone,
//                         sellZone, zMult, sellKind, sma50, sma200,
//                         anchorKind }
//        plan.yakinlik  { state, cls, dAtr } | null
//        plan.momentum  { active, ... }     active=false ise sebep alanları
//        plan.riskOdul  { sellUpPct, sellKind, brkPrimary, brkKind, brkPct,
//                         brkMajor, atrStop, rrRatio } | null
//      Plandaki her sayı HAM: biçimleme ve cümle istemciye ait.
//      `rrRatio` yalnız MESAFE oranıdır — olasılık DEĞİL (gerekçe motorda).
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'oneri_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { recommendOne } from './_akis.js';

// maxDuration 60 · memory 512 — İKİSİ DE ÖLÇÜLDÜ (2026-10-14, tests/duman.mjs).
// Bu blokta daha önce "ÖLÇÜLMEDİ, TAHMİN" yazıyordu: değerler /api/score'dan
// kopyalanmıştı. Canlı duman testi tahmini sayıyla değiştirdi.
//
// ÖLÇÜLEN (lokal, Node v24, AAPL+ASELS.IS, tek çağrı):
//   duvar saati  28.658 sn   (/api/score aynı sorguda 30.630 sn)
//   tepe heapUsed 17,1 MB    · tepe rss 95,3 MB
// Tek ABD sembolüyle (BIST ayağı olmadan, tam=true): 7,2 sn · rss 88,3 MB.
//
// NEDEN 512 ve 1024 DEĞİL: ölçülen tepe rss 95 MB — 1024 on kat fazlaydı ve
// hiçbir ölçüme dayanmıyordu. AZAMI_SEMBOL = 8'e doğrusal uzatma: taban
// 56 MB + 8 × ~19,5 MB ≈ 212 MB. 512 bunun ~2,4 katı, ölçülen tepenin ~5
// katı. 256'ya inilmedi çünkü (a) tepe değer ÖRNEKLEMEYLE alındı, yani alt
// sınırdır; (b) BIST mali tablosu bu ölçümde hiç inmedi (aşağıdaki not), o
// yüzden BIST yolunun bellek tepesi ÖLÇÜLMEDİ; (c) belleği aşan lambda 500
// döner — fazladan bellek ucuz, çöken uç pahalı.
//
// BİLİNEN TAVİZ: Vercel'de bellek kademesi vCPU'yu da ölçekliyor, yani 512
// daha az CPU demek. Bu iş yükü İO-ağırlıklı (31 SEC isteği 125 ms aralıkla
// sıraya giriyor = 7,2 sn'nin ~3,9 sn'si saf bekleme), o yüzden CPU
// darboğaz değil; ama SEC companyfacts JSON ayrıştırması CPU yiyor. Bu taviz
// GÖRÜLDÜ, atlanmadı; dağıtımdan sonra süre uzarsa ilk bakılacak yer burası.
//
// NEDEN maxDuration 60 KALDI: ölçüm değiştirmemeyi haklı çıkardı. Tek ABD
// sembolü 7,2 sn → AZAMI_SEMBOL = 8 ile ~58 sn, yani süre freni (_ag.js
// TUR_BUTCE_MS 45 sn) gerçekten devreye girer ve başlamış sembolün bitmesi +
// serileştirme için 60 sn'ye ihtiyaç var. 30 sn YETMEZ. Tavan (TUR_TAVAN_MS
// 50 sn) 60'ın ALTINDA: bu uç artık kesilmeden önce cevap döndürüyor.
//
// plan katmanı hakkındaki eski varsayım da DOĞRULANDI: aynı sorguda
// recommend (28,7 sn) score'dan (30,6 sn) yavaş değil — saf hesap olan plan
// katmanı ağ gürültüsünün altında kalıyor.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — /api/score'un sınırlarıyla AYNI; gerekçeler orada uzun uzun
//  yazılı (api/score.js:78). Kısaca: AZAMI_SEMBOL = 8 istemcinin Karşılaştır
//  tavanı. SÜRE eşiği burada YOK: `api/_ag.js` taşıyor (TUR_BUTCE_MS ·
//  TUR_TAVAN_MS), bu uç `AG.butceDoldu()` soruyor. Bu dosyada sayıların
//  DEĞİŞMEMESİ gerekiyor: ayrışırlarsa aynı sorgu iki uçta farklı kabul
//  edilir. uc-test ⑤e bunu bekçiliyor.
// ---------------------------------------------------------------------
//  SINIRLAR + GİRDİ KAPISI → `api/_girdi.js` (beşinci taşıyıcı)
//
//  Bu dosyada ARTIK KOPYA YOK. Sınırlar (AZAMI_SEMBOL · AZAMI_SORGU ·
//  PAZARLAR · VARSAYILAN_VADE · SEMBOL_BICIM), `ayristir()` ve
//  `temizleSembol()` taşıyıcıda; burada yalnız YENİDEN DIŞA AKTARILIYOR,
//  çünkü tests/uc-test.mjs ucun kendi yüzeyinden okuyor ve istemcinin
//  gördüğü yüzey değişmemeli.
//
//  Gerekçeler (niye 8, niye 128) taşıyıcının başlığında uzun uzun yazılı —
//  üç dosyaya kopyalanmıyor. Sürüklenme kilidi: uc-test ⑤e artık metin
//  karşılaştırması değil KİMLİK denetimi yapıyor (üç uç aynı fonksiyon
//  nesnesini dışa aktarıyor + hiçbiri yerel kopya diriltmedi).
// ---------------------------------------------------------------------
//  DİKKAT — `export { ... } from` YETMEZ: o biçim yalnız yeniden dışa
//  aktarır, YEREL BAĞLAMA yaratmaz; handler `ayristir`i çağırdığı için
//  içe alma ayrıca gerekiyor. (Bu hata yazılırken uc-test ③'te
//  `ReferenceError: ayristir is not defined` ile KIRMIZI yandı.)
import { AZAMI_SEMBOL, ayristir } from './_girdi.js';
export { AZAMI_SEMBOL, ayristir };

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (başlıktaki gerekçe).
//  try/catch: kurulum patlarsa soğuk başlangıç çöker ve platform biçimsiz
//  bir 500 döner. Hatayı yakalayıp handler'da temiz bir 503'e çeviriyoruz.
//
//  Bu blok /api/score'un kurulumuyla AYNI — ve ayrı bir lambda olduğu için
//  AYRI bir motor nesnesi. İki uç önbellek PAYLAŞMAZ: /api/score'un sıcak
//  secCikMap'i buraya gelmez, ilk /api/recommend isteği SEC'e yeniden çıkar.
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
    console.error('api/recommend: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
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
        if (AG.butceDoldu()) { atlanan.push(row.sym); continue; }
        // Sembol başına AYRI sayaç: hangi sembolde ölçemediğimiz görünsün.
        const sayac = bosSayac();
        AG.odakla(sayac);
        let kayit;
        try {
          kayit = await recommendOne(ENG, row, ay.vade, {
            // BIST mali tablosunu akış kendisi çekmiyor — çağıran veriyor.
            // Uçta canlı motor, parite testinde diskteki fikstür.
            getMali: (s) => ENG.fetchIsYatirimMali(s),
          });
        } catch (e) {
          // Bir sembolün patlaması turu bitirmez: kalanlar skorlanır.
          console.error('api/recommend: sembol hatasi', row.market, row.sym, '—', (e && e.message) || e);
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
    // o şirket yok) `tam`ı bozmaz — o bir VERİ CEVABI. Planın null olması
    // da bozmaz: 'gunici' vadede günlük mum koşmaz, bu bir KARAR.
    const tam = sayacTam(genel) && atlanan.length === 0;

    // Tam cevap: /api/score ile aynı önbellek penceresi. Gerekçe motorda:
    // fetchYahooOHLC adrese 5 dakikalık bir `_t` kovası koyuyor
    // (_motor.js:99), yani mum verisi zaten 5 dk çözünürlükte. Plan
    // katmanı o mumlardan türüyor; daha taze bir pencere YANILTICI olurdu.
    if (tam) res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    else kisaOnbellek(res);

    res.status(200).json({
      vade: ay.vade,
      istenen: ay.rows.length,
      sonuclar,
      atlanan,
      sayac: genel,
      tam,
      // `surum` /api/score ile AYNI BİÇİM: { motor, ayar }. Plan katmanı
      // motorun içinde olduğu için ayrı bir "plan imzası" YOK — bir gün
      // plan motordan çıkarsa bu alan üçüncü bir anahtar kazanır ve o bir
      // istemci sözleşmesi değişikliği olur.
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/recommend:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'oneri_hesaplanamadi', uyari: UYARI });
  }
}
