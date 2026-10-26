// =====================================================================
//  DEPO DENETİMLERİ — `src/api/depo.ts`                      (ŞERİT 1)
// ---------------------------------------------------------------------
//  NE: türlü deponun SÖZLEŞMESİNİ ölçer — göç kayıpsızlığı ve
//  idempotentliği, bozuk kayıtta çökmeme, 8 sınırının SEBEPLE reddi,
//  `0` ile `null` ayrımı (sessiz sıfır), ve depo yazamadığında oturum
//  içi davranış.
//
//  NEDEN BELLEK-İÇİ SÜRÜCÜ: `@react-native-async-storage/async-storage`
//  Node'da yüklenmez (yerel RN modülü bekler). `tests/cozucu-kanca.mjs`
//  yalnız `@/lib/kalici`yı yedekliyor; `depo.ts` kendi deposunu
//  `depoSurucuAta()` ile DIŞARIDAN alıyor, bu yüzden gerçek dosya
//  ölçülüyor — taklit değil.
//
//  NEDEN HER SENARYO İÇİN TAZE MODÜL: `depo.ts` modül düzeyinde durum
//  tutuyor (`liste.ts:65` ile aynı kalıp). Sorgu dizgisiyle içe aktarma
//  (`depo.ts?v=N`) Node'un modül önbelleğini atlatır; ÖLÇÜLDÜ
//  (2026-10-26, Node v24.14.1): iki içe aktarma AYRI nesne dönüyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import './cozucu.mjs';

import { bitir, bolum, esit, ok } from './yardim.mjs';

/** Bellek-içi depo. `yazilabilir:false` = kota dolu / özel pencere. */
function bellekSurucu(baslangic = {}, yazilabilir = true) {
  const kutu = new Map(Object.entries(baslangic));
  return {
    kutu,
    oku: async (a) => (kutu.has(a) ? kutu.get(a) : null),
    yaz: async (a, d) => {
      if (!yazilabilir) throw new Error('kota dolu');
      kutu.set(a, d);
    },
    sil: async (a) => {
      if (!yazilabilir) throw new Error('kota dolu');
      kutu.delete(a);
    },
  };
}

let surum = 0;
/** Taze modül örneği + ona bağlı taze sürücü. */
async function taze(baslangic = {}, yazilabilir = true) {
  surum += 1;
  const mod = await import('../src/api/depo.ts?v=' + surum);
  const surucu = bellekSurucu(baslangic, yazilabilir);
  mod.depoSurucuAta(surucu);
  return { d: mod, s: surucu };
}

const K = {
  listeler: 'sb:lists',
  sepet: 'sb:basket',
  gecmis: 'sb:basket:history',
  hamleler: 'sb:basket:moves',
  kiyas: 'sb:compare',
  goc: 'sb:depo:goc',
  yedek: 'sb:lists:goc-yedek',
};

const { AZAMI_SEMBOL } = await import('../src/api/types.ts');

// ---------------------------------------------------------------------
bolum('1. Göç — düz sembol dizisi → adlandırılmış liste şeması');
// ---------------------------------------------------------------------

const DUZ = ['AAPL', 'MSFT', 'NVDA', 'THYAO.IS'];
{
  const ham = JSON.stringify(DUZ);
  const { d, s } = await taze({ [K.listeler]: ham });
  const sonuc = await d.goc();

  ok('düz kayıt göçtü', sonuc.kostu === true, 'not: ' + sonuc.not);
  esit('göçen sembol sayısı', sonuc.sembol, DUZ.length);

  const yeni = JSON.parse(s.kutu.get(K.listeler));
  ok('kayıt artık adlandırılmış liste dizisi', Array.isArray(yeni) && yeni.length === 1);
  esit('varsayılan liste adı', yeni[0].name, 'Takip');
  esit(
    'semboller KAYIPSIZ taşındı',
    yeni[0].items.map((i) => i.symbol).join(','),
    DUZ.join(','),
  );
  ok(
    'pazar alanı sembolden türetildi (.IS → BIST)',
    yeni[0].items[3].market === 'BIST' && yeni[0].items[0].market === 'US',
    JSON.stringify(yeni[0].items[3]),
  );
  esit('eski ham kayıt yedeklendi', s.kutu.get(K.yedek), ham);

  const ikinci = await d.goc();
  ok('ikinci koşu dönüştürme YAPMAZ (bir kez)', ikinci.kostu === false, 'not: ' + ikinci.not);

  // Nişan silinse bile aynı sonuç: idempotentlik nişana BAĞLI DEĞİL.
  s.kutu.delete(K.goc);
  const oncesi = s.kutu.get(K.listeler);
  const ucuncu = await d.goc();
  ok('nişan silinince de dönüştürme YAPMAZ', ucuncu.kostu === false, 'not: ' + ucuncu.not);
  esit('kayıt değişmedi (idempotent)', s.kutu.get(K.listeler), oncesi);
}

