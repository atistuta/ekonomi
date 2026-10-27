// ===========================================================================
//  /api/theme — Tematik keşif (LLM semantik katmanı)  ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NE: bir TEMA / SEKTÖR ifadesini (TR veya EN) alır, o temayla DOĞRUDAN
//  ilişkili halka açık hisse ADAYLARINI Claude'dan ister ve temiz JSON
//  döner. Framing BİLGİ / KEŞİF amaçlı — "al/sat" değil, "bu temayla
//  ilişkili hisseler".
//
//  URL: /api/theme?q=yapay%20zeka%20enerji%20talebi
//
//  BU UÇ YALNIZ ADAY ÜRETİR. İstemci (app.js themeEngine) her sembolü
//  /api/yfin ile doğrular (gerçek + kote mi), halüsinasyonları eler.
//  SKOR MOTORUNA DOKUNMAZ — ne `_motor.js` ne `_akis.js` buraya girer,
//  bu yüzden `tests/parity.mjs` bu ucu KORUMAZ (skor şeridi değil).
//  Bekçisi `tests/uc-test.mjs` ⑧ bölümü.
//
//  ─────────────────────────────────────────────────────────────────────
//  NİYE BU DOSYA YENİDEN YAZILDI — ÖLÇÜLEN SAPMALAR (2026-10-18)
//
//  theme zaten yayındaydı ama ESKİ ŞERİTTEN geliyordu: /api/score ·
//  /api/recommend · /api/analyze üçlüsünün kabuk disiplinine hiç
//  uymuyordu. Sapmalar ölçüldü (tahmin değil, satır satır karşılaştırma):
//
//    ① UYARI YOK. Üç uç HER çıkış gövdesine `uyari` koyuyor; theme
//       hiçbirine koymuyordu. SPK çerçevesi açısından en pahalı sapma:
//       "bilgi amaçlıdır" metni cevabın İÇİNDE olmalı, çünkü istemci
//       dışında bu gövdeyi okuyan başka bir tüketici (native uygulama)
//       olabilir.
//    ② METHOD KAPISI YOK. OPTIONS ele alınıyordu ama POST/PUT/DELETE
//       düpedüz GET gibi işleniyordu — `Allow` başlığı ve 405 yoktu.
//       Üç uçta ikisi de var.
//    ③ ÖNBELLEK KALIBI SAPMIŞ. Üç uçta hata/eksik yolu TEK bir sabit:
//       `public, max-age=30` (kisaOnbellek). theme iki farklı sayı
//       kullanıyordu: no_key → 60, llm_error → 30. Tek kalıba getirildi.
//    ④ `AZAMI_SORGU` KOPYASI SÜRÜKLENMİŞ. theme'de yerel `120`,
//       `api/_girdi.js`te paylaşılan `128`. Üstelik `_girdi.js`in kendi
//       yorumu "api/theme.js'in `too_long` eşiğiyle aynı fikir" diyordu —
//       yani kopya OLDUĞU BİLİNİYOR ama BAĞLANMAMIŞTI. Artık içe
//       alınıyor: tek doğruluk kaynağı `_girdi.js`. Eşik 120 → 128
//       (8 karakter daha gevşek); hata KODU (`too_long`) ve davranış
//       şekli aynı.
//    ⑤ İÇ HATA METNİ SIZIYORDU. `detail: String(e.message)` — Anthropic'in
//       hata metni doğrudan istemciye gidiyordu. `api/score.js` başlığı
//       bundan BİLEREK sakınıyor ("hata metinleri izin verilmeyen adresi
//       ve dolayısıyla iç kurulumu açık edebilir") ve adıyla theme'i
//       örnek gösteriyordu. Alan KALDIRILDI; ayrıntı yalnız
//       `console.error`a gidiyor. İstemci bu alanı OKUMUYORDU
//       (app.js themeFetchLLM yalnız `candidates` + `error` okur), yani
//       sözleşme kırılmıyor.
//    ⑥ LOG DİSİPLİNİ YOKTU. Hata yolunda tek bir `console.error` bile
//       yoktu — LLM ucu sessizce düşüyordu. Üç uçta `api/<ad>: …` önekli
//       log var. Eklendi. ANAHTAR ASLA LOGLANMIYOR (aşağıda ⑧'e bak).
//    ⑦ ZAMAN AŞIMI FRENİ YOKTU. `maxDuration 30` vardı ama fetch'te
//       AbortSignal YOKTU: Anthropic asılı kalırsa platform isteği
//       keser ve istemci HİÇ cevap almaz. Üç uçta süre freni `_ag.js`te
//       (TUR_BUTCE_MS/TUR_TAVAN_MS). theme `_ag.js` kullanamaz (orası
//       Yahoo/SEC/İş Yatırım konağı; `api.anthropic.com` oraya SOKULMAZ),
//       bu yüzden kendi freni var: `LLM_ISTEK_MS`, maxDuration'ın ALTINDA.
//    ⑧ ADLANDIRILMAMIŞ SAYI. `out.length >= 14` gövdede gömülüydü;
//       `AZAMI_ADAY` oldu ve SYSTEM metniyle aynı sayıyı söylüyor.
//
//  ─────────────────────────────────────────────────────────────────────
//  HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1) — `reason` KARARI
//
//  Kural "sunucu SAYI BİÇİMLEMEZ" diyor: `Intl`, `toFixed`, `toLocaleString`,
//  yüzde işareti, para birimi, binlik ayracı üretilmez — çünkü biçim
//  sunucunun yerel ayarına kilitlenir ve istemci onu geri çeviremez.
//  Bu dosyada o anlamda İHLAL YOK ve statik denetim bunu tahsil ediyor
//  (uc-test ⑧d): cevapta tek bir biçimlenmiş sayı yok.
//
//  `reason` (ve `name`) SERBEST METİN ve KALIYOR. Gerekçe:
//    · Kural SAYI biçimleme kuralı, metin yasağı değil. Üç skor ucunda
//      "yalnız sabit küme etiketleri" denmesinin sebebi oralarda serbest
//      metnin SAYININ YERİNE geçme riski — `buyZoneProximity.txt` bir
//      zaman '🟢 … 1.2×ATR' taşıyordu ve o yüzden söküldü.
//    · Burada `reason` bir sayının sunumu DEĞİL, ucun ÜRÜNÜ. Bu uç bir
//      KEŞİF ucu: "bu hisse bu temayla niye ilişkili" cümlesi olmadan
//      geriye yalnız doğrulanmamış bir sembol listesi kalır ve istemci
//      o cümleyi kendi üretemez (temayı bilen taraf LLM).
//    · Risk metnin VAR OLMASI değil, NE SÖYLEDİĞİ. O yüzden çit metnin
//      kendisine kondu: SYSTEM "al/sat/öneri dili ASLA" diyor, uzunluk
//      140 karakterle kırpılıyor, ve gövdede `uyari` var.
//  Yani: `reason` kaldırılmadı — ama HAM SAYI kuralının asıl ölçtüğü şey
//  (biçimlenmiş sayı) burada da sıfır.
//
//  ─────────────────────────────────────────────────────────────────────
//  ANAHTAR DİSİPLİNİ: `ANTHROPIC_API_KEY` ASLA loglanmaz, ASLA cevaba
//  konmaz, ASLA URL'ye girmez — yalnız `x-api-key` başlığında, yalnız
//  `api.anthropic.com`a. Anahtar yoksa uç 200 + `error: 'no_key'` döner
//  (hata DEĞİL: istemci haber-tabanlı moda düşsün diye dürüst bir durum
//  bildirimi). `api/_ag.js` bu adresi TANIMIYOR ve tanımamalı.
//
//  SÖZLEŞME
//    GET /api/theme?q=<tema>
//      q : en çok AZAMI_SORGU (128) karakter, boş olamaz.
//    Cevap 200: { query, model?, candidates[], error?, ms, uyari }
//      candidates[i] = { symbol, market: 'US'|'BIST', name|null, reason|null }
//      error yoksa alan YOK; `no_key` / `llm_error` makine kodu.
//      `candidates` HER ZAMAN dizi — boş olsa bile alan var.
//    Cevap 4xx: { error: <makine kodu>, candidates: [], uyari }
//    Cevap 405: { error: 'method_not_allowed', uyari }
//
//  Gerekli ortam değişkeni: ANTHROPIC_API_KEY
//  İsteğe bağlı: THEME_MODEL (varsayılan aşağıdaki MODEL)
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

