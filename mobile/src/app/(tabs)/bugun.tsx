// =====================================================================
//  BUGÜN — 2. sekme, MOTORA BAĞLI                     (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinin TEK TURDA kıyası: /api/compare. Motorun kendi
//  ürettiği `sira` dizisi (1'den başlayarak) ekrana olduğu gibi
//  basılıyor; sıralanamayanlar sessizce düşürülmüyor, yazıyor.
//
//  NEDEN SIRALAMAYI İSTEMCİ YAPMIYOR: `sira` alanı uçtan geliyor
//  (anahtar `dAtr`, eşitlik bozucu `skor10` — uç notu). Burada bir
//  `sort` yazmak İKİNCİ bir sıralama kuralı demekti; web ile native
//  ilk farklı veriye kadar aynı görünür, sonra ayrılırdı.
//
//  NEDEN "piyasa nabzı" ARTIK BURADA: bu başlık eskiden "makro/nabız/
//  sektör ucu yok" diyordu. O ÖLÇÜM ESKİDİ — `/api/pulse` yazıldı ve
//  manşeti KENDİ tarıyor (ÖLÇÜLDÜ 2026-10-25, üretim: POST {q:'Fed
//  faiz'} → 200, `kaynak:'sunucu'`, `haberler.tam:true`, 960 ms).
//  Bu yüzden ⚡ Makro Nabız kartı açıldı.
//
//  "SEKTÖR UCU YOK" NOTU DA ESKİDİ (ÖLÇÜLDÜ 2026-10-29, kaynak
//  okuması): `/api/sektor` VAR — ayrı bir dosya değil, `api/proxy.js`
//  üzerinden `api/_kesif.js` taşıyıcısında (`ROTALAR`, _kesif.js:85;
//  `sektorHandler`, :413) ve istemci karşılığı `fetchSektor`
//  (mobile/src/api/client.ts:1635). AMA O UÇ "öne çıkan sektör"
//  DEĞİL: POST ile `olcumler` (Yahoo temel verisi, `OlcumKayit`)
//  İSTİYOR, ağa hiç çıkmıyor ve değerleme GRUPLARI (medPe/medFpe/
//  medGrowth/medMargin/medPeg — HAM KESİR) döndürüyor. Girdiyi üreten
//  yüzey ZATEN YAZILDI ve Keşfet sekmesinde duruyor
//  (components/kesfet/SektorKart.tsx, künyeyi `fetchYfin`den kurup
//  `olcumler` olarak gönderiyor). Bu ekran onu KOPYALAMIYOR: aynı kart
//  iki sekmede iki ayrı Yahoo turu demekti.
//  Konjonktür FAZININ "öne çıkan sektörleri" ise ucu VAR ama GİRDİSİ
//  yok (aşağıdaki fıkra) — web'in `renderToday` başlığındaki o liste
//  `CYCLE_PHASES[m.phase].sectors`tan geliyor, yani FAZA bağlı; faz
//  ölçülmedikçe liste de ölçülmemiş olur. `/api/pulse`
//  `genislik`/`enflasyonBaskisi`/`risk` sayılarını çağırandan istiyor ve
//  bu uygulamada onları ölçen kaynak yok — uç `konjonktur: null` + hangi
//  girdinin eksik olduğunu döndürüyor, kart da bunu AÇIKÇA yazıyor.
//  Uydurma bir sayı göndermek tam olarak yasak olan şey: sahte veri.
//
//  NEDEN 📊 ENDEKS NABZI BURADA: büyük endekslerin günlük hareketi
//  "bugün" sorusunun ilk cevabı. Kartın KENDİ isteği YOK (components
//  içinde `fetch` yasak) — ölçümleri bu ekran `fetchChart` ile SIRAYLA
//  topluyor, çünkü uç TEK sembol alıyor (`cok_sembol`, azami 1); dört
//  çağrıyı aynı anda atmak istek fırtınası olurdu.
//
//  ENDEKS KAPISI AÇILDI (ÖLÇÜLDÜ 2026-10-29, kaynak okuması): bu başlık
//  2026-10-26'da "ortak sembol kapısı `^` ve `=` kabul etmiyor, yalnız
//  `XU100` geçer" diyordu; O NOT ESKİDİ. `api/_girdi.js:119-131` kapalı
//  bir `ENDEKS_SOZLUGU` kazandı (dördü de içinde) ve `cozEndeks`
//  (:144-151) AYRI bir çözücü olarak eklendi; `api/chart.js:245` önce
//  ona bakıyor (`cozEndeks(ham) || temizleSembol(...)`). Skor zinciri
//  (`ayristir()`, :161) hâlâ yalnız `temizleSembol` kullandığı için
//  gevşeme SIZMADI. Bu yüzden `ENDEKS_NABIZ`ın dört kaleminin de
//  `destekli` bayrağı artık `true` ve bu ekran dördünü de gerçekten
//  `/api/chart`'tan çekiyor. Bayrak mekanizması YERİNDE DURUYOR: karar
//  TEK YERDE (components/bugun/EndeksNabziKarti.tsx) ve bayrak yarın
//  `false` olursa bu ekran yine isteği atlar, kart da kalemi gizlemek
//  yerine "ölçülemedi" diye BASAR.
//
//  TAKİP ÖLÇÜMLERİ KARTI NEDEN AÇILDI: kıyas turu (`/api/compare`)
//  gövdesinde `sira` dizisinin YANINDA sembol başına TAM ölçüm kaydı
//  (`sonuclar`: ta · fa · composite · plan · analiz) geliyordu ve bu
//  ekran onu BASMIYORDU — ölçülmüş veri çöpe gidiyordu. Web'in
//  `renderToday` öneri listesi aynı sayıları gösteriyor. Kart ikinci bir
//  istek ATMAZ: aynı cevabın okunmayan alanlarını yazar.
//
//  BURADA HESAP YOK: sıra, durum, skor10, duruş kodu, yönler, faz —
//  hepsi uç alanları. Nabız kartında da eşik/ortalama/işaret kararı
//  YOK; yalnız sabit kümeden Türkçe karşılık seçiliyor ve biçimleme
//  `lib/format.ts`e bırakılıyor.
//
//  ── SIRALAMA KURALI (TASARIM TURU 2) ───────────────────────────────
//  1) Bugünün kararı: fiyata yakınlık sırası + takip ölçümleri
//  2) Kendi ucuna giden ölçümler: endeks nabzı · makro nabız
//  3) Künye/manşet: piyasa gündemi · takvim
//  4) Girdi bekleyen keşif aracı: tematik haber (AŞAĞI İNDİ)
//  5) Ölçülmeyenin ilanı: `Katlanir`, varsayılan KAPALI, EN ALTTA
//  Gerekçeler taşınan kartların kendi yorumlarında.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_HABER_SORGU,
  fetchChart,
  fetchCompare,
  fetchNews,
  fetchPulse,
  haberOlcumEksik,
  useHazir,
  useIstek,
  useListe,
  type Adim,
  type ApiResult,
  type Aralik,
  type GerceklikKaynak,
  type HaberMadde,
  type MakroYorum,
  type NabizSorguHaber,
  type SiraKayit,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Dugme,
  Durum,
  HaberOlcumEksikRozet,
  Katlanir,
  OlcemedimKutu,
  OlcumBaslik,
  OlcumEksikRozet,
  OlcumSatiri,
  Pill,
  ScreenShell,
  VeriYok,
} from '@/components';
import {
  AniHareketKart,
  DonemDegisimKarti,
  ENDEKS_NABIZ,
  EndeksNabziKarti,
  GostergeKart,
  GundemKonseptKarti,
  HisseHaberleriKarti,
  PiyasaGundemiKarti,
  SeritKart,
  TakipOlcumleriKarti,
  TakvimKart,
  type EndeksOlcum,
} from '@/components/bugun';
import { DuyarlilikOzeti, HaberSatiri } from '@/components/kesfet';
import { formatGunAySaat, formatOran, formatPercent, formatScore } from '@/lib/format';
import {
  GERCEKLIK_EKSIK_SOZLUK,
  GERCEKLIK_SOZLUK,
  MAKRO_ETIKET_SOZLUK,
  MAKRO_YORUM_EKSIK_SOZLUK,
  MAKRO_YORUM_EK_SOZLUK,
  MAKRO_YORUM_SOZLUK,
  sozluktenSec,
} from '@/lib/sozluk';
import { hisseAc } from '@/lib/gezinme';
import { radius, space, type, useTheme } from '@/theme';

