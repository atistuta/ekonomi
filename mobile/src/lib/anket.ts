// =====================================================================
//  ANKET TANIMI — yedi soru, kapalı küme                   (PROcess / native)
// ---------------------------------------------------------------------
//  NE: açılıştaki yatırım profili anketinin soruları, seçenekleri ve
//  Türkçe metinleri. Ekran (`components/anket/AnketEkrani.tsx`) bu
//  diziyi GEZİYOR; kendi içinde soru metni tutmuyor.
//
//  NEDEN VERİ, KOD DEĞİL: soru eklemek/çıkarmak ekranı değiştirmesin.
//  Sıra bu dizideki sıradır; "soru 3 / 7" sayacı dizinin uzunluğundan
//  geliyor — elle yazılmış bir sayı YOK (yanlış sayaç en sık kaçan hata).
//
//  BURADA HESAP YOK, PUAN YOK, RİSK SINIFI YOK: hiçbir seçenek bir
//  sayıya, ağırlığa ya da "risk profili" etiketine çevrilmiyor. Anket
//  yalnız EKRAN AYARI üretiyor (api/depo.ts §11 gerekçesi). Bu yüzden
//  burada "agresif/dengeli/temkinli" gibi bir sınıflandırma da yok —
//  o, kişiselleştirilmiş yatırım tavsiyesinin ilk adımı olurdu.
//
//  TEMA ÇİPLERİ NEDEN SERBEST METİN: tema araması (`/api/theme`) serbest
//  metin alıyor; çipler bir KISAYOL, kapalı küme değil. Kullanıcının
//  kendi yazdığı tema da aynı alana giriyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import type {
  Profil,
  ProfilBildirim,
  ProfilDeneyim,
  ProfilDusus,
  ProfilPazar,
  ProfilTakip,
  ProfilVade,
} from '@/api/depo';

/** Tek seçenek: kayıttaki değer + ekranda görünen cümle. */
export type AnketSecenek<T extends string> = {
  deger: T;
  label: string;
  /** Seçeneğin ne DEĞİŞTİRDİĞİ — vaat değil, ayar. `null` = not yok. */
  not: string | null;
};

/**
 * Tek soru. `alan` kaydın hangi alanına yazılacağını söylüyor; `cok`
 * çoktan seçmeli mi (dizi alanları) belirtiyor.
 */
export type AnketSoru =
  | {
      alan: 'deneyim';
      cok: false;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilDeneyim>[];
    }
  | {
      alan: 'vade';
      cok: false;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilVade>[];
    }
  | {
      alan: 'dusus';
      cok: false;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilDusus>[];
    }
  | {
      alan: 'takip';
      cok: false;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilTakip>[];
    }
  | {
      alan: 'pazarlar';
      cok: true;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilPazar>[];
    }
  | {
      alan: 'temalar';
      cok: true;
      baslik: string;
      altBaslik: string;
      /** Serbest metin çipleri — kapalı küme DEĞİL (bkz. başlık). */
      cipler: readonly string[];
    }
  | {
      alan: 'bildirimler';
      cok: true;
      baslik: string;
      altBaslik: string;
      secenekler: readonly AnketSecenek<ProfilBildirim>[];
    };

/** Tema kısayolları — ekranın alt satırındaki çipler. */
export const ANKET_TEMA_CIPLERI: readonly string[] = [
  'Yapay zeka',
  'Savunma',
  'Sağlık',
  'Enerji',
  'Bankacılık',
  'Yarı iletken',
];

