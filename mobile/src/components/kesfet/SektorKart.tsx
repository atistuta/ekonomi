// =====================================================================
//  🏭 SEKTÖR DAĞILIMI — Keşfet kartı                  (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: takip listesinin künyeleri (`/api/yfin`) → `POST /api/sektor`.
//  Uç kayıtları sektör gruplarına bölüp her grup için MEDYAN F/K · ileri
//  F/K · büyüme · marj · PEG döndürüyor. Webde bu "Sektör" sekmesiydi.
//
//  ── NEDEN KEŞFET SEKMESİNDE (ÖLÇÜLDÜ) ─────────────────────────────
//  Bu kart 🔎 Tarama kartının BİREBİR aynı hattını kullanıyor:
//  `fetchYfin(liste)` → POST ölçüm listesi, aynı 12 sembol sınırı, aynı
//  `olcumKapisi`. Keşfet zaten "listeyi künyeye çevirip motora sor"
//  kartlarının yeri (🌍 Radar · 🔥 Fırsatlar · 🔎 Tarama). Bugün sekmesi
//  ise bugünün tek seferlik ölçümlerini topluyor — oraya koymak aynı
//  künye turunu iki sekmede iki kez çalıştırmak olurdu.
//  ALT MENÜ DEĞİŞMEDİ: yeni sekme AÇILMADI.
//
//  NEDEN BUGÜN'ÜN "ÖNE ÇIKAN SEKTÖR" EKSİĞİNİ KAPATMIYOR: bu uç
//  PİYASAYI taramıyor, yalnız KULLANICININ listesini (en çok 12 sembol)
//  gruplara bölüyor. "Öne çıkan sektör" piyasa geneli bir sıralama
//  isterdi; onu bununla doldurmak kapsamı sessizce küçültmek olurdu.
//  O yüzden Bugün ekranındaki dürüst eksik ilanı OLDUĞU GİBİ duruyor.
//
//  ── ⚠️ MEDYANLAR HAM KESİR ────────────────────────────────────────
//  `medGrowth` / `medMargin` uçtan KESİR geliyor (0.18 = %18) ve uç ×100
//  YAPMIYOR (api/types.ts `SektorGrup` başlığı). Yüzdeye çevirme
//  BURADA, TEK KEZ yapılıyor (`yuzde()`), çünkü `formatPercent` YÜZDE
//  PUANI bekliyor (lib/format.ts:64) — ikinci bir ölçekleme iki kat
//  yanlış basardı. `medPe`/`medFpe`/`medPeg` çarpansız oran: hiç
//  ölçeklenmiyor, `formatOran` ile basılıyor.
//
//  ── SIRALAMA MOTORUN ──────────────────────────────────────────────
//  `sira` yalnız KİPİN ADI; dizilimi uç yapıyor (`sekSortGroups`).
//  İstemci `gruplar` dizisini geldiği SIRADA basıyor — yeniden
//  sıralamıyor, eşik uygulamıyor, grup skorlamıyor.
//
//  ── ÖLÇÜLMEYEN SAYI BASILMAZ ──────────────────────────────────────
//  Medyan ölçülemediyse uç `null` döndürüyor (0 DEĞİL) ve ekranda "—"
//  yazıyor. `siniflanan < degerlendirilen` ise fark EKSİK ÖLÇÜM olarak
//  yazılıyor; 12 sembol sınırının dışında kalan sembol sayısı da ekranda.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  fetchSektor,
  fetchYfin,
  useIstek,
  SIRA_KIPLERI,
  VARSAYILAN_SIRA,
  YFIN_AZAMI_SEMBOL,
  type ApiResult,
  type OlcumKayit,
  type SektorGrup,
  type SektorHisse,
  type SektorResponse,
  type SiraKip,
  type YfinKunye,
} from '@/api';
import { Card, Durum, Pill, SectorChip, VeriYok } from '@/components';
import { formatOran, formatPercent } from '@/lib/format';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

export type SektorKartProps = {
  /** Gruplanacak semboller — kullanıcının takip listesi. */
  liste: readonly string[];
  onSembol?: (sym: string) => void;
};

/**
 * Sıralama kipi → Türkçe etiket. ÇEVİRİ, HESAP DEĞİL: hangi grubun
 * önce geldiğine uç karar veriyor (`sekSortGroups`).
 */
const SIRA_METIN: Record<SiraKip, string> = {
  cheap: 'medyan F/K düşükten',
  growth: 'medyan büyüme yüksekten',
  margin: 'medyan marj yüksekten',
  count: 'hisse sayısı çoktan',
};

/**
 * Sınıflandırma kademesi (`basis`) → Türkçe. Motorun `sekClassify`
 * kademesini anlatıyor; `null` = hiçbir kademe tutmadı.
 */
