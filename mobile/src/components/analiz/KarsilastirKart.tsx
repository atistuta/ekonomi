// =====================================================================
//  ⚖️ KarsilastirKart — /api/compare sıralaması        (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `/api/compare` cevabının `sira` dizisini tablo olarak basar:
//  sembol · bileşke · TA · FA · sıra. Altında sıralanamayanlar.
//
//  NEDEN TABLO, NEDEN KART YIĞINI DEĞİL: karşılaştırmanın tek işi aynı
//  ölçütü yan yana okutmak. Her sembolü kendi kartına koymak, gözün
//  sayıları satır satır eşlemesini zorunlu kılar — kıyas kaybolur.
//
//  BURADA HESAP YOK — EN KRİTİK NOKTA BU:
//    · Sıra MOTORUN (`sira[].sira`). İstemci diziyi YENİDEN SIRALAMAZ:
//      `SiraKayit` notu ölçtü ki anahtar `dAtr`, eşitlik bozucu
//      `skor10` — ikinci bir sıralama kuralı yazmak iki ekranda iki
//      farklı birinci sıra demek olurdu. Dizi GELDİĞİ GİBİ basılıyor.
//    · `dAtr` "GÜN" DEĞİLDİR: (fiyat − bant üstü) ÷ ATR, yani uzaklığın
//      tipik bir günlük SALINIMIN kaç katı olduğu. ATR bir günün
//      yüksek−düşük genişliğidir, günlük net düşüş değil; dahası
//      mesafe-süre ilişkisi doğrusal değil. Bu yüzden ekranda "N günlük
//      düşüş" yazmıyoruz (düzeltildi 2026-10-25) — `formatBandUzakligi`.
//    · YÜZDE UZAKLIK UÇTAN GELMİYOR → türetilmiyor. `SiraKayit`e `pct`
//      eklenirse cümle "bandın %2,4 üstünde" ile tamamlanır.
//    · TA / FA / bileşke skorları `sonuclar[]`dan OKUNUR, türetilmez.
//      Bileşke `blendedShown`dur (motorun yuvarlaması); `blended`den
//      yuvarlama yapılmaz.
//    · `durum` (in|below|near|far) ve bantlar METİN olarak basılır;
//      eşik tablosu istemcide YOK.
//    · `rrRatio` BİLGİ — uç notu açıkça "sıralamaya girmez" diyor;
//      burada da sıralamaya girmiyor, yalnız künye satırında duruyor.
//
//  NEDEN `fetch` YOK: proje kuralı "ekranlar ister, komponentler
//  çizer" (`components/` içinde `fetch` yok). Veri props'tan gelir;
//  `durum`/`hata`/`yenile` de `useIstek`in döndürdüğü hâliyle.
//
//  NEDEN İKİ DİZİ TEK TABLOYA: `CompareResponse = AnalyzeResponse &
//  { sira, siralanamayan }`, yani skorlar `sonuclar`da, sıra `sira`da.
//  Eşleme sembol üzerinden yapılıyor; `sonuclar`da karşılığı olmayan
//  bir sıra kaydı SESSİZCE DÜŞMEZ, skorları `—` basar.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { StyleSheet, Text, View } from 'react-native';

import type { AnalyzeRow, ApiError, CompareResponse, IstekDurum, SiraKayit } from '@/api';
import { Card, Durum, OlcumEksikRozet, Pill, VeriYok } from '@/components';
import { formatBandUzakligi, formatOran, formatScore } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

/**
 * Alım bandı durumunun TÜRKÇESİ. Küme SABİT ve MOTORUN
 * (`SiraKayit.durum`: in | below | near | far) — burada yalnız etiket
 * çevirisi var, eşik ya da yeniden sınıflama YOK.
 */
const DURUM_METIN: Record<string, string> = {
  in: 'bandın içinde',
  below: 'bandın altında',
  near: 'banda yakın',
  far: 'bandan uzak',
};

export type KarsilastirKartProps = {
  /** `/api/compare` gövdesi. `null` → henüz veri yok. */
  veri: CompareResponse | null;
  durum: IstekDurum;
  hata: ApiError | null;
  yenile: () => void;
  /**
   * Hangi semboller soruldu — boş sonuçta cümleyi somut yapar
   * ("THYAO.IS, KO için sıralama dönmedi"). Verilmezse genel cümle.
   */
  semboller?: string[];
};

