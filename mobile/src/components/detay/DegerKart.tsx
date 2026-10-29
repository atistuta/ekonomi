// =====================================================================
//  DegerKart — 🏷️ değer ölçümü (metal makro)          (ŞERİT F5 / native)
// ---------------------------------------------------------------------
//  NE: `/api/deger` cevabı (`fetchDeger`): bir METALİN makro rejim skoru
//  (0-100), motorun bant KODU ve bileşen dökümü (ad · bileşen skoru ·
//  motorun ağırlığı) + motorun çekince SAYISI.
//
//  ── ⚠️ BU UÇ DCF / İÇSEL DEĞER DEĞİL (ÖLÇÜLDÜ, KAYNAKTAN) ─────────
//  Şerit tanımı bu kartı "DCF / içsel değer" diye anıyordu; UÇ ÖYLE
//  DEĞİL. `api/_kesif.js`in `degerHandler` sözleşmesi ve istemcinin
//  `DegerIstek` birleşimi (client.ts:1815) iki yol tanıyor:
//    · metal  → GET,  `tur=gram-altin|gumus|platin`, makro ölçümler
//    · kripto → POST, CoinGecko `/coins/{id}` belgesi gövdede
//  Hisse için indirgenmiş nakit akışı ÜRETEN bir uç bu değil ve istemci
//  katmanında başka bir "değer" çağrısı YOK. Uydurma bir hisse yolu
//  kurmak (ör. sembolü metal gibi göndermek) ucun `bad_tur` kapısına
//  çarpardı; daha kötüsü, motorun bilinmeyen anahtarda SESSİZCE genel
//  ağırlığa düştüğü yol açılırsa ÖLÇÜLMEMİŞ bir skor ölçülmüş gibi
//  görünürdü (kapının kendi gerekçesi, types.ts METAL_TURLER notu).
//  Bu yüzden kart YALNIZ metal sembollerinde ölçüm yapıyor; hisse
//  sembollerinde hiç istek atmıyor ve sebebini YAZIYOR.
//
//  ── SEMBOL → METAL EŞLEŞMESİ NEREDEN ──────────────────────────────
//  `METAL_SEMBOL` aşağıda: webin kendi eşlemesinin (app.js:6820
//  `METAL_YSYM = { 'GC=F': 'gram-altin', 'SI=F': 'gumus', 'PL=F':
//  'platin' }`) aynası. SADECE AD eşlemesi — eşik, ağırlık, sıra
//  TAŞIMIYOR, yani motorla çelişemez. Listede olmayan sembol metal
//  SAYILMAZ; yakın isim tahmini YOK ("XAU" gibi bir takma adı burada
//  uydurmak, ölçülmemiş bir eşleşme kurmak olurdu).
//
//  ── MAKRO ÖLÇÜMLER NEDEN GÖNDERİLMİYOR ───────────────────────────
//  `METAL_OLCUM_ALANLAR`ın sekizi de (DXY · 10Y · VIX · oranlar · bakır ·
//  kendi trendi) İSTEMCİDEN gelir; uç onları KENDİ ÇEKEMEZ (_ag.js izin
//  listesi). Bu şerit o sekiz ölçümü çeken bir ayak YAZMIYOR, bu yüzden
//  HİÇBİRİ gönderilmiyor — 0 göndermek "DXY hiç değişmedi" diye ÖLÇÜLMÜŞ
//  bir iddia kurardı (client.ts uyarısı). Motor verilmeyen alanı nötr
//  alıp çekincesine yazıyor; kart bunu gizlemiyor: `uyariAdet` ekranda
//  ve altında "makro ölçümler bu turda gönderilmedi" künyesi var.
//
//  ── BANT METNİ NEDEN TÜRKÇEYE ÇEVRİLMİYOR ────────────────────────
//  Uç `band.label`ı BİLEREK düşürdü, çünkü o metin tavsiye dili taşıyor
//  (api/_kesif.js:710 sözleşme notu); tele yalnız makine kodu (`cls`)
//  konuyor. Kodu burada 'Güçlü' diye çevirmek, ucun kasten düşürdüğü
//  cümleyi geri getirmek olurdu. Kod OLDUĞU GİBİ, nötr bir etiket
//  içinde basılıyor ve yanında "Türkçe bant metni uca konmadı" yazıyor.
//
//  ── BİLEŞEN AĞIRLIKLARI NEDEN ÇARPILMIYOR ────────────────────────
//  TeknikKart'ın gerekçesiyle aynı: `bilesenler[]` hem `skor` hem `w`
//  taşıyor; ikisini çarpıp toplamak skoru İSTEMCİDE yeniden üretmek,
//  yani bir gün motorla ayrışacak ikinci bir sayı yaratmak olurdu.
//  Ağırlık YALNIZ gösteriliyor.
//
//  BURADA HESAP YOK: skor yeniden kurulmuyor, ağırlık normalize
//  edilmiyor, bant eşiği bilinmiyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Satir } from './Satir';
import { fetchDeger, useIstek, type MetalTur } from '@/api';
import { Card, Durum, Pill, ScoreGauge, VeriYok } from '@/components';
import { formatOran, formatScore } from '@/lib/format';
import { space, type, useTheme } from '@/theme';

/**
 * Yahoo vadeli sembolü → motorun metal anahtarı. Webin `METAL_YSYM`
 * eşlemesinin aynası (başlıktaki gerekçe). YALNIZ ad eşlemesi.
 */
