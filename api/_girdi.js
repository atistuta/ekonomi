// =====================================================================
//  api/_girdi.js — GİRDİ KAPISI (beşinci taşıyıcı)
//
//  NE: /api/score · /api/recommend · /api/analyze uçlarının ORTAK girdi
//  doğrulaması ve ayrıştırması. Sınırlar (AZAMI_SEMBOL · AZAMI_SORGU ·
//  PAZARLAR · VARSAYILAN_VADE · SEMBOL_BICIM), `ayristir()` ve
//  `temizleSembol()` burada — ve YALNIZ burada.
//
//  NİYE VAR — ÖLÇÜLEN BORÇ: bu metin üç uçta BİREBİR kopyaydı (61 kod
//  satırı / 2.401 karakter; uc-test ⑤e üçünü metin olarak karşılaştırıp
//  sürüklenmeyi bekçiliyordu). Kilit kopyayı ÖLÇÜYORDU ama ortadan
//  KALDIRMIYORDU: üç dosyada aynı sayıyı elle güncellemek zorunluluğu
//  sürüyordu. `api/recommend.js:37` "üçüncü bir uç aynı kapıya ihtiyaç
//  duyduğu gün kopya değil TAŞIYICI doğru cevap olur" diye yazıyordu;
//  /api/analyze üçüncü kopyayı açtı, yani o gün geldi.
//
//  BİRLEŞTİRME KÖR YAPILMADI: üç bölge taşınmadan ÖNCE karşılaştırıldı
//  (uc-test ⑤e'nin yaptığı gibi, yorumlar/boş satırlar çıkarılarak).
//  Sonuç: üç bölgenin KODU birebir aynıydı, yalnız gerekçe YORUMLARI
//  farklıydı. Yani parametreleştirilecek bir DAVRANIŞ farkı YOK — biri
//  "kazanmadı", üçü de aynı şeyi söylüyordu. Fark bulunsaydı buraya
//  seçenek olarak girecekti, sessizce bastırılmayacaktı.
//
//  TAŞIYICI AYRIMI — bu dosya ELLE YAZILIR:
//    ÜRETİLEN  : api/_motor.js (app.js'ten) · api/_ayar.js (config.js'ten)
//                → `node tools/motor-uret.mjs`; ELLE DÜZENLENMEZ.
//    ELLE YAZAN: api/_ag.js (canlı ağ + süre freni) · api/_akis.js (akış)
//                · api/_girdi.js (BU DOSYA).
//  `_` öneki Vercel'in bu dosyayı rota olarak yayınlamasını engelliyor —
//  taşıyıcı bir uç nokta DEĞİL.
//
//  SINIR — NE YAPMAZ: ağa ÇIKMAZ, motora DOKUNMAZ, skor HESAPLAMAZ.
//  Saf fonksiyon olması testin fikstür ya da ağ olmadan doğrulamayı
//  sınayabilmesini sağlıyor (uc-test ⑤e vektör eşitliği). Modül düzeyi
//  konak/motor kurulumu (canliAg + buildMotor) BİLEREK uçlarda KALDI:
//  o kurulum doğrulama değil, her ucun kendi sıcak-lambda durumu.
//
//  HAM SAYI kuralı (BAGIMLILIK_GRAFIGI.md §5.1) burada da geçerli:
//  hata gövdeleri yalnız MAKİNE KODU ve sayı taşıyor (`symbols_yok`,
//  `too_long`, `bad_vade`, `bad_market`, `cok_sembol`, `bad_symbol`) —
//  serbest Türkçe cümleyi istemci kuruyor. Emoji/para simgesi yok.
// =====================================================================

import { VADELER } from './_ayar.js';

// ---------------------------------------------------------------------
//  SINIRLAR — neden bu sayılar
//
//  AZAMI_SEMBOL = 8 · üç ayrı gerekçe aynı sayıda buluşuyor:
//    ① İstemcinin kendi tavanı 8. Karşılaştır ekranı en çok 8 hisse
//       alıyor (v69'da 6'dan 8'e çıkarıldı) — tek seferde daha fazlasını
//       isteyecek bir ekran yok.
//    ② Zaman bütçesi. ÖLÇÜLDÜ (2026-10-14, tests/duman.mjs): bir ABD
//       sembolü 7,2 sn — 5y mum + 1y mum + SEC modeli (31 SEC isteği,
//       aralarında 125 ms zorunlu bekleme). Eski tahmin "3-6 sn"di, ölçüm
//       onu YUKARI düzeltti. Endeks mumları turda bir kez indiriliyor
//       (_ag.js `birKez`), yani ikinci sembolden sonra bir istek daha az.
//       8 × 7,2 sn ≈ 58 sn; süre freni (_ag.js TUR_BUTCE_MS 45 sn) 8
//       sembolde GERÇEKTEN dolar ve son semboller `atlanan`a düşer. Bu bir
//       arıza değil, frenin işini yapması — ama "8 sembol rahat sığar"
//       varsayımı ÖLÇÜMLE ÇÜRÜDÜ. BIST sembolleri daha pahalı: mali tablo
//       yolu üç yılı sırayla deniyor.
//    ③ Yayılma sınırı. Sembol başına en çok ~6 dış istek düşüyor; 8 sembol
//       ≈ 48 istek. SEC tarafı 125 ms aralıkla sıraya giriyor (_ag.js
//       SEC_ARALIK_MS) → hız sınırı aşılmıyor. Sınır olmasa tek bir istek
//       yüzlerce dış isteği başlatabilirdi.
//
//  SÜRE eşiği burada DEĞİL: `api/_ag.js` taşıyor (TUR_BUTCE_MS ·
//  TUR_TAVAN_MS). Girdi kapısı "kaç sembol" sorusuna bakar, "ne kadar
//  süre" sorusuna ağ taşıyıcısı bakar — iki ayrı sorumluluk.
// ---------------------------------------------------------------------
export const AZAMI_SEMBOL = 8;
export const PAZARLAR = ['US', 'BIST'];
export const VARSAYILAN_VADE = 'orta';
export const AZAMI_SORGU = 128; // api/theme.js'in `too_long` eşiğiyle aynı fikir

