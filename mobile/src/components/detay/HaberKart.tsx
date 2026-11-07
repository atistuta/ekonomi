// =====================================================================
//  📰 GELİŞMELER — tek sembolün manşetleri            (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/hisse/[sembol]` ekranında o sembole ait haber maddeleri.
//  Webdeki karşılığı hisse sayfasının `fillSpNews` bölümü ("Gelişmeler",
//  app.js:7923) — native detay ekranında KARŞILIĞI YOKTU: haber yalnız
//  Bugün sekmesinde, TAKİP LİSTESİ üzerinden vardı.
//
//  NEDEN `HisseHaberleriKarti` YENİDEN KULLANILMIYOR (ÖLÇÜLDÜ): o kart
//  `useListe()` okuyor, yani kullanıcının LİSTESİNİ soruyor
//  (`components/bugun/HisseHaberleriKarti.tsx`). Detay ekranındaki
//  sembol listede OLMAYABİLİR (Arama sonucundan gelinmiş olabilir) ve o
//  kart listedeki DİĞER sembollerin manşetlerini de çeker. Aynı kartı
//  "tek sembol" kipine zorlamak, iki ayrı sorunun (listemde ne oldu /
//  bu hissede ne oldu) tek bileşene yüklenmesi olurdu.
//
//  AYNI UÇ, AYNI KİP: `/api/news?symbols=…` çoklu-sembol kipi
//  (`fetchHisseHaberleri`) TEK sembolle de çağrılabiliyor; uç satır
//  başına sayaç döndürüyor, bu yüzden "haber yok" ile "ölçemedim"
//  ayrımı tek sembolde de UÇTAN geliyor — istemci karar vermiyor.
//
//  NEDEN ANALYZE TURUNUN DIŞI: haber alanları `AnalyzeRow`da HİÇ YOK ve
//  haber ucu `maxDuration: 10` kademesinde. `BacktestKart`/`TemettuKart`
//  ile aynı gerekçe: kendi ucu, kendi zaman aşımı, kendi `Durum`u.
//
//  PAZAR ÇAĞIRANDAN GELİYOR: uç `market` parametresini SEMBOL pazarı
//  olarak alıyor (haber yereli değil) ve bunu kendi `PAZAR_ESLEME`siyle
//  habere çeviriyor. Ekran `satir.market` değerini olduğu gibi
//  geçiriyor; burada pazar ÇIKARIMI yapılmıyor.
//
//  BURADA HESAP YOK: sayı üretilmiyor, puan hesaplanmıyor. Duyarlılık
//  özeti ucun `duyarlilik` katmanını basıyor; eşik/ağırlık motorda.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchHisseHaberleri,
  haberOlcumEksik,
  useIstek,
  type HaberMadde,
  type Market,
  type SembolHaberSatiri,
} from '@/api';
import {
  Card,
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  Pill,
  VeriYok,
} from '@/components';
import { DuyarlilikOzeti, HaberSatiri } from '@/components/kesfet';
import { space, type, useTheme } from '@/theme';

export type HaberKartProps = {
  /** Ekranın çözdüğü sembol — BIST'te `.IS` sonekiyle. */
  sembol: string;
  /** SEMBOL pazarı; uç haber yereline kendisi çeviriyor. */
  market: Market;
  /**
   * Madde sınırı (uçta 1..25). Verilmezse ucun kendi varsayılanı
   * geçerli — istemci kendi sayısını uydurmuyor.
   */
  limit?: number;
};

export function HaberKart({ sembol, market, limit }: HaberKartProps) {
  const { colors } = useTheme();

  const cagri = useCallback(
    (signal: AbortSignal) => fetchHisseHaberleri([sembol], { market, limit, signal }),
    [sembol, market, limit],
  );
  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    'detay-haber:' + sembol + '|' + market + '|' + String(limit ?? ''),
    { etkin: Boolean(sembol) },
  );

  const eksik = haberOlcumEksik(veri ?? null);
  // TEK sembol sorulduğu için satır da tek; yine de DİZİDEN okunuyor —
  // uç boş dizi döndürebilir ve o hâl "ölçemedim" DEĞİL, cevapsızlık.
  const satirlar: SembolHaberSatiri[] = veri?.semboller ?? [];
  const satir: SembolHaberSatiri | null = satirlar[0] ?? null;
  const maddeler: HaberMadde[] = veri?.maddeler ?? [];

  return (
    <Card title="📰 Gelişmeler" subtitle={sembol + ' için manşet beslemesi'}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
        bosMetin="Sembol bekleniyor."
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          sonra öğrenmek, yarım ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri && eksik ? (
        <OlcemedimKutu
          metin={
            'Besleme okunamadı — ' +
            (veri.uyari ? 'uç uyarı bildirdi' : 'uç tam tarama bildirmedi') +
            '. Aşağıdaki başlıklar gelenlerin tamamı olmayabilir.'
          }
          yenile={yenile}
        />
      ) : null}

      {/* SATIRIN KENDİ ÖLÇÜMÜ: "haber yok" ile "ölçemedim" ayrı cümle,
          ikisi de UÇTAN (`tam` / `adet`). */}
      {durum === 'veri' && satir && !satir.tam ? (
        <View style={styles.not}>
          <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
          <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
            {'Bu sembolün beslemesi okunamadı — “haber yok” DENMİYOR, ölçüm eksik kaldı.'}
          </Text>
        </View>
      ) : null}

      {durum === 'veri' && satir && satir.tam && satir.adet === 0 ? (
        <VeriYok
          kartsiz
          metin={'Ölçüldü, manşet çıkmadı — bu da ÖLÇÜLMÜŞ bir cevap.'}
        />
      ) : null}

      {/* Uç sembolü hiç döndürmediyse satır YOK: sorulmuş ama cevapta
          karşılığı olmayan bir ölçüm; "haber yok" demek uydurma olurdu. */}
      {durum === 'veri' && veri && !satir ? (
        <VeriYok kartsiz metin={'Uç bu sembol için satır döndürmedi.'} />
      ) : null}

      {/* DUYARLILIK ÖZETİ: eksik ölçümde basılmıyor — yarım beslemenin
          puanı sembolü temsil etmiyor. */}
      {durum === 'veri' && satir && satir.tam && !eksik ? (
        <DuyarlilikOzeti duyarlilik={satir.duyarlilik} />
      ) : null}

      {durum === 'veri' && maddeler.length ? (
        <View style={styles.haberler}>
          {maddeler.map((m, i) => (
            <HaberSatiri key={(m.link || '') + '#' + i} madde={m} />
          ))}
        </View>
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          {'Uç ' + veri.adet + ' manşet döndü · ' + veri.sayac.istek +
            ' besleme isteği · ' + veri.ms + ' ms'}
        </Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
        {'Bu kart yalnız HABER manşeti gösteriyor. KAP duyuruları bu uçtan GELMİYOR — ' +
          'onlar 🗓️ Takvim kartında, ayrı bir ölçüm olarak duruyor.'}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  not: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  haberler: { paddingTop: space.xs },
});
