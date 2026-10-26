# Sabah Bülteni — mobil (Expo / React Native)

Bu dizin ürünün kendisi: iPhone uygulaması. Depo kökündeki web sürümü
(`index.html`, `app.js`, `styles.css`) bir **geliştirme laboratuvarı** —
motor uçlarını tarayıcıda hızlı denemek için duruyor, yayınlanacak olan
bu dizin.

> Bu dosyadaki her satır okunarak yazıldı: `package.json`, `app.json`,
> `tsconfig.json`, `eslint.config.js`, `eas.json`, `.env.example`,
> `src/` ağacı ve `../.claude/launch.json`. Ölçülmeyen şey aşağıda
> "çalışıyor" diye geçmiyor; ölçülmeyenler **Dürüst eksikler**
> bölümünde ayrıca yazılı.

Daha ayrıntılı karar defteri: [`MOBIL_NOTLAR.md`](./MOBIL_NOTLAR.md).
Ajanlar için çalışma kuralları: [`AGENTS.md`](./AGENTS.md).

---

## 1. Uygulama ne yapar

Takip ettiğiniz hisseler için kamuya açık kaynaklardan derlenen **teknik
ve temel ölçümleri tek ekranda** gösterir. Skorlar, bantlar, sıralamalar
ve plan seviyeleri sunucudaki motor uçlarından (`/api/*`) gelir;
uygulama bunları okur, `tr-TR` biçimine sokar ve çizer.

Bilgi amaçlıdır, yatırım tavsiyesi değildir.

---

## 2. Mimari kural — üç cümle, istisnası yok

**1) Ekranlar ister, komponentler çizer.**
Veri çağrısı `src/app/` altındaki ekranda yapılır; `src/components/`
altındaki hiçbir komponent kendi verisini çekmez, satırları `prop`
olarak alır. Ölçüldü: `src/components/` altında tek bir `fetch` yok.
Nedeni `kesfet.tsx` başlığında yazılı — üç kart kendi isteğini atsa aynı
tur için üç istek ödenir ve üç kart birbirinden farklı üç anlık görüntü
gösterebilir.

**2) `fetch` yalnız `src/api` içinde.**
Ölçüldü: `src/` ağacının tamamında `fetch(` yalnız **bir** yerde geçiyor
— `src/api/client.ts:300`. Ekranlar `@/api` paketinden içe aktarır
(`src/api/index.ts` tek giriş noktası). Taban adres, zaman aşımı,
önbellek ya da yetkilendirme değişirse değişen dosya `client.ts` olur,
beş ekran değil.

**3) Native'de HİÇBİR skor / eşik / formül hesabı yok.**
Her sayı uçtan gelir. `client.ts` başlığında yazdığı gibi bu dosya
"skor HESAPLAMAZ, eşik UYGULAMAZ, bant KARARI vermez". Ekranlarda da
`sort`, ağırlıklı toplam, yuvarlama ya da eşik tablosu yok:
`analiz.tsx` başlığı bunu tek tek sayıyor (skor10 uçtan gelir,
`blendedShown` motorun gösterdiği tam sayıdır, `breakdown` ağırlıkları
yalnız gösterilir — çarpılıp toplanmaz). Tek istisna **biçimlendirme**:
`src/lib/format.ts` ham sayıyı `tr-TR` metnine çevirir, türetmez.

Bu kuralın karşılığı somut: bir satır matematik istemciye girdiği an web
ile native iki ayrı skor üretmeye başlar ve ikisi ilk farklı veriye kadar
aynı görünür, sonra sessizce ayrılır.

Dördüncü bir kural, dürüstlük çıpası: **"veri yok" ≠ "ölçemedim".**
`src/api/client.ts` hatayı `no-data` · `unmeasured` · `bad-request` ·
`canceled` diye ayırıyor; `src/api/istek.ts` ekrana `bos` ·
`yukleniyor` · `hata` · `veri` durumlarından birini veriyor ve iptali
hata saymıyor. Ölçülemeyen bir kriter ekranda "nötr/dengeli"
gösterilmez.

---

## 3. Dizin yapısı (ölçüldü)

