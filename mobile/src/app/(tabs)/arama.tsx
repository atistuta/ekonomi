// =====================================================================
//  ARAMA — 5. sekme, MOTORA BAĞLI                     (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: iki iş, tek alan: (1) sembol ölç → /api/recommend, sonucu
//  takip listesine ekle; (2) tema ara → /api/theme (🔭 tematik keşif).
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
//  NEDEN SEMBOL SONUCU TEK SATIR: istek tek sembolle gidiyor; sözleşme
//  sınırı 8 ve o sınır listenin işi (bkz. api/liste.ts).
//
//  BURADA HESAP YOK: fiyat/skor/bant uçtan; ekleme sınırı bile motor
//  sözleşmesinden (AZAMI_SEMBOL) okunuyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_SEMBOL,
  ekle,
  fetchRecommend,
  fetchTheme,
  temaKodMetni,
  useIstek,
  useListe,
} from '@/api';
import {
  Card,
  Dugme,
  Durum,
  OlcumNotu,
  Pill,
  ScreenShell,
  TickerRow,
  VeriYok,
} from '@/components';
import { formatPrice, formatScore } from '@/lib/format';
import { radius, space, type, useTheme } from '@/theme';

export default function AramaScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  const [metin, setMetin] = useState('');
  const [sembolSorgu, setSembolSorgu] = useState('');
  const [temaSorgu, setTemaSorgu] = useState('');
  const [bildirim, setBildirim] = useState<string | null>(null);

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
          onSubmitEditing={() => setSembolSorgu(metin.trim().toUpperCase())}
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
            onPress={() => setSembolSorgu(metin.trim().toUpperCase())}
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
      </Card>

      <Card
        title="Sembol sonucu"
        subtitle={sembolSorgu ? sembolSorgu + ' · /api/recommend' : 'Henüz ölçüm istenmedi'}>
        <Durum
          durum={sembolIstek.durum}
          hata={sembolIstek.hata}
          yenile={sembolIstek.yenile}
          iskelet={1}
          bosMetin="Bir sembol yaz ve 'Sembol ölç'e bas."
        />
        {sembolIstek.durum === 'veri' ? (
          satir ? (
            <>
              <TickerRow
                symbol={satir.sym}
                name={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD'}
                price={satir.plan?.seviye?.price ?? satir.fa.price}
                currency={satir.market === 'BIST' ? 'TRY' : null}
                changePct={null}
                onPress={() => router.push({ pathname: '/analiz', params: { sym: satir.sym } })}
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
              <OlcumNotu kaynak={satir} />
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
            <VeriYok metin={sembolSorgu + ' için motor sonuç döndürmedi.'} />
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
          bosMetin="Örn. 'yapay zeka', 'savunma', 'robotik'."
        />
        {temaIstek.durum === 'veri' ? (
          temaKod ? (
            // ÖLÇÜLEMEDİ: uç 200 döndü ama arama hiç yapılmadı (anahtar yok).
            <View style={styles.temaUyari}>
              <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
              <Text style={[type.small, { color: colors.text }]}>{temaKod}</Text>
            </View>
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
            <VeriYok metin="Bu tema için motor aday döndürmedi." />
          )
        ) : null}
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
  dugmeler: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  sag: { alignItems: 'flex-end', gap: 2 },
  temaUyari: { gap: space.xs },
  aday: { gap: 2, paddingVertical: space.sm },
});
