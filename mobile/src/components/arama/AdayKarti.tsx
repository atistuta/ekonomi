// =====================================================================
//  🔎 ADAYLAR — çok pazarlı arama, seçimi KULLANICI yapar  (native)
// ---------------------------------------------------------------------
//  NE: `/api/arama` (api/_kesif.js `aramaHandler`) adaylarını listeler.
//  Her aday NE OLDUĞU yazılı geliyor: Borsa İstanbul / ABD / kripto —
//  ya da "hangi pazar olduğunu ÖLÇEMEDİM". Seçimi kullanıcı yapıyor.
//
//  ── NEDEN BU KART VAR (ÖLÇÜLDÜ) ────────────────────────────────────
//  Eski Arama akışı yazılan metni doğrudan skora yolluyordu ve pazarı
//  SUNUCU TAHMİN ediyordu: çıplak `ASELS` sessizce `US` sayılıyor, skor
//  `null` dönüyordu. Çıplak bir terimin hangi pazara ait olduğu
//  ÖLÇÜLMEDEN BİLİNEMEZ. Doğru zincir: /api/arama → kullanıcı seçer →
//  `motorSembol` ile motor ekranı.
//
//  ── TÜRKÇE ETİKET İSTEMCİDE YAZILIYOR ──────────────────────────────
//  Uç `pazar` için KAPALI MAKİNE KODU kümesi döndürüyor
//  ('BIST' | 'US' | 'KRIPTO' | null); `borsa` ham borsa kodu ('IST',
//  'NMS', 'CME'...), `tur` ise Yahoo quoteType. Bunlar makine kodu:
//  Türkçe cümleyi İSTEMCİ kuruyor (aşağıdaki kapalı eşleme). Uçtan
//  Türkçe etiket BEKLENMİYOR, uç böyle bir alan döndürmüyor.
//
//  ── `pazar: null` SAKLANMIYOR ──────────────────────────────────────
//  `null` "bilinmeyen" değil: "borsa kodunu tanımadım, TAHMİN ETMİYORUM"
//  (örn. `CME`, `TOR`, `GER`). Ekranda bu AÇIKÇA "hangi pazar olduğunu
//  ölçemedim" diye görünüyor — gizlenmiyor, boş bırakılmıyor.
//
//  ── ENDEKS ÜYELİĞİ YAZMAK YASAK ────────────────────────────────────
//  Yahoo arama kaydında endeks üyeliği alanı YOK (ölçüldü). "NYSE Arca"
//  yazmak ölçülmüş bilgidir; "S&P 500 hissesi" yazmak uydurma olurdu.
//  Bu kart yalnız ucun döndürdüğü borsa/tür kodunu basıyor.
//
//  ── MOTORA GİDEMEYEN ADAY ──────────────────────────────────────────
//  `motorUc === 'analyze'` → hisse ekranı (`/hisse/[sembol]`).
//  `motorUc === 'chart'`   → motorun skoru YOK, yalnız grafik sözlüğünde
//                            duruyor; bu ekrandan motora yol açılmıyor.
//  `motorUc === null`      → bu varlık için analiz motoru YOK. Kriptoda
//                            sebep ölçülü: motorun pazar kümesi
//                            ['US','BIST'] (api/_ayar.js PAZARLAR).
//  Aday yine LİSTELENİYOR — gizlemek "aradım, bulamadım" yalanı olurdu.
//
//  ── BOŞ LİSTE ≠ ÖLÇEMEDİM ──────────────────────────────────────────
//  `adaylar: [] + tam: true` → "aradım, eşleşme yok" (ÖLÇÜLMÜŞ cevap).
//  `tam: false` → "ölçüm tamamlanmadı". İKİ AYRI DAL, iki ayrı cümle.
//
//  ── SESSİZ KIRPMA YOK ──────────────────────────────────────────────
//  ÖLÇÜLDÜ (api/_kesif.js `aramaHandler`): `adet = adaylar.length` ve uç
//  Yahoo'dan ZATEN yalnız `limit` kayıt istiyor (`quotesCount=limit`).
//  Yani "limit yüzünden dışarıda kalan aday sayısı" HİÇBİR ALANDA YOK.
//  O sayı uydurulmuyor, 0 da yazılmıyor: ekranda ÖLÇÜLMEDİĞİ yazıyor.
//
//  ── HER TUŞA İSTEK ATMIYOR ─────────────────────────────────────────
//  Depoda hazır bir gecikme yardımcısı YOK (ölçüldü: `setTimeout` yalnız
//  `api/client.ts`te). Gecikme burada `setTimeout` ile kuruluyor, iptali
//  `useIstek`in kendi `AbortSignal`i yapıyor — yeni bağımlılık EKLENMEDİ.
//
//  BURADA HESAP YOK: sembol, ad, borsa, tür, sektör, pazar ve motor
//  alanları uçtan geldiği gibi basılıyor. Skor/eşik/ağırlık YOK.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchArama, useIstek, type AramaAday, type AramaPazar } from '@/api';
import { Card, Durum, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

/** Yazma durduktan sonra isteğin atılması için beklenen süre. */
const GECIKME_MS = 400;

/**
 * Pazar makine kodu → Türkçe cümle. KAPALI EŞLEME: kodlar ucun
 * döndürdüğü kümeden (api/_kesif.js `aramaPazar`), çeviri istemcide.
 */
const PAZAR_ETIKET: Record<AramaPazar, string> = {
  BIST: 'Borsa İstanbul',
  US: 'ABD borsası',
  KRIPTO: 'Kripto',
};

/**
 * Pazar işareti — renk TEK TAŞIYICI OLAMAZ, ayrım bir KARAKTERLE de
 * veriliyor (renk körü kullanıcı pazarı yine okuyabilsin).
 */
const PAZAR_ISARET: Record<AramaPazar, string> = {
  BIST: '₺',
  US: '$',
  KRIPTO: '◇',
};

export type AdayKartiProps = {
  /** Kullanıcının YAZDIĞI ham metin. Gecikme bu kartın içinde. */
  terim: string;
};

export function AdayKarti({ terim }: AdayKartiProps) {
  const { colors } = useTheme();

  // Gecikmeli terim: istek bununla atılıyor, yazılan metinle değil.
  const ham = terim.trim();
  const [gecikmeli, setGecikmeli] = useState(ham);
  useEffect(() => {
    if (ham === gecikmeli) return;
    const t = setTimeout(() => setGecikmeli(ham), GECIKME_MS);
    return () => clearTimeout(t);
  }, [ham, gecikmeli]);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchArama(gecikmeli, { signal }),
    [gecikmeli],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'arama:' + gecikmeli, {
    etkin: gecikmeli.length > 0,
  });

  const adaylar: AramaAday[] = veri?.adaylar ?? [];

  return (
    <Card
      title="🔎 Adaylar"
      subtitle={
        gecikmeli ? gecikmeli + ' · /api/arama' : 'Yazmaya başla — pazar TAHMİN EDİLMEZ, seçersin'
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="satir"
        bosMetin="Bir sembol ya da şirket adı yaz — kripto, ABD ve BIST birlikte aranır."
      />

      {durum === 'veri' && veri ? (
        <>
          {/* ÖLÇÜM TAMAMLANMADI: 200 geldi ama tarama bitmedi. Boş
              listeyle AYNI DAL DEĞİL. */}
          {!veri.tam ? (
            <OlcemedimKutu
              metin={
                'Aday taraması TAMAMLANMADI — aşağıdaki liste gelenlerin tamamı olmayabilir. ' +
                'Eksik aday sayısı ölçülmedi.'
              }
              yenile={yenile}
            />
          ) : null}

          {veri.tam && !adaylar.length ? (
            <VeriYok
              kartsiz
              metin={'“' + veri.q + '” için eşleşme yok — aradım, bulunamadı (ölçülmüş cevap).'}
            />
          ) : null}

          {adaylar.map((a, i) => (
            <AdaySatiri key={a.sembol + '#' + i} aday={a} />
          ))}

          {adaylar.length ? (
            <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
              {'Uç ' + veri.adet + ' aday döndü · istenen en çok ' + veri.limit + ' · ' +
                veri.ms + ' ms'}
            </Text>
          ) : null}

          {adaylar.length ? (
            // SESSİZ KIRPMA YOK: dışarıda kalan sayı uçta YOK (başlık
            // notu). 0 yazmak ölçülmemiş bir sayı basmak olurdu.
            <Text style={[type.micro, { color: colors.textDim }]}>
              {'Liste en çok ' + veri.limit +
                ' adayla sınırlı. Sınır yüzünden dışarıda kalan aday sayısı UÇTAN GELMİYOR — ' +
                'ÖLÇÜLMEDİ.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek aday. Yedi alan da UÇTAN: sembol, ad, borsa kodu, tür, sektör,
 * pazar ve motor alanları. Burada türetme, tahmin, endeks üyeliği YOK.
 */
function AdaySatiri({ aday }: { aday: AramaAday }) {
  const { colors } = useTheme();

  const pazar = aday.pazar;
  const motora = aday.motorUc === 'analyze' && aday.motorSembol !== null;

  const govde = (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {aday.sembol}
        </Text>
        <View style={styles.bosluk} />
        {/* NE OLDUĞU: pazar etiketi. `null` GİZLENMİYOR. */}
        <Pill
          label={pazar ? PAZAR_ETIKET[pazar] : 'pazarı ölçemedim'}
          tone={pazar ? 'info' : 'neutral'}
          glyph={pazar ? PAZAR_ISARET[pazar] : '⚠'}
          size="sm"
        />
      </View>

      <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={2}>
        {aday.ad ?? 'Ad uçtan gelmedi.'}
      </Text>

      {/* HAM MAKİNE KODLARI, olduğu gibi. "S&P 500 üyesi" gibi bir
          çıkarım YAPILMIYOR: ucun kaydında öyle bir alan yok. */}
      <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
        {'borsa kodu: ' + (aday.borsa ?? 'uç bildirmedi') +
          ' · tür: ' + (aday.tur ?? 'uç bildirmedi') +
          ' · sektör: ' + (aday.sektor ?? 'uç bildirmedi')}
      </Text>

      {pazar === null ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'Bu borsa kodunu tanımadım, hangi pazar olduğunu ÖLÇEMEDİM — tahmin etmiyorum.'}
        </Text>
      ) : null}

      {motora ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'Dokun → motor bu sembolle ölçer: ' + aday.motorSembol}
        </Text>
      ) : aday.motorUc === 'chart' ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'Bu kalem motorun GRAFİK sözlüğünde (endeks/emtia): analiz motoru bunun için skor ' +
            'üretmiyor, o yüzden buradan motora yol açılmıyor.'}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {pazar === 'KRIPTO'
            ? 'Bu varlık için analiz motoru YOK: motorun pazar kümesi ABD ve BIST. Aday ' +
              'listelenir, ölçülemez.'
            : 'Bu aday için analiz motoru YOK — uç motor sembolü döndürmedi. Aday listelenir, ' +
              'ölçülemez.'}
        </Text>
      )}
    </View>
  );

  if (!motora) return govde;

  return (
    <Pressable
      // `motorSembol` DOĞRUDAN motorun beklediği yazım: BIST'te
      // 'ASELS.IS', ABD'de 'AAPL'. `/hisse/[sembol]` ekranı `pazar` ile
      // soneki zaten doğru kuruyor (ÖLÇÜLDÜ: o ekran `.IS`i koruyor).
      onPress={() =>
        router.push({
          pathname: '/hisse/[sembol]',
          params: { sembol: aday.motorSembol as string, pazar: aday.motorPazar ?? '' },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={
        aday.sembol +
        ' — ' +
        (pazar ? PAZAR_ETIKET[pazar] : 'pazarı ölçülemedi') +
        ' — hisse sayfasına git'
      }
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.basilabilir,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      {govde}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xxs, paddingVertical: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  basilabilir: {
    minHeight: hitSlopMin,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
