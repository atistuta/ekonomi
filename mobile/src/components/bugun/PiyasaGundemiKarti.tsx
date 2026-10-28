// =====================================================================
//  📰 PİYASA GÜNDEMİ — Bugün kartı                    (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: `GET /api/news?gundem=1&market=TR|US` — SEMBOLE BAĞLI OLMAYAN
//  manşetler, birden çok yayıncı beslemesinden toplanıp tekilleştirilmiş.
//  Webde bu "Genel" sekmesiydi (app.js `loadGeneral`).
//
//  ── NEDEN BUGÜN SEKMESİNDE, KEŞFET'TE DEĞİL (ÖLÇÜLDÜ) ─────────────
//  Keşfet'in zaten bir "Gündem" kartı var ama o SEMBOL BAŞINA çalışıyor
//  (`fetchNews(sembol)`, kullanıcının takip listesinden seçilen sembol).
//  Bu uç ise sembolsüz: cevapta `symbol` alanı DAİMA `null`
//  (api/_haber.js:242 gündem dalı). Bugün sekmesi bugünün sembolden
//  bağımsız ölçümlerini topluyor — 📊 Endeks Nabzı, ⚡ Makro Nabız,
//  🔭 Tematik haber — ve bu kart tam o kümeye ait. Keşfet'e koymak,
//  "sembol seç" bekleyen bir ekrana sembol tanımayan bir kart koymak
//  olurdu. ALT MENÜ DEĞİŞMEDİ: yeni sekme AÇILMADI.
//
//  NEDEN "ÖNE ÇIKAN SEKTÖR" EKSİĞİNİ KAPATMIYOR: bu kart manşet basıyor,
//  sektör sıralaması yapmıyor. Ekranın o eksik ilanı OLDUĞU GİBİ duruyor.
//
//  ── WEBİN DÜRÜSTLÜK KUSURU BURADA TEKRARLANMADI ───────────────────
//  ÖLÇÜLDÜ (app.js:6534 `loadGeneral`): web `Promise.allSettled`
//  sonucunda REDDEDİLEN beslemeyi sessizce atıyor — kullanıcı "5
//  kaynaktan 3'ü okunabildi"i HİÇ görmüyor, eksik akışı tam akış
//  sanıyor. Uç bu bilgiyi gövdede veriyor (`besleme[] = {ad, durum,
//  adet}`) ve bu kart onu KAYNAK KAYNAK yazıyor: okunan da, okunamayan
//  da adıyla ekranda.
//
//  `durum: 'bos'` = "o kaynaktan madde OKUYAMADIM". "O kaynakta haber
//  yok" ile ayırt EDİLEMEZ (ikisi de 0 madde), bu yüzden iyimser yorum
//  yapılmıyor: ÖLÇEMEDİM yazılıyor.
//
//  `tam: false` ARIZA DEĞİL: beslemelerin bir kısmı okunamadı demek
//  (api/_haber.js:528). Hata kutusu değil, EKSİK ÖLÇÜM notu basılıyor;
//  gelen manşetler gerçek ve gösteriliyor.
//
//  ── BURADA HESAP YOK ──────────────────────────────────────────────
//  Manşetten yön/duygu çıkarmak ⚡ Nabız'ın işi ve o mantık MOTORDA.
//  Bu kart `adet`, `tekrar`, `besleme[].adet` sayılarını SUNUCUDAN
//  okuyup basıyor; hiçbirini kendisi saymıyor, eşik uygulamıyor.
//  Sıralama da uçta yapıldı (`gundemSirala`) — istemci yeniden sıralamaz.
//
//  TARİH BİÇİMİ: `formatHaberTarih` (lib/format.ts) — `HaberSatiri`
//  içinde. Hermes'te `Intl` kısıtlı olduğu için `toLocaleDateString` /
//  `Intl` BU DOSYADA HİÇ KULLANILMIYOR.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchGundem,
  haberOlcumEksik,
  useIstek,
  GUNDEM_YERELLER,
  VARSAYILAN_GUNDEM_YEREL,
  type GundemBesleme,
  type GundemMadde,
  type GundemYerel,
} from '@/api';
import {
  Card,
  Durum,
  HaberOlcumEksikRozet,
  OlcemedimKutu,
  Pill,
  VeriYok,
} from '@/components';
import { HaberSatiri } from '@/components/kesfet';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type PiyasaGundemiKartiProps = {
  /**
   * Kaç manşet istensin — ucun 1..25 aralığı. Verilmezse ucun kendi
   * varsayılanı (10) kullanılır; istemci kendi sayısını uydurmaz.
   */
  limit?: number;
};

/**
 * Yerel kodu → Türkçe etiket. ÇEVİRİ, karar değil: izinli küme uçtan
 * (`GUNDEM_YERELLER`). Kümede olup burada karşılığı olmayan bir kod
 * gelirse kodun KENDİSİ basılır — sessizce düşmez.
 */
const YEREL_METIN: Record<string, string> = {
  TR: 'Türkiye',
  US: 'ABD',
};

/** Besleme durum kodu → Türkçe. `'bos'` iyimser yoruma ÇEVİRİLMEZ. */
const DURUM_METIN: Record<string, string> = {
  ok: 'okundu',
  bos: 'okunamadı — ÖLÇEMEDİM',
};

