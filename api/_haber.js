// ===========================================================================
//  api/_haber.js — HABER (RSS) TAŞIYICISI   ·   ELLE YAZILMIŞTIR
// ===========================================================================
//
//  NİYE AYRI BİR DOSYA — `api/_ag.js`e EKLENMEDİ (2026-10-24):
//  `_ag.js`in `IZINLI` konak listesi SKOR ŞERİDİNİN güvenlik sözleşmesi.
//  O listedeki beş konak (query1/query2 finance.yahoo.com · www.sec.gov ·
//  data.sec.gov · www.isyatirim.com.tr) skora GİRDİ veren kaynaklar ve
//  listenin kendi yorumu "başka yere uzanan dilim SESSİZCE değil
//  GÜRÜLTÜYLE düşsün" diyor. Haber oraya girerse:
//    ① skor şeridinin konak sözleşmesi, skora HİÇ girmeyen bir veri için
//       genişlemiş olur;
//    ② haber kesintisi `_ag.js` sayaçlarına karışır ve "skoru ölçemedim"
//       ile "haberi ölçemedim" ayırt edilemez hâle gelir.
//  Bu yüzden haberin KENDİ taşıyıcısı var: KENDİ konak izin listesi
//  (yalnız `news.google.com`), KENDİ zaman aşımı, KENDİ sayaçları.
//  `_ag.js` AÇILMADI, DEĞİŞTİRİLMEDİ.
//
//  BU DOSYA SKORA DOKUNMAZ: tek bir eşik, ağırlık, çarpan ya da skor
//  alanı taşımıyor. Çıktısı manşet METNİ — bir sayı değil. Skor zinciri
//  (/api/score ⊂ recommend ⊂ analyze ⊂ compare) bu dosyayı İÇE ALMIYOR.
//
//  KAYNAK — ÖLÇÜLDÜ, SONRA SEÇİLDİ: Google News RSS arama beslemesi.
//  Gerekçe: webin BUGÜN kullandığı kaynak zaten bu (app.js'te 11 ayrı
//  çağrı noktası, `grep -c news.google app.js`), anahtar gerektirmiyor
//  ve sunucudan doğrudan HTTP 200 veriyor (ölçüm: curl, ~135 KB gövde).
//  İkinci bir haber sağlayıcısı EKLENMEDİ — ekranın okumadığı bir
//  kaynaktan manşet getirmek, web ile sunucuyu ayrıştırırdı.
//
//  AYRIŞTIRMA — YENİ BAĞIMLILIK YOK, ama KOPYA DA YOK:
//  app.js'in `parseRSS`i (app.js:164) `DOMParser` kullanıyor; o sınıf
//  Node'da YOK, yani o fonksiyon sunucuda KOŞAMAZ. Buradaki sürüm aynı
//  işi regex ile yapıyor ve İKİZİ app.js:164'tür — biri değişirse öteki
//  de gözden geçirilmeli. Alan kümesi bilerek DARALTILDI: app.js
//  `description`/`author` da okuyor, bu taşıyıcı dönüşte yalnız
//  `{ title, link, pubDate, source }` veriyor (aşağıdaki MADDE ALANLARI).
//
//  BOŞ / KISA GÖVDE = "ÖLÇEMEDİM", "haber yok" DEĞİL: 200 dönen ama
//  `ASGARI_GOVDE_BAYT`ın altında kalan bir cevap (vekil hata sayfası,
//  kesik aktarım) sayacı `kisa`ya yazar ve `tam` false olur. Gerçekten
//  sıfır madde döndüren geçerli bir besleme ise `tam: true` + boş dizi
//  verir. İkisini karıştırmak, istemciye "bu konuda haber yok" diye
//  yalan söylemek olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

// ---------------------------------------------------------------------
//  KONAK İZİN LİSTESİ — KENDİ listesi, `_ag.js`in listesi DEĞİL.
//  Tek giriş: ölçülen tek kaynak. Yarın ikinci bir haber konağı
//  gerekirse ÖLÇÜLÜP buraya eklenir; sessizce genişlemez.
// ---------------------------------------------------------------------
export const IZINLI_KONAK = ['news.google.com'];

