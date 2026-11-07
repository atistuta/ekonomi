// =====================================================================
//  ☁️ BİLDİRİM SENKRONU — listeler buluta, bildirim işçisine
//                                                     (ŞERİT F / native)
// ---------------------------------------------------------------------
//  NE: webin arka planda yaptığı `/api/watchlist` yazmasının
//  (`app.js:2262`) native yüzeyi. Bildirimi AÇIK listelerdeki semboller
//  buluta yazılır; telefon bildirimini atan işçi (`worker/poll.mjs`)
//  AYNI kodun altındaki listeyi okur.
//
//  NEDEN GEREKLİ: her listenin bildirim anahtarı native'de ZATEN
//  çevriliyordu (`ListeBlogu`), ama değer CİHAZDAN ÇIKMIYORDU — anahtar
//  pratikte süstü. Burası o boşluğu kapatan tek yüzey.
//
//  NEDEN KOD EKRANDAN İSTENİYOR: web kodu kaynağa gömüyor
//  (`app.js:2235`, gerekçesi "kişisel uygulama"). Uçta KİMLİK DOĞRULAMA
//  YOK ve bu kod PAYLAŞILAN BİR SIRDIR — gömülü kod her kuruluma aynı
//  kişinin listesini okutup üzerine yazdırırdı. Kod girilmeden hiçbir
//  istek atılmaz; bu da EKRANDA yazılı.
//
//  KOD GERİ BASILMIYOR: kayıtlı kod ne ekrana ne hata cümlesine
//  yazılıyor — ekran kaydına ya da hata günlüğüne sır düşmesin.
//
//  OKUMA KENDİLİĞİNDEN UYGULAMIYOR: "Bulutta ne var?" yalnız GÖSTERİR.
//  Webdeki listeleri bu cihaza almak AYRI ve KULLANICININ BASTIĞI bir
//  adım ("Webdeki listeleri getir"), üstelik İKİ BASIŞLIK: ilk basış ne
//  olacağını yazar, ikincisi uygular. Gerekçe: kod PAYLAŞILAN bir sır
//  ve uçta kimlik doğrulama yok — sessiz bir benimseme, telefondaki
//  listeleri kullanıcının bilmediği bir anda değiştirirdi.
//
//  AKTARMA EZMİYOR: aynı kimlikli liste güncellenir, bu cihazda olup
//  bulutta olmayan liste KORUNUR (gerekçe `api/depo.ts:listeleriAktar`).
//  Web `adoptRemoteState` (`app.js:2131`) localStorage'ı topluca eziyor;
//  burada aynısı telefonda açılmış listeleri sessizce silerdi.
//
//  BURADA HESAP YOK: ekrandaki her sayı ya cihazdaki kayıttan ya ucun
//  cevabından geliyor; eşik/ağırlık/formül yok, skora girmiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  bildirimEvreni,
  senkronCek,
  senkronGonder,
  senkronKodYaz,
  senkronListeAktar,
  senkronYukle,
  useHazir,
  useSenkron,
  useSenkronHazir,
} from '@/api';
import { useListeler } from '@/api/liste';
import { Card, Dugme, Pill } from '@/components';
import { formatGunAySaat } from '@/lib/format';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type SenkronKartProps = Record<string, never>;

/** Bulutta görülen özet — SALT GÖSTERİM, cihaza uygulanmaz. */
type BulutOzet = { liste: number; portfoy: number; guncel: number | null };

/** `updatedAt` MİLİSANİYE, `formatGunAySaat` SANİYE ister: birim çevrimi, hesap değil. */
function anMetni(ms: number | null): string {
  return typeof ms === 'number' ? formatGunAySaat(Math.floor(ms / 1000)) : 'hiç';
}

