// =====================================================================
//  📊 MaliTablolarKart — bilanço / gelir tablosu ham kalemleri
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: webdeki "mali tablolar" bölümünün native karşılığı. Şirketin
//  son dört YILLIK döneminde ölçülen ham kalemler: satış geliri, brüt
//  kâr, faaliyet kârı, net dönem kârı, nakit akışı kalemleri ve bilanço
//  kalemleri.
//
//  TEMEL SKORA DAHİL DEĞİL: bu kart hiçbir skora girdi vermiyor, motor
//  imzası önbellek anahtarına GİRMİYOR.
//
//  İKİ PAZAR, İKİ KAYNAK (uçta ölçülüyor — `api/_mali.js`):
//    US   → SEC XBRL `companyconcept` (us-gaap etiketleri, 10-K yıllık)
//    BIST → İş Yatırım `MaliTablo` (XI_29 finansal grubu, yıllık)
//
//  BURADA HESAP YOK: eşik yok, ağırlık yok, formül yok. Marj, oran,
//  büyüme, net borç GİBİ TÜRETMELER BASILMIYOR — web ikizinde bu
//  hesaplar TARAYICIDA yapılıyordu, burada yapılmıyor. Ekranda yalnız
//  uçtan gelen ölçülmüş sayı duruyor. Türkçesi `lib/sozluk.ts`ten
//  seçiliyor (`MALI_DURUM_SOZLUK`, `MALI_KALEM_SOZLUK`,
//  `MALI_GRUP_SOZLUK`); uç tek Türkçe cümle göndermiyor (`uyari` hariç).
//
//  PARA BİRİMİ ÇEVRİLMİYOR: tutar üst kaynağın kendi biriminde geliyor
//  (US → USD, BIST → TRY). Kart kur UYGULAMIYOR; birim bölüm
//  başlığında bir kez yazılı.
//
//  ÖLÇÜLEMEYEN DÖNEM `null` GELİYOR, `0` DEĞİL: ekrana `—` basılıyor.
//  Sıfır ile "ölçülemedi" birbirine ÇEVRİLMİYOR.
//
//  SESSİZ KIRPMA YOK: istenen dönem sayısı (`donemIstenen`) ile gelen
//  dönem sayısı (`donemler.length`) AYRI yazılı; `tam === false` ise
//  üst kaynağın eksik okunduğu ayrıca söyleniyor.
//
//  NEDEN BURADA `fetch` VAR: bu klasördeki öteki kartlar sunum-salt
//  (istek `analiz.tsx`te). Bu kart SEÇİLİ SEMBOLE bağlı tek bir uca
//  gidiyor ve `detay/IceridenKart.tsx` kalıbını izliyor: kendi
//  `useIstek`ini kuruyor, böylece sembol değiştiğinde ekranın bütün
//  gövdesi yeniden çizilmiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchMali, useIstek, type MaliKalem, type MaliPazar, type MaliResponse } from '@/api';
import { Card, Durum, Katlanir, OlcumBaslik, OlcumSatiri, Pill, VeriYok } from '@/components';
import { EMPTY, formatCompact } from '@/lib/format';
import { MALI_DURUM_SOZLUK, MALI_GRUP_SOZLUK, MALI_KALEM_SOZLUK } from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

export type MaliTablolarKartProps = {
  /** Uca gidecek sembol — çağıranın yazımı. Boşsa istek ATILMIYOR. */
  sembol: string;
  /** Pazar ÇAĞIRANDAN gelir; bu kart pazar ÇIKARIMI yapmaz. */
  pazar: MaliPazar;
};

/** Bölüm sırası — `MALI_GRUP_SOZLUK`un üç etiketinin GÖSTERİM sırası.
 *  Sıra bir hüküm değil, okuma kolaylığı. */
const GRUP_SIRASI = ['Gelir tablosu', 'Nakit akışı', 'Bilanço'] as const;

export function MaliTablolarKart({ sembol, pazar }: MaliTablolarKartProps) {
  const cagri = useCallback(
    (signal: AbortSignal) => fetchMali(sembol, pazar, { signal }),
    [sembol, pazar],
  );

  // Anahtar DİZGİ ve PAZARI taşıyor: yanıtı değiştiren her girdi
  // anahtarda. Aynı sembolün iki pazarı aynı anahtara düşmesin.
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|mali|' + pazar, {
    etkin: Boolean(sembol),
  });

  const govde: MaliResponse | null = veri ?? null;

  return (
    <Card
      title="📊 Mali tablolar"
      subtitle={
        pazar === 'US'
          ? 'SEC XBRL — son yıllık dönemlerde bildirilen ham bilanço ve gelir tablosu kalemleri.'
          : 'İş Yatırım mali tablo — son yıllık dönemlerde bildirilen ham kalemler.'
      }
      right={<Pill label="skora girmez" tone="info" glyph={null} size="sm" />}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={4}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' && govde ? <Govde g={govde} /> : null}
    </Card>
  );
}

