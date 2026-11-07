// =====================================================================
//  /api/bildirim — NATIVE PUSH JETON KAYIT DEFTERİ + GÖNDERİM KAPISI
//                                            (taşıyıcı · ELLE YAZILMIŞTIR)
// ---------------------------------------------------------------------
//  NE: üç iş yapıyor.
//   (1) KAYIT   — `POST ?code=` · telefon kendi Expo push jetonunu yazar.
//   (2) DURUM   — `GET  ?code=` · o kodun altında KAÇ cihaz kayıtlı.
//   (3) GÖNDERİM— `POST ?code=&mod=gonder` · sırrı bilen işçi (worker/)
//                 bir bildirimi o koddaki TÜM cihazlara yollar.
//
//  NEDEN GEREKLİ: bildirimler bugüne kadar `ntfy.sh` üzerinden gidiyordu
//  (`worker/poll.mjs`). ntfy ayrı bir uygulama ve ayrı bir abonelik —
//  kullanıcı bildirimi KENDİ uygulamasında görmek istiyor. Expo push
//  servisi bunun karşılığı, ama CİHAZ JETONU gerektiriyor; jetonun bir
//  yerde durması lazım. Burası o yer.
//
//  NEDEN YENİ `api/*.js` DOSYASI DEĞİL: Vercel Hobby planı bir deploy'a
//  en fazla 12 serverless fonksiyon alıyor ve 12 DOLU (⑰b kilitliyor).
//  Bu dosya `_` önekli — rotaya çevrilmez, fonksiyon SAYILMAZ. `/api/bildirim`
//  yolu `vercel.json` rewrite'ı ile `/api/proxy?__rota=bildirim`e gidiyor,
//  `api/proxy.js` de `yfin` ile AYNI kalıpta buraya devrediyor.
//
//  NEDEN `TASIYICILAR` TABLOSUNA GİRMEDİ (ölçülmüş gerekçe): o tablodaki
//  on rotanın HEPSİ salt-okuma GET uçları ve `tests/uc-test.mjs` ⑰d her
//  biri için "POST → 405" KİLİDİ koyuyor (satır ~6272). Bu uç POST ile
//  YAZIYOR; o tabloya girse ⑰d'yi kırardı ya da ⑰d'ye ayrıcalık
//  yazılması gerekirdi. `yfin` kalıbı (proxy.js:135, ayrı dal) bu uca
//  doğru olan; yeni kapı ⑱'de ayrıca kilitlendi.
//
//  NEDEN AYRI KV ANAHTARI (`push:<kod>`, `wl:<kod>` DEĞİL) — ÖLÇÜLDÜ:
//  `api/watchlist.js:282` kaydı `kv.set(key, payload)` ile KOMPLE EZİYOR
//  (satır 271'deki `payload` yalnız `list`/`portfolio`/`updatedAt`
//  taşıyor; `ui` bile ancak gövdede geldiyse geri konuyor). Jetonlar
//  `wl:<kod>` içine konsa, telefon listesini her senkronladığında
//  JETONLAR SİLİNİRDİ ve bildirimler sessizce susardı. Ayrı anahtar bu
//  yarışı kökünden kaldırıyor; `api/watchlist.js`e DOKUNULMADI.
//
//  JETON GERİ DÖNDÜRÜLMEZ — hiçbir yolda. `GET` yalnız SAYI veriyor.
//  Gerekçe: uçta kimlik doğrulama YOK (`api/watchlist.js` kendi notunda
//  dürüstçe söylüyor), kod tahmin eden biri jeton listesini okuyabilse
//  o cihazlara DOĞRUDAN bildirim atabilirdi. Sayı sızarsa zarar yok.
//
//  SIR LOGLANMAZ: `PUSH_SECRET` ne tam, ne kısmi, ne uzunluğu olarak
//  hiçbir yere yazılmıyor; cevap gövdesine de girmiyor.
//
//  HESAP YOK: bu dosyada eşik/ağırlık/formül yok, skor üretilmiyor.
//  Taşınan tek Türkçe alan `uyari` değil — bildirim metni ÇAĞIRANIN
//  (işçinin) yazdığı metin, burada ÜRETİLMİYOR.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { kv } from '@vercel/kv';