// `AZAMI_SORGU` TEK KAYNAKTAN: `api/_girdi.js`. Burada yerel bir kopya
// tutulsaydı (eskiden 120'ydi) iki sayı sessizce ayrışırdı — zaten
// ayrışmıştı. `_girdi.js` ağa ÇIKMAZ ve motora DOKUNMAZ, yalnız `_ayar.js`
// içe alır; bu yüzden onu buradan içe almak LLM ucuna skor şeridini
// bulaştırmıyor. `ayristir()` İÇE ALINMIYOR: bu ucun girdisi sembol değil
// serbest metin, o kapı buraya uymaz.
import { AZAMI_SORGU } from './_girdi.js';
export { AZAMI_SORGU };

// ÖNBELLEK — altı ucun PAYLAŞTIĞI taşıyıcı (`api/_onbellek.js`); burada
// kopya mantık YOK. Bu uç ölçümde YALNIZ 1 dış istek yapıyor ama o istek
// tek PARA ÖDENEN istek: önbellek burada ağ değil MALİYET kazancı.
import { anahtar, oku, yaz, TTL_TEMA } from './_onbellek.js';

// ---------------------------------------------------------------------
//  SEKTÖR SÖZLÜĞÜ — MOTORDAN OKUNUYOR, LLM'E SORULMUYOR
//
//  Başlıktaki "ne `_motor.js` ne `_akis.js` buraya girer" cümlesi
//  DEĞİŞTİ ve NİYE: `candidates[].sector` alanı gerekiyordu (web bu
//  etiketi gösteriyor, native istemci alanı hiç görmüyordu). İki yol
//  vardı ve biri ÖLÇÜLDÜ:
//    ① LLM'den sektör istemek → UYDURMA RİSKİ. Bu ucun kendi başlığı
//       "istemci her sembolü /api/yfin ile doğrular, halüsinasyonları
//       eler" diyor; doğrulanamayan bir metin alanı eklemek o kuralın
//       tam tersi olurdu.
//    ② Motorun DONMUŞ sözlüğü: `SYMBOL_SECTORS` — 127 sembol → sektör
//       KODU dizisi (ölçüm: TUPRS=['energy'], NVDA=['semis','tech'],
//       ASELS=['defense','tech']). Sözlükte OLMAYAN sembol (ölçüm:
//       MSFT, AAPL) `null` döner; TAHMİN EDİLMEZ.
//  ② seçildi.
//
//  SKOR ŞERİDİ YİNE BULAŞMIYOR — ÖLÇÜLDÜ:
//    · `_akis.js` ve `_ag.js` İÇE ALINMADI. Motor ATIL bir konakla
//      kuruluyor: `fetch`/`fetchVia` PATLAR, yani bu dosyadan motor
//      üzerinden ağa çıkmak MÜMKÜN DEĞİL.
//    · TA_WEIGHTS/TA_BENCHMARK BOŞ geçiyor: tek bir eşik, ağırlık ya da
//      formül okunmuyor — okunan şey sabit bir SÖZLÜK.
//    · Hiçbir skor hesaplanmıyor, gövdeye tek bir skor alanı girmiyor;
//      `tests/parity.mjs`in koruduğu yüzey bu dosyada hâlâ YOK.
//    · MALİYET ÖLÇÜLDÜ: `import` 5 ms, `buildMotor` 1 ms (maxDuration
//      30 sn ve 20 sn'lik LLM çağrısının yanında ölçülemez).
//  MOTORA YAZILMADI, yalnız OKUNDU.
// ---------------------------------------------------------------------
import { buildMotor } from './_motor.js';

