// =====================================================================
//  Durum — yükleniyor · boş · DÖRT HATA TÜRÜ tek gövdede (FAZ 3/native)
// ---------------------------------------------------------------------
//  NE: `useIstek`in döndürdüğü durumu ekrana çevirir. Ekranlar yalnız
//  "veri" hâlini kendileri çizer; diğer bütün hâller BURADA.
//
//  NEDEN TEK KOMPONENT: ürün kuralı "durumlar HER ekranda gerçek olsun".
//  Beş ekran bunu ayrı ayrı yazsaydı, beş farklı hata metni, iki tane
//  "yeniden dene" düğmesi olmayan ekran ve bir tane de sonsuz iskelet
//  çıkardı. Tek gövde = tek davranış.
//
//  NEDEN HATA METNİ UÇTAN GELİYOR: `ApiError.message` istemci tarafında
//  üretilmiyor; `client.ts` motorun kodunu (`code`) Türkçe cümleye
//  çeviriyor. Burada ikinci bir metin yazmak, aynı olayın iki farklı
//  anlatımı demekti. Buradaki EK cümleler o metnin yerine geçmiyor,
//  ALTINA "ne yapmalı"yı koyuyor.
//
//  ── DÖRT TÜR DÖRT AYRI KUTU (FAZ 3'te kapandı) ─────────────────────
//  Önceki sürüm `kind !== 'no-data'` diye İKİYE bölüyordu; `bad-request`
//  böylece "ölçemedim" kutusuna düşüyor ve YANINA "Yeniden dene" düğmesi
//  alıyordu. Bu iki kez yanlıştı: (1) 400 bizim isteğimizin sorunu,
//  ölçüm kesintisi değil; (2) aynı isteği tekrarlamak aynı 400'ü verir,
//  yani düğme çalışıyormuş gibi görünen bir yalan.
//    · 'no-data'     → ÖLÇTÜM, sonuç yok. Düğme YOK (aynı boş sonuç).
//    · 'unmeasured'  → ÖLÇEMEDİM (ağ/zaman aşımı/5xx). Düğme VAR.
//    · 'bad-request' → İSTEK HATALI (4xx). Düğme YOK, girdi düzeltilir.
//    · 'canceled'    → hata DEĞİL. Hiçbir kutu basılmaz.
//
//  NEDEN OFFLINE AYRI PAKETLE ÖLÇÜLMÜYOR: `expo-network` de
//  `@react-native-community/netinfo` de KURULU DEĞİL (ölçüldü:
//  mobile/package.json) ve bu iş için yeni bağımlılık eklenmedi. Elimizde
//  ölçülmüş tek ayrım `ApiError.status`: doluysa sunucuya ULAŞILDI (5xx /
//  okunamayan gövde), boşsa `fetch` hiç cevap alamadı (ağ yok ya da
//  zaman aşımı). İkinci hâlde "İnternet yok" DEMİYORUZ — ölçmedik;
//  "ağ ya da sunucu erişilemedi, hangisi olduğunu ölçemedim" diyoruz.
//
//  NEDEN 'ölçüm eksik' AYRI BİR ROZET: HTTP 200 de eksik ölçüm taşır
//  (`tam:false` / `sayac.*.kesinti>0`). Bu bir HATA değil, o yüzden
//  veriyi gizlemez; verinin ÜSTÜNDE durur ve neyin ölçülemediğini söyler.
//
//  BURADA HESAP YOK: bu dosya hiçbir skor/eşik/bant üretmez.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { Dugme } from './Dugme';
import { Pill } from './Pill';
import {
  SkeletonChart,
  SkeletonRow,
  SkeletonScoreCard,
  SkeletonSiraRow,
  SkeletonText,
} from './Skeleton';
import type { ApiError } from '@/api/client';
import type { IstekDurum } from '@/api/istek';
import {
  haberOlcumEksik,
  kesintiSayisi,
  olcumEksik,
  type HaberSayac,
  type Sayac,
} from '@/api/types';
import { space, type, useTheme } from '@/theme';

