// ===========================================================================
//  api/_takvim.js — TAKVİM (KAP duyuruları + BIST temettü) TAŞIYICISI
//  ELLE YAZILMIŞTIR · ÜRETİLMİŞ DEĞİL
// ===========================================================================
//
//  NİYE AYRI BİR DOSYA — `api/_ag.js`e EKLENMEDİ:
//  `_ag.js`in `IZINLI` konak listesi SKOR ŞERİDİNİN güvenlik sözleşmesi
//  (query1/query2 finance.yahoo.com · www.sec.gov · data.sec.gov ·
//  www.isyatirim.com.tr). Bu dosyanın iki kaynağı skora HİÇ girdi
//  VERMİYOR: takvim bir sayı değil, bir TARİH LİSTESİ. `_ag.js`e
//  eklenirse ① skor şeridinin konak sözleşmesi skora girmeyen bir veri
//  için genişler, ② takvim kesintisi skor sayaçlarına karışır ve
//  "skoru ölçemedim" ile "takvimi ölçemedim" ayırt edilemez olur.
//  Bu yüzden takvimin KENDİ taşıyıcısı var — `api/_haber.js`in kurduğu
//  kalıbın aynısı: KENDİ konak izin listesi, KENDİ zaman aşımı, KENDİ
//  sayaçları. `_ag.js` AÇILMADI, DEĞİŞTİRİLMEDİ.
//
//  BU DOSYA SKORA DOKUNMAZ: tek bir eşik, ağırlık, çarpan ya da skor
//  alanı taşımıyor. Skor zinciri (/api/score ⊂ recommend ⊂ analyze ⊂
//  compare) bu dosyayı İÇE ALMIYOR.
//
//  NİYE YENİ BİR UÇ GEREKTİ (ölçüldü, 2026-10-29):
//  Webin iki takvim kaynağı TARAYICIDAN HTML kazıyor:
//    · `fetchMynetKAP()`      app.js:229 → finans.mynet.com/borsa/kaphaberleri/
//    · `parseTemettuHtml()`   app.js:324 → temettuhisseleri.com/temettutarihleri/
//  Sunucuda bu iki HTML'i AYRIŞTIRAN hiçbir şey yoktu: `api/proxy.js`
//  yalnız HAM HTML'i geçiriyor (`?url=`), motorda da bu iki ayrıştırıcı
//  YOK (ölçüm: `grep parseTemettuHtml api/_motor.js` boş; `tools/
//  motor-uret.mjs`in `DILIMLER` beyaz listesi onları almıyor). Yani ince
//  istemci Türkçe ay adlı HTML kazımayı BAŞTAN yazmak zorunda kalıyordu.
//  Bu dosya o işi sunucuya taşıyor; ekrana `[]` listeleri iniyor.
//
//  13. FONKSİYON TUZAĞI: bu dosya `_` önekli, yani Vercel ROTA SAYMIYOR.
//  Yeni uç `vercel.json` yeniden-yazımı ile `/api/proxy?__rota=takvim`e
//  bağlanıyor; `api/*.js` uç dosyası sayısı 12'de KALDI (Hobby tavanı).
//
//  BOŞ / KISA GÖVDE = "ÖLÇEMEDİM", "duyuru yok" DEĞİL: 200 dönen ama
//  `ASGARI_GOVDE_BAYT`ın altında kalan bir cevap (vekil hata sayfası,
//  kesik aktarım) sayacı `kisa`ya yazar ve `tam` false olur.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

// ---------------------------------------------------------------------
//  KONAK İZİN LİSTESİ — KENDİ listesi, `_ag.js`in listesi DEĞİL.
//  ÜÇ giriş: webin BUGÜN okuduğu iki TR kaynağı + Federal Reserve’in
//  KENDİ yayınladığı takvim JSON’u.
//
//  GÜVEN ALANI — DÜRÜST KAYIT (2026-11-25 güncellendi):
//  · `finans.mynet.com` ve `temettuhisseleri.com` ZATEN `api/proxy.js`in
//    `IZINLI_KONAKLAR` kümesindeydi; onlar için yeni alan AÇILMADI.
//  · `www.federalreserve.gov` YENİDİR ve bu bir GENİŞLEMEDİR. Konak
//    `api/proxy.js`e DE eklendi — o dosyanın kendi kuralı bunu
//    emrediyor ("yeni bir kaynak eklerken konağı buraya da ekle,
//    yoksa 403 alırsın"). Yani güven alanı TEK yerde ilan ediliyor,
//    iki liste birbirinden kaymıyor.
//  · GEREKÇE (ölçüm, DEVAM.md §21): ileriye dönük ABD olay takvimi
//    için BELGELİ, resmî ve ANAHTARSIZ çalışan TEK kaynak Fed’in
//    kendi `calendar.json`u. BLS .ics 403, Census .ics gövdesi HTML
//    (0 olay), Nasdaq uç noktası yalnız GEÇMİŞ veriyor,
//    TradingEconomics misafir anahtarı 410 Gone.
//  · `_ag.js` HÂLÂ AÇILMADI, DEĞİŞTİRİLMEDİ.
// ---------------------------------------------------------------------
export const IZINLI_KONAK = ['finans.mynet.com', 'temettuhisseleri.com', 'www.federalreserve.gov'];

export const KAP_URL = 'https://finans.mynet.com/borsa/kaphaberleri/';
export const TEMETTU_URL = 'https://temettuhisseleri.com/temettutarihleri/';
// ABD OLAY TAKVİMİ — Fed’in KENDİ yayınladığı JSON. ÖLÇÜM 2026-11-25:
// 200, 550 608 bayt, 2618 olay; gövde UTF-8 BOM ile BAŞLIYOR (bu yüzden
// ayrıştırıcı `JSON.parse` öncesi baştaki \uFEFF’i kırpıyor).
export const FED_TAKVIM_URL = 'https://www.federalreserve.gov/json/calendar.json';

// Zaman aşımı 10000 ms · ÖLÇÜM: webin kendi tavanları 8000 (mynet,
// app.js:231) ve 10000 (temettü, app.js:309). İkisinin BÜYÜĞÜ alındı ki
// hiçbir kaynak webde başarılı olurken burada zaman aşımına düşmesin.
// ARİTMETİK: iki sayfa PARALEL çekiliyor, en kötü hâl 10 sn + ayrıştırma;
// `api/proxy.js`in `maxDuration` tavanı 30 sn, altında kalıyor — uç
// "zaman aşımı" diye dürüst bir sayaçla dönebiliyor, Vercel'in cevabı
// kesmesini beklemiyoruz.
export const TAKVIM_ISTEK_MS = 10000;