{
  const adli = JSON.stringify([
    { id: 'robot', name: '🤖 Robot', items: [{ symbol: 'AAPL', market: 'US', query: 'AAPL' }] },
  ]);
  const { d, s } = await taze({ [K.listeler]: adli });
  const sonuc = await d.goc();
  ok('zaten adlandırılmış kayıta dokunulmaz', sonuc.kostu === false, 'not: ' + sonuc.not);
  esit('yabancı liste aynen duruyor', s.kutu.get(K.listeler), adli);
  esit('gereksiz yedek açılmadı', s.kutu.has(K.yedek), false);
}

{
  const ham = JSON.stringify(DUZ);
  const { d, s } = await taze({ [K.listeler]: ham }, false);
  const sonuc = await d.goc();
  ok('yazamayan depoda göç başlatılmaz', sonuc.kostu === false, 'not: ' + sonuc.not);
  esit('ESKİ VERİ SİLİNMEDİ', s.kutu.get(K.listeler), ham);
  esit('nişan konmadı — sonraki açılış yeniden dener', s.kutu.has(K.goc), false);
}

{
  // Yedek YAZILDI ama kaydın kendisi yazılamadı: ara durum. Nişan
  // KONMAMALI, yoksa göç bir daha hiç denenmez ve düz kayıt sonsuza
  // kadar dönüştürülmemiş kalır.
  const ham = JSON.stringify(DUZ);
  surum += 1;
  const d = await import('../src/api/depo.ts?v=' + surum);
  const kutu = new Map([[K.listeler, ham]]);
  d.depoSurucuAta({
    oku: async (a) => (kutu.has(a) ? kutu.get(a) : null),
    yaz: async (a, v) => {
      if (a === K.listeler) throw new Error('kota dolu');
      kutu.set(a, v);
    },
    sil: async (a) => void kutu.delete(a),
  });
  const sonuc = await d.goc();
  ok('yedek yazılıp kayıt yazılamayınca göç yarıda kesildi', sonuc.kostu === false, 'not: ' + sonuc.not);
  esit('yedek yerinde', kutu.get(K.yedek), ham);
  esit('eski düz kayıt yerinde', kutu.get(K.listeler), ham);
  esit('nişan KONMADI — yeniden denenecek', kutu.has(K.goc), false);
}

{
  const { d, s } = await taze({ [K.listeler]: '[{"id":"a","items":[' });
  const sonuc = await d.goc();
  ok('bozuk kayıtta göç dönüştürmez', sonuc.kostu === false, 'not: ' + sonuc.not);
  esit('bozuk kayıt SİLİNMEDİ', s.kutu.get(K.listeler), '[{"id":"a","items":[');
}

// ---------------------------------------------------------------------
bolum('2. Bozuk / yarım kayıt — çökme yok, dürüst bayrak');
// ---------------------------------------------------------------------

{
  const { d } = await taze({ [K.listeler]: '{bu json değil' });
  esit('okuma öncesi hazır DEĞİL', d.listelerDepo.hazirMi(), false);
  const deger = await d.listelerDepo.oku();
  ok('bozuk JSON okuması fırlatmadı', Array.isArray(deger) && deger.length === 0);
  esit('okuma sonrası hazır', d.listelerDepo.hazirMi(), true);
  esit('budandı bayrağı kalkmış', d.listelerDepo.budandiMi(), true);
  esit('tür genelinde budandı', d.kayitBudandiMi(), true);
}

{
  const yarim = JSON.stringify([
    { id: 'a', name: 'A', items: [{ symbol: 'AAPL' }, null, 5, { yok: 1 }, 'MSFT'] },
    null,
    7,
    { name: 'kimliksiz' },
  ]);
  const { d } = await taze({ [K.listeler]: yarim });
  const listeler = await d.listelerDepo.oku();
  esit('yalnız kimliği olan liste kaldı', listeler.length, 1);
  esit('sağlam öğeler korundu', listeler[0].items.map((i) => i.symbol).join(','), 'AAPL,MSFT');
  esit('atılan satırlar bildirildi', d.listelerDepo.budandiMi(), true);
  esit('eksik query sembolle dolduruldu', listeler[0].items[0].query, 'AAPL');
}

