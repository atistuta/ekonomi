# Mobil (RN/Expo) — FAZ 1 notları

**NE:** Bu dosya `mobile/` dizininin kayıt defteri. Ne kuruldu, hangi karar
neden alındı, hangi ölçüm gerçekten yapıldı, bilerek ne yapılmadı.

**NEDEN AYRI DOSYA:** `ELITE_ROADMAP.md` yol haritasıdır ve başka bir ajan
ona yazıyor. Buradaki notlar native kabuğun kendi iç defteri; yol haritasıyla
çakışmaz.

> Ölçülmemiş hiçbir şey bu dosyada "çalışıyor" diye yazmaz. Ölçüm çıktıları
> aşağıda ham hâliyle duruyor.

---

## 1. Şablon ve sürümler (ölçüldü — `package.json`)

Resmî Expo şablonu: TypeScript + expo-router.

| Paket | Sürüm |
|---|---|
| expo | ~57.0.28 |
| react-native | 0.86.3 |
| react | 19.2.3 |
| react-dom | 19.2.3 |
| react-native-web | ~0.21.0 |
| expo-router | ~57.0.26 |
| typescript | ~6.0.3 (dev) |
| @types/react | ~19.2.2 (dev) |
| **@supabase/supabase-js** | **^2.117.3** |

**Elle eklenen TEK bağımlılık `@supabase/supabase-js`.** Geri kalan her şey
şablonun kendi listesi. Görev kuralı buydu: şablon + Supabase, başka hiçbir
paket yok. UI kütüphanesi, ikon paketi, durum yönetimi, grafik kütüphanesi
**kurulmadı** — hiçbiri FAZ 1 için gerekli değildi ve her biri native derleme
yüzeyini büyütür.

### Şablondan gelen, bu fazda KULLANILMAYAN paketler

`@expo/ui`, `expo-glass-effect`, `expo-symbols`, `expo-device`, `expo-image`,
`expo-web-browser`, `expo-font`, `react-native-reanimated` (4.5.1),
`react-native-gesture-handler`, `react-native-screens`,
`react-native-safe-area-context`, `react-native-worklets`.

**NEDEN SİLİNMEDİ:** son dördü expo-router'ın çalışma zamanı bağımlılığı —
kaldırılırsa gezinme kırılır. Diğerleri şablonun `package.json`'ında geldi;
sökmek `expo-doctor`'ın "paketler SDK ile uyumlu" denetimini ve kilit
dosyasını riske atar. Ağırlıkları var ama FAZ 1'de doğrulanmış bir kurulumu
bozmaya değmez. FAZ 2'de gerçekten kullanılmayanlar ölçülerek atılabilir.

---

## 2. Dizin yapısı

```
mobile/
  app.json                  # ad/slug/scheme/tema — koyu, splash #0F1522
  .env.example              # BOŞ değerli örnek — gerçek sır YOK
  MOBIL_NOTLAR.md           # bu dosya
  src/
    app/                    # expo-router kökü (mobile/app/ DEĞİL)
      _layout.tsx           # kök — Slot + tema
      (tabs)/
        _layout.tsx         # 5 sekme
        index.tsx           # Listeler
        bugun.tsx           # Bugün
        kesfet.tsx          # Keşfet
        analiz.tsx          # Analiz + komponent vitrini
        arama.tsx           # Arama
    api/
      types.ts              # motor sözleşmesi tipleri + kesintiSayisi/olcumEksik
      client.ts             # İNCE istemci — hesap YAPMAZ
      supabase.ts           # dürüst "yapılandırılmadı" durumu
    components/             # 7 çekirdek + ScreenShell
      Card / Pill(Badge) / ScoreGauge / TickerRow
      SectorChip / Disclaimer / Skeleton / ScreenShell
    lib/format.ts           # tr-TR biçimlendirme — TEK yer
    theme/                  # colors / typography / layout / signal / index
```