```
mobile/
  app.json            # Expo yapılandırması
  eas.json            # EAS derleme profilleri
  tsconfig.json       # strict: true, @/* -> ./src/*
  eslint.config.js    # eslint-config-expo/flat
  .env.example        # BOŞ değerli örnek — gerçek sır yok
  assets/images/      # icon, splash-icon, favicon
  scripts/ikon-uret.mjs
  tests/              # Node birim testleri (format + liste)
  src/
    app/                      # expo-router kökü (mobile/app/ DEĞİL)
      _layout.tsx             # kök düzen + tema
      (tabs)/_layout.tsx      # 5 sekme
      (tabs)/index.tsx        # Listeler
      (tabs)/bugun.tsx        # Bugün
      (tabs)/kesfet.tsx       # Keşfet
      (tabs)/analiz.tsx       # Analiz
      (tabs)/arama.tsx        # Arama
      hisse/[sembol].tsx      # hisse detay — paylaşılabilir adres
    api/            # ağ katmanı — aşağıda ayrı bölüm
    components/     # 12 çekirdek + analiz/ (3) + detay/ (5) + kesfet/ (4)
    lib/
      format.ts     # tr-TR biçimlendirme — TEK yer
      kalici.ts     # AsyncStorage; web'le aynı `sb:lists` anahtarı
    theme/          # colors / typography / layout / signal / index
```

Router kökü neden `src/app/`: `tsconfig.json`'daki `@/* → ./src/*`
eşlemesi "her şey `src`'de" kuralını istisnasız bırakıyor.

### `src/components/` neden böyle bölündü

`components/` kökündeki 12 dosya ekrandan bağımsız çekirdek
(`Card`, `Pill`, `ScoreGauge`, `TickerRow`, `SectorChip`, `Disclaimer`,
`Skeleton`, `ScreenShell`, `Dugme`, `Durum`, `FiyatGrafigi`, `TabIkon`);
alt klasörler tek ekrana ait kartlar (`analiz/`, `detay/`, `kesfet/`) ve
her birinin kendi `index.ts` dışa açımı var.

`ScreenShell` zorunlu yasal uyarıyı (`Disclaimer`) ekranın altına kendisi
basar — ekranlar elle yerleştirmez, yoksa uyarı metni değiştiğinde yedi
yeri aynı tutma borcu doğar.

`theme/signal.ts` içindeki `signalOf()` tek nesne döndürür:
`{ tone, arrow, word, a11yLabel }`. Yön gösterilecekse renkle birlikte
ok ve sözcük **aynı kaynaktan** gelir; "sadece renk" kullanmak için
fonksiyonun dışına çıkmak gerekir. Renk körlüğü kuralı yoruma değil,
imzaya gömülü.

---

## 4. `src/api/` — istemci katmanı (ölçüldü)

| Dosya | İşi |
|---|---|
| `index.ts` | Ekranların **tek** içe aktarma noktası (`@/api`). |
| `client.ts` | İnce `fetch` sarmalayıcısı: zaman aşımı, iptal, hata ayrımı. Tek `fetch` burada. |
| `types.ts` | Uç sözleşmesi tipleri + `kesintiSayisi` / `olcumEksik` yardımcıları. |
| `istek.ts` | `useIstek` kancası — dört ekran durumunu tek yerde tutar. |
| `liste.ts` | Takip listesi deposu (`useSyncExternalStore`), sekmeler arası tek kaynak. |
| `yfin.ts` | Yahoo künyesi (yaklaşan bilanço + temettü oranı) — skor zincirinin **dışında**, kendi sembol sınırı ve bütçesi var. |
| `supabase.ts` | Bulut senkron bağlantı noktası. Anahtar yoksa istemci kurulmaz, `null` döner. |

Çağrılan uçlar (`client.ts` içinde sabit listede): `/api/score`,
`/api/recommend`, `/api/analyze`, `/api/theme`, `/api/causal`,
`/api/compare`, `/api/yfin`, `/api/watchlist`, `/api/chart`,
`/api/news`, `/api/pulse`.

Sözleşme iç içe: **score ⊂ recommend ⊂ analyze**. Bu yüzden detay ekranı
beş kart için beş istek atmaz, tek `fetchAnalyze` turu yapar — aksi hâlde
kartlar farklı turlardan beslenip birbiriyle çelişir.

Taban adres `EXPO_PUBLIC_API_URL`; boşsa koddaki varsayılan
(`https://day-starter.vercel.app`) kullanılır. `eas.json`'daki üç profil
(`development` · `preview` · `production`) de bu değeri aynı adrese
ayarlıyor.

`supabase.ts` modül yüklenirken `throw` **etmiyor**: senkron ürünün
çekirdeği değil, skorlar motordan geliyor. Anahtar yokken uygulama yerel
verilerle çalışmaya devam eder, ekran "senkron kapalı" der.

---

## 5. Beş sekme

Sıra ve adlar web'deki üst menüden aynen alındı, değişmedi:

