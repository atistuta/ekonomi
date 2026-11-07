// =====================================================================
//  🧺 SEPET — cihazdaki varlık kayıtları              (ŞERİT F / native)
// ---------------------------------------------------------------------
//  NE: webin Sepet bölümünün (`app.js` `renderBasket`, depo anahtarı
//  `sb:basket`) native yüzeyi. Kullanıcının KENDİ girdiği adet/maliyet
//  kayıtları listelenir; isteyen "Fiyatları ölç" der ve ULAŞILABİLEN
//  fiyatlar getirilir (`api/sepet.ts`).
//
//  NEDEN GEREKLİ: `sepetDepo` native'de ZATEN okunuyordu (`depo.ts`,
//  `TUMU` listesinde, `depoBaslat` açılışta yüklüyor) ama HİÇBİR
//  EKRANDA GÖRÜNMÜYORDU — kayıt cihazda duruyor, kullanıcı göremiyordu.
//  Burası o boşluğu kapatan tek yüzey.
//
//  WEBDEN BİLEREK EKSİK BIRAKILAN: pencere/akış/delta makinesi
//  (`BASKET_WINDOWS`, `basketWindowFlow`, anlık görüntü geçmişi,
//  `renderBasketWindows`/`renderBasketMoves`). Onlar motor işi: dönem
//  tabanı seçip giriş/çıkış akışını fiyat değişiminden AYIRIYOR. Uçta
//  karşılığı yok, istemciye kurmak §5.1'in yasakladığı şey olurdu.
//  DEVAM.md §30 ÖLÇÜLMEDİ'de yazılı.
//
//  TOPLAM YAZILMIYOR (benim kararım): satır değerleri farklı para
//  biriminde (BIST/TRY · ABD+kripto/USD), bir kısmı ölçülemiyor ve KUR
//  ÇEVRİMİ UCU YOK (`api/sepet.ts` başlığı). Tek bir "sepet toplamı"
//  basmak, ölçülmüş fiyatı elle girilenle ve eksik satırla aynı sayıda
//  eritmek olurdu. Gerekçe EKRANDA yazılı.
//
//  BURADA TEK HESAP VAR: `muhasebe()` — `adet × fiyat` ve maliyete göre
//  FARK. İkisi de kullanıcının kendi kaydı üzerinde muhasebedir; eşik,
//  ağırlık, formül, puan YOK ve skora GİRMEZ (ekranda da yazılı).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  sepetFiyatlari,
  sepetDepo,
  sepettenCikar,
  useSepet,
  useTurHazir,
  type SepetFiyat,
  type SepetFiyatSonuc,
  type SepetKalemi,
} from '@/api';
import { Card, Dugme, Katlanir, Pill } from '@/components';
import { EMPTY, formatPrice } from '@/lib/format';
import { VARLIK_SINIFI_SOZLUK } from '@/lib/sozluk';
import { space, type, useTheme } from '@/theme';

export type SepetKartProps = Record<string, never>;

/** Fiyatın NEREDEN geldiği ekranda yazılı: ölçüm mü, kullanıcının kaydı mı. */
const KAYNAK_ADI: Readonly<Record<SepetFiyat['kaynak'], string>> = {
  degisim: 'ölçülen fiyat',
  kripto: 'ölçülen fiyat',
  kur: 'ölçülen fiyat',
  elle: 'elle girilen fiyat',
  nakit: 'tanım gereği 1',
};

/**
 * TEK HESAP YERİ. `adet × fiyat` ve maliyete göre fark — ikisi de
 * kullanıcının kendi kaydı üzerinde muhasebe; eşik/ağırlık/formül yok.
 *
 * `fark` yalnız maliyetin para birimi fiyatın para birimiyle AYNIYSA
 * hesaplanıyor: kur çevrimi ucu yok, farklı birimi çıkarmak uydurma
 * olurdu. Ölçülmeyen her hâl `null` — `0` DEĞİL.
 */