export const ROTA = 'bildirim';

/** Expo push servisinin toplu gönderim ucu. Sabit, istemciden GELMEZ. */
export const IZINLI_KONAK = Object.freeze(['exp.host']);
const EXPO_UC = 'https://exp.host/--/api/v2/push/send';

/** Bir kodun altında en çok bu kadar cihaz. İnsan kullanımının üstünde. */
export const AZAMI_JETON = 10;
/** Expo tek istekte 100 jeton alıyor; tavanımız 10, yine de bölüyoruz. */
const EXPO_PARCA = 100;
const EXPO_ZAMAN_ASIMI_MS = 10000;

// --- hız sınırı — `api/watchlist.js` ile AYNI biçim, AYRI sayaç -------
//  DÜRÜSTLÜK: sayaç BELLEK İÇİ. Vercel'de her örnek kendi belleğini
//  taşır, soğuk başlangıç sıfırlar → sınır EN KÖTÜ DURUMDA ÖRNEK BAŞINA
//  geçerli. Küresel kota paylaşılan sayaç (KV) ister, BU GÖREVDE
//  YAPILMADI. Bu sayılar ürün ayarı, skor eşiği DEĞİL.
const HIZ_PENCERE_MS  = 60000;
const HIZ_TAVAN       = 20;
const HIZ_AZAMI_GIRDI = 500;
const _hizSayac = new Map();

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

// --- doğrulama -------------------------------------------------------

/** `api/watchlist.js:92` `validCode` ile BİREBİR aynı kural. */
export function kodGecerli(c) {
  return typeof c === 'string' && /^[a-z0-9_\-]{4,40}$/i.test(c);
}

/**
 * Expo jeton biçimi. İKİ biçim de geçerli (Expo SDK ikisini de üretiyor):
 *   ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 *   ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 * İç kısım Expo'nun kendi gövdesi — ŞEKLİNİ dar bir desene SOKMUYORUZ
 * (ölçülmedi), yalnız uzunluk ve zararsız karakter kümesi tutuluyor.
 */
export function jetonGecerli(t) {
  return typeof t === 'string'
    && /^Expo(nent)?PushToken\[[A-Za-z0-9_\-]{10,120}\]$/.test(t);
}

const IZINLI_PLATFORM = Object.freeze(['ios', 'android']);
export function platformSuz(p) {
  const s = String(p || '').toLowerCase();
  return IZINLI_PLATFORM.includes(s) ? s : null;
}

export function anahtar(kod) {
  return `push:${String(kod).toLowerCase()}`;
}

/**
 * Jeton listesini BİRLEŞTİRİR — üzerine YAZMAZ.
 *  · Aynı jeton ikinci kez gelirse kayıt TAZELENİR, kopya eklenmez.
 *  · Tavan aşılırsa EN ESKİ kayıt düşer (cihaz değiştiren kullanıcı yeni
 *    cihazını kaybetmesin; eski jeton zaten Expo'da ölü olacak).
 * SAF fonksiyon: ağ/KV yok, ⑱ bunu doğrudan sınıyor.
 */
export function jetonBirlestir(eski, yeni, simdi = Date.now()) {
  const liste = Array.isArray(eski) ? eski.filter((x) => x && jetonGecerli(x.token)) : [];
  const kalan = liste.filter((x) => x.token !== yeni.token);
  kalan.push({ token: yeni.token, platform: yeni.platform, ts: simdi });
  kalan.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return kalan.slice(-AZAMI_JETON);
}

// --- CORS ------------------------------------------------------------
//  `api/watchlist.js` ile AYNI gerekçe: Origin YOKSA engellenmez (native
//  fetch ve işçi Origin göndermez), Origin VARSA izinli olmalı.
const URETIM_KAYNAK = 'https://day-starter.vercel.app';