{
  const sepet = JSON.stringify([
    { id: 'b1', cls: 'bist', symbol: 'THYAO.IS', qty: 10, cost: 300.1234 },
    { id: 'b2', cls: 'bilinmeyen', symbol: 'X', qty: 1 },
    { cls: 'us', symbol: 'AAPL' },
  ]);
  const { d } = await taze({ [K.sepet]: sepet });
  const kalemler = await d.sepetDepo.oku();
  esit('tanınmayan sınıf atıldı', kalemler.length, 1);
  esit('kuruş YUVARLANMADI (ham sayı)', kalemler[0].cost, 300.1234);
  esit('bozuk sepet kaydı bildirildi', d.sepetDepo.budandiMi(), true);
}

// ---------------------------------------------------------------------
bolum('3. Sınır 8 (AZAMI_SEMBOL) — SEBEPLE reddedilir');
// ---------------------------------------------------------------------

{
  const sekiz = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'].map((s) => ({
    symbol: s,
    market: 'US',
    query: s,
  }));
  const { d } = await taze({
    [K.listeler]: JSON.stringify([{ id: 'dolu', name: 'Dolu Liste', items: sekiz }]),
  });
  await d.listelerDepo.oku();
  esit('uç sözleşmesi 8', AZAMI_SEMBOL, 8);

  const sonuc = await d.listeyeEkle('dolu', 'tsla');
  esit('dolu listeye ekleme reddedildi', sonuc.ok, false);
  esit('ret SEBEBİ taşınıyor', sonuc.sebep, 'dolu');
  ok('ret mesajı sınırı ve listeyi söylüyor', /8/.test(sonuc.mesaj) && /Dolu Liste/.test(sonuc.mesaj), sonuc.mesaj);

  const yineleme = await d.listeyeEkle('dolu', 'a1');
  esit('yineleme sebebi ayrı', yineleme.sebep, 'zaten_var');
  const bos = await d.listeyeEkle('dolu', '   ');
  esit('boş sembol sebebi ayrı', bos.sebep, 'bos');
  const yok = await d.listeyeEkle('olmayan', 'AAPL');
  esit('olmayan liste sebebi ayrı', yok.sebep, 'yok');
}

{
  const dokuz = Array.from({ length: 9 }, (_, i) => ({
    symbol: 'S' + i,
    market: 'US',
    query: 'S' + i,
  }));
  const { d } = await taze({
    [K.listeler]: JSON.stringify([{ id: 'asan', name: 'Aşan', items: dokuz }]),
  });
  const listeler = await d.listelerDepo.oku();
  esit('okumada liste 8e budandı', listeler[0].items.length, AZAMI_SEMBOL);
  esit('budama SESSİZ değil', d.listelerDepo.budandiMi(), true);
}

{
  const bes = (onek) =>
    Array.from({ length: 5 }, (_, i) => ({ symbol: onek + i, market: 'US', query: onek + i }));
  const { d } = await taze({
    [K.listeler]: JSON.stringify([
      { id: 'l1', name: 'Bir', items: bes('P') },
      { id: 'l2', name: 'İki', items: bes('Q') },
      { id: 'l3', name: 'Dışarıda', items: bes('R'), inUniverse: false },
    ]),
  });
  await d.listelerDepo.oku();
  const evren = d.evrenSemboller();
  esit('uç turu başına en çok 8 sembol', evren.semboller.length, AZAMI_SEMBOL);
  esit('aşım bildirildi', evren.budandi, true);
  ok(
    'evrene alınmayan liste hiç girmedi',
    evren.semboller.every((s) => !s.startsWith('R')),
    evren.semboller.join(','),
  );
}

{
  const sekizKiyas = Array.from({ length: 8 }, (_, i) => ({
    symbol: 'C' + i,
    market: 'US',
    query: 'C' + i,
  }));
  const { d } = await taze({ [K.kiyas]: JSON.stringify(sekizKiyas) });
  await d.kiyasDepo.oku();
  const sonuc = await d.kiyasaEkle('AAPL');
  esit('kıyas seti 8te dolu', sonuc.ok, false);
  esit('kıyas ret sebebi', sonuc.sebep, 'dolu');
  ok('kıyas mesajı 8i söylüyor', /8/.test(sonuc.mesaj), sonuc.mesaj);
}

// ---------------------------------------------------------------------
bolum('4. Sessiz sıfır — fn(0) ile fn(null) AYNI ŞEY DEĞİL');
// ---------------------------------------------------------------------