// 1024 bayt · ARİTMETİK: iki kaynağın ikisi de SUNUCU TARAFI render
// edilmiş tam bir HTML sayfası (<head> + navigasyon bile bunun çok
// üstünde). Altında kalan gövde sayfa değil, bir hata/vekil cevabıdır.
export const ASGARI_GOVDE_BAYT = 1024;

// KAP madde tavanı 60 · ÖLÇÜM: mynet'in KAP haberleri sayfası tek
// sayfada 50 duyuru listeliyor (app.js:227 yorumu: "50 son KAP
// duyurusu"). 60 bunun rahat üstü, "sınırsız" değil.
export const AZAMI_KAP = 60;
export const VARSAYILAN_KAP = 30;

// Temettü madde tavanı 400 · ÖLÇÜM: kaynak sayfa 12 ayın tamamını tek
// HTML'de veriyor; BIST'te temettü dağıtan şirket sayısı 300 bandında,
// bir şirket yıl içinde birden çok taksit ödeyebiliyor. 400 bunun üstü.
export const AZAMI_TEMETTU = 400;
export const VARSAYILAN_TEMETTU = 120;

// ABD olay tavanı 200 · ÖLÇÜM: Fed takviminde 2026-11’den İLERİ 47 olay
// SATIRI var, ama birkaçı VİRGÜLLÜ gün listesi taşıyor (H.15 tek satırda
// 19 gün, Aralık'ta 22) — satır başına birden çok madde çıkıyor. Kasım +
// Aralık için ölçülen madde sayısı 170 bandında. 200 bunun rahat üstü,
// "sınırsız" DEĞİL.
export const AZAMI_ABD = 200;
export const VARSAYILAN_ABD = 60;

// Kapsam beyaz listesi — SESSİZ GENİŞLEME YOK. 'hepsi' ÜÇ kaynağı da
// ister (TR KAP + TR temettü + ABD olay takvimi); tek kapsam
// istendiğinde ÖTEKİ ALANLAR GÖVDEDE HİÇ YOKTUR ("sorulmadı" ile
// "ölçemedim" ayrı şeyler).
// 'abd' 2026-11-25'te EKLENDİ. Mevcut üç değerin ADI ve ANLAMI
// DEĞİŞMEDİ; yalnız 'hepsi'nin KAPSAMI büyüdü ve bu burada YAZILI.
export const KAPSAMLAR = ['hepsi', 'kap', 'temettu', 'abd'];
export const VARSAYILAN_KAPSAM = 'hepsi';

// ---------------------------------------------------------------------
//  SAAT DİLİMİ — TAHMİN DEĞİL, SABİT VE GEREKÇELİ.
//  Kaynak sayfa saati TÜRKİYE YEREL saatiyle basıyor ("08 Haz 2026
//  11:01"); sunucu ise Vercel'de UTC koşuyor. `new Date(y, m, d, h, mi)`
//  KOŞAN MAKİNENİN diliminde kurar — webde tarayıcı TR olduğu için
//  doğru, sunucuda 3 saat KAYMIŞ çıkardı. Bu yüzden ISO dizgesi ELLE
//  kuruluyor ve dilim AÇIKÇA yazılıyor. Türkiye 2016'dan beri kalıcı
//  UTC+03:00 kullanıyor (yaz saati uygulaması YOK), yani tek bir sabit
//  offset bütün yıl geçerli.
// ---------------------------------------------------------------------
export const TAKVIM_SAAT_DILIMI = '+03:00';

// Para birimi MAKİNE KODU olarak dönüyor ('TRY'), ekran simgesi (`₺`)
// olarak DEĞİL: biçimleme istemcinin işi (HAM SAYI KURALI).
export const PARA_BIRIMI = 'TRY';

// Dönen maddelerin alan kümeleri BURADA yazılı — kaynak yarın yeni bir
// kolon eklediğinde sözleşmemiz sessizce büyümesin.
export const KAP_MADDE_ALANLARI = ['title', 'link', 'pubDate', 'pubDateHam', 'source', 'type', 'symbol', 'tickers'];
// `paid` 2026-10-29'da EKLENDİ (ikizi app.js:6681 `paid: d.date <= today`).
// Mevcut altı alanın ADI/BİRİMİ/TİPİ DEĞİŞMEDİ — `yieldPct` hâlâ YÜZDE
// PUANI, ×100 yapılmamış.
export const TEMETTU_MADDE_ALANLARI = ['symbol', 'date', 'dateHam', 'amount', 'yieldPct', 'currency', 'paid'];

// `type` DEĞERİ: `api/_haber.js`in `HABER_TURLERI` kümesindeki 'KAP'.
// O dosya 'KAP'ı ilan ediyor ama ÜRETEMİYOR ("tek kaynağı Google News
// RSS ve KAP duyurusu oradan GELMEZ", _haber.js:92). Üreten taşıyıcı
// BURASI. Madde alan adları da bilerek `_haber.js`in `MADDE_ALANLARI`
// kümesiyle ÖRTÜŞÜYOR ki istemci haber akışı ile KAP akışını aynı
// listede, aynı süzgeçlerle (`newsFilterSymbol`/`newsFilterType`)
// gösterebilsin.
export const TAKVIM_TURU = 'KAP';
export const KAP_KAYNAK = 'Mynet Finans';

// ---------------------------------------------------------------------
//  ABD OLAY TAKVİMİ SÖZLEŞMESİ
//
//  ETKİ DERECESİ (Investing.com’un üç boğası gibi) BASILMIYOR: böyle bir
//  derece HİÇBİR ücretsiz, belgeli kaynakta yok (Econoday ve Trading
//  Economics ücretli; Investing.com kazımak kullanım şartlarına aykırı).
//  Uydurulmuş bir derece ÖLÇÜLMEYEN SAYI olurdu — basılmaz.
//
//  `canli` BOOLEAN: Fed’in `live` alanı ÜÇÜNCÜ TARAF bir yayın adresi
//  (Teams / Zoom / YouTube / cvent / frbsf). Adres UCA GİTMİYOR, yalnız
//  "canlı yayını var mı" olgusu geçiyor.
// ---------------------------------------------------------------------
export const ABD_KAYNAK = 'Federal Reserve';
export const ABD_MADDE_ALANLARI = ['date', 'an', 'saatHam', 'title', 'tur', 'canli', 'kaynak'];