// Zaman aşımı 6000 ms · ARİTMETİK: uçların `maxDuration` tavanı 10 sn.
// İki besleme PARALEL çekiliyor, yani en kötü hâl 6 sn + ayrıştırma;
// 10 sn tavanının altında kalıyor ve uç "zaman aşımı" diye dürüst bir
// sayaç ile dönebiliyor — Vercel'in cevabı kesmesini beklemiyoruz.
export const HABER_ISTEK_MS = 6000;

// Madde tavanı 25 · ÖLÇÜM: Google News arama beslemesi tek sorguda ~100
// madde döndürüyor. Ekranda hiçbir yerde 25'ten fazla manşet
// gösterilmiyor (app.js `fetchRSS(url, count)` çağrılarında en büyük
// `count` 20). 25 bunun rahat üstü, "sınırsız" değil.
export const AZAMI_MADDE = 25;
export const VARSAYILAN_MADDE = 10;

// 256 bayt · ARİTMETİK: geçerli bir RSS'in yalnız XML bildirimi +
// <rss><channel><title> iskeleti bile bunun üstünde. Altında kalan gövde
// besleme değil, bir hata sayfası ya da kesik aktarımdır.
export const ASGARI_GOVDE_BAYT = 256;

// Sorgu uzunluk tavanı — `_girdi.js`in `AZAMI_SORGU`su BİLEREK
// kullanılmadı: o sabit SEMBOL sorgusunun kapısı (128) ve altı ucun
// sözleşmesi. Haber sorgusu serbest metin, app.js'teki en uzun ölçülen
// sorgu (`pmBig`, app.js:11634) 230 karakter. 256 onun üstü.
export const AZAMI_HABER_SORGU = 256;

// Dönen maddenin alan kümesi BURADA yazılı — besleme yarın yeni bir
// etiket eklediğinde sözleşmemiz sessizce büyümesin.
export const MADDE_ALANLARI = ['title', 'link', 'pubDate', 'source', 'type', 'symbol'];

// `type` ve `symbol` NEDEN EKLENDİ (native sözleşme eksiği, ÖLÇÜLDÜ):
// webin haber akışı maddeyi `{ symbol, type:'NEWS'|'KAP', item }` olarak
// taşıyor (app.js:3308) ve ekranın iki süzgeci (`newsFilterSymbol`,
// `newsFilterType`, app.js:3309-3310) BU İKİ ALANI okuyor. Sunucu onları
// taşımadığı için native istemci aynı süzgeçleri kuramıyordu.
//
// DEĞER KÜMESİ ÖLÇÜLDÜ, GENİŞLETİLMEDİ: 'NEWS' | 'KAP'. Bu taşıyıcı
// YALNIZ 'NEWS' üretir — tek kaynağı Google News RSS (IZINLI_KONAK) ve
// KAP duyurusu oradan GELMEZ (webde ayrı bir `fetchKAP()` çağrısı,
// app.js:3312). 'KAP' kümede yazılı ki istemci tarafı aynı sözlüğü
// kullanabilsin; bu taşıyıcıdan asla o değer çıkmaz.
//
// `symbol` ÖLÇÜLEMEYEN HÂLDE null, BOŞ DİZGE DEĞİL: serbest metin
// sorgusunda (`?q=Fed faiz kararı`) maddenin bir hissesi YOKTUR ve
// sorgu metnini sembol gibi yazmak uydurma olurdu.
export const HABER_TURLERI = ['NEWS', 'KAP'];
export const HABER_TURU = 'NEWS'; // bu taşıyıcının üretebildiği TEK tür

// ---------------------------------------------------------------------
//  PAZAR → YEREL AYAR. İki değer, ikisi de ÖLÇÜLDÜ (app.js:8695-8696).
//  Üçüncü bir pazar UYDURULMADI: ekran yalnız bu ikisini kullanıyor.
// ---------------------------------------------------------------------
export const PAZAR_YERELI = {
  TR: { hl: 'tr', gl: 'TR', ceid: 'TR:tr' },
  US: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
};
export const HABER_PAZARLAR = Object.keys(PAZAR_YERELI);

