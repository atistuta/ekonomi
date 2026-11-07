// =====================================================================
//  ÜST ŞERİT FİYATLARI — yerleşik 6 gösterge + cihazdaki özel
//  göstergeler                                      (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'in sayfa başındaki fiyat şeridinin (`app.js:2517` → "Sabit
//  fiyat göstergeleri — üst şeride iğnele") native karşılığı. Web
//  yerleşik altı kalemi (`TICKER_BUILTIN_META`, app.js:2528) truncgil
//  önbelleğinden + CoinGecko'dan okuyor; native'de truncgil ucu
//  BUGÜNE KADAR YOKTU, bu yüzden şerit HİÇ görünmüyordu.
//
//  UCU BU TUR AÇILDI: `api/_kur.js` (`/api/kur`, `vercel.json`
//  yeniden-yazımıyla `api/proxy.js` üzerinden). Türkçe sayı biçimini
//  (binlik nokta, ondalık virgül) UÇ çözüyor — web bunu TARAYICIDA
//  yapıyor (`truncgilGet`, app.js:106) ve o kod native'e taşınamazdı:
//  §5.1 istemcide ayrıştırma/formül yasaklıyor.
//
//  NEDEN AYRI DOSYA (tek-uç sarmalayıcısı DEĞİL): burada cihaz deposu
//  (`gostergelerDepo`, `gizliGostergelerDepo`) ile İKİ-ÜÇ uç birlikte
//  derleniyor. `./sepet`, `./senkron`, `./hareket` aynı gerekçeyle ayrı.
//
//  NEDEN `./sepet` İLE BİRLEŞTİRİLMEDİ: ikisi AYNI işi yapmıyor. Sepet
//  `adet`/`maliyet` taşıyan kayıtları fiyatlıyor ve kar/zarar için para
//  birimi eşleştirmesi yapıyor; şerit YALNIZ fiyat basıyor, adet yok,
//  maliyet yok. Ortak bir fiyatlayıcıya indirmek mümkün AMA `sepet.ts`
//  §30 kapı bloğuyla satır satır ölçülüyor; birleştirme O ÖLÇÜMÜ de
//  yeniden yazmak demekti. ŞU AN YAPILMADI, DEVAM.md §31'de yazılı.
//
//  HESAP YOK: bu dosyada eşik/ağırlık/formül yok, çarpma/bölme yok;
//  uçtan gelen `fiyatTry` / `priceUsd` / `price` OLDUĞU GİBİ taşınıyor.
//  Ölçülemeyen her hal `null` — `0` DEĞİL.
//
//  SESSİZ KIRPMA YOK: fiyatı çözülemeyen kalem listeden ATILMIYOR;
//  `fiyat: null` + `sebep` ile geliyor ve ekran onu "—" diye basıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { gizliGostergelerDepo, gostergelerDepo, type Gosterge } from './depo';
import { fetchDegisim, fetchKripto, fetchKur } from './client';
import { DEGISIM_AZAMI_SEMBOL, KRIPTO_AZAMI_ID, KUR_AZAMI_KOD } from './types';

/**
 * Şeritteki tek kalem.
 *
 * `birim` fiyatın para birimi (`'TRY'` / `'USD'`) — kalemler AYNI
 * birimde DEĞİL (gram altın ve kurlar TL, BTC/ETH dolar), bu yüzden
 * birim satırda yazılı ve toplam ALINMIYOR.
 *
 * `kaynak` hangi ucun ölçtüğü; `sebep` ise fiyat YOKSA nedeni. İkisi
 * birlikte "ölçmedim" ile "ölçtüm, sonuç yok"u ayırıyor.
 */
export type SeritKalem = {
  id: string;
  etiket: string;
  /** `true` = web'in altı yerleşik kalemi; `false` = kullanıcının eklediği. */
  yerlesik: boolean;
  fiyat: number | null;
  birim: 'TRY' | 'USD';
  /** Yüzde PUAN; `null` = uç vermedi. Yerleşik kurlarda uç veriyor. */
  degisimPct: number | null;
  kaynak: 'kur' | 'kripto' | 'degisim' | 'elle' | 'nakit' | null;
  sebep: string | null;
};