// Kaynağın `type` değerleri (ÖLÇÜM 2026-11-25, 2618 olay üzerinde:
// Stat 1059 · Speeches 603 · events 569 · FOMC 135 · Other 105 ·
// Testimony 74 · Beige 56 · Conferences 10 · Board 6 · None 1) KENDİ
// küçük harfli kod kümemize çevriliyor. Tanınmayan değer 'diger' olur —
// madde ATILMAZ, çünkü tür bilinmemesi olayın yok olması değildir.
export const ABD_TUR_ESLEME = Object.freeze({
  fomc: 'fomc', stat: 'veri', beige: 'bej', speeches: 'konusma',
  testimony: 'ifade', board: 'kurul', conferences: 'konferans',
  events: 'etkinlik', other: 'diger', none: 'diger',
});

// ---------------------------------------------------------------------
//  TÜRKÇE AY TABLOLARI — İKİZLERİ app.js:230 (`TR_MON`, kısa) ve
//  app.js:293 (`TR_MONTHS_IDX`, tam). Biri değişirse öteki de gözden
//  geçirilmeli. İki ayrı tablo, çünkü iki kaynak iki ayrı biçim
//  basıyor: mynet "Haz", temettuhisseleri "Haziran".
// ---------------------------------------------------------------------
export const TR_AY_KISA = Object.freeze({
  oca: 0, şub: 1, sub: 1, mar: 2, nis: 3, may: 4, haz: 5,
  tem: 6, ağu: 7, agu: 7, eyl: 8, eki: 9, kas: 10, ara: 11,
});

export const TR_AY_TAM = Object.freeze({
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4,
  haziran: 5, temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
});

/**
 * Sayaç kabı. `_ag.js`in sayaç FİKRİ (ölçtüm / ölçemedim ayrımı) ödünç
 * alındı, NESNESİ değil: takvim kesintisi skor sayacına karışmasın.
 */
export function bosTakvimSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

/** Sayaç "tam" mı: hiç hata/zaman aşımı/kısa gövde yok mu. SAF. */
export function takvimTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

/** Adres KENDİ izin listemizde mi (https + izinli konak). SAF. */
export function izinliTakvimAdresi(adres) {
  if (typeof adres !== 'string' || !adres) return false;
  let u;
  try { u = new URL(adres); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  return IZINLI_KONAK.includes(u.hostname);
}

// ---------------------------------------------------------------------
//  HTML VARLIK ÇÖZÜMÜ — İKİZİ app.js:233 (`decode`). Küme BİREBİR
//  taşındı; genişletilmedi, çünkü ölçülen gövdede geçen küme bu.
//  Sayısal başvurular (`&#231;`) EKLENDİ: adlı varlık tablosu kaynağın
//  bugünkü çıktısını kapsıyor ama sayısal biçim her an gelebilir ve
//  çözülmemiş "&#231;" başlıkta ÇÖP metin olarak görünürdü.
// ---------------------------------------------------------------------
export function cozVarlik(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&Ccedil;/g, 'Ç').replace(/&ccedil;/g, 'ç')
    .replace(/&Ouml;/g, 'Ö').replace(/&ouml;/g, 'ö')
    .replace(/&Uuml;/g, 'Ü').replace(/&uuml;/g, 'ü')
    .replace(/&Auml;/g, 'Ä').replace(/&auml;/g, 'ä')
    .replace(/&Iuml;/g, 'İ').replace(/&iuml;/g, 'i')
    .replace(/&Eacute;/g, 'É').replace(/&eacute;/g, 'é')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // `&amp;` EN SONDA: önce çözülürse "&amp;quot;" gibi çift kaçışlı
    // metin yanlışlıkla varlığa dönüşür.
    .replace(/&amp;/g, '&');
}

/** İki haneye yastıkla. SAF. */
function ikiHane(n) {
  return String(n).padStart(2, '0');
}

/**
 * "08 Haz 2026 11:01" → "2026-06-08T11:01:00+03:00".
 *
 * ÇÖZÜLEMEYEN TARİH `null` DÖNER — `new Date()` DEĞİL. Bu, webden
 * BİLEREK AYRILAN tek davranış: app.js:244 `parseDate` biçim
 * tutmadığında ŞU ANI döndürüyor, yani ÖLÇÜLMEMİŞ bir zamanı ölçülmüş
 * gibi basıyor. Uçta bu yasak (ÖLÇÜLMEYEN SAYI DÖNDÜRÜLMEZ): tarihi
 * okunamayan duyuru atılmıyor, `pubDate: null` ile dönüyor ve ham metni
 * `pubDateHam`da duruyor — istemci "tarihi yok" diyebilsin.
 *
 * SAF: ağa çıkmaz, SAATİ OKUMAZ (Date.now yok), koşan makinenin saat
 * dilimine BAKMAZ. Bu yüzden dışa aktarılıyor — tests/uc-test.mjs
 * fikstürle ölçebiliyor.
 *
 * @param {string} s  kaynaktaki ham tarih metni
 * @returns {string|null} ISO 8601 + açık offset, ya da null
 */