| # | Sekme | Hangi uç | Ne gösterir |
|---|---|---|---|
| 1 | **Listeler** | `/api/recommend` | Takip listesi: fiyat, bileşke skor, motorun bandı, alım bandına yakınlık. |
| 2 | **Bugün** | `/api/compare` + `/api/pulse` | Listenin tek turda kıyası (sıra uçtan gelir) ve ⚡ Makro Nabız. |
| 3 | **Keşfet** | `/api/recommend` + `/api/news` | Tek tur, üç yüzey: 🌍 Radar · 🔥 Fırsatlar · 🔎 Tarama; ayrıca gündem. |
| 4 | **Analiz** | `/api/analyze` + `/api/chart` | Tek sembol derin dalış: TA + FA + bileşke + üç direk + plan seviyeleri; fiyat grafiği ayrı uçtan. |
| 5 | **Arama** | `/api/recommend` + `/api/theme` + `/api/news` | Sembol ölç ve listeye ekle; 🔭 tema ara + temanın manşetleri. |

Artı: `hisse/[sembol]` detay rotası (sekme değil). Paylaşılabilir bir
adres (`/hisse/AAPL`) olması gerekiyordu; sekme olsaydı derin bağlantı
sekme durumuna bağlı kalırdı.

Neden sıra birebir: kullanıcı aynı işi web'de 3. sekmede yapıyorsa
telefonda da 3. sekmede yapmalı. Sıra değişirse kas hafızası bozulur.

---

## 6. Nasıl çalıştırılır

**`npm install` çalıştırma.** Nedeni: bağımlılıklar `node_modules`
içinde kurulu ve `package-lock.json` ile kilitli, Expo SDK 57 sürüm
uyumu doğrulanmış durumda. Düz `npm install`/`npm i <paket>` Expo'nun
SDK uyum çözücüsünü atlar ve kilit dosyasını değiştirir; doğrulanmış
kurulumu bozar. Paket gerçekten gerekliyse doğru yol
`npx expo install <paket>`, ve o kararın gerekçesi `MOBIL_NOTLAR.md`'ye
yazılır.

### Web laboratuvarı (günlük geliştirme)

```bash
npm --prefix mobile run web     # => expo start --web, port 8081
```

Depo kökünden `.claude/launch.json` içindeki **`mobil-web`** yapılandırması
aynı komutu çalıştırıyor (port 8081).

> **DİKKAT — bu makinede `localhost` çözülmüyor.** Tarayıcıda
> `http://127.0.0.1:8081` yaz. `http://localhost:8081` açılmaz; bu bir
> uygulama hatası değil, bu makinenin ad çözümlemesi.

Aynı dosyadaki diğer iki yapılandırma web lab'ına ait, mobil uygulamayla
ilgisi yok: `day-starter` (`python -m http.server 8000`, port 8000) ve
`web-lab-127` (port 4173, `http://127.0.0.1:4173`).

### iOS

```bash
npm --prefix mobile run ios     # => expo start --ios
```

Bu komut hiçbir gerçek cihazda denenmedi (bkz. Dürüst eksikler).

---

## 7. Tip denetimi, test ve lint

### Tip denetimi

```bash
cd mobile
node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
```

> **UYARI: depo kökünden `npx tsc` ÇALIŞMAZ.** Kökte TypeScript kurulu
> olmadığı için `npx` paketi **indirmeye** kalkar ve yanlış/başka bir
> sürümü kurar; sonuç ya anlamsız hatalar ya da sessizce farklı bir
> derleyiciyle yapılmış bir denetim olur. Yukarıdaki komut `mobile/`
> içinde kurulu derleyiciyi **doğrudan** çağırır — ölçüldü:
> `mobile/node_modules/typescript` sürümü **6.0.3**
> (`package.json` → `typescript: ~6.0.3`).

`tsconfig.json`'da `strict: true` açık ve `.expo/types/**/*.ts` dahil —
`app.json`'daki `experiments.typedRoutes` sayesinde rota adları da tip
denetiminden geçiyor.

### Test

```bash
npm --prefix mobile run test
```

Ölçüldü: `mobile/tests/` altında Node'un kendi koşucusuyla çalışan iki
birim testi var — `format-test.mjs` (biçimlendirme) ve `liste-test.mjs`
(takip listesi deposu), yanlarında kendi yardımcıları
(`cozucu.mjs`, `cozucu-kanca.mjs`, `sahte-depo.mjs`, `yardim.mjs`).
Jest **kurulu değil**; ekran ve komponent testi **yok** (bkz. Dürüst
eksikler).

### Lint

```bash
npm --prefix mobile run lint    # => expo lint
```

`eslint.config.js`, `eslint-config-expo/flat` yapılandırmasını kullanıyor
ve `dist/*` yok sayılıyor.

İkisi de iş bitti demeden önce koşturulur.

---

## 8. `app.json` — ölçülen değerler

