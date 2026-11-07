// =====================================================================
//  /hisse/[sembol] — hisse detay ekranı              (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: tek hissenin tam künyesi: başlık şeridi (sembol · pazar · fiyat ·
//  bileşke skor), 📈 teknik, 📊 temel, 📓 tez ve ⚖️ risk/ödül kartları —
//  beşi TEK `fetchAnalyze` turundan. Altıncı kart 🕰️ geçmiş ölçümü
//  (`/api/backtest`) ve metal sembollerinde 🏷️ değer ölçümü
//  (`/api/deger`) KENDİ uçlarını çağırıyor; gerekçeleri kartlarında.
//
//  NEDEN AYRI ROTA, SEKME DEĞİL: webdeki hisse sayfasının karşılığı bu.
//  Listeler/Arama/Fırsatlar ekranlarının her biri "bir sembole git"
//  diyecek; hedefin paylaşılabilir bir adresi (`/hisse/AAPL`) olması
//  gerek. Sekme olsaydı derin bağlantı (push bildirimi → hisse) sekme
//  durumuna bağlı kalırdı.
//
//  NEDEN TEK İSTEK: `analyze` ucu sözleşme gereği score ⊂ recommend ⊂
//  analyze kümelemesini TEK kayıtta döndürüyor (api/types.ts). Beş kart
//  için beş istek atmak aynı veriyi beş kez ölçmek, dahası kartların
//  farklı turlardan beslenip birbiriyle çelişmesi olurdu.
//
//  VADE ARTIK SEÇİLEBİLİR (eski not düştü): bu ekran vadeyi 'orta'ya
//  SABİTLİYORDU ve gerekçesi "vade seçici Analiz sekmesinin işi"
//  diyordu. Ölçüldü: motor DÖRT pencere taşıyor (gunici · kisa · orta ·
//  uzun, `api/_ayar.js` VADELER) ve `/api/analyze` ile `/api/backtest`
//  ikisi de `vade` alıyor — sabit değer, motorun üç penceresini
//  ekrandan tamamen siliyordu. Seçici `VadeSecici` komponenti, cümlesi
//  `lib/sozluk.ts`; VARSAYILAN HÂLÂ 'orta'.
//
//  ÖNBELLEK ANAHTARI VADEYİ TAŞIYOR: `useIstek` anahtarı çıplak
//  `sembol` idi. Vade eklenince anahtar genişletilmek ZORUNDAYDI —
//  yoksa vade değiştirildiğinde önceki vadenin önbellekli satırı
//  basılır ve ekran yeni vadeyi gösterdiğini SANIRDI.
//
//  'gunici' vadede teknik ayak koşmaz ve plan `null` gelir; ekran bunu
//  dürüstçe söylüyor (RiskOdulKart) ve seçicinin altındaki not da
//  söylüyor — boş kart arıza sanılmasın.
//
//  NEDEN `ScreenShell`: zorunlu yasal uyarıyı (`Disclaimer`) ekranın en
//  altında kendisi basıyor; burada elle yerleştirmek, bir gün uyarının
//  metni değiştiğinde iki yeri aynı tutma borcu demekti.
//
//  ── `.IS` GERİ KAZANIMI (ÖLÇÜLDÜ 2026-10-25, üretim) ──
//  Uç noktalar BIST satırını sonek SİLEREK döndürüyor: takip listesi
//  `THYAO.IS` tutarken `/api/recommend` ve `/api/analyze` `sym:"THYAO"`
//  + `market:"BIST"` veriyor. Çıplak sembolle geri sormak AYNI ŞEY
//  DEĞİL — ölçüldü:
//    /api/analyze?symbols=THYAO     -> market US   · ta null · fa null · tam false
//    /api/analyze?symbols=THYAO.IS  -> market BIST · ta 29.390464 · fa 62.340295 · tam true
//  Yani sekmelerden gelen `sym` ile istek atmak BIST hisselerinde BOŞ
//  bir detay ekranı açıyordu. Çözüm burada, TEK yerde: gelen sembolü
//  kullanıcının listesindeki yazımına geri eşliyoruz (dört çağrı
//  yerinin her birine ayrı yama atmak, beşincisi eklendiğinde yine
//  sessizce bozulurdu).
//
//  BU EŞLEŞTİRME HESAP DEĞİL: bir sonek karşılaştırması. Hiçbir sayıya
//  dokunulmuyor, hangi pazarın doğru olduğuna da BU ekran karar
//  vermiyor — kararı veren liste (kullanıcının yazımı) ya da çağıranın
//  bildirdiği `pazar`. Eşleşme yoksa sembol OLDUĞU GİBİ gidiyor;
//  uydurulmuş bir sonek eklenmiyor.
//
//  BURADA HESAP YOK: ekran yalnız sembolü büyük harfe çeviriyor, liste
//  yazımına eşliyor ve kayıdı kartlara dağıtıyor; hiçbir sayıya
//  dokunmuyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchAnalyze, useIstek, useListe, type AnalyzeRow, type Vade } from '@/api';
import { Card, Durum, Dugme, ScreenShell, VadeSecici, VeriYok } from '@/components';
import {
  BacktestKart,
  DegerKart,
  DetayBasligi,
  DetayEylemler,
  HaberKart,
  HareketKart,
  IceridenKart,
  KatalizorKart,
  SirketKart,
  RiskOdulKart,
  TeknikKart,
  TemelKart,
  TemettuKart,
  TezKart,
  degerTuruOf,
} from '@/components/detay';
import { space } from '@/theme';