export function kapZamani(s) {
  const m = String(s ?? '').match(/(\d{1,2})\s+([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s+(20\d{2})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const ay = TR_AY_KISA[m[2].toLowerCase().slice(0, 3)];
  if (ay == null) return null;
  const gun = Number(m[1]);
  const saat = Number(m[4]);
  const dakika = Number(m[5]);
  // Aralık denetimi: kaynağın bozuk bastığı bir satır takvimi
  // kaydırmasın. Uydurma düzeltme YOK — geçersizse null.
  if (gun < 1 || gun > 31 || saat > 23 || dakika > 59) return null;
  return `${m[3]}-${ikiHane(ay + 1)}-${ikiHane(gun)}`
    + `T${ikiHane(saat)}:${ikiHane(dakika)}:00${TAKVIM_SAAT_DILIMI}`;
}

/**
 * Başlıktan hisse kodlarını çıkar. İKİZİ app.js:255.
 * KAP başlığı kodları yıldızlar arasında veriyor: `***IZFAS***`, ya da
 * çoklu: `***OMP ** ODP***`.
 *
 * ÖLÇTÜM-VE-YOK = `[]` (boş dizi), null DEĞİL: başlıkta yıldız bloğu
 * yoksa duyuru şirket bildirimi değildir (endeks/genel duyuru) ve bunu
 * ölçmüş oluruz.
 *
 * SAF.
 * @param {string} baslik
 * @returns {string[]}
 */
export function kapSemboller(baslik) {
  // İKİZ REGEX — app.js:257 ile BİREBİR. ÖLÇÜM (2026-10-30, canlı
  // /api/takvim?kapsam=hepsi, 30 KAP maddesi): eski `[^*]+` bloğu
  // `***GRFIN ** EMVAR***` biçimini EŞLEMİYOR ve 16/30 maddede
  // `symbol: null` basılıyordu — null kalan 16 maddenin 16'sı DA bu
  // biçimdi, başka kaçırılan biçim YOK. Tembel `[\s\S]+?` blok İÇİNDEKİ
  // iki-yıldız ayraçları geçer, kapanış hâlâ ÜÇ yıldız arar (`***A*** x
  // ***B***` iki bloğu BİRLEŞTİRMEZ). Aynı 30 maddede sonuç: 16 düzeldi,
  // 0 null kaldı, önceden ayrışan 14 maddede değişiklik YOK.
  const blok = String(baslik ?? '').match(/\*\*\*([\s\S]+?)\*\*\*/);
  if (!blok) return [];
  return blok[1].split(/[\s*,]+/).filter((t) => /^[A-Z][A-Z0-9]{1,5}$/.test(t));
}

/**
 * Mynet KAP haberleri sayfasını maddelere ayır.
 *
 * İKİZİ: app.js:229 `fetchMynetKAP`. O sürüm tarayıcıda `fetchVia` ile
 * çalışıyor; buradaki aynı regex ile aynı işi SUNUCUDA yapıyor. İki
 * ayrılık, ikisi de GEREKÇELİ:
 *   ① çözülemeyen tarih `null` (yukarıdaki `kapZamani` yorumu);
 *   ② `description: ''` ve `author: 'KAP'` alanları DÖNMÜYOR — ikisi de
 *      sabit, yani ölçüm değil; `author`ın taşıdığı bilgi `type: 'KAP'`
 *      alanında makine kodu olarak duruyor.
 *
 * SAF: ağa çıkmaz, saati okumaz. Bu yüzden dışa aktarılıyor.
 *
 * @param {string} html
 * @param {number} azami  en çok kaç madde
 * @returns {{title:string, link:string, pubDate:(string|null),
 *            pubDateHam:string, source:string, type:string,
 *            symbol:(string|null), tickers:string[]}[]}
 */
export function ayristirKAP(html, azami = VARSAYILAN_KAP) {
  const metin = String(html ?? '');
  if (!metin) return [];
  const sinir = Math.max(0, Math.min(AZAMI_KAP, Number(azami) || 0));
  if (!sinir) return [];

  // İKİZ REGEX — app.js:232 ile BİREBİR.
  const re = /<a\s+href="(https:\/\/finans\.mynet\.com\/borsa\/haberdetay\/[^"]+)"[^>]*title="([^"]+)"[^>]*>\s*<em class="title">[^<]*<\/em>\s*<span class="date">([^<]+)<\/span>/g;

  const out = [];
  let m;
  while ((m = re.exec(metin)) !== null) {
    if (out.length >= sinir) break;
    const title = cozVarlik(m[2]).replace(/\s+/g, ' ').trim();
    if (!title) continue; // başlıksız madde duyuru değildir
    const pubDateHam = String(m[3]).replace(/\s+/g, ' ').trim();
    const tickers = kapSemboller(title);
    out.push({
      title,
      link: m[1],
      pubDate: kapZamani(pubDateHam),
      pubDateHam,
      source: KAP_KAYNAK,
      type: TAKVIM_TURU,
      // `symbol`: haber akışının süzgeci TEK kod okuyor (_haber.js
      // MADDE_ALANLARI). Çoklu bildirimde İLK kod yazılıyor, tamamı
      // `tickers`ta duruyor. Kod yoksa `null` — boş dizge DEĞİL.
      symbol: tickers.length ? tickers[0] : null,
      tickers,
    });
  }
  return out;
}

/**
 * Ondalık metni sayıya çevir. İKİZİ app.js:341/342
 * (`parseFloat(x.replace(',', '.'))`).
 *
 * DAVRANIŞ BİREBİR KORUNDU (binlik ayraç DÜZELTİLMEDİ): kaynak Türkçe
 * biçim bastığında ("1.234,56") bu çevrim ilk noktayı ondalık sayar.
 * Burada "düzeltmek", webin bastığı sayı ile ucun bastığı sayıyı
 * AYIRMAK olurdu — ölçmeden yapılacak bir ayrılık değil. İkizlik notu:
 * app.js düzeltilirse burası da düzeltilmeli.
 *
 * SAF. Sayı çıkmazsa `null` (0 DEĞİL).
 * @param {string} s
 * @returns {number|null}
 */
export function ondalik(s) {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Epoch ms → Türkiye yerel takvim günü, `YYYY-MM-DD`.
 *
 * NİYE ELLE: `toISOString()` UTC basar; sunucu UTC koştuğu için TR'de
 * 29 Ekim 01:00 olan an UTC'de hâlâ 28 Ekim'dir ve o gün ödenen temettü
 * "ödenmedi" görünürdü. Offset `TAKVIM_SAAT_DILIMI` ile AÇIK (TR
 * 2016'dan beri kalıcı UTC+03:00, yaz saati yok — dosya başındaki not).
 *
 * NİYE `Date` NESNESİ KULLANILMIYOR: bu dosyanın sözleşmesi "saat
 * okumaz" (tests/uc-test.mjs ⑯c ve ⑯k `new Date(`/`Date.now(`
 * geçmediğini DENETLİYOR). Bu yüzden gün→takvim çevrimi tamsayı
 * aritmetiğiyle yapılıyor (Hinnant `civil_from_days`; 1970-01-01'i
 * 0 sayan gün numarası ↔ Gregoryen tarih, artık yıl kuralı dâhil).
 *
 * SAF: saati KENDİ OKUMAZ, `ms` DIŞARIDAN gelir. Bu yüzden dışa
 * aktarılıyor — test sabit bir anla ölçebiliyor.
 *
 * @param {number} ms  epoch milisaniye
 * @returns {string|null} `YYYY-MM-DD`, ölçülemezse null
 */
export function trTakvimGunu(ms) {
  // +03:00 · TAKVIM_SAAT_DILIMI ile AYNI sayı.
  return gunKaydirmali(ms, 3 * 3600 * 1000);
}

/**
 * Epoch ms → `YYYY-MM-DD`, VERİLEN sabit kaydırma altında.
 *
 * `trTakvimGunu` bu gövdeyi ÇAĞIRIYOR; ABD tarafı da öyle. Yirmi satır
 * takvim aritmetiği İKİ KEZ yazılmasın diye ayrıldı — iki kopya
 * birbirinden kayabilirdi ve bu sayı ÖNBELLEK ANAHTARINA giriyor.
 *
 * SAF: ağa çıkmaz, SAATİ OKUMAZ (`Date.now` yok), koşan makinenin saat
 * dilimine BAKMAZ. Dışa aktarılıyor çünkü tests/uc-test.mjs ölçüyor.
 *
 * @param {number} ms          epoch milisaniye
 * @param {number} kaydirmaMs  UTC’den kaydırma, milisaniye
 * @returns {string|null} `YYYY-MM-DD`, ölçülemezse null
 */
export function gunKaydirmali(ms, kaydirmaMs) {
  if (!Number.isFinite(ms) || !Number.isFinite(kaydirmaMs)) return null;
  const gun = Math.floor((ms + kaydirmaMs) / 86400000);
  if (!Number.isFinite(gun)) return null;
  // 719468 = 1970-01-01'in 0000-03-01 köklü gün sayısı (Mart başlangıçlı
  // takvimde artık gün yılın SONUNDA kalır, bölme düzgünleşir).
  const z = gun + 719468;
  const cag = Math.floor(z / 146097);            // 400 yıllık çağ
  const cg = z - cag * 146097;                   // çağ içindeki gün
  const cy = Math.floor((cg - Math.floor(cg / 1460) + Math.floor(cg / 36524)
    - Math.floor(cg / 146096)) / 365);           // çağ içindeki yıl
  const yd = cg - (365 * cy + Math.floor(cy / 4) - Math.floor(cy / 100)); // yıl günü
  const ap = Math.floor((5 * yd + 2) / 153);     // Mart köklü ay (0=Mart)
  const d = yd - Math.floor((153 * ap + 2) / 5) + 1;
  const ay = ap + (ap < 10 ? 3 : -9);            // 1..12
  const yil = cy + cag * 400 + (ay <= 2 ? 1 : 0);
  return `${yil}-${ikiHane(ay)}-${ikiHane(d)}`;
}

/**
 * Haftanın günü (0 = Pazar) — Sakamoto. SAF, tablo tabanlı, `Date` YOK.
 *
 * ELLE DOĞRULANDI: 2026-01-01 → 4 (Perşembe) · 2026-03-01 → 0 (Pazar) ·
 * 2026-11-01 → 0 (Pazar) · 2026-11-24 → 2 (Salı).
 *
 * Dışa AKTARILMIYOR: tek işi `abdOffset`e hizmet etmek ve o ölçülüyor.
 */
function haftaninGunu(y, m, d) {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let yy = y;
  if (m < 3) yy -= 1;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400)
    + t[m - 1] + d) % 7;
}

/**
 * ABD Doğu yakası offseti (`-04:00` yaz / `-05:00` kış) — TAKVİM
 * KURALINDAN, tabloya bakmadan.
 *
 * KURAL (ABD federal yasası, 2007’den beri): yaz saati MART’IN İKİNCİ
 * PAZARI başlar, KASIM’IN İLK PAZARI biter. 2026 için bu kural
 * 2026-03-08 ve 2026-11-01 veriyor (yukarıdaki elle doğrulanmış
 * `haftaninGunu` ölçümleriyle tutarlı).
 *
 * SINIR: geçiş SABAH 02:00’da olur; burada GÜN çözünürlüğü var, yani
 * geçiş gününün 00:00–02:00 aralığı için offset 1 saat sapabilir. Fed
 * takviminde Pazar sabahı 02:00’a yazılı TEK bir olay YOK (ölçüm:
 * 2618 olayın en erken saati 09:00), bu yüzden sapma pratikte
 * ULAŞILMIYOR. Yazılı duruyor ki sessiz kalmasın.
 *
 * SAF. `TAKVIM_SAAT_DILIMI` TR içindir; bu ABD içindir, ikisi AYRI.
 *
 * @param {string} tarih `YYYY-MM-DD`
 * @returns {string} '-04:00' | '-05:00'
 */
export function abdOffset(tarih) {
  if (typeof tarih !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return null;
  const y = Number(tarih.slice(0, 4));
  const m = Number(tarih.slice(5, 7));
  const d = Number(tarih.slice(8, 10));
  if (m > 3 && m < 11) return '-04:00';          // Nisan–Ekim: kesin yaz
  if (m < 3 || m === 12) return '-05:00';        // Ocak, Şubat, Aralık: kesin kış
  if (m === 3) {
    const ilkPazar = 1 + ((7 - haftaninGunu(y, 3, 1)) % 7);
    return d >= ilkPazar + 7 ? '-04:00' : '-05:00';   // İKİNCİ pazar
  }
  const ilkPazar = 1 + ((7 - haftaninGunu(y, 11, 1)) % 7);   // m === 11
  return d < ilkPazar ? '-04:00' : '-05:00';
}

/**
 * ABD Doğu yakası YEREL günü (`YYYY-MM-DD`) — `trTakvimGunu`nun ikizi.
 *
 * NEDEN GEREKLİ: ileriye dönük süzgeç "bugünden önce olanı göstermem"
 * diyor ve "bugün" ABD takvimi için ABD günüdür. TR gününü kullanmak
 * Türkiye akşamı ile ABD öğleden sonrası arasında bir GÜN kaydırır,
 * yani o günün Fed açıklaması ekrandan sessizce düşerdi.
 *
 * Offset, UTC medeni gününden seçiliyor (tavuk-yumurta kırılıyor):
 * yaz/kış sınırı gün içinde değil gün ölçeğinde kararlaştığı için bu
 * seçim yalnız geçiş gününün ilk saatlerinde sapabilir — `abdOffset`in
 * SINIR notuyla aynı, pratikte ulaşılmayan hâl.
 *
 * SAF: saati OKUMAZ, ms’yi ÇAĞIRANDAN alır.
 */
export function abdTakvimGunu(ms) {
  if (!Number.isFinite(ms)) return null;
  const utcGun = gunKaydirmali(ms, 0);
  if (!utcGun) return null;
  const off = abdOffset(utcGun);
  if (!off) return null;
  const saat = Number(off.slice(1, 3));          // 4 | 5
  if (!Number.isFinite(saat)) return null;
  return gunKaydirmali(ms, -saat * 3600 * 1000);
}

/**
 * Fed takviminin saat alanını (`'2:00 p.m.'`) `HH:MM`e çevir.
 *
 * ÖLÇÜM 2026-11-25 (2618 olayın `time` histogramı): biçim TEK TİP —
 * `H:MM a.m.` / `H:MM p.m.` ya da BOŞ DİZGE. En sık değerler '4:15 p.m.'
 * (452), '2:00 p.m.' (282), '' (245), '4:30 p.m.' (224). Serbest metin,
 * "(approximate)" eki, 24 saatlik biçim YOK.
 *
 * ÇÖZÜLEMEYEN SAAT `null` DÖNER — 00:00 DEĞİL. "Saati yok" ile "gece
 * yarısı" aynı şey değil ve BOŞ SAAT NORMALDİR (resmî tatiller ve bazı
 * Stat satırları saatsiz yayımlanıyor).
 *
 * SAF.
 * @returns {string|null} `HH:MM`
 */
export function abdSaat(ham) {
  if (typeof ham !== 'string') return null;
  const m = ham.trim().match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i);
  if (!m) return null;
  const h12 = Number(m[1]);
  const dk = Number(m[2]);
  if (!Number.isInteger(h12) || h12 < 1 || h12 > 12) return null;
  if (!Number.isInteger(dk) || dk > 59) return null;
  const s = (h12 % 12) + (m[3].toLowerCase() === 'p' ? 12 : 0);
  return `${ikiHane(s)}:${ikiHane(dk)}`;
}

/**
 * Bu temettü ÖDENDİ Mİ — İKİZİ app.js:6681 (`paid: d.date <= today`).
 *
 * TARİH KARŞILAŞTIRMASI BİR OLGUDUR, türetme değil: eşik, ağırlık ya da
 * karar cümlesi taşımıyor. Web `Date` nesnesi karşılaştırıyor; burada iki
 * `YYYY-MM-DD` dizgesi SÖZLÜK SIRASIYLA karşılaştırılıyor — sabit genişlikli
 * ISO tarihte bu AYNI sonucu verir ve saat diliminden bağımsızdır.
 * BUGÜN ÖDENEN `true` (web de `<=` kullanıyor, `<` değil).
 *
 * Ölçülemeyen `null` DÖNER, `false` DEĞİL: "bilmiyorum" ile "henüz
 * ödenmedi" aynı şey değil.
 *
 * SAF.
 * @param {string|null} tarih  maddenin `date` alanı
 * @param {string|null} bugun  karşılaştırma günü (`YYYY-MM-DD`)
 * @returns {boolean|null}
 */
export function temettuOdendi(tarih, bugun) {
  const g = /^(20\d{2})-(\d{2})-(\d{2})$/;
  if (typeof tarih !== 'string' || !g.test(tarih)) return null;
  if (typeof bugun !== 'string' || !g.test(bugun)) return null;
  return tarih <= bugun;
}

/**
 * temettuhisseleri.com temettü takvimi sayfasını maddelere ayır.
 *
 * İKİZİ: app.js:324 `parseTemettuHtml`. Regexler ve ay↔satır eşleme
 * mantığı BİREBİR taşındı. İki ayrılık, ikisi de GEREKÇELİ:
 *   ① `date` bir `Date` NESNESİ değil `YYYY-MM-DD` DİZGESİ: `new
 *      Date(y, m, d)` koşan makinenin diliminde gece yarısı kurar,
 *      sunucu UTC olduğu için JSON'a bir GÜN KAYMIŞ inebilirdi. Dizge
 *      kurmak dilimden bağımsız.
 *   ② `currency` `'₺'` yerine `'TRY'`: uç ekran simgesi değil makine
 *      kodu döndürür (HAM SAYI KURALI).
 *
 * ÖLÇÜLEMEYEN SATIR ATLANIR (`continue`), uydurulmaz: ay adı
 * tablolarda yoksa ya da tutar sayı değilse o satır listeye girmez.
 * Atlanan satır sayısı dönüşte `atlanan`da DURUYOR — sessizce yok olmaz.
 *
 * SAF: ağa çıkmaz, saati okumaz. Bu yüzden dışa aktarılıyor.
 *
 * @param {string} html
 * @param {number} azami
 * @param {string|null} [bugun]  `YYYY-MM-DD` — `paid` için karşılaştırma
 *        günü. VERİLMEZSE `paid: null` (uydurma "ödenmedi" YOK). Saat
 *        buradan OKUNMUYOR; çağıran veriyor, fonksiyon SAF kalıyor.
 * @returns {{maddeler:object[], atlanan:number, tekrar:number}}
 */
export function ayristirTemettu(html, azami = VARSAYILAN_TEMETTU, bugun = null) {
  const metin = String(html ?? '');
  const sinir = Math.max(0, Math.min(AZAMI_TEMETTU, Number(azami) || 0));
  if (!metin || !sinir) return { maddeler: [], atlanan: 0, tekrar: 0 };

  // İKİZ REGEXLER — app.js:337-338 ile BİREBİR.
  const ayBasligiRe = /colspan=['"]2['"][^>]*>\s*([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s+(20\d{2})\s*</g;
  const satirRe = /href=['"]\/hisseanaliz\/([A-Z0-9]+)['"][^>]*>[^<]*<\/a>\s*<\/td>\s*<td[^>]*>\s*(\d{1,2})\s+([A-Za-zÇĞİıÖŞÜçğıöşü]+)\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>\s*%\s*([\d.,]+)\s*<\/span>\s*<\/td>\s*<td[^>]*>\s*([\d.,]+)\s*₺/g;

  // Ay başlıklarının KONUMLARI: satırın yılı, kendisinden ÖNCE gelen en
  // son ay başlığından okunuyor (kaynak yılı satırda vermiyor).
  const isaretler = [];
  let mh;
  while ((mh = ayBasligiRe.exec(metin)) !== null) {
    const ay = TR_AY_TAM[mh[1].toLowerCase()];
    if (ay == null) continue;
    isaretler.push({ pos: mh.index, ay, yil: Number(mh[2]) });
  }
  isaretler.sort((a, b) => a.pos - b.pos);

  const out = [];
  const gorulen = new Set();
  let atlanan = 0;
  let tekrar = 0;
  let rm;
  while ((rm = satirRe.exec(metin)) !== null) {
    if (out.length >= sinir) break;
    const sembol = rm[1];
    const gun = Number(rm[2]);
    const satirAy = TR_AY_TAM[rm[3].toLowerCase()];
    const verimYuzde = ondalik(rm[4]);
    const tutar = ondalik(rm[5]);
    if (satirAy == null || tutar === null) { atlanan++; continue; }
    if (gun < 1 || gun > 31) { atlanan++; continue; }

    // Satırdan önceki en son ay başlığının YILI.
    let yil = null;
    for (let i = isaretler.length - 1; i >= 0; i--) {
      if (isaretler[i].pos < rm.index) { yil = isaretler[i].yil; break; }
    }
    // Yılı OLMAYAN satır atlanıyor: "bu yıl" diye varsaymak uydurma olur.
    if (yil == null) { atlanan++; continue; }

    const tarih = `${yil}-${ikiHane(satirAy + 1)}-${ikiHane(gun)}`;
    // Tekilleştirme anahtarı — İKİZİ app.js:365.
    const anahtar = `${sembol}|${tarih}|${Math.round(tutar * 10000)}`;
    if (gorulen.has(anahtar)) { tekrar++; continue; }
    gorulen.add(anahtar);

    out.push({
      symbol: sembol,
      date: tarih,
      // Ham metin DURUYOR: tarih kurulurken yıl TABLO BAŞLIĞINDAN
      // geldi, satırdan değil — istemci istersen kaynağı görebilsin.
      dateHam: `${rm[2]} ${rm[3]}`,
      amount: tutar,
      // Verim ÖLÇÜLEMEDİYSE null, 0 DEĞİL.
      yieldPct: verimYuzde,
      currency: PARA_BIRIMI,
      // GEÇMİŞ/GELECEK DİLİMİ: istemci `paid` ile kendi ikiye bölüyor
      // (ikizi app.js:6690 — gelecek üstte, geçmiş altta). Uçta sıralama
      // ya da "yakın geçmiş" penceresi YOK; o bir EKRAN kararı.
      paid: temettuOdendi(tarih, bugun),
    });
  }
  return { maddeler: out, atlanan, tekrar };
}

/**
 * TEK sayfayı çek. AĞA ÇIKAN TEK YER.
 *
 * Zaman aşımı AbortController ile; `fetch`in kendi varsayılanı yok,
 * olmadığında istek Vercel'in süre tavanına kadar asılı kalırdı.
 *
 * @param {string} adres  izin listesinden geçmiş https adresi
 * @param {{sayac?:object}} [sec]
 * @returns {Promise<{govde:(string|null), sayac:object}>}
 *          `govde: null` = OKUNAMADI. Boş dizge DÖNMEZ.
 */
export async function sayfaCek(adres, sec = {}) {
  const sayac = sec.sayac || bosTakvimSayac();
  if (!izinliTakvimAdresi(adres)) {
    // Ağa ÇIKMADAN düşüyor ve `hata` SAYILIYOR — sessiz boş cevap yok.
    sayac.hata++;
    return { govde: null, sayac };
  }

  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), TAKVIM_ISTEK_MS);
  sayac.istek++;
  try {
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        // Kimlik dizgesi SADE ve KİŞİSEL VERİ TAŞIMAZ (e-posta yok —
        // 9007fc3 commit'inin SEC kimliğinde kapattığı sızıntının
        // aynısı burada tekrarlanmasın).
        // ABD takvimi JSON döndürüyor; `sec.kabul` verilmezse ESKİ
        // davranış (HTML) AYNEN sürüyor — iki TR kaynağı etkilenmiyor.
        'Accept': typeof sec.kabul === 'string' && sec.kabul
          ? sec.kabul : 'text/html,application/xhtml+xml',
        'User-Agent': 'day-starter/1.0 (takvim-okuyucu)',
      },
    });
    if (!r.ok) {
      sayac.hata++;
      return { govde: null, sayac };
    }
    const govde = await r.text();
    const bayt = Buffer.byteLength(govde, 'utf8');
    sayac.bayt += bayt;
    // KISA GÖVDE = ÖLÇEMEDİM (başlıktaki gerekçe).
    if (bayt < ASGARI_GOVDE_BAYT) {
      sayac.kisa++;
      return { govde: null, sayac };
    }
    sayac.basari++;
    return { govde, sayac };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) sayac.zamanAsimi++;
    else sayac.hata++;
    return { govde: null, sayac };
  } finally {
    clearTimeout(zamanlayici);
  }
}