| Alan | Değer |
|---|---|
| `name` | Sabah Bülteni |
| `slug` | sabah-bulteni |
| `version` | 1.0.0 |
| `orientation` | portrait |
| `scheme` | sabahbulteni |
| `userInterfaceStyle` | dark |
| `ios.bundleIdentifier` | `com.sabahbulteni.app` |
| `ios.supportsTablet` | `false` |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption` | `false` |
| `plugins` | `expo-router`, `expo-splash-screen` (zemin `#0F1522`, ikon genişliği 220) |
| `experiments` | `typedRoutes: true`, `reactCompiler: true` |
| `owner` | atahanpharma |
| `extra.eas.projectId` | `16f82fc4-29d8-4af5-8f27-c626974ec70b` |

`ios/` dizini yok ve **olmamalı** — sürekli native üretim (CNG) ile
derleme anında oluşuyor. Native davranış elle değil, `app.json` ve
yapılandırma eklentileriyle ayarlanır.

Mağaza metinleri, ekran görüntüsü ölçüleri ve Apple panelinde elle
yapılacak adımlar depo kökündeki [`magaza/`](../magaza/) klasöründe.

---

## 9. Ortam değişkenleri

`.env.example` boş değerlerle depoda; gerçek değerler
`mobile/.env.local` dosyasına yazılır ve o dosya `.gitignore`'da
(`.env*.local`).

| Değişken | Ne için |
|---|---|
| `EXPO_PUBLIC_API_URL` | Motor tabanı. Boşsa varsayılan `https://day-starter.vercel.app`. |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase proje adresi. **Boş.** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase ANON anahtarı. **Boş.** |

Expo yalnız `EXPO_PUBLIC_` önekli değişkenleri istemci paketine gömer —
yani burada "gizli" bir anahtar tutmak zaten mümkün değil. Supabase
`service_role` anahtarı bu dosyaya **asla** yazılmaz: istemci paketine
girdiği an RLS atlanır ve veritabanı herkese açılır.

---

## 10. Dürüst eksikler

Bunlar bilinen ve kapatılmamış açıklar. Hiçbiri "sonra yazarız" diye
gizlenmedi:

- **Hiçbir gerçek iOS cihazında denenmedi.** Bugüne kadarki tüm
  doğrulama web laboratuvarında (tarayıcı, `react-native-web`) ve tip
  denetimiyle yapıldı. Gerçek iPhone'da dokunma hedefleri, güvenli alan,
  kaydırma performansı ve sekme çubuğu davranışı **ölçülmedi**.
- **Test kapsamı iki modülle sınırlı.** Ölçüldü: `mobile/tests/` altında
  yalnız `format-test.mjs` ve `liste-test.mjs` var. Yani `src/lib/format.ts`
  ve `src/api/liste.ts` testli; **ekranların, komponentlerin ve
  `src/api/client.ts`'in davranış testi yok.** Jest kurulu değil, render
  testi hiç yok. Beş ekranın hiçbiri otomatik olarak doğrulanmıyor —
  regresyon ağı o yüzde için hâlâ tip denetimi + lint. (Depo kökündeki
  `tests/` motorun kendi testleri, bu dizinin değil.)
- **`expo-haptics` kurulu değil.** Ölçüldü: `package.json`'da yok,
  `node_modules/expo-haptics` yok. Dokunsal geri bildirim hiçbir
  etkileşimde yok.
- **Supabase anahtarları yok.** Proje açılmadı; `isSupabaseConfigured`
  `false`. Listeler yalnız cihazda (`AsyncStorage`) tutuluyor, cihazlar
  arası senkron **çalışmıyor** ve ekran bunu açıkça yazıyor.
- **Öne çıkan sektör ucu yok.** Ölçüldü: motor uçları arasında sektör
  ucu bulunmuyor. Konjonktür fazının ucu var ama girdisi yok
  (`genislik` / `enflasyonBaskisi` / `risk` sayılarını ölçen kaynak bu
  uygulamada yok) — uç `konjonktur: null` döndürüyor, kart bunu
  söylüyor. Uydurma sayı göndermek tam olarak yasak olan şey.
- **Tema keşfi sunucu anahtarı bekliyor.** `/api/theme` üretimde
  `{"candidates":[],"error":"no_key"}` döndürüyor; ekran boş listeyi
  "sonuç yok" diye değil "ölçemedim" diye gösteriyor.
- **Haber ↔ hisse ilişkisi uçtan gelmiyor.** Hiçbir uç "bu manşet şu
  hisseyi destekliyor" bilgisini vermiyor; başlık metninde sembol aramak
  istemcide hesap olurdu. Kart eşleşme **iddia etmiyor**.

---

Bilgi amaçlıdır, yatırım tavsiyesi değildir.