function Govde({ g }: { g: MaliResponse }) {
  const { colors } = useTheme();

  // Kalemleri grup etiketine göre öbekle — SIRALAMA, hesap değil.
  const obekler = useMemo(
    () =>
      GRUP_SIRASI.map((grup) => ({
        grup,
        kalemler: g.kalemler.filter((k) => MALI_GRUP_SOZLUK[k.kod] === grup),
      })).filter((o) => o.kalemler.length > 0),
    [g.kalemler],
  );

  const enYeni = g.donemler.length ? g.donemler[0] : null;

  return (
    <View style={styles.govde}>
      <Text style={[type.body, { color: colors.text }]}>{MALI_DURUM_SOZLUK[g.durumKodu]}</Text>

      {/* SESSİZ KIRPMA YOK: istenen ve gelen dönem sayısı da ekranda. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        {'Yıllık dönem · ' +
          String(g.donemIstenen) +
          ' istendi · ' +
          String(g.donemler.length) +
          ' ölçüldü' +
          (g.birim ? ' · birim: ' + g.birim : ' · birim ölçülemedi')}
      </Text>

      {!g.tam ? (
        <Text style={[type.micro, { color: colors.gold }]}>
          {'Üst kaynak EKSİK okundu — ' +
            String(g.sayac.hata) +
            ' hata · ' +
            String(g.sayac.zamanAsimi) +
            ' zaman aşımı · ' +
            String(g.sayac.yok) +
            ' kalem kaynakta yok. Ölçülemeyen kalemler aşağıda ' +
            EMPTY +
            ' olarak duruyor.'}
        </Text>
      ) : null}

      {obekler.length ? (
        obekler.map((o) => (
          <View key={o.grup} style={styles.obek}>
            <OlcumBaslik
              baslik={o.grup}
              birim={g.birim}
              not={enYeni ? 'en güncel dönem: ' + enYeni : 'dönem ölçülemedi'}
            />
            {o.kalemler.map((k) => (
              <KalemSatiri k={k} key={k.kod} />
            ))}
          </View>
        ))
      ) : (
        <VeriYok kartsiz metin="Bu sembol için taşınacak kalem ölçülemedi." />
      )}

      {g.donemler.length > 1 && g.kalemler.length ? (
        <Katlanir baslik="Dönemleri tek tek gör" ozet={String(g.donemler.length) + ' dönem'}>
          <View style={styles.govde}>
            {g.kalemler.map((k) => (
              <DonemSatiri donemler={g.donemler} k={k} key={k.kod} />
            ))}
          </View>
        </Katlanir>
      ) : null}

      {g.kaynakAdres ? (
        <Pressable
          onPress={() => {
            const adres = g.kaynakAdres;
            if (adres) void Linking.openURL(adres).catch(() => {});
          }}
          hitSlop={8}>
          <Text style={[type.micro, { color: colors.info }]}>
            {(g.pazar === 'US' ? 'SEC EDGAR' : 'İş Yatırım') + ' sayfasını aç ↗'}
          </Text>
        </Pressable>
      ) : null}

      {/* Uçtan gelen uyarı METİN DEĞİŞTİRİLMEDEN basılıyor; boşsa satır
          hiç çıkmıyor (uydurma not yok). */}
      {g.uyari ? <Text style={[type.micro, { color: colors.textDim }]}>{g.uyari}</Text> : null}

      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Kaynak: ' +
          (g.pazar === 'US' ? 'SEC XBRL' : 'İş Yatırım mali tablo') +
          (g.cik ? ' (CIK ' + g.cik + ')' : '') +
          ' — ham kalem; marj, oran ya da büyüme HESAPLANMADI. Yalnız ' +
          'bilgi: teknik ya da temel skora GİRMEZ. Bilgi amaçlıdır, ' +
          'yatırım tavsiyesi değildir.'}
      </Text>
    </View>
  );
}

/** En güncel dönemin değeri + hangi kaynak alanından okunduğu. */
function KalemSatiri({ k }: { k: MaliKalem }) {
  const ilk = k.degerler.length ? k.degerler[0] : null;

  return (
    <OlcumSatiri
      etiket={MALI_KALEM_SOZLUK[k.kod]}
      deger={typeof ilk === 'number' ? formatCompact(ilk) : EMPTY}
      not={k.kaynakEtiket ? 'kaynak alanı: ' + k.kaynakEtiket : 'kaynak alanı ölçülemedi'}
    />
  );
}

/** Tek kalemin TÜM dönemleri — dönem etiketiyle eşleşmiş sırada. */
function DonemSatiri({ donemler, k }: { donemler: string[]; k: MaliKalem }) {
  const metin = donemler
    .map((d, i) => {
      const v = k.degerler[i];
      return d + ': ' + (typeof v === 'number' ? formatCompact(v) : EMPTY);
    })
    .join(' · ');

  return <OlcumSatiri etiket={MALI_KALEM_SOZLUK[k.kod]} deger={EMPTY} not={metin} />;
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  obek: { gap: space.xs },
});
