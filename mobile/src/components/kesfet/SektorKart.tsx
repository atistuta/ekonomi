// =====================================================================
//  🏭 SEKTÖR DAĞILIMI — Keşfet kartı                  (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinin künyeleri (`/api/yfin`) → `POST /api/sektor`.
//  Uç kayıtları sektör gruplarına bölüp her grup için MEDYAN F/K · ileri
//  F/K · büyüme · marj · PEG döndürüyor. Webde bu "Sektör" sekmesiydi.
//
//  ── NEDEN KEŞFET SEKMESİNDE (ÖLÇÜLDÜ) ─────────────────────────────
//  Bu kart 🔎 Tarama kartının BİREBİR aynı hattını kullanıyor:
//  `fetchYfin(liste)` → POST ölçüm listesi, aynı 12 sembol sınırı, aynı
//  `olcumKapisi`. Keşfet zaten "listeyi künyeye çevirip motora sor"
//  kartlarının yeri (🌍 Radar · 🔥 Fırsatlar · 🔎 Tarama). Bugün sekmesi
//  ise bugünün tek seferlik ölçümlerini topluyor — oraya koymak aynı
//  künye turunu iki sekmede iki kez çalıştırmak olurdu.
//  ALT MENÜ DEĞİŞMEDİ: yeni sekme AÇILMADI.
//
//  NEDEN BUGÜN'ÜN "ÖNE ÇIKAN SEKTÖR" EKSİĞİNİ KAPATMIYOR: bu uç
//  PİYASAYI taramıyor, yalnız KULLANICININ listesini (en çok 12 sembol)
//  gruplara bölüyor. "Öne çıkan sektör" piyasa geneli bir sıralama
//  isterdi; onu bununla doldurmak kapsamı sessizce küçültmek olurdu.
//  O yüzden Bugün ekranındaki dürüst eksik ilanı OLDUĞU GİBİ duruyor.
//
//  ── ⚠️ MEDYANLAR HAM KESİR ────────────────────────────────────────
//  `medGrowth` / `medMargin` uçtan KESİR geliyor (0.18 = %18) ve uç ×100
//  YAPMIYOR (api/types.ts `SektorGrup` başlığı). Yüzdeye çevirme
//  BURADA, TEK KEZ yapılıyor (`yuzde()`), çünkü `formatPercent` YÜZDE
//  PUANI bekliyor (lib/format.ts:64) — ikinci bir ölçekleme iki kat
//  yanlış basardı. `medPe`/`medFpe`/`medPeg` çarpansız oran: hiç
//  ölçeklenmiyor, `formatOran` ile basılıyor.
//
//  ── SIRALAMA MOTORUN ──────────────────────────────────────────────
//  `sira` yalnız KİPİN ADI; dizilimi uç yapıyor (`sekSortGroups`).
//  İstemci `gruplar` dizisini geldiği SIRADA basıyor — yeniden
//  sıralamıyor, eşik uygulamıyor, grup skorlamıyor.
//
//  ── ÖLÇÜLMEYEN SAYI BASILMAZ ──────────────────────────────────────
//  Medyan ölçülemediyse uç `null` döndürüyor (0 DEĞİL) ve ekranda "—"
//  yazıyor. `siniflanan < degerlendirilen` ise fark EKSİK ÖLÇÜM olarak
//  yazılıyor; 12 sembol sınırının dışında kalan sembol sayısı da ekranda.
//
//  ── ⚖️ KARŞILAŞTIR KÖPRÜSÜ ────────────────────────────────────────
//  Her grubun altında bir düğme var: grubun sembolleri `kiyas` yol
//  parametresiyle (virgülle ayrık) Analiz sekmesine taşınıyor, oradaki
//  ⚖️ Karşılaştır turu takip listesi yerine O KÜMEYLE koşuyor. Yeni
//  sekme AÇILMADI (5 menü düzeni), bu kart yeni uç ÇAĞIRMIYOR —
//  köprünün tüm maliyeti Analiz ekranındaki MEVCUT `/api/compare`
//  turunun girdisinin değişmesi. Aynı desen Bugün↔Arama `tema`
//  köprüsünde zaten kullanılıyor.
//
//  SINIR SESSİZ KIRPILMIYOR: kıyas ucu bir turda en çok `AZAMI_SEMBOL`
//  sembol alıyor (fazlasını 400 ile reddediyor). Grup daha büyükse
//  düğme kaç sembolün taşınacağını ve kaçının DIŞARIDA kalacağını
//  önceden yazıyor; Analiz ekranı da aynı sayıyı tekrar yazıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AZAMI_SEMBOL,
  fetchSektor,
  fetchYfin,
  useIstek,
  SIRA_KIPLERI,
  VARSAYILAN_SIRA,
  YFIN_AZAMI_SEMBOL,
  type ApiResult,
  type OlcumKayit,
  type SektorGrup,
  type SektorHisse,
  type SektorResponse,
  type SiraKip,
  type YfinKunye,
} from '@/api';
import {
  Card,
  Dugme,
  Durum,
  Katlanir,
  OlcumBaslik,
  OlcumSatiri,
  Pill,
  SectorChip,
  VeriYok,
} from '@/components';
import { formatOran, formatPercent } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type SektorKartProps = {
  /** Gruplanacak semboller — kullanıcının takip listesi. */
  liste: readonly string[];
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
};

