// =====================================================================
//  🕵️ İÇERİDEN İŞLEMLER — SEC Form 4 (US) · KAP bildirimi (BIST)
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: webdeki hisse sayfasının "İçeriden işlemler" bölümünün
//  (app.js:5127 civarı) native karşılığı. Şirketin yönetim kurulu
//  üyesi, üst düzey yöneticisi ya da %10+ pay sahibi son 90 günde kendi
//  hissesinde ne yapmış — ALDI mı, SATTI mı.
//
//  TEMEL SKORA DAHİL DEĞİL. Kullanıcı tercihi (2026-08-15, web ikizinde
//  de aynı): yalnız bilgi, skoru etkilemez. Bu kart hiçbir skora girdi
//  vermiyor; motor imzası isteğin önbellek anahtarına GİRMİYOR.
//
//  YENİ VERCEL FONKSİYONU AÇILMADI: `/api/iceriden`, `vercel.json`
//  yeniden-yazımıyla `/api/proxy`ye düşüyor (`api/*.js` sayısı 12'de
//  kaldı).
//
//  İKİ PAZAR, İKİ AYRI GÖVDE — BİLİNÇLİ:
//    US   → Form 4 belgesi SAYI taşıyor: adet ve tutar ölçülebiliyor.
//    BIST → KAP bildiriminin başlığı var, YAPISAL SAYI YOK. O yüzden
//           BIST ayağında adet/tutar BASILMIYOR; uydurulmuş sıfır
//           yerine bildirim başlıkları ve kaynağı basılıyor.
//
//  BURADA HESAP YOK: eşik yok, ağırlık yok, formül yok. `yonKod` /
//  `durumKodu` / `iliskiKodlari` / `kaynakKodu` uçtan gelen KAPALI
//  KÜMELİ kodlar; Türkçesi `lib/sozluk.ts`ten seçiliyor.
//
//  PARA BİRİMİ ÇEVRİLMİYOR: tutar üst kaynağın kendi biriminde geliyor
//  (Form 4 için USD). Kart tutarın yanına PARA BİRİMİ SİMGESİ KOYMUYOR
//  ve çarpmıyor — ölçülmeyen bir kuru ima etmemek için. Birim ekranda
//  yazılı.
//
//  SESSİZ KIRPMA YOK: pencerede seçilen bildirim sayısı
//  (`bildirimSayisi`) ile ekrana basılan kayıt sayısı (`okunan`) AYRI
//  alanlar ve ikisi de yazılı; BIST'te `bulunan` ile `maddeSayisi`.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchIceriden,
  useIstek,
  type IceridenBistGovde,
  type IceridenKayit,
  type IceridenOrtak,
  type IceridenPazar,
  type IceridenResponse,
  type IceridenUsGovde,
} from '@/api';
import { Card, Durum, Katlanir, Pill, VeriYok } from '@/components';
import { EMPTY } from '@/lib/format';
import {
  ICERIDEN_DURUM_SOZLUK,
  ICERIDEN_ILISKI_SOZLUK,
  ICERIDEN_KAYNAK_SOZLUK,
  ICERIDEN_YON_ROZET,
  ICERIDEN_YON_SOZLUK,
} from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

// `Satir` KOK BARREL'DA YOK (orada `OlcumSatiri` adiyla duruyor); bu
// klasorun kendi yeniden-adlandirmasi kullaniliyor. Klasor girisinden
// (`@/components/detay`) ALINMIYOR: o dosya BU karti da disa aciyor,
// dongu olurdu.
import { Satir } from './Satir';

export type IceridenKartProps = {
  /** Uca gidecek sembol — çağıranın yazımı. */
  sembol: string;
  /** Pazar ÇAĞIRANDAN gelir; istemci pazar ÇIKARIMI yapmaz. */
  pazar: IceridenPazar;
};

/**
 * Adet/tutar SUNUM biçimi. HESAP DEĞİL: binlik ayırıcı koyuyor, birim
 * dönüştürmüyor. Ölçülmeyen değer `EMPTY` — asla `0`.
 */
function sayiMetni(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return EMPTY;
  return n.toLocaleString('tr-TR');
}