/**
 * Bekleme iskeletinin şekli — ekranın GERÇEKTEN beklediği içerik.
 * Yanlış şekil seçmek, iskeletin tek işini (içerik yerleşince düzen
 * sıçramasın) bozar.
 */
export type IskeletSekil = 'satir' | 'skor' | 'grafik' | 'sira' | 'metin';

export type DurumProps = {
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /** 'bos' hâlinde (henüz sorulmadı) gösterilecek yönlendirme. */
  bosMetin?: string;
  /** Kaç iskelet parçası — ekranın beklenen satır/kart sayısı. */
  iskelet?: number;
  /** İskeletin şekli. Varsayılan liste satırı. */
  sekil?: IskeletSekil;
  /**
   * Kutuyu `Card` içine sarma — çağıran zaten bir `Card`ın içindeyse
   * (ör. Bugün / Arama kartları) iç içe iki kart kenarı çizilmesin.
   */
  kartsiz?: boolean;
};

/**
 * Veri DIŞINDAKİ bütün hâlleri çizer; `durum === 'veri'` ise `null`
 * döner (ekran kendi içeriğini basar). Böylece çağrı yeri tek satır olur.
 */
export function Durum({
  durum,
  hata,
  yenile,
  bosMetin,
  iskelet = 3,
  sekil = 'satir',
  kartsiz = false,
}: DurumProps) {
  const { colors } = useTheme();

  if (durum === 'veri') return null;

  if (durum === 'bos') {
    return (
      <Kutu kartsiz={kartsiz}>
        <Text style={[type.small, { color: colors.textDim }]}>
          {bosMetin ?? 'Henüz bir ölçüm istenmedi.'}
        </Text>
      </Kutu>
    );
  }

  if (durum === 'yukleniyor') {
    return (
      <Kutu kartsiz={kartsiz}>
        <View style={styles.iskelet} accessible accessibilityLabel="içerik yükleniyor">
          <Iskelet sekil={sekil} adet={iskelet} />
        </View>
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          Ölçülüyor… motor uçları ilk istekte yavaş olabilir.
        </Text>
      </Kutu>
    );
  }

  // durum === 'hata' — ama "hata" dört ayrı şey demek olabilir.
  // İptal hiçbir şey göstermez: `useIstek` zaten durumu bozmuyor, bu
  // dal yalnız savunma amaçlı (başka bir çağrı yeri iptali hata olarak
  // geçirirse kullanıcı kırmızı kutu görmesin).
  if (hata?.kind === 'canceled') return null;

  const t = hataTonu(hata);
  return (
    <Kutu kartsiz={kartsiz}>
      <View style={styles.basliksatir}>
        <Pill label={t.etiket} tone={t.ton} glyph={null} size="sm" />
      </View>
      <Text style={[type.small, { color: colors.text, marginTop: space.sm }]}>
        {hata?.message ?? 'Ölçüm yapılamadı.'}
      </Text>
      {t.altMetin ? (
        <Text style={[type.micro, { color: colors.textDim, marginTop: space.xs }]}>
          {t.altMetin}
        </Text>
      ) : null}
      {t.tekrar ? (
        <Dugme label="Yeniden dene" onPress={yenile} style={{ marginTop: space.md }} />
      ) : null}
    </Kutu>
  );
}

/**
 * Kutunun kabı. `kartsiz` ise şeffaf `View`, değilse `Card`.
 *
 * NEDEN TEK KOMPONENT, NEDEN `kartsiz ? Govde : Card` DEĞİL: iki ayrı
 * komponenti bir değişkende birleştirmek TS'te birleşim imzası üretir ve
 * JSX çağrısı prop'ları kesişimde arar; bu sarmalayıcı o sorunu doğurmaz.
 */
function Kutu({ kartsiz, children }: { kartsiz: boolean; children?: ReactNode }) {
  if (kartsiz) return <View>{children}</View>;
  return <Card>{children}</Card>;
}

