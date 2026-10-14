// =====================================================================
//  ANALİZ — 4. sekme + komponent vitrini              (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: analiz sekmesi. Web'deki "🧠 Analiz" menüsünün 6 bölümü burada
//  yaşayacak: Karşılaştır, Tez, Teknik, Temel, Bilanço, Temettü.
//  Ayrıca FAZ 1'in VİTRİNİ: 7 çekirdek komponentin hepsi bu ekranda
//  gözle görülüyor.
//
//  NEDEN VİTRİN BURADA: komponentleri ayrı bir "/showcase" yoluna koymak
//  gezinme ağacına üründe olmayan bir sekme eklemek demekti (5 menü
//  kuralı). Analiz sekmesi zaten skor/satır/çip taşıyacak ekran; vitrin
//  onun geçici sakini.
//
//  NEDEN "ÖRNEK.A" GİBİ SEMBOLLER: "NVDA 182,40 ▲%2,1" yazmak, ekran
//  görüntüsünde CANLI VERİ gibi görünür ve bu yanlış olur — motor bu
//  ekrana hâlâ bağlı değil. Bu yüzden semboller açıkça sahte, kart
//  başlığı "ÖRNEK" rozeti taşıyor ve bir satır bilinçli olarak
//  "ölçülemedi" durumunda duruyor.
//
//  NEDEN "ölçülemedi" DURUMU VİTRİNDE: ürünün dürüstlük kuralı —
//  `tam:false` / `kesinti>0` "düşük skor" ile AYNI gösterilmemeli
//  (bkz. api/types.ts `olcumEksik`). Bu ayrımın görsel hâli gözle
//  doğrulanabilir olmalı, yoksa FAZ 2'de ilk kurban olur.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Card,
  Disclaimer,
  Pill,
  ScoreGauge,
  ScreenShell,
  SectorChip,
  Skeleton,
  SkeletonRow,
  TickerRow,
} from '@/components';
import { space, type, useTheme } from '@/theme';

/** Web menüsündeki adlar — `index.html` "🧠 Analiz" grubundan AYNEN. */
const BOLUMLER = [
  '⚖️ Karşılaştır',
  '📓 Tez',
  '📈 Teknik Analiz',
  '📊 Temel Analiz',
  '📅 Bilanço',
  '💰 Temettü Takvimi',
] as const;

export default function AnalizScreen() {
  const { colors } = useTheme();

  return (
    <ScreenShell
      title="Analiz"
      subtitle="Karşılaştırma, teknik ve temel analiz. Veri bağlama FAZ 2'de."
      note="Aşağıdaki sayılar ÖRNEKTİR — motor API'ye bağlı değildir.">
      <Card title="Bölümler" subtitle="Web'deki sıra korunuyor">
        <View style={styles.satir}>
          {BOLUMLER.map((ad) => (
            <Pill key={ad} label={ad} tone="neutral" variant="outline" glyph={null} />
          ))}
        </View>
      </Card>

      {/* ---------- VİTRİN: 7 çekirdek komponent ---------- */}
      <Card
        title="Komponent vitrini"
        subtitle="FAZ 1 çıktısı — sayılar örnek, canlı veri değil"
        right={<Badge label="ÖRNEK" tone="gold" size="sm" glyph={null} />}>
        <Text style={[type.small, { color: colors.textDim }]}>
          Bu kutu, tasarım sisteminin 7 çekirdek parçasını bir arada gösterir. FAZ 2'de veri
          bağlandığında bu kutu kaldırılacak.
        </Text>

        {/* 1-2) ScoreGauge: ölçülmüş ve ölçülememiş hâli yan yana */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>ScoreGauge</Text>
          <ScoreGauge score={72} caption="Örnek bileşke" band="örnek bant" />
          <ScoreGauge score={null} caption="Örnek teknik" />
        </View>

        {/* 3) Pill / Badge — yön taşıyan tonlarda ok otomatik */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>Pill / Badge</Text>
          <View style={styles.satir}>
            <Pill label="Örnek artış" tone="positive" />
            <Pill label="Örnek düşüş" tone="negative" />
            <Pill label="Nötr" tone="neutral" glyph={null} />
            <Pill label="Bilgi" tone="info" glyph={null} />
            <Badge label="Vade: orta" tone="gold" size="sm" glyph={null} />
          </View>
        </View>

        {/* 4) SectorChip — alt alan (Yahoo industry) ile */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>SectorChip</Text>
          <View style={styles.satir}>
            <SectorChip sector="Teknoloji" detail="Yarı iletken" />
            <SectorChip sector="Bankacılık" size="sm" />
          </View>
        </View>

        {/* 5) TickerRow — ham sayı, biçimlendirme istemcide */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>TickerRow</Text>
          <TickerRow
            symbol="ÖRNEK.A"
            name="sahte satır — canlı veri değil"
            price={182.4}
            currency="USD"
            changePct={2.14}
          />
          <TickerRow
            symbol="ÖRNEK.B"
            name="sahte satır — canlı veri değil"
            price={61.85}
            currency="TRY"
            changePct={-1.37}
          />
          <TickerRow
            symbol="ÖRNEK.C"
            name="ölçülemedi — hata değil, dürüst boş durum"
            price={null}
            changePct={null}
          />
        </View>

        {/* 6) Skeleton — blok, satır */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>Skeleton</Text>
          <Skeleton width="70%" height={14} rounded="pill" />
          <SkeletonRow />
        </View>

        {/* 7) Disclaimer — kart kipi (ekran dibindeki satır kipi hep var) */}
        <View style={styles.bolum}>
          <Text style={[type.microBold, { color: colors.textFaint }]}>Disclaimer</Text>
          <Disclaimer variant="card" note="Kart kipi. Satır kipi her ekranın dibinde." />
        </View>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  bolum: { gap: space.sm },
});
