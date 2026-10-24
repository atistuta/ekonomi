// ===========================================================================
//  /api/news — HABER (manşet) uç noktası   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NİYE VAR — ÖLÇÜLEN EKSİK (2026-10-24): native istemci (mobile/) RSS
//  TARAYAMIYOR. Webde manşetler tarayıcı vekiliyle okunuyor (app.js
//  `fetchVia` → `parseRSS`), ama o yol `DOMParser`a ve vekile bağlı;
//  ikisi de native tarafta yok. Kural "native ince istemci, hesap/veri
//  sunucuda" olduğu için haber taraması sunucuya ALINDI.
//
//  NEDEN BU AD: `/api/news` — öteki uçlar da İNGİLİZCE yol adı taşıyor
//  (`score`, `recommend`, `analyze`, `compare`, `causal`, `chart`,
//  `theme`, `pulse`). `/api/haber` tek Türkçe yol olurdu; yol adları
//  dosya adlarıdır, karışık dil bakımsızlık üretir.
//
//  NE: ham manşet dizisi + sayaç. BAŞKA HİÇBİR ŞEY. Bu uç skor
//  zincirinin (/api/score ⊂ recommend ⊂ analyze ⊂ compare) İÇİNDE DEĞİL,
//  YANINDA: bir eşik, ağırlık ya da skor alanı taşımıyor ve hiçbir skora
//  GİRDİ VERMİYOR. Dönen şey METİN — sayı değil.
//
//  AĞ TAŞIYICISI AYRI: `api/_haber.js`. `api/_ag.js` AÇILMADI,
//  DEĞİŞTİRİLMEDİ — oradaki beş konaklı `IZINLI` listesi SKOR şeridinin
//  güvenlik sözleşmesi ve haber oraya girmez. Gerekçenin tamamı
//  `api/_haber.js` başlığında yazılı.
//
//  HAM METİN KURALI (BAGIMLILIK_GRAFIGI.md §5.1): gövdede Intl/toFixed/
//  yüzde/para simgesi YOK. `pubDate` ÜST KAYNAĞIN VERDİĞİ GİBİ dönüyor
//  (RFC-822 dizgesi) — ms'e çevirmek ya da "3 saat önce" yazmak
//  biçimlemedir ve İSTEMCİDE kalır. Manşet metni çevrilmiyor,
//  kısaltılmıyor, emoji eklenmiyor.
//
//  SINIRLAR BURADA, `_girdi.js`te DEĞİL (chart.js'in kurduğu kalıp):
//  `q` bu uçta SERBEST METİN, sembol değil. Ortak sembol kapısından
//  geçirmek (`temizleSembol`) "Fed faiz kararı" gibi geçerli bir haber
//  sorgusunu reddetmek olurdu. Uzunluk tavanı da bu yüzden ayrı
//  (`AZAMI_HABER_SORGU`, ölçümü _haber.js'te).
//
//  KV ÖNBELLEĞİ YOK — BİLEREK, SESSİZ EKSİKLİK DEĞİL: `api/_onbellek.js`
//  TTL'leri skor ve tema için ÖLÇÜLDÜ (TTL_FIYAT 300 · TTL_TEMA). Haber
//  için ölçülmüş bir TTL yok ve uydurmak, bayat manşeti "taze" diye
//  servis etmek olurdu. Yerine HTTP penceresi: başarılı ve DOLU cevap
//  120 sn (üst kaynak dakika başı tazeleniyor), eksik/boş cevap 30 sn
//  (öteki uçların `kisaOnbellek` kalıbı). Ölçülmüş bir TTL çıktığında KV
//  eklenir.
//
//  SÖZLEŞME
//    GET /api/news?q=ASELSAN[&market=TR][&limit=10]
//      q      ZORUNLU · serbest metin ya da sembol (en çok 256 karakter)
//      market TR | US   (varsayılan TR — ölçüm: _haber.js PAZAR_YERELI)
//      limit  1..25     (varsayılan 10)
//    Cevap 200: { q, market, limit, maddeler[], adet, sayac, tam, ms, uyari }
//      maddeler[i] = { title, link, pubDate, source } — HAM metin.
//      adet        = maddeler.length — istemci boş listeyi alan okumadan
//                    görsün.
//      tam         = sayaçta hata/zaman aşımı/kısa gövde YOK mu.
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'haber_alinamadi', uyari }   (içeriden gelen
//               hata METNİ İSTEMCİYE GİTMEZ; yalnız sunucuya loglanır)
//
//  BOŞ LİSTE ARIZA DEĞİL: hiç haberi olmayan bir sorgu geçerli bir
//  besleme ile 0 madde döndürür. O hâlde 200 + `maddeler: []` +
//  `adet: 0` + `tam: true` dönüyoruz. "Haber yok" ile "ölçemedim"
//  (`tam: false`) KARIŞTIRILMIYOR — _ag.js sayaç ayrımının aynı fikri.
//
//  NE DEĞİL: bu bir DUYGU/SENTIMENT SKORU DEĞİL. Manşet metni dönüyor;
//  ondan yön çıkarmak ⚡ Nabız'ın (api/pulse.js) işi ve o mantık MOTORDA.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

// Haberin KENDİ taşıyıcısı. `_ag.js` / `_motor.js` / `_ayar.js` İÇE
// ALINMIYOR: bu uç motor kurmuyor, skor okumuyor, sürüm imzası
// taşımıyor — çünkü manşet metni motorun imzasına bağlı değil.
import {
  haberCek, bosHaberSayac, haberTam,
  AZAMI_MADDE, VARSAYILAN_MADDE, AZAMI_HABER_SORGU, HABER_PAZARLAR,
} from './_haber.js';

export {
  AZAMI_MADDE, VARSAYILAN_MADDE, AZAMI_HABER_SORGU, HABER_PAZARLAR,
};

// maxDuration 10 · ÖLÇÜLEN gerekçe: bu uç TEK bir dış istek yapıyor
// (_haber.js `HABER_ISTEK_MS` = 6000 zaman aşımı altında). /api/chart ile
// AYNI kademe ve aynı sebep: 33 istek değil 1 istek var. /api/score'un
// 30-60 sn'si buraya kopyalanmadı.
export const config = { runtime: 'nodejs', maxDuration: 10 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// Varsayılan pazar — ekranın çoğunluğu TR (app.js'te `hl=tr` çağrıları
// `hl=en-US` çağrılarından fazla). Sessiz varsayılan DEĞİL: cevapta
// `market` alanı hangi pazarın kullanıldığını BİLDİRİYOR.
export const VARSAYILAN_PAZAR = 'TR';

// Hata ve eksik cevaplar KISA önbelleklenir (gerekçe: api/analyze.js:225).
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export default async function handler(req, res) {
  // CORS — api/chart.js ile birebir aynı küme (yeni kalıp uydurulmadı).
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

  const sorgu = req.query || {};

  const q = String(sorgu.q ?? '').trim();
  if (!q) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'missing_q', uyari: UYARI });
    return;
  }
  if (q.length > AZAMI_HABER_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_HABER_SORGU, uyari: UYARI });
    return;
  }

  const market = String(sorgu.market ?? VARSAYILAN_PAZAR).trim().toUpperCase();
  if (!HABER_PAZARLAR.includes(market)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: HABER_PAZARLAR, uyari: UYARI });
    return;
  }

  // Limit SESSİZCE KIRPILMAZ: tavanı aşan istek açıkça reddediliyor
  // (chart.js'in `cok_sembol` kararıyla aynı fikir — sessiz kırpma
  // istemcinin farketmediği eksik veridir).
  let limit = VARSAYILAN_MADDE;
  if (!(sorgu.limit === undefined || sorgu.limit === null || sorgu.limit === '')) {
    const n = Number(sorgu.limit);
    if (!Number.isInteger(n) || n < 1) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bad_limit', azami: AZAMI_MADDE, uyari: UYARI });
      return;
    }
    if (n > AZAMI_MADDE) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'limit_buyuk', azami: AZAMI_MADDE, istenen: n, uyari: UYARI });
      return;
    }
    limit = n;
  }

  const t0 = Date.now();

  try {
    const sayac = bosHaberSayac();
    const sonuc = await haberCek(q, { market, limit, sayac });
    const maddeler = sonuc.maddeler || [];
    const tam = haberTam(sayac);

    // TAM ve DOLU cevap 120 sn; eksik ya da boş cevap 30 sn — birkaç
    // dakika sonra manşet gelmiş olabilir (chart.js'in boş seri kararı).
    if (tam && maddeler.length) {
      res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=120, stale-while-revalidate=240');
    } else {
      kisaOnbellek(res);
    }

    res.status(200).json({
      q,
      market,
      limit,
      maddeler,
      adet: maddeler.length,
      sayac,
      tam,
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    // İÇERİDEN gelen metin İSTEMCİYE GİTMEZ (yığın izi / dosya yolu /
    // adres sızmasın) — yalnız sunucu kaydına.
    console.error('api/news:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'haber_alinamadi', uyari: UYARI });
  }
}
