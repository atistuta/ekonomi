// =====================================================================
//  Durum — yükleniyor · hata · boş ÜÇLÜSÜNÜN TEK GÖVDESİ (FAZ 2/native)
// ---------------------------------------------------------------------
//  NE: `useIstek`in döndürdüğü durumu ekrana çevirir. Ekranlar yalnız
//  "veri" hâlini kendileri çizer; diğer üç hâl BURADA.
//
//  NEDEN TEK KOMPONENT: ürün kuralı "üç durum HER ekranda gerçek olsun".
//  Beş ekran bunu ayrı ayrı yazsaydı, beş farklı hata metni, iki tane
//  "yeniden dene" düğmesi olmayan ekran ve bir tane de sonsuz iskelet
//  çıkardı. Tek gövde = tek davranış.
//
//  NEDEN HATA METNİ UÇTAN GELİYOR: `ApiError.message` istemci tarafında
//  üretilmiyor; `client.ts` motorun kodunu (`code`) Türkçe cümleye
//  çeviriyor. Burada ikinci bir metin yazmak, aynı olayın iki farklı
//  anlatımı demekti.
//
//  NEDEN 'veri yok' İLE 'ölçemedim' AYRI: projenin çıpası.
//    · `kind === 'no-data'`   → ÖLÇTÜM, sonuç yok (veri cevabı).
//    · `kind === 'unmeasured'`→ ÖLÇEMEDİM (ağ/kesinti) → yeniden dene.
//  İkisini aynı kutuda göstermek kullanıcıya yalan söylemek olurdu.
//
//  BURADA HESAP YOK: bu dosya hiçbir skor/eşik/bant üretmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { Dugme } from './Dugme';
import { Pill } from './Pill';
import { SkeletonRow } from './Skeleton';
import type { ApiError } from '@/api/client';
import type { IstekDurum } from '@/api/istek';
import { kesintiSayisi, olcumEksik, type Sayac } from '@/api/types';
import { space, type, useTheme } from '@/theme';

export type DurumProps = {
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** 'bos' hâlinde (henüz sorulmadı) gösterilecek yönlendirme. */
  bosMetin?: string;
  /** Kaç iskelet satırı — ekranın beklenen satır sayısı. */
  iskelet?: number;
};

/**
 * Üç hâli çizer; `durum === 'veri'` ise `null` döner (ekran kendi
 * içeriğini basar). Böylece çağrı yeri tek satır olur.
 */
export function Durum({ durum, hata, yenile, bosMetin, iskelet = 3 }: DurumProps) {
  const { colors } = useTheme();

  if (durum === 'veri') return null;

  if (durum === 'bos') {
    return (
      <Card>
        <Text style={[type.small, { color: colors.textDim }]}>
          {bosMetin ?? 'Henüz bir ölçüm istenmedi.'}
        </Text>
      </Card>
    );
  }

  if (durum === 'yukleniyor') {
    return (
      <Card>
        <View style={styles.iskelet}>
          {Array.from({ length: iskelet }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          Ölçülüyor… motor uçları ilk istekte yavaş olabilir.
        </Text>
      </Card>
    );
  }

  // durum === 'hata'
  const olcemedim = hata?.kind !== 'no-data';
  return (
    <Card>
      <View style={styles.basliksatir}>
        <Pill
          label={olcemedim ? 'ölçemedim' : 'veri yok'}
          tone={olcemedim ? 'gold' : 'neutral'}
          glyph={null}
          size="sm"
        />
      </View>
      <Text style={[type.small, { color: colors.text, marginTop: space.sm }]}>
        {hata?.message ?? 'Ölçüm yapılamadı.'}
      </Text>
      {olcemedim ? (
        <Dugme label="Yeniden dene" onPress={yenile} style={{ marginTop: space.md }} />
      ) : null}
    </Card>
  );
}

export type VeriYokProps = {
  /** Ne arandı — "veri yok" cümlesini somut yapar. */
  metin: string;
};

/**
 * ÖLÇÜLDÜ ama sonuç BOŞ hâli. Hata değil, veri cevabı: "yeniden dene"
 * düğmesi bilinçli olarak YOK — tekrar denemek aynı boş sonucu verir.
 */
export function VeriYok({ metin }: VeriYokProps) {
  const { colors } = useTheme();
  return (
    <Card>
      <Pill label="veri yok" tone="neutral" glyph={null} size="sm" />
      <Text style={[type.small, { color: colors.textDim, marginTop: space.sm }]}>{metin}</Text>
    </Card>
  );
}

export type OlcumNotuProps = {
  /** Uç cevabının kendisi ya da tek satır — `tam` + `sayac` taşıyan nesne. */
  kaynak: { tam?: boolean; sayac?: Sayac } | null | undefined;
};

/**
 * "Bu turda şu kadar dış istek kesildi" notu.
 *
 * NEDEN GÖSTERİLİYOR: ekranda bir skor `—` ise kullanıcının hakkı
 * sebebini bilmek. `sayac.sec.yok` ise bu bir VERİ cevabı (şirketin o
 * dosyası SEC'te yok), kesinti DEĞİL — o yüzden ayrı cümle.
 */
export function OlcumNotu({ kaynak }: OlcumNotuProps) {
  const { colors } = useTheme();
  if (!kaynak) return null;
  const kesinti = kesintiSayisi(kaynak.sayac);
  const secYok = kaynak.sayac?.sec.yok ?? 0;
  if (!olcumEksik(kaynak) && !secYok) return null;

  const cumleler: string[] = [];
  if (kesinti > 0) cumleler.push(kesinti + ' dış istek kesildi — o kalemler ölçülemedi.');
  if (secYok > 0) cumleler.push(secYok + ' kalem SEC arşivinde yok (veri cevabı, kesinti değil).');
  if (!cumleler.length && kaynak.tam === false) cumleler.push('Tur eksik tamamlandı.');

  return (
    <Text style={[type.micro, { color: colors.textFaint, marginTop: space.xs }]}>
      {cumleler.join(' ')}
    </Text>
  );
}

const styles = StyleSheet.create({
  iskelet: { gap: space.sm },
  basliksatir: { flexDirection: 'row', alignItems: 'center' },
});
