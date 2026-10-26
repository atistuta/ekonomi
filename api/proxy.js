// Vercel Node serverless proxy — RSS/HTML/JSON CORS proxy
// URL: https://<your-app>.vercel.app/api/proxy?url=<target>
// Node runtime kullanıyoruz çünkü Edge runtime KAP gibi yavaş upstream'lerde
// 9-10sn'de timeout oluyor. Node'da maxDuration 30sn'ye kadar açık.

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

// ---------------------------------------------------------------------
//  BIRLESIK FONKSIYON: /api/proxy + /api/yfin
//
//  NEDEN: Vercel Hobby plani bir deploy'a en fazla 12 serverless fonksiyon
//  aliyor; api/ altinda 13 rota olmustu ve 2026-10-19'dan beri her deploy
//  "Deploying outputs" adiminda SESSIZCE patliyordu (build basariyla bitiyor,
//  logda tek satir hata yok). Hatanin sozu sozune, `vercel deploy` preview
//  ile yuzeye cikarildi:
//    "No more than 12 Serverless Functions can be added to a Deployment on
//     the Hobby plan. Create a team (Pro plan) to deploy more."
//  `vercel inspect --logs` ve `--json` bu metni GOSTERMIYOR.
//
//  COZUM: api/yfin.js -> api/_yfin.js (tasiyici; `_` dosyalari rotaya
//  cevrilmez, fonksiyon sayilmaz) ve /api/yfin yolu vercel.json'daki rewrite
//  ile /api/proxy?__rota=yfin'e gidiyor. GENEL YOL DEGISMEDI: app.js hala
//  /api/yfin cagiriyor. Motor uclarinin 9'una dokunulmadi.
//
//  NEDEN BU IKISI: ikisi de I/O-bound dis rolesi, ikisi de maxDuration 30,
//  ikisi de CORS `*` ile tarayicidan cagriliyor -> ayni butceyi paylasmalari
//  dogal. Yan fayda: _yfin.js'in modul duzeyi crumb onbellegi artik proxy
//  trafigiyle de sicak kaliyor.
//
//  `__rota` TASARIM NOTU: istemci /api/proxy?__rota=yfin'i dogrudan da
//  cagirabilir; zararsiz, yalnizca yfin davranisi alir. Yetki yukseltmesi
//  yok, iki yolun izinleri de ayni.
// ---------------------------------------------------------------------
//  DALGA-B2 EKİ — /api/tarama · /api/sektor · /api/radar · /api/backtest
//  · /api/deger de AYNI yola bindi. Beşi de api/_kesif.js taşıyıcısında
//  (`_` dosyası → rotaya çevrilmez, fonksiyon SAYILMAZ). Fonksiyon sayısı
//  12'de KALDI; tests/uc-test.mjs ⑮ bunu kilitliyor.
//
//  NİYE DİNAMİK import: _kesif.js modül düzeyinde `buildMotor()` kuruyor
//  (api/score.js/chart.js ile aynı kabuk). Statik import olsaydı DÜZ
//  /api/proxy?url= trafiği de her soğuk başlangıçta o kurulumu ÖDERDİ.
//  `await import` ile bedel yalnız keşif rotalarına düşüyor; ESM modül
//  önbelleği sayesinde ikinci çağrıda kurulum yinelenmiyor.
import { yfinHandler } from './_yfin.js';

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
  // /api/yfin rewrite'i buraya dusuyor -> tasiyiciya devret. CORS basliklarini
  // yfinHandler kendisi kuruyor (ayni kume: *, GET/OPTIONS, 86400).
  if (req.query?.__rota === 'yfin') return yfinHandler(req, res);

  // Keşif rotaları (tarama/sektor/radar/backtest/deger) -> _kesif.js.
  // CORS başlıklarını taşıyıcının kendisi kuruyor (aynı küme + POST için
  // Content-Type). Rota adı burada ELLE yazılmıyor: tablo _kesif.js'te,
  // vercel.json'daki rewrite'lar ve test onunla aynı listeyi okuyor.
  const rota = req.query?.__rota;
  if (rota) {
    const { HANDLERLAR } = await import('./_kesif.js');
    const h = HANDLERLAR[rota];
    if (h) return h(req, res);
  }

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
