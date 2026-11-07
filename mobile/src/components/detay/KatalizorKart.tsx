// =====================================================================
//  📅 KATALİZÖR / RİSK — YAKLAŞAN TEMETTÜ            (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: webdeki hisse sayfasının "Katalizör / Risk" satırının
//  (`app.js` → `fillCatalysts`) native karşılığı.
//
//  WEBDEKİ SATIR ÜÇ BACAKLI, BU KART YALNIZ BİRİNİ BASIYOR — bilinçli:
//    ① OYNAKLIK  → BU KARTTA YOK. `/api/analyze` satırı `oynaklik` ve
//       `atrPlan` kodlarını ZATEN getiriyor ve `RiskOdulKart` onları
//       ZATEN basıyor. Burada ikinci kez istemek aynı ATR'yi iki kez
//       ölçmek, ekranda da aynı cümleyi iki kez yazmak olurdu.
//    ② YAKLAŞAN TEMETTÜ → BU KART. Webde gün farkı ve 45 gün eşiği
//       TARAYICIDA hesaplanıyordu; native hesap YAPMAZ, eşik TAŞIMAZ →
//       karar motora (`katGunFarki` / `katTemettuKod`), hesap
//       `/api/katalizor` ucuna taşındı.
//    ③ HABER UYARISI → bir ÖLÇÜM değil, değişmez bir cümle:
//       `lib/sozluk.ts` → `KATALIZOR_HABER_UYARISI`. Uçtan taşımak
//       serbest Türkçe metin taşımak olurdu (HAM SAYI KURALI §5.1).
//
//  45 GÜN EŞİĞİ BU DOSYADA YOK: eşik motorda. Kart yalnız `kod` okuyor.
//
//  `TemettuKart` İLE ÇAKIŞMIYOR (ölçüldü 2026-11-05): o kart
//  `/api/yfin` künyesinin HAM tarihlerini basıyor (ex günü, ödeme günü)
//  ve gün farkı ya da bant TAŞIMIYOR. Bu kart ölçülen EN YAKIN GELECEK
//  tarihi, kaç gün kaldığını ve bandını basıyor; BIST ayağında kaynak
//  da başka (BIST temettü takvimi, künye değil). İkisini birleştirmek
//  ham künye listesini bant kararıyla aynı gövdeye sokmak olurdu.
//
//  ÜÇ KOD BASILIYOR, WEBDE İKİSİ SUSUYORDU: web eşiğin dışında hiçbir
//  şey yazmıyordu; "temettü var ama uzak" ile "temettü yok" ekranda
//  aynı görünüyordu. Üçü de cümleli — bilgi kaybı kapandı.
//
//  ÖLÇÜLMÜŞ ASİMETRİ: BIST kaynağı ÖDEME gününü, Yahoo künyesi ağırlıklı
//  olarak KESİLME (ex) gününü yayınlıyor. Hangisinin ölçüldüğü
//  (`tarihTuru`) EKRANDA YAZILI — ikisini "temettü tarihi" diye
//  birleştirmek iki farklı günü aynı gün göstermek olurdu.
//
//  SESSİZ KIRPMA YOK: aynı sembolde birden fazla gelecek tarih varsa
//  atılan madde sayısı (`atilan`) ve tarihi okunamayan madde sayısı
//  (`tarihiOkunamayan`) ekranda yazılı.
//
//  BOŞ DEĞER `EMPTY`, ASLA `0`: 0 gün geçerli bir ölçüm (temettü BUGÜN).
//
//  PAZAR ÇAĞIRANDAN GELİR: kart sembolden pazar ÇIKARIMI yapmaz.
//
//  SKORA GİRMEZ: dönen kodların hiçbiri teknik ya da temel skora girdi
//  değildir.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchKatalizor,
  useIstek,
  type KatalizorPazar,
  type KatalizorResponse,
  type KatalizorTemettu,
} from '@/api';
import { Card, Durum, Pill, VeriYok } from '@/components';
import { EMPTY } from '@/lib/format';
import {
  KATALIZOR_HABER_UYARISI,
  KATALIZOR_TARIH_TURU_SOZLUK,
  KATALIZOR_TEMETTU_SOZLUK,
  sozluktenSec,
} from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

// `Satir` KOK BARREL'DA `OlcumSatiri` adiyla duruyor; bu klasorun kendi
// adlandirmasi kullaniliyor. Klasor girisinden ALINMIYOR: o dosya BU
// karti da disa aciyor, dongu olurdu.
import { Satir } from './Satir';

export type KatalizorKartProps = {
  /** Uca gidecek sembol — çağıranın yazımı. */
  sembol: string;
  /** Pazar ÇAĞIRANDAN gelir; istemci pazar ÇIKARIMI yapmaz. */
  pazar: KatalizorPazar;
};

/**
 * Gün sayısı SUNUM biçimi. HESAP DEĞİL — çıkarma uçta yapıldı, burada
 * yalnız işaretine göre sözcük seçiliyor. Ölçülmeyen değer `EMPTY`.
 */
function gunMetni(gun: number | null | undefined): string {
  if (typeof gun !== 'number' || !Number.isFinite(gun)) return EMPTY;
  if (gun === 0) return 'bugün';
  if (gun < 0) return String(-gun) + ' gün önce';
  return String(gun) + ' gün sonra';
}

/** Sayı SUNUM biçimi — binlik ayırıcı. Birim dönüşümü YOK. */
function sayiMetni(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return EMPTY;
  return n.toLocaleString('tr-TR');
}