// Atıl konak: motorun beklediği en küçük yüzey, ağ kapıları KAPALI.
const ATIL_KONAK = {
  window: { TA_WEIGHTS: {}, TA_BENCHMARK: {}, MY_PROXY: 'https://atil.invalid/' },
  localStorage: { getItem: () => null, setItem: () => {} },
  fetch: async () => { throw new Error('bu uc motor uzerinden aga cikmaz'); },
  fetchVia: async () => { throw new Error('bu uc motor uzerinden aga cikmaz'); },
};

// Sözlük kurulamazsa (motor yeniden üretilirken alan adı değişirse)
// uç ÇÖKMEZ, sektör alanı null kalır: "ölçemedim" sessiz 0 değil null.
const SEKTOR_SOZLUGU = (() => {
  try {
    const d = buildMotor(ATIL_KONAK).SYMBOL_SECTORS;
    return (d && typeof d === 'object') ? d : {};
  } catch (e) {
    console.error('api/theme sektor sozlugu kurulamadi:', (e && e.message) || e);
    return {};
  }
})();

/**
 * Sembolün sektör KODLARI (makine kodu dizisi) ya da `null`.
 * SAF: ağa çıkmaz, motora yazmaz. Dışa aktarılıyor ki tests/uc-test.mjs
 * ağsız ölçebilsin.
 *
 * ÇOĞUL: sözlükte bir sembol birden çok kod taşıyabilir
 * (ASELS = ['defense','tech']) — tek koda indirmek bilgi kaybı olurdu.
 * Türkçe etiket (motorun `SECTORS` tablosu) GÖNDERİLMİYOR: ham metin
 * kuralı gereği gövdede yalnız kapalı kümeden makine kodu durur,
 * etiketleme istemcinin işi.
 */