const BASIS_METIN: Record<string, string> = {
  sector: 'Yahoo sektörü',
  industry: 'Yahoo alt sektörü',
  fund: 'fon/ETF etiketi',
  tag: 'motor etiketi',
  biz: 'faaliyet tanımı',
};

/** Ölçülmemiş sayı `null` — 0 DEĞİL. */
function sayi(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function metin(v: string | null | undefined): string | null {
  return typeof v === 'string' && v ? v : null;
}

/**
 * Künye → ölçüm kaydı. `market` BİLEREK VERİLMİYOR: sunucu `.IS` ekiyle
 * biten sembolü kendisi BIST'e çözüyor (`api/_girdi.js temizleSembol`).
 * 🔎 Tarama kartındaki eşlemenin AYNISI — uç da aynı ölçüm listesini
 * bekliyor (`olcumKapisi` ikisinde de aynı).
 */
function olcumYap(k: YfinKunye): OlcumKayit {
  return {
    symbol: k.symbol,
    ok: k.ok,
    trailingPE: sayi(k.trailingPE),
    forwardPE: sayi(k.forwardPE),
    peg: sayi(k.peg),
    priceToBook: sayi(k.priceToBook),
    priceToSales: sayi(k.priceToSales),
    evEbitda: sayi(k.evEbitda),
    marketCap: sayi(k.marketCap),
    profitMargin: sayi(k.profitMargin),
    returnOnEquity: sayi(k.returnOnEquity),
    revenueGrowth: sayi(k.revenueGrowth),
    earningsGrowth: sayi(k.earningsGrowth),
    debtToEquity: sayi(k.debtToEquity),
    dividendYield: sayi(k.dividendYield),
    price: sayi(k.price),
    sector: metin(k.sector),
    industry: metin(k.industry),
    name: metin(k.name),
  };
}

/**
 * HAM KESİR → yüzde metni. ×100 TAM BİR KEZ burada: uç kesir
 * döndürüyor, `formatPercent` yüzde puanı bekliyor. Ölçülmediyse "—".
 */
function yuzde(v: number | null | undefined): string {
  const n = sayi(v);
  return n == null ? '—' : formatPercent(n * 100);
}

/** Çarpansız oran (F/K, ileri F/K, PEG). Ölçeklenmez. */
function oran(v: number | null | undefined): string {
  const n = sayi(v);
  return n == null ? '—' : formatOran(n);
}

export function SektorKart({ liste, onSembol }: SektorKartProps) {
  const { colors } = useTheme();
  const [sira, setSira] = useState<SiraKip>(VARSAYILAN_SIRA);

  // Kırpma AÇIK: `fetchYfin` 12'den fazlasını reddediyor; kaç sembolün
  // dışarıda kaldığı aşağıda ekrana yazılıyor.
  const evren = useMemo(() => liste.slice(0, YFIN_AZAMI_SEMBOL), [liste]);
  const disarida = liste.length - evren.length;

  const cagri = useCallback(
    async (signal: AbortSignal): Promise<ApiResult<SektorResponse>> => {
      const kunye = await fetchYfin([...evren], { deep: false, signal });
      if (!kunye.ok) return { ok: false, error: kunye.error };
      const olcumler = kunye.data.results.map(olcumYap);
      return fetchSektor(olcumler, { sira, signal });
    },
    [evren, sira],
  );

  const { durum, veri, hata, yenile } = useIstek(cagri, sira + '|' + evren.join(','), {
    etkin: evren.length > 0,
  });

  // Uçtan geldiği SIRADA — istemci yeniden sıralamıyor.
  const gruplar: SektorGrup[] = veri?.gruplar ?? [];
  const degerlendirilen = veri?.degerlendirilen ?? null;
  const siniflanan = veri?.siniflanan ?? null;
  const siniflanmayan =
    degerlendirilen != null && siniflanan != null ? degerlendirilen - siniflanan : null;

  return (
    <Card
      title="🏭 Sektör dağılımı"
      subtitle="Takip listen sektör gruplarına bölünür — medyanları ve dizilimi motor hesaplar"
      right={
        durum === 'veri' && veri ? (
          <Pill label={String(veri.sira)} tone="info" glyph={null} size="sm" />
        ) : null
      }>
      <View style={styles.cipler}>
        {SIRA_KIPLERI.map((k) => (
          <SiraCipi
            key={k}
            etiket={SIRA_METIN[k] ?? k}
            aktif={k === sira}
            onPress={() => setSira(k)}
          />
        ))}
      </View>

      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        kartsiz
        iskelet={3}
        sekil="sira"
        bosMetin="Takip listesi boş. Arama sekmesinden sembol ekle."
      />

      {durum === 'veri' && veri && gruplar.length === 0 ? (
        <VeriYok metin="Uç bu listeden hiçbir grup kuramadı — bu da ÖLÇÜLMÜŞ bir cevap." />
      ) : null}

      {durum === 'veri' && gruplar.length ? (
        <View style={styles.bolum}>
          {gruplar.map((g) => (
            <GrupSatiri key={g.anahtar} grup={g} onSembol={onSembol} />
          ))}
        </View>
      ) : null}

      {/* ÖLÇÜM NOTU — eksik sınıflama ve kırpma GİZLİ KALMAZ. */}
      {durum === 'veri' && veri ? (
        <View style={styles.bolum}>
          <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
            {'Değerlendirilen kayıt: ' +
              (degerlendirilen != null ? String(degerlendirilen) : '—') +
              ' · gruba giren: ' +
              (siniflanan != null ? String(siniflanan) : '—') +
              ' · grup: ' +
              String(gruplar.length) +
              ' · ölçüm süresi: ' +
              String(veri.ms) +
              ' ms'}
          </Text>
          {siniflanmayan != null && siniflanmayan > 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {String(siniflanmayan) +
                ' kayıt hiçbir gruba GİRMEDİ (künyesi gelmeyen kayıt gruplanmıyor) — bu eksik ölçüm, sıfır değil.'}
            </Text>
          ) : null}
          {disarida > 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              {String(disarida) +
                ' sembol bu turda GRUPLANMADI: künye ucu bir turda en çok ' +
                String(YFIN_AZAMI_SEMBOL) +
                ' sembol alıyor.'}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Tek sektör grubu: başlık + medyanlar + içindeki hisseler. */
function GrupSatiri({
  grup,
  onSembol,
}: {
  grup: SektorGrup;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  // `_other` MOTOR SENTİNELİ, sektör adı değil: olduğu gibi basmak
  // kullanıcıya anlamsız gelir, bu yüzden ne olduğu YAZILIYOR.
  const ad = grup.anahtar === '_other' ? 'Sınıflanamayan' : grup.anahtar;

  return (
    <View style={[styles.grup, { borderBottomColor: colors.border }]}>
      <View style={styles.ust}>
        <SectorChip sector={ad} size="sm" />
        <View style={styles.bosluk} />
        <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
          {String(grup.n) + ' hisse'}
        </Text>
      </View>

      {/* MEDYANLAR — ölçülmeyen "—". Büyüme ve marj KESİRDEN yüzdeye
          TEK KEZ çevrildi; F/K · ileri F/K · PEG çarpansız oran. */}
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'medyan F/K ' +
          oran(grup.medPe) +
          ' · ileri F/K ' +
          oran(grup.medFpe) +
          ' · PEG ' +
          oran(grup.medPeg)}
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'medyan büyüme ' + yuzde(grup.medGrowth) + ' · medyan marj ' + yuzde(grup.medMargin)}
      </Text>

      {grup.hisseler.map((h) => (
        <HisseSatiri key={h.sym} hisse={h} onSembol={onSembol} />
      ))}
    </View>
  );
}

/** Grup içindeki tek hisse. Ham sayılar; hiçbiri skor değil. */
function HisseSatiri({
  hisse,
  onSembol,
}: {
  hisse: SektorHisse;
  onSembol?: (sym: string) => void;
}) {
  const { colors } = useTheme();
  const basis = hisse.basis
    ? (BASIS_METIN[hisse.basis] ?? hisse.basis)
    : 'kademe tutmadı — ÖLÇEMEDİM';

  const govde = (
    <View style={styles.satir}>
      <Text style={[type.smallBold, { color: colors.text }]}>
        {hisse.sym + '  '}
        <Text style={[type.micro, { color: colors.textFaint }]}>{hisse.market}</Text>
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'F/K ' +
          oran(hisse.trailingPE) +
          ' · ileri F/K ' +
          oran(hisse.forwardPE) +
          ' · PEG ' +
          oran(hisse.peg)}
      </Text>
      <Text style={[type.micro, styles.num, { color: colors.textDim }]}>
        {'büyüme ' +
          yuzde(hisse.revenueGrowth) +
          ' · marj ' +
          yuzde(hisse.profitMargin) +
          ' · sınıflama: ' +
          basis}
      </Text>
    </View>
  );

  if (!onSembol) return govde;

  return (
    <Pressable
      onPress={() => onSembol(hisse.sym)}
      accessibilityRole="button"
      accessibilityLabel={hisse.sym + ' — hisse sayfasına git'}
      style={({ pressed }) => (pressed ? { backgroundColor: colors.bgPressed } : null)}>
      {govde}
    </Pressable>
  );
}

/** Sıralama çipi. Seçim RENKLE DEĞİL: başta "•" ve erişilebilirlik durumu. */
function SiraCipi({
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
      accessibilityLabel={'Sıralama: ' + etiket + (aktif ? ' — seçili' : '')}
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
  grup: {
    gap: space.xxs,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  satir: { gap: space.xxs, paddingVertical: space.xs, paddingLeft: space.sm },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
