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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age',       '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const target = req.query?.url;
  if (!target) { res.status(400).send('Missing ?url= parameter'); return; }
  try { new URL(target); }
  catch { res.status(400).send('Invalid url'); return; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  // SEC (sec.gov) adil-erişim politikası, iletişim bilgisi içeren bir User-Agent ister;
  // generic/tarayıcı UA'ları WAF tarafından 403 ile reddedilir. Yalnız sec.gov'a bu UA gönderilir.
  let host = '';
  try { host = new URL(target).hostname; } catch {}
  const isSec = /(^|\.)sec\.gov$/i.test(host);
  const userAgent = isSec
    ? 'SabahBulteni/1.0 (day-starter; atahasnokar@gmail.com)'
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
