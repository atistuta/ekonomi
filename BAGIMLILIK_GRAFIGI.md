# Bağımlılık Grafiği — motor ne kadar gerçekten ekrana bağlı?

> FAZ 1 / Adım 2 çıktısı · 2026-10-11 · kaynak `app.js` (12.707 satır, v95)
> **Bu ölçüm hiçbir skoru değiştirmez** — `app.js`'e dokunulmadı, yalnız okundu.
> [MOTOR_ENVANTER.md](MOTOR_ENVANTER.md) "ne var" sorusunu yanıtladı; bu belge
> "**ne neye bağlı**" sorusunu yanıtlar ve envanterin bir yanlışını düzeltir.

---

## Yöntem

483 modül-kapsamı fonksiyonun gövdesi tarandı; gövdede `isim(` biçiminde geçen ve
bilinen bir fonksiyon adına denk gelen her çağrı bir kenar sayıldı.

- **Düğüm:** 483 (motor 223 · gizli sunum 40 · ağ 17 · DOM 203)
- **Kenar:** 977 çağrı ilişkisi

**Dürüst sınırlar:** (1) iç içe tanımlı aynı adlı fonksiyon gölgelemesi ayrıştırılmadı;
(2) `obj[isim]()` gibi dinamik çağrılar yakalanmaz; (3) bir ismin yorum satırında veya
dizgi içinde geçmesi de kenar sayılabilir. Yani grafik **fazla bağlantı gösterme**
yönünde hata yapar — bulduğu bağımlılık sayısı gerçek üst sınırdır, alt sınır değil.

---

## 1. En önemli bulgu: "DOM" ≠ "ekran"

Envanterde 203 fonksiyon "DOM'a bağlı" diye işaretlenmişti, çünkü tarama
`localStorage`'ı da `window.`'u da DOM göstergesi sayıyordu. Grafik, motorun bu
203'ten yalnız **30'unu** çağırdığını, o 30'un da üç ayrı türde olduğunu gösteriyor:

| Tür | Adet | Ne demek | Sunucuda ne olur |
|---|---|---|---|
| **depolama** | 13 | `localStorage` okur/yazar (`loadLists`, `cacheGet`/`cacheSet`, `loadBasket`, `loadCompare`, `yahooSym`, …) | KV cache + istek gövdesi |
| **ekran** | 13 | gerçekten çizer (`renderBasket`, `openStockPage`, `taForceChartRepaint`, …) | native yeniden yazılır |
| **diğer** | 4 | `window.*` yapılandırma okur (`computeVadeScore`, `secGet`, `ensureBenchDaily`, `getTaScoreFor`) | sunucu sabiti |

Yani **motorun ekrana bağlılığı sanıldığından çok daha az.** 263 motor
fonksiyonundan 229'u hiçbir çizim fonksiyonuna ulaşmıyor.

### Envanterin düzeltilmesi

MOTOR_ENVANTER.md `computeVadeScore`'u "sınır vakası, DOM'a bağlı olabilir" diye
işaretlemişti. **Yanlıştı.** `computeVadeScore` (153 satır, `app.js:1165`) hiçbir DOM
API'si kullanmıyor; ilk satırında `window.TA_WEIGHTS` okuyor — tarama bunu
`window.` olduğu için DOM saydı. Aynı durum `secGet` (`window.MY_PROXY`),
`ensureBenchDaily` ve `getTaScoreFor` (`window.TA_BENCHMARK`) için de geçerli.

**Gerçek sınır DOM değil, iki şey:** *yapılandırma enjeksiyonu* ve *ağ erişimi*.
İkisi de sunucu tarafında zaten çözülmüş problemler.

---

## 2. Üç arayüzü çevirin, motor serbest kalır

Motorun ekrana bağlı görünmesinin baskın nedeni üç küçük yardımcı fonksiyon:

| Fonksiyon | Satır | Ne yapıyor | Sunucu karşılığı | Kaç motor fn kilitli |
|---|---|---|---|---|
| `setDiag` | 7 (`:77`) | tanı çubuğundaki ✓/✗ etiketini boyar | kayıt (log) ya da no-op | 11 |
| `parseRSS` | 25 (`:164`) | `DOMParser` ile RSS/Atom XML ayrıştırır | XML ayrıştırıcı | 8 |
| `parseForm4` | 25 (`:4664`) | `DOMParser` ile SEC Form 4 XML'i ayrıştırır | aynı ayrıştırıcı | 1 |

