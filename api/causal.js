// ===========================================================================
//  /api/causal — HABER ⇄ PİYASA NEDENSELLİK uç noktası  ·  ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: Bugün BELİRGİN hareket eden endeksleri, canlı taranmış gündem
//  konseptleriyle eşleştirir — "NASDAQ +%1,8 ⇄ [AI-çip gündemi]" gibi olası
//  bir bağ. app.js'teki "📉 Günün Nedeni" bölümünün SAYISAL çekirdeği.
//
//  DÜRÜSTLÜK / SPK: Bu bir KORELASYON okumasıdır (eş-zamanlı hareket +
//  ilgili taze manşet), kanıtlanmış nedensellik DEĞİL. SKORA DAHİL DEĞİL —
//  bu uç TA/FA/bileşke skoruna ne okur ne yazar. Yatırım tavsiyesi değildir.
//
//  MANTIK BURADA DEĞİL, MOTORDA — ÖLÇÜLDÜ, SONRA TAŞINDI (2026-10-18).
//  Yazmadan önce ölçüm: `grep -c "causalAlign\|computeCausalLinks"
//  api/_motor.js` → 0. Yani öteki üç ucun aksine bu mantık motorda YOKTU
//  ve bu uç onu YENİDEN YAZSAYDI app.js ile sessizce ayrışan ikinci bir
//  kopya doğardı. Doğru cevap kopya değil DİLİM: app.js'in nedensellik
//  bölgesi (CAUSAL_INDEX_AFFINITY + causalAlign + computeCausalLinks)
//  tests/engine.mjs'e onuncu dilim olarak eklendi ve `node
//  tools/motor-uret.mjs` ile api/_motor.js yeniden ÜRETİLDİ.
//    · app.js'e DOKUNULMADI (dilim okur, yazmaz).
//    · Bölge SAF ölçüldü: document/innerHTML/fetch/localStorage YOK.
//      DOM'a dokunan renderCausalLinks ve LLM stub'ı causalExplainLLM
//      dilimin DIŞINDA kaldı.
//    · Skorun DEĞERİ değişmedi: iki parite şeridi de FARK 0. Motor
//      İMZASI değişti (yeni metin), değer değil.
//
//  NEDEN POST — VARSAYIM AÇIKÇA YAZILIYOR. Öteki dört uç GET; bu uç değil.
//  Gerekçe ÖLÇÜLDÜ: computeCausalLinks'in girdisi iki büyük dizi (endeks
//  hareketleri + taranmış gündem konseptleri, konsept başına sektör
//  etiketleri ve başlık yaşları). Bu yük bir sorgu dizgisine SIĞMAZ ve
//  `_girdi.js AZAMI_SORGU = 128` sınırını ilk konseptte aşar. İki seçenek
//  vardı:
//    (a) Uç haberi KENDİ tarasın (RSS) → `api/_ag.js`a yeni bir konak
//        açmak demekti; o taşıyıcı Yahoo/SEC/İş Yatırım için ölçülmüş bir
//        süre bütçesi taşıyor ve haber ayağı bu adımın kapsamı değil.
//    (b) Girdiyi İSTEMCİ versin, uç yalnız AKIL YÜRÜTSÜN → seçildi.
//  Sonuç: bu uç AĞA HİÇ ÇIKMIYOR (bu yüzden `_ag.js`/AbortSignal yok,
//  maxDuration 10, `sayac` alanı yok — ölçecek bir ağ yok). Gündem taraması
//  istemcide kaldığı gün (native istemci) bu sözleşme değişmeden kalır.
//  Varsayımın bedeli: istemci gündemi zaten hesaplamış olmalı — app.js
//  `computeAgenda()` ile hesaplıyor, yani bugün için doğru.
//
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): cevapta biçimlenmiş sayı
//  yok. Motorun `causalAlign`ı bir de `why` dizisi üretiyor — SERBEST
//  TÜRKÇE ('riskten kaçış' · 'risk iştahı') — ve TELE KONMADI; `analiz`
//  katmanının `anchorSrc`i sökmesiyle aynı gerekçe. İstemci bu cümleyi
//  zaten elindeki `risk` tonundan ve hareket yönünden kuruyor. Cevapta
//  geçen tek metinler MAKİNE KODU: `kind` (endeks türü, istemcinin
//  gönderdiği) ve `sektorler[]` (sektör etiketleri).
//
//  KONSEPT GERİ DÖNMÜYOR, ANAHTARI DÖNÜYOR: `links[].key` istemcinin
//  gönderdiği konseptin `key` alanı. Başlık/emoji/manşet bağlantıları
//  istemcide ZATEN var — tele geri koymak hem gereksiz yük hem de serbest
//  metin olurdu.
//
//  GÜRÜLTÜ EŞİĞİ (1.6) VE "BELİRGİN HAREKET" KARARI BURADA DEĞİL: ikisi de
//  motorun `computeCausalLinks`inde. Bu dosyada eşik, ağırlık ya da çarpan
//  YOK — bir sayı buraya yazılırsa ekran ile sunucu sessizce ayrışır.
//
//  SÖZLEŞME
//    POST /api/causal     Content-Type: application/json
//    Gövde: {
//      hareketler: [ { kind, pct, notable } ]      en çok AZAMI_HAREKET
//        kind     endeks türü — SABİT KÜME, motorun CAUSAL_INDEX_AFFINITY
//                 anahtarları (equity_tech|equity_us|equity_tr|gold)
//        pct      günlük değişim yüzdesi, HAM sayı
//        notable  "belirgin" eşiği (yüzde) — istemcinin endeks ayarından
//      gundem: [ { key, sectors, risk, tone, heat, heads } ]  AZAMI_KONSEPT
//        sectors  [[sektor, 'up'|'down'], ...]
//        risk     'on' | 'off' | null
//        tone     -1..1 arası HAM sayı (ya da null)
//        heat     'hot' | 'warm' | 'cool'
//        heads    [ { ageH } ] — yalnız saat yaşı okunuyor
//    }
//    Cevap 200: { baglar[], degerlendirilen, eslesen, surum, ms, uyari }
//      baglar[] = { kind, pct, links: [ { key, skor, sektorler[] } ] }
//        En çok 2 bağ (motor sıralıyor), gürültü eşiğinin altındakiler ve
//        hiç eşleşmeyen hareketler DÜŞÜYOR — "bilmiyorum" uydurulmuyor.
//      baglar BOŞ olabilir: hareket yok ya da eşleşen taze haber yok.
//      Bu bir ARIZA DEĞİL, dürüst sessizlik (app.js'te de kutu boş kalır).
//    Cevap 4xx: { error: <makine kodu>, ... , uyari }
//    Cevap 502: { error: 'neden_hesaplanamadi', uyari }
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

