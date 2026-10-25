// =====================================================================
//  LİSTELER — 1. sekme, MOTORA BAĞLI                  (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: takip listesindeki semboller için /api/recommend turu: fiyat,
//  bileşke skor, motorun bandı ve alım bandına yakınlık.
//
//  NEDEN /api/recommend, /api/score DEĞİL: ÖLÇÜLDÜ (2026-10-18) ki ABD
//  sembollerinde `fa.price` SEC kesintisinde `null` kalıyor; fiyatın
//  güvenilir kaynağı `plan.seviye.price`. Ayrıca sözleşme iç içe:
//  score ⊂ recommend, yani tek istekle skor + plan geliyor — iki ayrı
//  tur atmak hem yavaş hem de iki ayrı anlık görüntü demekti.
//
//  BURADA HESAP YOK: fiyat, skor, bant, yakınlık — hepsi uçtan gelen
//  alanlar. Bu dosyada tek bir eşik, ağırlık ya da formül YOK. Sayılar
//  yalnız `lib/format.ts` ile BİÇİMLENİYOR (tr-TR), türetilmiyor.
//
//  NEDEN FlatList VE FlashList DEĞİL (ÖLÇÜLDÜ, KARAR KAPANDI): bu
//  listenin AZAMİ UZUNLUĞU 8 SATIR — motor sözleşmesinin kendi sınırı
//  (`AZAMI_SEMBOL = 8`, api/types.ts; uç nokta fazlasını 400 ile
//  reddediyor, kırpmıyor). `@shopify/flash-list` geri dönüşüm kazancını
//  ekran dışında KALAN satırlarda veriyor; 8 satırın tamamı zaten ekranda
//  ya da bir kaydırma payında. Ölçülebilir kazanç yok, karşılığında yeni
//  bir native bağımlılık + Expo Go dışı derleme borcu var. KURULMADI.
//  Sınır artarsa (ör. ücretli katmanda 50 sembol) karar yeniden ölçülür.
//
//  KALICILIK (FAZ 3, KAPANDI): liste cihazda saklanıyor — `lib/kalici.ts`
//  (AsyncStorage, web'le aynı `sb:lists` anahtarı/şekli). Uygulama
//  kapanıp açılınca ya da web lab'da sayfa yenilenince liste YERİNDE
//  duruyor. Bulut senkronu (Supabase) hâlâ ayrı bir ayak ve anahtarı yok;
//  ekran bunu ayrı kartta dürüstçe söylüyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  cikar,
  fetchRecommend,
  kayitBudandiMi,
  useHazir,
  useIstek,
  useListe,
  type RecommendRow,
} from '@/api';
import { getSupabase } from '@/api/supabase';
import {
  Card,
  Durum,
  Dugme,
  OlcumEksikRozet,
  Pill,
  ScreenShell,
  TickerRow,
  VeriYok,
} from '@/components';
import { formatPrice, formatScore } from '@/lib/format';
import { depoCalisiyorMu } from '@/lib/kalici';
import { space, type, useTheme } from '@/theme';

/** Yakınlık durumunun Türkçe karşılığı. SABİT KÜME (motordan: api/_motor.js). */
const YAKINLIK_METIN: Record<string, string> = {
  in: 'bandın içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandın uzağında',
};