Üçü çevrildiğinde tablo şöyle oluyor:

| | fonksiyon | satır |
|---|---|---|
| **Taşınabilir motor** | **254** | **4.579** |
| Ekrana bağlı kalan | 9 | 94 |

### Ekrana bağlı kalan 9 fonksiyonun tamamı

```
 22  removeBasketHolding    :2990  -> renderBasket
 18  updateBuyZonePrimitive :3725  -> taForceChartRepaint
 16  updateSRZonesPrimitive :3793  -> taForceChartRepaint
 16  setTAIndVisible        :3809  -> taForceChartRepaint
  7  onPortfolioChanged     :1586  -> renderPortfolio
  6  openResolved           :7928  -> openMetalPage
  4  cashEditById           :3093  -> cashOpen
  4  initCompare           :12269  -> renderCompare
  1  applyTAIndVis          :3825  -> taForceChartRepaint
```

Dikkat: bu dokuzunun **hiçbiri skor hesaplamıyor.** Hepsi kullanıcı eylemi —
sepetten kalem sil, grafik göstergesini aç/kapat, portföy değişti bildir, sayfa aç.
Envanterde "motor" kümesine düşmüşlerdi çünkü kendi gövdelerinde DOM yok, yalnız
bir çizim fonksiyonu çağırıyorlar. **Bunlar motor değil, native tarafta
yeniden yazılacak arayüz eylemleridir.** Motor tarafına taşınacak hiçbir şey
ekrana bağlı değil.

---

## 3. `/api/score` tam olarak ne içeriyor (eyleme geçirilebilir çıktı)

Her uç için kök fonksiyondan başlayıp çağrı kapanışı hesaplandı — yani uca
kopyalanması gereken fonksiyon kümesi.

| Uç / kök | kapanış | satır | kalan sorun |
|---|---|---|---|
| TA · `computeVadeScore` | 23 fn | 660 | `window.TA_WEIGHTS` |
| FA bileşke · `computeHolisticScore` | 2 fn | 97 | **yok — tamamen temiz** |
| FA BIST · `bistFundamentalModel` | 6 fn | 148 | **yok — tamamen temiz** |
| FA ABD · `secFetchModel` | 14 fn | 274 | `secGet` (ağ) |
| **`/api/score` toplam** | **52 fn** | **1.307** | 5 adlı arayüz |

**Bütün skor motoru 1.307 satır.** `app.js`'in %10'u. Geri kalan 11.400 satır
ekran, durum yönetimi ve veri toplama.

Aynı yöntemle diğer uçlar:

| Uç | kapanış | satır | not |
|---|---|---|---|
| `/api/compare` | 84 fn | 1.952 | skoru içeriyor (`computeVadeScore` dahil) → `/api/score`'u yeniden kullanır |
| `/api/causal` | 22 fn | 402 | `cacheGet`/`cacheSet` → KV, `loadLists` → istek gövdesi |

---

## 4. Taşıma sözleşmesi (5 arayüz, hepsi bu)

Motoru sunucuya almak için yazılması gereken **tek şey** bu beş arayüzün sunucu
karşılığı. Motor kodunun kendisi olduğu gibi kopyalanır.

| İstemci dünyası | Sunucu karşılığı | Neden |
|---|---|---|
| `window.TA_WEIGHTS`, `window.TA_BENCHMARK` | sunucu sabiti (tek doğruluk kaynağı) | serverless'ta `window` yok; ağırlıklar motorun gizli sosu |
| `proxy()`, `secGet()`, `window.MY_PROXY` | doğrudan `fetch` | sunucuda CORS yok → üç üçüncü-parti proxy tamamen gereksizleşir |
| `cacheGet` / `cacheSet` (localStorage) | Vercel KV | paylaşımlı cache, kullanıcı başına değil |
| `loadLists` / `loadBasket` / `loadCompare` | istek gövdesi (sonra Supabase) | liste kullanıcı verisi, motor girdisi değil |
| `setDiag`, `parseRSS`, `parseForm4` | logger + XML ayrıştırıcı | tarayıcı API'si yerine sunucu eşdeğeri |

---