/**
 * Sayaç kabı. `_ag.js`in sayaç FİKRİ (ölçtüm / ölçemedim ayrımı)
 * ödünç alındı, NESNESİ değil: haber kesintisi skor sayacına karışmasın.
 */
export function bosHaberSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Sayaç "tam" mı: hiç hata/zaman aşımı/kısa gövde yok mu. */
export function haberTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/**
 * Besleme adresini kur. SAF: ağa çıkmaz. Bu yüzden dışa aktarılıyor —
 * tests/uc-test.mjs ağsız ölçebiliyor.
 * @param {string} q       serbest metin ya da sembol
 * @param {string} market  'TR' | 'US'
 * @returns {string|null}  geçersiz girdide null (sessiz varsayılan YOK)
 */
export function haberAdresi(q, market = 'TR') {
  const metin = String(q ?? '').trim();
  if (!metin || metin.length > AZAMI_HABER_SORGU) return null;
  const yerel = PAZAR_YERELI[String(market ?? '').trim().toUpperCase()];
  if (!yerel) return null;
  // Sorgu KAÇIRILIYOR: `&`, `"`, boşluk içeren sorgular (pmFed/pmInfl
  // gibi) adresi bozmasın.
  return 'https://news.google.com/rss/search'
    + `?q=${encodeURIComponent(metin)}`
    + `&hl=${yerel.hl}&gl=${yerel.gl}&ceid=${encodeURIComponent(yerel.ceid)}`;
}

/** Adres KENDİ izin listemizde mi (https + izinli konak). SAF. */
export function izinliAdres(adres) {
  let u;
  try { u = new URL(String(adres)); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

// ---------------------------------------------------------------------
//  XML KAÇIŞ ÇÖZÜMÜ — küçük ve kapalı küme. Tam bir HTML varlık tablosu
//  BİLEREK yazılmadı: RSS gövdesinde XML'in beş adlı varlığı ile sayısal
//  başvurular geçiyor, ötesi CDATA içinde kalıyor.
// ---------------------------------------------------------------------
function cozKacis(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // `&amp;` EN SONDA: önce çözülürse "&amp;lt;" gibi çift kaçışlı
    // metin yanlışlıkla etikete dönüşür.
    .replace(/&amp;/g, '&');
}

/** Tek etiketin iç metnini al (CDATA dâhil). İlk eşleşme. */
function etiket(blok, ad) {
  const m = blok.match(new RegExp(`<${ad}(?:\\s[^>]*)?>([\\s\\S]*?)</${ad}>`, 'i'));
  if (!m) return '';
  let iç = m[1];
  const cd = iç.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cd) iç = cd[1];
  return cozKacis(iç).replace(/\s+/g, ' ').trim();
}

/**
 * RSS/Atom gövdesini maddelere ayır.
 *
 * İKİZİ: app.js:164 `parseRSS`. O sürüm `DOMParser` ile çalışıyor ve
 * Node'da KOŞAMAZ; burada aynı iş regex ile yapılıyor. Alan kümesi
 * daraltıldı (`description`/`author` dönmüyor) — bu taşıyıcıyı
 * kullananlar yalnız manşet metni ve bağlantı istiyor.
 *
 * SAF: ağa çıkmaz, zaman okumaz. Bu yüzden dışa aktarılıyor —
 * tests/uc-test.mjs fikstürle ölçebiliyor.
 *
 * @param {string} xml
 * @param {number} azami  en çok kaç madde
 * @param {{symbol?:string}} [isaret]  maddeye yazılacak hisse kodu;
 *        verilmezse `symbol: null` (serbest metin sorgusunda madde bir
 *        hisseye AİT DEĞİLDİR — sorgu metni sembol yerine konmaz).
 * @returns {{title:string, link:string, pubDate:string, source:string,
 *            type:string, symbol:(string|null)}[]}
 */
export function ayristirRSS(xml, azami = VARSAYILAN_MADDE, isaret = {}) {
  const metin = String(xml ?? '');
  if (!metin) return [];
  const sinir = Math.max(0, Math.min(AZAMI_MADDE, Number(azami) || 0));
  if (!sinir) return [];

  // Parametre adi `isaret`, `etiket` DEGIL: modul duzeyinde ayni adli bir
  // yardimci var (etiket(blok, ad), satir 171) ve `etiket` adli bir parametre
  // onu GOLGELER — govdedeki her etiket(...) cagrisi TypeError atardi.
  // Etiket: boş dizge / boşluk SEMBOL DEĞİLDİR → null. Uydurma yok.
  const sembol = (isaret && isaret.symbol != null && String(isaret.symbol).trim())
    ? String(isaret.symbol).trim().toUpperCase()
    : null;

  // RSS <item> ve Atom <entry> — app.js de ikisini birlikte topluyor.
  const bloklar = metin.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];

  const out = [];
  for (const blok of bloklar) {
    if (out.length >= sinir) break;

    const title = etiket(blok, 'title');
    if (!title) continue; // başlıksız madde manşet değildir

    // RSS <link>adres</link> · Atom <link href="..."/> (app.js'in aynı
    // iki yollu okuması).
    let link = etiket(blok, 'link');
    if (!link || !/^https?:/i.test(link)) {
      const h = blok.match(/<link[^>]*\shref=["']([^"']+)["']/i);
      link = h ? cozKacis(h[1]) : '';
    }

    const pubDate = etiket(blok, 'pubDate')
      || etiket(blok, 'published')
      || etiket(blok, 'updated')
      || etiket(blok, 'dc:date');

    // Google News <source url="...">Yayıncı</source>. İç metin yayıncı
    // ADI; yoksa boş kalır (uydurulmaz).
    const source = etiket(blok, 'source');

    // type SABİT 'NEWS': bu taşıyıcının tek kaynağı Google News RSS.
    // 'KAP' buradan ÇIKMAZ (gerekçe: MADDE_ALANLARI yorumu).
    out.push({ title, link, pubDate, source, type: HABER_TURU, symbol: sembol });
  }
  return out;
}

