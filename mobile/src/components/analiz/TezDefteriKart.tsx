// =====================================================================
//  TezDefteriKart — web'in `📓 Tez` sekmesi               (ŞERİT / native)
// ---------------------------------------------------------------------
//  NE: kullanıcının KENDİ yatırım tezleri: hisse, pozisyon, konviksiyon,
//  tez cümlesi, dayanaklar (durum döngüsü), riskler, kendi hedef/çıkış
//  fiyatı, katalizörler ve tarihli günlük. Web'deki `#tab-tez`
//  (`index.html:163`, `app.js:9931-10230`) karşılığı.
//
//  NEDEN BU KART SUNUCUYA HİÇ SORMUYOR: defter CİHAZDA duruyor — web de
//  `localStorage` kullanıyor (`TEZ_LS_KEY = 'sb:theses'`, app.js:9931).
//  Yeni uç YOK, yeni Vercel yuvası YOK.
//
//  NEDEN BİLEŞEN İÇİNDE DEPO OKUNUYOR: `useTezler()` AĞ DEĞİL, yerel
//  depo aboneliği. N tezin formunu ekrandan prop'la beslemek, her tuşa
//  basışta ekranın tamamını yeniden kurardı.
//
//  ── BURADA HESAP YOK (§5.1) ────────────────────────────────────────
//  Web o sekmede göstergeyi İSTEMCİDE hesaplıyor:
//    `let f = (price - stop) / (target - stop)` ve
//    `(target - price) / price * 100`.
//  Bu aritmetik BURAYA GİRMEDİ. Hedef ve çıkış kullanıcının yazdığı HAM
//  fiyat olarak basılıyor; "hedefe % kaç kaldı" sayısı YOK — o hesap
//  motorun işi ve motorda böyle bir uç henüz yok. Sayıyı istemcide
//  üretmek, aynı ekranda motorun ölçtüğü sayılarla uydurma bir sayıyı
//  yan yana koymak olurdu.
//  Kullanıcının yazdığı dizgeyi sayıya çevirmek (`sayiOku`) hesap
//  değil, AYRIŞTIRMA — eşik/ağırlık/formül taşımıyor.
//
//  ── SİLME ONAYI İKİ DOKUNUŞ ────────────────────────────────────────
//  Web `confirm()` kullanıyor; `mobile/src/` içinde hiçbir yerde `Alert`
//  YOK (ölçüldü). Kalıp `ListeBlogu.tsx`ten: düğme ilk basışta soruyor,
//  ikinci basışta siliyor.
//
//  ── DÖRT DÜRÜST DURUM ──────────────────────────────────────────────
//  Hedef/çıkış `null` ise "yazılmadı" yazılıyor; `0` BASILMAZ (`0`
//  geçerli bir fiyat olabilir). Boş defter ARIZA DEĞİL.
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  katalizorSatirlari,
  metinSatirlari,
  sayiOku,
  tezDayanakDongu,
  tezEkle,
  tezGuncelle,
  tezGunlukEkle,
  tezGunlukSil,
  tezSil,
  useTezler,
  type Tez,
  type TezGirdi,
} from '@/api';
import { Card, Dugme, Pill } from '@/components';
import { formatPrice } from '@/lib/format';
import { hisseAc } from '@/lib/gezinme';
import { hitSlopMin, radius, space, type, useTheme } from '@/theme';

export type TezDefteriKartProps = {
  /**
   * Form açıldığında sembol alanına önceden yazılacak kod (ekranın
   * seçili sembolü). Kullanıcı değiştirebilir.
   */
  onerilenSembol?: string;
};

type Ton = 'positive' | 'negative' | 'neutral' | 'gold' | 'info';

/** Dayanak durumunun düz-dil karşılığı — renk tek ayırt edici değil. */
const DAYANAK_SOZ: Record<Tez['pillars'][number]['status'], { soz: string; ton: Ton }> = {
  ok: { soz: 'sağlam', ton: 'positive' },
  watch: { soz: 'izlemede', ton: 'gold' },
  bad: { soz: 'bozuldu', ton: 'negative' },
};

/** Günlük satırının etkisi (web `imp`: p/z/n). */
const ETKI_SOZ: Record<string, { soz: string; ton: Ton }> = {
  p: { soz: 'olumlu', ton: 'positive' },
  z: { soz: 'nötr', ton: 'neutral' },
  n: { soz: 'olumsuz', ton: 'negative' },
};

const KONVIKSIYON_SOZ: Record<Tez['conviction'], string> = {
  hi: 'Yüksek',
  mid: 'Orta',
  lo: 'Düşük',
};

