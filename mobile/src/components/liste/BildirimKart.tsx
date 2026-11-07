// =====================================================================
//  🔔 TELEFON BİLDİRİMİ — bu cihazı bildirim kümesine kaydeden yüzey
//                                                     (ŞERİT B / native)
// ---------------------------------------------------------------------
//  NE: bildirim iznini ister, bu cihazın bildirim adresini alır ve
//  senkron kodunun altındaki buluta yazar. `☁️ Bildirim senkronu`
//  listeleri taşır; BU kart cihazı taşır. İkisi AYRI: liste bulutta
//  olsa bile cihaz kayıtlı değilse bildirim gelmez.
//
//  SENKRON KODU ÖN KOŞUL: kod girilmeden hiçbir istek atılmaz ve izin
//  penceresi bile açılmaz — bir şey olmayacağını bilerek sistem
//  penceresi açmak olurdu. Kod yoksa bunu söyleyen cümle EKRANDA.
//
//  ADRES EKRANA BASILMIYOR: cihazın bildirim adresi kişiye özeldir;
//  ekran kaydına ya da ekran görüntüsüne düşmesin diye ne kendisi ne de
//  bir parçası gösteriliyor. Ekran yalnız VAR / YOK diyor.
//
//  İKİ SORU AYRI ÇİZİLİYOR:
//   (1) "BU cihaz kayıtlı mı?" — yanıt CİHAZIN kendi kaydında (`sb:push`),
//       çünkü uç jeton listesi DÖNDÜRMÜYOR (bilinçli sızıntı kapısı).
//   (2) "Bulutta kaç cihaz var?" — yanıt UCUN `sayi` alanında.
//  Birini ötekinin yerine basmak yanlış bilgi olurdu.
//
//  SORULMADAN SAYI BASILMAZ: cihaz sayısı sorulmadıysa satır HİÇ
//  çizilmiyor; sorulup gelmediyse “ölçemedim” cümlesi var. Sıfır,
//  yalnız uç sıfır saydıysa yazılır.
//
//  BURADA HESAP YOK: eşik/ağırlık/formül yok; cümleleri `lib/sozluk.ts`
//  seçiyor, sayıları uç veriyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  bildirimDurumOku,
  pushKur,
  pushYukle,
  senkronYukle,
  usePush,
  usePushHazir,
  useSenkron,
  useSenkronHazir,
} from '@/api';
import { Card, DISCLAIMER_TEXT, Dugme, Pill } from '@/components';
import { formatGunAySaat } from '@/lib/format';
import {
  BILDIRIM_ARIZA_SOZLUK,
  PUSH_IZIN_ROZET,
  PUSH_IZIN_SOZLUK,
  PUSH_KUR_SOZLUK,
} from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

export type BildirimKartProps = Record<string, never>;

/** Buluttan okunan özet — SALT GÖSTERİM. `sayi` UÇTA sayıldı. */
type BulutCihaz = { sayi: number; guncel: number | null };

/** `updatedAt` MİLİSANİYE, `formatGunAySaat` SANİYE ister: birim çevrimi, hesap değil. */
function anMetni(ms: number | null): string {
  return typeof ms === 'number' ? formatGunAySaat(Math.floor(ms / 1000)) : 'hiç';
}

/** ISO metni → okunur an. Çözülemezse `null` döner: uydurma an basılmaz. */
function isoAn(ham: string | null): string | null {
  if (!ham) return null;
  const ms = Date.parse(ham);
  return Number.isFinite(ms) ? anMetni(ms) : null;
}

/**
 * Ucun makine kodunu cümleye çevirir. Kod sözlükte YOKSA `null` —
 * tanınmayan koda cümle uydurmuyoruz (sözlüğün kendi kuralı).
 */
function arizaCumlesi(kod: string | null): string | null {
  if (!kod) return null;
  return kod in BILDIRIM_ARIZA_SOZLUK
    ? BILDIRIM_ARIZA_SOZLUK[kod as keyof typeof BILDIRIM_ARIZA_SOZLUK]
    : null;
}

