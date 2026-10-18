// ===========================================================================
//  /api/score — HAM skor uç noktası            ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: bir veya daha çok sembol için TA skoru + FA skoru + bileşkeyi
//  döndürür. Hiçbir şey hesaplamaz — hazır parçaları BİRLEŞTİRİR:
//
//      api/_motor.js  buildMotor(H)                 motorun kendisi
//      api/_ayar.js   TA_WEIGHTS · TA_BENCHMARK     el ağırlıkları
//      api/_ag.js     canliAg()                     canlı ağ + konak + sayaç
//      api/_akis.js   scoreOne()                    çağrı sırası
//      api/_girdi.js  ayristir() · AZAMI_SEMBOL     girdi kapısı + sınırlar
//
//  Bu dosyada motor mantığı YOK ve olmamalı: her eşik, her ağırlık, her
//  gösterge yukarıdaki beş dosyadan geliyor. Buraya bir sayı yazılırsa
//  parite testi onu GÖRMEZ (baseline.json yalnız akışı bekçiliyor) ve
//  sunucu ile ekran sessizce ayrışır.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): cevapta `Intl` ile
//  biçimlenmiş TEK alan yok — yüzde işareti, para birimi, binlik ayracı
//  üretilmiyor. Sunucu biçimlerse çıktı sunucunun yerel ayarına kilitlenir
//  ve istemci (native uygulama) onu geri çeviremez. Cevapta geçen metinler
//  yalnız sabit küme etiketleri (bant adı, rejim adı, `why` sebebi).
//
//  KONAK NEDEN MODÜL DÜZEYİNDE: motor kapanışında iki önbellek taşıyor —
//  secCikMap (sembol → SEC CIK) ve secModelCache (sembol → temel model).
//  Konak her istekte yeniden kurulsaydı bunlar her istekte sıfırlanır ve
//  aynı sembol için SEC'e tekrar tekrar çıkılırdı. Bir kez kurulunca sıcak
//  lambda ömrü boyunca yaşıyorlar. api/yfin.js'in crumb önbelleği de aynı
//  varsayıma dayanıyor (`let CRUMB = null`). Tur durumu — sayaçlar ve
//  "aynı adrese iki kez çıkma" haritası — bu yüzden AYRI tutuluyor ve her
//  istekte `yeniTur()` ile sıfırlanıyor.
//
//  SAYAÇ NE SÖYLER (§5.4): `yok` ile `kesinti` AYRI alanlar. SEC'in var
//  olmayan bir us-gaap etiketine verdiği 404 bir VERİ CEVABI ("bu şirkette
//  o kalem yok"); motorun secGet'i onu da taşıma hatasını da `null` yapıyor.
//  Kabuk farkı tutuyor, uç nokta cevapta açıkça yazıyor. Böylece istemci
//  "düşük skor" ile "ölçemedim"i ayırt edebiliyor. Sayaç motora tek bir
//  sayı dahi GEÇİRMİYOR — yalnız gözlemci; skor onunla değişmiyor.
//
//  NE DÖNMEZ: yığın izi, dosya yolu, iç hata metni. Hata yolunda yalnız bir
//  makine kodu dönüyor, ayrıntı sunucu günlüğüne (console.error) yazılıyor.
//  api/yfin.js ve api/theme.js hata gövdesine `e.message` koyuyor; burada
//  BİLEREK sapıldı, çünkü bu uçtaki hata metinleri izin verilmeyen adresi
//  ve dolayısıyla iç kurulumu açık edebilir.
//
//  SÖZLEŞME
//    GET /api/score?symbols=AAPL,THYAO.IS&vade=orta[&market=US]
//      symbols : virgülle ayrılmış, en çok AZAMI_SEMBOL (8) öğe.
//                Pazar üç yoldan verilebilir — `?market=`, `SYM:BIST`
//                eki, ya da Yahoo yazımı `SYM.IS` (→ BIST, ek soyulur;
//                motorun yahooSymbol'ü onu kendisi geri ekliyor).
//      vade    : api/_ayar.js VADELER içinden ('gunici' | 'kisa' | 'orta'
//                | 'uzun'). Varsayılan 'orta'. NOT: 'gunici' gün-içi bir
//                vade; günlük mumla TA üretilmiyor, o vadede cevap
//                ta.score = null + why döner (akışın dürüst cevabı,
//                hata değil).
//      market  : 'US' | 'BIST' — eki olmayan sembollerin varsayılanı.
//    Cevap 200: { vade, istenen, sonuclar[], atlanan[], sayac, tam,
//                 surum, ms, uyari }
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'skor_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { scoreOne } from './_akis.js';

