// ===========================================================================
//  ÜRETİLMİŞTİR — ELLE DÜZENLEMEYİN   ·   GEÇİCİ: Commit C'de SİLİNECEK
// ===========================================================================
//
//  Kaynak : app.js (ekran katmanı sabitleri — readRenderConstants)
//  Yenile : node tools/motor-uret.mjs
//  Doğrula: node tests/uretim-test.mjs
//
//  NEDEN VAR: motorun döndürdüğü skor kullanıcının gördüğü skor DEĞİL.
//  Ekran katmanı araya iki şey sokuyor: F/K "Değerleme" kriterini kriter
//  listesine ekliyor (yalnız ABD/ADR) ve FA/TA bileşkesini harmanlıyor.
//  /api/score aynı sayıyı döndürmek zorunda olduğu için sabitler burada.
//
//  NEDEN GEÇİCİ: doğru yer burası değil, motorun içi. Commit C kriteri
//  motora devredip app.js'teki ekran kopyalarını kaldıracak; o gün bu
//  dosya SİLİNİR. Kalıcı sanıp üstüne bir şey inşa etmeyin.
//
//  F/K kriteri     : 3 ekran kopyası, hepsi aynı
//  Bileşke harmanı : 3 kopya, hepsi aynı
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// ===========================================================================

export const IMZA_EKRAN = 'sha256:0261b11ea8ad06d5';

/**
 * F/K "Değerleme" kriteri — app.js ekran katmanından okundu.
 *   pe   = price / eps
 *   skor = pe < 0 ? PE.neg : faInterp(pe, PE.bp)
 * Kriter listesine PE.weight ağırlığıyla, `valuation` grubunda ekleniyor.
 * BIST'te bu ek YOK — orada fa = computeFaScore(model.criteria) doğrudan.
 */
export const PE = {
  weight: 0.1,
  neg: 15,
  bp: [[5,90], [10,80], [15,70], [20,60], [25,52], [35,38], [50,22], [80,10]],
};

/** Bileşke harmanı: blended = BLEND.fa * faScore + BLEND.ta * taScore. */
export const BLEND = { fa: 0.55, ta: 0.45 };
