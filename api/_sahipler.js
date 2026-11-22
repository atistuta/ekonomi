// ===== /api/sahipler — SAHIPLER (Kurumsal · Içeridekiler · Politikacılar) =====
//
// NE YAPAR: bir hissenin sahiplik tablosunu HAM SAYI olarak döndürür.
//   · kurumsal      → en büyük 10 kurumsal hissedar (lot + dolar + yüzde)
//   · fonlar        → en büyük 10 fon
//   · ozet          → içeride/kurumsal elde tutma yüzdesi + kurum sayısı
//   · iceridekiler  → içeridekilerin güncel pozisyonu (lot)
//   · islemler      → son içeriden alım-satım işlemleri (lot + dolar + tarih)
//   · netAktivite   → 6 aylık net içeriden alım/satım sayacı
//   · politikacilar → KAYNAK YOK (aşağıdaki nota bak)
//
// NEDEN `_` DOSYASI: Vercel Hobby bir deploy'a en fazla 12 serverless fonksiyon
// alıyor ve api/ altındaki rota sayısı TAM 12. 13'üncüsü SESSİZCE patlıyor.
// Bu yüzden uç, proxy.js'in TASIYICILAR tablosuna bindi:
// /api/sahipler → /api/proxy?__rota=sahipler.
//
// HAM SAYI KURALI (BAGIMLILIK_GRAFIGI.md §5.1): burada eşik, ağırlık, formül ve
// Türkçe cümle YOK. "Bariz miktardaki alım-satım" bir EŞİKTİR; bu yüzden uç
// işlemleri yalnız dolar değerine göre BÜYÜKTEN KÜÇÜĞE sıralar ve ham listeyi
// verir — hangisinin "bariz" olduğuna karar vermek sunum katmanının işi.
// Ölçülmeyen alan `null` döner, ASLA 0.
//
// POLİTİKACILAR — 2026-11-19 ÖLÇÜLDÜ, ÇALIŞAN ÜCRETSİZ KAYNAK YOK:
//   · house-stock-watcher-data.s3-us-west-2.amazonaws.com/.../all_transactions.json  → HTTP 403
//   · senate-stock-watcher-data.s3-us-west-2.amazonaws.com/.../all_transactions.json → HTTP 403
//   · tracefour.com /api/v1/congress/trades → HTML (rota yok), api.tracefour.com → bağlanamadı
//   · congressinvests.com/api/trades → HTTP 404
//   · disclosures-clerk.house.gov/public_disc/financial-pdfs/2026FD.zip → HTTP 200 ama
//     İÇİNDE YALNIZ BİLDİRİM DİZİNİ var (Prefix/Last/First/FilingType/StateDst/Year/
//     FilingDate/DocID). SEMBOL YOK, TUTAR YOK. İşlem ayrıntısı DocID başına ayrı
//     PDF'te ve bu PDF'ler sıklıkla TARANMIŞ GÖRÜNTÜ → OCR olmadan ayrıştırılamaz.
//   · 2026-11-20 DÜZELTME (ölçüldü, DEVAM.md §16.9): Perplexity'nin kendi dipnotu
//     "finansal bilgiler Financial Modeling Prep", "opsiyon verileri Unusual Whales"
//     diyor — yani Unusual Whales onların OPSIYON sağlayıcısı. Politikacı bacağının
//     kaynağı büyük olasılıkla FMP: FMP sembol bazlı /stable/senate-trades ve
//     /stable/house-trades uçlarını satıyor (Starter $29/ay'dan itibaren; veriyi
//     GÖSTERMEK için ayrıca "Data Display and Licensing Agreement" gerekiyor).
//     FMP cevabında da LOT ALANI YOK ve amount bir ARALIK metni ("$15,001 - $50,000").
//     Quiver Quantitative: $30/$75 kademeleri YALNIZ KİŞİSEL; ticari $250/ay'dan başlar.
//   · STOCK Act bildirimleri zaten TUTAR ARALIĞI veriyor ($1.001–$15.000 gibi),
//     KESİN DOLAR DEĞİL.
// Bu yüzden bacak BOŞ DEĞİL, AÇIKÇA "kaynak yok" döner. Bir sağlayıcıya karar
// verilince yalnız `politikaciCek()` doldurulacak; cevap ŞEKLİ değişmeyecek.

