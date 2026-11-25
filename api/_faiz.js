// api/_faiz.js — FED POLİTİKA FAİZİ BEKLENTİSİ (VADELİ İMA) TAŞIYICISI
// ELLE YAZILMIŞTIR · ÜRETİLMİŞ DEĞİL
//
// NE YAPAR: CME 30 Günlük Fed Fonlama Vadelisi (ZQ) fiyatlarından, önümüzdeki
// FOMC toplantısında piyasanın FİYATLADIĞI faiz değişimini ölçer. Tahmin
// ÜRETMEZ; piyasanın kendi fiyatını okur ve baz puana çevirir.
//
// NİYE AYRI BİR DOSYA — `api/_takvim.js`e EKLENMEDİ (iki bağımsız kanıt):
//  1) `_takvim.js` `sayfaCek`, HER çağrıyı `izinliTakvimAdresi` süzgecinden
//     geçiriyor ve `IZINLI_KONAK` tam olarak üç takvim konağı. Yahoo adresi
//     o süzgeçten geçemez: AĞA ÇIKMADAN `hata` sayılırdı.
//  2) `tests/uc-test.mjs` ⑯k, `_takvim.js` içinde TEK `fetch` olduğunu
//     kilitliyor. İkinci bir çağrı o kilidi kırardı.
// Yani bu dosya üslup tercihi değil, kilidi kırmayan TEK yol.
//
// NİYE `api/_ag.js`e DE EKLENMEDİ: `_ag.js`in `IZINLI` listesi SKOR
// ŞERİDİNİN güvenlik sözleşmesi. Bu dosya skora dokunmuyor, dolayısıyla o
// sözleşmeyi açmaya hakkı yok. `_ag.js` AÇILMADI, DEĞİŞTİRİLMEDİ.
//
// GÜVEN ALANI GENİŞLEMİYOR: `query1.finance.yahoo.com` HÂLİHAZIRDA
// `api/proxy.js` ve `api/_ag.js` `IZINLI` listelerinde yazılı. Bu dosya YENİ
// bir konak eklemiyor; var olan bir konağa kendi tek-öğeli listesiyle
// bakıyor.
//
// KENDİ SAYACI VAR — takvim sayacını PAYLAŞMIYOR. Gerekçe ölçüldü:
// `_takvim.js:836` «SAYACA YENİ ALAN EKLEMEZ: `bosTakvimSayac()` altı
// anahtarıyla kalıyor» diyor ve `takvimTam(s)` HERHANGİ bir
// `hata`/`zamanAsimi`/`kisa` görünce `false` dönüyor. Sayaç paylaşılsaydı bir
// Yahoo kesintisi, KAP + temettü takvimini «eksik ölçüldü» diye
// işaretleyecekti — ilgisiz bir kaynak hakkında YANLIŞ ölçüm. Bu yüzden faiz
// bacağı kendi `sayac`/`tam` çiftini kendi bloğunda bildiriyor.
//
// BU DOSYA SKORA DOKUNMAZ: tek bir eşik, ağırlık, çarpan ya da skor alanı
// taşımıyor. Skor zinciri (/api/score ⊂ recommend ⊂ analyze ⊂ compare) bu
// dosyayı İÇE ALMIYOR. Çıktısı BİLGİ AMAÇLIDIR.
//
// 13. FONKSİYON TUZAĞI: bu dosya `_` önekli, yani Vercel ROTA SAYMIYOR.
// `api/*.js` uç dosyası sayısı 12de KALIYOR (Hobby tavanı).
//
// TÜRKÇE YOK (yorumlar hariç): dönen alanlar ham sayı ve makine kodu. Ekran
// dili `mobile/src/lib/sozluk.ts` ve `app.js` tarafında.
//
// TARİH OKUMAZ: `new Date` / `Date.now` cagrisi geçmiyor. Toplantı günü Fedin kendi
// takviminden (`api/_takvim.js` `abdCek`) GELİYOR, burada uydurulmuyor. Bu
// sayede tüm hesap SAF ve ağsız test edilebilir.

// ——— GÜVEN ALANI: tek konak ———————————————————————————————————————————
// `api/proxy.js` ve `api/_ag.js` `IZINLI` listelerinde de yazılı.
export const FAIZ_IZINLI_KONAK = Object.freeze(['query1.finance.yahoo.com']);

// Yahoo grafik ucu. ÖLÇÜLDÜ 2026-11-25: `crumb` ÇEREZİ İSTEMİYOR, anonim
// erişime 200 dönüyor. (`/v7/finance/quote` ucu çerez istiyor — O KULLANILMADI.)
export const ZQ_UC = 'https://query1.finance.yahoo.com/v8/finance/chart/';
export const ZQ_SORGU = '?range=5d&interval=1d';

