// =====================================================================
//  🧭 NEDEN HAREKET EDİYOR? — günlük hareket × haber akışı
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: webdeki hisse sayfasının "Neden hareket ediyor?" bölümünün
//  (`fillSpWhy`) native karşılığı. Bugünkü yüzde hareketi, aynı
//  sembolün manşet akışının yönüyle UZLAŞTIRIYOR: aynı taraftalar mı,
//  ters taraflarda mı, yoksa harekete eşlik eden yönlü manşet yok mu.
//
//  KART ADI NİYE `HareketKart`: `kesfet/NedenKart.tsx` BAŞKA bir
//  özelliğin (nedensel bağlantılar) kartı, ad çakışmasın.
//
//  BURADA HESAP YOK — webden ASIL FARK: webde eşikler (3.0 / 1.2 /
//  0.12) ve karar ağacı TARAYICIDA, ekran katmanında duruyordu. Native
//  istemci hesap YAPMAZ: karar motora taşındı (`whyHareketKod`,
//  `whyYonKod`, `whyHaberYonKod`, `whyUzlasmaKod`), `/api/neden` yalnız
//  KAPALI KÜMELİ KOD döndürüyor. Bu dosyada eşik, ağırlık, formül ve
//  Türkçe hüküm cümlesi YOK; cümleler `lib/sozluk.ts`ten seçiliyor.
//
//  SKORA GİRMEZ: ne teknik ne temel skor bu kodları okur. Hareketi
//  haber akışıyla uzlaştıran bir YORUM katmanı.
//
//  NEDENSELLİK İDDİASI YOK: "haber_uyumlu" = yönler aynı tarafta
//  demektir, "haber fiyatı oynattı" DEMEZ. Sözlük cümleleri bilinçli
//  olarak ilişki dili kullanıyor, nedensellik dili kullanmıyor.
//
//  YENİ VERCEL FONKSİYONU AÇILMADI: `/api/neden`, `vercel.json`
//  yeniden-yazımıyla `/api/proxy`ye düşüyor (`api/*.js` sayısı 12'de
//  kaldı).
//
//  SESSİZ KIRPMA YOK: manşet listesi en çok 5 kayıt basıyor; listeye
//  girmeyen sinyalli manşet sayısı (`atilan`) ve iki kaynak sayacı
//  (fiyat · haber) ekranda YAZILI. `tam: false` ise ölçümün EKSİK
//  olduğu söyleniyor.
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: `yuzde === null` → `—`, asla `0`.
//  `haber === null` → duyarlılık ÖLÇÜLEMEDİ satırı; 0 puan basılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchNeden,
  useIstek,
  type NedenBaslik,
  type NedenPazar,
  type NedenResponse,
} from '@/api';
import { Card, Durum, Katlanir, Pill, VeriYok } from '@/components';
import { EMPTY } from '@/lib/format';
import {
  NEDEN_HABER_YON_SOZLUK,
  NEDEN_HAREKET_SOZLUK,
  NEDEN_KUTUP_SOZLUK,
  NEDEN_UZLASMA_SOZLUK,
  NEDEN_YON_SOZLUK,
} from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

// `Satir` KOK BARREL'DA YOK; bu klasörün kendi dosyasından alınıyor.
// Klasör girişinden (`@/components/detay`) ALINMIYOR: o dosya BU kartı
// da dışa açıyor, döngü olurdu.
import { Satir } from './Satir';

export type HareketKartProps = {
  /** Uca gidecek sembol — çağıranın yazımı. */
  sembol: string;
  /** Pazar ÇAĞIRANDAN gelir; istemci pazar ÇIKARIMI yapmaz. */
  pazar: NedenPazar;
};

/**
 * Yüzde SUNUM biçimi. HESAP DEĞİL: yuvarlıyor ve işaret koyuyor,
 * eşikle karşılaştırmıyor. Ölçülmeyen değer `EMPTY` — asla `0`.
 */
function yuzdeMetni(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return EMPTY;
  const isaret = v > 0 ? '+' : '';
  return isaret + v.toFixed(2) + '%';
}

/** Ölçülmeyen sayıyı `—` basan sunum yardımcısı. */
function sayiMetni(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return EMPTY;
  return n.toLocaleString('tr-TR');
}

/** `uzlasmaKod` → rozet tonu. Renk SEÇİMİ, eşik değil. */
function uzlasmaTonu(
  kod: NedenResponse['uzlasmaKod'],
): 'positive' | 'negative' | 'neutral' | 'info' {
  if (kod === 'haber_uyumlu') return 'positive';
  if (kod === 'celiski') return 'negative';
  if (kod === 'haber_yok') return 'info';
  return 'neutral';
}

/** `yonKod` → ton. */
function yonTonu(kod: NedenResponse['yonKod']): 'positive' | 'negative' | 'neutral' {
  if (kod === 'yukselis') return 'positive';
  if (kod === 'dusus') return 'negative';
  return 'neutral';
}

export function HareketKart({ sembol, pazar }: HareketKartProps) {
  const cagri = useCallback(
    (signal: AbortSignal) => fetchNeden(sembol, pazar, { signal }),
    [sembol, pazar],
  );

  // Anahtar DİZGİ (`useIstek` nesne anahtarı kabul etmiyor) ve PAZARI
  // taşıyor: aynı sembolün iki pazarı aynı anahtara düşmesin.
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|neden|' + pazar, {
    etkin: Boolean(sembol),
  });

  const govde: NedenResponse | null = veri ?? null;

  return (
    <Card
      title="🧭 Neden hareket ediyor?"
      subtitle="Bugünkü değişim, aynı sembolün manşet akışının yönüyle karşılaştırılıyor."
      right={<Pill label="skora girmez" tone="info" glyph={null} size="sm" />}>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' && govde ? <Govde g={govde} /> : null}
    </Card>
  );
}