// Sembol biçimi api/watchlist.js cleanList() ile AYNI — iki uç aynı sembol
// kümesini kabul etmeli, yoksa listeye eklenen bir sembol skorlanamaz.
export const SEMBOL_BICIM = /^[A-Z][A-Z0-9.\-]{0,7}$/;

// ---------------------------------------------------------------------
//  Girdi ayrıştırma — AĞA ÇIKMAZ, bu yüzden ayrı ve dışa aktarılmış:
//  tests/uc-test.mjs doğrulamayı fikstür ya da ağ olmadan sınayabiliyor.
//  Üç uç bu TEK bağlamayı yeniden dışa aktarıyor, yani `score.ayristir`,
//  `recommend.ayristir` ve `analyze.ayristir` AYNI FONKSİYON NESNESİ.
//  Metin karşılaştırmasından güçlü bir kilit: kopya ayrışması artık
//  mümkün değil, çünkü kopya yok.
// ---------------------------------------------------------------------
export function ayristir(q = {}) {
  const hata = (http, govde) => ({ hata: { http, govde } });

  const ham = String(q.symbols ?? q.symbol ?? '').trim();
  if (!ham) return hata(400, { error: 'symbols_yok', azami: AZAMI_SEMBOL });
  if (ham.length > AZAMI_SORGU) return hata(400, { error: 'too_long', azami: AZAMI_SORGU });

  const vade = String(q.vade ?? VARSAYILAN_VADE).trim();
  if (!VADELER.includes(vade)) return hata(400, { error: 'bad_vade', izinli: VADELER });

  const gPazar = String(q.market ?? '').trim().toUpperCase();
  if (gPazar && !PAZARLAR.includes(gPazar)) return hata(400, { error: 'bad_market', izinli: PAZARLAR });

  const parcalar = ham.split(',').map((s) => s.trim()).filter(Boolean);
  if (!parcalar.length) return hata(400, { error: 'symbols_bos' });
  // Kırpmak YERİNE reddediyoruz: api/yfin.js slice(0, 12) ile sessizce
  // kırpıyor, ama orada eksik sembol yalnız bir kıyas satırı düşürüyor.
  // Burada eksik sembol EKSİK SKOR demek olurdu ve istemci bunu farketmez.
  if (parcalar.length > AZAMI_SEMBOL) {
    return hata(400, { error: 'cok_sembol', azami: AZAMI_SEMBOL, istenen: parcalar.length });
  }

  const rows = [];
  const gecersiz = [];
  const gorulen = new Set();
  for (const p of parcalar) {
    const r = temizleSembol(p, gPazar || 'US');
    if (!r) { gecersiz.push(String(p).slice(0, 16)); continue; }
    const anahtar = r.market + ':' + r.sym;
    if (gorulen.has(anahtar)) continue; // yineleyi at: aynı sembol iki kez skorlanmaz
    gorulen.add(anahtar);
    rows.push(r);
  }
  if (gecersiz.length) return hata(400, { error: 'bad_symbol', gecersiz });

  return { rows, vade, market: gPazar || 'US' };
}

/**
 * Tek sembolü temizle ve pazarını çöz. Dönen `sym` motorun beklediği ÇIPLAK
 * koddur: yahooSymbol() BIST'e '.IS'i kendisi ekliyor (_motor.js:89),
 * fetchIsYatirimMali ise companyCode olarak çıplak kodu istiyor.
 */
export function temizleSembol(ham, varsayilanPazar) {
  let s = String(ham).toUpperCase().trim();
  let pazar = varsayilanPazar;
  const iki = s.split(':');
  if (iki.length === 2) {
    if (!PAZARLAR.includes(iki[1])) return null;
    pazar = iki[1];
    s = iki[0];
  } else if (s.endsWith('.IS')) {
    pazar = 'BIST';
    s = s.slice(0, -3);
  }
  s = s.slice(0, 8);
  if (!SEMBOL_BICIM.test(s)) return null;
  return { sym: s, market: pazar };
}