import { quoteSummaryHam } from './_yfin.js';

export const ROTA = 'sahipler';

// Sembol biçimi — api/_iceriden.js ile AYNI kalıp.
export const SEMBOL_BICIM = /^[A-Za-z][A-Za-z0-9.\-]{0,11}$/;
export const PAZARLAR = ['US', 'BIST'];
export const TTL_SAHIPLER = 3600;      // sahiplik tabloları çeyreklik → 1 saat yeter
export const TTL_HATA = 60;
export const AZAMI_SATIR = 25;         // listelerde taşınan en fazla satır

const UYARI = 'Bilgi amaçlıdır, yatırım tavsiyesi değildir.';

function kisaOnbellek(res) {
  res.setHeader('Cache-Control', 'public, max-age=30');
}

// Yöntem kapısı — `_neden.js`in `kapi()` kalıbının AYNISI. İkinci bir CORS
// politikası uydurulmadı: tests/uc-test.mjs ⑰d her taşıyıcı uç için
// OPTIONS 204 + POST 405 (`method_not_allowed`, `Allow`, max-age=30) kilidi
// koyuyor; bu uç o kilidin içine aynı sözleşmeyle giriyor.
function kapi(req, res, yontemler) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', yontemler);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  const izinli = yontemler.split(',').map((s) => s.trim());
  if (!izinli.includes(req.method)) {
    res.setHeader('Allow', yontemler);
    kisaOnbellek(res);
    res.status(405).json({ error: 'method_not_allowed', uyari: UYARI });
    return true;
  }
  return false;
}

const MODULLER = [
  'institutionOwnership',
  'fundOwnership',
  'majorHoldersBreakdown',
  'insiderHolders',
  'insiderTransactions',
  'netSharePurchaseActivity',
].join(',');

const num = (o) => (o && typeof o.raw === 'number' && isFinite(o.raw)) ? o.raw : null;
const str = (v) => (typeof v === 'string' && v.trim()) ? v.trim() : null;

// Yahoo'nun `ownership` satırı → ham alan kümesi.
export function sahipSatiri(x) {
  if (!x) return null;
  const ad = str(x.organization);
  if (!ad) return null;
  return {
    ad,
    lot: num(x.position),
    deger: num(x.value),
    yuzde: num(x.pctHeld),
    yuzdeDegisim: num(x.pctChange),
    tarih: num(x.reportDate),
  };
}

// Yahoo'nun `insiderHolders.holders` satırı → ham alan kümesi.
// `transactionDescription` Yahoo'nun İNGİLİZCE metni; makine kodu değil, bu
// yüzden olduğu gibi `islemMetni` adıyla taşınır. Uç kendi Türkçesini ÜRETMEZ.
export function iceridekiSatiri(x) {
  if (!x) return null;
  const ad = str(x.name);
  if (!ad) return null;
  return {
    ad,
    iliski: str(x.relation),
    lot: num(x.positionDirect) ?? num(x.positionIndirect),
    tarih: num(x.latestTransDate) ?? num(x.positionDirectDate),
    islemMetni: str(x.transactionDescription),
  };
}

// Yahoo yönü yalnız İngilizce metinde veriyor; burada metin SINIFLANDIRILIYOR,
// yorumlanmıyor — çıktı makine kodu: 'alis' | 'satis' | null.
export function yonKodu(metin) {
  const t = String(metin || '').toLowerCase();
  if (!t) return null;
  if (/\bsale\b|\bsold\b|\bsell\b|disposition/.test(t)) return 'satis';
  if (/\bpurchase\b|\bbought\b|\bbuy\b|acquisition/.test(t)) return 'alis';
  return null;
}

export function islemSatiri(x) {
  if (!x) return null;
  const ad = str(x.filerName);
  if (!ad) return null;
  const metin = str(x.transactionText);
  return {
    ad,
    iliski: str(x.filerRelation),
    lot: num(x.shares),
    deger: num(x.value),
    tarih: num(x.startDate),
    yonKod: yonKodu(metin),
    sahiplikKod: str(x.ownership),
    islemMetni: metin,
  };
}

