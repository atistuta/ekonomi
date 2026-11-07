// =====================================================================
//  🗓️ TAKVİM — KAP duyuruları + BIST temettü            (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `GET /api/takvim?kapsam=hepsi|kap|temettu` — iki ayrı kaynak tek
//  gövdede: KAP duyuru akışı (Mynet Finans) ve BIST temettü takvimi
//  (temettuhisseleri.com). Web'de bu `calendar` sekmesiydi.
//
//  NEDEN BU KART AÇILDI (ÖLÇÜLDÜ 2026-10-29): uç ÜRETİMDE CANLIYDI ama
//  `mobile/` içinde onu çağıran hiçbir şey yoktu (`grep -rn
//  "api/takvim" mobile/` → 0 eşleşme). Web'in sekmelerinden native'de
//  karşılığı olmayan TEK kalem buydu; ölçülmüş veri çöpe gidiyordu.
//
//  NEDEN BUGÜN SEKMESİNDE, YENİ SEKMEDE DEĞİL: 5'li alt menü (Listeler ·
//  Bugün · Keşfet · Analiz · Arama) DEĞİŞMEDİ — `_layout.tsx` AÇILMADI.
//  Takvim sembole bağlı DEĞİL (KAP akışı tüm borsayı, temettü listesi
//  120 satırı birden veriyor) ve "bugün ne var" sorusunun doğrudan
//  cevabı; Bugün sekmesi zaten sembolden bağımsız ölçümlerin yeri
//  (📊 Endeks Nabzı · ⚡ Makro Nabız · 📰 Piyasa gündemi). Keşfet'e
//  koymak, "sembol seç" bekleyen bir ekrana sembol tanımayan bir kart
//  koymak olurdu (📰 Piyasa gündemi kartının gerekçesiyle aynı).
//
//  ── ÜÇ AYRI DAL, BİRBİRİNE KARIŞTIRILMIYOR ────────────────────────
//  Uç bu ayrımı gövdede yapıyor ve kart onu olduğu gibi basıyor:
//    · anahtar GÖVDEDE YOK (`undefined`) → "SORMADIM" (kapsam dışı).
//    · değer `null`                      → "ÖLÇEMEDİM" (kaynak düştü).
//    · değer `[]`                        → "ÖLÇTÜM, YOK" (veri cevabı).
//  `0` ile `null` ASLA aynı yazılmıyor: adet alanı sayı değilse "—"
//  basılıyor, sıfır basılmıyor.
//
//  `tam:false` ya da `sayac.hata/zamanAsimi/kisa > 0` → liste EKSİKSİZ
//  GİBİ GÖSTERİLMİYOR: üstte açık bir "kaynakların biri ölçülemedi"
//  kutusu çiziliyor. Gelen satırlar gerçek, o yüzden gizlenmiyor.
//
//  NEDEN `HaberOlcumEksikRozet` KULLANILMADI: o rozet cümlelerini
//  "besleme" diye yazıyor (`Durum.tsx` `haberEksikCumleleri`: "N besleme
//  isteği hata verdi"). Takvimin kaynağı besleme değil, iki HTML sayfası
//  — rozeti buraya takmak kullanıcıya olmayan bir kaynak türü
//  söylemekti. "Eksik mi" eşiği yine TEK YERDEN okunuyor
//  (`haberOlcumEksik`, api/types.ts): sayaç şekli ölçüldü ve `HaberSayac`
//  ile BİREBİR aynı, o yüzden ikinci bir eşik yazılmadı.
//
//  NEDEN KAP SATIRI İÇİN YENİ BİLEŞEN YAZILMADI: `kap` maddesinin ilk
//  dört alanı `HaberMadde` ile birebir örtüşüyor (uç bunu bilerek
//  yapıyor, `api/_takvim.js` notu) — satır `HaberSatiri` ile basılıyor.
//  İkinci bir manşet satırı yazmak, yarın tarih biçimi değiştiğinde iki
//  farklı doğruluk demekti.
//
//  ── ÖLÇÜLMÜŞ TUZAK: `symbol` `null` OLABİLİR ───────────────────────
//  Canlı ölçüm (2026-10-29, `kapsam=kap`): 30 duyurunun 16'sında
//  `symbol: null` ve `tickers: []`. Sebep çok sembollü başlıklarda
//  (`"***GRFIN ** EMVAR*** …"`) uçtaki regex'in eşleşmemesi; bilinen ve
//  kasten onarılmamış arıza (`app.js:255` ikizi). BU KART O HÂLDE SEMBOL
//  UYDURMAZ, ROZET BASMAZ: yalnız başlığı gösterir ve kaç duyuruda
//  sembolün ayrıştırılamadığını AÇIKÇA yazar. Başlıktan sembol çıkarmak
//  istemcide hesap olurdu ve yanlış sembol basmak uydurma veridir.
//
//  ── BURADA HESAP YOK ──────────────────────────────────────────────
//  Eşik, ağırlık, formül, skor YOK. Sıralama uçta (`_takvim.js`) —
//  istemci yeniden sıralamıyor. Adetler (`kapAdet`, `temettuAdet`,
//  `temettuAtlanan`, `temettuTekrar`, `ms`) SUNUCUDAN okunup basılıyor.
//  Tek istemci sayımı "sembolü ayrıştırılamayan duyuru" adedi: uç bunu
//  bildirmiyor, `null` alanları saymak bir ölçüm (📰 Piyasa gündemi
//  kartının okunan besleme sayımıyla aynı desen), eşik değil.
//
//  BİRİM: `yieldPct` YÜZDE PUANI (ölçüldü 1.04 = %1,04) → `formatPercent`,
//  100 ile ÇARPILMIYOR. `amount` hisse başı PARA → `formatPrice(amount,
//  currency)`. Tarih için uçtan gelen `dateHam` ("30 Ekim") olduğu gibi
//  basılıyor; kendi ay adı tablosu YAZILMADI. `Intl` /
//  `toLocaleDateString` BU DOSYADA HİÇ YOK (Hermes kısıtı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchTakvim,
  haberOlcumEksik,
  useIstek,
  TAKVIM_AZAMI_TEMETTU,
  TAKVIM_KAPSAMLAR,
  TAKVIM_VARSAYILAN_TEMETTU,
  VARSAYILAN_TAKVIM_KAPSAM,
  type TakvimKapMadde,
  type TakvimKapsam,
  type TakvimTemettuMadde,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Durum,
  Katlanir,
  OlcemedimKutu,
  OlcumSatiri,
  Pill,
  VeriYok,
} from '@/components';
import { HaberSatiri } from '@/components/kesfet';
import { formatPercent, formatPrice } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type TakvimKartProps = {
  /**
   * Kaç KAP duyurusu istensin — ucun 1..60 aralığı. Verilmezse ucun
   * kendi varsayılanı (30) kullanılır; istemci kendi sayısını uydurmaz.
   */
  kapAdet?: number;
  /** Kaç temettü satırı — ucun 1..400 aralığı; varsayılanı 120. */
  temettuAdet?: number;
};

