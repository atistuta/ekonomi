// =====================================================================
//  5 SEKME — web menüsüyle BİREBİR aynı sıra         (FAZ 1 / native)
// ---------------------------------------------------------------------
//  NE: Alt sekme çubuğu. Sıra `index.html`'deki üst menüden AYNEN
//  alındı: Evren, Bugün, Keşfet, Analiz, Arama.
//
//  NEDEN BİREBİR: ürün kuralı "5 menü düzeni korunur". Kullanıcı aynı
//  işi web'de 3. sekmede yapıyorsa telefonda da 3. sekmede yapmalı;
//  sıra değişirse kas hafızası bozulur ve "yeni uygulama öğrenme"
//  hissi doğar. SIRA DEĞİŞMEDİ, sekme SAYISI değişmedi.
//
//  TEK AD DEĞİŞİKLİĞİ (PROcess, 2026-11-15): 1. sekme "Listeler" →
//  "Evren". Gerekçe ÜRÜN tanımı: kullanıcı adlandırılmış listelerden
//  KENDİ hisse evrenini kuruyor ve ekranın işi o evren (PROcess.txt
//  satır 1: "evren sekmesi olacak ve onun altında da farklı farklı
//  listeler olacak"). Rota adı (`index`) ve sekme sırası DOKUNULMADI —
//  derin bağlantılar ve kas hafızası korunuyor.
//
//  NEDEN `expo-router/js-tabs`: kökten `import { Tabs } from
//  'expo-router'` bu sürümde KULLANIM DIŞI (ÖLÇÜLDÜ: exports.d.ts:41
//  "@deprecated Use `import { Tabs } from 'expo-router/js-tabs'`").
//  Alternatif `unstable-native-tabs` adının söylediği gibi kararsız ve
//  şablonda web/native diye iki ayrı dosya gerektiriyordu
//  (app-tabs.tsx + app-tabs.web.tsx). js-tabs tek dosyada ikisini de
//  veriyor — web lab'ı da aynı kodu çalıştırıyor.
//
//  NEDEN ARTIK VEKTÖR İKON (FAZ 3, KAPANDI): emoji ikonlar sistem
//  fontundan geliyordu — üç platformda üç ayrı resim ve `tabBarActive
//  TintColor` (altın) onlara İŞLEMİYORDU. Şimdi `TabIkon` (SVG) renk
//  dışarıdan alıyor; seçili sekme ikonda da görülüyor. Gerekçe:
//  components/TabIkon.tsx.
//
//  NEDEN BAŞLIK KAPALI (`headerShown: false`): ekran başlığını
//  `ScreenShell` çiziyor; iki başlık çubuğu üst üste binerdi.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { Tabs } from 'expo-router/js-tabs';
import { type ColorValue } from 'react-native';

import { TabIkon, type TabIkonAd } from '@/components';
import { type, useTheme, weight } from '@/theme';

/**
 * Sekme ikonu — renk sekme durumundan gelir.
 *
 * NEDEN `ColorValue` ve `string` DEGIL: react-navigation `tabBarIcon`
 * geri cagrisina `ColorValue` veriyor (OLCULDU: tsc TS2322 —
 * "OpaqueColorValue is not assignable to string"). Platform rengi
 * (PlatformColor) bir nesne olabilir; `string` demek derlemeyi kirar.
 * SVG `stroke` string istedigi icin burada tek yerde metne cevriliyor;
 * nesne gelirse tema altinina dusuyoruz (ikon KAYBOLMUYOR).
 */
function ikonCiz(ad: TabIkonAd, color: ColorValue, yedek: string) {
  return <TabIkon ad={ad} color={typeof color === 'string' ? color : yedek} />;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.vurgu,
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
          title: 'Evren',
          tabBarIcon: ({ color }) => ikonCiz('listeler', color, colors.vurgu),
        }}
      />
      <Tabs.Screen
        name="bugun"
        options={{
          title: 'Bugün',
          tabBarIcon: ({ color }) => ikonCiz('bugun', color, colors.vurgu),
        }}
      />
      <Tabs.Screen
        name="kesfet"
        options={{
          title: 'Keşfet',
          tabBarIcon: ({ color }) => ikonCiz('kesfet', color, colors.vurgu),
        }}
      />
      <Tabs.Screen
        name="analiz"
        options={{
          title: 'Analiz',
          tabBarIcon: ({ color }) => ikonCiz('analiz', color, colors.vurgu),
        }}
      />
      <Tabs.Screen
        name="arama"
        options={{
          title: 'Arama',
          tabBarIcon: ({ color }) => ikonCiz('arama', color, colors.vurgu),
        }}
      />
    </Tabs>
  );
}