## 5. Parite testi sırasında ölçülen ek bağımlılıklar

§4'teki beş arayüz, taşıma için **yazılması gereken** kısım. Aşağıdaki dört nokta ise
taşıma sırasında **sessizce bozulması en kolay** yerler. Okuyarak değil, ölçülerek
bulundular: skor paritesi testi (`tests/`) yazılırken motor Node içinde gerçekten
koşturuldu ve her biri bir hata olarak yüzeye çıktı.

### 5.1 Temel model kurucuları ekran biçimlendiricilerine bağlı

| Model kurucu | Çağırdığı biçimlendirici | Tanım | Tüketim |
|---|---|---|---|
| `secFetchModel` (ABD) | `fmtUSD` | `app.js:4523` | `app.js:6160` |
| `bistFundamentalModel` (BIST) | `fmtTRY` | `app.js:85` | `app.js:5818` |

Kurucular NOT metinlerini bu fonksiyonlarla kuruyor. Biçimlendiriciler skora
**girmiyor**, ama yoklarsa model hiç kurulamıyor — ölçüldü: `secFetchModel`
`fmtUSD is not defined` ile patlıyor.

→ **`/api/score` ham sayı döndürmeli.** `tr-TR` / `en-US` biçimlendirmesi istemcide
kalır. Sunucu `Intl` çıktısı döndürürse para birimi ve ondalık ayracı sunucunun
yerel ayarına kilitlenir; mobil istemci bunu bir daha düzeltemez.

### 5.2 Üç sabit, üç kopya — tekilleştirilmeden taşınmamalı

