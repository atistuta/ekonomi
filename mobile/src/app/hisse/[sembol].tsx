// =====================================================================
//  /hisse/[sembol] — hisse detay ekranı              (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: tek hissenin tam künyesi: başlık şeridi (sembol · pazar · fiyat ·
//  bileşke skor), 📈 teknik, 📊 temel, 📓 tez ve ⚖️ risk/ödül kartları.
//  Hepsi TEK `fetchAnalyze` turundan; başka uç çağrılmıyor.
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
//  NEDEN VADE 'orta' SABİT: detay ekranı bir "genel bakış"; vade
//  seçiciyi buraya koymak Analiz sekmesinin işini ikinci bir yerde
//  tekrarlamaktı. 'gunici' vadede teknik ayak zaten koşmaz ve plan
//  `null` gelir — ekran bunu dürüstçe söylüyor (RiskOdulKart), ama
//  varsayılan olarak seçmiyor.
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
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { fetchAnalyze, useIstek, useListe, type AnalyzeRow } from '@/api';
import { Card, Durum, Dugme, ScreenShell, VeriYok } from '@/components';
import {
  DetayBasligi,
  RiskOdulKart,
  TeknikKart,
  TemelKart,
  TezKart,
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

  const cagri = useCallback(
    (signal: AbortSignal) => fetchAnalyze(sembol ? [sembol] : [], { vade: 'orta', signal }),
    [sembol],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol ?? '', {
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
              <TeknikKart satir={satir} />
              <TemelKart satir={satir} />
              <TezKart satir={satir} />
              <RiskOdulKart satir={satir} />
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