/**
 * KAP duyurularını çek + ayrıştır.
 * @returns {Promise<{maddeler:(object[]|null), sayac:object}>}
 *   `maddeler: null` = OKUNAMADI · `[]` = ÖLÇTÜM, DUYURU YOK.
 */
export async function kapCek(sec = {}) {
  const sayac = sec.sayac || bosTakvimSayac();
  const azami = Number(sec.azami) || VARSAYILAN_KAP;
  const r = await sayfaCek(KAP_URL, { sayac });
  if (r.govde === null) return { maddeler: null, sayac };
  return { maddeler: ayristirKAP(r.govde, azami), sayac };
}

/**
 * Temettü takvimini çek + ayrıştır.
 * @returns {Promise<{maddeler:(object[]|null), atlanan:(number|null),
 *                    tekrar:(number|null), sayac:object}>}
 */
export async function temettuCek(sec = {}) {
  const sayac = sec.sayac || bosTakvimSayac();
  const azami = Number(sec.azami) || VARSAYILAN_TEMETTU;
  // `bugun` ÇAĞIRANDAN gelir (rota `trTakvimGunu(Date.now())` veriyor);
  // verilmezse `paid` alanı null kalır, uydurulmaz.
  const bugun = typeof sec.bugun === 'string' ? sec.bugun : null;
  const r = await sayfaCek(TEMETTU_URL, { sayac });
  if (r.govde === null) return { maddeler: null, atlanan: null, tekrar: null, sayac };
  const a = ayristirTemettu(r.govde, azami, bugun);
  return { maddeler: a.maddeler, atlanan: a.atlanan, tekrar: a.tekrar, sayac };
}

