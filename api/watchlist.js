// Vercel KV-backed watchlist + portfolio sync endpoint
// GET    /api/watchlist?code=XYZ            -> { list: [...], portfolio: [...] }
// POST   /api/watchlist?code=XYZ  body=JSON  -> { ok: true }
//        body: { list: [...], portfolio: [...] }  (ikisi de opsiyonel)
//
// "code" kullanıcı tarafından seçilen sync anahtarı (örn. "atahan-7a2b").
// Aynı kodu farklı cihazlarda kullanırsan hem portföyün hem izleme listen senkron olur.
//
// YAZMA YOLUNDAKİ EK CEVAPLAR (sertleştirme; aşağıdaki blokta gerekçeler):
//   403 { error: 'origin_not_allowed' }  Origin başlığı var ama izinli değil
//   429 { error: 'rate_limit' }          istemci başına yazma kotası aşıldı
//   400 { error: 'weak_code', ... }      HENÜZ KAYDI OLMAYAN kod çok zayıf
// OKUMA (GET) sözleşmesi DEĞİŞMEDİ: var olan hiçbir kod kilitlenmedi.
//
// KURULUM:
// 1) Vercel dashboard → bu proje → Storage → Create Database → KV (Upstash)
// 2) Connect to project → env varlar otomatik gelir (KV_REST_API_URL, KV_REST_API_TOKEN, ...)
// 3) Redeploy

import { kv } from '@vercel/kv';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

const MAX_LIST_BYTES = 256 * 1024; // 256 KB — list/portfolio + tam `ui` durumu (listeler + karşılaştırma)

// =====================================================================
//  SERTLEŞTİRME (DEVAM.md §4 "bilinen onarılmamış arıza: /api/watchlist
//  kimlik doğrulaması yok — paylaşılan tahmin edilebilir `code`, yazma
//  dahil, CORS `*`")
//
//  NE YAPILDI: üç sertleştirme — (1) YENİ oluşturulan kodlar için
//  karakter çeşitliliği kapısı, (2) yazma isteklerinde istemci başına
//  hız sınırı, (3) CORS `*` yerine izinli kaynak listesi.
//
//  NE YAPILMADI — DÜRÜSTÇE: bu GERÇEK KİMLİK DOĞRULAMA DEĞİL. Supabase
//  auth FAZ 4 işi ve HİÇ BAŞLAMADI (DEVAM.md §4). Kodu bilen herkes
//  hâlâ okur ve yazar; CORS tarayıcı tarafı bir çittir, sunucu tarafı
//  bir yetki sınırı DEĞİLDİR (curl/native istemci Origin göndermez).
//  Buradaki üç madde yalnızca SALDIRI YÜZEYİNİ daraltıyor.
// =====================================================================

// --- (3) CORS izinli kaynak listesi ---------------------------------
//  ÖLÇÜLDÜ: üretim kaynağı `config.js:82` → `window.MY_PROXY =
//  'https://day-starter.vercel.app/api/proxy?url='`; istemcinin
//  `SYNC_BASE`i (app.js:2083) o adresten türüyor. DEVAM.md §7 aynı alan
//  adını gizlilik/destek URL'si olarak doğruluyor. Uydurulmadı.
const URETIM_KAYNAK = 'https://day-starter.vercel.app';

/**
 * Kaynak izinli mi.
 *  · Üretim alan adı: BİREBİR eşleşme.
 *  · Yerel laboratuvar: http://127.0.0.1:<port> ve http://localhost:<port>
 *    (port serbest; DEVAM.md §2 "localhost bu makinede çözülmüyor →
 *    127.0.0.1" — ikisi de kabul, hangisi kullanılırsa).
 *  · Başka her şey: ENGELLİ.
 *
 *  ÖNEK EŞLEŞMESİ KULLANILMADI: 'https://day-starter.vercel.app' öneki
 *  'https://day-starter.vercel.app.kotu.example' adresini de geçirirdi.
 *  Önizleme (preview) deploy'ları BİLEREK dışarıda: onların alan adı
 *  her deploy'da değişiyor ve ÖLÇÜLEMEZ bir kalıp (`*.vercel.app`)
 *  herhangi bir Vercel projesine kapı açardı.
 */
function kaynakIzinli(origin) {
  if (origin === URETIM_KAYNAK) return true;
  const yerel = /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/;
  return yerel.test(origin);
}

/**
 * CORS başlıkları. `*` KALDIRILDI.
 *  · İzinli kaynak → o kaynak yansıtılır (+ `Vary: Origin`, yoksa CDN
 *    bir istemcinin cevabını diğerine servis eder).
 *  · İzinsiz kaynak → Allow-Origin başlığı HİÇ KONMAZ; tarayıcı cevabı
 *    okumayı reddeder.
 *  · Origin başlığı YOK → başlık konmaz ve istek ENGELLENMEZ. Native
 *    fetch ve bildirim worker'ı (worker/poll.mjs) CORS kullanmaz;
 *    onları engellemek çalışan tek senkron yolunu kırardı.
 */
