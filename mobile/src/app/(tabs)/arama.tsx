// =====================================================================
//  ARAMA — 5. sekme, MOTORA BAĞLI                     (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: iki iş, tek alan: (1) sembol ölç → /api/recommend, sonucu
//  takip listesine ekle; (2) tema ara → /api/theme (🔭 tematik keşif).
//
//  (3) ÇOK PAZARLI ADAY LİSTESİ → /api/arama (🔎 Adaylar kartı):
//  yazılan terim için kripto + ABD + BIST adayları, her biri NE OLDUĞU
//  yazılı; seçimi KULLANICI yapıyor. NEDEN: çıplak bir terimin pazarı
//  ÖLÇÜLMEDEN BİLİNEMEZ — eskiden sunucu tahmin ediyordu ve çıplak
//  `ASELS` sessizce `US` sayılıp skor `null` dönüyordu. Kart kendi
//  ucuna gidiyor, kendi gecikmesini/iptalini taşıyor.
//
//  NEDEN TEK ALAN İKİ DÜĞME: web'de de "🔎 Arama" sekmesi hem sembol
//  hem tema girişi; 5 menü düzeni korunuyor, yeni sekme açılmıyor.
//  Hangi işin istendiğini TAHMİN ETMİYORUZ (metinde nokta var mı diye
//  bakmak sessiz bir sezgi olurdu) — kullanıcı düğmeyle söylüyor.
//
//  NEDEN TEMA SONUCU BOŞKEN "ölçemedim" YAZIYOR: ÖLÇÜLDÜ (2026-10-18)
//  → üretimde /api/theme 200 ile `{"candidates":[],"error":"no_key"}`
//  dönüyor (ANTHROPIC_API_KEY sunucuda yok). Boş listeyi "sonuç yok"
//  diye göstermek YALAN olurdu: aranmadı. `client.ts`in `temaKodMetni`
//  çevirisi bu ayrımı taşıyor.
//
//  NEDEN BİR DE 📰 TEMA HABERLERİ KARTI VAR: aynı tema için manşetler
//  (/api/news) ayrı bir uçta duruyor; aynı ekranda görünmezse kullanıcı
//  "ilişkili hisseler" ile "temanın haberleri" arasında iki ekran
//  gezinir. Kart AYNI `temaSorgu` ile besleniyor — iki uç, tek tema.
//
//  HİSSE↔HABER İLİŞKİSİ UÇTAN GELMİYOR: ÖLÇÜLDÜ 2026-10-25 —
//  /api/theme yalnız {symbol, market, name, reason}, /api/news yalnız
//  manşet maddeleri döndürüyor; "bu manşet şu hisseyi destekliyor"
//  bilgisi HİÇBİR uçta yok. Başlık metninde sembol/şirket adı aramak
//  İSTEMCİDE HESAP olurdu (native kuralı) — o yüzden kart eşleşme
//  İDDİA ETMİYOR ve bunu ekranda açıkça yazıyor.
//
//  KÖPRÜ: 📡 Bugün ekranındaki 🔭 tematik haber arama alanı ile bu ekran
//  `tema` yol parametresiyle bağlı — iki yönde de aynı tema taşınıyor.
//
//  ── 🕘 SON ARAMALAR: CİHAZ-YEREL, AĞ TURU YOK ──────────────────────
//  Depo katmanı ZATEN VARDI (`api/depo.ts`: `aramalarDepo` · `AZAMI_ARAMA`
//  = 12 · `aramaHatirla()`), ama HİÇBİR ekran okumuyordu (ölçüldü: bu
//  simgeler yalnız `depo.ts` ve `api/index.ts` içinde geçiyordu). Bu
//  ekran onları kullanıyor; YENİ BAĞIMLILIK EKLENMEDİ (sürücü depo
//  katmanının kendi sürücüsü), yeni uç ÇAĞRILMADI.
//
//  NEDEN YALNIZ "Sembol ölç" KAYDEDİLİYOR: depo kaydı `{symbol, market}`.
//  Tema metni sembol DEĞİL ve pazarı ÖLÇÜLMEMİŞTİR; 'yapay zeka'yı
//  sembol gibi yazmak uydurma kayıt olurdu. Ekranda bu AÇIKÇA yazıyor.
//
//  KAYIT SUNUCUYA GİTMİYOR: `aramalarDepo` cihaz deposu; temizleme de
//  cihazda (`aramalarDepo.temizle()`).
//
//  NEDEN SEMBOL SONUCU TEK SATIR: istek tek sembolle gidiyor; sözleşme
//  sınırı 8 ve o sınır listenin işi (bkz. api/liste.ts).
//
//  BURADA HESAP YOK: fiyat/skor/bant uçtan; ekleme sınırı bile motor
//  sözleşmesinden (AZAMI_SEMBOL) okunuyor.
//
//  ── SIRALAMA KURALI (TASARIM TURU 2) ───────────────────────────────
//  1) Girdi (sembol/tema kutusu) — ekranın işi aramak
//  2) Cihazdaki geçmiş: son aramalar
//  3) Ölçüm sonuçları: aday · sembol sonucu
//  4) Tematik keşif ve tema haberleri (girdi bekleyen yüzeyler) en sonda
//  ÖLÇÜLDÜ 2026-10-31: bu sekme kurala ZATEN UYUYOR; kart taşınmadı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_ARAMA,
  AZAMI_HABER_SORGU,
  AZAMI_SEMBOL,
  aramaHatirla,
  aramalarDepo,
  ekle,
  fetchNews,
  fetchRecommend,
  fetchTheme,
  haberOlcumEksik,
  temaKodMetni,
  useAramalar,
  useIstek,
  useListe,
  useTurHazir,
  type AramaKaydi,
  type HaberMadde,
} from '@/api';
import {
  Card,
  Dugme,
  Durum,
  HaberOlcumEksikRozet,
  Katlanir,
  OlcemedimKutu,
  OlcumEksikRozet,
  Pill,
  ScreenShell,
  TickerRow,
  VeriYok,
} from '@/components';
import { AdayKarti } from '@/components/arama';
import { DuyarlilikOzeti, HaberSatiri } from '@/components/kesfet';
import { formatPrice, formatScore } from '@/lib/format';
import { hisseAc } from '@/lib/gezinme';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export default function AramaScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  // 📡 Bugün ekranından gelen tema: alan ONUNLA doluyor ve 🔭 keşif
  // kendi kendine koşuyor — kullanıcı aynı temayı iki kez yazmasın.
  // `useEffect` yerine "son görülen parametre" deseni: efektle yazmak
  // bir kare eski metni gösterirdi.
  //
  // ── TAZE MOUNT TUZAĞI (ÖLÇÜLDÜ 2026-10-25, 127.0.0.1:8081) ──
  // Önceki hâlde `sonGelen` başlangıç değeri `gelenTema` idi. Bugün'den
  // gelindiğinde bu ekran İLK KEZ parametre ZATEN doluyken kuruluyor,
  // dolayısıyla `gelenTema !== sonGelen` daha ilk karede yanlış oluyor ve
  // tema alana HİÇ düşmüyordu: URL `?tema=savunma sanayi` olurken ekranda
  // "Bir tema yaz" yazıyordu. Düzeltme: içerik durumları doğrudan
  // `gelenTema` ile tohumlanıyor, `sonGelen` de aynı değerle — böylece ilk
  // kare dolu geliyor, sonraki parametre DEĞİŞİMLERİ ise yine yakalanıyor.
  const params = useLocalSearchParams<{ tema?: string }>();
  const gelenTema = (params.tema ?? '').trim().slice(0, AZAMI_HABER_SORGU);

  const [metin, setMetin] = useState(gelenTema);
  const [sembolSorgu, setSembolSorgu] = useState('');
  const [temaSorgu, setTemaSorgu] = useState(gelenTema);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const [sonGelen, setSonGelen] = useState(gelenTema);
  if (gelenTema && gelenTema !== sonGelen) {
    setSonGelen(gelenTema);
    setMetin(gelenTema);
    setTemaSorgu(gelenTema);
  }

  /**
   * "Sembol ölç" tek kapı: isteği açar VE cihaz kaydını yazar. İki çağrı
   * yeri (düğme + klavye) aynı kapıdan geçiyor ki biri kaydetmeyi
   * unutmasın. Yazma sonucu SESSİZCE YUTULMUYOR: kota/özel pencere
   * yüzünden yazılamazsa sebep bildirim satırına düşüyor (`YazSonuc`).
   */
  const olc = useCallback((ham: string) => {
    const sembol = ham.trim().toUpperCase();
    if (!sembol) return;
    setSembolSorgu(sembol);
    void aramaHatirla(sembol).then((sonuc) => {
      if (!sonuc.ok) setBildirim(sonuc.mesaj);
    });
  }, []);

  const sembolCagri = useCallback(
    (signal: AbortSignal) => fetchRecommend([sembolSorgu], { vade: 'orta', signal }),
    [sembolSorgu],
  );
  const sembolIstek = useIstek(sembolCagri, sembolSorgu, { etkin: sembolSorgu.length > 0 });

  const temaCagri = useCallback(
    (signal: AbortSignal) => fetchTheme(temaSorgu, { signal }),
    [temaSorgu],
  );
  const temaIstek = useIstek(temaCagri, temaSorgu, { etkin: temaSorgu.length > 0 });

  const satir = sembolIstek.veri?.sonuclar?.[0] ?? null;
  const temaKod = temaKodMetni(temaIstek.veri?.error);
  const adaylar = temaIstek.veri?.candidates ?? [];

  return (
    <ScreenShell
      title="Arama"
      subtitle="Sembol ölç ya da tema ara — ikisi de motor API'den."
      note={'Takip listesi tek turda en çok ' + AZAMI_SEMBOL + ' sembol taşır (motor sözleşmesi).'}>
      <Card title="Sembol / tema" subtitle="Ne istediğini düğmeyle söyle">
        <TextInput
          value={metin}
          onChangeText={(t) => {
            setMetin(t);
            setBildirim(null);
          }}
          placeholder="Örn. THYAO.IS, NVDA ya da yapay zeka"
          placeholderTextColor={colors.textFaint}
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => olc(metin)}
          accessibilityLabel="Sembol ya da tema arama alanı"
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
        <View style={styles.dugmeler}>
          <Dugme
            label="Sembol ölç"
            onPress={() => olc(metin)}
            disabled={!metin.trim()}
          />
          <Dugme
            label="Tema ara"
            variant="outline"
            tone="info"
            onPress={() => setTemaSorgu(metin.trim())}
            disabled={!metin.trim()}
          />
        </View>
        {bildirim ? (
          <Text style={[type.micro, { color: colors.textDim }]}>{bildirim}</Text>
        ) : null}
        {/* ÇIPLAK SEMBOLÜN PAZARI ÖLÇÜLMEDEN BİLİNEMEZ: 'Sembol ölç'
            düğmesi metni TEK sembol olarak motora yolluyor ve pazarı
            sunucu seçiyor (ÖLÇÜLDÜ: çıplak `ASELS` → `US` → skor
            `null`). Doğru yol aşağıdaki aday listesi. */}
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Pazarı bilmiyorsan aşağıdaki 🔎 Adaylar listesinden seç — kripto, ABD ve BIST ' +
            'birlikte aranır, pazar TAHMİN EDİLMEZ.'}
        </Text>
      </Card>

      {/* Son aramalar AĞ TURU AÇMIYOR: cihaz deposundan okuyor. Aday
          listesinin ÜSTÜNDE, çünkü "yine aynı sembol" en kısa yol. */}
      <SonAramalarKarti
        onSec={(sembol) => {
          setMetin(sembol);
          setBildirim(null);
          olc(sembol);
        }}
      />

      {/* Gecikme, iptal ve tüm dallar (pazar ölçülemedi · motor yok ·
          ölçüm tamamlanmadı · eşleşme yok) kartın İÇİNDE. */}
      <AdayKarti terim={metin} />

      <Card
        title="Sembol sonucu"
        subtitle={sembolSorgu ? sembolSorgu + ' · /api/recommend' : 'Henüz ölçüm istenmedi'}>
        {/* `kartsiz`: zaten bir `Card` içindeyiz. Hatalı sembol girişi
            (`bad-request`) ARTIK ayrı kutu: bu ekranda en sık görülen
            hata o ve eskiden "ölçemedim" + işe yaramayan "Yeniden dene"
            düğmesi alıyordu — oysa 400'ü tekrarlamak aynı 400'ü verir,
            düzeltilmesi gereken şey yazılan metin. */}
        <Durum
          durum={sembolIstek.durum}
          hata={sembolIstek.hata}
          yenile={sembolIstek.yenile}
          iskelet={1}
          sekil="satir"
          kartsiz
          bosMetin="Bir sembol yaz ve 'Sembol ölç'e bas."
        />
        {sembolIstek.durum === 'veri' ? (
          satir ? (
            <>
              <OlcumEksikRozet kaynak={satir} />
              <TickerRow
                symbol={satir.sym}
                name={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD'}
                price={satir.plan?.seviye?.price ?? satir.fa.price}
                currency={satir.market === 'BIST' ? 'TRY' : null}
                changePct={null}
                // `pazar`: uc BIST sembolunu sonek SILEREK donduruyor; detay
                // ekrani bu bilgiyle `.IS`'i geri kazaniyor (bkz. o ekran).
                // TASARIM TURU 2: tek gezinme kalibi (`lib/gezinme.ts`).
                onPress={() => hisseAc(satir.sym, satir.market)}
                right={
                  <View style={styles.sag}>
                    {/* `right` verilince TickerRow fiyati kendi basmiyor. */}
                    <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
                      {formatPrice(
                        satir.plan?.seviye?.price ?? satir.fa.price,
                        satir.market === 'BIST' ? 'TRY' : null,
                      )}
                    </Text>
                    <Pill
                      label={'Bileşke ' + formatScore(satir.composite.blendedShown)}
                      tone={typeof satir.composite.blendedShown === 'number' ? 'info' : 'neutral'}
                      glyph={null}
                      size="sm"
                    />
                  </View>
                }
              />
              <Text style={[type.micro, { color: colors.textDim }]}>
                {satir.composite.band ?? 'Bant ölçülemedi.'}
              </Text>
              <Dugme
                label={liste.includes(satir.sym) ? 'Listede' : 'Listeye ekle'}
                size="sm"
                disabled={liste.includes(satir.sym)}
                onPress={() => {
                  const s = ekle(satir.sym);
                  setBildirim(s.ok ? s.sembol + ' listeye eklendi.' : s.mesaj);
                }}
              />
            </>
          ) : (
            <VeriYok kartsiz metin={sembolSorgu + ' için motor sonuç döndürmedi.'} />
          )
        ) : null}
      </Card>

      <Card
        title="🔭 Tematik keşif"
        subtitle={temaSorgu ? temaSorgu + ' · /api/theme' : 'Bir tema yaz ve "Tema ara"ya bas'}>
        <Durum
          durum={temaIstek.durum}
          hata={temaIstek.hata}
          yenile={temaIstek.yenile}
          iskelet={2}
          sekil="metin"
          kartsiz
          bosMetin="Örn. 'yapay zeka', 'savunma', 'robotik'."
        />
        {temaIstek.durum === 'veri' ? (
          temaKod ? (
            // ÖLÇÜLEMEDİ: uç 200 döndü ama arama hiç yapılmadı (anahtar yok).
            //
            // NEDEN BURADA ELLE PILL ÇİZİLMİYOR ARTIK: bu, `Durum`un
            // 'unmeasured' kutusunun altıncı kopyasıydı — aynı olayın
            // ayrı bir anlatımı, kendi "yeniden dene" kuralıyla (hiç
            // yoktu). `Durum`a 'unmeasured' türünde uydurma bir
            // `ApiError` beslemiyoruz; HTTP 200 geldi, hata nesnesi
            // taşımak yalan olurdu. Kutuyu `OlcemedimKutu` ile aynı
            // gövdeden kuruyoruz: tek görünüm, tek kural.
            <OlcemedimKutu metin={temaKod} />
          ) : adaylar.length ? (
            adaylar.map((a) => (
              <View key={a.symbol} style={styles.aday}>
                <Text style={[type.smallBold, { color: colors.text }]}>
                  {a.symbol + (a.name ? ' · ' + a.name : '')}
                </Text>
                {a.reason ? (
                  <Text style={[type.micro, { color: colors.textDim }]}>{a.reason}</Text>
                ) : null}
                <Dugme
                  label="Listeye ekle"
                  size="sm"
                  variant="outline"
                  tone="neutral"
                  disabled={liste.includes(a.symbol)}
                  onPress={() => {
                    const s = ekle(a.symbol);
                    setBildirim(s.ok ? s.sembol + ' listeye eklendi.' : s.mesaj);
                  }}
                />
              </View>
            ))
          ) : (
            <VeriYok kartsiz metin="Bu tema için motor aday döndürmedi." />
          )
        ) : null}
      </Card>

      <TemaHaberleriKarti sorgu={temaSorgu} />
    </ScreenShell>
  );
}