/**
 * FED TAKVİM JSON’unu AYRIŞTIR — SAF, ağa çıkmaz, saati okumaz.
 *
 * GÖVDE ŞEKLİ (ölçüm): `{"events":[{title, time, month:"YYYY-MM", days,
 * type, description, location, live, link}]}`. Gövde UTF-8 BOM ile
 * başlıyor — `JSON.parse` BOM’da patlar, bu yüzden kırpılıyor.
 *
 * VİRGÜLLÜ GÜN LİSTESİ: `days` tek bir gün değil, `"4,5,6"` gibi bir
 * LİSTE olabiliyor (H.15 Kasım’da 19, Aralık’ta 22 gün). Her gün AYRI
 * madde çıkıyor; tek madde basmak o ayın geri kalan tarihlerini
 * sessizce yok ederdi.
 *
 * SAATSİZ OLAY ATLANMAZ: `an` null kalır, `atlanan` ARTMAZ. Resmî tatil
 * ve bazı Stat satırları saatsiz yayımlanıyor (ölçüm: 245 boş `time`).
 *
 * İLERİ SÜZGEÇ: `ileriGun` verilirse ondan ÖNCEKİ tarihler listeden
 * düşer ve bu bir ÖLÇÜMDÜR, arıza değil — `atlanan`a YAZILMAZ.
 * `atlanan` yalnız BOZUK satırı sayar (ay biçimi tutmayan, başlıksız,
 * geçerli günü olmayan).
 *
 * ÖLÇÜLMÜŞ: `atlanan` YÜKSEK ve bu NORMAL. 2026-11-25 gövdesinde 2618
 * satırın 570’i `month: ""` ile geliyor; 569’unun hepsi
 * `type: "events"`, biri `type` alanı olmayan tek satır. Ay yoksa
 * tarih kurulamaz, yani bu satırlar TAKVİME KONULAMAZ. Üstelik 570’in
 * 370’i, ayı OLAN bir satırın aynı başlık+gün kopyası — Fed kendi
 * "events" kovasında aynı olayı tarihsiz ikinci kez listeliyor.
 * Dolayısıyla 570 bir ARIZA İMİ DEĞİL; kaynağın biçimi. Yine de
 * sayılıyor, çünkü "kaç satır okunamadı" sorusunun cevabı
 * sessizce kaybolmasın.
 *
 * @param {string} metin     ham JSON gövdesi
 * @param {number} azami     madde tavanı
 * @param {string|null} ileriGun  `YYYY-MM-DD`; verilirse öncesi düşer
 * @returns {{maddeler:object[], atlanan:number}}
 */