function setCORS(res, origin) {
  res.setHeader('Vary', 'Origin');
  if (origin && kaynakIzinli(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age',       '86400');
}

function validCode(c) {
  return typeof c === 'string' && /^[a-z0-9_\-]{4,40}$/i.test(c);
}

// --- (1) YENİ kodlar için karakter çeşitliliği kapısı ---------------
//  NE: KV'de HENÜZ KAYDI OLMAYAN bir kodla yazma denenirse, kod kısa ya
//  da tek düze olamaz.
//
//  NEDEN: `validCode` 4 karakteri geçiriyor — 'test', 'abcd' gibi kodlar
//  kaba kuvvetle bulunabilir ve o kaydı okumak/üzerine yazmak serbest.
//
//  ESKİ KULLANICI KİLİTLENMİYOR — ÖLÇÜLDÜ: kullanımdaki tek kod
//  `app.js:2082` → 'atahan-bulten-9f3c' (18 karakter, 13 ayrı karakter).
//  Bu kod kapıdan GEÇİYOR, yani ölçülebilen hiçbir mevcut kullanım
//  kırılmıyor. Üstelik kapı YALNIZ yazmada ve YALNIZ kaydı olmayan kodda
//  basıyor: OKUMA (GET) hiç kısıtlanmadı ve VAR OLAN bir kayda yazma da
//  kısıtlanmadı — yani KV'de kaydı olan eski/kısa bir kod bundan sonra da
//  aynen çalışır.
//
//  DÜRÜSTLÜK: bu "entropi" DEĞİL, karakter ÇEŞİTLİLİĞİ. Gerçek tahmin
//  direnci (kullanıcının seçtiği sözcüklerin sözlük saldırısına
//  dayanıklılığı) ÖLÇÜLMEDİ ve bu kapı onu ölçmüyor. Gerçek çözüm
//  sunucunun ürettiği rastgele kod ya da kimlik doğrulama (FAZ 4).
const MIN_NEW_CODE_LEN   = 16;
const MIN_NEW_CODE_CHARS = 10;

function strongEnoughCode(c) {
  const s = String(c).toLowerCase();
  if (s.length < MIN_NEW_CODE_LEN) return false;
  return new Set(s).size >= MIN_NEW_CODE_CHARS;
}

// --- (2) Yazma isteklerinde istemci başına hız sınırı ---------------
//  NE: aynı istemci (IP) bir pencerede en çok `HIZ_TAVAN` yazma yapar.
//  Aşarsa 429 + makine kodu.
//
//  NEDEN: yazma yolu KV'ye kayıt BAŞINA 256 KB'a kadar gövde koyuyor ve
//  kimlik doğrulama YOK. Kod tahmin eden biri sınırsız üzerine yazabilir
//  (veri kaybı) ya da rastgele kodlarla KV'yi doldurabilir (maliyet).
//  OKUMA sınırlanmadı: okuma yıkıcı değil ve senkron açılışta okuyor.
//
//  BU SAYI BİR ÜRÜN AYARI, SKOR EŞİĞİ DEĞİL (HAM SAYI KURALI skor
//  matematiği içindir; bu sayı hiçbir hesaba girmiyor, gövdeye de
//  girmiyor). Gerekçe: istemci yazmayı 1200 ms geciktirmeli bir zamanlayıcı
//  ile yapıyor (`app.js` scheduleWatchlistSync) → bir dakikada insan
//  kullanımıyla 30 yazma olası değil; tavan insanın ÜSTÜNDE, döngünün
//  ALTINDA.
//
//  DÜRÜSTLÜK — SINIR MUTLAK DEĞİL (ÖLÇÜLMEDİ, mimariden biliniyor):
//  sayaç BELLEK İÇİ, Vercel'de her örnek kendi belleğini taşır ve süreç
//  ömrü kısa. En kötü durumda sınır ÖRNEK BAŞINA geçerlidir; soğuk
//  başlangıç sayacı sıfırlar. Küresel kota paylaşılan bir sayaç (KV)
//  ister — BU GÖREVDE YAPILMADI.
//
//  `api/_onbellek.js` KULLANILAMADI: o taşıyıcı KV tabanlı, bellek içi
//  sayaç yüzeyi YOK ve bu şeridin sahipliğinde değil. Sayaç bu yüzden
//  `api/theme.js` ile AYNI biçimde, ama AYRI AYRI ve KISA yazıldı; yeni
//  `api/` dosyası AÇILMADI (Vercel Hobby 12 fonksiyon tavanı).
const HIZ_PENCERE_MS   = 60000;
const HIZ_TAVAN        = 30;
const HIZ_AZAMI_GIRDI  = 500;
const _hizSayac = new Map();

// IP ASLA loglanmıyor ve gövdeye girmiyor (gizlilik). Başlık yoksa
// 'bilinmeyen' kovası paylaşılır — kimliği ölçemediğimizde sınırsız
// bırakmak frenin kendisini iptal ederdi.
function istemciKimligi(req, rota) {
  const h = (req && req.headers) || {};
  const xff = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xff
    || String(h['x-real-ip'] || '').trim()
    || String((req && req.socket && req.socket.remoteAddress) || '').trim()
    || 'bilinmeyen';
  return rota + '|' + ip;
}

function hizAsildi(kimlik, simdi = Date.now()) {
  if (_hizSayac.size > HIZ_AZAMI_GIRDI) {
    for (const [k, v] of _hizSayac) if (v.bitis <= simdi) _hizSayac.delete(k);
  }
  const kayit = _hizSayac.get(kimlik);
  if (!kayit || kayit.bitis <= simdi) {
    _hizSayac.set(kimlik, { sayi: 1, bitis: simdi + HIZ_PENCERE_MS });
    return false;
  }
  kayit.sayi += 1;
  return kayit.sayi > HIZ_TAVAN;
}

// Hem izleme listesi hem portföy aynı şemayı kullanır: { symbol, market, query }
function cleanList(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const symbol = String(it.symbol || '').toUpperCase().slice(0, 8);
    const market = String(it.market || '').toUpperCase();
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(symbol)) continue;
    if (market !== 'BIST' && market !== 'US') continue;
    const query = String(it.query || symbol).slice(0, 64);
    out.push({ symbol, market, query });
  }
  return out;
}

