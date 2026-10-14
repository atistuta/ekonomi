// =====================================================================
//  5 SEKME — web menüsüyle BİREBİR aynı sıra         (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Alt sekme çubuğu. Sıra ve adlar `index.html`'deki üst menüden
//  AYNEN alındı: Listeler, Bugün, Keşfet, Analiz, Arama.
//
//  NEDEN BİREBİR: ürün kuralı "5 menü düzeni korunur". Kullanıcı aynı
//  işi web'de 3. sekmede yapıyorsa telefonda da 3. sekmede yapmalı;
//  sıra değişirse kas hafızası bozulur ve "yeni uygulama öğrenme"
//  hissi doğar. Emojiler de web'dekilerle aynı (Bugün 📡, Keşfet 🔍,
//  Analiz 🧠, Arama 🔎) — Listeler'de web'de emoji yok, sekme çubuğu
//  ikonsuz boş durduğu için 📋 eklendi.
//
//  NEDEN `expo-router/js-tabs`: kökten `import { Tabs } from
//  'expo-router'` bu sürümde KULLANIM DIŞI (ÖLÇÜLDÜ: exports.d.ts:41
//  "@deprecated Use `import { Tabs } from 'expo-router/js-tabs'`").
//  Alternatif `unstable-native-tabs` adının söylediği gibi kararsız ve
//  şablonda web/native diye iki ayrı dosya gerektiriyordu
//  (app-tabs.tsx + app-tabs.web.tsx). js-tabs tek dosyada ikisini de
//  veriyor — web lab'ı da aynı kodu çalıştırıyor.
//
//  NEDEN İKON = METİN: ikon kütüphanesi (SF Symbols / vektör set) FAZ 3
//  tasarım işi. Şimdi bir ikon paketi eklemek, tasarım dili kurulmadan
//  önce bağımlılık borcu olurdu. Emoji geçici ve bunu NOTLARDA yazıyoruz
//  — "bitti" demiyoruz.
//
//  NEDEN BAŞLIK KAPALI (`headerShown: false`): ekran başlığını
//  `ScreenShell` çiziyor; iki başlık çubuğu üst üste binerdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, type ColorValue } from 'react-native';

import { type, useTheme, weight } from '@/theme';

/**
 * Sekme ikonu — tek yerden, renk sekme durumundan gelir.
 *
 * NEDEN `ColorValue` ve `string` DEGIL: react-navigation `tabBarIcon`
 * geri cagrisina `ColorValue` veriyor (OLCULDU: tsc TS2322 —
 * "OpaqueColorValue is not assignable to string"). Platform rengi
 * (PlatformColor) bir nesne olabilir; `string` demek derlemeyi kirar.
 */
function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return (
    <Text style={[styles.icon, { color }]} allowFontScaling={false}>
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bgSoft,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: type.micro.fontSize,
          fontWeight: weight.bold,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Listeler',
          tabBarIcon: ({ color }) => <TabIcon glyph="📋" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bugun"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ color }) => <TabIcon glyph="📡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="kesfet"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => <TabIcon glyph="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analiz"
        options={{
          title: 'Analiz',
          tabBarIcon: ({ color }) => <TabIcon glyph="🧠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="arama"
        options={{
          title: 'Arama',
          tabBarIcon: ({ color }) => <TabIcon glyph="🔎" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 18, lineHeight: 22, textAlign: 'center' },
});