function Govde({ g }: { g: NedenResponse }) {
  const { colors } = useTheme();

  return (
    <View style={styles.govde}>
      {/* ASIL CÜMLE — uçtan gelen `uzlasmaKod`un sözlük karşılığı. */}
      <View style={styles.ustSatir}>
        <Text style={[type.body, { color: colors.text }]}>
          {NEDEN_UZLASMA_SOZLUK[g.uzlasmaKod]}
        </Text>
        <Pill
          label={g.uzlasmaKod}
          tone={uzlasmaTonu(g.uzlasmaKod)}
          glyph={null}
          size="sm"
        />
      </View>

      <Satir
        etiket="Bugünkü değişim"
        deger={yuzdeMetni(g.yuzde)}
        not={
          NEDEN_HAREKET_SOZLUK[g.hareketKod] + ' · ' + NEDEN_YON_SOZLUK[g.yonKod]
        }
      />

      <View style={styles.rozetler}>
        <Pill label={g.hareketKod} tone="neutral" glyph={null} size="sm" />
        <Pill label={g.yonKod} tone={yonTonu(g.yonKod)} glyph={null} size="sm" />
      </View>

      {/* Fiyat ve önceki kapanış: yüzdenin NEYDEN çıktığı görünsün. */}
      <Satir
        etiket="Fiyat · önceki kapanış"
        deger={sayiMetni(g.fiyat) + ' · ' + sayiMetni(g.oncekiKapanis)}
        not={
          (g.paraBirimi ? g.paraBirimi + ' — ' : '') +
          (g.gecikmeli
            ? 'Kota GECİKMELİ geldi, canlı değil.'
            : 'Üst kaynağın verdiği son kota.')
        }
      />

      {/* Duyarlılık: ölçülemediyse SIFIR BASILMIYOR, söyleniyor. */}
      {g.haber ? (
        <>
          <Satir
            etiket="Manşet akışı"
            deger={
              g.haberYonKod
                ? NEDEN_HABER_YON_SOZLUK[g.haberYonKod]
                : 'Yön ölçülemedi'
            }
            not={
              sayiMetni(g.haber.adet) +
              ' manşet tarandı · sorgu: ' +
              g.haber.sorgu
            }
          />
          {/* SAPMA EKRANDA YAZILI: taşıyıcı manşet ÖZETİ vermiyor, bu
              yüzden uç puanı web puanından sapabilir. */}
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Puanlanan alan: ' +
              (g.haber.alan.length ? g.haber.alan.join(' · ') : EMPTY) +
              ' — manşet özeti okunmadığı için bu puan web sürümünden sapabilir.'}
          </Text>
        </>
      ) : (
        <Text style={[type.micro, { color: colors.textDim }]}>
          Manşet akışının yönü ÖLÇÜLEMEDİ — bu yüzden hareket haberle
          karşılaştırılmadı.
        </Text>
      )}

      {g.basliklar.length ? (
        <Katlanir
          baslik="Manşetleri tek tek gör"
          ozet={sayiMetni(g.basliklar.length) + ' manşet'}>
          <View style={styles.govde}>
            {g.basliklar.map((b, i) => (
              <BaslikSatiri b={b} key={String(b.adres) + '|' + i} />
            ))}
          </View>
        </Katlanir>
      ) : (
        <VeriYok kartsiz metin="Bu sembol için sinyalli manşet bulunamadı." />
      )}

      {/* SESSİZ KIRPMA YOK: atılan manşet sayısı ve iki sayaç yazılı. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        {'Listeye girmeyen sinyalli manşet: ' +
          sayiMetni(g.atilan) +
          ' · fiyat isteği ' +
          sayiMetni(g.sayac.fiyat.basari) +
          '/' +
          sayiMetni(g.sayac.fiyat.istek) +
          ' · haber isteği ' +
          sayiMetni(g.sayac.haber.basari) +
          '/' +
          sayiMetni(g.sayac.haber.istek)}
      </Text>

      {!g.tam ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          Kaynaklardan biri okunamadı — bu ölçüm EKSİK.
        </Text>
      ) : null}

      {/* Uçtan gelen uyarı METİN DEĞİŞTİRİLMEDEN basılıyor. */}
      {g.uyari ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>{g.uyari}</Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textFaint }]}>
        Yalnız bilgi: teknik ya da temel skora GİRMEZ. Yönlerin aynı
        tarafta olması, haberin fiyatı oynattığı anlamına GELMEZ.
      </Text>
    </View>
  );
}

/** Tek manşet. Başlık ÜST KAYNAĞIN yazdığı gibi basılıyor. */
function BaslikSatiri({ b }: { b: NedenBaslik }) {
  const { colors } = useTheme();
  const alt = [b.kaynak, b.tarih, b.kutupKod ? NEDEN_KUTUP_SOZLUK[b.kutupKod] : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      disabled={!b.adres}
      onPress={() => {
        if (b.adres) void Linking.openURL(b.adres).catch(() => {});
      }}
      hitSlop={6}>
      <Text style={[type.body, { color: b.adres ? colors.info : colors.text }]}>
        {b.baslik ?? EMPTY}
      </Text>
      {alt ? <Text style={[type.micro, { color: colors.textFaint }]}>{alt}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  rozetler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  ustSatir: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.xs,
    justifyContent: 'space-between',
  },
});
