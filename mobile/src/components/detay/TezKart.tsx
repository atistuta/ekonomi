// =====================================================================
//  TezKart — 📓 bütüncül tez ve direkleri             (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `analiz.butunculluk.skor10` (0-10) + motorun bant metni, üç
//  direk (`direkler[]`: ad · değer · ağırlık · güven) ve temel karar
//  rozeti (`analiz.faKarar.label`).
//
//  NEDEN AYRI KART: tez, teknik ve temelin ÜSTÜNDEKİ katman — "bu hisse
//  neden ilgi çekici" sorusunun tek paragraflık cevabı. Teknik kartın
//  içine sıkıştırılsa 0-100 skorla 0-10 skor aynı ölçekteymiş gibi
//  görünürdü.
//
//  NEDEN 0-10 ÖLÇEĞİ 100'E ÇEVRİLMİYOR: `skor10` motorun kendi ölçeği
//  (types.ts: "İstemci bunu ASLA yeniden hesaplamaz"). 10 ile çarpıp
//  `ScoreGauge`a vermek, iki skoru tek ölçeğe zorlamak ve kullanıcıya
//  motorun üretmediği bir sayıyı göstermek olurdu. Bu yüzden sayı
//  "5,7 / 10" diye, geldiği ölçekte basılıyor.
//
//  NEDEN `analiz === null` BİR HATA DEĞİL: tez ayağı yalnız bazı
//  turlarda (ve bazı vadelerde) üretiliyor; uç kaydı `null` döndürür.
//  Bu "ölçemedim" durumudur (types.ts durum ②), kırmızı hata değil:
//  `OlcemedimKutu` bunu kullanıcının diliyle söylüyor ve ekranın geri
//  kalanı ayakta kalıyor.
//
//  NEDEN "DÜŞÜK GÜVEN" NOTU SAKLANMIYOR: `d.conf === false` direğin
//  ARKASINDAKİ verinin zayıf olduğunu söylüyor. Bunu gizlemek, zayıf
//  temelli bir sayıyı sağlam gibi sunmaktı; notu değerin yanına değil
//  etiketin altına koyuyoruz ki sayı sütunu kaymasın.
//
//  BURADA HESAP YOK: direk değerleri ağırlıkla çarpılıp `skor10`
//  yeniden kurulmaz (toplama MOTORDA — types.ts Direk notu).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import type { AnalyzeRow } from '@/api';
import { Card, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { EMPTY, formatOran } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/**
 * Direk anahtarı → Türkçe ad. `(tabs)/analiz.tsx` içindeki DIREK_METIN
 * ile aynı küme; YALNIZ ad çevirisi, eşik/ağırlık taşımaz. Bilinmeyen
 * anahtar gizlenmez, ham basılır.
 */
const DIREK_ETIKET: Record<string, string> = {
  value: 'Değer',
  quality: 'Kalite',
  growth: 'Büyüme',
  momentum: 'Momentum',
  risk: 'Risk',
};

/** Büyüme sınıfı (`buyumeCls`) → okunur metin. Sabit küme (types.ts). */
const BUYUME_ETIKET: Record<string, string> = {
  good: 'Büyüme güçlü',
  mid: 'Büyüme ılımlı',
  bad: 'Büyüme zayıf',
  thm: 'Büyüme tematik',
  na: 'Büyüme ölçülemedi',
};

export type TezKartProps = {
  satir: AnalyzeRow;
};

export function TezKart({ satir }: TezKartProps) {
  const { colors } = useTheme();
  const analiz = satir.analiz;

  // ÖLÇEMEDİM: uydurma bir tez cümlesi yazmak yerine durumu söylüyoruz.
  if (!analiz) {
    return (
      <Card title="📓 Tez" subtitle="Bütüncül değerlendirme — motorun üst katmanı.">
        <OlcemedimKutu metin="Bütüncül tez bu tur üretilmedi; uç nokta bu kayıt için tez döndürmedi." />
      </Card>
    );
  }

  const btn = analiz.butunculluk;
  const direkler = btn?.direkler ?? [];

  return (
    <Card
      title="📓 Tez"
      subtitle="Bütüncül skor ve direkleri motordan; istemci direkleri toplamaz."
      right={
        analiz.faKarar ? (
          <Pill label={analiz.faKarar.label} tone="neutral" glyph={null} size="sm" />
        ) : null
      }>
      {btn ? (
        <>
          {/* 0-10 ÖLÇEĞİ KORUNUYOR (başlıktaki gerekçe). */}
          <View style={styles.skorSatiri}>
            <Text style={[type.title, numeric, { color: colors.text }]}>
              {(typeof btn.skor10 === 'number' ? formatOran(btn.skor10, 1) : EMPTY) + ' / 10'}
            </Text>
            {btn.band ? (
              <Pill label={btn.band.l} tone="neutral" glyph={null} size="sm" />
            ) : null}
          </View>

          {/* Çekirdek yumuşaklığı ve büyüme sınıfı: ikisi de uçtan gelen
              hazır değerler; yorum cümlesi eklenmiyor. */}
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Çekirdek ' +
              (typeof btn.coreSoft === 'number' ? formatOran(btn.coreSoft) : EMPTY) +
              (btn.buyumeCls
                ? ' · ' + (BUYUME_ETIKET[btn.buyumeCls] ?? 'Büyüme ' + btn.buyumeCls)
                : '')}
          </Text>

          {direkler.length ? (
            <View style={styles.liste}>
              {direkler.map((d) => {
                const ad = DIREK_ETIKET[d.k] ?? d.k;
                return (
                  <Satir
                    key={d.k}
                    etiket={ad}
                    not={'ağırlık ' + formatOran(d.w) + (d.conf ? '' : ' · düşük güven')}
                    deger={formatOran(d.v)}
                    erisimEtiketi={
                      ad +
                      ' ' +
                      formatOran(d.v) +
                      ', ağırlık ' +
                      formatOran(d.w) +
                      (d.conf ? '' : ', düşük güven')
                    }
                  />
                );
              })}
            </View>
          ) : (
            <VeriYok metin="Direk dökümü bu turda gelmedi." kartsiz />
          )}
        </>
      ) : (
        <VeriYok metin="Bütüncül skor bu kayıt için ölçülmedi." kartsiz />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  skorSatiri: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  liste: { gap: space.xs },
});