/**
 * Kapsam kodu → Türkçe etiket. ÇEVİRİ, karar değil: izinli küme uçtan
 * (`TAKVIM_KAPSAMLAR`). Kümede olup burada karşılığı olmayan bir kod
 * gelirse kodun KENDİSİ basılır — sessizce düşmez.
 */
const KAPSAM_METIN: Record<string, string> = {
  hepsi: 'Hepsi',
  kap: 'KAP',
  temettu: 'Temettü',
};

/** Sayı değilse "—": ölçülmemiş adet yerine `0` basmak yalan olurdu. */
function adetMetni(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : '—';
}

export function TakvimKart({ kapAdet, temettuAdet }: TakvimKartProps) {
  const { colors } = useTheme();
  const [kapsam, setKapsam] = useState<TakvimKapsam>(VARSAYILAN_TAKVIM_KAPSAM);

  // OLCULMUS TUZAK (sozlesme notu, `api/_takvim.js`): kaynak aylari
  // OCAK -> ARALIK sirayla basiyor ve uc maddeleri DOKUMAN SIRASINDA
  // tavana kadar aliyor. Yilin ikinci yarisinda varsayilan tavan
  // GECMIS satirlarla dolabiliyor ve GELECEK temettu hic gorunmuyor.
  // Sozlesme bu durumda istemciye "`temettuAdet=400` ile yeniden sor"
  // diyor.
  //
  // NEDEN AYNI `cagri` ICINDE, STATE + EFFECT ILE DEGIL: ikinci turu
  // bir `useEffect` icinde `setState` ile tetiklemek kademeli render
  // uretiyor (eslint `react-hooks/set-state-in-effect`). Karar
  // TAMAMEN ilk turun cevabina bakiyor, o yuzden ayni cagrinin
  // icinde veriliyor: tek anahtar, tek yenileme dugmesi.
  //
  // IKINCI TUR KOSULLU VE EN COK BIR KEZ: gelecek satir SIFIR VE tavan
  // DOLU ise. Tek basina "gelecek sifir" gercek bir cevap olabilir
  // (yil sonu) - o halde ikinci tur ACILMIYOR.
  // Bayrak STATE, ref DEGIL: ref'i render icinde okumak yasak
  // (eslint `react-hooks/refs`). setState cagrisi await SONRASINDA,
  // yani render sirasinda ya da bir effect icinde DEGIL; cagri
  // bagimliliklarinda bu state yok, o yuzden yeni tur tetiklemiyor.
  const [genisTurOldu, setGenisTurOldu] = useState(false);
  // Tavan: ne sorduysak o (sormadiysak ucun ILAN ETTIGI varsayilan).
  const tavan = temettuAdet ?? TAKVIM_VARSAYILAN_TEMETTU;

  const cagri = useCallback(
    async (signal: AbortSignal) => {
      setGenisTurOldu(false);
      const ilk = await fetchTakvim({ kapsam, kapAdet, temettuAdet, signal });
      if (!ilk.ok) return ilk;

      const yerelTavan = temettuAdet ?? TAKVIM_VARSAYILAN_TEMETTU;
      const basilan = ilk.data.temettuAdet;
      // Bu bir KIYAS, hesap degil: "tavan doldu mu" sorusunu sozlesme
      // istemciye soruyor. Esik/agirlik/formul YOK.
      const tavanDoldu = typeof basilan === 'number' && basilan >= yerelTavan;
      const gelecekHicYok = ilk.data.temettuGelecekAdet === 0;
      if (!gelecekHicYok || !tavanDoldu || yerelTavan >= TAKVIM_AZAMI_TEMETTU) return ilk;

      const genis = await fetchTakvim({
        kapsam,
        kapAdet,
        temettuAdet: TAKVIM_AZAMI_TEMETTU,
        signal,
      });
      // GENIS TUR DUSERSE OLCULMUS ILK TURU KAYBETMIYORUZ.
      if (!genis.ok) return ilk;
      setGenisTurOldu(true);
      return genis;
    },
    [kapsam, kapAdet, temettuAdet],
  );
  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    'takvim:' + kapsam + '|' + String(kapAdet ?? '') + '|' + String(temettuAdet ?? ''),
  );

  const eksik = haberOlcumEksik(veri ?? null);

  // ÜÇ DAL AYRI TUTULUYOR: `undefined` (anahtar gövdede yok) =
  // "sormadım", `null` = "ölçemedim", dizi = "ölçtüm".
  const kapSorulmus = durum === 'veri' && veri ? veri.kap !== undefined : false;
  const temettuSorulmus = durum === 'veri' && veri ? veri.temettu !== undefined : false;
  const kap: TakvimKapMadde[] | null = veri?.kap ?? null;
  const temettu: TakvimTemettuMadde[] | null = veri?.temettu ?? null;

  // Sembolü AYRIŞTIRILAMAYAN duyuru adedi — uç bu sayıyı bildirmiyor,
  // `null` alanları saymak bir ölçüm. Sembol UYDURULMUYOR, yalnız kaç
  // satırda eksik kaldığı yazılıyor.
  const sembolsuz = (kap ?? []).filter((m) => m.symbol == null).length;

  // ADETLER UCTAN. `paid === null` satirlari IKI SAYIMA DA girmiyor
  // (uc bunu bilerek yapiyor), o yuzden ikisinin toplami basilan satir
  // sayisindan KUCUK olabilir - ekran bu farki gizlemiyor ve kendisi
  // yeniden saymiyor.
  const gecmisAdet = veri?.temettuGecmisAdet;
  const gelecekAdet = veri?.temettuGelecekAdet;
  const bugunGun = veri?.temettuBugun;

  return (
    <Card
      title="🗓️ Takvim"
      subtitle="KAP duyuruları · BIST temettü takvimi — satırlar uçtan geldiği gibi"
      right={
        durum === 'veri' && veri ? (
          // Makine kodu da ekranda: hangi kapsam ölçüldü, cevaptan okunuyor.
          <Pill label={'kapsam: ' + veri.kapsam} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <View style={styles.cipler}>
        {TAKVIM_KAPSAMLAR.map((k) => (
          <KapsamCipi
            key={k}
            etiket={KAPSAM_METIN[k] ?? k}
            aktif={k === kapsam}
            onPress={() => setKapsam(k)}
          />
        ))}
      </View>

      {/* NEDEN `kartsiz`: gövde zaten bir `Card` içinde.
          NEDEN `sekil="metin"` ve 3 parça: beklenen içerik metin satırı
          (başlık + tarih), fiyat taşıyan liste satırı DEĞİL. */}
      <Durum durum={durum} hata={hata} yenile={yenile} kartsiz iskelet={3} sekil="metin" />

      {/* EKSİK ÖLÇÜM NOTU LİSTELERİN ÜSTÜNDE: eksikliği satırları
          okuduktan SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak
          olurdu. */}
      {durum === 'veri' && veri && eksik ? (
        <OlcemedimKutu
          metin={
            'Kaynakların biri ölçülemedi: ' +
            (veri.tam === false ? 'uç turu TAM bildirmedi' : 'sayaçta kesinti var') +
            ' (istek ' +
            adetMetni(veri.sayac?.istek) +
            ' · başarı ' +
            adetMetni(veri.sayac?.basari) +
            ' · hata ' +
            adetMetni(veri.sayac?.hata) +
            ' · zaman aşımı ' +
            adetMetni(veri.sayac?.zamanAsimi) +
            ' · kısa gövde ' +
            adetMetni(veri.sayac?.kisa) +
            '). Aşağıdaki satırlar takvimin TAMAMI DEĞİL.'
          }
          yenile={yenile}
        />
      ) : null}

      {/* ---------- KAP DUYURULARI ---------- */}
      {durum === 'veri' && veri ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>KAP duyuruları</Text>

          {!kapSorulmus ? (
            // SORMADIM ≠ ÖLÇEMEDİM: anahtar gövdede HİÇ YOK, çünkü bu
            // kapsam KAP istemedi. Hata kutusu çizmek yalan olurdu.
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Bu kapsamda KAP duyuruları SORULMADI — kapsamı “Hepsi” ya da “KAP” yap.
            </Text>
          ) : kap === null ? (
            // İSTENDİ ama OKUNAMADI — ucun kendi `null`u.
            <OlcemedimKutu
              metin="KAP duyuru kaynağı istendi ama OKUNAMADI (uç bu alanı null döndürdü). Duyuru olmadığı anlamına GELMEZ."
              yenile={yenile}
            />
          ) : kap.length === 0 ? (
            <VeriYok
              kartsiz
              metin="Uç KAP akışını okudu ama duyuru bulamadı — bu da ÖLÇÜLMÜŞ bir cevap."
            />
          ) : (
            <View>
              {kap.map((m, i) => (
                <KapSatiri key={(m.link || '') + '#' + String(i)} madde={m} />
              ))}
              {/* ARIZA GİZLENMİYOR: sembolü ayrıştırılamayan duyuru
                  sayısı yazılı; o satırlarda rozet basılmadı. */}
              {sembolsuz > 0 ? (
                <Text style={[type.micro, { color: colors.textDim }]}>
                  {String(sembolsuz) +
                    ' duyuruda sembol AYRIŞTIRILAMADI (çok sembollü başlıkta ucun ayrıştırıcısı eşleşmiyor). ' +
                    'O satırlarda sembol rozeti basılmadı — başlıktan sembol türetmek uydurma olurdu.'}
                </Text>
              ) : null}
            </View>
          )}

          {kapSorulmus ? (
            <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
              {'Basılan duyuru: ' + adetMetni(veri.kapAdet) + ' (ucun saydığı adet)'}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ---------- TEMETTÜ TAKVİMİ ---------- */}
      {durum === 'veri' && veri ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>BIST temettü takvimi</Text>

          {!temettuSorulmus ? (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Bu kapsamda temettü takvimi SORULMADI — kapsamı “Hepsi” ya da “Temettü” yap.
            </Text>
          ) : temettu === null ? (
            <OlcemedimKutu
              metin="Temettü takvimi istendi ama OKUNAMADI (uç bu alanı null döndürdü). Temettü olmadığı anlamına GELMEZ."
              yenile={yenile}
            />
          ) : temettu.length === 0 ? (
            <VeriYok
              kartsiz
              metin="Uç temettü sayfasını okudu ama satır bulamadı — bu da ÖLÇÜLMÜŞ bir cevap."
            />
          ) : (
            <View>
              {temettu.map((t, i) => (
                <TemettuSatiri key={t.symbol + '@' + t.date + '#' + String(i)} madde={t} />
              ))}
            </View>
          )}

          {temettuSorulmus ? (
            // TASARIM TURU 1: sayaç künyesi VARSAYILAN KAPALI. Gerekçe:
            // bu blok takvimin kendisi değil, takvimin NASIL ölçüldüğü —
            // ekranın birincil bilgisi değil ama silinemez (atlanan satır
            // sayısı sessiz kalmamalı). Kapalı özet satırı içeride ne
            // olduğunu söylüyor; beş uzun cümle varsayılan görünümden
            // çıkıyor. Sayaçlar artık düz metin değil ÖLÇÜM SATIRI:
            // birim ("adet") bölüm başlığında bir kez.
            <Katlanir
              baslik="Temettü ayrıştırıcı künyesi"
              ozet="basılan · atlanan · tekilleştirilen · kıyas günü"
              birim="adet">
              {/* ATLANAN/TEKRAR SESSİZ KALMIYOR: ucun ayrıştırıcısının
                  düşürdüğü satır sayısı görünür. */}
              <OlcumSatiri etiket="Basılan satır" deger={adetMetni(veri.temettuAdet)} />
              <OlcumSatiri
                etiket="Ayrıştırıcının atladığı"
                deger={adetMetni(veri.temettuAtlanan)}
              />
              <OlcumSatiri etiket="Tekilleştirilen" deger={adetMetni(veri.temettuTekrar)} />

              {/* ÜÇ DAL: anahtar gövdede YOKSA (eski uç) "sormadım",
                  `null` ise "ölçemedim", sayı ise basılır. `0` ile
                  `null` ayrı yazılıyor. */}
              {gecmisAdet === undefined && gelecekAdet === undefined ? (
                <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
                  Ödeme günü geçti/gelecek ayrımı: uç bu sayıları GÖNDERMEDİ.
                </Text>
              ) : (
                <>
                  <OlcumSatiri etiket="Ödeme günü GEÇMİŞ satır" deger={adetMetni(gecmisAdet)} />
                  <OlcumSatiri etiket="Ödeme günü GELECEK satır" deger={adetMetni(gelecekAdet)} />
                  <Text style={[type.micro, { color: colors.textFaint }]}>
                    Günü ÖLÇÜLEMEYEN satırlar bu iki sayının HİÇBİRİNE girmiyor, o yüzden
                    toplamı basılan satır sayısından küçük olabilir.
                  </Text>
                </>
              )}

              <Text style={[type.micro, { color: colors.textFaint }]}>
                {bugunGun === undefined
                  ? 'Kıyas günü: uç bu alanı göndermedi — "geçti/gelecek" ayrımı ölçülemez.'
                  : bugunGun === null
                    ? 'Kıyas günü ÖLÇÜLEMEDİ: uca bugünün tarihi ulaşmadı, bu yüzden satırlarda "ödeme günü geçti mi" boş kalır.'
                    : 'Kıyas günü (uçtan): ' + bugunGun}
              </Text>

              {/* YENİDEN SORMA SESSİZ DEĞİL: kullanıcı neden 400 satır
                  istendiğini görüyor. */}
              {genisTurOldu ? (
                <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
                  {'Gelecek ödemeli satır bulunamadı ve ' +
                    String(tavan) +
                    ' satırlık tavan dolmuştu; takvim ' +
                    String(TAKVIM_AZAMI_TEMETTU) +
                    ' satırla YENİDEN soruldu (kaynak ayları Ocak→Aralık sıralı basıyor).'}
                </Text>
              ) : null}
            </Katlanir>
          ) : null}
        </View>
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, styles.num, { color: colors.textFaint, marginTop: space.sm }]}>
          {'Ölçüm süresi: ' +
            adetMetni(veri.ms) +
            ' ms · okunan gövde: ' +
            adetMetni(veri.sayac?.bayt) +
            ' bayt · tur ' +
            (veri.tam ? 'TAM' : 'EKSİK')}
        </Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

/**
 * Tek KAP duyurusu. Başlık + kaynak/tarih `HaberSatiri`ye bırakılıyor
 * (alan kümesi örtüşüyor); bu sarmalayıcı yalnız SEMBOL ROZETİNİ
 * ekliyor.
 *
 * `symbol` `null` ise ROZET HİÇ ÇİZİLMİYOR: boş bir rozet ya da "—"
 * basmak "sembolü var ama gösteremedim" izlenimi verirdi; uydurma
 * sembol ise doğrudan yalan olurdu. `tickers` de başlıktan
 * ayrıştırılmıyor — uç ne verdiyse o.
 */
function KapSatiri({ madde }: { madde: TakvimKapMadde }) {
  const sembol = (madde.symbol ?? '').trim();
  const ekTickers = (madde.tickers ?? []).filter((t) => t && t !== sembol);

  return (
    <View style={styles.kapSatir}>
      {sembol ? (
        <View style={styles.rozetler}>
          <Pill label={sembol} tone="info" glyph={null} size="sm" />
          {/* Başlıkta geçen DİĞER semboller — uçtan geldiği gibi. */}
          {ekTickers.map((t) => (
            <Pill key={t} label={t} tone="neutral" variant="outline" glyph={null} size="sm" />
          ))}
        </View>
      ) : null}
      <HaberSatiri madde={madde} />
    </View>
  );
}

/**
 * Tek temettü satırı. ÜÇ FARKLI ÖLÇEK, ÜÇ FARKLI BİÇİMLEYİCİ:
 *   · `amount`   PARA → `formatPrice(amount, currency)`
 *   · `yieldPct` YÜZDE PUANI → `formatPercent` (100 ile ÇARPILMAZ)
 *   · `dateHam`  uçtan gelen Türkçe gün/ay ("30 Ekim") — olduğu gibi.
 *
 * NEDEN `dateHam`, `date` DEĞİL: `date` ISO ("2026-10-30") ve ekranda
 * okunması zor; Türkçeye çevirmek için ay adı tablosu yazmak ucun
 * tablosunun ikizini doğurmak olurdu (`api/_takvim.js` uyarısı). ISO
 * hâli yine de ekranda, parantez içinde: kesinliği kaybetmiyoruz.
 *
 * NEDEN BAĞLANTI YOK (ÖLÇÜLDÜ 2026-10-29, `api/_takvim.js:106`):
 * `TEMETTU_MADDE_ALANLARI` ALTI alan ilan ediyor — `symbol`, `date`,
 * `dateHam`, `amount`, `yieldPct`, `currency`. `link` BU KÜMEDE YOK
 * (tipte de yok: `TakvimTemettuMadde`); `link` yalnız KAP maddesinde
 * (`TakvimKapMadde.link`) ve o satır onu `HaberSatiri` üzerinden
 * `Linking.openURL` ile AÇIYOR. Buraya sembolden bir KAP/Mynet adresi
 * kurmak uydurma bağlantı olurdu — uç o adresi ölçmedi.
 */
function TemettuSatiri({ madde }: { madde: TakvimTemettuMadde }) {
  const { colors } = useTheme();
  const gun = (madde.dateHam ?? '').trim();
  const iso = (madde.date ?? '').trim();
  // ÜÇ DEĞER, ÜÇ AYRI CÜMLE. `null` "ödenmedi" DEĞİL - uç
  // ölçemedi demek; onu `false` gibi yazmak uydurma olurdu.
  const odemeMetni =
    madde.paid === true
      ? 'ödeme günü GEÇTİ'
      : madde.paid === false
        ? 'ödeme günü GELECEK'
        : 'ödeme günü geçti mi ÖLÇÜLEMEDİ';

  return (
    <View style={styles.temettuSatir}>
      <Pill label={madde.symbol} tone="info" glyph={null} size="sm" />
      <View style={styles.temettuGovde}>
        {/* TASARIM TURU 1 / HİYERARŞİ: satırın ÖLÇÜLEN DEĞERİ hisse başı
            tutar ve verim; önce ikisi de `type.micro` + `textDim` ile,
            yani tarihten DAHA SİLİK basılıyordu. Kademeler yer değiştirdi:
            tutar birincil (`bodyBold` + gövde rengi), tarih ikincil, ödeme
            günü durumu üçüncül. Metin ve biçimleyiciler aynı. */}
        <Text style={[type.small, { color: colors.textDim }]}>
          {(gun || iso || 'tarih gelmedi') + (gun && iso ? ' (' + iso + ')' : '')}
        </Text>
        <Text style={[type.bodyBold, styles.num, { color: colors.text }]}>
          {'Hisse başı ' +
            formatPrice(madde.amount, madde.currency) +
            ' · verim ' +
            formatPercent(madde.yieldPct)}
        </Text>
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {madde.paid === undefined ? 'ödeme günü durumu: uç GÖNDERMEDİ' : odemeMetni}
        </Text>
      </View>
    </View>
  );
}

/** Kapsam çipi. Seçim RENKLE DEĞİL: başta "•" ve erişilebilirlik durumu. */
function KapsamCipi({
  etiket,
  aktif,
  onPress,
}: {
  etiket: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={'Takvim kapsamı: ' + etiket + (aktif ? ' — seçili' : '')}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.cipKabi,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      <Pill
        label={(aktif ? '• ' : '') + etiket}
        tone={aktif ? 'gold' : 'neutral'}
        variant={aktif ? 'soft' : 'outline'}
        glyph={null}
        size="sm"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cipKabi: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  bolum: { gap: space.xxs, paddingTop: space.md },
  kapSatir: { gap: space.xxs },
  rozetler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.sm },
  temettuSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  // `gap: 2` jetona çevrildi (TASARIM TURU 1): space.xxs aynı değer.
  temettuGovde: { flex: 1, gap: space.xxs },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
