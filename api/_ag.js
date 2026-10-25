// ===========================================================================
//  CANLI AĞ KATMANI — tek kurulum yeri   ·   ELLE YAZILMIŞTIR (üretilmiş DEĞİL)
// ===========================================================================
//
//  NE: motorun dışarıyla konuşurken uyması gereken ÖLÇÜLMÜŞ kurallar —
//  hangi User-Agent, hangi başlık kümesi, SEC'in hız sınırı, SEC önekinin
//  biçimi. Yani "uzak sunucu bizden ne İSTİYOR" bilgisi.
//
//  NEDEN BURADA: bu bilginin ikinci bir tüketicisi var — tests/capture.mjs.
//  O dosya fikstürleri çekerken AYNI başlıkları kurmak zorunda, yoksa
//  dondurulan veri sunucunun göreceğinden farklı olur. İki yerde iki kopya
//  dursa, SEC bir gün UA politikasını değiştirdiğinde capture.mjs onarılır,
//  /api/score sessizce boş döner ve bu ekranda "bu şirkette veri yok" diye
//  okunur. Bu yüzden sabitler ve başlık kurucuları BURADA; iki taraf da
//  buradan içe alıyor.
//
//  NE PAYLAŞILMAZ: ne kadar sabırlı yeniden deneyeceğimiz. capture.mjs
//  saatlerce kibarca bekleyebilir (fikstür bir kez çekilir); uç noktanın
//  30-60 sn bütçesi var. Politika çağırana ait, BİLGİ ortak.
//
//  BU DOSYA ÜRETİLMİŞ DEĞİL: _motor.js app.js'ten, _ayar.js config.js'ten
//  türetilir, bu dosya türetilmez. `node tools/motor-uret.mjs` buna dokunmaz.
//  Motoru ve ayarı da İÇE ALMAZ: ayar okuma ve motor kurulumu çağırana
//  (api/score.js) ait. Sebep: parite şeridinin VARSAYILAN hali motoru
//  app.js'ten dilimleyerek kuruyor; bu dosya _motor.js'i içe alsaydı o
//  şerit de üretilmiş taşıyıcıyı belleğe çeker ve "iki ayrı şerit" anlatısı
//  bulanıklaşırdı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { setTimeout as bekle } from 'node:timers/promises';

// ---------------------------------------------------------------------
//  ÖLÇÜLMÜŞ SABİTLER — değiştirmeden önce YENİDEN ÖLÇ.
// ---------------------------------------------------------------------

// SEC UA — `www.sec.gov` WAF'ı UA içinde E-POSTA BİÇİMLİ iletişim imi ARIYOR.
//
// ESKİ NOT YANLIŞTI ("iletişim bilgisi İSTEMİYOR"): o not yalnız
// `data.sec.gov` için doğruydu. `www.sec.gov` için e-postasız UA 403 alıyor.
//
// ÖLÇÜMLER (hepsi https://www.sec.gov/files/company_tickers.json üzerinde):
//   2026-10-24 (api/proxy.js ölçümü, canlı curl):
//     '…(contact: sabah-bulteni)' (@ yok)            → 403
//     'Mozilla/5.0 (compatible; SabahBulteni/1.0)'   → 403
//     eski e-postasız UA ('…parite-testi')           → 403 (www), 200 (data)
//     aşağıdaki UA                                   → 200
//   2026-10-25 (üretim, Vercel): eski UA → 403; normal Chrome 131 UA → 403;
//     aşağıdaki UA → 200. 403 zinciri: CIK haritası yok → secFetchModel null
//     → fa.score null → tam:false → _onbellek.js hiç yazmıyor → her istek
//     12-14 sn. FA üretimde komple devre dışıydı.
//   2026-10-25 (bu geliştirme makinesi, 5 istek): eski UA → 403 · 403 · 403
//     (3/3), aşağıdaki UA → 200 · 200 (2/2). Bir ara ölçümde eski UA'nın bir
//     kez 200 verdiği görüldü ama TEKRAR ETMEDİ; SEC WAF'ının kararı tam
//     kararlı değil. Yine de: geliştirme makinesinde "200 gördüm" demek
//     üretimde çalışacağı anlamına GELMEZ — kanıt üretim ölçümüdür.
//
// `https://data.sec.gov/files/company_tickers.json` → 404, alternatif yol YOK.
// Kullanıcının kişisel e-posta adresi buraya ASLA konmaz; aşağıdaki adres
// projenin kendi alan adında genel bir iletişim adresi. api/proxy.js aynı
// dizeyi kullanıyor — ikisi birlikte değişir. Değiştirmeden önce YENİDEN ÖLÇ.
export const UA_SEC = 'SabahBulteni/1.0 (+https://day-starter.vercel.app; iletisim@day-starter.vercel.app)';