// POLİTİKACILAR bacağı. Ücretsiz ve çalışan bir kaynak ÖLÇÜLEMEDİĞİ için
// şimdilik tek bir durum kodu döner. Sağlayıcı seçilince gövdesi dolacak.
export async function politikaciCek(/* sembol, pazar */) {
  return { kayitlar: null, durumKod: 'kaynak-yok' };
}

export async function sahiplerHandler(req, res) {
  if (kapi(req, res, 'GET, OPTIONS')) return;

  const ham = String((req.query && (req.query.symbol || req.query.sembol)) || '').trim();
  const sembol = ham.toUpperCase();
  const pazar = String((req.query && (req.query.market || req.query.pazar)) || 'US').toUpperCase().trim();
  if (!ham) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'symbol_yok', uyari: UYARI });
    return;
  }
  if (!SEMBOL_BICIM.test(sembol)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_symbol', gelen: ham.slice(0, 16), uyari: UYARI });
    return;
  }
  if (!PAZARLAR.includes(pazar)) {
    kisaOnbellek(res);
    res.status(400).json({ error: 'bad_market', izinli: PAZARLAR, uyari: UYARI });
    return;
  }
  // BIST'te Yahoo sembolü `.IS` uzantılı.
  const yhSembol = pazar === 'BIST'
    ? (sembol.endsWith('.IS') ? sembol : sembol + '.IS')
    : sembol;

  let R = null, yhHata = null;
  try { R = await quoteSummaryHam(yhSembol, MODULLER); }
  catch (e) { yhHata = String((e && e.message) || e); }

  const liste = (arr, bicim) => Array.isArray(arr)
    ? arr.map(bicim).filter(Boolean).slice(0, AZAMI_SATIR)
    : null;
  const bosa = (a) => (a && a.length) ? a : null;

  const mh = R && R.majorHoldersBreakdown;
  const ns = R && R.netSharePurchaseActivity;
  const pol = await politikaciCek(sembol, pazar);

  // İşlemler dolar değerine göre büyükten küçüğe — EŞİK YOK, yalnız sıralama.
  const islemler = liste(R && R.insiderTransactions && R.insiderTransactions.transactions, islemSatiri);
  if (islemler) islemler.sort((a, b) => (b.deger == null ? -1 : b.deger) - (a.deger == null ? -1 : a.deger));

  const govde = {
    sembol,
    pazar,
    yhSembol,
    ozet: mh ? {
      icerideYuzde: num(mh.insidersPercentHeld),
      kurumsalYuzde: num(mh.institutionsPercentHeld),
      kurumsalDolasimYuzde: num(mh.institutionsFloatPercentHeld),
      kurumsalAdet: num(mh.institutionsCount),
    } : null,
    kurumsal: bosa(liste(R && R.institutionOwnership && R.institutionOwnership.ownershipList, sahipSatiri)),
    fonlar: bosa(liste(R && R.fundOwnership && R.fundOwnership.ownershipList, sahipSatiri)),
    iceridekiler: bosa(liste(R && R.insiderHolders && R.insiderHolders.holders, iceridekiSatiri)),
    islemler: bosa(islemler),
    netAktivite: ns ? {
      donemKod: str(ns.period),
      alisAdet: num(ns.buyInfoCount),
      alisLot: num(ns.buyInfoShares),
      satisAdet: num(ns.sellInfoCount),
      satisLot: num(ns.sellInfoShares),
      netAdet: num(ns.netInfoCount),
      netLot: num(ns.netInfoShares),
      toplamIcerideLot: num(ns.totalInsiderShares),
      netKurumsalLot: num(ns.netInstSharesBuying),
      netKurumsalYuzde: num(ns.netInstBuyingPercent),
    } : null,
    politikacilar: pol.kayitlar,
    politikaciDurumKod: pol.durumKod,
    kunye: { kaynakKod: 'yahoo-quotesummary', olcumMs: Date.now(), hata: yhHata },
    uyari: UYARI,
  };

  const bos = !govde.ozet && !govde.kurumsal && !govde.iceridekiler && !govde.islemler;
  res.setHeader('Cache-Control', bos
    ? 'public, max-age=' + TTL_HATA
    : 'public, max-age=' + TTL_SAHIPLER + ', s-maxage=' + TTL_SAHIPLER + ', stale-while-revalidate=600');
  res.status(200).json(govde);
}

export const HANDLERLAR = Object.freeze({ sahipler: sahiplerHandler });
