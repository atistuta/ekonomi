// =====================================================================
//  GrahamKart — 📐 Benjamin Graham's Formula          (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `analiz.graham` ölçümü — formülün verdiği değer, fiyatın o
//  değerin ALTINDA mı ÜSTÜNDE mi olduğu ve sapma yüzdesi. Webdeki
//  "📐 Benjamin Graham's Formula" bölümünün native karşılığı.
//
//  NEDEN AYRI KART, TemelKart'ın İÇİNDE DEĞİL: bu katman BİLEŞKE SKORA
//  DAHİL DEĞİL (İçsel Değer/DCF katmanı gibi). Temel kartın içine
//  konsa, 0-100 temel skoru besleyen bir ölçümmüş gibi okunurdu.
//  Kartın alt başlığı bunu EKRANDA da yazıyor.
//
//  EK AĞ TURU YOK: ekranın elindeki `AnalyzeRow` okunuyor
//  (`/hisse/[sembol].tsx`'in "NEDEN TEK İSTEK" kuralı).
//
//  BURADA HESAP YOK: ne taban F/K, ne büyüme çarpanı, ne Graham
//  Sayısının sabiti. Sapma yüzdesini de istemci çıkarmıyor — `diffPct`
//  telden HAM geliyor. Basılan çarpan ucun `impliedPE` alanı; etiketi
//  `lib/sozluk.ts`te, değeri motorda.
//
//  ÜÇ "YOK" HÂLİ AYRI ÇİZİLİYOR (types.ts Graham notu): alan HİÇ
//  gelmediyse "uç göndermedi", `null` ise "ölçülemedi", `ok: false` ise
//  motorun NEDEN kodu. Üçünü tek cümleye indirmek, uç sürümü eski
//  olduğunda "bu hisseye uygulanamaz" demek olurdu — yanlış olurdu.
//
//  `gClamped` SAKLANMIYOR: ham büyüme formülün sınırına kırpıldıysa
//  ekran bunu söylüyor ve ham değeri de basıyor; sessiz kırpma, motorun
//  kullandığı girdiyi gizlemek olurdu.
//
//  TON: Graham büyüme formülünü hisse SEÇİMİ aracı olarak önermedi;
//  kart yalnız KONUM bildiriyor, ne yapılacağını söylemiyor (dipnot).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import type { AnalyzeRow } from '@/api';
import { Card, OlcemedimKutu, OlcumBaslik, Pill, VeriYok } from '@/components';
import { formatOran, formatPercent, formatPrice } from '@/lib/format';
import {
  GRAHAM_ALT_BASLIK,
  GRAHAM_ALTINDA,
  GRAHAM_BASLIK,
  GRAHAM_BUYUME_ETIKET,
  GRAHAM_CARPAN_ETIKET,
  GRAHAM_DDB_ETIKET,
  GRAHAM_DEGER_ETIKET,
  GRAHAM_FARK_ETIKET,
  GRAHAM_GONDERILMEDI,
  GRAHAM_HAM_BUYUME_ETIKET,
  GRAHAM_HBK_ETIKET,
  GRAHAM_KIRPMA_NOTU,
  GRAHAM_NEDEN_ROZET,
  GRAHAM_NEDEN_SOZLUK,
  GRAHAM_OLCULEMEDI,
  GRAHAM_ROZET,
  GRAHAM_ROZET_SOZLUK,
  GRAHAM_SAYI_ETIKET,
  GRAHAM_SAYI_NOTU,
  GRAHAM_USTUNDE,
  GRAHAM_UYARI,
} from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

export type GrahamKartProps = {
  satir: AnalyzeRow;
};