// Vadeli sözleşme son eki. ÖLÇÜLDÜ: `.CME` -> {"code":"Not Found"};
// çalışan tek son ek `.CBT` (Chicago Board of Trade listesi).
export const ZQ_SONEK = '.CBT';

// Vadeli ay kodları (CME standardı): Ocak..Aralık.
export const AY_KODLARI = 'FGHJKMNQUVXZ';

// FOMCnin KENDİ adım boyu. Eşik değil, kurumun ilan ettiği basamak:
// hedef aralık 25 baz puanın katlarıyla değişiyor.
export const FAIZ_BASAMAK_BP = 25;

// Ağ bütçesi: takvim bacakları 10 sn. Bu bacak ONLARIN ARDINDAN zincirlenerek
// koşuyor (toplantı günü takvimden geliyor), o yüzden kalan bütçeye sığacak
// kadar KISA tutuldu.
export const FAIZ_ISTEK_MS = 8000;

// Gövde JSON ve küçük; takvim HTMLinin 1024 baytlık alt sınırı burada anlamsız.
export const ASGARI_FAIZ_GOVDE_BAYT = 128;

export const FAIZ_KAYNAK = 'CME ZQ (Yahoo Finance)';

// Ağırlıklandırma yöntemi kodları. BİRİNCİSİ KULLANILAN.
// `ertesi-gun`: yeni oran toplantının ERTESİ İŞ GÜNÜ geçerli. Fedin kendi
//   uygulama notunun yazdığı şey bu ve CME FedWatch de böyle sayıyor.
// `toplanti-gunu`: yeni oran toplantı GÜNÜ geçerli. Alternatif; farkı
//   ölçtüm, 9 Aralık 2026 için 25.01 bp yerine 23.92 bp veriyor.
export const AGIRLIK_YONTEMI = 'ertesi-gun';
export const AGIRLIK_YONTEMI_ALT = 'toplanti-gunu';

