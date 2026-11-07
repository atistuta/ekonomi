// =====================================================================
//  📈 FİYAT ŞERİDİ — yerleşik 6 + cihazdaki özel göstergeler
//                                                    (ŞERİT B / native)
// ---------------------------------------------------------------------
//  NE: webin sayfa başındaki fiyat şeridinin (`app.js:2517`,
//  `TICKER_BUILTIN_META`) native yüzeyi. Gram altın · USD · EUR · GBP ·
//  BTC · ETH, ardından kullanıcının iğnelediği EN ÇOK 4 özel gösterge
//  (`sb:tickers`, `AZAMI_GOSTERGE`).
//
//  NEDEN GEREKLİ: `gostergelerDepo` native'de ZATEN okunuyordu ama
//  HİÇBİR EKRANDA GÖRÜNMÜYORDU — kayıt cihazda duruyor, kullanıcı
//  göremiyordu. Üstelik gram altın/döviz için UÇ DA YOKTU; bu tur
//  `/api/kur` açıldı ve boşluk kapandı.
//
//  KARTIN KENDİ `fetch`İ YOK (components içinde `fetch` yasak):
//  ölçümü `seritFiyatlari()` derliyor (`src/api/serit.ts`) — `SepetKart`
//  ile AYNI kalıp. Kart yalnız basıyor: eşik, ağırlık, formül, çarpma,
//  bölme, `toFixed` YOK.
//
//  AÇILIŞTA KENDİ ÖLÇÜYOR (SepetKart'tan BİLEREK AYRILAN nokta): web de
//  şeridi sayfa açılışında yüklüyor (`loadRates`), düğmeye basmıyor.
//  İSTEK FIRTINASI DEĞİL: `serit.ts` tüm kalemleri uç başına TEK çağrıya
//  topluyor (kur ucu `today.json`un tamamını tek istekte alıyor), yani
//  açılış EN ÇOK üç istek — kalem sayısından bağımsız. Ekran kapanırsa
//  istek `AbortController` ile kesiliyor.
//
//  TOPLAM YAZILMIYOR: kalemler farklı para biriminde (kurlar TL,
//  BTC/ETH dolar) ve kur çevrimi ucu yok. Şerit fiyat basar, toplamaz.
//
//  SESSİZ KIRPMA YOK: fiyatı çözülemeyen kalem listeden ATILMIYOR —
//  "—" basılıyor ve gerekçesi altta sayısıyla yazılı.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  gostergelerDepo,
  seritFiyatlari,
  useGostergeler,
  useTurHazir,
  type SeritKalem,
  type SeritSonuc,
} from '@/api';
import { Card, Katlanir, Pill } from '@/components';
import { EMPTY, formatPrice } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

export type SeritKartProps = Record<string, never>;

/** Fiyatın NEREDEN geldiği yazılı: hangi ölçüm, yoksa tanım gereği. */
const KAYNAK_ADI: Readonly<Record<string, string>> = {
  kur: 'kur ucu',
  kripto: 'kripto ucu',
  degisim: 'değişim ucu',
  elle: 'elle girilen',
  nakit: 'tanım gereği 1',
};

function SeritKutu({ kalem }: { kalem: SeritKalem }) {
  const { colors } = useTheme();
  const d = kalem.degisimPct;
  const renk =
    d == null ? colors.textDim : d < 0 ? colors.negative : colors.positive;

  return (
    <View style={[styles.kutu, { borderColor: colors.border }]}>
      <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={1}>
        {kalem.etiket}
      </Text>
      <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>
        {kalem.fiyat == null ? EMPTY : formatPrice(kalem.fiyat, kalem.birim)}
      </Text>
      <Text style={[type.micro, { color: renk }]} numberOfLines={1}>
        {/* YÜZDE PUAN, uçtan geldiği gibi; işaret ekran kararı. */}
        {d == null ? 'değişim —' : (d > 0 ? '+' : '') + d.toFixed(2) + '%'}
      </Text>
    </View>
  );
}

