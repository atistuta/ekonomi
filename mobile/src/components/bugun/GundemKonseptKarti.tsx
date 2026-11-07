// =====================================================================
//  🧠 GÜNDEM KONSEPTLERİ KARTI — /api/gundem                (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: Yayıncı RSS'lerinden toplanan manşetlerin ÜSTÜNDE motorun
//  (`agendaScore`) çıkardığı KONSEPT ölçümünü basar: hangi sözcük kümesi
//  kaç manşette geçti (`n`), hangi sektöre hangi yönde bakıyor
//  (`sectors`), risk alma mı riskten kaçınma mı (`risk`), manşet akışı ne
//  yoğunlukta (`heat`), ton ve skor kaç (`tone`/`skor`).
//
//  NEDEN `PiyasaGundemiKarti`DAN AYRI KART: ikisi AYNI beslemeleri
//  okuyor ama FARKLI şeyi ölçüyor. O kart MANŞETİ gösteriyor — başlık,
//  kaynak, yaş. Bu kart aynı manşetlerden çıkan KONSEPTİ gösteriyor.
//  Tek kartta katlamak, biri ölçülürken ötekinin ÖLÇÜLMEDİĞİNİ görünmez
//  kılardı: uç (`api/_gundem.js`) ayrı bir uç, ayrı dönüyor, ayrı
//  düşüyor. Ayrıca iki ölçüm aynı kartta üst üste binince "manşet var,
//  demek ki konsept de var" yanlış çıkarımı kaçınılmaz olurdu.
//
//  NEDEN "BUGÜN" SEKMESİNDE: ölçüm SEMBOLE BAĞLI DEĞİL — uç hiçbir hisse
//  almıyor, piyasanın tamamının manşet akışını okuyor. Keşfet'in gündem
//  yüzeyleri hisse başına çalışıyor; bu yüzey oraya ait değil. Yeni
//  SEKME AÇILMADI, 5'li menü (Listeler · Bugün · Keşfet · Analiz · Arama)
//  değişmedi.
//
//  KAPSAM ÇİPİ UCUN PARAMETRESİ, EKRAN SÜZGECİ DEĞİL: TR / US / HEPSI
//  seçimi YENİ BİR ÖLÇÜM TURU başlatıyor (uç o kapsamın beslemelerini
//  okuyor). İstemcide hiçbir şey süzülmüyor, hiçbir şey yeniden
//  sıralanmıyor — `konseptler` dizisinin sırası MOTORUN sırası.
//
//  DÖRT DÜRÜST HAL (bu kartın varlık sebebi):
//    · `konseptler: []` + `bos: true` → ÖLÇTÜM, konsept çıkmadı (veri
//      cevabı; "yeniden dene" düğmesi YOK, aynı boş sonucu verir).
//    · `tam: false` → ölçüm TAMAMLANMADI, beslemelerin bir kısmı
//      okunamadı. Bu bir HATA KUTUSU DEĞİL, eksik ölçüm notu: altındaki
//      konseptler gerçek ama gündemin TAMAMI değil.
//    · `ozet.rotasyon: null` → rotasyon ÖLÇÜLMEDİ (boş nesne değil).
//    · `tone`/`skor` `null` → o konseptte ölçülemedi. ASLA `0` basılmaz:
//      sıfır ton "nötr ölçtüm" demek, ölçememek başka bir şey.
//
//  `rotasyon.hisseler` DAİMA BOŞ ve bunu bir KOD söylüyor
//  (`hisseKod: 'evren_olculmedi'`): hisse eşlemesi SABİT BİR EVREN
//  ölçümü istiyor, o AYRI ŞERİT. Boş liste basıp "eşleşme yok" demek
//  ölçülmemiş olanı ölçülmüş gibi göstermek olurdu.
//
//  CÜMLE NEREDEN: kod → cümle eşlemesi YALNIZ `lib/sozluk.ts`te
//  (`GUNDEM_*_SOZLUK`). Burada eşik, ağırlık, formül ve uydurma Türkçe
//  yorum YOK. Sözlükte olmayan kod → cümle basılmaz, kodun kendisi veya
//  "—" görünür.
//
//  TARİH: `Intl`/`toLocaleDateString` KULLANILMIYOR (Hermes'te tam
//  takvim verisi yok) — `formatHaberTarih` üzerinden geçiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchGundemKonsept,
  useIstek,
  GUNDEM_KAPSAMLAR,
  VARSAYILAN_GUNDEM_KAPSAM,
  type GundemKapsam,
  type GundemKonsept,
  type GundemKonseptBesleme,
} from '@/api';
import {
  Card,
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  Pill,
  VeriYok,
} from '@/components';
import { formatHaberTarih, formatImzaliSkor, formatOran } from '@/lib/format';
import {
  GUNDEM_EVREN_SOZLUK,
  GUNDEM_HAVA_SOZLUK,
  GUNDEM_ISI_SOZLUK,
  GUNDEM_KONSEPT_SOZLUK,
  GUNDEM_RISK_SOZLUK,
  GUNDEM_SEKTOR_SOZLUK,
  GUNDEM_TON_SOZLUK,
  GUNDEM_YON_SOZLUK,
  sozluktenSec,
} from '@/lib/sozluk';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type GundemKonseptKartiProps = {
  /** Ekranda basılacak konsept adedi. Verilmezse hepsi basılır. */
  limit?: number;
};

