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

## 5. Sonraki iş

1. **Metin biçimi kararı** — 40 "gizli sunum" fonksiyonu Türkçe metne `<b>`/`<i>`
   gömüyor; React Native bunu render etmez. Karar bu fazda verilmeli (öneri:
   belirteç dizisi), yoksa 40 fonksiyon iki kez taşınır.
2. **`/api/score`** — 52 fonksiyon + 5 arayüz. İlk uç bu olmalı: en küçük kapanış,
   en yüksek değer, diğer bütün uçlar buna dayanıyor.
3. **Skor paritesi testi** — 20 sembol (10 BIST + 10 ABD) referans anlık görüntüsü;
   `/api/score` çıktısıyla **fark 0** olmalı. Taşıma bu test geçmeden bitmiş sayılmaz.

---

*Bilgi amaçlıdır, yatırım tavsiyesi değildir.*