export function SeritKart() {
  const { colors } = useTheme();
  const ozeller = useGostergeler();
  const hazir = useTurHazir(gostergelerDepo);

  // `null` = henüz ölçülmedi; boş sonuç BAŞKA bir hâl.
  const [sonuc, setSonuc] = useState<SeritSonuc | null>(null);
  // TÜRETİLMİŞ, ayrı bir durum DEĞİL: etkinin gövdesinde `setState`
  // çağırmak zincirleme render demek (react-hooks/set-state-in-effect).
  // Yeniden ölçümde eski şerit ekranda KALIYOR — fiyatı silip "—"
  // basmak, ölçülmüş değeri ölçülemeyen gibi göstermek olurdu.
  const mesgul = sonuc === null;

  useEffect(() => {
    if (!hazir) return;
    const kesici = new AbortController();
    let canli = true;
    void seritFiyatlari(kesici.signal).then((s) => {
      if (!canli) return;
      setSonuc(s);
    });
    return () => {
      canli = false;
      kesici.abort();
    };
    // Özel gösterge sayısı değişirse ölçüm yenilenir: iğnelenen kalem
    // fiyatsız kalmasın.
  }, [hazir, ozeller.length]);

  // Gerekçeler TEKİLLEŞTİRİLİYOR ama SAYISI yazılı: aynı cümleyi altı
  // kez basmak okunmaz, gizlemek ise sessiz kırpma olurdu.
  const sebepSayisi: Record<string, number> = {};
  for (const k of sonuc?.kalemler ?? []) {
    if (k.sebep) sebepSayisi[k.sebep] = (sebepSayisi[k.sebep] ?? 0) + 1;
  }
  const olculen = (sonuc?.kalemler ?? []).filter((k) => k.fiyat != null).length;

  return (
    <Card
      title="📈 Fiyat şeridi"
      subtitle="Gram altın · döviz · kripto ve bu cihazda iğnelediğin göstergeler. Toplam ALINMIYOR: kalemler farklı para biriminde."
      right={
        <Pill
          label={
            mesgul
              ? 'ölçülüyor…'
              : olculen + '/' + (sonuc?.kalemler.length ?? 0) + ' ölçüldü'
          }
          tone={mesgul ? 'neutral' : olculen ? 'info' : 'negative'}
          glyph={null}
          size="sm"
        />
      }
    >
      <View style={styles.govde}>
        {!hazir ? (
          <Text style={[type.small, { color: colors.textDim }]}>
            Cihazdaki gösterge kaydı okunuyor…
          </Text>
        ) : sonuc == null ? (
          <Text style={[type.small, { color: colors.textDim }]}>
            Fiyatlar ölçülüyor…
          </Text>
        ) : sonuc.kalemler.length === 0 ? (
          <Text style={[type.body, { color: colors.text }]}>
            Şeritte gösterilecek kalem yok: yerleşik kalemlerin hepsi bu cihazda
            gizlenmiş ve iğnelenmiş özel gösterge de yok.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.serit}
          >
            {sonuc.kalemler.map((k) => (
              <SeritKutu key={k.id} kalem={k} />
            ))}
          </ScrollView>
        )}

        {sonuc?.hata ? (
          <Text style={[type.micro, { color: colors.negative }]}>
            {sonuc.hata}
          </Text>
        ) : null}

        {Object.keys(sebepSayisi).map((sebep) => (
          <Text key={sebep} style={[type.micro, { color: colors.textDim }]}>
            {sebepSayisi[sebep] + ' kalem: ' + sebep}
          </Text>
        ))}

        {sonuc && sonuc.uyarilar.length ? (
          <Katlanir baslik="Uçların uyarıları">
            {sonuc.uyarilar.map((u, i) => (
              <Text
                key={String(i)}
                style={[type.micro, { color: colors.textDim }]}
              >
                {u}
              </Text>
            ))}
          </Katlanir>
        ) : null}

        <Katlanir baslik="Bu şeritte ölçülmeyen">
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Kaynak etiketleri: ' +
              Object.keys(KAYNAK_ADI)
                .map((k) => k + ' = ' + KAYNAK_ADI[k])
                .join(' · ') +
              '.'}
          </Text>
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'BIST/ABD göstergesi iğneleme ve kaldırma artık bu ekranda: ' +
              'aşağıdaki "Şeride gösterge iğnele" kartı. HENÜZ YOK: döviz, ' +
              'metal ve kripto iğneleme (katalog native\'de yok) ile ' +
              'yerleşik gösterge gizleme/geri getirme — bu ikisi yalnız ' +
              'webde. Gösterge kaydı buluta GÖNDERİLMİYOR, cihazda kalıyor; ' +
              'webde iğnelenen bu cihaza GELMEZ. Fon (TEFAS) kalemi için ' +
              'fiyat ucu yok.'}
          </Text>
          <Text style={[type.micro, { color: colors.textFaint }]}>
            Şerit toplamı, kur çevrimi ve dönem grafiği bu kartta yok. Bilgi
            amaçlıdır, yatırım tavsiyesi değildir.
          </Text>
        </Katlanir>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  serit: { gap: space.sm, paddingVertical: 2 },
  kutu: {
    gap: 2,
    minWidth: 112,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
  },
});
