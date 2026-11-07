// =====================================================================
//  SepetEkleKart — sepete elle kalem ekleme           (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: web'in sepet ekleme formunun (`bmAddHolding`, app.js:3303-3340)
//  native karşılığı.
//
//  NEDEN GEREKLİ: `api/depo.ts` sepet türü native'de ÖLÇÜLDÜ ve
//  okunuyordu (`SepetKart`), ama hiçbir ekran ona YAZMIYORDU. Kullanıcı
//  webde kurduğu sepeti telefonda göremiyordu bile — sepet kaydı buluta
//  gönderilmiyor (senkron gövdesi yalnız takip listesini taşıyor), yani
//  telefonda sepet kurmanın hiçbir yolu yoktu. Eksik olan ekran, veri
//  değil.
//
//  BURADA HESAP YOK: bu kart SAYI ÜRETMEZ. Adet ve maliyet kullanıcının
//  GİRDİĞİ sayılar; kart onları `sayiOku` ile okuyup yazıcıya veriyor.
//  Değer, kâr/zarar, toplam, kur çevrimi — hiçbiri burada değil.
//
//  FİYAT ÖLÇÜLMÜYOR (web ile bilinçli ayrılık, `depo.ts` 13. bölümde
//  yazılı): web ekleme ANINDA canlı fiyat çekip `addPrice`/`valTRY`
//  alanlarını dolduruyor. `depo.ts` ağa çıkmıyor, bu yüzden o alanlar
//  `null` kalıyor ve fiyat `SepetKart`taki "Fiyatları ölç" turunda
//  geliyor. ÖLÇÜLMEYEN SAYI BASILMAZ.
//
//  HATA METNİ UYDURULMUYOR: her ret `YazSonuc.mesaj` olduğu gibi
//  basılıyor — sınır, tanınmayan sınıf, yazılamayan depo hepsi yazıcının
//  kendi cümlesi.
//
//  NAKİT BU FORMDA YOK: `SEPET_SINIF_SIRASI` `cash` taşımıyor ve
//  `sepeteEkle` onu reddediyor; nakit bakiyesi `NakitKart`ta.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  sayiOku,
  sepetDepo,
  sepeteEkle,
  useSepet,
  useTurHazir,
  type VarlikSinifi,
} from '@/api';
import { Card, Dugme, Katlanir } from '@/components';
import { SEPET_SINIF_SIRASI, VARLIK_SINIFI_SOZLUK } from '@/lib/sozluk';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type SepetEkleKartProps = Record<string, never>;

