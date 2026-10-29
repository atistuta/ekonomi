// =====================================================================
//  🔭 TEMA — serbest metinden hisse adayı             (ŞERİT F6 / native)
// ---------------------------------------------------------------------
//  NE: `/api/theme?q=<tema>` ucunun döndürdüğü aday listesi. Her aday
//  için sembol · pazar · şirket adı · UCUN GEREKÇE METNİ (`reason`).
//  Dördü de UÇTAN; burada eşik, ağırlık, skor, sıralama YOK — uç skor
//  döndürmüyor bile (api/types.ts `ThemeCandidate`: symbol · market ·
//  name · reason, BAŞKA ALAN YOK).
//
//  ── 200 AMA SONUÇ YOK: "boş liste" ile "ölçemedim" AYRI ────────────
//  ÖLÇÜLDÜ (client.ts `fetchTheme` başlığı, üretim 2026-10-18): anahtar
//  sunucuda yokken uç HTTP 200 ile `{candidates: [], error: 'no_key'}`
//  dönüyor. Yani `useIstek` için bu BAŞARI, kullanıcı için DEĞİL. Boş
//  listeyi "bu temayla ilgili hisse yok" diye basmak YALAN olurdu:
//  arama hiç yapılmadı. Bu yüzden iki ayrı dal var ve ayrımı `error`
//  alanı yapıyor; çevirisi de istemcide TEK YERDE (`temaKodMetni`).
//  Çeviri bu dosyaya KOPYALANMADI — iki kopya, bir gün iki ayrı cümle.
//
//  ── NEDEN GİRDİ KARTIN İÇİNDE ──────────────────────────────────────
//  Tema serbest METİN; takip listesinden ya da seçili sembolden
//  TÜRETİLEMEZ. Kart bir tema TAHMİN ETSE (ör. listedeki ilk sembolün
//  sektörü) ekranda kullanıcının sormadığı bir sorunun cevabı
//  görünürdü. Girdi boşken kart ölçüm İSTEMİYOR: `Durum`un "henüz
//  sorulmadı" dalı basılıyor.
//
//  ⚠️ AYNI UÇ 🔎 ARAMA SEKMESİNDE DE OKUNUYOR (ÖLÇÜLDÜ 2026-10-29):
//  `(tabs)/arama.tsx:121` aynı `fetchTheme`i "🔭 Tematik keşif" kartında
//  çağırıyor ve Arama ↔ Bugün arasındaki `?tema=` yol parametresi akışı
//  ORADA yaşıyor (arama.tsx:99, bugun.tsx:515). BU KART O AKIŞA
//  BAĞLANMADI: Keşfet sekmesi `tema` parametresi OKUMUYOR (ölçüldü:
//  `(tabs)/kesfet.tsx` içinde `useLocalSearchParams` yok) ve üçüncü bir
//  köprü ucu açmak o iki yönlü akışı tek taraflı bozardı. Kart kendi
//  girdisini taşıyor; `baslangicSorgu` çağıranın isteğine bırakıldı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AZAMI_SORGU,
  fetchTheme,
  temaKodMetni,
  useIstek,
  type Market,
  type ThemeCandidate,
} from '@/api';
import { Card, Dugme, Durum, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { radius, space, type, useTheme } from '@/theme';

export type TemaKartProps = {
  /**
   * Sembol dokunuşunun karşılığı çağıranın kararı; verilmezse adaylar
   * basılır ama basılabilir değildir (RadarKart ile aynı sözleşme).
   */
  onSembol?: (sym: string) => void;
  /** Açılışta alana düşen tema. Verilmezse alan boş ve ölçüm İSTENMEZ. */
  baslangicSorgu?: string;
};

/**
 * Pazar kodunun TÜRKÇESİ. Motorun makine kodunun karşılığı
 * (api/types.ts `Market` = 'US' | 'BIST') — yeni bir pazar değil.
 * Küme dışı bir kod gelirse OLDUĞU GİBİ basılır, uydurma ad konmaz.
 */
const PAZAR_AD: Record<Market, string> = {
  US: 'ABD',
  BIST: 'Borsa İstanbul',
};

function pazarAdi(m: Market | string): string {
  return PAZAR_AD[m as Market] ?? m;
}

export function TemaKart({ onSembol, baslangicSorgu }: TemaKartProps) {
  const { colors } = useTheme();
  const bas = (baslangicSorgu ?? '').trim().slice(0, AZAMI_SORGU);
  const [metin, setMetin] = useState(bas);
  const [sorgu, setSorgu] = useState(bas);

  const cagri = useCallback((signal: AbortSignal) => fetchTheme(sorgu, { signal }), [sorgu]);
  const { durum, veri, hata, yenile } = useIstek(cagri, 'tema:' + sorgu, {
    etkin: sorgu.length > 0,
  });

  // 200 + `error` = ÖLÇEMEDİM. Çeviri istemcide tek yerde (`temaKodMetni`).
  const kod = temaKodMetni(veri?.error);
  const adaylar: ThemeCandidate[] = veri?.candidates ?? [];

  return (
    <Card
      title="🔭 Tema"
      subtitle={
        sorgu
          ? sorgu + ' · /api/theme — aday listesi, al/sat işareti değil'
          : 'Bir tema yaz — aday listesi, al/sat işareti değil'
      }>
      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder="Örn. yapay zeka, savunma, robotik"
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        maxLength={AZAMI_SORGU}
        returnKeyType="search"
        onSubmitEditing={() => setSorgu(metin.trim())}
        accessibilityLabel="Tema arama alanı"
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
      <Dugme
        label="Tema ara"
        variant="outline"
        tone="info"
        onPress={() => setSorgu(metin.trim())}
        disabled={!metin.trim()}
      />

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={2}
        sekil="metin"
        bosMetin="Tema henüz sorulmadı — bir tema yaz ve “Tema ara”ya bas."
      />

      {durum === 'veri' ? (
        kod ? (
          // ÖLÇEMEDİM: 200 geldi ama arama HİÇ yapılmadı (bkz. başlık).
          // "Yeniden dene" düğmesi BİLEREK YOK: tekrar aynı 200'ü verir.
          <OlcemedimKutu metin={kod} />
        ) : !adaylar.length ? (
          <VeriYok kartsiz metin={'“' + sorgu + '” için motor aday döndürmedi.'} />
        ) : (
          <>
            {adaylar.map((a) => (
              <AdaySatiri key={a.market + ':' + a.symbol} aday={a} onSembol={onSembol} />
            ))}
            {/* Aday sayısı UCUN döndürdüğü satır sayısı; burada süzme yok. */}
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {adaylar.length +
                ' aday uçtan geldi' +
                (veri?.model ? ' · model ' + veri.model : '') +
                '. Bu bir aday listesidir; sıralama, skor ve eşik taşımaz.'}
            </Text>
          </>
        )
      ) : null}
    </Card>
  );
}

/**
 * Tek aday. Dört bilgi de UÇTAN: sembol, pazar kodu, şirket adı ve
 * gerekçe metni. `name`/`reason` `null` gelebilir — boş dizge BASILMAZ,
 * satır o alanı hiç çizmez ya da eksikliğini yazar.
 */
function AdaySatiri({
  aday,
  onSembol,
}: {
  aday: ThemeCandidate;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();

  const govde = (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {aday.symbol}
        </Text>
        <View style={styles.bosluk} />
        <Pill label={pazarAdi(aday.market)} tone="neutral" variant="outline" glyph={null} size="sm" />
      </View>

      {aday.name ? (
        <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={2}>
          {aday.name}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Şirket adı uçtan gelmedi.
        </Text>
      )}

      {aday.reason ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'gerekçe (uçtan): ' + aday.reason}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Uç bu aday için gerekçe yazmadı.
        </Text>
      )}
    </View>
  );

  if (!onSembol) return govde;

  return (
    <Pressable
      onPress={() => onSembol(aday.symbol)}
      accessibilityRole="button"
      accessibilityLabel={aday.symbol + ' — hisse sayfasına git'}
      style={({ pressed }) => (pressed ? { backgroundColor: colors.bgPressed } : null)}>
      {govde}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  alan: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
});
