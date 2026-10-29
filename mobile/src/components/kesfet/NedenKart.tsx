// =====================================================================
//  📉 NEDEN — endeks hareketi ⇄ gündem hizası        (ŞERİT F6 / native)
// ---------------------------------------------------------------------
//  NE: `/api/causal` ucunun döndürdüğü BAĞLAR. Her bağ bir endeks
//  hareketi (`kind` + `pct`) ve o harekete en iyi HİZALANAN en çok iki
//  gündem konsepti (`links`: konsept anahtarı + motorun HAM hizalama
//  çarpımı + eşleşen sektör kodları).
//
//  ── BU KART "X YÜZÜNDEN Y OLDU/OLACAK" DEMEZ ───────────────────────
//  Ucun kendi sözü (api/causal.js:9-11): bu bir KORELASYON okumasıdır —
//  eş zamanlı hareket + ilgili taze manşet. Kanıtlanmış nedensellik
//  DEĞİL ve TA/FA/bileşke skoruna DAHİL DEĞİL. Bu yüzden ekranda
//  "neden", "yüzünden", "etkiledi", "yükseltir" gibi SEBEP-SONUÇ
//  cümlesi yok; ölçülen şey "hizalanma" ve öyle yazıyor. Gelecek kipi de
//  yok: ölçüm GEÇMİŞ bir harekete ait.
//
//  ── BURADA EŞİK/AĞIRLIK/SIRA YOK ───────────────────────────────────
//  Gürültü eşiği (1,6), "belirgin hareket" kararı ve en iyi iki bağın
//  seçimi MOTORDA (api/_motor.js:1752-1763). `skor` HAM çarpım: ölçeksiz,
//  yuvarlanmamış. Kart bu sayıyla KARŞILAŞTIRMA YAPMIYOR — ne eşiğe
//  vuruyor, ne "güçlü/zayıf" diye bantlıyor. Böyle bir bant ekranla
//  sunucuyu sessizce ayrıştırırdı (TaramaKart'ın silinen `ESIK = 70`
//  dersi). Sıra uçtan geldiği gibi basılıyor.
//
//  ── GİRDİYİ BU KART ÜRETMEZ — ÇAĞIRAN VERİR (ÖLÇÜLDÜ 2026-10-29) ───
//  Uç AĞA HİÇ ÇIKMIYOR: hem endeks hareketlerini hem gündem
//  konseptlerini İSTEMCİDEN bekliyor (api/causal.js:28-43, client.ts
//  `fetchCausal` başlığı). Web tarafında bunu `app.js computeAgenda()`
//  yapıyor; NATIVE tarafta o tarayıcı YOK. Ölçüm: `mobile/src/api`
//  içinde gündem konsepti ya da endeks hareketi döndüren TEK bir çağrı
//  yok (`/api/pulse` makro duruş döndürüyor, konsept/sektör/ısı
//  döndürmüyor — api/types.ts `PulseResponse`).
//
//  Bu yüzden `hareketler`/`gundem` bu kartın PROP'u. Verilmedikçe kart
//  UCA GİTMEZ ve "ölçemedim" der. Alternatifi girdi UYDURMAKTI: `pct`
//  için fiyattan yüzde hesaplamak (istemcide formül) ve `notable` için
//  bir eşik yazmak (istemcide eşik) — ikisi de ham sayı kuralının tam
//  ihlali, üstelik ucu ölçülmemiş girdiyle besleyip ekrana "ölçülmüş"
//  görünen bir bağ bastırmak olurdu.
//
//  `undefined` ile `[]` AYRI DAL: prop verilmemişse "sormadım" (girdi
//  kaynağı yok), boş dizi verilmişse "ölçtüm, hareket/konsept yok".
//  `baglar: []` ise ÜÇÜNCÜ bir dal: uç ölçtü, eşleşme çıkmadı — ARIZA
//  DEĞİL, dürüst sessizlik (api/causal.js:80-81).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  fetchCausal,
  useIstek,
  type NedenBag,
  type NedenBaglanti,
  type NedenHareketGirdi,
  type NedenKonseptGirdi,
} from '@/api';
import { Card, Durum, OlcemedimKutu, Pill, VeriYok } from '@/components';
import { formatOran, formatPercent } from '@/lib/format';
import { numeric, space, type, useTheme } from '@/theme';