export type SeritSonuc = {
  kalemler: SeritKalem[];
  /** Uçların kendi `uyari` metinleri, OLDUĞU GİBİ. */
  uyarilar: string[];
  /** Hiçbir uca çıkılamadıysa hata cümlesi; `null` = istek sorun çıkarmadı. */
  hata: string | null;
};

const SEBEP_UC_SUSTU = 'Uç cevap verdi ama bu kalem için fiyat dönmedi.';
const SEBEP_FON = 'TEFAS fiyat ucu yok; elle fiyat girilmemiş.';
const SEBEP_SEMBOLSUZ = 'Kayıtta sembol yok — uca sorulacak bir şey yok.';
const SEBEP_CGID = 'Kayıtta CoinGecko kimliği yok (sembol yetmiyor).';

/**
 * Web'in yerleşik altı kalemi — `app.js:2528 TICKER_BUILTIN_META`
 * birebir. Bu bir KARAR değil, web'in bastığı kümenin aynısı.
 *
 * `kod` truncgil anahtarı (`/api/kur`), `cgId` CoinGecko kimliği
 * (`/api/kripto`). `yedekKod` web'in kendi düşüşü: gram altın için
 * `truncgilGet(data,'gram-altin') || truncgilGet(data,'GRA')`
 * (app.js:112) — iki anahtar da sorulup HANGİSİ geldiyse o alınıyor.
 */
const YERLESIK: {
  id: string;
  etiket: string;
  birim: 'TRY' | 'USD';
  kod?: string;
  yedekKod?: string;
  cgId?: string;
}[] = [
  { id: 'gram', etiket: 'Gram Altın', birim: 'TRY', kod: 'gram-altin', yedekKod: 'GRA' },
  { id: 'usd', etiket: 'USD/TRY', birim: 'TRY', kod: 'USD' },
  { id: 'eur', etiket: 'EUR/TRY', birim: 'TRY', kod: 'EUR' },
  { id: 'gbp', etiket: 'GBP/TRY', birim: 'TRY', kod: 'GBP' },
  { id: 'btc', etiket: 'BTC/USD', birim: 'USD', cgId: 'bitcoin' },
  { id: 'eth', etiket: 'ETH/USD', birim: 'USD', cgId: 'ethereum' },
];

/** Yerleşik kalemlerin kimlikleri — gizleme kaydı bunları taşıyor. */
export const SERIT_YERLESIK_IDLER = YERLESIK.map((y) => y.id);

/** `dilim` SESSİZ DEĞİL: her uç kendi tavanını 400 ile reddediyor. */
function dilimle<T>(liste: T[], boy: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += boy) out.push(liste.slice(i, i + boy));
  return out;
}

/** Özel göstergenin etiketi; kullanıcı yazmadıysa sembol basılıyor. */
function ozelEtiket(g: Gosterge): string {
  const l = (g.label || '').trim();
  return l || (g.symbol || '').trim() || g.id;
}

/**
 * Şerit kalemlerini ve ulaşılabilen fiyatlarını getirir.
 *
 * Kayıtları KENDİ okur (`gostergelerDepo.al()`) — kart depo listesi
 * taşımıyor, iki yerde iki ayrı kopya olmasın (`sepet.ts` kalıbı).
 *
 * İSTEK SAYISI: yerleşik kurlar + özel metal/döviz kalemleri TEK
 * `/api/kur` çağrısında birleşiyor (uç `today.json`un TAMAMINI tek
 * istekte alıyor — `api/_kur.js AZAMI_UST_ISTEK = 1`), yerleşik BTC/ETH
 * + özel kripto kalemleri TEK `/api/kripto` çağrısında, özel BIST/ABD
 * kalemleri TEK `/api/degisim` çağrısında (`donemler: ['gunluk']`,
 * gerekçe `sepet.ts` başlığı).
 */
