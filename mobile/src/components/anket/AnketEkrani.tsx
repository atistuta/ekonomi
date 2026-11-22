// =====================================================================
//  ANKET EKRANI — ilk açılıştaki yedi soru            (PROcess / native)
// ---------------------------------------------------------------------
//  NE: `lib/anket.ts`teki soruları tek tek gösterir, yanıtları taslak
//  durumda tutar, sonunda `profilYaz` ile CİHAZA yazar. "Atla" kaydı
//  `atlandi` olarak kapatır — hiçbir yanıt VARSAYILMAZ.
//
//  NEDEN SEKME DEĞİL, KABUĞUN ÜSTÜ: anket gezinmenin bir yeri değil,
//  bir KAPI. expo-router 57 kökten `Stack` vermiyor (ölçüldü:
//  app/_layout.tsx başlığı), bu yüzden kök yerleşim `<Slot/>` yerine
//  BU ekranı basıyor. Böylece ne yeni bir rota, ne altıncı sekme açıldı.
//
//  NEDEN TASLAK DURUM, HER DOKUNUŞTA YAZMA DEĞİL: yedi soruda yedi
//  depo yazması demek, yarım bırakılan ankette yarım profil demekti.
//  Kayıt TEK kez, sonda açılıyor; `tamamlandi` ancak o an `true`.
//
//  BURADA HESAP YOK: tek bir puan, eşik ya da risk sınıfı üretilmiyor.
//  Yanıtlar yalnız ekran ayarı (api/depo.ts §11). Bu ekranda da,
//  sonrasında da kullanıcıya "şu hisseyi al" denmiyor.
//
//  ZAMAN ÇAĞIRANDAN: `ts` burada `new Date().toISOString()` ile
//  üretiliyor (cihaz saati) ve depoya ÖYLE veriliyor — depo kendi saat
//  uydurmuyor (pushJetonYaz kalıbı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { profilAtla, profilYaz, type Profil } from '@/api/depo';
import { Disclaimer, Dugme } from '@/components';
import {
  ANKET_SORULAR,
  ANKET_SORU_SAYISI,
  anketYanit,
  anketYanitlandi,
  type AnketSoru,
} from '@/lib/anket';
import { gutter, hitSlopMin, radius, space, type, useTheme } from '@/theme';

/** Taslak: kayıt şeklinin yanıt alanları. Depoya SONDA gidiyor. */
type Taslak = Pick<
  Profil,
  'deneyim' | 'vade' | 'dusus' | 'takip' | 'pazarlar' | 'temalar' | 'bildirimler'
>;

const TASLAK_BOS: Taslak = {
  deneyim: null,
  vade: null,
  dusus: null,
  takip: null,
  pazarlar: [],
  temalar: [],
  bildirimler: [],
};

export type AnketEkraniProps = {
  /** Anket kapandı (tamamlandı ya da atlandı). Kabuk `Slot`a döner. */
  onKapandi: () => void;
};