// Yahoo ve İş Yatırım tarayıcı başlığı bekliyor.
export const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// SEC hız sınırı 10 istek/sn. Bu, istek BAŞLANGIÇLARI arasındaki asgari
// aralık; 125 ms ≈ 8/sn. Not: motor secBatches ile 6 isteği eşzamanlı
// başlatıyor — sıraya sokulan şey isteğin SÜRESİ değil, başlama ANI.
export const SEC_ARALIK_MS = 125;

// ---------------------------------------------------------------------
//  SÜRE TAVANI — tek sayı yeri, üç uca KOPYALANMAZ.
//
//  AÇIK NASIL ÖLÇÜLDÜ: tests/duman.mjs (canlı, bozuk ağ) ve ardından
//  tests/sure.mjs (belirlenimci, kara delik ağ) aynı sayıyı verdi —
//  AAPL+ASELS.IS için TEK ÇAĞRI 76,0 sn (canlıda 76,3). `BUTCE_MS` freni
//  `tam:false` döndürdü ama süre `maxDuration` 60'ı aştı: Vercel lambda'yı
//  KESER, istemci gövdesiz bir 504 görür. Üç ucun da açığıydı.
//
//  SEBEP: `BUTCE_MS` yalnız SEMBOLLER ARASINDA bakılıyordu. Sembol
//  İÇİNDEKİ her isteğin kendi zaman aşımı vardı (yahooMs/secMs/isMs) ama
//  TOPLAMINA üst sınır yoktu — 4 Yahoo + 1 SEC (×2 deneme) + 3 İş Yatırım
//  isteği, her biri kendi 7-10 sn'sini sonuna kadar yiyerek 76 sn etti.
//  Ölçümde BUTCE_MS hiç DEVREYE GİRMEDİ (`atlanan: []`): ikinci sembole
//  başlanırken 45 sn henüz geçmemişti, ama o sembol tek başına 36 sn daha
//  yedi. Yani semboller arası bir fren, sembol içi bir taşmayı göremez.
//
//  NİYE BURADA: tur durumu (sayaç, `birKez` haritası, SEC sırası) bu
//  dosyada yaşıyor ve TEK ağ çıkışı burası. Tavan başka yere konsaydı
//  (örn. uçlara) ya üç kopya olurdu ya da isteği gerçekten kesemezdi —
//  kesen şey `cek()`in zaman aşımı ve o burada.
//
//  TUR_BUTCE_MS 45000 — SEMBOLLER ARASI fren: yeni bir sembole başlamadan
//  önce bakılır, dolmuşsa sembol `atlanan`a düşer. Değer DEĞİŞMEDİ, yalnız
//  üç uçtan buraya TAŞINDI (uçlar artık `butceDoldu()` çağırıyor, sayı
//  taşımıyor).
//
//  TUR_TAVAN_MS 50000 — MUTLAK SON TARİH: tur başından itibaren. Dolduktan
//  sonra hiçbir istek ağda BEKLEMEZ; sembolün ORTASINDA da durur. Niye 50
//  ve niye BUTCE'den büyük:
//    · maxDuration 60 (üç ucun `config`i). Tavan 60 olsaydı tavana çarpan
//      istek tam kesilme anında dönerdi; serileştirmeye vakit kalmazdı.
//    · Tavandan SONRA yapılacak iş saf HESAP: eldeki mumlarla
//      computeVadeScore + bütüncül katman + JSON. ÖLÇÜLDÜ (duman.mjs, tek
//      ABD sembolü): 7,2 sn'nin ~3,9 sn'si ağ BEKLEMESİ → hesap payı
//      ~3,3 sn. 50 + 3,3 ≈ 53 sn, 60'a ~7 sn marj.
//    · BUTCE (45) < TAVAN (50) BİLEREK: 45'ten sonra yeni sembole hiç
//      başlanmıyor, yani son 5 sn yalnız BAŞLAMIŞ sembolün toparlanmasına
//      kalıyor. İki sayı eşit olsaydı 45. sn'de başlayan bir sembol anında
//      tavana çarpar ve boşuna bir `kesinti` turu üretirdi.
//  ÖLÇÜLEN SONUÇ (tests/sure.mjs, aynı kara delik ağ): 76,0 sn → 50,1 sn.
//
//  TAVANA ÇARPMAK ARIZA DEĞİL: fren işini yapıyor. Uç YİNE 200 döner,
//  etkilenen sembol `tam:false` olur (= "ölçemedim"). Bu, `score:null` +
//  `tam:true` ("ölçtüm, o şirkette o kalem yok") ile KARIŞTIRILMAMALI.
//  Sayaç ayrımı korunuyor: 404 = `yok` (veri cevabı), tavan = `kesinti`.
export const TUR_BUTCE_MS = 45000;
export const TUR_TAVAN_MS = 50000;