/**
 * 🕘 SON ARAMALAR — cihaz deposu, UÇ YOK.
 *
 * NE: `aramalarDepo` kayıtları (`{symbol, market}`, en yeni başta, sınır
 * `AZAMI_ARAMA`). Satıra basmak aynı sembolü yeniden ÖLÇTÜRÜYOR.
 *
 * ÜÇ DAL AYRI: depo okuması BİTMEDİ (kayıt var mı bilinmiyor) · okundu
 * ve kayıt YOK (ölçülmüş "boş") · kayıt var. Boş liste 0 kayıt diye
 * sunulmuyor, okuma bitmeden "yok" YAZILMIYOR.
 *
 * `market` ALANI UÇTAN DEĞİL: depo katmanı `.IS` sonekine bakıp
 * yazıyor (`depo.ts` `pazarOf`, biçim eşlemesi). Burada ham basılıyor,
 * yeniden türetilmiyor.
 *
 * BURADA HESAP YOK: sıralama ve sınır deponun, satırda sayı yok.
 */
function SonAramalarKarti({ onSec }: { onSec: (sembol: string) => void }) {
  const { colors } = useTheme();
  const aramalar = useAramalar();
  const hazir = useTurHazir(aramalarDepo);

  return (
    <Card
      title="🕘 Son aramalar"
      subtitle={'Bu cihazda saklanır · en çok ' + AZAMI_ARAMA + ' kayıt · sunucuya gitmez'}
      right={
        hazir && aramalar.length ? (
          <Pill label={aramalar.length + ' kayıt'} tone="neutral" glyph={null} size="sm" />
        ) : null
      }>
      {!hazir ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          Cihaz kaydı okunuyor — kayıt olup olmadığı henüz BİLİNMİYOR.
        </Text>
      ) : aramalar.length === 0 ? (
        <VeriYok kartsiz metin="Bu cihazda ölçülmüş sembol araması yok." />
      ) : (
        <>
          <View style={styles.dugmeler}>
            {aramalar.map((k: AramaKaydi) => (
              <Dugme
                key={k.market + ':' + k.symbol}
                label={k.symbol + ' · ' + k.market}
                size="sm"
                variant="outline"
                tone="neutral"
                onPress={() => onSec(k.symbol)}
              />
            ))}
          </View>
          <Dugme
            label="Son aramaları temizle"
            size="sm"
            variant="outline"
            tone="info"
            // Kayıt SİLİNİYOR (boş dizi yazmak değil): depo kaydı
            // kaldırılıyor, bellek boşa dönüyor (`TurDepo.temizle`).
            onPress={() => {
              void aramalarDepo.temizle();
            }}
          />
        </>
      )}

      {/* TASARIM: bu not kartın NEDEN'i, ÖLÇÜMÜ değil; her açılışta iki
          satır yer kaplıyordu. VARSAYILAN KAPALI — metin AYNEN korundu,
          silinmedi. */}
      <Katlanir baslik="Hangi aramalar kaydedilir?" ozet="yalnız ölçülmüş semboller">
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Yalnız “Sembol ölç” ile ölçülen semboller kaydediliyor. Tema metni sembol DEĞİL ve ' +
            'pazarı ölçülmemiştir — tema aramaları buraya YAZILMIYOR.'}
        </Text>
      </Katlanir>
    </Card>
  );
}