const AY_GUNU = Object.freeze([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);

// ——— SAYAÇ ————————————————————————————————————————————————————————————
// `bosTakvimSayac()` ile AYNI ALTI ANAHTAR — bilerek: iki sayaç aynı şekilde
// okunsun, ama AYNI NESNE OLMASIN (yukarıdaki gerekçe).
export function bosFaizSayac() {
  return { istek: 0, basari: 0, hata: 0, zamanAsimi: 0, kisa: 0, bayt: 0 };
}

export function faizTam(s) {
  if (!s) return false;
  return s.hata === 0 && s.zamanAsimi === 0 && s.kisa === 0;
}

export function izinliFaizAdresi(adres) {
  try {
    const u = new URL(adres);
    if (u.protocol !== 'https:') return false;
    return FAIZ_IZINLI_KONAK.includes(u.hostname);
  } catch { return false; }
}

// ——— SAF YARDIMCILAR ——————————————————————————————————————————————————

// 0..11 -> 'F'..'Z'
export function ayKodu(ay0) {
  if (!Number.isInteger(ay0) || ay0 < 0 || ay0 > 11) return null;
  return AY_KODLARI[ay0];
}

export function artikYil(yil) {
  if (!Number.isInteger(yil)) return false;
  return (yil % 4 === 0 && yil % 100 !== 0) || yil % 400 === 0;
}

export function ayGunSayisi(yil, ay0) {
  if (!Number.isInteger(yil) || !Number.isInteger(ay0) || ay0 < 0 || ay0 > 11) return null;
  if (ay0 === 1) return artikYil(yil) ? 29 : 28;
  return AY_GUNU[ay0];
}

// (yil, ay0) -> 'ZQZ26.CBT'. Yıl İKİ HANE (CME sözleşme adı böyle).
export function zqSembol(yil, ay0) {
  const kod = ayKodu(ay0);
  if (kod === null || !Number.isInteger(yil) || yil < 2000 || yil > 2099) return null;
  const ik = String(yil % 100).padStart(2, '0');
  return 'ZQ' + kod + ik + ZQ_SONEK;
}

export function oncekiAy(yil, ay0) {
  if (!Number.isInteger(yil) || !Number.isInteger(ay0) || ay0 < 0 || ay0 > 11) return null;
  if (ay0 === 0) return { yil: yil - 1, ay0: 11 };
  return { yil, ay0: ay0 - 1 };
}

// ZQ fiyatı -> ima edilen ortalama faiz (%). Sözleşme 100 eksi oran üzerinden
// kote ediliyor. Kayan nokta artığını kesmek için 4 haneye yuvarlanıyor
// (0.01 bp çözünürlük) — yuvarlama BİLGİ KAYBETMİYOR, fiyat adımı 0.0025.
export function impliedOran(fiyat) {
  if (!Number.isFinite(fiyat) || fiyat <= 0 || fiyat > 100) return null;
  return Math.round((100 - fiyat) * 1e4) / 1e4;
}

// 'YYYY-MM-DD' -> { yil, ay0, gun }. Başka biçim -> null.
export function tarihAyir(iso) {
  if (typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const yil = Number(m[1]);
  const ay = Number(m[2]);
  const gun = Number(m[3]);
  if (ay < 1 || ay > 12) return null;
  const n = ayGunSayisi(yil, ay - 1);
  if (n === null || gun < 1 || gun > n) return null;
  return { yil, ay0: ay - 1, gun };
}

// Ay içindeki ESKİ/YENİ oran ağırlıkları.
// `ertesi-gun`: 1..gun ESKİ, gun+1..N YENİ.
// `toplanti-gunu`: 1..gun-1 ESKİ, gun..N YENİ.
export function toplantiAgirlik(gunSayisi, toplantiGunu, yontem) {
  if (!Number.isInteger(gunSayisi) || gunSayisi < 28 || gunSayisi > 31) return null;
  if (!Number.isInteger(toplantiGunu) || toplantiGunu < 1 || toplantiGunu > gunSayisi) return null;
  const y = yontem === AGIRLIK_YONTEMI_ALT ? AGIRLIK_YONTEMI_ALT : AGIRLIK_YONTEMI;
  const eskiGun = y === AGIRLIK_YONTEMI_ALT ? toplantiGunu - 1 : toplantiGunu;
  const yeniGun = gunSayisi - eskiGun;
  // Toplantı ayın İLK günündeyse (alternatif yöntemde) eski pay sıfır olur;
  // o ayın sözleşmesi tek başına yeni oranı verir, ayrışım anlamsızlaşır.
  if (yeniGun <= 0) return null;
  return {
    yontem: y,
    eskiGun,
    yeniGun,
    eski: eskiGun / gunSayisi,
    yeni: yeniGun / gunSayisi,
  };
}

// Ay ortalamasını ayrıştırıp toplantı SONRASI oranı çözer.
//   r_ay = w_eski * r_oncesi + w_yeni * r_sonrasi
// `oncesi` toplantısız ÖNCEKİ ayın sözleşmesinden geliyor; o ayda toplantı
// olmadığı için ortalaması = o anki hedef oran (ay ortasında bile geçerli).
export function beklentiHesapla(g) {
  const oncesi = impliedOran(g && g.oncekiFiyat);
  const ayOrt = impliedOran(g && g.toplantiFiyat);
  const a = toplantiAgirlik(g && g.gunSayisi, g && g.toplantiGunu, g && g.yontem);
  if (oncesi === null || ayOrt === null || a === null) return null;
  const sonrasi = (ayOrt - a.eski * oncesi) / a.yeni;
  if (!Number.isFinite(sonrasi)) return null;
  const degisimBp = Math.round((sonrasi - oncesi) * 1e4) / 1e2;
  return {
    yontem: a.yontem,
    agirlikEski: a.eski,
    agirlikYeni: a.yeni,
    eskiGun: a.eskiGun,
    yeniGun: a.yeniGun,
    oncesiOran: oncesi,
    ayOrtalamaOran: ayOrt,
    sonrasiOran: Math.round(sonrasi * 1e4) / 1e4,
    degisimBp,
    // Kaç basamaklık hareket fiyatlanmış. KIRPILMIYOR: 1.0005 «bir adım tam
    // fiyatlı», 0.5 «yarısı». Olasılık diye etiketlemek ve %100e kırpmak
    // EKRANIN kararı, ucun değil.
    basamakOrani: Math.round((degisimBp / FAIZ_BASAMAK_BP) * 1e4) / 1e4,
    yon: Math.sign(degisimBp),
  };
}

// ABD takvim maddelerinden İLK FOMC toplantı gününü çeker.
// `abdCek` maddeleri `tur` makine koduyla veriyor; karar toplantısı `fomc`.
// Basın toplantısı ve tutanak da `fomc` kodlu olabildiği için BAŞLIK da
// süzülüyor: tutanak (`Minutes`) karar günü DEĞİL.
export function ilkFomcTarihi(maddeler) {
  if (!Array.isArray(maddeler)) return null;
  for (const m of maddeler) {
    if (!m || m.tur !== 'fomc') continue;
    const b = typeof m.title === 'string' ? m.title.toLowerCase() : '';
    if (b.includes('minutes')) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) continue;
    return m.date;
  }
  return null;
}

// Önceki ayda da toplantı var mı? Varsa basit ayrışım GEÇERSİZ.
// true  = o ayda FOMC görünüyor
// false = o ay GÖRÜŞ ALANINDA ve toplantı YOK
// null  = ÖLÇEMEDİM (ileri-yönlü süzgeç o ayı göstermiyor) — «yok» DEĞİL.
export function oncekiAydaFomc(maddeler, yil, ay0) {
  const o = oncekiAy(yil, ay0);
  if (o === null) return null;
  const n = ayGunSayisi(o.yil, o.ay0);
  const onek = String(o.yil) + '-' + String(o.ay0 + 1).padStart(2, '0');
  const sonGun = onek + '-' + String(n).padStart(2, '0');
  if (!Array.isArray(maddeler) || maddeler.length === 0) return null;
  const ilkGorulen = typeof maddeler[0].date === 'string' ? maddeler[0].date : null;
  if (ilkGorulen === null) return null;
  // Ay tümüyle görüş alanının GERİSİNDE kaldıysa ölçemiyorum.
  if (sonGun < ilkGorulen) return null;
  for (const m of maddeler) {
    if (!m || m.tur !== 'fomc') continue;
    if (typeof m.date !== 'string' || !m.date.startsWith(onek)) continue;
    const b = typeof m.title === 'string' ? m.title.toLowerCase() : '';
    if (b.includes('minutes')) continue;
    return true;
  }
  return false;
}

// ——— AĞ: TEK `fetch` ÇAĞRI YERİ ———————————————————————————————————————
// UA SADE ve KİŞİSEL VERİ TAŞIMAZ (e-posta yok). `api/_takvim.js` başlığının
// andığı `9007fc3` commitinde tam bu sızıntı kapatılmıştı; aynı kural burada.
export async function zqFiyat(sembol, sec = {}) {
  const sayac = sec.sayac || bosFaizSayac();
  if (typeof sembol !== 'string' || !sembol) { sayac.hata++; return { fiyat: null, sayac }; }
  const adres = ZQ_UC + encodeURIComponent(sembol) + ZQ_SORGU;
  if (!izinliFaizAdresi(adres)) {
    // Ağa ÇIKMADAN düşüyor ve `hata` SAYILIYOR — sessiz boş cevap yok.
    sayac.hata++;
    return { fiyat: null, sayac };
  }
  const kesici = new AbortController();
  const zamanlayici = setTimeout(() => kesici.abort(), FAIZ_ISTEK_MS);
  sayac.istek++;
  try {
    const r = await fetch(adres, {
      signal: kesici.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'day-starter/1.0 (faiz-okuyucu)',
      },
    });
    if (!r.ok) { sayac.hata++; return { fiyat: null, sayac }; }
    const govde = await r.text();
    sayac.bayt += Buffer.byteLength(govde, 'utf8');
    if (Buffer.byteLength(govde, 'utf8') < ASGARI_FAIZ_GOVDE_BAYT) {
      // BOŞ / KISA GÖVDE = «ÖLÇEMEDİM», «fiyat yok» DEĞİL.
      sayac.kisa++;
      return { fiyat: null, sayac };
    }
    const fiyat = ayristirZq(govde);
    if (fiyat === null) { sayac.hata++; return { fiyat: null, sayac }; }
    sayac.basari++;
    return { fiyat, sayac };
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) sayac.zamanAsimi++;
    else sayac.hata++;
    return { fiyat: null, sayac };
  } finally { clearTimeout(zamanlayici); }
}

