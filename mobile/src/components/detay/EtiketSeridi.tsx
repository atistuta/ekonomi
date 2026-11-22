// =====================================================================
//  EtiketSeridi — hisse sayfasinin akilli etiket satiri (PROcess / native)
// ---------------------------------------------------------------------
//  NE: tasarim dilindeki "akilli etiket satiri": basligin hemen altinda,
//  motorun o hisse icin TAKTIGI etiketleri tek satirda toplayan rozet
//  seridi. Kullanicinin sayfayi asagi kaydirmadan "bu hissede motor ne
//  diyor" sorusuna aldigi ilk cevap.
//
//  NEDEN GEREKLI: detay sayfasi on bir kart uzunlugunda. Motorun en
//  tasiyici etiketlerinden biri (`firsat`) sayfanin HICBIR yerinde
//  basilmiyordu: uc `/api/recommend` govdesinde gonderiyor, native tipi
//  (`Firsat`) VARDI, tuketen ekran YOKTU. Eksik olan ekran, veri degildi.
//
//  AG TURU YOK — SIFIR MALIYET: serit yalnizca ekranin ELINDE DURAN
//  `AnalyzeRow`dan okuyor. Burada hicbir uc cagrilmiyor, cunku bir rozet
//  satiri icin sayfanin acilisina ikinci bir tur eklemek (ozellikle
//  `/api/iceriden` gibi ust kaynaga cikan bir uca) serit kadar ucuz
//  olmazdi. Iceriden islemler kendi kartinda, kendi turuyla duruyor.
//
//  NEDEN SAYI DEGIL ETIKET: serit bir OZET. Yukarida bileske skor
//  (`DetayBasligi`), asagida teknik/temel/risk kartlari zaten SAYIYI
//  basiyor; ayni sayiyi serite de yazmak iki yerde tutulan tek dogru
//  demekti. TEK ISTISNA `firsat.bilesik`: o sayi baska HICBIR yerde
//  basilmiyor, yani burada tekrar degil tek kaynak.
//
//  CUMLELER SOZLUKTEN, KOD UCTAN: `firsat.cls` kapali kumeli bir KOD
//  (`strong`...`risk`); Turkcesi `FIRSAT_ROZET`ten seciliyor. Esikler
//  (66/56/52/48/44) YALNIZ motorda — bu dosyada esik, agirlik, formul
//  YOK ve hicbir rozet iki alandan turetilmiyor.
//
//  OLCULMEYEN ROZET BASILMAZ: alan `undefined` ise uc o surumde
//  gondermiyor, `null` ise olculemedi; iki halde de rozet CIZILMIYOR.
//  "Notr" diye bir rozet UYDURULMUYOR, sifir basilmiyor. Serit bos
//  kalirsa kendisi de cizilmiyor (bos bir kutu "olcum yok" demek degil;
//  o cumleyi kartlar kendi icinde soyluyor).
//
//  YON TASIYAN TON KULLANILMIYOR: butun rozetler `neutral`/`vurgu` —
//  `positive`/`negative` secmek motorun bandina AL/SAT rengi takmak,
//  yani bir yargi eklemek olurdu. Renk burada yalniz gruplama.
//
//  Bilgi amaclidir, yatirim tavsiyesi degildir.
// =====================================================================

import { StyleSheet, View } from 'react-native';

import type { AnalyzeRow } from '@/api';
import { Pill } from '@/components';
import { formatScore } from '@/lib/format';
import { FIRSAT_ROZET } from '@/lib/sozluk';
import { space } from '@/theme';

export type EtiketSeridiProps = {
  /** Ekranin elinde duran kayit. Serit BUNDAN BASKA hicbir kaynak okumuyor. */
  satir: AnalyzeRow;
};

/** Tek rozetin tasidigi veri. `metin` ekrana basilacak HAZIR dizgi. */
type Etiket = { anahtar: string; metin: string; vurgulu: boolean };

export function EtiketSeridi({ satir }: EtiketSeridiProps) {
  const etiketler: Etiket[] = [];

  // ① FIRSAT BANDI — motorun `oppTag().cls` kodu, sozlukten cumle.
  //    Sayfanin baska hicbir yerinde basilmiyor (basliktaki gerekce).
  const cls = satir.firsat?.cls ?? null;
  if (cls && FIRSAT_ROZET[cls]) {
    etiketler.push({ anahtar: 'firsat', metin: 'Fırsat: ' + FIRSAT_ROZET[cls], vurgulu: true });
  }

  // ② BILESIK SKOR — `teknik skor + fiyatPuan`, KIRPMASI MOTORDA
  //    (2..99). Burada toplama YAPILMIYOR: uc hazir sayiyi gonderiyor.
  const bilesik = satir.firsat?.bilesik ?? null;
  if (typeof bilesik === 'number' && Number.isFinite(bilesik)) {
    etiketler.push({
      anahtar: 'bilesik',
      metin: 'Bileşik ' + formatScore(bilesik) + '/100',
      vurgulu: false,
    });
  }

  // ③ TEKNIK REJIM — motorun rejim adi (`ta.regime`), oldugu gibi.
  //    Teknik kartin kose rozetiyle AYNI metin; serit onu yukari
  //    tasiyor, yeni bir sey SOYLEMIYOR.
  if (satir.ta?.regime) {
    etiketler.push({ anahtar: 'rejim', metin: satir.ta.regime, vurgulu: false });
  }

  // ④ TEMEL KARARI — `analiz.faKarar.label`; 6 degerli kapali kume,
  //    metin MOTORDAN. Istemci bu etiketi secmiyor, tasiyor.
  const faLabel = satir.analiz?.faKarar?.label ?? null;
  if (faLabel) {
    etiketler.push({ anahtar: 'fakarar', metin: faLabel, vurgulu: false });
  }

  // ⑤ BUTUNCUL BANT — `butunculluk.band.l`; 0-10 skorun bandi. SAYI
  //    BASILMIYOR (o TezKart'ta duruyor), yalniz bandin ADI.
  const btnBant = satir.analiz?.butunculluk?.band?.l ?? null;
  if (btnBant) {
    etiketler.push({ anahtar: 'butuncul', metin: btnBant, vurgulu: false });
  }

  // Tek rozet bile cikmadiysa serit CIZILMIYOR (basliktaki gerekce).
  if (!etiketler.length) return null;

  return (
    <View style={styles.serit}>
      {etiketler.map((e) => (
        <Pill
          key={e.anahtar}
          label={e.metin}
          tone={e.vurgulu ? 'vurgu' : 'neutral'}
          glyph={null}
          size="sm"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM: sarmalanan tek satir. Hesap yok.
  serit: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});

// Bilgi amaclidir, yatirim tavsiyesi degildir.
