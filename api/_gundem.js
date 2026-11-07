// =====================================================================
//  api/_gundem.js — GÜNÜN GÜNDEMİ KAVRAM UCU  (/api/gundem)
// =====================================================================
//  NİYE `_` ÖNEKLİ: Vercel Hobby tavanı deploy başına 12 serverless
//  fonksiyon ve `api/*.js` uç dosyası sayısı ŞU AN TAM 12. `_` önekli
//  dosya rotaya çevrilmez, SAYILMAZ; yol vercel.json rewrite'ı ile
//  /api/proxy?__rota=gundem'e biniyor. Kalıbın ikizi: api/_metal.js.
//
//  NİYE VAR — ÖLÇÜLMÜŞ EKSİK, kendi kodumuzda yazılı: native istemcinin
//  `fetchCausal` başlığında (mobile/src/api/client.ts) şu duruyor:
//  "Gündem ÜRETİMİ (RSS taraması + konsept çıkarımı) SUNUCU İŞİ ve AYRI
//  BİR ŞERİDE devredilecek". Bu dosya o şerit. `/api/causal` AĞA HİÇ
//  ÇIKMIYOR ve gündem konseptlerini İSTEMCİDEN bekliyor; webde onları
//  `app.js computeAgenda()` üretiyor, native'de böyle bir tarayıcı
//  YOKTU — dolayısıyla "Neden" bağı native'de BESLENEMİYORDU.
//
//  İKİ AYRI ŞEY — KARIŞTIRILMASIN:
//    · `/api/news?gundem=1` MANŞET LİSTESİ döndürür (gundemCek).
//      Native'de ekranı ZATEN var: PiyasaGundemiKarti.
//    · BU UÇ aynı beslemelerden KAVRAM çıkarır: hangi başlık hangi
//      konsepte düşüyor, konsept ne kadar sıcak, risk-on mu risk-off
//      mu, hangi sektöre rüzgâr. Yeni bir besleme kümesi AÇILMADI.
//
//  MOTOR KOPYALANMADI: eşleme, ısı/ton/sektör hesabı ve keşif
//  api/_motor.js'in `gundem-sozluk` + `gundem-skor` dilimlerinden
//  GELİYOR — app.js'in AYNI kaynağı. Burada tek bir eşik, ağırlık ya da
//  sözlük kalemi YOK.
//
//  AĞ GÖVDESİ KOPYALANMADI: RSS ayrıştırıcı, zaman aşımı, kimlik
//  dizgesi, kısa gövde kuralı ve sayaçlar api/_haber.js'in
//  `beslemeCek`inden geliyor.
//
//  NİYE `gundemCek` DEĞİL de doğrudan `beslemeCek`: `gundemCek` havuzu
//  TEKİLLEŞTİRİP `limit` kadar KIRPIYOR — ekrana liste basmak için
//  doğru, kavram çıkarımı için YANLIŞ: kırpılan havuzda konsept sayımı
//  (`n`) ve ısı düşük ölçülür. Burada her besleme AYRI bir `feed`
//  olarak motora giriyor, tekilleme motorun kendi işi.
//
//  AĞIRLIK AYRIMI YOK — UYDURULMADI: web beslemelere 0.9-1.15 arası
//  ağırlık veriyor, ama o ağırlıklar Google News KONU bölümlerine
//  bağlı. Buradaki yedi yayıncı beslemesinin böyle bir bölümü YOK;
//  onlara ağırlık atamak ÖLÇMEDİĞİM bir sayı yazmak olurdu. Hepsi
//  `w: 1`; tazelik ağırlığı motorun kendi işi ve değişmedi.
//
//  HAM SAYI KURALI: bu uç YALNIZ veri ve makine kodu döner. Motorun
//  ürettiği Türkçe metinler (`mood`, `label`, `note`, `toneLabel.label`)
//  ve `emoji` TELE GEÇMİYOR — yerlerine `moodKod` / `toneKod` / `key`
//  gidiyor, cümleyi mobile/src/lib/sozluk.ts seçiyor. Tek Türkçe alan
//  `uyari`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ---------------------------------------------------------------------
import { buildMotor } from './_motor.js';
import { TA_WEIGHTS, TA_BENCHMARK } from './_ayar.js';
import { canliAg } from './_ag.js';
import {
  beslemeCek, bosHaberSayac, haberTam,
  GUNDEM_BESLEMELER, GUNDEM_YERELLER, GUNDEM_BESLEME_MADDE,
  izinliGundemAdresi,
} from './_haber.js';
import { anahtar, oku, yaz, TTL_FIYAT } from './_onbellek.js';

