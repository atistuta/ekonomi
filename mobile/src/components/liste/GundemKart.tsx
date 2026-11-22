// =====================================================================
//  🌍 GÜNDEMDEN HABERDAR ET — kutucuk + dürüst dipnot (PROcess / native)
// ---------------------------------------------------------------------
//  NE: tasarım dilindeki "gündemden haberdar et / faiz, enflasyon,
//  jeopolitik" satırı. Anahtar, anket kaydındaki `bildirimler` dizisine
//  `'gundem'` yazıyor ya da çıkarıyor (depo.ts §11).
//
//  ── NEDEN ANAHTAR "SUNUCUYA YAZIYOR" DEMİYOR (ÖLÇÜLDÜ 2026-11-15) ──
//  `/api/bildirim` (api/_bildirim.js:240) cihazı senkron KODUYLA
//  kaydediyor ve KONU BAŞINA tercih alanı TAŞIMIYOR: kayıt gövdesi
//  jeton + platform + izin; gönderim tarafında konuyu GÖNDEREN seçiyor.
//  Yani bugün bu anahtarın sunucuda bir karşılığı YOK. Sessizce hiçbir
//  şey yapmayan bir anahtar basmak yalan olurdu; bu yüzden kart ne
//  yaptığını ve neyi HENÜZ yapmadığını yazıyor.
//
//  LİSTE ZİLİNDEN AYRI: liste başına `notify` bayrağı PUSH evrenini
//  kuruyor (`ListeBlogu`, `bildirimEvreni`); bu satır ise dünya
//  gündemi — hiçbir listeye bağlı değil, bu yüzden ayrı kart.
//
//  BURADA HESAP YOK: eşik, ağırlık, skor yok; tek bir tercih yazılıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useEffect } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { profilYaz, profilYukle, useProfil, useProfilHazir } from '@/api/depo';
import { Card } from '@/components';
import { space, type, useTheme } from '@/theme';

export type GundemKartProps = Record<string, never>;

export function GundemKart() {
  const { colors } = useTheme();
  const profil = useProfil();
  const hazir = useProfilHazir();

  // Profil `depoBaslat`ın okuduğu web türlerinden DEĞİL (native'e özel).
  useEffect(() => {
    void profilYukle();
  }, []);

  const acik = profil.bildirimler.includes('gundem');

  function yaz(v: boolean) {
    const kalan = profil.bildirimler.filter((b) => b !== 'gundem');
    void profilYaz({ bildirimler: v ? [...kalan, 'gundem'] : kalan }, profil.ts);
  }

  return (
    <Card title="🌍 Gündemden haberdar et">
      {hazir ? (
        <View style={styles.satir}>
          <View style={styles.metin}>
            <Text style={[type.body, { color: colors.text }]}>Faiz, enflasyon, jeopolitik</Text>
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Dünya gündemi — hiçbir listeye bağlı değil.
            </Text>
          </View>
          <Switch
            value={acik}
            onValueChange={yaz}
            accessibilityLabel={'Gündem bildirimi: ' + (acik ? 'açık' : 'kapalı')}
            trackColor={{ true: colors.vurguSoft, false: colors.neutralSoft }}
            thumbColor={acik ? colors.vurgu : colors.textFaint}
          />
        </View>
      ) : (
        <Text style={[type.small, { color: colors.textDim }]}>Cihazdaki kayıt okunuyor…</Text>
      )}
      {/* Dürüst dipnot: ölçülen durum, vaat değil (bkz. başlık). */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        Bu seçim şimdilik yalnız bu cihazda saklanıyor. Bildirim ucu konu başına tercih
        taşımıyor; gündem bildirimleri henüz ayrı süzülmüyor.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  satir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metin: { flex: 1, gap: 2 },
});

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