export function kaynakIzinli(origin) {
  if (origin === URETIM_KAYNAK) return true;
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/.test(origin);
}

function setCORS(res, origin) {
  res.setHeader('Vary', 'Origin');
  if (origin && kaynakIzinli(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // `x-push-secret` BURADA ilan edilmek ZORUNDA, yoksa tarayıcıdan gelen
  // ön-uçuş başlığı reddeder. İşçi CORS kullanmıyor, ama ilan zararsız.
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-push-secret');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function govdeOku(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return null; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  return body;
}

/**
 * Sır karşılaştırması. SABİT SÜRE DEĞİL (dürüstçe: `timingSafeEqual`
 * kullanılmadı, çünkü uzunluk farkı zaten sızar ve bu uç zaten hız
 * sınırlı). Sırrın kendisi HİÇBİR yere yazılmıyor.
 */
function sirDogru(req) {
  const beklenen = process.env.PUSH_SECRET;
  if (!beklenen) return false;
  const gelen = String((req.headers && req.headers['x-push-secret']) || '');
  return gelen.length === beklenen.length && gelen === beklenen;
}

/**
 * Expo'ya toplu gönderim. Ölü jetonları (`DeviceNotRegistered`) ayıklar.
 * Dönen `elenen` dizisi KV'den düşürülecek jetonları taşıyor.
 */
async function expoGonder(jetonlar, bildirim) {
  const gonderilecek = jetonlar.map((x) => x.token);
  const elenen = [];
  let basarili = 0;

  for (let i = 0; i < gonderilecek.length; i += EXPO_PARCA) {
    const parca = gonderilecek.slice(i, i + EXPO_PARCA);
    const govde = parca.map((to) => ({
      to,
      title: bildirim.baslik,
      body: bildirim.mesaj,
      sound: 'default',
      priority: bildirim.oncelik === 'high' ? 'high' : 'normal',
      ...(bildirim.url ? { data: { url: bildirim.url } } : {}),
    }));

    const kontrol = new AbortController();
    const timer = setTimeout(() => kontrol.abort(), EXPO_ZAMAN_ASIMI_MS);
    let yanit;
    try {
      const r = await fetch(EXPO_UC, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(govde),
        signal: kontrol.signal,
      });
      clearTimeout(timer);
      if (!r.ok) return { ok: false, kod: 'expo_hata' };
      yanit = await r.json();
    } catch {
      clearTimeout(timer);
      return { ok: false, kod: 'expo_hata' };
    }

    const fisler = Array.isArray(yanit && yanit.data) ? yanit.data : [];
    fisler.forEach((fis, j) => {
      if (fis && fis.status === 'ok') { basarili += 1; return; }
      const sebep = fis && fis.details && fis.details.error;
      if (sebep === 'DeviceNotRegistered') elenen.push(parca[j]);
    });
  }

  return { ok: true, basarili, elenen };
}

export async function bildirimHandler(req, res) {
  const origin = String((req.headers && req.headers.origin) || '');
  setCORS(res, origin);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const kod = String((req.query && req.query.code) || '').trim();
  if (!kodGecerli(kod)) {
    res.status(400).json({ error: 'kod_yok', bicim: '4-40 karakter, [a-z0-9_-]' });
    return;
  }
  const kv_anahtar = anahtar(kod);
  const mod = String((req.query && req.query.mod) || '').trim();

  // --- (3) GÖNDERİM — sır kapısı ÖNCE basıyor -------------------------
  if (req.method === 'POST' && mod === 'gonder') {
    if (!sirDogru(req)) {
      // Sebep AYRIŞTIRILMIYOR ("sır yok" / "sır yanlış" ayrımı sızıntı).
      res.status(401).json({ error: 'yetki_yok' });
      return;
    }
    const govde = govdeOku(req);
    const baslik = String((govde && govde.baslik) || '').trim().slice(0, 120);
    const mesaj = String((govde && govde.mesaj) || '').trim().slice(0, 400);
    if (!baslik || !mesaj) {
      res.status(400).json({ error: 'bos_govde' });
      return;
    }
    let kayit;
    try { kayit = await kv.get(kv_anahtar); }
    catch { res.status(502).json({ error: 'kv_yok' }); return; }

    const jetonlar = Array.isArray(kayit && kayit.jetonlar) ? kayit.jetonlar : [];
    if (jetonlar.length === 0) {
      // 404, 200-boş DEĞİL: "kimse kayıtlı değil" SESSİZ geçmemeli.
      res.status(404).json({ error: 'jeton_yok' });
      return;
    }

    const sonuc = await expoGonder(jetonlar, {
      baslik,
      mesaj,
      url: govde && typeof govde.url === 'string' ? govde.url.slice(0, 400) : null,
      oncelik: govde && govde.oncelik === 'high' ? 'high' : 'normal',
    });
    if (!sonuc.ok) { res.status(502).json({ error: sonuc.kod }); return; }

    // Ölü jetonları düşür. BAŞARISIZLIK YUTULMUYOR ama gönderimi de
    // geçersiz kılmıyor: bildirim GİTTİ, budama bir sonraki tura kalır.
    if (sonuc.elenen.length) {
      const kalan = jetonlar.filter((x) => !sonuc.elenen.includes(x.token));
      try { await kv.set(kv_anahtar, { jetonlar: kalan, updatedAt: Date.now() }); }
      catch { /* budama ertelendi; cevap yine dürüst sayı taşıyor */ }
    }

    res.status(200).json({
      ok: true,
      gonderildi: sonuc.basarili,
      elendi: sonuc.elenen.length,
    });
    return;
  }

  // --- (2) DURUM -------------------------------------------------------
  if (req.method === 'GET') {
    let kayit;
    try { kayit = await kv.get(kv_anahtar); }
    catch { res.status(502).json({ error: 'kv_yok' }); return; }
    const jetonlar = Array.isArray(kayit && kayit.jetonlar) ? kayit.jetonlar : [];
    // JETON DÖNMÜYOR — yalnız sayı. Kayıt hiç yoksa `updatedAt` `null`
    // (`0` BASILMAZ: ölçülmemiş zaman sıfır zaman değildir).
    res.status(200).json({
      sayi: jetonlar.length,
      updatedAt: (kayit && kayit.updatedAt) || null,
    });
    return;
  }

  // --- (1) KAYIT -------------------------------------------------------
  if (origin && !kaynakIzinli(origin)) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return;
  }
  if (hizAsildi(istemciKimligi(req, 'push-kayit'))) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const govde = govdeOku(req);
  const jeton = govde && typeof govde.token === 'string' ? govde.token.trim() : '';
  if (!jeton) { res.status(400).json({ error: 'jeton_yok' }); return; }
  if (!jetonGecerli(jeton)) {
    // Gövde JETONU YANSITMIYOR — biçim adı veriliyor, değer verilmiyor.
    res.status(400).json({ error: 'bad_jeton', bicim: 'ExponentPushToken[...]' });
    return;
  }
  const platform = platformSuz(govde.platform);

  let kayit;
  try { kayit = await kv.get(kv_anahtar); }
  catch { res.status(502).json({ error: 'kv_yok' }); return; }

  const simdi = Date.now();
  const jetonlar = jetonBirlestir(kayit && kayit.jetonlar, { token: jeton, platform }, simdi);
  try { await kv.set(kv_anahtar, { jetonlar, updatedAt: simdi }); }
  catch { res.status(502).json({ error: 'kv_yok' }); return; }

  res.status(200).json({ ok: true, sayi: jetonlar.length, updatedAt: simdi });
}

export const HANDLERLAR = Object.freeze({ bildirim: bildirimHandler });

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