// Uyarı metni — öteki uçlarla AYNI değişmez.
const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

/**
 * Kapsam kümesi. `HEPSI` = TR + US beslemeleri AYNI havuzda; web de
 * böyle yapıyor çünkü konsept sözlüğü iki dilde de anahtar taşıyor.
 */
export const KAPSAMLAR = Object.freeze(['TR', 'US', 'HEPSI']);

/** Besleme yerelinin motora giden dil etiketi. SAF. */
export function yerelDili(yerel) {
  return yerel === 'TR' ? 'tr' : 'en';
}

/**
 * `?kapsam=` değerini kümeye indir. Boş/eksik → 'HEPSI'.
 * Küme dışı değer SESSİZCE düzeltilmez: çağıran yanlış bir kapsam
 * sanısıyla ekrana "TR gündemi" yazabilirdi.
 * @returns {string | null} null = küme dışı
 */
export function kapsamCoz(v) {
  if (v == null || v === '') return 'HEPSI';
  const s = String(v).toUpperCase();
  return KAPSAMLAR.includes(s) ? s : null;
}

/** Kapsamın okuduğu yereller. SAF. */
export function kapsamYerelleri(kapsam) {
  return kapsam === 'HEPSI' ? GUNDEM_YERELLER.slice() : [kapsam];
}

/**
 * Cihazda `Linking.openURL` ile AÇILACAK bağlantı güvenli mi.
 * YALNIZ http/https; geçmezse BOŞ kalır (manşet yine taşınır, ekranda
 * tıklanabilir görünmez). api/pulse.js'teki kuralın AYNISI — iki uç
 * ayrı davranmasın. 400 ATILMAZ: bağlantı ölçümün parçası değil.
 */
export function gundemBaglanti(v) {
  const t = String(v ?? '').trim();
  if (!t || t.length > 500) return '';
  return /^https?:\/\//i.test(t) ? t : '';
}

/**
 * Motorun başlık öğesini TELE GİDEN alanlara indir.
 * `ageH` /api/causal'ın OKUDUĞU TEK alan; başlık ve bağlantı EKRAN
 * için. Ağırlık/tazelik/küçük harfli gövde GEÇMİYOR: motorun iç işi.
 * SAF.
 */
export function basligaIndir(p) {
  return {
    title: String((p && p.title) || ''),
    link: gundemBaglanti(p && p.link),
    pubDate: String((p && p.pubDate) || ''),
    // HAM SAYI: yuvarlanmıyor. Görece zaman biçimi ekran işi.
    ageH: Number.isFinite(p && p.ageH) ? p.ageH : null,
  };
}

/**
 * Motor konseptini TELE GİDEN biçime çevir.
 * DÜŞEN ALANLAR ve NİYE: `emoji` (simge ekran işi), `label` ve `note`
 * (Türkçe cümle — `key`den sözlük seçiyor), `toneLabel.label` (aynı),
 * `emerging` (→ `yeni`, ad yerine durum).
 * SAF.
 */
export function konseptiIndir(it) {
  const key = String((it && it.key) || '');
  const yeni = !!(it && it.emerging === true);
  return {
    key,
    // Keşifle gelen konseptin SÖZCÜĞÜ veri: sözlükte karşılığı yok,
    // ekran onu olduğu gibi yazıyor. Tanımlı konseptte YOK → null.
    sozcuk: yeni ? key.replace(/^emg-/, '') : null,
    yeni,
    risk: it && (it.risk === 'on' || it.risk === 'off') ? it.risk : null,
    sectors: Array.isArray(it && it.sectors)
      ? it.sectors
        .filter((s) => Array.isArray(s) && s.length === 2)
        .map((s) => [String(s[0]), String(s[1])])
      : [],
    heat: it && (it.heat === 'hot' || it.heat === 'warm') ? it.heat : 'cool',
    // HAM: -1..+1 ton ortalaması ve motorun hizalama skoru.
    tone: Number.isFinite(it && it.tone) ? it.tone : null,
    skor: Number.isFinite(it && it.score) ? it.score : null,
    n: Number.isFinite(it && it.n) ? it.n : 0,
    // Ton ETİKETİ DEĞİL ton KODU: motorun `sentiLabel().cls`i.
    toneKod: it && it.toneLabel && it.toneLabel.cls ? String(it.toneLabel.cls) : null,
    heads: Array.isArray(it && it.heads) ? it.heads.map(basligaIndir) : [],
  };
}