// Tavana bu kadar az kalmışsa ağa HİÇ çıkılmaz. Niye bir taban var: 20 ms
// kalmışken istek açmak neredeyse kesin bir zaman aşımı demek — uzak tarafı
// boşuna yorar, soket açar, sonra iptal eder. 250 ms ölçülmüş bir RTT değil,
// bir eşik; ölçülen şey şu: SEC'in en hızlı cevabı bile bunun altında
// gelmiyor (SEC_ARALIK_MS 125 ms zorunlu bekleme zaten var).
const ASGARI_ISTEK_MS = 250;

// secGet `base + encodeURIComponent(url)` kuruyor; kabuk bu öneki soyup
// gerçek adrese gidiyor. Motorun `if (!base) return null` satırı yüzünden
// BOŞ OLAMAZ.
export const SEC_ONEK = 'sec:';

/** Yahoo chart başlıkları. */
export function yahooBaslik() {
  return { 'User-Agent': UA_WEB, Accept: 'application/json' };
}

/** SEC başlıkları — yalnız UA. Fazlası gerekmiyor (ölçüldü). */
export function secBaslik() {
  return { 'User-Agent': UA_SEC };
}

/**
 * İş Yatırım MaliTablo başlıkları. Uç nokta doğrudan çalışıyor ama tarayıcı
 * başlıkları + Referer ŞART (ölçüldü: HTTP 200, 27 KB). Referer şirket
 * koduna göre kurulur; kod bulunamazsa kök adres.
 */
export function isYatirimBaslik(url) {
  const cc = /companyCode=([A-Z0-9]+)/i.exec(String(url));
  return {
    'User-Agent': UA_WEB,
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: cc
      ? 'https://www.isyatirim.com.tr/tr-tr/analiz/hisse/Sayfalar/sirket-karti.aspx?hisse=' + cc[1]
      : 'https://www.isyatirim.com.tr/',
  };
}

// Motorun çıkabileceği TEK adres kümesi. Motor adresleri kendi şablonundan
// kuruyor (sembol encodeURIComponent'li) — yani bugün kullanıcı girdisiyle
// konak değiştirilemiyor. Liste yine de duruyor: bir dilim yarın başka bir
// yere uzanırsa bunu SESSİZCE değil, patlayarak öğrenmek istiyoruz.
const IZINLI = [
  'https://query1.finance.yahoo.com/',
  'https://query2.finance.yahoo.com/',
  'https://www.sec.gov/',
  'https://data.sec.gov/',
  'https://www.isyatirim.com.tr/',
];
const izinli = (u) => IZINLI.some((p) => String(u).startsWith(p));

// ---------------------------------------------------------------------
//  SAYAÇ — BAGIMLILIK_GRAFIGI.md §5.4'ün cevabı.
//
//  Ölçüldü: gerçekten olmayan bir us-gaap etiketi SEC'ten temiz 404 döner.
//  Yani 404 bir VERİ CEVABIDIR ("bu şirkette o kalem yok"), taşıma hatası
//  değil. secGet ikisini de `null` yapıyor; motor farkı göremez.
//  → Farkı KABUK tutuyor:
//        yok     = 404                                   → veri cevabı
//        kesinti = 5xx / 429 / 403 / zaman aşımı / taşıma → ÖLÇEMEDİM
//  Uç nokta bunu cevapta açıkça söylüyor, böylece istemci "düşük skor" ile
//  "ölçemedim"i ayırt edebiliyor. Skorun kendisi değişmiyor: sayaç yalnız
//  GÖZLEMCİ, motora tek bir sayı dahi geçirmiyor.
// ---------------------------------------------------------------------
export function bosSayac() {
  return {
    yahoo: { istek: 0, kesinti: 0 },
    sec: { istek: 0, yok: 0, kesinti: 0 },
    bist: { istek: 0, kesinti: 0 },
    tekrar: 0, // aynı adres ikinci kez istendi → ağa çıkılmadı
  };
}