export default function ListelerScreen() {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();
  const senkron = getSupabase();
  // Depo GERÇEKTEN yazıp okuyabiliyor mu? İddia değil, ölçüm: özel
  // pencerede / kota dolu cihazda kalıcılık olmaz ve kullanıcı bunu
  // bilmeli. `null` = henüz ölçülmedi ("yok" ile aynı şey değil).
  const [depoOk, setDepoOk] = useState<boolean | null>(null);
  useEffect(() => {
    let canli = true;
    void depoCalisiyorMu().then((v) => {
      if (canli) setDepoOk(v);
    });
    return () => {
      canli = false;
    };
  }, []);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchRecommend(liste, { vade: 'orta', signal }),
    [liste],
  );
  const { durum, veri, hata, yenile, taze } = useIstek(cagri, liste.join(','), {
    // `hazir`: depo okuması bitmeden motora gitmeyiz (bkz. api/liste.ts).
    etkin: hazir && liste.length > 0,
  });

  const satirlar: RecommendRow[] = veri?.sonuclar ?? [];

  return (
    <ScreenShell
      title="Listeler"
      subtitle="Takip ettiğin hisseler — her sayı motor API'den gelir."
      scroll={false}
      note={
        kayitBudandiMi()
          ? 'Liste cihazda saklanıyor. Önceki kayıttan okunamayan satırlar atlandı.'
          : 'Liste cihazda saklanıyor; bulut senkronu kurulu değil.'
      }>
      <FlatList
        data={satirlar}
        keyExtractor={(r) => r.sym}
        style={styles.liste}
        contentContainerStyle={styles.listeIc}
        refreshControl={
          <RefreshControl
            refreshing={taze && durum === 'veri'}
            onRefresh={yenile}
            tintColor={colors.gold}
          />
        }
        ListHeaderComponent={
          <View style={styles.basliklar}>
            <Durum
              durum={hazir ? durum : 'yukleniyor'}
              hata={hata}
              yenile={yenile}
              iskelet={Math.max(liste.length, 3)}
              sekil="satir"
              bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
            />
            {durum === 'veri' && veri ? (
              <View style={styles.ozet}>
                {/* NEDEN ROZET SATIRLARIN ÜSTÜNDE: eksik ölçüm künye
                    satırı olarak altta dururken kullanıcı sayıları
                    okuduktan SONRA eksikliği öğreniyordu. `atlanan`
                    da aynı yere taşındı: ölçülmeyen sembolü listenin
                    dibinde söylemek, olmayan satırı aramasına yol
                    açıyor. */}
                <OlcumEksikRozet kaynak={veri} />
                {veri.atlanan.length ? (
                  <Text style={[type.micro, { color: colors.gold }]}>
                    {'Zaman bütçesi doldu, ölçülmeyenler: ' + veri.atlanan.join(', ')}
                  </Text>
                ) : null}
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Vade: ' + veri.vade + ' · motor ' + veri.surum.motor}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          durum === 'veri' ? (
            <VeriYok metin="Motor bu semboller için sonuç döndürmedi." />
          ) : null
        }
        renderItem={({ item }) => <Satir satir={item} />}
      />

      <Card title="Liste nerede saklanıyor?">
        <Text style={[type.small, { color: colors.textDim }]}>
          {depoOk === null
            ? 'Yerel kayıt ölçülüyor…'
            : depoOk
              ? 'Bu cihazda saklanıyor: uygulamayı kapatıp açsan liste yerinde durur.'
              : 'Bu cihazda saklanamıyor (depoya yazılamadı): liste yalnız bu oturum boyunca durur.'}
        </Text>
        <Text style={[type.small, { color: colors.textDim }]}>
          {senkron.ok ? 'Bulut senkronu yapılandırıldı.' : senkron.message}
        </Text>
      </Card>
    </ScreenShell>
  );
}

/** Tek satır. Gösterdiği HER değer uçtan gelen bir alan. */
function Satir({ satir }: { satir: RecommendRow }) {
  const { colors } = useTheme();
  const fiyat = satir.plan?.seviye?.price ?? satir.fa.price;
  const skor = satir.composite.blendedShown;
  const bant = satir.composite.band;
  const yakinlik = satir.plan?.yakinlik?.state;

  return (
    <View style={styles.satirKab}>
      <TickerRow
        symbol={satir.sym}
        name={satir.market === 'BIST' ? 'Borsa İstanbul' : 'ABD'}
        price={fiyat}
        currency={satir.market === 'BIST' ? 'TRY' : null}
        changePct={null}
        style={styles.satirTicker}
        onPress={() => router.push({
                    pathname: '/hisse/[sembol]',
                    // `pazar`: uc BIST sembolunu sonek SILEREK donduruyor; detay
                    // ekrani bu bilgiyle `.IS`'i geri kazaniyor (bkz. o ekran).
                    params: { sembol: satir.sym, pazar: satir.market },
                  })}
        right={
          <View style={styles.sag}>
            {/* NEDEN FIYAT BURADA: `right` verildiginde TickerRow kendi fiyat
                blogunu basmiyor (bkz. TickerRow). Fiyat hala UCTAN gelen ham
                sayi; yalniz tr-TR bicimlendirmesi istemcide. */}
            <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
              {formatPrice(fiyat, satir.market === 'BIST' ? 'TRY' : null)}
            </Text>
            <Pill
              label={'Bileşke ' + formatScore(skor)}
              tone={typeof skor === 'number' ? 'info' : 'neutral'}
              glyph={null}
              size="sm"
            />
            <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={1}>
              {bant ?? 'bant ölçülemedi'}
            </Text>
            {yakinlik ? (
              <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
                {YAKINLIK_METIN[yakinlik] ?? yakinlik}
              </Text>
            ) : null}
          </View>
        }
      />
      <Dugme
        label="Çıkar"
        size="sm"
        variant="outline"
        tone="neutral"
        onPress={() => cikar(satir.sym)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  liste: { flex: 1 },
  listeIc: { gap: space.sm, paddingBottom: space.md },
  basliklar: { gap: space.sm },
  ozet: { gap: space.xs },
  satirKab: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  satirTicker: { flex: 1 },
  sag: { alignItems: 'flex-end', gap: 2 },
});
