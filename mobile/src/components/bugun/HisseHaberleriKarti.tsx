// =====================================================================
//  📰 HİSSE HABERLERİ — takip listesinin manşetleri      (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `GET /api/news?symbols=A,B,…` (kip ②) — takip listesindeki her
//  sembol için AYRI besleme, SATIR BAŞINA sayaç. Web'de bu `news`
//  sekmesiydi (`index.html:78` → `📰 Hisse Haberleri`).
//
//  NEDEN BU KART AÇILDI (ÖLÇÜLDÜ 2026-11-03): webin sekme dökümü
//  (`index.html:71-107`) 17 sekme sayıyor; `news` sekmesinin native'de
//  KARŞILIĞI YOKTU. Uç noktanın çoklu-sembol kipi ÜRETİMDE CANLIYDI ama
//  `mobile/` içinde onu çağıran hiçbir şey yoktu — ölçülmüş veri çöpe
//  gidiyordu (`TakvimKart` ile BİREBİR aynı gerekçe).
//
//  NEDEN BUGÜN SEKMESİNDE, YENİ SEKMEDE DEĞİL: 5'li alt menü (Listeler ·
//  Bugün · Keşfet · Analiz · Arama) DEĞİŞMEDİ, `_layout.tsx` AÇILMADI.
//  Bu kart "listemde bugün ne oldu" sorusunun cevabı ve TEK sembol
//  seçmeyi beklemiyor — takip listesinin TAMAMINI birden okuyor; Bugün
//  sekmesi zaten sembol seçtirmeyen ölçümlerin yeri.
//
//  ── ÖLÇÜLMÜŞ SAPMA: KAP BU KARTTA YOK ─────────────────────────────
//  Webin o sekmesi İKİ kaynağı birleştiriyordu (`app.js
//  loadUnifiedNews`): bütün KAP duyuruları + portföyün sembol haberi.
//  Bu uç KAP ÜRETMİYOR (`api/news.js:129` — `type` DAİMA `'NEWS'`).
//  Native'de KAP duyurusu AYRI uçtan geliyor (`/api/takvim` →
//  🗓️ Takvim kartı). İki kaynağı burada birleştirmek "haber mi duyuru
//  mu" ayrımını istemcide yeniden kurmak olurdu; bu yüzden kart iki
//  ölçümü YAN YANA bırakıyor ve KAP'ın nerede olduğunu AÇIKÇA yazıyor.
//
//  ── SATIR BAŞINA DÜRÜSTLÜK: `adet: 0` ile `tam: false` AYNI DEĞİL ──
//  Uç her sembol için kendi sayacını tutuyor (`api/news.js:631-634`):
//    · `adet: 0` + `tam: true`  → "bu hissede haber YOK" (ÖLÇÜM).
//    · `tam: false`             → "ÖLÇEMEDİM" (besleme düştü).
//  İkisi AYNI CÜMLEYLE anlatılmıyor: ilki veri cevabı, ikincisi eksik
//  ölçüm. Karıştırmak kullanıcıya "haber yok" diye yanlış bir kesinlik
//  satmak olurdu.
//
//  ── PAZAR BU KARTTA SORULMUYOR ────────────────────────────────────
//  Uç pazarı SEMBOLÜN KENDİSİNDEN çözüyor (`api/_girdi.js
//  temizleSembol`: `.IS` eki → BIST, sonek yoksa `market` varsayılanı →
//  US). Takip listesi iki pazardan karışık (`liste.ts BASLANGIC_LISTE`)
//  ve ham sembolü sonekiyle tutuyor, o yüzden liste OLDUĞU GİBİ
//  gönderiliyor: burada pazar tahmini YAPILMIYOR, pazar seçtiren bir
//  düğme de yok. Satırın pazarını uç cevabında BİLDİRİYOR ve kart onu
//  basıyor.
//
//  ── LİSTE 8'DEN UZUNSA KIRPILIYOR VE BU YAZILIYOR ─────────────────
//  Ortak sembol kapısı 8 sembolde duruyor (`_girdi.js AZAMI_SEMBOL`).
//  Daha uzun listede sessizce kırpmak, kullanıcıya "listenin tamamı bu"
//  demek olurdu — kart kaç sembolün sorulduğunu ve kaçının DIŞARIDA
//  kaldığını açıkça yazıyor.
//
//  ── BURADA HESAP YOK ──────────────────────────────────────────────
//  Eşik, ağırlık, formül, skor YOK. Sıralama uçta (`pubDate` azalan) —
//  istemci yeniden sıralamıyor. Adetler (`adet`, `sayac`, `ms`)
//  SUNUCUDAN okunup basılıyor. Sembol süzgeci bir SEÇİM, ölçüm değil:
//  maddenin kendi `symbol` alanına bakıyor (uç onu yazıyor,
//  `api/news.js:80-140`), başlıktan sembol çıkarmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AZAMI_SEMBOL,
  fetchHisseHaberleri,
  haberOlcumEksik,
  useHazir,
  useIstek,
  useListe,
  type HaberMadde,
  type SembolHaberSatiri,
} from '@/api';
import {
  Card,
  DISCLAIMER_TEXT,
  Dugme,
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  Pill,
  VeriYok,
} from '@/components';
import { DuyarlilikOzeti, HaberSatiri } from '@/components/kesfet';
import { space, type, useTheme } from '@/theme';