function muhasebe(
  kalem: SepetKalemi,
  fiyat: SepetFiyat | undefined,
): { deger: number | null; fark: number | null } {
  if (!fiyat || typeof kalem.qty !== 'number')
    return { deger: null, fark: null };
  const deger = kalem.qty * fiyat.fiyat;
  const birimAyni =
    typeof kalem.cost === 'number' &&
    typeof fiyat.birim === 'string' &&
    kalem.costCur.toUpperCase() === fiyat.birim.toUpperCase();
  return { deger, fark: birimAyni ? deger - (kalem.cost as number) : null };
}

function SepetSatiri({
  kalem,
  fiyat,
  onCikar,
}: {
  kalem: SepetKalemi;
  fiyat: SepetFiyat | undefined;
  /** Satırı sepetten çıkar. Yazma `depo.ts`te; kart yalnız çağırıyor. */
  onCikar: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { deger, fark } = muhasebe(kalem, fiyat);
  const ad = kalem.name || kalem.symbol || kalem.id;
  const birim = kalem.unit ? ' ' + kalem.unit : '';

  return (
    <View style={styles.satir}>
      <View style={styles.satirBas}>
        <Text style={[type.body, { color: colors.text }]} numberOfLines={1}>
          {(kalem.emoji ? kalem.emoji + ' ' : '') + ad}
        </Text>
        <Pill
          label={VARLIK_SINIFI_SOZLUK[kalem.cls]}
          tone="neutral"
          glyph={null}
          size="sm"
        />
        {/* ÇIKAR: web `removeBasketHolding` (app.js:3341) karşılığı.
            ONAY SORULMUYOR — web de sormuyor ve işlem hamle günlüğüne
            düşüyor, yani ne çıkarıldığı EKRANDA kalıyor. */}
        <Dugme
          label="Çıkar"
          size="sm"
          variant="outline"
          tone="negative"
          onPress={() => onCikar(kalem.id)}
          style={styles.cikar}
        />
      </View>

      <Text style={[type.micro, { color: colors.textDim }]}>
        {'adet: ' +
          (typeof kalem.qty === 'number' ? kalem.qty + birim : EMPTY) +
          ' · maliyet: ' +
          (typeof kalem.cost === 'number'
            ? formatPrice(kalem.cost, kalem.costCur)
            : EMPTY)}
      </Text>

      {fiyat ? (
        <Text style={[type.micro, { color: colors.text }]}>
          {'fiyat: ' +
            formatPrice(fiyat.fiyat, fiyat.birim) +
            ' (' +
            KAYNAK_ADI[fiyat.kaynak] +
            ') · değer: ' +
            (deger === null
              ? EMPTY + ' (adet yok)'
              : formatPrice(deger, fiyat.birim))}
        </Text>
      ) : (
        <Text style={[type.micro, { color: colors.textFaint }]}>
          fiyat: henüz ölçülmedi (değer yazılmıyor).
        </Text>
      )}

      {fark === null ? (
        typeof kalem.cost === 'number' && fiyat ? (
          <Text style={[type.micro, { color: colors.textFaint }]}>
            {'maliyet farkı yazılmıyor: maliyet ' +
              kalem.costCur +
              ', fiyat ' +
              (fiyat.birim ?? EMPTY) +
              ' — kur çevrimi ucu yok.'}
          </Text>
        ) : null
      ) : (
        <Text
          style={[
            type.micro,
            { color: fark < 0 ? colors.negative : colors.positive },
          ]}
        >
          {'maliyete göre fark: ' +
            formatPrice(fark, fiyat ? fiyat.birim : null)}
        </Text>
      )}
    </View>
  );
}

export function SepetKart() {
  const { colors } = useTheme();
  const kalemler = useSepet();
  const hazir = useTurHazir(sepetDepo);

  const [mesgul, setMesgul] = useState(false);
  // `null` = hiç çıkarma denenmedi. Yazıcının DÖNDÜRDÜĞÜ cümle basılıyor.
  const [cikarHata, setCikarHata] = useState<string | null>(null);
  // `null` = hiç ölçülmedi; boş sonuç BAŞKA bir hâl.
  const [sonuc, setSonuc] = useState<SepetFiyatSonuc | null>(null);

  if (!hazir) {
    return (
      <Card title="🧺 Sepet">
        <Text style={[type.small, { color: colors.textDim }]}>
          Cihazdaki kayıt okunuyor…
        </Text>
      </Card>
    );
  }

  const cikar = (id: string) => {
    void sepettenCikar(id).then((s) => setCikarHata(s.ok ? null : s.mesaj));
  };

  const olc = () => {
    setMesgul(true);
    void sepetFiyatlari().then((s) => {
      setMesgul(false);
      setSonuc(s);
    });
  };

  // Kaynaksız gerekçeler TEKİLLEŞTİRİLİYOR ama SAYISI yazılı: aynı
  // cümleyi yedi kez basmak okunmaz, gizlemek ise sessiz kırpma olurdu.
  const sebepSayisi: Record<string, number> = {};
  for (const k of sonuc?.kaynaksiz ?? []) {
    sebepSayisi[k.sebep] = (sebepSayisi[k.sebep] ?? 0) + 1;
  }

  return (
    <Card
      title="🧺 Sepet"
      subtitle="Bu cihazda kayıtlı adet ve maliyetler. Kendi kaydın; teknik ya da temel skora GİRMEZ."
      right={
        <Pill
          label={kalemler.length + ' kayıt'}
          tone={kalemler.length ? 'info' : 'neutral'}
          glyph={null}
          size="sm"
        />
      }
    >
      <View style={styles.govde}>
        {kalemler.length === 0 ? (
          <>
            <Text style={[type.body, { color: colors.text }]}>
              Bu cihazda sepet kaydı yok.
            </Text>
            <Text style={[type.micro, { color: colors.textFaint }]}>
              Sepet kaydı buluta GÖNDERİLMİYOR: bildirim senkronu gövdesi yalnız
              takip listesini taşıyor. Webde girilen sepet bu cihazda görünmez.
            </Text>
          </>
        ) : (
          <>
            <Dugme
              label={mesgul ? 'Ölçülüyor…' : 'Fiyatları ölç'}
              size="sm"
              disabled={mesgul}
              onPress={olc}
            />

            {kalemler.map((k) => (
              <SepetSatiri
                key={k.id}
                kalem={k}
                fiyat={sonuc?.fiyatlar[k.id]}
                onCikar={cikar}
              />
            ))}

            {cikarHata ? (
              <Text style={[type.micro, { color: colors.negative }]}>
                {cikarHata}
              </Text>
            ) : null}

            {sonuc ? (
              <View style={styles.govde}>
                {sonuc.hata ? (
                  <Text style={[type.micro, { color: colors.negative }]}>
                    {sonuc.hata}
                  </Text>
                ) : null}

                {sonuc.olculemedi.length ? (
                  <Text style={[type.micro, { color: colors.gold }]}>
                    {sonuc.olculemedi.length +
                      ' kaydın fiyatı SORULDU ama ölçülemedi (uç fiyat döndürmedi).'}
                  </Text>
                ) : null}

                {Object.keys(sebepSayisi).map((sebep) => (
                  <Text
                    key={sebep}
                    style={[type.micro, { color: colors.textDim }]}
                  >
                    {sebepSayisi[sebep] + ' kayıt: ' + sebep}
                  </Text>
                ))}

                {sonuc.uyarilar.length ? (
                  <Katlanir baslik="Uçların uyarıları">
                    {sonuc.uyarilar.map((u, i) => (
                      <Text
                        key={String(i)}
                        style={[type.micro, { color: colors.textDim }]}
                      >
                        {u}
                      </Text>
                    ))}
                  </Katlanir>
                ) : null}
              </View>
            ) : null}

            <Text style={[type.micro, { color: colors.textFaint }]}>
              SEPET TOPLAMI YAZILMIYOR: satırlar farklı para biriminde, bir
              kısmının fiyatı ölçülemiyor ve kur çevrimi ucu yok. Dönem
              akışı/değişimi de bu ekranda yok.
            </Text>
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
  satir: { gap: 2, paddingVertical: space.xs },
  satirBas: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Çıkar düğmesi satırın SAĞ ucunda: ada ve rozete yer kalsın.
  cikar: { marginLeft: 'auto' },
});