/** Sembolün sonek'siz gövdesi — YALNIZ karşılaştırma için. */
function anahtar(sym: string): string {
  const s = String(sym).trim().toUpperCase();
  return s.endsWith('.IS') ? s.slice(0, -3) : s;
}

export default function HisseDetayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sembol?: string; pazar?: string }>();
  const liste = useListe();

  // Rota parçası diziye de dönüşebilir (expo-router sözleşmesi); tek
  // dizgi değilse sembol YOK sayılır — yarım bir istek atılmaz.
  const sembol = useMemo(() => {
    const ham = typeof params.sembol === 'string' ? params.sembol.trim() : '';
    if (!ham) return null;
    const buyuk = ham.toUpperCase();
    // Zaten sonekliyse dokunulmuyor.
    if (buyuk.endsWith('.IS')) return buyuk;
    // 1) Listede aynı gövdeyle bir kayıt varsa KULLANICININ yazımı kazanır.
    const eslesen = liste.find((l) => anahtar(l) === buyuk);
    if (eslesen) return eslesen;
    // 2) Liste bilmiyorsa (Arama sonucu) çağıranın bildirdiği pazara bak.
    if (typeof params.pazar === 'string' && params.pazar.toUpperCase() === 'BIST') {
      return buyuk + '.IS';
    }
    return buyuk;
  }, [params.sembol, params.pazar, liste]);

  // VARSAYILAN 'orta' KORUNDU: eski davranış seçim yapılmadığında
  // birebir aynı. Vade bu ekranın durumu — kart değil ekran soruyor.
  const [vade, setVade] = useState<Vade>('orta');

  const cagri = useCallback(
    (signal: AbortSignal) => fetchAnalyze(sembol ? [sembol] : [], { vade, signal }),
    [sembol, vade],
  );
  // ANAHTAR VADEYİ TAŞIYOR: çıplak `sembol` anahtarı vade değişince
  // önceki vadenin önbellekli satırını basardı.
  const { durum, veri, hata, yenile } = useIstek(cagri, (sembol ?? '') + '|' + vade, {
    etkin: Boolean(sembol),
  });

  const satir: AnalyzeRow | null = veri?.sonuclar?.[0] ?? null;

  // Geri: yığında sayfa varsa geri, yoksa köke. NEDEN KONTROL: derin
  // bağlantıyla (bildirim/paylaşım) açıldığında yığın BOŞ olur ve
  // `back()` hiçbir şey yapmaz — kullanıcı ekranda kilitlenir.
  const geri = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  return (
    <DetayKabuk sembol={sembol}>
      <View style={styles.ustCubuk}>
        <Dugme label="‹ Geri" onPress={geri} size="md" variant="outline" tone="neutral" />
      </View>

      {/* Sembol hiç gelmediyse istek atılmadı; 'bos' hâli bunu söyler. */}
      {!sembol ? (
        <Card title="Sembol yok" subtitle="Adreste sembol parçası bulunamadı.">
          <VeriYok metin="Bu adres bir sembol taşımıyor; listeden bir hisse seçin." kartsiz />
        </Card>
      ) : (
        <>
          {/* VADE SEÇİCİ: `Durum`dan ÖNCE, çünkü analiz turu 45-55 sn
              sürüyor ve seçici iskeletin ARKASINDA kalsaydı kullanıcı
              bekleme boyunca vadeyi değiştiremezdi. */}
          <Card
            title="Vade"
            subtitle="Motorun hangi penceresi sorulacak — teknik skor, plan ve geçmiş ölçüm bu seçime göre gelir.">
            <VadeSecici deger={vade} onDegis={setVade} />
          </Card>

          {/* Yükleniyor · boş · dört hata türü: tek gövde. */}
          <Durum
            durum={durum}
            hata={hata}
            yenile={yenile}
            iskelet={3}
            sekil="skor"
            bosMetin="Sembol bekleniyor."
          />

          {durum === 'veri' && !satir ? (
            // Tur koştu ama kayıt gelmedi: HATA DEĞİL, veri cevabı —
            // sembol uçta tanınmamış olabilir.
            <Card title={sembol} subtitle="Motor bu sembol için kayıt döndürmedi.">
              <VeriYok metin="Bu sembol için analiz kaydı yok." kartsiz />
            </Card>
          ) : null}

          {satir ? (
            <>
              <DetayBasligi satir={satir} />
              {/* YAZMA EYLEMLERI: webde hisse sayfasinin ust
                  seridinde ikisi de var. Native'de listeye ekleme
                  YALNIZ Arama sekmesindeydi, kiyas setine ekleme
                  ise HIC YOKTU. Pazar burada da cagirandan
                  gidiyor; ekran pazar CIKARIMI yapmiyor. */}
              <DetayEylemler sembol={sembol} market={satir.market} />
              {/* ANALYZE TURUNUN DISINDA, EN USTTE: "bu sirket ne
                  yapiyor?" sorusunun cevabi native detayda HIC
                  YOKTU — kullanici tanimadigi bir sembolde skoru
                  okuyordu. Teknik/temel kartlardan ONCE duruyor
                  cunku webde de bolum ust tarafta. Pazar BURAYA
                  GECMIYOR: kunye ucu sembolun kendi yazimiyla
                  calisiyor ve kart ters pazar denemesi YAPMIYOR. */}
              <SirketKart sembol={sembol} />
              <TeknikKart satir={satir} />
              {/* `sembol` AYRICA VERİLİYOR: kart piyasa değeri için
                  künye ucuna kendi turunu atıyor ve o uç BIST'te `.IS`
                  sonekini istiyor — `satir.sym` o soneki taşımayabilir
                  (yukarıdaki ".IS GERİ KAZANIMI" notu). */}
              <TemelKart satir={satir} sembol={sembol} />
              <TezKart satir={satir} />
              <RiskOdulKart satir={satir} />
              {/* ANALYZE TURUNUN DIŞI: kendi ucu, kendi zaman aşımı,
                  kendi `Durum` gövdesi (gerekçesi BacktestKart'ta).
                  Sembol `satir.sym` DEĞİL, ekranın çözdüğü `sembol`:
                  BIST'te `.IS` soneki ucun doğru pazarı bulması için
                  gerekiyor (yukarıdaki ".IS GERİ KAZANIMI" notu). */}
              <BacktestKart sembol={sembol} market={satir.market} vade={vade} />
              {/* ANALYZE TURUNUN DIŞI (ŞERİT F): temettü alanları
                  `/api/yfin` künyesinde, `AnalyzeRow`da HİÇ YOK. Kendi
                  ucu, kendi zaman aşımı, kendi `Durum` gövdesi —
                  `BacktestKart` ile aynı gerekçe. Sembol yine ekranın
                  çözdüğü `sembol`: BIST'te `.IS` soneki künye ucunun
                  doğru kaydı bulması için gerekiyor. */}
              <TemettuKart sembol={sembol} />
              {/* ANALYZE TURUNUN DISI: webdeki "Katalizor / Risk"
                  satirinin YAKLASAN TEMETTU bacagi. Gun farki ve 45 gun
                  esigi webde TARAYICIDA hesaplaniyordu -> karar motora,
                  hesap `/api/katalizor` ucuna tasindi; kart yalniz
                  KAPALI KOD okuyor. TEMETTUKART'IN HEMEN ALTINDA: ust
                  kart ham tarihleri, bu kart EN YAKIN tarihi, kalan gun
                  sayisini ve bandini basiyor. Oynaklik bacagi
                  `RiskOdulKart`ta — ayni ATR iki kez istenmiyor.
                  SKORA GIRMEZ. PAZAR BURADAN GIDIYOR. */}
              <KatalizorKart sembol={sembol} pazar={satir.market} />
              {/* ANALYZE TURUNUN DISI: webde bu bolum
                  TARAYICIDA hesaplaniyordu (`fillSpWhy`) ve native'e
                  tasinamiyordu — karar motora, hesap `/api/neden`
                  ucuna tasindi, kart yalniz KAPALI KOD okuyor.
                  HABERDEN ONCE duruyor: bugunku hareketin OZETI, ve
                  mansetleri okumadan once "ne oldu?" sorusuna
                  cevabi o veriyor. SKORA GIRMEZ — kart bunu ekranda
                  yaziyor. PAZAR BURADAN GIDIYOR; kart pazar
                  CIKARIMI yapmiyor. */}
              <HareketKart sembol={sembol} pazar={satir.market} />
              {/* ANALYZE TURUNUN DIŞI: haber alanları `AnalyzeRow`da HİÇ
                  YOK, haber ucu ayrı `maxDuration` kademesinde —
                  `BacktestKart`/`TemettuKart` ile aynı gerekçe. Webdeki
                  hisse sayfasının "Gelişmeler" bölümünün (app.js:7923)
                  native karşılığı; detay ekranında KARŞILIĞI YOKTU.
                  PAZAR BURADAN GİDİYOR: uç `market`i SEMBOL pazarı
                  olarak alıyor ve kart pazar ÇIKARIMI yapmıyor. */}
              <HaberKart sembol={sembol} market={satir.market} />
              {/* ANALYZE TURUNUN DIŞI: içeriden işlem bildirimleri
                  `AnalyzeRow`da HİÇ YOK, kendi ucu var. TEMEL SKORA
                  DAHİL DEĞİL (kullanıcı tercihi) — kart bunu ekranda
                  yazıyor. PAZAR BURADAN GİDİYOR: US ayağı SEC Form 4,
                  BIST ayağı KAP bildirimi okuyor; kart pazar ÇIKARIMI
                  yapmıyor. Haberden SONRA duruyor: ikisi de "ne oldu?"
                  bölümü ama bu AYNI uçtan değil. */}
              <IceridenKart sembol={sembol} pazar={satir.market} />
              {/* DEĞER UCU HİSSE ÖLÇMÜYOR: yalnız metal/kripto. Kartı
                  hisse sembolünde HİÇ basmıyoruz — her hissede "bu uç
                  bunu ölçmüyor" kutusu göstermek ekranı gürültüye
                  boğardı. Karar DegerKart'ın kendi eşlemesinden
                  (`degerTuruOf`) geliyor; burada ikinci bir tablo yok. */}
              {degerTuruOf(sembol) ? <DegerKart sembol={sembol} /> : null}
            </>
          ) : null}
        </>
      )}
    </DetayKabuk>
  );
}

/**
 * Başlığı sembolle kuran ince sarmal. NEDEN AYRI: `ScreenShell` başlığı
 * zorunlu alıyor ve sembol `null` olabiliyor; koşulu JSX içine gömmek
 * ekranın gövdesini okunmaz hâle getiriyordu.
 */
function DetayKabuk({
  sembol,
  children,
}: {
  sembol: string | null;
  children: React.ReactNode;
}) {
  return (
    <ScreenShell
      title={sembol ?? 'Hisse'}
      subtitle="Tek turda teknik, temel, tez ve seviyeler — tüm sayılar motor API'den."
      note="Skorlar, bantlar ve seviyeler motorda hesaplanır; bu ekran yalnız biçimler.">
      {children}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  ustCubuk: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