export function AnketEkrani({ onKapandi }: AnketEkraniProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [adim, setAdim] = useState(0);
  const [taslak, setTaslak] = useState<Taslak>(TASLAK_BOS);
  const [serbest, setSerbest] = useState('');
  // Yazma SÜRÜYOR mu? İki kez dokunulursa iki kayıt yazılmasın.
  const [yaziliyor, setYaziliyor] = useState(false);

  const soru = ANKET_SORULAR[adim];
  const sonAdim = adim === ANKET_SORU_SAYISI - 1;
  // Taslağı `Profil` gibi okutuyoruz: `anketYanit` kayıt şeklini
  // bekliyor, taslak onun alt kümesi. İkinci bir okuyucu yazmamak için.
  const sahteProfil = { ...taslak } as Profil;
  const yanitlandi = anketYanitlandi(sahteProfil, soru);

  function tekSec(alan: 'deneyim' | 'vade' | 'dusus' | 'takip', deger: string) {
    setTaslak((o) => ({ ...o, [alan]: deger }) as Taslak);
  }

  function cokSec(alan: 'pazarlar' | 'temalar' | 'bildirimler', deger: string) {
    setTaslak((o) => {
      const mevcut = o[alan] as string[];
      const yeni = mevcut.includes(deger)
        ? mevcut.filter((x) => x !== deger)
        : [...mevcut, deger];
      return { ...o, [alan]: yeni } as Taslak;
    });
  }

  function serbestEkle() {
    const metin = serbest.trim();
    if (metin === '') return;
    setTaslak((o) =>
      o.temalar.includes(metin) ? o : ({ ...o, temalar: [...o.temalar, metin] } as Taslak),
    );
    setSerbest('');
  }

  async function bitir() {
    if (yaziliyor) return;
    setYaziliyor(true);
    // Yazma başarısız olsa bile (kota/özel pencere) ekran AÇILIYOR:
    // kullanıcıyı ankette kilitlemek, kaydedememekten daha kötü.
    await profilYaz({ ...taslak, tamamlandi: true, atlandi: false }, new Date().toISOString());
    onKapandi();
  }

  async function atla() {
    if (yaziliyor) return;
    setYaziliyor(true);
    await profilAtla(new Date().toISOString());
    onKapandi();
  }

  return (
    <View style={[styles.kab, { backgroundColor: colors.bg, paddingTop: insets.top + space.lg }]}>
      <ScrollView
        style={styles.akis}
        contentContainerStyle={[styles.akisIc, { paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled">
        {/* SAYAÇ DİZİNİN UZUNLUĞUNDAN — elle yazılmış sayı yok. */}
        <Text style={[type.micro, { color: colors.textDim }]}>
          {'Anket, soru ' + (adim + 1) + ' / ' + ANKET_SORU_SAYISI}
        </Text>
        <IlerlemeCubugu adim={adim + 1} toplam={ANKET_SORU_SAYISI} />

        <Text style={[type.title, { color: colors.text }]}>{soru.baslik}</Text>
        <Text style={[type.small, { color: colors.textDim }]}>{soru.altBaslik}</Text>

        {soru.alan === 'temalar' ? (
          <View style={styles.cipAlan}>
            <View style={styles.cipSatir}>
              {soru.cipler.map((cip) => (
                <SecenekCipi
                  key={cip}
                  label={cip}
                  secili={taslak.temalar.includes(cip)}
                  onPress={() => cokSec('temalar', cip)}
                />
              ))}
            </View>
            {/* Kullanıcının kendi teması — tema araması serbest metin alıyor. */}
            <View style={styles.serbestSatir}>
              <TextInput
                value={serbest}
                onChangeText={setSerbest}
                onSubmitEditing={serbestEkle}
                placeholder="Başka bir tema yaz"
                placeholderTextColor={colors.textFaint}
                returnKeyType="done"
                style={[
                  styles.giris,
                  type.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Dugme label="Ekle" size="sm" variant="outline" tone="neutral" onPress={serbestEkle} />
            </View>
            {/* Kullanıcının yazdıkları, çiplerden AYRI gösteriliyor. */}
            {taslak.temalar.filter((t) => !soru.cipler.includes(t)).length ? (
              <View style={styles.cipSatir}>
                {taslak.temalar
                  .filter((t) => !soru.cipler.includes(t))
                  .map((t) => (
                    <SecenekCipi
                      key={t}
                      label={t}
                      secili
                      onPress={() => cokSec('temalar', t)}
                    />
                  ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.secenekler}>
            {soru.secenekler.map((s) => (
              <SecenekSatiri
                key={s.deger}
                label={s.label}
                not={s.not}
                cok={soru.cok}
                secili={seciliMi(taslak, soru, s.deger)}
                onPress={() =>
                  soru.cok
                    ? cokSec(soru.alan as 'pazarlar' | 'bildirimler', s.deger)
                    : tekSec(soru.alan as 'deneyim' | 'vade' | 'dusus' | 'takip', s.deger)
                }
              />
            ))}
          </View>
        )}

        {/* SONRAKİ ADIM GÖRÜNÜR: kullanıcı kaç soru kaldığını tahmin
            etmek zorunda kalmıyor (tasarım dili: "Sonraki adım: …"). */}
        {!sonAdim ? (
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'Sonraki adım: ' + ANKET_SORULAR[adim + 1].baslik.toLocaleLowerCase('tr-TR')}
          </Text>
        ) : null}
      </ScrollView>

      <View style={[styles.etek, { borderTopColor: colors.border, paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.etekSatir}>
          {adim > 0 ? (
            <Dugme
              label="Geri"
              size="sm"
              variant="outline"
              tone="neutral"
              onPress={() => setAdim((a) => Math.max(0, a - 1))}
            />
          ) : null}
          <Pressable
            onPress={atla}
            hitSlop={space.sm}
            accessibilityRole="button"
            accessibilityLabel="Anketi atla"
            style={styles.atla}>
            <Text style={[type.small, { color: colors.textDim }]}>Atla</Text>
          </Pressable>
          <View style={styles.bosluk} />
          <Dugme
            label={sonAdim ? 'Bitir' : 'Devam'}
            onPress={() => (sonAdim ? void bitir() : setAdim((a) => a + 1))}
            disabled={!yanitlandi || yaziliyor}
          />
        </View>
        <Disclaimer />
      </View>
    </View>
  );
}

/** Seçili mi? Teklide eşitlik, çoklukta dizide varlık. */
function seciliMi(taslak: Taslak, soru: AnketSoru, deger: string): boolean {
  const y = anketYanit({ ...taslak } as Profil, soru);
  if (y == null) return false;
  return Array.isArray(y) ? y.includes(deger) : y === deger;
}

/**
 * İlerleme çubuğu. SALT SUNUM: `adim/toplam` oranı bir ÖLÇÜM değil,
 * ekranın kendi sayacı — motorun hiçbir sayısı burada yok.
 */
function IlerlemeCubugu({ adim, toplam }: { adim: number; toplam: number }) {
  const { colors } = useTheme();
  const oran = Math.max(0, Math.min(1, adim / toplam));
  return (
    <View
      style={[styles.cubukKab, { backgroundColor: colors.bgCard }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: toplam, now: adim }}>
      <View
        // `DimensionValue` yüzdeyi yalnız `${number}%` biçiminde kabul
        // ediyor (ölçüldü: tsc TS2769 — `string` ve `${string}%`
        // reddedildi), bu yüzden yüzde TAM SAYI. Görsel kayıp yok:
        // çubuk zaten ekran genişliğinde çiziliyor.
        style={[
          styles.cubuk,
          { backgroundColor: colors.vurgu, width: `${Math.round(oran * 100)}%` },
        ]}
      />
    </View>
  );
}

/** Tek seçenek satırı — dokunma hedefi `hitSlopMin` altına düşmüyor. */
function SecenekSatiri({
  label,
  not,
  cok,
  secili,
  onPress,
}: {
  label: string;
  not: string | null;
  cok: boolean;
  secili: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={cok ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={{ checked: secili, selected: secili }}
      style={({ pressed }) => [
        styles.satir,
        {
          backgroundColor: pressed ? colors.bgPressed : secili ? colors.vurguSoft : colors.bgCard,
          borderColor: secili ? colors.vurgu : colors.border,
        },
      ]}>
      <View style={styles.satirMetin}>
        <Text style={[type.body, { color: colors.text }]}>{label}</Text>
        {not ? <Text style={[type.micro, { color: colors.textFaint }]}>{not}</Text> : null}
      </View>
      <Text style={[type.body, { color: secili ? colors.vurgu : colors.textFaint }]}>
        {secili ? '✓' : ''}
      </Text>
    </Pressable>
  );
}

/** Tema çipi. Çoktan seçmeli, `checkbox` rolünde. */
function SecenekCipi({
  label,
  secili,
  onPress,
  style,
}: {
  label: string;
  secili: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={space.xs}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: secili }}
      style={({ pressed }) => [
        styles.cip,
        {
          backgroundColor: pressed ? colors.bgPressed : secili ? colors.vurguSoft : colors.bgCard,
          borderColor: secili ? colors.vurgu : colors.border,
        },
        style,
      ]}>
      <Text style={[type.small, { color: secili ? colors.vurgu : colors.textDim }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  kab: { flex: 1 },
  akis: { flex: 1 },
  akisIc: { paddingHorizontal: gutter, gap: space.sm },
  cubukKab: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  cubuk: { height: 6, borderRadius: radius.pill },
  secenekler: { gap: space.sm, paddingTop: space.sm },
  satir: {
    minHeight: hitSlopMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  satirMetin: { flex: 1, gap: 2 },
  cipAlan: { gap: space.sm, paddingTop: space.sm },
  cipSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  serbestSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  giris: {
    flex: 1,
    minHeight: hitSlopMin,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  etek: {
    borderTopWidth: 1,
    paddingHorizontal: gutter,
    paddingTop: space.md,
    gap: space.sm,
  },
  etekSatir: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  atla: { minHeight: hitSlopMin, justifyContent: 'center', paddingHorizontal: space.xs },
  bosluk: { flex: 1 },
});

// Bilgi amaçlıdır, yatırım tavsiyesi değildir.