export async function seritFiyatlari(signal?: AbortSignal): Promise<SeritSonuc> {
  const gizli = new Set(gizliGostergelerDepo.al());
  const ozeller = gostergelerDepo.al();
  const uyarilar: string[] = [];
  let hata: string | null = null;

  // --- (1) Hangi kalem hangi uca gidiyor ------------------------------
  const kurKodlar: string[] = [];
  const kriptoIdler: string[] = [];
  const degisimIstek: string[] = [];

  const gorunurYerlesik = YERLESIK.filter((y) => !gizli.has(y.id));
  for (const y of gorunurYerlesik) {
    if (y.kod && !kurKodlar.includes(y.kod)) kurKodlar.push(y.kod);
    if (y.yedekKod && !kurKodlar.includes(y.yedekKod)) kurKodlar.push(y.yedekKod);
    if (y.cgId && !kriptoIdler.includes(y.cgId)) kriptoIdler.push(y.cgId);
  }

  type OzelPlan = {
    g: Gosterge;
    uc: 'kur' | 'kripto' | 'degisim' | 'elle' | 'nakit' | null;
    anahtar: string | null;
    birim: 'TRY' | 'USD';
    sebep: string | null;
  };
  const ozelPlan: OzelPlan[] = [];

  for (const g of ozeller) {
    if (g.cls === 'cash') {
      // Web'in tanımının aynısı (`app.js:2485`): nakit 1 birimdir.
      const sem = (g.symbol || 'TRY').toUpperCase();
      ozelPlan.push({
        g,
        uc: 'nakit',
        anahtar: null,
        birim: sem === 'USD' ? 'USD' : 'TRY',
        sebep: null,
      });
      continue;
    }
    if (g.cls === 'fund') {
      // Şerit kaydında elle fiyat alanı YOK (`Gosterge` tipi) — web de
      // şeritte fonu `basketPrice` ile fiyatlıyor ve orada `manualPrice`
      // sepet kaydından gelir; şerit kaydı onu taşımıyor.
      ozelPlan.push({ g, uc: null, anahtar: null, birim: 'TRY', sebep: SEBEP_FON });
      continue;
    }
    if (g.cls === 'metal' || g.cls === 'fx') {
      // Web burada `truncgilGet(cache, h.symbol)` yapıyor (app.js:2493),
      // yani KAYDIN SEMBOLÜ truncgil anahtarının kendisi. Aynısı.
      const kod = (g.symbol || '').trim();
      if (!kod) {
        ozelPlan.push({ g, uc: null, anahtar: null, birim: 'TRY', sebep: SEBEP_SEMBOLSUZ });
        continue;
      }
      if (!kurKodlar.includes(kod)) kurKodlar.push(kod);
      ozelPlan.push({ g, uc: 'kur', anahtar: kod, birim: 'TRY', sebep: null });
      continue;
    }
    if (g.cls === 'crypto') {
      if (!g.cgId) {
        ozelPlan.push({ g, uc: null, anahtar: null, birim: 'USD', sebep: SEBEP_CGID });
        continue;
      }
      const id = g.cgId.toLowerCase();
      if (!kriptoIdler.includes(id)) kriptoIdler.push(id);
      ozelPlan.push({ g, uc: 'kripto', anahtar: id, birim: 'USD', sebep: null });
      continue;
    }
    // bist / us
    const sem = (g.symbol || '').trim().toUpperCase();
    const birim: 'TRY' | 'USD' = g.cls === 'us' ? 'USD' : 'TRY';
    if (!sem) {
      ozelPlan.push({ g, uc: null, anahtar: null, birim, sebep: SEBEP_SEMBOLSUZ });
      continue;
    }
    const pazar = g.cls === 'bist' ? 'BIST' : 'US';
    const istek = sem + ':' + pazar;
    if (!degisimIstek.includes(istek)) degisimIstek.push(istek);
    ozelPlan.push({ g, uc: 'degisim', anahtar: pazar + ':' + sem, birim, sebep: null });
  }

  // --- (2) Uçlara çık -------------------------------------------------
  const kurBulunan: Record<string, { fiyat: number | null; degisimPct: number | null }> = {};
  if (kurKodlar.length) {
    for (const dilim of dilimle(kurKodlar, KUR_AZAMI_KOD)) {
      const sonuc = await fetchKur(dilim, { signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const satir of sonuc.data.kurlar) {
        kurBulunan[satir.kod] = { fiyat: satir.fiyatTry, degisimPct: satir.degisimPct };
      }
    }
  }

  const kriptoBulunan: Record<string, { fiyat: number | null; degisimPct: number | null }> = {};
  if (kriptoIdler.length) {
    for (const dilim of dilimle(kriptoIdler, KRIPTO_AZAMI_ID)) {
      const sonuc = await fetchKripto(dilim, { signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const coin of sonuc.data.coinler) {
        kriptoBulunan[String(coin.id).toLowerCase()] = {
          fiyat: coin.priceUsd,
          degisimPct: coin.priceChange24hPct,
        };
      }
    }
  }

  const degisimBulunan: Record<string, { fiyat: number | null; degisimPct: number | null }> = {};
  if (degisimIstek.length) {
    for (const dilim of dilimle(degisimIstek, DEGISIM_AZAMI_SEMBOL)) {
      const sonuc = await fetchDegisim(dilim, { donemler: ['gunluk'], signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const satir of sonuc.data.satirlar) {
        // `chg1dPct` SEÇİMLİK: alan yoksa "sormadım", `null` ise
        // "ölçemedim" (`DegisimSatir` başlığı). İkisi de `null` basılır.
        degisimBulunan[String(satir.market) + ':' + satir.symbol.toUpperCase()] = {
          fiyat: satir.price,
          degisimPct: typeof satir.chg1dPct === 'number' ? satir.chg1dPct : null,
        };
      }
    }
  }

  // --- (3) Kalemleri geri eşle ----------------------------------------
  const kalemler: SeritKalem[] = [];

  for (const y of gorunurYerlesik) {
    let olcum: { fiyat: number | null; degisimPct: number | null } | undefined;
    let kaynak: SeritKalem['kaynak'] = null;
    if (y.kod) {
      // Web'in kendi düşüşü: önce ana anahtar, fiyatı yoksa yedek.
      const ana = kurBulunan[y.kod];
      const yedek = y.yedekKod ? kurBulunan[y.yedekKod] : undefined;
      olcum = ana && ana.fiyat != null ? ana : yedek;
      kaynak = 'kur';
    } else if (y.cgId) {
      olcum = kriptoBulunan[y.cgId];
      kaynak = 'kripto';
    }
    const fiyat = olcum && typeof olcum.fiyat === 'number' ? olcum.fiyat : null;
    kalemler.push({
      id: y.id,
      etiket: y.etiket,
      yerlesik: true,
      fiyat,
      birim: y.birim,
      degisimPct: olcum && typeof olcum.degisimPct === 'number' ? olcum.degisimPct : null,
      kaynak,
      sebep: fiyat == null ? SEBEP_UC_SUSTU : null,
    });
  }

  for (const p of ozelPlan) {
    if (p.uc === 'nakit') {
      kalemler.push({
        id: p.g.id,
        etiket: ozelEtiket(p.g),
        yerlesik: false,
        fiyat: 1,
        birim: p.birim,
        degisimPct: null,
        kaynak: 'nakit',
        sebep: null,
      });
      continue;
    }
    if (p.uc === null || p.anahtar == null) {
      kalemler.push({
        id: p.g.id,
        etiket: ozelEtiket(p.g),
        yerlesik: false,
        fiyat: null,
        birim: p.birim,
        degisimPct: null,
        kaynak: null,
        sebep: p.sebep,
      });
      continue;
    }
    const tablo =
      p.uc === 'kur' ? kurBulunan : p.uc === 'kripto' ? kriptoBulunan : degisimBulunan;
    const olcum = tablo[p.anahtar];
    const fiyat = olcum && typeof olcum.fiyat === 'number' ? olcum.fiyat : null;
    kalemler.push({
      id: p.g.id,
      etiket: ozelEtiket(p.g),
      yerlesik: false,
      fiyat,
      birim: p.birim,
      degisimPct: olcum && typeof olcum.degisimPct === 'number' ? olcum.degisimPct : null,
      kaynak: p.uc,
      sebep: fiyat == null ? SEBEP_UC_SUSTU : null,
    });
  }

  return { kalemler, uyarilar, hata };
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