export function sektorKodlari(symbol) {
  // Sözlüğün anahtarları ÇIPLAK kod; aday sembolü BIST'te '.IS' taşıyor.
  const ham = String(symbol || '').trim().toUpperCase();
  const cip = ham.endsWith('.IS') ? ham.slice(0, -3) : ham;
  if (!cip) return null;
  const v = Object.prototype.hasOwnProperty.call(SEKTOR_SOZLUGU, cip)
    ? SEKTOR_SOZLUGU[cip] : null;
  if (!Array.isArray(v) || !v.length) return null; // boş dizi = bilgi yok → null
  return v.map((s) => String(s)).filter(Boolean);
}

// maxDuration 30 KALDI — değiştirilmedi, çünkü ölçülmüş bir sebep yok ve
// bu görev davranışı değiştirmiyor. İş yükü tek bir LLM çağrısı; skor
// uçlarının 60'ına (8 sembol × 7,2 sn) ihtiyaç duymuyor.
export const config = { runtime: 'nodejs', maxDuration: 30 };

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

const MODEL = process.env.THEME_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Aday tavanı — SYSTEM metnindeki "8 to 14" ile AYNI sayı. İkisi ayrışırsa
// model 14'ten fazla üretir ve kırpma sessizce devreye girer.
export const AZAMI_ADAY = 14;

// Süre freni. maxDuration (30 sn) ALTINDA olmalı: platform isteği kesmeden
// ÖNCE biz kesip temiz bir `llm_error` dönelim, yoksa istemci hiç cevap
// almaz. Fark (10 sn) serileştirme + soğuk başlangıç payı.
export const LLM_ISTEK_MS = 20000;

