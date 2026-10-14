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

// SEC: iletişim bilgisi İSTEMİYOR — e-postasız UA ölçülmüş HTTP 200 veriyor.
// Kullanıcının e-posta adresi buraya ASLA konmaz.
// Kuyruktaki "parite-testi" eki tarihsel; HTTP 200 aldığı ÖLÇÜLDÜ. Yeniden
// ölçmeden değiştirmeyin: UA değişimi uzak tarafın cevabını değiştirebilir.
export const UA_SEC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) sabah-bulteni-parite-testi';

// Yahoo ve İş Yatırım tarayıcı başlığı bekliyor.
export const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// SEC hız sınırı 10 istek/sn. Bu, istek BAŞLANGIÇLARI arasındaki asgari
// aralık; 125 ms ≈ 8/sn. Not: motor secBatches ile 6 isteği eşzamanlı
// başlatıyor — sıraya sokulan şey isteğin SÜRESİ değil, başlama ANI.
export const SEC_ARALIK_MS = 125;

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

function yeniTurDurumu() {
  const genel = bosSayac();
  return {
    genel,
    aktif: genel,    // handler sembol başına odaklar
    uc: new Map(),   // adres → gövde sözü (aynı turda ikinci kez ağa çıkma)
    secSonra: 0,     // sıradaki SEC isteğinin en erken başlama anı
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
  let tur = yeniTurDurumu();

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

  // SEC sırası: istek BAŞLANGIÇLARINI aralıkla, eşzamanlılığı bozmadan.
  const secSiraya = async () => {
    const now = Date.now();
    const t = Math.max(now, tur.secSonra);
    tur.secSonra = t + SEC_ARALIK_MS;
    if (t > now) await bekle(t - now);
  };

  async function secIstek(gercek, signal) {
    say('sec', 'istek');
    // İki deneme: motorun 12 sn'lik sinyali içinde kalacak kadar.
    for (let i = 0; i < 2; i++) {
      if (i) { await bekle(400); }
      await secSiraya();
      try {
        const r = await cek(gercek, { headers: secBaslik(), ms: secMs, signal });
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
    try {
      const r = await cek(url, { headers: yahooBaslik(), ms: yahooMs });
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
    const ms = Math.min(o.timeout ?? isMs, isMs);
    return birKez('IS ' + s, async () => {
      say('bist', 'istek');
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
    /** Yeni istek: sayaçları ve tekrar haritasını sıfırla. */
    yeniTur() { tur = yeniTurDurumu(); return tur.genel; },
    /** Sembol başına sayaç odağı; null ile genele dön. */
    odakla(s) { tur.aktif = s || tur.genel; },
    get genel() { return tur.genel; },
  };
}