export type HisseHaberleriKartiProps = {
  /**
   * SEMBOL BAŞINA madde sınırı — ucun 1..25 aralığı. Verilmezse ucun
   * kendi varsayılanı (10) kullanılır; istemci kendi sayısını uydurmaz.
   */
  limit?: number;
};

export function HisseHaberleriKarti({ limit }: HisseHaberleriKartiProps) {
  const { colors } = useTheme();
  const liste = useListe();
  const hazir = useHazir();

  // Süzgeç bir SEÇİM: hangi sembolün maddeleri gösterilsin. `null` =
  // hepsi. Webdeki sembol çipleriyle aynı iş (`app.js
  // renderUnifiedNews` → `#newsFilterChips`).
  const [secili, setSecili] = useState<string | null>(null);

  // Ortak kapı 8 sembolde duruyor: kırpmak YERİNE kaç sembolün dışarıda
  // kaldığını yazıyoruz (aşağıda, kart içinde).
  const sorulan = liste.slice(0, AZAMI_SEMBOL);
  const kirpilan = liste.length - sorulan.length;
  const ham = sorulan.join(',');

  const cagri = useCallback(
    (signal: AbortSignal) => fetchHisseHaberleri(sorulan.slice(), { limit, signal }),
    // `sorulan` her render'da yeni dizi: bağımlılık DİZGİ olmalı, yoksa
    // çağrı her çizimde yeniden kurulurdu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ham, limit],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, 'hisse-haber:' + ham + '|' + String(limit ?? ''), {
    etkin: hazir && sorulan.length > 0,
  });

  const eksik = haberOlcumEksik(veri ?? null);
  const satirlar: SembolHaberSatiri[] = veri?.semboller ?? [];
  const maddeler: HaberMadde[] = veri?.maddeler ?? [];
  // Madde süzme: uçun YAZDIĞI `symbol` alanına bakıyor. Alan boş olan
  // madde süzgeç açıkken GÖSTERİLMİYOR — hangi hisseye ait olduğu
  // ölçülmemişken ona ait saymak uydurma olurdu.
  const gosterilen = secili
    ? maddeler.filter((m) => (m.symbol ?? '').toUpperCase() === secili)
    : maddeler;

  return (
    <Card
      title="📰 Hisse haberleri"
      subtitle="Takip listesindeki her sembol için ayrı manşet beslemesi">
      {hazir && liste.length === 0 ? (
        <Text style={[type.small, { color: colors.textDim }]}>
          {'Takip listesi boş — Listeler sekmesinden sembol ekleyince manşetler burada çıkar.'}
        </Text>
      ) : null}

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={4}
        sekil="metin"
        bosMetin="Takip listesi okunuyor."
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri && eksik ? (
        <OlcemedimKutu
          metin={
            'Beslemelerin hepsi okunamadı — ' +
            (veri.uyari ? 'uç uyarı bildirdi' : 'uç tam tarama bildirmedi') +
            '. Aşağıdaki başlıklar gelenlerin tamamı değil; hangi sembolde ölçüm ' +
            'eksik kaldığı satır satır yazılı.'
          }
          yenile={yenile}
        />
      ) : null}

      {/* SATIR BAŞINA ÖLÇÜM — "haber yok" ile "ölçemedim" ayrı cümle. */}
      {durum === 'veri' && satirlar.length ? (
        <View style={styles.satirlar}>
          {satirlar.map((s) => {
            const kod = (s.symbol ?? '').toUpperCase();
            const aktif = secili === kod;
            return (
              <Dugme
                key={kod + ':' + s.market}
                label={kod + ' · ' + (s.tam ? String(s.adet) : '—')}
                variant={aktif ? 'solid' : 'outline'}
                size="sm"
                tone={s.tam ? 'neutral' : 'gold'}
                onPress={() => setSecili(aktif ? null : kod)}
              />
            );
          })}
          {secili ? (
            <Dugme label="Süzgeci kaldır" variant="outline" size="sm" onPress={() => setSecili(null)} />
          ) : null}
        </View>
      ) : null}

      {durum === 'veri' && satirlar.length ? (
        <View style={styles.notlar}>
          {satirlar.filter((s) => !s.tam).length ? (
            <View style={styles.not}>
              <Pill label="ölçemedim" tone="gold" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                {'Beslemesi okunamayan sembol: ' +
                  satirlar.filter((s) => !s.tam).map((s) => s.symbol).join(', ') +
                  ' — bu sembollerde “haber yok” DENMİYOR, ölçüm eksik kaldı.'}
              </Text>
            </View>
          ) : null}
          {satirlar.filter((s) => s.tam && s.adet === 0).length ? (
            <View style={styles.not}>
              <Pill label="veri yok" tone="neutral" glyph={null} size="sm" />
              <Text style={[type.micro, { color: colors.textDim, flex: 1 }]}>
                {'Ölçüldü, manşet çıkmadı: ' +
                  satirlar.filter((s) => s.tam && s.adet === 0).map((s) => s.symbol).join(', ') +
                  ' — bu ÖLÇÜLMÜŞ bir cevap.'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* DUYARLILIK ÖZETİ — ucun `duyarlilik` katmanı, BÜTÜN maddelerin
          birleşiği. Eksik ölçümde basılmıyor: yarım beslemenin birleşik
          puanı listeyi temsil etmiyor. */}
      {durum === 'veri' && !eksik && !secili ? (
        <DuyarlilikOzeti duyarlilik={veri?.duyarlilik} />
      ) : null}

      {durum === 'veri' && veri && veri.adet === 0 && !eksik ? (
        <VeriYok
          kartsiz
          metin={'Listedeki sembollerin hiçbirinde manşet çıkmadı — bu da ÖLÇÜLMÜŞ bir cevap.'}
        />
      ) : null}

      {durum === 'veri' && gosterilen.length ? (
        <View style={styles.haberler}>
          {gosterilen.map((m, i) => (
            <HaberSatiri key={(m.link || '') + '#' + i} madde={m} />
          ))}
        </View>
      ) : null}

      {durum === 'veri' && secili && !gosterilen.length ? (
        <VeriYok
          kartsiz
          metin={secili + ' için gelen maddeler arasında sembolü işaretlenmiş başlık yok.'}
        />
      ) : null}

      {durum === 'veri' && veri ? (
        <Text style={[type.micro, { color: colors.textFaint, marginTop: space.sm }]}>
          {'Uç ' + veri.adet + ' manşet döndü · ' + satirlar.length + ' sembol sorgulandı · ' +
            veri.sayac.istek + ' besleme isteği · ' + veri.ms + ' ms'}
        </Text>
      ) : null}

      {kirpilan > 0 ? (
        <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
          {'Takip listesinde ' + liste.length + ' sembol var; uç bir istekte en çok ' +
            AZAMI_SEMBOL + ' sembol alıyor, bu yüzden ilk ' + sorulan.length +
            ' soruldu — ' + kirpilan + ' sembol bu ölçümün DIŞINDA kaldı.'}
        </Text>
      ) : null}

      <Text style={[type.micro, { color: colors.textDim, marginTop: space.sm }]}>
        {'Bu kart yalnız HABER manşeti gösteriyor. KAP duyuruları bu uçtan GELMİYOR — ' +
          'onlar 🗓️ Takvim kartında, ayrı bir ölçüm olarak duruyor.'}
      </Text>

      <Text style={[type.micro, { color: colors.textFaint, marginTop: space.md }]}>
        {DISCLAIMER_TEXT}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  satirlar: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.sm },
  notlar: { gap: space.xs, marginTop: space.sm },
  not: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  haberler: { paddingTop: space.xs },
});