/** Kapsam çipinin kullanıcı metni. Uç kodu TR/US/HEPSI olarak kalıyor. */
const KAPSAM_METIN: Record<string, string> = {
  TR: 'Türkiye',
  US: 'ABD',
  HEPSI: 'Hepsi',
};

export function GundemKonseptKarti({ limit }: GundemKonseptKartiProps) {
  const { colors } = useTheme();
  const [kapsam, setKapsam] = useState<GundemKapsam>(VARSAYILAN_GUNDEM_KAPSAM);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchGundemKonsept({ kapsam, signal }),
    [kapsam],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'gundem-konsept:' + kapsam);

  const konseptler: GundemKonsept[] = veri?.konseptler ?? [];
  const besleme: GundemKonseptBesleme[] = veri?.besleme ?? [];
  const okunan = besleme.filter((b) => b.durum === 'ok').length;
  // KIRPMA EKRANDA, ÖLÇÜMDE DEĞİL: uç hepsini döndürüyor, kart `limit`
  // kadarını basıyor ve kaçını bastığını aşağıda YAZIYOR.
  const basilan = typeof limit === 'number' ? konseptler.slice(0, limit) : konseptler;
  const ozet = veri?.ozet;
  const hava = sozluktenSec(GUNDEM_HAVA_SOZLUK, ozet?.moodKod);
  const rotasyon = ozet?.rotasyon;

  return (
    <Card
      title="🧠 Gündem konseptleri"
      subtitle="Yayıncı manşetlerinden motorun çıkardığı konsept ölçümü — sembole bağlı değil">
      <View style={styles.cipler}>
        {GUNDEM_KAPSAMLAR.map((k) => (
          <KapsamCipi
            key={k}
            etiket={KAPSAM_METIN[k] ?? k}
            aktif={k === kapsam}
            onPress={() => setKapsam(k)}
          />
        ))}
      </View>

      <Durum durum={durum} hata={hata} yenile={yenile} kartsiz iskelet={3} sekil="metin" />

      {/* EKSİK ÖLÇÜM ROZETİ — HABER sayacı sürümü (`sayac` bu uçta
          `{istek, basari, hata, zamanAsimi, kisa, bayt}`; skor sayacının
          `OlcumEksikRozet`i derlemede patlar, iyi ki patlıyor). Verinin
          ÜSTÜNDE duruyor ve veriyi GİZLEMİYOR. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {/* EKSİK ÖLÇÜM NOTU KONSEPTLERİN ÜSTÜNDE: eksikliği listeyi
          okuduktan SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak
          olurdu. HATA KUTUSU DEĞİL — aşağıdaki konseptler gerçek. */}
      {durum === 'veri' && veri && veri.tam === false ? (
        <OlcemedimKutu
          metin={
            'Ölçüm tamamlanmadı: ' +
            String(besleme.length) +
            ' beslemeden ' +
            String(okunan) +
            ' tanesi okundu. Aşağıdaki konseptler OKUNABİLEN manşetlerden çıktı, gündemin tamamından DEĞİL — hangi kaynağın düştüğü "Kaynak başına ölçüm" satırlarında yazılı.'
          }
          yenile={yenile}
        />
      ) : null}

      {/* ÖZET — motorun `summary` katmanı. Her satır ÖLÇÜLMÜŞ bir sayı
          ya da kod; ölçülmeyen satır HİÇ ÇİZİLMİYOR. */}
      {durum === 'veri' && ozet ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>Gündem havası</Text>
          {hava ? (
            <Text style={[type.small, { color: colors.text }]}>{hava}</Text>
          ) : (
            <Text style={[type.small, { color: colors.textDim }]}>
              {'Hava ölçülemedi (kod: ' + String(ozet.moodKod) + ').'}
            </Text>
          )}
          <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
            {'Risk alma yönünde anılan konsept: ' +
              String(ozet.riskOn) +
              ' · riskten kaçınma yönünde: ' +
              String(ozet.riskOff) +
              ' · konsepti besleyen manşet havuzu: ' +
              String(ozet.poolN)}
          </Text>
          <SektorSatiri
            baslik="İlgi yönünde anılan sektörler"
            kodlar={ozet.upSectors}
            bosMetin="Bu turda ilgi yönünde eşiği geçen sektör çıkmadı."
          />
          <SektorSatiri
            baslik="Baskı yönünde anılan sektörler"
            kodlar={ozet.downSectors}
            bosMetin="Bu turda baskı yönünde eşiği geçen sektör çıkmadı."
          />

          {/* ROTASYON: `null` ise ÖLÇÜLMEDİ — boş liste basılmıyor. */}
          <Text style={[type.smallBold, styles.ustBosluk, { color: colors.text }]}>
            Sektör rotasyonu
          </Text>
          {rotasyon ? (
            <>
              <Text style={[type.small, { color: colors.text }]}>
                {(sozluktenSec(GUNDEM_ISI_SOZLUK, rotasyon.heat) ??
                  'manşet akışı ölçülemedi') +
                  ' · rotasyon manşeti: ' +
                  String(rotasyon.n)}
              </Text>
              {/* `hisseler` DAİMA boş; sebebini KOD söylüyor. */}
              <Text style={[type.micro, { color: colors.textFaint }]}>
                {sozluktenSec(GUNDEM_EVREN_SOZLUK, rotasyon.hisseKod) ??
                  'Hisse eşlemesi için gelen kod sözlükte yok: ' + String(rotasyon.hisseKod)}
              </Text>
            </>
          ) : (
            <Text style={[type.small, { color: colors.textDim }]}>
              Rotasyon ölçülmedi — bu turda uç rotasyon katmanı döndürmedi.
            </Text>
          )}
        </View>
      ) : null}

      {/* KAYNAK BAŞINA ÖLÇÜM — düşen besleme SESSİZCE ATILMIYOR.
          `yerel` alanı burada basılıyor: HEPSI kapsamında iki yerelin
          beslemeleri karışıyor, hangisi düştü görünmesi gerekiyor. */}
      {durum === 'veri' && besleme.length ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>Kaynak başına ölçüm</Text>
          {besleme.map((b, i) => (
            <View key={b.ad + '#' + String(i)} style={styles.kaynakSatir}>
              <Pill
                label={b.durum === 'ok' ? 'okundu' : 'ölçemedim'}
                tone={b.durum === 'ok' ? 'neutral' : 'gold'}
                glyph={null}
                size="sm"
              />
              <Text style={[type.small, { color: colors.text }]} numberOfLines={2}>
                {b.ad + ' (' + (KAPSAM_METIN[String(b.yerel)] ?? String(b.yerel)) + ')'}
              </Text>
              <View style={styles.bosluk} />
              <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
                {typeof b.adet === 'number' && Number.isFinite(b.adet)
                  ? String(b.adet) + ' manşet'
                  : '— manşet'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ÖLÇTÜM, KONSEPT ÇIKMADI — hata DEĞİL, veri cevabı. */}
      {durum === 'veri' && veri && veri.bos && !konseptler.length ? (
        <VeriYok
          metin={
            (KAPSAM_METIN[String(veri.kapsam)] ?? String(veri.kapsam)) +
            ' kapsamında okunan manşetlerden hiçbir konsept eşiği geçmedi — bu da ÖLÇÜLMÜŞ bir cevap.'
          }
          kartsiz
        />
      ) : null}

      {durum === 'veri' && basilan.length ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>
            Konseptler (sıra motorun)
          </Text>
          {basilan.map((k, i) => (
            <KonseptSatiri key={k.key + '#' + String(i)} konsept={k} />
          ))}
        </View>
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
          {'Basılan konsept: ' +
            String(basilan.length) +
            '/' +
            String(konseptler.length) +
            ' · okunan kaynak: ' +
            String(okunan) +
            '/' +
            String(besleme.length) +
            ' · ölçüm süresi: ' +
            String(veri.ms) +
            ' ms' +
            (veri.onbellek ? ' · önbellekten' : '')}
        </Text>
      ) : null}
    </Card>
  );
}

/**
 * Sektör kodu listesi satırı. Kod sözlükte yoksa KODUN KENDİSİ basılıyor
 * (uydurma Türkçe yerine ham kod), liste boşsa "ölçtüm, çıkmadı" cümlesi.
 */
function SektorSatiri({
  baslik,
  kodlar,
  bosMetin,
}: {
  baslik: string;
  kodlar: string[];
  bosMetin: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.altBolum}>
      <Text style={[type.micro, { color: colors.textDim }]}>{baslik}</Text>
      {kodlar.length ? (
        <Text style={[type.small, { color: colors.text }]}>
          {kodlar.map((s) => sozluktenSec(GUNDEM_SEKTOR_SOZLUK, s) ?? s).join(' · ')}
        </Text>
      ) : (
        <Text style={[type.small, { color: colors.textDim }]}>{bosMetin}</Text>
      )}
    </View>
  );
}