/**
 * Hata türünün EKRANDAKİ karşılığı. Tek karar yeri: bir ekran yanlışlıkla
 * `bad-request`e "yeniden dene" koyamasın.
 *
 * `altMetin` kullanıcıya NE YAPACAĞINI söyler; olayın anlatımı (`message`)
 * uçtan gelir ve burada tekrar edilmez.
 */
function hataTonu(hata: ApiError | null): {
  etiket: string;
  ton: 'neutral' | 'gold' | 'info';
  altMetin: string | null;
  tekrar: boolean;
} {
  if (hata?.kind === 'no-data') {
    return {
      etiket: 'veri bulunamadı',
      ton: 'neutral',
      // Hata DEĞİL, veri cevabı. Tekrar denemek aynı boşluğu verir.
      altMetin: 'Motor ölçtü ve sonuç dönmedi. Yeniden denemek aynı sonucu verir.',
      tekrar: false,
    };
  }
  if (hata?.kind === 'bad-request') {
    return {
      etiket: 'istek hatalı',
      ton: 'info',
      altMetin: 'Girdiyi düzeltmek gerekiyor; aynı istek yeniden de aynı yanıtı verir.',
      tekrar: false,
    };
  }
  // 'unmeasured' (ve tür bilinmiyorsa en güvenli varsayım: ölçemedik).
  return {
    etiket: 'ölçemedim',
    ton: 'gold',
    altMetin:
      hata?.status == null
        ? // `fetch` hiç cevap almadı. Hangisi olduğunu ÖLÇMEDİK: cihazda
          // ağ durumu okuyacak paket kurulu değil (bkz. dosya başlığı).
          'Ağ ya da sunucu erişilemedi — hangisi olduğunu ölçemedim.'
        : 'Sunucuya ulaşıldı ama ölçüm tamamlanmadı.',
    tekrar: true,
  };
}

/** Şekle göre iskelet parçaları. */
function Iskelet({ sekil, adet }: { sekil: IskeletSekil; adet: number }) {
  const n = Math.max(1, adet);
  if (sekil === 'grafik') return <SkeletonChart />;
  if (sekil === 'metin') return <SkeletonText lines={n} />;
  if (sekil === 'skor') {
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <SkeletonScoreCard key={i} />
        ))}
      </>
    );
  }
  if (sekil === 'sira') {
    return (
      <>
        {Array.from({ length: n }, (_, i) => (
          <SkeletonSiraRow key={i} />
        ))}
      </>
    );
  }
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </>
  );
}

export type OlcemedimKutuProps = {
  /** Ne olduğunu anlatan cümle — uçtan gelen kod/metin. */
  metin: string;
  /**
   * Verilirse "Yeniden dene" düğmesi çizilir. VERİLMEZSE çizilmez:
   * tekrarın işe yaramayacağı hâllerde (ör. sunucuda anahtar yok, uç
   * 200 dönüyor) düğme koymak çalışıyormuş gibi görünen bir yalandır.
   */
  yenile?: () => void;
  kartsiz?: boolean;
};

/**
 * "ÖLÇEMEDİM" kutusu — `ApiError` OLMADAN.
 *
 * NEDEN AYRI BİR GİRİŞ VAR: bazı uçlar HTTP 200 döndürüp gövdede
 * "arama yapılamadı" kodu taşıyor (ör. Arama ekranının tema yolu,
 * sunucuda anahtar yoksa). Bu `useIstek` için başarıdır, kullanıcı için
 * değildir. Ekranda elle ikinci bir rozet+metin çizmek `Durum`un hata
 * kutusunun kopyası olurdu; uydurma bir `ApiError` üretmek de yalan
 * olurdu (ortada hata nesnesi yok). Bu yüzden kutunun GÖVDESİ burada
 * paylaşılıyor, kural tek yerde kalıyor.
 */