/** Skor eksiksiz mi? Kesinti varsa HAYIR. 404'ler sorun değil. */
export function sayacTam(s) {
  return s.yahoo.kesinti === 0 && s.sec.kesinti === 0 && s.bist.kesinti === 0;
}

function yeniTurDurumu(butceMs, tavanMs) {
  const genel = bosSayac();
  const t0 = Date.now();
  return {
    genel,
    aktif: genel,    // handler sembol başına odaklar
    uc: new Map(),   // adres → gövde sözü (aynı turda ikinci kez ağa çıkma)
    secSonra: 0,     // sıradaki SEC isteğinin en erken başlama anı
    t0,                          // turun başlangıç anı
    butce: t0 + butceMs,         // semboller arası fren
    sonTarih: t0 + tavanMs,      // mutlak son tarih (sembol içinde de durur)
  };
}

// ---------------------------------------------------------------------
//  Sahte yanıt: motor yalnız .ok / .status / .text() / .json() kullanıyor.
//  Gövdeyi BURADA tamponluyoruz — gerçek Response gövdesi bir kez okunur,
//  tekrar isteyen ikinci çağrıya aynı Response verilemez.
// ---------------------------------------------------------------------
const yanit = (ok, status, txt) => ({
  ok,
  status,
  text: async () => txt,
  json: async () => JSON.parse(txt),
});

async function cek(url, { headers, ms, signal }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  // Motorun kendi AbortSignal'i varsa ona da bağlan: iptal aşağı akmalı.
  const kopru = signal ? () => ctl.abort() : null;
  if (kopru) {
    if (signal.aborted) ctl.abort();
    else signal.addEventListener('abort', kopru, { once: true });
  }
  try {
    const r = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' });
    const txt = await r.text();
    return { ok: r.ok, status: r.status, txt };
  } finally {
    clearTimeout(t);
    if (kopru) signal.removeEventListener('abort', kopru);
  }
}

/**
 * Canlı ağ kabuğu + motor konağı.
 *
 * Konak MODÜL DÜZEYİNDE bir kez kurulup motora verilir (api/score.js öyle
 * yapıyor) — bu sayede motorun kapanışındaki secCikMap ve secModelCache
 * sıcak lambda'da yaşar. Tur durumu (sayaç, tekrar haritası) bu yüzden
 * DEĞİŞTİRİLEBİLİR: `yeniTur()` her istekte sıfırlar. Vercel Node işlevi bir
 * örnek içinde istekleri sırayla koşturuyor; api/yfin.js'in crumb önbelleği
 * de aynı varsayıma dayanıyor.
 *
 * @param {object} opt
 * @param {object} opt.taWeights   config.js TA_WEIGHTS (api/_ayar.js'ten)
 * @param {object} opt.taBenchmark config.js TA_BENCHMARK
 * @param {number} [opt.yahooMs=10000] Yahoo isteği zaman aşımı
 * @param {number} [opt.secMs=10000]   SEC isteği üst sınırı (motorun sinyali daha kısa olabilir)
 * @param {number} [opt.isMs=7000]     İş Yatırım ÜST SINIRI. Motor 15000 istiyor
 *   ama fetchIsYatirimMali 3 yılı SIRAYLA deniyor → 3 × 15 sn = 45 sn, bütçeyi
 *   aşar. Motor üretilmiş ve elle düzenlenemez; kısıntı bu yüzden konakta,
 *   çünkü `fetchVia` konağın kendi işlevi.
 */
