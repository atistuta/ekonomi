// ===========================================================================
//  /api/score — HAM skor uç noktası            ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: bir veya daha çok sembol için TA skoru + FA skoru + bileşkeyi
//  döndürür. Hiçbir şey hesaplamaz — hazır parçaları BİRLEŞTİRİR:
//
//      api/_motor.js  buildMotor(H)                 motorun kendisi
//      api/_ayar.js   TA_WEIGHTS · TA_BENCHMARK     el ağırlıkları
//      api/_ekran.js  PE · BLEND                    ekran katmanı (GEÇİCİ)
//      api/_ag.js     canliAg()                     canlı ağ + konak + sayaç
//      api/_akis.js   scoreOne()                    çağrı sırası
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
import { TA_WEIGHTS, TA_BENCHMARK, VADELER, IMZA_AYAR } from './_ayar.js';
import { PE, BLEND, IMZA_EKRAN } from './_ekran.js';
import { canliAg, bosSayac, sayacTam } from './_ag.js';
import { scoreOne } from './_akis.js';

// maxDuration 60: api/poll.js'te 60 sn'nin bu projede kullanılabildiği
// ölçüldü (vercel.json functions girdisi). 30 sn YETMEZ — tek bir BIST
// sembolü en kötü halde onu aşıyor (aşağıdaki bütçe hesabı).
export const config = { runtime: 'nodejs', maxDuration: 60 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — neden bu sayılar
//
//  AZAMI_SEMBOL = 8 · üç ayrı gerekçe aynı sayıda buluşuyor:
//    ① İstemcinin kendi tavanı 8. Karşılaştır ekranı en çok 8 hisse
//       alıyor (v69'da 6'dan 8'e çıkarıldı) — tek seferde daha fazlasını
//       isteyecek bir ekran yok.
//    ② Zaman bütçesi. Bir sembol TİPİK olarak 3-6 sn: 5y mum + 1y mum +
//       (ABD) SEC modeli ya da (BIST) mali tablo. Endeks mumları turda bir
//       kez indiriliyor (_ag.js `birKez`), yani ikinci sembolden sonra bir
//       istek daha az. 8 × ~5 sn ≈ 40 sn < 45 sn'lik başlatma bütçesi.
//    ③ Yayılma sınırı. Sembol başına en çok ~6 dış istek düşüyor; 8 sembol
//       ≈ 48 istek. SEC tarafı 125 ms aralıkla sıraya giriyor (_ag.js
//       SEC_ARALIK_MS) → hız sınırı aşılmıyor. Sınır olmasa tek bir istek
//       yüzlerce dış isteği başlatabilirdi.
//
//  BUTCE_MS = 45000 · DÜRÜST SINIRI: bu bir garanti DEĞİL, bir frendir.
//  Kontrol yeni bir sembole BAŞLAMADAN önce yapılıyor; başlamış bir sembol
//  kesilemiyor, çünkü zaman aşımları motorun ve konağın içinde (_ag.js:
//  yahooMs 10000 · secMs 10000 · isMs 7000, fetchIsYatirimMali üç yılı
//  SIRAYLA deniyor → 3 × 7 = 21 sn). En kötü halde TEK bir sembol 45-55 sn
//  yiyebilir; o zaman platform isteği keser ve istemci hiç cevap almaz.
//  Bunu uçta çözmek motora ya da konağa dokunmayı gerektirirdi (ikisi de
//  bu adımın kapsamı dışında) — bu yüzden sınır yazılı, kapsamı değil.
//  İstemci kesilen isteği `kesinti` ile AYNI şekilde ele almalı.
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

// Ekran katmanı sabitleri — akışın beklediği biçim. _ekran.js GEÇİCİ:
// Commit C F/K kriterini motora devredip o dosyayı silecek; o gün burada
// yalnız bu iki satır değişir.
const K = { pe: PE, blend: BLEND };

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
          kayit = await scoreOne(ENG, K, row, ay.vade, {
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

    res.status(200).json({
      vade: ay.vade,
      istenen: ay.rows.length,
      sonuclar,
      atlanan,
      sayac: genel,
      tam,
      // Hangi motor metni koştu: üç imza da uretim-test.mjs'in doğruladığı
      // imzalar. İstemci bir skoru bildirirken bunu yanına yazabilir.
      surum: { motor: IMZA, ayar: IMZA_AYAR, ekran: IMZA_EKRAN },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/score:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'skor_hesaplanamadi', uyari: UYARI });
  }
}