/**
 * Tek beslemeyi çek ve ayrıştır. AĞA ÇIKAN TEK YER.
 *
 * Zaman aşımı AbortController ile; `fetch`in kendi varsayılanı yok,
 * olmadığında istek Vercel'in süre tavanına kadar asılı kalırdı.
 *
 * @param {string} q
 * @param {{market?:string, limit?:number, sayac?:object, symbol?:string}} [sec]
 *        `symbol` verilirse dönen her maddeye yazılır (çoklu sembol
 *        kipinde hisse↔haber eşlemesi BU alandır); verilmezse null.
 * @returns {Promise<{maddeler:object[], sayac:object, tam:boolean, adres:(string|null)}>}
 */
export async function haberCek(q, sec = {}) {
  const sayac = sec.sayac || bosHaberSayac();
  const adres = haberAdresi(q, sec.market || 'TR');

  // Geçersiz sorgu/pazar AĞA ÇIKMADAN düşüyor — ve `hata` sayılıyor,
  // sessiz boş dizi DÖNMÜYOR.
  if (!adres || !izinliAdres(adres)) {
    sayac.hata++;
    return { maddeler: [], sayac, tam: false, adres: null };
  }
  return beslemeCek(adres, { ...sec, sayac });
}

/**
 * TEK beslemeyi ADRESİYLE çek ve ayrıştır. AĞA ÇIKAN TEK YER.
 *
 * NİYE AYRI: `haberCek` adresi SORGUDAN kuruyordu, yani ağ gövdesi tek
 * bir adres biçimine kilitliydi. Gündem kipinin (aşağıda) adresleri
 * sorgudan DEĞİL sabit besleme listesinden geliyor. Gövdeyi ikinci kez
 * yazmak yerine buraya çıkardım: zaman aşımı, kimlik dizgesi, kısa gövde
 * kuralı ve sayaçlar İKİ kipte de BİREBİR aynı kaldı.
 *
 * Zaman aşımı AbortController ile; `fetch`in kendi varsayılanı yok,
 * olmadığında istek Vercel'in süre tavanına kadar asılı kalırdı.
 *
 * @param {string} adres  İzin listesinden GEÇMİŞ https adresi (çağıran doğrular).
 * @param {{limit?:number, sayac?:object, symbol?:string, kaynak?:string}} [sec]
 *        `symbol` verilirse dönen her maddeye yazılır · `kaynak` verilirse
 *        RSS'in kendi `source` alanı YOKSA yerine o ad yazılır.
 * @returns {Promise<{maddeler:object[], sayac:object, tam:boolean, adres:(string|null)}>}
 */
