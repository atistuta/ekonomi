// =====================================================================
//  🥇 MetalKart — kıymetli maden künyesi               (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderMetals` (app.js:2180) bloğunun YERLİ karşılığı:
//  altın / gümüş / platin için ad, kotasyon para birimi ve fiyat.
//
//  NEDEN `/api/yfin`: ÖLÇÜLDÜ (2026-10-29, üretim):
//    GET /api/yfin?symbols=GC=F,SI=F,PL=F → 200, 3/3 `ok:true`
//    GC=F → name "Gold Dec 26", currency USD, price 4038.1
//    SI=F → "Silver Dec 26", USD, 52.605
//    PL=F → "Platinum Jan 27", USD, 1497.4
//  Aynı üç sembol motorun kendi maden eşlemesinde de var
//  (`/api/deger` METAL_SEMBOL) — yani uydurulmuş bir evren değil.
//
//  WEB'DE OLAN, BURADA OLMAYAN ALANLAR — UÇ YOK (uydurulmadı):
//    · TL/GRAM fiyatlar (gram altın, çeyrek/yarım/tam altın,
//      cumhuriyet altını, gram gümüş). Web bunları `finans.truncgil.com`
//      ham geçişinden alıyor (`api/proxy.js` IZINLI_KONAKLAR); mobilde
//      bu kaynağı veren ÖLÇÜLÜ bir uç YOK ve ham geçiş bir sözleşme
//      değil. USD kotasyonunu TL'ye çevirmek de ölçülmemiş bir kur
//      uydurmak olurdu.
//    · Ziynet kalemleri (çeyrek/yarım/tam/cumhuriyet) Yahoo'da sembolü
//      OLMAYAN ürünler — künye ucundan hiç sorulamıyor.
//    · "Makro Rejim" skoru (`renderMetalFundamental` → `metalMacroHTML`).
//      Bunu veren uç VAR (`/api/deger?tur=gram-altin|gumus|platin`) ama
//      o kart BU ŞERİTTE DEĞİL: `components/detay/DegerKart.tsx` zaten
//      aynı uçtan çiziyor. İkinci bir kart aynı ucu iki ayrı anlık
//      görüntüyle gösterirdi.
//    · Metal haber akışı (Google News RSS, TR + dünya sorguları):
//      `/api/news` sembol/sorgu tabanlı bir uç olarak var, ama bu kartın
//      konusu künye; haber şeridi Bugün/Keşfet şeritlerinin işi.
//
//  BURADA HESAP YOK: `price` olduğu gibi basılır. BİRİM YAZILMAZ —
//  "gram" ya da "ons" demek uçta ÖLÇÜLMEYEN bir birim iddiası olurdu;
//  uç yalnız `currency` veriyor. Web "/ gram" yazıyordu çünkü kaynağı
//  gram fiyatıydı; burada kaynak vadeli sözleşme kotasyonu.
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: `ok:false` → ayrı "ölçemedim" bloğu;
//  `ok:true` + `price == null` → o satırda "fiyat ölçülmedi" rozeti,
//  çıplak sıfır ya da tire DEĞİL.
//
//  NEDEN `fetch` YOK: veri ekranda (`app/(tabs)/analiz.tsx`)
//  `fetchYfin(METAL_SEMBOLLER, { deep: false })` ile çekilir.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { ApiError, IstekDurum, YfinKunye, YfinResponse } from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { formatPrice } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/**
 * Maden evreni — Yahoo vadeli sembolleri. Motorun maden eşlemesiyle
 * (`/api/deger` METAL_SEMBOL: GC=F/SI=F/PL=F) AYNI üç sembol.
 */
export const METAL_SEMBOLLER: readonly string[] = ['GC=F', 'SI=F', 'PL=F'];

/**
 * Türkçe etiketler — ÇEVİRİ, hesap değil. Uç İngilizce ad döndürüyor
 * ("Gold Dec 26"); vade eki uçtan gelen bilginin parçası olduğu için
 * uçtan gelen ad da ayrı satırda AYNEN basılıyor, bu etiket onun yerine
 * geçmiyor.
 */
const METAL_AD: Record<string, string> = {
  'GC=F': 'Altın',
  'SI=F': 'Gümüş',
  'PL=F': 'Platin',
};

export type MetalKartProps = {
  /** `fetchYfin(METAL_SEMBOLLER, { deep: false })` gövdesi. */
  veri: YfinResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
};

export function MetalKart({ veri, durum, hata, yenile }: MetalKartProps) {
  const { colors } = useTheme();

  const kunyeler = veri?.results ?? [];
  const olculemeyen = kunyeler.filter((k) => !k.ok).map((k) => k.symbol);
  const gelenler = kunyeler.filter((k) => k.ok);

  return (
    <Card
      title="🥇 Kıymetli maden"
      subtitle="Altın · gümüş · platin vadeli kotasyonu — /api/yfin künye alanları"
      right={
        durum === 'veri' && gelenler.length ? (
          <Pill label={String(gelenler.length) + ' künye'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="satir"
        kartsiz
        bosMetin="Maden künyesi henüz istenmedi."
      />

      {durum === 'veri' ? (
        kunyeler.length ? (
          <>
            {gelenler.map((k) => (
              <MetalSatiri key={k.symbol} kunye={k} />
            ))}

            {!gelenler.length ? (
              <VeriYok kartsiz metin="Künye ucu üç madenin hiçbirini ölçemedi." />
            ) : null}

            {/* Kullanıcı web'deki TL/gram fiyatını burada aramasın:
                neden olmadığı YAZILI. */}
            <View style={styles.dipnot}>
              <Pill label="ölçülmüyor" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                Fiyatlar uçtan geldiği para biriminde; TL/gram karşılığı ve ziynet kalemleri
                (çeyrek, yarım, tam, cumhuriyet) bu uçta YOK. Birim de uçta yazmadığı için
                gram ya da ons denmiyor.
              </Text>
            </View>

            {olculemeyen.length ? (
              <View style={styles.dipnot}>
                <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {olculemeyen.join(', ') + ' — künye turu düştü, bu sembol ölçülemedi.'}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <VeriYok kartsiz metin="Künye ucu maden evreni için sonuç döndürmedi." />
        )
      ) : null}
    </Card>
  );
}

function MetalSatiri({ kunye }: { kunye: YfinKunye }) {
  const { colors } = useTheme();
  const kur = kunye.currency ?? null;
  const fiyatVar = typeof kunye.price === 'number' && Number.isFinite(kunye.price);
  const etiket = METAL_AD[kunye.symbol] ?? kunye.symbol;

  return (
    <View
      style={[styles.blok, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        etiket +
        ' ' +
        kunye.symbol +
        (fiyatVar ? ', fiyat ' + formatPrice(kunye.price, kur) : ', fiyat ölçülmedi')
      }>
      <View style={styles.basliksatir}>
        <View style={styles.basliksol}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
            {etiket}
          </Text>
          <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
            {kunye.name ? kunye.symbol + ' · ' + kunye.name : kunye.symbol}
          </Text>
        </View>
        <View style={styles.basliksag}>
          {fiyatVar ? (
            <Text style={[type.bodyBold, numeric, { color: colors.text }]}>
              {formatPrice(kunye.price, kur)}
            </Text>
          ) : (
            <Pill label="fiyat ölçülmedi" tone="gold" glyph={null} size="sm" />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blok: {
    gap: space.xs,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  basliksatir: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  basliksol: { flex: 1 },
  basliksag: { alignItems: 'flex-end', gap: space.xxs },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
