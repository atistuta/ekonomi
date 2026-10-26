// =====================================================================
//  TEST YARDIMCILARI — mobile şeridinin ortak denetim dili
// ---------------------------------------------------------------------
//  NEDEN JEST DEĞİL: ÖLÇÜLDÜ (2026-10-26). `mobile/package.json` içinde
//  jest / jest-expo / @testing-library YOK; `mobile/node_modules` altında
//  yalnız Expo'nun dolaylı getirdiği `jest-util`, `jest-worker`,
//  `jest-validate`, `jest-get-type` parçaları var — koşucu (`jest` ikilisi)
//  yok. `npm install` bu şeritte yasak olduğu için KURULU OLMAYAN hiçbir
//  şeye dayanılmadı.
//
//  NEDEN `node --test` DEĞİL, ELLE DENETİM: kök repo (`tests/uc-test.mjs`,
//  `tests/uretim-test.mjs`, `tests/metin-test.mjs`, `tests/nabiz-yon-test.mjs`)
//  hepsi `ok(ad, kosul, ek)` + sonda tek özet deseniyle yazılmış. İkinci bir
//  çıktı biçimi getirmek, aynı repoda iki farklı "geçti" dili doğururdu.
//  Üslup oradan alındı; çıktı biçimi birebir aynı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

let gecti = 0;
const kaldi = [];

/** Tek denetim. `ek` yalnız KALDIĞINDA basılır — ölçülen değer görünsün. */
export function ok(ad, kosul, ek) {
  if (kosul) { gecti++; return true; }
  kaldi.push(ad + (ek ? '\n      ' + ek : ''));
  return false;
}

/**
 * Beklenen dizgi denetimi. Kaldığında İKİ tarafı da basar — "beklenen X,
 * gelen Y" olmadan kırmızı bir test hata ayıklanamaz.
 */
export function esit(ad, gelen, beklenen) {
  return ok(ad, gelen === beklenen, `beklenen ${JSON.stringify(beklenen)} · gelen ${JSON.stringify(gelen)}`);
}

/** Bölüm başlığı — kök repodaki numaralı bölüm düzeni. */
export function bolum(baslik) {
  console.log('\n' + baslik);
}

/** Atması GEREKEN çağrı. Hep yeşil yanan test hiçbir şey ölçmez. */
export function atar(ad, fn) {
  try {
    fn();
    return ok(ad, false, 'atmadı — reddetmesi gerekirken geçti');
  } catch {
    return ok(ad, true);
  }
}

export function sayac() {
  return { gecti, kalan: kaldi.length };
}

/** Sonuç özeti + sorumluluk satırı. Çıkış kodu: 0 geçti, 1 kaldı. */
export function bitir(ozet) {
  console.log('\n' + '─'.repeat(60));
  if (kaldi.length === 0) {
    console.log(`✅ ${gecti} denetim geçti — ${ozet}`);
    console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
    process.exit(0);
  }
  console.log(`❌ ${kaldi.length} denetim KALDI (${gecti} geçti):\n`);
  for (const k of kaldi) console.log('   ✗ ' + k);
  console.log('\nBilgi amaçlıdır, yatırım tavsiyesi değildir.');
  process.exit(1);
}