export type NedenKartProps = {
  /**
   * Endeks hareketleri — ÖLÇÜLMÜŞ girdi, çağırandan. `undefined` =
   * "sormadım" (ölçen kaynak yok); `[]` = "ölçtüm, belirgin hareket yok".
   */
  hareketler?: readonly NedenHareketGirdi[];
  /**
   * Gündem konseptleri — ÖLÇÜLMÜŞ girdi, çağırandan. `undefined` =
   * "sormadım"; `[]` = "ölçtüm, konsept yok".
   */
  gundem?: readonly NedenKonseptGirdi[];
};

/**
 * Endeks türünün TÜRKÇESİ. Motorun `CAUSAL_INDEX_AFFINITY` anahtarının
 * karşılığı (api/types.ts `NEDEN_KINDLER`) — yeni bir endeks değil.
 * Küme dışı kod OLDUĞU GİBİ basılır: uç tabloyu büyütürse ekran çökmez,
 * uydurma ad da koymaz (bkz. `NedenBag.kind` tipi).
 */
const KIND_AD: Record<string, string> = {
  equity_tech: 'teknoloji hisseleri',
  equity_us: 'ABD hisseleri',
  equity_tr: 'BIST hisseleri',
  gold: 'altın',
};

export function NedenKart({ hareketler, gundem }: NedenKartProps) {
  const { colors } = useTheme();

  // Girdi KAYNAĞI yok mu, girdi BOŞ mu — iki ayrı cümle.
  const sorulmadi = hareketler === undefined || gundem === undefined;
  const bosGirdi = !sorulmadi && (!hareketler.length || !gundem.length);

  const cagri = useCallback(
    (signal: AbortSignal) =>
      fetchCausal(
        {
          // Kopya diziler: uç sözleşmesi değiştirilebilir dizi istiyor,
          // prop ise salt okunur. İçerik AYNEN geçiyor — süzme, kırpma,
          // yuvarlama YOK (kapılar `fetchCausal` içinde).
          hareketler: [...(hareketler ?? [])],
          gundem: [...(gundem ?? [])],
        },
        { signal },
      ),
    [hareketler, gundem],
  );

  const { durum, veri, hata, yenile } = useIstek(
    cagri,
    'neden:' + (hareketler?.length ?? -1) + ':' + (gundem?.length ?? -1),
    { etkin: !sorulmadi && !bosGirdi },
  );

  const baglar: NedenBag[] = veri?.baglar ?? [];

  return (
    <Card
      title="📉 Neden"
      subtitle="Endeks hareketi ⇄ gündem hizası — korelasyon okuması, nedensellik iddiası değil">
      {sorulmadi ? (
        // "Yeniden dene" düğmesi BİLEREK YOK: tekrar denemek girdi
        // kaynağı yaratmaz (bkz. OlcemedimKutu sözleşmesi).
        <OlcemedimKutu
          metin={
            'Bu ölçüm iki ÖLÇÜLMÜŞ girdi istiyor: endeks hareketleri ve gündem konseptleri. ' +
            'Bu istemcide ikisini ölçen bir uç yok, bu yüzden hizalanma ÖLÇEMEDİM. ' +
            'Girdiyi uyduran bir kart, ölçülmemiş sayıyı ölçülmüş gibi gösterirdi.'
          }
        />
      ) : bosGirdi ? (
        <VeriYok
          kartsiz
          metin={
            'Girdi ölçüldü ama bu turda eşleştirilecek bir şey yok: ' +
            (hareketler?.length ?? 0) +
            ' endeks hareketi · ' +
            (gundem?.length ?? 0) +
            ' gündem konsepti.'
          }
        />
      ) : (
        <>
          <Durum
            durum={durum}
            hata={hata}
            yenile={yenile}
            kartsiz
            iskelet={2}
            sekil="sira"
            bosMetin="Hizalanma henüz sorulmadı."
          />

          {durum === 'veri' ? (
            <>
              {!baglar.length ? (
                // ÜÇÜNCÜ DAL: uç ölçtü, eşleşme çıkmadı. ARIZA DEĞİL.
                <VeriYok
                  kartsiz
                  metin={
                    'Uç hareketleri gündemle karşılaştırdı ve gürültü eşiğini geçen bir hizalanma ' +
                    'bulamadı. Bu bir arıza değil: ölçüldü, eşleşme yok.'
                  }
                />
              ) : (
                baglar.map((b, i) => <BagSatiri key={b.kind + ':' + i} bag={b} />)
              )}

              <Text style={[type.micro, styles.num, { color: colors.textFaint }]}>
                {(veri?.degerlendirilen ?? 0) +
                  ' hareket değerlendirildi · ' +
                  (veri?.eslesen ?? 0) +
                  ' tanesi bir konseptle hizalandı · motor ' +
                  (veri?.surum?.motor ?? '?')}
              </Text>
              <Text style={[type.micro, { color: colors.textFaint }]}>
                Hizalanma skoru motorun HAM çarpımıdır; ölçeksizdir ve TA/FA/bileşke skoruna
                girmez. Sebep-sonuç değil, eş zamanlılık okunur.
              </Text>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}

/**
 * Tek hareket ve ona hizalanan konseptler. `pct` İSTEMCİNİN gönderdiği
 * sonlu sayının aynısı (uç yuvarlamıyor); burada yalnız biçimleniyor.
 * `links` ASLA boş gelmez (boş olanlar ucta düşüyor —
 * api/_motor.js:1763), ama tür gelmeyen bir şeyi varsaymadığı için dal
 * yine yazılı.
 */
function BagSatiri({ bag }: { bag: NedenBag }) {
  const { colors } = useTheme();
  const links = bag.links ?? [];
  // Yön RENKLE DEĞİL işaretle: ▲/▼ karakteri taşıyor, `formatPercent`
  // de işareti (+/−) metne basıyor. Burada eşik yok, yalnız sayının
  // işareti okunuyor.
  const isaret = bag.pct > 0 ? '▲' : bag.pct < 0 ? '▼' : null;

  return (
    <View style={styles.satir}>
      <View style={styles.ust}>
        <Text style={[type.smallBold, { color: colors.text }]} numberOfLines={2}>
          {KIND_AD[bag.kind] ?? bag.kind}
        </Text>
        <View style={styles.bosluk} />
        <Pill label={formatPercent(bag.pct)} tone="neutral" glyph={isaret} size="sm" />
      </View>

      {links.length ? (
        links.map((l, i) => <LinkSatiri key={l.key + ':' + i} link={l} />)
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Uç bu hareket için hizalanan konsept döndürmedi.
        </Text>
      )}
    </View>
  );
}

/**
 * Tek hizalanma. `key` İSTEMCİNİN gönderdiği konsept anahtarı: uç
 * konseptin başlığını/emojisini tele GERİ KOYMUYOR (api/causal.js:52-55),
 * başlık çağıranın elinde. Anahtar MAKİNE KODU ve öyle basılıyor —
 * ondan Türkçe bir başlık türetmek uydurma olurdu.
 */
function LinkSatiri({ link }: { link: NedenBaglanti }) {
  const { colors } = useTheme();
  const sektorler = link.sektorler ?? [];

  return (
    <View style={styles.link}>
      <View style={styles.ust}>
        <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={2}>
          {'gündem konsepti: ' + link.key}
        </Text>
        <View style={styles.bosluk} />
        <Text style={[type.microBold, styles.num, { color: colors.textDim }]}>
          {'hiza ' + formatOran(link.skor)}
        </Text>
      </View>

      {sektorler.length ? (
        <View style={styles.cipler}>
          {sektorler.map((s, i) => (
            <Pill
              key={s + ':' + i}
              label={s}
              tone="info"
              variant="outline"
              glyph={null}
              size="sm"
            />
          ))}
        </View>
      ) : (
        // BOŞ DİZİ "VERİ YOK" DEĞİL (api/types.ts `NedenBaglanti`):
        // risk/ton hizasıyla eşleşmiş ama sektör örtüşmesi yok.
        <Text style={[type.micro, { color: colors.textFaint }]}>
          Sektör örtüşmesi yok — hizalanma risk/ton üzerinden.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  satir: { gap: space.xs, paddingVertical: space.sm },
  link: { gap: space.xxs, paddingLeft: space.md },
  ust: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bosluk: { flex: 1 },
  cipler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  num: {
    // Tanım TEK YERDE: theme/typography.ts → `numeric`.
    ...numeric,
  },
});