/**
 * Motor özetini TELE GİDEN biçime çevir. `mood` (Türkçe cümle) DÜŞTÜ,
 * yerine `moodKod` (`moodCls`: bull|bear|neutral) gidiyor.
 *
 * `rotasyon.hisseler` HER ZAMAN BOŞ ve bunu bir KOD söylüyor: motor
 * zaten boş bırakıyor ("çağırıcı doldurur") çünkü hisse eşlemesi
 * KULLANICI EVRENİNE bakıyor. Sunucuda sabit bir evren üzerinden
 * doldurmak `maxDuration` ölçümü bekliyor (DEVAM.md §21 M2). Boş dizi
 * + kod, uydurma bir liste basmaktan doğru.
 * SAF.
 */
export function ozetiIndir(s) {
  const r = s && s.rotation;
  return {
    moodKod: s && (s.moodCls === 'bull' || s.moodCls === 'bear') ? s.moodCls : 'neutral',
    riskOn: Number.isFinite(s && s.riskOn) ? s.riskOn : 0,
    riskOff: Number.isFinite(s && s.riskOff) ? s.riskOff : 0,
    upSectors: Array.isArray(s && s.upSectors) ? s.upSectors.map(String) : [],
    downSectors: Array.isArray(s && s.downSectors) ? s.downSectors.map(String) : [],
    poolN: Number.isFinite(s && s.poolN) ? s.poolN : 0,
    rotasyon: r
      ? {
        heat: r.heat === 'hot' || r.heat === 'warm' ? r.heat : 'cool',
        n: Number.isFinite(r.n) ? r.n : 0,
        hisseler: [],
        hisseKod: 'evren_olculmedi',
      }
      : null,
  };
}

// ---------------------------------------------------------------------
//  Modül düzeyi kurulum — istek başına DEĞİL (gerekçe: api/pulse.js).
//  Bu uç motorun yalnız gündem dilimlerini kullanıyor ama buildMotor
//  bölünmez bir bütün; ağırlıklar yine de takılıyor ki motor nesnesi
//  öteki uçlarla AYNI biçimde kurulsun.
// ---------------------------------------------------------------------
let ENG = null;
let KURULUM_HATASI = null;
try {
  const AG = canliAg({ taWeights: TA_WEIGHTS, taBenchmark: TA_BENCHMARK });
  ENG = buildMotor(AG.H);
} catch (e) {
  KURULUM_HATASI = e;
}

function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

