// =====================================================================
//  ListeBlogu — TEK adlandırılmış listenin bloğu       (ŞERİT F7 / native)
// ---------------------------------------------------------------------
//  NE: web'deki `renderListBlock` (app.js:7978) karşılığı: liste adı,
//  sembol sayısı, katlanır gövde, "evrene dahil" anahtarı, sembol
//  ekle/çıkar, yeniden adlandır, sil ve satır başına ÖLÇÜLMÜŞ fiyat.
//
//  NEDEN AYRI DOSYA: bir blok kendi açık/kapalı durumunu, kendi ekleme
//  formunu VE kendi ağ turunu taşıyor. Hepsini tek kartta tutmak, N
//  listenin durumunu tek bileşende dizi olarak tutmak demekti; o zaman
//  ikinci listeyi açmak birincinin isteğini de yeniden kurardı.
//
//  ── NEDEN FİYAT YALNIZ AÇILINCA ÇEKİLİYOR (web ile aynı kural) ─────
//  app.js `fillListRows` kapalı blokta istek ATMIYOR ("yalnız açık
//  listede fiyat çek"). Aynısı burada: `etkin: acik && sembol var`.
//  Kapalı altı liste = altı boşa giden motor turu olurdu.
//
//  ── NEDEN /api/recommend (SKOR UCU DEĞİL) ──────────────────────────
//  Listeler sekmesinin üst listesiyle AYNI gerekçe (bkz. (tabs)/index.tsx
//  başlığı): fiyatın güvenilir kaynağı `plan.seviye.price`; `fa.price`
//  ABD sembollerinde SEC kesintisinde `null` kalıyor.
//
//  ── SEMBOL EŞLEŞTİRME, ÖLÇÜLMÜŞ GERÇEK ────────────────────────────
//  Uç BIST sembolünü SONEK SİLEREK döndürüyor ('THYAO.IS' → 'THYAO';
//  (tabs)/index.tsx aynı gerçeği not ediyor). Bu yüzden yerel kaydın
//  sembolü ile cevabın `sym` alanı iki biçimde de karşılaştırılıyor.
//
//  BURADA HESAP YOK: fiyat uçtan gelen ham sayı, biçimleme
//  `lib/format.ts`. Yüzde değişim YOK — ham yüzde döndüren bir uç
//  ölçülmedi (web o sayıyı istemcide hesaplıyor, bu depoda yasak).
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: fiyat `null` ise "fiyat ölçülemedi"
//  yazılıyor; `0` ya da boş dizge ASLA basılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { fetchRecommend, useIstek, type RecommendRow } from '@/api';
import {
  listeEvreneAl,
  listeSil,
  listeYenidenAdlandir,
  listedenCikar,
  listeyeEkle,
  type ListeKaydi,
  type ListeOge,
} from '@/api/liste';
import { Card, Durum, Dugme, OlcumEksikRozet, Pill } from '@/components';
import { formatPrice } from '@/lib/format';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type ListeBloguProps = {
  /** Yerel depodaki liste kaydı (api/depo.ts). */
  kayit: ListeKaydi;
  /**
   * Varsayılan ("mobil") liste mi? Üst listenin kaynağı o olduğu için
   * silinmesi sekmenin üst bloğunu da boşaltır; ekran bunu söylüyor.
   */
  varsayilan?: boolean;
};

/** BIST sembolünün uçta göründüğü hâli (sonek silinmiş). */
function ucSembolu(sembol: string): string {
  return sembol.endsWith('.IS') ? sembol.slice(0, -3) : sembol;
}

/** Yerel kaydın ögesi ile motor satırını eşler. */
function satirBul(sonuclar: RecommendRow[], oge: ListeOge): RecommendRow | null {
  const hedef = ucSembolu(oge.symbol);
  return sonuclar.find((r) => r.sym === hedef) ?? null;
}