/**
 * Tek konsept. Başlık seçimi:
 *   · `yeni: true` → KEŞİFLE gelen konsept; sözlükte karşılığı YOK
 *     (anahtar `emg-<sözcük>`). `sozcuk` OLDUĞU GİBİ basılıyor ve
 *     "yeni" işareti konuyor — sözlükte arayıp "—" basmak, motorun
 *     ölçtüğü şeyi görünmez kılardı.
 *   · aksi hâlde → `GUNDEM_KONSEPT_SOZLUK[key]`; sözlükte yoksa `key`in
 *     kendisi basılıyor.
 */
function KonseptSatiri({ konsept }: { konsept: GundemKonsept }) {
  const { colors } = useTheme();
  const k = konsept;
  const ad = k.yeni
    ? k.sozcuk && k.sozcuk.length
      ? k.sozcuk
      : k.key
    : (sozluktenSec(GUNDEM_KONSEPT_SOZLUK, k.key) ?? k.key);
  const ton = sozluktenSec(GUNDEM_TON_SOZLUK, k.toneKod);
  const risk = sozluktenSec(GUNDEM_RISK_SOZLUK, k.risk);
  const isi = sozluktenSec(GUNDEM_ISI_SOZLUK, k.heat);

  return (
    <View style={styles.konsept}>
      <View style={styles.konseptBas}>
        <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={2}>
          {ad}
        </Text>
        {k.yeni ? (
          <Pill label="yeni" tone="info" glyph={null} variant="outline" size="sm" />
        ) : null}
        <View style={styles.bosluk} />
        <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
          {String(k.n) + ' manşet'}
        </Text>
      </View>

      {/* HAM SAYILAR: `null` → "—" (ölçülemedi), ASLA 0. */}
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'skor ' +
          formatImzaliSkor(k.skor) +
          ' · ton ' +
          formatOran(k.tone) +
          (ton ? ' (' + ton + ')' : '')}
      </Text>

      {isi ? <Text style={[type.small, { color: colors.text }]}>{isi}</Text> : null}
      {risk ? <Text style={[type.small, { color: colors.text }]}>{risk}</Text> : null}

      {k.sectors.length ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {k.sectors
            .map(
              ([sek, yon]) =>
                (sozluktenSec(GUNDEM_SEKTOR_SOZLUK, sek) ?? sek) +
                ' — ' +
                (sozluktenSec(GUNDEM_YON_SOZLUK, String(yon)) ?? String(yon)),
            )
            .join(' · ')}
        </Text>
      ) : null}

      {k.heads.length ? (
        <View style={styles.basliklar}>
          {k.heads.map((h, i) => (
            <BaslikSatiri
              key={(h.link || h.title) + '#' + String(i)}
              title={h.title}
              link={h.link}
              pubDate={h.pubDate}
              ageH={h.ageH}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Konseptin bir manşeti. `link` BOŞSA bağlantı ÖLÇÜLEMEDİ (uç http/https
 * dışı şemayı boşa düşürüyor) — o zaman `Pressable` değil düz metin
 * çiziliyor, dokunulabilir görünüp hiçbir şey yapmayan satır olmuyor.
 */
function BaslikSatiri({
  title,
  link,
  pubDate,
  ageH,
}: {
  title: string;
  link: string;
  pubDate: string;
  ageH: number | null;
}) {
  const { colors } = useTheme();
  const kunye =
    formatHaberTarih(pubDate) +
    (typeof ageH === 'number' && Number.isFinite(ageH)
      ? ' · ' + formatOran(ageH, 1) + ' saat önce'
      : ' · yaş ölçülemedi');

  const govde = (
    <>
      <Text style={[type.small, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>{kunye}</Text>
    </>
  );

  if (!link) return <View style={styles.baslik}>{govde}</View>;

  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(link).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={'Manşeti tarayıcıda aç: ' + title}
      hitSlop={space.xs}
      style={({ pressed }) => [
        styles.baslik,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      {govde}
    </Pressable>
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
      accessibilityLabel={'Gündem kapsamı: ' + etiket + (aktif ? ' — seçili' : '')}
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
  altBolum: { gap: space.xxs, paddingTop: space.xxs },
  ustBosluk: { paddingTop: space.sm },
  kaynakSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  konsept: { gap: space.xxs, paddingTop: space.sm },
  konseptBas: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  basliklar: { gap: space.xxs, paddingTop: space.xxs },
  baslik: { borderRadius: radius.sm, paddingVertical: space.xxs },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