export function KarsilastirKart({
  veri,
  durum,
  hata,
  yenile,
  semboller = [],
}: KarsilastirKartProps) {
  const { colors } = useTheme();

  // Sembol → skor satırı. `find()` ile iç içe döngü kurmamak için;
  // sıralama BURADA DEĞİŞMİYOR, yalnız arama hızlanıyor.
  const skorlar = new Map<string, AnalyzeRow>();
  for (const s of veri?.sonuclar ?? []) skorlar.set(s.sym.toUpperCase(), s);

  const sira = veri?.sira ?? [];
  const siralanamayan = veri?.siralanamayan ?? [];

  return (
    <Card
      title="⚖️ Karşılaştır"
      subtitle="Sıra motorun; istemci diziyi yeniden sıralamaz"
      right={
        durum === 'veri' && sira.length ? (
          <Pill label={sira.length + ' sembol'} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      {/* `kartsiz`: zaten bir `Card`ın içindeyiz, iç içe iki kenar
          çizilmesin. İskelet şekli 'sira' — ekranın GERÇEKTEN beklediği
          içerik sıralama satırı, fiyat satırı değil. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={Math.max(2, semboller.length || 3)}
        sekil="sira"
        kartsiz
        bosMetin="En az iki sembol seç; kıyas o zaman istenecek."
      />

      {durum === 'veri' ? (
        sira.length ? (
          <>
            {/* Eksik ölçüm rozeti TABLONUN ÜSTÜNDE: `tam:false` ile
                gelen bir sıralamayı önce gösterip altına künye düşmek,
                eksik ölçümü tam ölçüm gibi sunmaktı. */}
            <OlcumEksikRozet kaynak={veri} />

            <View style={[styles.baslik, { borderColor: colors.border }]}>
              <Text style={[type.micro, styles.hSembol, { color: colors.textDim }]}>SEMBOL</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>BİLEŞKE</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>TA</Text>
              <Text style={[type.micro, styles.hSayi, { color: colors.textDim }]}>FA</Text>
              <Text style={[type.micro, styles.hSira, { color: colors.textDim }]}>SIRA</Text>
            </View>

            {sira.map((k) => (
              <Satir key={k.sym} kayit={k} skor={skorlar.get(k.sym.toUpperCase()) ?? null} />
            ))}

            {/* NEDEN AYRI BLOK, NEDEN SESSİZ DÜŞMÜYOR: uç notu
                (`CompareResponse.siralanamayan`) "sessizce düşürülmez,
                ekranda yazar" diyor. Sorulan ama sıralanamayan sembolü
                listeden çıkarmak, kullanıcıya eksik bir kıyası tam
                kıyas gibi göstermek olurdu. */}
            {siralanamayan.length ? (
              <View style={styles.dipnot}>
                <Pill label="sıralanamadı" tone="neutral" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {siralanamayan.join(', ') +
                    ' — alım bandı ya da fiyatı ölçülemedi, sıraya girmedi.'}
                </Text>
              </View>
            ) : null}

            {/* ATLANAN AYRI BİR ŞEY: `siralanamayan` ÖLÇÜLDÜ ama bandı
                yok; `atlanan` ise zaman bütçesi dolduğu için HİÇ
                BAŞLANMADI (`ScoreResponse.atlanan` notu). İkisini aynı
                cümleye koymak "ölçtüm, sonuç yok" ile "ölçemedim"i
                karıştırmak olurdu. */}
            {(veri?.atlanan?.length ?? 0) > 0 ? (
              <View style={styles.dipnot}>
                <Pill label="ölçülmedi" tone="gold" glyph={null} size="sm" />
                <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                  {(veri?.atlanan ?? []).join(', ') +
                    ' — zaman bütçesi dolduğu için bu turda hiç ölçülmedi.'}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <VeriYok
            kartsiz
            metin={
              (semboller.length ? semboller.join(', ') : 'Seçilen semboller') +
              ' için motor sıralama döndürmedi.'
            }
          />
        )
      ) : null}
    </Card>
  );
}

/**
 * Tek sıralama satırı. Sayılar `tabular-nums` (`theme/typography.ts`
 * → `numeric`) — orantılı rakam sütunu satırdan satıra kaydırırdı.
 */
function Satir({ kayit, skor }: { kayit: SiraKayit; skor: AnalyzeRow | null }) {
  const { colors } = useTheme();

  const bilesike = skor?.composite.blendedShown ?? null;
  const taSkor = skor?.ta.score ?? null;
  const faSkor = skor?.fa.score ?? null;
  const durumMetni = DURUM_METIN[kayit.durum] ?? kayit.durum;

  return (
    <View
      style={[styles.satir, { borderColor: colors.border }]}
      accessible
      accessibilityLabel={
        kayit.sym +
        ', sıra ' +
        kayit.sira +
        ', bileşke ' +
        formatScore(bilesike) +
        ', teknik ' +
        formatScore(taSkor) +
        ', temel ' +
        formatScore(faSkor) +
        ', ' +
        durumMetni +
        ', ' +
        formatBandUzakligi(kayit.dAtr)
      }>
      <View style={styles.hSembol}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={1}>
          {kayit.sym}
        </Text>
        <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
          {durumMetni}
        </Text>
      </View>
      <Text style={[type.smallBold, numeric, styles.hSayi, { color: colors.text }]}>
        {formatScore(bilesike)}
      </Text>
      <Text style={[type.small, numeric, styles.hSayi, { color: colors.textDim }]}>
        {formatScore(taSkor)}
      </Text>
      <Text style={[type.small, numeric, styles.hSayi, { color: colors.textDim }]}>
        {formatScore(faSkor)}
      </Text>
      <Text style={[type.smallBold, numeric, styles.hSira, { color: colors.gold }]}>
        {String(kayit.sira)}
      </Text>

      {/* KÜNYE SATIRI: motorun sıralama anahtarı (`dAtr`) ve
          sıralamaya GİRMEYEN bilgi (`rrRatio`, `skor10`). Ayrı satırda,
          çünkü tablo sütunu olsalardı aynı ağırlıkta okunurlardı —
          `rrRatio` ise uç notunun açıkça "bilgi" dediği alan. */}
      <Text style={[type.micro, numeric, styles.kunye, { color: colors.textFaint }]}>
        {'Alım bandına: ' +
          formatBandUzakligi(kayit.dAtr) +
          '  ·  bütüncül ' +
          formatOran(kayit.skor10, 1) +
          '/10  ·  R/Ö ' +
          (typeof kayit.rrRatio === 'number' ? kayit.rrRatio.toFixed(1) + '×' : '—') +
          ' (bilgi, sıraya girmez)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  baslik: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  satir: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hSembol: { flex: 3, minWidth: 64 },
  hSayi: { flex: 2, textAlign: 'right' },
  hSira: { flex: 1.2, textAlign: 'right' },
  // Künye tam satır: `flexWrap` ile alt sıraya düşer.
  kunye: { width: '100%' },
  dipnot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.sm,
  },
});