export function ListeBlogu({ kayit, varsayilan = false }: ListeBloguProps) {
  const { colors } = useTheme();
  const [acik, setAcik] = useState(false);
  const [ekleAcik, setEkleAcik] = useState(false);
  const [adAcik, setAdAcik] = useState(false);
  const [silSoruldu, setSilSoruldu] = useState(false);
  const [kod, setKod] = useState('');
  const [yeniAd, setYeniAd] = useState(kayit.name);
  // `null` = henüz bir yazma denenmedi. Boş dizge BASILMAZ.
  const [bildirim, setBildirim] = useState<string | null>(null);

  const anahtar = kayit.items.map((i) => i.symbol).join(',');
  const cagri = useCallback(
    (signal: AbortSignal) =>
      fetchRecommend(anahtar ? anahtar.split(',') : [], { vade: 'orta', signal }),
    [anahtar],
  );
  const { durum, veri, hata, yenile } = useIstek(cagri, anahtar, {
    etkin: acik && anahtar.length > 0,
  });
  const sonuclar: RecommendRow[] = veri?.sonuclar ?? [];

  const evreneDahil = kayit.inUniverse !== false;

  const yaz = (sozu: Promise<{ ok: boolean; mesaj?: string }>) => {
    void sozu.then((s) => setBildirim(s.ok ? null : (s.mesaj ?? 'Yazılamadı.')));
  };

  return (
    <Card
      title={kayit.name}
      subtitle={kayit.items.length + ' sembol'}
      right={
        <Dugme
          label={acik ? '▾ Kapat' : '▸ Aç'}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setAcik((v) => !v)}
        />
      }>
      {acik ? (
        <>
          {/* EVRENE DAHİL — web'in kutucuğu (app.js:7998). Yazıcı ölçüldü:
              `listeEvreneAl` (api/depo.ts:974). Renk tek ayırt edici
              değil: durum METİNLE de yazılıyor. */}
          <View style={styles.anahtarSatir}>
            <View style={styles.anahtarMetin}>
              <Text style={[type.smallBold, { color: colors.text }]}>Evrene dahil</Text>
              <Text style={[type.micro, { color: colors.textDim }]}>
                {evreneDahil
                  ? 'Açık — bu listenin sembolleri motora gidecek evrende.'
                  : 'Kapalı — bu listenin sembolleri evrene katılmıyor.'}
              </Text>
            </View>
            <Switch
              value={evreneDahil}
              onValueChange={(v) => yaz(listeEvreneAl(kayit.id, v))}
              accessibilityLabel={'Evrene dahil: ' + (evreneDahil ? 'açık' : 'kapalı')}
              trackColor={{ true: colors.goldSoft, false: colors.neutralSoft }}
              thumbColor={evreneDahil ? colors.gold : colors.textFaint}
            />
          </View>

          <View style={styles.eylemler}>
            <Dugme
              label={ekleAcik ? 'Ekleme formunu kapat' : '＋ Sembol ekle'}
              size="sm"
              variant="outline"
              tone="info"
              onPress={() => {
                setEkleAcik((v) => !v);
                setBildirim(null);
              }}
            />
            <Dugme
              label={adAcik ? 'Adlandırmayı kapat' : '✎ Yeniden adlandır'}
              size="sm"
              variant="outline"
              tone="neutral"
              onPress={() => {
                setAdAcik((v) => !v);
                setYeniAd(kayit.name);
                setBildirim(null);
              }}
            />
            <Dugme
              label={silSoruldu ? 'Silmeyi onayla' : '🗑 Listeyi sil'}
              size="sm"
              variant="outline"
              tone={silSoruldu ? 'negative' : 'neutral'}
              onPress={() => {
                if (!silSoruldu) {
                  setSilSoruldu(true);
                  return;
                }
                setSilSoruldu(false);
                yaz(listeSil(kayit.id));
              }}
            />
          </View>
          {silSoruldu ? (
            <Text style={[type.micro, { color: colors.gold }]}>
              {varsayilan
                ? '"' +
                  kayit.name +
                  '" silinirse sekmenin üst listesi de boşalır. Onaylamak için düğmeye yeniden bas.'
                : '"' + kayit.name + '" silinecek. Onaylamak için düğmeye yeniden bas.'}
            </Text>
          ) : null}

          {ekleAcik ? (
            <View style={styles.form}>
              <TextInput
                value={kod}
                onChangeText={(t) => {
                  setKod(t.toUpperCase());
                  setBildirim(null);
                }}
                placeholder="Kod (ör. THYAO.IS)"
                placeholderTextColor={colors.textFaint}
                autoCorrect={false}
                autoCapitalize="characters"
                maxLength={12}
                returnKeyType="done"
                onSubmitEditing={() => {
                  yaz(listeyeEkle(kayit.id, kod));
                  setKod('');
                }}
                accessibilityLabel={kayit.name + ' listesine eklenecek sembol'}
                style={[
                  styles.alan,
                  type.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.bgElevated,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Dugme
                label="Ekle"
                size="sm"
                disabled={!kod.trim()}
                onPress={() => {
                  yaz(listeyeEkle(kayit.id, kod));
                  setKod('');
                }}
              />
            </View>
          ) : null}

          {adAcik ? (
            <View style={styles.form}>
              <TextInput
                value={yeniAd}
                onChangeText={(t) => {
                  setYeniAd(t);
                  setBildirim(null);
                }}
                placeholder="Liste adı"
                placeholderTextColor={colors.textFaint}
                maxLength={40}
                returnKeyType="done"
                onSubmitEditing={() => yaz(listeYenidenAdlandir(kayit.id, yeniAd))}
                accessibilityLabel="Listenin yeni adı"
                style={[
                  styles.alan,
                  type.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.bgElevated,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Dugme
                label="Kaydet"
                size="sm"
                disabled={!yeniAd.trim()}
                onPress={() => {
                  yaz(listeYenidenAdlandir(kayit.id, yeniAd));
                  setAdAcik(false);
                }}
              />
            </View>
          ) : null}

          {bildirim ? (
            <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text>
          ) : null}

          {/* SATIRLAR — `items` yerel kayıttan ("ölçtüm"), fiyat uçtan.
              Boş liste ARIZA DEĞİL: web de aynı cümleyi yazıyor. */}
          {kayit.items.length === 0 ? (
            <Text style={[type.small, { color: colors.textDim }]}>
              Liste boş — ＋ Sembol ekle ile hisse ekle.
            </Text>
          ) : (
            <>
              <Durum
                durum={durum}
                hata={hata}
                yenile={yenile}
                iskelet={kayit.items.length}
                sekil="satir"
                kartsiz
              />
              {durum === 'veri' && veri ? <OlcumEksikRozet kaynak={veri} /> : null}
              {durum === 'veri' && veri && veri.atlanan.length ? (
                <Text style={[type.micro, { color: colors.gold }]}>
                  {'Zaman bütçesi doldu, ölçülmeyenler: ' + veri.atlanan.join(', ')}
                </Text>
              ) : null}
              {kayit.items.map((oge) => (
                <Satir
                  key={oge.symbol}
                  oge={oge}
                  satir={durum === 'veri' ? satirBul(sonuclar, oge) : null}
                  olculdu={durum === 'veri'}
                  onCikar={() => yaz(listedenCikar(kayit.id, oge.symbol))}
                />
              ))}
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}

/**
 * Tek satır: sembol + pazar rozeti + ÖLÇÜLMÜŞ fiyat + çıkar.
 *
 * `olculdu=false` ("henüz sormadım") ile `satir=null` ("sordum, bu
 * sembol cevapta yok") AYRI dallar — ikisi aynı cümleyi yazmıyor.
 */
function Satir({
  oge,
  satir,
  olculdu,
  onCikar,
}: {
  oge: ListeOge;
  satir: RecommendRow | null;
  olculdu: boolean;
  onCikar: () => void;
}) {
  const { colors } = useTheme();
  const bist = oge.market === 'BIST';
  const fiyat = satir ? (satir.plan?.seviye?.price ?? satir.fa.price) : null;

  return (
    <View style={[styles.satir, { borderColor: colors.border }]}>
      <Pressable
        style={styles.satirSol}
        accessibilityRole="button"
        accessibilityLabel={oge.symbol + ' hisse sayfasını aç'}
        onPress={() =>
          router.push({
            pathname: '/hisse/[sembol]',
            // `pazar`: uç BIST sembolünü sonek SİLEREK döndürüyor; detay
            // ekranı bu bilgiyle '.IS'i geri kazanıyor (bkz. o ekran).
            params: { sembol: satir?.sym ?? ucSembolu(oge.symbol), pazar: bist ? 'BIST' : 'US' },
          })
        }>
        <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
          {oge.symbol}
        </Text>
        <Pill label={bist ? 'BIST' : 'ABD'} tone="neutral" glyph={null} size="sm" />
      </Pressable>
      <View style={styles.satirSag}>
        {!olculdu ? (
          <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
            fiyat sorulmadı
          </Text>
        ) : fiyat == null ? (
          <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={1}>
            fiyat ölçülemedi
          </Text>
        ) : (
          <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
            {formatPrice(fiyat, bist ? 'TRY' : null)}
          </Text>
        )}
      </View>
      <Dugme label="Çıkar" size="sm" variant="outline" tone="neutral" onPress={onCikar} />
    </View>
  );
}

const styles = StyleSheet.create({
  anahtarSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  anahtarMetin: { flex: 1, gap: space.xxs },
  eylemler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  form: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  alan: {
    flex: 1,
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  satirSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  satirSag: { alignItems: 'flex-end' },
});