export function GrahamKart({ satir }: GrahamKartProps) {
  const { colors } = useTheme();
  // `undefined` ≠ `null`: ilki "uç bu alanı göndermedi", ikincisi
  // "gönderdi ama ölçemedi". `in` yerine alan okuması yeterli, çünkü
  // tür `graham?: Graham | null`.
  const graham = satir.analiz?.graham;

  const dipnot = (
    <Text style={[type.micro, styles.dipnot, { color: colors.textFaint }]}>{GRAHAM_UYARI}</Text>
  );

  // ① Alan HİÇ gelmedi — uç sürümü bu ölçümü üretmiyor.
  if (graham === undefined) {
    return (
      <Card title={'📐 ' + GRAHAM_BASLIK} subtitle={GRAHAM_ALT_BASLIK}>
        <OlcemedimKutu metin={GRAHAM_GONDERILMEDI} />
        {dipnot}
      </Card>
    );
  }

  // ② Uç gönderdi, ölçülemedi.
  if (graham === null) {
    return (
      <Card title={'📐 ' + GRAHAM_BASLIK} subtitle={GRAHAM_ALT_BASLIK}>
        <OlcemedimKutu metin={GRAHAM_OLCULEMEDI} />
        {dipnot}
      </Card>
    );
  }

  // ③ Ölçüldü, formül UYGULANAMADI — motorun neden kodu.
  if (!graham.ok) {
    const neden = graham.reason;
    return (
      <Card
        title={'📐 ' + GRAHAM_BASLIK}
        subtitle={GRAHAM_ALT_BASLIK}
        right={
          neden ? (
            <Pill label={GRAHAM_NEDEN_ROZET[neden]} tone="neutral" glyph={null} size="sm" />
          ) : null
        }>
        <VeriYok metin={neden ? GRAHAM_NEDEN_SOZLUK[neden] : GRAHAM_OLCULEMEDI} kartsiz />
        {dipnot}
      </Card>
    );
  }

  // ④ Ölçüldü. Para birimi pazarın: `index.tsx`'teki eşlemeyle aynı —
  // bilinmiyorsa simge UYDURULMAZ (format.ts `formatPrice`).
  const pazar = graham.market ?? satir.market;
  const kur = pazar === 'BIST' ? 'TRY' : null;

  // ALTINDA / ÜSTÜNDE sözcüğü ROZETTEN değil `diffPct`in işaretinden
  // geliyor; ikisi aynı ölçümün iki yüzü ve sözcük motorun sayısını
  // tekrar yorumlamıyor. `diffPct` yoksa sözcük de yok.
  const fark = graham.diffPct;
  const yon = fark == null ? null : fark < 0 ? GRAHAM_ALTINDA : GRAHAM_USTUNDE;

  return (
    <Card
      title={'📐 ' + GRAHAM_BASLIK}
      subtitle={GRAHAM_ALT_BASLIK}
      right={<Pill label={GRAHAM_ROZET[graham.badge]} tone="neutral" glyph={null} size="sm" />}>
      {/* Konum cümlesi — motorun rozeti, uzun hâli. */}
      <Text style={[type.small, { color: colors.text }]}>
        {GRAHAM_ROZET_SOZLUK[graham.badge]}
      </Text>

      <View style={styles.liste}>
        <Satir etiket={GRAHAM_DEGER_ETIKET} deger={formatPrice(graham.value, kur)} />
        <Satir
          etiket={GRAHAM_FARK_ETIKET}
          isaret={fark == null ? null : fark < 0 ? '▼' : '▲'}
          deger={formatPercent(fark, 1) + (yon ? ' ' + yon : '')}
          erisimEtiketi={GRAHAM_FARK_ETIKET + ' ' + formatPercent(fark, 1) + (yon ? ' ' + yon : '')}
        />
        <Satir etiket={GRAHAM_CARPAN_ETIKET} deger={formatOran(graham.impliedPE, 1)} />
        <Satir
          etiket={GRAHAM_BUYUME_ETIKET}
          deger={formatPercent(graham.gUsed, 1)}
          not={graham.gClamped ? GRAHAM_KIRPMA_NOTU : undefined}
        />
        {/* Ham büyüme YALNIZ kırpma varken basılıyor: kırpma yoksa
            `gRaw` ile `gUsed` aynı sayıdır, iki satır gürültü olurdu. */}
        {graham.gClamped ? (
          <Satir etiket={GRAHAM_HAM_BUYUME_ETIKET} deger={formatPercent(graham.gRaw, 1)} />
        ) : null}
        <Satir etiket={GRAHAM_HBK_ETIKET} deger={formatPrice(graham.eps, kur)} />
        <Satir etiket={GRAHAM_DDB_ETIKET} deger={formatPrice(graham.bvps, kur)} />
      </View>

      {/* Graham Sayısı AYRI bir ölçüt — kendi bölüm başlığıyla, ki
          büyüme formülünün bir satırı sanılmasın. DDB yoksa ölçüt hiç
          kurulamaz; o hâlde bölüm hiç çizilmiyor (boş satır basmıyoruz). */}
      {graham.grahamNumber != null ? (
        <View style={styles.bolum}>
          <OlcumBaslik baslik={GRAHAM_SAYI_ETIKET} not={GRAHAM_SAYI_NOTU} />
          <Satir etiket={GRAHAM_SAYI_ETIKET} deger={formatPrice(graham.grahamNumber, kur)} />
          <Satir
            etiket={GRAHAM_FARK_ETIKET}
            isaret={graham.gnDiffPct == null ? null : graham.gnDiffPct < 0 ? '▼' : '▲'}
            deger={formatPercent(graham.gnDiffPct, 1)}
          />
        </View>
      ) : null}

      {dipnot}
    </Card>
  );
}

const styles = StyleSheet.create({
  liste: { gap: space.xs, marginTop: space.sm },
  bolum: { marginTop: space.md },
  dipnot: { marginTop: space.sm },
});
