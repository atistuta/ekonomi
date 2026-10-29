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
  TAKVIM_KAPSAMLAR,
  VARSAYILAN_TAKVIM_KAPSAM,
  type TakvimKapMadde,
  type TakvimKapsam,
  type TakvimTemettuMadde,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Durum,
  OlcemedimKutu,
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

  const cagri = useCallback(
    (signal: AbortSignal) => fetchTakvim({ kapsam, kapAdet, temettuAdet, signal }),
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
            <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
              {/* ATLANAN/TEKRAR SESSİZ KALMIYOR: ucun ayrıştırıcısının
                  düşürdüğü satır sayısı görünür. */}
              {'Basılan satır: ' +
                adetMetni(veri.temettuAdet) +
                ' · ayrıştırıcının atladığı: ' +
                adetMetni(veri.temettuAtlanan) +
                ' · tekilleştirilen: ' +
                adetMetni(veri.temettuTekrar)}
            </Text>
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
 */
function TemettuSatiri({ madde }: { madde: TakvimTemettuMadde }) {
  const { colors } = useTheme();
  const gun = (madde.dateHam ?? '').trim();
  const iso = (madde.date ?? '').trim();

  return (
    <View style={styles.temettuSatir}>
      <Pill label={madde.symbol} tone="info" glyph={null} size="sm" />
      <View style={styles.temettuGovde}>
        <Text style={[type.small, { color: colors.text }]}>
          {(gun || iso || 'tarih gelmedi') + (gun && iso ? ' (' + iso + ')' : '')}
        </Text>
        <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
          {'Hisse başı ' +
            formatPrice(madde.amount, madde.currency) +
            ' · verim ' +
            formatPercent(madde.yieldPct)}
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
  temettuGovde: { flex: 1, gap: 2 },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