**NEDEN `src/app/` ve `app/` DEĞİL:** `tsconfig.json`'da `@/* → ./src/*`
eşlemesi var; router kökünü de `src/` altına almak "her şey src'de" kuralını
tek istisnasız bırakıyor. expo-router SDK 57 bunu destekliyor (ölçüldü:
5 yolun beşi de tarayıcıda açıldı).

---

## 3. Web → native renk eşlemesi

Yol haritası native için **bilerek farklı** bir palet istedi: web mavi-siyah +
sarı, native mürekkep-lacivert + eski altın. Amaç iki ürünü görsel olarak
ayırmak.

| Rol | Web (`styles.css`) | Native (`src/theme/colors.ts`) | Not |
|---|---|---|---|
| Zemin | `--bg #0a0e1a` | `#0F1522` | daha sıcak mürekkep |
| Zemin yumuşak | `--bg-soft #10162a` | `#141C2C` | |
| Kart | `--bg-card #151b2e` | `#182134` | |
| Yükseltilmiş | — | `#1E293E` | native'e özel (girdi alanı) |
| Kenarlık | `--border #232a44` | `#26314A` | |
| Metin | `--text #ffffff` | `#F3F6FC` | saf beyaz değil — OLED'de göz yormasın |
| Soluk metin | `--text-dim #7a8299` | `#8C96AE` | kontrast için açıldı |
| Altın / vurgu | `--gold #fbbf24` | **`#D4A24E`** | parlak sarı → eski altın |
| Pozitif | `--green #22d39a` | `#3FBF8F` | |
| Negatif | `--red #ff5e7e` | `#EF7060` | pembe-kırmızı → mercan |
| Mor vurgu | `--accent #6366f1` | **yok** | native'de altın tek vurgu rengi |

**NEDEN MOR VURGU TAŞINMADI:** web'de mor (`--accent`) + altın (`--gold`) +
yeşil/kırmızı dört ayrı vurgu demek. Native'de altın tek vurgu; yeşil/mercan
**yalnız yön** taşıyor. Renk sayısını azaltmak, yön renginin anlamını
güçlendiriyor.

### Renk körlüğü kuralı — token düzeyinde zorunlu

`src/theme/signal.ts` içindeki `signalOf()` **tek bir nesne** döndürüyor:
`{ tone, arrow, word, a11yLabel }`. Yani bir yön gösterilecekse renkle
birlikte **ok (▲/▼) ve sözcük** de aynı kaynaktan geliyor; "sadece renk"
kullanmak için fonksiyonun dışına çıkmak gerekir. Kural yoruma değil,
imzaya gömülü.

`Pill` yön taşıyan tonlarda oku **otomatik** ekler; nötr/bilgi rozetlerinde
`glyph={null}` ile kapatılır.

### `tabular-nums` tek yerde

`src/theme/typography.ts` içinde tanımlı; fiyat/yüzde/skor gösteren her
komponent oradan alıyor. Sayılar güncellenirken sütun kaymasın diye.

### Açık tema

`colors.ts` koyu ve açık token setini **aynı yapıda** tutuyor (yukarıdaki
tabloda açık karşılıkları da var). FAZ 1'de uygulama koyuya sabit
(`app.json → userInterfaceStyle: "dark"`), ama açık temayı eklemek token
dosyasında bir anahtar değişimi; komponentlere dokunmak gerekmiyor.

**Komponentlerde sabit kodlanmış hex YOK** — hepsi `useTheme()` üzerinden.

---

## 4. Kararlar ve gerekçeleri

**İstemci İNCE — hesap yapmıyor.** `src/api/client.ts` ham sayı alır, skor
hesaplamaz. Motor tek doğruluk kaynağı (`/api/*`). İstemcide tek bir çarpma
yapılsa `tests/parity.mjs`'in DIFF-0 garantisi sessizce kırılırdı.
Biçimlendirme (`tr-TR`) istemcide, `src/lib/format.ts` içinde — motor
biçimlenmiş alan döndürmüyor.