export function canliAg(opt = {}) {
  const yahooMs = opt.yahooMs ?? 10000;
  const secMs = opt.secMs ?? 10000;
  const isMs = opt.isMs ?? 7000;
  // Varsayılanlar YUKARIDAKİ TEK sayı yerinden. Opsiyon yalnız ÖLÇÜM için
  // var: tests/uc-test.mjs ⑦ bölümü tavanı milisaniyelere küçültüp freni
  // saniyenin altında sınıyor (üretim sabitleriyle o test 50 sn sürerdi ve
  // kapı dörtlüsüne girmezdi). Üretimde hiçbir uç bu iki opsiyonu GEÇMİYOR.
  const butceMs = opt.butceMs ?? TUR_BUTCE_MS;
  const tavanMs = opt.tavanMs ?? TUR_TAVAN_MS;
  let tur = yeniTurDurumu(butceMs, tavanMs);

  const say = (yol, alan) => {
    tur.genel[yol][alan]++;
    if (tur.aktif !== tur.genel) tur.aktif[yol][alan]++;
  };
  const sayTekrar = () => {
    tur.genel.tekrar++;
    if (tur.aktif !== tur.genel) tur.aktif.tekrar++;
  };

  // Aynı turda aynı adres: ağa bir kez çıkılır. Gerçek kazanç endeks
  // mumları — her ABD sembolü ^GSPC'nin 5 yıllık serisini istiyor, dört
  // sembol dört kere indirirdi. Başarısız söz haritada TUTULMAZ: geçici
  // bir kesinti turun kalanını zehirlememeli.
  const birKez = (anahtar, isle) => {
    const v = tur.uc.get(anahtar);
    if (v) { sayTekrar(); return v; }
    const p = isle();
    tur.uc.set(anahtar, p);
    p.catch(() => { if (tur.uc.get(anahtar) === p) tur.uc.delete(anahtar); });
    return p;
  };

  // ---------------------------------------------------------------------
  //  SÜRE PENCERESİ — her isteğin ÖNÜNDE duran kapı.
  //
  //  Dönen: isteğe verilecek zaman aşımı (ms), ya da 0 = "tavan doldu, ağa
  //  ÇIKMA". İki iş birden yapıyor:
  //    ① KISITLAMA: isteğin kendi zaman aşımı tavandan BÜYÜK olamaz. 48.
  //       sn'de başlayan bir SEC isteği 10 sn değil, 2 sn bekler.
  //    ② KESME: tavan dolduysa (ya da ASGARI_ISTEK_MS'ten az kaldıysa) hiç
  //       başlamaz. Sembolün ORTASINDA duran fren tam olarak budur —
  //       fetchIsYatirimMali'nin kalan yılları, secBatches'in kalan
  //       istekleri anında düşer.
  //  Her iki halde de sayaç `kesinti` der: ölçemedik. Sessiz sıfır YOK.
  // ---------------------------------------------------------------------
  const kalanMs = () => tur.sonTarih - Date.now();
  const pencere = (ms) => {
    const k = kalanMs();
    if (k < ASGARI_ISTEK_MS) return 0;
    return Math.min(ms, k);
  };

  // SEC sırası: istek BAŞLANGIÇLARINI aralıkla, eşzamanlılığı bozmadan.
  // Bekleme de tavanı aşamaz: 125 ms'lik nezaket beklemesi, son tarihin
  // ötesine geçmek için bir gerekçe değil.
  const secSiraya = async () => {
    const now = Date.now();
    const t = Math.max(now, tur.secSonra);
    tur.secSonra = t + SEC_ARALIK_MS;
    if (t > now) await bekle(Math.min(t - now, Math.max(0, tur.sonTarih - now)));
  };

  async function secIstek(gercek, signal) {
    say('sec', 'istek');
    // İki deneme: motorun 12 sn'lik sinyali içinde kalacak kadar.
    for (let i = 0; i < 2; i++) {
      if (!pencere(secMs)) break;              // tavan doldu → ikinci denemeyi açma
      if (i) { await bekle(400); }
      await secSiraya();
      const ms = pencere(secMs);               // bekleme sonrası YENİDEN: süre aktı
      if (!ms) break;
      try {
        const r = await cek(gercek, { headers: secBaslik(), ms, signal });
        if (r.status === 404) { say('sec', 'yok'); return yanit(false, 404, ''); } // VERİ cevabı
        if (!r.ok) continue;                                                       // 429/5xx → dene
        return yanit(true, r.status, r.txt);
      } catch { /* zaman aşımı / taşıma → dene */ }
    }
    say('sec', 'kesinti');
    return yanit(false, 599, ''); // secGet bunu null'a çevirir; gerçeği sayaç söyler
  }

  async function yahooIstek(url) {
    say('yahoo', 'istek');
    const ms = pencere(yahooMs);
    if (!ms) {
      say('yahoo', 'kesinti');
      // fetchYahooOHLC çağrıları try/catch içinde; atış `why` metnine düşer.
      throw new Error('sure tavani');
    }
    try {
      const r = await cek(url, { headers: yahooBaslik(), ms });
      if (!r.ok) { say('yahoo', 'kesinti'); return yanit(false, r.status, r.txt); }
      return yanit(true, r.status, r.txt);
    } catch (e) {
      say('yahoo', 'kesinti');
      throw e; // fetchYahooOHLC çağrıları zaten try/catch içinde
    }
  }

  // --- motora verilen ağ kabuğu: fetchYahooOHLC + secGet buraya düşer ---
  const agFetch = async (url, o = {}) => {
    const s = String(url);
    if (s.startsWith(SEC_ONEK)) {
      const gercek = decodeURIComponent(s.slice(SEC_ONEK.length));
      if (!izinli(gercek)) throw new Error('izinli olmayan SEC adresi: ' + gercek);
      return birKez('SEC ' + gercek, () => secIstek(gercek, o.signal));
    }
    if (!izinli(s)) throw new Error('izinli olmayan adres: ' + s);
    return birKez('Y ' + s, () => yahooIstek(s));
  };

  // --- İş Yatırım: METİN döndürmek ZORUNDA (motor kendisi JSON.parse ediyor) ---
  const agFetchVia = async (url, o = {}) => {
    const s = String(url);
    if (!izinli(s)) throw new Error('izinli olmayan adres: ' + s);
    const istenen = Math.min(o.timeout ?? isMs, isMs);
    return birKez('IS ' + s, async () => {
      say('bist', 'istek');
      // fetchIsYatirimMali üç yılı SIRAYLA deniyor (3 × 7 sn = 21 sn). Tavan
      // dolduysa kalan yıllar anında düşer — sembol içi fren burada görünür.
      const ms = pencere(istenen);
      if (!ms) { say('bist', 'kesinti'); throw new Error('sure tavani'); }
      let r;
      try {
        r = await cek(s, { headers: isYatirimBaslik(s), ms });
      } catch (e) {
        say('bist', 'kesinti');
        throw e; // fetchIsYatirimMali yakalar → sıradaki yılı dener
      }
      if (!r.ok) { say('bist', 'kesinti'); throw new Error('HTTP ' + r.status); }
      if (!r.txt || r.txt.length <= 50) { say('bist', 'kesinti'); throw new Error('bos yanit'); }
      return r.txt;
    });
  };

  // Motor dilimi ekrana uzanırsa adıyla patlasın. (tests/engine.mjs:122'de
  // test şeridinin ikizi var; ortaklaştırılmadı çünkü bu dört satır dış
  // dünyaya dair hiçbir şey bilmiyor — paylaşılacak bir ÖLÇÜM yok, bu
  // dosyanın konusu ise ölçülmüş ağ bilgisi.)
  const olenVekil = (ad) => new Proxy({}, {
    get(_t, k) { throw new Error('motor dilimi ekrana dokundu: ' + ad + '.' + String(k)); },
    set(_t, k) { throw new Error('motor dilimi ekrana yazdi: ' + ad + '.' + String(k)); },
  });

  const H = {
    window: {
      TA_WEIGHTS: opt.taWeights,
      TA_BENCHMARK: opt.taBenchmark,
      MY_PROXY: SEC_ONEK,
    },
    // getItem null → motor `JSON.parse(null) || {}` ile TÜM göstergeleri
    // açık sayar. Parite koşusu da aynısını yapıyor (tests/engine.mjs
    // taScoreInd verilmediğinde null geçiyor); buradan saparsak skor
    // sessizce değişir ve baseline.json'a karşı FARK doğar.
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: agFetch,
    fetchVia: agFetchVia,
    dead: olenVekil,
  };

  return {
    H,
    /**
     * Yeni istek: sayaçları, tekrar haritasını ve SÜRE SAATİNİ sıfırla.
     * Saatin burada başlaması bilinçli: tur durumu neyse, süre tavanı da
     * onun bir parçası. Uç noktanın ayrı bir `t0` tutup sayı taşıması
     * gerekmiyor — `butceDoldu()` soruyor, cevabı taşıyıcı veriyor.
     */
    yeniTur() { tur = yeniTurDurumu(butceMs, tavanMs); return tur.genel; },
    /** Sembol başına sayaç odağı; null ile genele dön. */
    odakla(s) { tur.aktif = s || tur.genel; },
    get genel() { return tur.genel; },
    /**
     * SEMBOLLER ARASI fren: yeni bir sembole başlamaya değer mi?
     * Üç uç bunu çağırıyor; eşik sayısı uçlarda DEĞİL, bu dosyada.
     */
    butceDoldu() { return Date.now() > tur.butce; },
    /** MUTLAK son tarihe kalan süre (ms, negatif olabilir). Ölçüm/tanı için. */
    kalanMs,
    /** Tavan doldu mu? Ölçüm/tanı için; cevaba bir alan EKLENMİYOR. */
    tavanDoldu() { return kalanMs() <= 0; },
  };
}