export function PiyasaGundemiKarti({ limit }: PiyasaGundemiKartiProps) {
  const { colors } = useTheme();
  const [yerel, setYerel] = useState<GundemYerel>(VARSAYILAN_GUNDEM_YEREL);

  const cagri = useCallback(
    (signal: AbortSignal) => fetchGundem({ yerel, limit, signal }),
    [yerel, limit],
  );
  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    'gundem:' + yerel + '|' + String(limit ?? ''),
  );

  const maddeler: GundemMadde[] = veri?.maddeler ?? [];
  const besleme: GundemBesleme[] = veri?.besleme ?? [];
  const eksik = haberOlcumEksik(veri ?? null);
  const okunan = besleme.filter((b) => b.durum === 'ok').length;
  // `tekrar`: iki beslemede birden çıkıp TEKİLLEŞTİRİLEN madde sayısı —
  // sunucunun saydığı sayı, burada yeniden sayılmıyor.
  const tekrar = veri?.tekrar ?? null;

  return (
    <Card
      title="📰 Piyasa gündemi"
      subtitle="Yayıncı beslemelerinden toplanmış manşetler — sembole bağlı değil">
      <View style={styles.cipler}>
        {GUNDEM_YERELLER.map((y) => (
          <YerelCipi
            key={y}
            etiket={YEREL_METIN[y] ?? y}
            aktif={y === yerel}
            onPress={() => setYerel(y)}
          />
        ))}
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="metin"
      />

      {/* Rozet MANŞETLERİN ÜSTÜNDE: eksik taramayı başlıkları okuduktan
          SONRA öğrenmek, eksik ölçümü tam ölçüm gibi sunmak olurdu. */}
      {durum === 'veri' && veri ? <HaberOlcumEksikRozet kaynak={veri} /> : null}

      {durum === 'veri' && veri && eksik ? (
        <OlcemedimKutu
          metin={
            'Beslemelerin bir kısmı okunamadı: ' +
            String(besleme.length) +
            ' kaynaktan ' +
            String(okunan) +
            " tanesi okundu. Aşağıdaki manşetler gündemin TAMAMI DEĞİL — hangi kaynağın düştüğü 'Kaynak başına ölçüm' satırlarında yazılı."
          }
          yenile={yenile}
        />
      ) : null}

      {/* KAYNAK BAŞINA ÖLÇÜM — düşen besleme SESSİZCE ATILMIYOR. */}
      {durum === 'veri' && besleme.length ? (
        <View style={styles.bolum}>
          <Text style={[type.smallBold, { color: colors.text }]}>Kaynak başına ölçüm</Text>
          {besleme.map((b, i) => (
            <View key={b.ad + '#' + String(i)} style={styles.kaynakSatir}>
              <Pill
                label={b.durum === 'ok' ? 'okundu' : 'ölçemedim'}
                tone={b.durum === 'ok' ? 'neutral' : 'gold'}
                glyph={null}
                size="sm"
              />
              <Text style={[type.small, { color: colors.text }]} numberOfLines={2}>
                {b.ad}
              </Text>
              <View style={styles.bosluk} />
              <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
                {/* Sayı SUNUCUDAN: besleme başına okunan madde adedi
                    (tekilleştirme ÖNCESİ). Ölçülmemiş sayı yerine 0
                    basmamak için `adet` sayı değilse "—" yazılıyor. */}
                {typeof b.adet === 'number' && Number.isFinite(b.adet)
                  ? String(b.adet) + ' madde'
                  : '— madde'}
              </Text>
            </View>
          ))}
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {(DURUM_METIN.bos ?? '') +
              ': o kaynaktan madde gelmedi; "orada haber yok" ile ayırt edilemez, bu yüzden ölçüm sayılmıyor.'}
          </Text>
        </View>
      ) : null}

      {durum === 'veri' && veri && veri.adet === 0 && !eksik ? (
        <VeriYok
          metin={
            (YEREL_METIN[String(veri.market)] ?? String(veri.market)) +
            ' gündeminde uç manşet bulamadı — bu da ÖLÇÜLMÜŞ bir cevap.'
          }
        />
      ) : null}

      {durum === 'veri' && maddeler.length ? (
        <View style={styles.haberler}>
          {maddeler.map((m, i) => (
            <HaberSatiri key={(m.link || '') + '#' + String(i)} madde={m} />
          ))}
        </View>
      ) : null}

      {/* KIRPMA GİZLİ KALMAZ: uç `limit` kadarını döndürüyor, havuz daha
          büyük olabilir. Kaç madde okundu / kaçı tekrar diye düştü /
          kaçı basıldı — üçü birlikte yazılı. */}
      {durum === 'veri' && veri ? (
        <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
          {'Basılan manşet: ' +
            String(veri.adet) +
            ' (uç sınırı ' +
            String(veri.limit) +
            ')' +
            (tekrar != null
              ? ' · aynı haber iki kaynakta çıktığı için düşen: ' + String(tekrar)
              : '') +
            ' · okunan kaynak: ' +
            String(okunan) +
            '/' +
            String(besleme.length) +
            ' · ölçüm süresi: ' +
            String(veri.ms) +
            ' ms'}
        </Text>
      ) : null}
    </Card>
  );
}

/** Yerel çipi. Seçim RENKLE DEĞİL: başta "•" ve erişilebilirlik durumu. */
function YerelCipi({
  etiket,
  aktif,
  onPress,
}: {
  etiket: string;
  aktif: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      accessibilityLabel={'Gündem yereli: ' + etiket + (aktif ? ' — seçili' : '')}
      hitSlop={space.sm}
      style={({ pressed }) => [
        styles.cipKabi,
        pressed ? { backgroundColor: colors.bgPressed } : null,
      ]}>
      <Pill
        label={(aktif ? '• ' : '') + etiket}
        tone={aktif ? 'gold' : 'neutral'}
        variant={aktif ? 'soft' : 'outline'}
        glyph={null}
        size="sm"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cipKabi: {
    minHeight: hitSlopMin,
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  bolum: { gap: space.xxs, paddingTop: space.sm },
  kaynakSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  haberler: { paddingTop: space.sm },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