/**
 * Sıralama kipi → Türkçe etiket. ÇEVİRİ, HESAP DEĞİL: hangi grubun
 * önce geldiğine uç karar veriyor (`sekSortGroups`).
 */
const SIRA_METIN: Record<SiraKip, string> = {
  cheap: 'medyan F/K düşükten',
  growth: 'medyan büyüme yüksekten',
  margin: 'medyan marj yüksekten',
  count: 'hisse sayısı çoktan',
};

/**
 * Sınıflandırma kademesi (`basis`) → Türkçe. Motorun `sekClassify`
 * kademesini anlatıyor; `null` = hiçbir kademe tutmadı.
 */
const BASIS_METIN: Record<string, string> = {
  sector: 'Yahoo sektörü',
  industry: 'Yahoo alt sektörü',
  fund: 'fon/ETF etiketi',
  tag: 'motor etiketi',
  biz: 'faaliyet tanımı',
};

/** Ölçülmemiş sayı `null` — 0 DEĞİL. */
function sayi(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function metin(v: string | null | undefined): string | null {
  return typeof v === 'string' && v ? v : null;
}

/**
 * Künye → ölçüm kaydı. `market` BİLEREK VERİLMİYOR: sunucu `.IS` ekiyle
 * biten sembolü kendisi BIST'e çözüyor (`api/_girdi.js temizleSembol`).
 * 🔎 Tarama kartındaki eşlemenin AYNISI — uç da aynı ölçüm listesini
 * bekliyor (`olcumKapisi` ikisinde de aynı).
 */
function olcumYap(k: YfinKunye): OlcumKayit {
  return {
    symbol: k.symbol,
    ok: k.ok,
    trailingPE: sayi(k.trailingPE),
    forwardPE: sayi(k.forwardPE),
    peg: sayi(k.peg),
    priceToBook: sayi(k.priceToBook),
    priceToSales: sayi(k.priceToSales),
    evEbitda: sayi(k.evEbitda),
    marketCap: sayi(k.marketCap),
    profitMargin: sayi(k.profitMargin),
    returnOnEquity: sayi(k.returnOnEquity),
    revenueGrowth: sayi(k.revenueGrowth),
    earningsGrowth: sayi(k.earningsGrowth),
    debtToEquity: sayi(k.debtToEquity),
    dividendYield: sayi(k.dividendYield),
    price: sayi(k.price),
    sector: metin(k.sector),
    industry: metin(k.industry),
    name: metin(k.name),
    // NEDEN GONDERILIYOR: uc `bizSummary`yi hem SINIFLAMA kademesinde
    // kullaniyor (`basis: 'biz'`) hem de grup maddesinde GERI YANKILIYOR
    // (api/_kesif.js:441-467). Gondermezsek ekranda is tanimi HIC
    // olusamaz - uc onu kendisi uretmiyor, bizim gonderdigimizi
    // 400 karakterde kirpip geri veriyor.
    bizSummary: metin(k.bizSummary),
  };
}

/**
 * HAM KESİR → yüzde metni. ×100 TAM BİR KEZ burada: uç kesir
 * döndürüyor, `formatPercent` yüzde puanı bekliyor. Ölçülmediyse "—".
 */
function yuzde(v: number | null | undefined): string {
  const n = sayi(v);
  return n == null ? '—' : formatPercent(n * 100);
}

/** Çarpansız oran (F/K, ileri F/K, PEG). Ölçeklenmez. */
function oran(v: number | null | undefined): string {
  const n = sayi(v);
  return n == null ? '—' : formatOran(n);
}

export function SektorKart({ liste, onSembol }: SektorKartProps) {
  const { colors } = useTheme();
  const [sira, setSira] = useState<SiraKip>(VARSAYILAN_SIRA);

  // Kırpma AÇIK: `fetchYfin` 12'den fazlasını reddediyor; kaç sembolün
  // dışarıda kaldığı aşağıda ekrana yazılıyor.
  const evren = useMemo(() => liste.slice(0, YFIN_AZAMI_SEMBOL), [liste]);
  const disarida = liste.length - evren.length;

  const cagri = useCallback(
    async (signal: AbortSignal): Promise<ApiResult<SektorResponse>> => {
      const kunye = await fetchYfin([...evren], { deep: false, signal });
      if (!kunye.ok) return { ok: false, error: kunye.error };
      const olcumler = kunye.data.results.map(olcumYap);
      return fetchSektor(olcumler, { sira, signal });
    },
    [evren, sira],
  );

  const { durum, veri, hata, yenile } = useIstek(cagri, sira + '|' + evren.join(','), {
    etkin: evren.length > 0,
  });

  // Uçtan geldiği SIRADA — istemci yeniden sıralamıyor.
  const gruplar: SektorGrup[] = veri?.gruplar ?? [];
  const degerlendirilen = veri?.degerlendirilen ?? null;
  const siniflanan = veri?.siniflanan ?? null;
  const siniflanmayan =
    degerlendirilen != null && siniflanan != null ? degerlendirilen - siniflanan : null;

  return (
    <Card
      title="🏭 Sektör dağılımı"
      subtitle="Takip listen sektör gruplarına bölünür — medyanları ve dizilimi motor hesaplar"
      right={
        durum === 'veri' && veri ? (
          <Pill label={String(veri.sira)} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <View style={styles.cipler}>
        {SIRA_KIPLERI.map((k) => (
          <SiraCipi
            key={k}
            etiket={SIRA_METIN[k] ?? k}
            aktif={k === sira}
            onPress={() => setSira(k)}
          />
        ))}
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="sira"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {durum === 'veri' && veri && gruplar.length === 0 ? (
        <VeriYok metin="Uç bu listeden hiçbir grup kuramadı — bu da ÖLÇÜLMÜŞ bir cevap." />
      ) : null}

      {durum === 'veri' && gruplar.length ? (
        <View style={styles.bolum}>
          {gruplar.map((g) => (
            <GrupSatiri key={g.anahtar} grup={g} onSembol={onSembol} />
          ))}
        </View>
      ) : null}

      {/* ÖLÇÜM NOTU — eksik sınıflama ve kırpma GİZLİ KALMAZ. */}
      {durum === 'veri' && veri ? (
        <View style={styles.bolum}>
          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {'Değerlendirilen kayıt: ' +
              (degerlendirilen != null ? String(degerlendirilen) : '—') +
              ' · gruba giren: ' +
              (siniflanan != null ? String(siniflanan) : '—') +
              ' · grup: ' +
              String(gruplar.length) +
              ' · ölçüm süresi: ' +
              String(veri.ms) +
              ' ms'}
          </Text>
          {siniflanmayan != null && siniflanmayan > 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {String(siniflanmayan) +
                ' kayıt hiçbir gruba GİRMEDİ (künyesi gelmeyen kayıt gruplanmıyor) — bu eksik ölçüm, sıfır değil.'}
            </Text>
          ) : null}
          {disarida > 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {String(disarida) +
                ' sembol bu turda GRUPLANMADI: künye ucu bir turda en çok ' +
                String(YFIN_AZAMI_SEMBOL) +
                ' sembol alıyor.'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Tek sektör grubu: başlık + medyanlar + içindeki hisseler. */
function GrupSatiri({
  grup,
  onSembol,
}: {
  grup: SektorGrup;
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
}) {
  const { colors } = useTheme();
  // `_other` MOTOR SENTİNELİ, sektör adı değil: olduğu gibi basmak
  // kullanıcıya anlamsız gelir, bu yüzden ne olduğu YAZILIYOR.
  const ad = grup.anahtar === '_other' ? 'Sınıflanamayan' : grup.anahtar;
  // Kıyasa taşınacak küme: SIRA UCUN, burada yeniden dizilmiyor; yalnız
  // ucun sözleşme sınırı kadarı alınıyor ve kalanı ekranda yazılıyor.
  const semboller = grup.hisseler.map((h) => h.sym);
  const tasinan = semboller.slice(0, AZAMI_SEMBOL);
  const disarida = semboller.length - tasinan.length;

  return (
    <View style={[styles.grup, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <SectorChip sector={ad} size="sm" />
      </View>

      {/* MEDYANLAR — ölçülmeyen "—". Büyüme ve marj KESİRDEN yüzdeye
          TEK KEZ çevrildi; F/K · ileri F/K · PEG çarpansız oran.
          TASARIM TURU 1: iki sıkış metin satırı yerine ölçüm satırı.
          Gerekçe: beş medyan grubun BİRİNCİL bilgisi ama ikisi de
          `type.micro` + `textDim` ile, yani sayfanın en silik puntosuyla
          basılıyordu; "medyan" kelimesi de üç kez tekrar ediyordu. Kelime
          ve birim artık bölüm başlığında BİR kez, sayılar sağ sütunda
          hizalı ve birincil kademede. Hiçbir sayı/biçimleyici değişmedi
          (`oran` ve `yuzde` aynı). */}
      <OlcumBaslik baslik="Grup medyanları" birim="F/K · ileri F/K · PEG çarpansız oran" />
      <OlcumSatiri etiket="F/K" deger={oran(grup.medPe)} />
      <OlcumSatiri etiket="İleri F/K" deger={oran(grup.medFpe)} />
      <OlcumSatiri etiket="PEG" deger={oran(grup.medPeg)} />
      <OlcumBaslik baslik="Grup medyanları" birim="yüzde" />
      <OlcumSatiri etiket="Büyüme" deger={yuzde(grup.medGrowth)} />
      <OlcumSatiri etiket="Marj" deger={yuzde(grup.medMargin)} />

      {/* TASARIM TURU 1: hisse listesi VARSAYILAN KAPALI. Gerekçe: bir
          turda 12 sembol gruplara dağılıyor ve her hisse 4-6 satır
          basıyor; hepsi açıkken ekranda sektör AYRIMI kayboluyordu.
          Grubun adedi ("n hisse") artık üst satırda DEĞİL kapağın özet
          satırında — aynı sayı, aynı cümle, tek yerde. */}
      <Katlanir baslik="Hisseler" ozet={String(grup.n) + ' hisse'}>
        {grup.hisseler.map((h) => (
          <HisseSatiri key={h.sym} hisse={h} onSembol={onSembol} />
        ))}
      </Katlanir>

      {/* KÖPRÜ: grup → Analiz ▸ ⚖️ Karşılaştır. Parametre VİRGÜLLE
          AYRIK METİN, çünkü yol parametresi metin taşıyor; karşı taraf
          aynı ayırıcıyla çözüyor. Buradan AĞ İSTEĞİ ÇIKMIYOR. */}
      {tasinan.length >= 2 ? (
        <>
          <Dugme
            label={'⚖️ Analiz ▸ Karşılaştır (' + tasinan.length + ' sembol)'}
            variant="outline"
            tone="info"
            size="sm"
            onPress={() =>
              router.navigate({ pathname: '/analiz', params: { kiyas: tasinan.join(',') } })
            }
          />
          {disarida > 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {String(disarida) +
                ' sembol kıyasa TAŞINMIYOR: kıyas ucu bir turda en çok ' +
                String(AZAMI_SEMBOL) +
                ' sembol alıyor.'}
            </Text>
          ) : null}
        </>
      ) : (
        // İKİ SEMBOLDEN AZ: kıyas kurulamaz, düğme UMUT VERMİYOR.
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu grupta kıyaslanacak en az iki sembol yok.
        </Text>
      )}
    </View>
  );
}

/** Grup içindeki tek hisse. Ham sayılar; hiçbiri skor değil. */
function HisseSatiri({
  hisse,
  onSembol,
}: {
  hisse: SektorHisse;
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
}) {
  const { colors } = useTheme();
  const basis = hisse.basis
    ? (BASIS_METIN[hisse.basis] ?? hisse.basis)
    : 'kademe tutmadı — ÖLÇEMEDİM';

  // KİMLİK ALANLARI (uç bunları gruplandırmaya HİÇ sokmuyor, yalnız
  // yankılıyor). ÜÇ DAL AYRI: alan gövdede YOK (`undefined`) = uç
  // göndermedi · `null` = ölçülemedi · metin = basılır. Boş dizgi
  // UYDURULMUYOR.
  const ad = typeof hisse.name === 'string' && hisse.name.trim() ? hisse.name.trim() : null;
  const sanayi =
    typeof hisse.industry === 'string' && hisse.industry.trim() ? hisse.industry.trim() : null;
  const isTanimi =
    typeof hisse.bizSummary === 'string' && hisse.bizSummary.trim()
      ? hisse.bizSummary.trim()
      : null;
  // KIRPMA SESSİZ KALMIYOR: uç 400 karakterde kestiğinde bunu
  // `bizSummaryKirpik` ile bildiriyor, ekran da yazıyor.
  const kirpik = hisse.bizSummaryKirpik === true;

  const govde = (
    <View style={styles.satir}>
      <Text style={[type.smallBold, { color: colors.text }]}>
        {hisse.sym + '  '}
        <Text style={[type.micro, { color: colors.textFaint }]}>{hisse.market}</Text>
      </Text>
      {ad || sanayi ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {(ad ?? '') + (ad && sanayi ? ' · ' : '') + (sanayi ?? '')}
        </Text>
      ) : null}
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'F/K ' +
          oran(hisse.trailingPE) +
          ' · ileri F/K ' +
          oran(hisse.forwardPE) +
          ' · PEG ' +
          oran(hisse.peg)}
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'büyüme ' +
          yuzde(hisse.revenueGrowth) +
          ' · marj ' +
          yuzde(hisse.profitMargin) +
          ' · sınıflama: ' +
          basis}
      </Text>
    </View>
  );

  // TASARIM TURU 1: iş tanımı VARSAYILAN KAPALI ve BASILABİLİR ALANIN
  // DIŞINDA. İki gerekçe: (a) her hissenin altında üç satır serbest
  // metin, listeyi ölçüm listesi olmaktan çıkarıp duvara çeviriyordu;
  // (b) katlanır kapağı hisse satırının Pressable'ı İÇİNE koymak iç içe
  // dokunma hedefi olurdu — kapağa basan kullanıcı hisse sayfasına
  // gidebilirdi. Bu yüzden kapak kardeş düğüm. Kırpma notu SİLİNMEDİ:
  // kapalı hâlde özet satırında, açık hâlde tam cümle olarak duruyor.
  const tanimKapagi = isTanimi ? (
    <Katlanir baslik="İş tanımı" ozet={kirpik ? 'uç 400 karakterde KIRPTI' : 'uç kırpmadı'}>
      {/* Metin ekranda ÜÇ SATIRA sığdırılıyor (sonunda "…" görünür) ve
          bunu alttaki not AÇIKÇA yazıyor — kırpmayı sessizce yapmak,
          kullanıcıya tam metin okuttuğunu söylemek olurdu. */}
      <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={3}>
        {isTanimi}
      </Text>
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {kirpik
          ? 'İş tanımı: uç metni 400 karakterde KIRPTI; ekranda ayrıca 3 satıra sığdırıldı.'
          : 'İş tanımı: uç metni kırpmadı; ekranda 3 satıra sığdırıldı.'}
      </Text>
    </Katlanir>
  ) : null;

  if (!onSembol)
    return (
      <View style={styles.hisseKabi}>
        {govde}
        {tanimKapagi}
      </View>
    );

  return (
    <View style={styles.hisseKabi}>
      <Pressable
        onPress={() => onSembol(hisse.sym, hisse.market)}
        accessibilityRole="button"
        accessibilityLabel={hisse.sym + ' — hisse sayfasına git'}
        style={({ pressed }) => (pressed ? { backgroundColor: colors.bgPressed } : null)}>
        {govde}
      </Pressable>
      {tanimKapagi}
    </View>
  );
}

/** Sıralama çipi. Seçim RENKLE DEĞİL: başta "•" ve erişilebilirlik durumu. */
function SiraCipi({
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
      accessibilityLabel={'Sıralama: ' + etiket + (aktif ? ' — seçili' : '')}
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
  bolum: { gap: space.xxs, paddingTop: space.sm },
  grup: {
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  satir: { gap: space.xxs, paddingVertical: space.xs, paddingLeft: space.sm },
  // Hisse satırı + (varsa) iş tanımı kapağı tek grup; kapak basılabilir
  // satırın DIŞINDA (gerekçe HisseSatiri içinde).
  hisseKabi: { gap: space.xxs },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