const SYSTEM = [
  'You are a financial RESEARCH DISCOVERY assistant for a Turkish investing-INFORMATION app.',
  'Given an investment THEME or SECTOR (written in Turkish or English), identify publicly traded stocks that are the most DIRECTLY and materially exposed to that theme.',
  '',
  'Rules:',
  '- Return 8 to 14 real, CURRENTLY-LISTED tickers. Use EXACT Yahoo Finance ticker symbols.',
  '- US / global stocks: plain symbol (examples: CEG, VST, GEV, NVDA, ETN).',
  '- Borsa Istanbul (Turkey) stocks: append ".IS" (examples: ASELS.IS, THYAO.IS, SASA.IS).',
  '- Prefer pure-play / high-exposure names over mega-cap conglomerates that only touch the theme; you may still include a few key large caps if they are central to it.',
  '- If the theme is relevant to Turkish markets, include Borsa Istanbul (.IS) names too; otherwise focus on US / global.',
  '- "reason" MUST be a SHORT Turkish phrase (max ~12 words) describing the LINK between the stock and the theme. It is discovery / context only, NOT investment advice. Never use al/sat/öneri (buy/sell/recommend) language.',
  '- If you are not confident a ticker is real and currently listed, OMIT it. Do not invent symbols.',
  '',
  'Output ONLY a JSON array (no prose, no markdown code fences). Each element:',
  '{"symbol":"CEG","market":"US","name":"Constellation Energy","reason":"Nükleer taban yük; veri merkezi elektrik talebi"}',
].join('\n');

// ---------------------------------------------------------------------
//  Saf yardımcılar — AĞA ÇIKMAZLAR, bu yüzden dışa aktarılmışlar:
//  tests/uc-test.mjs ⑧ bunları fikstür ya da ağ olmadan sınayabiliyor.
//  (`api/_girdi.js` `ayristir`i aynı sebeple dışa aktarıyor.)
// ---------------------------------------------------------------------

/** Claude yanıtından JSON diziyi güvenli biçimde çıkar (prefill "[" ile başlıyoruz). */
export function extractArray(text) {
  if (!text) return [];
  let s = ('[' + String(text)).trim();
  // olası kod çiti temizliği
  s = s.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (!s.startsWith('[')) { const i = s.indexOf('['); s = i >= 0 ? s.slice(i) : '[' + s; }
  const j = s.lastIndexOf(']');
  s = j >= 0 ? s.slice(0, j + 1) : s + ']';
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}

/** Aday nesnesini normalize et + kaba geçerlilik süzgeci. */
export function cleanCandidates(arr) {
  const out = [];
  const seen = new Set();
  for (const c of Array.isArray(arr) ? arr : []) {
    if (!c || typeof c !== 'object') continue;
    let sym = String(c.symbol || '').trim().toUpperCase();
    if (!sym || !/^[A-Z0-9.\-]{1,12}$/.test(sym)) continue;        // sembol gibi görünmeyeni at
    let market = String(c.market || '').trim().toUpperCase();
    if (market !== 'US' && market !== 'BIST') market = sym.endsWith('.IS') ? 'BIST' : 'US';
    if (market === 'BIST' && !sym.endsWith('.IS')) sym += '.IS';   // BIST → .IS garanti
    if (seen.has(sym)) continue; seen.add(sym);
    out.push({
      symbol: sym,
      market,
      name: (c.name ? String(c.name).trim() : '').slice(0, 80) || null,
      reason: (c.reason ? String(c.reason).trim() : '').slice(0, 140) || null,
    });
    if (out.length >= AZAMI_ADAY) break;
  }
  return out;
}

async function askClaude(query, apiKey) {
  // Süre freni — ⑦. `AbortSignal.timeout` Node 18+'ta var; Vercel nodejs
  // çalışma zamanı bunun üstünde.
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(LLM_ISTEK_MS),
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        { role: 'user', content: `Tema / sektör: "${query}"\n\nBu temayla doğrudan ilişkili hisseleri JSON dizi olarak ver.` },
        { role: 'assistant', content: '[' },   // prefill → doğrudan JSON diziye zorla
      ],
    }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
    const err = new Error(msg); err.status = r.status; throw err;
  }
  const text = (j && Array.isArray(j.content) && j.content[0] && j.content[0].text) || '';
  return cleanCandidates(extractArray(text));
}

