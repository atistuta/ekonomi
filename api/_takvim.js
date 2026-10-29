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
//  İki giriş: webin BUGÜN okuduğu iki kaynak. Yeni güven alanı
//  AÇILMADI — ikisi de `api/proxy.js`in `IZINLI_KONAKLAR` kümesinde
//  ZATEN vardı (ölçüm: api/proxy.js, satır ~70).
// ---------------------------------------------------------------------
export const IZINLI_KONAK = ['finans.mynet.com', 'temettuhisseleri.com'];

export const KAP_URL = 'https://finans.mynet.com/borsa/kaphaberleri/';
export const TEMETTU_URL = 'https://temettuhisseleri.com/temettutarihleri/';

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

// Kapsam beyaz listesi — SESSİZ GENİŞLEME YOK. 'hepsi' iki kaynağı da
// ister; tek kaynak istendiğinde ÖTEKİ ALAN GÖVDEDE HİÇ YOKTUR
// ("sorulmadı" ile "ölçemedim" ayrı şeyler).
export const KAPSAMLAR = ['hepsi', 'kap', 'temettu'];
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
export const TEMETTU_MADDE_ALANLARI = ['symbol', 'date', 'dateHam', 'amount', 'yieldPct', 'currency'];

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
  const blok = String(baslik ?? '').match(/\*\*\*([^*]+)\*\*\*/);
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
 * @returns {{maddeler:object[], atlanan:number, tekrar:number}}
 */
export function ayristirTemettu(html, azami = VARSAYILAN_TEMETTU) {
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
        'Accept': 'text/html,application/xhtml+xml',
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
  const r = await sayfaCek(TEMETTU_URL, { sayac });
  if (r.govde === null) return { maddeler: null, atlanan: null, tekrar: null, sayac };
  const a = ayristirTemettu(r.govde, azami);
  return { maddeler: a.maddeler, atlanan: a.atlanan, tekrar: a.tekrar, sayac };
}