/** BIST sembolünün uçta göründüğü hâli (sonek silinmiş). */
function ucSembolu(sembol: string): string {
  return sembol.endsWith('.IS') ? sembol.slice(0, -3) : sembol;
}

export function TezDefteriKart({ onerilenSembol }: TezDefteriKartProps) {
  const { colors } = useTheme();
  const tezler = useTezler();
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Tez | null>(null);

  return (
    <Card
      title="📓 Tez defteri"
      subtitle="Senin kendi notların — uygulamanın önerisi değil. Bu cihazda saklanır."
      right={
        <Dugme
          label={formAcik ? 'Formu kapat' : '＋ Yeni tez'}
          size="sm"
          variant="outline"
          tone="info"
          onPress={() => {
            setDuzenlenen(null);
            setFormAcik((v) => !v);
          }}
        />
      }>
      {formAcik || duzenlenen ? (
        <TezForm
          duzenlenen={duzenlenen}
          onerilenSembol={onerilenSembol}
          onBitti={() => {
            setFormAcik(false);
            setDuzenlenen(null);
          }}
        />
      ) : null}

      {tezler.length === 0 ? (
        <Text style={[type.small, { color: colors.textDim }]}>
          Defter boş — ＋ Yeni tez ile bir hisse için kendi tezini yaz. Skor motoruna dokunmaz.
        </Text>
      ) : (
        tezler.map((tez) => (
          <TezBlogu
            key={tez.id}
            tez={tez}
            onDuzenle={() => {
              setFormAcik(false);
              setDuzenlenen(tez);
            }}
          />
        ))
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------
//  FORM — yeni tez / düzenleme
// ---------------------------------------------------------------------

function TezForm({
  duzenlenen,
  onerilenSembol,
  onBitti,
}: {
  duzenlenen: Tez | null;
  onerilenSembol?: string;
  onBitti: () => void;
}) {
  const { colors } = useTheme();
  const [sembol, setSembol] = useState(duzenlenen?.symbol ?? (onerilenSembol ?? ''));
  const [pozisyon, setPozisyon] = useState<Tez['position']>(duzenlenen?.position ?? 'long');
  const [konviksiyon, setKonviksiyon] = useState<Tez['conviction']>(
    duzenlenen?.conviction ?? 'mid',
  );
  const [cumle, setCumle] = useState(duzenlenen?.thesis ?? '');
  const [dayanaklar, setDayanaklar] = useState(
    (duzenlenen?.pillars ?? []).map((p) => p.text).join('\n'),
  );
  const [riskler, setRiskler] = useState((duzenlenen?.risks ?? []).join('\n'));
  const [hedef, setHedef] = useState(duzenlenen?.target != null ? String(duzenlenen.target) : '');
  const [cikis, setCikis] = useState(duzenlenen?.stop != null ? String(duzenlenen.stop) : '');
  const [katalizorlar, setKatalizorlar] = useState(
    (duzenlenen?.catalysts ?? []).map((k) => (k.date ? k.date + ' | ' + k.text : k.text)).join('\n'),
  );
  const [bildirim, setBildirim] = useState<string | null>(null);

  const girdi = (): TezGirdi => ({
    symbol: sembol,
    // Pazar BOŞ gidiyor: yazıcı sembolün kendisinden çözüyor
    // (`pazarOf`). Burada ikinci bir kural yazmak iki yerde ayrışabilen
    // iki pazar tanımı demekti.
    market: '',
    name: duzenlenen?.name,
    position: pozisyon,
    conviction: konviksiyon,
    thesis: cumle,
    pillars: metinSatirlari(dayanaklar),
    risks: metinSatirlari(riskler),
    target: sayiOku(hedef),
    stop: sayiOku(cikis),
    catalysts: katalizorSatirlari(katalizorlar),
  });

  const kaydet = () => {
    const sozu = duzenlenen ? tezGuncelle(duzenlenen.id, girdi()) : tezEkle(girdi());
    void sozu.then((s) => {
      if (s.ok) {
        setBildirim(null);
        onBitti();
        return;
      }
      setBildirim(s.mesaj);
    });
  };

  return (
    <View style={[styles.form, { borderColor: colors.border }]}>
      <Text style={[type.smallBold, { color: colors.text }]}>
        {duzenlenen ? duzenlenen.symbol + ' tezini düzenle' : 'Yeni tez'}
      </Text>

      <Alan etiket="Hisse kodu">
        {duzenlenen ? (
          <Text style={[type.body, { color: colors.textDim }]}>
            {duzenlenen.symbol + ' — tez hissesi değiştirilemez, yeni tez aç.'}
          </Text>
        ) : (
          <TextInput
            value={sembol}
            onChangeText={(t) => {
              setSembol(t.toUpperCase());
              setBildirim(null);
            }}
            placeholder="Kod (ör. THYAO.IS)"
            placeholderTextColor={colors.textFaint}
            autoCorrect={false}
            autoCapitalize="characters"
            maxLength={12}
            accessibilityLabel="Tez açılacak hisse kodu"
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
        )}
      </Alan>

      <Alan etiket="Pozisyon">
        <View style={styles.secici}>
          <Dugme
            label="Uzun"
            size="sm"
            variant={pozisyon === 'long' ? 'solid' : 'outline'}
            tone="neutral"
            onPress={() => setPozisyon('long')}
          />
          <Dugme
            label="Kısa"
            size="sm"
            variant={pozisyon === 'short' ? 'solid' : 'outline'}
            tone="neutral"
            onPress={() => setPozisyon('short')}
          />
        </View>
      </Alan>

      <Alan etiket="Konviksiyon">
        <View style={styles.secici}>
          {(['hi', 'mid', 'lo'] as const).map((k) => (
            <Dugme
              key={k}
              label={KONVIKSIYON_SOZ[k]}
              size="sm"
              variant={konviksiyon === k ? 'solid' : 'outline'}
              tone="neutral"
              onPress={() => setKonviksiyon(k)}
            />
          ))}
        </View>
      </Alan>

      <Alan etiket="Tez cümlesi (1–2 cümle)">
        <CokSatir
          value={cumle}
          onChangeText={(t) => {
            setCumle(t);
            setBildirim(null);
          }}
          placeholder="Neden bu hisse?"
          a11y="Tez cümlesi"
        />
      </Alan>

      <Alan etiket="Dayanaklar (her satır bir madde)">
        <CokSatir
          value={dayanaklar}
          onChangeText={setDayanaklar}
          placeholder={'Her satıra bir dayanak'}
          a11y="Tezin dayanakları"
        />
      </Alan>

      <Alan etiket="Tezi bozacak riskler (her satır bir madde)">
        <CokSatir
          value={riskler}
          onChangeText={setRiskler}
          placeholder={'Her satıra bir risk'}
          a11y="Tezi bozacak riskler"
        />
      </Alan>

      <Alan etiket="🎯 Hedef fiyat">
        <TextInput
          value={hedef}
          onChangeText={setHedef}
          placeholder="Senin hedefin"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          maxLength={14}
          accessibilityLabel="Kendi hedef fiyatın"
          style={[
            styles.alan,
            type.body,
            { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        />
      </Alan>

      <Alan etiket="🛑 Çıkış fiyatı">
        <TextInput
          value={cikis}
          onChangeText={setCikis}
          placeholder="Senin çıkış seviyen"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          maxLength={14}
          accessibilityLabel="Kendi çıkış fiyatın"
          style={[
            styles.alan,
            type.body,
            { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        />
      </Alan>

      <Alan etiket="Katalizörler (opsiyonel — her satır &quot;Tarih | açıklama&quot;)">
        <CokSatir
          value={katalizorlar}
          onChangeText={setKatalizorlar}
          placeholder={'2026-02-10 | bilanço'}
          a11y="Manuel katalizörler"
        />
      </Alan>

      {/* DÜRÜST ALTYAZI: web burada yüzde uzaklığı kendi hesaplıyor;
          native o hesabı yapmıyor ve bunu saklamıyor. */}
      <Text style={[type.micro, { color: colors.textDim }]}>
        Bunlar senin kendi hedeflerin — uygulamanın önerisi değil. Hedefe yüzde kaç kaldığı
        BASILMAZ: o hesap motorun işi, istemcide yapılmıyor.
      </Text>

      {bildirim ? <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text> : null}

      <View style={styles.eylemler}>
        <Dugme
          label={duzenlenen ? 'Değişikliği kaydet' : 'Tezi kaydet'}
          size="sm"
          disabled={!sembol.trim() || !cumle.trim()}
          onPress={kaydet}
        />
        <Dugme label="Vazgeç" size="sm" variant="outline" tone="neutral" onPress={onBitti} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------
//  TEK TEZ BLOĞU
// ---------------------------------------------------------------------

function TezBlogu({ tez, onDuzenle }: { tez: Tez; onDuzenle: () => void }) {
  const { colors } = useTheme();
  const [acik, setAcik] = useState(false);
  const [silSoruldu, setSilSoruldu] = useState(false);
  const [notAcik, setNotAcik] = useState(false);
  const [not, setNot] = useState('');
  const [etki, setEtki] = useState('z');
  const [bildirim, setBildirim] = useState<string | null>(null);
  const kur = tez.market === 'BIST' ? 'TRY' : null;

  const yaz = (sozu: Promise<{ ok: boolean; mesaj?: string }>) => {
    void sozu.then((s) => setBildirim(s.ok ? null : (s.mesaj ?? 'Yazılamadı.')));
  };

  return (
    <View style={[styles.blok, { borderColor: colors.border }]}>
      <View style={styles.baslik}>
        <Pressable
          style={styles.basliSol}
          accessibilityRole="button"
          accessibilityLabel={tez.symbol + ' hisse sayfasını aç'}
          onPress={() => hisseAc(ucSembolu(tez.symbol), tez.market === 'BIST' ? 'BIST' : 'US')}>
          <Text style={[type.bodyBold, { color: colors.text }]} numberOfLines={1}>
            {tez.symbol}
          </Text>
          <Pill
            label={tez.position === 'short' ? 'Kısa' : 'Uzun'}
            tone="neutral"
            glyph={null}
            size="sm"
          />
          <Pill
            label={'Konviksiyon: ' + KONVIKSIYON_SOZ[tez.conviction]}
            tone="neutral"
            glyph={null}
            size="sm"
          />
        </Pressable>
        <Dugme
          label={acik ? '▾ Kapat' : '▸ Aç'}
          size="sm"
          variant="outline"
          tone="neutral"
          onPress={() => setAcik((v) => !v)}
        />
      </View>

      <Text style={[type.small, { color: colors.text }]}>{tez.thesis}</Text>
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Açıldı ' + tez.created + ' · son güncelleme ' + tez.updated}
      </Text>

      {acik ? (
        <>
          {/* DAYANAKLAR — dokununca durum döngüsü (web ile AYNI sıra:
              sağlam ▸ izlemede ▸ bozuldu). Durum METİNLE de yazılı. */}
          <Text style={[type.smallBold, { color: colors.text }]}>Dayanaklar</Text>
          {tez.pillars.length === 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              Dayanak yazılmadı — düzenleyip ekleyebilirsin.
            </Text>
          ) : (
            tez.pillars.map((p, i) => (
              <Pressable
                key={p.text + i}
                style={styles.dayanak}
                accessibilityRole="button"
                accessibilityLabel={p.text + ' — durum: ' + DAYANAK_SOZ[p.status].soz + ', değiştir'}
                onPress={() => yaz(tezDayanakDongu(tez.id, i))}>
                <Text style={[type.small, { color: colors.text, flex: 1 }]}>{p.text}</Text>
                <Pill
                  label={DAYANAK_SOZ[p.status].soz}
                  tone={DAYANAK_SOZ[p.status].ton}
                  glyph={null}
                  size="sm"
                />
              </Pressable>
            ))
          )}

          <Text style={[type.smallBold, { color: colors.text }]}>Tezi bozacak riskler</Text>
          {tez.risks.length === 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>Risk yazılmadı.</Text>
          ) : (
            tez.risks.map((r, i) => (
              <Text key={r + i} style={[type.small, { color: colors.textDim }]}>
                {'· ' + r}
              </Text>
            ))
          )}

          {/* KULLANICININ KENDİ SEVİYELERİ — HAM fiyat. Yüzde uzaklık
              YOK (dosya başlığındaki gerekçe). */}
          <View style={styles.satir}>
            <Text style={[type.small, { color: colors.textDim }]}>🎯 Kendi hedefin</Text>
            <Text style={[type.small, { color: colors.text }]}>
              {tez.target == null ? 'yazılmadı' : formatPrice(tez.target, kur)}
            </Text>
          </View>
          <View style={styles.satir}>
            <Text style={[type.small, { color: colors.textDim }]}>🛑 Kendi çıkışın</Text>
            <Text style={[type.small, { color: colors.text }]}>
              {tez.stop == null ? 'yazılmadı' : formatPrice(tez.stop, kur)}
            </Text>
          </View>

          <Text style={[type.smallBold, { color: colors.text }]}>Katalizörler</Text>
          {tez.catalysts.length === 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>Katalizör yazılmadı.</Text>
          ) : (
            tez.catalysts.map((k, i) => (
              <Text key={k.text + i} style={[type.small, { color: colors.textDim }]}>
                {(k.date ? k.date + ' · ' : '') + k.text}
              </Text>
            ))
          )}

          {/* GÜNLÜK */}
          <View style={styles.baslik}>
            <Text style={[type.smallBold, { color: colors.text }]}>
              {'Günlük (' + tez.log.length + ')'}
            </Text>
            <Dugme
              label={notAcik ? 'Not formunu kapat' : '✎ Not ekle'}
              size="sm"
              variant="outline"
              tone="info"
              onPress={() => {
                setNotAcik((v) => !v);
                setBildirim(null);
              }}
            />
          </View>

          {notAcik ? (
            <View style={styles.form}>
              <View style={styles.secici}>
                {(['p', 'z', 'n'] as const).map((e) => (
                  <Dugme
                    key={e}
                    label={ETKI_SOZ[e].soz}
                    size="sm"
                    variant={etki === e ? 'solid' : 'outline'}
                    tone="neutral"
                    onPress={() => setEtki(e)}
                  />
                ))}
              </View>
              <CokSatir
                value={not}
                onChangeText={(t) => {
                  setNot(t);
                  setBildirim(null);
                }}
                placeholder="Ne değişti?"
                a11y={tez.symbol + ' tezine günlük notu'}
              />
              <Dugme
                label="Notu kaydet"
                size="sm"
                disabled={!not.trim()}
                onPress={() => {
                  void tezGunlukEkle(tez.id, { imp: etki, note: not }).then((s) => {
                    if (s.ok) {
                      setNot('');
                      setNotAcik(false);
                      setBildirim(null);
                      return;
                    }
                    setBildirim(s.mesaj);
                  });
                }}
              />
            </View>
          ) : null}

          {tez.log.length === 0 ? (
            <Text style={[type.micro, { color: colors.textDim }]}>
              Günlük boş — tez değiştikçe not bırak.
            </Text>
          ) : (
            tez.log.map((g, i) => (
              <View key={g.date + i + g.note} style={styles.gunluk}>
                <View style={styles.gunlukSol}>
                  <Text style={[type.micro, { color: colors.textFaint }]}>
                    {g.date + ' · ' + (ETKI_SOZ[g.imp]?.soz ?? 'etki yazılmadı')}
                  </Text>
                  <Text style={[type.small, { color: colors.text }]}>{g.note}</Text>
                </View>
                <Dugme
                  label="Sil"
                  size="sm"
                  variant="outline"
                  tone="neutral"
                  onPress={() => yaz(tezGunlukSil(tez.id, i))}
                />
              </View>
            ))
          )}

          {bildirim ? (
            <Text style={[type.small, { color: colors.negative }]}>{bildirim}</Text>
          ) : null}

          <View style={styles.eylemler}>
            <Dugme
              label="✎ Tezi düzenle"
              size="sm"
              variant="outline"
              tone="neutral"
              onPress={onDuzenle}
            />
            <Dugme
              label={silSoruldu ? 'Silmeyi onayla' : '🗑 Tezi sil'}
              size="sm"
              variant="outline"
              tone={silSoruldu ? 'negative' : 'neutral'}
              onPress={() => {
                if (!silSoruldu) {
                  setSilSoruldu(true);
                  return;
                }
                setSilSoruldu(false);
                yaz(tezSil(tez.id));
              }}
            />
          </View>
          {silSoruldu ? (
            <Text style={[type.micro, { color: colors.gold }]}>
              {tez.symbol + ' tezi ve günlüğü silinecek. Onaylamak için düğmeye yeniden bas.'}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------
//  KÜÇÜK YÜZEYLER
// ---------------------------------------------------------------------

function Alan({ etiket, children }: { etiket: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.alanKutu}>
      <Text style={[type.micro, { color: colors.textDim }]}>{etiket}</Text>
      {children}
    </View>
  );
}

function CokSatir({
  value,
  onChangeText,
  placeholder,
  a11y,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  a11y: string;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textFaint}
      multiline
      textAlignVertical="top"
      accessibilityLabel={a11y}
      style={[
        styles.cokSatir,
        type.body,
        { color: colors.text, backgroundColor: colors.bgElevated, borderColor: colors.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  form: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  alanKutu: { gap: space.xxs },
  alan: {
    minHeight: hitSlopMin,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  cokSatir: {
    minHeight: hitSlopMin * 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  secici: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  eylemler: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  blok: {
    gap: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
  },
  baslik: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  basliSol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dayanak: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  satir: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 4,
  },
  gunluk: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  gunlukSol: { flex: 1, gap: space.xxs },
});