**"Veri yok" ≠ "ölçemedim".** `src/api/types.ts` bu ayrımı tiplerde
tutuyor: `score:null + why` bir **veri cevabı** (kırmızı hata değil),
`tam:false` / `sayac.*.kesinti>0` ise **ölçülemedi** (`olcumEksik()`).
Vitrinde ikisi de gözle görülüyor: `72/100` dolu ölçer, yanında
`—/100 · ölçülemedi` boş ölçer, `ÖRNEK.C` satırı da ölçülemeyen satır.
Bu ayrım görünür kalmazsa FAZ 2'de ilk kaybolan şey olur.

**İstek kesilirse `kesinti` sayılır.** 45 sn bütçe bir fren, garanti değil;
kesilen/zaman aşımına uğrayan istek "düşük skor" gibi değil, ölçüm eksiği
gibi ele alınıyor.

**Supabase: dürüst "yapılandırılmadı".** Gerçek proje/anahtar yok.
`supabase.ts` ortam değişkeni boşsa **çökmüyor**, `message` alanıyla durumu
söylüyor; Listeler ekranı bu metni olduğu gibi basıyor. Sahte anahtar
**yazılmadı**, hesap **açılmadı**, `.env.local` **oluşturulmadı**.
`.env.example` üç değişkeni **boş** listeliyor ve `service_role`'un neden
asla oraya yazılmayacağını anlatıyor.

**`ScreenShell` = 8. komponent.** Başlık + alt başlık + not + **dipteki
Disclaimer** tek kabukta. Disclaimer'ı her ekrana elle eklemek, bir ekranda
unutulmasıyla biter; kabuk onu yapısal hâle getiriyor. Metin birebir:
`Bilgi amaçlıdır, yatırım tavsiyesi değildir.` (`DISCLAIMER_TEXT` sabiti).

**Sekme çubuğu `expo-router/js-tabs`.** Ölçüldü: SDK 57'de kök
`expo-router`'dan gelen `Tabs` `@deprecated` işaretli. Kök export'ta `Stack`
**yok** (yalnız `Navigator`, `Slot`, `ExperimentalStack`) — bu yüzden kök
düzen `Slot` kullanıyor.

**Sekme ikonları şimdilik emoji.** Vektör ikon paketi kurmak yeni bağımlılık
demekti. Emoji platformlar arası farklı çiziliyor ve bu **geçici** —
FAZ 2/3'te gerçek ikon seti gelmeli.

**Alt bölüm adları tıklanmıyor.** Bugün/Keşfet/Analiz ekranlarındaki bölüm
adları web menüsünden **birebir** alındı ama çerçeve (outline) rozet olarak
duruyorlar; tıklanabilir görünüp hiçbir yere gitmemeleri daha kötü olurdu.

**Arama alanı gerçek ama sorgu göndermiyor.** Klavye/odak/tema davranışını
ölçebilmek için gerçek `TextInput`; metin yerel durumda kalıyor ve ekranda
"hiçbir yere gönderilmiyor" yazıyor. 8 sembol sınırı ekrana elle yazılmadı,
`AZAMI_SEMBOL` sabitinden okunuyor — sözleşme değişirse ekran yalan söylemesin.

**Uydurma veri YOK.** Hiçbir ekranda sahte hisse/fiyat/manşet yok. Vitrindeki
semboller açıkça `ÖRNEK.A/B/C`, kart `ÖRNEK` rozeti taşıyor, iskelet kartlar
`İSKELET` rozeti taşıyor. Sektör çipleri gerçek sektör **adı** taşıyor —
sektör adı bir ölçüm değil, kategori adı; hiçbir sayı/yön iddiası yok.