export function ayristirFedTakvim(metin, azami = VARSAYILAN_ABD, ileriGun = null) {
  const sinir = Math.max(0, Math.min(AZAMI_ABD, Number(azami) || 0));
  if (typeof metin !== 'string' || !metin || !sinir) return { maddeler: [], atlanan: 0 };
  let kok = null;
  try { kok = JSON.parse(metin.replace(/^\uFEFF/, '')); } catch { return { maddeler: [], atlanan: 0 }; }
  const olaylar = kok && Array.isArray(kok.events) ? kok.events : null;
  if (!olaylar) return { maddeler: [], atlanan: 0 };
  const sinirGun = typeof ileriGun === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ileriGun)
    ? ileriGun : null;

  const toplanan = [];
  let atlanan = 0;
  for (const o of olaylar) {
    const ay = o && typeof o.month === 'string' ? o.month.trim() : '';
    if (!/^\d{4}-\d{2}$/.test(ay)) { atlanan++; continue; }
    // Başlıklarda ÖLÇÜLEN kir: sonda ve ortada çift boşluk
    // ('G.5 - Foreign Exchange Rates  ', 'Speech -  Governor ...').
    const baslik = o && typeof o.title === 'string' ? o.title.replace(/\s+/g, ' ').trim() : '';
    if (!baslik) { atlanan++; continue; }
    const gunlerHam = o && (typeof o.days === 'string' || typeof o.days === 'number')
      ? String(o.days) : '';
    const gunler = gunlerHam.split(',').map((g) => g.trim())
      .filter((g) => /^\d{1,2}$/.test(g) && Number(g) >= 1 && Number(g) <= 31);
    if (!gunler.length) { atlanan++; continue; }
    const turHam = o && typeof o.type === 'string' ? o.type.trim().toLowerCase() : '';
    const tur = ABD_TUR_ESLEME[turHam] || 'diger';
    const saatHam = o && typeof o.time === 'string' && o.time.trim() ? o.time.trim() : null;
    const saat = saatHam ? abdSaat(saatHam) : null;
    // Üçüncü taraf yayın ADRESİ uca GİTMİYOR, yalnız var/yok olgusu.
    const canli = !!(o && typeof o.live === 'string' && o.live.trim());
    for (const g of gunler) {
      const tarih = `${ay}-${ikiHane(Number(g))}`;
      if (sinirGun && tarih < sinirGun) continue;
      toplanan.push({
        date: tarih,
        an: saat ? `${tarih}T${saat}:00${abdOffset(tarih)}` : null,
        saatHam,
        title: baslik,
        tur,
        canli,
        kaynak: ABD_KAYNAK,
      });
    }
  }
  // Tarihe göre ARTAN; aynı gün içinde saati olanlar saate göre, saatsiz
  // olanlar sona. Kaynak sırası GARANTİLİ DEĞİL, ekran sırası olmalı.
  toplanan.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const as = a.an || '~';
    const bs = b.an || '~';
    return as < bs ? -1 : as > bs ? 1 : 0;
  });
  return { maddeler: toplanan.slice(0, sinir), atlanan };
}