export function OlcemedimKutu({ metin, yenile, kartsiz = true }: OlcemedimKutuProps) {
  const { colors } = useTheme();
  return (
    <Kutu kartsiz={kartsiz}>
      <View style={styles.basliksatir}>
        <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
      </View>
      <Text style={[type.small, { color: colors.text, marginTop: space.sm }]}>{metin}</Text>
      {yenile ? (
        <Dugme label="Yeniden dene" onPress={yenile} style={{ marginTop: space.md }} />
      ) : null}
    </Kutu>
  );
}

export type VeriYokProps = {
  /** Ne arandı — "veri yok" cümlesini somut yapar. */
  metin: string;
  /** Kart kenarı istemeyen çağrı yerleri için (zaten bir Card içinde). */
  kartsiz?: boolean;
};

/**
 * ÖLÇÜLDÜ ama sonuç BOŞ hâli. Hata değil, veri cevabı: "yeniden dene"
 * düğmesi bilinçli olarak YOK — tekrar denemek aynı boş sonucu verir.
 */
export function VeriYok({ metin, kartsiz = false }: VeriYokProps) {
  const { colors } = useTheme();
  return (
    <Kutu kartsiz={kartsiz}>
      <Pill label="veri yok" tone="neutral" glyph={null} size="sm" />
      <Text style={[type.small, { color: colors.textDim, marginTop: space.sm }]}>{metin}</Text>
    </Kutu>
  );
}

export type OlcumNotuProps = {
  /** Uç cevabının kendisi ya da tek satır — `tam` + `sayac` taşıyan nesne. */
  kaynak: { tam?: boolean; sayac?: Sayac } | null | undefined;
};

/**
 * Eksik ölçümün CÜMLELERİ: "bu turda şu kadar dış istek kesildi".
 * Rozetsiz, künye satırı olarak kullanılır (ör. grafik kartının dibi).
 *
 * NEDEN GÖSTERİLİYOR: ekranda bir skor `—` ise kullanıcının hakkı
 * sebebini bilmek. `sayac.sec.yok` ise bu bir VERİ cevabı (şirketin o
 * dosyası SEC'te yok), kesinti DEĞİL — o yüzden ayrı cümle.
 */
export function OlcumNotu({ kaynak }: OlcumNotuProps) {
  const { colors } = useTheme();
  const cumleler = olcumCumleleri(kaynak);
  if (!cumleler.length) return null;

  return (
    <Text style={[type.micro, { color: colors.textFaint, marginTop: space.xs }]}>
      {cumleler.join(' ')}
    </Text>
  );
}

/**
 * EKSİK ÖLÇÜM ROZETİ — verinin ÜSTÜNE konur.
 *
 * NEDEN ROZET, NEDEN KÜNYE DEĞİL: HTTP 200 + `tam:false` bir "başarı"
 * değil. Bunu verinin altında soluk bir künye satırı olarak yazmak,
 * eksik ölçümü tam ölçüm gibi sunmak demekti — kullanıcı sayıları
 * okuduktan SONRA, okuduğu şeyin eksik olduğunu öğreniyordu. Rozet
 * sayıların önünde durur.
 *
 * NEDEN VERİYİ GİZLEMİYOR: eksik ölçüm hata değil; gelen kalemler
 * gerçekten ölçüldü. Veriyi saklamak ölçülmüş bilgiyi çöpe atmak olurdu.
 * Ölçüm tamsa `null` döner ve ekranda hiçbir şey eklemez.
 */
export function OlcumEksikRozet({ kaynak }: OlcumNotuProps) {
  const { colors } = useTheme();
  const cumleler = olcumCumleleri(kaynak);
  if (!cumleler.length) return null;

  return (
    <View style={[styles.rozet, { borderColor: colors.border }]}>
      <Pill label="ölçüm eksik" tone="gold" glyph={null} size="sm" />
      <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>{cumleler.join(' ')}</Text>
    </View>
  );
}