/** `kod` → rozet tonu. Renk SEÇİMİ, eşik değil. */
function kodTonu(kod: KatalizorTemettu['kod']): 'info' | 'neutral' {
  return kod === 'yakin' ? 'info' : 'neutral';
}

export function KatalizorKart({ sembol, pazar }: KatalizorKartProps) {
  const cagri = useCallback(
    (signal: AbortSignal) => fetchKatalizor(sembol, pazar, { signal }),
    [sembol, pazar],
  );

  // Anahtar DİZGİ ve PAZARI taşıyor: aynı sembolün iki pazarı aynı
  // anahtara düşmesin.
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|katalizor|' + pazar, {
    etkin: Boolean(sembol),
  });

  const govde: KatalizorResponse | null = veri ?? null;

  return (
    <Card
      title="📅 Katalizör / Risk"
      subtitle="Ölçülen en yakın gelecek temettü tarihi ve kaç gün kaldığı."
      right={<Pill label="skora girmez" tone="info" glyph={null} size="sm" />}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={2}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' && govde ? <Govde g={govde} /> : null}
    </Card>
  );
}

function Govde({ g }: { g: KatalizorResponse }) {
  const { colors } = useTheme();
  const t = g.temettu;
  const cumle = sozluktenSec(KATALIZOR_TEMETTU_SOZLUK, t?.kod);
  const turCumle = sozluktenSec(KATALIZOR_TARIH_TURU_SOZLUK, t?.tarihTuru);

  return (
    <View style={styles.govde}>
      {/* TEMETTÜ BACAĞI. `t === null` = uç ÖLÇTÜ, gelecek tarih YOK;
          `t.kod === null` = tarih OKUNAMADI → cümle BASILMIYOR. */}
      {t === null ? (
        <VeriYok kartsiz metin="Bu sembol için ölçülen yaklaşan temettü tarihi yok." />
      ) : (
        <>
          <View style={styles.ustSatir}>
            <Text style={[type.body, { color: colors.text }]}>
              {cumle ?? 'Temettü tarihi ölçüldü, bandı belirlenemedi.'}
            </Text>
            {t.kod ? (
              <Pill label={t.kod === 'yakin' ? 'yaklaşıyor' : t.kod} tone={kodTonu(t.kod)} glyph={null} size="sm" />
            ) : null}
          </View>

          <Satir
            etiket="Tarih"
            deger={t.tarih ?? EMPTY}
            not={turCumle ? 'Ölçülen gün: ' + turCumle : 'Hangi gün ölçüldüğü bildirilmedi.'}
          />
          <Satir etiket="Kalan" deger={gunMetni(t.gun)} not="Gün farkı uçta hesaplandı." />

          {/* TUTAR / VERİM: ölçülmediyse satır HİÇ ÇIKMIYOR — `0`
              basmak uydurma olurdu. ABD künyesi yaklaşan ödemenin
              tutarını vermiyor, o ayakta bu satırlar yok. */}
          {t.tutar !== null ? (
            <Satir
              etiket="Hisse başı tutar"
              deger={sayiMetni(t.tutar) + (t.paraBirimi ? ' ' + t.paraBirimi : '')}
              not="Üst kaynağın kendi biriminde — kur çevrilmedi."
            />
          ) : null}
          {t.verimYuzde !== null ? (
            <Satir
              etiket="Verim"
              deger={sayiMetni(t.verimYuzde) + '%'}
              not="Üst kaynağın yayınladığı yüzde puanı — yeniden hesaplanmadı."
            />
          ) : null}
          {t.odendi !== null ? (
            <Satir
              etiket="Ödeme durumu"
              deger={t.odendi ? 'ödendi olarak işaretli' : 'henüz ödenmemiş olarak işaretli'}
              not="Üst kaynağın işareti."
            />
          ) : null}
        </>
      )}

      {/* SESSİZ KIRPMA YOK. */}
      {g.atilan > 0 || g.tarihiOkunamayan > 0 ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'En yakın tarih basıldı · ' +
            sayiMetni(g.atilan) +
            ' ileri tarih ekranda değil · ' +
            sayiMetni(g.tarihiOkunamayan) +
            ' maddenin tarihi okunamadı'}
        </Text>
      ) : null}

      {/* EKSİK ÖLÇÜM EKRANDA YAZILI. */}
      {!g.tam ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          Takvim kısmen okunabildi — ölçüm eksik olabilir.
        </Text>
      ) : null}

      {/* ③ HABER UYARISI — sabit cümle, uçtan gelmiyor. */}
      <Text style={[type.micro, { color: colors.textDim }]}>{KATALIZOR_HABER_UYARISI}</Text>

      {/* OYNAKLIK BACAĞI NEREDE: kullanıcı aynı cümleyi iki kartta
          aramasın diye ekranda SÖYLENİYOR. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Oynaklık bacağı “Risk / Ödül” kartında, ham temettü künyesi “Temettü” ' +
          'kartında ölçülüyor — aynı ölçüm iki kez istenmiyor.'}
      </Text>

      {/* Uçtan gelen uyarı METİN DEĞİŞTİRİLMEDEN; boşsa satır yok. */}
      {g.uyari ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>{g.uyari}</Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textFaint }]}>
        Yalnız bilgi: teknik ya da temel skora GİRMEZ. Yatırım tavsiyesi değildir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  ustSatir: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'space-between',
  },
});
