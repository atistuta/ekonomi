// =====================================================================
//  SEPET FİYATI — cihazdaki sepet kayıtlarına ULAŞILABİLEN fiyatı
//  getiren katman                                    (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `sb:basket` kayıtlarının (`depo.ts` `sepetDepo`) her biri için
//  fiyat kaynağı arar ve bulabildiğini getirir. Webin `basketPrice`
//  (`app.js:2483`) karşılığı — ama BİREBİR DEĞİL, ve farkları aşağıda
//  tek tek yazılı.
//
//  NEDEN AYRI DOSYA (tek-uç sarmalayıcısı değil): burada cihaz deposu
//  ile İKİ uç birlikte derleniyor (kayıtları sınıfa göre ayır → uca
//  toplu sor → kayıt kimliğine geri eşle). `./senkron` ve `./hareket`
//  satırlarının aynı gerekçesi.
//
//  METAL VE DÖVİZ ARTIK WEB İLE AYNI YERDEN FİYATLANIYOR: webin
//  `basketPrice` satırı ikisini TEK çağrıyla çözüyor —
//  `truncgilGet(truncgilCache, h.symbol)`, para birimi `'TRY'`
//  (`app.js:2483`). Bu turda o kaynağın ucu açıldığı için (truncgil
//  `today.json`, `api/_kur.js`) native de BİREBİR aynı anahtarı
//  soruyor: KAYDIN SEMBOLÜ, küçültülmeden. Önceki iki "ucu yok"
//  gerekçesi (metal ONS/USD · `USDTRY=X` sözlükte yok) DÜŞTÜ.
//
//  WEBDEN BİLEREK AYRILAN TEK NOKTA (ÖLÇÜM sonucu):
//   (3) FON (TEFAS) ucu yok (bot engeli, §12 komşusu): yalnız
//       kullanıcının kendi girdiği `manualPrice` kullanılıyor, kaynak
//       'elle' diye işaretleniyor — ölçülmüş fiyatla KARIŞMASIN.
//
//  `donemler: ['gunluk']` BİLİNÇLİ: ucun varsayılanı ALTI dönem = sembol
//  başına ÜÇ adres (`api/_degisim.js:330`), ama buraya yalnız `price`
//  gerekiyor ve o her dönemde geliyor. Tek dönem = tek adres.
//
//  HESAP YOK: bu dosyada eşik/ağırlık/formül yok, çarpma/toplama yok;
//  uçtan gelen fiyat OLDUĞU GİBİ taşınıyor. `adet × fiyat` çarpımı
//  TEK YERDE, kartın içinde (`SepetKart.tsx` `kalemDeger`).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { sepetDepo, type SepetKalemi } from './depo';
import { fetchDegisim, fetchKripto, fetchKur } from './client';
import {
  DEGISIM_AZAMI_SEMBOL,
  KRIPTO_AZAMI_ID,
  KUR_AZAMI_KOD,
  KUR_KOD_BICIM,
} from './types';

/**
 * Bir kalemin fiyatı. `kaynak` ekranda YAZILI: 'elle' kullanıcının
 * kendi girdiği sayı, 'nakit' tanım gereği 1, ötekiler ÖLÇÜM.
 */
export type SepetFiyat = {
  fiyat: number;
  /** Fiyatın para birimi; `null` = uç bildirmedi. */
  birim: string | null;
  kaynak: 'degisim' | 'kripto' | 'kur' | 'elle' | 'nakit';
};

/** Native'de fiyat kaynağı HİÇ OLMAYAN kalem + gerekçesi. */
export type SepetKaynaksiz = { id: string; sebep: string };

export type SepetFiyatSonuc = {
  /** kalem `id` → fiyat. Kayıt yoksa o kalem ya ölçülemedi ya kaynaksız. */
  fiyatlar: Record<string, SepetFiyat>;
  /** Kaynağı VAR, uç cevap verdi ama fiyat `null` geldi. */
  olculemedi: string[];
  /** Kaynağı YOK — sebebi kalem kalem yazılı. */
  kaynaksiz: SepetKaynaksiz[];
  /** Uçların kendi `uyari` metinleri, OLDUĞU GİBİ. */
  uyarilar: string[];
  /** Hiç uca çıkılamadıysa hata cümlesi; `null` = istek sorun çıkarmadı. */
  hata: string | null;
};

