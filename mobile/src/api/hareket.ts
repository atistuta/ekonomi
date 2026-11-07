// =====================================================================
//  ENDEKS HAREKETLERİ → /api/causal GİRDİSİ      (ŞERİT 4 / native)
// ---------------------------------------------------------------------
//  NE: `/api/causal`ın `hareketler` yarısını ÖLÇÜLMÜŞ sayıyla kurar.
//  Dört endeksin gün değişimini `/api/chart` (`gunici.dayChg`) ile okur
//  ve `NedenHareketGirdi[]` döndürür. Hiçbir sayı türetilmiyor: `pct`
//  ucun verdiği HAM yüzde puan.
//
//  ── NİYE ARTIK MÜMKÜN: `notable` EŞİĞİ MOTORDA ─────────────────────
//  Bu şerit önce AÇILAMIYORDU. `/api/causal` "belirgin" eşiğini
//  (`notable`) her hareket için İSTEMCİDEN zorunlu istiyordu, oysa eşik
//  yalnız web ekranının kendi tablosunda yaşıyordu — native istemcinin
//  onu ölçen bir kaynağı YOKTU ve eşiği buraya yazmak §5.1'in yasakladığı
//  şeydi (istemcide eşik). 2026-11-03'te eşik motora taşındı
//  (`INDEX_ESIK`, motor dilimi `endeks-esik`) ve uç onu kendisi okuyor;
//  bu yüzden AŞAĞIDA `notable` HİÇ GÖNDERİLMİYOR. Gönderilmemesi
//  "unuttum" değil, KASITLI: eşik sunucunun.
//
//  ── NİYE 5 DAKİKALIK ADIM ──────────────────────────────────────────
//  ÖLÇÜLDÜ (api/chart.js:362): `gunici` YALNIZ `interval=5m` iken
//  hesaplanıyor; başka adımda uç `guniciKod='adim_uygun_degil'` diyor,
//  yani "sormadın". Gün değişimini günlük mumdan kendim çıkarmak
//  (son kapanış / önceki kapanış) istemcide FORMÜL olurdu.
//
//  ── KIND ⇄ SEMBOL EŞLEMESİ NİYE BURADA ─────────────────────────────
//  Bu bir EŞİK/AĞIRLIK/FORMÜL DEĞİL, sunucunun kapalı kümesinin
//  kopyası — `ENDEKS_SEMBOLLER`in (client.ts) aynı gerekçesi. Dört
//  `kind` motorun `CAUSAL_INDEX_AFFINITY` anahtarları, dört sembol de
//  `api/_girdi.js` `ENDEKS_SOZLUGU` anahtarları; ikisi de SUNUCUDA
//  kapalı küme. Pazar GÖNDERİLMİYOR çünkü bu dört kalem için pazarı
//  sözlük söylüyor (`cozEndeks`, api/_girdi.js:119-131) — sorgudan gelen
//  `market` onlara UYGULANMIYOR.
//
//  ── SESSİZ KAYIP YOK ───────────────────────────────────────────────
//  Ölçülemeyen endeks `pct: 0` ile DOLDURULMUYOR (0 "gün yatay" demek).
//  Düşen her kalem `dusen[]` içinde kendi makine koduyla sayılıyor;
//  DÖRDÜ DE düşerse sonuç `ok` değil `unmeasured` oluyor — boş bir
//  `hareketler` dizisi "ölçtüm, belirgin hareket yok" anlamına gelir ve
//  bu iki durum birbirine KARIŞTIRILMAMALI.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import {
  type ApiResult,
  DEFAULT_TIMEOUT_MS,
  type EndeksSembol,
  ENDPOINTS,
  fetchChart,
} from './client';
import type { NedenHareketGirdi, NedenKind } from './types';

/**
 * Nedensellik ucunun dört `kind`i ile grafik ucunun dört endeks
 * sembolü. Sıra SABİT ve anlamlı değil — uç sıralamayı kendi yapıyor.
 */