export async function beslemeCek(adres, sec = {}) {
  const sayac = sec.sayac || bosHaberSayac();
  const limit = Math.max(1, Math.min(AZAMI_MADDE, Number(sec.limit) || VARSAYILAN_MADDE));

  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), HABER_ISTEK_MS);
  sayac.istek++;
  try {
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        // Kimlik dizgesi SADE ve KİŞİSEL VERİ TAŞIMAZ (e-posta yok —
        // 9007fc3 commit'inin SEC kimliğinde kapattığı sızıntının aynısı
        // burada tekrarlanmasın).
        'Accept': 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'day-starter/1.0 (haber-okuyucu)',
      },
    });
    if (!r.ok) {
      sayac.hata++;
      return { maddeler: [], sayac, tam: false, adres };
    }
    const govde = await r.text();
    sayac.bayt += Buffer.byteLength(govde, 'utf8');

    // KISA GÖVDE = ÖLÇEMEDİM (başlıktaki gerekçe).
    if (Buffer.byteLength(govde, 'utf8') < ASGARI_GOVDE_BAYT) {
      sayac.kisa++;
      return { maddeler: [], sayac, tam: false, adres };
    }

    const maddeler = ayristirRSS(govde, limit, { symbol: sec.symbol });
    // `source` BOŞ kalan maddeye besleme adını yaz: Google News araması
    // kaynağı maddenin içinde veriyor, tek yayıncının beslemesi VERMİYOR.
    // Boş bırakmak "kaynağı ölçemedim" demek olurdu — oysa ölçtük, besleme
    // zaten o yayıncının.
    if (sec.kaynak) {
      for (const m of maddeler) if (!m.source) m.source = sec.kaynak;
    }
    sayac.basari++;
    // Sıfır madde ARIZA DEĞİL: geçerli bir besleme, o sorguda haber yok.
    return { maddeler, sayac, tam: haberTam(sayac), adres };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) sayac.zamanAsimi++;
    else sayac.hata++;
    return { maddeler: [], sayac, tam: false, adres };
  } finally {
    clearTimeout(zamanlayici);
  }
}

// ===========================================================================
//  GÜNDEM KİPİ — webin `general` sekmesinin SUNUCU KARŞILIĞI
// ===========================================================================
//
//  ÖLÇÜLEN EKSİK (2026-10-27): webin gündem sekmesi `config.js:57`
//  `window.GENERAL_FEEDS` üstünden 10 beslemeyi TARAYICIDAN `fetchRSS` ile
//  okuyor. Native'de o sekmenin karşılığı YOK, çünkü:
//    ① bu dosyanın tek kaynağı Google News ARAMA beslemesiydi — serbest
//       metin gerektiriyor, "gündem" bir arama sorgusu değil;
//    ② native'de RSS ayrıştırmak XML'i ince istemciye taşımak olurdu
//       (kabuk ince kalır kuralı).
//  Bu yüzden gündem SUNUCUDA toplanıyor, ekrana hazır `maddeler[]` iniyor.
//
//  KONAK GENİŞLEMESİ — SESSİZ DEĞİL, ÖLÇÜLDÜ: bu dosyanın başlığı
//  "Yarın ikinci bir haber konağı gerekirse ÖLÇÜLÜP buraya eklenir;
//  sessizce genişlemez" diyor. Aşağıdaki yedi konağın HEPSİ `api/proxy.js`
//  satır 70'teki izin listesinde ZATEN vardı — yani webin bugün okuduğu
//  küme. Yeni bir güven alanı AÇILMADI, var olan küme bu taşıyıcıya da
//  yazıldı. `tests/uc-test.mjs` iki listenin BİREBİRLİĞİNİ denetliyor.
//
//  ÖLÇÜM (curl, 2026-10-27, bu taşıyıcının kendi kimlik dizgesiyle):
//    bloomberght.com/rss            301 -> /rss/tum-haberler.xml  50 madde
//    dunya.com/rss?dunya            200   25 madde
//    cumhuriyet.com.tr/rss/ekonomi  200  100 madde
//    sozcu.com.tr/rss/ekonomi.xml   200   50 madde
//    rss.dw.com/rdf/rss-tur-eco     200   11 madde
//    feeds.bbci.co.uk/.../rss.xml   200   48 madde
//    cnbc.com/id/100003114/...      200   30 madde
//
//  LİSTEDEN ÇIKARILAN İKİ KALEM — gerekçe ölçüm, tahmin değil:
//    · T24 (`t24.com.tr/rss/category/ekonomi`): curl `000` döndü, yani
//      bağlantı HİÇ kurulamadı (DEVAM.md §4'te "403" diye kayıtlı; burada
//      daha kötüsü ölçüldü). Çalışmayan beslemeyi listeye koymak her
//      istekte bir zaman aşımı ödemek ve `tam:false` üretmek olurdu.
//      Teşhis ayrı şeritte sürüyor; düzelirse ÖLÇÜLÜP eklenir.
//    · Cumhuriyet'in webdeki adresi (`/rss/4.xml`): 301 ile `/rss/dunya`ya
//      gidiyor — yani web, EKONOMİ sanıp DÜNYA haberi basıyor. Buraya
//      ölçülmüş doğru adres (`/rss/ekonomi`, başlık "Cumhuriyet Gazetesi -
//      Ekonomi") yazıldı. Web tarafı AYRI bir düzeltme (G şeridi).
//
//  REUTERS/FT SATIRLARI ALINMADI: ikisi de Google News ARAMA adresi, yani
//  `?q=` kipinin ta kendisi. Gündem listesine koymak aynı kaynağı iki ayrı
//  kapıdan saymak olurdu.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ---------------------------------------------------------------------