/** Yakınlık durumu — SABİT KÜME (motor), yalnız Türkçeye çevriliyor. */
const DURUM_METIN: Record<string, string> = {
  in: 'alım bandının içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

/**
 * Nabız duruş kodu → Türkçe. ÇEVİRİ, HESAP DEĞİL: kararı uç verdi
 * (`durus.kod`), burada eşik yok. Kod yine EKRANDA (rozette) duruyor ki
 * çeviri kararın üstünü örtmesin; küme büyürse kod olduğu gibi basılır.
 */
const NABIZ_METIN: Record<string, string> = {
  hawk: 'şahin — sıkılaşma yönünde manşet baskısı',
  dove: 'güvercin — gevşeme yönünde manşet baskısı',
  neu: 'nötr — belirgin bir yön yok',
};

/** Konjonktür fazı → Türkçe. Yine yalnız çeviri. */
const FAZ_METIN: Record<string, string> = {
  early: 'erken döngü',
  mid: 'orta döngü',
  late: 'geç döngü',
  recession: 'daralma',
};

/**
 * Nabız sorgusu. SABİT ve GÖRÜNÜR: kart altyazısında yazılı.
 *
 * NEDEN BİR SORGU GEREKİYOR: uç, manşeti kendi taraması için `q` (ya da
 * `semboller`) istiyor; hiçbiri gelmezse sunucu yolunu AÇMIYOR ve 400
 * dönüyor (api/pulse.js). Uç makro sorgularını (faiz/enflasyon) kendi
 * listesinden tarıyor — `q` o taramayı açan anahtar ve ek olarak kendisi
 * için de manşet okuyor; o ek manşetler DURUŞA GİRMİYOR (uç başlığı) ve
 * kartta ayrı, açıkça öyle yazılarak gösteriliyor.
 */
const NABIZ_SORGU = 'Fed faiz';

/**
 * 📊 Endeks Nabzı penceresi. SABİT ve GÖRÜNÜR (kart satırında `range/
 * interval` olduğu gibi yazılıyor). "Günlük hareket" sorusunun karşılığı
 * bu pencere: günlük mum = o günün açılışı → kapanışı. Pencere seçimi
 * bir GÖSTERGE AYARI DEĞİL, ucun `range` parametresi.
 */
const ENDEKS_ARALIK: Aralik = '1d';
/**
 * ADIM `5m` — ÖLÇÜMLE SEÇİLDİ, zevkle değil (2026-11-03, Ş8 #1/#6).
 * `/api/chart` gün içi katmanını (`gunici`) YALNIZ `interval=5m` iken
 * döndürüyor (gerekçe api/chart.js:167 — motorun `analyzeIntraday`ı
 * içindeki `ago = hi - 12` satırı "~60 dk (12 x 5dk)" demek; başka
 * adımda `hourChg` 3 saat ya da 12 GÜN olurdu). `1d` kalsa `gunici`
 * HER ZAMAN `null` döner, yani kart gün değişimini ve nabzı motordan
 * HİÇ alamaz, kendi aritmetiğiyle yetinirdi.
 * BEDELİ ÖLÇÜLÜ: günlük tek mum yerine ~78 beş-dakikalık mum iniyor
 * (ABD seansı). İstek SAYISI değişmedi — endeks başına yine bir çağrı.
 */
const ENDEKS_ADIM: Adim = '5m';

/** Sıralı turun çıktısı — kartın `olcumler` + `turMs` props'ları. */
type EndeksTuru = { olcumler: EndeksOlcum[]; turMs: number };

export default function BugunScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();

  const cagri = useCallback(
    (signal: AbortSignal) => fetchCompare(liste, { vade: 'orta', signal }),
    [liste],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, liste.join(','), {
    // `hazir`: depo okuması bitmeden motora gitmeyiz (bkz. api/liste.ts).
    etkin: hazir && liste.length > 0,
  });

  const sira: SiraKayit[] = veri?.sira ?? [];

  return (
    <ScreenShell
      title="Bugün"
      subtitle="Takip listenin bugünkü sırası — sıralamayı motor yapar."
      note="Fazın öne çıkan sektörleri için ucun girdisi ölçülemiyor; uydurma kart konmadı.">
      {/* 📈 Fiyat şeridi EN ÜSTTE: webde de sayfa başında duruyor
          (`app.js:2517`) ve bu ekranın kararıyla (sıralama) ilgisi yok —
          SIRALAMA KURALI'nın "bugünün kararı" kalemini aşağı itmiyor,
          çünkü şerit bir karar değil, salt fiyat.
          Kartın KENDİ `fetch`i yok: ölçümü `seritFiyatlari()` derliyor
          (`src/api/serit.ts`) ve uç başına TEK çağrıya topluyor, bu
          yüzden bu ekranın mevcut istekleriyle yarışmıyor. */}
      <SeritKart />

      {/* Şeridin HEMEN ALTINDA: üstteki kartın "iğnelenmiş gösterge"
          kaydını yazan tek ekran. Ayrı SEKME açılmadı, 5'li menü
          değişmedi; kart şeridin yanında dursun ki kullanıcı neyi
          değiştirdiğini aynı ekranda görsün. Kendi `fetch`i YOK:
          yalnız cihaz deposuna yazıyor, fiyatı `SeritKart` ölçüyor. */}
      <GostergeKart />

      <Card
        title="Fiyata yakınlık sırası"
        subtitle="Anahtar: alım bandına uzaklık — tipik günlük salınımın katı (motor kararı)"
        right={
          durum === 'veri' && veri ? (
            <Pill label={veri.vade} tone="info" glyph={null} size="sm" />
          ) : null
        }>
        {/* NEDEN `kartsiz`: bu gövde zaten bir `Card` içinde; `Durum`un
            kendi kartını çizmesi iç içe iki kart kenarı demekti.
            NEDEN `sekil="sira"`: beklenen içerik numaralı sıra satırı,
            fiyat/değişim taşıyan liste satırı DEĞİL — iskelet gelecek
            şeklin aynısını taşımazsa içerik yerleşince düzen sıçrar. */}
        <Durum
          durum={durum}
          hata={hata}
          yenile={yenile}
          iskelet={Math.max(liste.length, 3)}
          sekil="sira"
          kartsiz
          bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
        />
        {durum === 'veri' && veri ? <OlcumEksikRozet kaynak={veri} /> : null}
        {durum === 'veri' ? (
          sira.length ? (
            <ScrollView style={styles.kaydir} nestedScrollEnabled>
              {sira.map((s) => (
                <Text
                  key={s.sym}
                  accessibilityRole="button"
                  // TASARIM TURU 2: tek gezinme kalıbı. `s.market` ZATEN
                  // UÇTAN geliyor (`SiraKayit.market`) ama burada
                  // düşüyordu; pazar düşen BIST sembolü hisse ekranında
                  // `.IS` ekini alamıyor ve ABD'de ölçülüyordu.
                  onPress={() => hisseAc(s.sym, s.market)}
                  style={[styles.sira, { color: colors.text, borderBottomColor: colors.border }]}>
                  <Text style={type.smallBold}>{s.sira + '. ' + s.sym}</Text>
                  <Text style={{ color: colors.textDim }}>
                    {'  ' + (DURUM_METIN[s.durum] ?? s.durum)}
                  </Text>
                  <Text style={{ color: colors.textFaint }}>
                    {'  · bütüncül ' + formatScore(s.skor10) + '/10'}
                  </Text>
                </Text>
              ))}
            </ScrollView>
          ) : (
            // ÖLÇÜLDÜ, SONUÇ YOK: hata değil veri cevabı — "yeniden dene"
            // düğmesi yok (aynı boş sıra gelir). Diğer ekranlarla aynı
            // kutu: ayrı bir metin yazmak beşinci bir anlatım olurdu.
            <VeriYok
              kartsiz
              metin="Sıralanabilir sembol yok (alım bandı ya da fiyat ölçülemedi)."
            />
          )
        ) : null}
        {durum === 'veri' && veri ? (
          <View style={styles.notlar}>
            {veri.siralanamayan.length ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Sıralanamayan: ' + veri.siralanamayan.join(', ') + ' (fiyat/band yok).'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      {/* 🧭 Takip ölçümleri: AYNI `veri` gövdesinin okunmayan alanları
          (`sonuclar`). İkinci bir istek YOK — kart props ile besleniyor.
          Sıralama yapılmıyor: uç `sonuclar`ı hangi sırada verdiyse o
          sırada basılıyor, sıralama kararı `sira` dizisinde (üstteki
          kartta) duruyor. */}
      <TakipOlcumleriKarti
        sonuclar={veri?.sonuclar ?? []}
        durum={durum}
        hata={hata}
        yenile={yenile}
        vade={veri?.vade ?? null}
      />

      <EndeksNabziBolumu />

      <MakroNabizKarti />

      {/* 📰 Gündem manşetleri: sembole bağlı DEĞİL — Keşfet'teki gündem
          kartı sembol başına çalışıyor, bu uç (`gundem=1`) sembolsüz.
          Kaynak başına ölçümü kendi içinde yazıyor. */}
      <PiyasaGundemiKarti />

      {/* 🧠 Gündem KONSEPTLERİ (`/api/gundem`): AYNI yayıncı
          beslemelerinden motorun çıkardığı ölçüm. MANŞET kartının HEMEN
          ARDINDA duruyor çünkü aynı havuzu okuyor; ama AYRI kart, çünkü
          ayrı uç ve ayrı düşüyor — manşet geldiğinde konseptin de
          ölçüldüğü varsayılmasın. */}
      <GundemKonseptKarti />

      {/* 🗓️ Takvim: web'in `calendar` sekmesinin karşılığı. MEVCUT
          KARTLARIN ARDINA eklendi — sıralama "sembolden bağımsız ölçümler
          önce" kuralını bozmuyor ve iki dış kaynak (KAP akışı + temettü
          sayfası) okuduğu için turun en pahalısı en sonda. Kapsam çipi
          kartın İÇİNDE: sekme açmak 5'li menüyü değiştirmek olurdu. */}
      <TakvimKart />

      {/* 📏 Çok dönemli değişim (`/api/degisim`): native'de BUGÜNE
          KADAR HİÇ çağrılmamış uç. Endeks nabzının ARDINDA duruyor
          çünkü AYNI dört sembolü okuyor; ama AYRI kart, çünkü ayrı uç
          ve ayrı düşüyor — nabız geldiğinde zaman ekseninin de
          ölçüldüğü varsayılmasın. Evren SABİT ve altyazıda yazılı;
          takip listesi bu uca GÖNDERİLMİYOR. */}
      <DonemDegisimKarti onSembol={hisseAc} />

      {/* ⚡ Ani hareket (`/api/hareket`): takip listesinin GÜN İÇİ mum
          ölçümü. Evreni SABİT olan kartlardan SONRA duruyor çünkü takip
          listesine BAĞLI; liste boşsa kart bunu söylüyor. Ucün tavanı
          12 sembol — daha uzun listede kaç sembolün DIŞARIDA kaldığı
          kartın içinde yazılı. Eşik/hesap BURADA YOK: yüzdeler ve hacim
          oranı uçtan geldiği gibi basılıyor. */}
      <AniHareketKart onSembol={hisseAc} />

      {/* 📰 Hisse haberleri (`/api/news` kip ②): takip listesindeki her
          sembol icin AYRI besleme, SATIR BASINA sayac. Evreni SABIT olan
          kartlarin ARDINDA duruyor cunku takip listesine BAGLI; liste
          bossa kart bunu soyluyor. KAP duyurusu BU KARTTA YOK — o
          🗓️ Takvim'de, ayri bir olcum olarak duruyor. */}
      <HisseHaberleriKarti />

      {/* TASARIM TURU 2 — NEDEN AŞAĞI İNDİ (eskiden Makro Nabız'ın hemen
          altındaydı): bu kart bir ÖLÇÜM değil, kullanıcının yazdığı tema
          ile çalışan bir KEŞİF aracı; boş kutusu ekranın ortasında
          ölçülmüş kartların akranı gibi duruyordu. Sıralama kuralı
          (dosya başlığı) ölçülmüş karar/künyeyi önce, girdi bekleyen
          keşif yüzeyini sonra diyor. Kart SİLİNMEDİ; `?tema=` köprüsü
          (arama.tsx ↔ bugun.tsx) ve kartın kendi davranışı DEĞİŞMEDİ. */}
      <TematikHaberKarti />

      {/* TASARIM TURU 2 — NEDEN `Katlanir` VE EN ALTTA: metin SİLİNMEDİ
          (dürüstlük içeriği, kalması gerekiyor) ama `Card` olarak
          ölçülmüş kartların AKRANIYDI: aynı kenar, aynı ağırlık, aynı
          sıra. Oysa burada ölçüm yok, ölçülmeyenin ilanı var. Varsayılan
          KAPALI; arayan açar, aramayan ölçümlerin arasında onu okumak
          zorunda kalmaz. Metin AYNEN korundu. */}
      <Katlanir baslik="Henüz ölçülmeyen kartlar" ozet="Dürüst eksik listesi">
        <Text style={[type.small, { color: colors.textDim }]}>
          {'Sektör değerleme ucu VAR (`/api/sektor`, proxy üzerinden) ama girdisini kuran ' +
            'yüzey Keşfet sekmesinde duruyor; aynı kartı burada ikinci kez açmak sembol ' +
            'başına ikinci bir dış tur demekti, o yüzden kopyalanmadı. Fazın öne çıkan ' +
            'sektörlerinin ucu da var, girdisi yok: ⚡ Makro Nabız kartı ucun hangi girdiyi ' +
            'beklediğini olduğu gibi yazıyor. Yer tutucu sayı GÖSTERİLMİYOR.'}
        </Text>
      </Katlanir>
    </ScreenShell>
  );
}

/**
 * 📊 ENDEKS NABZI — `/api/chart`, endeks başına BİR çağrı, SIRAYLA.
 *
 * NEDEN TEK `useIstek` İÇİNDE DÖRT ÇAĞRI DEĞİL DE DÖRT `useIstek`
 * DEĞİL: kart tek bir `durum` alıyor ve turun ÖLÇÜLEN süresini yazıyor;
 * dört kanca dört ayrı durum demekti ve "tur süresi" diye yazılacak bir
 * şey kalmazdı. Tur burada tek bir ölçüm: başı ve sonu var.
 *
 * NEDEN SIRAYLA (`for` döngüsü, `Promise.all` DEĞİL): uç tek sembol
 * alıyor (`cok_sembol`, azami 1) ve dördünü aynı anda atmak, ilk
 * açılışta dört dış kaynak isteği demekti.
 *
 * DESTEKLENMEYEN KALEME İSTEK ATILMIYOR: karar `destekli` bayrağında
 * (TEK yer, ekran başlığındaki ölçüm notu). O kalem için `{veri:null,
 * hata:null}` ölçümü basılıyor — kartın sözleşmesinde bu hâl "hiç
 * sorulmadı" demek ve "ölçtüm, boş geldi"den AYRI yazılıyor.
 *
 * BURADA HESAP YOK: ekran tek bir sayı türetmiyor. Yüzde değişimi kartın
 * kendisi künye aritmetiğiyle yazıyor (serinin iki ucu); eşik, ağırlık,
 * rozet kararı hiçbir yerde yok. `turMs` bir ÖLÇÜM (duvar saati farkı),
 * gösterge değil.
 *
 * İPTAL HATA DEĞİL: tur ortasında ekran kapanırsa `canceled` olduğu gibi
 * geri veriliyor; `useIstek` onu durum bozmadan yutuyor (istek.ts).
 * Yarım bir turu "ölçüm" diye kartta basmak eksik ölçümü tam ölçüm gibi
 * sunmak olurdu.
 */
function EndeksNabziBolumu() {
  const cagri = useCallback(async (signal: AbortSignal): Promise<ApiResult<EndeksTuru>> => {
    const basladi = Date.now();
    const olcumler: EndeksOlcum[] = [];

    for (const tanim of ENDEKS_NABIZ) {
      if (!tanim.destekli) {
        // AĞA GİTMİYORUZ: sembol biçimi ucun kapısından geçmiyor.
        olcumler.push({ key: tanim.key, veri: null, hata: null });
        continue;
      }
      const sonuc = await fetchChart(tanim.sembol, {
        range: ENDEKS_ARALIK,
        interval: ENDEKS_ADIM,
        market: tanim.pazar,
        signal,
      });
      if (sonuc.ok) {
        olcumler.push({ key: tanim.key, veri: sonuc.data, hata: null });
        continue;
      }
      if (sonuc.error.kind === 'canceled') return { ok: false, error: sonuc.error };
      // Bir endeksin düşmesi turu bitirmiyor: kalanı ölçülüp o satır
      // kendi hatasını yazıyor.
      olcumler.push({ key: tanim.key, veri: null, hata: sonuc.error });
    }

    return { ok: true, data: { olcumler, turMs: Date.now() - basladi } };
  }, []);

  // Anahtar ADIMI DA taşıyor: pencere değişince eski gövde (gün içi
  // katmanı olmayan `1d` cevabı) yeniden kullanılmasın.
  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    'endeks-nabiz:' + ENDEKS_ARALIK + '/' + ENDEKS_ADIM,
  );

  return (
    <EndeksNabziKarti
      olcumler={veri?.olcumler ?? []}
      durum={durum}
      hata={hata}
      yenile={yenile}
      turMs={veri?.turMs ?? null}
    />
  );
}

/**
 * ⚡ MAKRO NABIZ — `/api/pulse`.
 *
 * NEDEN AYRI İSTEK: kıyas turundan (compare) bağımsız. Manşet taraması
 * tek sembol silindiğinde yeniden çalışmasın, kıyas da besleme yavaş
 * olduğunda beklemesin diye kendi `useIstek`i var (Keşfet'teki Gündem
 * kartıyla aynı desen).
 *
 * NEDEN MANŞET GÖNDERMİYORUZ / NEDEN POST: `fetchPulse` başlığı.
 *
 * BURADA HESAP YOK: duruş kodu, yönler, baskı, faz, sektör kodları ve
 * manşet sayıları UÇTAN geliyor. İstemci yalnız sabit kümeden Türkçe
 * karşılık seçiyor ve sayıyı `formatOran` ile biçimliyor.
 *
 * `tam:false` VERİYİ GİZLEMEZ: rozet sayıların ÜSTÜNDE durur, duruş
 * yine çizilir — eksik manşetle hesaplanmış da olsa ÖLÇÜLMÜŞ bir cevap.
 */
/**
 * ⚠️ FİYAT YALANLAMA kaynağı → ekran satırı. BURADA KARAR YOK:
 * hangi kaynağın çelişki sayıldığına UÇ (motor) karar verdi; bu
 * işlev yalnız kodun Türkçesini seçip HAM sayıyı yanına koyuyor.
 * Sözlükte olmayan kod İÇİN CÜMLE UYDURULMAZ — makine kodu basılır.
 */
function gerceklikSatiri(k: GerceklikKaynak): string {
  const cumle = sozluktenSec(GERCEKLIK_SOZLUK, k.kod) ?? 'motor kodu: ' + k.kod;
  // Hangi sayı geldiyse O basılır; gelmeyen için yer tutucu sayı
  // KONULMAZ (`0` basmak "ölçtüm, sıfır çıktı" demek olurdu).
  const ek: string[] = [];
  if (typeof k.genislik === 'number') ek.push('ortalama teknik skor ' + formatScore(k.genislik));
  if (typeof k.adet === 'number' && typeof k.n === 'number') ek.push(k.adet + '/' + k.n + ' sembol');
  if (typeof k.ort === 'number') ek.push('ortalama ' + formatPercent(k.ort));
  return ek.length ? cumle + ' (' + ek.join(' · ') + ')' : cumle;
}

/**
 * ⚠️ MAKRO YORUM → ekran cümlesi. BURADA KARAR YOK: yönü,
 * tazeliği ve enflasyon eşiğini UÇ (motor) belirledi; bu işlev
 * yalnız sabit kümeden Türkçe parçaları seçip birleştiriyor.
 * Sözlükte olmayan kod İÇİN CÜMLE UYDURULMAZ — makine kodu basılır.
 */
function makroYorumCumlesi(y: MakroYorum): string {
  const ana = sozluktenSec(MAKRO_YORUM_SOZLUK, y.kod) ?? 'motor kodu: ' + y.kod;
  // 'sakin' = manşet YOK: tazelik/enflasyon yan cümlesi EKLENMEZ,
  // çünkü okunacak manşet olmadı.
  if (y.kod === 'sakin') return ana;
  const ek: string[] = [];
  const tazeKod = y.taze ? 'taze' : 'bayat';
  const tazeC = sozluktenSec(MAKRO_YORUM_EK_SOZLUK, tazeKod);
  if (tazeC) ek.push(tazeC);
  if (y.inflIsinma) {
    const c = sozluktenSec(MAKRO_YORUM_EK_SOZLUK, 'inflIsinma');
    if (c) ek.push(c);
  }
  if (y.inflSoguma) {
    const c = sozluktenSec(MAKRO_YORUM_EK_SOZLUK, 'inflSoguma');
    if (c) ek.push(c);
  }
  return ek.length ? ana + ' (' + ek.join(' · ') + ')' : ana;
}

function MakroNabizKarti() {
  const { colors } = useTheme();

  const cagri = useCallback((signal: AbortSignal) => fetchPulse(NABIZ_SORGU, { signal }), []);
  const { durum, veri, hata, yenile } = useIstek(cagri, 'nabiz:' + NABIZ_SORGU);

  const sorgular: NabizSorguHaber[] = veri?.haberler?.sorgu ?? [];

  return (
    <Card
      title="⚡ Makro Nabız"
      subtitle={'Faiz · enflasyon manşet duruşu · sorgu: “' + NABIZ_SORGU + '” · motor kararı'}
      right={
        durum === 'veri' && veri ? (
          // `kaynak` DÜRÜSTÇE GÖRÜNÜR: manşeti kim topladı. Bu istemci
          // RSS tarayamadığı için 'sunucu' bekleniyor, ama yazan değer
          // cevaptan okunuyor — varsayılmıyor.
          <Pill label={'kaynak: ' + veri.kaynak} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Nabız ölçümü istenmedi."
      />

      {/* Rozet VERİNİN ÜSTÜNDE: eksik ölçümü sayıları okuduktan SONRA
          öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu.
          Haber sayacı şekli skor sayacından farklı — ayrı rozet. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri.haberler} /> : null}

      {durum === 'veri' && veri ? (
        <View style={styles.nabiz}>
          <View style={styles.ust}>
            {/* Makine kodu da ekranda: çeviri kararın üstünü örtmesin. */}
            <Pill label={veri.durus.kod} tone="info" glyph={null} size="sm" />
            <Text style={[type.small, { color: colors.text, flex: 1 }]}>
              {NABIZ_METIN[veri.durus.kod] ?? 'motor kodu: ' + veri.durus.kod}
            </Text>
          </View>

          {/* HAM SAYILAR: -1..+1 arası motor çıktısı, yüzdeye
              ÇEVRİLMİYOR (uç başlığı: HAM SAYI kuralı).
              TASARIM: üç ham sayı tek micro satırda yan yanaydı; birim
              notu ("-1..+1, yüzde değil") hiç yazılmıyordu. Artık birim
              BÖLÜM BAŞLIĞINDA bir kez duruyor, sayılar sağa dayalı ve
              ölçülmüş değer birincil. Sayı ve çağrı AYNEN aynı. */}
          <OlcumBaslik baslik="Duruş ham sayıları" birim="-1..+1 motor çıktısı, yüzde DEĞİL" />
          <OlcumSatiri etiket="Faiz yönü" deger={formatOran(veri.durus.faizYon)} />
          <OlcumSatiri etiket="Enflasyon yönü" deger={formatOran(veri.durus.enflasyonYon)} />
          <OlcumSatiri etiket="Baskı" deger={formatOran(veri.durus.baski)} />

          {/* TASARIM: aşağıdaki üç satır ÖLÇÜM KÜNYESİ (hangi manşet
              duruşa girdi, hangi sektör kodları eğilimli). Her ekran
              açılışında üç uzun micro satır olarak duruyordu; artık
              VARSAYILAN KAPALI, özet satırı görünür, kullanıcı açar.
              Metinler ve sayılar AYNEN korundu. */}
          <Katlanir
            baslik="Duruş ölçüm künyesi"
            ozet="duruşa giren manşet · son 2 gün · eğilimli sektör kodları">
            {/* `degerlendirilen` NESNE: {faiz, enflasyon}. Tek sayı sanıp
                basmak ekrana "[object Object]" yazdırırdı. */}
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Duruşa giren taze manşet — faiz ' +
                veri.degerlendirilen.faiz +
                ' · enflasyon ' +
                veri.degerlendirilen.enflasyon +
                '   (son 2 gün: faiz ' +
                veri.taze.faiz2g +
                ' · enflasyon ' +
                veri.taze.enflasyon2g +
                ')'}
            </Text>

            {/* Eğilim listeleri MAKİNE SEKTÖR KODLARI (motor), Türkçe
                etiket tele çıkmıyor — olduğu gibi basılıyor. */}
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Duruşla yukarı eğilimli sektör kodları: ' +
                (veri.durus.egilimYukari.join(', ') || 'yok')}
            </Text>
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Duruşla aşağı eğilimli sektör kodları: ' +
                (veri.durus.egilimAsagi.join(', ') || 'yok')}
            </Text>
          </Katlanir>

          {veri.konjonktur ? (
            <>
              <View style={styles.ust}>
                <Pill label={veri.konjonktur.faz} tone="info" glyph={null} size="sm" />
                <Text style={[type.small, { color: colors.text, flex: 1 }]}>
                  {FAZ_METIN[veri.konjonktur.faz] ?? 'motor kodu: ' + veri.konjonktur.faz}
                </Text>
              </View>
              {/* TASARIM: dört boyut tek satırda ezberlenemez biçimde
                  yan yanaydı. Birim bölüm başlığına taşındı, sayılar
                  sağa dayalı satırlara ayrıldı; `formatOran` çağrıları
                  ve sıraları AYNEN aynı. */}
              <OlcumBaslik baslik="Konjonktür boyutları" birim="-1..+1 motor çıktısı" />
              <OlcumSatiri etiket="Faiz" deger={formatOran(veri.konjonktur.boyutlar.rate)} />
              <OlcumSatiri etiket="Enflasyon" deger={formatOran(veri.konjonktur.boyutlar.infl)} />
              <OlcumSatiri etiket="Büyüme" deger={formatOran(veri.konjonktur.boyutlar.growth)} />
              <OlcumSatiri etiket="Risk" deger={formatOran(veri.konjonktur.boyutlar.risk)} />
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Fazın sektör kodları: ' + (veri.konjonktur.sektorler.join(', ') || 'yok')}
              </Text>
            </>
          ) : (
            // ÖLÇÜLMEDİ, ARIZA DEĞİL: ucun beklediği girdiyi UÇ söylüyor
            // (`eksik`), biz bir liste uydurmuyoruz.
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Konjonktür fazı ÖLÇÜLMEDİ — uç şu girdileri bekliyor: ' +
                (veri.eksik.join(', ') || 'bildirilmedi') +
                '. Bu uygulamada bu girdileri ölçen bir kaynak yok; uydurma sayı gönderilmiyor.'}
            </Text>
          )}

          {/* ⚠️ FİYAT YALANLAMA — duruş ile fiyat çelişiyor mu?
              DÖRT HALİN HEPSİ AYRI ÇİZİLİYOR, hiçbiri diğerinin yerine
              geçmiyor:
                · çelişki VAR            → uyarı + kaynak satırları
                · `want === null`        → duruş nötr, yön İDDİASI YOK
                · `eksikGerceklik` dolu  → ÖLÇEMEDİM (onay SAYILMAZ)
                · hepsi ölçüldü, çelişki yok → fiyat yönü yalanlamadı
              EŞİK KARŞILAŞTIRMASI BURADA YOK: `celiski` dizisini motor
              doldurdu, ekran yalnız çiziyor.
              NEDEN `OlcemedimKutu` DEĞİL: çelişki bir ÖLÇÜM SONUCU,
              ölçüm arızası değil — "ölçemedim" rozeti yanlış olurdu. */}
          {veri.gerceklik.celiski.length ? (
            <>
              <View style={styles.ust}>
                <Pill label="yön teyit edilmedi" tone="gold" glyph={null} size="sm" />
                <Text style={[type.small, { color: colors.text, flex: 1 }]}>
                  {'Duruş haber METNİNDEN geliyor; ölçülen fiyat onu onaylamadı.'}
                </Text>
              </View>
              {veri.gerceklik.celiski.map((k) => (
                <Text key={k.kod} style={[type.micro, { color: colors.textDim }]}>
                  {'· ' + gerceklikSatiri(k)}
                </Text>
              ))}
            </>
          ) : veri.gerceklik.want === null ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Duruş nötr — yalanlanacak bir fiyat yönü iddiası yok.'}
            </Text>
          ) : veri.eksikGerceklik.length ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Fiyat gerçekliği ÖLÇÜLMEDİ — ' +
                veri.eksikGerceklik
                  .map((k) => sozluktenSec(GERCEKLIK_EKSIK_SOZLUK, k) ?? 'uç kodu: ' + k)
                  .join(' · ') +
                '. Bu, fiyatın duruşu onayladığı anlamına GELMEZ.'}
            </Text>
          ) : (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Ölçülen fiyat kaynakları duruşun yönüyle çelişmedi.'}
            </Text>
          )}

          {/* ⚠️ MAKRO YORUM — manşetlerden OKUNAN yönün cümlesi.
              İKİ HAL AYRI: `varMi === false` → pencerede manşet YOK
              ('sakin'); aksi hâlde yön kodu (hawk/dove/notr).
              'notr' ile 'sakin' BİRLEŞTİRİLMİYOR: biri "manşet yok",
              öteki "manşet var, yön dengede".
              EŞİK BURADA YOK: `inflIsinma`/`inflSoguma` uctan gelen
              boolean; eşiğin SAYISI ekrana HİÇ gelmiyor. */}
          <View style={styles.ust}>
            <Pill
              label={'yorum: ' + veri.yorum.kod}
              tone={veri.yorum.kod === 'hawk' ? 'negative' : veri.yorum.kod === 'dove' ? 'positive' : 'neutral'}
              glyph={null}
              size="sm"
            />
            <Text style={[type.small, { color: colors.text, flex: 1 }]}>
              {makroYorumCumlesi(veri.yorum)}
            </Text>
          </View>

          {/* Manşet KÜNYESİ: taze sayısı ve en yeni manşetin zamanı
              HAM uctan. `sonManset` null ise TARİH BASILMAZ — "şimdi"
              yazmak uydurma olurdu. */}
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {veri.varMi
              ? 'Son 2 günde okunan makro manşet: ' +
                veri.taze2g +
                (veri.sonManset != null ? ' · en yenisi: ' + formatGunAySaat(veri.sonManset) : ' · en yeni manşetin tarihi okunamadı')
              : 'Pencerede makro manşet okunmadı — yön İDDİASI YOK.'}
          </Text>

          {/* DURUŞLA UYUMLU SEMBOLLER — ÜÇ HAL AYRI:
                · `etiketler === null` → satır gönderilmedi, ÖLÇÜLMEDİ
                · `etiketler === []`   → ölçüldü, etiket çıkmadı
                · dolu                 → sembol + makine kodunun Türkçesi
              `uyumlu` BOŞLUĞU da aynı kapıdan geçiyor: `eksikYorum`
              doluysa "uyumlu sembol yok" DEMİYORUZ. */}
          {veri.etiketler === null ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Duruşla uyumlu sembol ÖLÇÜLMEDİ — ' +
                (veri.eksikYorum
                  .map((k) => sozluktenSec(MAKRO_YORUM_EKSIK_SOZLUK, k) ?? 'uç kodu: ' + k)
                  .join(' · ') || 'uç girdiyi bildirmedi') +
                '. Bu, uyumlu sembol OLMADIĞI anlamına gelmez.'}
            </Text>
          ) : veri.etiketler.length ? (
            <>
              {veri.yorum.uyumlu.length ? (
                <Text style={[type.micro, { color: colors.textDim }]}>
                  {'Duruşun yönüyle uyumlu semboller: ' + veri.yorum.uyumlu.join(', ')}
                </Text>
              ) : null}
              {veri.etiketler.map((e) => (
                <Text key={e.sembol + ':' + e.kod} style={[type.micro, { color: colors.textDim }]}>
                  {'· ' + e.sembol + ' — ' + (sozluktenSec(MAKRO_ETIKET_SOZLUK, e.kod) ?? 'motor kodu: ' + e.kod)}
                </Text>
              ))}
            </>
          ) : (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Ölçülen ani-hareket satırlarının hiçbiri makro etiket almadı.'}
            </Text>
          )}

          {/* 🗞️ MAKRO MANŞETLERİN KENDİSİ — duruşu okuduğu beslemelerden.
              Webde bu blok kartın GÖVDESİ: kullanıcı "şahin" yorumunun
              NEYE dayandığını başlığı okuyarak görüyor. Satır
              bileşeni 📰 kartlarıyla AYNI (`HaberSatiri`); YENİ AĞ TURU
              YOK, başlıklar aynı nabız cevabının içinde geldi.
              SIRALAMA VE KIRPMA UÇTA: burada tekrar sıralanmıyor.
              ÜÇ DAL: `undefined` (alanı göndermeyen eski uç) → HİÇBİR
              ŞEY ÇİZİLMİYOR · `[]` → "ölçtüm, gösterilebilir manşet
              yok" · dolu → manşetler. */}
          {veri.mansetler === undefined ? null : veri.mansetler.length ? (
            <View style={styles.haberler}>
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Duruşun okunduğu makro manşetler (en yeni ' +
                  veri.mansetler.length +
                  ')'}
              </Text>
              {veri.mansetler.map((m, i) => (
                <HaberSatiri key={(m.link || '') + '#makro' + i} madde={m} />
              ))}
            </View>
          ) : (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Gösterilebilir makro manşet yok — pencerede okunan ' +
                'manşetlerin bağlantısı gelmedi. Duruş sayilari yine ' +
                'yukarıdaki manşetlerden hesaplandı.'}
            </Text>
          )}

          {/* TASARIM: aşağıdaki iki blok MANŞET SAYACI KÜNYESİ — hangi
              sorgu kaç manşet döndürdü, uç pencerede kaç makro manşet
              taradı. Her ikisi de uzun micro satır; ekranın ana bilgisi
              değil. VARSAYILAN KAPALI; üç render dalı (sorgu yok /
              `haberler` null / sayılar) içeride AYNEN duruyor. */}
          <Katlanir
            baslik="Manşet sayaç künyesi"
            ozet="sorgu başına okunan manşet · ucun taradığı makro manşet">
            {/* Çağıranın `q` sorgusu için okunan manşetler: DURUŞ
                MATEMATİĞİNE GİRMİYOR (uç başlığı). Sayı UÇTAN (`adet`);
                burada yeniden sayılmıyor. */}
            {sorgular.length ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Sorgu için okunan ek manşet (duruşa girmiyor): ' +
                  sorgular.map((q) => q.sorgu + ' · ' + q.market + ' · ' + q.adet).join('   |   ')}
              </Text>
            ) : null}

            {/* UCUN KENDİ TARADIĞI MAKRO MANŞET SAYISI — `haberler.faiz` /
                `haberler.enflasyon`: PENCEREDE okunan manşet. Hemen
                yukarıdaki `degerlendirilen` ise bunların DURUŞA GİREN
                taze kısmı. İki ayrı alan, iki ayrı satır: aradaki fark
                BURADA ÇIKARILMIYOR (çıkarma istemcide hesap olurdu),
                iki ham sayı uçtan geldiği gibi basılıyor.
                ÜÇÜNCÜ DAL AYRI: `haberler` gövdede `null` gelebilir
                (api/pulse.js) — o zaman sayı YOK, 0 YAZILMIYOR. */}
            {veri.haberler ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'Ucun taradığı makro manşet — faiz ' +
                  veri.haberler.faiz +
                  ' · enflasyon ' +
                  veri.haberler.enflasyon}
              </Text>
            ) : (
              <Text style={[type.micro, { color: colors.textDim }]}>
                {'Manşet dökümü gövdede YOK (haberler: null) — uç tarama ' +
                  'ayrıntısı göndermedi. Sayı UYDURULMUYOR.'}
              </Text>
            )}
          </Katlanir>

          {/* MANŞETİN KENDİSİ DE EKRANDA: uç `maddeler`i tam olarak
              istemci basabilsin diye döndürüyor; yalnız `adet` basmak
              kullanıcıyı çıplak bir sayıyla baş başa bırakıyordu. Satır
              bileşeni 📰 kartlarıyla AYNI (`HaberSatiri`). YENİ AĞ TURU
              AÇILMADI: bu başlıklar aynı nabız cevabının içinde geldi. */}
          {sorgular.map((q) =>
            q.maddeler.length ? (
              <View key={'nabiz-maddeler:' + q.sorgu + '|' + q.market} style={styles.haberler}>
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'“' + q.sorgu + '” · ' + q.market + ' · uç ' + q.adet + ' manşet döndü'}
                </Text>
                {q.maddeler.map((m, i) => (
                  <HaberSatiri key={(m.link || '') + '#' + i} madde={m} />
                ))}
              </View>
            ) : null,
          )}

          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Pencere: ' +
              veri.pencere.gun +
              ' gün · tazelik ' +
              veri.pencere.tazelikSaat +
              ' sa (ağırlık ' +
              formatOran(veri.pencere.tazelikAgirlik) +
              ') · motor ' +
              veri.surum.motor +
              ' · ayar ' +
              veri.surum.ayar +
              ' · ' +
              veri.ms +
              ' ms'}
          </Text>
        </View>
      ) : null}

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