// Hata ve eksik cevaplar KISA önbelleklenir: bir kesintiyi CDN'e uzun süre
// dondurmak, kesinti geçtikten sonra da eski cevabı servis etmek olurdu.
// api/score.js · api/recommend.js · api/analyze.js ile AYNI sayı.
function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export default async function handler(req, res) {
  // CORS — api/score.js ile birebir aynı küme (yeni kalıp uydurulmadı).
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

  const query = (req.query?.q || '').toString().trim();
  if (!query) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'missing_q', candidates: [], uyari: UYARI });
    return;
  }
  if (query.length > AZAMI_SORGU) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'too_long', azami: AZAMI_SORGU, candidates: [], uyari: UYARI });
    return;
  }

  const t0 = Date.now();

  // --- ÖNBELLEK OKUMASI ----------------------------------------------
  //  Anahtar girdinin TAMAMINI kapsıyor: sorgu metni + MODEL + aday tavanı.
  //  Burada motor imzası yok (bu uç skora dokunmaz); sürüm ekseni MODEL adı
  //  — `THEME_MODEL` değişince eski adaylar kendiliğinden geçersizleşir.
  //  Anahtar yoksa / KV arızalıysa `oku()` null döner ve aşağıdaki normal
  //  yol aynen işler — istek ASLA düşmez.
  const obAnahtar = anahtar('theme', { q: query, model: MODEL, azamiAday: AZAMI_ADAY });
  const obVurus = await oku(obAnahtar);
  if (obVurus) {
    res.setHeader('X-Onbellek', 'isabet');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    res.status(200).json({ ...obVurus, ms: Date.now() - t0 });
    return;
  }
  res.setHeader('X-Onbellek', 'iska');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Anahtar yoksa istemci haber-tabanlı moda düşsün. Bu bir ARIZA DEĞİL,
    // dürüst bir durum bildirimi — o yüzden 200. Önbellek yine kısa: anahtar
    // tanımlandığı an eski cevabı servis etmeyelim.
    kisaOnbellek(res);
    res.status(200).json({ query, candidates: [], error: 'no_key', ms: Date.now() - t0, uyari: UYARI });
    return;
  }

  try {
    const candidates = await askClaude(query, apiKey);
    // Temalar için adaylar yavaş değişir → CDN'de 1 gün tut (maliyet kontrolü).
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
    const govde = { query, model: MODEL, candidates, ms: Date.now() - t0, uyari: UYARI };
    // YALNIZ dolu aday listesi yazılıyor: boş liste "model bir şey bulamadı"
    // demek ve istemci o durumda haber katmanına düşüyor — onu 1 gün
    // dondurmak arızayı kalıcılaştırırdı. TTL = ucun İLAN ETTİĞİ pencere
    // (s-maxage=86400), yani KV hiçbir zaman sözleşmeden eski cevap vermez.
    if (candidates.length) await yaz(obAnahtar, govde, TTL_TEMA);
    res.status(200).json(govde);
  } catch (e) {
    // Ayrıntı YALNIZ sunucu günlüğüne — cevapta iç hata metni yok (⑤).
    // Anahtar buraya GİRMİYOR: yalnız hata mesajı yazılıyor, istek gövdesi
    // ya da başlıklar değil.
    console.error('api/theme: llm hatasi —', (e && e.message) || e);
    kisaOnbellek(res);
    // 200 KALDI (502 değil): istemci sözleşmesi "candidates boşsa haber
    // katmanına düş" üzerine kurulu; 4xx/5xx istemcide `fetch_error`a
    // dönüşür ve aynı sonuca varır ama hata kodunu kaybeder.
    res.status(200).json({ query, candidates: [], error: 'llm_error', ms: Date.now() - t0, uyari: UYARI });
  }
}