import { buildMotor, IMZA } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK, IMZA_AYAR } from './_ayar.js';
import { canliAg } from './_ag.js';

// maxDuration 10: bu uç AĞA ÇIKMIYOR, saf hesap. Öteki uçların 60'ı
// Yahoo/SEC turu içindi; buraya kopyalamak ölçülmemiş bir sayı yazmak
// olurdu. Motor kurulumu (soğuk başlangıç) + birkaç yüz konsept çarpımı
// milisaniyeler sürüyor.
export const config = { runtime: 'nodejs', maxDuration: 10 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

// ---------------------------------------------------------------------
//  SINIRLAR — niye bu sayılar
//  AZAMI_HAREKET = 12 · istemcinin endeks tablosu bundan büyük değil
//    (app.js endeks tetikleyicileri: hisse/altın/kur/faiz kümesi).
//  AZAMI_KONSEPT = 60 · computeAgenda sözlükteki konseptler + bugünün
//    "yeni başlık kümeleri"ni üretiyor; 60 bunun rahat üstü.
//  AZAMI_GOVDE_BAYT = 65536 · yük hareketler × konseptler kadar BÜYÜYOR;
//    sınır olmasa tek istek belleği şişirebilirdi. api/watchlist.js de
//    aynı fikirle MAX_LIST_BYTES taşıyor.
//  Bu sayılar GİRDİ KAPISINA (_girdi.js) konmadı: o taşıyıcı SEMBOL
//  sorgusunun kapısı, bu uç sembol almıyor. Oraya koymak dört uca
//  ilgisiz sabitler taşırdı.
// ---------------------------------------------------------------------
export const AZAMI_HAREKET = 12;
export const AZAMI_KONSEPT = 60;
export const AZAMI_GOVDE_BAYT = 65536;

function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum. Bu uç motorun yalnız nedensellik dilimini
//  kullanıyor ama buildMotor bölünmez bir bütün — ağırlıklar yine de
//  takılıyor ki motor nesnesi öteki uçlarla AYNI biçimde kurulsun
//  (sapma olursa tek yerde değil, her uçta görünür).
// ---------------------------------------------------------------------
let ENG = null;
let KURULUM_HATASI = null;
try {
  const AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
  ENG._weights = AG.H.window.TA_WEIGHTS;
  ENG._bench = AG.H.window.TA_BENCHMARK;
} catch (e) {
  KURULUM_HATASI = e;
}

/**
 * Gövdeyi doğrula ve motorun beklediği biçime çevir. SAF: ağa çıkmaz,
 * motoru ÇAĞIRMAZ (yalnız geçerli `kind` kümesini motordan okur). Bu
 * yüzden dışa aktarılıyor — tests/uc-test.mjs ağsız ölçebiliyor.
 * @returns {{rows:object[], ag:object} | {hata:{http:number, govde:object}}}
 */
export function ayristirGovde(body, gecerliKindler) {
  const hata = (http, govde) => ({ hata: { http, govde } });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return hata(400, { error: 'govde_yok' });

  const hareketler = body.hareketler;
  const gundem = body.gundem;
  if (!Array.isArray(hareketler)) return hata(400, { error: 'hareketler_yok' });
  if (!Array.isArray(gundem)) return hata(400, { error: 'gundem_yok' });
  if (hareketler.length > AZAMI_HAREKET) {
    return hata(400, { error: 'cok_hareket', azami: AZAMI_HAREKET, istenen: hareketler.length });
  }
  if (gundem.length > AZAMI_KONSEPT) {
    return hata(400, { error: 'cok_konsept', azami: AZAMI_KONSEPT, istenen: gundem.length });
  }

  // Endeks hareketleri → motorun beklediği `{ cfg: { kind, notable }, pct }`.
  // `kind` SABİT KÜME: motorun yakınlık tablosunda olmayan bir tür sessizce
  // boş bir yakınlık listesine düşer ve hep 0 skor üretirdi — "eşleşme yok"
  // ile "yanlış tür gönderdin" aynı görünürdü. Açıkça reddediliyor.
  const rows = [];
  for (const h of hareketler) {
    if (!h || typeof h !== 'object') return hata(400, { error: 'bad_hareket' });
    const kind = String(h.kind ?? '');
    if (!gecerliKindler.includes(kind)) return hata(400, { error: 'bad_kind', izinli: gecerliKindler });
    const pct = Number(h.pct);
    if (!Number.isFinite(pct)) return hata(400, { error: 'bad_pct' });
    const notable = Number(h.notable);
    if (!Number.isFinite(notable) || notable < 0) return hata(400, { error: 'bad_notable' });
    rows.push({ cfg: { kind, notable }, pct });
  }

  // Gündem konseptleri → motorun okuduğu alanlar YALNIZCA. Fazlası (label,
  // emoji, manşet başlıkları/bağlantıları) BİLEREK atılıyor: motor onlara
  // bakmıyor ve tele geri dönmeyecekleri için taşınmalarının anlamı yok.
  const items = [];
  for (const c of gundem) {
    if (!c || typeof c !== 'object') return hata(400, { error: 'bad_konsept' });
    const key = String(c.key ?? '');
    if (!key) return hata(400, { error: 'konsept_key_yok' });
    const sectors = Array.isArray(c.sectors)
      ? c.sectors.filter((s) => Array.isArray(s) && s.length === 2).map((s) => [String(s[0]), String(s[1])])
      : [];
    const tone = Number.isFinite(Number(c.tone)) ? Number(c.tone) : null;
    const heads = Array.isArray(c.heads)
      ? c.heads.filter((h) => h && Number.isFinite(Number(h.ageH))).map((h) => ({ ageH: Number(h.ageH) }))
      : [];
    items.push({
      key,
      sectors,
      risk: (c.risk === 'on' || c.risk === 'off') ? c.risk : null,
      tone,
      heat: (c.heat === 'hot' || c.heat === 'warm' || c.heat === 'cool') ? c.heat : 'cool',
      heads,
    });
  }

  return { rows, ag: { items } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET DEĞİL — gerekçe başlıkta (girdi sorgu dizgisine sığmıyor).
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }

  if (KURULUM_HATASI || !ENG) {
    console.error('api/causal: motor kurulamadi —', (KURULUM_HATASI && KURULUM_HATASI.message) || 'bilinmiyor');
    kisaOnbellek(res);
    res.status(503).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return;
  }

  // Vercel Node runtime gövdeyi Content-Type JSON ise kendi ayrıştırıyor;
  // dizge gelirse elle çözüyoruz (api/watchlist.js:77 ile aynı kalıp).
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > AZAMI_GOVDE_BAYT) {
      kisaOnbellek(res);
      res.status(413).json({ error: 'govde_buyuk', azami: AZAMI_GOVDE_BAYT, uyari: UYARI });
      return;
    }
    try { body = JSON.parse(body); } catch { body = null; }
    if (!body) {
      kisaOnbellek(res);
      res.status(400).json({ error: 'bozuk_json', uyari: UYARI });
      return;
    }
  }

  const ay = ayristirGovde(body, Object.keys(ENG.CAUSAL_INDEX_AFFINITY));
  if (ay.hata) {
    kisaOnbellek(res);
    res.status(ay.hata.http).json({ ...ay.hata.govde, uyari: UYARI });
    return;
  }

  const t0 = Date.now();
  try {
    const gruplar = ENG.computeCausalLinks(ay.ag, ay.rows, null);
    // Tele yalnız MAKİNE KODU + HAM SAYI: `why` (serbest Türkçe) ve
    // konseptin kendisi (başlık/emoji/manşet) BİLEREK dışarıda.
    const baglar = gruplar.map((g) => ({
      kind: g.cfg.kind,
      pct: g.pct,
      links: g.links.map((l) => ({
        key: l.concept.key,
        skor: l.score,
        sektorler: l.matchedSecs,
      })),
    }));

    // Gövdeye bağlı, kullanıcıya özel bir cevap: CDN'de paylaşılmamalı.
    // Öteki uçların 5 dakikalık penceresi burada YANLIŞ olurdu.
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      baglar,
      degerlendirilen: ay.rows.length,
      eslesen: baglar.length,
      surum: { motor: IMZA, ayar: IMZA_AYAR },
      ms: Date.now() - t0,
      uyari: UYARI,
    });
  } catch (e) {
    console.error('api/causal:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'neden_hesaplanamadi', uyari: UYARI });
  }
}