{
  const { d } = await taze({
    [K.sepet]: JSON.stringify([
      { id: 's0', cls: 'us', symbol: 'AAPL', qty: 0, cost: 0, addPrice: 0 },
      { id: 'sn', cls: 'us', symbol: 'MSFT', qty: null, cost: 'bozuk' },
      { id: 'c1', cls: 'cash', symbol: 'TRY', qty: 0, cost: 1 },
    ]),
  });
  const kalemler = await d.sepetDepo.oku();
  const sifir = kalemler.find((k) => k.id === 's0');
  const bos = kalemler.find((k) => k.id === 'sn');

  esit('qty 0 → 0 (sıfıra çevrilmedi, null yapılmadı)', sifir.qty, 0);
  esit('qty yok → null', bos.qty, null);
  ok('fn(0) !== fn(null)', sifir.qty !== bos.qty, `0 → ${sifir.qty} · null → ${bos.qty}`);
  esit('cost 0 korunuyor', sifir.cost, 0);
  esit('sayı olmayan cost → null', bos.cost, null);
  esit('nakit bakiyesi 0 → 0', d.nakitBakiye('TRY'), 0);
  esit('nakit kalemi YOK → null', d.nakitBakiye('USD'), null);
}

{
  const { d } = await taze({
    [K.hamleler]: JSON.stringify([
      { id: 'm0', cls: 'us', symbol: 'AAPL', type: 'remove', pl: 0, qty: 0 },
      { id: 'mn', cls: 'us', symbol: 'AAPL', type: 'add' },
    ]),
    [K.gecmis]: JSON.stringify([
      { date: '2026-10-25', total: 0, byClass: { us: 0, cash: 12.5 } },
      { date: 'bozuk-tarih', total: 5 },
    ]),
  });
  const hamleler = await d.hamlelerDepo.oku();
  esit('gerçekleşen K/Z 0 → 0', hamleler[0].pl, 0);
  esit('K/Z ölçülmedi → null', hamleler[1].pl, null);

  const gecmis = await d.sepetGecmisDepo.oku();
  esit('geçersiz tarihli kayıt atıldı', gecmis.length, 1);
  esit('toplam 0 → 0', gecmis[0].total, 0);
  esit('sınıf bazlı 0 korundu', gecmis[0].byClass.us, 0);
}

// ---------------------------------------------------------------------
bolum('5. Depo yazamıyor — oturum içi çalışır, SESSİZ kalmaz');
// ---------------------------------------------------------------------

{
  const { d, s } = await taze({}, false);
  esit('depo yazabilirliği dürüstçe false', await d.depoYazabilirMi(), false);

  const yazildi = await d.listelerDepo.yaz([
    { id: 'x', name: 'X', items: [{ symbol: 'AAPL', market: 'US', query: 'AAPL' }] },
  ]);
  esit('yazma başarısızlığı bildirildi', yazildi, false);
  esit('bellekteki değer yine güncellendi (oturum içi)', d.listelerDepo.al()[0].id, 'x');
  esit('diske hiçbir şey yazılmadı', s.kutu.has(K.listeler), false);

  const ekleme = await d.listeyeEkle('x', 'MSFT');
  esit('ekleme ret sebebi yazılamadı', ekleme.sebep, 'yazilamadi');
  ok('ret mesajı kalıcılık kaybını söylüyor', /oturum/i.test(ekleme.mesaj), ekleme.mesaj);
  esit('yine de bellekte eklendi', d.listelerDepo.al()[0].items.length, 2);

  const olustur = await d.listeOlustur('Yeni');
  esit('liste açma da dürüstçe yazılamadı diyor', olustur.sebep, 'yazilamadi');
}

{
  const { d, s } = await taze();
  esit('çalışan depo true', await d.depoYazabilirMi(), true);
  esit('sınama anahtarı temizlendi', s.kutu.has('sb:depo:sinama'), false);

  const olustur = await d.listeOlustur('Takip 2');
  esit('liste açıldı', olustur.ok, true);
  esit('kayıtta bir liste var', JSON.parse(s.kutu.get(K.listeler)).length, 1);
  const ikinci = await d.listeOlustur('takip 2');
  esit('aynı ad reddedildi (sebeple)', ikinci.sebep, 'zaten_var');

  const id = d.listeleriAl()[0].id;
  await d.listeYenidenAdlandir(id, 'Uzun Vade');
  esit('yeniden adlandırma kayda işlendi', JSON.parse(s.kutu.get(K.listeler))[0].name, 'Uzun Vade');
  await d.listeEvreneAl(id, false);
  esit('evrene dahil değil işareti', JSON.parse(s.kutu.get(K.listeler))[0].inUniverse, false);
  esit('evren artık boş', d.evrenSemboller().semboller.length, 0);
  await d.listeSil(id);
  esit('liste silindi', JSON.parse(s.kutu.get(K.listeler)).length, 0);
  const silYok = await d.listeSil(id);
  esit('olmayan listeyi silme sebebi', silYok.sebep, 'yok');
}

bitir(
  'göç kayıpsız ve idempotent, bozuk kayıt çökertmiyor, 8 sınırı sebeple reddediyor, 0 ile null ayrı, yazılamayan depo dürüstçe bildiriliyor',
);
