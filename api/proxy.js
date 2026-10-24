// Vercel Node serverless proxy — RSS/HTML/JSON CORS proxy
// URL: https://<your-app>.vercel.app/api/proxy?url=<target>
// Node runtime kullanıyoruz çünkü Edge runtime KAP gibi yavaş upstream'lerde
// 9-10sn'de timeout oluyor. Node'da maxDuration 30sn'ye kadar açık.

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const UPSTREAM_TIMEOUT_MS = 25000;
const CACHE_TTL_SEC       = 300;
const CACHE_ERR_TTL_SEC   = 30;

// ---------------------------------------------------------------------
//  KONAK İZİN LİSTESİ — ölçülmüş, açık röle kapatıldı.
//
//  ÖNCE NE VARDI: `?url=` ne verilirse çekiliyordu ve cevap
//  `Access-Control-Allow-Origin: *` ile dönüyordu. Yani bu uç, internetteki
//  herhangi birinin kendi trafiğini üzerinden geçirebileceği AÇIK BİR
//  RÖLEYDİ (25 sn yukarı-akım zaman aşımı, 30 sn bütçe, bizim faturamız).
//
//  LİSTE NASIL ÇIKARILDI: app.js/config.js/sw.js/worker içindeki TÜM
//  `http(s)://…` değişmezleri sayıldı (ölçüm, tahmin değil). İstemci hiçbir
//  yerde kullanıcıdan konak almıyor; adresler ya değişmez ya da
//  `googleNewsUrl()/themeNewsUrl()` gibi sabit tabanlardan kuruluyor.
//  Bu yüzden izin listesi mevcut hiçbir özelliği kısmıyor.
//
//  YENİ BİR KAYNAK EKLERKEN: konağı buraya da ekle, yoksa 403 alırsın —
//  sessizce boş veri değil, adıyla hata. Kasıtlı.
// ---------------------------------------------------------------------
const IZINLI_KONAKLAR = new Set([
  // haber / RSS
  'news.google.com',
  'feeds.bbci.co.uk',
  'rss.dw.com',
  'www.cnbc.com',
  'www.bloomberght.com',
  'www.dunya.com',
  'www.sozcu.com.tr',
  'www.cumhuriyet.com.tr',
  't24.com.tr',
  // piyasa verisi
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'finance.yahoo.com',
  'api.coingecko.com',
  'finans.truncgil.com',
  'finans.mynet.com',
  'temettuhisseleri.com',
  // BIST / KAP
  'www.kap.org.tr',
  'www.isyatirim.com.tr',
  // SEC EDGAR
  'www.sec.gov',
  'data.sec.gov',
]);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age',       '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const target = req.query?.url;
  if (!target) { res.status(400).send('Missing ?url= parameter'); return; }
  let hedef;
  try { hedef = new URL(target); }
  catch { res.status(400).send('Invalid url'); return; }

  // Yalnız http(s). `file:`, `gopher:`, `data:` gibi şemalar kapalı.
  if (hedef.protocol !== 'https:' && hedef.protocol !== 'http:') {
    res.status(400).send('Yalnız http/https');
    return;
  }
  const host = hedef.hostname.toLowerCase();
  if (!IZINLI_KONAKLAR.has(host)) {
    // Açıkça söyle: bu bir röle değil, bu projenin kendi kaynaklarının kapısı.
    res.status(403).send('Izinli olmayan konak: ' + host);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  // SEC UA — 2026-10-24 ÖLÇÜLDÜ (canlı curl, üç uç nokta):
  //   · `www.sec.gov` WAF'ı UA içinde E-POSTA BİÇİMLİ bir iletişim imi ARIYOR.
  //     '…(contact: sabah-bulteni)' (@ yok)            → 403
  //     'Mozilla/5.0 (compatible; SabahBulteni/1.0)'   → 403
  //     api/_ag.js'teki e-postasız UA                  → 403 (www), 200 (data)
  //     aşağıdaki UA → company_tickers.json 200, browse-edgar 200,
  //                    data.sec.gov/submissions 200
  //   · Yani `data.sec.gov` e-posta istemiyor (api/_ag.js'in notu DOĞRU),
  //     `www.sec.gov` istiyor. İki not çelişmiyor, iki ayrı konak.
  // KİŞİSEL E-POSTA KALDIRILDI: adres artık kullanıcının değil, projenin
  // kendi alan adında. Değiştirmeden önce YENİDEN ÖLÇ.
  const isSec = /(^|\.)sec\.gov$/i.test(host);
  const userAgent = isSec
    ? 'SabahBulteni/1.0 (+https://day-starter.vercel.app; iletisim@day-starter.vercel.app)'
    : 'Mozilla/5.0 (compatible; SabahBulteni/1.0)';

  try {
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, text/html;q=0.8, */*;q=0.5',
        'Accept-Language': 'tr,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get('Content-Type') || 'application/octet-stream';
    const ok = upstream.status >= 200 && upstream.status < 400;

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', ok
      ? `public, max-age=${CACHE_TTL_SEC}, s-maxage=${CACHE_TTL_SEC}, stale-while-revalidate=600`
      : `public, max-age=${CACHE_ERR_TTL_SEC}`);
    res.status(upstream.status).send(buf);
  } catch (e) {
    clearTimeout(timer);
    const isTimeout = e.name === 'AbortError' || /timeout|aborted/i.test(String(e.message));
    res.setHeader('Cache-Control', `public, max-age=${CACHE_ERR_TTL_SEC}`);
    res.status(isTimeout ? 504 : 502)
       .send(`Upstream ${isTimeout ? 'timeout' : 'error'}: ${e.message || e}`);
  }
}