| Sabit | Değer | Kopyalar |
|---|---|---|
| Değerleme (F/K) kriteri | `weight: 0.10` + bant eşikleri | `app.js:5648`, `:7449`, `:11876` (yalnız ABD; BIST'te yok) |
| Bileşke harmanı | `0.55 * fa + 0.45 * ta` | `app.js:4781`, `:5256`, `:12023` (sonuncusu `const` olmadan) |
| Bileşke direkleri | `0.40` FA · `0.30` TA · `0.30` değerleme | `app.js:5139-5141` |

Üç kopyadan ikisini taşıyıp birini ekranda bırakmak, aynı hissenin iki ekranda iki
farklı skor göstermesi demektir. Üstelik `blended` kullanıcıya **yuvarlanarak**
gösterildiği için (`Math.round`) böyle bir sapma haftalarca görünmeyebilir —
parite testi tam hassasiyetli `blended`'ı bu yüzden ayrıca donduruyor.

### 5.3 `computeHolisticScore` → `buildGrowthNote`

Holistik skorlayıcı büyüme notu sınıflandırıcısını (`app.js:5159`) çağırıyor ve
`growthNote.cls` doğrudan değerleme direğinin yumuşatmasına giriyor. İkisi
**birlikte** taşınmak zorunda; ayrılırsa "pahalı ama hızlı büyüyor" muafiyeti
sessizce kaybolur ve her büyüme hissesi değerlemeden ceza yemeye başlar.

### 5.4 `secGet` istisnayı `null`'a yutuyor

Ölçüldü: gerçekten olmayan bir us-gaap etiketi SEC'ten temiz **404** döner. Yani 404
bir **veri cevabıdır**, taşıma hatası değil. `secGet` ise ikisini de `null` yapıyor.

→ Taşınan sunucu işlevi **404'ü ağ hatasından açıkça ayırmak zorunda.** Yoksa bir SEC
kesintisi "bu şirkette o kalem yok" diye okunur ve skor sessizce eksik veriyle
hesaplanır. (Aynı sebeple `tests/capture.mjs` dolu fikstürleri atlar ama `null`
kayıtları her koşuda yeniden sorar.)

### Satır sayısı: 1.307 mi, 1.405 mi?

İkisi de doğru — farklı şeyi ölçüyorlar:

- **1.307 satır / 52 fn** (§3) = `/api/score`'un **çağrı kapanışı**: motor
  fonksiyonlarının kendisi. Taşımada hedef bu.
- **1.405 satır / 9 dilim** (`tests/engine.mjs`) = motoru Node'da **koşturmak için**
  kesilmesi gereken bitişik kaynak blokları; §5.1'deki biçimlendiriciler ve dilim
  içinde kalan komşu satırlar da dahil. Yani "bu kadarını kesmeden motor çalışmıyor"
  sınırı.

---

## 6. Sonraki iş

1. ~~Metin biçimi kararı~~ → **TAMAM** (2026-10-11). Karar: motor HTML değil
   **belirteç dizisi** döndürür ve biçim etiket adı değil **rol** taşır
   (`v` vurgu / `e` etiket / `s` sayı / `d` soluk / `i` italik / `br`). Kanıt:
   `app.js`'teki 46 gerçek cümle belirtece çevrilip geri render edildiğinde
   **bayt bayt aynı** HTML çıkıyor (31 doğrulama, 9 negatif kontrol).
   Ayrıntı: **[tests/metin.mjs](tests/metin.mjs)**.

   **Bu maddenin eski hali "40 fonksiyon iki kez taşınır" diyordu; ölçüm bunu üç
   yönden düzeltti:** (a) skor motoru neredeyse etiketsiz — 1.405 satırlık 9 dilimde
   **2 satır / 4 etiket**, ikisi de statik `COMPOSITE_MATRIX` verisi; (b) etiket gömen
   63 yerin **38'i** zaten kendisi DOM'a yazıyor, yani RN için nasılsa yeniden
   yazılacak sunum kodu; (c) dosyanın tamamında 1.337 yapısal satıra karşılık yalnız
   **46 cümle satırı** var. Cümle kurma işi `/api/analyze` + `/api/recommend`'e ait;
   `/api/score` taşınırken çevrilecek olan yalnız o 2 satır.
2. **`/api/score`** — 52 fonksiyon + 5 arayüz. İlk uç bu olmalı: en küçük kapanış,
   en yüksek değer, diğer bütün uçlar buna dayanıyor. Aday motor artık
   `PARITE_APP=... node tests/parity.mjs` ile **canlıya dokunmadan** ölçülebilir.

   **Adım 1 — motor taşıyıcısı → TAMAM** (2026-10-12). Sunucuda motor
   `tests/engine.mjs` gibi kurulamaz (`tests/` yayına gitmiyor, `app.js` tarayıcı
   varlığı), bu yüzden tek bir ESM modülüne **üretiliyor**:
   **[api/_motor.js](api/_motor.js)** — 1.405 satır / 9 dilim / 23 sembol, dışa
   verdiği tek giriş `buildMotor(H)` ve `H` o beş arayüzün ta kendisi (§4). `_`
   öneki Vercel'in dosyayı rotaya çevirmesini engelliyor.
   Kopya **değil**: **[tools/motor-uret.mjs](tools/motor-uret.mjs)** her seferinde
   `app.js`'i yeniden dilimliyor, **[tests/uretim-test.mjs](tests/uretim-test.mjs)**
   (34 denetim) "bu dosya app.js'in ŞU ANKİ hali mi?" sorusunu soruyor — elle
   düzenleme ya da app.js kayması testi kırmızı yakıyor.
   **Kanıt:** parite artık iki şeritte koşuyor ve ikisi de aynı `baseline.json`'a
   karşı **FARK 0** veriyor — `node tests/parity.mjs` (bellekte dilimlenmiş) ve
   `PARITE_MOTOR=uretilmis node tests/parity.mjs` (diskteki üretilmiş motor).
   Negatif kontrol: üretilmiş dosyada `taBand` eşiği 54→55 bozulunca test hem metin
   farkını (satır 912) hem davranış farkını yakalayıp çıkış 1 verdi.

   **Adım 2 — `api/score.js` ucu → sırada.** Yapılacaklar: ESM `export default
   handler` (diğer beş uçla aynı biçim) + `vercel.json` `functions` girdisi;
   §5.1 gereği **ham sayı** döndürmek (biçimlendirme istemcide kalır); §5.2'deki
   F/K kriterinin **üç ekran kopyasının** motora devri; `COMPOSITE_MATRIX`'in
   2 etiketli satırının belirtece çevrilmesi.
3. ~~Skor paritesi testi~~ → **TAMAM** (2026-10-11). `tests/` · 20 sembol + 9 sentetik
   bileşke vektörü · **fark 0** · negatif kontrol 44 farkla kırmızı yandı.
   Ayrıntı: **[tests/README.md](tests/README.md)**.

---

*Bilgi amaçlıdır, yatırım tavsiyesi değildir.*