export const NEDEN_ENDEKSLERI: readonly { kind: NedenKind; symbol: EndeksSembol }[] = [
  { kind: 'equity_tr', symbol: 'XU100' },
  { kind: 'equity_us', symbol: '^GSPC' },
  { kind: 'equity_tech', symbol: '^IXIC' },
  { kind: 'gold', symbol: 'GC=F' },
];

/** Ölçülemeyen bir endeks — NEDENİ makine koduyla. */
export type HareketDusen = {
  kind: NedenKind;
  symbol: string;
  /**
   * Ucun kendi kodu (`guniciKod`, `bad_symbol`, ...) ya da yerel
   * `'dayChg_olculemedi'`. Cümle `sozluk.ts`in işi, burada DEĞİL.
   */
  kod: string;
};

/** Köprünün dönüşü: girdi + künyesi. */
export type HareketOlcumu = {
  /** `/api/causal`a OLDUĞU GİBİ gidecek dizi. `notable` YOK. */
  hareketler: NedenHareketGirdi[];
  /** Ölçülemeyen endeksler, nedenleriyle. */
  dusen: HareketDusen[];
  /** Kaç endeks soruldu (şu an 4) — ekran oranı yazabilsin. */
  sorulan: number;
};

export type HareketAyar = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Dört endeksi PARALEL ölçer ve `/api/causal` girdisini kurar.
 *
 * Dönüş `ApiResult` çünkü `useIstek` bunu bekliyor. İptal (`canceled`)
 * OLDUĞU GİBİ yukarı veriliyor — `useIstek` iptali durumu bozmadan
 * yutuyor, biz onu "ölçemedim"e çevirirsek ekran yanlış cümle yazar.
 */
export async function fetchNedenHareketleri(
  ayar: HareketAyar = {},
): Promise<ApiResult<HareketOlcumu>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = ayar;

  const sonuclar = await Promise.all(
    NEDEN_ENDEKSLERI.map((e) =>
      // `range: '1d'` + `interval: '5m'`: gün içi katmanın koştuğu tek
      // bileşim (api/chart.js:362). Daha uzun aralık istemek aynı
      // `gunici`yi verirdi ama gereksiz mum indirirdi.
      fetchChart(e.symbol, { range: '1d', interval: '5m', timeoutMs, signal }),
    ),
  );

  const hareketler: NedenHareketGirdi[] = [];
  const dusen: HareketDusen[] = [];

  for (let i = 0; i < NEDEN_ENDEKSLERI.length; i += 1) {
    const e = NEDEN_ENDEKSLERI[i];
    const s = sonuclar[i];

    if (!s.ok) {
      if (s.error.kind === 'canceled') return s;
      dusen.push({ kind: e.kind, symbol: e.symbol, kod: s.error.code ?? s.error.kind });
      continue;
    }

    const g = s.data.gunici;
    if (!g) {
      // `guniciKod` NEDENİ söylüyor: 'adim_uygun_degil' (sormadım) ya da
      // 'mum_az' (ölçemedim). İkisi AYRI; biz uydurmuyoruz.
      dusen.push({ kind: e.kind, symbol: e.symbol, kod: s.data.guniciKod ?? 'gunici_yok' });
      continue;
    }
    if (!Number.isFinite(g.dayChg)) {
      dusen.push({ kind: e.kind, symbol: e.symbol, kod: 'dayChg_olculemedi' });
      continue;
    }

    // HAM SAYI: yuvarlama/ölçekleme YOK. `notable` YOK — eşik motorda.
    hareketler.push({ kind: e.kind, pct: g.dayChg });
  }

  if (!hareketler.length) {
    return {
      ok: false,
      error: {
        kind: 'unmeasured',
        message: 'Endeks gün değişimleri ölçülemedi.',
        endpoint: ENDPOINTS.chart,
        code: dusen.length ? dusen[0].kod : 'hareket_yok',
      },
    };
  }

  return { ok: true, data: { hareketler, dusen, sorulan: NEDEN_ENDEKSLERI.length } };
}