export const ANKET_SORULAR: readonly AnketSoru[] = [
  {
    alan: 'deneyim',
    cok: false,
    baslik: 'Borsayla ne kadar zamandır ilgileniyorsun?',
    altBaslik: 'Doğru cevap yok. Ekranı sana göre ayarlamak için soruyoruz.',
    secenekler: [
      { deger: 'yeni', label: 'Yeni başlıyorum', not: 'Ölçüm bölümleri kapalı açılır.' },
      { deger: 'orta', label: 'Bir süredir takip ediyorum', not: null },
      {
        deger: 'deneyimli',
        label: 'Deneyimliyim',
        not: 'Gösterge dökümü ilk açılışta açık gelir.',
      },
    ],
  },
  {
    alan: 'vade',
    cok: false,
    baslik: 'Hangi vadeyle ilgileniyorsun?',
    altBaslik: 'Motorun dört penceresi var; hangisi önce açılsın?',
    secenekler: [
      { deger: 'gunici', label: 'Gün içi', not: 'Bu vadede teknik ayak ölçülmüyor.' },
      { deger: 'kisa', label: 'Kısa', not: null },
      { deger: 'orta', label: 'Orta', not: null },
      { deger: 'uzun', label: 'Uzun', not: null },
    ],
  },
  {
    alan: 'dusus',
    cok: false,
    baslik: 'Portföyün bir ayda %20 düşerse ne yaparsın?',
    altBaslik: 'Doğru cevap yok. Ekranı sana göre ayarlamak için soruyoruz.',
    secenekler: [
      { deger: 'hepsi', label: 'Hepsini satarım', not: null },
      { deger: 'birKismi', label: 'Bir kısmını satarım', not: null },
      { deger: 'beklerim', label: 'Beklerim', not: null },
      { deger: 'eklerim', label: 'Ekleme yaparım', not: null },
    ],
  },
  {
    alan: 'takip',
    cok: false,
    baslik: 'Ne sıklıkla bakmak istersin?',
    altBaslik: 'Bildirim sıklığının varsayılanını buradan kuruyoruz.',
    secenekler: [
      { deger: 'gunluk', label: 'Her gün', not: null },
      { deger: 'haftalik', label: 'Haftada bir', not: null },
      { deger: 'aylik', label: 'Ayda bir', not: null },
    ],
  },
  {
    alan: 'pazarlar',
    cok: true,
    baslik: 'Hangi pazarlar ilgini çekiyor?',
    altBaslik: 'Birden fazla seçebilirsin.',
    secenekler: [
      { deger: 'bist', label: 'Borsa İstanbul', not: null },
      { deger: 'abd', label: 'ABD hisseleri', not: null },
      { deger: 'kripto', label: 'Kripto', not: null },
      { deger: 'metal', label: 'Değerli metal', not: null },
    ],
  },
  {
    alan: 'temalar',
    cok: true,
    baslik: 'İlgi alanların',
    altBaslik: 'Tema aramasında bunları önce öneriyoruz. Birden fazla seçebilirsin.',
    cipler: ANKET_TEMA_CIPLERI,
  },
  {
    alan: 'bildirimler',
    cok: true,
    baslik: 'Neyden haberdar olmak istersin?',
    altBaslik: 'Bildirim kutuları bu seçime göre işaretli gelir; izni sonra soruyoruz.',
    secenekler: [
      { deger: 'liste', label: 'Listelerimdeki hisselerin haberleri', not: null },
      { deger: 'gundem', label: 'Dünya gündemi: faiz, enflasyon, jeopolitik', not: null },
    ],
  },
];

/** Soru sayısı — "soru n / N" sayacının TEK kaynağı. */
export const ANKET_SORU_SAYISI = ANKET_SORULAR.length;

/**
 * Bir sorunun kayıttaki yanıtı. Çoktan seçmelide dizi, teklide değer
 * ya da `null` (yanıtlanmadı — "boş" değil, YOK).
 */
export function anketYanit(profil: Profil, soru: AnketSoru): string | readonly string[] | null {
  switch (soru.alan) {
    case 'deneyim':
      return profil.deneyim;
    case 'vade':
      return profil.vade;
    case 'dusus':
      return profil.dusus;
    case 'takip':
      return profil.takip;
    case 'pazarlar':
      return profil.pazarlar;
    case 'temalar':
      return profil.temalar;
    case 'bildirimler':
      return profil.bildirimler;
  }
}

/** Soru yanıtlandı mı? "Devam" düğmesinin kapısı. */
export function anketYanitlandi(profil: Profil, soru: AnketSoru): boolean {
  const y = anketYanit(profil, soru);
  if (y == null) return false;
  return Array.isArray(y) ? y.length > 0 : true;
}

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
