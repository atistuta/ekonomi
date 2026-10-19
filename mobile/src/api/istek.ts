// =====================================================================
//  useIstek — ÜÇ DURUMU TEK YERDE TUTAN KANCA        (FAZ 2 / native)
// ---------------------------------------------------------------------
//  NE: bir `ApiResult` döndüren çağrıyı koşturur ve ekrana DÖRT durumdan
//  birini verir: 'bos' · 'yukleniyor' · 'hata' · 'veri'.
//
//  NEDEN KANCA, NEDEN HER EKRANDA `useState` ÜÇLÜSÜ DEĞİL: beş ekranın
//  her birinde `const [veri, setVeri]`, `[yukleniyor, setYukleniyor]`,
//  `[hata, setHata]` yazmak üç şeyi KESİNLİKLE bozar — (1) biri
//  `finally` içinde `setYukleniyor(false)` demeyi atlar ve ekran sonsuza
//  kadar iskelet gösterir, (2) biri iptali unutur ve kapanmış ekrana
//  `setState` ederek yarış üretir, (3) biri 'iptal'i HATA sayar ve
//  kullanıcı her tuş vuruşunda kırmızı kutu görür. Ürün kuralı "üç durum
//  HER ekranda GERÇEK olsun" ancak tek uygulamayla tutulur.
//
//  NEDEN 'bos' AYRI BİR DURUM: "henüz sormadım" ile "sordum, sonuç yok"
//  aynı şey değil — projenin dürüstlük çıpası ("Veri yok ≠ ölçemedim")
//  istemci tarafında tam burada yaşıyor. Arama ekranı daha hiçbir şey
//  yazılmamışken "sonuç bulunamadı" derse yalan söylemiş olur.
//
//  NEDEN 'canceled' HATA DEĞİL: `apiGet` iptali ayrı bir tür olarak
//  döndürüyor (client.ts). Kullanıcı semboller arasında gezinirken
//  önceki istek iptal edilir; bunu kırmızıya boyamak, çalışan bir
//  uygulamayı bozukmuş gibi gösterirdi. İptalde durum DEĞİŞMEZ.
//
//  BURADA HESAP YOK: bu dosya skor, eşik, bant, sıra, oran ÜRETMEZ.
//  Yalnız ağ çağrısının yaşam döngüsünü taşır.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ApiError, ApiResult } from './client';

export type IstekDurum = 'bos' | 'yukleniyor' | 'hata' | 'veri';

export type IstekSonuc<T> = {
  durum: IstekDurum;
  veri: T | null;
  hata: ApiError | null;
  /** Elle yeniden deneme / pull-to-refresh. */
  yenile: () => void;
  /** Yenileme sırasında ESKİ veri ekranda kalır; bu bayrak dönen çarkı sürer. */
  taze: boolean;
};

export type IstekAyar = {
  /** false ise istek ATILMAZ ve durum 'bos' kalır (ör. sorgu henüz boş). */
  etkin?: boolean;
};

/**
 * @param cagri  `AbortSignal` alan ve `ApiResult` döndüren işlev.
 * @param anahtar  Girdi kimliği (sembol listesi, sorgu metni...). Değişince
 *   istek yeniden atılır. NEDEN DİZİ DEĞİL DİZGİ: bağımlılık dizisine
 *   nesne koymak her render'da yeni kimlik üretir ve istek sonsuz döner.
 */
export function useIstek<T>(
  cagri: (signal: AbortSignal) => Promise<ApiResult<T>>,
  anahtar: string,
  ayar: IstekAyar = {},
): IstekSonuc<T> {
  const etkin = ayar.etkin !== false;
  const [tur, setTur] = useState(0);

  // NEDEN TEK PARÇA DURUM VE DÖRT `useState` DEĞİL: durum ağ cevabıyla
  // birlikte DOĞAR. Ayrı ayrı tutulsa "yükleniyor"u render sırasında ya da
  // efekt gövdesinde kurmak gerekirdi; React 19 derleyici kuralları bunu
  // (haklı olarak) reddediyor — efekt gövdesinde `setState` fazladan bir
  // render turu demek. Burada durum TÜRETİLİYOR: elde duran kaydın izi
  // istenen izle aynı değilse ekran zaten "ölçülüyor" demektir.
  const [kayit, setKayit] = useState<{
    anahtar: string;
    iz: string;
    veri: T | null;
    hata: ApiError | null;
  } | null>(null);

  /** İstenen ölçümün kimliği: girdi + kaçıncı deneme. */
  const iz = anahtar + '#' + tur;

  // Çağrıyı ref'te tutuyoruz: ekranlar her render'da yeni bir kapanış
  // (closure) yazıyor; bağımlılığa koysak istek her karede yeniden atılırdı.
  // Yazma RENDER SIRASINDA DEĞİL, bu efektte oluyor; efekt bildirim sırası
  // gereği aşağıdaki ağ efektinden ÖNCE koşar, yani ağ efekti hep güncel
  // çağrıyı görür.
  const cagriRef = useRef(cagri);
  useEffect(() => {
    cagriRef.current = cagri;
  }, [cagri]);

  useEffect(() => {
    if (!etkin) return;

    const kontrol = new AbortController();
    let canli = true;

    cagriRef.current(kontrol.signal).then((sonuc) => {
      if (!canli) return;
      if (sonuc.ok) {
        setKayit({ anahtar, iz, veri: sonuc.data, hata: null });
        return;
      }
      // İptal: kullanıcı başka bir şey istedi. Durumu BOZMUYORUZ.
      if (sonuc.error.kind === 'canceled') return;
      setKayit((onceki) => ({
        anahtar,
        iz,
        veri: onceki?.anahtar === anahtar ? (onceki?.veri ?? null) : null,
        hata: sonuc.error,
      }));
    });

    return () => {
      canli = false;
      kontrol.abort();
    };
    // `anahtar` zaten `iz`in icinde: ayri bagimlilik gereksiz tur demek olurdu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iz, etkin]);

  const yenile = useCallback(() => setTur((n) => n + 1), []);

  // --- Türetme: tek doğruluk kaynağı yukarıdaki `kayit` ---------------
  const guncel = kayit?.iz === iz ? kayit : null;
  // NEDEN "AYNI GIRDI" SARTI: yenilemede eski veri ekranda kalabilir, ama
  // BASKA bir sembole gecildiginde onceki sembolun sayilarini gostermek
  // yanlis veri olurdu — o durumda ekran "olculuyor" der.
  const ayniGirdi = kayit?.anahtar === anahtar;
  const veri = !etkin ? null : guncel ? guncel.veri : ayniGirdi ? (kayit?.veri ?? null) : null;
  const hata = guncel ? guncel.hata : null;

  let durum: IstekDurum;
  if (!etkin) {
    durum = 'bos';
  } else if (guncel) {
    durum = guncel.hata ? 'hata' : 'veri';
  } else {
    // Elde eski veri varsa ekranı boşaltmıyoruz: yenileme sırasında içerik
    // "zıplamasın" (algılanan hız FAZ 3 işi ama bedava olan kısmı şimdi).
    durum = veri ? 'veri' : 'yukleniyor';
  }

  return { durum, veri, hata, yenile, taze: etkin && !guncel };
}
