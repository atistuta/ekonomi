// =====================================================================
//  🔭 TEMA — serbest metinden hisse adayı             (ŞERİT F6 / native)
// ---------------------------------------------------------------------
//  NE: `/api/theme?q=<tema>` ucunun döndürdüğü aday listesi. Her aday
//  için sembol · pazar · şirket adı · UCUN GEREKÇE METNİ (`reason`).
//  Dördü de UÇTAN; burada eşik, ağırlık, skor, sıralama YOK — uç skor
//  döndürmüyor bile (api/types.ts `ThemeCandidate`: symbol · market ·
//  name · reason, BAŞKA ALAN YOK).
//
//  ── 200 AMA SONUÇ YOK: "boş liste" ile "ölçemedim" AYRI ────────────
//  ÖLÇÜLDÜ (client.ts `fetchTheme` başlığı, üretim 2026-10-18): anahtar
//  sunucuda yokken uç HTTP 200 ile `{candidates: [], error: 'no_key'}`
//  dönüyor. Yani `useIstek` için bu BAŞARI, kullanıcı için DEĞİL. Boş
//  listeyi "bu temayla ilgili hisse yok" diye basmak YALAN olurdu:
//  arama hiç yapılmadı. Bu yüzden iki ayrı dal var ve ayrımı `error`
//  alanı yapıyor; çevirisi de istemcide TEK YERDE (`temaKodMetni`).
//  Çeviri bu dosyaya KOPYALANMADI — iki kopya, bir gün iki ayrı cümle.
//
//  ── NEDEN GİRDİ KARTIN İÇİNDE ──────────────────────────────────────
//  Tema serbest METİN; takip listesinden ya da seçili sembolden
//  TÜRETİLEMEZ. Kart bir tema TAHMİN ETSE (ör. listedeki ilk sembolün
//  sektörü) ekranda kullanıcının sormadığı bir sorunun cevabı
//  görünürdü. Girdi boşken kart ölçüm İSTEMİYOR: `Durum`un "henüz
//  sorulmadı" dalı basılıyor.
//
//  ⚠️ AYNI UÇ 🔎 ARAMA SEKMESİNDE DE OKUNUYOR (ÖLÇÜLDÜ 2026-10-29):
//  `(tabs)/arama.tsx:121` aynı `fetchTheme`i "🔭 Tematik keşif" kartında
//  çağırıyor ve Arama ↔ Bugün arasındaki `?tema=` yol parametresi akışı
//  ORADA yaşıyor (arama.tsx:99, bugun.tsx:515). BU KART O AKIŞA
//  BAĞLANMADI: Keşfet sekmesi `tema` parametresi OKUMUYOR (ölçüldü:
//  `(tabs)/kesfet.tsx` içinde `useLocalSearchParams` yok) ve üçüncü bir
//  köprü ucu açmak o iki yönlü akışı tek taraflı bozardı. Kart kendi
//  girdisini taşıyor; `baslangicSorgu` çağıranın isteğine bırakıldı.
//
//  ── 📰 KANIT MANŞETLERİ (Ş8 #8a) ───────────────────────────────────
//  `/api/theme` hangi adayın hangi MANŞETTE geçtiğini TAŞIMIYOR; web bu
//  ilişkiyi TARAYICIDA kuruyordu (eşik + durak sözcük listesi + sembol
//  kelime-sınırı regex'i orada). Hesap MOTORA taşındı ve `/api/news`
//  kip (1)'in `&adaylar=` seçeneğiyle açıldı (yeni uç açılamadı: Vercel
//  Hobby tavanı 12 fonksiyon ve DOLU). Bu kart o yüzden İKİNCİ bir
//  çağrı yapıyor: `fetchNews(sorgu, { adaylar })`. Cevabın `tema`
//  kardeş alanı yalnız SIRA taşıyor; başlığı aynı cevabın `maddeler`
//  dizisinden okuyoruz — ikinci kopya yok, kayma imkânsız.
//
//  ⚠️ WEB'DEN AYRILDIĞI YER (BİLEREK, SAKLANMADAN): web tema haberini
//  ABD + TR beslemelerini BİRLEŞTİREREK arıyordu; `/api/news` tek
//  yerel okuyor (`market` = 'TR' | 'US', api/_haber.js `PAZAR_YERELI`).
//  Burada besleme UCUN VARSAYILANI (`VARSAYILAN_HABER_PAZAR`) bırakıldı
//  ve istemciye "hangi yerel" kuralı YAZILMADI (ör. "adayların çoğu US
//  ise US" bir eşik olurdu, §5.1). Sonuç: ABD adayının manşeti TR
//  beslemesinde geçmiyorsa satır "eşleşen manşet yok" der — bu ÖLÇÜM,
//  arıza değil; dipnot hangi yereli okuduğumuzu YAZIYOR.
//
//  DÖRT HAL AYRI ÇİZİLİYOR: `tema` alanı YOK = sormadım (hiçbir şey
//  basılmaz) · `null` = uçta motor kurulamadı (ÖLÇEMEDİM) ·
//  `adaylar[SEMBOL] = []` = ölçtüm, eşleşen manşet yok ·
//  dolu dizi = o sıraların başlıkları.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_SORGU,
  VARSAYILAN_HABER_PAZAR,
  fetchNews,
  fetchTheme,
  haberOlcumEksik,
  temaKodMetni,
  useIstek,
  type HaberMadde,
  type Market,
  type TemaHaber,
  type ThemeCandidate,
} from '@/api';
import { Card, Dugme, Durum, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { radius, space, type, useTheme } from '@/theme';

import { HaberSatiri } from './HaberSatiri';

export type TemaKartProps = {
  /**
   * Sembol dokunuşunun karşılığı çağıranın kararı; verilmezse adaylar
   * basılır ama basılabilir değildir (RadarKart ile aynı sözleşme).
   */
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
  /** Açılışta alana düşen tema. Verilmezse alan boş ve ölçüm İSTENMEZ. */
  baslangicSorgu?: string;
};

/**
 * Pazar kodunun TÜRKÇESİ. Motorun makine kodunun karşılığı
 * (api/types.ts `Market` = 'US' | 'BIST') — yeni bir pazar değil.
 * Küme dışı bir kod gelirse OLDUĞU GİBİ basılır, uydurma ad konmaz.
 */
const PAZAR_AD: Record<Market, string> = {
  US: 'ABD',
  BIST: 'Borsa İstanbul',
};

function pazarAdi(m: Market | string): string {
  return PAZAR_AD[m as Market] ?? m;
}

export function TemaKart({ onSembol, baslangicSorgu }: TemaKartProps) {
  const { colors } = useTheme();
  const bas = (baslangicSorgu ?? '').trim().slice(0, AZAMI_SORGU);
  const [metin, setMetin] = useState(bas);
  const [sorgu, setSorgu] = useState(bas);

  const cagri = useCallback((signal: AbortSignal) => fetchTheme(sorgu, { signal }), [sorgu]);
  const { durum, veri, hata, yenile } = useIstek(cagri, 'tema:' + sorgu, {
    etkin: sorgu.length > 0,
  });

  // 200 + `error` = ÖLÇEMEDİM. Çeviri istemcide tek yerde (`temaKodMetni`).
  const kod = temaKodMetni(veri?.error);
  const adaylar: ThemeCandidate[] = veri?.candidates ?? [];

  // ── İKİNCİ ÇAĞRI: kanıt manşetleri (bkz. başlık) ───────────────────
  // Aday YOKSA istek HİÇ kurulmuyor: sorulmayan sorunun cevabı
  // ekranda görünmez. Anahtara sembolleri de koyuyoruz — aday kümesi
  // değişince eski eşleşmeyi yeni listeye basmak YANLIŞ olurdu.
  const semboller = adaylar.map((a) => a.symbol).join(',');
  const hcagri = useCallback(
    (signal: AbortSignal) => fetchNews(sorgu, { adaylar, signal }),
    // `adaylar` her cevapta YENİ dizi; kimliği `semboller` taşıyor —
    // bağımlılığa koymak her oluşturmada yeniden istek demekti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sorgu, semboller],
  );
  const { durum: hdurum, veri: hveri } = useIstek(hcagri, 'temahaber:' + sorgu + ':' + semboller, {
    etkin: sorgu.length > 0 && adaylar.length > 0,
  });

  // `undefined` = sormadım · `null` = uçta motor kurulamadı.
  const kanit: TemaHaber | null | undefined = hdurum === 'veri' ? hveri?.tema : undefined;
  const maddeler: HaberMadde[] = hveri?.maddeler ?? [];
  // Haber tarafı KISMEN okunduysa bunu yazıyoruz: eksik beslemeden
  // gelmeyen manşet "eşleşme yok" gibi görünürdü.
  const hEksik = hdurum === 'veri' && haberOlcumEksik(hveri);
  const hHata = hdurum === 'hata';

  return (
    <Card
      title="🔭 Tema"
      subtitle={
        sorgu
          ? sorgu + ' · /api/theme — aday listesi, al/sat işareti değil'
          : 'Bir tema yaz — aday listesi, al/sat işareti değil'
      }>
      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder="Örn. yapay zeka, savunma, robotik"
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        maxLength={AZAMI_SORGU}
        returnKeyType="search"
        onSubmitEditing={() => setSorgu(metin.trim())}
        accessibilityLabel="Tema arama alanı"
        style={[
          styles.alan,
          type.body,
          {
            color: colors.text,
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
      />
      <Dugme
        label="Tema ara"
        variant="outline"
        tone="info"
        onPress={() => setSorgu(metin.trim())}
        disabled={!metin.trim()}
      />

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={2}
        sekil="metin"
        bosMetin="Tema henüz sorulmadı — bir tema yaz ve “Tema ara”ya bas."
      />

      {durum === 'veri' ? (
        kod ? (
          // ÖLÇEMEDİM: 200 geldi ama arama HİÇ yapılmadı (bkz. başlık).
          // "Yeniden dene" düğmesi BİLEREK YOK: tekrar aynı 200'ü verir.
          <OlcemedimKutu metin={kod} />
        ) : !adaylar.length ? (
          <VeriYok kartsiz metin={'“' + sorgu + '” için motor aday döndürmedi.'} />
        ) : (
          <>
            {adaylar.map((a) => (
              <AdaySatiri
                key={a.market + ':' + a.symbol}
                aday={a}
                onSembol={onSembol}
                kanit={kanit}
                maddeler={maddeler}
                kanitHata={hHata}
              />
            ))}
            {/* Aday sayısı UCUN döndürdüğü satır sayısı; burada süzme yok. */}
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {adaylar.length +
                ' aday uçtan geldi' +
                (veri?.model ? ' · model ' + veri.model : '') +
                '. Bu bir aday listesidir; sıralama, skor ve eşik taşımaz.'}
            </Text>
            {/* Manşet dipnotu: hangi yerel okundu, ilgi ölçülebildi mi.
                Sayılar UCUN cevabından; burada hesap YOK. */}
            {kanit === null ? (
              <OlcemedimKutu metin="Kanıt manşetleri uçta ölçülemedi — motor kurulamadı." />
            ) : kanit ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {'📰 ' +
                  VARSAYILAN_HABER_PAZAR +
                  ' beslemesinden ' +
                  maddeler.length +
                  ' manşet okundu' +
                  (kanit.sozcukler.length
                    ? ' · ilgi sözcükleri: ' + kanit.sozcukler.join(', ')
                    : ' · bu sorgudan ilgi sözcüğü ayıklanamadı, manşetler SÜZÜLMEDİ') +
                  (kanit.ilgisiz.length ? ' · ' + kanit.ilgisiz.length + ' manşet ilgisiz sayıldı' : '') +
                  (hEksik ? ' · beslemelerin bir kısmı okunamadı' : '') +
                  '. Web bu aramayı ABD + TR beslemelerini birleştirerek yapıyordu; burada tek yerel okunuyor.'}
              </Text>
            ) : null}
          </>
        )
      ) : null}
    </Card>
  );
}

/**
 * Tek aday. Dört bilgi de UÇTAN: sembol, pazar kodu, şirket adı ve
 * gerekçe metni. `name`/`reason` `null` gelebilir — boş dizge BASILMAZ,
 * satır o alanı hiç çizmez ya da eksikliğini yazar.
 */
function AdaySatiri({
  aday,
  onSembol,
  kanit,
  maddeler,
  kanitHata,
}: {
  aday: ThemeCandidate;
  /**
   * Satıra dokunulunca çağrılır. `pazar` İKİNCİ PARAMETRE (TASARIM
   * TURU 2): bu satırın pazar kodu uçtan geliyor ve hisse ekranı onu
   * `.IS` ekini koymak için kullanıyor; düşürülürse BIST sembolü ABD'de
   * ölçülüyor (ölçüm: `app/hisse/[sembol].tsx` başlığı).
   */
  onSembol?: (sym: string, pazar?: string | null) => void;
  /**
   * `/api/news` kardeş alanı. `undefined` = kanıt SORULMADI (ya da
   * cevap henüz gelmedi) · `null` = uçta motor kurulamadı.
   */
  kanit?: TemaHaber | null;
  /** Kanıtın SIRA taşıdığı dizi — başlık BURADAN okunuyor, kopya yok. */
  maddeler?: HaberMadde[];
  /** Haber çağrısı başarısız oldu: "eşleşme yok" demek YANLIŞ olurdu. */
  kanitHata?: boolean;
}) {
  const { colors } = useTheme();

  // Anahtar İSTEMCİNİN GÖNDERDİĞİ HAM SEMBOL (uç sözleşmesi:
  // api/news.js `temaKatmani`) — `/api/theme`ten gelen `symbol` ne ise o.
  const siralar = kanit ? kanit.adaylar[aday.symbol] : undefined;
  const liste = (siralar ?? [])
    .map((i) => (maddeler ?? [])[i])
    .filter((m): m is HaberMadde => !!m);

  const govde = (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {aday.symbol}
        </Text>
        <View style={styles.bosluk} />
        <Pill label={pazarAdi(aday.market)} tone="neutral" variant="outline" glyph={null} size="sm" />
      </View>

      {aday.name ? (
        <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={2}>
          {aday.name}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Şirket adı uçtan gelmedi.
        </Text>
      )}

      {aday.reason ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'gerekçe (uçtan): ' + aday.reason}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Uç bu aday için gerekçe yazmadı.
        </Text>
      )}

      {/* DÖRT HAL: `kanit` yok = sormadım/henüz gelmedi → hiçbir şey
          basılmaz · haber çağrısı hata = ölçemedim · `siralar` boş dizi
          = ölçtüm, eşleşme yok · dolu = başlıklar. */}
      {kanitHata ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Kanıt manşetleri okunamadı.
        </Text>
      ) : !kanit ? null : liste.length ? (
        <View style={styles.kanit}>
          {liste.map((m, i) => (
            <HaberSatiri key={(m.link || m.title) + ':' + i} madde={m} />
          ))}
        </View>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Bu adayla eşleşen manşet yok.
        </Text>
      )}
    </View>
  );

  if (!onSembol) return govde;

  return (
    <Pressable
      onPress={() => onSembol(aday.symbol, aday.market)}
      accessibilityRole="button"
      accessibilityLabel={aday.symbol + ' — hisse sayfasına git'}
      style={({ pressed }) => (pressed ? { backgroundColor: colors.bgPressed } : null)}>
      {govde}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  kanit: { gap: space.xxs, paddingLeft: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
});