/** `yonKod` → rozet tonu. Renk SEÇİMİ, eşik değil. */
function yonTonu(kod: IceridenUsGovde['yonKod']): 'positive' | 'negative' | 'neutral' {
  if (kod === 'alim' || kod === 'alim_agirlikli') return 'positive';
  if (kod === 'satim' || kod === 'satim_agirlikli') return 'negative';
  return 'neutral';
}

export function IceridenKart({ sembol, pazar }: IceridenKartProps) {
  const cagri = useCallback(
    (signal: AbortSignal) => fetchIceriden(sembol, pazar, { signal }),
    [sembol, pazar],
  );

  // Anahtar DİZGİ (`useIstek` nesne anahtarı kabul etmiyor) ve PAZARI
  // taşıyor: aynı sembolün iki pazarı aynı anahtara düşmesin.
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|iceriden|' + pazar, {
    etkin: Boolean(sembol),
  });

  const govde: IceridenResponse | null = veri ?? null;

  return (
    <Card
      title="🕵️ İçeriden işlemler"
      subtitle={
        pazar === 'US'
          ? 'SEC Form 4 — yöneticilerin son 90 günde kendi hissesinde bildirdiği işlemler.'
          : 'KAP bildirimleri — şirketin kendi bildirdiği içeriden işlem duyuruları.'
      }
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

      {durum === 'veri' && govde ? (
        govde.pazar === 'US' ? (
          <UsGovde g={govde} />
        ) : (
          <BistGovde g={govde} />
        )
      ) : null}
    </Card>
  );
}

