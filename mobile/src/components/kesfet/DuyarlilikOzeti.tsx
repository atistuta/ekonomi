// =====================================================================
//  DUYARLILIK ÖZETİ — haber akışının motor ölçümü      (native / UI)
// ---------------------------------------------------------------------
//  NE: `/api/news` ve `/api/news?gundem=1` cevabının `duyarlilik`
//  katmanını (api/news.js `duyarlilikKatmani`) tek blokta basar:
//  motorun cümlesi + HAM sayılar (puan, sinyal veren manşet adedi).
//
//  NEDEN BU KLASÖRDE: VERİ ÇEKMİYOR — katmanı PROP olarak alıyor.
//  Manşetleri kim istediyse `duyarlilik` alanı da o cevapta geliyor.
//
//  NEDEN AYRI DOSYA: aynı özet ÜÇ ekranda basılacak (Keşfet/Gündem ·
//  Bugün · Arama), tıpkı `HaberSatiri` gibi. Üç kopya, yarın biri
//  "sinyal yok" ile "ölçemedim" dallarını karıştırdığında üç ayrı
//  doğruluk demekti.
//
//  BURADA HESAP YOK (HAM SAYI KURALI): eşik, ağırlık, toplama,
//  karşılaştırma YOK. Cümle `kod`a bakılıp `lib/sozluk.ts`ten seçiliyor;
//  renk `cls`ten. `cls` TEK BAŞINA YETMEZ — ÖLÇÜLDÜ (uc-test ⑭j):
//  motorun BEŞ cümlesi ÜÇ `cls`e düşüyor, ayırmak için 0.35 eşiğini
//  bilmek gerekirdi ve eşik istemcide YASAK. Bu yüzden uç ayrıca `kod`
//  gönderiyor.
//
//  ÜÇ DAL AYRI, hiçbiri diğerinin yerine geçmiyor:
//   · alan HİÇ gelmedi (`undefined`) → uç bu sürümde göndermiyor; HİÇBİR
//     ŞEY basılmaz (eski dağıtımla çalışan istemci yanlış not düşmesin).
//   · alan `null` → uç ÖLÇEMEDİ (motor kurulamadı). Bu SÖYLENİR.
//   · nesne var → HAM basılır. `sinyal === 0` bir arıza DEĞİL: ölçüldü,
//     sinyal veren manşet yok (`kod: 'yok'`) — "ölçemedim"den AYRI cümle.
//
//  ÖLÇÜLMÜŞ SAPMA BİLDİRİLİYOR: uç puanı YALNIZ manşet BAŞLIĞI üzerinden
//  hesaplıyor (`alan: ['title']`), webdeki akış `title + description`
//  okuyor. Sapma sayıyla örtülmedi; `alan` ekranda yazılı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { Duyarlilik, DuyarlilikCls } from '@/api';
import { Pill } from '@/components';
import { formatOran, formatScore } from '@/lib/format';
import { DUYARLILIK_ROZET, DUYARLILIK_SOZLUK, sozluktenSec } from '@/lib/sozluk';
import { space, type, useTheme, type Tone } from '@/theme';

/**
 * `cls` → rozet tonu. SUNUM EŞLEMESİ, hesap değil: yönü renkten başka
 * bir taşıyıcıya da koymak için `Pill` yön tonlarında işaret basıyor.
 */
const TON: Record<DuyarlilikCls, Tone> = {
  bull: 'positive',
  neutral: 'neutral',
  bear: 'negative',
};

export type DuyarlilikOzetiProps = {
  /** `undefined` = uç göndermedi · `null` = uç ölçemedi. */
  duyarlilik?: Duyarlilik | null;
  /**
   * Ekranda manşetler SÜZÜLÜYORSA `true`. Puan ucun gönderdiği TÜM
   * manşetler üzerinden; süzülmüş listeye bakan kullanıcı puanı o alt
   * kümeye ait sanmasın diye kapsam ayrıca yazılıyor.
   */
  suzuldu?: boolean;
};

export function DuyarlilikOzeti({ duyarlilik, suzuldu = false }: DuyarlilikOzetiProps) {
  const { colors } = useTheme();

  // DAL 1: uç göndermedi — not düşülmez.
  if (duyarlilik === undefined) return null;

  // DAL 2: uç ölçemedi.
  if (duyarlilik === null) {
    return (
      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
        Haber duyarlılığı ölçülemedi — manşetler okundu ama motor kurulamadı.
      </Text>
    );
  }

  // DAL 3: ölçüldü. Cümle sözlükten; kod tanınmıyorsa cümle BASILMAZ.
  const cumle = sozluktenSec(DUYARLILIK_SOZLUK, duyarlilik.kod);
  const rozet = sozluktenSec(DUYARLILIK_ROZET, duyarlilik.kod);
  const ton: Tone = duyarlilik.cls ? TON[duyarlilik.cls] : 'neutral';
  const alan = (duyarlilik.alan ?? []).join(' + ');

  return (
    <View style={styles.kutu}>
      <View style={styles.ust}>
        {rozet ? <Pill label={'haber: ' + rozet} tone={ton} size="sm" /> : null}
        <Text style={[type.smallBold, styles.num, { color: colors.text }]}>
          {'puan ' + formatOran(duyarlilik.puan)}
        </Text>
      </View>

      {cumle ? (
        <Text style={[type.small, { color: colors.textDim }]}>{cumle}</Text>
      ) : null}

      {/* HAM SAYILAR — istemci saymıyor, ucun saydığını basıyor. */}
      <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
        {formatScore(duyarlilik.adet) +
          ' manşetin ' +
          formatScore(duyarlilik.sinyal) +
          ' tanesi motorun sözlüğünde sinyal verdi' +
          (alan ? ' · okunan alan: ' + alan : '')}
      </Text>

      {suzuldu ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Puan ucun gönderdiği TÜM manşetler üzerinden — ekrandaki süzgeç bu
          ölçümü değiştirmiyor.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kutu: { gap: space.xs, marginTop: space.sm },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  num: { fontVariant: ['tabular-nums'] },
});