export function BildirimKart() {
  const { colors } = useTheme();
  const push = usePush();
  const pushHazir = usePushHazir();
  const ayar = useSenkron();
  const senkronHazir = useSenkronHazir();

  // `null` = henüz denenmedi; boş dizge BASILMAZ.
  const [uyari, setUyari] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);
  const [bulut, setBulut] = useState<BulutCihaz | null>(null);
  // Soruldu ama ölçüm gelmedi hâli: sayı satırı “ölçemedim” der.
  const [bulutOlcumsuz, setBulutOlcumsuz] = useState(false);
  const [mesgul, setMesgul] = useState(false);

  // İki tür de `depoBaslat`ın okuduğu web türlerinden DEĞİL (native'e
  // özel), bu yüzden kayıtları kartın kendisi okutuyor.
  useEffect(() => {
    void pushYukle();
    void senkronYukle();
  }, []);

  if (!pushHazir || !senkronHazir) {
    return (
      <Card title="🔔 Telefon bildirimi">
        <Text style={[type.small, { color: colors.textDim }]}>Cihazdaki kayıt okunuyor…</Text>
      </Card>
    );
  }

  const kodVar = Boolean(ayar.kod);
  const cihazKayitli = push.jeton != null;
  const yazmaAni = isoAn(push.ts);

  const kur = () => {
    setMesgul(true);
    setUyari(null);
    setTamam(null);
    void pushKur().then((s) => {
      setMesgul(false);
      if (!s.ok) {
        // Cümleyi SÖZLÜK seçiyor; kart kendi hata cümlesini uydurmuyor.
        const ek = arizaCumlesi(s.kod);
        setUyari(ek ? PUSH_KUR_SOZLUK[s.sebep] + ' ' + ek : PUSH_KUR_SOZLUK[s.sebep]);
        return;
      }
      // Sayı UCUN kendi cevabı.
      setBulut({ sayi: s.sayi, guncel: s.updatedAt });
      setBulutOlcumsuz(false);
      setTamam(
        s.saklandi
          ? 'Bu cihaz bildirim kümesine kaydedildi.'
          : 'Kayıt uca yazıldı ama cihaz deposuna yazılamadı — uygulama kapanınca bu bilgi kaybolur.',
      );
    });
  };

  const durumOku = () => {
    setMesgul(true);
    setUyari(null);
    setTamam(null);
    void bildirimDurumOku().then((s) => {
      setMesgul(false);
      if (!s.ok) {
        const ek = arizaCumlesi(s.kod);
        const temel =
          s.sebep === 'kapali' ? PUSH_KUR_SOZLUK.kapali : PUSH_KUR_SOZLUK.uc_hatasi;
        setBulut(null);
        setBulutOlcumsuz(s.sebep !== 'kapali');
        setUyari(ek ? temel + ' ' + ek : temel);
        return;
      }
      setBulutOlcumsuz(false);
      setBulut({ sayi: s.veri.sayi, guncel: s.veri.updatedAt });
    });
  };

  return (
    <Card
      title="🔔 Telefon bildirimi"
      subtitle="Bu cihazı bildirim kümesine kaydeder. Listeler ayrı kartta buluta yazılır."
      right={
        <Pill
          label={PUSH_IZIN_ROZET[push.izin]}
          tone={push.izin === 'verildi' ? 'positive' : 'neutral'}
          glyph={null}
          size="sm"
        />
      }>
      <View style={styles.govde}>
        {/* ① İZİN — üç hâl ayrı cümle. */}
        <Text style={[type.body, { color: colors.text }]}>{PUSH_IZIN_SOZLUK[push.izin]}</Text>

        {/* ② BU CİHAZ — yanıt cihazın kendi kaydında; adres GÖSTERİLMEZ. */}
        <Text style={[type.micro, { color: colors.textDim }]}>
          {cihazKayitli
            ? yazmaAni
              ? 'Bu cihazın bildirim adresi kayıtlı. Son yazma: ' + yazmaAni + '.'
              : 'Bu cihazın bildirim adresi kayıtlı; uca yazma anı ölçülemedi.'
            : 'Bu cihaz bildirim kümesine henüz kaydedilmedi.'}
        </Text>

        {/* ③ SENKRON KODU ÖN KOŞUL. */}
        {!kodVar ? (
          <Text style={[type.micro, { color: colors.gold }]}>
            {'Önce ☁️ Bildirim senkronu kartından senkron kodunu girmen gerekiyor; ' +
              'kod olmadan bu cihaz kaydedilemiyor.'}
          </Text>
        ) : null}

        <View style={styles.satir}>
          <Dugme
            label="Bildirimleri aç"
            size="sm"
            disabled={!kodVar || mesgul}
            onPress={kur}
          />
          <Dugme
            label="Kaç cihaz kayıtlı?"
            size="sm"
            variant="outline"
            disabled={!kodVar || mesgul}
            onPress={durumOku}
          />
        </View>

        {uyari ? <Text style={[type.micro, { color: colors.negative }]}>{uyari}</Text> : null}
        {tamam ? <Text style={[type.micro, { color: colors.positive }]}>{tamam}</Text> : null}

        {/* ④ BULUTTAKİ CİHAZ SAYISI — dört hâl ayrı:
            sorulmadı → satır çizilmez · ölçülemedi → cümle ·
            uç sıfır saydı → sıfır yazılır · dolu → sayı. */}
        {bulut ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Bu kodun altında ' +
              bulut.sayi +
              ' cihaz kayıtlı (uçta sayıldı). Son yazma: ' +
              anMetni(bulut.guncel) +
              '.'}
          </Text>
        ) : bulutOlcumsuz ? (
          <Text style={[type.micro, { color: colors.textDim }]}>
            Kayıtlı cihaz sayısı ölçülemedi.
          </Text>
        ) : null}

        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Uç cihaz adreslerini geri döndürmüyor: hangi cihazların kayıtlı olduğunu ' +
            'bu ekran listeleyemez, yalnız sayısını gösterir. Kod paylaşılan bir sırdır — ' +
            'aynı kodu giren her cihaz aynı bildirim kümesine eklenir.'}
        </Text>

        <Text style={[type.micro, { color: colors.textFaint }]}>{DISCLAIMER_TEXT}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  satir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