const SEBEP_METAL =
  'Metal kaydının sembolü kur ucunun kod biçimine uymuyor — sorulamadı.';
const SEBEP_FX =
  'Döviz kaydının sembolü kur ucunun kod biçimine uymuyor — sorulamadı.';
const SEBEP_FON = 'TEFAS fiyat ucu yok; elle fiyat girilmemiş.';
const SEBEP_SEMBOLSUZ = 'Kayıtta sembol yok — uca sorulacak bir şey yok.';
const SEBEP_CGID = 'Kayıtta CoinGecko kimliği yok (sembol yetmiyor).';

/** `dilim` SESSİZ DEĞİL: her uç kendi tavanını 400 ile reddediyor. */
function dilimle<T>(liste: T[], boy: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < liste.length; i += boy) out.push(liste.slice(i, i + boy));
  return out;
}

/**
 * Cihazdaki sepet kalemleri için ulaşılabilen fiyatları getirir.
 *
 * Kayıtları KENDİ okur (`sepetDepo.al()`) — kart fiyat katmanına kayıt
 * listesi taşımıyor, iki yerde iki ayrı kopya olmasın.
 */
export async function sepetFiyatlari(
  signal?: AbortSignal,
): Promise<SepetFiyatSonuc> {
  const kalemler: SepetKalemi[] = sepetDepo.al();
  const fiyatlar: Record<string, SepetFiyat> = {};
  const olculemedi: string[] = [];
  const kaynaksiz: SepetKaynaksiz[] = [];
  const uyarilar: string[] = [];

  // Uca gidecek iki küme + hangi kalemin hangi anahtara baktığı.
  const degisimIstek: string[] = [];
  const degisimEsleme: { id: string; anahtar: string }[] = [];
  const kriptoIstek: string[] = [];
  const kriptoEsleme: { id: string; anahtar: string }[] = [];
  const kurIstek: string[] = [];
  const kurEsleme: { id: string; anahtar: string }[] = [];

  // Metal ve döviz AYNI uca gidiyor; web de öyle yapıyor (başlıkta).
  // Anahtar KAYDIN SEMBOLÜ ve KÜÇÜLTÜLMÜYOR: üst kaynağın anahtarları
  // karışık kipte (`USD` büyük, `gram-altin` küçük — `types.ts` notu).
  const kuraSor = (k: SepetKalemi, sebep: string): void => {
    const kod = (k.symbol || '').trim();
    if (!kod) {
      kaynaksiz.push({ id: k.id, sebep: SEBEP_SEMBOLSUZ });
      return;
    }
    if (!KUR_KOD_BICIM.test(kod)) {
      // TEK bozuk kod, ucun 400'ü yüzünden DİLİMİN TAMAMINI yakardı;
      // bu yüzden uca çıkmadan ayıklanıyor ve gerekçesi ekranda.
      kaynaksiz.push({ id: k.id, sebep });
      return;
    }
    if (!kurIstek.includes(kod)) kurIstek.push(kod);
    kurEsleme.push({ id: k.id, anahtar: kod });
  };

  for (const k of kalemler) {
    if (k.cls === 'cash') {
      // Webin tanımının aynısı (`app.js:2485`): nakit 1 birimdir.
      const sem = (k.symbol || 'TRY').toUpperCase();
      fiyatlar[k.id] = {
        fiyat: 1,
        birim: sem === 'USD' ? 'USD' : 'TRY',
        kaynak: 'nakit',
      };
      continue;
    }
    if (k.cls === 'fund') {
      if (typeof k.manualPrice === 'number') {
        fiyatlar[k.id] = { fiyat: k.manualPrice, birim: 'TRY', kaynak: 'elle' };
      } else {
        kaynaksiz.push({ id: k.id, sebep: SEBEP_FON });
      }
      continue;
    }
    if (k.cls === 'metal') {
      kuraSor(k, SEBEP_METAL);
      continue;
    }
    if (k.cls === 'fx') {
      kuraSor(k, SEBEP_FX);
      continue;
    }
    if (k.cls === 'crypto') {
      if (!k.cgId) {
        kaynaksiz.push({ id: k.id, sebep: SEBEP_CGID });
        continue;
      }
      const anahtar = k.cgId.toLowerCase();
      if (!kriptoIstek.includes(anahtar)) kriptoIstek.push(anahtar);
      kriptoEsleme.push({ id: k.id, anahtar });
      continue;
    }
    // bist / us — uç sembolü `PAZAR:SEMBOL` biçiminde geri yazıyor.
    if (!k.symbol) {
      kaynaksiz.push({ id: k.id, sebep: SEBEP_SEMBOLSUZ });
      continue;
    }
    const pazar = k.cls === 'bist' ? 'BIST' : 'US';
    const istek = k.symbol.toUpperCase() + ':' + pazar;
    if (!degisimIstek.includes(istek)) degisimIstek.push(istek);
    degisimEsleme.push({
      id: k.id,
      anahtar: pazar + ':' + k.symbol.toUpperCase(),
    });
  }

  let hata: string | null = null;

  if (degisimIstek.length) {
    // `price` her dönemde geliyor; en ucuz istek tek dönem (başlıkta).
    const bulunan: Record<
      string,
      { fiyat: number | null; birim: string | null }
    > = {};
    for (const dilim of dilimle(degisimIstek, DEGISIM_AZAMI_SEMBOL)) {
      const sonuc = await fetchDegisim(dilim, { donemler: ['gunluk'], signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const satir of sonuc.data.satirlar) {
        bulunan[String(satir.market) + ':' + satir.symbol.toUpperCase()] = {
          fiyat: satir.price,
          birim: satir.currency,
        };
      }
    }
    for (const e of degisimEsleme) {
      const v = bulunan[e.anahtar];
      if (v && typeof v.fiyat === 'number') {
        fiyatlar[e.id] = { fiyat: v.fiyat, birim: v.birim, kaynak: 'degisim' };
      } else {
        olculemedi.push(e.id);
      }
    }
  }

  if (kriptoIstek.length) {
    const bulunan: Record<string, number | null> = {};
    for (const dilim of dilimle(kriptoIstek, KRIPTO_AZAMI_ID)) {
      const sonuc = await fetchKripto(dilim, { signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const coin of sonuc.data.coinler) {
        bulunan[String(coin.id).toLowerCase()] = coin.priceUsd;
      }
    }
    for (const e of kriptoEsleme) {
      const v = bulunan[e.anahtar];
      if (typeof v === 'number') {
        fiyatlar[e.id] = { fiyat: v, birim: 'USD', kaynak: 'kripto' };
      } else {
        // CoinGecko tanınmayan kimliği SESSİZCE düşürüyor (`types.ts`
        // `KriptoResponse` notu) — burada sayıya dönüşüyor.
        olculemedi.push(e.id);
      }
    }
  }

  if (kurIstek.length) {
    // Uç, kod sayısından BAĞIMSIZ tek üst istek yapıyor (`_kur.js`
    // `AZAMI_UST_ISTEK = 1`); dilimleme yalnız istemci tavanı için.
    const bulunan: Record<string, number | null> = {};
    for (const dilim of dilimle(kurIstek, KUR_AZAMI_KOD)) {
      const sonuc = await fetchKur(dilim, { signal });
      if (!sonuc.ok) {
        hata = sonuc.error.message;
        continue;
      }
      if (sonuc.data.uyari) uyarilar.push(sonuc.data.uyari);
      for (const satir of sonuc.data.kurlar) {
        bulunan[satir.kod] = satir.fiyatTry;
      }
    }
    for (const e of kurEsleme) {
      const v = bulunan[e.anahtar];
      if (typeof v === 'number') {
        // Webin para birimi de TRY (`basketPrice` `cur: 'TRY'`).
        fiyatlar[e.id] = { fiyat: v, birim: 'TRY', kaynak: 'kur' };
      } else {
        // Tanınmayan kodu uç 200 ile ama SATIRSIZ döndürüyor
        // (`types.ts` `KurResponse` notu) — burada sayıya dönüşüyor.
        olculemedi.push(e.id);
      }
    }
  }

  return { fiyatlar, olculemedi, kaynaksiz, uyarilar, hata };
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