export function SepetEkleKart(_props: SepetEkleKartProps = {}) {
  const { colors } = useTheme();

  // Sayıyı kart KENDİ okuyor: `useTurHazir` deponun okunup okunmadığını
  // söylüyor, `useSepet` kalemleri veriyor. Okunmadan önce `undefined`
  // ("sormadım"), okunduktan sonra gerçek sayı (0 dahil) — ikisi AYRI.
  const hazir = useTurHazir(sepetDepo);
  const kalemler = useSepet();
  const mevcutSayi = hazir ? kalemler.length : undefined;

  const [cls, setCls] = useState<VarlikSinifi>('bist');
  const [sembol, setSembol] = useState('');
  const [adet, setAdet] = useState('');
  const [maliyet, setMaliyet] = useState('');
  const [birim, setBirim] = useState('TRY');
  const [fonFiyat, setFonFiyat] = useState('');

  // `null` = henüz yazma denenmedi; boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);
  const [tamam, setTamam] = useState<string | null>(null);

  const temizle = () => {
    setBildirim(null);
    setTamam(null);
  };

  const ekle = () => {
    const s = sembol.trim();
    const q = sayiOku(adet);
    const c = sayiOku(maliyet);
    // SESSİZ REDDETME YOK: eksik alanın hangisi olduğu YAZILI.
    if (!s) {
      setTamam(null);
      setBildirim('Sembol ya da ad gerekli.');
      return;
    }
    if (q == null) {
      setTamam(null);
      setBildirim('Adet bir sayı olmalı.');
      return;
    }
    if (c == null) {
      setTamam(null);
      setBildirim('Maliyet bir sayı olmalı.');
      return;
    }
    void sepeteEkle({
      cls,
      symbol: s,
      qty: q,
      cost: c,
      costCur: birim.trim() || 'TRY',
      // Web fonlarda elle TL fiyat tutuyor (`cls==='fund'?price:null`);
      // girilmediyse `null` — sıfır yazmak ölçülmemiş fiyatı 0 saymaktı.
      manualPrice: cls === 'fund' ? sayiOku(fonFiyat) : null,
    }).then((sonuc) => {
      if (sonuc.ok) {
        setSembol('');
        setAdet('');
        setMaliyet('');
        setFonFiyat('');
        setBildirim(null);
        setTamam('"' + s.toUpperCase() + '" sepete eklendi. Fiyatı henüz ölçülmedi.');
      } else {
        setTamam(null);
        setBildirim(sonuc.mesaj);
      }
    });
  };

  const alanStili = [
    styles.alan,
    type.body,
    { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
  ];

  return (
    <Card
      title="Sepete ekle"
      subtitle={
        // `undefined` ("sormadım") ile 0 ("saydım, yok") ayrı cümleler.
        mevcutSayi === undefined
          ? 'Sepetteki kayıt sayısı okunmadı.'
          : mevcutSayi === 0
            ? 'Sepette kayıt yok.'
            : mevcutSayi + ' kayıt var.'
      }>
      <Katlanir baslik="Yeni kalem" ozet="sınıf · sembol · adet · maliyet">
        <View style={styles.govde}>
          {/* SINIF SEÇİMİ: kapalı küme, `Dugme` satırı. İkinci bir
              dokunma hedefi tanımı YOK. */}
          <View style={styles.satir}>
            {SEPET_SINIF_SIRASI.map((v) => (
              <Dugme
                key={v}
                label={VARLIK_SINIFI_SOZLUK[v]}
                size="sm"
                variant={v === cls ? 'solid' : 'outline'}
                tone={v === cls ? 'gold' : 'neutral'}
                onPress={() => {
                  setCls(v);
                  temizle();
                }}
              />
            ))}
          </View>

          <TextInput
            value={sembol}
            onChangeText={(t) => {
              setSembol(t);
              temizle();
            }}
            placeholder={cls === 'fund' ? 'Fon kodu ya da adı' : 'Sembol (ör. THYAO)'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            returnKeyType="next"
            accessibilityLabel="Eklenecek kalemin sembolü"
            style={alanStili}
          />

          <View style={styles.satir}>
            <TextInput
              value={adet}
              onChangeText={(t) => {
                setAdet(t);
                temizle();
              }}
              placeholder="Adet"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              maxLength={18}
              accessibilityLabel="Adet"
              style={[...alanStili, styles.kisa]}
            />
            <TextInput
              value={maliyet}
              onChangeText={(t) => {
                setMaliyet(t);
                temizle();
              }}
              placeholder="Birim maliyet"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              maxLength={18}
              accessibilityLabel="Birim maliyet"
              style={[...alanStili, styles.kisa]}
            />
            <TextInput
              value={birim}
              onChangeText={(t) => {
                setBirim(t);
                temizle();
              }}
              placeholder="TRY"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              accessibilityLabel="Maliyetin para birimi"
              style={[...alanStili, styles.parabirim]}
            />
          </View>

          {/* FON İSTİSNASI: fonun piyasa fiyatını ölçen uç YOK, web de
              elle giriyor. Yalnız fon seçiliyken görünüyor. */}
          {cls === 'fund' ? (
            <TextInput
              value={fonFiyat}
              onChangeText={(t) => {
                setFonFiyat(t);
                temizle();
              }}
              placeholder="Fonun güncel TL fiyatı (elle)"
              placeholderTextColor={colors.textFaint}
              keyboardType="numeric"
              maxLength={18}
              accessibilityLabel="Fonun elle girilen fiyatı"
              style={alanStili}
            />
          ) : null}

          <Dugme
            label="Sepete ekle"
            size="sm"
            disabled={!sembol.trim() || !adet.trim() || !maliyet.trim()}
            onPress={ekle}
          />

          {bildirim ? (
            <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text>
          ) : null}
          {tamam ? <Text style={[type.small, { color: colors.positive }]}>{tamam}</Text> : null}

          <Text style={[type.micro, { color: colors.textFaint }]}>
            Sepet bu cihazda saklanıyor, buluta GÖNDERİLMİYOR. Eklenen kalemin fiyatı bu anda
            ölçülmüyor; sepet kartındaki “Fiyatları ölç” turunda geliyor. Kendi kaydın — teknik ya
            da temel skora GİRMEZ.
          </Text>
        </View>
      </Katlanir>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.sm },
  satir: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  alan: {
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  kisa: { flexGrow: 1, flexBasis: 110 },
  parabirim: { flexGrow: 0, flexBasis: 78 },
});
