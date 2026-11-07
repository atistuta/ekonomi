// =====================================================================
//  📉 NedenBesleyici — `NedenKart`ın İKİ GİRDİSİNİ de ÖLÇER
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `NedenKart`ın zorunlu iki girdisini ayrı ayrı ölçer ve prop
//  olarak verir:
//    · `gundem`     ← `/api/gundem` → `gundemdenKonseptler` (neden.ts)
//    · `hareketler` ← `/api/chart` ×4 → `fetchNedenHareketleri`
//  Kendisi HİÇBİR ŞEY ÇİZMEZ: tek görünen çıktısı kartın altına basılan
//  KÖPRÜ KÜNYESİ.
//
//  ── NİYE AYRI BİR BİLEŞEN, NİYE KARTIN İÇİNE KOYMADIM ──────────────
//  `NedenKart`ın başlığında yazılı söz: "GİRDİYİ BU KART ÜRETMEZ —
//  ÇAĞIRAN VERİR". O sözü kartın içine bir `fetch` koyarak bozmak,
//  "ölçülmüş girdi dışarıdan gelir" ayrımını silerdi: kart yarın başka
//  bir girdi kaynağıyla (ör. sunucu tarafı sabit evren şeridi) da
//  beslenebilsin diye prop'u açık kaldı. Besleyici o kaynağın BİR
//  tanesidir, tek tanesi değil.
//
//  ── NİYE EKRANDA (kesfet.tsx) DEĞİL ────────────────────────────────
//  Ekran zaten bir istek taşıyor (`fetchRecommend`). İkinci bir
//  `useIstek`i ekrana koymak, gündem düştüğünde öneri turunu da
//  yeniden çizdirirdi (ikisi AYRI düşmeli — `GundemKarti` gerekçesi).
//  Bu bileşen kendi isteklerini kendi taşıyor.
//
//  ── NİYE İKİ AYRI `useIstek` ───────────────────────────────────────
//  Gündem ile endeksler AYRI DÜŞEBİLİR: RSS yayıncıları ulaşılmazken
//  Yahoo ayakta olabilir (ya da tersi). Tek bir çağrıda toplamak, bir
//  yarı düştüğünde ÖLÇÜLEN öteki yarıyı da kaybettirirdi — kart o iki
//  yarının hangisinin eksik olduğunu AYRI AYRI yazıyor, bu ayrımı
//  beslerken yok etmek olmazdı.
//
//  ── NİYE `/api/gundem` İKİNCİ KEZ ÇAĞRILIYOR ───────────────────────
//  Bugün sekmesindeki `GundemKonseptKarti` AYNI ucu okuyor. Ölçüm
//  PAYLAŞILMIYOR çünkü iki sekme AYRI yaşıyor: tek bir paylaşılan
//  önbellek kurmak, bir sekmedeki kapsam seçimini öteki sekmenin
//  ölçümüne sessizce taşırdı. Ucun kendi `onbellek` bayrağı var ve
//  ikinci çağrı oradan dönebilir — bu karar SUNUCUNUN.
//
//  ── ENDEKS HAREKETLERİ ARTIK ÖLÇÜLÜYOR (2026-11-03) ────────────────
//  Önceki sürümde bu yarı EKSİKTİ: `pct` kaynağı vardı ama "belirgin"
//  eşiği (`notable`) hiçbir uçtan gelmiyordu ve uç onu ZORUNLU
//  istiyordu. O gün eşik motora taşındı (`INDEX_ESIK`, motor dilimi
//  `endeks-esik`) ve `/api/causal` onu kendisi okuyor; `notable` artık
//  SEÇİMLİK. Bu yüzden `fetchNedenHareketleri` yalnız `kind` + ÖLÇÜLEN
//  `pct` yolluyor — eşik istemciye HİÇ GİRMİYOR.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchGundemKonsept,
  fetchNedenHareketleri,
  gundemdenKonseptler,
  useIstek,
  VARSAYILAN_GUNDEM_KAPSAM,
} from '@/api';
import { type, useTheme } from '@/theme';