const METAL_SEMBOL: Record<string, MetalTur> = {
  'GC=F': 'gram-altin',
  'SI=F': 'gumus',
  'PL=F': 'platin',
};

/** Motor anahtarı → Türkçe ad. Ad çevirisi; eşik/ağırlık TAŞIMAZ. */
const METAL_AD: Record<MetalTur, string> = {
  'gram-altin': 'Gram altın',
  gumus: 'Gümüş',
  platin: 'Platin',
};

/**
 * Sembolün metal karşılığı — yoksa `null` ("bu uç bu sembolü ölçmüyor").
 * DIŞA AÇIK: ekran, kartı hiç basmamaya karar vermek için aynı eşlemeyi
 * kullanıyor; iki yerde iki tablo tutmak ikisinin ayrışması demekti.
 */
export function degerTuruOf(sembol: string | null | undefined): MetalTur | null {
  const s = String(sembol ?? '').trim().toUpperCase();
  if (!s) return null;
  return METAL_SEMBOL[s] ?? null;
}

export type DegerKartProps = {
  /** Çağıranın sembolü. Metal eşleşmesi yoksa istek ATILMAZ. */
  sembol: string;
};

export function DegerKart({ sembol }: DegerKartProps) {
  const { colors } = useTheme();
  const tur = degerTuruOf(sembol);

  const cagri = useCallback(
    (signal: AbortSignal) =>
      // Makro ölçüm GÖNDERİLMİYOR (başlıktaki gerekçe) — `olcumler` yok.
      fetchDeger({ tur: (tur ?? 'gram-altin') as MetalTur }, { signal }),
    [tur],
  );

  // `etkin: false` → istek hiç atılmaz, durum 'bos' kalır. Metal
  // olmayan sembolde `cagri` ÇAĞRILMAZ; yukarıdaki yedek anahtar yalnız
  // tür kapısını geçmek için duruyor, uca gitmiyor.
  const { durum, veri, hata, yenile } = useIstek(cagri, tur ?? '', {
    etkin: Boolean(tur),
  });

  // SORMADIM DALI: hisse/endeks sembolü. Hata değil, veri yokluğu da
  // değil — bu uç o sembolü ölçmüyor.
  if (!tur) {
    return (
      <Card title="🏷️ Değer ölçümü" subtitle="Bu uç metal ve kripto ölçüyor.">
        <VeriYok
          metin={
            'Değer ucu yalnız metal (gram altın · gümüş · platin) ve kripto ölçüyor; ' +
            sembol +
            ' için bir değer ölçümü istenmedi.'
          }
          kartsiz
        />
      </Card>
    );
  }

  const bilesenler = veri?.bilesenler ?? [];

  return (
    <Card
      title="🏷️ Değer ölçümü"
      subtitle={METAL_AD[tur] + ' — makro rejim skoru; bileşen ağırlıkları motordan.'}
      right={
        veri?.cls ? (
          <Pill label={'bant kodu: ' + veri.cls} tone="neutral" glyph={null} size="sm" />
        ) : null
      }>
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="skor"
        bosMetin="Ölçüm bekleniyor."
        kartsiz
      />

      {durum === 'veri' && veri ? (
        <>
          {/* `band` VERİLMİYOR: motorun Türkçe bant metni tele konmadı. */}
          <ScoreGauge score={veri.skor} caption="Değer" />

          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Türkçe bant metni uca konmadı; yukarıdaki kod motorun kendi bant kodudur.'}
          </Text>

          {/* Çekince SAYISI: metinleri uç düşürdü, sayı dürüstlük bilgisi. */}
          <Satir
            etiket="Motorun çekince sayısı"
            not="çekince metinleri uca konmadı"
            deger={String(veri.uyariAdet)}
            erisimEtiketi={'Motorun çekince sayısı ' + veri.uyariAdet}
          />

          {/* Kripto yolunda gelir; metalde gelmez — yoksa satır basılmaz. */}
          {veri.kategori ? (
            <Satir etiket="Kategori kodu" not="Türkçe adı uca konmadı" deger={veri.kategori} />
          ) : null}

          {bilesenler.length ? (
            <View style={styles.dokum}>
              <Text style={[type.smallBold, { color: colors.text }]}>
                {bilesenler.length + ' bileşen ölçüldü'}
              </Text>
              {bilesenler.map((b, i) => (
                <Satir
                  // Uç bileşene kimlik vermiyor; ad + sıra tek ayırt edici.
                  key={b.ad + '#' + i}
                  etiket={b.ad}
                  not={'ağırlık ' + formatOran(b.w)}
                  deger={formatScore(b.skor) + ' /100'}
                  erisimEtiketi={
                    b.ad +
                    ' bileşen skoru ' +
                    formatScore(b.skor) +
                    ', ağırlık ' +
                    formatOran(b.w)
                  }
                />
              ))}
            </View>
          ) : (
            <VeriYok metin="Bileşen dökümü bu turda gelmedi." kartsiz />
          )}

          {/* Eksik girdiyi SUSTURMUYORUZ (başlıktaki gerekçe). */}
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Makro ölçümler (dolar · 10 yıllık faiz · VIX · metaller arası oranlar · bakır · kendi trendi) bu turda gönderilmedi; motor onları nötr aldı ve çekincesine yazdı.'}
          </Text>
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  dokum: { gap: space.xs },
});