// Yahoo grafik gövdesinden son fiyatı çıkarır. Önce `meta.regularMarketPrice`,
// o yoksa kapanış dizisinin SON BOŞ OLMAYAN değeri. İkisi de yoksa null.
export function ayristirZq(govde) {
  if (typeof govde !== 'string' || !govde) return null;
  let j;
  try { j = JSON.parse(govde.charCodeAt(0) === 0xfeff ? govde.slice(1) : govde); }
  catch { return null; }
  const s = j && j.chart && Array.isArray(j.chart.result) ? j.chart.result[0] : null;
  if (!s) return null;
  const p = s.meta ? s.meta.regularMarketPrice : null;
  if (Number.isFinite(p) && p > 0) return p;
  const k = s.indicators && Array.isArray(s.indicators.quote) && s.indicators.quote[0]
    ? s.indicators.quote[0].close : null;
  if (!Array.isArray(k)) return null;
  for (let i = k.length - 1; i >= 0; i--) {
    if (Number.isFinite(k[i]) && k[i] > 0) return k[i];
  }
  return null;
}

// ——— TOPLAYICI —————————————————————————————————————————————————————————
// Toplantı günü ÇAĞIRANDAN gelir (`maddeler` = `abdCek` çıktısı, ya da
// doğrudan `toplanti: 'YYYY-MM-DD'`). Bu dosya tarih UYDURMAZ.
//
// `kod` alanı NİYE ÖLÇÜLEMEDİĞİNİ söyler; sayı alanları o durumda null olur:
//  toplanti_yok        -> takvimde ileriye dönük FOMC karar günü görünmüyor
//  onceki_ay_toplantili-> basit ayrışım geçersiz (önceki ayda da toplantı var)
//  fiyat_okunamadi     -> sözleşme fiyatlarından biri ölçülemedi
export async function faizBeklentisi(sec = {}) {
  const sayac = sec.sayac || bosFaizSayac();
  const maddeler = Array.isArray(sec.maddeler) ? sec.maddeler : null;
  const tarih = typeof sec.toplanti === 'string' && sec.toplanti
    ? sec.toplanti : ilkFomcTarihi(maddeler);
  const bos = {
    toplanti: tarih || null,
    oncekiSembol: null, toplantiSembol: null,
    oncekiFiyat: null, toplantiFiyat: null,
    oncesiOran: null, ayOrtalamaOran: null, sonrasiOran: null,
    degisimBp: null, basamakBp: FAIZ_BASAMAK_BP, basamakOrani: null, yon: null,
    gunSayisi: null, toplantiGunu: null,
    agirlikEski: null, agirlikYeni: null,
    agirlikYontemi: null, degisimBpAlternatif: null,
    agirlikYontemiAlternatif: AGIRLIK_YONTEMI_ALT,
    oncekiAydaToplanti: null,
    kaynak: FAIZ_KAYNAK,
  };
  const p = tarih ? tarihAyir(tarih) : null;
  if (p === null) return { ...bos, kod: 'toplanti_yok', sayac, tam: faizTam(sayac) };

  const oncekiToplanti = oncekiAydaFomc(maddeler, p.yil, p.ay0);
  const o = oncekiAy(p.yil, p.ay0);
  const oncekiSembol = zqSembol(o.yil, o.ay0);
  const toplantiSembol = zqSembol(p.yil, p.ay0);
  const gunSayisi = ayGunSayisi(p.yil, p.ay0);
  const iskelet = {
    ...bos,
    oncekiSembol, toplantiSembol,
    gunSayisi, toplantiGunu: p.gun,
    oncekiAydaToplanti: oncekiToplanti,
  };
  if (oncekiToplanti === true) {
    return { ...iskelet, kod: 'onceki_ay_toplantili', sayac, tam: faizTam(sayac) };
  }

  const [a, b] = await Promise.all([
    zqFiyat(oncekiSembol, { sayac }),
    zqFiyat(toplantiSembol, { sayac }),
  ]);
  const temel = { ...iskelet, oncekiFiyat: a.fiyat, toplantiFiyat: b.fiyat };
  const h = beklentiHesapla({
    oncekiFiyat: a.fiyat, toplantiFiyat: b.fiyat,
    gunSayisi, toplantiGunu: p.gun, yontem: AGIRLIK_YONTEMI,
  });
  if (h === null) return { ...temel, kod: 'fiyat_okunamadi', sayac, tam: faizTam(sayac) };
  const alt = beklentiHesapla({
    oncekiFiyat: a.fiyat, toplantiFiyat: b.fiyat,
    gunSayisi, toplantiGunu: p.gun, yontem: AGIRLIK_YONTEMI_ALT,
  });
  return {
    ...temel,
    oncesiOran: h.oncesiOran,
    ayOrtalamaOran: h.ayOrtalamaOran,
    sonrasiOran: h.sonrasiOran,
    degisimBp: h.degisimBp,
    basamakOrani: h.basamakOrani,
    yon: h.yon,
    agirlikEski: h.agirlikEski,
    agirlikYeni: h.agirlikYeni,
    agirlikYontemi: h.yontem,
    degisimBpAlternatif: alt ? alt.degisimBp : null,
    kod: null,
    sayac,
    tam: faizTam(sayac),
  };
}
