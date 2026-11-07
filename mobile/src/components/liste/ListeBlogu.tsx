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
//  ── NEDEN YÜZDE DEĞİŞİM UÇTAN GELİYOR ─────────────────────────────
//  Web satırın %'sini İSTEMCİDE hesaplıyor (`changeFor`, app.js:8330);
//  bu depoda istemci matematiği YASAK. Ham yüzde döndüren uç ÖLÇÜLDÜ:
//  `/api/degisim` (`api/_degisim.js` — kendi başlığında "liste satırı
//  (dönem seçimli)" diye TAM BU yüzeyi adıyla anıyor). `…Pct` alanları
//  YÜZDE PUANI (×100 uçta yapılıyor), bu yüzden `formatPercent` doğru
//  biçimleyici; burada çarpma/bölme/eşik YOK.
//
//  ── NEDEN TEK DÖNEM SORULUYOR ─────────────────────────────────────
//  Uca `?donemler=` verilmezse ALTI dönemi ölçüyor = sembol başına
//  altı üst-kaynak adresi. Satırda bir kerede BİR dönem görünüyor;
//  altısını istemek beş ölçümü çöpe atmak olurdu. Dönem seçimi web'de
//  de liste başına ayrı ve YALNIZ BELLEKTE (`listActivePeriods`,
//  app.js:8115; varsayılan `gunluk`) — native de kalıcılaştırmıyor.
//
//  ── NEDEN İKİNCİ BİR İSTEK (tek uca birleştirilmedi) ──────────────
//  Fiyat `/api/recommend`ten geliyor (yukarıdaki gerekçe), yüzde ise
//  `/api/degisim`den. Dönem düğmesi fiyat turunu YENİDEN KURMUYOR:
//  iki istek ayrı anahtarlarda, dönem değişince yalnız yüzde turu
//  yenileniyor. Tek isteğe sıkıştırmak her dönem tıklamasında motoru
//  baştan çalıştırmak olurdu.
//
//  BURADA HESAP YOK: fiyat ve yüzde uçtan gelen ham sayı, biçimleme
//  `lib/format.ts`.
//
//  ÖLÇÜLMEYEN SAYI BASILMAZ: fiyat `null` ise "fiyat ölçülemedi"
//  yazılıyor; `0` ya da boş dizge ASLA basılmıyor.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import {
  DEGISIM_DONEM_ALANLARI,
  DEGISIM_DONEMLER,
  fetchDegisim,
  fetchRecommend,
  useIstek,
  type DegisimDonem,
  type DegisimSatir,
  type RecommendRow,
} from '@/api';
import {
  listeBildirimAyarla,
  listeEvreneAl,
  listeSil,
  listeYenidenAdlandir,
  listedenCikar,
  listeyeEkle,
  type ListeKaydi,
  type ListeOge,
} from '@/api/liste';
import { Card, Durum, Dugme, OlcumEksikRozet, Pill } from '@/components';
import { formatPercent, formatPrice } from '@/lib/format';
import { hisseAc } from '@/lib/gezinme';
import { hitSlopMin, numeric, radius, space, type, useTheme } from '@/theme';

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

/**
 * Dönemin ekranda görünen adı. Ad SÖZLÜK — eşik/ağırlık değil.
 * Web'in düğme etiketleriyle birebir (`CHANGE_PERIODS`, app.js:2005).
 */
const DONEM_ADI: Readonly<Record<DegisimDonem, string>> = {
  saatlik: 'Saatlik',
  gunluk: 'Günlük',
  haftalik: 'Haftalık',
  aylik: 'Aylık',
  alti: '6 Aylık',
  yillik: '1 Yıllık',
};

