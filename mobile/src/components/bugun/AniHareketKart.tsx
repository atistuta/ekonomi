// =====================================================================
//  ⚡ ANİ HAREKET — /api/hareket                         (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: takip listesindeki sembollerin GÜN İÇİ mumları okunup her biri
//  için ani-hareket ölçümü isteniyor (`api/_hareket.js`). Satır başına
//  üç kapalı-küme kodu (`ani` · `buyuk_gun` · `kirilma`) ve dört ham
//  sayı (gün yüzdesi · saat yüzdesi · hacim oranı · mum sayısı) geliyor.
//
//  ── NİYE BU KART AÇILDI ───────────────────────────────────────────
//  Uç ve yönlendirmesi yazılıydı (`vercel.json` → `/api/proxy?__rota=
//  hareket`), `mobile/` içinde onu ÇAĞIRAN hiçbir şey yoktu: ölçülmüş
//  veri ekrana ulaşmıyordu (`DonemDegisimKarti` ile birebir aynı
//  gerekçe).
//
//  ── NİYE BUGÜN SEKMESİNDE, YENİ SEKMEDE DEĞİL ─────────────────────
//  5'li alt menü (Listeler · Bugün · Keşfet · Analiz · Arama)
//  DEĞİŞMEDİ, `_layout.tsx` AÇILMADI. Soru "listemde şu an ne
//  oynuyor" ve sembol seçtirmiyor — Bugün sekmesi tam olarak sembol
//  seçtirmeyen ölçümlerin yeri.
//
//  ── NİYE `EndeksNabziKarti` / `DonemDegisimKarti` İLE ÇAKIŞMIYOR ──
//  O ikisi SABİT endeks kümesini ölçüyor. Bu kart TAKİP LİSTESİNİ
//  ölçüyor ve tek soru soruyor: gün içi mumlarda ayrışma var mı. Ayrı
//  uçlar, ayrı düşüyorlar; tek karta katlamak biri düştüğünde ölçülen
//  ötekini de kaybettirirdi.
//
//  ── BURADA HESAP YOK ──────────────────────────────────────────────
//  Eşik, ağırlık, formül, yüzde hesabı YOK. `gunYuzde` · `saatYuzde` ·
//  `rvol` UÇTAN GELDİĞİ GİBİ basılıyor. Kodların hangi eşikten çıktığı
//  uçta kalıyor; cevap eşiği TAŞIMIYOR, bu kart da onu yeniden
//  kurmuyor.
//
//  ── `rvol` SAYI OLARAK BASILIYOR, HÜKÜM YOK ───────────────────────
//  Web ekranı `rvol` için bir EKRAN eşiği taşıyor; o eşik MOTORDA YOK
//  ve uç `rvol` için KOD ÜRETMİYOR. Eşiği buraya kopyalamak, motorda
//  olmayan bir kararı native'de uydurmak olurdu. Sayı birimiyle
//  yazılıyor ("hacim oranı … kat"), yorum yok.
//
//  ── DÖRT DURUM AYRI ÇİZİLİYOR ─────────────────────────────────────
//    · alan gövdede HİÇ YOK → SORULMADI, hiçbir şey çizilmiyor
//    · alan var `null`      → ölçüm İSTENDİ, YAPILAMADI → "ölçülemedi"
//    · boş dizi             → ÖLÇÜLDÜ, kapalı kümeden kod çıkmadı
//    · dolu                 → ölçüm
//  Hiçbir durumda eksik ölçümün yerine `0` basılmıyor.
//
//  ── `marketTs` BASILMIYOR (BİLİNÇLİ) ──────────────────────────────
//  Uç `marketTs`i MİLİSANİYE veriyor, `lib/format.ts`teki tarih
//  biçimleyicileri ise SANİYE alıyor. Karta birim çevirisi yazmak
//  native'e sayı işlemi sokmak olurdu; kendi biçimleyicimi yazmak da
//  ikinci bir biçim kaynağı doğururdu. Bu yüzden alan hiç basılmıyor —
//  yanlış saat göstermektense göstermemek.
//
//  ── GECİKME VE EKSİK ÖLÇÜM EKRANDA YAZILI ─────────────────────────
//  `gecikmeli` (BIST) satırda rozet olarak görünüyor. `tam === false`
//  ise "ölçüm EKSİK" yazılıyor ve `sayac` dökümü basılıyor. Ucun
//  `uyari` alanı OLDUĞU GİBİ geçiyor, yeniden yazılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchHareket,
  HAREKET_AZAMI_SEMBOL,
  HAREKET_KODLARI,
  useHazir,
  useIstek,
  useListe,
  type HareketErrorCode,
  type HareketSatir,
} from '@/api';
import { Card, DISCLAIMER_TEXT, Durum, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { formatOran, formatPercent, formatPrice } from '@/lib/format';
import {
  ANI_HAREKET_ROZET,
  ANI_HAREKET_SOZLUK,
  HAREKET_ARIZA_SOZLUK,
} from '@/lib/sozluk';
import { numeric, space, type, useTheme } from '@/theme';

/** Alandan SAYI çıkarır; sayı değilse `null`. `0` SAYIDIR. */
function sayi(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export type AniHareketKartProps = {
  /** Sembole dokunuşun karşılığı ÇAĞIRANIN kararı. */
  onSembol?: (sym: string) => void;
};

export function AniHareketKart({ onSembol }: AniHareketKartProps) {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();

  // Uç tavanı aşan isteği SESSİZCE KIRPMIYOR, 400 diyor. Kırpmayı
  // burada yapıyoruz ve kaç sembolün DIŞARIDA kaldığını yazıyoruz.
  const sorulan = liste.slice(0, HAREKET_AZAMI_SEMBOL);
  const kirpilan = liste.length - sorulan.length;
  const ham = sorulan.join(',');

  const cagri = useCallback(
    (signal: AbortSignal) => fetchHareket(sorulan.slice(), { signal }),
    // `sorulan` her render'da yeni dizi: bağımlılık DİZGİ olmalı, yoksa
    // çağrı her çizimde yeniden kurulurdu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ham],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'ani-hareket:' + ham, {
    etkin: hazir && sorulan.length > 0,
  });

  const satirlar: HareketSatir[] = veri?.satirlar ?? [];
  const sayac = veri?.sayac;
  const ariza = hata?.code
    ? HAREKET_ARIZA_SOZLUK[hata.code as HareketErrorCode]
    : undefined;
  // Ucun kapalı kümesi ile buradaki kopya AYRIŞIRSA sessiz kalmasın.
  const bilinmeyenKod = (veri?.kodlar ?? []).filter(
    (k) => !(HAREKET_KODLARI as readonly string[]).includes(k),
  );

  return (
    <Card
      title="⚡ Ani hareket"
      subtitle="Takip listenin gün içi mumlarında ayrışma ölçümü">
      {hazir && liste.length === 0 ? (
        <Text style={[type.small, { color: colors.textDim }]}>
          {'Takip listesi boş — Listeler sekmesinden sembol ekleyince ölçüm burada çıkar.'}
        </Text>
      ) : (
        <>
          <Durum
            durum={durum}
            hata={hata}
            yenile={yenile}
            kartsiz
            iskelet={3}
            sekil="satir"
            bosMetin="Ani hareket henüz sorulmadı."
          />

          {/* Ucun MAKİNE kodu varsa adıyla anılıyor: genel cümle hangi
              kapının kapandığını söylemiyor. */}
          {durum === 'hata' && ariza ? (
            <Text style={[type.micro, { color: colors.textFaint, marginTop: space.xs }]}>
              {'Uç kodu “' + String(hata?.code) + '”: ' + ariza}
            </Text>
          ) : null}

          {durum === 'veri' && veri ? (
            <>
              {veri.tam === false ? (
                <OlcemedimKutu
                  kartsiz
                  metin={
                    'Gün içi mumların hepsi okunamadı. Aşağıdaki satırlar ölçülenlerin ' +
                    'tamamı değil; hangi sembolde ölçüm eksik kaldığı satır satır yazılı.'
                  }
                />
              ) : null}

              {!satirlar.length ? (
                <VeriYok kartsiz metin="Uç hiçbir sembol için hareket satırı döndürmedi." />
              ) : (
                <>
                  {/* Kaç satırda `ani` kodu var UÇTA sayıldı; satırlar
                      burada yeniden sayılmıyor. */}
                  <Text style={[type.small, { color: colors.textDim }]}>
                    {veri.aniSayisi === 0
                      ? 'Ölçüldü: hiçbir sembolde ani hareket kodu çıkmadı.'
                      : 'Ani hareket kodu çıkan sembol: ' + veri.aniSayisi + '.'}
                  </Text>

                  {satirlar.map((s) => (
                    <SatirBlogu
                      key={s.symbol + ':' + String(s.market)}
                      satir={s}
                      onSembol={onSembol}
                    />
                  ))}
                </>
              )}

              {bilinmeyenKod.length ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>
                  {'Uç bu kartın tanımadığı kod bildirdi: ' +
                    bilinmeyenKod.join(' · ') +
                    ' — cümlesi YOK, kod ham yazılıyor.'}
                </Text>
              ) : null}

              <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
                {veri.semboller.length +
                  ' sembol soruldu · ' +
                  satirlar.length +
                  ' satır döndü' +
                  (sayac
                    ? ' · üst kaynak isteği: ' +
                      sayac.istek +
                      ' (başarı ' +
                      sayac.basari +
                      ' · hata ' +
                      sayac.hata +
                      ' · zaman aşımı ' +
                      sayac.zamanAsimi +
                      ' · kısa gövde ' +
                      sayac.kisa +
                      ')'
                    : '') +
                  (veri.tam === false ? ' · ölçüm EKSİK' : '') +
                  '.'}
              </Text>

              {/* Ucun Türkçe alanı OLDUĞU GİBİ geçiyor. */}
              {veri.uyari ? (
                <Text style={[type.micro, { color: colors.textFaint }]}>{veri.uyari}</Text>
              ) : null}
            </>
          ) : null}

          {kirpilan > 0 ? (
            <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
              {'Takip listesinde ' +
                liste.length +
                ' sembol var; uç bir istekte en çok ' +
                HAREKET_AZAMI_SEMBOL +
                ' sembol alıyor, bu yüzden ilk ' +
                sorulan.length +
                ' soruldu — ' +
                kirpilan +
                ' sembol bu ölçümün DIŞINDA kaldı.'}
            </Text>
          ) : null}

          <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
            {'Bu kart yalnız GÜN İÇİ mum ölçümü gösteriyor. Hacim oranı sayı olarak ' +
              'yazılıyor; uç onun için bir kod üretmiyor, bu kart da ona hüküm bağlamıyor.'}
          </Text>

          <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
            {DISCLAIMER_TEXT}
          </Text>
        </>
      )}
    </Card>
  );
}