import { NedenKart } from './NedenKart';

export function NedenBesleyici() {
  const { colors } = useTheme();

  // Kapsam SEÇİLEBİLİR DEĞİL: bu bileşenin işi gündem SUNMAK değil,
  // nedensellik girdisi beslemek. Çip koymak, aynı seçimi iki sekmede
  // iki ayrı yerde tutmak olurdu (kapsam çipi `GundemKonseptKarti`de).
  const gundemCagri = useCallback(
    (signal: AbortSignal) =>
      fetchGundemKonsept({ kapsam: VARSAYILAN_GUNDEM_KAPSAM, signal }),
    [],
  );
  const gundemIstek = useIstek(gundemCagri, 'neden-gundem:' + VARSAYILAN_GUNDEM_KAPSAM);

  const hareketCagri = useCallback(
    (signal: AbortSignal) => fetchNedenHareketleri({ signal }),
    [],
  );
  // Anahtar SABİT: girdi yok (dört endeks de sabit küme), bu yüzden
  // ölçümü yeniden tetikleyecek bir değişken de yok.
  const hareketIstek = useIstek(hareketCagri, 'neden-hareket');

  // `undefined` ile `[]` AYRI: ölçüm bitmeden `[]` vermek karta
  // "ölçtüm, konsept yok" dedirtirdi. Ölçüm bitmediyse prop HİÇ yok.
  const kopru =
    gundemIstek.durum === 'veri' && gundemIstek.veri
      ? gundemdenKonseptler(gundemIstek.veri.konseptler)
      : null;

  // AYNI AYRIM hareketler için de geçerli: istek düştüğünde (dört
  // endeksin dördü de ölçülemediğinde) prop `undefined` KALIYOR, `[]`
  // OLMUYOR — `[]` "ölçtüm, belirgin hareket yok" demek.
  const hareketler =
    hareketIstek.durum === 'veri' && hareketIstek.veri
      ? hareketIstek.veri.hareketler
      : undefined;
  const hareketDusen = hareketIstek.veri?.dusen ?? [];

  return (
    <View style={styles.kap}>
      <NedenKart gundem={kopru ? kopru.gundem : undefined} hareketler={hareketler} />

      {kopru ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Gündem girdisi: ' +
            kopru.olcum.gelen +
            ' konsept ölçüldü · ' +
            kopru.olcum.giden +
            ' tanesi girdiye girdi' +
            (kopru.olcum.kirpildi ? ' (tavan nedeniyle kırpıldı)' : '') +
            (kopru.olcum.sektorDusen
              ? ' · ' + kopru.olcum.sektorDusen + ' sektör demeti küme dışı yön nedeniyle düştü'
              : '') +
            (kopru.olcum.basligiDusen
              ? ' · ' + kopru.olcum.basligiDusen + ' manşet yaşı ölçülemediği için düştü'
              : '') +
            '.'}
        </Text>
      ) : null}

      {hareketIstek.veri ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Endeks girdisi: ' +
            hareketIstek.veri.sorulan +
            ' endeks soruldu · ' +
            hareketIstek.veri.hareketler.length +
            ' tanesinin gün değişimi ölçüldü' +
            // Düşen kalemler SESSİZ GEÇMİYOR: hangi sembol, hangi kodla.
            (hareketDusen.length
              ? ' · ölçülemeyen: ' +
                hareketDusen.map((d) => d.symbol + ' (' + d.kod + ')').join(', ')
              : '') +
            '. Belirginlik eşiği uçta (motor tablosu).'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Künye kartın HEMEN ALTINDA: kartın içine girerse kartın kendi
  // ölçüm künyesiyle karışır, ayrı bir kart olursa boş kart çizer.
  kap: { gap: 0 },
});
