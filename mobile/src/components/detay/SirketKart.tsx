// =====================================================================
//  🏢 ŞİRKET NE YAPIYOR? — Yahoo şirket profili (künye ucundan)
//                                                     (FAZ 3 / native)
// ---------------------------------------------------------------------
//  NE: webdeki hisse sayfasının `fillSpBiz` bölümünün (app.js:7800,
//  başlık "🏢 Şirket ne yapıyor?") native karşılığı. Sektör ETİKETİNİN
//  ötesinde şirketin ne iş yaptığını söyleyen düz metin.
//
//  NEDEN GEREKLİ: native detay ekranında sembolün ne şirket olduğunu
//  söyleyen HİÇBİR alan yoktu — skor, teknik, temel, haber hepsi vardı
//  ama "bu şirket ne yapıyor?" sorusunun cevabı yoktu. Arama sonucundan
//  gelen bir sembolde kullanıcı, önüne konan skoru TANIMADIĞI bir
//  şirket için okuyordu.
//
//  YENİ UÇ YOK: var olan `/api/yfin` künye turu kullanılıyor
//  (`api/_yfin.js:231-233` → `bizSummary` · `sector` · `industry` ·
//  `website`). Hobby 12-fonksiyon tavanı (§21 M3) DEĞİŞMEDİ.
//
//  `deep` KAPALI: profil alanları `assetProfile`ten geliyor, `deep`un
//  getirdiği `calendarEvents`/`earningsTrend` modüllerine İHTİYAÇ YOK.
//  Gereksiz modül istemek uç turunu uzatırdı (sembol başına sıralı
//  Yahoo isteği).
//
//  WEBDEN BİLEREK AYRILAN NOKTA — TERS PİYASA DENEMESİ YOK: web,
//  profil boş gelirse `otherMarket(market)` ile sembolü DİĞER pazarda
//  tekrar deniyor (app.js:7807-7816). Native bunu YAPMIYOR: pazarı
//  çağıran bildirir, istemci pazar ÇIKARIMI yapmaz (onaylanmış karar).
//  Sessizce başka bir pazarın şirketini basmak, kullanıcıya yanlış
//  şirketi doğru sanma riski verirdi. Profil gelmezse öyle söyleniyor.
//
//  BURADA HESAP YOK, PUAN YOK: metin olduğu gibi taşınıyor. Profil
//  metni İNGİLİZCE geliyor ve bu ekranda YAZILI — çevrilmiş gibi
//  sunulmuyor. Profil hiçbir skora girdi DEĞİL (SPK çerçevesi).
//
//  Bilgi amaçlıdır, yatırım tavsiyesi değildir.
// =====================================================================

import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { fetchYfin, useIstek, type YfinKunye } from '@/api';
import { Card, Durum, Katlanir, Pill, VeriYok } from '@/components';
import { space, type, useTheme } from '@/theme';

export type SirketKartProps = {
  /** Uca gidecek sembol — çağıranın yazımı (BIST'te `.IS` sonekli). */
  sembol: string;
};

/**
 * İlk cümleyi ayırır. SALT METİN İŞİ, eşik yok: nokta + boşluk ya da
 * metnin sonu. Bulamazsa TÜM metni ilk cümle sayar — kırpma yapmaz,
 * yoksa "…" ile yarım bırakılmış bir profil çıkardı.
 *
 * `Inc.`/`U.S.` gibi kısaltmalar yüzünden cümle erken bitebilir; bu
 * yüzden kalan metin ATILMIYOR, katlanır bölümde duruyor.
 */
function ilkCumle(metin: string): string {
  const m = /^[\s\S]*?[.!?](\s|$)/.exec(metin);
  return m ? m[0].trim() : metin.trim();
}