// maxDuration 60 · memory 512 — İKİSİ DE ÖLÇÜLDÜ (2026-10-14, tests/duman.mjs).
// Önceki gerekçe dolaylıydı ("api/poll.js'te 60 sn kullanılabildiği ölçüldü");
// artık bu ucun KENDİ sayısı var.
//
// ÖLÇÜLEN (lokal, Node v24, tek çağrı):
//   AAPL tek başına, tam=true : 7,2 sn · tepe heapUsed 18,6 MB · tepe rss 88,3 MB
//   AAPL + ASELS.IS           : 30,6 sn · tepe heapUsed 18,9 MB · tepe rss 93,4 MB
// Aradaki ~23 sn BIST ayağının ÖLÜ süresi: fetchIsYatirimMali üç yılı sırayla
// deniyor, her biri isMs=7000'de düşüyor (ölçüm ağından www.isyatirim.com.tr'ye
// TCP bağlantısı kurulamadı — UND_ERR_CONNECT_TIMEOUT). Yani 30,6 sn BIST'in
// ÇALIŞTIĞI haldeki süre değil, ÇALIŞMADIĞI haldeki süre.
//
// 60 KALDI, ÇÜNKÜ ÖLÇÜM BUNU İSTİYOR: 7,2 sn/sembol × AZAMI_SEMBOL 8 ≈ 58 sn.
// BUTCE_MS (45 sn) freni gerçekten devreye girer; başlamış sembolün bitmesi +
// serileştirme için 60 sn gerekiyor. 30 sn YETMEZ.
//
// NEDEN memory 512 (1024 DEĞİL): ölçülen tepe rss 93 MB. 1024 on kat fazlaydı
// ve hiçbir ölçüme dayanmıyordu. 8 sembole doğrusal uzatma: taban 56 MB +
// 8 × ~19,5 MB ≈ 212 MB. 512 bunun ~2,4 katı. 256'ya İNİLMEDİ çünkü (a) tepe
// değer örneklemeyle alındı → ALT SINIR; (b) BIST mali tablosu hiç inmedi, o
// yolun bellek tepesi ÖLÇÜLMEDİ; (c) belleği aşan lambda 500 döner.
// TAVİZ GÖRÜLDÜ: Vercel'de bellek kademesi vCPU'yu da ölçekliyor. İş yükü
// İO-ağırlıklı (31 SEC isteği × 125 ms aralık = 7,2 sn'nin ~3,9 sn'si bekleme),
// ama companyfacts JSON ayrıştırması CPU yiyor. Dağıtımdan sonra süre uzarsa
// ilk bakılacak yer burası.
export const config = { runtime: 'nodejs', maxDuration: 60 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — neden bu sayılar
//
//  AZAMI_SEMBOL = 8 · üç ayrı gerekçe aynı sayıda buluşuyor:
//    ① İstemcinin kendi tavanı 8. Karşılaştır ekranı en çok 8 hisse
//       alıyor (v69'da 6'dan 8'e çıkarıldı) — tek seferde daha fazlasını
//       isteyecek bir ekran yok.
//    ② Zaman bütçesi. ÖLÇÜLDÜ (2026-10-14, tests/duman.mjs): bir ABD sembolü
//       7,2 sn — 5y mum + 1y mum + SEC modeli (31 SEC isteği, aralarında
//       125 ms zorunlu bekleme). Eski tahmin "3-6 sn"di, ölçüm onu YUKARI
//       düzeltti. Endeks mumları turda bir kez indiriliyor (_ag.js `birKez`),
//       yani ikinci sembolden sonra bir istek daha az. 8 × 7,2 sn ≈ 58 sn,
//       yani bütçe (45 sn) 8 sembolde GERÇEKTEN dolar ve son semboller
//       `atlanan`a düşer. Bu bir arıza değil, frenin işini yapması — ama
//       "8 sembol rahat sığar" varsayımı ÖLÇÜMLE ÇÜRÜDÜ. BIST sembolleri
//       daha pahalı: mali tablo yolu üç yılı sırayla deniyor.
//    ③ Yayılma sınırı. Sembol başına en çok ~6 dış istek düşüyor; 8 sembol
//       ≈ 48 istek. SEC tarafı 125 ms aralıkla sıraya giriyor (_ag.js
//       SEC_ARALIK_MS) → hız sınırı aşılmıyor. Sınır olmasa tek bir istek
//       yüzlerce dış isteği başlatabilirdi.
//
//  SÜRE FRENİ BURADA DEĞİL — `api/_ag.js`te (TUR_BUTCE_MS 45000 ·
//  TUR_TAVAN_MS 50000). Bu uç sayı TAŞIMIYOR, `AG.butceDoldu()` soruyor.
//  Eşik üç uca kopyalanmış olsaydı biri değişip ikisi kalabilirdi.
//
//  Burada eskiden "en kötü halde TEK bir sembol 45-55 sn yiyebilir, platform
//  isteği keser, istemci hiç cevap almaz — uçta çözmek kapsam dışı" yazıyordu.
//  O açık ÖLÇÜLDÜ ve KAPATILDI: semboller arası fren bir sembolün İÇİNDEKİ
//  aşımı göremiyordu. Ölçüm (tests/sure.mjs, belirlenimci): tek çağrı
//  76,0 sn → maxDuration 60 AŞILIYORDU. _ag.js'e tur başına MUTLAK SON TARİH
//  konduktan sonra aynı koşum 50,0 sn. Fren artık sembol içinde de duruyor.
//  Sözleşme: tavana çarpmak arıza değil — uç yine 200 döner, etkilenen
//  sembol `tam: false` olur (= "ölçemedim"), sayaç `kesinti` artar. Bu,
//  `score: null` + `tam: true` ("ölçtüm, veri yok") ile KARIŞTIRILMAMALI.
//  Bekçi: uc-test ⑦ (hızlı, ölçekli) · tests/sure.mjs (üretim sabitleri, elle).
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

// ÖNBELLEK — altı ucun PAYLAŞTIĞI taşıyıcı; bu dosyada kopya mantık YOK.
// TTL gerekçesi ve uç başına ÖLÇÜLEN dış istek sayıları orada yazılı.
import { anahtar, skorGirdisi, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (başlıktaki gerekçe).
//  try/catch: kurulum patlarsa soğuk başlangıç çöker ve platform biçimsiz
//  bir 500 döner. Hatayı yakalayıp handler'da temiz bir 503'e çeviriyoruz.
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
// api/yfin.js ve api/theme.js hata yolunda aynısını yapıyor.
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export default async function handler(req, res) {
  // CORS — api/yfin.js ile birebir aynı küme (yeni kalıp uydurulmadı).
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
    console.error('api/score: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
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

  // --- ÖNBELLEK OKUMASI (api/_onbellek.js) ---------------------------
  //  İsabet = ÖLÇÜLEN 33 dış isteğin (AAPL: 31 SEC + 2 Yahoo) yerine TEK KV okuması.
  //  Anahtar MOTOR İMZASINI taşıyor: `node tools/motor-uret.mjs` motoru
  //  değiştirdiği an eski girdiler kendiliğinden geçersizleşir, eski skor
  //  yeni motorla KARIŞAMAZ.
  //  KV yoksa / arızalıysa / yavaşsa `oku()` null döner ve buradan AŞAĞI
  //  önbelleksiz yola devam ederiz — istek ASLA düşmez.
  const obAnahtar = anahtar('score', skorGirdisi(ay), { motor: IMZA, ayar: IMZA_AYAR });
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
          kayit = await scoreOne(ENG, row, ay.vade, {
            // BIST mali tablosunu akış kendisi çekmiyor — çağıran veriyor.
            // Uçta canlı motor, parite testinde diskteki fikstür.
            getMali: (s) => ENG.fetchIsYatirimMali(s),
          });
        } catch (e) {
          // Bir sembolün patlaması turu bitirmez: kalanlar skorlanır.
          console.error('api/score: sembol hatasi', row.market, row.sym, '—', (e && e.message) || e);
          kayit = {
            sym: row.sym,
            market: row.market,
            ta: { score: null, why: 'hesaplanamadi' },
            fa: { score: null, why: 'hesaplanamadi', price: null },
            composite: { band: null, why: 'eksik skor' },
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
    // o şirket yok) `tam`ı bozmaz — o bir VERİ CEVABI.
    const tam = sayacTam(genel) && atlanan.length === 0;

    // Tam cevap: api/yfin.js ile aynı önbellek penceresi. Gerekçe motorda:
    // fetchYahooOHLC adrese 5 dakikalık bir `_t` kovası koyuyor
    // (_motor.js:99), yani mum verisi zaten 5 dk çözünürlükte.
    if (tam) res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    else kisaOnbellek(res);

    const govde = {
      vade: ay.vade,
      istenen: ay.rows.length,
      sonuclar,
      atlanan,
      sayac: genel,
      tam,
      // Hangi motor metni koştu: iki imza da uretim-test.mjs'in doğruladığı
      // imzalar. İstemci bir skoru bildirirken bunu yanına yazabilir.
      // `ekran` ALANI KALDIRILDI (2026-10-14): üçüncü taşıyıcı api/_ekran.js
      // silindi — F/K kriteri ve FA/TA harmanı motora girdi, ayrı bir ekran
      // imzası diye bir şey kalmadı. İSTEMCİ SÖZLEŞMESİ DEĞİŞİKLİĞİ.
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
    console.error('api/score:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'skor_hesaplanamadi', uyari: UYARI });
  }
}