export function SenkronKart() {
  const { colors } = useTheme();
  const ayar = useSenkron();
  const senkronHazir = useSenkronHazir();
  const listeHazir = useHazir();
  // Abonelik için: liste değişince evren sayıları yeniden hesaplansın.
  useListeler();

  const [kodAlan, setKodAlan] = useState('');
  // `null` = henüz denenmedi; boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);
  const [bulut, setBulut] = useState<BulutOzet | null>(null);
  const [mesgul, setMesgul] = useState(false);
  // İKİ BASIŞ: cihazdaki listeleri değiştiren tek düğme bu, ilk basış
  // yalnız ne olacağını yazıyor.
  const [aktarOnay, setAktarOnay] = useState(false);

  // Bu tür `depoBaslat`ın okuduğu web türlerinden DEĞİL (native'e özel),
  // bu yüzden kaydı kartın kendisi okutuyor.
  useEffect(() => {
    void senkronYukle();
  }, []);

  if (!senkronHazir || !listeHazir) {
    return (
      <Card title="☁️ Bildirim senkronu">
        <Text style={[type.small, { color: colors.textDim }]}>Cihazdaki kayıt okunuyor…</Text>
      </Card>
    );
  }

  const evren = bildirimEvreni();
  const acik = Boolean(ayar.kod);

  const kodKaydet = () => {
    const istenen = kodAlan.trim();
    void senkronKodYaz(istenen).then((s) => {
      if (!s.ok) {
        // Depo mesajı OLDUĞU GİBİ: kart kendi hata cümlesini uydurmuyor.
        setTamam(null);
        setBildirim(s.mesaj);
        return;
      }
      setKodAlan('');
      setBildirim(null);
      setBulut(null);
      setTamam(istenen ? 'Senkron kodu cihaza kaydedildi.' : 'Senkron kapatıldı.');
    });
  };

  const gonder = () => {
    setMesgul(true);
    setBildirim(null);
    setTamam(null);
    void senkronGonder().then((s) => {
      setMesgul(false);
      if (!s.ok) {
        setBildirim(s.mesaj);
        return;
      }
      // Sayı UCUN kendi cevabı: uçtaki temizlikten SONRAKİ adet,
      // gönderilenle aynı olmak zorunda değil — ikisi de yazılı.
      setTamam(
        'Buluta yazıldı: uç ' +
          s.yanit.count +
          ' sembol saydı (gönderilen ' +
          s.evren.kayitlar.length +
          ').',
      );
    });
  };

  const aktar = () => {
    if (!aktarOnay) {
      setBildirim(null);
      setTamam(null);
      setAktarOnay(true);
      return;
    }
    setAktarOnay(false);
    setMesgul(true);
    setBildirim(null);
    setTamam(null);
    void senkronListeAktar().then((s) => {
      setMesgul(false);
      if (!s.ok) {
        // Sebep OLDUĞU GİBİ: kart kendi cümlesini uydurmuyor.
        setBildirim(s.mesaj);
        return;
      }
      setTamam(
        'Webden alındı: ' +
          s.eklenen +
          ' yeni liste, ' +
          s.guncellenen +
          ' liste güncellendi, ' +
          s.korunan +
          ' liste bu cihazda korundu.' +
          (s.budandi ? ' Bazı kayıtlar sınırı aştığı için budandı.' : ''),
      );
    });
  };

  const cek = () => {
    setMesgul(true);
    setBildirim(null);
    setTamam(null);
    void senkronCek().then((s) => {
      setMesgul(false);
      if (!s.ok) {
        setBildirim(s.mesaj);
        return;
      }
      setBulut({
        liste: s.veri.list.length,
        portfoy: s.veri.portfolio.length,
        guncel: s.veri.updatedAt,
      });
    });
  };

  return (
    <Card
      title="☁️ Bildirim senkronu"
      subtitle="Bildirimi açık listelerdeki semboller buluta yazılır; telefon bildirimi oradan beslenir."
      right={
        <Pill
          label={acik ? 'kod kayıtlı' : 'kapalı'}
          tone={acik ? 'positive' : 'neutral'}
          glyph={null}
          size="sm"
        />
      }>
      <View style={styles.govde}>
        <Text style={[type.body, { color: colors.text }]}>
          {evren.kayitlar.length + ' sembol gönderilecek evrende (' + evren.liste + ' liste).'}
        </Text>

        {/* ATLANAN SESSİZ KALMIYOR: her atlama kendi cümlesiyle. */}
        {evren.kapali ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {evren.kapali + ' listenin bildirimi kapalı — o listeler gönderilmiyor.'}
          </Text>
        ) : null}
        {evren.tekrar ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {evren.tekrar + ' kayıt aynı sembol+pazar olduğu için bir kez gidiyor.'}
          </Text>
        ) : null}
        {evren.pazarsiz ? (
          <Text style={[type.micro, { color: colors.gold }]}>
            {evren.pazarsiz + ' kayıt BIST/US dışında bir pazarda — uç bunları kabul etmiyor.'}
          </Text>
        ) : null}

        <Text style={[type.micro, { color: colors.textDim }]}>
          {ayar.sonYazma
            ? 'Bu cihazdan son yazma: ' + anMetni(ayar.sonYazma)
            : 'Bu cihazdan henüz hiç yazılmadı.'}
        </Text>

        <View style={styles.satir}>
          <TextInput
            value={kodAlan}
            onChangeText={(t) => {
              setKodAlan(t);
              setBildirim(null);
              setTamam(null);
            }}
            placeholder={acik ? 'Kodu değiştir (boş kaydet = kapat)' : 'Senkron kodu'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={kodKaydet}
            accessibilityLabel="Senkron kodu"
            style={[
              styles.alan,
              type.body,
              { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
            ]}
          />
          <Dugme label="Kaydet" size="sm" onPress={kodKaydet} />
        </View>

        <View style={styles.satir}>
          <Dugme label="Buluta gönder" size="sm" disabled={!acik || mesgul} onPress={gonder} />
          <Dugme
            label="Bulutta ne var?"
            size="sm"
            variant="outline"
            disabled={!acik || mesgul}
            onPress={cek}
          />
        </View>

        <View style={styles.satir}>
          <Dugme
            label={aktarOnay ? 'Onaylıyorum, getir' : 'Webdeki listeleri getir'}
            size="sm"
            variant="outline"
            disabled={!acik || mesgul}
            onPress={aktar}
          />
        </View>

        {aktarOnay ? (
          <Text style={[type.micro, { color: colors.gold }]}>
            {'Buluttaki listeler bu cihaza alınacak: aynı listeler güncellenecek, ' +
              'yalnız bu cihazda olan listeler korunacak. Onaylamak için tekrar bas.'}
          </Text>
        ) : null}

        {bildirim ? (
          <Text style={[type.micro, { color: colors.negative }]}>{bildirim}</Text>
        ) : null}
        {tamam ? <Text style={[type.micro, { color: colors.positive }]}>{tamam}</Text> : null}

        {bulut ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Bulutta: ' +
              bulut.liste +
              ' takip sembolü, ' +
              bulut.portfoy +
              ' portföy kaydı. Son yazma: ' +
              anMetni(bulut.guncel) +
              '. Bu kayıt YALNIZ gösteriliyor, cihazdaki listelere uygulanmıyor.'}
          </Text>
        ) : null}

        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Kod paylaşılan bir sırdır: aynı kodu giren her cihaz aynı listeyi görür ve ' +
            'üzerine yazabilir. Uçta kimlik doğrulama yok. Kayıtlı kod bu ekranda geri gösterilmez.'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  satir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alan: {
    flex: 1,
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
});