/**
 * 📰 TEMA HABERLERİ — `/api/news`, aynı tema.
 *
 * NEDEN AYRI İSTEK: 🔭 keşif turu (/api/theme) yavaş ve anahtara bağlı;
 * manşetler onu beklemesin, o da manşetleri beklemesin. Kendi
 * `useIstek`i var (Bugün'deki kartlarla aynı desen).
 *
 * NEDEN EŞLEŞME İDDİA EDİLMİYOR: dosya başlığındaki ÖLÇÜLDÜ notu —
 * hisse↔manşet ilişkisi hiçbir uçtan gelmiyor, istemcide kurmak hesap
 * olurdu. Kart bunu ekranda yazıyor.
 *
 * BURADA HESAP YOK: manşet sayısı, sayaçlar ve tarihler uçtan.
 */
function TemaHaberleriKarti({ sorgu }: { sorgu: string }) {
  const { colors } = useTheme();

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
      title="📰 Tema haberleri"
      subtitle={sorgu ? sorgu + ' · /api/news' : 'Tema arandığında manşetler buraya gelir'}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Bir tema yaz ve 'Tema ara'ya bas — manşetler de aynı temayla gelir."
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          sonra öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri && eksik ? (
        <OlcemedimKutu
          metin={
            'Manşet taraması TAMAMLANMADI — ' +
            (veri.uyari ?? 'uç tam tarama bildirmedi') +
            '. Aşağıdaki başlıklar gelenlerin tamamı değil.'
          }
          yenile={yenile}
        />
      ) : null}

      {/* DUYARLILIK ÖZETİ — ucun `duyarlilik` katmanı (api/news.js).
          Alan HİÇ gelmediyse bileşen hiçbir şey basmıyor; `null` ise
          "ölçemedim" der. Manşetler bu ölçüme BAĞLI DEĞİL. */}
      {durum === 'veri' && !eksik ? <DuyarlilikOzeti duyarlilik={veri?.duyarlilik} /> : null}

      {durum === 'veri' && veri && veri.adet === 0 && !eksik ? (
        <VeriYok
          kartsiz
          metin={'“' + sorgu + '” için uç manşet bulamadı — bu da ÖLÇÜLMÜŞ bir cevap.'}
        />
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
        {'Bu başlıklar TEMANIN manşetleri. Hangi manşetin yukarıdaki hangi hisseyi ' +
          'desteklediği UÇTAN GELMİYOR — eşleşme iddia edilmiyor.'}
      </Text>

      <Dugme
        label="📡 Bugün ▸ tematik başlık aramasında aç"
        variant="outline"
        tone="info"
        size="sm"
        // AYNI TEMA, AYNI PARAMETRE: Bugün ekranı `tema`yı okuyup aynı
        // ucu (/api/news) aynı sorguyla koşturuyor.
        onPress={() => router.navigate({ pathname: '/bugun', params: { tema: sorgu } })}
        disabled={!sorgu}
        style={{ marginTop: space.md }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    // Dokunma hedefi: tek elle rahat ulaşılsın (bkz. layout.ts hitSlopMin).
    minHeight: hitSlopMin,
  },
  dugmeler: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  sag: { alignItems: 'flex-end', gap: space.xxs },
  aday: { gap: space.xxs, paddingVertical: space.sm },
  haberler: { paddingTop: space.xs },
});