export async function gundemHandler(req, res) {
  const t0 = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') {
    // `Allow` + KISA önbellek: _metal.js'in `kapi()`siyla birebir — üç
    // taşıyıcı uç aynı reddi aynı biçimde veriyor.
    res.setHeader('Allow', 'GET, OPTIONS');
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return;
  }
  if (!ENG) {
    console.error('api/_gundem kurulum:', (KURULUM_HATASI && KURULUM_HATASI.stack) || KURULUM_HATASI);
    kisaOnbellek(res);
    res.status(502).json({ error: 'motor_kurulamadi', uyari: UYARI });
    return;
  }

  const kapsam = kapsamCoz(req.query && req.query.kapsam);
  if (kapsam === null) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_kapsam', izinli: KAPSAMLAR, uyari: UYARI });
    return;
  }
  const yereller = kapsamYerelleri(kapsam);

  try {
    const obAnahtar = anahtar('gundem', { kapsam });
    const onbellek = await oku(obAnahtar);
    if (onbellek) {
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
      res.status(200).json({ ...onbellek, onbellek: true, ms: Date.now() - t0 });
      return;
    }

    const sayac = bosHaberSayac();
    // İşler DÜZ bir dizi: yerel × besleme. PARALEL çünkü sırayla çekmek
    // 7 beslemede tek tek zaman aşımı süresi kadar birikir ve
    // taşıyıcının tavanını aşar.
    const isler = [];
    for (const y of yereller) {
      for (const b of (GUNDEM_BESLEMELER[y] || [])) isler.push({ y, b });
    }
    const sonuc = await Promise.allSettled(isler.map(({ b }) => {
      // Adres KENDİ izin listemizde değilse AĞA ÇIKILMIYOR.
      if (!izinliGundemAdresi(b.adres)) {
        sayac.hata++;
        return Promise.resolve({ maddeler: [] });
      }
      return beslemeCek(b.adres, { limit: GUNDEM_BESLEME_MADDE, sayac, kaynak: b.ad });
    }));

    const besleme = [];
    const feeds = [];
    let okunan = 0;
    for (let i = 0; i < isler.length; i++) {
      const { y, b } = isler[i];
      const s = sonuc[i];
      const d = s.status === 'fulfilled' ? s.value : null;
      const maddeler = d && Array.isArray(d.maddeler) ? d.maddeler : [];
      // BAŞARI ÖLÇÜTÜ `maddeler.length > 0` — `s.value.tam` DEĞİL:
      // `tam` PAYLAŞILAN sayaçtan türüyor, bir beslemenin hatası daha
      // sonra biten her beslemeyi de `tam:false` gösterip sahte 502
      // ürettiriyordu. api/_haber.js de aynı ölçütü kullanıyor.
      // `durum` MAKİNE KODU, Türkçe cümle DEĞİL — etiket istemcide.
      besleme.push({
        ad: b.ad, yerel: y, durum: maddeler.length > 0 ? 'ok' : 'bos', adet: maddeler.length,
      });
      if (maddeler.length > 0) {
        okunan++;
        // Her besleme AYRI `feed`: motor tekillemeyi kendi yapıyor.
        feeds.push({ f: { w: 1, lang: yerelDili(y) }, items: maddeler });
      }
    }

    // HİÇBİRİ okunamadıysa bu bir ölçüm değil, kesinti. Boş konsept
    // dizisi dönmek "bugün gündem yok" YALANI olurdu.
    if (okunan === 0) {
      kisaOnbellek(res);
      res.status(502).json({
        error: 'gundem_alinamadi', kapsam, besleme, sayac, uyari: UYARI,
      });
      return;
    }

    const ag = ENG.agendaScore(feeds, Date.now());

    const govde = {
      kapsam,
      yereller,
      besleme,
      // Sıra MOTORUN: skora göre büyükten küçüğe, en çok 6 tanımlı +
      // 2 keşif. İstemci yeniden sıralamıyor.
      konseptler: (Array.isArray(ag.items) ? ag.items : []).map(konseptiIndir),
      ozet: ozetiIndir(ag.summary),
      // `bos` ÖLÇÜLDÜ demek: beslemeler okundu, hiçbir konsept eşikleri
      // geçmedi. `error` ile KARIŞTIRILMASIN.
      bos: !!ag.empty,
      sayac,
      tam: okunan === isler.length && haberTam(sayac),
      ts: Number.isFinite(ag.ts) ? ag.ts : Date.now(),
      uyari: UYARI,
    };

    // YALNIZ `tam` gövde önbelleğe yazılıyor (metal/takvim ile aynı kural).
    if (govde.tam) await yaz(obAnahtar, govde, TTL_FIYAT);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ ...govde, onbellek: false, ms: Date.now() - t0 });
  } catch (e) {
    // Yığın SIZDIRILMIYOR: loga tam, cevaba makine kodu.
    console.error('api/_gundem:', (e && e.stack) || e);
    kisaOnbellek(res);
    res.status(502).json({ error: 'gundem_alinamadi', uyari: UYARI });
  }
}

export const ROTA = 'gundem';
export const HANDLERLAR = Object.freeze({ gundem: gundemHandler });