/** Tek sembolün bloğu: künye + kodlar + ham sayılar. */
function SatirBlogu({
  satir,
  onSembol,
}: {
  satir: HareketSatir;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const fiyat = sayi(satir.price);
  const onceki = sayi(satir.prevClose);
  const mum = sayi(satir.mumSayisi);

  return (
    <View style={[styles.blok, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <Text
          {...(onSembol
            ? {
                accessibilityRole: 'button' as const,
                accessibilityLabel: satir.symbol + ' — hisse sayfasına git',
                onPress: () => onSembol(satir.symbol),
              }
            : null)}
          style={[type.smallBold, { color: colors.text }]}>
          {satir.symbol}
        </Text>
        <Text style={[type.micro, { color: colors.textFaint }]}>{String(satir.market)}</Text>
        <View style={styles.bosluk} />
        {/* Gecikme RENKLE DEĞİL metinle: uç `gecikmeli` diyorsa yazıyoruz. */}
        {satir.gecikmeli ? (
          <Pill label="gecikmeli" tone="gold" variant="outline" glyph={null} size="sm" />
        ) : null}
        {satir.ok === false ? (
          <Pill label="ölçülemedi" tone="neutral" variant="outline" glyph={null} size="sm" />
        ) : null}
      </View>

      {/* Ölçüm yapılamadıysa SAYI UYDURULMUYOR: uç bütün alanları `null`
          yolluyor, biz de tek cümleyle durumu yazıyoruz. */}
      {satir.ok === false ? (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          {'Gün içi mumlar bu sembol için okunamadı — ölçüm yok.'}
        </Text>
      ) : (
        <>
          <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
            {(fiyat == null
              ? 'fiyat ölçülemedi'
              : 'fiyat ' + formatPrice(fiyat, satir.currency)) +
              ' · ' +
              (onceki == null
                ? 'önceki kapanış ölçülemedi'
                : 'önceki kapanış ' + formatPrice(onceki, satir.currency))}
          </Text>

          <View style={styles.cipler}>
            <YuzdeCipi satir={satir} alan="gunYuzde" ad="gün" />
            <YuzdeCipi satir={satir} alan="saatYuzde" ad="son saat" />
            <OranCipi satir={satir} />
          </View>

          {/* Kodlar: BOŞ DİZİ "ölçtüm, kod çıkmadı" demek — sessiz
              geçmiyor, cümleyle yazılıyor. */}
          {satir.kodlar.length ? (
            <View style={styles.cipler}>
              {satir.kodlar.map((k) => (
                <Pill
                  key={k}
                  label={ANI_HAREKET_ROZET[k] ?? k}
                  tone="info"
                  variant="outline"
                  glyph={null}
                  size="sm"
                />
              ))}
            </View>
          ) : (
            <Text style={[type.micro, { color: colors.textFaint }]}>
              {'Ölçüldü: bu sembolde kapalı kümeden kod çıkmadı.'}
            </Text>
          )}

          {satir.kodlar.map((k) =>
            ANI_HAREKET_SOZLUK[k] ? (
              <Text key={'c-' + k} style={[type.micro, { color: colors.textDim }]}>
                {ANI_HAREKET_SOZLUK[k]}
              </Text>
            ) : null,
          )}

          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {mum == null ? 'ölçülen mum sayısı bildirilmedi' : 'ölçülen mum: ' + mum}
          </Text>
        </>
      )}
    </View>
  );
}

/**
 * Tek yüzde alanı. ÜÇ DURUM: alan gövdede yok → hiçbir şey çizilmiyor;
 * alan var `null` → "ölçülemedi"; sayı → ham yüzde.
 */
function YuzdeCipi({
  satir,
  alan,
  ad,
}: {
  satir: HareketSatir;
  alan: 'gunYuzde' | 'saatYuzde';
  ad: string;
}) {
  const { colors } = useTheme();

  // "Sormadım" ile "ölçemedim" ayrımı alanın VARLIĞINDAN okunuyor.
  if (!Object.prototype.hasOwnProperty.call(satir, alan)) return null;

  const pct = sayi(satir[alan]);
  if (pct == null) {
    return <Text style={[type.micro, { color: colors.textFaint }]}>{ad + ': ölçülemedi'}</Text>;
  }

  return (
    <View style={styles.olcum}>
      <Text style={[type.micro, { color: colors.textDim }]}>{ad}</Text>
      <Text
        style={[
          type.smallBold,
          styles.num,
          // Yön İŞARETLE de taşınıyor: renk tek taşıyıcı değil.
          { color: pct > 0 ? colors.positive : pct < 0 ? colors.negative : colors.text },
        ]}>
        {(pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '• ') + formatPercent(pct)}
      </Text>
    </View>
  );
}

/**
 * Hacim oranı (`rvol`) — SAYI, hüküm yok. Uç bu alan için kod
 * üretmiyor; renk de verilmiyor ki "iyi/kötü" okunmasın.
 */
function OranCipi({ satir }: { satir: HareketSatir }) {
  const { colors } = useTheme();

  if (!Object.prototype.hasOwnProperty.call(satir, 'rvol')) return null;

  const r = sayi(satir.rvol);
  if (r == null) {
    return (
      <Text style={[type.micro, { color: colors.textFaint }]}>{'hacim oranı: ölçülemedi'}</Text>
    );
  }

  return (
    <View style={styles.olcum}>
      <Text style={[type.micro, { color: colors.textDim }]}>hacim oranı</Text>
      <Text style={[type.smallBold, styles.num, { color: colors.text }]}>
        {formatOran(r) + ' kat'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  blok: {
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.xs },
  olcum: { gap: 0, minWidth: 92 },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