/**
 * Gündem kipinin KENDİ konak izin listesi.
 * `api/proxy.js:70` kümesinin haber bölümüyle BİREBİR aynı olmalı
 * (`news.google.com` hariç — o `IZINLI_KONAK`ta, arama kipinin konağı).
 */
export const IZINLI_GUNDEM_KONAK = [
  'www.bloomberght.com',
  'www.dunya.com',
  'www.cumhuriyet.com.tr',
  'www.sozcu.com.tr',
  'rss.dw.com',
  'feeds.bbci.co.uk',
  'www.cnbc.com',
];

/**
 * Gündem beslemeleri, YEREL'e göre. `ad` EKRAN adı değil KAYNAK adı:
 * maddenin `source` alanı boşsa oraya yazılıyor (yayıncı beslemeleri
 * kaynağı madde içinde vermiyor).
 */
export const GUNDEM_BESLEMELER = {
  TR: [
    { ad: 'Bloomberg HT',        adres: 'https://www.bloomberght.com/rss/tum-haberler.xml' },
    { ad: 'Dünya Gazetesi',      adres: 'https://www.dunya.com/rss?dunya' },
    { ad: 'Cumhuriyet Ekonomi',  adres: 'https://www.cumhuriyet.com.tr/rss/ekonomi' },
    { ad: 'Sözcü Ekonomi',       adres: 'https://www.sozcu.com.tr/rss/ekonomi.xml' },
    { ad: 'DW Türkçe Ekonomi',   adres: 'https://rss.dw.com/rdf/rss-tur-eco' },
  ],
  US: [
    { ad: 'BBC Business',        adres: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
    { ad: 'CNBC Top News',       adres: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  ],
};

/** Gündem yerelleri — `PAZAR_YERELI`nin anahtarları DEĞİL, kendi kümesi. */
export const GUNDEM_YERELLER = Object.keys(GUNDEM_BESLEMELER);

/** Besleme başına kaç madde okunur. Fan-out × bu = havuz tavanı. SAF. */
export const GUNDEM_BESLEME_MADDE = 8;

/** Gündem adresi KENDİ izin listemizde mi (https + izinli konak). SAF. */
export function izinliGundemAdresi(adres) {
  if (typeof adres !== 'string' || !adres) return false;
  let u;
  try { u = new URL(adres); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_GUNDEM_KONAK.includes(u.hostname);
}

/**
 * Maddeleri TARİHE göre yeniden eskiye diz. Tarihi ÇÖZÜLEMEYEN madde
 * ATILMAZ, sona konur — "tarihini ölçemedim" ile "haber yok" ayrı şeyler.
 * SAF (girdi dizisini kopyalar).
 */
export function gundemSirala(maddeler) {
  const ts = (m) => {
    const t = Date.parse(String(m && m.pubDate ? m.pubDate : ''));
    return Number.isFinite(t) ? t : null;
  };
  return maddeler.slice().sort((a, b) => {
    const ta = ts(a); const tb = ts(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
}

/**
 * Aynı habere iki beslemeden gelen kopyayı düşür. ANAHTAR `link`, yoksa
 * `title`. Düşen madde SAYILIR (`dusen`) — sessizce yok olmaz. SAF.
 */
export function gundemTekille(maddeler) {
  const gorulen = new Set();
  const out = [];
  let dusen = 0;
  for (const m of maddeler) {
    const anahtar = String((m && m.link) || (m && m.title) || '').trim().toLowerCase();
    if (!anahtar) { out.push(m); continue; }
    if (gorulen.has(anahtar)) { dusen++; continue; }
    gorulen.add(anahtar);
    out.push(m);
  }
  return { maddeler: out, dusen };
}

/**
 * GÜNDEM: yerelin bütün beslemelerini PARALEL çek, tekille, tarihe göre
 * diz, `limit` kadar döndür.
 *
 * PARALEL ve `allSettled`: beslemelerden biri düşerse öteki dördü
 * basılmaya devam eder. Hangi beslemenin ne verdiği `besleme[]` dizisinde
 * AÇIKÇA duruyor — "5 kaynaktan 4'ü okundu" diyebilmek için. Sıralı
 * çekmek 5 × 6 sn = 30 sn ederdi, ucun 10 sn tavanının üstü.
 *
 * `tam` ANLAMI: her besleme okundu mu. Bir besleme düşmüşse `tam:false` —
 * ekran "eksik ölçüm" diyebilsin.
 *
 * @param {string} yerel 'TR' | 'US'
 * @param {{limit?:number, sayac?:object}} [sec]
 * @returns {Promise<{maddeler:object[], besleme:object[], sayac:object, tam:boolean, tekrar:number}>}
 */
export async function gundemCek(yerel, sec = {}) {
  const sayac = sec.sayac || bosHaberSayac();
  const limit = Math.max(1, Math.min(AZAMI_MADDE, Number(sec.limit) || VARSAYILAN_MADDE));
  const liste = GUNDEM_BESLEMELER[yerel];

  // Bilinmeyen yerel AĞA ÇIKMADAN düşüyor ve `hata` sayılıyor.
  if (!Array.isArray(liste) || liste.length === 0) {
    sayac.hata++;
    return { maddeler: [], besleme: [], sayac, tam: false, tekrar: 0 };
  }

  const sonuclar = await Promise.allSettled(liste.map((b) => {
    if (!izinliGundemAdresi(b.adres)) {
      sayac.hata++;
      return Promise.resolve({ maddeler: [], sayac, tam: false, adres: null });
    }
    return beslemeCek(b.adres, { limit: GUNDEM_BESLEME_MADDE, sayac, kaynak: b.ad });
  }));

  const besleme = [];
  let havuz = [];
  for (let i = 0; i < liste.length; i++) {
    const s = sonuclar[i];
    const d = s.status === 'fulfilled' ? s.value : null;
    const n = d && Array.isArray(d.maddeler) ? d.maddeler.length : 0;
    // `durum` MAKİNE KODU, Türkçe cümle değil — etiket istemcide.
    besleme.push({ ad: liste[i].ad, durum: n > 0 ? 'ok' : 'bos', adet: n });
    if (n > 0) havuz = havuz.concat(d.maddeler);
  }

  const tekil = gundemTekille(havuz);
  const sirali = gundemSirala(tekil.maddeler);
  const okunan = besleme.filter((b) => b.durum === 'ok').length;

  return {
    maddeler: sirali.slice(0, limit),
    besleme,
    sayac,
    // Her besleme okundu MU: biri düştüyse ölçüm EKSİK.
    tam: okunan === liste.length && haberTam(sayac),
    tekrar: tekil.dusen,
  };
}