**Şablon artıkları silindi.** `app/(tabs)/explore.tsx`, şablonun örnek
komponentleri ve `scripts/reset-project.js` kaldırıldı; `package.json`'daki
artık `reset-project` betiği de silindi (dosya yokken çağrılabilir duruyordu).
Şablonun `_layout.tsx`'i `SplashScreen.preventAutoHideAsync()` çağırıyordu:
splash overlay'i silip bu çağrıyı bırakmak uygulamayı splash ekranında
dondururdu — **ikisi birlikte** kaldırıldı.

**`useNativeDriver` web istisnası.** Ölçüldü: react-native-web'de `RCTAnimation`
yok, konsola uyarı basıp JS animasyonuna düşüyordu.
`Skeleton.tsx` artık `Platform.OS !== 'web'` kullanıyor — native'de native
sürücü korunuyor, web'de uyarı yok.

**`ColorValue` düzeltmesi.** Ölçüldü (tsc TS2322): react-navigation
`tabBarIcon` geri çağrısına `string` değil `ColorValue` veriyor. `TabIcon`
prop tipi düzeltildi.

---

## 5. Ölçüm çıktıları (ham)

### `npx tsc --noEmit`

```
$ cd mobile && npx tsc --noEmit
(çıktı yok)
exit=0
```

**Temiz.** (İlk koşuda `src/app/(tabs)/_layout.tsx` içinde 5 adet TS2322
vardı — `ColorValue` düzeltmesiyle kapandı.)

### `npx expo-doctor`

```
Running 21 checks on your project...
Unexpected error while running 'Check Expo config (app.json/ app.config.js) schema' check:
TypeError: fetch failed
ConnectTimeoutError: Connect Timeout Error (attempted address: exp.host:443, timeout: 10000ms)
This check requires a connection to the Expo API. Ensure your network connection is stable.
19/21 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.

✖ Check Expo config (app.json/ app.config.js) schema
✖ Validate packages against React Native Directory package metadata
Directory check failed with unexpected server response

2 checks failed, indicating possible issues with the project.
exit=1
```

**Bu iki başarısızlık AĞ kaynaklı, proje kusuru değil** — ikisi de Expo
sunucusuna bağlanmayı gerektiriyor. Kanıt: daha önceki bir koşuda ağ
eriştiğinde **20/21** geçmişti ve tek düşen "React Native Directory" denetimi
olmuştu (o da `Directory check failed with unexpected server response`).
Yani config şeması denetimi ağ varken **geçiyor**.

Yerel (ağsız) 19 denetimin **hepsi geçiyor** — aralarında: paketlerin yüklü
Expo SDK sürümüyle uyumu, zorunlu eş bağımlılıkların kurulu olması, çift
bağımlılık olmaması, kilit dosyası, uygulama mağazası sürüm gereksinimleri.

### Görsel doğrulama (tarayıcı)

`.claude/launch.json` → `mobil-web` yapılandırması (`npm --prefix mobile run web`,
port 8081), `preview_start` ile açıldı. **Bash ile dev server başlatılmadı.**

Ölçülen:

- 5 sekme de açılıyor: `/`, `/bugun`, `/kesfet`, `/analiz`, `/arama`.
- Sekme sırası web'le birebir: **Listeler · Bugün · Keşfet · Analiz · Arama**.
- Sekme çubuğundan tıklama gezindiriyor (Listeler sekmesine tıklandı, URL `/` oldu).
- Vitrinde **7 komponentin hepsi** gözle görülüyor (Analiz sekmesi).
- `tr-TR` biçimlendirme doğru: `$182,40`, `₺61,85`, `+2,14%`, `−1,37%`
  (U+2212 eksi), boş değerde `—`.
- Koyu zemin, altın aktif sekme etiketi, `İSKELET`/`ÖRNEK` rozetleri,
  her ekranın dibinde Disclaimer — hepsi yerinde.
- `read_console_messages`: **hata YOK**. 7 uygulama yüklemesi boyunca tek
  uyarı, düzeltme öncesi ilk yüklemeden kalan `useNativeDriver` uyarısı.
- `resize_window` ile 375×812 (mobil) ve pano genişliği (desktop) denendi;
  düzen ikisinde de bozulmuyor.