/**
 * ABD olay takvimini çek + ayrıştır.
 *
 * SAYACA YENİ ALAN EKLEMEZ: `bosTakvimSayac()` altı anahtarıyla kalıyor
 * (tests/uc-test.mjs ⑯i bunu KİLİTLİYOR). Üç kaynak AYNI sayaca yazıyor —
 * "kaç istek, kaçı düştü" sorusu kaynak başına değil GÖVDE başına.
 *
 * @returns {Promise<{maddeler:(object[]|null), atlanan:(number|null), sayac:object}>}
 *   `maddeler: null` = OKUNAMADI · `[]` = ÖLÇTÜM, OLAY YOK.
 */
export async function abdCek(sec = {}) {
  const sayac = sec.sayac || bosTakvimSayac();
  const azami = Number(sec.azami) || VARSAYILAN_ABD;
  // `bugun` ÇAĞIRANDAN gelir (rota `abdTakvimGunu(Date.now())` veriyor);
  // verilmezse süzgeç KAPALI kalır ve GEÇMİŞ olaylar da döner — uydurma yok.
  const bugun = typeof sec.bugun === 'string' ? sec.bugun : null;
  const r = await sayfaCek(FED_TAKVIM_URL, { sayac, kabul: 'application/json' });
  if (r.govde === null) return { maddeler: null, atlanan: null, sayac };
  const a = ayristirFedTakvim(r.govde, azami, bugun);
  return { maddeler: a.maddeler, atlanan: a.atlanan, sayac };
}