/** US ayağı — Form 4 sayıları ölçülebiliyor. */
function UsGovde({ g }: { g: IceridenUsGovde & IceridenOrtak }) {
  const { colors } = useTheme();
  const t = g.toplam;

  return (
    <View style={styles.govde}>
      <View style={styles.ustSatir}>
        <Text style={[type.body, { color: colors.text }]}>
          {ICERIDEN_DURUM_SOZLUK[g.durumKodu]}
        </Text>
        {g.yonKod ? (
          <Pill
            label={ICERIDEN_YON_ROZET[g.yonKod]}
            tone={yonTonu(g.yonKod)}
            glyph={null}
            size="sm"
          />
        ) : null}
      </View>

      {g.yonKod ? (
        <Text style={[type.micro, { color: colors.textDim }]}>
          {ICERIDEN_YON_SOZLUK[g.yonKod]}
        </Text>
      ) : null}

      {/* SESSİZ KIRPMA YOK: iki sayı da ekranda. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        {g.pencereGun +
          ' günlük pencere · ' +
          sayiMetni(g.bildirimSayisi) +
          ' bildirim seçildi · ' +
          sayiMetni(g.okunan) +
          ' kayıt okundu'}
      </Text>

      {t ? (
        <>
          <Satir
            etiket="Alım"
            deger={sayiMetni(t.alisAdet) + ' adet'}
            not={sayiMetni(t.alisTutar) + ' (üst kaynağın birimi)'}
          />
          <Satir
            etiket="Satım"
            deger={sayiMetni(t.satisAdet) + ' adet'}
            not={sayiMetni(t.satisTutar) + ' (üst kaynağın birimi)'}
          />
          <Satir
            etiket="Net tutar"
            deger={sayiMetni(t.netTutar)}
            not="Alım tutarı eksi satım tutarı — uçta hesaplandı, para birimi çevrilmedi."
          />
          {t.digerAdet ? (
            // Hibe/opsiyon gibi AÇIK PİYASA DIŞI adetler ayrı: alım
            // sanılmasın diye tutarsız ve ayrı satırda.
            <Satir
              etiket="Açık piyasa dışı"
              deger={sayiMetni(t.digerAdet) + ' adet'}
              not="Hibe, opsiyon kullanımı vb. — alım-satım değil, tutarı yok."
            />
          ) : null}
        </>
      ) : null}

      {g.kayitlar.length ? (
        <Katlanir
          baslik="Bildirimleri tek tek gör"
          ozet={sayiMetni(g.kayitlar.length) + ' kayıt'}>
          <View style={styles.govde}>
            {g.kayitlar.map((k, i) => (
              <KayitSatiri k={k} key={String(k.tarih) + '|' + String(k.sahip) + '|' + i} />
            ))}
          </View>
        </Katlanir>
      ) : null}

      <Kaynak adres={g.kaynakAdres} ad="SEC EDGAR" uyari={g.uyari} cik={g.cik} />
    </View>
  );
}

/** Tek Form 4 kaydı. Kişi adı ÜST KAYNAĞIN yazdığı gibi basılıyor. */
function KayitSatiri({ k }: { k: IceridenKayit }) {
  const iliski = k.iliskiKodlari.map((kod) => ICERIDEN_ILISKI_SOZLUK[kod]).join(' · ');
  const alt = [k.tarih, iliski, k.unvan].filter(Boolean).join(' · ');

  // Yön SATIR BAZINDA: tek kayıtta hem alım hem satım olabilir.
  const parcalar: string[] = [];
  if (k.alisAdet) parcalar.push('alım ' + sayiMetni(k.alisAdet));
  if (k.satisAdet) parcalar.push('satım ' + sayiMetni(k.satisAdet));
  if (k.digerAdet) parcalar.push('diğer ' + sayiMetni(k.digerAdet));

  return (
    <Satir
      etiket={k.sahip ?? 'Adı bildirilmemiş'}
      deger={parcalar.length ? parcalar.join(' · ') : EMPTY}
      not={alt || undefined}
    />
  );
}

/** BIST ayağı — başlık var, yapısal sayı YOK. */
function BistGovde({ g }: { g: IceridenBistGovde & IceridenOrtak }) {
  const { colors } = useTheme();

  return (
    <View style={styles.govde}>
      <Text style={[type.body, { color: colors.text }]}>
        {ICERIDEN_DURUM_SOZLUK[g.durumKodu]}
      </Text>

      <Text style={[type.micro, { color: colors.textDim }]}>
        {'Kaynak: ' +
          ICERIDEN_KAYNAK_SOZLUK[g.kaynakKodu] +
          ' · ' +
          sayiMetni(g.bulunan) +
          ' bildirim süzgeçten geçti · ' +
          sayiMetni(g.maddeSayisi) +
          ' tanesi ekranda'}
      </Text>

      {g.maddeler.length ? (
        g.maddeler.map((m, i) => (
          <Pressable
            key={String(m.adres) + '|' + i}
            disabled={!m.adres}
            onPress={() => {
              if (m.adres) void Linking.openURL(m.adres).catch(() => {});
            }}
            hitSlop={6}>
            <Text style={[type.body, { color: m.adres ? colors.info : colors.text }]}>
              {m.baslik}
            </Text>
            {m.tarih ? (
              <Text style={[type.micro, { color: colors.textFaint }]}>{m.tarih}</Text>
            ) : null}
          </Pressable>
        ))
      ) : (
        <VeriYok kartsiz metin="Pencerede bu sembol için bildirim başlığı yok." />
      )}

      {/* BIST'TE SAYI YOK, BU EKRANDA YAZILI: boş adet/tutar basmak
          yerine neden basılmadığı söyleniyor. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        {'KAP bildirimi adet ve tutarı YAPISAL olarak vermiyor — bu pazarda ' +
          'alım/satım miktarı ölçülemiyor, bildirim başlığı basılıyor.'}
      </Text>

      <Kaynak adres={g.kaynakAdres} ad="KAP" uyari={g.uyari} cik={null} />
    </View>
  );
}

/** Kaynak satırı — adres, uyarı ve çerçeve. İkisi de ekranda yazılı. */
function Kaynak({
  adres,
  ad,
  uyari,
  cik,
}: {
  adres: string | null;
  ad: string;
  uyari: string;
  cik: string | null;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.govde}>
      {adres ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(adres).catch(() => {});
          }}
          hitSlop={8}>
          <Text style={[type.micro, { color: colors.info }]}>{ad + ' sayfasını aç ↗'}</Text>
        </Pressable>
      ) : null}

      {/* Uçtan gelen uyarı METİN DEĞİŞTİRİLMEDEN basılıyor; boşsa satır
          hiç çıkmıyor (uydurma not yok). */}
      {uyari ? <Text style={[type.micro, { color: colors.textDim }]}>{uyari}</Text> : null}

      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Kaynak: ' +
          ad +
          (cik ? ' (CIK ' + cik + ')' : '') +
          ' — yalnız bilgi: teknik ya da temel skora GİRMEZ.'}
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