**Simülatör/emülatör çalıştırılmadı, iOS/Android derlemesi denenmedi.**
Yani yukarıdaki her şey **react-native-web** üzerinde ölçüldü. Native
hedeflerde doğrulanmış değil.

---

## 6. BİLEREK yapılmayanlar

- **Veri bağlama yok.** Hiçbir ekran `/api/*`'e istek atmıyor. `client.ts`
  hazır ama çağrılmıyor — FAZ 2'nin işi.
- **iOS/Android derlemesi yok.** Simülatör/emülatör çalıştırılmadı; `ios/`
  ve `android/` dizinleri yok (CNG üretir, `.gitignore`'da).
- **Kimlik doğrulama yok.** Supabase istemcisi var, oturum akışı yok.
- **`expo lint` koşulmadı.** `mobile/` altında eslint yapılandırması **yok**
  (şablonun `lint` betiği var ama config yok). Koşmak eslint bağımlılıklarını
  kurup config yazardı — "yalnız şablon + Supabase" kuralını delerdi.
- **Uygulama ikonu/splash görseli hâlâ Expo şablonunun sanatı.**
  `app.json`'da ad/slug/scheme/tema ve splash **arka plan rengi** (`#0F1522`)
  değiştirildi; Android `adaptiveIcon.backgroundColor` şablon değerinde
  (`#E6F4FE`) kaldı. Gerçek marka görselleri üretilmedi.
- **Özel yazı tipi yok.** Sistem yazı tipi kullanılıyor (2 ağırlık:
  normal/kalın). Yazı tipi dosyası eklemek paket boyutu ve yükleme durumu
  demek; FAZ 1 için gereksiz.
- **Test yok.** Native tarafta test altyapısı kurulmadı.
- **Diğer ajanın şeridine girilmedi:** `api/`, `tests/`, `tools/`, `worker/`,
  `app.js`, `index.html`, `styles.css`, `config.js`, kök `package.json`,
  `vercel.json`, `ELITE_ROADMAP.md` **okundu, değiştirilmedi**.
  `tests/parity.mjs` ve diğer motor testleri **koşulmadı**.

---

## 7. Depo hijyeni

- `.vercelignore` → `mobile/` eklendi. Native uygulama ayrı ürün; Vercel
  yalnız web PWA + `/api` motorunu yayınlıyor, `mobile/` altındaki hiçbir
  dosya tarayıcıya servis edilmiyor.
- `.gitignore` → `mobile/.expo/`, `mobile/dist/`, `mobile/web-build/`,
  `mobile/ios/`, `mobile/android/`, `mobile/expo-env.d.ts`, `*.tsbuildinfo`,
  `.env.local`, `.env*.local`. (`mobile/.gitignore` zaten çoğunu kapsıyor;
  kök dosyada da olmaları kökten çalışan araçlar için.)
- `node_modules/` zaten depo genelinde yok sayılıyordu — **doğrulandı**.
- `.claude/launch.json` → mevcut `day-starter` yapılandırmasının yanına
  `mobil-web` eklendi (port 8081).

---

## 8. Sıradaki adım (FAZ 2 önerisi)

1. `client.ts`'i gerçekten çağır: Arama → `/api/score` → Listeler.
   Üç durumu da ekranda ayrı göster: **veri var**, **veri yok (`why`)**,
   **ölçülemedi (`kesinti`)**.
2. Listeler'i kalıcı hâle getir (Supabase ya da yerel depolama) — web'deki
   listeler buluta senkron değil, native'de bu düzeltilebilir.
3. Sekme ikonlarını emojiden gerçek vektör sete geçir.
4. Gerçek uygulama ikonu + splash görseli.
5. Kullanılmayan şablon paketlerini **ölçerek** ayıkla.
6. İlk native derleme (EAS) — `app.json` paket adları/sürümleri o zaman
   gerçek değer alır.