/** `DegisimSatir` alanından SAYI çıkarır; sayı değilse `null`. */
function sayi(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

/** Yerel kaydın ögesinin uca gönderilen hâli: `KOD:PAZAR`. */
function degisimSembolu(oge: ListeOge): string {
  return ucSembolu(oge.symbol) + ':' + (oge.market === 'BIST' ? 'BIST' : 'US');
}

/**
 * Yerel kaydın ögesi ile değişim satırını eşler. SEMBOL TEK BAŞINA
 * YETMİYOR: uç kodu sonek silerek döndürüyor ve aynı kod iki pazarda
 * olabilir — bu yüzden `market` de karşılaştırılıyor.
 */
function degisimBul(satirlar: DegisimSatir[], oge: ListeOge): DegisimSatir | null {
  const hedef = ucSembolu(oge.symbol);
  const pazar = oge.market === 'BIST' ? 'BIST' : 'US';
  return satirlar.find((s) => s.symbol === hedef && s.market === pazar) ?? null;
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

  // DÖNEM YALNIZ BELLEKTE: web de liste başına ayrı tutuyor ve
  // kalıcılaştırmıyor (`listActivePeriods`, app.js:8115). Varsayılan
  // web ile aynı: `gunluk`.
  const [donem, setDonem] = useState<DegisimDonem>('gunluk');

  // Uca gönderilen sembol listesi ANAHTAR olarak dizgede tutuluyor:
  // `kayit.items` her render'da yeni dizi; bağımlılığa koysaydık istek
  // her karede yeniden atılırdı.
  const degisimListe = kayit.items.map(degisimSembolu).join(',');
  const degisimCagri = useCallback(
    (signal: AbortSignal) =>
      // TEK dönem: altısını istemek sembol başına altı üst-kaynak
      // adresi eder, satırda bir tanesi görünür.
      fetchDegisim(degisimListe ? degisimListe.split(',') : [], {
        donemler: [donem],
        signal,
      }),
    [degisimListe, donem],
  );
  const {
    durum: dDurum,
    veri: dVeri,
    hata: dHata,
    yenile: dYenile,
  } = useIstek(degisimCagri, degisimListe + '|' + donem, {
    etkin: acik && degisimListe.length > 0,
  });
  const degisimSatirlari: DegisimSatir[] = dVeri?.satirlar ?? [];

  const evreneDahil = kayit.inUniverse !== false;
  // GERİYE DÖNÜK VARSAYILAN: alan yoksa bildirim AÇIK (web app.js:8286
  // `l.notify !== false`). Eski listelerin bildirimi sessizce kesilmiyor.
  const bildirimAcik = kayit.notify !== false;

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

          {/* BİLDİRİM — web'in 🔔 düğmesi (app.js:8305). AYRI BAYRAK:
              `inUniverse` ANALİZ evrenini kuruyor (`evrenSemboller`),
              `notify` ise PUSH evrenini (web `collectWatchlistPayload`
              app.js:2238 `if (l.notify === false) return`). Bir listeyi
              ölçtürüp telefonun titremesini İSTEMEMEK mümkün; tek bayrakla
              bu iki istek ayrılamıyordu. Yazıcı: `listeBildirimAyarla`.

              BU ANAHTAR AĞA ÇIKMIYOR: bayrak CİHAZDA duruyor; push evrenine
              dönüşü `/api/watchlist` turunda olur ve o tur BU EKRANDAN
              atılmaz. Renk tek ayırt edici değil: durum METİNLE de yazılıyor. */}
          <View style={styles.anahtarSatir}>
            <View style={styles.anahtarMetin}>
              <Text style={[type.smallBold, { color: colors.text }]}>Bildirim</Text>
              <Text style={[type.micro, { color: colors.textDim }]}>
                {bildirimAcik
                  ? 'Açık — bu listenin sembolleri bildirim evrenine dahil.'
                  : 'Kapalı — bu listeden bildirim istenmiyor.'}
              </Text>
            </View>
            <Switch
              value={bildirimAcik}
              onValueChange={(v) => yaz(listeBildirimAyarla(kayit.id, v))}
              accessibilityLabel={'Bildirim: ' + (bildirimAcik ? 'açık' : 'kapalı')}
              trackColor={{ true: colors.goldSoft, false: colors.neutralSoft }}
              thumbColor={bildirimAcik ? colors.gold : colors.textFaint}
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
              {/* DÖNEM SEÇİCİ — web'in `.list-periods` şeridi
                  (app.js:8321). Seçili olan RENKLE DEĞİL dolu düğme
                  biçimiyle ayrışıyor. */}
              <View style={styles.donemler}>
                {DEGISIM_DONEMLER.map((d) => (
                  <Dugme
                    key={d}
                    label={DONEM_ADI[d]}
                    size="sm"
                    variant={d === donem ? 'solid' : 'outline'}
                    tone={d === donem ? 'info' : 'neutral'}
                    onPress={() => setDonem(d)}
                  />
                ))}
              </View>

              <Durum
                durum={durum}
                hata={hata}
                yenile={yenile}
                iskelet={kayit.items.length}
                sekil="satir"
                kartsiz
              />

              {/* YÜZDE TURU AYRI: fiyat gelmiş ama yüzde gelmemiş
                  olabilir. Yüzdenin hatası fiyatın hatasını
                  BASTIRMIYOR, kendi satırında duruyor. */}
              {dDurum === 'hata' ? (
                <View style={styles.form}>
                  <Text style={[type.micro, { color: colors.textDim }]}>
                    {(dHata?.message ?? 'Yüzde değişim ölçülemedi.') +
                      ' (' +
                      DONEM_ADI[donem] +
                      ')'}
                  </Text>
                  <Dugme
                    label="Yüzdeyi yeniden ölç"
                    size="sm"
                    variant="outline"
                    tone="neutral"
                    onPress={dYenile}
                  />
                </View>
              ) : null}
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
                  degisim={dDurum === 'veri' ? degisimBul(degisimSatirlari, oge) : null}
                  degisimOlculdu={dDurum === 'veri'}
                  donem={donem}
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
  degisim,
  degisimOlculdu,
  donem,
  onCikar,
}: {
  oge: ListeOge;
  satir: RecommendRow | null;
  olculdu: boolean;
  /** Seçili dönemin HAM yüzdesi (`/api/degisim`). */
  degisim: DegisimSatir | null;
  degisimOlculdu: boolean;
  donem: DegisimDonem;
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
        // `pazar`: uç BIST sembolünü sonek SİLEREK döndürüyor; detay
        // ekranı bu bilgiyle '.IS'i geri kazanıyor (bkz. o ekran).
        // TASARIM TURU 2: tek gezinme kalıbı (`lib/gezinme.ts`); params AYNI.
        onPress={() => hisseAc(satir?.sym ?? ucSembolu(oge.symbol), bist ? 'BIST' : 'US')}>
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
        <DonemYuzdesi satir={degisim} donem={donem} olculdu={degisimOlculdu} />
      </View>
      <Dugme label="Çıkar" size="sm" variant="outline" tone="neutral" onPress={onCikar} />
    </View>
  );
}