export default async function handler(req, res) {
  const origin = String((req.headers && req.headers.origin) || '');
  setCORS(res, origin);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const code = (req.query?.code || '').trim();
  if (!validCode(code)) {
    res.status(400).json({ error: 'Invalid code. 4-40 chars, [a-z0-9_-].' });
    return;
  }
  const key = `wl:${code.toLowerCase()}`;

  try {
    if (req.method === 'GET') {
      const data = await kv.get(key);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        list: data?.list || [],
        portfolio: data?.portfolio || [],
        // `ui` = tam arayüz durumu (listeler + karşılaştırma); cihazlar arası senkron için.
        // Worker bunu yok sayar; yalnızca uygulama okur.
        ui: data?.ui || null,
        updatedAt: data?.updatedAt || null,
      });
      return;
    }

    if (req.method === 'POST') {
      // YAZMA KAPILARI — üçü de yalnız POST'ta. Okuma yolu dokunulmadı.

      // (3b) Sunucu tarafı kaynak çiti: YIKICI yol için CORS'u tarayıcıya
      // bırakmıyoruz. Origin VARSA izinli olmalı; Origin YOKSA geçer
      // (native fetch / worker CORS kullanmaz, onları engellemek çalışan
      // senkronu kırardı — bu yüzden bu çit kimlik doğrulama DEĞİL).
      if (origin && !kaynakIzinli(origin)) {
        res.status(403).json({ error: 'origin_not_allowed' });
        return;
      }

      // (2) Hız sınırı — yazma başına. Gövde yalnız makine kodu; IP,
      // sayaç ve tavan hakkında hiçbir şey sızdırılmıyor.
      if (hizAsildi(istemciKimligi(req, 'wl-yaz'))) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(429).json({ error: 'rate_limit' });
        return;
      }

      // (1) YENİ kod kapısı: kod zayıfsa, KV'de KAYDI VAR MI diye bak.
      // Kayıt varsa ESKİ kullanıcıdır → geçer (kilitleme yok). Kayıt
      // yoksa yeni oluşturmadır → reddedilir. KV okuması YALNIZ zayıf
      // kod yolunda yapılıyor; güçlü kod fazladan tur ödemiyor.
      if (!strongEnoughCode(code)) {
        const varOlan = await kv.get(key);
        if (!varOlan) {
          res.status(400).json({
            error: 'weak_code',
            minLength: MIN_NEW_CODE_LEN,
            minDistinctChars: MIN_NEW_CODE_CHARS,
          });
          return;
        }
      }

      // Vercel Node runtime — body otomatik parse edilir (Content-Type application/json ise)
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      if (!body || (!Array.isArray(body.list) && !Array.isArray(body.portfolio))) {
        res.status(400).json({ error: 'Body must include { list: [...] } and/or { portfolio: [...] }' });
        return;
      }
      const clean   = cleanList(body.list);
      const cleanPf = cleanList(body.portfolio);
      const payload = { list: clean, portfolio: cleanPf, updatedAt: Date.now() };
      // `ui` = uygulamanın tam durumu (listeler + karşılaştırma). Düz nesneyse olduğu gibi
      // sakla; genel boyut sınırı (MAX_LIST_BYTES) zaten tavan koyuyor. Worker bunu okumaz.
      if (body.ui && typeof body.ui === 'object' && !Array.isArray(body.ui)) {
        payload.ui = body.ui;
      }
      const size = Buffer.byteLength(JSON.stringify(payload), 'utf8');
      if (size > MAX_LIST_BYTES) {
        res.status(413).json({ error: 'List too large' });
        return;
      }
      await kv.set(key, payload);
      res.status(200).json({ ok: true, count: clean.length, portfolioCount: cleanPf.length, updatedAt: payload.updatedAt });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
