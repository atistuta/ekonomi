// =====================================================================
//  ARAMA — 5. sekme (iskelet)                         (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: sembol ve tema araması. Web'de "🔎 Arama" sekmesi hem hisse hem
//  tematik keşif (🔭) girişi.
//
//  NEDEN GERÇEK BİR METİN ALANI VAR AMA SORGU GİTMİYOR: alanın
//  klavye/odak/tema davranışını FAZ 1'de gözle ölçmek gerekiyor —
//  bunu sahte bir kutu resmiyle ölçemezsin. Ama yazılan metin HİÇBİR
//  YERE gönderilmiyor ve bu ekranda açıkça yazıyor. "Arıyormuş gibi"
//  yapan bir alan, iskeletin en kötü hâli olurdu.
//
//  NEDEN "en çok 8 sembol" YAZILI: bu bir tahmin değil, ÖLÇÜLMÜŞ
//  sözleşme (api/score.js → AZAMI_SEMBOL = 8; aşılırsa 400
//  `cok_sembol`, liste kırpılmaz). Sayı `api/types.ts`ten okunuyor;
//  burada elle yazılsa sözleşme değişince ekran yalan söylerdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AZAMI_SEMBOL } from '@/api/client';
import { Card, Pill, ScreenShell, SkeletonText } from '@/components';
import { radius, space, type, useTheme } from '@/theme';

export default function AramaScreen() {
  const { colors } = useTheme();
  const [metin, setMetin] = useState('');

  return (
    <ScreenShell
      title="Arama"
      subtitle="Sembol ya da tema ara. Motor bağlantısı FAZ 2'de."
      note={'Tek sorguda en çok ' + AZAMI_SEMBOL + ' sembol ölçülür (motor sözleşmesi).'}>
      <Card
        title="Sembol / tema"
        subtitle="Yazdığın metin bu sürümde hiçbir yere gönderilmiyor"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <TextInput
          value={metin}
          onChangeText={setMetin}
          placeholder="Örn. THYAO, NVDA ya da bir tema"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
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
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {metin.trim().length > 0
            ? "Girilen metin yerel durumda tutuluyor; sorgu FAZ 2'de motora gidecek."
            : "Arama sonuçları FAZ 2'de dolacak."}
        </Text>
      </Card>

      <Card
        title="Sonuçlar"
        subtitle="FAZ 2'de dolacak"
        right={<Pill label="İSKELET" tone="info" size="sm" glyph={null} />}>
        <View style={styles.govde}>
          <SkeletonText lines={3} />
        </View>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    // Dokunma hedefi: tek elle rahat ulaşılsın (bkz. layout.ts hitSlopMin).
    minHeight: 44,
  },
  govde: { gap: space.sm },
});