export function SirketKart({ sembol }: SirketKartProps) {
  // `deep: false` — profil `assetProfile`te; takvim modülleri gerekmiyor.
  const cagri = useCallback(
    (signal: AbortSignal) => fetchYfin([sembol], { deep: false, signal }),
    [sembol],
  );

  // Anahtar DİZGİ: `useIstek` nesne anahtarı kabul etmiyor (sonsuz tur).
  // `|sirket` eki, aynı sembolün temettü turuyla ÇAKIŞMASIN diye.
  const { durum, veri, hata, yenile } = useIstek(cagri, sembol + '|sirket', {
    etkin: Boolean(sembol),
  });

  const kunye: YfinKunye | null = veri?.results?.[0] ?? null;

  return (
    <Card
      title="🏢 Şirket ne yapıyor?"
      subtitle="Yahoo şirket profili — sektör etiketinin ötesinde, şirketin kendi tarifi."
      right={
        durum === 'veri' && kunye?.ok ? (
          <Pill label="skora girmez" tone="info" glyph={null} size="sm" />
        ) : null
      }>
      {/* Yükleniyor · boş · dört hata türü: tek gövde, kart içinde. */}
      <Durum
        durum={durum}
        hata={hata}
        yenile={yenile}
        iskelet={3}
        sekil="satir"
        bosMetin="Sembol bekleniyor."
        kartsiz
      />

      {durum === 'veri' ? (
        !kunye ? (
          // Tur koştu, kayıt gelmedi: hata değil, veri cevabı.
          <VeriYok kartsiz metin={sembol + ' için künye ucu kayıt döndürmedi.'} />
        ) : !kunye.ok ? (
          // `ok:false` → SEMBOL DIŞINDA HİÇBİR ALAN YOK (yfin.ts ölçümü).
          <VeriYok
            kartsiz
            metin={sembol + ' künyesi ölçülemedi (Yahoo turu düştü) — şirket profili yok.'}
          />
        ) : (
          <SirketGovde kunye={kunye} sembol={sembol} />
        )
      ) : null}
    </Card>
  );
}

/**
 * Gövde AYRI İŞLEV: `kunye.ok` burada KESİN `true`, her satırda ikinci
 * bir koşul zinciri yazılmıyor.
 *
 * ÜÇ DÜRÜST HÂL, ÜÇÜ AYRI CÜMLE:
 *   ① profil metni var                → cümle + etiket + tam metin
 *   ② metin yok, sektör etiketi var   → etiket basılıyor, "metin yok" DENİYOR
 *   ③ ikisi de yok                    → "bu hisse için profil yok"
 * Üçü de ÖLÇÜLMÜŞ cevap; hiçbiri "ölçülemedi" değil (o hâli üstteki
 * `ok:false` dalı söylüyor).
 */
function SirketGovde({ kunye, sembol }: { kunye: YfinKunye; sembol: string }) {
  const { colors } = useTheme();

  const metin = typeof kunye.bizSummary === 'string' ? kunye.bizSummary.trim() : '';
  const sektor = typeof kunye.sector === 'string' ? kunye.sector.trim() : '';
  const sanayi = typeof kunye.industry === 'string' ? kunye.industry.trim() : '';
  const site = typeof kunye.website === 'string' ? kunye.website.trim() : '';
  const etiket = [sektor, sanayi].filter(Boolean).join(' · ');

  const bir = metin ? ilkCumle(metin) : '';
  const kalan = metin.length > bir.length ? metin.slice(bir.length).trim() : '';

  return (
    <View style={styles.govde}>
      {metin ? (
        <>
          <Text style={[type.body, { color: colors.text }]}>{bir}</Text>
          {etiket ? (
            <Text style={[type.micro, { color: colors.textDim }]}>{etiket}</Text>
          ) : null}
          {kalan ? (
            // Tam metin KIRPILMIYOR, katlanıyor: uzun profil ekranı
            // boğmasın ama hiçbir cümle sessizce atılmasın.
            <Katlanir baslik="Tam profili oku" ozet="Yahoo profilinin kalanı (İngilizce)">
              <Text style={[type.body, { color: colors.text }]}>{kalan}</Text>
            </Katlanir>
          ) : null}
        </>
      ) : etiket ? (
        <>
          <Text style={[type.body, { color: colors.text }]}>{etiket}</Text>
          <Text style={[type.micro, { color: colors.textDim }]}>
            {'Şirketin kendi tarifi (profil metni) bu künyede YOK — yukarıdaki yalnız sektör/sanayi etiketi.'}
          </Text>
        </>
      ) : (
        <VeriYok
          kartsiz
          metin={sembol + ' künyesi geldi ama şirket profili ve sektör etiketi boş.'}
        />
      )}

      {site ? (
        <Pressable
          onPress={() => {
            // Harici tarayıcı; başarısız olursa SESSİZ geçiyor — adres
            // ucun verdiği metin, burada doğrulanmıyor.
            void Linking.openURL(site).catch(() => {});
          }}
          hitSlop={8}>
          <Text style={[type.micro, { color: colors.info }]}>{'Şirket sitesi ↗'}</Text>
        </Pressable>
      ) : null}

      {/* KAYNAK VE ÇERÇEVE EKRANDA YAZILI: metin İngilizce ve çeviri
          YAPILMIYOR; profil hiçbir skora girdi değil. */}
      <Text style={[type.micro, { color: colors.textFaint }]}>
        {'Kaynak: Yahoo Finance şirket profili — İngilizce gelir, çevrilmez. ' +
          'Yalnız bilgi: teknik ya da temel skora GİRMEZ.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // SALT SUNUM ölçüleri — hesap yok.
  govde: { gap: space.xs },
});