/**
 * 🔭 TEMATİK HABER BAŞLIĞI ARAMA — `/api/news`.
 *
 * NE: tema yazılır, uç o temayla manşet tarar; satırlar olduğu gibi
 * basılır. Alt düğme AYNI temayı 🔎 Arama ekranındaki 🔭 tematik keşifte
 * açar (iki yüzey köprüsü: `/arama` + `tema` parametresi).
 *
 * NEDEN AYRI İSTEK (kıyas/nabız turundan bağımsız): kullanıcı tema
 * yazdıkça kıyas sırası ya da nabız yeniden çekilmesin; tersi de geçerli
 * (⚡ Makro Nabız kartıyla aynı gerekçe).
 *
 * NEDEN HİSSE EŞLEŞTİRMESİ YOK: ÖLÇÜLDÜ 2026-10-25 — `/api/theme`
 * cevabı yalnız `{symbol, market, name, reason}` taşıyor, `/api/news`
 * cevabı da yalnız manşet maddeleri; HİÇBİRİ "bu manşet şu hisseyi
 * destekliyor" ilişkisini VERMİYOR. Bu ilişkiyi burada başlık metninde
 * sembol/şirket adı arayarak kurmak İSTEMCİDE HESAP olurdu (native
 * tarafta yasak) — o yüzden bu ekran yalnız başlıkları basıyor, eşleşme
 * iddiası etmiyor ve bunu kart altında AÇIKÇA yazıyor. Eşleşmeyi uç
 * verirse (öneri raporda) burada gösterilir.
 *
 * BURADA HESAP YOK: manşet sayısı (`adet`), sayaçlar ve tarihler uçtan;
 * tarih biçimlemesi `lib/format.ts`e ait.
 */