/**
 * Satırın seçili dönem yüzdesi. DÖRT AYRI HÂL, dördü ayrı cümle:
 * `olculdu=false` → "sormadım"; satır yok → "sordum, bu sembol
 * cevapta yok"; alan gövdede YOK → hiçbir şey çizilmiyor (uç o dönemi
 * ölçmedi); alan var ama `null` → "ölçemedim". Ölçülmeyen sayı BASILMAZ.
 *
 * Yüzde uçtan HAM geliyor (yüzde puanı); burada hesap YOK.
 */
function DonemYuzdesi({
  satir,
  donem,
  olculdu,
}: {
  satir: DegisimSatir | null;
  donem: DegisimDonem;
  olculdu: boolean;
}) {
  const { colors } = useTheme();
  const ad = DONEM_ADI[donem];

  if (!olculdu) {
    return (
      <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
        {ad + ' % sorulmadı'}
      </Text>
    );
  }
  if (!satir) {
    return (
      <Text style={[type.micro, { color: colors.textFaint }]} numberOfLines={1}>
        {ad + ' % cevapta yok'}
      </Text>
    );
  }

  const { alan } = DEGISIM_DONEM_ALANLARI[donem];
  // "Sormadım" ile "ölçemedim" ayrımı alanın VARLIĞINDAN okunuyor.
  if (!Object.prototype.hasOwnProperty.call(satir, alan)) return null;

  const pct = sayi(satir[alan]);
  if (pct == null) {
    return (
      <Text style={[type.micro, { color: colors.textDim }]} numberOfLines={1}>
        {ad + ' % ölçülemedi'}
      </Text>
    );
  }

  return (
    <Text
      style={[
        type.small,
        styles.num,
        // Yön İŞARETLE de taşınıyor: renk tek taşıyıcı değil.
        { color: pct > 0 ? colors.positive : pct < 0 ? colors.negative : colors.textDim },
      ]}
      numberOfLines={1}>
      {(pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '• ') +
        formatPercent(pct) +
        // Gecikme uçtan gelen MAKİNE BAYRAĞI; kelimeyi ekran yazıyor.
        (satir.gecikmeli ? ' · gecikmeli' : '')}
    </Text>
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
  satirSag: { alignItems: 'flex-end', gap: space.xxs },
  donemler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  num: numeric,
});