export type HaberOlcumNotuProps = {
  /** `tam` + `sayac` taşıyan HABER gövdesi (`/api/news`, `/api/pulse`). */
  kaynak: { tam?: boolean; sayac?: HaberSayac } | null | undefined;
};

/**
 * EKSİK ÖLÇÜM ROZETİ — HABER SAYACI sürümü.
 *
 * NEDEN AYRI BİR BİLEŞEN: iki sayaç şekli var ve KARIŞTIRILAMAZ.
 * Skor sayacı `{yahoo, sec, bist, tekrar}`, haber sayacı
 * `{istek, basari, hata, zamanAsimi, kisa, bayt}` (api/_haber.js
 * `bosHaberSayac`). `OlcumEksikRozet`e haber sayacı vermek derlemede
 * patlar — iyi ki patlıyor: `kesintiSayisi()` haber sayacında olmayan
 * alanları okuyup "0 kesinti" diye YANLIŞ bir dürüstlük raporu verirdi.
 *
 * Rozetin GÖVDESİ ve yeri aynı (`styles.rozet`): verinin ÜSTÜNDE durur
 * ve veriyi GİZLEMEZ — gelen manşetler gerçekten okundu.
 */
export function HaberOlcumEksikRozet({ kaynak }: HaberOlcumNotuProps) {
  const { colors } = useTheme();
  const cumleler = haberEksikCumleleri(kaynak);
  if (!cumleler.length) return null;

  return (
    <View style={[styles.rozet, { borderColor: colors.border }]}>
      <Pill label="ölçüm eksik" tone="gold" glyph={null} size="sm" />
      <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>{cumleler.join(' ')}</Text>
    </View>
  );
}

/**
 * Haber tarafının eksik ölçüm cümleleri. "Eksik mi?" sorusunun cevabı
 * TEK YERDE: `haberOlcumEksik()` (api/types.ts) — burada eşik yeniden
 * yazılmıyor.
 */
function haberEksikCumleleri(
  kaynak: { tam?: boolean; sayac?: HaberSayac } | null | undefined,
): string[] {
  if (!kaynak || !haberOlcumEksik(kaynak)) return [];

  const s = kaynak.sayac;
  const cumleler: string[] = [];
  if ((s?.hata ?? 0) > 0) cumleler.push(s!.hata + ' besleme isteği hata verdi.');
  if ((s?.zamanAsimi ?? 0) > 0)
    cumleler.push(s!.zamanAsimi + ' besleme isteği zaman aşımına uğradı.');
  if ((s?.kisa ?? 0) > 0) cumleler.push(s!.kisa + ' besleme gövdesi okunamadı (kısa/bozuk).');
  if (!cumleler.length) cumleler.push('Manşet taraması eksik tamamlandı.');
  return cumleler;
}

/**
 * Eksik ölçümün cümleleri — rozet ve künye AYNI metni kullansın diye
 * tek yerde. İki yere kopyalanırsa biri `sec.yok`u kesinti sayar ve
 * dürüstlük ayrımı sessizce kayar.
 */
function olcumCumleleri(
  kaynak: { tam?: boolean; sayac?: Sayac } | null | undefined,
): string[] {
  if (!kaynak) return [];
  const kesinti = kesintiSayisi(kaynak.sayac);
  const secYok = kaynak.sayac?.sec.yok ?? 0;
  if (!olcumEksik(kaynak) && !secYok) return [];

  const cumleler: string[] = [];
  if (kesinti > 0) cumleler.push(kesinti + ' dış istek kesildi — o kalemler ölçülemedi.');
  if (secYok > 0) cumleler.push(secYok + ' kalem SEC arşivinde yok (veri cevabı, kesinti değil).');
  if (!cumleler.length && kaynak.tam === false) cumleler.push('Tur eksik tamamlandı.');
  return cumleler;
}

const styles = StyleSheet.create({
  iskelet: { gap: space.sm },
  basliksatir: { flexDirection: 'row', alignItems: 'center' },
  rozet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