function TematikHaberKarti() {
  const { colors } = useTheme();

  // Gelen `tema` parametresi: 🔎 Arama ekranındaki 🔭 tematik keşiften
  // bu ekrana köprü kurulduğunda alan ONUNLA DOLUYOR ve arama kendi
  // kendine koşuyor — kullanıcı aynı temayı iki kez yazmasın.
  const params = useLocalSearchParams<{ tema?: string }>();
  const gelenTema = (params.tema ?? '').trim().slice(0, AZAMI_HABER_SORGU);

  const [metin, setMetin] = useState(gelenTema);
  const [sorgu, setSorgu] = useState(gelenTema);
  // Parametre DEĞİŞTİĞİNDE (aynı ekran açıkken yeni tema geldiğinde)
  // alanı yenilemek için son görülen değeri tutuyoruz. `useEffect`
  // yerine bu: efektle yazmak bir kare eski metni gösterirdi.
  const [sonGelen, setSonGelen] = useState(gelenTema);
  if (gelenTema && gelenTema !== sonGelen) {
    setSonGelen(gelenTema);
    setMetin(gelenTema);
    setSorgu(gelenTema);
  }

  const cagri = useCallback(
    (signal: AbortSignal) => fetchNews(sorgu, { market: 'TR', signal }),
    [sorgu],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'tema-haber:' + sorgu, {
    etkin: sorgu.length > 0,
  });

  const maddeler: HaberMadde[] = veri?.maddeler ?? [];
  const eksik = haberOlcumEksik(veri ?? null);

  return (
    <Card
      title="🔭 Tematik haber başlığı ara"
      subtitle="Tema yaz, manşetleri gör — ilişkili hisseler için 🔎 Arama'daki tematik keşif">
      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder="Tema: ör. savunma sanayi, veri merkezi, nükleer enerji"
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        maxLength={AZAMI_HABER_SORGU}
        returnKeyType="search"
        onSubmitEditing={() => setSorgu(metin.trim())}
        accessibilityLabel="Tematik haber başlığı arama alanı"
        style={[
          styles.alan,
          type.body,
          { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
        ]}
      />
      <View style={styles.dugmeler}>
        <Dugme label="Başlık ara" onPress={() => setSorgu(metin.trim())} disabled={!metin.trim()} />
        <Dugme
          label="🔭 Tematik keşifte aç"
          variant="outline"
          tone="info"
          // AYNI TEMA, AYNI PARAMETRE: Arama ekranı `tema`yı okuyup
          // 🔭 keşfi (`/api/theme`) o temayla koşturuyor.
          onPress={() => router.navigate({ pathname: '/arama', params: { tema: metin.trim() } })}
          disabled={!metin.trim()}
        />
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Bir tema yaz ve 'Başlık ara'ya bas."
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri ? (
        eksik ? (
          // ÖLÇEMEDİM ≠ "haber yok": ucun kendi bildirdiği eksik.
          <OlcemedimKutu
            metin={
              'Manşet taraması TAMAMLANMADI — ' +
              (veri.uyari ?? 'uç tam tarama bildirmedi') +
              '. Aşağıdaki başlıklar gelenlerin tamamı değil.'
            }
            yenile={yenile}
          />
        ) : null
      ) : null}

      {/* DUYARLILIK ÖZETİ — ucun `duyarlilik` katmanı (api/news.js).
          Alan HİÇ gelmediyse bileşen hiçbir şey basmıyor; `null` ise
          "ölçemedim" der. Manşetler bu ölçüme BAĞLI DEĞİL. */}
      {durum === 'veri' && !eksik ? <DuyarlilikOzeti duyarlilik={veri?.duyarlilik} /> : null}

      {durum === 'veri' && veri && veri.adet === 0 && !eksik ? (
        <VeriYok metin={'“' + sorgu + '” için uç manşet bulamadı — bu da ÖLÇÜLMÜŞ bir cevap.'} />
      ) : null}

      {durum === 'veri' && maddeler.length ? (
        <View style={styles.haberler}>
          {maddeler.map((m, i) => (
            <HaberSatiri key={(m.link || '') + '#' + i} madde={m} />
          ))}
        </View>
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          {'Uç ' + veri.adet + ' manşet döndü · sorgu “' + veri.q + '” · ' + veri.market +
            ' · ' + veri.ms + ' ms'}
        </Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
        {'Bu liste TEMANIN manşetleri — hangi manşetin hangi hisseyi desteklediği UÇTAN ' +
          'GELMİYOR, o yüzden burada hisse eşleştirmesi iddia edilmiyor. Temayla ilişkili ' +
          'hisseler için “🔭 Tematik keşifte aç”a bas.'}
      </Text>

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  kaydir: { maxHeight: 320 },
  nabiz: { gap: space.xs, paddingTop: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xs },
  sira: {
    ...type.small,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notlar: { gap: space.xs, marginTop: space.sm },
  // 🔭 tematik haber kartı — SALT SUNUM ölçüleri (Arama ekranındaki
  // arama alanıyla aynı: aynı iş aynı görünsün).
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
  },
  dugmeler: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', paddingTop: space.sm },
  haberler: { paddingTop: space.xs },
});
